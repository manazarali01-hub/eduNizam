(function(){
  const KEY='edunizam_cloud_runtime_config';
  const get=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function useInstitution(inst,reload=true){
    if(!inst?.id)return false;
    const current=get();current.institutionId=inst.id;current.enabled=true;localStorage.setItem(KEY,JSON.stringify(current));
    let settings={};try{settings=JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){}
    settings.schoolName=inst.name||settings.schoolName||'My School';
    settings.schoolType=inst.institution_type||settings.schoolType||'School';
    localStorage.setItem('edunizam_settings',JSON.stringify(settings));
    const schoolName=document.getElementById('school-name');if(schoolName)schoolName.textContent=[settings.schoolName,settings.session].filter(Boolean).join(' · ');
    if(reload)location.reload();return true;
  }

  async function ensureInstitution(){
    const cloud=window.EDUNIZAM_CLOUD,cfg=window.EDUNIZAM_CLOUD_CONFIG||{};
    if(!cloud?.state?.user||!cloud?.listMyInstitutions)return false;
    const list=await cloud.listMyInstitutions();
    if(cfg.institutionId&&list.some(x=>x.id===cfg.institutionId)){useInstitution(list.find(x=>x.id===cfg.institutionId),false);return true}
    if(list.length===1){
      useInstitution(list[0]);return true;
    }
    if(list.length>1){showInstitutionPicker(list);return false}
    const intent=cloud.state.user?.user_metadata?.signup_intent||'';
    if(intent==='school_admin_candidate'){showInstitutionCreate();return false}
    showSchoolLinking(await cloud.getMyRole());return false;
  }
  function overlayBase(id,title,body){
    document.getElementById(id)?.remove();
    const box=document.createElement('div');box.id=id;box.className='cloud-auth-screen';
    box.innerHTML='<div class="cloud-auth-card"><div class="academic-kicker">EduNizam Institute Setup</div><h1>'+title+'</h1>'+body+'</div>';
    document.body.appendChild(box);return box;
  }
  function showInstitutionPicker(list){
    const options=list.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+' — '+esc(x.institution_type)+'</option>').join('');
    const box=overlayBase('institutionPicker','Select your institute','<p>Aap ke account ke sath multiple institutes linked hain.</p><div class="cloud-auth-grid"><select id="institutionSelect">'+options+'</select><button id="institutionUse">Use this institute</button></div>');
    box.querySelector('#institutionUse').onclick=()=>useInstitution(list.find(x=>x.id===box.querySelector('#institutionSelect').value));
  }

  function showSchoolLinking(role){
    const labels={teacher:'Teacher / Staff',parent:'Parent / Guardian',student:'Student'};
    const title='Link '+(labels[role]||'Account')+' to School';
    const teacher=role==='teacher',parent=role==='parent';
    const body='<p>Account secure hai, lekin school link complete karna zaroori hai. School Admin se code lein.</p><div class="cloud-auth-grid">'+
      '<input id="linkInvite" placeholder="School '+(teacher?'Teacher ':'')+'Invite Code">'+
      (teacher?'<input id="linkStaff" placeholder="Staff Code">':'<input id="linkStudent" placeholder="'+(parent?'Child ':'Your ')+'Student Code">')+
      '<button id="linkSubmit">'+(teacher?'Send Admin Approval Request':'Link Account')+'</button><button id="linkLogout" class="secondary">Sign out</button><div id="linkMsg" class="coverage-note"></div></div>';
    const box=overlayBase('schoolLinking',title,body),msg=box.querySelector('#linkMsg');
    box.querySelector('#linkSubmit').onclick=async()=>{
      try{
        msg.textContent='Verifying school link...';const c=window.EDUNIZAM_CLOUD;
        if(teacher){
          const row=await c.requestTeacherAccess(box.querySelector('#linkInvite').value,box.querySelector('#linkStaff').value);
          msg.textContent='Request '+String(row?.request_status||'pending').toUpperCase()+'. School Admin approval ke baad dobara sign in karein.';return;
        }
        const invite=box.querySelector('#linkInvite').value.trim(),studentCode=box.querySelector('#linkStudent').value.trim();
        if(invite)await c.claimInstitutionInvite(invite);
        if(parent&&studentCode)await c.requestParentLinkByStudentCode(studentCode);
        if(role==='student'&&studentCode)await c.claimStudentRecord(studentCode);
        const list=await c.listMyInstitutions();
        if(list.length)useInstitution(list[0]);else msg.textContent=parent?'Child link request sent. School approval ke baad dashboard active hoga.':'Valid School Invite Code ya Student Code required hai.';
      }catch(e){msg.textContent=e.message||String(e)}
    };
    box.querySelector('#linkLogout').onclick=async()=>{await window.EDUNIZAM_CLOUD?.signOut?.();localStorage.removeItem('edunizam_session');location.href='login.html'};
  }
  async function showInstitutionCreate(){
    const box=overlayBase(
      'institutionCreate',
      'Register School Admin',
      '<p>Is account ka abhi koi institute linked nahi hai. Agar aap school ke authorized Head/Owner hain to verification request submit karein.</p>'+
      '<div class="cloud-auth-grid">'+
      '<input id="adminSchoolName" placeholder="School / Institute name">'+
      '<select id="adminSchoolSector"><option value="private">Private School</option><option value="government">Government School</option></select>'+
      '<input id="adminSchoolCode" placeholder="Private School Registration Number">'+
      '<select id="adminSchoolType"><option value="school">School</option><option value="college">College</option><option value="academy">Academy</option><option value="university">University</option></select>'+
      '<input id="adminFullName" placeholder="Head / Owner full name">'+
      '<input id="adminDesignation" placeholder="Designation e.g. Head Teacher / Principal / Owner">'+
      '<input id="adminPhone" placeholder="Mobile number">'+
      '<input id="adminProof" placeholder="Authority proof reference (optional for test)">'+
      '<button id="adminRequestSubmit">Submit for Verification</button>'+
      '<button id="adminRequestRefresh" class="secondary">Check Request Status</button>'+
      '<div id="adminRequestMsg" class="coverage-note"></div>'+
      '</div>'+
      '<div class="cloud-auth-note"><strong>Mandatory verification:</strong> Private School ka Registration Number ya Government School ka EMIS Code official record se verify hona zaroori hai. Verification ke baghair Admin access activate nahi hoga.</div>'
    );
    const msg=box.querySelector('#adminRequestMsg');
    const sector=box.querySelector('#adminSchoolSector');
    const codeInput=box.querySelector('#adminSchoolCode');
    const syncCodeLabel=()=>{codeInput.placeholder=sector.value==='government'?'Government School EMIS Code':'Private School Registration Number'};
    sector.onchange=syncCodeLabel;syncCodeLabel();
    async function status(){
      try{
        const r=await window.EDUNIZAM_CLOUD?.mySchoolAdminRequest?.();
        if(!r){msg.textContent='Abhi koi Admin verification request submit nahi hui.';return}
        msg.textContent='Request: '+String(r.request_status||'pending').toUpperCase()+
          ' · '+(r.school_name||'School')+
          (r.review_note?' · '+r.review_note:'');
        if(r.request_status==='approved'){
          msg.textContent+=' · Admin access activated. Reloading...';
          setTimeout(()=>location.reload(),800);
        }
      }catch(e){msg.textContent=e.message||String(e)}
    }
    box.querySelector('#adminRequestSubmit').onclick=async()=>{
      try{
        msg.textContent='Submitting verification request...';
        const schoolSector=sector.value;
        const registrationCode=codeInput.value.trim();
        if(!registrationCode)return msg.textContent=schoolSector==='government'?'Government School EMIS Code required hai.':'Private School Registration Number required hai.';
        const r=await window.EDUNIZAM_CLOUD.submitSchoolAdminRequest({
          schoolName:box.querySelector('#adminSchoolName').value,
          registrationCode,
          schoolSector,
          schoolType:box.querySelector('#adminSchoolType').value,
          adminName:box.querySelector('#adminFullName').value,
          designation:box.querySelector('#adminDesignation').value,
          phone:box.querySelector('#adminPhone').value,
          proofReference:box.querySelector('#adminProof').value
        });
        msg.textContent='Request submitted. Status: '+String(r?.request_status||'pending').toUpperCase()+'. '+(r?.code_verified?'School code verified.':'School code official record se verify hona abhi baqi hai.')+' Code verify aur Admin approval ke baad hi access activate hoga.';
      }catch(e){
        const m=e?.message||String(e);
        msg.textContent=/submit_school_admin_request_v2|schema cache|function .* does not exist/i.test(m)
          ?'School verification backend is not deployed yet. Admin request is blocked until EMIS/Registration verification backend is active.'
          :m;
      }
    };
    box.querySelector('#adminRequestRefresh').onclick=status;
    status();
  }

  function showConnectionWizard(){
    document.getElementById('cloudPublicWizard')?.remove();
    const current=Object.assign({},window.EDUNIZAM_CLOUD_CONFIG||{},get());
    const box=overlayBase(
      'cloudPublicWizard',
      'Connect EduNizam Cloud',
      '<p>School Admin aur Teacher secure login ke liye Supabase cloud backend connect karein.</p>'+
      '<div class="cloud-auth-grid">'+
      '<input id="publicCloudUrl" placeholder="Supabase Project URL" value="'+esc(current.supabaseUrl||'')+'">'+
      '<input id="publicCloudKey" type="password" placeholder="Supabase Publishable / Anon Key" value="'+esc(current.supabasePublishableKey||'')+'">'+
      '<div class="cloud-auth-actions"><button id="publicCloudTest">Test Connection</button><button id="publicCloudSave">Save & Reload</button><button id="publicCloudCancel" class="secondary">Cancel</button></div>'+
      '<div id="publicCloudMsg" class="coverage-note">Publishable/Anon key browser app ke liye hoti hai. Service-role key yahan kabhi paste na karein.</div>'+
      '</div>'
    );
    const msg=t=>{const el=box.querySelector('#publicCloudMsg');if(el)el.textContent=t};
    box.querySelector('#publicCloudTest').onclick=async()=>{
      const url=box.querySelector('#publicCloudUrl').value.trim().replace(/\/$/,'');
      const key=box.querySelector('#publicCloudKey').value.trim();
      if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return msg('Valid Supabase Project URL enter karein.');
      if(key.length<20)return msg('Publishable / Anon key incomplete lag rahi hai.');
      try{
        msg('Testing connection...');
        const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key,Authorization:'Bearer '+key}});
        if(!r.ok)throw new Error('HTTP '+r.status);
        msg('Connection successful. Ab Save & Reload karein.');
      }catch(e){msg('Connection test failed: '+(e.message||e))}
    };
    box.querySelector('#publicCloudSave').onclick=()=>{
      const url=box.querySelector('#publicCloudUrl').value.trim().replace(/\/$/,'');
      const key=box.querySelector('#publicCloudKey').value.trim();
      if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return msg('Valid Supabase Project URL enter karein.');
      if(key.length<20)return msg('Publishable / Anon key required hai.');
      localStorage.setItem(KEY,JSON.stringify({
        enabled:true,
        provider:'supabase',
        supabaseUrl:url,
        supabasePublishableKey:key,
        institutionId:'',
        admissionsStorageBucket:'admission-documents',
        paymentApiBaseUrl:''
      }));
      location.reload();
    };
    box.querySelector('#publicCloudCancel').onclick=()=>box.remove();
  }

  function mount(){
    const settings=document.getElementById('settings');if(!settings||document.getElementById('cloudSetupCard'))return;
    const cfg=Object.assign({},window.EDUNIZAM_CLOUD_CONFIG||{},get());
    const card=document.createElement('article');card.className='card';card.id='cloudSetupCard';
    card.innerHTML='<div class="section-head"><div><h2>EduNizam Cloud Setup</h2><p class="muted">Supabase connect karein bina code edit kiye.</p></div><span id="cloudSetupBadge" class="badge">'+(cfg.enabled?'Enabled':'Local Mode')+'</span></div><div class="form-grid"><input id="cloudSetupUrl" placeholder="Supabase Project URL" value="'+esc(cfg.supabaseUrl||'')+'"><input id="cloudSetupKey" type="password" placeholder="Supabase Publishable / Anon Key" value="'+esc(cfg.supabasePublishableKey||'')+'"><input id="cloudSetupInstitution" placeholder="Institution UUID" value="'+esc(cfg.institutionId||'')+'"><label class="check-option"><input id="cloudSetupEnabled" type="checkbox" '+(cfg.enabled?'checked':'')+'> Enable cloud backend</label></div><div class="quick-actions"><button id="cloudSetupTest" class="secondary">Test Connection</button><button id="cloudSetupSave">Save & Reload</button><button id="cloudSetupClear" class="secondary">Use Local Mode</button></div><div id="cloudSetupMessage" class="coverage-note">Publishable/anon key browser app mein use hoti hai. Service-role key kabhi yahan paste na karein.</div>';
    settings.prepend(card);
    const msg=t=>document.getElementById('cloudSetupMessage').textContent=t;
    document.getElementById('cloudSetupTest').onclick=async()=>{
      const url=document.getElementById('cloudSetupUrl').value.trim().replace(/\/$/,'');
      const key=document.getElementById('cloudSetupKey').value.trim();
      if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return msg('Valid Supabase project URL enter karein.');
      if(key.length<20)return msg('Publishable / anon key incomplete lag rahi hai.');
      try{
        msg('Testing Supabase connection...');
        const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key,Authorization:'Bearer '+key}});
        if(!r.ok)throw new Error('HTTP '+r.status);
        msg('Connection successful. Ab Save & Reload karein.');
      }catch(e){msg('Connection test failed: '+(e.message||e))}
    };
    document.getElementById('cloudSetupSave').onclick=()=>{
      const next={
        enabled:document.getElementById('cloudSetupEnabled').checked,
        provider:'supabase',
        supabaseUrl:document.getElementById('cloudSetupUrl').value.trim().replace(/\/$/,''),
        supabasePublishableKey:document.getElementById('cloudSetupKey').value.trim(),
        institutionId:document.getElementById('cloudSetupInstitution').value.trim(),
        admissionsStorageBucket:'admission-documents',
        paymentApiBaseUrl:(window.EDUNIZAM_CLOUD_CONFIG||{}).paymentApiBaseUrl||''
      };
      if(next.enabled&&(!next.supabaseUrl||!next.supabasePublishableKey))return msg('Cloud enable karne ke liye URL aur publishable key required hain.');
      localStorage.setItem(KEY,JSON.stringify(next));location.reload();
    };
    document.getElementById('cloudSetupClear').onclick=()=>{
      const current=get();current.enabled=false;localStorage.setItem(KEY,JSON.stringify(current));localStorage.removeItem('edunizam_session');location.reload();
    };
  }
  setTimeout(mount,0);setTimeout(mount,400);
  window.EDUNIZAM_CLOUD_SETUP={mount,get,ensureInstitution,showConnectionWizard};
})();
