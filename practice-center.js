(function(){
  const D=window.EDUNIZAM_PRACTICE_DATA;if(!D)return;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let current=[],timer=null,secondsLeft=0,lastConfig=null;

  const history=()=>JSON.parse(localStorage.getItem('edunizam_practice_history')||'[]');
  const saveHistory=v=>localStorage.setItem('edunizam_practice_history',JSON.stringify(v.slice(-100)));

  function fill(){
    const students=JSON.parse(localStorage.getItem('edunizam_students')||'[]');
    if($('practiceStudent'))$('practiceStudent').innerHTML='<option value="">Student (optional)</option>'+students.map(s=>'<option value="'+s.id+'">'+esc(s.name)+' · '+esc(s.className||'')+'</option>').join('');
    $('practiceBoard').innerHTML='<option value="">All Boards</option>'+D.boards.map(x=>'<option>'+esc(x)+'</option>').join('');
    fillSubjects();fillChapters();
    $('practiceBankBadge').textContent=D.questions.length+' Questions';
    updateStats();
  }
  function fillSubjects(){
    const cls=$('practiceClass').value;
    const subjects=cls?(D.subjects[cls]||[]):[...new Set(Object.values(D.subjects).flat())].sort();
    $('practiceSubject').innerHTML='<option value="">Subject</option>'+subjects.map(s=>'<option>'+esc(s)+'</option>').join('');
    fillChapters();
  }
  function fillChapters(){
    const cls=$('practiceClass').value,sub=$('practiceSubject').value;
    const key=cls+'|'+sub;
    const chapters=D.chapters[key]||[];
    $('practiceChapter').innerHTML='<option value="">All Chapters</option>'+chapters.map(x=>'<option>'+esc(x)+'</option>').join('');
  }
  function getConfig(){
    const studentId=Number($('practiceStudent')?.value||0);
    const student=JSON.parse(localStorage.getItem('edunizam_students')||'[]').find(s=>Number(s.id)===studentId);
    return{
    studentId:studentId||null,studentName:student?.name||'',
    board:$('practiceBoard').value,cls:Number($('practiceClass').value||0),subject:$('practiceSubject').value,
    chapter:$('practiceChapter').value,type:$('practiceType').value,difficulty:$('practiceDifficulty').value,
    count:Number($('practiceCount').value),minutes:Number($('practiceMinutes').value)
  }}
  function poolFor(c){
    return D.questions.filter(q=>(!c.cls||q.classLevel===c.cls)&&(!c.subject||q.subject===c.subject)&&(!c.chapter||q.chapter===c.chapter)&&(!c.difficulty||q.difficulty===c.difficulty)&&(c.type==='mixed'||q.type===c.type));
  }
  function shuffle(a){return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1])}
  function start(){
    const c=getConfig();lastConfig=c;
    if(!c.cls||!c.subject)return alert('Select class and subject.');
    const pool=shuffle(poolFor(c));
    if(!pool.length)return alert('No questions available for these filters yet.');
    current=pool.slice(0,Math.min(c.count,pool.length));
    secondsLeft=c.minutes*60;
    $('practiceBuildPanel').classList.add('hidden');$('practiceResultPanel').classList.add('hidden');$('practiceTestPanel').classList.remove('hidden');
    $('practiceTestTitle').textContent=(c.board?c.board+' · ':'')+'Class '+c.cls+' · '+c.subject+(c.chapter?' · '+c.chapter:'');
    renderQuestions();tick();clearInterval(timer);timer=setInterval(()=>{secondsLeft--;tick();if(secondsLeft<=0){clearInterval(timer);submit()}},1000);
  }
  function renderQuestions(){
    $('practiceProgress').textContent=current.length+' questions';
    $('practiceQuestions').innerHTML=current.map((q,i)=>{
      let body='';
      if(q.type==='mcq') body='<div class="practice-options">'+q.options.map((o,ix)=>'<label><input type="radio" name="pq_'+i+'" value="'+ix+'"> '+esc(o)+'</label>').join('')+'</div>';
      else body='<textarea rows="'+(q.type==='long'?6:3)+'" data-text-answer="'+i+'" placeholder="Write your answer"></textarea>';
      return '<article class="practice-question"><div class="practice-q-meta"><span>Q'+(i+1)+'</span><span class="mini-badge">'+esc(q.type.toUpperCase())+'</span><span class="mini-badge">'+esc(q.difficulty)+'</span></div><h3>'+esc(q.question)+'</h3>'+body+'</article>';
    }).join('');
  }
  function tick(){const m=Math.floor(secondsLeft/60),s=secondsLeft%60;$('practiceTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
  function submit(){
    if(!current.length)return;
    clearInterval(timer);
    let autoTotal=0,autoCorrect=0,weak=[];
    const details=current.map((q,i)=>{
      if(q.type==='mcq'){
        autoTotal++;
        const el=document.querySelector('input[name="pq_'+i+'"]:checked');
        const chosen=el?Number(el.value):null,correct=chosen===q.answer;
        if(correct)autoCorrect++;else weak.push({subject:q.subject,chapter:q.chapter});
        return {id:q.id,type:q.type,correct,chosen};
      }else{
        const ans=document.querySelector('[data-text-answer="'+i+'"]')?.value.trim()||'';
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
  function cancel(){clearInterval(timer);current=[];$('practiceTestPanel').classList.add('hidden');$('practiceBuildPanel').classList.remove('hidden')}
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
    const map={};history().flatMap(x=>x.weak||[]).forEach(w=>{const k=w.subject+'|'+w.chapter;(map[k]??={subject:w.subject,chapter:w.chapter,count:0}).count++});
    const arr=Object.values(map).sort((a,b)=>b.count-a.count);
    $('practiceWeakPanel').innerHTML=arr.length?arr.map(x=>'<article class="paper-card"><h3>'+esc(x.chapter||'General')+'</h3><p class="muted">'+esc(x.subject)+'</p><div class="paper-meta"><span>'+x.count+' mistakes</span></div><button data-practice-weak="'+esc(x.subject)+'|'+esc(x.chapter)+'">Practice Again</button></article>').join(''):'<div class="empty-state">No weak topics yet. Complete a test first.</div>';
    document.querySelectorAll('[data-practice-weak]').forEach(b=>b.onclick=()=>{const [s,ch]=b.dataset.practiceWeak.split('|');showTab('build');$('practiceSubject').value=s;fillChapters();$('practiceChapter').value=ch});
  }
  function printBuild(){
    const c=getConfig(),pool=poolFor(c).slice(0,c.count);
    if(!c.cls||!c.subject||!pool.length)return alert('Select class and subject with available questions.');
    const w=window.open('','_blank');if(!w)return;
    w.document.write('<html><head><title>EduNizam Test</title><style>body{font-family:Arial;padding:32px}h1{font-size:22px}.q{margin:20px 0}.opts{margin-left:20px;line-height:1.8}</style></head><body><h1>EduNizam Practice Test</h1><p>Class '+c.cls+' · '+esc(c.subject)+(c.chapter?' · '+esc(c.chapter):'')+'</p>'+pool.map((q,i)=>'<div class="q"><strong>Q'+(i+1)+'. '+esc(q.question)+'</strong>'+(q.options?'<div class="opts">'+q.options.map((o,j)=>String.fromCharCode(65+j)+'. '+esc(o)).join('<br>')+'</div>':'<div style="height:80px"></div>')+'</div>').join('')+'</body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),300);
  }
  function aiGenerate(){
    const c=getConfig();
    if(!c.cls||!c.subject)return alert('Select class and subject.');
    if(window.setView)window.setView('assistant');
    $('aiPrompt').value='Generate a premium '+c.count+'-question '+(c.type==='mixed'?'mixed':c.type)+' test for Class '+c.cls+' '+c.subject+(c.chapter?' chapter '+c.chapter:'')+(c.difficulty?' at '+c.difficulty+' difficulty':'')+'. Include answer key, explanations and board-exam style wording.';
    $('aiOutput').textContent='Test-generation request prepared. AI backend will generate it when connected.';
  }

  $('practiceClass').addEventListener('change',fillSubjects);$('practiceSubject').addEventListener('change',fillChapters);
  $('startPracticeBtn').onclick=start;$('submitPracticeBtn').onclick=submit;$('cancelPracticeBtn').onclick=cancel;$('retryPracticeBtn').onclick=retry;
  $('printPracticeBtn').onclick=printBuild;$('printResultBtn').onclick=()=>window.print();$('aiGenerateTestBtn').onclick=aiGenerate;
  document.querySelectorAll('[data-practice-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.practiceTab));
  window.renderPracticeCenter=()=>{fill();updateStats()};
  fill();
})();