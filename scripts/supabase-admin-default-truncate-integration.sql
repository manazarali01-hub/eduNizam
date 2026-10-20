\set ON_ERROR_STOP on

-- Disposable PostgreSQL integration only; this creates isolated test roles/schemas.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin;
  end if;
end
$roles$;

create schema graphql authorization supabase_admin;
create schema graphql_public authorization supabase_admin;
grant create on schema public to supabase_admin;
grant usage on schema public, graphql, graphql_public to anon, authenticated;

-- Seed the exact risky owner defaults observed in the read-only production audit.
set role supabase_admin;
alter default privileges in schema public grant truncate on tables to anon, authenticated;
alter default privileges in schema graphql grant truncate on tables to anon, authenticated;
alter default privileges in schema graphql_public grant truncate on tables to anon, authenticated;
reset role;

-- The remediation script must succeed only when the owning role is active.
set role supabase_admin;
\i supabase/manual/20261020_supabase_admin_default_truncate_remediation.sql

-- Exercise future-table behavior, not only pg_default_acl metadata.
create table public.truncate_acl_supabase_admin_future (id integer primary key);
create table graphql.truncate_acl_supabase_admin_future (id integer primary key);
create table graphql_public.truncate_acl_supabase_admin_future (id integer primary key);

do $verify$
declare
  target text;
  role_name text;
begin
  foreach target in array array[
    'public.truncate_acl_supabase_admin_future',
    'graphql.truncate_acl_supabase_admin_future',
    'graphql_public.truncate_acl_supabase_admin_future'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_table_privilege(role_name, target, 'TRUNCATE') then
        raise exception '% unexpectedly has TRUNCATE on future table %', role_name, target;
      end if;
    end loop;
  end loop;
end
$verify$;

reset role;
select 'supabase_admin default-ACL remediation integration checks passed.' as result;
