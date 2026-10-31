-- EduNizam exact staff time, teacher training and school community
-- Safe to run more than once in Supabase SQL Editor.
begin;

alter table public.staff_attendance_records
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz;

alter table public.staff_attendance_records
  drop constraint if exists staff_attendance_time_order_check;
alter table public.staff_attendance_records
  add constraint staff_attendance_time_order_check
  check (check_in_at is null or check_out_at is null or check_out_at >= check_in_at);

drop policy if exists "teachers clock own attendance" on public.staff_attendance_records;
drop policy if exists "teachers update own attendance clock" on public.staff_attendance_records;
drop policy if exists "teachers insert own staff attendance" on public.staff_attendance_records;
drop policy if exists "teachers update own staff attendance" on public.staff_attendance_records;

create policy "teachers insert own staff attendance" on public.staff_attendance_records
for insert to authenticated
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1 from public.staff_profiles s
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
      and coalesce(s.employment_status,'active')<>'inactive'
  )
);

create policy "teachers update own staff attendance" on public.staff_attendance_records
for update to authenticated
using (
  exists(
    select 1 from public.staff_profiles s
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
  )
)
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1 from public.staff_profiles s
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
  )
);

revoke all on public.staff_attendance_records from anon;
grant select,insert on public.staff_attendance_records to authenticated;
grant update(status,note,check_in_at,check_out_at,check_in_latitude,check_in_longitude,check_in_accuracy_m,check_out_latitude,check_out_longitude,check_out_accuracy_m,marked_by,updated_at)
on public.staff_attendance_records to authenticated;

create table if not exists public.teacher_training_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  training_title text not null,
  category text not null,
  provider text,
  training_mode text not null default 'On-campus',
  start_date date,
  end_date date,
  cpd_hours numeric(8,2) not null default 0 check (cpd_hours >= 0),
  status text not null default 'Planned' check (status in ('Planned','In Progress','Completed','Cancelled')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  evaluation_score numeric(5,2) check (evaluation_score is null or evaluation_score between 0 and 100),
  certificate_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists teacher_training_institution_idx on public.teacher_training_records(institution_id,start_date desc);
create index if not exists teacher_training_staff_idx on public.teacher_training_records(staff_profile_id,status);
alter table public.teacher_training_records enable row level security;
revoke all on public.teacher_training_records from anon;
grant select, insert, update, delete on public.teacher_training_records to authenticated;

drop policy if exists "heads manage teacher training" on public.teacher_training_records;
create policy "heads manage teacher training" on public.teacher_training_records
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=teacher_training_records.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=teacher_training_records.institution_id and i.owner_user_id=auth.uid()));

drop policy if exists "teachers read own training" on public.teacher_training_records;
create policy "teachers read own training" on public.teacher_training_records
for select to authenticated
using (
  exists(
    select 1 from public.staff_profiles s
    where s.id=teacher_training_records.staff_profile_id
      and s.institution_id=teacher_training_records.institution_id
      and s.user_id=auth.uid()
  )
);

create table if not exists public.school_functions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  function_type text not null,
  function_date date not null,
  start_time time,
  venue text,
  description text,
  status text not null default 'Upcoming'
    check (status in ('Upcoming','Open for Registration','Completed','Postponed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_functions_institution_date_idx on public.school_functions(institution_id,function_date desc);
alter table public.school_functions enable row level security;

drop policy if exists "institution users read school functions" on public.school_functions;
create policy "institution users read school functions" on public.school_functions
for select to authenticated using (public.is_institution_user(institution_id));

drop policy if exists "heads manage school functions" on public.school_functions;
create policy "heads manage school functions" on public.school_functions
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=school_functions.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=school_functions.institution_id and i.owner_user_id=auth.uid()));

create table if not exists public.student_spotlight_posts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  student_name text,
  class_label text,
  category text not null default 'Activity',
  body text not null,
  event_date date,
  media_type text check (media_type is null or media_type in ('image','audio','video')),
  media_path text,
  media_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_path is null or media_url is null)
);
create index if not exists student_spotlight_institution_created_idx on public.student_spotlight_posts(institution_id,created_at desc);
alter table public.student_spotlight_posts enable row level security;

drop policy if exists "institution users read student spotlight" on public.student_spotlight_posts;
create policy "institution users read student spotlight" on public.student_spotlight_posts
for select to authenticated using (public.is_institution_user(institution_id));

drop policy if exists "heads manage student spotlight" on public.student_spotlight_posts;
create policy "heads manage student spotlight" on public.student_spotlight_posts
for all to authenticated
using (exists(select 1 from public.institutions i where i.id=student_spotlight_posts.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=student_spotlight_posts.institution_id and i.owner_user_id=auth.uid()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'school-community-media','school-community-media',false,26214400,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/mpeg','audio/mp4','audio/ogg','audio/wav',
    'video/mp4','video/webm','video/quicktime'
  ]::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "heads upload school community media" on storage.objects;
create policy "heads upload school community media" on storage.objects
for insert to authenticated
with check (
  bucket_id='school-community-media'
  and exists(
    select 1 from public.institutions i
    where i.id::text=(storage.foldername(name))[1]
      and i.owner_user_id=auth.uid()
  )
);

drop policy if exists "institution users read school community media" on storage.objects;
create policy "institution users read school community media" on storage.objects
for select to authenticated
using (
  bucket_id='school-community-media'
  and exists(
    select 1 from public.institutions i
    where i.id::text=(storage.foldername(name))[1]
      and public.is_institution_user(i.id)
  )
);

drop policy if exists "heads delete school community media" on storage.objects;
create policy "heads delete school community media" on storage.objects
for delete to authenticated
using (
  bucket_id='school-community-media'
  and exists(
    select 1 from public.institutions i
    where i.id::text=(storage.foldername(name))[1]
      and i.owner_user_id=auth.uid()
  )
);

commit;
