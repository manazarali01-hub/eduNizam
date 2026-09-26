(function(){
  const $=s=>document.querySelector(s);
  const all=s=>[...document.querySelectorAll(s)];
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const roleLabel=r=>({head:'School Admin',admin:'School Admin',teacher:'Teacher',parent:'Parent',student:'Student'}[r]||'EduNizam User');
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function premiumToast(message,type='info'){
    let el=$('#premiumToast');
    if(!el){
      el=document.createElement('div');el.id='premiumToast';el.className='premium-toast';
      el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);
    }
    clearTimeout(el._timer);
    el.className='premium-toast '+(type==='success'?'success':type==='error'?'error':'');
    el.textContent=String(message||'');
    requestAnimationFrame(()=>el.classList.add('show'));
    el._timer=setTimeout(()=>el.classList.remove('show'),3400);
  }

  function cloudStatus(){
    if(!navigator.onLine)return {label:'Offline',cls:'offline'};
    const cloud=window.EDUNIZAM_CLOUD;
    if(cloud?.state?.user)return {label:'Cloud Connected',cls:'online'};
    const cfg=window.EDUNIZAM_CLOUD_CONFIG||{};
    if(cfg.enabled)return {label:'Cloud Ready',cls:'online'};
    return {label:'Local Mode',cls:'offline'};
  }

  function schoolName(){
    const s=session();
    if(s?.schoolName)return s.schoolName;
    const visible=$('#sidebarSchoolName')?.textContent?.trim();
    return visible&&visible!=='My School'?visible:'EduNizam';
  }

  function mountWorkspaceBadge(){
    const sidebar=$('.sidebar'),inst=$('#sidebarInstitute');if(!sidebar||!inst||$('#premiumWorkspaceBadge'))return;
    const box=document.createElement('div');
    box.id='premiumWorkspaceBadge';box.className='premium-workspace-badge';
    box.innerHTML='<span>✦ Premium Workspace</span><span>EduNizam</span>';
    inst.insertAdjacentElement('afterend',box);
  }

  function mountTopbarContext(){
    const actions=$('.topbar-actions');if(!actions)return;
    let wrap=$('#premiumContext');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='premiumContext';wrap.className='premium-context';
      actions.prepend(wrap);
    }
    const cloud=cloudStatus();
    const date=new Intl.DateTimeFormat('en-PK',{weekday:'short',day:'2-digit',month:'short'}).format(new Date());
    wrap.innerHTML=
      '<span class="premium-context-chip role">✦ '+esc(roleLabel(role()))+'</span>'+
      '<span class="premium-context-chip school">🏫 '+esc(schoolName())+'</span>'+
      '<span class="premium-context-chip date">📅 '+esc(date)+'</span>'+
      '<span class="premium-context-chip sync '+cloud.cls+'"><i class="premium-sync-dot"></i>'+esc(cloud.label)+'</span>'+
      '<button id="premiumSearchTrigger" class="premium-search-trigger" type="button" aria-label="Find a feature"><span>⌕</span><span class="label">Find feature</span></button>';
    $('#premiumSearchTrigger').onclick=()=>{
      const menu=$('#eduMobileMenuBtn');
      if(innerWidth<=950 && menu && !$('.sidebar')?.classList.contains('mobile-nav-open'))menu.click();
      setTimeout(()=>{$('#navFeatureSearch')?.focus();$('#navFeatureSearch')?.select()},90);
    };
  }

  function visibleNav(view){
    const b=document.querySelector('.nav-item[data-view="'+view+'"]');
    return !!b&&!b.classList.contains('role-hidden')&&!b.hidden;
  }
  function go(view){
    const b=document.querySelector('.nav-item[data-view="'+view+'"]');
    if(b&&!b.classList.contains('role-hidden')){b.click();return true}
    if(view==='access'){window.EDUNIZAM_ROLE_ACCESS?.show?.();return true}
    return false;
  }

  function dockItems(){
    const r=role();
    const base=r==='head'||r==='admin'
      ? [['dashboard','⌂','Home'],['students','🎓','Students'],['attendance','✓','Attendance'],['inboxcenter','💬','Messages']]
      : r==='teacher'
        ? [['dashboard','⌂','Home'],['attendance','✓','Attendance'],['schoolwork','📚','Work'],['inboxcenter','💬','Messages']]
        : r==='parent'
          ? [['dashboard','⌂','Home'],['studentprofile','🎓','Child'],['leavecenter','🗓','Leave'],['inboxcenter','💬','Messages']]
          : [['dashboard','⌂','Home'],['studentprofile','🎓','Profile'],['study','📚','Study'],['inboxcenter','💬','Messages']];
    return base.filter(x=>visibleNav(x[0]));
  }

  function mountMobileDock(){
    let dock=$('#premiumMobileDock');
    if(!dock){dock=document.createElement('nav');dock.id='premiumMobileDock';dock.className='premium-mobile-dock';dock.setAttribute('aria-label','Quick navigation');document.body.appendChild(dock)}
    const items=dockItems();
    dock.innerHTML=items.map(x=>'<button type="button" data-premium-view="'+x[0]+'"><span>'+x[1]+'</span><strong>'+x[2]+'</strong></button>').join('')+
      '<button type="button" data-premium-more="1"><span>☰</span><strong>More</strong></button>';
    dock.querySelectorAll('[data-premium-view]').forEach(b=>b.onclick=()=>go(b.dataset.premiumView));
    dock.querySelector('[data-premium-more]').onclick=()=>$('#eduMobileMenuBtn')?.click();
    updateDockActive();
  }
  function updateDockActive(){
    const active=$('.nav-item.active')?.dataset?.view||'';
    all('[data-premium-view]').forEach(b=>b.classList.toggle('active',b.dataset.premiumView===active));
  }

  function decorateViews(){
    all('.view').forEach(v=>v.classList.add('premium-section'));
    all('.card').forEach(c=>{if(!c.dataset.premiumCard)c.dataset.premiumCard='1'});
  }

  function observe(){
    const nav=$('#nav');if(nav){
      const obs=new MutationObserver(()=>{updateDockActive();mountMobileDock()});
      obs.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    }
    const main=$('.main');if(main){
      const obs=new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))decorateViews();updateDockActive()});
      obs.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    }
  }

  function refresh(){
    mountWorkspaceBadge();mountTopbarContext();mountMobileDock();decorateViews();updateDockActive();
  }
  function boot(){
    document.documentElement.classList.add('edunizam-premium');
    refresh();observe();
    addEventListener('online',()=>{mountTopbarContext();premiumToast('Internet connection restored.','success')});
    addEventListener('offline',()=>{mountTopbarContext();premiumToast('You are offline. EduNizam will keep local work available.','info')});
    addEventListener('storage',e=>{if(['edunizam_session','edunizam_settings','edunizam_cloud_runtime_config'].includes(e.key))refresh()});
    addEventListener('edunizam:auth',()=>setTimeout(refresh,80));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)mountTopbarContext()});
    setTimeout(refresh,900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.EDUNIZAM_PREMIUM={refresh,toast:premiumToast,go};
})();