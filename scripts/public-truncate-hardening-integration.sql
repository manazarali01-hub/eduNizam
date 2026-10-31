\set ON_ERROR_STOP on
begin;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_table_privilege(role_name, 'public.truncate_hardening_existing_fixture', 'TRUNCATE') then
      raise exception '% still has TRUNCATE on the existing fixture', role_name;
    end if;
    if not has_table_privilege(role_name, 'public.truncate_hardening_existing_fixture', 'SELECT')
      or not has_table_privilege(role_name, 'public.truncate_hardening_existing_fixture', 'INSERT')
      or not has_table_privilege(role_name, 'public.truncate_hardening_existing_fixture', 'UPDATE')
      or not has_table_privilege(role_name, 'public.truncate_hardening_existing_fixture', 'DELETE') then
      raise exception '% lost ordinary CRUD privileges', role_name;
    end if;
  end loop;
end
$$;

create table public.truncate_hardening_future_fixture (id integer primary key, note text);
grant select, insert, update, delete on public.truncate_hardening_future_fixture to anon, authenticated;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_table_privilege(role_name, 'public.truncate_hardening_future_fixture', 'TRUNCATE') then
      raise exception '% unexpectedly has TRUNCATE on future fixture', role_name;
    end if;
    if not has_table_privilege(role_name, 'public.truncate_hardening_future_fixture', 'SELECT')
      or not has_table_privilege(role_name, 'public.truncate_hardening_future_fixture', 'INSERT')
      or not has_table_privilege(role_name, 'public.truncate_hardening_future_fixture', 'UPDATE')
      or not has_table_privilege(role_name, 'public.truncate_hardening_future_fixture', 'DELETE') then
      raise exception '% lost ordinary CRUD privileges on future fixture', role_name;
    end if;
  end loop;
end
$$;

rollback;
select 'Public TRUNCATE hardening integration checks passed.' as result;
