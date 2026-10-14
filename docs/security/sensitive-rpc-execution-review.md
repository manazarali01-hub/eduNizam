# Sensitive RPC execution review

Reviewed `supabase-production-one-step.sql` on 2026-10-14.

## Functions needing explicit execution-grant verification

The following SECURITY DEFINER functions have explicit authenticated grants in the production bootstrap SQL, but the file does not consistently revoke the default PUBLIC execution grant first:

- `platform_owner_institutions()`
- `claim_institution_invite(text)`
- `request_parent_link_by_student_code(text)`
- `claim_student_record(text)`
- `is_platform_admin()`

## Recommended hardening

For each function above, use a reviewed migration to revoke execution from `PUBLIC` and `anon`, then grant execution to `authenticated`. Do not apply a blanket revoke to every SECURITY DEFINER function: some are health checks or helpers used by guest flows, policies, and triggers.

## Validation before merge

1. Query `information_schema.routine_privileges` / `pg_proc.proacl` to verify effective grants after migration.
2. Confirm anonymous calls are denied for the five functions.
3. Confirm signed-in workflows still work: platform owner console, invite claim, student record claim, and parent link request.
4. Run EduNizam QA and browser workflow regression jobs.
5. Re-check Supabase Security Advisor; leaked-password protection remains a separate dashboard setting.

This is an audit note, not evidence that the production database has been changed.
