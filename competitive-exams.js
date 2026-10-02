(function(){
  const $=id=>document.getElementById(id);
  const D=window.EDUNIZAM_COMPETITIVE_EXAMS;
  if(!D||!$('competitiveLibrary'))return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function init(){
    const agency=$('competitiveAgency'),cat=$('competitiveCategory');
    if(agency)agency.innerHTML='<option value="">All Agencies / Exams</option>'+D.agencies.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
    if(cat){const cats=[...new Set(D.resources.map(r=>r.category))].sort();cat.innerHTML='<option value="">All Categories</option>'+cats.map(x=>'<option>'+esc(x)+'</option>').join('')}
    ['competitiveAgency','competitiveCategory','competitiveRegion'].forEach(id=>$(id)?.addEventListener('change',render));
    $('competitiveSearch')?.addEventListener('input',render);
    $('competitiveSearchBtn')?.addEventListener('click',render);
    render();
  }
  function card(r){
    const a=D.agencies.find(x=>x.id===r.agencyId);
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official</span><span class="mini-badge">'+esc(r.category)+'</span></div></div><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(a?.name||'')+(a?.region?' · '+esc(a.region):'')+'</p><p class="coverage-note">'+esc(r.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open Official Source</a></div></article>';
  }
  function render(){
    const q=String($('competitiveSearch')?.value||'').trim().toLowerCase(),agency=$('competitiveAgency')?.value||'',cat=$('competitiveCategory')?.value||'',region=$('competitiveRegion')?.value||'';
    const rows=D.resources.filter(r=>{
      const a=D.agencies.find(x=>x.id===r.agencyId);
      const text=[r.title,r.category,r.note,a?.name,a?.region].join(' ').toLowerCase();
      return (!q||text.includes(q))&&(!agency||r.agencyId===agency)&&(!cat||r.category===cat)&&(!region||a?.region===region);
    });
    $('competitiveCountBadge').textContent=D.agencies.length+' Agencies';
    $('competitiveLibrary').innerHTML=rows.length?rows.map(card).join(''):'<div class="empty-state">No matching official resource. Clear a filter or search another exam/post.</div>';
  }
  window.renderCompetitiveExams=render;
  init();
})();