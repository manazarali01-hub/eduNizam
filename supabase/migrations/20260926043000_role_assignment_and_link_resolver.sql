-- EduNizam: secure class-wise teacher assignment and manual Parent/Student link resolver

create policy if not exists "school admin creates child links"
on public.parent_student_links
for insert
to authenticated
with check (
  institution_id is not null
  and (select private.is_institution_owner(institution_id,(select auth.uid())))
);

create or replace function public.assign_teacher_class_v1(
  p_institution_id uuid,
  p_teacher_user_id uuid,
  p_class_name text,
  p_section_name text default null
)
returns table(
  matched_students integer,
  assigned_new integer,
  already_assigned integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_matched integer := 0;
  v_inserted integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_institution_id is null or p_teacher_user_id is null or nullif(btrim(p_class_name),'') is null then
    raise exception 'Institution, teacher and class are required';
  end if;

  if not exists (
    select 1 from public.institutions i
    where i.id = p_institution_id
      and i.owner_user_id = (select auth.uid())
  ) then
    raise exception 'Only the School Admin can assign a class';
  end if;

  if not exists (
    select 1 from public.institution_members m
    where m.institution_id = p_institution_id
      and m.user_id = p_teacher_user_id
      and m.role = 'teacher'
  ) then
    raise exception 'Selected teacher is not an approved teacher of this school';
  end if;

  select count(*)::integer into v_matched
  from public.core_students s
  where s.institution_id = p_institution_id
    and s.auth_user_id is not null
    and lower(btrim(coalesce(s.class_name,''))) = lower(btrim(p_class_name))
    and (
      nullif(btrim(coalesce(p_section_name,'')),'') is null
      or lower(btrim(coalesce(s.section_name,''))) = lower(btrim(p_section_name))
    );

  with inserted as (
    insert into public.teacher_student_links(
      institution_id,teacher_user_id,student_user_id,assigned_by
    )
    select
      p_institution_id,p_teacher_user_id,s.auth_user_id,(select auth.uid())
    from public.core_students s
    where s.institution_id = p_institution_id
      and s.auth_user_id is not null
      and lower(btrim(coalesce(s.class_name,''))) = lower(btrim(p_class_name))
      and (
        nullif(btrim(coalesce(p_section_name,'')),'') is null
        or lower(btrim(coalesce(s.section_name,''))) = lower(btrim(p_section_name))
      )
    on conflict (teacher_user_id,student_user_id) do nothing
    returning 1
  )
  select count(*)::integer into v_inserted from inserted;

  return query
  select v_matched, v_inserted, greatest(v_matched-v_inserted,0);
end;
$$;

revoke execute on function public.assign_teacher_class_v1(uuid,uuid,text,text) from public;
revoke execute on function public.assign_teacher_class_v1(uuid,uuid,text,text) from anon;
grant execute on function public.assign_teacher_class_v1(uuid,uuid,text,text) to authenticated;

create or replace function public.resolve_school_access_link_v1(
  p_request_id uuid,
  p_core_student_id uuid
)
returns table(
  requested_role text,
  linked boolean,
  student_name text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_req public.school_access_requests%rowtype;
  v_student public.core_students%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.school_access_requests
  where id=p_request_id;

  if not found then
    raise exception 'Access request not found';
  end if;

  if v_req.status <> 'approved' then
    raise exception 'Only approved access requests can be resolved';
  end if;

  if v_req.requested_role not in ('student','parent') then
    raise exception 'Only Student or Parent links can be resolved here';
  end if;

  if not (select private.is_institution_owner(v_req.institution_id,(select auth.uid()))) then
    raise exception 'Only the School Admin can resolve this link';
  end if;

  select * into v_student
  from public.core_students
  where id=p_core_student_id
    and institution_id=v_req.institution_id;

  if not found then
    raise exception 'Selected student record does not belong to this school';
  end if;

  if v_req.requested_role='student' then
    if not exists (
      select 1 from public.institution_members m
      where m.institution_id=v_req.institution_id
        and m.user_id=v_req.requester_user_id
        and m.role='student'
    ) then
      raise exception 'Student account is not an approved school member';
    end if;

    if v_student.auth_user_id is not null and v_student.auth_user_id<>v_req.requester_user_id then
      raise exception 'This student record is already linked to another account';
    end if;

    update public.core_students
       set auth_user_id=v_req.requester_user_id,
           updated_at=now()
     where id=v_student.id;

    return query select 'student'::text,true,v_student.name;
    return;
  end if;

  if not exists (
    select 1 from public.institution_members m
    where m.institution_id=v_req.institution_id
      and m.user_id=v_req.requester_user_id
      and m.role='parent'
  ) then
    raise exception 'Parent account is not an approved school member';
  end if;

  if v_student.auth_user_id is null then
    raise exception 'Selected child must first have an approved linked Student account';
  end if;

  if not exists (
    select 1 from public.institution_members m
    where m.institution_id=v_req.institution_id
      and m.user_id=v_student.auth_user_id
      and m.role='student'
  ) then
    raise exception 'Selected child account is not an approved Student member';
  end if;

  insert into public.parent_student_links(
    parent_user_id,student_user_id,institution_id,status
  )
  values(
    v_req.requester_user_id,v_student.auth_user_id,v_req.institution_id,'approved'
  )
  on conflict (parent_user_id,student_user_id)
  do update set status='approved',institution_id=excluded.institution_id;

  return query select 'parent'::text,true,v_student.name;
end;
$$;

revoke execute on function public.resolve_school_access_link_v1(uuid,uuid) from public;
revoke execute on function public.resolve_school_access_link_v1(uuid,uuid) from anon;
grant execute on function public.resolve_school_access_link_v1(uuid,uuid) to authenticated;
