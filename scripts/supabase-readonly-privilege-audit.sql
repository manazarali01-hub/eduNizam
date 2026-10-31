-- Read-only audit for browser-role table, sequence, and future-object privileges in EduNizam's Supabase project.
-- Run in the SQL Editor or with psql against the intended project.
-- This file intentionally contains SELECT statements only. It does not change grants,
-- default privileges, RLS policies, data, migration history, or Auth settings.

-- 1) Effective TRUNCATE access on existing browser-facing tables.
-- has_table_privilege reports effective privileges, not only explicit ACL entries.
select
  n.nspname as schema_name,
  c.relname as table_name,
  roles.role_name,
  has_table_privilege(roles.role_name, c.oid, 'TRUNCATE') as has_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) as roles(role_name)
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
  and has_table_privilege(roles.role_name, c.oid, 'TRUNCATE')
order by n.nspname, roles.role_name, c.relname;

-- 2) Public tables without RLS. Review each row before browser access is allowed.
select
  n.nspname as schema_name,
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as owner_role,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by c.relname;

-- 3) Future-table defaults that grant TRUNCATE to anon/authenticated.
-- Default ACLs are scoped to the object owner and schema; absence of a row does
-- not itself prove a role cannot receive privileges through another mechanism.
select
  n.nspname as schema_name,
  owner_role.rolname as object_owner,
  coalesce(grantee.rolname, 'PUBLIC') as grantee_role,
  acl.privilege_type,
  acl.is_grantable
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
join pg_roles owner_role on owner_role.oid = d.defaclrole
cross join lateral aclexplode(d.defaclacl) acl
left join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname in ('public', 'storage', 'graphql', 'graphql_public')
  and (grantee.rolname in ('anon', 'authenticated') or acl.grantee = 0)
  and acl.privilege_type = 'TRUNCATE'
order by n.nspname, owner_role.rolname, grantee.rolname;

-- 4) Effective browser-role privileges on public sequences.
-- Sequence privileges are separate from table RLS and CRUD; report them for review,
-- but do not assume every sequence needs the same policy.
select
  n.nspname as schema_name,
  c.relname as sequence_name,
  roles.role_name,
  has_sequence_privilege(roles.role_name, c.oid, 'USAGE') as has_usage,
  has_sequence_privilege(roles.role_name, c.oid, 'SELECT') as has_select,
  has_sequence_privilege(roles.role_name, c.oid, 'UPDATE') as has_update
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) as roles(role_name)
where n.nspname = 'public'
  and c.relkind = 'S'
  and (
    has_sequence_privilege(roles.role_name, c.oid, 'USAGE')
    or has_sequence_privilege(roles.role_name, c.oid, 'SELECT')
    or has_sequence_privilege(roles.role_name, c.oid, 'UPDATE')
  )
order by c.relname, roles.role_name;

-- 5) Full browser-role default ACL inventory for tables, sequences, and functions.
-- This exposes grants beyond TRUNCATE (including sequence USAGE/SELECT/UPDATE and
-- function EXECUTE) across app-facing and Supabase-managed API schemas. Review rows
-- with schema/platform owners; this query is diagnostic, not an instruction to revoke.
select
  n.nspname as schema_name,
  owner_role.rolname as object_owner,
  case d.defaclobjtype
    when 'r' then 'table'
    when 'S' then 'sequence'
    when 'f' then 'function'
    else d.defaclobjtype::text
  end as object_type,
  grantee.rolname as grantee_role,
  acl.privilege_type,
  acl.is_grantable
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
join pg_roles owner_role on owner_role.oid = d.defaclrole
cross join lateral aclexplode(d.defaclacl) acl
join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname in ('public', 'storage', 'graphql', 'graphql_public')
  and d.defaclobjtype in ('r', 'S', 'f')
  and grantee.rolname in ('anon', 'authenticated')
order by n.nspname, owner_role.rolname, object_type, grantee.rolname, acl.privilege_type;

-- Do not infer that RLS protects TRUNCATE: table-wide privileges are separate.
-- Do not change Supabase-managed Storage grants without a separate reviewed plan.
