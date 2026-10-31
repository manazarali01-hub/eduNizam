-- Class Teacher leave-review scope
-- Teachers may review student leave when the student is explicitly linked to them
-- OR belongs to an active class/section where they are the assigned class teacher.
-- Admin remains the only final approver/rejector.

drop policy if exists "teachers manage assigned leave" on public.leave_requests;
create policy "teachers manage assigned leave"
on public.leave_requests
for select
to authenticated
using (
  leave_for='student'
  and exists(
    select 1
    from public.institution_members m
    where m.institution_id=leave_requests.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
  and (
    exists(
      select 1
      from public.teacher_student_links tsl
      where tsl.institution_id=leave_requests.institution_id
        and tsl.teacher_user_id=(select auth.uid())
        and tsl.student_user_id=leave_requests.student_user_id
    )
    or exists(
      select 1
      from public.core_students s
      join public.class_sections cs
        on cs.institution_id=s.institution_id
       and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
       and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
       and coalesce(cs.active,true)=true
      where s.institution_id=leave_requests.institution_id
        and s.auth_user_id=leave_requests.student_user_id
        and cs.class_teacher_user_id=(select auth.uid())
    )
  )
);

drop policy if exists "assigned active teachers review pending leave" on public.leave_requests;
create policy "assigned active teachers review pending leave"
on public.leave_requests
for update
to authenticated
using (
  status='Pending'
  and leave_for='student'
  and exists(
    select 1
    from public.institution_members m
    where m.institution_id=leave_requests.institution_id
      and m.user_id=(select auth.uid())
      and m.role='teacher'
  )
  and (
    exists(
      select 1
      from public.teacher_student_links tsl
      where tsl.institution_id=leave_requests.institution_id
        and tsl.teacher_user_id=(select auth.uid())
        and tsl.student_user_id=leave_requests.student_user_id
    )
    or exists(
      select 1
      from public.core_students s
      join public.class_sections cs
        on cs.institution_id=s.institution_id
       and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
       and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
       and coalesce(cs.active,true)=true
      where s.institution_id=leave_requests.institution_id
        and s.auth_user_id=leave_requests.student_user_id
        and cs.class_teacher_user_id=(select auth.uid())
    )
  )
)
with check (
  status='Pending'
  and teacher_reviewed_by=(select auth.uid())
);

create or replace function private.notify_new_leave_request_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid;
  v_title text;
  v_body text;
begin
  select i.owner_user_id into v_admin
  from public.institutions i
  where i.id=new.institution_id;

  v_title := case when new.leave_for='staff' then 'New teacher leave request' else 'New student leave request' end;
  v_body := left(
    coalesce(new.requester_name,new.student_name,'User')||
    ' · '||new.from_date::text||' to '||new.to_date::text||
    ' · '||coalesce(new.number_of_days,1)::text||' day(s)',180
  );

  if v_admin is not null and v_admin<>new.submitted_by then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    ) values(
      new.institution_id,v_admin,new.submitted_by,'leave',v_title,v_body
    );
  end if;

  if new.leave_for='student' and new.student_user_id is not null then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    select new.institution_id,r.teacher_user_id,new.submitted_by,'leave',
           'Student leave needs review',v_body
    from (
      select tsl.teacher_user_id
      from public.teacher_student_links tsl
      where tsl.institution_id=new.institution_id
        and tsl.student_user_id=new.student_user_id

      union

      select cs.class_teacher_user_id
      from public.core_students s
      join public.class_sections cs
        on cs.institution_id=s.institution_id
       and lower(trim(cs.class_name))=lower(trim(coalesce(s.class_name,'')))
       and lower(trim(coalesce(cs.section_name,'')))=lower(trim(coalesce(s.section_name,'')))
       and coalesce(cs.active,true)=true
      where s.institution_id=new.institution_id
        and s.auth_user_id=new.student_user_id
        and cs.class_teacher_user_id is not null
    ) r
    join public.institution_members m
      on m.institution_id=new.institution_id
     and m.user_id=r.teacher_user_id
     and m.role='teacher'
    where r.teacher_user_id<>new.submitted_by;
  end if;

  return new;
end;
$$;
