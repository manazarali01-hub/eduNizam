(function(){
  const KEY='edunizam_role_scope';
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const currentUser=()=>cloud()?.state?.user?.id||localStorage.getItem('edunizam_cloud_user_id')||'';
  const scopeKey=()=>[role(),String(cloud()?.state?.user?.id||localStorage.getItem('edunizam_cloud_user_id')||''),String(cfg().institutionId||session()?.institutionId||'')].join('|');
  // Cached parent/teacher links are only valid for this exact role, cloud user and institute.
  // Legacy unscoped caches must never grant student visibility after an account switch.
  const readCache=()=>{try{
    const data=JSON.parse(localStorage.getItem(KEY)||'{}');
    return data?.__scope===scopeKey()?data:{};
  }catch{return{}}};
  const writeCache=v=>localStorage.setItem(KEY,JSON.stringify({...v,__scope:scopeKey()}));
  const norm=v=>String(v??'').trim().toLowerCase();
  const classKey=(c,s)=>norm(c)+'|'+norm(s);
  function readRows(key,fallback='[]'){try{const v=JSON.parse(localStorage.getItem(key)||fallback);return Array.isArray(v)?v:[]}catch{return[]}}
  function classSections(){return readRows('edunizam_class_sections_v1')}
  function staffProfiles(){
    const v2=readRows('edunizam_staff_profiles_v2');
    return v2.length?v2:readRows('edunizam_staff_profiles_v1');
  }
  function cloudReady(){return !!(cloud()?.state?.client&&currentUser())}
  function myTeacherStaffIds(){
    if(role()!=='teacher')return new Set();
    const uid=currentUser(),identity=norm(session()?.identity);
    return new Set(staffProfiles().filter(x=>
      (uid&&String(x.userId||'')===String(uid))||
      (identity&&[x.email,x.staffCode,x.phone,x.fullName].some(v=>norm(v)===identity))
    ).map(x=>String(x.id)));
  }
  function teacherClassKeys(cache=readCache()){
    const keys=new Set((cache.teacherClassSections||[]).map(x=>String(x)));
    if(role()!=='teacher')return keys;
    const uid=String(currentUser()||''),staffIds=myTeacherStaffIds();
    // In authenticated cloud mode do not re-authorize a teacher through unscoped
    // legacy local class-section data; verified cloud class assignments are authoritative.
    if(!cloudReady())classSections().forEach(row=>{
      const direct=uid&&String(row.classTeacherUserId||'')===uid;
      const local=staffIds.size&&staffIds.has(String(row.classTeacherStaffId||''));
      if(direct||local)keys.add(classKey(row.className,row.sectionName));
    });
    return keys;
  }
  function localVisibleStudents(list){
    const r=role(),all=list||[],identity=norm(session()?.identity),cache=readCache();
    if(r==='head')return all;
    if(r==='teacher'){
      const ids=new Set((cache.teacherStudentUserIds||[]).map(String));
      const classKeys=teacherClassKeys(cache);
      return all.filter(s=>{
        if(s.authUserId&&ids.has(String(s.authUserId)))return true;
        const exact=classKey(s.className,s.sectionName),wholeClass=classKey(s.className,'');
        return classKeys.has(exact)||classKeys.has(wholeClass);
      });
    }
    if(r==='parent'){
      const ids=new Set((cache.parentStudentUserIds||[]).map(String));
      return all.filter(s=>s.authUserId&&ids.has(String(s.authUserId)));
    }
    if(r==='student'){
      const uid=currentUser();
      if(uid)return all.filter(s=>String(s.authUserId||'')===String(uid));
      if(!identity)return[];
      return all.filter(s=>[s.id,s.studentId,s.rollNo,s.phone].some(v=>norm(v)===identity));
    }
    return [];
  }
  function getVisibleStudents(list){
    // Cloud RLS remains the security boundary. This client scope narrows the already
    // accessible school data to the current role and, for Teachers, to assigned
    // students plus class-teacher sections (including students without login accounts).
    return localVisibleStudents(list||[]);
  }
  let refreshInFlight=null,lastRefreshAt=0,lastRefreshKey='';
  async function refresh(force=false){
    const c=cloud();
    if(!c?.state?.client||!c?.state?.user){
      window.renderAll?.();window.EDUNIZAM_PARENT_DASHBOARD?.render?.();return readCache();
    }
    const refreshKey=[role(),String(c.state.user.id||''),String(cfg().institutionId||session()?.institutionId||'')].join('|');
    if(!force&&refreshInFlight)return refreshInFlight;
    if(!force&&refreshKey===lastRefreshKey&&lastRefreshAt&&Date.now()-lastRefreshAt<10000)return readCache();
    refreshInFlight=(async()=>{
    const r=role(),next=readCache();
    if(r==='teacher'){
      if(c.listMyTeacherAssignments){
        try{next.teacherStudentUserIds=(await c.listMyTeacherAssignments()||[]).map(String)}
        catch(e){console.warn('Teacher student scope:',e.message||e)}
      }
      const institutionId=String(cfg().institutionId||session()?.institutionId||'').trim();
      if(institutionId){
        try{
          const execute=async({signal}={})=>{
            let q=c.state.client.from('class_sections')
              .select('class_name,section_name,class_teacher_user_id,active')
              .eq('institution_id',institutionId)
              .eq('class_teacher_user_id',c.state.user.id)
              .eq('active',true);
            if(signal&&typeof q?.abortSignal==='function')q=q.abortSignal(signal);
            const result=await q;
            if(result?.error)throw result.error;
            return result;
          };
          const runtime=window.EDUNIZAM_DATA_RUNTIME;
          const {data}=runtime
            ?await runtime.run('role-scope:teacher-sections:'+institutionId+':'+c.state.user.id,execute,{timeout:6500,retries:1,cacheMs:15000,label:'Teacher class scope'})
            :await execute({});
          next.teacherClassSections=(data||[]).map(x=>classKey(x.class_name,x.section_name));
        }catch(e){console.warn('Teacher class scope:',e.message||e)}
      }
    }
    if(r==='parent'&&c.getLinkedStudents){
      try{
        const links=await c.getLinkedStudents();
        next.parentStudentUserIds=(links||[]).map(x=>String(x.student_user_id));
      }catch(e){console.warn('Parent student scope:',e.message||e)}
    }
    next.updatedAt=Date.now();writeCache(next);
    lastRefreshAt=Date.now();lastRefreshKey=refreshKey;
    window.renderAll?.();
    window.EDUNIZAM_PARENT_DASHBOARD?.render?.();
    return next;
    })();
    try{return await refreshInFlight}
    finally{refreshInFlight=null}
  }
  const roleViews={
    student:new Set(['dashboard','studentprofile','ourstudents','functionscenter','behaviorcenter','gatecenter','attendanceanalytics','studentdocs','fees','librarycenter','transportcenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','communication','access','notifications','assistant','troubleshoot','help']),
    parent:new Set(['dashboard','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','gatecenter','studentdocs','fees','librarycenter','transportcenter','results','attendance','attendanceanalytics','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','communication','access','notifications','assistant','troubleshoot','help']),
    teacher:new Set(['dashboard','students','classcenter','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','attendance','attendanceanalytics','inventorycenter','librarycenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','paperbuilder','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','communication','access','notifications','assistant','troubleshoot','help']),
    head:new Set(['dashboard','students','classcenter','bulkimport','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','gatecenter','studentdocs','attendance','attendanceanalytics','fees','financecenter','inventorycenter','librarycenter','transportcenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','paperbuilder','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','admissions','communication','access','notifications','assistant','auditcenter','datareadiness','settings','troubleshoot','help'])
  };
  function canView(view){return !!roleViews[role()]?.has(String(view||''))}
  let workspaceRefreshTimer=0;
  const scheduleRefresh=event=>{
    clearTimeout(workspaceRefreshTimer);
    const delay=event?.type==='edunizam:workspace-ready'?2500:250;
    workspaceRefreshTimer=setTimeout(()=>refresh().catch(e=>console.warn('Role scope:',e.message||e)),delay);
  };
  window.EDUNIZAM_ROLE_SCOPE={role,currentUser,getVisibleStudents,refresh,canView,teacherClassKeys};
  window.addEventListener('edunizam:role-cache-refreshed',scheduleRefresh);
  window.addEventListener('edunizam:workspace-ready',scheduleRefresh);
})();