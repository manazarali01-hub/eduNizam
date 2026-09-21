-- EduNizam school-admin lock + teacher verification workflow
-- Purpose:
-- 1) Only the institution owner account is the School Admin.
-- 2) A teacher never receives staff privileges until the School Admin approves
--    a request that matches an active Staff Directory record.
-- 3) Client-side users cannot create a new institution and make themselves admin.
--
-- Safe to run after the current EduNizam production migration.

begin;

-- ---------------------------------------------------------
-- School Admin is ONLY institutions.owner_user_id
-- ---------------------------------------------------------

drop policy if exists "authenticated create institutions" on public.institutions;

-- Remove the old secondary-head path. One school has one admin auth identity.
delete from public.institution_members
where role='head_of_institute';

alter table public.institution_members
  drop constraint if exists institution_members_role_check;
alter table public.institution_members
  add constraint institution_members_role_check
  check (role='teacher');

-- Old teacher profile rows without a real membership must not grant teacher access.
update public.user_profiles p
set account_role='student',
    institution_id=null,
    updated_at=now()
where p.account_role='teacher'
  and not exists (
    select 1
    from public.institution_members m
    where m.user_id=p.user_id
      and m.role='teacher'
      and (p.institution_id is null or m.institution_id=p.institution_id)
  );

create or replace function public.is_institution_staff(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.institutions i
    where i.id=p_institution_id
      and i.owner_user_id=auth.uid()
  )
  or exists(
    select 1
    from public.institution_members m
    where m.institution_id=p_institution_id
      and m.user_id=auth.uid()
      and m.role='teacher'
  );
$$;

create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    (
      select 'head_of_institute'
      from public.institutions i
      where i.owner_user_id=auth.uid()
      limit 1
    ),
    (
      select 'teacher'
      from public.institution_members m
      where m.user_id=auth.uid()
        and m.role='teacher'
      limit 1
    ),
    (
      select case
        when p.account_role in ('student','parent') then p.account_role
        else 'student'
      end
      from public.user_profiles p
      where p.user_id=auth.uid()
      limit 1
    ),
    'student'
  );
$$;

-- Only the School Admin can create/manage institute invite codes.
drop policy if exists "staff manage institution invites" on public.institution_invites;
create policy "school admin manage institution invites"
on public.institution_invites
for all to authenticated
using (
  exists(
    select 1
    from public.institutions i
    where i.id=institution_invites.institution_id
      and i.owner_user_id=auth.uid()
  )
)
with check (
  created_by=auth.uid()
  and exists(
    select 1
    from public.institutions i
    where i.id=institution_invites.institution_id
      and i.owner_user_id=auth.uid()
  )
);

-- ---------------------------------------------------------
-- Teacher verification requests
-- ---------------------------------------------------------

create table if not exists public.teacher_access_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  staff_code text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id,requester_user_id)
);

create index if not exists teacher_access_requests_institution_status_idx
on public.teacher_access_requests(institution_id,status,created_at desc);

alter table public.teacher_access_requests enable row level security;

drop policy if exists "teacher requester reads own request" on public.teacher_access_requests;
create policy "teacher requester reads own request"
on public.teacher_access_requests
for select to authenticated
using (requester_user_id=auth.uid());

drop policy if exists "school admin reads teacher requests" on public.teacher_access_requests;
create policy "school admin reads teacher requests"
on public.teacher_access_requests
for select to authenticated
using (
  exists(
    select 1
    from public.institutions i
    where i.id=teacher_access_requests.institution_id
      and i.owner_user_id=auth.uid()
  )
);

-- Teacher invite codes no longer grant teacher membership directly.
create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.institution_invites%rowtype;
  inst_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into inv
  from public.institution_invites
  where upper(code)=upper(trim(p_code))
    and active=true
    and (expires_at is null or expires_at > now())
    and use_count < max_uses
  for update;

  if inv.id is null then
    raise exception 'Invite code is invalid, expired, or already used';
  end if;

  if inv.target_role='teacher' then
    raise exception 'Teacher access requires Staff Code verification and School Admin approval';
  end if;

  select name into inst_name
  from public.institutions
  where id=inv.institution_id;

  insert into public.user_profiles(user_id,account_role,institution_id)
  values(auth.uid(),inv.target_role,inv.institution_id)
  on conflict (user_id) do update
    set account_role=excluded.account_role,
        institution_id=excluded.institution_id,
        updated_at=now();

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  return query
  select inv.institution_id,inst_name,inv.target_role;
end;
$$;

create or replace function public.request_teacher_access(
  p_invite_code text,
  p_staff_code text
)
returns table(
  request_id uuid,
  institution_id uuid,
  institution_name text,
  staff_name text,
  request_status text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.institution_invites%rowtype;
  staff public.staff_profiles%rowtype;
  req public.teacher_access_requests%rowtype;
  inst_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into inv
  from public.institution_invites
  where upper(code)=upper(trim(p_invite_code))
    and target_role='teacher'
    and active=true
    and (expires_at is null or expires_at > now())
    and use_count < max_uses
  for update;

  if inv.id is null then
    raise exception 'Teacher invite code is invalid, expired, or already used';
  end if;

  select * into staff
  from public.staff_profiles s
  where s.institution_id=inv.institution_id
    and upper(s.staff_code)=upper(trim(p_staff_code))
    and s.employment_status='active'
  limit 1
  for update;

  if staff.id is null then
    raise exception 'Active staff record not found for this Staff Code';
  end if;

  if staff.user_id is not null and staff.user_id <> auth.uid() then
    raise exception 'This staff record is already linked to another account';
  end if;

  insert into public.teacher_access_requests(
    institution_id,requester_user_id,staff_profile_id,staff_code,status,
    reviewed_by,review_note,created_at,updated_at
  )
  values(
    inv.institution_id,auth.uid(),staff.id,staff.staff_code,'pending',
    null,null,now(),now()
  )
  on conflict (institution_id,requester_user_id) do update
    set staff_profile_id=excluded.staff_profile_id,
        staff_code=excluded.staff_code,
        status='pending',
        reviewed_by=null,
        review_note=null,
        updated_at=now()
  returning * into req;

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  select name into inst_name
  from public.institutions
  where id=inv.institution_id;

  return query
  select req.id,inv.institution_id,inst_name,staff.full_name,req.status;
end;
$$;

create or replace function public.list_teacher_access_requests(p_institution_id uuid)
returns table(
  request_id uuid,
  requester_user_id uuid,
  requester_label text,
  staff_profile_id uuid,
  staff_code text,
  staff_name text,
  designation text,
  employment_status text,
  request_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=p_institution_id
      and i.owner_user_id=auth.uid()
  ) then
    raise exception 'School Admin access required';
  end if;

  return query
  select
    r.id,
    r.requester_user_id,
    coalesce(
      nullif(p.full_name,''),
      nullif(u.raw_user_meta_data->>'full_name',''),
      u.email,
      r.requester_user_id::text
    ) as requester_label,
    s.id,
    s.staff_code,
    s.full_name,
    s.designation,
    s.employment_status,
    r.status,
    r.created_at,
    case when r.reviewed_by is null then null else r.updated_at end,
    r.review_note
  from public.teacher_access_requests r
  join public.staff_profiles s on s.id=r.staff_profile_id
  left join public.user_profiles p on p.user_id=r.requester_user_id
  left join auth.users u on u.id=r.requester_user_id
  where r.institution_id=p_institution_id
  order by
    case when r.status='pending' then 0 else 1 end,
    r.created_at desc;
end;
$$;

create or replace function public.decide_teacher_access(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns table(
  request_id uuid,
  request_status text,
  requester_user_id uuid,
  staff_profile_id uuid
)
language plpgsql
security definer
set search_path=public
as $$
declare
  req public.teacher_access_requests%rowtype;
  staff public.staff_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into req
  from public.teacher_access_requests
  where id=p_request_id
  for update;

  if req.id is null then
    raise exception 'Teacher access request not found';
  end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=req.institution_id
      and i.owner_user_id=auth.uid()
  ) then
    raise exception 'Only the School Admin can approve teacher access';
  end if;

  if not p_approve then
    update public.teacher_access_requests
    set status='rejected',
        reviewed_by=auth.uid(),
        review_note=nullif(trim(coalesce(p_note,'')),''),
        updated_at=now()
    where id=req.id
    returning * into req;

    return query
    select req.id,req.status,req.requester_user_id,req.staff_profile_id;
    return;
  end if;

  select * into staff
  from public.staff_profiles s
  where s.id=req.staff_profile_id
    and s.institution_id=req.institution_id
    and s.employment_status='active'
  for update;

  if staff.id is null then
    raise exception 'Active staff profile no longer exists';
  end if;

  if staff.user_id is not null and staff.user_id <> req.requester_user_id then
    raise exception 'Staff profile is already linked to another user';
  end if;

  insert into public.institution_members(institution_id,user_id,role)
  values(req.institution_id,req.requester_user_id,'teacher')
  on conflict (institution_id,user_id) do update
    set role='teacher';

  insert into public.user_profiles(user_id,account_role,full_name,institution_id)
  values(req.requester_user_id,'teacher',staff.full_name,req.institution_id)
  on conflict (user_id) do update
    set account_role='teacher',
        full_name=coalesce(nullif(public.user_profiles.full_name,''),excluded.full_name),
        institution_id=excluded.institution_id,
        updated_at=now();

  update public.staff_profiles
  set user_id=req.requester_user_id,
      updated_at=now()
  where id=staff.id;

  update public.teacher_access_requests
  set status='approved',
      reviewed_by=auth.uid(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      updated_at=now()
  where id=req.id
  returning * into req;

  return query
  select req.id,req.status,req.requester_user_id,req.staff_profile_id;
end;
$$;

grant execute on function public.request_teacher_access(text,text) to authenticated;
grant execute on function public.list_teacher_access_requests(uuid) to authenticated;
grant execute on function public.decide_teacher_access(uuid,boolean,text) to authenticated;
grant execute on function public.claim_institution_invite(text) to authenticated;

commit;
