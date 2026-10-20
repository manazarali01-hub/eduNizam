-- Keep invite claims consistent with the platform's same-role multi-school policy.
-- Existing accounts may join another school only with their existing account role.
-- Preserve the profile's current institution as the default; add the invited school as a membership.
begin;

create or replace function private.claim_institution_invite_v2(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  inv public.institution_invites%rowtype;
  inst_name text;
  existing_role text;
  existing_institution_id uuid;
  has_profile boolean := false;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select i.* into inv
  from public.institution_invites i
  where upper(i.code)=upper(trim(p_code))
    and i.active=true
    and (i.expires_at is null or i.expires_at > now())
    and i.use_count < i.max_uses
  for update;

  if inv.id is null then
    raise exception 'Invite code is invalid, expired, or already used';
  end if;

  if inv.target_role='teacher' then
    raise exception 'Teacher access requires Staff Code verification and School Admin approval';
  end if;

  select p.account_role,p.institution_id
    into existing_role,existing_institution_id
  from public.user_profiles p
  where p.user_id=uid
  for update;
  has_profile := found;

  if has_profile and existing_role is distinct from inv.target_role then
    raise exception 'This account is already linked with a different school or role';
  end if;

  if exists (
    select 1
    from public.institution_members m
    where m.user_id=uid
      and m.role is distinct from inv.target_role
  ) then
    raise exception 'This account already has a different school membership';
  end if;

  select i.name into inst_name
  from public.institutions i
  where i.id=inv.institution_id;

  if not has_profile then
    insert into public.user_profiles(user_id,account_role,institution_id)
    values(uid,inv.target_role,inv.institution_id);
  elsif existing_institution_id is null then
    -- Fill a missing default only; do not replace a valid existing school.
    update public.user_profiles
    set institution_id=inv.institution_id,updated_at=now()
    where user_id=uid and institution_id is null;
  end if;

  -- Explicit membership supports same-role multi-school accounts without
  -- rewriting their canonical profile role/default institution.
  insert into public.institution_members(institution_id,user_id,role)
  values(inv.institution_id,uid,inv.target_role)
  on conflict (institution_id,user_id) do update
    set role=excluded.role;

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  return query select inv.institution_id,inst_name,inv.target_role;
end;
$function$;

create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language sql
set search_path = ''
as $function$
  select * from private.claim_institution_invite_v2(p_code);
$function$;

revoke all on function private.claim_institution_invite_v2(text) from public, anon;
grant execute on function private.claim_institution_invite_v2(text) to authenticated;

revoke all on function public.claim_institution_invite(text) from public, anon;
grant execute on function public.claim_institution_invite(text) to authenticated, service_role;

commit;
