-- Fresh EduNizam authentication contract after login reset.
-- Four roles: Admin, Teacher, Parent, Student.
-- Admin creates the school; other roles link to an existing school code.
-- Authorization remains enforced by existing RLS and staff/student linking rules.

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
set search_path=public,auth
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

  if clean_role='admin' then
    if clean_school='' then raise exception 'School name is required'; end if;
    if clean_code='' then raise exception 'School code is required'; end if;

    select * into inst
    from public.institutions
    where owner_user_id=uid
    limit 1;

    if inst.id is null then
      if exists(
        select 1
        from public.institutions
        where upper(trim(coalesce(school_registration_code,'')))=clean_code
      ) then
        raise exception 'This school code is already registered';
      end if;

      insert into public.institutions(
        owner_user_id,name,institution_type,admission_session,
        application_prefix,currency,school_registration_code
      )
      values(
        uid,clean_school,'school',extract(year from current_date)::text,
        'ADM','PKR',clean_code
      )
      returning * into inst;
    end if;

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
    )
    values(
      inst.id,inst.name,'school',extract(year from current_date)::text,clean_phone,uid
    )
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
$function$;

revoke execute on function public.register_simple_account_v1(text,text,text,text,text)
  from public,anon;
grant execute on function public.register_simple_account_v1(text,text,text,text,text)
  to authenticated,service_role;

create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path=public
as $function$
  select coalesce(
    (select 'head_of_institute' from public.institutions i where i.owner_user_id=auth.uid() limit 1),
    (select p.account_role from public.user_profiles p where p.user_id=auth.uid() limit 1),
    'student'
  );
$function$;

revoke execute on function public.current_account_role() from public,anon;
grant execute on function public.current_account_role() to authenticated,service_role;
