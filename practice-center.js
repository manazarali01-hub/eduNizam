(function(){
  const D=window.EDUNIZAM_PRACTICE_DATA;if(!D)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let current=[],timer=null,secondsLeft=0,lastConfig=null,cursor=0,answers=[],poolNotice='',sourceSessionScope='';
  // Uploaded-source questions exist in this tab only, never in the shared
  // EduNizam practice bank or other users' schools.
  let uploadRows=[],uploadScope='',uploadBatch=0;
  const scope=()=>String(window.EDUNIZAM_CLOUD_CONFIG?.institutionId||'guest')+'|'+String(window.EDUNIZAM_CLOUD?.state?.user?.id||'local');
  const reviewedSourceQuestions=()=>{if(uploadScope&&uploadScope!==scope()){uploadScope='';uploadRows=[];}return uploadScope&&uploadScope===scope()?uploadRows:[]};
  function addReviewedSource(rows){
    if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Select 1–100 reviewed questions.');
    const src=window.EDUNIZAM_QUESTION_IMPORT;
    if(!src?.prepare)throw Error('Strict question validator unavailable.');
    const result=src.prepare(JSON.stringify(rows),'practice-reviewed-source.json');
    if(result.errors.length)throw Error(result.errors.slice(0,5).join(' | '));
    if(!result.valid.length)throw Error('No new valid questions; review answers/options.');
    const batch=++uploadBatch;
    const mapped=result.valid.map((q,i)=>({
      id:'uploaded-source-'+batch+'-'+i,
      classLevel:Number(String(q.class_name).match(/[0-9]+/)?.[0]||0),
      subject:q.subject,chapter:q.chapter,type:q.question_type,
      difficulty:q.difficulty==='Easy'?'Easy':q.difficulty==='Challenging'?'Hard':'Medium',
      question:q.question_text,options:q.options||[],
      answer:q.correct_option,answerText:q.answer_text||'',
      explanation:q.answer_text||'',source:'user-reviewed-document'
    }));
    if(mapped.some(x=>x.classLevel<1||x.classLevel>12))throw Error('Select a valid grade 1–12 first.');
    uploadScope=scope();uploadRows=mapped;
    if($('practiceSourceOnly'))$('practiceSourceOnly').checked=true;
    fillSubjects();updateStats();
    return{valid:mapped.length,duplicates:result.duplicates};
  }
  function clearReviewedSource(){
    uploadRows=[];uploadScope='';
    if($('practiceSourceOnly'))$('practiceSourceOnly').checked=false;
    fillSubjects();updateStats();
  }

  const schoolStudents=()=>{try{const rows=JSON.parse(localStorage.getItem('edunizam_students')||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}};
  // A student selector must honor the active school/role visibility rules.
  // Missing authorization scope fails closed; public guest practice is separate.
  const visibleStudents=()=>{
    const scope=window.EDUNIZAM_ROLE_SCOPE;
    if(typeof scope?.getVisibleStudents!=='function')return[];
    const rows=scope.getVisibleStudents(schoolStudents());
    return Array.isArray(rows)?rows.filter(s=>s&&s.id!==null&&s.id!==undefined&&String(s.id).trim()&&s.name):[];
  };
  const history=()=>JSON.parse(localStorage.getItem('edunizam_practice_history')||'[]');
  const saveHistory=v=>localStorage.setItem('edunizam_practice_history',JSON.stringify(v.slice(-100)));

  // Reopening Practice refreshes current-school options without destroying a
  // legitimate user selection. Only an explicit class/subject change resets its
  // dependent selections. Never show a subject with no source in the catalog
  // unless a genuine authored/reviewed question uses that subject.
  const distinct=values=>[...new Map(values.map(x=>String(x||'').trim()).filter(Boolean).map(x=>[x.normalize('NFKC').toLowerCase(),x])).values()];
  const questionsFor=(cls,sub)=>[...(D.questions||[]),...reviewedSourceQuestions()].filter(q=>
    (!cls||String(q.classLevel)===String(cls))&&(!sub||String(q.subject)===String(sub)));
  function fill(){
    const students=visibleStudents(),student=$('practiceStudent'),selectedStudent=student?.value||'';
    if(student){
      student.innerHTML='<option value="">Student (optional)</option>'+students.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(s.className||'')+'</option>').join('');
      if(students.some(s=>String(s.id)===String(selectedStudent)))student.value=selectedStudent;
    }
    const board=$('practiceBoard'),selectedBoard=board?.value||'';
    board.innerHTML='<option value="">Board context (optional)</option>'+D.boards.map(x=>'<option>'+esc(x)+'</option>').join('');
    if(D.boards.includes(selectedBoard))board.value=selectedBoard;
    fillSubjects();
    $('practiceBankBadge').textContent=D.questions.length+' Questions';
    updateStats();
  }
  function fillSubjects({reset=false}={}){
    const cls=$('practiceClass').value,field=$('practiceSubject'),previous=reset?'':field.value;
    const reference=cls?(D.subjects[cls]||[]):Object.values(D.subjects).flat();
    const authored=questionsFor(cls,'').map(q=>q.subject);
    const subjects=distinct([...reference,...authored]).sort((a,b)=>a.localeCompare(b));
    field.innerHTML='<option value="">Select Subject</option>'+subjects.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join('');
    if(subjects.includes(previous))field.value=previous;
    fillChapters({reset});
  }
  function fillChapters({reset=false}={}){
    const cls=$('practiceClass').value,sub=$('practiceSubject').value,field=$('practiceChapter');
    const previous=reset?'':field.value,key=cls+'|'+sub;
    const chapters=cls&&sub?distinct([...(D.chapters[key]||[]),...questionsFor(cls,sub).map(q=>q.chapter)]):[];
    field.innerHTML='<option value="">All Chapters</option>'+chapters.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
    if(chapters.includes(previous))field.value=previous;
    updateCoverage();
  }
  function updateCoverage(){
    const out=$('practiceCoverageStatus');if(!out)return;
    const cls=$('practiceClass').value,sub=$('practiceSubject').value;
    if(!cls||!sub){out.textContent='Select a class and subject to see available genuine questions and chapters.';return}
    const fromUpload=!!$('practiceSourceOnly')?.checked;
    const all=fromUpload?reviewedSourceQuestions():D.questions||[];
    const chapters=$('practiceChapter').value,type=$('practiceType').value,
      difficulty=$('practiceDifficulty').value;
    const exact=all.filter(q=>String(q.classLevel)===cls&&q.subject===sub&&
      (!chapters||q.chapter===chapters)&&(!difficulty||q.difficulty===difficulty)&&
      (type==='mixed'||q.type===type));
    const total=all.filter(q=>String(q.classLevel)===cls&&q.subject===sub).length;
    out.textContent=fromUpload
      ?exact.length+' matching reviewed uploaded question(s) · '+total+' uploaded for this class and subject.'+
        (!exact.length?' Review your uploaded material or broaden question type/chapter/difficulty.':'')
      :exact.length+' exact matching concept question(s) · '+total+' total for this class and subject.'+
        (!exact.length?' No exact match: choose another topic/type or add reviewed questions.':
        exact.length<Number($('practiceCount').value||5)?' Practice may supplement from the same class and subject with other chapters/types/difficulty.':'');
  }
  function getConfig(){
    const selectedId=String($('practiceStudent')?.value||'').trim();
    const student=selectedId?visibleStudents().find(s=>String(s.id)===selectedId):null;
    const studentId=student?String(student.id):null;
    return{
    studentId,studentName:student?.name||'',
    board:$('practiceBoard').value,cls:Number($('practiceClass').value||0),subject:$('practiceSubject').value,
    chapter:$('practiceChapter').value,type:$('practiceType').value,difficulty:$('practiceDifficulty').value,
    count:Number($('practiceCount').value),minutes:Number($('practiceMinutes').value)
  }}
  function poolFor(c){
    const filters={classLevel:c.cls,subject:c.subject,chapter:c.chapter,type:c.type==='mixed'?'':c.type,difficulty:c.difficulty};
    if($('practiceSourceOnly')?.checked){
      const rows=reviewedSourceQuestions().filter(q=>(!c.cls||q.classLevel===c.cls)&&(!c.subject||q.subject===c.subject)&&(!c.chapter||q.chapter===c.chapter)&&(!c.difficulty||q.difficulty===c.difficulty)&&(c.type==='mixed'||q.type===c.type));
      poolNotice=' · Uploaded source (teacher-reviewed, unverified textbook alignment)';
      return rows;
    }
    const info=window.EDUNIZAM_PRACTICE_CORE?.expandQuestions?.(D.questions,filters,{target:c.count});
    if(info){
      poolNotice=info.expanded?' · '+info.exactCount+' exact questions; added '+info.note+' in this class and subject':'';
      return info.questions;
    }
    poolNotice='';
    return D.questions.filter(q=>(!c.cls||q.classLevel===c.cls)&&(!c.subject||q.subject===c.subject)&&(!c.chapter||q.chapter===c.chapter)&&(!c.difficulty||q.difficulty===c.difficulty)&&(c.type==='mixed'||q.type===c.type));
  }
  function shuffle(a){return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1])}
  function start(){
    const c=getConfig();lastConfig=c;
    if(!c.cls||!c.subject)return alert('Select class and subject.');
    const pool=shuffle(poolFor(c));
    if(!pool.length)return alert($('practiceSourceOnly')?.checked?'No reviewed uploaded-source questions match these filters. Import a source, choose Mixed question types, or clear difficulty.':'No genuine questions indexed for this class and subject. Change your selection or import verified questions.');
    current=pool.slice(0,Math.min(c.count,pool.length));
    sourceSessionScope=$('practiceSourceOnly')?.checked?scope():'';
    cursor=0;answers=current.map(()=>null);
    secondsLeft=c.minutes*60;
    $('practiceBuildPanel').classList.add('hidden');$('practiceResultPanel').classList.add('hidden');$('practiceTestPanel').classList.remove('hidden');
    const levelLabel=Number(c.cls)<=8?'Grade '+c.cls:'Class '+c.cls;
    $('practiceTestTitle').textContent=($('practiceSourceOnly')?.checked?'Uploaded-document practice (reviewed source)':'EduNizam concept practice')+' · '+levelLabel+' · '+c.subject+(c.chapter?' · '+c.chapter:'')+(c.board?' · Target board: '+c.board:'')+poolNotice;
    renderQuestions();tick();clearInterval(timer);timer=setInterval(()=>{secondsLeft--;tick();if(secondsLeft<=0){clearInterval(timer);submit()}},1000);
  }
  function saveVisibleAnswer(){
    const q=current[cursor];if(!q)return;
    if(q.type==='mcq'){
      const checked=document.querySelector('input[name="pq_'+cursor+'"]:checked');
      answers[cursor]=checked?Number(checked.value):null;
    }else{
      answers[cursor]=document.querySelector('[data-text-answer="'+cursor+'"]')?.value||'';
    }
  }
  function answeredCount(){return answers.filter((answer,i)=>current[i]?.type==='mcq'?Number.isInteger(answer):!!String(answer??'').trim()).length}
  function renderQuestions(){
    if(!activeSession())return;
    const q=current[cursor],area=$('practiceQuestions');if(!q||!area)return;
    $('practiceProgress').textContent='Question '+(cursor+1)+' of '+current.length+' · '+answeredCount()+' answered';
    let body='';
    if(q.type==='mcq'){
      body='<div class="practice-options">'+(q.options||[]).map((option,index)=>
        '<label><input type="radio" name="pq_'+cursor+'" value="'+index+'" '+(answers[cursor]===index?'checked':'')+'> '+esc(option)+'</label>'
      ).join('')+'</div>';
    }else{
      body='<textarea rows="'+(q.type==='long'?6:3)+'" data-text-answer="'+cursor+'" placeholder="Write your answer">'+esc(answers[cursor]||'')+'</textarea>';
    }
    area.innerHTML='<article class="practice-question"><div class="practice-q-meta"><span>Q'+(cursor+1)+' / '+current.length+'</span><span class="mini-badge">'+esc(q.type.toUpperCase())+'</span><span class="mini-badge">'+esc(q.difficulty)+'</span><span class="mini-badge">'+esc(q.chapter||'General')+'</span></div><h3>'+esc(q.question)+'</h3>'+body+'</article>';
    const prev=$('practicePrevBtn'),next=$('practiceNextBtn');
    if(prev)prev.disabled=cursor===0;
    if(next){next.disabled=false;next.textContent=cursor===current.length-1?'Finish & Submit':'Next Question →'}
    area.querySelectorAll('input,textarea').forEach(el=>el.addEventListener('change',()=>{
      saveVisibleAnswer();$('practiceProgress').textContent='Question '+(cursor+1)+' of '+current.length+' · '+answeredCount()+' answered';
    }));
  }
  function navigate(delta){
    if(!activeSession()||!current.length)return;
    saveVisibleAnswer();
    const target=Math.max(0,Math.min(current.length-1,cursor+delta));
    if(target===cursor)return;
    cursor=target;renderQuestions();
    $('practiceTestPanel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  function forward(){if(!activeSession()||!current.length)return;if(cursor===current.length-1)submit();else navigate(1)}
  function tick(){const m=Math.floor(secondsLeft/60),s=secondsLeft%60;$('practiceTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
  function submit(){
    if(!activeSession()||!current.length)return;
    clearInterval(timer);
    saveVisibleAnswer();
    let autoTotal=0,autoCorrect=0,weak=[];
    const details=current.map((q,i)=>{
      if(q.type==='mcq'){
        autoTotal++;
        const chosen=Number.isInteger(answers[i])?answers[i]:null,correct=chosen===q.answer;
        if(correct)autoCorrect++;else weak.push({classLevel:q.classLevel,subject:q.subject,chapter:q.chapter});
        return {id:q.id,type:q.type,correct,chosen};
      }else{
        const ans=String(answers[i]??'').trim();
        return {id:q.id,type:q.type,textAnswer:ans,manual:true};
      }
    });
    const pct=autoTotal?Math.round(autoCorrect/autoTotal*100):0;
    const rec={id:Date.now(),at:new Date().toISOString(),studentId:lastConfig?.studentId||null,studentName:lastConfig?.studentName||'',config:lastConfig,questionIds:current.map(q=>q.id),autoTotal,autoCorrect,pct,weak,details};
    const h=history();h.push(rec);saveHistory(h);
    $('practiceTestPanel').classList.add('hidden');$('practiceResultPanel').classList.remove('hidden');
    $('practiceResultSummary').innerHTML='<div class="result-score"><strong>'+pct+'%</strong><span>Auto-marked score</span></div><p>'+autoCorrect+' correct out of '+autoTotal+' MCQs.'+(current.some(q=>q.type!=='mcq')?' Written answers are saved for AI/teacher review.':'')+'</p>'+renderReview(details);
    updateStats();
  }
  function renderReview(details){
    return '<div class="list">'+details.map((d,i)=>{const q=current[i];if(q.type==='mcq')return '<div class="practice-review '+(d.correct?'correct':'wrong')+'"><strong>Q'+(i+1)+': '+esc(q.question)+'</strong><div>'+ (d.correct?'Correct':'Correct answer: '+esc(q.options[q.answer]))+'</div><small>'+esc(q.explanation||'')+'</small></div>';return '<div class="practice-review"><strong>Q'+(i+1)+': '+esc(q.question)+'</strong><div class="muted">Suggested answer: '+esc(q.answerText||'Review with AI/teacher')+'</div></div>'}).join('')+'</div>';
  }
  function activeSession(){if(sourceSessionScope&&sourceSessionScope!==scope()){cancel();return false}return true}
  function cancel(){clearInterval(timer);sourceSessionScope='';current=[];cursor=0;answers=[];$('practiceTestPanel').classList.add('hidden');$('practiceBuildPanel').classList.remove('hidden')}
  function retry(){cancel();if(lastConfig)start()}
  function updateStats(){
    const h=history(),best=h.length?Math.max(...h.map(x=>x.pct||0)):0,weakMap={};
    h.flatMap(x=>x.weak||[]).forEach(w=>{const k=w.subject+' · '+w.chapter;weakMap[k]=(weakMap[k]||0)+1});
    $('practiceStatBank').textContent=D.questions.length;$('practiceStatTests').textContent=h.length;$('practiceStatBest').textContent=best+'%';$('practiceStatWeak').textContent=Object.keys(weakMap).length;
  }
  function showTab(tab){
    document.querySelectorAll('[data-practice-tab]').forEach(b=>b.classList.toggle('active',b.dataset.practiceTab===tab));
    $('practiceBuildPanel').classList.toggle('hidden',tab!=='build');$('practiceTestPanel').classList.add('hidden');$('practiceResultPanel').classList.add('hidden');
    $('practiceHistoryPanel').classList.toggle('hidden',tab!=='history');$('practiceWeakPanel').classList.toggle('hidden',tab!=='weak');
    if(tab==='history')renderHistory();if(tab==='weak')renderWeak();
  }
  function renderHistory(){
    const h=history().slice().reverse();
    $('practiceHistoryPanel').innerHTML=h.length?h.map(x=>'<article class="paper-card"><h3>'+esc(x.config.subject)+' · Class '+x.config.cls+'</h3><p class="muted">'+new Date(x.at).toLocaleString()+(x.studentName?' · '+esc(x.studentName):'')+'</p><div class="paper-meta"><span>'+x.pct+'%</span><span>'+x.autoCorrect+'/'+x.autoTotal+' MCQs</span><span>'+esc(x.config.type)+'</span></div></article>').join(''):'<div class="empty-state">No tests taken yet.</div>';
  }
  function renderWeak(){
    const map={};
    history().forEach(rec=>(rec.weak||[]).forEach(w=>{const cl=Number(w.classLevel||rec.config?.cls||0),k=cl+'|'+w.subject+'|'+w.chapter;(map[k]??={classLevel:cl,subject:w.subject,chapter:w.chapter,count:0}).count++}));
    const arr=Object.values(map).sort((a,b)=>b.count-a.count);
    $('practiceWeakPanel').innerHTML=arr.length?arr.map(x=>'<article class="paper-card"><h3>'+esc(x.chapter||'General')+'</h3><p class="muted">'+esc((x.classLevel<=8?'Grade ':'Class ')+x.classLevel+' · '+x.subject)+'</p><div class="paper-meta"><span>'+x.count+' mistakes</span></div><button data-practice-weak data-class="'+esc(x.classLevel)+'" data-subject="'+esc(x.subject)+'" data-chapter="'+esc(x.chapter)+'">Practice Again</button></article>').join(''):'<div class="empty-state">No weak topics yet. Complete a test first.</div>';
    document.querySelectorAll('[data-practice-weak]').forEach(b=>b.onclick=()=>{showTab('build');$('practiceClass').value=b.dataset.class;fillSubjects();$('practiceSubject').value=b.dataset.subject;fillChapters();$('practiceChapter').value=b.dataset.chapter});
  }
  function printBuild(){
    const c=getConfig(),pool=poolFor(c).slice(0,c.count);
    if(!c.cls||!c.subject||!pool.length)return alert('Select class and subject with available questions.');
    const w=window.open('','_blank');if(!w)return;
    const levelLabel=Number(c.cls)<=8?'Grade '+c.cls:'Class '+c.cls;
    w.document.write('<html><head><title>EduNizam Test</title><style>body{font-family:Arial;padding:32px}h1{font-size:22px}.q{margin:20px 0}.opts{margin-left:20px;line-height:1.8}</style></head><body><h1>EduNizam Concept Practice Test</h1><p>'+levelLabel+' · '+esc(c.subject)+(c.chapter?' · '+esc(c.chapter):'')+(c.board?' · Target board context: '+esc(c.board):'')+'</p>'+pool.map((q,i)=>'<div class="q"><strong>Q'+(i+1)+'. '+esc(q.question)+'</strong>'+(q.options?'<div class="opts">'+q.options.map((o,j)=>String.fromCharCode(65+j)+'. '+esc(o)).join('<br>')+'</div>':'<div style="height:80px"></div>')+'</div>').join('')+'</body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),300);
  }
  function aiGenerate(){
    const c=getConfig();
    if(!c.cls||!c.subject)return alert('Select class and subject.');
    if(window.setView)window.setView('assistant');
    const levelLabel=Number(c.cls)<=8?'Grade '+c.cls:'Class '+c.cls;
    $('aiPrompt').value='Generate a premium '+c.count+'-question '+(c.type==='mixed'?'mixed':c.type)+' test for '+levelLabel+' '+c.subject+(c.chapter?' chapter '+c.chapter:'')+(c.difficulty?' at '+c.difficulty+' difficulty':'')+(c.board?' using '+c.board+' as exam-style context where applicable':'')+'. Include answer key and explanations. Do not claim the questions are official board questions unless an official source is explicitly provided.';
    $('aiOutput').textContent='Test-generation request prepared. AI backend will generate it when connected.';
  }

  $('practiceClass').addEventListener('change',()=>fillSubjects({reset:true}));
  $('practiceSubject').addEventListener('change',()=>fillChapters({reset:true}));
  ['practiceChapter','practiceType','practiceDifficulty','practiceCount','practiceSourceOnly'].forEach(id=>
    $(id)?.addEventListener('change',updateCoverage));
  $('startPracticeBtn').onclick=start;$('practicePrevBtn').onclick=()=>navigate(-1);$('practiceNextBtn').onclick=forward;$('submitPracticeBtn').onclick=submit;$('cancelPracticeBtn').onclick=cancel;$('retryPracticeBtn').onclick=retry;
  $('printPracticeBtn').onclick=printBuild;$('printResultBtn').onclick=()=>window.print();$('aiGenerateTestBtn').onclick=aiGenerate;
  document.querySelectorAll('[data-practice-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.practiceTab));
  window.renderPracticeCenter=()=>{fill();updateStats();window.EDUNIZAM_PRACTICE_SOURCE?.mount?.()};
   window.EDUNIZAM_PRACTICE_NAV={
    start,next:forward,previous:()=>navigate(-1),submit,
    addReviewedSource,clearReviewedSource,reviewedSourceQuestions,
    status:()=>({cursor,total:current.length,answered:answeredCount(),answers:answers.slice()})
   };
  fill();window.EDUNIZAM_PRACTICE_SOURCE?.mount?.();
})();