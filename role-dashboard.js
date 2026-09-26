(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const role=()=>window.EDUNIZAM_ROLE_SCOPE?.role?.()||'student';
  function ensure(){
    const dashboard=document.getElementById('dashboard');if(!dashboard)return;
    if(!document.getElementById('adminDailyDesk')){
      const desk=document.createElement('section');desk.id='adminDailyDesk';desk.className='card admin-daily-desk';desk.style.marginBottom='18px';dashboard.prepend(desk);
    }
    if(!document.getElementById('familyDashboard')){
      const box=document.createElement('section');box.id='familyDashboard';box.className='card';box.style.marginBottom='18px';dashboard.prepend(box);
    }
  }
  function localDateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}
  function jump(view){
    const nav=document.querySelector('[data-view="'+view+'"]');
    if(nav){nav.click();return}
    if(view==='access')window.EDUNIZAM_ROLE_ACCESS?.show?.();
  }
  function renderAdminDesk(){
    const desk=document.getElementById('adminDailyDesk');if(!desk)return;
    if(role()!=='head'){desk.style.display='none';return}
    desk.style.display='block';
    const students=read('edunizam_students',[]);
    const attendance=read('edunizam_attendance',{}),day=attendance[localDateKey()]||{};
    const marked=students.filter(s=>day[s.id]||day[String(s.id)]).length;
    const present=students.filter(s=>(day[s.id]||day[String(s.id)])==='Present').length;
    const fees=read('edunizam_fees',[]);
    const pending=fees.filter(x=>x.status==='Pending').reduce((a,x)=>a+Number(x.amount||0),0);
    desk.innerHTML='<div class="section-head"><div><div class="academic-kicker">Admin Daily Desk</div><h2>Today\'s School Work</h2><p class="muted">Rozana ke important kaam 1–2 taps mein.</p></div><span class="badge">'+marked+'/'+students.length+' attendance marked</span></div>'+
      '<div class="admin-daily-stats"><div><span>Students</span><strong>'+students.length+'</strong></div><div><span>Present Today</span><strong>'+present+'</strong></div><div><span>Pending Fees</span><strong>Rs '+pending.toLocaleString()+'</strong></div></div>'+
      '<div class="admin-daily-actions">'+
      [['students','👨‍🎓','Students','Add / manage'],['attendance','✓','Attendance','Mark today'],['fees','₨','Fees','Collect / pending'],['staffcenter','👩‍🏫','Staff','Teachers & staff'],['access','🔐','Approvals','Teacher / Parent / Student'],['noticeboard','📌','Notices','Post updates'],['schedulecenter','🕒','Timetable','Classes & dates'],['inboxcenter','💬','Messages','School inbox']]
      .map(x=>'<button type="button" data-admin-jump="'+x[0]+'"><span>'+x[1]+'</span><strong>'+x[2]+'</strong><small>'+x[3]+'</small></button>').join('')+
      '</div><div class="coverage-note">Less-used tools sidebar ke grouped menu mein available hain.</div>';
    desk.querySelectorAll('[data-admin-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.adminJump));
    const genericQuick=document.querySelector('#dashboard .grid-2 > .card:first-child');
    if(genericQuick)genericQuick.style.display='none';
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
    ensure();renderAdminDesk();const box=document.getElementById('familyDashboard');if(!box)return;
    const r=role();
    const genericQuick=document.querySelector('#dashboard .grid-2 > .card:first-child');
    if(r!=='head'&&genericQuick)genericQuick.style.display='';
    if(!['parent','student','teacher'].includes(r)){box.style.display='none';return}
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
  window.EDUNIZAM_ADMIN_DASHBOARD={render:renderAdminDesk};
})();