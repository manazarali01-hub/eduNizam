(function(){
  const KEY='edunizam_calendar_events_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const canCreate=()=>role()==='head'||role()==='teacher';
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const monthKey=()=>today().slice(0,7);
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function currentUserId(){return cloud()?.state?.user?.id||''}
  function classes(){
    const set=new Set();
    students().forEach(s=>{if(s.className)set.add(String(s.className))});
    try{JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]').forEach(x=>{if(x.className)set.add(String(x.className))})}catch(_){}
    return [...set].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  }
  function relevantLocal(x){
    const r=role();
    if(r==='head'||r==='teacher')return true;
    if(x.audience==='all')return true;
    if(r==='student'&&x.audience==='students')return true;
    if(r==='parent'&&x.audience==='parents')return true;
    if(x.audience==='class'){
      return visibleStudents().some(s=>String(s.className||'')===String(x.className||'')&&(!x.sectionName||String(s.sectionName||'')===String(x.sectionName||'')));
    }
    return false;
  }
  function canManageEvent(x){
    if(isHead())return true;
    return role()==='teacher'&&(!x.creatorUserId||String(x.creatorUserId)===String(currentUserId()));
  }
  function toLocal(x){
    return {id:x.id,title:x.title,category:x.category,eventDate:x.event_date,startTime:x.start_time||'',endTime:x.end_time||'',audience:x.audience,className:x.class_name||'',sectionName:x.section_name||'',location:x.location||'',notes:x.notes||'',creatorUserId:x.creator_user_id||'',creatorRole:x.creator_role||'',createdAt:x.created_at};
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('school_calendar_events').select('*')
      .eq('institution_id',cfg().institutionId).order('event_date',{ascending:true}).order('start_time',{ascending:true});
    if(error)throw error;
    const rows=(data||[]).map(toLocal);write(rows);return rows;
  }
  async function saveCloud(item){
    if(!cloudReady())return null;
    const payload={institution_id:cfg().institutionId,creator_user_id:currentUserId(),creator_role:role()==='head'?'head':'teacher',title:item.title,category:item.category,event_date:item.eventDate,start_time:item.startTime||null,end_time:item.endTime||null,audience:item.audience,class_name:item.className||null,section_name:item.sectionName||null,location:item.location||null,notes:item.notes||null,updated_at:new Date().toISOString()};
    const q=item.cloudExisting
      ?cloud().state.client.from('school_calendar_events').update(payload).eq('id',item.id)
      :cloud().state.client.from('school_calendar_events').insert(payload);
    const {data,error}=await q.select().single();if(error)throw error;return toLocal(data);
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('school_calendar_events').delete().eq('id',id);if(error)throw error;
  }
  function editor(edit=null){
    if(!canCreate())return '<div class="coverage-note">Aap ko sirf relevant school events dikhaye ja rahe hain.</div>';
    return '<article class="card"><h3>'+(edit?'Edit Event':'Add Calendar Event')+'</h3><div class="form-grid">'+
      '<input id="calEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="calTitle" placeholder="Event title" value="'+esc(edit?.title||'')+'">'+
      '<select id="calCategory">'+['Holiday','PTM','Exam','Fee Due','Meeting','Activity','Other'].map(x=>'<option '+(edit?.category===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<input id="calDate" type="date" value="'+esc(edit?.eventDate||today())+'">'+
      '<input id="calStart" type="time" value="'+esc(edit?.startTime||'')+'">'+
      '<input id="calEnd" type="time" value="'+esc(edit?.endTime||'')+'">'+
      '<select id="calAudience">'+[['all','All Institute'],['students','Students'],['parents','Parents'],['staff','Staff'],['class','Specific Class']].map(x=>'<option value="'+x[0]+'" '+(edit?.audience===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+
      '<select id="calClass"><option value="">Class (if specific)</option>'+classes().map(c=>'<option value="'+esc(c)+'" '+(edit?.className===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="calSection" placeholder="Section (optional)" value="'+esc(edit?.sectionName||'')+'">'+
      '<input id="calLocation" placeholder="Location / room (optional)" value="'+esc(edit?.location||'')+'">'+
      '<input id="calNotes" placeholder="Notes (optional)" value="'+esc(edit?.notes||'')+'">'+
      '<button id="calSave">'+(edit?'Update Event':'Save Event')+'</button>'+
      (edit?'<button id="calCancel" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function eventCard(x){
    const when=x.startTime?(x.startTime+(x.endTime?' - '+x.endTime:'')):'All day';
    const target=x.audience==='class'?('Class '+x.className+(x.sectionName?' - '+x.sectionName:'')):x.audience;
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.category)+'</span><span class="badge">'+esc(x.eventDate)+'</span></div>'+
      '<h3>'+esc(x.title)+'</h3><p class="muted">'+esc(when)+' · '+esc(target)+(x.location?' · '+esc(x.location):'')+'</p>'+
      (x.notes?'<p>'+esc(x.notes)+'</p>':'')+
      (canManageEvent(x)?'<div class="paper-actions"><button data-cal-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-cal-delete="'+esc(x.id)+'">Delete</button></div>':'')+
      '</article>';
  }
  function monthRows(rows,month){return rows.filter(x=>String(x.eventDate||'').startsWith(month)&&relevantLocal(x))}
  function upcomingRows(rows){
    const t=today();
    return rows.filter(x=>x.eventDate>=t&&relevantLocal(x)).sort((a,b)=>String(a.eventDate).localeCompare(String(b.eventDate))||String(a.startTime).localeCompare(String(b.startTime))).slice(0,6);
  }
  async function save(){
    const title=$('calTitle')?.value.trim(),category=$('calCategory')?.value,eventDate=$('calDate')?.value,audience=$('calAudience')?.value,className=$('calClass')?.value||'',sectionName=$('calSection')?.value.trim()||'';
    if(!title||!eventDate||!audience)return alert('Title, date aur audience required hain.');
    if(audience==='class'&&!className)return alert('Specific Class audience ke liye class select karein.');
    const rows=read(),editId=$('calEditId')?.value||'',old=rows.find(x=>String(x.id)===String(editId));
    let item={id:editId||String(Date.now()),title,category,eventDate,startTime:$('calStart')?.value||'',endTime:$('calEnd')?.value||'',audience,className:audience==='class'?className:'',sectionName:audience==='class'?sectionName:'',location:$('calLocation')?.value.trim()||'',notes:$('calNotes')?.value.trim()||'',creatorUserId:old?.creatorUserId||currentUserId(),creatorRole:old?.creatorRole||role(),createdAt:old?.createdAt||new Date().toISOString(),cloudExisting:!!(old&&cloudReady())};
    try{const c=await saveCloud(item);if(c)item=c}catch(e){if(cloudReady())return alert('Cloud calendar save failed: '+(e.message||e))}
    const next=rows.filter(x=>String(x.id)!==String(editId));next.push(item);write(next);render();
  }
  async function edit(id){
    const x=read().find(r=>String(r.id)===String(id));if(!x||!canManageEvent(x))return;
    const box=$('calEditor');if(box)box.innerHTML=editor(x);bindEditor();
  }
  async function remove(id){
    const x=read().find(r=>String(r.id)===String(id));if(!x||!canManageEvent(x))return;
    if(!confirm('Delete '+x.title+'?'))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(r=>String(r.id)!==String(id)));render();
  }
  function bindEditor(){
    $('calSave')?.addEventListener('click',save);$('calCancel')?.addEventListener('click',render);
    $('calAudience')?.addEventListener('change',()=>{const show=$('calAudience').value==='class';if($('calClass'))$('calClass').style.display=show?'block':'none';if($('calSection'))$('calSection').style.display=show?'block':'none'});
    $('calAudience')?.dispatchEvent(new Event('change'));
  }
  function bind(){
    bindEditor();$('calMonth')?.addEventListener('change',render);
    document.querySelectorAll('[data-cal-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.calEdit));
    document.querySelectorAll('[data-cal-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.calDelete));
  }
  async function render(){
    const root=$('calendarCenterApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Calendar cloud sync:',e.message)}}
    const month=$('calMonth')?.value||root.dataset.month||monthKey();root.dataset.month=month;
    const monthList=monthRows(rows,month).sort((a,b)=>String(a.eventDate).localeCompare(String(b.eventDate))||String(a.startTime).localeCompare(String(b.startTime)));
    const upcoming=upcomingRows(rows);
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><input id="calMonth" type="month" value="'+esc(month)+'"></div>'+
      '<div id="calEditor">'+editor()+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Upcoming Events</h3><p class="muted">Next relevant school dates.</p></div></div><div class="paper-grid">'+(upcoming.length?upcoming.map(eventCard).join(''):'<div class="empty-state">No upcoming events.</div>')+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>'+esc(month)+' Calendar</h3><p class="muted">Selected month events.</p></div></div><div class="paper-grid">'+(monthList.length?monthList.map(eventCard).join(''):'<div class="empty-state">Is month mein koi event nahi hai.</div>')+'</div>';
    bind();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('calendarCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_CALENDAR_CENTER={render,pullCloud,cloudReady};
})();