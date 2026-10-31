-- EduNizam School Work Center upgrade migration
-- =========================================================
-- EduNizam School Work Center
-- =========================================================
begin;

create table if not exists public.school_announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null default 'all' check (audience in ('all','students','parents','teachers')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.school_announcements enable row level security;

create table if not exists public.homework_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  subject text not null,
  title text not null,
  details text,
  due_date date,
  created_at timestamptz not null default now()
);
alter table public.homework_items enable row level security;

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  weekday text not null,
  start_time time,
  subject text not null,
  teacher_name text,
  created_at timestamptz not null default now()
);
alter table public.timetable_entries enable row level security;

create or replace function public.is_institution_user(target uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.institutions i where i.id=target and i.owner_user_id=auth.uid())
  or exists(select 1 from public.institution_members m where m.institution_id=target and m.user_id=auth.uid())
  or exists(select 1 from public.user_profiles p where p.institution_id=target and p.user_id=auth.uid());
$$;

grant execute on function public.is_institution_user(uuid) to authenticated;

drop policy if exists "institution users read announcements" on public.school_announcements;
create policy "institution users read announcements" on public.school_announcements for select to authenticated using (public.is_institution_user(institution_id));
drop policy if exists "staff manage announcements" on public.school_announcements;
create policy "staff manage announcements" on public.school_announcements for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=school_announcements.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=school_announcements.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

drop policy if exists "institution users read homework" on public.homework_items;
create policy "institution users read homework" on public.homework_items for select to authenticated using (public.is_institution_user(institution_id));
drop policy if exists "staff manage homework" on public.homework_items;
create policy "staff manage homework" on public.homework_items for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=homework_items.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=homework_items.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

drop policy if exists "institution users read timetable" on public.timetable_entries;
create policy "institution users read timetable" on public.timetable_entries for select to authenticated using (public.is_institution_user(institution_id));
drop policy if exists "staff manage timetable" on public.timetable_entries;
create policy "staff manage timetable" on public.timetable_entries for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=timetable_entries.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
)
with check (
  exists(select 1 from public.institutions i where i.id=timetable_entries.institution_id and i.owner_user_id=auth.uid())
  or (
    public.current_account_role()='teacher'
    and creator_user_id=auth.uid()
    and public.is_institution_staff(institution_id)
  )
);

commit;


