(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const role=()=>window.EDUNIZAM_ROLE_SCOPE?.role?.()||'student';
  const insights=()=>window.EDUNIZAM_STUDENT_INSIGHTS;
  function ensure(){
    const dashboard=document.getElementById('dashboard');if(!dashboard)return;
    let desk=document.getElementById('adminDailyDesk');
    let box=document.getElementById('familyDashboard');
    if(!desk){
      desk=document.createElement('section');
      desk.id='adminDailyDesk';
      desk.className='card admin-daily-desk';
      desk.style.marginBottom='18px';
    }
    if(!box){
      box=document.createElement('section');
      box.id='familyDashboard';
      box.className='card family-dashboard';
      box.style.marginBottom='18px';
    }
    const stats=dashboard.querySelector(':scope > .cards');
    if(stats){
      stats.insertAdjacentElement('afterend',desk);
      desk.insertAdjacentElement('afterend',box);
    }else{
      dashboard.append(desk,box);
    }
  }
  function localDateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}
  function jump(view){
    const nav=document.querySelector('[data-view="'+view+'"]');
    if(nav){nav.click();return}
    if(view==='access')window.EDUNIZAM_ROLE_ACCESS?.show?.();
  }
  function profileFor(s){
    const I=insights();
    if(I?.profile)return I.profile(s);
    const att=read('edunizam_attendance',{}),fees=read('edunizam_fees',[]),results=read('edunizam_results',[]);
    const days=Object.values(att).map(d=>d?.[s.id]??d?.[String(s.id)]).filter(Boolean);
    const present=days.filter(x=>x==='Present').length,late=days.filter(x=>x==='Late').length,absent=days.filter(x=>x==='Absent').length;
    const attendanceDenominator=present+late+absent,attPct=attendanceDenominator?Math.round(((present+late)/attendanceDenominator)*100):null;
    const rs=results.filter(x=>String(x.studentId)===String(s.id)),marks=rs.reduce((a,x)=>a+Number(x.marks||0),0),total=rs.reduce((a,x)=>a+Number(x.total||0),0);
    const avg=total?Math.round(marks/total*100):null;
    const pending=fees.filter(x=>String(x.studentId)===String(s.id)&&x.status!=='Paid').reduce((a,x)=>a+Number(x.amount||0),0);
    return {student:s,attendance:{percentage:attPct},results:{overall:avg},fees:{outstanding:pending,overdueRows:[],nextDue:null},assignments:{missing:[],dueSoon:[]},exams:{next:null,upcoming:[]},alerts:[]};
  }
  function money(v){return insights()?.money?.(v)||('Rs '+Number(v||0).toLocaleString())}

  function renderAdminDesk(){
    const desk=document.getElementById('adminDailyDesk');if(!desk)return;
    if(role()!=='head'){desk.style.display='none';return}
    desk.style.display='block';
    const students=read('edunizam_students',[]);
    const attendance=read('edunizam_attendance',{}),day=attendance[localDateKey()]||{};
    const marked=students.filter(s=>day[s.id]||day[String(s.id)]).length;
    const present=students.filter(s=>(day[s.id]||day[String(s.id)])==='Present').length;
    const profiles=students.map(profileFor);
    const pending=profiles.reduce((a,x)=>a+Number(x?.fees?.outstanding||0),0);
    const attention=profiles.filter(x=>(x?.alerts||[]).some(a=>a.level==='high'||a.level==='medium')).length;
    const exams=read('edunizam_exam_schedule_v1',[]),today=localDateKey(),in7=new Date();in7.setDate(in7.getDate()+7);
    const end=localDateKey(in7),upcoming=exams.filter(x=>x.examDate&&x.examDate>=today&&x.examDate<=end).length;
    const missing=profiles.reduce((a,x)=>a+Number(x?.assignments?.missing?.length||0),0);
    desk.innerHTML='<div class="section-head"><div><div class="academic-kicker">Admin Daily Desk</div><h2>Today\'s School Work</h2><p class="muted">Attendance, fees, exams aur academic follow-up ek operational snapshot mein.</p></div><span class="badge">'+marked+'/'+students.length+' attendance marked</span></div>'+
      '<div class="admin-daily-stats"><div><span>Present Today</span><strong>'+present+'</strong></div><div><span>Pending Fees</span><strong>'+esc(money(pending))+'</strong></div><div><span>Follow-up Students</span><strong>'+attention+'</strong></div><div><span>Exams ≤ 7 Days</span><strong>'+upcoming+'</strong></div><div><span>Missing Work</span><strong>'+missing+'</strong></div></div>'+
      '<div class="admin-daily-actions">'+
      [['students','👨‍🎓','Students','Add / manage'],['attendance','✓','Attendance','Mark today'],['attendanceanalytics','📊','Attendance Analytics','Follow-up'],['fees','₨','Fees','Collect / pending'],['examcenter','📝','Exams','Schedule / reports'],['results','📈','Results','Marks / analysis'],['schoolwork','📚','Assignments','Missing work'],['staffcenter','👩‍🏫','Staff','Teachers & staff'],['access','🔐','Approvals','Teacher / Parent / Student'],['noticeboard','📌','Notices','Post updates'],['inboxcenter','💬','Messages','School inbox']]
      .map(x=>'<button type="button" data-admin-jump="'+x[0]+'"><span>'+x[1]+'</span><strong>'+x[2]+'</strong><small>'+x[3]+'</small></button>').join('')+
      '</div><div class="coverage-note">Cross-module numbers use linked EduNizam attendance, result, fee, assignment and exam records.</div>';
    desk.querySelectorAll('[data-admin-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.adminJump));
    const genericQuick=document.querySelector('#dashboard .grid-2 > .card:first-child');
    if(genericQuick)genericQuick.style.display='none';
  }

  function renderRoleQuickActions(){
    const card=document.querySelector('#dashboard .grid-2 > .card:first-child');
    if(!card)return;
    const r=role();
    if(r==='head'){card.style.display='none';return}
    card.style.display='';
    const sets={
      teacher:[
        ['attendance','Attendance','Mark your class'],
        ['dailydiary','Daily Diary','Write today\'s diary'],
        ['paperbuilder','Paper Builder','Create a paper'],
        ['results','Results','Update marks'],
        ['lessoncenter','Lesson Plans','Plan teaching']
      ],
      parent:[
        ['studentprofile','Child Profile','See progress'],
        ['dailydiary','Daily Diary','Today\'s class work'],
        ['leavecenter','Leave','Request / status'],
        ['parentcomplaints','Complaints','Private school contact'],
        ['noticeboard','Notices','School updates']
      ],
      student:[
        ['studentprofile','My Profile','Progress overview'],
        ['dailydiary','Daily Diary','Today\'s work'],
        ['study','Study Library','Learning resources'],
        ['practice','Practice','Questions & tests'],
        ['leavecenter','Leave','Request / status']
      ]
    };
    const source=sets[r]||sets.student;
    const visible=source.filter(x=>{
      const nav=document.querySelector('.nav-item[data-view="'+x[0]+'"]');
      return nav&&!nav.hidden&&!nav.classList.contains('role-hidden');
    });
    const title=r==='teacher'?'Teacher Shortcuts':r==='parent'?'Parent Shortcuts':'Student Shortcuts';
    card.innerHTML='<div class="section-head dashboard-quick-head"><div><div class="academic-kicker">Quick Access</div><h2>'+title+'</h2><p class="muted">Aap ke role ke sab se useful tools.</p></div></div>'+
      '<div class="quick-actions role-quick-actions">'+visible.map(x=>'<button type="button" data-role-quick="'+x[0]+'"><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></button>').join('')+'</div>';
    card.querySelectorAll('[data-role-quick]').forEach(b=>b.onclick=()=>jump(b.dataset.roleQuick));
  }

  function familyCard(s){
    const x=profileFor(s),att=x.attendance?.percentage,avg=x.results?.overall,pending=x.fees?.outstanding||0,overdue=x.fees?.overdueRows?.length||0,missing=x.assignments?.missing?.length||0,next=x.exams?.next;
    const risk=(x.alerts||[]).some(a=>a.level==='high')?'Needs attention':(x.alerts||[]).length?'Follow-up':'On track';
    return '<article class="card">'+
      '<div class="paper-card-top"><div><span class="mini-badge">'+esc(s.className||'Student')+(s.sectionName?' · '+esc(s.sectionName):'')+'</span><span class="mini-badge">'+esc(risk)+'</span></div></div>'+
      '<h3 style="margin-bottom:6px">'+esc(s.name)+'</h3>'+
      '<div class="pp-stats"><article><span>Attendance</span><strong>'+(att==null?'—':att+'%')+'</strong></article><article><span>Academic</span><strong>'+(avg==null?'—':avg+'%')+'</strong></article><article><span>Fee Due</span><strong>'+esc(money(pending))+'</strong></article><article><span>Missing Work</span><strong>'+missing+'</strong></article></div>'+
      (next?'<div class="coverage-note"><strong>Next exam:</strong> '+esc(next.subject||'Exam')+' · '+esc(next.examDate||'-')+(next.startTime?' · '+esc(next.startTime):'')+'</div>':'')+
      (overdue?'<div class="coverage-note"><strong>Fee alert:</strong> '+overdue+' overdue challan(s).</div>':'')+
      '<div class="paper-actions"><button class="secondary" data-family-jump="studentprofile" data-student-id="'+esc(s.id)+'">Profile</button><button class="secondary" data-family-jump="attendanceanalytics">Attendance</button><button class="secondary" data-family-jump="results">Results</button><button class="secondary" data-family-jump="fees">Fees</button><button class="secondary" data-family-jump="examcenter">Exams</button><button class="secondary" data-family-jump="schoolwork">Assignments</button></div>'+
      '</article>';
  }

  function render(){
    ensure();renderAdminDesk();const box=document.getElementById('familyDashboard');if(!box)return;
    const r=role();
    document.body.dataset.eduRole=r;
    renderRoleQuickActions();
    if(!['parent','student','teacher'].includes(r)){box.style.display='none';return}
    box.style.display='block';
    const all=read('edunizam_students',[]),list=window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(all)||[];
    const title=r==='parent'?'My Child Dashboard':r==='teacher'?'My Assigned Students':'My Academic Dashboard';
    const roleNote=r==='parent'
      ?'Approved linked child/children ki attendance, results, fees, assignments aur upcoming exams.'
      :r==='teacher'
        ?'Sirf assigned students ka connected academic snapshot. Unassigned students hidden rahenge.'
        :'Aap ke approved student record ka connected academic snapshot.';
    box.innerHTML='<div class="section-head"><div><div class="academic-kicker">Connected Student View</div><h2>'+title+'</h2><p class="muted">'+roleNote+'</p></div><span class="badge">'+list.length+' record(s)</span></div>'+
      (list.length?'<div class="paper-grid">'+list.map(familyCard).join('')+'</div>':'<div class="empty-state">'+(r==='student'?'Admin approval aur record link hone ke baad aap ki academic summary yahan nazar aayegi.':r==='parent'?'Admin approval aur child link hone ke baad child ki summary yahan nazar aayegi.':'Admin se student assignment hone ke baad assigned students yahan nazar aayenge.')+'</div>');
    box.querySelectorAll('[data-family-jump]').forEach(b=>b.onclick=()=>{
      const view=b.dataset.familyJump,studentId=b.dataset.studentId||'';
      jump(view);
      if(view==='studentprofile'&&studentId)setTimeout(()=>{const sel=document.getElementById('profileStudentSelect');if(sel){sel.value=studentId;sel.dispatchEvent(new Event('change',{bubbles:true}))}},350);
    });
  }
  setTimeout(()=>{ensure();render()},300);
  window.addEventListener('storage',render);
  window.addEventListener('edunizam:auth',()=>setTimeout(render,100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  window.EDUNIZAM_PARENT_DASHBOARD={render};
  window.EDUNIZAM_ADMIN_DASHBOARD={render:renderAdminDesk};
})();