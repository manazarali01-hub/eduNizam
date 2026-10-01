(function(){
'use strict';

const TYPES=[
 'Course Notes / Handouts','Highlighted Handouts','Short Notes',
 'Lecture Videos','Reference Books','Assignments','GDB / Current Semester',
 'Quizzes / MCQs','Midterm Past Papers','Finalterm Past Papers',
 'Current Papers / Recalls','Solved Past Papers','Preparation Videos',
 'Grading Scheme','Course Overview','Useful Links'
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
 }
];

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
 return COMMUNITY.map(x=>{
  const row={...x,id:x.id+'-'+code,courseCode:code,title:code+' · '+x.title};
  if(x.id==='vuanswer-highlighted'&&DIRECT_HIGHLIGHTED[code]){
   row.url=driveDownload(DIRECT_HIGHLIGHTED[code]);
   row.access='direct_download';
   row.title=code+' · Highlighted Handouts — Direct PDF Download';
   row.note='Verified community highlighted-handout download mirrored on Google Drive. Supplementary revision material; confirm concepts against current official VU handouts.';
  }
  return row;
 });
}

function forCourse(course,{type='',source=''}={}){
 let rows=[...officialFor(course),...communityFor(course)];
 if(type)rows=rows.filter(x=>x.type===type);
 if(source==='official')rows=rows.filter(x=>x.trust==='official');
 if(source==='verified')rows=rows.filter(x=>x.trust==='verified');
 return rows.map(x=>({...x,actionLabel:actionLabel(x),accessLabel:accessLabel(x)}));
}

window.EDUNIZAM_VU_MATERIALS={
 updatedAt:'2026-10-01',
 types:TYPES,
 communitySources:COMMUNITY,
 directHighlightedCourses:Object.keys(DIRECT_HIGHLIGHTED),
 forCourse,
 actionLabel,
 accessLabel
};
})();