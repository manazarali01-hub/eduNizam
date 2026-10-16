-- Keep teacher diary edits/deletes limited to the teacher currently
-- assigned to that class section and still authorized in the institution.
-- Policy-only migration: no diary rows or school data are modified.
begin;

drop policy if exists "diary teacher updates own" on public.daily_class_diaries;
create policy "diary teacher updates own"
  on public.daily_class_diaries
  for update
  to authenticated
  using (
    teacher_user_id = (select auth.uid())
    and public.current_account_role() = 'teacher'
    and public.is_institution_staff(institution_id)
    and exists (
      select 1
      from public.class_sections cs
      where cs.institution_id = daily_class_diaries.institution_id
        and cs.class_teacher_user_id = (select auth.uid())
        and cs.class_name = daily_class_diaries.class_name
        and coalesce(cs.section_name, '') = coalesce(daily_class_diaries.section_name, '')
        and coalesce(cs.active, true) = true
    )
  )
  with check (
    teacher_user_id = (select auth.uid())
    and public.current_account_role() = 'teacher'
    and public.is_institution_staff(institution_id)
    and exists (
      select 1
      from public.class_sections cs
      where cs.institution_id = daily_class_diaries.institution_id
        and cs.class_teacher_user_id = (select auth.uid())
        and cs.class_name = daily_class_diaries.class_name
        and coalesce(cs.section_name, '') = coalesce(daily_class_diaries.section_name, '')
        and coalesce(cs.active, true) = true
    )
  );

drop policy if exists "diary teacher deletes own" on public.daily_class_diaries;
create policy "diary teacher deletes own"
  on public.daily_class_diaries
  for delete
  to authenticated
  using (
    teacher_user_id = (select auth.uid())
    and public.current_account_role() = 'teacher'
    and public.is_institution_staff(institution_id)
    and exists (
      select 1
      from public.class_sections cs
      where cs.institution_id = daily_class_diaries.institution_id
        and cs.class_teacher_user_id = (select auth.uid())
        and cs.class_name = daily_class_diaries.class_name
        and coalesce(cs.section_name, '') = coalesce(daily_class_diaries.section_name, '')
        and coalesce(cs.active, true) = true
    )
  );

commit;
