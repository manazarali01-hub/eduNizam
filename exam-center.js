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
  const actorId=()=>String(cloud()?.state?.user?.id||identity());
  let examScheduleSaveInFlight=false;
  const examScheduleDeleteInFlight=new Set();
  let directoryRows=[],directoryScope='',directoryLoaded=false,loadedScheduleScope='';
  let examUnits=[],examUnitsScope='',examUnitsState='unchecked',examUnitsLoadedAt=0,examUnitsJob=null;
  const currentDirectoryScope=()=>String(cfg().institutionId||'')+'|'+String(cloud()?.state?.user?.id||'');
  const registeredSections=()=>{
    let rows=[];
    if(cloudReady()){
      if(directoryLoaded&&directoryScope===currentDirectoryScope())rows=directoryRows;
    }else{
      try{rows=JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]')}catch(_){}
    }
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    return api?.registeredSections?.(rows)||[];
  };
  function editorClassOptions(){
    if(role()!=='head')return [...(visibleClasses()||[])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    return api?.distinct?.(registeredSections().map(x=>x.className))||[];
  }
  function headKnownClass(cls,section){
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    const rows=registeredSections();
    return rows.some(x=>api?.sameClass?.(x.className,cls))&&(!String(section||'').trim()||api?.sectionMatches?.(cls,section,rows));
  }
  async function loadClassDirectory(force=false){
    if(!cloudReady()||role()!=='head')return;
    const scope=currentDirectoryScope(),inst=cfg().institutionId,client=cloud().state.client;
    if(!force&&directoryLoaded&&directoryScope===scope)return;
    directoryRows=[];directoryLoaded=false;directoryScope='';
    try{
      const data=await runCloud('exam:class-directory:'+scope,'Exam class directory',async({signal}={})=>{
        let q=client.from('class_sections').select('class_name,section_name,active')
          .eq('institution_id',inst).eq('active',true).limit(1200);
        q=withSignal(q,signal);
        const {data,error}=await q;if(error)throw error;return data||[];
      },{timeout:6500,retries:0});
      if(currentDirectoryScope()!==scope||!cloudReady())return;
      directoryRows=data.map(x=>({className:x.class_name,sectionName:x.section_name,active:x.active!==false}));
      directoryScope=scope;directoryLoaded=true;
    }catch(error){console.warn('Exam class directory unavailable:',error?.message||error)}
  }
  async function loadExamSubjects(force=false){
    if(!cloudReady()||!canEdit())return;
    const scope=currentDirectoryScope(),inst=cfg().institutionId,client=cloud().state.client;
    if(!force&&examUnitsScope===scope&&examUnitsState==='loaded'&&Date.now()-examUnitsLoadedAt<30000)return;
    if(examUnitsJob?.scope===scope)return examUnitsJob.promise;
    examUnits=[];examUnitsScope='';examUnitsState='unchecked';
    const promise=(async()=>{
      try{
        const data=await runCloud('exam:syllabus-subjects:'+scope,'Exam school syllabus',async({signal}={})=>{
          let q=client.from('syllabus_progress_units').select('class_name,subject,unit_title')
            .eq('institution_id',inst).limit(1500);
          q=withSignal(q,signal);
          const {data,error}=await q;
          if(error)throw error;
          return Array.isArray(data)?data:[];
        },{timeout:6500,retries:0});
        if(!cloudReady()||currentDirectoryScope()!==scope)return;
        examUnits=data.filter(x=>String(x.class_name||'').trim()&&String(x.subject||'').trim()).map(x=>({
          className:x.class_name,subject:x.subject,unitTitle:x.unit_title||''
        }));
        examUnitsScope=scope;examUnitsState='loaded';examUnitsLoadedAt=Date.now();
      }catch(error){
        if(currentDirectoryScope()!==scope)return;
        examUnits=[];examUnitsScope=scope;examUnitsState='error';examUnitsLoadedAt=0;
        console.warn('Exam syllabus subject lookup unavailable:',error?.message||error);
      }
    })();
    examUnitsJob={scope,promise};
    try{await promise}finally{if(examUnitsJob?.promise===promise)examUnitsJob=null}
  }
  function withSignal(q,signal){return signal&&typeof q?.abortSignal==='function'?q.abortSignal(signal):q}
  async function runCloud(key,label,factory,{timeout=7000,retries=1}={}){
    const runtime=window.EDUNIZAM_DATA_RUNTIME;
    return runtime?runtime.run(key,factory,{timeout,retries,label}):factory({});
  }
  function setBusy(btn,busy,label='Working...'){
    if(!btn)return;
    if(busy){
      if(!btn.dataset.busyLabel)btn.dataset.busyLabel=btn.textContent||'';
      btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent=label;
    }else{
      btn.disabled=false;btn.removeAttribute('aria-busy');
      if(btn.dataset.busyLabel!==undefined){btn.textContent=btn.dataset.busyLabel;delete btn.dataset.busyLabel}
    }
  }
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function readSchedule(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function writeSchedule(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function results(){try{return JSON.parse(localStorage.getItem('edunizam_results')||'[]')}catch{return[]}}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  // A report-card selector may only display authorized school/role students.
  // Missing scope must never mean "all students", even in cached local mode.
  function visibleStudents(){
    const rows=window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students());
    return Array.isArray(rows)?rows.filter(x=>x&&x.id!==null&&x.id!==undefined&&String(x.id).trim()&&String(x.name||'').trim()):[];
  }
  function visibleClasses(){
    if(role()==='head')return null;
    return new Set(visibleStudents().map(s=>String(s.className||'').trim()).filter(Boolean));
  }
  function classVisible(c){const set=visibleClasses();return set===null||set.has(String(c||'').trim())}
  function teacherCanManageClassSection(className,sectionName){
    if(role()==='head')return true;
    if(role()!=='teacher')return false;
    const cls=String(className||'').trim().toLowerCase(),sec=String(sectionName||'').trim().toLowerCase();
    return visibleStudents().some(s=>
      String(s.className||'').trim().toLowerCase()===cls&&
      String(s.sectionName||'').trim().toLowerCase()===sec
    );
  }
  function mine(x){return role()==='head'||String(x.createdBy||'')===actorId()}
  let editingScheduleId='';
  function grade(p){if(p>=80)return'A+';if(p>=70)return'A';if(p>=60)return'B';if(p>=50)return'C';if(p>=40)return'D';return'F'}

  async function pullCloud(){
    if(!cloudReady())return readSchedule();
    const inst=cfg().institutionId,scope=currentDirectoryScope();
    const result=await runCloud('exam-schedule-load:'+scope,'Exam schedule',async({signal}={})=>{
      let q=cloud().state.client.from('exam_schedule_entries').select('*').eq('institution_id',inst).order('exam_date').order('start_time');
      q=withSignal(q,signal);const out=await q;if(out.error)throw out.error;return out;
    },{timeout:7000,retries:1});
    const mapped=(result.data||[]).map(x=>({id:x.id,className:x.class_name,sectionName:x.section_name||'',examName:x.exam_name,subject:x.subject,examDate:x.exam_date,startTime:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',totalMarks:Number(x.total_marks||0),roomLabel:x.room_label||'',notes:x.notes||'',createdBy:x.creator_user_id,createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}));
    if(!cloudReady()||scope!==currentDirectoryScope())return[];
    writeSchedule(mapped);loadedScheduleScope=scope;return mapped;
  }
  async function insertCloud(x){
    if(!cloudReady())return null;
    const c=cloud(),inst=cfg().institutionId,payload={
      institution_id:inst,creator_user_id:c.state.user.id,class_name:x.className,
      exam_name:x.examName,subject:x.subject,exam_date:x.examDate,start_time:x.startTime||null,end_time:x.endTime||null,total_marks:Number(x.totalMarks||0),section_name:x.sectionName||null,room_label:x.roomLabel||null,notes:x.notes||null,updated_at:new Date().toISOString()
    };
    const writeOnce=async({signal}={})=>{
      let q=c.state.client.from('exam_schedule_entries').insert(payload).select().single();q=withSignal(q,signal);
      const {data,error}=await q;if(error)throw error;return data;
    };
    try{return await runCloud('exam-schedule-create:'+inst+':'+x.className+':'+x.examName+':'+x.subject+':'+x.examDate,'Create exam schedule',writeOnce,{timeout:8000,retries:0})}
    catch(error){
      const reconcile=async({signal}={})=>{
        let q=c.state.client.from('exam_schedule_entries').select('*').eq('institution_id',inst).eq('creator_user_id',c.state.user.id).eq('class_name',x.className).eq('exam_name',x.examName).eq('subject',x.subject).eq('exam_date',x.examDate);
        q=x.sectionName?q.eq('section_name',x.sectionName):q.is('section_name',null);q=q.order('created_at',{ascending:false}).limit(2);q=withSignal(q,signal);
        const out=await q;if(out.error)throw out.error;return out.data||[];
      };
      const rows=await runCloud('exam-schedule-reconcile:'+inst+':'+x.className+':'+x.subject+':'+x.examDate,'Reconcile exam schedule',reconcile,{timeout:5000,retries:1});
      if(rows.length===1)return rows[0];throw error;
    }
  }
  async function updateCloud(x){
    if(!cloudReady())return null;
    const inst=cfg().institutionId;
    return runCloud('exam-schedule-update:'+inst+':'+x.id,'Update exam schedule',async({signal}={})=>{
      let q=cloud().state.client.from('exam_schedule_entries').update({
        class_name:x.className,section_name:x.sectionName||null,exam_name:x.examName,subject:x.subject,
        exam_date:x.examDate,start_time:x.startTime||null,end_time:x.endTime||null,total_marks:Number(x.totalMarks||0),
        room_label:x.roomLabel||null,notes:x.notes||null,updated_at:new Date().toISOString()
      }).eq('institution_id',inst).eq('id',x.id);
      if(role()==='teacher')q=q.eq('creator_user_id',cloud().state.user.id);
      q=q.select().maybeSingle();q=withSignal(q,signal);const {data,error}=await q;if(error)throw error;return data;
    },{timeout:8000,retries:1});
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const inst=cfg().institutionId;
    return runCloud('exam-schedule-delete:'+inst+':'+id,'Delete exam schedule',async({signal}={})=>{
      let q=cloud().state.client.from('exam_schedule_entries').delete().eq('institution_id',inst).eq('id',id);
      if(role()==='teacher')q=q.eq('creator_user_id',cloud().state.user.id);
      q=withSignal(q,signal);const {error}=await q;if(error)throw error;
    },{timeout:8000,retries:1});
  }

  function scheduleEditor(){
    if(!canEdit())return '<div class="coverage-note">Read-only exam schedule. Teacher/Head schedule create karte hain.</div>';
    const arr=readSchedule(),x=arr.find(r=>String(r.id)===String(editingScheduleId))||{};
    return '<article class="card"><div class="section-head"><div><h3>'+(editingScheduleId?'Edit Exam Schedule':'Add Exam Schedule')+'</h3><p class="muted">Class, section, timings, room and notes complete karein.</p></div>'+(editingScheduleId?'<button id="cancelExamEdit" class="secondary">Cancel Edit</button>':'')+'</div><div class="form-grid">'+
      '<input id="exClass" list="exClassOptions" value="'+esc(x.className||'')+'" placeholder="Registered Class / Grade"><datalist id="exClassOptions">'+editorClassOptions().map(c=>'<option value="'+esc(c)+'"></option>').join('')+'</datalist>'+
      '<input id="exSection" list="exSectionOptions" value="'+esc(x.sectionName||'')+'" placeholder="Section (optional)"><datalist id="exSectionOptions"></datalist>'+
      '<select id="exName">'+['Monthly Test','Midterm','Final','Quiz','Other'].map(v=>'<option '+(x.examName===v?'selected':'')+'>'+v+'</option>').join('')+'</select>'+
      '<input id="exSubject" list="exSubjectOptions" value="'+esc(x.subject||'')+'" placeholder="Subject (choose / type)"><datalist id="exSubjectOptions"></datalist><p id="exSubjectNote" class="coverage-note">Choose your class to load reference and school-saved subjects.</p>'+
      '<input id="exDate" type="date" value="'+esc(x.examDate||today())+'">'+
      '<input id="exTime" type="time" value="'+esc(x.startTime||'')+'" aria-label="Start time">'+
      '<input id="exEndTime" type="time" value="'+esc(x.endTime||'')+'" aria-label="End time">'+
      '<input id="exTotal" type="number" min="1" value="'+Number(x.totalMarks||100)+'" placeholder="Total marks">'+
      '<input id="exRoom" value="'+esc(x.roomLabel||'')+'" placeholder="Room / Hall (optional)">'+
      '<textarea id="exNotes" rows="2" placeholder="Instructions / notes">'+esc(x.notes||'')+'</textarea>'+
      '<button id="saveExamSchedule">'+(editingScheduleId?'Update Schedule':'Add Schedule')+'</button><button type="button" id="exRefreshAcademic" class="secondary">Refresh Classes & Subjects</button></div></article>';
  }
  function syncExamSubjects(){
    const cls=$('exClass')?.value||'',api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    const savedUnits=cloudReady()?(examUnitsScope===currentDirectoryScope()?examUnits:[]):
      (()=>{try{return JSON.parse(localStorage.getItem('edunizam_syllabus_units_v1')||'[]')}catch{return[]}})();
    const data=api?.subjects?.(cls,window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{},savedUnits)||[];
    const list=$('exSubjectOptions');
    if(list)list.innerHTML=data.map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const recorded=api?.subjects?.(cls,{},savedUnits)||[];
    const note=$('exSubjectNote');
    if(note)note.textContent=!cls?'Choose a registered class to see subject suggestions.':
      cloudReady()&&examUnitsScope!==currentDirectoryScope()?'Checking current-school syllabus; reference subjects are suggestions only.':
      cloudReady()&&examUnitsState==='error'?'School syllabus unavailable (network/access); reference subjects are not verified school allocations.':
      recorded.length?recorded.length+' school-recorded subject(s) included; remaining suggestions are unverified reference subjects.':
      'No saved school syllabus subject for this class. Listed subjects are reference suggestions, not verified book allocations.';
    const sectionList=$('exSectionOptions');
    if(sectionList) sectionList.innerHTML=(role()==='head'?api?.sections?.(cls,registeredSections())||[]:
      [...new Set(visibleStudents().filter(x=>api?.sameClass?.(x.className,cls)).map(x=>x.sectionName).filter(Boolean))])
      .map(x=>'<option value="'+esc(x)+'"></option>').join('');
  }
  function scheduleCard(x){
    const actions=canEdit()&&mine(x)?'<button class="secondary" data-ex-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-ex-delete="'+esc(x.id)+'">Delete</button>':'';
    const time=x.startTime?(esc(x.startTime)+(x.endTime?'–'+esc(x.endTime):'')):'Time TBA';
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">Class '+esc(x.className)+(x.sectionName?' · '+esc(x.sectionName):'')+'</span><span class="mini-badge">'+esc(x.examName)+'</span></div><span class="mini-badge">'+esc(x.examDate)+'</span></div>'+
      '<h3>'+esc(x.subject)+'</h3><p class="muted">'+time+(x.roomLabel?' · '+esc(x.roomLabel):'')+'</p>'+
      '<p>Total Marks: '+Number(x.totalMarks||0)+'</p>'+(x.notes?'<p class="coverage-note">'+esc(x.notes)+'</p>':'')+'<div class="paper-actions">'+actions+'</div></article>';
  }

  function reportControls(){
    const list=visibleStudents();
    if(!list.length)return '<div class="empty-state">Aap ke role ke liye koi accessible student record nahi mila.</div>';
    const allowed=new Set(list.map(s=>String(s.id)));
    const types=[...new Set(results().filter(r=>allowed.has(String(r.studentId))).map(r=>r.type||'Result').filter(Boolean))];
    return '<article class="card"><h3>Generate Report Card</h3><div class="form-grid">'+
      '<select id="rcStudent">'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · Class '+esc(s.className||'-')+'</option>').join('')+'</select>'+
      '<select id="rcType"><option value="">All Results</option>'+types.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select>'+
      '<button id="buildReportCard">Build Report Card</button>'+
      '<button id="printReportCard" class="secondary">Print</button></div><div id="reportCardOutput" style="margin-top:14px"></div></article>';
  }

  function buildReport(){
    const sid=String($('rcStudent')?.value||'').trim(),type=$('rcType')?.value||'';
    const s=sid?visibleStudents().find(x=>String(x.id)===sid):null;
    const out=$('reportCardOutput');
    if(!s){if(out)out.innerHTML='<div class="empty-state">Select an accessible student to generate a report card.</div>';return}
    const rows=results().filter(r=>String(r.studentId)===sid&&(!type||(r.type||'Result')===type));
    if(!out)return;
    if(!rows.length){out.innerHTML='<div class="empty-state">Is selection ke liye result records available nahi hain.</div>';return}
    const obt=rows.reduce((a,r)=>a+Number(r.marks||0),0),tot=rows.reduce((a,r)=>a+Number(r.total||0),0),pct=tot?Math.round(obt/tot*100):0;
    const st=settings();
    const logo=st.schoolLogo?'<img class="report-school-logo" src="'+esc(st.schoolLogo)+'" alt="Institute logo">':'';
    out.innerHTML='<div id="printableReportCard" class="card">'+
      '<div class="section-head report-card-head"><div class="report-brand">'+logo+'<div><div class="academic-kicker">'+esc(st.schoolName||'EduNizam Institute')+'</div><h2>Student Report Card</h2><p class="muted">'+esc(type||'Combined Results')+(st.session?' · '+esc(st.session):'')+'</p></div></div><span class="academic-pill">Grade '+grade(pct)+'</span></div>'+
      '<div class="paper-meta"><span><strong>Student:</strong> '+esc(s.name)+'</span><span><strong>Class:</strong> '+esc(s.className||'-')+'</span><span><strong>Guardian:</strong> '+esc(s.father||'-')+'</span></div>'+
      '<div class="list" style="margin-top:14px">'+rows.map(r=>{const p=Math.round(Number(r.marks||0)/Number(r.total||1)*100);return '<div class="row"><strong>'+esc(r.subject)+'</strong><span>'+esc(r.type||'Result')+'</span><span>'+Number(r.marks||0)+'/'+Number(r.total||0)+'</span><span>'+p+'% · '+grade(p)+'</span><span></span></div>'}).join('')+'</div>'+
      '<div class="cards" style="margin-top:14px"><article class="card stat"><span>Obtained</span><strong>'+obt+'</strong></article><article class="card stat"><span>Total</span><strong>'+tot+'</strong></article><article class="card stat"><span>Percentage</span><strong>'+pct+'%</strong></article><article class="card stat"><span>Grade</span><strong>'+grade(pct)+'</strong></article></div>'+
      '</div>';
  }

  function printReport(){
    const card=$('printableReportCard');if(!card)return alert('Pehle report card build karein.');
    const w=window.open('','_blank','width=900,height=700');if(!w)return alert('Popup blocked. Browser mein popups allow karein.');
    w.document.write('<!doctype html><html><head><title>EduNizam Report Card</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#17324a}.row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;padding:10px;border-bottom:1px solid #ddd}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{border:1px solid #d8e2e7;border-radius:12px;padding:14px}.muted{color:#667}.academic-pill{padding:6px 10px;border:1px solid #ccc;border-radius:999px}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.report-brand{display:flex;align-items:center;gap:14px}.report-school-logo{width:72px;height:72px;object-fit:contain;border:1px solid #d8e2e7;border-radius:12px;padding:5px}.academic-kicker{font-size:13px;font-weight:700;color:#0f766e}@media print{button{display:none}}</style></head><body>'+card.innerHTML+'</body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  function mappedCloudRow(row){return {id:row.id,className:row.class_name,sectionName:row.section_name||'',examName:row.exam_name,subject:row.subject,examDate:row.exam_date,startTime:row.start_time?String(row.start_time).slice(0,5):'',endTime:row.end_time?String(row.end_time).slice(0,5):'',totalMarks:Number(row.total_marks||0),roomLabel:row.room_label||'',notes:row.notes||'',createdBy:row.creator_user_id,createdAt:row.created_at,updatedAt:row.updated_at,cloudExisting:true}}
  async function saveSchedule(){
    const className=$('exClass')?.value.trim(),sectionName=$('exSection')?.value.trim()||'',examName=$('exName')?.value,subject=$('exSubject')?.value.trim(),examDate=$('exDate')?.value,startTime=$('exTime')?.value,endTime=$('exEndTime')?.value,totalMarks=Number($('exTotal')?.value||0),roomLabel=$('exRoom')?.value.trim()||'',notes=$('exNotes')?.value.trim()||'';
    if(!className||!subject||!examDate||totalMarks<=0)return alert('Class, subject, date aur total marks complete karein.');
    if(startTime&&endTime&&endTime<=startTime)return alert('End time start time ke baad honi chahiye.');
    if(role()==='teacher'&&!teacherCanManageClassSection(className,sectionName))return alert('Teacher sirf apni assigned class/section ka exam schedule manage kar sakta hai.');
    if(role()==='head'&&!headKnownClass(className,sectionName))return alert('Choose a real registered school class / section. Configure Academic Groups first.');
    const arr=readSchedule(),existing=arr.find(x=>String(x.id)===String(editingScheduleId));
    const duplicate=arr.some(x=>
      String(x.id)!==String(editingScheduleId)&&
      String(x.className||'').trim().toLowerCase()===className.toLowerCase()&&
      String(x.sectionName||'').trim().toLowerCase()===sectionName.toLowerCase()&&
      String(x.examName||'').trim().toLowerCase()===String(examName||'').trim().toLowerCase()&&
      String(x.subject||'').trim().toLowerCase()===subject.toLowerCase()&&
      String(x.examDate||'')===String(examDate)
    );
    if(duplicate)return alert('Same class, section, exam, subject aur date ka schedule already exists.');
    const btn=$('saveExamSchedule');if(examScheduleSaveInFlight||btn?.disabled)return;examScheduleSaveInFlight=true;setBusy(btn,true,'Saving...');
    let item={id:editingScheduleId||String(Date.now()),className,sectionName,examName,subject,examDate,startTime,endTime,totalMarks,roomLabel,notes,createdBy:existing?.createdBy||actorId(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    try{
      const row=editingScheduleId?await updateCloud(item):await insertCloud(item);
      if(row)item=mappedCloudRow(row);
      if(editingScheduleId){const i=arr.findIndex(x=>String(x.id)===String(editingScheduleId));if(i>=0)arr[i]=item;else arr.push(item)}
      else arr.push(item);
      writeSchedule(arr);editingScheduleId='';render();
    }catch(e){
      if(cloudReady())alert('Cloud schedule save failed. Nothing was saved locally: '+(e.message||e));
      else alert('Schedule save failed: '+(e.message||e));
    }finally{examScheduleSaveInFlight=false;setBusy(btn,false)}
  }
  function editSchedule(id){const item=readSchedule().find(x=>String(x.id)===String(id));if(!item||!mine(item))return;editingScheduleId=String(id);render();setTimeout(()=>$('exClass')?.scrollIntoView({behavior:'smooth',block:'center'}),0)}
  function cancelEdit(){editingScheduleId='';render()}
  async function removeSchedule(id,btn){
    const key=String(id||'');if(examScheduleDeleteInFlight.has(key)||btn?.disabled)return;
    const arr=readSchedule(),item=arr.find(x=>String(x.id)===String(id));if(!item||!mine(item))return;
    examScheduleDeleteInFlight.add(key);setBusy(btn,true,'Deleting...');
    try{
      try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
      writeSchedule(arr.filter(x=>String(x.id)!==String(id)));if(String(editingScheduleId)===String(id))editingScheduleId='';render();
    }finally{examScheduleDeleteInFlight.delete(key);if(btn?.isConnected)setBusy(btn,false)}
  }

  async function refreshAcademicOptions(){
    const button=$('exRefreshAcademic');
    if(button){button.disabled=true;button.textContent='Refreshing...'}
    try{
      await Promise.all([loadClassDirectory(true),loadExamSubjects(true)]);
      const list=$('exClassOptions');
      if(list)list.innerHTML=editorClassOptions().map(c=>'<option value="'+esc(c)+'"></option>').join('');
      syncExamSubjects();
    }finally{if(button?.isConnected){button.disabled=false;button.textContent='Refresh Classes & Subjects'}}
  }
  function bind(){
    $('exRefreshAcademic')?.addEventListener('click',refreshAcademicOptions);
    $('exClass')?.addEventListener('input',syncExamSubjects);
    syncExamSubjects();
    if($('saveExamSchedule'))$('saveExamSchedule').onclick=saveSchedule;
    if($('cancelExamEdit'))$('cancelExamEdit').onclick=cancelEdit;
    if($('buildReportCard'))$('buildReportCard').onclick=buildReport;
    if($('printReportCard'))$('printReportCard').onclick=printReport;
    ['exFilterClass','exFilterType','exFilterWhen'].forEach(id=>$(id)?.addEventListener('change',render));
    $('exSearch')?.addEventListener('input',()=>{clearTimeout(bind.searchTimer);bind.searchTimer=setTimeout(render,160)});
    document.querySelectorAll('[data-ex-edit]').forEach(b=>b.onclick=()=>editSchedule(b.dataset.exEdit));
    document.querySelectorAll('[data-ex-delete]').forEach(b=>b.onclick=()=>removeSchedule(b.dataset.exDelete,b));
  }

  async function render(){
    const root=$('examCenterApp');if(!root)return;
    let schedule=readSchedule();
    const scope=cloudReady()?currentDirectoryScope():'';
    const needsSchedule=cloudReady()&&(!root.dataset.cloudLoaded||root.dataset.cloudScope!==scope);
    const classJob=role()==='head'&&cloudReady()?loadClassDirectory():Promise.resolve();
    const subjectJob=canEdit()&&cloudReady()?loadExamSubjects():Promise.resolve();
    if(needsSchedule){
      root.dataset.cloudLoaded='1';root.dataset.cloudScope=scope;
      try{
        const [fresh]=await Promise.all([pullCloud(),classJob,subjectJob]);
        schedule=fresh;
      }catch(e){
        root.dataset.cloudLoaded='';
        schedule=[];
        console.warn('Exam schedule cloud sync:',e.message);
      }
    }else await Promise.all([classJob,subjectJob]);
    // Current school data only. A stale local cache from a previous school
    // must never become the head's schedule after a switch or fetch failure.
    if(cloudReady()&&loadedScheduleScope!==currentDirectoryScope())schedule=[];
    schedule=schedule.filter(x=>classVisible(x.className)).sort((a,b)=>String(a.examDate).localeCompare(String(b.examDate))||String(a.startTime).localeCompare(String(b.startTime)));
    const classes=[...new Set(schedule.map(x=>x.className).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
    const types=[...new Set(schedule.map(x=>x.examName).filter(Boolean))].sort();
    const keep={cls:root.dataset.filterClass||'',type:root.dataset.filterType||'',when:root.dataset.filterWhen||'upcoming',search:root.dataset.search||''};
    const filtered=schedule.filter(x=>{
      if(keep.cls&&x.className!==keep.cls)return false;if(keep.type&&x.examName!==keep.type)return false;
      if(keep.when==='upcoming'&&x.examDate<today())return false;if(keep.when==='past'&&x.examDate>=today())return false;
      if(keep.search&&!([x.subject,x.examName,x.className,x.sectionName,x.roomLabel,x.notes].join(' ').toLowerCase().includes(keep.search.toLowerCase())))return false;return true;
    });
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      scheduleEditor()+
      '<div class="section-head" style="margin-top:18px"><div><h3>Exam Schedule</h3><p class="muted">Relevant class schedule with filters and full timing details.</p></div><span class="badge">'+filtered.length+' shown</span></div>'+
      '<div class="form-grid"><select id="exFilterWhen"><option value="upcoming" '+(keep.when==='upcoming'?'selected':'')+'>Upcoming</option><option value="all" '+(keep.when==='all'?'selected':'')+'>All</option><option value="past" '+(keep.when==='past'?'selected':'')+'>Past</option></select><select id="exFilterClass"><option value="">All Classes</option>'+classes.map(v=>'<option value="'+esc(v)+'" '+(keep.cls===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><select id="exFilterType"><option value="">All Exam Types</option>'+types.map(v=>'<option value="'+esc(v)+'" '+(keep.type===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><input id="exSearch" type="search" value="'+esc(keep.search)+'" placeholder="Search subject, room or note"></div>'+
      '<div class="paper-grid" style="margin-top:12px">'+(filtered.length?filtered.map(scheduleCard).join(''):'<div class="empty-state">Is filter ke liye exam schedule nahi hai.</div>')+'</div>'+
      '<div style="margin-top:20px">'+reportControls()+'</div>';
    if($('exFilterClass'))$('exFilterClass').onchange=()=>{root.dataset.filterClass=$('exFilterClass').value;render()};
    if($('exFilterType'))$('exFilterType').onchange=()=>{root.dataset.filterType=$('exFilterType').value;render()};
    if($('exFilterWhen'))$('exFilterWhen').onchange=()=>{root.dataset.filterWhen=$('exFilterWhen').value;render()};
    if($('exSearch'))$('exSearch').oninput=()=>{root.dataset.search=$('exSearch').value;clearTimeout(render.searchTimer);render.searchTimer=setTimeout(render,180)};
    bind();
  }

  window.addEventListener('edunizam:auth',()=>{const root=$('examCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,800);
  window.EDUNIZAM_EXAM_CENTER={render,pullCloud,readSchedule,cloudReady,reportControls,buildReport,registeredSections,editorClassOptions,headKnownClass,loadClassDirectory,loadExamSubjects,syncExamSubjects,refreshAcademicOptions,getExamUnits:()=>examUnits,getExamUnitsScope:()=>examUnitsScope};
})();