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


## Attendance analytics
EduNizam includes a monthly Attendance Analytics Center for Student, Parent, Teacher and Head roles. It reuses the existing attendance records instead of creating a second attendance system.

The report provides monthly present/absent/leave/late counts, attendance percentage, low-attendance flags below 75%, class filtering for staff, a daily attendance grid and a printable monthly report. Attendance percentage is defined as `(Present + Late) / (Present + Late + Absent)`; Leave is excluded from the denominator.


## Inventory and assets
EduNizam includes an Inventory & Assets Center for furniture, IT equipment, laboratory items, books, stationery and other school property.

Head of Institute can create/edit/delete items, track quantity, reorder levels, estimated value, condition, location, purchase date and asset assignment to staff. Teachers have read-only inventory access. Stock items generate low-stock alerts when quantity reaches the configured reorder level. A printable inventory report is included.


## Physical library circulation
EduNizam includes a Library Circulation Center for the school's physical books. This is separate from the digital Study Library.

Head of Institute manages the catalog, accession numbers and copy counts. Head/Teacher can issue and return books; Teachers are restricted to their assigned students. Student/Parent accounts can read loans for their accessible student records. Cloud issue uses a server-side transaction that locks the book row, checks available copies and prevents duplicate active loans. Due dates, overdue status, search and a printable loan register are included.


## Transport and routes
EduNizam includes a Transport & Route Center for school vehicles, routes and student pickup/drop assignments.

Head of Institute manages routes, stops, monthly transport fee, vehicles, seating capacity, driver/conductor details and student assignment. The cloud assignment RPC locks the selected vehicle and checks capacity before assigning, with one current assignment per student. Student and Parent roles can read only transport information for their accessible student records.


## Student discipline and behavior
EduNizam includes a Student Discipline & Behavior Center that tracks Positive Notes, Concerns, Warnings and Incidents with severity, action taken, open/resolved state and optional family visibility.

Head of Institute can manage all institute records. Teachers can manage records for their assigned students and can read assigned-student records. Student/Parent accounts only see records explicitly marked "Share with family". Family-visible records generate notifications and can be acknowledged by the linked Student or Parent. Staff-only notes remain hidden from family accounts.


## Visitor and student gate pass
EduNizam includes a Visitor & Student Gate Pass Center.

Visitor check-in/out is Head-only. Parents can request an early-exit gate pass for an approved linked child, including exit date/time, pickup person, relation, phone and reason. Head can approve, reject and mark an approved pass as Exited. Student and Parent roles can read their own gate-pass history and print the pass. Pickup details are intentionally not exposed to Teacher accounts.


## Lesson planning and syllabus progress
EduNizam includes a Lesson Plan & Syllabus Progress Center. Teachers and Head can create weekly lesson plans with class/section, subject, topic, objectives, teaching activities and follow-up/homework. Plans support Draft, Published and Completed states.

Syllabus units/chapters track target completion date, completion percentage and Planned/In Progress/Completed status. Teachers are restricted to classes/sections represented by their assigned students; Head can manage all institute classes. Student/Parent accounts see only Published lesson plans and syllabus units explicitly marked family-visible for their linked class/section. A printable syllabus progress report is included.


## Helpdesk and complaints
EduNizam includes a structured Helpdesk & Complaint Center for Academics, Attendance, Fees, Transport, Behavior, Facilities, Technical, Admission and Other issues.

Student, Parent, Teacher and Head accounts can submit tickets with priority and optional student context. Cloud validation restricts Student context to self, Parent context to approved linked children, and Teacher context to assigned students. Normal users read only their own tickets; Head reads and manages institute tickets, can move them through Open/In Progress/Resolved/Closed, add an official response, and triggers notifications back to the ticket creator. Printable ticket records are included.


## Parent complaint notices with photo and video
EduNizam includes a separate Parent Complaint Notices Center. Head of Institute can send a complaint about any student; a Teacher can send a complaint only about an assigned student. The complaint requires an approved linked Parent account so there is a valid recipient.

Each complaint supports text plus up to 3 private photo/video attachments (maximum 25 MB each). Media is stored in the private `parent-complaints` Supabase Storage bucket, never as a public URL. Authorized viewers receive one-hour signed URLs. The linked Parent receives a notification, can view the complaint/media and acknowledge receipt; Head can mark the complaint Resolved. Parent acknowledgement also notifies the staff creator.
