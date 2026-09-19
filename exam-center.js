(function(){
  const KEY='edunizam_exam_schedule_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'');
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const canEdit=()=>['teacher','head'].includes(role());
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function readSchedule(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function writeSchedule(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function results(){try{return JSON.parse(localStorage.getItem('edunizam_results')||'[]')}catch{return[]}}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function visibleClasses(){
    if(canEdit())return null;
    return new Set(visibleStudents().map(s=>String(s.className||'').trim()).filter(Boolean));
  }
  function classVisible(c){const set=visibleClasses();return set===null||set.has(String(c||'').trim())}
  function mine(x){return role()==='head'||String(x.createdBy||'')===identity()}
  function grade(p){if(p>=80)return'A+';if(p>=70)return'A';if(p>=60)return'B';if(p>=50)return'C';if(p>=40)return'D';return'F'}

  async function pullCloud(){
    if(!cloudReady())return readSchedule();
    const {data,error}=await cloud().state.client.from('exam_schedule_entries').select('*').eq('institution_id',cfg().institutionId).order('exam_date').order('start_time');
    if(error)throw error;
    const mapped=(data||[]).map(x=>({id:x.id,className:x.class_name,examName:x.exam_name,subject:x.subject,examDate:x.exam_date,startTime:x.start_time?String(x.start_time).slice(0,5):'',totalMarks:Number(x.total_marks||0),createdBy:x.creator_user_id,createdAt:x.created_at}));
    writeSchedule(mapped);return mapped;
  }
  async function insertCloud(x){
    if(!cloudReady())return null;
    const c=cloud();
    const {data,error}=await c.state.client.from('exam_schedule_entries').insert({
      institution_id:cfg().institutionId,creator_user_id:c.state.user.id,class_name:x.className,
      exam_name:x.examName,subject:x.subject,exam_date:x.examDate,start_time:x.startTime||null,total_marks:Number(x.totalMarks||0)
    }).select().single();
    if(error)throw error;return data;
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('exam_schedule_entries').delete().eq('id',id);
    if(error)throw error;
  }

  function scheduleEditor(){
    if(!canEdit())return '<div class="coverage-note">Read-only exam schedule. Teacher/Head schedule create karte hain.</div>';
    return '<article class="card"><h3>Add Exam Schedule</h3><div class="form-grid">'+
      '<input id="exClass" placeholder="Class e.g. 5">'+
      '<select id="exName"><option>Monthly Test</option><option>Midterm</option><option>Final</option><option>Quiz</option><option>Other</option></select>'+
      '<input id="exSubject" placeholder="Subject">'+
      '<input id="exDate" type="date" value="'+today()+'">'+
      '<input id="exTime" type="time">'+
      '<input id="exTotal" type="number" min="1" value="100" placeholder="Total marks">'+
      '<button id="saveExamSchedule">Add Schedule</button></div></article>';
  }
  function scheduleCard(x){
    const del=canEdit()&&mine(x)?'<button class="secondary" data-ex-delete="'+esc(x.id)+'">Delete</button>':'';
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">Class '+esc(x.className)+'</span><span class="mini-badge">'+esc(x.examName)+'</span></div>'+
      '<h3>'+esc(x.subject)+'</h3><p class="muted">'+esc(x.examDate)+(x.startTime?' · '+esc(x.startTime):'')+'</p>'+
      '<p>Total Marks: '+Number(x.totalMarks||0)+'</p><div class="paper-actions">'+del+'</div></article>';
  }

  function reportControls(){
    const list=visibleStudents();
    if(!list.length)return '<div class="empty-state">Aap ke role ke liye koi accessible student record nahi mila.</div>';
    const types=[...new Set(results().map(r=>r.type||'Result').filter(Boolean))];
    return '<article class="card"><h3>Generate Report Card</h3><div class="form-grid">'+
      '<select id="rcStudent">'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · Class '+esc(s.className||'-')+'</option>').join('')+'</select>'+
      '<select id="rcType"><option value="">All Results</option>'+types.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select>'+
      '<button id="buildReportCard">Build Report Card</button>'+
      '<button id="printReportCard" class="secondary">Print</button></div><div id="reportCardOutput" style="margin-top:14px"></div></article>';
  }

  function buildReport(){
    const sid=Number($('rcStudent')?.value),type=$('rcType')?.value||'';
    const s=students().find(x=>Number(x.id)===sid);if(!s)return;
    const rows=results().filter(r=>Number(r.studentId)===sid&&(!type||(r.type||'Result')===type));
    const out=$('reportCardOutput');if(!out)return;
    if(!rows.length){out.innerHTML='<div class="empty-state">Is selection ke liye result records available nahi hain.</div>';return}
    const obt=rows.reduce((a,r)=>a+Number(r.marks||0),0),tot=rows.reduce((a,r)=>a+Number(r.total||0),0),pct=tot?Math.round(obt/tot*100):0;
    const st=settings();
    out.innerHTML='<div id="printableReportCard" class="card">'+
      '<div class="section-head"><div><div class="academic-kicker">'+esc(st.schoolName||'EduNizam Institute')+'</div><h2>Student Report Card</h2><p class="muted">'+esc(type||'Combined Results')+(st.session?' · '+esc(st.session):'')+'</p></div><span class="academic-pill">Grade '+grade(pct)+'</span></div>'+
      '<div class="paper-meta"><span><strong>Student:</strong> '+esc(s.name)+'</span><span><strong>Class:</strong> '+esc(s.className||'-')+'</span><span><strong>Guardian:</strong> '+esc(s.father||'-')+'</span></div>'+
      '<div class="list" style="margin-top:14px">'+rows.map(r=>{const p=Math.round(Number(r.marks||0)/Number(r.total||1)*100);return '<div class="row"><strong>'+esc(r.subject)+'</strong><span>'+esc(r.type||'Result')+'</span><span>'+Number(r.marks||0)+'/'+Number(r.total||0)+'</span><span>'+p+'% · '+grade(p)+'</span><span></span></div>'}).join('')+'</div>'+
      '<div class="cards" style="margin-top:14px"><article class="card stat"><span>Obtained</span><strong>'+obt+'</strong></article><article class="card stat"><span>Total</span><strong>'+tot+'</strong></article><article class="card stat"><span>Percentage</span><strong>'+pct+'%</strong></article><article class="card stat"><span>Grade</span><strong>'+grade(pct)+'</strong></article></div>'+
      '</div>';
  }

  function printReport(){
    const card=$('printableReportCard');if(!card)return alert('Pehle report card build karein.');
    const w=window.open('','_blank','width=900,height=700');if(!w)return alert('Popup blocked. Browser mein popups allow karein.');
    w.document.write('<!doctype html><html><head><title>EduNizam Report Card</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#17324a}.row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;padding:10px;border-bottom:1px solid #ddd}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{border:1px solid #d8e2e7;border-radius:12px;padding:14px}.muted{color:#667}.academic-pill{padding:6px 10px;border:1px solid #ccc;border-radius:999px}@media print{button{display:none}}</style></head><body>'+card.innerHTML+'</body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  async function saveSchedule(){
    const className=$('exClass')?.value.trim(),examName=$('exName')?.value,subject=$('exSubject')?.value.trim(),examDate=$('exDate')?.value,startTime=$('exTime')?.value,totalMarks=Number($('exTotal')?.value||0);
    if(!className||!subject||!examDate||totalMarks<=0)return alert('Class, subject, date aur total marks complete karein.');
    let item={id:String(Date.now()),className,examName,subject,examDate,startTime,totalMarks,createdBy:identity(),createdAt:new Date().toISOString()};
    try{const row=await insertCloud(item);if(row)item={id:row.id,className:row.class_name,examName:row.exam_name,subject:row.subject,examDate:row.exam_date,startTime:row.start_time?String(row.start_time).slice(0,5):'',totalMarks:Number(row.total_marks||0),createdBy:row.creator_user_id,createdAt:row.created_at}}catch(e){alert('Cloud sync failed; schedule local mode mein save hoga. '+(e.message||e))}
    const arr=readSchedule();arr.push(item);writeSchedule(arr);render();
  }
  async function removeSchedule(id){
    const arr=readSchedule(),item=arr.find(x=>String(x.id)===String(id));if(!item||!mine(item))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    writeSchedule(arr.filter(x=>String(x.id)!==String(id)));render();
  }

  function bind(){
    if($('saveExamSchedule'))$('saveExamSchedule').onclick=saveSchedule;
    if($('buildReportCard'))$('buildReportCard').onclick=buildReport;
    if($('printReportCard'))$('printReportCard').onclick=printReport;
    document.querySelectorAll('[data-ex-delete]').forEach(b=>b.onclick=()=>removeSchedule(b.dataset.exDelete));
  }

  async function render(){
    const root=$('examCenterApp');if(!root)return;
    let schedule=readSchedule();
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{schedule=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Exam schedule cloud sync:',e.message)}
    }
    schedule=schedule.filter(x=>classVisible(x.className)).sort((a,b)=>String(a.examDate).localeCompare(String(b.examDate))||String(a.startTime).localeCompare(String(b.startTime)));
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      scheduleEditor()+
      '<div class="section-head" style="margin-top:18px"><div><h3>Exam Schedule</h3><p class="muted">Relevant class schedule.</p></div></div>'+
      '<div class="paper-grid">'+(schedule.length?schedule.map(scheduleCard).join(''):'<div class="empty-state">Abhi koi relevant exam schedule nahi hai.</div>')+'</div>'+
      '<div style="margin-top:20px">'+reportControls()+'</div>';
    bind();
  }

  window.addEventListener('edunizam:auth',()=>{const root=$('examCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,800);
  window.EDUNIZAM_EXAM_CENTER={render,pullCloud,readSchedule,cloudReady};
})();