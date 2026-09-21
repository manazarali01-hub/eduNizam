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
    sec.innerHTML='<div class="section-head"><div><h2>Access & Role Center</h2><p class="muted">School Admin protected access, verified Teacher onboarding, Parent and Student linking.</p></div><span id="accessRoleBadge" class="badge"></span></div><div class="access-grid"><article class="card" id="claimInviteCard"><h3>Join an Institute</h3><p class="muted">Student/Parent institute invite yahan claim karein.</p><div class="form-grid"><input id="claimInviteCode" placeholder="Invite code e.g. EN-AB12CD"><button id="claimInviteBtn">Claim Invite</button></div><div id="claimInviteMsg" class="coverage-note"></div></article><article class="card" id="teacherRequestCard"><h3>Teacher Staff Verification</h3><p class="muted">Teacher invite code aur Staff Code enter karein. Access tab tak nahi milega jab tak School Admin approve na kare.</p><div class="form-grid"><input id="teacherInviteCode" placeholder="Teacher invite code"><input id="teacherStaffCode" placeholder="Staff Code e.g. T-001"><button id="requestTeacherAccessBtn">Request Teacher Access</button></div><div id="teacherRequestMsg" class="coverage-note"></div></article><article class="card" id="parentLinkCard"><h3>Parent–Student Link</h3><p class="muted">Parent student ka EduNizam Student Code enter karke access request bhej sakta hai.</p><div class="form-grid"><input id="parentStudentCode" placeholder="Student code"><button id="requestParentLinkBtn">Request Child Link</button></div><div id="parentLinkMsg" class="coverage-note"></div></article><article class="card" id="inviteAdminCard"><div class="section-head"><div><h3>Create Invite Code</h3><p class="muted">Sirf School Admin institute access codes bana sakta hai.</p></div></div><div class="form-grid"><select id="inviteRole"><option value="teacher">Teacher (approval required)</option><option value="student">Student</option><option value="parent">Parent</option></select><input id="inviteUses" type="number" min="1" max="100" value="1" placeholder="Max uses"><input id="inviteDays" type="number" min="1" max="365" value="7" placeholder="Valid days"><button id="createInviteBtn">Generate Invite</button></div><div id="inviteResult"></div><div id="inviteList"></div></article><article class="card" id="teacherApprovalCard"><div class="section-head"><div><h3>Teacher Access Requests</h3><p class="muted">Staff Directory match verify karke approve/reject karein.</p></div><button id="refreshTeacherRequests" class="secondary">Refresh</button></div><div id="teacherAccessRequests"></div></article><article class="card" id="parentApprovalCard"><div class="section-head"><div><h3>Parent Access Requests</h3><p class="muted">Pending parent-child links approve ya reject karein.</p></div><button id="refreshParentLinks" class="secondary">Refresh</button></div><div id="accessParentLinks"></div></article></div>';
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
    try{
      await cloud().decideTeacherAccess(id,approve,approve?'Verified by School Admin':'Rejected by School Admin');
      loadTeacherRequests();
    }catch(e){alert(e.message||e)}
  }
  async function requestParent(){
    const msg=document.getElementById('parentLinkMsg'),code=document.getElementById('parentStudentCode').value.trim();
    if(!code)return msg.textContent='Student code enter karein.';
    try{msg.textContent='Sending request...';await cloud().requestParentLinkByStudentCode(code);msg.textContent='Parent access request sent for approval.'}catch(e){msg.textContent=e.message||String(e)}
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
  async function loadParentLinks(){
    const box=document.getElementById('accessParentLinks');if(!box||role()!=='head'||!ready())return;
    try{
      const rows=await cloud().listParentStudentLinks();
      box.innerHTML=rows.length?rows.map(x=>'<div class="access-list-item"><div><strong>Parent:</strong> '+esc(x.parent_user_id)+'</div><div><strong>Student:</strong> '+esc(x.student_user_id)+'</div><div class="access-row"><span class="badge">'+esc(x.status)+'</span>'+(x.status==='pending'?'<button data-approve-parent="'+esc(x.parent_user_id)+'" data-student="'+esc(x.student_user_id)+'">Approve</button><button class="secondary" data-reject-parent="'+esc(x.parent_user_id)+'" data-student="'+esc(x.student_user_id)+'">Reject</button>':'')+'</div></div>').join(''):'<div class="muted">No parent link requests.</div>';
      box.querySelectorAll('[data-approve-parent]').forEach(b=>b.onclick=()=>decide(b.dataset.approveParent,b.dataset.student,'approved'));
      box.querySelectorAll('[data-reject-parent]').forEach(b=>b.onclick=()=>decide(b.dataset.rejectParent,b.dataset.student,'rejected'));
    }catch(e){box.textContent=e.message||String(e)}
  }
  async function decide(parent,student,status){try{await cloud().updateParentStudentLink(parent,student,status);loadParentLinks()}catch(e){alert(e.message||e)}}
  function render(){
    const r=role(),badge=document.getElementById('accessRoleBadge');if(badge)badge.textContent=({head:'Head of Institute',teacher:'Teacher',parent:'Parent',student:'Student'}[r]||r);
    const admin=document.getElementById('inviteAdminCard'),approval=document.getElementById('parentApprovalCard'),teacherApproval=document.getElementById('teacherApprovalCard'),teacherRequest=document.getElementById('teacherRequestCard'),parent=document.getElementById('parentLinkCard');
    if(admin)admin.style.display=r==='head'?'block':'none';
    if(approval)approval.style.display=r==='head'?'block':'none';
    if(teacherApproval)teacherApproval.style.display=r==='head'?'block':'none';
    if(teacherRequest)teacherRequest.style.display=['student','teacher'].includes(r)?'block':'none';
    if(parent)parent.style.display=r==='parent'?'block':'none';
    if(r==='head'){loadInvites();loadParentLinks();loadTeacherRequests()}
  }
  function boot(){
    injectStyle();inject();
    document.getElementById('claimInviteBtn')?.addEventListener('click',claimInvite);
    document.getElementById('requestTeacherAccessBtn')?.addEventListener('click',requestTeacherAccess);
    document.getElementById('requestParentLinkBtn')?.addEventListener('click',requestParent);
    document.getElementById('createInviteBtn')?.addEventListener('click',createInvite);
    document.getElementById('refreshTeacherRequests')?.addEventListener('click',loadTeacherRequests);
    document.getElementById('refreshParentLinks')?.addEventListener('click',loadParentLinks);
    render();
  }
  setTimeout(boot,0);
  window.EDUNIZAM_ROLE_ACCESS={show,render};
})();