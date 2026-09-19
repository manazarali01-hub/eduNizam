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


## Class and section management
EduNizam includes a Class & Section Center for class/section records, class teachers, rooms, capacity and student allocation. Existing student records remain compatible because `sectionName` / `section_name` is optional.

Head of Institute manages sections and student allocation. Teachers have read-only access to the class/section directory. Cloud backup and restore preserve each student's section.


## Staff attendance and payroll
Head of Institute can mark daily staff attendance, configure monthly salary, generate payroll, apply allowances/deductions, mark salary paid and print payslips. Teachers only read their own linked attendance and payroll records.

Attendance-based payroll uses base salary / 30 as the daily rate. Absent days deduct one daily rate and Half Day deducts half a daily rate; Leave does not deduct salary automatically.


## Student ID cards and certificates
EduNizam includes a Student Documents Center. Head of Institute can issue Student ID Cards, Bonafide Certificates, Enrollment Certificates and Leaving Certificates with a unique document number and issue date.

Student and Parent accounts can read and print documents belonging to their linked student records. ID cards use an initials avatar when no student photo is available, so the feature works without a photo-upload dependency.


## School finance and cashbook
EduNizam includes a Head-only Finance & Cashbook Center. Paid student fees and paid staff payroll are counted automatically, while the cashbook stores only other income and other expenses to avoid double-counting.

The monthly statement shows fees collected, other income, salaries paid, other expenses, total income/expense and monthly surplus or deficit, with a printable finance statement.


## School calendar and events
EduNizam includes a School Calendar & Events Center for Holidays, PTM, Exams, Fee Due dates, Meetings, Activities and other events.

Head can manage all institution events. Teachers can create and manage their own events. Events can target the whole institute, students, parents, staff, or a specific class/section. Student and Parent cloud access is protected by RLS so they only read relevant events.


## Secure inbox and messaging
EduNizam includes an Inbox & Messaging Center for Head–Parent, Teacher–Student and Teacher–Parent conversations.

Cloud contacts are generated only from approved `parent_student_links` and assigned `teacher_student_links`. Conversation creation is validated server-side by RPC, messages are protected by participant-only RLS, and recipients receive an EduNizam notification when a new message arrives.

Local Mode provides a same-device demo inbox; secure cross-device messaging requires Cloud Mode and authenticated linked accounts.
