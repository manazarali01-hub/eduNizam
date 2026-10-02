(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_PREP;if(!D)return;
const CHECK=window.EDUNIZAM_EXAM_CHECKPOINTS||null;
const KEY='edunizam_exam_prep_history_v1',esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const getHistory=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}},setHistory=v=>{try{localStorage.setItem(KEY,JSON.stringify(v.slice(0,50)))}catch(_){}};
let rows=[],idx=0,attempts=new Map(),finished=false;
function exam(){return D.exams.find(x=>x.id===$('examPrepExam')?.value)}
function unique(a){return [...new Set(a.filter(Boolean))]}
function setOptions(el,label,values,current=''){if(!el)return;el.innerHTML='<option value="">'+esc(label)+'</option>'+values.map(x=>'<option>'+esc(x)+'</option>').join('');if([...el.options].some(o=>o.value===current))el.value=current}
function directFor(examId,subject,topic){return D.questions.filter(q=>(!examId||q.examId===examId)&&(!subject||q.subject===subject)&&(!topic||q.topic===topic))}
function renderCoverage(){
 const box=$('examPrepCoverage');if(!box)return;
 const e=exam(),sub=$('examPrepSubject')?.value||'';
 if(!e){box.innerHTML='';return}
 const subjects=sub?[sub]:Object.keys(e.subjects||{});
 const all=subjects.flatMap(s=>(e.subjects[s]||[]).map(topic=>({subject:s,topic})));
 const direct=all.filter(x=>directFor(e.id,x.subject,x.topic).length>0).length;
 box.innerHTML='<div class="exam-coverage-head"><div><strong>Topic coverage</strong><span>'+direct+' of '+all.length+' mapped topics have direct built-in drills; uncovered topics use clearly labelled Study Checkpoints.</span></div><progress max="'+all.length+'" value="'+direct+'" aria-label="Direct drill topic coverage"></progress></div><div class="exam-coverage-list">'+all.map(x=>{
   const n=directFor(e.id,x.subject,x.topic).length,kind=n?(n+' direct item'+(n===1?'':'s')):'Study checkpoint';
   return '<div class="exam-coverage-row"><div><strong>'+esc(x.topic)+'</strong><small>'+esc(x.subject)+' · '+kind+'</small></div><div class="exam-coverage-checks"><button type="button" data-cover-practice data-subject="'+esc(x.subject)+'" data-topic="'+esc(x.topic)+'">'+(n?'Practice':'Open Checkpoint')+'</button></div></div>';
 }).join('')+'</div>';
 box.querySelectorAll('[data-cover-practice]').forEach(b=>b.onclick=()=>{
   const subEl=$('examPrepSubject'),topicEl=$('examPrepTopic');
   if(subEl){subEl.value=b.dataset.subject;refresh()}
   if(topicEl){topicEl.value=b.dataset.topic;updateCount()}
   start();
 });
}
function refresh(){
 const e=exam(),sub=$('examPrepSubject'),topic=$('examPrepTopic'),oldSub=sub?.value||'',oldTopic=topic?.value||'';
 if(!e){setOptions(sub,'All Subjects',[]);setOptions(topic,'All Topics',[]);if($('examPrepBasis'))$('examPrepBasis').textContent='Choose an exam to see its subject/topic preparation map.';updateCount();renderCoverage();return}
 setOptions(sub,'All Subjects',Object.keys(e.subjects),oldSub);
 const topics=sub?.value?e.subjects[sub.value]||[]:unique(Object.values(e.subjects).flat());
 setOptions(topic,'All Topics',topics,oldTopic);
 if($('examPrepBasis'))$('examPrepBasis').innerHTML='<strong>'+esc(e.name)+':</strong> '+esc(e.basisLabel)+'. <span class="muted">Direct drills and Study Checkpoints are EduNizam supplementary practice, not leaked or official exam questions.</span>';
 updateCount();renderCoverage();
}
function filtered(){
 const e=$('examPrepExam')?.value||'',sub=$('examPrepSubject')?.value||'',topic=$('examPrepTopic')?.value||'',diff=$('examPrepDifficulty')?.value||'',type=$('examPrepType')?.value||'';
 return D.questions.filter(q=>(!e||q.examId===e)&&(!sub||q.subject===sub)&&(!topic||q.topic===topic)&&(!diff||q.difficulty===diff)&&(!type||q.type===type));
}
function fallbackCheckpoint(){
 const e=$('examPrepExam')?.value||'',sub=$('examPrepSubject')?.value||'',topic=$('examPrepTopic')?.value||'';
 if(!CHECK?.get||!e||!sub||!topic)return null;
 return CHECK.get(e,sub,topic);
}
function updateCount(){
 const n=filtered().length,cp=!n?fallbackCheckpoint():null;
 if($('examPrepAvailable'))$('examPrepAvailable').textContent=n
   ?n+' direct built-in practice item'+(n===1?'':'s')+' match the selected filters.'
   :cp?'No direct drill yet; one Study Checkpoint is available for this exact topic.'
   :'No direct built-in item matches these filters yet. Choose an exact subject/topic for a Study Checkpoint.';
}
function start(){
 rows=filtered();
 const cp=!rows.length?fallbackCheckpoint():null;if(cp)rows=[cp];
 const limit=$('examPrepCount')?.value||'10';if(limit!=='all'&&rows.length>1)rows=rows.slice().sort(()=>Math.random()-.5).slice(0,Math.max(1,Number(limit)||10));
 if(!rows.length){if($('examPrepSession'))$('examPrepSession').hidden=false;$('examPrepQuestion').textContent='No practice item matches these filters yet. Choose an exact exam, subject and topic for a Study Checkpoint.';$('examPrepOptions').innerHTML='';$('examPrepExplain').hidden=true;return}
 idx=0;attempts=new Map();finished=false;$('examPrepSession').hidden=false;render()
}
function stats(){let mcq=0,correct=0,written=0,checkpoints=0;attempts.forEach((a,id)=>{const q=rows.find(x=>x.id===id);if(q?.kind==='checkpoint')checkpoints++;if(a.type==='mcq'){mcq++;if(a.correct)correct++}else if(a.type==='written')written++});return{mcq,correct,written,checkpoints}}
function render(){
 const q=rows[idx];if(!q)return;const a=attempts.get(q.id),last=idx===rows.length-1;
 $('examPrepMeta').innerHTML='<span class="badge">'+esc(D.exams.find(x=>x.id===q.examId)?.name||q.examId)+'</span><span class="badge">'+esc(q.subject)+'</span><span class="badge">'+esc(q.topic)+'</span><span class="badge">'+esc(q.kind==='checkpoint'?'Study Checkpoint':q.difficulty||'Practice')+'</span><span class="badge">'+(idx+1)+'/'+rows.length+'</span>';
 $('examPrepQuestion').textContent=q.question;$('examPrepExplain').hidden=true;$('examPrepExplain').textContent='';
 let html='';
 if(q.type==='mcq')html=(q.options||[]).map((o,i)=>'<button class="option" data-exam-answer="'+i+'">'+esc(o)+'</button>').join('');
 else html='<button class="option" id="examPrepShowAnswer">'+(q.kind==='checkpoint'?'Show self-check framework':'Show suggested answer / framework')+'</button>';
 html+='<div class="quick-actions" style="margin-top:12px"><button id="examPrepPrev" class="secondary" '+(idx===0?'disabled':'')+'>Previous</button><button id="examPrepNext">'+(last?'Finish Session':'Next')+'</button></div>';
 $('examPrepOptions').innerHTML=html;
 if(q.type==='mcq'){
   const btns=[...document.querySelectorAll('[data-exam-answer]')];
   const paint=choice=>{btns.forEach((b,i)=>{b.disabled=true;b.classList.add(i===q.answer?'correct':(i===choice?'wrong':''))});$('examPrepExplain').hidden=false;$('examPrepExplain').textContent=(choice===q.answer?'Correct. ':'Review: ')+(q.explanation||'')};
   if(a)paint(a.choice);else btns.forEach(b=>b.onclick=()=>{const choice=Number(b.dataset.examAnswer);attempts.set(q.id,{type:'mcq',choice,correct:choice===q.answer});paint(choice);updateProgress()});
 }else{
   const show=()=>{$('examPrepExplain').hidden=false;$('examPrepExplain').textContent=q.answerText||'Review against the controlling official source.';$('examPrepShowAnswer').disabled=true};
   if(a)show();else $('examPrepShowAnswer').onclick=()=>{attempts.set(q.id,{type:'written',reviewed:true,checkpoint:q.kind==='checkpoint'});show();updateProgress()};
 }
 $('examPrepPrev').onclick=()=>{if(idx>0){idx--;render()}};
 $('examPrepNext').onclick=()=>last?finish():(idx++,render());
 updateProgress();
}
function updateProgress(){const s=stats();$('examPrepProgress').textContent='Attempted '+attempts.size+'/'+rows.length+' · MCQ '+s.correct+'/'+s.mcq+' · Written reviewed '+s.written+(s.checkpoints?' · Checkpoints '+s.checkpoints:'')}
function finish(){
 if(finished)return;finished=true;const s=stats(),missed=rows.filter(q=>{const a=attempts.get(q.id);return !a||(a.type==='mcq'&&!a.correct)}),weak={};
 missed.forEach(q=>{const k=q.subject+' · '+q.topic;weak[k]=(weak[k]||0)+1});
 const score=s.mcq?Math.round(s.correct/s.mcq*100):0,e=exam();
 const rec={at:new Date().toISOString(),examId:e?.id||'',exam:e?.name||'',score,mcq:s.mcq,correct:s.correct,written:s.written,checkpoints:s.checkpoints,count:rows.length,weak};
 setHistory([rec,...getHistory()]);
 $('examPrepMeta').innerHTML='<span class="badge">Session complete</span><span class="badge">'+esc(e?.name||'Exam')+'</span>'+(s.mcq?'<span class="badge">'+score+'% MCQ</span>':'')+(s.checkpoints?'<span class="badge">'+s.checkpoints+' checkpoint reviewed</span>':'');
 $('examPrepQuestion').textContent='Topic-practice session completed.';
 $('examPrepOptions').innerHTML='<div class="quick-actions"><button id="examPrepAgain">Practice Again</button><button id="examPrepReview" class="secondary" '+(missed.length?'':'disabled')+'>Review Weak / Missed ('+missed.length+')</button></div>';
 $('examPrepExplain').hidden=false;$('examPrepExplain').textContent='MCQ: '+s.correct+'/'+s.mcq+' · Written reviewed: '+s.written+' · Weak/missed items: '+missed.length+'.';
 $('examPrepAgain').onclick=start;
 const b=$('examPrepReview');if(b&&!b.disabled)b.onclick=()=>{rows=missed;idx=0;attempts=new Map();finished=false;render()};
 renderHistory();renderCoverage();
}
function renderHistory(){
 const box=$('examPrepHistory');if(!box)return;const h=getHistory();
 if(!h.length){box.innerHTML='<span class="muted">No exam-topic practice history on this device yet.</span>';return}
 const weak={};h.forEach(r=>Object.entries(r.weak||{}).forEach(([k,v])=>weak[k]=(weak[k]||0)+Number(v||0)));
 const top=Object.entries(weak).sort((a,b)=>b[1]-a[1]).slice(0,6);
 box.innerHTML='<strong>Recent topic practice</strong><div class="search-suggestions" style="margin-top:8px">'+h.slice(0,5).map(r=>'<span class="recent-chip">'+esc(r.exam)+' · '+(r.mcq?r.score+'% MCQ · ':'')+r.count+' items'+(r.checkpoints?' · '+r.checkpoints+' checkpoint':'')+'</span>').join('')+'</div>'+(top.length?'<p class="muted" style="margin:10px 0 5px">Weak-topic signals</p><div class="search-suggestions">'+top.map(([k,v])=>'<span class="recent-chip">'+esc(k)+' ('+v+')</span>').join('')+'</div>':'');
}
function injectCoverageStyles(){
 if($('examPrepCoverageStyles'))return;
 const s=document.createElement('style');s.id='examPrepCoverageStyles';s.textContent='.exam-coverage-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:12px 0}.exam-coverage-head>div{display:grid;gap:3px}.exam-coverage-head span{font-size:.8rem;color:var(--muted)}.exam-coverage-head progress{width:min(260px,45vw);height:12px;accent-color:var(--green,#075347)}.exam-coverage-list{display:grid;gap:7px;max-height:420px;overflow:auto}.exam-coverage-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:8px 0;border-top:1px solid var(--line,#d7e2df)}.exam-coverage-row:first-child{border-top:0}.exam-coverage-row small{display:block;color:var(--muted);margin-top:2px}.exam-coverage-checks button{border:1px solid var(--line,#d7e2df);background:#fff;border-radius:999px;padding:6px 9px;font-size:.75rem;cursor:pointer;font-weight:800;color:var(--green,#075347)}@media(max-width:680px){.exam-coverage-head{align-items:flex-start;flex-direction:column}.exam-coverage-head progress{width:100%}.exam-coverage-row{grid-template-columns:1fr}.exam-coverage-checks button{width:100%;min-height:40px}}';document.head.appendChild(s)
}
function init(){
 if(!$('examPrepExam'))return;
 injectCoverageStyles();
 $('examPrepExam').innerHTML='<option value="">Choose Exam</option>'+D.exams.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('');
 $('examPrepExam').addEventListener('change',refresh);$('examPrepSubject').addEventListener('change',refresh);$('examPrepTopic').addEventListener('change',()=>{updateCount();renderCoverage()});$('examPrepDifficulty').addEventListener('change',updateCount);$('examPrepType').addEventListener('change',updateCount);
 $('examPrepStart').onclick=start;
 document.querySelectorAll('[data-exam-prep-quick]').forEach(b=>b.onclick=()=>{$('examPrepExam').value=b.dataset.examPrepQuick;refresh();$('examPrepLab')?.scrollIntoView({behavior:'smooth',block:'start'})});
 refresh();renderHistory();
}
window.EDUNIZAM_EXAM_TOPIC_PRACTICE={render:init,start,history:getHistory,refresh,renderCoverage};
init();
})();