# Sensitive RPC execution review

Reviewed the EduNizam Supabase project and `supabase-production-one-step.sql` on 2026-10-14.

## Live grant verification: five functions

Queried `pg_proc.proacl` and `information_schema.routine_privileges` for these SECURITY DEFINER functions:

- `platform_owner_institutions()`
- `claim_institution_invite(text)`
- `request_parent_link_by_student_code(text)`
- `claim_student_record(text)`
- `is_platform_admin()`

For all five, the live ACL showed only `postgres`, `authenticated`, and `service_role` with EXECUTE. Neither `PUBLIC` nor `anon` appeared in the effective ACL. **No production change is needed for these five functions based on this check.** This corrects the initial static-review concern: the bootstrap SQL alone was not enough to establish the live grants.

## Remaining audit scope

The bootstrap SQL contains many more SECURITY DEFINER functions. Review the live ACL and authorization logic function-by-function before proposing changes. Do not apply a blanket revoke: some helpers may be used by guest health checks, RLS policies, or triggers.

## Validation checklist

1. Continue checking live ACLs for remaining SECURITY DEFINER functions.
2. For any real exposure, confirm the function's intended callers and test authorization before changing grants.
3. Run EduNizam QA and browser workflow regressions after any approved change.
4. Re-check Supabase Security Advisor. Leaked-password protection remains a separate dashboard setting and is still reported disabled.

This document records a read-only audit; no database changes were made as part of this review.
