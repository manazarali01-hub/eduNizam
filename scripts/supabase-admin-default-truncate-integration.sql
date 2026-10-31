\set ON_ERROR_STOP on

-- Disposable PostgreSQL integration only. Create isolated app roles and schemas.
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

-- Seed the exact owner defaults found in the production read-only audit.
set role supabase_admin;
alter default privileges in schema public grant truncate on tables to anon, authenticated;
alter default privileges in schema graphql grant truncate on tables to anon, authenticated;
alter default privileges in schema graphql_public grant truncate on tables to anon, authenticated;

create table public.owner_acl_existing (id integer primary key);
create table graphql.owner_acl_existing (id integer primary key);
create table graphql_public.owner_acl_existing (id integer primary key);

do $seed_check$
declare
  target text;
  role_name text;
begin
  foreach target in array array[
    'public.owner_acl_existing',
    'graphql.owner_acl_existing',
    'graphql_public.owner_acl_existing'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if not has_table_privilege(role_name, target, 'TRUNCATE') then
        raise exception 'Seed failed: % lacks expected initial TRUNCATE on %', role_name, target;
      end if;
    end loop;
  end loop;
end
$seed_check$;

-- Run the guarded remediation while acting as its authorized object owner.
\i supabase/manual/revoke-supabase-admin-default-truncate.sql

-- Existing table ACLs are intentionally untouched; future tables must not inherit TRUNCATE.
create table public.owner_acl_future (id integer primary key);
create table graphql.owner_acl_future (id integer primary key);
create table graphql_public.owner_acl_future (id integer primary key);

do $verify$
declare
  existing_target text;
  future_target text;
  role_name text;
begin
  foreach existing_target in array array[
    'public.owner_acl_existing',
    'graphql.owner_acl_existing',
    'graphql_public.owner_acl_existing'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if not has_table_privilege(role_name, existing_target, 'TRUNCATE') then
        raise exception 'Existing-object ACL was unexpectedly changed for % on %', role_name, existing_target;
      end if;
    end loop;
  end loop;

  foreach future_target in array array[
    'public.owner_acl_future',
    'graphql.owner_acl_future',
    'graphql_public.owner_acl_future'
  ] loop
    foreach role_name in array array['anon', 'authenticated'] loop
      if has_table_privilege(role_name, future_target, 'TRUNCATE') then
        raise exception '% unexpectedly inherited TRUNCATE on future table %', role_name, future_target;
      end if;
    end loop;
  end loop;
end
$verify$;

reset role;
select 'Supabase admin future-table TRUNCATE defaults integration passed.' as result;
