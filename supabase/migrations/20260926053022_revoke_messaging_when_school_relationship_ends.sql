-- Applied in Supabase migration history: revoke_messaging_when_school_relationship_ends
-- Existing conversations remain accessible only while the underlying school relationship is still approved/assigned.

create or replace function private.is_school_conversation_participant_v2(
  p_conversation_id uuid,
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
    from public.school_conversations c
    where c.id=p_conversation_id
      and p_user_id in (c.participant_a,c.participant_b)
      and (
        (
          c.conversation_type='head-parent'
          and exists(
            select 1
            from public.institutions i
            join public.parent_student_links l
              on l.institution_id=i.id
             and l.student_user_id=c.student_user_id
             and l.status='approved'
            where i.id=c.institution_id
              and (
                (c.participant_a=i.owner_user_id and c.participant_b=l.parent_user_id)
                or
                (c.participant_b=i.owner_user_id and c.participant_a=l.parent_user_id)
              )
          )
        )
        or
        (
          c.conversation_type='teacher-student'
          and exists(
            select 1
            from public.teacher_student_links t
            where t.institution_id=c.institution_id
              and t.student_user_id=c.student_user_id
              and (
                (c.participant_a=t.teacher_user_id and c.participant_b=c.student_user_id)
                or
                (c.participant_b=t.teacher_user_id and c.participant_a=c.student_user_id)
              )
          )
        )
        or
        (
          c.conversation_type='teacher-parent'
          and exists(
            select 1
            from public.teacher_student_links t
            join public.parent_student_links l
              on l.institution_id=t.institution_id
             and l.student_user_id=t.student_user_id
             and l.status='approved'
            where t.institution_id=c.institution_id
              and t.student_user_id=c.student_user_id
              and (
                (c.participant_a=t.teacher_user_id and c.participant_b=l.parent_user_id)
                or
                (c.participant_b=t.teacher_user_id and c.participant_a=l.parent_user_id)
              )
          )
        )
      )
  );
$$;

revoke execute on function private.is_school_conversation_participant_v2(uuid,uuid) from public,anon;
grant execute on function private.is_school_conversation_participant_v2(uuid,uuid) to authenticated;

create or replace function public.is_school_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select private.is_school_conversation_participant_v2(
    p_conversation_id,
    (select auth.uid())
  );
$$;

revoke execute on function public.is_school_conversation_participant(uuid) from public,anon;
grant execute on function public.is_school_conversation_participant(uuid) to authenticated;

drop policy if exists "participants read school conversations" on public.school_conversations;
drop policy if exists "current participants read school conversations" on public.school_conversations;
create policy "current participants read school conversations"
on public.school_conversations for select to authenticated
using (public.is_school_conversation_participant(id));

create or replace function public.send_school_message(
  p_conversation_id uuid,
  p_body text
)
returns public.school_messages
language plpgsql
security definer
set search_path='public'
as $$
declare
  c public.school_conversations%rowtype;
  recipient uuid;
  result_row public.school_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or char_length(trim(p_body))<1 or char_length(p_body)>4000 then
    raise exception 'Message must be between 1 and 4000 characters';
  end if;

  if not public.is_school_conversation_participant(p_conversation_id) then
    raise exception 'Conversation access denied';
  end if;

  select * into c from public.school_conversations where id=p_conversation_id;
  if c.id is null then raise exception 'Conversation not found'; end if;

  insert into public.school_messages(conversation_id,sender_user_id,body)
  values(c.id,auth.uid(),trim(p_body))
  returning * into result_row;

  update public.school_conversations set updated_at=now() where id=c.id;
  recipient:=case when auth.uid()=c.participant_a then c.participant_b else c.participant_a end;

  insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
  values(c.institution_id,recipient,auth.uid(),'message','New EduNizam message',left(trim(p_body),180));

  return result_row;
end;
$$;
