-- Least-privilege hardening: anonymous or authenticated app sessions should not be able to
-- TRUNCATE public tables. RLS does not provide row-level protection for TRUNCATE.
-- Keep normal SELECT/INSERT/UPDATE/DELETE grants and all RLS policies unchanged.
--
-- Existing grants: clean up current public tables.
revoke truncate on all tables in schema public from anon, authenticated;

-- Future tables: prevent these object-creation roles from reintroducing the
-- unnecessary privilege through their schema-specific default ACLs.
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

alter default privileges for role supabase_admin in schema public
  revoke truncate on tables from authenticated;
