-- EduNizam verified School Admin onboarding
-- A school's public/known registration or EMIS code is an identifier, not a secret.
-- Admin authority is granted only after EduNizam platform-owner approval.

begin;

alter table public.institutions
  add column if not exists school_registration_code text;

create unique index if not exists institutions_school_registration_code_uq
on public.institutions (upper(trim(school_registration_code)))
where school_registration_code is not null and trim(school_registration_code) <> '';

create table if not exists public.school_admin_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  school_name text not null,
  school_registration_code text not null,
  school_type text not null default 'school'
    check (school_type in ('school','college','academy','university')),
  admin_name text not null,
  designation text not null,
  phone text not null,
  email text not null,
  proof_reference text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  institution_id uuid references public.institutions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_admin_requests_status_created_idx
on public.school_admin_requests(status,created_at desc);

create unique index if not exists school_admin_requests_one_open_per_user_uq
on public.school_admin_requests(requester_user_id)
where status='pending';

alter table public.school_admin_requests enable row level security;

drop policy if exists "requester reads own school admin request" on public.school_admin_requests;
create policy "requester reads own school admin request"
on public.school_admin_requests
for select to authenticated
using (requester_user_id=auth.uid());

drop policy if exists "platform admins read school admin requests" on public.school_admin_requests;
create policy "platform admins read school admin requests"
on public.school_admin_requests
for select to authenticated
using (public.is_platform_admin());

create or replace function public.submit_school_admin_request(
  p_school_name text,
  p_school_registration_code text,
  p_school_type text,
  p_admin_name text,
  p_designation text,
  p_phone text,
  p_proof_reference text default null
)
returns table(
  request_id uuid,
  request_status text,
  email text,
  school_name text,
  school_registration_code text
)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  uid uuid:=auth.uid();
  auth_email text;
  clean_code text:=upper(trim(coalesce(p_school_registration_code,'')));
  req public.school_admin_requests%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select u.email into auth_email from auth.users u where u.id=uid;
  if auth_email is null or auth_email='' then
    raise exception 'Verified email account required';
  end if;

  if trim(coalesce(p_school_name,''))='' then raise exception 'School name required'; end if;
  if clean_code='' then raise exception 'School registration / EMIS code required'; end if;
  if trim(coalesce(p_admin_name,''))='' then raise exception 'Admin name required'; end if;
  if trim(coalesce(p_designation,''))='' then raise exception 'Designation required'; end if;
  if trim(coalesce(p_phone,''))='' then raise exception 'Mobile number required'; end if;
  if coalesce(p_school_type,'school') not in ('school','college','academy','university') then
    raise exception 'Invalid institution type';
  end if;

  if exists(
    select 1 from public.institutions i
    where upper(trim(coalesce(i.school_registration_code,'')))=clean_code
  ) then
    raise exception 'This school is already registered in EduNizam';
  end if;

  if exists(
    select 1 from public.school_admin_requests r
    where upper(trim(r.school_registration_code))=clean_code
      and r.status='approved'
  ) then
    raise exception 'This school already has an approved administrator';
  end if;

  update public.school_admin_requests
  set status='rejected',
      review_note='Replaced by a newer request from the same account',
      updated_at=now()
  where requester_user_id=uid and status='pending';

  insert into public.school_admin_requests(
    requester_user_id,school_name,school_registration_code,school_type,
    admin_name,designation,phone,email,proof_reference,status,created_at,updated_at
  )
  values(
    uid,trim(p_school_name),clean_code,coalesce(p_school_type,'school'),
    trim(p_admin_name),trim(p_designation),trim(p_phone),auth_email,
    nullif(trim(coalesce(p_proof_reference,'')),''),
    'pending',now(),now()
  )
  returning * into req;

  return query select req.id,req.status,req.email,req.school_name,req.school_registration_code;
end;
$$;

create or replace function public.my_school_admin_request()
returns table(
  request_id uuid,
  school_name text,
  school_registration_code text,
  admin_name text,
  designation text,
  phone text,
  email text,
  proof_reference text,
  request_status text,
  review_note text,
  institution_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select
    r.id,r.school_name,r.school_registration_code,r.admin_name,r.designation,
    r.phone,r.email,r.proof_reference,r.status,r.review_note,r.institution_id,
    r.created_at,r.updated_at
  from public.school_admin_requests r
  where r.requester_user_id=auth.uid()
  order by r.created_at desc
  limit 1;
$$;

create or replace function public.platform_school_admin_requests()
returns table(
  request_id uuid,
  requester_user_id uuid,
  school_name text,
  school_registration_code text,
  school_type text,
  admin_name text,
  designation text,
  phone text,
  email text,
  proof_reference text,
  request_status text,
  review_note text,
  institution_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform owner access required';
  end if;

  return query
  select
    r.id,r.requester_user_id,r.school_name,r.school_registration_code,r.school_type,
    r.admin_name,r.designation,r.phone,r.email,r.proof_reference,r.status,
    r.review_note,r.institution_id,r.created_at
  from public.school_admin_requests r
  order by case when r.status='pending' then 0 else 1 end,r.created_at desc;
end;
$$;

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
  if not public.is_platform_admin() then
    raise exception 'Platform owner access required';
  end if;

  select * into req
  from public.school_admin_requests
  where id=p_request_id
  for update;

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

  if exists(
    select 1 from public.institutions i
    where upper(trim(coalesce(i.school_registration_code,'')))=
          upper(trim(req.school_registration_code))
  ) then
    raise exception 'This school code is already registered';
  end if;

  if exists(
    select 1 from public.institutions i
    where i.owner_user_id=req.requester_user_id
  ) then
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
    set account_role='head_of_institute',
        full_name=excluded.full_name,
        phone=excluded.phone,
        institution_id=excluded.institution_id,
        updated_at=now();

  insert into public.institution_settings(
    institution_id,school_name,school_type,academic_session,phone,updated_by
  )
  values(
    inst.id,req.school_name,req.school_type,
    extract(year from current_date)::text,req.phone,req.requester_user_id
  )
  on conflict (institution_id) do update
    set school_name=excluded.school_name,
        school_type=excluded.school_type,
        phone=excluded.phone,
        updated_by=excluded.updated_by,
        updated_at=now();

  update public.school_admin_requests
  set status='approved',reviewed_by=auth.uid(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      institution_id=inst.id,updated_at=now()
  where id=req.id
  returning * into req;

  return query select req.id,req.status,inst.id,req.school_name;
end;
$$;

grant execute on function public.submit_school_admin_request(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.my_school_admin_request() to authenticated;
grant execute on function public.platform_school_admin_requests() to authenticated;
grant execute on function public.decide_school_admin_request(uuid,boolean,text) to authenticated;

commit;
