(function(){
  const ATT_KEY='edunizam_staff_attendance_v1';
  const STAFF_KEY='edunizam_staff_profiles_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'').trim().toLowerCase();
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const monthKey=()=>today().slice(0,7);
  const staff=()=>read(STAFF_KEY,[]);
  const attendance=()=>read(ATT_KEY,[]);
  function mine(){
    if(isHead())return staff();
    const id=identity(),uid=String(cloud()?.state?.user?.id||'');
    return staff().filter(x=>String(x.userId||'')===uid||[x.staffCode,x.phone,x.fullName].some(v=>String(v||'').trim().toLowerCase()===id));
  }
  function localDateKey(value){const d=value?new Date(value):new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function displayTime(value){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
  function duration(row){if(!row.checkInAt||!row.checkOutAt)return row.checkInAt?'In progress':'—';const ms=new Date(row.checkOutAt)-new Date(row.checkInAt);if(ms<0)return'Invalid';const mins=Math.floor(ms/60000);return Math.floor(mins/60)+'h '+String(mins%60).padStart(2,'0')+'m'}
  function locate(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('Location is not supported on this device.'));navigator.geolocation.getCurrentPosition(p=>resolve({latitude:Number(p.coords.latitude.toFixed(6)),longitude:Number(p.coords.longitude.toFixed(6)),accuracy:Math.round(p.coords.accuracy||0)}),e=>reject(new Error(e.code===1?'Location permission denied. Browser settings se location allow karein.':'Current location could not be verified.')),{enableHighAccuracy:true,timeout:15000,maximumAge:30000})})}
  function mapLink(lat,lng,accuracy){if(lat==null||lng==null)return'<span class="muted">Not captured</span>';const url='https://www.google.com/maps?q='+encodeURIComponent(lat+','+lng);return'<a class="secondary-link" href="'+url+'" target="_blank" rel="noopener">Map · ±'+Number(accuracy||0)+'m</a>'}
  function rowFor(staffId,date=today()){return attendance().find(x=>String(x.staffId)===String(staffId)&&x.date===date)||null}
  function canAct(staffId){return role()==='teacher'&&mine().some(x=>String(x.id)===String(staffId))}
  async function pullCloud(){
    if(!cloudReady())return;
    const {data,error}=await cloud().state.client.from('staff_attendance_records').select('*,staff_profiles(full_name,staff_code,user_id)').eq('institution_id',cfg().institutionId).order('attendance_date',{ascending:false});
    if(error)throw error;
    const mapped=(data||[]).map(x=>({id:x.id,staffId:x.staff_profile_id,date:x.attendance_date,status:x.status,note:x.note||'',checkInAt:x.check_in_at||'',checkOutAt:x.check_out_at||'',checkInLat:x.check_in_latitude,checkInLng:x.check_in_longitude,checkInAccuracy:x.check_in_accuracy_m,checkOutLat:x.check_out_latitude,checkOutLng:x.check_out_longitude,checkOutAccuracy:x.check_out_accuracy_m,staffName:x.staff_profiles?.full_name||'',staffUserId:x.staff_profiles?.user_id||'',markedBy:x.marked_by||''}));
    write(ATT_KEY,mapped);
  }
  async function saveCloud(item){
    if(!cloudReady())return null;
    const payload={institution_id:cfg().institutionId,staff_profile_id:item.staffId,attendance_date:item.date,status:item.status,note:item.note||null,check_in_at:item.checkInAt||null,check_out_at:item.checkOutAt||null,check_in_latitude:item.checkInLat??null,check_in_longitude:item.checkInLng??null,check_in_accuracy_m:item.checkInAccuracy??null,check_out_latitude:item.checkOutLat??null,check_out_longitude:item.checkOutLng??null,check_out_accuracy_m:item.checkOutAccuracy??null,marked_by:cloud().state.user.id,updated_at:new Date().toISOString()};
    const {data,error}=await cloud().state.client.from('staff_attendance_records').upsert(payload,{onConflict:'staff_profile_id,attendance_date'}).select().single();
    if(error)throw error;return data;
  }
  async function persist(item){
    try{const row=await saveCloud(item);if(row)item={...item,id:row.id,checkInAt:row.check_in_at||'',checkOutAt:row.check_out_at||'',markedBy:row.marked_by||'',staffUserId:item.staffUserId||staff().find(x=>String(x.id)===String(item.staffId))?.userId||''}}catch(e){if(cloudReady())return alert('Cloud time clock failed: '+(e.message||e))}
    const rows=attendance().filter(x=>!(String(x.staffId)===String(item.staffId)&&x.date===item.date));rows.push(item);write(ATT_KEY,rows);
    try{await window.EDUNIZAM_WORKFLOW_ALERTS?.staffAttendanceSaved?.(item)}catch(e){console.warn('Staff attendance alert:',e.message||e)}
    window.dispatchEvent(new CustomEvent('edunizam:attendance-updated',{detail:{kind:'staff',date:item.date,staffId:item.staffId,status:item.status}}));
    render();
  }
  async function clock(staffId,action){
    if(!canAct(staffId))return;let position;try{position=await locate()}catch(e){return alert(e.message||String(e))}const now=new Date().toISOString(),old=rowFor(staffId)||{},st=staff().find(x=>String(x.id)===String(staffId));
    let item={id:old.id||staffId+'-'+today(),staffId,date:today(),status:old.status||'Present',note:old.note||'',checkInAt:old.checkInAt||'',checkOutAt:old.checkOutAt||'',checkInLat:old.checkInLat??null,checkInLng:old.checkInLng??null,checkInAccuracy:old.checkInAccuracy??null,checkOutLat:old.checkOutLat??null,checkOutLng:old.checkOutLng??null,checkOutAccuracy:old.checkOutAccuracy??null,staffName:st?.fullName||''};
    if(action==='in'){
      if(item.checkInAt&&!confirm('Check-in already recorded. Current time se replace karein?'))return;
      item.checkInAt=now;item.checkOutAt='';item.checkInLat=position.latitude;item.checkInLng=position.longitude;item.checkInAccuracy=position.accuracy;item.checkOutLat=null;item.checkOutLng=null;item.checkOutAccuracy=null;item.status='Present';
    }else{
      if(!item.checkInAt)return alert('Pehle check-in karein.');
      if(item.checkOutAt&&!confirm('Check-out already recorded. Current time se replace karein?'))return;
      item.checkOutAt=now;item.checkOutLat=position.latitude;item.checkOutLng=position.longitude;item.checkOutAccuracy=position.accuracy;
    }
    await persist(item);
  }
  async function adminMarkStaffStatus(staffId,status){
    if(!isHead())return;
    const st=staff().find(x=>String(x.id)===String(staffId));if(!st)return;
    const existing=rowFor(staffId);
    if(existing?.checkInAt&&status!=='Present'){
      return alert('Is Teacher ka check-in already recorded hai. Status/time correction ke liye Manual Time Adjustment use karein.');
    }
    let note=existing?.note||'';
    if(status==='Absent'||status==='Leave')note=prompt(status+' reason / note (optional):',note)||'';
    await persist({
      id:existing?.id||staffId+'-'+today(),
      staffId,date:today(),status,note,
      checkInAt:existing?.checkInAt||'',
      checkOutAt:existing?.checkOutAt||'',
      checkInLat:existing?.checkInLat??null,
      checkInLng:existing?.checkInLng??null,
      checkInAccuracy:existing?.checkInAccuracy??null,
      checkOutLat:existing?.checkOutLat??null,
      checkOutLng:existing?.checkOutLng??null,
      checkOutAccuracy:existing?.checkOutAccuracy??null,
      staffName:st.fullName||''
    });
  }

  async function markStaffAbsent(staffId){
    if(!isHead())return;
    const st=staff().find(x=>String(x.id)===String(staffId));if(!st)return;
    const existing=rowFor(staffId);
    if(existing?.status==='Absent')return alert((st.fullName||'Staff')+' is already marked Absent today.');
    if(existing?.checkInAt)return alert('This staff member already has a check-in record today.');
    if(!confirm('Mark '+(st.fullName||'this staff member')+' Absent for today?'))return;
    const note=prompt('Absent reason / note (optional):','')||'';
    await persist({
      id:existing?.id||staffId+'-'+today(),
      staffId,date:today(),status:'Absent',note,
      checkInAt:'',checkOutAt:'',
      staffName:st.fullName||''
    });
  }

  async function manualSave(){
    if(!isHead())return;const staffId=$('staManualStaff')?.value,date=$('staManualDate')?.value,status=$('staManualStatus')?.value;
    if(!staffId||!date)return alert('Staff aur date select karein.');
    const start=$('staManualIn')?.value,end=$('staManualOut')?.value,old=rowFor(staffId,date)||{},makeIso=t=>t?new Date(date+'T'+t+':00').toISOString():'';
    if(start&&end&&end<=start)return alert('Check-out time check-in ke baad honi chahiye.');
    await persist({id:old.id||staffId+'-'+date,staffId,date,status,note:$('staManualNote')?.value.trim()||'',checkInAt:makeIso(start),checkOutAt:makeIso(end),staffName:staff().find(x=>String(x.id)===String(staffId))?.fullName||''});
  }
  function statusBadge(x){return x.checkInAt&&!x.checkOutAt?'On Campus':x.checkOutAt?'Completed':x.status||'Not Marked'}
  function todayCard(st){
    const row=rowFor(st.id),badge=statusBadge(row||{});
    const teacherActions=canAct(st.id)?'<div class="paper-actions">'+(!row?.checkInAt?'<button data-clock-in="'+esc(st.id)+'">Clock In Now</button>':'')+(row?.checkInAt&&!row?.checkOutAt?'<button data-clock-out="'+esc(st.id)+'">Clock Out Now</button>':'')+'</div>':'';
    const adminActions=isHead()?'<div class="paper-actions"><button data-admin-staff-status="'+esc(st.id)+'" data-status="Present">Present</button><button class="secondary" data-admin-staff-status="'+esc(st.id)+'" data-status="Absent">Absent</button><button class="secondary" data-admin-staff-status="'+esc(st.id)+'" data-status="Leave">Leave</button></div>':'';
    const actions=teacherActions+adminActions;
    return '<article class="paper-card timeclock-card"><div class="paper-card-top"><span class="mini-badge">'+esc(st.staffCode||'Staff')+'</span><span class="badge">'+esc(badge)+'</span></div><h3>'+esc(st.fullName)+'</h3><p class="muted">'+esc(st.designation||'Staff')+(st.phone?' · '+esc(st.phone):' · No contact number')+'</p><div class="time-punch-grid"><div><span>Check In</span><strong>'+displayTime(row?.checkInAt)+'</strong></div><div><span>Check Out</span><strong>'+displayTime(row?.checkOutAt)+'</strong></div><div><span>Worked</span><strong>'+duration(row||{})+'</strong></div></div>'+(row?.checkInAt?'<div class="paper-actions"><span>In: '+mapLink(row.checkInLat,row.checkInLng,row.checkInAccuracy)+'</span>'+(row?.checkOutAt?'<span>Out: '+mapLink(row.checkOutLat,row.checkOutLng,row.checkOutAccuracy)+'</span>':'')+'</div>':'')+actions+'</article>';
  }
  function staffMarkerLabel(row,st){
    if(!row?.markedBy)return 'Local / not recorded';
    const staffUser=String(row.staffUserId||st?.userId||'');
    return staffUser&&String(row.markedBy)===staffUser?'Teacher self':'Admin';
  }
  function logRows(month){
    const ids=new Set(mine().map(x=>String(x.id))),rows=attendance().filter(x=>ids.has(String(x.staffId))&&String(x.date).startsWith(month)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if(!rows.length)return'<div class="empty-state">Is month ka exact-time attendance record available nahi hai.</div>';
    return '<div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Date</th><th>Staff</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Worked</th>'+(isHead()?'<th>Marked By</th>':'')+'<th>Verified Location</th></tr></thead><tbody>'+rows.map(x=>{const st=staff().find(s=>String(s.id)===String(x.staffId));return'<tr><td>'+esc(x.date)+'</td><td><strong>'+esc(st?.fullName||x.staffName||'Staff')+'</strong></td><td>'+esc(x.status)+'</td><td>'+displayTime(x.checkInAt)+'</td><td>'+displayTime(x.checkOutAt)+'</td><td>'+duration(x)+'</td>'+(isHead()?'<td><span class="badge">'+esc(staffMarkerLabel(x,st))+'</span></td>':'')+'<td><div class="paper-actions">'+mapLink(x.checkInLat,x.checkInLng,x.checkInAccuracy)+(x.checkOutAt?mapLink(x.checkOutLat,x.checkOutLng,x.checkOutAccuracy):'')+'</div></td></tr>'}).join('')+'</tbody></table></div>';
  }
  function manualEditor(){if(!isHead())return'';return'<article class="card"><div class="section-head"><div><h3>Manual Time Adjustment</h3><p class="muted">Head exact time correct ya back-date kar sakta hai.</p></div></div><div class="form-grid"><select id="staManualStaff"><option value="">Select staff</option>'+staff().filter(x=>x.status!=='inactive').map(x=>'<option value="'+esc(x.id)+'">'+esc(x.fullName)+'</option>').join('')+'</select><input id="staManualDate" type="date" value="'+today()+'"><select id="staManualStatus"><option>Present</option><option>Absent</option><option>Leave</option><option>Half Day</option></select><input id="staManualIn" type="time"><input id="staManualOut" type="time"><input id="staManualNote" placeholder="Adjustment note"><button id="staManualSave">Save Exact Time</button></div></article>'}
  function bind(){
    document.querySelectorAll('[data-clock-in]').forEach(b=>b.onclick=()=>clock(b.dataset.clockIn,'in'));
    document.querySelectorAll('[data-clock-out]').forEach(b=>b.onclick=()=>clock(b.dataset.clockOut,'out'));
    document.querySelectorAll('[data-mark-staff-absent]').forEach(b=>b.onclick=()=>markStaffAbsent(b.dataset.markStaffAbsent));
    document.querySelectorAll('[data-admin-staff-status]').forEach(b=>b.onclick=()=>adminMarkStaffStatus(b.dataset.adminStaffStatus,b.dataset.status));
    $('staManualSave')?.addEventListener('click',manualSave);$('staMonth')?.addEventListener('change',e=>{const box=$('staLog');if(box)box.innerHTML=logRows(e.target.value)});
  }
  async function render(){
    const root=$('staffTimeApp');if(!root)return;
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Staff time cloud sync:',e.message)}}
    const people=mine().filter(x=>x.status!=='inactive'),todayRows=people.map(x=>rowFor(x.id)).filter(Boolean),inside=todayRows.filter(x=>x.checkInAt&&!x.checkOutAt).length,complete=todayRows.filter(x=>x.checkOutAt).length;
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Time + Location':'Local Time Mode')+'</span><p class="muted">'+(isHead()?'Admin view: kisi bhi Teacher ko Present / Absent / Leave mark karein; exact/back-date correction neeche Manual Time Adjustment se karein.':'Teacher sirf apni attendance Clock In/Out kar sakta hai; doosre Teacher ki attendance access nahi.')+'</p></div><strong>'+new Date().toLocaleString()+'</strong></div><div class="cards"><article class="card stat"><span>Visible Staff</span><strong>'+people.length+'</strong></article><article class="card stat"><span>Checked In</span><strong>'+inside+'</strong></article><article class="card stat"><span>Completed Today</span><strong>'+complete+'</strong></article><article class="card stat"><span>Not Marked</span><strong>'+Math.max(0,people.length-todayRows.length)+'</strong></article></div>'+manualEditor()+'<div class="section-head" style="margin-top:18px"><div><h3>Today Time Clock</h3><p class="muted">Second-level timestamps with device location.</p></div></div><div class="paper-grid">'+(people.length?people.map(todayCard).join(''):'<div class="empty-state">No linked staff profile.</div>')+'</div><article class="card" style="margin-top:18px"><div class="section-head"><div><h3>Monthly Time Log</h3><p class="muted">Exact attendance history, worked duration and location.</p></div><input id="staMonth" type="month" value="'+monthKey()+'"></div><div id="staLog">'+logRows(monthKey())+'</div></article>';
    bind();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('staffTimeApp');if(root)delete root.dataset.cloudLoaded;render()});
  setInterval(()=>{if(document.getElementById('stafftime')?.classList.contains('active')){const root=$('staffTimeApp');if(root)delete root.dataset.cloudLoaded;render()}},30000);
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_STAFF_TIME={render,pullCloud,cloudReady};
})();
