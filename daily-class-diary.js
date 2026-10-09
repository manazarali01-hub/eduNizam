(function(){
'use strict';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const cloud=()=>window.EDUNIZAM_CLOUD,cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'{}')}catch{return{}}};
const role=()=>session().role==='admin'?'head':session().role||'student';
const ready=()=>!!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId);
async function boundedRead(key,builder,{timeout=7000,retries=1,cacheMs=0,label='Daily Diary'}={}){
  const execute=async({signal}={})=>{
    let request=builder();
    if(signal&&typeof request?.abortSignal==='function')request=request.abortSignal(signal);
    const result=await request;
    if(result?.error)throw result.error;
    return result;
  };
  const runtime=window.EDUNIZAM_DATA_RUNTIME;
  return runtime?runtime.run(key,execute,{timeout,retries,cacheMs,label}):execute({});
}
const students=()=>{try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}};
const visibleStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students();
let editingId='',teacherClasses=[],diarySaveInFlight=false;
const diaryDeleteInFlight=new Set();

function dateStr(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function normalizeClass(v){return String(v||'').trim().replace(/\s*[·|-]\s*[^·|-]+$/,'').trim()}
function classKey(c,s){return normalizeClass(c).toLowerCase()+'|'+String(s||'').trim().toLowerCase()}
function allowedClassKeys(){
  if(!['student','parent'].includes(role()))return null;
  return new Set(visibleStudents().map(s=>classKey(s.className,s.sectionName)));
}
function canSeeRow(row){
  const allowed=allowedClassKeys();if(!allowed)return true;
  const exact=classKey(row.class_name,row.section_name);
  if(allowed.has(exact))return true;
  // Legacy diary rows may have been stored as "Class · Section" in class_name.
  return [...allowed].some(k=>{const [c,s]=k.split('|');const raw=String(row.class_name||'').toLowerCase();return raw===c||raw===c+' · '+s||raw===c+' - '+s});
}
async function myClasses(){
  if(!ready()||role()!=='teacher')return[];
  const inst=String(cfg().institutionId||''),uid=String(cloud().state.user.id||'');
  const {data}=await boundedRead('daily-diary:classes:'+inst+':'+uid,()=>cloud().state.client.from('class_sections')
    .select('class_name,section_name')
    .eq('institution_id',cfg().institutionId)
    .eq('class_teacher_user_id',cloud().state.user.id)
    .eq('active',true)
    .order('class_name',{ascending:true}),{timeout:6500,retries:1,cacheMs:15000,label:'Assigned diary classes'});
  return data||[];
}
function syncSection(){
  const sel=$('#diaryClass'),sec=$('#diarySection');if(!sel||!sec)return;
  const opt=sel.selectedOptions[0];
  sec.value=opt?.dataset?.section||'';
}
function syncDiaryCatalog(){
  const cls=$('#diaryClass')?.value||'',subject=$('#diarySubject')?.value||'';
  const m=String(cls).match(/\b(1[0-2]|[1-9])\b/),grade=m?String(Number(m[1])):'';
  const D=window.EDUNIZAM_ACADEMIC_OPTION_CATALOG||{};
  const subjects=D.subjects?.[grade]||[];
  const defaults=['Mathematics','English','Urdu','General Science','Islamiat / Ethics','Nazra Quran','Social Studies'];
  const subjectList=$('#diarySubjects'),topicList=$('#diaryTopics');
  if(subjectList)subjectList.innerHTML=[...new Set(subjects.length?subjects:defaults)].map(x=>'<option value="'+esc(x)+'"></option>').join('');
  if(topicList)topicList.innerHTML=(D.chapters?.[grade+'|'+subject]||[]).map(x=>'<option value="'+esc(x)+'"></option>').join('');
}
function formValues(){
  return{
    cls:$('#diaryClass')?.value||'',
    sec:$('#diarySection')?.value.trim()||'',
    subject:$('#diarySubject')?.value.trim()||'',
    topic:$('#diaryTopic')?.value.trim()||'',
    date:$('#diaryDate')?.value||'',
    homework:$('#diaryHomework')?.value.trim()||'',
    instructions:$('#diaryInstructions')?.value.trim()||''
  };
}
function clearForm(){
  editingId='';
  if($('#diaryDate'))$('#diaryDate').value=dateStr();
  ['#diarySubject','#diaryTopic','#diaryHomework','#diaryInstructions'].forEach(s=>{if($(s))$(s).value=''});
  if($('#saveDiary'))$('#saveDiary').textContent='Save Today Diary';
  $('#cancelDiaryEdit')?.classList.add('hidden');
  syncSection();
}
async function reuseLast(){
  if(!ready()||role()!=='teacher')return;
  let q=cloud().state.client.from('daily_class_diaries').select('*')
    .eq('institution_id',cfg().institutionId)
    .eq('teacher_user_id',cloud().state.user.id)
    .order('diary_date',{ascending:false}).limit(1);
  const {data,error}=await q.maybeSingle();
  if(error||!data)return alert('Previous diary entry nahi mili.');
  $('#diarySubject').value=data.subject||'';
  $('#diaryTopic').value=data.topic||'';
  $('#diaryHomework').value=data.homework||'';
  $('#diaryInstructions').value=data.instructions||'';
  window.EDUNIZAM_PREMIUM?.toast?.('Previous diary loaded — edit and save for today.','success');
}
async function save(){
  if(!ready()||role()!=='teacher')return;
  const v=formValues();
  if(!v.cls||!v.subject||!v.topic||!v.date)return alert('Date, class, subject aur topic required hain.');
  const btn=$('#saveDiary');if(diarySaveInFlight||btn?.disabled)return;
  diarySaveInFlight=true;if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true')}
  try{
    const payload={institution_id:cfg().institutionId,teacher_user_id:cloud().state.user.id,diary_date:v.date,class_name:v.cls,section_name:v.sec,subject:v.subject,topic:v.topic,homework:v.homework,instructions:v.instructions,updated_at:new Date().toISOString()};
    let error;
    if(editingId){
      ({error}=await cloud().state.client.from('daily_class_diaries').update(payload)
        .eq('id',editingId).eq('institution_id',cfg().institutionId).eq('teacher_user_id',cloud().state.user.id));
    }else{
      ({error}=await cloud().state.client.from('daily_class_diaries').upsert(payload,{onConflict:'institution_id,teacher_user_id,diary_date,class_name,section_name,subject'}));
    }
    if(error)throw error;
    window.EDUNIZAM_PREMIUM?.toast?.(editingId?'Diary updated.':'Daily diary saved.','success');
    clearForm();await load();
  }catch(e){alert(e.message||e)}
  finally{
    diarySaveInFlight=false;
    if(btn?.isConnected){btn.disabled=false;btn.removeAttribute('aria-busy')}
  }
}
async function editRow(id){
  if(role()!=='teacher')return;
  const {data,error}=await cloud().state.client.from('daily_class_diaries').select('*')
    .eq('id',id).eq('institution_id',cfg().institutionId).eq('teacher_user_id',cloud().state.user.id).maybeSingle();
  if(error||!data)return alert(error?.message||'Diary entry not found.');
  editingId=String(data.id);
  $('#diaryDate').value=data.diary_date||dateStr();
  const normalized=normalizeClass(data.class_name);
  if([...$('#diaryClass').options].some(o=>o.value===normalized))$('#diaryClass').value=normalized;
  $('#diarySection').value=data.section_name||'';
  $('#diarySubject').value=data.subject||'';
  $('#diaryTopic').value=data.topic||'';
  $('#diaryHomework').value=data.homework||'';
  $('#diaryInstructions').value=data.instructions||'';
  $('#saveDiary').textContent='Update Diary';
  $('#cancelDiaryEdit')?.classList.remove('hidden');
  $('#dailyDiaryApp')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteRow(id,btn){
  if(!ready()||!['teacher','head'].includes(role()))return;
  const key=String(id||'');if(diaryDeleteInFlight.has(key)||btn?.disabled)return;
  if(!confirm('Delete this diary entry?'))return;
  diaryDeleteInFlight.add(key);if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true')}
  try{
    let q=cloud().state.client.from('daily_class_diaries').delete().eq('id',id).eq('institution_id',cfg().institutionId);
    if(role()==='teacher')q=q.eq('teacher_user_id',cloud().state.user.id);
    const {error}=await q;if(error)throw error;
    window.EDUNIZAM_PREMIUM?.toast?.('Diary entry deleted.','success');await load();
  }catch(e){alert(e.message||e)}
  finally{
    diaryDeleteInFlight.delete(key);
    if(btn?.isConnected){btn.disabled=false;btn.removeAttribute('aria-busy')}
  }
}
async function acknowledgeDiary(id,updatedAt){
  if(!ready()||!['student','parent'].includes(role()))return;
  const uid=cloud().state.user.id;
  const payload={institution_id:cfg().institutionId,diary_id:id,viewer_user_id:uid,viewer_role:role(),diary_updated_at:updatedAt,viewed_at:new Date().toISOString()};
  const {error}=await cloud().state.client.from('daily_diary_acknowledgements').upsert(payload,{onConflict:'diary_id,viewer_user_id'});
  if(error)return alert(error.message);
  window.EDUNIZAM_PREMIUM?.toast?.('Diary marked as seen.','success');
  await load();
}
function ackIsCurrent(a,row){
  if(!a?.diary_updated_at||!row?.updated_at)return false;
  return Math.abs(new Date(a.diary_updated_at).getTime()-new Date(row.updated_at).getTime())<1000;
}
function filterRows(rows){
  const cls=$('#diaryViewClass')?.value||'',subject=String($('#diaryViewSubject')?.value||'').trim().toLowerCase(),search=String($('#diarySearch')?.value||'').trim().toLowerCase();
  return rows.filter(x=>{
    if(!canSeeRow(x))return false;
    if(cls&&normalizeClass(x.class_name)!==normalizeClass(cls))return false;
    if(subject&&!String(x.subject||'').toLowerCase().includes(subject))return false;
    if(search&&!([x.topic,x.homework,x.instructions,x.subject,x.class_name,x.section_name].join(' ').toLowerCase().includes(search)))return false;
    return true;
  });
}
function card(x){
  const mine=String(x.teacher_user_id||'')===String(cloud()?.state?.user?.id||'');
  const acks=Array.isArray(x._acks)?x._acks:[],currentAcks=acks.filter(a=>ackIsCurrent(a,x));
  const studentSeen=currentAcks.filter(a=>a.viewer_role==='student').length,parentSeen=currentAcks.filter(a=>a.viewer_role==='parent').length;
  const uid=String(cloud()?.state?.user?.id||''),myAck=currentAcks.find(a=>String(a.viewer_user_id||'')===uid);
  const staffSeen=['teacher','head'].includes(role())?'<div class="coverage-note"><strong>Current version seen:</strong> '+studentSeen+' student account(s) · '+parentSeen+' parent account(s)'+(acks.length>currentAcks.length?'<br><span class="muted">'+(acks.length-currentAcks.length)+' acknowledgement(s) belong to an older edited version.</span>':'')+'</div>':'';
  const familySeen=['student','parent'].includes(role())?(myAck?'<div class="coverage-note"><strong>✓ Seen</strong> · '+new Date(myAck.viewed_at).toLocaleString()+'</div>':'<div class="paper-actions"><button data-diary-ack="'+esc(x.id)+'" data-diary-version="'+esc(x.updated_at||x.created_at||'')+'">Mark as Seen</button></div>'):'';
  const actions=(role()==='teacher'&&mine)?'<div class="paper-actions"><button class="secondary" data-diary-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-diary-delete="'+esc(x.id)+'">Delete</button></div>':(role()==='head'?'<div class="paper-actions"><button class="secondary" data-diary-delete="'+esc(x.id)+'">Delete</button></div>':'');
  return '<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(normalizeClass(x.class_name))+(x.section_name?' · '+esc(x.section_name):'')+'</span><span class="mini-badge">'+esc(x.subject)+'</span></div><span class="mini-badge">'+esc(x.diary_date||'')+'</span></div><h3>'+esc(x.topic)+'</h3>'+(x.homework?'<p><strong>Homework:</strong> '+esc(x.homework)+'</p>':'')+(x.instructions?'<p class="muted">'+esc(x.instructions)+'</p>':'')+staffSeen+familySeen+actions+'</article>';
}
async function load(){
  if(!ready())return;
  const date=$('#diaryFilterDate')?.value||dateStr(),mode=$('#diaryRange')?.value||'day';
  const inst=String(cfg().institutionId||''),uid=String(cloud()?.state?.user?.id||''),scope=role()+':'+uid;
  const buildDiaryQuery=()=>{
    let q=cloud().state.client.from('daily_class_diaries').select('*').eq('institution_id',cfg().institutionId);
    if(mode==='day')q=q.eq('diary_date',date);
    else{
      const d=new Date(date+'T00:00:00');d.setDate(d.getDate()-(mode==='week'?6:29));
      q=q.gte('diary_date',dateStr(d)).lte('diary_date',date);
    }
    return q.order('diary_date',{ascending:false}).order('created_at',{ascending:false}).limit(300);
  };
  const el=$('#diaryList');if(!el)return;
  let data=[];
  try{
    const result=await boundedRead('daily-diary:list:'+inst+':'+scope+':'+mode+':'+date,buildDiaryQuery,{timeout:7000,retries:1,label:'Daily Diary history'});
    data=result.data||[];
  }catch(error){
    el.innerHTML='<div class="empty-state">'+esc(error.message||error)+'</div>';return;
  }
  let acknowledgements=[];
  const ids=(data||[]).map(x=>x.id).filter(Boolean);
  if(ids.length){
    try{
      const ack=await boundedRead('daily-diary:acks:'+inst+':'+scope+':'+ids.join(','),()=>cloud().state.client.from('daily_diary_acknowledgements').select('*').in('diary_id',ids),{timeout:6000,retries:1,label:'Diary acknowledgements'});
      acknowledgements=ack.data||[];
    }catch(error){console.warn('Diary acknowledgements:',error?.message||error)}
  }
  const byDiary=new Map();
  acknowledgements.forEach(a=>{const k=String(a.diary_id);if(!byDiary.has(k))byDiary.set(k,[]);byDiary.get(k).push(a)});
  const enriched=(data||[]).map(x=>({...x,_acks:byDiary.get(String(x.id))||[]}));
  const rows=filterRows(enriched);
  $('#diaryCount')&&( $('#diaryCount').textContent=rows.length+' entr'+(rows.length===1?'y':'ies') );
  el.innerHTML=rows.length?rows.map(card).join(''):'<div class="empty-state">Is filter ke liye koi relevant diary entry nahi hai.</div>';
  all('[data-diary-edit]').forEach(b=>b.onclick=()=>editRow(b.dataset.diaryEdit));
  all('[data-diary-delete]').forEach(b=>b.onclick=()=>deleteRow(b.dataset.diaryDelete,b));
  all('[data-diary-ack]').forEach(b=>b.onclick=()=>acknowledgeDiary(b.dataset.diaryAck,b.dataset.diaryVersion));
}
async function render(){
  const root=$('#dailyDiaryApp');if(!root)return;
  if(!ready()){root.innerHTML='<div class="empty-state">Diary cloud login ke baad available hai.</div>';return}
  let form='';
  if(role()==='teacher'){
    try{teacherClasses=await myClasses()}catch(e){teacherClasses=[]}
    form='<article class="card"><div class="section-head"><div><h3>✍ Daily Class Diary</h3><p class="muted">Assigned class ke liye topic, homework aur instructions. Entries can be edited later.</p></div><span class="academic-pill">Teacher</span></div>'+
      '<div class="form-grid"><input id="diaryDate" type="date" value="'+dateStr()+'"><select id="diaryClass"><option value="">Select assigned class</option>'+teacherClasses.map(x=>'<option value="'+esc(x.class_name)+'" data-section="'+esc(x.section_name||'')+'">'+esc(x.class_name)+(x.section_name?' · '+esc(x.section_name):'')+'</option>').join('')+'</select><input id="diarySection" placeholder="Section" readonly><input id="diarySubject" list="diarySubjects" placeholder="Subject (choose or type)"><datalist id="diarySubjects"></datalist><input id="diaryTopic" list="diaryTopics" placeholder="Today topic / class work"><datalist id="diaryTopics"></datalist><textarea id="diaryHomework" placeholder="Homework"></textarea><textarea id="diaryInstructions" placeholder="Instructions / reminder"></textarea>'+(teacherClasses.length?'':'<p class="coverage-note" style="grid-column:1/-1">No assigned class available. Ask the Head to assign a class/section before creating diary entries.</p>')+'<button id="saveDiary">Save Today Diary</button><button id="reuseDiary" type="button" class="secondary">Reuse Previous Diary</button><button id="cancelDiaryEdit" type="button" class="secondary hidden">Cancel Edit</button></div></article>';
  }
  const scopeNote=['student','parent'].includes(role())?'Only diary entries for your linked student class/section are shown. Mark each current diary version as Seen after reading.':'Institution diary with filters, plus student/parent Seen acknowledgement counts.';
  root.innerHTML=form+
    '<div class="section-head" style="margin-top:16px"><div><h3>Daily Diary History</h3><p class="muted">'+esc(scopeNote)+'</p></div><span class="badge" id="diaryCount">0 entries</span></div>'+
    '<div class="form-grid"><input id="diaryFilterDate" type="date" value="'+dateStr()+'"><select id="diaryRange"><option value="day">Selected Day</option><option value="week">Last 7 Days</option><option value="month">Last 30 Days</option></select><input id="diaryViewClass" placeholder="Filter class (optional)"><input id="diaryViewSubject" placeholder="Filter subject"><input id="diarySearch" type="search" placeholder="Search topic, homework or instruction"></div><div id="diaryList" class="paper-grid" style="margin-top:14px"></div>';
  if($('#saveDiary')){
    $('#saveDiary').onclick=save;$('#diaryClass').onchange=()=>{syncSection();syncDiaryCatalog()};$('#diarySubject')?.addEventListener('input',syncDiaryCatalog);syncSection();syncDiaryCatalog();
    $('#reuseDiary').onclick=reuseLast;$('#cancelDiaryEdit').onclick=clearForm;
  }
  ['#diaryFilterDate','#diaryRange','#diaryViewClass','#diaryViewSubject'].forEach(s=>$(s)?.addEventListener('change',load));
  let timer;$('#diarySearch')?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,180)});
  await load();
}
window.EDUNIZAM_DAILY_DIARY={render,load,dateStr};
if(document.readyState!=='loading')render();else document.addEventListener('DOMContentLoaded',render);
})();