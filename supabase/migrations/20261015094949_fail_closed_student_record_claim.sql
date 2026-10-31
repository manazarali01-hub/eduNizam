-- Fail closed when a student tries to claim a legacy student record without a school scope.
-- The current public claim_student_record RPC must never resolve a student code across schools.
-- This migration only changes the database when explicitly applied; CI validates the guard statically.

create or replace function private.claim_student_record_impl(p_student_code text)
returns table(student_id uuid, institution_id uuid, student_name text, class_name text, student_code text)
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  profile public.user_profiles%rowtype;
  s public.core_students%rowtype;
  clean_code text := upper(btrim(coalesce(p_student_code,'')));
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_code = '' then
    raise exception 'Student Code is required';
  end if;

  select p.* into profile
  from public.user_profiles p
  where p.user_id=uid;

  if not found then
    raise exception 'Student profile not found';
  end if;

  if profile.account_role is distinct from 'student' then
    raise exception 'Student account required';
  end if;

  -- Fail closed: a student code is only meaningful inside an already-authorized school.
  if profile.institution_id is null then
    raise exception 'Student account is not linked to a school';
  end if;

  select cs.* into s
  from public.core_students cs
  where cs.institution_id=profile.institution_id
    and upper(btrim(coalesce(cs.student_code,'')))=clean_code
  limit 1
  for update;

  if s.id is null then
    raise exception 'Student code not found in your school';
  end if;

  if s.auth_user_id is not null and s.auth_user_id <> uid then
    raise exception 'This student record is already linked to another account';
  end if;

  if exists (
    select 1
    from public.core_students existing
    where existing.auth_user_id=uid
      and existing.id<>s.id
  ) then
    raise exception 'This account is already linked to another student record';
  end if;

  update public.core_students
  set auth_user_id=uid,
      updated_at=now()
  where id=s.id;

  return query
  select s.id,s.institution_id,s.name,s.class_name,s.student_code;
end;
$$;

revoke all on function private.claim_student_record_impl(text) from public, anon;
grant execute on function private.claim_student_record_impl(text) to authenticated;
