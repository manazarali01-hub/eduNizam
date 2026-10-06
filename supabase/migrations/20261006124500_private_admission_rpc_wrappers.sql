-- Harden admission/payment RPCs without changing public API signatures.
-- Elevated implementations live in private; exposed public functions are SECURITY INVOKER.
-- Existing applicant/admin/payment state checks and return types are preserved.
-- Applied to production on 2026-10-06 after rollback validation; Supabase security-definer
-- advisor findings reduced from 5 to 1.

create or replace function private.confirm_admission_v2_impl(p_application_id uuid)
returns public.applications
language plpgsql security definer set search_path=''
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
  ) then
    raise exception 'School Admin required';
  end if;

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

  select d.storage_path into photo
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
    institution_id,local_id,auth_user_id,name,guardian_name,class_name,phone,b_form_no,
    guardian_cnic,date_of_birth,admission_no,address,roll_no,student_code,
    admission_application_id,admission_date,source,created_by,photo_path,profile_details
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
    on conflict (institution_id,user_id) do update
      set role='student';

    insert into public.user_profiles(user_id,account_role,full_name,phone,institution_id)
    values(result.applicant_user_id,'student',result.applicant_name,result.phone,result.institution_id)
    on conflict (user_id) do update
      set account_role='student',
          full_name=coalesce(excluded.full_name,public.user_profiles.full_name),
          phone=coalesce(excluded.phone,public.user_profiles.phone),
          institution_id=excluded.institution_id,
          updated_at=now();
  end if;

  return result;
end;
$$;

create or replace function private.issue_admission_challan_v2_impl(
  p_application_id uuid,
  p_amount numeric
)
returns public.applications
language plpgsql security definer set search_path=''
as $$
declare
  result public.applications;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Valid challan amount required'; end if;

  select a.* into result
  from public.applications a
  where a.id=p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;

  if not exists(
    select 1
    from public.institutions i
    where i.id=result.institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'School Admin required';
  end if;

  if result.challan_no is not null then return result; end if;

  if result.status not in ('Approved for Fee','Selected') then
    raise exception 'Approve application before issuing fee challan';
  end if;

  update public.applications
     set status='Challan Issued',
         challan_no='CH-'||upper(substr(replace(id::text,'-',''),1,12)),
         challan_amount=p_amount,
         challan_issued_at=now(),
         fee_status=case when p_amount=0 then 'Exempted' else 'Unpaid' end,
         updated_at=now()
   where id=p_application_id
   returning * into result;

  return result;
end;
$$;

create or replace function private.submit_admission_payment_v2_impl(
  p_application_id uuid,
  p_method text,
  p_reference text,
  p_amount numeric,
  p_proof_storage_path text
)
returns public.payment_records
language plpgsql security definer set search_path=''
as $$
declare
  app public.applications;
  result public.payment_records;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_method,'')),'') is null then raise exception 'Payment method required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;

  select a.* into app
  from public.applications a
  where a.id=p_application_id
    and a.applicant_user_id=uid
  for update;

  if not found then raise exception 'Application not found for this applicant'; end if;

  if app.status not in ('Challan Issued','Payment Verification') then
    raise exception 'Fee challan must be issued before payment submission';
  end if;

  if app.challan_amount is not null and p_amount < app.challan_amount then
    raise exception 'Submitted amount is below the challan amount';
  end if;

  if exists(
    select 1
    from public.payment_records p
    where p.application_id=app.id
      and p.status='Pending Verification'
  ) then
    raise exception 'A payment is already pending verification';
  end if;

  insert into public.payment_records(
    application_id,method,amount,currency,status,reference,proof_storage_path
  )
  values(
    app.id,
    btrim(p_method),
    p_amount,
    'PKR',
    'Pending Verification',
    nullif(btrim(coalesce(p_reference,'')),''),
    nullif(btrim(coalesce(p_proof_storage_path,'')),'')
  )
  returning * into result;

  update public.applications
     set status='Payment Verification',
         fee_status='Pending Verification',
         payment_method=btrim(p_method),
         fee_reference=nullif(btrim(coalesce(p_reference,'')),''),
         fee_date=current_date,
         updated_at=now()
   where id=app.id;

  return result;
end;
$$;

create or replace function private.verify_admission_payment_v2_impl(
  p_payment_id uuid,
  p_decision text,
  p_note text
)
returns public.applications
language plpgsql security definer set search_path=''
as $$
declare
  pay public.payment_records;
  app public.applications;
  uid uuid := (select auth.uid());
  decision text := initcap(lower(btrim(coalesce(p_decision,''))));
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if decision not in ('Paid','Rejected') then
    raise exception 'Decision must be Paid or Rejected';
  end if;

  select p.* into pay
  from public.payment_records p
  where p.id=p_payment_id
  for update;

  if not found then raise exception 'Payment record not found'; end if;

  select a.* into app
  from public.applications a
  where a.id=pay.application_id
  for update;

  if not exists(
    select 1
    from public.institutions i
    where i.id=app.institution_id
      and i.owner_user_id=uid
  ) then
    raise exception 'School Admin required';
  end if;

  update public.payment_records
     set status=decision,
         verified_by=uid,
         verified_at=now()
   where id=p_payment_id;

  if decision='Paid' then
    update public.applications
       set status='Payment Verification',
           fee_status='Paid',
           admin_note=case
             when nullif(btrim(coalesce(p_note,'')),'') is null then admin_note
             else btrim(p_note)
           end,
           updated_at=now()
     where id=app.id
     returning * into app;
  else
    update public.applications
       set status='Challan Issued',
           fee_status='Unpaid',
           admin_note=coalesce(
             nullif(btrim(coalesce(p_note,'')),''),
             'Payment verification rejected. Please submit valid payment details.'
           ),
           updated_at=now()
     where id=app.id
     returning * into app;
  end if;

  return app;
end;
$$;

revoke all on function private.confirm_admission_v2_impl(uuid) from public,anon;
revoke all on function private.issue_admission_challan_v2_impl(uuid,numeric) from public,anon;
revoke all on function private.submit_admission_payment_v2_impl(uuid,text,text,numeric,text) from public,anon;
revoke all on function private.verify_admission_payment_v2_impl(uuid,text,text) from public,anon;

grant execute on function private.confirm_admission_v2_impl(uuid) to authenticated;
grant execute on function private.issue_admission_challan_v2_impl(uuid,numeric) to authenticated;
grant execute on function private.submit_admission_payment_v2_impl(uuid,text,text,numeric,text) to authenticated;
grant execute on function private.verify_admission_payment_v2_impl(uuid,text,text) to authenticated;

create or replace function public.confirm_admission_v2(p_application_id uuid)
returns public.applications
language sql security invoker set search_path=''
as $$
  select private.confirm_admission_v2_impl(p_application_id);
$$;

create or replace function public.issue_admission_challan_v2(
  p_application_id uuid,
  p_amount numeric
)
returns public.applications
language sql security invoker set search_path=''
as $$
  select private.issue_admission_challan_v2_impl(p_application_id,p_amount);
$$;

create or replace function public.submit_admission_payment_v2(
  p_application_id uuid,
  p_method text,
  p_reference text,
  p_amount numeric,
  p_proof_storage_path text default null
)
returns public.payment_records
language sql security invoker set search_path=''
as $$
  select private.submit_admission_payment_v2_impl(
    p_application_id,p_method,p_reference,p_amount,p_proof_storage_path
  );
$$;

create or replace function public.verify_admission_payment_v2(
  p_payment_id uuid,
  p_decision text,
  p_note text default null
)
returns public.applications
language sql security invoker set search_path=''
as $$
  select private.verify_admission_payment_v2_impl(p_payment_id,p_decision,p_note);
$$;

revoke all on function public.confirm_admission_v2(uuid) from public,anon;
revoke all on function public.issue_admission_challan_v2(uuid,numeric) from public,anon;
revoke all on function public.submit_admission_payment_v2(uuid,text,text,numeric,text) from public,anon;
revoke all on function public.verify_admission_payment_v2(uuid,text,text) from public,anon;

grant execute on function public.confirm_admission_v2(uuid) to authenticated;
grant execute on function public.issue_admission_challan_v2(uuid,numeric) to authenticated;
grant execute on function public.submit_admission_payment_v2(uuid,text,text,numeric,text) to authenticated;
grant execute on function public.verify_admission_payment_v2(uuid,text,text) to authenticated;
