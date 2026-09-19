-- EduNizam Lesson Planning & Syllabus Progress upgrade migration
-- =========================================================
-- EduNizam Lesson Planning & Syllabus Progress
-- =========================================================
begin;

create or replace function public.can_manage_teaching_class(
  p_institution_id uuid,
  p_class_name text,
  p_section_name text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(select 1 from public.institutions i where i.id=p_institution_id and i.owner_user_id=auth.uid())
    or exists(
      select 1
      from public.teacher_student_links tsl
      join public.core_students s
        on s.institution_id=tsl.institution_id
       and s.auth_user_id=tsl.student_user_id
      where tsl.institution_id=p_institution_id
        and tsl.teacher_user_id=auth.uid()
        and s.class_name=p_class_name
        and (coalesce(p_section_name,'')='' or coalesce(s.section_name,'')=coalesce(p_section_name,''))
    );
$$;
grant execute on function public.can_manage_teaching_class(uuid,text,text) to authenticated;

create or replace function public.can_view_family_class(
  p_institution_id uuid,
  p_class_name text,
  p_section_name text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(
      select 1 from public.core_students s
      where s.institution_id=p_institution_id
        and s.auth_user_id=auth.uid()
        and s.class_name=p_class_name
        and (coalesce(p_section_name,'')='' or coalesce(s.section_name,'')=coalesce(p_section_name,''))
    )
    or exists(
      select 1
      from public.parent_student_links l
      join public.core_students s
        on s.institution_id=l.institution_id
       and s.auth_user_id=l.student_user_id
      where l.institution_id=p_institution_id
        and l.parent_user_id=auth.uid()
        and l.status='approved'
        and s.class_name=p_class_name
        and (coalesce(p_section_name,'')='' or coalesce(s.section_name,'')=coalesce(p_section_name,''))
    );
$$;
grant execute on function public.can_view_family_class(uuid,text,text) to authenticated;

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  section_name text,
  subject text not null,
  week_start date not null,
  topic text not null,
  objectives text,
  activities text,
  homework_note text,
  status text not null default 'Draft' check (status in ('Draft','Published','Completed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lesson_plans_class_week_idx on public.lesson_plans(institution_id,class_name,section_name,week_start desc);
alter table public.lesson_plans enable row level security;

drop policy if exists "staff read lesson plans" on public.lesson_plans;
create policy "staff read lesson plans" on public.lesson_plans
for select to authenticated
using (
  exists(select 1 from public.institutions i where i.id=lesson_plans.institution_id and i.owner_user_id=auth.uid())
  or (created_by=auth.uid() and public.can_manage_teaching_class(institution_id,class_name,section_name))
  or (status='Published' and public.can_view_family_class(institution_id,class_name,section_name))
);

drop policy if exists "teachers and heads manage lesson plans" on public.lesson_plans;
create policy "teachers and heads manage lesson plans" on public.lesson_plans
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=lesson_plans.institution_id and i.owner_user_id=auth.uid())
  or (created_by=auth.uid() and public.can_manage_teaching_class(institution_id,class_name,section_name))
)
with check (
  public.can_manage_teaching_class(institution_id,class_name,section_name)
  and (
    exists(select 1 from public.institutions i where i.id=lesson_plans.institution_id and i.owner_user_id=auth.uid())
    or created_by=auth.uid()
  )
);

create table if not exists public.syllabus_progress_units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  section_name text,
  subject text not null,
  unit_title text not null,
  target_end date,
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  status text not null default 'Planned' check (status in ('Planned','In Progress','Completed')),
  family_visible boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists syllabus_progress_class_idx on public.syllabus_progress_units(institution_id,class_name,section_name,subject);
alter table public.syllabus_progress_units enable row level security;

drop policy if exists "authorized users read syllabus progress" on public.syllabus_progress_units;
create policy "authorized users read syllabus progress" on public.syllabus_progress_units
for select to authenticated
using (
  exists(select 1 from public.institutions i where i.id=syllabus_progress_units.institution_id and i.owner_user_id=auth.uid())
  or (created_by=auth.uid() and public.can_manage_teaching_class(institution_id,class_name,section_name))
  or (family_visible and public.can_view_family_class(institution_id,class_name,section_name))
);

drop policy if exists "teachers and heads manage syllabus progress" on public.syllabus_progress_units;
create policy "teachers and heads manage syllabus progress" on public.syllabus_progress_units
for all to authenticated
using (
  exists(select 1 from public.institutions i where i.id=syllabus_progress_units.institution_id and i.owner_user_id=auth.uid())
  or (created_by=auth.uid() and public.can_manage_teaching_class(institution_id,class_name,section_name))
)
with check (
  public.can_manage_teaching_class(institution_id,class_name,section_name)
  and (
    exists(select 1 from public.institutions i where i.id=syllabus_progress_units.institution_id and i.owner_user_id=auth.uid())
    or created_by=auth.uid()
  )
);

commit;


