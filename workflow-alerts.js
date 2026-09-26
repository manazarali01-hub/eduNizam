(function(){
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const students=()=>{try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}};
  const staff=()=>{try{return JSON.parse(localStorage.getItem('edunizam_staff_profiles_v1')||'[]')}catch{return[]}};
  const staffAttendance=()=>{try{return JSON.parse(localStorage.getItem('edunizam_staff_attendance_v1')||'[]')}catch{return[]}};
  const studentAttendance=()=>{try{return JSON.parse(localStorage.getItem('edunizam_attendance')||'{}')}catch{return{}}};
  const sentKey='edunizam_workflow_alert_signatures';
  const sent=()=>{try{return new Set(JSON.parse(localStorage.getItem(sentKey)||'[]'))}catch{return new Set()}};
  function remember(sig){const s=sent();s.add(sig);localStorage.setItem(sentKey,JSON.stringify([...s].slice(-700)))}
  function ready(){return !!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId&&cloud()?.sendNotification)}
  function localDateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const contact=s=>String(s?.phone||s?.contact||'').trim();

  async function recipientsFor(student){
    if(!student?.authUserId||!ready())return[];
    const ids=[student.authUserId];
    if(cloud().listApprovedParentsForStudent){
      try{ids.push(...await cloud().listApprovedParentsForStudent(student.authUserId))}catch(e){console.warn('Parent recipients:',e.message||e)}
    }
    return [...new Set(ids.filter(Boolean))];
  }
  async function adminUserId(){
    if(!ready())return'';
    try{
      const {data,error}=await cloud().state.client.from('institutions').select('owner_user_id').eq('id',cfg().institutionId).maybeSingle();
      if(error)throw error;
      return data?.owner_user_id||'';
    }catch(e){console.warn('Admin recipient:',e.message||e);return''}
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
  async function notifyAdmin(title,body,category,signature){
    if(!ready())return;
    if(signature&&sent().has(signature))return;
    const admin=await adminUserId();if(!admin)return;
    if(admin===cloud().state.user?.id&&role()==='head'){if(signature)remember(signature);return}
    try{
      await cloud().sendNotification(admin,title,body,category);
      if(signature)remember(signature);
    }catch(e){console.warn('Admin notification:',e.message||e)}
  }

  function studentDetail(s){
    const cls=[s?.className,s?.sectionName].filter(Boolean).join('/');
    return [s?.name||'Student',cls&&('Class '+cls),contact(s)||'No contact number'].filter(Boolean).join(' · ');
  }
  function staffDetail(s){
    return [s?.fullName||s?.staffName||'Staff',s?.designation||'Teacher',contact(s)||'No contact number'].filter(Boolean).join(' · ');
  }

  async function attendanceSaved(day,date){
    const absent=[];
    for(const [id,status] of Object.entries(day||{})){
      if(status!=='Absent')continue;
      const student=students().find(s=>String(s.id)===String(id));if(!student)continue;
      absent.push(student);
      await notifyStudent(
        student,
        'Attendance Alert',
        student.name+' was marked Absent on '+date+'.',
        'attendance',
        'att:'+cfg().institutionId+':'+date+':'+id+':Absent'
      );
    }
    if(absent.length){
      const ids=absent.map(s=>String(s.id)).sort().join(',');
      const body=absent.map(studentDetail).join('\n');
      await notifyAdmin(
        'Student Absence Report · '+date,
        absent.length+' student(s) absent:\n'+body,
        'attendance-admin',
        'admin-student-absence:'+cfg().institutionId+':'+date+':'+ids
      );
    }
    renderAdminAttendanceAlerts(true).catch(()=>{});
  }

  async function staffAttendanceSaved(item){
    if(!item)return;
    const st=staff().find(s=>String(s.id)===String(item.staffId))||{fullName:item.staffName||'Staff'};
    if(item.status==='Absent'){
      await notifyAdmin(
        'Staff Absence · '+item.date,
        staffDetail(st)+(item.note?' · Note: '+item.note:''),
        'attendance-admin',
        'admin-staff-absence:'+cfg().institutionId+':'+item.date+':'+String(item.staffId)
      );
    }
    renderAdminAttendanceAlerts(true).catch(()=>{});
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

  function localSummary(date){
    const day=studentAttendance()[date]||{};
    const stu=students();
    const absentStudents=stu.filter(s=>(day[s.id]??day[String(s.id)])==='Absent').map(s=>({
      name:s.name||'Student',className:s.className||'',sectionName:s.sectionName||'',phone:contact(s)
    }));
    const people=staff().filter(s=>String(s.status||s.employmentStatus||'active').toLowerCase()!=='inactive');
    const rows=staffAttendance().filter(x=>x.date===date);
    const rowMap=new Map(rows.map(x=>[String(x.staffId),x]));
    const absentStaff=people.filter(s=>rowMap.get(String(s.id))?.status==='Absent').map(s=>({
      name:s.fullName||'Staff',designation:s.designation||'Teacher',phone:contact(s),status:'Absent'
    }));
    const notMarkedStaff=people.filter(s=>!rowMap.has(String(s.id))).map(s=>({
      name:s.fullName||'Staff',designation:s.designation||'Teacher',phone:contact(s),status:'Not Marked'
    }));
    return {absentStudents,absentStaff,notMarkedStaff};
  }

  async function cloudSummary(date){
    if(!ready()||role()!=='head')return null;
    const client=cloud().state.client,inst=cfg().institutionId;
    const [stuRes,attRes,staffRes,staffAttRes]=await Promise.all([
      client.from('core_students').select('id,name,class_name,section_name,phone').eq('institution_id',inst),
      client.from('attendance_records').select('student_id,status').eq('institution_id',inst).eq('attendance_date',date),
      client.from('staff_profiles').select('id,full_name,designation,phone,employment_status').eq('institution_id',inst),
      client.from('staff_attendance_records').select('staff_profile_id,status,check_in_at,check_out_at').eq('institution_id',inst).eq('attendance_date',date)
    ]);
    for(const r of [stuRes,attRes,staffRes,staffAttRes])if(r.error)throw r.error;
    const studentsById=new Map((stuRes.data||[]).map(s=>[s.id,s]));
    const absentStudents=(attRes.data||[]).filter(x=>x.status==='Absent').map(x=>studentsById.get(x.student_id)).filter(Boolean).map(s=>({
      name:s.name||'Student',className:s.class_name||'',sectionName:s.section_name||'',phone:s.phone||''
    }));
    const activeStaff=(staffRes.data||[]).filter(s=>String(s.employment_status||'active').toLowerCase()!=='inactive');
    const staffRows=new Map((staffAttRes.data||[]).map(x=>[x.staff_profile_id,x]));
    const absentStaff=activeStaff.filter(s=>staffRows.get(s.id)?.status==='Absent').map(s=>({
      name:s.full_name||'Staff',designation:s.designation||'Teacher',phone:s.phone||'',status:'Absent'
    }));
    const notMarkedStaff=activeStaff.filter(s=>!staffRows.has(s.id)).map(s=>({
      name:s.full_name||'Staff',designation:s.designation||'Teacher',phone:s.phone||'',status:'Not Marked'
    }));
    return {absentStudents,absentStaff,notMarkedStaff};
  }

  function personRow(x,type){
    const sub=type==='student'
      ?['Class '+[x.className,x.sectionName].filter(Boolean).join('/'),x.phone||'No contact number'].filter(v=>v&&v!=='Class ').join(' · ')
      :[x.designation||'Teacher',x.phone||'No contact number'].join(' · ');
    const status=type==='student'?'Absent':x.status;
    return '<div class="attendance-alert-person"><div><strong>'+esc(x.name||'Person')+'</strong><small>'+esc(sub)+'</small></div><span class="attendance-alert-status '+(status==='Not Marked'?'pending':'absent')+'">'+esc(status)+'</span></div>';
  }

  function ensureAttendanceCard(){
    if(role()!=='head')return null;
    const dashboard=document.getElementById('dashboard');if(!dashboard)return null;
    let card=document.getElementById('adminAttendanceAlerts');
    if(card)return card;
    card=document.createElement('section');
    card.id='adminAttendanceAlerts';
    card.className='card admin-attendance-alerts';
    const daily=document.getElementById('adminDailyDesk');
    if(daily?.parentNode)daily.parentNode.insertBefore(card,daily.nextSibling);
    else dashboard.prepend(card);
    return card;
  }

  async function renderAdminAttendanceAlerts(forceCloud=false){
    if(role()!=='head')return;
    const card=ensureAttendanceCard();if(!card)return;
    const date=localDateKey();
    card.innerHTML='<div class="section-head"><div><div class="academic-kicker">Attendance Alerts</div><h2>Today\'s Absence Details</h2><p class="muted">Absent students aur staff contacts Admin ke liye.</p></div><span class="academic-pill">Loading…</span></div>';
    let summary=localSummary(date),source='Local';
    if(forceCloud||ready()){
      try{const remote=await cloudSummary(date);if(remote){summary=remote;source='Cloud'}}catch(e){console.warn('Attendance alert cloud summary:',e.message||e)}
    }
    const a=summary.absentStudents||[],s=summary.absentStaff||[],n=summary.notMarkedStaff||[];
    card.innerHTML='<div class="section-head"><div><div class="academic-kicker">Attendance Alerts</div><h2>Today\'s Absence Details</h2><p class="muted">'+esc(date)+' · Student name/class/contact and staff name/contact.</p></div><span class="academic-pill">'+source+'</span></div>'+
      '<div class="attendance-alert-counts"><div><span>Absent Students</span><strong>'+a.length+'</strong></div><div><span>Absent Staff</span><strong>'+s.length+'</strong></div><div><span>Staff Not Marked</span><strong>'+n.length+'</strong></div></div>'+
      '<div class="attendance-alert-columns"><div><h3>Absent Students</h3>'+(a.length?a.map(x=>personRow(x,'student')).join(''):'<div class="muted">No student marked absent today.</div>')+'</div>'+
      '<div><h3>Staff / Teachers</h3>'+((s.length||n.length)?[...s,...n].map(x=>personRow(x,'staff')).join(''):'<div class="muted">No staff absence alert today.</div>')+'</div></div>';
  }

  window.addEventListener('edunizam:attendance-updated',()=>renderAdminAttendanceAlerts(true).catch(()=>{}));
  window.addEventListener('edunizam:auth',()=>setTimeout(()=>renderAdminAttendanceAlerts(true).catch(()=>{}),500));
  window.addEventListener('online',()=>renderAdminAttendanceAlerts(true).catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderAdminAttendanceAlerts(true).catch(()=>{})});
  setTimeout(()=>renderAdminAttendanceAlerts(false).catch(()=>{}),1200);

  window.EDUNIZAM_WORKFLOW_ALERTS={attendanceSaved,staffAttendanceSaved,resultSaved,feeSaved,meetingSaved,renderAdminAttendanceAlerts};
})();