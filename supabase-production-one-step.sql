-- EduNizam Production One-Step Supabase Migration
-- Fresh project setup: paste this entire file into Supabase SQL Editor and run once.
-- Includes core school data, admissions, role access, communication, invites,
-- student linking, teacher assignments, notifications, storage policies and health checks.


-- =========================================================
-- SOURCE: supabase-full-schema.sql
-- =========================================================

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


-- =========================================================
-- SOURCE: supabase-communication-migration.sql
-- =========================================================

-- EduNizam Communication / Google Meet module
-- Apply after supabase-full-schema.sql.

begin;

create table if not exists public.communication_meetings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_by_role text not null check (created_by_role in ('teacher','head_of_institute')),
  participant_user_id uuid references auth.users(id) on delete set null,
  participant_role text not null check (participant_role in ('student','parent')),
  student_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  scheduled_for timestamptz not null,
  meet_url text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communication_meetings_institution_idx on public.communication_meetings(institution_id,scheduled_for);
create index if not exists communication_meetings_participant_idx on public.communication_meetings(participant_user_id,scheduled_for);

alter table public.communication_meetings enable row level security;

drop policy if exists "staff manage communication meetings" on public.communication_meetings;
drop policy if exists "heads manage communication meetings" on public.communication_meetings;
drop policy if exists "teachers manage own student meetings" on public.communication_meetings;

create policy "heads manage communication meetings" on public.communication_meetings
for all to authenticated
using (
  public.current_account_role()='head_of_institute'
  and exists(
    select 1 from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=auth.uid()
  )
)
with check (
  public.current_account_role()='head_of_institute'
  and created_by=auth.uid()
  and created_by_role='head_of_institute'
  and participant_role='parent'
  and exists(
    select 1 from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=auth.uid()
  )
);

create policy "teachers manage own student meetings" on public.communication_meetings
for all to authenticated
using (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=communication_meetings.institution_id
      and m.user_id=auth.uid()
      and m.role='teacher'
  )
)
with check (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=communication_meetings.institution_id
      and m.user_id=auth.uid()
      and m.role='teacher'
  )
);

drop policy if exists "participants read own communication meetings" on public.communication_meetings;
create policy "participants read own communication meetings" on public.communication_meetings
for select to authenticated
using (
  (participant_role='student' and student_user_id=auth.uid())
  or (participant_role='parent' and participant_user_id=auth.uid())
  or (
    participant_role='parent'
    and exists(
      select 1 from public.parent_student_links l
      where l.parent_user_id=auth.uid()
        and l.student_user_id=communication_meetings.student_user_id
        and l.status='approved'
    )
  )
);

commit;


-- =========================================================
-- SOURCE: supabase-role-invites-migration.sql
-- =========================================================

-- EduNizam role invite + easy parent linking migration
-- Apply after supabase-full-schema.sql.

begin;

create table if not exists public.institution_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  code text not null unique,
  target_role text not null check (target_role in ('teacher','student','parent')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.institution_invites enable row level security;

drop policy if exists "staff manage institution invites" on public.institution_invites;
create policy "staff manage institution invites" on public.institution_invites
for all to authenticated
using (public.is_institution_staff(institution_id))
with check (public.is_institution_staff(institution_id));

create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.institution_invites%rowtype;
  inst_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into inv
  from public.institution_invites
  where upper(code)=upper(trim(p_code))
    and active=true
    and (expires_at is null or expires_at > now())
    and use_count < max_uses
  for update;

  if inv.id is null then raise exception 'Invite code is invalid, expired, or already used'; end if;

  select name into inst_name from public.institutions where id=inv.institution_id;

  if inv.target_role='teacher' then
    insert into public.institution_members(institution_id,user_id,role)
    values(inv.institution_id,auth.uid(),'teacher')
    on conflict (institution_id,user_id) do update set role='teacher';
  else
    insert into public.user_profiles(user_id,account_role,institution_id)
    values(auth.uid(),inv.target_role,inv.institution_id)
    on conflict (user_id) do update
      set account_role=excluded.account_role,
          institution_id=excluded.institution_id,
          updated_at=now();
  end if;

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  return query select inv.institution_id,inst_name,inv.target_role;
end;
$$;

create or replace function public.request_parent_link_by_student_code(p_student_code text)
returns public.parent_student_links
language plpgsql
security definer
set search_path=public
as $$
declare
  profile_role text;
  student_row public.core_students%rowtype;
  result_row public.parent_student_links%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select account_role into profile_role from public.user_profiles where user_id=auth.uid();
  if profile_role <> 'parent' then raise exception 'Parent account required'; end if;

  select * into student_row
  from public.core_students
  where upper(student_code)=upper(trim(p_student_code))
    and auth_user_id is not null
  limit 1;

  if student_row.id is null then raise exception 'Student code not found or student account is not linked yet'; end if;

  insert into public.parent_student_links(parent_user_id,student_user_id,institution_id,status)
  values(auth.uid(),student_row.auth_user_id,student_row.institution_id,'pending')
  on conflict (parent_user_id,student_user_id)
  do update set institution_id=excluded.institution_id,status='pending'
  returning * into result_row;

  return result_row;
end;
$$;

grant execute on function public.claim_institution_invite(text) to authenticated;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;

commit;


-- =========================================================
-- SOURCE: supabase-academic-access-migration.sql
-- =========================================================

-- EduNizam academic identity, teacher assignment and notifications
-- Apply after supabase-full-schema.sql and supabase-role-invites-migration.sql.

begin;

-- Keep staff profile aligned with claimed invite role.
create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.institution_invites%rowtype;
  inst_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into inv
  from public.institution_invites
  where upper(code)=upper(trim(p_code))
    and active=true
    and (expires_at is null or expires_at > now())
    and use_count < max_uses
  for update;

  if inv.id is null then raise exception 'Invite code is invalid, expired, or already used'; end if;
  select name into inst_name from public.institutions where id=inv.institution_id;

  if inv.target_role='teacher' then
    insert into public.institution_members(institution_id,user_id,role)
    values(inv.institution_id,auth.uid(),'teacher')
    on conflict (institution_id,user_id) do update set role='teacher';

    insert into public.user_profiles(user_id,account_role,institution_id)
    values(auth.uid(),'teacher',inv.institution_id)
    on conflict (user_id) do update
      set account_role='teacher',institution_id=excluded.institution_id,updated_at=now();
  else
    insert into public.user_profiles(user_id,account_role,institution_id)
    values(auth.uid(),inv.target_role,inv.institution_id)
    on conflict (user_id) do update
      set account_role=excluded.account_role,institution_id=excluded.institution_id,updated_at=now();
  end if;

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  return query select inv.institution_id,inst_name,inv.target_role;
end;
$$;

-- Student links their authenticated account to the school's existing student record.
create or replace function public.claim_student_record(p_student_code text)
returns table(student_id uuid, institution_id uuid, student_name text, class_name text, student_code text)
language plpgsql
security definer
set search_path=public
as $$
declare
  profile public.user_profiles%rowtype;
  s public.core_students%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into profile from public.user_profiles where user_id=auth.uid();
  if profile.account_role <> 'student' then raise exception 'Student account required'; end if;

  select * into s
  from public.core_students
  where upper(core_students.student_code)=upper(trim(p_student_code))
    and (profile.institution_id is null or core_students.institution_id=profile.institution_id)
  limit 1
  for update;

  if s.id is null then raise exception 'Student code not found in your institute'; end if;
  if s.auth_user_id is not null and s.auth_user_id <> auth.uid() then
    raise exception 'This student record is already linked to another account';
  end if;

  update public.core_students
  set auth_user_id=auth.uid(),updated_at=now()
  where id=s.id;

  update public.user_profiles
  set institution_id=s.institution_id,updated_at=now()
  where user_id=auth.uid();

  return query select s.id,s.institution_id,s.name,s.class_name,s.student_code;
end;
$$;
grant execute on function public.claim_student_record(text) to authenticated;

create table if not exists public.teacher_student_links (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (teacher_user_id,student_user_id)
);
alter table public.teacher_student_links enable row level security;

drop policy if exists "head manage teacher student links" on public.teacher_student_links;
create policy "head manage teacher student links" on public.teacher_student_links
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "teacher read own assignments" on public.teacher_student_links;
create policy "teacher read own assignments" on public.teacher_student_links
for select to authenticated using (teacher_user_id=auth.uid());

-- Tighten Teacher–Student communication after teacher_student_links exists.
drop policy if exists "teachers manage own student meetings" on public.communication_meetings;
create policy "teachers manage own student meetings" on public.communication_meetings
for all to authenticated
using (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=communication_meetings.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=communication_meetings.student_user_id
  )
)
with check (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=communication_meetings.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=communication_meetings.student_user_id
  )
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  category text not null default 'general',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.user_notifications enable row level security;

create index if not exists user_notifications_recipient_idx
on public.user_notifications(recipient_user_id,created_at desc);

drop policy if exists "users read own notifications" on public.user_notifications;
create policy "users read own notifications" on public.user_notifications
for select to authenticated using (recipient_user_id=auth.uid());

drop policy if exists "users mark own notifications" on public.user_notifications;
create policy "users mark own notifications" on public.user_notifications
for update to authenticated using (recipient_user_id=auth.uid())
with check (recipient_user_id=auth.uid());

drop policy if exists "staff create institution notifications" on public.user_notifications;
create policy "staff create institution notifications" on public.user_notifications
for insert to authenticated with check (
  created_by=auth.uid()
  and public.is_institution_staff(institution_id)
);

commit;




-- =========================================================
-- EduNizam AI Usage Controls
-- =========================================================
begin;

create table if not exists public.ai_usage_logs (
  id bigint generated always as identity primary key,
  institution_id uuid references public.institutions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  request_chars integer not null default 0 check (request_chars >= 0),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_created_idx
on public.ai_usage_logs(user_id,created_at desc);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "users read own ai usage" on public.ai_usage_logs;
create policy "users read own ai usage" on public.ai_usage_logs
for select to authenticated using (user_id=auth.uid());

create or replace function public.edunizam_ai_health_check()
returns jsonb
language sql
stable
security definer
set search_path=public
as $
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'usage_table', to_regclass('public.ai_usage_logs') is not null
  );
$;

grant execute on function public.edunizam_ai_health_check() to authenticated;

commit;

-- =========================================================
-- EduNizam School Work Center
-- =========================================================
begin;

create table if not exists public.school_announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null default 'all' check (audience in ('all','students','parents','teachers')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.school_announcements enable row level security;

create table if not exists public.homework_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  subject text not null,
  title text not null,
  details text,
  due_date date,
  created_at timestamptz not null default now()
);
alter table public.homework_items enable row level security;

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  weekday text not null,
  start_time time,
  subject text not null,
  teacher_name text,
  created_at timestamptz not null default now()
);
alter table public.timetable_entries enable row level security;

create or replace function public.is_institution_user(target uuid)
returns boolean
language sql stable security definer set search_path=public
as $
  select exists(select 1 from public.institutions i where i.id=target and i.owner_user_id=auth.uid())
  or exists(select 1 from public.institution_members m where m.institution_id=target and m.user_id=auth.uid())
  or exists(select 1 from public.user_profiles p where p.institution_id=target and p.user_id=auth.uid());
$;

grant execute on function public.is_institution_user(uuid) to authenticated;

drop policy if exists "institution users read announcements" on public.school_announcements;
create policy "institution users read announcements" on public.school_announcements for select to authenticated using (public.is_institution_user(institution_id));
drop policy if exists "staff manage announcements" on public.school_announcements;
create policy "staff manage announcements" on public.school_announcements for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_announcements.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=school_announcements.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

drop policy if exists "institution users read homework" on public.homework_items;
create policy "institution users read homework" on public.homework_items for select to authenticated using (public.is_institution_user(institution_id));
drop policy if exists "staff manage homework" on public.homework_items;
create policy "staff manage homework" on public.homework_items for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=homework_items.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=homework_items.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

drop policy if exists "institution users read timetable" on public.timetable_entries;
create policy "institution users read timetable" on public.timetable_entries for select to authenticated using (public.is_institution_user(institution_id));
drop policy if exists "staff manage timetable" on public.timetable_entries;
create policy "staff manage timetable" on public.timetable_entries for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=timetable_entries.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=timetable_entries.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

commit;


-- =========================================================
-- EduNizam Leave Requests
-- =========================================================
begin;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  local_student_id bigint,
  student_name text not null,
  class_name text,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  requester_role text not null check (requester_role in ('student','parent')),
  from_date date not null,
  to_date date not null,
  reason text not null,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_date >= from_date)
);

create index if not exists leave_requests_institution_status_idx on public.leave_requests(institution_id,status,created_at desc);
alter table public.leave_requests enable row level security;

drop policy if exists "requesters read linked leave requests" on public.leave_requests;
create policy "requesters read linked leave requests" on public.leave_requests for select to authenticated
using (
  student_user_id=auth.uid()
  or submitted_by=auth.uid()
  or exists(
    select 1 from public.parent_student_links l
    where l.institution_id=leave_requests.institution_id
      and l.parent_user_id=auth.uid()
      and l.student_user_id=leave_requests.student_user_id
      and l.status='approved'
  )
);

drop policy if exists "students submit own leave" on public.leave_requests;
create policy "students submit own leave" on public.leave_requests for insert to authenticated
with check (
  requester_role='student'
  and submitted_by=auth.uid()
  and student_user_id=auth.uid()
  and public.is_institution_user(institution_id)
);

drop policy if exists "parents submit linked student leave" on public.leave_requests;
create policy "parents submit linked student leave" on public.leave_requests for insert to authenticated
with check (
  requester_role='parent'
  and submitted_by=auth.uid()
  and exists(
    select 1 from public.parent_student_links l
    where l.institution_id=leave_requests.institution_id
      and l.parent_user_id=auth.uid()
      and l.student_user_id=leave_requests.student_user_id
      and l.status='approved'
  )
);

drop policy if exists "heads manage institute leave" on public.leave_requests;
create policy "heads manage institute leave" on public.leave_requests for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=leave_requests.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=leave_requests.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "teachers manage assigned leave" on public.leave_requests;
create policy "teachers manage assigned leave" on public.leave_requests for select to authenticated
using (
  public.current_account_role()='teacher'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=leave_requests.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=leave_requests.student_user_id
  )
);

drop policy if exists "teachers decide assigned leave" on public.leave_requests;
create policy "teachers decide assigned leave" on public.leave_requests for update to authenticated
using (
  public.current_account_role()='teacher'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=leave_requests.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=leave_requests.student_user_id
  )
)
with check (
  public.current_account_role()='teacher'
  and status in ('Approved','Rejected')
  and decided_by=auth.uid()
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=leave_requests.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=leave_requests.student_user_id
  )
);

commit;


-- =========================================================
-- EduNizam Exam Schedule
-- =========================================================
begin;

create table if not exists public.exam_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  exam_name text not null,
  subject text not null,
  exam_date date not null,
  start_time time,
  total_marks numeric(10,2) not null default 100 check (total_marks > 0),
  created_at timestamptz not null default now()
);

create index if not exists exam_schedule_institution_date_idx on public.exam_schedule_entries(institution_id,exam_date);
alter table public.exam_schedule_entries enable row level security;

create or replace function public.is_institution_user(target uuid)
returns boolean
language sql stable security definer set search_path=public
as $
  select exists(select 1 from public.institutions i where i.id=target and i.owner_user_id=auth.uid())
  or exists(select 1 from public.institution_members m where m.institution_id=target and m.user_id=auth.uid())
  or exists(select 1 from public.user_profiles p where p.institution_id=target and p.user_id=auth.uid());
$;
grant execute on function public.is_institution_user(uuid) to authenticated;

drop policy if exists "institution users read exam schedule" on public.exam_schedule_entries;
create policy "institution users read exam schedule" on public.exam_schedule_entries for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "staff manage exam schedule" on public.exam_schedule_entries;
create policy "staff manage exam schedule" on public.exam_schedule_entries for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=exam_schedule_entries.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=exam_schedule_entries.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

commit;


-- =========================================================
-- EduNizam Staff & Teacher Profiles
-- =========================================================
begin;

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  staff_code text not null,
  full_name text not null,
  designation text not null default 'Teacher',
  phone text,
  subjects text[] not null default '{}'::text[],
  classes text[] not null default '{}'::text[],
  joining_date date,
  employment_status text not null default 'active' check (employment_status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id,staff_code)
);

create unique index if not exists staff_profiles_linked_user_idx
on public.staff_profiles(institution_id,user_id)
where user_id is not null;

alter table public.staff_profiles enable row level security;

drop policy if exists "head manage staff profiles" on public.staff_profiles;
create policy "head manage staff profiles" on public.staff_profiles
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=staff_profiles.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=staff_profiles.institution_id and i.owner_user_id=auth.uid())
  and (
    user_id is null
    or exists(
      select 1 from public.institution_members m
      where m.institution_id=staff_profiles.institution_id
        and m.user_id=staff_profiles.user_id
        and m.role='teacher'
    )
  )
);

drop policy if exists "teachers read own staff profile" on public.staff_profiles;
create policy "teachers read own staff profile" on public.staff_profiles
for select to authenticated
using (user_id=auth.uid());

commit;


-- =========================================================
-- EduNizam Production Health Check
-- =========================================================
begin;

create or replace function public.edunizam_health_check()
returns jsonb
language sql
stable
security definer
set search_path=public,storage
as $$
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'tables', jsonb_build_object(
      'institutions', to_regclass('public.institutions') is not null,
      'institution_members', to_regclass('public.institution_members') is not null,
      'user_profiles', to_regclass('public.user_profiles') is not null,
      'parent_student_links', to_regclass('public.parent_student_links') is not null,
      'core_students', to_regclass('public.core_students') is not null,
      'attendance_records', to_regclass('public.attendance_records') is not null,
      'fee_records', to_regclass('public.fee_records') is not null,
      'result_records', to_regclass('public.result_records') is not null,
      'applications', to_regclass('public.applications') is not null,
      'communication_meetings', to_regclass('public.communication_meetings') is not null,
      'institution_invites', to_regclass('public.institution_invites') is not null,
      'teacher_student_links', to_regclass('public.teacher_student_links') is not null,
      'user_notifications', to_regclass('public.user_notifications') is not null,
      'ai_usage_logs', to_regclass('public.ai_usage_logs') is not null,
      'school_announcements', to_regclass('public.school_announcements') is not null,
      'homework_items', to_regclass('public.homework_items') is not null,
      'timetable_entries', to_regclass('public.timetable_entries') is not null,
      'leave_requests', to_regclass('public.leave_requests') is not null,
      'exam_schedule_entries', to_regclass('public.exam_schedule_entries') is not null,
      'staff_profiles', to_regclass('public.staff_profiles') is not null
    ),
    'functions', jsonb_build_object(
      'current_account_role', to_regprocedure('public.current_account_role()') is not null,
      'claim_institution_invite', to_regprocedure('public.claim_institution_invite(text)') is not null,
      'request_parent_link_by_student_code', to_regprocedure('public.request_parent_link_by_student_code(text)') is not null,
      'claim_student_record', to_regprocedure('public.claim_student_record(text)') is not null,
      'edunizam_ai_health_check', to_regprocedure('public.edunizam_ai_health_check()') is not null
    ),
    'storage', jsonb_build_object(
      'admission_documents_bucket', exists(select 1 from storage.buckets where id='admission-documents')
    )
  );
$$;

grant execute on function public.edunizam_health_check() to authenticated;

commit;
