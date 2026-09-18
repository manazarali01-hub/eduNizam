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

  function fillStudents(){
    const el=$('profileStudentSelect');if(!el)return;
    const list=students();
    el.innerHTML='<option value="">Select student</option>'+list.map(s=>'<option value="'+s.id+'">'+esc(s.name)+' · '+esc(s.className||'')+'</option>').join('');
  }

  function studentAttendancePct(id){
    const days=Object.values(attendance()).filter(day=>Object.prototype.hasOwnProperty.call(day,id)||Object.prototype.hasOwnProperty.call(day,String(id)));
    if(!days.length)return null;
    let present=0;
    days.forEach(day=>{const v=day[id]??day[String(id)];if(v==='Present')present++});
    return Math.round((present/days.length)*100);
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
    const list=fees().filter(f=>Number(f.studentId)===Number(id));
    return {
      list,
      paid:list.filter(f=>f.status==='Paid').reduce((a,b)=>a+Number(b.amount||0),0),
      pending:list.filter(f=>f.status!=='Paid').reduce((a,b)=>a+Number(b.amount||0),0)
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

  function riskLabel(att,avg,weak){
    if((att!=null&&att<60)||(avg!=null&&avg<50)||weak>=3)return ['High Attention','high'];
    if((att!=null&&att<75)||(avg!=null&&avg<60)||weak>=1)return ['Needs Attention','medium'];
    return ['On Track','good'];
  }

  function render(){
    fillStudents();
    const id=$('profileStudentSelect')?.value;
    currentStudentId=id?Number(id):null;
    const s=students().find(x=>Number(x.id)===currentStudentId);
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
    $('profileStudentMeta').textContent=[s.studentId&&('Student ID '+s.studentId),s.rollNo&&('Roll '+s.rollNo),s.className,s.father&&('Guardian: '+s.father)].filter(Boolean).join(' · ');
    $('profileAttendance').textContent=att==null?'No data':att+'%';
    $('profileAverage').textContent=avg==null?'No data':avg+'%';
    $('profileFeesPaid').textContent='Rs '+f.paid.toLocaleString();
    $('profileFeesPending').textContent='Rs '+f.pending.toLocaleString();
    $('profilePracticeAverage').textContent=p.avg==null?'No data':p.avg+'%';
    $('profilePracticeTests').textContent=p.list.length;
    $('profileRiskBadge').textContent=risk;
    $('profileRiskBadge').dataset.risk=riskClass;

    $('profileSubjectPerformance').innerHTML=subjects.length?subjects.map(x=>'<div class="subject-bar-row"><div><strong>'+esc(x.subject)+'</strong><span>'+x.avg+'%</span></div><div class="subject-bar"><i style="width:'+Math.max(0,Math.min(100,x.avg))+'%"></i></div></div>').join(''):'<div class="empty-state">No result data yet.</div>';

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
    if(!currentStudentId)return alert('Select a student.');
    const rm=remarks();rm[currentStudentId]=$('profileTeacherRemark').value.trim();write('edunizam_student_remarks',rm);
    alert('Teacher remark saved.');
  }

  function summaryText(){
    const s=students().find(x=>Number(x.id)===Number(currentStudentId));if(!s)return'';
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
    if(rm)t+='Teacher remark: '+rm;
    return t;
  }

  function generateSummary(){
    const text=summaryText();if(!text)return alert('Select a student.');
    $('profileParentSummary').innerHTML='<div class="coverage-note"><strong>Parent Summary</strong><p>'+esc(text)+'</p></div>';
  }

  function printReport(){
    const s=students().find(x=>Number(x.id)===Number(currentStudentId));if(!s)return alert('Select a student.');
    const att=studentAttendancePct(s.id),rlist=studentResults(s.id),avg=averageResult(rlist),subjects=subjectStats(rlist),f=feeStats(s.id),summary=summaryText();
    const w=window.open('','_blank');if(!w)return;
    w.document.write('<html><head><title>Student Progress Report</title><style>body{font-family:Arial;padding:40px;line-height:1.6}.box{border:1px solid #aaa;padding:16px;margin:14px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>'+esc(read('edunizam_settings',{}).schoolName||'EduNizam Institute')+'</h1><h2>Student Progress Report</h2><div class="box grid"><div>Student: '+esc(s.name)+'</div><div>Class: '+esc(s.className||'')+'</div><div>Student ID: '+esc(s.studentId||'')+'</div><div>Roll No: '+esc(s.rollNo||'')+'</div><div>Attendance: '+(att==null?'N/A':att+'%')+'</div><div>Average: '+(avg==null?'N/A':avg+'%')+'</div><div>Paid Fees: Rs '+f.paid.toLocaleString()+'</div><div>Pending Fees: Rs '+f.pending.toLocaleString()+'</div></div><div class="box"><strong>Subject Performance</strong><table><tr><th>Subject</th><th>Average</th></tr>'+subjects.map(x=>'<tr><td>'+esc(x.subject)+'</td><td>'+x.avg+'%</td></tr>').join('')+'</table></div><div class="box"><strong>Parent Summary</strong><p>'+esc(summary)+'</p></div><p>Teacher Signature: ____________________ &nbsp;&nbsp; Parent Signature: ____________________</p></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  $('profileStudentSelect')?.addEventListener('change',render);
  $('profileTermFilter')?.addEventListener('change',render);
  $('saveProfileRemarkBtn')?.addEventListener('click',saveRemark);
  $('generateParentSummaryBtn')?.addEventListener('click',generateSummary);
  $('printStudentReportBtn')?.addEventListener('click',printReport);

  window.renderStudentPerformance=render;
  fillStudents();
})();