-- Teachers choose a school and request access with their verified email.
-- The school's owner is the only person who can approve the request.
alter table public.school_access_requests
  drop constraint if exists school_access_requests_requested_role_check;
alter table public.school_access_requests
  add constraint school_access_requests_requested_role_check
  check (requested_role in ('teacher','parent','student'));

create or replace function private.submit_teacher_school_request_v1(
  p_institution_id uuid, p_full_name text, p_phone text
)
returns public.school_access_requests
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
  result_row public.school_access_requests%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_institution_id is null or not exists (
    select 1 from public.institutions where id=p_institution_id
  ) then raise exception 'Select a valid school'; end if;
  if btrim(coalesce(p_full_name,''))='' then raise exception 'Full name is required'; end if;
  if btrim(coalesce(p_phone,''))='' then raise exception 'Contact number is required'; end if;
  if exists (select 1 from public.institutions where owner_user_id=uid)
    or exists (select 1 from public.institution_members where user_id=uid)
    or exists (select 1 from public.user_profiles where user_id=uid and institution_id is not null)
  then raise exception 'This account is already linked to a school'; end if;

  insert into public.school_access_requests(
    institution_id,requester_user_id,requested_role,full_name,phone,status,
    reviewed_by,review_note,reviewed_at,created_at,updated_at
  ) values (
    p_institution_id,uid,'teacher',btrim(p_full_name),btrim(p_phone),'pending',
    null,null,null,now(),now()
  )
  on conflict (requester_user_id,requested_role) do update set
    institution_id=excluded.institution_id,
    full_name=excluded.full_name,
    phone=excluded.phone,
    status='pending',reviewed_by=null,review_note=null,reviewed_at=null,updated_at=now()
  returning * into result_row;
  return result_row;
end;
$$;
revoke all on function private.submit_teacher_school_request_v1(uuid,text,text) from public,anon;
grant execute on function private.submit_teacher_school_request_v1(uuid,text,text) to authenticated;

create or replace function public.submit_teacher_school_request_v1(
  p_institution_id uuid, p_full_name text, p_phone text
)
returns public.school_access_requests
language sql security invoker set search_path=''
as $$
  select private.submit_teacher_school_request_v1(p_institution_id,p_full_name,p_phone);
$$;
revoke all on function public.submit_teacher_school_request_v1(uuid,text,text) from public,anon;
grant execute on function public.submit_teacher_school_request_v1(uuid,text,text) to authenticated;

create or replace function private.decide_teacher_school_request_v1(
  p_request_id uuid, p_approve boolean, p_note text default null
)
returns table(request_id uuid, request_status text, requested_role text)
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := auth.uid();
  req public.school_access_requests%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into req from public.school_access_requests
  where id=p_request_id for update;
  if req.id is null or req.requested_role<>'teacher' then
    raise exception 'Teacher request not found';
  end if;
  if not private.is_institution_owner(req.institution_id,uid) then
    raise exception 'Only this School Admin can review the request';
  end if;
  if req.status<>'pending' then raise exception 'This request has already been reviewed'; end if;

  if p_approve then
    if exists(select 1 from public.institutions where owner_user_id=req.requester_user_id)
      or exists(select 1 from public.institution_members where user_id=req.requester_user_id
        and (institution_id<>req.institution_id or role<>'teacher'))
      or exists(select 1 from public.user_profiles where user_id=req.requester_user_id
        and institution_id is not null
        and (institution_id<>req.institution_id or account_role<>'teacher'))
    then raise exception 'This account already has a different school or role'; end if;

    insert into public.institution_members(institution_id,user_id,role)
    values(req.institution_id,req.requester_user_id,'teacher')
    on conflict (institution_id,user_id) do update set role='teacher';

    insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
    values(req.requester_user_id,'teacher',req.full_name,req.phone,req.institution_id)
    on conflict(user_id) do update set
      account_role='teacher',full_name=excluded.full_name,phone=excluded.phone,
      institution_id=excluded.institution_id,updated_at=now();

    -- Staff records power teacher attendance. The generated code is internal.
    if not exists(select 1 from public.staff_profiles
      where institution_id=req.institution_id and user_id=req.requester_user_id) then
      insert into public.staff_profiles(
        institution_id,user_id,staff_code,full_name,designation,phone,created_by
      ) values (
        req.institution_id,req.requester_user_id,
        'T-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
        req.full_name,'Teacher',req.phone,uid
      );
    end if;
  end if;

  update public.school_access_requests set
    status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=uid,review_note=nullif(btrim(coalesce(p_note,'')),''),
    reviewed_at=now(),updated_at=now()
  where id=req.id;
  return query select req.id,
    case when p_approve then 'approved' else 'rejected' end::text,'teacher'::text;
end;
$$;
revoke all on function private.decide_teacher_school_request_v1(uuid,boolean,text) from public,anon;
grant execute on function private.decide_teacher_school_request_v1(uuid,boolean,text) to authenticated;

create or replace function public.decide_teacher_school_request_v1(
  p_request_id uuid, p_approve boolean, p_note text default null
)
returns table(request_id uuid, request_status text, requested_role text)
language sql security invoker set search_path=''
as $$
  select * from private.decide_teacher_school_request_v1(p_request_id,p_approve,p_note);
$$;
revoke all on function public.decide_teacher_school_request_v1(uuid,boolean,text) from public,anon;
grant execute on function public.decide_teacher_school_request_v1(uuid,boolean,text) to authenticated;

-- Supabase can have explicit anon grants in addition to PostgreSQL PUBLIC grants.
revoke execute on function public.submit_school_access_request_v1(uuid,text,text,text,text,text,text,text,text,date,text) from anon;
revoke execute on function public.decide_school_access_request_v1(uuid,boolean,text) from anon;
