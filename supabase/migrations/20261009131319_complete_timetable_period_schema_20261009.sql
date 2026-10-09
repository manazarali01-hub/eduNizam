-- Applied to production Supabase as migration 20261009131319.
-- Align live Timetable period records with School Work and Timetable Center.
-- Additive, idempotent; does not fabricate school schedules or change RLS.
alter table public.timetable_entries
  add column if not exists section_name text,
  add column if not exists period_number integer,
  add column if not exists end_time time,
  add column if not exists room_label text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists timetable_entries_class_day_idx
  on public.timetable_entries (institution_id,class_name,section_name,weekday,start_time);
