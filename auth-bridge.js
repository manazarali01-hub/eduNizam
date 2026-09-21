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
    localStorage.setItem('edunizam_cloud_user_id',c.state.user.id);
    setLocalSession(role,c.state.user.email||c.state.user.id);
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
    if(document.getElementById('edunizamCloudAuth'))return;
    style();removeDemoLogin();
    const box=document.createElement('div');box.id='edunizamCloudAuth';box.className='cloud-auth-screen';
    box.innerHTML='<div class="cloud-auth-card"><div class="academic-kicker">EduNizam Secure Access</div><span class="cloud-admin-badge">Protected role-based login</span><h1 id="cloudAuthTitle">School Admin Login</h1><p id="cloudAuthIntro">Sirf EduNizam se verified school owner/head account ko Admin access milta hai. EMIS ya school code akela Admin access nahi deta.</p><div class="cloud-auth-tabs"><button id="cloudAdminTab" class="active">School Admin</button><button id="cloudUserTab" class="secondary">Student / Parent</button></div><div class="cloud-auth-grid"><input id="cloudAuthName" placeholder="Full name (new account only)"><input id="cloudAuthEmail" type="email" autocomplete="email" placeholder="Registered email address"><input id="cloudAuthPassword" type="password" autocomplete="current-password" minlength="6" placeholder="Password"><select id="cloudAuthRole"><option value="student">Student</option><option value="parent">Parent / Guardian</option></select><div class="cloud-auth-actions"><button id="cloudSignIn">Sign in as School Admin</button><button id="cloudSignUp" class="secondary">Create verification account</button><button id="cloudResend" class="secondary">Resend verification email</button><button id="cloudMagic" class="secondary">Email login link</button><button id="cloudForgot" class="secondary">Forgot password</button></div><div id="cloudAuthError" class="cloud-auth-error"></div></div><div id="cloudAuthNote" class="cloud-auth-note"><strong>First-time Admin:</strong> account banane ke baad sign in karein aur School Admin verification request submit karein. Approval ke baad hi Admin dashboard unlock hoga.</div></div>';
    document.body.appendChild(box);

    let mode='admin';
    const email=()=>box.querySelector('#cloudAuthEmail').value.trim();
    const pass=()=>box.querySelector('#cloudAuthPassword').value;
    const err=(m,ok=false)=>{const el=box.querySelector('#cloudAuthError');el.textContent=m||'';el.classList.toggle('cloud-auth-success',!!ok)};
    const adminTab=box.querySelector('#cloudAdminTab'),userTab=box.querySelector('#cloudUserTab');
    const nameInput=box.querySelector('#cloudAuthName'),roleSelect=box.querySelector('#cloudAuthRole');
    const signInBtn=box.querySelector('#cloudSignIn'),signUpBtn=box.querySelector('#cloudSignUp');
    const title=box.querySelector('#cloudAuthTitle'),intro=box.querySelector('#cloudAuthIntro'),note=box.querySelector('#cloudAuthNote');

    function paintMode(next){
      mode=next;
      const admin=mode==='admin';
      adminTab.classList.toggle('active',admin);userTab.classList.toggle('active',!admin);
      nameInput.style.display=admin?'block':'block';
      roleSelect.style.display=admin?'none':'block';
      title.textContent=admin?'School Admin Login':'Student / Parent Login';
      intro.textContent=admin
        ?'Sirf EduNizam se verified school owner/head account ko Admin access milta hai. EMIS ya school code akela Admin access nahi deta.'
        :'Apna registered account use karein. Naya Student/Parent account bhi yahan ban sakta hai.';
      signInBtn.textContent=admin?'Sign in as School Admin':'Sign in';
      signUpBtn.textContent=admin?'Create verification account':'Create account';
      note.innerHTML=admin
        ?'<strong>First-time Admin:</strong> account banane ke baad sign in karein aur School Admin verification request submit karein. Approval ke baad hi Admin dashboard unlock hoga.'
        :'<strong>Student/Parent:</strong> role signup par set hota hai. Staff roles user khud select nahi kar sakta.';
      err('');
    }
    adminTab.onclick=()=>paintMode('admin');
    userTab.onclick=()=>paintMode('user');

    signInBtn.onclick=async()=>{
      try{
        if(!email()||!pass())return err('Email aur password required hain.');
        err('Signing in...');
        const r=await cloud().signIn(email(),pass());if(r?.error)throw r.error;
        const actualRole=await cloud().getMyRole();

        if(mode==='admin'){
          if(actualRole==='head_of_institute'){
            await syncCloudRole();location.reload();return;
          }
          const list=await cloud().listMyInstitutions?.()||[];
          if(list.length){
            await cloud().signOut();
            return err('Ye account School Admin nahi hai. Sirf verified owner/head account Admin dashboard khol sakta hai.');
          }
          box.remove();
          const ok=await window.EDUNIZAM_CLOUD_SETUP?.ensureInstitution?.();
          if(ok===true){
            const role=await cloud().getMyRole();
            if(role==='head_of_institute'){await syncCloudRole();location.reload()}
          }
          return;
        }

        await syncCloudRole();location.reload();
      }catch(e){err(e.message||String(e))}
    };

    signUpBtn.onclick=async()=>{
      try{
        if(!email()||!pass())return err('Email aur password required hain.');
        const name=nameInput.value.trim();
        const role=mode==='admin'?'student':roleSelect.value;
        err('Creating account...');
        const r=await cloud().signUp(email(),pass(),role,name);if(r?.error)throw r.error;
        const data=r?.data||{};
        if(data?.session){
          err('Account active ho gaya hai. Is Supabase project mein email confirmation required nahi lag rahi; aap ab Sign in kar sakte hain.',true);
        }else if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
          err('Is email ka account pehle se maujood ho sakta hai. Sign in try karein, ya Resend verification email use karein.',true);
        }else{
          err('Account create request successful hai. Verification email Supabase ne queue ki hai. Inbox ke sath Spam/Promotions bhi check karein; na mile to Resend verification email dabayen.',true);
        }
      }catch(e){err(e.message||String(e))}
    };

    box.querySelector('#cloudResend').onclick=async()=>{
      try{
        if(!email())return err('Email address enter karein.');
        err('Resending verification email...');
        const r=await cloud().resendSignupConfirmation(email());if(r?.error)throw r.error;
        err('Verification email dobara request kar di gayi hai. Inbox, Spam aur Promotions check karein. Agar Supabase rate limit ho to thori dair baad retry karein.',true);
      }catch(e){err(e.message||String(e))}
    };
    box.querySelector('#cloudMagic').onclick=async()=>{
      try{if(!email())return err('Email address enter karein.');err('Sending login link...');const r=await cloud().sendMagicLink(email());if(r?.error)throw r.error;err('Login link email par bhej diya gaya.',true)}catch(e){err(e.message||String(e))}
    };
    box.querySelector('#cloudForgot').onclick=async()=>{
      try{if(!email())return err('Email address enter karein.');err('Sending reset link...');const r=await cloud().sendPasswordReset(email());if(r?.error)throw r.error;err('Password reset link email par bhej diya gaya.',true)}catch(e){err(e.message||String(e))}
    };
    paintMode('admin');
  }

  async function boot(){
    if(!configured())return;
    removeDemoLogin();
    if(cloud().state.user){
      try{const ok=await window.EDUNIZAM_CLOUD_SETUP?.ensureInstitution?.();if(ok!==false){await syncCloudRole();document.getElementById('edunizamCloudAuth')?.remove()}}catch(e){console.warn('Cloud role sync:',e.message)}
    }else authScreen();
    setTimeout(()=>{
      const btn=document.querySelector('#roleSession button');
      if(btn)btn.onclick=async()=>{try{await cloud().signOut()}finally{localStorage.removeItem(LOCAL_KEY);localStorage.removeItem('edunizam_cloud_user_id');location.reload()}};
    },50);
  }
  window.addEventListener('edunizam:auth',()=>setTimeout(boot,0));
  setTimeout(boot,0);
  setTimeout(boot,500);
  window.EDUNIZAM_AUTH_BRIDGE={configured,syncCloudRole};
})();