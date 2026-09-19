(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
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
    card.innerHTML='<h3>Link My Student Record</h3><p class="muted">Student apna school-issued Student Code enter karke attendance, fees aur results apne account se link kare.</p><div class="form-grid"><input id="claimStudentRecordCode" placeholder="Student code"><button id="claimStudentRecordBtn">Link My Record</button></div><div id="claimStudentRecordMsg" class="coverage-note"></div>';
    grid.appendChild(card);
    card.querySelector('#claimStudentRecordBtn').onclick=async()=>{
      const msg=card.querySelector('#claimStudentRecordMsg'),code=card.querySelector('#claimStudentRecordCode').value.trim();
      if(!code)return msg.textContent='Student code enter karein.';
      try{msg.textContent='Linking record...';const x=await cloud().claimStudentRecord(code);msg.textContent='Linked successfully: '+(x?.student_name||'Student')+' '+(x?.class_name?'('+x.class_name+')':'');}
      catch(e){msg.textContent=e.message||String(e)}
    };
  }
  function mountAssignments(){
    const access=document.getElementById('access');if(!access||document.getElementById('teacherAssignmentCard'))return;
    const grid=access.querySelector('.access-grid');if(!grid)return;
    const card=document.createElement('article');card.className='card';card.id='teacherAssignmentCard';
    card.innerHTML='<div class="section-head"><div><h3>Teacher–Student Assignment</h3><p class="muted">Head linked teachers ko students assign kare.</p></div><button id="refreshAssignmentsBtn" class="secondary">Refresh</button></div><div class="form-grid"><select id="assignmentTeacher"><option value="">Select teacher</option></select><select id="assignmentStudent"><option value="">Select linked student</option></select><button id="saveAssignmentBtn">Assign Student</button></div><div id="assignmentList" class="assignment-list"></div>';
    grid.appendChild(card);
    card.querySelector('#refreshAssignmentsBtn').onclick=loadAssignments;
    card.querySelector('#saveAssignmentBtn').onclick=saveAssignment;
  }
  async function loadAssignments(){
    const teacherSel=document.getElementById('assignmentTeacher'),studentSel=document.getElementById('assignmentStudent'),box=document.getElementById('assignmentList');
    if(!teacherSel||!studentSel||!box||role()!=='head'||!ready())return;
    try{
      const [teachers,students,links]=await Promise.all([cloud().listInstitutionTeachers(),cloud().listLinkedCoreStudents(),cloud().listTeacherStudentLinks()]);
      teacherSel.innerHTML='<option value="">Select teacher</option>'+teachers.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.full_name||x.user_id)+'</option>').join('');
      studentSel.innerHTML='<option value="">Select linked student</option>'+students.map(x=>'<option value="'+esc(x.auth_user_id)+'">'+esc(x.name)+' — '+esc(x.class_name||'Class')+'</option>').join('');
      box.innerHTML=links.length?links.map(x=>'<div class="assignment-row"><span>'+esc(x.teacher_name||x.teacher_user_id)+'</span><span>'+esc(x.student_name||x.student_user_id)+'</span><button class="secondary" data-remove-assignment="'+esc(x.teacher_user_id)+'" data-student="'+esc(x.student_user_id)+'">Remove</button></div>').join(''):'<div class="muted">No assignments yet.</div>';
      box.querySelectorAll('[data-remove-assignment]').forEach(b=>b.onclick=async()=>{try{await cloud().removeTeacherStudentLink(b.dataset.removeAssignment,b.dataset.student);loadAssignments()}catch(e){alert(e.message||e)}});
    }catch(e){box.textContent=e.message||String(e)}
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