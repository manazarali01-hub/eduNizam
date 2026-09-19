(function(){
  const KEY='edunizam_helpdesk_tickets_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'').trim().toLowerCase();
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function meKey(){return role()+':'+identity()}
  function visibleLocal(rows){return isHead()?rows:rows.filter(x=>x.creatorKey===meKey())}
  function ticketNo(){return 'HD-'+Date.now().toString(36).toUpperCase()}
  function mapTicket(x){
    const s=x.core_students||{};
    return {id:x.id,ticketNo:x.ticket_no,category:x.category,priority:x.priority,subject:x.subject,description:x.description,status:x.status,adminResponse:x.admin_response||'',studentId:s.local_id!=null?String(s.local_id):'',studentName:s.name||'',className:s.class_name||'',sectionName:s.section_name||'',creatorRole:x.creator_role||'',createdBy:x.created_by||'',creatorKey:'',createdAt:x.created_at,updatedAt:x.updated_at,resolvedAt:x.resolved_at||''};
  }
  async function cloudStudent(localId){
    if(!cloudReady()||!localId)return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id').eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('school_helpdesk_tickets')
      .select('*,core_students(local_id,name,class_name,section_name,auth_user_id)')
      .eq('institution_id',cfg().institutionId).order('created_at',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(mapTicket);write(rows);return rows;
  }
  async function createCloud(item){
    const cs=item.studentId?await cloudStudent(item.studentId):null;
    const {data,error}=await cloud().state.client.rpc('create_helpdesk_ticket',{
      p_institution_id:cfg().institutionId,p_student_id:cs?.id||null,p_category:item.category,p_priority:item.priority,p_subject:item.subject,p_description:item.description
    });
    if(error)throw error;return data;
  }
  async function updateCloud(id,status,response){
    const {data,error}=await cloud().state.client.rpc('update_helpdesk_ticket',{p_ticket_id:id,p_status:status,p_admin_response:response||null});
    if(error)throw error;return data;
  }
  function editor(){
    return '<article class="card"><h3>Submit Helpdesk Ticket</h3><div class="form-grid">'+
      '<select id="hdCategory">'+['Academics','Attendance','Fees','Transport','Behavior','Facilities','Technical','Admission','Other'].map(x=>'<option>'+x+'</option>').join('')+'</select>'+
      '<select id="hdPriority"><option>Normal</option><option>Low</option><option>High</option></select>'+
      '<select id="hdStudent"><option value="">No student context</option>'+visibleStudents().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<input id="hdSubject" placeholder="Short subject">'+
      '<textarea id="hdDescription" rows="4" placeholder="Describe the issue / request"></textarea>'+
      '<button id="hdSubmit">Submit Ticket</button></div></article>';
  }
  function metrics(rows){
    const open=rows.filter(x=>x.status==='Open').length,progress=rows.filter(x=>x.status==='In Progress').length,resolved=rows.filter(x=>x.status==='Resolved').length,high=rows.filter(x=>x.priority==='High'&&!['Resolved','Closed'].includes(x.status)).length;
    return '<div class="cards"><article class="card stat"><span>Open</span><strong>'+open+'</strong></article><article class="card stat"><span>In Progress</span><strong>'+progress+'</strong></article><article class="card stat"><span>Resolved</span><strong>'+resolved+'</strong></article><article class="card stat"><span>High Priority</span><strong>'+high+'</strong></article></div>';
  }
  function ticketCard(x){
    const context=x.studentName?x.studentName+' · '+(x.className||'-')+(x.sectionName?' - '+x.sectionName:''):'General institute issue';
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.ticketNo)+'</span><span class="badge">'+esc(x.status)+'</span></div>'+
      '<h3>'+esc(x.subject)+'</h3><p class="muted">'+esc(x.category)+' · '+esc(x.priority)+' · '+esc(context)+'</p>'+
      '<p>'+esc(x.description)+'</p>'+(x.adminResponse?'<p><strong>Head response:</strong> '+esc(x.adminResponse)+'</p>':'')+
      '<p class="muted">'+new Date(x.createdAt).toLocaleString()+'</p><div class="paper-actions"><button class="secondary" data-hd-print="'+esc(x.id)+'">Print</button>'+
      (isHead()&&x.status==='Open'?'<button data-hd-progress="'+esc(x.id)+'">Start Work</button>':'')+
      (isHead()&&!['Resolved','Closed'].includes(x.status)?'<button data-hd-resolve="'+esc(x.id)+'">Resolve</button>':'')+
      (isHead()&&x.status==='Resolved'?'<button data-hd-close="'+esc(x.id)+'">Close</button>':'')+
      (isHead()?'<button class="secondary" data-hd-response="'+esc(x.id)+'">Respond</button>':'')+
      '</div></article>';
  }
  async function submit(){
    const subject=$('hdSubject')?.value.trim(),description=$('hdDescription')?.value.trim();if(!subject||!description)return alert('Subject aur description required hain.');
    const studentId=$('hdStudent')?.value||'',s=students().find(x=>String(x.id)===String(studentId));
    let item={id:String(Date.now()),ticketNo:ticketNo(),category:$('hdCategory')?.value||'Other',priority:$('hdPriority')?.value||'Normal',subject,description,status:'Open',adminResponse:'',studentId:studentId||'',studentName:s?.name||'',className:s?.className||'',sectionName:s?.sectionName||'',creatorRole:role(),creatorKey:meKey(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),resolvedAt:''};
    try{if(cloudReady()){await createCloud(item);await pullCloud();render();return}}catch(e){return alert('Cloud ticket submit failed: '+(e.message||e))}
    const rows=read();rows.unshift(item);write(rows);render();
  }
  async function changeStatus(id,status){
    const rows=read(),x=rows.find(r=>String(r.id)===String(id));if(!x||!isHead())return;
    try{if(cloudReady()){await updateCloud(id,status,x.adminResponse);await pullCloud();render();return}}catch(e){return alert('Cloud ticket update failed: '+(e.message||e))}
    x.status=status;x.updatedAt=new Date().toISOString();if(status==='Resolved')x.resolvedAt=new Date().toISOString();write(rows);render();
  }
  async function respond(id){
    const rows=read(),x=rows.find(r=>String(r.id)===String(id));if(!x||!isHead())return;
    const response=prompt('Head response:',x.adminResponse||'');if(response===null)return;
    try{if(cloudReady()){await updateCloud(id,x.status,response.trim());await pullCloud();render();return}}catch(e){return alert('Cloud response failed: '+(e.message||e))}
    x.adminResponse=response.trim();x.updatedAt=new Date().toISOString();write(rows);render();
  }
  function printTicket(x){
    const st=settings(),w=window.open('','_blank','width=800,height=700');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Helpdesk Ticket</title><style>body{font-family:Arial;padding:30px;color:#17324a}.box{max-width:700px;margin:auto;border:1px solid #cbd8df;border-radius:14px;padding:22px}.head{text-align:center}.row{padding:9px 0;border-bottom:1px solid #edf1f3}.muted{color:#667}</style></head><body><div class="box"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Helpdesk Ticket</h3></div><div class="row"><strong>'+esc(x.ticketNo)+'</strong> · '+esc(x.status)+'</div><div class="row"><strong>Category:</strong> '+esc(x.category)+' · <strong>Priority:</strong> '+esc(x.priority)+'</div><div class="row"><strong>Subject:</strong> '+esc(x.subject)+'</div><div class="row"><strong>Description:</strong><br>'+esc(x.description)+'</div>'+(x.studentName?'<div class="row"><strong>Student:</strong> '+esc(x.studentName)+' · '+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</div>':'')+(x.adminResponse?'<div class="row"><strong>Head response:</strong><br>'+esc(x.adminResponse)+'</div>':'')+'<div class="row muted">'+new Date(x.createdAt).toLocaleString()+'</div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(rows){
    $('hdSubmit')?.addEventListener('click',submit);$('hdStatusFilter')?.addEventListener('change',render);
    document.querySelectorAll('[data-hd-progress]').forEach(b=>b.onclick=()=>changeStatus(b.dataset.hdProgress,'In Progress'));
    document.querySelectorAll('[data-hd-resolve]').forEach(b=>b.onclick=()=>changeStatus(b.dataset.hdResolve,'Resolved'));
    document.querySelectorAll('[data-hd-close]').forEach(b=>b.onclick=()=>changeStatus(b.dataset.hdClose,'Closed'));
    document.querySelectorAll('[data-hd-response]').forEach(b=>b.onclick=()=>respond(b.dataset.hdResponse));
    document.querySelectorAll('[data-hd-print]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>String(r.id)===String(b.dataset.hdPrint));if(x)printTicket(x)});
  }
  async function render(){
    const root=$('helpdeskCenterApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Helpdesk cloud sync:',e.message)}}
    rows=cloudReady()?rows:visibleLocal(rows);
    const filter=$('hdStatusFilter')?.value||root.dataset.statusFilter||'all';root.dataset.statusFilter=filter;
    const filtered=filter==='all'?rows:rows.filter(x=>x.status===filter);
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><select id="hdStatusFilter"><option value="all">All statuses</option>'+['Open','In Progress','Resolved','Closed'].map(x=>'<option '+(filter===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'+
      metrics(rows)+editor()+
      '<div class="section-head" style="margin-top:18px"><div><h3>'+ (isHead()?'Institute Tickets':'My Tickets') +'</h3><p class="muted">Structured issue tracking and resolution history.</p></div></div><div class="paper-grid">'+(filtered.length?filtered.map(ticketCard).join(''):'<div class="empty-state">No helpdesk tickets.</div>')+'</div>';
    bind(filtered);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('helpdeskCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_HELPDESK_CENTER={render,pullCloud,cloudReady};
})();