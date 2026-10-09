(function(){
  const KEY='edunizam_school_work_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'');
  const canEdit=()=>['head','teacher'].includes(role());
  const nowDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const emptySchoolWork=()=>({announcements:[],homework:[],submissions:[],timetable:[]});
  const cacheScopeKey='edunizam_school_work_scope_v1';
  const cacheScope=()=>[String(cfg().institutionId||''),String(cloud()?.state?.user?.id||''),role()].join('|');
  function read(){
    // The legacy shared localStorage key can contain another school's data.
    // Until current school cloud records are loaded, show empty rather than
    // rendering cached student submissions/assignment details.
    if(cloudReady()&&localStorage.getItem(cacheScopeKey)!==cacheScope())return emptySchoolWork();
    try{
      const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');
      return Object.assign(emptySchoolWork(),parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{});
    }catch{return emptySchoolWork()}
  }
  function write(v){
    localStorage.setItem(KEY,JSON.stringify(v));
    localStorage.setItem(cacheScopeKey,cloudReady()?cacheScope():'');
  }
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  function cloudReady(){const c=cloud(),x=cfg();return !!(x.enabled&&x.institutionId&&c?.state?.client&&c?.state?.user)}
  function cloudStatus(){return cloudReady()?'Cloud Sync':'Local Mode'}
  const mapAnnouncements=rows=>(rows||[]).map(x=>({id:x.id,title:x.title,body:x.body,audience:x.audience,createdBy:x.creator_user_id,createdRole:'cloud',createdAt:x.created_at}));
  const mapHomework=rows=>(rows||[]).map(x=>({id:x.id,className:x.class_name,sectionName:x.section_name||'',subject:x.subject,title:x.title,details:x.details||'',dueDate:x.due_date||'',assignmentType:x.assignment_type||'homework',maxMarks:x.max_marks==null?'':Number(x.max_marks),allowSubmission:x.allow_submission!==false,allowLateSubmission:x.allow_late_submission!==false,createdBy:x.creator_user_id,createdRole:'cloud',createdAt:x.created_at,updatedAt:x.updated_at}));
  const mapSubmissions=rows=>(rows||[]).map(x=>({id:x.id,homeworkId:x.homework_id,studentId:x.student_id,studentName:x.student_name||'Student',text:x.submission_text||'',url:x.submission_url||'',status:x.status||'submitted',marks:x.marks==null?'':Number(x.marks),feedback:x.feedback||'',submittedAt:x.submitted_at,gradedAt:x.graded_at||'',cloud:true}));
  const mapTimetable=rows=>(rows||[]).map(x=>({id:x.id,className:x.class_name,sectionName:x.section_name||'',day:x.weekday,periodNumber:Number(x.period_number||0),time:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',subject:x.subject,teacherName:x.teacher_name||'',roomLabel:x.room_label||'',createdBy:x.creator_user_id,createdRole:'cloud',createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}));
  function mapCloud(ann,hw,tt,subs){
    return {announcements:mapAnnouncements(ann),homework:mapHomework(hw),submissions:mapSubmissions(subs),timetable:mapTimetable(tt)};
  }

  let cloudLoadKey='',cloudLoadedScopes=new Set(),cloudScopeInFlight=new Map();
  function resetCloudScopes(){
    cloudLoadKey='';
    cloudLoadedScopes.clear();
    cloudScopeInFlight.clear();
  }
  function ensureCloudKey(){
    const key=cloudReady()?[cfg().institutionId,cloud()?.state?.user?.id||'',role()].join('|'):'';
    if(key!==cloudLoadKey){
      cloudLoadKey=key;
      cloudLoadedScopes.clear();
      cloudScopeInFlight.clear();
    }
    return key;
  }

  let homeworkAcademic={scope:'',status:'unloaded',classes:[],units:[],loadedAt:0},academicJob=null;
  const homeworkScope=()=>[String(cfg().institutionId||''),String(cloud()?.state?.user?.id||''),role()].join('|');
  async function loadHomeworkOptions(force=false){
    if(!canEdit()||!cloudReady())return;
    const scope=homeworkScope();
    if(!force&&homeworkAcademic.scope===scope&&homeworkAcademic.status==='loaded'&&Date.now()-homeworkAcademic.loadedAt<30000)return;
    if(academicJob?.scope===scope)return academicJob.promise;
    homeworkAcademic={scope:'',status:'unloaded',classes:[],units:[],loadedAt:0};
    const inst=cfg().institutionId,client=cloud().state.client;
    const fetchRows=async(table,columns,max)=>{
      let q=client.from(table).select(columns).eq('institution_id',inst).limit(max);
      if(table==='class_sections')q=q.eq('active',true);
      const {data,error}=await q;
      if(error)throw error;return Array.isArray(data)?data:[];
    };
    const promise=(async()=>{
      const results=await Promise.allSettled([
        fetchRows('class_sections','class_name,section_name,active',1200),
        fetchRows('syllabus_progress_units','class_name,subject,unit_title',1500)
      ]);
      if(!cloudReady()||homeworkScope()!==scope)return;
      const classes=results[0].status==='fulfilled'?results[0].value.map(x=>({className:x.class_name,sectionName:x.section_name||'',active:x.active!==false})):[];
      const units=results[1].status==='fulfilled'?results[1].value.map(x=>({className:x.class_name,subject:x.subject,unitTitle:x.unit_title||''})):[];
      homeworkAcademic={scope,classes,units,loadedAt:Date.now(),
        status:results[0].status==='fulfilled'?'loaded':'error',
        unitStatus:results[1].status==='fulfilled'?'loaded':'error'};
      if(results[0].status==='rejected')console.warn('School Work class options:',results[0].reason?.message||results[0].reason);
      if(results[1].status==='rejected')console.warn('School Work subject options:',results[1].reason?.message||results[1].reason);
    })();
    academicJob={scope,promise};
    try{await promise}finally{if(academicJob?.promise===promise)academicJob=null}
  }
  function registeredHomeworkClasses(){
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS,rows=[];
    if(cloudReady()){
      if(homeworkAcademic.scope===homeworkScope()&&homeworkAcademic.status==='loaded')rows.push(...homeworkAcademic.classes);
    }else{
      try{rows.push(...JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]'))}catch(_){}
    }
    const keys=window.EDUNIZAM_ROLE_SCOPE?.teacherClassKeys?.()||new Set();
    return api?.registeredSections?.(rows.filter(x=>{
      if(x.active===false)return false;
      if(role()==='head')return true;
      const k=String(x.className||'').trim().toLowerCase()+'|'+String(x.sectionName||'').trim().toLowerCase();
      return role()==='teacher'&&keys.has(k);
    }))||[];
  }
  function knownHomeworkClass(cls,sec){
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
    return registeredHomeworkClasses().some(x=>api?.sameClass?.(x.className,cls)&&
      String(x.sectionName||'').trim().toLowerCase()===String(sec||'').trim().toLowerCase());
  }
  function syncHomeworkOptions(){
    const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS,cls=$('swHwClass')?.value?.trim()||'';
    const classes=$('swHwClassOptions');
    if(classes)classes.innerHTML=(api?.distinct?.(registeredHomeworkClasses().map(x=>x.className))||[])
      .map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const sections=$('swHwSectionOptions');
    if(sections)sections.innerHTML=(api?.sections?.(cls,registeredHomeworkClasses())||[])
      .map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const units=cloudReady()?(homeworkAcademic.scope===homeworkScope()?homeworkAcademic.units:[]):
      (()=>{try{return JSON.parse(localStorage.getItem('edunizam_syllabus_units_v1')||'[]')}catch{return[]}})();
    const list=$('swHwSubjectOptions');
    if(list)list.innerHTML=(api?.subjects?.(cls,window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{},units)||[])
      .map(x=>'<option value="'+esc(x)+'"></option>').join('');
    const note=$('swHwOptionNote');
    if(note)note.textContent=!cls?'Choose a registered class to see sections and subject suggestions.':
      cloudReady()&&homeworkAcademic.scope!==homeworkScope()?'Loading current-school academic options.':
      cloudReady()&&homeworkAcademic.status==='error'?'School directory unavailable. Refresh before publishing.':
      cloudReady()&&homeworkAcademic.unitStatus==='error'?'School syllabus unavailable; subjects are unverified reference suggestions.':
      'Saved school subjects plus unverified reference subjects. Check prescribed textbook.';
  }
  async function refreshHomeworkOptions(){
    const button=$('swHwRefresh');if(button){button.disabled=true;button.textContent='Refreshing...'}
    try{await loadHomeworkOptions(true);syncHomeworkOptions()}
    finally{if(button?.isConnected){button.disabled=false;button.textContent='Refresh Classes & Subjects'}}
  }
  async function pullCloud(scope='all',force=false){
    if(!cloudReady())return read();
    ensureCloudKey();
    const normalized=['announcements','homework','submissions','timetable','all'].includes(scope)?scope:'all';
    if(!force&&normalized!=='all'&&cloudLoadedScopes.has(normalized))return read();
    if(cloudScopeInFlight.has(normalized))return cloudScopeInFlight.get(normalized);
    const task=(async()=>{
      const requestKey=cloudLoadKey;
      const c=cloud(),id=cfg().institutionId,current=read();
      if(normalized==='all'){
        const [a,h,t,s]=await Promise.all([
          c.state.client.from('school_announcements').select('*').eq('institution_id',id).order('created_at',{ascending:false}),
          c.state.client.from('homework_items').select('*').eq('institution_id',id).order('created_at',{ascending:false}),
          c.state.client.from('timetable_entries').select('*').eq('institution_id',id).order('weekday').order('start_time'),
          c.state.client.from('homework_submissions').select('*').eq('institution_id',id).order('submitted_at',{ascending:false})
        ]);
        for(const r of [a,h,t,s])if(r.error)throw r.error;
        const mapped=mapCloud(a.data,h.data,t.data,s.data);
        if(requestKey!==ensureCloudKey())return read();
        write(mapped);
        ['announcements','homework','submissions','timetable'].forEach(x=>cloudLoadedScopes.add(x));
        return mapped;
      }
      if(normalized==='announcements'){
        const a=await c.state.client.from('school_announcements').select('*').eq('institution_id',id).order('created_at',{ascending:false});
        if(a.error)throw a.error;
        current.announcements=mapAnnouncements(a.data);
      }else if(normalized==='homework'){
        const h=await c.state.client.from('homework_items').select('*').eq('institution_id',id).order('created_at',{ascending:false});
        if(h.error)throw h.error;
        current.homework=mapHomework(h.data);
      }else if(normalized==='timetable'){
        const t=await c.state.client.from('timetable_entries').select('*').eq('institution_id',id).order('weekday').order('start_time');
        if(t.error)throw t.error;
        current.timetable=mapTimetable(t.data);
      }else{
        const [h,s]=await Promise.all([
          c.state.client.from('homework_items').select('*').eq('institution_id',id).order('created_at',{ascending:false}),
          c.state.client.from('homework_submissions').select('*').eq('institution_id',id).order('submitted_at',{ascending:false})
        ]);
        if(h.error)throw h.error;if(s.error)throw s.error;
        current.homework=mapHomework(h.data);
        current.submissions=mapSubmissions(s.data);
        cloudLoadedScopes.add('homework');
      }
      if(requestKey!==ensureCloudKey())return read();
      write(current);
      cloudLoadedScopes.add(normalized);
      return current;
    })();
    cloudScopeInFlight.set(normalized,task);
    try{return await task}finally{cloudScopeInFlight.delete(normalized)}
  }
  async function insertCloud(kind,x){
    if(!cloudReady())return null;
    const c=cloud(),institution_id=cfg().institutionId,creator_user_id=c.state.user.id;
    let table,payload;
    if(kind==='announcements'){
      table='school_announcements';payload={institution_id,creator_user_id,audience:x.audience,title:x.title,body:x.body};
    }else if(kind==='homework'){
      table='homework_items';payload={institution_id,creator_user_id,class_name:x.className,section_name:x.sectionName||null,subject:x.subject,title:x.title,details:x.details||null,due_date:x.dueDate||null,assignment_type:x.assignmentType||'homework',max_marks:x.maxMarks===''?null:Number(x.maxMarks),allow_submission:x.allowSubmission!==false,allow_late_submission:x.allowLateSubmission!==false,updated_at:new Date().toISOString()};
    }else{
      table='timetable_entries';payload={institution_id,creator_user_id,class_name:x.className,section_name:x.sectionName||null,weekday:x.day,period_number:x.periodNumber||null,start_time:x.time||null,end_time:x.endTime||null,subject:x.subject,teacher_name:x.teacherName||null,room_label:x.roomLabel||null,updated_at:new Date().toISOString()};
    }
    const {data,error}=await c.state.client.from(table).insert(payload).select().single();
    if(error)throw error;return data;
  }
  async function deleteCloud(kind,id){
    if(!cloudReady())return;
    const table=kind==='announcements'?'school_announcements':kind==='homework'?'homework_items':'timetable_entries';
    const {error}=await cloud().state.client.from(table).delete().eq('id',id);
    if(error)throw error;
  }
  async function submitCloud(homeworkId,text,url){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.rpc('submit_homework_v1',{p_homework_id:homeworkId,p_submission_text:text||null,p_submission_url:url||null});
    if(error)throw error;return data;
  }
  async function gradeCloud(submissionId,marks,feedback,returnForRevision=false){
    if(!cloudReady())return null;
    const payload={p_submission_id:submissionId,p_marks:marks===''||marks==null?null:Number(marks),p_feedback:feedback||null,p_return_for_revision:!!returnForRevision};
    const {data,error}=await cloud().state.client.rpc('grade_homework_submission_v1',payload);
    if(error)throw error;return data;
  }
  function appState(){return window.EDUNIZAM_APP_STATE||null}
  function allStudents(){
    try{
      return JSON.parse(localStorage.getItem('edunizam_students')||'[]');
    }catch{return[]}
  }
  function visibleStudents(){
    const list=allStudents();
    const scoped=window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(list);
    return Array.isArray(scoped)?scoped:[];
  }
  function visibleClasses(){
    if(['head','teacher'].includes(role()))return null;
    return new Set(visibleStudents().map(s=>String(s.className||'').trim()).filter(Boolean));
  }
  function classVisible(name){
    const set=visibleClasses();return set===null||set.has(String(name||'').trim());
  }
  function audienceVisible(a){
    if(role()==='head'||role()==='teacher')return true;
    if(a==='all')return true;
    if(role()==='student')return a==='students';
    if(role()==='parent')return a==='parents';
    return false;
  }
  function mine(x){
    if(role()==='head')return true;
    const uid=String(cloud()?.state?.user?.id||'');
    return (uid&&String(x.createdBy||'')===uid)||String(x.createdBy||'')===identity();
  }
  function assignmentLabel(v){return ({homework:'Homework',assignment:'Assignment',project:'Project',reading:'Reading',quiz_prep:'Quiz Prep'})[v]||'Homework'}
  function submissionRows(d,homeworkId){return (d.submissions||[]).filter(s=>String(s.homeworkId)===String(homeworkId))}
  function visibleSubmissions(d){
    const rows=d.submissions||[];
    if(cloudReady())return rows;
    if(role()==='head')return rows;
    if(role()==='teacher'){
      const mineIds=new Set((d.homework||[]).filter(mine).map(h=>String(h.id)));
      return rows.filter(s=>mineIds.has(String(s.homeworkId)));
    }
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return rows.filter(s=>ids.has(String(s.studentId)));
  }
  function homeworkFor(d,id){return (d.homework||[]).find(h=>String(h.id)===String(id))}
  function isLate(hw){return !!(hw?.dueDate&&nowDate()>String(hw.dueDate))}
  function canStudentSubmit(hw,existing){
    if(role()!=='student'||hw.allowSubmission===false)return false;
    if(existing?.status==='graded')return false;
    if(isLate(hw)&&hw.allowLateSubmission===false)return false;
    return true;
  }

  function mount(){
    const root=$('schoolWorkApp');if(!root)return;
    root.innerHTML=`
      <div class="section-head"><span class="academic-pill" id="swCloudStatus">${cloudStatus()}</span></div>
      <div class="school-work-tabs">
        <button class="secondary sw-tab active" data-sw-tab="announcements">Announcements</button>
        <button class="secondary sw-tab" data-sw-tab="homework">Homework & Assignments</button>
        <button class="secondary sw-tab" data-sw-tab="submissions">Submissions & Grading</button>
        <button class="secondary sw-tab" data-sw-tab="timetable">Timetable</button>
      </div>
      <div id="swEditor"></div>
      <div id="swList" class="paper-grid" style="margin-top:16px"></div>`;
    root.querySelectorAll('[data-sw-tab]').forEach(b=>b.onclick=()=>{
      root.querySelectorAll('[data-sw-tab]').forEach(x=>x.classList.toggle('active',x===b));
      root.dataset.tab=b.dataset.swTab;render();
    });
    root.dataset.tab=root.dataset.tab||'announcements';
    render();
  }

  function editor(tab){
    if(!canEdit())return '<div class="coverage-note">Read-only view. Head/Teacher school work create karte hain.</div>';
    if(tab==='announcements')return `
      <article class="card"><h3>New Announcement</h3>
      <div class="form-grid">
        <input id="swAnnTitle" placeholder="Announcement title">
        <select id="swAnnAudience"><option value="all">All</option><option value="students">Students</option><option value="parents">Parents</option><option value="teachers">Teachers</option></select>
        <textarea id="swAnnBody" rows="3" placeholder="Notice / message"></textarea>
        <button id="swSaveAnnouncement">Publish</button>
      </div></article>`;
    if(tab==='homework')return `
      <article class="card"><div class="section-head"><div><span class="academic-pill">Deep Assignment Workflow</span><h3>New Homework / Assignment</h3></div></div>
      <div class="form-grid">
        <input id="swHwClass" list="swHwClassOptions" placeholder="Registered class / grade *"><datalist id="swHwClassOptions"></datalist>
        <input id="swHwSection" list="swHwSectionOptions" placeholder="Registered section *"><datalist id="swHwSectionOptions"></datalist>
        <input id="swHwSubject" list="swHwSubjectOptions" placeholder="Subject (choose / type) *"><datalist id="swHwSubjectOptions"></datalist>
        <p id="swHwOptionNote" class="coverage-note">Select a school class to load section and subject suggestions.</p>
        <button type="button" id="swHwRefresh" class="secondary">Refresh Classes & Subjects</button>
        <input id="swHwTitle" placeholder="Title *">
        <select id="swHwType"><option value="homework">Homework</option><option value="assignment">Assignment</option><option value="project">Project</option><option value="reading">Reading</option><option value="quiz_prep">Quiz Prep</option></select>
        <input id="swHwDue" type="date" value="${nowDate()}">
        <input id="swHwMarks" type="number" min="1" max="1000" step="0.5" placeholder="Total marks (optional)">
        <label><input id="swHwAllowSubmit" type="checkbox" checked> Allow online submission</label>
        <label><input id="swHwAllowLate" type="checkbox" checked> Accept late submission</label>
        <textarea id="swHwDetails" rows="4" placeholder="Instructions, chapters, questions, links or expected output"></textarea>
        <button id="swSaveHomework">Publish Assignment</button>
      </div></article>`;
    if(tab==='submissions'){
      const d=read(),rows=visibleSubmissions(d),graded=rows.filter(x=>x.status==='graded').length,returned=rows.filter(x=>x.status==='returned').length;
      return `<article class="card"><div class="section-head"><div><span class="academic-pill">Submission Desk</span><h3>Assignment Progress</h3><p class="muted">Submitted work, late attempts, grading and revision status.</p></div></div><div class="cards"><div class="stat"><span>Visible submissions</span><strong>${rows.length}</strong></div><div class="stat"><span>Graded</span><strong>${graded}</strong></div><div class="stat"><span>Returned</span><strong>${returned}</strong></div></div></article>`;
    }
    return `
      <article class="card"><h3>New Timetable Entry</h3>
      <div class="form-grid">
        <input id="swTtClass" placeholder="Class e.g. 5">
        <select id="swTtDay"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option></select>
        <input id="swTtTime" type="time">
        <input id="swTtSubject" placeholder="Subject">
        <input id="swTtTeacher" placeholder="Teacher name">
        <button id="swSaveTimetable">Add Period</button>
      </div></article>`;
  }

  function card(kind,x){
    const d=read();
    const del=canEdit()&&mine(x)?'<button class="secondary" data-sw-delete="'+kind+':'+esc(x.id)+'">Delete</button>':'';
    if(kind==='announcements')return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">${esc(x.audience||'all')}</span><span class="muted">${new Date(x.createdAt).toLocaleDateString()}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><div class="paper-actions">${del}</div></article>`;
    if(kind==='homework'){
      const rows=submissionRows(d,x.id),myRows=role()==='head'||role()==='teacher'?rows:visibleSubmissions(d).filter(s=>String(s.homeworkId)===String(x.id));
      const existing=myRows[0],graded=rows.filter(s=>s.status==='graded').length,late=rows.filter(s=>s.status==='late').length;
      const marks=x.maxMarks!==''&&x.maxMarks!=null?' · '+esc(x.maxMarks)+' marks':'';
      const section=x.sectionName?' · Section '+esc(x.sectionName):'';
      let learner='';
      if(role()==='student'){
        const canSubmit=canStudentSubmit(x,existing);
        learner=existing?`<div class="coverage-note"><strong>Your submission:</strong> ${esc(existing.status)}${existing.marks!==''&&existing.marks!=null?' · '+esc(existing.marks)+'/'+esc(x.maxMarks||''):' '}${existing.feedback?'<br><strong>Feedback:</strong> '+esc(existing.feedback):''}</div>`:'<div class="coverage-note">Not submitted yet.</div>';
        if(canSubmit) learner+=`<div class="form-grid" data-sw-submit-panel="${esc(x.id)}"><textarea rows="3" data-sw-submit-text="${esc(x.id)}" placeholder="Write your answer / submission note">${esc(existing?.text||'')}</textarea><input data-sw-submit-url="${esc(x.id)}" type="url" placeholder="Optional link to Drive / document / project" value="${esc(existing?.url||'')}"><button data-sw-submit="${esc(x.id)}">${existing?'Resubmit':'Submit Work'}</button></div>`;
      }else if(role()==='parent'){
        learner=myRows.length?myRows.map(s=>`<div class="coverage-note"><strong>${esc(s.studentName||'Student')}:</strong> ${esc(s.status)}${s.marks!==''&&s.marks!=null?' · '+esc(s.marks)+'/'+esc(x.maxMarks||''):' '}${s.feedback?'<br><strong>Feedback:</strong> '+esc(s.feedback):''}</div>`).join(''):'<div class="coverage-note">No linked student submission visible yet.</div>';
      }else{
        learner=`<p class="muted">Submissions: ${rows.length} · Graded: ${graded} · Late: ${late}</p>`;
      }
      return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">${esc(assignmentLabel(x.assignmentType))}</span><span class="mini-badge">Class ${esc(x.className)}${section}</span><span class="mini-badge">${esc(x.subject)}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.details||'')}</p><p class="muted">Due: ${esc(x.dueDate||'Not set')}${marks} · Online submit: ${x.allowSubmission===false?'No':'Yes'}${isLate(x)?' · Due date passed':''}</p>${learner}<div class="paper-actions">${del}</div></article>`;
    }
    if(kind==='submissions'){
      const hw=homeworkFor(d,x.homeworkId)||{};
      const grading=(role()==='head'||role()==='teacher')&&mine(hw)?`<div class="form-grid"><input data-sw-grade-marks="${esc(x.id)}" type="number" min="0" step="0.5" max="${esc(hw.maxMarks||1000)}" placeholder="Marks" value="${x.marks!==''&&x.marks!=null?esc(x.marks):''}"><textarea data-sw-grade-feedback="${esc(x.id)}" rows="2" placeholder="Teacher feedback">${esc(x.feedback||'')}</textarea><button data-sw-grade="${esc(x.id)}">Save Grade</button><button class="secondary" data-sw-return="${esc(x.id)}">Return for Revision</button></div>`:'';
      return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">${esc(x.status)}</span><span class="mini-badge">${esc(x.studentName||'Student')}</span></div><h3>${esc(hw.title||'Assignment')}</h3><p class="muted">${esc(hw.subject||'')} · ${x.submittedAt?new Date(x.submittedAt).toLocaleString():''}</p>${x.text?'<p>'+esc(x.text)+'</p>':''}${x.url?'<p><a href="'+esc(x.url)+'" target="_blank" rel="noopener">Open submission link</a></p>':''}${x.status==='graded'?'<div class="coverage-note"><strong>Marks:</strong> '+esc(x.marks)+'/'+esc(hw.maxMarks||'')+(x.feedback?'<br><strong>Feedback:</strong> '+esc(x.feedback):'')+'</div>':''}${x.status==='returned'&&x.feedback?'<div class="coverage-note"><strong>Revision requested:</strong> '+esc(x.feedback)+'</div>':''}${grading}</article>`;
    }
    return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">Class ${esc(x.className)}</span><span class="mini-badge">${esc(x.day)}</span></div><h3>${esc(x.subject)}</h3><p class="muted">${esc(x.time||'')} · ${esc(x.teacherName||'Teacher')}</p><div class="paper-actions">${del}</div></article>`;
  }
  function bind(tab){
    if(tab==='announcements'&&$('swSaveAnnouncement'))$('swSaveAnnouncement').onclick=async()=>{
      const title=$('swAnnTitle').value.trim(),body=$('swAnnBody').value.trim();if(!title||!body)return alert('Title aur announcement likhein.');
      const item={id:String(Date.now()),title,body,audience:$('swAnnAudience').value,createdBy:identity(),createdRole:role(),createdAt:new Date().toISOString()};
      try{
        const row=await insertCloud('announcements',item);
        if(row)item.id=row.id,item.createdBy=row.creator_user_id,item.createdAt=row.created_at;
      }catch(e){alert('Cloud sync failed; item local mode mein save hoga. '+(e.message||e))}
      const d=read();d.announcements.unshift(item);write(d);render();
    };
    if(tab==='homework'){
      $('swHwClass')?.addEventListener('input',syncHomeworkOptions);
      $('swHwRefresh')?.addEventListener('click',refreshHomeworkOptions);
      syncHomeworkOptions();
    }
    if(tab==='homework'&&$('swSaveHomework'))$('swSaveHomework').onclick=async()=>{
      const className=$('swHwClass').value.trim(),subject=$('swHwSubject').value.trim(),title=$('swHwTitle').value.trim();if(!className||!subject||!title)return alert('Class, subject aur title required hain.');
      const sectionName=$('swHwSection').value.trim();
      if(!knownHomeworkClass(className,sectionName))return alert('Choose a registered accessible class/section in Academic Groups before publishing.');
      const item={id:String(Date.now()),className,sectionName,subject,title,assignmentType:$('swHwType').value,dueDate:$('swHwDue').value,maxMarks:$('swHwMarks').value,allowSubmission:$('swHwAllowSubmit').checked,allowLateSubmission:$('swHwAllowLate').checked,details:$('swHwDetails').value.trim(),createdBy:identity(),createdRole:role(),createdAt:new Date().toISOString()};
      try{
        const row=await insertCloud('homework',item);
        if(row)item.id=row.id,item.createdBy=row.creator_user_id,item.createdAt=row.created_at;
      }catch(e){return alert('Assignment could not be published: '+(e.message||e))}
      const d=read();d.homework.unshift(item);write(d);render();
    };
    if(tab==='timetable'&&$('swSaveTimetable'))$('swSaveTimetable').onclick=async()=>{
      const className=$('swTtClass').value.trim(),subject=$('swTtSubject').value.trim();if(!className||!subject)return alert('Class aur subject required hain.');
      const item={id:String(Date.now()),className,day:$('swTtDay').value,time:$('swTtTime').value,subject,teacherName:$('swTtTeacher').value.trim(),createdBy:identity(),createdRole:role(),createdAt:new Date().toISOString()};
      try{
        const row=await insertCloud('timetable',item);
        if(row)item.id=row.id,item.createdBy=row.creator_user_id,item.createdAt=row.created_at;
      }catch(e){alert('Cloud sync failed; timetable local mode mein save hoga. '+(e.message||e))}
      const d=read();d.timetable.push(item);write(d);render();
    };
    document.querySelectorAll('[data-sw-submit]').forEach(b=>b.onclick=async()=>{
      const homeworkId=b.dataset.swSubmit,text=document.querySelector('[data-sw-submit-text="'+homeworkId+'"]')?.value.trim()||'',url=document.querySelector('[data-sw-submit-url="'+homeworkId+'"]')?.value.trim()||'';
      if(!text&&!url)return alert('Submission note ya valid link dein.');
      const d=read(),hw=homeworkFor(d,homeworkId);if(!hw)return;
      b.disabled=true;
      try{
        if(cloudReady()){
          await submitCloud(homeworkId,text,url);
          await pullCloud('submissions',true);
        }else{
          const student=visibleStudents()[0];if(!student)throw new Error('Student profile link required.');
          if(isLate(hw)&&hw.allowLateSubmission===false)throw new Error('Submission deadline has passed.');
          const old=(d.submissions||[]).find(s=>String(s.homeworkId)===String(homeworkId)&&String(s.studentId)===String(student.id));
          if(old?.status==='graded')throw new Error('Graded work cannot be resubmitted until returned for revision.');
          const row={id:old?.id||String(Date.now()),homeworkId,studentId:student.id,studentName:student.name||'Student',text,url,status:isLate(hw)?'late':'submitted',marks:'',feedback:'',submittedAt:new Date().toISOString(),gradedAt:'',cloud:false};
          d.submissions=(d.submissions||[]).filter(s=>String(s.id)!==String(row.id));d.submissions.unshift(row);write(d);
        }
        render();
      }catch(e){alert('Submission failed: '+(e.message||e))}
      finally{b.disabled=false}
    });
    document.querySelectorAll('[data-sw-grade]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.swGrade,marks=document.querySelector('[data-sw-grade-marks="'+id+'"]')?.value??'',feedback=document.querySelector('[data-sw-grade-feedback="'+id+'"]')?.value.trim()||'';
      if(marks==='')return alert('Marks required hain.');
      const d=read(),sub=(d.submissions||[]).find(s=>String(s.id)===String(id));if(!sub)return;
      try{
        if(cloudReady()){await gradeCloud(id,marks,feedback,false);await pullCloud('submissions',true)}
        else{sub.status='graded';sub.marks=Number(marks);sub.feedback=feedback;sub.gradedAt=new Date().toISOString();write(d)}
        render();
      }catch(e){alert('Grading failed: '+(e.message||e))}
    });
    document.querySelectorAll('[data-sw-return]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.swReturn,feedback=document.querySelector('[data-sw-grade-feedback="'+id+'"]')?.value.trim()||'Please revise and resubmit.';
      const d=read(),sub=(d.submissions||[]).find(s=>String(s.id)===String(id));if(!sub)return;
      try{
        if(cloudReady()){await gradeCloud(id,null,feedback,true);await pullCloud('submissions',true)}
        else{sub.status='returned';sub.marks='';sub.feedback=feedback;sub.gradedAt=new Date().toISOString();write(d)}
        render();
      }catch(e){alert('Return for revision failed: '+(e.message||e))}
    });
    document.querySelectorAll('[data-sw-delete]').forEach(b=>b.onclick=async()=>{
      const [kind,id]=b.dataset.swDelete.split(':');const d=read();const key=kind==='announcements'?'announcements':kind==='homework'?'homework':'timetable';
      const item=d[key].find(x=>String(x.id)===String(id));if(!item||!mine(item))return;
      try{await deleteCloud(kind,id)}catch(e){return alert('Cloud delete failed: '+(e.message||e))}
      d[key]=d[key].filter(x=>String(x.id)!==String(id));if(kind==='homework')d.submissions=(d.submissions||[]).filter(s=>String(s.homeworkId)!==String(id));write(d);render();
    });
  }

  function paint(root,d,tab){
    const status=$('swCloudStatus');if(status)status.textContent=cloudStatus();
    $('swEditor').innerHTML=editor(tab);
    let arr=tab==='announcements'?d.announcements.filter(x=>audienceVisible(x.audience)):tab==='homework'?d.homework.filter(x=>classVisible(x.className)):tab==='submissions'?visibleSubmissions(d):d.timetable.filter(x=>classVisible(x.className));
    if(tab==='submissions')arr=[...arr].sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')));
    if(tab==='timetable'){
      const order=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      arr=[...arr].sort((a,b)=>order.indexOf(a.day)-order.indexOf(b.day)||String(a.time).localeCompare(String(b.time)));
    }
    $('swList').innerHTML=arr.length?arr.map(x=>card(tab,x)).join(''):'<div class="empty-state">Abhi koi relevant '+esc(tab)+' item nahi hai.</div>';
    bind(tab);
  }

  async function render(force=false){
    const root=$('schoolWorkApp');
    if(!root)return;
    if(!$('swEditor')||!$('swList')){mount();return}
    const tab=root.dataset.tab||'announcements';
    // Paint cached/local content first so a tab tap always feels immediate.
    paint(root,read(),tab);
    if(!cloudReady())return;
    ensureCloudKey();
    if(tab==='homework'&&canEdit()){
      await loadHomeworkOptions();
      if((root.dataset.tab||'announcements')===tab)syncHomeworkOptions();
    }
    const scope=tab==='submissions'?'submissions':tab;
    if(!force&&cloudLoadedScopes.has(scope))return;
    try{
      const fresh=await pullCloud(scope,force===true);
      // Do not repaint over a newer tab selection.
      if((root.dataset.tab||'announcements')===tab)paint(root,fresh,tab);
    }catch(e){
      console.warn('School Work cloud sync:',e.message||e);
    }
  }

  window.addEventListener('edunizam:auth',()=>{resetCloudScopes();render(true)});
  setTimeout(mount,0);setTimeout(mount,600);
  window.EDUNIZAM_SCHOOL_WORK={mount,render,read,pullCloud,cloudReady,loadHomeworkOptions,
    registeredHomeworkClasses,knownHomeworkClass,syncHomeworkOptions,refreshHomeworkOptions,getHomeworkAcademic:()=>homeworkAcademic};
})();