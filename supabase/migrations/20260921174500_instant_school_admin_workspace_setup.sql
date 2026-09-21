-- Create an authenticated Head-of-Institute workspace immediately after Admin setup.
-- This removes the old dead-end where the UI saved a pending request but could not continue.

create or replace function public.complete_school_admin_setup_v1(
  p_school_name text,
  p_school_registration_code text,
  p_school_sector text,
  p_school_type text,
  p_admin_name text,
  p_phone text
)
returns table(
  institution_id uuid,
  institution_name text,
  account_role text
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  uid uuid := auth.uid();
  clean_name text := trim(coalesce(p_school_name,''));
  clean_code text := upper(trim(coalesce(p_school_registration_code,'')));
  clean_sector text := lower(trim(coalesce(p_school_sector,'')));
  clean_type text := lower(trim(coalesce(p_school_type,'school')));
  clean_admin text := trim(coalesce(p_admin_name,''));
  clean_phone text := trim(coalesce(p_phone,''));
  inst public.institutions%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_name='' then raise exception 'Institution name is required'; end if;
  if clean_code='' then raise exception 'Registration / EMIS code is required'; end if;
  if clean_sector not in ('government','private') then raise exception 'Choose Government or Private'; end if;
  if clean_type not in ('school','college','academy','university') then raise exception 'Invalid institution type'; end if;
  if clean_admin='' then raise exception 'Admin name is required'; end if;
  if clean_phone='' then raise exception 'Mobile number is required'; end if;

  select * into inst
  from public.institutions i
  where i.owner_user_id=uid
  order by i.created_at
  limit 1;

  if inst.id is null then
    if exists(
      select 1 from public.institutions i
      where upper(trim(coalesce(i.school_registration_code,'')))=clean_code
        and i.owner_user_id<>uid
    ) then
      raise exception 'This Registration / EMIS code is already in use';
    end if;

    insert into public.institutions(
      owner_user_id,name,institution_type,admission_session,
      application_prefix,currency,school_registration_code
    )
    values(
      uid,clean_name,clean_type,extract(year from current_date)::text,
      'ADM','PKR',clean_code
    )
    returning * into inst;
  else
    update public.institutions
    set name=clean_name,
        institution_type=clean_type,
        school_registration_code=coalesce(nullif(school_registration_code,''),clean_code),
        updated_at=now()
    where id=inst.id
    returning * into inst;
  end if;

  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(uid,'head_of_institute',clean_admin,clean_phone,inst.id)
  on conflict (user_id) do update
    set account_role='head_of_institute',
        full_name=excluded.full_name,
        phone=excluded.phone,
        institution_id=excluded.institution_id,
        updated_at=now();

  insert into public.institution_settings(
    institution_id,school_name,school_type,academic_session,phone,updated_by
  )
  values(
    inst.id,clean_name,clean_type,extract(year from current_date)::text,clean_phone,uid
  )
  on conflict on constraint institution_settings_pkey do update
    set school_name=excluded.school_name,
        school_type=excluded.school_type,
        phone=excluded.phone,
        updated_by=excluded.updated_by,
        updated_at=now();

  return query
  select inst.id,inst.name,'head_of_institute'::text;
end;
$function$;

revoke execute on function public.complete_school_admin_setup_v1(text,text,text,text,text,text)
  from public, anon;
grant execute on function public.complete_school_admin_setup_v1(text,text,text,text,text,text)
  to authenticated, service_role;
