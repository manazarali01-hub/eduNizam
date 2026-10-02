(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_PREP;if(!D)return;
const KEY='edunizam_exam_prep_history_v1',esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const getHistory=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}},setHistory=v=>{try{localStorage.setItem(KEY,JSON.stringify(v.slice(0,50)))}catch(_){}};
let rows=[],idx=0,attempts=new Map(),finished=false;
function exam(){return D.exams.find(x=>x.id===$('examPrepExam')?.value)}
function unique(a){return [...new Set(a.filter(Boolean))]}
function setOptions(el,label,values,current=''){if(!el)return;el.innerHTML='<option value="">'+esc(label)+'</option>'+values.map(x=>'<option>'+esc(x)+'</option>').join('');if([...el.options].some(o=>o.value===current))el.value=current}
function refresh(){
 const e=exam(),sub=$('examPrepSubject'),topic=$('examPrepTopic'),oldSub=sub?.value||'',oldTopic=topic?.value||'';
 if(!e){setOptions(sub,'All Subjects',[]);setOptions(topic,'All Topics',[]);$('examPrepBasis').textContent='Choose an exam to see its subject/topic preparation map.';updateCount();return}
 setOptions(sub,'All Subjects',Object.keys(e.subjects),oldSub);
 const topics=sub?.value?e.subjects[sub.value]||[]:unique(Object.values(e.subjects).flat());
 setOptions(topic,'All Topics',topics,oldTopic);
 $('examPrepBasis').innerHTML='<strong>'+esc(e.name)+':</strong> '+esc(e.basisLabel)+'. <span class="muted">Built-in questions are EduNizam practice, not leaked or official exam questions.</span>';
 updateCount();
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
 $('examPrepExam').innerHTML='<option value="">Choose Exam</option>'+D.exams.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('');
 $('examPrepExam').addEventListener('change',refresh);$('examPrepSubject').addEventListener('change',refresh);$('examPrepTopic').addEventListener('change',updateCount);$('examPrepDifficulty').addEventListener('change',updateCount);$('examPrepType').addEventListener('change',updateCount);
 $('examPrepStart').onclick=start;
 document.querySelectorAll('[data-exam-prep-quick]').forEach(b=>b.onclick=()=>{$('examPrepExam').value=b.dataset.examPrepQuick;refresh();$('examPrepLab')?.scrollIntoView({behavior:'smooth',block:'start'})});
 refresh();renderHistory();
}
window.EDUNIZAM_EXAM_TOPIC_PRACTICE={render:init,start,history:getHistory};
init();
})();