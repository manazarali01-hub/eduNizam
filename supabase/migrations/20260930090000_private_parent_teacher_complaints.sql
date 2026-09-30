-- EduNizam private parent-to-teacher complaints
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
  updated_at timestamptz not null default now()
);
create index if not exists parent_teacher_complaints_school_idx on public.parent_teacher_complaints(institution_id,created_at desc);
create index if not exists parent_teacher_complaints_parent_idx on public.parent_teacher_complaints(parent_user_id,created_at desc);
alter table public.parent_teacher_complaints enable row level security;

drop policy if exists "parent creator and admin read teacher complaints" on public.parent_teacher_complaints;
create policy "parent creator and admin read teacher complaints" on public.parent_teacher_complaints
for select to authenticated using (
  parent_user_id=(select auth.uid())
  or exists(select 1 from public.institutions i where i.id=parent_teacher_complaints.institution_id and i.owner_user_id=(select auth.uid()))
);

create or replace function public.create_parent_teacher_complaint_v1(
 p_institution_id uuid,p_teacher_user_id uuid,p_subject text,p_message text,p_severity text
) returns public.parent_teacher_complaints
language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); r public.parent_teacher_complaints%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if nullif(btrim(coalesce(p_subject,'')),'') is null or nullif(btrim(coalesce(p_message,'')),'') is null then raise exception 'Subject and complaint message required'; end if;
 if p_severity not in ('Information','Concern','Serious') then raise exception 'Invalid severity'; end if;
 if not exists(select 1 from public.institution_members m where m.institution_id=p_institution_id and m.user_id=uid and m.role='parent' and coalesce(m.approved,true)=true) then raise exception 'Approved parent membership required'; end if;
 if not exists(select 1 from public.institution_members m where m.institution_id=p_institution_id and m.user_id=p_teacher_user_id and m.role='teacher' and coalesce(m.approved,true)=true) then raise exception 'Teacher not found in this school'; end if;
 insert into public.parent_teacher_complaints(institution_id,teacher_user_id,parent_user_id,subject,message,severity)
 values(p_institution_id,p_teacher_user_id,uid,btrim(p_subject),btrim(p_message),p_severity) returning * into r;
 insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
 select p_institution_id,i.owner_user_id,uid,'private_complaint','Private parent complaint',left(r.subject,180)
 from public.institutions i where i.id=p_institution_id;
 return r;
end;$$;
revoke execute on function public.create_parent_teacher_complaint_v1(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.create_parent_teacher_complaint_v1(uuid,uuid,text,text,text) to authenticated;

create or replace function public.resolve_parent_teacher_complaint_v1(p_complaint_id uuid,p_admin_note text)
returns public.parent_teacher_complaints language plpgsql security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid()); c public.parent_teacher_complaints%rowtype;
begin
 select * into c from public.parent_teacher_complaints where id=p_complaint_id for update;
 if c.id is null then raise exception 'Complaint not found'; end if;
 if not exists(select 1 from public.institutions i where i.id=c.institution_id and i.owner_user_id=uid) then raise exception 'Admin access required'; end if;
 update public.parent_teacher_complaints set status='Resolved',admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),resolved_at=now(),resolved_by=uid,updated_at=now()
 where id=c.id returning * into c;
 return c;
end;$$;
revoke execute on function public.resolve_parent_teacher_complaint_v1(uuid,text) from public,anon;
grant execute on function public.resolve_parent_teacher_complaint_v1(uuid,text) to authenticated;

commit;