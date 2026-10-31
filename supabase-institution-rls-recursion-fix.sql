-- EduNizam hotfix: break recursive RLS dependency between institutions and institution_members.
-- Applied to production on 2026-09-23.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_institution_owner(
  p_institution_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null
     and exists (
       select 1
       from public.institutions i
       where i.id = p_institution_id
         and i.owner_user_id = p_user_id
     );
$$;

create or replace function private.can_access_institution(
  p_institution_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null
     and (
       exists (
         select 1
         from public.institutions i
         where i.id = p_institution_id
           and i.owner_user_id = p_user_id
       )
       or exists (
         select 1
         from public.institution_members m
         where m.institution_id = p_institution_id
           and m.user_id = p_user_id
       )
       or exists (
         select 1
         from public.user_profiles p
         where p.institution_id = p_institution_id
           and p.user_id = p_user_id
       )
     );
$$;

revoke all on function private.is_institution_owner(uuid,uuid) from public, anon;
revoke all on function private.can_access_institution(uuid,uuid) from public, anon;
grant execute on function private.is_institution_owner(uuid,uuid) to authenticated;
grant execute on function private.can_access_institution(uuid,uuid) to authenticated;

drop policy if exists "owners read institutions" on public.institutions;
create policy "owners read institutions"
on public.institutions
for select
to authenticated
using (
  (select private.can_access_institution(id, (select auth.uid())))
);

drop policy if exists "owners manage members" on public.institution_members;
create policy "owners manage members"
on public.institution_members
for all
to authenticated
using (
  (select private.is_institution_owner(institution_id, (select auth.uid())))
)
with check (
  (select private.is_institution_owner(institution_id, (select auth.uid())))
);
