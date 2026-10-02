-- EduNizam official published report cards
-- Server-generated report snapshots + Student/Parent acknowledgement.

begin;

create table if not exists public.report_card_publications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.core_students(id) on delete cascade,
  report_type text not null default 'Combined Results',
  title text not null,
  version_no integer not null check (version_no > 0),
  snapshot jsonb not null,
  status text not null default 'Published' check (status in ('Published','Archived')),
  published_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(student_id,report_type,version_no)
);

create index if not exists report_card_publications_institution_idx
  on public.report_card_publications(institution_id,published_at desc);
create index if not exists report_card_publications_student_idx
  on public.report_card_publications(student_id,published_at desc);
create index if not exists report_card_publications_publisher_idx
  on public.report_card_publications(published_by,published_at desc);

alter table public.report_card_publications enable row level security;

drop policy if exists "authorized users read published report cards" on public.report_card_publications;
create policy "authorized users read published report cards"
on public.report_card_publications for select to authenticated
using (public.can_access_core_student(student_id));

drop policy if exists "staff publish report cards" on public.report_card_publications;
create policy "staff publish report cards"
on public.report_card_publications for insert to authenticated
with check (
  published_by=(select auth.uid())
  and (select private.can_manage_core_student_v1(student_id,(select auth.uid())))
);

drop policy if exists "publisher or head archives report cards" on public.report_card_publications;
create policy "publisher or head archives report cards"
on public.report_card_publications for update to authenticated
using (
  published_by=(select auth.uid())
  or exists(
    select 1 from public.institutions i
    where i.id=report_card_publications.institution_id
      and i.owner_user_id=(select auth.uid())
  )
)
with check (
  status in ('Published','Archived')
  and (
    published_by=(select auth.uid())
    or exists(
      select 1 from public.institutions i
      where i.id=report_card_publications.institution_id
        and i.owner_user_id=(select auth.uid())
    )
  )
);

revoke all on public.report_card_publications from anon;
revoke delete,truncate,references,trigger on public.report_card_publications from authenticated;
grant select,insert on public.report_card_publications to authenticated;
grant update(status) on public.report_card_publications to authenticated;

create table if not exists public.report_card_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.report_card_publications(id) on delete cascade,
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  viewer_role text not null check (viewer_role in ('student','parent')),
  acknowledged_at timestamptz not null default now(),
  unique(publication_id,viewer_user_id)
);

create index if not exists report_card_ack_publication_idx
  on public.report_card_acknowledgements(publication_id,acknowledged_at desc);
create index if not exists report_card_ack_viewer_idx
  on public.report_card_acknowledgements(viewer_user_id,acknowledged_at desc);

alter table public.report_card_acknowledgements enable row level security;

drop policy if exists "report acknowledgement readers" on public.report_card_acknowledgements;
create policy "report acknowledgement readers"
on public.report_card_acknowledgements for select to authenticated
using (
  viewer_user_id=(select auth.uid())
  or exists(
    select 1 from public.report_card_publications p
    where p.id=report_card_acknowledgements.publication_id
      and (select private.can_manage_core_student_v1(p.student_id,(select auth.uid())))
  )
);

drop policy if exists "family acknowledge report cards" on public.report_card_acknowledgements;
create policy "family acknowledge report cards"
on public.report_card_acknowledgements for insert to authenticated
with check (
  viewer_user_id=(select auth.uid())
  and viewer_role=public.current_account_role()
  and viewer_role in ('student','parent')
  and exists(
    select 1 from public.report_card_publications p
    where p.id=report_card_acknowledgements.publication_id
      and p.status='Published'
      and public.can_access_core_student(p.student_id)
  )
);

drop policy if exists "family refresh report acknowledgement" on public.report_card_acknowledgements;
create policy "family refresh report acknowledgement"
on public.report_card_acknowledgements for update to authenticated
using (
  viewer_user_id=(select auth.uid())
  and viewer_role=public.current_account_role()
  and viewer_role in ('student','parent')
)
with check (
  viewer_user_id=(select auth.uid())
  and viewer_role=public.current_account_role()
  and viewer_role in ('student','parent')
);

revoke all on public.report_card_acknowledgements from anon;
revoke delete,truncate,references,trigger on public.report_card_acknowledgements from authenticated;
grant select,insert,update on public.report_card_acknowledgements to authenticated;

-- The production project also defines:
-- public.publish_report_card_v1(uuid,text,text)
-- public.acknowledge_report_card_v1(uuid)
-- These RPCs are SECURITY INVOKER and derive official snapshots from result_records/attendance_records.

commit;
