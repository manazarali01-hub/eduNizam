(function(){
  const LOCAL_KEY='edunizam_session';
  const RUNTIME_KEY='edunizam_cloud_runtime_config';
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const mapRole=r=>r==='head_of_institute'?'head':(['student','parent','teacher','head'].includes(r)?r:'');
  const normalizeIdentity=v=>String(v||'').trim().toLowerCase();

  function configured(){
    const c=cloud();
    return !!(cfg().enabled&&c?.ready?.()&&c?.state?.client);
  }
  function removeDemoLogin(){document.getElementById('edunizamLogin')?.remove()}
  function readRuntime(){
    try{return JSON.parse(localStorage.getItem(RUNTIME_KEY)||'{}')}catch(_){return{}}
  }
  function clearLocalAuthState(){
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem('edunizam_cloud_user_id');
    const runtime=readRuntime();
    if(runtime.institutionId){
      runtime.institutionId='';
      localStorage.setItem(RUNTIME_KEY,JSON.stringify(runtime));
    }
  }
  function setLocalSession(role,identity){
    let existing=null;
    try{existing=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch(_){}
    const runtime=readRuntime();
    const nextIdentity=identity||existing?.identity||'';
    const sameUser=!!(
      existing?.identity&&nextIdentity&&
      normalizeIdentity(existing.identity)===normalizeIdentity(nextIdentity)
    );
    const institutionId=sameUser?(existing?.institutionId||runtime.institutionId||''):'';
    const schoolName=sameUser?(existing?.schoolName||''):'';
    localStorage.setItem(LOCAL_KEY,JSON.stringify({
      role:mapRole(role),
      identity:nextIdentity,
      loginAt:sameUser?(existing?.loginAt||Date.now()):Date.now(),
      source:'supabase',
      institutionId,
      schoolName
    }));
  }
  async function refreshScopedRoleCache(roleValue,force=false){
    const localRole=mapRole(roleValue);
    if(!['teacher','parent','student'].includes(localRole))return false;
    const c=cloud(),core=window.EDUNIZAM_CORE_CLOUD;
    if(!c?.state?.user||!core?.pullAllCloudToLocal)return false;
    const runtime=readRuntime();
    let existing=null;try{existing=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch(_){}
    const institutionId=String(existing?.institutionId||runtime.institutionId||'').trim();
    if(!institutionId)return false;
    const key='edunizam_role_cache_sync:'+c.state.user.id+':'+institutionId;
    const last=Number(sessionStorage.getItem(key)||0);
    if(!force&&last&&Date.now()-last<120000)return false;
    try{
      await core.pullAllCloudToLocal();
      sessionStorage.setItem(key,String(Date.now()));
      window.dispatchEvent(new CustomEvent('edunizam:role-cache-refreshed',{detail:{role:localRole,institutionId}}));
      const reloadKey=key+':reloaded';
      if(!sessionStorage.getItem(reloadKey)){
        sessionStorage.setItem(reloadKey,'1');
        location.reload();
        return true;
      }
      await window.EDUNIZAM_ROLE_SCOPE?.refresh?.();
      return true;
    }catch(e){
      console.warn('Role-scoped cloud refresh:',e.message||e);
      window.EDUNIZAM_RELIABILITY?.report?.('Role Data Refresh',e.message||String(e),'auth-bridge','warning');
      return false;
    }
  }

  async function syncCloudRole(){
    const c=cloud();
    if(!configured()||!c.state.user)return false;
    const role=await c.getMyRole();
    if(!role){
      clearLocalAuthState();
      window.dispatchEvent(new CustomEvent('edunizam:auth-invalid'));
      return false;
    }
    localStorage.setItem('edunizam_cloud_user_id',c.state.user.id);
    setLocalSession(role,c.state.user.email||c.state.user.id);
    if(window.EDUNIZAM_CLOUD_SETUP?.ensureInstitution){
      const institutionReady=await window.EDUNIZAM_CLOUD_SETUP.ensureInstitution();
      if(!institutionReady){
        // Keep the authenticated Supabase session and the institute selected on Login.
        // Clearing it here made the visible Retry action unable to recover after a
        // transient institution lookup / multi-school resolution failure.
        window.dispatchEvent(new CustomEvent(role==='head_of_institute'?'edunizam:school-selection-required':'edunizam:auth-invalid'));
        return false;
      }
    }
    setLocalSession(role,c.state.user.email||c.state.user.id);
    await refreshScopedRoleCache(role);
    removeDemoLogin();
    return true;
  }
  function style(){
    if(document.getElementById('cloudAuthBridgeStyle'))return;
    const s=document.createElement('style');s.id='cloudAuthBridgeStyle';
    s.textContent='.cloud-auth-screen{position:fixed;inset:0;z-index:10050;isolation:isolate;pointer-events:auto!important;touch-action:auto;background:linear-gradient(135deg,#071b33,#0f766e);display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}.cloud-auth-card{position:relative;z-index:2;pointer-events:auto!important;width:min(560px,100%);background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 80px #001a}.cloud-auth-card h1{margin:0 0 10px;color:#0b2748;line-height:1.08;font-size:clamp(32px,7vw,50px)}.cloud-auth-card p{color:#536579;font-size:17px;line-height:1.55}.cloud-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}.cloud-auth-tabs button{background:#f1f5f9;color:#334155;border:1px solid #dbe4ea}.cloud-auth-tabs button.active{background:#0f766e;color:#fff;border-color:#0f766e}.cloud-auth-grid{display:grid;gap:11px}.cloud-auth-grid input,.cloud-auth-grid select{width:100%;box-sizing:border-box}.cloud-auth-actions{position:relative;z-index:3;pointer-events:auto!important;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.cloud-auth-actions a,.cloud-auth-actions button{min-height:48px;display:flex;align-items:center;justify-content:center;text-align:center;padding:11px 14px;border-radius:12px;font:inherit;font-weight:800;text-decoration:none;box-sizing:border-box;pointer-events:auto!important;touch-action:manipulation;-webkit-tap-highlight-color:rgba(23,105,170,.16);cursor:pointer}.cloud-auth-actions .cloud-auth-nav{background:#f7fafc;color:#24465f;border:1px solid #d9e7f1}.cloud-auth-actions #cloudAuthRetry{grid-column:1/-1;border:0;background:linear-gradient(135deg,#1769aa,#2f80ed);color:#fff}.cloud-auth-actions button:disabled{opacity:.68;cursor:wait}.cloud-auth-actions [hidden]{display:none!important}.cloud-auth-note{margin-top:12px;padding:10px 12px;border-radius:12px;background:#f3f8fb;color:#466071;font-size:13px}.cloud-auth-error{color:#9b1c1c;min-height:20px;font-size:13px}.cloud-auth-success{color:#166534}.cloud-admin-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:700}@media(max-width:560px){.cloud-auth-screen{place-items:start center;padding-top:clamp(34px,10vh,92px)}.cloud-auth-card{padding:24px 20px;border-radius:22px}.cloud-auth-tabs{grid-template-columns:1fr}.cloud-auth-actions{grid-template-columns:1fr}.cloud-auth-actions a,.cloud-auth-actions button{grid-column:auto}}';
    document.head.appendChild(s);
  }
  function authScreen(message='Checking your secure school session…',showRetry=false){
    removeDemoLogin();style();
    let screen=document.getElementById('cloudAuthScreen');
    if(!screen){
      screen=document.createElement('div');screen.id='cloudAuthScreen';screen.className='cloud-auth-screen';
      screen.innerHTML='<section class="cloud-auth-card"><div class="academic-kicker">EduNizam Secure Access</div><h1>Opening your school workspace</h1><p id="cloudAuthGuardMessage"></p><div class="cloud-auth-actions"><a id="cloudAuthLogin" class="cloud-auth-nav" href="login.html?from=secure-guard">Go to Login</a><a id="cloudAuthGuest" class="cloud-auth-nav" href="learn.html?from=secure-guard">Continue as Guest</a><button id="cloudAuthRetry" type="button" hidden>Retry secure check</button></div></section>';
      document.body.appendChild(screen);
      screen.querySelector('#cloudAuthRetry').onclick=async()=>{
        const btn=screen.querySelector('#cloudAuthRetry');
        if(!btn||btn.disabled)return;
        btn.disabled=true;btn.textContent='Checking…';
        try{
          await boot(true);
          if(document.getElementById('cloudAuthScreen')){
            // A user-initiated retry must never look dead. If the in-place check
            // still cannot resolve the workspace, force a no-cache page retry.
            const url=new URL(location.href);
            url.searchParams.set('_secureRetry',String(Date.now()));
            setTimeout(()=>location.replace(url.toString()),250);
          }
        }finally{
          const live=document.getElementById('cloudAuthRetry');
          if(live){live.disabled=false;live.textContent='Retry secure check'}
        }
      };
    }
    const msg=screen.querySelector('#cloudAuthGuardMessage');if(msg)msg.textContent=message;
    const retry=screen.querySelector('#cloudAuthRetry');
    if(retry)retry.hidden=!showRetry;
    return screen;
  }
  function hideAuthScreen(){document.getElementById('cloudAuthScreen')?.remove()}

  let booting=false;
  function withTimeout(promise,ms,message){
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(()=>clearTimeout(timer)),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms)})
    ]);
  }
  async function boot(force=false){
    if(!configured()){hideAuthScreen();return}
    if(booting)return;
    booting=true;
    const c=cloud();
    authScreen(force?'Re-checking your secure school session…':'Checking your secure school session…',false);

    try{
      const {data,error}=await withTimeout(
        c.state.client.auth.getSession(),
        9000,
        'Secure session check timed out.'
      );
      if(error)throw error;
      const authUser=data?.session?.user||null;
      if(!authUser){
        clearLocalAuthState();
        window.dispatchEvent(new CustomEvent('edunizam:auth-invalid'));
        authScreen('No active school session was found. Choose Login to sign in, or Continue as Guest for public learning resources.',false);
        return;
      }
      c.state.user=authUser;
      const ok=await withTimeout(
        syncCloudRole(),
        12000,
        'School access verification timed out.'
      );
      if(!ok){
        authScreen('Your school access could not be verified yet. Retry the secure check once, or choose Login if you need to change the school/account.',true);
        return;
      }
      hideAuthScreen();
    }catch(e){
      console.warn('Cloud session guard:',e.message||e);
      authScreen('Secure session check could not finish. Check your connection and Retry, or return to Login.',true);
      return;
    }finally{
      booting=false;
    }

    setTimeout(()=>{
      const btn=document.querySelector('#roleSession button');
      if(btn)btn.onclick=async()=>{
        try{await cloud().signOut()}
        finally{
          clearLocalAuthState();
          window.dispatchEvent(new CustomEvent('edunizam:auth-invalid'));
        }
      };
    },50);
  }
  window.addEventListener('edunizam:auth',()=>setTimeout(boot,0));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)return;
    let s=null;try{s=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null')}catch(_){}
    if(s?.role&&['teacher','parent','student'].includes(s.role))refreshScopedRoleCache(s.role).catch(()=>{});
  });
  setTimeout(boot,0);
  setTimeout(boot,500);
  window.EDUNIZAM_AUTH_BRIDGE={configured,syncCloudRole,clearLocalAuthState,refreshScopedRoleCache};
})();