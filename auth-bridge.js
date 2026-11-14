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

  const runtimeState={state:STATES.BOOTING,detail:{},verification:null,verificationTimer:0,verificationQueued:false,lastVerifiedAt:0,syncScheduled:false};
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
    runtimeState.verificationQueued=false;
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
    s.textContent=".cloud-auth-screen{position:fixed;inset:0;z-index:10050;isolation:isolate;pointer-events:auto!important;touch-action:auto;overflow-y:auto;background:radial-gradient(ellipse at 18% 18%,rgba(72,174,255,.3),transparent 36%),radial-gradient(ellipse at 86% 82%,rgba(31,112,220,.28),transparent 38%),linear-gradient(145deg,#06172d 0%,#0a2544 48%,#102f55 100%);display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom))}.cloud-auth-card{position:relative;isolation:isolate;overflow:hidden;z-index:2;width:min(600px,100%);background:linear-gradient(145deg,rgba(11,54,101,.96),rgba(3,20,47,.98) 68%,rgba(2,13,32,.99))!important;color:#f2f8ff!important;border:1px solid rgba(225,241,255,.78);border-radius:28px;padding:clamp(24px,5vw,38px);box-shadow:0 32px 90px rgba(0,8,25,.55),0 0 0 1px rgba(255,255,255,.4) inset,0 0 42px rgba(87,174,255,.22);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}.cloud-auth-card:before{content:'';position:absolute;z-index:0;inset:0 0 auto;height:5px;background:linear-gradient(90deg,#b9d4ef,#fff,#62b9ff,#dce9f7);box-shadow:0 0 24px rgba(91,184,246,.65)}.cloud-auth-card:after{content:'';position:absolute;z-index:0;width:230px;height:230px;right:-100px;top:-110px;border-radius:50%;background:radial-gradient(circle,rgba(76,166,255,.22),rgba(76,166,255,0) 70%);pointer-events:none}.cloud-auth-card>*{position:relative;z-index:1}.cloud-auth-card .academic-kicker{color:#1769aa!important;-webkit-text-fill-color:#1769aa!important;font-weight:850;letter-spacing:.13em;text-transform:uppercase}.cloud-auth-card h1{margin:0 0 12px;color:#0b2748!important;-webkit-text-fill-color:#0b2748!important;opacity:1!important;line-height:1.08;font-size:clamp(30px,7vw,48px);letter-spacing:-.035em}.cloud-auth-card p{margin:0;color:#405b73!important;-webkit-text-fill-color:#405b73!important;opacity:1!important;font-size:17px;line-height:1.6}.cloud-auth-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:22px}.cloud-auth-actions a,.cloud-auth-actions button{min-height:52px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px 16px;border-radius:14px;font:inherit;font-weight:800;text-decoration:none;box-sizing:border-box;pointer-events:auto!important;touch-action:manipulation;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.cloud-auth-actions .cloud-auth-nav{background:linear-gradient(145deg,rgba(255,255,255,.86),rgba(226,237,249,.92))!important;color:#173b5c!important;-webkit-text-fill-color:#173b5c!important;border:1px solid rgba(150,184,216,.78);box-shadow:0 8px 20px rgba(14,49,82,.1),0 1px 0 rgba(255,255,255,.9) inset}.cloud-auth-actions .cloud-auth-nav:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(14,49,82,.17),0 0 18px rgba(91,184,246,.2)}.cloud-auth-actions #cloudAuthRetry{grid-column:1/-1;border:1px solid rgba(180,224,255,.55);background:linear-gradient(110deg,#145f9c,#2f80ed);color:#fff;-webkit-text-fill-color:#fff;box-shadow:0 8px 24px rgba(20,95,156,.28),0 0 22px rgba(91,184,246,.2)}.cloud-auth-actions [hidden]{display:none!important}body.page-app .cloud-auth-screen .cloud-auth-card{--en-card-photo:none!important;--en-card-art:none!important;background-color:rgba(3,20,47,.98)!important;background-image:linear-gradient(145deg,rgba(11,54,101,.96),rgba(3,20,47,.98) 68%,rgba(2,13,32,.99))!important;background-position:center!important;background-size:cover!important}body.page-app .cloud-auth-screen .cloud-auth-card:after{z-index:0;pointer-events:none}@media(max-width:560px){.cloud-auth-screen{place-items:center;padding:clamp(18px,6vh,48px) 14px max(18px,env(safe-area-inset-bottom))}.cloud-auth-card{padding:26px 20px;border-radius:23px}.cloud-auth-actions{grid-template-columns:1fr;gap:10px}.cloud-auth-actions a,.cloud-auth-actions button{min-height:50px}}@media(prefers-reduced-motion:reduce){.cloud-auth-actions a,.cloud-auth-actions button{transition:none}}@supports not ((backdrop-filter:blur(1px))){.cloud-auth-card{background:linear-gradient(145deg,#0b3665,#03142f 68%,#020d20)!important;color:#f2f8ff!important}}";
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

    const verification=runtimeState.verification=(async()=>{
      const c=cloud();
      transition([STATES.WORKSPACE_READY,STATES.OFFLINE_READY,STATES.BACKGROUND_SYNC].includes(runtimeState.state)?STATES.BACKGROUND_SYNC:STATES.AUTHORIZING,{source:'workspace-verification'});
      const ready=await waitCloud(4000);
      if(!sameLocalWorkspace(local))return false;
      if(!ready||!c?.state?.client){
        if(!navigator.onLine){
          workspaceReady('offline-cache',{reason:'cloud-init-timeout'});
          return true;
        }
        console.warn('Workspace authorization could not start because the cloud session is unavailable.');
        clearLocalAuthState();
        showAccess('We could not restore your secure school session. Please retry or sign in again.',STATES.AUTH_ERROR,true);
        return false;
      }

      // admissions-cloud owns the one browser session restoration call.
      // Once whenReady() settles, a missing user is authoritative for this runtime;
      // auth-bridge must not issue a duplicate getSession request.
      const user=c.state.user||null;

      if(!user){
        const restoreStatus=String(c.state.sessionRestoreStatus||'').toLowerCase();
        const authoritativeAbsent=restoreStatus==='absent'||c.state.authEvent==='SIGNED_OUT';
        if(!navigator.onLine){
          workspaceReady('offline-cache',{reason:'offline-no-session-check'});
          return true;
        }
        if(!authoritativeAbsent){
          // A timeout/unknown restore result must not authorize private cached
          // UI while online. Keep local metadata for a possible late restore,
          // but require a successful retry or late-session verification to unlock.
          showAccess('We could not yet confirm your secure school session. Please retry or sign in again.',STATES.AUTH_ERROR,true);
          return false;
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
        if(!navigator.onLine&&['NETWORK_TIMEOUT','NETWORK_OFFLINE','SERVER_TEMPORARY_FAILURE'].includes(type)){
          workspaceReady('offline-cache',{reason:type});
          return true;
        }
        console.warn('Workspace authorization could not be verified:',error?.message||error);
        // Unknown authorization failures must fail closed. Only positively
        // classified network outages may use the explicitly supported cache path.
        clearLocalAuthState();
        showAccess('We could not verify access to this school workspace. Please retry or sign in again.',STATES.AUTH_ERROR,true);
        return false;
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

    try{return await verification}
    finally{
      if(runtimeState.verification===verification){
        runtimeState.verification=null;
        // Auth events can arrive while an older school-access request is in flight.
        // If that response becomes stale, run one fresh check instead of leaving
        // the synchronously displayed private-workspace guard stuck indefinitely.
        if(runtimeState.verificationQueued){
          runtimeState.verificationQueued=false;
          if(validLocal())scheduleWorkspaceVerification({force:true,reason:'queued-auth-recheck',delay:0});
        }
      }
    }
  }

  function scheduleWorkspaceVerification({force=false,reason='background',delay=null}={}){
    if(!validLocal())return false;
    if(runtimeState.verification){runtimeState.verificationQueued=true;return true;}
    if(runtimeState.verificationTimer)return true;
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
    const local=readLocal();
    if(validLocal(local)){
      const handoff=readHandoff();
      if(handoff){
        const cloudUser=cloud()?.state?.user||null;
        if(handoff.userId&&cloudUser?.id&&String(handoff.userId)!==String(cloudUser.id)){
          clearLocalAuthState();
          showAccess('The signed-in account changed before this school workspace opened. Sign in again and select the correct school.',STATES.AUTH_ERROR,false);
          return;
        }
        // The login flow has already verified this short-lived, school-scoped
        // handoff. Open the workspace immediately, then let the normal delayed
        // verification reconcile the live session without blocking the UI.
        workspaceReady('login-handoff',{institutionId:local.institutionId,role:local.role});
        scheduleWorkspaceVerification({reason:'login-handoff'});
        return;
      }
      if(!navigator.onLine){
        // Preserve the explicitly supported offline workspace path.
        workspaceReady('offline-cache',{institutionId:local.institutionId,role:local.role,reason:'startup-offline'});
        scheduleWorkspaceVerification({reason:'startup-offline-session'});
        return;
      }
      // A cached local identity is not proof of a live Supabase session. Keep
      // private UI covered until the current user and school access are verified.
      showAccess('Checking your secure school session. Please wait or retry the check.',STATES.AUTHORIZING,true);
      scheduleWorkspaceVerification({force:true,reason:handoff?'login-handoff':'startup-local-session',delay:0});
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
        // The login flow creates this short-lived handoff only after verifying
        // the user's school access. Supabase commonly emits INITIAL_SESSION or
        // SIGNED_IN immediately afterward; the same user event must not revoke
        // that verified handoff and cover the workspace again. USER_UPDATED is
        // intentionally excluded because profile changes require fresh review.
        if(type!=='USER_UPDATED'&&handoff?.userId&&eventUser?.id
          &&String(handoff.userId)===String(eventUser.id)){
          return;
        }
        // Auth lifecycle events can represent an account/session change. Cover
        // private school UI synchronously, before a scheduled verification can
        // yield to visibility changes or another browser event.
        showAccess('Checking your secure school session. Please wait while we verify access to this school.',STATES.AUTHORIZING,true);
        scheduleWorkspaceVerification({force:true,reason:'auth-event',delay:0});
      }else{
        restoreWithoutLocal(false).catch(()=>{});
      }
    }
  });

  window.addEventListener('online',()=>{
    if(validLocal())scheduleWorkspaceVerification({force:true,reason:'network-restored',delay:450});
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)return;
    // Returning to a tab must not remove the private-workspace guard after logout.
    if(validLocal()&&[STATES.WORKSPACE_READY,STATES.BACKGROUND_SYNC,STATES.OFFLINE_READY].includes(runtimeState.state))unlockUI();
  });

  // A session restore can finish after its startup timeout. Reconcile the
  // local workspace when that late result arrives; otherwise the app can stay
  // on an unverified local cache or leave a restored user stranded at login.
  window.addEventListener('edunizam:cloud-ready',event=>{
    const eventName=event.detail?.event;
    if(!['LATE_SESSION_RESTORE','LATE_SESSION_RESTORE_ERROR'].includes(eventName))return;
    const recheck=()=>{
      const c=cloud();
      if(eventName==='LATE_SESSION_RESTORE_ERROR'&&!c?.state?.user){
        // A failed restore is not proof that a cached private workspace is still
        // authorized. Keep the cache only for an explicitly offline session.
        if(!navigator.onLine&&validLocal()){
          workspaceReady('offline-cache',{reason:'session-restore-error-offline'});
          return;
        }
        clearLocalAuthState();
        showAccess('We could not restore your secure school session. Please retry or sign in again.',STATES.AUTH_ERROR,true);
        return;
      }
      if(validLocal()){
        verifyCurrentWorkspace(true).catch(error=>console.warn('Late session restore verification:',error?.message||error));
        return;
      }
      if(c?.state?.user){
        restoreWithoutLocal(true).catch(error=>console.warn('Late session workspace restore:',error?.message||error));
        return;
      }
      showAccess('Sign in to open your private school workspace, or continue as Guest for public learning resources.',STATES.UNAUTHENTICATED,false);
    };
    const pending=runtimeState.verification;
    if(pending)pending.then(()=>setTimeout(recheck,0),()=>setTimeout(recheck,0));
    else recheck();
  });

  // Logout is handled centrally even if roleSession is mounted after startup.
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('#roleSession button');
    if(!btn)return;
    event.preventDefault();
    const c=cloud();
    // Close the local school session immediately; network sign-out must not
    // leave private workspace UI available while Supabase is responding.
    clearLocalAuthState();
    showAccess('You have signed out. Sign in again, or continue as Guest.',STATES.UNAUTHENTICATED,false);
    Promise.resolve().then(()=>c?.signOut?.()).catch(error=>{
      console.warn('Supabase sign-out could not be confirmed:',error?.message||error);
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