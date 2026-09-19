(function(){
  const ROUTE_KEY='edunizam_transport_routes_v1';
  const VEHICLE_KEY='edunizam_transport_vehicles_v1';
  const ASSIGN_KEY='edunizam_transport_assignments_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function money(v){return 'Rs '+Number(v||0).toLocaleString('en-PK')}
  function routes(){return read(ROUTE_KEY)}
  function vehicles(){return read(VEHICLE_KEY)}
  function assignments(){return read(ASSIGN_KEY)}
  function activeAssignmentsForVehicle(vehicleId,excludeStudentId=''){
    return assignments().filter(x=>x.status==='active'&&String(x.vehicleId)===String(vehicleId)&&String(x.studentId)!==String(excludeStudentId));
  }
  function availableSeats(v,excludeStudentId=''){return Math.max(0,Number(v.capacity||0)-activeAssignmentsForVehicle(v.id,excludeStudentId).length)}
  function visibleAssignments(rows){
    if(isHead())return rows;
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return rows.filter(x=>ids.has(String(x.studentId)));
  }
  async function cloudStudent(localId){
    if(!cloudReady())return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id')
      .eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function mapRoute(x){return {id:x.id,routeCode:x.route_code,routeName:x.route_name,pickupTime:x.pickup_time||'',dropTime:x.drop_time||'',monthlyFee:Number(x.monthly_fee||0),stops:x.stops||[],active:x.active!==false,notes:x.notes||''}}
  function mapVehicle(x){return {id:x.id,registrationNo:x.registration_no,vehicleType:x.vehicle_type,capacity:Number(x.capacity||0),driverName:x.driver_name||'',driverPhone:x.driver_phone||'',conductorName:x.conductor_name||'',conductorPhone:x.conductor_phone||'',status:x.status||'active',notes:x.notes||''}}
  function mapAssignment(x){
    return {id:x.id,studentId:String(x.student_local_id??x.student_id),studentCloudId:x.student_id,studentName:x.student_name||'Student',className:x.class_name||'',sectionName:x.section_name||'',routeId:x.route_id,routeName:x.route_name||'',vehicleId:x.vehicle_id,registrationNo:x.registration_no||'',driverName:x.driver_name||'',driverPhone:x.driver_phone||'',pickupStop:x.pickup_stop||'',dropStop:x.drop_stop||'',monthlyFee:Number(x.monthly_fee||0),effectiveFrom:x.effective_from,status:x.status||'active'};
  }
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId;
    if(isHead()){
      const [rr,vr]=await Promise.all([
        c.from('transport_routes').select('*').eq('institution_id',id).order('route_name'),
        c.from('transport_vehicles').select('*').eq('institution_id',id).order('registration_no')
      ]);
      if(rr.error)throw rr.error;if(vr.error)throw vr.error;
      write(ROUTE_KEY,(rr.data||[]).map(mapRoute));write(VEHICLE_KEY,(vr.data||[]).map(mapVehicle));
    }
    const {data,error}=await c.rpc('list_my_transport_assignments');if(error)throw error;
    write(ASSIGN_KEY,(data||[]).map(mapAssignment));
  }
  async function saveRouteCloud(item){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.from('transport_routes').upsert({
      institution_id:cfg().institutionId,route_code:item.routeCode,route_name:item.routeName,pickup_time:item.pickupTime||null,drop_time:item.dropTime||null,monthly_fee:item.monthlyFee,stops:item.stops,active:item.active!==false,notes:item.notes||null,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    },{onConflict:'institution_id,route_code'}).select().single();
    if(error)throw error;return mapRoute(data);
  }
  async function saveVehicleCloud(item){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.from('transport_vehicles').upsert({
      institution_id:cfg().institutionId,registration_no:item.registrationNo,vehicle_type:item.vehicleType,capacity:item.capacity,driver_name:item.driverName||null,driver_phone:item.driverPhone||null,conductor_name:item.conductorName||null,conductor_phone:item.conductorPhone||null,status:item.status,notes:item.notes||null,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    },{onConflict:'institution_id,registration_no'}).select().single();
    if(error)throw error;return mapVehicle(data);
  }
  async function assignCloud(studentLocalId,routeId,vehicleId,pickupStop,dropStop,effectiveFrom){
    const cs=await cloudStudent(studentLocalId);if(!cs)throw new Error('Student cloud record not found.');
    const {data,error}=await cloud().state.client.rpc('assign_student_transport',{p_student_id:cs.id,p_route_id:routeId,p_vehicle_id:vehicleId,p_pickup_stop:pickupStop||null,p_drop_stop:dropStop||null,p_effective_from:effectiveFrom});
    if(error)throw error;return data;
  }
  async function deactivateCloud(id){
    const {data,error}=await cloud().state.client.from('student_transport_assignments').update({status:'inactive',updated_at:new Date().toISOString()}).eq('id',id).select().single();
    if(error)throw error;return data;
  }
  function routeEditor(edit=null){
    if(!isHead())return '';
    return '<article class="card"><h3>'+(edit?'Edit Route':'Add Route')+'</h3><div class="form-grid">'+
      '<input id="trRouteEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="trRouteCode" placeholder="Route code e.g. R-01" value="'+esc(edit?.routeCode||'')+'">'+
      '<input id="trRouteName" placeholder="Route name" value="'+esc(edit?.routeName||'')+'">'+
      '<input id="trPickupTime" type="time" value="'+esc(edit?.pickupTime||'')+'">'+
      '<input id="trDropTime" type="time" value="'+esc(edit?.dropTime||'')+'">'+
      '<input id="trMonthlyFee" type="number" min="0" value="'+esc(edit?.monthlyFee??0)+'" placeholder="Monthly transport fee">'+
      '<input id="trStops" placeholder="Stops, comma separated" value="'+esc((edit?.stops||[]).join(', '))+'">'+
      '<select id="trRouteActive"><option value="true" '+(edit?.active===false?'':'selected')+'>Active</option><option value="false" '+(edit?.active===false?'selected':'')+'>Inactive</option></select>'+
      '<input id="trRouteNotes" placeholder="Route notes (optional)" value="'+esc(edit?.notes||'')+'">'+
      '<button id="trSaveRoute">'+(edit?'Update Route':'Save Route')+'</button>'+(edit?'<button id="trCancelRoute" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function vehicleEditor(edit=null){
    if(!isHead())return '';
    return '<article class="card" style="margin-top:16px"><h3>'+(edit?'Edit Vehicle':'Add Vehicle')+'</h3><div class="form-grid">'+
      '<input id="trVehicleEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="trReg" placeholder="Registration no." value="'+esc(edit?.registrationNo||'')+'">'+
      '<select id="trVehicleType">'+['Van','Bus','Coaster','Rickshaw','Car','Other'].map(x=>'<option '+(edit?.vehicleType===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<input id="trCapacity" type="number" min="1" value="'+esc(edit?.capacity??1)+'" placeholder="Seating capacity">'+
      '<input id="trDriverName" placeholder="Driver name" value="'+esc(edit?.driverName||'')+'">'+
      '<input id="trDriverPhone" placeholder="Driver phone" value="'+esc(edit?.driverPhone||'')+'">'+
      '<input id="trConductorName" placeholder="Conductor name (optional)" value="'+esc(edit?.conductorName||'')+'">'+
      '<input id="trConductorPhone" placeholder="Conductor phone (optional)" value="'+esc(edit?.conductorPhone||'')+'">'+
      '<select id="trVehicleStatus"><option value="active" '+(edit?.status!=='maintenance'&&edit?.status!=='inactive'?'selected':'')+'>Active</option><option value="maintenance" '+(edit?.status==='maintenance'?'selected':'')+'>Maintenance</option><option value="inactive" '+(edit?.status==='inactive'?'selected':'')+'>Inactive</option></select>'+
      '<input id="trVehicleNotes" placeholder="Vehicle notes (optional)" value="'+esc(edit?.notes||'')+'">'+
      '<button id="trSaveVehicle">'+(edit?'Update Vehicle':'Save Vehicle')+'</button>'+(edit?'<button id="trCancelVehicle" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function assignmentEditor(){
    if(!isHead())return '<div class="coverage-note">Aap ko sirf apne linked student ki transport information dikh rahi hai.</div>';
    const rs=routes().filter(x=>x.active!==false),vs=vehicles().filter(x=>x.status==='active');
    return '<article class="card" style="margin-top:16px"><h3>Assign Student Transport</h3><div class="form-grid">'+
      '<select id="trStudent"><option value="">Select student</option>'+students().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<select id="trRoute"><option value="">Select route</option>'+rs.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.routeName)+' · '+money(r.monthlyFee)+'</option>').join('')+'</select>'+
      '<select id="trVehicle"><option value="">Select vehicle</option>'+vs.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.registrationNo)+' · '+esc(v.vehicleType)+' · '+availableSeats(v)+' seats free</option>').join('')+'</select>'+
      '<input id="trPickupStop" placeholder="Pickup stop">'+
      '<input id="trDropStop" placeholder="Drop stop">'+
      '<input id="trEffective" type="date" value="'+today()+'">'+
      '<button id="trAssign">Save Assignment</button></div></article>';
  }
  function metrics(){
    const activeRoutes=routes().filter(x=>x.active!==false).length,activeVehicles=vehicles().filter(x=>x.status==='active'),activeAs=assignments().filter(x=>x.status==='active');
    const cap=activeVehicles.reduce((a,x)=>a+Number(x.capacity||0),0);
    return '<div class="cards"><article class="card stat"><span>Active Routes</span><strong>'+activeRoutes+'</strong></article><article class="card stat"><span>Active Vehicles</span><strong>'+activeVehicles.length+'</strong></article><article class="card stat"><span>Assigned Students</span><strong>'+activeAs.length+'</strong></article><article class="card stat"><span>Total Capacity</span><strong>'+cap+'</strong></article></div>';
  }
  function assignmentCards(rows){
    if(!rows.length)return '<div class="empty-state">No transport assignment.</div>';
    return rows.map(x=>'<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.routeName||'Route')+'</span><span class="badge">'+esc(x.status||'active')+'</span></div><h3>'+esc(x.studentName)+'</h3><p class="muted">'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</p><p><strong>Vehicle:</strong> '+esc(x.registrationNo||'-')+'</p><p><strong>Pickup:</strong> '+esc(x.pickupStop||'-')+' · <strong>Drop:</strong> '+esc(x.dropStop||'-')+'</p><p><strong>Driver:</strong> '+esc(x.driverName||'-')+(x.driverPhone?' · '+esc(x.driverPhone):'')+'</p><p><strong>Monthly Fee:</strong> '+money(x.monthlyFee)+'</p>'+(isHead()&&x.status==='active'?'<div class="paper-actions"><button class="secondary" data-tr-deactivate="'+esc(x.id)+'">Deactivate</button></div>':'')+'</article>').join('');
  }
  function routeCards(){
    const rs=routes().sort((a,b)=>String(a.routeName).localeCompare(String(b.routeName)));
    return rs.length?rs.map(r=>'<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(r.routeCode)+'</span><span class="badge">'+(r.active===false?'Inactive':'Active')+'</span></div><h3>'+esc(r.routeName)+'</h3><p class="muted">'+esc(r.pickupTime||'-')+' pickup · '+esc(r.dropTime||'-')+' drop</p><p><strong>Fee:</strong> '+money(r.monthlyFee)+'</p><p>'+esc((r.stops||[]).join(' → ')||'No stops added')+'</p>'+(isHead()?'<div class="paper-actions"><button data-tr-edit-route="'+esc(r.id)+'">Edit</button></div>':'')+'</article>').join(''):'<div class="empty-state">No routes configured.</div>';
  }
  function vehicleCards(){
    const vs=vehicles().sort((a,b)=>String(a.registrationNo).localeCompare(String(b.registrationNo)));
    return vs.length?vs.map(v=>'<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(v.registrationNo)+'</span><span class="badge">'+esc(v.status)+'</span></div><h3>'+esc(v.vehicleType)+'</h3><p><strong>Capacity:</strong> '+v.capacity+' · <strong>Free:</strong> '+availableSeats(v)+'</p><p><strong>Driver:</strong> '+esc(v.driverName||'-')+(v.driverPhone?' · '+esc(v.driverPhone):'')+'</p>'+(v.conductorName?'<p><strong>Conductor:</strong> '+esc(v.conductorName)+(v.conductorPhone?' · '+esc(v.conductorPhone):'')+'</p>':'')+(isHead()?'<div class="paper-actions"><button data-tr-edit-vehicle="'+esc(v.id)+'">Edit</button></div>':'')+'</article>').join(''):'<div class="empty-state">No vehicles configured.</div>';
  }
  async function saveRoute(){
    const id=$('trRouteEditId')?.value||'',routeCode=$('trRouteCode')?.value.trim(),routeName=$('trRouteName')?.value.trim();
    if(!routeCode||!routeName)return alert('Route code aur route name required hain.');
    const rows=routes(),dupe=rows.find(x=>x.routeCode.toLowerCase()===routeCode.toLowerCase()&&String(x.id)!==String(id));if(dupe)return alert('Route code already exists.');
    let item={id:id||String(Date.now()),routeCode,routeName,pickupTime:$('trPickupTime')?.value||'',dropTime:$('trDropTime')?.value||'',monthlyFee:Number($('trMonthlyFee')?.value||0),stops:($('trStops')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),active:$('trRouteActive')?.value==='true',notes:$('trRouteNotes')?.value.trim()||''};
    try{const c=await saveRouteCloud(item);if(c)item=c}catch(e){if(cloudReady())return alert('Cloud route save failed: '+(e.message||e))}
    write(ROUTE_KEY,rows.filter(x=>String(x.id)!==String(id)&&x.routeCode.toLowerCase()!==routeCode.toLowerCase()).concat(item));render();
  }
  async function saveVehicle(){
    const id=$('trVehicleEditId')?.value||'',registrationNo=$('trReg')?.value.trim(),capacity=Number($('trCapacity')?.value||0);
    if(!registrationNo||capacity<1)return alert('Registration no. aur valid capacity required hain.');
    const rows=vehicles(),dupe=rows.find(x=>x.registrationNo.toLowerCase()===registrationNo.toLowerCase()&&String(x.id)!==String(id));if(dupe)return alert('Registration no. already exists.');
    const assigned=id?activeAssignmentsForVehicle(id).length:0;if(capacity<assigned)return alert('Capacity current active assignments se kam nahi ho sakti.');
    let item={id:id||String(Date.now()),registrationNo,vehicleType:$('trVehicleType')?.value||'Van',capacity,driverName:$('trDriverName')?.value.trim()||'',driverPhone:$('trDriverPhone')?.value.trim()||'',conductorName:$('trConductorName')?.value.trim()||'',conductorPhone:$('trConductorPhone')?.value.trim()||'',status:$('trVehicleStatus')?.value||'active',notes:$('trVehicleNotes')?.value.trim()||''};
    try{const c=await saveVehicleCloud(item);if(c)item=c}catch(e){if(cloudReady())return alert('Cloud vehicle save failed: '+(e.message||e))}
    write(VEHICLE_KEY,rows.filter(x=>String(x.id)!==String(id)&&x.registrationNo.toLowerCase()!==registrationNo.toLowerCase()).concat(item));render();
  }
  async function assign(){
    const studentId=$('trStudent')?.value,routeId=$('trRoute')?.value,vehicleId=$('trVehicle')?.value,effectiveFrom=$('trEffective')?.value,pickupStop=$('trPickupStop')?.value.trim()||'',dropStop=$('trDropStop')?.value.trim()||'';
    if(!studentId||!routeId||!vehicleId||!effectiveFrom)return alert('Student, route, vehicle aur effective date required hain.');
    const v=vehicles().find(x=>String(x.id)===String(vehicleId)),r=routes().find(x=>String(x.id)===String(routeId)),s=students().find(x=>String(x.id)===String(studentId));if(!v||!r||!s)return;
    if(v.status!=='active')return alert('Selected vehicle active nahi.');
    if(availableSeats(v,studentId)<1)return alert('Vehicle capacity full hai.');
    try{const c=await assignCloud(studentId,routeId,vehicleId,pickupStop,dropStop,effectiveFrom);if(c){await pullCloud();render();return}}catch(e){if(cloudReady())return alert('Cloud assignment failed: '+(e.message||e))}
    const rows=assignments().filter(x=>String(x.studentId)!==String(studentId));
    rows.unshift({id:String(Date.now()),studentId:String(s.id),studentName:s.name,className:s.className||'',sectionName:s.sectionName||'',routeId:r.id,routeName:r.routeName,vehicleId:v.id,registrationNo:v.registrationNo,driverName:v.driverName,driverPhone:v.driverPhone,pickupStop,dropStop,monthlyFee:r.monthlyFee,effectiveFrom,status:'active'});
    write(ASSIGN_KEY,rows);render();
  }
  async function deactivate(id){
    if(!isHead()||!confirm('Deactivate this transport assignment?'))return;
    try{if(cloudReady()){await deactivateCloud(id);await pullCloud();render();return}}catch(e){return alert('Cloud update failed: '+(e.message||e))}
    const rows=assignments(),x=rows.find(a=>String(a.id)===String(id));if(x)x.status='inactive';write(ASSIGN_KEY,rows);render();
  }
  function editRoute(id){const x=routes().find(r=>String(r.id)===String(id));if(!x)return;const b=$('trRouteEditor');if(b)b.innerHTML=routeEditor(x);bindEditors()}
  function editVehicle(id){const x=vehicles().find(v=>String(v.id)===String(id));if(!x)return;const b=$('trVehicleEditor');if(b)b.innerHTML=vehicleEditor(x);bindEditors()}
  function printReport(rows){
    const st=settings(),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Transport Register</title><style>body{font-family:Arial;padding:28px;color:#17324a}.head{text-align:center}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border:1px solid #ccd6dc;padding:7px;text-align:left}</style></head><body><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Student Transport Register</h3></div><table><thead><tr><th>Student</th><th>Class</th><th>Route</th><th>Vehicle</th><th>Pickup</th><th>Drop</th><th>Driver</th><th>Fee</th></tr></thead><tbody>'+rows.filter(x=>x.status==='active').map(x=>'<tr><td>'+esc(x.studentName)+'</td><td>'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</td><td>'+esc(x.routeName||'-')+'</td><td>'+esc(x.registrationNo||'-')+'</td><td>'+esc(x.pickupStop||'-')+'</td><td>'+esc(x.dropStop||'-')+'</td><td>'+esc(x.driverName||'-')+'</td><td>'+money(x.monthlyFee)+'</td></tr>').join('')+'</tbody></table></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bindEditors(){
    $('trSaveRoute')?.addEventListener('click',saveRoute);$('trCancelRoute')?.addEventListener('click',render);
    $('trSaveVehicle')?.addEventListener('click',saveVehicle);$('trCancelVehicle')?.addEventListener('click',render);
  }
  function bind(rows){
    bindEditors();$('trAssign')?.addEventListener('click',assign);$('trPrint')?.addEventListener('click',()=>printReport(rows));
    document.querySelectorAll('[data-tr-edit-route]').forEach(b=>b.onclick=()=>editRoute(b.dataset.trEditRoute));
    document.querySelectorAll('[data-tr-edit-vehicle]').forEach(b=>b.onclick=()=>editVehicle(b.dataset.trEditVehicle));
    document.querySelectorAll('[data-tr-deactivate]').forEach(b=>b.onclick=()=>deactivate(b.dataset.trDeactivate));
  }
  async function render(){
    const root=$('transportCenterApp');if(!root)return;
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Transport cloud sync:',e.message)}}
    const visible=visibleAssignments(assignments()).sort((a,b)=>String(a.studentName).localeCompare(String(b.studentName)));
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><button id="trPrint" class="secondary">Print Transport Register</button></div>'+
      (isHead()?metrics():'')+
      '<div id="trRouteEditor" style="margin-top:16px">'+routeEditor()+'</div>'+
      '<div id="trVehicleEditor">'+vehicleEditor()+'</div>'+assignmentEditor()+
      '<div class="section-head" style="margin-top:18px"><div><h3>Student Transport</h3><p class="muted">Current route and vehicle assignments.</p></div></div><div class="paper-grid">'+assignmentCards(visible)+'</div>'+
      (isHead()?'<div class="section-head" style="margin-top:18px"><div><h3>Routes</h3></div></div><div class="paper-grid">'+routeCards()+'</div><div class="section-head" style="margin-top:18px"><div><h3>Vehicles</h3></div></div><div class="paper-grid">'+vehicleCards()+'</div>':'');
    bind(visible);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('transportCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_TRANSPORT_CENTER={render,pullCloud,cloudReady};
})();