-- EduNizam Parent Complaint Notices with Private Media upgrade migration
-- =========================================================
-- EduNizam Parent Complaint Notices with Private Media
-- =========================================================
begin;

create table if not exists public.student_parent_complaints (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  subject text not null,
  message text not null,
  severity text not null default 'Concern' check (severity in ('Information','Concern','Serious')),
  action_requested text,
  status text not null default 'Open' check (status in ('Open','Resolved')),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_parent_complaints_student_idx on public.student_parent_complaints(student_id,created_at desc);
alter table public.student_parent_complaints enable row level security;

create table if not exists public.student_parent_complaint_attachments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.student_parent_complaints(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  media_type text not null check (media_type in ('image','video')),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.student_parent_complaint_attachments enable row level security;

drop policy if exists "authorized users read parent complaints" on public.student_parent_complaints;
create policy "authorized users read parent complaints" on public.student_parent_complaints
for select to authenticated
using (
  created_by=auth.uid()
  or exists(select 1 from public.institutions i where i.id=student_parent_complaints.institution_id and i.owner_user_id=auth.uid())
  or exists(
    select 1
    from public.core_students s
    join public.parent_student_links l
      on l.institution_id=s.institution_id
     and l.student_user_id=s.auth_user_id
     and l.status='approved'
    where s.id=student_parent_complaints.student_id
      and l.parent_user_id=auth.uid()
  )
);

drop policy if exists "authorized users read complaint attachments" on public.student_parent_complaint_attachments;
create policy "authorized users read complaint attachments" on public.student_parent_complaint_attachments
for select to authenticated
using (
  exists(
    select 1 from public.student_parent_complaints c
    where c.id=student_parent_complaint_attachments.complaint_id
      and (
        c.created_by=auth.uid()
        or exists(select 1 from public.institutions i where i.id=c.institution_id and i.owner_user_id=auth.uid())
        or exists(
          select 1
          from public.core_students s
          join public.parent_student_links l
            on l.institution_id=s.institution_id
           and l.student_user_id=s.auth_user_id
           and l.status='approved'
          where s.id=c.student_id and l.parent_user_id=auth.uid()
        )
      )
  )
);

drop policy if exists "complaint creator inserts attachments" on public.student_parent_complaint_attachments;
create policy "complaint creator inserts attachments" on public.student_parent_complaint_attachments
for insert to authenticated
with check (
  uploaded_by=auth.uid()
  and exists(
    select 1 from public.student_parent_complaints c
    where c.id=student_parent_complaint_attachments.complaint_id
      and c.created_by=auth.uid()
  )
);

create or replace function public.create_student_parent_complaint(
  p_student_id uuid,
  p_subject text,
  p_message text,
  p_severity text,
  p_action_requested text
)
returns public.student_parent_complaints
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.core_students%rowtype;
  r text;
  result_row public.student_parent_complaints%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into s from public.core_students where id=p_student_id;
  if s.id is null then raise exception 'Student not found'; end if;
  if nullif(trim(p_subject),'') is null or nullif(trim(p_message),'') is null then raise exception 'Subject and complaint message required'; end if;
  if p_severity not in ('Information','Concern','Serious') then raise exception 'Invalid severity'; end if;

  r:=public.current_account_role();
  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=s.institution_id
        and tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can complain only about assigned students'; end if;
  else
    raise exception 'Only Head or Teacher can send a student complaint';
  end if;

  if s.auth_user_id is null or not exists(
    select 1 from public.parent_student_links l
    where l.institution_id=s.institution_id
      and l.student_user_id=s.auth_user_id
      and l.status='approved'
  ) then raise exception 'No approved parent account is linked to this student'; end if;

  insert into public.student_parent_complaints(
    institution_id,student_id,subject,message,severity,action_requested,created_by
  ) values(
    s.institution_id,s.id,trim(p_subject),trim(p_message),p_severity,nullif(trim(p_action_requested),''),auth.uid()
  )
  returning * into result_row;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
  select s.institution_id,l.parent_user_id,auth.uid(),'parent_complaint','Student complaint notice',left(s.name||' · '||result_row.subject,180)
  from public.parent_student_links l
  where l.institution_id=s.institution_id
    and l.student_user_id=s.auth_user_id
    and l.status='approved';

  return result_row;
end;
$$;
grant execute on function public.create_student_parent_complaint(uuid,text,text,text,text) to authenticated;

create or replace function public.acknowledge_student_parent_complaint(p_complaint_id uuid)
returns public.student_parent_complaints
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.student_parent_complaints%rowtype;
  s public.core_students%rowtype;
  result_row public.student_parent_complaints%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into c from public.student_parent_complaints where id=p_complaint_id for update;
  if c.id is null then raise exception 'Complaint not found'; end if;
  select * into s from public.core_students where id=c.student_id;

  if not exists(
    select 1 from public.parent_student_links l
    where l.institution_id=c.institution_id
      and l.parent_user_id=auth.uid()
      and l.student_user_id=s.auth_user_id
      and l.status='approved'
  ) then raise exception 'Parent access denied'; end if;

  update public.student_parent_complaints
  set acknowledged_at=coalesce(acknowledged_at,now()),
      acknowledged_by=coalesce(acknowledged_by,auth.uid()),
      updated_at=now()
  where id=c.id
  returning * into result_row;

  if result_row.created_by<>auth.uid() then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
    values(c.institution_id,result_row.created_by,auth.uid(),'parent_complaint','Parent acknowledged complaint',left(result_row.subject,180));
  end if;

  return result_row;
end;
$$;
grant execute on function public.acknowledge_student_parent_complaint(uuid) to authenticated;

create or replace function public.resolve_student_parent_complaint(p_complaint_id uuid)
returns public.student_parent_complaints
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.student_parent_complaints%rowtype;
  result_row public.student_parent_complaints%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into c from public.student_parent_complaints where id=p_complaint_id for update;
  if c.id is null then raise exception 'Complaint not found'; end if;
  if not exists(select 1 from public.institutions i where i.id=c.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;

  update public.student_parent_complaints
  set status='Resolved',resolved_at=now(),resolved_by=auth.uid(),updated_at=now()
  where id=c.id
  returning * into result_row;

  return result_row;
end;
$$;
grant execute on function public.resolve_student_parent_complaint(uuid) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'parent-complaints','parent-complaints',false,26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "complaint creator uploads private media" on storage.objects;
create policy "complaint creator uploads private media" on storage.objects
for insert to authenticated
with check (
  bucket_id='parent-complaints'
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[2] is not null
  and exists(
    select 1 from public.student_parent_complaints c
    where c.id=(storage.foldername(name))[2]::uuid
      and c.institution_id::text=(storage.foldername(name))[1]
      and c.created_by=auth.uid()
  )
);

drop policy if exists "authorized users read private complaint media" on storage.objects;
create policy "authorized users read private complaint media" on storage.objects
for select to authenticated
using (
  bucket_id='parent-complaints'
  and exists(
    select 1
    from public.student_parent_complaints c
    join public.core_students s on s.id=c.student_id
    where c.id=(storage.foldername(name))[2]::uuid
      and c.institution_id::text=(storage.foldername(name))[1]
      and (
        c.created_by=auth.uid()
        or exists(select 1 from public.institutions i where i.id=c.institution_id and i.owner_user_id=auth.uid())
        or exists(
          select 1 from public.parent_student_links l
          where l.institution_id=c.institution_id
            and l.parent_user_id=auth.uid()
            and l.student_user_id=s.auth_user_id
            and l.status='approved'
        )
      )
  )
);

drop policy if exists "complaint creator or head deletes private media" on storage.objects;
create policy "complaint creator or head deletes private media" on storage.objects
for delete to authenticated
using (
  bucket_id='parent-complaints'
  and exists(
    select 1 from public.student_parent_complaints c
    where c.id=(storage.foldername(name))[2]::uuid
      and c.institution_id::text=(storage.foldername(name))[1]
      and (
        c.created_by=auth.uid()
        or exists(select 1 from public.institutions i where i.id=c.institution_id and i.owner_user_id=auth.uid())
      )
  )
);

commit;


