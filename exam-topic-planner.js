(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_TOPIC_BLUEPRINTS;
if(!D)return;
const KEY='edunizam_exam_topic_plan_v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('en-PK').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function state(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}}
function save(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch(_){}}
function key(pathway,subject,topic){return [pathway,subject,topic].join('||')}
function statusFor(k){return state()[k]||{read:false,revise:false,practice:false}}
function pct(bp){
 const items=bp.blocks.flatMap(b=>b.topics.map(t=>key(bp.pathwayId,b.subject,t))),s=state();
 if(!items.length)return 0;
 let points=0;items.forEach(k=>{const v=s[k]||{};points+=Number(!!v.read)+Number(!!v.revise)+Number(!!v.practice)});
 return Math.round(points/(items.length*3)*100);
}
function ensurePanel(){
 let box=$('examTopicPlanner');if(box)return box;
 const grid=$('examPathGrid');if(!grid)return null;
 box=document.createElement('section');box.id='examTopicPlanner';box.className='card exam-topic-planner';box.hidden=true;
 grid.after(box);return box;
}
function injectStyles(){
 if($('examTopicPlannerStyles'))return;
 const s=document.createElement('style');s.id='examTopicPlannerStyles';s.textContent=`
 .exam-topic-planner{margin-top:16px;display:grid;gap:14px;scroll-margin-top:90px}.exam-topic-planner[hidden]{display:none}.topic-plan-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.topic-progress{display:flex;align-items:center;gap:9px;min-width:210px}.topic-progress progress{width:150px;height:12px;accent-color:var(--green,#075347)}
 .topic-toolbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.4fr) auto;gap:8px}.topic-block{border:1px solid var(--line,#d7e2df);border-radius:16px;padding:12px;background:#fff}.topic-block h3{margin:0}.topic-block-meta{display:flex;gap:7px;flex-wrap:wrap;margin:5px 0 10px}.topic-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line,#e5ecea)}.topic-row:first-of-type{border-top:0}.topic-name{font-weight:760;line-height:1.45}.topic-checks{display:flex;gap:7px;flex-wrap:wrap}.topic-checks label{display:flex;gap:4px;align-items:center;border:1px solid var(--line,#d7e2df);border-radius:999px;padding:5px 8px;font-size:.76rem;cursor:pointer}.topic-practice{border:1px solid var(--line,#d7e2df);background:#fff;border-radius:9px;padding:6px 8px;font-weight:800;cursor:pointer}
 @media(max-width:700px){.topic-toolbar{grid-template-columns:1fr}.topic-row{grid-template-columns:1fr}.topic-checks{display:grid;grid-template-columns:repeat(3,1fr)}.topic-checks label{justify-content:center}.topic-progress{width:100%}.topic-progress progress{flex:1}}
 `;document.head.appendChild(s)
}
function practiceAction(pathway,subject,topic){
 const prep=window.EDUNIZAM_EXAM_PREP||{questions:[]};
 const hasBuiltIn=(prep.questions||[]).some(q=>q.examId===pathway&&q.subject===subject&&q.topic===topic);
 if(hasBuiltIn&&window.EDUNIZAM_EXAM_PATHWAY_ENGINE?.startDrill){
   window.EDUNIZAM_EXAM_PATHWAY_ENGINE.startDrill(pathway,subject,topic);return;
 }
 const query=[pathway.toUpperCase(),subject,topic,'practice'].join(' ');
 if(location.pathname.endsWith('/learn.html')||location.pathname.endsWith('learn.html')){
   const g=$('globalSearch');if(g)g.value=query;
   history.replaceState(null,'','#practice');document.querySelector('[data-tab="practice"]')?.click();
   window.dispatchEvent(new CustomEvent('edunizam:topic-practice',{detail:{pathway,subject,topic,query}}));
   setTimeout(()=>$('practice')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
   return;
 }
 if(window.setView){
   window.setView('practice').then?.(()=>{});
   setTimeout(()=>{
     const ai=$('aiGenerateTestBtn');
     const cls=subject.match(/Biology|Chemistry|Physics|Mathematics|Computer Science/)?'12':'';
     if(cls&&$('practiceClass')){$('practiceClass').value=cls;$('practiceClass').dispatchEvent(new Event('change',{bubbles:true}))}
     setTimeout(()=>{
       if($('practiceSubject')){
         const wanted=subject.replace(/^NET-[^—]+ — /,'').replace(/^USAT-E Discipline Subjects$/,'').trim();
         const opt=[...$('practiceSubject').options].find(o=>o.textContent===wanted);
         if(opt){$('practiceSubject').value=opt.value;$('practiceSubject').dispatchEvent(new Event('change',{bubbles:true}))}
       }
       if(ai){
         const prompt=$('aiPrompt');
         if(prompt)prompt.value='Generate a concept-practice test for '+pathway.toUpperCase()+' topic: '+topic+' ('+subject+'). Use the current official exam scope as context, explain every answer, and do not claim questions are official unless sourced.';
       }
     },150);
   },200);
 }
}
function render(pathwayId){
 injectStyles();
 const bp=D.blueprints[pathwayId],box=ensurePanel();if(!bp||!box)return;
 box.hidden=false;box.dataset.pathway=pathwayId;
 const allSubjects=bp.blocks.map(x=>x.subject);
 box.innerHTML='<div class="topic-plan-head"><div><div class="eyebrow">Topic-level preparation</div><h2>'+esc(bp.title)+'</h2><p class="muted">'+esc(bp.sourceNote)+'</p><a class="primary-link" target="_blank" rel="noopener" href="'+esc(bp.sourceUrl)+'">Open controlling official source</a></div><div class="topic-progress"><strong id="topicProgressText">'+pct(bp)+'%</strong><progress id="topicProgressBar" max="100" value="'+pct(bp)+'"></progress></div></div>'+
   '<div class="topic-toolbar"><input id="topicPlanSearch" type="search" placeholder="Find a topic…"><select id="topicPlanSubject"><option value="">All subjects / blocks</option>'+allSubjects.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select><button id="topicPlanReset" class="secondary" type="button">Reset Progress</button></div><div id="topicPlanBody"></div>';
 const rerender=()=>{
   const q=norm($('topicPlanSearch')?.value||''),sub=$('topicPlanSubject')?.value||'',s=state();
   const html=bp.blocks.filter(b=>!sub||b.subject===sub).map(b=>{
     const rows=b.topics.filter(t=>!q||norm(b.subject+' '+t).includes(q)).map(t=>{
       const k=key(pathwayId,b.subject,t),v=s[k]||{};
       return '<div class="topic-row"><div class="topic-name">'+esc(t)+'</div><div class="topic-checks">'+
       '<label><input type="checkbox" data-topic-check="read" data-topic-key="'+esc(k)+'" '+(v.read?'checked':'')+'> Read</label>'+
       '<label><input type="checkbox" data-topic-check="revise" data-topic-key="'+esc(k)+'" '+(v.revise?'checked':'')+'> Revise</label>'+
       '<label><input type="checkbox" data-topic-check="practice" data-topic-key="'+esc(k)+'" '+(v.practice?'checked':'')+'> Practice</label>'+
       '<button type="button" class="topic-practice" data-topic-practice data-pathway="'+esc(pathwayId)+'" data-subject="'+esc(b.subject)+'" data-topic="'+esc(t)+'">Find Practice</button></div></div>';
     }).join('');
     return rows?'<section class="topic-block"><h3>'+esc(b.subject)+'</h3><div class="topic-block-meta"><span class="mini-badge">'+esc(b.weight||'')+'</span><span class="mini-badge">'+esc(b.scope||'')+'</span></div>'+rows+'</section>':'';
   }).join('');
   $('topicPlanBody').innerHTML=html||'<div class="empty-state">No topic matched this filter.</div>';
   $('topicProgressText').textContent=pct(bp)+'%';$('topicProgressBar').value=pct(bp);
   $('topicPlanBody').querySelectorAll('[data-topic-check]').forEach(ch=>ch.onchange=()=>{
     const s=state(),k=ch.dataset.topicKey,v=s[k]||{read:false,revise:false,practice:false};v[ch.dataset.topicCheck]=ch.checked;s[k]=v;save(s);$('topicProgressText').textContent=pct(bp)+'%';$('topicProgressBar').value=pct(bp);
   });
   $('topicPlanBody').querySelectorAll('[data-topic-practice]').forEach(b=>b.onclick=()=>practiceAction(b.dataset.pathway,b.dataset.subject,b.dataset.topic));
 };
 $('topicPlanSearch').oninput=rerender;$('topicPlanSubject').onchange=rerender;
 $('topicPlanReset').onclick=()=>{const s=state();Object.keys(s).filter(k=>k.startsWith(pathwayId+'||')).forEach(k=>delete s[k]);save(s);rerender()};
 rerender();setTimeout(()=>box.scrollIntoView({behavior:'smooth',block:'start'}),0);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-topic-pathway]');if(b){e.preventDefault();render(b.dataset.topicPathway)}});
window.EDUNIZAM_EXAM_TOPIC_PLANNER={render,progress:pathwayId=>D.blueprints[pathwayId]?pct(D.blueprints[pathwayId]):0};
})();