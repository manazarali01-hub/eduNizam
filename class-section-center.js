(function(){
  const KEY='edunizam_class_sections_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function staff(){try{return JSON.parse(localStorage.getItem('edunizam_staff_profiles_v1')||'[]')}catch{return[]}}
  function teacherName(row){
    if(row.classTeacherName)return row.classTeacherName;
    const s=staff().find(x=>String(x.id)===String(row.classTeacherStaffId));return s?.fullName||'Not assigned';
  }
  function studentCount(row){
    return students().filter(s=>String(s.className||'').trim()===String(row.className||'').trim()&&String(s.sectionName||'').trim()===String(row.sectionName||'').trim()).length;
  }
  function localTeacherOptions(selected=''){
    return '<option value="">No class teacher</option>'+staff().filter(x=>x.status!=='inactive').map(x=>
      '<option value="'+esc(x.id)+'" '+(String(x.id)===String(selected)?'selected':'')+'>'+esc(x.fullName)+' · '+esc(x.designation||'Teacher')+'</option>'
    ).join('');
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('class_sections').select('*')
      .eq('institution_id',cfg().institutionId).order('class_name').order('section_name');
    if(error)throw error;
    const rows=(data||[]).map(x=>({
      id:x.id,className:x.class_name,sectionName:x.section_name,
      classTeacherUserId:x.class_teacher_user_id||'',classTeacherName:x.class_teacher_name||'',
      roomLabel:x.room_label||'',capacity:Number(x.capacity||0),active:x.active!==false,createdAt:x.created_at
    }));
    write(rows);return rows;
  }
  async function saveCloud(item){
    if(!cloudReady())return null;
    const localStaff=staff().find(x=>String(x.id)===String(item.classTeacherStaffId));
    const payload={
      institution_id:cfg().institutionId,class_name:item.className,section_name:item.sectionName,
      class_teacher_user_id:localStaff?.userId||null,
      class_teacher_name:localStaff?.fullName||item.classTeacherName||null,
      room_label:item.roomLabel||null,capacity:item.capacity||null,active:item.active!==false,
      updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    };
    const {data,error}=await cloud().state.client.from('class_sections')
      .upsert(payload,{onConflict:'institution_id,class_name,section_name'}).select().single();
    if(error)throw error;
    return {id:data.id,className:data.class_name,sectionName:data.section_name,classTeacherUserId:data.class_teacher_user_id||'',classTeacherName:data.class_teacher_name||'',roomLabel:data.room_label||'',capacity:Number(data.capacity||0),active:data.active!==false,createdAt:data.created_at};
  }
  async function removeCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('class_sections').delete().eq('id',id);if(error)throw error;
  }
  async function assignCloud(studentLocalId,className,sectionName){
    if(!cloudReady())return;
    const s=students().find(x=>String(x.id)===String(studentLocalId));if(!s)return;
    let q=cloud().state.client.from('core_students').update({class_name:className,section_name:sectionName,updated_at:new Date().toISOString()})
      .eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {error}=await q;if(error)throw error;
  }
  function editor(edit=null){
    if(!isHead())return '<div class="coverage-note">Teacher class/section structure read-only dekh sakta hai. Changes Head of Institute karta hai.</div>';
    return '<article class="card"><h3>'+(edit?'Edit Section':'Add Class / Section')+'</h3><div class="form-grid">'+
      '<input id="csEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="csClass" placeholder="Class e.g. 5" value="'+esc(edit?.className||'')+'">'+
      '<input id="csSection" placeholder="Section e.g. A" value="'+esc(edit?.sectionName||'')+'">'+
      '<select id="csTeacher">'+localTeacherOptions(edit?.classTeacherStaffId||'')+'</select>'+
      '<input id="csRoom" placeholder="Room / campus label" value="'+esc(edit?.roomLabel||'')+'">'+
      '<input id="csCapacity" type="number" min="1" placeholder="Capacity" value="'+esc(edit?.capacity||'')+'">'+
      '<select id="csActive"><option value="true" '+(edit?.active===false?'':'selected')+'>Active</option><option value="false" '+(edit?.active===false?'selected':'')+'>Inactive</option></select>'+
      '<button id="csSave">'+(edit?'Update Section':'Save Section')+'</button>'+
      (edit?'<button id="csCancel" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function allocation(){
    if(!isHead())return '';
    const rows=read().filter(x=>x.active!==false);
    return '<article class="card" style="margin-top:16px"><h3>Allocate Student to Section</h3><div class="form-grid">'+
      '<select id="csStudent"><option value="">Select student</option>'+students().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<select id="csTarget"><option value="">Select class / section</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.className)+' - '+esc(x.sectionName)+'</option>').join('')+'</select>'+
      '<button id="csAssign">Assign Student</button></div></article>';
  }
  function card(x){
    const count=studentCount(x),full=x.capacity>0&&count>=x.capacity;
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">Class '+esc(x.className)+' - '+esc(x.sectionName)+'</span><span id="profileRiskBadge" data-risk="'+(x.active===false?'high':full?'medium':'good')+'">'+(x.active===false?'Inactive':full?'Full':'Active')+'</span></div>'+
      '<h3>'+esc(teacherName(x))+'</h3><p class="muted">Class Teacher'+(x.roomLabel?' · '+esc(x.roomLabel):'')+'</p>'+
      '<p><strong>Students:</strong> '+count+(x.capacity?' / '+x.capacity:'')+'</p>'+
      (isHead()?'<div class="paper-actions"><button data-cs-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-cs-delete="'+esc(x.id)+'">Delete</button></div>':'')+
      '</article>';
  }
  async function save(){
    const className=$('csClass')?.value.trim(),sectionName=$('csSection')?.value.trim();
    if(!className||!sectionName)return alert('Class aur section required hain.');
    const rows=read(),editId=$('csEditId')?.value||'',staffId=$('csTeacher')?.value||'';
    let item={id:editId||String(Date.now()),className,sectionName,classTeacherStaffId:staffId,classTeacherName:staff().find(x=>String(x.id)===String(staffId))?.fullName||'',roomLabel:$('csRoom')?.value.trim()||'',capacity:Number($('csCapacity')?.value||0),active:$('csActive')?.value==='true',createdAt:new Date().toISOString()};
    const duplicate=rows.find(x=>String(x.className).toLowerCase()===className.toLowerCase()&&String(x.sectionName).toLowerCase()===sectionName.toLowerCase()&&String(x.id)!==String(editId));
    if(duplicate)return alert('Ye class/section already exists.');
    try{const c=await saveCloud(item);if(c){c.classTeacherStaffId=staffId;item=c}}catch(e){alert('Cloud sync failed; section local mode mein save hoga. '+(e.message||e))}
    const next=rows.filter(x=>String(x.id)!==String(editId)&&!(String(x.className).toLowerCase()===className.toLowerCase()&&String(x.sectionName).toLowerCase()===sectionName.toLowerCase()));
    next.push(item);write(next);render();
  }
  async function assign(){
    const sid=$('csStudent')?.value,targetId=$('csTarget')?.value;
    const row=read().find(x=>String(x.id)===String(targetId));if(!sid||!row)return alert('Student aur class/section select karein.');
    const count=studentCount(row),already=students().find(s=>String(s.id)===String(sid)&&s.className===row.className&&s.sectionName===row.sectionName);
    if(row.capacity>0&&count>=row.capacity&&!already)return alert('Selected section capacity full hai.');
    try{await assignCloud(sid,row.className,row.sectionName)}catch(e){if(cloudReady())return alert('Cloud allocation failed: '+(e.message||e))}
    if(window.EDUNIZAM_STUDENT_BRIDGE?.update)window.EDUNIZAM_STUDENT_BRIDGE.update(sid,{className:row.className,sectionName:row.sectionName});
    else{
      const arr=students(),s=arr.find(x=>String(x.id)===String(sid));if(s){s.className=row.className;s.sectionName=row.sectionName;localStorage.setItem('edunizam_students',JSON.stringify(arr))}
    }
    render();
  }
  async function edit(id){
    const x=read().find(r=>String(r.id)===String(id));if(!x)return;
    if(x.classTeacherUserId&&!x.classTeacherStaffId){
      const match=staff().find(s=>s.userId&&s.userId===x.classTeacherUserId);if(match)x.classTeacherStaffId=match.id;
    }
    const box=$('csEditor');if(box)box.innerHTML=editor(x);bindEditor();
  }
  async function remove(id){
    if(!isHead())return;
    const x=read().find(r=>String(r.id)===String(id));if(!x)return;
    if(studentCount(x)>0)return alert('Pehle is section ke students kisi aur section mein move karein.');
    if(!confirm('Delete Class '+x.className+' - '+x.sectionName+'?'))return;
    try{await removeCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(r=>String(r.id)!==String(id)));render();
  }
  function bindEditor(){
    $('csSave')?.addEventListener('click',save);$('csCancel')?.addEventListener('click',render);
  }
  function bind(){
    bindEditor();$('csAssign')?.addEventListener('click',assign);
    document.querySelectorAll('[data-cs-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.csEdit));
    document.querySelectorAll('[data-cs-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.csDelete));
  }
  async function render(){
    const root=$('classSectionApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Class/section cloud sync:',e.message)}
    }
    rows=[...rows].sort((a,b)=>String(a.className).localeCompare(String(b.className),undefined,{numeric:true})||String(a.sectionName).localeCompare(String(b.sectionName)));
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      '<div id="csEditor">'+editor()+'</div>'+allocation()+
      '<div class="section-head" style="margin-top:18px"><div><h3>Class / Section Directory</h3><p class="muted">Class teacher, room aur current student strength.</p></div></div>'+
      '<div class="paper-grid">'+(rows.length?rows.map(card).join(''):'<div class="empty-state">Abhi koi class/section setup nahi hai.</div>')+'</div>';
    bind();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('classSectionApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_CLASS_SECTION_CENTER={render,read,pullCloud,cloudReady};
})();