(function(){
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const cloud=()=>window.EDUNIZAM_CLOUD,cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{},settings=()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}},role=()=>{let r;try{r=JSON.parse(localStorage.getItem('edunizam_session')||'{}').role}catch{}return r==='admin'?'head':r||'student'},ready=()=>!!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId);
let current=null,currentRow=null,teacherDefaults={classes:[],subjects:[]},customQuestions=[],editingQuestionId='',pendingImportRows=[],importBusy=false;
let schoolCatalog={classes:[],units:[],classState:'unchecked',unitState:'unchecked'},schoolCatalogBusy=false,catalogScope='',questionScope='';
const currentSchoolScope=()=>String(cfg().institutionId||'')+'|'+String(cloud()?.state?.user?.id||'');
function schoolChapters(cls,subject,sourceUnits=null){
 if(sourceUnits===null)sourceUnits=ready()&&catalogScope!==currentSchoolScope()?[]:schoolCatalog.units;
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!A||!cls||!subject)return[];
 const found=new Map();
 for(const row of Array.isArray(sourceUnits)?sourceUnits:[]){
  if(!A.sameClass(row.class_name,cls)||A.normalizeSubject(row.subject)!==A.normalizeSubject(subject))continue;
  const value=String(row.unit_title||'').trim(),key=value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
  if(key&&!found.has(key))found.set(key,value);
 }
 return [...found.values()];
}
function renderSchoolStatus(){
 const el=$('#pbSchoolCatalogStatus');if(!el)return;
 const classNote=schoolCatalog.classState==='loaded'
  ?schoolCatalog.classes.length+' active class/section record(s)'+(schoolCatalog.classes.length?'':' — configure Academic Groups'):
   schoolCatalog.classState==='error'?'class lookup unavailable (network/access)':'class data not yet checked';
 const unitNote=schoolCatalog.unitState==='loaded'
  ?schoolCatalog.units.length+' saved syllabus unit(s) · '+schoolCatalog.units.filter(x=>x.textbook_title&&x.curriculum_board).length+' mapped to school-entered textbook/board'+(schoolCatalog.units.length?'':' — add genuine textbook chapters in Lesson / Syllabus'):
   schoolCatalog.unitState==='error'?'syllabus lookup unavailable (network/access)':'syllabus data not yet checked';
 el.textContent='School data: '+classNote+'; '+unitNote+'. School-saved units are separate from generic concept topics; a saved title does not certify textbook accuracy.';
}
async function loadSchoolCatalog(){
 if(!ready()||schoolCatalogBusy)return;
 const client=cloud().state.client,inst=cfg().institutionId,scope=currentSchoolScope();
 if(catalogScope&&catalogScope!==scope)schoolCatalog={classes:[],units:[],classState:'unchecked',unitState:'unchecked'};
 catalogScope=scope;schoolCatalogBusy=true;
 const button=$('#pbSchoolRefresh');if(button)button.disabled=true;
 async function read(table,columns,maxRows){
  let timer,controller=typeof AbortController==='function'?new AbortController():null;
  try{
   let query=client.from(table).select(columns).eq('institution_id',inst).limit(maxRows);
   if(controller&&typeof query.abortSignal==='function')query=query.abortSignal(controller.signal);
   const result=await Promise.race([query,new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Error('Data lookup timeout'))},6500)})]);
   if(result?.error)throw result.error;
   return{rows:Array.isArray(result.data)?result.data:[],state:'loaded'};
  }catch(error){console.warn('Paper Builder school data:',table,error?.message||error);return{rows:[],state:'error'}}
  finally{clearTimeout(timer)}
 }
 try{
  const [classes,units]=await Promise.all([
   read('class_sections','class_name,section_name,active',250),
   read('syllabus_progress_units','class_name,subject,unit_title,status,textbook_title,curriculum_board,edition_year,source_url',750)
  ]);
  if(currentSchoolScope()!==scope)return;
  schoolCatalog={
   classes:classes.rows.filter(x=>x.active!==false&&String(x.class_name||'').trim()),
   units:units.rows.filter(x=>String(x.class_name||'').trim()&&String(x.subject||'').trim()&&String(x.unit_title||'').trim()),
   classState:classes.state,unitState:units.state
  };
  refreshPaperCatalog();refreshTeacherQuestionCatalog();
 }finally{
  schoolCatalogBusy=false;
  if(button?.isConnected)button.disabled=false;
  renderSchoolStatus();
 }
}

async function loadTeacherDefaults(){if(!ready()||role()!=='teacher')return;const {data}=await cloud().state.client.from('staff_profiles').select('classes,subjects').eq('institution_id',cfg().institutionId).eq('user_id',cloud().state.user.id).maybeSingle();teacherDefaults={classes:data?.classes||[],subjects:data?.subjects||[]}}
async function loadCustomQuestions(){
 if(!ready()){customQuestions=[];questionScope='';return[]}
 const scope=currentSchoolScope(),inst=cfg().institutionId,client=cloud().state.client;
 if(questionScope!==scope){customQuestions=[];questionScope='';editingQuestionId='';pendingImportRows=[]}
 const {data,error}=await client.from('teacher_question_bank').select('*').eq('institution_id',inst).order('created_at',{ascending:false}).limit(500);
 if(!ready()||currentSchoolScope()!==scope)return[];
 if(error){console.warn('Question bank:',error.message||error);customQuestions=[];questionScope='';return[]}
 customQuestions=Array.isArray(data)?data:[];questionScope=scope;
 renderQuestionBankList();refreshPaperCatalog();refreshTeacherQuestionCatalog();updateBankInsight();return customQuestions;
}
function sameChapter(selected,actual){
 const api=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(api?.chapterMatches)return api.chapterMatches(selected,actual);
 const norm=x=>String(x||'').normalize('NFKC').trim().toLowerCase().replace(/\\s+/g,' ');
 return !!norm(actual)&&norm(selected)===norm(actual);
}
function customPool(cls,subject,topics,type,diff){
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!A||(ready()&&questionScope!==currentSchoolScope()))return[];
 const selected=(topics||[]).map(x=>String(x).trim()).filter(Boolean);
 return shuffled(customQuestions.filter(q=>selected.some(ch=>A.matchesTeacher(q,cls,subject,ch,type,diff))));
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
 const type=$('#qbType')?.value||'short',options=String($('#qbOptions')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),rawCorrect=String($('#qbCorrect')?.value??'').trim();
 // An empty, zero, fractional or out-of-range answer must not default to A.
 const correct=/^[1-4]$/.test(rawCorrect)?Number(rawCorrect)-1:-1;
 return{className:$('#qbClass')?.value.trim()||'',subject:$('#qbSubject')?.value.trim()||'',chapter:$('#qbChapter')?.value.trim()||'',type,difficulty:$('#qbDifficulty')?.value||'Balanced',question:$('#qbQuestion')?.value.trim()||'',answer:$('#qbAnswer')?.value.trim()||'',options,correct,visibility:$('#qbAdmin')?.checked?'admin':'private'};
}
async function saveCustomQuestion(){
 if(!ready())return alert('Cloud login required.');
 const v=questionFormValues();if(!v.className||!v.subject||!v.chapter||!v.question)return alert('Class, subject, chapter and question required.');
 const chapterGate=schoolPaperReadiness(v.className,v.subject,[v.chapter]);
 if(!chapterGate.allowed)return alert('Question bank requires a recorded, book-mapped school chapter: '+chapterGate.reason);
  if(v.type!=='mcq'&&!v.answer)return alert('Written questions require a marking guide / model answer.');
 if(v.type==='mcq'&&(v.options.length!==4||new Set(v.options.map(x=>x.toLowerCase())).size!==4||v.correct<0||v.correct>=4))return alert('MCQ ke liye exactly 4 different options aur valid answer number (1–4) required hain.');
 const questionSaveScope=currentSchoolScope();
 const payload={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,class_name:v.className,subject:normalizedSubject(v.subject),chapter:v.chapter||null,question_type:v.type,difficulty:v.difficulty,question_text:v.question,options:v.type==='mcq'?v.options:[],correct_option:v.type==='mcq'?v.correct:null,answer_text:v.answer||null,visibility:v.visibility,active:true,updated_at:new Date().toISOString()};
 let error;
 if(editingQuestionId){
   ({error}=await cloud().state.client.from('teacher_question_bank').update(payload).eq('id',editingQuestionId).eq('creator_user_id',cloud().state.user.id));
 }else{
   ({error}=await cloud().state.client.from('teacher_question_bank').insert(payload));
 }
 if(questionSaveScope!==currentSchoolScope())return;
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
function downloadQuestionTemplate(){
 const template=window.EDUNIZAM_QUESTION_IMPORT?.template;
 if(!template)return alert('Question import template is unavailable. Reload the Paper Builder.');
 const data=new Blob([String.fromCharCode(0xFEFF)+template],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(data),a=document.createElement('a');
 a.href=url;a.download='edunizam-question-bank-template.csv';a.style.display='none';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function previewQuestionImport(){
 const file=$('#qbImportFile')?.files?.[0],report=$('#qbImportReport'),save=$('#qbImportSave');
 pendingImportRows=[];if(save)save.disabled=true;
 if(!file){if(report)report.textContent='Choose a CSV/JSON file first.';return}
 if(file.size>1048576){if(report)report.textContent='File must be under 1 MB.';return}
 try{
  const processor=window.EDUNIZAM_QUESTION_IMPORT;
  if(!processor)throw Error('Question import validator unavailable; reload this page.');
  const results=processor.prepare(await file.text(),file.name,customQuestions);
  const summary='Checked '+results.total+' rows · '+results.valid.length+' new valid · '+results.duplicates+' duplicates · '+results.errors.length+' errors.';
  if(report)report.textContent=summary+(results.errors.length?' First errors: '+results.errors.slice(0,7).join(' | '):' Ready to import.');
  if(results.errors.length)return;
  pendingImportRows=results.valid;
  if(save)save.disabled=!pendingImportRows.length;
 }catch(error){if(report)report.textContent='Validation failed: '+(error.message||error)}
}
async function saveQuestionImport(){
 const button=$('#qbImportSave'),report=$('#qbImportReport');
 if(importBusy||!ready()||!pendingImportRows.length)return;
 const unmapped=pendingImportRows.map((q,i)=>({index:i+1,gate:schoolPaperReadiness(q.class_name,q.subject,[q.chapter])})).filter(x=>!x.gate.allowed);
 if(unmapped.length){
  if(report)report.textContent='Import blocked: '+unmapped.length+' question(s) lack real school textbook-chapter mapping. Row '+unmapped[0].index+': '+unmapped[0].gate.reason;
  return;
 }
 if(!confirm('Import '+pendingImportRows.length+' teacher-supplied questions into this institute? Please verify textbook/chapter alignment and answer keys first.'))return;
 importBusy=true;if(button){button.disabled=true;button.textContent='Importing questions...'}
 const batchSize=25,total=pendingImportRows.length,importScope=currentSchoolScope();let completed=0,failed=null;
 try{
  while(completed<total){
   if(importScope!==currentSchoolScope()){failed={message:'School/account changed during question import.'};break}
   const batch=pendingImportRows.slice(completed,completed+batchSize);
   const owner=cloud().state.user.id,institution=cfg().institutionId;
   const records=batch.map(q=>({...q,institution_id:institution,creator_user_id:owner,updated_at:new Date().toISOString()}));
   const {error}=await cloud().state.client.from('teacher_question_bank').insert(records);
   if(error){failed=error;break}
   completed+=batch.length;
   if(report)report.textContent='Imported '+completed+' of '+total+'...';
  }
  if(importScope!==currentSchoolScope()){pendingImportRows=[];return}
  pendingImportRows=pendingImportRows.slice(completed);
  if(report)report.textContent=completed+' question'+(completed===1?'':'s')+' saved in your institute.'+
   (failed?' Remaining '+pendingImportRows.length+' were not imported: '+(failed.message||failed)+'. Review the problem before retrying.':' Verify the current syllabus and answer keys before using them in exams.');
  await loadCustomQuestions();
  updateBankInsight();
 }catch(error){
  pendingImportRows=pendingImportRows.slice(completed);
  if(report)report.textContent=completed+' saved; '+pendingImportRows.length+' not saved. '+(error.message||error);
 }finally{
  importBusy=false;
  if(button?.isConnected){button.textContent='Import Verified Questions';button.disabled=!pendingImportRows.length}
 }
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
function schoolPaperReadiness(cls,subject,topics,{conceptDraft=false}={}){
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!ready())return{allowed:false,reason:'Verified cloud school login required for saving an exam paper.'};
 if(catalogScope!==currentSchoolScope()||schoolCatalog.classState!=='loaded'||schoolCatalog.unitState!=='loaded')
  return{allowed:false,reason:'Current school class and syllabus records are not verified. Refresh school records and check access.'};
 if(!schoolCatalog.classes.some(row=>row.active!==false&&A?.sameClass?.(row.class_name,cls)))
  return{allowed:false,reason:'Class is not active and registered in the current school. Configure Academic Groups first.'};
 if(!Array.isArray(topics)||!topics.length)return{allowed:false,reason:'Choose exact chapters before saving a paper.'};
 const saved=schoolChapters(cls,subject);
 const norm=x=>String(x||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
 if(saved.length){
  const extra=topics.filter(x=>!saved.some(ch=>norm(ch)===norm(x)));
  if(extra.length)return{allowed:false,reason:'These topics are not recorded for this class/subject in the school syllabus: '+extra.join(', ')+'. Add actual syllabus units or remove reference topics.'};
  const bookless=topics.filter(topic=>!schoolCatalog.units.some(unit=>A?.sameClass?.(unit.class_name,cls)&&A?.normalizeSubject?.(unit.subject)===A?.normalizeSubject?.(subject)&&
    norm(unit.unit_title)===norm(topic)&&String(unit.textbook_title||'').trim()&&String(unit.curriculum_board||'').trim()));
  if(bookless.length)return{allowed:false,reason:'Selected syllabus chapter(s) have no prescribed textbook title and board mapping: '+bookless.join(', ')+'. Add actual book details in Lesson / Syllabus first.'};
  return{allowed:true,mode:'school-recorded',verified:false};
 }
 if(!conceptDraft)return{allowed:false,reason:'No school-recorded syllabus units for this class/subject. Add genuine textbook units or explicitly select Concept-only Draft (private, not verified).'};
 return{allowed:true,mode:'concept-only-draft',verified:false};
}
function bank(s){return banks[s]||banks.General} function fill(x,t){return x.replaceAll('{t}',t)}
function distribute(total,mode){const r=mode==='Objective Heavy'?[.4,.35,.25]:mode==='Subjective Heavy'?[.15,.35,.5]:[.25,.35,.4];let a=Math.max(1,Math.round(total*r[0])),b=Math.max(1,Math.round(total*r[1]));return[a,b,total-a-b]}
function classLevelFrom(v){const m=String(v||'').match(/\b(1[0-2]|[1-9])\b/);return m?Number(m[1]):0}
function normalizedSubject(v){
 const x=String(v||'').trim().toLowerCase();
 const aliases={'science':'General Science','general science':'General Science','islamiyat':'Islamiat / Ethics','islamiat':'Islamiat / Ethics','islamic studies':'Islamiat / Ethics','computer':'Computer Science','computer science':'Computer Science','math':'Mathematics','maths':'Mathematics','mathematics':'Mathematics','pak studies':'Pakistan Studies','pakistan studies':'Pakistan Studies'};
 return aliases[x]||String(v||'').trim();
}
// Textbook providers sometimes use a canonical title while a school chooses
// its locally familiar alias (Math/Mathematics, Islamiyat/Islamiat).
// Slash-delimited subject bundles are supported without substring leakage.
function materialSubjectMatches(requested,listed){
 const choice=String(requested??'').trim();
 if(!choice)return true;
 const subject=String(listed??'').trim();
 if(!subject||subject.toLowerCase()==='all subjects')return subject.toLowerCase()==='all subjects';
 const norm=x=>String(normalizedSubject(x)||'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
 const target=norm(choice);
 if(norm(subject)===target)return true;
 if(subject.includes(' / ')&&norm(subject)!==norm('Islamiat / Ethics')){
  return subject.split(/\s+\/\s+/).some(part=>norm(part)===target);
 }
 return false;
}
function shuffled(arr){return arr.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
function bankPool(cls,subject,topics,type,diff){
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!A)return[];
 const selected=(topics||[]).map(x=>String(x).trim()).filter(Boolean);
 return shuffled((window.EDUNIZAM_PRACTICE_DATA?.questions||[]).filter(q=>selected.some(ch=>A.matchesPractice(q,cls,subject,ch,type,diff))));
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
function build(subject,topics,total,diff,mode,cls='',options={}){
 if(!Number.isInteger(total)||total<10||total>200)throw new Error('Total paper marks must be a whole number between 10 and 200.');
 if(!cls||!String(subject||'').trim()||!Array.isArray(topics)||!topics.length)throw new Error('Select class, subject and at least one chapter.');
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!A)throw new Error('Question quality audit unavailable. Reload the Paper Builder.');
 const marks=distribute(total,mode),sections=[],answers=[],usedQuestionKeys=new Set();let no=1,customUsed=0,bankUsed=0,templateUsed=0;
 const teacherOnly=!!options.teacherOnly;
 const audit=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT?.audit?.({
  className:cls,subject,chapters:topics,teacherQuestions:ready()&&questionScope!==currentSchoolScope()?[]:customQuestions,
  practiceQuestions:window.EDUNIZAM_PRACTICE_DATA?.questions||[],difficulty:diff,teacherOnly
 });
 if(audit?.missingChapters?.length)throw new Error('No '+(teacherOnly?'teacher-bank':'available')+' questions match the EXACT selected chapter: '+audit.missingChapters.join(', ')+'. Add verified questions or remove it.');
 const specs=[['Section A — MCQs','mcq',marks[0],Math.max(5,Math.min(20,marks[0]))],['Section B — Short Questions','short',marks[1],Math.max(2,Math.min(10,Math.ceil(marks[1]/3)))],['Section C — Long Questions','long',marks[2],Math.max(1,Math.min(5,Math.ceil(marks[2]/8)))]];
 specs.forEach(([title,type,sm,n])=>{
  const ownPool=customPool(cls,subject,topics,type,diff),practicePool=teacherOnly?[]:bankPool(cls,subject,topics,type,diff);
  const unique=new Set(usedQuestionKeys),candidates=[];
  for(const [source,pool] of [['teacher',ownPool],['practice',practicePool]]){
   for(const item of pool){
    const key=A.questionKey(item);
    if(!key||unique.has(key))continue;
    unique.add(key);candidates.push({source,item,key});
   }
  }
  const available=candidates.length;
  const required=Math.max(1,Math.ceil(n*.6));
  n=Math.min(n,available);
  const maxMarksPerQuestion=type==='mcq'?2:type==='short'?5:12;
  if(n<required||!n||sm>n*maxMarksPerQuestion)
    throw new Error('Insufficient real unique '+type.toUpperCase()+' questions for '+cls+' / '+subject+(topics.length?' / '+topics.join(', '):'')+': '+available+' usable unique questions; at least '+Math.max(required,Math.ceil(sm/maxMarksPerQuestion))+' needed. Select more exact chapters, reduce marks, or import teacher-verified questions.');
  const points=Array.from({length:n},(_,i)=>Math.floor(sm/n)+(i<sm%n?1:0));
  const qs=[];
  for(let i=0;i<n;i++){
   const chosen=candidates[i],built=chosen.source==='teacher'?fromCustom(chosen.item,type):fromPractice(chosen.item,type);
   usedQuestionKeys.add(chosen.key);
   if(chosen.source==='teacher')customUsed++;else bankUsed++;
   const qno=no++;
   qs.push({no:qno,marks:points[i],text:built.text,answer:built.answer,source:built.source,chapter:built.chapter});
   answers.push({no:qno,marks:points[i],answer:built.answer});
  }
  sections.push({title,marks:sm,questions:qs});
 });
 return {subject,topics,totalMarks:total,difficulty:diff,distribution:mode,className:cls,teacherOnly,sections,answers,sourceStats:{teacherBank:customUsed,practiceBank:bankUsed,templateFallback:templateUsed,total:customUsed+bankUsed+templateUsed}};
}
function header(p,row){const st=settings(),logo=st.schoolLogo?'<img src="'+esc(st.schoolLogo)+'" class="pb-print-logo" alt="">':'';return (p.curriculumMode==='school-recorded'?'':'<p class="coverage-note"><strong>CONCEPT PRACTICE DRAFT — NOT A VERIFIED SCHOOL EXAM</strong></p>')+'<div class="pb-paper-head">'+logo+'<div><h1>'+esc(st.schoolName||'EduNizam Institute')+'</h1><p>'+esc(st.schoolType||'Educational Institute')+(st.session?' · '+esc(st.session):'')+'</p></div></div><div class="pb-meta"><span><b>Paper:</b> '+esc(row?.title||$('#pbTitle')?.value||p.subject+' Paper')+'</span><span><b>Class:</b> '+esc(row?.class_name||$('#pbClass')?.value||'')+'</span><span><b>Subject:</b> '+esc(p.subject)+'</span><span><b>Marks:</b> '+p.totalMarks+'</span><span><b>Difficulty:</b> '+esc(p.difficulty)+'</span></div><div class="pb-student-line">Name: ____________________ &nbsp; Roll No: __________ &nbsp; Date: __________</div>'}
function paperHtml(p,row,editable=false){return '<div class="pb-print-sheet">'+header(p,row)+p.sections.map((s,si)=>'<section class="pb-section"><h3>'+esc(s.title)+' <span>'+s.marks+' Marks</span></h3>'+s.questions.map((q,qi)=>'<div class="pb-question"><b>Q'+q.no+'.</b> '+(Number(q.marks)>0?'<small>('+Number(q.marks)+' mark'+(Number(q.marks)===1?'':'s')+')</small> ':'')+(editable?'<textarea data-q="'+si+':'+qi+'">'+esc(q.text)+'</textarea>':esc(q.text))+'</div>').join('')+'</section>').join('')+'</div>'}
function keyHtml(p){return '<div class="pb-answer-key"><h2>Teacher Answer Key / Marking Guide</h2>'+p.answers.map(a=>'<p><b>Q'+a.no+'.</b> '+esc(a.answer)+'</p>').join('')+'</div>'}
function syncEdits(){if(!current)return;all('[data-q]').forEach(x=>{const [s,q]=x.dataset.q.split(':').map(Number);current.sections[s].questions[q].text=x.value})}
function applyPreset(v){const p={quiz:[20,'Easy','Objective Heavy'],monthly:[50,'Balanced','Balanced'],term:[100,'Balanced','Subjective Heavy']}[v];if(!p)return;$('#pbMarks').value=p[0];$('#pbDifficulty').value=p[1];$('#pbDistribution').value=p[2]}
async function clonePaper(row){
 $('#pbTitle').value=(row.title||row.subject+' Paper')+' — Copy';
 $('#pbClass').value=row.class_name;refreshPaperCatalog();
 $('#pbSubject').value=normalizedSubject(row.subject);refreshPaperCatalog();
 $('#pbChapters').value=(row.chapters||[]).join(', ');renderSelectedChapters();
 $('#pbMarks').value=row.total_marks;$('#pbDifficulty').value=row.difficulty||'Balanced';
 current=JSON.parse(JSON.stringify(row.paper_json||{}));currentRow=null;showEditor();
 window.scrollTo({top:0,behavior:'smooth'});
}
async function savePaper(){
 if(!ready())return alert('Cloud login required.');
 const subject=$('#pbSubject')?.value?.trim()||'',cls=$('#pbClass')?.value?.trim()||'',
  topics=String($('#pbChapters')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  total=Number($('#pbMarks')?.value||50),difficulty=$('#pbDifficulty')?.value||'Balanced',
  mode=$('#pbDistribution')?.value||'Balanced';
 if(!subject||!cls||!topics.length)return alert('Choose a class, subject and at least one exact topic.');
 const gate=schoolPaperReadiness(cls,subject,topics,{conceptDraft:!!$('#pbConceptDraft')?.checked});
 if(!gate.allowed)return alert(gate.reason);
 try{current=build(subject,topics,total,difficulty,mode,cls,{teacherOnly:!!$('#pbTeacherOnly')?.checked})}
 catch(error){return alert(error.message||'Question bank coverage is insufficient.')}
 current.curriculumMode=gate.mode;current.textbookVerified=false;
 const title=$('#pbTitle')?.value?.trim()||subject+' Paper';
 const payload={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,
  title,class_name:cls,subject,chapters:topics,total_marks:total,difficulty,paper_json:current,
  visibility:gate.mode==='concept-only-draft'?'private':($('#pbAdmin')?.checked?'admin':'private')};
 const scope=currentSchoolScope(),{data,error}=await cloud().state.client.from('teacher_papers').insert(payload).select().single();
 if(scope!==currentSchoolScope())return;
 if(error)return alert(error.message);
 currentRow=data;showEditor();loadPapers();
 window.EDUNIZAM_PREMIUM?.toast?.('Paper draft saved. Verify the current book, questions and answer key.','success');
}
function previewPaper(){
 const cls=$('#pbClass')?.value?.trim()||'',subject=$('#pbSubject')?.value?.trim()||'',
  topics=String($('#pbChapters')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  total=Number($('#pbMarks')?.value),difficulty=$('#pbDifficulty')?.value||'Balanced',
  pattern=$('#pbDistribution')?.value||'Balanced',concept=!!$('#pbConceptDraft')?.checked,
  status=$('#pbGenerationStatus');
 const fail=reason=>{if(status)status.textContent=reason;return{ready:false,reason}};
 if(!cls||!subject)return fail('Select class and subject from the dropdowns.');
 if(!topics.length)return fail('Select at least one chapter from the dropdown.');
 if(!Number.isInteger(total)||total<10||total>200)return fail('Enter total marks between 10 and 200.');
 if(!concept){
  const gate=schoolPaperReadiness(cls,subject,topics);
  if(!gate.allowed)return fail('School paper unavailable: '+gate.reason+' Choose Practice / concept preview without school setup.');
 }
 let paper;
 try{paper=build(subject,topics,total,difficulty,pattern,cls,{teacherOnly:!!$('#pbTeacherOnly')?.checked})}
 catch(e){return fail('Not enough matching questions for this marks/pattern choice: '+String(e?.message||e))}
 current=paper;currentRow=null;current.curriculumMode=concept?'concept-only-draft':'school-recorded';current.textbookVerified=false;
 showEditor();
 if(status)status.textContent='Preview generated: '+total+' marks · '+pattern+'. '+(concept?'This is NOT a verified school exam.':'School-recorded chapters; teacher review required.');
 $('#paperPreview')?.scrollIntoView?.({behavior:'smooth',block:'start'});
 return{ready:true,mode:current.curriculumMode,total};
}
async function saveCurrentAsNew(){
 if(!ready()||!current)return alert('Cloud login and preview required.');
 syncEdits();
 const subject=$('#pbSubject')?.value?.trim()||'',cls=$('#pbClass')?.value?.trim()||'',
  topics=String($('#pbChapters')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  total=Number($('#pbMarks')?.value||current.totalMarks||50),difficulty=$('#pbDifficulty')?.value||'Balanced',
  title=$('#pbTitle')?.value?.trim()||subject+' Paper';
 const gate=schoolPaperReadiness(cls,subject,topics,{conceptDraft:!!$('#pbConceptDraft')?.checked});
 if(!gate.allowed)return alert(gate.reason);
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!A?.sameClass?.(current.className,cls)||A.normalizeSubject(current.subject)!==A.normalizeSubject(subject)||
  current.topics?.length!==topics.length||topics.some(x=>!current.topics.some(y=>A.chapterMatches(x,y)))||
  current.totalMarks!==total)return alert('Paper fields changed after preview. Generate a fresh paper before saving a copy.');
 current.curriculumMode=gate.mode;current.textbookVerified=false;
 const payload={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,
  title,class_name:cls,subject,chapters:topics,total_marks:total,difficulty,paper_json:current,
  visibility:gate.mode==='concept-only-draft'?'private':($('#pbAdmin')?.checked?'admin':'private')};
 const scope=currentSchoolScope(),{data,error}=await cloud().state.client.from('teacher_papers').insert(payload).select().single();
 if(scope!==currentSchoolScope())return;
 if(error)return alert(error.message);
 currentRow=data;showEditor();loadPapers();
 window.EDUNIZAM_PREMIUM?.toast?.('Paper copy saved as new, teacher review required.','success');
}
function showEditor(){
 const el=$('#paperPreview');if(!el||!current)return;
 const ss=current.sourceStats||{},uid=String(cloud()?.state?.user?.id||''),ownRow=!!currentRow&&String(currentRow.creator_user_id||'')===uid;
 const syllabusNote='<div class="coverage-note"><strong>Curriculum status:</strong> '+(current.curriculumMode==='school-recorded'?'School-recorded chapter names — textbook edition and answer keys NOT verified.':'Unverified concept-only or legacy draft. Check textbook alignment before using in a school examination.')+'</div>';
  const sourceNote=ss.total?'<div class="coverage-note"><strong>Question source:</strong> '+(ss.teacherBank||0)+' teacher-bank · '+(ss.practiceBank||0)+' EduNizam curriculum-bank · '+(ss.templateFallback||0)+' template fallback. Teacher verification remains required.</div>':'';
 const saveGate=!currentRow?schoolPaperReadiness(current.className,current.subject,current.topics||[],{conceptDraft:current.curriculumMode==='concept-only-draft'}):null;
 const saveAllowed=!!saveGate?.allowed;
 const saveAction=currentRow?(ownRow?'<button id="pbSaveEdits">Save Changes</button>':''):
  (saveAllowed?'<button id="pbSaveAsNew">Save to School (Draft)</button>':
   '<span class="coverage-note">Preview/print only. School saving requires an active registered class, prescribed syllabus and verified cloud login.</span><button type="button" class="secondary" id="pbSetupClasses">Set Up Classes</button>');
 const readOnly=currentRow&&!ownRow?'<div class="coverage-note"><strong>Admin review:</strong> This paper is shared by its creator. You can review, print, view the answer key or clone it; the original remains read-only.</div>':'';
 el.innerHTML='<div class="section-head no-print"><div><h3>Paper Preview & Editor</h3><p class="muted">'+(currentRow&&!ownRow?'Shared paper review mode.':'Question text edit karein, then save or print.')+'</p></div><div class="paper-actions">'+saveAction+'<button id="pbPrint" class="secondary">Print A4</button><button id="pbKey" class="secondary">Answer Key</button></div></div>'+readOnly+syllabusNote+sourceNote+paperHtml(current,currentRow,!(currentRow&&!ownRow))+'<div id="pbKeyWrap" class="hidden">'+keyHtml(current)+'</div>';
 if($('#pbSaveEdits'))$('#pbSaveEdits').onclick=updatePaper;if($('#pbSaveAsNew'))$('#pbSaveAsNew').onclick=saveCurrentAsNew;
 if($('#pbSetupClasses'))$('#pbSetupClasses').onclick=()=>window.EDUNIZAM_APP_NAV?.setView?.('classcenter');
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
function chapterChoices(cls,subject,sourceQuestions=null,sourceUnits=null){
 if(sourceQuestions===null)sourceQuestions=ready()&&questionScope!==currentSchoolScope()?[]:customQuestions;
 if(sourceUnits===null)sourceUnits=ready()&&catalogScope!==currentSchoolScope()?[]:schoolCatalog.units;
 const grade=classLevelFrom(cls),key=normalizedSubject(subject);
 const D=window.EDUNIZAM_PRACTICE_DATA||{},A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 const results=new Map();
 const add=text=>{const value=String(text||'').trim(),n=value.normalize('NFKC').toLowerCase().replace(/\\s+/g,' ');if(value&&!results.has(n))results.set(n,value)};
 schoolChapters(cls,subject,sourceUnits).forEach(add);
 (D.chapters?.[grade+'|'+key]||[]).forEach(add);
 if(A){
  (sourceQuestions||[]).filter(q=>q.active!==false&&A.sameClass(q.class_name,cls)&&A.normalizeSubject(q.subject)===A.normalizeSubject(subject)&&A.usable(q,q.question_type,true))
   .forEach(q=>add(q.chapter));
 }
 return [...results.values()];
}
function renderSelectedChapters(){
 const field=$('#pbChapters'),holder=$('#pbSelectedChapters');if(!field||!holder)return;
 const raw=[...new Set(String(field.value||'').split(',').map(x=>x.trim()).filter(Boolean))];
 const possible=new Set(chapterChoices($('#pbClass')?.value||'',$('#pbSubject')?.value||''));
 const selected=raw.filter(x=>possible.has(x));
 field.value=selected.join(', ');
 holder.innerHTML=selected.length?'<strong>Selected chapters ('+selected.length+'):</strong> '+selected.map((chapter,i)=>
  '<button type="button" class="secondary" data-pb-remove="'+i+'" title="Remove chapter">'+esc(chapter)+' ×</button>').join(' '):
  'No chapters selected. Choose one or more from the dropdown.';
 holder.querySelectorAll('[data-pb-remove]').forEach(b=>b.onclick=()=>{
  field.value=selected.filter((_,i)=>i!==Number(b.dataset.pbRemove)).join(', ');
  renderSelectedChapters();updateBankInsight();
 });
}
function refreshTeacherQuestionCatalog(){
  const cl=$('#qbClass')?.value||'',sub=$('#qbSubject')?.value||'',level=classLevelFrom(cl),
    D=window.EDUNIZAM_PRACTICE_DATA||{},chapters=chapterChoices(cl,sub);
  const el=$('#pbTeacherChapters');
  if(el)el.innerHTML=chapters.map(x=>'<option value="'+esc(x)+'"></option>').join('');
}
function refreshPaperCatalog(){
  const classSelect=$('#pbClass'),cl=classSelect?.value||'',lv=classLevelFrom(cl),D=window.EDUNIZAM_PRACTICE_DATA||{},A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
  const configured=schoolCatalog.classes.map(x=>String(x.class_name||'').trim());
  const allClasses=[...new Set([...Array.from({length:12},(_,i)=>String(i+1)),...configured,...teacherDefaults.classes])].filter(Boolean);
  const classList=$('#pbClasses');
  if(classList)classList.innerHTML=allClasses.map(x=>'<option value="'+esc(x)+'"></option>').join('');
  if(classSelect){
   const previous=classSelect.value;
   classSelect.innerHTML='<option value="">Select Class / Grade</option>'+allClasses.map(x=>'<option value="'+esc(x)+'">'+esc(/^(?:(?:class|grade)\s*)?\d+$/i.test(x)?'Class '+classLevelFrom(x):x)+'</option>').join('');
   classSelect.value=allClasses.includes(previous)?previous:(allClasses.includes(String(classLevelFrom(previous)))?String(classLevelFrom(previous)):'');
  }
  const subjectSelect=$('#pbSubject'),previousSubject=String(subjectSelect?.value||''),baseSubjects=D.subjects?.[lv]||[];
  const catalogSubjects=window.EDUNIZAM_ACADEMIC_OPTION_CATALOG?.subjects?.[String(lv)]||[];
  const common=['English','Urdu','Mathematics','General Science','General Knowledge','Social Studies','Islamiat / Ethics','Nazra Quran','Computer Science'];
  const imported=customQuestions.filter(q=>q.active!==false&&A?.sameClass(q.class_name,cl)).map(q=>q.subject).filter(Boolean);
  const savedSubjects=schoolCatalog.units.filter(x=>A?.sameClass(x.class_name,cl)).map(x=>x.subject);
  const source=cl?[...baseSubjects,...catalogSubjects,...teacherDefaults.subjects,...imported,...savedSubjects]:[];
  if(cl&&!source.length)source.push(...common);
  const found=new Map();
  for(const item of source){
   const canonical=normalizedSubject(item),key=A?.normalizeSubject?.(canonical)||canonical.toLowerCase();
   if(canonical&&!found.has(key))found.set(key,canonical);
  }
  const subjects=[...found.values()],subjectList=$('#pbSubjects');
  if(subjectList)subjectList.innerHTML=subjects.map(x=>'<option value="'+esc(x)+'"></option>').join('');
  if(subjectSelect){
   subjectSelect.innerHTML='<option value="">'+(cl?'Select Subject':'Select Class First')+'</option>'+subjects.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
   subjectSelect.disabled=!cl;
   subjectSelect.value=subjects.includes(previousSubject)?previousSubject:'';
  }
  const sub=subjectSelect?.value||'';
  const chapters=chapterChoices(cl,sub);
  const picker=$('#pbChapterPicker');
  if(picker){
   const school=schoolChapters(cl,sub),saved=new Set(school.map(x=>x.normalize('NFKC').trim().toLowerCase()));
   const other=chapters.filter(x=>!saved.has(x.normalize('NFKC').trim().toLowerCase()));
   picker.innerHTML='<option value="">'+(chapters.length?'Add chapter / topic ('+chapters.length+' indexed)':'No indexed chapters — add saved syllabus units or reviewed questions')+'</option>'+
    (school.length?'<optgroup label="School-recorded syllabus units">'+school.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</optgroup>':'')+
    (other.length?'<optgroup label="Concept topics / teacher bank (verify textbook)">'+other.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</optgroup>':'');
   picker.disabled=!chapters.length;
  }
  renderSelectedChapters();
  const holder=$('#pbCurriculumSources'),id=$('#pbBookBoard')?.value||'punjab-pectaa',R=window.EDUNIZAM_CURRICULUM_REGISTRY||{};
  if(!holder)return;
  const auth=(R.authorities||[]).find(x=>x.id===id);
  const authorityMatches=x=>(x.authorityId==='national-ncc'&&lv>=9&&lv<=12)||x.authorityId===id||
    (id==='punjab-pectaa'&&/punjab|pectaa|pef/i.test(x.board||''))||
    (id==='federal-fbise'&&/fbise|federal/i.test(x.board||''))||
    (id==='sindh-stbb'&&/sindh|stbb/i.test(x.board||''))||
    (id==='kp-dcte-kptbb'&&/khyber|kp |kptbb/i.test(x.board||''))||
    (id==='balochistan-btbb'&&/balochistan|btbb/i.test(x.board||''));
  const materials=(window.EDUNIZAM_STUDY_DATA?.materials||[]).filter(x=>x.source==='official'&&authorityMatches(x)&&(!lv||(x.classLevels||[]).map(Number).includes(lv))&&materialSubjectMatches(sub,x.subject));
  const urlAllowed=u=>{try{return /^https?:$/.test(new URL(u).protocol)}catch{return false}};
  const links=[];
  if(auth&&urlAllowed(auth.officialUrl))links.push('<a href="'+esc(auth.officialUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(auth.name)+' — curriculum / textbooks</a>');
  if(id==='punjab-pectaa'){
    links.push('<a href="https://pectaa.edu.pk/books-and-publications/" target="_blank" rel="noopener noreferrer">PECTAA official class-wise eBooks / textbooks</a>');
    links.push('<a href="https://pef.edu.pk/ADU/Downloads" target="_blank" rel="noopener noreferrer">PEF 2026–27 content lists & model papers</a>');
  }
  const ranked=materials.slice().sort((a,b)=>{
    const relevance=x=>/^pectaa-direct-secondary-/.test(x.id||'')?11:
      /^pectaa-direct-core-g/.test(x.id||'')?10:
      /^pectaa-quran-textbook-directory-/.test(x.id||'')?10:
      /^ncc-2026-rationalized-/.test(x.id||'')?9:
      /^pef-secondary-content-book-2026-27$/.test(x.id||'')?8:
      /^fbise-slo-model-/.test(x.id||'')?7:
      /^pectaa-current-books-/.test(x.id||'')?6:
      /^pef-content-(primary|middle)-2026-27$/.test(x.id||'')?5:
      /^pef-qat-model-2026-27-grade-/.test(x.id||'')?4:
      /^pectaa-book-search-/.test(x.id||'')?3:
      /^pectaa-official-ebooks-grade-/.test(x.id||'')?2:1;
    return relevance(b)-relevance(a);
  });
  for(const x of ranked.slice(0,4)){const u=x.fileUrl||x.url;if(urlAllowed(u))links.push('<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a>')}
  holder.innerHTML='<strong>Official syllabus / textbook sources (verify applicable board and current book):</strong> '+(links.length?links.join(' · '):'No official source mapped')+'<br>Check the latest edition, board scheme and actually taught chapters before publishing. Topic names in EduNizam are study references, not a certified copy of an entire textbook.';
}
/* Recommend only question-covered chapters. If this school has saved syllabus
 * units, never silently substitute reference chapters outside those units.
 * Structural draft readiness is NOT current-textbook certification. */
function recommendPaperChapters(cls,subject,total,difficulty='Balanced',distribution='Balanced',options={}){
 const school=schoolChapters(cls,subject);
 const source=school.length?'school':'reference';
 const candidates=(school.length?school:chapterChoices(cls,subject))
  .filter((name,i,list)=>list.indexOf(name)===i).slice(0,60);
 const audit=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!cls||!subject||!audit||!Number.isInteger(total)||total<10||total>200)
  return{ready:false,topics:[],source,eligible:0,reason:'Choose class, subject, and a whole-number paper total between 10 and 200.'};
 const optionsForAudit={className:cls,subject,teacherQuestions:ready()&&questionScope!==currentSchoolScope()?[]:customQuestions,practiceQuestions:window.EDUNIZAM_PRACTICE_DATA?.questions||[],difficulty,teacherOnly:!!options.teacherOnly};
 const supported=candidates.filter(chapter=>{
  const row=audit.audit({...optionsForAudit,chapters:[chapter]}).chapters[0];
  return !!row&&['mcq','short','long'].every(t=>row.types[t].total>0);
 });
 if(!supported.length)return{ready:false,topics:[],source,eligible:0,
  reason:school.length?'No saved school syllabus unit has usable MCQ, short AND long answers for this class and subject. Import reviewed questions for these chapters.':
  'No reference chapter has all three question types for this class and subject. Add reviewed questions.'};
 const picked=[];let lastError='';
 for(const chapter of supported){
  picked.push(chapter);
  try{
   const draft=build(subject,picked,total,difficulty,distribution,cls,{teacherOnly:!!options.teacherOnly});
   if(draft?.sourceStats?.templateFallback===0)return{ready:true,topics:picked,source,eligible:supported.length,reason:''};
  }catch(error){lastError=String(error?.message||error)}
 }
 return{ready:false,topics:[],source,eligible:supported.length,
  reason:'Existing indexed questions do not have enough unique items for this marks distribution. '+(lastError||'Reduce marks, add chapters, or import verified questions.')};
}
function updateBankInsight(){
 const el=$('#pbBankInsight');if(!el)return;
 const cls=$('#pbClass')?.value||'',subject=$('#pbSubject')?.value||'',
  chapters=String($('#pbChapters')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  difficulty=$('#pbDifficulty')?.value||'Balanced',teacherOnly=!!$('#pbTeacherOnly')?.checked;
 if(!cls||!subject){el.textContent='Choose class and subject to audit chapter-by-chapter question coverage before generating.';return}
 const A=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
 if(!A){el.textContent='Syllabus audit unavailable. Reload this page before generating.';return}
 const result=A.audit({className:cls,subject,chapters,teacherQuestions:ready()&&questionScope!==currentSchoolScope()?[]:customQuestions,practiceQuestions:window.EDUNIZAM_PRACTICE_DATA?.questions||[],difficulty,teacherOnly});
  const gate=ready()?schoolPaperReadiness(cls,subject,chapters,{conceptDraft:!!$('#pbConceptDraft')?.checked}):null;
 const rows=result.chapters.slice(0,24).map(row=>'<tr><td>'+esc(row.chapter)+'</td>'+['mcq','short','long'].map(type=>{
    const item=row.types[type],mark=item.total===0?' style="font-weight:750;color:#9f3a23"':'';
    return '<td'+mark+'>'+item.total+' <small>('+item.teacher+' teacher · '+item.practice+' concept)</small></td>'
  }).join('')+'</tr>').join('');
 const missing=result.missingChapters.length?'<p style="font-weight:700;color:#9f3a23">No matching questions: '+esc(result.missingChapters.join(', '))+'. Generation blocked until questions are added or chapter removed.</p>':'';
 const types=result.noQuestionTypes.length?'<p style="font-weight:700;color:#9f3a23">Missing question types: '+esc(result.noQuestionTypes.join(', '))+'.</p>':'';
 el.innerHTML='<strong>Exact chapter coverage:</strong> '+(teacherOnly?'Teacher question bank only.':'Teacher + EduNizam concept-practice banks; concept questions are NOT textbook extracts.')+
  '<p>'+['mcq','short','long'].map(t=>t.toUpperCase()+' '+result.totals[t]).join(' · ')+'</p>'+
  (chapters.length?'<div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Selected chapter</th><th>MCQ</th><th>Short</th><th>Long</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>Select exact currently taught chapters to check availability.</p>')+missing+types+
  (gate&&!gate.allowed?'<p class="coverage-note"><strong>Cannot save school paper:</strong> '+esc(gate.reason)+'</p>':
    gate?'<p class="coverage-note"><strong>Save mode:</strong> '+(gate.mode==='school-recorded'?'Recorded school chapters (academic review required).':'Private reference concept-only draft.')+'</p>':'')+
   '<p class="muted">Counts do not certify textbook editions, chapter accuracy or answer correctness. Verify books and answer keys before printing.</p>';
}
async function render(){
 const root=$('#paperBuilderApp');if(!root)return;
 if(!['teacher','head'].includes(role())){root.innerHTML='<div class="empty-state">Paper Builder is for teachers and Admin review.</div>';return}
 await loadTeacherDefaults();
 root.innerHTML='<article class="card no-print"><div class="section-head"><div><h3>⚡ Smart Paper Builder</h3><p class="muted">Your verified teacher question bank is prioritized, then EduNizam concept practice. Current textbook editions and chapter coverage must be checked; missing content blocks paper generation.</p></div><span class="academic-pill">Teacher Review Required</span></div><div class="paper-presets"><button type="button" class="secondary" data-preset="quiz">Quick Quiz · 20</button><button type="button" class="secondary" data-preset="monthly">Monthly · 50</button><button type="button" class="secondary" data-preset="term">Term · 100</button></div><div class="form-grid"><input id="pbTitle" placeholder="Paper title (optional)"><label>Class / Grade *<select id="pbClass" aria-label="Select class / grade"><option value="">Select Class / Grade</option><option value="1">Class 1</option><option value="2">Class 2</option><option value="3">Class 3</option><option value="4">Class 4</option><option value="5">Class 5</option><option value="6">Class 6</option><option value="7">Class 7</option><option value="8">Class 8</option><option value="9">Class 9</option><option value="10">Class 10</option><option value="11">Class 11</option><option value="12">Class 12</option></select></label><label>Subject *<select id="pbSubject" aria-label="Select subject"><option value="">Select Class First</option></select></label><datalist id="pbClasses"></datalist><datalist id="pbSubjects"></datalist><input id="pbChapters" type="hidden"><label>Chapter / Topic *<select id="pbChapterPicker" aria-label="Select chapter"><option value="">Choose Class + Subject First</option></select></label><div id="pbSelectedChapters" class="coverage-note" role="status" aria-live="polite">Choose one or more chapters from the dropdown.</div><select id="pbBookBoard" aria-label="Curriculum authority"><option value="punjab-pectaa">Punjab · PECTAA</option><option value="federal-fbise">Federal · FBISE</option><option value="sindh-stbb">Sindh · STBB</option><option value="kp-dcte-kptbb">KP · Textbook Board</option><option value="balochistan-btbb">Balochistan · Textbook Board</option></select><label>Total Marks *<input id="pbMarks" type="number" min="10" max="200" step="1" value="50" aria-label="Total marks"></label><label>Difficulty<select id="pbDifficulty"><option>Easy</option><option selected>Balanced</option><option>Challenging</option></select></label><label>Paper Pattern<select id="pbDistribution" aria-label="Paper pattern"><option>Balanced</option><option>Objective Heavy</option><option>Subjective Heavy</option></select></label><label class="coverage-note"><input id="pbAdmin" type="checkbox"> Show to Admin</label><label class="coverage-note"><input id="pbTeacherOnly" type="checkbox"> Teacher question bank only (exclude built-in concept questions)</label><label class="coverage-note"><input id="pbConceptDraft" type="checkbox" checked> <strong>Practice / concept preview</strong> — works without a registered school class. Not an official textbook-certified school exam. Uncheck only to request a school-recorded examination.</label><button id="pbGenerate" type="button">Generate Paper Preview</button><p class="coverage-note" id="pbGenerationStatus" role="status" aria-live="polite">Choose class, subject, chapters, total marks and paper pattern. Generation previews first; school saving requires verified class and syllabus records.</p></div><div id="pbCurriculumSources" class="coverage-note">Select class, subject and textbook board to open official curriculum sources.</div><div id="pbBankInsight" class="coverage-note">Choose class and subject to see available teacher + EduNizam question-bank depth.</div><p class="coverage-note">Only generate from chapters taught in the current syllabus. Built-in questions are not official board textbook extracts. Review the answer key and every question.</p></article>'+
 '<article class="card no-print" id="questionBankManager"><div class="section-head"><div><h3>Reusable Teacher Question Bank</h3><p class="muted">Add verified questions once and reuse them automatically in future papers.</p></div><span id="qbCount" class="badge">0 questions</span></div><div class="form-grid"><input id="qbClass" list="pbClasses" placeholder="Class / Grade"><input id="qbSubject" list="pbSubjects" placeholder="Subject"><input id="qbChapter" list="pbTeacherChapters" placeholder="Chapter / Topic (required)"><datalist id="pbTeacherChapters"></datalist><select id="qbType"><option value="mcq">MCQ</option><option value="short">Short</option><option value="long">Long</option></select><select id="qbDifficulty"><option>Easy</option><option selected>Balanced</option><option>Challenging</option></select><textarea id="qbQuestion" rows="3" placeholder="Question text"></textarea><textarea id="qbAnswer" rows="2" placeholder="Answer / marking guide"></textarea><textarea id="qbOptions" rows="4" placeholder="MCQ options — one per line"></textarea><input id="qbCorrect" type="number" min="1" value="1" placeholder="Correct option number"><label class="coverage-note"><input id="qbAdmin" type="checkbox"> Share this question with Admin</label><button id="qbSave">Add to Question Bank</button><button id="qbCancelEdit" class="secondary hidden" type="button">Cancel Edit</button></div><input id="qbSearch" class="no-print" type="search" placeholder="Search reusable questions" style="width:100%;margin-top:12px"><div class="coverage-note" id="qbBulkImport" style="margin-top:16px"><strong>Bulk verified question import (CSV / JSON)</strong><p>Download the template, fill authentic subject/chapter questions and their answer keys, then validate before saving. Files stay on your device until you confirm Import; institution/user IDs always come from your secure login.</p><div class="paper-actions"><button type="button" class="secondary" id="qbImportTemplate">Download CSV Template</button><input type="file" accept=".csv,.json,text/csv,application/json" id="qbImportFile" aria-label="Select question bank CSV or JSON" style="max-width:270px"><button type="button" class="secondary" id="qbImportPreview">Validate File</button><button type="button" id="qbImportSave" disabled>Import Verified Questions</button></div><p id="qbImportReport" role="status" aria-live="polite">Up to 500 questions and 1 MB per file. Four distinct MCQ options, the correct answer and a chapter are required. Nothing imports automatically.</p></div><div id="qbList" class="paper-grid" style="margin-top:12px"></div></article>'+
 '<div class="section-head no-print"><div><h3>My / Shared Papers</h3><p class="muted">Search, reopen, clone or review saved papers.</p></div><span id="pbSavedCount" class="badge">0 papers</span></div><div class="form-grid no-print"><input id="pbSavedSearch" type="search" placeholder="Search saved papers"><input id="pbSavedClass" placeholder="Filter class"></div><div id="savedTeacherPapers" class="paper-grid no-print" style="margin-top:12px"></div><div id="paperPreview" style="margin-top:16px"></div>';
 const sourceBox=$('#pbCurriculumSources');
 if(sourceBox){
  sourceBox.insertAdjacentHTML('afterend','<div class="coverage-note"><strong>Saved School Syllabus / Class Directory</strong><p id="pbSchoolCatalogStatus" role="status" aria-live="polite">Checking school records…</p><div class="paper-actions"><button type="button" class="secondary" id="pbSchoolRefresh">Refresh school records</button><button type="button" class="secondary" id="pbOpenLessonSetup">Open Lesson / Syllabus Setup</button></div></div>');
  $('#pbSchoolRefresh').onclick=loadSchoolCatalog;
  $('#pbOpenLessonSetup').onclick=()=>window.EDUNIZAM_APP_NAV?.setView?.('lessoncenter');
  renderSchoolStatus();
 }
 const insight=$('#pbBankInsight');
 if(insight){
  insight.insertAdjacentHTML('beforebegin','<div class="coverage-note"><strong>Find questions for a draft paper</strong><p>Find chapters with enough genuine indexed MCQ, short and long questions. Saved school syllabus units take priority; concept topics are NOT a certified textbook syllabus.</p><div class="paper-actions"><button type="button" class="secondary" id="pbFindReady">Find Ready Chapters</button><button type="button" class="secondary" id="pbOpenQuestionManager">Add / Import Reviewed Questions</button></div><p role="status" id="pbCoverageHint" aria-live="polite">This only suggests chapters. You must verify the current textbooks and answer keys before printing.</p></div>');
  $('#pbFindReady').onclick=()=>{
   const result=recommendPaperChapters($('#pbClass')?.value||'',$('#pbSubject')?.value||'',Number($('#pbMarks')?.value),$('#pbDifficulty')?.value||'Balanced',$('#pbDistribution')?.value||'Balanced',{teacherOnly:!!$('#pbTeacherOnly')?.checked});
   const status=$('#pbCoverageHint');
   if(!result.ready){
    if(status)status.textContent='Cannot recommend a paper yet: '+result.reason;
    return;
   }
   $('#pbChapters').value=result.topics.join(', ');
   if(status)status.textContent=result.topics.length+' '+(result.source==='school'?'school-recorded syllabus unit(s)':'concept-topic suggestion(s)')+' structurally support the selected paper marks. Question coverage checked; textbook / chapter alignment and answer correctness still require teacher verification.';
   updateBankInsight();
  };
  $('#pbOpenQuestionManager').onclick=()=>$('#questionBankManager')?.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 $('#pbGenerate').onclick=previewPaper;all('[data-preset]').forEach(b=>b.onclick=()=>{applyPreset(b.dataset.preset);updateBankInsight()});
  $('#pbClass')?.addEventListener('change',()=>{$('#pbSubject').value='';$('#pbChapters').value='';refreshPaperCatalog();updateBankInsight()});
  $('#pbSubject')?.addEventListener('change',()=>{$('#pbChapters').value='';refreshPaperCatalog();updateBankInsight()});
 $('#pbTeacherOnly')?.addEventListener('change',updateBankInsight);
  $('#pbConceptDraft')?.addEventListener('change',updateBankInsight);
 $('#pbDifficulty')?.addEventListener('change',updateBankInsight);
  ['#qbClass','#qbSubject'].forEach(s=>$(s)?.addEventListener('input',refreshTeacherQuestionCatalog));
  $('#pbBookBoard')?.addEventListener('change',refreshPaperCatalog);
  $('#pbChapterPicker')?.addEventListener('change',e=>{const value=e.target.value;if(!value)return;const el=$('#pbChapters');const chosen=el.value.split(',').map(x=>x.trim()).filter(Boolean);if(!chosen.includes(value))chosen.push(value);el.value=chosen.join(', ');e.target.value='';renderSelectedChapters();updateBankInsight()});
  refreshPaperCatalog();refreshTeacherQuestionCatalog();
 $('#qbSave').onclick=saveCustomQuestion;$('#qbCancelEdit').onclick=clearQuestionForm;$('#qbSearch').addEventListener('input',renderQuestionBankList);
 $('#qbImportTemplate').onclick=downloadQuestionTemplate;$('#qbImportPreview').onclick=previewQuestionImport;$('#qbImportSave').onclick=saveQuestionImport;
 $('#qbImportFile').addEventListener('change',()=>{pendingImportRows=[];$('#qbImportSave').disabled=true;$('#qbImportReport').textContent='File selected. Click Validate File before importing.'});
 $('#qbType').addEventListener('change',()=>{const mcq=$('#qbType').value==='mcq';$('#qbOptions').disabled=!mcq;$('#qbCorrect').disabled=!mcq});
 let timer;$('#pbSavedSearch').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadPapers,180)});$('#pbSavedClass').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadPapers,180)});
 await loadCustomQuestions();updateBankInsight();loadPapers();loadSchoolCatalog();
}
window.EDUNIZAM_PAPER_BUILDER={render,build,previewPaper,refreshPaperCatalog,renderSelectedChapters,chapterChoices,schoolChapters,recommendPaperChapters,materialSubjectMatches,loadSchoolCatalog,getSchoolCatalog:()=>schoolCatalog,schoolPaperReadiness,getQuestionScope:()=>questionScope,loadCustomQuestions,savePaper,saveCurrentAsNew,saveCustomQuestion,saveQuestionImport};if(document.readyState!=='loading')render();else document.addEventListener('DOMContentLoaded',render);
})();