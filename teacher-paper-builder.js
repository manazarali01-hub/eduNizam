(function(){
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const cloud=()=>window.EDUNIZAM_CLOUD,cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{},settings=()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}},role=()=>{let r;try{r=JSON.parse(localStorage.getItem('edunizam_session')||'{}').role}catch{}return r==='admin'?'head':r||'student'},ready=()=>!!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId);
let current=null,currentRow=null,teacherDefaults={classes:[],subjects:[]},customQuestions=[],editingQuestionId='';
async function loadTeacherDefaults(){if(!ready()||role()!=='teacher')return;const {data}=await cloud().state.client.from('staff_profiles').select('classes,subjects').eq('institution_id',cfg().institutionId).eq('user_id',cloud().state.user.id).maybeSingle();teacherDefaults={classes:data?.classes||[],subjects:data?.subjects||[]}}
async function loadCustomQuestions(){
 if(!ready()){customQuestions=[];return[]}
 const {data,error}=await cloud().state.client.from('teacher_question_bank').select('*').eq('institution_id',cfg().institutionId).order('created_at',{ascending:false}).limit(500);
 if(error){console.warn('Question bank:',error.message||error);customQuestions=[];return[]}
 customQuestions=data||[];renderQuestionBankList();updateBankInsight();return customQuestions;
}
function customPool(cls,subject,topics,type,diff){
 const level=String(cls||'').trim().toLowerCase(),target=normalizedSubject(subject).toLowerCase(),wanted=(topics||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean);
 let rows=customQuestions.filter(q=>q.active!==false&&String(q.class_name||'').trim().toLowerCase()===level&&String(q.subject||'').trim().toLowerCase()===target&&q.question_type===type);
 if(diff==='Easy')rows=rows.filter(q=>q.difficulty==='Easy');
 if(diff==='Challenging')rows=rows.filter(q=>q.difficulty==='Challenging');
 if(wanted.length){
   const chapterRows=rows.filter(q=>{const chapter=String(q.chapter||'').trim().toLowerCase();return chapter&&wanted.some(t=>chapter===t||chapter.includes(t)||t.includes(chapter))});
   rows=chapterRows;
 }
 return shuffled(rows);
}
function fromCustom(q,type){
 if(type==='mcq'){
   const opts=Array.isArray(q.options)?q.options:[],optText=opts.map((o,i)=>String.fromCharCode(65+i)+'. '+o).join('   ');
   const idx=Number(q.correct_option),correct=Number.isInteger(idx)&&opts[idx]?(String.fromCharCode(65+idx)+'. '+opts[idx]):(q.answer_text||'Teacher key required');
   return{text:q.question_text+(optText?' '+optText:''),answer:correct+(q.answer_text&&q.answer_text!==correct?' — '+q.answer_text:''),source:'teacher-bank',chapter:q.chapter||''};
 }
 return{text:q.question_text,answer:q.answer_text||'Teacher marking guide required.',source:'teacher-bank',chapter:q.chapter||''};
}
function clearQuestionForm(){
 editingQuestionId='';
 ['#qbQuestion','#qbAnswer','#qbOptions','#qbChapter'].forEach(s=>{if($(s))$(s).value=''});
 if($('#qbCorrect'))$('#qbCorrect').value='1';
 if($('#qbSave'))$('#qbSave').textContent='Add to Question Bank';
 $('#qbCancelEdit')?.classList.add('hidden');
}
function questionFormValues(){
 const type=$('#qbType')?.value||'short',options=String($('#qbOptions')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),correct=Math.max(0,Number($('#qbCorrect')?.value||1)-1);
 return{className:$('#qbClass')?.value.trim()||'',subject:$('#qbSubject')?.value.trim()||'',chapter:$('#qbChapter')?.value.trim()||'',type,difficulty:$('#qbDifficulty')?.value||'Balanced',question:$('#qbQuestion')?.value.trim()||'',answer:$('#qbAnswer')?.value.trim()||'',options,correct,visibility:$('#qbAdmin')?.checked?'admin':'private'};
}
async function saveCustomQuestion(){
 if(!ready())return alert('Cloud login required.');
 const v=questionFormValues();if(!v.className||!v.subject||!v.chapter||!v.question)return alert('Class, subject, chapter and question required.');
  if(v.type!=='mcq'&&!v.answer)return alert('Written questions require a marking guide / model answer.');
 if(v.type==='mcq'&&(v.options.length!==4||new Set(v.options.map(x=>x.toLowerCase())).size!==4||v.correct<0||v.correct>=4))return alert('MCQ ke liye exactly 4 different options aur valid answer number (1–4) required hain.');
 const payload={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,class_name:v.className,subject:normalizedSubject(v.subject),chapter:v.chapter||null,question_type:v.type,difficulty:v.difficulty,question_text:v.question,options:v.type==='mcq'?v.options:[],correct_option:v.type==='mcq'?v.correct:null,answer_text:v.answer||null,visibility:v.visibility,active:true,updated_at:new Date().toISOString()};
 let error;
 if(editingQuestionId){
   ({error}=await cloud().state.client.from('teacher_question_bank').update(payload).eq('id',editingQuestionId).eq('creator_user_id',cloud().state.user.id));
 }else{
   ({error}=await cloud().state.client.from('teacher_question_bank').insert(payload));
 }
 if(error)return alert(error.message);
 window.EDUNIZAM_PREMIUM?.toast?.(editingQuestionId?'Question updated.':'Question added to reusable bank.','success');clearQuestionForm();await loadCustomQuestions();
}
function editCustomQuestion(id){
 const q=customQuestions.find(x=>String(x.id)===String(id));if(!q||String(q.creator_user_id)!==String(cloud()?.state?.user?.id||''))return;
 editingQuestionId=String(q.id);
 $('#qbClass').value=q.class_name||'';$('#qbSubject').value=q.subject||'';$('#qbChapter').value=q.chapter||'';$('#qbType').value=q.question_type||'short';$('#qbDifficulty').value=q.difficulty||'Balanced';$('#qbQuestion').value=q.question_text||'';$('#qbAnswer').value=q.answer_text||'';$('#qbOptions').value=(Array.isArray(q.options)?q.options:[]).join('\n');$('#qbCorrect').value=Number(q.correct_option??0)+1;$('#qbAdmin').checked=q.visibility==='admin';$('#qbSave').textContent='Update Question';$('#qbCancelEdit').classList.remove('hidden');$('#questionBankManager')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteCustomQuestion(id){
 const q=customQuestions.find(x=>String(x.id)===String(id));if(!q||String(q.creator_user_id)!==String(cloud()?.state?.user?.id||''))return;
 if(!confirm('Delete this custom question?'))return;
 const {error}=await cloud().state.client.from('teacher_question_bank').delete().eq('id',id).eq('creator_user_id',cloud().state.user.id);if(error)return alert(error.message);
 await loadCustomQuestions();
}
function renderQuestionBankList(){
 const el=$('#qbList');if(!el)return;const uid=String(cloud()?.state?.user?.id||''),q=String($('#qbSearch')?.value||'').trim().toLowerCase();
 const rows=customQuestions.filter(x=>!q||[x.class_name,x.subject,x.chapter,x.question_text,x.difficulty].join(' ').toLowerCase().includes(q));
 $('#qbCount')&&($('#qbCount').textContent=rows.length+' question'+(rows.length===1?'':'s'));
 el.innerHTML=rows.map(x=>{const own=String(x.creator_user_id)===uid;return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(x.class_name)+'</span><span class="mini-badge">'+esc(x.subject)+'</span><span class="mini-badge">'+esc(String(x.question_type||'').toUpperCase())+'</span></div><span class="mini-badge">'+esc(x.difficulty)+'</span></div><h3>'+esc(x.question_text)+'</h3>'+(x.chapter?'<p class="muted">'+esc(x.chapter)+'</p>':'')+'<p class="coverage-note"><strong>Answer:</strong> '+esc(x.answer_text||((Array.isArray(x.options)&&x.options[x.correct_option])?x.options[x.correct_option]:'Teacher key'))+'</p><div class="paper-actions">'+(own?'<button class="secondary" data-qb-edit="'+x.id+'">Edit</button><button class="secondary" data-qb-delete="'+x.id+'">Delete</button>':'<span class="muted">Shared with Admin · read-only</span>')+'</div></article>'}).join('')||'<div class="empty-state">No reusable custom questions yet.</div>';
 all('[data-qb-edit]').forEach(b=>b.onclick=()=>editCustomQuestion(b.dataset.qbEdit));all('[data-qb-delete]').forEach(b=>b.onclick=()=>deleteCustomQuestion(b.dataset.qbDelete));
}
const banks={
English:{mcq:['Choose the correct meaning or usage related to {t}.','Select the grammatically correct statement about {t}.','Identify the best answer about {t}.'],short:['Explain {t} in your own words.','Write a short note on {t}.','Give two important points about {t}.'],long:['Write a detailed answer about {t} with suitable examples.']},
Urdu:{mcq:['{t} کے بارے میں درست جواب منتخب کریں۔','{t} سے متعلق درست بیان منتخب کریں۔'],short:['{t} کی مختصر وضاحت کریں۔','{t} کے دو اہم نکات لکھیں۔'],long:['{t} کی تفصیلی وضاحت مثالوں کے ساتھ کریں۔']},
Mathematics:{mcq:['Choose the correct result for a basic problem from {t}.','Select the correct rule/formula used in {t}.'],short:['Solve a short problem based on {t}.','Write the rule/formula for {t} and apply it.'],long:['Solve a multi-step problem from {t}. Show complete working.']},
Science:{mcq:['Choose the correct scientific statement about {t}.','Select the correct example related to {t}.'],short:['Define {t} and give one example.','State two key facts about {t}.'],long:['Explain {t} with reasoning, examples and a labelled diagram where suitable.']},
Islamiyat:{mcq:['Select the correct statement about {t}.','Choose the best answer related to {t}.'],short:['Write a short note on {t}.','State two teachings related to {t}.'],long:['Explain {t} in detail and describe its practical importance.']},
General:{mcq:['Choose the correct answer about {t}.','Select the best statement related to {t}.'],short:['Define/explain {t} briefly.','Write two important points about {t}.'],long:['Discuss {t} in detail with relevant examples.']}
};
function bank(s){return banks[s]||banks.General} function fill(x,t){return x.replaceAll('{t}',t)}
function distribute(total,mode){const r=mode==='Objective Heavy'?[.4,.35,.25]:mode==='Subjective Heavy'?[.15,.35,.5]:[.25,.35,.4];let a=Math.max(1,Math.round(total*r[0])),b=Math.max(1,Math.round(total*r[1]));return[a,b,total-a-b]}
function classLevelFrom(v){const m=String(v||'').match(/\b(1[0-2]|[1-9])\b/);return m?Number(m[1]):0}
function normalizedSubject(v){
 const x=String(v||'').trim().toLowerCase();
 const aliases={'science':'General Science','general science':'General Science','islamiyat':'Islamiat / Ethics','islamiat':'Islamiat / Ethics','islamic studies':'Islamiat / Ethics','computer':'Computer Science','computer science':'Computer Science','math':'Mathematics','mathematics':'Mathematics','pak studies':'Pakistan Studies','pakistan studies':'Pakistan Studies'};
 return aliases[x]||String(v||'').trim();
}
function shuffled(arr){return arr.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
function bankPool(cls,subject,topics,type,diff){
 const D=window.EDUNIZAM_PRACTICE_DATA||{},level=classLevelFrom(cls),target=normalizedSubject(subject).toLowerCase();
 let rows=(D.questions||[]).filter(q=>level>0&&Number(q.classLevel)===level&&String(q.subject||'').toLowerCase()===target&&q.type===type);
 if(diff==='Easy')rows=rows.filter(q=>q.difficulty==='Easy');
 if(diff==='Challenging')rows=rows.filter(q=>q.difficulty==='Hard');
 const wanted=(topics||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean);
 if(wanted.length){
   const chapterRows=rows.filter(q=>wanted.some(t=>String(q.chapter||'').toLowerCase().includes(t)||t.includes(String(q.chapter||'').toLowerCase())));
   rows=chapterRows;
 }
 return shuffled(rows);
}
function fallbackQuestion(subject,topics,type,i,no){
 const b=bank(subject),ts=topics.length?topics:['selected syllabus'],topic=ts[(i+no)%ts.length],arr=b[type],stem=fill(arr[i%arr.length],topic);
 if(type==='mcq')return{text:stem+' A. '+topic+'   B. Related concept   C. None of these   D. Teacher-edit option',answer:'Suggested: A (teacher should verify/edit).',source:'template',chapter:topic};
 return{text:stem,answer:'Teacher key: '+topic+' — verify/adapt to taught content.',source:'template',chapter:topic};
}
function fromPractice(q,type){
 if(type==='mcq'){
   const opts=(q.options||[]).map((o,i)=>String.fromCharCode(65+i)+'. '+o).join('   ');
   const correct=Number.isInteger(q.answer)&&q.options?.[q.answer]?(String.fromCharCode(65+q.answer)+'. '+q.options[q.answer]):'See current teaching key';
   return{text:q.question+(opts?' '+opts:''),answer:correct+(q.explanation?' — '+q.explanation:''),source:'practice-bank',chapter:q.chapter||''};
 }
 return{text:q.question,answer:q.answerText||q.explanation||'Teacher marking guide required.',source:'practice-bank',chapter:q.chapter||''};
}
function build(subject,topics,total,diff,mode,cls=''){
 const marks=distribute(total,mode),sections=[],answers=[];let no=1,customUsed=0,bankUsed=0,templateUsed=0;
 const specs=[['Section A — MCQs','mcq',marks[0],Math.max(5,Math.min(20,marks[0]))],['Section B — Short Questions','short',marks[1],Math.max(2,Math.min(10,Math.ceil(marks[1]/3)))],['Section C — Long Questions','long',marks[2],Math.max(1,Math.min(5,Math.ceil(marks[2]/8)))]];
 specs.forEach(([title,type,sm,n])=>{
   const ownPool=customPool(cls,subject,topics,type,diff),practicePool=bankPool(cls,subject,topics,type,diff),qs=[];
    const available=ownPool.length+practicePool.length;
    const required=Math.max(1,Math.ceil(n*.6));
    n=Math.min(n,available);
    const maxMarksPerQuestion=type==='mcq'?2:type==='short'?5:12;
    if(n<required||!n||sm>n*maxMarksPerQuestion)
      throw new Error('Insufficient real '+type.toUpperCase()+' questions for '+cls+' / '+subject+(topics.length?' / '+topics.join(', '):'')+': '+available+' available; at least '+Math.max(required,Math.ceil(sm/maxMarksPerQuestion))+' needed for a credible '+sm+'-mark section. Select more chapters, reduce marks or add verified teacher-bank questions.');
    const points=Array.from({length:n},(_,i)=>Math.floor(sm/n)+(i<sm%n?1:0));
   for(let i=0;i<n;i++){
     let built;
     if(ownPool[i]){built=fromCustom(ownPool[i],type);customUsed++}
     else{
       const practiceIndex=i-ownPool.length,picked=practiceIndex>=0?practicePool[practiceIndex]:null;
       if(picked){built=fromPractice(picked,type);bankUsed++}
       else{throw new Error('No syllabus-backed question available for '+type+'. Please add verified questions.')}
     }
     const qno=no++;qs.push({no:qno,marks:points[i],text:built.text,answer:built.answer,source:built.source,chapter:built.chapter});answers.push({no:qno,marks:points[i],answer:built.answer});
   }
   sections.push({title,marks:sm,questions:qs});
 });
 return {subject,topics,totalMarks:total,difficulty:diff,distribution:mode,className:cls,sections,answers,sourceStats:{teacherBank:customUsed,practiceBank:bankUsed,templateFallback:templateUsed,total:customUsed+bankUsed+templateUsed}};
}
function header(p,row){const st=settings(),logo=st.schoolLogo?'<img src="'+esc(st.schoolLogo)+'" class="pb-print-logo" alt="">':'';return '<div class="pb-paper-head">'+logo+'<div><h1>'+esc(st.schoolName||'EduNizam Institute')+'</h1><p>'+esc(st.schoolType||'Educational Institute')+(st.session?' · '+esc(st.session):'')+'</p></div></div><div class="pb-meta"><span><b>Paper:</b> '+esc(row?.title||$('#pbTitle')?.value||p.subject+' Paper')+'</span><span><b>Class:</b> '+esc(row?.class_name||$('#pbClass')?.value||'')+'</span><span><b>Subject:</b> '+esc(p.subject)+'</span><span><b>Marks:</b> '+p.totalMarks+'</span><span><b>Difficulty:</b> '+esc(p.difficulty)+'</span></div><div class="pb-student-line">Name: ____________________ &nbsp; Roll No: __________ &nbsp; Date: __________</div>'}
function paperHtml(p,row,editable=false){return '<div class="pb-print-sheet">'+header(p,row)+p.sections.map((s,si)=>'<section class="pb-section"><h3>'+esc(s.title)+' <span>'+s.marks+' Marks</span></h3>'+s.questions.map((q,qi)=>'<div class="pb-question"><b>Q'+q.no+'.</b> '+(Number(q.marks)>0?'<small>('+Number(q.marks)+' mark'+(Number(q.marks)===1?'':'s')+')</small> ':'')+(editable?'<textarea data-q="'+si+':'+qi+'">'+esc(q.text)+'</textarea>':esc(q.text))+'</div>').join('')+'</section>').join('')+'</div>'}
function keyHtml(p){return '<div class="pb-answer-key"><h2>Teacher Answer Key / Marking Guide</h2>'+p.answers.map(a=>'<p><b>Q'+a.no+'.</b> '+esc(a.answer)+'</p>').join('')+'</div>'}
function syncEdits(){if(!current)return;all('[data-q]').forEach(x=>{const [s,q]=x.dataset.q.split(':').map(Number);current.sections[s].questions[q].text=x.value})}
function applyPreset(v){const p={quiz:[20,'Easy','Objective Heavy'],monthly:[50,'Balanced','Balanced'],term:[100,'Balanced','Subjective Heavy']}[v];if(!p)return;$('#pbMarks').value=p[0];$('#pbDifficulty').value=p[1];$('#pbDistribution').value=p[2]}
async function clonePaper(row){$('#pbTitle').value=(row.title||row.subject+' Paper')+' — Copy';$('#pbClass').value=row.class_name;$('#pbSubject').value=row.subject;$('#pbChapters').value=(row.chapters||[]).join(', ');$('#pbMarks').value=row.total_marks;$('#pbDifficulty').value=row.difficulty||'Balanced';current=JSON.parse(JSON.stringify(row.paper_json||{}));currentRow=null;showEditor();window.scrollTo({top:0,behavior:'smooth'})}
async function savePaper(){
 if(!ready())return alert('Cloud login required.');const subject=$('#pbSubject').value.trim(),cls=$('#pbClass').value.trim(),topics=$('#pbChapters').value.split(',').map(x=>x.trim()).filter(Boolean),total=Number($('#pbMarks').value||50),difficulty=$('#pbDifficulty').value,mode=$('#pbDistribution').value;if(!subject||!cls||!topics.length)return alert('Choose a class, subject and at least one verified chapter/topic before generating a paper.');
 try{current=build(subject,topics,total,difficulty,mode,cls)}catch(error){alert(error.message||'Question bank coverage is insufficient.');return}const title=$('#pbTitle').value.trim()||subject+' Paper';const payload={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,title,class_name:cls,subject,chapters:topics,total_marks:total,difficulty,paper_json:current,visibility:$('#pbAdmin').checked?'admin':'private'};
 const {data,error}=await cloud().state.client.from('teacher_papers').insert(payload).select().single();if(error)return alert(error.message);currentRow=data;showEditor();loadPapers();window.EDUNIZAM_PREMIUM?.toast?.('Paper draft saved. Verify the current book, questions and answer key.','success')
}
async function saveCurrentAsNew(){
 if(!ready()||!current)return alert('Cloud login required.');
 syncEdits();
 const subject=$('#pbSubject').value.trim(),cls=$('#pbClass').value.trim(),topics=$('#pbChapters').value.split(',').map(x=>x.trim()).filter(Boolean),total=Number($('#pbMarks').value||current.totalMarks||50),difficulty=$('#pbDifficulty').value,title=$('#pbTitle').value.trim()||subject+' Paper';
 if(!subject||!cls)return alert('Class and subject required.');
 const payload={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,title,class_name:cls,subject,chapters:topics,total_marks:total,difficulty,paper_json:current,visibility:$('#pbAdmin').checked?'admin':'private'};
 const {data,error}=await cloud().state.client.from('teacher_papers').insert(payload).select().single();if(error)return alert(error.message);
 currentRow=data;showEditor();loadPapers();window.EDUNIZAM_PREMIUM?.toast?.('Paper copy saved as a new paper.','success');
}
function showEditor(){
 const el=$('#paperPreview');if(!el||!current)return;
 const ss=current.sourceStats||{},uid=String(cloud()?.state?.user?.id||''),ownRow=!!currentRow&&String(currentRow.creator_user_id||'')===uid;
 const sourceNote=ss.total?'<div class="coverage-note"><strong>Question source:</strong> '+(ss.teacherBank||0)+' teacher-bank · '+(ss.practiceBank||0)+' EduNizam curriculum-bank · '+(ss.templateFallback||0)+' template fallback. Teacher verification remains required.</div>':'';
 const saveAction=currentRow?(ownRow?'<button id="pbSaveEdits">Save Changes</button>':''):'<button id="pbSaveAsNew">Save as New</button>';
 const readOnly=currentRow&&!ownRow?'<div class="coverage-note"><strong>Admin review:</strong> This paper is shared by its creator. You can review, print, view the answer key or clone it; the original remains read-only.</div>':'';
 el.innerHTML='<div class="section-head no-print"><div><h3>Paper Preview & Editor</h3><p class="muted">'+(currentRow&&!ownRow?'Shared paper review mode.':'Question text edit karein, then save or print.')+'</p></div><div class="paper-actions">'+saveAction+'<button id="pbPrint" class="secondary">Print A4</button><button id="pbKey" class="secondary">Answer Key</button></div></div>'+readOnly+sourceNote+paperHtml(current,currentRow,!(currentRow&&!ownRow))+'<div id="pbKeyWrap" class="hidden">'+keyHtml(current)+'</div>';
 if($('#pbSaveEdits'))$('#pbSaveEdits').onclick=updatePaper;if($('#pbSaveAsNew'))$('#pbSaveAsNew').onclick=saveCurrentAsNew;
 $('#pbPrint').onclick=()=>{syncEdits();el.innerHTML='<div class="no-print"><button id="pbBack">← Back to editor</button></div>'+paperHtml(current,currentRow,false);$('#pbBack').onclick=showEditor;window.print()};
 $('#pbKey').onclick=()=>$('#pbKeyWrap').classList.toggle('hidden');
}
async function updatePaper(){if(!currentRow||String(currentRow.creator_user_id||'')!==String(cloud()?.state?.user?.id||''))return;syncEdits();const {error}=await cloud().state.client.from('teacher_papers').update({paper_json:current,updated_at:new Date().toISOString()}).eq('id',currentRow.id).eq('creator_user_id',cloud().state.user.id);if(error)return alert(error.message);window.EDUNIZAM_PREMIUM?.toast?.('Paper changes saved.','success')}
async function deletePaper(id){if(!ready())return;if(!confirm('Delete this saved paper?'))return;let q=cloud().state.client.from('teacher_papers').delete().eq('id',id).eq('institution_id',cfg().institutionId);if(role()==='teacher')q=q.eq('creator_user_id',cloud().state.user.id);const {error}=await q;if(error)return alert(error.message);window.EDUNIZAM_PREMIUM?.toast?.('Paper deleted.','success');loadPapers()}
async function loadPapers(){
 if(!ready())return;
 const {data,error}=await cloud().state.client.from('teacher_papers').select('*').eq('institution_id',cfg().institutionId).order('created_at',{ascending:false}).limit(100),el=$('#savedTeacherPapers');if(!el)return;
 if(error){el.innerHTML='<div class="empty-state">'+esc(error.message)+'</div>';return}
 const search=String($('#pbSavedSearch')?.value||'').trim().toLowerCase(),cls=String($('#pbSavedClass')?.value||'').trim().toLowerCase(),uid=String(cloud()?.state?.user?.id||'');
 const rows=(data||[]).filter(x=>(!search||[x.title,x.subject,x.class_name,(x.chapters||[]).join(' ')].join(' ').toLowerCase().includes(search))&&(!cls||String(x.class_name||'').toLowerCase().includes(cls)));
 $('#pbSavedCount')&&($('#pbSavedCount').textContent=rows.length+' paper'+(rows.length===1?'':'s'));
 el.innerHTML=rows.map(x=>{const ss=x.paper_json?.sourceStats||{},own=String(x.creator_user_id||'')===uid;return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(x.class_name)+'</span><span class="mini-badge">'+(x.visibility==='admin'?'Teacher + Admin':'Private')+'</span></div><span class="mini-badge">'+new Date(x.created_at).toLocaleDateString()+'</span></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.subject)+' · '+x.total_marks+' marks · '+esc(x.difficulty)+'</p>'+(ss.total?'<p class="coverage-note">'+(ss.teacherBank||0)+' teacher-bank · '+(ss.practiceBank||0)+' curriculum-bank · '+(ss.templateFallback||0)+' fallback</p>':'')+'<div class="paper-actions"><button class="secondary" data-pb-open="'+x.id+'">'+(own?'Open / Edit / Print':'Review / Print')+'</button><button class="secondary" data-pb-clone="'+x.id+'">Clone</button>'+(own?'<button class="secondary" data-pb-delete="'+x.id+'">Delete</button>':'')+'</div></article>'}).join('')||'<div class="empty-state">No papers match this filter.</div>';
 all('[data-pb-open]').forEach(b=>b.onclick=()=>{currentRow=data.find(y=>y.id===b.dataset.pbOpen);current=JSON.parse(JSON.stringify(currentRow.paper_json||{}));showEditor();$('#paperPreview').scrollIntoView({behavior:'smooth'})});
 all('[data-pb-clone]').forEach(b=>b.onclick=()=>clonePaper(data.find(y=>y.id===b.dataset.pbClone)));
 all('[data-pb-delete]').forEach(b=>b.onclick=()=>deletePaper(b.dataset.pbDelete));
}
function refreshTeacherQuestionCatalog(){
  const cl=$('#qbClass')?.value||'',sub=$('#qbSubject')?.value||'',level=classLevelFrom(cl),
    D=window.EDUNIZAM_PRACTICE_DATA||{},chapters=D.chapters?.[level+'|'+normalizedSubject(sub)]||[];
  const el=$('#pbTeacherChapters');
  if(el)el.innerHTML=chapters.map(x=>'<option value="'+esc(x)+'"></option>').join('');
}
function refreshPaperCatalog(){
  const cl=$('#pbClass')?.value||'',sub=$('#pbSubject')?.value||'',lv=classLevelFrom(cl),D=window.EDUNIZAM_PRACTICE_DATA||{},subjects=D.subjects?.[lv]||[];
  const subjectList=$('#pbSubjects');
  if(subjectList){const commonSubjects=['English','Urdu','Mathematics','General Science','General Knowledge','Social Studies','Islamiat / Ethics','Nazra Quran','Computer Science'];const allSubjects=[...new Set([...(subjects.length?subjects:commonSubjects),...teacherDefaults.subjects])];subjectList.innerHTML=allSubjects.map(x=>'<option value="'+esc(x)+'"></option>').join('')}
  const chapters=D.chapters?.[lv+'|'+normalizedSubject(sub)]||[];
  const picker=$('#pbChapterPicker');
  if(picker){picker.innerHTML='<option value="">'+(chapters.length?'Add chapter / syllabus topic ('+chapters.length+' available)':'No mapped chapters — add verified teacher questions')+'</option>'+chapters.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');picker.disabled=!chapters.length}
  const holder=$('#pbCurriculumSources'),id=$('#pbBookBoard')?.value||'punjab-pectaa',R=window.EDUNIZAM_CURRICULUM_REGISTRY||{};
  if(!holder)return;
  const auth=(R.authorities||[]).find(x=>x.id===id);
  const authorityMatches=x=>x.authorityId===id||
    (id==='punjab-pectaa'&&/punjab|pectaa|pef/i.test(x.board||''))||
    (id==='federal-fbise'&&/fbise|federal/i.test(x.board||''))||
    (id==='sindh-stbb'&&/sindh|stbb/i.test(x.board||''))||
    (id==='kp-dcte-kptbb'&&/khyber|kp |kptbb/i.test(x.board||''))||
    (id==='balochistan-btbb'&&/balochistan|btbb/i.test(x.board||''));
  const materials=(window.EDUNIZAM_STUDY_DATA?.materials||[]).filter(x=>x.source==='official'&&authorityMatches(x)&&(!lv||(x.classLevels||[]).map(Number).includes(lv))&&(!sub||x.subject==='All Subjects'||String(x.subject).toLowerCase().includes(sub.toLowerCase())));
  const urlAllowed=u=>{try{return /^https?:$/.test(new URL(u).protocol)}catch{return false}};
  const links=[];
  if(auth&&urlAllowed(auth.officialUrl))links.push('<a href="'+esc(auth.officialUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(auth.name)+' — curriculum / textbooks</a>');
  if(id==='punjab-pectaa'){
    links.push('<a href="https://pectaa.edu.pk/books-and-publications/" target="_blank" rel="noopener noreferrer">PECTAA official class-wise eBooks / textbooks</a>');
    links.push('<a href="https://pef.edu.pk/ADU/Downloads" target="_blank" rel="noopener noreferrer">PEF 2026–27 content lists & model papers</a>');
  }
  const ranked=materials.slice().sort((a,b)=>{
    const relevance=x=>/^pef-content-(primary|middle)-2026-27$/.test(x.id||'')?5:
      /^pef-qat-model-2026-27-grade-/.test(x.id||'')?4:
      /^pectaa-book-search-/.test(x.id||'')?3:
      /^pectaa-official-ebooks-grade-/.test(x.id||'')?2:1;
    return relevance(b)-relevance(a);
  });
  for(const x of ranked.slice(0,4)){const u=x.fileUrl||x.url;if(urlAllowed(u))links.push('<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a>')}
  holder.innerHTML='<strong>Official syllabus / textbook sources:</strong> '+(links.length?links.join(' · '):'No official source mapped')+'<br>Check the latest edition, board scheme and actually taught chapters before publishing. Topic names in EduNizam are study references, not a certified copy of an entire textbook.';
}
function updateBankInsight(){
 const el=$('#pbBankInsight');if(!el)return;const cls=$('#pbClass')?.value||'',subject=$('#pbSubject')?.value||'',topics=String($('#pbChapters')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!cls||!subject){el.textContent='Choose class and subject to see available teacher + EduNizam question-bank depth.';return}
 const ownCounts=['mcq','short','long'].map(t=>[t,customPool(cls,subject,topics,t,'Balanced').length]);
 const coreCounts=['mcq','short','long'].map(t=>[t,bankPool(cls,subject,topics,t,'Balanced').length]);
 el.innerHTML='<strong>Your reusable bank:</strong> '+ownCounts.map(x=>x[0].toUpperCase()+' '+x[1]).join(' · ')+'<br><strong>EduNizam concept-practice bank:</strong> '+coreCounts.map(x=>x[0].toUpperCase()+' '+x[1]).join(' · ')+(topics.length?' · topic filter applied':'')+'.';
}
async function render(){
 const root=$('#paperBuilderApp');if(!root)return;
 if(!['teacher','head'].includes(role())){root.innerHTML='<div class="empty-state">Paper Builder is for teachers and Admin review.</div>';return}
 await loadTeacherDefaults();
 root.innerHTML='<article class="card no-print"><div class="section-head"><div><h3>⚡ Smart Paper Builder</h3><p class="muted">Your verified teacher question bank is prioritized, then EduNizam concept practice. Current textbook editions and chapter coverage must be checked; missing content blocks paper generation.</p></div><span class="academic-pill">Teacher Review Required</span></div><div class="paper-presets"><button type="button" class="secondary" data-preset="quiz">Quick Quiz · 20</button><button type="button" class="secondary" data-preset="monthly">Monthly · 50</button><button type="button" class="secondary" data-preset="term">Term · 100</button></div><div class="form-grid"><input id="pbTitle" placeholder="Paper title (optional)"><input id="pbClass" list="pbClasses" placeholder="Class / Grade"><datalist id="pbClasses">'+teacherDefaults.classes.map(x=>'<option>'+esc(x)+'</option>').join('')+'<option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option></datalist><input id="pbSubject" list="pbSubjects" placeholder="Subject"><datalist id="pbSubjects">'+teacherDefaults.subjects.map(x=>'<option>'+esc(x)+'</option>').join('')+'<option>English</option><option>Urdu</option><option>Mathematics</option><option>General Science</option><option>Islamiat / Ethics</option><option>Computer Science</option><option>Physics</option><option>Chemistry</option><option>Biology</option><option>Pakistan Studies</option><option>Statistics</option><option>Economics</option></datalist><input id="pbChapters" placeholder="Selected chapters (comma separated)"><select id="pbChapterPicker" aria-label="Add syllabus chapter"><option value="">Choose a class + subject to load chapters</option></select><select id="pbBookBoard" aria-label="Curriculum authority"><option value="punjab-pectaa">Punjab · PECTAA</option><option value="federal-fbise">Federal · FBISE</option><option value="sindh-stbb">Sindh · STBB</option><option value="kp-dcte-kptbb">KP · Textbook Board</option><option value="balochistan-btbb">Balochistan · Textbook Board</option></select><input id="pbMarks" type="number" min="10" value="50"><select id="pbDifficulty"><option>Easy</option><option selected>Balanced</option><option>Challenging</option></select><select id="pbDistribution"><option>Balanced</option><option>Objective Heavy</option><option>Subjective Heavy</option></select><label class="coverage-note"><input id="pbAdmin" type="checkbox"> Show to Admin</label><button id="pbGenerate">Generate Exam Paper</button></div><div id="pbCurriculumSources" class="coverage-note">Select class, subject and textbook board to open official curriculum sources.</div><div id="pbBankInsight" class="coverage-note">Choose class and subject to see available teacher + EduNizam question-bank depth.</div><p class="coverage-note">Only generate from chapters taught in the current syllabus. Built-in questions are not official board textbook extracts. Review the answer key and every question.</p></article>'+
 '<article class="card no-print" id="questionBankManager"><div class="section-head"><div><h3>Reusable Teacher Question Bank</h3><p class="muted">Add verified questions once and reuse them automatically in future papers.</p></div><span id="qbCount" class="badge">0 questions</span></div><div class="form-grid"><input id="qbClass" list="pbClasses" placeholder="Class / Grade"><input id="qbSubject" list="pbSubjects" placeholder="Subject"><input id="qbChapter" list="pbTeacherChapters" placeholder="Chapter / Topic (required)"><datalist id="pbTeacherChapters"></datalist><select id="qbType"><option value="mcq">MCQ</option><option value="short">Short</option><option value="long">Long</option></select><select id="qbDifficulty"><option>Easy</option><option selected>Balanced</option><option>Challenging</option></select><textarea id="qbQuestion" rows="3" placeholder="Question text"></textarea><textarea id="qbAnswer" rows="2" placeholder="Answer / marking guide"></textarea><textarea id="qbOptions" rows="4" placeholder="MCQ options — one per line"></textarea><input id="qbCorrect" type="number" min="1" value="1" placeholder="Correct option number"><label class="coverage-note"><input id="qbAdmin" type="checkbox"> Share this question with Admin</label><button id="qbSave">Add to Question Bank</button><button id="qbCancelEdit" class="secondary hidden" type="button">Cancel Edit</button></div><input id="qbSearch" class="no-print" type="search" placeholder="Search reusable questions" style="width:100%;margin-top:12px"><div id="qbList" class="paper-grid" style="margin-top:12px"></div></article>'+
 '<div class="section-head no-print"><div><h3>My / Shared Papers</h3><p class="muted">Search, reopen, clone or review saved papers.</p></div><span id="pbSavedCount" class="badge">0 papers</span></div><div class="form-grid no-print"><input id="pbSavedSearch" type="search" placeholder="Search saved papers"><input id="pbSavedClass" placeholder="Filter class"></div><div id="savedTeacherPapers" class="paper-grid no-print" style="margin-top:12px"></div><div id="paperPreview" style="margin-top:16px"></div>';
 $('#pbGenerate').onclick=savePaper;all('[data-preset]').forEach(b=>b.onclick=()=>{applyPreset(b.dataset.preset);updateBankInsight()});
  ['#pbClass','#pbSubject'].forEach(s=>$(s)?.addEventListener('input',()=>{refreshPaperCatalog();updateBankInsight()}));
  $('#pbChapters')?.addEventListener('input',updateBankInsight);
  ['#qbClass','#qbSubject'].forEach(s=>$(s)?.addEventListener('input',refreshTeacherQuestionCatalog));
  $('#pbBookBoard')?.addEventListener('change',refreshPaperCatalog);
  $('#pbChapterPicker')?.addEventListener('change',e=>{const value=e.target.value;if(!value)return;const el=$('#pbChapters');const chosen=el.value.split(',').map(x=>x.trim()).filter(Boolean);if(!chosen.includes(value))chosen.push(value);el.value=chosen.join(', ');e.target.value='';updateBankInsight()});
  refreshPaperCatalog();refreshTeacherQuestionCatalog();
 $('#qbSave').onclick=saveCustomQuestion;$('#qbCancelEdit').onclick=clearQuestionForm;$('#qbSearch').addEventListener('input',renderQuestionBankList);
 $('#qbType').addEventListener('change',()=>{const mcq=$('#qbType').value==='mcq';$('#qbOptions').disabled=!mcq;$('#qbCorrect').disabled=!mcq});
 let timer;$('#pbSavedSearch').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadPapers,180)});$('#pbSavedClass').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadPapers,180)});
 await loadCustomQuestions();updateBankInsight();loadPapers();
}
window.EDUNIZAM_PAPER_BUILDER={render,build};if(document.readyState!=='loading')render();else document.addEventListener('DOMContentLoaded',render);
})();