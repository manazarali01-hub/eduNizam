(function(){
'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>window.EDUNIZAM_LEARNING_SEARCH?.normalize?.(v)||String(v??'').normalize('NFKC').toLocaleLowerCase('en-PK').replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
const FKEY='edunizam_guest_favorites', RKEY='edunizam_guest_recent_searches', PKEY='edunizam_guest_practice_history', PRESUME='edunizam_guest_practice_resume';
const getJSON=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}};
const setJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const pp=()=>window.EDUNIZAM_PAST_PAPERS||{}, uni=()=>window.EDUNIZAM_UNIVERSITY_DATA||{};
function favorites(){return getJSON(FKEY,[])}
function recent(){return getJSON(RKEY,[])}
function saveRecent(q){q=String(q||'').trim();if(q.length<2)return;setJSON(RKEY,[q,...recent().filter(x=>x!==q)].slice(0,6));renderRecent()}
function practiceHistory(){return getJSON(PKEY,[])}
function pushPracticeHistory(item){setJSON(PKEY,[item,...practiceHistory()].slice(0,20));renderPracticeHistory()}
function practiceWeakTopics(){
 const score=new Map();
 practiceHistory().forEach(s=>(s.weakTopics||[]).forEach(x=>{const key=[x.classLevel,x.subject,x.chapter].join('|'),prev=score.get(key)||{classLevel:x.classLevel,subject:x.subject,chapter:x.chapter,count:0};prev.count+=Number(x.count||1);score.set(key,prev)}));
 return [...score.values()].sort((a,b)=>b.count-a.count);
}
function renderPracticeHistory(){
 const box=$('guestPracticeHistory');if(!box)return;const rows=practiceHistory(),weak=practiceWeakTopics().slice(0,4);
 if(!rows.length){box.innerHTML='<span style="color:var(--muted)">No completed practice session on this device yet.</span>';return}
 const best=Math.max(...rows.map(x=>Number(x.scorePct||0))),recent=rows[0];
 box.innerHTML='<div><strong>Practice history:</strong> '+rows.length+' session'+(rows.length===1?'':'s')+' · Best MCQ score '+best+'% · Last: '+esc(recent.label||'Mixed practice')+' ('+Number(recent.scorePct||0)+'%) <button class="btn" id="guestPracticeClearHistory" type="button" style="margin-left:6px">Clear history</button></div>'+(weak.length?'<div class="search-suggestions" style="margin-top:8px"><strong style="align-self:center">Weak topics:</strong>'+weak.map(x=>'<button type="button" data-practice-weak data-class="'+esc(x.classLevel)+'" data-subject="'+esc(x.subject)+'" data-chapter="'+esc(x.chapter)+'">'+esc(x.subject+' · '+x.chapter)+' ('+x.count+')</button>').join('')+'</div>':'');
 const b=$('guestPracticeClearHistory');if(b)b.onclick=()=>{setJSON(PKEY,[]);renderPracticeHistory()};
 box.querySelectorAll('[data-practice-weak]').forEach(b=>b.onclick=()=>{
   selectAndFire('guestPracticeClass',String(b.dataset.class||''));
   selectAndFire('guestPracticeSubject',b.dataset.subject||'');
   selectAndFire('guestPracticeChapter',b.dataset.chapter||'');
   if($('guestPracticeOrder'))$('guestPracticeOrder').value='random';
   if($('guestPracticeLimit'))$('guestPracticeLimit').value='10';
   applyPracticeFilters();
   $('practiceExplorer')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
}
function practiceResume(){return getJSON(PRESUME,null)}
function clearPracticeResume(){try{localStorage.removeItem(PRESUME)}catch(_){}renderPracticeResume()}
function savePracticeResume(){if(!guestPracticeRows.length||guestPracticeFinished)return;setJSON(PRESUME,{ids:guestPracticeRows.map(x=>x.id),index:guestPracticeIndex,attempts:[...guestPracticeAttempts.entries()],savedAt:new Date().toISOString()});renderPracticeResume()}
function renderPracticeResume(){const b=$('guestPracticeResume');if(!b)return;const s=practiceResume(),count=Array.isArray(s?.ids)?s.ids.length:0;b.hidden=!count;b.textContent=count?'Resume Last Session ('+count+')':'Resume Last Session'}
function restorePracticeResume(){const s=practiceResume(),all=window.EDUNIZAM_PRACTICE_DATA?.questions||[];if(!s||!Array.isArray(s.ids))return;const map=new Map(all.map(x=>[x.id,x]));const rows=s.ids.map(id=>map.get(id)).filter(Boolean);if(!rows.length){clearPracticeResume();return}guestPracticeRows=rows;guestPracticeIndex=Math.max(0,Math.min(Number(s.index||0),rows.length-1));guestPracticeAttempts=new Map(Array.isArray(s.attempts)?s.attempts:[]);guestPracticeFinished=false;renderGuestPractice();$('practiceExplorer')?.scrollIntoView({behavior:'smooth',block:'start'})}
function allResources(){
 const out=[];
 (pp().papers||[]).forEach(x=>{const b=(pp().boards||[]).find(y=>y.id===x.boardId);out.push({id:'paper:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.type==='past'?'Past Paper':x.type,board:b?.name||'',classLevel:x.classLevel,subject:x.subject,year:x.year,session:x.session,section:'past'})});
 (window.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[]).forEach(x=>out.push({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTA / School Education',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'}));
 (window.EDUNIZAM_STUDY_DATA?.materials||[]).forEach(x=>out.push({id:'study:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,content:x.content||'',source:x.source,type:x.type,board:x.board,classLevel:(x.classLevels||[]).join('/'),subject:x.subject,section:'study'}));
 (uni().resources||[]).forEach(x=>{const u=(uni().universities||[]).find(y=>y.id===x.universityId);out.push({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',courseCodes:x.courseCodes||[],section:x.universityId==='vu'?'vu':'universities'})});
 (window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[]).forEach(x=>out.push({id:'course:'+x.code,title:x.code+' — '+x.title,description:x.freshness,url:x.officialDetails,source:'official',type:'VU Course',board:'Virtual University of Pakistan',subject:x.category,courseCodes:[x.code],section:'vu'}));
 (window.EDUNIZAM_EDUCATION_ECOSYSTEM?.resources||[]).forEach(x=>out.push({
  id:'ecosystem:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source||'official',
  type:x.category,board:x.region||'Pakistan',subject:x.stage||'',section:'ecosystem',
  keywords:[x.keywords,x.audience,x.category,x.stage,x.region].filter(Boolean).join(' ')
 }));
 (window.EDUNIZAM_EXAM_PATHWAYS?.pathways||[]).forEach(x=>out.push({
  id:'pathway:'+x.id,title:x.name+' — Guided Pathway',description:x.overview,url:'learn.html#pathways',
  source:'official',type:'Exam / Study Pathway',board:x.authority,classLevel:x.stage,subject:(x.subjects||[]).map(s=>s.name).join(' / '),
  section:'pathways',keywords:[x.keywords,(x.pattern||[]).join(' '),(x.steps||[]).map(s=>s.title+' '+s.detail).join(' ')].join(' ')
 }));
 (window.EDUNIZAM_EXAM_PREP?.exams||[]).forEach(ex=>{
   Object.entries(ex.subjects||{}).forEach(([subject,topics])=>out.push({
     id:'exam-topic:'+ex.id+':'+subject,title:ex.name+' — '+subject+' Topic Map',
     description:ex.basisLabel||'Exam preparation topic map',url:'learn.html#pathways',
     source:ex.basis?.startsWith('official')?'official':'built-in',type:'Exam Topic Map',board:ex.authority||'EduNizam',
     classLevel:ex.name,subject,section:'pathways',
     keywords:[ex.name,ex.basis,subject,(topics||[]).join(' ')].filter(Boolean).join(' ')
   }));
 });
 (window.EDUNIZAM_EXAM_PREP?.questions||[]).forEach(q=>{
   const ex=(window.EDUNIZAM_EXAM_PREP?.exams||[]).find(x=>x.id===q.examId);
   out.push({
     id:'exam-drill:'+q.id,title:(ex?.name||q.examId.toUpperCase())+' '+q.topic+' Practice',
     description:'EduNizam supplementary topic practice with answer feedback. Not an official/leaked exam question.',
     url:'learn.html#pathways',source:'built-in',type:'Exam Topic Drill',board:ex?.authority||'EduNizam',
     classLevel:ex?.name||'',subject:q.subject,section:'pathways',
     keywords:[ex?.name,q.subject,q.topic,q.difficulty,q.question].filter(Boolean).join(' ')
   });
 });
 (window.EDUNIZAM_PUBLIC_LINKS||[]).forEach(x=>out.push({...x}));
 const practiceGroups=new Map();
 (window.EDUNIZAM_PRACTICE_DATA?.questions||[]).forEach(x=>{
  const key=String(x.classLevel)+'|'+String(x.subject||'General');
  const current=practiceGroups.get(key)||{classLevel:x.classLevel,subject:x.subject||'General',count:0};
  current.count++;practiceGroups.set(key,current);
 });
 practiceGroups.forEach(x=>out.push({
  id:'practice:'+x.classLevel+':'+x.subject,
  title:(Number(x.classLevel)<=8?'Grade ':'Class ')+x.classLevel+' '+x.subject+' Practice',
  description:x.count+' built-in practice question'+(x.count===1?'':'s')+' with answers and explanations.',
  source:'built-in',type:'Practice / Quiz',board:'EduNizam',classLevel:x.classLevel,subject:x.subject,section:'practice'
 }));
 return out;
}
function injectStyles(){
 const s=document.createElement('style');s.textContent=`
 .premium-tools{display:grid;gap:12px;margin:8px 0 18px;min-width:0}.search-suggestions{display:flex;gap:7px;flex-wrap:wrap;min-width:0}.search-suggestions button,.recent-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;cursor:pointer;color:var(--ink)}.recent-search-block{min-width:0}.recent-search-title{display:block;font-size:.8rem;margin:0 0 7px}
 .guest-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.guest-actions button,.guest-actions a{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;font-weight:800;text-decoration:none;cursor:pointer}.guest-actions .primary-action{background:var(--green);color:#fff;border-color:var(--green)}
 .favorite-on{color:#8a6200;background:#fff7d9!important}.saved-panel{margin:12px 0 20px}.saved-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.smart-empty{grid-column:1/-1;padding:22px;border:1px dashed #b9ccc7;border-radius:18px;background:#fff}.smart-empty h3{margin:0 0 7px}.smart-empty p{color:var(--muted)}.related-row{display:flex;gap:8px;flex-wrap:wrap}.related-row button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer}
 body.guest-modal-open{overflow:hidden!important}.premium-modal{position:fixed;inset:0;z-index:95;background:rgba(10,27,31,.72);display:none;place-items:center;padding:14px}.premium-modal.open{display:grid}.premium-dialog{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:20px}.premium-dialog-head{display:flex;justify-content:space-between;gap:12px}.premium-meta{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.premium-preview-frame{width:100%;height:50vh;border:1px solid var(--line);border-radius:12px;background:#f4f7f6}.filter-label{display:grid;gap:5px;font-size:.76rem;font-weight:800}.filter-label select{font-weight:400}.past-advanced{grid-template-columns:repeat(4,minmax(0,1fr))!important}.past-advanced .paper-search{grid-column:span 2}.past-advanced .search-wide{grid-column:span 2}.hub-directory{margin:0 0 18px}.hub-directory .grid{grid-template-columns:repeat(4,minmax(0,1fr))}.hub-link{cursor:pointer;text-decoration:none}.hub-link strong{display:block;font-size:1rem}.hub-link span{font-size:.78rem;color:var(--muted)}
 @media(max-width:900px){.past-advanced{grid-template-columns:repeat(2,minmax(0,1fr))!important}.hub-directory .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 /* Keep VU course codes/cards inside normal document flow while scrolling. */
 .hub-directory,.premium-tools,#globalSearchResults,#savedResourcesPanel{position:relative;z-index:1;isolation:isolate;overflow:visible}
 .hub-directory .card,.resource-card,.premium-tools .card{position:relative!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;z-index:auto!important;transform:none;min-width:0;max-width:100%;overflow:hidden}
 .hub-directory .card *,.resource-card *,.premium-tools .card *{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:normal}
 .badge,.recent-chip,.search-suggestions button{position:static!important;z-index:auto!important;max-width:100%;white-space:normal;overflow-wrap:anywhere}
 #practiceExplorer,.practice-box{min-width:0;max-width:100%;overflow:visible;scroll-margin-top:86px}
 #practiceExplorer .paper-filters{position:static!important;top:auto!important;overflow:visible!important}
 #practiceExplorer select,#practiceExplorer button,.practice-box button{touch-action:manipulation}
 #guestPracticeSession{display:grid;gap:7px;margin-top:10px;overflow-wrap:anywhere}
 #guestPracticeSession progress{height:12px;accent-color:var(--green)}
 .practice-box .question{overflow-wrap:anywhere;line-height:1.55}
 .practice-box .options{display:grid;gap:9px;min-width:0}
 .practice-box .option{width:100%;min-height:48px;text-align:left;white-space:normal;overflow-wrap:anywhere;line-height:1.4}
 .practice-box .explain{overflow-wrap:anywhere;line-height:1.55}
 @media(max-width:620px){.past-advanced{grid-template-columns:1fr!important}.past-advanced .paper-search,.past-advanced .search-wide{grid-column:auto}.hub-directory .grid{grid-template-columns:1fr;overflow:visible}.guest-actions>*{flex:1 1 auto;text-align:center}.premium-dialog{padding:14px}.premium-preview-frame{height:42vh}.hub-directory .card,.resource-card{width:100%;contain:layout paint}.premium-tools{gap:8px;margin:7px 0 12px;overflow:hidden}#practiceExplorer{padding:12px!important;margin-left:0!important;margin-right:0!important}#practiceExplorer .paper-filters{gap:10px!important}#practiceExplorer select,#practiceExplorer button{width:100%;min-height:46px;font-size:16px}#practiceExplorer .filter-label{font-size:.8rem}.practice-box{padding:14px!important}.practice-box .option{min-height:50px;font-size:15px}.practice-box .guest-actions{display:grid;grid-template-columns:1fr 1fr}.practice-box .guest-actions>*{width:100%;min-height:46px}.practice-box .meta{gap:5px}#guestPracticeSession{font-size:.82rem}.search-suggestions{flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;padding:1px 1px 5px;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch}.search-suggestions::-webkit-scrollbar{display:none}.search-suggestions button,.recent-chip{flex:0 0 auto!important;width:auto!important;max-width:min(82vw,360px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.recent-search-block{overflow:hidden}.recent-search-title{margin-bottom:5px}.search-tools-collapsed #searchSuggestions{display:none}.search-tools-collapsed .recent-search-block{display:none}}

 `;document.head.appendChild(s);
}
function injectDirectory(){
 const home=$('home');if(!home)return;
 const wrap=document.createElement('div');wrap.className='hub-directory';wrap.innerHTML='<div class="section-head"><div><h2>Learning Hub</h2><p>Choose a resource center. All items below are public and need no school approval.</p></div></div><div class="grid">'+[
 ['Past Papers','past','past'],['Virtual University','vu','vu-all'],['Pakistani Universities','universities','universities'],['Admissions & Opportunities','ecosystem','ecosystem'],['Exam & Study Pathways','pathways','pathways'],['Scholarships','ecosystem','scholarships'],['Entry Tests','ecosystem','entry-tests'],['IBCC / Attestation','ecosystem','ibcc'],['Textbooks & Curriculum','ecosystem','textbooks'],['Skills / TVET','ecosystem','skills'],['Technical Boards / DAE','ecosystem','technical'],['Digital Skills','ecosystem','digital-skills'],['Accreditation / Recognition','ecosystem','accreditation'],['Research & Digital Library','ecosystem','research'],['Matric Boards','past','matric'],['Intermediate Boards','past','intermediate'],['PECTA / School Education','grade','grade'],['Notes','study','notes'],['Handouts','vu','handouts'],['Highlighted Handouts','vu','highlighted'],['MCQs','practice','practice'],['Practice Quizzes','practice','practice'],['VU Quizzes','vu','vu-quizzes'],['Guess Papers','study','guess'],['Model Papers','grade','models'],['Pairing Schemes','study','pairing'],['Date Sheets','home','datesheet'],['Results / Result Links','home','results'],['Study Library','study','study'],['Educational Resources','study','study'],['Search All Resources','home','search'],['My Saved Resources','home','saved']
 ].map(([t,id,filter])=>'<a href="#'+id+'" data-tab="'+id+'" data-hub-filter="'+filter+'" class="card hub-link"><strong>'+t+'</strong><span>Open →</span></a>').join('')+'</div>';
 home.insertBefore(wrap,home.children[1]||null);
}
function submitGlobalSearch(){
 const input=$('globalSearch');if(!input)return;
 const query=String(input.value||'').trim();if(!query)return;
 saveRecent(query);renderSuggestions();showGlobalResults(query);
 document.querySelector('.premium-tools')?.classList.add('search-tools-collapsed');
 input.blur();
}
function injectSearchTools(){
 const sw=document.querySelector('.search-wrap');if(!sw)return;
 const tools=document.createElement('div');tools.className='premium-tools';tools.innerHTML='<div id="searchSuggestions" class="search-suggestions" aria-label="Search suggestions"></div><div class="recent-search-block"><strong class="recent-search-title">Recent searches</strong><div id="recentSearches" class="search-suggestions"></div></div>';
 sw.appendChild(tools);
 const input=$('globalSearch');input.placeholder='What do you want to study? / کیا پڑھنا چاہتے ہیں؟';
 input.setAttribute('autocomplete','off');
 let submit=$('runGlobalSearch');
 if(!submit){
  submit=document.createElement('button');submit.id='runGlobalSearch';submit.className='btn primary';submit.type='button';submit.textContent='Search';
  $('clearSearch')?.before(submit);
 }
 input.addEventListener('keydown',e=>{if(e.key==='Enter')submitGlobalSearch()});
 submit?.addEventListener('click',submitGlobalSearch);
 input.addEventListener('input',()=>{tools.classList.remove('search-tools-collapsed');renderSuggestions()});
 input.addEventListener('focus',()=>tools.classList.remove('search-tools-collapsed'));
 renderRecent();renderSuggestions();
}
function renderSuggestions(){
 const box=$('searchSuggestions'),input=$('globalSearch');if(!box||!input)return;
 const q=norm(input.value);let terms=['CS101 past papers','MTH603 quizzes','VU CS101 handouts','AIOU semester pathway','MDCAT Biology inheritance drill','ECAT calculus topic map','NUST NET Physics practice','HEC HAT weightages','HAT analytical reasoning practice','CSS Current Affairs topic planner','HEC scholarship','IBCC equivalence','Punjab digital textbooks','NAVTTC short courses','HEC Digital Library','NUST NET','NUMS MDCAT','DigiSkills courses','NCEAC accreditation','PMDC recognized colleges','DAE result','PPSC result','10th class math Gujranwala board','9th physics past papers','Grade 8 PECTA model paper'];
 if(q){
  const engine=window.EDUNIZAM_LEARNING_SEARCH;
  const matches=engine?.search?.(allResources(),input.value)||allResources().filter(r=>norm(JSON.stringify(r)).includes(q));
  terms=matches.slice(0,6).map(r=>r.title);
 }
 box.innerHTML=[...new Set(terms)].slice(0,6).map(t=>'<button type="button" data-smart-query="'+esc(t)+'">'+esc(t)+'</button>').join('');
}
function renderRecent(){
 const box=$('recentSearches');if(!box)return;const arr=recent();
 box.innerHTML=arr.length?arr.map(t=>'<button type="button" data-smart-query="'+esc(t)+'">'+esc(t)+'</button>').join(''):'<span style="color:var(--muted);font-size:.8rem">Your searches stay on this device.</span>';
}
function showGlobalResults(query){
 const q=norm(query);if(!q)return;
 const resources=allResources(),engine=window.EDUNIZAM_LEARNING_SEARCH;
 const results=(engine?.search?.(resources,query)||resources.filter(r=>norm(JSON.stringify(r)).includes(q))).slice(0,24);
 const home=$('home');window.EDUNIZAM_GUEST_NAV?.show?.('home');document.querySelectorAll('.section').forEach(x=>{x.style.removeProperty('display');x.classList.toggle('active',x===home)});document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='home'));history.replaceState(null,'','#home');
 let box=$('globalResults');if(!box){box=document.createElement('div');box.id='globalResults';home.insertBefore(box,home.firstChild)}
 box.innerHTML='<div class="section-head"><div><h2>Search results</h2><p>'+results.length+' matching public resources for “'+esc(query)+'”.</p></div></div><div class="grid">'+(results.length?results.map(resourceCard).join(''):emptyState(query))+'</div>';
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
function emptyState(query){
 return '<div class="smart-empty"><h3>Exact resource not available yet.</h3><p>EduNizam did not find a genuine indexed match for “'+esc(query)+'”. Try a broader term or open a trusted resource center.</p><div class="related-row"><button data-tab="past">Past Papers</button><button data-tab="vu">Virtual University</button><button data-tab="grade">PECTA Grade 5/8</button><button data-tab="study">Study Library</button><button data-tab="ecosystem">Admissions & Opportunities</button><button data-tab="pathways">Exam Pathways</button><button data-clear-smart>Reset search</button></div></div>';
}
function resourceCard(r){
 const fav=favorites().some(x=>x.id===r.id),url=String(r.url||'').trim(),studyId=String(r.id||'').startsWith('study:')?String(r.id).slice(6):'',practiceId=String(r.id||'').startsWith('practice:'),builtIn=!!(studyId&&r.content&&!url);const meta=[r.board,r.classLevel&&((Number(r.classLevel)<=8?'Grade ':'Class ')+r.classLevel),r.subject,r.year,r.session,r.type].filter(Boolean);
 let actions='<div class="guest-actions">';
 if(practiceId)actions+='<button class="primary-action" data-start-practice data-practice-class="'+esc(r.classLevel)+'" data-practice-subject="'+esc(r.subject||'')+'">Start Practice</button>';
 else if(builtIn)actions+='<button class="primary-action" data-study-id="'+esc(studyId)+'">Read Now</button>';
 else if(url)actions+='<button class="primary-action" data-preview-id="'+esc(r.id)+'">Preview</button><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Open</a><button data-share-id="'+esc(r.id)+'">Share</button>';
 else actions+='<button class="primary-action" type="button" disabled aria-disabled="true">Source unavailable</button>';
 actions+='<button class="'+(fav?'favorite-on':'')+'" data-fav-id="'+esc(r.id)+'">'+(fav?'★ Saved':'☆ Save')+'</button></div>';
 return '<article class="card resource-card"><span class="badge '+(r.source==='official'?'official':r.source==='verified'?'verified':'builtin')+'">'+esc(r.source==='official'?'Official Source':r.source==='verified'?'External Study Resource':'EduNizam Resource')+'</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.description||'Public educational resource.')+'</p><div class="meta">'+meta.map(x=>'<span class="badge">'+esc(x)+'</span>').join('')+'</div>'+actions+'</article>';
}
function injectPastFilters(){
 const f=document.querySelector('#past .paper-filters');if(!f)return;f.classList.add('past-advanced');
 const level=document.createElement('label');level.className='filter-label';level.innerHTML='Education Level<select id="paperLevel"><option value="">All Levels</option><option value="matric">Matric</option><option value="intermediate">Intermediate</option><option value="university">University</option><option value="vu">Virtual University</option><option value="school">PECTA / School Level</option></select>';
 const session=document.createElement('label');session.className='filter-label';session.innerHTML='Session<select id="paperSession"><option value="">All Sessions</option><option value="Annual">Annual</option><option value="Second Annual">Supplementary / Second Annual</option></select>';
 f.insertBefore(level,f.firstChild);f.insertBefore(session,$('searchPapers'));
 $('paperLevel').addEventListener('change',cascadePast);$('paperClass').addEventListener('change',cascadePast);$('paperBoard').addEventListener('change',cascadePast);
 cascadePast();
}
function cascadePast(){
 const d=pp(),level=$('paperLevel')?.value||'',board=$('paperBoard')?.value||'',current=$('paperClass')?.value||'',special=['school','university','vu'].includes(level);
 if($('paperBoard')){$('paperBoard').disabled=special;if(special)$('paperBoard').value=''}
 let classes=level==='school'?['5','8']:level==='matric'?['9','10']:level==='intermediate'?['11','12']:special?[]:['9','10','11','12'];
 const b=(d.boards||[]).find(x=>x.id===board);if(b)classes=classes.filter(x=>(b.classes||[]).map(String).includes(x));
 $('paperClass').innerHTML='<option value="">All Classes</option>'+classes.map(x=>'<option value="'+x+'">'+(x==='11'?'11th / 1st Year':x==='12'?'12th / 2nd Year':x==='5'?'Grade 5':x==='8'?'Grade 8':x+'th Class')+'</option>').join('');
 $('paperClass').disabled=level==='university'||level==='vu';
 if(classes.includes(current))$('paperClass').value=current;
 const cl=$('paperClass').value;const subs=(level==='university'||level==='vu')?[]:(cl?(d.subjects?.[cl]||[]):[...new Set(Object.values(d.subjects||{}).flat())].sort());
 $('paperSubject').innerHTML='<option value="">All Subjects</option>'+subs.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
 $('paperSubject').disabled=level==='university'||level==='vu';
}
 
function injectSectionExplorers(){
 const grade=$('grade');if(grade&&!$('gradeExplorer')){
  const p=document.createElement('div');p.id='gradeExplorer';p.className='card';p.style.marginBottom='16px';
  p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label">Grade<select id="guestGrade"><option value="">All Grades</option><option value="5">Grade 5</option><option value="8">Grade 8</option></select></label><label class="filter-label">Subject<select id="guestGradeSubject"><option value="">All Subjects</option></select></label><label class="filter-label">Resource type<select id="guestGradeType"><option value="">All Resources</option></select></label><button class="btn primary" id="guestGradeSearch">Filter Resources</button></div><div id="guestGradeResults" class="grid"></div>';
  grade.insertBefore(p,$('gradeGrid'));
  const data=()=>window.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[];
  const subjectParts=x=>String(x.subject||'').split('/').map(s=>s.trim()).filter(Boolean).filter(s=>!/^all subjects$/i.test(s)).map(s=>/^science$/i.test(s)?'General Science':s);
  const refreshGradeOptions=()=>{
   const g=$('guestGrade').value,currentSubject=$('guestGradeSubject').value,currentType=$('guestGradeType').value;
   const base=data().filter(x=>!g||String(x.grade)===g);
   const subjects=[...new Set(base.flatMap(subjectParts))].sort();
   $('guestGradeSubject').innerHTML='<option value="">All Subjects</option>'+subjects.map(x=>'<option>'+esc(x)+'</option>').join('');
   if(subjects.includes(currentSubject))$('guestGradeSubject').value=currentSubject;
   const s=norm($('guestGradeSubject').value);
   const typed=base.filter(x=>!s||norm(x.subject).includes(s)||norm(x.subject)==='all subjects');
   const types=[...new Set(typed.map(x=>x.type).filter(Boolean))].sort();
   $('guestGradeType').innerHTML='<option value="">All Resources</option>'+types.map(x=>'<option>'+esc(x)+'</option>').join('');
   if(types.includes(currentType))$('guestGradeType').value=currentType;
  };
  const run=()=>{
   refreshGradeOptions();
   const g=$('guestGrade').value,s=norm($('guestGradeSubject').value),t=norm($('guestGradeType').value);
   const rows=data().filter(x=>{const subj=norm(x.subject),xt=norm(x.type),subjectOK=!s||subj.includes(s)||subj==='all subjects'||(s==='general science'&&/(^| )science( |$)/.test(subj)),typeOK=!t||xt===t||(t.startsWith('model paper')&&xt.startsWith('model paper'));return (!g||String(x.grade)===g)&&subjectOK&&typeOK});
   if(rows.length){
    $('guestGradeResults').innerHTML=rows.map(x=>resourceCard({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTAA / School Education',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'})).join('');
   }else{
    const nearest=data().filter(x=>{const subj=norm(x.subject),subjectOK=!s||subj.includes(s)||subj==='all subjects'||(s==='general science'&&/(^| )science( |$)/.test(subj));return (!g||String(x.grade)===g)&&subjectOK}).slice(0,6);
    $('guestGradeResults').innerHTML=nearest.length
      ?'<div class="smart-empty"><h3>No exact resource of this type is currently indexed.</h3><p>Showing the closest genuine Grade '+esc(g||'5/8')+' resources instead. EduNizam does not invent an unavailable model paper.</p></div>'+nearest.map(x=>resourceCard({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTAA / School Education',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'})).join('')
      :emptyState('Grade '+g+' '+$('guestGradeSubject').value);
   }
  };
  $('guestGradeSearch').onclick=run;
  $('guestGrade').onchange=()=>{refreshGradeOptions();run()};
  $('guestGradeSubject').onchange=()=>{refreshGradeOptions();run()};
  $('guestGradeType').onchange=run;
  refreshGradeOptions();run();
 }
 const study=$('study');if(study&&!$('studyExplorer')){
  const p=document.createElement('div');p.id='studyExplorer';p.className='card';p.style.marginBottom='16px';
  p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label search-wide">Search Study Library<input id="guestStudyQuery" type="search" placeholder="e.g. Class 10 Physics, pairing scheme, formula sheet"></label><label class="filter-label">Class<select id="guestStudyClass"><option value="">All Classes</option></select></label><label class="filter-label">Subject<select id="guestStudySubject"><option value="">All Subjects</option></select></label><label class="filter-label">Resource type<select id="guestStudyType"><option value="">All Resources</option></select></label><button class="btn primary" id="guestStudySearch">Search Library</button></div><div id="guestStudySummary" class="paper-summary"></div><div id="guestStudyResults" class="grid"></div>';
  study.insertBefore(p,$('studyGrid'));
  const data=()=>window.EDUNIZAM_STUDY_DATA?.materials||[];
  const parts=v=>String(v||'').split('/').map(x=>x.trim()).filter(Boolean).filter(x=>!/^all subjects$/i.test(x));
  const refreshTypes=()=>{
   const clEl=$('guestStudyClass'),subEl=$('guestStudySubject'),typeEl=$('guestStudyType');
   const oldCl=clEl.value,oldSub=subEl.value,oldType=typeEl.value;
   const classes=[...new Set(data().flatMap(x=>(x.classLevels||[]).map(String)))].sort((a,b)=>Number(a)-Number(b));
   clEl.innerHTML='<option value="">All Classes</option>'+classes.map(x=>'<option value="'+esc(x)+'">Class '+esc(x)+'</option>').join('');
   if(classes.includes(oldCl))clEl.value=oldCl;
   const base=data().filter(x=>!clEl.value||(x.classLevels||[]).map(String).includes(clEl.value));
   const subjects=[...new Set(base.flatMap(x=>parts(x.subject)))].sort();
   subEl.innerHTML='<option value="">All Subjects</option>'+subjects.map(x=>'<option>'+esc(x)+'</option>').join('');
   if(subjects.includes(oldSub))subEl.value=oldSub;
   const bySubject=base.filter(x=>!subEl.value||norm(x.subject).includes(norm(subEl.value))||norm(x.subject)==='all subjects');
   const types=[...new Set(bySubject.map(x=>x.type).filter(Boolean))].sort();
   typeEl.innerHTML='<option value="">All Resources</option>'+types.map(x=>'<option>'+esc(x)+'</option>').join('');
   if(types.includes(oldType))typeEl.value=oldType;
  };
  const run=()=>{
   refreshTypes();
   const q=norm($('guestStudyQuery').value),cl=$('guestStudyClass').value,sub=norm($('guestStudySubject').value),type=norm($('guestStudyType').value);
   const rows=data().filter(x=>(!q||norm(JSON.stringify(x)).includes(q))&&(!cl||(x.classLevels||[]).map(String).includes(cl))&&(!sub||norm(x.subject).includes(sub)||norm(x.subject)==='all subjects')&&(!type||norm(x.type)===type));
   $('guestStudySummary').textContent=rows.length+' study resource'+(rows.length===1?'':'s')+' available for the selected filters.';
   $('guestStudyResults').innerHTML=rows.length?rows.map(x=>studyCard(x)).join(''):emptyState($('guestStudyQuery').value||[$('guestStudyClass').value,$('guestStudySubject').value,$('guestStudyType').value].filter(Boolean).join(' '));
  };
  $('guestStudySearch').onclick=run;
  $('guestStudyQuery').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
  $('guestStudyClass').onchange=()=>{refreshTypes();run()};
  $('guestStudySubject').onchange=()=>{refreshTypes();run()};
  $('guestStudyType').onchange=run;
  refreshTypes();run();
 }
 const unis=$('universities');if(unis&&!$('universityExplorer')){
  const p=document.createElement('div');p.id='universityExplorer';p.className='card';p.style.marginBottom='16px';
  const universities=()=> (uni().universities||[]).filter(x=>x.id!=='vu');
  const resources=()=> (uni().resources||[]).filter(x=>x.universityId!=='vu');
  p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label search-wide">Search university/resource<input id="guestUniversityQuery" type="search" placeholder="e.g. Punjab University past papers"></label><label class="filter-label">University<select id="guestUniversity"><option value="">All Universities</option></select></label><label class="filter-label">Resource<select id="guestUniversityType"><option value="">All Resources</option></select></label><button class="btn primary" id="guestUniversitySearch">Search Resources</button></div><div id="guestUniversitySummary" class="paper-summary"></div><div id="guestUniversityResults" class="grid"></div>';
  unis.insertBefore(p,$('universityGrid'));
  const refresh=()=>{
   const idEl=$('guestUniversity'),typeEl=$('guestUniversityType'),oldId=idEl.value,oldType=typeEl.value,us=universities();
   idEl.innerHTML='<option value="">All Universities</option>'+us.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
   if(us.some(x=>x.id===oldId))idEl.value=oldId;
   const base=resources().filter(x=>!idEl.value||x.universityId===idEl.value);
   const types=[...new Set(base.map(x=>x.category).filter(Boolean))].sort();
   typeEl.innerHTML='<option value="">All Resources</option>'+types.map(x=>'<option>'+esc(x)+'</option>').join('');
   if(types.includes(oldType))typeEl.value=oldType;
  };
  const run=()=>{
   refresh();
   const id=$('guestUniversity').value,t=norm($('guestUniversityType').value),q=norm($('guestUniversityQuery').value),us=universities();
   let rows=resources().filter(x=>{
    const u=us.find(y=>y.id===x.universityId);
    return (!id||x.universityId===id)&&(!t||norm(x.category)===t)&&(!q||norm(JSON.stringify(x)+' '+(u?.name||'')).includes(q));
   });
   if(id&&!rows.length&&!q){const u=us.find(x=>x.id===id);if(u)rows=[{id:u.id+'-portal',universityId:u.id,title:u.name+' Official Portal',url:u.officialUrl,source:'official',category:'Academic Resources',note:'Official university portal for current academic, examination and student resources.'}]}
   $('guestUniversitySummary').textContent=rows.length+' university resource'+(rows.length===1?'':'s')+(q?' matching “'+$('guestUniversityQuery').value.trim()+'”':'')+'.';
   $('guestUniversityResults').innerHTML=rows.length?rows.map(x=>{const u=us.find(y=>y.id===x.universityId);return resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',section:'universities'})}).join(''):emptyState($('guestUniversityQuery').value||'university resources');
  };
  $('guestUniversitySearch').onclick=run;
  $('guestUniversityQuery').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
  $('guestUniversity').onchange=()=>{refresh();run()};
  $('guestUniversityType').onchange=run;
  refresh();run();
 }
 const practice=$('practice');if(practice&&!$('practiceExplorer')){
  const p=document.createElement('div');p.id='practiceExplorer';p.className='card';p.style.marginBottom='16px';
  p.innerHTML='<div class="paper-filters past-advanced">'+
   '<label class="filter-label search-wide">Search topic/question<input id="guestPracticeQuery" type="search" placeholder="e.g. gravitation, logarithms, genetics"></label>'+ 
   '<label class="filter-label">Class<select id="guestPracticeClass"><option value="">All Classes</option></select></label>'+
   '<label class="filter-label">Subject<select id="guestPracticeSubject"><option value="">All Subjects</option></select></label>'+
   '<label class="filter-label">Chapter<select id="guestPracticeChapter"><option value="">All Chapters</option></select></label>'+
   '<label class="filter-label">Question type<select id="guestPracticeType"><option value="">All Types</option></select></label>'+
   '<label class="filter-label">Difficulty<select id="guestPracticeDifficulty"><option value="">All Levels</option></select></label>'+
   '<label class="filter-label">Order<select id="guestPracticeOrder"><option value="sequential">Sequential</option><option value="random">Random</option></select></label>'+
   '<label class="filter-label">Session size<select id="guestPracticeLimit"><option value="10">10 questions</option><option value="20">20 questions</option><option value="all">All matching questions</option></select></label>'+
   '<button class="btn primary" id="guestPracticeApply">Start Practice</button>'+
   '<button class="btn" id="guestPracticeRestart" type="button">Restart Session</button><button class="btn" id="guestPracticeResume" type="button" hidden>Resume Last Session</button>'+
   '</div><div id="guestPracticeCoverage" class="paper-summary"></div><div id="guestPracticeSummary" class="paper-summary" aria-live="polite"></div><div id="guestPracticeSession" class="paper-summary" aria-live="polite"></div><div id="guestPracticeHistory" class="paper-summary" aria-live="polite"></div>';
  practice.insertBefore(p,practice.firstChild.nextSibling);
  const baseActions=practice.querySelector('.practice-actions');if(baseActions){baseActions.hidden=true;baseActions.style.display='none';baseActions.setAttribute('aria-hidden','true')}
  const allQuestions=()=>window.EDUNIZAM_PRACTICE_DATA?.questions||[];
  const unique=arr=>[...new Set(arr.filter(Boolean))];
  const setOptions=(el,allLabel,values,current)=>{
   el.innerHTML='<option value="">'+allLabel+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
   if(values.includes(current))el.value=current;
  };
  function refreshPracticeOptions(){
   const all=allQuestions(),clEl=$('guestPracticeClass'),subEl=$('guestPracticeSubject'),chEl=$('guestPracticeChapter'),typeEl=$('guestPracticeType'),dfEl=$('guestPracticeDifficulty');
   const oldCl=clEl.value,oldSub=subEl.value,oldCh=chEl.value,oldType=typeEl.value,oldDf=dfEl.value;
   const classes=unique(all.map(x=>String(x.classLevel))).sort((a,b)=>Number(a)-Number(b));setOptions(clEl,'All Classes',classes,oldCl);
   const cl=clEl.value;
   const byClass=all.filter(x=>!cl||String(x.classLevel)===cl);
   const subjects=unique(byClass.map(x=>x.subject)).sort();setOptions(subEl,'All Subjects',subjects,oldSub);
   const sub=subEl.value;
   const bySubject=byClass.filter(x=>!sub||x.subject===sub);
   const chapters=unique(bySubject.map(x=>x.chapter)).sort();setOptions(chEl,'All Chapters',chapters,oldCh);
   const chapter=chEl.value;
   const byChapter=bySubject.filter(x=>!chapter||x.chapter===chapter);
   const types=unique(byChapter.map(x=>x.type)).sort();setOptions(typeEl,'All Types',types,oldType);
   [...typeEl.options].forEach(o=>{if(o.value==='mcq')o.textContent='MCQ';else if(o.value==='short')o.textContent='Short Answer';else if(o.value==='long')o.textContent='Long Answer'});
   const type=typeEl.value;
   const byType=byChapter.filter(x=>!type||x.type===type);
   const difficulties=unique(byType.map(x=>x.difficulty)).sort((a,b)=>['Easy','Medium','Hard'].indexOf(a)-['Easy','Medium','Hard'].indexOf(b));setOptions(dfEl,'All Levels',difficulties,oldDf);
   const diff=dfEl.value,q=norm($('guestPracticeQuery')?.value||'');
   const count=byType.filter(x=>(!diff||x.difficulty===diff)&&(!q||norm([x.subject,x.chapter,x.question].join(' ')).includes(q))).length;
   const totalChapters=unique(all.map(x=>String(x.classLevel)+'|'+x.subject+'|'+x.chapter)).length,totalSubjects=unique(all.map(x=>String(x.classLevel)+'|'+x.subject)).length;
   $('guestPracticeCoverage').textContent=all.length+' built-in questions · '+totalChapters+' chapter/topic groups · '+totalSubjects+' class-subject groups. Practice is concept-focused unless a board/source is explicitly labelled.';
   $('guestPracticeSummary').textContent=count+' practice question'+(count===1?'':'s')+' available for the selected filters.';
   $('guestPracticeApply').textContent='Start Practice'+(count?' ('+count+')':'');
  }
  ['guestPracticeClass','guestPracticeSubject','guestPracticeChapter','guestPracticeType','guestPracticeDifficulty'].forEach(id=>$(id).onchange=refreshPracticeOptions);
  $('guestPracticeQuery').addEventListener('input',refreshPracticeOptions);
  $('guestPracticeQuery').addEventListener('keydown',e=>{if(e.key==='Enter')applyPracticeFilters()});
  $('guestPracticeApply').onclick=applyPracticeFilters;
  $('guestPracticeRestart').onclick=()=>applyPracticeFilters();
  $('guestPracticeResume').onclick=restorePracticeResume;
  refreshPracticeOptions();
  const savedResume=practiceResume();if(savedResume&&Array.isArray(savedResume.ids)&&savedResume.ids.length){renderPracticeResume();const box=$('guestPracticeSummary');if(box)box.textContent='An unfinished practice session is available. Resume it or start a new session with the filters above.'}else applyPracticeFilters();
  renderPracticeHistory();
 }
}
let guestPracticeRows=[],guestPracticeIndex=0,guestPracticeAttempts=new Map(),guestPracticeFinished=false;
function shufflePractice(rows){
 return window.EDUNIZAM_PRACTICE_CORE?.shuffled?.(rows)||[...rows];
}
function practiceSessionStats(){
 return window.EDUNIZAM_PRACTICE_CORE?.sessionStats?.(guestPracticeRows,guestPracticeAttempts)||{attempted:0,correct:0,mcqAttempted:0,reviewed:0,pending:guestPracticeRows.length};
}
function updatePracticeSessionStatus(){
 const box=$('guestPracticeSession');if(!box)return;
 if(!guestPracticeRows.length){box.textContent='';return}
 const st=practiceSessionStats(),position=Math.min(guestPracticeIndex+1,guestPracticeRows.length),pct=Math.round(st.attempted/guestPracticeRows.length*100);
 box.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><strong>Question '+position+'/'+guestPracticeRows.length+'</strong><span>Answered: '+st.attempted+'</span><span>MCQ score: '+st.correct+'/'+st.mcqAttempted+'</span><span>Written reviewed: '+st.reviewed+'</span><span>Pending: '+st.pending+'</span></div><progress max="'+guestPracticeRows.length+'" value="'+st.attempted+'" style="width:100%;margin-top:7px" aria-label="Practice questions answered"></progress><span style="font-size:.78rem;color:var(--muted)">'+pct+'% answered</span>';
}
function finishGuestPractice(){
 if(guestPracticeFinished)return;
 guestPracticeFinished=true;
 const st=practiceSessionStats(),pct=st.mcqAttempted?Math.round(st.correct/st.mcqAttempted*100):0,skipped=st.pending;
 const missed=guestPracticeRows.filter(q=>{const a=guestPracticeAttempts.get(q.id);return !a||(a.kind==='mcq'&&a.correct!==true)});
 const label=[$('guestPracticeClass')?.value&&((Number($('guestPracticeClass').value)<=8?'Grade ':'Class ')+$('guestPracticeClass').value),$('guestPracticeSubject')?.value,$('guestPracticeChapter')?.value].filter(Boolean).join(' · ')||'Mixed practice';
 const weakMap=new Map();missed.forEach(x=>{const key=[x.classLevel,x.subject,x.chapter||'General'].join('|'),v=weakMap.get(key)||{classLevel:x.classLevel,subject:x.subject,chapter:x.chapter||'General',count:0};v.count++;weakMap.set(key,v)});
 pushPracticeHistory({at:new Date().toISOString(),label,count:guestPracticeRows.length,mcqAttempted:st.mcqAttempted,correct:st.correct,reviewed:st.reviewed,skipped,scorePct:pct,weakTopics:[...weakMap.values()]});
 $('practiceMeta').innerHTML='<span class="badge">Session complete</span><span class="badge">'+guestPracticeRows.length+' questions</span><span class="badge">'+pct+'% MCQ score</span>';
 $('practiceQuestion').textContent='Practice session completed.';
 $('practiceExplain').hidden=false;
 $('practiceExplain').textContent=st.mcqAttempted?'MCQ score: '+st.correct+'/'+st.mcqAttempted+' ('+pct+'%). Written answers reviewed: '+st.reviewed+'. Skipped: '+skipped+'. Review queue: '+missed.length+'.':'Written answers reviewed: '+st.reviewed+'. Skipped: '+skipped+'. Review queue: '+missed.length+'.';
 $('practiceOptions').innerHTML='<div class="guest-actions"><button class="primary-action" id="guestPracticeAgain">Practice Again</button><button id="guestPracticeReview" '+(missed.length?'':'disabled')+'>Review Missed ('+missed.length+')</button><button id="guestPracticeChange">Change Filters</button></div>';
 $('guestPracticeAgain').onclick=()=>applyPracticeFilters();
 const review=$('guestPracticeReview');if(review&&!review.disabled)review.onclick=()=>{guestPracticeRows=missed;guestPracticeIndex=0;guestPracticeAttempts=new Map();guestPracticeFinished=false;renderGuestPractice()};
 $('guestPracticeChange').onclick=()=>{$('practiceExplorer')?.scrollIntoView({behavior:'smooth',block:'start'})};
 updatePracticeSessionStatus();
 renderPracticeHistory();
 clearPracticeResume();
}
function renderGuestPractice(){
 const x=guestPracticeRows[guestPracticeIndex];if(!x)return;
 guestPracticeFinished=false;
 const attempt=guestPracticeAttempts.get(x.id);
 $('practiceMeta').innerHTML='<span class="badge">'+(Number(x.classLevel)<=8?'Grade ':'Class ')+esc(x.classLevel)+'</span><span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.chapter||'General')+'</span><span class="badge">'+esc(x.type==='mcq'?'MCQ':x.type==='short'?'Short Answer':x.type==='long'?'Long Answer':x.type)+'</span><span class="badge">'+esc(x.difficulty)+'</span><span class="badge">Question '+(guestPracticeIndex+1)+' of '+guestPracticeRows.length+'</span>';
 $('practiceQuestion').textContent=x.question;$('practiceExplain').hidden=true;$('practiceExplain').textContent='';
 const isLast=guestPracticeIndex>=guestPracticeRows.length-1;
 const nav='<div class="guest-actions" style="margin-top:12px"><button class="secondary" id="guestPracticePrev" '+(guestPracticeIndex===0?'disabled':'')+'>Previous</button><button class="primary-action" id="guestPracticeNext">'+(isLast?'Finish Session':'Next Question')+'</button></div>';
 if(x.type==='mcq'){
  $('practiceOptions').innerHTML=(x.options||[]).map((o,i)=>'<button class="option" data-guest-answer="'+i+'">'+esc(o)+'</button>').join('')+nav;
  const buttons=[...document.querySelectorAll('[data-guest-answer]')];
  const paint=(choice)=>{
   buttons.forEach((z,i)=>{z.classList.add(i===x.answer?'correct':(i===choice?'wrong':''));z.disabled=true});
   $('practiceExplain').hidden=false;$('practiceExplain').textContent=(choice===x.answer?'Correct. ':'Review: ')+(x.explanation||'');
  };
  if(attempt&&attempt.kind==='mcq')paint(attempt.choice);
  else buttons.forEach(b=>b.onclick=()=>{
   const n=Number(b.dataset.guestAnswer);
   if(guestPracticeAttempts.has(x.id))return;
   guestPracticeAttempts.set(x.id,{kind:'mcq',choice:n,correct:n===x.answer});
   paint(n);updatePracticeSessionStatus();savePracticeResume();
  });
 }else{
  $('practiceOptions').innerHTML='<button class="option" id="guestShowAnswer">Show suggested answer</button>'+nav;
  const show=()=>{$('practiceExplain').hidden=false;$('practiceExplain').textContent=x.answerText||'Review this answer with your current textbook/teacher.';$('guestShowAnswer').disabled=true};
  if(attempt&&attempt.kind==='written')show();
  else $('guestShowAnswer').onclick=()=>{if(!guestPracticeAttempts.has(x.id))guestPracticeAttempts.set(x.id,{kind:'written'});show();updatePracticeSessionStatus();savePracticeResume()};
 }
 const prev=$('guestPracticePrev'),next=$('guestPracticeNext');
 if(prev)prev.onclick=()=>{if(guestPracticeIndex>0){guestPracticeIndex--;savePracticeResume();renderGuestPractice()}};
 if(next)next.onclick=()=>{if(isLast)finishGuestPractice();else{guestPracticeIndex++;savePracticeResume();renderGuestPractice()}};
 updatePracticeSessionStatus();
}
function applyPracticeFilters(){
 const cl=$('guestPracticeClass')?.value||'',sub=$('guestPracticeSubject')?.value||'',chapter=$('guestPracticeChapter')?.value||'',type=$('guestPracticeType')?.value||'',diff=$('guestPracticeDifficulty')?.value||'',q=norm($('guestPracticeQuery')?.value||'');
 const all=window.EDUNIZAM_PRACTICE_DATA?.questions||[];
 let rows=window.EDUNIZAM_PRACTICE_CORE?.filterQuestions?.(all,{classLevel:cl,subject:sub,chapter,type,difficulty:diff})||
  all.filter(x=>(!cl||String(x.classLevel)===cl)&&(!sub||x.subject===sub)&&(!chapter||x.chapter===chapter)&&(!type||x.type===type)&&(!diff||x.difficulty===diff));
 if(q)rows=rows.filter(x=>norm([x.subject,x.chapter,x.question,x.explanation,x.answerText].join(' ')).includes(q));
 if(!rows.length&&q){guestPracticeRows=[];guestPracticeAttempts=new Map();guestPracticeFinished=false;$('guestPracticeSummary').textContent='No practice question matched “'+$('guestPracticeQuery').value.trim()+'” with the selected filters. Try a broader keyword or clear one filter.';$('practiceMeta').innerHTML='';$('practiceQuestion').textContent='No matching practice question.';$('practiceOptions').innerHTML='';$('practiceExplain').hidden=true;updatePracticeSessionStatus();return}
 if(!rows.length){
  const nearest=window.EDUNIZAM_PRACTICE_CORE?.filterQuestions?.(all,{classLevel:cl,subject:sub})||all.filter(x=>(!cl||String(x.classLevel)===cl)&&(!sub||x.subject===sub));
  rows=nearest.length?nearest:all;
  $('guestPracticeSummary')&&($('guestPracticeSummary').textContent='That exact combination is not available. Showing the closest genuine practice questions instead.');
 }
 const order=$('guestPracticeOrder')?.value||'sequential',limit=$('guestPracticeLimit')?.value||'10';
 rows=window.EDUNIZAM_PRACTICE_CORE?.selectSession?.(rows,{}, {order,limit})||
  (order==='random'?shufflePractice(rows):rows).slice(0,limit==='all'?rows.length:Math.max(1,Number(limit)||10));
 guestPracticeRows=rows;guestPracticeIndex=0;guestPracticeAttempts=new Map();guestPracticeFinished=false;
 if(guestPracticeRows.length)savePracticeResume();
 if(!guestPracticeRows.length){$('practiceMeta').innerHTML='';$('practiceQuestion').textContent='No practice questions are available yet.';$('practiceOptions').innerHTML='';$('practiceExplain').hidden=true;updatePracticeSessionStatus();return}
 renderGuestPractice();
}
function studyCard(x){if(x.url||x.fileUrl)return resourceCard({id:'study:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:x.board,classLevel:(x.classLevels||[]).join('/'),subject:x.subject,section:'study'});return '<article class="card"><span class="badge builtin">EduNizam Resource</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.note||'Built-in study material available instantly.')+'</p><div class="meta"><span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.type)+'</span></div><div class="guest-actions"><button class="primary-action" data-study-id="'+esc(x.id)+'">Read Now</button><button data-fav-id="study:'+esc(x.id)+'">☆ Save</button></div></article>'}
function openStudy(id){const x=(window.EDUNIZAM_STUDY_DATA?.materials||[]).find(v=>v.id===id);if(!x)return;let m=$('premiumResourceModal');if(!m){openPreview('study:'+id);m=$('premiumResourceModal')}if(!m){m=document.createElement('div');m.id='premiumResourceModal';m.className='premium-modal';m.innerHTML='<div class="premium-dialog"><div class="premium-dialog-head"><h2 id="premiumPreviewTitle"></h2><button class="btn" data-close-premium>Close</button></div><div id="premiumPreviewMeta" class="premium-meta"></div><p id="premiumPreviewDesc"></p><div id="premiumPreviewBody"></div><div id="premiumPreviewActions" class="guest-actions"></div></div>';document.body.appendChild(m)}$('premiumPreviewTitle').textContent=x.title;$('premiumPreviewMeta').innerHTML='<span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.type)+'</span>';$('premiumPreviewDesc').textContent=x.note||'';$('premiumPreviewBody').innerHTML='<div class="notice" style="white-space:pre-wrap">'+esc(x.content||'')+'</div>';$('premiumPreviewActions').innerHTML='<button onclick="window.print()">Print</button><button data-fav-id="study:'+esc(x.id)+'">☆ Save</button>';m.classList.add('open')}
function injectSaved(){
 const home=$('home');if(!home)return;const sec=document.createElement('div');sec.className='saved-panel card';sec.innerHTML='<div class="saved-head"><div><h3 style="margin:0">My Saved Resources</h3><p style="margin:4px 0 0">Saved locally on this browser — no login required.</p></div><button class="btn" id="clearFavorites">Clear all</button></div><div id="savedResources" class="grid" style="margin-top:14px"></div>';home.appendChild(sec);$('clearFavorites').onclick=()=>{setJSON(FKEY,[]);renderSaved()};renderSaved();
}
function renderSaved(){const box=$('savedResources');if(!box)return;const ids=favorites().map(x=>x.id),map=new Map(allResources().map(x=>[x.id,x]));const rows=ids.map(id=>map.get(id)).filter(Boolean);box.innerHTML=rows.length?rows.map(resourceCard).join(''):'<div class="empty">No saved resources yet. Use ☆ Save on any resource.</div>'}
function openPreview(id){
 const r=allResources().find(x=>x.id===id);if(!r)return;if(!r.url&&r.content&&String(r.id).startsWith('study:')){openStudy(String(r.id).slice(6));return}let m=$('premiumResourceModal');if(!m){m=document.createElement('div');m.id='premiumResourceModal';m.className='premium-modal';m.innerHTML='<div class="premium-dialog" role="dialog" aria-modal="true" aria-labelledby="premiumPreviewTitle"><div class="premium-dialog-head"><h2 id="premiumPreviewTitle" style="margin:0"></h2><button class="btn" data-close-premium>Close</button></div><div id="premiumPreviewMeta" class="premium-meta"></div><p id="premiumPreviewDesc"></p><div id="premiumPreviewBody"></div><div id="premiumPreviewActions" class="guest-actions"></div></div>';document.body.appendChild(m)}
 $('premiumPreviewTitle').textContent=r.title;$('premiumPreviewDesc').textContent=r.description||'';
 $('premiumPreviewMeta').innerHTML=[r.board,r.classLevel&&('Class '+r.classLevel),r.subject,r.year,r.session,r.type,r.source==='official'?'Official Source':'External / EduNizam Resource'].filter(Boolean).map(x=>'<span class="badge">'+esc(x)+'</span>').join('');
 const isPdf=/\.pdf(?:$|[?#])/i.test(r.url||'');$('premiumPreviewBody').innerHTML=isPdf?'<iframe class="premium-preview-frame" src="'+esc(r.url)+'" title="'+esc(r.title)+'"></iframe>':'<div class="notice">This source is a web page rather than a directly hosted document. Open it at the source to view the genuine content.</div>';
 $('premiumPreviewActions').innerHTML='<a class="primary-action" href="'+esc(r.url||'#')+'" target="_blank" rel="noopener noreferrer">Open Source</a>'+(isPdf?'<button data-print-url="'+esc(r.url)+'">Print</button>':'')+'<button data-share-id="'+esc(r.id)+'">Share</button><button data-fav-id="'+esc(r.id)+'">'+(favorites().some(x=>x.id===r.id)?'★ Saved':'☆ Save')+'</button>';
 m.classList.add('open');document.body.classList.add('guest-modal-open');
}
function closePremium(){const m=$('premiumResourceModal');if(m)m.classList.remove('open');document.body.classList.remove('guest-modal-open')}
function toggleFav(id){let x=favorites();x=x.some(v=>v.id===id)?x.filter(v=>v.id!==id):[{id},...x];setJSON(FKEY,x);renderSaved();document.querySelectorAll('[data-fav-id="'+CSS.escape(id)+'"]').forEach(b=>{const on=x.some(v=>v.id===id);b.textContent=on?'★ Saved':'☆ Save';b.classList.toggle('favorite-on',on)})}
async function shareResource(id){const r=allResources().find(x=>x.id===id);if(!r)return;try{if(navigator.share)await navigator.share({title:r.title,text:r.description||'',url:r.url});else{await navigator.clipboard.writeText(r.url);alert('Resource link copied.')}}catch(_){}}
function selectAndFire(id,value){
 const el=$(id);if(!el)return false;
 const opt=[...el.options].find(o=>o.value===value||o.textContent===value);if(!opt)return false;
 el.value=opt.value;el.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function applyHubShortcut(kind){
 if(kind==='matric'){selectAndFire('paperLevel','matric');return}
 if(kind==='intermediate'){selectAndFire('paperLevel','intermediate');return}
 if(kind==='notes'){selectAndFire('guestStudyType','Quick Revision')||selectAndFire('guestStudyType','Formula Sheet');return}
 if(kind==='guess'){selectAndFire('guestStudyType','Guess / Practice Sheet');return}
 if(kind==='pairing'){selectAndFire('guestStudyType','Pairing Schemes / Model Papers');return}
 if(kind==='models'){selectAndFire('guestGradeType','Model Papers')||selectAndFire('guestGradeType','Model Paper');return}
 if(kind==='handouts'){selectAndFire('vuExplorerType','Handouts')||selectAndFire('vuGuestType','Handouts');return}
 if(kind==='highlighted'){selectAndFire('vuExplorerType','Highlighted Handouts')||selectAndFire('vuGuestType','Highlighted Handouts');return}
 if(kind==='vu-quizzes'){selectAndFire('vuExplorerType','Quizzes / MCQs')||selectAndFire('vuGuestType','Quizzes');return}
 if(kind==='practice'){selectAndFire('guestPracticeType','mcq');return}
 if(kind==='ecosystem'){return}
 if(kind==='pathways'){setTimeout(()=>document.getElementById('examPathSearch')?.focus(),0);return}
 if(kind==='scholarships'){selectAndFire('ecosystemGuestCategory','Scholarships');return}
 if(kind==='entry-tests'){selectAndFire('ecosystemGuestCategory','Entry Tests');return}
 if(kind==='ibcc'){selectAndFire('ecosystemGuestCategory','Equivalence & Attestation');return}
 if(kind==='textbooks'){selectAndFire('ecosystemGuestCategory','Textbooks & Curriculum');return}
 if(kind==='skills'){selectAndFire('ecosystemGuestCategory','Skills & TVET');return}
 if(kind==='technical'){selectAndFire('ecosystemGuestCategory','Technical Boards & Diplomas');return}
 if(kind==='digital-skills'){selectAndFire('ecosystemGuestCategory','Digital Skills & Careers');return}
 if(kind==='accreditation'){selectAndFire('ecosystemGuestCategory','Accreditation & Recognition');return}
 if(kind==='research'){selectAndFire('ecosystemGuestCategory','Research & Digital Library');return}
 if(kind==='datesheet'){$('globalSearch').value='date sheet';showGlobalResults('date sheet');document.querySelector('.premium-tools')?.classList.add('search-tools-collapsed');return}
 if(kind==='results'){$('globalSearch').value='results';showGlobalResults('results');document.querySelector('.premium-tools')?.classList.add('search-tools-collapsed');return}
 if(kind==='search'){setTimeout(()=>$('globalSearch')?.focus(),0);return}
 if(kind==='saved'){setTimeout(()=>$('savedResources')?.scrollIntoView({behavior:'smooth',block:'start'}),0)}
}
function bind(){
 document.addEventListener('click',e=>{
  const hub=e.target.closest('[data-hub-filter]');if(hub){setTimeout(()=>applyHubShortcut(hub.dataset.hubFilter),0)}
  const q=e.target.closest('[data-smart-query]');if(q){$('globalSearch').value=q.dataset.smartQuery;saveRecent(q.dataset.smartQuery);renderSuggestions();showGlobalResults(q.dataset.smartQuery);document.querySelector('.premium-tools')?.classList.add('search-tools-collapsed');$('globalSearch')?.blur();return}
  const startPractice=e.target.closest('[data-start-practice]');if(startPractice){
   document.querySelector('.tab[data-tab="practice"]')?.click();
   setTimeout(()=>{
    selectAndFire('guestPracticeClass',String(startPractice.dataset.practiceClass||''));
    selectAndFire('guestPracticeSubject',String(startPractice.dataset.practiceSubject||''));
    applyPracticeFilters();
    $('practiceExplorer')?.scrollIntoView({behavior:'smooth',block:'start'});
   },60);
   return;
  }
  const p=e.target.closest('[data-preview-id]');if(p){openPreview(p.dataset.previewId);return}
  const f=e.target.closest('[data-fav-id]');if(f){toggleFav(f.dataset.favId);return}
  const sh=e.target.closest('[data-share-id]');if(sh){shareResource(sh.dataset.shareId);return}
  const st=e.target.closest('[data-study-id]');if(st){openStudy(st.dataset.studyId);return}
  if(e.target.closest('[data-close-premium]')){closePremium();return}
  if(e.target.closest('[data-clear-smart]')){$('globalSearch').value='';$('globalResults')?.remove();document.querySelector('.premium-tools')?.classList.remove('search-tools-collapsed');renderSuggestions();return}
  const pr=e.target.closest('[data-print-url]');if(pr){const w=window.open(pr.dataset.printUrl,'_blank');if(w)setTimeout(()=>{try{w.print()}catch(_){}},900)}
 });
 $('searchPapers')?.addEventListener('click',()=>{saveRecent([$('paperBoard')?.selectedOptions[0]?.text,$('paperClass')?.selectedOptions[0]?.text,$('paperSubject')?.value,$('paperYear')?.value,$('paperSession')?.value].filter(x=>x&&!/^All/.test(x)).join(' '));setTimeout(enhancePastResults,0)});
 ['paperLevel','paperBoard','paperClass','paperSubject','paperYear','paperType','paperSession'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(()=>$('searchPapers')?.click(),0)));
 $('clearSearch')?.addEventListener('click',()=>{$('globalResults')?.remove();document.querySelector('.premium-tools')?.classList.remove('search-tools-collapsed');renderSuggestions()});
 $('globalSearch')?.addEventListener('input',()=>{$('globalResults')?.remove()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closePremium()});
 document.addEventListener('click',e=>{if(e.target?.id==='premiumResourceModal')closePremium()});
}
function enhancePastResults(){
 const grid=$('pastGrid');if(!grid)return;
 const level=$('paperLevel')?.value||'',session=$('paperSession')?.value||'';
 const query=norm($('paperSearch')?.value||''),cl=$('paperClass')?.value||'',subject=norm($('paperSubject')?.value||''),year=$('paperYear')?.value||'';
 if(level==='school'){
  const rows=(window.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[]).filter(x=>{
   if(cl&&String(x.grade)!==cl)return false;
   if(subject&&subject!=='all subjects'&&!norm(x.subject).includes(subject)&&norm(x.subject)!=='all subjects')return false;
   if(year&&String(x.year)!==year)return false;
   if(query&&!norm(JSON.stringify(x)).includes(query))return false;
   return true;
  });
  grid.innerHTML=rows.length?rows.map(x=>resourceCard({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTA',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'})).join(''):emptyState([cl&&('Grade '+cl),$('paperSubject')?.value,year,$('paperSearch')?.value].filter(Boolean).join(' ')||'school resources');
  $('paperSummary').textContent=rows.length+' school-level PECTA / assessment result'+(rows.length===1?'':'s')+'.';
  return;
 }
 if(level==='university'){
  const universities=(uni().universities||[]).filter(x=>x.id!=='vu'),resources=(uni().resources||[]).filter(x=>x.universityId!=='vu');
  let rows=resources.filter(x=>{
   if(!/past|paper|exam/i.test(String(x.category||'')+' '+String(x.title||'')))return false;
   if(query&&!norm(JSON.stringify(x)+' '+(universities.find(u=>u.id===x.universityId)?.name||'')).includes(query))return false;
   return true;
  }).map(x=>{const u=universities.find(y=>y.id===x.universityId);return {id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',section:'universities'}});
  if(query&&!rows.length){
   rows=universities.filter(u=>norm(u.name).includes(query)).map(u=>({id:'uni-portal:'+u.id,title:u.name+' Official Examination / Academic Portal',description:'Official university source for current examination notices, past-paper availability and academic resources.',url:u.officialUrl,source:'official',type:'University Portal',board:u.name,section:'universities'}));
  }
  grid.innerHTML=rows.length?rows.slice(0,24).map(resourceCard).join(''):emptyState($('paperSearch')?.value||'university past papers');
  $('paperSummary').textContent=rows.length+' university examination / past-paper result'+(rows.length===1?'':'s')+(query?' for “'+$('paperSearch').value.trim()+'”':'')+'.';
  return;
 }
 if(level==='vu'){
  const raw=String($('paperSearch')?.value||'').trim().toUpperCase();
  const courseQuery=/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(raw);
  const rows=(uni().resources||[]).filter(x=>{
   if(x.universityId!=='vu'||!/past|midterm|final/i.test(x.category||''))return false;
   const h=norm(JSON.stringify(x));
   if(query&&!h.includes(query)&&!(courseQuery&&x.courseAgnostic))return false;
   return true;
  });
  grid.innerHTML=rows.length?rows.map(x=>resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:'Virtual University',courseCodes:x.courseCodes||[],section:'vu'})).join(''):emptyState(raw||'VU exam resources');
  $('paperSummary').textContent=rows.length+' Virtual University exam-preparation / past-paper result'+(rows.length===1?'':'s')+(raw?' for '+raw:'')+'.';
  return;
 }
 if(session){
  const cards=[...grid.querySelectorAll('.card')];cards.forEach(card=>{if(!norm(card.textContent).includes(norm(session)))card.style.display='none'});
  const visible=cards.filter(card=>card.style.display!=='none');
  $('paperSummary').textContent=visible.length+' result'+(visible.length===1?'':'s')+' for '+session+'.';
  if(cards.length&&!visible.length)grid.innerHTML=emptyState(session);
 }
}

function injectVUExplorer(){
 const sec=$('vu');if(!sec||$('vuExplorer'))return;
 const panel=document.createElement('div');panel.id='vuExplorer';panel.className='card';panel.style.marginBottom='16px';
 panel.innerHTML='<div class="section-head"><div><h3 style="margin:0">VU Course Material & Download Center</h3><p style="margin:4px 0 0">Search a VU course to open its complete material pack: official handouts/notes, lectures, assignments and references plus verified community handouts, highlighted handouts, notes and exam-preparation downloads.</p></div></div><div class="paper-filters past-advanced"><label class="filter-label search-wide">Course code or title<input id="vuExplorerQuery" list="vuExplorerCourseList" type="search" placeholder="e.g. CS101, MTH301, STA301"><datalist id="vuExplorerCourseList"></datalist></label><label class="filter-label">Course category<select id="vuExplorerCategory"><option value="">All Categories</option></select></label><label class="filter-label">Resource type<select id="vuExplorerType"><option value="">All VU Resources</option></select></label><label class="filter-label">Source<select id="vuExplorerSource"><option value="">All Trust Levels</option><option value="official">Official VU</option><option value="verified">Verified Community</option><option value="legacy">Legacy Backup</option></select></label><label class="filter-label">Provider<select id="vuExplorerProvider"><option value="">All Providers</option></select></label><label class="filter-label">Access<select id="vuExplorerAccess"><option value="">All Access</option><option value="downloadable">Downloads only</option><option value="direct_download">Direct downloads only</option><option value="download_index">Download indexes</option><option value="official_open">Official open pages</option><option value="login_required">VU login required</option></select></label><button id="vuExplorerSearchBtn" class="btn primary" type="button">Search VU</button></div><div class="search-suggestions" style="margin:10px 0"><button type="button" data-vu-quick="Course Notes / Handouts">Handouts</button><button type="button" data-vu-quick="Highlighted Handouts">Highlighted</button><button type="button" data-vu-quick="Short Notes">Short Notes</button><button type="button" data-vu-quick="Lecture Videos">Videos</button><button type="button" data-vu-quick="Assignments">Assignments</button><button type="button" data-vu-quick="Quizzes / MCQs">Quizzes / MCQs</button><button type="button" data-vu-quick="Midterm Past Papers">Midterm Papers</button><button type="button" data-vu-quick="Finalterm Past Papers">Finalterm Papers</button><button type="button" data-vu-quick="Solved Past Papers">Moaaz / Waqar</button><button type="button" data-vu-quick="PPT Slides">PPT Slides</button><button type="button" data-vu-quick="Syllabus / Study Guide">Syllabus</button><button type="button" data-vu-quick="Final Project / Viva">Project / Viva</button></div><div id="vuExplorerSummary" class="paper-summary"></div><div id="vuExplorerQuick" class="grid" style="margin-bottom:12px"></div><div id="vuExplorerProviderChips" class="search-suggestions" style="margin:8px 0 12px"></div><div id="vuExplorerMaterials" class="grid" style="margin-bottom:12px"></div><div id="vuExplorerResults" class="grid"></div>';
 sec.insertBefore(panel,$('vuGrid'));
 const catalog=()=>window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[];
 const resources=()=> (uni().resources||[]).filter(x=>x.universityId==='vu');
 const refreshFilters=()=>{
  const typeEl=$('vuExplorerType'),catEl=$('vuExplorerCategory'),providerEl=$('vuExplorerProvider'),list=$('vuExplorerCourseList'),oldType=typeEl.value,oldCat=catEl.value,oldProvider=providerEl.value;
  const types=[...new Set(resources().map(x=>x.category).filter(Boolean).concat(window.EDUNIZAM_VU_MATERIALS?.types||[]))].sort();
  typeEl.innerHTML='<option value="">All VU Resources</option>'+types.map(x=>'<option>'+esc(x)+'</option>').join('');if(types.includes(oldType))typeEl.value=oldType;
  const cats=[...new Set(catalog().map(x=>x.category).filter(Boolean))].sort();
  catEl.innerHTML='<option value="">All Categories</option>'+cats.map(x=>'<option>'+esc(x)+'</option>').join('');if(cats.includes(oldCat))catEl.value=oldCat;
  const providers=['Virtual University',...(window.EDUNIZAM_VU_MATERIALS?.providers||[])];
  providerEl.innerHTML='<option value="">All Providers</option>'+providers.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');if(providers.includes(oldProvider))providerEl.value=oldProvider;
  list.innerHTML=catalog().slice().sort((a,b)=>String(a.code).localeCompare(String(b.code))).map(x=>'<option value="'+esc(x.code)+'">'+esc(x.title)+'</option>').join('');
 };
 refreshFilters();
 const quickCard=(title,desc,url,badge)=>'<article class="card resource-card"><span class="badge official">'+esc(badge||'Official VU')+'</span><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p><div class="guest-actions"><a class="primary-action" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Open Official Source</a></div></article>';
 const materialCard=m=>{
  const cls=m.trust==='official'?'official':'verified';
  return '<article class="card resource-card"><span class="badge '+cls+'">'+esc(m.accessLabel||m.source||'VU Resource')+'</span><span class="badge">'+esc(m.type||'Material')+'</span><span class="badge">'+esc(m.source||'VU')+'</span><h3>'+esc(m.title)+'</h3><p>'+esc(m.note||'')+'</p><div class="guest-actions"><a class="primary-action" href="'+esc(m.url)+'" target="_blank" rel="noopener noreferrer">'+esc(m.actionLabel||'Open Resource')+'</a></div></article>';
 };
 const run=()=>{
  const query=norm($('vuExplorerQuery').value),typeValue=$('vuExplorerType').value,type=norm(typeValue),category=$('vuExplorerCategory').value,source=$('vuExplorerSource').value,provider=$('vuExplorerProvider').value,access=$('vuExplorerAccess').value;
  const rawInput=String($('vuExplorerQuery').value||'').trim();
  const rawCode=rawInput.toUpperCase().replace(/[\\s-]+/g,'');
  const validCourseCode=/^[A-Z]{2,5}\\d{3,4}[A-Z]?$/.test(rawCode);
  const lookupQuery=validCourseCode?norm(rawCode):query;
  const courseMatches=lookupQuery?catalog().filter(x=>norm(x.code+' '+x.title+' '+x.category).includes(lookupQuery)).slice(0,30):[];
  const exactCourse=catalog().find(x=>norm(x.code)===lookupQuery);
  const course=exactCourse||(courseMatches.length===1?courseMatches[0]:null);
  let rows=resources().filter(x=>{
   const h=norm(JSON.stringify(x)),codes=(x.courseCodes||[]).map(norm);
   const typeOK=!type||h.includes(type)||(type==='midterm'&&/midterm/i.test(x.category||''))||(type==='final term'&&/final/i.test(x.category||''));
   const sourceOK=!source||x.source===source;
   if(!typeOK||!sourceOK)return false;
   if(!query)return true;
   if(validCourseCode)return x.courseAgnostic||codes.includes(lookupQuery)||h.includes(lookupQuery);
   return x.courseAgnostic||codes.includes(query)||h.includes(query);
  });
  if(category)rows=rows.filter(x=>x.courseAgnostic||norm(JSON.stringify(x)).includes(norm(category)));
  let courseRow='';
  const quick=$('vuExplorerQuick');quick.innerHTML='';
  if(course){
   const p=window.EDUNIZAM_VU_PATHWAYS?.forCourse?.(course)||{};
   const officialSearch=p.search||('https://ocw.vu.edu.pk/Courses.aspx?q='+encodeURIComponent(course.code));
   courseRow=resourceCard({id:'course:'+course.code,title:course.code+' — '+course.title,description:course.freshness,url:course.officialDetails||p.details||officialSearch,source:'official',type:'VU Course',board:'Virtual University',subject:course.category,courseCodes:[course.code],section:'vu'});
   const courseQuick=p.direct?[
    quickCard(course.code+' Course Details','Official VU OpenCourseWare course information and published learning material.',p.details,'Official OCW'),
    quickCard(course.code+' Course Overview','Official synopsis, learning outcomes and course calendar where published.',p.overview,'Official OCW'),
    quickCard(course.code+' Video Lectures','Official VU OpenCourseWare lecture videos for this course where published.',p.videos,'Official OCW'),
    quickCard(course.code+' Reference Books','Official VU OpenCourseWare reference-book page where published.',p.references,'Official OCW'),
    quickCard(course.code+' Assignments','Official VU OpenCourseWare assignment page where published. Current graded work remains in VULMS.',p.assignments,'Official OCW'),
    quickCard(course.code+' Useful Links','Official VU OpenCourseWare course links page where published.',p.links,'Official OCW')
   ]:[quickCard(course.code+' OpenCourseWare','Search the official VU OpenCourseWare directory for this exact course code.',officialSearch,'Official OCW')];
   quick.innerHTML=courseQuick.concat([
    quickCard('VU Course Catalogue','Verify the current course title, credit hours and course content in the official VU catalogue.',p.catalogue||'https://ocw.vu.edu.pk/Courses.aspx','Official Catalogue'),
    quickCard('VULMS — Current Semester','Use VULMS for current handouts, quizzes, assignments, GDBs and announcements.',p.vulms||'https://vulms.vu.edu.pk/','Official VULMS')
   ]).join('');
  }else if(validCourseCode){
   const officialSearch='https://ocw.vu.edu.pk/Courses.aspx?q='+encodeURIComponent(rawCode);
   quick.innerHTML=[
    quickCard(rawCode+' Official OCW Lookup','This code is not yet matched to a local EduNizam title. Verify it directly in official VU OpenCourseWare.',officialSearch,'Official OCW'),
    quickCard('VU Course Catalogue','Verify the course code/title in the official VU catalogue.','https://vu.edu.pk/AcademicPrograms/CoursesCatalogue','Official Catalogue'),
    quickCard('VULMS — Current Semester','Use VULMS for current semester material and announcements.','https://vulms.vu.edu.pk/','Official VULMS')
   ].join('');
  }
  const allProviderRows=course?(window.EDUNIZAM_VU_MATERIALS?.forCourse?.(course,{type:typeValue,source,access})||[]):[];
  const materialRows=provider?allProviderRows.filter(x=>x.source===provider):allProviderRows;
  const chipBox=$('vuExplorerProviderChips');
  if(chipBox){
   const counts={};allProviderRows.forEach(x=>counts[x.source]=(counts[x.source]||0)+1);
   chipBox.innerHTML=course?'<button type="button" data-vu-provider-chip="">All ('+allProviderRows.length+')</button>'+Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,count])=>'<button type="button" data-vu-provider-chip="'+esc(name)+'">'+esc(name)+' ('+count+')</button>').join(''):'';
   chipBox.querySelectorAll('[data-vu-provider-chip]').forEach(b=>b.onclick=()=>{$('vuExplorerProvider').value=b.dataset.vuProviderChip||'';run()});
  }
  const materialBox=$('vuExplorerMaterials');if(materialBox)materialBox.innerHTML=materialRows.map(materialCard).join('');
  const unique=[];const seen=new Set();rows.forEach(x=>{const id=x.id||x.title;if(!seen.has(id)){seen.add(id);unique.push(x)}});
  const categoryCourses=category&&!query&&source!=='verified'?catalog().filter(x=>x.category===category).slice(0,30):[];
  const queryCourses=query&&!exactCourse&&source!=='verified'?courseMatches:[];
  const visibleCourses=categoryCourses.length?categoryCourses:queryCourses;
  const categoryHtml=visibleCourses.map(x=>resourceCard({id:'course:'+x.code,title:x.code+' — '+x.title,description:x.freshness,url:x.officialDetails||('https://ocw.vu.edu.pk/Courses.aspx?q='+encodeURIComponent(x.code)),source:'official',type:'VU Course',board:'Virtual University',subject:x.category,courseCodes:[x.code],section:'vu'})).join('');
  const courseState=course?' · Course matched: '+course.code+' — '+course.title:(validCourseCode?' · Course code will be verified through official VU lookup':'');
  const providerCount=course?[...new Set(materialRows.map(x=>x.source).filter(Boolean))].length:0;
  $('vuExplorerSummary').textContent=(visibleCourses.length?visibleCourses.length+' matching course'+(visibleCourses.length===1?'':'s')+' · ':'')+(course?materialRows.length+' material option'+(materialRows.length===1?'':'s')+' from '+providerCount+' provider'+(providerCount===1?'':'s')+' · ':'')+unique.length+' general VU resource'+(unique.length===1?'':'s')+(query?' for “'+rawInput+'”':'')+courseState+'. Local catalogue: '+catalog().length+' courses. “Login to Download” means VU controls the actual file download behind authentication; community downloads are supplementary.';
  $('vuExplorerResults').innerHTML=courseRow+categoryHtml+(unique.length?unique.slice(0,30).map(x=>resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:'Virtual University',courseCodes:x.courseCodes||[],section:'vu'})).join(''):(!course&&!validCourseCode&&!visibleCourses.length?emptyState(rawInput||$('vuExplorerType').value||'VU resource'):''));
 };
 $('vuExplorerSearchBtn').onclick=run;
 $('vuExplorerQuery').addEventListener('keydown',e=>{if(e.key==='Enter')run()});
 ['vuExplorerType','vuExplorerCategory','vuExplorerSource','vuExplorerProvider','vuExplorerAccess'].forEach(id=>$(id).onchange=run);
 panel.querySelectorAll('[data-vu-quick]').forEach(b=>b.onclick=()=>{$('vuExplorerType').value=b.dataset.vuQuick;run()});
 run();
}
function boot(){injectStyles();injectDirectory();injectSearchTools();injectPastFilters();injectVUExplorer();injectSectionExplorers();injectSaved();bind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();