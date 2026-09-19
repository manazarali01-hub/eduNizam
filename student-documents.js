(function(){
  const KEY='edunizam_student_documents_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function visibleDocs(rows){
    if(isHead())return rows;
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return rows.filter(x=>ids.has(String(x.studentId)));
  }
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function numberFor(type){
    const prefix=type==='ID Card'?'IDC':type==='Bonafide Certificate'?'BON':type==='Enrollment Certificate'?'ENR':'LEA';
    return prefix+'-'+today().replace(/-/g,'')+'-'+String(Date.now()).slice(-5);
  }
  function initials(name){return String(name||'S').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'S'}
  async function cloudStudent(localId){
    if(!cloudReady())return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id')
      .eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function toLocal(x){
    const s=x.core_students||{};
    return {id:x.id,studentId:s.local_id||'',studentCloudId:x.student_id,studentName:s.name||'Student',className:s.class_name||'',sectionName:s.section_name||'',studentCode:s.student_code||'',documentType:x.document_type,documentNo:x.document_no,issueDate:x.issue_date,remarks:x.remarks||'',createdAt:x.created_at};
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('student_documents')
      .select('*,core_students(local_id,name,class_name,section_name,student_code,auth_user_id)')
      .eq('institution_id',cfg().institutionId).order('created_at',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(toLocal);write(rows);return rows;
  }
  async function insertCloud(item){
    if(!cloudReady())return null;
    const s=await cloudStudent(item.studentId);if(!s)throw new Error('Student cloud record not found.');
    const {data,error}=await cloud().state.client.from('student_documents').insert({
      institution_id:cfg().institutionId,student_id:s.id,document_type:item.documentType,document_no:item.documentNo,
      issue_date:item.issueDate,remarks:item.remarks||null,issued_by:cloud().state.user.id
    }).select('*,core_students(local_id,name,class_name,section_name,student_code,auth_user_id)').single();
    if(error)throw error;return toLocal(data);
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('student_documents').delete().eq('id',id);if(error)throw error;
  }
  function editor(){
    if(!isHead())return '<div class="coverage-note">Issued documents read/print view. New ID card/certificate Head of Institute issue karta hai.</div>';
    return '<article class="card"><h3>Issue Student Document</h3><div class="form-grid">'+
      '<select id="sdStudent"><option value="">Select student</option>'+students().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<select id="sdType"><option>ID Card</option><option>Bonafide Certificate</option><option>Enrollment Certificate</option><option>Leaving Certificate</option></select>'+
      '<input id="sdIssueDate" type="date" value="'+today()+'">'+
      '<input id="sdRemarks" placeholder="Purpose / remarks / leaving reason (optional)">'+
      '<button id="sdIssue">Issue Document</button></div></article>';
  }
  function card(x){
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.documentType)+'</span><span class="badge">'+esc(x.issueDate)+'</span></div>'+
      '<h3>'+esc(x.studentName)+'</h3><p class="muted">'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</p>'+
      '<p><strong>'+esc(x.documentNo)+'</strong></p>'+(x.remarks?'<p>'+esc(x.remarks)+'</p>':'')+
      '<div class="paper-actions"><button class="secondary" data-sd-print="'+esc(x.id)+'">Print</button>'+(isHead()?'<button data-sd-delete="'+esc(x.id)+'">Delete</button>':'')+'</div></article>';
  }
  function baseStudent(item){
    return students().find(x=>String(x.id)===String(item.studentId))||{name:item.studentName,className:item.className,sectionName:item.sectionName,studentId:item.studentCode};
  }
  function printIdCard(item){
    const s=baseStudent(item),st=settings(),w=window.open('','_blank','width=760,height=600');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Student ID Card</title><style>body{font-family:Arial;padding:30px;background:#f4f7fa;color:#17324a}.card{width:360px;margin:auto;border:1px solid #b9c9d7;border-radius:18px;overflow:hidden;background:white;box-shadow:0 10px 30px #ccd}.head{padding:18px;text-align:center;background:#eef5f7}.avatar{width:82px;height:82px;border-radius:50%;display:grid;place-items:center;background:#dfecee;margin:16px auto;font-size:28px;font-weight:800}.row{display:flex;justify-content:space-between;padding:7px 18px;border-top:1px solid #eef1f3}.foot{text-align:center;padding:12px;font-size:12px;color:#667}</style></head><body><div class="card"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><div>STUDENT ID CARD</div></div><div class="avatar">'+esc(initials(s.name))+'</div><div class="row"><span>Name</span><strong>'+esc(s.name)+'</strong></div><div class="row"><span>Father/Guardian</span><strong>'+esc(s.father||'-')+'</strong></div><div class="row"><span>Class</span><strong>'+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</strong></div><div class="row"><span>Student ID</span><strong>'+esc(s.studentId||s.rollNo||item.documentNo)+'</strong></div><div class="row"><span>Card No</span><strong>'+esc(item.documentNo)+'</strong></div><div class="foot">'+esc(st.phone||'')+(st.address?' · '+esc(st.address):'')+'</div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function printCertificate(item){
    const s=baseStudent(item),st=settings(),w=window.open('','_blank','width=900,height=700');if(!w)return alert('Popup blocked.');
    const institute=esc(st.schoolName||'EduNizam Institute'),clazz=esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''));
    let title=item.documentType,body='';
    if(item.documentType==='Bonafide Certificate')body='This is to certify that <strong>'+esc(s.name)+'</strong>, son/daughter of <strong>'+esc(s.father||'-')+'</strong>, is a bona fide student of <strong>'+institute+'</strong> and is currently studying in <strong>'+clazz+'</strong>.';
    else if(item.documentType==='Enrollment Certificate')body='This is to certify that <strong>'+esc(s.name)+'</strong>, son/daughter of <strong>'+esc(s.father||'-')+'</strong>, is duly enrolled in <strong>'+clazz+'</strong> at <strong>'+institute+'</strong>.';
    else body='This is to certify that <strong>'+esc(s.name)+'</strong>, son/daughter of <strong>'+esc(s.father||'-')+'</strong>, studied in <strong>'+clazz+'</strong> at <strong>'+institute+'</strong>. This certificate is issued on request for official record.';
    if(item.remarks)body+='<br><br><strong>Remarks:</strong> '+esc(item.remarks);
    w.document.write('<!doctype html><html><head><title>'+esc(title)+'</title><style>body{font-family:Georgia,serif;padding:50px;color:#1b2f42}.sheet{max-width:800px;margin:auto;border:3px double #587383;padding:50px;min-height:480px}.head{text-align:center}.head h1{margin-bottom:4px}.title{text-align:center;font-size:26px;text-decoration:underline;margin:38px 0}.body{font-size:18px;line-height:1.8;text-align:justify}.meta{display:flex;justify-content:space-between;margin-top:42px}.sign{margin-top:70px;display:flex;justify-content:flex-end}.muted{color:#667;font-family:Arial,sans-serif;font-size:13px}</style></head><body><div class="sheet"><div class="head"><h1>'+institute+'</h1><div class="muted">'+esc(st.address||'')+(st.phone?' · '+esc(st.phone):'')+'</div></div><div class="title">'+esc(title)+'</div><div class="body">'+body+'</div><div class="meta"><span><strong>No:</strong> '+esc(item.documentNo)+'</span><span><strong>Date:</strong> '+esc(item.issueDate)+'</span></div><div class="sign"><strong>Head of Institute / Authorized Signatory</strong></div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function printDoc(item){item.documentType==='ID Card'?printIdCard(item):printCertificate(item)}
  async function issue(){
    const sid=$('sdStudent')?.value,type=$('sdType')?.value,issueDate=$('sdIssueDate')?.value,remarks=$('sdRemarks')?.value.trim()||'';
    if(!sid||!type||!issueDate)return alert('Student, document type aur issue date required hain.');
    const s=students().find(x=>String(x.id)===String(sid));if(!s)return;
    let item={id:String(Date.now()),studentId:s.id,studentName:s.name,className:s.className||'',sectionName:s.sectionName||'',studentCode:s.studentId||'',documentType:type,documentNo:numberFor(type),issueDate,remarks,createdAt:new Date().toISOString()};
    try{const c=await insertCloud(item);if(c)item=c}catch(e){alert('Cloud sync unavailable; document local mode mein issue hoga. '+(e.message||e))}
    const rows=read();rows.unshift(item);write(rows);render();
  }
  async function remove(id){
    if(!isHead())return;
    if(!confirm('Delete issued document record?'))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(x=>String(x.id)!==String(id)));render();
  }
  function bind(){
    $('sdIssue')?.addEventListener('click',issue);
    document.querySelectorAll('[data-sd-print]').forEach(b=>b.onclick=()=>{const x=read().find(r=>String(r.id)===String(b.dataset.sdPrint));if(x)printDoc(x)});
    document.querySelectorAll('[data-sd-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.sdDelete));
  }
  async function render(){
    const root=$('studentDocumentsApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Student document cloud sync:',e.message)}}
    rows=visibleDocs(rows);
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+editor()+
      '<div class="section-head" style="margin-top:18px"><div><h3>Issued Documents</h3><p class="muted">Printable student document history.</p></div></div>'+
      '<div class="paper-grid">'+(rows.length?rows.map(card).join(''):'<div class="empty-state">Abhi koi issued document nahi hai.</div>')+'</div>';
    bind();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('studentDocumentsApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_STUDENT_DOCUMENTS={render,pullCloud,cloudReady};
})();