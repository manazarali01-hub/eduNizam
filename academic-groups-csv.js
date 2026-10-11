/* Head-reviewed Academic Groups CSV setup. Never inserts inferred or demo school data. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const columns=['className','sectionName','roomLabel','capacity'];
const clean=s=>String(s??'').trim().replace(/\s+/g,' ');
const norm=s=>clean(s).normalize('NFKC').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const directory=()=>window.EDUNIZAM_CLASS_SECTION_CENTER;
const role=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')?.role}catch{return null}};
const permitted=()=>role()==='head'&&!!directory()?.cloudReady?.()&&!!directory()?.cacheScope?.();
const scope=()=>directory()?.cacheScope?.()||'';
let staged=[],stagedScope='',stagedFile=null,saving=false,reviewEpoch=0,sessionEpoch=0;
const classKey=name=>{const value=norm(name),m=value.match(/^(?:(?:class|grade)\s*)?(1[0-2]|[1-9])$/);return m?String(Number(m[1])):value};
const identity=(cls,section)=>classKey(cls)+'|'+norm(section);
function resetPreview(){
 reviewEpoch++;staged=[];stagedScope='';stagedFile=null;
 const button=$('acsvSave');if(button)button.disabled=true;
 const output=$('acsvPreview');if(output)output.innerHTML='';
}
function csv(text){
 const result=[],str=String(text||'').replace(/^\uFEFF/,'');
 let row=[],value='',quoted=false;
 for(let i=0;i<str.length;i++){
  const ch=str[i],next=str[i+1];
  if(ch==='"'){if(quoted&&next==='"'){value+='"';i++}else if(quoted)quoted=false;else if(value==='')quoted=true;else throw Error('Unexpected CSV quote')}
  else if(ch===','&&!quoted){row.push(value);value=''}
  else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(value);if(row.some(x=>String(x).trim()))result.push(row);row=[];value=''}
  else value+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 row.push(value);if(row.some(x=>String(x).trim()))result.push(row);
 return result;
}
function validate(text,existing=[]){
 const grid=csv(text),headers=(grid[0]||[]).map(clean);
 if(headers.length!==columns.length||columns.some((c,i)=>c!==headers[i]))
  throw Error('Incorrect CSV headings. Download the blank template.');
 if(grid.length<2)throw Error('Add genuine school classes and sections before importing.');
 if(grid.length>101)throw Error('Maximum 100 class/section rows per CSV.');
 const sameClass=(a,b)=>{
  const api=window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
  if(api?.sameClass)return api.sameClass(a,b);
  const grade=x=>norm(x).match(/^(?:(?:class|grade)\s*)?(1[0-2]|[1-9])$/)?.[1];
  return norm(a)===norm(b)||!!(grade(a)&&grade(a)===grade(b));
 };
 const pairs=[...(Array.isArray(existing)?existing:[])].map(x=>({className:clean(x.className??x.class_name),sectionName:clean(x.sectionName??x.section_name)}));
 const valid=[],errors=[];
 grid.slice(1).forEach((fields,index)=>{
  const line=index+2,values=Object.fromEntries(columns.map((k,i)=>[k,clean(fields[i])]));
  const cls=values.className,sec=values.sectionName,room=values.roomLabel,cap=values.capacity;
  let error='';
  if(fields.length!==4)error='Expected exactly four columns';
  else if(!cls||!sec)error='Class and section are required';
  else if(cls.length>80||sec.length>40||room.length>80)error='Class, section or room label too long';
  else if(cap&&(!/^[0-9]+$/.test(cap)||Number(cap)<1||Number(cap)>10000))error='Capacity must be 1 to 10000, or blank';
  else if(pairs.some(p=>sameClass(p.className,cls)&&norm(p.sectionName)===norm(sec)))error='Duplicate class/section in this school or CSV';
  if(error)errors.push({line,error});
  else {pairs.push({className:cls,sectionName:sec});valid.push({...values,line,capacity:cap?Number(cap):null})}
 });
 return{valid,errors};
}
function status(message,error=false){const e=$('acsvStatus');if(e){e.textContent=message;e.dataset.error=error?'true':'false'}}
function previewList(result){
 const el=$('acsvPreview');if(!el)return;
 el.innerHTML='<p>'+result.valid.length+' valid rows, '+result.errors.length+' errors. No records have been saved.</p>'+
 (result.valid.length?'<div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Class</th><th>Section</th><th>Room</th><th>Capacity</th></tr></thead><tbody>'+
 result.valid.slice(0,12).map(row=>'<tr>'+['className','sectionName','roomLabel','capacity'].map(k=>'<td>'+esc(row[k]??'')+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div>':'')+
 (result.errors.length?'<p>'+result.errors.slice(0,15).map(e=>'Row '+e.line+': '+esc(e.error)).join(' · ')+'</p>':'');
}
async function preview(){
 resetPreview();
 const epoch=reviewEpoch,file=$('acsvFile')?.files?.[0];
 if(!file)return status('Choose a CSV file first.',true);
 if(!permitted())return status('Sign in as the Head of Institute to the correct school.',true);
 if(file.size>1024*1024)return status('Maximum CSV size is 1 MB.',true);
 const current=scope();
 try{
  await directory().pullCloud();
  if(epoch!==reviewEpoch||$('acsvFile')?.files?.[0]!==file)return;
  if(!permitted()||scope()!==current)throw Error('School or account changed during import preview.');
  const contents=await file.text();
  if(epoch!==reviewEpoch||$('acsvFile')?.files?.[0]!==file||scope()!==current)return;
  const checked=validate(contents,directory().read());
  previewList(checked);
  if(checked.errors.length)throw Error('Correct every CSV row before saving.');
  if(scope()!==current)throw Error('School changed during import review.');
  staged=checked.valid;stagedScope=current;stagedFile=file;
  if($('acsvSave'))$('acsvSave').disabled=!staged.length;
  status(staged.length+' reviewed class/section rows ready. Check details and confirm Save.');
 }catch(e){if(epoch===reviewEpoch)status(String(e.message||e),true)}
}
async function save(){
 if(saving||!staged.length||!stagedFile||$('acsvFile')?.files?.[0]!==stagedFile||scope()!==stagedScope||!permitted())
  return status('Revalidate the CSV for the current authorized school.',true);
 const rows=staged.slice(),current=scope(),epoch=reviewEpoch,session=sessionEpoch,selectedFile=stagedFile,config=window.EDUNIZAM_CLOUD_CONFIG,cloud=window.EDUNIZAM_CLOUD;
 if(!confirm('Save '+rows.length+' real class/section rows to this school?'))return;
 saving=true;const button=$('acsvSave');if(button)button.disabled=true;
 try{
  await directory().pullCloud();
  if(!permitted()||scope()!==current||session!==sessionEpoch||epoch!==reviewEpoch||$('acsvFile')?.files?.[0]!==selectedFile)throw Error('School or selected CSV changed. Nothing was submitted.');
  const header=columns.join(','),body=rows.map(row=>columns.map(k=>'"'+String(k==='capacity'?(row[k]??''):row[k]).replace(/"/g,'""')+'"').join(','));
  const verified=validate(header+'\n'+body.join('\n'),directory().read());
  if(verified.errors.length||verified.valid.length!==rows.length)throw Error('Class directory changed or CSV contains duplicates. Review it again.');
  if(!permitted()||scope()!==current||session!==sessionEpoch||epoch!==reviewEpoch)throw Error('School changed just before saving.');
  const payloads=rows.map(row=>({institution_id:config.institutionId,
    class_name:row.className,section_name:row.sectionName,room_label:row.roomLabel||null,
    capacity:row.capacity,active:true,updated_by:cloud.state.user.id}));
  // PostgREST can return no error while RLS inserts zero rows. Each exact
  // class+section must be returned before we report a successful setup.
  const {data,error}=await cloud.state.client.from('class_sections').insert(payloads)
   .select('id,class_name,section_name');
  if(scope()!==current||session!==sessionEpoch||epoch!==reviewEpoch||$('acsvFile')?.files?.[0]!==selectedFile)return;
  if(error)throw Error(error.message||'Database rejected the batch.');
  const expected=new Map();
  for(const item of payloads){
   const name=identity(item.class_name,item.section_name);
   expected.set(name,(expected.get(name)||0)+1);
  }
  if(!Array.isArray(data)||data.length!==rows.length||
     !data.every(item=>{
      const name=identity(item?.class_name,item?.section_name),remaining=expected.get(name)||0;
      if(!item?.id||!remaining)return false;
      expected.set(name,remaining-1);
      return true;
     })||[...expected.values()].some(value=>value!==0))
   throw Error('Database did not confirm every class/section. Refresh the school directory before retrying.');
  staged=[];stagedScope='';stagedFile=null;
  if($('acsvFile'))$('acsvFile').value='';
  if(scope()===current&&session===sessionEpoch){
   status(rows.length+' real class/section rows saved together to this school.');
   try{await directory().pullCloud();if(scope()===current&&session===sessionEpoch)await directory().render()
   catch(_){status('Rows saved, but refresh failed. Reopen Academic Groups to verify them.',true)}
  }
 }catch(e){
  if(scope()!==current||session!==sessionEpoch||epoch!==reviewEpoch)return;
  staged=[];stagedScope='';stagedFile=null;
  if(scope()===current&&epoch===reviewEpoch)status('Save not confirmed: '+String(e.message||e)+'. Refresh school records before retrying to avoid duplicates.',true);
 }finally{saving=false;if(scope()===current&&session===sessionEpoch&&button?.isConnected)button.disabled=true}
}
function template(){
 const file=new Blob(['\uFEFF'+columns.join(',')+'\r\n'],{type:'text/csv;charset=utf-8'});
 const a=document.createElement('a'),url=URL.createObjectURL(file);
 a.href=url;a.download='edunizam-academic-groups-blank.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),500);
}
function mount(){
 const editor=$('csEditor');if(!editor||$('acsvImport')||!permitted())return;
 editor.insertAdjacentHTML('beforebegin','<article class="card" id="acsvImport" style="margin:16px 0">'+
 '<h3>Bulk Import Academic Groups (CSV)</h3>'+
 '<p class="coverage-note">Use actual school class and section names only. Download a blank template, validate every row, and confirm one atomic save. Teacher assignments can be added after staff are registered.</p>'+
 '<div class="paper-actions"><button type="button" class="secondary" id="acsvTemplate">Download blank CSV</button>'+
 '<input id="acsvFile" type="file" accept=".csv,text/csv" aria-label="Actual school class section CSV">'+
 '<button type="button" class="secondary" id="acsvPreviewButton">Validate &amp; Preview</button>'+
 '<button type="button" id="acsvSave" disabled>Save reviewed classes</button></div>'+
 '<p id="acsvStatus" role="status" aria-live="polite">Up to 100 sections, 1 MB file. Nothing saved before review.</p>'+
 '<div id="acsvPreview"></div></article>');
 $('acsvTemplate').onclick=template;$('acsvPreviewButton').onclick=preview;$('acsvSave').onclick=save;
 $('acsvFile').onchange=()=>{resetPreview();status('File changed. Validate and preview again.')};
}
if(typeof window.addEventListener==='function'){
 window.addEventListener('edunizam:auth',event=>{
  if(event?.detail?.event==='SIGNED_OUT'){sessionEpoch++;resetPreview();status('School session ended. Revalidate classes after signing in.')}
 });
 window.addEventListener('edunizam:auth-state',event=>{
  if(['UNAUTHENTICATED','AUTH_ERROR'].includes(event?.detail?.state)){
   sessionEpoch++;resetPreview();status('School access ended. Sign in before reviewing school classes.');
  }
 });
}
window.EDUNIZAM_ACADEMIC_GROUPS_CSV={columns,csv,validate,preview,save,mount,resetPreview};
setTimeout(mount,0);
})();