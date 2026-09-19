(function(){
  const LOCAL_KEY='edunizam_session';
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const mapRole=r=>r==='head_of_institute'?'head':(['student','parent','teacher','head'].includes(r)?r:'student');

  function configured(){
    const c=cloud();
    return !!(cfg().enabled&&c?.ready?.()&&c?.state?.client);
  }
  function removeDemoLogin(){document.getElementById('edunizamLogin')?.remove()}
  function setLocalSession(role,identity){
    localStorage.setItem(LOCAL_KEY,JSON.stringify({role:mapRole(role),identity:identity||'',loginAt:Date.now(),source:'supabase'}));
  }
  async function syncCloudRole(){
    const c=cloud();
    if(!configured()||!c.state.user)return false;
    const role=await c.getMyRole();
    setLocalSession(role,c.state.user.email||c.state.user.id);
    removeDemoLogin();
    return true;
  }
  function style(){
    if(document.getElementById('cloudAuthBridgeStyle'))return;
    const s=document.createElement('style');s.id='cloudAuthBridgeStyle';
    s.textContent='.cloud-auth-screen{position:fixed;inset:0;z-index:10050;background:linear-gradient(135deg,#071b33,#0f766e);display:grid;place-items:center;padding:20px}.cloud-auth-card{width:min(520px,100%);background:#fff;border-radius:24px;padding:28px;box-shadow:0 28px 80px #001a}.cloud-auth-card h1{margin:0 0 6px;color:#0b2748}.cloud-auth-card p{color:#536579}.cloud-auth-grid{display:grid;gap:11px}.cloud-auth-grid input,.cloud-auth-grid select{width:100%;box-sizing:border-box}.cloud-auth-actions{display:flex;gap:10px;flex-wrap:wrap}.cloud-auth-note{margin-top:12px;padding:10px 12px;border-radius:12px;background:#f3f8fb;color:#466071;font-size:13px}.cloud-auth-error{color:#9b1c1c;min-height:20px;font-size:13px}';
    document.head.appendChild(s);
  }
  function authScreen(){
    if(document.getElementById('edunizamCloudAuth'))return;
    style();removeDemoLogin();
    const box=document.createElement('div');box.id='edunizamCloudAuth';box.className='cloud-auth-screen';
    box.innerHTML='<div class="cloud-auth-card"><div class="academic-kicker">EduNizam Cloud Access</div><h1>Secure sign in</h1><p>Apna registered email aur password use karein. Student/Parent naya account bana sakte hain; Teacher/Head role institute se assign hota hai.</p><div class="cloud-auth-grid"><input id="cloudAuthName" placeholder="Full name (signup ke liye)"><input id="cloudAuthEmail" type="email" placeholder="Email address"><input id="cloudAuthPassword" type="password" placeholder="Password"><select id="cloudAuthRole"><option value="student">Student</option><option value="parent">Parent / Guardian</option></select><div class="cloud-auth-actions"><button id="cloudSignIn">Sign in</button><button id="cloudSignUp" class="secondary">Create account</button><button id="cloudMagic" class="secondary">Email login link</button></div><div id="cloudAuthError" class="cloud-auth-error"></div></div><div class="cloud-auth-note">Demo role selector automatically band ho jata hai jab Supabase cloud config enable ho.</div></div>';
    document.body.appendChild(box);
    const email=()=>box.querySelector('#cloudAuthEmail').value.trim();
    const pass=()=>box.querySelector('#cloudAuthPassword').value;
    const err=m=>box.querySelector('#cloudAuthError').textContent=m||'';
    box.querySelector('#cloudSignIn').onclick=async()=>{try{err('Signing in...');const r=await cloud().signIn(email(),pass());if(r?.error)throw r.error;await syncCloudRole();location.reload()}catch(e){err(e.message||String(e))}};
    box.querySelector('#cloudSignUp').onclick=async()=>{try{err('Creating account...');const role=box.querySelector('#cloudAuthRole').value,name=box.querySelector('#cloudAuthName').value.trim();const r=await cloud().signUp(email(),pass(),role,name);if(r?.error)throw r.error;err('Account created. Email verification required ho to inbox check karein.')}catch(e){err(e.message||String(e))}};
    box.querySelector('#cloudMagic').onclick=async()=>{try{err('Sending login link...');const r=await cloud().sendMagicLink(email());if(r?.error)throw r.error;err('Login link email par bhej diya gaya.')}catch(e){err(e.message||String(e))}};
  }
  async function boot(){
    if(!configured())return;
    removeDemoLogin();
    if(cloud().state.user){
      try{await syncCloudRole();document.getElementById('edunizamCloudAuth')?.remove()}catch(e){console.warn('Cloud role sync:',e.message)}
    }else authScreen();
    setTimeout(()=>{
      const btn=document.querySelector('#roleSession button');
      if(btn)btn.onclick=async()=>{try{await cloud().signOut()}finally{localStorage.removeItem(LOCAL_KEY);location.reload()}};
    },50);
  }
  window.addEventListener('edunizam:auth',()=>setTimeout(boot,0));
  setTimeout(boot,0);
  setTimeout(boot,500);
  window.EDUNIZAM_AUTH_BRIDGE={configured,syncCloudRole};
})();