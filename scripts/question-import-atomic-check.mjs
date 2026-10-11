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
let rejectBatch=true,returnNoRows=false,delayInsert=null;
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
  insert(rows){
   inserts.push({table,rows});
   return {select:async()=>{
    if(delayInsert)return delayInsert.promise;
    return rejectBatch?{data:null,error:{message:'simulated RLS error'}}:
     {data:returnNoRows?[]:rows.map((q,i)=>({id:'confirmed-'+inserts.length+'-'+i,question_text:q.question_text})),error:null};
   }};
  }
 };
}};
const elements={
 '#pbClass':{value:'Grade 5'},'#pbSubject':{value:'General Science'},'#pbSection':{value:''},
 '#qbImportFile':{files:[],value:''},
 '#qbImportReport':{textContent:''},
 '#qbImportSave':{textContent:'Import Verified Questions',disabled:true,isConnected:true}
};
const doc={readyState:'loading',querySelector:k=>elements[k]||null,querySelectorAll:()=>[],addEventListener(){}};
const listeners=new Map();
const window={EDUNIZAM_CLOUD:{state:{user,client}},EDUNIZAM_CLOUD_CONFIG:cfg,
 addEventListener(name,handler){listeners.set(name,handler)}};
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
// A second teacher/device can insert a question between this preview and
// the import. The write must recheck the complete school bank, not silently
// save a new duplicate from a previously valid local CSV.
existing['school-A'].teacher_question_bank.push({
 id:'other-teacher-question',class_name:'Grade 5',subject:'General Science',
 chapter:'Energy',question_type:'mcq',question_text:'Which form transfers energy?',
 difficulty:'Balanced',options:['Light','Desk','Stone','Chair'],correct_option:0,
 creator_user_id:'other-teacher',active:true
});
await app.saveQuestionImport();
assert.equal(inserts.length,0,'Stale preview inserted another teacher\'s existing question');
assert.match(elements['#qbImportReport'].textContent,/duplicate/i,
 'Stale question duplicate did not explain revalidation');
assert.equal(elements['#qbImportSave'].disabled,true,
 'Duplicate conflict did not disable the old import preview');
existing['school-A'].teacher_question_bank.pop();
await app.previewQuestionImport();
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
// A successful HTTP response with no returned question IDs must not claim
// any saved questions. The teacher must inspect the bank before retrying.
returnNoRows=true;
await app.previewQuestionImport();
await app.saveQuestionImport();
assert.equal(inserts.length,3,'Unconfirmed import should make one write');
assert.match(elements['#qbImportReport'].textContent,/not confirmed/i,
 'No-return question insert falsely showed saved together');
assert.equal(elements['#qbImportSave'].disabled,true,
 'Unconfirmed question insert did not require a fresh review');
returnNoRows=false;
await app.previewQuestionImport();
cfg.institutionId='school-B';user.id='head-B';
await app.saveQuestionImport();
assert.equal(inserts.length,3,'School switch must never allow uploading previous-school reviewed questions');
assert.match(elements['#qbImportReport'].textContent,/school\/account changed/i);
// If logout happens during a pending INSERT, even a later same-user login
// cannot revive the former import's success state or stale Save button.
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
const source=read('teacher-paper-builder.js');
assert.match(source,/pendingImportScope!==importScope/);
assert.match(source,/\.insert\(records\)\.select\('id,question_text'\)/);
assert.doesNotMatch(source,/batchSize=25/);
assert.match(source,/pendingImportRows\.map\(\(q,i\)=>\(\{index:i\+1,gate:schoolQuestionReadiness\(/);
// A stale File.text() response must not re-enable Import after CSV/JSON selection changes.
cfg.institutionId='school-A';user.id='head-A';
await app.loadSchoolCatalog();await app.loadCustomQuestions();
{
 const oldRead=deferred(),oldFile={size:600,name:'old.csv',text:()=>oldRead.promise};
 const currentFile={size:600,name:'reviewed-science.csv',text:async()=>csv};
 elements['#qbImportFile'].files=[oldFile];
 const oldPreview=app.previewQuestionImport();
 await Promise.resolve();await Promise.resolve();
 elements['#qbImportFile'].files=[currentFile];
 app.clearPendingQuestionImport();
 oldRead.resolve(csv);
 await oldPreview;
 assert.equal(elements['#qbImportSave'].disabled,true,'Old file preview activated Import after selection changed');
 const before=inserts.length;
 await app.saveQuestionImport();
 assert.equal(inserts.length,before,'Old selected file uploaded despite review invalidation');
 await app.previewQuestionImport();
 assert.equal(elements['#qbImportSave'].disabled,false,'New file could not be validated after stale preview');
 // Guard direct file replacement even if a change listener is missed.
 elements['#qbImportFile'].files=[oldFile];
 await app.saveQuestionImport();
 assert.equal(inserts.length,before,'Replaced file without a change event was imported');
 assert.match(elements['#qbImportReport'].textContent,/verify.*again|changed/i);
 elements['#qbImportFile'].files=[currentFile];
 await app.previewQuestionImport();
 await app.saveQuestionImport();
 assert.equal(inserts.length,before+1,'Currently reviewed file was not saved');
}

// File identity checks must not block the separate teacher-reviewed source workflow.
elements['#pbChapters']={value:''};
const staged=app.attachSourceQuestions([{class:'5',subject:'Science',chapter:'Energy',
 type:'short',difficulty:'Balanced',question:'What is renewable energy?',
 answer:'Energy supplied by naturally replenished sources.',visibility:'private'}]);
assert.equal(staged.valid,1);
app.prepareSourceSync();
const beforeSource=inserts.length;
await app.saveQuestionImport();
assert.equal(inserts.length,beforeSource+1,'Reviewed-source question sync broke under the file guard');

// A successful INSERT response from a previous same-user login must not show
// a saved message after logout and re-login, even if its school/user IDs match.
elements['#qbImportFile'].files=[{size:600,name:'reviewed-science.csv',text:async()=>csv}];
await app.previewQuestionImport();
delayInsert=deferred();
const waiting=app.saveQuestionImport();
for(let step=0;step<20&&inserts.length===beforeSource+1;step++)await Promise.resolve();
assert.equal(inserts.length,beforeSource+2,'Expected pending school question insert');
const priorUser=window.EDUNIZAM_CLOUD.state.user;
window.EDUNIZAM_CLOUD.state.user=null;
listeners.get('edunizam:auth')?.({detail:{event:'SIGNED_OUT'}});
const afterLogout=elements['#qbImportReport'].textContent;
window.EDUNIZAM_CLOUD.state.user=priorUser;
listeners.get('edunizam:auth')?.({detail:{event:'SIGNED_IN'}});
delayInsert.resolve({data:[
 {id:'after-logout-1',question_text:'Which form transfers energy?'},
 {id:'after-logout-2',question_text:'Give a form of energy.'}
],error:null});
await waiting;
assert.equal(elements['#qbImportReport'].textContent,afterLogout,
 'Late question INSERT displayed success after a same-user session change');
assert.equal(elements['#qbImportSave'].disabled,true,'Stale import reactivated Save');
delayInsert=null;

console.log('Class 5 Science question import PASS: book-mapped atomic confirmation, no-return rejection, session isolation and forced revalidation.');
