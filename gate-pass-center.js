(function(){
  const VISITOR_KEY='edunizam_visitors_v1';
  const PASS_KEY='edunizam_gate_passes_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const canRequest=()=>['head','parent'].includes(role());
  const nowIso=()=>new Date().toISOString();
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function visiblePasses(rows){
    if(isHead())return rows;
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return rows.filter(x=>ids.has(String(x.studentId)));
  }
  async function cloudStudent(localId){
    if(!cloudReady())return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id').eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function mapVisitor(x){
    return {id:x.id,visitorName:x.visitor_name,phone:x.phone||'',purpose:x.purpose,personToMeet:x.person_to_meet||'',vehicleNo:x.vehicle_no||'',checkedInAt:x.checked_in_at,checkedOutAt:x.checked_out_at||'',notes:x.notes||''};
  }
  function mapPass(x){
    const s=x.core_students||{};
    return {id:x.id,studentId:String(s.local_id??x.student_id),studentCloudId:x.student_id,studentName:s.name||'Student',className:s.class_name||'',sectionName:s.section_name||'',exitDate:x.exit_date,exitTime:String(x.exit_time||'').slice(0,5),pickupName:x.pickup_name,pickupPhone:x.pickup_phone||'',pickupRelation:x.pickup_relation||'',reason:x.reason,status:x.status,adminNote:x.admin_note||'',requestedBy:x.requested_by||'',approvedAt:x.approved_at||'',exitedAt:x.exited_at||'',createdAt:x.created_at};
  }
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId;
    if(isHead()){
      const {data,error}=await c.from('school_visitors').select('*').eq('institution_id',id).order('checked_in_at',{ascending:false}).limit(200);
      if(error)throw error;write(VISITOR_KEY,(data||[]).map(mapVisitor));
    }
    const {data,error}=await c.from('student_gate_passes').select('*,core_students(local_id,name,class_name,section_name,auth_user_id)').eq('institution_id',id).order('created_at',{ascending:false});
    if(error)throw error;write(PASS_KEY,(data||[]).map(mapPass));
  }
  async function saveVisitorCloud(item){
    const {data,error}=await cloud().state.client.from('school_visitors').insert({
      institution_id:cfg().institutionId,visitor_name:item.visitorName,phone:item.phone||null,purpose:item.purpose,person_to_meet:item.personToMeet||null,vehicle_no:item.vehicleNo||null,notes:item.notes||null,created_by:cloud().state.user.id
    }).select().single();
    if(error)throw error;return mapVisitor(data);
  }
  async function checkoutVisitorCloud(id){
    const {data,error}=await cloud().state.client.from('school_visitors').update({checked_out_at:new Date().toISOString()}).eq('id',id).select().single();
    if(error)throw error;return mapVisitor(data);
  }
  async function requestPassCloud(item){
    const cs=await cloudStudent(item.studentId);if(!cs)throw new Error('Student cloud record not found.');
    const {data,error}=await cloud().state.client.rpc('create_student_gate_pass',{
      p_student_id:cs.id,p_exit_date:item.exitDate,p_exit_time:item.exitTime,p_pickup_name:item.pickupName,p_pickup_phone:item.pickupPhone||null,p_pickup_relation:item.pickupRelation||null,p_reason:item.reason
    });
    if(error)throw error;return data;
  }
  async function updatePassCloud(id,status,note){
    const {data,error}=await cloud().state.client.rpc('update_student_gate_pass_status',{p_gate_pass_id:id,p_status:status,p_admin_note:note||null});
    if(error)throw error;return data;
  }
  function visitorEditor(){
    if(!isHead())return '';
    return '<article class="card"><h3>Visitor Check-In</h3><div class="form-grid">'+
      '<input id="gcVisitorName" placeholder="Visitor name">'+
      '<input id="gcVisitorPhone" placeholder="Phone (optional)">'+
      '<input id="gcVisitorPurpose" placeholder="Purpose of visit">'+
      '<input id="gcPersonToMeet" placeholder="Person to meet (optional)">'+
      '<input id="gcVehicleNo" placeholder="Vehicle no. (optional)">'+
      '<input id="gcVisitorNotes" placeholder="Notes (optional)">'+
      '<button id="gcCheckIn">Check In Visitor</button></div></article>';
  }
  function passEditor(){
    if(!canRequest())return '<div class="coverage-note">Aap apne linked student ke gate-pass records dekh sakte hain.</div>';
    const list=isHead()?students():visibleStudents();
    return '<article class="card" style="margin-top:16px"><h3>Request Student Gate Pass</h3><div class="form-grid">'+
      '<select id="gcStudent"><option value="">Select student</option>'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<input id="gcExitDate" type="date" value="'+today()+'">'+
      '<input id="gcExitTime" type="time">'+
      '<input id="gcPickupName" placeholder="Pickup person name">'+
      '<input id="gcPickupPhone" placeholder="Pickup person phone (optional)">'+
      '<input id="gcPickupRelation" placeholder="Relation e.g. Father / Uncle">'+
      '<textarea id="gcReason" rows="2" placeholder="Reason for early exit"></textarea>'+
      '<button id="gcRequestPass">Submit Gate Pass</button></div></article>';
  }
  function metrics(){
    const visitors=read(VISITOR_KEY),passes=read(PASS_KEY),inside=visitors.filter(x=>!x.checkedOutAt).length,pending=passes.filter(x=>x.status==='Pending').length,approved=passes.filter(x=>x.status==='Approved').length,exited=passes.filter(x=>x.status==='Exited'&&String(x.exitDate)===today()).length;
    return '<div class="cards"><article class="card stat"><span>Visitors Inside</span><strong>'+inside+'</strong></article><article class="card stat"><span>Pending Passes</span><strong>'+pending+'</strong></article><article class="card stat"><span>Approved</span><strong>'+approved+'</strong></article><article class="card stat"><span>Exited Today</span><strong>'+exited+'</strong></article></div>';
  }
  function visitorRows(){
    const rows=read(VISITOR_KEY);
    return rows.length?rows.map(x=>'<div class="row"><strong>'+esc(x.visitorName)+'</strong><span>'+esc(x.purpose)+'</span><span>'+new Date(x.checkedInAt).toLocaleString()+'</span><span>'+(x.checkedOutAt?'Checked out':'Inside')+'</span>'+(!x.checkedOutAt?'<button data-gc-checkout="'+esc(x.id)+'">Check Out</button>':'<span></span>')+'</div>').join(''):'<div class="muted">No visitor entries.</div>';
  }
  function passCard(x){
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.exitDate)+' · '+esc(x.exitTime||'-')+'</span><span class="badge">'+esc(x.status)+'</span></div>'+
      '<h3>'+esc(x.studentName)+'</h3><p class="muted">'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</p>'+
      '<p><strong>Pickup:</strong> '+esc(x.pickupName)+(x.pickupRelation?' · '+esc(x.pickupRelation):'')+(x.pickupPhone?' · '+esc(x.pickupPhone):'')+'</p>'+
      '<p><strong>Reason:</strong> '+esc(x.reason)+'</p>'+(x.adminNote?'<p><strong>Admin note:</strong> '+esc(x.adminNote)+'</p>':'')+
      '<div class="paper-actions"><button class="secondary" data-gc-print="'+esc(x.id)+'">Print</button>'+
      (isHead()&&x.status==='Pending'?'<button data-gc-approve="'+esc(x.id)+'">Approve</button><button class="secondary" data-gc-reject="'+esc(x.id)+'">Reject</button>':'')+
      (isHead()&&x.status==='Approved'?'<button data-gc-exit="'+esc(x.id)+'">Mark Exited</button>':'')+
      '</div></article>';
  }
  async function checkIn(){
    const visitorName=$('gcVisitorName')?.value.trim(),purpose=$('gcVisitorPurpose')?.value.trim();if(!visitorName||!purpose)return alert('Visitor name aur purpose required hain.');
    let item={id:String(Date.now()),visitorName,phone:$('gcVisitorPhone')?.value.trim()||'',purpose,personToMeet:$('gcPersonToMeet')?.value.trim()||'',vehicleNo:$('gcVehicleNo')?.value.trim()||'',checkedInAt:nowIso(),checkedOutAt:'',notes:$('gcVisitorNotes')?.value.trim()||''};
    try{if(cloudReady()){item=await saveVisitorCloud(item)}}catch(e){return alert('Cloud visitor check-in failed: '+(e.message||e))}
    const rows=read(VISITOR_KEY);rows.unshift(item);write(VISITOR_KEY,rows);render();
  }
  async function checkout(id){
    let rows=read(VISITOR_KEY),x=rows.find(v=>String(v.id)===String(id));if(!x||!isHead())return;
    try{if(cloudReady()){x=await checkoutVisitorCloud(id)}}catch(e){return alert('Cloud visitor checkout failed: '+(e.message||e))}
    rows=rows.map(v=>String(v.id)===String(id)?Object.assign(v,x,{checkedOutAt:x.checkedOutAt||nowIso()}):v);write(VISITOR_KEY,rows);render();
  }
  async function requestPass(){
    const studentId=$('gcStudent')?.value,exitDate=$('gcExitDate')?.value,exitTime=$('gcExitTime')?.value,pickupName=$('gcPickupName')?.value.trim(),reason=$('gcReason')?.value.trim();
    if(!studentId||!exitDate||!exitTime||!pickupName||!reason)return alert('Student, exit date/time, pickup person aur reason required hain.');
    if(exitDate<today())return alert('Exit date past mein nahi ho sakti.');
    const s=students().find(x=>String(x.id)===String(studentId));if(!s)return;
    let item={id:String(Date.now()),studentId:String(s.id),studentName:s.name,className:s.className||'',sectionName:s.sectionName||'',exitDate,exitTime,pickupName,pickupPhone:$('gcPickupPhone')?.value.trim()||'',pickupRelation:$('gcPickupRelation')?.value.trim()||'',reason,status:'Pending',adminNote:'',requestedBy:role(),approvedAt:'',exitedAt:'',createdAt:nowIso()};
    try{if(cloudReady()){await requestPassCloud(item);await pullCloud();render();return}}catch(e){return alert('Cloud gate-pass request failed: '+(e.message||e))}
    const rows=read(PASS_KEY);rows.unshift(item);write(PASS_KEY,rows);render();
  }
  async function passStatus(id,status){
    const note=(status==='Rejected'||status==='Approved')?(prompt('Admin note (optional):','')||''):'';
    try{if(cloudReady()){await updatePassCloud(id,status,note);await pullCloud();render();return}}catch(e){return alert('Cloud gate-pass update failed: '+(e.message||e))}
    const rows=read(PASS_KEY),x=rows.find(p=>String(p.id)===String(id));if(!x)return;x.status=status;x.adminNote=note;if(status==='Approved')x.approvedAt=nowIso();if(status==='Exited')x.exitedAt=nowIso();write(PASS_KEY,rows);render();
  }
  function printPass(x){
    const st=settings(),w=window.open('','_blank','width=760,height=650');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Student Gate Pass</title><style>body{font-family:Arial;padding:30px;color:#17324a}.pass{max-width:650px;margin:auto;border:2px solid #6b8798;border-radius:16px;padding:24px}.head{text-align:center}.row{display:flex;justify-content:space-between;gap:20px;padding:9px 0;border-bottom:1px solid #e3e9ed}.sign{display:flex;justify-content:space-between;margin-top:55px}</style></head><body><div class="pass"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Student Gate Pass</h3></div><div class="row"><span>Student</span><strong>'+esc(x.studentName)+'</strong></div><div class="row"><span>Class</span><strong>'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</strong></div><div class="row"><span>Exit Date / Time</span><strong>'+esc(x.exitDate)+' · '+esc(x.exitTime||'-')+'</strong></div><div class="row"><span>Pickup Person</span><strong>'+esc(x.pickupName)+(x.pickupRelation?' · '+esc(x.pickupRelation):'')+'</strong></div><div class="row"><span>Phone</span><strong>'+esc(x.pickupPhone||'-')+'</strong></div><div class="row"><span>Reason</span><strong>'+esc(x.reason)+'</strong></div><div class="row"><span>Status</span><strong>'+esc(x.status)+'</strong></div><div class="sign"><span>Authorized Sign</span><span>Gate / Security</span></div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(rows){
    $('gcCheckIn')?.addEventListener('click',checkIn);$('gcRequestPass')?.addEventListener('click',requestPass);
    document.querySelectorAll('[data-gc-checkout]').forEach(b=>b.onclick=()=>checkout(b.dataset.gcCheckout));
    document.querySelectorAll('[data-gc-approve]').forEach(b=>b.onclick=()=>passStatus(b.dataset.gcApprove,'Approved'));
    document.querySelectorAll('[data-gc-reject]').forEach(b=>b.onclick=()=>passStatus(b.dataset.gcReject,'Rejected'));
    document.querySelectorAll('[data-gc-exit]').forEach(b=>b.onclick=()=>passStatus(b.dataset.gcExit,'Exited'));
    document.querySelectorAll('[data-gc-print]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>String(r.id)===String(b.dataset.gcPrint));if(x)printPass(x)});
  }
  async function render(){
    const root=$('gateCenterApp');if(!root)return;
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Gate center cloud sync:',e.message)}}
    const passes=visiblePasses(read(PASS_KEY));
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      (isHead()?metrics():'')+visitorEditor()+passEditor()+
      (isHead()?'<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Visitor Register</h3><p class="muted">Recent campus visitors.</p></div></div><div class="list">'+visitorRows()+'</div></article>':'')+
      '<div class="section-head" style="margin-top:18px"><div><h3>Student Gate Passes</h3><p class="muted">Request and exit history.</p></div></div><div class="paper-grid">'+(passes.length?passes.map(passCard).join(''):'<div class="empty-state">No gate-pass records.</div>')+'</div>';
    bind(passes);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('gateCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_GATE_CENTER={render,pullCloud,cloudReady};
})();