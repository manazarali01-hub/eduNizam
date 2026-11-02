(function(){
  const $=s=>document.querySelector(s);
  let controller=null;
  let activeSetOpen=null;
  let suppressMenuClickUntil=0;
  let mountedSidebar=null;
  let mountedTopbar=null;

  const isCompactNav=()=>window.innerWidth<=950 || (window.innerWidth<=1100 && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches);

  function mount(){
    const sidebar=$('.sidebar'),topbar=$('.topbar');
    if(!sidebar||!topbar)return null;
    mountedSidebar=sidebar;
    mountedTopbar=topbar;

    let menu=$('#eduMobileMenuBtn');
    if(!menu){
      menu=document.createElement('button');
      menu.id='eduMobileMenuBtn';
      menu.className='mobile-menu-btn';
      menu.type='button';
      menu.setAttribute('aria-label','Open navigation');
      menu.setAttribute('aria-expanded','false');
      menu.innerHTML='<span aria-hidden="true">☰</span>';
      topbar.insertBefore(menu,topbar.firstChild);
    }
    menu.style.touchAction='manipulation';
    menu.style.position='relative';
    menu.style.zIndex='4';

    let close=$('#eduMobileNavClose');
    if(!close){
      close=document.createElement('button');
      close.id='eduMobileNavClose';
      close.className='mobile-nav-close';
      close.type='button';
      close.setAttribute('aria-label','Close navigation');
      close.innerHTML='<span aria-hidden="true">×</span>';
      sidebar.appendChild(close);
    }
    close.style.touchAction='manipulation';

    let backdrop=$('#eduMobileNavBackdrop');
    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.id='eduMobileNavBackdrop';
      backdrop.className='mobile-nav-backdrop';
      backdrop.setAttribute('aria-hidden','true');
      document.body.appendChild(backdrop);
    }

    const setOpen=open=>{
      const shouldOpen=!!open&&isCompactNav();
      sidebar.classList.toggle('mobile-nav-open',shouldOpen);
      backdrop.classList.toggle('show',shouldOpen);
      backdrop.style.display=shouldOpen?'block':'none';
      backdrop.style.pointerEvents=shouldOpen?'auto':'none';
      backdrop.style.visibility=shouldOpen?'visible':'hidden';
      backdrop.setAttribute('aria-hidden',String(!shouldOpen));
      document.body.classList.toggle('mobile-nav-lock',shouldOpen);
      document.body.classList.toggle('edu-mobile-nav-open',shouldOpen);
      menu.setAttribute('aria-expanded',String(shouldOpen));
    };

    activeSetOpen=setOpen;
    // Retain a local click fallback for environments without Pointer Events.
    if(menu.dataset.mobileCore!=='1'){
      menu.dataset.mobileCore='1';
      menu.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        setOpen(!sidebar.classList.contains('mobile-nav-open'));
      });
    }
    // Capture touch/pointer input at document level so later UI scripts or
    // overlapping topbar layers cannot swallow the mobile menu activation.
    if(!document.documentElement.dataset.eduMobileMenuCapture){
      document.documentElement.dataset.eduMobileMenuCapture='1';
      document.addEventListener('pointerdown',event=>{
        const trigger=event.target.closest?.('#eduMobileMenuBtn');
        if(!trigger||!activeSetOpen)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressMenuClickUntil=Date.now()+800;
        activeSetOpen(!document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'));
      },true);
      document.addEventListener('click',event=>{
        const trigger=event.target.closest?.('#eduMobileMenuBtn');
        if(!trigger||!activeSetOpen)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if(Date.now()<suppressMenuClickUntil)return;
        activeSetOpen(!document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'));
      },true);
    }
    if(close.dataset.mobileCore!=='1'){
      close.dataset.mobileCore='1';
      close.addEventListener('click',event=>{event.preventDefault();setOpen(false)});
    }
    if(backdrop.dataset.mobileCore!=='1'){
      backdrop.dataset.mobileCore='1';
      backdrop.addEventListener('click',()=>setOpen(false));
    }
    if(sidebar.dataset.mobileCore!=='1'){
      sidebar.dataset.mobileCore='1';
      sidebar.addEventListener('click',event=>{
        if(event.target.closest('.nav-item')&&isCompactNav())setOpen(false);
      });
    }

    controller={
      open:()=>setOpen(true),
      close:()=>setOpen(false),
      toggle:()=>setOpen(!sidebar.classList.contains('mobile-nav-open')),
      reconcile:()=>setOpen(isCompactNav()&&sidebar.classList.contains('mobile-nav-open'))
    };
    // Re-mounts during auth/background loading must not close an open drawer.
    setOpen(sidebar.classList.contains('mobile-nav-open'));
    return controller;
  }

  const boot=()=>{controller=mount()||controller};
  // Auth transitions can replace the dashboard shell after initial page load.
  // Rebind the controller to the live sidebar/topbar instead of stale nodes.
  const shellObserver=new MutationObserver(()=>{
    const sidebar=$('.sidebar'),topbar=$('.topbar');
    if(sidebar&&topbar&&(sidebar!==mountedSidebar||topbar!==mountedTopbar))boot();
  });
  const observeShell=()=>{if(document.body)shellObserver.observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeShell,{once:true});else observeShell();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  addEventListener('resize',()=>controller?.reconcile?.());
  addEventListener('pageshow',event=>{
    // Only a back-forward cache restore should reset an already-open drawer.
    // A delayed initial pageshow must never cancel a user's first menu tap.
    if(event.persisted){boot();controller?.close?.();}
    else if(!controller)boot();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)controller?.reconcile?.()});

  window.EDUNIZAM_MOBILE_NAV_CORE={
    mount:boot,
    open:()=>{if(!controller)boot();controller?.open?.()},
    close:()=>{if(!controller)boot();controller?.close?.()},
    toggle:()=>{if(!controller)boot();controller?.toggle?.()},
    reconcile:()=>{if(!controller)boot();controller?.reconcile?.()}
  };
})();