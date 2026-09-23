-- EduNizam Teacher access ambiguity fix
-- Applied to Supabase project qmdiexentozvhhfjvlmr on 2026-09-23.
-- Uses the named unique constraint to avoid PL/pgSQL output-column ambiguity.

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
set search_path = ''
as $function$
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
$function$;

revoke execute on function public.request_teacher_access(text,text) from public, anon;
grant execute on function public.request_teacher_access(text,text) to authenticated;
