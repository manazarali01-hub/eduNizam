(function(){
  'use strict';
  if(window.EDUNIZAM_ACADEMIC_WORKFLOW_DEEP)return;

  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'{}')}catch{return{}}};
  const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const uid=()=>String(cloud()?.state?.user?.id||'');
  const read=(k,fallback)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?fallback:v}catch{return fallback}};
  const allStudents=()=>read('edunizam_students',[]);
  const visibleStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(allStudents())||allStudents();
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const dateDiff=(a,b)=>Math.ceil((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);
  const normalizeClass=v=>String(v||'').trim().replace(/\s*[·|-]\s*[^·|-]+$/,'').trim();
  const classKey=(c,s)=>normalizeClass(c).toLowerCase()+'|'+String(s||'').trim().toLowerCase();
  const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  function setBoxHtml(el,html){if(!el)return false;if(el.__eduDeepHtml===html)return false;el.__eduDeepHtml=html;el.innerHTML=html;return true}

  function downloadText(name,text,type='text/plain;charset=utf-8'){
    const blob=new Blob([text],{type}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0);
  }
  function printHtml(title,body){
    const w=window.open('','_blank','width=980,height=760');
    if(!w)return alert('Popup blocked. Browser mein popups allow karein.');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17324a}.card,.paper-card{border:1px solid #d9e2e7;border-radius:12px;padding:14px;margin:10px 0}.paper-card-top,.section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mini-badge,.academic-pill,.badge{display:inline-block;border:1px solid #ccd8de;border-radius:999px;padding:4px 8px;margin:2px}.muted{color:#667}.row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:8px 0;border-bottom:1px solid #e8edef}.coverage-note{background:#f5f8fa;border-radius:10px;padding:10px;margin:8px 0}button,input,select,textarea{display:none!important}@media print{body{padding:0}.card,.paper-card{break-inside:avoid}}</style></head><body><h1>'+esc(title)+'</h1>'+body+'</body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }

  // ---------- Smart Paper Builder: quality audit + answer-key tools ----------
  function paperAuditData(){
    const preview=$('#paperPreview');
    if(!preview)return null;
    const editable=[...preview.querySelectorAll('[data-q]')];
    const questions=editable.length?editable.map(x=>x.value.trim()):[...preview.querySelectorAll('.pb-question')].map(x=>x.textContent.replace(/^Q\d+\.\s*/,'').trim());
    const normalized=questions.map(q=>q.toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9\u0600-\u06ff ]/g,'').trim()).filter(Boolean);
    const seen=new Map();normalized.forEach(q=>seen.set(q,(seen.get(q)||0)+1));
    const duplicates=[...seen.values()].filter(n=>n>1).reduce((a,n)=>a+n-1,0);
    const empty=questions.filter(q=>!q.trim()).length;
    const sections=[...preview.querySelectorAll('.pb-section')];
    const marks=sections.reduce((sum,s)=>{const m=String(s.querySelector('h3 span')?.textContent||'').match(/([0-9.]+)/);return sum+(m?Number(m[1]):0)},0);
    const answers=preview.querySelectorAll('.pb-answer-key p').length;
    return {questions,duplicates,empty,sections:sections.length,marks,answers};
  }
  function renderPaperAudit(){
    const root=$('#paperBuilderApp'),preview=$('#paperPreview');
    if(!root||!preview||!preview.querySelector('.pb-print-sheet'))return;
    let box=$('#pbDeepQa');
    if(!box){box=document.createElement('article');box.id='pbDeepQa';box.className='card no-print';preview.before(box)}
    const d=paperAuditData();if(!d)return;
    const keyCoverage=d.questions.length?Math.round((d.answers/d.questions.length)*100):0;
    const risk=d.duplicates||d.empty?'Needs review':'Ready for teacher verification';
    const html='<div class="section-head"><div><div class="academic-kicker">Paper Quality Control</div><h3>Blueprint & QA</h3><p class="muted">Print se pehle duplicate, empty question, section marks aur answer-key coverage check karein.</p></div><span class="academic-pill">'+esc(risk)+'</span></div>'+
      '<div class="pp-stats"><article><span>Questions</span><strong>'+d.questions.length+'</strong></article><article><span>Section Marks</span><strong>'+d.marks+'</strong></article><article><span>Answer Key</span><strong>'+keyCoverage+'%</strong></article><article><span>Duplicates</span><strong>'+d.duplicates+'</strong></article></div>'+
      (d.empty?'<div class="coverage-note"><strong>Attention:</strong> '+d.empty+' empty question(s) detected.</div>':'')+
      (d.duplicates?'<div class="coverage-note"><strong>Attention:</strong> '+d.duplicates+' duplicate/repeated question(s) detected. Edit the repeated wording before printing.</div>':'')+
      '<div class="paper-actions"><button id="pbDeepRefresh" class="secondary">Recheck Paper</button><button id="pbDeepPrintKey" class="secondary">Print Answer Key Only</button><button id="pbDeepDownload" class="secondary">Download Paper Text</button></div>';
    if(!setBoxHtml(box,html))return;
    $('#pbDeepRefresh').onclick=renderPaperAudit;
    $('#pbDeepPrintKey').onclick=()=>{
      const key=preview.querySelector('.pb-answer-key');
      if(!key)return alert('Answer key abhi available nahi hai.');
      printHtml('EduNizam Teacher Answer Key',key.outerHTML);
    };
    $('#pbDeepDownload').onclick=()=>{
      const sheet=preview.querySelector('.pb-print-sheet');
      if(!sheet)return;
      const lines=[...sheet.querySelectorAll('h1,h2,h3,p,.pb-question,.pb-meta span')].map(x=>x.textContent.trim()).filter(Boolean);
      downloadText('edunizam-paper-'+today()+'.txt',lines.join('\n\n'));
    };
  }

  // ---------- Daily Diary: engagement, completeness, bulk family acknowledgement ----------
  function diaryScopeRows(rows){
    if(!['student','parent'].includes(role()))return rows;
    const allowed=new Set(visibleStudents().map(s=>classKey(s.className,s.sectionName)));
    return rows.filter(r=>{
      const key=classKey(r.class_name,r.section_name);
      if(allowed.has(key))return true;
      return [...allowed].some(k=>{const [c,s]=k.split('|'),raw=String(r.class_name||'').toLowerCase();return raw===c||raw===c+' · '+s||raw===c+' - '+s});
    });
  }
  function applyDiaryUiFilters(rows){
    const cls=$('#diaryViewClass')?.value||'',subject=String($('#diaryViewSubject')?.value||'').trim().toLowerCase(),search=String($('#diarySearch')?.value||'').trim().toLowerCase();
    return rows.filter(x=>{
      if(cls&&normalizeClass(x.class_name)!==normalizeClass(cls))return false;
      if(subject&&!String(x.subject||'').toLowerCase().includes(subject))return false;
      if(search&&!([x.topic,x.homework,x.instructions,x.subject,x.class_name,x.section_name].join(' ').toLowerCase().includes(search)))return false;
      return true;
    });
  }
  function diaryAckCurrent(a,row){
    if(!a?.diary_updated_at||!row?.updated_at)return false;
    return Math.abs(new Date(a.diary_updated_at).getTime()-new Date(row.updated_at).getTime())<1000;
  }
  async function loadDiaryDeep(){
    const root=$('#dailyDiaryApp');if(!root||!cloudReady())return;
    const end=$('#diaryFilterDate')?.value||today(),range=$('#diaryRange')?.value||'day';
    let start=end;
    if(range!=='day'){
      const d=new Date(end+'T00:00:00');d.setDate(d.getDate()-(range==='week'?6:29));
      start=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    }
    const c=cloud().state.client;
    let q=c.from('daily_class_diaries').select('*').eq('institution_id',cfg().institutionId).gte('diary_date',start).lte('diary_date',end).order('diary_date',{ascending:false}).limit(300);
    const {data,error}=await q;if(error)return;
    let rows=applyDiaryUiFilters(diaryScopeRows(data||[])),acks=[];
    const ids=rows.map(x=>x.id).filter(Boolean);
    if(ids.length){
      const r=await c.from('daily_diary_acknowledgements').select('*').in('diary_id',ids);
      if(!r.error)acks=r.data||[];
    }
    const byDiary=new Map();acks.forEach(a=>{const k=String(a.diary_id);if(!byDiary.has(k))byDiary.set(k,[]);byDiary.get(k).push(a)});
    rows=rows.map(x=>({...x,_acks:byDiary.get(String(x.id))||[]}));
    const subjects=new Set(rows.map(x=>x.subject).filter(Boolean));
    const classes=new Set(rows.map(x=>classKey(x.class_name,x.section_name)).filter(Boolean));
    const homework=rows.filter(x=>String(x.homework||'').trim()).length;
    let extra='',action='';
    if(role()==='teacher'){
      const cr=await c.from('class_sections').select('class_name,section_name').eq('institution_id',cfg().institutionId).eq('class_teacher_user_id',uid()).eq('active',true);
      const assigned=cr.error?[]:(cr.data||[]);
      const todayRows=(data||[]).filter(x=>x.diary_date===today()&&String(x.teacher_user_id||'')===uid());
      const covered=new Set(todayRows.map(x=>classKey(x.class_name,x.section_name)));
      const missing=assigned.filter(x=>!covered.has(classKey(x.class_name,x.section_name)));
      extra='<div class="coverage-note"><strong>Today class coverage:</strong> '+(assigned.length-missing.length)+' / '+assigned.length+' assigned class-section(s) have at least one diary entry.'+(missing.length?'<br><strong>Missing today:</strong> '+missing.map(x=>esc(x.class_name)+(x.section_name?' · '+esc(x.section_name):'')).join(', '):'')+'</div>';
    }else if(['student','parent'].includes(role())){
      const me=uid(),unseen=rows.filter(x=>!(x._acks||[]).some(a=>String(a.viewer_user_id||'')===me&&diaryAckCurrent(a,x)));
      extra='<div class="coverage-note"><strong>Reading status:</strong> '+(rows.length-unseen.length)+' seen · '+unseen.length+' unseen in this filtered range.</div>';
      if(unseen.length)action='<button id="diaryDeepMarkAll">Mark Filtered Diaries Seen</button>';
    }else{
      const currentAcks=rows.reduce((n,x)=>n+(x._acks||[]).filter(a=>diaryAckCurrent(a,x)).length,0);
      extra='<div class="coverage-note"><strong>Engagement:</strong> '+currentAcks+' current-version acknowledgement(s) across these diary entries.</div>';
    }
    let box=$('#diaryDeepOps');
    if(!box){
      box=document.createElement('article');box.id='diaryDeepOps';box.className='card';
      const history=[...root.querySelectorAll('.section-head')].find(x=>x.querySelector('h3')?.textContent.includes('Daily Diary History'));
      history?.before(box);
    }
    if(!box)return;
    const html='<div class="section-head"><div><div class="academic-kicker">Diary Intelligence</div><h3>Coverage & Family Engagement</h3><p class="muted">'+esc(start)+' → '+esc(end)+' · current filters applied.</p></div><span class="academic-pill">'+esc(role())+'</span></div>'+
      '<div class="pp-stats"><article><span>Entries</span><strong>'+rows.length+'</strong></article><article><span>Classes</span><strong>'+classes.size+'</strong></article><article><span>Subjects</span><strong>'+subjects.size+'</strong></article><article><span>Homework</span><strong>'+homework+'</strong></article></div>'+extra+
      '<div class="paper-actions"><button id="diaryDeepRefresh" class="secondary">Refresh Metrics</button><button id="diaryDeepPrint" class="secondary">Print Filtered Diary</button><button id="diaryDeepCsv" class="secondary">Export CSV</button>'+action+'</div>';
    if(!setBoxHtml(box,html))return;
    $('#diaryDeepRefresh').onclick=loadDiaryDeep;
    $('#diaryDeepPrint').onclick=()=>{
      const list=$('#diaryList');if(!list)return;
      printHtml('EduNizam Daily Diary '+start+' to '+end,list.innerHTML);
    };
    $('#diaryDeepCsv').onclick=()=>{
      const lines=[['Date','Class','Section','Subject','Topic','Homework','Instructions'].map(csvCell).join(',')];
      rows.forEach(x=>lines.push([x.diary_date,x.class_name,x.section_name,x.subject,x.topic,x.homework,x.instructions].map(csvCell).join(',')));
      downloadText('edunizam-diary-'+end+'.csv',lines.join('\n'),'text/csv;charset=utf-8');
    };
    if($('#diaryDeepMarkAll'))$('#diaryDeepMarkAll').onclick=async()=>{
      const me=uid(),unseen=rows.filter(x=>!(x._acks||[]).some(a=>String(a.viewer_user_id||'')===me&&diaryAckCurrent(a,x)));
      if(!unseen.length)return;
      const payload=unseen.map(x=>({institution_id:cfg().institutionId,diary_id:x.id,viewer_user_id:me,viewer_role:role(),diary_updated_at:x.updated_at,viewed_at:new Date().toISOString()}));
      const {error}=await c.from('daily_diary_acknowledgements').upsert(payload,{onConflict:'diary_id,viewer_user_id'});
      if(error)return alert(error.message||error);
      window.EDUNIZAM_PREMIUM?.toast?.('Filtered diary entries marked as seen.','success');
      await window.EDUNIZAM_DAILY_DIARY?.load?.();await loadDiaryDeep();
    };
  }

  // ---------- School Work: assignment operations, missing work, grading queue ----------
  function schoolWorkVisibleHomework(d){
    const rows=d.homework||[];
    if(['head','teacher'].includes(role()))return rows;
    const classes=new Set(visibleStudents().map(s=>String(s.className||'').trim()).filter(Boolean));
    return rows.filter(x=>classes.has(String(x.className||'').trim()));
  }
  function expectedForHomework(hw){
    return allStudents().filter(s=>{
      if(String(s.className||'').trim()!==String(hw.className||'').trim())return false;
      if(hw.sectionName&&String(s.sectionName||'').trim().toLowerCase()!==String(hw.sectionName).trim().toLowerCase())return false;
      return true;
    });
  }
  function schoolWorkMetrics(){
    const api=window.EDUNIZAM_SCHOOL_WORK;if(!api?.read)return null;
    const d=api.read(),homework=schoolWorkVisibleHomework(d),subs=d.submissions||[],visIds=new Set(visibleStudents().map(s=>String(s.id)));
    const relevantSubs=['student','parent'].includes(role())?subs.filter(s=>visIds.has(String(s.studentId))):subs;
    const dueSoon=homework.filter(h=>h.dueDate&&dateDiff(today(),h.dueDate)>=0&&dateDiff(today(),h.dueDate)<=3).length;
    const overdue=homework.filter(h=>h.dueDate&&h.dueDate<today()).length;
    const grading=relevantSubs.filter(s=>['submitted','late'].includes(String(s.status||'').toLowerCase())).length;
    const graded=relevantSubs.filter(s=>String(s.status||'').toLowerCase()==='graded').length;
    const returned=relevantSubs.filter(s=>String(s.status||'').toLowerCase()==='returned').length;
    const rows=homework.map(h=>{
      const hs=subs.filter(s=>String(s.homeworkId)===String(h.id));
      if(['student','parent'].includes(role())){
        const mine=hs.filter(s=>visIds.has(String(s.studentId)));
        const missing=visibleStudents().filter(st=>String(st.className||'').trim()===String(h.className||'').trim()&&(!h.sectionName||String(st.sectionName||'').trim().toLowerCase()===String(h.sectionName).trim().toLowerCase())).filter(st=>!mine.some(s=>String(s.studentId)===String(st.id)));
        return {h,submitted:mine.length,expected:missing.length+mine.length,missing:missing.length};
      }
      const expected=expectedForHomework(h),submittedIds=new Set(hs.map(s=>String(s.studentId)));
      return {h,submitted:submittedIds.size,expected:expected.length,missing:Math.max(0,expected.length-submittedIds.size)};
    });
    const missingTotal=rows.reduce((a,x)=>a+x.missing,0);
    return {d,homework,relevantSubs,dueSoon,overdue,grading,graded,returned,rows,missingTotal};
  }
  function renderSchoolWorkDeep(){
    const root=$('#schoolWorkApp'),m=schoolWorkMetrics();if(!root||!m)return;
    let box=$('#swDeepOps');
    if(!box){
      box=document.createElement('article');box.id='swDeepOps';box.className='card';
      const tabs=root.querySelector('.school-work-tabs');tabs?.after(box);
    }
    if(!box)return;
    const family=['student','parent'].includes(role());
    const attention=[...m.rows].sort((a,b)=>{
      const ap=a.h.dueDate&&a.h.dueDate<today()?0:a.missing?1:2,bp=b.h.dueDate&&b.h.dueDate<today()?0:b.missing?1:2;
      return ap-bp||String(a.h.dueDate||'9999').localeCompare(String(b.h.dueDate||'9999'));
    }).slice(0,8);
    const html='<div class="section-head"><div><div class="academic-kicker">Assignment Operations</div><h3>'+(family?'My Learning Status':'Submission & Missing-Work Dashboard')+'</h3><p class="muted">Homework, due dates, submission coverage aur grading queue ek jagah.</p></div><span class="academic-pill">'+(window.EDUNIZAM_SCHOOL_WORK.cloudReady?.()?'Cloud Sync':'Local Mode')+'</span></div>'+
      '<div class="pp-stats"><article><span>Assignments</span><strong>'+m.homework.length+'</strong></article><article><span>Due ≤ 3 Days</span><strong>'+m.dueSoon+'</strong></article><article><span>'+(family?'Missing Work':'Missing Submissions')+'</span><strong>'+m.missingTotal+'</strong></article><article><span>'+(family?'Graded':'To Grade')+'</span><strong>'+(family?m.graded:m.grading)+'</strong></article></div>'+
      '<div class="paper-actions"><button id="swDeepHomework" class="secondary">Open Homework</button><button id="swDeepSubs" class="secondary">Open Submissions</button><button id="swDeepCsv" class="secondary">Export Submission CSV</button><button id="swDeepPrint" class="secondary">Print Overview</button></div>'+
      '<div class="list" style="margin-top:12px">'+(attention.length?attention.map(x=>'<div class="row"><strong>'+esc(x.h.title||'Assignment')+'</strong><span>'+esc(x.h.className||'-')+(x.h.sectionName?' · '+esc(x.h.sectionName):'')+'</span><span>'+esc(x.h.subject||'-')+'</span><span>Due '+esc(x.h.dueDate||'Not set')+'</span><span>'+x.submitted+'/'+x.expected+' submitted · '+x.missing+' missing</span></div>').join(''):'<div class="empty-state">No assignment records yet.</div>')+'</div>';
    if(!setBoxHtml(box,html))return;
    const switchTab=name=>{
      const b=root.querySelector('[data-sw-tab="'+name+'"]');if(b){b.click();setTimeout(()=>$('[id="swEditor"]')?.scrollIntoView({behavior:'smooth',block:'start'}),60)}
    };
    $('#swDeepHomework').onclick=()=>switchTab('homework');
    $('#swDeepSubs').onclick=()=>switchTab('submissions');
    $('#swDeepCsv').onclick=()=>{
      const lines=[['Assignment','Class','Section','Subject','Due Date','Student','Status','Marks','Feedback','Submitted At'].map(csvCell).join(',')];
      const hwMap=new Map((m.d.homework||[]).map(h=>[String(h.id),h]));
      m.relevantSubs.forEach(s=>{const h=hwMap.get(String(s.homeworkId))||{};lines.push([h.title,h.className,h.sectionName,h.subject,h.dueDate,s.studentName,s.status,s.marks,s.feedback,s.submittedAt].map(csvCell).join(','))});
      downloadText('edunizam-submissions-'+today()+'.csv',lines.join('\n'),'text/csv;charset=utf-8');
    };
    $('#swDeepPrint').onclick=()=>printHtml('EduNizam Assignment Overview',box.querySelector('.list')?.outerHTML||'');
  }

  // ---------- Inbox: role-aware quick message templates ----------
  function enhanceMessaging(){
    const root=$('#inboxCenterApp'),body=$('#msgBody');if(!root||!body||$('#msgQuickTemplates'))return;
    const templates={
      teacher:['Homework reminder: Please review today’s assigned work and due date.','Attendance follow-up: I would like to discuss the student’s recent attendance.','Parent meeting request: Please share a suitable time for a short school discussion.','Positive progress: The student showed good effort and progress today.'],
      parent:['Homework question: Please guide me about today’s homework and expected completion.','Absence update: I want to update you about my child’s absence/leave.','Meeting request: Please share a suitable time to discuss my child’s progress.'],
      head:['School follow-up: Please review this message and contact the school if clarification is needed.','Meeting request: Please share your availability for a school meeting.','Fee follow-up: Please review the latest fee/challan status in EduNizam.'],
      student:['Assignment question: I need clarification about the current assignment.','Learning help: I am having difficulty with this topic and need guidance.','Submission update: I have completed/submitted the assigned work.']
    };
    const list=templates[role()]||templates.student;
    const wrap=document.createElement('div');wrap.id='msgQuickTemplates';wrap.className='paper-actions';wrap.style.marginBottom='8px';
    wrap.innerHTML=list.map((t,i)=>'<button type="button" class="secondary" data-msg-template="'+i+'">'+esc(t.split(':')[0])+'</button>').join('');
    body.closest('.msg-compose')?.before(wrap);
    wrap.querySelectorAll('[data-msg-template]').forEach(b=>b.onclick=()=>{const t=list[Number(b.dataset.msgTemplate)];body.value=body.value.trim()?body.value.trim()+'\n\n'+t:t;body.focus()});
  }

  let timer=0,diaryTimer=0;
  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      try{renderPaperAudit()}catch(e){console.warn('Paper deep tools:',e)}
      try{renderSchoolWorkDeep()}catch(e){console.warn('School work deep tools:',e)}
      try{enhanceMessaging()}catch(e){console.warn('Messaging deep tools:',e)}
      if($('#dailyDiaryApp')&&cloudReady()){
        clearTimeout(diaryTimer);diaryTimer=setTimeout(()=>loadDiaryDeep().catch(e=>console.warn('Diary deep tools:',e)),180);
      }
    },90);
  }
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ['change','input'].forEach(evt=>document.addEventListener(evt,e=>{
    if(e.target?.matches?.('#diaryFilterDate,#diaryRange,#diaryViewClass,#diaryViewSubject,#diarySearch,[data-q]'))schedule();
  },true));
  window.addEventListener('edunizam:auth',schedule);
  window.addEventListener('storage',e=>{if(['edunizam_school_work_v1','edunizam_students'].includes(e.key))schedule()});

  window.EDUNIZAM_ACADEMIC_WORKFLOW_DEEP={schedule,renderPaperAudit,loadDiaryDeep,renderSchoolWorkDeep,enhanceMessaging};
  schedule();
})();