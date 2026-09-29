-- EduNizam helpdesk complaint attachments (private photo/video evidence)

create table if not exists public.school_helpdesk_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.school_helpdesk_tickets(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  media_type text not null check (media_type in ('image','video')),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists school_helpdesk_attachments_ticket_idx
  on public.school_helpdesk_attachments(ticket_id,created_at);

alter table public.school_helpdesk_attachments enable row level security;

drop policy if exists "ticket creator or head reads helpdesk attachments" on public.school_helpdesk_attachments;
create policy "ticket creator or head reads helpdesk attachments"
on public.school_helpdesk_attachments for select to authenticated
using (
  exists(
    select 1 from public.school_helpdesk_tickets t
    where t.id=school_helpdesk_attachments.ticket_id
      and (
        t.created_by=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=t.institution_id and i.owner_user_id=(select auth.uid())
        )
      )
  )
);

drop policy if exists "ticket creator inserts helpdesk attachments" on public.school_helpdesk_attachments;
create policy "ticket creator inserts helpdesk attachments"
on public.school_helpdesk_attachments for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and exists(
    select 1 from public.school_helpdesk_tickets t
    where t.id=school_helpdesk_attachments.ticket_id
      and t.created_by=(select auth.uid())
      and t.status in ('Open','In Progress')
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'helpdesk-media',
  'helpdesk-media',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "ticket creator uploads private helpdesk media" on storage.objects;
create policy "ticket creator uploads private helpdesk media"
on storage.objects for insert to authenticated
with check (
  bucket_id='helpdesk-media'
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists(
    select 1 from public.school_helpdesk_tickets t
    where t.id=((storage.foldername(objects.name))[2])::uuid
      and t.institution_id::text=(storage.foldername(objects.name))[1]
      and t.created_by=(select auth.uid())
      and t.status in ('Open','In Progress')
  )
);

drop policy if exists "ticket creator or head reads private helpdesk media" on storage.objects;
create policy "ticket creator or head reads private helpdesk media"
on storage.objects for select to authenticated
using (
  bucket_id='helpdesk-media'
  and exists(
    select 1 from public.school_helpdesk_tickets t
    where t.id=((storage.foldername(objects.name))[2])::uuid
      and t.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        t.created_by=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=t.institution_id and i.owner_user_id=(select auth.uid())
        )
      )
  )
);

drop policy if exists "ticket creator or head deletes private helpdesk media" on storage.objects;
create policy "ticket creator or head deletes private helpdesk media"
on storage.objects for delete to authenticated
using (
  bucket_id='helpdesk-media'
  and exists(
    select 1 from public.school_helpdesk_tickets t
    where t.id=((storage.foldername(objects.name))[2])::uuid
      and t.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        t.created_by=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=t.institution_id and i.owner_user_id=(select auth.uid())
        )
      )
  )
);
