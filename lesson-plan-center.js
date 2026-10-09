(function(){
  const PLAN_KEY='edunizam_lesson_plans_v1';
  const UNIT_KEY='edunizam_syllabus_units_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isStaff=()=>['teacher','head'].includes(role());
  const isHead=()=>role()==='head';
  let lessonPlanSaveInFlight=false,syllabusUnitSaveInFlight=false;
  const lessonDeleteInFlight=new Set();
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
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function classOptions(){
    const set=new Set();
    visibleStudents().forEach(s=>{if(s.className)set.add(String(s.className))});
    try{JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]').forEach(x=>{if(x.className)set.add(String(x.className))})}catch(_){}
    if(isHead()){['Play Group','Nursery','Prep',...Array.from({length:12},(_,i)=>String(i+1))].forEach(x=>set.add(x))}
    return [...set].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  }
  function relevantToFamily(x){
    if(isStaff())return true;
    return visibleStudents().some(s=>String(s.className||'')===String(x.className||'')&&(!x.sectionName||String(s.sectionName||'')===String(x.sectionName||'')));
  }
  function visiblePlans(rows){
    if(isStaff())return rows;
    return rows.filter(x=>x.status==='Published'&&relevantToFamily(x));
  }
  function visibleUnits(rows){
    if(isStaff())return rows;
    return rows.filter(x=>x.familyVisible&&relevantToFamily(x));
  }
  function mapPlan(x){return {id:x.id,className:x.class_name,sectionName:x.section_name||'',subject:x.subject,weekStart:x.week_start,topic:x.topic,objectives:x.objectives||'',activities:x.activities||'',homeworkNote:x.homework_note||'',status:x.status,createdBy:x.created_by||'',createdAt:x.created_at}}
  function mapUnit(x){return {id:x.id,className:x.class_name,sectionName:x.section_name||'',subject:x.subject,unitTitle:x.unit_title,targetEnd:x.target_end||'',completion:Number(x.completion_percent||0),status:x.status,familyVisible:x.family_visible===true,createdBy:x.created_by||'',createdAt:x.created_at}}
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId;
    const {p,u}=await runCloud('lesson-syllabus-load:'+id,'Lesson plans and syllabus',async({signal}={})=>{
      const [p,u]=await Promise.all([
        withSignal(c.from('lesson_plans').select('*').eq('institution_id',id).order('week_start',{ascending:false}),signal),
        withSignal(c.from('syllabus_progress_units').select('*').eq('institution_id',id).order('subject').order('unit_title'),signal)
      ]);
      if(p.error)throw p.error;if(u.error)throw u.error;return {p,u};
    },{timeout:7000,retries:1});
    write(PLAN_KEY,(p.data||[]).map(mapPlan));write(UNIT_KEY,(u.data||[]).map(mapUnit));
  }
  async function savePlanCloud(item){
    const inst=cfg().institutionId,payload={institution_id:inst,class_name:item.className,section_name:item.sectionName||null,subject:item.subject,week_start:item.weekStart,topic:item.topic,objectives:item.objectives||null,activities:item.activities||null,homework_note:item.homeworkNote||null,status:item.status,created_by:item.createdBy||cloud().state.user.id,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()};
    const writeOnce=async({signal}={})=>{
      let q=item.cloudExisting?cloud().state.client.from('lesson_plans').update(payload).eq('institution_id',inst).eq('id',item.id):cloud().state.client.from('lesson_plans').insert(payload);
      q=q.select().single();q=withSignal(q,signal);const {data,error}=await q;if(error)throw error;return mapPlan(data);
    };
    try{return await runCloud('lesson-plan-save:'+inst+':'+String(item.id||item.className+':'+item.weekStart+':'+item.subject),'Save lesson plan',writeOnce,{timeout:8000,retries:item.cloudExisting?1:0})}
    catch(error){
      if(item.cloudExisting)throw error;
      const reconcile=async({signal}={})=>{
        let q=cloud().state.client.from('lesson_plans').select('*').eq('institution_id',inst).eq('class_name',item.className).eq('subject',item.subject).eq('week_start',item.weekStart).eq('topic',item.topic).eq('created_by',payload.created_by);
        q=item.sectionName?q.eq('section_name',item.sectionName):q.is('section_name',null);q=q.order('created_at',{ascending:false}).limit(2);q=withSignal(q,signal);
        const out=await q;if(out.error)throw out.error;return out.data||[];
      };
      const rows=await runCloud('lesson-plan-reconcile:'+inst+':'+item.className+':'+item.weekStart+':'+item.subject,'Reconcile lesson plan',reconcile,{timeout:5000,retries:1});
      if(rows.length===1)return mapPlan(rows[0]);throw error;
    }
  }
  async function saveUnitCloud(item){
    const inst=cfg().institutionId,payload={institution_id:inst,class_name:item.className,section_name:item.sectionName||null,subject:item.subject,unit_title:item.unitTitle,target_end:item.targetEnd||null,completion_percent:item.completion,status:item.status,family_visible:item.familyVisible,created_by:item.createdBy||cloud().state.user.id,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()};
    const writeOnce=async({signal}={})=>{
      let q=item.cloudExisting?cloud().state.client.from('syllabus_progress_units').update(payload).eq('institution_id',inst).eq('id',item.id):cloud().state.client.from('syllabus_progress_units').insert(payload);
      q=q.select().single();q=withSignal(q,signal);const {data,error}=await q;if(error)throw error;return mapUnit(data);
    };
    try{return await runCloud('syllabus-unit-save:'+inst+':'+String(item.id||item.className+':'+item.subject+':'+item.unitTitle),'Save syllabus unit',writeOnce,{timeout:8000,retries:item.cloudExisting?1:0})}
    catch(error){
      if(item.cloudExisting)throw error;
      const reconcile=async({signal}={})=>{
        let q=cloud().state.client.from('syllabus_progress_units').select('*').eq('institution_id',inst).eq('class_name',item.className).eq('subject',item.subject).eq('unit_title',item.unitTitle).eq('created_by',payload.created_by);
        q=item.sectionName?q.eq('section_name',item.sectionName):q.is('section_name',null);q=q.order('created_at',{ascending:false}).limit(2);q=withSignal(q,signal);
        const out=await q;if(out.error)throw out.error;return out.data||[];
      };
      const rows=await runCloud('syllabus-unit-reconcile:'+inst+':'+item.className+':'+item.subject+':'+item.unitTitle,'Reconcile syllabus unit',reconcile,{timeout:5000,retries:1});
      if(rows.length===1)return mapUnit(rows[0]);throw error;
    }
  }
  async function deleteCloud(table,id){
    const inst=cfg().institutionId;
    return runCloud('lesson-delete:'+table+':'+inst+':'+id,'Delete lesson record',async({signal}={})=>{
      let q=cloud().state.client.from(table).delete().eq('institution_id',inst).eq('id',id);q=withSignal(q,signal);
      const {error}=await q;if(error)throw error;
    },{timeout:8000,retries:1});
  }
  function planEditor(edit=null){
    if(!isStaff())return '<div class="coverage-note">Aap ko sirf Published lesson plans aur family-visible syllabus progress dikhaya ja raha hai.</div>';
    return '<article class="card"><h3>'+(edit?'Edit Weekly Lesson Plan':'Create Weekly Lesson Plan')+'</h3><div class="form-grid">'+
      '<input id="lpPlanEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<select id="lpPlanClass"><option value="">Select class</option>'+classOptions().map(c=>'<option value="'+esc(c)+'" '+(edit?.className===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="lpPlanSection" placeholder="Section (optional)" value="'+esc(edit?.sectionName||'')+'">'+
      '<input id="lpPlanSubject" list="lpPlanSubjects" placeholder="Subject (choose from catalog)" value="'+esc(edit?.subject||'')+'"><datalist id="lpPlanSubjects"></datalist>'+
      '<input id="lpWeekStart" type="date" value="'+esc(edit?.weekStart||today())+'">'+
      '<input id="lpTopic" list="lpPlanTopics" placeholder="Main topic / chapter (or custom)" value="'+esc(edit?.topic||'')+'"><datalist id="lpPlanTopics"></datalist>'+
      '<textarea id="lpObjectives" rows="2" placeholder="Learning objectives">'+esc(edit?.objectives||'')+'</textarea>'+
      '<textarea id="lpActivities" rows="2" placeholder="Teaching activities / method">'+esc(edit?.activities||'')+'</textarea>'+
      '<input id="lpHomework" placeholder="Homework / follow-up (optional)" value="'+esc(edit?.homeworkNote||'')+'">'+
      '<select id="lpPlanStatus">'+['Draft','Published','Completed'].map(x=>'<option '+(edit?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<p id="lpPlanCatalogNote" class="coverage-note" style="grid-column:1/-1">Choose class and subject to load suggested topics.</p><button id="lpSavePlan">'+(edit?'Update Plan':'Save Plan')+'</button>'+(edit?'<button id="lpCancelPlan" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function unitEditor(edit=null){
    if(!isStaff())return '';
    return '<article class="card" style="margin-top:16px"><h3>'+(edit?'Edit Syllabus Unit':'Add Syllabus Unit / Chapter')+'</h3><div class="form-grid">'+
      '<input id="lpUnitEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<select id="lpUnitClass"><option value="">Select class</option>'+classOptions().map(c=>'<option value="'+esc(c)+'" '+(edit?.className===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="lpUnitSection" placeholder="Section (optional)" value="'+esc(edit?.sectionName||'')+'">'+
      '<input id="lpUnitSubject" list="lpUnitSubjects" placeholder="Subject (choose from catalog)" value="'+esc(edit?.subject||'')+'"><datalist id="lpUnitSubjects"></datalist>'+
      '<input id="lpUnitTitle" list="lpUnitTopics" placeholder="Syllabus unit (or custom)" value="'+esc(edit?.unitTitle||'')+'"><datalist id="lpUnitTopics"></datalist>'+
      '<input id="lpTargetEnd" type="date" value="'+esc(edit?.targetEnd||'')+'">'+
      '<input id="lpCompletion" type="number" min="0" max="100" value="'+esc(edit?.completion??0)+'" placeholder="Completion %">'+
      '<select id="lpUnitStatus">'+['Planned','In Progress','Completed'].map(x=>'<option '+(edit?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<label><input id="lpFamilyVisible" type="checkbox" '+(edit?.familyVisible?'checked':'')+'> Show progress to Student/Parent</label>'+
      '<p id="lpUnitCatalogNote" class="coverage-note" style="grid-column:1/-1">A unit becomes a school record only after you save it.</p><button id="lpSaveUnit">'+(edit?'Update Unit':'Save Unit')+'</button>'+(edit?'<button id="lpCancelUnit" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function metrics(plans,units){
    const published=plans.filter(x=>x.status==='Published').length,completed=units.filter(x=>x.status==='Completed'||x.completion>=100).length,avg=units.length?Math.round(units.reduce((a,x)=>a+Number(x.completion||0),0)/units.length):0;
    return '<div class="cards"><article class="card stat"><span>Lesson Plans</span><strong>'+plans.length+'</strong></article><article class="card stat"><span>Published Plans</span><strong>'+published+'</strong></article><article class="card stat"><span>Syllabus Units</span><strong>'+units.length+'</strong></article><article class="card stat"><span>Completed Units</span><strong>'+completed+'</strong></article><article class="card stat"><span>Avg Progress</span><strong>'+avg+'%</strong></article></div>';
  }
  function planCard(x){
    const canManage=isHead()||(role()==='teacher'&&(!x.createdBy||String(x.createdBy)===String(cloud()?.state?.user?.id||'')));
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.status)+'</span></div><h3>'+esc(x.topic)+'</h3><p class="muted">Class '+esc(x.className)+(x.sectionName?' - '+esc(x.sectionName):'')+' · Week '+esc(x.weekStart)+'</p>'+(x.objectives?'<p><strong>Objectives:</strong> '+esc(x.objectives)+'</p>':'')+(x.activities?'<p><strong>Activities:</strong> '+esc(x.activities)+'</p>':'')+(x.homeworkNote?'<p><strong>Follow-up:</strong> '+esc(x.homeworkNote)+'</p>':'')+(canManage?'<div class="paper-actions"><button data-lp-edit-plan="'+esc(x.id)+'">Edit</button><button class="secondary" data-lp-delete-plan="'+esc(x.id)+'">Delete</button></div>':'')+'</article>';
  }
  function unitCard(x){
    const canManage=isHead()||(role()==='teacher'&&(!x.createdBy||String(x.createdBy)===String(cloud()?.state?.user?.id||'')));
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.status)+'</span></div><h3>'+esc(x.unitTitle)+'</h3><p class="muted">Class '+esc(x.className)+(x.sectionName?' - '+esc(x.sectionName):'')+(x.targetEnd?' · Target '+esc(x.targetEnd):'')+'</p><p><strong>Completion:</strong> '+Number(x.completion||0)+'%</p><div style="height:9px;border-radius:999px;background:#e6ecef;overflow:hidden"><div style="height:100%;width:'+Math.min(100,Math.max(0,Number(x.completion||0)))+'%;background:currentColor"></div></div>'+(canManage?'<div class="paper-actions" style="margin-top:12px"><button data-lp-edit-unit="'+esc(x.id)+'">Edit</button><button class="secondary" data-lp-delete-unit="'+esc(x.id)+'">Delete</button></div>':'')+'</article>';
  }
  async function savePlan(){
    const btn=$('lpSavePlan');if(lessonPlanSaveInFlight||btn?.disabled)return;
    const id=$('lpPlanEditId')?.value||'',className=$('lpPlanClass')?.value,subject=$('lpPlanSubject')?.value.trim(),topic=$('lpTopic')?.value.trim(),weekStart=$('lpWeekStart')?.value;
    if(!className||!subject||!topic||!weekStart)return alert('Class, subject, topic aur week start required hain.');
    const rows=read(PLAN_KEY),old=rows.find(x=>String(x.id)===String(id));
    lessonPlanSaveInFlight=true;setBusy(btn,true,id?'Updating...':'Saving...');
    try{
      let item={id:id||String(Date.now()),className,sectionName:$('lpPlanSection')?.value.trim()||'',subject,weekStart,topic,objectives:$('lpObjectives')?.value.trim()||'',activities:$('lpActivities')?.value.trim()||'',homeworkNote:$('lpHomework')?.value.trim()||'',status:$('lpPlanStatus')?.value||'Draft',createdBy:old?.createdBy||cloud()?.state?.user?.id||'',createdAt:old?.createdAt||new Date().toISOString(),cloudExisting:!!(old&&cloudReady())};
      try{if(cloudReady())item=await savePlanCloud(item)}catch(e){return alert('Cloud lesson-plan save failed: '+(e.message||e))}
      write(PLAN_KEY,rows.filter(x=>String(x.id)!==String(id)).concat(item));render();
    }finally{lessonPlanSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  async function saveUnit(){
    const btn=$('lpSaveUnit');if(syllabusUnitSaveInFlight||btn?.disabled)return;
    const id=$('lpUnitEditId')?.value||'',className=$('lpUnitClass')?.value,subject=$('lpUnitSubject')?.value.trim(),unitTitle=$('lpUnitTitle')?.value.trim(),completion=Math.max(0,Math.min(100,Number($('lpCompletion')?.value||0)));
    if(!className||!subject||!unitTitle)return alert('Class, subject aur unit title required hain.');
    let status=$('lpUnitStatus')?.value||'Planned';if(completion>=100)status='Completed';else if(completion>0&&status==='Planned')status='In Progress';
    const rows=read(UNIT_KEY),old=rows.find(x=>String(x.id)===String(id));
    syllabusUnitSaveInFlight=true;setBusy(btn,true,id?'Updating...':'Saving...');
    try{
      let item={id:id||String(Date.now()),className,sectionName:$('lpUnitSection')?.value.trim()||'',subject,unitTitle,targetEnd:$('lpTargetEnd')?.value||'',completion,status,familyVisible:!!$('lpFamilyVisible')?.checked,createdBy:old?.createdBy||cloud()?.state?.user?.id||'',createdAt:old?.createdAt||new Date().toISOString(),cloudExisting:!!(old&&cloudReady())};
      try{if(cloudReady())item=await saveUnitCloud(item)}catch(e){return alert('Cloud syllabus progress save failed: '+(e.message||e))}
      write(UNIT_KEY,rows.filter(x=>String(x.id)!==String(id)).concat(item));render();
    }finally{syllabusUnitSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  function editPlan(id){const x=read(PLAN_KEY).find(r=>String(r.id)===String(id));if(!x)return;const b=$('lpPlanEditor');if(b)b.innerHTML=planEditor(x);bindEditors()}
  function editUnit(id){const x=read(UNIT_KEY).find(r=>String(r.id)===String(id));if(!x)return;const b=$('lpUnitEditor');if(b)b.innerHTML=unitEditor(x);bindEditors()}
  async function remove(kind,id,btn){
    const flightKey=kind+':'+String(id||'');if(!isStaff()||lessonDeleteInFlight.has(flightKey)||btn?.disabled)return;
    if(!confirm('Delete this '+(kind==='plan'?'lesson plan':'syllabus unit')+'?'))return;
    const key=kind==='plan'?PLAN_KEY:UNIT_KEY,table=kind==='plan'?'lesson_plans':'syllabus_progress_units';
    lessonDeleteInFlight.add(flightKey);setBusy(btn,true,'Deleting...');
    try{
      try{if(cloudReady())await deleteCloud(table,id)}catch(e){return alert('Cloud delete failed: '+(e.message||e))}
      write(key,read(key).filter(x=>String(x.id)!==String(id)));render();
    }finally{lessonDeleteInFlight.delete(flightKey);if(btn?.isConnected)setBusy(btn,false)}
  }
  function printProgress(units){
    const st=settings(),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Syllabus Progress</title><style>body{font-family:Arial;padding:28px;color:#17324a}.head{text-align:center}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border:1px solid #ccd6dc;padding:7px;text-align:left}</style></head><body><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Syllabus Progress Report</h3></div><table><thead><tr><th>Class</th><th>Subject</th><th>Unit / Chapter</th><th>Target</th><th>Completion</th><th>Status</th></tr></thead><tbody>'+units.map(x=>'<tr><td>'+esc(x.className+(x.sectionName?' - '+x.sectionName:''))+'</td><td>'+esc(x.subject)+'</td><td>'+esc(x.unitTitle)+'</td><td>'+esc(x.targetEnd||'-')+'</td><td>'+Number(x.completion||0)+'%</td><td>'+esc(x.status)+'</td></tr>').join('')+'</tbody></table></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function refreshSyllabusLists(prefix){
    const cl=$('lp'+prefix+'Class')?.value||'',sub=$('lp'+prefix+'Subject')?.value||'';
    const numberMatch=String(cl).match(/(1[0-2]|[1-9])/);
    const grade=numberMatch?String(Number(numberMatch[1])):'';
    const D=window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||window.EDUNIZAM_PRACTICE_DATA||{};
    const current=D.subjects?.[grade]||[];
    const defaults=['English','Urdu','Mathematics','General Science','General Knowledge','Islamiat / Ethics','Nazra Quran','Social Studies'];
    const subjects=current.length?current:defaults;
    const subjectList=$('lp'+prefix+'Subjects');
    if(subjectList)subjectList.innerHTML=subjects.map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const chapterList=$('lp'+prefix+'Topics');
    const chapters=D.chapters?.[grade+'|'+sub]||[];
    if(chapterList)chapterList.innerHTML=chapters.map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const note=$('lp'+prefix+'CatalogNote');
    if(note)note.textContent=chapters.length?
      chapters.length+' EduNizam concept topic options. These are NOT confirmed official textbook chapters.':
      (grade&&sub?'No matching concept topic. Enter the currently prescribed textbook chapter.':'Select a class and subject to see topic suggestions.');
  }
  function bindEditors(){
    $('lpSavePlan')?.addEventListener('click',savePlan);$('lpCancelPlan')?.addEventListener('click',render);
    $('lpSaveUnit')?.addEventListener('click',saveUnit);$('lpCancelUnit')?.addEventListener('click',render);
    for(const prefix of ['Plan','Unit']){for(const suffix of ['Class','Subject'])$('lp'+prefix+suffix)?.addEventListener('change',()=>refreshSyllabusLists(prefix));$('lp'+prefix+'Subject')?.addEventListener('input',()=>refreshSyllabusLists(prefix));refreshSyllabusLists(prefix)}
  }
  function bind(units){
    bindEditors();$('lpPrint')?.addEventListener('click',()=>printProgress(units));
    document.querySelectorAll('[data-lp-edit-plan]').forEach(b=>b.onclick=()=>editPlan(b.dataset.lpEditPlan));
    document.querySelectorAll('[data-lp-delete-plan]').forEach(b=>b.onclick=()=>remove('plan',b.dataset.lpDeletePlan,b));
    document.querySelectorAll('[data-lp-edit-unit]').forEach(b=>b.onclick=()=>editUnit(b.dataset.lpEditUnit));
    document.querySelectorAll('[data-lp-delete-unit]').forEach(b=>b.onclick=()=>remove('unit',b.dataset.lpDeleteUnit,b));
  }
  async function render(){
    const root=$('lessonCenterApp');if(!root)return;
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Lesson/syllabus cloud sync:',e.message)}}
    const plans=visiblePlans(read(PLAN_KEY)).sort((a,b)=>String(b.weekStart).localeCompare(String(a.weekStart)));
    const units=visibleUnits(read(UNIT_KEY)).sort((a,b)=>String(a.subject).localeCompare(String(b.subject))||String(a.unitTitle).localeCompare(String(b.unitTitle)));
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><button id="lpPrint" class="secondary">Print Syllabus Progress</button></div>'+
      metrics(plans,units)+'<div id="lpPlanEditor" style="margin-top:16px">'+planEditor()+'</div><div id="lpUnitEditor">'+unitEditor()+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Weekly Lesson Plans</h3><p class="muted">Planned teaching topics and learning objectives.</p></div></div><div class="paper-grid">'+(plans.length?plans.map(planCard).join(''):'<div class="empty-state">No lesson plans available.</div>')+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Syllabus Progress</h3><p class="muted">Unit/chapter completion tracking.</p></div></div><div class="paper-grid">'+(units.length?units.map(unitCard).join(''):'<div class="empty-state">No syllabus units available.</div>')+'</div>';
    bind(units);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('lessonCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_LESSON_CENTER={render,pullCloud,cloudReady};
})();