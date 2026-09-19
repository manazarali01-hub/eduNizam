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
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const monthKey=()=>today().slice(0,7);
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function localFees(){try{return JSON.parse(localStorage.getItem('edunizam_fees')||'[]')}catch{return[]}}
  function localPayroll(){try{return JSON.parse(localStorage.getItem('edunizam_staff_payroll_v1')||'[]')}catch{return[]}}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function money(v){return 'Rs '+Number(v||0).toLocaleString('en-PK')}
  function nextMonth(month){
    const [y,m]=month.split('-').map(Number),d=new Date(y,m,1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
  }
  function monthBounds(month){return {start:month+'-01',end:nextMonth(month)}}
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
    const [fees,payroll,entries]=await Promise.all([
      c.from('fee_records').select('amount,fee_date,status').eq('institution_id',id).eq('status','Paid').gte('fee_date',start).lt('fee_date',end),
      c.from('staff_payroll_records').select('net_salary,paid_at,status').eq('institution_id',id).eq('status','Paid').gte('paid_at',start+'T00:00:00').lt('paid_at',end+'T00:00:00'),
      c.from('school_finance_entries').select('*').eq('institution_id',id).gte('entry_date',start).lt('entry_date',end).order('entry_date',{ascending:false})
    ]);
    for(const r of [fees,payroll,entries])if(r.error)throw r.error;
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
    const {data,error}=await cloud().state.client.from('school_finance_entries').insert({
      institution_id:cfg().institutionId,entry_type:item.entryType,category:item.category,amount:item.amount,
      entry_date:item.entryDate,reference:item.reference||null,note:item.note||null,created_by:cloud().state.user.id
    }).select().single();
    if(error)throw error;
    return {id:data.id,entryType:data.entry_type,category:data.category,amount:Number(data.amount||0),entryDate:data.entry_date,reference:data.reference||'',note:data.note||'',createdAt:data.created_at};
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('school_finance_entries').delete().eq('id',id);if(error)throw error;
  }
  function editor(){
    return '<article class="card"><h3>Add Other Income / Expense</h3><p class="muted">Fee income aur paid salaries automatically summary mein count hote hain; unhein yahan dobara enter na karein.</p><div class="form-grid">'+
      '<select id="finType"><option>Expense</option><option>Income</option></select>'+
      '<select id="finCategory"><option>Utilities</option><option>Rent</option><option>Maintenance</option><option>Supplies</option><option>Transport</option><option>Marketing</option><option>Donation</option><option>Other Income</option><option>Miscellaneous</option></select>'+
      '<input id="finAmount" type="number" min="0.01" step="0.01" placeholder="Amount">'+
      '<input id="finDate" type="date" value="'+today()+'">'+
      '<input id="finReference" placeholder="Reference / voucher no. (optional)">'+
      '<input id="finNote" placeholder="Note (optional)">'+
      '<button id="finSave">Save Entry</button>'+
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
      '<div class="row"><strong>'+esc(x.category)+'</strong><span>'+esc(x.entryType)+'</span><span>'+money(x.amount)+'</span><span>'+esc(x.entryDate)+'</span><button class="secondary" data-fin-delete="'+esc(x.id)+'">Delete</button></div>'
    ).join(''):'<div class="muted">Is month mein koi manual cashbook entry nahi hai.</div>';
  }
  function categoryBreakdown(entries){
    const map={};
    entries.forEach(x=>{const key=x.entryType+' · '+x.category;map[key]=(map[key]||0)+Number(x.amount||0)});
    const rows=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    return rows.length?rows.map(([k,v])=>'<div class="row"><strong>'+esc(k)+'</strong><span>'+money(v)+'</span><span></span><span></span><span></span></div>').join(''):'<div class="muted">No manual categories for this month.</div>';
  }
  async function save(){
    const entryType=$('finType')?.value,category=$('finCategory')?.value,amount=Number($('finAmount')?.value||0),entryDate=$('finDate')?.value,reference=$('finReference')?.value.trim()||'',note=$('finNote')?.value.trim()||'';
    if(!entryType||!category||amount<=0||!entryDate)return alert('Type, category, valid amount aur date required hain.');
    let item={id:String(Date.now()),entryType,category,amount,entryDate,reference,note,createdAt:new Date().toISOString()};
    try{const c=await insertCloud(item);if(c)item=c}catch(e){if(cloudReady())return alert('Cloud finance entry failed: '+(e.message||e))}
    const rows=read();rows.unshift(item);write(rows);await render();
  }
  async function remove(id){
    if(!confirm('Delete this cashbook entry?'))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(x=>String(x.id)!==String(id)));await render();
  }
  function printStatement(month,s){
    const st=settings(),income=s.fees+s.otherIncome,expenses=s.payroll+s.otherExpenses,net=income-expenses;
    const w=window.open('','_blank','width=900,height=720');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Monthly Finance Statement</title><style>body{font-family:Arial;padding:32px;color:#17324a}.sheet{max-width:820px;margin:auto}.head{text-align:center}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:24px 0}.box{border:1px solid #ccc;border-radius:10px;padding:12px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.total{font-size:20px;font-weight:700}.muted{color:#667}</style></head><body><div class="sheet"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Monthly Finance Statement</h3><p class="muted">'+esc(month)+'</p></div><div class="grid"><div class="box"><strong>Fees Collected</strong><div>'+money(s.fees)+'</div></div><div class="box"><strong>Other Income</strong><div>'+money(s.otherIncome)+'</div></div><div class="box"><strong>Salaries Paid</strong><div>'+money(s.payroll)+'</div></div><div class="box"><strong>Other Expenses</strong><div>'+money(s.otherExpenses)+'</div></div></div><div class="row total"><span>Total Income</span><strong>'+money(income)+'</strong></div><div class="row total"><span>Total Expense</span><strong>'+money(expenses)+'</strong></div><div class="row total"><span>'+(net>=0?'Surplus':'Deficit')+'</span><strong>'+money(Math.abs(net))+'</strong></div><h3 style="margin-top:30px">Cashbook Entries</h3>'+s.entries.map(x=>'<div class="row"><span>'+esc(x.entryDate)+' · '+esc(x.category)+' · '+esc(x.entryType)+'</span><strong>'+money(x.amount)+'</strong></div>').join('')+'</div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(summary,month){
    $('finSave')?.addEventListener('click',save);
    $('finMonth')?.addEventListener('change',render);
    $('finPrint')?.addEventListener('click',()=>printStatement(month,summary));
    document.querySelectorAll('[data-fin-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.finDelete));
  }
  async function render(){
    const root=$('financeCenterApp');if(!root)return;
    if(!isHead()){root.innerHTML='<div class="empty-state">Finance Center sirf Head of Institute ke liye available hai.</div>';return}
    const month=$('finMonth')?.value||root.dataset.month||monthKey();root.dataset.month=month;
    root.innerHTML='<div class="coverage-note">Finance data loading...</div>';
    try{
      const summary=cloudReady()?await cloudSummary(month):localSummary(month);
      root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><div class="quick-actions"><input id="finMonth" type="month" value="'+esc(month)+'"><button id="finPrint" class="secondary">Print Statement</button></div></div>'+
        metricCards(summary)+
        '<div style="margin-top:16px">'+editor()+'</div>'+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Cashbook</h3><p class="muted">Manual other income and expense entries.</p></div></div><div class="list">'+entryRows(summary.entries)+'</div></article>'+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Category Breakdown</h3><p class="muted">Manual entries grouped by category.</p></div></div><div class="list">'+categoryBreakdown(summary.entries)+'</div></article>';
      bind(summary,month);
    }catch(e){root.innerHTML='<div class="empty-state">Finance Center error: '+esc(e.message||e)+'</div>'}
  }
  window.addEventListener('edunizam:auth',()=>render());
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_FINANCE_CENTER={render,read,cloudReady};
})();