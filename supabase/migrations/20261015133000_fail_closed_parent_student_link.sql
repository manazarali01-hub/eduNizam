-- Fail closed for parent linking and preserve the private-RPC wrapper architecture.
-- This migration has not been applied to the live database yet, so harden the
-- existing pending migration in place rather than briefly deploying an unsafe
-- intermediate public RPC before a follow-up migration.
create or replace function private.request_parent_link_by_student_code_impl(p_student_code text)
returns public.parent_student_links
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  profile_role text;
  profile_institution uuid;
  clean_code text := upper(btrim(coalesce(p_student_code, '')));
  matching_students bigint;
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_code = '' then
    raise exception 'Student Code is required';
  end if;

  select p.account_role, p.institution_id
    into profile_role, profile_institution
  from public.user_profiles p
  where p.user_id = uid;

  if profile_role is distinct from 'parent' then
    raise exception 'Parent account required';
  end if;

  if profile_institution is null then
    raise exception 'Parent account is not linked to a school';
  end if;

  select count(*) into matching_students
  from public.core_students cs
  where cs.institution_id = profile_institution
    and upper(btrim(coalesce(cs.student_code, ''))) = clean_code
    and cs.auth_user_id is not null;

  if matching_students = 0 then
    raise exception 'Student Code not found in your school or student login is not linked yet';
  end if;

  if matching_students > 1 then
    raise exception 'Student code is ambiguous in your school; contact the school to request parent linking';
  end if;

  select cs.* into student_row
  from public.core_students cs
  where cs.institution_id = profile_institution
    and upper(btrim(coalesce(cs.student_code, ''))) = clean_code
    and cs.auth_user_id is not null
  limit 1;

  if student_row.id is null then
    raise exception 'Student Code not found in your school or student login is not linked yet';
  end if;

  insert into public.parent_student_links(parent_user_id, student_user_id, institution_id, status)
  values(uid, student_row.auth_user_id, profile_institution, 'pending')
  on conflict (institution_id, parent_user_id, student_user_id)
  do update set status = case
    when public.parent_student_links.status = 'approved' then 'approved'
    else 'pending'
  end
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.request_parent_link_by_student_code(p_student_code text)
returns public.parent_student_links
language sql
set search_path=''
as $function$
  select private.request_parent_link_by_student_code_impl(p_student_code);
$function$;

revoke all on function private.request_parent_link_by_student_code_impl(text) from public, anon;
grant execute on function private.request_parent_link_by_student_code_impl(text) to authenticated;
revoke all on function public.request_parent_link_by_student_code(text) from public, anon;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;
