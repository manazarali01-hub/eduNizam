-- Optimize authenticated workspace discovery without weakening authorization.
-- Applied to production on 2026-10-06 after measuring the existing RPC under
-- an authenticated Head of Institute context.
--
-- Before: ~4.56 ms execution, 850 shared buffer hits for the measured call.
-- After:  ~0.78 ms execution, 3 shared buffer hits for the same 4 workspaces.
--
-- The public RPC remains SECURITY INVOKER and accepts no user-id parameter.
-- It can only pass the caller's auth.uid() to the private SECURITY DEFINER
-- implementation, which is not exposed as a public PostgREST RPC.

create or replace function private.my_authorized_workspaces_v1(p_user_id uuid)
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
security definer
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
    where p_user_id is not null
      and i.owner_user_id = p_user_id
  ),
  member as (
    select
      i.id as institution_id,
      i.name as institution_name,
      i.institution_type,
      i.registration_number,
      i.school_registration_code,
      m.role::text as workspace_role,
      case m.role
        when 'teacher' then 1
        when 'parent' then 2
        when 'student' then 3
        else 9
      end as role_rank
    from public.institution_members m
    join public.institutions i on i.id = m.institution_id
    where p_user_id is not null
      and m.user_id = p_user_id
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

revoke all on function private.my_authorized_workspaces_v1(uuid) from public, anon;
grant execute on function private.my_authorized_workspaces_v1(uuid) to authenticated;

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
  select *
  from private.my_authorized_workspaces_v1((select auth.uid()));
$$;

revoke all on function public.my_authorized_workspaces() from public, anon;
grant execute on function public.my_authorized_workspaces() to authenticated;


-- Avoid re-entering public.institutions RLS during hot owner checks.
-- These expressions are authorization-equivalent to the prior direct EXISTS
-- checks, but use the already-hardened private owner helper.

alter policy "head manage staff profiles"
on public.staff_profiles
using (
  (select private.is_institution_owner(
    staff_profiles.institution_id,
    (select auth.uid())
  ))
)
with check (
  (select private.is_institution_owner(
    staff_profiles.institution_id,
    (select auth.uid())
  ))
  and (
    staff_profiles.user_id is null
    or exists (
      select 1
      from public.institution_members m
      where m.institution_id = staff_profiles.institution_id
        and m.user_id = staff_profiles.user_id
        and m.role = 'teacher'
    )
  )
);

alter policy "heads manage class sections"
on public.class_sections
using (
  (select private.is_institution_owner(
    class_sections.institution_id,
    (select auth.uid())
  ))
)
with check (
  (select private.is_institution_owner(
    class_sections.institution_id,
    (select auth.uid())
  ))
  and (
    class_sections.class_teacher_user_id is null
    or exists (
      select 1
      from public.institution_members m
      where m.institution_id = class_sections.institution_id
        and m.user_id = class_sections.class_teacher_user_id
        and m.role = 'teacher'
    )
  )
);

alter policy "head manage teacher student links"
on public.teacher_student_links
using (
  (select private.is_institution_owner(
    teacher_student_links.institution_id,
    (select auth.uid())
  ))
)
with check (
  (select private.is_institution_owner(
    teacher_student_links.institution_id,
    (select auth.uid())
  ))
);
