-- Move privileged school messaging mutations behind private SECURITY DEFINER implementations.
-- Public RPC signatures remain unchanged and now execute as SECURITY INVOKER.
-- Applied to production on 2026-10-06 after rollback-only Head/Parent/outsider regression tests.
-- Supabase authenticated SECURITY DEFINER advisor findings reduced from 33 to 30.

create or replace function private.create_school_conversation_v1(
  p_target_user_id uuid,
  p_student_user_id uuid,
  p_conversation_type text,
  p_subject text default 'General'::text
)
returns public.school_conversations
language plpgsql security definer set search_path=''
as $$
declare
  inst uuid;
  caller_role text;
  caller_label text;
  target_label text;
  sname text;
  ok boolean:=false;
  uid uuid := (select auth.uid());
  result_row public.school_conversations%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_student_user_id is null then raise exception 'Target and student context required'; end if;
  if p_target_user_id=uid then raise exception 'Cannot message yourself'; end if;
  if p_conversation_type not in ('head-parent','teacher-parent','teacher-student') then raise exception 'Invalid conversation type'; end if;

  caller_role:=private.current_account_role_v1(uid);

  if p_conversation_type='head-parent' then
    if caller_role='head_of_institute' then
      select i.id into inst
      from public.institutions i
      join public.parent_student_links l on l.institution_id=i.id and l.status='approved'
      where i.owner_user_id=uid
        and l.parent_user_id=p_target_user_id
        and l.student_user_id=p_student_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='parent' then
      select i.id into inst
      from public.parent_student_links l
      join public.institutions i on i.id=l.institution_id
      where l.parent_user_id=uid
        and l.student_user_id=p_student_user_id
        and l.status='approved'
        and i.owner_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;

  elsif p_conversation_type='teacher-student' then
    if caller_role='teacher' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      where tsl.teacher_user_id=uid
        and tsl.student_user_id=p_student_user_id
        and p_target_user_id=p_student_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='student' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      where tsl.student_user_id=uid
        and p_student_user_id=uid
        and tsl.teacher_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;

  elsif p_conversation_type='teacher-parent' then
    if caller_role='teacher' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      join public.parent_student_links l
        on l.institution_id=tsl.institution_id
       and l.student_user_id=tsl.student_user_id
       and l.status='approved'
      where tsl.teacher_user_id=uid
        and tsl.student_user_id=p_student_user_id
        and l.parent_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='parent' then
      select l.institution_id into inst
      from public.parent_student_links l
      join public.teacher_student_links tsl
        on tsl.institution_id=l.institution_id
       and tsl.student_user_id=l.student_user_id
      where l.parent_user_id=uid
        and l.student_user_id=p_student_user_id
        and l.status='approved'
        and tsl.teacher_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;
  end if;

  if not ok then raise exception 'This messaging relationship is not authorized'; end if;

  select s.name into sname
  from public.core_students s
  where s.institution_id=inst and s.auth_user_id=p_student_user_id
  limit 1;

  select coalesce(nullif(full_name,''),caller_role) into caller_label
  from public.user_profiles where user_id=uid;

  caller_label:=coalesce(
    caller_label,
    case caller_role
      when 'head_of_institute' then 'Head of Institute'
      when 'teacher' then 'Teacher'
      when 'parent' then 'Parent / Guardian'
      else coalesce(sname,'Student')
    end
  );

  select coalesce(nullif(full_name,''),account_role) into target_label
  from public.user_profiles where user_id=p_target_user_id;

  if target_label is null and p_target_user_id=p_student_user_id then
    target_label:=coalesce(sname,'Student');
  end if;

  target_label:=coalesce(target_label,'User');

  insert into public.school_conversations(
    institution_id,conversation_type,student_user_id,student_name,
    participant_a,participant_b,participant_a_label,participant_b_label,subject,created_by
  ) values(
    inst,p_conversation_type,p_student_user_id,sname,
    uid,p_target_user_id,caller_label,target_label,
    coalesce(nullif(trim(p_subject),''),'General'),uid
  )
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function private.send_school_message_v1(
  p_conversation_id uuid,
  p_body text
)
returns public.school_messages
language plpgsql security definer set search_path=''
as $$
declare
  c public.school_conversations%rowtype;
  recipient uuid;
  uid uuid := (select auth.uid());
  result_row public.school_messages%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if p_body is null or char_length(trim(p_body))<1 or char_length(p_body)>4000 then
    raise exception 'Message must be between 1 and 4000 characters';
  end if;

  if not private.is_school_conversation_participant_v2(p_conversation_id,uid) then
    raise exception 'Conversation access denied';
  end if;

  select * into c
  from public.school_conversations
  where id=p_conversation_id;

  if c.id is null then raise exception 'Conversation not found'; end if;

  insert into public.school_messages(conversation_id,sender_user_id,body)
  values(c.id,uid,trim(p_body))
  returning * into result_row;

  update public.school_conversations
  set updated_at=now()
  where id=c.id;

  recipient:=case when uid=c.participant_a then c.participant_b else c.participant_a end;

  insert into public.user_notifications(
    institution_id,recipient_user_id,created_by,category,title,body
  )
  values(
    c.institution_id,recipient,uid,'message','New EduNizam message',left(trim(p_body),180)
  );

  return result_row;
end;
$$;

create or replace function private.mark_school_messages_read_v1(
  p_conversation_id uuid
)
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  n integer;
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if not private.is_school_conversation_participant_v2(p_conversation_id,uid) then
    raise exception 'Conversation access denied';
  end if;

  update public.school_messages
  set read_at=now()
  where conversation_id=p_conversation_id
    and sender_user_id<>uid
    and read_at is null;

  get diagnostics n=row_count;
  return n;
end;
$$;

revoke all on function private.create_school_conversation_v1(uuid,uuid,text,text) from public,anon;
revoke all on function private.send_school_message_v1(uuid,text) from public,anon;
revoke all on function private.mark_school_messages_read_v1(uuid) from public,anon;

grant execute on function private.create_school_conversation_v1(uuid,uuid,text,text) to authenticated;
grant execute on function private.send_school_message_v1(uuid,text) to authenticated;
grant execute on function private.mark_school_messages_read_v1(uuid) to authenticated;

create or replace function public.create_school_conversation(
  p_target_user_id uuid,
  p_student_user_id uuid,
  p_conversation_type text,
  p_subject text default 'General'::text
)
returns public.school_conversations
language sql security invoker set search_path=''
as $$
  select private.create_school_conversation_v1(
    p_target_user_id,
    p_student_user_id,
    p_conversation_type,
    p_subject
  );
$$;

create or replace function public.send_school_message(
  p_conversation_id uuid,
  p_body text
)
returns public.school_messages
language sql security invoker set search_path=''
as $$
  select private.send_school_message_v1(p_conversation_id,p_body);
$$;

create or replace function public.mark_school_messages_read(
  p_conversation_id uuid
)
returns integer
language sql security invoker set search_path=''
as $$
  select private.mark_school_messages_read_v1(p_conversation_id);
$$;

revoke all on function public.create_school_conversation(uuid,uuid,text,text) from public,anon;
revoke all on function public.send_school_message(uuid,text) from public,anon;
revoke all on function public.mark_school_messages_read(uuid) from public,anon;

grant execute on function public.create_school_conversation(uuid,uuid,text,text) to authenticated;
grant execute on function public.send_school_message(uuid,text) to authenticated;
grant execute on function public.mark_school_messages_read(uuid) to authenticated;
