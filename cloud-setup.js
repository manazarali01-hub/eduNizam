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
  function showInstitutionCreate(){
    overlayBase(
      'institutionCreate',
      'School Admin access required',
      '<p>This account is not linked to an EduNizam institute.</p><div class="coverage-note"><strong>Security rule:</strong> users cannot create a school and make themselves Admin from the login screen. The school must first be provisioned for its verified owner. After that, the owner signs in with the registered Admin account, while Teachers request access against the Staff Directory.</div>'
    );
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
  window.EDUNIZAM_CLOUD_SETUP={mount,get,ensureInstitution};
})();