drop policy if exists "participants read own communication meetings" on public.communication_meetings;

create policy "participants read own communication meetings"
on public.communication_meetings
for select
to authenticated
using (
  (
    participant_role='student'
    and student_user_id=(select auth.uid())
  )
  or
  (
    participant_role='parent'
    and exists (
      select 1
      from public.parent_student_links l
      where l.institution_id=communication_meetings.institution_id
        and l.student_user_id=communication_meetings.student_user_id
        and l.parent_user_id=(select auth.uid())
        and l.status='approved'
        and (
          communication_meetings.participant_user_id is null
          or communication_meetings.participant_user_id=(select auth.uid())
        )
    )
  )
);

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
    select new.institution_id,l.parent_user_id,uid,'meeting',title_text,body_text
    from public.parent_student_links l
    where l.institution_id=new.institution_id
      and l.student_user_id=new.student_user_id
      and l.status='approved'
      and (
        new.participant_user_id is null
        or l.parent_user_id=new.participant_user_id
      )
      and l.parent_user_id<>uid;
  end if;

  return new;
end;
$function$;

revoke all on function private.notify_communication_meeting_v1() from public, anon, authenticated;
