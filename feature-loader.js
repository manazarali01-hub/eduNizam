(function(){
  const VERSION='20260921-brand67';
  const featureScripts={
    attendanceanalytics:['attendance-analytics.js'],
    pastpapers:['past-papers-premium.js'],
    practice:['practice-center.js'],
    study:['study-library.js'],
    universities:['education-hubs.js'],
    vu:['education-hubs.js','vu-workspace.js'],
    admissions:['admissions-portal.js','admissions-selection.js'],
    studentprofile:['student-performance.js'],
    behaviorcenter:['student-behavior.js'],
    parentcomplaints:['parent-complaint-center.js'],
    gatecenter:['gate-pass-center.js'],
    schoolwork:['school-work.js'],
    noticeboard:['notice-board-center.js'],
    lessoncenter:['lesson-plan-center.js'],
    calendarcenter:['calendar-center.js'],
    schedulecenter:['timetable-date-sheet.js'],
    functionscenter:['school-community.js'],
    ourstudents:['school-community.js'],
    inboxcenter:['messaging-center.js'],
    helpdeskcenter:['helpdesk-center.js'],
    leavecenter:['leave-center.js'],
    examcenter:['exam-center.js'],
    staffcenter:['staff-center.js'],
    stafftime:['staff-time-attendance.js'],
    staffpayroll:['staff-payroll.js'],
    training:['teacher-training-center.js'],
    bulkimport:['bulk-import-center.js'],
    studentdocs:['student-documents.js'],
    financecenter:['finance-center.js'],
    inventorycenter:['inventory-center.js'],
    librarycenter:['library-center.js'],
    transportcenter:['transport-center.js'],
    classcenter:['class-section-center.js'],
    fees:['fee-center.js'],
    communication:['communication-center.js'],
    assistant:['https://cdn.jsdelivr.net/npm/mathjax@4/tex-svg.js','math-editor.js']
  };
  const loaded=new Set();
  const inflight=new Map();
  const scriptsFor=view=>featureScripts[view]||[];
  function loadScript(src){
    if(loaded.has(src))return Promise.resolve();
    if(inflight.has(src))return inflight.get(src);
    const task=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.async=false;
      script.src=src+(src.includes('?')?'&':'?')+'v='+VERSION;
      script.onload=()=>{loaded.add(src);inflight.delete(src);resolve()};
      script.onerror=()=>{inflight.delete(src);reject(new Error('Could not load '+src))};
      document.head.appendChild(script);
    });
    inflight.set(src,task);return task;
  }
  function isReady(view){return scriptsFor(view).every(src=>loaded.has(src))}
  async function ensure(view){
    const list=scriptsFor(view);if(!list.length)return;
    document.documentElement.classList.add('edu-feature-loading');
    try{for(const src of list)await loadScript(src)}
    finally{document.documentElement.classList.remove('edu-feature-loading')}
  }
  window.EDUNIZAM_FEATURE_LOADER={ensure,isReady,scriptsFor};
})();
