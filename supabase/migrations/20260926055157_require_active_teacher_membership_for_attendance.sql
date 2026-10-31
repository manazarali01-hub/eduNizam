-- Applied in Supabase migration history: require_active_teacher_membership_for_attendance
-- Revoked/non-member teachers cannot continue using stale staff/student assignments.

drop policy if exists "teachers insert assigned attendance" on public.attendance_records;
drop policy if exists "teachers update assigned attendance" on public.attendance_records;

create policy "teachers insert assigned attendance"
on public.attendance_records
for insert
to authenticated
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1
    from public.institution_members m
    where m.institution_id=attendance_records.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
  and exists(
    select 1
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and tsl.teacher_user_id=(select auth.uid())
  )
);

create policy "teachers update assigned attendance"
on public.attendance_records
for update
to authenticated
using (
  exists(
    select 1
    from public.institution_members m
    where m.institution_id=attendance_records.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
  and exists(
    select 1
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and tsl.teacher_user_id=(select auth.uid())
  )
)
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1
    from public.institution_members m
    where m.institution_id=attendance_records.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
  and exists(
    select 1
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and tsl.teacher_user_id=(select auth.uid())
  )
);

drop policy if exists "teachers read own attendance" on public.staff_attendance_records;
drop policy if exists "teachers insert own staff attendance" on public.staff_attendance_records;
drop policy if exists "teachers update own staff attendance" on public.staff_attendance_records;

create policy "teachers read own attendance"
on public.staff_attendance_records
for select
to authenticated
using (
  exists(
    select 1
    from public.staff_profiles s
    join public.institution_members m
      on m.institution_id=s.institution_id
     and m.user_id=s.user_id
     and m.role='teacher'
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
  )
);

create policy "teachers insert own staff attendance"
on public.staff_attendance_records
for insert
to authenticated
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1
    from public.staff_profiles s
    join public.institution_members m
      on m.institution_id=s.institution_id
     and m.user_id=s.user_id
     and m.role='teacher'
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
      and coalesce(s.employment_status,'active')<>'inactive'
  )
);

create policy "teachers update own staff attendance"
on public.staff_attendance_records
for update
to authenticated
using (
  exists(
    select 1
    from public.staff_profiles s
    join public.institution_members m
      on m.institution_id=s.institution_id
     and m.user_id=s.user_id
     and m.role='teacher'
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
  )
)
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1
    from public.staff_profiles s
    join public.institution_members m
      on m.institution_id=s.institution_id
     and m.user_id=s.user_id
     and m.role='teacher'
    where s.id=staff_attendance_records.staff_profile_id
      and s.institution_id=staff_attendance_records.institution_id
      and s.user_id=(select auth.uid())
      and coalesce(s.employment_status,'active')<>'inactive'
  )
);
