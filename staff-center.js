(function(){
  const KEY='edunizam_staff_profiles_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'').trim();
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function splitList(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
  function visibleLocal(rows){
    if(isHead())return rows;
    const id=identity().toLowerCase();
    if(!id)return[];
    return rows.filter(x=>[x.staffCode,x.phone,x.fullName].some(v=>String(v||'').trim().toLowerCase()===id));
  }
  function badgeStatus(x){return x==='active'?'good':x==='inactive'?'high':'medium'}

  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('staff_profiles').select('*')
      .eq('institution_id',cfg().institutionId).order('full_name');
    if(error)throw error;
    const rows=(data||[]).map(x=>({
      id:x.id,userId:x.user_id||'',staffCode:x.staff_code,fullName:x.full_name,
      designation:x.designation||'Teacher',phone:x.phone||'',subjects:x.subjects||[],
      classes:x.classes||[],joiningDate:x.joining_date||'',status:x.employment_status||'active',
      createdAt:x.created_at
    }));
    write(rows);return rows;
  }

  async function listTeacherAccounts(){
    if(!cloudReady()||!isHead()||!cloud()?.listInstitutionTeachers)return[];
    try{return await cloud().listInstitutionTeachers()}catch{return[]}
  }

  async function upsertCloud(item){
    if(!cloudReady())return null;
    const c=cloud();
    const payload={
      institution_id:cfg().institutionId,
      user_id:item.userId||null,
      staff_code:item.staffCode,
      full_name:item.fullName,
      designation:item.designation||'Teacher',
      phone:item.phone||null,
      subjects:item.subjects||[],
      classes:item.classes||[],
      joining_date:item.joiningDate||null,
      employment_status:item.status||'active',
      created_by:c.state.user.id,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await c.state.client.from('staff_profiles')
      .upsert(payload,{onConflict:'institution_id,staff_code'}).select().single();
    if(error)throw error;return data;
  }

  async function deleteCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('staff_profiles').delete().eq('id',id);
    if(error)throw error;
  }

  function card(x){
    const actions=isHead()
      ?'<button data-staff-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-staff-delete="'+esc(x.id)+'">Delete</button>'
      :'';
    return '<article class="paper-card">'+
      '<div class="paper-card-top"><span class="mini-badge">'+esc(x.staffCode)+'</span><span id="profileRiskBadge" data-risk="'+badgeStatus(x.status)+'">'+esc(x.status)+'</span></div>'+
      '<h3>'+esc(x.fullName)+'</h3>'+
      '<p class="muted">'+esc(x.designation||'Teacher')+(x.phone?' · '+esc(x.phone):'')+'</p>'+
      '<p><strong>Subjects:</strong> '+esc((x.subjects||[]).join(', ')||'—')+'</p>'+
      '<p><strong>Classes:</strong> '+esc((x.classes||[]).join(', ')||'—')+'</p>'+
      '<p class="muted">Joining: '+esc(x.joiningDate||'Not set')+(x.userId?' · Cloud account linked':'')+'</p>'+
      '<div class="paper-actions">'+actions+'</div></article>';
  }

  async function editorHtml(edit=null){
    if(!isHead())return '<div class="coverage-note">Teacher apna profile dekh sakta hai. Staff profile management Head of Institute ke paas hai.</div>';
    const teachers=await listTeacherAccounts();
    const options='<option value="">No linked cloud account</option>'+teachers.map(t=>
      '<option value="'+esc(t.user_id)+'" '+(edit?.userId===t.user_id?'selected':'')+'>'+esc(t.full_name||t.user_id)+'</option>'
    ).join('');
    return '<article class="card"><div class="section-head"><div><h3>'+ (edit?'Edit Staff Profile':'Add Staff Profile') +'</h3><p class="muted">Existing teacher account ko optional cloud link de sakte hain.</p></div></div>'+
      '<input id="staffEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<div class="form-grid">'+
      '<input id="staffCode" placeholder="Staff code e.g. T-001" value="'+esc(edit?.staffCode||'')+'">'+
      '<input id="staffName" placeholder="Full name" value="'+esc(edit?.fullName||'')+'">'+
      '<input id="staffDesignation" placeholder="Designation" value="'+esc(edit?.designation||'Teacher')+'">'+
      '<input id="staffPhone" placeholder="Phone" value="'+esc(edit?.phone||'')+'">'+
      '<input id="staffSubjects" placeholder="Subjects comma separated" value="'+esc((edit?.subjects||[]).join(', '))+'">'+
      '<input id="staffClasses" placeholder="Classes comma separated" value="'+esc((edit?.classes||[]).join(', '))+'">'+
      '<input id="staffJoining" type="date" value="'+esc(edit?.joiningDate||'')+'">'+
      '<select id="staffStatus"><option value="active" '+(edit?.status!=='inactive'?'selected':'')+'>Active</option><option value="inactive" '+(edit?.status==='inactive'?'selected':'')+'>Inactive</option></select>'+
      '<select id="staffUserId">'+options+'</select>'+
      '<button id="saveStaffProfile">'+(edit?'Update Profile':'Save Profile')+'</button>'+
      (edit?'<button id="cancelStaffEdit" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }

  async function save(){
    const staffCode=$('staffCode')?.value.trim(),fullName=$('staffName')?.value.trim();
    if(!staffCode||!fullName)return alert('Staff code aur full name required hain.');
    const current=read(),editId=$('staffEditId')?.value||'';
    let item={
      id:editId||String(Date.now()),
      userId:$('staffUserId')?.value||'',
      staffCode,fullName,
      designation:$('staffDesignation')?.value.trim()||'Teacher',
      phone:$('staffPhone')?.value.trim()||'',
      subjects:splitList($('staffSubjects')?.value),
      classes:splitList($('staffClasses')?.value),
      joiningDate:$('staffJoining')?.value||'',
      status:$('staffStatus')?.value||'active',
      createdAt:new Date().toISOString()
    };
    const duplicate=current.find(x=>x.staffCode.toLowerCase()===staffCode.toLowerCase()&&String(x.id)!==String(editId));
    if(duplicate)return alert('Ye staff code already use ho raha hai.');
    try{
      const row=await upsertCloud(item);
      if(row)item={
        id:row.id,userId:row.user_id||'',staffCode:row.staff_code,fullName:row.full_name,
        designation:row.designation||'Teacher',phone:row.phone||'',subjects:row.subjects||[],
        classes:row.classes||[],joiningDate:row.joining_date||'',status:row.employment_status||'active',
        createdAt:row.created_at
      };
    }catch(e){alert('Cloud sync failed; profile local mode mein save hoga. '+(e.message||e))}
    const next=current.filter(x=>String(x.id)!==String(editId)&&x.staffCode.toLowerCase()!==staffCode.toLowerCase());
    next.push(item);write(next);render();
  }

  async function remove(id){
    if(!isHead())return;
    const rows=read(),item=rows.find(x=>String(x.id)===String(id));if(!item)return;
    if(!confirm('Delete staff profile for '+item.fullName+'?'))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(rows.filter(x=>String(x.id)!==String(id)));render();
  }

  async function edit(id){
    if(!isHead())return;
    const item=read().find(x=>String(x.id)===String(id));if(!item)return;
    const box=$('staffEditor');if(box)box.innerHTML=await editorHtml(item);
    bindEditor();
  }

  function bindEditor(){
    if($('saveStaffProfile'))$('saveStaffProfile').onclick=save;
    if($('cancelStaffEdit'))$('cancelStaffEdit').onclick=render;
  }
  function bindCards(){
    document.querySelectorAll('[data-staff-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.staffEdit));
    document.querySelectorAll('[data-staff-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.staffDelete));
  }

  async function render(){
    const root=$('staffCenterApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Staff cloud sync:',e.message)}
    }
    rows=visibleLocal(rows).sort((a,b)=>String(a.fullName).localeCompare(String(b.fullName)));
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      '<div id="staffEditor">'+await editorHtml()+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>'+(isHead()?'Staff Directory':'My Staff Profile')+'</h3><p class="muted">'+(isHead()?'Institute staff profiles.':'Aap ka linked staff record.')+'</p></div></div>'+
      '<div class="paper-grid">'+(rows.length?rows.map(card).join(''):'<div class="empty-state">'+(isHead()?'Abhi koi staff profile nahi hai.':'Aap ke login se linked staff profile nahi mila.')+'</div>')+'</div>';
    bindEditor();bindCards();
  }

  window.addEventListener('edunizam:auth',()=>{const root=$('staffCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,800);
  window.EDUNIZAM_STAFF_CENTER={render,read,pullCloud,cloudReady};
})();