-- EduNizam multi-school Parent/Student links
-- Keep each school relationship isolated by institution_id.

alter table public.parent_student_links
  drop constraint if exists parent_student_links_pkey;

alter table public.parent_student_links
  add constraint parent_student_links_pkey
  primary key (institution_id,parent_user_id,student_user_id);

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
    on conflict (institution_id,parent_user_id,student_user_id)
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
      on conflict (institution_id,parent_user_id,student_user_id)
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

CREATE OR REPLACE FUNCTION public.request_parent_link_by_student_code(p_student_code text)
 RETURNS parent_student_links
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  clean_code text := upper(btrim(coalesce(p_student_code,'')));
  profile_role text;
  profile_institution uuid;
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_code = '' then
    raise exception 'Student Code is required';
  end if;

  select p.account_role,p.institution_id
    into profile_role,profile_institution
  from public.user_profiles p
  where p.user_id=uid
  limit 1;

  if profile_role <> 'parent' then
    raise exception 'Parent account required';
  end if;

  if profile_institution is null then
    raise exception 'Parent account is not linked to a school';
  end if;

  select s.*
    into student_row
  from public.core_students s
  where s.institution_id=profile_institution
    and upper(btrim(coalesce(s.student_code,'')))=clean_code
    and s.auth_user_id is not null
  limit 1;

  if student_row.id is null then
    raise exception 'Student Code not found in your school or student login is not linked yet';
  end if;

  insert into public.parent_student_links(parent_user_id,student_user_id,institution_id,status)
  values(uid,student_row.auth_user_id,profile_institution,'pending')
  on conflict (institution_id,parent_user_id,student_user_id)
  do update set institution_id=excluded.institution_id,status='pending'
  returning * into result_row;

  return result_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_parent_link_by_student_code_v2(p_institution_id uuid, p_student_code text)
 RETURNS parent_student_links
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  clean_code text := upper(btrim(coalesce(p_student_code,'')));
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if clean_code='' then raise exception 'Student Code is required'; end if;
  if not exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id and m.user_id=uid and m.role='parent'
  ) then raise exception 'Approved Parent membership is required for this school'; end if;

  select s.* into student_row
  from public.core_students s
  where s.institution_id=p_institution_id
    and upper(btrim(coalesce(s.student_code,'')))=clean_code
    and s.auth_user_id is not null
  limit 1;

  if student_row.id is null then
    raise exception 'Student Code not found in the selected school or Student login is not linked yet';
  end if;

  insert into public.parent_student_links(
    institution_id,parent_user_id,student_user_id,status
  ) values(
    p_institution_id,uid,student_row.auth_user_id,'pending'
  )
  on conflict (institution_id,parent_user_id,student_user_id)
  do update set status='pending'
  returning * into result_row;

  return result_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_school_access_link_v1(p_request_id uuid, p_core_student_id uuid)
 RETURNS TABLE(requested_role text, linked boolean, student_name text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_req public.school_access_requests%rowtype;
  v_student public.core_students%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into v_req
  from public.school_access_requests
  where id=p_request_id;

  if not found then
    raise exception 'Access request not found';
  end if;

  if v_req.status <> 'approved' then
    raise exception 'Only approved access requests can be resolved';
  end if;

  if v_req.requested_role not in ('student','parent') then
    raise exception 'Only Student or Parent links can be resolved here';
  end if;

  if not (select private.is_institution_owner(v_req.institution_id,(select auth.uid()))) then
    raise exception 'Only the School Admin can resolve this link';
  end if;

  select * into v_student
  from public.core_students
  where id=p_core_student_id
    and institution_id=v_req.institution_id;

  if not found then
    raise exception 'Selected student record does not belong to this school';
  end if;

  if v_req.requested_role='student' then
    if not exists (
      select 1 from public.institution_members m
      where m.institution_id=v_req.institution_id
        and m.user_id=v_req.requester_user_id
        and m.role='student'
    ) then
      raise exception 'Student account is not an approved school member';
    end if;

    if v_student.auth_user_id is not null and v_student.auth_user_id<>v_req.requester_user_id then
      raise exception 'This student record is already linked to another account';
    end if;

    update public.core_students
       set auth_user_id=v_req.requester_user_id,
           updated_at=now()
     where id=v_student.id;

    return query select 'student'::text,true,v_student.name;
    return;
  end if;

  if not exists (
    select 1 from public.institution_members m
    where m.institution_id=v_req.institution_id
      and m.user_id=v_req.requester_user_id
      and m.role='parent'
  ) then
    raise exception 'Parent account is not an approved school member';
  end if;

  if v_student.auth_user_id is null then
    raise exception 'Selected child must first have an approved linked Student account';
  end if;

  if not exists (
    select 1 from public.institution_members m
    where m.institution_id=v_req.institution_id
      and m.user_id=v_student.auth_user_id
      and m.role='student'
  ) then
    raise exception 'Selected child account is not an approved Student member';
  end if;

  insert into public.parent_student_links(
    parent_user_id,student_user_id,institution_id,status
  )
  values(
    v_req.requester_user_id,v_student.auth_user_id,v_req.institution_id,'approved'
  )
  on conflict (institution_id,parent_user_id,student_user_id)
  do update set status='approved',institution_id=excluded.institution_id;

  return query select 'parent'::text,true,v_student.name;
end;
$function$;
