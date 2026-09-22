(function(){
  const groups=[
    ['Overview','⌂',['dashboard']],
    ['People & Staff','👥',['students','classcenter','staffcenter','stafftime','staffpayroll','training','studentprofile','ourstudents','behaviorcenter','parentcomplaints','gatecenter','studentdocs']],
    ['Operations','⚙',['attendance','attendanceanalytics','fees','financecenter','bulkimport','inventorycenter','librarycenter','transportcenter','admissions']],
    ['Academics','✎',['results','schoolwork','noticeboard','lessoncenter','calendarcenter','functionscenter','schedulecenter','leavecenter','examcenter']],
    ['Learning Resources','▤',['pastpapers','practice','study','schoolassessments','universities','vu']],
    ['Communication','✉',['inboxcenter','helpdeskcenter','communication','access','notifications']],
    ['AI & Settings','✦',['assistant','settings','troubleshoot','help']]
  ];
  function mount(){
    const nav=document.getElementById('nav');if(!nav||nav.dataset.enhanced==='1')return;
    const buttons=[...nav.querySelectorAll(':scope > .nav-item')];if(!buttons.length)return;
    nav.dataset.enhanced='1';nav.classList.add('nav-groups');
    const search=document.createElement('div');search.className='nav-search-wrap';search.innerHTML='<span aria-hidden="true">⌕</span><input id="navFeatureSearch" type="search" placeholder="Find a feature…" aria-label="Find a feature"><kbd>Ctrl K</kbd>';nav.before(search);
    const byView=new Map(buttons.map(b=>[b.dataset.view,b]));
    for(const [title,icon,views] of groups){
      const details=document.createElement('details');details.className='nav-group';details.open=views.includes('dashboard');
      const summary=document.createElement('summary');summary.innerHTML='<span>'+icon+'</span><strong>'+title+'</strong><small>›</small>';details.appendChild(summary);
      const box=document.createElement('div');box.className='nav-group-items';views.forEach(v=>{const b=byView.get(v);if(b){box.appendChild(b);byView.delete(v)}});details.appendChild(box);if(box.children.length)nav.appendChild(details);
    }
    if(byView.size){const details=document.createElement('details');details.className='nav-group';details.open=true;details.innerHTML='<summary><span>＋</span><strong>More</strong><small>›</small></summary><div class="nav-group-items"></div>';const box=details.lastElementChild;byView.forEach(b=>box.appendChild(b));nav.appendChild(details)}
    const input=document.getElementById('navFeatureSearch');
    function filter(){const q=input.value.trim().toLowerCase();nav.querySelectorAll('.nav-group').forEach(g=>{let shown=0;g.querySelectorAll('.nav-item').forEach(b=>{const match=!q||b.textContent.toLowerCase().includes(q);b.classList.toggle('nav-search-hidden',!match);if(match&&!b.classList.contains('role-hidden'))shown++});g.hidden=shown===0;if(q&&shown)g.open=true})}
    input.addEventListener('input',filter);document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}if(e.key==='Escape'&&document.activeElement===input){input.value='';filter();input.blur()}});
    nav.addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(!b)return;const g=b.closest('.nav-group');if(g)g.open=true;if(window.innerWidth<951)document.querySelector('.sidebar')?.classList.remove('mobile-nav-open')});
    window.addEventListener('edunizam:auth',()=>setTimeout(filter,50));
  }
  setTimeout(mount,0);setTimeout(mount,800);window.EDUNIZAM_NAVIGATION={mount};
})();
