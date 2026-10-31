-- EduNizam School Work Center permission hardening
-- Head of Institute can manage all institution items; teachers manage only their own.

begin;

drop policy if exists "staff manage announcements" on public.school_announcements;
create policy "staff manage announcements" on public.school_announcements for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_announcements.institution_id and i.owner_user_id=auth.uid())
  or (public.current_account_role()='teacher' and creator_user_id=auth.uid() and public.is_institution_staff(institution_id))
)
with check (
  exists(select 1 from public.institutions i where i.id=school_announcements.institution_id and i.owner_user_id=auth.uid())
  or (public.current_account_role()='teacher' and creator_user_id=auth.uid() and public.is_institution_staff(institution_id))
);

drop policy if exists "staff manage homework" on public.homework_items;
create policy "staff manage homework" on public.homework_items for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=homework_items.institution_id and i.owner_user_id=auth.uid())
  or (public.current_account_role()='teacher' and creator_user_id=auth.uid() and public.is_institution_staff(institution_id))
)
with check (
  exists(select 1 from public.institutions i where i.id=homework_items.institution_id and i.owner_user_id=auth.uid())
  or (public.current_account_role()='teacher' and creator_user_id=auth.uid() and public.is_institution_staff(institution_id))
);

drop policy if exists "staff manage timetable" on public.timetable_entries;
create policy "staff manage timetable" on public.timetable_entries for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=timetable_entries.institution_id and i.owner_user_id=auth.uid())
  or (public.current_account_role()='teacher' and creator_user_id=auth.uid() and public.is_institution_staff(institution_id))
)
with check (
  exists(select 1 from public.institutions i where i.id=timetable_entries.institution_id and i.owner_user_id=auth.uid())
  or (public.current_account_role()='teacher' and creator_user_id=auth.uid() and public.is_institution_staff(institution_id))
);

commit;
