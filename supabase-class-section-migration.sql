-- EduNizam Class & Section Center upgrade migration
-- =========================================================
-- EduNizam Class & Section Management
-- =========================================================
begin;

alter table public.core_students add column if not exists section_name text;

create table if not exists public.class_sections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  section_name text not null,
  class_teacher_user_id uuid references auth.users(id) on delete set null,
  class_teacher_name text,
  room_label text,
  capacity integer check (capacity is null or capacity > 0),
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id,class_name,section_name)
);

alter table public.class_sections enable row level security;

drop policy if exists "institution users read class sections" on public.class_sections;
create policy "institution users read class sections" on public.class_sections
for select to authenticated
using (public.is_institution_user(institution_id));

drop policy if exists "heads manage class sections" on public.class_sections;
create policy "heads manage class sections" on public.class_sections
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=class_sections.institution_id and i.owner_user_id=auth.uid())
)
with check (
  exists(select 1 from public.institutions i where i.id=class_sections.institution_id and i.owner_user_id=auth.uid())
  and (
    class_teacher_user_id is null
    or exists(
      select 1 from public.institution_members m
      where m.institution_id=class_sections.institution_id
        and m.user_id=class_sections.class_teacher_user_id
        and m.role='teacher'
    )
  )
);

commit;


