-- EduNizam: simple Parent/Student profile approval flow
-- Parent/Student choose a school by name, submit profile details, and wait for one-click Admin approval.
-- No School Code or Student Code is required in the normal login flow.

create table if not exists public.school_access_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null check (requested_role in ('parent','student')),
  full_name text not null,
  phone text,
  student_name text,
  guardian_name text,
  class_name text,
  section_name text,
  admission_no text,
  date_of_birth date,
  relationship text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_user_id, requested_role)
);

create index if not exists school_access_requests_institution_status_idx
  on public.school_access_requests(institution_id,status,created_at desc);

alter table public.school_access_requests enable row level security;

drop policy if exists "requester or owner reads school access requests"
  on public.school_access_requests;

create policy "requester or owner reads school access requests"
on public.school_access_requests
for select
to authenticated
using (
  requester_user_id=(select auth.uid())
  or (select private.is_institution_owner(institution_id,(select auth.uid())))
);

revoke insert, update, delete on public.school_access_requests from anon, authenticated;
grant select on public.school_access_requests to authenticated;

create or replace function private.search_school_directory_v1(p_query text)
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  registration_number text,
  address text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    i.id,
    i.name,
    i.institution_type,
    nullif(btrim(coalesce(i.registration_number,'')),''),
    nullif(btrim(coalesce(s.address,'')),'')
  from public.institutions i
  left join public.institution_settings s on s.institution_id=i.id
  where length(btrim(coalesce(p_query,''))) >= 2
    and lower(i.name) like '%'||lower(btrim(p_query))||'%'
  order by
    case when lower(btrim(i.name))=lower(btrim(p_query)) then 0 else 1 end,
    i.name,
    i.created_at
  limit 20;
$$;

revoke all on function private.search_school_directory_v1(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.search_school_directory_v1(text) to anon, authenticated;

create or replace function public.search_school_directory_v1(p_query text)
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  registration_number text,
  address text
)
language sql
stable
security invoker
set search_path=''
as $$
  select * from private.search_school_directory_v1(p_query);
$$;

revoke all on function public.search_school_directory_v1(text) from public;
grant execute on function public.search_school_directory_v1(text) to anon, authenticated;

create or replace function private.submit_school_access_request_v1(
  p_institution_id uuid,
  p_role text,
  p_full_name text,
  p_phone text,
  p_student_name text default null,
  p_guardian_name text default null,
  p_class_name text default null,
  p_section_name text default null,
  p_admission_no text default null,
  p_date_of_birth date default null,
  p_relationship text default null
)
returns public.school_access_requests
language plpgsql
security definer
set search_path=''
as $$
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
  if exists(select 1 from public.institution_members m where m.user_id=uid) then
    raise exception 'This account is already linked to a school';
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
  on conflict (requester_user_id,requested_role)
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
$$;

revoke all on function private.submit_school_access_request_v1(uuid,text,text,text,text,text,text,text,text,date,text) from public;
grant execute on function private.submit_school_access_request_v1(uuid,text,text,text,text,text,text,text,text,date,text) to authenticated;

create or replace function public.submit_school_access_request_v1(
  p_institution_id uuid,
  p_role text,
  p_full_name text,
  p_phone text,
  p_student_name text default null,
  p_guardian_name text default null,
  p_class_name text default null,
  p_section_name text default null,
  p_admission_no text default null,
  p_date_of_birth date default null,
  p_relationship text default null
)
returns public.school_access_requests
language sql
security invoker
set search_path=''
as $$
  select private.submit_school_access_request_v1(
    p_institution_id,p_role,p_full_name,p_phone,p_student_name,p_guardian_name,
    p_class_name,p_section_name,p_admission_no,p_date_of_birth,p_relationship
  );
$$;

revoke all on function public.submit_school_access_request_v1(uuid,text,text,text,text,text,text,text,text,date,text) from public;
grant execute on function public.submit_school_access_request_v1(uuid,text,text,text,text,text,text,text,text,date,text) to authenticated;

create or replace function private.decide_school_access_request_v1(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns table(
  request_id uuid,
  request_status text,
  requested_role text,
  student_record_linked boolean,
  child_linked boolean
)
language plpgsql
security definer
set search_path=''
as $$
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
      and p.institution_id is not null
      and (p.institution_id<>req.institution_id or p.account_role<>req.requested_role)
  ) then
    raise exception 'This account is already linked with a different school or role';
  end if;

  if exists(
    select 1 from public.institution_members m
    where m.user_id=req.requester_user_id
      and (m.institution_id<>req.institution_id or m.role<>req.requested_role)
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
$$;

revoke all on function private.decide_school_access_request_v1(uuid,boolean,text) from public;
grant execute on function private.decide_school_access_request_v1(uuid,boolean,text) to authenticated;

create or replace function public.decide_school_access_request_v1(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns table(
  request_id uuid,
  request_status text,
  requested_role text,
  student_record_linked boolean,
  child_linked boolean
)
language sql
security invoker
set search_path=''
as $$
  select * from private.decide_school_access_request_v1(p_request_id,p_approve,p_note);
$$;

revoke all on function public.decide_school_access_request_v1(uuid,boolean,text) from public;
grant execute on function public.decide_school_access_request_v1(uuid,boolean,text) to authenticated;
