-- Restrict destructive table-wide TRUNCATE for browser-facing roles.
-- This intentionally preserves ordinary CRUD grants and does not alter
-- Supabase-managed storage schemas. Review those separately before changes.
revoke truncate on all tables in schema public from anon, authenticated;

-- Future public tables created by the normal migration/object owner.
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;
