/* School-entered prescribed textbook chapter CSV import.
   Only the current authorized school supplies rows; no sample data is saved. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const norm=x=>String(x??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fields=['className','sectionName','subject','unitTitle','textbookTitle','curriculumBoard','editionYear','sourceUrl'];
// Prefer the IDs in the official curriculum registry. Historic stored values
// stay accepted so previously imported books remain editable.
const boards=new Set(['punjab-pectaa','federal-fbise','sindh-stbb','kp-dcte-kptbb','balochistan-btbb','kp-textbook','balochistan','other']);
// Historic, attributed CHAPTER REFERENCE ONLY from Punjab Education Foundation's
// 2025–26 Primary Content Book, Class 5 General Science, PDF pp. 253–263.
// PEF partner-school planning is NOT a certification of any school's 2026–27
// prescribed textbook/edition. Current titles must be checked with PECTAA.
const class5ScienceReference=Object.freeze({
 session:'2025-26',provider:'Punjab Education Foundation (PEF)',grade:'5',
 source:'https://www.pef.edu.pk/pdf/downloads/Content-List/Content-book-Primary-01-09-25.pdf',
 currentBooks:'https://pectaa.edu.pk/books-and-publications/',
 chapters:Object.freeze([
  'Classification of Living Organisms','Microorganisms','Flowers and Seeds',
  'Environmental Pollution','Physical and Chemical Changes of Matter',
  'Light and Sound','Electricity and Magnetism','Structure of the Earth',
  'Space and Satellites'
 ])
});
// Deliberately leave textbook title, authority, edition and book URL EMPTY.
// CSV validation must reject this review worksheet until authorized staff
// verify those fields from the actual textbook assigned in their school.
function class5ScienceReviewCsv(){
 const head=fields.join(','),quoted=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const rows=class5ScienceReference.chapters.map(title=>
  ['5','','General Science',title,'','','',''].map(quoted).join(','));
 return '\uFEFF'+head+'\r\n'+rows.join('\r\n')+'\r\n';
}
const scope=()=>String(window.EDUNIZAM_CLOUD_CONFIG?.institutionId||'')+'|'+String(window.EDUNIZAM_CLOUD?.state?.user?.id||'');
const api=()=>window.EDUNIZAM_LESSON_CENTER;
const client=()=>window.EDUNIZAM_CLOUD?.state?.client;
const role=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')?.role}catch{return null}};
const permitted=()=>['head','teacher'].includes(role())&&!!api()?.cloudReady?.();
const sameClass=(a,b)=>{const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;if(api?.sameClass)return api.sameClass(a,b);const whole=v=>norm(v).match(/^(?:(?:class|grade)\s*)?(1[0-2]|[1-9])$/)?.[1];return norm(a)===norm(b)||!!(whole(a)&&whole(a)===whole(b))};
const subj=v=>window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.subjectKey?.(v)||norm(v);
const key=x=>[norm(x.className).replace(/^(class|grade)\s+/,''),norm(x.sectionName),subj(x.subject),norm(x.unitTitle)].join('|');
let staged=[],stagedScope='',stagedFile=null,busy=false,reviewEpoch=0,sessionEpoch=0;

// Build a review worksheet from the VERIFIED current school's active directory.
// Empty curriculum columns are intentional. Never infer a prescribed subject,
// textbook, edition or chapter from a class name or generic topic catalog.
function registeredClassWorksheet(classes=[],{className='',sectionName=''}={}){
 if(!Array.isArray(classes)||!classes.length)throw Error('No registered school classes available. Set up Academic Groups first.');
 if(sectionName&&!className)throw Error('Select a class before selecting an individual section.');
 const available=classes.filter(x=>x&&x.active!==false&&String(x.className||'').trim());
 if(className&&!available.some(x=>sameClass(x.className,className)))throw Error('Selected class is not in this school directory. Refresh classes.');
 const relevant=available.filter(x=>(!className||sameClass(x.className,className))&&
  (!sectionName||norm(x.sectionName)===norm(sectionName)));
 if(!relevant.length)throw Error('No registered section matches your selection in the current school.');
 const seen=new Set(),rows=[];
 for(const x of relevant){
  const name=String(x.className||'').trim(),section=String(x.sectionName||'').trim();
  // Excel/Sheets may execute formula-like CSV values even inside double quotes.
  if([name,section].some(v=>/^[=+@-]/.test(v)||/[\r\n\t]/.test(v)))
   throw Error('Unsafe class/section name in Academic Groups. Correct it before CSV export.');
  const identity=[norm(name).replace(/^(class|grade)\s+/,''),norm(section)].join('|');
  if(seen.has(identity))continue;
  seen.add(identity);
  rows.push([name,section,'','','','','','']);
 }
 if(!rows.length)throw Error('No registered class sections to export.');
 if(rows.length>150)throw Error('More than 150 class sections. Select one class or section and download separate worksheets.');
 const quoted=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 return '\uFEFF'+fields.join(',')+'\r\n'+rows.map(row=>row.map(quoted).join(',')).join('\r\n')+'\r\n';
}
function worksheetSelections(){
 const cls=$('sbiWorksheetClass'),section=$('sbiWorksheetSection');
 if(!cls||!section)return;
 const available=permitted()?api()?.registeredClasses?.()||[]:[];
 const keys=new Map();
 for(const x of available){
  if(x?.active===false||!String(x?.className||'').trim())continue;
  const name=String(x.className).trim(),key=norm(name).replace(/^(class|grade)\s+/,'');
  if(!keys.has(key))keys.set(key,name);
 }
 const previous=cls.value;
 cls.innerHTML='<option value="">All registered classes</option>'+
  [...keys.values()].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 if([...keys.values()].some(x=>x===previous))cls.value=previous;
 const chosen=cls.value,sections=new Set();
 if(chosen)for(const x of available){
  if(sameClass(x.className,chosen)&&x.active!==false&&String(x.sectionName||'').trim())
   sections.add(String(x.sectionName).trim());
 }
 const old=section.value;
 section.innerHTML='<option value="">All sections in selected class</option>'+
  [...sections].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 if(sections.has(old))section.value=old;
 section.disabled=!chosen;
 const note=$('sbiWorksheetNote');
 if(note)note.textContent=available.length
  ?'Registered directory loaded ('+available.length+' accessible class/section rows). Other syllabus fields remain blank.'
  :'No current-school classes loaded. Register Academic Groups or refresh the school directory.';
}
function clearWorksheetSelections(){
 const cls=$('sbiWorksheetClass'),section=$('sbiWorksheetSection'),note=$('sbiWorksheetNote');
 if(cls){cls.innerHTML='<option value="">Reopen school workspace</option>';cls.value=''}
 if(section){section.innerHTML='<option value="">Select registered class first</option>';section.value='';section.disabled=true}
 if(note)note.textContent='School session ended. Reopen Lesson Center after signing in.';
}
let worksheetBusy=false;
async function downloadRegisteredClassWorksheet(){
 if(worksheetBusy)return;
 if(!permitted())return announce('Verified teacher/Head cloud login required before exporting school class names.',true);
 const start=scope(),generation=sessionEpoch,className=$('sbiWorksheetClass')?.value||'',
  sectionName=$('sbiWorksheetSection')?.value||'',button=$('sbiRegisteredWorksheet');
 worksheetBusy=true;if(button)button.disabled=true;
 try{
  // Re-read the authorized directory immediately before export. In-memory
  // or stale localStorage rows cannot authorize a school worksheet.
  await api().pullCloud();
  if(scope()!==start||generation!==sessionEpoch)return;
  if(api().classesVerified?.()!==true)throw Error('Current school class directory was not verified. Refresh Academic Groups.');
  if(($('sbiWorksheetClass')?.value||'')!==className||
     ($('sbiWorksheetSection')?.value||'')!==sectionName)
   throw Error('Class/section selection changed during refresh. Download again.');
  const contents=registeredClassWorksheet(api().registeredClasses(),{className,sectionName});
  if(scope()!==start||generation!==sessionEpoch)return;
  const blob=new Blob([contents],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  const slug=String(className||'all-classes').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,40);
  a.href=url;a.download='edunizam-'+slug+'-registered-syllabus-BLANK-REVIEW.csv';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  announce('Blank registered-class worksheet downloaded. Fill the actual subject, chapter, prescribed book and board for each row; add rows as needed. Nothing was imported.');
  worksheetSelections();
 }catch(error){
  if(scope()===start&&generation===sessionEpoch)
   announce('Worksheet not generated: '+String(error?.message||error),true);
 }finally{
  worksheetBusy=false;
  if(scope()===start&&generation===sessionEpoch&&button?.isConnected)button.disabled=false;
 }
}

function resetPreview(){
 reviewEpoch++;staged=[];stagedScope='';stagedFile=null;
 const button=$('sbiSave');if(button)button.disabled=true;
 const output=$('sbiPreview');if(output)output.innerHTML='';
}
function csv(text){
 text=String(text||'').replace(/^\uFEFF/,'');
 let out=[],row=[],cell='',quote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(c==='"'){if(quote&&n==='"'){cell+='"';i++}else if(quote)quote=false;else if(!cell)quote=true;else throw Error('Invalid CSV quote')}
  else if(c===','&&!quote){row.push(cell);cell=''}
  else if((c==='\r'||c==='\n')&&!quote){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()))out.push(row);row=[];cell=''}
  else cell+=c;
 }
 if(quote)throw Error('Unclosed CSV quote');
 row.push(cell);if(row.some(v=>String(v).trim()))out.push(row);
 return out;
}
function validate(text,classes=[],existing=[]){
 const grid=csv(text),headers=(grid[0]||[]).map(x=>x.trim());
 if(headers.length!==fields.length||fields.some((x,i)=>x!==headers[i]))throw Error('Wrong CSV headings. Download the blank template.');
 if(grid.length<2)throw Error('Enter actual school textbook chapters before importing.');
 if(grid.length>151)throw Error('Maximum 150 chapters in one file.');
 const seen=new Set(existing.map(key)),valid=[],errors=[];
 grid.slice(1).forEach((values,i)=>{
  const line=i+2,x=Object.fromEntries(fields.map((k,j)=>[k,String(values[j]??'').trim()]));
  let error='';
  if(values.length!==fields.length)error='Incorrect number of fields';
  else if(fields.some(k=>x[k].length>400))error='One field exceeds 400 characters';
  else if(['className','subject','unitTitle','textbookTitle','curriculumBoard'].some(k=>!x[k]))error='Class, Subject, Chapter, actual Textbook and Board are required';
  else if(!classes.some(c=>c?.active!==false&&sameClass(c.className,x.className)))error='Class not active or registered in this school';
  else if(x.sectionName&&!classes.some(c=>c?.active!==false&&sameClass(c.className,x.className)&&norm(c.sectionName)===norm(x.sectionName)))error='Section not active or registered in this school';
  else if(!boards.has(x.curriculumBoard))error='Invalid textbook authority';
  else if(x.editionYear&&(!/^\d{4}$/.test(x.editionYear)||+x.editionYear<1900||+x.editionYear>2100))error='Invalid edition year';
  else if(x.sourceUrl&&!/^https:\/\/[^\s]+$/i.test(x.sourceUrl))error='Source URL must be HTTPS';
  else if(seen.has(key(x)))error='Duplicate stored/uploaded chapter';
  if(error)errors.push({line,error});else{seen.add(key(x));valid.push({...x,line})}
 });
 return{valid,errors};
}
function announce(message,error=false){const t=$('sbiStatus');if(t){t.textContent=message;t.dataset.error=error?'true':'false'}}
function previewOutput(r){
 const el=$('sbiPreview');if(!el)return;
 el.innerHTML='<p>'+r.valid.length+' valid · '+r.errors.length+' issues. Nothing saved yet.</p>'+
 (r.valid.length?'<div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Class</th><th>Section</th><th>Subject</th><th>Chapter</th><th>Textbook</th><th>Board</th></tr></thead><tbody>'+
 r.valid.slice(0,10).map(x=>'<tr>'+['className','sectionName','subject','unitTitle','textbookTitle','curriculumBoard'].map(k=>'<td>'+esc(x[k])+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div>':'')+
 (r.errors.length?'<p>'+r.errors.slice(0,12).map(x=>'Row '+x.line+': '+esc(x.error)).join(' · ')+'</p>':'');
}
async function preview(){
 resetPreview();const epoch=reviewEpoch,f=$('sbiFile')?.files?.[0];
 if(!f)return announce('Select a CSV file first.',true);
 if(!permitted())return announce('A current authorized school login is required; no local-only import.',true);
 if(f.size>1024*1024)return announce('Maximum file size 1 MB.',true);
 const start=scope();
 try{
  await api().pullCloud();
  if(epoch!==reviewEpoch||$('sbiFile')?.files?.[0]!==f)return;
  if(!permitted()||scope()!==start)throw Error('School changed. Reopen syllabus import.');
  if(api().classesVerified?.()===false)throw Error('School class directory could not be verified. Refresh Academic Groups before importing.');
  const classes=api().registeredClasses();
  if(!classes.length)throw Error('Register your school classes in Academic Groups first.');
  const contents=await f.text();
  if(epoch!==reviewEpoch||$('sbiFile')?.files?.[0]!==f)return;
  if(scope()!==start||!permitted())throw Error('School changed during file review.');
  const result=validate(contents,classes,api().savedUnits());
  previewOutput(result);
  if(result.errors.length)throw Error('Correct all CSV row issues before saving.');
  staged=result.valid;stagedScope=start;stagedFile=f;
  if($('sbiSave'))$('sbiSave').disabled=!staged.length;
  announce(staged.length+' rows validated. Check all book/chapter names, then confirm Save.');
 }catch(e){if(epoch===reviewEpoch)announce(String(e.message||e),true)}
}
async function save(){
 if(busy||!staged.length||!stagedFile||$('sbiFile')?.files?.[0]!==stagedFile||stagedScope!==scope()||!permitted())return announce('Validate your CSV again for the current school.',true);
 const start=scope(),epoch=reviewEpoch,session=sessionEpoch,selectedFile=stagedFile,rows=staged.slice(),inst=window.EDUNIZAM_CLOUD_CONFIG.institutionId,uid=window.EDUNIZAM_CLOUD.state.user.id;
 if(!confirm('Save '+rows.length+' actual prescribed textbook chapter(s) to this school?'))return;
 busy=true;let committed=false;const button=$('sbiSave');if(button)button.disabled=true;
 try{
  await api().pullCloud();
  if(start!==scope()||!permitted()||session!==sessionEpoch||epoch!==reviewEpoch||$('sbiFile')?.files?.[0]!==selectedFile)throw Error('School session or selected CSV changed.');
  if(api().classesVerified?.()===false)throw Error('Current school class directory not verified; nothing was submitted.');
  const headers=fields.join(','),lines=rows.map(x=>fields.map(f=>'"'+x[f].replace(/"/g,'""')+'"').join(','));
  const current=validate(headers+'\n'+lines.join('\n'),api().registeredClasses(),api().savedUnits());
  if(current.errors.length||current.valid.length!==rows.length)throw Error('School chapters or permissions changed. Validate file again.');
  if(scope()!==start||session!==sessionEpoch||epoch!==reviewEpoch||!permitted())throw Error('School session changed before save.');
  // One PostgREST INSERT statement: every validated row commits together or
  // a database validation/RLS error rejects the entire batch. Never write per row.
  const payloads=rows.map(x=>({institution_id:inst,class_name:x.className,section_name:x.sectionName||null,
   subject:x.subject,unit_title:x.unitTitle,textbook_title:x.textbookTitle,curriculum_board:x.curriculumBoard,
   edition_year:x.editionYear?Number(x.editionYear):null,source_url:x.sourceUrl||null,
   status:'Planned',completion_percent:0,family_visible:false,created_by:uid,updated_by:uid,updated_at:new Date().toISOString()}));
  // HTTP success is not proof of a saved syllabus batch. Require every
  // returned row and exact chapter name, not merely absence of an RLS error.
  const response=await client().from('syllabus_progress_units').insert(payloads).select('id,unit_title');
  if(scope()!==start||session!==sessionEpoch||epoch!==reviewEpoch||$('sbiFile')?.files?.[0]!==selectedFile)return;
  if(response?.error)throw Error('Database rejected the batch: '+response.error.message);
  const rowsSaved=response?.data,expected=new Map();
  for(const payload of payloads){
   const chapter=norm(payload.unit_title);
   expected.set(chapter,(expected.get(chapter)||0)+1);
  }
  if(!Array.isArray(rowsSaved)||rowsSaved.length!==rows.length||
     !rowsSaved.every(row=>{
      const chapter=norm(row?.unit_title),remaining=expected.get(chapter)||0;
      if(!row?.id||!remaining)return false;
      expected.set(chapter,remaining-1);return true;
     })||[...expected.values()].some(v=>v!==0)){
   throw Error('Database did not confirm all expected syllabus chapters. Check the school chapter list before retrying.');
  }
  committed=true;staged=[];stagedScope='';stagedFile=null;
  if($('sbiFile'))$('sbiFile').value='';
  if(scope()===start&&session===sessionEpoch&&typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')
   window.dispatchEvent(new CustomEvent('edunizam:school-data-changed',
    {detail:{scope:start,area:'syllabus',source:'school-syllabus-csv'}}));
  announce(rows.length+' genuine chapter(s) saved together to the selected school.');
  if(scope()===start&&session===sessionEpoch){
   try{await api().pullCloud();if(scope()===start&&session===sessionEpoch)await api().render()}
   catch(_){announce(rows.length+' chapter(s) saved, but the list could not refresh. Reopen Lesson Center to view them.',true)}
  }
 }catch(e){
  if(scope()!==start||session!==sessionEpoch||epoch!==reviewEpoch)return;
  staged=[];stagedScope='';stagedFile=null;
  // An interrupted network response may arrive after the database commits:
  // check records before retrying rather than promising zero saved rows.
  announce(committed
   ?rows.length+' chapter(s) saved, but the view could not refresh.'
   :'Batch save was not confirmed: '+String(e.message||e)+'. Check existing school chapters before validating and retrying.',true);
 }finally{busy=false;if(scope()===start&&session===sessionEpoch&&button?.isConnected)button.disabled=true}
}
function downloadClass5ScienceReference(){
 const file=new Blob([class5ScienceReviewCsv()],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(file),a=document.createElement('a');
 a.href=url;a.download='class5-science-PEF-2025-26-REVIEW-ONLY.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),500);
 announce('Reference worksheet downloaded (PEF 2025–26). Verify the 2026–27 book, all nine chapters and authority, then complete the blank textbook fields before CSV validation. Nothing was saved.');
}
function template(){
 const blob=new Blob(['\uFEFF'+fields.join(',')+'\r\n'],{type:'text/csv;charset=utf-8'});
 const a=document.createElement('a'),url=URL.createObjectURL(blob);
 a.href=url;a.download='edunizam-syllabus-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function mount(){
 const target=$('lpUnitEditor');
 if(!target||!['head','teacher'].includes(role())||$('sbiImport'))return;
 target.insertAdjacentHTML('beforebegin','<article class="card" id="sbiImport" style="margin:16px 0"><h3>Bulk Import School Syllabus (CSV)</h3>'+
 '<p class="coverage-note">Import your real textbooks and exact chapter names. Requires registered classes, book/board details and review. Template contains no fabricated content.</p>'+
 '<p class="coverage-note">Class 5 Science chapter reference: PEF Content Book <strong>2025–26 only</strong> (partner-school planning; not an approved 2026–27 school syllabus). <a href="https://www.pef.edu.pk/pdf/downloads/Content-List/Content-book-Primary-01-09-25.pdf" target="_blank" rel="noopener noreferrer">View PEF source</a> · <a href="https://pectaa.edu.pk/books-and-publications/" target="_blank" rel="noopener noreferrer">Check current PECTAA books</a>. Reference CSV has <strong>blank textbook title and board</strong>: no import until your school confirms them.</p>'+
 '<div class="form-grid"><label>Registered class / grade<select id="sbiWorksheetClass" aria-label="Choose registered class for syllabus worksheet"><option value="">All registered classes</option></select></label><label>Section<select id="sbiWorksheetSection" aria-label="Choose registered section for syllabus worksheet" disabled><option value="">All sections in selected class</option></select></label></div>'+ 
 '<div class="paper-actions"><button type="button" class="secondary" id="sbiRegisteredWorksheet">Download registered-class blank worksheet</button><button type="button" class="secondary" id="sbiRefreshWorksheet">Refresh registered classes</button></div><p id="sbiWorksheetNote" class="coverage-note" role="status" aria-live="polite">Only class and section names will be filled. Subjects, chapters, books and boards must be entered from real school textbooks.</p>'+ 
 '<div class="paper-actions"><button type="button" class="secondary" id="sbiTemplate">Download blank CSV</button>'+
 '<button type="button" class="secondary" id="sbiClass5Reference">Class 5 Science: 9 sourced chapter names (review CSV)</button>'+
 '<input id="sbiFile" type="file" accept=".csv,text/csv" aria-label="Select genuine school syllabus CSV">'+
 '<button type="button" class="secondary" id="sbiPreviewButton">Validate & Preview</button>'+
 '<button type="button" id="sbiSave" disabled>Save reviewed chapters</button></div>'+
 '<p id="sbiStatus" role="status" aria-live="polite">Up to 150 rows and 1 MB. No records are saved before confirmation.</p>'+
 '<div id="sbiPreview"></div></article>');
 $('sbiTemplate').onclick=template;$('sbiClass5Reference').onclick=downloadClass5ScienceReference;$('sbiPreviewButton').onclick=preview;$('sbiSave').onclick=save;
 $('sbiWorksheetClass').onchange=worksheetSelections;
 $('sbiRegisteredWorksheet').onclick=downloadRegisteredClassWorksheet;
 $('sbiRefreshWorksheet').onclick=async()=>{
  if(!permitted())return announce('Login required to refresh class names.',true);
  const start=scope(),generation=sessionEpoch;
  try{
   await api().pullCloud();
   if(start!==scope()||generation!==sessionEpoch)return;
   if(api().classesVerified?.()!==true)throw Error('Class directory could not be verified.');
   worksheetSelections();announce('Registered school classes refreshed. Select a class and download the blank worksheet.');
  }catch(error){if(start===scope()&&generation===sessionEpoch)announce('Class refresh failed: '+String(error?.message||error),true)}
 };
 worksheetSelections();
 $('sbiFile').onchange=()=>{resetPreview();announce('Selected file changed. Validate the new CSV.')};
}
// A sign-out can be followed by login to the SAME school with the SAME ID;
// only a generation check prevents a late response from reviving old UI.
if(typeof window.addEventListener==='function'){
 window.addEventListener('edunizam:auth',event=>{
  if(event?.detail?.event==='SIGNED_OUT'){sessionEpoch++;resetPreview();clearWorksheetSelections();announce('School session ended. Validate a new CSV after login.')}
 });
 window.addEventListener('edunizam:auth-state',event=>{
  if(['UNAUTHENTICATED','AUTH_ERROR'].includes(event?.detail?.state)){
   sessionEpoch++;resetPreview();clearWorksheetSelections();announce('School access ended. Sign in and revalidate the selected CSV.');
  }
 });
}
window.EDUNIZAM_SYLLABUS_CSV={fields,csv,validate,mount,preview,save,resetPreview,registeredClassWorksheet,worksheetSelections,clearWorksheetSelections,downloadRegisteredClassWorksheet,class5ScienceReference,class5ScienceReviewCsv,downloadClass5ScienceReference};
setTimeout(mount,0);
})();