-- EduNizam: Admin-only school creation + public school dropdown/search directory.

create or replace function private.list_school_directory_v1(p_limit integer default 100)
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  registration_number text,
  address text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    i.id,
    i.name,
    i.institution_type,
    nullif(btrim(coalesce(i.registration_number,'')),''),
    nullif(btrim(coalesce(s.address,'')),'')
  from public.institutions i
  left join public.institution_settings s on s.institution_id=i.id
  order by lower(i.name),i.created_at
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

revoke all on function private.list_school_directory_v1(integer) from public;
grant execute on function private.list_school_directory_v1(integer) to anon,authenticated,postgres,service_role;

create or replace function public.list_school_directory_v1(p_limit integer default 100)
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  registration_number text,
  address text
)
language sql
stable
security invoker
set search_path=''
as $$
  select * from private.list_school_directory_v1(p_limit);
$$;

revoke execute on function public.list_school_directory_v1(integer) from public;
grant execute on function public.list_school_directory_v1(integer) to anon,authenticated;

revoke all on table public.institutions from anon;
revoke insert,delete,truncate,references,trigger on table public.institutions from authenticated;
grant select,update on table public.institutions to authenticated;

create or replace function public.register_admin_school_v2(
  p_school_name text,
  p_registration_number text,
  p_full_name text,
  p_phone text
)
returns table(
  account_role text,
  institution_id uuid,
  institution_name text,
  school_code text,
  registration_number text
)
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  uid uuid := auth.uid();
  clean_school text := trim(coalesce(p_school_name,''));
  clean_reg text := nullif(trim(coalesce(p_registration_number,'')),'');
  clean_name text := trim(coalesce(p_full_name,''));
  clean_phone text := trim(coalesce(p_phone,''));
  generated_code text;
  inst public.institutions%rowtype;
  existing_role text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_school='' then raise exception 'School name is required'; end if;
  if clean_name='' then raise exception 'Full name is required'; end if;
  if clean_phone='' then raise exception 'Contact number is required'; end if;

  select up.account_role into existing_role
  from public.user_profiles up
  where up.user_id=uid;

  if existing_role is not null and existing_role<>'head_of_institute' then
    raise exception 'Only an Admin account can add a school';
  end if;

  if exists(
    select 1 from public.institution_members m
    where m.user_id=uid and m.role in ('teacher','parent','student')
  ) then
    raise exception 'This account is already linked as a school member and cannot create a school';
  end if;

  if exists(
    select 1 from public.school_access_requests r
    where r.requester_user_id=uid
      and r.requested_role in ('teacher','parent','student')
      and r.status in ('pending','approved')
  ) then
    raise exception 'This account already has a Teacher/Parent/Student school request and cannot create a school';
  end if;

  loop
    generated_code := 'EDU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(
      select 1 from public.institutions i
      where upper(trim(coalesce(i.school_registration_code,'')))=generated_code
    );
  end loop;

  insert into public.institutions(
    owner_user_id,name,institution_type,admission_session,application_prefix,currency,
    school_registration_code,registration_number
  ) values(
    uid,clean_school,'school',extract(year from current_date)::text,'ADM','PKR',
    generated_code,clean_reg
  ) returning * into inst;

  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(uid,'head_of_institute',clean_name,clean_phone,inst.id)
  on conflict(user_id) do update
  set account_role='head_of_institute',
      full_name=excluded.full_name,
      phone=excluded.phone,
      institution_id=excluded.institution_id,
      updated_at=now();

  insert into public.institution_settings(
    institution_id,school_name,school_type,academic_session,phone,updated_by
  ) values(
    inst.id,inst.name,'school',extract(year from current_date)::text,clean_phone,uid
  )
  on conflict on constraint institution_settings_pkey do update
  set school_name=excluded.school_name,
      phone=excluded.phone,
      updated_by=excluded.updated_by,
      updated_at=now();

  return query
  select 'head_of_institute'::text,inst.id,inst.name,inst.school_registration_code,inst.registration_number;
end;
$$;

revoke execute on function public.register_admin_school_v2(text,text,text,text) from public,anon;
grant execute on function public.register_admin_school_v2(text,text,text,text) to authenticated;
