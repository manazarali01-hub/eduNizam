-- EduNizam deep admission enrollment lifecycle
-- Admission confirmation now completes school enrollment in one transaction:
-- section/capacity, roll no, core student, student membership, class teacher link,
-- fee snapshot and class fee baseline.

begin;

create unique index if not exists core_students_admission_application_unique_idx
  on public.core_students(admission_application_id)
  where nullif(btrim(coalesce(admission_application_id,'')),'') is not null;

create unique index if not exists core_students_class_section_roll_unique_idx
  on public.core_students(institution_id,class_name,(coalesce(section_name,'')),roll_no)
  where nullif(btrim(coalesce(roll_no,'')),'') is not null;

create or replace function public.confirm_admission_v3(
  p_application_id uuid,
  p_section_name text default null,
  p_roll_no text default null
)
returns table(
  application_id uuid,
  admission_no text,
  student_id uuid,
  student_code text,
  class_name text,
  section_name text,
  roll_no text,
  class_teacher_user_id uuid,
  monthly_fee numeric
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  app public.applications%rowtype;
  st public.core_students%rowtype;
  sec public.class_sections%rowtype;
  section_count integer := 0;
  enrolled_count integer := 0;
  chosen_section text := nullif(btrim(coalesce(p_section_name,'')),'');
  chosen_roll text := nullif(btrim(coalesce(p_roll_no,'')),'');
  next_roll integer := 0;
  photo text;
  fee_snapshot jsonb := '{}'::jsonb;
  monthly numeric := 0;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into app
  from public.applications a
  where a.id=p_application_id
  for update;

  if app.id is null then raise exception 'Application not found'; end if;

  if not exists(
    select 1 from public.institutions i
    where i.id=app.institution_id and i.owner_user_id=uid
  ) then raise exception 'School Admin required'; end if;

  select * into st
  from public.core_students s
  where s.admission_application_id=app.id::text
  limit 1;

  if app.status<>'Admission Confirmed' then
    if app.status<>'Payment Verification' then
      raise exception 'Payment must be submitted and verified before admission confirmation';
    end if;
    if coalesce(app.fee_status,'') not in ('Paid','Exempted') then
      raise exception 'Payment has not been verified as Paid';
    end if;
    if app.fee_status='Paid' and not exists(
      select 1 from public.payment_records p
      where p.application_id=app.id and p.status='Paid' and p.verified_at is not null
    ) then raise exception 'No verified paid payment record found'; end if;
  end if;

  if nullif(btrim(coalesce(app.program,'')),'') is null then
    raise exception 'Application class / program is missing';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(app.institution_id::text||'|'||lower(btrim(app.program)),0)
  );

  select count(*) into section_count
  from public.class_sections cs
  where cs.institution_id=app.institution_id
    and lower(btrim(cs.class_name))=lower(btrim(app.program))
    and cs.active=true;

  if chosen_section is null and section_count=1 then
    select * into sec
    from public.class_sections cs
    where cs.institution_id=app.institution_id
      and lower(btrim(cs.class_name))=lower(btrim(app.program))
      and cs.active=true
    limit 1;
    chosen_section:=sec.section_name;
  elsif chosen_section is not null then
    select * into sec
    from public.class_sections cs
    where cs.institution_id=app.institution_id
      and lower(btrim(cs.class_name))=lower(btrim(app.program))
      and lower(btrim(cs.section_name))=lower(btrim(chosen_section))
      and cs.active=true
    for update;
    if sec.id is null then raise exception 'Selected section is not active for this class'; end if;
    chosen_section:=sec.section_name;
  elsif section_count>1 then
    raise exception 'Select a section before confirming admission';
  end if;

  if sec.id is not null and sec.capacity is not null and sec.capacity>0 then
    select count(*) into enrolled_count
    from public.core_students s
    where s.institution_id=app.institution_id
      and lower(btrim(coalesce(s.class_name,'')))=lower(btrim(app.program))
      and lower(btrim(coalesce(s.section_name,'')))=lower(btrim(sec.section_name))
      and (st.id is null or s.id<>st.id);
    if enrolled_count>=sec.capacity then
      raise exception 'Selected section is full (%/% students)',enrolled_count,sec.capacity;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      app.institution_id::text||'|'||lower(btrim(app.program))||'|'||lower(coalesce(chosen_section,'')),
      1
    )
  );

  if chosen_roll is null then
    select coalesce(max(
      case when btrim(coalesce(s.roll_no,'')) ~ '^[0-9]+$'
        then btrim(s.roll_no)::integer else 0 end
    ),0)+1
    into next_roll
    from public.core_students s
    where s.institution_id=app.institution_id
      and lower(btrim(coalesce(s.class_name,'')))=lower(btrim(app.program))
      and lower(btrim(coalesce(s.section_name,'')))=lower(coalesce(btrim(chosen_section),''))
      and (st.id is null or s.id<>st.id);
    chosen_roll:=lpad(next_roll::text,3,'0');
  else
    if exists(
      select 1 from public.core_students s
      where s.institution_id=app.institution_id
        and lower(btrim(coalesce(s.class_name,'')))=lower(btrim(app.program))
        and lower(btrim(coalesce(s.section_name,'')))=lower(coalesce(btrim(chosen_section),''))
        and btrim(coalesce(s.roll_no,''))=chosen_roll
        and (st.id is null or s.id<>st.id)
    ) then
      raise exception 'Roll number % is already in use for this class / section',chosen_roll;
    end if;
  end if;

  fee_snapshot:=coalesce(app.metadata->'fee_snapshot',app.metadata->'feeSnapshot','{}'::jsonb);
  monthly:=coalesce(
    nullif(fee_snapshot->>'monthlyFee','')::numeric,
    nullif(fee_snapshot->>'monthly_fee','')::numeric,
    0
  );

  select d.storage_path into photo
  from public.application_documents d
  where d.application_id=app.id and d.kind='student_photo'
  order by d.created_at desc limit 1;

  if app.status<>'Admission Confirmed' then
    update public.applications
    set status='Admission Confirmed',
        admission_no=coalesce(
          admission_no,
          'ADM-'||to_char(current_date,'YYYY')||'-'||upper(substr(replace(id::text,'-',''),1,8))
        ),
        metadata=coalesce(metadata,'{}'::jsonb)
          || jsonb_build_object(
               'section_name',chosen_section,
               'roll_no',chosen_roll,
               'enrollment_completed_at',now()
             ),
        confirmed_at=now(),
        confirmed_by=uid,
        updated_at=now()
    where id=app.id
    returning * into app;
  else
    update public.applications
    set metadata=coalesce(metadata,'{}'::jsonb)
          || jsonb_build_object(
               'section_name',chosen_section,
               'roll_no',chosen_roll,
               'enrollment_completed_at',coalesce(metadata->'enrollment_completed_at',to_jsonb(now()))
             ),
        updated_at=now()
    where id=app.id
    returning * into app;
  end if;

  if st.id is null then
    insert into public.core_students(
      institution_id,local_id,auth_user_id,name,guardian_name,class_name,section_name,
      phone,b_form_no,guardian_cnic,date_of_birth,admission_no,address,roll_no,student_code,
      admission_application_id,admission_date,fee_snapshot,source,created_by,photo_path,profile_details
    )
    values(
      app.institution_id,(extract(epoch from clock_timestamp())*1000)::bigint,
      app.applicant_user_id,app.applicant_name,app.father_name,app.program,chosen_section,
      app.phone,app.cnic,nullif(app.metadata->>'guardian_cnic',''),app.dob,app.admission_no,
      app.address,chosen_roll,'STU-'||upper(substr(replace(app.id::text,'-',''),1,10)),
      app.id::text,current_date,nullif(fee_snapshot,'{}'::jsonb),'admission',uid,photo,
      coalesce(app.metadata,'{}'::jsonb)
    )
    returning * into st;
  else
    update public.core_students
    set auth_user_id=coalesce(st.auth_user_id,app.applicant_user_id),
        name=app.applicant_name,
        guardian_name=app.father_name,
        class_name=app.program,
        section_name=chosen_section,
        phone=app.phone,
        b_form_no=app.cnic,
        guardian_cnic=coalesce(nullif(app.metadata->>'guardian_cnic',''),st.guardian_cnic),
        date_of_birth=app.dob,
        admission_no=app.admission_no,
        address=app.address,
        roll_no=chosen_roll,
        fee_snapshot=case when fee_snapshot='{}'::jsonb then st.fee_snapshot else fee_snapshot end,
        photo_path=coalesce(photo,st.photo_path),
        profile_details=coalesce(st.profile_details,'{}'::jsonb)||coalesce(app.metadata,'{}'::jsonb),
        updated_at=now()
    where id=st.id
    returning * into st;
  end if;

  if monthly>0 then
    insert into public.class_fee_structure(
      institution_id,class_name,monthly_fee,updated_by,updated_at
    )
    values(app.institution_id,app.program,monthly,uid,now())
    on conflict(institution_id,class_name)
    do update set
      monthly_fee=case
        when public.class_fee_structure.monthly_fee<=0 then excluded.monthly_fee
        else public.class_fee_structure.monthly_fee
      end,
      updated_at=case
        when public.class_fee_structure.monthly_fee<=0 then now()
        else public.class_fee_structure.updated_at
      end,
      updated_by=case
        when public.class_fee_structure.monthly_fee<=0 then uid
        else public.class_fee_structure.updated_by
      end;
  end if;

  if app.applicant_user_id is not null then
    insert into public.institution_members(institution_id,user_id,role)
    values(app.institution_id,app.applicant_user_id,'student')
    on conflict(institution_id,user_id) do update set role='student';

    insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
    values(app.applicant_user_id,'student',app.applicant_name,app.phone,app.institution_id)
    on conflict(user_id)
    do update set
      account_role='student',
      full_name=coalesce(excluded.full_name,public.user_profiles.full_name),
      phone=coalesce(excluded.phone,public.user_profiles.phone),
      institution_id=excluded.institution_id,
      updated_at=now();

    if sec.class_teacher_user_id is not null then
      insert into public.teacher_student_links(
        institution_id,teacher_user_id,student_user_id,assigned_by
      )
      values(app.institution_id,sec.class_teacher_user_id,app.applicant_user_id,uid)
      on conflict(institution_id,teacher_user_id,student_user_id) do nothing;
    end if;
  end if;

  return query
  select app.id,app.admission_no,st.id,st.student_code,st.class_name,st.section_name,
         st.roll_no,sec.class_teacher_user_id,
         coalesce(
           (select cfs.monthly_fee
            from public.class_fee_structure cfs
            where cfs.institution_id=app.institution_id and cfs.class_name=app.program),
           monthly,0
         );
end;
$$;

revoke execute on function public.confirm_admission_v3(uuid,text,text) from public,anon;
grant execute on function public.confirm_admission_v3(uuid,text,text) to authenticated;

commit;
