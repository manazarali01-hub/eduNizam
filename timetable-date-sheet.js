(function(){
  const SCHOOL_KEY='edunizam_school_work_v1';
  const EXAM_KEY='edunizam_exam_schedule_v1';
  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const canManage=()=>['head','teacher'].includes(role());
  const canManageItem=x=>role()==='head'||(role()==='teacher'&&String(x?.createdBy||'')===String(cloud()?.state?.user?.id||''));
  let timetableSaveInFlight=false,dateSheetSaveInFlight=false;
  const scheduleDeleteInFlight=new Set();
  let cloudCatalog={scope:'',classes:[],units:[],classState:'unchecked',unitState:'unchecked'};
  let scheduleDataScope='',catalogLoadInFlight=null;
  const currentScope=()=>[String(cfg().institutionId||''),String(cloud()?.state?.user?.id||''),role()].join('|');
  async function loadSchoolCatalog(force=false){
    if(!cloudReady()||!canManage())return;
    const scope=currentScope();
    if(!force&&cloudCatalog.scope===scope&&Date.now()-(cloudCatalog.loadedAt||0)<30000&&cloudCatalog.classState!=='unchecked'&&cloudCatalog.unitState!=='unchecked')return;
    if(catalogLoadInFlight?.scope===scope)return catalogLoadInFlight.promise;
    cloudCatalog={scope:'',classes:[],units:[],classState:'unchecked',unitState:'unchecked'};
    const client=cloud().state.client,inst=cfg().institutionId;
    async function read(table,columns,max){
      return runCloud('schedule-directory:'+scope+':'+table,'Schedule '+table,async({signal}={})=>{
        let q=client.from(table).select(columns).eq('institution_id',inst).limit(max);
        if(table==='class_sections')q=q.eq('active',true);
        q=withSignal(q,signal);
        const {data,error}=await q;if(error)throw error;return Array.isArray(data)?data:[];
      },{timeout:6500,retries:0});
    }
    const promise=(async()=>{
      const [classes,units]=await Promise.allSettled([
        read('class_sections','class_name,section_name,active',1200),
        read('syllabus_progress_units','class_name,subject,unit_title',1500)
      ]);
      if(!cloudReady()||currentScope()!==scope)return;
      cloudCatalog={
        scope,loadedAt:Date.now(),
        classes:classes.status==='fulfilled'?classes.value.map(x=>({className:x.class_name,sectionName:x.section_name,active:x.active!==false})):[],
        units:units.status==='fulfilled'?units.value.map(x=>({className:x.class_name,subject:x.subject,unitTitle:x.unit_title})):[],
        classState:classes.status==='fulfilled'?'loaded':'error',
        unitState:units.status==='fulfilled'?'loaded':'error'
      };
      if(classes.status==='rejected')console.warn('Schedule class directory:',classes.reason?.message||classes.reason);
      if(units.status==='rejected')console.warn('Schedule syllabus options:',units.reason?.message||units.reason);
    })();
    catalogLoadInFlight={scope,promise};
    try{await promise}finally{if(catalogLoadInFlight?.promise===promise)catalogLoadInFlight=null}
  }
  function setBusy(btn,busy,label='Working...'){
    if(!btn)return;
    if(busy){if(!btn.dataset.busyLabel)btn.dataset.busyLabel=btn.textContent||'';btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent=label}
    else{btn.disabled=false;btn.removeAttribute('aria-busy');if(btn.dataset.busyLabel!==undefined){btn.textContent=btn.dataset.busyLabel;delete btn.dataset.busyLabel}}
  }
  function withSignal(q,signal){return signal&&typeof q?.abortSignal==='function'?q.abortSignal(signal):q}
  async function runCloud(key,label,factory,{timeout=7000,retries=1}={}){
    const runtime=window.EDUNIZAM_DATA_RUNTIME;
    return runtime?runtime.run(key,factory,{timeout,retries,label}):factory({});
  }
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const uuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||''));

  function schoolData(){try{return Object.assign({announcements:[],homework:[],timetable:[]},JSON.parse(localStorage.getItem(SCHOOL_KEY)||'{}'))}catch{return{announcements:[],homework:[],timetable:[]}}}
  function writeSchool(v){localStorage.setItem(SCHOOL_KEY,JSON.stringify(v))}
  function timetable(){return schoolData().timetable||[]}
  function writeTimetable(v){const d=schoolData();d.timetable=v;writeSchool(d)}
  function dateSheets(){try{return JSON.parse(localStorage.getItem(EXAM_KEY)||'[]')}catch{return[]}}
  function writeDateSheets(v){localStorage.setItem(EXAM_KEY,JSON.stringify(v))}
  const scheduleReady=()=>!cloudReady()||scheduleDataScope===currentScope();
  const currentTimetable=()=>scheduleReady()?timetable():[];
  const currentDateSheets=()=>scheduleReady()?dateSheets():[];
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||[]}
  function classSections(){
    const allowed=window.EDUNIZAM_ROLE_SCOPE?.teacherClassKeys?.()||new Set();
    // In cloud mode, never trust the unscoped local class directory from a
    // previous school. Family/teacher visible students remain role-filtered.
    const rows=role()==='head'&&cloudReady()?[]:visibleStudents().map(x=>({className:x.className,sectionName:x.sectionName}));
    let directory=[];
    if(cloudReady()){
      if(cloudCatalog.scope===currentScope())directory=cloudCatalog.classes;
    }else{
      try{directory=JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]')}catch(_){}
    }
    if(canManage())for(const x of Array.isArray(directory)?directory:[]){
      const k=String(x.className||'').trim().toLowerCase()+'|'+String(x.sectionName||'').trim().toLowerCase();
      if(x.active!==false&&(role()==='head'||allowed.has(k)))rows.push(x);
    }
    return window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.registeredSections(rows)||[];
  }
  function knownClass(item){
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS,available=classSections();
    return !!item.className&&available.some(x=>api?.sameClass?.(x.className,item.className)&&x.sectionName===String(item.sectionName||''));
  }
  function accessible(x){
    if(role()==='head'||role()==='teacher')return true;
    return visibleStudents().some(s=>String(s.className||'')===String(x.className||'')&&(!x.sectionName||String(s.sectionName||'')===String(x.sectionName||'')));
  }
  const timeValue=t=>{if(!t)return null;const p=String(t).slice(0,5).split(':').map(Number);return p[0]*60+p[1]};
  const overlaps=(a1,a2,b1,b2)=>{a1=timeValue(a1);a2=timeValue(a2);b1=timeValue(b1);b2=timeValue(b2);return [a1,a2,b1,b2].every(Number.isFinite)&&a1<b2&&b1<a2};
  const label=x=>'Class '+x.className+(x.sectionName?' · '+x.sectionName:'');
  function optionList(selected='',blank='All classes'){
    return '<option value="">'+blank+'</option>'+classSections().map(x=>{const v=x.className+'|'+x.sectionName;return '<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(label(x))+'</option>'}).join('');
  }
  function splitClass(v){const [className='',sectionName='']=String(v||'').split('|');return{className,sectionName}}
  function syncSubjectCatalog(prefix){
    const selected=$(prefix+'Class')?.value||'',list=$(prefix+'SubjectOptions');
    if(!list)return;
    const cls=splitClass(selected).className;
    const catalog=window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{};
    let units=[];
    if(cloudReady()){
      if(cloudCatalog.scope===currentScope())units=cloudCatalog.units;
    }else{
      try{units=JSON.parse(localStorage.getItem('edunizam_syllabus_units_v1')||'[]')}catch(_){}
    }
    const subjects=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.subjects(cls,catalog,units)||[];
    list.innerHTML=subjects.map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const note=$(prefix+'SubjectNote');
    if(note)note.textContent=subjects.length?subjects.length+' subject suggestion(s). Confirm your school textbook and timetable allocation.':
      'No verified class subject data available; save school syllabus first or enter a correctly assigned subject.';
  }
  function mapTimetableRow(x){return{id:x.id,className:x.class_name,sectionName:x.section_name||'',day:x.weekday,periodNumber:Number(x.period_number||0),time:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',subject:x.subject,teacherName:x.teacher_name||'',roomLabel:x.room_label||'',createdBy:x.creator_user_id,createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}}
  function mapExamRow(x){return{id:x.id,className:x.class_name,sectionName:x.section_name||'',examName:x.exam_name,subject:x.subject,examDate:x.exam_date,startTime:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',totalMarks:Number(x.total_marks||0),roomLabel:x.room_label||'',notes:x.notes||'',createdBy:x.creator_user_id,createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}}
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId,scope=currentScope();
    const {tt,ds}=await runCloud('schedule-load:'+scope,'Timetable and date sheet',async({signal}={})=>{
      const [tt,ds]=await Promise.all([
        withSignal(c.from('timetable_entries').select('*').eq('institution_id',id).order('weekday').order('start_time'),signal),
        withSignal(c.from('exam_schedule_entries').select('*').eq('institution_id',id).order('exam_date').order('start_time'),signal)
      ]);
      if(tt.error)throw tt.error;if(ds.error)throw ds.error;return {tt,ds};
    },{timeout:7000,retries:1});
    if(!cloudReady()||currentScope()!==scope)return;
    writeTimetable((tt.data||[]).map(mapTimetableRow));writeDateSheets((ds.data||[]).map(mapExamRow));
    scheduleDataScope=scope;
  }
  async function saveCloud(kind,item){
    if(!cloudReady())return null;
    const inst=cfg().institutionId,base={institution_id:inst,creator_user_id:cloud().state.user.id,updated_at:new Date().toISOString()};
    const timetablePayload={...base,class_name:item.className,section_name:item.sectionName||null,weekday:item.day,period_number:item.periodNumber||null,start_time:item.time||null,end_time:item.endTime||null,subject:item.subject,teacher_name:item.teacherName||null,room_label:item.roomLabel||null};
    const examPayload={...base,class_name:item.className,section_name:item.sectionName||null,exam_name:item.examName,subject:item.subject,exam_date:item.examDate,start_time:item.startTime||null,end_time:item.endTime||null,total_marks:Number(item.totalMarks||0),room_label:item.roomLabel||null,notes:item.notes||null};
    const table=kind==='timetable'?'timetable_entries':'exam_schedule_entries',payload=kind==='timetable'?timetablePayload:examPayload,isUpdate=item.cloudExisting&&uuid(item.id);
    const writeOnce=async({signal}={})=>{
      let q=isUpdate?cloud().state.client.from(table).update(payload).eq('institution_id',inst).eq('id',item.id):cloud().state.client.from(table).insert(payload);
      q=q.select().single();q=withSignal(q,signal);const {data,error}=await q;if(error)throw error;return kind==='timetable'?mapTimetableRow(data):mapExamRow(data);
    };
    try{return await runCloud('schedule-save:'+kind+':'+inst+':'+String(item.id||item.className+':'+item.subject),'Save '+(kind==='timetable'?'timetable period':'date-sheet paper'),writeOnce,{timeout:8000,retries:isUpdate?1:0})}
    catch(error){
      if(isUpdate)throw error;
      const reconcile=async({signal}={})=>{
        let q=cloud().state.client.from(table).select('*').eq('institution_id',inst).eq('creator_user_id',base.creator_user_id).eq('class_name',item.className).eq('subject',item.subject);
        q=item.sectionName?q.eq('section_name',item.sectionName):q.is('section_name',null);
        if(kind==='timetable')q=q.eq('weekday',item.day).eq('period_number',item.periodNumber).eq('start_time',item.time);
        else q=q.eq('exam_name',item.examName).eq('exam_date',item.examDate).eq('start_time',item.startTime);
        q=q.order('created_at',{ascending:false}).limit(2);q=withSignal(q,signal);
        const out=await q;if(out.error)throw out.error;return out.data||[];
      };
      const rows=await runCloud('schedule-reconcile:'+kind+':'+inst+':'+item.className+':'+item.subject,'Reconcile '+kind,reconcile,{timeout:5000,retries:1});
      if(rows.length===1)return kind==='timetable'?mapTimetableRow(rows[0]):mapExamRow(rows[0]);throw error;
    }
  }
  async function deleteCloud(kind,id){
    if(!cloudReady()||!uuid(id))return;
    const inst=cfg().institutionId,table=kind==='timetable'?'timetable_entries':'exam_schedule_entries';
    return runCloud('schedule-delete:'+kind+':'+inst+':'+id,'Delete '+kind,async({signal}={})=>{
      let q=cloud().state.client.from(table).delete().eq('institution_id',inst).eq('id',id);q=withSignal(q,signal);
      const {error}=await q;if(error)throw error;
    },{timeout:8000,retries:1});
  }

  function injectStyles(){
    if($('scheduleCenterStyles'))return;
    const s=document.createElement('style');s.id='scheduleCenterStyles';s.textContent=`
      .schedule-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.schedule-tabs .active{background:var(--edu-navy);color:#fff}
      .schedule-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:10px;align-items:center;margin:14px 0}
      .schedule-day{margin:14px 0}.schedule-day h3{margin:0 0 8px;color:var(--edu-navy)}
      .schedule-table-wrap{overflow:auto;border:1px solid var(--edu-line);border-radius:14px;background:#fff}
      .schedule-table{width:100%;border-collapse:collapse;min-width:720px}.schedule-table th,.schedule-table td{padding:11px 12px;border-bottom:1px solid var(--edu-line);text-align:left;font-size:13px}.schedule-table th{background:#f1f7f7;color:var(--edu-navy);font-size:11px;text-transform:uppercase;letter-spacing:.06em}.schedule-table tr:last-child td{border-bottom:0}
      .schedule-clash{border-left:4px solid #c7513b;background:#fff5f2}.schedule-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.schedule-summary span{padding:7px 10px;border-radius:999px;background:#eef6f5;color:#0d675f;font-size:12px;font-weight:800}
      @media(max-width:700px){.schedule-toolbar{grid-template-columns:1fr}.schedule-toolbar button{width:100%}}
    `;document.head.appendChild(s);
  }
  function managerNote(){return canManage()?'':'<div class="coverage-note">Timetable aur date sheet school staff manage karta hai. Aap ko apni relevant class ka read-only schedule dikhaya ja raha hai.</div>'}

  function timetableEditor(edit=null){
    if(!canManage())return managerNote();
    const value=edit?(edit.className+'|'+(edit.sectionName||'')):'';
    return '<article class="card"><h3>'+(edit?'Edit Period':'Add Timetable Period')+'</h3><div class="form-grid">'+
      '<input id="ttEditId" type="hidden" value="'+esc(edit?.id||'')+'"><select id="ttClass">'+optionList(value,'Select class / section')+'</select>'+
      '<select id="ttDay">'+DAYS.map(d=>'<option '+(edit?.day===d?'selected':'')+'>'+d+'</option>').join('')+'</select>'+
      '<input id="ttPeriod" type="number" min="1" max="15" placeholder="Period number" value="'+esc(edit?.periodNumber||'')+'">'+
      '<input id="ttStart" type="time" value="'+esc(edit?.time||'')+'"><input id="ttEnd" type="time" value="'+esc(edit?.endTime||'')+'">'+
      '<input id="ttSubject" list="ttSubjectOptions" placeholder="Subject (choose / type)" value="'+esc(edit?.subject||'')+'"><datalist id="ttSubjectOptions"></datalist><p id="ttSubjectNote" class="coverage-note">Select a registered class to load subjects.</p><input id="ttTeacher" placeholder="Teacher name" value="'+esc(edit?.teacherName||'')+'"><input id="ttRoom" placeholder="Room / lab" value="'+esc(edit?.roomLabel||'')+'">'+
      '<button id="ttSave">'+(edit?'Update Period':'Save Period')+'</button>'+(edit?'<button id="ttCancel" class="secondary">Cancel</button>':'')+'</div></article>';
  }
  function dateSheetEditor(edit=null){
    if(!canManage())return managerNote();
    const value=edit?(edit.className+'|'+(edit.sectionName||'')):'';
    return '<article class="card"><h3>'+(edit?'Edit Paper':'Add Date Sheet Paper')+'</h3><div class="form-grid">'+
      '<input id="dsEditId" type="hidden" value="'+esc(edit?.id||'')+'"><select id="dsClass">'+optionList(value,'Select class / section')+'</select>'+
      '<input id="dsExam" list="dsExamOptions" placeholder="Exam name e.g. Midterm" value="'+esc(edit?.examName||'')+'"><datalist id="dsExamOptions"><option value="Monthly Test"></option><option value="Midterm"></option><option value="Final"></option><option value="Quiz"></option><option value="Annual Examination"></option></datalist><input id="dsSubject" list="dsSubjectOptions" placeholder="Subject (choose / type)" value="'+esc(edit?.subject||'')+'"><datalist id="dsSubjectOptions"></datalist><p id="dsSubjectNote" class="coverage-note">Select a registered class to load subjects.</p>'+
      '<input id="dsDate" type="date" value="'+esc(edit?.examDate||today())+'"><input id="dsStart" type="time" value="'+esc(edit?.startTime||'')+'"><input id="dsEnd" type="time" value="'+esc(edit?.endTime||'')+'">'+
      '<input id="dsMarks" type="number" min="1" value="'+esc(edit?.totalMarks||100)+'" placeholder="Total marks"><input id="dsRoom" placeholder="Room / hall" value="'+esc(edit?.roomLabel||'')+'"><input id="dsNotes" placeholder="Instructions / notes" value="'+esc(edit?.notes||'')+'">'+
      '<button id="dsSave">'+(edit?'Update Paper':'Save Paper')+'</button>'+(edit?'<button id="dsCancel" class="secondary">Cancel</button>':'')+'</div></article>';
  }

  function timetableClashes(rows,item,editId){
    return rows.filter(x=>String(x.id)!==String(editId)&&x.day===item.day&&(
      (x.className===item.className&&String(x.sectionName||'')===String(item.sectionName||'')&&(Number(x.periodNumber)===Number(item.periodNumber)||overlaps(x.time,x.endTime,item.time,item.endTime)))||
      (item.teacherName&&x.teacherName&&x.teacherName.toLowerCase()===item.teacherName.toLowerCase()&&overlaps(x.time,x.endTime,item.time,item.endTime))||
      (item.roomLabel&&x.roomLabel&&x.roomLabel.toLowerCase()===item.roomLabel.toLowerCase()&&overlaps(x.time,x.endTime,item.time,item.endTime))
    ));
  }
  function dateClashes(rows,item,editId){return rows.filter(x=>String(x.id)!==String(editId)&&x.examDate===item.examDate&&(
    (x.className===item.className&&String(x.sectionName||'')===String(item.sectionName||'')&&overlaps(x.startTime,x.endTime,item.startTime,item.endTime))||
    (item.roomLabel&&x.roomLabel&&x.roomLabel.toLowerCase()===item.roomLabel.toLowerCase()&&overlaps(x.startTime,x.endTime,item.startTime,item.endTime))
  ))}
  async function saveTimetable(){
    const btn=$('ttSave');if(timetableSaveInFlight||btn?.disabled)return;
    const cls=splitClass($('ttClass')?.value),editId=$('ttEditId')?.value||'';
    let item={id:editId||String(Date.now()),...cls,day:$('ttDay')?.value,periodNumber:Number($('ttPeriod')?.value||0),time:$('ttStart')?.value||'',endTime:$('ttEnd')?.value||'',subject:$('ttSubject')?.value.trim()||'',teacherName:$('ttTeacher')?.value.trim()||'',roomLabel:$('ttRoom')?.value.trim()||'',createdAt:new Date().toISOString(),cloudExisting:uuid(editId)};
    if(!item.className||!item.subject||!item.day||!Number.isInteger(item.periodNumber)||item.periodNumber<1||item.periodNumber>15||!item.time||!item.endTime)return alert('Valid class, day, period (1–15), start/end time aur subject required hain.');
    if(!canManage()||!knownClass(item))return alert('Choose a registered, accessible class and section. Configure Academic Groups first.');
    if(!scheduleReady())return alert('Current school schedule is not loaded. Refresh this page before saving.');
    if(timeValue(item.time)>=timeValue(item.endTime))return alert('End time start time ke baad honi chahiye.');
    const rows=currentTimetable(),conflicts=timetableClashes(rows,item,editId);if(conflicts.length&&!confirm('Clash detected: '+conflicts.map(x=>label(x)+' / '+x.subject).join(', ')+'. Phir bhi save karein?'))return;
    timetableSaveInFlight=true;setBusy(btn,true,editId?'Updating...':'Saving...');
    try{
      try{const saved=await saveCloud('timetable',item);if(saved)item=saved}catch(e){if(cloudReady())return alert('Cloud timetable save failed: '+(e.message||e))}
      writeTimetable(rows.filter(x=>String(x.id)!==String(editId)).concat(item));render();
    }finally{timetableSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  async function saveDateSheet(){
    const btn=$('dsSave');if(dateSheetSaveInFlight||btn?.disabled)return;
    const cls=splitClass($('dsClass')?.value),editId=$('dsEditId')?.value||'';
    let item={id:editId||String(Date.now()),...cls,examName:$('dsExam')?.value.trim()||'',subject:$('dsSubject')?.value.trim()||'',examDate:$('dsDate')?.value||'',startTime:$('dsStart')?.value||'',endTime:$('dsEnd')?.value||'',totalMarks:Number($('dsMarks')?.value||0),roomLabel:$('dsRoom')?.value.trim()||'',notes:$('dsNotes')?.value.trim()||'',createdAt:new Date().toISOString(),cloudExisting:uuid(editId)};
    if(!item.className||!item.examName||!item.subject||!item.examDate||!item.startTime||!item.endTime||!Number.isInteger(item.totalMarks)||item.totalMarks<=0||item.totalMarks>1000)return alert('Class, exam, subject, date, times and whole total marks (1–1000) required hain.');
    if(!canManage()||!knownClass(item))return alert('Choose a registered, accessible class and section. Configure Academic Groups first.');
    if(!scheduleReady())return alert('Current school schedule is not loaded. Refresh this page before saving.');
    if(timeValue(item.startTime)>=timeValue(item.endTime))return alert('End time start time ke baad honi chahiye.');
    const rows=currentDateSheets(),conflicts=dateClashes(rows,item,editId);if(conflicts.length&&!confirm('Date-sheet clash detected: '+conflicts.map(x=>label(x)+' / '+x.subject).join(', ')+'. Phir bhi save karein?'))return;
    dateSheetSaveInFlight=true;setBusy(btn,true,editId?'Updating...':'Saving...');
    try{
      try{const saved=await saveCloud('datesheet',item);if(saved)item=saved}catch(e){if(cloudReady())return alert('Cloud date sheet save failed: '+(e.message||e))}
      writeDateSheets(rows.filter(x=>String(x.id)!==String(editId)).concat(item));render();
    }finally{dateSheetSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  async function remove(kind,id,btn){
    const key=kind+':'+String(id||'');if(!canManage()||!scheduleReady()||scheduleDeleteInFlight.has(key)||btn?.disabled)return;
    const rows=kind==='timetable'?currentTimetable():currentDateSheets(),item=rows.find(x=>String(x.id)===String(id));if(!item||!canManageItem(item)||!confirm('Delete '+(item.subject||'entry')+'?'))return;
    scheduleDeleteInFlight.add(key);setBusy(btn,true,'Deleting...');
    try{
      try{await deleteCloud(kind,id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
      if(kind==='timetable')writeTimetable(rows.filter(x=>String(x.id)!==String(id)));else writeDateSheets(rows.filter(x=>String(x.id)!==String(id)));render();
    }finally{scheduleDeleteInFlight.delete(key);if(btn?.isConnected)setBusy(btn,false)}
  }

  function timetableRows(rows){
    if(!rows.length)return '<div class="empty-state">Is class ka timetable abhi available nahi hai.</div>';
    return DAYS.map(day=>{const list=rows.filter(x=>x.day===day).sort((a,b)=>Number(a.periodNumber)-Number(b.periodNumber)||String(a.time).localeCompare(String(b.time)));if(!list.length)return'';
      return '<section class="schedule-day"><h3>'+day+'</h3><div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th>'+(canManage()?'<th>Actions</th>':'')+'</tr></thead><tbody>'+list.map(x=>'<tr><td>'+Number(x.periodNumber||0)+'</td><td>'+esc(x.time)+' – '+esc(x.endTime||'')+'</td><td><strong>'+esc(x.subject)+'</strong></td><td>'+esc(x.teacherName||'—')+'</td><td>'+esc(x.roomLabel||'—')+'</td>'+(canManage()?'<td>'+(canManageItem(x)?'<button data-tt-edit="'+esc(x.id)+'">Edit</button> <button class="secondary" data-tt-delete="'+esc(x.id)+'">Delete</button>':'<span class="muted">Read only</span>')+'</td>':'')+'</tr>').join('')+'</tbody></table></div></section>';
    }).join('');
  }
  function dateSheetRows(rows){
    if(!rows.length)return '<div class="empty-state">Is selection ke liye date sheet available nahi hai.</div>';
    return '<div class="paper-grid">'+rows.map(x=>'<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.examName)+'</span><span class="badge">'+esc(x.examDate)+'</span></div><h3>'+esc(x.subject)+'</h3><p class="muted">'+esc(label(x))+' · '+esc(x.startTime)+' – '+esc(x.endTime||'')+(x.roomLabel?' · '+esc(x.roomLabel):'')+'</p><p>Total Marks: '+Number(x.totalMarks||0)+(x.notes?' · '+esc(x.notes):'')+'</p>'+(canManage()&&canManageItem(x)?'<div class="paper-actions"><button data-ds-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-ds-delete="'+esc(x.id)+'">Delete</button></div>':'')+'</article>').join('')+'</div>';
  }
  function printView(kind,rows,title){
    if(!rows.length)return alert('Print karne ke liye record available nahi hai.');
    const school=(()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}').schoolName||'EduNizam Institute'}catch{return'EduNizam Institute'}})();
    const body=kind==='timetable'?timetableRows(rows):dateSheetRows(rows);const w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked. Browser mein popups allow karein.');
    w.document.write('<!doctype html><html><head><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;color:#17324a;padding:26px}header{text-align:center;margin-bottom:20px}h1{margin:4px}.schedule-table{width:100%;border-collapse:collapse;margin-bottom:18px}.schedule-table th,.schedule-table td{border:1px solid #ccd8de;padding:8px;text-align:left}.paper-grid{display:grid;gap:10px}.paper-card{border:1px solid #ccd8de;border-radius:10px;padding:12px}.paper-card-top{display:flex;justify-content:space-between}.mini-badge,.badge{font-weight:bold}.paper-actions,button{display:none}.muted{color:#5f6e76}@media print{body{padding:0}}</style></head><body><header><strong>'+esc(school)+'</strong><h1>'+esc(title)+'</h1><small>Generated by EduNizam</small></header>'+body+'</body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  async function refreshSchoolOptions(){
    const btn=$('scheduleRefreshSchool');if(btn){btn.disabled=true;btn.textContent='Refreshing school options...'}
    try{
      await loadSchoolCatalog(true);
      await render();
    }finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Refresh Classes & Syllabus'}}
  }
  function bind(){
    $('scheduleRefreshSchool')?.addEventListener('click',refreshSchoolOptions);
    for(const prefix of ['tt','ds']){
      $(prefix+'Class')?.addEventListener('change',()=>syncSubjectCatalog(prefix));
      syncSubjectCatalog(prefix);
    }
    $('ttSave')?.addEventListener('click',saveTimetable);$('dsSave')?.addEventListener('click',saveDateSheet);$('ttCancel')?.addEventListener('click',render);$('dsCancel')?.addEventListener('click',render);
    $('scheduleClassFilter')?.addEventListener('change',e=>{const root=$('scheduleCenterApp');root.dataset.classFilter=e.target.value;render()});
    $('dateExamFilter')?.addEventListener('change',e=>{const root=$('scheduleCenterApp');root.dataset.examFilter=e.target.value;render()});
    $('printSchedule')?.addEventListener('click',()=>{const root=$('scheduleCenterApp'),f=root.dataset.classFilter||'',rows=currentTimetable().filter(accessible).filter(x=>!f||x.className+'|'+(x.sectionName||'')===f);printView('timetable',rows,'Weekly Timetable'+(f?' — '+label(splitClass(f)):'') )});
    $('printDateSheet')?.addEventListener('click',()=>{const root=$('scheduleCenterApp'),f=root.dataset.classFilter||'',ex=root.dataset.examFilter||'',rows=currentDateSheets().filter(accessible).filter(x=>(!f||x.className+'|'+(x.sectionName||'')===f)&&(!ex||x.examName===ex)).sort((a,b)=>a.examDate.localeCompare(b.examDate)||a.startTime.localeCompare(b.startTime));printView('datesheet',rows,'Date Sheet'+(ex?' — '+ex:'')+(f?' — '+label(splitClass(f)):'') )});
    document.querySelectorAll('[data-tt-edit]').forEach(b=>b.onclick=()=>{const x=currentTimetable().find(r=>String(r.id)===String(b.dataset.ttEdit));if(x&&canManageItem(x)){$('scheduleEditor').innerHTML=timetableEditor(x);bind()}});
    document.querySelectorAll('[data-ds-edit]').forEach(b=>b.onclick=()=>{const x=currentDateSheets().find(r=>String(r.id)===String(b.dataset.dsEdit));if(x&&canManageItem(x)){$('scheduleEditor').innerHTML=dateSheetEditor(x);bind()}});
    document.querySelectorAll('[data-tt-delete]').forEach(b=>b.onclick=()=>remove('timetable',b.dataset.ttDelete,b));document.querySelectorAll('[data-ds-delete]').forEach(b=>b.onclick=()=>remove('datesheet',b.dataset.dsDelete,b));
  }
  async function render(){
    const root=$('scheduleCenterApp');if(!root)return;injectStyles();
    if(cloudReady()){
      const scope=currentScope();
      if(!root.dataset.cloudLoaded||root.dataset.cloudScope!==scope){
        root.dataset.cloudLoaded='1';root.dataset.cloudScope=scope;
        const outcomes=await Promise.allSettled([pullCloud(),loadSchoolCatalog()]);
        if(outcomes[0].status==='rejected'){
          root.dataset.cloudLoaded='';
          console.warn('Schedule cloud sync:',outcomes[0].reason?.message||outcomes[0].reason);
        }
      }else if(canManage())await loadSchoolCatalog();
    }
    const tab=root.dataset.tab||'timetable',filter=root.dataset.classFilter||'',examFilter=root.dataset.examFilter||'';
    let tt=currentTimetable().filter(accessible),ds=currentDateSheets().filter(accessible);if(filter){tt=tt.filter(x=>x.className+'|'+(x.sectionName||'')===filter);ds=ds.filter(x=>x.className+'|'+(x.sectionName||'')===filter)}
    const exams=[...new Set(ds.map(x=>x.examName).filter(Boolean))].sort();if(examFilter)ds=ds.filter(x=>x.examName===examFilter);ds.sort((a,b)=>String(a.examDate).localeCompare(String(b.examDate))||String(a.startTime).localeCompare(String(b.startTime)));
    root.innerHTML='<div class="section-head"><div class="schedule-tabs"><button class="secondary '+(tab==='timetable'?'active':'')+'" data-schedule-tab="timetable">Weekly Timetable</button><button class="secondary '+(tab==='datesheet'?'active':'')+'" data-schedule-tab="datesheet">Date Sheets</button></div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      '<div class="schedule-toolbar"><select id="scheduleClassFilter">'+optionList(filter,'All accessible classes')+'</select>'+(tab==='datesheet'?'<select id="dateExamFilter"><option value="">All exams</option>'+exams.map(x=>'<option '+(x===examFilter?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>':'<span></span>')+'<button id="'+(tab==='timetable'?'printSchedule':'printDateSheet')+'" class="secondary">Print '+(tab==='timetable'?'Timetable':'Date Sheet')+'</button></div>'+
      (canManage()?'<div class="coverage-note"><button id="scheduleRefreshSchool" type="button" class="secondary">Refresh Classes & Syllabus</button> <small>School records or subjects changed? Update the dropdowns here.</small></div>':'')+
      '<div class="schedule-summary"><span>'+tt.length+' timetable periods</span><span>'+ds.length+' date-sheet papers</span></div><div id="scheduleEditor">'+(tab==='timetable'?timetableEditor():dateSheetEditor())+'</div><div style="margin-top:18px">'+(tab==='timetable'?timetableRows(tt):dateSheetRows(ds))+'</div>';
    root.querySelectorAll('[data-schedule-tab]').forEach(b=>b.onclick=()=>{root.dataset.tab=b.dataset.scheduleTab;render()});bind();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('scheduleCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_TIMETABLE_DATESHEET={render,pullCloud,cloudReady,loadSchoolCatalog,classSections,knownClass,optionList,syncSubjectCatalog,getCatalog:()=>cloudCatalog,getScheduleScope:()=>scheduleDataScope,currentTimetable,currentDateSheets,scheduleReady,refreshSchoolOptions,saveTimetable};
})();
