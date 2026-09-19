(function(){
  const SCHOOL_KEY='edunizam_school_work_v1';
  const EXAM_KEY='edunizam_exam_schedule_v1';
  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const canManage=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const uuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||''));

  function schoolData(){try{return Object.assign({announcements:[],homework:[],timetable:[]},JSON.parse(localStorage.getItem(SCHOOL_KEY)||'{}'))}catch{return{announcements:[],homework:[],timetable:[]}}}
  function writeSchool(v){localStorage.setItem(SCHOOL_KEY,JSON.stringify(v))}
  function timetable(){return schoolData().timetable||[]}
  function writeTimetable(v){const d=schoolData();d.timetable=v;writeSchool(d)}
  function dateSheets(){try{return JSON.parse(localStorage.getItem(EXAM_KEY)||'[]')}catch{return[]}}
  function writeDateSheets(v){localStorage.setItem(EXAM_KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function classSections(){
    const map=new Map();
    const add=(c,s='')=>{c=String(c||'').trim();s=String(s||'').trim();if(!c)return;const k=c+'\u0000'+s;if(!map.has(k))map.set(k,{className:c,sectionName:s})};
    students().forEach(x=>add(x.className,x.sectionName));
    try{JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]').forEach(x=>add(x.className,x.sectionName))}catch(_){ }
    timetable().forEach(x=>add(x.className,x.sectionName));dateSheets().forEach(x=>add(x.className,x.sectionName));
    return [...map.values()].sort((a,b)=>a.className.localeCompare(b.className,undefined,{numeric:true})||a.sectionName.localeCompare(b.sectionName));
  }
  function accessible(x){
    if(role()==='head'||role()==='teacher')return true;
    return visibleStudents().some(s=>String(s.className||'')===String(x.className||'')&&(!x.sectionName||String(s.sectionName||'')===String(x.sectionName||'')));
  }
  const timeValue=t=>{if(!t)return null;const p=String(t).slice(0,5).split(':').map(Number);return p[0]*60+p[1]};
  const overlaps=(a1,a2,b1,b2)=>{a1=timeValue(a1);a2=timeValue(a2);b1=timeValue(b1);b2=timeValue(b2);return [a1,a2,b1,b2].every(Number.isFinite)&&a1<b2&&b1<a2};
  const label=x=>'Class '+x.className+(x.sectionName?' · '+x.sectionName:'');
  function optionList(selected='',blank='All classes'){
    return '<option value="">'+blank+'</option>'+classSections().map(x=>{const v=x.className+'|'+x.sectionName;return '<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(label(x))+'</option>'}).join('');
  }
  function splitClass(v){const [className='',sectionName='']=String(v||'').split('|');return{className,sectionName}}

  function mapTimetableRow(x){return{id:x.id,className:x.class_name,sectionName:x.section_name||'',day:x.weekday,periodNumber:Number(x.period_number||0),time:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',subject:x.subject,teacherName:x.teacher_name||'',roomLabel:x.room_label||'',createdBy:x.creator_user_id,createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}}
  function mapExamRow(x){return{id:x.id,className:x.class_name,sectionName:x.section_name||'',examName:x.exam_name,subject:x.subject,examDate:x.exam_date,startTime:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',totalMarks:Number(x.total_marks||0),roomLabel:x.room_label||'',notes:x.notes||'',createdBy:x.creator_user_id,createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}}
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId;
    const [tt,ds]=await Promise.all([
      c.from('timetable_entries').select('*').eq('institution_id',id).order('weekday').order('start_time'),
      c.from('exam_schedule_entries').select('*').eq('institution_id',id).order('exam_date').order('start_time')
    ]);
    if(tt.error)throw tt.error;if(ds.error)throw ds.error;
    writeTimetable((tt.data||[]).map(mapTimetableRow));writeDateSheets((ds.data||[]).map(mapExamRow));
  }
  async function saveCloud(kind,item){
    if(!cloudReady())return null;
    const base={institution_id:cfg().institutionId,creator_user_id:cloud().state.user.id,updated_at:new Date().toISOString()};
    const timetablePayload={...base,class_name:item.className,section_name:item.sectionName||null,weekday:item.day,period_number:item.periodNumber||null,start_time:item.time||null,end_time:item.endTime||null,subject:item.subject,teacher_name:item.teacherName||null,room_label:item.roomLabel||null};
    const examPayload={...base,class_name:item.className,section_name:item.sectionName||null,exam_name:item.examName,subject:item.subject,exam_date:item.examDate,start_time:item.startTime||null,end_time:item.endTime||null,total_marks:Number(item.totalMarks||0),room_label:item.roomLabel||null,notes:item.notes||null};
    const table=kind==='timetable'?'timetable_entries':'exam_schedule_entries',payload=kind==='timetable'?timetablePayload:examPayload;
    const q=item.cloudExisting&&uuid(item.id)?cloud().state.client.from(table).update(payload).eq('id',item.id):cloud().state.client.from(table).insert(payload);
    const {data,error}=await q.select().single();if(error)throw error;return kind==='timetable'?mapTimetableRow(data):mapExamRow(data);
  }
  async function deleteCloud(kind,id){if(!cloudReady()||!uuid(id))return;const table=kind==='timetable'?'timetable_entries':'exam_schedule_entries';const{error}=await cloud().state.client.from(table).delete().eq('id',id);if(error)throw error}

  function injectStyles(){
    if($('scheduleCenterStyles'))return;
    const s=document.createElement('style');s.id='scheduleCenterStyles';s.textContent=`
      .schedule-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.schedule-tabs .active{background:var(--edu-navy);color:#fff}
      .schedule-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:10px;align-items:center;margin:14px 0}
      .schedule-day{margin:14px 0}.schedule-day h3{margin:0 0 8px;color:var(--edu-navy)}
      .schedule-table-wrap{overflow:auto;border:1px solid var(--edu-line);border-radius:14px;background:#fff}
      .schedule-table{width:100%;border-collapse:collapse;min-width:720px}.schedule-table th,.schedule-table td{padding:11px 12px;border-bottom:1px solid var(--edu-line);text-align:left;font-size:13px}.schedule-table th{background:#f1f7f7;color:var(--edu-navy);font-size:11px;text-transform:uppercase;letter-spacing:.06em}.schedule-table tr:last-child td{border-bottom:0}
      .schedule-clash{border-left:4px solid #c7513b;background:#fff5f2}.schedule-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.schedule-summary span{padding:7px 10px;border-radius:999px;background:#eef6f5;color:#0d675f;font-size:12px;font-weight:800}
      @media(max-width:700px){.schedule-toolbar{grid-template-columns:1fr}.schedule-toolbar button{width:100%}}
    `;document.head.appendChild(s);
  }
  function managerNote(){return canManage()?'':'<div class="coverage-note">Timetable aur date sheet Head of Institute manage karta hai. Aap ko apni relevant class ka read-only schedule dikhaya ja raha hai.</div>'}

  function timetableEditor(edit=null){
    if(!canManage())return managerNote();
    const value=edit?(edit.className+'|'+(edit.sectionName||'')):'';
    return '<article class="card"><h3>'+(edit?'Edit Period':'Add Timetable Period')+'</h3><div class="form-grid">'+
      '<input id="ttEditId" type="hidden" value="'+esc(edit?.id||'')+'"><select id="ttClass">'+optionList(value,'Select class / section')+'</select>'+
      '<select id="ttDay">'+DAYS.map(d=>'<option '+(edit?.day===d?'selected':'')+'>'+d+'</option>').join('')+'</select>'+
      '<input id="ttPeriod" type="number" min="1" max="15" placeholder="Period number" value="'+esc(edit?.periodNumber||'')+'">'+
      '<input id="ttStart" type="time" value="'+esc(edit?.time||'')+'"><input id="ttEnd" type="time" value="'+esc(edit?.endTime||'')+'">'+
      '<input id="ttSubject" placeholder="Subject" value="'+esc(edit?.subject||'')+'"><input id="ttTeacher" placeholder="Teacher name" value="'+esc(edit?.teacherName||'')+'"><input id="ttRoom" placeholder="Room / lab" value="'+esc(edit?.roomLabel||'')+'">'+
      '<button id="ttSave">'+(edit?'Update Period':'Save Period')+'</button>'+(edit?'<button id="ttCancel" class="secondary">Cancel</button>':'')+'</div></article>';
  }
  function dateSheetEditor(edit=null){
    if(!canManage())return managerNote();
    const value=edit?(edit.className+'|'+(edit.sectionName||'')):'';
    return '<article class="card"><h3>'+(edit?'Edit Paper':'Add Date Sheet Paper')+'</h3><div class="form-grid">'+
      '<input id="dsEditId" type="hidden" value="'+esc(edit?.id||'')+'"><select id="dsClass">'+optionList(value,'Select class / section')+'</select>'+
      '<input id="dsExam" placeholder="Exam name e.g. Midterm" value="'+esc(edit?.examName||'')+'"><input id="dsSubject" placeholder="Subject" value="'+esc(edit?.subject||'')+'">'+
      '<input id="dsDate" type="date" value="'+esc(edit?.examDate||today())+'"><input id="dsStart" type="time" value="'+esc(edit?.startTime||'')+'"><input id="dsEnd" type="time" value="'+esc(edit?.endTime||'')+'">'+
      '<input id="dsMarks" type="number" min="1" value="'+esc(edit?.totalMarks||100)+'" placeholder="Total marks"><input id="dsRoom" placeholder="Room / hall" value="'+esc(edit?.roomLabel||'')+'"><input id="dsNotes" placeholder="Instructions / notes" value="'+esc(edit?.notes||'')+'">'+
      '<button id="dsSave">'+(edit?'Update Paper':'Save Paper')+'</button>'+(edit?'<button id="dsCancel" class="secondary">Cancel</button>':'')+'</div></article>';
  }

  function timetableClashes(rows,item,editId){
    return rows.filter(x=>String(x.id)!==String(editId)&&x.day===item.day&&(
      (x.className===item.className&&String(x.sectionName||'')===String(item.sectionName||'')&&(Number(x.periodNumber)===Number(item.periodNumber)||overlaps(x.time,x.endTime,item.time,item.endTime)))||
      (item.teacherName&&x.teacherName&&x.teacherName.toLowerCase()===item.teacherName.toLowerCase()&&overlaps(x.time,x.endTime,item.time,item.endTime))||
      (item.roomLabel&&x.roomLabel&&x.roomLabel.toLowerCase()===item.roomLabel.toLowerCase()&&overlaps(x.time,x.endTime,item.time,item.endTime))
    ));
  }
  function dateClashes(rows,item,editId){return rows.filter(x=>String(x.id)!==String(editId)&&x.examDate===item.examDate&&(
    (x.className===item.className&&String(x.sectionName||'')===String(item.sectionName||'')&&overlaps(x.startTime,x.endTime,item.startTime,item.endTime))||
    (item.roomLabel&&x.roomLabel&&x.roomLabel.toLowerCase()===item.roomLabel.toLowerCase()&&overlaps(x.startTime,x.endTime,item.startTime,item.endTime))
  ))}
  async function saveTimetable(){
    const cls=splitClass($('ttClass')?.value),editId=$('ttEditId')?.value||'';
    const item={id:editId||String(Date.now()),...cls,day:$('ttDay')?.value,periodNumber:Number($('ttPeriod')?.value||0),time:$('ttStart')?.value||'',endTime:$('ttEnd')?.value||'',subject:$('ttSubject')?.value.trim()||'',teacherName:$('ttTeacher')?.value.trim()||'',roomLabel:$('ttRoom')?.value.trim()||'',createdAt:new Date().toISOString(),cloudExisting:uuid(editId)};
    if(!item.className||!item.subject||!item.day||!item.periodNumber||!item.time||!item.endTime)return alert('Class, day, period, start/end time aur subject required hain.');
    if(timeValue(item.time)>=timeValue(item.endTime))return alert('End time start time ke baad honi chahiye.');
    const rows=timetable(),conflicts=timetableClashes(rows,item,editId);if(conflicts.length&&!confirm('Clash detected: '+conflicts.map(x=>label(x)+' / '+x.subject).join(', ')+'. Phir bhi save karein?'))return;
    try{const saved=await saveCloud('timetable',item);if(saved)item=saved}catch(e){if(cloudReady())return alert('Cloud timetable save failed: '+(e.message||e))}
    writeTimetable(rows.filter(x=>String(x.id)!==String(editId)).concat(item));render();
  }
  async function saveDateSheet(){
    const cls=splitClass($('dsClass')?.value),editId=$('dsEditId')?.value||'';
    let item={id:editId||String(Date.now()),...cls,examName:$('dsExam')?.value.trim()||'',subject:$('dsSubject')?.value.trim()||'',examDate:$('dsDate')?.value||'',startTime:$('dsStart')?.value||'',endTime:$('dsEnd')?.value||'',totalMarks:Number($('dsMarks')?.value||0),roomLabel:$('dsRoom')?.value.trim()||'',notes:$('dsNotes')?.value.trim()||'',createdAt:new Date().toISOString(),cloudExisting:uuid(editId)};
    if(!item.className||!item.examName||!item.subject||!item.examDate||!item.startTime||!item.endTime||item.totalMarks<=0)return alert('Class, exam, subject, date, start/end time aur total marks required hain.');
    if(timeValue(item.startTime)>=timeValue(item.endTime))return alert('End time start time ke baad honi chahiye.');
    const rows=dateSheets(),conflicts=dateClashes(rows,item,editId);if(conflicts.length&&!confirm('Date-sheet clash detected: '+conflicts.map(x=>label(x)+' / '+x.subject).join(', ')+'. Phir bhi save karein?'))return;
    try{const saved=await saveCloud('datesheet',item);if(saved)item=saved}catch(e){if(cloudReady())return alert('Cloud date sheet save failed: '+(e.message||e))}
    writeDateSheets(rows.filter(x=>String(x.id)!==String(editId)).concat(item));render();
  }
  async function remove(kind,id){
    if(!canManage())return;const rows=kind==='timetable'?timetable():dateSheets(),item=rows.find(x=>String(x.id)===String(id));if(!item||!confirm('Delete '+(item.subject||'entry')+'?'))return;
    try{await deleteCloud(kind,id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    if(kind==='timetable')writeTimetable(rows.filter(x=>String(x.id)!==String(id)));else writeDateSheets(rows.filter(x=>String(x.id)!==String(id)));render();
  }

  function timetableRows(rows){
    if(!rows.length)return '<div class="empty-state">Is class ka timetable abhi available nahi hai.</div>';
    return DAYS.map(day=>{const list=rows.filter(x=>x.day===day).sort((a,b)=>Number(a.periodNumber)-Number(b.periodNumber)||String(a.time).localeCompare(String(b.time)));if(!list.length)return'';
      return '<section class="schedule-day"><h3>'+day+'</h3><div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th>'+(canManage()?'<th>Actions</th>':'')+'</tr></thead><tbody>'+list.map(x=>'<tr><td>'+Number(x.periodNumber||0)+'</td><td>'+esc(x.time)+' – '+esc(x.endTime||'')+'</td><td><strong>'+esc(x.subject)+'</strong></td><td>'+esc(x.teacherName||'—')+'</td><td>'+esc(x.roomLabel||'—')+'</td>'+(canManage()?'<td><button data-tt-edit="'+esc(x.id)+'">Edit</button> <button class="secondary" data-tt-delete="'+esc(x.id)+'">Delete</button></td>':'')+'</tr>').join('')+'</tbody></table></div></section>';
    }).join('');
  }
  function dateSheetRows(rows){
    if(!rows.length)return '<div class="empty-state">Is selection ke liye date sheet available nahi hai.</div>';
    return '<div class="paper-grid">'+rows.map(x=>'<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.examName)+'</span><span class="badge">'+esc(x.examDate)+'</span></div><h3>'+esc(x.subject)+'</h3><p class="muted">'+esc(label(x))+' · '+esc(x.startTime)+' – '+esc(x.endTime||'')+(x.roomLabel?' · '+esc(x.roomLabel):'')+'</p><p>Total Marks: '+Number(x.totalMarks||0)+(x.notes?' · '+esc(x.notes):'')+'</p>'+(canManage()?'<div class="paper-actions"><button data-ds-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-ds-delete="'+esc(x.id)+'">Delete</button></div>':'')+'</article>').join('')+'</div>';
  }
  function printView(kind,rows,title){
    if(!rows.length)return alert('Print karne ke liye record available nahi hai.');
    const school=(()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}').schoolName||'EduNizam Institute'}catch{return'EduNizam Institute'}})();
    const body=kind==='timetable'?timetableRows(rows):dateSheetRows(rows);const w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked. Browser mein popups allow karein.');
    w.document.write('<!doctype html><html><head><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;color:#17324a;padding:26px}header{text-align:center;margin-bottom:20px}h1{margin:4px}.schedule-table{width:100%;border-collapse:collapse;margin-bottom:18px}.schedule-table th,.schedule-table td{border:1px solid #ccd8de;padding:8px;text-align:left}.paper-grid{display:grid;gap:10px}.paper-card{border:1px solid #ccd8de;border-radius:10px;padding:12px}.paper-card-top{display:flex;justify-content:space-between}.mini-badge,.badge{font-weight:bold}.paper-actions,button{display:none}.muted{color:#5f6e76}@media print{body{padding:0}}</style></head><body><header><strong>'+esc(school)+'</strong><h1>'+esc(title)+'</h1><small>Generated by EduNizam</small></header>'+body+'</body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(){
    $('ttSave')?.addEventListener('click',saveTimetable);$('dsSave')?.addEventListener('click',saveDateSheet);$('ttCancel')?.addEventListener('click',render);$('dsCancel')?.addEventListener('click',render);
    $('scheduleClassFilter')?.addEventListener('change',e=>{const root=$('scheduleCenterApp');root.dataset.classFilter=e.target.value;render()});
    $('dateExamFilter')?.addEventListener('change',e=>{const root=$('scheduleCenterApp');root.dataset.examFilter=e.target.value;render()});
    $('printSchedule')?.addEventListener('click',()=>{const root=$('scheduleCenterApp'),f=root.dataset.classFilter||'',rows=timetable().filter(accessible).filter(x=>!f||x.className+'|'+(x.sectionName||'')===f);printView('timetable',rows,'Weekly Timetable'+(f?' — '+label(splitClass(f)):'') )});
    $('printDateSheet')?.addEventListener('click',()=>{const root=$('scheduleCenterApp'),f=root.dataset.classFilter||'',ex=root.dataset.examFilter||'',rows=dateSheets().filter(accessible).filter(x=>(!f||x.className+'|'+(x.sectionName||'')===f)&&(!ex||x.examName===ex)).sort((a,b)=>a.examDate.localeCompare(b.examDate)||a.startTime.localeCompare(b.startTime));printView('datesheet',rows,'Date Sheet'+(ex?' — '+ex:'')+(f?' — '+label(splitClass(f)):'') )});
    document.querySelectorAll('[data-tt-edit]').forEach(b=>b.onclick=()=>{const x=timetable().find(r=>String(r.id)===String(b.dataset.ttEdit));if(x){$('scheduleEditor').innerHTML=timetableEditor(x);bind()}});
    document.querySelectorAll('[data-ds-edit]').forEach(b=>b.onclick=()=>{const x=dateSheets().find(r=>String(r.id)===String(b.dataset.dsEdit));if(x){$('scheduleEditor').innerHTML=dateSheetEditor(x);bind()}});
    document.querySelectorAll('[data-tt-delete]').forEach(b=>b.onclick=()=>remove('timetable',b.dataset.ttDelete));document.querySelectorAll('[data-ds-delete]').forEach(b=>b.onclick=()=>remove('datesheet',b.dataset.dsDelete));
  }
  async function render(){
    const root=$('scheduleCenterApp');if(!root)return;injectStyles();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Schedule cloud sync:',e.message)}}
    const tab=root.dataset.tab||'timetable',filter=root.dataset.classFilter||'',examFilter=root.dataset.examFilter||'';
    let tt=timetable().filter(accessible),ds=dateSheets().filter(accessible);if(filter){tt=tt.filter(x=>x.className+'|'+(x.sectionName||'')===filter);ds=ds.filter(x=>x.className+'|'+(x.sectionName||'')===filter)}
    const exams=[...new Set(ds.map(x=>x.examName).filter(Boolean))].sort();if(examFilter)ds=ds.filter(x=>x.examName===examFilter);ds.sort((a,b)=>String(a.examDate).localeCompare(String(b.examDate))||String(a.startTime).localeCompare(String(b.startTime)));
    root.innerHTML='<div class="section-head"><div class="schedule-tabs"><button class="secondary '+(tab==='timetable'?'active':'')+'" data-schedule-tab="timetable">Weekly Timetable</button><button class="secondary '+(tab==='datesheet'?'active':'')+'" data-schedule-tab="datesheet">Date Sheets</button></div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      '<div class="schedule-toolbar"><select id="scheduleClassFilter">'+optionList(filter,'All accessible classes')+'</select>'+(tab==='datesheet'?'<select id="dateExamFilter"><option value="">All exams</option>'+exams.map(x=>'<option '+(x===examFilter?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>':'<span></span>')+'<button id="'+(tab==='timetable'?'printSchedule':'printDateSheet')+'" class="secondary">Print '+(tab==='timetable'?'Timetable':'Date Sheet')+'</button></div>'+
      '<div class="schedule-summary"><span>'+tt.length+' timetable periods</span><span>'+ds.length+' date-sheet papers</span></div><div id="scheduleEditor">'+(tab==='timetable'?timetableEditor():dateSheetEditor())+'</div><div style="margin-top:18px">'+(tab==='timetable'?timetableRows(tt):dateSheetRows(ds))+'</div>';
    root.querySelectorAll('[data-schedule-tab]').forEach(b=>b.onclick=()=>{root.dataset.tab=b.dataset.scheduleTab;render()});bind();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('scheduleCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_TIMETABLE_DATESHEET={render,pullCloud,cloudReady};
})();
