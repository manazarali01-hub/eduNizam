(function(){
  const $=s=>document.querySelector(s);
  let mountedSidebar=null;
  let mountedTopbar=null;
  let sidebarHome=null;
  let menuHome=null;
  let lastPointerActivationAt=0;
  const isCompactNav=()=>window.innerWidth<=950 || (window.innerWidth<=1100 && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches);

  function ensureElements(){
    const sidebar=$('.sidebar'),topbar=$('.topbar');
    if(!sidebar||!topbar||!document.body)return null;

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
    if(isCompactNav()&&menu.parentNode!==document.body){
      if(!menuHome){menuHome=document.createComment('edu-mobile-menu-home');menu.parentNode?.insertBefore(menuHome,menu);}
      document.body.appendChild(menu);
    }else if(!isCompactNav()&&menuHome){
      menuHome.parentNode?.insertBefore(menu,menuHome);menuHome.remove();menuHome=null;
    }
    if(menu.dataset.mobileCore!=='1'){
      menu.dataset.mobileCore='1';
      menu.addEventListener('click',event=>{
        if(event.defaultPrevented)return;
        event.preventDefault();
        toggle();
      });
    }
    menu.style.touchAction='manipulation';
    menu.style.position=isCompactNav()?'fixed':'relative';
    menu.style.left=isCompactNav()?'14px':'';
    menu.style.top=isCompactNav()?'14px':'';
    menu.style.width=isCompactNav()?'48px':'';
    menu.style.height=isCompactNav()?'48px':'';
    menu.style.zIndex=isCompactNav()?'1105':'1006';
    menu.style.pointerEvents='auto';
    // Keep the interactive header above the dashboard content's stacking layer.
    topbar.style.position='sticky';
    topbar.style.top='0';
    topbar.style.zIndex='1005';
    topbar.style.isolation='isolate';

    let close=$('#eduMobileNavClose');
    if(!close||!sidebar.contains(close)){
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
    mountedSidebar=sidebar;
    mountedTopbar=topbar;
    return {sidebar,topbar,menu,close,backdrop};
  }

  function setOpen(open){
    const nodes=ensureElements();
    if(!nodes)return false;
    const {sidebar,menu,close,backdrop}=nodes;
    const shouldOpen=!!open&&isCompactNav();
    if(shouldOpen&&!sidebarHome){
      sidebarHome=document.createComment('edu-mobile-sidebar-home');
      sidebar.parentNode?.insertBefore(sidebarHome,sidebar);
      document.body.appendChild(sidebar);
    }
    sidebar.classList.toggle('mobile-nav-open',shouldOpen);
    // Apply the drawer geometry directly as well as through CSS. This avoids
    // transformed app-shell ancestors pushing the close control off-screen.
    const set=(el,property,value)=>el.style.setProperty(property,value,'important');
    if(shouldOpen){
      set(sidebar,'position','fixed');set(sidebar,'left','0');set(sidebar,'top','0');
      set(sidebar,'right','auto');set(sidebar,'bottom','0');
      set(sidebar,'width','min(292px,82vw)');set(sidebar,'max-width','82vw');
      set(sidebar,'height','100vh');set(sidebar,'max-height','100vh');
      set(sidebar,'transform','translate3d(0,0,0)');set(sidebar,'visibility','visible');
      set(sidebar,'z-index','1102');set(sidebar,'overflow-y','auto');
      // The authenticated topbar must sit behind the drawer while open.
      set(nodes.topbar,'z-index','999');
      set(close,'position','absolute');set(close,'top','16px');set(close,'right','14px');
      set(close,'display','grid');set(close,'visibility','visible');
      set(close,'width','44px');set(close,'height','44px');set(close,'z-index','1004');
      set(close,'pointer-events','auto');
    }else{
      ['position','left','top','right','bottom','width','max-width','height','max-height','transform','visibility','z-index','overflow-y'].forEach(p=>sidebar.style.removeProperty(p));
      nodes.topbar.style.removeProperty('z-index');
      nodes.topbar.style.zIndex='1005';
      ['position','top','right','display','visibility','width','height','z-index','pointer-events'].forEach(p=>close.style.removeProperty(p));
    }
    backdrop.classList.toggle('show',shouldOpen);
    backdrop.style.display=shouldOpen?'block':'none';
    backdrop.style.pointerEvents=shouldOpen?'auto':'none';
    backdrop.style.visibility=shouldOpen?'visible':'hidden';
    backdrop.setAttribute('aria-hidden',String(!shouldOpen));
    document.body.classList.toggle('mobile-nav-lock',shouldOpen);
    document.body.classList.toggle('edu-mobile-nav-open',shouldOpen);
    if(!shouldOpen&&sidebarHome){
      sidebarHome.parentNode?.insertBefore(sidebar,sidebarHome);
      sidebarHome.remove();
      sidebarHome=null;
    }
    menu.setAttribute('aria-expanded',String(shouldOpen));
    menu.setAttribute('aria-label',shouldOpen?'Close navigation':'Open navigation');
    return shouldOpen;
  }

  function toggle(){
    const sidebar=$('.sidebar');
    return setOpen(!sidebar?.classList.contains('mobile-nav-open'));
  }

  function boot(){
    const nodes=ensureElements();
    if(!nodes)return null;
    // Preserve an already-open drawer if the auth shell was refreshed.
    setOpen(nodes.sidebar.classList.contains('mobile-nav-open'));
    return api;
  }

  // One delegated capture path always targets the currently mounted shell.
  if(!document.documentElement.dataset.eduMobileNavDelegated){
    document.documentElement.dataset.eduMobileNavDelegated='1';
    document.addEventListener('pointerdown',event=>{
      const trigger=event.target.closest?.('#eduMobileMenuBtn,.mobile-menu-btn');
      if(!trigger)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      lastPointerActivationAt=Date.now();
      toggle();
    },true);
    document.addEventListener('click',event=>{
      const trigger=event.target.closest?.('#eduMobileMenuBtn');
      if(trigger){
        event.preventDefault();
        event.stopImmediatePropagation();
        if(Date.now()-lastPointerActivationAt<900)return;
        toggle();
        return;
      }
      if(event.target.closest?.('#eduMobileNavClose')){
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        return;
      }
      if(event.target.closest?.('#eduMobileNavBackdrop')){
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        return;
      }
      if(event.target.closest?.('.sidebar .nav-item')&&isCompactNav())setOpen(false);
    },true);
  }

  const api={
    mount:boot,
    open:()=>setOpen(true),
    close:()=>setOpen(false),
    toggle,
    reconcile:()=>{
      const sidebar=$('.sidebar');
      if(!isCompactNav())setOpen(false);
      else if(sidebar?.classList.contains('mobile-nav-open'))setOpen(true);
    }
  };
  const shellObserver=new MutationObserver(()=>{
    const nodes=ensureElements();
    if(!nodes)return;
    // On compact screens the menu button is deliberately mounted directly
    // under body, not inside the topbar. Treat that as the expected location;
    // otherwise every observer pass calls boot(), which moves the button to
    // body again and can create a continuous mutation/boot loop.
    const menu=$('#eduMobileMenuBtn');
    const menuMounted=isCompactNav()
      ? menu?.parentNode===document.body
      : nodes.topbar.contains(menu);
    if(nodes.sidebar!==mountedSidebar||nodes.topbar!==mountedTopbar||
       !nodes.sidebar.contains($('#eduMobileNavClose'))||!menuMounted)boot();
  });
  const observeShell=()=>{if(document.body)shellObserver.observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',observeShell,{once:true});
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    observeShell();
    boot();
  }
  addEventListener('resize',api.reconcile);
  addEventListener('pageshow',event=>{if(event.persisted){boot();api.close()}else boot()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)api.reconcile()});
  window.EDUNIZAM_MOBILE_NAV_CORE=api;
})();