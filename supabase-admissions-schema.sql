-- EduNizam Admissions Cloud Schema (Supabase/Postgres)
-- Apply through Supabase SQL Editor or migrations.
create extension if not exists pgcrypto;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution_type text not null check (institution_type in ('school','college','academy','university')),
  admission_session text not null,
  application_prefix text not null default 'ADM',
  application_fee numeric(12,2) not null default 0,
  currency text not null default 'PKR',
  require_test boolean not null default false,
  require_interview boolean not null default false,
  payment_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institution_members (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','admissions','reviewer')),
  created_at timestamptz not null default now(),
  primary key (institution_id,user_id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  applicant_user_id uuid references auth.users(id) on delete set null,
  application_no text not null,
  status text not null default 'Submitted',
  applicant_name text not null,
  father_name text,
  cnic text,
  dob date,
  gender text,
  phone text,
  email text,
  address text,
  city text,
  district text,
  program text,
  quota text,
  qualification text,
  previous_institute text,
  obtained_marks numeric,
  total_marks numeric,
  percentage numeric,
  payment_method text,
  fee_status text default 'Unpaid',
  fee_reference text,
  fee_date date,
  test_marks numeric,
  interview_marks numeric,
  academic_weight numeric default 70,
  test_weight numeric default 20,
  interview_weight numeric default 10,
  merit_score numeric,
  admin_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id, application_no)
);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  kind text not null,
  storage_path text not null,
  original_name text,
  mime_type text,
  size_bytes bigint,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  method text not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'PKR',
  status text not null default 'Pending Verification',
  reference text,
  gateway_provider text,
  gateway_transaction_id text,
  proof_storage_path text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.institutions enable row level security;
alter table public.institution_members enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.payment_records enable row level security;

-- Helper: user is staff for an institution.
create or replace function public.is_institution_staff(p_institution_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(
    select 1 from public.institution_members m
    where m.institution_id=p_institution_id and m.user_id=auth.uid()
  ) or exists(
    select 1 from public.institutions i
    where i.id=p_institution_id and i.owner_user_id=auth.uid()
  );
$$;

-- Institution policies
create policy "owners read institutions" on public.institutions
for select to authenticated using (owner_user_id=auth.uid() or public.is_institution_staff(id));
create policy "owners update institutions" on public.institutions
for update to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
create policy "authenticated create institutions" on public.institutions
for insert to authenticated with check (owner_user_id=auth.uid());

-- Membership policies
create policy "members read own institution membership" on public.institution_members
for select to authenticated using (user_id=auth.uid() or public.is_institution_staff(institution_id));
create policy "owners manage members" on public.institution_members
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=institution_id and i.owner_user_id=auth.uid()));

-- Applications: applicant owns their row; staff manage institution rows.
create policy "applicant insert own application" on public.applications
for insert to authenticated with check (applicant_user_id=auth.uid());
create policy "applicant or staff read applications" on public.applications
for select to authenticated using (applicant_user_id=auth.uid() or public.is_institution_staff(institution_id));
create policy "applicant update draft or staff update" on public.applications
for update to authenticated
using (public.is_institution_staff(institution_id) or (applicant_user_id=auth.uid() and status='Draft'))
with check (public.is_institution_staff(institution_id) or applicant_user_id=auth.uid());
create policy "staff delete applications" on public.applications
for delete to authenticated using (public.is_institution_staff(institution_id));

-- Documents inherit application access.
create policy "application users read docs" on public.application_documents
for select to authenticated using (
  exists(select 1 from public.applications a where a.id=application_id and (a.applicant_user_id=auth.uid() or public.is_institution_staff(a.institution_id)))
);
create policy "applicant or staff upload docs" on public.application_documents
for insert to authenticated with check (
  uploaded_by=auth.uid() and exists(select 1 from public.applications a where a.id=application_id and (a.applicant_user_id=auth.uid() or public.is_institution_staff(a.institution_id)))
);
create policy "staff manage docs" on public.application_documents
for update to authenticated using (
  exists(select 1 from public.applications a where a.id=application_id and public.is_institution_staff(a.institution_id))
);
create policy "staff delete docs" on public.application_documents
for delete to authenticated using (
  exists(select 1 from public.applications a where a.id=application_id and public.is_institution_staff(a.institution_id))
);

-- Payments inherit application access.
create policy "application users read payments" on public.payment_records
for select to authenticated using (
  exists(select 1 from public.applications a where a.id=application_id and (a.applicant_user_id=auth.uid() or public.is_institution_staff(a.institution_id)))
);
create policy "applicant create payment record" on public.payment_records
for insert to authenticated with check (
  exists(select 1 from public.applications a where a.id=application_id and a.applicant_user_id=auth.uid())
);
create policy "staff update payments" on public.payment_records
for update to authenticated using (
  exists(select 1 from public.applications a where a.id=application_id and public.is_institution_staff(a.institution_id))
);

-- Storage bucket must be created once in Dashboard or via SQL.
insert into storage.buckets (id,name,public)
values ('admission-documents','admission-documents',false)
on conflict (id) do nothing;

-- Storage path convention: institution_id/application_id/filename
create policy "users upload admission documents" on storage.objects
for insert to authenticated with check (
  bucket_id='admission-documents'
);
create policy "authenticated read admission documents" on storage.objects
for select to authenticated using (
  bucket_id='admission-documents'
);

-- IMPORTANT: before production, tighten storage policies to validate institution/application
-- ownership from the object path or route all document access through an Edge Function.


-- Audit log for staff/application actions.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;

create policy "staff read audit logs" on public.audit_logs
for select to authenticated using (public.is_institution_staff(institution_id));

create policy "authenticated insert audit logs" on public.audit_logs
for insert to authenticated with check (
  user_id=auth.uid() and public.is_institution_staff(institution_id)
);

-- Tighten storage access using path convention:
-- institution_id/application_id/filename
drop policy if exists "users upload admission documents" on storage.objects;
drop policy if exists "authenticated read admission documents" on storage.objects;

create policy "application owner or staff upload admission documents" on storage.objects
for insert to authenticated with check (
  bucket_id='admission-documents'
  and exists (
    select 1
    from public.applications a
    where a.id = (storage.foldername(name))[2]::uuid
      and a.institution_id::text = (storage.foldername(name))[1]
      and (a.applicant_user_id=auth.uid() or public.is_institution_staff(a.institution_id))
  )
);

create policy "application owner or staff read admission documents" on storage.objects
for select to authenticated using (
  bucket_id='admission-documents'
  and exists (
    select 1
    from public.applications a
    where a.id = (storage.foldername(name))[2]::uuid
      and a.institution_id::text = (storage.foldername(name))[1]
      and (a.applicant_user_id=auth.uid() or public.is_institution_staff(a.institution_id))
  )
);

create policy "staff delete admission documents" on storage.objects
for delete to authenticated using (
  bucket_id='admission-documents'
  and exists (
    select 1
    from public.applications a
    where a.id = (storage.foldername(name))[2]::uuid
      and a.institution_id::text = (storage.foldername(name))[1]
      and public.is_institution_staff(a.institution_id)
  )
);
