-- Apply after supabase-academic-access-migration.sql on existing deployments.
begin;

-- Tighten Teacher–Student communication after teacher_student_links exists.
drop policy if exists "teachers manage own student meetings" on public.communication_meetings;
create policy "teachers manage own student meetings" on public.communication_meetings
for all to authenticated
using (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=communication_meetings.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=communication_meetings.student_user_id
  )
)
with check (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=communication_meetings.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=communication_meetings.student_user_id
  )
);

commit;
