(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const role=()=>window.EDUNIZAM_ROLE_SCOPE?.role?.()||'student';
  function ensure(){
    const dashboard=document.getElementById('dashboard');if(!dashboard||document.getElementById('familyDashboard'))return;
    const box=document.createElement('section');box.id='familyDashboard';box.className='card';box.style.marginBottom='18px';
    dashboard.prepend(box);
  }
  function statsFor(s){
    const att=read('edunizam_attendance',{}),fees=read('edunizam_fees',[]),results=read('edunizam_results',[]);
    const days=Object.values(att).map(d=>d?.[s.id]).filter(Boolean);
    const present=days.filter(x=>x==='Present').length;
    const attPct=days.length?Math.round(present/days.length*100):0;
    const rs=results.filter(x=>x.studentId===s.id);
    const avg=rs.length?Math.round(rs.reduce((a,x)=>a+(Number(x.total)?Number(x.marks)/Number(x.total)*100:0),0)/rs.length):0;
    const pending=fees.filter(x=>x.studentId===s.id&&x.status==='Pending').reduce((a,x)=>a+Number(x.amount||0),0);
    return {attPct,avg,pending};
  }
  function render(){
    ensure();const box=document.getElementById('familyDashboard');if(!box)return;
    const r=role();if(!['parent','student','teacher'].includes(r)){box.style.display='none';return}
    box.style.display='block';
    const all=read('edunizam_students',[]);
    const list=window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(all)||[];
    const title=r==='parent'?'My Child Dashboard':r==='teacher'?'My Assigned Students':'My Academic Dashboard';
    const roleNote=r==='parent'
      ?'Sirf Admin-approved linked child/children ki attendance, results aur fee summary.'
      :r==='teacher'
        ?'Sirf Admin-assigned students. Unassigned students is dashboard par nazar nahi aayenge.'
        :'Sirf aap ka apna approved student record.';
    box.innerHTML='<div class="section-head"><div><h2>'+title+'</h2><p class="muted">'+roleNote+'</p></div><span class="badge">'+list.length+' record(s)</span></div>'+
      (list.length?'<div class="cards">'+list.map(s=>{const x=statsFor(s);return '<article class="card stat"><span>'+esc(s.className||'Student')+'</span><strong style="font-size:20px">'+esc(s.name)+'</strong><small>Attendance '+x.attPct+'% · Avg '+x.avg+'% · Pending Rs '+x.pending.toLocaleString()+'</small></article>'}).join('')+'</div>':'<div class="empty-state">'+(r==='student'?'Admin approval aur record link hone ke baad aap ki academic summary yahan nazar aayegi.':r==='parent'?'Admin approval aur child link hone ke baad child ki summary yahan nazar aayegi.':'Admin se student assignment hone ke baad assigned students yahan nazar aayenge.')+'</div>');
  }
  setTimeout(()=>{ensure();render()},300);
  window.addEventListener('storage',render);
  window.addEventListener('edunizam:auth',()=>setTimeout(render,100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  window.EDUNIZAM_PARENT_DASHBOARD={render};
})();