(function(){
  const KEY='edunizam_role_scope';
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const currentUser=()=>cloud()?.state?.user?.id||localStorage.getItem('edunizam_cloud_user_id')||'';
  const readCache=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const writeCache=v=>localStorage.setItem(KEY,JSON.stringify(v));
  function cloudReady(){return !!(cloud()?.state?.client&&currentUser())}
  function localVisibleStudents(list){
    const r=role(),all=list||[],identity=String(session()?.identity||'').trim().toLowerCase();
    if(r==='head'||r==='teacher')return all;
    if(!identity)return[];
    return all.filter(s=>[s.id,s.studentId,s.rollNo,s.phone].some(v=>String(v??'').trim().toLowerCase()===identity));
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
  window.EDUNIZAM_ROLE_SCOPE={role,currentUser,getVisibleStudents,refresh};
  setTimeout(()=>refresh().catch(e=>console.warn('Role scope:',e.message||e)),700);
})();