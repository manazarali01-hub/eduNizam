drop policy if exists "heads manage communication meetings" on public.communication_meetings;

create policy "heads read communication meetings"
on public.communication_meetings
for select
to authenticated
using (
  current_account_role()='head_of_institute'
  and exists (
    select 1
    from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

create policy "heads create linked parent meetings"
on public.communication_meetings
for insert
to authenticated
with check (
  current_account_role()='head_of_institute'
  and created_by=(select auth.uid())
  and created_by_role='head_of_institute'
  and participant_role='parent'
  and student_user_id is not null
  and exists (
    select 1
    from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=(select auth.uid())
  )
  and exists (
    select 1
    from public.parent_student_links l
    where l.institution_id=communication_meetings.institution_id
      and l.student_user_id=communication_meetings.student_user_id
      and l.status='approved'
      and (
        communication_meetings.participant_user_id is null
        or l.parent_user_id=communication_meetings.participant_user_id
      )
  )
);

create policy "heads update communication meetings"
on public.communication_meetings
for update
to authenticated
using (
  current_account_role()='head_of_institute'
  and exists (
    select 1
    from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=(select auth.uid())
  )
)
with check (
  current_account_role()='head_of_institute'
  and created_by=(select auth.uid())
  and created_by_role='head_of_institute'
  and participant_role='parent'
  and exists (
    select 1
    from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

create policy "heads delete communication meetings"
on public.communication_meetings
for delete
to authenticated
using (
  current_account_role()='head_of_institute'
  and exists (
    select 1
    from public.institutions i
    where i.id=communication_meetings.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);
