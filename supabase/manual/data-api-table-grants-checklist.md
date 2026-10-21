# Supabase Data API table-grant checklist (October 2026)

Supabase's Data API change announced for 30 October 2026 means newly created tables in `public` need explicit table privileges before browser/API roles can access them. Existing table grants are not changed by this announcement.

## Required review for every new public table

1. Add grants in the **same migration** that creates the table; do not assume Supabase will auto-grant access.
2. Grant only the operations the feature actually needs. The examples below are a starting point, not a blanket policy for every EduNizam table.
3. Enable and review Row Level Security (RLS) and add role/school/ownership policies before allowing browser roles to access student, parent, teacher, fee, attendance, or other private data.
4. Test as `anon` and `authenticated` with both allowed and disallowed users/rows. Confirm outsiders cannot read or mutate another school's records.
5. Keep `service_role` and other secret credentials server-side. Never place them in browser code.
6. For recreated schemas, preview branches, and local `supabase db reset`, verify the full migration chain recreates the table and its grants.

## Migration pattern

Append table-specific grants to the migration that creates the table. Replace `public.example_table` and the operation list with the reviewed requirements for that table.

```sql
create table public.example_table (
  id uuid primary key default gen_random_uuid()
  -- reviewed columns and constraints go here
);

-- Example only: use SELECT for anon only if public/anonymous reads are intended.
-- revoke all on table public.example_table from anon, authenticated;
-- grant select on table public.example_table to anon;
-- grant select, insert, update, delete
--   on table public.example_table to authenticated;
-- grant select, insert, update, delete
--   on table public.example_table to service_role;

alter table public.example_table enable row level security;

-- Add explicit, feature-specific RLS policies here before enabling
-- browser access. Do not copy a permissive policy to sensitive tables.
```

The commented grant lines are deliberately not executable defaults: blanket grants can expose or mutate data when paired with an overly broad RLS policy. A table that does not need anonymous access should not receive an `anon` grant. Grant only the needed commands, and verify the effective privileges and RLS policies together.

## Read-only privilege audit

Run this in the SQL editor against the intended project to identify public tables and whether the browser roles have any table privileges. Review the output against the feature's intended access; a grant alone does not prove that RLS is safe.

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;
```

## Audit future-table default privileges

The table-level query above reports effective privileges on existing tables. This second read-only query helps identify default ACLs configured for future tables by each object-owning role. A role may have no row here because PostgreSQL uses built-in defaults; interpret results with the actual table owner and Supabase project configuration.

```sql
select
  owner_role.rolname as object_owner,
  n.nspname as schema_name,
  grantee.rolname as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_default_acl d
join pg_roles owner_role on owner_role.oid = d.defaclrole
join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) acl
left join pg_roles grantee on grantee.oid = acl.grantee
where n.nspname = 'public'
  and grantee.rolname in ('anon', 'authenticated', 'service_role')
order by owner_role.rolname, n.nspname, grantee.rolname, acl.privilege_type;
```

Do not treat a default ACL as a replacement for table-specific review. The migration must state the intended grants for each newly created table, and RLS must still enforce row access.

## EduNizam release gate

- Do not retroactively grant access to all existing tables just to satisfy this announcement.
- Do not apply any SQL to production as part of this checklist-only change.
- Production ledger reconciliation for `20261014170754` and `20261014170811` has been completed in PR #182 by restoring both migration files from the authoritative read-only production ledger and adding a static SQL alignment check. Preserve these historical versions and statements; do not regenerate or reinterpret them.
- Keep the separate public `TRUNCATE` hardening PR and its owner-run `supabase_admin` remediation as distinct review/release gates.
