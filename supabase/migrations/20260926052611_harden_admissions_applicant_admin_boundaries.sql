-- Applied in Supabase migration history: harden_admissions_applicant_admin_boundaries
-- Applicants can submit/maintain safe own data; School Admin owns review, decisions, payment verification and sensitive management.

alter table public.applications
  drop constraint if exists applications_status_check,
  add constraint applications_status_check
    check (status in ('Draft','Submitted','Under Review','Documents Pending','Test / Interview','Merit List','Selected','Waitlisted','Rejected','Admitted')),
  drop constraint if exists applications_fee_status_check,
  add constraint applications_fee_status_check
    check (fee_status is null or fee_status in ('Unpaid','Pending Verification','Paid','Exempted'));

drop policy if exists "applicant insert own application" on public.applications;
drop policy if exists "applicant or staff read applications" on public.applications;
drop policy if exists "applicant update draft or staff update" on public.applications;
drop policy if exists "staff delete applications" on public.applications;
drop policy if exists "parent read linked student applications" on public.applications;
drop policy if exists "heads insert applications" on public.applications;
drop policy if exists "heads read applications" on public.applications;
drop policy if exists "heads update applications" on public.applications;
drop policy if exists "heads delete applications" on public.applications;
drop policy if exists "applicants update own draft" on public.applications;

create policy "applicant insert safe application"
on public.applications for insert to authenticated
with check (
  applicant_user_id=(select auth.uid())
  and status in ('Draft','Submitted')
  and coalesce(fee_status,'Unpaid') in ('Unpaid','Pending Verification')
  and test_marks is null
  and interview_marks is null
  and merit_score is null
  and nullif(btrim(coalesce(admin_note,'')),'') is null
  and coalesce(academic_weight,70)=70
  and coalesce(test_weight,20)=20
  and coalesce(interview_weight,10)=10
);

create policy "heads insert applications"
on public.applications for insert to authenticated
with check ((select private.is_institution_owner(institution_id,(select auth.uid()))));

create policy "applicant or head read applications"
on public.applications for select to authenticated
using (
  applicant_user_id=(select auth.uid())
  or (select private.is_institution_owner(institution_id,(select auth.uid())))
);

create policy "parent read linked student applications"
on public.applications for select to authenticated
using (
  exists(
    select 1 from public.parent_student_links l
    where l.institution_id=applications.institution_id
      and l.parent_user_id=(select auth.uid())
      and l.student_user_id=applications.applicant_user_id
      and l.status='approved'
  )
);

create policy "applicants update own draft"
on public.applications for update to authenticated
using (applicant_user_id=(select auth.uid()) and status='Draft')
with check (
  applicant_user_id=(select auth.uid())
  and status='Draft'
  and coalesce(fee_status,'Unpaid') in ('Unpaid','Pending Verification')
  and test_marks is null
  and interview_marks is null
  and merit_score is null
  and nullif(btrim(coalesce(admin_note,'')),'') is null
  and coalesce(academic_weight,70)=70
  and coalesce(test_weight,20)=20
  and coalesce(interview_weight,10)=10
);

create policy "heads update applications"
on public.applications for update to authenticated
using ((select private.is_institution_owner(institution_id,(select auth.uid()))))
with check ((select private.is_institution_owner(institution_id,(select auth.uid()))));

create policy "heads delete applications"
on public.applications for delete to authenticated
using ((select private.is_institution_owner(institution_id,(select auth.uid()))));

drop policy if exists "applicant or staff upload docs" on public.application_documents;
drop policy if exists "application users read docs" on public.application_documents;
drop policy if exists "staff delete docs" on public.application_documents;
drop policy if exists "staff manage docs" on public.application_documents;
drop policy if exists "application owner or head upload docs" on public.application_documents;
drop policy if exists "application owner or head read docs" on public.application_documents;
drop policy if exists "heads update docs" on public.application_documents;
drop policy if exists "owner draft or head delete docs" on public.application_documents;

create policy "application owner or head upload docs"
on public.application_documents for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and exists(
    select 1 from public.applications a
    where a.id=application_documents.application_id
      and (
        (select private.is_institution_owner(a.institution_id,(select auth.uid())))
        or (a.applicant_user_id=(select auth.uid()) and application_documents.verified=false)
      )
  )
);

create policy "application owner or head read docs"
on public.application_documents for select to authenticated
using (
  exists(
    select 1 from public.applications a
    where a.id=application_documents.application_id
      and (
        a.applicant_user_id=(select auth.uid())
        or (select private.is_institution_owner(a.institution_id,(select auth.uid())))
      )
  )
);

create policy "heads update docs"
on public.application_documents for update to authenticated
using (
  exists(select 1 from public.applications a where a.id=application_documents.application_id and (select private.is_institution_owner(a.institution_id,(select auth.uid()))))
)
with check (
  exists(select 1 from public.applications a where a.id=application_documents.application_id and (select private.is_institution_owner(a.institution_id,(select auth.uid()))))
);

create policy "owner draft or head delete docs"
on public.application_documents for delete to authenticated
using (
  exists(
    select 1 from public.applications a
    where a.id=application_documents.application_id
      and (
        (select private.is_institution_owner(a.institution_id,(select auth.uid())))
        or (a.applicant_user_id=(select auth.uid()) and a.status='Draft')
      )
  )
);

drop policy if exists "applicant create payment record" on public.payment_records;
drop policy if exists "application users read payments" on public.payment_records;
drop policy if exists "staff update payments" on public.payment_records;
drop policy if exists "heads create payment records" on public.payment_records;
drop policy if exists "applicant safe payment record" on public.payment_records;
drop policy if exists "application owner or head read payments" on public.payment_records;
drop policy if exists "heads update payments" on public.payment_records;
drop policy if exists "heads delete payments" on public.payment_records;

create policy "applicant safe payment record"
on public.payment_records for insert to authenticated
with check (
  status='Pending Verification'
  and verified_by is null
  and verified_at is null
  and exists(
    select 1 from public.applications a
    where a.id=payment_records.application_id
      and a.applicant_user_id=(select auth.uid())
  )
);

create policy "heads create payment records"
on public.payment_records for insert to authenticated
with check (
  exists(select 1 from public.applications a where a.id=payment_records.application_id and (select private.is_institution_owner(a.institution_id,(select auth.uid()))))
);

create policy "application owner or head read payments"
on public.payment_records for select to authenticated
using (
  exists(
    select 1 from public.applications a
    where a.id=payment_records.application_id
      and (
        a.applicant_user_id=(select auth.uid())
        or (select private.is_institution_owner(a.institution_id,(select auth.uid())))
      )
  )
);

create policy "heads update payments"
on public.payment_records for update to authenticated
using (
  exists(select 1 from public.applications a where a.id=payment_records.application_id and (select private.is_institution_owner(a.institution_id,(select auth.uid()))))
)
with check (
  exists(select 1 from public.applications a where a.id=payment_records.application_id and (select private.is_institution_owner(a.institution_id,(select auth.uid()))))
);

create policy "heads delete payments"
on public.payment_records for delete to authenticated
using (
  exists(select 1 from public.applications a where a.id=payment_records.application_id and (select private.is_institution_owner(a.institution_id,(select auth.uid()))))
);

drop policy if exists "application owner or staff read admission documents" on storage.objects;
drop policy if exists "application owner or staff upload admission documents" on storage.objects;
drop policy if exists "staff delete admission documents" on storage.objects;
drop policy if exists "application owner or head read admission documents" on storage.objects;
drop policy if exists "application owner or head upload admission documents" on storage.objects;
drop policy if exists "application owner draft or head delete admission documents" on storage.objects;

create policy "application owner or head read admission documents"
on storage.objects for select to authenticated
using (
  bucket_id='admission-documents'
  and exists(
    select 1 from public.applications a
    where a.id=((storage.foldername(objects.name))[2])::uuid
      and a.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        a.applicant_user_id=(select auth.uid())
        or (select private.is_institution_owner(a.institution_id,(select auth.uid())))
      )
  )
);

create policy "application owner or head upload admission documents"
on storage.objects for insert to authenticated
with check (
  bucket_id='admission-documents'
  and exists(
    select 1 from public.applications a
    where a.id=((storage.foldername(objects.name))[2])::uuid
      and a.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        a.applicant_user_id=(select auth.uid())
        or (select private.is_institution_owner(a.institution_id,(select auth.uid())))
      )
  )
);

create policy "application owner draft or head delete admission documents"
on storage.objects for delete to authenticated
using (
  bucket_id='admission-documents'
  and exists(
    select 1 from public.applications a
    where a.id=((storage.foldername(objects.name))[2])::uuid
      and a.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        (select private.is_institution_owner(a.institution_id,(select auth.uid())))
        or (a.applicant_user_id=(select auth.uid()) and a.status='Draft')
      )
  )
);
