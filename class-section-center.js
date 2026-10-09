(function(){
  // v2 cache is tied to the authenticated institution AND account.
  // The old unscoped local-only directory is never treated as school data.
  const KEY='edunizam_class_sections_v2';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  let classSectionSaveInFlight=false,classSectionAssignInFlight=false;
  const classSectionDeleteInFlight=new Set();
  function setBusy(btn,busy,label='Working...'){
    if(!btn)return;
    if(busy){if(!btn.dataset.busyLabel)btn.dataset.busyLabel=btn.textContent||'';btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent=label}
    else{btn.disabled=false;btn.removeAttribute('aria-busy');if(btn.dataset.busyLabel!==undefined){btn.textContent=btn.dataset.busyLabel;delete btn.dataset.busyLabel}}
  }
  function withSignal(q,signal){return signal&&typeof q?.abortSignal==='function'?q.abortSignal(signal):q}
  async function runCloud(key,label,factory,{timeout=7000,retries=1}={}){
    const runtime=window.EDUNIZAM_DATA_RUNTIME;
    return runtime?runtime.run(key,factory,{timeout,retries,label}):factory({});
  }
  const cacheScope=()=>cloudReady()?String(cfg().institutionId)+'|'+String(cloud().state.user.id):'';
  function read(){
    const scope=cacheScope();if(!scope)return[];
    try{const cached=JSON.parse(localStorage.getItem(KEY)||'null');return cached?.scope===scope&&Array.isArray(cached.rows)?cached.rows:[]}
    catch{return[]}
  }
  function write(v){const scope=cacheScope();if(scope)localStorage.setItem(KEY,JSON.stringify({scope,rows:v}))}
  // Do not use shared local student/staff caches: they can contain a
  // different school's names until the background cloud sync finishes.
  let people={scope:'',students:[],staff:[],studentStatus:'unchecked',staffStatus:'unchecked'};
  const currentPeople=()=>people.scope===cacheScope()?people:null;
  const students=()=>currentPeople()?.students||[];
  const staff=()=>currentPeople()?.staff||[];
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
  async function loadPeople(inst,requestScope){
    const query=async(table,columns)=>{
      const result=await runCloud('class-section-directory:'+table+':'+inst,'Current school '+table,async({signal}={})=>{
        let q=cloud().state.client.from(table).select(columns).eq('institution_id',inst).limit(1000);
        q=withSignal(q,signal);const out=await q;
        if(out.error)throw out.error;return out.data||[];
      },{timeout:8000,retries:1});
      return result;
    };
    const [studentRows,staffRows]=await Promise.allSettled([
      query('core_students','id,name,student_code,class_name,section_name'),
      query('staff_profiles','id,user_id,full_name,designation')
    ]);
    if(cacheScope()!==requestScope)return;
    people={
      scope:requestScope,
      students:studentRows.status==='fulfilled'?studentRows.value.map(x=>({
        id:x.id,name:x.name||'',studentId:x.student_code||'',className:x.class_name||'',sectionName:x.section_name||''
      })):[],
      staff:staffRows.status==='fulfilled'?staffRows.value.map(x=>({
        id:x.id,userId:x.user_id||'',fullName:x.full_name||'',designation:x.designation||'Teacher',status:'active'
      })):[],
      studentStatus:studentRows.status==='fulfilled'?'loaded':'error',
      staffStatus:staffRows.status==='fulfilled'?'loaded':'error'
    };
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const inst=cfg().institutionId,requestScope=cacheScope();
    const result=await runCloud('class-sections-load:'+inst,'Class and section directory',async({signal}={})=>{
      let q=cloud().state.client.from('class_sections').select('*').eq('institution_id',inst).order('class_name').order('section_name');
      q=withSignal(q,signal);const out=await q;if(out.error)throw out.error;return out;
    },{timeout:7000,retries:1});
    const rows=(result.data||[]).map(x=>({
      id:x.id,className:x.class_name,sectionName:x.section_name,
      classTeacherUserId:x.class_teacher_user_id||'',classTeacherName:x.class_teacher_name||'',
      roomLabel:x.room_label||'',capacity:Number(x.capacity||0),active:x.active!==false,createdAt:x.created_at
    }));
    // A response from the former school/account must never replace the new directory.
    if(cacheScope()!==requestScope)return read();
    write(rows);
    await loadPeople(inst,requestScope);
    return cacheScope()===requestScope?rows:read();
  }
  async function saveCloud(item){
    if(!cloudReady())throw new Error('Sign in to a verified school workspace before saving classes.');
    const localStaff=staff().find(x=>String(x.id)===String(item.classTeacherStaffId));
    const payload={
      institution_id:cfg().institutionId,class_name:item.className,section_name:item.sectionName,
      class_teacher_user_id:localStaff?.userId||null,
      class_teacher_name:localStaff?.fullName||item.classTeacherName||null,
      room_label:item.roomLabel||null,capacity:item.capacity||null,active:item.active!==false,
      updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    };
    const inst=cfg().institutionId;
    return runCloud('class-section-save:'+inst+':'+item.className+':'+item.sectionName,'Save class section',async({signal}={})=>{
      // An edited class may change its name/section. Upsert by the NAME
      // mistakenly inserts a second row, leaving the old class in production.
      let q=item.cloudExisting
        ?cloud().state.client.from('class_sections').update(payload).eq('institution_id',inst).eq('id',item.id).select().single()
        :cloud().state.client.from('class_sections').insert(payload).select().single();
      q=withSignal(q,signal);const {data,error}=await q;if(error)throw error;
      return {id:data.id,className:data.class_name,sectionName:data.section_name,classTeacherUserId:data.class_teacher_user_id||'',classTeacherName:data.class_teacher_name||'',roomLabel:data.room_label||'',capacity:Number(data.capacity||0),active:data.active!==false,createdAt:data.created_at};
    },{timeout:8000,retries:1});
  }
  async function removeCloud(id){
    if(!cloudReady())throw new Error('Verified school connection required to delete classes.');
    const inst=cfg().institutionId;
    return runCloud('class-section-delete:'+inst+':'+id,'Delete class section',async({signal}={})=>{
      let q=cloud().state.client.from('class_sections').delete().eq('institution_id',inst).eq('id',id).select('id');q=withSignal(q,signal);
      const {data,error}=await q;if(error)throw error;
      if(!data?.length)throw new Error('Class was not deleted. Check current-school access and reload.');
    },{timeout:8000,retries:1});
  }
  async function assignCloud(studentLocalId,className,sectionName){
    if(!cloudReady())throw new Error('Verified school connection required to assign students.');
    const s=students().find(x=>String(x.id)===String(studentLocalId));if(!s)throw new Error('Selected student is not in the loaded school student directory.');
    const inst=cfg().institutionId;
    return runCloud('class-section-assign:'+inst+':'+s.id,'Assign student section',async({signal}={})=>{
      // The UUID came from a current-school filtered query, not a browser
      // local ID or a potentially duplicated school-issued student code.
      let q=cloud().state.client.from('core_students')
        .update({class_name:className,section_name:sectionName,updated_at:new Date().toISOString()})
        .eq('institution_id',inst).eq('id',s.id);
      q=q.select('id').maybeSingle();q=withSignal(q,signal);
      const {data,error}=await q;if(error)throw error;
      if(!data?.id)throw new Error('Student was not updated in the current school. Refresh enrolled students.');
    },{timeout:8000,retries:1});
  }
  function editor(edit=null){
    if(!isHead())return '<div class="coverage-note">Teacher class/section structure read-only dekh sakta hai. Changes Head of Institute karta hai.</div>';
    if(!cloudReady())return '<div class="coverage-note">Verified school cloud login required to create or edit classes. No offline-only sections will be counted as saved.</div>';
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
    if(!isHead()||!cloudReady())return '';
    const rows=read().filter(x=>x.active!==false),studentStatus=currentPeople()?.studentStatus;
    return '<article class="card" style="margin-top:16px"><h3>Allocate Student to Section</h3>'+
      (studentStatus==='error'?'<p class="coverage-note">Current-school student directory unavailable. Check access and Refresh School Records; do not use old cached students.</p>':'')+
      '<div class="form-grid">'+
      '<select id="csStudent">'+window.EDUNIZAM_STUDENT_PICKER.options(students())+'</select>'+
      '<select id="csTarget"><option value="">Select class / section</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.className)+' - '+esc(x.sectionName)+'</option>').join('')+'</select>'+
      '<button id="csAssign"'+(students().length&&rows.length?'':' disabled')+'>Assign Student</button>'+(students().length&&rows.length?'':'<p class="coverage-note">Add real students and active class sections before allocating.</p>')+'</div></article>';
  }
  function card(x){
    const count=currentPeople()?.studentStatus==='loaded'?studentCount(x):null,full=count!==null&&x.capacity>0&&count>=x.capacity;
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">Class '+esc(x.className)+' - '+esc(x.sectionName)+'</span><span id="profileRiskBadge" data-risk="'+(x.active===false?'high':full?'medium':'good')+'">'+(x.active===false?'Inactive':full?'Full':'Active')+'</span></div>'+
      '<h3>'+esc(teacherName(x))+'</h3><p class="muted">Class Teacher'+(x.roomLabel?' · '+esc(x.roomLabel):'')+'</p>'+
      '<p><strong>Students:</strong> '+(count===null?'Unavailable (retry)':count)+(x.capacity&&count!==null?' / '+x.capacity:'')+'</p>'+
      (isHead()?'<div class="paper-actions"><button data-cs-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-cs-delete="'+esc(x.id)+'">Delete</button></div>':'')+
      '</article>';
  }
  async function save(){
    const btn=$('csSave');if(classSectionSaveInFlight||btn?.disabled)return;
    if(!isHead()||!cloudReady())return alert('Please sign in as Head of Institute to your verified school before saving.');
    if(currentPeople()?.staffStatus==='error')return alert('Teacher directory could not be verified. Refresh School Records before saving.');
    const className=$('csClass')?.value.trim(),sectionName=$('csSection')?.value.trim();
    if(!className||!sectionName)return alert('Class aur section required hain.');
    const rows=read(),editId=$('csEditId')?.value||'',staffId=$('csTeacher')?.value||'';
    let item={id:editId||'',cloudExisting:!!editId,className,sectionName,classTeacherStaffId:staffId,classTeacherName:staff().find(x=>String(x.id)===String(staffId))?.fullName||'',roomLabel:$('csRoom')?.value.trim()||'',capacity:Number($('csCapacity')?.value||0),active:$('csActive')?.value==='true',createdAt:new Date().toISOString()};
    const duplicate=rows.find(x=>String(x.className).toLowerCase()===className.toLowerCase()&&String(x.sectionName).toLowerCase()===sectionName.toLowerCase()&&String(x.id)!==String(editId));
    if(duplicate)return alert('Ye class/section already exists.');
    classSectionSaveInFlight=true;setBusy(btn,true,editId?'Updating...':'Saving...');
    try{
      const requestScope=cacheScope();
      try{const saved=await saveCloud(item);saved.classTeacherStaffId=staffId;item=saved}
      catch(e){return alert('Cloud class/section save failed. Nothing was saved locally: '+(e.message||e))}
      if(cacheScope()!==requestScope)return;
      const next=rows.filter(x=>String(x.id)!==String(editId)&&!(String(x.className).toLowerCase()===className.toLowerCase()&&String(x.sectionName).toLowerCase()===sectionName.toLowerCase()));
      next.push(item);write(next);render();
    }finally{classSectionSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  async function assign(){
    const btn=$('csAssign');if(classSectionAssignInFlight||btn?.disabled)return;
    if(!isHead()||!cloudReady())return alert('Verified school cloud login required to assign students.');
    const sid=$('csStudent')?.value,targetId=$('csTarget')?.value;
    const row=read().find(x=>String(x.id)===String(targetId)&&x.active!==false);
    if(!isHead()||!sid||!row||!window.EDUNIZAM_STUDENT_PICKER?.has(students(),sid))return alert('Select a valid student and active class/section for the current school.');
    const count=studentCount(row),already=students().find(s=>String(s.id)===String(sid)&&s.className===row.className&&s.sectionName===row.sectionName);
    if(row.capacity>0&&count>=row.capacity&&!already)return alert('Selected section capacity full hai.');
    classSectionAssignInFlight=true;setBusy(btn,true,'Assigning...');
    try{
      const requestScope=cacheScope();
      try{await assignCloud(sid,row.className,row.sectionName)}catch(e){return alert('Cloud allocation failed: '+(e.message||e))}
      if(cacheScope()!==requestScope)return;
      // The scoped cloud student was updated successfully. Do not rewrite
      // unscoped local student caches or mistake the cloud UUID for a local ID.
      const person=students().find(x=>String(x.id)===String(sid));
      if(person){person.className=row.className;person.sectionName=row.sectionName;}
      render();
    }finally{classSectionAssignInFlight=false;if(btn?.isConnected)setBusy(btn,false)}
  }
  async function edit(id){
    const x=read().find(r=>String(r.id)===String(id));if(!x)return;
    if(x.classTeacherUserId&&!x.classTeacherStaffId){
      const match=staff().find(s=>s.userId&&s.userId===x.classTeacherUserId);if(match)x.classTeacherStaffId=match.id;
    }
    const box=$('csEditor');if(box)box.innerHTML=editor(x);bindEditor();
  }
  async function remove(id,btn){
    const key=String(id||'');if(!isHead()||classSectionDeleteInFlight.has(key)||btn?.disabled)return;
    if(!cloudReady())return alert('Verified school cloud login required to delete classes.');
    const x=read().find(r=>String(r.id)===String(id));if(!x)return;
    if(studentCount(x)>0)return alert('Pehle is section ke students kisi aur section mein move karein.');
    if(!confirm('Delete Class '+x.className+' - '+x.sectionName+'?'))return;
    classSectionDeleteInFlight.add(key);setBusy(btn,true,'Deleting...');
    try{
      const requestScope=cacheScope();
      try{await removeCloud(id)}catch(e){return alert('Cloud delete failed: '+(e.message||e))}
      if(cacheScope()!==requestScope)return;
      write(read().filter(r=>String(r.id)!==String(id)));render();
    }finally{classSectionDeleteInFlight.delete(key);if(btn?.isConnected)setBusy(btn,false)}
  }
  function bindEditor(){
    $('csSave')?.addEventListener('click',save);$('csCancel')?.addEventListener('click',render);
  }
  function bind(){
    bindEditor();$('csAssign')?.addEventListener('click',assign);
    document.querySelectorAll('[data-cs-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.csEdit));
    document.querySelectorAll('[data-cs-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.csDelete,b));
  }
  async function render(){
    const root=$('classSectionApp');if(!root)return;
    let rows=read();
    const currentScope=cacheScope();
    if(root.dataset.cloudScope!==currentScope){
      root.dataset.cloudScope=currentScope;
      root.dataset.cloudLoaded='';
      root.dataset.cloudError='';
    }
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='loading';
      const requestScope=currentScope;
      try{rows=await pullCloud();if(cacheScope()===requestScope){root.dataset.cloudLoaded='1';root.dataset.cloudError=''}}
      catch(e){
        if(cacheScope()===requestScope){root.dataset.cloudLoaded='';root.dataset.cloudError='1'}
        console.warn('Class/section cloud sync:',e.message);
      }
      if(cacheScope()!==requestScope)return;
    }
    rows=[...rows].sort((a,b)=>String(a.className).localeCompare(String(b.className),undefined,{numeric:true})||String(a.sectionName).localeCompare(String(b.sectionName)));
    const disconnected=!cloudReady(),loadError=root.dataset.cloudError==='1';
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(disconnected?'Cloud login required':loadError?'Cloud read unavailable':'School cloud')+'</span>'+(disconnected?'':'<button class="secondary" id="csRefresh" type="button">Refresh School Records</button>')+'</div>'+
      (loadError?'<p class="coverage-note">Class directory could not be verified. Do not assume this school has zero classes. Retry after checking connection and access.</p>':'')+
      '<div id="csEditor">'+editor()+'</div>'+allocation()+
      '<div class="section-head" style="margin-top:18px"><div><h3>Class / Section Directory</h3><p class="muted">Class teacher, room aur current student strength.</p></div></div>'+
      '<div class="paper-grid">'+(rows.length?rows.map(card).join(''):loadError?'<div class="empty-state">School classes not verified (cloud read unavailable).</div>':disconnected?'<div class="empty-state">Sign in to the school workspace to load classes.</div>':'<div class="empty-state">No class / section records in this school yet. Add the actual classes to begin.</div>')+'</div>';
    bind();
    $('csRefresh')?.addEventListener('click',()=>{root.dataset.cloudLoaded='';root.dataset.cloudError='';render()});
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('classSectionApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_CLASS_SECTION_CENTER={render,read,pullCloud,cloudReady,cacheScope,saveCloud,assignCloud,removeCloud,students,staff};
})();