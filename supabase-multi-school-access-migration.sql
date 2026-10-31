-- EduNizam same-role multi-school membership and approval support
-- One account may belong to multiple schools when the role stays the same.
-- Conflicting roles remain blocked.

alter table public.school_access_requests
  drop constraint if exists school_access_requests_requester_user_id_requested_role_key;

alter table public.school_access_requests
  drop constraint if exists school_access_requests_institution_requester_role_key;

alter table public.school_access_requests
  add constraint school_access_requests_institution_requester_role_key
  unique (institution_id,requester_user_id,requested_role);

CREATE OR REPLACE FUNCTION private.decide_school_access_request_v1(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS TABLE(request_id uuid, request_status text, requested_role text, student_record_linked boolean, child_linked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  req public.school_access_requests%rowtype;
  student_row public.core_students%rowtype;
  student_match_count integer := 0;
  did_student_link boolean := false;
  did_child_link boolean := false;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into req
  from public.school_access_requests r
  where r.id=p_request_id
  for update;

  if req.id is null then raise exception 'Access request not found'; end if;
  if not private.is_institution_owner(req.institution_id,uid) then
    raise exception 'Only this School Admin can review the request';
  end if;

  if not p_approve then
    update public.school_access_requests
    set status='rejected',
        reviewed_by=uid,
        review_note=nullif(btrim(coalesce(p_note,'')),''),
        reviewed_at=now(),
        updated_at=now()
    where id=req.id;
    return query select req.id,'rejected'::text,req.requested_role,false,false;
    return;
  end if;

  if exists(
    select 1 from public.user_profiles p
    where p.user_id=req.requester_user_id
      and p.account_role is not null
      and p.account_role<>req.requested_role
  ) then
    raise exception 'This account is already linked with a different school or role';
  end if;

  if exists(
    select 1 from public.institution_members m
    where m.user_id=req.requester_user_id
      and m.role<>req.requested_role
  ) then
    raise exception 'This account already has a different school membership';
  end if;

  insert into public.institution_members(institution_id,user_id,role)
  values(req.institution_id,req.requester_user_id,req.requested_role)
  on conflict (institution_id,user_id) do update set role=excluded.role;

  insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
  values(req.requester_user_id,req.requested_role,req.full_name,req.phone,req.institution_id)
  on conflict(user_id) do update
    set account_role=excluded.account_role,
        full_name=excluded.full_name,
        phone=excluded.phone,
        institution_id=excluded.institution_id,
        updated_at=now();

  if req.requested_role='student' then
    if nullif(btrim(coalesce(req.admission_no,'')),'') is not null then
      select count(*) into student_match_count
      from public.core_students s
      where s.institution_id=req.institution_id
        and upper(btrim(coalesce(s.admission_no,'')))=upper(btrim(req.admission_no))
        and (s.auth_user_id is null or s.auth_user_id=req.requester_user_id);
      if student_match_count=1 then
        select * into student_row
        from public.core_students s
        where s.institution_id=req.institution_id
          and upper(btrim(coalesce(s.admission_no,'')))=upper(btrim(req.admission_no))
          and (s.auth_user_id is null or s.auth_user_id=req.requester_user_id)
        limit 1;
      end if;
    end if;

    if student_row.id is null and nullif(btrim(coalesce(req.student_name,'')),'') is not null then
      select count(*) into student_match_count
      from public.core_students s
      where s.institution_id=req.institution_id
        and lower(btrim(s.name))=lower(btrim(req.student_name))
        and (
          nullif(btrim(coalesce(req.class_name,'')),'') is null
          or lower(btrim(coalesce(s.class_name,'')))=lower(btrim(req.class_name))
        )
        and (
          nullif(btrim(coalesce(req.guardian_name,'')),'') is null
          or lower(btrim(coalesce(s.guardian_name,'')))=lower(btrim(req.guardian_name))
        )
        and (s.auth_user_id is null or s.auth_user_id=req.requester_user_id);
      if student_match_count=1 then
        select * into student_row
        from public.core_students s
        where s.institution_id=req.institution_id
          and lower(btrim(s.name))=lower(btrim(req.student_name))
          and (
            nullif(btrim(coalesce(req.class_name,'')),'') is null
            or lower(btrim(coalesce(s.class_name,'')))=lower(btrim(req.class_name))
          )
          and (
            nullif(btrim(coalesce(req.guardian_name,'')),'') is null
            or lower(btrim(coalesce(s.guardian_name,'')))=lower(btrim(req.guardian_name))
          )
          and (s.auth_user_id is null or s.auth_user_id=req.requester_user_id)
        limit 1;
      end if;
    end if;

    if student_row.id is null then
      insert into public.core_students(
        institution_id,auth_user_id,name,guardian_name,class_name,section_name,phone,
        date_of_birth,admission_no,student_code,source,created_by,updated_at
      )
      values(
        req.institution_id,req.requester_user_id,coalesce(req.student_name,req.full_name),
        req.guardian_name,req.class_name,req.section_name,req.phone,req.date_of_birth,req.admission_no,
        'STU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
        'self_signup_approved',uid,now()
      )
      returning * into student_row;
      did_student_link := true;
    else
      update public.core_students
      set auth_user_id=req.requester_user_id,
          guardian_name=coalesce(nullif(guardian_name,''),req.guardian_name),
          class_name=coalesce(nullif(class_name,''),req.class_name),
          section_name=coalesce(nullif(section_name,''),req.section_name),
          phone=coalesce(nullif(phone,''),req.phone),
          date_of_birth=coalesce(date_of_birth,req.date_of_birth),
          admission_no=coalesce(nullif(admission_no,''),req.admission_no),
          updated_at=now()
      where id=student_row.id;
      did_student_link := true;
    end if;

    insert into public.parent_student_links(parent_user_id,student_user_id,institution_id,status)
    select par.requester_user_id,req.requester_user_id,req.institution_id,'approved'
    from public.school_access_requests par
    where par.institution_id=req.institution_id
      and par.requested_role='parent'
      and par.status='approved'
      and (
        (
          nullif(btrim(coalesce(par.admission_no,'')),'') is not null
          and nullif(btrim(coalesce(student_row.admission_no,'')),'') is not null
          and upper(btrim(par.admission_no))=upper(btrim(student_row.admission_no))
        )
        or (
          lower(btrim(coalesce(par.student_name,'')))=lower(btrim(student_row.name))
          and (
            nullif(btrim(coalesce(par.class_name,'')),'') is null
            or lower(btrim(coalesce(par.class_name,'')))=lower(btrim(coalesce(student_row.class_name,'')))
          )
        )
      )
    on conflict (parent_user_id,student_user_id)
    do update set institution_id=excluded.institution_id,status='approved';

  elsif req.requested_role='parent' then
    if nullif(btrim(coalesce(req.admission_no,'')),'') is not null then
      select count(*) into student_match_count
      from public.core_students s
      where s.institution_id=req.institution_id
        and upper(btrim(coalesce(s.admission_no,'')))=upper(btrim(req.admission_no))
        and s.auth_user_id is not null;
      if student_match_count=1 then
        select * into student_row
        from public.core_students s
        where s.institution_id=req.institution_id
          and upper(btrim(coalesce(s.admission_no,'')))=upper(btrim(req.admission_no))
          and s.auth_user_id is not null
        limit 1;
      end if;
    end if;

    if student_row.id is null and nullif(btrim(coalesce(req.student_name,'')),'') is not null then
      select count(*) into student_match_count
      from public.core_students s
      where s.institution_id=req.institution_id
        and lower(btrim(s.name))=lower(btrim(req.student_name))
        and (
          nullif(btrim(coalesce(req.class_name,'')),'') is null
          or lower(btrim(coalesce(s.class_name,'')))=lower(btrim(req.class_name))
        )
        and s.auth_user_id is not null;
      if student_match_count=1 then
        select * into student_row
        from public.core_students s
        where s.institution_id=req.institution_id
          and lower(btrim(s.name))=lower(btrim(req.student_name))
          and (
            nullif(btrim(coalesce(req.class_name,'')),'') is null
            or lower(btrim(coalesce(s.class_name,'')))=lower(btrim(req.class_name))
          )
          and s.auth_user_id is not null
        limit 1;
      end if;
    end if;

    if student_row.id is not null and student_row.auth_user_id is not null then
      insert into public.parent_student_links(parent_user_id,student_user_id,institution_id,status)
      values(req.requester_user_id,student_row.auth_user_id,req.institution_id,'approved')
      on conflict (parent_user_id,student_user_id)
      do update set institution_id=excluded.institution_id,status='approved';
      did_child_link := true;
    end if;
  end if;

  update public.school_access_requests
  set status='approved',
      reviewed_by=uid,
      review_note=nullif(btrim(coalesce(p_note,'')),''),
      reviewed_at=now(),
      updated_at=now()
  where id=req.id;

  return query select req.id,'approved'::text,req.requested_role,did_student_link,did_child_link;
end;
$function$;

CREATE OR REPLACE FUNCTION private.decide_teacher_school_request_v1(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS TABLE(request_id uuid, request_status text, requested_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        and role<>'teacher')
      or exists(select 1 from public.user_profiles where user_id=req.requester_user_id
        and account_role is not null
        and account_role<>'teacher')
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
$function$;

CREATE OR REPLACE FUNCTION private.submit_school_access_request_v1(p_institution_id uuid, p_role text, p_full_name text, p_phone text, p_student_name text DEFAULT NULL::text, p_guardian_name text DEFAULT NULL::text, p_class_name text DEFAULT NULL::text, p_section_name text DEFAULT NULL::text, p_admission_no text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_relationship text DEFAULT NULL::text)
 RETURNS school_access_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  clean_role text := lower(btrim(coalesce(p_role,'')));
  result_row public.school_access_requests%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_role not in ('parent','student') then raise exception 'Parent or Student role required'; end if;
  if p_institution_id is null or not exists(select 1 from public.institutions i where i.id=p_institution_id) then
    raise exception 'Select a valid school';
  end if;
  if btrim(coalesce(p_full_name,''))='' then raise exception 'Full name is required'; end if;
  if btrim(coalesce(p_phone,''))='' then raise exception 'Contact number is required'; end if;
  if exists(select 1 from public.institutions i where i.owner_user_id=uid) then
    raise exception 'School Admin accounts cannot request Parent or Student access';
  end if;
  if exists(select 1 from public.institution_members m where m.user_id=uid and m.role<>clean_role) then
    raise exception 'This account already uses a different school role';
  end if;
  if exists(select 1 from public.user_profiles p where p.user_id=uid and p.account_role is not null and p.account_role<>clean_role) then
    raise exception 'This account already uses a different school role';
  end if;
  if clean_role='student' and btrim(coalesce(p_class_name,''))='' then
    raise exception 'Class is required for Student approval';
  end if;
  if clean_role='parent' then
    if btrim(coalesce(p_student_name,''))='' then raise exception 'Child name is required'; end if;
    if btrim(coalesce(p_class_name,''))='' then raise exception 'Child class is required'; end if;
  end if;

  insert into public.school_access_requests(
    institution_id,requester_user_id,requested_role,full_name,phone,
    student_name,guardian_name,class_name,section_name,admission_no,date_of_birth,relationship,
    status,reviewed_by,review_note,reviewed_at,created_at,updated_at
  )
  values(
    p_institution_id,uid,clean_role,btrim(p_full_name),nullif(btrim(coalesce(p_phone,'')),''),
    nullif(btrim(coalesce(p_student_name,'')),''),
    nullif(btrim(coalesce(p_guardian_name,'')),''),
    nullif(btrim(coalesce(p_class_name,'')),''),
    nullif(btrim(coalesce(p_section_name,'')),''),
    nullif(btrim(coalesce(p_admission_no,'')),''),
    p_date_of_birth,
    nullif(btrim(coalesce(p_relationship,'')),''),
    'pending',null,null,null,now(),now()
  )
  on conflict (institution_id,requester_user_id,requested_role)
  do update set
    institution_id=excluded.institution_id,
    full_name=excluded.full_name,
    phone=excluded.phone,
    student_name=excluded.student_name,
    guardian_name=excluded.guardian_name,
    class_name=excluded.class_name,
    section_name=excluded.section_name,
    admission_no=excluded.admission_no,
    date_of_birth=excluded.date_of_birth,
    relationship=excluded.relationship,
    status='pending',
    reviewed_by=null,
    review_note=null,
    reviewed_at=null,
    updated_at=now()
  returning * into result_row;

  return result_row;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_teacher_school_request_v1(p_institution_id uuid, p_full_name text, p_phone text)
 RETURNS school_access_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    or exists (select 1 from public.institution_members where user_id=uid and role<>'teacher')
    or exists (select 1 from public.user_profiles where user_id=uid and account_role is not null and account_role<>'teacher')
  then raise exception 'This account already uses a different school role'; end if;

  insert into public.school_access_requests(
    institution_id,requester_user_id,requested_role,full_name,phone,status,
    reviewed_by,review_note,reviewed_at,created_at,updated_at
  ) values (
    p_institution_id,uid,'teacher',btrim(p_full_name),btrim(p_phone),'pending',
    null,null,null,now(),now()
  )
  on conflict (institution_id,requester_user_id,requested_role) do update set
    institution_id=excluded.institution_id,
    full_name=excluded.full_name,
    phone=excluded.phone,
    status='pending',reviewed_by=null,review_note=null,reviewed_at=null,updated_at=now()
  returning * into result_row;
  return result_row;
end;
$function$;
