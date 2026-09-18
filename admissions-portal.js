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
    $('admissionApplyPanel').classList.toggle('hidden',name!=='apply');
    $('admissionTrackPanel').classList.toggle('hidden',name!=='track');
    $('admissionAdminPanel').classList.toggle('hidden',name!=='admin');
    $('admissionPaymentsPanel')?.classList.toggle('hidden',name!=='payments');
    $('admissionAuditPanel')?.classList.toggle('hidden',name!=='audit');
    $('admissionSetupPanel').classList.toggle('hidden',name!=='setup');
    if(name==='admin')renderAdmin();
    if(name==='payments')renderCloudPayments();
    if(name==='audit')renderAuditLog();
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
    const fields=[['photo','admPhotoFile'],['identity','admIdentityFile'],['result','admResultFile'],['support','admSupportFile'],['payment-proof','admPaymentProofFile']];
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
    a.paymentMethod=$('admPaymentMethod')?.value||'';
    a.feeStatus=$('admFeeStatus')?.value||'Unpaid';
    a.feeReference=$('admFeeReference')?.value.trim()||'';
    a.feeDate=$('admFeeDate')?.value||'';
    a.attachments=[];
    return a;
  };

  const originalSaveApplication=saveApplication;
  saveApplication=async function(status){
    const a=getForm(status);
    if(!valid(a,status==='Draft'))return alert(status==='Draft'?'Enter at least applicant name, CNIC or program.':'Please complete applicant name, guardian name, CNIC/B-Form, program and previous qualification.');
    try{a.attachments=await collectUploads(a.applicationId)}catch(e){console.error(e);return alert('Could not save one or more uploaded files on this device.')}
    const uploadFields=[['photo','admPhotoFile'],['identity','admIdentityFile'],['result','admResultFile'],['support','admSupportFile'],['payment-proof','admPaymentProofFile']];
    const arr=apps();arr.push(a);write(KEY.apps,arr);
    let cloudNote='';
    const cloud=window.EDUNIZAM_CLOUD;
    if(cloud?.ready?.()&&cloud.state?.user&&status!=='Draft'){
      try{
        const remote=await cloud.syncLocalApplication(a);
        a.cloudId=remote?.id||null;a.cloudSyncedAt=new Date().toISOString();
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
    const s=setup(),id=nextId(),name=$('admApplicantName').value.trim()||'Applicant',program=$('admProgram').value||'',fee=feeForProgram(program);
    const w=window.open('','_blank');if(!w)return;
    w.document.write('<html><head><title>Admission Challan</title><style>body{font-family:Arial;padding:28px}.copy{border:1px solid #444;padding:18px;margin-bottom:22px}.row{display:flex;justify-content:space-between;gap:20px}</style></head><body>'+[1,2].map(i=>'<div class="copy"><h2>'+esc(s.institutionName)+'</h2><div class="row"><strong>Admission Fee Challan</strong><span>Copy '+i+'</span></div><p>Application Ref: '+esc(id)+'</p><p>Applicant: '+esc(name)+'</p><p>Session: '+esc(s.admissionSession)+'</p><p>Program: '+esc(program||'Not selected')+'</p><p>Application Fee: PKR '+Number(fee.applicationFee||0).toLocaleString()+'</p><p>Date: __________ &nbsp;&nbsp; Bank/Transaction Ref: __________________</p><p>Authorized Signature: __________________</p></div>').join('')+'</body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
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
  function printDecision(kind){
    const a=apps().find(x=>x.applicationId===reviewApplicationId);if(!a)return;const s=setup();
    const accepted=kind==='admission';
    const title=accepted?'Admission / Selection Letter':'Admission Decision Letter';
    const body=accepted
      ?'We are pleased to inform you that you have been selected for admission to '+esc(a.program)+' for session '+esc(a.session)+'. Please complete the remaining admission formalities and fee requirements within the notified schedule.'
      :'This letter records the current admission decision for your application. Current status: '+esc(a.status)+'. Please contact the institution for any required next step or clarification.';
    const w=window.open('','_blank');if(!w)return;w.document.write('<html><head><title>'+title+'</title><style>body{font-family:Arial;padding:48px;line-height:1.7}h1{margin-bottom:4px}.meta{margin:24px 0;padding:14px;border:1px solid #bbb}</style></head><body><h1>'+esc(s.institutionName)+'</h1><p>'+title+'</p><div class="meta">Application ID: '+esc(a.applicationId)+'<br>Applicant: '+esc(a.applicantName)+'<br>Program: '+esc(a.program)+'<br>Merit Score: '+(a.meritScore==null?'N/A':a.meritScore+'%')+'</div><p>Dear '+esc(a.applicantName)+',</p><p>'+body+'</p><p>Regards,<br>Admissions Office</p></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),250)
  }

  const originalCard=card;
  card=function(a){
    const html=originalCard(a);
    return html.replace('</div></article>','<button class="secondary-action" data-adm-review="'+esc(a.applicationId)+'">Review</button></div></article>');
  };
  const originalRenderAdmin=renderAdmin;
  renderAdmin=function(){originalRenderAdmin();document.querySelectorAll('[data-adm-review]').forEach(b=>b.onclick=()=>openReview(b.dataset.admReview))};

  ['admReviewAcademicWeight','admReviewTestWeight','admReviewInterviewWeight','admReviewTestMarks','admReviewInterviewMarks'].forEach(id=>$(id)?.addEventListener('input',calculateMerit));
  $('printAdmissionChallanBtn').onclick=printChallan;
  $('admPaymentMethod')?.addEventListener('change',renderPaymentInstructions);
  $('exportAdmissionsCsvBtn').onclick=exportCsv;
  $('exportAdmissionsJsonBtn').onclick=exportJson;
  $('closeAdmissionReviewBtn').onclick=closeReview;
  $('saveAdmissionReviewBtn').onclick=saveReview;
  $('printAdmissionLetterBtn').onclick=()=>printDecision('admission');
  $('printAdmissionRejectionBtn').onclick=()=>printDecision('decision');

  ['admPhotoFile','admIdentityFile','admResultFile','admSupportFile','admPaymentProofFile'].forEach(id=>$(id)?.addEventListener('change',()=>{
    const items=['admPhotoFile','admIdentityFile','admResultFile','admSupportFile','admPaymentProofFile'].map(x=>$(x)?.files?.[0]).filter(Boolean);
    $('admUploadPreview').innerHTML=items.map(f=>'<span class="mini-badge">'+esc(f.name)+' · '+fileSize(f.size)+'</span>').join(' ');
  }));


  async function renderCloudPayments(){
    const el=$('admissionPaymentsList');if(!el)return;
    const cloud=window.EDUNIZAM_CLOUD;
    if(!cloud?.ready?.()){el.innerHTML='<div class="empty-state">Cloud Mode is not configured. Local fee records remain visible inside applications.</div>';return;}
    try{
      const role=await cloud.getMyRole();if(!['owner','admin','admissions','reviewer'].includes(role)){el.innerHTML='<div class="empty-state">Payment verification is available to authorized institution staff.</div>';return;}
      const rows=await cloud.listPayments();
      el.innerHTML=rows.length?rows.map(p=>{
        const a=p.applications||{};
        return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(p.method||'Payment')+'</span><span class="trust-badge trust-official">'+esc(p.status||'Pending')+'</span></div></div><h3>'+esc(a.applicant_name||'Applicant')+'</h3><p class="muted">'+esc(a.application_no||'')+' · PKR '+Number(p.amount||0).toLocaleString()+'</p><div class="paper-meta"><span>Ref: '+esc(p.reference||'N/A')+'</span><span>'+esc(p.gateway_provider||'Manual')+'</span></div><div class="paper-actions"><button data-pay-verify="'+esc(p.id)+'">Mark Paid</button><button class="secondary-action" data-pay-reject="'+esc(p.id)+'">Reject / Failed</button></div></article>';
      }).join(''):'<div class="empty-state">No cloud payment records yet.</div>';
      document.querySelectorAll('[data-pay-verify]').forEach(b=>b.onclick=()=>setCloudPaymentStatus(b.dataset.payVerify,'Paid'));
      document.querySelectorAll('[data-pay-reject]').forEach(b=>b.onclick=()=>setCloudPaymentStatus(b.dataset.payReject,'Failed'));
    }catch(e){el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load payments.')+'</div>'}
  }
  async function setCloudPaymentStatus(id,status){
    const cloud=window.EDUNIZAM_CLOUD;
    try{
      await cloud.updatePaymentStatus(id,status);
      await cloud.logAudit('payment_status_'+status.toLowerCase(),'payment',id,{status});
      renderCloudPayments();renderAuditLog();
    }catch(e){alert(e.message||'Payment update failed.')}
  }
  async function renderAuditLog(){
    const el=$('admissionAuditList');if(!el)return;
    const cloud=window.EDUNIZAM_CLOUD;
    if(!cloud?.ready?.()){el.innerHTML='<div class="empty-state">Cloud Mode is not configured.</div>';return;}
    try{
      const role=await cloud.getMyRole();if(!['owner','admin','admissions','reviewer'].includes(role)){el.innerHTML='<div class="empty-state">Audit Log is available to authorized institution staff.</div>';return;}
      const rows=await cloud.listAuditLogs(75);
      el.innerHTML=rows.length?rows.map(x=>'<div class="practice-review"><div class="paper-card-top"><div><span class="mini-badge">'+esc(x.entity_type)+'</span><span class="trust-badge trust-verified">'+esc(x.action)+'</span></div><small>'+new Date(x.created_at).toLocaleString()+'</small></div><strong>'+esc(x.entity_id||'')+'</strong><div class="muted">'+esc(JSON.stringify(x.details||{}))+'</div></div>').join(''):'<div class="empty-state">No audit events yet.</div>';
    }catch(e){el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load audit log.')+'</div>'}
  }

  async function refreshCloudAuth(){
    const cloud=window.EDUNIZAM_CLOUD;
    const badge=$('admissionCloudBadge'),status=$('admissionAuthStatus');
    if(!cloud?.ready?.()){
      if(badge)badge.textContent='Local Mode';
      if(status)status.textContent='Cloud backend not connected. Local admissions remain available on this device.';
      return;
    }
    try{await cloud.init()}catch(e){}
    const user=cloud.state?.user;
    if(badge)badge.textContent=user?'Cloud Mode · Signed In':'Cloud Mode';
    if(status){
      if(user){
        let role='applicant';try{role=await cloud.getMyRole()||'applicant'}catch(e){}
        status.textContent='Signed in as '+user.email+' · Role: '+role;
      }else status.textContent='Cloud backend connected. Sign in or create an applicant account.';
    }
  }
  async function authAction(type){
    const cloud=window.EDUNIZAM_CLOUD,email=$('admissionAuthEmail')?.value.trim(),password=$('admissionAuthPassword')?.value||'';
    if(!cloud?.ready?.())return alert('Cloud backend is not configured yet. Local Mode is still available.');
    if(type!=='out'&&(!email||password.length<6))return alert('Enter a valid email and password of at least 6 characters.');
    try{
      if(type==='signup'){
        const {error}=await cloud.signUp(email,password);if(error)throw error;
        alert('Account created. If email confirmation is enabled, verify your email before signing in.');
      }else if(type==='signin'){
        const {error}=await cloud.signIn(email,password);if(error)throw error;
      }else await cloud.signOut();
      await refreshCloudAuth();
    }catch(e){alert(e.message||'Authentication failed.')}
  }
  $('admissionSignUpBtn')?.addEventListener('click',()=>authAction('signup'));
  $('admissionSignInBtn')?.addEventListener('click',()=>authAction('signin'));
  $('admissionSignOutBtn')?.addEventListener('click',()=>authAction('out'));
  $('refreshAdmissionPaymentsBtn')?.addEventListener('click',renderCloudPayments);
  $('refreshAdmissionAuditBtn')?.addEventListener('click',renderAuditLog);
  window.addEventListener('edunizam:auth',refreshCloudAuth);
  refreshCloudAuth();

  window.renderAdmissionsPortal=()=>{loadSetup();renderAdmin();updateStats();refreshCloudAuth()};
  fillStatic();
})();