-- EduNizam Professional Timetable & Date Sheet upgrade
begin;

alter table public.timetable_entries
  add column if not exists section_name text,
  add column if not exists period_number integer,
  add column if not exists end_time time,
  add column if not exists room_label text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.exam_schedule_entries
  add column if not exists section_name text,
  add column if not exists end_time time,
  add column if not exists room_label text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists timetable_entries_class_day_idx
  on public.timetable_entries(institution_id,class_name,section_name,weekday,start_time);

create index if not exists exam_schedule_class_date_idx
  on public.exam_schedule_entries(institution_id,class_name,section_name,exam_date,start_time);

commit;
