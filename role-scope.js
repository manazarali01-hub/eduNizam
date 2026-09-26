(function(){
  const KEY='edunizam_role_scope';
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const currentUser=()=>cloud()?.state?.user?.id||localStorage.getItem('edunizam_cloud_user_id')||'';
  const readCache=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const writeCache=v=>localStorage.setItem(KEY,JSON.stringify(v));
  function cloudReady(){return !!(cloud()?.state?.client&&currentUser())}
  function localVisibleStudents(list){
    const r=role(),all=list||[],identity=String(session()?.identity||'').trim().toLowerCase(),cache=readCache();
    if(r==='head')return all;
    if(r==='teacher'){
      const ids=new Set(cache.teacherStudentUserIds||[]);
      return all.filter(s=>s.authUserId&&ids.has(s.authUserId));
    }
    if(r==='parent'){
      const ids=new Set(cache.parentStudentUserIds||[]);
      return all.filter(s=>s.authUserId&&ids.has(s.authUserId));
    }
    if(r==='student'){
      const uid=currentUser();
      if(uid)return all.filter(s=>s.authUserId===uid);
      if(!identity)return[];
      return all.filter(s=>[s.id,s.studentId,s.rollNo,s.phone].some(v=>String(v??'').trim().toLowerCase()===identity));
    }
    return [];
  }
  function allowedAuthIds(){
    const r=role(),u=currentUser(),c=readCache();
    if(r==='head')return null;
    if(r==='student')return new Set(u?[u]:[]);
    if(r==='parent')return new Set(c.parentStudentUserIds||[]);
    if(r==='teacher')return new Set(c.teacherStudentUserIds||[]);
    return new Set();
  }
  function getVisibleStudents(list){
    if(!cloudReady())return localVisibleStudents(list);
    const ids=allowedAuthIds();
    if(ids===null)return list||[];
    return (list||[]).filter(s=>s.authUserId&&ids.has(s.authUserId));
  }
  async function refresh(){
    const c=cloud();if(!c?.state?.client||!c?.state?.user){window.renderAll?.();window.EDUNIZAM_PARENT_DASHBOARD?.render?.();return readCache();}
    const r=role(),next=readCache();
    if(r==='teacher'&&c.listMyTeacherAssignments){
      next.teacherStudentUserIds=await c.listMyTeacherAssignments();
    }
    if(r==='parent'&&c.getLinkedStudents){
      const links=await c.getLinkedStudents();
      next.parentStudentUserIds=(links||[]).map(x=>x.student_user_id);
    }
    next.updatedAt=Date.now();writeCache(next);
    if(window.renderAll)window.renderAll();
    if(window.EDUNIZAM_PARENT_DASHBOARD?.render)window.EDUNIZAM_PARENT_DASHBOARD.render();
    return next;
  }
  const roleViews={
    student:new Set(['dashboard','studentprofile','ourstudents','functionscenter','behaviorcenter','gatecenter','attendanceanalytics','studentdocs','fees','librarycenter','transportcenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','pastpapers','practice','study','schoolassessments','communication','access','notifications','assistant','troubleshoot','help']),
    parent:new Set(['dashboard','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','gatecenter','studentdocs','fees','librarycenter','transportcenter','results','attendance','attendanceanalytics','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','communication','access','notifications','assistant','troubleshoot','help']),
    teacher:new Set(['dashboard','students','classcenter','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','attendance','attendanceanalytics','inventorycenter','librarycenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','pastpapers','practice','study','schoolassessments','communication','access','notifications','assistant','troubleshoot','help']),
    head:new Set(['dashboard','students','classcenter','bulkimport','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','gatecenter','studentdocs','attendance','attendanceanalytics','fees','financecenter','inventorycenter','librarycenter','transportcenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','pastpapers','practice','study','schoolassessments','universities','vu','admissions','communication','access','notifications','assistant','settings','troubleshoot','help'])
  };
  function canView(view){return !!roleViews[role()]?.has(String(view||''))}
  window.EDUNIZAM_ROLE_SCOPE={role,currentUser,getVisibleStudents,refresh,canView};
  setTimeout(()=>refresh().catch(e=>console.warn('Role scope:',e.message||e)),700);
})();