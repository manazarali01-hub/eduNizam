-- EduNizam verified teacher-training assignments
-- Admin assigns evidence tasks; Teacher submits; Admin approves/returns.
-- All tasks approved => verified training completion and certificate.

begin;

alter table public.teacher_training_records
  add column if not exists certificate_number text,
  add column if not exists completed_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

create unique index if not exists teacher_training_certificate_unique_idx
  on public.teacher_training_records(certificate_number)
  where certificate_number is not null;

create table if not exists public.teacher_training_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  training_record_id uuid not null references public.teacher_training_records(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  task_title text not null,
  instructions text not null,
  due_date date,
  max_score numeric not null default 100 check (max_score > 0 and max_score <= 1000),
  status text not null default 'Assigned' check (status in ('Assigned','Submitted','Returned','Approved')),
  submission_text text,
  submission_url text,
  submitted_at timestamptz,
  score numeric,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score is null or (score >= 0 and score <= max_score)),
  check (char_length(btrim(task_title)) >= 3),
  check (char_length(btrim(instructions)) >= 3)
);

create index if not exists training_assignments_record_idx
  on public.teacher_training_assignments(training_record_id,created_at);
create index if not exists training_assignments_staff_idx
  on public.teacher_training_assignments(staff_profile_id,status,due_date);
create index if not exists training_assignments_reviewer_idx
  on public.teacher_training_assignments(reviewed_by)
  where reviewed_by is not null;

alter table public.teacher_training_assignments enable row level security;

drop policy if exists "head and assigned teacher read training tasks" on public.teacher_training_assignments;
create policy "head and assigned teacher read training tasks"
on public.teacher_training_assignments for select to authenticated
using (
  exists(select 1 from public.institutions i
         where i.id=teacher_training_assignments.institution_id
           and i.owner_user_id=(select auth.uid()))
  or exists(select 1 from public.staff_profiles s
            where s.id=teacher_training_assignments.staff_profile_id
              and s.institution_id=teacher_training_assignments.institution_id
              and s.user_id=(select auth.uid()))
);

drop policy if exists "heads create training tasks" on public.teacher_training_assignments;
create policy "heads create training tasks"
on public.teacher_training_assignments for insert to authenticated
with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.institutions i
             where i.id=teacher_training_assignments.institution_id
               and i.owner_user_id=(select auth.uid()))
  and exists(select 1 from public.teacher_training_records tr
             where tr.id=teacher_training_assignments.training_record_id
               and tr.institution_id=teacher_training_assignments.institution_id
               and tr.staff_profile_id=teacher_training_assignments.staff_profile_id)
);

drop policy if exists "heads delete training tasks" on public.teacher_training_assignments;
create policy "heads delete training tasks"
on public.teacher_training_assignments for delete to authenticated
using (
  exists(select 1 from public.institutions i
         where i.id=teacher_training_assignments.institution_id
           and i.owner_user_id=(select auth.uid()))
);

revoke all on public.teacher_training_assignments from anon;
revoke update,truncate,references,trigger on public.teacher_training_assignments from authenticated;
grant select,insert,delete on public.teacher_training_assignments to authenticated;

-- Production also defines SECURITY INVOKER RPCs:
-- submit_training_assignment_v1(uuid,text,text)
-- review_training_assignment_v1(uuid,text,numeric,text)

commit;
