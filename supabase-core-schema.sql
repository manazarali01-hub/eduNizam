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
