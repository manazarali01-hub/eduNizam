-- EduNizam school access request notifications

create or replace function private.notify_school_access_request_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid;
  v_role text;
begin
  select i.owner_user_id into v_admin
  from public.institutions i
  where i.id=new.institution_id;

  v_role := case new.requested_role
    when 'teacher' then 'Teacher'
    when 'parent' then 'Parent'
    when 'student' then 'Student'
    else initcap(new.requested_role)
  end;

  if v_admin is not null and v_admin<>new.requester_user_id then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    ) values(
      new.institution_id,v_admin,new.requester_user_id,'access',
      'New '||v_role||' access request',
      left(coalesce(new.full_name,v_role)||' is waiting for school approval.',180)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists school_access_request_notify_insert on public.school_access_requests;
create trigger school_access_request_notify_insert
after insert on public.school_access_requests
for each row execute function private.notify_school_access_request_v1();

create or replace function private.notify_school_access_decision_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status is distinct from old.status
     and new.status in ('approved','rejected') then
    v_title := case when new.status='approved'
      then 'School access approved'
      else 'School access request rejected'
    end;
    v_body := case when new.status='approved'
      then 'Your '||initcap(new.requested_role)||' access has been approved. You can now open the school workspace.'
      else 'Your '||initcap(new.requested_role)||' access request was rejected.'
    end;
    if nullif(btrim(coalesce(new.review_note,'')),'') is not null then
      v_body := v_body||' Note: '||btrim(new.review_note);
    end if;

    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    ) values(
      new.institution_id,new.requester_user_id,new.reviewed_by,'access',
      v_title,left(v_body,180)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists school_access_request_notify_decision on public.school_access_requests;
create trigger school_access_request_notify_decision
after update of status on public.school_access_requests
for each row execute function private.notify_school_access_decision_v1();
