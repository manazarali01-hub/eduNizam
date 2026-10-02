(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=(k,fallback)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?fallback:v}catch{return fallback}};
  const students=()=>read('edunizam_students',[]);
  const results=()=>read('edunizam_results',[]);
  const attendance=()=>read('edunizam_attendance',{});
  const settings=()=>read('edunizam_settings',{});
  const session=()=>read('edunizam_session',{});
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const visibleStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students();
  const studentMap=()=>new Map(students().map(s=>[String(s.id),s]));
  const grade=p=>p>=80?'A+':p>=70?'A':p>=60?'B':p>=50?'C':p>=40?'D':'F';
  const pass=p=>p>=40;
  const pct=(m,t)=>t>0?Math.round((Number(m||0)/Number(t||1))*100):0;
  const fmtDate=v=>{try{return new Date(v+'T00:00:00').toLocaleDateString()}catch{return v||'-'}};
  const canSeeAll=()=>['head','teacher'].includes(role());
  let state={student:'',type:'',subject:'',search:'',from:'',to:'',reportStudent:'',reportType:''};

  function scopedResults(){
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return results().filter(r=>ids.has(String(r.studentId)));
  }

  function unique(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));}

  function attendanceSummary(studentId){
    const rows=attendance();
    let present=0,absent=0,late=0,leave=0,total=0;
    Object.values(rows||{}).forEach(day=>{
      const v=day?.[studentId] ?? day?.[String(studentId)];
      if(v==null)return;
      const n=String(v).toLowerCase();
      if(n.startsWith('p')){present++;total++}
      else if(n.startsWith('a')){absent++;total++}
      else if(n.startsWith('l')&&n!=='leave'){late++;total++}
      else if(n.includes('leave'))leave++;
    });
    return {present,absent,late,leave,total,percentage:total?Math.round(((present+late)/total)*100):null};
  }

  function filterRows(){
    const sm=studentMap();
    const q=state.search.trim().toLowerCase();
    return scopedResults().filter(r=>{
      const s=sm.get(String(r.studentId))||{};
      if(state.student&&String(r.studentId)!==state.student)return false;
      if(state.type&&String(r.type||'Result')!==state.type)return false;
      if(state.subject&&String(r.subject||'')!==state.subject)return false;
      if(state.from&&String(r.date||'')<state.from)return false;
      if(state.to&&String(r.date||'')>state.to)return false;
      if(q&&!([s.name,s.className,s.sectionName,r.subject,r.type,r.date].join(' ').toLowerCase().includes(q)))return false;
      return true;
    }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.id||0)-Number(a.id||0));
  }

  function statSummary(rows){
    const totalMarks=rows.reduce((a,r)=>a+Number(r.total||0),0);
    const obtained=rows.reduce((a,r)=>a+Number(r.marks||0),0);
    const avg=totalMarks?Math.round(obtained/totalMarks*100):0;
    const passed=rows.filter(r=>pass(pct(r.marks,r.total))).length;
    return {avg,passed,passRate:rows.length?Math.round(passed/rows.length*100):0,students:new Set(rows.map(r=>String(r.studentId))).size};
  }

  function reportHtml(studentId,type){
    const s=studentMap().get(String(studentId));
    if(!s)return '<div class="empty-state">Student record not found.</div>';
    const rows=scopedResults().filter(r=>String(r.studentId)===String(studentId)&&(!type||String(r.type||'Result')===type));
    if(!rows.length)return '<div class="empty-state">Selected student ke liye result records available nahi hain.</div>';
    const grouped=new Map();
    rows.forEach(r=>{
      const key=String(r.subject||'Subject');
      const g=grouped.get(key)||{subject:key,marks:0,total:0,count:0};
      g.marks+=Number(r.marks||0);g.total+=Number(r.total||0);g.count++;grouped.set(key,g);
    });
    const subjects=[...grouped.values()].map(g=>({...g,percentage:pct(g.marks,g.total)})).sort((a,b)=>b.percentage-a.percentage);
    const obtained=subjects.reduce((a,x)=>a+x.marks,0),total=subjects.reduce((a,x)=>a+x.total,0),overall=pct(obtained,total);
    const best=subjects[0],weak=subjects[subjects.length-1];
    const att=attendanceSummary(studentId);
    const st=settings();
    const attText=att.percentage==null?'No attendance data':att.percentage+'% ('+att.present+' P / '+att.absent+' A'+(att.late?' / '+att.late+' Late':'')+')';
    const typeLabel=type||'Combined Results';
    return '<article id="resultDeepPrintable" class="card">'+
      '<div class="section-head"><div><div class="academic-kicker">'+esc(st.schoolName||'EduNizam Institute')+'</div><h2>Academic Progress Report</h2><p class="muted">'+esc(typeLabel)+(st.session?' · '+esc(st.session):'')+'</p></div><span class="academic-pill">Grade '+grade(overall)+'</span></div>'+
      '<div class="paper-meta"><span><strong>Student:</strong> '+esc(s.name||'Student')+'</span><span><strong>Class:</strong> '+esc(s.className||'-')+(s.sectionName?' · '+esc(s.sectionName):'')+'</span><span><strong>Guardian:</strong> '+esc(s.father||s.guardianName||'-')+'</span></div>'+
      '<div class="cards" style="margin-top:14px"><article class="card stat"><span>Overall</span><strong>'+overall+'%</strong></article><article class="card stat"><span>Status</span><strong>'+(pass(overall)?'Pass':'Needs Support')+'</strong></article><article class="card stat"><span>Attendance</span><strong>'+esc(attText)+'</strong></article><article class="card stat"><span>Subjects</span><strong>'+subjects.length+'</strong></article></div>'+
      '<div class="list" style="margin-top:14px">'+subjects.map(x=>'<div class="row"><strong>'+esc(x.subject)+'</strong><span>'+x.marks+'/'+x.total+'</span><span>'+x.percentage+'%</span><span>'+grade(x.percentage)+'</span><span>'+(pass(x.percentage)?'Pass':'Needs Support')+'</span></div>').join('')+'</div>'+
      '<div class="analytics-grid" style="margin-top:14px"><article class="card"><h3>Academic Highlights</h3><p><strong>Strongest subject:</strong> '+esc(best?.subject||'-')+(best?' · '+best.percentage+'%':'')+'</p><p><strong>Needs most focus:</strong> '+esc(weak?.subject||'-')+(weak?' · '+weak.percentage+'%':'')+'</p></article><article class="card"><h3>Teacher / Parent Discussion</h3><p class="muted">Use this summary during PTM or student progress review. Attendance and subject performance are shown together so support areas are easier to identify.</p></article></div>'+
      '<div class="paper-meta" style="margin-top:28px"><span>Class Teacher Signature: __________________</span><span>Head Signature: __________________</span><span>Parent Signature: __________________</span></div>'+
      '</article>';
  }

  function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
  function exportCsv(){
    const sm=studentMap(),rows=filterRows();
    if(!rows.length)return alert('Export ke liye koi result record nahi hai.');
    const lines=[['Student','Class','Section','Subject','Exam Type','Date','Marks','Total','Percentage','Grade','Status'].map(csvEscape).join(',')];
    rows.forEach(r=>{
      const s=sm.get(String(r.studentId))||{},p=pct(r.marks,r.total);
      lines.push([s.name||'',s.className||'',s.sectionName||'',r.subject||'',r.type||'Result',r.date||'',r.marks||0,r.total||0,p,grade(p),pass(p)?'Pass':'Needs Support'].map(csvEscape).join(','));
    });
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='edunizam-results-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);
  }

  function printReport(){
    const card=$('resultDeepPrintable');if(!card)return alert('Pehle student report build karein.');
    const w=window.open('','_blank','width=980,height=760');if(!w)return alert('Popup blocked. Browser mein popups allow karein.');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>EduNizam Academic Progress Report</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17324a}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.paper-meta{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{border:1px solid #d9e2e7;border-radius:12px;padding:14px}.stat strong{display:block;font-size:20px;margin-top:5px}.row{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:10px;padding:9px 0;border-bottom:1px solid #e6ecef}.muted{color:#667}.academic-kicker{font-weight:700;color:#0f766e}.academic-pill{border:1px solid #cbd5db;border-radius:999px;padding:7px 11px}.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media print{body{padding:0}.card{break-inside:avoid}}</style></head><body>'+card.outerHTML+'</body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  function bind(root){
    const on=(id,event,fn)=>$(id)?.addEventListener(event,fn);
    on('rdStudent','change',e=>{state.student=e.target.value;render()});
    on('rdType','change',e=>{state.type=e.target.value;render()});
    on('rdSubject','change',e=>{state.subject=e.target.value;render()});
    on('rdFrom','change',e=>{state.from=e.target.value;render()});
    on('rdTo','change',e=>{state.to=e.target.value;render()});
    on('rdSearch','input',e=>{state.search=e.target.value;clearTimeout(bind.t);bind.t=setTimeout(render,170)});
    on('rdClear','click',()=>{state={...state,student:'',type:'',subject:'',search:'',from:'',to:''};render()});
    on('rdExport','click',exportCsv);
    on('rdReportStudent','change',e=>{state.reportStudent=e.target.value;renderReportOnly()});
    on('rdReportType','change',e=>{state.reportType=e.target.value;renderReportOnly()});
    on('rdBuildReport','click',renderReportOnly);
    on('rdPrintReport','click',printReport);
  }

  function renderReportOnly(){
    const target=$('rdReportOutput');if(!target)return;
    const sid=$('rdReportStudent')?.value||state.reportStudent;
    const type=$('rdReportType')?.value||state.reportType;
    state.reportStudent=sid;state.reportType=type;
    target.innerHTML=sid?reportHtml(sid,type):'<div class="empty-state">Student select karke academic report build karein.</div>';
  }

  function render(){
    const section=$('results');if(!section)return;
    let root=$('resultDeepCenter');
    if(!root){root=document.createElement('div');root.id='resultDeepCenter';root.style.marginTop='18px';section.appendChild(root)}
    const rows=scopedResults(),filtered=filterRows(),sm=studentMap(),summary=statSummary(filtered);
    const types=unique(rows.map(r=>r.type||'Result')),subjects=unique(rows.map(r=>r.subject));
    const vis=visibleStudents();
    if(!state.reportStudent&&vis.length===1)state.reportStudent=String(vis[0].id);
    root.innerHTML='<article class="card"><div class="section-head"><div><div class="academic-kicker">Result Intelligence</div><h3>Deep Result Analysis</h3><p class="muted">Search, filters, pass-rate, student progress report, attendance context, print aur CSV export.</p></div><div class="paper-actions"><button id="rdExport" class="secondary">Export CSV</button></div></div>'+
      '<div class="pp-stats"><article><span>Records</span><strong>'+filtered.length+'</strong></article><article><span>Average</span><strong>'+summary.avg+'%</strong></article><article><span>Pass Rate</span><strong>'+summary.passRate+'%</strong></article><article><span>Students</span><strong>'+summary.students+'</strong></article></div>'+
      '<div class="form-grid"><select id="rdStudent"><option value="">All Students</option>'+vis.map(s=>'<option value="'+esc(s.id)+'" '+(state.student===String(s.id)?'selected':'')+'>'+esc(s.name)+' · '+esc(s.className||'-')+'</option>').join('')+'</select><select id="rdType"><option value="">All Exam Types</option>'+types.map(v=>'<option '+(state.type===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><select id="rdSubject"><option value="">All Subjects</option>'+subjects.map(v=>'<option '+(state.subject===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><input id="rdFrom" type="date" value="'+esc(state.from)+'" aria-label="From date"><input id="rdTo" type="date" value="'+esc(state.to)+'" aria-label="To date"><input id="rdSearch" type="search" value="'+esc(state.search)+'" placeholder="Search student, class, subject"><button id="rdClear" class="secondary">Clear Filters</button></div>'+
      '<div class="list" style="margin-top:14px">'+(filtered.length?filtered.slice(0,150).map(r=>{const s=sm.get(String(r.studentId))||{},p=pct(r.marks,r.total);return '<div class="row"><strong>'+esc(s.name||'Student')+'</strong><span>'+esc(s.className||'-')+(s.sectionName?' · '+esc(s.sectionName):'')+'</span><span>'+esc(r.subject||'-')+'</span><span>'+esc(r.type||'Result')+'</span><span>'+Number(r.marks||0)+'/'+Number(r.total||0)+' · '+p+'% · '+grade(p)+'</span></div>'}).join(''):'<div class="empty-state">Is filter ke liye result records nahi hain.</div>')+'</div></article>'+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Student Academic Progress Report</h3><p class="muted">Results + attendance context ke sath printable parent-ready report.</p></div><div class="paper-actions"><button id="rdPrintReport" class="secondary">Print / Save PDF</button></div></div><div class="form-grid"><select id="rdReportStudent"><option value="">Select student</option>'+vis.map(s=>'<option value="'+esc(s.id)+'" '+(state.reportStudent===String(s.id)?'selected':'')+'>'+esc(s.name)+' · '+esc(s.className||'-')+'</option>').join('')+'</select><select id="rdReportType"><option value="">Combined Results</option>'+types.map(v=>'<option '+(state.reportType===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><button id="rdBuildReport">Build Report</button></div><div id="rdReportOutput" style="margin-top:14px"></div></article>';
    bind(root);renderReportOnly();
  }

  function attachResultObserver(){
    const list=$('resultList');
    if(!list||list.dataset.deepResultObserved)return;
    list.dataset.deepResultObserved='1';
    const observer=new MutationObserver(()=>{clearTimeout(attachResultObserver.t);attachResultObserver.t=setTimeout(render,80)});
    observer.observe(list,{childList:true,subtree:true,characterData:true});
  }
  window.addEventListener('edunizam:auth',()=>{render();attachResultObserver()});
  window.addEventListener('storage',e=>{if(['edunizam_results','edunizam_students','edunizam_attendance'].includes(e.key))render()});
  setTimeout(()=>{render();attachResultObserver()},0);setTimeout(()=>{render();attachResultObserver()},700);
  window.EDUNIZAM_RESULT_CENTER={render,exportCsv,reportHtml};
})();