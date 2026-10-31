-- EduNizam Exam & Report Card Center upgrade migration
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
alter table public.exam_schedule_entries add column if not exists section_name text;
alter table public.exam_schedule_entries add column if not exists end_time time;
alter table public.exam_schedule_entries add column if not exists room_label text;
alter table public.exam_schedule_entries add column if not exists notes text;
alter table public.exam_schedule_entries add column if not exists updated_at timestamptz not null default now();

create index if not exists exam_schedule_institution_class_date_idx on public.exam_schedule_entries(institution_id,class_name,exam_date);

alter table public.exam_schedule_entries enable row level security;

create or replace function public.is_institution_user(target uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.institutions i where i.id=target and i.owner_user_id=auth.uid())
  or exists(select 1 from public.institution_members m where m.institution_id=target and m.user_id=auth.uid())
  or exists(select 1 from public.user_profiles p where p.institution_id=target and p.user_id=auth.uid());
$$;
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


