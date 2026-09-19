(function(){
  const KEY='edunizam_student_behavior_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isStaff=()=>['head','teacher'].includes(role());
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function visibleRows(rows){
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    if(isStaff())return rows.filter(x=>ids.has(String(x.studentId)) || isHead());
    return rows.filter(x=>ids.has(String(x.studentId))&&x.familyVisible);
  }
  function badgeRisk(x){
    if(x.recordType==='Positive Note')return 'good';
    if(x.severity==='High')return 'high';
    if(x.severity==='Medium')return 'medium';
    return 'good';
  }
  async function cloudStudent(localId){
    if(!cloudReady())return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id').eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function toLocal(x){
    const s=x.core_students||{};
    return {id:x.id,studentId:String(s.local_id??x.student_id),studentCloudId:x.student_id,studentName:s.name||'Student',className:s.class_name||'',sectionName:s.section_name||'',recordType:x.record_type,severity:x.severity,recordDate:x.record_date,title:x.title,details:x.details||'',actionTaken:x.action_taken||'',familyVisible:x.family_visible===true,status:x.status||'Open',acknowledgedAt:x.acknowledged_at||'',acknowledgedBy:x.acknowledged_by||'',createdBy:x.created_by||'',createdAt:x.created_at};
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('student_behavior_records')
      .select('*,core_students(local_id,name,class_name,section_name,auth_user_id)')
      .eq('institution_id',cfg().institutionId).order('record_date',{ascending:false}).order('created_at',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(toLocal);write(rows);return rows;
  }
  async function createCloud(item){
    const cs=await cloudStudent(item.studentId);if(!cs)throw new Error('Student cloud record not found.');
    const {data,error}=await cloud().state.client.rpc('create_student_behavior_record',{
      p_student_id:cs.id,p_record_type:item.recordType,p_severity:item.severity,p_record_date:item.recordDate,
      p_title:item.title,p_details:item.details||null,p_action_taken:item.actionTaken||null,p_family_visible:item.familyVisible
    });
    if(error)throw error;return data;
  }
  async function resolveCloud(id,status){
    const {data,error}=await cloud().state.client.from('student_behavior_records').update({status,updated_at:new Date().toISOString()}).eq('id',id).select().single();
    if(error)throw error;return data;
  }
  async function deleteCloud(id){
    const {error}=await cloud().state.client.from('student_behavior_records').delete().eq('id',id);if(error)throw error;
  }
  async function acknowledgeCloud(id){
    const {data,error}=await cloud().state.client.rpc('acknowledge_student_behavior_record',{p_record_id:id});if(error)throw error;return data;
  }
  function editor(){
    if(!isStaff())return '<div class="coverage-note">Aap ko sirf family-shared behavior records dikhaye ja rahe hain.</div>';
    return '<article class="card"><h3>Add Student Development Record</h3><div class="form-grid">'+
      '<select id="bhStudent"><option value="">Select student</option>'+visibleStudents().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<select id="bhType"><option>Positive Note</option><option>Concern</option><option>Warning</option><option>Incident</option></select>'+
      '<select id="bhSeverity"><option>Low</option><option>Medium</option><option>High</option></select>'+
      '<input id="bhDate" type="date" value="'+today()+'">'+
      '<input id="bhTitle" placeholder="Short title">'+
      '<textarea id="bhDetails" rows="3" placeholder="Details"></textarea>'+
      '<textarea id="bhAction" rows="2" placeholder="Action taken / follow-up (optional)"></textarea>'+
      '<label><input id="bhFamilyVisible" type="checkbox" checked> Share with family</label>'+
      '<button id="bhSave">Save Record</button></div></article>';
  }
  function metrics(rows){
    const positive=rows.filter(x=>x.recordType==='Positive Note').length,open=rows.filter(x=>x.status!=='Resolved').length,high=rows.filter(x=>x.severity==='High'&&x.status!=='Resolved').length,shared=rows.filter(x=>x.familyVisible).length;
    return '<div class="cards"><article class="card stat"><span>Positive Notes</span><strong>'+positive+'</strong></article><article class="card stat"><span>Open Records</span><strong>'+open+'</strong></article><article class="card stat"><span>High Priority</span><strong>'+high+'</strong></article><article class="card stat"><span>Shared with Family</span><strong>'+shared+'</strong></article></div>';
  }
  function recordCard(x){
    const canManage=isHead()||(role()==='teacher'&&(!x.createdBy||String(x.createdBy)===String(cloud()?.state?.user?.id||'')));
    const canAck=!isStaff()&&x.familyVisible&&!x.acknowledgedAt;
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.recordType)+'</span><span id="profileRiskBadge" data-risk="'+badgeRisk(x)+'">'+esc(x.severity)+'</span></div>'+
      '<h3>'+esc(x.title)+'</h3><p class="muted">'+esc(x.studentName)+' · '+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+' · '+esc(x.recordDate)+'</p>'+
      (x.details?'<p>'+esc(x.details)+'</p>':'')+(x.actionTaken?'<p><strong>Action:</strong> '+esc(x.actionTaken)+'</p>':'')+
      '<p><strong>Status:</strong> '+esc(x.status)+(x.familyVisible?' · Family shared':' · Staff only')+(x.acknowledgedAt?' · Acknowledged':'')+'</p>'+
      ((canManage||canAck)?'<div class="paper-actions">'+
        (canManage&&x.status!=='Resolved'?'<button data-bh-resolve="'+esc(x.id)+'">Mark Resolved</button>':'')+
        (canManage?'<button class="secondary" data-bh-delete="'+esc(x.id)+'">Delete</button>':'')+
        (canAck?'<button data-bh-ack="'+esc(x.id)+'">Acknowledge</button>':'')+
      '</div>':'')+'</article>';
  }
  async function save(){
    const studentId=$('bhStudent')?.value,title=$('bhTitle')?.value.trim(),recordDate=$('bhDate')?.value;if(!studentId||!title||!recordDate)return alert('Student, title aur date required hain.');
    const s=students().find(x=>String(x.id)===String(studentId));if(!s)return;
    let item={id:String(Date.now()),studentId:String(s.id),studentName:s.name,className:s.className||'',sectionName:s.sectionName||'',recordType:$('bhType')?.value||'Concern',severity:$('bhSeverity')?.value||'Low',recordDate,title,details:$('bhDetails')?.value.trim()||'',actionTaken:$('bhAction')?.value.trim()||'',familyVisible:!!$('bhFamilyVisible')?.checked,status:'Open',acknowledgedAt:'',acknowledgedBy:'',createdBy:cloud()?.state?.user?.id||'',createdAt:new Date().toISOString()};
    try{if(cloudReady()){await createCloud(item);await pullCloud();render();return}}catch(e){return alert('Cloud behavior record failed: '+(e.message||e))}
    const rows=read();rows.unshift(item);write(rows);render();
  }
  async function resolve(id){
    const rows=read(),x=rows.find(r=>String(r.id)===String(id));if(!x||!isStaff())return;
    try{if(cloudReady()){await resolveCloud(id,'Resolved');await pullCloud();render();return}}catch(e){return alert('Cloud update failed: '+(e.message||e))}
    x.status='Resolved';write(rows);render();
  }
  async function remove(id){
    if(!isStaff()||!confirm('Delete this behavior record?'))return;
    try{if(cloudReady()){await deleteCloud(id);await pullCloud();render();return}}catch(e){return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(x=>String(x.id)!==String(id)));render();
  }
  async function acknowledge(id){
    const rows=read(),x=rows.find(r=>String(r.id)===String(id));if(!x||isStaff()||!x.familyVisible)return;
    try{if(cloudReady()){await acknowledgeCloud(id);await pullCloud();render();return}}catch(e){return alert('Acknowledgement failed: '+(e.message||e))}
    x.acknowledgedAt=new Date().toISOString();x.acknowledgedBy=role();write(rows);render();
  }
  function printReport(rows){
    const st=settings(),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Behavior Report</title><style>body{font-family:Arial;padding:28px;color:#17324a}.head{text-align:center}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border:1px solid #ccd6dc;padding:7px;text-align:left}</style></head><body><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Student Discipline & Behavior Report</h3></div><table><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Type</th><th>Severity</th><th>Title</th><th>Status</th><th>Family</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.recordDate)+'</td><td>'+esc(x.studentName)+'</td><td>'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</td><td>'+esc(x.recordType)+'</td><td>'+esc(x.severity)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.status)+'</td><td>'+(x.familyVisible?'Shared':'Internal')+'</td></tr>').join('')+'</tbody></table></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(rows){
    $('bhSave')?.addEventListener('click',save);$('bhPrint')?.addEventListener('click',()=>printReport(rows));$('bhStudentFilter')?.addEventListener('change',render);
    document.querySelectorAll('[data-bh-resolve]').forEach(b=>b.onclick=()=>resolve(b.dataset.bhResolve));
    document.querySelectorAll('[data-bh-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.bhDelete));
    document.querySelectorAll('[data-bh-ack]').forEach(b=>b.onclick=()=>acknowledge(b.dataset.bhAck));
  }
  async function render(){
    const root=$('behaviorCenterApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Behavior cloud sync:',e.message)}}
    rows=visibleRows(rows);
    const filter=$('bhStudentFilter')?.value||root.dataset.studentFilter||'all';root.dataset.studentFilter=filter;
    const filtered=filter==='all'?rows:rows.filter(x=>String(x.studentId)===String(filter));
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><div class="quick-actions">'+
      (isStaff()?'<select id="bhStudentFilter"><option value="all">All accessible students</option>'+visibleStudents().map(s=>'<option value="'+esc(s.id)+'" '+(String(filter)===String(s.id)?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select>':'')+
      '<button id="bhPrint" class="secondary">Print Behavior Report</button></div></div>'+
      metrics(filtered)+'<div style="margin-top:16px">'+editor()+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Behavior Records</h3><p class="muted">Positive development and discipline follow-up history.</p></div></div><div class="paper-grid">'+(filtered.length?filtered.map(recordCard).join(''):'<div class="empty-state">No behavior records.</div>')+'</div>';
    bind(filtered);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('behaviorCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_BEHAVIOR_CENTER={render,pullCloud,cloudReady};
})();