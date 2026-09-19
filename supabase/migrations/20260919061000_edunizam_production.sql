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
-- EduNizam SaaS Owner & Subscription Management
-- =========================================================
begin;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $
  select auth.uid() is not null
    and exists(select 1 from public.platform_admins p where p.user_id=auth.uid());
$;

grant execute on function public.is_platform_admin() to authenticated;

drop policy if exists "platform admins read admin list" on public.platform_admins;
create policy "platform admins read admin list" on public.platform_admins
for select to authenticated
using (public.is_platform_admin());

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_pkr numeric(12,2) not null default 0 check (monthly_price_pkr >= 0),
  trial_days integer not null default 0 check (trial_days >= 0),
  max_students integer check (max_students is null or max_students > 0),
  max_staff integer check (max_staff is null or max_staff > 0),
  ai_daily_limit integer check (ai_daily_limit is null or ai_daily_limit >= 0),
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

drop policy if exists "authenticated read subscription plans" on public.subscription_plans;
create policy "authenticated read subscription plans" on public.subscription_plans
for select to authenticated using (true);

drop policy if exists "platform admins manage subscription plans" on public.subscription_plans;
create policy "platform admins manage subscription plans" on public.subscription_plans
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into public.subscription_plans(code,name,monthly_price_pkr,trial_days,features,active)
values('free','Free',0,0,'[]'::jsonb,true)
on conflict (code) do nothing;

create table if not exists public.institution_subscriptions (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active'
    check (status in ('trialing','active','past_due','suspended','cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institution_subscriptions enable row level security;

drop policy if exists "platform admins manage institution subscriptions" on public.institution_subscriptions;
create policy "platform admins manage institution subscriptions" on public.institution_subscriptions
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "heads read own subscription" on public.institution_subscriptions;
create policy "heads read own subscription" on public.institution_subscriptions
for select to authenticated
using (
  exists(
    select 1 from public.institutions i
    where i.id=institution_subscriptions.institution_id
      and i.owner_user_id=auth.uid()
  )
);

create or replace function public.assign_default_subscription()
returns trigger
language plpgsql
security definer
set search_path=public
as $
declare
  free_plan uuid;
begin
  select id into free_plan from public.subscription_plans where code='free' limit 1;
  if free_plan is not null then
    insert into public.institution_subscriptions(institution_id,plan_id,status)
    values(new.id,free_plan,'active')
    on conflict (institution_id) do nothing;
  end if;
  return new;
end;
$;

drop trigger if exists trg_assign_default_subscription on public.institutions;
create trigger trg_assign_default_subscription
after insert on public.institutions
for each row execute function public.assign_default_subscription();

insert into public.institution_subscriptions(institution_id,plan_id,status)
select i.id,p.id,'active'
from public.institutions i
cross join public.subscription_plans p
where p.code='free'
  and not exists(
    select 1 from public.institution_subscriptions s where s.institution_id=i.id
  )
on conflict (institution_id) do nothing;

create or replace function public.platform_owner_institutions()
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  institution_created_at timestamptz,
  student_count bigint,
  staff_count bigint,
  plan_id uuid,
  plan_code text,
  plan_name text,
  monthly_price_pkr numeric,
  subscription_status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access required';
  end if;

  return query
  select
    i.id,
    i.name,
    i.institution_type,
    i.created_at,
    (select count(*) from public.core_students cs where cs.institution_id=i.id),
    (select count(*) from public.staff_profiles sp where sp.institution_id=i.id),
    p.id,
    p.code,
    p.name,
    p.monthly_price_pkr,
    coalesce(s.status,'active'),
    s.trial_ends_at,
    s.current_period_end
  from public.institutions i
  left join public.institution_subscriptions s on s.institution_id=i.id
  left join public.subscription_plans p on p.id=s.plan_id
  order by i.created_at desc;
end;
$;

grant execute on function public.platform_owner_institutions() to authenticated;

commit;


-- =========================================================
-- EduNizam Monthly Fee Challans & Receipts
-- =========================================================
begin;

alter table public.fee_records add column if not exists fee_month text;
alter table public.fee_records add column if not exists base_amount numeric(12,2);
alter table public.fee_records add column if not exists discount numeric(12,2) not null default 0;
alter table public.fee_records add column if not exists arrears numeric(12,2) not null default 0;
alter table public.fee_records add column if not exists due_date date;
alter table public.fee_records add column if not exists challan_no text;
alter table public.fee_records add column if not exists receipt_no text;
alter table public.fee_records add column if not exists payment_reference text;
alter table public.fee_records add column if not exists paid_at timestamptz;

create unique index if not exists fee_records_student_month_idx
on public.fee_records(institution_id,student_id,fee_month)
where fee_month is not null;

create unique index if not exists fee_records_challan_no_idx
on public.fee_records(challan_no)
where challan_no is not null;

create unique index if not exists fee_records_receipt_no_idx
on public.fee_records(receipt_no)
where receipt_no is not null;

create table if not exists public.class_fee_structure (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (institution_id,class_name)
);

alter table public.class_fee_structure enable row level security;

drop policy if exists "institution users read class fees" on public.class_fee_structure;
create policy "institution users read class fees" on public.class_fee_structure
for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "heads manage class fees" on public.class_fee_structure;
create policy "heads manage class fees" on public.class_fee_structure
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=class_fee_structure.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=class_fee_structure.institution_id and i.owner_user_id=auth.uid())
);

commit;


-- =========================================================
-- EduNizam Class & Section Management
-- =========================================================
begin;

alter table public.core_students add column if not exists section_name text;

create table if not exists public.class_sections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  section_name text not null,
  class_teacher_user_id uuid references auth.users(id) on delete set null,
  class_teacher_name text,
  room_label text,
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id,class_name,section_name)
);

alter table public.class_sections enable row level security;

drop policy if exists "institution users read class sections" on public.class_sections;
create policy "institution users read class sections" on public.class_sections
for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "heads manage class sections" on public.class_sections;
create policy "heads manage class sections" on public.class_sections
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=class_sections.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=class_sections.institution_id and i.owner_user_id=auth.uid())
  and (
    class_teacher_user_id is null
    or exists(
      select 1 from public.institution_members m
      where m.institution_id=class_sections.institution_id
        and m.user_id=class_sections.class_teacher_user_id
        and m.role='teacher'
    )
  )
);

commit;


-- =========================================================
-- EduNizam Staff Attendance & Payroll
-- =========================================================
begin;

create table if not exists public.staff_salary_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  base_salary numeric(12,2) not null default 0 check (base_salary >= 0),
  default_allowance numeric(12,2) not null default 0 check (default_allowance >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_profile_id)
);
alter table public.staff_salary_profiles enable row level security;

create table if not exists public.staff_attendance_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('Present','Absent','Leave','Half Day')),
  note text,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_profile_id,attendance_date)
);
alter table public.staff_attendance_records enable row level security;

create table if not exists public.staff_payroll_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  payroll_month date not null,
  base_salary numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  attendance_deduction numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  net_salary numeric(12,2) not null default 0,
  status text not null default 'Draft' check (status in ('Draft','Paid')),
  payment_reference text,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_profile_id,payroll_month)
);
alter table public.staff_payroll_records enable row level security;

drop policy if exists "heads manage staff salary profiles" on public.staff_salary_profiles;
create policy "heads manage staff salary profiles" on public.staff_salary_profiles for all to authenticated
using (exists(select 1 from public.institutions i where i.id=staff_salary_profiles.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=staff_salary_profiles.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "teachers read own salary profile" on public.staff_salary_profiles;
create policy "teachers read own salary profile" on public.staff_salary_profiles for select to authenticated
using (exists(select 1 from public.staff_profiles s where s.id=staff_salary_profiles.staff_profile_id and s.user_id=auth.uid()));

drop policy if exists "heads manage staff attendance" on public.staff_attendance_records;
create policy "heads manage staff attendance" on public.staff_attendance_records for all to authenticated
using (exists(select 1 from public.institutions i where i.id=staff_attendance_records.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=staff_attendance_records.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "teachers read own attendance" on public.staff_attendance_records;
create policy "teachers read own attendance" on public.staff_attendance_records for select to authenticated
using (exists(select 1 from public.staff_profiles s where s.id=staff_attendance_records.staff_profile_id and s.user_id=auth.uid()));

drop policy if exists "heads manage staff payroll" on public.staff_payroll_records;
create policy "heads manage staff payroll" on public.staff_payroll_records for all to authenticated
using (exists(select 1 from public.institutions i where i.id=staff_payroll_records.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=staff_payroll_records.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "teachers read own payroll" on public.staff_payroll_records;
create policy "teachers read own payroll" on public.staff_payroll_records for select to authenticated
using (exists(select 1 from public.staff_profiles s where s.id=staff_payroll_records.staff_profile_id and s.user_id=auth.uid()));

commit;


-- =========================================================
-- EduNizam Student ID Cards & Certificates
-- =========================================================
begin;

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  document_type text not null check (document_type in ('ID Card','Bonafide Certificate','Enrollment Certificate','Leaving Certificate')),
  document_no text not null,
  issue_date date not null,
  remarks text,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(institution_id,document_no)
);
alter table public.student_documents enable row level security;

drop policy if exists "heads manage student documents" on public.student_documents;
create policy "heads manage student documents" on public.student_documents
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=student_documents.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=student_documents.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "students read own documents" on public.student_documents;
create policy "students read own documents" on public.student_documents
for select to authenticated
using (
  exists(select 1 from public.core_students s where s.id=student_documents.student_id and s.auth_user_id=auth.uid())
);

drop policy if exists "parents read linked student documents" on public.student_documents;
create policy "parents read linked student documents" on public.student_documents
for select to authenticated
using (
  exists(
    select 1
    from public.core_students s
    join public.parent_student_links l
      on l.student_user_id=s.auth_user_id
     and l.parent_user_id=auth.uid()
     and l.status='approved'
    where s.id=student_documents.student_id
      and l.institution_id=student_documents.institution_id
  )
);

commit;


-- =========================================================
-- EduNizam School Finance & Cashbook
-- =========================================================
begin;

create table if not exists public.school_finance_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  entry_type text not null check (entry_type in ('Income','Expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  entry_date date not null,
  reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists school_finance_entries_institution_date_idx
on public.school_finance_entries(institution_id,entry_date desc);

alter table public.school_finance_entries enable row level security;

drop policy if exists "heads manage school finance entries" on public.school_finance_entries;
create policy "heads manage school finance entries" on public.school_finance_entries
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_finance_entries.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=school_finance_entries.institution_id and i.owner_user_id=auth.uid())
);

commit;


-- =========================================================
-- EduNizam School Calendar & Events
-- =========================================================
begin;

create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  creator_role text not null check (creator_role in ('head','teacher')),
  title text not null,
  category text not null check (category in ('Holiday','PTM','Exam','Fee Due','Meeting','Activity','Other')),
  event_date date not null,
  start_time time,
  end_time time,
  audience text not null default 'all' check (audience in ('all','students','parents','staff','class')),
  class_name text,
  section_name text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_calendar_events_institution_date_idx
on public.school_calendar_events(institution_id,event_date);

alter table public.school_calendar_events enable row level security;

create or replace function public.can_read_school_calendar_event(e public.school_calendar_events)
returns boolean
language sql
stable
security definer
set search_path=public
as $
  select
    exists(select 1 from public.institutions i where i.id=e.institution_id and i.owner_user_id=auth.uid())
    or exists(select 1 from public.institution_members m where m.institution_id=e.institution_id and m.user_id=auth.uid())
    or (
      exists(select 1 from public.user_profiles p where p.user_id=auth.uid() and p.institution_id=e.institution_id and p.account_role='student')
      and (
        e.audience in ('all','students')
        or (
          e.audience='class'
          and exists(
            select 1 from public.core_students s
            where s.institution_id=e.institution_id
              and s.auth_user_id=auth.uid()
              and s.class_name=e.class_name
              and (e.section_name is null or e.section_name='' or coalesce(s.section_name,'')=e.section_name)
          )
        )
      )
    )
    or (
      exists(select 1 from public.user_profiles p where p.user_id=auth.uid() and p.institution_id=e.institution_id and p.account_role='parent')
      and (
        e.audience in ('all','parents')
        or (
          e.audience='class'
          and exists(
            select 1
            from public.parent_student_links l
            join public.core_students s on s.auth_user_id=l.student_user_id
            where l.parent_user_id=auth.uid()
              and l.status='approved'
              and l.institution_id=e.institution_id
              and s.institution_id=e.institution_id
              and s.class_name=e.class_name
              and (e.section_name is null or e.section_name='' or coalesce(s.section_name,'')=e.section_name)
          )
        )
      )
    );
$;

grant execute on function public.can_read_school_calendar_event(public.school_calendar_events) to authenticated;

drop policy if exists "institution users read relevant calendar events" on public.school_calendar_events;
create policy "institution users read relevant calendar events" on public.school_calendar_events
for select to authenticated
using (public.can_read_school_calendar_event(school_calendar_events));

drop policy if exists "head manages all calendar events" on public.school_calendar_events;
create policy "head manages all calendar events" on public.school_calendar_events
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_calendar_events.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=school_calendar_events.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "teachers manage own calendar events" on public.school_calendar_events;
create policy "teachers manage own calendar events" on public.school_calendar_events
for all to authenticated
using (
  creator_user_id=auth.uid()
  and creator_role='teacher'
  and public.is_institution_staff(institution_id)
)
with check (
  creator_user_id=auth.uid()
  and creator_role='teacher'
  and public.is_institution_staff(institution_id)
);

commit;


-- =========================================================
-- EduNizam Secure Inbox & Messaging
-- =========================================================
begin;

create table if not exists public.school_conversations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  conversation_type text not null check (conversation_type in ('head-parent','teacher-parent','teacher-student')),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  student_name text,
  participant_a uuid not null references auth.users(id) on delete cascade,
  participant_b uuid not null references auth.users(id) on delete cascade,
  participant_a_label text not null,
  participant_b_label text not null,
  subject text not null default 'General',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_a <> participant_b)
);
create index if not exists school_conversations_participant_a_idx on public.school_conversations(participant_a,updated_at desc);
create index if not exists school_conversations_participant_b_idx on public.school_conversations(participant_b,updated_at desc);
alter table public.school_conversations enable row level security;

create table if not exists public.school_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.school_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists school_messages_conversation_idx on public.school_messages(conversation_id,created_at);
alter table public.school_messages enable row level security;

create or replace function public.is_school_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $
  select exists(
    select 1 from public.school_conversations c
    where c.id=p_conversation_id
      and auth.uid() in (c.participant_a,c.participant_b)
  );
$;
grant execute on function public.is_school_conversation_participant(uuid) to authenticated;

drop policy if exists "participants read school conversations" on public.school_conversations;
create policy "participants read school conversations" on public.school_conversations
for select to authenticated
using (auth.uid() in (participant_a,participant_b));

drop policy if exists "participants read school messages" on public.school_messages;
create policy "participants read school messages" on public.school_messages
for select to authenticated
using (public.is_school_conversation_participant(conversation_id));

create or replace function public.list_message_contacts()
returns table(
  target_user_id uuid,
  target_role text,
  display_name text,
  student_user_id uuid,
  student_name text,
  conversation_type text
)
language plpgsql
stable
security definer
set search_path=public
as $
declare
  r text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  r:=public.current_account_role();

  if r='head_of_institute' then
    return query
    select distinct
      l.parent_user_id,
      'parent'::text,
      coalesce(nullif(p.full_name,''),'Parent / Guardian')::text,
      l.student_user_id,
      s.name::text,
      'head-parent'::text
    from public.institutions i
    join public.parent_student_links l on l.institution_id=i.id and l.status='approved'
    join public.core_students s on s.institution_id=i.id and s.auth_user_id=l.student_user_id
    left join public.user_profiles p on p.user_id=l.parent_user_id
    where i.owner_user_id=auth.uid();

  elsif r='teacher' then
    return query
    select distinct x.target_user_id,x.target_role,x.display_name,x.student_user_id,x.student_name,x.conversation_type
    from (
      select
        tsl.student_user_id as target_user_id,
        'student'::text as target_role,
        coalesce(nullif(sp.full_name,''),s.name,'Student')::text as display_name,
        tsl.student_user_id,
        s.name::text as student_name,
        'teacher-student'::text as conversation_type
      from public.teacher_student_links tsl
      join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      left join public.user_profiles sp on sp.user_id=tsl.student_user_id
      where tsl.teacher_user_id=auth.uid()

      union all

      select
        l.parent_user_id,
        'parent'::text,
        coalesce(nullif(pp.full_name,''),'Parent / Guardian')::text,
        tsl.student_user_id,
        s.name::text,
        'teacher-parent'::text
      from public.teacher_student_links tsl
      join public.parent_student_links l
        on l.institution_id=tsl.institution_id
       and l.student_user_id=tsl.student_user_id
       and l.status='approved'
      join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      left join public.user_profiles pp on pp.user_id=l.parent_user_id
      where tsl.teacher_user_id=auth.uid()
    ) x;

  elsif r='parent' then
    return query
    select distinct x.target_user_id,x.target_role,x.display_name,x.student_user_id,x.student_name,x.conversation_type
    from (
      select
        i.owner_user_id as target_user_id,
        'head'::text as target_role,
        ('Head · '||i.name)::text as display_name,
        l.student_user_id,
        s.name::text as student_name,
        'head-parent'::text as conversation_type
      from public.parent_student_links l
      join public.institutions i on i.id=l.institution_id
      join public.core_students s on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      where l.parent_user_id=auth.uid() and l.status='approved'

      union all

      select
        tsl.teacher_user_id,
        'teacher'::text,
        coalesce(nullif(tp.full_name,''),'Teacher')::text,
        l.student_user_id,
        s.name::text,
        'teacher-parent'::text
      from public.parent_student_links l
      join public.teacher_student_links tsl
        on tsl.institution_id=l.institution_id
       and tsl.student_user_id=l.student_user_id
      join public.core_students s on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      left join public.user_profiles tp on tp.user_id=tsl.teacher_user_id
      where l.parent_user_id=auth.uid() and l.status='approved'
    ) x;

  elsif r='student' then
    return query
    select distinct
      tsl.teacher_user_id,
      'teacher'::text,
      coalesce(nullif(tp.full_name,''),'Teacher')::text,
      tsl.student_user_id,
      s.name::text,
      'teacher-student'::text
    from public.teacher_student_links tsl
    join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
    left join public.user_profiles tp on tp.user_id=tsl.teacher_user_id
    where tsl.student_user_id=auth.uid();
  end if;
end;
$;
grant execute on function public.list_message_contacts() to authenticated;

create or replace function public.create_school_conversation(
  p_target_user_id uuid,
  p_student_user_id uuid,
  p_conversation_type text,
  p_subject text default 'General'
)
returns public.school_conversations
language plpgsql
security definer
set search_path=public
as $
declare
  inst uuid;
  caller_role text;
  caller_label text;
  target_label text;
  sname text;
  ok boolean:=false;
  result_row public.school_conversations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_student_user_id is null then raise exception 'Target and student context required'; end if;
  if p_target_user_id=auth.uid() then raise exception 'Cannot message yourself'; end if;
  if p_conversation_type not in ('head-parent','teacher-parent','teacher-student') then raise exception 'Invalid conversation type'; end if;

  caller_role:=public.current_account_role();

  if p_conversation_type='head-parent' then
    if caller_role='head_of_institute' then
      select i.id into inst
      from public.institutions i
      join public.parent_student_links l on l.institution_id=i.id and l.status='approved'
      where i.owner_user_id=auth.uid()
        and l.parent_user_id=p_target_user_id
        and l.student_user_id=p_student_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='parent' then
      select i.id into inst
      from public.parent_student_links l
      join public.institutions i on i.id=l.institution_id
      where l.parent_user_id=auth.uid()
        and l.student_user_id=p_student_user_id
        and l.status='approved'
        and i.owner_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;

  elsif p_conversation_type='teacher-student' then
    if caller_role='teacher' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      where tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=p_student_user_id
        and p_target_user_id=p_student_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='student' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      where tsl.student_user_id=auth.uid()
        and p_student_user_id=auth.uid()
        and tsl.teacher_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;

  elsif p_conversation_type='teacher-parent' then
    if caller_role='teacher' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      join public.parent_student_links l
        on l.institution_id=tsl.institution_id
       and l.student_user_id=tsl.student_user_id
       and l.status='approved'
      where tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=p_student_user_id
        and l.parent_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='parent' then
      select l.institution_id into inst
      from public.parent_student_links l
      join public.teacher_student_links tsl
        on tsl.institution_id=l.institution_id
       and tsl.student_user_id=l.student_user_id
      where l.parent_user_id=auth.uid()
        and l.student_user_id=p_student_user_id
        and l.status='approved'
        and tsl.teacher_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;
  end if;

  if not ok then raise exception 'This messaging relationship is not authorized'; end if;

  select s.name into sname from public.core_students s
  where s.institution_id=inst and s.auth_user_id=p_student_user_id limit 1;

  select coalesce(nullif(full_name,''),caller_role) into caller_label
  from public.user_profiles where user_id=auth.uid();
  caller_label:=coalesce(caller_label,case caller_role when 'head_of_institute' then 'Head of Institute' when 'teacher' then 'Teacher' when 'parent' then 'Parent / Guardian' else coalesce(sname,'Student') end);

  select coalesce(nullif(full_name,''),account_role) into target_label
  from public.user_profiles where user_id=p_target_user_id;
  if target_label is null and p_target_user_id=p_student_user_id then target_label:=coalesce(sname,'Student'); end if;
  target_label:=coalesce(target_label,'User');

  insert into public.school_conversations(
    institution_id,conversation_type,student_user_id,student_name,
    participant_a,participant_b,participant_a_label,participant_b_label,subject,created_by
  ) values(
    inst,p_conversation_type,p_student_user_id,sname,
    auth.uid(),p_target_user_id,caller_label,target_label,coalesce(nullif(trim(p_subject),''),'General'),auth.uid()
  )
  returning * into result_row;

  return result_row;
end;
$;
grant execute on function public.create_school_conversation(uuid,uuid,text,text) to authenticated;

create or replace function public.send_school_message(p_conversation_id uuid,p_body text)
returns public.school_messages
language plpgsql
security definer
set search_path=public
as $
declare
  c public.school_conversations%rowtype;
  recipient uuid;
  result_row public.school_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or char_length(trim(p_body))<1 or char_length(p_body)>4000 then raise exception 'Message must be between 1 and 4000 characters'; end if;

  select * into c from public.school_conversations where id=p_conversation_id;
  if c.id is null or auth.uid() not in (c.participant_a,c.participant_b) then raise exception 'Conversation access denied'; end if;

  insert into public.school_messages(conversation_id,sender_user_id,body)
  values(c.id,auth.uid(),trim(p_body))
  returning * into result_row;

  update public.school_conversations set updated_at=now() where id=c.id;
  recipient:=case when auth.uid()=c.participant_a then c.participant_b else c.participant_a end;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
  values(c.institution_id,recipient,auth.uid(),'message','New EduNizam message',left(trim(p_body),180));

  return result_row;
end;
$;
grant execute on function public.send_school_message(uuid,text) to authenticated;

create or replace function public.mark_school_messages_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $
declare
  n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_school_conversation_participant(p_conversation_id) then raise exception 'Conversation access denied'; end if;

  update public.school_messages
  set read_at=now()
  where conversation_id=p_conversation_id
    and sender_user_id<>auth.uid()
    and read_at is null;
  get diagnostics n=row_count;
  return n;
end;
$;
grant execute on function public.mark_school_messages_read(uuid) to authenticated;

commit;


-- =========================================================
-- EduNizam Inventory & Assets Management
-- =========================================================
begin;

create table if not exists public.school_inventory_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  item_code text not null,
  item_name text not null,
  item_type text not null check (item_type in ('Asset','Stock Item')),
  category text not null default 'Other',
  quantity integer not null default 1 check (quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  condition text not null default 'Good' check (condition in ('Good','Needs Repair','Damaged','Retired')),
  location text,
  purchase_date date,
  assigned_staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,item_code)
);

create index if not exists school_inventory_items_institution_idx
on public.school_inventory_items(institution_id,item_name);

alter table public.school_inventory_items enable row level security;

drop policy if exists "staff read school inventory" on public.school_inventory_items;
create policy "staff read school inventory" on public.school_inventory_items
for select to authenticated
using (public.is_institution_staff(institution_id));

drop policy if exists "heads manage school inventory" on public.school_inventory_items;
create policy "heads manage school inventory" on public.school_inventory_items
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_inventory_items.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=school_inventory_items.institution_id and i.owner_user_id=auth.uid())
  and (
    assigned_staff_profile_id is null
    or exists(
      select 1 from public.staff_profiles s
      where s.id=school_inventory_items.assigned_staff_profile_id
        and s.institution_id=school_inventory_items.institution_id
    )
  )
);

commit;


-- =========================================================
-- EduNizam Physical Library Circulation
-- =========================================================
begin;

create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  accession_no text not null,
  title text not null,
  author text,
  isbn text,
  category text not null default 'General',
  publisher text,
  shelf_location text,
  total_copies integer not null default 1 check (total_copies > 0),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,accession_no)
);

alter table public.library_books enable row level security;

create table if not exists public.library_loans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  book_id uuid not null references public.library_books(id) on delete restrict,
  student_id uuid not null references public.core_students(id) on delete cascade,
  issued_at date not null default current_date,
  due_date date not null,
  returned_at date,
  notes text,
  issued_by uuid references auth.users(id) on delete set null,
  returned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= issued_at)
);

create unique index if not exists library_active_book_student_idx
on public.library_loans(book_id,student_id)
where returned_at is null;

create index if not exists library_loans_institution_due_idx
on public.library_loans(institution_id,due_date);

alter table public.library_loans enable row level security;

drop policy if exists "institution users read library books" on public.library_books;
create policy "institution users read library books" on public.library_books
for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "heads manage library books" on public.library_books;
create policy "heads manage library books" on public.library_books
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=library_books.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=library_books.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "users read accessible library loans" on public.library_loans;
create policy "users read accessible library loans" on public.library_loans
for select to authenticated
using (
  public.is_institution_staff(institution_id)
  or public.can_access_core_student(student_id)
);

create or replace function public.issue_library_book(p_book_id uuid,p_student_id uuid,p_due_date date)
returns public.library_loans
language plpgsql
security definer
set search_path=public
as $
declare
  b public.library_books%rowtype;
  s public.core_students%rowtype;
  active_count integer;
  r text;
  result_row public.library_loans%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_due_date is null or p_due_date < current_date then raise exception 'Due date must be today or later'; end if;

  select * into b from public.library_books where id=p_book_id for update;
  if b.id is null or not b.active then raise exception 'Book is not available'; end if;

  select * into s from public.core_students where id=p_student_id and institution_id=b.institution_id;
  if s.id is null then raise exception 'Student is not in this institution'; end if;

  r:=public.current_account_role();
  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=b.institution_id and i.owner_user_id=auth.uid()) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=b.institution_id
        and tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can issue books only to assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  select count(*) into active_count from public.library_loans
  where book_id=b.id and returned_at is null;

  if active_count >= b.total_copies then raise exception 'No copy is currently available'; end if;

  if exists(select 1 from public.library_loans where book_id=b.id and student_id=s.id and returned_at is null) then
    raise exception 'This student already has this book';
  end if;

  insert into public.library_loans(institution_id,book_id,student_id,due_date,issued_by)
  values(b.institution_id,b.id,s.id,p_due_date,auth.uid())
  returning * into result_row;

  return result_row;
end;
$;
grant execute on function public.issue_library_book(uuid,uuid,date) to authenticated;

create or replace function public.return_library_book(p_loan_id uuid)
returns public.library_loans
language plpgsql
security definer
set search_path=public
as $
declare
  l public.library_loans%rowtype;
  s public.core_students%rowtype;
  r text;
  result_row public.library_loans%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into l from public.library_loans where id=p_loan_id for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if l.returned_at is not null then return l; end if;

  select * into s from public.core_students where id=l.student_id;
  r:=public.current_account_role();

  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=l.institution_id and i.owner_user_id=auth.uid()) then
      raise exception 'Head access required';
    end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=l.institution_id
        and tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can return books only for assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  update public.library_loans
  set returned_at=current_date,returned_by=auth.uid(),updated_at=now()
  where id=l.id
  returning * into result_row;

  return result_row;
end;
$;
grant execute on function public.return_library_book(uuid) to authenticated;

commit;


-- =========================================================
-- EduNizam Transport & Route Management
-- =========================================================
begin;

create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  route_code text not null,
  route_name text not null,
  pickup_time time,
  drop_time time,
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  stops text[] not null default '{}',
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,route_code)
);
alter table public.transport_routes enable row level security;

create table if not exists public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  registration_no text not null,
  vehicle_type text not null default 'Van',
  capacity integer not null check (capacity > 0),
  driver_name text,
  driver_phone text,
  conductor_name text,
  conductor_phone text,
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,registration_no)
);
alter table public.transport_vehicles enable row level security;

create table if not exists public.student_transport_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete restrict,
  vehicle_id uuid not null references public.transport_vehicles(id) on delete restrict,
  pickup_stop text,
  drop_stop text,
  effective_from date not null default current_date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id)
);
alter table public.student_transport_assignments enable row level security;

drop policy if exists "heads manage transport routes" on public.transport_routes;
create policy "heads manage transport routes" on public.transport_routes
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=transport_routes.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=transport_routes.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "heads manage transport vehicles" on public.transport_vehicles;
create policy "heads manage transport vehicles" on public.transport_vehicles
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=transport_vehicles.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=transport_vehicles.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "heads manage transport assignments" on public.student_transport_assignments;
create policy "heads manage transport assignments" on public.student_transport_assignments
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=student_transport_assignments.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=student_transport_assignments.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "users read own transport assignments" on public.student_transport_assignments;
create policy "users read own transport assignments" on public.student_transport_assignments
for select to authenticated
using (public.can_access_core_student(student_id));

create or replace function public.list_my_transport_assignments()
returns table(
  id uuid,
  student_id uuid,
  student_local_id bigint,
  student_name text,
  class_name text,
  section_name text,
  route_id uuid,
  route_name text,
  vehicle_id uuid,
  registration_no text,
  driver_name text,
  driver_phone text,
  pickup_stop text,
  drop_stop text,
  monthly_fee numeric,
  effective_from date,
  status text
)
language sql
stable
security definer
set search_path=public
as $
  select
    a.id,a.student_id,s.local_id,s.name,s.class_name,s.section_name,
    a.route_id,r.route_name,a.vehicle_id,v.registration_no,v.driver_name,v.driver_phone,
    a.pickup_stop,a.drop_stop,r.monthly_fee,a.effective_from,a.status
  from public.student_transport_assignments a
  join public.core_students s on s.id=a.student_id
  join public.transport_routes r on r.id=a.route_id
  join public.transport_vehicles v on v.id=a.vehicle_id
  where
    exists(select 1 from public.institutions i where i.id=a.institution_id and i.owner_user_id=auth.uid())
    or public.can_access_core_student(a.student_id)
  order by s.name;
$;
grant execute on function public.list_my_transport_assignments() to authenticated;

create or replace function public.assign_student_transport(
  p_student_id uuid,
  p_route_id uuid,
  p_vehicle_id uuid,
  p_pickup_stop text,
  p_drop_stop text,
  p_effective_from date
)
returns public.student_transport_assignments
language plpgsql
security definer
set search_path=public
as $
declare
  s public.core_students%rowtype;
  r public.transport_routes%rowtype;
  v public.transport_vehicles%rowtype;
  used integer;
  result_row public.student_transport_assignments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into s from public.core_students where id=p_student_id;
  select * into r from public.transport_routes where id=p_route_id;
  select * into v from public.transport_vehicles where id=p_vehicle_id for update;

  if s.id is null or r.id is null or v.id is null then raise exception 'Student, route or vehicle not found'; end if;
  if s.institution_id<>r.institution_id or s.institution_id<>v.institution_id then raise exception 'Transport records must belong to one institution'; end if;
  if not exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;
  if not r.active then raise exception 'Route is inactive'; end if;
  if v.status<>'active' then raise exception 'Vehicle is not active'; end if;

  select count(*) into used
  from public.student_transport_assignments a
  where a.vehicle_id=v.id and a.status='active' and a.student_id<>s.id;

  if used >= v.capacity then raise exception 'Vehicle capacity is full'; end if;

  insert into public.student_transport_assignments(
    institution_id,student_id,route_id,vehicle_id,pickup_stop,drop_stop,effective_from,status,created_by
  ) values(
    s.institution_id,s.id,r.id,v.id,nullif(trim(p_pickup_stop),''),nullif(trim(p_drop_stop),''),
    coalesce(p_effective_from,current_date),'active',auth.uid()
  )
  on conflict(student_id) do update set
    route_id=excluded.route_id,
    vehicle_id=excluded.vehicle_id,
    pickup_stop=excluded.pickup_stop,
    drop_stop=excluded.drop_stop,
    effective_from=excluded.effective_from,
    status='active',
    updated_at=now()
  returning * into result_row;

  return result_row;
end;
$;
grant execute on function public.assign_student_transport(uuid,uuid,uuid,text,text,date) to authenticated;

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
      'staff_profiles', to_regclass('public.staff_profiles') is not null,
      'platform_admins', to_regclass('public.platform_admins') is not null,
      'subscription_plans', to_regclass('public.subscription_plans') is not null,
      'institution_subscriptions', to_regclass('public.institution_subscriptions') is not null,
      'class_fee_structure', to_regclass('public.class_fee_structure') is not null,
      'class_sections', to_regclass('public.class_sections') is not null,
      'staff_salary_profiles', to_regclass('public.staff_salary_profiles') is not null,
      'staff_attendance_records', to_regclass('public.staff_attendance_records') is not null,
      'staff_payroll_records', to_regclass('public.staff_payroll_records') is not null,
      'student_documents', to_regclass('public.student_documents') is not null,
      'school_finance_entries', to_regclass('public.school_finance_entries') is not null,
      'school_calendar_events', to_regclass('public.school_calendar_events') is not null,
      'school_conversations', to_regclass('public.school_conversations') is not null,
      'school_messages', to_regclass('public.school_messages') is not null,
      'school_inventory_items', to_regclass('public.school_inventory_items') is not null,
      'library_books', to_regclass('public.library_books') is not null,
      'library_loans', to_regclass('public.library_loans') is not null,
      'transport_routes', to_regclass('public.transport_routes') is not null,
      'transport_vehicles', to_regclass('public.transport_vehicles') is not null,
      'student_transport_assignments', to_regclass('public.student_transport_assignments') is not null
    ),
    'functions', jsonb_build_object(
      'current_account_role', to_regprocedure('public.current_account_role()') is not null,
      'claim_institution_invite', to_regprocedure('public.claim_institution_invite(text)') is not null,
      'request_parent_link_by_student_code', to_regprocedure('public.request_parent_link_by_student_code(text)') is not null,
      'claim_student_record', to_regprocedure('public.claim_student_record(text)') is not null,
      'edunizam_ai_health_check', to_regprocedure('public.edunizam_ai_health_check()') is not null,
      'is_platform_admin', to_regprocedure('public.is_platform_admin()') is not null,
      'platform_owner_institutions', to_regprocedure('public.platform_owner_institutions()') is not null,
      'list_message_contacts', to_regprocedure('public.list_message_contacts()') is not null,
      'send_school_message', to_regprocedure('public.send_school_message(uuid,text)') is not null,
      'issue_library_book', to_regprocedure('public.issue_library_book(uuid,uuid,date)') is not null,
      'return_library_book', to_regprocedure('public.return_library_book(uuid)') is not null,
      'list_my_transport_assignments', to_regprocedure('public.list_my_transport_assignments()') is not null,
      'assign_student_transport', to_regprocedure('public.assign_student_transport(uuid,uuid,uuid,text,text,date)') is not null
    ),
    'storage', jsonb_build_object(
      'admission_documents_bucket', exists(select 1 from storage.buckets where id='admission-documents')
    )
  );
$$;

grant execute on function public.edunizam_health_check() to authenticated;

commit;
