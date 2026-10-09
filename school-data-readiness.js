/* EduNizam Data Readiness Center.
 * Reference-topic coverage != verified textbook syllabus; cloud counts != data quality.
 * Read-only, on-demand and institution-scoped. Never creates dummy school records. */
(function(){
 'use strict';
 const root=()=>document.getElementById('dataReadinessApp');
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
 const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
 const cloud=()=>window.EDUNIZAM_CLOUD;
 const role=()=>{try{const s=JSON.parse(localStorage.getItem('edunizam_session')||'{}');return s.role==='admin'?'head':s.role}catch{return null}};
 const ready=()=>!!(cloud()?.state?.user&&cloud()?.state?.client&&cfg().institutionId);
 const catalog=()=>window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{subjects:{},chapters:{}};
 const spec=[
  {key:'classes',name:'Academic Groups',table:'class_sections',view:'classcenter',why:'Create actual classes and sections'},
  {key:'students',name:'Student Enrollment',table:'core_students',view:'bulkimport',why:'Import or enroll real students'},
  {key:'staff',name:'Staff & Teachers',table:'staff_profiles',view:'staffcenter',why:'Register staff and allocate classes'},
  {key:'questions',name:'Accessible Teacher Question Bank',table:'teacher_question_bank',view:'paperbuilder',why:'Import verified chapter-wise questions with answers'},
  {key:'lessons',name:'Weekly Lesson Plans',table:'lesson_plans',view:'lessoncenter',why:'Add plans based on the taught syllabus'},
  {key:'units',name:'Syllabus Progress Units',table:'syllabus_progress_units',view:'lessoncenter',why:'Add actual school textbook units'},
  {key:'timetable',name:'Timetable Periods',table:'timetable_entries',view:'schedulecenter',why:'Create real class periods'},
  {key:'datesheets',name:'Exam Date Sheets',table:'exam_schedule_entries',view:'schedulecenter',why:'Create examination dates'},
  {key:'library',name:'Physical Library Books',table:'library_books',view:'librarycenter',why:'Catalog school-owned books (optional)'}
 ];
 let counts=null,busy=false,auditScope='';
 const scope=()=>String(cfg().institutionId||'')+'|'+String(cloud()?.state?.user?.id||'');
 const order=['classes','staff','students','units','questions','lessons','timetable','datesheets','library'];
 const prerequisites={
  classes:'Start by registering the real class and section names.',
  staff:'Add actual staff profiles, assign roles and connect teacher classes.',
  students:'Import genuine student records into the correct school and assigned sections.',
  units:'Record chapters from the school prescribed textbook; verify the book edition and class.',
  questions:'Import teacher-reviewed chapter-wise questions and verify answer keys.',
  lessons:'Create weekly lessons from verified taught chapters.',
  timetable:'Allocate the actual class, subject, teacher and period.',
  datesheets:'Publish the real examination schedule for enrolled classes.',
  library:'Optional: register physical books that are actually owned by this school.'
 };
 function nextSteps(results=counts){
  if(!results)return[];
  const missing=order.filter(key=>results[key]?.status==='ok'&&results[key].count===0);
  const unknown=order.filter(key=>results[key]?.status==='unknown');
  return[...missing.map(key=>({key,status:'missing',text:prerequisites[key]})),
    ...unknown.map(key=>({key,status:'unknown',text:'Could not verify this area due to access, connection or timeout. Check permissions and retry.'}))];
 }
 const forgetOtherSchool=()=>{
  const current=scope();
  if(auditScope&&auditScope!==current){counts=null;auditScope='';}
 };
 const getSubjects=grade=>catalog().subjects?.[String(grade)]||[];
 const getTopics=(grade,subject)=>catalog().chapters?.[String(grade)+'|'+subject]||[];
 const countWord=(r)=>{
   if(!r)return 'Not checked';
   if(r.status==='unknown')return 'Unknown (network / access)';
   return r.count===0?'No accessible records':r.count+' accessible record'+(r.count===1?'':'s');
 };
 const countRows=()=>{
  forgetOtherSchool();
  const r=document.getElementById('readinessCloudRows');if(!r)return;
  const suggested=document.getElementById('readinessNextSteps');
  if(suggested){
   const actions=nextSteps();
   suggested.innerHTML=!counts?'<p class="muted">Run Check School Data to identify the next real setup steps. Reference topics alone do not prove textbook readiness.</p>':
     actions.length?'<h4>Next setup actions (in dependency order)</h4><ol>'+actions.slice(0,9).map(a=>{
      const item=spec.find(x=>x.key===a.key);
      return '<li><strong>'+esc(item?.name||a.key)+'</strong>: '+esc(a.text)+'</li>';
     }).join('')+'</ol><p class="muted">These are record-availability suggestions, not an academic completion percentage.</p>':
     '<p class="coverage-note">All checked categories have accessible records. Content quality and prescribed textbook alignment still require review; this is not 100% verified.</p>';
  }
  r.innerHTML=spec.map(x=>{
   const state=counts?.[x.key],value=countWord(state);
   const status=state?.status==='unknown'?'Check access/connection':state?.count===0?'Add real records':state?.count>0?'Review accuracy':'Not checked';
   return '<article class="paper-card"><div class="paper-card-top"><strong>'+esc(x.name)+'</strong><span class="mini-badge">'+esc(status)+'</span></div><p>'+esc(value)+'</p><p class="muted">'+esc(x.why)+'</p><div class="paper-actions"><button type="button" class="secondary" data-readiness-open="'+esc(x.view)+'">Open Section</button></div></article>';
  }).join('');
  r.querySelectorAll('[data-readiness-open]').forEach(button=>{
   button.onclick=()=>{const view=button.dataset.readinessOpen;if(window.EDUNIZAM_ROLE_SCOPE?.canView?.(view))window.EDUNIZAM_APP_NAV?.setView?.(view)};
  });
 };
 const refreshReference=()=>{
   const selector=document.getElementById('readinessGrade'),subjects=document.getElementById('readinessSubject'),summary=document.getElementById('readinessReferenceSummary');
   if(!selector||!subjects||!summary)return;
   const grade=selector.value,old=subjects.value,all=getSubjects(grade);
   subjects.innerHTML='<option value="">All subjects</option>'+all.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
   if(all.includes(old))subjects.value=old;
   renderTopics();
 };
 function renderTopics(){
  const grade=document.getElementById('readinessGrade')?.value||'1',
    subject=document.getElementById('readinessSubject')?.value||'',
    summary=document.getElementById('readinessReferenceSummary'),
    list=document.getElementById('readinessTopicList');
  if(!summary||!list)return;
  const subjects=getSubjects(grade),picked=subject?[subject]:subjects;
  const topics=picked.flatMap(s=>getTopics(grade,s).map(topic=>({subject:s,topic})));
  summary.textContent='Class '+grade+': '+subjects.length+' subject categories, '+topics.length+' indexed concept topics'+(subject?' in selected subject':'')+'.';
  list.innerHTML=topics.length
   ?'<div class="coverage-note">'+topics.slice(0,70).map(x=>'<span class="mini-badge" style="display:inline-block;margin:3px">'+esc(x.subject)+' · '+esc(x.topic)+'</span>').join('')+(topics.length>70?'<p>And '+(topics.length-70)+' more topics (select a subject to narrow).</p>':'')+'</div>'
   :'<div class="empty-state">This subject or grade has no indexed reference topics; add verified curriculum mapping before paper generation.</div>';
 }
 async function countOne(item,id){
  const client=cloud()?.state?.client;
  const req=client.from(item.table).select('id',{head:true,count:'exact'}).eq('institution_id',id);
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  if(controller&&typeof req.abortSignal==='function')req.abortSignal(controller.signal);
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(new Error('count timeout'))},5800)});
  try{
   const result=await Promise.race([req,timeout]);
   if(result?.error||!Number.isInteger(result?.count))return{status:'unknown'};
   return{status:'ok',count:result.count};
  }catch(_){return{status:'unknown'}}finally{clearTimeout(timer)}
 }
 async function audit(){
  if(busy)return;
  const output=document.getElementById('readinessCloudStatus'),button=document.getElementById('readinessAuditBtn');
  if(!ready()){if(output)output.textContent='A verified school cloud session is required for record counts. No data has been changed.';return}
  if(role()!=='head'){if(output)output.textContent='Only the Head of Institute may audit school-wide record counts.';return}
  busy=true;if(button){button.disabled=true;button.textContent='Checking school records…'}
  if(output)output.textContent='Reading counts for this school only. Unknown access results will not be treated as empty data.';
  const institution=cfg().institutionId;
  try{
   const results=await Promise.all(spec.map(async s=>[s.key,await countOne(s,institution)]));
   if(institution!==cfg().institutionId){if(output)output.textContent='School changed during audit. Please run the audit again.';return}
   counts=Object.fromEntries(results);
   auditScope=scope();
   countRows();
   const missing=spec.filter(s=>counts[s.key]?.status==='ok'&&counts[s.key].count===0).length;
   const uncertain=spec.filter(s=>counts[s.key]?.status==='unknown').length;
   if(output)output.textContent=spec.length+' school data areas checked · '+missing+' without accessible records · '+uncertain+' unavailable checks. Counts are not academic content quality scores.';
  }finally{busy=false;if(button?.isConnected){button.disabled=false;button.textContent='Check School Data'}} 
 }
 function render(){
  forgetOtherSchool();
  const el=root();if(!el)return;
  if(role()!=='head'){el.innerHTML='<div class="empty-state">Head of Institute access required.</div>';return}
  el.innerHTML='<article class="card"><div class="section-head"><div><h3>Reference Curriculum Data</h3><p class="muted">Indexed categories and concept topics are available for planning; they are not a certified exact textbook contents list.</p></div><span class="academic-pill">Grade 1–12</span></div>'+
   '<div class="form-grid"><label>Class / Grade<select id="readinessGrade">'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">Class '+(i+1)+'</option>').join('')+'</select></label><label>Subject<select id="readinessSubject"><option value="">All subjects</option></select></label></div><p id="readinessReferenceSummary" role="status" class="coverage-note"></p><div id="readinessTopicList"></div>'+
   '<p class="coverage-note">Verify your actual prescribed textbook edition, school subject allocation and chapter sequence. The topic index is a starting point, not a promise that a published exam is syllabus-correct.</p></article>'+
   '<article class="card" style="margin-top:18px"><div class="section-head"><div><h3>School Data Availability</h3><p class="muted">Only on-demand, read-only counts in your current school. No sample students, teachers, books or scores are fabricated.</p></div><button id="readinessAuditBtn" type="button">Check School Data</button></div><p id="readinessCloudStatus" class="coverage-note" role="status">Not checked. Select Check School Data when you want to audit record availability.</p><div id="readinessNextSteps" class="coverage-note" role="status" aria-live="polite"></div><div id="readinessCloudRows" class="paper-grid"></div>'+
   '<p class="coverage-note">Zero means no records were accessible to this account at audit time; it is not proof none exist. “Unknown” may mean RLS restrictions, unavailable access or a slow connection. Bank visibility depends on author sharing, and library inventory may not apply to every school. Nonzero counts do not verify accuracy, curriculum alignment or completion.</p></article>';
  document.getElementById('readinessGrade')?.addEventListener('change',refreshReference);
  document.getElementById('readinessSubject')?.addEventListener('change',renderTopics);
  document.getElementById('readinessAuditBtn')?.addEventListener('click',audit);
  refreshReference();countRows();
 }
 window.EDUNIZAM_DATA_READINESS={render,referenceSubjects:getSubjects,referenceTopics:getTopics,definitions:spec.map(x=>({key:x.key,table:x.table,view:x.view})),countOne,nextSteps,scope};
 if(document.readyState!=='loading')render();
 else document.addEventListener('DOMContentLoaded',render);
})();