-- Harden student-claim and parent-link RPCs without changing public signatures.
-- Elevated implementations live in private; exposed public functions are SECURITY INVOKER.
-- Existing authentication, school-scope and ownership checks are preserved.
-- Applied to production on 2026-10-06 after rollback validation; Supabase security-definer
-- advisor findings reduced from 9 to 5.

create or replace function private.claim_student_account_v1_impl(p_student_code text)
returns table(student_id uuid, student_code text, student_name text, institution_id uuid)
language plpgsql security definer set search_path=''
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

create or replace function private.claim_student_record_impl(p_student_code text)
returns table(student_id uuid, institution_id uuid, student_name text, class_name text, student_code text)
language plpgsql security definer set search_path=''
as $$
declare
  profile public.user_profiles%rowtype;
  s public.core_students%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select p.* into profile
  from public.user_profiles p
  where p.user_id=auth.uid();

  if profile.account_role <> 'student' then
    raise exception 'Student account required';
  end if;

  select cs.* into s
  from public.core_students cs
  where upper(cs.student_code)=upper(trim(p_student_code))
    and (profile.institution_id is null or cs.institution_id=profile.institution_id)
  limit 1
  for update;

  if s.id is null then raise exception 'Student code not found in your institute'; end if;

  if s.auth_user_id is not null and s.auth_user_id <> auth.uid() then
    raise exception 'This student record is already linked to another account';
  end if;

  update public.core_students
  set auth_user_id=auth.uid(),updated_at=now()
  where id=s.id;

  update public.user_profiles
  set institution_id=s.institution_id,updated_at=now()
  where user_id=auth.uid();

  return query
  select s.id,s.institution_id,s.name,s.class_name,s.student_code;
end;
$$;

create or replace function private.request_parent_link_by_student_code_impl(p_student_code text)
returns public.parent_student_links
language plpgsql security definer set search_path=''
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
  on conflict (institution_id,parent_user_id,student_user_id)
  do update set institution_id=excluded.institution_id,status='pending'
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function private.request_parent_link_by_student_code_v2_impl(
  p_institution_id uuid,
  p_student_code text
)
returns public.parent_student_links
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  clean_code text := upper(btrim(coalesce(p_student_code,'')));
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_code='' then raise exception 'Student Code is required'; end if;

  if not exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=uid
      and m.role='parent'
  ) then
    raise exception 'Approved Parent membership is required for this school';
  end if;

  select s.* into student_row
  from public.core_students s
  where s.institution_id=p_institution_id
    and upper(btrim(coalesce(s.student_code,'')))=clean_code
    and s.auth_user_id is not null
  limit 1;

  if student_row.id is null then
    raise exception 'Student Code not found in the selected school or Student login is not linked yet';
  end if;

  insert into public.parent_student_links(
    institution_id,parent_user_id,student_user_id,status
  ) values(
    p_institution_id,uid,student_row.auth_user_id,'pending'
  )
  on conflict (institution_id,parent_user_id,student_user_id)
  do update set status='pending'
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function private.claim_student_account_v1_impl(text) from public,anon;
revoke all on function private.claim_student_record_impl(text) from public,anon;
revoke all on function private.request_parent_link_by_student_code_impl(text) from public,anon;
revoke all on function private.request_parent_link_by_student_code_v2_impl(uuid,text) from public,anon;

grant execute on function private.claim_student_account_v1_impl(text) to authenticated;
grant execute on function private.claim_student_record_impl(text) to authenticated;
grant execute on function private.request_parent_link_by_student_code_impl(text) to authenticated;
grant execute on function private.request_parent_link_by_student_code_v2_impl(uuid,text) to authenticated;

create or replace function public.claim_student_account_v1(p_student_code text)
returns table(student_id uuid, student_code text, student_name text, institution_id uuid)
language sql security invoker set search_path=''
as $$
  select * from private.claim_student_account_v1_impl(p_student_code);
$$;

create or replace function public.claim_student_record(p_student_code text)
returns table(student_id uuid, institution_id uuid, student_name text, class_name text, student_code text)
language sql security invoker set search_path=''
as $$
  select * from private.claim_student_record_impl(p_student_code);
$$;

create or replace function public.request_parent_link_by_student_code(p_student_code text)
returns public.parent_student_links
language sql security invoker set search_path=''
as $$
  select private.request_parent_link_by_student_code_impl(p_student_code);
$$;

create or replace function public.request_parent_link_by_student_code_v2(
  p_institution_id uuid,
  p_student_code text
)
returns public.parent_student_links
language sql security invoker set search_path=''
as $$
  select private.request_parent_link_by_student_code_v2_impl(p_institution_id,p_student_code);
$$;

revoke all on function public.claim_student_account_v1(text) from public,anon;
revoke all on function public.claim_student_record(text) from public,anon;
revoke all on function public.request_parent_link_by_student_code(text) from public,anon;
revoke all on function public.request_parent_link_by_student_code_v2(uuid,text) from public,anon;

grant execute on function public.claim_student_account_v1(text) to authenticated;
grant execute on function public.claim_student_record(text) to authenticated;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;
grant execute on function public.request_parent_link_by_student_code_v2(uuid,text) to authenticated;
