-- EduNizam confirmed admission -> school-linked student membership
-- Run after supabase-admissions-production-workflow.sql

create or replace function public.confirm_admission_v2(p_application_id uuid)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.applications;
  uid uuid := (select auth.uid());
  photo text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  select * into result
  from public.applications
  where id=p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=result.institution_id
      and i.owner_user_id=uid
  ) then raise exception 'School Admin required'; end if;

  if result.status='Admission Confirmed' then return result; end if;

  if result.status <> 'Payment Verification' then
    raise exception 'Payment must be submitted and verified before admission confirmation';
  end if;

  if coalesce(result.fee_status,'') not in ('Paid','Exempted') then
    raise exception 'Payment has not been verified as Paid';
  end if;

  if result.fee_status='Paid' and not exists(
    select 1
    from public.payment_records p
    where p.application_id=result.id
      and p.status='Paid'
      and p.verified_at is not null
  ) then
    raise exception 'No verified paid payment record found';
  end if;

  select d.storage_path
    into photo
  from public.application_documents d
  where d.application_id=result.id
    and d.kind='student_photo'
  order by d.created_at desc
  limit 1;

  update public.applications
     set status='Admission Confirmed',
         admission_no=coalesce(
           admission_no,
           'ADM-'||to_char(current_date,'YYYY')||'-'||upper(substr(replace(id::text,'-',''),1,8))
         ),
         confirmed_at=now(),
         confirmed_by=uid,
         updated_at=now()
   where id=p_application_id
   returning * into result;

  insert into public.core_students(
    institution_id,
    local_id,
    auth_user_id,
    name,
    guardian_name,
    class_name,
    phone,
    b_form_no,
    guardian_cnic,
    date_of_birth,
    admission_no,
    address,
    roll_no,
    student_code,
    admission_application_id,
    admission_date,
    source,
    created_by,
    photo_path,
    profile_details
  )
  select
    result.institution_id,
    (extract(epoch from clock_timestamp())*1000)::bigint,
    result.applicant_user_id,
    result.applicant_name,
    result.father_name,
    result.program,
    result.phone,
    result.cnic,
    nullif(result.metadata->>'guardian_cnic',''),
    result.dob,
    result.admission_no,
    result.address,
    nullif(result.metadata->>'roll_no',''),
    'STU-'||upper(substr(replace(result.id::text,'-',''),1,10)),
    result.id::text,
    current_date,
    'admission',
    uid,
    photo,
    coalesce(result.metadata,'{}'::jsonb)
  where not exists(
    select 1
    from public.core_students s
    where s.admission_application_id=result.id::text
  );

  if result.applicant_user_id is not null then
    insert into public.institution_members(institution_id,user_id,role)
    values(result.institution_id,result.applicant_user_id,'student')
    on conflict (institution_id,user_id)
    do update set role='student';

    insert into public.user_profiles(
      user_id,
      account_role,
      full_name,
      phone,
      institution_id
    )
    values(
      result.applicant_user_id,
      'student',
      result.applicant_name,
      result.phone,
      result.institution_id
    )
    on conflict (user_id)
    do update set
      account_role='student',
      full_name=coalesce(excluded.full_name,public.user_profiles.full_name),
      phone=coalesce(excluded.phone,public.user_profiles.phone),
      institution_id=excluded.institution_id,
      updated_at=now();
  end if;

  return result;
end
$$;

revoke all on function public.confirm_admission_v2(uuid) from public,anon;
grant execute on function public.confirm_admission_v2(uuid) to authenticated;
