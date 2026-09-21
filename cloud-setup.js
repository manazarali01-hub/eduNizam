(function(){
  const KEY='edunizam_cloud_runtime_config';
  const get=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  async function ensureInstitution(){
    const cloud=window.EDUNIZAM_CLOUD,cfg=window.EDUNIZAM_CLOUD_CONFIG||{};
    if(!cloud?.state?.user||!cloud?.listMyInstitutions)return false;
    const list=await cloud.listMyInstitutions();
    if(cfg.institutionId&&list.some(x=>x.id===cfg.institutionId))return true;
    if(list.length===1){
      const current=get();current.institutionId=list[0].id;current.enabled=true;localStorage.setItem(KEY,JSON.stringify(current));location.reload();return true;
    }
    if(list.length>1){showInstitutionPicker(list);return false}
    showInstitutionCreate();return false;
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
    box.querySelector('#institutionUse').onclick=()=>{const current=get();current.institutionId=box.querySelector('#institutionSelect').value;current.enabled=true;localStorage.setItem(KEY,JSON.stringify(current));location.reload()};
  }
  async function showInstitutionCreate(){
    const box=overlayBase(
      'institutionCreate',
      'Register School Admin',
      '<p>Is account ka abhi koi institute linked nahi hai. Agar aap school ke authorized Head/Owner hain to verification request submit karein.</p>'+
      '<div class="cloud-auth-grid">'+
      '<input id="adminSchoolName" placeholder="School / Institute name">'+
      '<input id="adminSchoolCode" placeholder="School Registration / EMIS Code">'+
      '<select id="adminSchoolType"><option value="school">School</option><option value="college">College</option><option value="academy">Academy</option><option value="university">University</option></select>'+
      '<input id="adminFullName" placeholder="Head / Owner full name">'+
      '<input id="adminDesignation" placeholder="Designation e.g. Head Teacher / Principal / Owner">'+
      '<input id="adminPhone" placeholder="Mobile number">'+
      '<input id="adminProof" placeholder="Authority proof reference (optional for test)">'+
      '<button id="adminRequestSubmit">Submit for Verification</button>'+
      '<button id="adminRequestRefresh" class="secondary">Check Request Status</button>'+
      '<div id="adminRequestMsg" class="coverage-note"></div>'+
      '</div>'+
      '<div class="cloud-auth-note"><strong>Important:</strong> EMIS/registration code sirf school ki pehchan hai; is se Admin access nahi milta. EduNizam approval ke baad hi ye account School Admin banta hai.</div>'
    );
    const msg=box.querySelector('#adminRequestMsg');
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
        const r=await window.EDUNIZAM_CLOUD.submitSchoolAdminRequest({
          schoolName:box.querySelector('#adminSchoolName').value,
          registrationCode:box.querySelector('#adminSchoolCode').value,
          schoolType:box.querySelector('#adminSchoolType').value,
          adminName:box.querySelector('#adminFullName').value,
          designation:box.querySelector('#adminDesignation').value,
          phone:box.querySelector('#adminPhone').value,
          proofReference:box.querySelector('#adminProof').value
        });
        msg.textContent='Request submitted successfully. Status: '+String(r?.request_status||'pending').toUpperCase()+'. EduNizam verification ke baad Admin access activate hoga.';
      }catch(e){msg.textContent=e.message||String(e)}
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