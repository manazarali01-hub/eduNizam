(function(){
  const KEY='edunizam_cloud_runtime_config';
  const get=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function useInstitution(inst,reload=false){
    if(!inst?.id)return false;
    const current=get();
    current.enabled=true;
    current.institutionId=inst.id;
    localStorage.setItem(KEY,JSON.stringify(current));

    let session=null;
    try{session=JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch(_){}
    if(session){
      session.institutionId=inst.id;
      session.schoolName=inst.name||session.schoolName||'';
      localStorage.setItem('edunizam_session',JSON.stringify(session));
    }

    let settings={};
    try{settings=JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){}
    settings.schoolName=inst.name||settings.schoolName||'My School';
    settings.schoolType=inst.institution_type||settings.schoolType||'School';
    localStorage.setItem('edunizam_settings',JSON.stringify(settings));

    const schoolName=document.getElementById('school-name');
    if(schoolName)schoolName.textContent=[settings.schoolName,settings.session].filter(Boolean).join(' · ');
    if(reload)location.reload();
    return true;
  }

  async function ensureInstitution(){
    const cloud=window.EDUNIZAM_CLOUD;
    if(!cloud?.state?.user)return false;

    try{
      const current=get();
      const owner=await cloud.state.client
        .from('institutions')
        .select('id,name,institution_type,school_registration_code')
        .eq('owner_user_id',cloud.state.user.id)
        .order('created_at',{ascending:true});

      if(owner.data?.length){
        let session=null;
        try{session=JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch(_){}
        const selectedId=session?.institutionId||current.institutionId||'';
        const selectedName=String(session?.schoolName||'').trim().toLowerCase();
        const preferred=
          owner.data.find(x=>x.id===selectedId) ||
          (selectedName?owner.data.find(x=>String(x.name||'').trim().toLowerCase()===selectedName):null) ||
          owner.data.find(x=>x.id===current.institutionId) ||
          owner.data[0];
        useInstitution(preferred,false);
        return true;
      }

      const profile=await cloud.state.client
        .from('user_profiles')
        .select('institution_id')
        .eq('user_id',cloud.state.user.id)
        .maybeSingle();

      if(profile.data?.institution_id){
        const found=await cloud.state.client
          .from('institutions')
          .select('id,name,institution_type')
          .eq('id',profile.data.institution_id)
          .maybeSingle();
        if(found.data){
          useInstitution(found.data,false);
          return true;
        }
      }

      return false;
    }catch(_){
      return false;
    }
  }

  function overlayBase(id,title,body){
    document.getElementById(id)?.remove();
    const box=document.createElement('div');
    box.id=id;
    box.className='cloud-auth-screen';
    box.innerHTML='<div class="cloud-auth-card"><div class="academic-kicker">EduNizam Cloud</div><h1>'+title+'</h1>'+body+'</div>';
    document.body.appendChild(box);
    return box;
  }

  function showConnectionWizard(){
    document.getElementById('cloudPublicWizard')?.remove();
    const current=Object.assign({},window.EDUNIZAM_CLOUD_CONFIG||{},get());
    const box=overlayBase(
      'cloudPublicWizard',
      'Connect EduNizam Cloud',
      '<p>Configure the Supabase project used by EduNizam.</p>'+
      '<div class="cloud-auth-grid">'+
      '<input id="publicCloudUrl" placeholder="Supabase Project URL" value="'+esc(current.supabaseUrl||'')+'">'+
      '<input id="publicCloudKey" type="password" placeholder="Supabase Publishable Key" value="'+esc(current.supabasePublishableKey||'')+'">'+
      '<div class="cloud-auth-actions"><button id="publicCloudTest">Test Connection</button><button id="publicCloudSave">Save & Reload</button><button id="publicCloudCancel" class="secondary">Cancel</button></div>'+
      '<div id="publicCloudMsg" class="coverage-note">Use a publishable browser key only. Never paste a service-role key here.</div>'+
      '</div>'
    );
    const msg=t=>{const el=box.querySelector('#publicCloudMsg');if(el)el.textContent=t};

    box.querySelector('#publicCloudTest').onclick=async()=>{
      const url=box.querySelector('#publicCloudUrl').value.trim().replace(/\/$/,'');
      const key=box.querySelector('#publicCloudKey').value.trim();
      if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return msg('Enter a valid Supabase Project URL.');
      if(key.length<20)return msg('Enter a valid publishable key.');
      try{
        msg('Testing connection...');
        const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key,Authorization:'Bearer '+key}});
        if(!r.ok)throw new Error('HTTP '+r.status);
        msg('Connection successful.');
      }catch(e){msg('Connection failed: '+(e.message||e))}
    };

    box.querySelector('#publicCloudSave').onclick=()=>{
      const url=box.querySelector('#publicCloudUrl').value.trim().replace(/\/$/,'');
      const key=box.querySelector('#publicCloudKey').value.trim();
      if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return msg('Enter a valid Supabase Project URL.');
      if(key.length<20)return msg('Publishable key is required.');
      localStorage.setItem(KEY,JSON.stringify({
        enabled:true,
        provider:'supabase',
        supabaseUrl:url,
        supabasePublishableKey:key,
        institutionId:'',
        admissionsStorageBucket:'admission-documents',
        complaintStorageBucket:'parent-complaints',
        paymentApiBaseUrl:''
      }));
      location.reload();
    };

    box.querySelector('#publicCloudCancel').onclick=()=>box.remove();
  }

  function mount(){
    const settings=document.getElementById('settings');
    if(!settings||document.getElementById('cloudSetupCard'))return;

    const cfg=Object.assign({},window.EDUNIZAM_CLOUD_CONFIG||{},get());
    const card=document.createElement('article');
    card.className='card';
    card.id='cloudSetupCard';
    card.innerHTML='<div class="section-head"><div><h2>EduNizam Cloud Setup</h2><p class="muted">Supabase connection used by this app.</p></div><span class="badge">'+(cfg.enabled?'Enabled':'Local Mode')+'</span></div>'+
      '<div class="form-grid">'+
      '<input id="cloudSetupUrl" placeholder="Supabase Project URL" value="'+esc(cfg.supabaseUrl||'')+'">'+
      '<input id="cloudSetupKey" type="password" placeholder="Supabase Publishable Key" value="'+esc(cfg.supabasePublishableKey||'')+'">'+
      '<label class="check-option"><input id="cloudSetupEnabled" type="checkbox" '+(cfg.enabled?'checked':'')+'> Enable cloud backend</label>'+
      '</div>'+
      '<div class="quick-actions"><button id="cloudSetupTest" class="secondary">Test Connection</button><button id="cloudSetupSave">Save & Reload</button></div>'+
      '<div id="cloudSetupMessage" class="coverage-note">Use a publishable key only.</div>';

    settings.prepend(card);
    const msg=t=>document.getElementById('cloudSetupMessage').textContent=t;

    const schoolCard=document.createElement('article');
    schoolCard.className='card';
    schoolCard.id='multiSchoolCard';
    schoolCard.innerHTML='<div class="section-head"><div><h2>My Schools / Institutes</h2><p class="muted">Ek hi Admin account se multiple schools manage karein. Parent/Student ko isi school ka Login Code dein; Teacher ko Access & Roles se invite dein.</p></div><button id="refreshSchoolsBtn" class="secondary">Refresh</button></div>'+
      '<div id="ownedSchoolsList" class="list"><div class="muted">Loading schools...</div></div>'+
      '<hr><h3>Add another school</h3><div class="form-grid"><input id="newOwnedSchoolName" placeholder="School / Institute name"><input id="newOwnedSchoolCode" placeholder="School Code / EMIS / Registration No."><input id="newOwnedSchoolPhone" placeholder="Contact number (optional)"><button id="addOwnedSchoolBtn">Add School</button></div>'+
      '<div id="multiSchoolMsg" class="coverage-note"></div>';
    card.after(schoolCard);

    async function loadOwnedSchools(){
      const cloud=window.EDUNIZAM_CLOUD,box=document.getElementById('ownedSchoolsList');
      if(!cloud?.state?.client||!cloud?.state?.user){box.innerHTML='<div class="muted">Please sign in first.</div>';return}
      const {data,error}=await cloud.state.client.from('institutions').select('id,name,institution_type,school_registration_code').eq('owner_user_id',cloud.state.user.id).order('created_at',{ascending:true});
      if(error){box.innerHTML='<div class="muted">'+esc(error.message)+'</div>';return}
      const current=get().institutionId||'';
      box.innerHTML=(data||[]).length?(data||[]).map(s=>'<div class="row"><strong>'+esc(s.name)+'</strong><span><small>Parent/Student Login Code</small><br><strong>'+esc(s.school_registration_code||'-')+'</strong></span><span>'+(s.id===current?'<span class="badge">Current</span>':'<button class="secondary" data-school-id="'+esc(s.id)+'">Switch</button>')+'</span></div>').join(''):'<div class="muted">No owned school found.</div>';
      box.querySelectorAll('[data-school-id]').forEach(btn=>btn.onclick=()=>{
        const school=(data||[]).find(x=>x.id===btn.dataset.schoolId);
        if(school)useInstitution(school,true);
      });
    }

    document.getElementById('refreshSchoolsBtn').onclick=loadOwnedSchools;
    document.getElementById('addOwnedSchoolBtn').onclick=async()=>{
      const cloud=window.EDUNIZAM_CLOUD,msgBox=document.getElementById('multiSchoolMsg');
      if(!cloud?.state?.client||!cloud?.state?.user){msgBox.textContent='Please sign in first.';return}
      const name=document.getElementById('newOwnedSchoolName').value.trim();
      const code=document.getElementById('newOwnedSchoolCode').value.trim();
      const phone=document.getElementById('newOwnedSchoolPhone').value.trim();
      if(!name||!code){msgBox.textContent='School name and school code are required.';return}
      msgBox.textContent='Adding school...';
      const {data,error}=await cloud.state.client.rpc('create_owned_institution_v1',{p_school_name:name,p_school_code:code,p_phone:phone});
      if(error){msgBox.textContent=error.message;return}
      const school=Array.isArray(data)?data[0]:data;
      msgBox.textContent='School added successfully.';
      document.getElementById('newOwnedSchoolName').value='';
      document.getElementById('newOwnedSchoolCode').value='';
      document.getElementById('newOwnedSchoolPhone').value='';
      if(school?.id)useInstitution(school,true); else await loadOwnedSchools();
    };
    loadOwnedSchools();

    document.getElementById('cloudSetupTest').onclick=async()=>{
      const url=document.getElementById('cloudSetupUrl').value.trim().replace(/\/$/,'');
      const key=document.getElementById('cloudSetupKey').value.trim();
      if(!/^https:\/\/.+\.supabase\.co$/i.test(url))return msg('Enter a valid Supabase Project URL.');
      if(key.length<20)return msg('Enter a valid publishable key.');
      try{
        msg('Testing connection...');
        const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key,Authorization:'Bearer '+key}});
        if(!r.ok)throw new Error('HTTP '+r.status);
        msg('Connection successful.');
      }catch(e){msg('Connection failed: '+(e.message||e))}
    };

    document.getElementById('cloudSetupSave').onclick=()=>{
      const next={
        enabled:document.getElementById('cloudSetupEnabled').checked,
        provider:'supabase',
        supabaseUrl:document.getElementById('cloudSetupUrl').value.trim().replace(/\/$/,''),
        supabasePublishableKey:document.getElementById('cloudSetupKey').value.trim(),
        institutionId:cfg.institutionId||'',
        admissionsStorageBucket:'admission-documents',
        complaintStorageBucket:'parent-complaints',
        paymentApiBaseUrl:(window.EDUNIZAM_CLOUD_CONFIG||{}).paymentApiBaseUrl||''
      };
      if(next.enabled&&(!next.supabaseUrl||!next.supabasePublishableKey))return msg('URL and publishable key are required.');
      localStorage.setItem(KEY,JSON.stringify(next));
      location.reload();
    };
  }

  setTimeout(mount,0);
  setTimeout(mount,400);
  window.EDUNIZAM_CLOUD_SETUP={mount,get,ensureInstitution,showConnectionWizard};
})();