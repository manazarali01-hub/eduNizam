(function(){
  const KEY='edunizam_leave_requests_v3';
  const LEGACY_KEYS=['edunizam_leave_requests_v2','edunizam_leave_requests_v1'];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]||c));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const identity=()=>String(session()?.identity||'');
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const currentUserId=()=>cloud()?.state?.user?.id||'';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const daysBetween=(from,to)=>{
    if(!from||!to)return 0;
    const a=new Date(from+'T00:00:00'),b=new Date(to+'T00:00:00');
    const n=Math.floor((b-a)/86400000)+1;
    return Number.isFinite(n)&&n>0?n:0;
  };
  function read(){
    try{
      const current=JSON.parse(localStorage.getItem(KEY)||'null');
      if(Array.isArray(current))return current;
      for(const k of LEGACY_KEYS){
        const legacy=JSON.parse(localStorage.getItem(k)||'null');
        if(Array.isArray(legacy)){write(legacy);return legacy}
      }
    }catch(_){}
    return[];
  }
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function isAdmin(){return role()==='head'}
  function isTeacher(){return role()==='teacher'}
  function canSubmit(){return ['student','parent','teacher'].includes(role())}
  function studentLabel(s){return [s.name,s.className&&('Class '+s.className),s.sectionName&&('Section '+s.sectionName),s.admissionNo&&('Adm '+s.admissionNo)].filter(Boolean).join(' · ')}
  function localVisibleRequest(r){
    if(isAdmin())return true;
    if(isTeacher()&&r.leaveFor==='staff')return String(r.submittedBy||'')===String(currentUserId()||identity())||String(r.submittedIdentity||'')===identity();
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
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
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
      const ls=x.student_user_id?byAuth.get(x.student_user_id):null,leaveFor=x.leave_for||'student';
      return {
        id:x.id,cloudSynced:true,leaveFor,
        studentLocalId:ls?.id||x.local_student_id||'',studentUserId:x.student_user_id||null,
        studentName:ls?.name||x.student_name||'',personName:leaveFor==='staff'?(x.requester_name||'Teacher'):(ls?.name||x.student_name||'Student'),
        className:ls?.className||x.class_name||'',sectionName:ls?.sectionName||x.section_name||'',
        fromDate:x.from_date,toDate:x.to_date,numberOfDays:x.number_of_days||daysBetween(x.from_date,x.to_date),
        reason:x.reason,guardianNote:x.guardian_note||'',status:x.status,
        teacherResponse:x.teacher_response||'',teacherNote:x.teacher_note||'',teacherReviewedBy:x.teacher_reviewed_by||'',teacherReviewedAt:x.teacher_reviewed_at||'',
        attachmentPath:x.attachment_path||'',attachmentName:x.attachment_name||'',attachmentType:x.attachment_type||'',
        decisionNote:x.decision_note||'',submittedBy:x.submitted_by||'',submittedIdentity:'',submittedRole:x.requester_role||'',createdAt:x.created_at,
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
      institution_id:cfg().institutionId,leave_for:item.leaveFor,student_user_id:studentUserId,
      local_student_id:item.leaveFor==='student'?(Number(item.studentLocalId)||null):null,
      student_name:item.leaveFor==='student'?item.studentName:null,
      class_name:item.leaveFor==='student'?(item.className||null):null,
      section_name:item.leaveFor==='student'?(item.sectionName||null):null,
      submitted_by:c.state.user.id,requester_role:role(),requester_name:requesterName,
      from_date:item.fromDate,to_date:item.toDate,number_of_days:item.numberOfDays,
      reason:item.reason,guardian_note:item.guardianNote||null,status:'Pending'
    };
    const {data,error}=await c.state.client.from('leave_requests').insert(payload).select().single();
    if(error)throw error;return data;
  }

  async function reviewCloud(id,response,note){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.rpc('review_leave_request_v2',{p_request_id:id,p_response:response,p_note:note});
    if(error)throw error;return data;
  }
  async function decideCloud(id,status,note){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.rpc('decide_leave_request_v1',{p_request_id:id,p_status:status,p_decision_note:note});
    if(error)throw error;return Array.isArray(data)?data[0]:data;
  }

  function validateAttachment(file){
    if(!file)return;
    const allowed=['image/jpeg','image/png','image/webp','application/pdf'];
    if(!allowed.includes(file.type))throw new Error('Attachment must be JPG, PNG, WEBP or PDF.');
    if(file.size>5*1024*1024)throw new Error('Attachment must be 5 MB or smaller.');
  }
  function safeFileName(name){
    return String(name||'attachment').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-100)||'attachment';
  }
  async function uploadLeaveAttachment(requestId,file){
    if(!file)return null;
    validateAttachment(file);
    if(!cloudReady())throw new Error('Cloud Mode is required for leave attachments.');
    const uid=currentUserId();
    if(!uid)throw new Error('Sign in again before uploading the attachment.');
    const path=cfg().institutionId+'/'+requestId+'/'+uid+'/'+Date.now()+'-'+safeFileName(file.name);
    const client=cloud().state.client;
    const {error:uploadError}=await client.storage.from('leave-request-files').upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError)throw uploadError;
    try{
      const {data,error}=await client.rpc('attach_leave_file_v1',{
        p_request_id:requestId,p_storage_path:path,p_name:file.name,p_type:file.type
      });
      if(error)throw error;
      return Array.isArray(data)?data[0]:data;
    }catch(e){
      client.storage.from('leave-request-files').remove([path]).catch(()=>{});
      throw e;
    }
  }
  async function openAttachment(id){
    const item=read().find(x=>String(x.id)===String(id));
    if(!item?.attachmentPath)return;
    if(!cloudReady())return alert('Attachment open karne ke liye Cloud Mode / sign-in required hai.');
    try{
      const {data,error}=await cloud().state.client.storage.from('leave-request-files').createSignedUrl(item.attachmentPath,600);
      if(error)throw error;
      if(!data?.signedUrl)throw new Error('Signed attachment link unavailable.');
      window.open(data.signedUrl,'_blank','noopener');
    }catch(e){alert('Attachment open nahi ho saka: '+(e.message||e))}
  }

  function renderDaysHelp(){
    const from=$('leaveFrom')?.value,to=$('leaveTo')?.value,n=daysBetween(from,to),el=$('leaveDays');
    if(el)el.value=n||'';
  }
  function renderForm(){
    if(!canSubmit())return '<div class="coverage-note">School Admin yahan leave requests ka final approve/reject decision karta hai.</div>';
    if(isTeacher()){
      return '<article class="card leave-request-form"><div class="section-head"><div><h3>My Leave Request</h3><p class="muted">Teacher leave final School Admin approval ke baad confirm hogi.</p></div></div><div class="form-grid">'+
        '<label>From Date<input id="leaveFrom" type="date" value="'+today()+'"></label>'+
        '<label>To Date<input id="leaveTo" type="date" value="'+today()+'"></label>'+
        '<label>Number of Days<input id="leaveDays" type="number" min="1" value="1" readonly></label>'+
        '<label class="leave-reason-field">Cause / Reason<textarea id="leaveReason" rows="4" placeholder="e.g. illness, family emergency, personal work"></textarea></label>'+
        '<label class="leave-reason-field">Additional Note <span class="muted">(Optional)</span><textarea id="leaveGuardianNote" rows="2" placeholder="Any additional detail"></textarea></label>'+
        '<label class="leave-reason-field">Medical / Supporting Document <span class="muted">(Optional)</span><input id="leaveAttachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small class="muted">JPG, PNG, WEBP or PDF · max 5 MB · private cloud file</small></label>'+
        '<button id="submitLeave">Submit Leave Request</button></div></article>';
    }
    const list=eligibleSubmitStudents();
    if(!list.length)return '<div class="empty-state">Aap ke login se koi approved linked student record nahi mila. School Admin se student link verify karwayen.</div>';
    return '<article class="card leave-request-form"><div class="section-head"><div><h3>New Student Leave Request</h3><p class="muted">Student leave relevant Teacher ko review ke liye aur School Admin ko final decision ke liye nazar ayegi.</p></div></div><div class="form-grid">'+
      '<label>Student<select id="leaveStudent">'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(studentLabel(s))+'</option>').join('')+'</select></label>'+
      '<label>From Date<input id="leaveFrom" type="date" value="'+today()+'"></label>'+
      '<label>To Date<input id="leaveTo" type="date" value="'+today()+'"></label>'+
      '<label>Number of Days<input id="leaveDays" type="number" min="1" value="1" readonly></label>'+
      '<label class="leave-reason-field">Cause of Leave<textarea id="leaveReason" rows="4" placeholder="Reason for leave"></textarea></label>'+
      '<label class="leave-reason-field">Parent / Guardian Note <span class="muted">(Optional)</span><textarea id="leaveGuardianNote" rows="2" placeholder="Optional parent/guardian note"></textarea></label>'+
      '<label class="leave-reason-field">Medical / Supporting Document <span class="muted">(Optional)</span><input id="leaveAttachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><small class="muted">JPG, PNG, WEBP or PDF · max 5 MB · private cloud file</small></label>'+
      '<button id="submitLeave">Submit Request</button></div></article>';
  }

  function decisionLabel(x){return x.status==='Approved'?'Approval reason':x.status==='Rejected'?'Rejection cause':'Admin decision'}
  function teacherReviewBlock(x){
    if(x.leaveFor!=='student')return '';
    if(x.teacherResponse){
      const good=x.teacherResponse==='Approved'||x.teacherResponse==='Recommend Approval';
      return '<div class="leave-decision-result '+(good?'approved':'rejected')+'"><strong>Teacher review:</strong> '+esc(x.teacherResponse)+(x.teacherNote?' — '+esc(x.teacherNote):'')+(x.teacherReviewedAt?'<small>Reviewed: '+esc(new Date(x.teacherReviewedAt).toLocaleString())+'</small>':'')+'</div>';
    }
    if(isTeacher()&&x.status==='Pending'){
      return '<div class="leave-admin-decision"><label>Teacher review note <span class="muted">(Required)</span><textarea rows="3" data-leave-teacher-note="'+esc(x.id)+'" placeholder="Reason for recommendation"></textarea></label><div class="paper-actions"><button data-leave-teacher-approve="'+esc(x.id)+'">Recommend Approval</button><button class="secondary leave-reject-btn" data-leave-teacher-reject="'+esc(x.id)+'">Recommend Rejection</button></div><small class="muted">School Admin remains the final decision maker.</small></div>';
    }
    return '';
  }
  function card(x){
    const staffLeave=x.leaveFor==='staff',badge=staffLeave?'Teacher Leave':('Class '+esc(x.className||'-')+(x.sectionName?' · '+esc(x.sectionName):'')),name=esc(x.personName||x.studentName||(staffLeave?'Teacher':'Student'));
    const pendingNote=x.status==='Pending'?'<div class="coverage-note"><strong>Status:</strong> '+(x.teacherResponse?'Teacher reviewed · waiting for School Admin final decision.':'Waiting for review / School Admin decision.')+'</div>':'';
    const decision=x.decisionNote?'<div class="leave-decision-result '+(x.status==='Rejected'?'rejected':'approved')+'"><strong>'+decisionLabel(x)+':</strong> '+esc(x.decisionNote)+(x.decidedAt?'<small>Final decision: '+esc(new Date(x.decidedAt).toLocaleString())+'</small>':'')+'</div>':'';
    const controls=isAdmin()&&x.status==='Pending'?'<div class="leave-admin-decision"><label>Admin final decision reason / cause <span class="coverage-note">(Required)</span><textarea rows="3" data-leave-decision-note="'+esc(x.id)+'" placeholder="Approval reason ya rejection cause likhein"></textarea></label><div class="paper-actions"><button data-leave-approve="'+esc(x.id)+'">Final Approve</button><button class="secondary leave-reject-btn" data-leave-reject="'+esc(x.id)+'">Final Reject</button></div></div>':'';
    return '<article class="paper-card leave-request-card">'+
      '<div class="paper-card-top"><span class="mini-badge">'+badge+'</span><span data-risk="'+statusClass(x.status)+'">'+esc(x.status)+'</span></div>'+
      '<h3>'+name+'</h3><p class="muted">'+esc(x.fromDate)+' → '+esc(x.toDate)+' · '+esc(x.numberOfDays||daysBetween(x.fromDate,x.toDate))+' day(s) · Submitted by '+esc((x.submittedRole||'user').replace(/^./,m=>m.toUpperCase()))+'</p>'+
      '<div class="leave-request-reason"><strong>Cause of leave:</strong><p>'+esc(x.reason||'')+'</p></div>'+
      (x.guardianNote?'<div class="coverage-note"><strong>Additional / guardian note:</strong> '+esc(x.guardianNote)+'</div>':'')+
      (x.attachmentPath?'<div class="paper-actions"><button class="secondary" data-leave-attachment="'+esc(x.id)+'">Open '+esc(x.attachmentName||'Attachment')+'</button></div>':'')+
      pendingNote+teacherReviewBlock(x)+decision+
      (x.cloudSynced===false?'<div class="coverage-note"><strong>Local only:</strong> Cloud sync nahi hui; is device par record saved hai.</div>':'')+controls+'</article>';
  }

  async function submit(){
    const from=$('leaveFrom')?.value,to=$('leaveTo')?.value,reason=$('leaveReason')?.value.trim(),guardianNote=$('leaveGuardianNote')?.value.trim()||'',numberOfDays=daysBetween(from,to);
    const attachmentFile=$('leaveAttachment')?.files?.[0]||null;
    try{validateAttachment(attachmentFile)}catch(e){return alert(e.message||e)}
    if(!from||!to||!reason)return alert('Dates aur leave reason complete karein.');
    if(reason.length<3)return alert('Leave reason thora detail mein likhein.');
    if(!numberOfDays)return alert('To date, From date se pehle nahi ho sakti.');
    let item;
    if(isTeacher()){
      item={id:String(Date.now()),cloudSynced:false,leaveFor:'staff',studentLocalId:'',studentUserId:null,studentName:'',personName:identity()||'Teacher',className:'',sectionName:'',fromDate:from,toDate:to,numberOfDays,reason,guardianNote,status:'Pending',teacherResponse:'',teacherNote:'',decisionNote:'',submittedBy:identity(),submittedIdentity:identity(),submittedRole:'teacher',createdAt:new Date().toISOString()};
    }else{
      const sid=$('leaveStudent')?.value;if(!sid)return alert('Student select karein.');
      const s=students().find(x=>String(x.id)===String(sid));if(!s)return alert('Student record not found.');
      item={id:String(Date.now()),cloudSynced:false,leaveFor:'student',studentLocalId:s.id,studentUserId:s.authUserId||null,studentName:s.name,personName:s.name,className:s.className||'',sectionName:s.sectionName||'',fromDate:from,toDate:to,numberOfDays,reason,guardianNote,status:'Pending',teacherResponse:'',teacherNote:'',decisionNote:'',submittedBy:identity(),submittedIdentity:identity(),submittedRole:role(),createdAt:new Date().toISOString()};
    }
    const btn=$('submitLeave');if(btn)btn.disabled=true;
    try{
      const row=await insertCloud(item);
      if(row){
        item.id=row.id;item.cloudSynced=true;item.studentUserId=row.student_user_id||null;item.submittedBy=row.submitted_by;item.personName=row.leave_for==='staff'?(row.requester_name||item.personName):(row.student_name||item.personName);item.createdAt=row.created_at;
        try{await cloud().state.client.rpc('notify_leave_submission_v1',{p_request_id:row.id})}catch(e){console.warn('Leave submission notification:',e.message||e)}
        if(attachmentFile){
          try{
            const attached=await uploadLeaveAttachment(row.id,attachmentFile);
            item.attachmentPath=attached?.attachment_path||'';
            item.attachmentName=attached?.attachment_name||attachmentFile.name;
            item.attachmentType=attached?.attachment_type||attachmentFile.type;
          }catch(fileError){
            alert('Leave request submit ho gayi, lekin attachment upload nahi ho saka: '+(fileError.message||fileError));
          }
        }
      }else if(attachmentFile){
        alert('Leave request Local Mode mein save ho gi; attachment ke liye Cloud Mode / sign-in required hai.');
      }
    }catch(e){alert('Cloud submit unavailable; request sirf is device ke Local Mode mein save hogi. '+(e.message||e))}
    finally{if(btn)btn.disabled=false}
    const arr=read();arr.unshift(item);write(arr);
    if($('leaveReason'))$('leaveReason').value='';if($('leaveGuardianNote'))$('leaveGuardianNote').value='';if($('leaveAttachment'))$('leaveAttachment').value='';
    render(true);
  }

  async function sendNotification(userId,title,body){
    if(!userId||!window.EDUNIZAM_CLOUD?.sendNotification||!cloudReady())return;
    try{await window.EDUNIZAM_CLOUD.sendNotification(userId,title,body,'leave')}catch(_){}
  }
  async function reviewTeacher(id,response){
    const arr=read(),item=arr.find(x=>String(x.id)===String(id));if(!item||!isTeacher()||item.status!=='Pending')return;
    const note=String(document.querySelector('[data-leave-teacher-note="'+String(id)+'"]')?.value||'').trim();
    if(!note)return alert('Teacher review reason required hai.');
    const buttons=[...document.querySelectorAll('[data-leave-teacher-approve="'+String(id)+'"],[data-leave-teacher-reject="'+String(id)+'"]')];buttons.forEach(b=>b.disabled=true);
    try{
      if(item.cloudSynced&&cloudReady())await reviewCloud(id,response,note);
      item.teacherResponse=response;item.teacherNote=note;item.teacherReviewedAt=new Date().toISOString();item.teacherReviewedBy=currentUserId()||identity();write(arr);
      const recipients=new Set([item.studentUserId,item.submittedBy].filter(Boolean));recipients.delete(currentUserId());
      for(const uid of recipients)await sendNotification(uid,'Leave request reviewed by teacher',response+' · '+note);
      if(item.cloudSynced&&cloudReady()){const root=$('leaveCenterApp');if(root)delete root.dataset.cloudLoaded}
      await render(true);
    }catch(e){alert('Teacher review failed: '+(e.message||e));buttons.forEach(b=>b.disabled=false)}
  }
  async function decide(id,status){
    const arr=read(),item=arr.find(x=>String(x.id)===String(id));if(!item||!isAdmin())return;
    const note=String(document.querySelector('[data-leave-decision-note="'+String(id)+'"]')?.value||'').trim();
    if(!note)return alert((status==='Approved'?'Approval reason':'Rejection cause')+' required hai.');
    const buttons=[...document.querySelectorAll('[data-leave-approve="'+String(id)+'"],[data-leave-reject="'+String(id)+'"]')];buttons.forEach(b=>b.disabled=true);
    try{
      let result=null;if(item.cloudSynced&&cloudReady())result=await decideCloud(id,status,note);
      item.status=status;item.decisionNote=note;item.decidedAt=new Date().toISOString();item.decidedBy=currentUserId()||identity();write(arr);
      const recipients=new Set([result?.student_user_id,item.studentUserId,result?.submitted_by,item.submittedBy].filter(Boolean));recipients.delete(currentUserId());
      for(const uid of recipients)await sendNotification(uid,'Leave request '+status.toLowerCase(),item.fromDate+' to '+item.toDate+' · '+note);
      if(item.cloudSynced&&cloudReady()){const root=$('leaveCenterApp');if(root)delete root.dataset.cloudLoaded}
      await render(true);
    }catch(e){alert('Leave decision failed: '+(e.message||e));buttons.forEach(b=>b.disabled=false)}
  }

  function bind(root){
    if($('submitLeave'))$('submitLeave').onclick=submit;
    $('leaveFrom')?.addEventListener('change',renderDaysHelp);$('leaveTo')?.addEventListener('change',renderDaysHelp);
    $('leaveFilterStatus')?.addEventListener('change',e=>{root.dataset.leaveStatus=e.target.value;render()});
    $('leaveFilterType')?.addEventListener('change',e=>{root.dataset.leaveType=e.target.value;render()});
    $('leaveFilterReview')?.addEventListener('change',e=>{root.dataset.leaveReview=e.target.value;render()});
    $('leaveSearch')?.addEventListener('input',e=>{root.dataset.leaveSearch=e.target.value;clearTimeout(bind.timer);bind.timer=setTimeout(render,160)});
    $('leaveClearFilters')?.addEventListener('click',()=>{root.dataset.leaveStatus='';root.dataset.leaveType='';root.dataset.leaveReview='';root.dataset.leaveSearch='';render()});
    document.querySelectorAll('[data-leave-teacher-approve]').forEach(b=>b.onclick=()=>reviewTeacher(b.dataset.leaveTeacherApprove,'Recommend Approval'));
    document.querySelectorAll('[data-leave-teacher-reject]').forEach(b=>b.onclick=()=>reviewTeacher(b.dataset.leaveTeacherReject,'Recommend Rejection'));
    document.querySelectorAll('[data-leave-approve]').forEach(b=>b.onclick=()=>decide(b.dataset.leaveApprove,'Approved'));
    document.querySelectorAll('[data-leave-reject]').forEach(b=>b.onclick=()=>decide(b.dataset.leaveReject,'Rejected'));
    document.querySelectorAll('[data-leave-attachment]').forEach(b=>b.onclick=()=>openAttachment(b.dataset.leaveAttachment));
  }
  function filterRequests(arr,root){
    const status=root.dataset.leaveStatus||'',type=root.dataset.leaveType||'',review=root.dataset.leaveReview||'',q=(root.dataset.leaveSearch||'').trim().toLowerCase();
    return arr.filter(x=>{
      if(status&&x.status!==status)return false;
      if(type&&x.leaveFor!==type)return false;
      if(review==='reviewed'&&!x.teacherResponse)return false;
      if(review==='unreviewed'&&(x.teacherResponse||x.leaveFor!=='student'))return false;
      if(q&&!([x.personName,x.studentName,x.className,x.sectionName,x.reason,x.guardianNote,x.decisionNote,x.teacherNote,x.submittedRole].join(' ').toLowerCase().includes(q)))return false;
      return true;
    });
  }
  function summary(arr){
    const pending=arr.filter(x=>x.status==='Pending').length,reviewed=arr.filter(x=>x.status==='Pending'&&x.teacherResponse).length,approved=arr.filter(x=>x.status==='Approved').length,rejected=arr.filter(x=>x.status==='Rejected').length;
    return '<div class="leave-summary"><div><span>Pending</span><strong>'+pending+'</strong></div><div><span>Teacher Reviewed</span><strong>'+reviewed+'</strong></div><div><span>Approved</span><strong>'+approved+'</strong></div><div><span>Rejected</span><strong>'+rejected+'</strong></div></div>';
  }
  async function render(forceCloud=false){
    const root=$('leaveCenterApp');if(!root)return;let arr=read();
    if(cloudReady()&&(forceCloud||!root.dataset.cloudLoaded)){root.dataset.cloudLoaded='1';try{arr=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Leave cloud sync:',e.message)}}
    arr=arr.filter(localVisibleRequest).sort((a,b)=>{const rank={Pending:0,Approved:1,Rejected:2};return(rank[a.status]??9)-(rank[b.status]??9)||new Date(b.createdAt||0)-new Date(a.createdAt||0)});
    const filtered=filterRequests(arr,root);
    const roleText=isAdmin()?'Teacher review is visible; Admin gives the final approve/reject decision with a reason.':isTeacher()?'Submit your own leave or review leave for assigned students. Admin gives the final institutional decision.':'Submit leave with dates, number of days and cause; track Teacher review and Admin final decision.';
    root.innerHTML='<div class="section-head"><div><h2>Leave Requests</h2><p class="muted">'+roleText+'</p></div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+summary(arr)+renderForm()+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Leave History & Queue</h3><p class="muted">'+filtered.length+' of '+arr.length+' relevant requests shown.</p></div><button id="leaveClearFilters" class="secondary">Clear Filters</button></div><div class="form-grid"><select id="leaveFilterStatus"><option value="">All Status</option>'+['Pending','Approved','Rejected'].map(v=>'<option value="'+v+'" '+((root.dataset.leaveStatus||'')===v?'selected':'')+'>'+v+'</option>').join('')+'</select><select id="leaveFilterType"><option value="">All Request Types</option><option value="student" '+((root.dataset.leaveType||'')==='student'?'selected':'')+'>Student Leave</option><option value="staff" '+((root.dataset.leaveType||'')==='staff'?'selected':'')+'>Teacher Leave</option></select><select id="leaveFilterReview"><option value="">All Teacher Review States</option><option value="reviewed" '+((root.dataset.leaveReview||'')==='reviewed'?'selected':'')+'>Teacher Reviewed</option><option value="unreviewed" '+((root.dataset.leaveReview||'')==='unreviewed'?'selected':'')+'>Awaiting Teacher Review</option></select><input id="leaveSearch" type="search" value="'+esc(root.dataset.leaveSearch||'')+'" placeholder="Search name, class, reason or decision"></div></article>'+
      '<div class="paper-grid leave-request-grid" style="margin-top:16px">'+(filtered.length?filtered.map(card).join(''):'<div class="empty-state">No leave request matches these filters.</div>')+'</div>';
    bind(root);renderDaysHelp();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('leaveCenterApp');if(root)delete root.dataset.cloudLoaded;render(true)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render(true)});
  setTimeout(render,0);setTimeout(render,700);
  window.EDUNIZAM_LEAVE_CENTER={render,read,pullCloud,cloudReady};
})();