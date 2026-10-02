(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_PATHWAYS,PREP=window.EDUNIZAM_EXAM_PREP||{exams:[],questions:[]};
if(!D||!$('examPathGrid'))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('en-PK').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const HKEY='edunizam_exam_prep_history_v1';

function prepFor(id){return (PREP.exams||[]).find(x=>x.id===id)}
function historyFor(id){
  let h=[];try{h=JSON.parse(localStorage.getItem(HKEY)||'[]')}catch(_){}
  const rows=h.filter(x=>x.examId===id),best=rows.length?Math.max(...rows.map(x=>Number(x.score||0))):0;
  return {sessions:rows.length,best}
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
function selectValue(id,value){
  const el=$(id);if(!el)return false;
  const opt=[...el.options].find(o=>o.value===value||o.textContent===value);
  if(!opt)return false;el.value=opt.value;el.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function openTopicPractice(pathwayId,subject,topic){
  const examSel=$('examPrepExam');
  if(!examSel){openInternal('practice');return}
  selectValue('examPrepExam',pathwayId);
  selectValue('examPrepSubject',subject);
  selectValue('examPrepTopic',topic);
  $('examPrepLab')?.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>{$('examPrepStart')?.focus()},250);
}
function injectStyles(){
 if(document.getElementById('examPathwayStyles'))return;
 const s=document.createElement('style');s.id='examPathwayStyles';s.textContent=`
 .exam-path-card{display:grid;gap:12px;min-width:0}.exam-path-card details{border:1px solid var(--line,#d7e2df);border-radius:14px;padding:10px 12px;background:#fff}.exam-path-card summary{cursor:pointer;font-weight:850}.exam-path-card ul{padding-left:20px;line-height:1.55}
 .path-subjects,.topic-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.path-subjects>div,.topic-subject{border:1px solid var(--line,#d7e2df);border-radius:12px;padding:10px;background:#f8fbfa}.path-subjects strong,.topic-subject strong{display:block;margin-bottom:4px}.path-subjects span,.topic-subject small{font-size:.86rem;line-height:1.45;color:var(--muted,#52645f)}
 .topic-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.topic-chip{border:1px solid var(--line,#d7e2df);background:#fff;border-radius:999px;padding:7px 9px;cursor:pointer;color:var(--green,#075347);font-weight:750}.topic-chip.has-drill:after{content:' · Practice';font-size:.72rem;color:var(--muted,#52645f)}
 .path-source-note{padding:9px 10px;border-radius:10px;background:#f3f8f6;font-size:.82rem;color:var(--muted,#52645f);margin:8px 0}.path-progress{display:flex;gap:7px;flex-wrap:wrap}.path-progress span{font-size:.76rem;border:1px solid var(--line,#d7e2df);border-radius:999px;padding:5px 8px;background:#fff}
 .path-steps{counter-reset:pathstep;list-style:none;padding:0;margin:12px 0 0;display:grid;gap:10px}.path-steps li{position:relative;padding:12px 12px 12px 42px;border:1px solid var(--line,#d7e2df);border-radius:14px;background:#fff}.path-steps li:before{counter-increment:pathstep;content:counter(pathstep);position:absolute;left:10px;top:11px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--green,#075347);color:#fff;font-weight:900;font-size:.78rem}.path-steps p{margin:5px 0 8px;line-height:1.48;color:var(--muted,#52645f)}.path-steps a,.path-steps button{display:inline-flex;align-items:center;border:1px solid var(--line,#d7e2df);border-radius:9px;padding:7px 9px;background:#fff;color:var(--green,#075347);font-weight:800;text-decoration:none;cursor:pointer}
 @media(max-width:640px){.path-subjects,.topic-subjects{grid-template-columns:1fr}.exam-path-card details{padding:9px}.path-steps li{padding:11px 10px 11px 40px}.exam-path-card .paper-actions{display:grid}.exam-path-card .paper-actions a{width:100%;text-align:center}.topic-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:5px}.topic-chip{flex:0 0 auto;max-width:84vw;white-space:nowrap}}
 `;document.head.appendChild(s)
}
function init(){
 injectStyles();
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
   const topic=e.target.closest('[data-topic-pathway]');if(topic){e.preventDefault();openTopicPractice(topic.dataset.topicPathway,topic.dataset.topicSubject,topic.dataset.topicName)}
 });
 render();
}
function subjectList(x){return '<div class="path-subjects">'+x.subjects.map(s=>'<div><strong>'+esc(s.name)+'</strong><span>'+esc(s.focus)+'</span></div>').join('')+'</div>'}
function steps(x){return '<ol class="path-steps">'+x.steps.map(s=>'<li><strong>'+esc(s.title)+'</strong><p>'+esc(s.detail)+'</p>'+(s.url?'<a target="_blank" rel="noopener" href="'+esc(s.url)+'">Open official source</a>':s.internal?'<button type="button" data-internal-path="'+esc(s.internal)+'">Open EduNizam '+esc(s.internal==='practice'?'Practice':s.internal.toUpperCase())+'</button>':'')+'</li>').join('')+'</ol>'}
function topicMap(x){
 const prep=prepFor(x.id);
 if(!prep)return '<p class="muted">This route is case/course-specific, so EduNizam does not invent one generic topic syllabus. Use the exact official case, course or semester source below.</p>';
 const questions=PREP.questions||[];
 return '<div class="path-source-note"><strong>Preparation basis:</strong> '+esc(prep.basisLabel||prep.basis||'Preparation map')+'. Built-in items are EduNizam practice, not official/leaked exam questions.</div><div class="topic-subjects">'+Object.entries(prep.subjects||{}).map(([subject,topics])=>{
   const chips=(topics||[]).map(topic=>{
     const has=questions.some(q=>q.examId===x.id&&q.subject===subject&&q.topic===topic);
     return '<button type="button" class="topic-chip'+(has?' has-drill':'')+'" data-topic-pathway="'+esc(x.id)+'" data-topic-subject="'+esc(subject)+'" data-topic-name="'+esc(topic)+'">'+esc(topic)+'</button>';
   }).join('');
   return '<div class="topic-subject"><strong>'+esc(subject)+'</strong><small>'+questions.filter(q=>q.examId===x.id&&q.subject===subject).length+' built-in practice item(s)</small><div class="topic-chips">'+chips+'</div></div>';
 }).join('')+'</div>'
}
function card(x){
 const h=historyFor(x.id),prep=prepFor(x.id),items=(PREP.questions||[]).filter(q=>q.examId===x.id).length;
 return '<article class="paper-card exam-path-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official-source pathway</span><span class="mini-badge">'+esc(x.stage)+'</span></div></div><h3>'+esc(x.name)+'</h3><p class="muted">'+esc(x.authority)+' · '+esc(x.region)+'</p><div class="path-progress">'+(prep?'<span>'+Object.values(prep.subjects||{}).flat().length+' mapped topics</span><span>'+items+' practice items</span>':'<span>Case/course-specific</span>')+(h.sessions?'<span>'+h.sessions+' sessions · Best '+h.best+'%</span>':'')+'</div><p>'+esc(x.overview)+'</p><details><summary>Exam / study pattern</summary><ul>'+x.pattern.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></details><details><summary>High-level subjects</summary>'+subjectList(x)+'</details><details open><summary>Subject → topic preparation map</summary>'+topicMap(x)+'</details><details><summary>Step-by-step pathway</summary>'+steps(x)+'</details><div class="paper-actions">'+x.official.map(o=>'<a target="_blank" rel="noopener" href="'+esc(o.url)+'">'+esc(o.label)+'</a>').join('')+'</div></article>'
}
function render(){
 const q=norm($('examPathSearch')?.value||''),id=$('examPathwayFilter')?.value||'',stage=$('examPathStage')?.value||'',auth=$('examPathAuthority')?.value||'';
 const rows=D.pathways.filter(x=>{
   const prep=prepFor(x.id),hay=norm(JSON.stringify(x)+' '+JSON.stringify(prep||{}));
   return (!q||q.split(' ').every(t=>hay.includes(t)))&&(!id||x.id===id)&&(!stage||x.stage===stage)&&(!auth||x.authority===auth);
 });
 if($('examPathCountBadge'))$('examPathCountBadge').textContent=D.pathways.length+' Guided Pathways · '+(PREP.questions||[]).length+' Practice Items';
 $('examPathGrid').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty-state">No pathway or topic matched. Try MDCAT Biology, ECAT Mathematics, NET Physics, USAT reasoning, LAT English, CSS Current Affairs, FPSC or PPSC.</div>';
}
window.renderExamPathways=render;
window.EDUNIZAM_EXAM_PATHWAY_ENGINE={render,openTopicPractice};
init();
})();