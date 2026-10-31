-- EduNizam Staff Attendance & Payroll upgrade migration
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


