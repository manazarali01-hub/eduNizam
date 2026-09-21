-- EduNizam professional access, geo-attendance and teacher learning progress
-- Generated manually because Supabase CLI is unavailable in the current runtime.

begin;

-- Students and parents may read only the institute already linked to their
-- protected profile. They still cannot create or update institute records.
drop policy if exists "linked users read own institution" on public.institutions;
create policy "linked users read own institution"
on public.institutions for select to authenticated
using (
  exists(
    select 1 from public.user_profiles p
    where p.user_id=(select auth.uid())
      and p.institution_id=institutions.id
  )
);

-- A browser user must never be able to promote their own role or swap the
-- linked institution through the generic Data API. Trusted SECURITY DEFINER
-- linking/approval functions retain permission to perform those changes.
revoke update on public.user_profiles from authenticated;
grant update(full_name,phone,updated_at) on public.user_profiles to authenticated;

-- Exact attendance location. Coordinates are captured only when a teacher
-- explicitly allows browser location at clock-in / clock-out.
alter table public.staff_attendance_records
  add column if not exists check_in_latitude numeric(9,6),
  add column if not exists check_in_longitude numeric(9,6),
  add column if not exists check_in_accuracy_m numeric(10,2),
  add column if not exists check_out_latitude numeric(9,6),
  add column if not exists check_out_longitude numeric(9,6),
  add column if not exists check_out_accuracy_m numeric(10,2);

alter table public.staff_attendance_records
  drop constraint if exists staff_attendance_geo_check;
alter table public.staff_attendance_records
  add constraint staff_attendance_geo_check check (
    (check_in_latitude is null or check_in_latitude between -90 and 90)
    and (check_out_latitude is null or check_out_latitude between -90 and 90)
    and (check_in_longitude is null or check_in_longitude between -180 and 180)
    and (check_out_longitude is null or check_out_longitude between -180 and 180)
    and (check_in_accuracy_m is null or check_in_accuracy_m >= 0)
    and (check_out_accuracy_m is null or check_out_accuracy_m >= 0)
  );

-- In-app teacher learning and non-accredited EduNizam course certificates.
create table if not exists public.teacher_course_progress (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  course_title text not null,
  status text not null default 'In Progress' check (status in ('In Progress','Completed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  quiz_score numeric(5,2) check (quiz_score is null or quiz_score between 0 and 100),
  certificate_number text unique,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,user_id,course_id),
  check (status <> 'Completed' or (progress_percent=100 and quiz_score >= 70 and certificate_number is not null))
);

create index if not exists teacher_course_progress_institution_idx
  on public.teacher_course_progress(institution_id,status,updated_at desc);
create index if not exists teacher_course_progress_user_idx
  on public.teacher_course_progress(user_id,updated_at desc);

alter table public.teacher_course_progress enable row level security;

drop policy if exists "teachers read own course progress" on public.teacher_course_progress;
create policy "teachers read own course progress"
on public.teacher_course_progress for select to authenticated
using (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=teacher_course_progress.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
);

drop policy if exists "teachers create own course progress" on public.teacher_course_progress;
create policy "teachers create own course progress"
on public.teacher_course_progress for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=teacher_course_progress.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
);

drop policy if exists "teachers update own course progress" on public.teacher_course_progress;
create policy "teachers update own course progress"
on public.teacher_course_progress for update to authenticated
using (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=teacher_course_progress.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
)
with check (
  user_id=(select auth.uid())
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=teacher_course_progress.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
);

drop policy if exists "school admin reads teacher course progress" on public.teacher_course_progress;
create policy "school admin reads teacher course progress"
on public.teacher_course_progress for select to authenticated
using (
  exists(
    select 1 from public.institutions i
    where i.id=teacher_course_progress.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

grant select,insert,update on public.teacher_course_progress to authenticated;

-- Parent linking also records the school context so the correct school name
-- and dashboard can load immediately after the request is submitted.
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

  update public.user_profiles
  set institution_id=student_row.institution_id,updated_at=now()
  where user_id=auth.uid() and account_role='parent';

  return result_row;
end;
$$;

revoke all on function public.request_parent_link_by_student_code(text) from public,anon;
grant execute on function public.request_parent_link_by_student_code(text) to authenticated;

commit;
