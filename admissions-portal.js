(function(){
  const D=window.EDUNIZAM_ADMISSIONS_DATA;if(!D)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const KEY={apps:'edunizam_admissions_apps',setup:'edunizam_admissions_setup'};
  const read=(k,f)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(f));
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const apps=()=>read(KEY.apps,[]);
  const setup=()=>({...D.defaultSetup,...read(KEY.setup,{})});
  let tab='apply';

  function nextId(){
    const s=setup();
    const year=(s.admissionSession||new Date().getFullYear()).toString().match(/\d{4}/)?.[0]||new Date().getFullYear();
    const n=apps().length+1;
    return (s.applicationPrefix||'ADM')+'-'+year+'-'+String(n).padStart(4,'0');
  }
  function calcPct(){
    const o=Number($('admObtainedMarks').value||0),t=Number($('admTotalMarks').value||0);
    $('admPercentage').value=t>0?((o/t)*100).toFixed(2)+'%':'';
  }
  function currentPrograms(){
    const type=setup().institutionType;
    return D.institutionTypes.find(x=>x.id===type)?.levels||[];
  }
  function fillStatic(){
    $('admQuota').innerHTML='<option value="">Admission category / quota</option>'+D.quotas.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('admQualification').innerHTML='<option value="">Previous qualification</option>'+D.qualificationLevels.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('admissionStatusFilter').innerHTML='<option value="">All Statuses</option>'+D.statuses.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('admissionQuotaFilter').innerHTML='<option value="">All Categories</option>'+D.quotas.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('admissionInstitutionType').innerHTML=D.institutionTypes.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
    $('admDocumentsChecklist').innerHTML=D.documentTypes.map((x,i)=>'<label class="check-option"><input type="checkbox" data-adm-doc="'+i+'"> '+esc(x)+'</label>').join('');
    refreshPrograms();
    loadSetup();
    renderAdmin();
    updateStats();
  }
  function refreshPrograms(){
    const list=currentPrograms();
    $('admProgram').innerHTML='<option value="">Select class / program</option>'+list.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('admissionProgramFilter').innerHTML='<option value="">All Programs</option>'+list.map(x=>'<option>'+esc(x)+'</option>').join('');
  }
  function loadSetup(){
    const s=setup();
    $('admissionInstitutionName').value=s.institutionName;
    $('admissionInstitutionType').value=s.institutionType;
    $('admissionSession').value=s.admissionSession;
    $('admissionApplicationPrefix').value=s.applicationPrefix;
    $('admissionApplicationFee').value=s.applicationFee;
    $('admissionRequireTest').checked=!!s.requireTest;
    $('admissionRequireInterview').checked=!!s.requireInterview;
    $('admissionSessionBadge').textContent='Session '+s.admissionSession;
    renderSetupSummary();
  }
  function saveSetup(){
    const s={
      institutionName:$('admissionInstitutionName').value.trim()||'EduNizam Institute',
      institutionType:$('admissionInstitutionType').value,
      admissionSession:$('admissionSession').value.trim()||'2026-27',
      applicationPrefix:($('admissionApplicationPrefix').value.trim()||'ADM').toUpperCase(),
      applicationFee:Number($('admissionApplicationFee').value||0),
      currency:'PKR',
      requireTest:$('admissionRequireTest').checked,
      requireInterview:$('admissionRequireInterview').checked
    };
    write(KEY.setup,s);refreshPrograms();loadSetup();renderAdmin();alert('Admission portal setup saved.');
  }
  function docs(){
    return [...document.querySelectorAll('[data-adm-doc]')].map((el,i)=>({name:D.documentTypes[i],provided:el.checked}));
  }
  function getForm(status){
    const s=setup(),o=Number($('admObtainedMarks').value||0),t=Number($('admTotalMarks').value||0);
    return{
      applicationId:nextId(),status,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      institutionName:s.institutionName,institutionType:s.institutionType,session:s.admissionSession,
      applicantName:$('admApplicantName').value.trim(),fatherName:$('admFatherName').value.trim(),
      cnic:$('admCnic').value.trim(),dob:$('admDob').value,gender:$('admGender').value,
      phone:$('admPhone').value.trim(),email:$('admEmail').value.trim(),address:$('admAddress').value.trim(),
      city:$('admCity').value.trim(),district:$('admDistrict').value.trim(),program:$('admProgram').value,
      quota:$('admQuota').value,qualification:$('admQualification').value,previousInstitute:$('admPrevInstitute').value.trim(),
      obtainedMarks:o,totalMarks:t,percentage:t>0?Number(((o/t)*100).toFixed(2)):null,
      documents:docs(),testRequired:s.requireTest,interviewRequired:s.requireInterview,
      testMarks:null,interviewMarks:null,meritScore:null,adminNote:''
    }
  }
  function valid(a,allowDraft){
    if(allowDraft)return a.applicantName||a.cnic||a.program;
    return a.applicantName&&a.fatherName&&a.cnic&&a.program&&a.qualification;
  }
  function saveApplication(status){
    const a=getForm(status);
    if(!valid(a,status==='Draft'))return alert(status==='Draft'?'Enter at least applicant name, CNIC or program.':'Please complete applicant name, guardian name, CNIC/B-Form, program and previous qualification.');
    const arr=apps();arr.push(a);write(KEY.apps,arr);clearForm();renderAdmin();updateStats();
    $('admissionSubmitResult').innerHTML='<div class="admission-success"><strong>'+esc(a.applicationId)+'</strong><span>'+esc(status==='Draft'?'Draft saved':'Application submitted successfully')+'</span><button data-print-admission="'+a.applicationId+'" class="secondary">Print Application</button></div>';
    document.querySelector('[data-print-admission]')?.addEventListener('click',()=>printApplication(a.applicationId));
  }
  function clearForm(){
    ['admApplicantName','admFatherName','admCnic','admDob','admPhone','admEmail','admAddress','admCity','admDistrict','admPrevInstitute','admObtainedMarks','admTotalMarks','admPercentage'].forEach(id=>$(id).value='');
    ['admGender','admProgram','admQuota','admQualification'].forEach(id=>$(id).value='');
    document.querySelectorAll('[data-adm-doc]').forEach(x=>x.checked=false);
  }
  function showTab(name){
    tab=name;
    document.querySelectorAll('[data-admission-tab]').forEach(b=>b.classList.toggle('active',b.dataset.admissionTab===name));
    $('admissionApplyPanel').classList.toggle('hidden',name!=='apply');
    $('admissionTrackPanel').classList.toggle('hidden',name!=='track');
    $('admissionAdminPanel').classList.toggle('hidden',name!=='admin');
    $('admissionSetupPanel').classList.toggle('hidden',name!=='setup');
    if(name==='admin')renderAdmin();
    if(name==='setup')renderSetupSummary();
  }
  function renderAdmin(){
    if(!$('admissionAdminList'))return;
    const q=$('admissionAdminSearch').value.trim().toLowerCase(),st=$('admissionStatusFilter').value,p=$('admissionProgramFilter').value,quota=$('admissionQuotaFilter').value;
    const arr=apps().filter(a=>(!q||[a.applicationId,a.applicantName,a.cnic,a.program,a.phone].join(' ').toLowerCase().includes(q))&&(!st||a.status===st)&&(!p||a.program===p)&&(!quota||a.quota===quota)).slice().reverse();
    $('admissionAdminList').innerHTML=arr.length?arr.map(a=>card(a)).join(''):'<div class="empty-state">No matching applications.</div>';
    document.querySelectorAll('[data-adm-status]').forEach(s=>s.onchange=()=>updateStatus(s.dataset.admStatus,s.value));
    document.querySelectorAll('[data-adm-print]').forEach(b=>b.onclick=()=>printApplication(b.dataset.admPrint));
    document.querySelectorAll('[data-adm-delete]').forEach(b=>b.onclick=()=>removeApp(b.dataset.admDelete));
  }
  function card(a){
    const missing=(a.documents||[]).filter(d=>!d.provided).length;
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(a.applicationId)+'</span><span class="trust-badge trust-official">'+esc(a.status)+'</span></div></div><h3>'+esc(a.applicantName)+'</h3><p class="muted">'+esc(a.program)+' · '+esc(a.session)+' · '+esc(a.quota||'General')+'</p><div class="paper-meta"><span>'+esc(a.cnic)+'</span><span>'+esc(a.phone||'No phone')+'</span><span>'+missing+' docs pending</span></div><div class="form-grid"><select data-adm-status="'+esc(a.applicationId)+'">'+D.statuses.map(s=>'<option '+(s===a.status?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></div><div class="paper-actions"><button data-adm-print="'+esc(a.applicationId)+'">Print</button><button class="secondary-action" data-adm-delete="'+esc(a.applicationId)+'">Delete</button></div></article>';
  }
  function updateStatus(id,status){const arr=apps(),a=arr.find(x=>x.applicationId===id);if(!a)return;a.status=status;a.updatedAt=new Date().toISOString();write(KEY.apps,arr);renderAdmin();updateStats()}
  function removeApp(id){write(KEY.apps,apps().filter(x=>x.applicationId!==id));renderAdmin();updateStats()}
  function track(){
    const id=$('admissionTrackId').value.trim().toUpperCase(),cnic=$('admissionTrackCnic').value.trim();
    const a=apps().find(x=>x.applicationId.toUpperCase()===id&&x.cnic===cnic);
    $('admissionTrackResult').innerHTML=a?'<article class="paper-card"><h3>'+esc(a.applicantName)+'</h3><p><strong>'+esc(a.applicationId)+'</strong></p><div class="paper-meta"><span>'+esc(a.program)+'</span><span>'+esc(a.status)+'</span><span>'+esc(a.session)+'</span></div><p class="coverage-note">Last updated: '+new Date(a.updatedAt).toLocaleString()+'</p><button data-track-print="'+esc(a.applicationId)+'">Print Application</button></article>':'<div class="empty-state">Application not found. Check Application ID and CNIC/B-Form.</div>';
    document.querySelector('[data-track-print]')?.addEventListener('click',e=>printApplication(e.target.dataset.trackPrint));
  }
  function printApplication(id){
    const a=apps().find(x=>x.applicationId===id);if(!a)return;
    const w=window.open('','_blank');if(!w)return;
    const docList=(a.documents||[]).map(d=>'<li>'+esc(d.name)+': '+(d.provided?'Provided':'Pending')+'</li>').join('');
    w.document.write('<html><head><title>'+esc(a.applicationId)+'</title><style>body{font-family:Arial;padding:32px;line-height:1.5}h1{margin-bottom:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}.box{border:1px solid #ccc;padding:14px;margin-top:18px}</style></head><body><h1>'+esc(a.institutionName)+'</h1><p>Online Admission Application · '+esc(a.session)+'</p><div class="box"><strong>Application ID: '+esc(a.applicationId)+'</strong><br>Status: '+esc(a.status)+'</div><div class="grid box"><div>Applicant: '+esc(a.applicantName)+'</div><div>Father/Guardian: '+esc(a.fatherName)+'</div><div>CNIC/B-Form: '+esc(a.cnic)+'</div><div>DOB: '+esc(a.dob)+'</div><div>Program: '+esc(a.program)+'</div><div>Category: '+esc(a.quota)+'</div><div>Qualification: '+esc(a.qualification)+'</div><div>Marks: '+(a.percentage==null?'N/A':a.percentage+'%')+'</div><div>Phone: '+esc(a.phone)+'</div><div>Email: '+esc(a.email)+'</div></div><div class="box"><strong>Documents</strong><ul>'+docList+'</ul></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function renderSetupSummary(){
    const s=setup(),type=D.institutionTypes.find(x=>x.id===s.institutionType)?.name||s.institutionType;
    $('admissionSetupSummary').innerHTML='<article class="paper-card"><h3>'+esc(s.institutionName)+'</h3><div class="paper-meta"><span>'+esc(type)+'</span><span>Session '+esc(s.admissionSession)+'</span><span>Fee PKR '+Number(s.applicationFee||0).toLocaleString()+'</span></div><p class="coverage-note">Test: '+(s.requireTest?'Required':'No')+' · Interview: '+(s.requireInterview?'Required':'No')+' · Prefix: '+esc(s.applicationPrefix)+'</p></article>';
  }
  function updateStats(){
    const a=apps();$('admissionStatTotal').textContent=a.length;$('admissionStatSubmitted').textContent=a.filter(x=>x.status==='Submitted'||x.status==='Under Review').length;$('admissionStatSelected').textContent=a.filter(x=>x.status==='Selected'||x.status==='Admitted').length;$('admissionStatPending').textContent=a.filter(x=>x.status==='Documents Pending').length;
  }

  document.querySelectorAll('[data-admission-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.admissionTab));
  $('admObtainedMarks').addEventListener('input',calcPct);$('admTotalMarks').addEventListener('input',calcPct);
  $('submitAdmissionBtn').onclick=()=>saveApplication('Submitted');$('saveAdmissionDraftBtn').onclick=()=>saveApplication('Draft');$('clearAdmissionBtn').onclick=clearForm;
  $('trackAdmissionBtn').onclick=track;$('saveAdmissionSetupBtn').onclick=saveSetup;
  $('admissionInstitutionType').addEventListener('change',()=>{const s=setup();s.institutionType=$('admissionInstitutionType').value;write(KEY.setup,s);refreshPrograms()});
  ['admissionAdminSearch'].forEach(id=>$(id).addEventListener('input',renderAdmin));
  ['admissionStatusFilter','admissionProgramFilter','admissionQuotaFilter'].forEach(id=>$(id).addEventListener('change',renderAdmin));
  window.renderAdmissionsPortal=()=>{loadSetup();renderAdmin();updateStats()};
  fillStatic();
})();