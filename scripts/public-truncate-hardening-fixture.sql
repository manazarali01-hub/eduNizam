\set ON_ERROR_STOP on
drop table if exists public.truncate_hardening_existing_fixture;
create table public.truncate_hardening_existing_fixture (id integer primary key, note text);
grant select, insert, update, delete, truncate on public.truncate_hardening_existing_fixture to anon, authenticated;
