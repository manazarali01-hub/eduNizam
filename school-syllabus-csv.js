/* School-entered prescribed textbook chapter CSV import.
   Only the current authorized school supplies rows; no sample data is saved. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const norm=x=>String(x??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fields=['className','sectionName','subject','unitTitle','textbookTitle','curriculumBoard','editionYear','sourceUrl'];
const boards=new Set(['punjab-pectaa','federal-fbise','sindh-stbb','kp-textbook','balochistan','other']);
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
let staged=[],stagedScope='',stagedFile=null,busy=false,reviewEpoch=0;
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
  else if(!classes.some(c=>sameClass(c.className,x.className)))error='Class not registered in this school';
  else if(x.sectionName&&!classes.some(c=>sameClass(c.className,x.className)&&norm(c.sectionName)===norm(x.sectionName)))error='Section not registered in this school';
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
 const start=scope(),epoch=reviewEpoch,selectedFile=stagedFile,rows=staged.slice(),inst=window.EDUNIZAM_CLOUD_CONFIG.institutionId,uid=window.EDUNIZAM_CLOUD.state.user.id;
 if(!confirm('Save '+rows.length+' actual prescribed textbook chapter(s) to this school?'))return;
 busy=true;let committed=false;const button=$('sbiSave');if(button)button.disabled=true;
 try{
  await api().pullCloud();
  if(start!==scope()||!permitted()||epoch!==reviewEpoch||$('sbiFile')?.files?.[0]!==selectedFile)throw Error('School session or selected CSV changed.');
  if(api().classesVerified?.()===false)throw Error('Current school class directory not verified; nothing was submitted.');
  const headers=fields.join(','),lines=rows.map(x=>fields.map(f=>'"'+x[f].replace(/"/g,'""')+'"').join(','));
  const current=validate(headers+'\n'+lines.join('\n'),api().registeredClasses(),api().savedUnits());
  if(current.errors.length||current.valid.length!==rows.length)throw Error('School chapters or permissions changed. Validate file again.');
  if(scope()!==start||!permitted())throw Error('School session changed before save.');
  // One PostgREST INSERT statement: every validated row commits together or
  // a database validation/RLS error rejects the entire batch. Never write per row.
  const payloads=rows.map(x=>({institution_id:inst,class_name:x.className,section_name:x.sectionName||null,
   subject:x.subject,unit_title:x.unitTitle,textbook_title:x.textbookTitle,curriculum_board:x.curriculumBoard,
   edition_year:x.editionYear?Number(x.editionYear):null,source_url:x.sourceUrl||null,
   status:'Planned',completion_percent:0,family_visible:false,created_by:uid,updated_by:uid,updated_at:new Date().toISOString()}));
  const response=await client().from('syllabus_progress_units').insert(payloads);
  if(response?.error)throw Error('Database rejected the batch: '+response.error.message);
  committed=true;staged=[];stagedScope='';stagedFile=null;
  if($('sbiFile'))$('sbiFile').value='';
  announce(rows.length+' genuine chapter(s) saved together to the selected school.');
  if(scope()===start){
   try{await api().pullCloud();await api().render()}
   catch(_){announce(rows.length+' chapter(s) saved, but the list could not refresh. Reopen Lesson Center to view them.',true)}
  }
 }catch(e){
  staged=[];stagedScope='';stagedFile=null;
  // An interrupted network response may arrive after the database commits:
  // check records before retrying rather than promising zero saved rows.
  announce(committed
   ?rows.length+' chapter(s) saved, but the view could not refresh.'
   :'Batch save was not confirmed: '+String(e.message||e)+'. Check existing school chapters before validating and retrying.',true);
 }finally{busy=false;if(button?.isConnected)button.disabled=true}
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
 '<div class="paper-actions"><button type="button" class="secondary" id="sbiTemplate">Download blank CSV</button>'+
 '<button type="button" class="secondary" id="sbiClass5Reference">Class 5 Science: 9 sourced chapter names (review CSV)</button>'+
 '<input id="sbiFile" type="file" accept=".csv,text/csv" aria-label="Select genuine school syllabus CSV">'+
 '<button type="button" class="secondary" id="sbiPreviewButton">Validate & Preview</button>'+
 '<button type="button" id="sbiSave" disabled>Save reviewed chapters</button></div>'+
 '<p id="sbiStatus" role="status" aria-live="polite">Up to 150 rows and 1 MB. No records are saved before confirmation.</p>'+
 '<div id="sbiPreview"></div></article>');
 $('sbiTemplate').onclick=template;$('sbiClass5Reference').onclick=downloadClass5ScienceReference;$('sbiPreviewButton').onclick=preview;$('sbiSave').onclick=save;
 $('sbiFile').onchange=()=>{resetPreview();announce('Selected file changed. Validate the new CSV.')};
}
window.EDUNIZAM_SYLLABUS_CSV={fields,csv,validate,mount,preview,save,resetPreview,class5ScienceReference,class5ScienceReviewCsv,downloadClass5ScienceReference};
setTimeout(mount,0);
})();