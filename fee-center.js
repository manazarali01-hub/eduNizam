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
  function setBusy(btn,busy,label='Working...'){
    if(!btn)return;
    if(busy){
      if(!btn.dataset.busyLabel)btn.dataset.busyLabel=btn.textContent||'';
      btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent=label;
    }else{
      btn.disabled=false;btn.removeAttribute('aria-busy');
      if(btn.dataset.busyLabel!==undefined){btn.textContent=btn.dataset.busyLabel;delete btn.dataset.busyLabel}
    }
  }
  const monthKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
  const localDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function classFees(){try{return JSON.parse(localStorage.getItem(CLASS_KEY)||'{}')}catch{return{}}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function money(v){const s=JSON.parse(localStorage.getItem('edunizam_settings')||'{}'),currency=s.currency||'PKR',locale=s.locale||'en-PK';try{return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(Number(v||0))}catch(e){return currency+' '+Number(v||0).toLocaleString()}}
  function statusRisk(s){return s==='Paid'?'good':(s==='Pending'||s==='Partially Paid')?'medium':'high'}
  function isOverdue(x){return x.status!=='Paid'&&x.dueDate&&String(x.dueDate)<localDate()}
  function feeMetrics(rows){
    const billed=rows.reduce((a,x)=>a+Number(x.totalAmount||0),0);
    const collected=rows.reduce((a,x)=>a+Number(x.paidAmount||0),0);
    const outstanding=rows.reduce((a,x)=>a+Number(x.balanceAmount!=null?x.balanceAmount:Math.max(0,Number(x.totalAmount||0)-Number(x.paidAmount||0))),0);
    const overdue=rows.filter(isOverdue);
    return {billed,collected,outstanding,overdueCount:overdue.length,overdueAmount:overdue.reduce((a,x)=>a+Number(x.balanceAmount!=null?x.balanceAmount:(x.totalAmount||0)),0)};
  }
  function feeMetricCards(rows){
    const m=feeMetrics(rows);
    return '<div class="cards"><article class="card stat"><span>Total Billed</span><strong>'+money(m.billed)+'</strong></article><article class="card stat"><span>Collected</span><strong>'+money(m.collected)+'</strong></article><article class="card stat"><span>Outstanding</span><strong>'+money(m.outstanding)+'</strong></article><article class="card stat"><span>Overdue</span><strong>'+m.overdueCount+'</strong><small>'+money(m.overdueAmount)+'</small></article></div>';
  }
  function filteredRows(rows,root){
    const status=root.dataset.fcStatus||'',month=root.dataset.fcMonth||'',cls=root.dataset.fcClass||'',search=(root.dataset.fcSearch||'').toLowerCase();
    return rows.filter(x=>{
      const effective=isOverdue(x)?'Overdue':x.status;
      if(status&&effective!==status)return false;
      if(month&&x.feeMonth!==month)return false;
      if(cls&&x.className!==cls)return false;
      if(search&&!([x.studentName,x.className,x.challanNo,x.receiptNo,x.paymentReference,x.feeMonth].join(' ').toLowerCase().includes(search)))return false;
      return true;
    });
  }
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
      paidAmount:Number(x.paid_amount||0),
      balanceAmount:Math.max(0,Number(x.amount||0)-Number(x.paid_amount||0)),
      status:x.status||'Pending',
      dueDate:x.due_date||x.fee_date||'',
      challanNo:x.challan_no||'',
      receiptNo:x.receipt_no||'',
      paymentReference:x.payment_reference||'',
      paymentHistory:Array.isArray(x.paymentHistory)?x.paymentHistory:[],
      createdAt:x.created_at,
      paidAt:x.paid_at||''
    };
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const [feesRes,paymentsRes]=await Promise.all([
      cloud().state.client.from('fee_records')
        .select('*,core_students(local_id,name,class_name,student_code,auth_user_id)')
        .eq('institution_id',cfg().institutionId)
        .not('fee_month','is',null)
        .order('created_at',{ascending:false}),
      cloud().state.client.from('fee_payments')
        .select('*')
        .eq('institution_id',cfg().institutionId)
        .order('paid_at',{ascending:false})
    ]);
    if(feesRes.error)throw feesRes.error;
    if(paymentsRes.error)throw paymentsRes.error;
    const byFee=new Map();
    (paymentsRes.data||[]).forEach(p=>{
      const k=String(p.fee_record_id);
      if(!byFee.has(k))byFee.set(k,[]);
      byFee.get(k).push({
        id:p.id,amount:Number(p.amount||0),reference:p.payment_reference||'',
        receiptNo:p.receipt_no||'',paidAt:p.paid_at,recordedBy:p.recorded_by||''
      });
    });
    const rows=(feesRes.data||[]).map(x=>toLocalRow(Object.assign({},x,{paymentHistory:byFee.get(String(x.id))||[]})));
    write(rows);
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
      paid_amount:Number(item.paidAmount||0),
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
    const {data,error}=await cloud().state.client.from('fee_records').insert(payload).select('*,core_students(local_id,name,class_name,student_code,auth_user_id)').single();
    if(error)throw error;return toLocalRow(data);
  }
  async function recordPaymentCloud(item,amount,reference){
    if(!cloudReady())return null;
    const {data,error}=await cloud().state.client.rpc('record_fee_payment_v1',{
      p_fee_record_id:item.id,
      p_amount:Number(amount),
      p_payment_reference:reference||null
    });
    if(error)throw error;
    return Array.isArray(data)?data[0]:data;
  }
  function mirrorLegacy(item){
    const rec={
      id:item.localFeeId||item.id,
      studentId:Number(item.studentId),
      amount:Number(item.status==='Paid'?item.totalAmount:((item.balanceAmount!=null?item.balanceAmount:item.totalAmount)||0)),
      status:item.status==='Paid'?'Paid':'Pending',
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
    const balance=Number(x.balanceAmount!=null?x.balanceAmount:Math.max(0,Number(x.totalAmount||0)-Number(x.paidAmount||0)));
    const paid=Number(x.paidAmount||0),canPay=isHead()&&balance>0,overdue=isOverdue(x),label=overdue?'Overdue':x.status;
    const history=Array.isArray(x.paymentHistory)?x.paymentHistory:[];
    const paymentTrail=history.length?'<details class="coverage-note"><summary><strong>Payment history ('+history.length+')</strong></summary>'+
      history.map(p=>'<div style="padding:8px 0;border-bottom:1px solid #e6edf1"><strong>'+money(p.amount)+'</strong> · '+esc(p.receiptNo||'-')+'<br><span class="muted">'+esc(p.paidAt?new Date(p.paidAt).toLocaleString():'')+(p.reference?' · Ref '+esc(p.reference):'')+'</span></div>').join('')+
      '</details>':'';
    return '<article class="paper-card">'+
      '<div class="paper-card-top"><span class="mini-badge">'+esc(x.feeMonth||'Fee')+'</span><span data-risk="'+(overdue?'high':statusRisk(x.status))+'">'+esc(label)+'</span></div>'+
      '<h3>'+esc(x.studentName||'Student')+'</h3><p class="muted">Class '+esc(x.className||'-')+' · Due '+esc(x.dueDate||'-')+(overdue?' · <strong>Past due</strong>':'')+'</p>'+
      '<p>Base '+money(x.baseAmount)+' · Discount '+money(x.discount)+' · Arrears '+money(x.arrears)+'</p>'+
      '<p><strong>Total: '+money(x.totalAmount)+'</strong> · Paid: <strong>'+money(paid)+'</strong> · Balance: <strong>'+money(balance)+'</strong></p>'+
      '<p class="muted">Challan: '+esc(x.challanNo||'-')+(x.receiptNo?' · Latest receipt: '+esc(x.receiptNo):'')+(x.paymentReference?' · Latest ref: '+esc(x.paymentReference):'')+'</p>'+
      paymentTrail+
      '<div class="paper-actions"><button class="secondary" data-fc-print="'+esc(x.id)+'">'+(x.status==='Paid'?'Print Receipt':x.status==='Partially Paid'?'Print Statement':'Print Challan')+'</button>'+
      (canPay?'<button data-fc-payment="'+esc(x.id)+'">Record Payment</button>':'')+'</div></article>';
  }
  function printDoc(item){
    const settings=(()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}})();
    const paid=item.status==='Paid',partial=item.status==='Partially Paid',logo=settings.schoolLogo?'<img class="school-logo" src="'+esc(settings.schoolLogo)+'" alt="Institute logo">':'';
    const balance=Number(item.balanceAmount!=null?item.balanceAmount:Math.max(0,Number(item.totalAmount||0)-Number(item.paidAmount||0)));
    const history=Array.isArray(item.paymentHistory)?item.paymentHistory:[];
    const w=window.open('','_blank','width=850,height=700');if(!w)return alert('Popup blocked.');
    const title=paid?'Fee Receipt':partial?'Fee Payment Statement':'Fee Challan';
    const paymentRows=history.length?'<h4>Payment History</h4>'+history.map(p=>'<div class="row"><span>'+esc(p.receiptNo||'Receipt')+(p.reference?' · '+esc(p.reference):'')+'</span><strong>'+money(p.amount)+' · '+esc(p.paidAt?String(p.paidAt).slice(0,10):'')+'</strong></div>').join(''):'';
    w.document.write('<!doctype html><html><head><title>'+title+'</title><style>body{font-family:Arial,sans-serif;color:#17324a;padding:28px}.box{border:1px solid #bbb;border-radius:14px;padding:18px;max-width:720px;margin:auto}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #eee;padding:9px 0}.total{font-size:22px;font-weight:700}.muted{color:#667}.head{text-align:center;margin-bottom:18px}.school-logo{width:72px;height:72px;object-fit:contain;border:1px solid #d8e2e7;border-radius:12px;padding:5px}.head h2{margin:8px 0 4px}@media print{body{padding:0}}</style></head><body><div class="box"><div class="head">'+logo+'<h2>'+esc(settings.schoolName||'EduNizam Institute')+'</h2><h3>'+title+'</h3><div class="muted">'+esc(settings.session||'')+'</div></div>'+
      '<div class="row"><span>Student</span><strong>'+esc(item.studentName)+'</strong></div>'+
      '<div class="row"><span>Class</span><strong>'+esc(item.className||'-')+'</strong></div>'+
      '<div class="row"><span>Fee Month</span><strong>'+esc(item.feeMonth)+'</strong></div>'+
      '<div class="row"><span>Base Fee</span><strong>'+money(item.baseAmount)+'</strong></div>'+
      '<div class="row"><span>Discount</span><strong>'+money(item.discount)+'</strong></div>'+
      '<div class="row"><span>Arrears</span><strong>'+money(item.arrears)+'</strong></div>'+
      '<div class="row total"><span>Total</span><strong>'+money(item.totalAmount)+'</strong></div>'+
      '<div class="row"><span>Paid</span><strong>'+money(item.paidAmount||0)+'</strong></div>'+
      '<div class="row"><span>Balance</span><strong>'+money(balance)+'</strong></div>'+
      '<div class="row"><span>Due Date</span><strong>'+esc(item.dueDate||'-')+'</strong></div>'+
      '<div class="row"><span>Challan No</span><strong>'+esc(item.challanNo||'-')+'</strong></div>'+
      paymentRows+
      '</div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  async function generate(){
    const sid=$('fcStudent')?.value,feeMonth=$('fcMonth')?.value,base=Number($('fcBase')?.value||0),discount=Number($('fcDiscount')?.value||0),arrears=Number($('fcArrears')?.value||0),dueDate=$('fcDue')?.value;
    if(!sid||!feeMonth||base<0||discount<0||arrears<0||!dueDate)return alert('Student, month, amounts aur due date complete karein.');
    const btn=$('fcGenerate');if(btn?.disabled)return;setBusy(btn,true,'Generating...');
    const total=Math.max(0,base-discount+arrears),s=students().find(x=>String(x.id)===String(sid));
    if(!s){setBusy(btn,false);return}
    const rows=read();if(rows.some(x=>String(x.studentId)===String(sid)&&x.feeMonth===feeMonth)){setBusy(btn,false);return alert('Is student ka is month ka challan already exists.')}
    let item={id:String(Date.now()),localFeeId:Date.now(),studentId:s.id,studentName:s.name,className:s.className||'',feeMonth,baseAmount:base,discount,arrears,totalAmount:total,paidAmount:0,balanceAmount:total,paymentHistory:[],status:'Pending',dueDate,challanNo:nextNo('CHL'),receiptNo:'',paymentReference:'',createdAt:new Date().toISOString(),paidAt:''};
    try{
      if(cloudReady()){
        item=await insertCloud(item);
        await pullCloud();
        mirrorLegacy(item);
        render();
        return;
      }
      rows.unshift(item);write(rows);mirrorLegacy(item);render();
    }catch(e){
      alert('Cloud challan save failed. Nothing was saved locally: '+(e.message||e));
    }finally{
      setBusy(btn,false);
    }
  }
  async function recordPayment(id,btn){
    let rows=read(),item=rows.find(x=>String(x.id)===String(id));if(!item||!isHead()||btn?.disabled)return;
    const balance=Number(item.balanceAmount!=null?item.balanceAmount:Math.max(0,Number(item.totalAmount||0)-Number(item.paidAmount||0)));
    if(balance<=0)return alert('This challan is already fully paid.');
    const raw=prompt('Payment amount (maximum '+money(balance)+'):',String(balance));
    if(raw===null)return;
    const amount=Number(String(raw).replace(/,/g,''));
    if(!Number.isFinite(amount)||amount<=0)return alert('Valid payment amount enter karein.');
    if(amount>balance)return alert('Payment outstanding balance se zyada nahi ho sakti.');
    const ref=prompt('Payment / transaction reference (optional):','')||'';
    setBusy(btn,true,'Recording...');
    try{
      if(cloudReady()){
        await recordPaymentCloud(item,amount,ref);
        rows=await pullCloud();
        item=rows.find(x=>String(x.id)===String(id))||item;
      }else{
        const payment={id:String(Date.now()),amount,reference:ref,receiptNo:nextNo('RCPT'),paidAt:new Date().toISOString()};
        item.paymentHistory=[payment,...(item.paymentHistory||[])];
        item.paidAmount=Number(item.paidAmount||0)+amount;
        item.balanceAmount=Math.max(0,Number(item.totalAmount||0)-item.paidAmount);
        item.status=item.balanceAmount<=0?'Paid':'Partially Paid';
        item.receiptNo=payment.receiptNo;item.paymentReference=ref;item.paidAt=item.status==='Paid'?payment.paidAt:'';
        rows=rows.map(x=>String(x.id)===String(id)?item:x);write(rows);
      }
      mirrorLegacy(item);
      render();
    }catch(e){alert('Payment record failed: '+(e.message||e))}
    finally{setBusy(btn,false)}
  }
  function bind(root){
    $('fcGenerate')?.addEventListener('click',generate);
    $('fcSyncClassFees')?.addEventListener('click',async e=>{
      const btn=e.currentTarget;if(btn?.disabled)return;setBusy(btn,true,'Syncing...');
      try{await syncClassFees();alert('Class fees synced to cloud.')}catch(err){alert(err.message||err)}
      finally{setBusy(btn,false)}
    });
    $('fcStudent')?.addEventListener('change',()=>{const s=students().find(x=>String(x.id)===String($('fcStudent').value));if(s){const f=classFees()[s.className];if(f!=null)$('fcBase').value=Number(f||0)}});
    $('fcFilterStatus')?.addEventListener('change',e=>{root.dataset.fcStatus=e.target.value;mount()});
    $('fcFilterMonth')?.addEventListener('change',e=>{root.dataset.fcMonth=e.target.value;mount()});
    $('fcFilterClass')?.addEventListener('change',e=>{root.dataset.fcClass=e.target.value;mount()});
    $('fcFilterSearch')?.addEventListener('input',e=>{root.dataset.fcSearch=e.target.value;clearTimeout(bind.searchTimer);bind.searchTimer=setTimeout(mount,160)});
    $('fcClearFilters')?.addEventListener('click',()=>{root.dataset.fcStatus='';root.dataset.fcMonth='';root.dataset.fcClass='';root.dataset.fcSearch='';mount()});
    document.querySelectorAll('[data-fc-payment]').forEach(b=>b.onclick=()=>recordPayment(b.dataset.fcPayment,b));
    document.querySelectorAll('[data-fc-print]').forEach(b=>b.onclick=()=>{const item=read().find(x=>String(x.id)===String(b.dataset.fcPrint));if(item)printDoc(item)});
  }
  async function mount(){
    const section=$('fees');if(!section)return;
    let root=$('feeChallanCenter');
    if(!root){root=document.createElement('div');root.id='feeChallanCenter';section.appendChild(root)}
    let rows=read(),cloudError='';
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{
        if(isHead())await pullClassFees();
        rows=await pullCloud();
        rows.forEach(mirrorLegacy);
      }catch(e){
        root.dataset.cloudLoaded='';
        rows=[];
        cloudError=e.message||String(e);
        console.warn('Fee Center cloud sync:',cloudError);
      }
    }
    rows=cloudReady()?rows:visibleLocal(rows);
    const classes=[...new Set(rows.map(x=>x.className).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
    const filtered=filteredRows(rows,root);
    root.innerHTML='<div class="section-head" style="margin-top:18px"><div><h2>Monthly Challans & Receipts</h2><p class="muted">Billing, collections, outstanding/overdue tracking, discounts, arrears and printable receipts.</p></div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+(cloudError?'<div class="coverage-note">Fee cloud sync unavailable: '+esc(cloudError)+'</div>':'')+
      feeMetricCards(rows)+editor()+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Fee Register</h3><p class="muted">'+filtered.length+' of '+rows.length+' challans shown.</p></div><button id="fcClearFilters" class="secondary">Clear Filters</button></div><div class="form-grid"><select id="fcFilterStatus"><option value="">All Status</option>'+['Pending','Partially Paid','Overdue','Paid'].map(v=>'<option value="'+v+'" '+((root.dataset.fcStatus||'')===v?'selected':'')+'>'+v+'</option>').join('')+'</select><input id="fcFilterMonth" type="month" value="'+esc(root.dataset.fcMonth||'')+'"><select id="fcFilterClass"><option value="">All Classes</option>'+classes.map(v=>'<option value="'+esc(v)+'" '+((root.dataset.fcClass||'')===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><input id="fcFilterSearch" type="search" value="'+esc(root.dataset.fcSearch||'')+'" placeholder="Search student, challan, receipt or reference"></div></article>'+
      '<div class="paper-grid" style="margin-top:16px">'+(filtered.length?filtered.map(card).join(''):'<div class="empty-state">Is filter ke liye koi challan/receipt nahi hai.</div>')+'</div>';
    bind(root);
  }
  function render(){return mount()}
  window.addEventListener('edunizam:auth',()=>{const root=$('feeChallanCenter');if(root)delete root.dataset.cloudLoaded;mount()});
  setTimeout(mount,0);setTimeout(mount,900);
  window.EDUNIZAM_FEE_CENTER={render,mount,read,pullCloud,syncClassFees,cloudReady};
})();