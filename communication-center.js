(function(){
  const KEY='edunizam_meetings';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
  const write=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const roleLabel={head:'Head of Institute',teacher:'Teacher',parent:'Parent / Guardian',student:'Student'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const students=()=>{try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}};
  function canCreate(){return ['head','teacher'].includes(role())}
  function audienceLabel(m){return m.kind==='head-parent'?'Head ↔ Parent':'Teacher ↔ Student'}
  function injectStyle(){
    if(document.getElementById('meetingCenterStyle'))return;
    const s=document.createElement('style');s.id='meetingCenterStyle';
    s.textContent='.meet-layout{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(360px,1.4fr);gap:18px}.meet-form{display:grid;gap:10px}.meet-form input,.meet-form select{width:100%;box-sizing:border-box}.meet-actions{display:flex;gap:8px;flex-wrap:wrap}.meet-card{border:1px solid #dce7ed;border-radius:14px;padding:14px;margin:10px 0;background:#fff}.meet-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.meet-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.meet-link{word-break:break-all}.meet-empty{padding:20px;text-align:center;color:#6a7b88}@media(max-width:780px){.meet-layout{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }
  function injectNav(){
    if(document.querySelector('[data-view="communication"]'))return;
    const nav=document.querySelector('.sidebar nav')||document.querySelector('.nav-list')||document.querySelector('.sidebar');
    if(!nav)return;
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='communication';b.textContent='Communication & Meet';
    const settings=nav.querySelector('[data-view="settings"]');settings?nav.insertBefore(b,settings):nav.appendChild(b);
    b.onclick=()=>window.setView?window.setView('communication'):show();
  }
  function injectView(){
    if(document.getElementById('communication'))return;
    const main=document.querySelector('main');if(!main)return;
    const sec=document.createElement('section');sec.id='communication';sec.className='view';
    sec.innerHTML='<div class="section-head"><div><h2>Communication & Google Meet</h2><p class="muted">Head–Parent aur Teacher–Student meetings ko schedule aur manage karein.</p></div><span id="meetRoleBadge" class="badge"></span></div><div class="meet-layout"><article class="card" id="meetCreateCard"><h3>Schedule meeting</h3><div class="meet-form"><select id="meetKind"><option value="head-parent">Head ↔ Parent</option><option value="teacher-student">Teacher ↔ Student</option></select><select id="meetPerson"></select><input id="meetTitle" placeholder="Meeting topic"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input id="meetDate" type="date"><input id="meetTime" type="time"></div><input id="meetUrl" placeholder="Google Meet link (paste after creating)"><div class="meet-actions"><button id="createGoogleMeet" class="secondary">Create Google Meet</button><button id="saveMeeting">Save Meeting</button></div><small class="muted">Create Google Meet opens Google Meet. Link copy karke yahan paste karein.</small></div></article><article class="card"><div class="section-head"><div><h3>Scheduled meetings</h3><p class="muted">Role ke mutabiq relevant meetings yahan nazar aayengi.</p></div></div><div id="meetingList"></div></article></div>';
    main.appendChild(sec);
  }
  function options(){
    const list=students();
    const kind=document.getElementById('meetKind')?.value||'head-parent';
    const sel=document.getElementById('meetPerson');if(!sel)return;
    if(kind==='teacher-student'){
      sel.innerHTML='<option value="">Select student</option>'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' — '+esc(s.className||'Class')+'</option>').join('');
    }else{
      sel.innerHTML='<option value="">Select parent/guardian</option>'+list.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.father||'Parent/Guardian of '+s.name)+' — '+esc(s.name)+'</option>').join('');
    }
  }
  function visibleMeetings(){
    const r=role(),id=session()?.identity||'';
    const all=read();
    if(['head','teacher'].includes(r))return all;
    return all.filter(m=>m.viewerRole===r||m.participantIdentity===id||m.participantRole===r);
  }
  function render(){
    const badge=document.getElementById('meetRoleBadge');if(badge)badge.textContent=roleLabel[role()]||role();
    const create=document.getElementById('meetCreateCard');if(create)create.style.display=canCreate()?'block':'none';
    const kind=document.getElementById('meetKind');
    if(kind){
      kind.disabled=!canCreate();
      if(role()==='teacher')kind.value='teacher-student';
      if(role()==='head')kind.value='head-parent';
      [...kind.options].forEach(o=>o.disabled=(role()==='teacher'&&o.value!=='teacher-student')||(role()==='head'&&o.value!=='head-parent'));
    }
    options();
    const box=document.getElementById('meetingList');if(!box)return;
    const rows=visibleMeetings().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    box.innerHTML=rows.length?rows.map(m=>'<div class="meet-card"><div class="meet-card-top"><div><strong>'+esc(m.title||'Meeting')+'</strong><div class="muted">'+esc(m.personName||'Participant')+'</div></div><span class="badge">'+esc(m.status||'Scheduled')+'</span></div><div class="meet-meta"><span>'+esc(audienceLabel(m))+'</span><span>📅 '+esc(m.date||'-')+'</span><span>🕒 '+esc(m.time||'-')+'</span></div>'+(m.url?'<div class="meet-link"><a href="'+esc(m.url)+'" target="_blank" rel="noopener">Join Google Meet</a></div>':'<div class="muted">Meet link abhi add nahi hua.</div>')+(['head','teacher'].includes(role())?'<div class="meet-actions" style="margin-top:10px"><button class="secondary" data-meet-done="'+m.id+'">Mark Done</button><button class="secondary" data-meet-delete="'+m.id+'">Delete</button></div>':'')+'</div>').join(''):'<div class="meet-empty">Abhi koi meeting scheduled nahi.</div>';
    box.querySelectorAll('[data-meet-done]').forEach(b=>b.onclick=()=>updateStatus(b.dataset.meetDone,'Completed'));
    box.querySelectorAll('[data-meet-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.meetDelete));
  }
  function save(){
    if(!canCreate())return;
    const kind=document.getElementById('meetKind').value,personSel=document.getElementById('meetPerson');
    const id=personSel.value,title=document.getElementById('meetTitle').value.trim(),date=document.getElementById('meetDate').value,time=document.getElementById('meetTime').value,url=document.getElementById('meetUrl').value.trim();
    if(!id||!title||!date||!time)return alert('Participant, topic, date aur time complete karein.');
    if(url&&!/^https:\/\/meet\.google\.com\//i.test(url))return alert('Valid Google Meet link paste karein.');
    const s=students().find(x=>String(x.id)===String(id));
    const participantRole=kind==='head-parent'?'parent':'student';
    const personName=kind==='head-parent'?(s?.father||('Parent/Guardian of '+(s?.name||'Student'))):(s?.name||'Student');
    let record={id:String(Date.now()),kind,personId:id,personName,participantRole,viewerRole:participantRole,title,date,time,url,status:'Scheduled',createdByRole:role(),createdAt:new Date().toISOString()};
    const cloudApi=window.EDUNIZAM_COMMUNICATION_CLOUD;
    if(cloudApi?.ready?.()){
      cloudApi.create(record).then(row=>{
        if(row?.id){
          const arr=read();const local=arr.find(x=>x.id===record.id);if(local){local.id=row.id;local.source='cloud';write(arr);render();}
        }
      }).catch(e=>console.warn('Meeting cloud sync:',e.message||e));
    }
    const arr=read();arr.push(record);write(arr);
    window.EDUNIZAM_WORKFLOW_ALERTS?.meetingSaved?.(record);
    document.getElementById('meetTitle').value='';document.getElementById('meetUrl').value='';render();
    if(window.logActivity)window.logActivity('Meeting scheduled: '+title);
  }
  function updateStatus(id,status){const arr=read();const m=arr.find(x=>x.id===id);if(m)m.status=status;write(arr);render();const api=window.EDUNIZAM_COMMUNICATION_CLOUD;if(api?.ready?.())api.updateStatus(id,status).catch(e=>console.warn('Meeting status sync:',e.message||e))}
  function remove(id){write(read().filter(x=>x.id!==id));render();const api=window.EDUNIZAM_COMMUNICATION_CLOUD;if(api?.ready?.())api.remove(id).catch(e=>console.warn('Meeting delete sync:',e.message||e))}
  function show(){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById('communication')?.classList.add('active');document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='communication'));const t=document.getElementById('page-title');if(t)t.textContent='Communication & Meet';render()}
  async function hydrateCloud(){
    const api=window.EDUNIZAM_COMMUNICATION_CLOUD;if(!api?.ready?.())return;
    try{
      const rows=await api.list();if(!rows?.length)return;
      const mapped=rows.map(api.map),local=read(),byId=new Map(local.map(x=>[String(x.id),x]));
      mapped.forEach(x=>byId.set(String(x.id),Object.assign(byId.get(String(x.id))||{},x)));
      write([...byId.values()]);render();
    }catch(e){console.warn('Meeting cloud load:',e.message||e)}
  }
  function boot(){
    injectStyle();injectNav();injectView();
    const kind=document.getElementById('meetKind');if(kind)kind.onchange=options;
    const create=document.getElementById('createGoogleMeet');if(create)create.onclick=()=>window.open('https://meet.google.com/new','_blank','noopener');
    const saveBtn=document.getElementById('saveMeeting');if(saveBtn)saveBtn.onclick=save;
    render();hydrateCloud();
  }
  setTimeout(boot,0);
  window.addEventListener('storage',render);
  window.EDUNIZAM_MEETINGS={render,show};
})();