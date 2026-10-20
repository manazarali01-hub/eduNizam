\set ON_ERROR_STOP on
-- Isolated PostgreSQL 16 fixture. Never run against production.
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

drop table if exists public.truncate_acl_existing_fixture;
create table public.truncate_acl_existing_fixture (id integer primary key, note text);
grant select, insert, update, delete on public.truncate_acl_existing_fixture to anon, authenticated;
grant truncate on public.truncate_acl_existing_fixture to anon, authenticated;
