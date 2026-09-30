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
 (window.EDUNIZAM_STUDY_DATA?.materials||[]).forEach(x=>out.push({id:'study:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:x.board,classLevel:(x.classLevels||[]).join('/'),subject:x.subject,section:'study'}));
 (uni().resources||[]).forEach(x=>{const u=(uni().universities||[]).find(y=>y.id===x.universityId);out.push({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',courseCodes:x.courseCodes||[],section:x.universityId==='vu'?'vu':'universities'})});
 (window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[]).forEach(x=>out.push({id:'course:'+x.code,title:x.code+' — '+x.title,description:x.freshness,url:x.officialDetails,source:'official',type:'VU Course',board:'Virtual University of Pakistan',subject:x.category,courseCodes:[x.code],section:'vu'}));
 return out;
}
function injectStyles(){
 const s=document.createElement('style');s.textContent=`
 .premium-tools{display:grid;gap:12px;margin:0 0 18px}.search-suggestions{display:flex;gap:7px;flex-wrap:wrap}.search-suggestions button,.recent-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;cursor:pointer;color:var(--ink)}
 .guest-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.guest-actions button,.guest-actions a{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;font-weight:800;text-decoration:none;cursor:pointer}.guest-actions .primary-action{background:var(--green);color:#fff;border-color:var(--green)}
 .favorite-on{color:#8a6200;background:#fff7d9!important}.saved-panel{margin:12px 0 20px}.saved-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.smart-empty{grid-column:1/-1;padding:22px;border:1px dashed #b9ccc7;border-radius:18px;background:#fff}.smart-empty h3{margin:0 0 7px}.smart-empty p{color:var(--muted)}.related-row{display:flex;gap:8px;flex-wrap:wrap}.related-row button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer}
 .premium-modal{position:fixed;inset:0;z-index:95;background:rgba(10,27,31,.72);display:none;place-items:center;padding:14px}.premium-modal.open{display:grid}.premium-dialog{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:20px}.premium-dialog-head{display:flex;justify-content:space-between;gap:12px}.premium-meta{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.premium-preview-frame{width:100%;height:50vh;border:1px solid var(--line);border-radius:12px;background:#f4f7f6}.filter-label{display:grid;gap:5px;font-size:.76rem;font-weight:800}.filter-label select{font-weight:400}.past-advanced{grid-template-columns:repeat(4,minmax(0,1fr))!important}.past-advanced .paper-search{grid-column:span 2}.past-advanced .search-wide{grid-column:span 2}.hub-directory{margin:0 0 18px}.hub-directory .grid{grid-template-columns:repeat(4,minmax(0,1fr))}.hub-link{cursor:pointer;text-decoration:none}.hub-link strong{display:block;font-size:1rem}.hub-link span{font-size:.78rem;color:var(--muted)}
 @media(max-width:900px){.past-advanced{grid-template-columns:repeat(2,minmax(0,1fr))!important}.hub-directory .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 /* Keep VU course codes/cards inside normal document flow while scrolling. */
 .hub-directory,.premium-tools,#globalSearchResults,#savedResourcesPanel{position:relative;z-index:1;isolation:isolate;overflow:visible}
 .hub-directory .card,.resource-card,.premium-tools .card{position:relative!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;z-index:auto!important;transform:none;min-width:0;max-width:100%;overflow:hidden}
 .hub-directory .card *,.resource-card *,.premium-tools .card *{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:normal}
 .badge,.recent-chip,.search-suggestions button{position:static!important;z-index:auto!important;max-width:100%;white-space:normal;overflow-wrap:anywhere}
 @media(max-width:620px){.past-advanced{grid-template-columns:1fr!important}.past-advanced .paper-search,.past-advanced .search-wide{grid-column:auto}.hub-directory .grid{grid-template-columns:1fr;overflow:visible}.guest-actions>*{flex:1 1 auto;text-align:center}.premium-dialog{padding:14px}.premium-preview-frame{height:42vh}.hub-directory .card,.resource-card{width:100%;contain:layout paint}}

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
 const tools=document.createElement('div');tools.className='premium-tools';tools.innerHTML='<div id="searchSuggestions" class="search-suggestions" aria-label="Search suggestions"></div><div><strong style="font-size:.8rem">Recent searches</strong><div id="recentSearches" class="search-suggestions"></div></div>';
 sw.appendChild(tools);
 const input=$('globalSearch');input.placeholder='What do you want to study?';
 input.setAttribute('autocomplete','off');
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){saveRecent(input.value);showGlobalResults(input.value)}});
 input.addEventListener('input',renderSuggestions);
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
 const home=$('home');document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x===home));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='home'));history.replaceState(null,'','#home');
 let box=$('globalResults');if(!box){box=document.createElement('div');box.id='globalResults';home.insertBefore(box,home.firstChild)}
 box.innerHTML='<div class="section-head"><div><h2>Search results</h2><p>'+results.length+' matching public resources for “'+esc(query)+'”.</p></div></div><div class="grid">'+(results.length?results.map(resourceCard).join(''):emptyState(query))+'</div>';
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
function emptyState(query){
 return '<div class="smart-empty"><h3>Exact resource not available yet.</h3><p>EduNizam did not find a genuine indexed match for “'+esc(query)+'”. Try a broader term or open a trusted resource center.</p><div class="related-row"><button data-tab="past">Past Papers</button><button data-tab="vu">Virtual University</button><button data-tab="grade">PECTA Grade 5/8</button><button data-tab="study">Study Library</button><button data-clear-smart>Reset search</button></div></div>';
}
function resourceCard(r){
 const fav=favorites().some(x=>x.id===r.id);const meta=[r.board,r.classLevel&&('Class '+r.classLevel),r.subject,r.year,r.session,r.type].filter(Boolean);
 return '<article class="card"><span class="badge '+(r.source==='official'?'official':r.source==='verified'?'verified':'builtin')+'">'+esc(r.source==='official'?'Official Source':r.source==='verified'?'External Study Resource':'EduNizam Resource')+'</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.description||'Public educational resource.')+'</p><div class="meta">'+meta.map(x=>'<span class="badge">'+esc(x)+'</span>').join('')+'</div><div class="guest-actions"><button class="primary-action" data-preview-id="'+esc(r.id)+'">Preview</button><a href="'+esc(r.url||'#')+'" target="_blank" rel="noopener noreferrer">Open</a><button data-share-id="'+esc(r.id)+'">Share</button><button class="'+(fav?'favorite-on':'')+'" data-fav-id="'+esc(r.id)+'">'+(fav?'★ Saved':'☆ Save')+'</button></div></article>';
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
 const d=pp(),level=$('paperLevel')?.value||'',board=$('paperBoard')?.value||'',current=$('paperClass')?.value||'';
 let classes=level==='school'?['5','8']:level==='matric'?['9','10']:level==='intermediate'?['11','12']:['9','10','11','12'];
 const b=(d.boards||[]).find(x=>x.id===board);if(b)classes=classes.filter(x=>(b.classes||[]).map(String).includes(x));
 $('paperClass').innerHTML='<option value="">All Classes</option>'+classes.map(x=>'<option value="'+x+'">'+(x==='11'?'11th / 1st Year':x==='12'?'12th / 2nd Year':x==='5'?'Grade 5':x==='8'?'Grade 8':x+'th Class')+'</option>').join('');
 if(classes.includes(current))$('paperClass').value=current;
 const cl=$('paperClass').value;const subs=cl?(d.subjects?.[cl]||[]):[...new Set(Object.values(d.subjects||{}).flat())].sort();
 $('paperSubject').innerHTML='<option value="">All Subjects</option>'+subs.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
}

function injectSectionExplorers(){
 const grade=$('grade');if(grade&&!$('gradeExplorer')){const p=document.createElement('div');p.id='gradeExplorer';p.className='card';p.style.marginBottom='16px';p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label">Grade<select id="guestGrade"><option value="">All Grades</option><option value="5">Grade 5</option><option value="8">Grade 8</option></select></label><label class="filter-label">Subject<select id="guestGradeSubject"><option value="">All Subjects</option><option>English</option><option>Urdu</option><option>Mathematics</option><option>Science</option><option>Islamiat</option></select></label><label class="filter-label">Resource type<select id="guestGradeType"><option value="">All Resources</option><option>Model Paper</option><option>Historical Past Papers</option><option>Assessment Pattern</option><option>Assessment Report</option></select></label><button class="btn primary" id="guestGradeSearch">Filter Resources</button></div><div id="guestGradeResults" class="grid"></div>';grade.insertBefore(p,$('gradeGrid'));const run=()=>{const g=$('guestGrade').value,s=norm($('guestGradeSubject').value),t=norm($('guestGradeType').value);const rows=(window.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[]).filter(x=>(!g||String(x.grade)===g)&&(!s||norm(x.subject).includes(s)||norm(x.subject).includes('all subjects'))&&(!t||norm(x.type).includes(t)));$('guestGradeResults').innerHTML=rows.length?rows.map(x=>resourceCard({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTA / School Education',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'})).join(''):emptyState('Grade '+g+' '+s);};$('guestGradeSearch').onclick=run;['guestGrade','guestGradeSubject','guestGradeType'].forEach(id=>$(id).onchange=run);run();}
 const study=$('study');if(study&&!$('studyExplorer')){const p=document.createElement('div');p.id='studyExplorer';p.className='card';p.style.marginBottom='16px';p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label search-wide">Search Study Library<input id="guestStudyQuery" type="search" placeholder="e.g. Class 10 Physics, formula sheet, syllabus"></label><label class="filter-label">Class<select id="guestStudyClass"><option value="">All Classes</option><option>9</option><option>10</option><option>11</option><option>12</option></select></label><button class="btn primary" id="guestStudySearch">Search Library</button></div><div id="guestStudyResults" class="grid"></div>';study.insertBefore(p,$('studyGrid'));const run=()=>{const q=norm($('guestStudyQuery').value),cl=$('guestStudyClass').value;const rows=(window.EDUNIZAM_STUDY_DATA?.materials||[]).filter(x=>(!q||norm(JSON.stringify(x)).includes(q))&&(!cl||(x.classLevels||[]).map(String).includes(cl)));$('guestStudyResults').innerHTML=rows.length?rows.map(x=>studyCard(x)).join(''):emptyState($('guestStudyQuery').value||('Class '+cl));};$('guestStudySearch').onclick=run;$('guestStudyQuery').addEventListener('keydown',e=>{if(e.key==='Enter')run()});$('guestStudyClass').onchange=run;run();}
 const unis=$('universities');if(unis&&!$('universityExplorer')){const p=document.createElement('div');p.id='universityExplorer';p.className='card';p.style.marginBottom='16px';const us=(uni().universities||[]).filter(x=>x.id!=='vu');p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label search-wide">University<select id="guestUniversity"><option value="">All Universities</option>'+us.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select></label><label class="filter-label">Resource<select id="guestUniversityType"><option value="">All Resources</option><option>Past Papers</option><option>Academic Resources</option></select></label><button class="btn primary" id="guestUniversitySearch">Show Resources</button></div><div id="guestUniversityResults" class="grid"></div>';unis.insertBefore(p,$('universityGrid'));const run=()=>{const id=$('guestUniversity').value,t=norm($('guestUniversityType').value);let rows=(uni().resources||[]).filter(x=>x.universityId!=='vu'&&(!id||x.universityId===id)&&(!t||norm(x.category).includes(t)));if(id&&!rows.length){const u=us.find(x=>x.id===id);if(u)rows=[{id:u.id+'-portal',universityId:u.id,title:u.name+' Official Portal',url:u.officialUrl,source:'official',category:'Academic Resources',note:'Official university portal for current academic and examination resources.'}]};$('guestUniversityResults').innerHTML=rows.length?rows.map(x=>{const u=us.find(y=>y.id===x.universityId);return resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:u?.name||'',section:'universities'})}).join(''):emptyState('university resources');};$('guestUniversitySearch').onclick=run;$('guestUniversity').onchange=run;$('guestUniversityType').onchange=run;run();}
 const practice=$('practice');if(practice&&!$('practiceExplorer')){const p=document.createElement('div');p.id='practiceExplorer';p.className='card';p.style.marginBottom='16px';p.innerHTML='<div class="paper-filters past-advanced"><label class="filter-label">Class<select id="guestPracticeClass"><option value="">All Classes</option><option>9</option><option>10</option><option>11</option><option>12</option></select></label><label class="filter-label">Subject<select id="guestPracticeSubject"><option value="">All Subjects</option></select></label><label class="filter-label">Difficulty<select id="guestPracticeDifficulty"><option value="">All Levels</option><option>Easy</option><option>Medium</option><option>Hard</option></select></label><button class="btn primary" id="guestPracticeApply">Start Filtered Practice</button></div>';practice.insertBefore(p,practice.firstChild.nextSibling);const subjects=()=>{const cl=$('guestPracticeClass').value,d=window.EDUNIZAM_PRACTICE_DATA||{},arr=cl?(d.subjects?.[cl]||[]):[...new Set(Object.values(d.subjects||{}).flat())].sort();$('guestPracticeSubject').innerHTML='<option value="">All Subjects</option>'+arr.map(x=>'<option>'+esc(x)+'</option>').join('')};$('guestPracticeClass').onchange=subjects;$('guestPracticeApply').onclick=applyPracticeFilters;subjects();}
}
function applyPracticeFilters(){
 const cl=$('guestPracticeClass')?.value||'',sub=$('guestPracticeSubject')?.value||'',diff=$('guestPracticeDifficulty')?.value||'';
 const all=window.EDUNIZAM_PRACTICE_DATA?.questions||[];
 const rows=all.filter(x=>(!cl||String(x.classLevel)===cl)&&(!sub||x.subject===sub)&&(!diff||x.difficulty===diff));
 if(!rows.length){$('practiceMeta').innerHTML='';$('practiceQuestion').textContent='No practice question matches these filters. Try another class, subject or difficulty.';$('practiceOptions').innerHTML='';$('practiceExplain').hidden=true;return}
 const x=rows[0];$('practiceMeta').innerHTML='<span class="badge">Class '+esc(x.classLevel)+'</span><span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.difficulty)+'</span><span class="badge">'+rows.length+' filtered questions</span>';$('practiceQuestion').textContent=x.question;$('practiceExplain').hidden=true;if(x.type==='mcq'){$('practiceOptions').innerHTML=(x.options||[]).map((o,i)=>'<button class="option" data-guest-answer="'+i+'">'+esc(o)+'</button>').join('');document.querySelectorAll('[data-guest-answer]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.guestAnswer);document.querySelectorAll('[data-guest-answer]').forEach((z,i)=>z.classList.add(i===x.answer?'correct':(i===n?'wrong':'')));$('practiceExplain').hidden=false;$('practiceExplain').textContent=(n===x.answer?'Correct. ':'Review: ')+(x.explanation||'')})}else{$('practiceOptions').innerHTML='<button class="option" id="guestShowAnswer">Show suggested answer</button>';$('guestShowAnswer').onclick=()=>{$('practiceExplain').hidden=false;$('practiceExplain').textContent=x.answerText||''}}
}
function studyCard(x){if(x.url||x.fileUrl)return resourceCard({id:'study:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:x.board,classLevel:(x.classLevels||[]).join('/'),subject:x.subject,section:'study'});return '<article class="card"><span class="badge builtin">EduNizam Resource</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.note||'Built-in study material available instantly.')+'</p><div class="meta"><span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.type)+'</span></div><div class="guest-actions"><button class="primary-action" data-study-id="'+esc(x.id)+'">Read Now</button><button data-fav-id="study:'+esc(x.id)+'">☆ Save</button></div></article>'}
function openStudy(id){const x=(window.EDUNIZAM_STUDY_DATA?.materials||[]).find(v=>v.id===id);if(!x)return;let m=$('premiumResourceModal');if(!m){openPreview('study:'+id);m=$('premiumResourceModal')}if(!m){m=document.createElement('div');m.id='premiumResourceModal';m.className='premium-modal';m.innerHTML='<div class="premium-dialog"><div class="premium-dialog-head"><h2 id="premiumPreviewTitle"></h2><button class="btn" data-close-premium>Close</button></div><div id="premiumPreviewMeta" class="premium-meta"></div><p id="premiumPreviewDesc"></p><div id="premiumPreviewBody"></div><div id="premiumPreviewActions" class="guest-actions"></div></div>';document.body.appendChild(m)}$('premiumPreviewTitle').textContent=x.title;$('premiumPreviewMeta').innerHTML='<span class="badge">'+esc(x.subject)+'</span><span class="badge">'+esc(x.type)+'</span>';$('premiumPreviewDesc').textContent=x.note||'';$('premiumPreviewBody').innerHTML='<div class="notice" style="white-space:pre-wrap">'+esc(x.content||'')+'</div>';$('premiumPreviewActions').innerHTML='<button onclick="window.print()">Print</button><button data-fav-id="study:'+esc(x.id)+'">☆ Save</button>';m.classList.add('open')}
function injectSaved(){
 const home=$('home');if(!home)return;const sec=document.createElement('div');sec.className='saved-panel card';sec.innerHTML='<div class="saved-head"><div><h3 style="margin:0">My Saved Resources</h3><p style="margin:4px 0 0">Saved locally on this browser — no login required.</p></div><button class="btn" id="clearFavorites">Clear all</button></div><div id="savedResources" class="grid" style="margin-top:14px"></div>';home.appendChild(sec);$('clearFavorites').onclick=()=>{setJSON(FKEY,[]);renderSaved()};renderSaved();
}
function renderSaved(){const box=$('savedResources');if(!box)return;const ids=favorites().map(x=>x.id),map=new Map(allResources().map(x=>[x.id,x]));const rows=ids.map(id=>map.get(id)).filter(Boolean);box.innerHTML=rows.length?rows.map(resourceCard).join(''):'<div class="empty">No saved resources yet. Use ☆ Save on any resource.</div>'}
function openPreview(id){
 const r=allResources().find(x=>x.id===id);if(!r)return;let m=$('premiumResourceModal');if(!m){m=document.createElement('div');m.id='premiumResourceModal';m.className='premium-modal';m.innerHTML='<div class="premium-dialog" role="dialog" aria-modal="true" aria-labelledby="premiumPreviewTitle"><div class="premium-dialog-head"><h2 id="premiumPreviewTitle" style="margin:0"></h2><button class="btn" data-close-premium>Close</button></div><div id="premiumPreviewMeta" class="premium-meta"></div><p id="premiumPreviewDesc"></p><div id="premiumPreviewBody"></div><div id="premiumPreviewActions" class="guest-actions"></div></div>';document.body.appendChild(m)}
 $('premiumPreviewTitle').textContent=r.title;$('premiumPreviewDesc').textContent=r.description||'';
 $('premiumPreviewMeta').innerHTML=[r.board,r.classLevel&&('Class '+r.classLevel),r.subject,r.year,r.session,r.type,r.source==='official'?'Official Source':'External / EduNizam Resource'].filter(Boolean).map(x=>'<span class="badge">'+esc(x)+'</span>').join('');
 const isPdf=/\.pdf(?:$|[?#])/i.test(r.url||'');$('premiumPreviewBody').innerHTML=isPdf?'<iframe class="premium-preview-frame" src="'+esc(r.url)+'" title="'+esc(r.title)+'"></iframe>':'<div class="notice">This source is a web page rather than a directly hosted document. Open it at the source to view the genuine content.</div>';
 $('premiumPreviewActions').innerHTML='<a class="primary-action" href="'+esc(r.url||'#')+'" target="_blank" rel="noopener noreferrer">Open Source</a>'+(isPdf?'<button data-print-url="'+esc(r.url)+'">Print</button>':'')+'<button data-share-id="'+esc(r.id)+'">Share</button><button data-fav-id="'+esc(r.id)+'">'+(favorites().some(x=>x.id===r.id)?'★ Saved':'☆ Save')+'</button>';
 m.classList.add('open');
}
function toggleFav(id){let x=favorites();x=x.some(v=>v.id===id)?x.filter(v=>v.id!==id):[{id},...x];setJSON(FKEY,x);renderSaved();document.querySelectorAll('[data-fav-id="'+CSS.escape(id)+'"]').forEach(b=>{const on=x.some(v=>v.id===id);b.textContent=on?'★ Saved':'☆ Save';b.classList.toggle('favorite-on',on)})}
async function shareResource(id){const r=allResources().find(x=>x.id===id);if(!r)return;try{if(navigator.share)await navigator.share({title:r.title,text:r.description||'',url:r.url});else{await navigator.clipboard.writeText(r.url);alert('Resource link copied.')}}catch(_){}}
function bind(){
 document.addEventListener('click',e=>{
  const q=e.target.closest('[data-smart-query]');if(q){$('globalSearch').value=q.dataset.smartQuery;saveRecent(q.dataset.smartQuery);showGlobalResults(q.dataset.smartQuery);return}
  const p=e.target.closest('[data-preview-id]');if(p){openPreview(p.dataset.previewId);return}
  const f=e.target.closest('[data-fav-id]');if(f){toggleFav(f.dataset.favId);return}
  const sh=e.target.closest('[data-share-id]');if(sh){shareResource(sh.dataset.shareId);return}
  const st=e.target.closest('[data-study-id]');if(st){openStudy(st.dataset.studyId);return}
  if(e.target.closest('[data-close-premium]')){$('premiumResourceModal')?.classList.remove('open');return}
  if(e.target.closest('[data-clear-smart]')){$('globalSearch').value='';$('globalResults')?.remove();return}
  const pr=e.target.closest('[data-print-url]');if(pr){const w=window.open(pr.dataset.printUrl,'_blank');if(w)setTimeout(()=>{try{w.print()}catch(_){}},900)}
 });
 $('searchPapers')?.addEventListener('click',()=>{saveRecent([$('paperBoard')?.selectedOptions[0]?.text,$('paperClass')?.selectedOptions[0]?.text,$('paperSubject')?.value,$('paperYear')?.value,$('paperSession')?.value].filter(x=>x&&!/^All/.test(x)).join(' '));setTimeout(enhancePastResults,0)});
}
function enhancePastResults(){
 const grid=$('pastGrid');if(!grid)return;const level=$('paperLevel')?.value||'',session=$('paperSession')?.value||'';
 if(level==='school'){grid.innerHTML=(window.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[]).map(x=>resourceCard({id:'school:'+x.id,title:x.title,description:x.note,url:x.fileUrl||x.url,source:x.source,type:x.type,board:'PECTA',classLevel:x.grade,subject:x.subject,year:x.year,section:'grade'})).join('');$('paperSummary').textContent='School-level PECTA / assessment resources.';return}
 if(level==='vu'){grid.innerHTML=(uni().resources||[]).filter(x=>x.universityId==='vu'&&/past|midterm|final/i.test(x.category)).map(x=>resourceCard({id:'uni:'+x.id,title:x.title,description:x.note,url:x.url,source:x.source,type:x.category,board:'Virtual University',section:'vu'})).join('');$('paperSummary').textContent='Virtual University exam-preparation and past-paper sources.';return}
 if(session){const cards=[...grid.querySelectorAll('.card')];cards.forEach(c=>{if(!norm(c.textContent).includes(norm(session)))c.style.display='none'});if(cards.length&&!cards.some(c=>c.style.display!=='none'))grid.innerHTML=emptyState(session)}
}

function injectVUExplorer(){
 const sec=$('vu');if(!sec||$('vuExplorer'))return;
 const panel=document.createElement('div');panel.id='vuExplorer';panel.className='card';panel.style.marginBottom='16px';
 panel.innerHTML='<div class="section-head"><div><h3 style="margin:0">VU Resource Finder</h3><p style="margin:4px 0 0">Find a course first, then choose Past Papers, Handouts, Highlighted Handouts, Notes, Quizzes, Midterm or Final Term.</p></div></div><div class="paper-filters past-advanced"><label class="filter-label search-wide">Course code or subject<input id="vuGuestQuery" type="search" placeholder="e.g. CS101, MTH301, STA301"></label><label class="filter-label">Resource type<select id="vuGuestType"><option value="">All VU Resources</option><option>Past Papers</option><option>Handouts</option><option>Highlighted Handouts</option><option>Notes</option><option>Quizzes</option><option>Midterm</option><option>Final Term</option></select></label><button id="vuGuestSearch" class="btn primary" type="button">Search VU</button></div><div id="vuGuestSummary" class="paper-summary"></div><div id="vuGuestResults" class="grid"></div>';
 sec.insertBefore(panel,$('vuGrid'));
 const run=()=>{
  const query=norm($('vuGuestQuery').value),type=norm($('vuGuestType').value),catalog=window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[],resources=(uni().resources||[]).filter(x=>x.universityId==='vu');
  const course=catalog.find(x=>norm(x.code)===query)||catalog.find(x=>query&&norm(x.code+' '+x.title).includes(query));
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