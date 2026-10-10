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
console.log('Syllabus CSV import PASS: school/section validation, real board/title, duplicates, quoted/newline CSV, HTTPS, guarded cloud write.');
