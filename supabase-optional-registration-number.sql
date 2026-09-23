-- EduNizam: optional display-only registration number
-- Applied to Supabase project qmdiexentozvhhfjvlmr on 2026-09-23.
-- Registration number is informational only. Parent/Student linking uses an auto-generated School Login Code.

alter table public.institutions
  add column if not exists registration_number text;

update public.institutions
set registration_number = nullif(trim(school_registration_code),'')
where registration_number is null
  and nullif(trim(school_registration_code),'') is not null;

-- Existing projects may have used the entered registration/EMIS value as the
-- Parent/Student login code. Once the value is preserved in registration_number,
-- replace that login code with a generated EduNizam code so the two concepts stay separate.
do $
declare
  rec record;
  new_code text;
begin
  for rec in
    select id
    from public.institutions
    where registration_number is not null
      and nullif(trim(registration_number),'') is not null
      and school_registration_code = registration_number
      and school_registration_code not like 'EDU-%'
  loop
    loop
      new_code := 'EDU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      exit when not exists (
        select 1 from public.institutions i
        where upper(trim(coalesce(i.school_registration_code,''))) = new_code
      );
    end loop;

    update public.institutions
    set school_registration_code=new_code,
        updated_at=now()
    where id=rec.id;
  end loop;
end $;

create or replace function public.create_owned_institution_v2(
  p_school_name text,
  p_registration_number text default '',
  p_phone text default ''
)
returns table(
  id uuid,
  name text,
  institution_type text,
  school_registration_code text,
  registration_number text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  uid uuid := auth.uid();
  clean_school text := trim(coalesce(p_school_name,''));
  clean_reg text := nullif(trim(coalesce(p_registration_number,'')),'');
  clean_phone text := trim(coalesce(p_phone,''));
  generated_code text;
  inst public.institutions%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.user_profiles up
    where up.user_id=uid and up.account_role='head_of_institute'
  ) then
    raise exception 'Head of Institute access required';
  end if;
  if clean_school='' then raise exception 'School name is required'; end if;

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

  update public.user_profiles up
  set institution_id=inst.id, updated_at=now()
  where up.user_id=uid and up.account_role='head_of_institute';

  return query
  select inst.id,inst.name,inst.institution_type,inst.school_registration_code,inst.registration_number;
end;
$function$;

revoke execute on function public.create_owned_institution_v2(text,text,text) from public, anon;
grant execute on function public.create_owned_institution_v2(text,text,text) to authenticated;

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
set search_path = pg_catalog, public
as $function$
declare
  uid uuid := auth.uid();
  clean_school text := trim(coalesce(p_school_name,''));
  clean_reg text := nullif(trim(coalesce(p_registration_number,'')),'');
  clean_name text := trim(coalesce(p_full_name,''));
  clean_phone text := trim(coalesce(p_phone,''));
  generated_code text;
  inst public.institutions%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_school='' then raise exception 'School name is required'; end if;
  if clean_name='' then raise exception 'Full name is required'; end if;
  if clean_phone='' then raise exception 'Contact number is required'; end if;

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
$function$;

revoke execute on function public.register_admin_school_v2(text,text,text,text) from public, anon;
grant execute on function public.register_admin_school_v2(text,text,text,text) to authenticated;
