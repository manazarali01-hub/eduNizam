(function(){
  const ATT_KEY='edunizam_staff_attendance_v1';
  const SAL_KEY='edunizam_staff_salary_v1';
  const PAY_KEY='edunizam_staff_payroll_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'').trim().toLowerCase();
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const monthKey=()=>today().slice(0,7);
  function readKey(k,f=[]){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}}
  function writeKey(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function staff(){return readKey('edunizam_staff_profiles_v1',[])}
  function attendance(){return readKey(ATT_KEY,[])}
  function salaries(){return readKey(SAL_KEY,[])}
  function payrolls(){return readKey(PAY_KEY,[])}
  function visibleStaff(){
    const rows=staff();
    if(isHead())return rows;
    const id=identity();
    return rows.filter(x=>[x.staffCode,x.phone,x.fullName].some(v=>String(v||'').trim().toLowerCase()===id)||String(x.userId||'')===String(cloud()?.state?.user?.id||''));
  }
  function money(v){return 'Rs '+Number(v||0).toLocaleString('en-PK')}
  function monthDate(m){return /^\d{4}-\d{2}$/.test(m)?m+'-01':null}
  function monthFromDate(d){return String(d||'').slice(0,7)}
  function salaryFor(staffId){return salaries().find(x=>String(x.staffId)===String(staffId))||null}
  function monthAttendance(staffId,month){
    const rows=attendance().filter(x=>String(x.staffId)===String(staffId)&&String(x.date).startsWith(month));
    const c={Present:0,Absent:0,Leave:0,'Half Day':0};
    rows.forEach(x=>{if(c[x.status]!==undefined)c[x.status]++});
    return {rows,counts:c};
  }
  function calc(staffId,month,extraAllowance=0,otherDeductions=0){
    const s=salaryFor(staffId),base=Number(s?.baseSalary||0),defaultAllowance=Number(s?.defaultAllowance||0);
    const a=monthAttendance(staffId,month).counts;
    const daily=base/30;
    const attendanceDeduction=Math.round((a.Absent+(a['Half Day']*0.5))*daily);
    const allowances=defaultAllowance+Number(extraAllowance||0);
    const deductions=attendanceDeduction+Number(otherDeductions||0);
    return {base,defaultAllowance,allowances,attendanceDeduction,otherDeductions:Number(otherDeductions||0),net:Math.max(0,base+allowances-deductions),counts:a};
  }

  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId;
    const [a,s,p]=await Promise.all([
      c.from('staff_attendance_records').select('*,staff_profiles(full_name,staff_code,user_id)').eq('institution_id',id).order('attendance_date',{ascending:false}),
      c.from('staff_salary_profiles').select('*').eq('institution_id',id),
      c.from('staff_payroll_records').select('*,staff_profiles(full_name,staff_code,user_id)').eq('institution_id',id).order('payroll_month',{ascending:false})
    ]);
    for(const r of [a,s,p])if(r.error)throw r.error;
    writeKey(ATT_KEY,(a.data||[]).map(x=>({id:x.id,staffId:x.staff_profile_id,date:x.attendance_date,status:x.status,note:x.note||'',staffName:x.staff_profiles?.full_name||''})));
    writeKey(SAL_KEY,(s.data||[]).map(x=>({id:x.id,staffId:x.staff_profile_id,baseSalary:Number(x.base_salary||0),defaultAllowance:Number(x.default_allowance||0)})));
    writeKey(PAY_KEY,(p.data||[]).map(x=>({id:x.id,staffId:x.staff_profile_id,staffName:x.staff_profiles?.full_name||'',month:String(x.payroll_month).slice(0,7),baseSalary:Number(x.base_salary||0),allowances:Number(x.allowances||0),attendanceDeduction:Number(x.attendance_deduction||0),otherDeductions:Number(x.other_deductions||0),netSalary:Number(x.net_salary||0),status:x.status,paymentReference:x.payment_reference||'',paidAt:x.paid_at||'',createdAt:x.created_at})));
  }

  async function saveAttendanceCloud(rows){
    if(!cloudReady())return;
    const c=cloud();
    const payload=rows.map(x=>({institution_id:cfg().institutionId,staff_profile_id:x.staffId,attendance_date:x.date,status:x.status,note:x.note||null,marked_by:c.state.user.id,updated_at:new Date().toISOString()}));
    const {error}=await c.state.client.from('staff_attendance_records').upsert(payload,{onConflict:'staff_profile_id,attendance_date'});
    if(error)throw error;
  }
  async function saveSalaryCloud(item){
    if(!cloudReady())return null;
    const c=cloud();
    const {data,error}=await c.state.client.from('staff_salary_profiles').upsert({
      institution_id:cfg().institutionId,staff_profile_id:item.staffId,base_salary:item.baseSalary,default_allowance:item.defaultAllowance,updated_by:c.state.user.id,updated_at:new Date().toISOString()
    },{onConflict:'staff_profile_id'}).select().single();
    if(error)throw error;return data;
  }
  async function savePayrollCloud(item){
    if(!cloudReady())return null;
    const c=cloud();
    const payload={institution_id:cfg().institutionId,staff_profile_id:item.staffId,payroll_month:monthDate(item.month),base_salary:item.baseSalary,allowances:item.allowances,attendance_deduction:item.attendanceDeduction,other_deductions:item.otherDeductions,net_salary:item.netSalary,status:item.status,payment_reference:item.paymentReference||null,paid_at:item.paidAt||null,created_by:c.state.user.id,updated_at:new Date().toISOString()};
    const {data,error}=await c.state.client.from('staff_payroll_records').upsert(payload,{onConflict:'staff_profile_id,payroll_month'}).select().single();
    if(error)throw error;return data;
  }

  function attendanceEditor(){
    if(!isHead())return '';
    const rows=visibleStaff().filter(x=>x.status!=='inactive');
    return '<article class="card"><div class="section-head"><div><h3>Daily Staff Attendance</h3><p class="muted">Present, Absent, Leave ya Half Day mark karein.</p></div></div>'+
      '<input id="spaDate" type="date" value="'+today()+'" style="margin-bottom:12px">'+
      '<div id="spaAttendanceRows">'+rows.map(x=>'<div class="row"><strong>'+esc(x.fullName)+'</strong><span>'+esc(x.designation||'Staff')+'</span><select data-spa-status="'+esc(x.id)+'"><option>Present</option><option>Absent</option><option>Leave</option><option>Half Day</option></select><input data-spa-note="'+esc(x.id)+'" placeholder="Note (optional)"><span></span></div>').join('')+'</div>'+
      '<div class="quick-actions" style="margin-top:12px"><button id="spaSaveAttendance">Save Attendance</button></div></article>';
  }
  function salaryEditor(){
    if(!isHead())return '';
    const rows=visibleStaff();
    return '<article class="card" style="margin-top:16px"><h3>Salary Setup</h3><div class="form-grid">'+
      '<select id="spaSalaryStaff"><option value="">Select staff</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.fullName)+'</option>').join('')+'</select>'+
      '<input id="spaBaseSalary" type="number" min="0" placeholder="Monthly base salary">'+
      '<input id="spaDefaultAllowance" type="number" min="0" value="0" placeholder="Default monthly allowance">'+
      '<button id="spaSaveSalary">Save Salary Setup</button></div></article>';
  }
  function payrollEditor(){
    if(!isHead())return '';
    const rows=visibleStaff();
    return '<article class="card" style="margin-top:16px"><h3>Generate Monthly Payroll</h3><div class="form-grid">'+
      '<select id="spaPayrollStaff"><option value="">Select staff</option>'+rows.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.fullName)+'</option>').join('')+'</select>'+
      '<input id="spaPayrollMonth" type="month" value="'+monthKey()+'">'+
      '<input id="spaExtraAllowance" type="number" min="0" value="0" placeholder="Extra allowance">'+
      '<input id="spaOtherDeduction" type="number" min="0" value="0" placeholder="Other deduction">'+
      '<button id="spaGeneratePayroll">Generate / Update Payroll</button></div><div id="spaPayrollPreview" class="coverage-note"></div></article>';
  }
  function summaryCard(){
    const vs=visibleStaff();if(!vs.length)return '';
    const m=monthKey(),ids=new Set(vs.map(x=>String(x.id)));
    const att=attendance().filter(x=>ids.has(String(x.staffId))&&String(x.date).startsWith(m));
    const paid=payrolls().filter(x=>ids.has(String(x.staffId))&&x.month===m&&x.status==='Paid').reduce((a,x)=>a+Number(x.netSalary||0),0);
    return '<div class="cards"><article class="card stat"><span>Staff</span><strong>'+vs.length+'</strong></article><article class="card stat"><span>Attendance Marks</span><strong>'+att.length+'</strong></article><article class="card stat"><span>Absent This Month</span><strong>'+att.filter(x=>x.status==='Absent').length+'</strong></article><article class="card stat"><span>Salary Paid</span><strong>'+money(paid)+'</strong></article></div>';
  }
  function payrollCard(x){
    const st=staff().find(s=>String(s.id)===String(x.staffId));const name=x.staffName||st?.fullName||'Staff';
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.month)+'</span><span class="badge">'+esc(x.status)+'</span></div><h3>'+esc(name)+'</h3>'+
      '<p>Base '+money(x.baseSalary)+' · Allowances '+money(x.allowances)+'</p><p>Attendance Deduction '+money(x.attendanceDeduction)+' · Other '+money(x.otherDeductions)+'</p>'+
      '<p><strong>Net Salary: '+money(x.netSalary)+'</strong></p>'+
      '<div class="paper-actions"><button class="secondary" data-spa-print="'+esc(x.id)+'">Print Payslip</button>'+(isHead()&&x.status!=='Paid'?'<button data-spa-paid="'+esc(x.id)+'">Mark Paid</button>':'')+'</div></article>';
  }
  function attendanceSummary(){
    const vs=visibleStaff(),m=$('spaViewMonth')?.value||monthKey();
    return vs.map(s=>{const c=monthAttendance(s.id,m).counts;return '<div class="row"><strong>'+esc(s.fullName)+'</strong><span>P '+c.Present+'</span><span>A '+c.Absent+'</span><span>L '+c.Leave+'</span><span>½ '+c['Half Day']+'</span></div>'}).join('')||'<div class="muted">No staff profile linked.</div>';
  }
  async function saveAttendance(){
    const date=$('spaDate')?.value;if(!date)return;
    let all=attendance(),newRows=[];
    document.querySelectorAll('[data-spa-status]').forEach(sel=>{
      const staffId=sel.dataset.spaStatus,note=document.querySelector('[data-spa-note="'+CSS.escape(staffId)+'"]')?.value||'';
      newRows.push({id:staffId+'-'+date,staffId,date,status:sel.value,note});
    });
    try{await saveAttendanceCloud(newRows)}catch(e){if(cloudReady())return alert('Cloud attendance save failed: '+(e.message||e))}
    const keys=new Set(newRows.map(x=>String(x.staffId)+'|'+x.date));all=all.filter(x=>!keys.has(String(x.staffId)+'|'+x.date)).concat(newRows);writeKey(ATT_KEY,all);render();
  }
  async function saveSalary(){
    const staffId=$('spaSalaryStaff')?.value,baseSalary=Number($('spaBaseSalary')?.value||0),defaultAllowance=Number($('spaDefaultAllowance')?.value||0);
    if(!staffId||baseSalary<=0)return alert('Staff aur valid base salary enter karein.');
    let item={id:staffId,staffId,baseSalary,defaultAllowance};
    try{const r=await saveSalaryCloud(item);if(r)item={id:r.id,staffId:r.staff_profile_id,baseSalary:Number(r.base_salary||0),defaultAllowance:Number(r.default_allowance||0)}}catch(e){if(cloudReady())return alert('Cloud salary save failed: '+(e.message||e))}
    let arr=salaries().filter(x=>String(x.staffId)!==String(staffId));arr.push(item);writeKey(SAL_KEY,arr);render();
  }
  function preview(){
    const staffId=$('spaPayrollStaff')?.value,month=$('spaPayrollMonth')?.value;if(!staffId||!month)return;
    const c=calc(staffId,month,$('spaExtraAllowance')?.value,$('spaOtherDeduction')?.value),box=$('spaPayrollPreview');
    if(box)box.textContent='Base '+money(c.base)+' + Allowance '+money(c.allowances)+' - Attendance '+money(c.attendanceDeduction)+' - Other '+money(c.otherDeductions)+' = Net '+money(c.net);
  }
  async function generatePayroll(){
    const staffId=$('spaPayrollStaff')?.value,month=$('spaPayrollMonth')?.value;if(!staffId||!month)return alert('Staff aur payroll month select karein.');
    const sal=salaryFor(staffId);if(!sal||Number(sal.baseSalary)<=0)return alert('Pehle staff salary setup save karein.');
    const c=calc(staffId,month,$('spaExtraAllowance')?.value,$('spaOtherDeduction')?.value),st=staff().find(x=>String(x.id)===String(staffId));
    let old=payrolls().find(x=>String(x.staffId)===String(staffId)&&x.month===month);
    let item={id:old?.id||String(Date.now()),staffId,staffName:st?.fullName||'',month,baseSalary:c.base,allowances:c.allowances,attendanceDeduction:c.attendanceDeduction,otherDeductions:c.otherDeductions,netSalary:c.net,status:old?.status||'Draft',paymentReference:old?.paymentReference||'',paidAt:old?.paidAt||'',createdAt:old?.createdAt||new Date().toISOString()};
    try{const r=await savePayrollCloud(item);if(r)item.id=r.id}catch(e){if(cloudReady())return alert('Cloud payroll save failed: '+(e.message||e))}
    let arr=payrolls().filter(x=>!(String(x.staffId)===String(staffId)&&x.month===month));arr.unshift(item);writeKey(PAY_KEY,arr);render();
  }
  async function markPaid(id){
    let arr=payrolls(),item=arr.find(x=>String(x.id)===String(id));if(!item||!isHead())return;
    item.status='Paid';item.paymentReference=prompt('Payment reference (optional):',item.paymentReference||'')||'';item.paidAt=new Date().toISOString();
    try{const r=await savePayrollCloud(item);if(r)item.id=r.id}catch(e){if(cloudReady())return alert('Cloud payroll update failed: '+(e.message||e))}
    arr=arr.map(x=>String(x.id)===String(id)?item:x);writeKey(PAY_KEY,arr);render();
  }
  function printPayslip(item){
    const st=staff().find(s=>String(s.id)===String(item.staffId)),settings=readKey('edunizam_settings',{});
    const w=window.open('','_blank','width=800,height=700');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Salary Payslip</title><style>body{font-family:Arial;padding:30px;color:#17324a}.box{max-width:700px;margin:auto;border:1px solid #ccc;border-radius:14px;padding:20px}.row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #eee}.total{font-size:22px;font-weight:700}.head{text-align:center}.muted{color:#667}</style></head><body><div class="box"><div class="head"><h2>'+esc(settings.schoolName||'EduNizam Institute')+'</h2><h3>Salary Payslip</h3><p class="muted">'+esc(item.month)+'</p></div><div class="row"><span>Staff</span><strong>'+esc(st?.fullName||item.staffName||'Staff')+'</strong></div><div class="row"><span>Designation</span><strong>'+esc(st?.designation||'-')+'</strong></div><div class="row"><span>Base Salary</span><strong>'+money(item.baseSalary)+'</strong></div><div class="row"><span>Allowances</span><strong>'+money(item.allowances)+'</strong></div><div class="row"><span>Attendance Deduction</span><strong>'+money(item.attendanceDeduction)+'</strong></div><div class="row"><span>Other Deductions</span><strong>'+money(item.otherDeductions)+'</strong></div><div class="row total"><span>Net Salary</span><strong>'+money(item.netSalary)+'</strong></div><div class="row"><span>Status</span><strong>'+esc(item.status)+'</strong></div><div class="row"><span>Payment Reference</span><strong>'+esc(item.paymentReference||'-')+'</strong></div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bind(){
    $('spaSaveAttendance')?.addEventListener('click',saveAttendance);
    $('spaSaveSalary')?.addEventListener('click',saveSalary);
    $('spaGeneratePayroll')?.addEventListener('click',generatePayroll);
    ['spaPayrollStaff','spaPayrollMonth','spaExtraAllowance','spaOtherDeduction'].forEach(id=>$(id)?.addEventListener('change',preview));
    $('spaViewMonth')?.addEventListener('change',()=>{const b=$('spaAttendanceSummary');if(b)b.innerHTML=attendanceSummary()});
    document.querySelectorAll('[data-spa-paid]').forEach(b=>b.onclick=()=>markPaid(b.dataset.spaPaid));
    document.querySelectorAll('[data-spa-print]').forEach(b=>b.onclick=()=>{const x=payrolls().find(p=>String(p.id)===String(b.dataset.spaPrint));if(x)printPayslip(x)});
  }
  async function render(){
    const root=$('staffPayrollApp');if(!root)return;
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Staff payroll cloud sync:',e.message)}}
    const ids=new Set(visibleStaff().map(x=>String(x.id))),visiblePayroll=payrolls().filter(x=>ids.has(String(x.staffId)));
    root.innerHTML='<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+summaryCard()+attendanceEditor()+salaryEditor()+payrollEditor()+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Attendance Summary</h3><p class="muted">Monthly staff attendance counts.</p></div><input id="spaViewMonth" type="month" value="'+monthKey()+'"></div><div id="spaAttendanceSummary" class="list">'+attendanceSummary()+'</div></article>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Payslips</h3><p class="muted">Monthly salary records.</p></div></div><div class="paper-grid">'+(visiblePayroll.length?visiblePayroll.map(payrollCard).join(''):'<div class="empty-state">Abhi koi payroll record nahi hai.</div>')+'</div>';
    bind();preview();
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('staffPayrollApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_STAFF_PAYROLL={render,pullCloud,cloudReady};
})();