const state={
 students:JSON.parse(localStorage.getItem('edunizam_students')||'[]'),
 attendance:JSON.parse(localStorage.getItem('edunizam_attendance')||'{}'),
 fees:JSON.parse(localStorage.getItem('edunizam_fees')||'[]'),
 results:JSON.parse(localStorage.getItem('edunizam_results')||'[]'),
 settings:JSON.parse(localStorage.getItem('edunizam_settings')||'{"schoolName":"My School","schoolType":"School","tagline":"Learn • Grow • Lead","session":"","phone":"","address":""}'),
 activity:JSON.parse(localStorage.getItem('edunizam_activity')||'[]')
};
const $=id=>document.getElementById(id);
const DIAG_KEY='edunizam_runtime_diagnostics';
function readDiagnostics(){try{return JSON.parse(localStorage.getItem(DIAG_KEY)||'[]')}catch{return[]}}
function writeDiagnostics(items){localStorage.setItem(DIAG_KEY,JSON.stringify((items||[]).slice(-20)))}
function recordDiagnostic(type,message,source=''){
 const items=readDiagnostics();
 items.push({type:String(type||'error'),message:String(message||'Unknown error').slice(0,500),source:String(source||'').slice(0,300),at:new Date().toISOString()});
 writeDiagnostics(items);
 renderDiagnostics();
}
function renderDiagnostics(){
 const count=$('diagnosticCount'),list=$('diagnosticList');
 if(!count||!list)return;
 const items=readDiagnostics();
 count.textContent=items.length?items.length+' recent issue(s) recorded':'No recent runtime issues recorded';
 list.innerHTML=items.length?items.slice().reverse().map(x=>'<div class="row"><strong>'+esc(x.type)+'</strong><span>'+esc(x.message)+'</span><span>'+esc(new Date(x.at).toLocaleString())+'</span></div>').join(''):'<div class="muted">Runtime diagnostics are clear.</div>';
}
window.addEventListener('error',e=>recordDiagnostic('JavaScript Error',e.message,e.filename||''));
window.addEventListener('unhandledrejection',e=>recordDiagnostic('Unhandled Promise',e.reason?.message||e.reason||'Unhandled promise rejection'));

function currentRole(){try{const r=JSON.parse(localStorage.getItem('edunizam_session')||'null')?.role||'student';return r==='admin'?'head':r}catch{return'student'}}
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
async function setView(view){
 if(window.EDUNIZAM_ROLE_SCOPE?.canView && !window.EDUNIZAM_ROLE_SCOPE.canView(view)){
   window.EDUNIZAM_RELIABILITY?.report?.('Access Guard','Blocked a role from opening a restricted section.',String(view||''),'warning');
   const fallback='dashboard';
   if(view!==fallback&&window.EDUNIZAM_ROLE_SCOPE.canView(fallback))return setView(fallback);
   return;
 }
 const target=$(view);if(!target)return;
 const nav=document.querySelector('[data-view="'+view+'"]');
 // Make navigation feel instant on mobile: reveal the destination before waiting for lazy feature code.
 document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
 document.querySelectorAll('.nav-item').forEach(v=>{
   const active=v.dataset.view===view;
   v.classList.toggle('active',active);
   if(active)v.setAttribute('aria-current','page');else v.removeAttribute('aria-current');
 });
 target.classList.add('active');
 const navGroup=nav?.closest?.('details.nav-group');if(navGroup)navGroup.open=true;
 $('page-title').textContent=nav?.textContent?.trim()||view;
 // Remove a stale loader/error notice before every navigation or Retry attempt.
 Array.from(target.children).forEach(el=>{
   if(el.classList?.contains('feature-loading-notice'))el.remove();
 });
 const loader=window.EDUNIZAM_FEATURE_LOADER;
 let loadingNotice=null;
 if(loader&&!loader.isReady(view)){
   loadingNotice=document.createElement('div');
   loadingNotice.className='feature-loading-notice';
   loadingNotice.setAttribute('role','status');
   loadingNotice.setAttribute('aria-live','polite');
   loadingNotice.innerHTML='<span class="feature-loading-spinner" aria-hidden="true"></span><span>Opening section…</span>';
   target.prepend(loadingNotice);
   // Give the browser one paint so taps never look frozen while scripts are fetched.
   await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
   try{
     await loader.ensure(view);
     loadingNotice.remove();
     loadingNotice=null;
   }catch(e){
     console.error('Feature load failed:',view,e);
     loadingNotice.className='feature-loading-notice error';
     loadingNotice.innerHTML='<span>This section could not load. Check the connection and try again.</span><button type="button" class="secondary">Retry</button>';
     const retryBtn=loadingNotice.querySelector('button');
     retryBtn.onclick=async()=>{
       retryBtn.disabled=true;
       retryBtn.textContent='Retrying…';
       loadingNotice.remove();
       await setView(view);
     };
     window.EDUNIZAM_PREMIUM?.toast?.('Section load failed. Tap Retry.','error');
     return;
   }
 }
 if(view==='attendance')renderAttendance();
 if(view==='attendanceanalytics'&&window.EDUNIZAM_ATTENDANCE_ANALYTICS?.render)window.EDUNIZAM_ATTENDANCE_ANALYTICS.render();
 if(view==='pastpapers')renderPastPapers();
 if(view==='practice'&&window.renderPracticeCenter)window.renderPracticeCenter();
 if(view==='study'&&window.renderStudyLibrary)window.renderStudyLibrary();
 if(view==='schoolassessments'&&window.renderSchoolAssessments)window.renderSchoolAssessments();
 if(view==='universities'&&window.renderUniversityHub)window.renderUniversityHub();
 if(view==='competitive'&&window.renderCompetitiveExams)window.renderCompetitiveExams();
 if(view==='ecosystem'&&window.renderEducationEcosystem)window.renderEducationEcosystem();
 if(view==='pathways'&&window.renderExamPathways)window.renderExamPathways();
 if(view==='vu'&&window.renderVUSpecial)window.renderVUSpecial();
 if(view==='vu'&&window.renderVUWorkspace)window.renderVUWorkspace();
 if(view==='admissions'&&window.renderAdmissionsPortal)window.renderAdmissionsPortal();
 if(view==='studentprofile'&&window.renderStudentPerformance)window.renderStudentPerformance();
 if(view==='behaviorcenter'&&window.EDUNIZAM_BEHAVIOR_CENTER?.render)window.EDUNIZAM_BEHAVIOR_CENTER.render();
 if(view==='parentcomplaints'&&window.EDUNIZAM_PARENT_COMPLAINTS?.render)window.EDUNIZAM_PARENT_COMPLAINTS.render();
 if(view==='gatecenter'&&window.EDUNIZAM_GATE_CENTER?.render)window.EDUNIZAM_GATE_CENTER.render();
 if(view==='schoolwork'&&window.EDUNIZAM_SCHOOL_WORK?.render)window.EDUNIZAM_SCHOOL_WORK.render();
 if(view==='noticeboard'&&window.EDUNIZAM_NOTICE_BOARD?.render)window.EDUNIZAM_NOTICE_BOARD.render();
 if(view==='lessoncenter'&&window.EDUNIZAM_LESSON_CENTER?.render)window.EDUNIZAM_LESSON_CENTER.render();
 if(view==='calendarcenter'&&window.EDUNIZAM_CALENDAR_CENTER?.render)window.EDUNIZAM_CALENDAR_CENTER.render();
 if(view==='schedulecenter'&&window.EDUNIZAM_TIMETABLE_DATESHEET?.render)window.EDUNIZAM_TIMETABLE_DATESHEET.render();
 if((view==='functionscenter'||view==='ourstudents')&&window.EDUNIZAM_SCHOOL_COMMUNITY?.refresh)window.EDUNIZAM_SCHOOL_COMMUNITY.refresh();
 if(view==='inboxcenter'&&window.EDUNIZAM_MESSAGING_CENTER?.render)window.EDUNIZAM_MESSAGING_CENTER.render();
 if(view==='helpdeskcenter'&&window.EDUNIZAM_HELPDESK_CENTER?.render)window.EDUNIZAM_HELPDESK_CENTER.render();
 if(view==='leavecenter'&&window.EDUNIZAM_LEAVE_CENTER?.render)window.EDUNIZAM_LEAVE_CENTER.render();
 if(view==='examcenter'&&window.EDUNIZAM_EXAM_CENTER?.render)window.EDUNIZAM_EXAM_CENTER.render();
 if(view==='staffcenter'&&window.EDUNIZAM_STAFF_CENTER?.render)window.EDUNIZAM_STAFF_CENTER.render();
 if(view==='stafftime'&&window.EDUNIZAM_STAFF_TIME?.render)window.EDUNIZAM_STAFF_TIME.render();
 if(view==='staffpayroll'&&window.EDUNIZAM_STAFF_PAYROLL?.render)window.EDUNIZAM_STAFF_PAYROLL.render();
 if(view==='training'&&window.EDUNIZAM_TEACHER_TRAINING?.render)window.EDUNIZAM_TEACHER_TRAINING.render();
 if(view==='bulkimport'&&window.EDUNIZAM_BULK_IMPORT?.render)window.EDUNIZAM_BULK_IMPORT.render();
 if(view==='studentdocs'&&window.EDUNIZAM_STUDENT_DOCUMENTS?.render)window.EDUNIZAM_STUDENT_DOCUMENTS.render();
 if(view==='financecenter'&&window.EDUNIZAM_FINANCE_CENTER?.render)window.EDUNIZAM_FINANCE_CENTER.render();
 if(view==='inventorycenter'&&window.EDUNIZAM_INVENTORY_CENTER?.render)window.EDUNIZAM_INVENTORY_CENTER.render();
 if(view==='librarycenter'&&window.EDUNIZAM_LIBRARY_CENTER?.render)window.EDUNIZAM_LIBRARY_CENTER.render();
 if(view==='transportcenter'&&window.EDUNIZAM_TRANSPORT_CENTER?.render)window.EDUNIZAM_TRANSPORT_CENTER.render();
 if(view==='classcenter'&&window.EDUNIZAM_CLASS_SECTION_CENTER?.render)window.EDUNIZAM_CLASS_SECTION_CENTER.render();
 if(view==='auditcenter'&&window.EDUNIZAM_AUDIT_CENTER?.render)window.EDUNIZAM_AUDIT_CENTER.render();
 if(view==='troubleshoot'&&window.EDUNIZAM_RELIABILITY?.render)window.EDUNIZAM_RELIABILITY.render();
 window.dispatchEvent(new CustomEvent('edunizam:view-open',{detail:{view}}));
}
window.EDUNIZAM_APP_NAV={setView};
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=async()=>{
  const targetView=b.dataset.jump;
  await setView(targetView);
  if(targetView==='students')openStudentForm();
});
let editingStudentId=null;
function makeStudentCode(){
  const bytes=new Uint8Array(4);
  if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  return 'STU-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function ensureStudentCode(student){
  if(student&&!student.studentId)student.studentId=makeStudentCode();
  return student?.studentId||'';
}
function clearStudentForm(){
  editingStudentId=null;
  ['studentName','fatherName','studentClass','studentSection','studentPhone','studentBForm','guardianCnic','studentDob','admissionNo','studentAddress','guardianOccupation','studentCaste','studentGender','studentMotherName','studentEmail','studentCity','studentDistrict','studentProvince','studentBloodGroup','studentEmergencyContact','studentPreviousSchool','studentAdmissionDate','studentRollNo','studentHealthNotes','studentSpecialNeeds','studentRemarks'].forEach(id=>{if($(id))$(id).value=''});
  if($('studentStatus'))$('studentStatus').value='active';
  if($('studentPhotoFile'))$('studentPhotoFile').value='';
  const save=$('saveStudentBtn');if(save)save.textContent='Save Student';
}
function openStudentForm(){
  clearStudentForm();
  const wrap=$('studentFormWrap');
  if(!wrap)return;
  wrap.classList.remove('hidden');
  $('studentName')?.focus();
}
const addStudentBtn=$('addStudentBtn');
if(addStudentBtn)addStudentBtn.onclick=openStudentForm;
$('saveStudentBtn').onclick=async()=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can add or edit students.');
 const name=$('studentName').value.trim();
 const required={
   name,
   className:$('studentClass')?.value.trim()||'',
   admissionNo:$('admissionNo')?.value.trim()||'',
   dateOfBirth:$('studentDob')?.value||'',
   gender:$('studentGender')?.value||'',
   father:$('fatherName')?.value.trim()||'',
   phone:$('studentPhone')?.value.trim()||'',
   bFormNo:$('studentBForm')?.value.trim()||''
 };
 const missing=Object.entries(required).filter(([,v])=>!v).map(([k])=>({name:'Student name',className:'Academic group',admissionNo:'Admission / Student No.',dateOfBirth:'Date of birth',gender:'Gender',father:'Guardian name',phone:'Guardian contact',bFormNo:'B-Form No.'}[k]||k));
 if(missing.length)return alert('Required fields complete karein: '+missing.join(', '));
 const photoFile=$('studentPhotoFile')?.files?.[0]||null;
 if(photoFile&&!['image/jpeg','image/png','image/webp'].includes(photoFile.type))return alert('Profile picture JPG, PNG ya WEBP honi chahiye.');
 if(photoFile&&photoFile.size>2*1024*1024)return alert('Profile picture 2 MB se chhoti honi chahiye.');
 const patch={
   ...required,
   sectionName:$('studentSection')?.value.trim()||'',
   guardianCnic:$('guardianCnic')?.value.trim()||'',
   motherName:$('studentMotherName')?.value.trim()||'',
   email:$('studentEmail')?.value.trim()||'',
   address:$('studentAddress')?.value.trim()||'',
   city:$('studentCity')?.value.trim()||'',
   district:$('studentDistrict')?.value.trim()||'',
   province:$('studentProvince')?.value.trim()||'',
   guardianOccupation:$('guardianOccupation')?.value.trim()||'',
   caste:$('studentCaste')?.value.trim()||'',
   bloodGroup:$('studentBloodGroup')?.value.trim()||'',
   emergencyContact:$('studentEmergencyContact')?.value.trim()||'',
   previousSchool:$('studentPreviousSchool')?.value.trim()||'',
   admissionDate:$('studentAdmissionDate')?.value||'',
   rollNo:$('studentRollNo')?.value.trim()||'',
   studentStatus:$('studentStatus')?.value||'active',
   healthNotes:$('studentHealthNotes')?.value.trim()||'',
   specialNeedsNotes:$('studentSpecialNeeds')?.value.trim()||'',
   remarks:$('studentRemarks')?.value.trim()||''
 };
 let savedStudent=null;
 if(editingStudentId!=null){
   const s=state.students.find(x=>String(x.id)===String(editingStudentId));
   if(!s)return alert('Student record not found.');
   Object.assign(s,patch);
   savedStudent=s;
   logActivity('Student updated: '+name);
 }else{
   savedStudent=Object.assign({id:Date.now(),studentId:makeStudentCode()},patch);
   state.students.push(savedStudent);
   logActivity('Student added: '+name);
 }
 persist();clearStudentForm();$('studentFormWrap').classList.add('hidden');renderAll();
 try{
   if(window.EDUNIZAM_CORE_CLOUD?.ready?.()){
     const cloudRow=await window.EDUNIZAM_CORE_CLOUD.upsertStudent(savedStudent);
     if(cloudRow?.photo_path)savedStudent.photoPath=cloudRow.photo_path;
     if(photoFile){
       const photoRow=await window.EDUNIZAM_CORE_CLOUD.uploadStudentPhoto(savedStudent.id,photoFile);
       savedStudent.photoPath=photoRow?.photo_path||savedStudent.photoPath||'';
       persist();
     }
   }else if(photoFile){
     alert('Student profile save ho gaya, lekin profile picture ke liye Cloud Mode required hai.');
   }
 }catch(e){
   console.warn('Student cloud sync:',e.message);
   recordDiagnostic('Student Cloud Sync',e.message||e,'Students');
   alert('Student is saved on this device, but cloud/profile photo sync failed. Open Troubleshoot to see the exact error, then retry Cloud Backup & Sync.');
 }
 renderStudents();
};
function scopedStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(state.students)||state.students}
function renderStudents(){
 let addedCode=false;
 state.students.forEach(s=>{if(!s.studentId){ensureStudentCode(s);addedCode=true}});
 if(addedCode)persist();
 const list=scopedStudents(),canManage=currentRole()==='head';
 $('studentList').innerHTML=list.length?list.map(s=>{
   const initials=String(s.name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
   const avatar='<span data-student-avatar-path="'+esc(s.photoPath||'')+'" style="width:42px;height:42px;border-radius:50%;display:inline-grid;place-items:center;background:#e8f4f0;color:#075347;font-weight:900;overflow:hidden;flex:0 0 42px">'+esc(initials)+'</span>';
   const details=[s.admissionNo&&('Adm '+s.admissionNo),s.gender,s.bFormNo&&('B-Form '+s.bFormNo),s.studentStatus&&s.studentStatus!=='active'?s.studentStatus:''].filter(Boolean).join(' · ');
   return '<div class="row"><div style="display:flex;gap:10px;align-items:center">'+avatar+'<div><strong>'+esc(s.name)+'</strong><small style="display:block;margin-top:4px;color:#64748b">Student Code: '+esc(s.studentId||'-')+(details?' · '+esc(details):'')+'</small></div></div><span>'+esc(s.father||'-')+'</span><span>'+esc([s.className,s.sectionName&&('Sec '+s.sectionName)].filter(Boolean).join(' · ')||'-')+'</span><span>'+esc(s.phone||'-')+'</span>'+(canManage?'<span class="access-row"><button class="secondary" onclick="editStudent(\''+String(s.id).replace(/'/g,"\\'")+'\')">Edit</button><button onclick="removeStudent(\''+String(s.id).replace(/'/g,"\\'")+'\')">Delete</button></span>':'<span></span>')+'</div>';
 }).join(''):'<div class="muted">No accessible students.</div>';
 hydrateStudentAvatars();
 const addBtn=$('addStudentBtn');if(addBtn)addBtn.style.display=canManage?'inline-block':'none';
}
async function hydrateStudentAvatars(){
 if(!window.EDUNIZAM_CORE_CLOUD?.ready?.()||!window.EDUNIZAM_CORE_CLOUD?.createProfilePhotoUrl)return;
 const nodes=[...document.querySelectorAll('[data-student-avatar-path]')].filter(n=>n.dataset.studentAvatarPath);
 await Promise.all(nodes.map(async n=>{
   try{
     const url=await window.EDUNIZAM_CORE_CLOUD.createProfilePhotoUrl(n.dataset.studentAvatarPath,1800);
     if(url)n.innerHTML='<img alt="Student profile" src="'+esc(url)+'" style="width:100%;height:100%;object-fit:cover">';
   }catch(_){}
 }));
}
window.editStudent=id=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can edit students.');
 const s=state.students.find(x=>String(x.id)===String(id));if(!s)return;
 editingStudentId=s.id;
 $('studentName').value=s.name||'';
 $('fatherName').value=s.father||'';
 $('studentClass').value=s.className||'';
 if($('studentSection'))$('studentSection').value=s.sectionName||'';
 $('studentPhone').value=s.phone||'';
 if($('studentBForm'))$('studentBForm').value=s.bFormNo||'';
 if($('guardianCnic'))$('guardianCnic').value=s.guardianCnic||'';
 if($('studentDob'))$('studentDob').value=s.dateOfBirth||'';
 if($('admissionNo'))$('admissionNo').value=s.admissionNo||'';
 if($('studentAddress'))$('studentAddress').value=s.address||'';
 if($('guardianOccupation'))$('guardianOccupation').value=s.guardianOccupation||'';
 if($('studentCaste'))$('studentCaste').value=s.caste||'';
 if($('studentGender'))$('studentGender').value=s.gender||s.profileDetails?.gender||'';
 if($('studentMotherName'))$('studentMotherName').value=s.motherName||s.profileDetails?.mother_name||'';
 if($('studentEmail'))$('studentEmail').value=s.email||s.profileDetails?.email||'';
 if($('studentCity'))$('studentCity').value=s.city||s.profileDetails?.city||'';
 if($('studentDistrict'))$('studentDistrict').value=s.district||s.profileDetails?.district||'';
 if($('studentProvince'))$('studentProvince').value=s.province||s.profileDetails?.province||'';
 if($('studentBloodGroup'))$('studentBloodGroup').value=s.bloodGroup||s.profileDetails?.blood_group||'';
 if($('studentEmergencyContact'))$('studentEmergencyContact').value=s.emergencyContact||s.profileDetails?.emergency_contact||'';
 if($('studentPreviousSchool'))$('studentPreviousSchool').value=s.previousSchool||s.profileDetails?.previous_school||'';
 if($('studentAdmissionDate'))$('studentAdmissionDate').value=s.admissionDate||'';
 if($('studentRollNo'))$('studentRollNo').value=s.rollNo||'';
 if($('studentStatus'))$('studentStatus').value=s.studentStatus||s.profileDetails?.student_status||'active';
 if($('studentHealthNotes'))$('studentHealthNotes').value=s.healthNotes||s.profileDetails?.health_notes||'';
 if($('studentSpecialNeeds'))$('studentSpecialNeeds').value=s.specialNeedsNotes||s.profileDetails?.special_needs_notes||'';
 if($('studentRemarks'))$('studentRemarks').value=s.remarks||s.profileDetails?.remarks||'';
 if($('studentPhotoFile'))$('studentPhotoFile').value='';
 $('studentFormWrap').classList.remove('hidden');
 $('saveStudentBtn').textContent='Update Student';
 $('studentName').focus();
};
window.removeStudent=async id=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can delete students.');
 const s=state.students.find(x=>String(x.id)===String(id));if(!s)return;
 if(!confirm('Delete '+s.name+' and related attendance, fee and result records?'))return;
 try{
   if(window.EDUNIZAM_CORE_CLOUD?.ready?.()){
     await window.EDUNIZAM_CORE_CLOUD.deleteStudentByLocalId(s.id);
   }
 }catch(e){
   alert('Student could not be deleted from cloud: '+(e.message||e));
   return;
 }
 state.students=state.students.filter(x=>String(x.id)!==String(id));
 state.fees=state.fees.filter(x=>String(x.studentId)!==String(id));
 state.results=state.results.filter(x=>String(x.studentId)!==String(id));
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
    sectionName:student.sectionName||'',
    phone:student.phone||'',
    bFormNo:student.bFormNo||'',
    guardianCnic:student.guardianCnic||'',
    dateOfBirth:student.dateOfBirth||'',
    admissionNo:student.admissionNo||'',
    address:student.address||'',
    guardianOccupation:student.guardianOccupation||'',
    caste:student.caste||'',
    rollNo:student.rollNo||'',
    studentId:student.studentId||makeStudentCode(),
    admissionApplicationId:student.admissionApplicationId||'',
    admissionDate:student.admissionDate||'',
    feeSnapshot:student.feeSnapshot||null,
    authUserId:student.authUserId||null,
    photoPath:student.photoPath||'',
    gender:student.gender||'',
    motherName:student.motherName||'',
    email:student.email||'',
    city:student.city||'',
    district:student.district||'',
    province:student.province||'',
    bloodGroup:student.bloodGroup||'',
    emergencyContact:student.emergencyContact||'',
    previousSchool:student.previousSchool||'',
    studentStatus:student.studentStatus||'active',
    healthNotes:student.healthNotes||'',
    specialNeedsNotes:student.specialNeedsNotes||'',
    remarks:student.remarks||'',
    source:'admission'
  };
  state.students.push(record);
  persist();logActivity('Student enrolled from admission: '+record.name);renderAll();
  return record;
};
function todayKey(){return localDateKey()}
async function renderAttendanceAudit(){
 const card=$('attendanceAuditCard'),list=$('attendanceAuditList');
 if(!card||!list)return;
 const isHead=currentRole()==='head';
 card.classList.toggle('hidden',!isHead);
 if(!isHead)return;
 const core=window.EDUNIZAM_CORE_CLOUD;
 if(!core?.ready?.()||!core?.listAttendanceAudit){
   list.innerHTML='<div class="empty-state">Cloud Mode connect hone ke baad Teacher/Admin marking audit yahan show hoga.</div>';
   return;
 }
 list.innerHTML='<div class="muted">Loading attendance audit...</div>';
 try{
   const rows=await core.listAttendanceAudit(todayKey());
   list.innerHTML=rows.length?rows.map(x=>{
     const cls=[x.className&&('Academic Group '+x.className),x.sectionName&&('Section '+x.sectionName)].filter(Boolean).join(' · ');
     const time=x.updatedAt?new Date(x.updatedAt).toLocaleString():'Time unavailable';
     return '<div class="row"><div><strong>'+esc(x.studentName)+'</strong><small style="display:block;margin-top:4px">'+esc(cls||'Academic group not set')+'</small></div><span class="badge">'+esc(x.status)+'</span><span><strong>'+esc(x.markerName)+'</strong><small style="display:block;margin-top:4px">'+esc(x.markerRole)+'</small></span><span>'+esc(time)+'</span></div>';
   }).join(''):'<div class="empty-state">Aaj ki cloud attendance abhi mark nahi hui.</div>';
 }catch(e){
   list.innerHTML='<div class="empty-state">Attendance audit load nahi ho saka: '+esc(e.message||e)+'</div>';
 }
}
function renderAttendance(){
 $('todayLabel').textContent=new Date().toLocaleDateString();
 const day=state.attendance[todayKey()]||{},editable=canManageAttendance();
 const list=scopedStudents();
 $('attendanceList').innerHTML=list.length?list.map(s=>{
   const v=day[s.id]??day[String(s.id)]??'';
   const info=[s.className&&('Academic Group '+s.className+(s.sectionName?'/'+s.sectionName:'')),s.phone||'No contact number'].filter(Boolean).join(' · ');
   const option=(value,label)=>'<label><input type="radio" name="att_'+s.id+'" value="'+value+'" '+(v===value?'checked':'')+' '+(!editable?'disabled':'')+'> '+label+'</label>';
   return '<div class="row attendance-row"><div><strong>'+esc(s.name)+'</strong><small style="display:block;margin-top:4px">'+esc(info)+'</small></div><div class="attendance-status-options">'+option('Present','Present')+option('Absent','Absent')+option('Leave','Leave')+option('Late','Late')+'</div></div>';
 }).join(''):'<div class="muted">No accessible students.</div>';
 const btn=$('saveAttendanceBtn');if(btn)btn.style.display=editable?'inline-block':'none';
 if($('attendance')?.classList.contains('active'))renderAttendanceAudit();
}
$('refreshAttendanceAuditBtn')?.addEventListener('click',()=>renderAttendanceAudit());
$('saveAttendanceBtn').onclick=async()=>{
 if(!canManageAttendance())return alert('Only Teacher or Head of Institute can save attendance.');
 const list=scopedStudents(),day={};
 for(const s of list){const x=document.querySelector('input[name="att_'+s.id+'"]:checked');if(!x)return alert('Mark Present or Absent for every visible student before saving.');day[s.id]=x.value;}
 const btn=$('saveAttendanceBtn');if(btn)btn.disabled=true;
 state.attendance[todayKey()]=Object.assign({},state.attendance[todayKey()]||{},day);persist();logActivity('Attendance saved for '+todayKey());renderStats();
 try{
   if(window.EDUNIZAM_CORE_CLOUD?.ready?.())await window.EDUNIZAM_CORE_CLOUD.saveAttendanceDay(todayKey(),day);
   await renderAttendanceAudit();
 }catch(e){
   recordDiagnostic('Attendance Cloud Sync',e.message||e,'Attendance');
   alert('Attendance device par save ho gayi, lekin cloud sync fail hui. Admin ko remote absence report cloud reconnect hone ke baad milegi.');
 }
 try{await window.EDUNIZAM_WORKFLOW_ALERTS?.attendanceSaved?.(day,todayKey())}catch(e){console.warn('Attendance alerts:',e.message||e)}
 window.dispatchEvent(new CustomEvent('edunizam:attendance-updated',{detail:{kind:'student',date:todayKey()}}));
 if(btn)btn.disabled=false;
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
$('saveResultBtn').onclick=async()=>{
 if(!canManageResults())return alert('Only Teacher or Head of Institute can add results.');
 const studentId=Number($('resultStudent').value),subject=$('resultSubject').value.trim(),marks=Number($('resultMarks').value),total=Number($('resultTotal').value);
 if(!studentId||!subject||!Number.isFinite(marks)||!Number.isFinite(total)||total<=0||marks<0||marks>total)return alert('Enter valid marks between 0 and total marks.');
 const resultRecord={id:Date.now(),studentId,subject,marks,total,date:todayKey(),type:$('resultExamType')?.value||'Monthly Test'};
 const btn=$('saveResultBtn');if(btn)btn.disabled=true;
 state.results.push(resultRecord);persist();logActivity('Result added for '+subject);renderResults();
 try{
   if(window.EDUNIZAM_CORE_CLOUD?.ready?.())await window.EDUNIZAM_CORE_CLOUD.saveResultRecord(resultRecord);
   await window.EDUNIZAM_WORKFLOW_ALERTS?.resultSaved?.(resultRecord);
   window.dispatchEvent(new CustomEvent('edunizam:results-updated',{detail:{studentId,subject,type:resultRecord.type}}));
 }catch(e){
   recordDiagnostic('Result Cloud Sync',e.message||e,'Results');
   alert('Result device par save ho gaya, lekin cloud sync fail hui. Official report publish karne se pehle cloud reconnect/sync karein.');
 }finally{if(btn)btn.disabled=false}
};
function renderResults(){
 const ids=new Set(scopedStudents().map(s=>s.id)),rows=state.results.filter(r=>ids.has(r.studentId));
 $('resultList').innerHTML=rows.length?rows.slice().reverse().map(r=>{const s=state.students.find(x=>x.id===r.studentId);const p=Math.round((r.marks/r.total)*100);return '<div class="row"><strong>'+esc(s?.name||'Student')+'</strong><span>'+esc(r.subject)+'</span><span>'+esc(r.type||'Result')+'</span><span>'+r.marks+'/'+r.total+' · '+p+'%</span><span></span></div>'}).join(''):'<div class="muted">No results yet.</div>';
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
$('clearDiagnosticsBtn')?.addEventListener('click',()=>{writeDiagnostics([]);renderDiagnostics();});
$('saveSettingsBtn').onclick=async()=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can change school settings.');
 let logo=state.settings.schoolLogo||'';
 const logoFile=$('schoolLogoInput')?.files?.[0];
 if(logoFile){
   if(logoFile.size>900000)return alert('Institute logo 900 KB se chhota rakhein.');
   logo=await new Promise((resolve,reject)=>{
     const reader=new FileReader();
     reader.onload=()=>resolve(String(reader.result||''));
     reader.onerror=()=>reject(new Error('Logo read nahi ho saka.'));
     reader.readAsDataURL(logoFile);
   }).catch(e=>{alert(e.message);return logo});
 }
 state.settings={
  schoolName:$('schoolNameInput').value.trim()||'My School',
  schoolType:$('schoolTypeInput').value||'School',
  tagline:$('schoolTaglineInput').value.trim(),
  session:$('schoolSessionInput').value.trim(),
  phone:$('schoolPhoneInput').value.trim(),
  address:$('schoolAddressInput').value.trim(),
  country:$('schoolCountryInput')?.value||'Pakistan',currency:$('schoolCurrencyInput')?.value||'PKR',locale:$('schoolLocaleInput')?.value||'en-PK',timezone:$('schoolTimezoneInput')?.value.trim()||'Asia/Karachi',
  schoolLogo:logo
 };
 persist();renderSettings();logActivity('School settings updated');
 if($('schoolLogoInput'))$('schoolLogoInput').value='';
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
 renderDiagnostics();
 $('school-name').textContent=[state.settings.schoolName,state.settings.session].filter(Boolean).join(' · ');
 $('schoolNameInput').value=state.settings.schoolName||'';
 $('schoolTypeInput').value=state.settings.schoolType||'School';
 $('schoolTaglineInput').value=state.settings.tagline||'';
 $('schoolSessionInput').value=state.settings.session||'';
 $('schoolPhoneInput').value=state.settings.phone||'';
 $('schoolAddressInput').value=state.settings.address||'';
 if($('schoolCountryInput'))$('schoolCountryInput').value=state.settings.country||'Pakistan';
 if($('schoolCurrencyInput'))$('schoolCurrencyInput').value=state.settings.currency||'PKR';
 if($('schoolLocaleInput'))$('schoolLocaleInput').value=state.settings.locale||'en-PK';
 if($('schoolTimezoneInput'))$('schoolTimezoneInput').value=state.settings.timezone||'Asia/Karachi';
 const topLogo=$('schoolLogoTop'),preview=$('schoolLogoPreview'),wrap=$('schoolLogoPreviewWrap'),sideLogo=$('sidebarSchoolLogo'),sideName=$('sidebarSchoolName'),sideType=$('sidebarSchoolType'),
 dashLogo=$('dashboardInstituteLogo'),dashFallback=$('dashboardInstituteFallback'),dashName=$('dashboardInstituteName'),dashMeta=$('dashboardInstituteMeta'),dashTitle=$('dashboardWelcomeTitle'),dashText=$('dashboardWelcomeText');
 const instituteName=state.settings.schoolName||'My School',instituteType=state.settings.schoolType||'School';
 if(sideName)sideName.textContent=instituteName;
 if(sideType)sideType.textContent=instituteType;
 if(dashName)dashName.textContent=instituteName;
 if(dashMeta)dashMeta.textContent=[instituteType,state.settings.session,'Powered by EduNizam'].filter(Boolean).join(' · ');
 if(dashTitle)dashTitle.textContent='Welcome to '+instituteName;
 if(dashText)dashText.textContent='Manage '+instituteType.toLowerCase()+' students, admissions, attendance, fees, academics and learning resources from one professional workspace.';
 if(state.settings.schoolLogo){
   if(topLogo){topLogo.src=state.settings.schoolLogo;topLogo.classList.remove('hidden')}
   if(sideLogo){sideLogo.src=state.settings.schoolLogo;sideLogo.classList.remove('hidden')}
   if(dashLogo){dashLogo.src=state.settings.schoolLogo;dashLogo.classList.remove('hidden')}
   if(dashFallback)dashFallback.classList.add('hidden');
   if(preview)preview.src=state.settings.schoolLogo;
   if(wrap)wrap.classList.remove('hidden');
 }else{
   if(topLogo){topLogo.removeAttribute('src');topLogo.classList.add('hidden')}
   if(sideLogo){sideLogo.removeAttribute('src');sideLogo.classList.add('hidden')}
   if(dashLogo){dashLogo.removeAttribute('src');dashLogo.classList.add('hidden')}
   if(dashFallback)dashFallback.classList.remove('hidden');
   if(wrap)wrap.classList.add('hidden');
 }
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
window.EDUNIZAM_STUDENT_BRIDGE={
  list(){return state.students},
  update(id,patch){
    const s=state.students.find(x=>String(x.id)===String(id));if(!s)return null;
    Object.assign(s,patch||{});persist();renderStudents();fillStudentSelects();return s;
  },
  refresh(){state.students=JSON.parse(localStorage.getItem('edunizam_students')||'[]');renderStudents();fillStudentSelects()}
};
window.EDUNIZAM_FEE_BRIDGE={
  upsert(record){
    if(!record||!record.id)return null;
    const i=state.fees.findIndex(x=>String(x.id)===String(record.id));
    if(i>=0)state.fees[i]=Object.assign({},state.fees[i],record);
    else state.fees.push(record);
    persist();renderFees();renderStats();return record;
  },
  remove(id){
    state.fees=state.fees.filter(x=>String(x.id)!==String(id));persist();renderFees();renderStats();
  },
  refresh(){
    state.fees=JSON.parse(localStorage.getItem('edunizam_fees')||'[]');renderFees();renderStats();
  }
};
$('removeSchoolLogoBtn')?.addEventListener('click',()=>{
 if(currentRole()!=='head')return alert('Only Head of Institute can change school settings.');
 state.settings.schoolLogo='';persist();renderSettings();logActivity('Institute logo removed');
});
function showStartupFlash(){
 try{
   const raw=localStorage.getItem('edunizam_flash_message');
   if(!raw)return;
   localStorage.removeItem('edunizam_flash_message');
   const msg=JSON.parse(raw);
   if(!msg?.text)return;
   const box=document.createElement('div');
   box.setAttribute('role','status');
   box.style.cssText='position:fixed;right:18px;top:18px;z-index:12000;max-width:min(460px,calc(100vw - 36px));padding:14px 16px;border-radius:14px;background:#ecfdf3;color:#166534;border:1px solid #b7e6c8;box-shadow:0 14px 40px rgba(15,23,42,.16);font-weight:700;line-height:1.45';
   const close=document.createElement('button');
   close.type='button';close.textContent='×';
   close.setAttribute('aria-label','Close confirmation');
   close.style.cssText='float:right;margin-left:12px;border:0;background:transparent;font-size:20px;cursor:pointer;color:inherit';
   close.onclick=()=>box.remove();
   const text=document.createElement('span');text.textContent=msg.text;
   box.append(close,text);
   document.body.appendChild(box);
   setTimeout(()=>box.remove(),9000);
 }catch(_){localStorage.removeItem('edunizam_flash_message')}
}
renderAll();
showStartupFlash();


/* EDUNIZAM_ROLE_ACCESS_V1 — local demo access and class-wise fee setup */
(()=>{
  const ROLE_KEY='edunizam_session';
  const FEE_KEY='edunizam_class_fees';
  const defaultFees={'Play Group':1500,'Nursery':1600,'Prep':1700,'1':1800,'2':1800,'3':1900,'4':2000,'5':2100,'6':2200,'7':2300,'8':2400,'9':2600,'10':2800};
  const classFees=()=>JSON.parse(localStorage.getItem(FEE_KEY)||JSON.stringify(defaultFees));
  const saveClassFees=v=>localStorage.setItem(FEE_KEY,JSON.stringify(v));
  const roleViews={
    student:['dashboard','studentprofile','ourstudents','functionscenter','behaviorcenter','gatecenter','attendanceanalytics','studentdocs','fees','librarycenter','transportcenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','communication','access','notifications','assistant','troubleshoot','help'],
    parent:['dashboard','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','gatecenter','studentdocs','fees','librarycenter','transportcenter','results','attendance','attendanceanalytics','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','communication','access','notifications','assistant','troubleshoot','help'],
    teacher:['dashboard','students','classcenter','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','attendance','attendanceanalytics','inventorycenter','librarycenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','paperbuilder','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','communication','access','notifications','assistant','troubleshoot','help'],
    head:['dashboard','students','classcenter','bulkimport','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','functionscenter','behaviorcenter','parentcomplaints','gatecenter','studentdocs','attendance','attendanceanalytics','fees','financecenter','inventorycenter','librarycenter','transportcenter','results','schoolwork','noticeboard','lessoncenter','calendarcenter','schedulecenter','inboxcenter','helpdeskcenter','leavecenter','examcenter','paperbuilder','dailydiary','pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','admissions','communication','access','notifications','assistant','settings','troubleshoot','help']
  };
  const labels={student:'Student',parent:'Parent / Guardian',teacher:'Teacher',head:'Head of Institute'};
  function injectStyles(){
    const s=document.createElement('style');
    s.textContent='.login-screen{position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#071b33,#0f766e);display:grid;place-items:center;padding:20px}.login-card{width:min(620px,100%);background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 80px #001a}.login-card h1{margin:0;color:#0b2748}.login-card>p{color:#536579}.role-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}.role-choice{padding:16px;text-align:left;border:2px solid #dbe7ee;background:#f8fbfd;color:#15324a;border-radius:14px}.role-choice.active{border-color:#0f766e;background:#e8f7f4}.login-fields{display:grid;gap:12px}.session-chip{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#e8f7f4;border-radius:999px;font-size:14px}.fee-setup-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.fee-class-card{border:1px solid #dbe7ee;border-radius:12px;padding:10px}.fee-class-card label{display:block;font-weight:700;margin-bottom:6px}.fee-class-card input{width:100%;box-sizing:border-box}.role-hidden{display:none!important}@media(max-width:560px){.role-grid{grid-template-columns:1fr}.login-card{padding:20px;border-radius:18px}}';
    document.head.appendChild(s);
  }
  function showLogin(){
    const target='login.html?from=app';
    if(!location.pathname.endsWith('/login.html'))location.replace(target);
  }
  window.addEventListener('edunizam:auth-invalid',showLogin);
  window.addEventListener('edunizam:school-selection-required',showLogin);
  function applyRole(retry=0){
    const session=JSON.parse(localStorage.getItem(ROLE_KEY)||'null');
    if(!session){
      if(retry<8){
        setTimeout(()=>applyRole(retry+1),300);
        return;
      }
      showLogin();
      return;
    }
    const normalizedRole=session.role==='admin'?'head':session.role;
    const allowed=roleViews[normalizedRole]||roleViews.student;
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('role-hidden',!allowed.includes(b.dataset.view)));
    const actions=document.querySelector('.topbar-actions');if(actions&&!document.getElementById('roleSession')){const chip=document.createElement('span');chip.id='roleSession';chip.className='session-chip';chip.innerHTML='<strong>'+(labels[normalizedRole]||labels.student)+'</strong><button class="secondary" style="padding:4px 8px">Logout</button>';chip.querySelector('button').onclick=()=>{localStorage.removeItem(ROLE_KEY);location.reload()};actions.prepend(chip)}
    const active=document.querySelector('.view.active')?.id;if(active&&!allowed.includes(active))setView(allowed[0]);
    renderAll();
  }
  function installFeeSetup(){
    const section=document.getElementById('fees');if(!section||document.getElementById('classFeeSetup'))return;
    const card=document.createElement('article');card.className='card';card.id='classFeeSetup';
    card.innerHTML='<div class="section-head"><div><h2>Class-wise Monthly Fee</h2><p class="muted">Head of Institute apni marzi se har class ki fee set kar sakta hai.</p></div><button id="saveClassFeesBtn">Save Fees</button></div><div id="classFeeGrid" class="fee-setup-grid"></div>';
    section.prepend(card);const fees=classFees();
    card.querySelector('#classFeeGrid').innerHTML=Object.entries(fees).map(([c,a])=>'<div class="fee-class-card"><label>'+esc(c)+'</label><input type="number" min="0" data-fee-class="'+esc(c)+'" value="'+Number(a||0)+'"></div>').join('');
    card.querySelector('#saveClassFeesBtn').onclick=()=>{if(currentRole()!=='head')return alert('Only Head of Institute can change class fees.');const next={};card.querySelectorAll('[data-fee-class]').forEach(i=>next[i.dataset.feeClass]=Number(i.value||0));saveClassFees(next);window.EDUNIZAM_FEE_CENTER?.syncClassFees?.(next).catch?.(e=>console.warn('Class fee cloud sync:',e.message));logActivity('Class-wise fee structure updated');alert('Class fees saved successfully.');};
    const select=document.getElementById('feeStudent');select?.addEventListener('change',()=>{const student=state.students.find(s=>s.id===Number(select.value));if(!student)return;const amount=classFees()[student.className];if(amount!=null)document.getElementById('feeAmount').value=amount;});
    card.style.display=currentRole()==='head'?'block':'none';
  }
  injectStyles();installFeeSetup();applyRole();
})();
