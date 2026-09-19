(function(){
  const KEY='edunizam_parent_complaints_v1';
  const MAX_FILES=3;
  const MAX_BYTES=25*1024*1024;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const bucket=()=>cfg().complaintStorageBucket||'parent-complaints';
  const isStaff=()=>['teacher','head'].includes(role());
  const isHead=()=>role()==='head';
  const isParent=()=>role()==='parent';
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function meKey(){return role()+':'+String(session()?.identity||'').toLowerCase()}
  function safeName(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-90)}
  function localVisible(rows){
    if(isHead())return rows;
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    if(isParent())return rows.filter(x=>ids.has(String(x.studentId)));
    return rows.filter(x=>ids.has(String(x.studentId))&&(x.creatorKey===meKey()||!x.creatorKey));
  }
  async function cloudStudent(localId){
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id').eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function mapComplaint(x){
    const s=x.core_students||{};
    return {id:x.id,studentId:String(s.local_id??x.student_id),studentName:s.name||'Student',className:s.class_name||'',sectionName:s.section_name||'',subject:x.subject,message:x.message,severity:x.severity,actionRequested:x.action_requested||'',status:x.status,acknowledgedAt:x.acknowledged_at||'',resolvedAt:x.resolved_at||'',createdBy:x.created_by||'',creatorKey:'',createdAt:x.created_at,attachments:[]};
  }
  async function signAttachment(a){
    const {data,error}=await cloud().state.client.storage.from(bucket()).createSignedUrl(a.storage_path,3600);
    return {id:a.id,fileName:a.file_name||'Attachment',mediaType:a.media_type,mimeType:a.mime_type||'',sizeBytes:Number(a.size_bytes||0),storagePath:a.storage_path,url:error?'':(data?.signedUrl||'')};
  }
  async function pullCloud(){
    const {data,error}=await cloud().state.client.from('student_parent_complaints')
      .select('*,core_students(local_id,name,class_name,section_name,auth_user_id),student_parent_complaint_attachments(*)')
      .eq('institution_id',cfg().institutionId).order('created_at',{ascending:false});
    if(error)throw error;
    const rows=[];
    for(const raw of (data||[])){
      const x=mapComplaint(raw);
      x.attachments=await Promise.all((raw.student_parent_complaint_attachments||[]).map(signAttachment));
      rows.push(x);
    }
    write(rows.map(x=>Object.assign({},x,{attachments:(x.attachments||[]).map(a=>({id:a.id,fileName:a.fileName,mediaType:a.mediaType,mimeType:a.mimeType,sizeBytes:a.sizeBytes,storagePath:a.storagePath,url:''}))})));
    return rows;
  }
  async function createCloud(item){
    const cs=await cloudStudent(item.studentId);if(!cs)throw new Error('Student cloud record not found.');
    const {data,error}=await cloud().state.client.rpc('create_student_parent_complaint',{
      p_student_id:cs.id,p_subject:item.subject,p_message:item.message,p_severity:item.severity,p_action_requested:item.actionRequested||null
    });
    if(error)throw error;return data;
  }
  async function uploadFiles(complaintId,files){
    const uploaded=[];
    for(const f of files){
      const kind=f.type.startsWith('image/')?'image':f.type.startsWith('video/')?'video':'';
      if(!kind)throw new Error('Only image or video files are allowed.');
      if(f.size>MAX_BYTES)throw new Error(f.name+' is larger than 25 MB.');
      const path=cfg().institutionId+'/'+complaintId+'/'+cloud().state.user.id+'/'+Date.now()+'-'+safeName(f.name);
      const {error:upErr}=await cloud().state.client.storage.from(bucket()).upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type});
      if(upErr)throw upErr;
      const {data:meta,error:metaErr}=await cloud().state.client.from('student_parent_complaint_attachments').insert({
        complaint_id:complaintId,storage_path:path,file_name:f.name,mime_type:f.type,size_bytes:f.size,media_type:kind,uploaded_by:cloud().state.user.id
      }).select().single();
      if(metaErr){
        await cloud().state.client.storage.from(bucket()).remove([path]);
        throw metaErr;
      }
      uploaded.push(meta);
    }
    return uploaded;
  }
  async function acknowledgeCloud(id){
    const {data,error}=await cloud().state.client.rpc('acknowledge_student_parent_complaint',{p_complaint_id:id});
    if(error)throw error;return data;
  }
  async function resolveCloud(id){
    const {data,error}=await cloud().state.client.rpc('resolve_student_parent_complaint',{p_complaint_id:id});
    if(error)throw error;return data;
  }
  function editor(){
    if(!isStaff())return '<div class="coverage-note">Parent view: school se bheji hui student complaint notices yahan nazar aayengi.</div>';
    const mediaNote=cloudReady()?'Up to 3 photos/videos, max 25 MB each.':'Photo/video upload Cloud Mode mein available hoga; Local Mode mein text complaint save ho sakti hai.';
    return '<article class="card"><h3>Send Student Complaint to Parent</h3><div class="form-grid">'+
      '<select id="pcStudent"><option value="">Select student</option>'+visibleStudents().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<select id="pcSeverity"><option>Concern</option><option>Serious</option><option>Information</option></select>'+
      '<input id="pcSubject" placeholder="Complaint subject">'+
      '<textarea id="pcMessage" rows="4" placeholder="Complaint details / message to parent"></textarea>'+
      '<input id="pcAction" placeholder="Requested parent action (optional)">'+
      '<input id="pcFiles" type="file" accept="image/*,video/*" multiple '+(cloudReady()?'':'disabled')+'>'+
      '<div class="muted">'+esc(mediaNote)+'</div>'+
      '<button id="pcSend">Send Complaint to Parent</button></div></article>';
  }
  function metrics(rows){
    const open=rows.filter(x=>x.status==='Open').length,ack=rows.filter(x=>x.acknowledgedAt).length,resolved=rows.filter(x=>x.status==='Resolved').length,media=rows.reduce((a,x)=>a+(x.attachments?.length||0),0);
    return '<div class="cards"><article class="card stat"><span>Open</span><strong>'+open+'</strong></article><article class="card stat"><span>Acknowledged</span><strong>'+ack+'</strong></article><article class="card stat"><span>Resolved</span><strong>'+resolved+'</strong></article><article class="card stat"><span>Media Files</span><strong>'+media+'</strong></article></div>';
  }
  function mediaHtml(a){
    if(!a.url)return '<div class="coverage-note">'+esc(a.fileName)+' · private media link unavailable until Cloud sync.</div>';
    if(a.mediaType==='image')return '<figure style="margin:8px 0"><img src="'+esc(a.url)+'" alt="'+esc(a.fileName)+'" style="max-width:100%;max-height:320px;border-radius:12px"><figcaption class="muted">'+esc(a.fileName)+'</figcaption></figure>';
    return '<figure style="margin:8px 0"><video src="'+esc(a.url)+'" controls preload="metadata" style="width:100%;max-height:360px;border-radius:12px"></video><figcaption class="muted">'+esc(a.fileName)+'</figcaption></figure>';
  }
  function card(x){
    const canAck=isParent()&&!x.acknowledgedAt;
    const canResolve=isHead()&&x.status!=='Resolved';
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.severity)+'</span><span class="badge">'+esc(x.status)+'</span></div>'+
      '<h3>'+esc(x.subject)+'</h3><p class="muted">'+esc(x.studentName)+' · '+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+' · '+new Date(x.createdAt).toLocaleString()+'</p>'+
      '<p>'+esc(x.message)+'</p>'+(x.actionRequested?'<p><strong>Requested parent action:</strong> '+esc(x.actionRequested)+'</p>':'')+
      (x.attachments?.length?'<div style="margin-top:10px">'+x.attachments.map(mediaHtml).join('')+'</div>':'')+
      '<p><strong>Parent acknowledgement:</strong> '+(x.acknowledgedAt?'Received':'Pending')+'</p>'+
      ((canAck||canResolve)?'<div class="paper-actions">'+(canAck?'<button data-pc-ack="'+esc(x.id)+'">Acknowledge</button>':'')+(canResolve?'<button data-pc-resolve="'+esc(x.id)+'">Mark Resolved</button>':'')+'</div>':'')+
      '</article>';
  }
  async function send(){
    const studentId=$('pcStudent')?.value,subject=$('pcSubject')?.value.trim(),message=$('pcMessage')?.value.trim();
    if(!studentId||!subject||!message)return alert('Student, subject aur complaint message required hain.');
    const files=[...($('pcFiles')?.files||[])];
    if(files.length>MAX_FILES)return alert('Maximum 3 photo/video attachments allowed.');
    for(const f of files){
      if(!(f.type.startsWith('image/')||f.type.startsWith('video/')))return alert('Only photo/video attachments allowed.');
      if(f.size>MAX_BYTES)return alert(f.name+' 25 MB se zyada hai.');
    }
    const s=students().find(x=>String(x.id)===String(studentId));if(!s)return;
    let item={id:String(Date.now()),studentId:String(s.id),studentName:s.name,className:s.className||'',sectionName:s.sectionName||'',subject,message,severity:$('pcSeverity')?.value||'Concern',actionRequested:$('pcAction')?.value.trim()||'',status:'Open',acknowledgedAt:'',resolvedAt:'',creatorKey:meKey(),createdAt:new Date().toISOString(),attachments:[]};
    if(cloudReady()){
      try{
        const created=await createCloud(item),complaintId=created?.id||created;
        if(!complaintId)throw new Error('Complaint record was not created.');
        if(files.length)await uploadFiles(complaintId,files);
        await pullCloud();render();return;
      }catch(e){return alert('Complaint send failed: '+(e.message||e))}
    }
    if(files.length)return alert('Photo/video complaint ke liye Cloud Mode required hai.');
    const rows=read();rows.unshift(item);write(rows);render();
  }
  async function acknowledge(id){
    const rows=read(),x=rows.find(r=>String(r.id)===String(id));if(!x||!isParent())return;
    try{if(cloudReady()){await acknowledgeCloud(id);await pullCloud();render();return}}catch(e){return alert('Acknowledgement failed: '+(e.message||e))}
    x.acknowledgedAt=new Date().toISOString();write(rows);render();
  }
  async function resolve(id){
    if(!isHead())return;
    try{if(cloudReady()){await resolveCloud(id);await pullCloud();render();return}}catch(e){return alert('Resolve failed: '+(e.message||e))}
    const rows=read(),x=rows.find(r=>String(r.id)===String(id));if(x){x.status='Resolved';x.resolvedAt=new Date().toISOString();write(rows)}render();
  }
  function printNotice(x){
    const st=settings(),w=window.open('','_blank','width=800,height=700');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Parent Complaint Notice</title><style>body{font-family:Arial;padding:30px;color:#17324a}.box{max-width:700px;margin:auto;border:1px solid #cbd8df;border-radius:14px;padding:24px}.head{text-align:center}.row{padding:10px 0;border-bottom:1px solid #edf1f3}</style></head><body><div class="box"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Parent Complaint Notice</h3></div><div class="row"><strong>Student:</strong> '+esc(x.studentName)+' · '+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</div><div class="row"><strong>Severity:</strong> '+esc(x.severity)+'</div><div class="row"><strong>Subject:</strong> '+esc(x.subject)+'</div><div class="row"><strong>Complaint:</strong><br>'+esc(x.message)+'</div>'+(x.actionRequested?'<div class="row"><strong>Requested parent action:</strong><br>'+esc(x.actionRequested)+'</div>':'')+'<div class="row"><strong>Status:</strong> '+esc(x.status)+' · <strong>Acknowledged:</strong> '+(x.acknowledgedAt?'Yes':'No')+'</div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(rows){
    $('pcSend')?.addEventListener('click',send);
    document.querySelectorAll('[data-pc-ack]').forEach(b=>b.onclick=()=>acknowledge(b.dataset.pcAck));
    document.querySelectorAll('[data-pc-resolve]').forEach(b=>b.onclick=()=>resolve(b.dataset.pcResolve));
    document.querySelectorAll('[data-pc-print]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>String(r.id)===String(b.dataset.pcPrint));if(x)printNotice(x)});
  }
  async function render(){
    const root=$('parentComplaintApp');if(!root)return;
    let rows=read();
    if(cloudReady()){try{rows=await pullCloud()}catch(e){console.warn('Parent complaint cloud sync:',e.message);rows=[]}}
    else rows=localVisible(rows);
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Private Cloud Media':'Local Text Mode')+'</span></div>'+
      metrics(rows)+editor()+
      '<div class="section-head" style="margin-top:18px"><div><h3>'+ (isParent()?'Complaint Notices':'Sent Student Complaints') +'</h3><p class="muted">Parent acknowledgement aur media evidence history.</p></div></div><div class="paper-grid">'+(rows.length?rows.map(x=>card(x).replace('</div></article>','<button class="secondary" data-pc-print="'+esc(x.id)+'">Print Notice</button></div></article>')).join(''):'<div class="empty-state">No parent complaint notices.</div>')+'</div>';
    bind(rows);
  }
  window.addEventListener('edunizam:auth',render);
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_PARENT_COMPLAINTS={render,pullCloud,cloudReady};
})();