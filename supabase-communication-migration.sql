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
  participant_user_id=auth.uid()
  or student_user_id=auth.uid()
);

commit;
