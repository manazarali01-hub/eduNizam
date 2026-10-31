(()=> {
  'use strict';

  document.documentElement.classList.add('js');
  document.body?.classList.add('js');

  const nav=document.querySelector('[data-home-nav]');
  const updateNav=()=>nav?.classList.toggle('is-scrolled',window.scrollY>18);
  updateNav();
  window.addEventListener('scroll',updateNav,{passive:true});

  const revealNodes=[...document.querySelectorAll('[data-reveal]')];
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion){
    revealNodes.forEach(node=>node.classList.add('is-visible'));
  }else if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },{threshold:.08,rootMargin:'0px 0px -34px'});
    revealNodes.forEach(node=>observer.observe(node));
  }else{
    revealNodes.forEach(node=>node.classList.add('is-visible'));
  }

  const roleData={
    admin:{
      label:'Admin workspace',
      kicker:'CONTROL & OVERSIGHT',
      title:'Run the institute from one organised view.',
      copy:'Approvals, attendance, fees, results, notices and school operations stay connected.',
      items:['User approvals','Attendance oversight','Fees & results','Notices & complaints'],
      note:'Admin controls school access and institutional settings.'
    },
    teacher:{
      label:'Teacher workspace',
      kicker:'TEACHING & CLASSROOM',
      title:'Handle the daily class work without the clutter.',
      copy:'Teachers can focus on assigned classes, attendance, diaries, paper building and requests.',
      items:['Class attendance','Daily diaries','Paper builder','Leave requests'],
      note:'Teachers see the classes and tools relevant to their approved role.'
    },
    student:{
      label:'Student workspace',
      kicker:'LEARNING & PROGRESS',
      title:'Keep school work and learning resources easy to reach.',
      copy:'Students can follow diaries, results, notices, practice tools and approved school updates.',
      items:['Diary & notices','Results','Practice & learning','Leave requests'],
      note:'Guest learning stays available separately from private school data.'
    },
    parent:{
      label:'Parent workspace',
      kicker:'VISIBILITY & COMMUNICATION',
      title:'Stay connected to the child’s school journey.',
      copy:'Parents can view approved child information, school updates and communicate through protected channels.',
      items:['Child attendance','Results','Daily diaries','Private complaints'],
      note:'Parent access is tied to approved school and child records.'
    }
  };

  const tabs=[...document.querySelectorAll('[data-role]')];
  const label=document.querySelector('[data-role-label]');
  const kicker=document.querySelector('[data-role-kicker]');
  const title=document.querySelector('[data-role-title]');
  const copy=document.querySelector('[data-role-copy]');
  const items=document.querySelector('[data-role-items]');
  const note=document.querySelector('[data-role-note]');

  const renderRole=role=>{
    const data=roleData[role];
    if(!data)return;
    tabs.forEach(tab=>{
      const active=tab.dataset.role===role;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
    });
    if(label)label.textContent=data.label;
    if(kicker)kicker.textContent=data.kicker;
    if(title)title.textContent=data.title;
    if(copy)copy.textContent=data.copy;
    if(note)note.textContent=data.note;
    if(items)items.innerHTML=data.items.map(item=>'<span>'+item+'</span>').join('');
  };

  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>renderRole(tab.dataset.role));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
      event.preventDefault();
      let next=index;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      const target=tabs[next];
      renderRole(target.dataset.role);
      target.focus();
    });
  });

  const hero=document.querySelector('[data-hero]');
  if(hero && matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    hero.addEventListener('pointermove',event=>{
      const r=hero.getBoundingClientRect();
      const x=Math.max(0,Math.min(100,((event.clientX-r.left)/r.width)*100));
      const y=Math.max(0,Math.min(100,((event.clientY-r.top)/r.height)*100));
      hero.style.setProperty('--hero-x',x.toFixed(1)+'%');
      hero.style.setProperty('--hero-y',y.toFixed(1)+'%');
    });
    hero.addEventListener('pointerleave',()=>{
      hero.style.setProperty('--hero-x','76%');
      hero.style.setProperty('--hero-y','16%');
    });
  }
})();