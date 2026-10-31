-- EduNizam Leave Requests canonical upgrade
-- Teacher/Student/Parent submit; School Admin only approves/rejects with required decision cause.

-- EduNizam leave workflow: Teacher/Student/Parent submissions, Admin-only final decision

alter table public.leave_requests
  alter column student_user_id drop not null,
  alter column student_name drop not null;

alter table public.leave_requests
  add column if not exists leave_for text not null default 'student',
  add column if not exists requester_name text;

alter table public.leave_requests
  drop constraint if exists leave_requests_requester_role_check,
  add constraint leave_requests_requester_role_check check (requester_role in ('student','parent','teacher')),
  drop constraint if exists leave_requests_leave_for_check,
  add constraint leave_requests_leave_for_check check (leave_for in ('student','staff')),
  drop constraint if exists leave_requests_reason_nonempty_check,
  add constraint leave_requests_reason_nonempty_check check (nullif(btrim(reason),'') is not null),
  drop constraint if exists leave_requests_decision_complete_check,
  add constraint leave_requests_decision_complete_check check (
    (status='Pending' and decided_by is null and decided_at is null)
    or
    (status in ('Approved','Rejected')
      and nullif(btrim(decision_note),'') is not null
      and decided_by is not null
      and decided_at is not null)
  );

drop policy if exists "heads manage institute leave" on public.leave_requests;
drop policy if exists "teachers decide assigned leave" on public.leave_requests;
drop policy if exists "students submit own leave" on public.leave_requests;
drop policy if exists "parents submit linked student leave" on public.leave_requests;
drop policy if exists "teachers manage assigned leave" on public.leave_requests;
drop policy if exists "heads read institute leave" on public.leave_requests;
drop policy if exists "heads decide institute leave" on public.leave_requests;
drop policy if exists "teachers submit own leave" on public.leave_requests;

create policy "students submit own leave" on public.leave_requests for insert to authenticated
with check (
  leave_for='student' and requester_role='student'
  and submitted_by=(select auth.uid()) and student_user_id=(select auth.uid())
  and public.is_institution_user(institution_id)
);

create policy "parents submit linked student leave" on public.leave_requests for insert to authenticated
with check (
  leave_for='student' and requester_role='parent' and submitted_by=(select auth.uid())
  and exists(
    select 1 from public.parent_student_links l
    where l.institution_id=leave_requests.institution_id
      and l.parent_user_id=(select auth.uid())
      and l.student_user_id=leave_requests.student_user_id
      and l.status='approved'
  )
);

create policy "teachers submit own leave" on public.leave_requests for insert to authenticated
with check (
  leave_for='staff' and requester_role='teacher' and submitted_by=(select auth.uid())
  and student_user_id is null
  and exists(
    select 1 from public.institution_members m
    where m.institution_id=leave_requests.institution_id
      and m.user_id=(select auth.uid()) and m.role='teacher'
  )
);

create policy "teachers manage assigned leave" on public.leave_requests for select to authenticated
using (
  leave_for='student' and public.current_account_role()='teacher'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=leave_requests.institution_id
      and tsl.teacher_user_id=(select auth.uid())
      and tsl.student_user_id=leave_requests.student_user_id
  )
);

create policy "heads read institute leave" on public.leave_requests for select to authenticated
using (
  exists(
    select 1 from public.institutions i
    where i.id=leave_requests.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

create policy "heads decide institute leave" on public.leave_requests for update to authenticated
using (
  status='Pending'
  and exists(
    select 1 from public.institutions i
    where i.id=leave_requests.institution_id
      and i.owner_user_id=(select auth.uid())
  )
)
with check (
  status in ('Approved','Rejected')
  and nullif(btrim(decision_note),'') is not null
  and decided_by=(select auth.uid())
  and decided_at is not null
  and exists(
    select 1 from public.institutions i
    where i.id=leave_requests.institution_id
      and i.owner_user_id=(select auth.uid())
  )
);

revoke all on table public.leave_requests from anon;
revoke delete, truncate, references, trigger on table public.leave_requests from authenticated;
revoke update on table public.leave_requests from authenticated;
grant select, insert on table public.leave_requests to authenticated;
grant update(status,decision_note,decided_by,decided_at,updated_at) on table public.leave_requests to authenticated;

create or replace function public.decide_leave_request_v1(
  p_request_id uuid,
  p_status text,
  p_decision_note text
)
returns table(
  id uuid,status text,decision_note text,student_user_id uuid,
  submitted_by uuid,requester_role text,leave_for text
)
language plpgsql
security invoker
set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('Approved','Rejected') then raise exception 'Decision must be Approved or Rejected'; end if;
  if nullif(btrim(coalesce(p_decision_note,'')),'') is null then raise exception 'Decision reason is required'; end if;

  return query
  update public.leave_requests lr
     set status=p_status,
         decision_note=btrim(p_decision_note),
         decided_by=(select auth.uid()),
         decided_at=now(),
         updated_at=now()
   where lr.id=p_request_id and lr.status='Pending'
  returning lr.id,lr.status,lr.decision_note,lr.student_user_id,lr.submitted_by,lr.requester_role,lr.leave_for;

  if not found then
    raise exception 'Leave request not found, already decided, or Admin access required';
  end if;
end;
$$;

revoke execute on function public.decide_leave_request_v1(uuid,text,text) from public;
revoke execute on function public.decide_leave_request_v1(uuid,text,text) from anon;
grant execute on function public.decide_leave_request_v1(uuid,text,text) to authenticated;


-- Approved leave -> attendance reconciliation
-- Approved student leave creates Leave attendance for missing/Absent dates.
-- Existing Present/Late rows are preserved. Sunday is skipped by default.

alter table public.attendance_records
  add column if not exists source text not null default 'manual',
  add column if not exists source_leave_request_id uuid references public.leave_requests(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='attendance_records_source_check'
      and conrelid='public.attendance_records'::regclass
  ) then
    alter table public.attendance_records
      add constraint attendance_records_source_check
      check (source in ('manual','approved_leave'));
  end if;
end $$;

create index if not exists attendance_records_leave_request_idx
  on public.attendance_records(source_leave_request_id)
  where source_leave_request_id is not null;

create or replace function public.decide_leave_request_v1(
  p_request_id uuid,
  p_status text,
  p_decision_note text
)
returns table(
  id uuid,status text,decision_note text,student_user_id uuid,
  submitted_by uuid,requester_role text,leave_for text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_leave public.leave_requests%rowtype;
  v_student public.core_students%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('Approved','Rejected') then raise exception 'Decision must be Approved or Rejected'; end if;
  if nullif(btrim(coalesce(p_decision_note,'')),'') is null then raise exception 'Decision reason is required'; end if;

  update public.leave_requests lr
     set status=p_status,
         decision_note=btrim(p_decision_note),
         decided_by=(select auth.uid()),
         decided_at=now(),
         updated_at=now()
   where lr.id=p_request_id and lr.status='Pending'
  returning lr.* into v_leave;

  if not found then
    raise exception 'Leave request not found, already decided, or Admin access required';
  end if;

  if v_leave.status='Approved'
     and v_leave.leave_for='student'
     and v_leave.student_user_id is not null then
    select * into v_student
    from public.core_students s
    where s.institution_id=v_leave.institution_id
      and s.auth_user_id=v_leave.student_user_id
    limit 1;

    if v_student.id is not null then
      insert into public.attendance_records(
        institution_id,student_id,attendance_date,status,marked_by,
        source,source_leave_request_id,updated_at
      )
      select v_leave.institution_id,v_student.id,gs::date,'Leave',(select auth.uid()),
             'approved_leave',v_leave.id,now()
      from generate_series(v_leave.from_date::timestamp,v_leave.to_date::timestamp,interval '1 day') gs
      where extract(isodow from gs) <> 7
      on conflict(student_id,attendance_date)
      do update set
        status='Leave',
        marked_by=(select auth.uid()),
        source='approved_leave',
        source_leave_request_id=v_leave.id,
        updated_at=now()
      where public.attendance_records.status='Absent'
         or public.attendance_records.source='approved_leave';
    end if;
  end if;

  return query select
    v_leave.id,v_leave.status,v_leave.decision_note,v_leave.student_user_id,
    v_leave.submitted_by,v_leave.requester_role,v_leave.leave_for;
end;
$$;

revoke execute on function public.decide_leave_request_v1(uuid,text,text) from public;
revoke execute on function public.decide_leave_request_v1(uuid,text,text) from anon;
grant execute on function public.decide_leave_request_v1(uuid,text,text) to authenticated;
