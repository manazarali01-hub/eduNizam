(function(){
  const KEYS={students:'edunizam_students',staff:'edunizam_staff_profiles_v1',classes:'edunizam_class_sections_v1'};
  const BACKUP='edunizam_bulk_import_backup_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const role=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')?.role||'student'}catch{return'student'}};
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const spec={
    students:{label:'Students',required:['name','className'],headers:['name','father','className','sectionName','phone','rollNo','studentId'],sample:['Ali Raza','Ahmed Raza','7','A','03001234567','12','ST-007']},
    staff:{label:'Staff & Teachers',required:['staffCode','fullName','designation'],headers:['staffCode','fullName','designation','phone','subjects','classes','joiningDate','status'],sample:['T-001','Sana Khan','Teacher','03001234567','English|Urdu','6|7','2026-01-15','active']},
    classes:{label:'Classes & Sections',required:['className','sectionName'],headers:['className','sectionName','classTeacherName','roomLabel','capacity','active'],sample:['7','A','Sana Khan','Room 12','35','true']}
  };
  const aliases={
    name:['name','student name','studentname'],father:['father','father name','guardian','guardian name'],className:['class','class name','classname'],sectionName:['section','section name','sectionname'],phone:['phone','mobile','contact'],rollNo:['roll','roll no','roll number','rollno'],studentId:['student id','student code','studentid'],
    staffCode:['staff code','teacher code','staff id','staffcode'],fullName:['full name','staff name','teacher name','fullname'],designation:['designation','role','job title'],subjects:['subjects','subject'],classes:['classes','assigned classes'],joiningDate:['joining date','join date','joiningdate'],status:['status'],
    classTeacherName:['class teacher','teacher','class teacher name'],roomLabel:['room','room label','room no'],capacity:['capacity','seats'],active:['active','enabled']
  };
  let staged={kind:'students',rows:[],valid:[],errors:[]};
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  function canonical(header){const h=norm(header);return Object.keys(aliases).find(k=>aliases[k].includes(h))||header}
  function parseCsv(text){
    const out=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];if(ch==='"'){if(quoted&&n==='"'){cell+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>String(x).trim()))out.push(row);row=[];cell=''}else cell+=ch}
    row.push(cell);if(row.some(x=>String(x).trim()))out.push(row);return out;
  }
  function toObjects(grid){if(!grid.length)return[];const headers=grid[0].map(canonical);return grid.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'').trim()])))}
  function loadXlsx(){return new Promise((resolve,reject)=>{if(window.XLSX)return resolve();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Excel reader load nahi ho saka. CSV use karein.'));document.head.appendChild(s)})}
  async function parseFile(file){const ext=file.name.split('.').pop().toLowerCase();if(ext==='csv')return toObjects(parseCsv(await file.text()));await loadXlsx();const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false}).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[canonical(k),String(v).trim()])))}
  function duplicateKey(kind,row){if(kind==='students')return norm(row.studentId)||[norm(row.name),norm(row.className),norm(row.sectionName)].join('|');if(kind==='staff')return norm(row.staffCode);return norm(row.className)+'|'+norm(row.sectionName)}
  function prepare(kind,rows){
    const current=read(KEYS[kind],[]),seen=new Set(current.map(x=>duplicateKey(kind,x)).filter(Boolean)),valid=[],errors=[];
    rows.forEach((raw,i)=>{const row={};spec[kind].headers.forEach(h=>row[h]=String(raw[h]??'').trim());const missing=spec[kind].required.filter(h=>!row[h]);const key=duplicateKey(kind,row);
      if(missing.length)errors.push({line:i+2,message:'Missing: '+missing.join(', '),row});else if(!key||seen.has(key))errors.push({line:i+2,message:'Duplicate record',row});else{seen.add(key);valid.push(row)}
    });staged={kind,rows,valid,errors};renderPreview();
  }
  async function chooseFile(file){if(!file)return;try{const rows=await parseFile(file);prepare($('biKind')?.value||'students',rows)}catch(e){alert(e.message||e)}}
  function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
  function download(name,rows){const blob=new Blob([rows.map(r=>r.map(csvEscape).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  function template(){const s=spec[$('biKind').value];download('edunizam-'+$('biKind').value+'-template.csv',[s.headers,s.sample])}
  function exportCurrent(){const kind=$('biKind').value,s=spec[kind],rows=read(KEYS[kind],[]);download('edunizam-'+kind+'-export.csv',[s.headers,...rows.map(x=>s.headers.map(h=>Array.isArray(x[h])?x[h].join('|'):x[h]??''))])}
  function materialize(kind,rows){
    const now=Date.now();
    if(kind==='students')return rows.map((x,i)=>({...x,id:now+i+1,source:'bulk-import'}));
    if(kind==='staff')return rows.map((x,i)=>({...x,id:crypto.randomUUID?.()||'staff-'+now+'-'+i,subjects:x.subjects?x.subjects.split('|').map(v=>v.trim()).filter(Boolean):[],classes:x.classes?x.classes.split('|').map(v=>v.trim()).filter(Boolean):[],joiningDate:x.joiningDate||'',status:(x.status||'active').toLowerCase(),createdAt:new Date().toISOString()}));
    return rows.map((x,i)=>({...x,id:crypto.randomUUID?.()||'class-'+now+'-'+i,classTeacherStaffId:'',capacity:Number(x.capacity||0),active:!['false','no','0','inactive'].includes(norm(x.active)),createdAt:new Date().toISOString()}));
  }
  async function syncCloud(kind){
    if(!cloudReady())return;
    if(kind==='students'){await window.EDUNIZAM_CORE_CLOUD?.pushAllLocalToCloud?.();return}
    const client=cloud().state.client,rows=read(KEYS[kind],[]);
    if(kind==='staff'){
      const payload=rows.map(x=>({institution_id:cfg().institutionId,user_id:x.userId||null,staff_code:x.staffCode,full_name:x.fullName,designation:x.designation||'Teacher',phone:x.phone||null,subjects:x.subjects||[],classes:x.classes||[],joining_date:x.joiningDate||null,employment_status:x.status||'active',created_by:cloud().state.user.id,updated_at:new Date().toISOString()}));
      const {error}=await client.from('staff_profiles').upsert(payload,{onConflict:'institution_id,staff_code'});if(error)throw error;
    }else{
      const staffRows=read(KEYS.staff,[]),payload=rows.map(x=>{const teacher=staffRows.find(s=>norm(s.fullName)===norm(x.classTeacherName));return{institution_id:cfg().institutionId,class_name:x.className,section_name:x.sectionName,class_teacher_user_id:teacher?.userId||null,class_teacher_name:x.classTeacherName||teacher?.fullName||null,room_label:x.roomLabel||null,capacity:Number(x.capacity||0)||null,active:x.active!==false,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()}});
      const {error}=await client.from('class_sections').upsert(payload,{onConflict:'institution_id,class_name,section_name'});if(error)throw error;
    }
  }
  async function importRows(){
    if(role()!=='head')return alert('Bulk import sirf Head manage kar sakta hai.');if(!staged.valid.length)return alert('Import ke liye valid rows nahi hain.');
    const key=KEYS[staged.kind],old=read(key,[]);write(BACKUP,{kind:staged.kind,key,records:old,createdAt:new Date().toISOString()});write(key,old.concat(materialize(staged.kind,staged.valid)));
    let cloudMessage='Local import complete.';try{await syncCloud(staged.kind);if(cloudReady())cloudMessage='Import aur cloud sync complete.'}catch(e){cloudMessage='Local import complete; cloud sync error: '+(e.message||e)}
    alert(staged.valid.length+' records imported. '+cloudMessage+' App refresh ho rahi hai.');location.reload();
  }
  function rollback(){const b=read(BACKUP,null);if(!b?.key)return alert('Rollback snapshot available nahi hai.');if(!confirm('Last '+b.kind+' import rollback karein?'))return;write(b.key,b.records);localStorage.removeItem(BACKUP);alert('Last import rolled back.');location.reload()}
  function renderPreview(){
    const box=$('biPreview');if(!box)return;const cols=spec[staged.kind].headers.slice(0,6);
    box.innerHTML='<div class="import-summary"><strong>'+staged.valid.length+' valid</strong><span>'+staged.errors.length+' issues</span><span>'+staged.rows.length+' total rows</span></div>'+
      (staged.errors.length?'<div class="import-errors">'+staged.errors.slice(0,8).map(x=>'<p><strong>Row '+x.line+':</strong> '+esc(x.message)+'</p>').join('')+(staged.errors.length>8?'<p>+'+(staged.errors.length-8)+' more issues</p>':'')+'</div>':'')+
      (staged.valid.length?'<div class="schedule-table-wrap"><table class="schedule-table"><thead><tr>'+cols.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+staged.valid.slice(0,10).map(r=>'<tr>'+cols.map(c=>'<td>'+esc(r[c])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<div class="empty-state">CSV/XLSX upload karein; valid records yahan preview honge.</div>');
    const btn=$('biImport');if(btn)btn.disabled=!staged.valid.length;
  }
  function bind(){
    $('biFile')?.addEventListener('change',e=>chooseFile(e.target.files[0]));$('biTemplate')?.addEventListener('click',template);$('biExport')?.addEventListener('click',exportCurrent);$('biImport')?.addEventListener('click',importRows);$('biRollback')?.addEventListener('click',rollback);
    $('biKind')?.addEventListener('change',e=>{staged={kind:e.target.value,rows:[],valid:[],errors:[]};renderPreview()});
    const drop=$('biDrop');if(drop){['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('dragging')}));['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('dragging')}));drop.addEventListener('drop',e=>chooseFile(e.dataTransfer.files[0]));}
  }
  function render(){const root=$('bulkImportApp');if(!root)return;if(role()!=='head'){root.innerHTML='<div class="empty-state">Bulk Import sirf Head of Institute ke liye available hai.</div>';return}
    const backup=read(BACKUP,null);root.innerHTML='<div class="import-layout"><article class="card"><div class="section-head"><div><h3>1. Data Type</h3><p class="muted">Ek file mein ek hi record type import karein.</p></div><span class="academic-pill">'+(cloudReady()?'Cloud Ready':'Local Mode')+'</span></div><select id="biKind"><option value="students">Students</option><option value="staff">Staff & Teachers</option><option value="classes">Classes & Sections</option></select><div class="paper-actions"><button id="biTemplate" class="secondary">Download Template</button><button id="biExport" class="secondary">Export Current Data</button></div></article><article id="biDrop" class="card import-drop"><h3>2. Upload CSV or Excel</h3><p class="muted">File yahan drop karein ya browse karein. Import se pehle validation aur preview hoga.</p><input id="biFile" type="file" accept=".csv,.xlsx,.xls"></article></div><article class="card"><div class="section-head"><div><h3>3. Review & Import</h3><p class="muted">Duplicates skip honge; sirf valid rows import ki jayengi.</p></div><div class="paper-actions"><button id="biImport" disabled>Import Valid Rows</button>'+(backup?'<button id="biRollback" class="secondary">Rollback Last Import</button>':'')+'</div></div><div id="biPreview"></div></article>';bind();renderPreview()}
  setTimeout(render,0);setTimeout(render,900);window.EDUNIZAM_BULK_IMPORT={render};
})();
