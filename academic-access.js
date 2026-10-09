(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let linkedStudentsCache=[],assignmentScope='',assignmentLoadToken=0;
  function ready(){return !!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId)}
  function injectStyle(){
    if(document.getElementById('academicAccessStyle'))return;
    const s=document.createElement('style');s.id='academicAccessStyle';
    s.textContent='.notify-card{padding:12px 0;border-bottom:1px solid #e7eeee}.notify-card.unread{border-left:4px solid #0f766e;padding-left:10px}.notify-meta{font-size:12px;color:#718087;margin-top:5px}.assignment-list{display:grid;gap:8px}.assignment-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;padding:10px;border:1px solid #e2ebea;border-radius:10px}@media(max-width:700px){.assignment-row{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function mountStudentLink(){
    const access=document.getElementById('access');if(!access||document.getElementById('studentRecordLinkCard'))return;
    const grid=access.querySelector('.access-grid');if(!grid)return;
    const card=document.createElement('article');card.className='card';card.id='studentRecordLinkCard';
    card.innerHTML='<h3>My Student Record</h3><p class="muted">Koi Student Code required nahi. Admin approval ke waqt EduNizam aap ki profile ko school record se automatically match/link karta hai.</p><div id="claimStudentRecordMsg" class="coverage-note">Agar dashboard blank ho to Admin ko student profile/admission details review karni hongi; aap ko naya code enter karne ki zarurat nahi.</div>';
    grid.appendChild(card);
  }
  function mountAssignments(){
    const access=document.getElementById('access');if(!access||document.getElementById('teacherAssignmentCard'))return;
    const grid=access.querySelector('.access-grid');if(!grid)return;
    const card=document.createElement('article');card.className='card';card.id='teacherAssignmentCard';
    card.innerHTML='<div class="section-head"><div><h3>Teacher–Student Assignment</h3><p class="muted">Single student ya poori class/section ko approved Teacher ke saath assign karein.</p></div><button id="refreshAssignmentsBtn" class="secondary">Refresh</button></div><h4>Single Student</h4><div class="form-grid"><select id="assignmentTeacher"><option value="">Select teacher</option></select><select id="assignmentClassFilter" aria-label="Filter linked students by class"><option value="">All linked classes</option></select><select id="assignmentSectionFilter" aria-label="Filter linked students by section"><option value="">All linked sections</option></select><select id="assignmentStudent"><option value="">Select linked student</option></select><button id="saveAssignmentBtn">Assign Student</button></div><hr><h4>Whole Class / Section</h4><div class="form-grid"><select id="bulkAssignmentTeacher"><option value="">Select teacher</option></select><select id="bulkAssignmentClass"><option value="">Select class</option></select><select id="bulkAssignmentSection"><option value="">All sections</option></select><button id="assignWholeClassBtn">Assign Class</button></div><div id="bulkAssignmentMsg" class="coverage-note"></div><p id="assignmentStudentHelp" class="coverage-note" role="status">Loading linked student options…</p><div id="assignmentList" class="assignment-list"></div>';
    grid.appendChild(card);
    card.querySelector('#refreshAssignmentsBtn').onclick=loadAssignments;
    card.querySelector('#assignmentClassFilter').onchange=populateAssignmentStudents;
    card.querySelector('#assignmentSectionFilter').onchange=()=>populateAssignmentStudents(true);
    card.querySelector('#saveAssignmentBtn').onclick=saveAssignment;
    card.querySelector('#bulkAssignmentClass').onchange=populateBulkSections;
    card.querySelector('#assignWholeClassBtn').onclick=assignWholeClass;
    card.querySelector('#assignmentTeacher').onchange=populateAssignmentStudents;
    card.querySelector('#bulkAssignmentTeacher').onchange=populateBulkSections;
    card.querySelector('#bulkAssignmentSection').onchange=populateBulkSections;
  }
  const str=x=>String(x??'').trim();
  const validLinked=()=>linkedStudentsCache.filter(x=>str(x.auth_user_id)&&str(x.name)&&str(x.class_name));
  const unique=items=>[...new Set(items.map(str).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  function populateAssignmentStudents(keepSection=false){
    const classSel=document.getElementById('assignmentClassFilter'),
      sectionSel=document.getElementById('assignmentSectionFilter'),
      studentSel=document.getElementById('assignmentStudent');
    if(!classSel||!sectionSel||!studentSel)return;
    const className=classSel.value||'',oldSection=sectionSel.value,oldStudent=studentSel.value;
    const students=validLinked().filter(x=>!className||str(x.class_name)===className);
    const sections=unique(students.map(x=>x.section_name));
    sectionSel.innerHTML='<option value="">All linked sections</option>'+sections.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(keepSection&&sections.includes(oldSection))sectionSel.value=oldSection;
    const section=sectionSel.value||'';
    const filtered=students.filter(x=>!section||str(x.section_name)===section);
    studentSel.innerHTML='<option value="">Select linked student</option>'+filtered.map(x=>'<option value="'+esc(x.auth_user_id)+'">'+esc(x.name)+' — '+esc(x.class_name)+(x.section_name?' / '+esc(x.section_name):'')+'</option>').join('');
    if(filtered.some(x=>str(x.auth_user_id)===oldStudent))studentSel.value=oldStudent;
    studentSel.disabled=!filtered.length;
    const button=document.getElementById('saveAssignmentBtn');if(button)button.disabled=!filtered.length||!document.getElementById('assignmentTeacher')?.value;
    const msg=document.getElementById('assignmentStudentHelp');
    if(msg)msg.textContent=filtered.length?filtered.length+' linked student(s) available for this selection.':'No approved, linked students for this class/section. Enroll and approve real students before assigning.';
  }
  function populateBulkSections(){
    const className=document.getElementById('bulkAssignmentClass')?.value||'';
    const sectionSel=document.getElementById('bulkAssignmentSection');if(!sectionSel)return;
    const old=sectionSel.value;
    const sections=unique(validLinked().filter(x=>!className||str(x.class_name)===className).map(x=>x.section_name));
    sectionSel.innerHTML='<option value="">All sections</option>'+sections.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(sections.includes(old))sectionSel.value=old;
    const matches=validLinked().filter(x=>(!className||str(x.class_name)===className)&&(!sectionSel.value||str(x.section_name)===sectionSel.value)).length;
    const btn=document.getElementById('assignWholeClassBtn');
    if(btn)btn.disabled=!className||!document.getElementById('bulkAssignmentTeacher')?.value||!matches;
    const msg=document.getElementById('bulkAssignmentMsg');
    if(msg)msg.textContent=matches?matches+' linked student(s) match the selected class / section.':'Select a class with approved, linked students before assignment.';
  }
  async function loadAssignments(){
    const teacherSel=document.getElementById('assignmentTeacher'),
      studentSel=document.getElementById('assignmentStudent'),
      box=document.getElementById('assignmentList');
    if(!teacherSel||!studentSel||!box||role()!=='head'||!ready())return;
    const scope=String(cfg().institutionId||'')+'|'+String(cloud()?.state?.user?.id||''),token=++assignmentLoadToken;
    if(assignmentScope!==scope){linkedStudentsCache=[];assignmentScope=scope;}
    const prev={teacher:teacherSel.value,student:studentSel.value,bulkTeacher:document.getElementById('bulkAssignmentTeacher')?.value,
      bulkClass:document.getElementById('bulkAssignmentClass')?.value,
      cls:document.getElementById('assignmentClassFilter')?.value};
    box.textContent='Loading current institute teacher and student links…';
    try{
      const [teachers,students,links]=await Promise.all([cloud().listInstitutionTeachers(),cloud().listLinkedCoreStudents(),cloud().listTeacherStudentLinks()]);
      if(token!==assignmentLoadToken||scope!==String(cfg().institutionId||'')+'|'+String(cloud()?.state?.user?.id||''))return;
      linkedStudentsCache=(students||[]).filter(x=>str(x.auth_user_id)&&str(x.name)&&str(x.class_name));
      const people=(teachers||[]).filter(x=>str(x.user_id));
      const teacherOptions='<option value="">Select approved teacher</option>'+people.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.full_name||x.user_id)+'</option>').join('');
      teacherSel.innerHTML=teacherOptions;
      const bulkTeacher=document.getElementById('bulkAssignmentTeacher');if(bulkTeacher)bulkTeacher.innerHTML=teacherOptions;
      if(people.some(x=>str(x.user_id)===prev.teacher))teacherSel.value=prev.teacher;
      if(bulkTeacher&&people.some(x=>str(x.user_id)===prev.bulkTeacher))bulkTeacher.value=prev.bulkTeacher;
      const cls=document.getElementById('assignmentClassFilter');
      if(cls){
        const classes=unique(linkedStudentsCache.map(x=>x.class_name));
        cls.innerHTML='<option value="">All linked classes</option>'+classes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
        if(classes.includes(prev.cls))cls.value=prev.cls;
      }
      populateAssignmentStudents();
      if(validLinked().some(x=>str(x.auth_user_id)===prev.student)&&[...studentSel.options].some(o=>o.value===prev.student))studentSel.value=prev.student;
      const bulk=document.getElementById('bulkAssignmentClass');
      if(bulk){
        const classes=unique(linkedStudentsCache.map(x=>x.class_name));
        bulk.innerHTML='<option value="">Select class with linked students</option>'+classes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
        if(classes.includes(prev.bulkClass))bulk.value=prev.bulkClass;
        populateBulkSections();
      }
      const notice=document.getElementById('assignmentStudentHelp');
      if(notice&&!people.length)notice.textContent='No approved teacher accounts found. Teacher must be approved by the Head before assignment.';
      const rows=links||[];
      box.innerHTML=rows.length?rows.map(x=>'<div class="assignment-row"><span>'+esc(x.teacher_name||x.teacher_user_id)+'</span><span>'+esc(x.student_name||x.student_user_id)+'</span><button class="secondary" data-remove-assignment="'+esc(x.teacher_user_id)+'" data-student="'+esc(x.student_user_id)+'">Remove</button></div>').join(''):'<div class="muted">No existing approved teacher–student assignments.</div>';
      box.querySelectorAll('[data-remove-assignment]').forEach(b=>b.onclick=async()=>{try{await cloud().removeTeacherStudentLink(b.dataset.removeAssignment,b.dataset.student);loadAssignments()}catch(e){alert(e.message||e)}});
    }catch(e){if(token===assignmentLoadToken){box.textContent='Could not load this school’s linked records: '+(e.message||String(e));}}
  }
  async function assignWholeClass(){
    if(role()!=='head'||!ready())return;
    const teacher=document.getElementById('bulkAssignmentTeacher')?.value||'';
    const className=document.getElementById('bulkAssignmentClass')?.value||'';
    const sectionName=document.getElementById('bulkAssignmentSection')?.value||'';
    const msg=document.getElementById('bulkAssignmentMsg');
    if(!teacher||!className){if(msg)msg.textContent='Teacher aur class select karein.';return}
    if(!validLinked().some(x=>str(x.class_name)===className&&(!sectionName||str(x.section_name)===sectionName))){if(msg)msg.textContent='No approved linked students match this class / section.';return}
    const btn=document.getElementById('assignWholeClassBtn');if(btn)btn.disabled=true;
    try{
      if(msg)msg.textContent='Assigning linked students...';
      const {data,error}=await cloud().state.client.rpc('assign_teacher_class_v1',{
        p_institution_id:cfg().institutionId,
        p_teacher_user_id:teacher,
        p_class_name:className,
        p_section_name:sectionName||null
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(msg)msg.textContent=(row?.matched_students||0)+' linked student(s) matched · '+(row?.assigned_new||0)+' newly assigned · '+(row?.already_assigned||0)+' already assigned.';
      await loadAssignments();
    }catch(e){if(msg)msg.textContent=e.message||String(e)}
    finally{if(btn)btn.disabled=false}
  }
  async function saveAssignment(){
    const t=document.getElementById('assignmentTeacher').value,s=document.getElementById('assignmentStudent').value;
    if(!t||!s)return alert('Teacher aur student select karein.');
    try{await cloud().assignTeacherStudent(t,s);loadAssignments()}catch(e){alert(e.message||e)}
  }
  function injectNotifications(){
    if(document.querySelector('[data-view="notifications"]'))return;
    const nav=document.getElementById('nav');if(!nav)return;
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='notifications';b.innerHTML='🔔  Notifications <span id="notificationCount"></span>';
    const settings=nav.querySelector('[data-view="settings"]');
    if(settings?.isConnected)settings.before(b);
    else nav.appendChild(b);
    b.onclick=showNotifications;
    const main=document.querySelector('main');if(!main)return;
    const sec=document.createElement('section');sec.id='notifications';sec.className='view';
    sec.innerHTML='<div class="section-head"><div><h2>Notifications</h2><p class="muted">Institute alerts, approvals, meeting reminders and academic updates.</p></div><button id="refreshNotifications" class="secondary">Refresh</button></div><article class="card"><div id="notificationList"></div></article>';
    main.appendChild(sec);
    sec.querySelector('#refreshNotifications').onclick=loadNotifications;
  }
  function showNotifications(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById('notifications')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='notifications'));
    const title=document.getElementById('page-title');if(title)title.textContent='Notifications';
    loadNotifications();
    window.dispatchEvent(new CustomEvent('edunizam:view-open',{detail:{view:'notifications'}}));
  }
  async function loadNotifications(){
    const box=document.getElementById('notificationList'),count=document.getElementById('notificationCount');if(!box)return;
    if(!ready()){box.innerHTML='<div class="muted">Cloud backend connect hone par notifications yahan aayengi.</div>';if(count)count.textContent='';return}
    try{
      const rows=await cloud().listMyNotifications();
      const unread=rows.filter(x=>!x.read_at).length;if(count)count.textContent=unread?'('+unread+')':'';
      box.innerHTML=rows.length?rows.map(x=>'<div class="notify-card '+(!x.read_at?'unread':'')+'"><strong>'+esc(x.title)+'</strong><div>'+esc(x.body)+'</div><div class="notify-meta">'+esc(x.category)+' · '+new Date(x.created_at).toLocaleString()+'</div>'+(!x.read_at?'<button class="secondary" data-read-notification="'+esc(x.id)+'">Mark Read</button>':'')+'</div>').join(''):'<div class="muted">No notifications.</div>';
      box.querySelectorAll('[data-read-notification]').forEach(b=>b.onclick=async()=>{try{await cloud().markNotificationRead(b.dataset.readNotification);loadNotifications()}catch(e){alert(e.message||e)}});
    }catch(e){box.textContent=e.message||String(e)}
  }
  function render(){
    const student=document.getElementById('studentRecordLinkCard'),assign=document.getElementById('teacherAssignmentCard');
    if(student)student.style.display=role()==='student'?'block':'none';
    if(assign)assign.style.display=role()==='head'?'block':'none';
  }
  function boot(){
    injectStyle();mountStudentLink();mountAssignments();injectNotifications();render();
    window.addEventListener('edunizam:workspace-ready',()=>{linkedStudentsCache=[];assignmentScope='';assignmentLoadToken++;render()});
    window.addEventListener('edunizam:view-open',event=>{
      if(event.detail?.view==='access'&&role()==='head')loadAssignments();
    });
  }
  setTimeout(boot,0);
  window.EDUNIZAM_ACADEMIC_ACCESS={render,loadNotifications,loadAssignments,assignWholeClass,populateAssignmentStudents,populateBulkSections};
})();