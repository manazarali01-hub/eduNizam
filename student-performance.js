(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const read=(k,f)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(f));
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const students=()=>read('edunizam_students',[]);
  const attendance=()=>read('edunizam_attendance',{});
  const fees=()=>read('edunizam_fees',[]);
  const results=()=>read('edunizam_results',[]);
  const remarks=()=>read('edunizam_student_remarks',{});
  const practiceHistory=()=>read('edunizam_practice_history',[]);
  let currentStudentId=null;

  const scopedStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||[];
  async function visibleStudents(){
    // Always narrow the cached student list BEFORE displaying a dropdown.
    // When cloud access is absent, fail closed instead of exposing every student.
    const list=scopedStudents(),c=window.EDUNIZAM_CLOUD;
    if(!c?.ready?.()||!c.state?.user)return list;
    let r;try{r=await c.getMyRole()}catch(_){return[]}
    if(r==='head'||r==='head_of_institute')return list;
    if(r==='student')return list.filter(s=>String(s.authUserId||'')===String(c.state.user.id));
    if(r==='parent'){
      try{
        const links=await c.getLinkedStudents(),ids=new Set((links||[]).map(x=>String(x.student_user_id)));
        return list.filter(s=>s.authUserId&&ids.has(String(s.authUserId)));
      }catch(_){return[]}
    }
    if(r==='teacher'){
      // Role Scope includes teacher's assigned students and verified class-teacher
      // sections; never substitute unscoped local rows here.
      return list;
    }
    return[];
  }
  async function fillStudents(){
    const el=$('profileStudentSelect');if(!el)return;
    const list=await visibleStudents();
    const current=el.value;
    el.innerHTML='<option value="">Select student</option>'+list.map(s=>'<option value="'+s.id+'">'+esc(s.name)+' · '+esc(s.className||'')+'</option>').join('');
    if(current&&list.some(s=>String(s.id)===String(current)))el.value=current;
    if(list.length===1&&!el.value){el.value=String(list[0].id)}
    applyProfileRoleControls();
    return list;
  }
  async function applyProfileRoleControls(){
    const cloud=window.EDUNIZAM_CLOUD;let role=window.EDUNIZAM_ROLE_SCOPE?.role?.()||'student';
    if(cloud?.ready?.()&&cloud.state?.user){try{role=await cloud.getMyRole()||'student'}catch(e){}}
    const canRemark=['teacher','head','head_of_institute'].includes(role);
    const remark=$('profileTeacherRemark'),save=$('saveProfileRemarkBtn');
    if(remark){remark.disabled=!canRemark;remark.placeholder=canRemark?'Teacher remark / progress note':'Teacher remarks are view-only for this account';}
    if(save)save.classList.toggle('hidden',!canRemark);
    document.body.dataset.profileRole=role;
    $('studentSelfProfileCard')?.classList.toggle('hidden',role!=='student');
  }

  function cloudReady(){
    const c=window.EDUNIZAM_CLOUD,inst=window.EDUNIZAM_CLOUD_CONFIG?.institutionId;
    return !!(c?.state?.client&&c?.state?.user&&inst);
  }
  function syncLocalStudentFromCloud(row){
    if(!row)return;
    const list=students(),idx=list.findIndex(x=>String(x.authUserId||'')===String(window.EDUNIZAM_CLOUD?.state?.user?.id||''));
    if(idx<0)return;
    const p=row.profile_details||{};
    list[idx]={...list[idx],
      address:row.address||'',photoPath:row.photo_path||list[idx].photoPath||'',
      email:p.email||'',city:p.city||'',district:p.district||'',province:p.province||'',
      bloodGroup:p.blood_group||'',emergencyContact:p.emergency_contact||'',
      healthNotes:p.health_notes||'',specialNeedsNotes:p.special_needs_notes||'',
      profileDetails:{...(list[idx].profileDetails||{}),...p}
    };
    write('edunizam_students',list);
  }
  function fillStudentSelfForm(s){
    if(document.body.dataset.profileRole!=='student'||!s)return;
    if($('selfStudentEmail'))$('selfStudentEmail').value=s.email||s.profileDetails?.email||'';
    if($('selfStudentAddress'))$('selfStudentAddress').value=s.address||'';
    if($('selfStudentCity'))$('selfStudentCity').value=s.city||s.profileDetails?.city||'';
    if($('selfStudentDistrict'))$('selfStudentDistrict').value=s.district||s.profileDetails?.district||'';
    if($('selfStudentProvince'))$('selfStudentProvince').value=s.province||s.profileDetails?.province||'';
    if($('selfStudentBloodGroup'))$('selfStudentBloodGroup').value=s.bloodGroup||s.profileDetails?.blood_group||'';
    if($('selfStudentEmergency'))$('selfStudentEmergency').value=s.emergencyContact||s.profileDetails?.emergency_contact||'';
    if($('selfStudentHealth'))$('selfStudentHealth').value=s.healthNotes||s.profileDetails?.health_notes||'';
    if($('selfStudentSpecialNeeds'))$('selfStudentSpecialNeeds').value=s.specialNeedsNotes||s.profileDetails?.special_needs_notes||'';
    if($('selfStudentPhoto'))$('selfStudentPhoto').value='';
  }
  async function saveMyStudentProfile(){
    if(document.body.dataset.profileRole!=='student')return;
    if(!cloudReady())return alert('Profile self-service requires Cloud Mode and a signed-in Student account.');
    const c=window.EDUNIZAM_CLOUD,client=c.state.client,inst=window.EDUNIZAM_CLOUD_CONFIG.institutionId,uid=c.state.user.id;
    const btn=$('saveSelfStudentProfile');if(btn)btn.disabled=true;
    try{
      const {data,error}=await client.rpc('update_my_student_profile_v1',{
        p_institution_id:inst,
        p_email:$('selfStudentEmail')?.value.trim()||'',
        p_address:$('selfStudentAddress')?.value.trim()||'',
        p_city:$('selfStudentCity')?.value.trim()||'',
        p_district:$('selfStudentDistrict')?.value.trim()||'',
        p_province:$('selfStudentProvince')?.value.trim()||'',
        p_blood_group:$('selfStudentBloodGroup')?.value.trim()||'',
        p_emergency_contact:$('selfStudentEmergency')?.value.trim()||'',
        p_health_notes:$('selfStudentHealth')?.value.trim()||'',
        p_special_needs_notes:$('selfStudentSpecialNeeds')?.value.trim()||''
      });
      if(error)throw error;
      let row=Array.isArray(data)?data[0]:data;
      const file=$('selfStudentPhoto')?.files?.[0]||null;
      if(file){
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Profile picture must be JPG, PNG or WEBP.');
        if(file.size>2*1024*1024)throw new Error('Profile picture must be 2 MB or smaller.');
        const {data:student,error:studentError}=await client.from('core_students').select('id,photo_path').eq('institution_id',inst).eq('auth_user_id',uid).maybeSingle();
        if(studentError)throw studentError;if(!student)throw new Error('Linked student profile not found.');
        const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').slice(0,6)||'jpg';
        const path=inst+'/student/'+student.id+'/'+Date.now()+'.'+ext;
        const {error:uploadError}=await client.storage.from('school-profile-photos').upload(path,file,{upsert:false,contentType:file.type});
        if(uploadError)throw uploadError;
        const {data:photoRow,error:photoError}=await client.rpc('set_my_student_photo_v1',{p_institution_id:inst,p_storage_path:path});
        if(photoError){await client.storage.from('school-profile-photos').remove([path]).catch(()=>{});throw photoError}
        row=Array.isArray(photoRow)?photoRow[0]:photoRow;
        if(student.photo_path&&student.photo_path!==path)client.storage.from('school-profile-photos').remove([student.photo_path]).catch(()=>{});
      }
      syncLocalStudentFromCloud(row);
      await render();
      window.EDUNIZAM_PREMIUM?.toast?.('Your profile was updated.','success');
    }catch(e){alert('Profile update failed: '+(e.message||e))}
    finally{if(btn)btn.disabled=false}
  }

  function studentAttendancePct(id){
    const deep=window.EDUNIZAM_STUDENT_INSIGHTS?.attendanceSummary?.(id);
    if(deep&&deep.percentage!=null)return deep.percentage;
    const days=Object.values(attendance()).filter(day=>Object.prototype.hasOwnProperty.call(day,id)||Object.prototype.hasOwnProperty.call(day,String(id)));
    if(!days.length)return null;
    let present=0,late=0,absent=0;
    days.forEach(day=>{const v=String((day[id]??day[String(id)])||'');if(v==='Present')present++;else if(v==='Late')late++;else if(v==='Absent')absent++});
    const denom=present+late+absent;
    return denom?Math.round(((present+late)/denom)*100):null;
  }

  function studentResults(id){
    const all=results().filter(r=>Number(r.studentId)===Number(id));
    const mode=$('profileTermFilter')?.value||'all';
    if(mode==='recent5')return all.slice(-5);
    if(mode==='recent10')return all.slice(-10);
    return all;
  }
  function averageResult(list){
    if(!list.length)return null;
    return Math.round(list.reduce((sum,r)=>sum+((Number(r.marks)||0)/(Number(r.total)||1))*100,0)/list.length);
  }
  function subjectStats(list){
    const map={};
    list.forEach(r=>{
      const key=r.subject||'Subject';
      const pct=((Number(r.marks)||0)/(Number(r.total)||1))*100;
      (map[key]??={sum:0,count:0}).sum+=pct;map[key].count++;
    });
    return Object.entries(map).map(([subject,v])=>({subject,avg:Math.round(v.sum/v.count)})).sort((a,b)=>a.avg-b.avg);
  }
  function feeStats(id){
    const deep=window.EDUNIZAM_STUDENT_INSIGHTS?.feeSummary?.(id);
    if(deep){
      const list=(deep.rows||[]).map(x=>Object.assign({},x,{
        amount:Number(x.totalAmount??x.amount??0),
        date:x.status==='Paid'?(x.paidAt?String(x.paidAt).slice(0,10):(x.date||'')):(x.dueDate||x.date||'')
      }));
      return {list,paid:Number(deep.paid||0),pending:Number(deep.outstanding||0),overdue:Number(deep.overdueAmount||0),overdueCount:(deep.overdueRows||[]).length};
    }
    const list=fees().filter(f=>Number(f.studentId)===Number(id));
    return {
      list,
      paid:list.filter(f=>f.status==='Paid').reduce((a,b)=>a+Number(b.amount||0),0),
      pending:list.filter(f=>f.status!=='Paid').reduce((a,b)=>a+Number(b.amount||0),0),
      overdue:0,overdueCount:0
    };
  }
  function practiceStats(id){
    const list=practiceHistory().filter(x=>Number(x.studentId)===Number(id));
    const avg=list.length?Math.round(list.reduce((a,b)=>a+Number(b.pct||0),0)/list.length):null;
    const weakMap={};
    list.flatMap(x=>x.weak||[]).forEach(w=>{
      const k=(w.subject||'Subject')+'|'+(w.chapter||'General');
      weakMap[k]=(weakMap[k]||0)+1;
    });
    const weak=Object.entries(weakMap).map(([k,count])=>{
      const [subject,chapter]=k.split('|');return{subject,chapter,count};
    }).sort((a,b)=>b.count-a.count);
    return{list,avg,weak};
  }


  function trendBars(values){
    if(!values.length)return '<div class="empty-state">No trend data yet.</div>';
    return '<div class="trend-bars">'+values.map((v,i)=>'<div class="trend-col" title="'+esc(v.label)+' · '+v.value+'%"><span>'+v.value+'%</span><i style="height:'+Math.max(6,Math.min(100,v.value))+'%"></i><small>'+esc(v.shortLabel||String(i+1))+'</small></div>').join('')+'</div>';
  }
  function attendanceCalendar(id){
    const all=attendance();
    const dates=Object.keys(all).sort().slice(-30);
    if(!dates.length)return '<div class="empty-state">No attendance data yet.</div>';
    return '<div class="attendance-grid">'+dates.map(d=>{
      const day=all[d]||{},v=day[id]??day[String(id)]??'Not Marked';
      const cls=v==='Present'?'present':(v==='Absent'?'absent':'na');
      return '<div class="attendance-day '+cls+'" title="'+esc(d)+' · '+esc(v)+'"><strong>'+esc(d.slice(-2))+'</strong><span>'+esc(v==='Present'?'P':v==='Absent'?'A':'—')+'</span></div>';
    }).join('')+'</div>';
  }
  function riskLabel(att,avg,weak){
    if((att!=null&&att<60)||(avg!=null&&avg<50)||weak>=3)return ['High Attention','high'];
    if((att!=null&&att<75)||(avg!=null&&avg<60)||weak>=1)return ['Needs Attention','medium'];
    return ['On Track','good'];
  }

  let renderToken=0;
  async function render(){
    const token=++renderToken,school=String(window.EDUNIZAM_CLOUD_CONFIG?.institutionId||''),
      uid=String(window.EDUNIZAM_CLOUD?.state?.user?.id||'');
    const visible=await fillStudents();
    if(token!==renderToken||school!==String(window.EDUNIZAM_CLOUD_CONFIG?.institutionId||'')||uid!==String(window.EDUNIZAM_CLOUD?.state?.user?.id||''))return;
    const id=$('profileStudentSelect')?.value;
    currentStudentId=id?Number(id):null;
    const s=(visible||[]).find(x=>Number(x.id)===currentStudentId);
    $('studentProfileEmpty')?.classList.toggle('hidden',!!s);
    $('studentProfileContent')?.classList.toggle('hidden',!s);
    if(!s)return;

    const att=studentAttendancePct(s.id);
    const rlist=studentResults(s.id);
    const avg=averageResult(rlist);
    const subjects=subjectStats(rlist);
    const f=feeStats(s.id);
    const p=practiceStats(s.id);
    const weak=subjects.filter(x=>x.avg<60);
    const [risk,riskClass]=riskLabel(att,avg,weak.length);

    $('profileStudentName').textContent=s.name;
    $('profileStudentMeta').textContent=[
      s.studentId&&('Student ID '+s.studentId),
      s.admissionNo&&('Admission '+s.admissionNo),
      s.rollNo&&('Roll '+s.rollNo),
      s.className,
      s.sectionName&&('Section '+s.sectionName),
      s.gender,
      s.dateOfBirth&&('DOB '+s.dateOfBirth),
      s.father&&('Guardian: '+s.father)
    ].filter(Boolean).join(' · ');
    const avatar=$('profileStudentAvatar');
    if(avatar){
      const initials=String(s.name||'Student').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'ST';
      avatar.textContent=initials;
      avatar.style.backgroundImage='';
      avatar.classList.remove('has-photo');
      if(s.photoPath&&window.EDUNIZAM_CORE_CLOUD?.ready?.()&&window.EDUNIZAM_CORE_CLOUD?.createProfilePhotoUrl){
        try{
          const photoUrl=await window.EDUNIZAM_CORE_CLOUD.createProfilePhotoUrl(s.photoPath,1800);
          if(photoUrl){
            avatar.textContent='';
            avatar.style.backgroundImage='url("'+String(photoUrl).replace(/"/g,'%22')+'")';
            avatar.classList.add('has-photo');
          }
        }catch(_){}
      }
    }
    $('profileAttendance').textContent=att==null?'No data':att+'%';
    $('profileAverage').textContent=avg==null?'No data':avg+'%';
    $('profileFeesPaid').textContent='Rs '+f.paid.toLocaleString();
    $('profileFeesPending').textContent='Rs '+f.pending.toLocaleString();
    $('profilePracticeAverage').textContent=p.avg==null?'No data':p.avg+'%';
    $('profilePracticeTests').textContent=p.list.length;
    $('profileRiskBadge').textContent=risk;
    $('profileRiskBadge').dataset.risk=riskClass;
    fillStudentSelfForm(s);

    $('profileSubjectPerformance').innerHTML=subjects.length?subjects.map(x=>'<div class="subject-bar-row"><div><strong>'+esc(x.subject)+'</strong><span>'+x.avg+'%</span></div><div class="subject-bar"><i style="width:'+Math.max(0,Math.min(100,x.avg))+'%"></i></div></div>').join(''):'<div class="empty-state">No result data yet.</div>';

    const resultTrend=rlist.slice(-8).map((r,i)=>({value:Math.round((Number(r.marks)||0)/(Number(r.total)||1)*100),label:r.subject||'Result',shortLabel:String(i+1)}));
    $('profileResultTrend').innerHTML=trendBars(resultTrend);
    const practiceTrend=p.list.slice(-8).map((x,i)=>({value:Number(x.pct||0),label:x.config?.subject||'Practice',shortLabel:String(i+1)}));
    $('profilePracticeChart').innerHTML=trendBars(practiceTrend);
    $('profileAttendanceCalendar').innerHTML=attendanceCalendar(s.id);

    const strongest=subjects.length?subjects.slice().sort((a,b)=>b.avg-a.avg)[0]:null;
    const weakest=subjects.length?subjects[0]:null;
    const highlights=[];
    if(strongest)highlights.push('<div class="highlight-card"><span>Strongest Subject</span><strong>'+esc(strongest.subject)+' · '+strongest.avg+'%</strong></div>');
    if(weakest)highlights.push('<div class="highlight-card"><span>Focus Subject</span><strong>'+esc(weakest.subject)+' · '+weakest.avg+'%</strong></div>');
    if(att!=null)highlights.push('<div class="highlight-card"><span>Attendance</span><strong>'+att+'%</strong></div>');
    if(p.avg!=null)highlights.push('<div class="highlight-card"><span>Practice Average</span><strong>'+p.avg+'%</strong></div>');
    $('profileHighlights').innerHTML=highlights.length?highlights.join(''):'<div class="empty-state">More data is needed for highlights.</div>';

    const alerts=[];
    if(att!=null&&att<75)alerts.push('Attendance is '+att+'%, below the 75% target.');
    weak.forEach(x=>alerts.push(x.subject+' average is '+x.avg+'% and needs improvement.'));
    if(f.pending>0)alerts.push('Pending fee amount: Rs '+f.pending.toLocaleString()+'.');
    if(!alerts.length)alerts.push('No major academic or attendance alert at present.');
    $('profileAlerts').innerHTML=alerts.map(a=>'<div class="profile-alert">'+esc(a)+'</div>').join('');

    $('profileRecentResults').innerHTML=rlist.length?rlist.slice().reverse().slice(0,8).map(r=>{
      const pct=Math.round((Number(r.marks)||0)/(Number(r.total)||1)*100);
      return '<div class="profile-line"><strong>'+esc(r.subject)+'</strong><span>'+esc(r.marks)+'/'+esc(r.total)+' · '+pct+'%</span></div>';
    }).join(''):'<div class="empty-state">No results recorded.</div>';

    $('profileFeeHistory').innerHTML=f.list.length?f.list.slice().reverse().slice(0,8).map(x=>'<div class="profile-line"><strong>Rs '+Number(x.amount||0).toLocaleString()+'</strong><span>'+esc(x.status)+' · '+esc(x.date||'')+'</span></div>').join(''):'<div class="empty-state">No fee records.</div>';

    $('profilePracticeTrend').innerHTML=p.list.length?p.list.slice().reverse().slice(0,8).map(x=>'<div class="profile-line"><strong>'+esc(x.config?.subject||'Practice')+'</strong><span>'+Number(x.pct||0)+'% · '+new Date(x.at).toLocaleDateString()+'</span></div>').join(''):'<div class="empty-state">No student-linked practice tests yet.</div>';

    $('profilePracticeWeak').innerHTML=p.weak.length?p.weak.slice(0,8).map(x=>'<div class="profile-line"><strong>'+esc(x.subject)+' · '+esc(x.chapter)+'</strong><span>'+x.count+' mistake'+(x.count===1?'':'s')+'</span></div>').join(''):'<div class="empty-state">No weak practice topics detected.</div>';

    const rm=remarks();$('profileTeacherRemark').value=rm[s.id]||'';
    $('profileParentSummary').innerHTML='';
  }

  function saveRemark(){
    if(!['teacher','head'].includes(window.EDUNIZAM_ROLE_SCOPE?.role?.()))return alert('Only authorized school staff may save a teacher remark.');
    if(!currentStudentId||!scopedStudents().some(x=>Number(x.id)===currentStudentId))return alert('Select an accessible student.');
    const rm=remarks();rm[currentStudentId]=$('profileTeacherRemark').value.trim();write('edunizam_student_remarks',rm);
    alert('Teacher remark saved.');
  }

  function summaryText(){
    const s=scopedStudents().find(x=>Number(x.id)===Number(currentStudentId));if(!s)return'';
    const att=studentAttendancePct(s.id),rlist=studentResults(s.id),avg=averageResult(rlist),subjects=subjectStats(rlist),f=feeStats(s.id),p=practiceStats(s.id),rm=remarks()[s.id]||'';
    const best=subjects.slice().sort((a,b)=>b.avg-a.avg)[0],weak=subjects.filter(x=>x.avg<60);
    let t='Progress summary for '+s.name+' ('+(s.className||'Student')+'). ';
    t+='Attendance: '+(att==null?'not recorded':att+'%')+'. ';
    t+='Academic average: '+(avg==null?'not recorded':avg+'%')+'. ';
    if(best)t+='Strongest subject: '+best.subject+' ('+best.avg+'%). ';
    if(weak.length)t+='Needs attention in '+weak.map(x=>x.subject+' '+x.avg+'%').join(', ')+'. ';
    else if(subjects.length)t+='No subject is currently below 60%. ';
    if(p.avg!=null)t+='Practice average: '+p.avg+'% across '+p.list.length+' linked test'+(p.list.length===1?'':'s')+'. ';
    if(p.weak.length)t+='Practice focus: '+p.weak.slice(0,3).map(x=>x.subject+' '+x.chapter).join(', ')+'. ';
    if(f.pending>0)t+='Pending fees: Rs '+f.pending.toLocaleString()+'. ';
    if(f.overdueCount)t+=f.overdueCount+' fee challan(s) are overdue. ';
    const deep=window.EDUNIZAM_STUDENT_INSIGHTS?.profile?.(s);
    if(deep?.assignments?.missing?.length)t+='Missing assignments: '+deep.assignments.missing.length+'. ';
    if(deep?.exams?.next)t+='Next exam: '+(deep.exams.next.subject||'Exam')+' on '+(deep.exams.next.examDate||'scheduled date')+'. ';
    if(rm)t+='Teacher remark: '+rm;
    return t;
  }

  function generateSummary(){
    const text=summaryText();if(!text)return alert('Select a student.');
    $('profileParentSummary').innerHTML='<div class="coverage-note"><strong>Parent Summary</strong><p>'+esc(text)+'</p></div>';
  }

  function printReport(){
    const s=scopedStudents().find(x=>Number(x.id)===Number(currentStudentId));if(!s)return alert('Select an accessible student.');
    const att=studentAttendancePct(s.id),rlist=studentResults(s.id),avg=averageResult(rlist),subjects=subjectStats(rlist),f=feeStats(s.id),summary=summaryText();
    const st=read('edunizam_settings',{}),logo=st.schoolLogo?'<img class="brand-logo" src="'+esc(st.schoolLogo)+'" alt="Institute logo">':'';
    const w=window.open('','_blank');if(!w)return;
    w.document.write('<html><head><title>Student Progress Report</title><style>body{font-family:Arial;padding:40px;line-height:1.6;color:#17324a}.brand{display:flex;align-items:center;gap:16px;margin-bottom:20px}.brand-logo{width:74px;height:74px;object-fit:contain;border:1px solid #d8e2e7;border-radius:14px;padding:5px}.brand h1{margin:0}.brand p{margin:4px 0 0;color:#667}.box{border:1px solid #aaa;padding:16px;margin:14px 0;border-radius:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="brand">'+logo+'<div><h1>'+esc(st.schoolName||'EduNizam Institute')+'</h1><p>'+esc(st.schoolType||'Institute')+(st.session?' · '+esc(st.session):'')+'</p></div></div><h2>Student Progress Report</h2><div class="box grid"><div>Student: '+esc(s.name)+'</div><div>Class: '+esc(s.className||'')+'</div><div>Student ID: '+esc(s.studentId||'')+'</div><div>Roll No: '+esc(s.rollNo||'')+'</div><div>Attendance: '+(att==null?'N/A':att+'%')+'</div><div>Average: '+(avg==null?'N/A':avg+'%')+'</div><div>Paid Fees: Rs '+f.paid.toLocaleString()+'</div><div>Pending Fees: Rs '+f.pending.toLocaleString()+'</div></div><div class="box"><strong>Subject Performance</strong><table><tr><th>Subject</th><th>Average</th></tr>'+subjects.map(x=>'<tr><td>'+esc(x.subject)+'</td><td>'+x.avg+'%</td></tr>').join('')+'</table></div><div class="box"><strong>Parent Summary</strong><p>'+esc(summary)+'</p></div><p>Teacher Signature: ____________________ &nbsp;&nbsp; Parent Signature: ____________________</p></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  $('profileStudentSelect')?.addEventListener('change',render);
  $('profileTermFilter')?.addEventListener('change',render);
  $('saveProfileRemarkBtn')?.addEventListener('click',saveRemark);
  $('generateParentSummaryBtn')?.addEventListener('click',generateSummary);
  $('printStudentReportBtn')?.addEventListener('click',printReport);
  $('saveSelfStudentProfile')?.addEventListener('click',saveMyStudentProfile);

  window.renderStudentPerformance=render;
  window.EDUNIZAM_STUDENT_PROFILE_SCOPE={visibleStudents,scopedStudents};
  window.addEventListener('edunizam:workspace-ready',()=>{currentStudentId=null;renderToken++;const selector=$('profileStudentSelect');if(selector)selector.value='';});
  fillStudents();
})();