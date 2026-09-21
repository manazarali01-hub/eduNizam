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
    // Keep admin setup centralized in login.html. This avoids a second, harder
    // institute-registration flow appearing inside the app.
    const lastSchool=(()=>{try{return localStorage.getItem('edunizam_last_school')||''}catch(_){return''}})();
    const q=new URLSearchParams({adminSetup:'1'});
    if(lastSchool)q.set('school',lastSchool);
    location.href='login.html?'+q.toString();
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
