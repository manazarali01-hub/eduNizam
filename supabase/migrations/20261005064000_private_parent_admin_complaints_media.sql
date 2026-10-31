-- Private Parent -> Admin complaints with photo/video evidence.
-- Parent complaints are readable only by the complaint creator and the owning
-- School Admin. Teachers, students and other parents cannot read them.

create table if not exists public.parent_admin_complaints (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (nullif(btrim(subject),'') is not null),
  message text not null check (nullif(btrim(message),'') is not null),
  severity text not null default 'Concern' check (severity in ('Information','Concern','Serious')),
  status text not null default 'Open' check (status in ('Open','Resolved')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parent_admin_complaints_institution_created_idx
  on public.parent_admin_complaints(institution_id,created_at desc);
create index if not exists parent_admin_complaints_parent_created_idx
  on public.parent_admin_complaints(parent_user_id,created_at desc);

alter table public.parent_admin_complaints enable row level security;

drop policy if exists "parent creator and admin read private complaints" on public.parent_admin_complaints;
create policy "parent creator and admin read private complaints"
on public.parent_admin_complaints
for select to authenticated
using (
  parent_user_id=(select auth.uid())
  or exists(
    select 1 from public.institutions i
    where i.id=parent_admin_complaints.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

drop policy if exists "parents create private admin complaints" on public.parent_admin_complaints;
create policy "parents create private admin complaints"
on public.parent_admin_complaints
for insert to authenticated
with check (
  parent_user_id=(select auth.uid())
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=parent_admin_complaints.institution_id
      and m.user_id=(select auth.uid())
      and m.role='parent'
  )
);

drop policy if exists "head resolves private parent complaints" on public.parent_admin_complaints;
create policy "head resolves private parent complaints"
on public.parent_admin_complaints
for update to authenticated
using (
  status='Open'
  and exists(
    select 1 from public.institutions i
    where i.id=parent_admin_complaints.institution_id
      and i.owner_user_id=(select auth.uid())
  )
)
with check (
  status='Resolved'
  and resolved_by=(select auth.uid())
  and resolved_at is not null
  and exists(
    select 1 from public.institutions i
    where i.id=parent_admin_complaints.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

create table if not exists public.parent_admin_complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.parent_admin_complaints(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  media_type text not null check (media_type in ('image','video')),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists parent_admin_complaint_attachments_complaint_idx
  on public.parent_admin_complaint_attachments(complaint_id,created_at);

alter table public.parent_admin_complaint_attachments enable row level security;

drop policy if exists "private parent admin attachment readers" on public.parent_admin_complaint_attachments;
create policy "private parent admin attachment readers"
on public.parent_admin_complaint_attachments
for select to authenticated
using (
  exists(
    select 1
    from public.parent_admin_complaints c
    where c.id=parent_admin_complaint_attachments.complaint_id
      and (
        c.parent_user_id=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=c.institution_id
            and i.owner_user_id=(select auth.uid())
        )
      )
  )
);

drop policy if exists "parent creator adds private admin evidence" on public.parent_admin_complaint_attachments;
create policy "parent creator adds private admin evidence"
on public.parent_admin_complaint_attachments
for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and exists(
    select 1
    from public.parent_admin_complaints c
    where c.id=parent_admin_complaint_attachments.complaint_id
      and c.parent_user_id=(select auth.uid())
      and c.status='Open'
  )
);

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
        c.parent_user_id=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=c.institution_id
            and i.owner_user_id=(select auth.uid())
        )
      )
  )
);

grant select,insert,update on public.parent_admin_complaints to authenticated;
grant select,insert,delete on public.parent_admin_complaint_attachments to authenticated;

create or replace function public.create_parent_admin_complaint_v1(
  p_institution_id uuid,
  p_subject text,
  p_message text,
  p_severity text
)
returns public.parent_admin_complaints
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.parent_admin_complaints%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_subject,'')),'') is null
     or nullif(btrim(coalesce(p_message,'')),'') is null then
    raise exception 'Subject and complaint details required';
  end if;
  if p_severity not in ('Information','Concern','Serious') then
    raise exception 'Invalid severity';
  end if;

  insert into public.parent_admin_complaints(
    institution_id,parent_user_id,subject,message,severity
  ) values(
    p_institution_id,(select auth.uid()),btrim(p_subject),btrim(p_message),p_severity
  )
  returning * into r;

  return r;
end;
$$;

revoke execute on function public.create_parent_admin_complaint_v1(uuid,text,text,text) from public,anon;
grant execute on function public.create_parent_admin_complaint_v1(uuid,text,text,text) to authenticated;

create or replace function public.resolve_parent_admin_complaint_v1(
  p_complaint_id uuid,
  p_admin_note text
)
returns public.parent_admin_complaints
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.parent_admin_complaints%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  update public.parent_admin_complaints
     set status='Resolved',
         admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),
         resolved_at=now(),
         resolved_by=(select auth.uid()),
         updated_at=now()
   where id=p_complaint_id
     and status='Open'
  returning * into r;

  if r.id is null then
    raise exception 'Complaint not found, already resolved, or Admin access required';
  end if;
  return r;
end;
$$;

revoke execute on function public.resolve_parent_admin_complaint_v1(uuid,text) from public,anon;
grant execute on function public.resolve_parent_admin_complaint_v1(uuid,text) to authenticated;

create or replace function private.notify_parent_admin_complaint_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  admin_id uuid;
begin
  if tg_op='INSERT' then
    select i.owner_user_id into admin_id
    from public.institutions i
    where i.id=new.institution_id;

    if admin_id is not null and admin_id<>new.parent_user_id then
      insert into public.user_notifications(
        institution_id,recipient_user_id,created_by,category,title,body
      ) values(
        new.institution_id,admin_id,new.parent_user_id,'parent_private_complaint',
        'New private parent complaint',
        left(new.subject||' · '||new.message,180)
      );
    end if;
  elsif tg_op='UPDATE'
     and new.status='Resolved'
     and old.status is distinct from new.status
     and new.parent_user_id<>coalesce(new.resolved_by,'00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    ) values(
      new.institution_id,new.parent_user_id,new.resolved_by,'parent_private_complaint',
      'Your private complaint was resolved',
      left(new.subject||case when nullif(btrim(coalesce(new.admin_note,'')),'') is not null then ' · '||new.admin_note else '' end,180)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists parent_admin_complaint_notify_insert on public.parent_admin_complaints;
create trigger parent_admin_complaint_notify_insert
after insert on public.parent_admin_complaints
for each row execute function private.notify_parent_admin_complaint_v1();

drop trigger if exists parent_admin_complaint_notify_resolution on public.parent_admin_complaints;
create trigger parent_admin_complaint_notify_resolution
after update of status on public.parent_admin_complaints
for each row execute function private.notify_parent_admin_complaint_v1();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'parent-admin-complaints','parent-admin-complaints',false,26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "parent uploads private admin complaint media" on storage.objects;
create policy "parent uploads private admin complaint media"
on storage.objects
for insert to authenticated
with check (
  bucket_id='parent-admin-complaints'
  and exists(
    select 1
    from public.parent_admin_complaints c
    where c.id=(storage.foldername(name))[2]::uuid
      and c.institution_id::text=(storage.foldername(name))[1]
      and c.parent_user_id=(select auth.uid())
      and c.status='Open'
  )
);

drop policy if exists "parent or admin reads private admin complaint media" on storage.objects;
create policy "parent or admin reads private admin complaint media"
on storage.objects
for select to authenticated
using (
  bucket_id='parent-admin-complaints'
  and exists(
    select 1
    from public.parent_admin_complaints c
    where c.id=(storage.foldername(name))[2]::uuid
      and c.institution_id::text=(storage.foldername(name))[1]
      and (
        c.parent_user_id=(select auth.uid())
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
        c.parent_user_id=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=c.institution_id
            and i.owner_user_id=(select auth.uid())
        )
      )
  )
);
