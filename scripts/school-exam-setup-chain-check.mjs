/* Cross-feature Academic Groups -> real syllabus CSV -> reviewed teacher-bank CSV
 * -> exactly scoped paper preview/save. Entire database is synthetic and
 * in-memory, never Supabase or production school records. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const win={},doc={getElementById:()=>null,readyState:'loading',addEventListener(){}};
const ctx={window:win,document:doc,console,Promise,TextEncoder,setTimeout,clearTimeout,
 localStorage:{getItem:()=>JSON.stringify({role:'head'})}};
for(const script of ['academic-form-options.js','academic-groups-csv.js',
 'school-syllabus-csv.js','teacher-question-import.js'])
 runInNewContext(read(script),ctx,{filename:script});
const a=win.EDUNIZAM_ACADEMIC_GROUPS_CSV,s=win.EDUNIZAM_SYLLABUS_CSV;
const importQuestions=win.EDUNIZAM_QUESTION_IMPORT;
// Stage 1: Head enters genuine class/section names, without default student
// or textbook records. The fixture names are examples, not production data.
const classCsv='className,sectionName,roomLabel,capacity\nGrade 5,A,Room A,35\n5,B,Room B,38\n';
const classReview=a.validate(classCsv,[]);
assert.equal(classReview.errors.length,0);
assert.equal(classReview.valid.length,2);
const classes=classReview.valid.map((r,i)=>({
 id:'class-'+i,class_name:r.className,section_name:r.sectionName,active:true
}));
const registered=classes.map(r=>({className:r.class_name,sectionName:r.section_name}));
// Stage 2: The NEW registered-class worksheet contains only known class and
// section identities. Teacher fills actual textbook and exact chapter labels.
const blank=s.registeredClassWorksheet(registered);
const blankRows=s.csv(blank);
assert.equal(blankRows.length,3);
assert(blankRows.slice(1).every(r=>r.slice(2).every(v=>v==='')),
 'Worksheet introduced a fabricated subject, chapter, book or edition');
const rows=blankRows.slice(1).map((r,i)=>{
 const vals=[...r];
 vals[2]='General Science';
 vals[3]=i===0?'Energy, Light':'Plant Parts';
 vals[4]='School Book (fixture)';vals[5]='punjab-pectaa';vals[6]='2026';
 return vals;
});
const qCsv=values=>values.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',');
const syllabusCsv=s.fields.join(',')+'\n'+rows.map(qCsv).join('\n')+'\n';
const review=s.validate(syllabusCsv,registered,[]);
assert.equal(review.errors.length,0);
assert.equal(review.valid.length,2);
const units=review.valid.map((r,i)=>({
 id:'unit-'+i,class_name:r.className,section_name:r.sectionName,
 subject:r.subject,unit_title:r.unitTitle,textbook_title:r.textbookTitle,
 curriculum_board:r.curriculumBoard,status:'Planned'
}));
const chapterA='Energy, Light',chapterB='Plant Parts';
// Stage 3: Teacher completes a chapter-matched question import with actual
// answers in the fixture. A comma in the chapter name must survive import.
const header='class,subject,chapter,type,difficulty,question,option1,option2,option3,option4,correct_option,answer,visibility';
const qRows=['mcq','short','long'].flatMap(type=>Array.from({length:9},(_,i)=>
 ['5','Science',chapterA,type,'Balanced',type+' reviewed item '+i,
  ...(type==='mcq'?['First','Second','Third','Fourth']:['','','','']),
  type==='mcq'?'1':'',type==='mcq'?'First':'Reviewed answer key '+i,'private']));
const prepared=importQuestions.prepare(header+'\n'+qRows.map(qCsv).join('\n')+'\n','teacher.csv',[]);
assert.equal(prepared.errors.length,0,prepared.errors.join('; '));
assert.equal(prepared.valid.length,27);
assert(prepared.valid.every(q=>q.chapter===chapterA),'Comma in textbook chapter was lost');
const questions=prepared.valid.map((r,i)=>({...r,id:'question-'+i,creator_user_id:'head-A'}));
const tables={class_sections:classes,syllabus_progress_units:units,
 teacher_question_bank:questions,teacher_papers:[]};
const client={from(table){
 assert(table in tables,'Unexpected DB table '+table);
 let start=0,end=249,school=null;
 const query={
  select(){return this},eq(k,v){if(k==='institution_id')school=v;return this},
  order(){return this},range(a,b){start=a;end=b;return this},
  insert(payload){
   assert.equal(table,'teacher_papers');
   assert.equal(payload.institution_id,'school-A');
   const row={id:'paper-1',...payload,created_at:'2026-10-11T00:00:00Z'};
   tables.teacher_papers.push(row);
   return{select(){return this},single:async()=>({data:row,error:null})};
  },
  then(resolve,reject){
   assert.equal(school,'school-A','School records queried without institution scope');
   return Promise.resolve({data:tables[table].slice(start,end+1),error:null}).then(resolve,reject);
  }
 };
 return query;
}};
const elements=new Map();
function element(id,props={}){
 if(elements.has(id))return elements.get(id);
 let html='';
 const value={value:'',textContent:'',checked:false,disabled:false,dataset:{},
  classList:{add(){},remove(){},toggle(){}},isConnected:true,onclick:null,
  addEventListener(){},querySelectorAll(){return[]},scrollIntoView(){},
  insertAdjacentHTML(_where,fragment){
   for(const match of String(fragment).matchAll(/id="([^"]+)"/g))element('#'+match[1]);
  }};
 Object.defineProperty(value,'innerHTML',{get(){return html},set(v){
  html=String(v);
  for(const match of html.matchAll(/id="([^"]+)"/g))element('#'+match[1]);
 }});
 Object.assign(value,props);elements.set(id,value);return value;
}
for(const [id,value] of Object.entries({
 '#pbClass':'Grade 5','#pbSection':'A','#pbSubject':'General Science',
 '#pbChapters':'','#pbMarks':'20','#pbDifficulty':'Balanced',
 '#pbDistribution':'Balanced','#pbTitle':'Verified test paper',
 '#pbBookBoard':'punjab-pectaa'
}))element(id,{value});
element('#pbTeacherOnly',{checked:true});element('#pbConceptDraft',{checked:false});
element('#pbAdmin',{checked:false});
for(const id of ['#pbSelectedChapters','#pbChapterPicker','#paperPreview',
 '#pbGenerationStatus','#pbSchoolCatalogStatus','#savedTeacherPapers',
 '#pbSavedCount','#pbSavedSearch','#pbSavedClass','#pbClasses',
 '#pbSubjects','#pbTeacherChapters'])element(id);
const document={readyState:'loading',querySelector:selector=>elements.get(selector)||null,
 querySelectorAll:()=>[],addEventListener(){}};
const cfg={institutionId:'school-A',enabled:true},user={id:'head-A'};
const listeners=new Map(),errors=[];
const appWin={EDUNIZAM_CLOUD:{state:{client,user}},EDUNIZAM_CLOUD_CONFIG:cfg,
 EDUNIZAM_PREMIUM:{toast(){}},
 addEventListener:(event,fn)=>listeners.set(event,[...(listeners.get(event)||[]),fn])};
const context={window:appWin,document,console,Promise,setTimeout,clearTimeout,
 AbortController,alert:v=>errors.push(String(v)),
 localStorage:{getItem:key=>key==='edunizam_session'?JSON.stringify({role:'head'}):null}};
for(const script of ['paper-syllabus-audit.js','teacher-paper-builder.js'])
 runInNewContext(read(script),context,{filename:script});
const paper=appWin.EDUNIZAM_PAPER_BUILDER;
await paper.loadSchoolCatalog();
await paper.loadCustomQuestions();
assert.equal(paper.getSchoolCatalog().classes.length,2);
assert(paper.schoolChapters('5','Science').includes(chapterA));
paper.writeSelectedChapters([chapterA]);
const gate=paper.schoolPaperReadiness('5','Science',[chapterA]);
assert.equal(gate.allowed,true,'Reviewed section A syllabus not accepted');
assert.equal(gate.mode,'school-recorded');
assert.equal(paper.schoolPaperReadiness('5','Science',[chapterB]).allowed,false,
 'Section A paper accessed section B-only syllabus');
const coverage=appWin.EDUNIZAM_PAPER_SYLLABUS_AUDIT.audit({
 className:'5',subject:'General Science',chapters:[chapterA],
 teacherQuestions:questions,practiceQuestions:[],teacherOnly:true
});
for(const type of ['mcq','short','long'])
 assert.equal(coverage.totals[type],9,'Missing imported '+type+' coverage');
const preview=paper.previewPaper();
assert.equal(preview.ready,true,'Reviewed class/subject/chapter questions could not generate a paper: '+(preview.reason||errors.join('; ')));
await paper.savePaper();
assert.equal(tables.teacher_papers.length,1,'Full setup chain did not save one paper');
assert.equal(tables.teacher_papers[0].paper_json.curriculumMode,'school-recorded');
assert.equal(tables.teacher_papers[0].institution_id,'school-A');
assert.equal(tables.teacher_papers[0].paper_json.sectionName,'A');
assert(!errors.length,'Unexpected workflow error: '+errors.join('; '));
// Changing the Paper Wizard's section does not turn B-only textbook chapters
// into recorded chapters for section A.
element('#pbSection').value='B';
assert.equal(paper.schoolPaperReadiness('5','Science',[chapterA]).allowed,false);
assert.equal(paper.schoolPaperReadiness('5','Science',[chapterB]).allowed,true);
console.log('Full school exam setup PASS: Academic Groups -> class-scoped blank syllabus CSV -> reviewed question CSV -> verified 20-mark preview/save, with section isolation.');
