(function(){
  // Install the mobile accordion controller before the larger application
  // scripts register document/window click handlers. This keeps summary taps
  // reliable even when later shell handlers stop propagation.
  if(!window.__EDUNIZAM_MOBILE_ACCORDION_HANDLER__){
    window.addEventListener('click',event=>{
      if(window.innerWidth>950)return;
      const summary=event.target?.closest?.('#nav > details.nav-group > summary');
      const group=summary?.parentElement;
      const nav=document.getElementById('nav');
      if(!group||!nav||group.parentElement!==nav)return;
      const shouldOpen=!group.open;
      event.preventDefault();
      event.stopImmediatePropagation();
      nav.querySelectorAll(':scope > details.nav-group[open]').forEach(other=>{
        if(other!==group)other.open=false;
      });
      group.open=shouldOpen;
      nav.querySelectorAll(':scope > details.nav-group').forEach(item=>{
        item.querySelector(':scope > summary')?.setAttribute('aria-expanded',String(item.open));
      });
    },true);
    window.__EDUNIZAM_MOBILE_ACCORDION_HANDLER__=true;
  }
  const $=s=>document.querySelector(s);
  let controller=null;

  function mount(){
    const sidebar=$('.sidebar'),topbar=$('.topbar');
    if(!sidebar||!topbar)return null;

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
      const shouldOpen=!!open&&window.innerWidth<=950;
      sidebar.classList.toggle('mobile-nav-open',shouldOpen);
      backdrop.classList.toggle('show',shouldOpen);
      backdrop.style.display=shouldOpen?'block':'none';
      backdrop.style.pointerEvents=shouldOpen?'auto':'none';
      backdrop.style.visibility=shouldOpen?'visible':'hidden';
      backdrop.setAttribute('aria-hidden',String(!shouldOpen));
      document.body.classList.toggle('mobile-nav-lock',shouldOpen);
      menu.setAttribute('aria-expanded',String(shouldOpen));
    };

    if(menu.dataset.mobileCore!=='1'){
      menu.dataset.mobileCore='1';
      menu.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        setOpen(!sidebar.classList.contains('mobile-nav-open'));
      });
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
        if(event.target.closest('.nav-item')&&window.innerWidth<=950)setOpen(false);
      });
    }

    controller={
      open:()=>setOpen(true),
      close:()=>setOpen(false),
      toggle:()=>setOpen(!sidebar.classList.contains('mobile-nav-open')),
      reconcile:()=>setOpen(window.innerWidth<=950&&sidebar.classList.contains('mobile-nav-open'))
    };
    // Re-mounts during auth/background loading must not close an open drawer.
    setOpen(sidebar.classList.contains('mobile-nav-open'));
    return controller;
  }

  const boot=()=>{controller=mount()||controller};
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