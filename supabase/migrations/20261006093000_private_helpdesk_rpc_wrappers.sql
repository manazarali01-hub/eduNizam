-- Harden helpdesk RPCs and scope role resolution to the target institution.
-- Public signatures remain SECURITY INVOKER wrappers.
-- Privileged writes live in private SECURITY DEFINER implementations with explicit authorization.
-- Fixes cross-institution multi-role ambiguity in helpdesk ticket creation.
-- Applied to production on 2026-10-06 after rollback and post-apply regression.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 20 to 18.

create or replace function private.create_helpdesk_ticket_v1(
  p_institution_id uuid,
  p_student_id uuid,
  p_category text,
  p_priority text,
  p_subject text,
  p_description text
)
returns public.school_helpdesk_tickets
language plpgsql security definer set search_path=''
as $$
declare
  s public.core_students%rowtype;
  r text;
  uid uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
  result_row public.school_helpdesk_tickets%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if not private.is_institution_user_v1(p_institution_id,uid) then
    raise exception 'Institution access denied';
  end if;

  if p_category not in ('Academics','Attendance','Fees','Transport','Behavior','Facilities','Technical','Admission','Other') then
    raise exception 'Invalid category';
  end if;
  if p_priority not in ('Low','Normal','High') then
    raise exception 'Invalid priority';
  end if;
  if nullif(trim(p_subject),'') is null or nullif(trim(p_description),'') is null then
    raise exception 'Subject and description required';
  end if;

  if exists(
    select 1
    from public.institutions i
    where i.id=p_institution_id
      and i.owner_user_id=uid
  ) then
    r:='head_of_institute';
  else
    select m.role into r
    from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=uid;
  end if;

  if r is null then
    raise exception 'Institution access denied';
  end if;

  if p_student_id is not null then
    select * into s
    from public.core_students
    where id=p_student_id
      and institution_id=p_institution_id;

    if s.id is null then
      raise exception 'Student not found in institution';
    end if;

    if r='teacher' and not exists(
      select 1
      from public.teacher_student_links tsl
      where tsl.institution_id=p_institution_id
        and tsl.teacher_user_id=uid
        and tsl.student_user_id=s.auth_user_id
    ) then
      raise exception 'Teacher student context is not assigned';
    end if;

    if r='student' and s.auth_user_id<>uid then
      raise exception 'Student context access denied';
    end if;

    if r='parent' and not exists(
      select 1
      from public.parent_student_links l
      where l.institution_id=p_institution_id
        and l.parent_user_id=uid
        and l.student_user_id=s.auth_user_id
        and l.status='approved'
    ) then
      raise exception 'Parent student context is not linked';
    end if;
  end if;

  insert into public.school_helpdesk_tickets(
    id,ticket_no,institution_id,student_id,category,priority,subject,description,
    status,creator_role,created_by
  ) values(
    v_id,
    'HD-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,6)),
    p_institution_id,p_student_id,p_category,p_priority,trim(p_subject),
    trim(p_description),'Open',r,uid
  )
  returning * into result_row;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select
    i.id,i.owner_user_id,uid,'helpdesk','New helpdesk ticket',
    left(result_row.ticket_no||' · '||result_row.subject,180)
  from public.institutions i
  where i.id=p_institution_id
    and i.owner_user_id<>uid;

  return result_row;
end;
$$;

create or replace function private.update_helpdesk_ticket_v1(
  p_ticket_id uuid,
  p_status text,
  p_admin_response text
)
returns public.school_helpdesk_tickets
language plpgsql security definer set search_path=''
as $$
declare
  t public.school_helpdesk_tickets%rowtype;
  uid uuid := (select auth.uid());
  result_row public.school_helpdesk_tickets%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if p_status not in ('Open','In Progress','Resolved','Closed') then
    raise exception 'Invalid status';
  end if;

  select * into t
  from public.school_helpdesk_tickets
  where id=p_ticket_id
  for update;

  if t.id is null then
    raise exception 'Ticket not found';
  end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=t.institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'Head access required';
  end if;

  update public.school_helpdesk_tickets
  set status=p_status,
      admin_response=case
        when p_admin_response is null then admin_response
        else nullif(trim(p_admin_response),'')
      end,
      resolved_at=case
        when p_status='Resolved' then coalesce(resolved_at,now())
        when p_status in ('Open','In Progress') then null
        else resolved_at
      end,
      updated_at=now()
  where id=t.id
  returning * into result_row;

  if result_row.created_by<>uid then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    values(
      result_row.institution_id,result_row.created_by,uid,'helpdesk',
      'Helpdesk ticket updated',
      left(result_row.ticket_no||' · '||result_row.status,180)
    );
  end if;

  return result_row;
end;
$$;

revoke all on function private.create_helpdesk_ticket_v1(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function private.update_helpdesk_ticket_v1(uuid,text,text) from public,anon;

grant execute on function private.create_helpdesk_ticket_v1(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function private.update_helpdesk_ticket_v1(uuid,text,text) to authenticated;

create or replace function public.create_helpdesk_ticket(
  p_institution_id uuid,
  p_student_id uuid,
  p_category text,
  p_priority text,
  p_subject text,
  p_description text
)
returns public.school_helpdesk_tickets
language sql security invoker set search_path=''
as $$
  select private.create_helpdesk_ticket_v1(
    p_institution_id,p_student_id,p_category,p_priority,p_subject,p_description
  );
$$;

create or replace function public.update_helpdesk_ticket(
  p_ticket_id uuid,
  p_status text,
  p_admin_response text
)
returns public.school_helpdesk_tickets
language sql security invoker set search_path=''
as $$
  select private.update_helpdesk_ticket_v1(
    p_ticket_id,p_status,p_admin_response
  );
$$;

revoke all on function public.create_helpdesk_ticket(uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.update_helpdesk_ticket(uuid,text,text) from public,anon;

grant execute on function public.create_helpdesk_ticket(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.update_helpdesk_ticket(uuid,text,text) to authenticated;
