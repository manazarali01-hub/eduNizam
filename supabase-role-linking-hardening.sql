-- EduNizam same-school role-linking hardening
-- Applied to Supabase project qmdiexentozvhhfjvlmr on 2026-09-23.
-- Goals:
-- 1) Parent/Student signups become institution_members so Admin can see all linked logins.
-- 2) Parent-child requests are same-school only.
-- 3) Only the School Admin can approve/reject parent-child links.

create or replace function public.register_simple_account_v1(
  p_role text,
  p_school_name text,
  p_school_code text,
  p_full_name text,
  p_phone text
)
returns table(account_role text, institution_id uuid, institution_name text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  uid uuid:=auth.uid();
  clean_role text:=lower(trim(coalesce(p_role,'')));
  clean_school text:=trim(coalesce(p_school_name,''));
  clean_code text:=upper(trim(coalesce(p_school_code,'')));
  clean_name text:=trim(coalesce(p_full_name,''));
  clean_phone text:=trim(coalesce(p_phone,''));
  inst public.institutions%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_role not in ('admin','teacher','parent','student') then raise exception 'Invalid role'; end if;
  if clean_name='' then raise exception 'Full name is required'; end if;
  if clean_phone='' then raise exception 'Contact number is required'; end if;

  if clean_role='teacher' then
    raise exception 'Teacher access requires School Admin approval';
  end if;

  -- Legacy Admin branch retained while older cached clients are still in circulation.
  if clean_role='admin' then
    if clean_school='' then raise exception 'School name is required'; end if;
    if clean_code='' then raise exception 'School code is required'; end if;

    select * into inst
    from public.institutions i
    where i.owner_user_id=uid
      and upper(trim(coalesce(i.school_registration_code,'')))=clean_code
    limit 1;

    if inst.id is null then
      if exists(
        select 1 from public.institutions i
        where upper(trim(coalesce(i.school_registration_code,'')))=clean_code
      ) then
        raise exception 'This school code is already registered';
      end if;

      insert into public.institutions(
        owner_user_id,name,institution_type,admission_session,application_prefix,currency,school_registration_code
      ) values(
        uid,clean_school,'school',extract(year from current_date)::text,'ADM','PKR',clean_code
      ) returning * into inst;
    end if;

    insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
    values(uid,'head_of_institute',clean_name,clean_phone,inst.id)
    on conflict(user_id) do update
    set account_role='head_of_institute',
        full_name=excluded.full_name,
        phone=excluded.phone,
        institution_id=excluded.institution_id,
        updated_at=now();

    insert into public.institution_settings(institution_id,school_name,school_type,academic_session,phone,updated_by)
    values(inst.id,inst.name,'school',extract(year from current_date)::text,clean_phone,uid)
    on conflict on constraint institution_settings_pkey do update
    set school_name=excluded.school_name,
        phone=excluded.phone,
        updated_by=excluded.updated_by,
        updated_at=now();

    return query select 'head_of_institute'::text,inst.id,inst.name;
    return;
  end if;

  if clean_code='' then raise exception 'School code is required'; end if;

  select * into inst
  from public.institutions i
  where upper(trim(coalesce(i.school_registration_code,'')))=clean_code
  limit 1;

  if inst.id is null then raise exception 'School code not found'; end if;

  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(uid,clean_role,clean_name,clean_phone,inst.id)
  on conflict(user_id) do update
  set account_role=excluded.account_role,
      full_name=excluded.full_name,
      phone=excluded.phone,
      institution_id=excluded.institution_id,
      updated_at=now();

  insert into public.institution_members(institution_id,user_id,role)
  values(inst.id,uid,clean_role)
  on conflict on constraint institution_members_pkey do update
    set role=excluded.role;

  return query select clean_role,inst.id,inst.name;
end;
$function$;

revoke execute on function public.register_simple_account_v1(text,text,text,text,text) from public, anon;
grant execute on function public.register_simple_account_v1(text,text,text,text,text) to authenticated;

insert into public.institution_members(institution_id,user_id,role)
select p.institution_id,p.user_id,p.account_role
from public.user_profiles p
where p.institution_id is not null
  and p.account_role in ('teacher','parent','student')
on conflict on constraint institution_members_pkey do update
set role=excluded.role;

drop policy if exists "parent requests child link" on public.parent_student_links;
create policy "parent requests child link"
on public.parent_student_links
for insert
to authenticated
with check (
  parent_user_id = (select auth.uid())
  and institution_id is not null
  and exists (
    select 1
    from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.account_role = 'parent'
      and p.institution_id = parent_student_links.institution_id
  )
  and exists (
    select 1
    from public.core_students s
    where s.institution_id = parent_student_links.institution_id
      and s.auth_user_id = parent_student_links.student_user_id
  )
);

drop policy if exists "parent/student read own links" on public.parent_student_links;
create policy "parent/student read own links"
on public.parent_student_links
for select
to authenticated
using (
  parent_user_id = (select auth.uid())
  or student_user_id = (select auth.uid())
  or (
    institution_id is not null
    and (select private.is_institution_owner(parent_student_links.institution_id, (select auth.uid())))
  )
);

drop policy if exists "staff approve child links" on public.parent_student_links;
drop policy if exists "school admin approves child links" on public.parent_student_links;
create policy "school admin approves child links"
on public.parent_student_links
for update
to authenticated
using (
  institution_id is not null
  and (select private.is_institution_owner(parent_student_links.institution_id, (select auth.uid())))
)
with check (
  institution_id is not null
  and (select private.is_institution_owner(parent_student_links.institution_id, (select auth.uid())))
);


-- Prevent two students in the same school from sharing the same Student Code.
create unique index if not exists uq_core_students_institution_student_code_ci
on public.core_students (institution_id, upper(trim(student_code)))
where nullif(trim(student_code),'') is not null;
