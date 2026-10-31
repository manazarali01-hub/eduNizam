/* Verify full current-school paging: no silent truncation at 500 questions / 750 syllabus units. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const school='school-A',cfg={institutionId:school},user={id:'teacher-A'};
const rows={
 [school]:{
  class_sections:Array.from({length:305},(_,i)=>({id:'c'+String(i).padStart(5,'0'),class_name:'5',section_name:'S'+i,active:true})),
  syllabus_progress_units:Array.from({length:802},(_,i)=>({id:'u'+String(i).padStart(5,'0'),class_name:'5',section_name:null,
   subject:'Science',unit_title:'Actual School Chapter '+i,textbook_title:'School Submitted Science Book',curriculum_board:'punjab-pectaa'})),
  teacher_question_bank:Array.from({length:615},(_,i)=>({id:'q'+String(i).padStart(5,'0'),class_name:'5',subject:'General Science',
   chapter:'Actual School Chapter '+i,question_type:'short',question_text:'Reviewed question '+i,answer_text:'Teacher answer '+i,
   difficulty:'Balanced',active:true}))
 },
 'school-B':{class_sections:[{id:'b1',class_name:'6',section_name:'A',active:true}],syllabus_progress_units:[],teacher_question_bank:[]}
};
const requestLog=[];let denySecondSyllabusPage=false,denySecondQuestionPage=false;
const client={from(table){
 const filters={};
 const q={
  select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(){return this},
  range(from,to){this.fromIndex=from;this.toIndex=to;return this},abortSignal(){return this},
  then(resolve,reject){
   const start=this.fromIndex??0,end=this.toIndex??249;
   requestLog.push({table,school:filters.institution_id,start,end});
   if((table==='syllabus_progress_units'&&denySecondSyllabusPage&&start===250)||
      (table==='teacher_question_bank'&&denySecondQuestionPage&&start===250))
    return Promise.resolve({error:{message:'Simulated current-school permission error'}}).then(resolve,reject);
   const items=(rows[filters.institution_id]?.[table]||[]).slice(start,end+1);
   return Promise.resolve({data:items,error:null}).then(resolve,reject);
  }
 };return q;
}};
const window={EDUNIZAM_CLOUD:{state:{user,client}},EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_PRACTICE_DATA:{questions:[]}};
const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}};
const context={window,document,localStorage:{getItem:()=>null},console,AbortController,setTimeout,clearTimeout,Promise};
runInNewContext(read('paper-syllabus-audit.js'),context,{filename:'paper-syllabus-audit.js'});
runInNewContext(read('teacher-paper-builder.js'),context,{filename:'teacher-paper-builder.js'});
const api=window.EDUNIZAM_PAPER_BUILDER;
assert.equal(typeof api.fetchPagedSchoolRows,'function');
await api.loadSchoolCatalog();await api.loadCustomQuestions();
assert.equal(api.getSchoolCatalog().classes.length,305,'Class records unexpectedly capped at 250');
assert.equal(api.getSchoolCatalog().units.length,802,'Syllabus chapters unexpectedly capped at 750');
assert.equal(api.getQuestionScope(),'school-A|teacher-A');
assert.equal(api.schoolSetupReadiness('5','Science').questions,615,'Question Bank unexpectedly capped at 500');
assert(api.schoolChapters('Grade 5','General Science').includes('Actual School Chapter 801'),'Later saved chapter missing from Paper Builder');
assert(requestLog.some(x=>x.table==='teacher_question_bank'&&x.start===500),'Question Bank third page not requested');
assert(requestLog.some(x=>x.table==='syllabus_progress_units'&&x.start===750),'Syllabus fourth page not requested');
assert(requestLog.every(x=>x.school===school),'Cross-institution query issued');
denySecondSyllabusPage=true;
await api.loadSchoolCatalog();
assert.equal(api.getSchoolCatalog().unitState,'error','Second-page failure must not be treated as complete');
assert.equal(api.getSchoolCatalog().units.length,0,'Partial syllabus records must not be used for papers');
assert.equal(api.schoolPaperReadiness('5','Science',['Actual School Chapter 0']).allowed,false,'Incomplete syllabus allowed a school exam');
denySecondSyllabusPage=false;
denySecondQuestionPage=true;
await api.loadCustomQuestions();
assert.notEqual(api.getQuestionScope(),'school-A|teacher-A','Partial question bank must not be marked verified');
denySecondQuestionPage=false;
const tiny=Array.from({length:501},(_,i)=>({id:'t'+i}));
const bigClient={from:()=>({select(){return this},eq(){return this},order(){return this},
 range(from,to){this.from=from;this.to=to;return this},
 then(resolve,reject){return Promise.resolve({data:tiny.slice(this.from,this.to+1)}).then(resolve,reject)}})};
await assert.rejects(()=>api.fetchPagedSchoolRows(bigClient,'teacher_question_bank','*',school,{pageSize:250,maxRows:500}),/more than 500/);
cfg.institutionId='school-B';user.id='teacher-B';
await api.loadSchoolCatalog();await api.loadCustomQuestions();
assert.equal(api.getSchoolCatalog().classes.length,1);
assert.equal(api.getSchoolCatalog().units.length,0);
assert.equal(api.schoolSetupReadiness('5','Science').questions,0);
assert.equal(api.getQuestionScope(),'school-B|teacher-B');
console.log('Paper Builder pagination PASS: 305 class rows, 802 syllabus chapters, 615 reviewed questions, later pages, permission fail-closed and school isolation.');
