(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const role=()=>window.EDUNIZAM_ROLE_SCOPE?.role?.()||'student';
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cfg=()=>{
    const c=cloud()?.config||window.EDUNIZAM_CLOUD_CONFIG||{};
    let runtime={};try{runtime=JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}')}catch(_){}
    return {...c,...runtime};
  };
  let logs=[],profiles=new Map(),students=new Map(),staff=new Map(),timer=null;

  const labels={
    attendance_records:'Student Attendance',
    staff_attendance_records:'Staff Attendance',
    fee_records:'Fee Record',
    result_records:'Student Result',
    leave_requests:'Leave Request',
    school_access_requests:'Access Approval',
    core_students:'Student Record',
    teacher_student_links:'Teacher Assignment',
    parent_student_links:'Parent–Student Link',
    applications:'Admission Application',
    payment_records:'Admission Payment',
    student_parent_complaints:'Student Complaint',
    school_helpdesk_tickets:'Helpdesk Ticket',
    institution_settings:'School Settings'
  };
  const groups={
    attendance_records:'Attendance',staff_attendance_records:'Attendance',
    fee_records:'Finance',payment_records:'Finance',
    result_records:'Academics',
    leave_requests:'Leave',
    school_access_requests:'Access',teacher_student_links:'Access',parent_student_links:'Access',
    core_students:'Students',
    applications:'Admissions',
    student_parent_complaints:'Complaints',school_helpdesk_tickets:'Complaints',
    institution_settings:'Settings'
  };
  function institutionId(){return String(cfg().institutionId||'').trim()}
  function ready(){return !!(cloud()?.state?.client&&cloud()?.state?.user&&institutionId())}
  function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function actorName(id){
    if(!id)return 'System / Backend';
    const p=profiles.get(id);
    if(p?.full_name)return p.full_name+(p.account_role?' · '+String(p.account_role).replaceAll('_',' '):'');
    if(id===cloud()?.state?.user?.id)return 'School Admin';
    return 'School user';
  }
  function studentName(id){return students.get(id)?.name||'Student'}
  function staffName(id){return staff.get(id)?.full_name||'Staff'}
  function actionLabel(action){
    return ({insert:'Created / Submitted',update:'Updated',delete:'Removed'}[action]||String(action||'Activity'));
  }
  function detailText(x){
    const d=x.details||{};
    switch(x.entity_type){
      case'attendance_records':return studentName(d.student_id)+' · '+(d.date||'')+' · '+(d.status||'');
      case'staff_attendance_records':return staffName(d.staff_profile_id)+' · '+(d.date||'')+' · '+(d.status||'')+(d.check_in_at?' · Check-in '+new Date(d.check_in_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'');
      case'fee_records':return studentName(d.student_id)+' · Rs '+Number(d.amount||0).toLocaleString()+' · '+(d.status||'')+(d.fee_month?' · '+d.fee_month:'');
      case'result_records':return studentName(d.student_id)+' · '+(d.subject||'Subject')+(d.marks&&d.total?' · '+d.marks+'/'+d.total:'')+(d.assessment_type?' · '+d.assessment_type:'');
      case'leave_requests':return (d.requester_role||'User')+' · '+(d.leave_for||'leave')+' · '+[d.from_date,d.to_date].filter(Boolean).join(' → ')+' · '+(d.status||'');
      case'school_access_requests':return (d.full_name||'User')+' · '+(d.requested_role||'role')+' · '+(d.status||'');
      case'core_students':return (d.name||'Student')+(d.class_name?' · Class '+d.class_name:'')+(d.section_name?' / '+d.section_name:'');
      case'teacher_student_links':return 'Teacher '+actorName(d.teacher_user_id)+' · '+studentName(d.student_user_id);
      case'parent_student_links':return 'Parent '+actorName(d.parent_user_id)+' · '+studentName(d.student_user_id)+(d.status?' · '+d.status:'');
      case'applications':return (d.application_no||'Application')+' · '+(d.applicant_name||'Applicant')+(d.program?' · '+d.program:'')+' · '+(d.status||'');
      case'payment_records':return 'Rs '+Number(d.amount||0).toLocaleString()+' · '+(d.method||'payment')+' · '+(d.status||'');
      case'student_parent_complaints':return (d.subject||'Complaint')+' · '+(d.severity||'')+' · '+(d.status||'');
      case'school_helpdesk_tickets':return (d.ticket_no||'Ticket')+' · '+(d.category||'')+' · '+(d.status||'');
      case'institution_settings':return (d.school_name||'School')+(d.academic_session?' · Session '+d.academic_session:'');
      default:return x.entity_id||'School activity';
    }
  }
  function ensureUi(){
    const main=document.querySelector('main.main');const nav=$('nav');if(!main||!nav)return;
    let section=$('auditcenter');
    if(!section){
      section=document.createElement('section');section.id='auditcenter';section.className='view';
      section.innerHTML='<div class="section-head"><div><div class="academic-kicker">Admin Security & Accountability</div><h2>Audit & Activity Center</h2><p class="muted">Server-side record of important school actions. Sensitive CNIC/password/GPS values are not copied into this timeline.</p></div><button id="refreshAuditActivityBtn" type="button" class="secondary">Refresh</button></div>'+
        '<div class="audit-stat-grid"><article class="card"><span>Today</span><strong id="auditTodayCount">0</strong><small>Recorded events</small></article><article class="card"><span>Attendance</span><strong id="auditAttendanceCount">0</strong><small>Student + staff</small></article><article class="card"><span>Access</span><strong id="auditAccessCount">0</strong><small>Approvals & links</small></article><article class="card"><span>Finance</span><strong id="auditFinanceCount">0</strong><small>Fees & admission payments</small></article></div>'+
        '<article class="card"><div class="audit-toolbar"><input id="auditSearch" type="search" placeholder="Search actor, student, action…"><select id="auditCategory"><option value="">All categories</option><option>Attendance</option><option>Access</option><option>Students</option><option>Academics</option><option>Finance</option><option>Leave</option><option>Admissions</option><option>Complaints</option><option>Settings</option></select><select id="auditAction"><option value="">All actions</option><option value="insert">Created / Submitted</option><option value="update">Updated</option><option value="delete">Removed</option></select></div><div id="auditActivityMessage" class="coverage-note">Loading secure activity…</div><div id="auditActivityList" class="audit-timeline"></div></article>';
      main.appendChild(section);
      $('refreshAuditActivityBtn').onclick=()=>render(true);
      $('auditSearch').addEventListener('input',renderList);
      $('auditCategory').addEventListener('change',renderList);
      $('auditAction').addEventListener('change',renderList);
    }
    let button=nav.querySelector('[data-view="auditcenter"]');
    if(role()==='head'&&!button){
      button=document.createElement('button');button.className='nav-item';button.type='button';button.dataset.view='auditcenter';
      button.innerHTML='<span class="nav-icon">◉</span><span>Audit & Activity</span>';
      button.onclick=()=>window.EDUNIZAM_APP_NAV?.setView?.('auditcenter');
      nav.appendChild(button);
    }
    if(button)button.style.display=role()==='head'?'':'none';
  }
  async function loadLookups(){
    if(!ready())return;
    const client=cloud().state.client,inst=institutionId();
    const ids=[...new Set(logs.map(x=>x.user_id).filter(Boolean))];
    const studentIds=[...new Set(logs.map(x=>x.details?.student_id).filter(Boolean))];
    const staffIds=[...new Set(logs.map(x=>x.details?.staff_profile_id).filter(Boolean))];
    const [p,s,t]=await Promise.all([
      ids.length?client.from('user_profiles').select('user_id,full_name,account_role').in('user_id',ids):Promise.resolve({data:[],error:null}),
      studentIds.length?client.from('core_students').select('id,name,class_name,section_name').eq('institution_id',inst).in('id',studentIds):Promise.resolve({data:[],error:null}),
      staffIds.length?client.from('staff_profiles').select('id,full_name,designation').eq('institution_id',inst).in('id',staffIds):Promise.resolve({data:[],error:null})
    ]);
    if(!p.error)profiles=new Map((p.data||[]).map(x=>[x.user_id,x]));
    if(!s.error)students=new Map((s.data||[]).map(x=>[x.id,x]));
    if(!t.error)staff=new Map((t.data||[]).map(x=>[x.id,x]));
  }
  function filtered(){
    const q=String($('auditSearch')?.value||'').trim().toLowerCase(),cat=$('auditCategory')?.value||'',act=$('auditAction')?.value||'';
    return logs.filter(x=>{
      const group=groups[x.entity_type]||'Other';
      if(cat&&group!==cat)return false;
      if(act&&x.action!==act)return false;
      if(!q)return true;
      return [labels[x.entity_type],group,actionLabel(x.action),actorName(x.user_id),detailText(x),x.entity_id].join(' ').toLowerCase().includes(q);
    });
  }
  function renderStats(){
    const today=todayKey();
    const todayLogs=logs.filter(x=>String(x.created_at||'').slice(0,10)===today);
    $('auditTodayCount').textContent=String(todayLogs.length);
    $('auditAttendanceCount').textContent=String(todayLogs.filter(x=>groups[x.entity_type]==='Attendance').length);
    $('auditAccessCount').textContent=String(todayLogs.filter(x=>groups[x.entity_type]==='Access').length);
    $('auditFinanceCount').textContent=String(todayLogs.filter(x=>groups[x.entity_type]==='Finance').length);
  }
  function renderList(){
    const box=$('auditActivityList');if(!box)return;
    const rows=filtered();
    box.innerHTML=rows.length?rows.map(x=>{
      const group=groups[x.entity_type]||'Other';
      return '<article class="audit-event"><div class="audit-event-mark"></div><div class="audit-event-body"><div class="audit-event-top"><div><span class="mini-badge">'+esc(group)+'</span><strong>'+esc(labels[x.entity_type]||x.entity_type)+'</strong></div><time>'+esc(new Date(x.created_at).toLocaleString())+'</time></div><p>'+esc(detailText(x))+'</p><div class="audit-event-meta"><span>'+esc(actionLabel(x.action))+'</span><span>By '+esc(actorName(x.user_id))+'</span></div></div></article>';
    }).join(''):'<div class="empty-state">No matching audit events.</div>';
    const msg=$('auditActivityMessage');if(msg)msg.textContent=rows.length+' of '+logs.length+' recent event(s) shown.';
  }
  async function render(force=false){
    ensureUi();
    const section=$('auditcenter');if(section)section.style.display=role()==='head'?'':'none';
    if(role()!=='head')return;
    if(!ready()){
      if($('auditActivityMessage'))$('auditActivityMessage').textContent='Cloud connection required for secure Audit & Activity.';
      return;
    }
    if(!force&&logs.length){renderStats();renderList();return}
    const msg=$('auditActivityMessage');if(msg)msg.textContent='Loading secure activity…';
    try{
      const {data,error}=await cloud().state.client.from('audit_logs').select('*').eq('institution_id',institutionId()).order('created_at',{ascending:false}).limit(250);
      if(error)throw error;
      logs=data||[];
      await loadLookups();
      renderStats();renderList();
    }catch(e){
      if(msg)msg.textContent='Audit activity could not load: '+(e.message||e);
    }
  }
  function boot(){
    ensureUi();
    if(role()==='head')render(true);
    window.addEventListener('edunizam:auth',()=>setTimeout(()=>{ensureUi();render(true)},120));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&role()==='head'&&$('auditcenter')?.classList.contains('active'))render(true)});
    clearInterval(timer);timer=setInterval(()=>{if(role()==='head'&&$('auditcenter')?.classList.contains('active'))render(true)},60000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.EDUNIZAM_AUDIT_CENTER={render};
})();