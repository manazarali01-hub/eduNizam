-- EduNizam academic identity, teacher assignment and notifications
-- Apply after supabase-full-schema.sql and supabase-role-invites-migration.sql.

begin;

-- Keep staff profile aligned with claimed invite role.
create or replace function public.claim_institution_invite(p_code text)
returns table(institution_id uuid, institution_name text, granted_role text)
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.institution_invites%rowtype;
  inst_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into inv
  from public.institution_invites
  where upper(code)=upper(trim(p_code))
    and active=true
    and (expires_at is null or expires_at > now())
    and use_count < max_uses
  for update;

  if inv.id is null then raise exception 'Invite code is invalid, expired, or already used'; end if;
  select name into inst_name from public.institutions where id=inv.institution_id;

  if inv.target_role='teacher' then
    insert into public.institution_members(institution_id,user_id,role)
    values(inv.institution_id,auth.uid(),'teacher')
    on conflict (institution_id,user_id) do update set role='teacher';

    insert into public.user_profiles(user_id,account_role,institution_id)
    values(auth.uid(),'teacher',inv.institution_id)
    on conflict (user_id) do update
      set account_role='teacher',institution_id=excluded.institution_id,updated_at=now();
  else
    insert into public.user_profiles(user_id,account_role,institution_id)
    values(auth.uid(),inv.target_role,inv.institution_id)
    on conflict (user_id) do update
      set account_role=excluded.account_role,institution_id=excluded.institution_id,updated_at=now();
  end if;

  update public.institution_invites
  set use_count=use_count+1,
      active=case when use_count+1 >= max_uses then false else active end
  where id=inv.id;

  return query select inv.institution_id,inst_name,inv.target_role;
end;
$$;

-- Student links their authenticated account to the school's existing student record.
create or replace function public.claim_student_record(p_student_code text)
returns table(student_id uuid, institution_id uuid, student_name text, class_name text, student_code text)
language plpgsql
security definer
set search_path=public
as $$
declare
  profile public.user_profiles%rowtype;
  s public.core_students%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into profile from public.user_profiles where user_id=auth.uid();
  if profile.account_role <> 'student' then raise exception 'Student account required'; end if;

  select * into s
  from public.core_students
  where upper(core_students.student_code)=upper(trim(p_student_code))
    and (profile.institution_id is null or core_students.institution_id=profile.institution_id)
  limit 1
  for update;

  if s.id is null then raise exception 'Student code not found in your institute'; end if;
  if s.auth_user_id is not null and s.auth_user_id <> auth.uid() then
    raise exception 'This student record is already linked to another account';
  end if;

  update public.core_students
  set auth_user_id=auth.uid(),updated_at=now()
  where id=s.id;

  update public.user_profiles
  set institution_id=s.institution_id,updated_at=now()
  where user_id=auth.uid();

  return query select s.id,s.institution_id,s.name,s.class_name,s.student_code;
end;
$$;
grant execute on function public.claim_student_record(text) to authenticated;

create table if not exists public.teacher_student_links (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (teacher_user_id,student_user_id)
);
alter table public.teacher_student_links enable row level security;

drop policy if exists "head manage teacher student links" on public.teacher_student_links;
create policy "head manage teacher student links" on public.teacher_student_links
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "teacher read own assignments" on public.teacher_student_links;
create policy "teacher read own assignments" on public.teacher_student_links
for select to authenticated using (teacher_user_id=auth.uid());

-- Tighten Teacher–Student communication after teacher_student_links exists.
drop policy if exists "teachers manage own student meetings" on public.communication_meetings;
create policy "teachers manage own student meetings" on public.communication_meetings
for all to authenticated
using (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=communication_meetings.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=communication_meetings.student_user_id
  )
)
with check (
  created_by=auth.uid()
  and created_by_role='teacher'
  and participant_role='student'
  and exists(
    select 1 from public.teacher_student_links tsl
    where tsl.institution_id=communication_meetings.institution_id
      and tsl.teacher_user_id=auth.uid()
      and tsl.student_user_id=communication_meetings.student_user_id
  )
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  category text not null default 'general',
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.user_notifications enable row level security;

create index if not exists user_notifications_recipient_idx
on public.user_notifications(recipient_user_id,created_at desc);

drop policy if exists "users read own notifications" on public.user_notifications;
create policy "users read own notifications" on public.user_notifications
for select to authenticated using (recipient_user_id=auth.uid());

drop policy if exists "users mark own notifications" on public.user_notifications;
create policy "users mark own notifications" on public.user_notifications
for update to authenticated using (recipient_user_id=auth.uid())
with check (recipient_user_id=auth.uid());

drop policy if exists "staff create institution notifications" on public.user_notifications;
create policy "staff create institution notifications" on public.user_notifications
for insert to authenticated with check (
  created_by=auth.uid()
  and public.is_institution_staff(institution_id)
);

commit;
