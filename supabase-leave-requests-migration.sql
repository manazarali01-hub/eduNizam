-- EduNizam Leave Requests upgrade migration
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


