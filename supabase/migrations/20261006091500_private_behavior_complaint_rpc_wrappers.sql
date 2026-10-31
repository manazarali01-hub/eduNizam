-- Harden student behavior and parent-complaint mutation RPCs.
-- Public RPC signatures remain unchanged as SECURITY INVOKER wrappers.
-- Privileged writes live in private SECURITY DEFINER implementations with explicit auth and relationship checks.
-- Applied to production on 2026-10-06 after rollback-only regression.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 26 to 20.

create or replace function private.create_student_behavior_record_v1(
  p_student_id uuid,
  p_record_type text,
  p_severity text,
  p_record_date date,
  p_title text,
  p_details text,
  p_action_taken text,
  p_family_visible boolean
)
returns public.student_behavior_records
language plpgsql security definer set search_path=''
as $$
declare
  s public.core_students%rowtype;
  r text;
  uid uuid := (select auth.uid());
  result_row public.student_behavior_records%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into s from public.core_students where id=p_student_id;
  if s.id is null then raise exception 'Student not found'; end if;

  r:=private.current_account_role_v1(uid);

  if r='head_of_institute' then
    if not exists(
      select 1 from public.institutions i
      where i.id=s.institution_id and i.owner_user_id=uid
    ) then raise exception 'Head access required'; end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=s.institution_id
        and tsl.teacher_user_id=uid
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can record behavior only for assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  if p_record_type not in ('Positive Note','Concern','Warning','Incident') then
    raise exception 'Invalid record type';
  end if;
  if p_severity not in ('Low','Medium','High') then
    raise exception 'Invalid severity';
  end if;
  if nullif(trim(p_title),'') is null then raise exception 'Title required'; end if;

  insert into public.student_behavior_records(
    institution_id,student_id,record_type,severity,record_date,title,details,
    action_taken,family_visible,created_by,updated_by
  ) values(
    s.institution_id,s.id,p_record_type,p_severity,coalesce(p_record_date,current_date),
    trim(p_title),nullif(trim(p_details),''),nullif(trim(p_action_taken),''),
    coalesce(p_family_visible,false),uid,uid
  )
  returning * into result_row;

  if result_row.family_visible then
    if s.auth_user_id is not null then
      insert into public.user_notifications(
        institution_id,recipient_user_id,created_by,category,title,body
      )
      values(
        s.institution_id,s.auth_user_id,uid,'behavior',
        'Student development update',left(result_row.title,180)
      );
    end if;

    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    select
      s.institution_id,l.parent_user_id,uid,'behavior',
      'Student development update',left(result_row.title,180)
    from public.parent_student_links l
    where l.institution_id=s.institution_id
      and l.student_user_id=s.auth_user_id
      and l.status='approved';
  end if;

  return result_row;
end;
$$;

create or replace function private.acknowledge_student_behavior_record_v1(
  p_record_id uuid
)
returns public.student_behavior_records
language plpgsql security definer set search_path=''
as $$
declare
  b public.student_behavior_records%rowtype;
  s public.core_students%rowtype;
  uid uuid := (select auth.uid());
  result_row public.student_behavior_records%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into b
  from public.student_behavior_records
  where id=p_record_id
  for update;

  if b.id is null then raise exception 'Record not found'; end if;
  if not b.family_visible then raise exception 'Record is staff-only'; end if;

  select * into s from public.core_students where id=b.student_id;

  if not (
    s.auth_user_id=uid
    or exists(
      select 1 from public.parent_student_links l
      where l.institution_id=s.institution_id
        and l.parent_user_id=uid
        and l.student_user_id=s.auth_user_id
        and l.status='approved'
    )
  ) then
    raise exception 'Acknowledgement access denied';
  end if;

  update public.student_behavior_records
  set acknowledged_at=coalesce(acknowledged_at,now()),
      acknowledged_by=coalesce(acknowledged_by,uid),
      updated_at=now()
  where id=b.id
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function private.create_student_parent_complaint_v1(
  p_student_id uuid,
  p_subject text,
  p_message text,
  p_severity text,
  p_action_requested text
)
returns public.student_parent_complaints
language plpgsql security definer set search_path=''
as $$
declare
  s public.core_students%rowtype;
  r text;
  uid uuid := (select auth.uid());
  result_row public.student_parent_complaints%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into s from public.core_students where id=p_student_id;
  if s.id is null then raise exception 'Student not found'; end if;
  if nullif(trim(p_subject),'') is null or nullif(trim(p_message),'') is null then
    raise exception 'Subject and complaint message required';
  end if;
  if p_severity not in ('Information','Concern','Serious') then
    raise exception 'Invalid severity';
  end if;

  r:=private.current_account_role_v1(uid);

  if r='head_of_institute' then
    if not exists(
      select 1 from public.institutions i
      where i.id=s.institution_id and i.owner_user_id=uid
    ) then raise exception 'Head access required'; end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=s.institution_id
        and tsl.teacher_user_id=uid
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can complain only about assigned students'; end if;
  else
    raise exception 'Only Head or Teacher can send a student complaint';
  end if;

  if s.auth_user_id is null or not exists(
    select 1 from public.parent_student_links l
    where l.institution_id=s.institution_id
      and l.student_user_id=s.auth_user_id
      and l.status='approved'
  ) then raise exception 'No approved parent account is linked to this student'; end if;

  insert into public.student_parent_complaints(
    institution_id,student_id,subject,message,severity,action_requested,created_by
  ) values(
    s.institution_id,s.id,trim(p_subject),trim(p_message),p_severity,
    nullif(trim(p_action_requested),''),uid
  )
  returning * into result_row;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select
    s.institution_id,l.parent_user_id,uid,'parent_complaint',
    'Student complaint notice',left(s.name||' · '||result_row.subject,180)
  from public.parent_student_links l
  where l.institution_id=s.institution_id
    and l.student_user_id=s.auth_user_id
    and l.status='approved';

  return result_row;
end;
$$;

create or replace function private.acknowledge_student_parent_complaint_v1(
  p_complaint_id uuid
)
returns public.student_parent_complaints
language plpgsql security definer set search_path=''
as $$
declare
  c public.student_parent_complaints%rowtype;
  s public.core_students%rowtype;
  uid uuid := (select auth.uid());
  result_row public.student_parent_complaints%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into c
  from public.student_parent_complaints
  where id=p_complaint_id
  for update;

  if c.id is null then raise exception 'Complaint not found'; end if;

  select * into s from public.core_students where id=c.student_id;

  if not exists(
    select 1 from public.parent_student_links l
    where l.institution_id=c.institution_id
      and l.parent_user_id=uid
      and l.student_user_id=s.auth_user_id
      and l.status='approved'
  ) then raise exception 'Parent access denied'; end if;

  update public.student_parent_complaints
  set acknowledged_at=coalesce(acknowledged_at,now()),
      acknowledged_by=coalesce(acknowledged_by,uid),
      updated_at=now()
  where id=c.id
  returning * into result_row;

  if result_row.created_by<>uid then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    values(
      c.institution_id,result_row.created_by,uid,'parent_complaint',
      'Parent acknowledged complaint',left(result_row.subject,180)
    );
  end if;

  return result_row;
end;
$$;

create or replace function private.resolve_student_parent_complaint_v1(
  p_complaint_id uuid
)
returns public.student_parent_complaints
language plpgsql security definer set search_path=''
as $$
declare
  c public.student_parent_complaints%rowtype;
  uid uuid := (select auth.uid());
  result_row public.student_parent_complaints%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into c
  from public.student_parent_complaints
  where id=p_complaint_id
  for update;

  if c.id is null then raise exception 'Complaint not found'; end if;

  if not exists(
    select 1 from public.institutions i
    where i.id=c.institution_id and i.owner_user_id=uid
  ) then raise exception 'Head access required'; end if;

  update public.student_parent_complaints
  set status='Resolved',
      resolved_at=now(),
      resolved_by=uid,
      updated_at=now()
  where id=c.id
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function private.resolve_student_parent_complaint_v2(
  p_complaint_id uuid,
  p_resolution_note text
)
returns public.student_parent_complaints
language plpgsql security definer set search_path=''
as $$
declare
  c public.student_parent_complaints%rowtype;
  s public.core_students%rowtype;
  uid uuid := (select auth.uid());
  result_row public.student_parent_complaints%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_resolution_note),'') is null then
    raise exception 'Resolution note is required';
  end if;

  select * into c
  from public.student_parent_complaints
  where id=p_complaint_id
  for update;

  if c.id is null then raise exception 'Complaint not found'; end if;

  if not exists(
    select 1 from public.institutions i
    where i.id=c.institution_id and i.owner_user_id=uid
  ) then raise exception 'Head access required'; end if;

  select * into s from public.core_students where id=c.student_id;

  update public.student_parent_complaints
  set status='Resolved',
      resolved_at=now(),
      resolved_by=uid,
      resolution_note=trim(p_resolution_note),
      updated_at=now()
  where id=c.id
  returning * into result_row;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select
    c.institution_id,l.parent_user_id,uid,'parent_complaint',
    'Student complaint resolved',
    left(coalesce(s.name,'Student')||' · '||result_row.subject||' · '||result_row.resolution_note,180)
  from public.parent_student_links l
  where l.institution_id=c.institution_id
    and l.student_user_id=s.auth_user_id
    and l.status='approved'
    and l.parent_user_id<>uid;

  if c.created_by<>uid then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    values(
      c.institution_id,c.created_by,uid,'parent_complaint',
      'Complaint resolved',left(result_row.subject||' · '||result_row.resolution_note,180)
    );
  end if;

  return result_row;
end;
$$;

revoke all on function private.create_student_behavior_record_v1(uuid,text,text,date,text,text,text,boolean) from public,anon;
revoke all on function private.acknowledge_student_behavior_record_v1(uuid) from public,anon;
revoke all on function private.create_student_parent_complaint_v1(uuid,text,text,text,text) from public,anon;
revoke all on function private.acknowledge_student_parent_complaint_v1(uuid) from public,anon;
revoke all on function private.resolve_student_parent_complaint_v1(uuid) from public,anon;
revoke all on function private.resolve_student_parent_complaint_v2(uuid,text) from public,anon;

grant execute on function private.create_student_behavior_record_v1(uuid,text,text,date,text,text,text,boolean) to authenticated;
grant execute on function private.acknowledge_student_behavior_record_v1(uuid) to authenticated;
grant execute on function private.create_student_parent_complaint_v1(uuid,text,text,text,text) to authenticated;
grant execute on function private.acknowledge_student_parent_complaint_v1(uuid) to authenticated;
grant execute on function private.resolve_student_parent_complaint_v1(uuid) to authenticated;
grant execute on function private.resolve_student_parent_complaint_v2(uuid,text) to authenticated;

create or replace function public.create_student_behavior_record(
  p_student_id uuid,
  p_record_type text,
  p_severity text,
  p_record_date date,
  p_title text,
  p_details text,
  p_action_taken text,
  p_family_visible boolean
)
returns public.student_behavior_records
language sql security invoker set search_path=''
as $$
  select private.create_student_behavior_record_v1(
    p_student_id,p_record_type,p_severity,p_record_date,p_title,p_details,
    p_action_taken,p_family_visible
  );
$$;

create or replace function public.acknowledge_student_behavior_record(
  p_record_id uuid
)
returns public.student_behavior_records
language sql security invoker set search_path=''
as $$
  select private.acknowledge_student_behavior_record_v1(p_record_id);
$$;

create or replace function public.create_student_parent_complaint(
  p_student_id uuid,
  p_subject text,
  p_message text,
  p_severity text,
  p_action_requested text
)
returns public.student_parent_complaints
language sql security invoker set search_path=''
as $$
  select private.create_student_parent_complaint_v1(
    p_student_id,p_subject,p_message,p_severity,p_action_requested
  );
$$;

create or replace function public.acknowledge_student_parent_complaint(
  p_complaint_id uuid
)
returns public.student_parent_complaints
language sql security invoker set search_path=''
as $$
  select private.acknowledge_student_parent_complaint_v1(p_complaint_id);
$$;

create or replace function public.resolve_student_parent_complaint(
  p_complaint_id uuid
)
returns public.student_parent_complaints
language sql security invoker set search_path=''
as $$
  select private.resolve_student_parent_complaint_v1(p_complaint_id);
$$;

create or replace function public.resolve_student_parent_complaint_v2(
  p_complaint_id uuid,
  p_resolution_note text
)
returns public.student_parent_complaints
language sql security invoker set search_path=''
as $$
  select private.resolve_student_parent_complaint_v2(p_complaint_id,p_resolution_note);
$$;

revoke all on function public.create_student_behavior_record(uuid,text,text,date,text,text,text,boolean) from public,anon;
revoke all on function public.acknowledge_student_behavior_record(uuid) from public,anon;
revoke all on function public.create_student_parent_complaint(uuid,text,text,text,text) from public,anon;
revoke all on function public.acknowledge_student_parent_complaint(uuid) from public,anon;
revoke all on function public.resolve_student_parent_complaint(uuid) from public,anon;
revoke all on function public.resolve_student_parent_complaint_v2(uuid,text) from public,anon;

grant execute on function public.create_student_behavior_record(uuid,text,text,date,text,text,text,boolean) to authenticated;
grant execute on function public.acknowledge_student_behavior_record(uuid) to authenticated;
grant execute on function public.create_student_parent_complaint(uuid,text,text,text,text) to authenticated;
grant execute on function public.acknowledge_student_parent_complaint(uuid) to authenticated;
grant execute on function public.resolve_student_parent_complaint(uuid) to authenticated;
grant execute on function public.resolve_student_parent_complaint_v2(uuid,text) to authenticated;
