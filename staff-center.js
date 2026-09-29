(function(){
  const KEY='edunizam_staff_profiles_v2';
  const LEGACY_KEY='edunizam_staff_profiles_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'').trim();
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const currentUserId=()=>cloud()?.state?.user?.id||'';
  const isHead=()=>role()==='head';
  function read(){
    try{
      const rows=JSON.parse(localStorage.getItem(KEY)||'null');
      if(Array.isArray(rows))return rows;
      const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]');
      if(Array.isArray(legacy)){write(legacy);return legacy}
    }catch(_){}
    return[];
  }
  function write(v){
    const json=JSON.stringify(v);
    localStorage.setItem(KEY,json);
    localStorage.setItem(LEGACY_KEY,json);
  }
  function splitList(v){return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
  function profile(x){return x?.profileDetails||{}}
  function visibleLocal(rows){
    if(isHead())return rows;
    const uid=currentUserId(),id=identity().toLowerCase();
    return rows.filter(x=>(uid&&String(x.userId||'')===uid)||[x.email,x.staffCode,x.phone,x.fullName].some(v=>String(v||'').trim().toLowerCase()===id));
  }
  function badgeStatus(x){return x==='active'?'good':x==='inactive'?'high':'medium'}
  function initials(name){return String(name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}

  function mapCloud(x){
    const p=x.profile_details||{};
    return {
      id:x.id,userId:x.user_id||'',staffCode:x.staff_code,fullName:x.full_name,
      designation:x.designation||'Teacher',phone:x.phone||'',subjects:x.subjects||[],
      classes:x.classes||[],joiningDate:x.joining_date||'',status:x.employment_status||'active',
      photoPath:x.photo_path||'',profileDetails:p,
      cnic:p.cnic||'',email:p.email||'',gender:p.gender||'',dateOfBirth:p.date_of_birth||'',
      qualification:p.qualification||'',professionalQualification:p.professional_qualification||'',
      specialization:p.specialization||'',experience:p.experience||'',employeeId:p.employee_id||'',
      address:p.address||'',city:p.city||'',emergencyContact:p.emergency_contact||'',
      certificates:p.certificates||'',remarks:p.remarks||'',createdAt:x.created_at
    };
  }

  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('staff_profiles').select('*')
      .eq('institution_id',cfg().institutionId).order('full_name');
    if(error)throw error;
    const rows=(data||[]).map(mapCloud);write(rows);return rows;
  }
  async function listTeacherAccounts(){
    if(!cloudReady()||!isHead()||!cloud()?.listInstitutionTeachers)return[];
    try{return await cloud().listInstitutionTeachers()}catch{return[]}
  }
  function cloudPayload(item){
    return {
      institution_id:cfg().institutionId,user_id:item.userId||null,staff_code:item.staffCode,
      full_name:item.fullName,designation:item.designation||'Teacher',phone:item.phone||null,
      subjects:item.subjects||[],classes:item.classes||[],joining_date:item.joiningDate||null,
      employment_status:item.status||'active',photo_path:item.photoPath||null,
      profile_details:{
        ...(item.profileDetails||{}),cnic:item.cnic||null,email:item.email||null,gender:item.gender||null,
        date_of_birth:item.dateOfBirth||null,qualification:item.qualification||null,
        professional_qualification:item.professionalQualification||null,specialization:item.specialization||null,
        experience:item.experience||null,employee_id:item.employeeId||null,address:item.address||null,city:item.city||null,
        emergency_contact:item.emergencyContact||null,certificates:item.certificates||null,remarks:item.remarks||null
      },
      created_by:cloud().state.user.id,updated_at:new Date().toISOString()
    };
  }
  async function upsertCloud(item){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.from('staff_profiles')
      .upsert(cloudPayload(item),{onConflict:'institution_id,staff_code'}).select().single();
    if(error)throw error;return data;
  }
  async function uploadPhoto(row,file){
    if(!file)return row;
    if(!cloudReady())throw new Error('Cloud Mode is required for profile pictures.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Profile picture must be JPG, PNG or WEBP.');
    if(file.size>2*1024*1024)throw new Error('Profile picture must be 2 MB or smaller.');
    const client=cloud().state.client,oldPath=row.photo_path||'',ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').slice(0,6)||'jpg';
    const path=cfg().institutionId+'/staff/'+row.id+'/'+Date.now()+'.'+ext;
    const {error:upError}=await client.storage.from('school-profile-photos').upload(path,file,{upsert:false,contentType:file.type});
    if(upError)throw upError;
    const {data,error}=await client.from('staff_profiles').update({photo_path:path,updated_at:new Date().toISOString()}).eq('id',row.id).select().single();
    if(error)throw error;
    if(oldPath&&oldPath!==path)client.storage.from('school-profile-photos').remove([oldPath]).catch(()=>{});
    return data;
  }
  async function signedPhoto(path){
    if(!path||!cloudReady())return null;
    const {data,error}=await cloud().state.client.storage.from('school-profile-photos').createSignedUrl(path,1800);
    if(error)throw error;return data?.signedUrl||null;
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const rows=read(),item=rows.find(x=>String(x.id)===String(id));
    if(item?.photoPath)cloud().state.client.storage.from('school-profile-photos').remove([item.photoPath]).catch(()=>{});
    const {error}=await cloud().state.client.from('staff_profiles').delete().eq('id',id);
    if(error)throw error;
  }

  function card(x){
    const actions=isHead()?'<button data-staff-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-staff-delete="'+esc(x.id)+'">Delete</button>':'';
    const p=profile(x),secondary=[x.qualification||p.qualification,x.specialization||p.specialization,x.email||p.email].filter(Boolean).join(' · ');
    return '<article class="paper-card"><div class="paper-card-top"><div style="display:flex;align-items:center;gap:10px"><span data-staff-avatar="'+esc(x.photoPath||'')+'" style="width:48px;height:48px;border-radius:50%;display:inline-grid;place-items:center;background:#e8f4f0;color:#075347;font-weight:900;overflow:hidden">'+esc(initials(x.fullName))+'</span><div><span class="mini-badge">'+esc(x.staffCode)+'</span><h3 style="margin:5px 0 0">'+esc(x.fullName)+'</h3></div></div><span data-risk="'+badgeStatus(x.status)+'">'+esc(x.status)+'</span></div>'+
      '<p class="muted">'+esc(x.designation||'Teacher')+(x.phone?' · '+esc(x.phone):'')+'</p>'+
      (secondary?'<p class="muted">'+esc(secondary)+'</p>':'')+
      '<p><strong>Subjects:</strong> '+esc((x.subjects||[]).join(', ')||'—')+'</p>'+
      '<p><strong>Classes:</strong> '+esc((x.classes||[]).join(', ')||'—')+'</p>'+
      '<p class="muted">Joining: '+esc(x.joiningDate||'Not set')+(x.employeeId?' · Employee ID '+esc(x.employeeId):'')+(x.userId?' · Cloud account linked':'')+'</p>'+
      '<div class="paper-actions">'+actions+'</div></article>';
  }

  async function editorHtml(edit=null){
    if(!isHead())return '<div class="coverage-note">Teacher apna linked professional profile dekh sakta hai. Profile management Head of Institute ke paas hai.</div>';
    const teachers=await listTeacherAccounts();
    const options='<option value="">No linked cloud account</option>'+teachers.map(t=>'<option value="'+esc(t.user_id)+'" '+(edit?.userId===t.user_id?'selected':'')+'>'+esc(t.full_name||t.user_id)+'</option>').join('');
    return '<article class="card"><div class="section-head"><div><h3>'+(edit?'Edit Staff / Teacher Profile':'Add Staff / Teacher Profile')+'</h3><p class="muted">Required: staff code, full name, designation, phone and joining date. Other professional fields are optional.</p></div></div>'+
      '<input id="staffEditId" type="hidden" value="'+esc(edit?.id||'')+'"><div class="form-grid">'+
      '<input id="staffCode" placeholder="Staff code *" value="'+esc(edit?.staffCode||'')+'">'+
      '<input id="staffName" placeholder="Full name *" value="'+esc(edit?.fullName||'')+'">'+
      '<input id="staffDesignation" placeholder="Designation *" value="'+esc(edit?.designation||'Teacher')+'">'+
      '<input id="staffPhone" placeholder="Phone *" value="'+esc(edit?.phone||'')+'">'+
      '<input id="staffEmail" type="email" placeholder="Email (optional)" value="'+esc(edit?.email||'')+'">'+
      '<input id="staffCnic" placeholder="CNIC (optional)" value="'+esc(edit?.cnic||'')+'">'+
      '<select id="staffGender"><option value="">Gender (optional)</option><option '+(edit?.gender==='Male'?'selected':'')+'>Male</option><option '+(edit?.gender==='Female'?'selected':'')+'>Female</option><option '+(edit?.gender==='Other / Prefer not to say'?'selected':'')+'>Other / Prefer not to say</option></select>'+
      '<label>Date of Birth (optional)<input id="staffDob" type="date" value="'+esc(edit?.dateOfBirth||'')+'"></label>'+
      '<input id="staffQualification" placeholder="Qualification (optional)" value="'+esc(edit?.qualification||'')+'">'+
      '<input id="staffProfessionalQualification" placeholder="Professional qualification (optional)" value="'+esc(edit?.professionalQualification||'')+'">'+
      '<input id="staffSpecialization" placeholder="Subject specialization (optional)" value="'+esc(edit?.specialization||'')+'">'+
      '<input id="staffExperience" placeholder="Experience e.g. 7 years (optional)" value="'+esc(edit?.experience||'')+'">'+
      '<input id="staffEmployeeId" placeholder="Employee ID (optional)" value="'+esc(edit?.employeeId||'')+'">'+
      '<input id="staffSubjects" placeholder="Subjects comma separated" value="'+esc((edit?.subjects||[]).join(', '))+'">'+
      '<input id="staffClasses" placeholder="Classes comma separated" value="'+esc((edit?.classes||[]).join(', '))+'">'+
      '<label>Joining Date *<input id="staffJoining" type="date" value="'+esc(edit?.joiningDate||'')+'"></label>'+
      '<input id="staffAddress" placeholder="Address (optional)" value="'+esc(edit?.address||'')+'">'+
      '<input id="staffCity" placeholder="City (optional)" value="'+esc(edit?.city||'')+'">'+
      '<input id="staffEmergency" placeholder="Emergency contact (optional)" value="'+esc(edit?.emergencyContact||'')+'">'+
      '<input id="staffCertificates" placeholder="Certificates / training references (optional)" value="'+esc(edit?.certificates||'')+'">'+
      '<textarea id="staffRemarks" rows="2" placeholder="Remarks (optional)">'+esc(edit?.remarks||'')+'</textarea>'+
      '<select id="staffStatus"><option value="active" '+(edit?.status!=='inactive'?'selected':'')+'>Active</option><option value="inactive" '+(edit?.status==='inactive'?'selected':'')+'>Inactive</option></select>'+
      '<select id="staffUserId">'+options+'</select>'+
      '<label class="coverage-note"><strong>Profile picture (optional)</strong><input id="staffPhotoFile" type="file" accept="image/jpeg,image/png,image/webp"><span>JPG/PNG/WEBP · max 2 MB · private cloud storage</span></label>'+
      '<button id="saveStaffProfile">'+(edit?'Update Profile':'Save Profile')+'</button>'+(edit?'<button id="cancelStaffEdit" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }

  async function save(){
    const staffCode=$('staffCode')?.value.trim(),fullName=$('staffName')?.value.trim(),designation=$('staffDesignation')?.value.trim(),phone=$('staffPhone')?.value.trim(),joiningDate=$('staffJoining')?.value||'';
    const missing=[];if(!staffCode)missing.push('Staff code');if(!fullName)missing.push('Full name');if(!designation)missing.push('Designation');if(!phone)missing.push('Phone');if(!joiningDate)missing.push('Joining date');
    if(missing.length)return alert('Required fields complete karein: '+missing.join(', '));
    const file=$('staffPhotoFile')?.files?.[0]||null;if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024))return alert('Profile picture JPG/PNG/WEBP aur max 2 MB honi chahiye.');
    const current=read(),editId=$('staffEditId')?.value||'',existing=current.find(x=>String(x.id)===String(editId));
    let item={
      ...(existing||{}),id:editId||String(Date.now()),userId:$('staffUserId')?.value||'',staffCode,fullName,designation,phone,
      email:$('staffEmail')?.value.trim()||'',cnic:$('staffCnic')?.value.trim()||'',gender:$('staffGender')?.value||'',dateOfBirth:$('staffDob')?.value||'',
      qualification:$('staffQualification')?.value.trim()||'',professionalQualification:$('staffProfessionalQualification')?.value.trim()||'',
      specialization:$('staffSpecialization')?.value.trim()||'',experience:$('staffExperience')?.value.trim()||'',employeeId:$('staffEmployeeId')?.value.trim()||'',
      subjects:splitList($('staffSubjects')?.value),classes:splitList($('staffClasses')?.value),joiningDate,
      address:$('staffAddress')?.value.trim()||'',city:$('staffCity')?.value.trim()||'',emergencyContact:$('staffEmergency')?.value.trim()||'',
      certificates:$('staffCertificates')?.value.trim()||'',remarks:$('staffRemarks')?.value.trim()||'',status:$('staffStatus')?.value||'active',
      photoPath:existing?.photoPath||'',createdAt:existing?.createdAt||new Date().toISOString()
    };
    const duplicate=current.find(x=>String(x.staffCode||'').toLowerCase()===staffCode.toLowerCase()&&String(x.id)!==String(editId));if(duplicate)return alert('Ye staff code already use ho raha hai.');
    const btn=$('saveStaffProfile');if(btn)btn.disabled=true;
    try{
      let row=await upsertCloud(item);
      if(row&&file)row=await uploadPhoto(row,file);
      if(row)item=mapCloud(row);
      else if(file)alert('Profile text save ho gaya, lekin picture upload ke liye Cloud Mode required hai.');
    }catch(e){alert('Cloud sync/profile photo failed; text profile local mode mein save hoga. '+(e.message||e))}
    finally{if(btn)btn.disabled=false}
    const next=current.filter(x=>String(x.id)!==String(editId)&&String(x.staffCode||'').toLowerCase()!==staffCode.toLowerCase());next.push(item);write(next);render();
  }

  async function remove(id){
    if(!isHead())return;const rows=read(),item=rows.find(x=>String(x.id)===String(id));if(!item)return;
    if(!confirm('Delete staff profile for '+item.fullName+'?'))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(rows.filter(x=>String(x.id)!==String(id)));render();
  }
  async function edit(id){if(!isHead())return;const item=read().find(x=>String(x.id)===String(id));if(!item)return;const box=$('staffEditor');if(box)box.innerHTML=await editorHtml(item);bindEditor();window.scrollTo({top:box?.offsetTop||0,behavior:'smooth'})}
  function bindEditor(){if($('saveStaffProfile'))$('saveStaffProfile').onclick=save;if($('cancelStaffEdit'))$('cancelStaffEdit').onclick=render}
  function bindCards(){document.querySelectorAll('[data-staff-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.staffEdit));document.querySelectorAll('[data-staff-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.staffDelete))}
  async function hydrateAvatars(){
    if(!cloudReady())return;
    await Promise.all([...document.querySelectorAll('[data-staff-avatar]')].filter(n=>n.dataset.staffAvatar).map(async n=>{try{const url=await signedPhoto(n.dataset.staffAvatar);if(url)n.innerHTML='<img src="'+esc(url)+'" alt="Staff profile" style="width:100%;height:100%;object-fit:cover">'}catch(_){}}));
  }
  async function render(){
    const root=$('staffCenterApp');if(!root)return;let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Staff cloud sync:',e.message)}}
    rows=visibleLocal(rows).sort((a,b)=>String(a.fullName).localeCompare(String(b.fullName)));
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><div id="staffEditor">'+await editorHtml()+'</div><div class="section-head" style="margin-top:18px"><div><h3>'+(isHead()?'Staff Directory':'My Professional Profile')+'</h3><p class="muted">'+(isHead()?'Institute teacher/staff profiles, qualifications and photos.':'Aap ka linked professional profile.')+'</p></div></div><div class="paper-grid">'+(rows.length?rows.map(card).join(''):'<div class="empty-state">'+(isHead()?'Abhi koi staff profile nahi hai.':'Aap ke login se linked staff profile nahi mila.')+'</div>')+'</div>';
    bindEditor();bindCards();hydrateAvatars();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('staffCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,800);
  window.EDUNIZAM_STAFF_CENTER={render,read,pullCloud,cloudReady};
})();