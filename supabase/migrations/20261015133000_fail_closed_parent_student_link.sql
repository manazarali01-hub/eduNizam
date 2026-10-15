-- Fail closed for parent linking when role metadata is missing or a school-local
-- student code is ambiguous across institutions. This avoids arbitrary cross-school
-- matches caused by SELECT ... LIMIT 1 on a non-globally-unique student_code.
create or replace function public.request_parent_link_by_student_code(p_student_code text)
returns public.parent_student_links
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  profile_role text;
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

  select p.account_role into profile_role
  from public.user_profiles p
  where p.user_id = uid;

  -- IS DISTINCT FROM rejects both wrong roles and missing/null profiles.
  if profile_role is distinct from 'parent' then
    raise exception 'Parent account required';
  end if;

  select count(*) into matching_students
  from public.core_students cs
  where upper(btrim(coalesce(cs.student_code, ''))) = clean_code
    and cs.auth_user_id is not null;

  if matching_students = 0 then
    raise exception 'Student code not found or student account is not linked yet';
  end if;

  -- Student codes are only unique within a school in the current schema.
  -- Never select an arbitrary student if multiple schools use the same code.
  if matching_students > 1 then
    raise exception 'Student code is ambiguous; contact the school to request parent linking';
  end if;

  select cs.* into student_row
  from public.core_students cs
  where upper(btrim(coalesce(cs.student_code, ''))) = clean_code
    and cs.auth_user_id is not null
  limit 1;

  if student_row.id is null then
    raise exception 'Student code not found or student account is not linked yet';
  end if;

  insert into public.parent_student_links(parent_user_id, student_user_id, institution_id, status)
  values(uid, student_row.auth_user_id, student_row.institution_id, 'pending')
  on conflict (parent_user_id, student_user_id)
  do update set institution_id = excluded.institution_id,
    status = case when public.parent_student_links.status = 'approved'
      then 'approved' else 'pending' end
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.request_parent_link_by_student_code(text) from public, anon;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;
