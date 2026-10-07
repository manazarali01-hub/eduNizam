(function(){
  const KEY='edunizam_finance_entries_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  let editingId='',financeSaveInFlight=false;
  const financeDeleteInFlight=new Set();
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
  function withSignal(query,signal){return signal&&typeof query?.abortSignal==='function'?query.abortSignal(signal):query}
  async function runCloud(key,label,factory,{timeout=7000,retries=1}={}){
    const runtime=window.EDUNIZAM_DATA_RUNTIME;
    return runtime?runtime.run(key,factory,{timeout,retries,label}):factory({});
  }
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const monthKey=()=>today().slice(0,7);
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function localFees(){try{return JSON.parse(localStorage.getItem('edunizam_fees')||'[]')}catch{return[]}}
  function localPayroll(){try{return JSON.parse(localStorage.getItem('edunizam_staff_payroll_v1')||'[]')}catch{return[]}}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function money(v){const s=JSON.parse(localStorage.getItem('edunizam_settings')||'{}'),currency=s.currency||'PKR',locale=s.locale||'en-PK';try{return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(Number(v||0))}catch(e){return currency+' '+Number(v||0).toLocaleString()}}
  function nextMonth(month){
    const [y,m]=month.split('-').map(Number),d=new Date(y,m,1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
  }
  function monthBounds(month){return {start:month+'-01',end:nextMonth(month)}}
  function prevMonth(month){const [y,m]=month.split('-').map(Number),d=new Date(y,m-2,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function netOf(s){return (s.fees+s.otherIncome)-(s.payroll+s.otherExpenses)}
  function localSummary(month){
    const fees=localFees().filter(x=>x.status==='Paid'&&String(x.date||'').startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
    const payroll=localPayroll().filter(x=>x.status==='Paid'&&String(x.paidAt||'').startsWith(month)).reduce((a,x)=>a+Number(x.netSalary||0),0);
    const entries=read().filter(x=>String(x.entryDate||'').startsWith(month));
    const otherIncome=entries.filter(x=>x.entryType==='Income').reduce((a,x)=>a+Number(x.amount||0),0);
    const otherExpenses=entries.filter(x=>x.entryType==='Expense').reduce((a,x)=>a+Number(x.amount||0),0);
    return {fees,payroll,otherIncome,otherExpenses,entries};
  }
  async function cloudSummary(month){
    if(!cloudReady())return localSummary(month);
    const c=cloud().state.client,id=cfg().institutionId,{start,end}=monthBounds(month);
    const execute=async({signal}={})=>{
      const queries=[
        c.from('fee_records').select('amount,fee_date,status').eq('institution_id',id).eq('status','Paid').gte('fee_date',start).lt('fee_date',end),
        c.from('staff_payroll_records').select('net_salary,paid_at,status').eq('institution_id',id).eq('status','Paid').gte('paid_at',start+'T00:00:00').lt('paid_at',end+'T00:00:00'),
        c.from('school_finance_entries').select('*').eq('institution_id',id).gte('entry_date',start).lt('entry_date',end).order('entry_date',{ascending:false})
      ].map(q=>withSignal(q,signal));
      const [fees,payroll,entries]=await Promise.all(queries);
      for(const r of [fees,payroll,entries])if(r.error)throw r.error;
      return {fees,payroll,entries};
    };
    const {fees,payroll,entries}=await runCloud('finance-summary:'+id+':'+month,'Finance summary',execute,{timeout:7000,retries:1});
    const mapped=(entries.data||[]).map(x=>({id:x.id,entryType:x.entry_type,category:x.category,amount:Number(x.amount||0),entryDate:x.entry_date,reference:x.reference||'',note:x.note||'',createdAt:x.created_at}));
    const all=read().filter(x=>!String(x.entryDate||'').startsWith(month)).concat(mapped);write(all);
    return {
      fees:(fees.data||[]).reduce((a,x)=>a+Number(x.amount||0),0),
      payroll:(payroll.data||[]).reduce((a,x)=>a+Number(x.net_salary||0),0),
      otherIncome:mapped.filter(x=>x.entryType==='Income').reduce((a,x)=>a+Number(x.amount||0),0),
      otherExpenses:mapped.filter(x=>x.entryType==='Expense').reduce((a,x)=>a+Number(x.amount||0),0),
      entries:mapped
    };
  }
  async function insertCloud(item){
    if(!cloudReady())return null;
    const inst=cfg().institutionId,key=['finance-create',inst,item.entryDate,item.entryType,item.category,item.amount,item.reference||'',item.note||''].join(':');
    return runCloud(key,'Create finance entry',async({signal}={})=>{
      let q=cloud().state.client.from('school_finance_entries').insert({
        institution_id:inst,entry_type:item.entryType,category:item.category,amount:item.amount,
        entry_date:item.entryDate,reference:item.reference||null,note:item.note||null,created_by:cloud().state.user.id
      }).select().single();
      q=withSignal(q,signal);
      const {data,error}=await q;if(error)throw error;
      return {id:data.id,entryType:data.entry_type,category:data.category,amount:Number(data.amount||0),entryDate:data.entry_date,reference:data.reference||'',note:data.note||'',createdAt:data.created_at};
    },{timeout:8000,retries:0});
  }
  async function updateCloud(item){
    if(!cloudReady())return null;
    const inst=cfg().institutionId;
    return runCloud('finance-update:'+inst+':'+item.id,'Update finance entry',async({signal}={})=>{
      let q=cloud().state.client.from('school_finance_entries').update({
        entry_type:item.entryType,category:item.category,amount:item.amount,entry_date:item.entryDate,
        reference:item.reference||null,note:item.note||null
      }).eq('institution_id',inst).eq('id',item.id).select().single();
      q=withSignal(q,signal);
      const {data,error}=await q;if(error)throw error;
      return {id:data.id,entryType:data.entry_type,category:data.category,amount:Number(data.amount||0),entryDate:data.entry_date,reference:data.reference||'',note:data.note||'',createdAt:data.created_at};
    },{timeout:8000,retries:1});
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const inst=cfg().institutionId;
    return runCloud('finance-delete:'+inst+':'+id,'Delete finance entry',async({signal}={})=>{
      let q=cloud().state.client.from('school_finance_entries').delete().eq('institution_id',inst).eq('id',id);
      q=withSignal(q,signal);
      const {error}=await q;if(error)throw error;
    },{timeout:8000,retries:1});
  }
  function editor(){
    const x=read().find(v=>String(v.id)===String(editingId))||{},type=x.entryType||'Expense',cat=x.category||'Utilities';
    const categories=['Utilities','Rent','Maintenance','Supplies','Transport','Marketing','Donation','Other Income','Miscellaneous'];
    return '<article class="card"><div class="section-head"><div><h3>'+(editingId?'Edit Cashbook Entry':'Add Other Income / Expense')+'</h3><p class="muted">Fee income aur paid salaries automatically summary mein count hote hain; unhein yahan dobara enter na karein.</p></div>'+(editingId?'<button id="finCancelEdit" class="secondary">Cancel Edit</button>':'')+'</div><div class="form-grid">'+
      '<select id="finType"><option '+(type==='Expense'?'selected':'')+'>Expense</option><option '+(type==='Income'?'selected':'')+'>Income</option></select>'+
      '<select id="finCategory">'+categories.map(v=>'<option '+(cat===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select>'+
      '<input id="finAmount" type="number" min="0.01" step="0.01" value="'+esc(x.amount??'')+'" placeholder="Amount">'+
      '<input id="finDate" type="date" value="'+esc(x.entryDate||today())+'">'+
      '<input id="finReference" value="'+esc(x.reference||'')+'" placeholder="Reference / voucher no. (optional)">'+
      '<input id="finNote" value="'+esc(x.note||'')+'" placeholder="Note (optional)">'+
      '<button id="finSave">'+(editingId?'Update Entry':'Save Entry')+'</button>'+
      '</div></article>';
  }
  function metricCards(s){
    const income=s.fees+s.otherIncome,expenses=s.payroll+s.otherExpenses,net=income-expenses;
    return '<div class="cards">'+
      '<article class="card stat"><span>Fees Collected</span><strong>'+money(s.fees)+'</strong></article>'+
      '<article class="card stat"><span>Other Income</span><strong>'+money(s.otherIncome)+'</strong></article>'+
      '<article class="card stat"><span>Salaries Paid</span><strong>'+money(s.payroll)+'</strong></article>'+
      '<article class="card stat"><span>Other Expenses</span><strong>'+money(s.otherExpenses)+'</strong></article>'+
      '<article class="card stat"><span>Total Income</span><strong>'+money(income)+'</strong></article>'+
      '<article class="card stat"><span>Total Expense</span><strong>'+money(expenses)+'</strong></article>'+
      '<article class="card stat"><span>'+(net>=0?'Surplus':'Deficit')+'</span><strong>'+money(Math.abs(net))+'</strong></article>'+
      '</div>';
  }
  function entryRows(entries){
    return entries.length?entries.map(x=>
      '<div class="row"><strong>'+esc(x.category)+'</strong><span>'+esc(x.entryType)+'</span><span>'+money(x.amount)+'</span><span>'+esc(x.entryDate)+(x.reference?' · '+esc(x.reference):'')+'</span><span class="paper-actions"><button class="secondary" data-fin-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-fin-delete="'+esc(x.id)+'">Delete</button></span></div>'
    ).join(''):'<div class="muted">Is filter mein koi manual cashbook entry nahi hai.</div>';
  }
  function filterEntries(entries,root){
    const type=root.dataset.finType||'',cat=root.dataset.finCategory||'',q=(root.dataset.finSearch||'').trim().toLowerCase();
    return entries.filter(x=>(!type||x.entryType===type)&&(!cat||x.category===cat)&&(!q||[x.category,x.entryType,x.reference,x.note,x.entryDate].join(' ').toLowerCase().includes(q)));
  }
  function comparisonCard(month,current,previous){
    const cn=netOf(current),pn=netOf(previous),diff=cn-pn,pct=pn!==0?Math.round((diff/Math.abs(pn))*100):null;
    return '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Month Comparison</h3><p class="muted">'+esc(prevMonth(month))+' → '+esc(month)+'</p></div></div><div class="cards"><article class="card stat"><span>Previous Net</span><strong>'+money(pn)+'</strong></article><article class="card stat"><span>Current Net</span><strong>'+money(cn)+'</strong></article><article class="card stat"><span>Change</span><strong>'+money(diff)+'</strong></article><article class="card stat"><span>Change %</span><strong>'+(pct===null?'—':pct+'%')+'</strong></article></div></article>';
  }
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
  function exportCsv(month,summary){
    const rows=[['Date','Type','Category','Amount','Reference','Note'],...summary.entries.map(x=>[x.entryDate,x.entryType,x.category,x.amount,x.reference||'',x.note||''])];
    rows.push([],['Fees Collected','','',summary.fees],['Other Income','','',summary.otherIncome],['Salaries Paid','','',summary.payroll],['Other Expenses','','',summary.otherExpenses],['Net','','',netOf(summary)]);
    const blob=new Blob([rows.map(r=>r.map(csvCell).join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='EduNizam-Finance-'+month+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function categoryBreakdown(entries){
    const map={};
    entries.forEach(x=>{const key=x.entryType+' · '+x.category;map[key]=(map[key]||0)+Number(x.amount||0)});
    const rows=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    return rows.length?rows.map(([k,v])=>'<div class="row"><strong>'+esc(k)+'</strong><span>'+money(v)+'</span><span></span><span></span><span></span></div>').join(''):'<div class="muted">No manual categories for this month.</div>';
  }
  async function save(){
    const btn=$('finSave');if(financeSaveInFlight||btn?.disabled)return;
    const entryType=$('finType')?.value,category=$('finCategory')?.value,amount=Number($('finAmount')?.value||0),entryDate=$('finDate')?.value,reference=$('finReference')?.value.trim()||'',note=$('finNote')?.value.trim()||'';
    if(!entryType||!category||amount<=0||!entryDate)return alert('Type, category, valid amount aur date required hain.');
    financeSaveInFlight=true;setBusy(btn,true,editingId?'Updating...':'Saving...');
    try{
      const rows=read(),existing=rows.find(x=>String(x.id)===String(editingId));
      let item={id:editingId||String(Date.now()),entryType,category,amount,entryDate,reference,note,createdAt:existing?.createdAt||new Date().toISOString()};
      try{const saved=editingId?await updateCloud(item):await insertCloud(item);if(saved)item=saved}catch(e){if(cloudReady())return alert('Cloud finance entry failed: '+(e.message||e))}
      if(editingId){const i=rows.findIndex(x=>String(x.id)===String(editingId));if(i>=0)rows[i]=item;else rows.unshift(item)}
      else rows.unshift(item);
      write(rows);editingId='';await render();
    }finally{
      financeSaveInFlight=false;if(btn?.isConnected)setBusy(btn,false);
    }
  }
  function edit(id){const x=read().find(v=>String(v.id)===String(id));if(!x)return;editingId=String(id);render();setTimeout(()=>$('finAmount')?.scrollIntoView({behavior:'smooth',block:'center'}),0)}
  function cancelEdit(){editingId='';render()}
  async function remove(id,btn){
    const key=String(id||'');if(financeDeleteInFlight.has(key)||btn?.disabled)return;
    if(!confirm('Delete this cashbook entry?'))return;
    financeDeleteInFlight.add(key);setBusy(btn,true,'Deleting...');
    try{
      try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
      write(read().filter(x=>String(x.id)!==String(id)));if(String(editingId)===String(id))editingId='';await render();
    }finally{
      financeDeleteInFlight.delete(key);if(btn?.isConnected)setBusy(btn,false);
    }
  }
  function printStatement(month,s){
    const st=settings(),income=s.fees+s.otherIncome,expenses=s.payroll+s.otherExpenses,net=income-expenses;
    const w=window.open('','_blank','width=900,height=720');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Monthly Finance Statement</title><style>body{font-family:Arial;padding:32px;color:#17324a}.sheet{max-width:820px;margin:auto}.head{text-align:center}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:24px 0}.box{border:1px solid #ccc;border-radius:10px;padding:12px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.total{font-size:20px;font-weight:700}.muted{color:#667}</style></head><body><div class="sheet"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Monthly Finance Statement</h3><p class="muted">'+esc(month)+'</p></div><div class="grid"><div class="box"><strong>Fees Collected</strong><div>'+money(s.fees)+'</div></div><div class="box"><strong>Other Income</strong><div>'+money(s.otherIncome)+'</div></div><div class="box"><strong>Salaries Paid</strong><div>'+money(s.payroll)+'</div></div><div class="box"><strong>Other Expenses</strong><div>'+money(s.otherExpenses)+'</div></div></div><div class="row total"><span>Total Income</span><strong>'+money(income)+'</strong></div><div class="row total"><span>Total Expense</span><strong>'+money(expenses)+'</strong></div><div class="row total"><span>'+(net>=0?'Surplus':'Deficit')+'</span><strong>'+money(Math.abs(net))+'</strong></div><h3 style="margin-top:30px">Cashbook Entries</h3>'+s.entries.map(x=>'<div class="row"><span>'+esc(x.entryDate)+' · '+esc(x.category)+' · '+esc(x.entryType)+'</span><strong>'+money(x.amount)+'</strong></div>').join('')+'</div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(summary,month,root){
    $('finSave')?.addEventListener('click',save);
    $('finCancelEdit')?.addEventListener('click',cancelEdit);
    $('finMonth')?.addEventListener('change',render);
    $('finPrint')?.addEventListener('click',()=>printStatement(month,summary));
    $('finExport')?.addEventListener('click',()=>exportCsv(month,summary));
    $('finFilterType')?.addEventListener('change',e=>{root.dataset.finType=e.target.value;render()});
    $('finFilterCategory')?.addEventListener('change',e=>{root.dataset.finCategory=e.target.value;render()});
    $('finSearch')?.addEventListener('input',e=>{root.dataset.finSearch=e.target.value;clearTimeout(bind.timer);bind.timer=setTimeout(render,160)});
    $('finClear')?.addEventListener('click',()=>{root.dataset.finType='';root.dataset.finCategory='';root.dataset.finSearch='';render()});
    document.querySelectorAll('[data-fin-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.finEdit));
    document.querySelectorAll('[data-fin-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.finDelete,b));
  }
  async function render(){
    const root=$('financeCenterApp');if(!root)return;
    if(!isHead()){root.innerHTML='<div class="empty-state">Finance Center sirf Head of Institute ke liye available hai.</div>';return}
    const month=$('finMonth')?.value||root.dataset.month||monthKey();root.dataset.month=month;
    root.innerHTML='<div class="coverage-note">Finance data loading...</div>';
    try{
      const summary=cloudReady()?await cloudSummary(month):localSummary(month);
      const previous=cloudReady()?await cloudSummary(prevMonth(month)):localSummary(prevMonth(month));
      const categories=[...new Set(summary.entries.map(x=>x.category).filter(Boolean))].sort(),filtered=filterEntries(summary.entries,root);
      root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><div class="quick-actions"><input id="finMonth" type="month" value="'+esc(month)+'"><button id="finExport" class="secondary">Export CSV</button><button id="finPrint" class="secondary">Print Statement</button></div></div>'+
        metricCards(summary)+comparisonCard(month,summary,previous)+
        '<div style="margin-top:16px">'+editor()+'</div>'+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Cashbook</h3><p class="muted">'+filtered.length+' of '+summary.entries.length+' manual entries shown.</p></div><button id="finClear" class="secondary">Clear Filters</button></div><div class="form-grid"><select id="finFilterType"><option value="">All Types</option><option value="Income" '+((root.dataset.finType||'')==='Income'?'selected':'')+'>Income</option><option value="Expense" '+((root.dataset.finType||'')==='Expense'?'selected':'')+'>Expense</option></select><select id="finFilterCategory"><option value="">All Categories</option>'+categories.map(v=>'<option value="'+esc(v)+'" '+((root.dataset.finCategory||'')===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><input id="finSearch" type="search" value="'+esc(root.dataset.finSearch||'')+'" placeholder="Search reference, note or category"></div><div class="list" style="margin-top:12px">'+entryRows(filtered)+'</div></article>'+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Category Breakdown</h3><p class="muted">Manual entries grouped by category.</p></div></div><div class="list">'+categoryBreakdown(summary.entries)+'</div></article>';
      bind(summary,month,root);
    }catch(e){root.innerHTML='<div class="empty-state">Finance Center error: '+esc(e.message||e)+'</div>'}
  }
  window.addEventListener('edunizam:auth',()=>render());
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_FINANCE_CENTER={render,read,cloudReady};
})();