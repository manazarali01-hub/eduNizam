-- EduNizam server-side attendance alerts
-- Reliable Student/Parent/Admin notifications, independent of browser execution.

begin;

alter table public.user_notifications
  add column if not exists dedupe_key text;

create unique index if not exists user_notifications_dedupe_idx
  on public.user_notifications(institution_id,recipient_user_id,dedupe_key)
  where dedupe_key is not null;

create or replace function private.notify_student_attendance_change_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  s public.core_students%rowtype;
  owner_id uuid;
  title_text text;
  family_body text;
  admin_body text;
  event_key text;
  is_absence boolean:=false;
  is_correction boolean:=false;
begin
  select * into s from public.core_students cs where cs.id=new.student_id;
  if s.id is null then return new; end if;
  select i.owner_user_id into owner_id from public.institutions i where i.id=new.institution_id;

  is_absence:=new.status='Absent' and (tg_op='INSERT' or old.status is distinct from new.status);
  is_correction:=tg_op='UPDATE' and old.status='Absent' and new.status is distinct from 'Absent';
  if not is_absence and not is_correction then return new; end if;

  if is_absence then
    title_text:='Attendance Alert';
    family_body:=s.name||' was marked Absent on '||new.attendance_date::text||'.';
    admin_body:=s.name
      ||case when nullif(btrim(coalesce(s.class_name,'')),'') is not null then ' · Class '||s.class_name else '' end
      ||case when nullif(btrim(coalesce(s.section_name,'')),'') is not null then '/'||s.section_name else '' end
      ||case when nullif(btrim(coalesce(s.phone,'')),'') is not null then ' · '||s.phone else '' end
      ||' · marked Absent.';
    event_key:='student-attendance:'||new.attendance_date::text||':'||new.student_id::text||':Absent';
  else
    title_text:='Attendance Updated';
    family_body:=s.name||' attendance for '||new.attendance_date::text||' was updated from Absent to '||new.status||'.';
    admin_body:=s.name
      ||case when nullif(btrim(coalesce(s.class_name,'')),'') is not null then ' · Class '||s.class_name else '' end
      ||case when nullif(btrim(coalesce(s.section_name,'')),'') is not null then '/'||s.section_name else '' end
      ||' · attendance corrected from Absent to '||new.status||'.';
    event_key:='student-attendance:'||new.attendance_date::text||':'||new.student_id::text||':'||new.status;
  end if;

  if s.auth_user_id is not null then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body,dedupe_key)
    values(new.institution_id,s.auth_user_id,new.marked_by,'attendance',title_text,left(family_body,500),event_key||':student')
    on conflict do nothing;

    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body,dedupe_key)
    select new.institution_id,l.parent_user_id,new.marked_by,'attendance',title_text,left(family_body,500),event_key||':parent:'||l.parent_user_id::text
    from public.parent_student_links l
    where l.institution_id=new.institution_id
      and l.student_user_id=s.auth_user_id
      and l.status='approved'
    on conflict do nothing;
  end if;

  if owner_id is not null then
    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body,dedupe_key)
    values(
      new.institution_id,owner_id,new.marked_by,'attendance-admin',
      case when is_absence then 'Student Absence · '||new.attendance_date::text
           else 'Student Attendance Updated · '||new.attendance_date::text end,
      left(admin_body,500),event_key||':admin'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_notification_trigger on public.attendance_records;
create trigger attendance_notification_trigger
after insert or update of status on public.attendance_records
for each row execute function private.notify_student_attendance_change_v1();

create or replace function private.notify_staff_attendance_change_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  sp public.staff_profiles%rowtype;
  owner_id uuid;
  event_key text;
  body_text text;
  is_absence boolean:=false;
  is_correction boolean:=false;
begin
  select * into sp from public.staff_profiles s where s.id=new.staff_profile_id;
  if sp.id is null then return new; end if;
  select i.owner_user_id into owner_id from public.institutions i where i.id=new.institution_id;
  if owner_id is null then return new; end if;

  is_absence:=new.status='Absent' and (tg_op='INSERT' or old.status is distinct from new.status);
  is_correction:=tg_op='UPDATE' and old.status='Absent' and new.status is distinct from 'Absent';
  if not is_absence and not is_correction then return new; end if;

  if is_absence then
    event_key:='staff-attendance:'||new.attendance_date::text||':'||new.staff_profile_id::text||':Absent';
    body_text:=coalesce(nullif(btrim(sp.full_name),''),'Staff')
      ||case when nullif(btrim(coalesce(sp.designation,'')),'') is not null then ' · '||sp.designation else '' end
      ||case when nullif(btrim(coalesce(sp.phone,'')),'') is not null then ' · '||sp.phone else '' end
      ||case when nullif(btrim(coalesce(new.note,'')),'') is not null then ' · Note: '||new.note else '' end;
  else
    event_key:='staff-attendance:'||new.attendance_date::text||':'||new.staff_profile_id::text||':'||new.status;
    body_text:=coalesce(nullif(btrim(sp.full_name),''),'Staff')
      ||case when nullif(btrim(coalesce(sp.designation,'')),'') is not null then ' · '||sp.designation else '' end
      ||' · attendance corrected from Absent to '||new.status||'.';
  end if;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body,dedupe_key)
  values(
    new.institution_id,owner_id,new.marked_by,'attendance-admin',
    case when is_absence then 'Staff Absence · '||new.attendance_date::text
         else 'Staff Attendance Updated · '||new.attendance_date::text end,
    left(body_text,500),event_key||':admin'
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists staff_attendance_notification_trigger on public.staff_attendance_records;
create trigger staff_attendance_notification_trigger
after insert or update of status on public.staff_attendance_records
for each row execute function private.notify_staff_attendance_change_v1();

commit;
