# Sensitive RPC execution review

Read-only audit of the EduNizam Supabase project on 2026-10-14.

## Live grant verification

Queried live PostgreSQL ACLs for all `SECURITY DEFINER` functions in the `public` schema using `pg_proc.proacl` and `aclexplode`, checking specifically for grants to `PUBLIC` or `anon`.

**Result: no public-schema SECURITY DEFINER function was found with EXECUTE granted to `PUBLIC` or `anon`.** This means the earlier concern based only on static inspection of the bootstrap SQL was not confirmed in the live database. Do not add a blanket revoke based on that concern.

Five important functions were also checked individually:

- `platform_owner_institutions()`
- `claim_institution_invite(text)`
- `request_parent_link_by_student_code(text)`
- `claim_student_record(text)`
- `is_platform_admin()`

Their live ACLs showed only `postgres`, `authenticated`, and `service_role` with EXECUTE. No production RPC grant change is indicated by this check.

## Remaining security item

Supabase Security Advisor still reports **Leaked Password Protection Disabled**. This is an Auth dashboard setting, separate from database function grants.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Next validation

1. Review the authorization logic inside sensitive functions for business-rule issues; grants alone do not prove the logic is correct.
2. Test invite claim, student record claim, parent linking, and platform owner workflows in EduNizam.
3. Run EduNizam QA and browser workflow regressions after any actual code/database change.
4. Enable leaked-password protection in Supabase Auth settings if the project plan supports it, then re-check the advisor.

This document records a read-only audit; no database changes were made as part of this review.
