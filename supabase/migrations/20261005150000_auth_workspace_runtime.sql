-- EduNizam auth/workspace production runtime hardening.
-- Applied to production on 2026-10-05. This file keeps repository migration history reproducible.

create or replace function public.my_authorized_workspaces()
returns table(
  institution_id uuid,
  institution_name text,
  institution_type text,
  registration_number text,
  school_registration_code text,
  workspace_role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with owned as (
    select
      i.id as institution_id,
      i.name as institution_name,
      i.institution_type,
      i.registration_number,
      i.school_registration_code,
      'head_of_institute'::text as workspace_role,
      0 as role_rank
    from public.institutions i
    where i.owner_user_id = (select auth.uid())
  ),
  member as (
    select
      i.id as institution_id,
      i.name as institution_name,
      i.institution_type,
      i.registration_number,
      i.school_registration_code,
      m.role::text as workspace_role,
      case m.role when 'teacher' then 1 when 'parent' then 2 when 'student' then 3 else 9 end as role_rank
    from public.institution_members m
    join public.institutions i on i.id = m.institution_id
    where m.user_id = (select auth.uid())
      and m.role in ('teacher','parent','student')
  ),
  combined as (
    select * from owned
    union all
    select * from member
  )
  select distinct on (institution_id)
    institution_id,
    institution_name,
    institution_type,
    registration_number,
    school_registration_code,
    workspace_role
  from combined
  order by institution_id, role_rank;
$$;

revoke all on function public.my_authorized_workspaces() from public;
grant execute on function public.my_authorized_workspaces() to authenticated;

create index if not exists attendance_records_institution_date_idx
  on public.attendance_records (institution_id, attendance_date);

create index if not exists staff_attendance_records_institution_date_idx
  on public.staff_attendance_records (institution_id, attendance_date);

create index if not exists school_access_requests_requester_role_status_idx
  on public.school_access_requests (requester_user_id, requested_role, status, updated_at desc);

create index if not exists core_students_institution_created_idx
  on public.core_students (institution_id, created_at);
