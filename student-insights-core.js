(function(){
  'use strict';
  if(window.EDUNIZAM_STUDENT_INSIGHTS)return;

  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch{return f}};
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const attendance=()=>read('edunizam_attendance',{});
  const results=()=>read('edunizam_results',[]);
  const legacyFees=()=>read('edunizam_fees',[]);
  const challans=()=>read('edunizam_fee_challans_v1',[]);
  const exams=()=>read('edunizam_exam_schedule_v1',[]);
  const schoolWork=()=>read('edunizam_school_work_v1',{homework:[],submissions:[]});
  const practice=()=>read('edunizam_practice_history',[]);

  function attendanceSummary(studentId){
    const c={Present:0,Absent:0,Leave:0,Late:0,marked:0,percentage:null};
    Object.values(attendance()).forEach(day=>{
      const v=day?.[studentId]??day?.[String(studentId)];
      if(v==null)return;
      const s=String(v).trim().toLowerCase();
      if(s==='present'||s.startsWith('p'))c.Present++;
      else if(s==='absent'||s.startsWith('a'))c.Absent++;
      else if(s==='leave'||s.includes('leave'))c.Leave++;
      else if(s==='late'||s.startsWith('l'))c.Late++;
      else c.Absent++;
    });
    c.marked=c.Present+c.Absent+c.Leave+c.Late;
    const denom=c.Present+c.Late+c.Absent;
    c.percentage=denom?Math.round(((c.Present+c.Late)/denom)*100):null;
    return c;
  }

  function resultSummary(studentId){
    const rows=results().filter(r=>String(r.studentId)===String(studentId));
    const marks=rows.reduce((a,r)=>a+Number(r.marks||0),0),total=rows.reduce((a,r)=>a+Number(r.total||0),0);
    const overall=total?Math.round(marks/total*100):null;
    const subjects=new Map();
    rows.forEach(r=>{
      const k=String(r.subject||'Subject'),x=subjects.get(k)||{subject:k,marks:0,total:0,count:0};
      x.marks+=Number(r.marks||0);x.total+=Number(r.total||0);x.count++;subjects.set(k,x);
    });
    const subjectRows=[...subjects.values()].map(x=>({...x,percentage:x.total?Math.round(x.marks/x.total*100):0})).sort((a,b)=>a.percentage-b.percentage);
    return {rows,overall,subjects:subjectRows,weak:subjectRows.filter(x=>x.percentage<60),strongest:subjectRows.length?[...subjectRows].sort((a,b)=>b.percentage-a.percentage)[0]:null};
  }

  function feeSummary(studentId){
    const detailed=challans().filter(x=>String(x.studentId)===String(studentId));
    const useDetailed=detailed.length>0;
    const rows=useDetailed?detailed:legacyFees().filter(x=>String(x.studentId)===String(studentId)).map(x=>({
      id:x.id,studentId:x.studentId,totalAmount:Number(x.amount||0),status:x.status||'Pending',
      dueDate:x.date||'',feeMonth:x.feeMonth||'',challanNo:x.challanNo||'',receiptNo:x.receiptNo||''
    }));
    const paid=rows.filter(x=>String(x.status).toLowerCase()==='paid').reduce((a,x)=>a+Number(x.totalAmount??x.amount??0),0);
    const pendingRows=rows.filter(x=>String(x.status).toLowerCase()!=='paid');
    const outstanding=pendingRows.reduce((a,x)=>a+Number(x.totalAmount??x.amount??0),0);
    const overdueRows=pendingRows.filter(x=>x.dueDate&&String(x.dueDate)<today());
    const nextDue=[...pendingRows].filter(x=>x.dueDate).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)))[0]||null;
    return {rows,paid,outstanding,pendingCount:pendingRows.length,overdueRows,overdueAmount:overdueRows.reduce((a,x)=>a+Number(x.totalAmount??x.amount??0),0),nextDue};
  }

  function examSummary(student){
    if(!student)return {upcoming:[],next:null};
    const cls=String(student.className||'').trim().toLowerCase(),sec=String(student.sectionName||'').trim().toLowerCase();
    const rows=exams().filter(x=>{
      if(String(x.className||'').trim().toLowerCase()!==cls)return false;
      const xs=String(x.sectionName||'').trim().toLowerCase();
      if(xs&&sec&&xs!==sec)return false;
      return !x.examDate||String(x.examDate)>=today();
    }).sort((a,b)=>String(a.examDate||'9999').localeCompare(String(b.examDate||'9999'))||String(a.startTime||'').localeCompare(String(b.startTime||'')));
    return {upcoming:rows,next:rows[0]||null};
  }

  function assignmentSummary(studentId){
    const d=schoolWork(),homework=d.homework||[],subs=d.submissions||[];
    const sid=String(studentId);
    const relevant=homework.filter(h=>{
      const s=(read('edunizam_students',[]).find(x=>String(x.id)===sid)||{});
      if(String(h.className||'').trim()!==String(s.className||'').trim())return false;
      if(h.sectionName&&String(h.sectionName||'').trim().toLowerCase()!==String(s.sectionName||'').trim().toLowerCase())return false;
      return true;
    });
    const my=subs.filter(s=>String(s.studentId)===sid);
    const submittedIds=new Set(my.map(s=>String(s.homeworkId)));
    const missing=relevant.filter(h=>!submittedIds.has(String(h.id)) && (!h.dueDate||String(h.dueDate)<=today()));
    const dueSoon=relevant.filter(h=>!submittedIds.has(String(h.id))&&h.dueDate&&String(h.dueDate)>=today()).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).slice(0,5);
    return {relevant,submissions:my,missing,dueSoon};
  }

  function practiceSummary(studentId){
    const rows=practice().filter(x=>String(x.studentId)===String(studentId));
    const avg=rows.length?Math.round(rows.reduce((a,x)=>a+Number(x.pct||0),0)/rows.length):null;
    return {rows,average:avg};
  }

  function profile(student){
    if(!student)return null;
    const attendance=attendanceSummary(student.id),results=resultSummary(student.id),fees=feeSummary(student.id),exams=examSummary(student),assignments=assignmentSummary(student.id),practice=practiceSummary(student.id);
    const alerts=[];
    if(attendance.percentage!=null&&attendance.percentage<75)alerts.push({kind:'attendance',level:attendance.percentage<60?'high':'medium',text:'Attendance '+attendance.percentage+'%'});
    if(results.overall!=null&&results.overall<60)alerts.push({kind:'results',level:results.overall<50?'high':'medium',text:'Academic average '+results.overall+'%'});
    if(fees.overdueRows.length)alerts.push({kind:'fees',level:'high',text:fees.overdueRows.length+' overdue fee challan(s)'});
    else if(fees.outstanding>0)alerts.push({kind:'fees',level:'medium',text:'Fee balance pending'});
    if(assignments.missing.length)alerts.push({kind:'schoolwork',level:'medium',text:assignments.missing.length+' missing assignment(s)'});
    return {student,attendance,results,fees,exams,assignments,practice,alerts};
  }

  function money(v){
    const s=read('edunizam_settings',{}),currency=s.currency||'PKR',locale=s.locale||'en-PK';
    try{return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:0}).format(Number(v||0))}
    catch{return currency+' '+Number(v||0).toLocaleString()}
  }

  window.EDUNIZAM_STUDENT_INSIGHTS={today,attendanceSummary,resultSummary,feeSummary,examSummary,assignmentSummary,practiceSummary,profile,money};
})();