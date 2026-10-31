-- Correct the institution folder lookup for school community media uploads.
drop policy if exists "school heads upload community media" on storage.objects;

create policy "school heads upload community media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'school-community-media'
  and exists (
    select 1
    from public.institutions as i
    where i.id::text = (storage.foldername(objects.name))[1]
      and i.owner_user_id = (select auth.uid())
  )
);
