(function(){
  const KEY='edunizam_leave_requests_v2';
  const LEGACY_KEY='edunizam_leave_requests_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const identity=()=>String(session()?.identity||'');
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const currentUserId=()=>cloud()?.state?.user?.id||'';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){
    try{
      const current=JSON.parse(localStorage.getItem(KEY)||'null');
      if(Array.isArray(current))return current;
      const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]');
      if(Array.isArray(legacy)){write(legacy);return legacy}
    }catch(_){}
    return[];
  }
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function isAdmin(){return role()==='head'}
  function canSubmit(){return ['student','parent','teacher'].includes(role())}
  function studentLabel(s){return [s.name,s.className&&('Class '+s.className),s.sectionName&&('Section '+s.sectionName),s.admissionNo&&('Adm '+s.admissionNo)].filter(Boolean).join(' · ')}
  function localVisibleRequest(r){
    if(isAdmin())return true;
    if(role()==='teacher'&&r.leaveFor==='staff'){
      return String(r.submittedBy||'')===String(currentUserId()||identity())||String(r.submittedIdentity||'')===identity();
    }
    const visibleIds=new Set(visibleStudents().map(s=>String(s.id)));
    return visibleIds.has(String(r.studentLocalId));
  }
  function statusClass(s){return s==='Approved'?'good':s==='Rejected'?'high':'medium'}
  function eligibleSubmitStudents(){return visibleStudents()}

  async function currentProfileName(){
    if(!cloudReady())return identity()||'User';
    const c=cloud();
    try{
      const {data,error}=await c.state.client.from('user_profiles').select('full_name').eq('user_id',c.state.user.id).maybeSingle();
      if(!error&&data?.full_name)return data.full_name;
    }catch(_){}
    return c.state.user?.email||identity()||'User';
  }

  async function cloudStudentAuthId(localId){
    const s=students().find(x=>String(x.id)===String(localId));
    if(s?.authUserId)return s.authUserId;
    if(!cloudReady()||!s)return null;
    const c=cloud();
    let q=c.state.client.from('core_students').select('auth_user_id').eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);
    else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();
    if(error)throw error;
    return data?.auth_user_id||null;
  }

  async function pullCloud(){
    if(!cloudReady())return read();
    const c=cloud();
    const {data,error}=await c.state.client.from('leave_requests').select('*').eq('institution_id',cfg().institutionId).order('created_at',{ascending:false});
    if(error)throw error;
    const local=students(),byAuth=new Map(local.filter(s=>s.authUserId).map(s=>[s.authUserId,s]));
    const mapped=(data||[]).map(x=>{
      const ls=x.student_user_id?byAuth.get(x.student_user_id):null;
      const leaveFor=x.leave_for||'student';
      return {
        id:x.id,
        cloudSynced:true,
        leaveFor,
        studentLocalId:ls?.id||x.local_student_id||'',
        studentUserId:x.student_user_id||null,
        studentName:ls?.name||x.student_name||'',
        personName:leaveFor==='staff'?(x.requester_name||'Teacher'):(ls?.name||x.student_name||'Student'),
        className:ls?.className||x.class_name||'',
        fromDate:x.from_date,toDate:x.to_date,reason:x.reason,status:x.status,
        decisionNote:x.decision_note||'',submittedBy:x.submitted_by||'',
        submittedIdentity:'',submittedRole:x.requester_role||'',createdAt:x.created_at,
        decidedAt:x.decided_at||'',decidedBy:x.decided_by||''
      };
    });
    const unsynced=read().filter(x=>x.cloudSynced===false);
    const merged=[...mapped,...unsynced.filter(x=>!mapped.some(y=>String(y.id)===String(x.id)))];
    write(merged);return merged;
  }

  async function insertCloud(item){
    if(!cloudReady())return null;
    const c=cloud(),requesterName=await currentProfileName();
    let studentUserId=null;
    if(item.leaveFor==='student'){
      studentUserId=await cloudStudentAuthId(item.studentLocalId);
      if(!studentUserId)throw new Error('Student cloud account/link required before leave submission.');
    }
    const payload={
      institution_id:cfg().institutionId,
      leave_for:item.leaveFor,
      student_user_id:studentUserId,
      local_student_id:item.leaveFor==='student'?(Number(item.studentLocalId)||null):null,
      student_name:item.leaveFor==='student'?item.studentName:null,
      class_name:item.leaveFor==='student'?(item.className||null):null,
      submitted_by:c.state.user.id,
      requester_role:role(),
      requester_name:requesterName,
      from_date:item.fromDate,to_date:item.toDate,reason:item.reason,status:'Pending'
    };
    const {data,error}=await c.state.client.from('leave_requests').insert(payload).select().single();
    if(error)throw error;return data;
  }

  async function decideCloud(id,status,note){
    if(!cloudReady())return null;
    const c=cloud();
    const {data,error}=await c.state.client.rpc('decide_leave_request_v1',{
      p_request_id:id,
      p_status:status,
      p_decision_note:note
    });
    if(error)throw error;
    return Array.isArray(data)?data[0]:data;
  }

  function renderForm(){
    if(!canSubmit())return '<div class="coverage-note">School Admin yahan leave requests approve/reject karta hai. Har decision ke sath reason/cause required hai.</div>';
    if(role()==='teacher'){
      return '<article class="card leave-request-form"><div class="section-head"><div><h3>My Leave Request</h3><p class="muted">Teacher leave final School Admin approval ke baad confirm hogi.</p></div></div><div class="form-grid">'+
        '<label>From Date<input id="leaveFrom" type="date" value="'+today()+'"></label>'+
        '<label>To Date<input id="leaveTo" type="date" value="'+today()+'"></label>'+
        '<label class="leave-reason-field">Reason<textarea id="leaveReason" rows="4" placeholder="e.g. illness, family emergency, personal work"></textarea></label>'+
        '<button id="submitLeave">Submit Leave Request</button></div></article>';
    }
    const list=eligibleSubmitStudents();
    if(!list.length)return '<div class="empty-state">Aap ke login se koi approved linked student record nahi mila. School Admin se student link verify karwayen.</div>';
    return '<article class="card leave-request-form"><div class="section-head"><div><h3>New Student Leave Request</h3><p class="muted">Reason aur dates complete karein. Final decision School Admin karega.</p></div></div><div class="form-grid">'+
      '<label>Student<select id="leaveStudent">'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(studentLabel(s))+'</option>').join('')+'</select></label>'+
      '<label>From Date<input id="leaveFrom" type="date" value="'+today()+'"></label>'+
      '<label>To Date<input id="leaveTo" type="date" value="'+today()+'"></label>'+
      '<label class="leave-reason-field">Leave Reason<textarea id="leaveReason" rows="4" placeholder="Reason for leave"></textarea></label>'+
      '<button id="submitLeave">Submit Request</button></div></article>';
  }

  function decisionLabel(x){
    if(x.status==='Approved')return 'Approval reason';
    if(x.status==='Rejected')return 'Rejection cause';
    return 'Admin decision';
  }

  function card(x){
    const admin=isAdmin(),staffLeave=x.leaveFor==='staff';
    const badge=staffLeave?'Teacher Leave':('Class '+esc(x.className||'-'));
    const name=esc(x.personName||x.studentName||(staffLeave?'Teacher':'Student'));
    const pendingNote=x.status==='Pending'
      ?'<div class="coverage-note"><strong>Status:</strong> Waiting for School Admin approval.</div>'
      :'';
    const decision=x.decisionNote
      ?'<div class="leave-decision-result '+(x.status==='Rejected'?'rejected':'approved')+'"><strong>'+decisionLabel(x)+':</strong> '+esc(x.decisionNote)+(x.decidedAt?'<small>Decision: '+esc(new Date(x.decidedAt).toLocaleString())+'</small>':'')+'</div>'
      :'';
    const controls=admin&&x.status==='Pending'
      ?'<div class="leave-admin-decision"><label>Admin decision reason / cause <span class="coverage-note">(Required)</span><textarea rows="3" data-leave-decision-note="'+esc(x.id)+'" placeholder="Approval reason ya rejection cause likhein"></textarea></label><div class="paper-actions"><button data-leave-approve="'+esc(x.id)+'">Approve</button><button class="secondary leave-reject-btn" data-leave-reject="'+esc(x.id)+'">Reject</button></div></div>'
      :'';
    return '<article class="paper-card leave-request-card">'+
      '<div class="paper-card-top"><span class="mini-badge">'+badge+'</span><span id="profileRiskBadge" data-risk="'+statusClass(x.status)+'">'+esc(x.status)+'</span></div>'+
      '<h3>'+name+'</h3>'+
      '<p class="muted">'+esc(x.fromDate)+' → '+esc(x.toDate)+' · Submitted by '+esc((x.submittedRole||'user').replace(/^./,m=>m.toUpperCase()))+'</p>'+
      '<div class="leave-request-reason"><strong>Leave reason:</strong><p>'+esc(x.reason||'')+'</p></div>'+
      pendingNote+decision+
      (x.cloudSynced===false?'<div class="coverage-note"><strong>Local only:</strong> Cloud sync nahi hui; is device par record saved hai.</div>':'')+
      controls+'</article>';
  }

  async function submit(){
    const from=$('leaveFrom')?.value,to=$('leaveTo')?.value,reason=$('leaveReason')?.value.trim();
    if(!from||!to||!reason)return alert('Dates aur leave reason complete karein.');
    if(reason.length<3)return alert('Leave reason thora detail mein likhein.');
    if(to<from)return alert('To date, From date se pehle nahi ho sakti.');
    let item;
    if(role()==='teacher'){
      item={id:String(Date.now()),cloudSynced:false,leaveFor:'staff',studentLocalId:'',studentUserId:null,studentName:'',personName:identity()||'Teacher',className:'',fromDate:from,toDate:to,reason,status:'Pending',decisionNote:'',submittedBy:identity(),submittedIdentity:identity(),submittedRole:'teacher',createdAt:new Date().toISOString()};
    }else{
      const sid=$('leaveStudent')?.value;
      if(!sid)return alert('Student select karein.');
      const s=students().find(x=>String(x.id)===String(sid));if(!s)return alert('Student record not found.');
      item={id:String(Date.now()),cloudSynced:false,leaveFor:'student',studentLocalId:s.id,studentUserId:s.authUserId||null,studentName:s.name,personName:s.name,className:s.className||'',fromDate:from,toDate:to,reason,status:'Pending',decisionNote:'',submittedBy:identity(),submittedIdentity:identity(),submittedRole:role(),createdAt:new Date().toISOString()};
    }
    try{
      const row=await insertCloud(item);
      if(row){
        item.id=row.id;item.cloudSynced=true;item.studentUserId=row.student_user_id||null;item.submittedBy=row.submitted_by;item.personName=row.leave_for==='staff'?(row.requester_name||item.personName):(row.student_name||item.personName);item.createdAt=row.created_at;
      }
    }catch(e){
      alert('Cloud submit unavailable; request sirf is device ke Local Mode mein save hogi. '+(e.message||e));
    }
    const arr=read();arr.unshift(item);write(arr);
    if($('leaveReason'))$('leaveReason').value='';
    render(true);
  }

  async function notifyDecision(item,status,note,result){
    if(!window.EDUNIZAM_CLOUD?.sendNotification||!cloudReady())return;
    const recipients=new Set([result?.student_user_id,item.studentUserId,result?.submitted_by,item.submittedBy].filter(Boolean));
    recipients.delete(currentUserId());
    const title='Leave request '+status.toLowerCase();
    const body=(item.fromDate+' to '+item.toDate+' · '+(status==='Approved'?'Approval reason: ':'Rejection cause: ')+note);
    for(const userId of recipients){
      try{await window.EDUNIZAM_CLOUD.sendNotification(userId,title,body,'leave')}catch(_){}
    }
  }

  async function decide(id,status){
    const arr=read(),item=arr.find(x=>String(x.id)===String(id));if(!item||!isAdmin())return;
    const noteEl=document.querySelector('[data-leave-decision-note="'+String(id)+'"]');
    const note=String(noteEl?.value||'').trim();
    if(!note)return alert((status==='Approved'?'Approval reason':'Rejection cause')+' required hai.');
    const buttons=[...document.querySelectorAll('[data-leave-approve="'+String(id)+'"],[data-leave-reject="'+String(id)+'"]')];
    buttons.forEach(b=>b.disabled=true);
    try{
      let result=null;
      if(item.cloudSynced&&cloudReady())result=await decideCloud(id,status,note);
      item.status=status;item.decisionNote=note;item.decidedAt=new Date().toISOString();item.decidedBy=currentUserId()||identity();write(arr);
      await notifyDecision(item,status,note,result);
      if(item.cloudSynced&&cloudReady()){
        const root=$('leaveCenterApp');if(root)delete root.dataset.cloudLoaded;
      }
      await render(true);
    }catch(e){
      alert('Leave decision failed: '+(e.message||e));
      buttons.forEach(b=>b.disabled=false);
    }
  }

  function bind(){
    if($('submitLeave'))$('submitLeave').onclick=submit;
    document.querySelectorAll('[data-leave-approve]').forEach(b=>b.onclick=()=>decide(b.dataset.leaveApprove,'Approved'));
    document.querySelectorAll('[data-leave-reject]').forEach(b=>b.onclick=()=>decide(b.dataset.leaveReject,'Rejected'));
  }

  function summary(arr){
    const pending=arr.filter(x=>x.status==='Pending').length,approved=arr.filter(x=>x.status==='Approved').length,rejected=arr.filter(x=>x.status==='Rejected').length;
    return '<div class="leave-summary"><div><span>Pending</span><strong>'+pending+'</strong></div><div><span>Approved</span><strong>'+approved+'</strong></div><div><span>Rejected</span><strong>'+rejected+'</strong></div></div>';
  }

  async function render(forceCloud=false){
    const root=$('leaveCenterApp');if(!root)return;
    let arr=read();
    if(cloudReady()&&(forceCloud||!root.dataset.cloudLoaded)){
      root.dataset.cloudLoaded='1';
      try{arr=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Leave cloud sync:',e.message)}
    }
    arr=arr.filter(localVisibleRequest).sort((a,b)=>{
      const rank={Pending:0,Approved:1,Rejected:2};
      return (rank[a.status]??9)-(rank[b.status]??9)||new Date(b.createdAt||0)-new Date(a.createdAt||0);
    });
    root.innerHTML='<div class="section-head"><div><h2>Leave Requests</h2><p class="muted">'+(isAdmin()?'Approve/reject with compulsory reason. Teachers can view assigned student requests but cannot make the final decision.':'Submit leave with reason and track the School Admin decision.')+'</p></div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      summary(arr)+renderForm()+
      '<div class="paper-grid leave-request-grid" style="margin-top:16px">'+(arr.length?arr.map(card).join(''):'<div class="empty-state">Abhi koi relevant leave request nahi hai.</div>')+'</div>';
    bind();
  }

  window.addEventListener('edunizam:auth',()=>{const root=$('leaveCenterApp');if(root)delete root.dataset.cloudLoaded;render(true)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render(true)});
  setTimeout(render,0);setTimeout(render,700);
  window.EDUNIZAM_LEAVE_CENTER={render,read,pullCloud,cloudReady};
})();