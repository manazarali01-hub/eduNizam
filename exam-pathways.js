(function(){
'use strict';
const $=id=>document.getElementById(id),D=window.EDUNIZAM_EXAM_PATHWAYS;
if(!D||!$('examPathGrid'))return;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('en-PK').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
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
function init(){
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
 $('examPathGrid')?.addEventListener('click',e=>{const b=e.target.closest('[data-internal-path]');if(b){e.preventDefault();openInternal(b.dataset.internalPath)}});
 render();
}
function subjectList(x){return '<div class="path-subjects">'+x.subjects.map(s=>'<div><strong>'+esc(s.name)+'</strong><span>'+esc(s.focus)+'</span></div>').join('')+'</div>'}
function steps(x){return '<ol class="path-steps">'+x.steps.map(s=>'<li><strong>'+esc(s.title)+'</strong><p>'+esc(s.detail)+'</p>'+(s.url?'<a target="_blank" rel="noopener" href="'+esc(s.url)+'">Open official source</a>':s.internal?'<button type="button" data-internal-path="'+esc(s.internal)+'">Open EduNizam '+esc(s.internal==='practice'?'Practice':s.internal.toUpperCase())+'</button>':'')+'</li>').join('')+'</ol>'}
function card(x){
 return '<article class="paper-card exam-path-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official-source pathway</span><span class="mini-badge">'+esc(x.stage)+'</span></div></div><h3>'+esc(x.name)+'</h3><p class="muted">'+esc(x.authority)+' · '+esc(x.region)+'</p><p>'+esc(x.overview)+'</p><details><summary>Exam / study pattern</summary><ul>'+x.pattern.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></details><details><summary>Subjects / preparation map</summary>'+subjectList(x)+'</details><details open><summary>Step-by-step pathway</summary>'+steps(x)+'</details><div class="paper-actions">'+x.official.map(o=>'<a target="_blank" rel="noopener" href="'+esc(o.url)+'">'+esc(o.label)+'</a>').join('')+'</div></article>'
}
function render(){
 const q=norm($('examPathSearch')?.value||''),id=$('examPathwayFilter')?.value||'',stage=$('examPathStage')?.value||'',auth=$('examPathAuthority')?.value||'';
 const rows=D.pathways.filter(x=>{
   const hay=norm(JSON.stringify(x));
   return (!q||hay.includes(q))&&(!id||x.id===id)&&(!stage||x.stage===stage)&&(!auth||x.authority===auth);
 });
 if($('examPathCountBadge'))$('examPathCountBadge').textContent=D.pathways.length+' Guided Pathways';
 $('examPathGrid').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty-state">No pathway matched. Try MDCAT, ECAT, NET, USAT, LAT, CSS, FPSC, PPSC, VU or AIOU.</div>';
}
window.renderExamPathways=render;
init();
})();