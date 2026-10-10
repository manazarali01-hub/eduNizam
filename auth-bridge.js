(function(){
  'use strict';

  const LOCAL_KEY='edunizam_session';
  const RUNTIME_KEY='edunizam_cloud_runtime_config';
  const HANDOFF_KEY='edunizam_secure_login_handoff';
  const STATES=Object.freeze({
    BOOTING:'BOOTING',
    UNAUTHENTICATED:'UNAUTHENTICATED',
    AUTHENTICATING:'AUTHENTICATING',
    AUTHENTICATED:'AUTHENTICATED',
    AUTHORIZING:'AUTHORIZING',
    WORKSPACE_READY:'WORKSPACE_READY',
    BACKGROUND_SYNC:'BACKGROUND_SYNC',
    OFFLINE_READY:'OFFLINE_READY',
    AUTH_ERROR:'AUTH_ERROR'
  });

  const runtimeState={state:STATES.BOOTING,detail:{},verification:null,verificationTimer:0,lastVerifiedAt:0,syncScheduled:false};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const dataRuntime=()=>window.EDUNIZAM_DATA_RUNTIME;
  const mapRole=r=>r==='head_of_institute'?'head':(['head','teacher','parent','student'].includes(r)?r:'');
  const cloudRole=r=>r==='head'?'head_of_institute':r;

  const readJson=(storage,key,fallback=null)=>{
    try{return JSON.parse(storage.getItem(key)||'null')??fallback}catch(_){return fallback}
  };
  const readLocal=()=>readJson(localStorage,LOCAL_KEY,null);
  const readRuntime=()=>readJson(localStorage,RUNTIME_KEY,{})||{};

  function transition(next,detail={}){
    runtimeState.state=next;
    runtimeState.detail={...detail,at:Date.now()};
    document.documentElement.dataset.authState=next;
    document.documentElement.classList.toggle('edu-sync-pending',next===STATES.BACKGROUND_SYNC||next===STATES.OFFLINE_READY);
    window.dispatchEvent(new CustomEvent('edunizam:auth-state',{detail:{state:next,...runtimeState.detail}}));
  }

  function validLocal(session=readLocal()){
    return !!(
      session&&
      session.source==='supabase'&&
      ['head','teacher','parent','student'].includes(session.role)&&
      String(session.institutionId||'').trim()
    );
  }

  // An asynchronous verification must never resurrect a session that was
  // signed out or overwrite a newly selected school while its RPC was pending.
  function sameLocalWorkspace(expected){
    const current=readLocal();
    return validLocal(current)
      &&String(current.institutionId)===String(expected.institutionId)
      &&String(current.role)===String(expected.role)
      &&String(current.identity||'')===String(expected.identity||'')
      &&String(current.loginAt||'')===String(expected.loginAt||'');
  }

  function readHandoff(){
    const handoff=readJson(sessionStorage,HANDOFF_KEY,null);
    const session=readLocal();
    if(!handoff||!validLocal(session))return null;
    const expires=Number(handoff.expiresAt||0)||Number(handoff.at||0)+120000;
    if(!Number(handoff.at||0)||Date.now()>expires)return null;
    if(String(handoff.institutionId||'')!==String(session.institutionId||''))return null;
    if(String(handoff.role||'')!==String(session.role||''))return null;
    return handoff;
  }

  function clearLocalAuthState(){
    try{localStorage.removeItem(LOCAL_KEY)}catch(_){}
    try{localStorage.removeItem('edunizam_cloud_user_id')}catch(_){}
    try{sessionStorage.removeItem(HANDOFF_KEY)}catch(_){}
    const r=readRuntime();
    if(r.institutionId){
      r.institutionId='';
      try{localStorage.setItem(RUNTIME_KEY,JSON.stringify(r))}catch(_){}
    }
    if(runtimeState.verificationTimer){clearTimeout(runtimeState.verificationTimer);runtimeState.verificationTimer=0}
    runtimeState.verification=null;
    runtimeState.lastVerifiedAt=0;
    runtimeState.syncScheduled=false;
  }

  function unlockUI(){
    document.getElementById('cloudAuthScreen')?.remove();
    const sidebar=document.querySelector('.sidebar');
    const drawerOpen=!!sidebar?.classList.contains('mobile-nav-open');
    const backdrop=document.getElementById('eduMobileNavBackdrop');
    if(!drawerOpen){
      document.body?.classList.remove('mobile-nav-lock');
      if(backdrop){
        backdrop.classList.remove('show');
        backdrop.style.display='none';
        backdrop.style.pointerEvents='none';
        backdrop.style.visibility='hidden';
        backdrop.setAttribute('aria-hidden','true');
      }
    }else{
      document.body?.classList.add('mobile-nav-lock');
    }
    document.documentElement.classList.remove('edu-feature-loading');
  }

  function style(){
    if(document.getElementById('cloudAuthBridgeStyle'))return;
    const s=document.createElement('style');
    s.id='cloudAuthBridgeStyle';
    s.textContent='.cloud-auth-screen{position:fixed;inset:0;z-index:10050;isolation:isolate;pointer-events:auto!important;touch-action:auto;background:linear-gradient(135deg,#071b33,#0f766e);display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}.cloud-auth-card{position:relative;z-index:2;width:min(560px,100%);background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 80px #001a}.cloud-auth-card h1{margin:0 0 10px;color:#0b2748;line-height:1.08;font-size:clamp(30px,7vw,48px)}.cloud-auth-card p{color:#536579;font-size:17px;line-height:1.55}.cloud-auth-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.cloud-auth-actions a,.cloud-auth-actions button{min-height:48px;display:flex;align-items:center;justify-content:center;text-align:center;padding:11px 14px;border-radius:12px;font:inherit;font-weight:800;text-decoration:none;box-sizing:border-box;pointer-events:auto!important;touch-action:manipulation;cursor:pointer}.cloud-auth-actions .cloud-auth-nav{background:#f7fafc;color:#24465f;border:1px solid #d9e7f1}.cloud-auth-actions #cloudAuthRetry{grid-column:1/-1;border:0;background:linear-gradient(135deg,#1769aa,#2f80ed);color:#fff}.cloud-auth-actions [hidden]{display:none!important}@media(max-width:560px){.cloud-auth-screen{place-items:start center;padding-top:clamp(34px,10vh,92px)}.cloud-auth-card{padding:24px 20px;border-radius:22px}.cloud-auth-actions{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }

  function showAccess(message,state=STATES.UNAUTHENTICATED,retry=false){
    style();
    transition(state,{message});
    let screen=document.getElementById('cloudAuthScreen');
    if(!screen){
      screen=document.createElement('div');
      screen.id='cloudAuthScreen';
      screen.className='cloud-auth-screen';
      screen.innerHTML='<section class="cloud-auth-card"><div class="academic-kicker">EduNizam Secure Access</div><h1>School access required</h1><p id="cloudAuthGuardMessage"></p><div class="cloud-auth-actions"><a id="cloudAuthLogin" class="cloud-auth-nav" href="login.html?from=secure-guard">Go to Login</a><a id="cloudAuthGuest" class="cloud-auth-nav" href="learn.html?from=secure-guard">Continue as Guest</a><button id="cloudAuthRetry" type="button" hidden>Retry session check</button></div></section>';
      document.body.appendChild(screen);
      const retryBtn=screen.querySelector('#cloudAuthRetry');
      retryBtn.onclick=async()=>{
        if(retryBtn.disabled)return;
        retryBtn.disabled=true;
        retryBtn.textContent='Checking…';
        try{await restoreOrVerify(true)}
        finally{
          const live=document.getElementById('cloudAuthRetry');
          if(live){live.disabled=false;live.textContent='Retry session check'}
        }
      };
    }
    screen.querySelector('#cloudAuthGuardMessage').textContent=message;
    screen.querySelector('#cloudAuthRetry').hidden=!retry;
    return screen;
  }

  function updateLocalFromAccess(access,user){
    const current=readLocal()||{};
    const role=mapRole(access.workspace_role||access._membership_role||current.role);
    const next={
      ...current,
      role,
      identity:user?.email||current.identity||'',
      loginAt:current.loginAt||Date.now(),
      source:'supabase',
      schoolName:access.name||current.schoolName||'',
      institutionId:access.id||current.institutionId||''
    };
    localStorage.setItem(LOCAL_KEY,JSON.stringify(next));
    const r=readRuntime();
    r.enabled=true;
    r.institutionId=next.institutionId;
    localStorage.setItem(RUNTIME_KEY,JSON.stringify(r));
    if(window.EDUNIZAM_CLOUD_CONFIG){
      window.EDUNIZAM_CLOUD_CONFIG.enabled=true;
      window.EDUNIZAM_CLOUD_CONFIG.institutionId=next.institutionId;
    }
    if(user?.id)localStorage.setItem('edunizam_cloud_user_id',user.id);
    return next;
  }

  function workspaceReady(source='local',detail={}){
    unlockUI();
    transition(navigator.onLine?STATES.WORKSPACE_READY:STATES.OFFLINE_READY,{source,...detail});
    window.dispatchEvent(new CustomEvent('edunizam:workspace-ready',{detail:{source,...detail}}));
    scheduleBackgroundSync();
  }

  async function waitCloud(timeout=3500){
    const c=cloud();
    if(!c)return null;
    const p=c.whenReady?c.whenReady():Promise.resolve(c);
    const rt=dataRuntime();
    if(rt){
      return rt.run('cloud-runtime-ready',()=>p,{timeout,retries:0,fallback:null,label:'Cloud session restore'});
    }
    return Promise.race([p,new Promise(resolve=>setTimeout(()=>resolve(null),timeout))]);
  }

  async function verifyCurrentWorkspace(force=false){
    const local=readLocal();
    if(!validLocal(local))return false;
    if(runtimeState.verificationTimer){clearTimeout(runtimeState.verificationTimer);runtimeState.verificationTimer=0}
    if(runtimeState.verification)return runtimeState.verification;
    if(!force&&runtimeState.lastVerifiedAt&&Date.now()-runtimeState.lastVerifiedAt<60000)return true;

    runtimeState.verification=(async()=>{
      const c=cloud();
      transition([STATES.WORKSPACE_READY,STATES.OFFLINE_READY,STATES.BACKGROUND_SYNC].includes(runtimeState.state)?STATES.BACKGROUND_SYNC:STATES.AUTHORIZING,{source:'workspace-verification'});
      const ready=await waitCloud(4000);
      if(!sameLocalWorkspace(local))return false;
      if(!ready||!c?.state?.client){
        workspaceReady('offline-cache',{reason:'cloud-init-timeout'});
        return true;
      }

      // admissions-cloud owns the one browser session restoration call.
      // Once whenReady() settles, a missing user is authoritative for this runtime;
      // auth-bridge must not issue a duplicate getSession request.
      const user=c.state.user||null;

      if(!user){
        const restoreStatus=String(c.state.sessionRestoreStatus||'').toLowerCase();
        const authoritativeAbsent=restoreStatus==='absent'||c.state.authEvent==='SIGNED_OUT';
        if(!navigator.onLine||!authoritativeAbsent){
          workspaceReady('local-cache',{reason:!navigator.onLine?'offline-no-session-check':'session-restore-'+(restoreStatus||'uncertain')});
          return true;
        }
        if(!sameLocalWorkspace(local))return false;
        clearLocalAuthState();
        showAccess('Your secure session has ended. Sign in again to open private school data.',STATES.UNAUTHENTICATED,false);
        return false;
      }

      const handoff=readHandoff();
      if(!sameLocalWorkspace(local))return false;
      if(handoff?.userId&&String(handoff.userId)!==String(user.id)){
        clearLocalAuthState();
        showAccess('The signed-in account changed before this school workspace opened. Sign in again and select the correct school.',STATES.AUTH_ERROR,false);
        return false;
      }

      const expected=cloudRole(local.role);
      let access=null;
      try{
        access=await c.verifyWorkspaceAccess?.(local.institutionId,expected,force);
      }catch(error){
        if(!sameLocalWorkspace(local)||String(c?.state?.user?.id||'')!==String(user.id))return false;
        const type=dataRuntime()?.classify?.(error)||'DATA_FETCH_FAILED';
        if(['NETWORK_TIMEOUT','NETWORK_OFFLINE','SERVER_TEMPORARY_FAILURE'].includes(type)){
          workspaceReady('offline-cache',{reason:type});
          return true;
        }
        console.warn('Workspace authorization:',error?.message||error);
        workspaceReady('local-cache',{reason:'authorization-check-error'});
        return true;
      }

      // Ignore a late authorization response for a previous browser session.
      if(!sameLocalWorkspace(local)||String(c?.state?.user?.id||'')!==String(user.id))return false;
      if(!access){
        clearLocalAuthState();
        showAccess('This account is no longer approved for the selected school workspace. Sign in and select an approved school.',STATES.AUTH_ERROR,false);
        return false;
      }

      const next=updateLocalFromAccess(access,user);
      runtimeState.lastVerifiedAt=Date.now();
      try{sessionStorage.removeItem(HANDOFF_KEY)}catch(_){}
      workspaceReady('verified',{userId:user.id,institutionId:next.institutionId,role:next.role});
      return true;
    })();

    try{return await runtimeState.verification}
    finally{runtimeState.verification=null}
  }

  function scheduleWorkspaceVerification({force=false,reason='background',delay=null}={}){
    if(!validLocal())return false;
    if(runtimeState.verification||runtimeState.verificationTimer)return true;
    const freshHandoff=!!readHandoff();
    const wait=delay==null?(force?450:(freshHandoff?12000:1800)):Math.max(0,Number(delay)||0);
    runtimeState.verificationTimer=setTimeout(()=>{
      runtimeState.verificationTimer=0;
      verifyCurrentWorkspace(force).catch(error=>console.warn('Workspace verification '+reason+':',error?.message||error));
    },wait);
    return true;
  }

  async function refreshScopedRoleCache(){
    const local=readLocal();
    if(!validLocal(local))return false;
    try{
      await window.EDUNIZAM_ROLE_SCOPE?.refresh?.();
      return true;
    }catch(e){
      console.warn('Role scope refresh:',e?.message||e);
      return false;
    }
  }

  function scheduleBackgroundSync(){
    if(runtimeState.syncScheduled)return;
    runtimeState.syncScheduled=true;
    const run=()=>{
      try{
        const local=readLocal();
        if(!validLocal(local))return;
        // Authentication owns identity/session only. Feature modules own cloud data.
        transition(STATES.BACKGROUND_SYNC,{institutionId:local.institutionId});
        window.dispatchEvent(new CustomEvent('edunizam:background-sync',{detail:{institutionId:local.institutionId,role:local.role}}));
        const latest=readLocal();
        if(validLocal(latest))transition(navigator.onLine?STATES.WORKSPACE_READY:STATES.OFFLINE_READY,{source:'background-ready'});
      }finally{
        runtimeState.syncScheduled=false;
      }
    };
    setTimeout(run,1200);
  }

  async function restoreWithoutLocal(force=false){
    const c=cloud();
    const ready=await waitCloud(force?5000:2500);
    if(!ready||!c?.state?.client)return false;
    const user=c.state.user;
    if(!user)return false;
    try{
      const rows=await c.listAuthorizedWorkspaces?.(force);
      // A sign-out or a second login may occur while the school list is loading.
      if(String(c?.state?.user?.id||'')!==String(user.id)||validLocal())return false;
      if(!rows?.length)return false;
      if(rows.length!==1)return false;
      const access=rows[0];
      const localRole=mapRole(access.workspace_role||access._membership_role);
      const seed={role:localRole,identity:user.email||user.id,loginAt:Date.now(),source:'supabase',schoolName:access.name||'',institutionId:access.id||''};
      localStorage.setItem(LOCAL_KEY,JSON.stringify(seed));
      updateLocalFromAccess(access,user);
      runtimeState.lastVerifiedAt=Date.now();
      workspaceReady('restored',{userId:user.id,institutionId:access.id,role:localRole});
      return true;
    }catch(e){
      console.warn('Session workspace restore:',e?.message||e);
      return false;
    }
  }

  async function restoreOrVerify(force=false){
    const local=readLocal();
    if(validLocal(local)){
      const handoff=readHandoff();
      workspaceReady(handoff?'login-handoff':'local-session',{institutionId:local.institutionId,role:local.role});
      if(force)await verifyCurrentWorkspace(true);
      else scheduleWorkspaceVerification({reason:handoff?'login-handoff':'local-session'});
      return true;
    }
    const restored=await restoreWithoutLocal(force);
    if(restored)return true;
    showAccess('Sign in to open your private school workspace, or continue as Guest for public learning resources.',STATES.UNAUTHENTICATED,force);
    return false;
  }

  async function boot(){
    transition(STATES.BOOTING);
    unlockUI();
    const local=readLocal();
    if(validLocal(local)){
      // UI responsiveness is independent of network fetching. A fresh login
      // handoff or valid local workspace opens immediately; cloud authorization
      // is rechecked in the background and RLS remains authoritative.
      const handoff=readHandoff();
      workspaceReady(handoff?'login-handoff':'local-session',{institutionId:local.institutionId,role:local.role});
      scheduleWorkspaceVerification({reason:handoff?'login-handoff':'startup-local-session'});
      return;
    }
    showAccess('Sign in to open your private school workspace, or continue as Guest for public learning resources.',STATES.UNAUTHENTICATED,false);
    restoreWithoutLocal(false).catch(()=>{});
  }

  window.addEventListener('edunizam:auth',event=>{
    const type=event.detail?.event||'';
    if(type==='SIGNED_OUT'){
      clearLocalAuthState();
      showAccess('You have signed out. Sign in again, or continue as Guest.',STATES.UNAUTHENTICATED,false);
      return;
    }
    if(['INITIAL_SESSION','SIGNED_IN','USER_UPDATED'].includes(type)){
      const local=readLocal();
      if(validLocal(local)){
        const handoff=readHandoff();
        const eventUser=event.detail?.user||null;
        if(handoff?.userId&&eventUser?.id&&String(handoff.userId)!==String(eventUser.id)){
          clearLocalAuthState();
          showAccess('The signed-in account changed before this school workspace opened. Sign in again and select the correct school.',STATES.AUTH_ERROR,false);
          return;
        }
        unlockUI();
        scheduleWorkspaceVerification({reason:'auth-event'});
      }else{
        restoreWithoutLocal(false).catch(()=>{});
      }
    }
  });

  window.addEventListener('online',()=>{
    if(validLocal())scheduleWorkspaceVerification({force:true,reason:'network-restored',delay:450});
  });

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)unlockUI();
  });

  // Logout is handled centrally even if roleSession is mounted after startup.
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('#roleSession button');
    if(!btn)return;
    event.preventDefault();
    const c=cloud();
    Promise.resolve(c?.signOut?.()).catch(()=>{}).finally(()=>{
      clearLocalAuthState();
      showAccess('You have signed out. Sign in again, or continue as Guest.',STATES.UNAUTHENTICATED,false);
    });
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.EDUNIZAM_AUTH_BRIDGE={
    STATES,
    runtimeState,
    boot,
    configured:()=>!!cloud()?.state?.client,
    syncCloudRole:()=>verifyCurrentWorkspace(true),
    clearLocalAuthState,
    refreshScopedRoleCache,
    scheduleWorkspaceVerification,
    verifyCurrentWorkspace
  };
})();