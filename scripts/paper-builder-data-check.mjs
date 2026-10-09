/* Paper Builder release gate: do not fabricate exam items or corrupt mark totals.
 * This is a code-level test, not an academic endorsement of curriculum questions. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TextEncoder} from 'node:util';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const files=[
 'past-papers-data.js','practice-data.js','study-data.js',
 'learning-premium-data.js','learning-complete-data.js','learning-required-data.js',
 'practice-foundation-data.js','practice-curriculum-expansion.js','practice-depth-data.js',
 'practice-complete-data.js','practice-session-core.js'
];
const window={},document={readyState:'loading',addEventListener(){}};
const context={window,document,console,TextEncoder,localStorage:{getItem:()=>null}};
for(const file of files)runInNewContext(read(file),context,{filename:file,timeout:7000});
runInNewContext(read('paper-syllabus-audit.js'),context,{filename:'paper-syllabus-audit.js',timeout:7000});
runInNewContext(read('teacher-question-import.js'),context,{filename:'teacher-question-import.js',timeout:7000});
runInNewContext(read('teacher-paper-builder.js'),context,{filename:'teacher-paper-builder.js',timeout:7000});
const build=window.EDUNIZAM_PAPER_BUILDER?.build;
if(typeof build!=='function')throw new Error('Paper Builder build API is not available');
const pass=(ok,message)=>{if(!ok)throw new Error(message)};
const topics=window.EDUNIZAM_PRACTICE_DATA.chapters['1|Mathematics'];
pass(topics.length>=4,'Grade 1 Mathematics test chapters missing');
let checked=0;
for(const [total,selected,mode] of [
 [20,topics.slice(0,2),'Objective Heavy'],
 [50,topics.slice(0,3),'Balanced'],
 [100,topics.slice(0,4),'Subjective Heavy']]){
 const result=build('Mathematics',selected,total,'Balanced',mode,'1');
 pass(result.totalMarks===total,'Total marks mismatch for '+total);
 pass(result.sourceStats.templateFallback===0,'Template/fabricated questions found for '+total);
 pass(result.sections.length===3,'Paper sections missing for '+total);
 pass(result.sections.reduce((sum,x)=>sum+x.marks,0)===total,'Section marks do not total '+total);
 for(const section of result.sections){
  pass(section.questions.length>=1,'Empty exam section: '+section.title);
  pass(section.questions.reduce((sum,q)=>sum+q.marks,0)===section.marks,'Question marks mismatch: '+section.title);
  pass(section.questions.every(q=>q.source==='practice-bank'||q.source==='teacher-bank'),'Paper uses an unsupported question source');
  pass(section.questions.every(q=>q.text&&q.answer&&Number(q.marks)>0),'Paper item incomplete');
 }
 checked++;
}
for(const [subject,selected,total,mode,grade] of [
 ['Mathematics',topics.slice(0,1),20,'Objective Heavy','1'],
 ['Mathematics',topics.slice(0,3),50,'Balanced','2'],
 ['Mathematics',['Nonexistent chapter'],20,'Objective Heavy','1']
]){
 let blocked=false;
 try{build(subject,selected,total,'Balanced',mode,grade)}catch(error){
  blocked=/(insufficient real|no .*questions match the exact selected chapter)/i.test(String(error.message));}
 pass(blocked,'Paper Builder must block the unsupported grade, topic or insufficient question depth');
 checked++;
}
const auditAPI=window.EDUNIZAM_PAPER_SYLLABUS_AUDIT;
pass(!!auditAPI,'Paper syllabus audit missing');
pass(auditAPI.chapterMatches(' Fractions ','fractions'),'Exact match whitespace or case normalization failed');
pass(!auditAPI.chapterMatches('Fractions','Fractions and Decimals'),'Partial chapter names must not match');
const coverage=auditAPI.audit({className:'1',subject:'Mathematics',chapters:topics.slice(0,2),teacherQuestions:[],practiceQuestions:window.EDUNIZAM_PRACTICE_DATA.questions});
pass(coverage.chapters.length===2&&coverage.missingChapters.length===0,'Grade 1 chapter coverage not reported');
pass(coverage.chapters.every(c=>c.types.mcq.total>0),'Missing MCQ chapter coverage counts');
const wrongChapter=auditAPI.audit({className:'1',subject:'Mathematics',chapters:['Made-up textbook chapter'],teacherQuestions:[],practiceQuestions:window.EDUNIZAM_PRACTICE_DATA.questions});
pass(wrongChapter.missingChapters.length===1,'Made-up chapters must be marked missing');
const teacherOnly=auditAPI.audit({className:'1',subject:'Mathematics',chapters:topics.slice(0,1),teacherQuestions:[],practiceQuestions:window.EDUNIZAM_PRACTICE_DATA.questions,teacherOnly:true});
pass(teacherOnly.totals.mcq===0&&teacherOnly.missingChapters.length===1,'Teacher-only option must exclude built-in bank');
let teacherOnlyBlocked=false;
try{build('Mathematics',topics.slice(0,1),20,'Balanced','Objective Heavy','1',{teacherOnly:true})}
catch(error){teacherOnlyBlocked=/teacher-bank/i.test(String(error.message))}
pass(teacherOnlyBlocked,'Teacher-only paper must fail without teacher-supplied questions');
const code=read('teacher-paper-builder.js');
const importer=window.EDUNIZAM_QUESTION_IMPORT;
pass(!!importer&&typeof importer.prepare==='function','Question CSV/JSON importer unavailable');
const fixture=importer.prepare(importer.template,'template.csv');
pass(fixture.valid.length===2&&fixture.errors.length===0,'Valid example CSV import fixture is not accepted');
pass(fixture.valid[0].correct_option===2,'MCQ 1-based correct answer is not converted to zero-based storage');
pass(fixture.valid[1].question_type==='short'&&!!fixture.valid[1].answer_text,'Written question bank template incomplete');
const repeat=importer.prepare(importer.template,'template.csv',fixture.valid);
pass(repeat.valid.length===0&&repeat.duplicates===2,'Import duplicate detection ineffective');
const invalid=importer.prepare(JSON.stringify([{class:'9',subject:'Physics',chapter:'Force',type:'mcq',question:'Test',options:['A','B','C','C'],correct_option:'4'}]),'bad.json');
pass(invalid.valid.length===0&&invalid.errors.length===1,'Importer accepted repeated MCQ options');
const injection=importer.prepare(JSON.stringify([{class:'9',subject:'Physics',chapter:'Force',type:'short',question:'Explain force',answer:'Force changes motion',institution_id:'attacker-value',creator_user_id:'attacker-value'}]),'bank.json');
pass(injection.valid.length===1&&!('institution_id' in injection.valid[0])&&!('creator_user_id' in injection.valid[0]),'Uploaded JSON can override secure institution/user values');
for(const marker of ['id="pbTeacherOnly"','Exact chapter coverage:','id="qbImportFile"','id="qbImportPreview"','id="qbImportSave"','saveQuestionImport()','downloadQuestionTemplate()']){
 pass(code.includes(marker),'Paper Builder missing import flow: '+marker);
}

for(const token of ['v.options.length!==4','!v.chapter','!v.answer','marks:points[i]','maxMarksPerQuestion'])
 pass(code.includes(token),'Missing teacher question-bank quality guard '+token);
for(const name of ['timetable-date-sheet.js','exam-center.js','daily-class-diary.js']){
 const src=read(name);
 for(const token of ['EDUNIZAM_ACADEMIC_OPTION_CATALOG','SubjectOptions'].filter(x=>name!=='daily-class-diary.js'||x!=='SubjectOptions'))
  pass(src.includes(token),'Academic subject catalog missing in '+name);
}
const loader=read('feature-loader.js');
pass(loader.includes("paperbuilder:['paper-syllabus-audit.js','teacher-question-import.js','teacher-paper-builder.js'"),'Question importer does not load before Paper Builder');
for(const v of ['schedulecenter','examcenter','dailydiary'])
 pass(loader.includes(v+":['lessonCatalog']"),'Lightweight academic option catalog not loaded for '+v);
console.log('EduNizam paper and dropdown data gate PASS; '+checked+' paper tests; 20/50/100 marks add correctly; unsupported inputs blocked.');
