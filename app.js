const state={
 students:JSON.parse(localStorage.getItem('edunizam_students')||'[]'),
 attendance:JSON.parse(localStorage.getItem('edunizam_attendance')||'{}'),
 fees:JSON.parse(localStorage.getItem('edunizam_fees')||'[]'),
 results:JSON.parse(localStorage.getItem('edunizam_results')||'[]'),
 settings:JSON.parse(localStorage.getItem('edunizam_settings')||'{"schoolName":"My School","schoolType":"School","tagline":"Learn • Grow • Lead","session":"","phone":"","address":""}'),
 activity:JSON.parse(localStorage.getItem('edunizam_activity')||'[]')
};
const $=id=>document.getElementById(id);
function currentRole(){try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')?.role||'student'}catch{return'student'}}
function canManageAttendance(){return ['teacher','head'].includes(currentRole())}
function canManageResults(){return ['teacher','head'].includes(currentRole())}
function canManageFees(){return currentRole()==='head'}
function localDateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}
function persist(){
 localStorage.setItem('edunizam_students',JSON.stringify(state.students));
 localStorage.setItem('edunizam_attendance',JSON.stringify(state.attendance));
 localStorage.setItem('edunizam_fees',JSON.stringify(state.fees));
 localStorage.setItem('edunizam_results',JSON.stringify(state.results));
 localStorage.setItem('edunizam_settings',JSON.stringify(state.settings));
 localStorage.setItem('edunizam_activity',JSON.stringify(state.activity.slice(-20)));
}
function logActivity(text){state.activity.push({text,time:new Date().toLocaleString()});persist();renderActivity();}
function setView(view){
 const target=$(view);if(!target)return;
 document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
 document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
 target.classList.add('active');
 const nav=document.querySelector('[data-view="'+view+'"]');
 $('page-title').textContent=nav?.textContent?.trim()||view;
 if(view==='attendance')renderAttendance();
 if(view==='pastpapers')renderPastPapers();
 if(view==='practice'&&window.renderPracticeCenter)window.renderPracticeCenter();
 if(view==='study'&&window.renderStudyLibrary)window.renderStudyLibrary();
 if(view==='schoolassessments'&&window.renderSchoolAssessments)window.renderSchoolAssessments();
 if(view==='universities'&&window.renderUniversityHub)window.renderUniversityHub();
 if(view==='vu'&&window.renderVUSpecial)window.renderVUSpecial();
 if(view==='vu'&&window.renderVUWorkspace)window.renderVUWorkspace();
 if(view==='admissions'&&window.renderAdmissionsPortal)window.renderAdmissionsPortal();
 if(view==='studentprofile'&&window.renderStudentPerformance)window.renderStudentPerformance();
 if(view==='schoolwork'&&window.EDUNIZAM_SCHOOL_WORK?.render)window.EDUNIZAM_SCHOOL_WORK.render();
}
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>setView(b.dataset.jump));
$('addStudentBtn').onclick=()=>$('studentFormWrap').classList.toggle('hidden');
$('saveStudentBtn').onclick=()=>{
 const name=$('studentName').value.trim(); if(!name)return alert('Enter student name');
 state.students.push({id:Date.now(),name,father:$('fatherName').value.trim(),className:$('studentClass').value.trim(),phone:$('studentPhone').value.trim()});
 ['studentName','fatherName','studentClass','studentPhone'].forEach(id=>$(id).value='');
 persist();logActivity('Student added: '+name);renderAll();
};
function scopedStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(state.students)||state.students}
function renderStudents(){
 const list=scopedStudents(),canDelete=(window.EDUNIZAM_ROLE_SCOPE?.role?.()||'head')==='head';
 $('studentList').innerHTML=list.length?list.map(s=>'<div class="row"><strong>'+esc(s.name)+'</strong><span>'+esc(s.father||'-')+'</span><span>'+esc(s.className||'-')+'</span><span>'+esc(s.phone||'-')+'</span>'+(canDelete?'<button onclick="removeStudent('+s.id+')">Delete</button>':'<span></span>')+'</div>').join(''):'<div class="muted">No accessible students.</div>';
 const addBtn=$('addStudentBtn');if(addBtn)addBtn.style.display=canDelete?'inline-block':'none';
}
window.removeStudent=id=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can delete students.');
 const s=state.students.find(x=>Number(x.id)===Number(id));if(!s)return;
 if(!confirm('Delete '+s.name+' and related local attendance, fee and result records?'))return;
 state.students=state.students.filter(x=>Number(x.id)!==Number(id));
 state.fees=state.fees.filter(x=>Number(x.studentId)!==Number(id));
 state.results=state.results.filter(x=>Number(x.studentId)!==Number(id));
 Object.values(state.attendance).forEach(day=>{delete day[id];delete day[String(id)]});
 logActivity('Student deleted: '+s.name);persist();renderAll();
};
window.addStudentFromAdmission=(student)=>{
  if(!student||!student.name)return null;
  const existing=state.students.find(s=>s.admissionApplicationId&&s.admissionApplicationId===student.admissionApplicationId);
  if(existing)return existing;
  const record={
    id:student.id||Date.now(),
    name:student.name,
    father:student.father||'',
    className:student.className||'',
    phone:student.phone||'',
    rollNo:student.rollNo||'',
    studentId:student.studentId||'',
    admissionApplicationId:student.admissionApplicationId||'',
    admissionDate:student.admissionDate||'',
    feeSnapshot:student.feeSnapshot||null,
    authUserId:student.authUserId||null,
    source:'admission'
  };
  state.students.push(record);
  persist();logActivity('Student enrolled from admission: '+record.name);renderAll();
  return record;
};
function todayKey(){return localDateKey()}
function renderAttendance(){
 $('todayLabel').textContent=new Date().toLocaleDateString();
 const day=state.attendance[todayKey()]||{},editable=canManageAttendance();
 const list=scopedStudents();
 $('attendanceList').innerHTML=list.length?list.map(s=>{const v=day[s.id]??day[String(s.id)]??'';return '<div class="row attendance-row"><strong>'+esc(s.name)+'</strong><label><input type="radio" name="att_'+s.id+'" value="Present" '+(v==='Present'?'checked':'')+' '+(!editable?'disabled':'')+'> Present</label><label><input type="radio" name="att_'+s.id+'" value="Absent" '+(v==='Absent'?'checked':'')+' '+(!editable?'disabled':'')+'> Absent</label></div>'}).join(''):'<div class="muted">No accessible students.</div>';
 const btn=$('saveAttendanceBtn');if(btn)btn.style.display=editable?'inline-block':'none';
}
$('saveAttendanceBtn').onclick=()=>{
 if(!canManageAttendance())return alert('Only Teacher or Head of Institute can save attendance.');
 const list=scopedStudents(),day={};
 for(const s of list){const x=document.querySelector('input[name="att_'+s.id+'"]:checked');if(!x)return alert('Mark Present or Absent for every visible student before saving.');day[s.id]=x.value;}
 state.attendance[todayKey()]=Object.assign({},state.attendance[todayKey()]||{},day);persist();logActivity('Attendance saved for '+todayKey());renderStats();
 window.EDUNIZAM_WORKFLOW_ALERTS?.attendanceSaved?.(day,todayKey());
};
function fillStudentSelects(){
 const opts='<option value="">Select student</option>'+scopedStudents().map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');
 $('feeStudent').innerHTML=opts;$('resultStudent').innerHTML=opts;
}
$('saveFeeBtn').onclick=()=>{
 if(!canManageFees())return alert('Only Head of Institute can add fee records.');
 const studentId=Number($('feeStudent').value),amount=Number($('feeAmount').value||0),status=$('feeStatus').value;
 if(!studentId||amount<=0)return alert('Select student and enter amount');
 const feeRecord={id:Date.now(),studentId,amount,status,date:todayKey()};state.fees.push(feeRecord);persist();logActivity('Fee record added');renderAll();$('feeAmount').value='';
 window.EDUNIZAM_WORKFLOW_ALERTS?.feeSaved?.(feeRecord);
};
function renderFees(){
 const ids=new Set(scopedStudents().map(s=>s.id)),rows=state.fees.filter(f=>ids.has(f.studentId));
 $('feeList').innerHTML=rows.length?rows.slice().reverse().map(f=>{const s=state.students.find(x=>x.id===f.studentId);return '<div class="row"><strong>'+esc(s?.name||'Student')+'</strong><span>Rs '+f.amount+'</span><span class="badge">'+f.status+'</span><span>'+f.date+'</span><span></span></div>'}).join(''):'<div class="muted">No fee records yet.</div>';
}
$('saveResultBtn').onclick=()=>{
 if(!canManageResults())return alert('Only Teacher or Head of Institute can add results.');
 const studentId=Number($('resultStudent').value),subject=$('resultSubject').value.trim(),marks=Number($('resultMarks').value),total=Number($('resultTotal').value);
 if(!studentId||!subject||!Number.isFinite(marks)||!Number.isFinite(total)||total<=0||marks<0||marks>total)return alert('Enter valid marks between 0 and total marks.');
 const resultRecord={id:Date.now(),studentId,subject,marks,total,date:todayKey()};state.results.push(resultRecord);persist();logActivity('Result added for '+subject);renderResults();
 window.EDUNIZAM_WORKFLOW_ALERTS?.resultSaved?.(resultRecord);
};
function renderResults(){
 const ids=new Set(scopedStudents().map(s=>s.id)),rows=state.results.filter(r=>ids.has(r.studentId));
 $('resultList').innerHTML=rows.length?rows.slice().reverse().map(r=>{const s=state.students.find(x=>x.id===r.studentId);const p=Math.round((r.marks/r.total)*100);return '<div class="row"><strong>'+esc(s?.name||'Student')+'</strong><span>'+esc(r.subject)+'</span><span>'+r.marks+'/'+r.total+'</span><span>'+p+'%</span><span></span></div>'}).join(''):'<div class="muted">No results yet.</div>';
}
document.querySelectorAll('.prompt-chip').forEach(b=>b.onclick=()=>$('aiPrompt').value=b.textContent+': ');
$('generateBtn').onclick=async()=>{
 const q=$('aiPrompt').value.trim();if(!q)return alert('Enter a request');
 const out=$('aiOutput'),btn=$('generateBtn');
 if(!window.EDUNIZAM_AI?.ready?.()){
  out.textContent='EduNizam AI requires Cloud Mode + a signed-in account. Configure Supabase in Settings, deploy the ai-assistant Edge Function, and add the OPENAI_API_KEY secret.';
  return;
 }
 try{
  btn.disabled=true;out.textContent='EduNizam AI is thinking...';
  const r=await window.EDUNIZAM_AI.ask(q);
  out.textContent=r.answer||'No answer returned.';
  logActivity('AI request completed'+(Number.isFinite(r.remaining)?' · '+r.remaining+' daily request(s) remaining':''));
 }catch(e){out.textContent='AI request failed: '+(e.message||e)}
 finally{btn.disabled=false}
};
$('pushCoreCloudBtn')?.addEventListener('click',pushCoreCloud);
$('pullCoreCloudBtn')?.addEventListener('click',pullCoreCloud);
$('saveSettingsBtn').onclick=()=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can change school settings.');
 state.settings={
  schoolName:$('schoolNameInput').value.trim()||'My School',
  schoolType:$('schoolTypeInput').value||'School',
  tagline:$('schoolTaglineInput').value.trim(),
  session:$('schoolSessionInput').value.trim(),
  phone:$('schoolPhoneInput').value.trim(),
  address:$('schoolAddressInput').value.trim()
 };
 persist();renderSettings();logActivity('School settings updated');
};

async function refreshCoreCloudStatus(){
 const status=$('coreCloudStatus'),msg=$('coreCloudMessage'),core=window.EDUNIZAM_CORE_CLOUD;
 if(!status||!msg)return;
 if(!core?.ready?.()){status.textContent='Local Mode';msg.textContent='Cloud backend is not connected yet. Your current data remains on this device.';return;}
 status.textContent='Cloud Ready';
 msg.textContent='Supabase is connected. You can upload this device data or load your cloud data here.';
}
async function pushCoreCloud(){
 const core=window.EDUNIZAM_CORE_CLOUD,msg=$('coreCloudMessage');
 if(!core?.ready?.())return alert('Cloud backend is not connected yet.');
 try{
   if(msg)msg.textContent='Uploading school data...';
   const r=await core.pushAllLocalToCloud();
   if(msg)msg.textContent='Cloud backup completed. '+r.students+' student record(s) are linked in cloud.';
   alert('School data uploaded to cloud successfully.');
 }catch(e){if(msg)msg.textContent='Cloud upload failed: '+(e.message||e);alert(e.message||'Cloud upload failed.')}
}
async function pullCoreCloud(){
 const core=window.EDUNIZAM_CORE_CLOUD,msg=$('coreCloudMessage');
 if(!core?.ready?.())return alert('Cloud backend is not connected yet.');
 if(!confirm('Load cloud school data on this device? This will replace the current local core school records.'))return;
 try{
   if(msg)msg.textContent='Loading cloud data...';
   const r=await core.pullAllCloudToLocal();
   location.reload();
 }catch(e){if(msg)msg.textContent='Cloud load failed: '+(e.message||e);alert(e.message||'Cloud load failed.')}
}
function renderSettings(){
 refreshCoreCloudStatus();
 $('school-name').textContent=[state.settings.schoolName,state.settings.session].filter(Boolean).join(' · ');
 $('schoolNameInput').value=state.settings.schoolName||'';
 $('schoolTypeInput').value=state.settings.schoolType||'School';
 $('schoolTaglineInput').value=state.settings.tagline||'';
 $('schoolSessionInput').value=state.settings.session||'';
 $('schoolPhoneInput').value=state.settings.phone||'';
 $('schoolAddressInput').value=state.settings.address||'';
}
function renderActivity(){
 $('activityList').innerHTML=state.activity.length?state.activity.slice(-6).reverse().map(a=>'<div><strong>'+esc(a.text)+'</strong><br><small>'+esc(a.time)+'</small></div>').join('<hr>'):'No activity yet.';
}
function renderStats(){
 const visible=scopedStudents(),ids=new Set(visible.map(s=>s.id));$('statStudents').textContent=visible.length;
 const day=state.attendance[todayKey()]||{};$('statPresent').textContent=visible.filter(s=>day[s.id]==='Present').length;
 const paid=state.fees.filter(x=>ids.has(x.studentId)&&x.status==='Paid').reduce((a,b)=>a+b.amount,0),pending=state.fees.filter(x=>ids.has(x.studentId)&&x.status==='Pending').reduce((a,b)=>a+b.amount,0);
 $('statFees').textContent='Rs '+paid.toLocaleString();$('statPending').textContent='Rs '+pending.toLocaleString();
}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function applyEditPermissions(){
 const feeForm=$('saveFeeBtn')?.closest('.form-grid'),resultForm=$('saveResultBtn')?.closest('.form-grid');
 if(feeForm)feeForm.style.display=canManageFees()?'grid':'none';
 if(resultForm)resultForm.style.display=canManageResults()?'grid':'none';
 const feeSetup=$('classFeeSetup');if(feeSetup)feeSetup.style.display=canManageFees()?'block':'none';
}
function renderAll(){renderStudents();renderAttendance();renderFees();renderResults();fillStudentSelects();renderStats();renderSettings();renderActivity();applyEditPermissions();}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
$('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
renderAll();


/* EDUNIZAM_ROLE_ACCESS_V1 — local demo access and class-wise fee setup */
(()=>{
  const ROLE_KEY='edunizam_session';
  const FEE_KEY='edunizam_class_fees';
  const defaultFees={'Play Group':1500,'Nursery':1600,'Prep':1700,'1':1800,'2':1800,'3':1900,'4':2000,'5':2100,'6':2200,'7':2300,'8':2400,'9':2600,'10':2800};
  const classFees=()=>JSON.parse(localStorage.getItem(FEE_KEY)||JSON.stringify(defaultFees));
  const saveClassFees=v=>localStorage.setItem(FEE_KEY,JSON.stringify(v));
  const roleViews={
    student:['dashboard','studentprofile','fees','results','schoolwork','pastpapers','practice','study','schoolassessments','communication','access','notifications','assistant'],
    parent:['dashboard','studentprofile','fees','results','attendance','schoolwork','communication','access','notifications','assistant'],
    teacher:['dashboard','students','studentprofile','attendance','results','schoolwork','pastpapers','practice','study','schoolassessments','communication','access','notifications','assistant'],
    head:['dashboard','students','studentprofile','attendance','fees','results','schoolwork','pastpapers','practice','study','schoolassessments','universities','vu','admissions','communication','access','notifications','assistant','settings']
  };
  const labels={student:'Student',parent:'Parent / Guardian',teacher:'Teacher',head:'Head of Institute'};
  function injectStyles(){
    const s=document.createElement('style');
    s.textContent='.login-screen{position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#071b33,#0f766e);display:grid;place-items:center;padding:20px}.login-card{width:min(620px,100%);background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 80px #001a}.login-card h1{margin:0;color:#0b2748}.login-card>p{color:#536579}.role-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}.role-choice{padding:16px;text-align:left;border:2px solid #dbe7ee;background:#f8fbfd;color:#15324a;border-radius:14px}.role-choice.active{border-color:#0f766e;background:#e8f7f4}.login-fields{display:grid;gap:12px}.session-chip{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#e8f7f4;border-radius:999px;font-size:14px}.fee-setup-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.fee-class-card{border:1px solid #dbe7ee;border-radius:12px;padding:10px}.fee-class-card label{display:block;font-weight:700;margin-bottom:6px}.fee-class-card input{width:100%;box-sizing:border-box}.role-hidden{display:none!important}@media(max-width:560px){.role-grid{grid-template-columns:1fr}.login-card{padding:20px;border-radius:18px}}';
    document.head.appendChild(s);
  }
  function showLogin(){
    if(document.getElementById('edunizamLogin'))return;
    const box=document.createElement('div');box.id='edunizamLogin';box.className='login-screen';
    box.innerHTML='<div class="login-card"><div class="academic-kicker">EduNizam Secure Access</div><h1>Apna role select karein</h1><p>Mobile number ya ID likhein. Demo mode mein password ki zaroorat nahi.</p><div class="role-grid">'+Object.entries(labels).map(([k,v])=>'<button class="role-choice" data-role="'+k+'"><strong>'+v+'</strong><br><small>'+({student:'Apni study aur result dekhein',parent:'Bachay ki progress dekhein',teacher:'Class aur academics manage karein',head:'Pooray institute ka control'}[k])+'</small></button>').join('')+'</div><div class="login-fields"><input id="loginIdentity" placeholder="Mobile number / Student ID / Staff ID"><button id="loginContinue" disabled>Continue</button></div></div>';
    document.body.appendChild(box);let selected='';
    box.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{selected=b.dataset.role;box.querySelectorAll('[data-role]').forEach(x=>x.classList.toggle('active',x===b));box.querySelector('#loginContinue').disabled=false});
    box.querySelector('#loginContinue').onclick=()=>{const identity=box.querySelector('#loginIdentity').value.trim();if(!identity)return alert('Mobile number ya ID likhein');localStorage.setItem(ROLE_KEY,JSON.stringify({role:selected,identity,loginAt:Date.now()}));box.remove();applyRole();};
  }
  function applyRole(){
    const session=JSON.parse(localStorage.getItem(ROLE_KEY)||'null');if(!session){showLogin();return}
    const allowed=roleViews[session.role]||roleViews.student;
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('role-hidden',!allowed.includes(b.dataset.view)));
    const actions=document.querySelector('.topbar-actions');if(actions&&!document.getElementById('roleSession')){const chip=document.createElement('span');chip.id='roleSession';chip.className='session-chip';chip.innerHTML='<strong>'+labels[session.role]+'</strong><button class="secondary" style="padding:4px 8px">Logout</button>';chip.querySelector('button').onclick=()=>{localStorage.removeItem(ROLE_KEY);location.reload()};actions.prepend(chip)}
    const active=document.querySelector('.view.active')?.id;if(active&&!allowed.includes(active))setView(allowed[0]);
    renderAll();
  }
  function installFeeSetup(){
    const section=document.getElementById('fees');if(!section||document.getElementById('classFeeSetup'))return;
    const card=document.createElement('article');card.className='card';card.id='classFeeSetup';
    card.innerHTML='<div class="section-head"><div><h2>Class-wise Monthly Fee</h2><p class="muted">Head of Institute apni marzi se har class ki fee set kar sakta hai.</p></div><button id="saveClassFeesBtn">Save Fees</button></div><div id="classFeeGrid" class="fee-setup-grid"></div>';
    section.prepend(card);const fees=classFees();
    card.querySelector('#classFeeGrid').innerHTML=Object.entries(fees).map(([c,a])=>'<div class="fee-class-card"><label>'+esc(c)+'</label><input type="number" min="0" data-fee-class="'+esc(c)+'" value="'+Number(a||0)+'"></div>').join('');
    card.querySelector('#saveClassFeesBtn').onclick=()=>{if(currentRole()!=='head')return alert('Only Head of Institute can change class fees.');const next={};card.querySelectorAll('[data-fee-class]').forEach(i=>next[i.dataset.feeClass]=Number(i.value||0));saveClassFees(next);logActivity('Class-wise fee structure updated');alert('Class fees saved successfully.');};
    const select=document.getElementById('feeStudent');select?.addEventListener('change',()=>{const student=state.students.find(s=>s.id===Number(select.value));if(!student)return;const amount=classFees()[student.className];if(amount!=null)document.getElementById('feeAmount').value=amount;});
    card.style.display=currentRole()==='head'?'block':'none';
  }
  injectStyles();installFeeSetup();applyRole();
})();
