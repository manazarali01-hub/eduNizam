(function(){
  const groups=[
    ['Overview','⌂',['dashboard']],
    ['Daily Work','★',['students','attendance','fees','staffcenter','access','noticeboard','schedulecenter','inboxcenter']],
    ['Students & Academics','🎓',['classcenter','studentprofile','results','schoolwork','lessoncenter','examcenter','behaviorcenter','studentdocs']],
    ['Staff & HR','👩‍🏫',['stafftime','staffpayroll','training','leavecenter']],
    ['School Operations','⚙',['admissions','financecenter','bulkimport','inventorycenter','librarycenter','transportcenter','gatecenter','parentcomplaints','helpdeskcenter','calendarcenter','functionscenter','ourstudents','attendanceanalytics']],
    ['Learning Resources','▤',['pastpapers','practice','study','schoolassessments','universities','vu']],
    ['Communication','✉',['communication','notifications']],
    ['AI & System','✦',['assistant','auditcenter','settings','troubleshoot','help']]
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
  function mount(){
    const nav=document.getElementById('nav');if(!nav||nav.dataset.enhanced==='1')return;
    const buttons=[...nav.querySelectorAll(':scope > .nav-item')];if(!buttons.length)return;
    nav.dataset.enhanced='1';nav.classList.add('nav-groups');
    const search=document.createElement('div');search.className='nav-search-wrap';search.innerHTML='<span aria-hidden="true">⌕</span><input id="navFeatureSearch" type="search" placeholder="Find a feature…" aria-label="Find a feature"><kbd>Ctrl K</kbd>';nav.before(search);
    const byView=new Map(buttons.map(b=>[b.dataset.view,b]));
    for(const [title,icon,views] of groups){
      const details=document.createElement('details');details.className='nav-group';details.dataset.groupTitle=title;details.open=title==='Overview'||title==='Daily Work';
      const summary=document.createElement('summary');summary.innerHTML='<span>'+icon+'</span><strong>'+title+'</strong><small>›</small>';details.appendChild(summary);
      const box=document.createElement('div');box.className='nav-group-items';views.forEach(v=>{const b=byView.get(v);if(b){box.appendChild(b);byView.delete(v)}});details.appendChild(box);if(box.children.length||['Daily Work','Communication'].includes(title))nav.appendChild(details);
    }
    if(byView.size){const details=document.createElement('details');details.className='nav-group';details.dataset.groupTitle='More';details.innerHTML='<summary><span>＋</span><strong>More</strong><small>›</small></summary><div class="nav-group-items"></div>';const box=details.lastElementChild;byView.forEach(b=>box.appendChild(b));nav.appendChild(details)}
    nav.querySelectorAll('.nav-group').forEach(group=>{
      group.addEventListener('toggle',()=>{
        if(!group.open)return;
        nav.querySelectorAll('.nav-group').forEach(other=>{
          if(other!==group && other.open && group.dataset.groupTitle!=='Daily Work')other.open=false;
        });
      });
    });
    const input=document.getElementById('navFeatureSearch');
    function filter(){const q=input.value.trim().toLowerCase();nav.querySelectorAll('.nav-group').forEach(g=>{let shown=0;g.querySelectorAll('.nav-item').forEach(b=>{const match=!q||b.textContent.toLowerCase().includes(q);b.classList.toggle('nav-search-hidden',!match);if(match&&!b.classList.contains('role-hidden'))shown++});g.hidden=shown===0;if(q&&shown)g.open=true})}
    input.addEventListener('input',filter);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}if(e.key==='Escape'&&document.activeElement===input){input.value='';filter();input.blur()}});
    nav.addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(!b)return;const g=b.closest('.nav-group');if(g)g.open=true;if(window.innerWidth<951)document.querySelector('.sidebar')?.classList.remove('mobile-nav-open')});
    const observer=new MutationObserver(mutations=>{
      let changed=false;
      for(const m of mutations){
        for(const node of m.addedNodes){
          if(node?.nodeType!==1)continue;
          if(node.matches?.('.nav-item')){placeButton(nav,node);changed=true}
          node.querySelectorAll?.('.nav-item').forEach(b=>{placeButton(nav,b);changed=true});
        }
      }
      if(changed)setTimeout(filter,0);
    });
    observer.observe(nav,{childList:true,subtree:true});
    window.addEventListener('edunizam:auth',()=>setTimeout(filter,50));
    setTimeout(()=>{nav.querySelectorAll('.nav-item').forEach(b=>placeButton(nav,b));filter()},900);
  }
  setTimeout(mount,0);setTimeout(mount,800);window.EDUNIZAM_NAVIGATION={mount};
})();