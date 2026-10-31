(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const APP_KEY='edunizam_admissions_apps';
  const SCHEDULE_KEY='edunizam_admission_schedules';
  const NOTICE_KEY='edunizam_admission_notifications';
  const read=(k,f)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(f));
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const apps=()=>read(APP_KEY,[]);
  const schedules=()=>read(SCHEDULE_KEY,[]);
  const notices=()=>read(NOTICE_KEY,[]);

  function saveApps(v){write(APP_KEY,v)}
  function appLabel(a){return a.applicationId+' — '+a.applicantName+' — '+(a.program||'')}

  function refreshSelectors(){
    const list=apps();
    const appOptions='<option value="">Select application</option>'+list.map(a=>'<option value="'+esc(a.applicationId)+'">'+esc(appLabel(a))+'</option>').join('');
    if($('admScheduleApplication'))$('admScheduleApplication').innerHTML=appOptions;
    if($('admNotifyApplication'))$('admNotifyApplication').innerHTML=appOptions;
    const programs=[...new Set(list.map(a=>a.program).filter(Boolean))].sort();
    if($('admMeritProgram'))$('admMeritProgram').innerHTML='<option value="">Select program</option>'+programs.map(p=>'<option>'+esc(p)+'</option>').join('');
  }

  function saveSchedule(){
    const applicationId=$('admScheduleApplication')?.value;
    const a=apps().find(x=>x.applicationId===applicationId);
    if(!a)return alert('Select an application.');
    const date=$('admScheduleDate').value,time=$('admScheduleTime').value;
    if(!date)return alert('Select schedule date.');
    const row={
      id:'SCH-'+Date.now(),
      applicationId,
      applicantName:a.applicantName,
      program:a.program,
      type:$('admScheduleType').value,
      date,time,
      venue:$('admScheduleVenue').value.trim(),
      maxMarks:Number($('admScheduleMaxMarks').value||100),
      note:$('admScheduleNote').value.trim(),
      status:'Scheduled',
      createdAt:new Date().toISOString()
    };
    const list=schedules();list.push(row);write(SCHEDULE_KEY,list);
    const arr=apps(),idx=arr.findIndex(x=>x.applicationId===applicationId);
    if(idx>=0){
      if(row.type==='Entry Test')arr[idx].status='Test / Interview';
      if(row.type==='Interview')arr[idx].status='Test / Interview';
      arr[idx].updatedAt=new Date().toISOString();saveApps(arr);
    }
    renderSchedules();refreshSelectors();
    $('admScheduleNote').value='';
    alert('Schedule saved.');
  }

  function renderSchedules(){
    const el=$('admissionScheduleList');if(!el)return;
    const list=schedules().slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    el.innerHTML=list.length?list.map(s=>'<article class="paper-card"><div class="paper-card-top"><div><span class="mini-badge">'+esc(s.type)+'</span><span class="trust-badge trust-official">'+esc(s.status)+'</span></div></div><h3>'+esc(s.applicantName)+'</h3><p class="muted">'+esc(s.applicationId)+' · '+esc(s.program||'')+'</p><div class="paper-meta"><span>'+esc(s.date)+'</span><span>'+esc(s.time||'Time TBD')+'</span><span>'+esc(s.venue||'Venue TBD')+'</span></div><p>'+esc(s.note||'')+'</p><div class="paper-actions"><button data-sch-complete="'+esc(s.id)+'">Mark Complete</button><button class="secondary-action" data-sch-delete="'+esc(s.id)+'">Delete</button></div></article>').join(''):'<div class="empty-state">No tests/interviews scheduled yet.</div>';
    document.querySelectorAll('[data-sch-complete]').forEach(b=>b.onclick=()=>setScheduleStatus(b.dataset.schComplete,'Completed'));
    document.querySelectorAll('[data-sch-delete]').forEach(b=>b.onclick=()=>deleteSchedule(b.dataset.schDelete));
  }
  function setScheduleStatus(id,status){const list=schedules(),x=list.find(r=>r.id===id);if(x){x.status=status;write(SCHEDULE_KEY,list);renderSchedules()}}
  function deleteSchedule(id){write(SCHEDULE_KEY,schedules().filter(x=>x.id!==id));renderSchedules()}

  function generateMerit(){
    const program=$('admMeritProgram')?.value;
    if(!program)return alert('Select a program.');
    const seats=Math.max(1,Number($('admMeritSeats').value||1));
    const cutoff=Number($('admMeritCutoff').value||0);
    const basis=$('admMeritBasis').value;
    const arr=apps();
    const ranked=arr.filter(a=>a.program===program).map(a=>({
      ...a,
      rankScore:Number(basis==='percentage'?(a.percentage||0):(a.meritScore??a.percentage??0))
    })).sort((a,b)=>b.rankScore-a.rankScore || String(a.applicationId).localeCompare(String(b.applicationId)));

    let selected=0,waitlisted=0;
    ranked.forEach((a,i)=>{
      const target=arr.find(x=>x.applicationId===a.applicationId);
      if(!target)return;
      if(a.rankScore<cutoff){target.status='Rejected';return}
      if(selected<seats){target.status='Selected';selected++}
      else{target.status='Waitlisted';waitlisted++}
      target.meritRank=i+1;target.meritBasis=basis;target.meritGeneratedAt=new Date().toISOString();target.updatedAt=new Date().toISOString();
    });
    saveApps(arr);
    renderMerit(ranked,seats,cutoff,basis);
    refreshSelectors();
    window.renderAdmissionsPortal?.();
  }

  function renderMerit(ranked,seats,cutoff,basis){
    const sum=$('admissionMeritSummary'),el=$('admissionMeritList');
    if(!sum||!el)return;
    const selected=ranked.filter((a,i)=>a.rankScore>=cutoff&&i<seats).length;
    sum.innerHTML='<div class="pp-stats"><article><span>Candidates</span><strong>'+ranked.length+'</strong></article><article><span>Seats</span><strong>'+seats+'</strong></article><article><span>Selected</span><strong>'+selected+'</strong></article><article><span>Cutoff</span><strong>'+cutoff+'%</strong></article></div>';
    el.innerHTML=ranked.length?'<table class="merit-table"><thead><tr><th>Rank</th><th>Application</th><th>Applicant</th><th>Score</th><th>Status</th></tr></thead><tbody>'+ranked.map((a,i)=>{
      const status=a.rankScore<cutoff?'Rejected':(i<seats?'Selected':'Waitlisted');
      return '<tr><td>'+(i+1)+'</td><td>'+esc(a.applicationId)+'</td><td>'+esc(a.applicantName)+'</td><td>'+a.rankScore.toFixed(2)+'%</td><td>'+status+'</td></tr>';
    }).join('')+'</tbody></table>':'<div class="empty-state">No candidates for this program.</div>';
  }

  function templateMessage(kind,a){
    const name=a?.applicantName||'Applicant',id=a?.applicationId||'',program=a?.program||'your selected program';
    const sch=schedules().filter(x=>x.applicationId===id).slice().sort((x,y)=>(y.createdAt||'').localeCompare(x.createdAt||''))[0];
    const map={
      submitted:'Dear '+name+', your admission application '+id+' has been received successfully.',
      documents:'Dear '+name+', documents are pending for application '+id+'. Please submit the required documents.',
      test:'Dear '+name+', your entry test for '+program+' is scheduled'+(sch?' on '+sch.date+(sch.time?' at '+sch.time:'')+(sch.venue?' at '+sch.venue:''):'')+'.',
      interview:'Dear '+name+', your interview for '+program+' is scheduled'+(sch?' on '+sch.date+(sch.time?' at '+sch.time:'')+(sch.venue?' at '+sch.venue:''):'')+'.',
      selected:'Congratulations '+name+'. You have been selected for admission in '+program+'. Application: '+id+'.',
      waitlisted:'Dear '+name+', your application '+id+' is currently on the waiting list for '+program+'.',
      rejected:'Dear '+name+', your application '+id+' was not selected in the current admission cycle.',
      fee:'Dear '+name+', admission fee is pending for application '+id+'. Please complete payment according to the portal instructions.',
      custom:''
    };
    return map[kind]||'';
  }

  function updateNoticeTemplate(){
    const id=$('admNotifyApplication')?.value,a=apps().find(x=>x.applicationId===id);
    $('admNotifyMessage').value=templateMessage($('admNotifyTemplate').value,a);
  }
  function saveNotice(){
    const applicationId=$('admNotifyApplication')?.value,a=apps().find(x=>x.applicationId===applicationId);
    const message=$('admNotifyMessage')?.value.trim();
    if(!a||!message)return alert('Select an application and enter a message.');
    const list=notices();list.push({
      id:'NTF-'+Date.now(),applicationId,applicantName:a.applicantName,phone:a.phone||'',email:a.email||'',
      channel:'In-App / Manual',message,createdAt:new Date().toISOString(),status:'Saved'
    });write(NOTICE_KEY,list);renderNotices();
    alert('Notification saved.');
  }
  async function copyNotice(){
    const text=$('admNotifyMessage')?.value||'';if(!text)return;
    try{await navigator.clipboard.writeText(text);alert('Message copied.')}catch(e){alert('Copy failed. Please select and copy the message manually.')}
  }
  function renderNotices(){
    const el=$('admissionNotificationList');if(!el)return;
    const list=notices().slice().reverse();
    el.innerHTML=list.length?list.map(n=>'<div class="practice-review"><div class="paper-card-top"><div><span class="mini-badge">'+esc(n.applicationId)+'</span><span class="trust-badge trust-verified">'+esc(n.status)+'</span></div><small>'+new Date(n.createdAt).toLocaleString()+'</small></div><strong>'+esc(n.applicantName)+'</strong><p>'+esc(n.message)+'</p><div class="muted">'+esc(n.phone||'')+' '+esc(n.email||'')+'</div></div>').join(''):'<div class="empty-state">No saved applicant notifications.</div>';
  }

  function renderSelectionModule(){
    refreshSelectors();renderSchedules();renderNotices();
  }

  $('saveAdmissionScheduleBtn')?.addEventListener('click',saveSchedule);
  $('generateAdmissionMeritBtn')?.addEventListener('click',generateMerit);
  $('admNotifyApplication')?.addEventListener('change',updateNoticeTemplate);
  $('admNotifyTemplate')?.addEventListener('change',updateNoticeTemplate);
  $('saveAdmissionNotificationBtn')?.addEventListener('click',saveNotice);
  $('copyAdmissionNotificationBtn')?.addEventListener('click',copyNotice);

  window.EDUNIZAM_ADMISSION_SELECTION={render:renderSelectionModule,renderSchedules,renderNotices,refreshSelectors};
  renderSelectionModule();
})();