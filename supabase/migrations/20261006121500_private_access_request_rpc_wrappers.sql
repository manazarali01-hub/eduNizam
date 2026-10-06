-- Harden invite and teacher-access RPCs without changing their public signatures.
-- Public API functions become SECURITY INVOKER wrappers over private SECURITY DEFINER
-- implementations with an empty search_path. Auth/ownership checks remain unchanged.
-- Applied to production on 2026-10-06 after rollback validation; Supabase security-definer
-- advisor findings reduced from 12 to 9.

create or replace function private.claim_institution_invite_v2(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql security definer set search_path=''
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

create or replace function private.request_teacher_access_v2(
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
language plpgsql security definer set search_path=''
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

  select ii.* into inv
  from public.institution_invites ii
  where upper(ii.code)=upper(trim(p_invite_code))
    and ii.target_role='teacher'
    and ii.active=true
    and (ii.expires_at is null or ii.expires_at > now())
    and ii.use_count < ii.max_uses
  for update;

  if inv.id is null then
    raise exception 'Teacher invite code is invalid, expired, or already used';
  end if;

  select s.* into staff
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
  on conflict on constraint teacher_access_requests_institution_id_requester_user_id_key
  do update set
    staff_profile_id=excluded.staff_profile_id,
    staff_code=excluded.staff_code,
    status='pending',
    reviewed_by=null,
    review_note=null,
    updated_at=now()
  returning * into req;

  update public.institution_invites ii
  set use_count=ii.use_count+1,
      active=case when ii.use_count+1 >= ii.max_uses then false else ii.active end
  where ii.id=inv.id;

  select i.name into inst_name
  from public.institutions i
  where i.id=inv.institution_id;

  return query
  select req.id,inv.institution_id,inst_name,staff.full_name,req.status;
end;
$$;

create or replace function private.decide_teacher_access_v2(
  p_request_id uuid,
  p_approve boolean,
  p_note text
)
returns table(
  request_id uuid,
  request_status text,
  requester_user_id uuid,
  staff_profile_id uuid
)
language plpgsql security definer set search_path=''
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

revoke all on function private.claim_institution_invite_v2(text) from public,anon;
revoke all on function private.request_teacher_access_v2(text,text) from public,anon;
revoke all on function private.decide_teacher_access_v2(uuid,boolean,text) from public,anon;

grant execute on function private.claim_institution_invite_v2(text) to authenticated;
grant execute on function private.request_teacher_access_v2(text,text) to authenticated;
grant execute on function private.decide_teacher_access_v2(uuid,boolean,text) to authenticated;

create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language sql security invoker set search_path=''
as $$
  select * from private.claim_institution_invite_v2(p_code);
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
language sql security invoker set search_path=''
as $$
  select * from private.request_teacher_access_v2(p_invite_code,p_staff_code);
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
language sql security invoker set search_path=''
as $$
  select * from private.decide_teacher_access_v2(p_request_id,p_approve,p_note);
$$;

revoke all on function public.claim_institution_invite(text) from public,anon;
revoke all on function public.request_teacher_access(text,text) from public,anon;
revoke all on function public.decide_teacher_access(uuid,boolean,text) from public,anon;

grant execute on function public.claim_institution_invite(text) to authenticated;
grant execute on function public.request_teacher_access(text,text) to authenticated;
grant execute on function public.decide_teacher_access(uuid,boolean,text) to authenticated;
