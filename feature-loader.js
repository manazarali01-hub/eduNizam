(function(){
  const VERSION='20260926-leave123';
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
  const reliability=()=>window.EDUNIZAM_RELIABILITY;

  function loadAttempt(src,attempt){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      let settled=false;
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        script.remove();
        reject(new Error('Feature script timed out: '+src));
      },12000);
      const finish=(ok,error)=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        if(ok)resolve();else{script.remove();reject(error)}
      };
      script.async=false;
      const sep=src.includes('?')?'&':'?';
      script.src=src+sep+'v='+VERSION+'&attempt='+attempt;
      script.onload=()=>finish(true);
      script.onerror=()=>finish(false,new Error('Could not load '+src));
      document.head.appendChild(script);
    });
  }

  function loadScript(src){
    if(loaded.has(src))return Promise.resolve();
    if(inflight.has(src))return inflight.get(src);
    const run=async()=>{
      const rel=reliability();
      const runner=rel?.withRetry
        ?()=>rel.withRetry(()=>loadAttempt(src,Date.now()),{retries:2,delay:550,timeout:13000,label:'Feature '+src})
        :async()=>{
            let last;
            for(let attempt=0;attempt<3;attempt++){
              try{return await loadAttempt(src,attempt+1)}
              catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,550*(attempt+1)))}
            }
            throw last;
          };
      await runner();
      loaded.add(src);
    };
    const task=run()
      .catch(error=>{
        reliability()?.report?.('Feature Load Failed',error.message||error,src,'error');
        throw error;
      })
      .finally(()=>inflight.delete(src));
    inflight.set(src,task);
    return task;
  }
  function isReady(view){return scriptsFor(view).every(src=>loaded.has(src))}
  async function ensure(view){
    const list=scriptsFor(view);if(!list.length)return;
    const rel=reliability();
    rel?.beginFeature?.(view);
    document.documentElement.classList.add('edu-feature-loading');
    try{
      for(const src of list)await loadScript(src);
    }catch(e){
      rel?.repairUI?.('Feature recovery: '+view);
      throw e;
    }finally{
      document.documentElement.classList.remove('edu-feature-loading');
      rel?.endFeature?.(view);
    }
  }
  window.EDUNIZAM_FEATURE_LOADER={ensure,isReady,scriptsFor};
})();
