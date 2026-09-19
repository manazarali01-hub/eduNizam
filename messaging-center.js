(function(){
  const CONV_KEY='edunizam_local_conversations_v1';
  const MSG_KEY='edunizam_local_messages_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const identity=()=>String(session()?.identity||'').trim().toLowerCase();
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const uid=()=>cloud()?.state?.user?.id||'';
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function staff(){try{return JSON.parse(localStorage.getItem('edunizam_staff_profiles_v1')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  let contacts=[],conversations=[],activeId='',messages=[],unreadByConversation={};

  function roleLabel(r){return ({head:'Head of Institute',teacher:'Teacher',parent:'Parent / Guardian',student:'Student'}[r]||r)}
  function localUserKey(){return role()+':'+(identity()||'local')}
  function localContacts(){
    const r=role(),list=visibleStudents(),all=students(),rows=[];
    if(r==='head'){
      all.forEach(s=>rows.push({targetKey:'parent:'+s.id,targetRole:'parent',displayName:s.father||('Parent of '+s.name),studentKey:String(s.id),studentName:s.name,conversationType:'head-parent'}));
    }else if(r==='teacher'){
      list.forEach(s=>{
        rows.push({targetKey:'student:'+s.id,targetRole:'student',displayName:s.name,studentKey:String(s.id),studentName:s.name,conversationType:'teacher-student'});
        rows.push({targetKey:'parent:'+s.id,targetRole:'parent',displayName:s.father||('Parent of '+s.name),studentKey:String(s.id),studentName:s.name,conversationType:'teacher-parent'});
      });
    }else if(r==='parent'){
      list.forEach(s=>rows.push({targetKey:'head:'+s.id,targetRole:'head',displayName:'Head of Institute',studentKey:String(s.id),studentName:s.name,conversationType:'head-parent'}));
    }else if(r==='student'){
      const teacher=staff().find(x=>x.status!=='inactive');
      list.forEach(s=>{if(teacher)rows.push({targetKey:'teacher:'+teacher.id,targetRole:'teacher',displayName:teacher.fullName,studentKey:String(s.id),studentName:s.name,conversationType:'teacher-student'})});
    }
    const seen=new Set();return rows.filter(x=>{const k=x.targetKey+'|'+x.studentKey+'|'+x.conversationType;if(seen.has(k))return false;seen.add(k);return true});
  }
  async function loadContacts(){
    if(!cloudReady()){contacts=localContacts();return contacts}
    const {data,error}=await cloud().state.client.rpc('list_message_contacts');
    if(error)throw error;
    contacts=(data||[]).map(x=>({targetUserId:x.target_user_id,targetRole:x.target_role,displayName:x.display_name,studentUserId:x.student_user_id,studentName:x.student_name,conversationType:x.conversation_type}));
    return contacts;
  }
  function localVisibleConversation(c){
    const me=localUserKey();
    if(c.participantAKey===me||c.participantBKey===me)return true;
    const id=identity();
    if(!id)return false;
    const targetStudent=students().find(s=>[s.id,s.studentId,s.rollNo,s.phone].some(v=>String(v??'').trim().toLowerCase()===id));
    if(!targetStudent)return false;
    if(role()==='parent')return c.conversationType==='head-parent'||c.conversationType==='teacher-parent' ? String(c.studentKey)===String(targetStudent.id):false;
    if(role()==='student')return c.conversationType==='teacher-student'&&String(c.studentKey)===String(targetStudent.id);
    return false;
  }
  async function loadConversations(){
    if(!cloudReady()){
      conversations=read(CONV_KEY).filter(localVisibleConversation).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
      const allMsgs=read(MSG_KEY),me=localUserKey();unreadByConversation={};
      allMsgs.filter(m=>!m.readAt&&m.senderKey!==me).forEach(m=>unreadByConversation[m.conversationId]=(unreadByConversation[m.conversationId]||0)+1);
      return conversations;
    }
    const c=cloud().state.client;
    const [cr,mr]=await Promise.all([
      c.from('school_conversations').select('*').eq('institution_id',cfg().institutionId).order('updated_at',{ascending:false}),
      c.from('school_messages').select('conversation_id,sender_user_id,read_at')
    ]);
    if(cr.error)throw cr.error;if(mr.error)throw mr.error;
    conversations=cr.data||[];unreadByConversation={};
    (mr.data||[]).filter(m=>!m.read_at&&m.sender_user_id!==uid()).forEach(m=>unreadByConversation[m.conversation_id]=(unreadByConversation[m.conversation_id]||0)+1);
    return conversations;
  }
  function conversationOtherName(c){
    if(!cloudReady()){
      const me=localUserKey();return c.participantAKey===me?c.participantBLabel:c.participantALabel;
    }
    return c.participant_a===uid()?c.participant_b_label:c.participant_a_label;
  }
  async function openConversation(id){
    activeId=String(id);
    if(!cloudReady()){
      const me=localUserKey(),all=read(MSG_KEY);
      messages=all.filter(m=>String(m.conversationId)===activeId).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
      let changed=false;all.forEach(m=>{if(String(m.conversationId)===activeId&&m.senderKey!==me&&!m.readAt){m.readAt=new Date().toISOString();changed=true}});if(changed)write(MSG_KEY,all);
    }else{
      const {data,error}=await cloud().state.client.from('school_messages').select('*').eq('conversation_id',id).order('created_at');
      if(error)throw error;messages=data||[];
      const {error:re}=await cloud().state.client.rpc('mark_school_messages_read',{p_conversation_id:id});if(re)console.warn(re.message);
    }
    await loadConversations();renderUI();
  }
  async function startConversation(){
    const key=$('msgContact')?.value,subject=$('msgSubject')?.value.trim()||'General';
    if(!key)return alert('Contact select karein.');
    const contact=contacts[Number(key)];if(!contact)return;
    if(!cloudReady()){
      const me=localUserKey(),myLabel=roleLabel(role()),targetKey=contact.targetKey;
      const c={id:String(Date.now()),conversationType:contact.conversationType,studentKey:contact.studentKey,studentName:contact.studentName,participantAKey:me,participantBKey:targetKey,participantALabel:myLabel,participantBLabel:contact.displayName,subject,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      const arr=read(CONV_KEY);arr.unshift(c);write(CONV_KEY,arr);await loadConversations();await openConversation(c.id);return;
    }
    const {data,error}=await cloud().state.client.rpc('create_school_conversation',{
      p_target_user_id:contact.targetUserId,p_student_user_id:contact.studentUserId,p_conversation_type:contact.conversationType,p_subject:subject
    });
    if(error)return alert(error.message||error);
    const row=Array.isArray(data)?data[0]:data;if(!row?.id)return alert('Conversation create nahi hui.');
    await loadConversations();await openConversation(row.id);
  }
  async function sendMessage(){
    const body=$('msgBody')?.value.trim();if(!activeId||!body)return;
    if(body.length>4000)return alert('Message 4000 characters se chhota rakhein.');
    if(!cloudReady()){
      const arr=read(MSG_KEY);arr.push({id:String(Date.now()),conversationId:activeId,senderKey:localUserKey(),senderLabel:roleLabel(role()),body,createdAt:new Date().toISOString(),readAt:null});write(MSG_KEY,arr);
      const cs=read(CONV_KEY),c=cs.find(x=>String(x.id)===activeId);if(c)c.updatedAt=new Date().toISOString();write(CONV_KEY,cs);$('msgBody').value='';await openConversation(activeId);return;
    }
    const {data,error}=await cloud().state.client.rpc('send_school_message',{p_conversation_id:activeId,p_body:body});
    if(error)return alert(error.message||error);
    $('msgBody').value='';await openConversation(activeId);
  }
  function conversationList(){
    return conversations.length?conversations.map(c=>{
      const unread=unreadByConversation[c.id]||0;
      const student=cloudReady()?c.student_name:c.studentName,subject=c.subject||'General',type=cloudReady()?c.conversation_type:c.conversationType;
      return '<button class="msg-conv '+(String(c.id)===activeId?'active':'')+'" data-msg-open="'+esc(c.id)+'"><strong>'+esc(conversationOtherName(c))+'</strong><span>'+esc(subject)+'</span><small>'+esc(type.replace(/-/g,' ↔ '))+' · '+esc(student||'Student')+(unread?' · '+unread+' unread':'')+'</small></button>';
    }).join(''):'<div class="muted">Abhi koi conversation nahi.</div>';
  }
  function thread(){
    if(!activeId)return '<div class="msg-empty">Conversation select karein ya nayi conversation start karein.</div>';
    const c=conversations.find(x=>String(x.id)===activeId);
    if(!c)return '<div class="msg-empty">Conversation unavailable.</div>';
    const me=cloudReady()?uid():localUserKey();
    const rows=messages.map(m=>{
      const mine=cloudReady()?m.sender_user_id===me:m.senderKey===me;
      const body=cloudReady()?m.body:m.body,created=cloudReady()?m.created_at:m.createdAt;
      return '<div class="msg-line '+(mine?'mine':'theirs')+'"><div>'+esc(body)+'</div><small>'+new Date(created).toLocaleString()+'</small></div>';
    }).join('');
    return '<div class="msg-thread-head"><strong>'+esc(conversationOtherName(c))+'</strong><span>'+esc(c.subject||'General')+'</span></div><div class="msg-thread">'+(rows||'<div class="msg-empty">No messages yet.</div>')+'</div><div class="msg-compose"><textarea id="msgBody" rows="3" maxlength="4000" placeholder="Write a message..."></textarea><button id="msgSend">Send</button></div>';
  }
  function createPanel(){
    const note=cloudReady()?'Contacts are based on approved links and assignments.':'Local demo mode: secure cross-device messaging activates with Cloud Mode.';
    return '<article class="card"><h3>New Conversation</h3><p class="muted">'+esc(note)+'</p><div class="form-grid"><select id="msgContact"><option value="">Select linked contact</option>'+contacts.map((x,i)=>'<option value="'+i+'">'+esc(x.displayName)+' · '+esc(x.conversationType.replace(/-/g,' ↔ '))+' · '+esc(x.studentName||'')+'</option>').join('')+'</select><input id="msgSubject" placeholder="Subject" value="General"><button id="msgStart">Start Conversation</button></div></article>';
  }
  function renderUI(){
    const root=$('inboxCenterApp');if(!root)return;
    root.innerHTML='<style>.msg-layout{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(360px,1.5fr);gap:16px}.msg-list{display:grid;gap:8px}.msg-conv{display:grid;gap:4px;text-align:left;padding:12px;border:1px solid #dce6eb;border-radius:12px;background:#fff;color:inherit}.msg-conv.active{outline:2px solid #0f766e;background:#eef9f7}.msg-conv span,.msg-conv small{color:#667}.msg-thread-wrap{min-height:420px;display:flex;flex-direction:column}.msg-thread-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e6edef;padding-bottom:10px}.msg-thread{display:flex;flex-direction:column;gap:9px;min-height:280px;max-height:480px;overflow:auto;padding:14px 0}.msg-line{max-width:78%;padding:10px 12px;border-radius:14px;background:#edf2f5}.msg-line.mine{align-self:flex-end;background:#dff3ef}.msg-line.theirs{align-self:flex-start}.msg-line small{display:block;color:#697b86;font-size:11px;margin-top:5px}.msg-compose{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:auto}.msg-compose textarea{width:100%;box-sizing:border-box}.msg-empty{padding:40px 12px;text-align:center;color:#6a7b88}@media(max-width:800px){.msg-layout{grid-template-columns:1fr}.msg-compose{grid-template-columns:1fr}}</style>'+
      '<div class="section-head"><span class="academic-pill">'+(cloudReady()?'Secure Cloud Inbox':'Local Demo Mode')+'</span></div>'+createPanel()+
      '<div class="msg-layout" style="margin-top:16px"><article class="card"><div class="section-head"><h3>Conversations</h3><button id="msgRefresh" class="secondary">Refresh</button></div><div class="msg-list">'+conversationList()+'</div></article><article class="card msg-thread-wrap">'+thread()+'</article></div>';
    $('msgStart')?.addEventListener('click',startConversation);$('msgRefresh')?.addEventListener('click',render);
    $('msgSend')?.addEventListener('click',sendMessage);
    document.querySelectorAll('[data-msg-open]').forEach(b=>b.onclick=()=>openConversation(b.dataset.msgOpen));
  }
  async function render(){
    const root=$('inboxCenterApp');if(!root)return;
    root.innerHTML='<div class="coverage-note">Inbox loading...</div>';
    try{await Promise.all([loadContacts(),loadConversations()]);if(activeId){const exists=conversations.some(x=>String(x.id)===activeId);if(!exists){activeId='';messages=[]}}renderUI()}
    catch(e){root.innerHTML='<div class="empty-state">Inbox error: '+esc(e.message||e)+'</div>'}
  }
  window.addEventListener('edunizam:auth',()=>{activeId='';messages=[];render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_MESSAGING_CENTER={render,openConversation,cloudReady};
})();