(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const monthKey=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
  const monthBounds=m=>{const [y,mo]=m.split('-').map(Number),n=new Date(y,mo,1);return {start:m+'-01',end:n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-01'}};
  const students=()=>{try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}};
  const localAttendance=()=>{try{return JSON.parse(localStorage.getItem('edunizam_attendance')||'{}')}catch{return{}}};
  const visibleStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students();
  const isStaff=()=>['teacher','head'].includes(role());
  const threshold=()=>75;
  let cloudRecords=[];

  function localRecords(month){
    const ids=new Set(visibleStudents().map(s=>String(s.id))),rows=[];
    for(const [date,day] of Object.entries(localAttendance())){
      if(!String(date).startsWith(month))continue;
      for(const [studentId,status] of Object.entries(day||{})){
        if(!ids.has(String(studentId)))continue;
        const s=students().find(x=>String(x.id)===String(studentId));if(!s)continue;
        rows.push({date,status,studentId:String(studentId),studentName:s.name,className:s.className||'',sectionName:s.sectionName||''});
      }
    }
    return rows;
  }

  async function pullCloud(month){
    if(!cloudReady())return localRecords(month);
    const {start,end}=monthBounds(month);
    const {data,error}=await cloud().state.client.from('attendance_records')
      .select('attendance_date,status,student_id,core_students(local_id,name,class_name,section_name,auth_user_id)')
      .eq('institution_id',cfg().institutionId)
      .gte('attendance_date',start).lt('attendance_date',end)
      .order('attendance_date',{ascending:true});
    if(error)throw error;
    cloudRecords=(data||[]).map(x=>({
      date:x.attendance_date,status:x.status,studentCloudId:x.student_id,
      studentId:String(x.core_students?.local_id??x.student_id),
      studentName:x.core_students?.name||'Student',
      className:x.core_students?.class_name||'',
      sectionName:x.core_students?.section_name||''
    }));
    return cloudRecords;
  }

  function pct(c){
    const denominator=c.Present+c.Late+c.Absent;
    return denominator?Math.round(((c.Present+c.Late)/denominator)*100):null;
  }
  function summarize(rows){
    const map=new Map();
    rows.forEach(r=>{
      const key=String(r.studentId);
      if(!map.has(key))map.set(key,{studentId:key,name:r.studentName,className:r.className,sectionName:r.sectionName,Present:0,Absent:0,Leave:0,Late:0,dates:{}});
      const x=map.get(key),st=['Present','Absent','Leave','Late'].includes(r.status)?r.status:'Absent';
      x[st]++;x.dates[r.date]=st;
    });
    visibleStudents().forEach(s=>{
      const key=String(s.id);
      if(!map.has(key))map.set(key,{studentId:key,name:s.name,className:s.className||'',sectionName:s.sectionName||'',Present:0,Absent:0,Leave:0,Late:0,dates:{}});
    });
    return [...map.values()].map(x=>Object.assign(x,{percentage:pct(x),marked:x.Present+x.Absent+x.Leave+x.Late}));
  }
  function classKey(x){return (x.className||'Unassigned')+(x.sectionName?' - '+x.sectionName:'')}
  function filteredSummary(summary,filter){
    return filter==='all'?summary:summary.filter(x=>classKey(x)===filter);
  }
  function classOptions(summary,selected){
    const classes=[...new Set(summary.map(classKey))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    return '<option value="all">All accessible classes</option>'+classes.map(c=>'<option value="'+esc(c)+'" '+(c===selected?'selected':'')+'>'+esc(c)+'</option>').join('');
  }
  function overall(summary){
    return summary.reduce((a,x)=>{a.Present+=x.Present;a.Absent+=x.Absent;a.Leave+=x.Leave;a.Late+=x.Late;return a},{Present:0,Absent:0,Leave:0,Late:0});
  }
  function metricCards(summary){
    const o=overall(summary),p=pct(o),low=summary.filter(x=>x.percentage!==null&&x.percentage<threshold()).length;
    return '<div class="cards">'+
      '<article class="card stat"><span>Students</span><strong>'+summary.length+'</strong></article>'+
      '<article class="card stat"><span>Present Marks</span><strong>'+o.Present+'</strong></article>'+
      '<article class="card stat"><span>Absent Marks</span><strong>'+o.Absent+'</strong></article>'+
      '<article class="card stat"><span>Overall Attendance</span><strong>'+(p===null?'—':p+'%')+'</strong></article>'+
      '<article class="card stat"><span>Below '+threshold()+'%</span><strong>'+low+'</strong></article>'+
      '</div>';
  }
  function rowsTable(summary){
    if(!summary.length)return '<div class="empty-state">Is month ke liye attendance data nahi hai.</div>';
    return '<div class="aa-table-wrap"><table class="aa-table"><thead><tr><th>Student</th><th>Class</th><th>Marked</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th><th>Attendance %</th><th>Status</th></tr></thead><tbody>'+
      summary.map(x=>{
        const low=x.percentage!==null&&x.percentage<threshold();
        return '<tr><td><strong>'+esc(x.name)+'</strong></td><td>'+esc(classKey(x))+'</td><td>'+x.marked+'</td><td>'+x.Present+'</td><td>'+x.Late+'</td><td>'+x.Absent+'</td><td>'+x.Leave+'</td><td>'+(x.percentage===null?'—':x.percentage+'%')+'</td><td><span class="badge">'+(x.percentage===null?'No data':low?'Needs Attention':'On Track')+'</span></td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  function lowAlerts(summary){
    const lows=summary.filter(x=>x.percentage!==null&&x.percentage<threshold()).sort((a,b)=>a.percentage-b.percentage);
    return lows.length?lows.map(x=>'<div class="row"><strong>'+esc(x.name)+'</strong><span>'+esc(classKey(x))+'</span><span>'+x.percentage+'%</span><span>'+x.Absent+' absent</span><span></span></div>').join(''):'<div class="muted">Koi student '+threshold()+'% se neeche nahi hai.</div>';
  }
  function dailyGrid(summary,month){
    if(!summary.length)return '<div class="muted">No attendance marks.</div>';
    const days=new Set();summary.forEach(s=>Object.keys(s.dates).forEach(d=>days.add(d)));
    const sorted=[...days].sort();
    if(!sorted.length)return '<div class="muted">No attendance marks.</div>';
    return '<div class="aa-table-wrap"><table class="aa-table aa-daily"><thead><tr><th>Student</th>'+sorted.map(d=>'<th>'+esc(d.slice(-2))+'</th>').join('')+'</tr></thead><tbody>'+
      summary.map(s=>'<tr><td><strong>'+esc(s.name)+'</strong></td>'+sorted.map(d=>{const v=s.dates[d]||'';return '<td title="'+esc(v)+'">'+(v==='Present'?'P':v==='Absent'?'A':v==='Leave'?'L':v==='Late'?'T':'—')+'</td>'}).join('')+'</tr>').join('')+
      '</tbody></table></div><p class="muted">P = Present · A = Absent · L = Leave · T = Late</p>';
  }
  function printReport(month,summary){
    const st=(()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}})();
    const o=overall(summary),op=pct(o),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Attendance Report</title><style>body{font-family:Arial;padding:28px;color:#17324a}.head{text-align:center}.meta{display:flex;justify-content:space-between;margin:20px 0}.note{font-size:12px;color:#667;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd6dc;padding:7px;text-align:center}th:first-child,td:first-child{text-align:left}</style></head><body><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Monthly Attendance Report</h3><p>'+esc(month)+'</p></div><div class="meta"><strong>Students: '+summary.length+'</strong><strong>Overall: '+(op===null?'—':op+'%')+'</strong></div><div class="note">Attendance % = (Present + Late) ÷ (Present + Late + Absent). Leave is excluded from the percentage denominator.</div><table><thead><tr><th>Student</th><th>Class</th><th>Marked</th><th>P</th><th>Late</th><th>A</th><th>Leave</th><th>%</th></tr></thead><tbody>'+summary.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(classKey(x))+'</td><td>'+x.marked+'</td><td>'+x.Present+'</td><td>'+x.Late+'</td><td>'+x.Absent+'</td><td>'+x.Leave+'</td><td>'+(x.percentage===null?'—':x.percentage+'%')+'</td></tr>').join('')+'</tbody></table></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  async function render(){
    const root=$('attendanceAnalyticsApp');if(!root)return;
    const month=$('aaMonth')?.value||root.dataset.month||monthKey();root.dataset.month=month;
    const oldFilter=$('aaClass')?.value||root.dataset.classFilter||'all';root.innerHTML='<div class="coverage-note">Attendance analytics loading...</div>';
    try{
      const records=cloudReady()?await pullCloud(month):localRecords(month);
      const all=summarize(records),validClasses=new Set(all.map(classKey)),filter=oldFilter==='all'||validClasses.has(oldFilter)?oldFilter:'all';
      root.dataset.classFilter=filter;
      const summary=filteredSummary(all,filter);
      root.innerHTML='<style>.aa-table-wrap{overflow:auto}.aa-table{width:100%;border-collapse:collapse;min-width:760px}.aa-table th,.aa-table td{padding:9px;border-bottom:1px solid #e4ecef;text-align:left}.aa-table th{font-size:12px;color:#60717c}.aa-daily th,.aa-daily td{text-align:center}.aa-daily th:first-child,.aa-daily td:first-child{text-align:left;position:sticky;left:0;background:var(--card,#fff)}</style>'+
        '<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Data':'Local Data')+'</span></div><div class="quick-actions"><input id="aaMonth" type="month" value="'+esc(month)+'">'+
        (isStaff()?'<select id="aaClass">'+classOptions(all,filter)+'</select>':'')+
        '<button id="aaPrint" class="secondary">Print Monthly Report</button></div></div>'+
        '<div class="coverage-note">Attendance % = (Present + Late) ÷ (Present + Late + Absent). Leave denominator se exclude hai. Low-attendance flag: below '+threshold()+'%.</div>'+
        metricCards(summary)+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Student Summary</h3><p class="muted">Monthly attendance counts and percentage.</p></div></div>'+rowsTable(summary)+'</article>'+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Low Attendance Alerts</h3><p class="muted">Students below '+threshold()+'%.</p></div></div><div class="list">'+lowAlerts(summary)+'</div></article>'+
        '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Daily Attendance Grid</h3><p class="muted">Marked school days in '+esc(month)+'.</p></div></div>'+dailyGrid(summary,month)+'</article>';
      $('aaMonth')?.addEventListener('change',()=>{root.dataset.month=$('aaMonth').value;render()});
      $('aaClass')?.addEventListener('change',()=>{root.dataset.classFilter=$('aaClass').value;render()});
      $('aaPrint')?.addEventListener('click',()=>printReport(month,summary));
    }catch(e){root.innerHTML='<div class="empty-state">Attendance Analytics error: '+esc(e.message||e)+'</div>'}
  }
  window.addEventListener('edunizam:auth',render);
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_ATTENDANCE_ANALYTICS={render,cloudReady};
})();