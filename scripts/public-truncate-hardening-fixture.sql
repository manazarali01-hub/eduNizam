\set ON_ERROR_STOP on
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

-- Simulate a pre-existing overly broad future-table default and a table that
-- already has TRUNCATE, then prove the migration removes both safely.
alter default privileges for role postgres in schema public
  grant truncate on tables to anon, authenticated;
drop table if exists public.truncate_hardening_existing_fixture;
create table public.truncate_hardening_existing_fixture (
  id integer primary key,
  note text
);
grant select, insert, update, delete, truncate
  on public.truncate_hardening_existing_fixture to anon, authenticated;
