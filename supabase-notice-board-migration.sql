-- EduNizam Digital Notice Board upgrade migration
-- =========================================================
-- EduNizam Digital Notice Board upgrade (extends school_announcements)
-- =========================================================
begin;

alter table public.school_announcements add column if not exists class_name text;
alter table public.school_announcements add column if not exists section_name text;
alter table public.school_announcements add column if not exists priority text not null default 'Normal';
alter table public.school_announcements add column if not exists pinned boolean not null default false;
alter table public.school_announcements add column if not exists valid_until date;
alter table public.school_announcements add column if not exists updated_at timestamptz not null default now();

alter table public.school_announcements drop constraint if exists school_announcements_audience_check;
alter table public.school_announcements add constraint school_announcements_audience_check
check (audience in ('all','students','parents','teachers','class'));

alter table public.school_announcements drop constraint if exists school_announcements_priority_check;
alter table public.school_announcements add constraint school_announcements_priority_check
check (priority in ('Normal','Important','Urgent'));

create index if not exists school_announcements_notice_board_idx
on public.school_announcements(institution_id,pinned desc,created_at desc);

create or replace function public.can_view_school_notice(n public.school_announcements)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(select 1 from public.institutions i where i.id=n.institution_id and i.owner_user_id=auth.uid())
    or (
      public.current_account_role()='teacher'
      and public.is_institution_staff(n.institution_id)
      and (n.audience in ('all','teachers','students','parents') or n.audience='class')
    )
    or (
      public.current_account_role()='student'
      and (n.valid_until is null or n.valid_until>=current_date)
      and (
        n.audience in ('all','students')
        or (
          n.audience='class'
          and exists(
            select 1 from public.core_students s
            where s.institution_id=n.institution_id
              and s.auth_user_id=auth.uid()
              and s.class_name=n.class_name
              and (coalesce(n.section_name,'')='' or coalesce(s.section_name,'')=coalesce(n.section_name,''))
          )
        )
      )
    )
    or (
      public.current_account_role()='parent'
      and (n.valid_until is null or n.valid_until>=current_date)
      and (
        n.audience in ('all','parents')
        or (
          n.audience='class'
          and exists(
            select 1
            from public.parent_student_links l
            join public.core_students s
              on s.institution_id=l.institution_id
             and s.auth_user_id=l.student_user_id
            where l.institution_id=n.institution_id
              and l.parent_user_id=auth.uid()
              and l.status='approved'
              and s.class_name=n.class_name
              and (coalesce(n.section_name,'')='' or coalesce(s.section_name,'')=coalesce(n.section_name,''))
          )
        )
      )
    );
$$;
grant execute on function public.can_view_school_notice(public.school_announcements) to authenticated;

drop policy if exists "institution users read announcements" on public.school_announcements;
drop policy if exists "users read relevant school notices" on public.school_announcements;
create policy "users read relevant school notices" on public.school_announcements
for select to authenticated
using (public.can_view_school_notice(school_announcements));

drop policy if exists "staff manage announcements" on public.school_announcements;
create policy "staff manage announcements" on public.school_announcements
for all to authenticated
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
    and (
      audience<>'class'
      or exists(
        select 1
        from public.teacher_student_links tsl
        join public.core_students s
          on s.institution_id=tsl.institution_id
         and s.auth_user_id=tsl.student_user_id
        where tsl.institution_id=school_announcements.institution_id
          and tsl.teacher_user_id=auth.uid()
          and s.class_name=school_announcements.class_name
          and (coalesce(school_announcements.section_name,'')='' or coalesce(s.section_name,'')=coalesce(school_announcements.section_name,''))
      )
    )
  )
);

commit;


