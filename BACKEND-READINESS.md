# EduNizam Backend Readiness

## Current state
- Frontend/PWA works in Local Mode.
- Admissions cloud adapter exists.
- Core school cloud sync adapter exists.
- Full Supabase migration exists in `supabase-full-schema.sql`.
- Cloud remains disabled until a real Supabase project URL, publishable key and institution ID are supplied.

## Deploy order
1. Create/connect Supabase project.
2. Run `supabase-full-schema.sql`.
3. Create/confirm private storage bucket `admission-documents`.
4. Deploy `supabase/functions/admissions-payments/index.ts`.
5. Configure Auth email settings and redirect URLs.
6. Create first institution and Head of Institute account.
7. Fill `cloud-config.js` with:
   - enabled: true
   - supabaseUrl
   - supabasePublishableKey
   - institutionId
   - paymentApiBaseUrl when payment function is live
8. Sign in as Head of Institute.
9. Use Settings > Cloud Backup & Sync > Upload Local Data to Cloud.
10. Verify Student/Parent/Teacher/Head role access on a second device.

## Safety
- Never put service_role keys or payment secrets in frontend files.
- Cloud restore creates a local snapshot at `edunizam_last_cloud_restore_backup`.
- RLS policies protect institution/student data.
- Teacher/Head roles are institute-controlled; Student/Parent may self-register.
