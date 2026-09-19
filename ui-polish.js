(function(){
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const $=selector=>document.querySelector(selector);

  function addProgressBar(){
    if($('#eduScrollProgress'))return;
    const bar=document.createElement('div');
    bar.id='eduScrollProgress';
    bar.className='edu-scroll-progress';
    bar.setAttribute('aria-hidden','true');
    document.body.appendChild(bar);
    const update=()=>{
      const height=document.documentElement.scrollHeight-innerHeight;
      bar.style.transform='scaleX('+(height>0?Math.min(1,scrollY/height):0)+')';
    };
    addEventListener('scroll',update,{passive:true});
    addEventListener('resize',update);
    update();
  }

  function addBackToTop(){
    if($('#eduBackTop'))return;
    const button=document.createElement('button');
    button.id='eduBackTop';
    button.className='edu-back-top';
    button.type='button';
    button.setAttribute('aria-label','Back to top');
    button.innerHTML='<span aria-hidden="true">↑</span>';
    button.onclick=()=>scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'});
    document.body.appendChild(button);
    const update=()=>button.classList.toggle('show',scrollY>520);
    addEventListener('scroll',update,{passive:true});
    update();
  }

  function ripple(event){
    const button=event.target.closest('button');
    if(!button||button.disabled||reduceMotion)return;
    const rect=button.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*1.5;
    const dot=document.createElement('span');
    dot.className='edu-ripple';
    dot.style.width=dot.style.height=size+'px';
    dot.style.left=(event.clientX-rect.left-size/2)+'px';
    dot.style.top=(event.clientY-rect.top-size/2)+'px';
    button.appendChild(dot);
    dot.addEventListener('animationend',()=>dot.remove(),{once:true});
  }

  function reveal(view){
    if(!view||reduceMotion)return;
    const items=[...view.querySelectorAll(':scope > .section-head, :scope > .card, :scope > div > .card, .cards > .card, .paper-grid > .paper-card, .community-feed > .community-post')].slice(0,18);
    items.forEach((item,index)=>{
      item.classList.remove('edu-reveal');
      item.style.setProperty('--edu-reveal-delay',Math.min(index*35,280)+'ms');
    });
    requestAnimationFrame(()=>items.forEach(item=>item.classList.add('edu-reveal')));
  }

  function decorateActiveNav(){
    document.querySelectorAll('.nav-group').forEach(group=>{
      const active=group.querySelector('.nav-item.active:not(.role-hidden)');
      group.classList.toggle('has-active',!!active);
      if(active)group.open=true;
    });
  }

  function observeViews(){
    const main=$('.main');if(!main)return;
    const observer=new MutationObserver(mutations=>{
      let active=null,navChanged=false;
      for(const mutation of mutations){
        if(mutation.type==='attributes'){
          if(mutation.target.classList?.contains('view')&&mutation.target.classList.contains('active'))active=mutation.target;
          if(mutation.target.classList?.contains('nav-item'))navChanged=true;
        }else if(mutation.target.closest?.('.view.active'))active=mutation.target.closest('.view.active');
      }
      if(active)reveal(active);
      if(navChanged||active)decorateActiveNav();
    });
    observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    const nav=$('#nav');if(nav)observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','open']});
    reveal($('.view.active'));decorateActiveNav();
  }

  function addMobileNavigation(){
    const sidebar=$('.sidebar'),topbar=$('.topbar');
    if(!sidebar||!topbar||$('#eduMobileMenuBtn'))return;
    const menu=document.createElement('button');
    menu.id='eduMobileMenuBtn';
    menu.className='mobile-menu-btn';
    menu.type='button';
    menu.setAttribute('aria-label','Open navigation');
    menu.setAttribute('aria-expanded','false');
    menu.innerHTML='<span aria-hidden="true">☰</span>';

    const close=document.createElement('button');
    close.id='eduMobileNavClose';
    close.className='mobile-nav-close';
    close.type='button';
    close.setAttribute('aria-label','Close navigation');
    close.innerHTML='<span aria-hidden="true">×</span>';
    sidebar.appendChild(close);

    const backdrop=document.createElement('div');
    backdrop.id='eduMobileNavBackdrop';
    backdrop.className='mobile-nav-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    document.body.appendChild(backdrop);

    topbar.insertBefore(menu,topbar.firstChild);

    const setOpen=open=>{
      sidebar.classList.toggle('mobile-nav-open',open);
      backdrop.classList.toggle('show',open);
      document.body.classList.toggle('mobile-nav-lock',open);
      menu.setAttribute('aria-expanded',String(open));
      if(open)setTimeout(()=>sidebar.querySelector('.nav-search-wrap input')?.focus(),80);
    };
    menu.onclick=()=>setOpen(!sidebar.classList.contains('mobile-nav-open'));
    close.onclick=()=>setOpen(false);
    backdrop.onclick=()=>setOpen(false);
    sidebar.addEventListener('click',event=>{
      if(event.target.closest('.nav-item')&&innerWidth<=950)setOpen(false);
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&sidebar.classList.contains('mobile-nav-open'))setOpen(false);
    });
    addEventListener('resize',()=>{
      if(innerWidth>950)setOpen(false);
    });
  }

  function mount(){
    document.documentElement.classList.add('edu-ui-polished');
    addProgressBar();addBackToTop();addMobileNavigation();observeViews();
    document.addEventListener('pointerdown',ripple);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  window.EDUNIZAM_UI_POLISH={reveal,decorateActiveNav,addMobileNavigation};
})();
