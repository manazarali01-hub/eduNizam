(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const D=window.EDUNIZAM_EDUCATION_ECOSYSTEM;
  if(!D||!$('ecosystemLibrary'))return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('en-PK').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function options(){
    const cat=$('ecosystemCategory'),stage=$('ecosystemStage'),region=$('ecosystemRegion'),aud=$('ecosystemAudience');
    if(cat)cat.innerHTML='<option value="">All Areas</option>'+D.categories.map(x=>'<option>'+esc(x)+'</option>').join('');
    const stages=[...new Set(D.resources.map(x=>x.stage).filter(Boolean))].sort();
    const regions=[...new Set(D.resources.map(x=>x.region).filter(Boolean))].sort();
    const audiences=[...new Set(D.resources.flatMap(x=>String(x.audience||'').split('/').map(v=>v.trim())).filter(Boolean))].sort();
    if(stage)stage.innerHTML='<option value="">All Stages</option>'+stages.map(x=>'<option>'+esc(x)+'</option>').join('');
    if(region)region.innerHTML='<option value="">All Regions</option>'+regions.map(x=>'<option>'+esc(x)+'</option>').join('');
    if(aud)aud.innerHTML='<option value="">All Audiences</option>'+audiences.map(x=>'<option>'+esc(x)+'</option>').join('');
  }
  function card(r){
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official</span><span class="mini-badge">'+esc(r.category)+'</span></div></div><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(r.stage)+' · '+esc(r.region)+' · '+esc(r.audience)+'</p><p class="coverage-note">'+esc(r.note||'')+'</p><div class="paper-actions"><a class="primary-link" href="'+esc(r.url)+'" target="_blank" rel="noopener">Open Official Source</a></div></article>';
  }
  function render(){
    const q=norm($('ecosystemSearch')?.value||''),cat=$('ecosystemCategory')?.value||'',stage=$('ecosystemStage')?.value||'',region=$('ecosystemRegion')?.value||'',aud=$('ecosystemAudience')?.value||'';
    const rows=D.resources.filter(r=>{
      const hay=norm([r.title,r.category,r.stage,r.region,r.audience,r.note,r.keywords].join(' '));
      return (!q||hay.includes(q))&&(!cat||r.category===cat)&&(!stage||r.stage===stage)&&(!region||r.region===region)&&(!aud||String(r.audience||'').includes(aud));
    });
    $('ecosystemCountBadge').textContent=D.resources.length+' Official Routes';
    $('ecosystemLibrary').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty-state">No matching route. Try a broader term such as scholarship, MDCAT, ECAT, IBCC, textbook, NAVTTC or research.</div>';
  }
  options();
  ['ecosystemCategory','ecosystemStage','ecosystemRegion','ecosystemAudience'].forEach(id=>$(id)?.addEventListener('change',render));
  $('ecosystemSearch')?.addEventListener('input',render);
  $('ecosystemSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();render()}});
  $('ecosystemSearchBtn')?.addEventListener('click',render);
  document.querySelectorAll('[data-ecosystem-quick]').forEach(b=>b.onclick=()=>{if($('ecosystemCategory'))$('ecosystemCategory').value=b.dataset.ecosystemQuick;render()});
  window.renderEducationEcosystem=render;
  render();
})();