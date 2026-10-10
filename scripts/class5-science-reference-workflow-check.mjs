/* PEF 2025-26 reference -> Head-reviewed school syllabus -> blank question worksheet.
 * Does not save historic reference chapters as current verified school data. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const refWindow={};
runInNewContext(read('school-syllabus-csv.js'),{window:refWindow,document:{getElementById:()=>null},
 localStorage:{getItem:()=>null},setTimeout:()=>0,console});
const imp=refWindow.EDUNIZAM_SYLLABUS_CSV;
const ref=imp.class5ScienceReference;
assert.equal(ref.session,'2025-26');
assert.equal(ref.chapters.length,9,'Historic primary source reference must contain all nine chapter headings');
assert(ref.source.startsWith('https://www.pef.edu.pk/'));
assert(ref.currentBooks.startsWith('https://pectaa.edu.pk/'));
assert(new Set([...ref.chapters]).size===9,'Reference chapters must be unique');
assert(ref.chapters.includes('Classification of Living Organisms'));
assert(ref.chapters.includes('Space and Satellites'));
const draft=imp.class5ScienceReviewCsv();
const rows=imp.csv(draft);
assert.equal(rows.length,10,'One header and nine chapter references required');
assert(rows.slice(1).every(x=>x[0]==='5'&&x[2]==='General Science'&&x[4]===''&&x[5]===''&&x[6]===''&&x[7]===''),
 'Historic source must NOT pre-fill an unverified current textbook, authority, edition or URL');
const classes=[{className:'Grade 5',sectionName:'A'}];
let validation=imp.validate(draft,classes,[]);
assert.equal(validation.valid.length,0,'Unreviewed historic chapter references should never be ready to insert');
assert.equal(validation.errors.length,9,'All nine rows require current-school book confirmation');
const reviewed=rows.map((r,i)=>i===0?r:r.map((value,n)=>n===4?'Teacher-confirmed actual science book':n===5?'punjab-pectaa':value).join(',')).join('\n');
validation=imp.validate(reviewed,classes,[]);
assert.equal(validation.errors.length,0,'School-verified book/board and real registered class should validate');
assert.equal(validation.valid.length,9);
assert.equal(imp.validate(reviewed,[],[]).valid.length,0,'Unregistered school classes must never pass');
assert.equal(imp.validate(reviewed,classes,[validation.valid[0]]).errors.length,1,'Already saved chapters must not import twice');

const config={institutionId:'school-A',enabled:true},user={id:'head-A'};
const db={
 'school-A':{
  class_sections:[{id:'c1',class_name:'Grade 5',section_name:'A',active:true}],
  syllabus_progress_units:ref.chapters.map((ch,i)=>({id:'u'+i,class_name:'Grade 5',section_name:null,
   subject:'General Science',unit_title:ch,textbook_title:'Teacher-confirmed actual science book',
   curriculum_board:'punjab-pectaa',status:'Planned'})),
  teacher_question_bank:[]
 },
 'school-B':{class_sections:[{id:'c2',class_name:'Grade 7',section_name:'B',active:true}],
  syllabus_progress_units:[],teacher_question_bank:[]}
};
const client={from(table){
 const filters={};
 return {select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(){return this},
  range(first,last){this.first=first;this.last=last;return this},abortSignal(){return this},
  then(resolve,reject){
   const values=db[filters.institution_id]?.[table]||[];
   return Promise.resolve({data:values.slice(this.first??0,(this.last??249)+1),error:null}).then(resolve,reject);
  }};
}};
const el={
 '#pbClass':{value:'Grade 5'},'#pbSubject':{value:'Science'},
 '#pbSection':{value:''},'#pbChapters':{value:''},
 '#qbImportReport':{textContent:''}
};
const document={readyState:'loading',addEventListener(){},querySelector:x=>el[x]||null,querySelectorAll:()=>[]};
const context={window:{EDUNIZAM_CLOUD:{state:{user,client}},EDUNIZAM_CLOUD_CONFIG:config},
 document,localStorage:{getItem:k=>k==='edunizam_session'?JSON.stringify({role:'head'}):null},
 console,AbortController,setTimeout,clearTimeout};
runInNewContext(read('paper-syllabus-audit.js'),context);
runInNewContext(read('teacher-question-import.js'),context);
runInNewContext(read('teacher-paper-builder.js'),context);
const builder=context.window.EDUNIZAM_PAPER_BUILDER;
assert.throws(()=>builder.schoolQuestionWorksheet(),/Refresh the current school/,'School data must be loaded first');
await builder.loadSchoolCatalog();
const worksheet=builder.schoolQuestionWorksheet();
const parsed=context.window.EDUNIZAM_QUESTION_IMPORT.csv(worksheet);
assert.equal(parsed.length,27,'Nine book-mapped chapters x 3 teacher-authored types');
assert.equal(new Set(parsed.map(x=>x.chapter)).size,9);
assert(parsed.every(q=>!q.question&&!q.answer&&q.visibility==='private'),
 'Question template must not fabricate ready-to-publish answers');
assert.deepEqual([...new Set(parsed.map(x=>x.type))],['mcq','short','long']);
const unedited=context.window.EDUNIZAM_QUESTION_IMPORT.prepare(worksheet,'teacher-reviewed.csv');
assert.equal(unedited.valid.length,0,'Blank teacher worksheets must not be valid importable questions');
assert.equal(unedited.errors.length,27);
const actualQuestion=[{class:'5',subject:'Science',chapter:ref.chapters[0],type:'short',
 difficulty:'Balanced',question:'Teacher supplied original question',answer:'Teacher reviewed actual answer',visibility:'private'}];
const ready=context.window.EDUNIZAM_QUESTION_IMPORT.prepare(JSON.stringify(actualQuestion),'questions.json');
assert.equal(ready.valid.length,1,'Teacher-authored completed question should be accepted by input validator');
el['#pbChapters'].value=ref.chapters[0];
assert.equal(context.window.EDUNIZAM_QUESTION_IMPORT.csv(builder.schoolQuestionWorksheet()).length,3,
 'Selecting one recorded chapter should generate only its three blank question rows');
el['#pbChapters'].value='Invented chapter';
assert.throws(()=>builder.schoolQuestionWorksheet(),/not recorded/,'Unrecorded chapter must not appear as verified school worksheet');
el['#pbChapters'].value='';
config.institutionId='school-B';user.id='head-B';
assert.throws(()=>builder.schoolQuestionWorksheet(),/Refresh the current school/,'Old-school syllabus cannot be exported to another school');
await builder.loadSchoolCatalog();
assert.throws(()=>builder.schoolQuestionWorksheet(),/not active|No school-recorded|Configure Academic Groups|registered/i,
 'A school without the registered class must not export prior-school textbook chapters');
assert.match(read('school-syllabus-csv.js'),/2025–26 only/);
console.log('Class 5 Science reference workflow PASS: nine PEF-sourced headings, 2026–27 textbook approval required, 27 blank bank questions, strict paper mapping, teacher review and school isolation.');
