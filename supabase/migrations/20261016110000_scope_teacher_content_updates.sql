-- Keep teacher-authored paper/question updates within an institution
-- the current authenticated user is still authorized to staff/manage.
-- This migration intentionally changes policy definitions only; it does not
-- modify school records or apply itself to production from GitHub.
begin;

drop policy if exists "question creator updates" on public.teacher_question_bank;
create policy "question creator updates"
  on public.teacher_question_bank
  for update
  to authenticated
  using (
    creator_user_id = (select auth.uid())
    and public.is_institution_staff(institution_id)
  )
  with check (
    creator_user_id = (select auth.uid())
    and institution_id is not null
    and public.is_institution_staff(institution_id)
  );

drop policy if exists "paper creator updates" on public.teacher_papers;
create policy "paper creator updates"
  on public.teacher_papers
  for update
  to authenticated
  using (
    creator_user_id = (select auth.uid())
    and public.is_institution_staff(institution_id)
  )
  with check (
    creator_user_id = (select auth.uid())
    and institution_id is not null
    and public.is_institution_staff(institution_id)
  );

commit;
