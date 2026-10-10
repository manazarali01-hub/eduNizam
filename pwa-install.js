(()=>{
  let deferredPrompt=null;
  const installSelector='[data-pwa-install],#installBtn';

  function installed(){
    return window.matchMedia?.('(display-mode: standalone)').matches===true ||
      window.navigator.standalone===true;
  }
  function buttons(){
    return [...document.querySelectorAll(installSelector)];
  }
  function setVisible(show){
    buttons().forEach(btn=>{
      btn.hidden=!show;
      btn.classList.toggle('hidden',!show);
      btn.setAttribute('aria-hidden',show?'false':'true');
    });
  }
  function manualHelp(){
    const ua=navigator.userAgent||'';
    const ios=/iPad|iPhone|iPod/.test(ua);
    const android=/Android/i.test(ua);
    if(ios){
      alert('Install EduNizam: browser Share button open karein, phir “Add to Home Screen” select karein.');
      return;
    }
    if(android){
      alert('Install EduNizam: Chrome menu (⋮) open karein, phir “Install app” ya “Add to Home screen” select karein. Agar native install prompt ready ho to Install App button dobara tap karein.');
      return;
    }
    alert('Browser menu mein “Install EduNizam”, “Install app” ya “Create shortcut” option use karein.');
  }
  async function requestInstall(){
    if(installed()){setVisible(false);return}
    if(!deferredPrompt){manualHelp();return}
    deferredPrompt.prompt();
    try{await deferredPrompt.userChoice}catch(_){}
    deferredPrompt=null;
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    setVisible(!installed());
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    setVisible(false);
  });

  document.addEventListener('click',event=>{
    const btn=event.target.closest?.(installSelector);
    if(!btn)return;
    event.preventDefault();
    requestInstall();
  });

  // A resumed installed home can retain a stale, desktop-sized visual layout.
  // Detect the actual defect rather than reloading healthy pages unconditionally.
  // One network navigation per session avoids a reload loop on poor connections.
  const LAUNCH='20261008-v36';
  function repairStaleHomeIfNeeded(){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    if(!window.matchMedia('(max-width:1024px)').matches || !navigator.onLine)return;
    const visual=document.querySelector('.hero-visual');
    const quick=document.querySelector('.quick-access-card');
    if(!visual || !quick)return;
    const width=visual.getBoundingClientRect().width;
    const card=quick.getBoundingClientRect().width;
    if(width<220 || card>=width*.83)return;
    const key='edu-home-layout-retry-'+LAUNCH;
    try{
      if(sessionStorage.getItem(key)==='1')return;
      sessionStorage.setItem(key,'1');
    }catch(_){
      if(location.search.includes('edu_layout_retry=1'))return;
    }
    const next=new URL(location.href);
    next.searchParams.set('edu_pwa_launch',LAUNCH);
    next.searchParams.set('edu_layout_retry','1');
    location.replace(next.href);
  }

  function boot(){
    setVisible(!installed());
    // Registration must not wait for large background photos / advertising
    // resources. The SW's network-first navigation protects the cold launch.
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js?v=20261010-auth-race-v45',{updateViaCache:'none'})
        .then(reg=>reg.update())
        .catch(()=>{});
    }
    // Check once after layout, and again on Android PWA resume.
    requestAnimationFrame(()=>requestAnimationFrame(repairStaleHomeIfNeeded));
    window.addEventListener('pageshow',()=>{
      requestAnimationFrame(repairStaleHomeIfNeeded);
    });
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden)requestAnimationFrame(repairStaleHomeIfNeeded);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
