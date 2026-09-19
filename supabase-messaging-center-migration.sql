-- EduNizam Secure Inbox & Messaging upgrade migration
-- =========================================================
-- EduNizam Secure Inbox & Messaging
-- =========================================================
begin;

create table if not exists public.school_conversations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  conversation_type text not null check (conversation_type in ('head-parent','teacher-parent','teacher-student')),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  student_name text,
  participant_a uuid not null references auth.users(id) on delete cascade,
  participant_b uuid not null references auth.users(id) on delete cascade,
  participant_a_label text not null,
  participant_b_label text not null,
  subject text not null default 'General',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_a <> participant_b)
);
create index if not exists school_conversations_participant_a_idx on public.school_conversations(participant_a,updated_at desc);
create index if not exists school_conversations_participant_b_idx on public.school_conversations(participant_b,updated_at desc);
alter table public.school_conversations enable row level security;

create table if not exists public.school_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.school_conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists school_messages_conversation_idx on public.school_messages(conversation_id,created_at);
alter table public.school_messages enable row level security;

create or replace function public.is_school_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.school_conversations c
    where c.id=p_conversation_id
      and auth.uid() in (c.participant_a,c.participant_b)
  );
$$;
grant execute on function public.is_school_conversation_participant(uuid) to authenticated;

drop policy if exists "participants read school conversations" on public.school_conversations;
create policy "participants read school conversations" on public.school_conversations
for select to authenticated
using (auth.uid() in (participant_a,participant_b));

drop policy if exists "participants read school messages" on public.school_messages;
create policy "participants read school messages" on public.school_messages
for select to authenticated
using (public.is_school_conversation_participant(conversation_id));

create or replace function public.list_message_contacts()
returns table(
  target_user_id uuid,
  target_role text,
  display_name text,
  student_user_id uuid,
  student_name text,
  conversation_type text
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  r text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  r:=public.current_account_role();

  if r='head_of_institute' then
    return query
    select distinct
      l.parent_user_id,
      'parent'::text,
      coalesce(nullif(p.full_name,''),'Parent / Guardian')::text,
      l.student_user_id,
      s.name::text,
      'head-parent'::text
    from public.institutions i
    join public.parent_student_links l on l.institution_id=i.id and l.status='approved'
    join public.core_students s on s.institution_id=i.id and s.auth_user_id=l.student_user_id
    left join public.user_profiles p on p.user_id=l.parent_user_id
    where i.owner_user_id=auth.uid();

  elsif r='teacher' then
    return query
    select distinct x.target_user_id,x.target_role,x.display_name,x.student_user_id,x.student_name,x.conversation_type
    from (
      select
        tsl.student_user_id as target_user_id,
        'student'::text as target_role,
        coalesce(nullif(sp.full_name,''),s.name,'Student')::text as display_name,
        tsl.student_user_id,
        s.name::text as student_name,
        'teacher-student'::text as conversation_type
      from public.teacher_student_links tsl
      join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      left join public.user_profiles sp on sp.user_id=tsl.student_user_id
      where tsl.teacher_user_id=auth.uid()

      union all

      select
        l.parent_user_id,
        'parent'::text,
        coalesce(nullif(pp.full_name,''),'Parent / Guardian')::text,
        tsl.student_user_id,
        s.name::text,
        'teacher-parent'::text
      from public.teacher_student_links tsl
      join public.parent_student_links l
        on l.institution_id=tsl.institution_id
       and l.student_user_id=tsl.student_user_id
       and l.status='approved'
      join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
      left join public.user_profiles pp on pp.user_id=l.parent_user_id
      where tsl.teacher_user_id=auth.uid()
    ) x;

  elsif r='parent' then
    return query
    select distinct x.target_user_id,x.target_role,x.display_name,x.student_user_id,x.student_name,x.conversation_type
    from (
      select
        i.owner_user_id as target_user_id,
        'head'::text as target_role,
        ('Head · '||i.name)::text as display_name,
        l.student_user_id,
        s.name::text as student_name,
        'head-parent'::text as conversation_type
      from public.parent_student_links l
      join public.institutions i on i.id=l.institution_id
      join public.core_students s on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      where l.parent_user_id=auth.uid() and l.status='approved'

      union all

      select
        tsl.teacher_user_id,
        'teacher'::text,
        coalesce(nullif(tp.full_name,''),'Teacher')::text,
        l.student_user_id,
        s.name::text,
        'teacher-parent'::text
      from public.parent_student_links l
      join public.teacher_student_links tsl
        on tsl.institution_id=l.institution_id
       and tsl.student_user_id=l.student_user_id
      join public.core_students s on s.institution_id=l.institution_id and s.auth_user_id=l.student_user_id
      left join public.user_profiles tp on tp.user_id=tsl.teacher_user_id
      where l.parent_user_id=auth.uid() and l.status='approved'
    ) x;

  elsif r='student' then
    return query
    select distinct
      tsl.teacher_user_id,
      'teacher'::text,
      coalesce(nullif(tp.full_name,''),'Teacher')::text,
      tsl.student_user_id,
      s.name::text,
      'teacher-student'::text
    from public.teacher_student_links tsl
    join public.core_students s on s.institution_id=tsl.institution_id and s.auth_user_id=tsl.student_user_id
    left join public.user_profiles tp on tp.user_id=tsl.teacher_user_id
    where tsl.student_user_id=auth.uid();
  end if;
end;
$$;
grant execute on function public.list_message_contacts() to authenticated;

create or replace function public.create_school_conversation(
  p_target_user_id uuid,
  p_student_user_id uuid,
  p_conversation_type text,
  p_subject text default 'General'
)
returns public.school_conversations
language plpgsql
security definer
set search_path=public
as $$
declare
  inst uuid;
  caller_role text;
  caller_label text;
  target_label text;
  sname text;
  ok boolean:=false;
  result_row public.school_conversations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_student_user_id is null then raise exception 'Target and student context required'; end if;
  if p_target_user_id=auth.uid() then raise exception 'Cannot message yourself'; end if;
  if p_conversation_type not in ('head-parent','teacher-parent','teacher-student') then raise exception 'Invalid conversation type'; end if;

  caller_role:=public.current_account_role();

  if p_conversation_type='head-parent' then
    if caller_role='head_of_institute' then
      select i.id into inst
      from public.institutions i
      join public.parent_student_links l on l.institution_id=i.id and l.status='approved'
      where i.owner_user_id=auth.uid()
        and l.parent_user_id=p_target_user_id
        and l.student_user_id=p_student_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='parent' then
      select i.id into inst
      from public.parent_student_links l
      join public.institutions i on i.id=l.institution_id
      where l.parent_user_id=auth.uid()
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
      where tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=p_student_user_id
        and p_target_user_id=p_student_user_id
      limit 1;
      ok:=inst is not null;
    elsif caller_role='student' then
      select tsl.institution_id into inst
      from public.teacher_student_links tsl
      where tsl.student_user_id=auth.uid()
        and p_student_user_id=auth.uid()
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
      where tsl.teacher_user_id=auth.uid()
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
      where l.parent_user_id=auth.uid()
        and l.student_user_id=p_student_user_id
        and l.status='approved'
        and tsl.teacher_user_id=p_target_user_id
      limit 1;
      ok:=inst is not null;
    end if;
  end if;

  if not ok then raise exception 'This messaging relationship is not authorized'; end if;

  select s.name into sname from public.core_students s
  where s.institution_id=inst and s.auth_user_id=p_student_user_id limit 1;

  select coalesce(nullif(full_name,''),caller_role) into caller_label
  from public.user_profiles where user_id=auth.uid();
  caller_label:=coalesce(caller_label,case caller_role when 'head_of_institute' then 'Head of Institute' when 'teacher' then 'Teacher' when 'parent' then 'Parent / Guardian' else coalesce(sname,'Student') end);

  select coalesce(nullif(full_name,''),account_role) into target_label
  from public.user_profiles where user_id=p_target_user_id;
  if target_label is null and p_target_user_id=p_student_user_id then target_label:=coalesce(sname,'Student'); end if;
  target_label:=coalesce(target_label,'User');

  insert into public.school_conversations(
    institution_id,conversation_type,student_user_id,student_name,
    participant_a,participant_b,participant_a_label,participant_b_label,subject,created_by
  ) values(
    inst,p_conversation_type,p_student_user_id,sname,
    auth.uid(),p_target_user_id,caller_label,target_label,coalesce(nullif(trim(p_subject),''),'General'),auth.uid()
  )
  returning * into result_row;

  return result_row;
end;
$$;
grant execute on function public.create_school_conversation(uuid,uuid,text,text) to authenticated;

create or replace function public.send_school_message(p_conversation_id uuid,p_body text)
returns public.school_messages
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.school_conversations%rowtype;
  recipient uuid;
  result_row public.school_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_body is null or char_length(trim(p_body))<1 or char_length(p_body)>4000 then raise exception 'Message must be between 1 and 4000 characters'; end if;

  select * into c from public.school_conversations where id=p_conversation_id;
  if c.id is null or auth.uid() not in (c.participant_a,c.participant_b) then raise exception 'Conversation access denied'; end if;

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
grant execute on function public.send_school_message(uuid,text) to authenticated;

create or replace function public.mark_school_messages_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_school_conversation_participant(p_conversation_id) then raise exception 'Conversation access denied'; end if;

  update public.school_messages
  set read_at=now()
  where conversation_id=p_conversation_id
    and sender_user_id<>auth.uid()
    and read_at is null;
  get diagnostics n=row_count;
  return n;
end;
$$;
grant execute on function public.mark_school_messages_read(uuid) to authenticated;

commit;


