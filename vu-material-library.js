(function(){
'use strict';

const TYPES=[
 'Course Notes / Handouts','Highlighted Handouts','Short Notes',
 'Lecture Videos','Reference Books','Assignments','GDB / Current Semester',
 'Quizzes / MCQs','Midterm Past Papers','Finalterm Past Papers',
 'Current Papers / Recalls','Solved Past Papers','Preparation Videos',
 'PPT Slides','Practicals / Lab Manuals','Books / References','Final Project / Viva',
 'Grading Scheme','Course Overview','Useful Links','Offline App Library'
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
  access:'download_index',note:'Current community library for handouts, assignments, quizzes, GDBs and past papers; includes course-specific resources and recent semester uploads.'
 },
 {
  id:'vustudyhub-assignments',type:'Assignments',title:'VU Study Hub Assignments',
  url:'https://vustudyhub.com/assignments.php',source:'VU Study Hub',trust:'verified',
  access:'download_index',note:'Course and semester-oriented assignment preparation/resources.'
 },
 {
  id:'vustudyhub-quizzes',type:'Quizzes / MCQs',title:'VU Study Hub Quizzes',
  url:'https://vustudyhub.com/quizzes.php',source:'VU Study Hub',trust:'verified',
  access:'download_index',note:'Course-wise quiz preparation resources where published.'
 },
 {
  id:'vustudyhub-project',type:'Final Project / Viva',title:'CS619 / CS519 Final Project Hub',
  url:'https://vustudyhub.com/projects.php',source:'VU Study Hub',trust:'verified',
  access:'download_index',note:'Project ideas, SRS, design documents, test cases, final report guidance, presentations, viva preparation, project guidelines and video tutorials for CS619/CS519.'
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
 }
];

const DIRECT_HANDOUTS={
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
 'EDU101':'1-_3upXbNZ4YEQSvWcaveiVwgRAcgcNoT',
 'ENG101':'1UiG73PCVq_h3XPMUEVPRmrpzA3K7kBzH',
 'ISL201':'14fOIM3vNwQSzw5OMVAeJpMRc6rWG6KyS',
 'IT430':'1yPSofZULLSYqMj7rGs0biQjjU58ri9-4',
 'MCM101':'1-FKqPp5lSz3jN4iv7AJ5JrxAXjZeLgBt',
 'MGT101':'1t3PP9ql8PpJf0fayLbP3MzCJke5JD5N6',
 'MGT501':'1cdt4HJg_P_FkRhowDFpJ8Fq8AS6LZbk_',
 'MGT502':'1GT-cre9XqgD40KQbhHOnODLLqMQiyKvA'
};

const DIRECT_HIGHLIGHTED={
 'CS101':'1N_9ZMxbyw5UsXZOOgzKW__6sRaqRglL0',
 'CS201':'1hs_Goz7E2tapouq90Fo8XE66Tv_pPp3H',
 'CS301':'1tY3Gq4f9P4wJiyCITaWWnQDInuTDdZrm',
 'CS302':'1zuZvboe5UpHmnWjKWBObgFRIHAIF45jq',
 'CS304':'1FhkuIRT5H58QiFJ9QeNSMudvrTudXGoo',
 'CS401':'1xftfPbOYL5NldayA5lojs3eTF-1W0QQe',
 'CS402':'1CS-EWwsGfTP_pXe7JKTKSI9pZfHU0ZZE',
 'CS403':'1L5zJqG_ey3wlic7kLaB997CuHX7c5Xgu',
 'CS408':'1IrZDUG99OTg4MEm2Y6bhElD6V2OZugoz',
 'CS501':'1VLkyZf---vMVyAPNVbd1zO1IHdGId_T1',
 'CS502':'1ESrXCQ27vJWQp4VT8CMsNDyLi5kZjxV1',
 'CS504':'1p7oBXBlD5kISU5D2PjTvFcxdZtQwVzrQ',
 'CS506':'1mJIiUqu4MRKJA2Yab9_b5BlpHVjzHTa9',
 'CS507':'1P7oVCQtrsjT4D4ekqGx_B-ub2N81PmVX',
 'CS601':'1YVPE80LkjAIa7pqEaYfToOuURQijVwmI',
 'CS604':'1sgBZYGPYD2orODOfCnIoJ6p2XCRGdms1',
 'CS606':'1t-dnOylAvtZZ5Py_IokJKQNX_AUhuK8I',
 'CS610':'1knUa58NawAluTiDSUmx-j_DW3zsP0-1D',
 'CS614':'1sUpvj5OrU2C43-BxMnUWcY-9HqBrb57o',
 'CS615':'1Df9SwH9GgQzPbFxhAwNBll_1U5EaiWmu',
 'ECO401':'1vyMcLiE-qn76AX1yvPPiENXgOo4hC-Un',
 'EDU101':'157pyaEed9jUr3wpKSqds_pUkW9AWtB_M',
 'ENG101':'11fmXrx3dmUGieY59YX00VuQiFO5jt213',
 'MGT101':'1GLORTzk4LqtkLg8tQR075OxkwT-9VhfY',
 'MGT501':'1VU2glAH0vCSiYzJqwfUBzKmoZSdOZE0Z',
 'MGT502':'1mhU0awxnw5UydKDtl9hbqrfCYGNSe0Pv',
 'MTH101':'1ZZeP0Apa9qkVX6vGaDJVkMe60sSCNCTj',
 'MTH301':'10zKaO2Vk6Bd-G_OKmwPJyQw2jMogJOOh',
 'MTH501':'15s_nHvycmDStMKItbzbPfsxbRNUq6rRz',
 'MTH603':'1QNIsmTIB7Dmu_orS2GvCqRBua4CaS9h5',
 'PAK301':'1VGK5cMn5bLbiWTHNF1zdMe60Cs6ICUfu',
 'PHY101':'1EvYwxX_Q4Mja0AgeOJTCWDpk-td91B7v',
 'PSY101':'1UHrkliQlueHGh64z4-09EnuAuVkL_YpP',
 'SOC101':'1YwG39X5MOHaqB9fRLQTs7VewlXTYwbim',
 'STA301':'13n6b6DF2aqRcqr_K7ohc97hauup5YXFA'
};
const driveDownload=id=>'https://drive.google.com/uc?export=download&id='+encodeURIComponent(id);

const actionLabel=x=>x.access==='direct_download'?'Download Now':x.access==='login_required'?'Login to Download':x.access==='download_index'?'Open Download Index':x.access==='official_open'?'Open Official Material':'Open Resource';
const accessLabel=x=>x.access==='direct_download'?'Verified Community · Direct Download':x.access==='login_required'?'Official · Login Required':x.access==='download_index'?'Verified Community · Downloads':x.access==='official_open'?'Official · Open':'Verified Community';

function officialFor(course){
 const p=window.EDUNIZAM_VU_PATHWAYS?.forCourse?.(course);
 if(!p)return[];
 const direct=!!p.direct;
 const official=(id,type,title,url,access,note)=>({id:'official-'+id,type,title,url,source:'Virtual University',trust:'official',access,note,courseCode:course.code});
 if(!direct)return[
  official('lookup','Course Overview',course.code+' Official OCW Lookup',p.search,'official_open','Open the official VU course search for this code. Exact material pages are not generated until the OCW category is known.'),
  official('vulms','GDB / Current Semester',course.code+' Current Semester in VULMS',p.vulms,'login_required','Current quizzes, assignments, GDBs, announcements and enrolled-course files are available in VULMS.')
 ];
 return[
  official('notes','Course Notes / Handouts',course.code+' Course Notes / Handouts',p.notes,'login_required','Official OCW Notes page. Published files are visible publicly; VU may require login before the actual file download.'),
  official('videos','Lecture Videos',course.code+' Lecture Videos',p.videos,'login_required','Official VU lecture-video page. Video listings are public; download can require OCW login.'),
  official('assignments','Assignments',course.code+' Course Assignments',p.assignments,'login_required','Official OCW assignment archive where published. Current graded assignments should be checked in VULMS.'),
  official('references','Reference Books',course.code+' Reference Books',p.references,'official_open','Official OCW reference-book list and publisher/reference links where provided.'),
  official('grading','Grading Scheme',course.code+' Grading Scheme',p.grading,'official_open','Official OCW course grading-scheme page where published. Current semester rules should still be confirmed in VULMS.'),
  official('overview','Course Overview',course.code+' Course Overview',p.overview,'official_open','Official synopsis, learning outcomes and course calendar where published.'),
  official('links','Useful Links',course.code+' Related / Useful Links',p.links,'official_open','Official OCW related-links page for this course where published.'),
  official('vulms','GDB / Current Semester',course.code+' VULMS — Current Semester',p.vulms,'login_required','Official current-semester source for quizzes, assignments, GDBs, announcements and enrolled handouts.')
 ];
}

function communityFor(course){
 const code=String(course?.code||'').toUpperCase();
 return COMMUNITY.flatMap(x=>{
  const base={...x,id:x.id+'-'+code,courseCode:code,title:code+' · '+x.title};
  if(x.id==='virtualuniversitypk-handouts')base.url='https://virtualuniversitypk.com/?s='+encodeURIComponent(code);
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
 });
}

function forCourse(course,{type='',source='',provider=''}={}){
 let rows=[...officialFor(course),...communityFor(course)];
 if(type)rows=rows.filter(x=>x.type===type);
 if(source==='official')rows=rows.filter(x=>x.trust==='official');
 if(source==='verified')rows=rows.filter(x=>x.trust==='verified');
 if(provider)rows=rows.filter(x=>x.source===provider);
 return rows.map(x=>({...x,actionLabel:actionLabel(x),accessLabel:accessLabel(x)}));
}

window.EDUNIZAM_VU_MATERIALS={
 updatedAt:'2026-10-01',
 types:TYPES,
 communitySources:COMMUNITY,
 providers:[...new Set(COMMUNITY.map(x=>x.source))].sort(),
 directHighlightedCourses:Object.keys(DIRECT_HIGHLIGHTED),
 directHandoutCourses:Object.keys(DIRECT_HANDOUTS),
 forCourse,
 actionLabel,
 accessLabel
};
})();