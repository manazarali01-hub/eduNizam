(function(){
  const KEY='edunizam_fee_challans_v1';
  const CLASS_KEY='edunizam_class_fees';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const monthKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
  const localDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function classFees(){try{return JSON.parse(localStorage.getItem(CLASS_KEY)||'{}')}catch{return{}}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function money(v){return 'Rs '+Number(v||0).toLocaleString('en-PK')}
  function statusRisk(s){return s==='Paid'?'good':s==='Pending'?'medium':'high'}
  function visibleLocal(rows){
    if(isHead())return rows;
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return rows.filter(x=>ids.has(String(x.studentId)));
  }
  function nextNo(prefix){
    return prefix+'-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+String(Date.now()).slice(-6);
  }
  async function cloudStudent(localId){
    if(!cloudReady())return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,student_code,auth_user_id')
      .eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);
    else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function toLocalRow(x){
    const s=x.core_students||{};
    return {
      id:x.id,
      localFeeId:x.local_id||String(Date.now()),
      studentId:s.local_id||'',
      studentCloudId:x.student_id,
      studentName:s.name||'Student',
      className:s.class_name||'',
      feeMonth:x.fee_month||'',
      baseAmount:Number(x.base_amount??x.amount??0),
      discount:Number(x.discount||0),
      arrears:Number(x.arrears||0),
      totalAmount:Number(x.amount||0),
      status:x.status||'Pending',
      dueDate:x.due_date||x.fee_date||'',
      challanNo:x.challan_no||'',
      receiptNo:x.receipt_no||'',
      paymentReference:x.payment_reference||'',
      createdAt:x.created_at,
      paidAt:x.paid_at||''
    };
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const {data,error}=await cloud().state.client.from('fee_records')
      .select('*,core_students(local_id,name,class_name,student_code,auth_user_id)')
      .eq('institution_id',cfg().institutionId)
      .not('fee_month','is',null)
      .order('created_at',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(toLocalRow);write(rows);
    return rows;
  }
  async function syncClassFees(map=classFees()){
    if(!cloudReady()||!isHead())return false;
    const rows=Object.entries(map||{}).map(([class_name,monthly_fee])=>({
      institution_id:cfg().institutionId,class_name:String(class_name),monthly_fee:Number(monthly_fee||0),
      updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    }));
    if(!rows.length)return true;
    const {error}=await cloud().state.client.from('class_fee_structure').upsert(rows,{onConflict:'institution_id,class_name'});
    if(error)throw error;return true;
  }
  async function pullClassFees(){
    if(!cloudReady())return classFees();
    const {data,error}=await cloud().state.client.from('class_fee_structure').select('class_name,monthly_fee')
      .eq('institution_id',cfg().institutionId);
    if(error)throw error;
    if(data?.length){
      const map={};data.forEach(x=>map[x.class_name]=Number(x.monthly_fee||0));
      localStorage.setItem(CLASS_KEY,JSON.stringify(map));return map;
    }
    return classFees();
  }
  async function insertCloud(item){
    if(!cloudReady())return null;
    const cs=await cloudStudent(item.studentId);
    if(!cs)throw new Error('Student cloud record is not linked/synced.');
    const payload={
      institution_id:cfg().institutionId,
      local_id:Number(item.localFeeId)||Date.now(),
      student_id:cs.id,
      amount:item.totalAmount,
      status:item.status,
      fee_date:item.dueDate||localDate(),
      fee_month:item.feeMonth,
      base_amount:item.baseAmount,
      discount:item.discount,
      arrears:item.arrears,
      due_date:item.dueDate||null,
      challan_no:item.challanNo,
      payment_reference:item.paymentReference||null,
      receipt_no:item.receiptNo||null,
      paid_at:item.paidAt||null,
      metadata:{source:'fee-center'},
      created_by:cloud().state.user.id,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await cloud().state.client.from('fee_records').upsert(payload,{onConflict:'institution_id,student_id,fee_month'}).select('*,core_students(local_id,name,class_name,student_code,auth_user_id)').single();
    if(error)throw error;return toLocalRow(data);
  }
  async function markPaidCloud(item){
    if(!cloudReady())return null;
    const payload={
      status:'Paid',
      payment_reference:item.paymentReference||null,
      receipt_no:item.receiptNo,
      paid_at:item.paidAt,
      fee_date:item.paidAt?String(item.paidAt).slice(0,10):localDate(),
      updated_at:new Date().toISOString()
    };
    const {data,error}=await cloud().state.client.from('fee_records').update(payload).eq('id',item.id)
      .select('*,core_students(local_id,name,class_name,student_code,auth_user_id)').single();
    if(error)throw error;return toLocalRow(data);
  }
  function mirrorLegacy(item){
    const rec={
      id:item.localFeeId||item.id,
      studentId:Number(item.studentId),
      amount:Number(item.totalAmount||0),
      status:item.status,
      date:item.status==='Paid'?(item.paidAt?String(item.paidAt).slice(0,10):localDate()):(item.dueDate||localDate()),
      feeMonth:item.feeMonth,
      challanNo:item.challanNo,
      receiptNo:item.receiptNo||''
    };
    if(window.EDUNIZAM_FEE_BRIDGE?.upsert)window.EDUNIZAM_FEE_BRIDGE.upsert(rec);
    else{
      const arr=JSON.parse(localStorage.getItem('edunizam_fees')||'[]');
      const i=arr.findIndex(x=>String(x.id)===String(rec.id));if(i>=0)arr[i]=Object.assign({},arr[i],rec);else arr.push(rec);
      localStorage.setItem('edunizam_fees',JSON.stringify(arr));
    }
  }
  function editor(){
    if(!isHead())return '<div class="coverage-note">Student/Parent apne challans aur receipts yahan dekh sakte hain. New challan Head of Institute generate karta hai.</div>';
    const list=visibleStudents();
    return '<article class="card"><div class="section-head"><div><h3>Generate Monthly Fee Challan</h3><p class="muted">Class fee auto-fill hoti hai; discount aur arrears adjust kar sakte hain.</p></div></div>'+
      '<div class="form-grid">'+
      '<select id="fcStudent"><option value="">Select student</option>'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · Class '+esc(s.className||'-')+'</option>').join('')+'</select>'+
      '<input id="fcMonth" type="month" value="'+monthKey()+'">'+
      '<input id="fcBase" type="number" min="0" placeholder="Base fee">'+
      '<input id="fcDiscount" type="number" min="0" value="0" placeholder="Discount">'+
      '<input id="fcArrears" type="number" min="0" value="0" placeholder="Arrears">'+
      '<input id="fcDue" type="date" value="'+localDate()+'">'+
      '<button id="fcGenerate">Generate Challan</button>'+
      '<button id="fcSyncClassFees" class="secondary">Sync Class Fees</button>'+
      '</div></article>';
  }
  function card(x){
    const canPay=isHead()&&x.status!=='Paid';
    return '<article class="paper-card">'+
      '<div class="paper-card-top"><span class="mini-badge">'+esc(x.feeMonth||'Fee')+'</span><span id="profileRiskBadge" data-risk="'+statusRisk(x.status)+'">'+esc(x.status)+'</span></div>'+
      '<h3>'+esc(x.studentName||'Student')+'</h3><p class="muted">Class '+esc(x.className||'-')+' · Due '+esc(x.dueDate||'-')+'</p>'+
      '<p>Base '+money(x.baseAmount)+' · Discount '+money(x.discount)+' · Arrears '+money(x.arrears)+'</p>'+
      '<p><strong>Total: '+money(x.totalAmount)+'</strong></p>'+
      '<p class="muted">Challan: '+esc(x.challanNo||'-')+(x.receiptNo?' · Receipt: '+esc(x.receiptNo):'')+'</p>'+
      '<div class="paper-actions"><button class="secondary" data-fc-print="'+esc(x.id)+'">'+(x.status==='Paid'?'Print Receipt':'Print Challan')+'</button>'+
      (canPay?'<button data-fc-paid="'+esc(x.id)+'">Mark Paid</button>':'')+'</div></article>';
  }
  function printDoc(item){
    const settings=(()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}})();
    const paid=item.status==='Paid',logo=settings.schoolLogo?'<img class="school-logo" src="'+esc(settings.schoolLogo)+'" alt="Institute logo">':'';
    const w=window.open('','_blank','width=850,height=700');if(!w)return alert('Popup blocked.');
    const title=paid?'Fee Receipt':'Fee Challan';
    w.document.write('<!doctype html><html><head><title>'+title+'</title><style>body{font-family:Arial,sans-serif;color:#17324a;padding:28px}.box{border:1px solid #bbb;border-radius:14px;padding:18px;max-width:720px;margin:auto}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #eee;padding:9px 0}.total{font-size:22px;font-weight:700}.muted{color:#667}.head{text-align:center;margin-bottom:18px}.school-logo{width:72px;height:72px;object-fit:contain;border:1px solid #d8e2e7;border-radius:12px;padding:5px}.head h2{margin:8px 0 4px}@media print{body{padding:0}}</style></head><body><div class="box"><div class="head">'+logo+'<h2>'+esc(settings.schoolName||'EduNizam Institute')+'</h2><h3>'+title+'</h3><div class="muted">'+esc(settings.session||'')+'</div></div>'+
      '<div class="row"><span>Student</span><strong>'+esc(item.studentName)+'</strong></div>'+
      '<div class="row"><span>Class</span><strong>'+esc(item.className||'-')+'</strong></div>'+
      '<div class="row"><span>Fee Month</span><strong>'+esc(item.feeMonth)+'</strong></div>'+
      '<div class="row"><span>Base Fee</span><strong>'+money(item.baseAmount)+'</strong></div>'+
      '<div class="row"><span>Discount</span><strong>'+money(item.discount)+'</strong></div>'+
      '<div class="row"><span>Arrears</span><strong>'+money(item.arrears)+'</strong></div>'+
      '<div class="row total"><span>Total</span><strong>'+money(item.totalAmount)+'</strong></div>'+
      '<div class="row"><span>Due Date</span><strong>'+esc(item.dueDate||'-')+'</strong></div>'+
      '<div class="row"><span>Challan No</span><strong>'+esc(item.challanNo||'-')+'</strong></div>'+
      (paid?'<div class="row"><span>Receipt No</span><strong>'+esc(item.receiptNo||'-')+'</strong></div><div class="row"><span>Payment Ref</span><strong>'+esc(item.paymentReference||'-')+'</strong></div><div class="row"><span>Paid On</span><strong>'+esc(item.paidAt?String(item.paidAt).slice(0,10):'-')+'</strong></div>':'')+
      '</div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  async function generate(){
    const sid=$('fcStudent')?.value,feeMonth=$('fcMonth')?.value,base=Number($('fcBase')?.value||0),discount=Number($('fcDiscount')?.value||0),arrears=Number($('fcArrears')?.value||0),dueDate=$('fcDue')?.value;
    if(!sid||!feeMonth||base<0||discount<0||arrears<0||!dueDate)return alert('Student, month, amounts aur due date complete karein.');
    const total=Math.max(0,base-discount+arrears),s=students().find(x=>String(x.id)===String(sid));if(!s)return;
    const rows=read();if(rows.some(x=>String(x.studentId)===String(sid)&&x.feeMonth===feeMonth))return alert('Is student ka is month ka challan already exists.');
    let item={id:String(Date.now()),localFeeId:Date.now(),studentId:s.id,studentName:s.name,className:s.className||'',feeMonth,baseAmount:base,discount,arrears,totalAmount:total,status:'Pending',dueDate,challanNo:nextNo('CHL'),receiptNo:'',paymentReference:'',createdAt:new Date().toISOString(),paidAt:''};
    try{const cloudRow=await insertCloud(item);if(cloudRow)item=cloudRow}catch(e){alert('Cloud sync unavailable; challan local mode mein save hoga. '+(e.message||e))}
    rows.unshift(item);write(rows);mirrorLegacy(item);render();
  }
  async function markPaid(id){
    let rows=read(),item=rows.find(x=>String(x.id)===String(id));if(!item||!isHead())return;
    const ref=prompt('Payment / transaction reference (optional):',item.paymentReference||'')||'';
    item.status='Paid';item.paymentReference=ref;item.receiptNo=item.receiptNo||nextNo('RCPT');item.paidAt=new Date().toISOString();
    try{const cloudRow=await markPaidCloud(item);if(cloudRow)item=cloudRow}catch(e){if(cloudReady())return alert('Cloud payment update failed: '+(e.message||e))}
    rows=rows.map(x=>String(x.id)===String(id)?item:x);write(rows);mirrorLegacy(item);
    try{
      const s=students().find(x=>String(x.id)===String(item.studentId));
      if(s?.authUserId&&cloud()?.sendNotification)await cloud().sendNotification(s.authUserId,'Fee payment received',item.feeMonth+' · '+money(item.totalAmount),'fee');
    }catch(_){}
    render();
  }
  function bind(){
    $('fcGenerate')?.addEventListener('click',generate);
    $('fcSyncClassFees')?.addEventListener('click',async()=>{try{await syncClassFees();alert('Class fees synced to cloud.')}catch(e){alert(e.message||e)}});
    $('fcStudent')?.addEventListener('change',()=>{const s=students().find(x=>String(x.id)===String($('fcStudent').value));if(s){const f=classFees()[s.className];if(f!=null)$('fcBase').value=Number(f||0)}});
    document.querySelectorAll('[data-fc-paid]').forEach(b=>b.onclick=()=>markPaid(b.dataset.fcPaid));
    document.querySelectorAll('[data-fc-print]').forEach(b=>b.onclick=()=>{const item=read().find(x=>String(x.id)===String(b.dataset.fcPrint));if(item)printDoc(item)});
  }
  async function mount(){
    const section=$('fees');if(!section)return;
    let root=$('feeChallanCenter');
    if(!root){root=document.createElement('div');root.id='feeChallanCenter';section.appendChild(root)}
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{await pullClassFees();rows=await pullCloud();rows.forEach(mirrorLegacy)}catch(e){root.dataset.cloudLoaded='';console.warn('Fee Center cloud sync:',e.message)}
    }
    rows=visibleLocal(rows);
    root.innerHTML='<div class="section-head" style="margin-top:18px"><div><h2>Monthly Challans & Receipts</h2><p class="muted">Monthly billing, discount, arrears aur printable receipts.</p></div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+
      editor()+'<div class="paper-grid" style="margin-top:16px">'+(rows.length?rows.map(card).join(''):'<div class="empty-state">Abhi koi monthly challan/receipt nahi hai.</div>')+'</div>';
    bind();
  }
  function render(){return mount()}
  window.addEventListener('edunizam:auth',()=>{const root=$('feeChallanCenter');if(root)delete root.dataset.cloudLoaded;mount()});
  setTimeout(mount,0);setTimeout(mount,900);
  window.EDUNIZAM_FEE_CENTER={render,mount,read,pullCloud,syncClassFees,cloudReady};
})();