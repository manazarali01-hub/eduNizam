-- Integrity hardening for private Parent -> Admin complaints.

drop policy if exists "parents create private admin complaints" on public.parent_admin_complaints;
create policy "parents create private admin complaints"
on public.parent_admin_complaints
for insert to authenticated
with check (
  parent_user_id=(select auth.uid())
  and status='Open'
  and admin_note is null
  and resolved_at is null
  and resolved_by is null
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=parent_admin_complaints.institution_id
      and m.user_id=(select auth.uid())
      and m.role='parent'
  )
);

revoke update on public.parent_admin_complaints from authenticated;
grant update(status,admin_note,resolved_at,resolved_by,updated_at)
  on public.parent_admin_complaints to authenticated;

drop policy if exists "parent creator or admin removes private admin evidence" on public.parent_admin_complaint_attachments;
create policy "parent creator or admin removes private admin evidence"
on public.parent_admin_complaint_attachments
for delete to authenticated
using (
  exists(
    select 1
    from public.parent_admin_complaints c
    where c.id=parent_admin_complaint_attachments.complaint_id
      and (
        (c.parent_user_id=(select auth.uid()) and c.status='Open')
        or exists(
          select 1 from public.institutions i
          where i.id=c.institution_id
            and i.owner_user_id=(select auth.uid())
        )
      )
  )
);

drop policy if exists "parent or admin deletes private admin complaint media" on storage.objects;
create policy "parent or admin deletes private admin complaint media"
on storage.objects
for delete to authenticated
using (
  bucket_id='parent-admin-complaints'
  and exists(
    select 1
    from public.parent_admin_complaints c
    where c.id=(storage.foldername(name))[2]::uuid
      and c.institution_id::text=(storage.foldername(name))[1]
      and (
        (c.parent_user_id=(select auth.uid()) and c.status='Open')
        or exists(
          select 1 from public.institutions i
          where i.id=c.institution_id
            and i.owner_user_id=(select auth.uid())
        )
      )
  )
);
