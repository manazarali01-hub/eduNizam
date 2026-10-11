(function(){
  const VERSION='20261011-paper-write-proof-v48';
  const sharedBundles={
    // Small shared bases first. The cross-section enrichment files execute once
    // only after every dataset they can enhance already exists.
    learningCore:[
      'past-papers-data.js',
      'practice-data.js',
      'school-assessment-data.js',
      'university-data.js',
      'vu-course-catalog.js',
      'study-data.js',
      'pectaa-core-textbooks.js',
      'pectaa-secondary-textbooks.js',
      'senior-curriculum-2026.js',
      'learning-premium-data.js',
      'learning-complete-data.js',
      'learning-required-data.js'
    ],
    pastpapersDeep:[
      'past-papers-inventory.js',
      'board-paper-deep-data.js',
      'board-paper-regional-deep-data.js'
    ],
    practiceDeep:[
      'practice-foundation-data.js',
      'practice-curriculum-expansion.js',
      'practice-depth-data.js',
      'punjab-quran-subjects-pack.js',
      'practice-complete-data.js',
      'practice-session-core.js'
    ],
    lessonCatalog:['punjab-quran-subjects-pack.js','academic-option-catalog.js'],
    studyDeep:[
      'curriculum-registry.js',
      'study-inventory.js'
    ],
    universityDeep:[
      'education-directory-expansion.js',
      'university-directory-normalizer.js'
    ],
    competitiveDeep:['competitive-exams-data.js'],
    ecosystemDeep:['education-ecosystem-data.js'],
    pathwayDeep:[
      'exam-pathways-data.js',
      'exam-topic-practice-data.js',
      'exam-topic-checkpoints.js',
      'exam-topic-blueprints-data.js'
    ],
    vuDeep:[
      'vu-catalog-expansion.js',
      'vu-project-courses-deep.js',
      'vu-course-pathways.js',
      'vu-material-library.js'
    ]
  };
  const featureBundles={
    pastpapers:['learningCore','pastpapersDeep'],
    practice:['learningCore','practiceDeep'],
    paperbuilder:['learningCore','practiceDeep','studyDeep'],
    study:['learningCore','studyDeep'],
    lessoncenter:['lessonCatalog'],
    datareadiness:['lessonCatalog'],
    staffcenter:['lessonCatalog'],
    schedulecenter:['lessonCatalog'],
    examcenter:['lessonCatalog'],
    dailydiary:['lessonCatalog'],
    schoolassessments:['learningCore'],
    universities:['learningCore','universityDeep'],
    competitive:['competitiveDeep'],
    ecosystem:['ecosystemDeep'],
    pathways:['pathwayDeep'],
    vu:['learningCore','vuDeep']
  };
  const featureScripts={
    attendanceanalytics:['attendance-analytics.js','academic-operations-deep.js'],
    pastpapers:['past-papers-premium.js'],
    practice:['teacher-question-import.js','paper-source-import.js','practice-source-import.js','practice-center.js'],
    study:['study-library.js'],
    schoolassessments:['education-hubs.js'],
    universities:['education-hubs.js'],
    competitive:['competitive-exams.js'],
    ecosystem:['education-ecosystem.js'],
    pathways:['exam-pathways.js','exam-topic-practice.js','exam-topic-planner.js'],
    vu:['education-hubs.js','vu-workspace.js'],
    admissions:['admissions-data.js','admissions-selection.js','admissions-portal.js'],
    studentprofile:['student-performance.js','academic-operations-deep.js'],
    behaviorcenter:['school-student-picker.js','student-behavior.js'],
    parentcomplaints:['school-student-picker.js','parent-complaint-center.js'],
    gatecenter:['gate-pass-center.js'],
    schoolwork:['academic-form-options.js','school-work.js','academic-workflow-deep.js'],
    noticeboard:['notice-board-center.js'],
    lessoncenter:['academic-form-options.js','lesson-plan-center.js','school-syllabus-csv.js'],
    datareadiness:['school-data-readiness.js'],
    calendarcenter:['calendar-center.js'],
    schedulecenter:['academic-form-options.js','timetable-date-sheet.js'],
    functionscenter:['school-community.js'],
    ourstudents:['school-community.js'],
    inboxcenter:['messaging-center.js','academic-workflow-deep.js'],
    helpdeskcenter:['helpdesk-center.js'],
    help:['help-knowledge-center.js'],
    leavecenter:['school-student-picker.js','leave-center.js'],
    examcenter:['exam-center.js','academic-operations-deep.js'],
    paperbuilder:['paper-syllabus-audit.js','teacher-question-import.js','paper-source-import.js','teacher-paper-builder.js','academic-workflow-deep.js'],
    dailydiary:['academic-form-options.js','daily-class-diary.js','academic-workflow-deep.js'],
    staffcenter:['school-form-options.js','staff-center.js'],
    stafftime:['staff-time-attendance.js'],
    staffpayroll:['staff-payroll.js'],
    training:['teacher-training-center.js'],
    bulkimport:['bulk-import-center.js'],
    studentdocs:['school-student-picker.js','student-documents.js'],
    financecenter:['finance-center.js'],
    inventorycenter:['inventory-center.js'],
    librarycenter:['library-center.js'],
    transportcenter:['transport-center.js'],
    classcenter:['school-student-picker.js','class-section-center.js','academic-groups-csv.js'],
    fees:['fee-center.js','academic-operations-deep.js'],
    results:['result-center-deep.js','promotion-center.js'],
    communication:['communication-center.js'],
    assistant:['https://cdn.jsdelivr.net/npm/mathjax@4/tex-svg.js','math-editor.js']
  };
  const loaded=new Set();
  const inflight=new Map();
  const prefetched=new Set();
  const prefetching=new Map();
  const bundleScriptsFor=view=>(featureBundles[view]||[]).flatMap(name=>sharedBundles[name]||[]);
  const scriptsFor=view=>[...bundleScriptsFor(view),...(featureScripts[view]||[])];
  const reliability=()=>window.EDUNIZAM_RELIABILITY;
  const versionedUrl=src=>{
    const url=new URL(src,location.href);
    if(url.origin!==location.origin)return src;
    url.searchParams.set('v',VERSION);
    return url.pathname+url.search+url.hash;
  };

  function loadAttempt(src,attempt){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      let settled=false;
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        script.remove();
        reject(new Error('Feature script timed out: '+src));
      },6500);
      const finish=(ok,error)=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        if(ok)resolve();else{script.remove();reject(error)}
      };
      script.async=false;
      const base=versionedUrl(src);
      script.src=attempt>1&&new URL(src,location.href).origin===location.origin
        ?base+(base.includes('?')?'&':'?')+'retry='+attempt
        :base;
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
      let attempt=0;
      const runner=rel?.withRetry
        ?()=>rel.withRetry(()=>loadAttempt(src,++attempt),{retries:1,delay:450,timeout:7000,label:'Feature '+src})
        :async()=>{
            let last;
            for(let attempt=0;attempt<2;attempt++){
              try{return await loadAttempt(src,attempt+1)}
              catch(e){last=e;if(attempt<1)await new Promise(r=>setTimeout(r,450))}
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
  function prefetchScript(src){
    if(loaded.has(src)||prefetched.has(src))return Promise.resolve(true);
    if(prefetching.has(src))return prefetching.get(src);
    const url=new URL(src,location.href);
    if(url.origin!==location.origin)return Promise.resolve(false);
    const task=fetch(versionedUrl(src),{
      method:'GET',
      credentials:'same-origin',
      cache:'force-cache'
    }).then(response=>{
      if(!response.ok)throw new Error('Could not prefetch '+src);
      prefetched.add(src);
      return true;
    }).catch(()=>false).finally(()=>prefetching.delete(src));
    prefetching.set(src,task);
    return task;
  }
  async function prefetch(view){
    const list=scriptsFor(view);
    if(!list.length)return [];
    return Promise.all(list.map(prefetchScript));
  }
  async function ensure(view){
    const list=scriptsFor(view);if(!list.length)return;
    const rel=reliability();
    rel?.beginFeature?.(view);
    document.documentElement.classList.add('edu-feature-loading');
    try{
      // Legacy data expansion files have ordered side effects; load deterministically.
      for(const src of list)await loadScript(src);
    }catch(e){
      rel?.repairUI?.('Feature recovery: '+view);
      throw e;
    }finally{
      document.documentElement.classList.remove('edu-feature-loading');
      rel?.endFeature?.(view);
    }
  }
  window.EDUNIZAM_FEATURE_LOADER={ensure,isReady,scriptsFor,prefetch,versionedUrl};
})();
