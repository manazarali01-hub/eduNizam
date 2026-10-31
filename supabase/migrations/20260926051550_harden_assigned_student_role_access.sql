-- Applied in Supabase migration history: harden_assigned_student_role_access

create or replace function private.can_access_core_student_v2(
  p_student_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_user_id is not null and exists(
    select 1
    from public.core_students s
    where s.id=p_student_id
      and (
        exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=p_user_id)
        or s.auth_user_id=p_user_id
        or exists(
          select 1 from public.teacher_student_links t
          where t.institution_id=s.institution_id
            and t.teacher_user_id=p_user_id
            and t.student_user_id=s.auth_user_id
        )
        or exists(
          select 1 from public.parent_student_links l
          where l.institution_id=s.institution_id
            and l.parent_user_id=p_user_id
            and l.student_user_id=s.auth_user_id
            and l.status='approved'
        )
      )
  );
$$;

revoke execute on function private.can_access_core_student_v2(uuid,uuid) from public,anon;
grant execute on function private.can_access_core_student_v2(uuid,uuid) to authenticated;

create or replace function private.can_manage_core_student_v1(
  p_student_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_user_id is not null and exists(
    select 1
    from public.core_students s
    where s.id=p_student_id
      and (
        exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=p_user_id)
        or exists(
          select 1 from public.teacher_student_links t
          where t.institution_id=s.institution_id
            and t.teacher_user_id=p_user_id
            and t.student_user_id=s.auth_user_id
        )
      )
  );
$$;

revoke execute on function private.can_manage_core_student_v1(uuid,uuid) from public,anon;
grant execute on function private.can_manage_core_student_v1(uuid,uuid) to authenticated;

create or replace function public.can_access_core_student(target_student uuid)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select private.can_access_core_student_v2(target_student,(select auth.uid()));
$$;

revoke execute on function public.can_access_core_student(uuid) from public,anon;
grant execute on function public.can_access_core_student(uuid) to authenticated;

drop policy if exists "staff manage students" on public.core_students;
drop policy if exists "users read accessible students" on public.core_students;
drop policy if exists "heads manage students" on public.core_students;
create policy "users read accessible students" on public.core_students for select to authenticated
using (public.can_access_core_student(id));
create policy "heads manage students" on public.core_students for all to authenticated
using ((select private.is_institution_owner(institution_id,(select auth.uid()))))
with check ((select private.is_institution_owner(institution_id,(select auth.uid()))));

drop policy if exists "staff manage attendance" on public.attendance_records;
drop policy if exists "users read accessible attendance" on public.attendance_records;
drop policy if exists "heads teachers manage assigned attendance" on public.attendance_records;
create policy "users read accessible attendance" on public.attendance_records for select to authenticated
using (public.can_access_core_student(student_id));
create policy "heads teachers manage assigned attendance" on public.attendance_records for all to authenticated
using ((select private.can_manage_core_student_v1(student_id,(select auth.uid()))))
with check ((select private.can_manage_core_student_v1(student_id,(select auth.uid()))));

drop policy if exists "staff manage results" on public.result_records;
drop policy if exists "users read accessible results" on public.result_records;
drop policy if exists "heads teachers manage assigned results" on public.result_records;
create policy "users read accessible results" on public.result_records for select to authenticated
using (public.can_access_core_student(student_id));
create policy "heads teachers manage assigned results" on public.result_records for all to authenticated
using ((select private.can_manage_core_student_v1(student_id,(select auth.uid()))))
with check ((select private.can_manage_core_student_v1(student_id,(select auth.uid()))));

drop policy if exists "staff manage remarks" on public.student_remarks;
drop policy if exists "users read accessible remarks" on public.student_remarks;
drop policy if exists "heads teachers manage assigned remarks" on public.student_remarks;
create policy "users read accessible remarks" on public.student_remarks for select to authenticated
using (public.can_access_core_student(student_id));
create policy "heads teachers manage assigned remarks" on public.student_remarks for all to authenticated
using ((select private.can_manage_core_student_v1(student_id,(select auth.uid()))))
with check ((select private.can_manage_core_student_v1(student_id,(select auth.uid()))));

drop policy if exists "staff manage fees" on public.fee_records;
drop policy if exists "users read accessible fees" on public.fee_records;
drop policy if exists "heads manage fees" on public.fee_records;
create policy "users read accessible fees" on public.fee_records for select to authenticated
using (public.can_access_core_student(student_id));
create policy "heads manage fees" on public.fee_records for all to authenticated
using ((select private.is_institution_owner(institution_id,(select auth.uid()))))
with check ((select private.is_institution_owner(institution_id,(select auth.uid()))));
