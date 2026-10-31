-- EduNizam Full Supabase Migration
-- Apply this file to a fresh Supabase project.
-- It combines admissions/auth/storage-ready schema first, then core school data.

begin;

-- =========================================================
-- 1) Admissions / Auth / Roles / Documents / Payments
-- =========================================================

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
  role text not null check (role in ('teacher','head_of_institute')),
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


-- Four-account role model: Student, Parent, Teacher, Head of Institute.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_role text not null check (account_role in ('student','parent','teacher','head_of_institute')),
  full_name text,
  phone text,
  institution_id uuid references public.institutions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;

create table if not exists public.parent_student_links (
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  primary key (parent_user_id,student_user_id)
);
alter table public.parent_student_links enable row level security;

create or replace function public.current_account_role()
returns text language sql stable security definer set search_path=public
as $$
  select coalesce(
    (select 'head_of_institute' from public.institutions i where i.owner_user_id=auth.uid() limit 1),
    (select m.role from public.institution_members m where m.user_id=auth.uid() order by case when m.role='head_of_institute' then 0 else 1 end limit 1),
    (select p.account_role from public.user_profiles p where p.user_id=auth.uid()),
    'student'
  );
$$;

-- Create student/parent profile from safe signup metadata.
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
declare requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'account_role','student');
  if requested_role not in ('student','parent') then requested_role := 'student'; end if;
  insert into public.user_profiles(user_id,account_role,full_name)
  values(new.id,requested_role,new.raw_user_meta_data->>'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_edunizam on auth.users;
create trigger on_auth_user_created_edunizam
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create policy "users read own profile" on public.user_profiles
for select to authenticated using (
  user_id=auth.uid()
  or (institution_id is not null and public.is_institution_staff(institution_id))
  or exists (
    select 1 from public.parent_student_links l
    where l.status='approved'
      and ((l.parent_user_id=auth.uid() and l.student_user_id=user_id)
        or (l.student_user_id=auth.uid() and l.parent_user_id=user_id))
  )
);
create policy "users update own basic profile" on public.user_profiles
for update to authenticated using (user_id=auth.uid())
with check (user_id=auth.uid() and account_role in ('student','parent'));
create policy "staff manage institution profiles" on public.user_profiles
for all to authenticated
using (institution_id is not null and public.is_institution_staff(institution_id))
with check (institution_id is not null and public.is_institution_staff(institution_id));

create policy "parent/student read own links" on public.parent_student_links
for select to authenticated using (
  parent_user_id=auth.uid() or student_user_id=auth.uid()
  or (institution_id is not null and public.is_institution_staff(institution_id))
);
create policy "parent requests child link" on public.parent_student_links
for insert to authenticated with check (parent_user_id=auth.uid());
create policy "staff approve child links" on public.parent_student_links
for update to authenticated
using (institution_id is not null and public.is_institution_staff(institution_id))
with check (institution_id is not null and public.is_institution_staff(institution_id));

-- Parent can read approved linked student's applications.
create policy "parent read linked student applications" on public.applications
for select to authenticated using (
  exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id=auth.uid()
      and l.student_user_id=applications.applicant_user_id
      and l.status='approved'
  )
);

-- Teacher/head permissions are derived from institution membership/ownership.
-- Students and parents never gain staff privileges from a client-side role selector.


-- =========================================================
-- 2) Core School Data
-- Students / Attendance / Fees / Results / Practice / Remarks
-- =========================================================

-- EduNizam Core School Data Schema (Supabase/Postgres)
-- Prerequisite: apply supabase-admissions-schema.sql first because this schema
-- reuses institutions, parent_student_links and public.is_institution_staff().

create table if not exists public.institution_settings (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  school_name text not null default 'My School',
  school_type text not null default 'School',
  tagline text,
  academic_session text,
  phone text,
  address text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.core_students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  local_id bigint,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  guardian_name text,
  class_name text,
  phone text,
  roll_no text,
  student_code text,
  admission_application_id text,
  admission_date date,
  fee_snapshot jsonb,
  source text default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id, local_id)
);

create index if not exists core_students_auth_user_idx on public.core_students(auth_user_id);
create index if not exists core_students_institution_idx on public.core_students(institution_id);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Leave','Late')),
  marked_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(student_id, attendance_date)
);

create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  local_id bigint,
  student_id uuid not null references public.core_students(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  status text not null default 'Pending',
  fee_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id, local_id)
);

create table if not exists public.result_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  local_id bigint,
  student_id uuid not null references public.core_students(id) on delete cascade,
  subject text not null,
  marks numeric not null default 0,
  total numeric not null default 0,
  assessment_date date,
  assessment_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id, local_id)
);

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  local_attempt_id bigint,
  student_id uuid not null references public.core_students(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  config jsonb not null default '{}'::jsonb,
  question_ids jsonb not null default '[]'::jsonb,
  auto_total integer not null default 0,
  auto_correct integer not null default 0,
  percentage numeric not null default 0,
  weak_topics jsonb not null default '[]'::jsonb,
  details jsonb not null default '[]'::jsonb,
  unique(institution_id, local_attempt_id)
);

create table if not exists public.student_remarks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  remark text not null,
  teacher_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(student_id)
);

alter table public.institution_settings enable row level security;
alter table public.core_students enable row level security;
alter table public.attendance_records enable row level security;
alter table public.fee_records enable row level security;
alter table public.result_records enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.student_remarks enable row level security;

create or replace function public.can_access_core_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.core_students s
    where s.id=target_student
      and (
        public.is_institution_staff(s.institution_id)
        or s.auth_user_id=auth.uid()
        or exists (
          select 1
          from public.parent_student_links l
          where l.parent_user_id=auth.uid()
            and l.student_user_id=s.auth_user_id
            and l.status='approved'
        )
      )
  );
$$;

drop policy if exists "staff manage institution settings" on public.institution_settings;
create policy "staff manage institution settings" on public.institution_settings
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

drop policy if exists "members read institution settings" on public.institution_settings;
create policy "members read institution settings" on public.institution_settings
for select to authenticated
using (
  public.is_institution_staff(institution_id)
  or exists(select 1 from public.core_students s where s.institution_id=institution_settings.institution_id and s.auth_user_id=auth.uid())
  or exists(
    select 1 from public.parent_student_links l
    join public.core_students s on s.auth_user_id=l.student_user_id
    where l.parent_user_id=auth.uid() and l.status='approved' and s.institution_id=institution_settings.institution_id
  )
);

drop policy if exists "staff manage students" on public.core_students;
create policy "staff manage students" on public.core_students
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

drop policy if exists "users read accessible students" on public.core_students;
create policy "users read accessible students" on public.core_students
for select to authenticated
using (
  public.is_institution_staff(institution_id)
  or auth_user_id=auth.uid()
  or exists (
    select 1 from public.parent_student_links l
    where l.parent_user_id=auth.uid()
      and l.student_user_id=core_students.auth_user_id
      and l.status='approved'
  )
);

drop policy if exists "staff manage attendance" on public.attendance_records;
create policy "staff manage attendance" on public.attendance_records
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

drop policy if exists "users read accessible attendance" on public.attendance_records;
create policy "users read accessible attendance" on public.attendance_records
for select to authenticated using (public.can_access_core_student(student_id));

drop policy if exists "staff manage fees" on public.fee_records;
create policy "staff manage fees" on public.fee_records
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

drop policy if exists "users read accessible fees" on public.fee_records;
create policy "users read accessible fees" on public.fee_records
for select to authenticated using (public.can_access_core_student(student_id));

drop policy if exists "staff manage results" on public.result_records;
create policy "staff manage results" on public.result_records
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

drop policy if exists "users read accessible results" on public.result_records;
create policy "users read accessible results" on public.result_records
for select to authenticated using (public.can_access_core_student(student_id));

drop policy if exists "users manage accessible practice attempts" on public.practice_attempts;
create policy "users manage accessible practice attempts" on public.practice_attempts
for all to authenticated
using (public.can_access_core_student(student_id))
with check (public.can_access_core_student(student_id));

drop policy if exists "staff manage remarks" on public.student_remarks;
create policy "staff manage remarks" on public.student_remarks
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

drop policy if exists "users read accessible remarks" on public.student_remarks;
create policy "users read accessible remarks" on public.student_remarks
for select to authenticated using (public.can_access_core_student(student_id));


commit;
