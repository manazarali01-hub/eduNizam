-- Preserve five read-only public RPC signatures while moving privileged reads
-- into private SECURITY DEFINER implementations.
-- Applied to production on 2026-10-06 after rollback-only Head/Parent tests.

create or replace function private.list_message_contacts_v1()
returns table(target_user_id uuid,target_role text,display_name text,student_user_id uuid,student_name text,conversation_type text)
language plpgsql stable security definer set search_path=''
as $$
declare r text; uid uuid:=(select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  r:=private.current_account_role_v1(uid);

  if r='head_of_institute' then
    return query
    select distinct l.parent_user_id,'parent'::text,
      coalesce(nullif(p.full_name,''),'Parent / Guardian')::text,
      l.student_user_id,s.name::text,'head-parent'::text
    from public.institutions i
    join public.parent_student_links l on l.institution_id=i.id and l.status='approved'
    join public.core_students s on s.institution_id=i.id and s.auth_user_id=l.student_user_id
    left join public.user_profiles p on p.user_id=l.parent_user_id
    where i.owner_user_id=uid;

  elsif r='teacher' then
    return query
    select distinct x.target_user_id,x.target_role,x.display_name,x.student_user_id,x.student_name,x.conversation_type
    from (
      select tsl.student_user_id as target_user_id,'student'::text as target_role,
        coalesce(nullif(sp.full_name,''),s.name,'Student')::text as display_name,
        tsl.student_user_id,s.name::text as student_name,'teacher-student'::text as conversation_type
      from public.teacher_student_links tsl
      join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      left join public.user_profiles sp on sp.user_id=tsl.student_user_id
      where tsl.teacher_user_id=uid
      union all
      select l.parent_user_id,'parent'::text,
        coalesce(nullif(pp.full_name,''),'Parent / Guardian')::text,
        tsl.student_user_id,s.name::text,'teacher-parent'::text
      from public.teacher_student_links tsl
      join public.parent_student_links l
        on l.institution_id=tsl.institution_id and l.student_user_id=tsl.student_user_id and l.status='approved'
      join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      left join public.user_profiles pp on pp.user_id=l.parent_user_id
      where tsl.teacher_user_id=uid
    ) x;

  elsif r='parent' then
    return query
    select distinct x.target_user_id,x.target_role,x.display_name,x.student_user_id,x.student_name,x.conversation_type
    from (
      select i.owner_user_id as target_user_id,'head'::text as target_role,
        ('Head · '||i.name)::text as display_name,l.student_user_id,
        s.name::text as student_name,'head-parent'::text as conversation_type
      from public.parent_student_links l
      join public.institutions i on i.id=l.institution_id
      join public.core_students s on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      where l.parent_user_id=uid and l.status='approved'
      union all
      select tsl.teacher_user_id,'teacher'::text,
        coalesce(nullif(tp.full_name,''),'Teacher')::text,l.student_user_id,
        s.name::text,'teacher-parent'::text
      from public.parent_student_links l
      join public.teacher_student_links tsl
        on tsl.institution_id=l.institution_id and tsl.student_user_id=l.student_user_id
      join public.core_students s on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      left join public.user_profiles tp on tp.user_id=tsl.teacher_user_id
      where l.parent_user_id=uid and l.status='approved'
    ) x;

  elsif r='student' then
    return query
    select distinct tsl.teacher_user_id,'teacher'::text,
      coalesce(nullif(tp.full_name,''),'Teacher')::text,
      tsl.student_user_id,s.name::text,'teacher-student'::text
    from public.teacher_student_links tsl
    join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
    left join public.user_profiles tp on tp.user_id=tsl.teacher_user_id
    where tsl.student_user_id=uid;
  end if;
end;
$$;

create or replace function private.list_my_transport_assignments_v1()
returns table(
  id uuid,student_id uuid,student_local_id bigint,student_name text,class_name text,section_name text,
  route_id uuid,route_name text,vehicle_id uuid,registration_no text,driver_name text,driver_phone text,
  pickup_stop text,drop_stop text,monthly_fee numeric,effective_from date,status text
)
language sql stable security definer set search_path=''
as $$
  select a.id,a.student_id,s.local_id,s.name,s.class_name,s.section_name,
    a.route_id,r.route_name,a.vehicle_id,v.registration_no,v.driver_name,v.driver_phone,
    a.pickup_stop,a.drop_stop,r.monthly_fee,a.effective_from,a.status
  from public.student_transport_assignments a
  join public.core_students s on s.id=a.student_id
  join public.transport_routes r on r.id=a.route_id
  join public.transport_vehicles v on v.id=a.vehicle_id
  where
    exists(select 1 from public.institutions i where i.id=a.institution_id and i.owner_user_id=(select auth.uid()))
    or private.can_access_core_student_v2(a.student_id,(select auth.uid()))
  order by s.name;
$$;

create or replace function private.list_parent_teacher_directory_v2(p_institution_id uuid)
returns table(user_id uuid,full_name text,designation text)
language sql stable security definer set search_path=''
as $$
  select sp.user_id,sp.full_name,sp.designation
  from public.staff_profiles sp
  join public.institution_members tm
    on tm.institution_id=sp.institution_id and tm.user_id=sp.user_id and tm.role='teacher'
  where sp.institution_id=p_institution_id
    and sp.user_id is not null
    and (
      exists(
        select 1 from public.institution_members me
        where me.institution_id=p_institution_id
          and me.user_id=(select auth.uid())
          and me.role='parent'
      )
      or exists(
        select 1 from public.institutions i
        where i.id=p_institution_id and i.owner_user_id=(select auth.uid())
      )
    )
  order by coalesce(sp.full_name,''),sp.user_id;
$$;

create or replace function private.list_teacher_access_requests_v1(p_institution_id uuid)
returns table(
  request_id uuid,requester_user_id uuid,requester_label text,staff_profile_id uuid,staff_code text,
  staff_name text,designation text,employment_status text,request_status text,created_at timestamptz,
  reviewed_at timestamptz,review_note text
)
language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.institutions i where i.id=p_institution_id and i.owner_user_id=uid)
    then raise exception 'School Admin access required'; end if;

  return query
  select r.id,r.requester_user_id,
    coalesce(nullif(p.full_name,''),nullif(u.raw_user_meta_data->>'full_name',''),u.email,r.requester_user_id::text),
    s.id,s.staff_code,s.full_name,s.designation,s.employment_status,r.status,r.created_at,
    case when r.reviewed_by is null then null else r.updated_at end,r.review_note
  from public.teacher_access_requests r
  join public.staff_profiles s on s.id=r.staff_profile_id
  left join public.user_profiles p on p.user_id=r.requester_user_id
  left join auth.users u on u.id=r.requester_user_id
  where r.institution_id=p_institution_id
  order by case when r.status='pending' then 0 else 1 end,r.created_at desc;
end;
$$;

create or replace function private.platform_owner_institutions_v1()
returns table(
  institution_id uuid,institution_name text,institution_type text,institution_created_at timestamptz,
  student_count bigint,staff_count bigint,plan_id uuid,plan_code text,plan_name text,monthly_price_pkr numeric,
  subscription_status text,trial_ends_at timestamptz,current_period_end timestamptz
)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not private.is_platform_admin_v1((select auth.uid())) then
    raise exception 'Platform administrator access required';
  end if;

  return query
  select i.id,i.name,i.institution_type,i.created_at,
    (select count(*) from public.core_students cs where cs.institution_id=i.id),
    (select count(*) from public.staff_profiles sp where sp.institution_id=i.id),
    p.id,p.code,p.name,p.monthly_price_pkr,coalesce(s.status,'active'),
    s.trial_ends_at,s.current_period_end
  from public.institutions i
  left join public.institution_subscriptions s on s.institution_id=i.id
  left join public.subscription_plans p on p.id=s.plan_id
  order by i.created_at desc;
end;
$$;

revoke all on function private.list_message_contacts_v1() from public,anon;
revoke all on function private.list_my_transport_assignments_v1() from public,anon;
revoke all on function private.list_parent_teacher_directory_v2(uuid) from public,anon;
revoke all on function private.list_teacher_access_requests_v1(uuid) from public,anon;
revoke all on function private.platform_owner_institutions_v1() from public,anon;
grant execute on function private.list_message_contacts_v1() to authenticated;
grant execute on function private.list_my_transport_assignments_v1() to authenticated;
grant execute on function private.list_parent_teacher_directory_v2(uuid) to authenticated;
grant execute on function private.list_teacher_access_requests_v1(uuid) to authenticated;
grant execute on function private.platform_owner_institutions_v1() to authenticated;

create or replace function public.list_message_contacts()
returns table(target_user_id uuid,target_role text,display_name text,student_user_id uuid,student_name text,conversation_type text)
language sql stable security invoker set search_path=''
as $$ select * from private.list_message_contacts_v1(); $$;

create or replace function public.list_my_transport_assignments()
returns table(
  id uuid,student_id uuid,student_local_id bigint,student_name text,class_name text,section_name text,
  route_id uuid,route_name text,vehicle_id uuid,registration_no text,driver_name text,driver_phone text,
  pickup_stop text,drop_stop text,monthly_fee numeric,effective_from date,status text
)
language sql stable security invoker set search_path=''
as $$ select * from private.list_my_transport_assignments_v1(); $$;

create or replace function public.list_parent_teacher_directory_v1(p_institution_id uuid)
returns table(user_id uuid,full_name text,designation text)
language sql stable security invoker set search_path=''
as $$ select * from private.list_parent_teacher_directory_v2(p_institution_id); $$;

create or replace function public.list_teacher_access_requests(p_institution_id uuid)
returns table(
  request_id uuid,requester_user_id uuid,requester_label text,staff_profile_id uuid,staff_code text,
  staff_name text,designation text,employment_status text,request_status text,created_at timestamptz,
  reviewed_at timestamptz,review_note text
)
language sql stable security invoker set search_path=''
as $$ select * from private.list_teacher_access_requests_v1(p_institution_id); $$;

create or replace function public.platform_owner_institutions()
returns table(
  institution_id uuid,institution_name text,institution_type text,institution_created_at timestamptz,
  student_count bigint,staff_count bigint,plan_id uuid,plan_code text,plan_name text,monthly_price_pkr numeric,
  subscription_status text,trial_ends_at timestamptz,current_period_end timestamptz
)
language sql stable security invoker set search_path=''
as $$ select * from private.platform_owner_institutions_v1(); $$;
