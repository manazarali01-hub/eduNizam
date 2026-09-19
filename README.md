# EduNizam – AI School Assistant

EduNizam is a modular school-management and learning PWA for schools, students, parents, teachers and institute heads.

## Current modules
- Dashboard and role-based access
- Students, attendance, fees and results
- Student progress dashboard
- Pakistan board past papers
- Grade 5 & 8 assessment resources
- University Hub and VU Special
- Study library and practice tests
- Online admissions
- Communication / Google Meet scheduling
- Notifications and academic access controls
- Cloud backup/sync readiness with Supabase
- AI Assistant shell and Math editor

## Architecture
- Frontend: HTML, CSS, JavaScript
- Hosting: GitHub Pages
- Offline/local mode: browser localStorage + PWA service worker
- Cloud backend: Supabase (optional until configured)
- AI: secure server-side AI backend still needs to be connected; never expose AI API keys in browser code

## Cloud setup
Use **Settings → EduNizam Cloud Setup**. Do not hard-code production credentials into repository files.

For a fresh Supabase project:
1. Run `supabase-production-one-step.sql` in Supabase SQL Editor.
2. Deploy `supabase/functions/admissions-payments/index.ts` only when admission payments are needed.
3. In EduNizam Settings, enter the Supabase Project URL and publishable/anon key.
4. Enable cloud mode, sign in, create/select the institution, then run Backend Health Check.

## Past-paper data quality
- `official`: hosted by the relevant board/university or official portal.
- `verified`: third-party/community source checked as a useful index/archive.
- `community`: supplementary material that should be verified against current official syllabus/handouts.
- Search fallbacks should never pretend that an exact paper is indexed when only a source/archive is available.

## Safety
- Never put Supabase `service_role`, payment secrets, webhook secrets, private API keys or AI keys in browser files.
- RLS remains the security boundary for browser-side Supabase access.


## AI Assistant backend
- Frontend client: `ai-client.js`
- Supabase Edge Function: `supabase/functions/ai-assistant/index.ts`
- Usage/quota migration: `supabase-ai-usage-migration.sql`
- Default cost-sensitive model: `gpt-5.6-luna` (override with `EDUNIZAM_AI_MODEL`)
- Required Edge Function secret: `OPENAI_API_KEY`
- Optional secrets: `EDUNIZAM_AI_DAILY_LIMIT`, `EDUNIZAM_AI_MODEL`, `EDUNIZAM_ALLOWED_ORIGINS`

The OpenAI key must remain server-side. Never put it in GitHub, `cloud-config.js`, localStorage or browser JavaScript.


## SaaS owner and subscriptions
EduNizam now includes a secure Platform Owner Console for subscription plans, institute trial/status control, usage counts and configured monthly recurring revenue.

Platform Owner is separate from the institute-level Head role. No normal user can self-promote to platform admin.

After Supabase is connected and the owner's Auth account exists, bootstrap the first platform administrator once from the Supabase SQL editor:

```sql
insert into public.platform_admins(user_id)
select id from auth.users
where email = 'OWNER_EMAIL_HERE'
on conflict (user_id) do nothing;
```

Replace `OWNER_EMAIL_HERE` with the actual owner login email. Do not put this bootstrap logic or any service-role credential in browser JavaScript.

The Owner Console manages plan configuration and subscription state. Payment collection/settlement is not yet connected, so "Configured MRR" is not the same as received revenue.


## Monthly fee challans and receipts
EduNizam Fee Management now supports monthly student challans, class-fee auto-fill, discounts, arrears, due dates, payment references and printable paid receipts. Existing simple fee records remain compatible.

Cloud mode stores the enhanced billing fields in `fee_records` and stores editable per-class monthly fees in `class_fee_structure`. Student and Parent accounts only read fee records allowed by the existing student-access RLS.
