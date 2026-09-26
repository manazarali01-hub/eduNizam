(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let linkedStudentsCache=[];
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
    card.innerHTML='<div class="section-head"><div><h3>Teacher–Student Assignment</h3><p class="muted">Single student ya poori class/section ko approved Teacher ke saath assign karein.</p></div><button id="refreshAssignmentsBtn" class="secondary">Refresh</button></div><h4>Single Student</h4><div class="form-grid"><select id="assignmentTeacher"><option value="">Select teacher</option></select><select id="assignmentStudent"><option value="">Select linked student</option></select><button id="saveAssignmentBtn">Assign Student</button></div><hr><h4>Whole Class / Section</h4><div class="form-grid"><select id="bulkAssignmentTeacher"><option value="">Select teacher</option></select><select id="bulkAssignmentClass"><option value="">Select class</option></select><select id="bulkAssignmentSection"><option value="">All sections</option></select><button id="assignWholeClassBtn">Assign Class</button></div><div id="bulkAssignmentMsg" class="coverage-note"></div><div id="assignmentList" class="assignment-list"></div>';
    grid.appendChild(card);
    card.querySelector('#refreshAssignmentsBtn').onclick=loadAssignments;
    card.querySelector('#saveAssignmentBtn').onclick=saveAssignment;
    card.querySelector('#bulkAssignmentClass').onchange=populateBulkSections;
    card.querySelector('#assignWholeClassBtn').onclick=assignWholeClass;
  }
  async function loadAssignments(){
    const teacherSel=document.getElementById('assignmentTeacher'),studentSel=document.getElementById('assignmentStudent'),box=document.getElementById('assignmentList');
    if(!teacherSel||!studentSel||!box||role()!=='head'||!ready())return;
    try{
      const [teachers,students,links]=await Promise.all([cloud().listInstitutionTeachers(),cloud().listLinkedCoreStudents(),cloud().listTeacherStudentLinks()]);
      linkedStudentsCache=students||[];
      const teacherOptions='<option value="">Select teacher</option>'+teachers.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.full_name||x.user_id)+'</option>').join('');
      teacherSel.innerHTML=teacherOptions;
      const bulkTeacher=document.getElementById('bulkAssignmentTeacher');if(bulkTeacher)bulkTeacher.innerHTML=teacherOptions;
      studentSel.innerHTML='<option value="">Select linked student</option>'+students.map(x=>'<option value="'+esc(x.auth_user_id)+'">'+esc(x.name)+' — '+esc(x.class_name||'Class')+(x.section_name?' / '+esc(x.section_name):'')+'</option>').join('');
      const classSel=document.getElementById('bulkAssignmentClass');
      if(classSel){const classes=[...new Set(linkedStudentsCache.map(x=>String(x.class_name||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));classSel.innerHTML='<option value="">Select class</option>'+classes.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');populateBulkSections();}
      box.innerHTML=links.length?links.map(x=>'<div class="assignment-row"><span>'+esc(x.teacher_name||x.teacher_user_id)+'</span><span>'+esc(x.student_name||x.student_user_id)+'</span><button class="secondary" data-remove-assignment="'+esc(x.teacher_user_id)+'" data-student="'+esc(x.student_user_id)+'">Remove</button></div>').join(''):'<div class="muted">No assignments yet.</div>';
      box.querySelectorAll('[data-remove-assignment]').forEach(b=>b.onclick=async()=>{try{await cloud().removeTeacherStudentLink(b.dataset.removeAssignment,b.dataset.student);loadAssignments()}catch(e){alert(e.message||e)}});
    }catch(e){box.textContent=e.message||String(e)}
  }
  function populateBulkSections(){
    const className=document.getElementById('bulkAssignmentClass')?.value||'';
    const sectionSel=document.getElementById('bulkAssignmentSection');if(!sectionSel)return;
    const sections=[...new Set(linkedStudentsCache.filter(x=>!className||String(x.class_name||'')===className).map(x=>String(x.section_name||'').trim()).filter(Boolean))].sort();
    sectionSel.innerHTML='<option value="">All sections</option>'+sections.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
  }
  async function assignWholeClass(){
    if(role()!=='head'||!ready())return;
    const teacher=document.getElementById('bulkAssignmentTeacher')?.value||'';
    const className=document.getElementById('bulkAssignmentClass')?.value||'';
    const sectionName=document.getElementById('bulkAssignmentSection')?.value||'';
    const msg=document.getElementById('bulkAssignmentMsg');
    if(!teacher||!className){if(msg)msg.textContent='Teacher aur class select karein.';return}
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
    const settings=nav.querySelector('[data-view="settings"]');settings?nav.insertBefore(b,settings):nav.appendChild(b);
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
    const title=document.getElementById('page-title');if(title)title.textContent='Notifications';loadNotifications();
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
    if(role()==='head')loadAssignments();
    loadNotifications();
  }
  function boot(){injectStyle();mountStudentLink();mountAssignments();injectNotifications();render()}
  setTimeout(boot,0);setTimeout(boot,500);
  window.EDUNIZAM_ACADEMIC_ACCESS={render,loadNotifications,loadAssignments};
})();