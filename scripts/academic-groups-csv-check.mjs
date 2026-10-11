/* Zero fabricated school data: validate and submit only reviewed Academic Groups CSV. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../academic-groups-csv.js',import.meta.url),'utf8');
const academic=readFileSync(new URL('../academic-form-options.js',import.meta.url),'utf8');
const options={};runInNewContext(academic,{window:options});
const rows=[{className:'Grade 5',sectionName:'A'}];
const header='className,sectionName,roomLabel,capacity';
const row1='5,B,Room 2,40';
const row2='Class 4,A,"East, Block",25';
const fileText=header+'\n'+row1+'\n'+row2;
const nodes={
 acsvFile:{files:[{size:300,text:async()=>fileText}],value:'groups.csv'},
 acsvSave:{disabled:true,isConnected:true},
 acsvStatus:{textContent:'',dataset:{}},
 acsvPreview:{innerHTML:''}
};
const recorded=[],directory={cloudReady:()=>true,cacheScope:()=> 'school-A|admin-1',
 pullCloud:async()=>{},read:()=>rows,render:async()=>{}};
const w={
 EDUNIZAM_CLASS_SECTION_CENTER:directory,
 EDUNIZAM_ACADEMIC_FORM_OPTIONS:options.EDUNIZAM_ACADEMIC_FORM_OPTIONS,
 EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-A'},
 EDUNIZAM_CLOUD:{state:{user:{id:'admin-1'},client:{from(table){
  assert.equal(table,'class_sections');
  return {insert:async items=>{recorded.push(items);return {error:recorded.length===1?{message:'simulated RLS failure'}:null}}};
 }}}}
};
const doc={getElementById:id=>nodes[id]||null};
runInNewContext(source,{window:w,document:doc,
 localStorage:{getItem:()=>JSON.stringify({role:'head'})},Promise,
 setTimeout:()=>0,confirm:()=>true,console});
const csv=w.EDUNIZAM_ACADEMIC_GROUPS_CSV;
assert.deepEqual([...csv.columns],['className','sectionName','roomLabel','capacity']);
assert.equal(csv.validate(fileText,rows).valid.length,2);
assert.equal(csv.validate(fileText,rows).valid[1].roomLabel,'East, Block');
assert.equal(csv.validate(header+'\nGrade 5,A,,\n',rows).errors.length,1,'Current school duplicate not prevented');
assert.equal(csv.validate(header+'\n5,A,,\n',rows).errors.length,1,'Class grade alias duplicate not prevented');
const noHelper={};
runInNewContext(source,{window:noHelper,document:doc,
 localStorage:{getItem:()=>JSON.stringify({role:'head'})},
 Promise,setTimeout:()=>0,confirm:()=>true,console});
assert.equal(noHelper.EDUNIZAM_ACADEMIC_GROUPS_CSV.validate(header+'\n5,A,,',rows).errors.length,1,
 'Grade alias deduplication must work before academic helper scripts load');
assert.equal(csv.validate(header+'\n'+row1+'\n'+row1,rows).errors.length,1,'Repeated CSV row not detected');
assert.equal(csv.validate(header+'\n5,Z,,0',rows).errors.length,1,'Zero capacity must fail');
assert.equal(csv.validate(header+'\n5,Z,,not-a-number',rows).errors.length,1);
assert.equal(csv.validate(header+'\n5,,Office,10',rows).errors.length,1);
assert.equal(csv.validate(header+'\n5,Z,,',rows).valid.length,1,'Blank capacity must be allowed');
assert.throws(()=>csv.validate(header+'\n',rows),/genuine/);
assert.throws(()=>csv.validate('class,title\n5,A',rows),/headings/);
assert.throws(()=>csv.validate(header+'\n'+row1+'\n'.repeat(0)+Array(101).fill('6,A,,').join('\n'),rows),/Maximum 100/);
await csv.preview();
assert.equal(nodes.acsvSave.disabled,false,'Only validated data enables save');
await csv.save();
assert.equal(recorded.length,1);
assert.equal(recorded[0].length,2,'All rows should be sent in one database operation');
assert.equal(recorded[0][0].institution_id,'school-A');
assert.equal(recorded[0][0].updated_by,'admin-1');
assert.match(nodes.acsvStatus.textContent,/Save not confirmed/);
await csv.preview();
await csv.save();
assert.equal(recorded.length,2);
assert.equal(recorded[1].length,2);
assert.match(source,/\.insert\(payloads\)/);
assert.match(nodes.acsvStatus.textContent,/saved together|Rows saved/);
assert.doesNotMatch(source,/service_role|sb_secret_/);
const otherWindow={EDUNIZAM_CLASS_SECTION_CENTER:directory,EDUNIZAM_CLOUD_CONFIG:w.EDUNIZAM_CLOUD_CONFIG,EDUNIZAM_CLOUD:w.EDUNIZAM_CLOUD};
runInNewContext(source,{window:otherWindow,document:doc,localStorage:{getItem:()=>JSON.stringify({role:'teacher'})},
 Promise,setTimeout:()=>0,confirm:()=>true,console});
await otherWindow.EDUNIZAM_ACADEMIC_GROUPS_CSV.preview();
assert.match(nodes.acsvStatus.textContent,/Head of Institute/,'Teacher may not bulk insert Academic Groups');
// A slow File.text() from the former selection must not re-enable Save.
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
{
 const slow=deferred(),oldFile={size:300,text:()=>slow.promise};
 const newFile={size:300,text:async()=>header+'\\n6,C,Room 6,24'};
 const ui={acsvFile:{files:[oldFile],value:'old.csv'},acsvSave:{disabled:true,isConnected:true},
  acsvStatus:{textContent:'',dataset:{}},acsvPreview:{innerHTML:''}};
 const writes=[];
 const dir={cloudReady:()=>true,cacheScope:()=> 'school-A|admin-1',pullCloud:async()=>{},
  read:()=>[],render:async()=>{}};
 const ww={EDUNIZAM_CLASS_SECTION_CENTER:dir,EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-A'},
  EDUNIZAM_CLOUD:{state:{user:{id:'admin-1'},client:{from:()=>({insert:async x=>{writes.push(x);return{error:null}}})}}}};
 const dd={getElementById:id=>ui[id]||null};
 runInNewContext(source,{window:ww,document:dd,localStorage:{getItem:()=>JSON.stringify({role:'head'})},
  Promise,setTimeout:()=>0,confirm:()=>true,console});
 const imp=ww.EDUNIZAM_ACADEMIC_GROUPS_CSV;
 const oldPreview=imp.preview();
 await Promise.resolve();await Promise.resolve();
 ui.acsvFile.files=[newFile];imp.resetPreview();
 slow.resolve(header+'\\n8,B,Old Room,40');
 await oldPreview;
 assert.equal(ui.acsvSave.disabled,true,'Old async file completed after selection changed');
 await imp.save();
 assert.equal(writes.length,0,'Stale preview was allowed to insert the old CSV');
 await imp.preview();assert.equal(ui.acsvSave.disabled,false,'Current file cannot be reviewed after invalidation');
 await imp.save();assert.equal(writes.length,1);
 assert.equal(writes[0][0].class_name,'6','The old CSV overwrote the newly selected file');
 // Change selected file while save is waiting for the latest cloud directory.
 ui.acsvFile.files=[newFile];imp.resetPreview();await imp.preview();
 const fetching=deferred();dir.pullCloud=()=>fetching.promise;
 const pendingSave=imp.save();
 ui.acsvFile.files=[oldFile];imp.resetPreview();
 fetching.resolve();await pendingSave;
 assert.equal(writes.length,1,'A file changed during save still reached PostgREST');
}

const loader=readFileSync(new URL('../feature-loader.js',import.meta.url),'utf8');
const center=readFileSync(new URL('../class-section-center.js',import.meta.url),'utf8');
assert.match(loader,/classcenter:\['school-student-picker\.js','class-section-center\.js','academic-groups-csv\.js'\]/);
assert.match(center,/EDUNIZAM_ACADEMIC_GROUPS_CSV\?\.mount\?\.\(\)/);
console.log('Academic Groups CSV PASS: validated school classes, duplicate aliases, atomic batch, retries and Head-only access');