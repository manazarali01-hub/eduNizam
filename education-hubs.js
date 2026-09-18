(function(){
  const S=window.EDUNIZAM_SCHOOL_ASSESSMENTS;
  const U=window.EDUNIZAM_UNIVERSITY_DATA;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function schoolInit(){
    if(!S||!$('schoolAssessLibrary'))return;
    const subs=[...new Set(S.resources.flatMap(x=>String(x.subject).split(' / ')))].sort();
    const yrs=[...new Set(S.resources.map(x=>x.year))].sort((a,b)=>b-a);
    $('schoolAssessSubject').innerHTML='<option value="">All Subjects</option>'+subs.map(x=>'<option>'+esc(x)+'</option>').join('');
    $('schoolAssessYear').innerHTML='<option value="">All Years</option>'+yrs.map(y=>'<option>'+y+'</option>').join('');
    ['schoolAssessGrade','schoolAssessSubject','schoolAssessYear','schoolAssessSource'].forEach(id=>$(id).addEventListener('change',renderSchool));
    renderSchool();
  }
  function renderSchool(){
    const grade=$('schoolAssessGrade').value,sub=$('schoolAssessSubject').value,year=$('schoolAssessYear').value,src=$('schoolAssessSource').value;
    const arr=S.resources.filter(x=>(!grade||String(x.grade)===grade)&&(!sub||String(x.subject).includes(sub))&&(!year||String(x.year)===year)&&(!src||x.source===src));
    $('schoolAssessCount').textContent=S.resources.length+' Resources';
    $('schoolAssessLibrary').innerHTML=arr.length?arr.map(x=>{
      const badge=x.source==='official'?'<span class="trust-badge trust-official">Official PECTAA</span>':'<span class="trust-badge trust-verified">Historical / Verified</span>';
      const pdf=x.fileUrl?'<a class="secondary-link" target="_blank" rel="noopener" href="'+esc(x.fileUrl)+'">Download / Print PDF</a>':'';
      return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">Grade '+x.grade+'</span> '+badge+'</div></div><h3>'+esc(x.title)+'</h3><p class="muted">'+esc(x.subject)+' · '+x.year+' · '+esc(x.type)+'</p><p class="coverage-note">'+esc(x.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(x.url)+'">Open Resource</a>'+pdf+'</div></article>';
    }).join(''):'<div class="empty-state">No matching Grade 5/8 resource.</div>';
  }

  const vuSaved=()=>JSON.parse(localStorage.getItem('edunizam_vu_saved')||'[]');
  const putVu=v=>localStorage.setItem('edunizam_vu_saved',JSON.stringify(v));
  let vuTab='all';

  function uniInit(){
    if(!U)return;
    if($('universityFilter')){
      $('universityFilter').innerHTML='<option value="">All Universities</option>'+U.universities.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
      ['universityFilter','universityCategory','universitySource'].forEach(id=>$(id).addEventListener('change',renderUniversities));
      $('universitySearch').addEventListener('input',renderUniversities);
      renderUniversities();
    }
    if($('vuLibrary')){
      ['vuSource','vuCourseLevel'].forEach(id=>$(id).addEventListener('change',renderVU));
      $('vuSearch').addEventListener('input',renderVU);
      document.querySelectorAll('[data-vu-tab]').forEach(b=>b.onclick=()=>{vuTab=b.dataset.vuTab;renderVU()});
      $('vuCourseSearchBtn').onclick=()=>{const c=$('vuCourseCode').value.trim().toUpperCase();$('vuSearch').value=c;renderVU()};
      $('vuAiStudyBtn').onclick=()=>vuAi('study');
      $('vuAiQuizBtn').onclick=()=>vuAi('quiz');
      renderVU();
    }
  }
  function uniCard(r){
    const u=U.universities.find(x=>x.id===r.universityId);
    const badge=r.source==='official'?'<span class="trust-badge trust-official">Official</span>':'<span class="trust-badge trust-verified">Verified Community</span>';
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(r.category)+'</span> '+badge+'</div></div><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(u?.name||'')+'</p><p class="coverage-note">'+esc(r.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open Resource</a></div></article>';
  }
  function renderUniversities(){
    const q=$('universitySearch').value.trim().toLowerCase(),uid=$('universityFilter').value,cat=$('universityCategory').value,src=$('universitySource').value;
    const arr=U.resources.filter(r=>r.universityId!=='vu'&&(!uid||r.universityId===uid)&&(!cat||r.category===cat)&&(!src||r.source===src)&&(!q||([r.title,r.category,r.note,U.universities.find(x=>x.id===r.universityId)?.name].join(' ').toLowerCase().includes(q))));
    $('universityCountBadge').textContent=U.universities.length+' Universities';
    $('universityLibrary').innerHTML=arr.length?arr.map(uniCard).join(''):'<div class="empty-state">No matching university resource.</div>';
  }
  function vuCard(r){
    const saved=vuSaved().includes(r.id);
    const badge=r.source==='official'?'<span class="trust-badge trust-official">Official VU</span>':'<span class="trust-badge trust-verified">Verified Community</span>';
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(r.category)+'</span> '+badge+'</div><button class="icon-btn" data-vu-save="'+r.id+'">'+(saved?'★':'☆')+'</button></div><h3>'+esc(r.title)+'</h3><p class="coverage-note">'+esc(r.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open Resource</a><button class="secondary-action" data-vu-ai="'+r.id+'">AI Use</button></div></article>';
  }
  function renderVU(){
    document.querySelectorAll('[data-vu-tab]').forEach(b=>b.classList.toggle('active',b.dataset.vuTab===vuTab));
    const q=$('vuSearch').value.trim().toLowerCase(),src=$('vuSource').value,level=$('vuCourseLevel').value;
    const arr=U.resources.filter(r=>r.universityId==='vu'&&(vuTab==='all'||r.category===vuTab)&&(!src||r.source===src)&&(!q||[r.title,r.category,r.note].join(' ').toLowerCase().includes(q))&&(!level||!q||new RegExp('[A-Z]{2,4}'+level[0]).test(q.toUpperCase())));
    $('vuLibrary').innerHTML=arr.length?arr.map(vuCard).join(''):'<div class="empty-state">No matching VU resource. Try a category or course code.</div>';
    const vu=U.resources.filter(r=>r.universityId==='vu');
    $('vuStatResources').textContent=vu.length;$('vuStatOfficial').textContent=vu.filter(x=>x.source==='official').length;$('vuStatVerified').textContent=vu.filter(x=>x.source==='verified').length;$('vuStatSaved').textContent=vuSaved().length;
    document.querySelectorAll('[data-vu-save]').forEach(b=>b.onclick=()=>{let x=vuSaved();x=x.includes(b.dataset.vuSave)?x.filter(v=>v!==b.dataset.vuSave):[b.dataset.vuSave,...x];putVu(x);renderVU()});
    document.querySelectorAll('[data-vu-ai]').forEach(b=>b.onclick=()=>vuResourceAi(b.dataset.vuAi));
  }
  function vuResourceAi(id){
    const r=U.resources.find(x=>x.id===id);if(!r)return;if(window.setView)window.setView('assistant');
    $('aiPrompt').value='Use this Virtual University resource for exam preparation. Create a concise study plan, important topics, likely MCQ concepts, short questions and revision checklist. Resource: '+r.title+'\nSource: '+r.url+'\nNote: '+r.note;
    $('aiOutput').textContent='VU resource added to AI Assistant.';
  }
  function vuAi(kind){
    const code=$('vuCourseCode').value.trim().toUpperCase();if(!code)return alert('Enter a VU course code first.');
    if(window.setView)window.setView('assistant');
    $('aiPrompt').value=kind==='study'
      ?'Create a Virtual University exam study plan for '+code+'. Use current official VU handouts/course outline as the primary source. Include lecture ranges, important concepts, MCQ focus, short/long questions, revision schedule and midterm/final strategy. Clearly separate any community past-paper patterns from official course content.'
      :'Create a 20-question practice quiz for Virtual University course '+code+' based on current official handouts/course outline. Include MCQs, answer key, explanations and difficulty levels. Do not rely only on recalled past papers.';
    $('aiOutput').textContent=kind==='study'?'VU study-plan request prepared.':'VU quiz-generation request prepared.';
  }

  window.renderSchoolAssessments=renderSchool;
  window.renderUniversityHub=renderUniversities;
  window.renderVUSpecial=renderVU;
  schoolInit();uniInit();
})();