-- Restored verbatim from the applied production migration record.
-- Source: supabase_migrations.schema_migrations, version 20261014170754.
revoke all privileges on all tables in schema public from anon;
grant insert on table public.platform_feedback to anon;
