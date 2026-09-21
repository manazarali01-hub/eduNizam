(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const roleLabel=r=>({head:'School Admin / Head',teacher:'Teacher / Staff',parent:'Parent / Guardian',student:'Student'}[r]||'User');

  function style(){
    if($('accountSecurityStyle'))return;
    const s=document.createElement('style');s.id='accountSecurityStyle';s.textContent='.account-security-btn{background:#eef7f6!important;color:#155c56!important;border:1px solid #c9e4e0!important}.account-security-backdrop{position:fixed;inset:0;z-index:12000;background:rgba(3,18,31,.7);display:grid;place-items:center;padding:18px}.account-security-card{width:min(580px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.35)}.account-security-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.account-security-head h2{margin:3px 0}.account-security-close{background:#edf3f5!important;color:#234!important;padding:8px 11px!important}.account-security-profile{display:grid;gap:8px;padding:14px;margin:16px 0;border:1px solid #dce9e7;border-radius:14px;background:#f7fbfa}.account-security-profile span{font-size:12px;color:#657785}.account-security-profile strong{color:#123d4e}.account-security-form{display:grid;gap:10px}.account-security-form input{width:100%;box-sizing:border-box}.account-security-status{min-height:22px;margin-top:8px;font-size:13px}.account-security-good{color:#166534}.account-security-bad{color:#9b1c1c}';document.head.appendChild(s);
  }
  async function school(){
    const c=cloud(),id=cfg().institutionId;if(!c?.state?.client||!id)return null;
    const {data,error}=await c.state.client.from('institutions').select('id,name,institution_type').eq('id',id).maybeSingle();
    if(error)throw error;if(!data)return null;
    let settings={};try{settings=JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){}
    settings.schoolName=data.name||settings.schoolName||'My School';settings.schoolType=data.institution_type||settings.schoolType||'School';localStorage.setItem('edunizam_settings',JSON.stringify(settings));
    const el=$('school-name');if(el)el.textContent=[settings.schoolName,settings.session].filter(Boolean).join(' · ');
    return data;
  }
  async function open(){
    style();$('accountSecurityModal')?.remove();
    const s=session(),user=cloud()?.state?.user,inst=await school().catch(()=>null);
    const box=document.createElement('div');box.id='accountSecurityModal';box.className='account-security-backdrop';
    box.innerHTML='<section class="account-security-card" role="dialog" aria-modal="true" aria-labelledby="accountSecurityTitle"><div class="account-security-head"><div><div class="academic-kicker">Secure Account</div><h2 id="accountSecurityTitle">My Account & Password</h2><p class="muted">School identity role verification se automatically linked hai.</p></div><button class="account-security-close" aria-label="Close">✕</button></div><div class="account-security-profile"><span>School / Institute</span><strong>'+esc(inst?.name||s?.schoolName||'School link pending')+'</strong><span>Authorized Role</span><strong>'+esc(roleLabel(s?.role))+'</strong><span>Login Email</span><strong>'+esc(user?.email||s?.identity||'—')+'</strong></div><h3>Change Password</h3><div class="account-security-form"><input id="accountNewPassword" type="password" minlength="8" autocomplete="new-password" placeholder="New password (minimum 8 characters)"><input id="accountConfirmPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Confirm new password"><button id="accountSavePassword">Update Password</button><button id="accountSignOutAll" class="secondary">Sign out</button></div><div id="accountSecurityStatus" class="account-security-status"></div><div class="cloud-auth-note"><strong>Security:</strong> Role ya school name yahan manually change nahi hota. Admin/Teacher authorization verified school records se aati hai.</div></section>';
    document.body.appendChild(box);const close=()=>box.remove();box.querySelector('.account-security-close').onclick=close;box.onclick=e=>{if(e.target===box)close()};
    $('accountSavePassword').onclick=async()=>{const p=$('accountNewPassword').value,c=$('accountConfirmPassword').value,status=$('accountSecurityStatus');status.className='account-security-status account-security-bad';if(p.length<8)return status.textContent='Password kam az kam 8 characters ka rakhein.';if(p!==c)return status.textContent='Passwords match nahi kar rahe.';try{status.textContent='Updating password...';const {error}=await cloud().state.client.auth.updateUser({password:p});if(error)throw error;status.className='account-security-status account-security-good';status.textContent='Password successfully update ho gaya.';$('accountNewPassword').value='';$('accountConfirmPassword').value=''}catch(e){status.textContent=e.message||String(e)}};
    $('accountSignOutAll').onclick=async()=>{try{await cloud()?.signOut?.()}finally{localStorage.removeItem('edunizam_session');localStorage.removeItem('edunizam_cloud_user_id');location.href='login.html'}};
  }
  function mount(){
    const actions=document.querySelector('.topbar-actions');if(!actions||$('accountSecurityButton'))return;
    const b=document.createElement('button');b.id='accountSecurityButton';b.className='account-security-btn';b.textContent='🔒 My Account';b.onclick=open;actions.appendChild(b);school().catch(()=>{});
  }
  window.addEventListener('edunizam:auth',()=>setTimeout(mount,0));setTimeout(mount,250);setTimeout(mount,1000);
  window.EDUNIZAM_ACCOUNT_SECURITY={open,mount,school};
})();
