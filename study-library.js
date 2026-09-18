(function(){
  const D=window.EDUNIZAM_STUDY_DATA;if(!D)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let activeTab='library',current=null;
  const saved=()=>JSON.parse(localStorage.getItem('edunizam_study_saved')||'[]');
  const recent=()=>JSON.parse(localStorage.getItem('edunizam_study_recent')||'[]');
  const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const byId=id=>D.materials.find(x=>x.id===id);

  function fill(){
    const boards=[...new Set(D.materials.map(x=>x.board))].sort();
    $('studyBoard').innerHTML='<option value="">All Boards</option>'+boards.map(x=>'<option>'+esc(x)+'</option>').join('');
    fillSubjects();updateStats();render();
  }
  function fillSubjects(){
    const cls=$('studyClass').value;
    const subs=[...new Set(D.materials.filter(x=>!cls||x.classLevels.includes(Number(cls))).map(x=>x.subject))].sort();
    $('studySubject').innerHTML='<option value="">All Subjects</option>'+subs.map(x=>'<option>'+esc(x)+'</option>').join('');
  }
  function filters(){return{q:$('studySearch').value.trim().toLowerCase(),board:$('studyBoard').value,cls:$('studyClass').value,subject:$('studySubject').value,type:$('studyType').value}}
  function match(x,f){
    const hay=[x.title,x.board,x.subject,x.type,x.note,x.content].join(' ').toLowerCase();
    return(!f.q||hay.includes(f.q))&&(!f.board||x.board===f.board)&&(!f.cls||x.classLevels.includes(Number(f.cls)))&&(!f.subject||x.subject===f.subject)&&(!f.type||x.type===f.type)
  }
  function card(x){
    const isSaved=saved().includes(x.id),local=!!x.content,direct=!!x.fileUrl||/\.pdf(?:$|[?#])/i.test(x.url||'');
    let actions='';
    if(local) actions+='<button data-study-open="'+x.id+'">Open</button>';
    else actions+='<a class="primary-link" href="'+esc(x.url)+'" target="_blank" rel="noopener" data-study-track="'+x.id+'">Open Source</a>';
    if(direct) actions+='<a class="secondary-link" href="'+esc(x.fileUrl||x.url)+'" target="_blank" rel="noopener">PDF</a>';
    actions+='<button class="secondary-action" data-study-summary="'+x.id+'">AI Summary</button>';
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(x.type)+'</span> '+(x.source==='official'?'<span class="trust-badge trust-official">Official</span>':'<span class="trust-badge trust-verified">Built-in</span>')+'</div><button class="icon-btn" data-study-save="'+x.id+'">'+(isSaved?'★':'☆')+'</button></div><h3>'+esc(x.title)+'</h3><p class="muted">'+esc(x.board)+' · '+esc(x.subject)+' · Class '+esc(x.classLevels.join(', '))+'</p>'+(x.note?'<p class="coverage-note">'+esc(x.note)+'</p>':'')+'<div class="paper-actions">'+actions+'</div></article>';
  }
  function render(){
    const f=filters();document.querySelectorAll('[data-study-tab]').forEach(b=>b.classList.toggle('active',b.dataset.studyTab===activeTab));
    let arr=D.materials.filter(x=>match(x,f));
    if(activeTab==='saved')arr=saved().map(byId).filter(Boolean).filter(x=>match(x,f));
    if(activeTab==='recent')arr=recent().map(x=>byId(x.id)).filter(Boolean).filter(x=>match(x,f));
    $('studyLibrary').innerHTML=arr.length?arr.map(card).join(''):'<div class="empty-state">No matching study material.</div>';
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
  function updateStats(){$('studyCountBadge').textContent=D.materials.length+' Resources';$('studyStatResources').textContent=D.materials.length;$('studyStatSaved').textContent=saved().length;$('studyStatRecent').textContent=recent().length;$('studyStatBuiltIn').textContent=D.materials.filter(x=>x.content).length}
  $('studyClass').addEventListener('change',()=>{fillSubjects();render()});['studyBoard','studySubject','studyType'].forEach(id=>$(id).addEventListener('change',render));$('studySearch').addEventListener('input',render);
  document.querySelectorAll('[data-study-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.studyTab;render()});
  $('closeStudyViewerBtn').onclick=close;$('printStudyBtn').onclick=printCurrent;$('studyAiSummaryBtn').onclick=()=>viewerPrompt('summary');$('studyAiQuizBtn').onclick=()=>viewerPrompt('quiz');$('studyPracticeBtn').onclick=practice;
  window.renderStudyLibrary=()=>{updateStats();render()};
  fill();
})();