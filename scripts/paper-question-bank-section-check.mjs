/* Question Bank is class-wide: a paper wizard selection of Section A must
 * not reject a genuinely book-mapped chapter taught in registered Section B.
 * No real Supabase rows are read or written. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../teacher-paper-builder.js',import.meta.url),'utf8');
const audit=readFileSync(new URL('../paper-syllabus-audit.js',import.meta.url),'utf8');
const saved=[];
const database={
 class_sections:[
  {id:'sA',class_name:'Grade 5',section_name:'A',active:true},
  {id:'sB',class_name:'5',section_name:'B',active:true},
  {id:'sC',class_name:'5',section_name:'C',active:false}
 ],
 syllabus_progress_units:[
  {id:'uA',class_name:'5',section_name:'A',subject:'Science',unit_title:'Heat',textbook_title:'Book',curriculum_board:'Punjab'},
  {id:'uB',class_name:'5',section_name:'B',subject:'Science',unit_title:'Energy, Sound',textbook_title:'Book B',curriculum_board:'Punjab'},
  {id:'uC',class_name:'5',section_name:'C',subject:'Science',unit_title:'Private C',textbook_title:'Book C',curriculum_board:'Punjab'},
  {id:'uD',class_name:'5',section_name:'B',subject:'Science',unit_title:'Bookless',textbook_title:'',curriculum_board:'Punjab'},
  {id:'uE',class_name:'5',section_name:null,subject:'Science',unit_title:'Shared',textbook_title:'Shared Book',curriculum_board:'Punjab'}
 ],
 teacher_question_bank:[]
};
const cfg={institutionId:'school-A'},user={id:'teacher-A'},alerts=[];
const client={from(table){
 let school='';const q={
  select(){return this},eq(k,v){if(k==='institution_id')school=v;return this},
  order(){return this},range(){return this},abortSignal(){return this},
  insert(payload){
   assert.equal(table,'teacher_question_bank');
   assert.equal(payload.institution_id,'school-A');
   saved.push(payload);database.teacher_question_bank.push({...payload,id:'saved-'+saved.length});
   return Promise.resolve({error:null});
  },
  then(resolve,reject){
   if(school!=='school-A')throw Error('Unscoped or wrong-school read');
   return Promise.resolve({data:database[table]||[],error:null}).then(resolve,reject);
  }
 };
 return q;
}};
const els={
 '#pbSection':{value:'A'},
 '#qbClass':{value:'Grade 5'},'#qbSubject':{value:'Science'},
 '#qbChapter':{value:'Energy, Sound'},'#qbType':{value:'short'},
 '#qbDifficulty':{value:'Balanced'},'#qbQuestion':{value:'What is energy?'},
 '#qbAnswer':{value:'The ability to do work.'},'#qbOptions':{value:''},
 '#qbCorrect':{value:'1'},'#qbAdmin':{checked:false}
};
const document={readyState:'loading',querySelector:k=>els[k]||null,
 querySelectorAll:()=>[],addEventListener(){}};
const window={EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_CLOUD:{state:{user,client}}};
const context={window,document,console,localStorage:{getItem:()=>null},
 setTimeout,clearTimeout,AbortController,alert:msg=>alerts.push(String(msg))};
runInNewContext(audit,context);
runInNewContext(source,context);
const api=window.EDUNIZAM_PAPER_BUILDER;
await api.loadSchoolCatalog();
assert.equal(api.schoolPaperReadiness('5','Science',['Energy, Sound']).allowed,false,
 'Paper exam unexpectedly used the wrong section chapter');
assert.equal(api.schoolQuestionReadiness('5','Science',['Energy, Sound']).allowed,true,
 'Valid Section B question rejected by Section A paper form');
assert.equal(api.schoolQuestionReadiness('5','Science',['Private C']).allowed,false,
 'Question chapter for INACTIVE section was accepted');
assert.equal(api.schoolQuestionReadiness('5','Science',['Bookless']).allowed,false,
 'Question chapter with missing textbook mapping was accepted');
assert.equal(api.schoolQuestionReadiness('5','Science',['Unknown']).allowed,false,
 'Invented chapter accepted');
assert.equal(api.schoolQuestionReadiness('5','Science',['Shared']).allowed,true,
 'Shared authentic school chapter was incorrectly rejected');
await api.saveCustomQuestion();
assert.equal(saved.length,1,'Valid Section B reviewed question was not saved');
assert.equal(saved[0].chapter,'Energy, Sound','Punctuation in reviewed question chapter was lost');
assert.equal(alerts.length,0,'Unexpected validation alert: '+alerts.join(' | '));
els['#qbChapter'].value='Private C';
await api.saveCustomQuestion();
assert.equal(saved.length,1,'Inactive section saved an unapproved school question');
assert.match(alerts.at(-1),/book-mapped|active school section/i);
els['#pbSection'].value='B';
assert.equal(api.schoolPaperReadiness('5','Science',['Energy, Sound']).allowed,true,
 'Section B paper should use its own book-mapped unit');
els['#pbSection'].value='A';
assert.equal(api.schoolPaperReadiness('5','Science',['Energy, Sound']).allowed,false,
 'Section A paper gained access to Section B-only chapter');
console.log('Teacher Question Bank section independence PASS: registered active section, real textbook, inactive/bookless rejection and unchanged paper section rules.');
