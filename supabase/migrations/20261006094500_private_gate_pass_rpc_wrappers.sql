-- Harden student gate-pass RPCs and scope role resolution to the student's institution.
-- Public RPC signatures remain SECURITY INVOKER wrappers.
-- Privileged writes live in private SECURITY DEFINER implementations with explicit authorization.
-- Fixes cross-institution multi-role ambiguity for Parent gate-pass requests.
-- Applied to production on 2026-10-06 after rollback and post-apply regression.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 18 to 16.

create or replace function private.create_student_gate_pass_v1(
  p_student_id uuid,
  p_exit_date date,
  p_exit_time time without time zone,
  p_pickup_name text,
  p_pickup_phone text,
  p_pickup_relation text,
  p_reason text
)
returns public.student_gate_passes
language plpgsql security definer set search_path=''
as $$
declare
  s public.core_students%rowtype;
  r text;
  uid uuid := (select auth.uid());
  result_row public.student_gate_passes%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into s
  from public.core_students
  where id=p_student_id;

  if s.id is null then raise exception 'Student not found'; end if;
  if p_exit_date is null or p_exit_date<current_date then
    raise exception 'Exit date must be today or future';
  end if;
  if p_exit_time is null then
    raise exception 'Exit time required';
  end if;
  if nullif(trim(p_pickup_name),'') is null or nullif(trim(p_reason),'') is null then
    raise exception 'Pickup person and reason required';
  end if;

  if exists(
    select 1
    from public.institutions i
    where i.id=s.institution_id
      and i.owner_user_id=uid
  ) then
    r:='head_of_institute';
  else
    select m.role into r
    from public.institution_members m
    where m.institution_id=s.institution_id
      and m.user_id=uid;
  end if;

  if r='head_of_institute' then
    null;
  elsif r='parent' then
    if not exists(
      select 1
      from public.parent_student_links l
      where l.institution_id=s.institution_id
        and l.parent_user_id=uid
        and l.student_user_id=s.auth_user_id
        and l.status='approved'
    ) then
      raise exception 'Parent is not linked to this student';
    end if;
  else
    raise exception 'Only Parent or Head can request a gate pass';
  end if;

  insert into public.student_gate_passes(
    institution_id,student_id,exit_date,exit_time,pickup_name,pickup_phone,
    pickup_relation,reason,requested_by
  ) values(
    s.institution_id,s.id,p_exit_date,p_exit_time,trim(p_pickup_name),
    nullif(trim(p_pickup_phone),''),nullif(trim(p_pickup_relation),''),
    trim(p_reason),uid
  )
  returning * into result_row;

  if r='parent' then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    select
      i.id,i.owner_user_id,uid,'gate_pass','Gate pass request',
      left(s.name||' · '||trim(p_reason),180)
    from public.institutions i
    where i.id=s.institution_id;
  end if;

  return result_row;
end;
$$;

create or replace function private.update_student_gate_pass_status_v1(
  p_gate_pass_id uuid,
  p_status text,
  p_admin_note text
)
returns public.student_gate_passes
language plpgsql security definer set search_path=''
as $$
declare
  g public.student_gate_passes%rowtype;
  s public.core_students%rowtype;
  uid uuid := (select auth.uid());
  result_row public.student_gate_passes%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if p_status not in ('Approved','Rejected','Exited','Cancelled') then
    raise exception 'Invalid status';
  end if;

  select * into g
  from public.student_gate_passes
  where id=p_gate_pass_id
  for update;

  if g.id is null then
    raise exception 'Gate pass not found';
  end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=g.institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'Head access required';
  end if;

  if p_status='Exited' and g.status<>'Approved' then
    raise exception 'Only approved gate pass can be marked Exited';
  end if;

  update public.student_gate_passes
  set status=p_status,
      admin_note=coalesce(nullif(trim(p_admin_note),''),admin_note),
      approved_by=case when p_status='Approved' then uid else approved_by end,
      approved_at=case when p_status='Approved' then now() else approved_at end,
      exited_at=case when p_status='Exited' then now() else exited_at end,
      updated_at=now()
  where id=g.id
  returning * into result_row;

  select * into s
  from public.core_students
  where id=g.student_id;

  if s.auth_user_id is not null then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    values(
      g.institution_id,s.auth_user_id,uid,'gate_pass',
      'Gate pass '||lower(p_status),left(result_row.reason,180)
    );
  end if;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select
    g.institution_id,l.parent_user_id,uid,'gate_pass',
    'Gate pass '||lower(p_status),left(result_row.reason,180)
  from public.parent_student_links l
  where l.institution_id=g.institution_id
    and l.student_user_id=s.auth_user_id
    and l.status='approved';

  return result_row;
end;
$$;

revoke all on function private.create_student_gate_pass_v1(uuid,date,time without time zone,text,text,text,text) from public,anon;
revoke all on function private.update_student_gate_pass_status_v1(uuid,text,text) from public,anon;

grant execute on function private.create_student_gate_pass_v1(uuid,date,time without time zone,text,text,text,text) to authenticated;
grant execute on function private.update_student_gate_pass_status_v1(uuid,text,text) to authenticated;

create or replace function public.create_student_gate_pass(
  p_student_id uuid,
  p_exit_date date,
  p_exit_time time without time zone,
  p_pickup_name text,
  p_pickup_phone text,
  p_pickup_relation text,
  p_reason text
)
returns public.student_gate_passes
language sql security invoker set search_path=''
as $$
  select private.create_student_gate_pass_v1(
    p_student_id,p_exit_date,p_exit_time,p_pickup_name,p_pickup_phone,
    p_pickup_relation,p_reason
  );
$$;

create or replace function public.update_student_gate_pass_status(
  p_gate_pass_id uuid,
  p_status text,
  p_admin_note text
)
returns public.student_gate_passes
language sql security invoker set search_path=''
as $$
  select private.update_student_gate_pass_status_v1(
    p_gate_pass_id,p_status,p_admin_note
  );
$$;

revoke all on function public.create_student_gate_pass(uuid,date,time without time zone,text,text,text,text) from public,anon;
revoke all on function public.update_student_gate_pass_status(uuid,text,text) from public,anon;

grant execute on function public.create_student_gate_pass(uuid,date,time without time zone,text,text,text,text) to authenticated;
grant execute on function public.update_student_gate_pass_status(uuid,text,text) to authenticated;
