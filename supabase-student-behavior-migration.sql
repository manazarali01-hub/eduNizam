-- EduNizam Student Discipline & Behavior upgrade migration
-- =========================================================
-- EduNizam Student Discipline & Behavior
-- =========================================================
begin;

create table if not exists public.student_behavior_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  record_type text not null check (record_type in ('Positive Note','Concern','Warning','Incident')),
  severity text not null default 'Low' check (severity in ('Low','Medium','High')),
  record_date date not null default current_date,
  title text not null,
  details text,
  action_taken text,
  family_visible boolean not null default false,
  status text not null default 'Open' check (status in ('Open','Resolved')),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_behavior_student_date_idx on public.student_behavior_records(student_id,record_date desc);
alter table public.student_behavior_records enable row level security;

drop policy if exists "authorized users read behavior records" on public.student_behavior_records;
create policy "authorized users read behavior records" on public.student_behavior_records
for select to authenticated
using (
  exists(select 1 from public.institutions i where i.id=student_behavior_records.institution_id and i.owner_user_id=auth.uid())
  or exists(
    select 1
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=student_behavior_records.student_id
      and tsl.teacher_user_id=auth.uid()
  )
  or (
    family_visible
    and exists(
      select 1 from public.core_students s
      where s.id=student_behavior_records.student_id
        and (
          s.auth_user_id=auth.uid()
          or exists(
            select 1 from public.parent_student_links l
            where l.institution_id=s.institution_id
              and l.parent_user_id=auth.uid()
              and l.student_user_id=s.auth_user_id
              and l.status='approved'
          )
        )
    )
  )
);

drop policy if exists "heads manage behavior records" on public.student_behavior_records;
create policy "heads manage behavior records" on public.student_behavior_records
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=student_behavior_records.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=student_behavior_records.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "teachers manage own assigned behavior records" on public.student_behavior_records;
create policy "teachers manage own assigned behavior records" on public.student_behavior_records
for all to authenticated
using (
  created_by=auth.uid()
  and exists(
    select 1
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=student_behavior_records.student_id
      and tsl.teacher_user_id=auth.uid()
  )
)
with check (
  created_by=auth.uid()
  and exists(
    select 1
    from public.core_students s
    join public.teacher_student_links tsl
      on tsl.institution_id=s.institution_id
     and tsl.student_user_id=s.auth_user_id
    where s.id=student_behavior_records.student_id
      and tsl.teacher_user_id=auth.uid()
  )
);

create or replace function public.create_student_behavior_record(
  p_student_id uuid,
  p_record_type text,
  p_severity text,
  p_record_date date,
  p_title text,
  p_details text,
  p_action_taken text,
  p_family_visible boolean
)
returns public.student_behavior_records
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.core_students%rowtype;
  r text;
  result_row public.student_behavior_records%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into s from public.core_students where id=p_student_id;
  if s.id is null then raise exception 'Student not found'; end if;

  r:=public.current_account_role();
  if r='head_of_institute' then
    if not exists(select 1 from public.institutions i where i.id=s.institution_id and i.owner_user_id=auth.uid()) then raise exception 'Head access required'; end if;
  elsif r='teacher' then
    if not exists(
      select 1 from public.teacher_student_links tsl
      where tsl.institution_id=s.institution_id
        and tsl.teacher_user_id=auth.uid()
        and tsl.student_user_id=s.auth_user_id
    ) then raise exception 'Teacher can record behavior only for assigned students'; end if;
  else
    raise exception 'Staff access required';
  end if;

  if p_record_type not in ('Positive Note','Concern','Warning','Incident') then raise exception 'Invalid record type'; end if;
  if p_severity not in ('Low','Medium','High') then raise exception 'Invalid severity'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Title required'; end if;

  insert into public.student_behavior_records(
    institution_id,student_id,record_type,severity,record_date,title,details,action_taken,family_visible,created_by,updated_by
  ) values(
    s.institution_id,s.id,p_record_type,p_severity,coalesce(p_record_date,current_date),trim(p_title),
    nullif(trim(p_details),''),nullif(trim(p_action_taken),''),coalesce(p_family_visible,false),auth.uid(),auth.uid()
  )
  returning * into result_row;

  if result_row.family_visible then
    if s.auth_user_id is not null then
      insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
      values(s.institution_id,s.auth_user_id,auth.uid(),'behavior','Student development update',left(result_row.title,180));
    end if;

    insert into public.user_notifications(institution_id,recipient_user_id,created_by,category,title,body)
    select s.institution_id,l.parent_user_id,auth.uid(),'behavior','Student development update',left(result_row.title,180)
    from public.parent_student_links l
    where l.institution_id=s.institution_id
      and l.student_user_id=s.auth_user_id
      and l.status='approved';
  end if;

  return result_row;
end;
$$;
grant execute on function public.create_student_behavior_record(uuid,text,text,date,text,text,text,boolean) to authenticated;

create or replace function public.acknowledge_student_behavior_record(p_record_id uuid)
returns public.student_behavior_records
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.student_behavior_records%rowtype;
  s public.core_students%rowtype;
  result_row public.student_behavior_records%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into b from public.student_behavior_records where id=p_record_id for update;
  if b.id is null then raise exception 'Record not found'; end if;
  if not b.family_visible then raise exception 'Record is staff-only'; end if;

  select * into s from public.core_students where id=b.student_id;
  if not (
    s.auth_user_id=auth.uid()
    or exists(
      select 1 from public.parent_student_links l
      where l.institution_id=s.institution_id
        and l.parent_user_id=auth.uid()
        and l.student_user_id=s.auth_user_id
        and l.status='approved'
    )
  ) then raise exception 'Acknowledgement access denied'; end if;

  update public.student_behavior_records
  set acknowledged_at=coalesce(acknowledged_at,now()),
      acknowledged_by=coalesce(acknowledged_by,auth.uid()),
      updated_at=now()
  where id=b.id
  returning * into result_row;

  return result_row;
end;
$$;
grant execute on function public.acknowledge_student_behavior_record(uuid) to authenticated;

commit;


