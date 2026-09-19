(function(){
  const KEY='edunizam_school_work_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'');
  const canEdit=()=>['head','teacher'].includes(role());
  const nowDate=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return Object.assign({announcements:[],homework:[],timetable:[]},JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return{announcements:[],homework:[],timetable:[]}}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  function cloudReady(){const c=cloud(),x=cfg();return !!(x.enabled&&x.institutionId&&c?.state?.client&&c?.state?.user)}
  function cloudStatus(){return cloudReady()?'Cloud Sync':'Local Mode'}
  function mapCloud(ann,hw,tt){
    return {
      announcements:(ann||[]).map(x=>({id:x.id,title:x.title,body:x.body,audience:x.audience,createdBy:x.creator_user_id,createdRole:'cloud',createdAt:x.created_at})),
      homework:(hw||[]).map(x=>({id:x.id,className:x.class_name,subject:x.subject,title:x.title,details:x.details||'',dueDate:x.due_date||'',createdBy:x.creator_user_id,createdRole:'cloud',createdAt:x.created_at})),
      timetable:(tt||[]).map(x=>({id:x.id,className:x.class_name,sectionName:x.section_name||'',day:x.weekday,periodNumber:Number(x.period_number||0),time:x.start_time?String(x.start_time).slice(0,5):'',endTime:x.end_time?String(x.end_time).slice(0,5):'',subject:x.subject,teacherName:x.teacher_name||'',roomLabel:x.room_label||'',createdBy:x.creator_user_id,createdRole:'cloud',createdAt:x.created_at,updatedAt:x.updated_at,cloudExisting:true}))
    };
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const c=cloud(),id=cfg().institutionId;
    const [a,h,t]=await Promise.all([
      c.state.client.from('school_announcements').select('*').eq('institution_id',id).order('created_at',{ascending:false}),
      c.state.client.from('homework_items').select('*').eq('institution_id',id).order('created_at',{ascending:false}),
      c.state.client.from('timetable_entries').select('*').eq('institution_id',id).order('weekday').order('start_time')
    ]);
    for(const r of [a,h,t])if(r.error)throw r.error;
    const mapped=mapCloud(a.data,h.data,t.data);write(mapped);return mapped;
  }
  async function insertCloud(kind,x){
    if(!cloudReady())return null;
    const c=cloud(),institution_id=cfg().institutionId,creator_user_id=c.state.user.id;
    let table,payload;
    if(kind==='announcements'){
      table='school_announcements';payload={institution_id,creator_user_id,audience:x.audience,title:x.title,body:x.body};
    }else if(kind==='homework'){
      table='homework_items';payload={institution_id,creator_user_id,class_name:x.className,subject:x.subject,title:x.title,details:x.details||null,due_date:x.dueDate||null};
    }else{
      table='timetable_entries';payload={institution_id,creator_user_id,class_name:x.className,section_name:x.sectionName||null,weekday:x.day,period_number:x.periodNumber||null,start_time:x.time||null,end_time:x.endTime||null,subject:x.subject,teacher_name:x.teacherName||null,room_label:x.roomLabel||null,updated_at:new Date().toISOString()};
    }
    const {data,error}=await c.state.client.from(table).insert(payload).select().single();
    if(error)throw error;return data;
  }
  async function deleteCloud(kind,id){
    if(!cloudReady())return;
    const table=kind==='announcements'?'school_announcements':kind==='homework'?'homework_items':'timetable_entries';
    const {error}=await cloud().state.client.from(table).delete().eq('id',id);
    if(error)throw error;
  }
  function appState(){return window.EDUNIZAM_APP_STATE||null}
  function allStudents(){
    try{
      return JSON.parse(localStorage.getItem('edunizam_students')||'[]');
    }catch{return[]}
  }
  function visibleStudents(){
    const list=allStudents();
    return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(list)||list;
  }
  function visibleClasses(){
    if(['head','teacher'].includes(role()))return null;
    return new Set(visibleStudents().map(s=>String(s.className||'').trim()).filter(Boolean));
  }
  function classVisible(name){
    const set=visibleClasses();return set===null||set.has(String(name||'').trim());
  }
  function audienceVisible(a){
    if(role()==='head'||role()==='teacher')return true;
    if(a==='all')return true;
    if(role()==='student')return a==='students';
    if(role()==='parent')return a==='parents';
    return false;
  }
  function mine(x){return role()==='head'||String(x.createdBy||'')===identity()}

  function mount(){
    const root=$('schoolWorkApp');if(!root)return;
    root.innerHTML=`
      <div class="section-head"><span class="academic-pill" id="swCloudStatus">${cloudStatus()}</span></div>
      <div class="school-work-tabs">
        <button class="secondary sw-tab active" data-sw-tab="announcements">Announcements</button>
        <button class="secondary sw-tab" data-sw-tab="homework">Homework</button>
        <button class="secondary sw-tab" data-sw-tab="timetable">Timetable</button>
      </div>
      <div id="swEditor"></div>
      <div id="swList" class="paper-grid" style="margin-top:16px"></div>`;
    root.querySelectorAll('[data-sw-tab]').forEach(b=>b.onclick=()=>{
      root.querySelectorAll('[data-sw-tab]').forEach(x=>x.classList.toggle('active',x===b));
      root.dataset.tab=b.dataset.swTab;render();
    });
    root.dataset.tab=root.dataset.tab||'announcements';
    render();
  }

  function editor(tab){
    if(!canEdit())return '<div class="coverage-note">Read-only view. Head/Teacher school work create karte hain.</div>';
    if(tab==='announcements')return `
      <article class="card"><h3>New Announcement</h3>
      <div class="form-grid">
        <input id="swAnnTitle" placeholder="Announcement title">
        <select id="swAnnAudience"><option value="all">All</option><option value="students">Students</option><option value="parents">Parents</option><option value="teachers">Teachers</option></select>
        <textarea id="swAnnBody" rows="3" placeholder="Notice / message"></textarea>
        <button id="swSaveAnnouncement">Publish</button>
      </div></article>`;
    if(tab==='homework')return `
      <article class="card"><h3>New Homework</h3>
      <div class="form-grid">
        <input id="swHwClass" placeholder="Class e.g. 5">
        <input id="swHwSubject" placeholder="Subject">
        <input id="swHwTitle" placeholder="Homework title">
        <input id="swHwDue" type="date" value="${nowDate()}">
        <textarea id="swHwDetails" rows="3" placeholder="Instructions"></textarea>
        <button id="swSaveHomework">Save Homework</button>
      </div></article>`;
    return `
      <article class="card"><h3>New Timetable Entry</h3>
      <div class="form-grid">
        <input id="swTtClass" placeholder="Class e.g. 5">
        <select id="swTtDay"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option></select>
        <input id="swTtTime" type="time">
        <input id="swTtSubject" placeholder="Subject">
        <input id="swTtTeacher" placeholder="Teacher name">
        <button id="swSaveTimetable">Add Period</button>
      </div></article>`;
  }

  function card(kind,x){
    const del=canEdit()&&mine(x)?'<button class="secondary" data-sw-delete="'+kind+':'+esc(x.id)+'">Delete</button>':'';
    if(kind==='announcements')return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">${esc(x.audience||'all')}</span><span class="muted">${new Date(x.createdAt).toLocaleDateString()}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><div class="paper-actions">${del}</div></article>`;
    if(kind==='homework')return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">Class ${esc(x.className)}</span><span class="mini-badge">${esc(x.subject)}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.details||'')}</p><p class="muted">Due: ${esc(x.dueDate||'Not set')}</p><div class="paper-actions">${del}</div></article>`;
    return `<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">Class ${esc(x.className)}</span><span class="mini-badge">${esc(x.day)}</span></div><h3>${esc(x.subject)}</h3><p class="muted">${esc(x.time||'')} · ${esc(x.teacherName||'Teacher')}</p><div class="paper-actions">${del}</div></article>`;
  }

  function bind(tab){
    if(tab==='announcements'&&$('swSaveAnnouncement'))$('swSaveAnnouncement').onclick=async()=>{
      const title=$('swAnnTitle').value.trim(),body=$('swAnnBody').value.trim();if(!title||!body)return alert('Title aur announcement likhein.');
      const item={id:String(Date.now()),title,body,audience:$('swAnnAudience').value,createdBy:identity(),createdRole:role(),createdAt:new Date().toISOString()};
      try{
        const row=await insertCloud('announcements',item);
        if(row)item.id=row.id,item.createdBy=row.creator_user_id,item.createdAt=row.created_at;
      }catch(e){alert('Cloud sync failed; item local mode mein save hoga. '+(e.message||e))}
      const d=read();d.announcements.unshift(item);write(d);render();
    };
    if(tab==='homework'&&$('swSaveHomework'))$('swSaveHomework').onclick=async()=>{
      const className=$('swHwClass').value.trim(),subject=$('swHwSubject').value.trim(),title=$('swHwTitle').value.trim();if(!className||!subject||!title)return alert('Class, subject aur title required hain.');
      const item={id:String(Date.now()),className,subject,title,dueDate:$('swHwDue').value,details:$('swHwDetails').value.trim(),createdBy:identity(),createdRole:role(),createdAt:new Date().toISOString()};
      try{
        const row=await insertCloud('homework',item);
        if(row)item.id=row.id,item.createdBy=row.creator_user_id,item.createdAt=row.created_at;
      }catch(e){alert('Cloud sync failed; homework local mode mein save hoga. '+(e.message||e))}
      const d=read();d.homework.unshift(item);write(d);render();
    };
    if(tab==='timetable'&&$('swSaveTimetable'))$('swSaveTimetable').onclick=async()=>{
      const className=$('swTtClass').value.trim(),subject=$('swTtSubject').value.trim();if(!className||!subject)return alert('Class aur subject required hain.');
      const item={id:String(Date.now()),className,day:$('swTtDay').value,time:$('swTtTime').value,subject,teacherName:$('swTtTeacher').value.trim(),createdBy:identity(),createdRole:role(),createdAt:new Date().toISOString()};
      try{
        const row=await insertCloud('timetable',item);
        if(row)item.id=row.id,item.createdBy=row.creator_user_id,item.createdAt=row.created_at;
      }catch(e){alert('Cloud sync failed; timetable local mode mein save hoga. '+(e.message||e))}
      const d=read();d.timetable.push(item);write(d);render();
    };
    document.querySelectorAll('[data-sw-delete]').forEach(b=>b.onclick=async()=>{
      const [kind,id]=b.dataset.swDelete.split(':');const d=read();const key=kind==='announcements'?'announcements':kind==='homework'?'homework':'timetable';
      const item=d[key].find(x=>String(x.id)===String(id));if(!item||!mine(item))return;
      try{await deleteCloud(kind,id)}catch(e){return alert('Cloud delete failed: '+(e.message||e))}
      d[key]=d[key].filter(x=>String(x.id)!==String(id));write(d);render();
    });
  }

  async function render(){
    const root=$('schoolWorkApp');if(!root)return mount();
    let d=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){
      root.dataset.cloudLoaded='1';
      try{d=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('School Work cloud sync:',e.message)}
    }
    const status=$('swCloudStatus');if(status)status.textContent=cloudStatus();
    const tab=root.dataset.tab||'announcements';$('swEditor').innerHTML=editor(tab);
    let arr=tab==='announcements'?d.announcements.filter(x=>audienceVisible(x.audience)):tab==='homework'?d.homework.filter(x=>classVisible(x.className)):d.timetable.filter(x=>classVisible(x.className));
    if(tab==='timetable'){
      const order=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      arr=[...arr].sort((a,b)=>order.indexOf(a.day)-order.indexOf(b.day)||String(a.time).localeCompare(String(b.time)));
    }
    $('swList').innerHTML=arr.length?arr.map(x=>card(tab,x)).join(''):'<div class="empty-state">Abhi koi relevant '+esc(tab)+' item nahi hai.</div>';
    bind(tab);
  }

  window.addEventListener('edunizam:auth',()=>{const root=$('schoolWorkApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(mount,0);setTimeout(mount,600);
  window.EDUNIZAM_SCHOOL_WORK={mount,render,read,pullCloud,cloudReady};
})();