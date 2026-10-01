(function(){
'use strict';

const TYPES=[
 'Course Notes / Handouts','Highlighted Handouts','Short Notes',
 'Lecture Videos','Reference Books','Assignments','GDB / Current Semester',
 'Quizzes / MCQs','Midterm Past Papers','Finalterm Past Papers',
 'Current Papers / Recalls','Solved Past Papers','Preparation Videos',
 'PPT Slides','Practicals / Lab Manuals','Books / References','Final Project / Viva','Internship / Field Experience',
 'Syllabus / Study Guide','Grading Scheme','Course Overview','Useful Links','Offline App Library'
];

const COMMUNITY=[
 {
  id:'vuanswer-handouts',type:'Course Notes / Handouts',title:'Updated Handouts 2026',
  url:'https://vuanswer.pk/vu-all-updated-handouts/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Course-wise handout PDFs are listed for a large range of VU subjects. Community mirror; verify current syllabus with official VU material.'
 },
 {
  id:'vuanswer-highlighted',type:'Highlighted Handouts',title:'Highlighted Handouts 2026',
  url:'https://vuanswer.pk/highlighted-handouts-2024/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Course-wise highlighted handout PDFs/Drive downloads. Supplementary revision material, not an official VU publication.'
 },
 {
  id:'vuanswer-short-notes',type:'Short Notes',title:'VU Short Notes',
  url:'https://vuanswer.pk/category/short-notes/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Short-note collections for exam revision. Community material; check concepts against the current official handout.'
 },
 {
  id:'vuanswer-midterm',type:'Midterm Past Papers',title:'Midterm Past Papers — All Subjects',
  url:'https://vuanswer.pk/vu-midterm-past-papers-all-subjects/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Course-wise midterm solved papers, MCQs, notes and preparation files in PDF/Word where listed.'
 },
 {
  id:'vuanswer-midterm-mcqs',type:'Quizzes / MCQs',title:'Midterm MCQs / Quiz Practice',
  url:'https://vuanswer.pk/vu-midterm-past-papers-all-subjects/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Many course sections include solved MCQs, quiz files, lecture-wise objective practice and short preparation files.'
 },
 {
  id:'vuanswer-current-recalls',type:'Current Papers / Recalls',title:'Current / Recent Paper Recall Files',
  url:'https://vuanswer.pk/vu-midterm-past-papers-all-subjects/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Community-recalled/current-paper files are mixed into course sections where available. Treat recalls as supplementary and semester-specific.'
 },
 {
  id:'vuanswer-final',type:'Finalterm Past Papers',title:'Finalterm Past Papers — All Subjects',
  url:'https://vuanswer.pk/vu-finalterm-past-papers-all-subjects/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Course-wise finalterm solved papers, MCQs, notes and preparation files where listed.'
 },
 {
  id:'vuinsider-past',type:'Solved Past Papers',title:'Moaaz / Waqar / Solved Past Papers',
  url:'https://vuinsider.com/forums/past-papers.21/',source:'VU Insider',trust:'verified',
  access:'download_index',note:'Community solved-paper forum including Waqar Siddhu and Moaaz collections plus many course-specific threads.'
 },
 {
  id:'vuinsider-assignments',type:'Assignments',title:'Assignment Solutions Archive',
  url:'https://vuinsider.com/forums/assignments-solutions.4/',source:'VU Insider',trust:'verified',
  access:'download_index',note:'Community assignment-solution archive. Use for learning/reference only; current graded work must follow VULMS instructions and academic-integrity rules.'
 },
 {
  id:'vuinsider-gdb',type:'GDB / Current Semester',title:'GDB Study / Solution Archive',
  url:'https://vuinsider.com/forums/gdb-solutions.2/',source:'VU Insider',trust:'verified',
  access:'download_index',note:'Community GDB study/solution archive. Use only for understanding and comparison; write current graded GDB work yourself and follow VULMS instructions.'
 },
 {
  id:'vuedutech-midterm',type:'Midterm Past Papers',title:'Course-wise Midterm Past Papers',
  url:'https://vuedutech.com/past-papers/midterm-pastpapers/',source:'VU Updates Tech',trust:'verified',
  access:'download_index',note:'Searchable course-wise midterm preparation/past-paper download index.'
 },
 {
  id:'vuedutech-final',type:'Finalterm Past Papers',title:'Course-wise Finalterm Past Papers',
  url:'https://vuedutech.com/past-papers/finalterm-pastpapers/',source:'VU Updates Tech',trust:'verified',
  access:'download_index',note:'Course-wise finalterm preparation/past-paper download index covering many VU subjects.'
 },
 {
  id:'vuedutech-final-videos',type:'Preparation Videos',title:'Finalterm Preparation Videos',
  url:'https://vuedutech.com/past-papers/finalterm-Preparation-video/',source:'VU Updates Tech',trust:'verified',
  access:'open',note:'Supplementary course-wise exam-preparation videos; official VU lecture videos remain the primary lecture source.'
 },
 {
  id:'vuanswer-final-mcqs',type:'Quizzes / MCQs',title:'Finalterm MCQs / Quiz Practice',
  url:'https://vuanswer.pk/vu-finalterm-past-papers-all-subjects/',source:'VUAnswer',trust:'verified',
  access:'download_index',note:'Finalterm course sections frequently include solved MCQs, quizzes and objective-practice files alongside papers and short notes.'
 },
 {
  id:'vuinsider-handouts',type:'Course Notes / Handouts',title:'VU Handouts PDF Archive',
  url:'https://vuinsider.com/threads/vu-handouts-pdfs.120/',source:'VU Insider',trust:'verified',
  access:'download_index',note:'Community-organized VU handout PDF archive across many course codes.'
 },
 {
  id:'vuctn-past',type:'Solved Past Papers',title:'VU CTN Past Papers with Drive Links',
  url:'https://www.vuctn.com/',source:'VU CTN',trust:'verified',
  access:'download_index',note:'VU CTN exposes past papers, handouts, short notes, quizzes, grand quizzes and Drive-linked paper collections. Some legacy category links may move, so use the main resource hub when a category link changes.'
 },
 {
  id:'vuctn-short',type:'Short Notes',title:'VU CTN Short Notes',
  url:'https://www.vuctn.com/',source:'VU CTN',trust:'verified',
  access:'download_index',note:'Community short-note collections and course-oriented revision material.'
 },
 {
  id:'vuctn-ppt',type:'PPT Slides',title:'VU CTN PPT Slides',
  url:'https://www.vuctn.com/',source:'VU CTN',trust:'verified',
  access:'download_index',note:'Community PPT/PDF slide collections for VU subjects where available.'
 },
 {
  id:'vuctn-quiz',type:'Quizzes / MCQs',title:'VU CTN Quiz / Grand Quiz Files',
  url:'https://www.vuctn.com/',source:'VU CTN',trust:'verified',
  access:'download_index',note:'Community quiz and grand-quiz preparation files.'
 },
 {
  id:'vuctn-books',type:'Books / References',title:'VU CTN Books / Reference Material',
  url:'https://www.vuctn.com/',source:'VU CTN',trust:'verified',
  access:'download_index',note:'Supplementary books/reference resources where listed by the community hub.'
 },
 {
  id:'vustudy-final',type:'Finalterm Past Papers',title:'VUStudy Final Term Past Papers',
  url:'https://vustudy.com/final-term-past-papers/',source:'VUStudy',trust:'verified',
  access:'download_index',note:'Large course-wise final-term paper directory including Moaaz, Waqar Siddhu and other student-prepared materials.'
 },
 {
  id:'vustudy-current',type:'Current Papers / Recalls',title:'VUStudy Current / Recent Papers',
  url:'https://vustudy.com/vu-final-term-papers/',source:'VUStudy',trust:'verified',
  access:'download_index',note:'Community current/recent paper and MCQ posts; semester-specific and supplementary only.'
 },
 {
  id:'virtualuniversitypk-handouts',type:'Course Notes / Handouts',title:'VirtualUniversityPK Handouts PDF Library',
  url:'https://virtualuniversitypk.com/vu-handouts/',source:'VirtualUniversityPK',trust:'verified',
  access:'download_index',note:'Broad subject-wise handout library with direct PDF download pages across ACC, BIF, BIO, CS, ECO, EDU, ENG, MGT, MTH, PSY, STA and other VU prefixes.'
 },
 {
  id:'vustudyhub-materials',type:'Course Notes / Handouts',title:'VU Study Hub Materials',
  url:'https://vustudyhub.com/materials.php',source:'VU Study Hub',trust:'verified',
  access:'open',note:'Current community browse index for handouts, assignments, quizzes, GDBs and past papers. Some course pages currently contain demo/placeholders, so EduNizam does not label this provider as download-ready unless a real file is exposed.'
 },
 {
  id:'vustudyhub-assignments',type:'Assignments',title:'VU Study Hub Assignments',
  url:'https://vustudyhub.com/assignments.php',source:'VU Study Hub',trust:'verified',
  access:'open',note:'Course and semester-oriented assignment preparation/resources. Some current entries are demo placeholders; browse before relying on a file.'
 },
 {
  id:'vustudyhub-quizzes',type:'Quizzes / MCQs',title:'VU Study Hub Quizzes',
  url:'https://vustudyhub.com/quizzes.php',source:'VU Study Hub',trust:'verified',
  access:'open',note:'Course-wise quiz preparation resources where published. Some current entries are demo placeholders; browse before relying on a file.'
 },
 {
  id:'vustudyhub-project',type:'Final Project / Viva',title:'CS619 / CS519 Final Project Hub',
  url:'https://vustudyhub.com/projects.php',source:'VU Study Hub',trust:'verified',
  access:'download_index',note:'Project ideas, SRS, design documents, test cases, final report guidance, presentations, viva preparation, project guidelines and video tutorials for CS619/CS519.'
 },
 {
  id:'vustudyhub-internship',type:'Internship / Field Experience',title:'VU Internship / Field Experience Resources',
  url:'https://vustudyhub.com/projects.php',source:'VU Study Hub',trust:'verified',
  access:'open',note:'Community project/internship hub with CS619 internship references and supporting project resources. Current internship requirements must be confirmed through official VU channels.'
 },
 {
  id:'vuctn-practicals',type:'Practicals / Lab Manuals',title:'VU Practical / Lab Resources',
  url:'https://www.vuctn.com/',source:'VU CTN',trust:'verified',
  access:'download_index',note:'Community practical/manual resources where available for lab-oriented courses.'
 },
 {
  id:'acadora-offline',type:'Offline App Library',title:'Acadora Offline VU Library',
  url:'https://wasii.dev/acadora',source:'Acadora',trust:'verified',
  access:'open',note:'Free Android study app/library for VU past papers, handouts, notes and assignments with offline-ready access and course search.'
 },
 {
  id:'vumalik-past',type:'Solved Past Papers',title:'VU Malik Solved Past Paper Archive',
  url:'https://vumalik.blogspot.com/',source:'VU Malik',trust:'verified',
  access:'download_index',note:'Course-specific solved MCQ/subjective paper posts with Moaaz, Waqar Siddhu, Hadi and Malik references on many subjects.'
 },
 {
  id:'vuedu-handouts',type:'Course Notes / Handouts',title:'VUEDU VU Handouts',
  url:'https://vuedu.dev/documents?type=handouts',source:'VUEDU',trust:'verified',
  access:'download_index',note:'Current free/no-registration Pakistani document library with VU handouts and instant-access downloads.'
 },
 {
  id:'vuedu-notes',type:'Short Notes',title:'VUEDU Notes',
  url:'https://vuedu.dev/documents?type=notes',source:'VUEDU',trust:'verified',
  access:'download_index',note:'Current VU and Pakistani-university note library with free document access.'
 },
 {
  id:'vuedu-papers',type:'Solved Past Papers',title:'VUEDU Past Papers',
  url:'https://vuedu.dev/documents?type=past-papers',source:'VUEDU',trust:'verified',
  access:'download_index',note:'Free course-organized past-paper document library; verify recalled/solved material against official handouts.'
 },
 {
  id:'vuedu-mcqs',type:'Quizzes / MCQs',title:'VUEDU Online MCQ Practice',
  url:'https://vuedu.dev/quiz',source:'VUEDU',trust:'verified',
  access:'open',note:'Current online MCQ practice collections including VU course-specific mid/final practice sets.'
 },
 {
  id:'vuedu-syllabus',type:'Syllabus / Study Guide',title:'VUEDU Syllabus / Study Guides',
  url:'https://vuedu.dev/documents?type=syllabus',source:'VUEDU',trust:'verified',
  access:'download_index',note:'Free syllabus and study-guide document index; official VU course outline/VULMS remains the source of truth.'
 },
 {
  id:'vulmstools-handouts',type:'Course Notes / Handouts',title:'VU LMS Tools Handouts',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'download_index',note:'Current JavaScript-based VU study tool offering course handout preview/downloads.'
 },
 {
  id:'vulmstools-mid',type:'Midterm Past Papers',title:'VU LMS Tools Midterm Papers',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'download_index',note:'Course-code midterm paper practice/download library.'
 },
 {
  id:'vulmstools-final',type:'Finalterm Past Papers',title:'VU LMS Tools Final Term Papers',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'download_index',note:'Course-code final-term paper practice/download library.'
 },
 {
  id:'vulmstools-assignments',type:'Assignments',title:'VU LMS Tools Assignment Study',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'open',note:'Solved-assignment study help. Use to understand methods; write and submit current graded work according to VULMS rules.'
 },
 {
  id:'vulmstools-gdb',type:'GDB / Current Semester',title:'VU LMS Tools GDB Help',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'open',note:'Structured GDB study help; current graded responses should be written independently and follow VULMS instructions.'
 },
 {
  id:'vulmstools-quiz',type:'Quizzes / MCQs',title:'VU LMS Tools MCQ Quiz Generator',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'open',note:'Timed MCQ practice generated from course handouts with explanations.'
 },
 {
  id:'vulmstools-reviews',type:'Current Papers / Recalls',title:'VU LMS Tools Paper Reviews',
  url:'https://www.vulmstools.com/',source:'VU LMS Tools',trust:'verified',
  access:'open',note:'Recent student paper-review/recall area. Semester-specific community reports are supplementary only.'
 },
 {
  id:'vustudentshelper-all',type:'Course Notes / Handouts',title:'VU Students Helper Archive',
  url:'https://vustudentshelper.blogspot.com/',source:'VU Students Helper',trust:'legacy',
  access:'download_index',note:'Legacy broad backup archive covering handouts, lectures, past papers, GDBs, quizzes and assignments across many VU course codes.'
 },
 {
  id:'vustudentshelper-papers',type:'Solved Past Papers',title:'VU Students Helper Past Papers',
  url:'https://vustudentshelper.blogspot.com/p/vu-past-papers.html',source:'VU Students Helper',trust:'legacy',
  access:'download_index',note:'Legacy backup paper archive. Prefer current sources first and verify answers against current official handouts.'
 },
 {
  id:'vubooks-handouts',type:'Course Notes / Handouts',title:'VU Books Handouts PDF',
  url:'https://vubookhandouts.blogspot.com/',source:'VU Books Handouts',trust:'legacy',
  access:'download_index',note:'Legacy PDF/PPT handout archive for selected common VU courses.'
 },
 {
  id:'vubooks-ppt',type:'PPT Slides',title:'VU Books Handouts PPT Slides',
  url:'https://vubookhandouts.blogspot.com/',source:'VU Books Handouts',trust:'legacy',
  access:'download_index',note:'Legacy PowerPoint/slide backup for selected courses.'
 },
 {
  id:'vubookshoppk-handouts',type:'Course Notes / Handouts',title:'VUBookshopPK Updated Handouts',
  url:'https://vubookshoppk.com/vu-handouts-pdf/',source:'VUBookshopPK',trust:'verified',
  access:'download_index',note:'Current broad VU handout directory grouped by subject prefixes, including MKT, MTH, PSY, SOC, STA, IT, MCM, MGMT and other departments.'
 },
 {
  id:'vuacademy-highlighted',type:'Highlighted Handouts',title:'VU Academy Highlighted Handouts',
  url:'https://vuacedmy.com/academic/handouts/highlighted-handouts.php',source:'VU Academy',trust:'verified',
  access:'download_index',note:'Alternative highlighted-handout collection organized by VU subject/course.'
 },
 {
  id:'nva-handouts',type:'Course Notes / Handouts',title:'NVA Education VU Handout Pages',
  url:'https://nvaeducation.com/books/vu/',source:'NVA Education',trust:'verified',
  access:'open',note:'Course-specific VU handout pages with embedded/linked Google Drive material. Some downloads may require the provider’s sharing step, so this is labelled as a browse/download page rather than a direct file.'
 }
];

const DIRECT_HANDOUTS={
 'BIF101':'1bPhSMm1v5sy274zbkX44P7y4wPQqAzXC',
 'BIF401':'1yokcCqlPt_GoVBqrN2vx2hZjeAuBsixR',
 'BIF501':'1KjDTL-D1lWVpQPnxtJBojCHWuCO_newR',
 'BIF602':'1AF1uDmcGDgu_ZhFs6qUPGpRTVM5AXxTJ',
 'BIO101':'14CKSe_4p4ISL3zzNnFXYvRcsa-ziJm4b',
 'BIO201':'1ugH3pzOG_A_wBLU2uhR6tcBJnCm10vly',
 'BIO202':'1WWaALma69PmVuofOmFoKap9W-sTcK9xZ',
 'BIO203':'1O43eJkRBOFsJdjwrnfFImCpwfj5-PkrN',
 'BIO204':'1KJIb1_2S9eTUCLB7aX8rbPUOpYjRdMED',
 'BIO301':'1FRYrUoM2vfYx2-0GXNKMy2v8XvY_bbD5',
 'BIO302':'1OI4Q74i9kbuIpSmofxIcnlTZeLU2O03F',
 'BIO303':'1Rt5RMzxmkJpSn0wagUb64ASKlwtXUQaY',
 'BIO503':'192cLA048KFN5-RfIR1oT7Ksqu6pbVR6h',
 'BIO504':'123I79zMJxfMYgw4plHc4g0YqKEN9ShnP',
 'BIO505':'1RZ_jSL47fiX6DgVrvv3BQCweV-da2i0S',
 'BIO506':'1Zz7LFdDFLzdgC9Vh6KNj9-llDPrRRuEB',
 'BT101':'1aOk-ZquPi_wjb3vqqpRbcovziv2TKs72',
 'BT102':'1uk8aSy7-ekjFo1z2mT03ApwrG9QFspQa',
 'BT201':'14MMaQH-oKYGyG60UJbBLNFISb0OT8KmX',
 'BT302':'1JAMvhnrOzlvYfwr9hXRN2_nnrycqrj36',
 'BT401':'1r5SR2pBNOzVeNi1D2E1UdlVDklmmgS-g',
 'BT402':'14YINgoyyKHd-hVhWFSoADF821CM2UJST',
 'BT404':'1wpsUAqOEP5FZgkygub-g4RAyI7_0cePj',
 'BT405':'1p3DOIq9T5oazgeQvjVDegXDlnR3VD2Lu',
 'BT406':'1FtQiABCmFgUa6N0v9e7QUnM7GADkxZVC',
 'BT501':'1DTnAAU2SfULn_ZxWHtPl6xFnZR1i0zaw',
 'BT503':'1WQD2pwxcbYhlReKfzTZQ3xhtyQrY7thX',
 'BT505':'1jozxHEVRwz6htC-_IeDxs0qY-xQuuV-T',
 'BT511T':'1xMmbNMeo6rwgujDUAK79kavra1gzBLxI',
 'BT601':'1Ft9Ol1aW2EbL9gv8w1TdDXen4ymykraw',
 'BT603':'1heNxkcYNjY20CWjxxL5c-h-4NabocK7n',
 'BT605':'1Clsw-XntrXC4Ke5B6T3HHeqEnsMPWRY4',
 'CHE201':'1JTDYzQ5JJY8XAJXn3RbCl70MukXuMAGr',
 'CHE301':'10eUYHZeGyHf7rriKnvg40Vu37M-fvsTw',
 'CS101':'1N_9ZMxbyw5UsXZOOgzKW__6sRaqRglL0',
 'CS201':'1jR56zBmr1POMe471zmDdh44n99TTCioE',
 'CS301':'1mhg8XcEOBfIQanKzzT8GxsMMT4oEM7UX',
 'CS302':'1gHwqOUWyH4ad9D_TO9ya-FP2mZByagoG',
 'CS304':'1b_fzOcgU63CfOlvd85fcTI9lvVdJDeHW',
 'CS401':'1nBuOO2P0PlJBHKLwKYqKQ178upsyNyk2',
 'CS402':'1RDYvmBd1aWDOI7SfjjOoV5laiUC9CmZG',
 'CS403':'1ykT6xsLDLkkz5pBW9I1ry35Wm-KVug-C',
 'CS408':'1otMjBWHTvALDtEheAhWecgmUZmQTW4JP',
 'CS501':'1H-UF1W7QfQRv58D1QeSt5yycYDalVRVq',
 'CS502':'1efBVH4m_pBe7UzpS0XryQ1d0V2SDi2ZP',
 'CS504':'1m8Lo_KiY9Pa3ZSIgClUpPCqs7dj2OQeJ',
 'CS506':'1IFBB5Jzoo9hI3vX2dnE9H0aaZ86zF5zZ',
 'CS507':'1ew6mHy1F6G7nrW6lae377-_yr0aBzwv1',
 'CS601':'11k00zleUSW1sVn5XA9FyyT_UU3FRrMMn',
 'CS604':'1sgBZYGPYD2orODOfCnIoJ6p2XCRGdms1',
 'CS606':'1LRMvWu3C-NKwQOHtt4IqIXks_-YTkpXk',
 'CS610':'1knUa58NawAluTiDSUmx-j_DW3zsP0-1D',
 'CS614':'1P6Rz4VJ7k9hfwyh_ci6gZQJEGkkB_6v9',
 'CS615':'1E5UpRPxPft69_wOiHEvROE7Y8IiQSpEz',
 'ECO401':'1J8yTihYRxDzKCkia_EWPAKNzRCpSVeZc',
 'ECO402':'1Q7qnTyjpHkUm5A-NrUxAsUwWqoiwZJNm',
 'ECO403':'14i6XcQM-oa2p2tKlGalSIt8cJag4JypR',
 'ECO601':'1V184DUcwY3bI96h2LWksTX7kjoW-l10S',
 'ECO606':'1NY5siTXIfuWqGvej4lE9E5sFuRtBaIE9',
 'EDU101':'1-_3upXbNZ4YEQSvWcaveiVwgRAcgcNoT',
 'EDU301':'1D_-2GaqmValegyJsLl1pOaQq5UpZkgDk',
 'EDU302':'1tGOAITqywBgnqjRAJERMUUCuZh5LugJd',
 'EDU303':'1BvPC7hl9WWpIjNZe6P_SNUo_WQjXh3ab',
 'EDU304':'1FzZOdBGzkW5bAZB2IPBvByfo2WhYkdU8',
 'EDU305':'11XMjizMLtyq7isLgw7PWzMRH2mrA8bhh',
 'EDU401':'14TjCfQUyEaQi-DOu4MpI3cd_WfBez6KS',
 'EDU402':'1PtN0MQDmazmjLcXztbmaefyHzdfGAxZJ',
 'EDU403':'1xoM_ghvYhKmlFOfgUpGb9GmtGHlJ-83j',
 'EDU406':'1emrb4dZ_fWue9oS4Fyz5fei8nKNdwoZg',
 'EDU430':'1DpVYHsqg1kZTJF11-7Yu8Nn6bqsKhMDN',
 'EDU431':'1HBeBxpENb9wdvJpywq2FJMMaHkkzx2bX',
 'EDU516':'1KbSYDNE8-JCeOKyZ86djS-06FisXFFEt',
 'EDU601':'1A_xk9LgVWwMvtA0qdWXbZsTfz84Evq_d',
 'EDU602':'1PzTvQ6QNzBlajg760NxX16XAP6q7LnFC',
 'EDU654':'1llKW3BcpS9jP6kW0BrBDYVAZ0UOSjV3u',
 'ENG001':'13XaMshhMvnDzwmNo-FVeGoLjaFmwf-9z',
 'ENG101':'1UiG73PCVq_h3XPMUEVPRmrpzA3K7kBzH',
 'ENG201':'1UJIQ5kdCmUS5BVszggYgv1lJnxZwW-rL',
 'ENG501':'1sNc0jKYgmDsJIU-Pt2Wxtrbx0jdoqWeW',
 'ENG502':'1gaSjdIyaYMIKcoMCa0sInbD93ZTuqO3f',
 'ENG503':'1pYXvEzhZiiAmpJ_l7R8ye6HWGalB-b3W',
 'ENG504':'1-qW12sLzFXed69SN907hZtrv85wQ8VjN',
 'ENG505':'1yEjKeifcDJqvO0RW1h3w2RiLmVHlCmU1',
 'ENG506':'1Ovqgf6Ij2MSU8lju86vN2aUOju02PIiB',
 'ENG508':'1xPdPnFydF4zPxNaCGQDp_oCyClrdoUDf',
 'ENG509':'1vSyMVPiZvV8UKDseVmjCmx8spEygxu89',
 'ENG511':'1piF73elzgpdT1M78un0aziCp74XUodql',
 'ENG513':'17ijQZRGkOVXShMZ3-aN76r0dnqXOVijZ',
 'ENG514':'1QaBl24hNyzwcCWqlGl_vngO1D5txRX4Y',
 'ENG515':'1DeG2A74wCh26j-vhN5qR3HM4mVjtQtpf',
 'ENG517':'11-MbfossdvT5CzBz37sbGAy8OusPRNZk',
 'ENG518':'1tmQeaKU3NxZpgNHfMXBf07jTOWXL1pKz',
 'ENG519':'1_2m9AJ0ZuD_pX39l506dOgvgsTwtyS3Y',
 'ENG520':'1Ws-rhBjZOKAPitJEv7OebcFmTld3Nkhk',
 'ENG522':'1m6KImhTht9cggo9UXCvJW8Q7IGJx32ab',
 'ENG523':'1brVonkscDugg-IJKvMd7mau3goLQqGKP',
 'ENG529':'1FCjpVAtwvJCgnwoUFCqnyJF1lDCx_yDd',
 'ISL201':'14fOIM3vNwQSzw5OMVAeJpMRc6rWG6KyS',
 'IT430':'1yPSofZULLSYqMj7rGs0biQjjU58ri9-4',
 'MCM101':'1-FKqPp5lSz3jN4iv7AJ5JrxAXjZeLgBt',
 'MGT101':'1t3PP9ql8PpJf0fayLbP3MzCJke5JD5N6',
 'MGT111':'1YVtPP2ImzIGdUuYJk1h1E8_wFfnwyzME',
 'MGT201':'1S4Dlbz02U-8aVNJqoDAF_grD-p959W1t',
 'MGT211':'1ZiXuOVZpx_Hf6_8adbE2mwFNZP44RX2w',
 'MGT301':'1C0eAYz9wQhv7IN9xzxm4pm3qn3bGyEUC',
 'MGT401':'1iqPx5SBglF5x9-ZgKU-xpAHQIjoF655A',
 'MGT402':'1iqPx5SBglF5x9-ZgKU-xpAHQIjoF655A',
 'MGT404':'1ExTWZKun2tscuVEEtpsPx1RQYadD_Jzq',
 'MGT411':'11Ig3JCPFlypNkITrayLeYMr24WLFQFZT',
 'MGT501':'1cdt4HJg_P_FkRhowDFpJ8Fq8AS6LZbk_',
 'MGT502':'1GT-cre9XqgD40KQbhHOnODLLqMQiyKvA',
 'MGT503':'1eCSO_s5cVX6nrXgj1KD1JSfdhgmrlaAT',
 'MGT504':'1Zz3dbJdhqhROoMbzkMZ4cg1tNV2t-Ayl',
 'MGT510':'193S4BVdqjxzql2WJiMo0LACk5Ju1lanG',
 'MGT520':'1XtNX3Disf8kbHpbTUh4rFad_CNJRckJr',
 'MGT601':'1ZQxU4oVlui-n47NqVPvVBeCADjqk6weR',
 'MGT602':'1Xl9JJCm8r1PKJZs5eDuHh6BIL92FcgYV',
 'MGT603':'1wnVhBDdCTmder8q_wKakL5tBqCRxrQkK',
 'MGT611':'1W8iLxI5CDLYsY33GT8jqOtNDbt2th3ww',
 'MGT613':'1lfwnbkn3UCr2psSfk-R9hL8b_7N_KWVT',
 'MGT621':'1eOKzyjCjg9nVdm-4HfECTzww3v8UlLXd'
};

const DIRECT_HIGHLIGHTED={
 'CS001':'1fFxksRZwJT6zGojaQSRPWzxvh6pbctJK',
 'CS101':'1N_9ZMxbyw5UsXZOOgzKW__6sRaqRglL0',
 'CS201':'1hs_Goz7E2tapouq90Fo8XE66Tv_pPp3H',
 'CS202':'1Mzfnhu7-YHyVaZSb6MX_6qoYfc8uqXMV',
 'CS204':'1mAzgCTwRjaxed28MXEgy1QwqaBj9WpJG',
 'CS205':'1qA8sjpdjm6pwf5Hmz1v-SY8Jlfg_HbAi',
 'CS301':'1tY3Gq4f9P4wJiyCITaWWnQDInuTDdZrm',
 'CS302':'1zuZvboe5UpHmnWjKWBObgFRIHAIF45jq',
 'CS304':'1FhkuIRT5H58QiFJ9QeNSMudvrTudXGoo',
 'CS311':'1ForTlGLa_PwATKw2pwINwT3-2dMsEk5H',
 'CS401':'1xftfPbOYL5NldayA5lojs3eTF-1W0QQe',
 'CS402':'1CS-EWwsGfTP_pXe7JKTKSI9pZfHU0ZZE',
 'CS403':'1L5zJqG_ey3wlic7kLaB997CuHX7c5Xgu',
 'CS405':'1YRNqeC-qvGfTL9N_c2EHaOnAXycVrOiU',
 'CS408':'1IrZDUG99OTg4MEm2Y6bhElD6V2OZugoz',
 'CS409':'1EYoS7_VTabgn9F_NpVJFnQOym9_7-f6Q',
 'CS411':'1ETUUq2uJcMQRV0269f_6-_Gko640h_Zg',
 'CS501':'1VLkyZf---vMVyAPNVbd1zO1IHdGId_T1',
 'CS502':'1ESrXCQ27vJWQp4VT8CMsNDyLi5kZjxV1',
 'CS504':'1p7oBXBlD5kISU5D2PjTvFcxdZtQwVzrQ',
 'CS505':'1IJtExXjJjwhPiT3iVl-EeUTbdbwQ37p3',
 'CS506':'1mJIiUqu4MRKJA2Yab9_b5BlpHVjzHTa9',
 'CS507':'1P7oVCQtrsjT4D4ekqGx_B-ub2N81PmVX',
 'CS508':'1VSKWENsvrzC-u9FdlcceWrnw3H31iIhz',
 'CS601':'1YVPE80LkjAIa7pqEaYfToOuURQijVwmI',
 'CS603':'1b_klDssL1atU2UTGsKcO-FyPadd1Y4KU',
 'CS604':'1sgBZYGPYD2orODOfCnIoJ6p2XCRGdms1',
 'CS605':'1-hqdPuN9qOnZVgUpXcLZIgZVqbXZUqps',
 'CS606':'1t-dnOylAvtZZ5Py_IokJKQNX_AUhuK8I',
 'CS607':'1ImaRyHygEYJr0zGf8PE_WrFmvB6YPwdT',
 'CS609':'19tCp20P8RByU3gwvmf7B6OihSHKFyW2V',
 'CS610':'1knUa58NawAluTiDSUmx-j_DW3zsP0-1D',
 'CS611':'1j24IG9lueC1HemGH-uUguAW4S6WcSaSm',
 'CS614':'1sUpvj5OrU2C43-BxMnUWcY-9HqBrb57o',
 'CS615':'1Df9SwH9GgQzPbFxhAwNBll_1U5EaiWmu',
 'CS620':'1UZZUBWvwnu5BL35WDEPAfY03ZJNeibI9',
 'CS621':'1DYJ6YZ4XPTNace1hNEqk6SUADd9e9mJZ',
 'CS627':'1kyrxXfTNVAfP7aJMaTwBujRWlahkTmEK',
 'ECO401':'1vyMcLiE-qn76AX1yvPPiENXgOo4hC-Un',
 'ECO402':'1sZ4RLwMEITZmK2yr6aVwq4IxEVo6YKb2',
 'ECO403':'1-j9-46RJNmgZzM1H5n6PyITOnIUcic3n',
 'EDU101':'157pyaEed9jUr3wpKSqds_pUkW9AWtB_M',
 'EDU201':'1MLafRkUgkjYiCvrNWNgQi9QEPmvFMxgr',
 'EDU301':'1elo0rMgGMvlVWW9coYkbb8fR9xOi5W0U',
 'EDU303':'1gYH0_ETBiJGWQT8Jz--HuH-ro3qHx9vj',
 'EDU304':'1br-vWOU6Qn6I4CAN_sdaM0fmV8P25A9Y',
 'EDU305':'1c4hQ0V8etos-ke9GBShq0rdM4rLvbU0P',
 'EDU401':'1nDOds5lcdEvowi5ZSeQdNhnDymMZn228',
 'EDU403':'1VCeza3BvQoFX93_mx-WMb4no6vyfLBEi',
 'EDU406':'1Dt4UJEoKoSRtkiakOWRSVmKJWwea33Hy',
 'EDU410':'1UOB4_rp1hsnSJYakDpYQyUS_afJe8MQw',
 'EDU501':'1GpLU_infjh5UCkh4lQeacvfCDeHkRadE',
 'EDU505':'1YRge_4xk21FkhDl5Kx5ujKv_jAeOUnYb',
 'EDU516':'1KbSYDNE8-JCeOKyZ86djS-06FisXFFEt',
 'EDU602':'17w9INbtiVUc7xJtaZMHsbJkxJT6rOMd9',
 'EDU705':'1G7CIiNrOn3sa-aBXTgKmwaNWU4O2QbbP',
 'ENG101':'11fmXrx3dmUGieY59YX00VuQiFO5jt213',
 'ENG201':'186bJaBjADMVCrQ6XhDTysIK7KRTou2uP',
 'ENG301':'1vY2-5nk38cna4HUS98pwPu_fevtSMfDY',
 'ENG501':'1IDgPO5AqcINTU8esF6TEJGBTQbe9rsMF',
 'ENG502':'134EqapccQpb1PldlACLvmY5yGkfk7Bf4',
 'ENG503':'1AoYfl7b-vl9sc15C_XH0_cJ1c6u7zJN9',
 'MGT101':'1GLORTzk4LqtkLg8tQR075OxkwT-9VhfY',
 'MGT111':'17LPQIxN6L5SGBsGDyRZW8l6L6-tcFRD7',
 'MGT211':'1i2_Fd4rpHHwcrRpwsMBnF8Vs76e5irwi',
 'MGT301':'1C0eAYz9wQhv7IN9xzxm4pm3qn3bGyEUC',
 'MGT401':'1JmFYsu7lSXIqta95twPXsDZM_sFtsAu_',
 'MGT411':'1o9-HTShekfsCEbTh3gbnOW15d7VPpZ6e',
 'MGT501':'1VU2glAH0vCSiYzJqwfUBzKmoZSdOZE0Z',
 'MGT502':'1mhU0awxnw5UydKDtl9hbqrfCYGNSe0Pv',
 'MGT503':'1U-TcEQouoWF_eWED_65O1ssIS8I2SLEL',
 'MGT602':'1JgI6n07Rjd-t0py8wO22Y56CynNMMLkg',
 'MGT603':'1NMjsuN1o-GCdeHKAY6szhBuHO1w57in4',
 'MGT610':'1aNqRCMqN8MAdRqd37UC3Jbx5NGP_tR6a',
 'MTH101':'1ZZeP0Apa9qkVX6vGaDJVkMe60sSCNCTj',
 'MTH202':'1Ru1mTMh3Oh3o9gGImhItfNqsqIHgStwO',
 'MTH301':'10zKaO2Vk6Bd-G_OKmwPJyQw2jMogJOOh',
 'MTH302':'1PmMwD0pztC-zy3P5bGvjSwLtXWceSNPi',
 'MTH401':'1hbqEIvkOV7V1LJXkZVvYL1Y279A7ABj5',
 'MTH501':'15s_nHvycmDStMKItbzbPfsxbRNUq6rRz',
 'MTH601':'1h6uLqJw-r8CR1O15hgOcrozbdlClfPJh',
 'MTH603':'1QNIsmTIB7Dmu_orS2GvCqRBua4CaS9h5',
 'MTH622':'1LZYSQwpe3gmc_mVgPyvAxQ0DRU4gDzqy',
 'MTH631':'19URFcylpDAP0_kxpXWECueKbjKa-3nQy',
 'MTH633':'13P1sICoGGXPgb5wCVorgr6KibZ8aObqF',
 'MTH647':'1YXtun1B0yo7kuJTBuYXDpwfk6fFmY-BU',
 'PAK301':'1VGK5cMn5bLbiWTHNF1zdMe60Cs6ICUfu',
 'PHY101':'1EvYwxX_Q4Mja0AgeOJTCWDpk-td91B7v',
 'PSY101':'1UHrkliQlueHGh64z4-09EnuAuVkL_YpP',
 'PSY403':'12fgSk3kgyZK-kTOC3Y7_hADUPcCZqjsm',
 'PSY404':'16JEbsq8Dy6JIYJDG3uZpC_f4NELuAPqa',
 'PSY405':'1m0q7DSg_PG-h39maDViJVUsFOfy4cFuF',
 'PSY406':'1s97U8eET95ipNmRe2CBjzVdJVRqM-rb2',
 'PSY407':'18uaIvvqrYfOpvKNA1BjlwQno7CKgoKhH',
 'PSY408':'1oK_YCHqREcP--k5BYk30qiaf-5uFMcC0',
 'PSY409':'1opFxRh-2KutONTENqX6cTUBRCj9Nlm38',
 'PSY502':'1YCq0glh397ypQFzjBSJbIfzG6PN0qDqC',
 'PSY504':'1rFzZ-9XqFIC2bGIL7jLZqHUvdVsMcPUt',
 'PSY511':'1Bz3dkHp3w0iOIMq2JeDq7iy-T_hqxAs6',
 'PSY512':'1qgDQZjyELkMyy68HkYZvxkdzPHFawEYU',
 'PSY514':'1A9MLWKZsw_fjGbNgPakzcI7rCa8oyBEW',
 'PSY610':'1lc7i19dsVG6Bv-U9KxL5PJwfr6w0Z8js',
 'PSY631':'1rpeHYilcbmM3wLTGYHTItJ3aSf7NoVXi',
 'PSY632':'1yoVOTeGNmpi7HZxRN0Zppig67LyQ9Va8',
 'SOC101':'1YwG39X5MOHaqB9fRLQTs7VewlXTYwbim',
 'SOC301':'1Hnz_WhEcy_X6F6_q90ibv2hnoyP4AmyE',
 'SOC401':'1rtKFYGYSwsiP-xMq-_Psjw4N7yWKzOjW',
 'STA301':'13n6b6DF2aqRcqr_K7ohc97hauup5YXFA',
 'STA630':'1qf8UIJtd96fEebKf8oQKwklx3JoIIjPd'
};
const driveDownload=id=>'https://drive.google.com/uc?export=download&id='+encodeURIComponent(id);

const DIRECT_SOLVED={
 'CS101':[
  ['Midterm Past Papers','Moaaz','Subjective','1MPLM8HJArr638db_cv3lYv9PA5mWPpZ8'],
  ['Midterm Past Papers','Waqar Siddhu','Subjective','1YRgfKoyVLnbSpEn1UUh0-ShjGSxizRC7'],
  ['Midterm Past Papers','Junaid','Subjective','1QryShf1tOJxvCEulaBAYmYvuLkVFA72j'],
  ['Finalterm Past Papers','Moaaz','Subjective','1FjccHUrSit1KH5Y6DA_qEw-zjiaIAcjj'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','1KJYM8FUqpPv3y4-i76YRRT97QOLUKi7E'],
  ['Finalterm Past Papers','Junaid','Subjective','1snz-GbMCYRYbIJkVwMSTgP11Hi6zPNXY']
 ],
 'CS201':[
  ['Midterm Past Papers','Moaaz','MCQs','11eWJesg--MYnKqMRxWJnkrZ3odzfy1rB'],
  ['Midterm Past Papers','Waqar Siddhu','MCQs','1WnxB6zldZgpcK519-UKRW8d9hTAWygwv'],
  ['Midterm Past Papers','Junaid','MCQs','1yaJM596lEnZqUQtNU9KfNPNDNQ8vGpvN'],
  ['Midterm Past Papers','Moaaz','Subjective','1Hwd2i3rr-EPi7v_M0UQ5j-gjIzLEDDPL'],
  ['Midterm Past Papers','Waqar Siddhu','Subjective','12HzaJ9BYq5pEj-mfhrWYgSt9dEu2W1en'],
  ['Finalterm Past Papers','Moaaz','MCQs','19yl27SJLi_eYYMDWRTNvmGeqYLI1lgXM'],
  ['Finalterm Past Papers','Waqar Siddhu','MCQs','1JIMLSFoevwVFCKhbVPShevCqQGR_38KB'],
  ['Finalterm Past Papers','Junaid','MCQs','1FPjqiznjqvJejNghgUrgVZBuwA1jjUDa'],
  ['Finalterm Past Papers','Moaaz','Subjective','1khuk-HUAWzh66tNvq_qpr4rjUZwlw5iP'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','1m_8ZFz_x7r3LU70yoYToPUlXrqSOtJDU'],
  ['Finalterm Past Papers','Junaid','Subjective','1NbJsEA2fa8W1ecsPrSvkchwJBQkHGajW']
 ],
 'ENG101':[
  ['Midterm Past Papers','Moaaz','MCQs','1hlV0dPpDCm7jyCKkkQhN3CwqSwHBHNSP'],
  ['Midterm Past Papers','Junaid','MCQs','1EG7jgTfUqODJK-4tcuXJYdU6VakcICUW'],
  ['Midterm Past Papers','Moaaz','Subjective','1u8mEDNXND3sfGhrCHBKVN3-a812jIFYT'],
  ['Finalterm Past Papers','Waqar Siddhu','MCQs','1mXvQLVknKZGiidiZO1Fp-3CS4fA1IAol'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','1CmV3SUBSrFbTj4QbyiumG5zC_nW_n7KG']
 ],
 'ENG201':[
  ['Midterm Past Papers','Moaaz','MCQs','13Vl1ts32bfFOlaqeGudqgMou3qqWEkcG'],
  ['Midterm Past Papers','Junaid','MCQs','1FP-sQoYw99UoPFRxfT7NR0KK5k4-utS-'],
  ['Midterm Past Papers','Moaaz','Subjective','1OiNuHQ0-WSPpRRxUffjxo5-WetQK3aG8'],
  ['Finalterm Past Papers','Moaaz','MCQs','1ERUHaGkwipVd3JxEzuXiXwnP9HB2f8sD'],
  ['Finalterm Past Papers','Moaaz','Subjective','158z1PwWZxH387rtMy5HKojkWvWHmomZW']
 ],
 'MTH202':[
  ['Midterm Past Papers','Moaaz','MCQs','1w1awsviuAsrMl7h0-cfudwB3CJ5jDVsD'],
  ['Midterm Past Papers','Waqar Siddhu','MCQs','1ybAdF2mkr_Hqttq_F5IHjH73x2LmKutD'],
  ['Midterm Past Papers','Junaid','MCQs','10L32LXWme2Eb-MBjaASP_SIU55HhWtTn'],
  ['Midterm Past Papers','Moaaz','Subjective','1vwMs5OQHQLnPUJ5hi5hWmsZaY4HkVqTe'],
  ['Midterm Past Papers','Waqar Siddhu','Subjective','156S8ggLVSPAcOSa5mH8tXfjWGxx9u3I7'],
  ['Finalterm Past Papers','Moaaz','MCQs','1VHvN4kKgKTGFOmvLfCeVCZEYZrTTOSep'],
  ['Finalterm Past Papers','Waqar Siddhu','MCQs','1tkGXQ8ezqY2YVKX6bwQ30JxJFuyW1sY-'],
  ['Finalterm Past Papers','Moaaz','Subjective','1C8ZK65GvIrjWxovQh8Ntz_2a9m179Kfg'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','13JWFn-wX9CERiw_YG1xPr8QztHZZijSn']
 ],
 'MTH301':[
  ['Midterm Past Papers','Waqar Siddhu','MCQs','1OejyEUSBDg_gDodKxjuHMvGgpH81zHoZ'],
  ['Midterm Past Papers','Junaid','MCQs','1Qd1HxKHKROl1So5OqxPTF3qmO2d5-NU7'],
  ['Midterm Past Papers','Waqar Siddhu','Subjective','1JS2RZNHOQG49L9vNLAGmCYsYzhnkcWzM'],
  ['Finalterm Past Papers','Waqar Siddhu','MCQs','19AlyZkN7EfmwMTWTvn-zA8qtgRs1-mWb'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','1koWUTGbcby9aMrK4Cg7j4xa1JrETbENu']
 ],
 'MTH501':[
  ['Midterm Past Papers','Waqar Siddhu','MCQs','1srvDVBwedgTzLte0pyj8g1MiPfCgjiaI'],
  ['Midterm Past Papers','Junaid','MCQs','17wJmLVFxVEmJ2EiRrMVVw4AwdhM5H-0l'],
  ['Midterm Past Papers','Waqar Siddhu','Subjective','1WO8b-N5Pl0WsuhXtBcK857R6YcqBddfM'],
  ['Finalterm Past Papers','Waqar Siddhu','MCQs','1ywzuPLriWFqI93SttxXEwr72pGxIAOGw'],
  ['Finalterm Past Papers','Junaid','MCQs','108K2upc5C6l_U04jbTiK4DnsluZz2c2e'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','1-3b8m23Mx53WQAnKGgSkL_O01MP57KDE']
 ],
 'STA301':[
  ['Midterm Past Papers','Moaaz','MCQs','1nXuqabsXWn6GcsNO4HpMXGFfng9oqnXa'],
  ['Midterm Past Papers','Waqar Siddhu','MCQs','1EgAxZT_Rq8lyOj6VQKAD0mV2qzHxhbLg'],
  ['Midterm Past Papers','Junaid','MCQs','1VjZN7L3Bc_lT19awGilOq7ejb-By3OSo'],
  ['Midterm Past Papers','Moaaz','Subjective','1exTN5Os8EbNXV8zNAhL3G5-BkrDUdVWT'],
  ['Midterm Past Papers','Waqar Siddhu','Subjective','1gJpWgHX75TRJxatjYMEda9gAF3rYw77B'],
  ['Finalterm Past Papers','Moaaz','MCQs','1nAMkxt2KzD49Iu6CmjImUmQ3i0NuszKS'],
  ['Finalterm Past Papers','Waqar Siddhu','MCQs','1oDqz0VvQDV-oqZkGhpvm1KE1oSCyTyJm'],
  ['Finalterm Past Papers','Junaid','MCQs','15ohs7RVhQOLv-KHrUODgnZCKcBwLpFl4'],
  ['Finalterm Past Papers','Moaaz','Subjective','1x5mtxQnCIAaWa4zlakh24nXski6e1RP7'],
  ['Finalterm Past Papers','Waqar Siddhu','Subjective','19rB319OGervkXH0NS_Y4JlDNEI8W8drk'],
  ['Finalterm Past Papers','Junaid','Subjective','124eAWnSNVdNw4w_Bc4mini3slBfj_4TF']
 ]
};
const directSolvedRows=code=>(DIRECT_SOLVED[code]||[]).map(([type,author,part,id],i)=>({
 id:'direct-solved-'+code+'-'+type.replace(/\W+/g,'-').toLowerCase()+'-'+author.replace(/\W+/g,'-').toLowerCase()+'-'+i,
 courseCode:code,type,title:code+' · '+type.replace(' Past Papers','')+' '+part+' · '+author,
 url:driveDownload(id),source:author,via:'VUAnswer',trust:'verified',access:'direct_download',
 note:'Direct solved-paper file indexed by VUAnswer under '+author+'. Community exam-preparation material; verify answers and syllabus against current official VU handouts.'
}));


const FINALTERM_DEPARTMENT_ROUTES={
 'CS':'https://vuanswer.pk/vu-all-cs-subjects-finalterm-past-papers/',
 'MTH':'https://vuanswer.pk/vu-mth-finalterm-past-papers/',
 'ENG':'https://vuanswer.pk/vu-eng-finalterm-past-papers/',
 'EDU':'https://vuanswer.pk/vu-edu-subjects-finalterm-past-papers/',
 'PSY':'https://vuanswer.pk/vu-psy-finalterm-past-papers/',
 'MGT':'https://vuanswer.pk/vu-mgt-finalterm-past-papers/'
};
const finaltermDepartmentUrl=code=>{
 const prefix=(String(code||'').toUpperCase().match(/^([A-Z]+)/)||[])[1]||'';
 return FINALTERM_DEPARTMENT_ROUTES[prefix]||'';
};



const actionLabel=x=>x.access==='direct_download'?'Download Now':x.access==='login_required'?'Login to Download':x.access==='download_index'?'Open Download Index':x.access==='official_open'?'Open Official Material':'Open Resource';
const accessLabel=x=>x.trust==='legacy'?(x.access==='download_index'?'Legacy Backup · Downloads':'Legacy Backup'):x.access==='direct_download'?'Verified Community · Direct Download':x.access==='login_required'?'Official · Login Required':x.access==='download_index'?'Verified Community · Downloads':x.access==='official_open'?'Official · Open':'Verified Community';

function officialFor(course){
 const p=window.EDUNIZAM_VU_PATHWAYS?.forCourse?.(course);
 if(!p)return[];
 const direct=!!p.direct;
 const official=(id,type,title,url,access,note)=>({id:'official-'+id,type,title,url,source:'Virtual University',trust:'official',access,note,courseCode:course.code});
 if(!direct){
  const rows=[
   official('details','Course Overview',course.code+' Official VU Course / Study Scheme',course.officialDetails||p.search,'official_open','Official VU study-scheme/program route for this course. An exact OCW material page is not claimed unless independently verified.'),
   official('vulms','GDB / Current Semester',course.code+' Current Semester in VULMS',p.vulms,'login_required','Current quizzes, assignments, GDBs, announcements and enrolled-course files are available in VULMS.')
  ];
  if(/P$/.test(course.code))rows.push(official('practical','Practicals / Lab Manuals',course.code+' Practical Course / Lab Study Scheme',course.officialDetails||p.search,'official_open','Official VU program/study-scheme route for this practical course. Use VULMS for the current lab instructions/files.'));
  const isProject=['CS519','CS619'].includes(course.code)||/\b(project|capstone)\b/i.test(String(course.title||''));
  const isInternship=/internship|field experience/i.test(String(course.title||''))||/I619$/i.test(course.code);
  if(isProject)rows.push(official('project','Final Project / Viva',course.code+' Official Project / Capstone Route',course.officialDetails||'https://www.vu.edu.pk/contact','official_open','Official VU program/study-scheme route for this project or capstone course. Current supervisor, deliverable and viva requirements should be confirmed through VULMS/official project channels.'));
  if(isInternship){
   rows.push(official('internship','Internship / Field Experience',course.code+' Official Internship / Field Experience Route',course.officialDetails||p.search,'official_open','Official VU study-scheme/program route for internship or field-experience requirements; current instructions should be checked in VULMS.'));
   rows.push(official('internship-guide','Syllabus / Study Guide',course.code+' Internship / Field Experience Study Scheme',course.officialDetails||p.search,'official_open','Official study-scheme context for this internship/field-experience course.'));
  }
  return rows;
 }
 return[
  official('notes','Course Notes / Handouts',course.code+' Course Notes / Handouts',p.notes,'login_required','Official OCW Notes page. Published files are visible publicly; VU may require login before the actual file download.'),
  official('videos','Lecture Videos',course.code+' Lecture Videos',p.videos,'login_required','Official VU lecture-video page. Video listings are public; download can require OCW login.'),
  official('assignments','Assignments',course.code+' Course Assignments',p.assignments,'login_required','Official OCW assignment archive where published. Current graded assignments should be checked in VULMS.'),
  official('references','Reference Books',course.code+' Reference Books',p.references,'official_open','Official OCW reference-book list and publisher/reference links where provided.'),
  official('grading','Grading Scheme',course.code+' Grading Scheme',p.grading,'official_open','Official OCW course grading-scheme page where published. Current semester rules should still be confirmed in VULMS.'),
  official('overview','Course Overview',course.code+' Course Overview',p.overview,'official_open','Official synopsis, learning outcomes and course calendar where published.'),
  official('links','Useful Links',course.code+' Related / Useful Links',p.links,'official_open','Official OCW related-links page for this course where published.'),
  official('bookshop','Books / References',course.code+' Official VU Bookshop / Printed Material','https://bookshop.vu.edu.pk/','official_open','VU states lecture handouts and course DVDs/material are available through its online bookshop, including for the public where available.'),
  official('vulms','GDB / Current Semester',course.code+' VULMS — Current Semester',p.vulms,'login_required','Official current-semester source for quizzes, assignments, GDBs, announcements and enrolled handouts.')
 ];
}

function communityFor(course){
 const code=String(course?.code||'').toUpperCase();
 const deptFinal=finaltermDepartmentUrl(code);
 const baseRows=[...directSolvedRows(code),...COMMUNITY.flatMap(x=>{
  const base={...x,id:x.id+'-'+code,courseCode:code,title:code+' · '+x.title};
  if(x.id==='vustudyhub-project'&&!['CS519','CS619'].includes(code))return [];
  if(x.id==='vustudyhub-internship'&&code!=='CSI619')return [];
  if(x.id==='vuctn-practicals'&&!(/P$/.test(code)||/practical|lab/i.test(String(course?.title||''))))return [];
  if(x.id==='virtualuniversitypk-handouts')base.url='https://virtualuniversitypk.com/?s='+encodeURIComponent(code);
  if(x.id==='nva-handouts')base.url='https://www.google.com/search?q='+encodeURIComponent('site:nvaeducation.com/books/vu/ '+code+' handouts');
  if(x.id==='vubookshoppk-handouts')base.url='https://vubookshoppk.com/vu-handouts-pdf/';
  if(x.id==='vuacademy-highlighted')base.url='https://vuacedmy.com/academic/handouts/highlighted-handouts.php';
  if(x.id==='vustudy-final'||x.id==='vustudy-current')base.url='https://vustudy.com/?s='+encodeURIComponent(code);
  if(x.id==='vumalik-past')base.url='https://vumalik.blogspot.com/search?q='+encodeURIComponent(code);
  if(x.id==='vuctn-past'||x.id==='vuctn-short'||x.id==='vuctn-ppt'||x.id==='vuctn-quiz'||x.id==='vuctn-books'||x.id==='vuctn-practicals')base.url='https://www.vuctn.com/search?q='+encodeURIComponent(code);
  if(x.id==='vustudyhub-materials'||x.id==='vustudyhub-assignments'||x.id==='vustudyhub-quizzes')base.url=x.url;
  const out=[];
  if(x.id==='vuanswer-handouts'&&DIRECT_HANDOUTS[code]){
   out.push({...base,id:'direct-handout-'+code,url:driveDownload(DIRECT_HANDOUTS[code]),access:'direct_download',title:code+' · Handouts — Direct PDF Download',note:'Verified community handout mirror on Google Drive. Use the official VU OCW/VULMS handout as the primary current-semester source.'});
   out.push({...base,id:'handout-index-'+code,title:code+' · Updated Handouts — Download Index'});
   return out;
  }
  if(x.id==='vuanswer-highlighted'&&DIRECT_HIGHLIGHTED[code]){
   out.push({...base,id:'direct-highlighted-'+code,url:driveDownload(DIRECT_HIGHLIGHTED[code]),access:'direct_download',title:code+' · Highlighted Handouts — Direct PDF Download',note:'Verified community highlighted-handout download mirrored on Google Drive. Supplementary revision material; confirm concepts against current official VU handouts.'});
   out.push({...base,id:'highlighted-index-'+code,title:code+' · Highlighted Handouts — Download Index'});
   return out;
  }
  return [base];
 })];
 if(deptFinal){
  baseRows.unshift({
   id:'vuanswer-dept-final-'+code,courseCode:code,type:'Finalterm Past Papers',
   title:code+' · Department Finalterm Past Papers',
   url:deptFinal,source:'VUAnswer',trust:'verified',access:'download_index',
   note:'Department-specific VUAnswer final-term index with course-wise solved MCQs, subjective papers, notes/current files where available.'
  });
 }
 return baseRows;
}

function forCourse(course,{type='',source='',provider='',access=''}={}){
 let rows=[...officialFor(course),...communityFor(course)];
 if(type)rows=rows.filter(x=>x.type===type);
 if(source==='official')rows=rows.filter(x=>x.trust==='official');
 if(source==='verified')rows=rows.filter(x=>x.trust==='verified');
 if(source==='legacy')rows=rows.filter(x=>x.trust==='legacy');
 if(provider)rows=rows.filter(x=>x.source===provider);
 if(access==='downloadable')rows=rows.filter(x=>['direct_download','download_index'].includes(x.access));
 else if(access)rows=rows.filter(x=>x.access===access);
 const rank={direct_download:0,download_index:1,official_open:2,login_required:3,open:4};
 rows.sort((a,b)=>(rank[a.access]??9)-(rank[b.access]??9)||String(a.source||'').localeCompare(String(b.source||'')));
 return rows.map(x=>({...x,verifiedAt:x.verifiedAt||'2026-10-01',actionLabel:actionLabel(x),accessLabel:accessLabel(x)}));
}

window.EDUNIZAM_VU_MATERIALS={
 updatedAt:'2026-10-01',
 verificationNote:'Source capabilities were rechecked on 2026-10-01. Community resources remain supplementary and can change independently of EduNizam.',
 types:TYPES,
 communitySources:COMMUNITY,
 providers:[...new Set(COMMUNITY.map(x=>x.source).concat(['Moaaz','Waqar Siddhu','Junaid']))].sort(),
 directHighlightedCourses:Object.keys(DIRECT_HIGHLIGHTED),
 directHandoutCourses:Object.keys(DIRECT_HANDOUTS),
 directSolvedCourses:Object.keys(DIRECT_SOLVED),
 forCourse,
 actionLabel,
 accessLabel
};
})();