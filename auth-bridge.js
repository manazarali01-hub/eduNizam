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
        clearLocalAuthState();
        window.dispatchEvent(new CustomEvent(role==='head_of_institute'?'edunizam:school-selection-required':'edunizam:auth-invalid'));
        return false;
      }
    }
    removeDemoLogin();
    return true;
  }
  function style(){
    if(document.getElementById('cloudAuthBridgeStyle'))return;
    const s=document.createElement('style');s.id='cloudAuthBridgeStyle';
    s.textContent='.cloud-auth-screen{position:fixed;inset:0;z-index:10050;background:linear-gradient(135deg,#071b33,#0f766e);display:grid;place-items:center;padding:20px}.cloud-auth-card{width:min(560px,100%);background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 80px #001a}.cloud-auth-card h1{margin:0 0 6px;color:#0b2748}.cloud-auth-card p{color:#536579}.cloud-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}.cloud-auth-tabs button{background:#f1f5f9;color:#334155;border:1px solid #dbe4ea}.cloud-auth-tabs button.active{background:#0f766e;color:#fff;border-color:#0f766e}.cloud-auth-grid{display:grid;gap:11px}.cloud-auth-grid input,.cloud-auth-grid select{width:100%;box-sizing:border-box}.cloud-auth-actions{display:flex;gap:10px;flex-wrap:wrap}.cloud-auth-note{margin-top:12px;padding:10px 12px;border-radius:12px;background:#f3f8fb;color:#466071;font-size:13px}.cloud-auth-error{color:#9b1c1c;min-height:20px;font-size:13px}.cloud-auth-success{color:#166534}.cloud-admin-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:700}@media(max-width:560px){.cloud-auth-card{padding:20px}.cloud-auth-tabs{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function authScreen(){
    removeDemoLogin();
  }

  async function boot(){
    if(!configured())return;
    const c=cloud();
    removeDemoLogin();

    try{
      const {data,error}=await c.state.client.auth.getSession();
      if(error)throw error;
      const authUser=data?.session?.user||null;
      if(!authUser){
        clearLocalAuthState();
        window.dispatchEvent(new CustomEvent('edunizam:auth-invalid'));
        return;
      }
      c.state.user=authUser;
      await syncCloudRole();
    }catch(e){
      console.warn('Cloud session guard:',e.message||e);
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
  setTimeout(boot,0);
  setTimeout(boot,500);
  window.EDUNIZAM_AUTH_BRIDGE={configured,syncCloudRole,clearLocalAuthState};
})();