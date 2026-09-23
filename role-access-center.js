(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function ready(){return !!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId)}
  function injectStyle(){
    if(document.getElementById('roleAccessStyle'))return;
    const s=document.createElement('style');s.id='roleAccessStyle';
    s.textContent='.access-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.access-code{font:800 26px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;padding:12px 14px;border:1px dashed #8db7b1;border-radius:12px;background:#f7fbfa;color:#0f5f58}.access-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.access-list-item{padding:11px 0;border-bottom:1px solid #e7efee}.access-list-item:last-child{border-bottom:0}@media(max-width:760px){.access-grid{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function inject(){
    if(document.querySelector('[data-view="access"]'))return;
    const nav=document.getElementById('nav')||document.querySelector('.sidebar nav');if(!nav)return;
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='access';b.textContent='🔐  Access & Roles';
    const assistant=nav.querySelector('[data-view="assistant"]');assistant?nav.insertBefore(b,assistant):nav.appendChild(b);
    b.onclick=show;
    const main=document.querySelector('main');if(!main)return;
    const sec=document.createElement('section');sec.id='access';sec.className='view';
    sec.innerHTML='<div class="section-head"><div><h2>Access & Role Center</h2><p class="muted">School Admin protected access, verified Teacher onboarding, Parent and Student linking.</p></div><span id="accessRoleBadge" class="badge"></span></div><div class="access-grid"><article class="card" id="claimInviteCard"><h3>School Link</h3><p class="muted">Parent aur Student apna school select karke profile bhejte hain. Admin sirf Approve / Reject karta hai. Teacher ke liye verified staff approval flow use hota hai.</p><div id="claimInviteMsg" class="coverage-note">Parent/Student ke liye koi code required nahi. Teacher approval alag verified staff flow se hota hai.</div></article><article class="card" id="teacherRequestCard"><h3>Teacher Staff Verification</h3><p class="muted">Teacher invite code aur Staff Code enter karein. Access tab tak nahi milega jab tak School Admin approve na kare.</p><div class="form-grid"><input id="teacherInviteCode" placeholder="Teacher invite code"><input id="teacherStaffCode" placeholder="Staff Code e.g. T-001"><button id="requestTeacherAccessBtn">Request Teacher Access</button></div><div id="teacherRequestMsg" class="coverage-note"></div></article><article class="card" id="parentLinkCard"><h3>Parent Access</h3><p class="muted">Parent profile approval ke baad school se automatically link hota hai. Koi Student Code required nahi.</p><div class="coverage-note">Normal login: email + password.</div></article><article class="card" id="inviteAdminCard"><div class="section-head"><div><h3>Create Invite Code</h3><p class="muted">Sirf School Admin institute access codes bana sakta hai.</p></div></div><div class="form-grid"><select id="inviteRole"><option value="teacher">Teacher (Admin approval required)</option></select><input id="inviteUses" type="number" min="1" max="100" value="1" placeholder="Max uses"><input id="inviteDays" type="number" min="1" max="365" value="7" placeholder="Valid days"><button id="createInviteBtn">Generate Invite</button></div><div id="inviteResult"></div><div id="inviteList"></div></article><article class="card" id="schoolAccountsCard"><div class="section-head"><div><h3>School Login Accounts</h3><p class="muted">Is school ke Admin se connected Teacher, Parent aur Student logins.</p></div><button id="refreshSchoolAccounts" class="secondary">Refresh</button></div><div id="schoolLoginAccounts"><div class="muted">Loading linked accounts...</div></div></article><article class="card" id="teacherApprovalCard"><div class="section-head"><div><h3>Teacher Access Requests</h3><p class="muted">Staff Directory match verify karke approve/reject karein.</p></div><button id="refreshTeacherRequests" class="secondary">Refresh</button></div><div id="teacherDecisionMsg" class="coverage-note"></div><div id="teacherAccessRequests"></div></article><article class="card" id="parentApprovalCard"><div class="section-head"><div><h3>Parent & Student Login Requests</h3><p class="muted">Profile dekhein aur 1-click Approve / Reject karein. Codes ki zarurat nahi.</p></div><button id="refreshSchoolAccessRequests" class="secondary">Refresh</button></div><div id="schoolAccessDecisionMsg" class="coverage-note"></div><div id="schoolAccessRequests"></div></article></div>';
    main.appendChild(sec);
  }
  function show(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById('access')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='access'));
    const title=document.getElementById('page-title');if(title)title.textContent='Access & Roles';render();
  }
  async function claimInvite(){
    const msg=document.getElementById('claimInviteMsg'),code=document.getElementById('claimInviteCode').value.trim();
    if(!code)return msg.textContent='Invite code enter karein.';
    if(!cloud()?.claimInstitutionInvite)return msg.textContent='Cloud backend required.';
    try{msg.textContent='Checking invite...';const r=await cloud().claimInstitutionInvite(code);msg.textContent='Joined '+(r?.institution_name||'institute')+' as '+(r?.granted_role||'user')+'. Reloading...';setTimeout(()=>location.reload(),500)}catch(e){msg.textContent=e.message||String(e)}
  }
  async function requestTeacherAccess(){
    const msg=document.getElementById('teacherRequestMsg');
    const invite=document.getElementById('teacherInviteCode')?.value.trim();
    const staffCode=document.getElementById('teacherStaffCode')?.value.trim();
    if(!invite||!staffCode)return msg.textContent='Teacher invite code aur Staff Code dono required hain.';
    if(!cloud()?.requestTeacherAccess)return msg.textContent='Teacher verification backend migration required.';
    try{
      msg.textContent='Staff record checking...';
      const r=await cloud().requestTeacherAccess(invite,staffCode);
      msg.textContent='Request sent for '+(r?.staff_name||'staff member')+'. School Admin approval ke baad Teacher access activate hoga.';
    }catch(e){msg.textContent=e.message||String(e)}
  }
  async function loadInstitutionAccounts(){
    const box=document.getElementById('schoolLoginAccounts');
    if(!box||role()!=='head'||!ready())return;
    try{
      const rows=cloud().listInstitutionAccounts?await cloud().listInstitutionAccounts():[];
      const labels={teacher:'Teacher',parent:'Parent',student:'Student'};
      const counts={teacher:0,parent:0,student:0};
      rows.forEach(x=>{if(Object.prototype.hasOwnProperty.call(counts,x.role))counts[x.role]++});
      const summary='<div class="coverage-note"><strong>Linked with this Admin:</strong> '+counts.teacher+' Teacher · '+counts.parent+' Parent · '+counts.student+' Student</div>';
      box.innerHTML=summary+(rows.length?rows.map(x=>'<div class="access-list-item"><div class="access-row"><strong>'+esc(x.full_name||'Linked account')+'</strong><span class="badge">'+esc(labels[x.role]||x.role)+'</span></div><div class="muted">'+esc(x.phone||'Connected to this school Admin')+'</div></div>').join(''):'<div class="muted">No Teacher, Parent or Student login has been linked yet. New verified role accounts will appear here automatically.</div>');
    }catch(e){box.textContent=e.message||String(e)}
  }
  async function loadTeacherRequests(){
    const box=document.getElementById('teacherAccessRequests');if(!box||role()!=='head'||!ready())return;
    try{
      const rows=await cloud().listTeacherAccessRequests();
      box.innerHTML=rows.length?rows.map(x=>'<div class="access-list-item"><div><strong>'+esc(x.staff_name)+'</strong> · '+esc(x.staff_code)+' · '+esc(x.designation||'Teacher')+'</div><div class="muted">Account: '+esc(x.requester_label||x.requester_user_id)+'</div><div class="access-row"><span class="badge">'+esc(x.request_status)+'</span>'+(x.request_status==='pending'?'<button data-teacher-approve="'+esc(x.request_id)+'">Approve</button><button class="secondary" data-teacher-reject="'+esc(x.request_id)+'">Reject</button>':'')+'</div></div>').join(''):'<div class="muted">No teacher access requests.</div>';
      box.querySelectorAll('[data-teacher-approve]').forEach(b=>b.onclick=()=>decideTeacher(b.dataset.teacherApprove,true));
      box.querySelectorAll('[data-teacher-reject]').forEach(b=>b.onclick=()=>decideTeacher(b.dataset.teacherReject,false));
    }catch(e){box.textContent=e.message||String(e)}
  }
  async function decideTeacher(id,approve){
    const msg=document.getElementById('teacherDecisionMsg');
    try{
      if(msg)msg.textContent=approve?'Approving verified teacher...':'Rejecting request...';
      await cloud().decideTeacherAccess(id,approve,approve?'Verified by School Admin':'Rejected by School Admin');
      if(msg)msg.textContent=approve?'Teacher approved and linked to this school.':'Teacher request rejected.';
      loadTeacherRequests();
      if(approve)loadInstitutionAccounts();
    }catch(e){if(msg)msg.textContent=e.message||String(e)}
  }
  async function loadSchoolAccessRequests(){
    const box=document.getElementById('schoolAccessRequests');
    if(!box||role()!=='head'||!ready())return;
    try{
      const rows=cloud().listSchoolAccessRequests?await cloud().listSchoolAccessRequests():[];
      const sorted=[...rows].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||new Date(b.created_at)-new Date(a.created_at));
      box.innerHTML=sorted.length?sorted.map(x=>{
        const isStudent=x.requested_role==='student';
        const roleLabel=isStudent?'Student':'Parent';
        const studentLabel=isStudent?(x.student_name||x.full_name):(x.student_name||'Child details not provided');
        const details=[
          x.phone?'Contact: '+esc(x.phone):'',
          studentLabel?'Student: '+esc(studentLabel):'',
          x.guardian_name?'Guardian: '+esc(x.guardian_name):'',
          x.class_name?'Class: '+esc(x.class_name):'',
          x.section_name?'Section: '+esc(x.section_name):'',
          x.admission_no?'Admission No.: '+esc(x.admission_no):'',
          x.date_of_birth?'DOB: '+esc(x.date_of_birth):'',
          x.relationship?'Relation: '+esc(x.relationship):''
        ].filter(Boolean).join(' · ');
        return '<div class="access-list-item"><div class="access-row"><strong>'+esc(x.full_name||roleLabel+' applicant')+'</strong><span class="badge">'+roleLabel+'</span><span class="badge">'+esc(x.status)+'</span></div><div class="muted">'+details+'</div>'+(x.review_note?'<div class="muted">Note: '+esc(x.review_note)+'</div>':'')+(x.status==='pending'?'<div class="access-row"><button data-school-access-approve="'+esc(x.id)+'">Approve</button><button class="secondary" data-school-access-reject="'+esc(x.id)+'">Reject</button></div>':'')+'</div>';
      }).join(''):'<div class="muted">No Parent or Student approval requests yet.</div>';
      box.querySelectorAll('[data-school-access-approve]').forEach(b=>b.onclick=()=>decideSchoolAccess(b.dataset.schoolAccessApprove,true));
      box.querySelectorAll('[data-school-access-reject]').forEach(b=>b.onclick=()=>decideSchoolAccess(b.dataset.schoolAccessReject,false));
    }catch(e){box.textContent=e.message||String(e)}
  }
  async function decideSchoolAccess(id,approve){
    const msg=document.getElementById('schoolAccessDecisionMsg');
    try{
      if(msg)msg.textContent=approve?'Approving and linking account...':'Rejecting request...';
      const result=await cloud().decideSchoolAccessRequest(id,approve,approve?'Approved by School Admin':'Rejected by School Admin');
      if(msg){
        if(!approve)msg.textContent='Request rejected.';
        else if(result?.requested_role==='student')msg.textContent='Student approved and linked. Student can now log in with email + password.';
        else msg.textContent='Parent approved and linked. Parent can now log in with email + password.';
      }
      await loadSchoolAccessRequests();
      await loadInstitutionAccounts();
    }catch(e){if(msg)msg.textContent=e.message||String(e)}
  }

  async function createInvite(){
    const box=document.getElementById('inviteResult');
    try{
      box.textContent='Generating...';
      const role=document.getElementById('inviteRole').value,uses=Number(document.getElementById('inviteUses').value||1),days=Number(document.getElementById('inviteDays').value||7);
      const x=await cloud().createInstitutionInvite(role,uses,days);
      box.innerHTML='<div class="access-code">'+esc(x.code)+'</div><p class="coverage-note">Share this code with the '+esc(role)+'.</p>';
      loadInvites();
    }catch(e){box.textContent=e.message||String(e)}
  }
  async function loadInvites(){
    const box=document.getElementById('inviteList');if(!box||role()!=='head'||!ready())return;
    try{
      const rows=await cloud().listInstitutionInvites();
      box.innerHTML=rows.length?'<h4>Recent Codes</h4>'+rows.map(x=>'<div class="access-list-item"><strong>'+esc(x.code)+'</strong> · '+esc(x.target_role)+' · '+x.use_count+'/'+x.max_uses+' used '+(x.active?'':'· inactive')+'</div>').join(''):'<div class="muted">No invite codes yet.</div>';
    }catch(e){box.textContent=e.message||String(e)}
  }
  function render(){
    const r=role(),badge=document.getElementById('accessRoleBadge');if(badge)badge.textContent=({head:'Head of Institute',teacher:'Teacher',parent:'Parent',student:'Student'}[r]||r);
    const admin=document.getElementById('inviteAdminCard'),accounts=document.getElementById('schoolAccountsCard'),approval=document.getElementById('parentApprovalCard'),teacherApproval=document.getElementById('teacherApprovalCard'),teacherRequest=document.getElementById('teacherRequestCard'),parent=document.getElementById('parentLinkCard');
    if(admin)admin.style.display=r==='head'?'block':'none';
    if(accounts)accounts.style.display=r==='head'?'block':'none';
    if(approval)approval.style.display=r==='head'?'block':'none';
    if(teacherApproval)teacherApproval.style.display=r==='head'?'block':'none';
    if(teacherRequest)teacherRequest.style.display=r==='teacher'?'block':'none';
    if(parent)parent.style.display='none';
    if(r==='head'){loadInvites();loadInstitutionAccounts();loadSchoolAccessRequests();loadTeacherRequests()}
  }
  function boot(){
    injectStyle();inject();
    document.getElementById('claimInviteBtn')?.addEventListener('click',claimInvite);
    document.getElementById('requestTeacherAccessBtn')?.addEventListener('click',requestTeacherAccess);
    document.getElementById('createInviteBtn')?.addEventListener('click',createInvite);
    document.getElementById('refreshSchoolAccounts')?.addEventListener('click',loadInstitutionAccounts);
    document.getElementById('refreshTeacherRequests')?.addEventListener('click',loadTeacherRequests);
    document.getElementById('refreshSchoolAccessRequests')?.addEventListener('click',loadSchoolAccessRequests);
    render();
  }
  setTimeout(boot,0);
  window.EDUNIZAM_ROLE_ACCESS={show,render};
})();