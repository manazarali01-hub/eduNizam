(function(){
  // Match the real accordion headings in app.html. The mobile active-view
  // resolver relies on these names; synthetic labels left the current section
  // collapsed when the drawer opened.
  const groups=[
    ['Core','⌂',['dashboard','students','studentprofile','classcenter','bulkimport','attendance','attendanceanalytics']],
    ['People & Campus','◎',['staffcenter','stafftime','staffpayroll','training','ourstudents','behaviorcenter','gatecenter','studentdocs','leavecenter']],
    ['Academics','✎',['results','schoolwork','lessoncenter','examcenter','paperbuilder','dailydiary','schedulecenter','calendarcenter']],
    ['Finance & Operations','₨',['fees','financecenter','inventorycenter','librarycenter','transportcenter']],
    ['Communication','✉',['noticeboard','functionscenter','inboxcenter','parentcomplaints','helpdeskcenter']],
    ['Pakistan Learning','🇵🇰',['pastpapers','practice','study','schoolassessments','universities','competitive','ecosystem','pathways','vu','admissions']],
    ['System','⚙',['assistant','auditcenter','datareadiness','settings','troubleshoot','help']]
  ];
  const groupMap=new Map(groups.flatMap(([title,,views])=>views.map(v=>[v,title])));
  function findGroup(nav,title){return [...nav.querySelectorAll(':scope > .nav-group')].find(g=>g.dataset.groupTitle===title)}
  function placeButton(nav,b){
    const view=b?.dataset?.view;if(!view)return;
    const title=groupMap.get(view);
    if(!title)return;
    const group=findGroup(nav,title),box=group?.querySelector('.nav-group-items');
    if(box&&b.parentElement!==box)box.appendChild(b);
  }
  function installMobileAccordion(nav){
    if(!nav||nav.dataset.mobileAccordionBound==='1')return;
    nav.dataset.mobileAccordionBound='1';
    const syncSummaryState=()=>{
      nav.querySelectorAll(':scope > .nav-group').forEach(group=>{
        group.querySelector(':scope > summary')?.setAttribute('aria-expanded',String(group.open));
      });
    };
    const normalize=()=>{
      if(window.innerWidth>950)return;
      const groups=[...nav.querySelectorAll(':scope > .nav-group')];
      const open=groups.filter(group=>group.open);
      if(open.length<=1){syncSummaryState();return;}
      const activeView=document.querySelector('.view.active')?.id||'dashboard';
      const activeTitle=groupMap.get(activeView);
      const keep=open.find(group=>group.dataset.groupTitle===activeTitle)||open[0];
      open.forEach(group=>{if(group!==keep)group.open=false});
      if(keep)keep.open=true;
      syncSummaryState();
    };
    // Capture the summary activation before native <details> toggling or any
    // other delegated click handlers. This guarantees a single-open mobile
    // accordion even when the navigation enhancement has already mounted.
    nav.addEventListener('click',event=>{
      const summary=event.target.closest?.('.nav-group > summary');
      if(!summary||window.innerWidth>950)return;
      const group=summary.parentElement;
      if(!group||group.parentElement!==nav)return;
      const shouldOpen=!group.open;
      event.preventDefault();
      event.stopImmediatePropagation();
      nav.querySelectorAll(':scope > .nav-group[open]').forEach(other=>{other.open=false});
      group.open=shouldOpen;
      syncSummaryState();
    },true);
    // Do not normalize on queued native `toggle` events. Programmatic open-state
    // changes also emit toggle asynchronously; re-selecting the active-view group
    // here would immediately collapse the group the user just opened. The capture-
    // phase summary handler already enforces one-open-at-a-time synchronously.
    normalize();
    window.addEventListener('resize',normalize,{passive:true});
  }
  function mount(){
    const nav=document.getElementById('nav');if(!nav)return;
    installMobileAccordion(nav);
    if(nav.dataset.enhanced==='1')return;
    const buttons=[...nav.querySelectorAll(':scope > .nav-item')];
    nav.dataset.enhanced='1';nav.classList.add('nav-groups');
    // The current app shell already ships grouped <details> markup. Give those
    // groups stable labels too; only dynamically-created groups have these
    // attributes by default. This keeps role-aware navigation and QA selectors
    // anchored to the real rendered group rather than assuming a rebuilt menu.
    nav.querySelectorAll(':scope > details.nav-group').forEach(group=>{
      if(!group.dataset.groupTitle){
        const label=group.querySelector(':scope > summary strong')?.textContent?.trim();
        if(label)group.dataset.groupTitle=label;
      }
    });
    let search=document.querySelector('.sidebar > .nav-search-wrap');
    if(!search){search=document.createElement('div');search.className='nav-search-wrap';search.innerHTML='<span aria-hidden="true">⌕</span><input id="navFeatureSearch" type="search" placeholder="Find a feature…" aria-label="Find a feature"><kbd>Ctrl K</kbd>';nav.before(search)}
    if(buttons.length){
    const byView=new Map(buttons.map(b=>[b.dataset.view,b]));
    for(const [title,icon,views] of groups){
      const details=document.createElement('details');details.className='nav-group';details.dataset.groupTitle=title;details.open=title==='Overview'||title==='Daily Work';
      const summary=document.createElement('summary');summary.innerHTML='<span>'+icon+'</span><strong>'+title+'</strong><small>›</small>';details.appendChild(summary);
      const box=document.createElement('div');box.className='nav-group-items';views.forEach(v=>{const b=byView.get(v);if(b){box.appendChild(b);byView.delete(v)}});details.appendChild(box);if(box.children.length||['Daily Work','Communication'].includes(title))nav.appendChild(details);
    }
    if(byView.size){const details=document.createElement('details');details.className='nav-group';details.dataset.groupTitle='More';details.innerHTML='<summary><span>＋</span><strong>More</strong><small>›</small></summary><div class="nav-group-items"></div>';const box=details.lastElementChild;byView.forEach(b=>box.appendChild(b));nav.appendChild(details)}
    }
    // Do not enforce accordion state from the asynchronous <details> toggle
    // event: browsers queue that event, so a stale "opened" event can run after
    // a later group has become active and collapse the user's current panel.
    // Mobile summary clicks below apply the single-open transition synchronously.
    // Desktop keeps native independent <details> behavior.
    // The initial desktop defaults include Overview + Daily Work. On mobile,
    // normalize that initial state too, retaining the group for the active view.
    // Otherwise two groups can remain open until the user toggles one manually.
    if(window.innerWidth<=950){
      const activeView=document.querySelector('.view.active')?.id||'dashboard';
      const activeTitle=groupMap.get(activeView)||'Overview';
      const activeGroup=findGroup(nav,activeTitle);
      nav.querySelectorAll('.nav-group[open]').forEach(group=>{
        if(group!==activeGroup)group.open=false;
      });
      if(activeGroup)activeGroup.open=true;
    }
    const input=document.getElementById('navFeatureSearch');
    function filter(){const q=input.value.trim().toLowerCase();nav.querySelectorAll('.nav-group').forEach(g=>{let shown=0;g.querySelectorAll('.nav-item').forEach(b=>{const match=!q||b.textContent.toLowerCase().includes(q);b.classList.toggle('nav-search-hidden',!match);if(match&&!b.classList.contains('role-hidden'))shown++});g.hidden=shown===0;if(q&&shown)g.open=true})}
    input.addEventListener('input',filter);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}if(e.key==='Escape'&&document.activeElement===input){input.value='';filter();input.blur()}});
    const connectionAllowsPrefetch=()=>{
      const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      return !c?.saveData&&!/^(slow-)?2g$/i.test(c?.effectiveType||'');
    };
    const prefetchView=view=>{
      if(!view||!connectionAllowsPrefetch())return;
      const loader=window.EDUNIZAM_FEATURE_LOADER;
      if(!loader?.prefetch||loader.isReady?.(view))return;
      loader.prefetch(view).catch(()=>{});
    };
    const intentPrefetch=e=>{
      const b=e.target.closest?.('.nav-item[data-view]');
      if(!b||b.hidden||b.classList.contains('role-hidden'))return;
      prefetchView(b.dataset.view);
    };
    nav.addEventListener('pointerover',intentPrefetch,{passive:true});
    nav.addEventListener('focusin',intentPrefetch);
    nav.addEventListener('touchstart',intentPrefetch,{passive:true});
    const warmCommonViews=()=>{
      if(!connectionAllowsPrefetch())return;
      const loader=window.EDUNIZAM_FEATURE_LOADER;if(!loader?.prefetch)return;
      const preferred=['noticeboard','schedulecenter','inboxcenter','studentprofile','results','schoolwork','staffcenter','stafftime','leavecenter','examcenter','calendarcenter','paperbuilder','dailydiary'];
      const visible=preferred.filter(view=>{
        const b=nav.querySelector('.nav-item[data-view="'+view+'"]');
        return b&&!b.hidden&&!b.classList.contains('role-hidden')&&(loader.scriptsFor?.(view)||[]).length;
      }).slice(0,4);
      let index=0;
      const next=()=>{
        const view=visible[index++];if(!view)return;
        loader.prefetch(view).catch(()=>{}).finally(()=>{
          if(index<visible.length)setTimeout(next,120);
        });
      };
      next();
    };
    let warmScheduled=false,warmStarted=false;
    const scheduleWarm=()=>{
      if(warmScheduled||warmStarted||document.hidden)return;
      warmScheduled=true;
      const run=()=>{
        warmScheduled=false;
        if(warmStarted||document.hidden)return;
        warmStarted=true;
        warmCommonViews();
      };
      // Background feature warming is optional. Give authentication, role scope,
      // dashboard rendering and the mobile shell a quiet window first.
      if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:5000});
      else setTimeout(run,4500);
    };
    // Feature navigation remains delegated separately; mobile summary
    // activation is handled once in the capture-phase accordion controller.
    nav.addEventListener('click',e=>{
      const b=e.target.closest('.nav-item');
      if(!b)return;
      const g=b.closest('.nav-group');if(g)g.open=true;
      if(window.innerWidth<951)window.EDUNIZAM_MOBILE_NAV_CORE?.close?.();
    });
    const observer=new MutationObserver(mutations=>{
      let changed=false;
      for(const m of mutations){
        if(m.type==='attributes'&&m.attributeName==='class'&&m.target.matches?.('.nav-item[data-view]')){
          // app.js and the secure role-scope runtime can apply role-hidden
          // after this menu mounts. Recompute group visibility when that
          // permission state changes, otherwise an empty accordion can stay
          // hidden even after an allowed role button becomes available.
          const wasHidden=String(m.oldValue||'').split(/\s+/).includes('role-hidden');
          const isHidden=m.target.classList.contains('role-hidden');
          if(wasHidden!==isHidden)changed=true;
        }
        for(const node of m.addedNodes||[]){
          if(node?.nodeType!==1)continue;
          if(node.matches?.('.nav-item')){placeButton(nav,node);changed=true}
          node.querySelectorAll?.('.nav-item').forEach(b=>{placeButton(nav,b);changed=true});
        }
      }
      if(changed)setTimeout(filter,0);
    });
    observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
    window.addEventListener('edunizam:auth',()=>setTimeout(filter,50));
    // Preserve the background feature-warming contract: warm only after
    // workspace readiness, and independently refresh role-filtered groups.
    window.addEventListener('edunizam:workspace-ready',scheduleWarm);
    window.addEventListener('edunizam:workspace-ready',filter);
    // Initial grouping is already complete above; the old 900ms re-parenting
    // sweep caused an intermittent moving/vanishing mobile Help tap target.
    // New buttons are handled by the MutationObserver instead.
    nav.querySelectorAll('.nav-item').forEach(b=>placeButton(nav,b));
    filter();
  }
  setTimeout(mount,0);setTimeout(mount,800);window.EDUNIZAM_NAVIGATION={mount};
})();