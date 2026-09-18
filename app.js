const state={
 students:JSON.parse(localStorage.getItem('edunizam_students')||'[]'),
 attendance:JSON.parse(localStorage.getItem('edunizam_attendance')||'{}'),
 fees:JSON.parse(localStorage.getItem('edunizam_fees')||'[]'),
 results:JSON.parse(localStorage.getItem('edunizam_results')||'[]'),
 settings:JSON.parse(localStorage.getItem('edunizam_settings')||'{"schoolName":"My School","phone":"","address":""}'),
 activity:JSON.parse(localStorage.getItem('edunizam_activity')||'[]')
};
const $=id=>document.getElementById(id);
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
 document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
 document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
 $(view).classList.add('active');
 $('page-title').textContent=document.querySelector('[data-view="'+view+'"]').textContent;
 if(view==='attendance')renderAttendance();
 if(view==='pastpapers')renderPastPapers();
 if(view==='practice'&&window.renderPracticeCenter)window.renderPracticeCenter();
 if(view==='study'&&window.renderStudyLibrary)window.renderStudyLibrary();
 if(view==='schoolassessments'&&window.renderSchoolAssessments)window.renderSchoolAssessments();
 if(view==='universities'&&window.renderUniversityHub)window.renderUniversityHub();
 if(view==='vu'&&window.renderVUSpecial)window.renderVUSpecial();
 if(view==='vu'&&window.renderVUWorkspace)window.renderVUWorkspace();
 if(view==='admissions'&&window.renderAdmissionsPortal)window.renderAdmissionsPortal();
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
function renderStudents(){
 $('studentList').innerHTML=state.students.length?state.students.map(s=>'<div class="row"><strong>'+esc(s.name)+'</strong><span>'+esc(s.father||'-')+'</span><span>'+esc(s.className||'-')+'</span><span>'+esc(s.phone||'-')+'</span><button onclick="removeStudent('+s.id+')">Delete</button></div>').join(''):'<div class="muted">No students added yet.</div>';
}
window.removeStudent=id=>{state.students=state.students.filter(s=>s.id!==id);persist();renderAll();};
function todayKey(){return new Date().toISOString().slice(0,10)}
function renderAttendance(){
 $('todayLabel').textContent=new Date().toLocaleDateString();
 const day=state.attendance[todayKey()]||{};
 $('attendanceList').innerHTML=state.students.length?state.students.map(s=>'<div class="row attendance-row"><strong>'+esc(s.name)+'</strong><label><input type="radio" name="att_'+s.id+'" value="Present" '+((day[s.id]||'Present')==='Present'?'checked':'')+'> Present</label><label><input type="radio" name="att_'+s.id+'" value="Absent" '+(day[s.id]==='Absent'?'checked':'')+'> Absent</label></div>').join(''):'<div class="muted">Add students first.</div>';
}
$('saveAttendanceBtn').onclick=()=>{
 const day={}; state.students.forEach(s=>{const x=document.querySelector('input[name="att_'+s.id+'"]:checked');day[s.id]=x?x.value:'Present';});
 state.attendance[todayKey()]=day;persist();logActivity('Attendance saved for '+todayKey());renderStats();
};
function fillStudentSelects(){
 const opts='<option value="">Select student</option>'+state.students.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');
 $('feeStudent').innerHTML=opts;$('resultStudent').innerHTML=opts;
}
$('saveFeeBtn').onclick=()=>{
 const studentId=Number($('feeStudent').value),amount=Number($('feeAmount').value||0),status=$('feeStatus').value;
 if(!studentId||amount<=0)return alert('Select student and enter amount');
 state.fees.push({id:Date.now(),studentId,amount,status,date:todayKey()});persist();logActivity('Fee record added');renderAll();$('feeAmount').value='';
};
function renderFees(){
 $('feeList').innerHTML=state.fees.length?state.fees.slice().reverse().map(f=>{const s=state.students.find(x=>x.id===f.studentId);return '<div class="row"><strong>'+esc(s?.name||'Student')+'</strong><span>Rs '+f.amount+'</span><span class="badge">'+f.status+'</span><span>'+f.date+'</span><span></span></div>'}).join(''):'<div class="muted">No fee records yet.</div>';
}
$('saveResultBtn').onclick=()=>{
 const studentId=Number($('resultStudent').value),subject=$('resultSubject').value.trim(),marks=Number($('resultMarks').value),total=Number($('resultTotal').value);
 if(!studentId||!subject||!total)return alert('Complete result fields');
 state.results.push({id:Date.now(),studentId,subject,marks,total});persist();logActivity('Result added for '+subject);renderResults();
};
function renderResults(){
 $('resultList').innerHTML=state.results.length?state.results.slice().reverse().map(r=>{const s=state.students.find(x=>x.id===r.studentId);const p=Math.round((r.marks/r.total)*100);return '<div class="row"><strong>'+esc(s?.name||'Student')+'</strong><span>'+esc(r.subject)+'</span><span>'+r.marks+'/'+r.total+'</span><span>'+p+'%</span><span></span></div>'}).join(''):'<div class="muted">No results yet.</div>';
}
document.querySelectorAll('.prompt-chip').forEach(b=>b.onclick=()=>$('aiPrompt').value=b.textContent+': ');
$('generateBtn').onclick=()=>{
 const q=$('aiPrompt').value.trim(); if(!q)return alert('Enter a request');
 $('aiOutput').textContent='Secure AI backend is not connected yet. Request saved locally:\n\n'+q;
 logActivity('AI draft requested');
};
$('saveSettingsBtn').onclick=()=>{
 state.settings={schoolName:$('schoolNameInput').value.trim()||'My School',phone:$('schoolPhoneInput').value.trim(),address:$('schoolAddressInput').value.trim()};
 persist();renderSettings();logActivity('School settings updated');
};
function renderSettings(){
 $('school-name').textContent=state.settings.schoolName;
 $('schoolNameInput').value=state.settings.schoolName||'';$('schoolPhoneInput').value=state.settings.phone||'';$('schoolAddressInput').value=state.settings.address||'';
}
function renderActivity(){
 $('activityList').innerHTML=state.activity.length?state.activity.slice(-6).reverse().map(a=>'<div><strong>'+esc(a.text)+'</strong><br><small>'+esc(a.time)+'</small></div>').join('<hr>'):'No activity yet.';
}
function renderStats(){
 $('statStudents').textContent=state.students.length;
 const day=state.attendance[todayKey()]||{};$('statPresent').textContent=Object.values(day).filter(x=>x==='Present').length;
 const paid=state.fees.filter(x=>x.status==='Paid').reduce((a,b)=>a+b.amount,0),pending=state.fees.filter(x=>x.status==='Pending').reduce((a,b)=>a+b.amount,0);
 $('statFees').textContent='Rs '+paid.toLocaleString();$('statPending').textContent='Rs '+pending.toLocaleString();
}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function renderAll(){renderStudents();renderAttendance();renderFees();renderResults();fillStudentSelects();renderStats();renderSettings();renderActivity();}
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
$('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
renderAll();
