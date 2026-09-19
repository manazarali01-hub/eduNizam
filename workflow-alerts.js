(function(){
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const students=()=>{try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}};
  const sentKey='edunizam_workflow_alert_signatures';
  const sent=()=>{try{return new Set(JSON.parse(localStorage.getItem(sentKey)||'[]'))}catch{return new Set()}};
  function remember(sig){const s=sent();s.add(sig);localStorage.setItem(sentKey,JSON.stringify([...s].slice(-500)))}
  function ready(){return !!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId&&cloud()?.sendNotification)}
  async function recipientsFor(student){
    if(!student?.authUserId||!ready())return[];
    const ids=[student.authUserId];
    if(cloud().listApprovedParentsForStudent){
      try{ids.push(...await cloud().listApprovedParentsForStudent(student.authUserId))}catch(e){console.warn('Parent recipients:',e.message||e)}
    }
    return [...new Set(ids.filter(Boolean))];
  }
  async function notifyStudent(student,title,body,category,signature){
    if(!ready()||!student?.authUserId)return;
    if(signature&&sent().has(signature))return;
    const recipients=await recipientsFor(student);
    for(const uid of recipients){
      try{await cloud().sendNotification(uid,title,body,category)}catch(e){console.warn('Notification:',e.message||e)}
    }
    if(signature)remember(signature);
    window.EDUNIZAM_ACADEMIC_ACCESS?.loadNotifications?.();
  }
  async function attendanceSaved(day,date){
    for(const [id,status] of Object.entries(day||{})){
      if(status!=='Absent')continue;
      const student=students().find(s=>String(s.id)===String(id));if(!student)continue;
      await notifyStudent(student,'Attendance Alert',student.name+' was marked Absent on '+date+'.','attendance','att:'+date+':'+id+':Absent');
    }
  }
  async function resultSaved(r){
    const student=students().find(s=>String(s.id)===String(r?.studentId));if(!student)return;
    const pct=Number(r.total)?Math.round(Number(r.marks)/Number(r.total)*100):0;
    await notifyStudent(student,'New Result: '+r.subject,student.name+' scored '+r.marks+'/'+r.total+' ('+pct+'%).','result','result:'+r.id);
  }
  async function feeSaved(f){
    const student=students().find(s=>String(s.id)===String(f?.studentId));if(!student)return;
    const title=f.status==='Paid'?'Fee Payment Recorded':'Fee Reminder';
    const body=student.name+' — Rs '+Number(f.amount||0).toLocaleString()+' is marked '+f.status+'.';
    await notifyStudent(student,title,body,'fee','fee:'+f.id+':'+f.status);
  }
  async function meetingSaved(m){
    if(!ready()||!m)return;
    const student=students().find(s=>String(s.id)===String(m.personId));
    let recipients=[];
    if(m.kind==='teacher-student'&&student?.authUserId)recipients=[student.authUserId];
    if(m.kind==='head-parent'&&student?.authUserId&&cloud().listApprovedParentsForStudent){
      try{recipients=await cloud().listApprovedParentsForStudent(student.authUserId)}catch(e){}
    }
    const body=(m.title||'Meeting')+' is scheduled for '+m.date+' at '+m.time+(m.url?' — Google Meet link is available in Communication Center.':'');
    for(const uid of [...new Set(recipients.filter(Boolean))]){
      const sig='meet:'+m.id+':'+uid;if(sent().has(sig))continue;
      try{await cloud().sendNotification(uid,'Meeting Scheduled',body,'meeting');remember(sig)}catch(e){console.warn('Meeting notification:',e.message||e)}
    }
  }
  window.EDUNIZAM_WORKFLOW_ALERTS={attendanceSaved,resultSaved,feeSaved,meetingSaved};
})();