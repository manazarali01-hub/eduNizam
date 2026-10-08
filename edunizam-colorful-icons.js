/* EduNizam colorful icon system — 2026-10-08.
 * Self-contained vector icons: no icon font, CDN, external image, or dependency.
 * Replaces visual symbols only. Original text, handlers, routes, role rules,
 * accessibility labels and underlying buttons are preserved. */
(()=>{
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 const P={
   home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
   users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2z"/><path d="M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
   user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2z"/>',
   school:'<path d="M3 21V8l9-5 9 5v13M3 21h18M9 21v-6h6v6M7 10h.01M12 10h.01M17 10h.01"/>',
   upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
   attendance:'<path d="M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="m8 15 3 3 5-6"/>',
   chart:'<path d="M4 20V4M4 20h17M8 16v-4m5 4V8m5 8V5"/>',
   teacher:'<path d="M3 4h18v12H3zM8 20l4-4 4 4M7 8h6M7 11h9"/>',
   clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
   wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M15 14h6"/>',
   cap:'<path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5c3 3 9 3 12 0v-5M22 10v6"/>',
   award:'<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
   sparkle:'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/>',
   door:'<path d="M5 21V4l14-2v19M5 21h16M15 12h.01"/>',
   id:'<rect x="2.5" y="4" width="19" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5 17c.5-2 2-3 4-3s3.5 1 4 3m3-7h3m-3 4h3"/>',
   leave:'<path d="M8 3v3m8-3v3M4 8h16M5 5h14v16H5z"/><path d="m9 15 2 2 4-5"/>',
   results:'<path d="M4 20h16M6 17v-5h3v5m3 0V7h3v10m3 0V4h3v13"/>',
   book:'<path d="M12 6c-2-2-5-3-9-2v15c4-1 7 0 9 2 2-2 5-3 9-2V4c-4-1-7 0-9 2Z"/><path d="M12 6v15"/>',
   lesson:'<path d="M3 5h18v13H3zM9 22l3-4 3 4M7 9h9M7 13h6"/>',
   exam:'<path d="M7 3h9l4 4v14H7zM16 3v5h4M10 13h7M10 17h4"/><path d="m4 13 1.5 1.5L8 12"/>',
   pencil:'<path d="m4 20 4-1 12-12-3-3L5 16l-1 4ZM14 7l3 3M4 20h16"/>',
   diary:'<path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 3v18M11 9h6m-6 4h6m-6 4h4"/>',
   schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h4m-4 3h8"/>',
   calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h3m3 0h3m-9 4h3"/>',
   banknote:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 8h2m10 8h2"/>',
   receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM9 8h6m-6 4h6m-6 4h4"/>',
   package:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10M8 4l9 5"/>',
   library:'<path d="M4 3h4v18H4zM10 6h4v15h-4zM16 4l4-1 3 17-4 1z"/>',
   bus:'<rect x="4" y="3" width="16" height="17" rx="3"/><path d="M4 11h16M8 20v2m8-2v2M8 15h.01M16 15h.01M8 7h8"/>',
   pin:'<path d="M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14Z"/><circle cx="12" cy="8" r="2"/>',
   party:'<path d="m4 20 6-15 9 9L4 20ZM13 4h.01M18 3l1-1m3 8-2 2M17 19l1 2M9 13l5 5"/>',
   chat:'<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 9h8M8 13h5"/>',
   megaphone:'<path d="m3 10 14-6v16L3 14zM17 7a5 5 0 0 1 0 10M6 15l2 6h4l-2-5"/>',
   support:'<circle cx="12" cy="12" r="9"/><path d="M8 9a4 4 0 1 1 7 2l-3 2v2M12 19h.01"/>',
   paper:'<path d="M6 2h9l5 5v15H6zM15 2v6h5M10 12h7m-7 4h7"/>',
   study:'<path d="M3 4h7a3 3 0 0 1 3 3v14H6a3 3 0 0 0-3 1V4Zm18 0h-5a3 3 0 0 0-3 3v14h5a3 3 0 0 1 3 1V4Z"/>',
   landmark:'<path d="m2 9 10-6 10 6M3 10h18M5 10v9m5-9v9m4-9v9m5-9v9M2 21h20"/>',
   target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
   compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-6 2 2 4 4-6Z"/>',
   route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h9"/>',
   laptop:'<rect x="4" y="4" width="16" height="12" rx="1"/><path d="M2 20h20l-2-4H4l-2 4Z"/>',
   gears:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
   wrench:'<path d="M15 3a6 6 0 0 0-7 7L3 15a4 4 0 0 0 6 6l5-5a6 6 0 0 0 7-7l-4 4-4-4 4-4-2-2Z"/>',
   grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
   search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
   arrows:'<path d="m4 8 5-5m-5 5 5 5M4 8h16m0 8-5-5m5 5-5 5M20 16H4"/>',
   shield:'<path d="M12 2 21 6v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/>'
 };
 const views={
   dashboard:['home','blue'],students:['users','sky'],studentprofile:['user','violet'],
   classcenter:['school','teal'],bulkimport:['upload','amber'],attendance:['attendance','green'],
   attendanceanalytics:['chart','blue'],staffcenter:['teacher','violet'],stafftime:['clock','amber'],
   staffpayroll:['wallet','rose'],training:['cap','blue'],ourstudents:['award','amber'],
   behaviorcenter:['sparkle','violet'],gatecenter:['door','teal'],studentdocs:['id','sky'],
   leavecenter:['leave','green'],results:['results','blue'],schoolwork:['book','violet'],
   lessoncenter:['lesson','teal'],examcenter:['exam','rose'],paperbuilder:['pencil','amber'],
   dailydiary:['diary','sky'],schedulecenter:['schedule','violet'],calendarcenter:['calendar','teal'],
   fees:['banknote','green'],financecenter:['wallet','amber'],inventorycenter:['package','rose'],
   librarycenter:['library','violet'],transportcenter:['bus','sky'],noticeboard:['pin','rose'],
   functionscenter:['party','amber'],inboxcenter:['chat','sky'],parentcomplaints:['megaphone','rose'],
   helpdeskcenter:['support','teal'],pastpapers:['paper','blue'],practice:['pencil','rose'],
   study:['study','violet'],schoolassessments:['exam','green'],universities:['landmark','blue'],
   competitive:['award','amber'],ecosystem:['target','rose'],pathways:['route','sky'],
   vu:['laptop','violet'],admissions:['receipt','teal'],assistant:['sparkle','violet'],
   settings:['gears','blue'],troubleshoot:['wrench','amber'],help:['support','green']
 };
 const groupIcons={Core:['grid','sky'],'People & Campus':['users','teal'],
   Academics:['book','violet'],'Finance & Operations':['wallet','amber'],
   Communication:['chat','rose'],'Pakistan Learning':['cap','blue'],
   System:['gears','teal'],'Daily Work':['attendance','green'],
   Overview:['home','sky'],More:['grid','violet']};
 const svg=key=>'<svg class="edu-vector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(P[key]||P.grid)+'</svg>';
 const paint=(el,key,tone)=>{
   if(!el||!P[key]||el.dataset.eduIconKey===key&&el.dataset.eduTone===tone)return;
   el.dataset.eduIconKey=key;el.dataset.eduTone=tone;
   el.innerHTML=svg(key);
 };
 const getView=(v)=>views[v]||['grid','teal'];
 function workspace(){
   if(!document.body?.classList.contains('page-app'))return;
   document.querySelectorAll('#nav .nav-item[data-view]').forEach(btn=>{
     const holder=btn.querySelector(':scope > .premium-nav-icon');
     if(holder){const [key,tone]=getView(btn.dataset.view);paint(holder,key,tone);}
   });
   document.querySelectorAll('#nav details.nav-group').forEach((g,i)=>{
     const sum=g.querySelector(':scope > summary');
     const holder=sum?.querySelector(':scope > span:first-child');
     if(!holder)return;
     const label=sum.querySelector('strong')?.textContent?.trim()||g.dataset.groupTitle||'';
     const [key,tone]=groupIcons[label]||Object.values(groupIcons)[i%7];
     holder.classList.add('edu-group-icon');
     paint(holder,key,tone);
   });
   document.querySelectorAll('#premiumMobileDock button').forEach(btn=>{
     const box=btn.querySelector('.premium-dock-icon');
     if(!box)return;
     const [key,tone]=btn.hasAttribute('data-premium-more')?['grid','violet']:getView(btn.dataset.premiumView);
     paint(box,key,tone);
   });
   const statIcons={statStudents:['users','sky'],statPresent:['attendance','green'],
     statFees:['banknote','amber'],statPending:['clock','rose']};
   Object.entries(statIcons).forEach(([id,icon])=>{
     const node=document.getElementById(id)?.closest('.stat')?.querySelector('.premium-stat-icon');
     paint(node,...icon);
   });
   document.querySelectorAll('#adminDailyDesk [data-admin-jump]').forEach(btn=>{
     const node=btn.querySelector(':scope > span:first-child');
     if(node){node.classList.add('edu-action-icon');paint(node,...getView(btn.dataset.adminJump));}
   });
   document.querySelectorAll('.role-quick-actions [data-role-quick]').forEach(btn=>{
     paint(btn.querySelector('.role-quick-icon'),...getView(btn.dataset.roleQuick));
   });
   const campus=document.getElementById('dashboardInstituteFallback');
   if(campus&&!campus.dataset.eduIconKey){campus.classList.add('edu-campus-icon');paint(campus,'school','teal');}
   const topIcons=[['.premium-context-chip.role','sparkle','violet'],['.premium-context-chip.school','school','sky'],['.premium-context-chip.date','calendar','amber']];
   topIcons.forEach(([sel,key,tone])=>{
     const item=document.querySelector(sel);if(!item||item.querySelector('.edu-chip-icon'))return;
     const first=item.firstChild;
     if(first?.nodeType===Node.TEXT_NODE)first.textContent=first.textContent.replace(/^[✦🏫📅]+\s*/u,'');
     const chip=document.createElement('span');chip.className='edu-chip-icon';chip.dataset.eduTone=tone;chip.innerHTML=svg(key);
     item.prepend(chip);
   });
   const searchIcon=document.querySelector('#premiumSearchTrigger>span:first-child');
   if(searchIcon){searchIcon.classList.add('edu-search-icon');paint(searchIcon,'search','sky');}
   const switchIcon=document.querySelector('#premiumWorkspaceSwitch>span:first-child');
   if(switchIcon){switchIcon.classList.add('edu-search-icon');paint(switchIcon,'arrows','teal');}
 }
 function authentication(){
   if(!document.body?.classList.contains('auth-page'))return;
   const entries={admin:['school','sky'],teacher:['teacher','violet'],
     parent:['users','rose'],student:['cap','green']};
   document.querySelectorAll('#roleView .role[data-role]').forEach(node=>{
     const [key,tone]=entries[node.dataset.role]||['user','sky'];
     const holder=node.querySelector('.icon');
     if(holder){holder.classList.add('edu-auth-role-icon');paint(holder,key,tone);}
   });
   const admission=document.querySelector('#admissionApplicantRole .icon');
   if(admission){admission.classList.add('edu-auth-role-icon');paint(admission,'receipt','amber');}
   const guest=document.querySelector('#roleView .guest-role .icon');
   if(guest){guest.classList.add('edu-auth-role-icon');paint(guest,'study','teal');}
 }
 function learning(){
   if(!document.body?.classList.contains('learning-sky'))return;
   const tabs={home:['home','sky'],past:['paper','blue'],grade:['exam','green'],
     study:['study','violet'],universities:['landmark','amber'],
     competitive:['award','rose'],ecosystem:['target','teal'],pathways:['compass','sky'],
     vu:['laptop','violet'],practice:['pencil','green']};
   document.querySelectorAll('.tabs .tab[data-tab]').forEach(a=>{
     if(a.querySelector('.edu-guest-tab-icon'))return;
     const [key,tone]=tabs[a.dataset.tab]||['grid','blue'];
     const span=document.createElement('span');span.className='edu-guest-tab-icon';span.dataset.eduTone=tone;span.innerHTML=svg(key);a.prepend(span);
   });
   document.querySelectorAll('#homeCards [data-home-open]').forEach(a=>{
     if(a.querySelector('.edu-learning-card-icon'))return;
     const tab=a.dataset.homeOpen;
     const [key,tone]=tabs[tab]||['study','teal'];
     const b=document.createElement('span');b.className='edu-learning-card-icon';b.dataset.eduTone=tone;b.innerHTML=svg(key);
     const title=a.querySelector('h3');if(title)title.before(b);
   });
   const search=document.querySelector('.searchbox>span:first-child');
   if(search){search.classList.add('edu-search-icon');paint(search,'search','sky');}
 }
 function home(){
   if(!document.body?.classList.contains('page-home'))return;
   const icons=[['attendance','green'],['banknote','amber'],['results','sky'],['diary','violet'],['pencil','rose'],['study','teal']];
   document.querySelectorAll('.experience-strip article .feature-icon').forEach((el,i)=>paint(el,...icons[i%icons.length]));
 }
 function run(){workspace();authentication();learning();home();}
 let scheduled=false;
 function requestRun(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;run();});}
 function boot(){
   run();
   const observer=new MutationObserver(mutations=>{
     if(mutations.some(m=>m.type==='childList'&&Array.from(m.addedNodes).some(n=>n.nodeType===1 && !n.classList?.contains('edu-vector-icon'))))requestRun();
   });
   observer.observe(document.body,{childList:true,subtree:true});
   document.addEventListener('edunizam:workspace-ready',requestRun);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRun();});
   setTimeout(requestRun,450);setTimeout(requestRun,1600);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.EDUNIZAM_COLOR_ICONS={refresh:requestRun,viewCount:Object.keys(views).length};
})();
