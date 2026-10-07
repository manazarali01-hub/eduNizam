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
    const prefix=(s.applicationPrefix||'ADM')+'-'+year+'-';
    const highest=apps().reduce((max,row)=>{
      const id=String(row?.applicationId||'');
      if(!id.startsWith(prefix))return max;
      const n=Number(id.slice(prefix.length));
      return Number.isInteger(n)&&n>max?n:max;
    },0);
    return prefix+String(highest+1).padStart(4,'0');
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
    refreshPaymentMethods();
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
    renderFeeStructureEditor();
    renderProgramFeeSummary();
  }
  function feeForProgram(program){
    const s=setup(),f=s.feeStructure?.[program]||{};
    return {
      applicationFee:Number(f.applicationFee ?? s.applicationFee ?? 0),
      admissionFee:Number(f.admissionFee||0),
      monthlyFee:Number(f.monthlyFee||0),
      annualCharges:Number(f.annualCharges||0),
      otherCharges:Number(f.otherCharges||0)
    };
  }
  function renderFeeStructureEditor(){
    const el=$('admissionFeeStructureEditor');if(!el)return;
    const list=currentPrograms(),s=setup();
    el.innerHTML='<div class="fee-row fee-head"><span>Class / Program</span><span>Application</span><span>Admission</span><span>Monthly</span><span>Annual</span><span>Other</span></div>'+
      list.map(p=>{
        const f=s.feeStructure?.[p]||{};
        return '<div class="fee-row"><strong>'+esc(p)+'</strong><input data-fee-program="'+esc(p)+'" data-fee-field="applicationFee" type="number" min="0" value="'+Number(f.applicationFee ?? s.applicationFee ?? 0)+'"><input data-fee-program="'+esc(p)+'" data-fee-field="admissionFee" type="number" min="0" value="'+Number(f.admissionFee||0)+'"><input data-fee-program="'+esc(p)+'" data-fee-field="monthlyFee" type="number" min="0" value="'+Number(f.monthlyFee||0)+'"><input data-fee-program="'+esc(p)+'" data-fee-field="annualCharges" type="number" min="0" value="'+Number(f.annualCharges||0)+'"><input data-fee-program="'+esc(p)+'" data-fee-field="otherCharges" type="number" min="0" value="'+Number(f.otherCharges||0)+'"></div>';
      }).join('');
  }
  function saveFeeStructure(){
    const s=setup(),fs={...(s.feeStructure||{})};
    document.querySelectorAll('[data-fee-program]').forEach(input=>{
      const p=input.dataset.feeProgram,field=input.dataset.feeField;
      fs[p]=fs[p]||{};fs[p][field]=Number(input.value||0);
    });
    s.feeStructure=fs;write(KEY.setup,s);renderProgramFeeSummary();renderSetupSummary();alert('Class/program fee structure saved.');
  }
  function renderProgramFeeSummary(){
    const el=$('admProgramFeeSummary');if(!el)return;
    const p=$('admProgram')?.value;
    if(!p){el.innerHTML='';return;}
    const f=feeForProgram(p);
    const firstTotal=f.applicationFee+f.admissionFee+f.monthlyFee+f.annualCharges+f.otherCharges;
    el.innerHTML='<div class="coverage-note"><strong>'+esc(p)+' Fee</strong><br>Application: PKR '+f.applicationFee.toLocaleString()+' · Admission: PKR '+f.admissionFee.toLocaleString()+' · Monthly: PKR '+f.monthlyFee.toLocaleString()+' · Annual: PKR '+f.annualCharges.toLocaleString()+' · Other: PKR '+f.otherCharges.toLocaleString()+'<br><strong>Initial payable (configured): PKR '+firstTotal.toLocaleString()+'</strong></div>';
  }
  function refreshPaymentMethods(){
    const s=setup(),enabled=s.enabledPaymentMethods||D.paymentMethods.map(x=>x.id);
    const list=D.paymentMethods.filter(x=>enabled.includes(x.id));
    if($('admPaymentMethod'))$('admPaymentMethod').innerHTML='<option value="">Select payment method</option>'+list.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
    renderPaymentInstructions();
  }
  function renderPaymentInstructions(){
    if(!$('admPaymentInstructions'))return;
    const s=setup(),m=$('admPaymentMethod')?.value||'';
    let html='';
    if(m==='bank')html='<strong>Bank Transfer / Deposit</strong><br>'+esc(s.bankName||'Bank not configured')+'<br>'+esc(s.bankAccountTitle||'')+'<br>'+esc(s.bankIban||'');
    else if(m==='raast')html='<strong>Raast Payment</strong><br>Raast ID / Account: '+esc(s.raastId||'Not configured');
    else if(m==='jazzcash')html='<strong>JazzCash</strong><br>'+esc(s.jazzCashTitle||'')+' '+esc(s.jazzCashNumber||'Not configured');
    else if(m==='easypaisa')html='<strong>Easypaisa</strong><br>'+esc(s.easypaisaTitle||'')+' '+esc(s.easypaisaNumber||'Not configured');
    else if(m==='cash')html='<strong>Cash at Institution</strong><br>Submit fee at the admissions/accounts office and enter the receipt number.';
    else if(m==='challan')html='<strong>Printed Challan</strong><br>Use Print Challan, pay through the institution\'s instructed channel, then enter the reference.';
    else if(m==='card')html='<strong>Online Card Payment</strong><br>Gateway: '+esc(s.gatewayProvider||'Not connected')+'. Live payment requires secure backend gateway integration.';
    $('admPaymentInstructions').innerHTML=html?'<div class="coverage-note">'+html+'</div>':'';
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
    if($('admissionBankName'))$('admissionBankName').value=s.bankName||'';
    if($('admissionBankTitle'))$('admissionBankTitle').value=s.bankAccountTitle||'';
    if($('admissionBankIban'))$('admissionBankIban').value=s.bankIban||'';
    if($('admissionRaastId'))$('admissionRaastId').value=s.raastId||'';
    if($('admissionJazzCashNumber'))$('admissionJazzCashNumber').value=s.jazzCashNumber||'';
    if($('admissionJazzCashTitle'))$('admissionJazzCashTitle').value=s.jazzCashTitle||'';
    if($('admissionEasypaisaNumber'))$('admissionEasypaisaNumber').value=s.easypaisaNumber||'';
    if($('admissionEasypaisaTitle'))$('admissionEasypaisaTitle').value=s.easypaisaTitle||'';
    if($('admissionGatewayProvider'))$('admissionGatewayProvider').value=s.gatewayProvider||'Not connected';
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
      requireInterview:$('admissionRequireInterview').checked,
      enabledPaymentMethods:(setup().enabledPaymentMethods||D.defaultSetup.enabledPaymentMethods||[]),
      bankName:$('admissionBankName')?.value.trim()||'',
      bankAccountTitle:$('admissionBankTitle')?.value.trim()||'',
      bankIban:$('admissionBankIban')?.value.trim()||'',
      raastId:$('admissionRaastId')?.value.trim()||'',
      jazzCashNumber:$('admissionJazzCashNumber')?.value.trim()||'',
      jazzCashTitle:$('admissionJazzCashTitle')?.value.trim()||'',
      easypaisaNumber:$('admissionEasypaisaNumber')?.value.trim()||'',
      easypaisaTitle:$('admissionEasypaisaTitle')?.value.trim()||'',
      gatewayProvider:$('admissionGatewayProvider')?.value||'Not connected',
      gatewayMode:'manual'
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
      feeSnapshot:feeForProgram($('admProgram').value),
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
    $('admissionRoleHomePanel')?.classList.toggle('hidden',name!=='rolehome');
    $('admissionApplyPanel').classList.toggle('hidden',name!=='apply');
    $('admissionTrackPanel').classList.toggle('hidden',name!=='track');
    $('admissionAdminPanel').classList.toggle('hidden',name!=='admin');
    $('admissionSchedulesPanel')?.classList.toggle('hidden',name!=='schedules');
    $('admissionMeritPanel')?.classList.toggle('hidden',name!=='merit');
    $('admissionNotificationsPanel')?.classList.toggle('hidden',name!=='notifications');
    $('admissionPaymentsPanel')?.classList.toggle('hidden',name!=='payments');
    $('admissionAuditPanel')?.classList.toggle('hidden',name!=='audit');
    $('admissionSetupPanel').classList.toggle('hidden',name!=='setup');
    if(name==='rolehome')renderRoleHome();
    if(name==='admin')renderAdmin();
    if(['schedules','merit','notifications'].includes(name))window.EDUNIZAM_ADMISSION_SELECTION?.render?.();
    if(name==='payments')renderCloudPayments();
    if(name==='audit')renderAuditLog();
    if(name==='setup'){renderSetupSummary();renderParentLinks();}
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
  function printBrand(name,session){
    let st={};try{st=JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){}
    const logo=st.schoolLogo?'<img class="print-school-logo" src="'+esc(st.schoolLogo)+'" alt="Institute logo">':'';
    const school=esc(name||st.schoolName||'EduNizam Institute');
    const meta=esc(session||st.session||'');
    return '<div class="print-brand">'+logo+'<div><h1>'+school+'</h1>'+(meta?'<p>'+meta+'</p>':'')+'</div></div>';
  }
  function printApplication(id){
    const a=apps().find(x=>x.applicationId===id);if(!a)return;
    const w=window.open('','_blank');if(!w)return;
    const docList=(a.documents||[]).map(d=>'<li>'+esc(d.name)+': '+(d.provided?'Provided':'Pending')+'</li>').join('');
    w.document.write('<html><head><title>'+esc(a.applicationId)+'</title><style>body{font-family:Arial;padding:32px;line-height:1.5;color:#17324a}.print-brand{display:flex;align-items:center;gap:16px}.print-school-logo{width:76px;height:76px;object-fit:contain;border:1px solid #d8e2e7;border-radius:14px;padding:5px}.print-brand h1{margin:0}.print-brand p{margin:4px 0;color:#667}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}.box{border:1px solid #ccc;padding:14px;margin-top:18px}</style></head><body>'+printBrand(a.institutionName,a.session)+'<p>Online Admission Application</p><div class="box"><strong>Application ID: '+esc(a.applicationId)+'</strong><br>Status: '+esc(a.status)+'</div><div class="grid box"><div>Applicant: '+esc(a.applicantName)+'</div><div>Father/Guardian: '+esc(a.fatherName)+'</div><div>CNIC/B-Form: '+esc(a.cnic)+'</div><div>DOB: '+esc(a.dob)+'</div><div>Program: '+esc(a.program)+'</div><div>Category: '+esc(a.quota)+'</div><div>Qualification: '+esc(a.qualification)+'</div><div>Marks: '+(a.percentage==null?'N/A':a.percentage+'%')+'</div><div>Phone: '+esc(a.phone)+'</div><div>Email: '+esc(a.email)+'</div></div><div class="box"><strong>Documents</strong><ul>'+docList+'</ul></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function renderSetupSummary(){
    const s=setup(),type=D.institutionTypes.find(x=>x.id===s.institutionType)?.name||s.institutionType;
    $('admissionSetupSummary').innerHTML='<article class="paper-card"><h3>'+esc(s.institutionName)+'</h3><div class="paper-meta"><span>'+esc(type)+'</span><span>Session '+esc(s.admissionSession)+'</span><span>Fee PKR '+Number(s.applicationFee||0).toLocaleString()+'</span></div><p class="coverage-note">Test: '+(s.requireTest?'Required':'No')+' · Interview: '+(s.requireInterview?'Required':'No')+' · Prefix: '+esc(s.applicationPrefix)+' · Class/program-wise fees enabled</p></article>';
  }
  function updateStats(){
    const a=apps();$('admissionStatTotal').textContent=a.length;$('admissionStatSubmitted').textContent=a.filter(x=>x.status==='Submitted'||x.status==='Under Review').length;$('admissionStatSelected').textContent=a.filter(x=>x.status==='Selected'||x.status==='Admitted').length;$('admissionStatPending').textContent=a.filter(x=>x.status==='Documents Pending').length;
  }

  document.querySelectorAll('[data-admission-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.admissionTab));
  $('admObtainedMarks').addEventListener('input',calcPct);$('admTotalMarks').addEventListener('input',calcPct);
  $('admProgram').addEventListener('change',renderProgramFeeSummary);
  $('saveAdmissionFeeStructureBtn')?.addEventListener('click',saveFeeStructure);
  $('submitAdmissionBtn').onclick=()=>saveApplication('Submitted');$('saveAdmissionDraftBtn').onclick=()=>saveApplication('Draft');$('clearAdmissionBtn').onclick=clearForm;
  $('trackAdmissionBtn').onclick=track;$('saveAdmissionSetupBtn').onclick=saveSetup;
  $('admissionInstitutionType').addEventListener('change',()=>{const s=setup();s.institutionType=$('admissionInstitutionType').value;write(KEY.setup,s);refreshPrograms()});
  ['admissionAdminSearch'].forEach(id=>$(id).addEventListener('input',renderAdmin));
  ['admissionStatusFilter','admissionProgramFilter','admissionQuotaFilter'].forEach(id=>$(id).addEventListener('change',renderAdmin));

  // Advanced admissions storage and review
  const FILE_DB='edunizam_admission_files_v1', FILE_STORE='files';
  let reviewApplicationId=null;

  function openFileDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(FILE_DB,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(FILE_STORE))db.createObjectStore(FILE_STORE,{keyPath:'key'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  async function saveFile(key,file){
    if(!file)return null;
    const db=await openFileDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(FILE_STORE,'readwrite');
      tx.objectStore(FILE_STORE).put({key,name:file.name,type:file.type,size:file.size,blob:file,updatedAt:new Date().toISOString()});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    return {key,name:file.name,type:file.type,size:file.size};
  }
  async function getFile(key){
    const db=await openFileDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(FILE_STORE,'readonly'),req=tx.objectStore(FILE_STORE).get(key);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
  }
  async function collectUploads(appId){
    const fields=[['photo','admPhotoFile'],['identity','admIdentityFile'],['result','admResultFile'],['support','admSupportFile']];
    const refs=[];
    for(const [kind,id] of fields){
      const file=$(id)?.files?.[0];
      if(file){const ref=await saveFile(appId+'|'+kind,file);refs.push({kind,...ref})}
    }
    return refs;
  }
  function fileSize(n){if(!n)return'';if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB'}

  const originalGetForm=getForm;
  getForm=function(status){
    const a=originalGetForm(status);
    // Admission payment is intentionally locked until School Admin approval.
    // Never trust hidden/client-edited payment controls on a new application.
    a.paymentMethod='';
    a.feeStatus='Unpaid';
    a.feeReference='';
    a.feeDate='';
    a.attachments=[];
    return a;
  };

  const originalSaveApplication=saveApplication;
  let applicationSaveInFlight=false;
  saveApplication=async function(status){
    if(applicationSaveInFlight)return;
    applicationSaveInFlight=true;
    const submitButtons=[$('submitAdmissionBtn'),$('saveAdmissionDraftBtn')].filter(Boolean);
    submitButtons.forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-busy','true')});
    try{
      const a=getForm(status);
      if(!valid(a,status==='Draft')){
        alert(status==='Draft'?'Enter at least applicant name, CNIC or program.':'Please complete applicant name, guardian name, CNIC/B-Form, program and previous qualification.');
        return;
      }
      try{a.attachments=await collectUploads(a.applicationId)}
      catch(e){console.error(e);alert('Could not save one or more uploaded files on this device.');return}
      const uploadFields=[['photo','admPhotoFile'],['identity','admIdentityFile'],['result','admResultFile'],['support','admSupportFile']];
      const arr=apps();arr.push(a);write(KEY.apps,arr);
      let cloudNote='';
      const cloud=window.EDUNIZAM_CLOUD;
      if(cloud?.ready?.()&&cloud.state?.user&&status!=='Draft'){
        try{
          const remote=await cloud.syncLocalApplication(a);
          a.cloudId=remote?.id||null;a.applicantUserId=remote?.applicant_user_id||cloud.state?.user?.id||null;a.cloudSyncedAt=new Date().toISOString();
          const idx=arr.findIndex(x=>x.applicationId===a.applicationId);if(idx>=0)arr[idx]=a;write(KEY.apps,arr);
          for(const [kind,id] of uploadFields){
            const file=$(id)?.files?.[0];
            if(file&&remote?.id)await cloud.uploadDocument(remote.id,kind,file);
          }
          cloudNote=' · Cloud synced';
        }catch(e){console.warn('Cloud sync failed:',e);cloudNote=' · Saved locally; cloud sync pending';}
      }
      clearForm();renderAdmin();updateStats();
      $('admissionSubmitResult').innerHTML='<div class="admission-success"><strong>'+esc(a.applicationId)+'</strong><span>'+esc(status==='Draft'?'Draft saved':'Application submitted successfully')+esc(cloudNote)+'</span><button data-print-admission="'+a.applicationId+'" class="secondary">Print Application</button></div>';
      document.querySelector('[data-print-admission]')?.addEventListener('click',()=>printApplication(a.applicationId));
    }finally{
      applicationSaveInFlight=false;
      submitButtons.forEach(btn=>{btn.disabled=false;btn.removeAttribute('aria-busy')});
    }
  };

  const originalClearForm=clearForm;
  clearForm=function(){
    originalClearForm();
    ['admPhotoFile','admIdentityFile','admResultFile','admSupportFile','admPaymentProofFile'].forEach(id=>{if($(id))$(id).value=''});
    if($('admPaymentMethod'))$('admPaymentMethod').value='';
    if($('admFeeStatus'))$('admFeeStatus').value='Unpaid';
    if($('admFeeReference'))$('admFeeReference').value='';
    if($('admFeeDate'))$('admFeeDate').value='';
    if($('admUploadPreview'))$('admUploadPreview').innerHTML='';
  };

  function printChallan(){
    alert('Fee challan is available only after School Admin approval. Open the application review workflow and issue the challan after approval.');
  }

  function exportFile(name,mime,text){
    const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function exportCsv(){
    const rows=apps(),cols=['applicationId','applicantName','fatherName','cnic','phone','email','program','quota','qualification','percentage','feeStatus','status','session','createdAt'];
    const csv=[cols.join(',')].concat(rows.map(r=>cols.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))).join('\n');
    exportFile('edunizam-admissions.csv','text/csv;charset=utf-8',csv);
  }
  function exportJson(){exportFile('edunizam-admissions-backup.json','application/json',JSON.stringify({setup:setup(),applications:apps(),exportedAt:new Date().toISOString()},null,2))}

  function calculateMerit(){
    const aw=Number($('admReviewAcademicWeight').value||0),tw=Number($('admReviewTestWeight').value||0),iw=Number($('admReviewInterviewWeight').value||0);
    const totalW=aw+tw+iw;if(totalW!==100){$('admReviewMerit').value='Weights must total 100';return null}
    const a=apps().find(x=>x.applicationId===reviewApplicationId);if(!a)return null;
    const academic=Number(a.percentage||0),test=Number($('admReviewTestMarks').value||0),interview=Number($('admReviewInterviewMarks').value||0);
    const merit=(academic*aw+test*tw+interview*iw)/100;$('admReviewMerit').value=merit.toFixed(2)+'%';return Number(merit.toFixed(2));
  }
  async function openReview(id){
    reviewApplicationId=id;const a=apps().find(x=>x.applicationId===id);if(!a)return;
    $('admissionReviewPanel').classList.remove('hidden');
    $('admissionReviewTitle').textContent=a.applicantName+' — '+a.applicationId;
    $('admissionReviewMeta').textContent=a.program+' · '+a.status+' · '+a.session;
    $('admissionReviewProfile').innerHTML='<div class="paper-card"><div class="paper-meta"><span>CNIC/B-Form: '+esc(a.cnic)+'</span><span>Academic: '+(a.percentage==null?'N/A':a.percentage+'%')+'</span><span>Fee: '+esc(a.feeStatus||'Unpaid')+'</span><span>Method: '+esc(a.paymentMethod||'Not selected')+'</span></div><p>'+esc(a.phone||'')+' · '+esc(a.email||'')+'</p><p class="coverage-note">Payment Ref: '+esc(a.feeReference||'N/A')+' · Date: '+esc(a.feeDate||'N/A')+'</p></div>';
    $('admReviewAcademicWeight').value=a.academicWeight??70;$('admReviewTestWeight').value=a.testWeight??20;$('admReviewInterviewWeight').value=a.interviewWeight??10;
    $('admReviewTestMarks').value=a.testMarks??'';$('admReviewInterviewMarks').value=a.interviewMarks??'';$('admReviewNote').value=a.adminNote||'';calculateMerit();
    const refs=a.attachments||[];const cards=[];
    for(const ref of refs){
      const stored=await getFile(ref.key).catch(()=>null);
      if(stored){
        const url=URL.createObjectURL(stored.blob);
        cards.push('<div class="attachment-card"><strong>'+esc(ref.kind)+'</strong><span>'+esc(stored.name)+' · '+fileSize(stored.size)+'</span><a target="_blank" rel="noopener" href="'+url+'">Open</a></div>');
      }
    }
    $('admissionReviewAttachments').innerHTML=cards.length?'<h3>Uploaded Files</h3><div class="attachment-grid">'+cards.join('')+'</div>':'<p class="muted">No uploaded files saved on this device.</p>';
  }
  function closeReview(){$('admissionReviewPanel').classList.add('hidden');reviewApplicationId=null}
  function saveReview(){
    const merit=calculateMerit();if(merit==null)return;
    const arr=apps(),a=arr.find(x=>x.applicationId===reviewApplicationId);if(!a)return;
    a.academicWeight=Number($('admReviewAcademicWeight').value||0);a.testWeight=Number($('admReviewTestWeight').value||0);a.interviewWeight=Number($('admReviewInterviewWeight').value||0);
    a.testMarks=Number($('admReviewTestMarks').value||0);a.interviewMarks=Number($('admReviewInterviewMarks').value||0);a.meritScore=merit;a.adminNote=$('admReviewNote').value.trim();a.updatedAt=new Date().toISOString();
    write(KEY.apps,arr);renderAdmin();updateStats();alert('Application review saved.');
  }

  function nextRollNumber(className){
    const students=JSON.parse(localStorage.getItem('edunizam_students')||'[]');
    const nums=students.filter(s=>s.className===className).map(s=>{
      const m=String(s.rollNo||'').match(/(\d+)$/);return m?Number(m[1]):0;
    });
    return Math.max(0,...nums)+1;
  }
  function makeStudentId(applicationId){
    const year=new Date().getFullYear();
    const tail=String(applicationId||'').split('-').pop()||String(Date.now()).slice(-4);
    return 'STU-'+year+'-'+tail;
  }
  function finalizeAdmission(){
    const a=apps().find(x=>x.applicationId===reviewApplicationId);if(!a)return alert('Open an application first.');
    if(!['Selected','Admitted'].includes(a.status))return alert('Only a Selected application can be finalized for admission.');
    if(a.enrollment?.studentId){
      printEnrollmentSlip();
      return alert('This applicant is already enrolled as '+a.enrollment.studentId+'.');
    }
    const roll=nextRollNumber(a.program);
    const enrollment={
      studentId:makeStudentId(a.applicationId),
      rollNo:String(roll).padStart(3,'0'),
      admissionDate:new Date().toISOString().slice(0,10),
      className:a.program,
      feeSnapshot:a.feeSnapshot||null
    };
    a.status='Admitted';a.enrollment=enrollment;a.updatedAt=new Date().toISOString();
    const arr=apps(),i=arr.findIndex(x=>x.applicationId===a.applicationId);if(i>=0)arr[i]=a;write(KEY.apps,arr);
    window.addStudentFromAdmission?.({
      name:a.applicantName,father:a.fatherName,className:a.program,phone:a.phone,
      rollNo:enrollment.rollNo,studentId:enrollment.studentId,
      admissionApplicationId:a.applicationId,admissionDate:enrollment.admissionDate,feeSnapshot:a.feeSnapshot||null,authUserId:a.applicantUserId||null
    });
    renderAdmin();updateStats();openReview(a.applicationId);
    alert('Admission finalized. Student ID: '+enrollment.studentId+' · Roll No: '+enrollment.rollNo);
  }
  function printEnrollmentSlip(){
    const a=apps().find(x=>x.applicationId===reviewApplicationId);if(!a?.enrollment)return alert('Finalize admission first.');
    const e=a.enrollment,s=setup(),f=a.feeSnapshot||{};
    const w=window.open('','_blank');if(!w)return;
    w.document.write('<html><head><title>Enrollment Slip</title><style>body{font-family:Arial;padding:40px;line-height:1.6;color:#17324a}.print-brand{display:flex;align-items:center;gap:16px}.print-school-logo{width:76px;height:76px;object-fit:contain;border:1px solid #d8e2e7;border-radius:14px;padding:5px}.print-brand h1{margin:0}.print-brand p{margin:4px 0;color:#667}.box{border:1px solid #aaa;padding:16px;margin:16px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}</style></head><body>'+printBrand(s.institutionName,s.admissionSession)+'<h2>Admission Confirmation / Enrollment Slip</h2><div class="box"><strong>Student ID: '+esc(e.studentId)+'</strong><br>Roll No: '+esc(e.rollNo)+'</div><div class="grid box"><div>Student: '+esc(a.applicantName)+'</div><div>Father/Guardian: '+esc(a.fatherName)+'</div><div>Class/Program: '+esc(a.program)+'</div><div>Admission Date: '+esc(e.admissionDate)+'</div><div>Application ID: '+esc(a.applicationId)+'</div><div>Status: Admitted</div></div><div class="box"><strong>Fee Snapshot</strong><br>Admission Fee: PKR '+Number(f.admissionFee||0).toLocaleString()+'<br>Monthly Fee: PKR '+Number(f.monthlyFee||0).toLocaleString()+'<br>Annual Charges: PKR '+Number(f.annualCharges||0).toLocaleString()+'<br>Other Charges: PKR '+Number(f.otherCharges||0).toLocaleString()+'</div><p>Authorized Signature: ____________________</p></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  function printDecision(kind){
    const a=apps().find(x=>x.applicationId===reviewApplicationId);if(!a)return;const s=setup();
    const accepted=kind==='admission';
    const title=accepted?'Admission / Selection Letter':'Admission Decision Letter';
    const body=accepted
      ?'We are pleased to inform you that you have been selected for admission to '+esc(a.program)+' for session '+esc(a.session)+'. Please complete the remaining admission formalities and fee requirements within the notified schedule.'
      :'This letter records the current admission decision for your application. Current status: '+esc(a.status)+'. Please contact the institution for any required next step or clarification.';
    const w=window.open('','_blank');if(!w)return;w.document.write('<html><head><title>'+title+'</title><style>body{font-family:Arial;padding:48px;line-height:1.7;color:#17324a}.print-brand{display:flex;align-items:center;gap:16px}.print-school-logo{width:76px;height:76px;object-fit:contain;border:1px solid #d8e2e7;border-radius:14px;padding:5px}.print-brand h1{margin:0}.print-brand p{margin:4px 0;color:#667}.meta{margin:24px 0;padding:14px;border:1px solid #bbb}</style></head><body>'+printBrand(s.institutionName,s.admissionSession)+'<p>'+title+'</p><div class="meta">Application ID: '+esc(a.applicationId)+'<br>Applicant: '+esc(a.applicantName)+'<br>Program: '+esc(a.program)+'<br>Merit Score: '+(a.meritScore==null?'N/A':a.meritScore+'%')+'</div><p>Dear '+esc(a.applicantName)+',</p><p>'+body+'</p><p>Regards,<br>Admissions Office</p></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),250)
  }

  const originalCard=card;
  card=function(a){
    const html=originalCard(a);
    return html.replace('</div></article>','<button class="secondary-action" data-adm-review="'+esc(a.applicationId)+'">Review</button></div></article>');
  };
  const originalRenderAdmin=renderAdmin;
  async function renderCloudAdminApplications(){
    const cloud=window.EDUNIZAM_CLOUD,el=$('admissionAdminList');
    if(!el||!cloud?.ready?.()||!cloud.state?.user)return false;
    let role;try{role=await cloud.getMyRole()}catch(_){return false}
    if(role!=='head_of_institute')return false;
    try{
      const [rows,sections]=await Promise.all([
        cloud.listInstitutionApplications(),
        cloud.listAdmissionSections?.()||Promise.resolve([])
      ]);
      const q=$('admissionAdminSearch')?.value?.trim().toLowerCase()||'',st=$('admissionStatusFilter')?.value||'',p=$('admissionProgramFilter')?.value||'';
      const list=(rows||[]).filter(a=>(!q||[a.application_no,a.applicant_name,a.cnic,a.program,a.phone,a.admission_no,a.metadata?.roll_no,a.metadata?.section_name].join(' ').toLowerCase().includes(q))&&(!st||a.status===st)&&(!p||a.program===p));
      const statusOptions=['Submitted','Under Review','Needs Correction','Approved for Fee','Rejected'];
      el.innerHTML=list.length?list.map(a=>{
        const snap=a.metadata?.fee_snapshot||feeForProgram(a.program),defaultAmount=(Number(snap?.admissionFee||snap?.admission_fee||0)+Number(snap?.monthlyFee||snap?.monthly_fee||0)+Number(snap?.annualCharges||snap?.annual_charges||0)+Number(snap?.otherCharges||snap?.other_charges||0))||Number(snap?.applicationFee||snap?.application_fee||0);
        const canChallan=['Approved for Fee','Selected'].includes(a.status)&&!a.challan_no;
        const canConfirm=a.status==='Payment Verification'&&['Paid','Exempted'].includes(a.fee_status);
        const opts=[...new Set([a.status,...statusOptions])].map(s=>'<option '+(s===a.status?'selected':'')+'>'+esc(s)+'</option>').join('');
        const appSections=(sections||[]).filter(s=>String(s.class_name||'').trim().toLowerCase()===String(a.program||'').trim().toLowerCase());
        let enrollmentControls='';
        if(canConfirm){
          let sectionInput='';
          if(appSections.length){
            const options=appSections.map(s=>{
              const full=Number(s.capacity||0)>0&&Number(s.enrolled||0)>=Number(s.capacity||0);
              const cap=s.capacity?(' · '+Number(s.enrolled||0)+'/'+Number(s.capacity)):' · '+Number(s.enrolled||0)+' enrolled';
              const teacher=s.class_teacher_name?(' · '+s.class_teacher_name):'';
              return '<option value="'+esc(s.section_name)+'" '+(full?'disabled':'')+'>'+esc(s.section_name)+esc(cap)+esc(teacher)+(full?' · FULL':'')+'</option>';
            }).join('');
            sectionInput='<label>Section<select data-cloud-section="'+esc(a.id)+'">'+(appSections.length>1?'<option value="">Select section</option>':'')+options+'</select></label>';
          }else{
            sectionInput='<label>Section<input data-cloud-section="'+esc(a.id)+'" placeholder="Optional — no section configured"></label>';
          }
          enrollmentControls='<div class="card" style="margin-top:12px"><div class="section-head"><div><strong>Enrollment Setup</strong><p class="muted">Section capacity is checked again in the database. Leave roll blank for automatic next roll number.</p></div></div><div class="form-grid">'+sectionInput+'<label>Roll No<input data-cloud-roll="'+esc(a.id)+'" placeholder="Auto"></label></div></div>';
        }
        const enrolledInfo=a.status==='Admission Confirmed'
          ?'<div class="coverage-note"><strong>Enrolled:</strong> '+esc(a.admission_no||'Admission confirmed')+(a.metadata?.section_name?' · Section '+esc(a.metadata.section_name):'')+(a.metadata?.roll_no?' · Roll '+esc(a.metadata.roll_no):'')+'</div>'
          :'';
        return '<article class="paper-card" data-cloud-app-card="'+esc(a.id)+'"><div class="paper-card-top"><div><span class="mini-badge">'+esc(a.application_no)+'</span><span class="trust-badge trust-official">'+esc(a.status)+'</span></div></div><h3>'+esc(a.applicant_name)+'</h3><p class="muted">'+esc(a.program||'')+' · '+esc(a.metadata?.school_name||'Cloud application')+'</p><div class="paper-meta"><span>'+esc(a.cnic||'No B-Form')+'</span><span>'+esc(a.phone||'No phone')+'</span><span>Fee: '+esc(a.fee_status||'Unpaid')+'</span>'+(a.challan_no?'<span>Challan: '+esc(a.challan_no)+'</span>':'')+'</div><div class="form-grid"><select data-cloud-status="'+esc(a.id)+'">'+opts+'</select></div><div class="paper-actions"><button class="secondary-action" data-cloud-docs="'+esc(a.id)+'">Documents</button>'+(canChallan?'<button data-cloud-challan="'+esc(a.id)+'" data-default-amount="'+defaultAmount+'">Issue Fee Challan</button>':'')+(a.challan_no?'<span class="mini-badge">PKR '+Number(a.challan_amount||0).toLocaleString()+'</span>':'')+(canConfirm?'<button data-cloud-confirm="'+esc(a.id)+'">Confirm & Enroll</button>':'')+'</div>'+enrollmentControls+enrolledInfo+(a.admin_note?'<p class="coverage-note">'+esc(a.admin_note)+'</p>':'')+'<div data-cloud-doc-list="'+esc(a.id)+'"></div></article>';
      }).join(''):'<div class="empty-state">No matching cloud applications.</div>';

      document.querySelectorAll('[data-cloud-status]').forEach(s=>s.onchange=async()=>{
        const note=['Needs Correction','Rejected'].includes(s.value)?prompt('Reason / note for applicant:','')||'':'';
        try{await cloud.updateCloudApplicationStatus(s.dataset.cloudStatus,s.value,note);await cloud.logAudit('application_status_'+s.value.toLowerCase().replace(/[^a-z0-9]+/g,'_'),'application',s.dataset.cloudStatus,{status:s.value,note});renderCloudAdminApplications()}catch(e){alert(e.message||'Status update failed.')}
      });

      document.querySelectorAll('[data-cloud-challan]').forEach(b=>b.onclick=async()=>{
        const amount=Number(prompt('Fee challan amount (PKR):',b.dataset.defaultAmount||'0'));if(!Number.isFinite(amount)||amount<0)return;
        try{await cloud.issueAdmissionChallan(b.dataset.cloudChallan,amount);await cloud.logAudit('admission_challan_issued','application',b.dataset.cloudChallan,{amount});renderCloudAdminApplications()}catch(e){alert(e.message||'Could not issue challan.')}
      });

      document.querySelectorAll('[data-cloud-confirm]').forEach(b=>b.onclick=async()=>{
        const id=b.dataset.cloudConfirm;
        const sectionName=document.querySelector('[data-cloud-section="'+id+'"]')?.value?.trim()||'';
        const rollNo=document.querySelector('[data-cloud-roll="'+id+'"]')?.value?.trim()||'';
        const app=rows.find(x=>String(x.id)===String(id));
        const matching=(sections||[]).filter(s=>String(s.class_name||'').trim().toLowerCase()===String(app?.program||'').trim().toLowerCase());
        if(matching.length>1&&!sectionName)return alert('Multiple sections available hain. Confirm karne se pehle section select karein.');
        if(!confirm('Confirm admission and create the complete school student record?'))return;
        b.disabled=true;
        try{
          const enrolled=await cloud.confirmAdmission(id,{sectionName,rollNo});
          await cloud.logAudit('admission_confirmed','application',id,{
            admission_no:enrolled?.admission_no||'',
            student_code:enrolled?.student_code||'',
            class_name:enrolled?.class_name||app?.program||'',
            section_name:enrolled?.section_name||sectionName||'',
            roll_no:enrolled?.roll_no||rollNo||'',
            class_teacher_linked:!!enrolled?.class_teacher_user_id,
            monthly_fee:Number(enrolled?.monthly_fee||0)
          });
          const bits=[
            enrolled?.admission_no&&('Admission '+enrolled.admission_no),
            enrolled?.student_code&&('Student '+enrolled.student_code),
            enrolled?.section_name&&('Section '+enrolled.section_name),
            enrolled?.roll_no&&('Roll '+enrolled.roll_no),
            enrolled?.class_teacher_user_id&&'Class teacher linked'
          ].filter(Boolean);
          try{
            await window.EDUNIZAM_CORE_CLOUD?.pullAllCloudToLocal?.(true);
            window.renderAll?.();
            window.EDUNIZAM_FEE_CENTER?.render?.();
          }catch(syncError){console.warn('Post-admission local sync:',syncError?.message||syncError)}
          window.EDUNIZAM_PREMIUM?.toast?.('Admission confirmed · '+bits.join(' · '),'success');
          alert('Admission confirmed. '+bits.join(' · '));
          renderCloudAdminApplications();
        }catch(e){
          alert(e.message||'Admission confirmation failed.');
          b.disabled=false;
        }
      });

      document.querySelectorAll('[data-cloud-docs]').forEach(b=>b.onclick=async()=>{
        const box=document.querySelector('[data-cloud-doc-list="'+b.dataset.cloudDocs+'"]');if(!box)return;
        box.innerHTML='<p class="muted">Loading documents…</p>';
        try{
          const docs=await cloud.listApplicationDocuments(b.dataset.cloudDocs);
          if(!docs.length){box.innerHTML='<p class="muted">No uploaded documents.</p>';return}
          const links=[];
          for(const d of docs){
            let url='';try{url=await cloud.createSignedDocumentUrl(d.storage_path,300)}catch(_){}
            links.push('<a class="secondary-action" target="_blank" rel="noopener" href="'+esc(url||'#')+'">'+esc(d.kind)+' · '+esc(d.original_name||'Open')+'</a>');
          }
          box.innerHTML='<div class="paper-actions" style="margin-top:10px">'+links.join('')+'</div>';
        }catch(e){box.innerHTML='<p class="coverage-note">'+esc(e.message||'Could not load documents.')+'</p>'}
      });
      return true;
    }catch(e){
      el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load cloud applications.')+'</div>';
      return true;
    }
  }
  renderAdmin=function(){
    originalRenderAdmin();
    document.querySelectorAll('[data-adm-review]').forEach(b=>b.onclick=()=>openReview(b.dataset.admReview));
    renderCloudAdminApplications();
  };

  ['admReviewAcademicWeight','admReviewTestWeight','admReviewInterviewWeight','admReviewTestMarks','admReviewInterviewMarks'].forEach(id=>$(id)?.addEventListener('input',calculateMerit));
  $('printAdmissionChallanBtn').onclick=printChallan;
  $('admPaymentMethod')?.addEventListener('change',renderPaymentInstructions);
  $('exportAdmissionsCsvBtn').onclick=exportCsv;
  $('exportAdmissionsJsonBtn').onclick=exportJson;
  $('closeAdmissionReviewBtn').onclick=closeReview;
  $('saveAdmissionReviewBtn').onclick=saveReview;
  $('printAdmissionLetterBtn').onclick=()=>printDecision('admission');
  $('printAdmissionRejectionBtn').onclick=()=>printDecision('decision');
  $('finalizeAdmissionBtn')?.addEventListener('click',finalizeAdmission);
  $('printEnrollmentSlipBtn')?.addEventListener('click',printEnrollmentSlip);

  ['admPhotoFile','admIdentityFile','admResultFile','admSupportFile','admPaymentProofFile'].forEach(id=>$(id)?.addEventListener('change',()=>{
    const items=['admPhotoFile','admIdentityFile','admResultFile','admSupportFile','admPaymentProofFile'].map(x=>$(x)?.files?.[0]).filter(Boolean);
    $('admUploadPreview').innerHTML=items.map(f=>'<span class="mini-badge">'+esc(f.name)+' · '+fileSize(f.size)+'</span>').join(' ');
  }));


  async function renderCloudPayments(){
    const el=$('admissionPaymentsList');if(!el)return;
    const cloud=window.EDUNIZAM_CLOUD;
    if(!cloud?.ready?.()){el.innerHTML='<div class="empty-state">Cloud Mode is not configured. Local fee records remain visible inside applications.</div>';return;}
    try{
      const role=await cloud.getMyRole();if(role!=='head_of_institute'){el.innerHTML='<div class="empty-state">Payment verification is available to School Admin only.</div>';return;}
      const rows=await cloud.listPayments();
      el.innerHTML=rows.length?rows.map(p=>{
        const a=p.applications||{};
        return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(p.method||'Payment')+'</span><span class="trust-badge trust-official">'+esc(p.status||'Pending')+'</span></div></div><h3>'+esc(a.applicant_name||'Applicant')+'</h3><p class="muted">'+esc(a.application_no||'')+' · PKR '+Number(p.amount||0).toLocaleString()+'</p><div class="paper-meta"><span>Ref: '+esc(p.reference||'N/A')+'</span><span>'+esc(p.gateway_provider||'Manual')+'</span></div><div class="paper-actions"><button data-pay-verify="'+esc(p.id)+'">Mark Paid</button><button class="secondary-action" data-pay-reject="'+esc(p.id)+'">Reject Payment</button></div></article>';
      }).join(''):'<div class="empty-state">No cloud payment records yet.</div>';
      document.querySelectorAll('[data-pay-verify]').forEach(b=>b.onclick=()=>setCloudPaymentStatus(b.dataset.payVerify,'Paid'));
      document.querySelectorAll('[data-pay-reject]').forEach(b=>b.onclick=()=>setCloudPaymentStatus(b.dataset.payReject,'Rejected'));
    }catch(e){el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load payments.')+'</div>'}
  }
  async function setCloudPaymentStatus(id,status){
    const cloud=window.EDUNIZAM_CLOUD;
    const note=status==='Rejected'?(prompt('Why is this payment being rejected?','Invalid / unverified payment proof')||'Payment rejected'):'';
    try{
      await cloud.verifyAdmissionPayment(id,status,note);
      await cloud.logAudit('payment_status_'+status.toLowerCase(),'payment',id,{status,note});
      renderCloudPayments();renderAuditLog();renderCloudAdminApplications();
    }catch(e){alert(e.message||'Payment update failed.')}
  }
  async function renderAuditLog(){
    const el=$('admissionAuditList');if(!el)return;
    const cloud=window.EDUNIZAM_CLOUD;
    if(!cloud?.ready?.()){el.innerHTML='<div class="empty-state">Cloud Mode is not configured.</div>';return;}
    try{
      const role=await cloud.getMyRole();if(!['teacher','head_of_institute'].includes(role)){el.innerHTML='<div class="empty-state">Audit Log is available to authorized institution staff.</div>';return;}
      const rows=await cloud.listAuditLogs(75);
      el.innerHTML=rows.length?rows.map(x=>'<div class="practice-review"><div class="paper-card-top"><div><span class="mini-badge">'+esc(x.entity_type)+'</span><span class="trust-badge trust-verified">'+esc(x.action)+'</span></div><small>'+new Date(x.created_at).toLocaleString()+'</small></div><strong>'+esc(x.entity_id||'')+'</strong><div class="muted">'+esc(JSON.stringify(x.details||{}))+'</div></div>').join(''):'<div class="empty-state">No audit events yet.</div>';
    }catch(e){el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load audit log.')+'</div>'}
  }

  const ROLE_LABELS={student:'Student',parent:'Parent',teacher:'Teacher',head_of_institute:'Head of Institute'};
  function applyRoleVisibility(role){
    document.querySelectorAll('[data-admission-roles]').forEach(el=>{
      const allowed=(el.dataset.admissionRoles||'').split(',').map(x=>x.trim());
      el.classList.toggle('hidden',!allowed.includes(role));
    });
    document.body.dataset.admissionRole=role||'student';
    document.querySelectorAll('[data-parent-tools]').forEach(el=>el.classList.toggle('hidden',role!=='parent'));
    const active=document.querySelector('[data-admission-tab].active');
    if(active?.classList.contains('hidden')){
      const first=[...document.querySelectorAll('[data-admission-tab]:not(.hidden)')][0];
      if(first)showTab(first.dataset.admissionTab);
    }
  }

  async function renderRoleHome(){
    const title=$('admissionRoleHomeTitle'),sub=$('admissionRoleHomeSubtitle'),badge=$('admissionRoleHomeBadge'),stats=$('admissionRoleHomeStats'),actions=$('admissionRoleHomeActions'),content=$('admissionRoleHomeContent');
    if(!title||!stats||!actions||!content)return;
    let role=document.body.dataset.admissionRole||'student';
    const cloud=window.EDUNIZAM_CLOUD;
    if(cloud?.ready?.()&&cloud.state?.user){
      try{role=await cloud.getMyRole()||role}catch(e){}
    }
    const label=ROLE_LABELS[role]||role;
    badge.textContent=label;
    title.textContent=label+' Dashboard';
    const localApps=apps();

    const action=(tab,name,desc)=>'<button class="role-action-card" data-role-open="'+tab+'"><strong>'+esc(name)+'</strong><span>'+esc(desc)+'</span></button>';
    if(role==='student'){
      sub.textContent='Apply, track your application, fees and notifications.';
      let mine=localApps;
      if(cloud?.ready?.()&&cloud.state?.user){
        try{mine=await cloud.listMyApplications()}catch(e){}
      }
      const submitted=mine.length,selected=mine.filter(a=>['Selected','Admitted'].includes(a.status)).length,pending=mine.filter(a=>['Submitted','Under Review','Documents Pending','Test / Interview','Waitlisted'].includes(a.status)).length;
      stats.innerHTML='<article><span>Applications</span><strong>'+submitted+'</strong></article><article><span>In Process</span><strong>'+pending+'</strong></article><article><span>Selected</span><strong>'+selected+'</strong></article><article><span>Role</span><strong>Student</strong></article>';
      actions.innerHTML=action('apply','Apply Online','Submit a new admission application')+action('track','Track Status','Check application progress')+action('notifications','Notifications','See admission updates');
      content.innerHTML=mine.length?'<div class="paper-grid">'+mine.slice(0,4).map(a=>{
        const cloudId=a.id||a.cloudId||'',challan=a.challan_no||'',amount=Number(a.challan_amount||0),fee=a.fee_status||a.feeStatus||'Unpaid';
        const canPay=cloudId&&challan&&['Challan Issued','Payment Verification'].includes(a.status)&&!['Paid','Exempted','Pending Verification'].includes(fee);
        return '<article class="paper-card"><h3>'+esc(a.applicantName||a.applicant_name||'Application')+'</h3><p class="muted">'+esc(a.applicationId||a.application_no||'')+' · '+esc(a.program||'')+'</p><div class="paper-meta"><span>'+esc(a.status||'Submitted')+'</span><span>Fee: '+esc(fee)+'</span>'+(challan?'<span>Challan: '+esc(challan)+' · PKR '+amount.toLocaleString()+'</span>':'')+'</div>'+(canPay?'<div class="form-grid" style="margin-top:10px"><select data-app-pay-method="'+esc(cloudId)+'"><option value="">Payment method</option><option value="bank">Bank transfer/deposit</option><option value="raast">Raast</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option><option value="cash">Cash receipt</option></select><input data-app-pay-ref="'+esc(cloudId)+'" placeholder="Transaction / receipt reference"><input data-app-pay-proof="'+esc(cloudId)+'" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><button data-app-pay-submit="'+esc(cloudId)+'" data-app-pay-amount="'+amount+'">Submit Payment for Verification</button></div>':'')+'</article>';
      }).join('')+'</div>':'<div class="empty-state">No application yet. Use Apply Online to start.</div>';
      document.querySelectorAll('[data-app-pay-submit]').forEach(b=>b.onclick=()=>submitApplicantPayment(b));
    }else if(role==='parent'){
      sub.textContent='Manage linked student admission access and updates.';
      let links=[];if(cloud?.ready?.()&&cloud.state?.user){try{links=await cloud.getLinkedStudents()}catch(e){}}
      stats.innerHTML='<article><span>Linked Students</span><strong>'+links.length+'</strong></article><article><span>Applications</span><strong>'+localApps.length+'</strong></article><article><span>Role</span><strong>Parent</strong></article><article><span>Access</span><strong>Approved Links</strong></article>';
      actions.innerHTML=action('track','Track Child','View linked student admission status')+action('notifications','Notifications','See admission updates');
      content.innerHTML=links.length?'<div class="paper-grid">'+links.map(x=>'<article class="paper-card"><h3>'+esc(x.user_profiles?.full_name||'Linked Student')+'</h3><p class="muted">'+esc(x.student_user_id)+'</p><div class="paper-meta"><span>'+esc(x.status)+'</span></div></article>').join('')+'</div>':'<div class="empty-state">No approved student link yet. Use Track Application tab to request a link.</div>';
    }else if(role==='teacher'){
      sub.textContent='Review applications, conduct tests/interviews and manage applicant progress.';
      const review=localApps.filter(a=>['Submitted','Under Review','Documents Pending','Test / Interview'].includes(a.status)).length;
      stats.innerHTML='<article><span>Applications</span><strong>'+localApps.length+'</strong></article><article><span>To Review</span><strong>'+review+'</strong></article><article><span>Selected</span><strong>'+localApps.filter(a=>a.status==='Selected').length+'</strong></article><article><span>Role</span><strong>Teacher</strong></article>';
      actions.innerHTML=action('admin','Review Applications','Open admission review queue')+action('schedules','Tests & Interviews','Manage assessment schedule')+action('merit','Merit Lists','Generate selection ranking');
      content.innerHTML='<div class="empty-state">Use the shortcuts above for admissions work.</div>';
    }else{
      sub.textContent='Full institute admissions overview and controls.';
      stats.innerHTML='<article><span>Applications</span><strong>'+localApps.length+'</strong></article><article><span>Selected</span><strong>'+localApps.filter(a=>['Selected','Admitted'].includes(a.status)).length+'</strong></article><article><span>Pending Fee</span><strong>'+localApps.filter(a=>!['Paid','Exempted'].includes(a.feeStatus)).length+'</strong></article><article><span>Waitlisted</span><strong>'+localApps.filter(a=>a.status==='Waitlisted').length+'</strong></article>';
      actions.innerHTML=action('admin','Applications','Review all applicants')+action('setup','Institute Setup','Fees, roles and admission settings')+action('payments','Payments','Verify admission fee payments')+action('merit','Merit Lists','Generate selection lists')+action('audit','Audit Log','Review system actions');
      content.innerHTML='<div class="empty-state">Head of Institute has full admissions control.</div>';
    }
    document.querySelectorAll('[data-role-open]').forEach(b=>b.onclick=()=>showTab(b.dataset.roleOpen));
  }

  async function submitApplicantPayment(btn){
    const cloud=window.EDUNIZAM_CLOUD,id=btn?.dataset.appPaySubmit,amount=Number(btn?.dataset.appPayAmount||0);
    if(!cloud?.ready?.()||!cloud.state?.user)return alert('Sign in first.');
    const method=document.querySelector('[data-app-pay-method="'+id+'"]')?.value||'';
    const reference=document.querySelector('[data-app-pay-ref="'+id+'"]')?.value.trim()||'';
    const file=document.querySelector('[data-app-pay-proof="'+id+'"]')?.files?.[0]||null;
    if(!method)return alert('Select payment method.');
    if(!reference)return alert('Enter transaction / receipt reference.');
    if(!amount||amount<0)return alert('Invalid challan amount.');
    if(file&&(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>10*1024*1024))return alert('Payment proof must be JPG, PNG, WEBP or PDF and max 10 MB.');
    btn.disabled=true;
    let proofPath=null;
    try{
      if(file){
        const ext=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').slice(0,8)||'bin';
        const path=(window.EDUNIZAM_CLOUD_CONFIG?.institutionId||'institution')+'/'+id+'/'+Date.now()+'-payment-proof.'+ext;
        const {error}=await cloud.state.client.storage.from(window.EDUNIZAM_CLOUD_CONFIG?.admissionsStorageBucket||'admission-documents').upload(path,file,{upsert:false,contentType:file.type});
        if(error)throw error;proofPath=path;
      }
      await cloud.submitAdmissionPayment({applicationId:id,method,reference,amount,proofStoragePath:proofPath});
      window.EDUNIZAM_PREMIUM?.toast?.('Payment submitted for School Admin verification.','success');
      await renderRoleHome();
    }catch(e){
      if(proofPath)cloud.state.client.storage.from(window.EDUNIZAM_CLOUD_CONFIG?.admissionsStorageBucket||'admission-documents').remove([proofPath]).catch(()=>{});
      alert(e.message||'Payment submission failed.');
    }finally{btn.disabled=false}
  }

  async function refreshCloudAuth(){
    const cloud=window.EDUNIZAM_CLOUD;
    const badge=$('admissionCloudBadge'),status=$('admissionAuthStatus');
    if(!cloud?.ready?.()){
      if(badge)badge.textContent='Local Mode';
      if(status)status.textContent='Cloud backend not connected. Local admissions remain available on this device.';
      applyRoleVisibility('head_of_institute');
      renderRoleHome();
      return;
    }
    try{await cloud.init()}catch(e){}
    const user=cloud.state?.user;
    if(badge)badge.textContent=user?'Cloud Mode · Signed In':'Cloud Mode';
    if(status){
      if(user){
        let role='student';try{role=await cloud.getMyRole()||'student'}catch(e){}
        status.textContent='Signed in as '+user.email+' · Role: '+(ROLE_LABELS[role]||role);
        applyRoleVisibility(role);
        renderRoleHome();
      }else{
        status.textContent='Cloud backend connected. Sign in or create a Student/Parent account.';
        applyRoleVisibility('student');
        renderRoleHome();
      }
    }
  }
  async function authAction(type){
    const cloud=window.EDUNIZAM_CLOUD,email=$('admissionAuthEmail')?.value.trim(),password=$('admissionAuthPassword')?.value||'';
    if(!cloud?.ready?.())return alert('Cloud backend is not configured yet. Local Mode is still available.');
    const selectedRole=$('admissionAuthRole')?.value||'student';
    const fullName=$('admissionAuthName')?.value.trim()||'';
    if(type!=='out'&&(!email||password.length<6))return alert('Enter a valid email and password of at least 6 characters.');
    if(type==='signup'&&!['student','parent'].includes(selectedRole))return alert('Teacher and Head of Institute accounts are issued by the institute. Choose Student or Parent for self-registration.');
    try{
      if(type==='signup'){
        const {error}=await cloud.signUp(email,password,selectedRole,fullName);if(error)throw error;
        alert((ROLE_LABELS[selectedRole]||selectedRole)+' account created. If email confirmation is enabled, verify your email before signing in.');
      }else if(type==='signin'){
        const {error}=await cloud.signIn(email,password);if(error)throw error;
      }else await cloud.signOut();
      await refreshCloudAuth();
    }catch(e){alert(e.message||'Authentication failed.')}
  }

  async function requestParentLink(){
    const cloud=window.EDUNIZAM_CLOUD,studentCode=$('parentStudentCode')?.value.trim();
    if(!studentCode)return alert('Enter the Student Code.');
    if(!cloud?.ready?.())return alert('Cloud Mode is required for parent-student linking.');
    try{
      const role=await cloud.getMyRole();if(role!=='parent')return alert('Only Parent accounts can request a student link.');
      if(!cloud.config?.institutionId)return alert('Select your approved school workspace first.');
      await cloud.requestParentLinkByStudentCode(studentCode);
      $('parentStudentCode').value='';
      alert('Parent-student link request submitted. The School Admin has been notified for approval.');
    }catch(e){alert(e.message||'Could not request link.')}
  }
  async function renderParentLinks(){
    const el=$('admissionParentLinksList'),cloud=window.EDUNIZAM_CLOUD;if(!el)return;
    if(!cloud?.ready?.()){el.innerHTML='<div class="empty-state">Cloud Mode required for role/link management.</div>';return;}
    try{
      const role=await cloud.getMyRole();
      if(role!=='head_of_institute'){el.innerHTML='<div class="empty-state">Only Head of Institute can approve parent-child links.</div>';return;}
      const rows=(await cloud.listParentStudentLinks()).slice().sort((a,b)=>{
        const rank=x=>x.status==='pending'?0:x.status==='approved'?1:2;
        return rank(a)-rank(b)||new Date(b.created_at||0)-new Date(a.created_at||0);
      });
      el.innerHTML=rows.length?rows.map(x=>{
        const studentMeta=[x.student_class&&('Class '+x.student_class),x.student_code&&('Code '+x.student_code)].filter(Boolean).join(' · ');
        const actions=x.status==='pending'
          ?'<div class="paper-actions"><button data-link-approve="'+esc(x.parent_user_id)+'" data-student="'+esc(x.student_user_id)+'">Approve</button><button class="secondary-action" data-link-reject="'+esc(x.parent_user_id)+'" data-student="'+esc(x.student_user_id)+'">Reject</button></div>'
          :'<div class="coverage-note">Reviewed · '+esc(x.status)+'</div>';
        return '<div class="practice-review"><div><strong>Parent:</strong> '+esc(x.parent_name||'Parent / Guardian')+'</div><div><strong>Student:</strong> '+esc(x.student_name||'Student')+(studentMeta?' · '+esc(studentMeta):'')+'</div><div class="paper-meta"><span>'+esc(x.status)+'</span></div>'+actions+'</div>';
      }).join(''):'<div class="empty-state">No parent-child link requests.</div>';
      document.querySelectorAll('[data-link-approve]').forEach(b=>b.onclick=()=>setParentLinkStatus(b.dataset.linkApprove,b.dataset.student,'approved'));
      document.querySelectorAll('[data-link-reject]').forEach(b=>b.onclick=()=>setParentLinkStatus(b.dataset.linkReject,b.dataset.student,'rejected'));
    }catch(e){el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load links.')+'</div>'}
  }
  async function setParentLinkStatus(parentId,studentId,status){
    const cloud=window.EDUNIZAM_CLOUD;
    try{
      await cloud.updateParentStudentLink(parentId,studentId,status);
      await cloud.logAudit('parent_student_link_'+status,'parent_student_link',parentId+'|'+studentId,{status});
      renderParentLinks();
    }catch(e){alert(e.message||'Could not update link.')}
  }
  async function assignStaffRole(){
    const cloud=window.EDUNIZAM_CLOUD,userId=$('admissionStaffUserId')?.value.trim(),role=$('admissionStaffRole')?.value;
    if(!userId)return alert('Enter teacher/head user UUID.');
    if(!cloud?.ready?.())return alert('Cloud Mode is required for staff role assignment.');
    try{
      const myRole=await cloud.getMyRole();if(myRole!=='head_of_institute')return alert('Only Head of Institute can assign staff roles.');
      await cloud.assignInstitutionRole(userId,role);
      await cloud.logAudit('assign_'+role,'user',userId,{role});
      $('admissionStaffUserId').value='';
      alert((ROLE_LABELS[role]||role)+' role assigned.');
    }catch(e){alert(e.message||'Could not assign role.')}
  }


  async function sendEasyLogin(type){
    const cloud=window.EDUNIZAM_CLOUD,email=$('admissionAuthEmail')?.value.trim();
    if(!email)return alert('Enter your email address first.');
    if(!cloud?.ready?.())return alert('Cloud backend is not configured yet.');
    try{
      if(type==='magic'){
        const {error}=await cloud.sendMagicLink(email);if(error)throw error;
        alert('Email login link sent. Open the email and tap the link to sign in.');
      }else{
        const {error}=await cloud.sendPasswordReset(email);if(error)throw error;
        alert('Password reset email sent.');
      }
    }catch(e){alert(e.message||'Could not send email.')}
  }
  function togglePassword(){
    const input=$('admissionAuthPassword'),btn=$('toggleAdmissionPasswordBtn');if(!input||!btn)return;
    const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Hide':'Show';
  }

  $('admissionSignUpBtn')?.addEventListener('click',()=>authAction('signup'));
  $('admissionSignInBtn')?.addEventListener('click',()=>authAction('signin'));
  $('admissionSignOutBtn')?.addEventListener('click',()=>authAction('out'));
  $('admissionMagicLinkBtn')?.addEventListener('click',()=>sendEasyLogin('magic'));
  $('admissionForgotPasswordBtn')?.addEventListener('click',()=>sendEasyLogin('reset'));
  $('toggleAdmissionPasswordBtn')?.addEventListener('click',togglePassword);
  $('requestParentStudentLinkBtn')?.addEventListener('click',requestParentLink);
  $('assignAdmissionStaffBtn')?.addEventListener('click',assignStaffRole);
  $('refreshAdmissionPaymentsBtn')?.addEventListener('click',renderCloudPayments);
  $('refreshAdmissionAuditBtn')?.addEventListener('click',renderAuditLog);
  window.addEventListener('edunizam:auth',refreshCloudAuth);
  refreshCloudAuth();

  window.renderAdmissionsPortal=()=>{loadSetup();renderAdmin();updateStats();refreshCloudAuth();renderRoleHome()};
  fillStatic();
})();