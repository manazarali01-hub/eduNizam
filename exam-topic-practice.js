(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_PREP;if(!D)return;
const KEY='edunizam_exam_prep_history_v1', CKEY='edunizam_exam_prep_coverage_v1', esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const getHistory=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}},setHistory=v=>{try{localStorage.setItem(KEY,JSON.stringify(v.slice(0,50)))}catch(_){}},getCoverage=()=>{try{return JSON.parse(localStorage.getItem(CKEY)||'{}')}catch(_){return{}}},setCoverage=v=>{try{localStorage.setItem(CKEY,JSON.stringify(v))}catch(_){}};
let rows=[],idx=0,attempts=new Map(),finished=false;
function exam(){return D.exams.find(x=>x.id===$('examPrepExam')?.value)}
function unique(a){return [...new Set(a.filter(Boolean))]}
function setOptions(el,label,values,current=''){if(!el)return;el.innerHTML='<option value="">'+esc(label)+'</option>'+values.map(x=>'<option>'+esc(x)+'</option>').join('');if([...el.options].some(o=>o.value===current))el.value=current}
function coverageKey(examId,subject,topic){return [examId,subject,topic].join('|')}
function renderCoverage(){
 const box=$('examPrepCoverage');if(!box)return;
 const e=exam(),sub=$('examPrepSubject')?.value||'';if(!e){box.innerHTML='';return}
 const subjects=sub?[sub]:Object.keys(e.subjects||{}),cov=getCoverage(),items=[];
 subjects.forEach(s=>(e.subjects[s]||[]).forEach(t=>items.push({subject:s,topic:t,key:coverageKey(e.id,s,t)})));
 let points=0;items.forEach(x=>{const v=cov[x.key]||{};points+=Number(!!v.study)+Number(!!v.revise)+Number(!!v.practice)});
 const pct=items.length?Math.round(points/(items.length*3)*100):0;
 box.innerHTML='<div class="exam-coverage-head"><div><strong>Coverage Tracker</strong><span>'+pct+'% complete · '+items.length+' topic'+(items.length===1?'':'s')+'</span></div><progress max="100" value="'+pct+'"></progress></div><div class="exam-coverage-list">'+items.map(x=>{const v=cov[x.key]||{};return '<div class="exam-coverage-row"><div><strong>'+esc(x.topic)+'</strong><small>'+esc(x.subject)+'</small></div><div class="exam-coverage-checks"><label><input type="checkbox" data-coverage="study" data-key="'+esc(x.key)+'" '+(v.study?'checked':'')+'>Study</label><label><input type="checkbox" data-coverage="revise" data-key="'+esc(x.key)+'" '+(v.revise?'checked':'')+'>Revise</label><label><input type="checkbox" data-coverage="practice" data-key="'+esc(x.key)+'" '+(v.practice?'checked':'')+'>Practice</label><button type="button" data-cover-practice data-subject="'+esc(x.subject)+'" data-topic="'+esc(x.topic)+'">Drill</button></div></div>'}).join('')+'</div>';
 box.querySelectorAll('[data-coverage]').forEach(ch=>ch.onchange=()=>{const all=getCoverage(),v=all[ch.dataset.key]||{study:false,revise:false,practice:false};v[ch.dataset.coverage]=ch.checked;all[ch.dataset.key]=v;setCoverage(all);renderCoverage()});
 box.querySelectorAll('[data-cover-practice]').forEach(b=>b.onclick=()=>{if($('examPrepSubject'))$('examPrepSubject').value=b.dataset.subject;refresh();if($('examPrepTopic'))$('examPrepTopic').value=b.dataset.topic;updateCount();start()});
}
function refresh(){
 const e=exam(),sub=$('examPrepSubject'),topic=$('examPrepTopic'),oldSub=sub?.value||'',oldTopic=topic?.value||'';
 if(!e){setOptions(sub,'All Subjects',[]);setOptions(topic,'All Topics',[]);$('examPrepBasis').textContent='Choose an exam to see its subject/topic preparation map.';updateCount();renderCoverage();return}
 setOptions(sub,'All Subjects',Object.keys(e.subjects),oldSub);
 const topics=sub?.value?e.subjects[sub.value]||[]:unique(Object.values(e.subjects).flat());
 setOptions(topic,'All Topics',topics,oldTopic);
 $('examPrepBasis').innerHTML='<strong>'+esc(e.name)+':</strong> '+esc(e.basisLabel)+'. <span class="muted">Built-in questions are EduNizam practice, not leaked or official exam questions.</span>';
 updateCount();renderCoverage();
}
function filtered(){
 const e=$('examPrepExam')?.value||'',sub=$('examPrepSubject')?.value||'',topic=$('examPrepTopic')?.value||'',diff=$('examPrepDifficulty')?.value||'',type=$('examPrepType')?.value||'';
 return D.questions.filter(q=>(!e||q.examId===e)&&(!sub||q.subject===sub)&&(!topic||q.topic===topic)&&(!diff||q.difficulty===diff)&&(!type||q.type===type));
}
function updateCount(){const n=filtered().length;if($('examPrepAvailable'))$('examPrepAvailable').textContent=n+' built-in practice item'+(n===1?'':'s')+' match the selected filters.'}
function start(){
 rows=filtered();const limit=$('examPrepCount')?.value||'10';if(limit!=='all')rows=rows.slice().sort(()=>Math.random()-.5).slice(0,Math.max(1,Number(limit)||10));
 if(!rows.length){$('examPrepQuestion').textContent='No practice items match these filters yet. Try a broader subject/topic.';$('examPrepOptions').innerHTML='';$('examPrepExplain').hidden=true;return}
 idx=0;attempts=new Map();finished=false;$('examPrepSession').hidden=false;render()
}
function stats(){let mcq=0,correct=0,written=0;attempts.forEach(a=>{if(a.type==='mcq'){mcq++;if(a.correct)correct++}else if(a.type==='written')written++});return{mcq,correct,written}}
function render(){
 const q=rows[idx];if(!q)return;const a=attempts.get(q.id),last=idx===rows.length-1;
 $('examPrepMeta').innerHTML='<span class="badge">'+esc(D.exams.find(x=>x.id===q.examId)?.name||q.examId)+'</span><span class="badge">'+esc(q.subject)+'</span><span class="badge">'+esc(q.topic)+'</span><span class="badge">'+esc(q.difficulty)+'</span><span class="badge">'+(idx+1)+'/'+rows.length+'</span>';
 $('examPrepQuestion').textContent=q.question;$('examPrepExplain').hidden=true;$('examPrepExplain').textContent='';
 let html='';
 if(q.type==='mcq')html=(q.options||[]).map((o,i)=>'<button class="option" data-exam-answer="'+i+'">'+esc(o)+'</button>').join('');
 else html='<button class="option" id="examPrepShowAnswer">Show suggested answer / framework</button>';
 html+='<div class="quick-actions" style="margin-top:12px"><button id="examPrepPrev" class="secondary" '+(idx===0?'disabled':'')+'>Previous</button><button id="examPrepNext">'+(last?'Finish Session':'Next')+'</button></div>';
 $('examPrepOptions').innerHTML=html;
 if(q.type==='mcq'){
   const btns=[...document.querySelectorAll('[data-exam-answer]')];
   const paint=choice=>{btns.forEach((b,i)=>{b.disabled=true;b.classList.add(i===q.answer?'correct':(i===choice?'wrong':''))});$('examPrepExplain').hidden=false;$('examPrepExplain').textContent=(choice===q.answer?'Correct. ':'Review: ')+q.explanation};
   if(a)paint(a.choice);else btns.forEach(b=>b.onclick=()=>{const choice=Number(b.dataset.examAnswer);attempts.set(q.id,{type:'mcq',choice,correct:choice===q.answer});paint(choice);updateProgress()});
 }else{
   const show=()=>{$('examPrepExplain').hidden=false;$('examPrepExplain').textContent=q.answerText;$('examPrepShowAnswer').disabled=true};
   if(a)show();else $('examPrepShowAnswer').onclick=()=>{attempts.set(q.id,{type:'written',reviewed:true});show();updateProgress()};
 }
 $('examPrepPrev').onclick=()=>{if(idx>0){idx--;render()}};
 $('examPrepNext').onclick=()=>last?finish():(idx++,render());
 updateProgress();
}
function updateProgress(){const s=stats();$('examPrepProgress').textContent='Attempted '+attempts.size+'/'+rows.length+' · MCQ '+s.correct+'/'+s.mcq+' · Written reviewed '+s.written}
function finish(){
 if(finished)return;finished=true;const s=stats(),missed=rows.filter(q=>{const a=attempts.get(q.id);return !a||(a.type==='mcq'&&!a.correct)}),weak={};
 missed.forEach(q=>{const k=q.subject+' · '+q.topic;weak[k]=(weak[k]||0)+1});
 const score=s.mcq?Math.round(s.correct/s.mcq*100):0,e=exam();
 const rec={at:new Date().toISOString(),examId:e?.id||'',exam:e?.name||'',score,mcq:s.mcq,correct:s.correct,written:s.written,count:rows.length,weak};
 setHistory([rec,...getHistory()]);
 const selectedSubject=$('examPrepSubject')?.value||'',selectedTopic=$('examPrepTopic')?.value||'';
 if(e?.id&&selectedSubject&&selectedTopic){const cov=getCoverage(),k=coverageKey(e.id,selectedSubject,selectedTopic),v=cov[k]||{study:false,revise:false,practice:false};v.practice=true;cov[k]=v;setCoverage(cov);renderCoverage()}
 $('examPrepMeta').innerHTML='<span class="badge">Session complete</span><span class="badge">'+esc(e?.name||'Exam')+'</span><span class="badge">'+score+'% MCQ</span>';
 $('examPrepQuestion').textContent='Topic-practice session completed.';
 $('examPrepOptions').innerHTML='<div class="quick-actions"><button id="examPrepAgain">Practice Again</button><button id="examPrepReview" class="secondary" '+(missed.length?'':'disabled')+'>Review Weak / Missed ('+missed.length+')</button></div>';
 $('examPrepExplain').hidden=false;$('examPrepExplain').textContent='MCQ: '+s.correct+'/'+s.mcq+' · Written reviewed: '+s.written+' · Weak/missed items: '+missed.length+'.';
 $('examPrepAgain').onclick=start;
 const b=$('examPrepReview');if(b&&!b.disabled)b.onclick=()=>{rows=missed;idx=0;attempts=new Map();finished=false;render()};
 renderHistory();
}
function renderHistory(){
 const box=$('examPrepHistory');if(!box)return;const h=getHistory();
 if(!h.length){box.innerHTML='<span class="muted">No exam-topic practice history on this device yet.</span>';return}
 const weak={};h.forEach(r=>Object.entries(r.weak||{}).forEach(([k,v])=>weak[k]=(weak[k]||0)+Number(v||0)));
 const top=Object.entries(weak).sort((a,b)=>b[1]-a[1]).slice(0,6);
 box.innerHTML='<strong>Recent topic practice</strong><div class="search-suggestions" style="margin-top:8px">'+h.slice(0,5).map(r=>'<span class="recent-chip">'+esc(r.exam)+' · '+r.score+'% · '+r.count+' items</span>').join('')+'</div>'+(top.length?'<p class="muted" style="margin:10px 0 5px">Weak-topic signals</p><div class="search-suggestions">'+top.map(([k,v])=>'<span class="recent-chip">'+esc(k)+' ('+v+')</span>').join('')+'</div>':'');
}
function init(){
 if(!$('examPrepExam'))return;
 if(!$('examPrepCoverageStyles')){
   const s=document.createElement('style');s.id='examPrepCoverageStyles';s.textContent='.exam-coverage-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:12px 0}.exam-coverage-head>div{display:grid;gap:3px}.exam-coverage-head span{font-size:.8rem;color:var(--muted)}.exam-coverage-head progress{width:min(260px,45vw);height:12px;accent-color:var(--green,#075347)}.exam-coverage-list{display:grid;gap:7px;max-height:420px;overflow:auto}.exam-coverage-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:8px 0;border-top:1px solid var(--line,#d7e2df)}.exam-coverage-row:first-child{border-top:0}.exam-coverage-row small{display:block;color:var(--muted);margin-top:2px}.exam-coverage-checks{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.exam-coverage-checks label,.exam-coverage-checks button{border:1px solid var(--line,#d7e2df);background:#fff;border-radius:999px;padding:5px 8px;font-size:.75rem}.exam-coverage-checks label{display:flex;gap:4px;align-items:center}.exam-coverage-checks button{cursor:pointer;font-weight:800;color:var(--green,#075347)}@media(max-width:680px){.exam-coverage-head{align-items:flex-start;flex-direction:column}.exam-coverage-head progress{width:100%}.exam-coverage-row{grid-template-columns:1fr}.exam-coverage-checks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.exam-coverage-checks label,.exam-coverage-checks button{justify-content:center;text-align:center;padding:7px 5px}}';document.head.appendChild(s)
 }
 $('examPrepExam').innerHTML='<option value="">Choose Exam</option>'+D.exams.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('');
 $('examPrepExam').addEventListener('change',refresh);$('examPrepSubject').addEventListener('change',refresh);$('examPrepTopic').addEventListener('change',updateCount);$('examPrepDifficulty').addEventListener('change',updateCount);$('examPrepType').addEventListener('change',updateCount);
 $('examPrepStart').onclick=start;
 document.querySelectorAll('[data-exam-prep-quick]').forEach(b=>b.onclick=()=>{$('examPrepExam').value=b.dataset.examPrepQuick;refresh();$('examPrepLab')?.scrollIntoView({behavior:'smooth',block:'start'})});
 refresh();renderHistory();
}
window.EDUNIZAM_EXAM_TOPIC_PRACTICE={render:init,start,history:getHistory};
init();
})();