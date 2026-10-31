-- EduNizam School Calendar & Events upgrade migration
-- =========================================================
-- EduNizam School Calendar & Events
-- =========================================================
begin;

create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  creator_role text not null check (creator_role in ('head','teacher')),
  title text not null,
  category text not null check (category in ('Holiday','PTM','Exam','Fee Due','Meeting','Activity','Other')),
  event_date date not null,
  start_time time,
  end_time time,
  audience text not null default 'all' check (audience in ('all','students','parents','staff','class')),
  class_name text,
  section_name text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_calendar_events_institution_date_idx
on public.school_calendar_events(institution_id,event_date);

alter table public.school_calendar_events enable row level security;

create or replace function public.can_read_school_calendar_event(e public.school_calendar_events)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(select 1 from public.institutions i where i.id=e.institution_id and i.owner_user_id=auth.uid())
    or exists(select 1 from public.institution_members m where m.institution_id=e.institution_id and m.user_id=auth.uid())
    or (
      exists(select 1 from public.user_profiles p where p.user_id=auth.uid() and p.institution_id=e.institution_id and p.account_role='student')
      and (
        e.audience in ('all','students')
        or (
          e.audience='class'
          and exists(
            select 1 from public.core_students s
            where s.institution_id=e.institution_id
              and s.auth_user_id=auth.uid()
              and s.class_name=e.class_name
              and (e.section_name is null or e.section_name='' or coalesce(s.section_name,'')=e.section_name)
          )
        )
      )
    )
    or (
      exists(select 1 from public.user_profiles p where p.user_id=auth.uid() and p.institution_id=e.institution_id and p.account_role='parent')
      and (
        e.audience in ('all','parents')
        or (
          e.audience='class'
          and exists(
            select 1
            from public.parent_student_links l
            join public.core_students s on s.auth_user_id=l.student_user_id
            where l.parent_user_id=auth.uid()
              and l.status='approved'
              and l.institution_id=e.institution_id
              and s.institution_id=e.institution_id
              and s.class_name=e.class_name
              and (e.section_name is null or e.section_name='' or coalesce(s.section_name,'')=e.section_name)
          )
        )
      )
    );
$$;

grant execute on function public.can_read_school_calendar_event(public.school_calendar_events) to authenticated;

drop policy if exists "institution users read relevant calendar events" on public.school_calendar_events;
create policy "institution users read relevant calendar events" on public.school_calendar_events
for select to authenticated
using (public.can_read_school_calendar_event(school_calendar_events));

drop policy if exists "head manages all calendar events" on public.school_calendar_events;
create policy "head manages all calendar events" on public.school_calendar_events
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_calendar_events.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=school_calendar_events.institution_id and i.owner_user_id=auth.uid())
);

drop policy if exists "teachers manage own calendar events" on public.school_calendar_events;
create policy "teachers manage own calendar events" on public.school_calendar_events
for all to authenticated
using (
  creator_user_id=auth.uid()
  and creator_role='teacher'
  and public.is_institution_staff(institution_id)
)
with check (
  creator_user_id=auth.uid()
  and creator_role='teacher'
  and public.is_institution_staff(institution_id)
);

commit;


