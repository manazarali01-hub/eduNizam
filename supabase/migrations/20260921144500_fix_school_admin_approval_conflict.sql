-- Fix School Admin approval ambiguity in institution_settings UPSERT.
-- The function's RETURNS TABLE includes an output variable named institution_id;
-- use the explicit PK constraint in ON CONFLICT to avoid PL/pgSQL name ambiguity.

begin;

create or replace function public.decide_school_admin_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns table(
  request_id uuid,
  request_status text,
  institution_id uuid,
  school_name text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  req public.school_admin_requests%rowtype;
  inst public.institutions%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Platform owner access required'; end if;

  select * into req from public.school_admin_requests where id=p_request_id for update;
  if req.id is null then raise exception 'Admin request not found'; end if;
  if req.status<>'pending' then raise exception 'This request has already been reviewed'; end if;

  if not p_approve then
    update public.school_admin_requests
    set status='rejected',reviewed_by=auth.uid(),
        review_note=nullif(trim(coalesce(p_note,'')),''),
        updated_at=now()
    where id=req.id
    returning * into req;
    return query select req.id,req.status,req.institution_id,req.school_name;
    return;
  end if;

  if coalesce(req.code_verified,false)<>true then
    raise exception 'School Registration Number / EMIS Code must be verified from an official record before approval';
  end if;
  if req.school_sector is null or req.code_type is null then
    raise exception 'School sector and identifier type are required before approval';
  end if;

  if exists(
    select 1 from public.institutions i
    where upper(trim(coalesce(i.school_registration_code,'')))=upper(trim(req.school_registration_code))
  ) then raise exception 'This school code is already registered'; end if;

  if exists(select 1 from public.institutions i where i.owner_user_id=req.requester_user_id) then
    raise exception 'This account already owns an EduNizam institute';
  end if;

  insert into public.institutions(
    owner_user_id,name,institution_type,admission_session,
    application_prefix,currency,school_registration_code
  )
  values(
    req.requester_user_id,req.school_name,req.school_type,
    extract(year from current_date)::text,'ADM','PKR',
    upper(trim(req.school_registration_code))
  )
  returning * into inst;

  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(req.requester_user_id,'head_of_institute',req.admin_name,req.phone,inst.id)
  on conflict (user_id) do update
    set account_role='head_of_institute',full_name=excluded.full_name,
        phone=excluded.phone,institution_id=excluded.institution_id,updated_at=now();

  insert into public.institution_settings(
    institution_id,school_name,school_type,academic_session,phone,updated_by
  )
  values(
    inst.id,req.school_name,req.school_type,
    extract(year from current_date)::text,req.phone,req.requester_user_id
  )
  on conflict on constraint institution_settings_pkey do update
    set school_name=excluded.school_name,school_type=excluded.school_type,
        phone=excluded.phone,updated_by=excluded.updated_by,updated_at=now();

  update public.school_admin_requests
  set status='approved',reviewed_by=auth.uid(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      institution_id=inst.id,updated_at=now()
  where id=req.id
  returning * into req;

  return query select req.id,req.status,inst.id,req.school_name;
end;
$$;

grant execute on function public.decide_school_admin_request(uuid,boolean,text) to authenticated;

commit;
