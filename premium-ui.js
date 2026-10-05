(function(){
  const $=s=>document.querySelector(s);
  const all=s=>[...document.querySelectorAll(s)];
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const roleLabel=r=>({head:'School Admin',admin:'School Admin',teacher:'Teacher',parent:'Parent',student:'Student'}[r]||'EduNizam User');
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const iconSvg=type=>{
    const common='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const map={
      home:'<path d="M3 11.5 12 4l9 7.5V20h-6v-5H9v5H3v-8.5Z" '+common+'/>',
      people:'<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19c.4-3.5 2.4-5.3 6-5.3S14.6 15.5 15 19M14 14.2c.6-.4 1.4-.7 2.2-.7 2.7 0 4.4 1.7 4.8 5" '+common+'/>',
      check:'<path d="M5 12.5 9.2 17 19 7.2" '+common+'/><circle cx="12" cy="12" r="9" '+common+'/>',
      book:'<path d="M4 5.5h6a3 3 0 0 1 3 3V20H7a3 3 0 0 1-3-3V5.5Zm16 0h-4a3 3 0 0 0-3 3V20h4a3 3 0 0 0 3-3V5.5Z" '+common+'/>',
      chat:'<path d="M4 5h16v11H9l-5 4V5Z" '+common+'/><path d="M8 9h8M8 12h5" '+common+'/>',
      money:'<path d="M4 7h16v11H4V7Zm4 0V5h8v2M8 12h.01M12 12h4" '+common+'/>',
      calendar:'<path d="M5 5h14v15H5V5Zm3-2v4m8-4v4M5 9h14" '+common+'/>',
      shield:'<path d="M12 3c3 1.5 5.5 2.1 7.5 2.8V11c0 4.8-2.8 8.2-7.5 10-4.7-1.8-7.5-5.2-7.5-10V5.8C6.5 5.1 9 4.5 12 3Z" '+common+'/>',
      gear:'<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.5 3.5 1.5 1-1.5 2.6-1.8-.2a7 7 0 0 1-1.4 1.4l.2 1.8-2.6 1.5-1-1.5a7 7 0 0 1-2 0l-1 1.5-2.6-1.5.2-1.8a7 7 0 0 1-1.4-1.4l-1.8.2L3 13l1.5-1a7 7 0 0 1 0-2L3 9l1.5-2.6 1.8.2a7 7 0 0 1 1.4-1.4l-.2-1.8L10.1 2l1 1.5a7 7 0 0 1 2 0l1-1.5 2.6 1.5-.2 1.8a7 7 0 0 1 1.4 1.4l1.8-.2L21 9l-1.5 1a7 7 0 0 1 0 2Z" '+common+'/>',
      grid:'<path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" '+common+'/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(map[type]||map.grid)+'</svg>';
  };
  const iconType=view=>{
    if(['dashboard'].includes(view))return'home';
    if(['students','studentprofile','ourstudents','staffcenter','stafftime','staffpayroll','training','access'].includes(view))return'people';
    if(['attendance','attendanceanalytics','leavecenter','gatecenter'].includes(view))return'check';
    if(['fees','financecenter','admissions'].includes(view))return'money';
    if(['inboxcenter','communication','parentcomplaints','helpdeskcenter','notifications'].includes(view))return'chat';
    if(['calendarcenter','schedulecenter','functionscenter'].includes(view))return'calendar';
    if(['behaviorcenter','studentdocs','auditcenter'].includes(view))return'shield';
    if(['settings','troubleshoot','help','assistant'].includes(view))return'gear';
    if(['results','schoolwork','lessoncenter','examcenter','pastpapers','practice','study','schoolassessments','universities','vu','librarycenter'].includes(view))return'book';
    return'grid';
  };
  function cleanNavLabel(button){
    const explicit=button.querySelector(':scope > span:last-child');
    if(explicit&&button.children.length>1)return explicit.textContent.trim();
    return String(button.textContent||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
  }
  function premiumizeNavIcons(){
    all('.nav-item[data-view]').forEach(b=>{
      if(b.dataset.premiumIcon==='1')return;
      const label=cleanNavLabel(b),view=b.dataset.view||'';
      b.dataset.premiumIcon='1';
      b.innerHTML='<span class="premium-nav-icon">'+iconSvg(iconType(view))+'</span><span class="premium-nav-label">'+esc(label)+'</span>';
    });
  }

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
    box.innerHTML='<span>✦ Free Launch Workspace</span><span>EduNizam</span>';
    inst.insertAdjacentElement('afterend',box);
  }

  const localRole=r=>r==='head_of_institute'?'head':(['head','teacher','parent','student'].includes(r)?r:'student');
  const workspaceCache={userId:'',items:null,at:0,inflight:null};
  async function workspaceChoices(force=false){
    const cloud=window.EDUNIZAM_CLOUD,client=cloud?.state?.client,user=cloud?.state?.user;
    if(!client||!user)return[];
    const uid=String(user.id||'');
    if(workspaceCache.userId!==uid){workspaceCache.userId=uid;workspaceCache.items=null;workspaceCache.at=0;workspaceCache.inflight=null}
    if(!force&&workspaceCache.items&&Date.now()-workspaceCache.at<60000)return workspaceCache.items;
    if(workspaceCache.inflight)return workspaceCache.inflight;
    workspaceCache.inflight=(async()=>{
    const [ownedRes,memberRes,profileRes]=await Promise.all([
      client.from('institutions').select('id,name,institution_type').eq('owner_user_id',user.id).order('created_at',{ascending:true}),
      client.from('institution_members').select('institution_id,role,institutions(id,name,institution_type)').eq('user_id',user.id),
      client.from('user_profiles').select('institution_id,account_role').eq('user_id',user.id).maybeSingle()
    ]);
    if(ownedRes.error)throw ownedRes.error;
    if(memberRes.error)throw memberRes.error;
    const map=new Map();
    (ownedRes.data||[]).forEach(x=>map.set(x.id,{...x,role:'head'}));
    (memberRes.data||[]).forEach(m=>{
      const x=m.institutions;if(!x?.id)return;
      if(!map.has(x.id))map.set(x.id,{...x,role:localRole(m.role)});
    });
    const p=profileRes.data;
    if(p?.institution_id&&!map.has(p.institution_id)){
      const {data}=await client.from('institutions').select('id,name,institution_type').eq('id',p.institution_id).maybeSingle();
      if(data?.id)map.set(data.id,{...data,role:localRole(p.account_role)});
    }
    return [...map.values()];
    })();
    try{
      const items=await workspaceCache.inflight;
      workspaceCache.items=items;workspaceCache.at=Date.now();
      return items;
    }finally{workspaceCache.inflight=null}
  }
  function closeWorkspaceModal(){document.getElementById('workspaceSwitchModal')?.remove()}
  function showWorkspaceModal(items){
    closeWorkspaceModal();
    const current=String(session()?.institutionId||window.EDUNIZAM_CLOUD_CONFIG?.institutionId||'');
    const modal=document.createElement('div');modal.id='workspaceSwitchModal';modal.className='workspace-switch-backdrop';
    modal.innerHTML='<section class="workspace-switch-modal" role="dialog" aria-modal="true" aria-labelledby="workspaceSwitchTitle"><div class="section-head"><div><div class="academic-kicker">School Workspace</div><h2 id="workspaceSwitchTitle">Switch School</h2><p class="muted">Select the school and role you want to open.</p></div><button type="button" class="secondary" data-workspace-close>Close</button></div><div class="workspace-choice-list">'+items.map(x=>'<button type="button" class="workspace-choice '+(String(x.id)===current?'current':'')+'" data-workspace-id="'+esc(x.id)+'"><span><strong>'+esc(x.name||'School')+'</strong><small>'+esc(roleLabel(x.role))+' · '+esc(x.institution_type||'School')+'</small></span><em>'+(String(x.id)===current?'Current':'Open')+'</em></button>').join('')+'</div></section>';
    document.body.appendChild(modal);
    modal.querySelector('[data-workspace-close]').onclick=closeWorkspaceModal;
    modal.addEventListener('click',e=>{if(e.target===modal)closeWorkspaceModal()});
    modal.querySelectorAll('[data-workspace-id]').forEach(b=>b.onclick=()=>switchWorkspace(items.find(x=>String(x.id)===String(b.dataset.workspaceId))));
    const onKey=e=>{if(e.key==='Escape'){closeWorkspaceModal();document.removeEventListener('keydown',onKey)}};document.addEventListener('keydown',onKey);
  }
  async function switchWorkspace(item){
    if(!item?.id)return;
    const current=String(session()?.institutionId||'');
    if(String(item.id)===current){closeWorkspaceModal();return}
    let runtime={};try{runtime=JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}')}catch(_){}
    runtime.enabled=true;runtime.institutionId=item.id;
    localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify(runtime));
    const s=session()||{};
    localStorage.setItem('edunizam_session',JSON.stringify({...s,role:localRole(item.role),schoolName:item.name||'',institutionId:item.id,switchedAt:Date.now()}));
    let settings={};try{settings=JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){}
    settings.schoolName=item.name||settings.schoolName||'My School';
    settings.schoolType=item.institution_type||settings.schoolType||'School';
    localStorage.setItem('edunizam_settings',JSON.stringify(settings));
    location.reload();
  }
  async function mountWorkspaceSwitcher(){
    const actions=$('.topbar-actions');if(!actions||$('#premiumWorkspaceSwitch'))return;
    const cloud=window.EDUNIZAM_CLOUD;if(!cloud?.state?.user)return;
    const button=document.createElement('button');
    button.id='premiumWorkspaceSwitch';
    button.className='premium-workspace-switch';
    button.type='button';
    button.innerHTML='<span>↔</span><span class="label">Switch School</span>';
    button.onclick=async()=>{
      if(button.disabled)return;
      button.disabled=true;
      const old=button.innerHTML;
      button.innerHTML='<span>↔</span><span class="label">Loading…</span>';
      try{
        const items=await workspaceChoices(true);
        if(items.length<2){
          premiumToast('No other approved school workspace is available.','info');
          return;
        }
        showWorkspaceModal(items);
      }catch(e){
        console.warn('Workspace switch:',e.message||e);
        premiumToast('School list could not load. Try again.','error');
      }finally{
        button.disabled=false;
        button.innerHTML=old;
      }
    };
    actions.appendChild(button);
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
      ? [['dashboard','Home'],['students','Students'],['attendance','Attendance'],['inboxcenter','Messages']]
      : r==='teacher'
        ? [['dashboard','Home'],['attendance','Attendance'],['schoolwork','Work'],['inboxcenter','Messages']]
        : r==='parent'
          ? [['dashboard','Home'],['studentprofile','Child'],['leavecenter','Leave'],['inboxcenter','Messages']]
          : [['dashboard','Home'],['studentprofile','Profile'],['study','Study'],['inboxcenter','Messages']];
    return base.filter(x=>visibleNav(x[0]));
  }

  function mountMobileDock(){
    let dock=$('#premiumMobileDock');
    if(!dock){dock=document.createElement('nav');dock.id='premiumMobileDock';dock.className='premium-mobile-dock';dock.setAttribute('aria-label','Quick navigation');document.body.appendChild(dock)}
    const items=dockItems();
    dock.innerHTML=items.map(x=>'<button type="button" data-premium-view="'+x[0]+'"><span class="premium-dock-icon">'+iconSvg(iconType(x[0]))+'</span><strong>'+x[1]+'</strong></button>').join('')+
      '<button type="button" data-premium-more="1"><span class="premium-dock-icon">'+iconSvg('grid')+'</span><strong>More</strong></button>';
    dock.querySelectorAll('[data-premium-view]').forEach(b=>b.onclick=()=>go(b.dataset.premiumView));
    dock.querySelector('[data-premium-more]').onclick=()=>$('#eduMobileMenuBtn')?.click();
    updateDockActive();
  }
  function updateDockActive(){
    const active=$('.nav-item.active')?.dataset?.view||'';
    all('.nav-group').forEach(g=>{const on=!!g.querySelector('.nav-item.active');g.classList.toggle('has-active',on);if(on)g.open=true});
    all('[data-premium-view]').forEach(b=>b.classList.toggle('active',b.dataset.premiumView===active));
  }

  function decorateDashboard(){
    const dash=$('#dashboard');if(!dash)return;
    dash.dataset.premiumRole=role();

    const statMap=[
      ['statStudents','people','Enrolled'],
      ['statPresent','check','Today'],
      ['statFees','money','Collected'],
      ['statPending','money','Pending']
    ];
    statMap.forEach(([id,type,meta])=>{
      const value=$('#'+id),card=value?.closest('.stat');if(!card)return;
      card.dataset.statType=id;
      if(!card.querySelector('.premium-stat-icon')){
        card.insertAdjacentHTML('afterbegin','<span class="premium-stat-icon">'+iconSvg(type)+'</span>');
      }
      if(!card.querySelector('.premium-stat-meta')){
        card.insertAdjacentHTML('beforeend','<small class="premium-stat-meta">'+esc(meta)+'</small>');
      }
    });

    const quick=dash.querySelector('.grid-2 > .card:first-child');
    const activity=dash.querySelector('.grid-2 > .card:nth-child(2)');
    quick?.classList.add('dashboard-quick-card');
    activity?.classList.add('dashboard-activity-card');

    const activityList=$('#activityList');
    if(activityList && activityList.textContent.trim()==='No activity yet.' && !activityList.querySelector('.premium-empty-activity')){
      activityList.innerHTML='<div class="premium-empty-activity"><span>'+iconSvg('grid')+'</span><div><strong>Your workspace is ready.</strong><small>New attendance, fee, result and school actions will appear here.</small></div></div>';
    }

    all('#adminDailyDesk [data-admin-jump]').forEach(button=>{
      if(button.dataset.premiumAction==='1')return;
      const view=button.dataset.adminJump||'';
      const icon=button.querySelector(':scope > span');
      if(icon)icon.innerHTML=iconSvg(iconType(view));
      button.dataset.premiumAction='1';
    });

    all('.role-quick-actions [data-role-quick]').forEach(button=>{
      if(button.dataset.premiumAction==='1')return;
      const view=button.dataset.roleQuick||'';
      button.insertAdjacentHTML('afterbegin','<span class="role-quick-icon">'+iconSvg(iconType(view))+'</span>');
      button.dataset.premiumAction='1';
    });

    all('#familyDashboard .paper-grid > .card').forEach(card=>card.classList.add('premium-family-card'));

    const heroLabel=dash.querySelector('.campus-label');
    const labels={head:'Admin Control Center',admin:'Admin Control Center',teacher:'Teacher Workspace',parent:'Parent Connection',student:'Student Workspace'};
    if(heroLabel && labels[role()])heroLabel.textContent=labels[role()];
  }

  function decorateViews(){
    all('.view').forEach(v=>v.classList.add('premium-section'));
    all('.card').forEach(c=>{if(!c.dataset.premiumCard)c.dataset.premiumCard='1'});
    decorateDashboard();
  }

  function observe(){
    const nav=$('#nav');if(nav){
      const obs=new MutationObserver(()=>{premiumizeNavIcons();updateDockActive();mountMobileDock()});
      obs.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    }
    const main=$('.main');if(main){
      const obs=new MutationObserver(m=>{if(m.some(x=>x.type==='childList'))decorateViews();updateDockActive()});
      obs.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    }
  }

  function refresh(){
    mountWorkspaceBadge();mountTopbarContext();premiumizeNavIcons();mountMobileDock();decorateViews();updateDockActive();
    mountWorkspaceSwitcher();
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