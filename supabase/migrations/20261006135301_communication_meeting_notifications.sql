create or replace function private.notify_communication_meeting_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid := (select auth.uid());
  title_text text;
  body_text text;
begin
  if uid is null then
    return new;
  end if;

  if tg_op='INSERT' then
    title_text := 'Meeting scheduled';
    body_text := coalesce(nullif(new.title,''),'School meeting')||' · '||
      to_char(new.scheduled_for at time zone 'Asia/Karachi','DD Mon YYYY HH12:MI AM')||' PKT';
  elsif tg_op='UPDATE' and new.status is distinct from old.status then
    title_text := 'Meeting status updated';
    body_text := coalesce(nullif(new.title,''),'School meeting')||' is now '||new.status||'.';
  else
    return new;
  end if;

  if new.participant_role='student' and new.student_user_id is not null and new.student_user_id<>uid then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    ) values(
      new.institution_id,new.student_user_id,uid,'meeting',title_text,body_text
    );
  elsif new.participant_role='parent' then
    insert into public.user_notifications(
      institution_id,recipient_user_id,created_by,category,title,body
    )
    select new.institution_id,r.parent_user_id,uid,'meeting',title_text,body_text
    from (
      select new.participant_user_id as parent_user_id
      where new.participant_user_id is not null
      union
      select l.parent_user_id
      from public.parent_student_links l
      where l.institution_id=new.institution_id
        and l.student_user_id=new.student_user_id
        and l.status='approved'
    ) r
    where r.parent_user_id is not null
      and r.parent_user_id<>uid
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function private.notify_communication_meeting_v1() from public, anon, authenticated;

drop trigger if exists notify_communication_meeting_v1 on public.communication_meetings;
create trigger notify_communication_meeting_v1
after insert or update of status on public.communication_meetings
for each row
execute function private.notify_communication_meeting_v1();
