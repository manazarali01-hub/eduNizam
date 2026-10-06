-- Harden self-service staff/student profile and photo RPCs.
-- Public RPC signatures remain unchanged as SECURITY INVOKER wrappers.
-- Privileged writes live in private SECURITY DEFINER implementations with explicit auth/membership checks.
-- Photo mutations now require a current matching teacher/student membership in addition to row ownership.
-- Applied to production on 2026-10-06 after rollback-only regression and data-consistency checks.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 30 to 26.

create or replace function private.update_my_staff_profile_v2(
  p_institution_id uuid,
  p_email text,
  p_address text,
  p_city text,
  p_emergency_contact text
)
returns public.staff_profiles
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  r public.staff_profiles%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if not exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=uid
      and m.role='teacher'
  ) then
    raise exception 'Teacher membership required';
  end if;

  update public.staff_profiles s
     set profile_details=coalesce(s.profile_details,'{}'::jsonb) || jsonb_build_object(
           'email',nullif(btrim(coalesce(p_email,'')),''),
           'address',nullif(btrim(coalesce(p_address,'')),''),
           'city',nullif(btrim(coalesce(p_city,'')),''),
           'emergency_contact',nullif(btrim(coalesce(p_emergency_contact,'')),'')
         ),
         updated_at=now()
   where s.institution_id=p_institution_id
     and s.user_id=uid
   returning * into r;

  if r.id is null then raise exception 'Linked staff profile not found'; end if;
  return r;
end;
$$;

create or replace function private.set_my_staff_photo_v2(
  p_institution_id uuid,
  p_storage_path text
)
returns public.staff_profiles
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  r public.staff_profiles%rowtype;
  prefix text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if not exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=uid
      and m.role='teacher'
  ) then
    raise exception 'Teacher membership required';
  end if;

  select * into r
  from public.staff_profiles s
  where s.institution_id=p_institution_id
    and s.user_id=uid;

  if r.id is null then raise exception 'Linked staff profile not found'; end if;

  prefix:=p_institution_id::text||'/staff/'||r.id::text||'/';
  if left(coalesce(p_storage_path,''),length(prefix))<>prefix then
    raise exception 'Invalid staff photo path';
  end if;

  update public.staff_profiles
  set photo_path=p_storage_path,updated_at=now()
  where id=r.id
  returning * into r;

  return r;
end;
$$;

create or replace function private.update_my_student_profile_v2(
  p_institution_id uuid,
  p_email text,
  p_address text,
  p_city text,
  p_district text,
  p_province text,
  p_blood_group text,
  p_emergency_contact text,
  p_health_notes text,
  p_special_needs_notes text
)
returns public.core_students
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  r public.core_students%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if not exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=uid
      and m.role='student'
  ) then
    raise exception 'Student membership required';
  end if;

  update public.core_students s
     set address=nullif(btrim(coalesce(p_address,'')),''),
         profile_details=coalesce(s.profile_details,'{}'::jsonb) || jsonb_build_object(
           'email',nullif(btrim(coalesce(p_email,'')),''),
           'city',nullif(btrim(coalesce(p_city,'')),''),
           'district',nullif(btrim(coalesce(p_district,'')),''),
           'province',nullif(btrim(coalesce(p_province,'')),''),
           'blood_group',nullif(btrim(coalesce(p_blood_group,'')),''),
           'emergency_contact',nullif(btrim(coalesce(p_emergency_contact,'')),''),
           'health_notes',nullif(btrim(coalesce(p_health_notes,'')),''),
           'special_needs_notes',nullif(btrim(coalesce(p_special_needs_notes,'')),'')
         ),
         updated_at=now()
   where s.institution_id=p_institution_id
     and s.auth_user_id=uid
   returning * into r;

  if r.id is null then raise exception 'Linked student record not found'; end if;
  return r;
end;
$$;

create or replace function private.set_my_student_photo_v2(
  p_institution_id uuid,
  p_storage_path text
)
returns public.core_students
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  r public.core_students%rowtype;
  prefix text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if not exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=uid
      and m.role='student'
  ) then
    raise exception 'Student membership required';
  end if;

  select * into r
  from public.core_students s
  where s.institution_id=p_institution_id
    and s.auth_user_id=uid;

  if r.id is null then raise exception 'Linked student record not found'; end if;

  prefix:=p_institution_id::text||'/student/'||r.id::text||'/';
  if left(coalesce(p_storage_path,''),length(prefix))<>prefix then
    raise exception 'Invalid student photo path';
  end if;

  update public.core_students
  set photo_path=p_storage_path,updated_at=now()
  where id=r.id
  returning * into r;

  return r;
end;
$$;

revoke all on function private.update_my_staff_profile_v2(uuid,text,text,text,text) from public,anon;
revoke all on function private.set_my_staff_photo_v2(uuid,text) from public,anon;
revoke all on function private.update_my_student_profile_v2(uuid,text,text,text,text,text,text,text,text,text) from public,anon;
revoke all on function private.set_my_student_photo_v2(uuid,text) from public,anon;

grant execute on function private.update_my_staff_profile_v2(uuid,text,text,text,text) to authenticated;
grant execute on function private.set_my_staff_photo_v2(uuid,text) to authenticated;
grant execute on function private.update_my_student_profile_v2(uuid,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function private.set_my_student_photo_v2(uuid,text) to authenticated;

create or replace function public.update_my_staff_profile_v1(
  p_institution_id uuid,
  p_email text,
  p_address text,
  p_city text,
  p_emergency_contact text
)
returns public.staff_profiles
language sql security invoker set search_path=''
as $$
  select private.update_my_staff_profile_v2(
    p_institution_id,p_email,p_address,p_city,p_emergency_contact
  );
$$;

create or replace function public.set_my_staff_photo_v1(
  p_institution_id uuid,
  p_storage_path text
)
returns public.staff_profiles
language sql security invoker set search_path=''
as $$
  select private.set_my_staff_photo_v2(p_institution_id,p_storage_path);
$$;

create or replace function public.update_my_student_profile_v1(
  p_institution_id uuid,
  p_email text,
  p_address text,
  p_city text,
  p_district text,
  p_province text,
  p_blood_group text,
  p_emergency_contact text,
  p_health_notes text,
  p_special_needs_notes text
)
returns public.core_students
language sql security invoker set search_path=''
as $$
  select private.update_my_student_profile_v2(
    p_institution_id,p_email,p_address,p_city,p_district,p_province,
    p_blood_group,p_emergency_contact,p_health_notes,p_special_needs_notes
  );
$$;

create or replace function public.set_my_student_photo_v1(
  p_institution_id uuid,
  p_storage_path text
)
returns public.core_students
language sql security invoker set search_path=''
as $$
  select private.set_my_student_photo_v2(p_institution_id,p_storage_path);
$$;

revoke all on function public.update_my_staff_profile_v1(uuid,text,text,text,text) from public,anon;
revoke all on function public.set_my_staff_photo_v1(uuid,text) from public,anon;
revoke all on function public.update_my_student_profile_v1(uuid,text,text,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.set_my_student_photo_v1(uuid,text) from public,anon;

grant execute on function public.update_my_staff_profile_v1(uuid,text,text,text,text) to authenticated;
grant execute on function public.set_my_staff_photo_v1(uuid,text) to authenticated;
grant execute on function public.update_my_student_profile_v1(uuid,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.set_my_student_photo_v1(uuid,text) to authenticated;
