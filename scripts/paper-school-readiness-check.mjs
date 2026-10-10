import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const el={'#pbClass':{value:'5'},'#pbSubject':{value:'Science'},'#pbSection':{value:'A'},
 '#pbSchoolCatalogStatus':{textContent:''},'#pbSchoolSetupChecklist':{textContent:'',innerHTML:''},
 '#pbSchoolRefresh':{disabled:false,isConnected:true}};
const doc={readyState:'loading',querySelector:k=>el[k]||null,querySelectorAll:()=>[],addEventListener(){}};
let offline=false;
const rows={class_sections:[{class_name:'5',section_name:'A',active:true},{class_name:'5',section_name:'B',active:true}],
 syllabus_progress_units:[
 {class_name:'5',section_name:'A',subject:'Science',unit_title:'Matter',textbook_title:'School Science',curriculum_board:'Punjab'},
 {class_name:'5',section_name:'A',subject:'Science',unit_title:'Plants',textbook_title:'',curriculum_board:'Punjab'},
 {class_name:'5',section_name:'B',subject:'Science',unit_title:'Section B private',textbook_title:'B Book',curriculum_board:'Punjab'}],
 teacher_question_bank:[
 {id:'a',class_name:'5',subject:'Science',chapter:'Matter',question_type:'mcq',active:true,question_text:'What is a solid?',options:['A','B','C','D'],correct_option:0,difficulty:'Balanced'},
 {id:'b',class_name:'5',subject:'Science',chapter:'Matter',question_type:'short',active:true,question_text:'Explain a solid',answer_text:'Definite shape',difficulty:'Balanced'}]};
const cloud={state:{user:{id:'u1'},client:{from(table){return {select(){return this},eq(){return this},order(){return this},limit(){return this},then(ok,bad){return Promise.resolve(offline?{error:{message:'Access denied'}}:{data:rows[table]||[]}).then(ok,bad)}}}}}};
const win={EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-1'},EDUNIZAM_PRACTICE_DATA:{questions:[]}};
const cx={window:win,document:doc,console,localStorage:{getItem:()=>null},AbortController,setTimeout,clearTimeout};
vm.runInNewContext(read('paper-syllabus-audit.js'),cx);
vm.runInNewContext(read('teacher-paper-builder.js'),cx);
const api=win.EDUNIZAM_PAPER_BUILDER;
assert.equal(api.schoolSetupReadiness().verified,false);
await api.loadSchoolCatalog();await api.loadCustomQuestions();
assert.equal(el['#pbSubject'].value,'General Science','Science alias lost when dropdown was rebuilt');
let r=api.schoolSetupReadiness();
assert.equal(r.classes,2);assert.equal(r.units.length,2);assert.equal(r.mapped,1);
assert.equal(r.missing.length,1);assert.equal(r.questions,2);
assert(r.coverage.find(x=>x.chapter==='Matter').types.long.total===0);
assert(!el['#pbSchoolSetupChecklist'].innerHTML.includes('Section B private'));
assert(el['#pbSchoolSetupChecklist'].innerHTML.includes('Action needed'));
rows.class_sections=[];rows.syllabus_progress_units=[];rows.teacher_question_bank=[];
await api.loadSchoolCatalog();await api.loadCustomQuestions();
r=api.schoolSetupReadiness();
assert.equal(r.classes,0);assert.equal(r.units.length,0);assert.equal(r.questions,0);
assert(el['#pbSchoolSetupChecklist'].innerHTML.includes('Register active classes'));
offline=true;await api.loadSchoolCatalog();
assert.equal(api.schoolSetupReadiness().verified,false);
assert(el['#pbSchoolSetupChecklist'].textContent.includes('have not been verified'));
assert(read('teacher-paper-builder.js').includes('pbOpenClassSetup'));
console.log('Paper Builder verified readiness: missing school setup, textbook/board provenance, exact chapter coverage and errors PASS.');
