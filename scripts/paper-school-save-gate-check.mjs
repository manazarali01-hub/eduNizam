/* School paper saves must never elevate generic concept topics into certified
   school chapters. Head/teacher question caches must not cross institutions. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const assert=(yes,message)=>{if(!yes)throw Error(message)};
const cfg={institutionId:'school-A',enabled:true};
const records={
 'school-A':{
  class_sections:[{class_name:'Grade 5',section_name:'A',active:true},{class_name:'Grade 6',section_name:'X',active:false}],
  syllabus_progress_units:[{class_name:'5',subject:'Mathematics',unit_title:'Prescribed Unit: Fractions',textbook_title:'School Maths Book',curriculum_board:'punjab-pectaa'}],
  teacher_question_bank:[{id:'A-Q1',creator_user_id:'head-A',class_name:'5',subject:'Mathematics',
   chapter:'Confidential School A Topic',question_type:'short',question_text:'Private A question?',answer_text:'Private A answer',difficulty:'Balanced',active:true}]
 },
 'school-B':{
  class_sections:[{class_name:'Class 8',section_name:'B',active:true}],
  syllabus_progress_units:[{class_name:'Grade 8',subject:'Physics',unit_title:'School B: Motion',textbook_title:'School Physics Book',curriculum_board:'federal-fbise'}],
  teacher_question_bank:[{id:'B-Q1',creator_user_id:'head-B',class_name:'8',subject:'Physics',
   chapter:'Confidential School B Topic',question_type:'short',question_text:'Private B question?',answer_text:'Private B answer',difficulty:'Balanced',active:true}]
 }
};
const requests=[];let denyUnits=false,deferQuestionA=false,releaseA;
const client={from(table){
 let filters={};
 const q={
  select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(){return this},
  then(resolve,reject){
   requests.push({table,filters:{...filters}});
   if(table==='syllabus_progress_units'&&denyUnits)return Promise.resolve({data:null,error:{message:'Syllabus permission denied'}}).then(resolve,reject);
   if(table==='teacher_question_bank'&&filters.institution_id==='school-A'&&deferQuestionA)
    return new Promise(res=>{releaseA=()=>res({data:records['school-A'][table],error:null})}).then(resolve,reject);
   return Promise.resolve({data:records[filters.institution_id]?.[table]||[],error:null}).then(resolve,reject);
  }
 };
 return q;
}};
const cloud={state:{user:{id:'head-A'},client}};
const window={EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:cfg};
const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}};
const alerts=[];
const elements={
 '#pbSubject':{value:'Mathematics'},'#pbClass':{value:'Grade 5'},'#pbChapters':{value:'Unapproved School Topic'},
 '#pbMarks':{value:'20'},'#pbDifficulty':{value:'Balanced'},'#pbDistribution':{value:'Objective Heavy'},
 '#pbConceptDraft':{checked:false},'#pbTeacherOnly':{checked:false},'#pbAdmin':{checked:true},'#pbTitle':{value:'Test Draft'}
};
document.querySelector=sel=>elements[sel]||null;
const ctx={window,document,localStorage:{getItem:()=>null},console,setTimeout,clearTimeout,AbortController,
 alert:msg=>alerts.push(String(msg)),confirm:()=>true};
runInNewContext(read('paper-syllabus-audit.js'),ctx,{filename:'paper-syllabus-audit.js'});
runInNewContext(read('teacher-paper-builder.js'),ctx,{filename:'teacher-paper-builder.js'});
const api=window.EDUNIZAM_PAPER_BUILDER;
assert(api?.schoolPaperReadiness&&api.loadCustomQuestions&&api.savePaper,'School paper gate / bank-isolation exports missing');
let g=api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions']);
assert(!g.allowed&&g.reason.includes('not verified'),'Unloaded school syllabus allowed paper publication');
await api.loadSchoolCatalog();
g=api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions']);
assert(g.allowed&&g.mode==='school-recorded'&&g.verified===false,'Actual book-mapped school chapter failed guarded draft mode');
const priorTitle=records['school-A'].syllabus_progress_units[0].textbook_title;
delete records['school-A'].syllabus_progress_units[0].textbook_title;
api.getSchoolCatalog().units[0].textbook_title='';
assert(!api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions']).allowed,'Legacy chapter without a prescribed textbook mapping was incorrectly accepted');
records['school-A'].syllabus_progress_units[0].textbook_title=priorTitle;
api.getSchoolCatalog().units[0].textbook_title=priorTitle;
assert(!api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions','Unapproved School Topic']).allowed,
 'School paper mixed prescribed and generic chapters');
assert(!api.schoolPaperReadiness('6','Mathematics',['Prescribed Unit: Fractions'],{conceptDraft:true}).allowed,
 'Inactive/unregistered class allowed school paper');
assert(!api.schoolPaperReadiness('9','Mathematics',['Fractions'],{conceptDraft:true}).allowed,
 'Unknown current school class allowed reference paper');
assert(!api.schoolPaperReadiness('5','English',['Grammar']).allowed,
 'No saved English units allowed ordinary school exam');
g=api.schoolPaperReadiness('5','English',['Grammar'],{conceptDraft:true});
assert(g.allowed&&g.mode==='concept-only-draft'&&!g.verified,
 'Explicitly private concept draft not distinguished from a verified exam');
elements['#pbConceptDraft'].checked=true;
await api.savePaper(); // The class is registered but a DIFFERENT subject has recorded units.
assert(alerts.some(x=>x.includes('not recorded')),'Generate button bypassed saved school chapter guard');
assert(requests.every(q=>!q.filters.institution_id||['school-A','school-B'].includes(q.filters.institution_id)),
 'Invalid school query');
assert(requests.some(q=>q.table==='class_sections'&&q.filters.institution_id==='school-A')&&
 requests.some(q=>q.table==='syllabus_progress_units'&&q.filters.institution_id==='school-A'),
 'Class/syllabus lookup must use current institution');
const source=read('teacher-paper-builder.js');
assert(source.includes("gate.mode==='concept-only-draft'?'private'"),'Reference draft was not forced to private visibility');
assert(source.includes('id="pbConceptDraft"')&&source.includes('curriculumMode=gate.mode'),'Paper preview cannot distinguish verified vs concept status');

await api.loadCustomQuestions();
assert(api.getQuestionScope()==='school-A|head-A','School A teacher bank scope absent');
assert(api.chapterChoices('5','Mathematics').includes('Confidential School A Topic'),'Current school question chapter not loaded');
cfg.institutionId='school-B';cloud.state.user.id='head-B';
assert(!api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions']).allowed,'Previous school syllabus authorized an exam after switch');
assert(!api.chapterChoices('5','Mathematics').includes('Confidential School A Topic'),'Previous school teacher-bank chapter leaked after switch');
await api.loadSchoolCatalog();await api.loadCustomQuestions();
assert(api.schoolPaperReadiness('8','Physics',['School B: Motion']).allowed,'New school unit not loaded');
assert(!api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions']).allowed,'Previous school class survived switching');
assert(api.chapterChoices('8','Physics').includes('Confidential School B Topic'),'New school reviewed-question chapter absent');
assert(!api.chapterChoices('5','Mathematics').includes('Confidential School A Topic'),'Previous institution bank leaked after fetch');

denyUnits=true;cfg.institutionId='school-A';cloud.state.user.id='head-C';
await api.loadSchoolCatalog();
assert(!api.schoolPaperReadiness('5','Mathematics',['Prescribed Unit: Fractions'],{conceptDraft:true}).allowed,
 'Syllabus access failure was treated as empty and unverified exam published');
denyUnits=false;
deferQuestionA=true;
const oldRequest=api.loadCustomQuestions();
cfg.institutionId='school-B';cloud.state.user.id='head-D';
await api.loadCustomQuestions();
assert(typeof releaseA==='function','Deferred previous-school question fetch was not pending');
releaseA();await oldRequest;
assert(api.getQuestionScope()==='school-B|head-D','Late old-school question request overwrote new user cache');
assert(!api.chapterChoices('5','Mathematics').includes('Confidential School A Topic'),'Late old-school query leaked chapter');
console.log('Paper Builder school save gate PASS: registered classes, exact saved units, explicit private reference drafts, failed access and cross-school late-fetch isolation.');
