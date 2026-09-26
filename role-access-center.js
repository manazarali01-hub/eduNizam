(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function ready(){return !!(cloud()?.state?.client&&cloud()?.state?.user&&cfg().institutionId)}
  let showReviewed=false;
  let pendingRefreshTimer=null;
  const decisionsInFlight=new Set();
  function injectStyle(){
    if(document.getElementById('roleAccessStyle'))return;
    const s=document.createElement('style');s.id='roleAccessStyle';
    s.textContent='.access-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.access-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.access-list-item{padding:11px 0;border-bottom:1px solid #e7efee}.access-list-item:last-child{border-bottom:0}.access-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.access-actions button{min-height:42px}#parentApprovalCard{grid-column:1/-1;order:-1}.access-nav-badge{display:inline-flex;min-width:22px;height:22px;align-items:center;justify-content:center;margin-left:auto;padding:0 6px;border-radius:999px;background:#b42318;color:#fff;font-size:.72rem;font-weight:900;line-height:1}.access-nav-badge.hidden{display:none!important}@media(max-width:760px){.access-grid{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function ensureDashboardApprovalCard(){
    const dashboard=document.getElementById('dashboard');
    if(!dashboard||document.getElementById('dashboardAccessApprovalCard'))return;
    const card=document.createElement('article');
    card.className='card';
    card.id='dashboardAccessApprovalCard';
    card.innerHTML='<div class="section-head"><div><h2>Pending Access Requests</h2><p class="muted">Teacher, Parent aur Student approval requests.</p></div><button id="dashboardReviewAccessBtn" class="secondary" type="button">Review</button></div><div class="coverage-note"><strong id="dashboardPendingAccessCount">0</strong> request(s) waiting for approval.</div>';
    const target=dashboard.querySelector('.grid-2')||dashboard;
    target.parentNode.insertBefore(card,target);
    document.getElementById('dashboardReviewAccessBtn')?.addEventListener('click',show);
  }
  function inject(){
    if(document.querySelector('[data-view="access"]'))return;
    const nav=document.getElementById('nav')||document.querySelector('.sidebar nav');if(!nav)return;
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='access';b.innerHTML='<span>🔐&nbsp; Access & Roles</span><span id="accessPendingBadge" class="access-nav-badge hidden" aria-label="Pending approval requests"></span>';
    const assistant=nav.querySelector('[data-view="assistant"]');assistant?nav.insertBefore(b,assistant):nav.appendChild(b);
    b.onclick=show;
    const main=document.querySelector('main');if(!main)return;
    const sec=document.createElement('section');sec.id='access';sec.className='view';
    sec.innerHTML='<div class="section-head"><div><h2>Access & Role Center</h2><p class="muted">School Admin controls Teacher, Parent and Student access to this school.</p></div><span id="accessRoleBadge" class="badge"></span></div><div class="access-grid"><article class="card" id="claimInviteCard"><h3>School Link</h3><p class="muted">Teacher, Parent aur Student school select karke request bhejte hain. Admin approve ya reject karta hai.</p><div id="claimInviteMsg" class="coverage-note">Email verification aur Admin approval ke baad access milta hai. Koi code required nahi.</div></article><article class="card" id="schoolAccountsCard"><div class="section-head"><div><h3>School Login Accounts</h3><p class="muted">Is school ke Admin se connected Teacher, Parent aur Student logins.</p></div><button id="refreshSchoolAccounts" class="secondary">Refresh</button></div><div id="schoolLoginAccounts"><div class="muted">Loading linked accounts...</div></div></article><article class="card" id="parentApprovalCard"><div class="section-head"><div><h3>Teacher, Parent & Student Requests</h3><p class="muted">Profile dekhein aur Approve / Reject karein. Access sirf approval ke baad milega.</p></div><button id="refreshSchoolAccessRequests" class="secondary">Refresh</button></div><div id="schoolAccessDecisionMsg" class="coverage-note" role="status"></div><div id="schoolAccessRequests" aria-live="polite"></div><button id="toggleReviewedRequests" class="secondary" type="button" hidden>Show reviewed</button></article><article class="card" id="resolveAccessLinksCard"><div class="section-head"><div><h3>Resolve Parent / Student Links</h3><p class="muted">Approved account automatic match na ho to correct student record select karke one-click link karein.</p></div><button id="refreshResolveLinks" class="secondary">Refresh</button></div><div id="resolveAccessLinksMsg" class="coverage-note"></div><div id="resolveAccessLinksList"></div></article></div>';
    main.appendChild(sec);
  }
  function show(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById('access')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='access'));
    const title=document.getElementById('page-title');if(title)title.textContent='Access & Roles';render();
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
  function updatePendingBadge(count){
    const badge=document.getElementById('accessPendingBadge');
    if(!badge)return;
    const n=Math.max(0,Number(count||0));
    badge.textContent=n>99?'99+':String(n);
    badge.classList.toggle('hidden',n===0||role()!=='head');
    badge.title=n?n+' approval request'+(n===1?'':'s')+' waiting':'No approval requests waiting';
    const dash=document.getElementById('dashboardAccessApprovalCard');
    const dashCount=document.getElementById('dashboardPendingAccessCount');
    const dailyDesk=document.getElementById('adminDailyDesk');
    if(dash)dash.style.display=role()==='head'&&!dailyDesk?'block':'none';
    if(dashCount)dashCount.textContent=String(n);
    const dailyApproval=dailyDesk?.querySelector('[data-admin-jump="access"]');
    if(dailyApproval){
      let count=dailyApproval.querySelector('.admin-action-count');
      if(!count){count=document.createElement('span');count.className='admin-action-count';dailyApproval.appendChild(count)}
      count.textContent=n>99?'99+':String(n);
      count.hidden=n===0;
      dailyApproval.setAttribute('aria-label','Approvals'+(n?' — '+n+' pending':''));
    }
  }
  async function refreshPendingBadge(){
    if(role()!=='head'||!ready()){updatePendingBadge(0);return}
    try{
      const rows=cloud().listSchoolAccessRequests?await cloud().listSchoolAccessRequests():[];
      updatePendingBadge(rows.filter(x=>x.status==='pending').length);
    }catch(_){/* keep current badge if refresh fails */}
  }
  async function loadSchoolAccessRequests(){
    const box=document.getElementById('schoolAccessRequests');
    if(!box||role()!=='head'||!ready())return;
    try{
      const rows=cloud().listSchoolAccessRequests?await cloud().listSchoolAccessRequests():[];
      const pending=rows.filter(x=>x.status==='pending').sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
      updatePendingBadge(pending.length);
      const reviewed=rows.filter(x=>x.status!=='pending').sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
      const toggle=document.getElementById('toggleReviewedRequests');
      toggle.hidden=!reviewed.length;
      toggle.textContent=showReviewed?'Hide reviewed requests':'Show reviewed ('+reviewed.length+')';
      const visible=showReviewed?[...pending,...reviewed]:pending;
      box.innerHTML='<div class="coverage-note"><strong>Waiting for approval:</strong> '+pending.length+'</div>'+(visible.length?visible.map(x=>{
        const isStudent=x.requested_role==='student';
        const roleLabel=isStudent?'Student':x.requested_role==='teacher'?'Teacher':'Parent';
        const studentLabel=x.requested_role==='teacher'?'':isStudent?(x.student_name||x.full_name):(x.student_name||'Child details not provided');
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
        return '<div class="access-list-item"><div class="access-row"><strong>'+esc(x.full_name||roleLabel+' applicant')+'</strong><span class="badge">'+roleLabel+'</span><span class="badge">'+esc(x.status)+'</span></div><div class="muted">'+details+'</div>'+(x.review_note?'<div class="muted">Note: '+esc(x.review_note)+'</div>':'')+(x.status==='pending'?'<div class="access-actions"><button data-school-access-approve="'+esc(x.id)+'" data-request-role="'+esc(x.requested_role)+'" type="button">Approve</button><button class="secondary" data-school-access-reject="'+esc(x.id)+'" data-request-role="'+esc(x.requested_role)+'" type="button">Reject</button></div>':'')+'</div>';
      }).join(''):'<p class="muted">No requests waiting for approval.</p>');
      box.querySelectorAll('[data-school-access-approve]').forEach(b=>b.onclick=()=>decideSchoolAccess(b.dataset.schoolAccessApprove,true,b.dataset.requestRole));
      box.querySelectorAll('[data-school-access-reject]').forEach(b=>b.onclick=()=>decideSchoolAccess(b.dataset.schoolAccessReject,false,b.dataset.requestRole));
    }catch(e){box.textContent=e.message||String(e)}
  }
  async function loadResolveLinks(){
    const card=document.getElementById('resolveAccessLinksCard'),box=document.getElementById('resolveAccessLinksList'),msg=document.getElementById('resolveAccessLinksMsg');
    if(!card||!box)return;
    card.style.display=role()==='head'?'block':'none';
    if(role()!=='head'||!ready())return;
    try{
      const result=cloud().listAccessLinkIssues?await cloud().listAccessLinkIssues():{issues:[],students:[]};
      const issues=result?.issues||[],students=result?.students||[];
      if(msg)msg.textContent=issues.length?issues.length+' approved account(s) need manual linking.':'All approved Parent/Student accounts are linked.';
      box.innerHTML=issues.length?issues.map(x=>{
        const options=students.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' — '+esc(s.class_name||'Class')+(s.section_name?' / '+esc(s.section_name):'')+(s.admission_no?' · Adm '+esc(s.admission_no):'')+(s.auth_user_id?' · linked':' · unlinked')+'</option>').join('');
        const who=x.requested_role==='parent'?(x.student_name||x.full_name):(x.full_name||x.student_name||'Student');
        return '<div class="access-list-item"><div class="access-row"><strong>'+esc(x.full_name||x.requested_role)+'</strong><span class="badge">'+esc(x.requested_role)+'</span></div><div class="muted">Expected student: '+esc(who||'Not provided')+(x.class_name?' · Class '+esc(x.class_name):'')+(x.section_name?' / '+esc(x.section_name):'')+(x.admission_no?' · Admission '+esc(x.admission_no):'')+'</div><div class="access-actions"><select data-resolve-select="'+esc(x.id)+'"><option value="">Select correct student record</option>'+options+'</select><button data-resolve-link="'+esc(x.id)+'" type="button">Resolve Link</button></div></div>';
      }).join(''):'<div class="muted">No unresolved approved Parent/Student links.</div>';
      box.querySelectorAll('[data-resolve-link]').forEach(btn=>btn.onclick=async()=>{
        const id=btn.dataset.resolveLink,sel=box.querySelector('[data-resolve-select="'+CSS.escape(id)+'"]');
        if(!sel?.value)return;
        btn.disabled=true;
        try{
          if(msg)msg.textContent='Linking selected record...';
          const r=await cloud().resolveSchoolAccessLink(id,sel.value);
          if(msg)msg.textContent=(r?.requested_role==='parent'?'Parent-child':'Student-record')+' link completed: '+(r?.student_name||'Student')+'.';
          await Promise.all([loadResolveLinks(),loadInstitutionAccounts()]);
        }catch(e){if(msg)msg.textContent=e.message||String(e)}
        finally{btn.disabled=false}
      });
    }catch(e){if(msg)msg.textContent=e.message||String(e);box.innerHTML=''}
  }
  async function decideSchoolAccess(id,approve,requestRole){
    if(decisionsInFlight.has(id))return;
    decisionsInFlight.add(id);
    const msg=document.getElementById('schoolAccessDecisionMsg');
    const buttons=[...document.querySelectorAll('[data-school-access-approve],[data-school-access-reject]')].filter(b=>b.dataset.schoolAccessApprove===id||b.dataset.schoolAccessReject===id);
    buttons.forEach(b=>b.disabled=true);
    try{
      if(msg)msg.textContent=approve?'Approving and linking account...':'Rejecting request...';
      const result=await (requestRole==='teacher'
        ? cloud().decideTeacherSchoolRequest(id,approve,approve?'Approved by School Admin':'Rejected by School Admin')
        : cloud().decideSchoolAccessRequest(id,approve,approve?'Approved by School Admin':'Rejected by School Admin'));
      if(msg){
        if(!approve)msg.textContent='Request rejected.';
        else if(result?.requested_role==='teacher')msg.textContent='Teacher approved and linked. Teacher can now log in with email + password.';
        else if(result?.requested_role==='student'){
          msg.textContent=result?.student_record_linked
            ?'Student approved and school record linked. Student can now log in with email + password.'
            :'Student approved. Login is active, but the school record could not be matched automatically; Admin should review the student record.';
        }else{
          msg.textContent=result?.child_linked
            ?'Parent approved and child linked. Parent can now log in with email + password.'
            :'Parent approved. Login is active, but the child record is not linked yet. Approve/link the matching Student account or review the child details.';
        }
      }
      await Promise.all([loadSchoolAccessRequests(),loadInstitutionAccounts(),loadResolveLinks()]);
    }catch(e){if(msg)msg.textContent=e.message||String(e)}
    finally{decisionsInFlight.delete(id);buttons.forEach(b=>b.disabled=false)}
  }

  function render(){
    const r=role(),badge=document.getElementById('accessRoleBadge');if(badge)badge.textContent=({head:'Head of Institute',teacher:'Teacher',parent:'Parent',student:'Student'}[r]||r);
    const info=document.getElementById('claimInviteCard'),accounts=document.getElementById('schoolAccountsCard'),approval=document.getElementById('parentApprovalCard'),resolver=document.getElementById('resolveAccessLinksCard');
    if(info)info.style.display=r==='head'?'none':'block';
    if(accounts)accounts.style.display=r==='head'?'block':'none';
    if(approval)approval.style.display=r==='head'?'block':'none';
    if(resolver)resolver.style.display=r==='head'?'block':'none';
    if(r==='head'){
      loadInstitutionAccounts();loadSchoolAccessRequests();loadResolveLinks();
      clearInterval(pendingRefreshTimer);
      pendingRefreshTimer=setInterval(refreshPendingBadge,60000);
    }else{
      updatePendingBadge(0);
      clearInterval(pendingRefreshTimer);
      pendingRefreshTimer=null;
    }
  }
  function boot(){
    injectStyle();inject();ensureDashboardApprovalCard();
    document.getElementById('refreshSchoolAccounts')?.addEventListener('click',loadInstitutionAccounts);
    document.getElementById('refreshSchoolAccessRequests')?.addEventListener('click',loadSchoolAccessRequests);
    document.getElementById('toggleReviewedRequests')?.addEventListener('click',()=>{showReviewed=!showReviewed;loadSchoolAccessRequests()});
    document.getElementById('refreshResolveLinks')?.addEventListener('click',loadResolveLinks);
    window.addEventListener('edunizam:auth',()=>setTimeout(()=>{render();refreshPendingBadge()},50));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPendingBadge()});
    render();
    setTimeout(refreshPendingBadge,1200);
  }
  setTimeout(boot,0);
  window.EDUNIZAM_ROLE_ACCESS={show,render};
})();
