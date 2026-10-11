/* No fake syllabus records: validate actual school-authored CSV before an opt-in cloud write. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../school-syllabus-csv.js',import.meta.url),'utf8');
const w={},d={getElementById:()=>null},localStorage={getItem:()=>JSON.stringify({role:'head'})};
runInNewContext(source,{window:w,document:d,localStorage,setTimeout:()=>0,console});
const {validate,fields,csv}=w.EDUNIZAM_SYLLABUS_CSV;
assert.deepEqual([...fields],['className','sectionName','subject','unitTitle','textbookTitle','curriculumBoard','editionYear','sourceUrl']);
const header=fields.join(','),registered=[{className:'Grade 5',sectionName:'A'},{className:'5',sectionName:'B'}];
const good=header+'\n5,A,Mathematics,"Solids, liquids",School Science,punjab-pectaa,2026,https://example.org/book\n';
const row=validate(good,registered,[]);
assert.equal(row.errors.length,0);assert.equal(row.valid.length,1);
assert.equal(row.valid[0].unitTitle,'Solids, liquids');

const {registeredClassWorksheet}=w.EDUNIZAM_SYLLABUS_CSV;
const blank=registeredClassWorksheet(registered);
const structured=csv(blank);
assert.equal(structured.length,3,'Expected two authentic registered class sections');
assert.deepEqual([...structured[0]],fields);
assert.deepEqual([...structured[1]],['Grade 5','A','','','','','','']);
assert.deepEqual([...structured[2]],['5','B','','','','','','']);
assert.equal(validate(blank,registered,[]).valid.length,0,
 'Blank unreviewed class worksheet should never pass textbook validation');
assert.equal(validate(blank,registered,[]).errors.length,2);
const selected=registeredClassWorksheet(registered,{className:'Class 5',sectionName:'B'});
assert.equal(csv(selected).length,2,'Selected section exported extra classes');
assert.equal(csv(selected)[1][1],'B');
assert.throws(()=>registeredClassWorksheet(registered,{className:'7'}),/not in this school/i);
assert.throws(()=>registeredClassWorksheet(registered,{sectionName:'A'}),/Select a class/i);
assert.throws(()=>registeredClassWorksheet([]),/No registered school classes/i);
assert.throws(()=>registeredClassWorksheet([{className:'=2+2',sectionName:'A'}]),
 /Unsafe class/i,'Spreadsheet formula-like class names should not be exported');
assert.throws(()=>registeredClassWorksheet(Array.from({length:151},(_,i)=>({className:'5',sectionName:'S'+i}))),
 /150/);
assert.equal(csv(registeredClassWorksheet([{className:'5',sectionName:'A, "Blue"'}]))[1][1],
 'A, "Blue"','Quoted section text was corrupted');
assert.equal(csv(registeredClassWorksheet([{className:'5',sectionName:'A'},{className:'Grade 5',sectionName:'A'}])).length,
 2,'Whole-grade aliases should not duplicate class sections');
const actual=csv(selected)[1];
actual[2]='General Science';actual[3]='Verified real chapter';actual[4]='Actual School Science';
actual[5]='punjab-pectaa';actual[6]='2026';
const reviewed=fields.join(',')+'\n'+actual.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')+'\n';
assert.equal(validate(reviewed,registered,[]).valid.length,1,
 'A completed school worksheet did not roundtrip into the syllabus importer');

assert.equal(csv('"One line\nSecond line",B\n')[0][0],'One line\nSecond line');
const stored=[{className:'Grade 5',sectionName:'A',subject:'Mathematics',unitTitle:'Solids, liquids'}];
assert.equal(validate(good,registered,stored).errors.length,1,'Existing same-school chapter duplicated');
const invalid=[
 '8,A,Math,Algebra,Real Book,punjab-pectaa,,',
 '5,Z,Math,Algebra,Real Book,punjab-pectaa,,',
 '5,A,Math,Algebra,,punjab-pectaa,,',
 '5,A,Math,Algebra,Real Book,untrusted,,',
 '5,A,Math,Algebra,Real Book,punjab-pectaa,hello,',
 '5,A,Math,Algebra,Real Book,punjab-pectaa,,javascript:alert(1)'
];
for(const candidate of invalid){
 const result=validate(header+'\n'+candidate,registered,[]);
 assert.equal(result.valid.length,0,'Invalid row wrongly accepted: '+candidate);
 assert.equal(result.errors.length,1,'Invalid row not reported: '+candidate);
}
assert.equal(validate(header+'\n5,A,Math,Algebra,Real Book,punjab-pectaa,,\n5,A,Math,Algebra,Real Book,punjab-pectaa,,',registered,[]).errors.length,1);
assert.throws(()=>validate('class,title\n5,Algebra',registered,[]),/headings/);
assert.throws(()=>validate(header+'\n',registered,[]),/Enter actual/);
assert.throws(()=>validate(header+'\n'+'5,A,Math,Algebra,Real Book,punjab-pectaa,,\n'.repeat(151),registered,[]),/150/);
assert.match(source,/institution_id:inst/);
assert.match(source,/created_by:uid,updated_by:uid/);
assert.match(source,/if\(scope\(\)!==start\|\|!permitted\(\)\)/);
assert.match(source,/api\(\)\.pullCloud\(\)/);
assert.match(source,/id="sbiSave" disabled/);
assert.match(source,/status:'Planned',completion_percent:0,family_visible:false/);
assert.doesNotMatch(source,/service_role|sb_secret_/);
// Saving must issue one scoped PostgREST batch, never N per-row writes
// that could leave an incompletely imported syllabus on a later failure.
const nodes={
 sbiFile:{files:[{size:400,text:async()=>header+'\n'+
  '5,A,General Science,Energy,School Science,punjab-pectaa,2026,https://example.org/book\n'+
  '5,A,General Science,Matter,School Science,punjab-pectaa,2026,https://example.org/book\n'}],value:'selected.csv'},
 sbiSave:{disabled:true,isConnected:true},
 sbiStatus:{textContent:'',dataset:{}}
};
const calls=[];let rejectBatch=true,returnNoRows=false;
const importerWindow={
 EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-A'},
 EDUNIZAM_CLOUD:{state:{user:{id:'teacher-1'},client:{from(table){
  assert.equal(table,'syllabus_progress_units');
  return {insert:payload=>({select:async()=>{
   calls.push(payload);
   return rejectBatch?{error:{message:'simulated RLS rejection'}}:
    returnNoRows?{data:[],error:null}:
    {data:payload.map((row,i)=>({id:'confirmed-'+i,unit_title:row.unit_title})),error:null};
  }})};
 }}}},
 EDUNIZAM_LESSON_CENTER:{cloudReady:()=>true,pullCloud:async()=>{},registeredClasses:()=>registered,savedUnits:()=>[],render:async()=>{}}
};
const importerDoc={getElementById:id=>nodes[id]||null};
runInNewContext(source,{window:importerWindow,document:importerDoc,
 localStorage:{getItem:()=>JSON.stringify({role:'head'})},setTimeout:()=>0,
 confirm:()=>true,console,Promise});
const importer=importerWindow.EDUNIZAM_SYLLABUS_CSV;
await importer.preview();
assert.equal(nodes.sbiSave.disabled,false,'Valid reviewed chapters should enable save');
await importer.save();
assert.equal(calls.length,1,'Rejected multi-row import must make only one write request');
assert.equal(calls[0].length,2,'One payload must contain both validated chapters');
assert.equal(calls[0][0].institution_id,'school-A');
assert.match(nodes.sbiStatus.textContent,/not confirmed/,'Batch rejection must not claim any success');
rejectBatch=false;
await importer.preview();
await importer.save();
assert.equal(calls.length,2,'Successful multi-row import must still use one additional write');
assert.equal(calls[1].length,2);
assert.match(nodes.sbiStatus.textContent,/2 genuine chapter\(s\) saved together/);
returnNoRows=true;
await importer.preview();await importer.save();
assert.equal(calls.length,3,'Zero-return insert should be submitted just once');
assert.match(nodes.sbiStatus.textContent,/not confirmed/,'Zero-return INSERT falsely announced imported chapters');
returnNoRows=false;
assert.match(source,/\.insert\(payloads\)\.select\('id,unit_title'\)/);
assert.doesNotMatch(source,/for\(const x of rows\)\s*\{[\s\S]*?\.insert\(payload\)/,
 'Importer must not reintroduce a per-row database write loop');

// Old asynchronous CSV reads must not reactivate Save after a user selects another file.
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
{
 const slow=deferred();
 const oldFile={size:400,text:()=>slow.promise};
 const newFile={size:400,text:async()=>header+'\n5,A,General Science,New Chapter,School Science,punjab-pectaa,2026,https://example.org/book'};
 const ui={sbiFile:{files:[oldFile],value:'old.csv'},sbiSave:{disabled:true,isConnected:true},
  sbiStatus:{textContent:'',dataset:{}},sbiPreview:{innerHTML:''}};
 const writes=[];let pendingDatabaseResponse=null;
 const listeners=new Map();
 const lesson={cloudReady:()=>true,pullCloud:async()=>{},registeredClasses:()=>registered,
  savedUnits:()=>[],render:async()=>{}};
 const ww={addEventListener:(name,fn)=>listeners.set(name,fn),EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-A'},
  EDUNIZAM_CLOUD:{state:{user:{id:'teacher-1'},client:{from:()=>({insert:rows=>({select:async()=>{
   writes.push(rows);
   if(pendingDatabaseResponse)return pendingDatabaseResponse.promise;
   return{data:rows.map((row,i)=>({id:'new-'+i,unit_title:row.unit_title})),error:null};
  }})})}}},
  EDUNIZAM_LESSON_CENTER:lesson};
 const dd={getElementById:id=>ui[id]||null};
 runInNewContext(source,{window:ww,document:dd,
  localStorage:{getItem:()=>JSON.stringify({role:'head'})},setTimeout:()=>0,
  confirm:()=>true,Promise,console});
 const imp=ww.EDUNIZAM_SYLLABUS_CSV;
 const oldPreview=imp.preview();
 await Promise.resolve();await Promise.resolve();
 ui.sbiFile.files=[newFile];imp.resetPreview();
 slow.resolve(header+'\n5,A,General Science,Old Chapter,School Science,punjab-pectaa,2026,https://example.org/book');
 await oldPreview;
 assert.equal(ui.sbiSave.disabled,true,'Old syllabus preview reactivated Save after file changed');
 await imp.save();assert.equal(writes.length,0,'Stale syllabus CSV was written to school records');
 await imp.preview();assert.equal(ui.sbiSave.disabled,false);
 await imp.save();assert.equal(writes.length,1);
 assert.equal(writes[0][0].unit_title,'New Chapter','Old file overwrote selected new syllabus CSV');
 ui.sbiFile.files=[newFile];imp.resetPreview();await imp.preview();
 const fetchRows=deferred();lesson.pullCloud=()=>fetchRows.promise;
 const pendingSave=imp.save();
 ui.sbiFile.files=[oldFile];imp.resetPreview();
 fetchRows.resolve();await pendingSave;
 assert.equal(writes.length,1,'Syllabus file switch during save still caused a database write');
 // A completed INSERT response from the former session must not show success
 // if the SAME user logs back in before the network call resolves.
 ui.sbiFile.files=[newFile];imp.resetPreview();await imp.preview();
 pendingDatabaseResponse=deferred();
 const staleSave=imp.save();
 for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(writes.length,2,'Expected one outstanding current-school syllabus insert');
 listeners.get('edunizam:auth')?.({detail:{event:'SIGNED_OUT'}});
 const logoutMessage=ui.sbiStatus.textContent;
 assert.equal(ui.sbiSave.disabled,true,'Logout did not disable old CSV Save');
 pendingDatabaseResponse.resolve({data:[{id:'confirmed-late',unit_title:'New Chapter'}],error:null});
 await staleSave;
 assert.equal(ui.sbiStatus.textContent,logoutMessage,
  'Late same-user syllabus INSERT revived a success message after logout');
 pendingDatabaseResponse=null;
}


// The actual Lesson Center UI must expose an actionable download. Its cloud
// directory must be refreshed before exporting; no cached cross-school data.
{
 const elements=new Map(),downloads=[],urls=new Map(),events=new Map();
 const mk=id=>{
  if(elements.has(id))return elements.get(id);
  const e={value:'',innerHTML:'',textContent:'',disabled:false,dataset:{},isConnected:true,onclick:null,onchange:null};
  elements.set(id,e);return e;
 };
 mk('lpUnitEditor').insertAdjacentHTML=(_,markup)=>{
  for(const m of markup.matchAll(/\bid="([^"]+)"/g))mk(m[1]);
 };
 const doc={getElementById:id=>elements.get(id)||null,createElement:()=>({
  href:'',download:'',click(){downloads.push({name:this.download,blob:urls.get(this.href)})}
 })};
 const state={institutionId:'school-A'},user={id:'head-1'};
 let cloudRows=registered,verified=true,refreshes=0,slowRefresh=null;
 const lesson={
  cloudReady:()=>true,
  pullCloud:async()=>{refreshes++;if(slowRefresh)await slowRefresh.promise},
  registeredClasses:()=>cloudRows,
  classesVerified:()=>verified
 };
 const win={
  EDUNIZAM_CLOUD_CONFIG:state,EDUNIZAM_CLOUD:{state:{user}},
  EDUNIZAM_LESSON_CENTER:lesson,
  addEventListener:(name,callback)=>events.set(name,callback)
 };
 const URLStub={createObjectURL(blob){const url='blob:review-'+urls.size;urls.set(url,blob);return url},revokeObjectURL(){}};
 runInNewContext(source,{window:win,document:doc,localStorage,
  URL:URLStub,Blob,console,Promise,setTimeout:()=>0,confirm:()=>true});
 const ui=win.EDUNIZAM_SYLLABUS_CSV;
 ui.mount();
 assert(elements.has('sbiRegisteredWorksheet'),'Registered-class download button is missing');
 assert(elements.has('sbiRefreshWorksheet'),'Registered-class directory refresh button is missing');
 assert.match(mk('sbiWorksheetClass').innerHTML,/Grade 5/);
 mk('sbiWorksheetClass').value='Grade 5';
 ui.worksheetSelections();
 assert.match(mk('sbiWorksheetSection').innerHTML,/>A</);
 mk('sbiWorksheetSection').value='A';
 await mk('sbiRegisteredWorksheet').onclick();
 assert.equal(refreshes,1,'Export did not reread the school cloud directory');
 assert.equal(downloads.length,1,'Registered-class download button was inactive');
 assert.match(downloads[0].name,/BLANK-REVIEW\.csv$/);
 const exported=csv(await downloads[0].blob.text());
 assert.equal(exported.length,2);
 assert.deepEqual([...exported[1]],['Grade 5','A','','','','','','']);
 // A switched institution with unverified class rows must never export.
 verified=false;state.institutionId='school-B';
 const oldDownloads=downloads.length;
 await mk('sbiRegisteredWorksheet').onclick();
 assert.equal(downloads.length,oldDownloads,'Unverified switched-school class list was exported');
 assert.match(mk('sbiStatus').textContent,/not generated/i);
 verified=true;state.institutionId='school-A';
 mk('sbiWorksheetClass').value='Grade 5';
 ui.worksheetSelections();
 mk('sbiWorksheetSection').value='A';
 slowRefresh=deferred();
 const oldDownload=mk('sbiRegisteredWorksheet').onclick();
 events.get('edunizam:auth')?.({detail:{event:'SIGNED_OUT'}});
 assert.equal(mk('sbiWorksheetClass').value,'','Sign-out kept private class selection');
 assert.doesNotMatch(mk('sbiWorksheetClass').innerHTML,/Grade 5/,
  'Sign-out leaked old class names in the worksheet dropdown');
 slowRefresh.resolve();
 await oldDownload;
 assert.equal(downloads.length,oldDownloads,'Old-session pending export completed after sign-out');
}

console.log('Syllabus CSV import PASS: school/section validation, real board/title, duplicates, quoted/newline CSV, HTTPS, atomic guarded cloud write.');
