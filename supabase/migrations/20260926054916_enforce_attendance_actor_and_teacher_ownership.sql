-- Applied in Supabase migration history: enforce_attendance_actor_and_teacher_ownership
-- Student attendance: Admin can mark all students; Teacher can mark only assigned students.
-- Staff attendance: Teacher can mark/update only own attendance; Admin can mark all staff.
-- marked_by must always match the authenticated actor on writes.

drop policy if exists "heads teachers manage assigned attendance" on public.attendance_records;
drop policy if exists "heads manage attendance" on public.attendance_records;
drop policy if exists "teachers insert assigned attendance" on public.attendance_records;
drop policy if exists "teachers update assigned attendance" on public.attendance_records;

create policy "heads manage attendance"
on public.attendance_records
for all
to authenticated
using (
  (select private.is_institution_owner(institution_id,(select auth.uid())))
)
with check (
  (select private.is_institution_owner(institution_id,(select auth.uid())))
  and marked_by=(select auth.uid())
);

create policy "teachers insert assigned attendance"
on public.attendance_records
for insert
to authenticated
with check (
  marked_by=(select auth.uid())
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
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and tsl.teacher_user_id=(select auth.uid())
  )
);

drop policy if exists "heads manage staff attendance" on public.staff_attendance_records;
create policy "heads manage staff attendance"
on public.staff_attendance_records
for all
to authenticated
using (
  exists(
    select 1 from public.institutions i
    where i.id=staff_attendance_records.institution_id
      and i.owner_user_id=(select auth.uid())
  )
)
with check (
  marked_by=(select auth.uid())
  and exists(
    select 1 from public.institutions i
    where i.id=staff_attendance_records.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);
