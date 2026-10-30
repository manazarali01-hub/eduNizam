# EduNizam Feature Inventory — Phase 1 Baseline

**Captured:** 30 October 2026  
**Repository baseline:** `main` at `a21b4f49231a1e4cd7158fccc087a8d52fcf8726`  
**Working change:** PR #196, mobile navigation + blue glass presentation  
**Purpose:** Establish a source-backed inventory before content and workflow completion.

## How to read this inventory

- **Present in shell** means an authenticated dashboard view/route is present in `app.html`. It does **not** mean the feature is functionally complete.
- **Mapped implementation** names the current feature script(s) or data bundles referenced by `feature-loader.js`; it is not a passing workflow test.
- **Functional status:** Pending end-to-end verification unless explicitly recorded in a later phase report.
- Do not expose private dashboard routes or school/student records to public search indexing.

## Authenticated workspace inventory

The application shell currently declares **50 dashboard views**. The list below is the inventory baseline, not a completion claim.

| # | Area | View ID | Feature / subfeature | Current source mapping | Functional status |
|---:|---|---|---|---|---|
| 1 | Overview | `dashboard` | Admin / role dashboard, workspace overview | `role-dashboard.js`, `app.html` | Pending verification |
| 2 | Students | `students` | Student management and records | `app.html`, student/core scripts | Pending verification |
| 3 | Students | `studentprofile` | Student profiles and performance | `student-performance.js`, `academic-operations-deep.js` | Pending verification |
| 4 | Academics | `classcenter` | Academic groups, classes and sections | `class-section-center.js`, `academic-groups-csv.js` | Pending verification |
| 5 | Setup | `bulkimport` | Bulk import and school setup | `bulk-import-center.js` | Pending verification |
| 6 | Attendance | `attendance` | Student attendance | `app.html`, attendance/core scripts | Pending verification |
| 7 | Attendance | `attendanceanalytics` | Attendance analytics and reports | `attendance-analytics.js`, `academic-operations-deep.js` | Pending verification |
| 8 | Staff | `staffcenter` | Staff and teacher management | `staff-center.js`, `school-form-options.js` | Pending verification |
| 9 | Staff | `stafftime` | Staff attendance and time clock | `staff-time-attendance.js` | Pending verification |
| 10 | Staff | `staffpayroll` | Staff attendance and payroll | `staff-payroll.js` | Pending verification |
| 11 | Staff | `training` | Teacher training | `teacher-training-center.js` | Pending verification |
| 12 | Community | `ourstudents` | Our Students / student community | `school-community.js` | Pending verification |
| 13 | Student support | `behaviorcenter` | Discipline and behavior | `student-behavior.js`, `school-student-picker.js` | Pending verification |
| 14 | Parent support | `parentcomplaints` | Parent complaints and notices | `parent-complaint-center.js`, `school-student-picker.js` | Pending verification |
| 15 | Campus | `gatecenter` | Visitor management and gate passes | `gate-pass-center.js` | Pending verification |
| 16 | Student documents | `studentdocs` | ID cards and certificates | `student-documents.js`, `school-student-picker.js` | Pending verification |
| 17 | Leave | `leavecenter` | Leave requests and decisions | `leave-center.js`, `school-student-picker.js` | Pending verification |
| 18 | Finance | `fees` | Fee collection and fee records | `fee-center.js`, `academic-operations-deep.js` | Pending verification |
| 19 | Finance | `financecenter` | Finance, cashbook and summaries | `finance-center.js` | Pending verification |
| 20 | Operations | `inventorycenter` | Inventory and assets | `inventory-center.js` | Pending verification |
| 21 | Operations | `librarycenter` | Library circulation | `library-center.js` | Pending verification |
| 22 | Operations | `transportcenter` | Transport and routes | `transport-center.js` | Pending verification |
| 23 | Exams | `results` | Results, promotion and report data | `result-center-deep.js`, `promotion-center.js` | Pending verification |
| 24 | Academics | `schoolwork` | Assignments, homework and school work | `school-work.js`, `academic-workflow-deep.js` | Pending verification |
| 25 | Communication | `noticeboard` | Notice board and announcements | `notice-board-center.js` | Pending verification |
| 26 | Academics | `lessoncenter` | Lesson plans and syllabus | `lesson-plan-center.js`, `school-syllabus-csv.js` | Pending verification |
| 27 | Calendar | `calendarcenter` | Calendar and school events | `calendar-center.js` | Pending verification |
| 28 | Community | `functionscenter` | School functions and events | `school-community.js` | Pending verification |
| 29 | Exams | `paperbuilder` | Science / teacher paper builder | `teacher-paper-builder.js`, `paper-source-import.js`, `paper-syllabus-audit.js` | Pending verification |
| 30 | Academics | `dailydiary` | Daily class diary | `daily-class-diary.js`, `academic-workflow-deep.js` | Pending verification |
| 31 | Timetable | `schedulecenter` | Timetable and date sheets | `timetable-date-sheet.js` | Pending verification |
| 32 | Communication | `inboxcenter` | Inbox and messaging | `messaging-center.js`, `academic-workflow-deep.js` | Pending verification |
| 33 | Support | `helpdeskcenter` | Helpdesk and complaints | `helpdesk-center.js` | Pending verification |
| 34 | Exams | `examcenter` | Exams and exam operations | `exam-center.js`, `academic-operations-deep.js` | Pending verification |
| 35 | Learning Hub | `pastpapers` | Pakistan board past papers | `past-papers-data.js`, `past-papers-inventory.js`, `past-papers-premium.js` | Pending verification |
| 36 | Learning Hub | `practice` | Practice questions and tests | `practice-center.js`, practice data/session bundles | Pending verification |
| 37 | Learning Hub | `study` | Study library and textbooks | `study-library.js`, curriculum/study inventory bundles | Pending verification |
| 38 | Learning Hub | `schoolassessments` | Grade 5 and Grade 8 resources | `education-hubs.js`, school assessment data | Pending verification |
| 39 | Learning Hub | `universities` | University and higher-education resources | `education-hubs.js`, university directory data | Pending verification |
| 40 | Learning Hub | `competitive` | CSS, PPSC and FPSC preparation | `competitive-exams.js`, `competitive-exams-data.js` | Pending verification |
| 41 | Learning Hub | `ecosystem` | Admissions, scholarships and skills | `education-ecosystem.js`, ecosystem data | Pending verification |
| 42 | Learning Hub | `pathways` | Exam and study pathways | `exam-pathways.js`, topic practice/planner bundles | Pending verification |
| 43 | Learning Hub | `vu` | Virtual University resources | `education-hubs.js`, `vu-workspace.js`, VU catalog/library | Pending verification |
| 44 | Admissions | `admissions` | Online school admissions | `admissions-data.js`, `admissions-selection.js`, `admissions-portal.js` | Pending verification |
| 45 | AI & Tools | `assistant` | AI assistant and math editor | `math-editor.js` plus external MathJax | Pending verification |
| 46 | Support | `help` | Help and knowledge centre | `help-knowledge-center.js` | Pending verification |
| 47 | System | `datareadiness` | Data readiness checks | `school-data-readiness.js` | Pending verification |
| 48 | System | `troubleshoot` | Troubleshooting tools | `app.html`, system scripts | Pending verification |
| 49 | System | `settings` | Workspace and account settings | `app.html`, account/security scripts | Pending verification |
| 50 | Communication | `communication` | Communication centre | `communication-center.js` | Pending verification |

## Public / guest-facing learning and information surfaces

Source-backed public routes and content areas identified in the repository include:

- Home, Features, About, Privacy, Contact and Login.
- Guest Learning Hub at `learn.html`; guest navigation support in `guest-learning-nav.js` and `guest-learning-premium.js`.
- Pakistan Board past papers and learning resources; public learning resource pages.
- Grade 5 / Grade 8 assessment resources.
- Science / teacher paper builder resources and practice material.
- University, Virtual University and AIOU resources.
- CSS / PPSC / FPSC, entry tests, scholarships and exam pathways.
- Online admissions and school-management information pages.

Public URL indexability, unique content depth, source attribution and guest access will be audited in the relevant later phases. Private app views, login/session routes and school records must remain non-indexable.

## Cross-cutting workflows to verify in Phase 3

1. Authentication, session restore, account switching, workspace selection and logout.
2. Role visibility and authorization for admin/head, teacher, parent and student.
3. Student create/edit/archive, profile linking and academic group assignment.
4. Attendance entry, correction, analytics and report output.
5. Fees, receipts, finance ledger and reconciliation.
6. Staff profiles, time clock, payroll and leave approvals.
7. Admissions submission, review, status and student conversion.
8. Exams, date sheets, marks entry, result publication and report cards.
9. Assignments, homework, lesson plans, syllabus and daily diary.
10. Paper Builder configuration, source import, validation, preview and print/export.
11. Visitor/gate pass, ID cards/certificates and discipline records.
12. Learning Hub guest access, search, filters, resource links and downloads.
13. Import/export, duplicate prevention, validation, loading, error and success states.
14. Mobile drawer, accordion groups, scrolling, keyboard/touch access and responsive tables.

## Initial findings / next actions

- The mobile navigation regression was reproducible in CI: the new accordion intentionally hides children of collapsed groups, while parts of the browser regression flow still attempted to interact with a hidden destination without consistently opening its group first.
- PR #196 already contains the navigation CSS/accordion and the requested blue glass visual layer. The PR is not merged; production deployment is not implied.
- Browser QA viewport coverage is being expanded to the exact requested widths: 320, 360, 375, 390, 412, 430, 768 and 1366.
- Current CI evidence must be rechecked after the latest QA changes. Do not mark the sidebar complete until rendered browser checks pass.
- Each feature remains functionally unverified until the relevant role-based workflow, persistence and error states are tested. Phase 2 and Phase 3 should be tracked separately; this inventory is not a feature-completion certificate.
