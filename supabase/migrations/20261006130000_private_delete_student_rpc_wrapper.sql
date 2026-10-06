-- Harden the destructive core-student delete RPC without changing its public signature.
-- The elevated implementation moves to private; the exposed public function is SECURITY INVOKER.
-- Existing School Admin ownership checks and cleanup behavior are preserved.

create or replace function private.delete_core_student_v1_impl(
  p_institution_id uuid,
  p_local_id bigint
)
returns table(
  deleted boolean,
  student_id uuid,
  student_user_id uuid,
  student_name text
)
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
  s public.core_students%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=p_institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'Only the School Admin can delete a student';
  end if;

  select cs.*
    into s
  from public.core_students cs
  where cs.institution_id=p_institution_id
    and cs.local_id=p_local_id
  limit 1
  for update;

  if s.id is null then
    return query
    select false,null::uuid,null::uuid,null::text;
    return;
  end if;

  if s.auth_user_id is not null then
    delete from public.parent_student_links psl
    where psl.institution_id=p_institution_id
      and psl.student_user_id=s.auth_user_id;

    delete from public.teacher_student_links tsl
    where tsl.institution_id=p_institution_id
      and tsl.student_user_id=s.auth_user_id;

    delete from public.institution_members im
    where im.institution_id=p_institution_id
      and im.user_id=s.auth_user_id
      and im.role='student';

    update public.user_profiles up
    set institution_id=null,
        updated_at=now()
    where up.user_id=s.auth_user_id
      and up.institution_id=p_institution_id
      and up.account_role='student';
  end if;

  delete from public.core_students cs
  where cs.id=s.id
    and cs.institution_id=p_institution_id;

  return query
  select true,s.id,s.auth_user_id,s.name;
end;
$$;

revoke all on function private.delete_core_student_v1_impl(uuid,bigint) from public,anon;
grant execute on function private.delete_core_student_v1_impl(uuid,bigint) to authenticated;

create or replace function public.delete_core_student_v1(
  p_institution_id uuid,
  p_local_id bigint
)
returns table(
  deleted boolean,
  student_id uuid,
  student_user_id uuid,
  student_name text
)
language sql security invoker set search_path=''
as $$
  select * from private.delete_core_student_v1_impl(p_institution_id,p_local_id);
$$;

revoke all on function public.delete_core_student_v1(uuid,bigint) from public,anon;
grant execute on function public.delete_core_student_v1(uuid,bigint) to authenticated;
