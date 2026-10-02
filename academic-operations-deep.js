(function(){
  'use strict';
  if(window.EDUNIZAM_ACADEMIC_OPERATIONS_DEEP)return;
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch{return f}};
  const students=()=>read('edunizam_students',[]);
  const session=()=>read('edunizam_session',{});
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const visibleStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students();
  const I=()=>window.EDUNIZAM_STUDENT_INSIGHTS;
  const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';

  function download(name,text,type='text/csv;charset=utf-8'){
    const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);
  }
  function jump(view){
    const b=document.querySelector('[data-view="'+view+'"]');if(b)b.click();
  }
  function profiles(){return visibleStudents().map(s=>I()?.profile(s)).filter(Boolean)}
  function setBoxHtml(el,html){if(!el)return false;if(el.__eduDeepHtml===html)return false;el.__eduDeepHtml=html;el.innerHTML=html;return true}

  function renderAttendanceCross(){
    const root=$('#attendanceAnalyticsApp');if(!root||!I())return;
    let box=$('#aaAcademicCross');
    if(!box){box=document.createElement('article');box.id='aaAcademicCross';box.className='card';root.appendChild(box)}
    const rows=profiles();
    const attention=rows.filter(x=>x.attendance.percentage!=null&&x.attendance.percentage<75)
      .sort((a,b)=>(a.attendance.percentage??999)-(b.attendance.percentage??999));
    const avgResult=rows.filter(x=>x.results.overall!=null);
    const resultAvg=avgResult.length?Math.round(avgResult.reduce((a,x)=>a+x.results.overall,0)/avgResult.length):null;
    const html='<div class="section-head"><div><div class="academic-kicker">Cross-Module Insight</div><h3>Attendance × Academic Progress</h3><p class="muted">Low attendance ko result average, fee status aur missing work ke context ke sath dekhein.</p></div><div class="paper-actions"><button id="aaCrossCsv" class="secondary">Export Follow-up CSV</button></div></div>'+
      '<div class="pp-stats"><article><span>Accessible Students</span><strong>'+rows.length+'</strong></article><article><span>Below 75%</span><strong>'+attention.length+'</strong></article><article><span>Academic Avg</span><strong>'+(resultAvg==null?'—':resultAvg+'%')+'</strong></article><article><span>Overdue Fee Cases</span><strong>'+rows.filter(x=>x.fees.overdueRows.length).length+'</strong></article></div>'+
      '<div class="list">'+(attention.length?attention.map(x=>'<div class="row"><strong>'+esc(x.student.name)+'</strong><span>'+esc(x.student.className||'-')+'</span><span>Attendance '+x.attendance.percentage+'%</span><span>Academic '+(x.results.overall==null?'—':x.results.overall+'%')+'</span><span>'+x.assignments.missing.length+' missing work · '+x.fees.overdueRows.length+' overdue fee</span></div>').join(''):'<div class="empty-state">Current accessible students mein koi attendance follow-up below 75% nahi hai.</div>')+'</div>';
    if(!setBoxHtml(box,html))return;
    $('#aaCrossCsv').onclick=()=>{
      const lines=[['Student','Class','Attendance %','Academic %','Missing Assignments','Outstanding Fee','Overdue Challans'].map(csv).join(',')];
      rows.forEach(x=>lines.push([x.student.name,x.student.className,x.attendance.percentage??'',x.results.overall??'',x.assignments.missing.length,x.fees.outstanding,x.fees.overdueRows.length].map(csv).join(',')));
      download('edunizam-attendance-academic-followup.csv',lines.join('\n'));
    };
  }

  function renderFeeCross(){
    const root=$('#feeChallanCenter');if(!root||!I())return;
    let box=$('#feeAcademicCross');
    if(!box){box=document.createElement('article');box.id='feeAcademicCross';box.className='card';root.querySelector('.section-head')?.after(box)}
    const rows=profiles(),pending=rows.filter(x=>x.fees.outstanding>0).sort((a,b)=>b.fees.overdueAmount-a.fees.overdueAmount||b.fees.outstanding-a.fees.outstanding);
    if(role()==='head'){
      const html='<div class="section-head"><div><div class="academic-kicker">Family Follow-up</div><h3>Fee Follow-up with Student Context</h3><p class="muted">Collection list ke sath attendance/result context — fee status academic grading ko change nahi karta.</p></div><button id="feeCrossCsv" class="secondary">Export Follow-up CSV</button></div>'+
        '<div class="pp-stats"><article><span>Pending Students</span><strong>'+pending.length+'</strong></article><article><span>Overdue Students</span><strong>'+pending.filter(x=>x.fees.overdueRows.length).length+'</strong></article><article><span>Low Attendance + Pending</span><strong>'+pending.filter(x=>x.attendance.percentage!=null&&x.attendance.percentage<75).length+'</strong></article><article><span>Missing Work + Pending</span><strong>'+pending.filter(x=>x.assignments.missing.length).length+'</strong></article></div>'+
        '<div class="list">'+(pending.length?pending.slice(0,80).map(x=>'<div class="row"><strong>'+esc(x.student.name)+'</strong><span>'+esc(x.student.className||'-')+'</span><span>'+esc(I().money(x.fees.outstanding))+' pending</span><span>Att '+(x.attendance.percentage==null?'—':x.attendance.percentage+'%')+' · Avg '+(x.results.overall==null?'—':x.results.overall+'%')+'</span><span>'+x.fees.overdueRows.length+' overdue</span></div>').join(''):'<div class="empty-state">No pending fee cases in the accessible records.</div>')+'</div>';
      if(!setBoxHtml(box,html))return;
      $('#feeCrossCsv').onclick=()=>{
        const lines=[['Student','Class','Outstanding','Overdue Amount','Overdue Count','Attendance %','Academic %','Missing Work'].map(csv).join(',')];
        pending.forEach(x=>lines.push([x.student.name,x.student.className,x.fees.outstanding,x.fees.overdueAmount,x.fees.overdueRows.length,x.attendance.percentage??'',x.results.overall??'',x.assignments.missing.length].map(csv).join(',')));
        download('edunizam-fee-followup.csv',lines.join('\n'));
      };
    }else{
      const mine=rows;
      const html='<div class="section-head"><div><div class="academic-kicker">Family Finance Snapshot</div><h3>My Fee Status</h3><p class="muted">Linked student challans, outstanding amount aur next due date.</p></div></div><div class="paper-grid">'+
        (mine.length?mine.map(x=>'<article class="paper-card"><h3>'+esc(x.student.name)+'</h3><p><strong>'+esc(I().money(x.fees.outstanding))+'</strong> outstanding · '+x.fees.pendingCount+' pending challan(s)</p><p class="muted">'+(x.fees.nextDue?'Next due: '+esc(x.fees.nextDue.dueDate||'-')+' · '+esc(x.fees.nextDue.feeMonth||''):'No pending due date')+'</p>'+(x.fees.overdueRows.length?'<div class="coverage-note"><strong>'+x.fees.overdueRows.length+' overdue challan(s)</strong></div>':'')+'</article>').join(''):'<div class="empty-state">No linked student record.</div>')+'</div>';
      setBoxHtml(box,html);
    }
  }

  function classReadiness(exam,profiles){
    const cls=String(exam.className||'').trim().toLowerCase(),sec=String(exam.sectionName||'').trim().toLowerCase();
    const rows=profiles.filter(x=>String(x.student.className||'').trim().toLowerCase()===cls&&(!sec||String(x.student.sectionName||'').trim().toLowerCase()===sec));
    const at=rows.filter(x=>x.attendance.percentage!=null),rs=rows.filter(x=>x.results.overall!=null);
    return {count:rows.length,attendance:at.length?Math.round(at.reduce((a,x)=>a+x.attendance.percentage,0)/at.length):null,academic:rs.length?Math.round(rs.reduce((a,x)=>a+x.results.overall,0)/rs.length):null,missing:rows.reduce((a,x)=>a+x.assignments.missing.length,0)};
  }
  function renderExamCross(){
    const root=$('#examCenterApp');if(!root||!I())return;
    let box=$('#examReadinessCross');
    if(!box){box=document.createElement('article');box.id='examReadinessCross';box.className='card';root.prepend(box)}
    const allExams=read('edunizam_exam_schedule_v1',[]).filter(x=>!x.examDate||String(x.examDate)>=I().today()).sort((a,b)=>String(a.examDate||'9999').localeCompare(String(b.examDate||'9999')));
    const ps=profiles();
    if(['head','teacher'].includes(role())){
      const next=allExams.slice(0,12);
      const html='<div class="section-head"><div><div class="academic-kicker">Exam Readiness</div><h3>Upcoming Exam Readiness</h3><p class="muted">Schedule ke sath class attendance, academic baseline aur missing-work signal.</p></div></div>'+
        '<div class="list">'+(next.length?next.map(x=>{const r=classReadiness(x,ps);return '<div class="row"><strong>'+esc(x.subject||'Exam')+'</strong><span>'+esc(x.examDate||'-')+' '+esc(x.startTime||'')+'</span><span>Class '+esc(x.className||'-')+(x.sectionName?' · '+esc(x.sectionName):'')+'</span><span>Att '+(r.attendance==null?'—':r.attendance+'%')+' · Avg '+(r.academic==null?'—':r.academic+'%')+'</span><span>'+r.missing+' missing work item(s)</span></div>'}).join(''):'<div class="empty-state">No upcoming exam schedule.</div>')+'</div>';
      setBoxHtml(box,html);
    }else{
      const html='<div class="section-head"><div><div class="academic-kicker">Exam Readiness</div><h3>My Upcoming Exams</h3><p class="muted">Next papers with current academic and attendance snapshot.</p></div></div><div class="paper-grid">'+
        (ps.length?ps.map(x=>{const next=x.exams.upcoming.slice(0,4);return '<article class="paper-card"><h3>'+esc(x.student.name)+'</h3><p class="muted">Attendance '+(x.attendance.percentage==null?'—':x.attendance.percentage+'%')+' · Academic '+(x.results.overall==null?'—':x.results.overall+'%')+'</p>'+(next.length?next.map(e=>'<div class="coverage-note"><strong>'+esc(e.subject||'Exam')+'</strong><br>'+esc(e.examDate||'-')+' · '+esc(e.startTime||'Time TBA')+(e.roomLabel?' · '+esc(e.roomLabel):'')+'</div>').join(''):'<div class="empty-state">No upcoming exam for this linked class.</div>')+'</article>'}).join(''):'<div class="empty-state">No linked student record.</div>')+'</div>';
      setBoxHtml(box,html);
    }
  }

  function renderProfileCross(){
    const section=$('#studentprofile'),sel=$('#profileStudentSelect');if(!section||!sel||!I())return;
    let box=$('#profileUnifiedActions');
    if(!box){box=document.createElement('article');box.id='profileUnifiedActions';box.className='card';const content=$('#studentProfileContent');content?.appendChild(box)}
    const s=students().find(x=>String(x.id)===String(sel.value));
    if(!s){setBoxHtml(box,'');return}
    const p=I().profile(s);if(!p)return;
    const actions=[];
    if(p.attendance.percentage!=null&&p.attendance.percentage<75)actions.push('Attendance follow-up: current attendance is '+p.attendance.percentage+'%.');
    p.results.weak.slice(0,3).forEach(x=>actions.push('Academic focus: '+x.subject+' is '+x.percentage+'%.'));
    if(p.assignments.missing.length)actions.push('Complete '+p.assignments.missing.length+' missing assignment(s).');
    if(p.exams.next)actions.push('Prepare for '+(p.exams.next.subject||'next exam')+' on '+(p.exams.next.examDate||'scheduled date')+'.');
    if(p.fees.overdueRows.length)actions.push('Review '+p.fees.overdueRows.length+' overdue fee challan(s) in Fee Management.');
    if(!actions.length)actions.push('No urgent cross-module action is currently flagged.');
    const html='<div class="section-head"><div><div class="academic-kicker">Unified Student View</div><h3>Family / Teacher Action Plan</h3><p class="muted">Attendance, results, assignments, exam schedule aur fee status ko ek plan mein combine kiya gaya hai.</p></div><span class="academic-pill">'+p.alerts.length+' alert(s)</span></div>'+
      '<div class="list">'+actions.map((a,i)=>'<div class="row"><strong>'+(i+1)+'</strong><span style="grid-column:span 4">'+esc(a)+'</span></div>').join('')+'</div>'+
      '<div class="paper-actions"><button id="profileGoAttendance" class="secondary">Attendance</button><button id="profileGoResults" class="secondary">Results</button><button id="profileGoFees" class="secondary">Fees</button><button id="profileGoExam" class="secondary">Exams</button><button id="profileGoWork" class="secondary">Assignments</button></div>';
    if(!setBoxHtml(box,html))return;
    $('#profileGoAttendance').onclick=()=>jump('attendanceanalytics');
    $('#profileGoResults').onclick=()=>jump('results');
    $('#profileGoFees').onclick=()=>jump('fees');
    $('#profileGoExam').onclick=()=>jump('examcenter');
    $('#profileGoWork').onclick=()=>jump('schoolwork');
  }

  let t=0;
  function refresh(){
    clearTimeout(t);t=setTimeout(()=>{
      try{renderAttendanceCross()}catch(e){console.warn('attendance cross',e)}
      try{renderFeeCross()}catch(e){console.warn('fee cross',e)}
      try{renderExamCross()}catch(e){console.warn('exam cross',e)}
      try{renderProfileCross()}catch(e){console.warn('profile cross',e)}
    },100);
  }
  const mo=new MutationObserver(refresh);mo.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.matches?.('#profileStudentSelect,#profileTermFilter,#aaMonth,#aaClass'))refresh()},true);
  window.addEventListener('storage',e=>{if(['edunizam_attendance','edunizam_results','edunizam_fees','edunizam_fee_challans_v1','edunizam_exam_schedule_v1','edunizam_school_work_v1'].includes(e.key))refresh()});
  window.addEventListener('edunizam:auth',refresh);
  window.EDUNIZAM_ACADEMIC_OPERATIONS_DEEP={refresh,renderAttendanceCross,renderFeeCross,renderExamCross,renderProfileCross};
  refresh();
})();