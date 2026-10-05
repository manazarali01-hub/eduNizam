-- Allow an active Teacher to mark attendance for:
-- 1) explicitly linked students, or
-- 2) every student in a class/section where that Teacher is the assigned class teacher.
-- This keeps the authenticated actor bound to marked_by and preserves Admin ownership.

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
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and (
        exists(
          select 1
          from public.teacher_student_links tsl
          where tsl.institution_id=s.institution_id
            and tsl.teacher_user_id=(select auth.uid())
            and tsl.student_user_id=s.auth_user_id
        )
        or exists(
          select 1
          from public.class_sections cs
          where cs.institution_id=s.institution_id
            and cs.class_teacher_user_id=(select auth.uid())
            and coalesce(cs.active,true)=true
            and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
            and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
        )
      )
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
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and (
        exists(
          select 1
          from public.teacher_student_links tsl
          where tsl.institution_id=s.institution_id
            and tsl.teacher_user_id=(select auth.uid())
            and tsl.student_user_id=s.auth_user_id
        )
        or exists(
          select 1
          from public.class_sections cs
          where cs.institution_id=s.institution_id
            and cs.class_teacher_user_id=(select auth.uid())
            and coalesce(cs.active,true)=true
            and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
            and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
        )
      )
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
    where s.id=attendance_records.student_id
      and s.institution_id=attendance_records.institution_id
      and (
        exists(
          select 1
          from public.teacher_student_links tsl
          where tsl.institution_id=s.institution_id
            and tsl.teacher_user_id=(select auth.uid())
            and tsl.student_user_id=s.auth_user_id
        )
        or exists(
          select 1
          from public.class_sections cs
          where cs.institution_id=s.institution_id
            and cs.class_teacher_user_id=(select auth.uid())
            and coalesce(cs.active,true)=true
            and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
            and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
        )
      )
  )
);
