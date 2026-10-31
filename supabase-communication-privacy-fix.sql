-- EduNizam communication privacy hardening
-- Safe to run on an existing deployment after the original communication migration.

begin;

drop policy if exists "staff manage communication meetings" on public.communication_meetings;
drop policy if exists "heads manage communication meetings" on public.communication_meetings;
drop policy if exists "teachers manage own student meetings" on public.communication_meetings;
drop policy if exists "participants read own communication meetings" on public.communication_meetings;

create policy "heads manage communication meetings" on public.communication_meetings
for all to authenticated
using (
  public.current_account_role()='head_of_institute'
  and exists(select 1 from public.institutions i where i.id=communication_meetings.institution_id and i.owner_user_id=auth.uid())
)
with check (
  public.current_account_role()='head_of_institute'
  and created_by=auth.uid()
  and created_by_role='head_of_institute'
  and participant_role='parent'
  and exists(select 1 from public.institutions i where i.id=communication_meetings.institution_id and i.owner_user_id=auth.uid())
);

create policy "teachers manage own student meetings" on public.communication_meetings
for all to authenticated
using (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(select 1 from public.institution_members m where m.institution_id=communication_meetings.institution_id and m.user_id=auth.uid() and m.role='teacher')
)
with check (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(select 1 from public.institution_members m where m.institution_id=communication_meetings.institution_id and m.user_id=auth.uid() and m.role='teacher')
);

create policy "participants read own communication meetings" on public.communication_meetings
for select to authenticated
using (
  (participant_role='student' and student_user_id=auth.uid())
  or (participant_role='parent' and participant_user_id=auth.uid())
  or (
    participant_role='parent'
    and exists(
      select 1 from public.parent_student_links l
      where l.parent_user_id=auth.uid()
        and l.student_user_id=communication_meetings.student_user_id
        and l.status='approved'
    )
  )
);

commit;
