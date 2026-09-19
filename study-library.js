(function(){
  const D=window.EDUNIZAM_STUDY_DATA;if(!D)return;
  const PP=window.EDUNIZAM_PAST_PAPERS||{boards:[]};
  const REG=window.EDUNIZAM_CURRICULUM_REGISTRY||{authorities:[]};
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let activeTab='library',current=null;
  const saved=()=>JSON.parse(localStorage.getItem('edunizam_study_saved')||'[]');
  const recent=()=>JSON.parse(localStorage.getItem('edunizam_study_recent')||'[]');
  const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const byId=id=>D.materials.find(x=>x.id===id);
  const boardByName=name=>(PP.boards||[]).find(b=>b.name===name);

  function authorityForBoard(board){
    if(!board)return null;
    const region=String(board.region||'').toLowerCase();
    const map=[
      ['punjab','punjab-pectaa'],
      ['sindh','sindh-stbb'],
      ['khyber','kp-dcte-kptbb'],
      ['balochistan','balochistan-btbb'],
      ['federal','federal-fbise']
    ];
    const hit=map.find(([key])=>region.includes(key));
    return hit?REG.authorities?.find(a=>a.id===hit[1]):null;
  }

  function materialMatchesBoard(x,name){
    if(!name)return true;
    if(x.board===name)return true;
    const b=boardByName(name);if(!b)return false;
    const region=String(b.region||'').toLowerCase(),label=String(x.board||'').toLowerCase();
    if(region.includes('punjab')&&label.includes('punjab'))return true;
    if(region.includes('sindh')&&label.includes('sindh'))return true;
    if(region.includes('khyber')&&(label.includes('khyber')||label.includes('kptbb')||label.includes('kp /')))return true;
    if(region.includes('balochistan')&&label.includes('balochistan'))return true;
    if(region.includes('federal')&&(label.includes('federal')||label.includes('fbise')||label.includes('nbf')))return true;
    return false;
  }

  function allBoardNames(){
    const names=new Set(D.materials.map(x=>x.board).filter(Boolean));
    (PP.boards||[]).forEach(b=>names.add(b.name));
    return [...names].sort((a,b)=>a.localeCompare(b));
  }

  function fill(){
    const current=$('studyBoard').value;
    const boards=allBoardNames();
    $('studyBoard').innerHTML='<option value="">All Boards / Authorities</option>'+boards.map(x=>'<option>'+esc(x)+'</option>').join('');
    if(boards.includes(current))$('studyBoard').value=current;
    fillSubjects();updateStats();render();
  }

  function fillSubjects(){
    const cls=$('studyClass').value,board=$('studyBoard').value,current=$('studySubject').value;
    const subs=[...new Set(D.materials.filter(x=>(!cls||x.classLevels.includes(Number(cls)))&&materialMatchesBoard(x,board)).map(x=>x.subject))].sort();
    $('studySubject').innerHTML='<option value="">All Subjects</option>'+subs.map(x=>'<option>'+esc(x)+'</option>').join('');
    if(subs.includes(current))$('studySubject').value=current;
  }

  function filters(){
    return{
      q:$('studySearch').value.trim().toLowerCase(),
      board:$('studyBoard').value,
      cls:$('studyClass').value,
      subject:$('studySubject').value,
      type:$('studyType').value,
      status:$('studyCurriculumStatus')?.value||''
    };
  }

  function match(x,f){
    const hay=[x.title,x.board,x.subject,x.type,x.chapter,x.note,x.content].join(' ').toLowerCase();
    const terms=f.q.split(/\s+/).filter(Boolean);
    const textMatch=!terms.length||terms.every(term=>hay.includes(term));
    return textMatch&&materialMatchesBoard(x,f.board)&&(!f.cls||x.classLevels.includes(Number(f.cls)))&&(!f.subject||x.subject===f.subject)&&(!f.type||x.type===f.type)&&(!f.status||(x.curriculumStatus||'needs-verification')===f.status);
  }

  function card(x){
    const isSaved=saved().includes(x.id),local=!!x.content,direct=!!x.fileUrl||/\.pdf(?:$|[?#])/i.test(x.url||'');
    let actions='';
    if(local) actions+='<button data-study-open="'+x.id+'">Open</button>';
    else actions+='<a class="primary-link" href="'+esc(x.url)+'" target="_blank" rel="noopener" data-study-track="'+x.id+'">Open Source</a>';
    if(direct) actions+='<a class="secondary-link" href="'+esc(x.fileUrl||x.url)+'" target="_blank" rel="noopener">Download / Open PDF</a>';
    actions+='<button class="secondary-action" data-study-summary="'+x.id+'">AI Summary</button>';
    const auth=REG?.authorities?.find(a=>a.id===x.authorityId);
    const status=x.curriculumStatus||'needs-verification';
    const statusBadge=status==='current'?'<span class="trust-badge trust-official">Current Curriculum</span>':status==='archived'?'<span class="trust-badge trust-community">Archived</span>':'<span class="trust-badge trust-community">Needs Verification</span>';
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(x.type)+'</span> '+(x.source==='official'?'<span class="trust-badge trust-official">Official</span>':x.source==='verified'?'<span class="trust-badge trust-verified">Verified</span>':'<span class="trust-badge trust-verified">EduNizam</span>')+' '+statusBadge+'</div><button class="icon-btn" data-study-save="'+x.id+'">'+(isSaved?'★':'☆')+'</button></div><h3>'+esc(x.title)+'</h3><p class="muted">'+esc(x.board)+' · '+esc(x.subject)+' · Class '+esc(x.classLevels.join(', '))+'</p>'+(auth?'<p class="coverage-note"><strong>Authority:</strong> '+esc(auth.name)+(x.curriculumSession?' · <strong>Session:</strong> '+esc(x.curriculumSession):'')+'</p>':'')+(x.note?'<p class="coverage-note">'+esc(x.note)+'</p>':'')+'<div class="paper-actions">'+actions+'</div></article>';
  }

  function boardSourceCard(b){
    const auth=authorityForBoard(b);
    const links=['<a class="primary-link" href="'+esc(b.officialUrl)+'" target="_blank" rel="noopener">Open Official Board</a>'];
    if(auth?.officialUrl&&auth.officialUrl!==b.officialUrl)links.push('<a class="secondary-link" href="'+esc(auth.officialUrl)+'" target="_blank" rel="noopener">Open Curriculum / Textbook Authority</a>');
    if(b.archiveUrl)links.push('<a class="secondary-link" href="'+esc(b.archiveUrl)+'" target="_blank" rel="noopener">Past Paper Archive</a>');
    return '<article class="paper-card premium-paper-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official Source</span> <span class="mini-badge">Board Coverage</span></div></div><h3>'+esc(b.name)+' Study Resources</h3><p class="muted">'+esc(b.region)+' · Classes '+esc((b.classes||[]).join(', '))+'</p><p class="coverage-note">Exact study item EduNizam index mein na mile to board aur relevant curriculum/textbook authority ke official source se syllabus, model papers, schemes aur prescribed resources verify karein.</p><div class="paper-actions">'+links.join('')+'</div></article>';
  }

  function fallbackBoards(f){
    if(f.type&&f.type!=='Official Portal')return [];
    if(f.board){const b=boardByName(f.board);return b?[b]:[]}
    if(!f.q)return [];
    const terms=f.q.split(/\s+/).filter(Boolean);
    return (PP.boards||[]).filter(b=>{
      const hay=[b.name,b.region,(b.aliases||[]).join(' ')].join(' ').toLowerCase();
      return terms.some(t=>t.length>2&&hay.includes(t));
    }).slice(0,6);
  }

  function render(){
    const f=filters();
    document.querySelectorAll('[data-study-tab]').forEach(b=>b.classList.toggle('active',b.dataset.studyTab===activeTab));
    let arr=D.materials.filter(x=>match(x,f));
    if(activeTab==='saved')arr=saved().map(byId).filter(Boolean).filter(x=>match(x,f));
    if(activeTab==='recent')arr=recent().map(x=>byId(x.id)).filter(Boolean).filter(x=>match(x,f));
    const fallbacks=activeTab==='library'?fallbackBoards(f):[];
    const html=arr.map(card).join('')+fallbacks.map(boardSourceCard).join('');
    $('studyLibrary').innerHTML=html||'<div class="empty-state">No exact study item matches these filters. Clear one filter or select a board to open its official source.</div>';
    const summary=$('studySearchSummary');
    if(summary)summary.textContent=arr.length+' indexed resource'+(arr.length===1?'':'s')+(fallbacks.length?' · '+fallbacks.length+' official board source'+(fallbacks.length===1?'':'s'):'')+' shown';
    bindDynamic();updateStats();
  }

  function bindDynamic(){
    document.querySelectorAll('[data-study-save]').forEach(b=>b.onclick=()=>toggleSave(b.dataset.studySave));
    document.querySelectorAll('[data-study-open]').forEach(b=>b.onclick=()=>openLocal(b.dataset.studyOpen));
    document.querySelectorAll('[data-study-track]').forEach(a=>a.onclick=()=>track(a.dataset.studyTrack));
    document.querySelectorAll('[data-study-summary]').forEach(b=>b.onclick=()=>aiSummary(b.dataset.studySummary));
  }

  function toggleSave(id){let x=saved();x=x.includes(id)?x.filter(v=>v!==id):[id,...x];put('edunizam_study_saved',x);render()}
  function track(id){let x=recent().filter(v=>v.id!==id);x.unshift({id,at:Date.now()});put('edunizam_study_recent',x.slice(0,30));updateStats()}
  function openLocal(id){const x=byId(id);if(!x)return;current=x;track(id);$('studyViewerTitle').textContent=x.title;$('studyViewerMeta').textContent=x.board+' · '+x.subject+' · Class '+x.classLevels.join(', ');$('studyViewerContent').textContent=x.content||'';$('studyViewer').classList.remove('hidden')}
  function close(){current=null;$('studyViewer').classList.add('hidden')}
  function aiSummary(id){const x=byId(id);if(!x)return;if(window.setView)window.setView('assistant');$('aiPrompt').value='Summarize this study resource for a Class '+x.classLevels.join('/')+' student. Make concise revision notes, key points, definitions/formulas, common mistakes, and exam tips. Resource: '+x.title+(x.content?'\n\nContent:\n'+x.content:'\nSource: '+x.url);$('aiOutput').textContent='Study resource sent to AI Summary.'}
  function viewerPrompt(kind){
    if(!current)return;
    if(window.setView)window.setView('assistant');
    if(kind==='summary')$('aiPrompt').value='Create concise revision notes from this material, with key formulas/points and exam tips:\n\n'+current.content;
    else $('aiPrompt').value='Create a 10-question board-style quiz from this study material. Include MCQs, answer key and explanations:\n\n'+current.content;
    $('aiOutput').textContent=kind==='summary'?'AI summary request prepared.':'AI quiz request prepared.';
  }
  function practice(){
    if(!current)return;if(window.setView)window.setView('practice');
    const cls=current.classLevels[0];$('practiceClass').value=String(cls);$('practiceClass').dispatchEvent(new Event('change'));
    setTimeout(()=>{$('practiceSubject').value=current.subject;$('practiceSubject').dispatchEvent(new Event('change'))},0);
  }
  function printCurrent(){
    if(!current)return;const w=window.open('','_blank');if(!w)return;w.document.write('<html><head><title>'+esc(current.title)+'</title><style>body{font-family:Arial;padding:32px;line-height:1.6;white-space:pre-wrap}h1{font-size:24px}</style></head><body><h1>'+esc(current.title)+'</h1><p>'+esc(current.board)+' · '+esc(current.subject)+'</p><div>'+esc(current.content).replace(/\n/g,'<br>')+'</div></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),250)
  }
  function updateStats(){
    const boardCount=allBoardNames().length;
    $('studyCountBadge').textContent=D.materials.length+' Resources · '+boardCount+' Boards';
    $('studyStatResources').textContent=D.materials.length;
    $('studyStatSaved').textContent=saved().length;
    $('studyStatRecent').textContent=recent().length;
    $('studyStatBuiltIn').textContent=D.materials.filter(x=>x.content).length;
  }
  function clearFilters(){
    $('studySearch').value='';$('studyBoard').value='';$('studyClass').value='';$('studyType').value='';$('studyCurriculumStatus').value='';
    fillSubjects();$('studySubject').value='';render();
  }

  $('studyClass').addEventListener('change',()=>{fillSubjects();render()});
  $('studyBoard').addEventListener('change',()=>{fillSubjects();render()});
  ['studySubject','studyType','studyCurriculumStatus'].forEach(id=>$(id)?.addEventListener('change',render));
  $('studySearch').addEventListener('input',render);
  $('clearStudyFiltersBtn')?.addEventListener('click',clearFilters);
  document.querySelectorAll('[data-study-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.studyTab;render()});
  $('closeStudyViewerBtn').onclick=close;$('printStudyBtn').onclick=printCurrent;$('studyAiSummaryBtn').onclick=()=>viewerPrompt('summary');$('studyAiQuizBtn').onclick=()=>viewerPrompt('quiz');$('studyPracticeBtn').onclick=practice;
  window.renderStudyLibrary=()=>{updateStats();render()};
  fill();
})();