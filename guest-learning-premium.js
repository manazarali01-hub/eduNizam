(function(){
'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const FKEY='edunizam_guest_favorites', RKEY='edunizam_guest_recent_searches';
const getJSON=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}};
const setJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const pp=()=>window.EDUNIZAM_PAST_PAPERS||{}, uni=()=>window.EDUNIZAM_UNIVERSITY_DATA||{};
function favorites(){return getJSON(FKEY,[])}
function recent(){return getJSON(RKEY,[])}
function saveRecent(q){q=String(q||'').trim();if(q.length<2)return;setJSON(RKEY,[q,...recent().filter(x=>x!==q)].slice(0,6));renderRecent()}
function allResources(){
 const out=[];
 (pp().papers||[]).forEach(x=>{const b=(pp().boards||[]).find(y=>y.id===x.boardId);out.push({id:'paper:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.type==='past'?'Past Paper':x.type,board:b?.name||'',classLevel:x.classLevel,subject:x.subject,year:x.year,session:x.session,section:'past'})});
 (window.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[]).forEach(x=>out.push({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTA / School Education',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'}));
 (window.EDUNIZAM_STUDY_DATA?.materials||[]).forEach(x=>out.push({id:'study:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,content:x.content||'',source:x.source,type:x.type,board:x.board,classLevel:(x.classLevels||[]).join('/'),subject:x.subject,section:'study'}));
 (uni().resources||[]).forEach(x=>{const u=(uni().universities||[]).find(y=>y.id===x.universityId);out.push({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',courseCodes:x.courseCodes||[],section:x.universityId==='vu'?'vu':'universities'})});
 (window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[]).forEach(x=>out.push({id:'course:'+x.code,title:x.code+' — '+x.title,description:x.freshness,url:x.officialDetails,source:'official',type:'VU Course',board:'Virtual University of Pakistan',subject:x.category,courseCodes:[x.code],section:'vu'}));
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
 @media(max-width:620px){.past-advanced{grid-template-columns:1fr!important}.past-advanced .paper-search,.past-advanced .search-wide{grid-column:auto}.hub-directory .grid{grid-template-columns:1fr;overflow:visible}.guest-actions>*{flex:1 1 auto;text-align:center}.premium-dialog{padding:14px}.premium-preview-frame{height:42vh}.hub-directory .card,.resource-card{width:100%;contain:layout paint}.premium-tools{gap:8px;margin:7px 0 12px;overflow:hidden}.search-suggestions{flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;padding:1px 1px 5px;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch}.search-suggestions::-webkit-scrollbar{display:none}.search-suggestions button,.recent-chip{flex:0 0 auto!important;width:auto!important;max-width:min(82vw,360px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.recent-search-block{overflow:hidden}.recent-search-title{margin-bottom:5px}.search-tools-collapsed #searchSuggestions{display:none}.search-tools-collapsed .recent-search-block{display:none}}

 `;document.head.appendChild(s);
}
function injectDirectory(){
 const home=$('home');if(!home)return;
 const wrap=document.createElement('div');wrap.className='hub-directory';wrap.innerHTML='<div class="section-head"><div><h2>Learning Hub</h2><p>Choose a resource center. All items below are public and need no school approval.</p></div></div><div class="grid">'+[
 ['Past Papers','past'],['Virtual University','vu'],['Pakistani Universities','universities'],['Matric Boards','past'],['Intermediate Boards','past'],['PECTA / School Education','grade'],['Notes','study'],['Handouts','vu'],['Highlighted Handouts','vu'],['MCQs','practice'],['Quizzes','practice'],['Guess Papers','study'],['Model Papers','grade'],['Pairing Schemes','study'],['Date Sheets','universities'],['Results / Result Links','universities'],['Study Library','study'],['Educational Resources','study'],['Search All Resources','home'],['My Saved Resources','home']
 ].map(([t,id])=>'<a href="#'+id+'" data-tab="'+id+'" class="card hub-link"><strong>'+t+'</strong><span>Open →</span></a>').join('')+'</div>';
 home.insertBefore(wrap,home.children[1]||null);
}
function injectSearchTools(){
 const sw=document.querySelector('.search-wrap');if(!sw)return;
 const tools=document.createElement('div');tools.className='premium-tools';tools.innerHTML='<div id="searchSuggestions" class="search-suggestions" aria-label="Search suggestions"></div><div class="recent-search-block"><strong class="recent-search-title">Recent searches</strong><div id="recentSearches" class="search-suggestions"></div></div>';
 sw.appendChild(tools);
 const input=$('globalSearch');input.placeholder='What do you want to study?';
 input.setAttribute('autocomplete','off');
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){saveRecent(input.value);renderSuggestions();showGlobalResults(input.value);tools.classList.add('search-tools-collapsed');input.blur()}});
 input.addEventListener('input',()=>{tools.classList.remove('search-tools-collapsed');renderSuggestions()});
 input.addEventListener('focus',()=>tools.classList.remove('search-tools-collapsed'));
 renderRecent();renderSuggestions();
}
function renderSuggestions(){
 const box=$('searchSuggestions'),input=$('globalSearch');if(!box||!input)return;
 const q=norm(input.value);let terms=['CS101 past papers','MTH301 final term','VU CS101 handouts','10th class math Gujranwala board','9th physics past papers','FSC chemistry Lahore board','Grade 8 PECTA model paper'];
 if(q){terms=allResources().filter(r=>norm(JSON.stringify(r)).includes(q)).slice(0,5).map(r=>r.title)}
 box.innerHTML=terms.slice(0,6).map(t=>'<button type="button" data-smart-query="'+esc(t)+'">'+esc(t)+'</button>').join('');
}
function renderRecent(){
 const box=$('recentSearches');if(!box)return;const arr=recent();
 box.innerHTML=arr.length?arr.map(t=>'<button type="button" data-smart-query="'+esc(t)+'">'+esc(t)+'</button>').join(''):'<span style="color:var(--muted);font-size:.8rem">Your searches stay on this device.</span>';
}
function showGlobalResults(query){
 const q=norm(query);if(!q)return;const words=q.split(' ').filter(Boolean), code=words.find(w=>/^[a-z]{2,5}[0-9]{3,4}$/.test(w)); const results=allResources().filter(r=>{const h=norm(JSON.stringify(r)); if(words.every(w=>h.includes(w)))return true; if(code&&r.section==='vu'&&/paper|midterm|final/i.test(String(r.type)))return !(r.courseCodes||[]).length||(r.courseCodes||[]).map(norm).includes(code); return false}).slice(0,24);
 const home=$('home');window.EDUNIZAM_GUEST_NAV?.show?.('home');document.querySelectorAll('.section').forEach(x=>{x.style.removeProperty('display');x.classList.toggle('active',x===home)});document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='home'));history.replaceState(null,'','#home');
 let box=$('globalResults');if(!box){box=document.createElement('div');box.id='globalResults';home.insertBefore(box,home.firstChild)}
 box.innerHTML='<div class="section-head"><div><h2>Search results</h2><p>'+results.length+' matching public resources for “'+esc(query)+'”.</p></div></div><div class="grid">'+(results.length?results.map(resourceCard).join(''):emptyState(query))+'</div>';
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
function emptyState(query){
 return '<div class="smart-empty"><h3>Exact resource not available yet.</h3><p>EduNizam did not find a genuine indexed match for “'+esc(query)+'”. Try a broader term or open a trusted resource center.</p><div class="related-row"><button data-tab="past">Past Papers</button><button data-tab="vu">Virtual University</button><button data-tab="grade">PECTA Grade 5/8</button><button data-tab="study">Study Library</button><button data-clear-smart>Reset search</button></div></div>';
}
function resourceCard(r){
 const fav=favorites().some(x=>x.id===r.id),url=String(r.url||'').trim(),studyId=String(r.id||'').startsWith('study:')?String(r.id).slice(6):'',builtIn=!!(studyId&&r.content&&!url);const meta=[r.board,r.classLevel&&('Class '+r.classLevel),r.subject,r.year,r.session,r.type].filter(Boolean);
 let actions='<div class="guest-actions">';
 if(builtIn)actions+='<button class="primary-action" data-study-id="'+esc(studyId)+'">Read Now</button>';
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
  const subjectParts=x=>String(x.subject||'').split('/').map(s=>s.trim()).filter(Boolean).filter(s=>!/^all subjects$/i.test(s));
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
   const rows=data().filter(x=>(!g||String(x.grade)===g)&&(!s||norm(x.subject).includes(s)||norm(x.subject)==='all subjects')&&(!t||norm(x.type)===t));
   if(rows.length){
    $('guestGradeResults').innerHTML=rows.map(x=>resourceCard({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTAA / School Education',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'})).join('');
   }else{
    const nearest=data().filter(x=>(!g||String(x.grade)===g)&&(!s||norm(x.subject).includes(s)||norm(x.subject)==='all subjects')).slice(0,6);
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
 const study=$('study');if(study&&!$('studyExplorer')){const p=document.createElement('div');p.id='studyExplorer';p.className='card';p.style.marginBottom='16px';p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label search-wide">Search Study Library<input id="guestStudyQuery" type="search" placeholder="e.g. Class 10 Physics, formula sheet, syllabus"></label><label class="filter-label">Class<select id="guestStudyClass"><option value="">All Classes</option><option>9</option><option>10</option><option>11</option><option>12</option></select></label><button class="btn primary" id="guestStudySearch">Search Library</button></div><div id="guestStudyResults" class="grid"></div>';study.insertBefore(p,$('studyGrid'));const run=()=>{const q=norm($('guestStudyQuery').value),cl=$('guestStudyClass').value;const rows=(window.EDUNIZAM_STUDY_DATA?.materials||[]).filter(x=>(!q||norm(JSON.stringify(x)).includes(q))&&(!cl||(x.classLevels||[]).map(String).includes(cl)));$('guestStudyResults').innerHTML=rows.length?rows.map(x=>studyCard(x)).join(''):emptyState($('guestStudyQuery').value||('Class '+cl));};$('guestStudySearch').onclick=run;$('guestStudyQuery').addEventListener('keydown',e=>{if(e.key==='Enter')run()});$('guestStudyClass').onchange=run;run();}
 const unis=$('universities');if(unis&&!$('universityExplorer')){const p=document.createElement('div');p.id='universityExplorer';p.className='card';p.style.marginBottom='16px';const us=(uni().universities||[]).filter(x=>x.id!=='vu');p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label search-wide">University<select id="guestUniversity"><option value="">All Universities</option>'+us.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select></label><label class="filter-label">Resource<select id="guestUniversityType"><option value="">All Resources</option><option>Past Papers</option><option>Academic Resources</option></select></label><button class="btn primary" id="guestUniversitySearch">Show Resources</button></div><div id="guestUniversityResults" class="grid"></div>';unis.insertBefore(p,$('universityGrid'));const run=()=>{const id=$('guestUniversity').value,t=norm($('guestUniversityType').value);let rows=(uni().resources||[]).filter(x=>x.universityId!=='vu'&&(!id||x.universityId===id)&&(!t||norm(x.category).includes(t)));if(id&&!rows.length){const u=us.find(x=>x.id===id);if(u)rows=[{id:u.id+'-portal',universityId:u.id,title:u.name+' Official Portal',url:u.officialUrl,source:'official',category:'Academic Resources',note:'Official university portal for current academic and examination resources.'}]};$('guestUniversityResults').innerHTML=rows.length?rows.map(x=>{const u=us.find(y=>y.id===x.universityId);return resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',section:'universities'})}).join(''):emptyState('university resources');};$('guestUniversitySearch').onclick=run;$('guestUniversity').onchange=run;$('guestUniversityType').onchange=run;run();}
 const practice=$('practice');if(practice&&!$('practiceExplorer')){
  const p=document.createElement('div');p.id='practiceExplorer';p.className='card';p.style.marginBottom='16px';
  p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label">Class<select id="guestPracticeClass"><option value="">All Classes</option></select></label><label class="filter-label">Subject<select id="guestPracticeSubject"><option value="">All Subjects</option></select></label><label class="filter-label">Chapter<select id="guestPracticeChapter"><option value="">All Chapters</option></select></label><label class="filter-label">Difficulty<select id="guestPracticeDifficulty"><option value="">All Levels</option></select></label><button class="btn primary" id="guestPracticeApply">Start Practice</button></div><div id="guestPracticeSummary" class="paper-summary"></div>';
  practice.insertBefore(p,practice.firstChild.nextSibling);
  const baseActions=practice.querySelector('.practice-actions');if(baseActions)baseActions.hidden=true;
  const allQuestions=()=>window.EDUNIZAM_PRACTICE_DATA?.questions||[];
  const unique=arr=>[...new Set(arr.filter(Boolean))];
  const setOptions=(el,allLabel,values,current)=>{
   el.innerHTML='<option value="">'+allLabel+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
   if(values.includes(current))el.value=current;
  };
  function refreshPracticeOptions(){
   const all=allQuestions(),clEl=$('guestPracticeClass'),subEl=$('guestPracticeSubject'),chEl=$('guestPracticeChapter'),dfEl=$('guestPracticeDifficulty');
   const oldCl=clEl.value,oldSub=subEl.value,oldCh=chEl.value,oldDf=dfEl.value;
   const classes=unique(all.map(x=>String(x.classLevel))).sort((a,b)=>Number(a)-Number(b));setOptions(clEl,'All Classes',classes,oldCl);
   const cl=clEl.value;
   const byClass=all.filter(x=>!cl||String(x.classLevel)===cl);
   const subjects=unique(byClass.map(x=>x.subject)).sort();setOptions(subEl,'All Subjects',subjects,oldSub);
   const sub=subEl.value;
   const bySubject=byClass.filter(x=>!sub||x.subject===sub);
   const chapters=unique(bySubject.map(x=>x.chapter)).sort();setOptions(chEl,'All Chapters',chapters,oldCh);
   const chapter=chEl.value;
   const byChapter=bySubject.filter(x=>!chapter||x.chapter===chapter);
   const difficulties=unique(byChapter.map(x=>x.difficulty)).sort((a,b)=>['Easy','Medium','Hard'].indexOf(a)-['Easy','Medium','Hard'].indexOf(b));setOptions(dfEl,'All Levels',difficulties,oldDf);
   const diff=dfEl.value;
   const count=byChapter.filter(x=>!diff||x.difficulty===diff).length;
   $('guestPracticeSummary').textContent=count+' practice question'+(count===1?'':'s')+' available for the selected filters.';
   $('guestPracticeApply').textContent='Start Practice'+(count?' ('+count+')':'');
  }
  $('guestPracticeClass').onchange=()=>{refreshPracticeOptions();applyPracticeFilters()};
  $('guestPracticeSubject').onchange=()=>{refreshPracticeOptions();applyPracticeFilters()};
  $('guestPracticeChapter').onchange=()=>{refreshPracticeOptions();applyPracticeFilters()};
  $('guestPracticeDifficulty').onchange=()=>{refreshPracticeOptions();applyPracticeFilters()};
  $('guestPracticeApply').onclick=applyPracticeFilters;
  refreshPracticeOptions();applyPracticeFilters();
 }
}
let guestPracticeRows=[],guestPracticeIndex=0;
function renderGuestPractice(){
 const x=guestPracticeRows[guestPracticeIndex];if(!x)return;
 $('practiceMeta').innerHTML='<span class="badge">Class '+esc(x.classLevel)+'</span><span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.chapter||'General')+'</span><span class="badge">'+esc(x.difficulty)+'</span><span class="badge">Question '+(guestPracticeIndex+1)+' of '+guestPracticeRows.length+'</span>';
 $('practiceQuestion').textContent=x.question;$('practiceExplain').hidden=true;$('practiceExplain').textContent='';
 const nav='<div class="guest-actions" style="margin-top:12px"><button class="secondary" id="guestPracticePrev" '+(guestPracticeIndex===0?'disabled':'')+'>Previous</button><button class="primary-action" id="guestPracticeNext" '+(guestPracticeIndex>=guestPracticeRows.length-1?'disabled':'')+'>Next Question</button></div>';
 if(x.type==='mcq'){
  $('practiceOptions').innerHTML=(x.options||[]).map((o,i)=>'<button class="option" data-guest-answer="'+i+'">'+esc(o)+'</button>').join('')+nav;
  document.querySelectorAll('[data-guest-answer]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.guestAnswer);document.querySelectorAll('[data-guest-answer]').forEach((z,i)=>z.classList.add(i===x.answer?'correct':(i===n?'wrong':'')));$('practiceExplain').hidden=false;$('practiceExplain').textContent=(n===x.answer?'Correct. ':'Review: ')+(x.explanation||'')});
 }else{
  $('practiceOptions').innerHTML='<button class="option" id="guestShowAnswer">Show suggested answer</button>'+nav;
  $('guestShowAnswer').onclick=()=>{$('practiceExplain').hidden=false;$('practiceExplain').textContent=x.answerText||''};
 }
 const prev=$('guestPracticePrev'),next=$('guestPracticeNext');
 if(prev)prev.onclick=()=>{if(guestPracticeIndex>0){guestPracticeIndex--;renderGuestPractice()}};
 if(next)next.onclick=()=>{if(guestPracticeIndex<guestPracticeRows.length-1){guestPracticeIndex++;renderGuestPractice()}};
}
function applyPracticeFilters(){
 const cl=$('guestPracticeClass')?.value||'',sub=$('guestPracticeSubject')?.value||'',chapter=$('guestPracticeChapter')?.value||'',diff=$('guestPracticeDifficulty')?.value||'';
 const all=window.EDUNIZAM_PRACTICE_DATA?.questions||[];
 guestPracticeRows=all.filter(x=>(!cl||String(x.classLevel)===cl)&&(!sub||x.subject===sub)&&(!chapter||x.chapter===chapter)&&(!diff||x.difficulty===diff));guestPracticeIndex=0;
 if(!guestPracticeRows.length){
  const nearest=all.filter(x=>(!cl||String(x.classLevel)===cl)&&(!sub||x.subject===sub));
  guestPracticeRows=nearest.length?nearest:all;guestPracticeIndex=0;
  $('guestPracticeSummary')&&($('guestPracticeSummary').textContent='That exact combination is not available. Showing the closest genuine practice questions instead.');
 }
 if(!guestPracticeRows.length){$('practiceMeta').innerHTML='';$('practiceQuestion').textContent='No practice questions are available yet.';$('practiceOptions').innerHTML='';$('practiceExplain').hidden=true;return}
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
function bind(){
 document.addEventListener('click',e=>{
  const q=e.target.closest('[data-smart-query]');if(q){$('globalSearch').value=q.dataset.smartQuery;saveRecent(q.dataset.smartQuery);renderSuggestions();showGlobalResults(q.dataset.smartQuery);document.querySelector('.premium-tools')?.classList.add('search-tools-collapsed');$('globalSearch')?.blur();return}
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
  const courseQuery=/^[A-Z]{2,5}\d{3}[A-Z]?$/.test(raw);
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
 panel.innerHTML='<div class="section-head"><div><h3 style="margin:0">VU Resource Finder</h3><p style="margin:4px 0 0">Find a course first, then choose Past Papers, Handouts, Highlighted Handouts, Notes, Quizzes, Midterm or Final Term.</p></div></div><div class="paper-filters past-advanced"><label class="filter-label search-wide">Course code or subject<input id="vuGuestQuery" type="search" placeholder="e.g. CS101, MTH301, STA301"></label><label class="filter-label">Resource type<select id="vuGuestType"><option value="">All VU Resources</option><option>Past Papers</option><option>Handouts</option><option>Highlighted Handouts</option><option>Notes</option><option>Quizzes</option><option>Midterm</option><option>Final Term</option></select></label><button id="vuGuestSearch" class="btn primary" type="button">Search VU</button></div><div id="vuGuestSummary" class="paper-summary"></div><div id="vuGuestResults" class="grid"></div>';
 sec.insertBefore(panel,$('vuGrid'));
 const run=()=>{
  const query=norm($('vuGuestQuery').value),type=norm($('vuGuestType').value),catalog=window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[],resources=(uni().resources||[]).filter(x=>x.universityId==='vu');
  const course=catalog.find(x=>norm(x.code)===query)||catalog.find(x=>query&&norm(x.code+' '+x.title).includes(query));
  const rawCode=String($('vuGuestQuery').value||'').trim().toUpperCase();
  const validCourseCode=/^[A-Z]{2,5}\d{3}[A-Z]?$/.test(rawCode);
  let rows=resources.filter(x=>{
   const h=norm(JSON.stringify(x));
   const typeOK=!type||h.includes(type)||(type==='midterm'&&/midterm/i.test(x.category||''))||(type==='final term'&&/final/i.test(x.category||''));
   if(!typeOK)return false;
   if(!query)return true;
   const codes=(x.courseCodes||[]).map(norm);
   return x.courseAgnostic||codes.includes(query)||h.includes(query);
  });
  if(course){
   rows=[{id:'course:'+course.code,title:course.code+' — '+course.title,description:course.freshness,url:course.officialDetails,source:'official',type:'VU Course',board:'Virtual University',subject:course.category,courseCodes:[course.code],section:'vu'},...rows];
  }else if(validCourseCode){
   rows=[{id:'course-lookup:'+rawCode,title:rawCode+' — Official VU Course Lookup',description:'This course code is not yet stored in EduNizam’s local catalogue. Open the official VU course catalogue to verify the current title and course material.',url:'https://www.vu.edu.pk/academicprograms/coursescatalogue',source:'official',type:'VU Course Lookup',board:'Virtual University',courseCodes:[rawCode],section:'vu'},...rows];
  }
  const unique=[];const seen=new Set();rows.forEach(x=>{const id=x.id||x.title;if(!seen.has(id)){seen.add(id);unique.push(x)}});
  $('vuGuestSummary').textContent=unique.length+' useful VU result'+(unique.length===1?'':'s')+(query?' for “'+$('vuGuestQuery').value.trim()+'”':'')+'. Course-wide community sources are shown as supplementary when an exact paper is not indexed.';
  $('vuGuestResults').innerHTML=unique.length?unique.slice(0,24).map(x=>x.section?resourceCard(x):resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:'Virtual University',courseCodes:x.courseCodes||[],section:'vu'})).join(''):emptyState($('vuGuestQuery').value||$('vuGuestType').value||'VU resource');
 };
 $('vuGuestSearch').onclick=run;$('vuGuestQuery').addEventListener('keydown',e=>{if(e.key==='Enter')run()});$('vuGuestType').onchange=run;run();
}
function boot(){injectStyles();injectDirectory();injectSearchTools();injectPastFilters();injectVUExplorer();injectSectionExplorers();injectSaved();bind()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();