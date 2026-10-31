-- EduNizam Staff & Teacher Center upgrade migration
-- =========================================================
-- EduNizam Staff & Teacher Profiles
-- =========================================================
begin;

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  staff_code text not null,
  full_name text not null,
  designation text not null default 'Teacher',
  phone text,
  subjects text[] not null default '{}'::text[],
  classes text[] not null default '{}'::text[],
  joining_date date,
  employment_status text not null default 'active' check (employment_status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id,staff_code)
);

create unique index if not exists staff_profiles_linked_user_idx
on public.staff_profiles(institution_id,user_id)
where user_id is not null;

alter table public.staff_profiles enable row level security;

drop policy if exists "head manage staff profiles" on public.staff_profiles;
create policy "head manage staff profiles" on public.staff_profiles
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=staff_profiles.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=staff_profiles.institution_id and i.owner_user_id=auth.uid())
  and (
    user_id is null
    or exists(
      select 1 from public.institution_members m
      where m.institution_id=staff_profiles.institution_id
        and m.user_id=staff_profiles.user_id
        and m.role='teacher'
    )
  )
);

drop policy if exists "teachers read own staff profile" on public.staff_profiles;
create policy "teachers read own staff profile" on public.staff_profiles
for select to authenticated
using (user_id=auth.uid());

commit;


