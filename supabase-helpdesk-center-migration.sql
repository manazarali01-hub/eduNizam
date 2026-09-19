-- EduNizam Helpdesk & Complaint Center upgrade migration
-- =========================================================
-- EduNizam Helpdesk & Complaint Center
-- =========================================================
begin;

create table if not exists public.school_helpdesk_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid references public.core_students(id) on delete set null,
  category text not null check (category in ('Academics','Attendance','Fees','Transport','Behavior','Facilities','Technical','Admission','Other')),
  priority text not null default 'Normal' check (priority in ('Low','Normal','High')),
  subject text not null,
  description text not null,
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed')),
  admin_response text,
  creator_role text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists school_helpdesk_institution_status_idx on public.school_helpdesk_tickets(institution_id,status,created_at desc);
create index if not exists school_helpdesk_creator_idx on public.school_helpdesk_tickets(created_by,created_at desc);
alter table public.school_helpdesk_tickets enable row level security;

drop policy if exists "head or creator reads helpdesk tickets" on public.school_helpdesk_tickets;
create policy "head or creator reads helpdesk tickets" on public.school_helpdesk_tickets
for select to authenticated
using (
  created_by=auth.uid()
  or exists(select 1 from public.institutions i where i.id=school_helpdesk_tickets.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "heads update helpdesk tickets" on public.school_helpdesk_tickets;
create policy "heads update helpdesk tickets" on public.school_helpdesk_tickets
for update to authenticated
using (exists(select 1 from public.institutions i where i.id=school_helpdesk_tickets.institution_id and i.owner_user_id=auth.uid()))
with check (exists(select 1 from public.institutions i where i.id=school_helpdesk_tickets.institution_id and i.owner_user_id=auth.uid()));

create or replace function public.create_helpdesk_ticket(
  p_institution_id uuid,
  p_student_id uuid,
  p_category text,
  p_priority text,
  p_subject text,
  p_description text
)
returns public.school_helpdesk_tickets
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.core_students%rowtype;
  r text;
  v_id uuid:=gen_random_uuid();
  result_row public.school_helpdesk_tickets%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_institution_user(p_institution_id) then raise exception 'Institution access denied'; end if;
  if p_category not in ('Academics','Attendance','Fees','Transport','Behavior','Facilities','Technical','Admission','Other') then raise exception 'Invalid category'; end if;
  if p_priority not in ('Low','Normal','High') then raise exception 'Invalid priority'; end if;
  if nullif(trim(p_subject),'') is null or nullif(trim(p_description),'') is null then raise exception 'Subject and description required'; end if;

  r:=public.current_account_role();

  if p_student_id is not null then
    select * into s from public.core_students where id=p_student_id and institution_id=p_institution_id;
    if s.id is null then raise exception 'Student not found in institution'; end if;

    if r='teacher' and not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=p_institution_id and tsl.teacher_user_id=auth.uid() and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher student context is not assigned'; end if;

    if r='student' and s.auth_user_id<>auth.uid() then raise exception 'Student context access denied'; end if;

    if r='parent' and not exists(
      select 1 from public.parent_student_links l
      where l.institution_id=p_institution_id and l.parent_user_id=auth.uid() and l.student_user_id=s.auth_user_id and l.status='approved'
    ) then raise exception 'Parent student context is not linked'; end if;
  end if;

  insert into public.school_helpdesk_tickets(
    id,ticket_no,institution_id,student_id,category,priority,subject,description,status,creator_role,created_by
  ) values(
    v_id,
    'HD-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,6)),
    p_institution_id,p_student_id,p_category,p_priority,trim(p_subject),trim(p_description),'Open',r,auth.uid()
  )
  returning * into result_row;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
  select i.id,i.owner_user_id,auth.uid(),'helpdesk','New helpdesk ticket',left(result_row.ticket_no||' · '||result_row.subject,180)
  from public.institutions i
  where i.id=p_institution_id and i.owner_user_id<>auth.uid();

  return result_row;
end;
$$;
grant execute on function public.create_helpdesk_ticket(uuid,uuid,text,text,text,text) to authenticated;

create or replace function public.update_helpdesk_ticket(
  p_ticket_id uuid,
  p_status text,
  p_admin_response text
)
returns public.school_helpdesk_tickets
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.school_helpdesk_tickets%rowtype;
  result_row public.school_helpdesk_tickets%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('Open','In Progress','Resolved','Closed') then raise exception 'Invalid status'; end if;

  select * into t from public.school_helpdesk_tickets where id=p_ticket_id for update;
  if t.id is null then raise exception 'Ticket not found'; end if;
  if not exists(select 1 from public.institutions i where i.id=t.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;

  update public.school_helpdesk_tickets
  set status=p_status,
      admin_response=case when p_admin_response is null then admin_response else nullif(trim(p_admin_response),'') end,
      resolved_at=case when p_status='Resolved' then coalesce(resolved_at,now()) when p_status in ('Open','In Progress') then null else resolved_at end,
      updated_at=now()
  where id=t.id
  returning * into result_row;

  if result_row.created_by<>auth.uid() then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
    values(result_row.institution_id,result_row.created_by,auth.uid(),'helpdesk','Helpdesk ticket updated',left(result_row.ticket_no||' · '||result_row.status,180));
  end if;

  return result_row;
end;
$$;
grant execute on function public.update_helpdesk_ticket(uuid,text,text) to authenticated;

commit;


