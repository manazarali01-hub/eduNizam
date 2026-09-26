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

  function boot(){
    setVisible(!installed());
    if('serviceWorker' in navigator){
      window.addEventListener('load',()=>{
        navigator.serviceWorker.register('./sw.js?v=20260926-pwa152',{updateViaCache:'none'})
          .then(reg=>reg.update())
          .catch(()=>{});
      },{once:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();