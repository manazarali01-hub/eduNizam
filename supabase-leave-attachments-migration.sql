-- EduNizam private leave-request attachments
alter table public.leave_requests
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'leave-request-files',
  'leave-request-files',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "authorized users read leave attachments" on storage.objects;
create policy "authorized users read leave attachments"
on storage.objects for select to authenticated
using (
  bucket_id='leave-request-files'
  and exists(
    select 1
    from public.leave_requests lr
    where lr.id=((storage.foldername(objects.name))[2])::uuid
      and lr.institution_id::text=(storage.foldername(objects.name))[1]
      and (
        lr.submitted_by=(select auth.uid())
        or lr.student_user_id=(select auth.uid())
        or exists(
          select 1 from public.institutions i
          where i.id=lr.institution_id and i.owner_user_id=(select auth.uid())
        )
        or (
          lr.leave_for='student'
          and exists(
            select 1 from public.teacher_student_links tsl
            where tsl.institution_id=lr.institution_id
              and tsl.teacher_user_id=(select auth.uid())
              and tsl.student_user_id=lr.student_user_id
          )
        )
        or (
          lr.leave_for='student'
          and exists(
            select 1 from public.parent_student_links psl
            where psl.institution_id=lr.institution_id
              and psl.parent_user_id=(select auth.uid())
              and psl.student_user_id=lr.student_user_id
              and psl.status='approved'
          )
        )
      )
  )
);

drop policy if exists "requesters upload leave attachments" on storage.objects;
create policy "requesters upload leave attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id='leave-request-files'
  and (storage.foldername(name))[3]=(select auth.uid())::text
  and exists(
    select 1
    from public.leave_requests lr
    where lr.id=((storage.foldername(objects.name))[2])::uuid
      and lr.institution_id::text=(storage.foldername(objects.name))[1]
      and lr.submitted_by=(select auth.uid())
      and lr.status='Pending'
  )
);

drop policy if exists "requesters delete pending leave attachments" on storage.objects;
create policy "requesters delete pending leave attachments"
on storage.objects for delete to authenticated
using (
  bucket_id='leave-request-files'
  and exists(
    select 1
    from public.leave_requests lr
    where lr.id=((storage.foldername(objects.name))[2])::uuid
      and lr.institution_id::text=(storage.foldername(objects.name))[1]
      and lr.submitted_by=(select auth.uid())
      and lr.status='Pending'
  )
);

create or replace function public.attach_leave_file_v1(
  p_request_id uuid,
  p_storage_path text,
  p_name text,
  p_type text
)
returns public.leave_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.leave_requests;
  v_uid uuid := (select auth.uid());
  v_prefix text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_storage_path,'')),'') is null then raise exception 'Storage path required'; end if;

  select * into v_row
  from public.leave_requests
  where id=p_request_id;

  if v_row.id is null then raise exception 'Leave request not found'; end if;
  if v_row.submitted_by<>v_uid then raise exception 'Only the requester can attach a file'; end if;
  if v_row.status<>'Pending' then raise exception 'Attachments can only be changed while leave is pending'; end if;

  v_prefix := v_row.institution_id::text||'/'||p_request_id::text||'/'||v_uid::text||'/';
  if left(p_storage_path,length(v_prefix))<>v_prefix then
    raise exception 'Invalid attachment path';
  end if;

  update public.leave_requests
     set attachment_path=p_storage_path,
         attachment_name=nullif(btrim(coalesce(p_name,'')),''),
         attachment_type=nullif(btrim(coalesce(p_type,'')),''),
         updated_at=now()
   where id=p_request_id
   returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.attach_leave_file_v1(uuid,text,text,text) from public;
revoke execute on function public.attach_leave_file_v1(uuid,text,text,text) from anon;
grant execute on function public.attach_leave_file_v1(uuid,text,text,text) to authenticated;
