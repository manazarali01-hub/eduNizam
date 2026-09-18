(function(){
  const $=id=>document.getElementById(id);
  if(!$('vuCoursesWorkspace'))return;

  const KEY={
    courses:'edunizam_vu_courses',
    plans:'edunizam_vu_exam_plans',
    recalls:'edunizam_vu_recalls',
    personal:'edunizam_vu_personal_resources'
  };
  const read=k=>JSON.parse(localStorage.getItem(k)||'[]');
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let workspace='resources';

  function setWorkspace(name){
    workspace=name;
    document.querySelectorAll('[data-vu-workspace-tab]').forEach(b=>b.classList.toggle('active',b.dataset.vuWorkspaceTab===name));
    const map={
      resources:'vuResourceWorkspace',
      courses:'vuCoursesWorkspace',
      planner:'vuPlannerWorkspace',
      recall:'vuRecallWorkspace',
      personal:'vuPersonalWorkspace'
    };
    Object.entries(map).forEach(([k,id])=>$(id).classList.toggle('hidden',k!==name));
    if(name==='courses')renderCourses();
    if(name==='planner')renderPlans();
    if(name==='recall')renderRecalls();
    if(name==='personal')renderPersonal();
  }

  function validCourseCode(code){return /^[A-Z]{2,5}\d{3}[A-Z]?$/.test(code)}
  function courses(){return read(KEY.courses)}
  function courseByCode(code){return courses().find(c=>c.code===code)}

  function saveCourse(){
    const code=$('vuMyCourseCode').value.trim().toUpperCase();
    const title=$('vuMyCourseTitle').value.trim();
    const semester=$('vuMyCourseSemester').value.trim();
    const status=$('vuMyCourseStatus').value;
    if(!validCourseCode(code))return alert('Enter a valid VU course code, e.g. MTH501 or CS201.');
    const arr=courses(),i=arr.findIndex(x=>x.code===code);
    const item={code,title:title||code,semester:semester||'Current',status,updatedAt:new Date().toISOString()};
    if(i>=0)arr[i]={...arr[i],...item}; else arr.push(item);
    write(KEY.courses,arr);
    ['vuMyCourseCode','vuMyCourseTitle','vuMyCourseSemester'].forEach(id=>$(id).value='');
    syncCourseSelects();renderCourses();
  }
  function removeCourse(code){
    write(KEY.courses,courses().filter(x=>x.code!==code));
    write(KEY.plans,read(KEY.plans).filter(x=>x.course!==code));
    syncCourseSelects();renderCourses();
  }
  function renderCourses(){
    const arr=courses();
    $('vuCourseList').innerHTML=arr.length?arr.map(c=>'<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(c.status)+'</span><span class="trust-badge trust-official">My Course</span></div></div><h3>'+esc(c.code)+' — '+esc(c.title)+'</h3><p class="muted">'+esc(c.semester)+'</p><div class="paper-actions"><button data-vu-course-study="'+esc(c.code)+'">AI Study Plan</button><button class="secondary-action" data-vu-course-quiz="'+esc(c.code)+'">AI Quiz</button><button class="secondary-action" data-vu-course-search="'+esc(c.code)+'">Find Resources</button><button class="secondary-action" data-vu-course-delete="'+esc(c.code)+'">Delete</button></div></article>').join(''):'<div class="empty-state">No VU courses saved yet.</div>';
    document.querySelectorAll('[data-vu-course-study]').forEach(b=>b.onclick=()=>courseAI(b.dataset.vuCourseStudy,'study'));
    document.querySelectorAll('[data-vu-course-quiz]').forEach(b=>b.onclick=()=>courseAI(b.dataset.vuCourseQuiz,'quiz'));
    document.querySelectorAll('[data-vu-course-search]').forEach(b=>b.onclick=()=>{setWorkspace('resources');$('vuSearch').value=b.dataset.vuCourseSearch;window.renderVUSpecial?.()});
    document.querySelectorAll('[data-vu-course-delete]').forEach(b=>b.onclick=()=>removeCourse(b.dataset.vuCourseDelete));
  }
  function courseAI(code,kind){
    const c=courseByCode(code);if(!c)return;
    if(window.setView)window.setView('assistant');
    $('aiPrompt').value=kind==='study'
      ?'Create a Virtual University study plan for '+c.code+' ('+c.title+'), semester '+c.semester+'. Use current official VU handouts/course outline as primary material. Separate official content from community past-paper patterns. Include lecture-wise revision, MCQs, short/long questions and exam strategy.'
      :'Create a 20-question Virtual University practice quiz for '+c.code+' ('+c.title+') based primarily on current official handouts/course outline. Include MCQs, answer key, explanations and difficulty labels.';
    $('aiOutput').textContent='VU '+(kind==='study'?'study-plan':'quiz')+' request prepared.';
  }

  function syncCourseSelects(){
    const opts='<option value="">Select course</option>'+courses().map(c=>'<option value="'+esc(c.code)+'">'+esc(c.code+' — '+c.title)+'</option>').join('');
    ['vuPlannerCourse','vuRecallCourse','vuPersonalCourse'].forEach(id=>$(id).innerHTML=opts);
  }

  function savePlan(){
    const course=$('vuPlannerCourse').value,term=$('vuPlannerTerm').value,from=Number($('vuPlannerFrom').value),to=Number($('vuPlannerTo').value),done=Number($('vuPlannerDone').value||0),examDate=$('vuPlannerExamDate').value;
    if(!course||!from||!to||to<from)return alert('Select course and enter a valid lecture range.');
    const total=to-from+1,completed=Math.max(0,Math.min(done,total));
    const arr=read(KEY.plans),key=course+'|'+term,i=arr.findIndex(x=>x.key===key);
    const item={key,course,term,from,to,done:completed,total,examDate,updatedAt:new Date().toISOString()};
    if(i>=0)arr[i]=item;else arr.push(item);
    write(KEY.plans,arr);renderPlans();
  }
  function renderPlans(){
    syncCourseSelects();
    const arr=read(KEY.plans);
    $('vuPlannerList').innerHTML=arr.length?arr.map(p=>{
      const pct=Math.round((p.done/p.total)*100);
      return '<article class="paper-card"><h3>'+esc(p.course)+' — '+esc(p.term)+'</h3><p class="muted">Lectures '+p.from+'–'+p.to+(p.examDate?' · Exam '+esc(p.examDate):'')+'</p><div class="vu-progress"><div style="width:'+pct+'%"></div></div><p><strong>'+pct+'%</strong> · '+p.done+'/'+p.total+' lectures completed</p><div class="paper-actions"><button data-vu-plan-ai="'+esc(p.key)+'">AI Revision Plan</button><button class="secondary-action" data-vu-plan-inc="'+esc(p.key)+'">+1 Lecture</button></div></article>';
    }).join(''):'<div class="empty-state">No exam plans saved yet.</div>';
    document.querySelectorAll('[data-vu-plan-inc]').forEach(b=>b.onclick=()=>incrementPlan(b.dataset.vuPlanInc));
    document.querySelectorAll('[data-vu-plan-ai]').forEach(b=>b.onclick=()=>planAI(b.dataset.vuPlanAi));
  }
  function incrementPlan(key){
    const arr=read(KEY.plans),p=arr.find(x=>x.key===key);if(!p)return;p.done=Math.min(p.total,p.done+1);write(KEY.plans,arr);renderPlans();
  }
  function planAI(key){
    const p=read(KEY.plans).find(x=>x.key===key);if(!p)return;if(window.setView)window.setView('assistant');
    $('aiPrompt').value='Create a focused '+p.term+' revision plan for Virtual University course '+p.course+', lectures '+p.from+' to '+p.to+'. I have completed '+p.done+' of '+p.total+' lectures'+(p.examDate?' and the exam date is '+p.examDate:'')+'. Prioritize official VU handouts, important concepts, MCQ revision, past-paper patterns only as secondary evidence, and a final revision checklist.';
    $('aiOutput').textContent='VU exam revision-plan request prepared.';
  }

  function saveRecall(){
    const course=$('vuRecallCourse').value,term=$('vuRecallTerm').value,semester=$('vuRecallSemester').value.trim(),type=$('vuRecallType').value,question=$('vuRecallQuestion').value.trim();
    if(!course||!question)return alert('Select course and enter the recalled question.');
    const arr=read(KEY.recalls);arr.push({id:Date.now(),course,term,semester:semester||'Unknown',type,question,source:'community-recall',createdAt:new Date().toISOString()});write(KEY.recalls,arr);
    $('vuRecallQuestion').value='';renderRecalls();
  }
  function renderRecalls(){
    syncCourseSelects();
    const arr=read(KEY.recalls).slice().reverse();
    $('vuRecallList').innerHTML=arr.length?arr.map(r=>'<div class="practice-review"><div class="paper-card-top"><div><span class="trust-badge trust-verified">Recall / Unofficial</span> <span class="mini-badge">'+esc(r.type)+'</span></div><button class="icon-btn" data-vu-recall-delete="'+r.id+'">×</button></div><strong>'+esc(r.course)+' · '+esc(r.term)+' · '+esc(r.semester)+'</strong><div>'+esc(r.question)+'</div></div>').join(''):'<div class="empty-state">No recalled questions saved yet.</div>';
    document.querySelectorAll('[data-vu-recall-delete]').forEach(b=>b.onclick=()=>{write(KEY.recalls,read(KEY.recalls).filter(x=>String(x.id)!==String(b.dataset.vuRecallDelete)));renderRecalls()});
  }

  function savePersonal(){
    const course=$('vuPersonalCourse').value,category=$('vuPersonalCategory').value,title=$('vuPersonalTitle').value.trim(),url=$('vuPersonalUrl').value.trim();
    if(!course||!title||!/^https?:\/\//i.test(url))return alert('Select course and enter a valid title and URL.');
    const arr=read(KEY.personal);arr.push({id:Date.now(),course,category,title,url,source:'personal',createdAt:new Date().toISOString()});write(KEY.personal,arr);
    $('vuPersonalTitle').value='';$('vuPersonalUrl').value='';renderPersonal();
  }
  function renderPersonal(){
    syncCourseSelects();
    const arr=read(KEY.personal).slice().reverse();
    $('vuPersonalList').innerHTML=arr.length?arr.map(r=>'<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(r.category)+'</span><span class="trust-badge trust-verified">Personal / Authorized</span></div><button class="icon-btn" data-vu-personal-delete="'+r.id+'">×</button></div><h3>'+esc(r.title)+'</h3><p class="muted">'+esc(r.course)+'</p><div class="paper-actions"><a class="primary-link" target="_blank" rel="noopener" href="'+esc(r.url)+'">Open Resource</a></div></article>').join(''):'<div class="empty-state">No personal resources saved yet.</div>';
    document.querySelectorAll('[data-vu-personal-delete]').forEach(b=>b.onclick=()=>{write(KEY.personal,read(KEY.personal).filter(x=>String(x.id)!==String(b.dataset.vuPersonalDelete)));renderPersonal()});
  }

  document.querySelectorAll('[data-vu-workspace-tab]').forEach(b=>b.onclick=()=>setWorkspace(b.dataset.vuWorkspaceTab));
  $('vuSaveCourseBtn').onclick=saveCourse;
  $('vuSavePlannerBtn').onclick=savePlan;
  $('vuSaveRecallBtn').onclick=saveRecall;
  $('vuSavePersonalBtn').onclick=savePersonal;

  syncCourseSelects();
  renderCourses();
  renderPlans();
  renderRecalls();
  renderPersonal();

  window.renderVUWorkspace=()=>setWorkspace(workspace);
})();