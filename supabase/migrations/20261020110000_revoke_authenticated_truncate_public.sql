-- Least-privilege hardening: anonymous or authenticated app sessions should not be able to
-- TRUNCATE public tables. RLS does not provide row-level protection for TRUNCATE.
-- Keep normal SELECT/INSERT/UPDATE/DELETE grants and all RLS policies unchanged.
--
-- Production catalog audit: all 75 public tables are owned by postgres, and the
-- migration executor is postgres but is not a member of supabase_admin. Do not
-- issue ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin here: PostgreSQL rejects
-- that operation without membership in the target role. Any supabase_admin-owned
-- objects/default ACLs require a separate authorized remediation path.
--
-- Existing grants: clean up current public tables.
revoke truncate on all tables in schema public from anon, authenticated;

-- Future tables created by the active migration/object owner.
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
