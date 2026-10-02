(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_PATHWAYS,TB=window.EDUNIZAM_EXAM_TOPIC_BANK||{maps:[],questions:[]};
if(!D||!$('examPathGrid'))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('en-PK').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const PKEY='edunizam_exam_topic_progress_v1';
let drill={rows:[],index:0,score:0,answered:false,pathwayId:'',subject:'',topic:''};

function readProgress(){try{return JSON.parse(localStorage.getItem(PKEY)||'{"attempts":{},"visits":{}}')}catch(_){return{attempts:{},visits:{}}}}
function writeProgress(v){try{localStorage.setItem(PKEY,JSON.stringify(v))}catch(_){}}
function recordAttempt(q,correct){
 const p=readProgress();p.attempts=p.attempts||{};p.attempts[q.id]={correct:!!correct,ts:Date.now(),pathwayId:q.pathwayId,subject:q.subject,topic:q.topic};writeProgress(p)
}
function recordVisit(pathwayId,subject,topic){
 const p=readProgress();p.visits=p.visits||{};p.visits[[pathwayId,subject,topic].join('|')]=Date.now();writeProgress(p)
}
function progressFor(pathwayId){
 const a=Object.values(readProgress().attempts||{}).filter(x=>x.pathwayId===pathwayId);
 const correct=a.filter(x=>x.correct).length;
 return {attempted:a.length,correct,accuracy:a.length?Math.round(correct/a.length*100):0}
}
function openInternal(section){
  if(location.pathname.endsWith('/learn.html')||location.pathname.endsWith('learn.html')){
    history.replaceState(null,'','#'+section);
    document.querySelector('[data-tab="'+section+'"]')?.click();
    document.getElementById(section)?.scrollIntoView({behavior:'smooth',block:'start'});
  }else{
    const b=document.querySelector('[data-view="'+section+'"]');
    if(b)b.click();else location.href='learn.html#'+section;
  }
}
function injectStyles(){
 if(document.getElementById('examPathwayStyles'))return;
 const s=document.createElement('style');s.id='examPathwayStyles';s.textContent=`
 .exam-path-card{display:grid;gap:12px;min-width:0}.exam-path-card details{border:1px solid var(--line,#d7e2df);border-radius:14px;padding:10px 12px;background:#fff}.exam-path-card summary{cursor:pointer;font-weight:850}.exam-path-card ul{padding-left:20px;line-height:1.55}
 .path-subjects,.topic-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.path-subjects>div,.topic-subject{border:1px solid var(--line,#d7e2df);border-radius:12px;padding:10px;background:#f8fbfa}.path-subjects strong,.topic-subject strong{display:block;margin-bottom:4px}.path-subjects span,.topic-subject small{font-size:.86rem;line-height:1.45;color:var(--muted,#52645f)}
 .topic-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.topic-chip{border:1px solid var(--line,#d7e2df);background:#fff;border-radius:999px;padding:7px 9px;cursor:pointer;color:var(--green,#075347);font-weight:750}.topic-chip.has-drill:after{content:' · Drill';font-size:.72rem;color:var(--muted,#52645f)}
 .path-source-note{padding:9px 10px;border-radius:10px;background:#f3f8f6;font-size:.82rem;color:var(--muted,#52645f);margin:8px 0}.path-progress{display:flex;gap:7px;flex-wrap:wrap}.path-progress span{font-size:.76rem;border:1px solid var(--line,#d7e2df);border-radius:999px;padding:5px 8px;background:#fff}
 .path-steps{counter-reset:pathstep;list-style:none;padding:0;margin:12px 0 0;display:grid;gap:10px}.path-steps li{position:relative;padding:12px 12px 12px 42px;border:1px solid var(--line,#d7e2df);border-radius:14px;background:#fff}.path-steps li:before{counter-increment:pathstep;content:counter(pathstep);position:absolute;left:10px;top:11px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--green,#075347);color:#fff;font-weight:900;font-size:.78rem}.path-steps p{margin:5px 0 8px;line-height:1.48;color:var(--muted,#52645f)}.path-steps a,.path-steps button{display:inline-flex;align-items:center;border:1px solid var(--line,#d7e2df);border-radius:9px;padding:7px 9px;background:#fff;color:var(--green,#075347);font-weight:800;text-decoration:none;cursor:pointer}
 .exam-drill-modal{position:fixed;inset:0;z-index:120;background:rgba(5,20,22,.76);display:none;place-items:center;padding:14px}.exam-drill-modal.open{display:grid}.exam-drill-dialog{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:18px}.exam-drill-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.exam-drill-meta{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 14px}.exam-drill-meta span{font-size:.75rem;border:1px solid var(--line,#d7e2df);border-radius:999px;padding:5px 7px}.exam-drill-question{font-size:1.08rem;font-weight:800;line-height:1.5;margin:14px 0}.exam-drill-options{display:grid;gap:9px}.exam-drill-option{width:100%;text-align:left;min-height:46px;border:1px solid var(--line,#d7e2df);border-radius:12px;background:#fff;padding:10px;cursor:pointer}.exam-drill-option.correct{border-color:#2d7a59;background:#eefaf3}.exam-drill-option.wrong{border-color:#b54c4c;background:#fff1f1}.exam-drill-explain{margin-top:12px;padding:11px;border-radius:12px;background:#f5f8f7;line-height:1.5}.exam-drill-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.exam-drill-actions button{min-height:42px}
 @media(max-width:640px){.path-subjects,.topic-subjects{grid-template-columns:1fr}.exam-path-card details{padding:9px}.path-steps li{padding:11px 10px 11px 40px}.exam-path-card .paper-actions{display:grid}.exam-path-card .paper-actions a{width:100%;text-align:center}.topic-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:5px}.topic-chip{flex:0 0 auto}.exam-drill-dialog{padding:14px}.exam-drill-actions{display:grid;grid-template-columns:1fr 1fr}.exam-drill-actions button{width:100%}}
 `;document.head.appendChild(s)
}
function injectDrillModal(){
 if($('examDrillModal'))return;
 const m=document.createElement('div');m.id='examDrillModal';m.className='exam-drill-modal';m.setAttribute('aria-hidden','true');
 m.innerHTML='<div class="exam-drill-dialog" role="dialog" aria-modal="true" aria-labelledby="examDrillTitle"><div class="exam-drill-head"><div><h3 id="examDrillTitle">Topic Drill</h3><p id="examDrillSubtitle" class="muted"></p></div><button id="examDrillClose" type="button" class="secondary">Close</button></div><div id="examDrillBody"></div></div>';
 document.body.appendChild(m);
 $('examDrillClose').onclick=closeDrill;
 m.addEventListener('click',e=>{if(e.target===m)closeDrill()});
}
function closeDrill(){const m=$('examDrillModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}document.body.classList.remove('guest-modal-open')}
function mapFor(id){return (TB.maps||[]).find(x=>x.pathwayId===id)}
function topicMap(x){
 const map=mapFor(x.id);if(!map)return '<p class="muted">This pathway is course/case-specific. Use the official course or case syllabus linked below.</p>';
 const qs=TB.questions||[];
 return '<div class="path-source-note"><strong>Topic-map source:</strong> '+esc(map.sourceLabel||map.sourceMode||'Preparation map')+' · '+esc(map.sourceMode||'')+(map.sourceUrl?' · <a target="_blank" rel="noopener" href="'+esc(map.sourceUrl)+'">verify source</a>':'')+'</div><div class="topic-subjects">'+map.subjects.map(s=>{
   const chips=(s.topics||[]).map(t=>{
     const has=qs.some(q=>q.pathwayId===x.id&&q.subject===s.name&&q.topic===t);
     return '<button type="button" class="topic-chip'+(has?' has-drill':'')+'" data-drill-pathway="'+esc(x.id)+'" data-drill-subject="'+esc(s.name)+'" data-drill-topic="'+esc(t)+'">'+esc(t)+'</button>';
   }).join('');
   return '<div class="topic-subject"><strong>'+esc(s.name)+(s.weight?' · '+esc(s.weight):'')+'</strong>'+(s.note?'<small>'+esc(s.note)+'</small>':'')+'<div class="topic-chips">'+chips+'</div></div>';
 }).join('')+'</div>'
}
function startDrill(pathwayId,subject,topic){
 injectDrillModal();recordVisit(pathwayId,subject,topic);
 const rows=(TB.questions||[]).filter(q=>q.pathwayId===pathwayId&&q.subject===subject&&q.topic===topic);
 drill={rows,index:0,score:0,answered:false,pathwayId,subject,topic};
 const p=D.pathways.find(x=>x.id===pathwayId);
 $('examDrillTitle').textContent=(p?.name||pathwayId)+' Topic Drill';
 $('examDrillSubtitle').textContent=subject+' · '+topic+' · EduNizam supplementary practice';
 const m=$('examDrillModal');m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('guest-modal-open');
 renderDrill();
}
function renderDrill(){
 const body=$('examDrillBody');if(!body)return;
 if(!drill.rows.length){
   const map=mapFor(drill.pathwayId);
   body.innerHTML='<div class="exam-drill-meta"><span>'+esc(drill.subject)+'</span><span>'+esc(drill.topic)+'</span></div><p class="exam-drill-question">Topic map ready; a built-in drill has not been added for this topic yet.</p><p class="muted">Use the official source for scope, then open the general Practice Center for related concepts. EduNizam will not fabricate an “official” question for an uncovered topic.</p><div class="exam-drill-actions">'+(map?.sourceUrl?'<a class="btn" target="_blank" rel="noopener" href="'+esc(map.sourceUrl)+'">Official source</a>':'')+'<button class="btn primary" type="button" data-open-general-practice>Open Practice Center</button></div>';
   body.querySelector('[data-open-general-practice]')?.addEventListener('click',()=>{closeDrill();openInternal('practice')});
   return;
 }
 const q=drill.rows[drill.index];drill.answered=false;
 const meta='<div class="exam-drill-meta"><span>'+esc(q.subject)+'</span><span>'+esc(q.topic)+'</span><span>'+esc(q.difficulty||'Practice')+'</span><span>'+(drill.index+1)+' / '+drill.rows.length+'</span></div>';
 if(q.type==='written'){
   body.innerHTML=meta+'<div class="exam-drill-question">'+esc(q.q)+'</div><button id="showDrillAnswer" class="btn primary" type="button">Show suggested answer</button><div id="examDrillExplain" class="exam-drill-explain" hidden></div><div class="exam-drill-actions"><button id="examDrillPrev" class="secondary" type="button">Previous</button><button id="examDrillNext" type="button">Next</button></div>';
   $('showDrillAnswer').onclick=()=>{const e=$('examDrillExplain');e.hidden=false;e.textContent=q.answerText||'Review against the official syllabus/source.';recordAttempt(q,true)};
 }else{
   body.innerHTML=meta+'<div class="exam-drill-question">'+esc(q.q)+'</div><div class="exam-drill-options">'+(q.options||[]).map((o,i)=>'<button class="exam-drill-option" type="button" data-drill-answer="'+i+'">'+esc(o)+'</button>').join('')+'</div><div id="examDrillExplain" class="exam-drill-explain" hidden></div><div class="exam-drill-actions"><button id="examDrillPrev" class="secondary" type="button">Previous</button><button id="examDrillNext" type="button">Next</button></div>';
   body.querySelectorAll('[data-drill-answer]').forEach(b=>b.onclick=()=>{
     if(drill.answered)return;drill.answered=true;const n=Number(b.dataset.drillAnswer),ok=n===q.answer;if(ok)drill.score++;
     body.querySelectorAll('[data-drill-answer]').forEach((z,i)=>z.classList.add(i===q.answer?'correct':(i===n?'wrong':'')));
     const e=$('examDrillExplain');e.hidden=false;e.textContent=(ok?'Correct. ':'Review: ')+(q.explain||'');recordAttempt(q,ok);
   });
 }
 $('examDrillPrev').onclick=()=>{if(drill.index>0){drill.index--;renderDrill()}};
 $('examDrillNext').onclick=()=>{if(drill.index<drill.rows.length-1){drill.index++;renderDrill()}else{$('examDrillBody').innerHTML='<h3>Drill complete</h3><p>You worked through '+drill.rows.length+' built-in question'+(drill.rows.length===1?'':'s')+' for <strong>'+esc(drill.topic)+'</strong>.</p><div class="exam-drill-actions"><button id="restartExamDrill" class="btn primary" type="button">Restart Topic</button><button id="closeFinishedDrill" class="btn" type="button">Close</button></div>';$('restartExamDrill').onclick=()=>{drill.index=0;drill.score=0;renderDrill()};$('closeFinishedDrill').onclick=()=>{closeDrill();render()}}};
}
function init(){
 injectStyles();injectDrillModal();
 const pf=$('examPathwayFilter'),stage=$('examPathStage'),auth=$('examPathAuthority');
 if(pf)pf.innerHTML='<option value="">All Pathways</option>'+D.pathways.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
 const stages=[...new Set(D.pathways.map(x=>x.stage).filter(Boolean))].sort(),auths=[...new Set(D.pathways.map(x=>x.authority).filter(Boolean))].sort();
 if(stage)stage.innerHTML='<option value="">All Stages</option>'+stages.map(x=>'<option>'+esc(x)+'</option>').join('');
 if(auth)auth.innerHTML='<option value="">All Authorities</option>'+auths.map(x=>'<option>'+esc(x)+'</option>').join('');
 ['examPathwayFilter','examPathStage','examPathAuthority'].forEach(id=>$(id)?.addEventListener('change',render));
 $('examPathSearch')?.addEventListener('input',render);
 $('examPathSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();render()}});
 $('examPathSearchBtn')?.addEventListener('click',render);
 document.querySelectorAll('[data-pathway-quick]').forEach(b=>b.onclick=()=>{if(pf)pf.value=b.dataset.pathwayQuick;render();$('examPathGrid')?.scrollIntoView({behavior:'smooth',block:'start'})});
 $('examPathGrid')?.addEventListener('click',e=>{
   const internal=e.target.closest('[data-internal-path]');if(internal){e.preventDefault();openInternal(internal.dataset.internalPath);return}
   const t=e.target.closest('[data-drill-pathway]');if(t){e.preventDefault();startDrill(t.dataset.drillPathway,t.dataset.drillSubject,t.dataset.drillTopic)}
 });
 render();
}
function subjectList(x){return '<div class="path-subjects">'+x.subjects.map(s=>'<div><strong>'+esc(s.name)+'</strong><span>'+esc(s.focus)+'</span></div>').join('')+'</div>'}
function steps(x){return '<ol class="path-steps">'+x.steps.map(s=>'<li><strong>'+esc(s.title)+'</strong><p>'+esc(s.detail)+'</p>'+(s.url?'<a target="_blank" rel="noopener" href="'+esc(s.url)+'">Open official source</a>':s.internal?'<button type="button" data-internal-path="'+esc(s.internal)+'">Open EduNizam '+esc(s.internal==='practice'?'Practice':s.internal.toUpperCase())+'</button>':'')+'</li>').join('')+'</ol>'}
function card(x){
 const prog=progressFor(x.id);
 return '<article class="paper-card exam-path-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official-source pathway</span><span class="mini-badge">'+esc(x.stage)+'</span></div></div><h3>'+esc(x.name)+'</h3><p class="muted">'+esc(x.authority)+' · '+esc(x.region)+'</p><div class="path-progress"><span>'+prog.attempted+' drill attempts</span>'+(prog.attempted?'<span>'+prog.accuracy+'% correct</span>':'<span>Start a topic drill</span>')+'</div><p>'+esc(x.overview)+'</p><details><summary>Exam / study pattern</summary><ul>'+x.pattern.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></details><details><summary>High-level subjects</summary>'+subjectList(x)+'</details><details open><summary>Subject → topic preparation map</summary>'+topicMap(x)+'</details><details><summary>Step-by-step pathway</summary>'+steps(x)+'</details><div class="paper-actions">'+x.official.map(o=>'<a target="_blank" rel="noopener" href="'+esc(o.url)+'">'+esc(o.label)+'</a>').join('')+'</div></article>'
}
function render(){
 const q=norm($('examPathSearch')?.value||''),id=$('examPathwayFilter')?.value||'',stage=$('examPathStage')?.value||'',auth=$('examPathAuthority')?.value||'';
 const rows=D.pathways.filter(x=>{
   const map=mapFor(x.id),hay=norm(JSON.stringify(x)+' '+JSON.stringify(map||{}));
   return (!q||hay.includes(q))&&(!id||x.id===id)&&(!stage||x.stage===stage)&&(!auth||x.authority===auth);
 });
 if($('examPathCountBadge'))$('examPathCountBadge').textContent=D.pathways.length+' Guided Pathways · '+(TB.questions||[]).length+' Built-in Drills';
 $('examPathGrid').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty-state">No pathway or topic matched. Try MDCAT Biology, ECAT Mathematics, NET Physics, USAT reasoning, LAT English, CSS Current Affairs, FPSC or PPSC.</div>';
}
window.renderExamPathways=render;
window.EDUNIZAM_EXAM_PATHWAY_ENGINE={render,startDrill,progressFor};
init();
})();