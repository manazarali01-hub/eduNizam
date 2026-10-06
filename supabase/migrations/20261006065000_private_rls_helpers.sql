-- Move RLS-only SECURITY DEFINER helpers out of the exposed public API schema.
-- Applied to production on 2026-10-06 after a rollback-only Teacher/Student/Parent
-- regression test covering lesson plans, syllabus, calendar events and notices.

create or replace function private.can_manage_teaching_class_v1(
  p_institution_id uuid,p_class_name text,p_section_name text,p_user_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select p_user_id is not null and (
    exists(select 1 from public.institutions i where i.id=p_institution_id and i.owner_user_id=p_user_id)
    or exists(
      select 1
      from public.teacher_student_links tsl
      join public.core_students s
        on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      where tsl.institution_id=p_institution_id
        and tsl.teacher_user_id=p_user_id
        and s.class_name=p_class_name
        and (coalesce(p_section_name,'')='' or coalesce(s.section_name,'')=coalesce(p_section_name,''))
    )
  );
$$;

create or replace function private.can_view_family_class_v1(
  p_institution_id uuid,p_class_name text,p_section_name text,p_user_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select p_user_id is not null and (
    exists(
      select 1 from public.core_students s
      where s.institution_id=p_institution_id and s.auth_user_id=p_user_id
        and s.class_name=p_class_name
        and (coalesce(p_section_name,'')='' or coalesce(s.section_name,'')=coalesce(p_section_name,''))
    )
    or exists(
      select 1
      from public.parent_student_links l
      join public.core_students s
        on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      where l.institution_id=p_institution_id and l.parent_user_id=p_user_id
        and l.status='approved' and s.class_name=p_class_name
        and (coalesce(p_section_name,'')='' or coalesce(s.section_name,'')=coalesce(p_section_name,''))
    )
  );
$$;

create or replace function private.can_read_school_calendar_event_v1(
  e public.school_calendar_events,p_user_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select p_user_id is not null and (
    exists(select 1 from public.institutions i where i.id=e.institution_id and i.owner_user_id=p_user_id)
    or exists(select 1 from public.institution_members m where m.institution_id=e.institution_id and m.user_id=p_user_id)
    or (
      exists(select 1 from public.user_profiles p where p.user_id=p_user_id and p.institution_id=e.institution_id and p.account_role='student')
      and (
        e.audience in ('all','students')
        or (e.audience='class' and exists(
          select 1 from public.core_students s
          where s.institution_id=e.institution_id and s.auth_user_id=p_user_id
            and s.class_name=e.class_name
            and (e.section_name is null or e.section_name='' or coalesce(s.section_name,'')=e.section_name)
        ))
      )
    )
    or (
      exists(select 1 from public.user_profiles p where p.user_id=p_user_id and p.institution_id=e.institution_id and p.account_role='parent')
      and (
        e.audience in ('all','parents')
        or (e.audience='class' and exists(
          select 1
          from public.parent_student_links l
          join public.core_students s on s.auth_user_id=l.student_user_id
          where l.parent_user_id=p_user_id and l.status='approved'
            and l.institution_id=e.institution_id and s.institution_id=e.institution_id
            and s.class_name=e.class_name
            and (e.section_name is null or e.section_name='' or coalesce(s.section_name,'')=e.section_name)
        ))
      )
    )
  );
$$;

create or replace function private.can_view_school_notice_v1(
  n public.school_announcements,p_user_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  with account_role as (
    select coalesce(
      (select 'head_of_institute'::text from public.institutions i where i.owner_user_id=p_user_id limit 1),
      (
        select m.role from public.institution_members m
        where m.user_id=p_user_id and m.role in ('teacher','parent','student')
        order by case m.role when 'teacher' then 1 when 'parent' then 2 else 3 end
        limit 1
      )
    ) as role
  )
  select p_user_id is not null and (
    exists(select 1 from public.institutions i where i.id=n.institution_id and i.owner_user_id=p_user_id)
    or (
      (select role from account_role)='teacher'
      and (
        exists(select 1 from public.institutions i where i.id=n.institution_id and i.owner_user_id=p_user_id)
        or exists(select 1 from public.institution_members m where m.institution_id=n.institution_id and m.user_id=p_user_id and m.role='teacher')
      )
      and (n.audience in ('all','teachers','students','parents') or n.audience='class')
    )
    or (
      (select role from account_role)='student'
      and (n.valid_until is null or n.valid_until>=current_date)
      and (
        n.audience in ('all','students')
        or (n.audience='class' and exists(
          select 1 from public.core_students s
          where s.institution_id=n.institution_id and s.auth_user_id=p_user_id
            and s.class_name=n.class_name
            and (coalesce(n.section_name,'')='' or coalesce(s.section_name,'')=coalesce(n.section_name,''))
        ))
      )
    )
    or (
      (select role from account_role)='parent'
      and (n.valid_until is null or n.valid_until>=current_date)
      and (
        n.audience in ('all','parents')
        or (n.audience='class' and exists(
          select 1
          from public.parent_student_links l
          join public.core_students s
            on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
          where l.institution_id=n.institution_id and l.parent_user_id=p_user_id
            and l.status='approved' and s.class_name=n.class_name
            and (coalesce(n.section_name,'')='' or coalesce(s.section_name,'')=coalesce(n.section_name,''))
        ))
      )
    )
  );
$$;

revoke all on function private.can_manage_teaching_class_v1(uuid,text,text,uuid) from public,anon;
revoke all on function private.can_view_family_class_v1(uuid,text,text,uuid) from public,anon;
revoke all on function private.can_read_school_calendar_event_v1(public.school_calendar_events,uuid) from public,anon;
revoke all on function private.can_view_school_notice_v1(public.school_announcements,uuid) from public,anon;
grant execute on function private.can_manage_teaching_class_v1(uuid,text,text,uuid) to authenticated;
grant execute on function private.can_view_family_class_v1(uuid,text,text,uuid) to authenticated;
grant execute on function private.can_read_school_calendar_event_v1(public.school_calendar_events,uuid) to authenticated;
grant execute on function private.can_view_school_notice_v1(public.school_announcements,uuid) to authenticated;

alter policy "staff read lesson plans" on public.lesson_plans
using (
  (select private.is_institution_owner(lesson_plans.institution_id,(select auth.uid())))
  or (created_by=(select auth.uid()) and private.can_manage_teaching_class_v1(institution_id,class_name,section_name,(select auth.uid())))
  or (status='Published' and private.can_view_family_class_v1(institution_id,class_name,section_name,(select auth.uid())))
);

alter policy "teachers and heads manage lesson plans" on public.lesson_plans
using (
  (select private.is_institution_owner(lesson_plans.institution_id,(select auth.uid())))
  or (created_by=(select auth.uid()) and private.can_manage_teaching_class_v1(institution_id,class_name,section_name,(select auth.uid())))
)
with check (
  private.can_manage_teaching_class_v1(institution_id,class_name,section_name,(select auth.uid()))
  and ((select private.is_institution_owner(lesson_plans.institution_id,(select auth.uid()))) or created_by=(select auth.uid()))
);

alter policy "authorized users read syllabus progress" on public.syllabus_progress_units
using (
  (select private.is_institution_owner(syllabus_progress_units.institution_id,(select auth.uid())))
  or (created_by=(select auth.uid()) and private.can_manage_teaching_class_v1(institution_id,class_name,section_name,(select auth.uid())))
  or (family_visible and private.can_view_family_class_v1(institution_id,class_name,section_name,(select auth.uid())))
);

alter policy "teachers and heads manage syllabus progress" on public.syllabus_progress_units
using (
  (select private.is_institution_owner(syllabus_progress_units.institution_id,(select auth.uid())))
  or (created_by=(select auth.uid()) and private.can_manage_teaching_class_v1(institution_id,class_name,section_name,(select auth.uid())))
)
with check (
  private.can_manage_teaching_class_v1(institution_id,class_name,section_name,(select auth.uid()))
  and ((select private.is_institution_owner(syllabus_progress_units.institution_id,(select auth.uid()))) or created_by=(select auth.uid()))
);

alter policy "institution users read relevant calendar events" on public.school_calendar_events
using (private.can_read_school_calendar_event_v1(school_calendar_events.*,(select auth.uid())));

alter policy "users read relevant school notices" on public.school_announcements
using (private.can_view_school_notice_v1(school_announcements.*,(select auth.uid())));

drop function public.can_manage_teaching_class(uuid,text,text);
drop function public.can_view_family_class(uuid,text,text);
drop function public.can_read_school_calendar_event(public.school_calendar_events);
drop function public.can_view_school_notice(public.school_announcements);
