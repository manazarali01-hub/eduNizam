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
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">Exact Indexed Resource</span> <span class="mini-badge">'+esc(r.category)+'</span> '+badge+'</div></div><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(u?.name||'')+'</p><p class="coverage-note">'+esc(r.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open Resource</a></div></article>';
  }
  function universityFallbackCard(u,q){
    const base=U.resources.find(r=>r.universityId===u.id&&r.category==='Past Papers')||U.resources.find(r=>r.universityId===u.id);
    const url=base?.url||u.officialUrl;
    const badge=base?.source==='verified'?'<span class="trust-badge trust-verified">Verified Community</span>':'<span class="trust-badge trust-official">Official Source</span>';
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">Source Fallback</span> '+badge+'</div></div><h3>'+esc(u.name)+' Past Paper Source</h3><p class="muted">'+esc(q||'Past papers')+'</p><p class="coverage-note">Exact searched paper EduNizam index mein abhi stored nahi hai. Is university ka available past-paper/examination source diya ja raha hai taa-ke search dead-end na ho.</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(url)+'">Open Source</a></div></article>';
  }
  function renderUniversities(){
    const q=$('universitySearch').value.trim().toLowerCase(),uid=$('universityFilter').value,cat=$('universityCategory').value,src=$('universitySource').value;
    const arr=U.resources.filter(r=>r.universityId!=='vu'&&(!uid||r.universityId===uid)&&(!cat||r.category===cat)&&(!src||r.source===src)&&(!q||([r.title,r.category,r.note,U.universities.find(x=>x.id===r.universityId)?.name].join(' ').toLowerCase().includes(q))));
    $('universityCountBadge').textContent=U.universities.length+' Universities';
    if(arr.length){$('universityLibrary').innerHTML=arr.map(uniCard).join('');return}
    const candidates=U.universities.filter(u=>u.id!=='vu'&&(!uid||u.id===uid));
    $('universityLibrary').innerHTML=candidates.map(u=>universityFallbackCard(u,q)).join('');
  }
  function vuCard(r){
    const saved=vuSaved().includes(r.id);
    const badge=r.source==='official'?'<span class="trust-badge trust-official">Official VU</span>':'<span class="trust-badge trust-verified">Verified Community</span>';
    const searchedCode=$('vuSearch')?.value.trim().toUpperCase();
    const exactCode=Array.isArray(r.courseCodes)&&r.courseCodes.map(x=>String(x).toUpperCase()).includes(searchedCode);
    const fallbackCode=r.courseAgnostic&&/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(searchedCode);
    const context=exactCode?'<p class="muted"><strong>Exact course match:</strong> '+esc(searchedCode)+'</p>':(fallbackCode?'<p class="muted"><strong>Source fallback for:</strong> '+esc(searchedCode)+'</p>':'');
    return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+(exactCode?'Exact Course Result':(fallbackCode?'Source Fallback':esc(r.category)))+'</span> '+badge+'</div><button class="icon-btn" data-vu-save="'+r.id+'">'+(saved?'★':'☆')+'</button></div><h3>'+esc(r.title)+'</h3>'+context+'<p class="coverage-note">'+esc(r.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open Resource</a><button class="secondary-action" data-vu-ai="'+r.id+'">AI Use</button></div></article>';
  }
  function vuMaterialCards(course,filters={}){
    const rows=window.EDUNIZAM_VU_MATERIALS?.forCourse?.(course,filters)||[];
    if(!rows.length)return '';
    return '<div class="coverage-note"><strong>'+rows.length+' material routes available for '+esc(course.code)+'.</strong> Official files may require VU login; community downloads are supplementary.</div><div class="paper-grid">'+rows.map(m=>{
      const badge=m.trust==='official'?'trust-official':'trust-community';
      return '<article class="paper-card"><div class="paper-card-top"><div><span class="trust-badge '+badge+'">'+esc(m.accessLabel||m.source)+'</span><span class="mini-badge">'+esc(m.type)+'</span><span class="mini-badge">'+esc(m.source||'VU')+'</span></div></div><h3>'+esc(m.title)+'</h3><p class="coverage-note">'+esc(m.note||'')+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(m.url)+'">'+esc(m.actionLabel||'Open Resource')+'</a></div></article>';
    }).join('')+'</div>';
  }

  function vuCoursePack(code,filters={}){
    const raw=String(code||'').trim().toUpperCase();
    if(!raw)return '';
    const catalog=window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[];
    const matches=catalog.filter(x=>String(x.code+' '+x.title+' '+x.category).toUpperCase().includes(raw)).slice(0,10);
    const exact=catalog.find(x=>String(x.code).toUpperCase()===raw);
    const card=x=>{
      const p=window.EDUNIZAM_VU_PATHWAYS?.forCourse?.(x)||{};
      const links=[
        ['Course Info',x.officialDetails||p.details||p.search,'primary-link'],
        ['Overview',x.officialOverview||p.overview,'secondary-link'],
        ['Video Lectures',x.officialVideos||p.videos,'secondary-link'],
        ['Reference Books',x.officialReferences||p.references,'secondary-link'],
        ['Assignments',x.officialAssignments||p.assignments,'secondary-link'],
        ['Useful Links',x.officialLinks||p.links,'secondary-link']
      ].filter(y=>y[1]).map(y=>'<a class="'+y[2]+'" target="_blank" rel="noopener" href="'+esc(y[1])+'">'+y[0]+'</a>').join('');
      return '<article class="paper-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official VU Course</span> <span class="mini-badge">'+esc(x.category||'VU')+'</span></div></div><h3>'+esc(x.code)+' — '+esc(x.title)+'</h3><p class="coverage-note">'+esc(x.freshness||'Use official VU OCW and VULMS for current-semester material.')+'</p><div class="paper-actions">'+links+'</div></article>';
    };
    if(exact)return card(exact)+vuMaterialCards(exact,filters);
    if(matches.length&&raw.length>=2)return matches.map(card).join('')+'<div class="coverage-note">Multiple courses match this search. Enter an exact course code to open its full handouts, notes, videos, assignments and exam-material download pack.</div>';
    if(/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(raw)){
      const url='https://ocw.vu.edu.pk/Courses.aspx?q='+encodeURIComponent(raw);
      return '<article class="paper-card"><div class="paper-card-top"><div><span class="trust-badge trust-official">Official VU Lookup</span></div></div><h3>'+esc(raw)+'</h3><p class="coverage-note">This code is not matched to a local EduNizam course title yet. Verify it in official VU OpenCourseWare; no exact title or paper is invented.</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(url)+'">Search Official OCW</a></div></article>';
    }
    return '';
  }

  function refreshVUProviders(){
    const el=$('vuProvider');if(!el)return;
    const old=el.value,providers=['Virtual University',...(window.EDUNIZAM_VU_MATERIALS?.providers||[])];
    el.innerHTML='<option value="">All Providers</option>'+providers.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(providers.includes(old))el.value=old;
  }
  function renderVU(){
    document.querySelectorAll('[data-vu-tab]').forEach(b=>b.classList.toggle('active',b.dataset.vuTab===vuTab));
    const q=$('vuSearch').value.trim().toLowerCase(),src=$('vuSource').value,provider=$('vuProvider')?.value||'',access=$('vuAccess')?.value||'',level=$('vuCourseLevel').value;
    const courseQuery=/^[a-z]{2,5}\d{3,4}[a-z]?$/i.test(q);
    const arr=U.resources.filter(r=>{
      const text=[r.title,r.category,r.note,(r.courseCodes||[]).join(' ')].join(' ').toLowerCase();
      const courseMatch=!q||text.includes(q)||(courseQuery&&r.courseAgnostic&&r.category==='Past Papers');
      return r.universityId==='vu'&&(vuTab==='all'||r.category===vuTab)&&(!src||r.source===src)&&courseMatch&&(!level||!q||new RegExp('[A-Z]{2,4}'+level[0]).test(q.toUpperCase()));
    });
    let shown=arr;
    if(!shown.length){
      shown=U.resources.filter(r=>r.universityId==='vu'&&r.category==='Past Papers'&&r.courseAgnostic&&(!src||r.source===src));
    }
    if(!shown.length){
      shown=U.resources.filter(r=>r.universityId==='vu'&&r.source==='official'&&['Handouts','Quizzes','Assignments'].includes(r.category)).slice(0,5);
    }
    const coursePack=vuCoursePack(q,{source:src,provider,access});
    $('vuLibrary').innerHTML=coursePack+shown.map(vuCard).join('')+'<div class="coverage-note"><strong>Search guidance:</strong> Course card ke official OCW links ko primary source rakhein. Community past papers/recalls supplementary hain; current syllabus, quizzes, assignments aur announcements VULMS/official course pages se verify karein.</div>';
    refreshVUProviders();
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
  $('vuProvider')?.addEventListener('change',renderVU);
  $('vuAccess')?.addEventListener('change',renderVU);
  window.renderVUSpecial=renderVU;
  schoolInit();uniInit();
})();