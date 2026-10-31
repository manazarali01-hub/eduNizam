-- EduNizam: connect all non-admin logins to the owning school/admin
-- Parent + Student become institution members without receiving staff privileges.
-- Teacher membership remains Admin-approval only.

begin;

alter table public.institution_members
  drop constraint if exists institution_members_role_check;

alter table public.institution_members
  add constraint institution_members_role_check
  check (role in ('teacher','parent','student'));

create index if not exists institution_members_user_role_idx
  on public.institution_members(user_id,role,institution_id);

create or replace function public.sync_family_student_membership_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE'
     and old.institution_id is not null
     and old.account_role in ('parent','student')
     and (
       old.institution_id is distinct from new.institution_id
       or old.account_role is distinct from new.account_role
     )
  then
    delete from public.institution_members
    where institution_id=old.institution_id
      and user_id=old.user_id
      and role in ('parent','student');
  end if;

  if new.institution_id is not null
     and new.account_role in ('parent','student')
  then
    insert into public.institution_members(institution_id,user_id,role)
    values(new.institution_id,new.user_id,new.account_role)
    on conflict (institution_id,user_id) do update
      set role=excluded.role;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_family_student_membership_v1 on public.user_profiles;
create trigger sync_family_student_membership_v1
after insert or update of institution_id,account_role
on public.user_profiles
for each row
execute function public.sync_family_student_membership_v1();

revoke all on function public.sync_family_student_membership_v1() from public;
revoke all on function public.sync_family_student_membership_v1() from anon;
revoke all on function public.sync_family_student_membership_v1() from authenticated;

insert into public.institution_members(institution_id,user_id,role)
select p.institution_id,p.user_id,p.account_role
from public.user_profiles p
where p.institution_id is not null
  and p.account_role in ('parent','student')
on conflict (institution_id,user_id) do update
  set role=excluded.role;

drop policy if exists "owners read institutions" on public.institutions;
create policy "owners read institutions"
on public.institutions
for select to authenticated
using (
  owner_user_id=(select auth.uid())
  or public.is_institution_staff(id)
  or exists (
    select 1
    from public.institution_members m
    where m.institution_id=institutions.id
      and m.user_id=(select auth.uid())
  )
  or exists (
    select 1
    from public.user_profiles p
    where p.user_id=(select auth.uid())
      and p.institution_id=institutions.id
  )
);

drop policy if exists "users update own basic profile" on public.user_profiles;

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
set search_path=public
as $$
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

  if clean_role='admin' then
    if clean_school='' then raise exception 'School name is required'; end if;
    if clean_code='' then raise exception 'School code is required'; end if;

    select * into inst
    from public.institutions
    where owner_user_id=uid
      and upper(trim(coalesce(school_registration_code,'')))=clean_code
    limit 1;

    if inst.id is null then
      if exists(
        select 1 from public.institutions
        where upper(trim(coalesce(school_registration_code,'')))=clean_code
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
  from public.institutions
  where upper(trim(coalesce(school_registration_code,'')))=clean_code
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

  return query select clean_role,inst.id,inst.name;
end;
$$;

grant execute on function public.register_simple_account_v1(text,text,text,text,text) to authenticated;

commit;
