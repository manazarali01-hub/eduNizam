/* Class 5 Science question import: one atomic save, reviewed book mapping, school isolation. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cfg={institutionId:'school-A',enabled:true},user={id:'head-A'};
const existing={
 'school-A':{
  class_sections:[{class_name:'Grade 5',section_name:'A',active:true}],
  syllabus_progress_units:[{class_name:'5',section_name:null,subject:'General Science',unit_title:'Energy',
   textbook_title:'Actual School Science Textbook',curriculum_board:'punjab-pectaa',status:'Planned'}],
  teacher_question_bank:[]
 }
};
let rejectBatch=true;
const inserts=[];
const client={from(table){
 let filters={};
 return {
  select(){return this},eq(name,value){filters[name]=value;return this},
  order(){return this},limit(){return this},abortSignal(){return this},
  then(resolve,reject){
   const data=existing[filters.institution_id]?.[table]||[];
   return Promise.resolve({data,error:null}).then(resolve,reject);
  },
  async insert(rows){inserts.push({table,rows});return {error:rejectBatch?{message:'simulated RLS error'}:null}}
 };
}};
const elements={
 '#pbClass':{value:'Grade 5'},'#pbSubject':{value:'General Science'},'#pbSection':{value:''},
 '#qbImportFile':{files:[],value:''},
 '#qbImportReport':{textContent:''},
 '#qbImportSave':{textContent:'Import Verified Questions',disabled:true,isConnected:true}
};
const doc={readyState:'loading',querySelector:k=>elements[k]||null,querySelectorAll:()=>[],addEventListener(){}};
const window={EDUNIZAM_CLOUD:{state:{user,client}},EDUNIZAM_CLOUD_CONFIG:cfg};
const context={window,document:doc,localStorage:{getItem:()=>JSON.stringify({role:'head'})},
 console,TextEncoder,Promise,setTimeout,clearTimeout,AbortController,confirm:()=>true,alert:()=>{}};
runInNewContext(read('paper-syllabus-audit.js'),context,{filename:'paper-syllabus-audit.js'});
runInNewContext(read('teacher-question-import.js'),context,{filename:'teacher-question-import.js'});
runInNewContext(read('teacher-paper-builder.js'),context,{filename:'teacher-paper-builder.js'});
const aliasImport=window.EDUNIZAM_QUESTION_IMPORT;
const aliasRows=[
 {class:'5',subject:'Science',chapter:'Energy',type:'short',difficulty:'Balanced',
  question:'Name one renewable source.',answer:'Sunlight.'},
 {class:'Grade 5',subject:'General Science',chapter:'Energy',type:'short',difficulty:'Balanced',
  question:'Name one renewable source.',answer:'Sunlight.'}
];
const aliasCheck=aliasImport.prepare(JSON.stringify(aliasRows),'reviewed.json');
assert.equal(aliasCheck.valid.length,1,'Grade 5 Science alias import inserted a duplicate');
assert.equal(aliasCheck.duplicates,1,'A duplicate class/subject alias should be counted');
const existingAlias=aliasImport.prepare(JSON.stringify([aliasRows[0]]),'reviewed.json',
 [{class_name:'Class 5',subject:'General Science',chapter:'Energy',question_type:'short',question_text:'Name one renewable source.'}]);
assert.equal(existingAlias.valid.length,0,'Saved Grade 5 Science alias was duplicated on reimport');
assert.equal(existingAlias.duplicates,1);
const distinctScience=aliasImport.prepare(JSON.stringify([aliasRows[0],{...aliasRows[0],subject:'Physics'}]),'reviewed.json');
assert.equal(distinctScience.valid.length,2,'Unrelated science subjects must not be merged');
const app=window.EDUNIZAM_PAPER_BUILDER;
assert.ok(app.previewQuestionImport&&app.saveQuestionImport,'Question import controls unavailable');
const csv='class,subject,chapter,type,difficulty,question,option1,option2,option3,option4,correct_option,answer,visibility\n'+
 '5,Science,Energy,mcq,Balanced,Which form transfers energy?,Light,Desk,Stone,Chair,1,Light transfers energy.,private\n'+
 '5,General Science,Energy,short,Balanced,Give a form of energy.,,,,,,Light is one example.,private\n';
elements['#qbImportFile'].files=[{size:600,name:'reviewed-science.csv',text:async()=>csv}];
await app.loadSchoolCatalog();await app.loadCustomQuestions();
await app.previewQuestionImport();
assert.equal(elements['#qbImportSave'].disabled,false,'Valid reviewed questions did not enable save');
await app.saveQuestionImport();
assert.equal(inserts.length,1,'Rejected import must use a single database operation');
assert.equal(inserts[0].rows.length,2,'Rejected batch must contain both questions');
assert.equal(inserts[0].table,'teacher_question_bank');
assert.equal(inserts[0].rows[0].institution_id,'school-A');
assert.equal(inserts[0].rows[0].creator_user_id,'head-A');
assert.match(elements['#qbImportReport'].textContent,/not confirmed/i);
assert.equal(elements['#qbImportSave'].disabled,true,'Uncertain failed import must require re-preview');
rejectBatch=false;
await app.previewQuestionImport();
await app.saveQuestionImport();
assert.equal(inserts.length,2,'Successful import must use a single second write');
assert.equal(inserts[1].rows.length,2);
assert.match(elements['#qbImportReport'].textContent,/saved together/i);
await app.previewQuestionImport();
cfg.institutionId='school-B';user.id='head-B';
await app.saveQuestionImport();
assert.equal(inserts.length,2,'School switch must never allow uploading previous-school reviewed questions');
assert.match(elements['#qbImportReport'].textContent,/school\/account changed/i);
const source=read('teacher-paper-builder.js');
assert.match(source,/pendingImportScope!==importScope/);
assert.match(source,/\.insert\(records\)/);
assert.doesNotMatch(source,/batchSize=25/);
assert.match(source,/pendingImportRows\.map\(\(q,i\)=>\(\{index:i\+1,gate:schoolPaperReadiness\(/);
console.log('Class 5 Science question import PASS: textbook gate, atomic rejection/save, session isolation and forced revalidation.');
