-- Align Daily Diary UI with database permissions.
-- Teachers may delete only their own entries; the School Admin may remove any
-- diary entry belonging to the owned institution for moderation/correction.

drop policy if exists "heads delete institute diaries" on public.daily_class_diaries;
create policy "heads delete institute diaries"
on public.daily_class_diaries
for delete
to authenticated
using (
  exists(
    select 1
    from public.institutions i
    where i.id=daily_class_diaries.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);
