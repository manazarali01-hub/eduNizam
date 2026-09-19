(function(){
  const KEY='edunizam_notice_board_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isStaff=()=>['teacher','head'].includes(role());
  const isHead=()=>role()==='head';
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function classOptions(){
    const set=new Set();visibleStudents().forEach(s=>{if(s.className)set.add(String(s.className))});
    try{JSON.parse(localStorage.getItem('edunizam_class_sections_v1')||'[]').forEach(x=>{if(x.className)set.add(String(x.className))})}catch(_){}
    return [...set].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  }
  function isExpired(x){return !!(x.validUntil&&x.validUntil<today())}
  function relevantLocal(x){
    if(isHead())return true;
    if(role()==='teacher')return true;
    if(isExpired(x))return false;
    if(x.audience==='all')return true;
    if(role()==='student'&&x.audience==='students')return true;
    if(role()==='parent'&&x.audience==='parents')return true;
    if(x.audience==='class'){
      return visibleStudents().some(s=>String(s.className||'')===String(x.className||'')&&(!x.sectionName||String(s.sectionName||'')===String(x.sectionName||'')));
    }
    return false;
  }
  function canManage(x){return isHead()||(role()==='teacher'&&(!x.createdBy||String(x.createdBy)===String(cloud()?.state?.user?.id||'')))}
  function mapRow(x){return {id:x.id,title:x.title,body:x.body,audience:x.audience,className:x.class_name||'',sectionName:x.section_name||'',priority:x.priority||'Normal',pinned:x.pinned===true,validUntil:x.valid_until||'',createdBy:x.creator_user_id||'',createdAt:x.created_at,updatedAt:x.updated_at||x.created_at}}
  async function pullCloud(){
    const {data,error}=await cloud().state.client.from('school_announcements').select('*').eq('institution_id',cfg().institutionId).order('pinned',{ascending:false}).order('created_at',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(mapRow);write(rows);return rows;
  }
  async function saveCloud(item){
    const payload={institution_id:cfg().institutionId,creator_user_id:item.createdBy||cloud().state.user.id,audience:item.audience,class_name:item.className||null,section_name:item.sectionName||null,title:item.title,body:item.body,priority:item.priority,pinned:item.pinned,valid_until:item.validUntil||null,updated_at:new Date().toISOString()};
    const q=item.cloudExisting?cloud().state.client.from('school_announcements').update(payload).eq('id',item.id):cloud().state.client.from('school_announcements').insert(payload);
    const {data,error}=await q.select().single();if(error)throw error;return mapRow(data);
  }
  async function deleteCloud(id){const {error}=await cloud().state.client.from('school_announcements').delete().eq('id',id);if(error)throw error}
  function editor(edit=null){
    if(!isStaff())return '<div class="coverage-note">Read-only Notice Board. School staff notices publish karte hain.</div>';
    return '<article class="card"><h3>'+(edit?'Edit Notice':'Publish Notice')+'</h3><div class="form-grid">'+
      '<input id="nbEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="nbTitle" placeholder="Notice title" value="'+esc(edit?.title||'')+'">'+
      '<select id="nbPriority">'+['Normal','Important','Urgent'].map(x=>'<option '+(edit?.priority===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<select id="nbAudience">'+[['all','All'],['students','Students'],['parents','Parents'],['teachers','Teachers'],['class','Specific Class']].map(x=>'<option value="'+x[0]+'" '+(edit?.audience===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+
      '<select id="nbClass"><option value="">Select class</option>'+classOptions().map(c=>'<option value="'+esc(c)+'" '+(edit?.className===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input id="nbSection" placeholder="Section (optional)" value="'+esc(edit?.sectionName||'')+'">'+
      '<input id="nbValidUntil" type="date" value="'+esc(edit?.validUntil||'')+'">'+
      '<label><input id="nbPinned" type="checkbox" '+(edit?.pinned?'checked':'')+'> Pin to top</label>'+
      '<textarea id="nbBody" rows="4" placeholder="Notice details">'+esc(edit?.body||'')+'</textarea>'+
      '<button id="nbSave">'+(edit?'Update Notice':'Publish Notice')+'</button>'+(edit?'<button id="nbCancel" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function priorityRisk(p){return p==='Urgent'?'high':p==='Important'?'medium':'good'}
  function card(x){
    const expired=isExpired(x);
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+(x.pinned?'📌 ':'')+esc(x.audience==='class'?('Class '+x.className+(x.sectionName?' - '+x.sectionName:'')):x.audience)+'</span><span id="profileRiskBadge" data-risk="'+priorityRisk(x.priority)+'">'+esc(x.priority)+'</span></div>'+
      '<h3>'+esc(x.title)+'</h3><p>'+esc(x.body)+'</p>'+
      '<p class="muted">Published '+new Date(x.createdAt).toLocaleDateString()+(x.validUntil?' · Valid until '+esc(x.validUntil):'')+(expired?' · Expired':'')+'</p>'+
      '<div class="paper-actions"><button class="secondary" data-nb-print="'+esc(x.id)+'">Print</button>'+(canManage(x)?'<button data-nb-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-nb-delete="'+esc(x.id)+'">Delete</button>':'')+'</div></article>';
  }
  function metrics(rows){
    const active=rows.filter(x=>!isExpired(x)),urgent=active.filter(x=>x.priority==='Urgent').length,pinned=active.filter(x=>x.pinned).length,expired=rows.filter(isExpired).length;
    return '<div class="cards"><article class="card stat"><span>Active Notices</span><strong>'+active.length+'</strong></article><article class="card stat"><span>Pinned</span><strong>'+pinned+'</strong></article><article class="card stat"><span>Urgent</span><strong>'+urgent+'</strong></article><article class="card stat"><span>Expired Archive</span><strong>'+expired+'</strong></article></div>';
  }
  async function save(){
    const id=$('nbEditId')?.value||'',title=$('nbTitle')?.value.trim(),body=$('nbBody')?.value.trim(),audience=$('nbAudience')?.value;
    if(!title||!body||!audience)return alert('Title, notice details aur audience required hain.');
    const className=$('nbClass')?.value||'',sectionName=$('nbSection')?.value.trim()||'';
    if(audience==='class'&&!className)return alert('Specific Class ke liye class select karein.');
    const rows=read(),old=rows.find(x=>String(x.id)===String(id));
    let item={id:id||String(Date.now()),title,body,audience,className:audience==='class'?className:'',sectionName:audience==='class'?sectionName:'',priority:$('nbPriority')?.value||'Normal',pinned:!!$('nbPinned')?.checked,validUntil:$('nbValidUntil')?.value||'',createdBy:old?.createdBy||cloud()?.state?.user?.id||'',createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),cloudExisting:!!(old&&cloudReady())};
    try{if(cloudReady())item=await saveCloud(item)}catch(e){return alert('Cloud notice save failed: '+(e.message||e))}
    write(rows.filter(x=>String(x.id)!==String(id)).concat(item));render();
  }
  function edit(id){const x=read().find(r=>String(r.id)===String(id));if(!x||!canManage(x))return;const b=$('nbEditor');if(b)b.innerHTML=editor(x);bindEditor()}
  async function remove(id){
    const x=read().find(r=>String(r.id)===String(id));if(!x||!canManage(x)||!confirm('Delete this notice?'))return;
    try{if(cloudReady())await deleteCloud(id)}catch(e){return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(r=>String(r.id)!==String(id)));render();
  }
  function printNotice(x){
    const st=settings(),w=window.open('','_blank','width=800,height=700');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>'+esc(x.title)+'</title><style>body{font-family:Arial;padding:35px;color:#17324a}.sheet{max-width:700px;margin:auto;border:2px solid #708998;padding:28px}.head{text-align:center}.body{font-size:18px;line-height:1.65;white-space:pre-wrap}.meta{margin:20px 0;color:#667}.sign{margin-top:60px;text-align:right}</style></head><body><div class="sheet"><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>NOTICE</h3></div><div class="meta">'+esc(x.priority)+' · '+esc(x.audience==='class'?('Class '+x.className+(x.sectionName?' - '+x.sectionName:'')):x.audience)+(x.validUntil?' · Valid until '+esc(x.validUntil):'')+'</div><h2>'+esc(x.title)+'</h2><div class="body">'+esc(x.body)+'</div><div class="sign">Authorized Signatory</div></div></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bindEditor(){
    $('nbSave')?.addEventListener('click',save);$('nbCancel')?.addEventListener('click',render);
    $('nbAudience')?.addEventListener('change',()=>{const show=$('nbAudience').value==='class';if($('nbClass'))$('nbClass').style.display=show?'block':'none';if($('nbSection'))$('nbSection').style.display=show?'block':'none'});
    $('nbAudience')?.dispatchEvent(new Event('change'));
  }
  function bind(rows){
    bindEditor();$('nbArchiveToggle')?.addEventListener('change',render);
    document.querySelectorAll('[data-nb-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.nbEdit));
    document.querySelectorAll('[data-nb-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.nbDelete));
    document.querySelectorAll('[data-nb-print]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>String(r.id)===String(b.dataset.nbPrint));if(x)printNotice(x)});
  }
  async function render(){
    const root=$('noticeBoardApp');if(!root)return;
    let rows=read();
    if(cloudReady()){try{rows=await pullCloud()}catch(e){console.warn('Notice board cloud sync:',e.message)}}
    rows=rows.filter(relevantLocal);
    const showArchive=isStaff()&&($('nbArchiveToggle')?.checked||root.dataset.archive==='1');root.dataset.archive=showArchive?'1':'0';
    const shown=rows.filter(x=>showArchive?true:!isExpired(x)).sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||({Urgent:3,Important:2,Normal:1}[b.priority]-({Urgent:3,Important:2,Normal:1}[a.priority]))||String(b.createdAt).localeCompare(String(a.createdAt)));
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div>'+(isStaff()?'<label><input id="nbArchiveToggle" type="checkbox" '+(showArchive?'checked':'')+'> Show expired archive</label>':'')+'</div>'+
      metrics(rows)+'<div id="nbEditor" style="margin-top:16px">'+editor()+'</div>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>'+ (showArchive?'Notice History':'Active Notices') +'</h3><p class="muted">Pinned notices stay at the top.</p></div></div><div class="paper-grid">'+(shown.length?shown.map(card).join(''):'<div class="empty-state">No notices available.</div>')+'</div>';
    bind(rows);
  }
  window.addEventListener('edunizam:auth',render);
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_NOTICE_BOARD={render,pullCloud,cloudReady};
})();