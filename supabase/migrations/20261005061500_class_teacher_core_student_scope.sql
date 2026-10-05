-- Align core student access/management with class-teacher assignments.
-- A Teacher may access/manage academic records only while actively attached to the
-- institution and either explicitly linked to the student or assigned as the
-- active class teacher for that student's exact class/section.

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
        exists(
          select 1
          from public.institutions i
          where i.id=s.institution_id
            and i.owner_user_id=p_user_id
        )
        or s.auth_user_id=p_user_id
        or (
          exists(
            select 1
            from public.institution_members m
            where m.institution_id=s.institution_id
              and m.user_id=p_user_id
              and m.role='teacher'
          )
          and (
            exists(
              select 1
              from public.teacher_student_links t
              where t.institution_id=s.institution_id
                and t.teacher_user_id=p_user_id
                and t.student_user_id=s.auth_user_id
            )
            or exists(
              select 1
              from public.class_sections cs
              where cs.institution_id=s.institution_id
                and cs.class_teacher_user_id=p_user_id
                and coalesce(cs.active,true)=true
                and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
                and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
            )
          )
        )
        or exists(
          select 1
          from public.parent_student_links l
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
        exists(
          select 1
          from public.institutions i
          where i.id=s.institution_id
            and i.owner_user_id=p_user_id
        )
        or (
          exists(
            select 1
            from public.institution_members m
            where m.institution_id=s.institution_id
              and m.user_id=p_user_id
              and m.role='teacher'
          )
          and (
            exists(
              select 1
              from public.teacher_student_links t
              where t.institution_id=s.institution_id
                and t.teacher_user_id=p_user_id
                and t.student_user_id=s.auth_user_id
            )
            or exists(
              select 1
              from public.class_sections cs
              where cs.institution_id=s.institution_id
                and cs.class_teacher_user_id=p_user_id
                and coalesce(cs.active,true)=true
                and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
                and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
            )
          )
        )
      )
  );
$$;

revoke execute on function private.can_manage_core_student_v1(uuid,uuid) from public,anon;
grant execute on function private.can_manage_core_student_v1(uuid,uuid) to authenticated;
