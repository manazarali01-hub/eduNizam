# EduNizam Backend Readiness

## Current state
- Frontend/PWA works in Local Mode.
- Supabase adapters exist for authentication, school data, admissions, roles, notifications and communication.
- The recommended production migration is `supabase-production-one-step.sql`.
- Cloud stays disabled until a real Supabase Project URL and publishable/anon key are supplied.

## Recommended deploy order
1. Create a Supabase project.
2. Run `supabase-production-one-step.sql` in Supabase SQL Editor.
3. Confirm the `admission-documents` storage bucket and RLS policies created by the migration.
4. Configure Supabase Auth email settings and allowed redirect URLs.
5. Deploy `supabase/functions/ai-assistant/index.ts` for EduNizam AI. Set the server-side `OPENAI_API_KEY` secret. Optional: `EDUNIZAM_AI_MODEL=gpt-5.6-luna`, `EDUNIZAM_AI_DAILY_LIMIT=25`, and `EDUNIZAM_ALLOWED_ORIGINS=https://manazarali01-hub.github.io`.
6. If admission payments are needed, deploy `supabase/functions/admissions-payments/index.ts` and configure its server-side environment variables.
7. Open EduNizam → Settings → EduNizam Cloud Setup.
8. Enter the Supabase Project URL and publishable/anon key, enable Cloud Mode, and reload.
9. Sign in. On first owner setup, create the institution; otherwise select the linked institution.
10. Run **Backend Health Check** in Settings.
11. Test Head, Teacher, Student and Parent accounts on separate sessions/devices.
12. Only after successful testing, use Cloud Backup & Sync to migrate any existing local school records.

## Important notes
- Do not manually edit `cloud-config.js` for normal setup; the Settings screen stores runtime configuration locally.
- `cloud-config.example.js` is reference documentation only.
- Never put service-role keys, payment gateway secrets, webhook secrets or AI API keys in frontend files.
- Cloud restore keeps a local snapshot at `edunizam_last_cloud_restore_backup`.
- RLS policies protect institution/student data.
- Teacher/Head roles are institute-controlled; Student/Parent may self-register and then link/claim records.
