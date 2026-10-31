-- Authorized follow-up for Supabase-managed future-table defaults.
-- Run only through a database connection authenticated AS supabase_admin.
-- This script deliberately fails closed when run as postgres or another role.
-- It changes only future-table TRUNCATE defaults; existing object ACLs, RLS,
-- ordinary CRUD grants, and Supabase-managed table data are not modified.
\set ON_ERROR_STOP on
begin;

do $guard$
begin
  if current_user <> 'supabase_admin' then
    raise exception 'Must run as supabase_admin; current_user is %', current_user;
  end if;

  if not exists (select 1 from pg_namespace where nspname = 'public')
    or not exists (select 1 from pg_namespace where nspname = 'graphql')
    or not exists (select 1 from pg_namespace where nspname = 'graphql_public') then
    raise exception 'Expected public, graphql, and graphql_public schemas must all exist';
  end if;
end
$guard$;

-- Apply defaults to objects subsequently created by supabase_admin.
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;
alter default privileges in schema graphql
  revoke truncate on tables from anon, authenticated;
alter default privileges in schema graphql_public
  revoke truncate on tables from anon, authenticated;

do $verify$
declare
  remaining text;
begin
  select string_agg(n.nspname || ' -> ' || r.rolname, ', ' order by n.nspname, r.rolname)
    into remaining
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  left join pg_roles r on r.oid = a.grantee
  where d.defaclrole = (select oid from pg_roles where rolname = 'supabase_admin')
    and n.nspname in ('public', 'graphql', 'graphql_public')
    and a.privilege_type = 'TRUNCATE'
    and r.rolname in ('anon', 'authenticated');

  if remaining is not null then
    raise exception 'TRUNCATE default privileges remain for app roles: %', remaining;
  end if;
end
$verify$;

commit;
select 'supabase_admin future-table TRUNCATE defaults revoked and verified.' as result;
