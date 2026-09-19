(function(){
  const KEY='edunizam_leave_requests_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'');
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function isStaff(){return ['teacher','head'].includes(role())}
  function canSubmit(){return ['student','parent'].includes(role())}
  function studentLabel(s){return [s.name,s.className&&('Class '+s.className),s.studentId||s.rollNo||s.phone].filter(Boolean).join(' · ')}
  function localVisibleRequest(r){
    if(role()==='head')return true;
    const visibleIds=new Set(visibleStudents().map(s=>String(s.id)));
    if(role()==='teacher')return visibleIds.has(String(r.studentLocalId));
    return visibleIds.has(String(r.studentLocalId));
  }
  function statusClass(s){return s==='Approved'?'good':s==='Rejected'?'high':'medium'}
  function eligibleSubmitStudents(){return visibleStudents()}

  async function cloudStudentAuthId(localId){
    const s=students().find(x=>String(x.id)===String(localId));
    if(s?.authUserId)return s.authUserId;
    if(!cloudReady()||!s)return null;
    const c=cloud();
    let q=c.state.client.from('core_students').select('auth_user_id').eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);
    else q=q.eq('local_id',Number(s.id));
    const {data}=await q.maybeSingle();
    return data?.auth_user_id||null;
  }

  async function pullCloud(){
    if(!cloudReady())return read();
    const c=cloud(),user=c.state.user;
    const {data,error}=await c.state.client.from('leave_requests').select('*').eq('institution_id',cfg().institutionId).order('created_at',{ascending:false});
    if(error)throw error;
    const local=students(),byAuth=new Map(local.filter(s=>s.authUserId).map(s=>[s.authUserId,s]));
    const mapped=(data||[]).map(x=>{
      const ls=byAuth.get(x.student_user_id);
      return {
        id:x.id,
        studentLocalId:ls?.id||x.local_student_id||'',
        studentUserId:x.student_user_id||null,
        studentName:ls?.name||x.student_name||'Student',
        className:ls?.className||x.class_name||'',
        fromDate:x.from_date,toDate:x.to_date,reason:x.reason,status:x.status,
        decisionNote:x.decision_note||'',submittedBy:x.submitted_by||'',
        submittedRole:x.requester_role||'',createdAt:x.created_at,decidedAt:x.decided_at||''
      };
    });
    write(mapped);return mapped;
  }

  async function insertCloud(item){
    if(!cloudReady())return null;
    const c=cloud(),studentUserId=await cloudStudentAuthId(item.studentLocalId);
    if(!studentUserId)throw new Error('Student cloud account/link required before cloud leave submission.');
    const payload={
      institution_id:cfg().institutionId,
      student_user_id:studentUserId,
      local_student_id:Number(item.studentLocalId)||null,
      student_name:item.studentName,
      class_name:item.className||null,
      submitted_by:c.state.user.id,
      requester_role:role(),
      from_date:item.fromDate,to_date:item.toDate,reason:item.reason,status:'Pending'
    };
    const {data,error}=await c.state.client.from('leave_requests').insert(payload).select().single();
    if(error)throw error;return data;
  }

  async function decideCloud(id,status,note){
    if(!cloudReady())return null;
    const c=cloud();
    const {data,error}=await c.state.client.from('leave_requests').update({
      status,decision_note:note||null,decided_by:c.state.user.id,decided_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',id).select().single();
    if(error)throw error;return data;
  }

  function renderForm(){
    if(!canSubmit())return '<div class="coverage-note">Teacher/Head approval view. Student/Parent leave request submit karte hain.</div>';
    const list=eligibleSubmitStudents();
    if(!list.length)return '<div class="empty-state">Aap ke login se koi linked student record nahi mila. Student ID/phone/roll number matching ya cloud link required hai.</div>';
    return '<article class="card"><h3>New Leave Request</h3><div class="form-grid">'+
      '<select id="leaveStudent">'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(studentLabel(s))+'</option>').join('')+'</select>'+
      '<input id="leaveFrom" type="date" value="'+today()+'">'+
      '<input id="leaveTo" type="date" value="'+today()+'">'+
      '<textarea id="leaveReason" rows="3" placeholder="Leave reason"></textarea>'+
      '<button id="submitLeave">Submit Request</button></div></article>';
  }

  function card(x){
    const staff=isStaff();
    const buttons=staff&&x.status==='Pending'
      ?'<button data-leave-approve="'+esc(x.id)+'">Approve</button><button class="secondary" data-leave-reject="'+esc(x.id)+'">Reject</button>'
      :'';
    return '<article class="paper-card">'+
      '<div class="paper-card-top"><span class="mini-badge">Class '+esc(x.className||'-')+'</span><span id="profileRiskBadge" data-risk="'+statusClass(x.status)+'">'+esc(x.status)+'</span></div>'+
      '<h3>'+esc(x.studentName||'Student')+'</h3>'+
      '<p class="muted">'+esc(x.fromDate)+' → '+esc(x.toDate)+'</p>'+
      '<p>'+esc(x.reason||'')+'</p>'+
      (x.decisionNote?'<p class="coverage-note"><strong>Decision note:</strong> '+esc(x.decisionNote)+'</p>':'')+
      '<div class="paper-actions">'+buttons+'</div></article>';
  }

  async function submit(){
    const sid=$('leaveStudent')?.value,from=$('leaveFrom')?.value,to=$('leaveTo')?.value,reason=$('leaveReason')?.value.trim();
    if(!sid||!from||!to||!reason)return alert('Student, dates aur reason complete karein.');
    if(to<from)return alert('To date, From date se pehle nahi ho sakti.');
    const s=students().find(x=>String(x.id)===String(sid));if(!s)return alert('Student record not found.');
    let item={id:String(Date.now()),studentLocalId:s.id,studentUserId:s.authUserId||null,studentName:s.name,className:s.className||'',fromDate:from,toDate:to,reason,status:'Pending',decisionNote:'',submittedBy:identity(),submittedRole:role(),createdAt:new Date().toISOString()};
    try{
      const row=await insertCloud(item);
      if(row){item.id=row.id;item.studentUserId=row.student_user_id;item.submittedBy=row.submitted_by;item.createdAt=row.created_at}
    }catch(e){alert('Cloud submit unavailable; request local mode mein save hogi. '+(e.message||e))}
    const arr=read();arr.unshift(item);write(arr);render();
  }

  async function decide(id,status){
    const arr=read(),item=arr.find(x=>String(x.id)===String(id));if(!item||!isStaff())return;
    const note=prompt(status+' note (optional):','')||'';
    try{await decideCloud(id,status,note)}catch(e){if(cloudReady())return alert('Cloud decision failed: '+(e.message||e))}
    item.status=status;item.decisionNote=note;item.decidedAt=new Date().toISOString();write(arr);
    try{
      if(item.studentUserId&&window.EDUNIZAM_CLOUD?.sendNotification){
        await window.EDUNIZAM_CLOUD.sendNotification(item.studentUserId,'Leave request '+status.toLowerCase(),item.fromDate+' to '+item.toDate+(note?' · '+note:''),'leave');
      }
    }catch(_){}
    render();
  }

  function bind(){
    if($('submitLeave'))$('submitLeave').onclick=submit;
    document.querySelectorAll('[data-leave-approve]').forEach(b=>b.onclick=()=>decide(b.dataset.leaveApprove,'Approved'));
    document.querySelectorAll('[data-leave-reject]').forEach(b=>b.onclick=()=>decide(b.dataset.leaveReject,'Rejected'));
  }

  async function render(){
    const root=$('leaveCenterApp');if(!root)return;
    let arr=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{arr=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Leave cloud sync:',e.message)}
    }
    arr=arr.filter(localVisibleRequest);
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+renderForm()+
      '<div class="paper-grid" style="margin-top:16px">'+(arr.length?arr.map(card).join(''):'<div class="empty-state">Abhi koi relevant leave request nahi hai.</div>')+'</div>';
    bind();
  }

  window.addEventListener('edunizam:auth',()=>{const root=$('leaveCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,700);
  window.EDUNIZAM_LEAVE_CENTER={render,read,pullCloud,cloudReady};
})();