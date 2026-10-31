-- Fix private Storage RLS policies that were parsing student/institution names
-- instead of the storage object path. All affected buckets remain private.

drop policy if exists "authorized users read private complaint media" on storage.objects;
create policy "authorized users read private complaint media"
on storage.objects
for select
to authenticated
using (
  bucket_id='parent-complaints'
  and exists (
    select 1
    from public.student_parent_complaints c
    join public.core_students s on s.id=c.student_id
    where c.id=((storage.foldername(objects.name))[2])::uuid
      and c.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        c.created_by=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=c.institution_id
            and i.owner_user_id=(select auth.uid())
        )
        or exists(
          select 1 from public.parent_student_links l
          where l.institution_id=c.institution_id
            and l.parent_user_id=(select auth.uid())
            and l.student_user_id=s.auth_user_id
            and l.status='approved'
        )
      )
  )
);

drop policy if exists "school heads delete community media" on storage.objects;
create policy "school heads delete community media"
on storage.objects
for delete
to authenticated
using (
  bucket_id='school-community-media'
  and exists(
    select 1 from public.institutions i
    where i.id::text=(storage.foldername(objects.name))[1]
      and i.owner_user_id=(select auth.uid())
  )
);

drop policy if exists "school heads upload community media" on storage.objects;
create policy "school heads upload community media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='school-community-media'
  and exists(
    select 1 from public.institutions i
    where i.id::text=(storage.foldername(name))[1]
      and i.owner_user_id=(select auth.uid())
  )
);
