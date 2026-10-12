import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const el={'#pbClass':{value:'5'},'#pbSubject':{value:'Science'},'#pbSection':{value:'A'},
 '#pbSchoolCatalogStatus':{textContent:''},'#pbSchoolSetupChecklist':{textContent:'',innerHTML:''},
 '#pbSchoolRefresh':{disabled:false,isConnected:true},'#pbChapters':{value:'Matter'},
 '#pbMarks':{value:'50'},'#pbDifficulty':{value:'Balanced'},'#pbDistribution':{value:'Balanced'}};
const setupActionNodes={};let readinessHtml='';
Object.defineProperty(el['#pbSchoolSetupChecklist'],'innerHTML',{
 get(){return readinessHtml},
 set(value){
  readinessHtml=String(value);
  for(const key of Object.keys(setupActionNodes))delete setupActionNodes[key];
  for(const match of readinessHtml.matchAll(/id="(pbReadinessClasses|pbReadinessSyllabus)"/g))
   setupActionNodes['#'+match[1]]={onclick:null,disabled:false};
 }
});
const nativeNavNodes={
 '.nav-item[data-view="classcenter"]':{click(){navCalls.push('classcenter')}},
 '.nav-item[data-view="lessoncenter"]':{click(){navCalls.push('lessoncenter')}}
};
const doc={readyState:'loading',querySelector:k=>el[k]||setupActionNodes[k]||nativeNavNodes[k]||null,querySelectorAll:()=>[],addEventListener(){}};
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
const navCalls=[];
const win={EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-1'},EDUNIZAM_PRACTICE_DATA:{questions:[]}};
const cx={window:win,document:doc,console,localStorage:{getItem:key=>key==='edunizam_session'?JSON.stringify({role:'teacher'}):null},AbortController,setTimeout,clearTimeout};
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
// This class/section already has a usable MCQ and a short answer question.
// Only the missing LONG question type should appear in the blank review CSV.
const missingCsv=api.schoolQuestionWorksheet({missingOnly:true});
assert(missingCsv.startsWith('\uFEFFclass,subject,chapter,type,difficulty,question'), 'Incorrect reviewed-question CSV headers');
const dataRows=missingCsv.trim().split(/\r?\n/).slice(1);
assert.equal(dataRows.length,1,'Missing question worksheet repeated existing MCQ/short questions');
assert.match(dataRows[0],/"Matter","long"/);
assert.doesNotMatch(missingCsv,/Section B private|What is a solid\?|Explain a solid/,
 'Worksheet disclosed another section or invented prior questions');

// The separate quantity worksheet must fill the real exam-building count,
// not simply one question of each type. No answers or student data are forged.
const gaps=api.schoolPaperQuestionWorksheet();
assert.equal(gaps.trim().split(/\r?\n/).length-1,12,
 '50 Balanced marks need 7 MCQ, 3 short, 2 long additional real questions');
for(const [type,count] of [['mcq',7],['short',3],['long',2]]){
 assert.equal(gaps.split(/\r?\n/).filter(x=>x.includes('"'+type+'"')).length,count,
  'Paper marks gap worksheet miscounted '+type);
}
assert(!gaps.includes('What is a solid?')&&!gaps.includes('Section B private'),
 'Quantity worksheet leaked a question or chapter from another section');
rows.teacher_question_bank.push({...rows.teacher_question_bank[0],id:'duplicate-stem'});
await api.loadCustomQuestions();
assert.equal(api.schoolPaperQuestionWorksheet().trim().split(/\r?\n/).length-1,12,
 'Duplicate question wrongly counted as additional unique question');
rows.teacher_question_bank.pop();
await api.loadCustomQuestions();
el['#pbDistribution'].value='Objective Heavy';
assert.equal(api.schoolPaperQuestionWorksheet().trim().split(/\r?\n/).length-1,16,
 'Objective Heavy 50-mark minimum is not calculated correctly');
el['#pbDistribution'].value='Subjective Heavy';
assert.equal(api.schoolPaperQuestionWorksheet().trim().split(/\r?\n/).length-1,9,
 'Subjective Heavy 50-mark minimum is not calculated correctly');
el['#pbMarks'].value='9';
assert.throws(()=>api.schoolPaperQuestionWorksheet(),/whole-number/);
el['#pbMarks'].value='50';
el['#pbDistribution'].value='Balanced';
assert(read('teacher-paper-builder.js').includes('id="qbRequiredQuestionsWorksheet"'),
 'Marks-based worksheet download button is missing');

const blank=api.schoolQuestionWorksheet();
assert.equal(blank.trim().split(/\r?\n/).length,4,
 'Full blank school worksheet no longer includes all three question types');
assert(!el['#pbSchoolSetupChecklist'].innerHTML.includes('Section B private'));
assert(el['#pbSchoolSetupChecklist'].innerHTML.includes('Action needed'));
rows.class_sections=[];rows.syllabus_progress_units=[];rows.teacher_question_bank=[];
await api.loadSchoolCatalog();await api.loadCustomQuestions();
r=api.schoolSetupReadiness();
assert.equal(r.classes,0);assert.equal(r.units.length,0);assert.equal(r.questions,0);
assert(el['#pbSchoolSetupChecklist'].innerHTML.includes('Register active classes'));
assert(setupActionNodes['#pbReadinessClasses'],'Readiness checklist lacks a direct Academic Groups action');
assert(setupActionNodes['#pbReadinessSyllabus'],'Readiness checklist lacks a direct Lesson/Syllabus action');
setupActionNodes['#pbReadinessClasses'].onclick();
setupActionNodes['#pbReadinessSyllabus'].onclick();
assert.deepEqual(navCalls,['classcenter','lessoncenter'],'Readiness actions did not open the correct setup views');
offline=true;await api.loadSchoolCatalog();
assert.equal(api.schoolSetupReadiness().verified,false);
assert(el['#pbSchoolSetupChecklist'].textContent.includes('have not been verified'));
assert(read('teacher-paper-builder.js').includes('pbOpenClassSetup'));
assert(read('teacher-paper-builder.js').includes('.nav-item[data-view="classcenter"]') &&
 read('teacher-paper-builder.js').includes('.nav-item[data-view="lessoncenter"]'),
 'Readiness actions must use native app navigation instead of a nonexistent global API');
console.log('Paper Builder verified readiness: missing school setup, textbook/board provenance, exact chapter coverage and errors PASS.');
