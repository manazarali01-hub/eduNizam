(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch{return f}};
const session=()=>read('edunizam_session',{});
const role=()=>{const r=session()?.role||'student';return r==='admin'?'head':r};
const students=()=>read('edunizam_students',[]);
const settings=()=>read('edunizam_settings',{});
const visibleStudents=()=>window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students();
const cloud=()=>window.EDUNIZAM_CLOUD,cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
const isHead=()=>role()==='head';
let sections=[],studentCounts=new Map();

function key(cls,sec){return String(cls||'').trim().toLowerCase()+'|'+String(sec||'').trim().toLowerCase()}
function money(v){try{return new Intl.NumberFormat('en-PK').format(Number(v||0))}catch{return String(v||0)}}
function studentByLocal(id){return students().find(s=>String(s.id)===String(id))}
async function cloudStudent(localId){
  if(!cloudReady()||!localId)return null;
  const s=studentByLocal(localId);if(!s)return null;
  let q=cloud().state.client.from('core_students').select('id,student_code,name,class_name,section_name,roll_no,profile_details').eq('institution_id',cfg().institutionId);
  if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
  const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
}

async function loadSections(){
  sections=[];studentCounts=new Map();
  if(!cloudReady()||!isHead())return;
  const [a,b]=await Promise.all([
    cloud().state.client.from('class_sections').select('class_name,section_name,class_teacher_name,class_teacher_user_id,capacity,room_label,active').eq('institution_id',cfg().institutionId).eq('active',true).order('class_name').order('section_name'),
    cloud().state.client.from('core_students').select('class_name,section_name').eq('institution_id',cfg().institutionId)
  ]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  sections=a.data||[];
  (b.data||[]).forEach(s=>studentCounts.set(key(s.class_name,s.section_name),(studentCounts.get(key(s.class_name,s.section_name))||0)+1));
}

function targetSectionOptions(){
  const cls=$('spToClass')?.value.trim()||'',sel=$('spToSection');if(!sel)return;
  const rows=sections.filter(x=>String(x.class_name||'').trim().toLowerCase()===cls.toLowerCase());
  sel.innerHTML='<option value="">'+(rows.length>1?'Select target section':'No section / auto')+'</option>'+rows.map(x=>{
    const enrolled=studentCounts.get(key(x.class_name,x.section_name))||0;
    const full=Number(x.capacity||0)>0&&enrolled>=Number(x.capacity||0);
    const cap=x.capacity?(' · '+enrolled+'/'+x.capacity):(' · '+enrolled+' enrolled');
    const teacher=x.class_teacher_name?(' · '+x.class_teacher_name):'';
    return '<option value="'+esc(x.section_name)+'" '+(full?'disabled':'')+'>'+esc(x.section_name+cap+teacher+(full?' · FULL':''))+'</option>';
  }).join('');
}

function toggleTarget(){
  const decision=$('spDecision')?.value||'Promoted',on=decision==='Promoted';
  ['spToClass','spToSection','spToRoll'].forEach(id=>{const el=$(id);if(el)el.disabled=!on});
  const note=$('spDecisionHelp');
  if(note)note.textContent=decision==='Promoted'
    ?'Promotion updates class/section/roll and reconciles the class-teacher link after capacity checks.'
    :decision==='Retained'
      ?'Student stays in the current class/section. No automatic class move occurs.'
      :decision==='Graduated'
        ?'Student remains in history and is marked graduated.'
        :'Student remains in history and is marked transferred.';
}

async function renderContext(){
  const box=$('spContext');if(!box)return;
  const localId=$('spStudent')?.value;
  if(!localId){box.innerHTML='<div class="empty-state">Student select karein to latest official report context nazar aaye.</div>';return}
  const local=studentByLocal(localId);
  if(!cloudReady()){box.innerHTML='<div class="coverage-note">Cloud Mode required for official progression context.</div>';return}
  try{
    const cs=await cloudStudent(localId);if(!cs){box.innerHTML='<div class="coverage-note">Student cloud record not linked.</div>';return}
    const {data,error}=await cloud().state.client.from('report_card_publications')
      .select('report_type,title,version_no,snapshot,published_at')
      .eq('student_id',cs.id).eq('status','Published')
      .order('published_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(!data){
      box.innerHTML='<div class="coverage-note"><strong>'+esc(local?.name||cs.name)+'</strong> · '+esc(cs.class_name||local?.className||'-')+(cs.section_name?' · '+esc(cs.section_name):'')+'<br>No official report card published yet. Head can still make a progression decision, but no official report snapshot will be attached.</div>';
      return;
    }
    const snap=data.snapshot||{},att=snap.attendance||{};
    box.innerHTML='<div class="cards"><article class="card stat"><span>Latest Report</span><strong>'+esc(data.report_type||'Report')+'</strong></article><article class="card stat"><span>Overall</span><strong>'+esc(snap.overall??'—')+'%</strong></article><article class="card stat"><span>Grade</span><strong>'+esc(snap.grade||'—')+'</strong></article><article class="card stat"><span>Attendance</span><strong>'+(att.percentage==null?'—':esc(att.percentage)+'%')+'</strong></article></div><p class="muted">Official report v'+esc(data.version_no||1)+' · '+esc(data.published_at?new Date(data.published_at).toLocaleDateString():'')+'. This is context only; EduNizam does not auto-decide promotion.</p>';
  }catch(e){box.innerHTML='<div class="coverage-note">'+esc(e.message||'Could not load progression context.')+'</div>'}
}

async function finalizeProgression(){
  if(!isHead()||!cloudReady())return alert('Head/Admin Cloud login required.');
  const localId=$('spStudent')?.value,decision=$('spDecision')?.value||'Promoted',toClass=$('spToClass')?.value.trim()||'',toSection=$('spToSection')?.value||'',toRoll=$('spToRoll')?.value.trim()||'',academicSession=$('spSession')?.value.trim()||'',note=$('spNote')?.value.trim()||'';
  if(!localId)return alert('Student select karein.');
  if(decision==='Promoted'&&!toClass)return alert('Target class required hai.');
  const cs=await cloudStudent(localId);if(!cs)return alert('Student cloud record not linked.');
  const btn=$('spFinalize');if(btn)btn.disabled=true;
  try{
    const {data,error}=await cloud().state.client.rpc('finalize_student_progression_v1',{
      p_student_id:cs.id,
      p_decision:decision,
      p_to_class:toClass||null,
      p_to_section:toSection||null,
      p_to_roll:toRoll||null,
      p_academic_session:academicSession||null,
      p_note:note||null
    });
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    try{await window.EDUNIZAM_CORE_CLOUD?.pullAllCloudToLocal?.(true);window.renderAll?.()}catch(_){}
    window.EDUNIZAM_PREMIUM?.toast?.('Student progression saved: '+decision,'success');
    if(row?.to_class||row?.to_section||row?.to_roll)alert(decision+' · '+[row.to_class,row.to_section&&('Section '+row.to_section),row.to_roll&&('Roll '+row.to_roll)].filter(Boolean).join(' · '));
    else alert('Progression decision saved: '+decision);
    if($('spNote'))$('spNote').value='';
    await render();
  }catch(e){alert('Progression failed: '+(e.message||e))}
  finally{if(btn)btn.disabled=false}
}

function historyCard(x){
  const ctx=x.context_snapshot?.latestReport||{},overall=ctx.overall;
  const target=x.decision==='Promoted'
    ?'<p><strong>Moved to:</strong> '+esc(x.to_class||'-')+(x.to_section?' · '+esc(x.to_section):'')+(x.to_roll?' · Roll '+esc(x.to_roll):'')+'</p>'
    :'';
  return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.academic_session)+'</span><span class="academic-pill">'+esc(x.decision)+'</span></div><h3>'+esc(x.core_students?.name||ctx.student?.name||'Student')+'</h3><p class="muted">From '+esc(x.from_class||'-')+(x.from_section?' · '+esc(x.from_section):'')+(x.from_roll?' · Roll '+esc(x.from_roll):'')+' · '+esc(x.decided_at?new Date(x.decided_at).toLocaleDateString():'')+'</p>'+target+(overall!=null?'<div class="coverage-note"><strong>Decision context:</strong> latest official report '+esc(overall)+'% · Grade '+esc(ctx.grade||'-')+'</div>':'<div class="coverage-note">No official report snapshot was available at decision time.</div>')+(x.note?'<p><strong>Note:</strong> '+esc(x.note)+'</p>':'')+'</article>';
}

async function loadHistory(){
  const el=$('spHistory');if(!el)return;
  if(!cloudReady()){el.innerHTML='<div class="empty-state">Progression history requires Cloud Mode.</div>';return}
  try{
    const {data,error}=await cloud().state.client.from('student_progression_records')
      .select('*,core_students(name,class_name,section_name,student_code)')
      .eq('institution_id',cfg().institutionId)
      .order('decided_at',{ascending:false}).limit(100);
    if(error)throw error;
    el.innerHTML=(data||[]).length?'<div class="paper-grid">'+data.map(historyCard).join('')+'</div>':'<div class="empty-state">No progression decisions recorded yet.</div>';
  }catch(e){el.innerHTML='<div class="empty-state">'+esc(e.message||'Could not load progression history.')+'</div>'}
}

async function render(){
  const section=$('results');if(!section)return;
  let root=$('studentProgressionCenter');
  if(!root){root=document.createElement('div');root.id='studentProgressionCenter';root.style.marginTop='16px';section.appendChild(root)}
  let editor='';
  if(isHead()){
    try{await loadSections()}catch(e){sections=[];studentCounts=new Map()}
    const vis=visibleStudents(),classes=[...new Set(sections.map(x=>x.class_name).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
    editor='<article class="card"><div class="section-head"><div><div class="academic-kicker">Year-End Lifecycle</div><h3>Student Progression Decision</h3><p class="muted">Official report/attendance is context only. Final promotion, retention, graduation or transfer decision remains with Head/Admin.</p></div><span class="academic-pill">Head Control</span></div><div class="form-grid"><label>Student<select id="spStudent"><option value="">Select student</option>'+vis.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(s.className||'-')+(s.sectionName?' · '+esc(s.sectionName):'')+'</option>').join('')+'</select></label><label>Academic Session<input id="spSession" value="'+esc(settings().session||new Date().getFullYear())+'"></label><label>Decision<select id="spDecision"><option>Promoted</option><option>Retained</option><option>Graduated</option><option>Transferred</option></select></label><label>Target Class<input id="spToClass" list="spClasses" placeholder="Next class"></label><datalist id="spClasses">'+classes.map(x=>'<option>'+esc(x)+'</option>').join('')+'</datalist><label>Target Section<select id="spToSection"><option value="">Select class first</option></select></label><label>Target Roll<input id="spToRoll" placeholder="Auto"></label><label style="grid-column:1/-1">Decision Note<textarea id="spNote" rows="3" placeholder="Optional institutional note / reason"></textarea></label><button id="spFinalize">Finalize Progression</button></div><div id="spDecisionHelp" class="coverage-note">Promotion updates class/section/roll and reconciles the class-teacher link after capacity checks.</div><div id="spContext" style="margin-top:12px"><div class="empty-state">Student select karein to latest official report context nazar aaye.</div></div></article>';
  }else{
    editor='<article class="card"><div class="section-head"><div><div class="academic-kicker">Academic Progression</div><h3>Progression History</h3><p class="muted">Final institutional progression decisions for your accessible student record(s).</p></div></div></article>';
  }
  root.innerHTML=editor+'<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Progression Record</h3><p class="muted">Historical decisions remain visible even after class changes.</p></div></div><div id="spHistory"><div class="empty-state">Loading progression history…</div></div></article>';
  if(isHead()){
    $('spStudent')?.addEventListener('change',renderContext);
    $('spDecision')?.addEventListener('change',()=>{toggleTarget();renderContext()});
    $('spToClass')?.addEventListener('input',targetSectionOptions);
    $('spFinalize')?.addEventListener('click',finalizeProgression);
    toggleTarget();targetSectionOptions();
  }
  await loadHistory();
}
window.addEventListener('edunizam:auth',render);
window.addEventListener('edunizam:results-updated',renderContext);
window.EDUNIZAM_PROGRESSION_CENTER={render,loadHistory};
setTimeout(render,0);setTimeout(render,700);
})();