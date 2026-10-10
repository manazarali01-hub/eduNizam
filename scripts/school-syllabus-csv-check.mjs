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
const calls=[];let rejectBatch=true;
const importerWindow={
 EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-A'},
 EDUNIZAM_CLOUD:{state:{user:{id:'teacher-1'},client:{from(table){
  assert.equal(table,'syllabus_progress_units');
  return {insert:async payload=>{calls.push(payload);return rejectBatch?{error:{message:'simulated RLS rejection'}}:{error:null}}};
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
assert.match(source,/\.insert\(payloads\)/);
assert.doesNotMatch(source,/for\(const x of rows\)\s*\{[\s\S]*?\.insert\(payload\)/,
 'Importer must not reintroduce a per-row database write loop');

console.log('Syllabus CSV import PASS: school/section validation, real board/title, duplicates, quoted/newline CSV, HTTPS, atomic guarded cloud write.');
