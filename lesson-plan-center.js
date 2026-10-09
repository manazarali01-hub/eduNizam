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
  let cloudClassRows=[],cloudClassScope='',cloudLessonScope='';
  const currentSchoolScope=()=>String(cfg().institutionId||'')+'|'+String(cloud()?.state?.user?.id||'');
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
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||[]}
  function registeredClasses(){
    const rows=[];
    const scope=window.EDUNIZAM_ROLE_SCOPE;
    const teacherKeys=role()==='teacher'?scope?.teacherClassKeys?.()||new Set():new Set();
    // Cloud-mode forms must use this institution's freshly scoped directory,
    // not unscoped rows left in localStorage from another school.
    let directory=[];
    if(cloudReady()){
      if(cloudClassScope===currentSchoolScope())directory=cloudClassRows;
    }else{
      try{directory=JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]')}catch(_){}
    }
    for(const row of Array.isArray(directory)?directory:[]){
      if(row.active===false)continue;
      const k=String(row.className||'').trim().toLowerCase()+'|'+String(row.sectionName||'').trim().toLowerCase();
      if(isHead()||(role()==='teacher'&&teacherKeys.has(k)))rows.push(row);
    }
    // Admin class choices in cloud mode come from the real institution
    // directory, never from unscoped legacy student rows.
    if(!cloudReady()||!isHead())for(const st of visibleStudents())rows.push({className:st.className,sectionName:st.sectionName});
    return window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.registeredSections(rows)||[];
  }
  function classOptions(){return window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.distinct(registeredClasses().map(x=>x.className))||[]}
  function savedUnits(){return cloudReady()&&cloudLessonScope!==currentSchoolScope()?[]:read(UNIT_KEY)}
  function syllabusOptionData(cls,subject){
    return window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.chapters(cls,subject,window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{},savedUnits())||{saved:[],concepts:[]};
  }
  const textNorm=x=>String(x||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
  function recordedSchoolTopic(cls,section,subject,topic){
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    return savedUnits().some(unit=>api?.sameClass?.(unit.className,cls)&&
      api?.subjectKey?.(unit.subject)===api?.subjectKey?.(subject)&&
      textNorm(unit.unitTitle)===textNorm(topic)&&
      (!unit.sectionName||textNorm(unit.sectionName)===textNorm(section)));
  }
  function unitBookValidation(data){
    if(!data.textbookTitle||!data.curriculumBoard)
      return 'Enter the actual prescribed textbook title and curriculum board before registering this school unit.';
    if(data.editionYear!==''&&(!/^\d{4}$/.test(String(data.editionYear))||Number(data.editionYear)<1900||Number(data.editionYear)>2100))
      return 'Edition year must be 1900–2100, or blank.';
    if(data.sourceUrl&&!/^https:\/\/[^\s]+$/i.test(data.sourceUrl))
      return 'Source URL must be a valid https:// link, or blank for a physical textbook.';
    if(!Number.isInteger(data.completion)||data.completion<0||data.completion>100)
      return 'Completion must be a whole number between 0 and 100.';
    if(data.status==='Completed'&&data.completion!==100)
      return 'Completed status requires 100% completion.';
    return '';
  }
  function sectionList(prefix){
    const cls=$('lp'+prefix+'Class')?.value||'';
    const sections=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.sections(cls,registeredClasses())||[];
    const list=$('lp'+prefix+'Sections');
    if(list)list.innerHTML=sections.map(x=>'<option value="'+esc(x)+'"></option>').join('');
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
  function mapUnit(x){return {id:x.id,className:x.class_name,sectionName:x.section_name||'',subject:x.subject,unitTitle:x.unit_title,
     textbookTitle:x.textbook_title||'',curriculumBoard:x.curriculum_board||'',editionYear:x.edition_year||'',sourceUrl:x.source_url||'',
     targetEnd:x.target_end||'',completion:Number(x.completion_percent||0),status:x.status,familyVisible:x.family_visible===true,createdBy:x.created_by||'',createdAt:x.created_at,cloudExisting:true}}
  async function pullSchoolClasses(){
    if(!cloudReady())return;
    const id=cfg().institutionId,scope=currentSchoolScope(),client=cloud().state.client;
    cloudClassRows=[];cloudClassScope='';
    try{
      const rows=await runCloud('lesson-class-directory:'+scope,'Lesson school class options',async({signal}={})=>{
        let q=client.from('class_sections').select('class_name,section_name,active')
          .eq('institution_id',id).eq('active',true).limit(1200);
        q=withSignal(q,signal);
        const {data,error}=await q;
        if(error)throw error;
        return data||[];
      },{timeout:6500,retries:0});
      if(!cloudReady()||currentSchoolScope()!==scope)return;
      cloudClassRows=rows.map(x=>({className:x.class_name,sectionName:x.section_name,active:x.active!==false}));
      cloudClassScope=scope;
    }catch(error){
      console.warn('Lesson class directory unavailable:',error?.message||error);
    }
  }
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId,scope=currentSchoolScope();
    // Class directory must remain independently loadable even if the lesson
    // tables are unavailable. Both requests run together to avoid long waits.
    const classesJob=pullSchoolClasses();
    try{
      const {p,u}=await runCloud('lesson-syllabus-load:'+scope,'Lesson plans and syllabus',async({signal}={})=>{
        const [p,u]=await Promise.all([
          withSignal(c.from('lesson_plans').select('*').eq('institution_id',id).order('week_start',{ascending:false}),signal),
          withSignal(c.from('syllabus_progress_units').select('*').eq('institution_id',id).order('subject').order('unit_title'),signal)
        ]);
        if(p.error)throw p.error;if(u.error)throw u.error;return {p,u};
      },{timeout:7000,retries:1});
      if(!cloudReady()||currentSchoolScope()!==scope)return;
      write(PLAN_KEY,(p.data||[]).map(mapPlan));write(UNIT_KEY,(u.data||[]).map(mapUnit));
      cloudLessonScope=scope;
    }finally{await classesJob}
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
    const inst=cfg().institutionId,payload={institution_id:inst,class_name:item.className,section_name:item.sectionName||null,subject:item.subject,unit_title:item.unitTitle,
       textbook_title:item.textbookTitle,curriculum_board:item.curriculumBoard,edition_year:item.editionYear||null,source_url:item.sourceUrl||null,
       target_end:item.targetEnd||null,completion_percent:item.completion,status:item.status,family_visible:item.familyVisible,created_by:item.createdBy||cloud().state.user.id,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()};
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
      '<select id="lpPlanClass"><option value="">Select registered class</option>'+classOptions().map(c=>'<option value="'+esc(c)+'" '+(edit?.className===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="lpPlanSection" list="lpPlanSections" placeholder="Section (from school data)" value="'+esc(edit?.sectionName||'')+'"><datalist id="lpPlanSections"></datalist>'+
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
      '<select id="lpUnitClass"><option value="">Select registered class</option>'+classOptions().map(c=>'<option value="'+esc(c)+'" '+(edit?.className===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="lpUnitSection" list="lpUnitSections" placeholder="Section (from school data)" value="'+esc(edit?.sectionName||'')+'"><datalist id="lpUnitSections"></datalist>'+
      '<input id="lpUnitSubject" list="lpUnitSubjects" placeholder="Subject (choose from catalog)" value="'+esc(edit?.subject||'')+'"><datalist id="lpUnitSubjects"></datalist>'+
      '<input id="lpUnitTitle" list="lpUnitTopics" placeholder="Exact chapter / unit title *" value="'+esc(edit?.unitTitle||'')+'"><datalist id="lpUnitTopics"></datalist>'+
       '<input id="lpTextbookTitle" placeholder="Prescribed textbook title *" value="'+esc(edit?.textbookTitle||'')+'">'+
       '<select id="lpCurriculumBoard" aria-label="Textbook authority">'+
         [['','Select school textbook board'],['punjab-pectaa','Punjab · PECTAA'],['federal-fbise','Federal · FBISE'],['sindh-stbb','Sindh · STBB'],['kp-textbook','Khyber Pakhtunkhwa'],['balochistan','Balochistan'],['other','Other / School-specific']].map(([v,t])=>'<option value="'+v+'" '+((edit?.curriculumBoard||'')===v?'selected':'')+'>'+t+'</option>').join('')+
       '</select>'+
       '<input id="lpEditionYear" type="number" min="1900" max="2100" step="1" placeholder="Textbook edition year (optional)" value="'+esc(edit?.editionYear||'')+'">'+
       '<input id="lpSourceUrl" type="url" placeholder="Textbook source link (optional, https://)" value="'+esc(edit?.sourceUrl||'')+'">'+
       '<p class="coverage-note" style="grid-column:1/-1">A teacher-entered book title is NOT official textbook verification. <a href="https://pectaa.edu.pk/books-and-publications/" target="_blank" rel="noopener noreferrer">Punjab official textbook directory</a></p>'+
      '<input id="lpTargetEnd" type="date" value="'+esc(edit?.targetEnd||'')+'">'+
      '<input id="lpCompletion" type="number" min="0" max="100" value="'+esc(edit?.completion??0)+'" placeholder="Completion %">'+
      '<select id="lpUnitStatus">'+['Planned','In Progress','Completed'].map(x=>'<option '+(edit?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<label><input id="lpFamilyVisible" type="checkbox" '+(edit?.familyVisible?'checked':'')+'> Show progress to Student/Parent</label>'+
      '<p id="lpUnitCatalogNote" class="coverage-note" style="grid-column:1/-1">Saved book details are traceable school-entered metadata, not textbook certification.</p><button id="lpSaveUnit">'+(edit?'Update Unit':'Save Unit')+'</button>'+(edit?'<button id="lpCancelUnit" class="secondary">Cancel</button>':'')+
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
    if(!classOptions().includes(className)||!window.EDUNIZAM_ACADEMIC_FORM_OPTIONS.sectionMatches(className,$('lpPlanSection')?.value,registeredClasses()))return alert('Choose an accessible registered class / section. Configure it in Academic Groups first.');
    if(cloudReady()&&cloudLessonScope!==currentSchoolScope())return alert('Current school lesson data not loaded. Refresh this section.');
    if(($('lpPlanStatus')?.value||'Draft')!=='Draft'&&!recordedSchoolTopic(className,$('lpPlanSection')?.value||'',subject,topic))
      return alert('To publish/complete, select a school-recorded chapter for this class/section/subject. Unverified topics can be saved as Draft only.');
    const rows=read(PLAN_KEY),old=rows.find(x=>String(x.id)===String(id));
    lessonPlanSaveInFlight=true;setBusy(btn,true,id?'Updating...':'Saving...');
    const saveScope=currentSchoolScope();
    try{
      let item={id:id||String(Date.now()),className,sectionName:$('lpPlanSection')?.value.trim()||'',subject,weekStart,topic,objectives:$('lpObjectives')?.value.trim()||'',activities:$('lpActivities')?.value.trim()||'',homeworkNote:$('lpHomework')?.value.trim()||'',status:$('lpPlanStatus')?.value||'Draft',createdBy:old?.createdBy||cloud()?.state?.user?.id||'',createdAt:old?.createdAt||new Date().toISOString(),cloudExisting:!!(old&&cloudReady())};
      try{if(cloudReady())item=await savePlanCloud(item)}catch(e){return alert('Cloud lesson-plan save failed: '+(e.message||e))}
      if(cloudReady()&&currentSchoolScope()!==saveScope)return;
      write(PLAN_KEY,rows.filter(x=>String(x.id)!==String(id)).concat(item));render();
    }finally{lessonPlanSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  async function saveUnit(){
    const btn=$('lpSaveUnit');if(syllabusUnitSaveInFlight||btn?.disabled)return;
    const id=$('lpUnitEditId')?.value||'',className=$('lpUnitClass')?.value,subject=$('lpUnitSubject')?.value.trim(),unitTitle=$('lpUnitTitle')?.value.trim(),
      completion=Number(String($('lpCompletion')?.value??'0').trim()),textbookTitle=$('lpTextbookTitle')?.value?.trim()||'',
      curriculumBoard=$('lpCurriculumBoard')?.value||'',editionYear=String($('lpEditionYear')?.value||'').trim(),sourceUrl=$('lpSourceUrl')?.value?.trim()||'';
    if(!className||!subject||!unitTitle)return alert('Class, subject aur unit title required hain.');
    if(!classOptions().includes(className)||!window.EDUNIZAM_ACADEMIC_FORM_OPTIONS.sectionMatches(className,$('lpUnitSection')?.value,registeredClasses()))return alert('Choose an accessible registered class / section. Configure it in Academic Groups first.');
    if(cloudReady()&&cloudLessonScope!==currentSchoolScope())return alert('Current school syllabus has not loaded. Refresh this section.');
    let status=$('lpUnitStatus')?.value||'Planned';
    if(completion===100)status='Completed';else if(completion>0&&status==='Planned')status='In Progress';
    const message=unitBookValidation({textbookTitle,curriculumBoard,editionYear,sourceUrl,completion,status});
    if(message)return alert(message);
    const rows=savedUnits(),old=rows.find(x=>String(x.id)===String(id));
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    if(rows.some(x=>String(x.id)!==String(id)&&api?.sameClass?.(x.className,className)&&
        textNorm(x.sectionName)===textNorm($('lpUnitSection')?.value||'')&&api?.subjectKey?.(x.subject)===api?.subjectKey?.(subject)&&
        textNorm(x.unitTitle)===textNorm(unitTitle)))
      return alert('This class/section/subject already has this chapter. Edit the existing unit instead of duplicating it.');
    syllabusUnitSaveInFlight=true;setBusy(btn,true,id?'Updating...':'Saving...');
    const saveScope=currentSchoolScope();
    try{
      let item={id:id||String(Date.now()),className,sectionName:$('lpUnitSection')?.value.trim()||'',subject,unitTitle,textbookTitle,curriculumBoard,editionYear,sourceUrl,targetEnd:$('lpTargetEnd')?.value||'',completion,status,familyVisible:!!$('lpFamilyVisible')?.checked,createdBy:old?.createdBy||cloud()?.state?.user?.id||'',createdAt:old?.createdAt||new Date().toISOString(),cloudExisting:!!(old&&cloudReady())};
      try{if(cloudReady())item=await saveUnitCloud(item)}catch(e){return alert('Cloud syllabus progress save failed: '+(e.message||e))}
      if(cloudReady()&&currentSchoolScope()!==saveScope)return;
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
    const cls=$('lp'+prefix+'Class')?.value||'',subject=$('lp'+prefix+'Subject')?.value||'';
    const catalog=window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{},api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    const subjects=api?.subjects(cls,catalog,savedUnits())||[];
    const list=$('lp'+prefix+'Subjects');
    if(list)list.innerHTML=subjects.map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const unit=syllabusOptionData(cls,subject),chapters=[...unit.saved,...unit.concepts];
    const chapterList=$('lp'+prefix+'Topics');
    if(chapterList)chapterList.innerHTML=chapters.map(x=>'<option value="'+esc(x)+'"></option>').join('');
    sectionList(prefix);
    const note=$('lp'+prefix+'CatalogNote');
    if(note)note.textContent=!cls?'Register a real school class in Academic Groups before planning.':!subject?
     'Select subject. The concept catalog is not an official textbook chapter list.':
     unit.saved.length+' school-saved syllabus unit(s); '+unit.concepts.length+' unverified concept suggestion(s). Verify the prescribed textbook before publication.';
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
    if(cloudReady()&&(!root.dataset.cloudLoaded||root.dataset.cloudScope!==currentSchoolScope())){
      root.dataset.cloudLoaded='1';root.dataset.cloudScope=currentSchoolScope();
      try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Lesson/syllabus cloud sync:',e.message)}
    }
    const scoped=cloudReady()&&cloudLessonScope!==currentSchoolScope();
    const plans=visiblePlans(scoped?[]:read(PLAN_KEY)).sort((a,b)=>String(b.weekStart).localeCompare(String(a.weekStart)));
    const units=visibleUnits(scoped?[]:read(UNIT_KEY)).sort((a,b)=>String(a.subject).localeCompare(String(b.subject))||String(a.unitTitle).localeCompare(String(b.unitTitle)));
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?(scoped?'Cloud data unavailable':'Cloud Sync'):'Local Mode')+'</span></div><button id="lpPrint" class="secondary">Print Syllabus Progress</button></div>'+
      metrics(plans,units)+'<div id="lpPlanEditor" style="margin-top:16px">'+planEditor()+'</div><div id="lpUnitEditor">'+unitEditor()+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Weekly Lesson Plans</h3><p class="muted">Planned teaching topics and learning objectives.</p></div></div><div class="paper-grid">'+(plans.length?plans.map(planCard).join(''):'<div class="empty-state">No lesson plans available.</div>')+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Syllabus Progress</h3><p class="muted">Unit/chapter completion tracking.</p></div></div><div class="paper-grid">'+(units.length?units.map(unitCard).join(''):'<div class="empty-state">No syllabus units available.</div>')+'</div>';
    bind(units);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('lessonCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_LESSON_CENTER={render,pullCloud,cloudReady,registeredClasses,classOptions,savedUnits,recordedSchoolTopic,unitBookValidation,savePlan,saveUnit};
})();