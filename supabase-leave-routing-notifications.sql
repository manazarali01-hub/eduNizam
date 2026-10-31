-- EduNizam leave request routing notifications

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
    select new.institution_id,tsl.teacher_user_id,new.submitted_by,'leave',
           'Student leave needs review',v_body
    from public.teacher_student_links tsl
    where tsl.institution_id=new.institution_id
      and tsl.student_user_id=new.student_user_id
      and tsl.teacher_user_id<>new.submitted_by;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_request_notify_insert on public.leave_requests;
create trigger leave_request_notify_insert
after insert on public.leave_requests
for each row execute function private.notify_new_leave_request_v1();

create or replace function private.notify_leave_teacher_review_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid;
begin
  if new.teacher_response is distinct from old.teacher_response
     and nullif(btrim(coalesce(new.teacher_response,'')),'') is not null then
    select i.owner_user_id into v_admin
    from public.institutions i
    where i.id=new.institution_id;

    if v_admin is not null and v_admin<>new.teacher_reviewed_by then
      insert into public.user_notifications(
        institution_id,recipient_user_id,created_by,category,title,body
      ) values(
        new.institution_id,v_admin,new.teacher_reviewed_by,'leave',
        'Teacher reviewed student leave',
        left(coalesce(new.student_name,'Student')||' · '||new.teacher_response||
          case when nullif(btrim(coalesce(new.teacher_note,'')),'') is not null then ' · '||new.teacher_note else '' end,180)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leave_teacher_review_notify_admin on public.leave_requests;
create trigger leave_teacher_review_notify_admin
after update of teacher_response on public.leave_requests
for each row execute function private.notify_leave_teacher_review_v1();
