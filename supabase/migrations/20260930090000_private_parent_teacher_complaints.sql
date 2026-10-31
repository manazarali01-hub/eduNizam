-- EduNizam private Parent -> Teacher complaints
-- Complaint content is visible only to the parent creator and Head/Admin.
-- Teachers are selectable through a narrow directory RPC but cannot read complaint content.

begin;

create table if not exists public.parent_teacher_complaints (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  severity text not null default 'Concern' check (severity in ('Information','Concern','Serious')),
  status text not null default 'Open' check (status in ('Open','Resolved')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(subject))>=3),
  check (char_length(btrim(message))>=3)
);

create index if not exists parent_teacher_complaints_school_idx
  on public.parent_teacher_complaints(institution_id,created_at desc);
create index if not exists parent_teacher_complaints_parent_idx
  on public.parent_teacher_complaints(parent_user_id,created_at desc);
create index if not exists parent_teacher_complaints_teacher_idx
  on public.parent_teacher_complaints(teacher_user_id);

alter table public.parent_teacher_complaints enable row level security;

drop policy if exists "parent creator and admin read teacher complaints" on public.parent_teacher_complaints;
create policy "parent creator and admin read teacher complaints"
on public.parent_teacher_complaints for select to authenticated
using (
  parent_user_id=(select auth.uid())
  or exists(
    select 1 from public.institutions i
    where i.id=parent_teacher_complaints.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

drop policy if exists "parents create private teacher complaints" on public.parent_teacher_complaints;
create policy "parents create private teacher complaints"
on public.parent_teacher_complaints for insert to authenticated
with check (
  parent_user_id=(select auth.uid())
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=parent_teacher_complaints.institution_id
      and m.user_id=(select auth.uid())
      and m.role='parent'
  )
  and exists(
    select 1 from public.institution_members t
    where t.institution_id=parent_teacher_complaints.institution_id
      and t.user_id=parent_teacher_complaints.teacher_user_id
      and t.role='teacher'
  )
);

drop policy if exists "head resolves private teacher complaints" on public.parent_teacher_complaints;
create policy "head resolves private teacher complaints"
on public.parent_teacher_complaints for update to authenticated
using (
  exists(
    select 1 from public.institutions i
    where i.id=parent_teacher_complaints.institution_id
      and i.owner_user_id=(select auth.uid())
  )
)
with check (
  exists(
    select 1 from public.institutions i
    where i.id=parent_teacher_complaints.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

revoke all on public.parent_teacher_complaints from anon;
revoke delete,truncate,references,trigger on public.parent_teacher_complaints from authenticated;
grant select,insert on public.parent_teacher_complaints to authenticated;
grant update(status,admin_note,resolved_at,resolved_by,updated_at) on public.parent_teacher_complaints to authenticated;

create or replace function public.create_parent_teacher_complaint_v1(
  p_institution_id uuid,p_teacher_user_id uuid,p_subject text,p_message text,p_severity text
)
returns public.parent_teacher_complaints
language plpgsql security invoker set search_path=''
as $$
declare uid uuid := (select auth.uid()); r public.parent_teacher_complaints%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_subject,'')),'') is null
     or nullif(btrim(coalesce(p_message,'')),'') is null then
    raise exception 'Subject and complaint message required';
  end if;
  if p_severity not in ('Information','Concern','Serious') then raise exception 'Invalid severity'; end if;

  insert into public.parent_teacher_complaints(
    institution_id,teacher_user_id,parent_user_id,subject,message,severity
  )
  values(
    p_institution_id,p_teacher_user_id,uid,btrim(p_subject),btrim(p_message),p_severity
  )
  returning * into r;
  return r;
end;
$$;

revoke execute on function public.create_parent_teacher_complaint_v1(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.create_parent_teacher_complaint_v1(uuid,uuid,text,text,text) to authenticated;

create or replace function public.resolve_parent_teacher_complaint_v1(p_complaint_id uuid,p_admin_note text)
returns public.parent_teacher_complaints
language plpgsql security invoker set search_path=''
as $$
declare uid uuid := (select auth.uid()); c public.parent_teacher_complaints%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  update public.parent_teacher_complaints
  set status='Resolved',
      admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),
      resolved_at=now(),
      resolved_by=uid,
      updated_at=now()
  where id=p_complaint_id and status='Open'
  returning * into c;
  if c.id is null then raise exception 'Complaint not found, already resolved, or Admin access required'; end if;
  return c;
end;
$$;

revoke execute on function public.resolve_parent_teacher_complaint_v1(uuid,text) from public,anon;
grant execute on function public.resolve_parent_teacher_complaint_v1(uuid,text) to authenticated;

create or replace function public.list_parent_teacher_directory_v1(p_institution_id uuid)
returns table(user_id uuid,full_name text,designation text)
language sql stable security definer set search_path=''
as $$
  select sp.user_id,sp.full_name,sp.designation
  from public.staff_profiles sp
  join public.institution_members tm
    on tm.institution_id=sp.institution_id
   and tm.user_id=sp.user_id
   and tm.role='teacher'
  where sp.institution_id=p_institution_id
    and sp.user_id is not null
    and (
      exists(
        select 1 from public.institution_members me
        where me.institution_id=p_institution_id
          and me.user_id=(select auth.uid())
          and me.role='parent'
      )
      or exists(
        select 1 from public.institutions i
        where i.id=p_institution_id
          and i.owner_user_id=(select auth.uid())
      )
    )
  order by coalesce(sp.full_name,''),sp.user_id;
$$;

revoke execute on function public.list_parent_teacher_directory_v1(uuid) from public,anon;
grant execute on function public.list_parent_teacher_directory_v1(uuid) to authenticated;

create or replace function private.notify_private_parent_teacher_complaint_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  select new.institution_id,i.owner_user_id,new.parent_user_id,
         'private_complaint','Private parent complaint',left(new.subject,180)
  from public.institutions i
  where i.id=new.institution_id
    and i.owner_user_id<>new.parent_user_id;
  return new;
end;
$$;

drop trigger if exists parent_teacher_complaint_notify_admin on public.parent_teacher_complaints;
create trigger parent_teacher_complaint_notify_admin
after insert on public.parent_teacher_complaints
for each row execute function private.notify_private_parent_teacher_complaint_v1();

commit;
