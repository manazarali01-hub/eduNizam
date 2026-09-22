-- Secure same-school Student and Parent linking
-- Applied to Supabase production on 2026-09-22.

create unique index if not exists core_students_institution_student_code_uidx
on public.core_students (institution_id, upper(btrim(student_code)))
where student_code is not null and btrim(student_code) <> '';

create or replace function public.claim_student_account_v1(p_student_code text)
returns table(
  student_id uuid,
  student_code text,
  student_name text,
  institution_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean_code text := upper(btrim(coalesce(p_student_code,'')));
  profile_role text;
  profile_institution uuid;
  student_row public.core_students%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_code = '' then
    raise exception 'Student Code is required';
  end if;

  select p.account_role,p.institution_id
    into profile_role,profile_institution
  from public.user_profiles p
  where p.user_id=uid
  limit 1;

  if profile_role <> 'student' then
    raise exception 'Student account required';
  end if;

  if profile_institution is null then
    raise exception 'Student account is not linked to a school';
  end if;

  select s.*
    into student_row
  from public.core_students s
  where s.institution_id=profile_institution
    and upper(btrim(coalesce(s.student_code,'')))=clean_code
  limit 1
  for update;

  if student_row.id is null then
    raise exception 'Student Code was not found in your school';
  end if;

  if student_row.auth_user_id is not null and student_row.auth_user_id <> uid then
    raise exception 'This Student Code is already linked to another account';
  end if;

  if exists(
    select 1
    from public.core_students s
    where s.auth_user_id=uid
      and s.id<>student_row.id
  ) then
    raise exception 'This account is already linked to another student record';
  end if;

  update public.core_students
  set auth_user_id=uid,
      updated_at=now()
  where id=student_row.id;

  return query
  select student_row.id,student_row.student_code,student_row.name,student_row.institution_id;
end;
$$;

revoke execute on function public.claim_student_account_v1(text) from public, anon;
grant execute on function public.claim_student_account_v1(text) to authenticated;

create or replace function public.request_parent_link_by_student_code(p_student_code text)
returns public.parent_student_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean_code text := upper(btrim(coalesce(p_student_code,'')));
  profile_role text;
  profile_institution uuid;
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_code = '' then
    raise exception 'Student Code is required';
  end if;

  select p.account_role,p.institution_id
    into profile_role,profile_institution
  from public.user_profiles p
  where p.user_id=uid
  limit 1;

  if profile_role <> 'parent' then
    raise exception 'Parent account required';
  end if;

  if profile_institution is null then
    raise exception 'Parent account is not linked to a school';
  end if;

  select s.*
    into student_row
  from public.core_students s
  where s.institution_id=profile_institution
    and upper(btrim(coalesce(s.student_code,'')))=clean_code
    and s.auth_user_id is not null
  limit 1;

  if student_row.id is null then
    raise exception 'Student Code not found in your school or student login is not linked yet';
  end if;

  insert into public.parent_student_links(parent_user_id,student_user_id,institution_id,status)
  values(uid,student_row.auth_user_id,profile_institution,'pending')
  on conflict (parent_user_id,student_user_id)
  do update set institution_id=excluded.institution_id,status='pending'
  returning * into result_row;

  return result_row;
end;
$$;

revoke execute on function public.request_parent_link_by_student_code(text) from public, anon;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;
