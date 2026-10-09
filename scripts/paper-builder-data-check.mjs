/* Paper Builder release gate: do not fabricate exam items or corrupt mark totals.
 * This is a code-level test, not an academic endorsement of curriculum questions. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TextEncoder} from 'node:util';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const files=[
 'past-papers-data.js','practice-data.js','study-data.js','pectaa-core-textbooks.js','pectaa-secondary-textbooks.js',
 'learning-premium-data.js','learning-complete-data.js','learning-required-data.js',
 'practice-foundation-data.js','practice-curriculum-expansion.js','practice-depth-data.js',
 'punjab-quran-subjects-pack.js','practice-complete-data.js','practice-session-core.js'
];
const window={},document={readyState:'loading',addEventListener(){}};
const context={window,document,console,TextEncoder,setTimeout,clearTimeout,AbortController,localStorage:{getItem:()=>null}};
for(const file of files)runInNewContext(read(file),context,{filename:file,timeout:7000});
runInNewContext(read('paper-syllabus-audit.js'),context,{filename:'paper-syllabus-audit.js',timeout:7000});
runInNewContext(read('teacher-question-import.js'),context,{filename:'teacher-question-import.js',timeout:7000});
runInNewContext(read('teacher-paper-builder.js'),context,{filename:'teacher-paper-builder.js',timeout:7000});
const build=window.EDUNIZAM_PAPER_BUILDER?.build;
if(typeof build!=='function')throw new Error('Paper Builder build API is not available');
const pass=(ok,message)=>{if(!ok)throw new Error(message)};
const secondaryBooks=window.EDUNIZAM_STUDY_DATA.materials.filter(x=>/^pectaa-direct-secondary-/.test(x.id));
pass(secondaryBooks.length===27,'Paper Builder has not loaded 27 new secondary textbook links');
for(const [cls,subject,minCount] of [[9,'Mathematics',2],[9,'Chemistry',2],[9,'Biology',2],[9,'Physics',2],[10,'English',1],[10,'Computer Science',1]]){
 pass(secondaryBooks.filter(x=>x.classLevels[0]===cls&&x.subject===subject).length>=minCount,'Missing textbook source in Paper Builder for Grade '+cls+' '+subject);
}
pass(secondaryBooks.every(x=>x.source==='official'&&x.curriculumStatus==='needs-verification'),'Paper Builder is marking direct-linked textbooks as approved chapter catalogs');
// Real official textbook listings must remain discoverable for locally common
// school subject names. Do not use substring matching (Chemistry != Biochemistry).
const textbookMatches=window.EDUNIZAM_PAPER_BUILDER.materialSubjectMatches;
pass(typeof textbookMatches==='function','Paper Builder textbook subject matcher is unavailable');
for(const [chosen,listed,expected] of [
 ['Math','Mathematics',true],
 ['Maths','Mathematics',true],
 ['General Science','Science',true],
 ['Islamiyat','Islamiat / Ethics',true],
 ['Physics','Biology / Chemistry / Computer Science / Mathematics / Physics',true],
 ['Mathematics','Biology / Chemistry / Computer Science / Mathematics / Physics',true],
 ['Chemistry','Biochemistry',false],
 ['Math','Physics',false],
 ['Math','Mathematical Physics',false],
 ['Physics','Physical Education',false],
 ['Nazra Quran','Tarjuma-tul-Quran',false],
 ['English','All Subjects',true],
 ['','All Subjects',true],
 ['Math','',false]
])pass(textbookMatches(chosen,listed)===expected,'Official book subject matcher was wrong for '+chosen+' / '+listed);
const grade9math=secondaryBooks.filter(x=>x.classLevels[0]===9&&textbookMatches('Math',x.subject));
pass(grade9math.length>=2,'Grade 9 Math alias did not reveal both PECTAA Maths textbook links');
pass(grade9math.every(x=>x.subject==='Mathematics'),'Grade 9 Math view leaked another subject textbook');
const quranChapterChoices=window.EDUNIZAM_PAPER_BUILDER?.chapterChoices;
pass(quranChapterChoices('1','Tajveedi Qaida',[]).length===3,'Grade 1 Tajveedi Qaida not offered in Paper Builder');
pass(quranChapterChoices('3','Nazra Quran',[]).length===3,'Grade 3 Nazra Quran not offered in Paper Builder');
pass(quranChapterChoices('7','Tarjuma-tul-Quran',[]).length===3,'Grade 7 Tarjuma-tul-Quran not offered in Paper Builder');
pass(quranChapterChoices('8','Nazra Quran',[]).length===0,'Grade 8 must not show primary Nazra subject');

const recommend=window.EDUNIZAM_PAPER_BUILDER?.recommendPaperChapters;
pass(typeof recommend==='function','Missing chapter recommendation engine');
const readyDraft=recommend('1','Mathematics',20,'Balanced','Objective Heavy');
pass(readyDraft.ready&&readyDraft.source==='reference'&&readyDraft.topics.length>0,'Grade 1 Mathematics should recommend indexed chapter choices');
const readyPaper=build('Mathematics',readyDraft.topics,20,'Balanced','Objective Heavy','1');
pass(readyPaper.totalMarks===20&&readyPaper.sourceStats.templateFallback===0,'Recommended chapters cannot build a real-question draft');
const nothing=recommend('9','Nonexistent Study Subject',20,'Balanced','Balanced');
pass(!nothing.ready&&!nothing.topics.length,'Absent questions falsely recommend ready paper');
const teacherEmpty=recommend('1','Mathematics',20,'Balanced','Objective Heavy',{teacherOnly:true});
pass(!teacherEmpty.ready,'Teacher-only mode must not suggest unapproved public questions');
pass(!recommend('1','Mathematics',9,'Balanced','Balanced').ready,'Invalid 9-mark total was recommended');

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
const choices=window.EDUNIZAM_PAPER_BUILDER.chapterChoices;
pass(typeof choices==='function','Paper Builder grade/subject chapter options API missing');
const teacherChapter={class_name:'Grade 9',subject:'Physics',chapter:'Verified Unit: Motion in a Straight Line',question_type:'short',question_text:'Define constant velocity.',answer_text:'Velocity remains unchanged with time.',active:true};
pass(choices('9','Physics',[teacherChapter]).includes(teacherChapter.chapter),'Teacher-imported valid chapters must appear in the paper dropdown');
pass(!choices('10','Physics',[teacherChapter]).includes(teacherChapter.chapter),'Teacher chapters must not leak to another class');
pass(!choices('9','Chemistry',[teacherChapter]).includes(teacherChapter.chapter),'Teacher chapters must not leak to another subject');
pass(!choices('9','Physics',[{...teacherChapter,answer_text:''}]).includes(teacherChapter.chapter),'Invalid teacher questions should not supply empty chapter dropdown values');
pass(choices('Grade 1','Mathematics',[]).length>=4,'The existing built-in grade chapter choices must remain available');

// Institutional syllabus records are scoped before they populate the Paper Builder.
// Actual school textbook titles are NEVER generated from this reference fixture.
const schoolUnits=[
 {class_name:'Grade 9',subject:'Mathematics',unit_title:'Real textbook Unit 01'},
 {class_name:'9',subject:'Mathematics',unit_title:'Real textbook Unit 02'},
 {class_name:'Grade 9',subject:'Mathematics',unit_title:' Real textbook Unit 01 '},
 {class_name:'Grade 10',subject:'Mathematics',unit_title:'Other grade private unit'},
 {class_name:'Grade 9',subject:'English',unit_title:'English private unit'},
 {class_name:'Grade 9',subject:'Physics',unit_title:'Physics private unit'}
];
const schoolChoice=window.EDUNIZAM_PAPER_BUILDER.schoolChapters;
pass(typeof schoolChoice==='function','Paper Builder has no school-record syllabus mapper');
pass(schoolChoice('9','Mathematics',schoolUnits).length===2,'School syllabus should exclude duplicates and other grade/subjects');
pass(schoolChoice('10','Mathematics',schoolUnits).length===1,'School syllabus grade isolation failed');
pass(schoolChoice('9','Chemistry',schoolUnits).length===0,'School syllabus subject isolation failed');
const liveCatalog=window.EDUNIZAM_PAPER_BUILDER.getSchoolCatalog();
const originalUnits=liveCatalog.units;
liveCatalog.units=[{class_name:'Grade 1',subject:'Mathematics',unit_title:'School unit with no available questions'}];
const restricted=recommend('1','Mathematics',20,'Balanced','Objective Heavy');
pass(!restricted.ready&&restricted.source==='school'&&!restricted.topics.length,'School-recorded chapters were silently replaced by unrelated concept topics');
liveCatalog.units=originalUnits;

const joined=choices('9','Mathematics',[],schoolUnits);
pass(joined[0]==='Real textbook Unit 01'&&joined[1]==='Real textbook Unit 02','School records must be listed ahead of concept suggestions');
pass(joined.includes('Real and Complex Numbers'),'Existing concept topics must remain as separate, unverified suggestions');
const calls=[];
window.EDUNIZAM_CLOUD_CONFIG={institutionId:'test-school-1'};
window.EDUNIZAM_CLOUD={state:{user:{id:'teacher-test'},client:{
 from:table=>({select:columns=>({eq:(key,id)=>({limit:n=>{
   calls.push({table,columns,key,id,max:n});
   return Promise.resolve({data:table==='class_sections'?
     [{class_name:'9',section_name:'A',active:true},{class_name:'10',section_name:'A',active:false}]:
     [{class_name:'9',subject:'Mathematics',unit_title:'School Algebra Unit'}]});
 }})})})
}}};
document.querySelector=()=>null;
await window.EDUNIZAM_PAPER_BUILDER.loadSchoolCatalog();
const state=window.EDUNIZAM_PAPER_BUILDER.getSchoolCatalog();
pass(state.classState==='loaded'&&state.unitState==='loaded','School directory and units were not loaded');
pass(state.classes.length===1&&state.units.length===1,'Inactive school classes were not filtered');
pass(schoolChoice('9','Mathematics').includes('School Algebra Unit'),'Cloud syllabus is not connected to chapter options');
pass(calls.length===2&&calls.every(c=>c.key==='institution_id'&&c.id==='test-school-1'),'School syllabus fetch may access other institutes');
pass(calls.some(c=>c.table==='class_sections')&&calls.some(c=>c.table==='syllabus_progress_units'),'Missing school class or unit lookup');
window.EDUNIZAM_CLOUD.state.client.from=table=>({select:()=>({eq:()=>({limit:()=>Promise.resolve({error:{message:'Denied'}})})})});
await window.EDUNIZAM_PAPER_BUILDER.loadSchoolCatalog();
const denied=window.EDUNIZAM_PAPER_BUILDER.getSchoolCatalog();
pass(denied.unitState==='error'&&denied.classState==='error','Network/permission failures must not be called empty data');


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
const sampleRows=window.EDUNIZAM_PRACTICE_DATA.questions;
const math1=sampleRows.find(q=>Number(q.classLevel)===1&&q.subject==='Mathematics'&&q.type==='mcq');
pass(!!math1,'Class 1 Math question sample missing');
pass(auditAPI.sameClass('Grade 1','1'),'Grade 1 class label must match numeric class 1');
pass(!auditAPI.sameClass('Grade 1','Grade 11'),'Grade 1 must not match Grade 11');
// Grade-only aliases must NEVER merge a section-like class label.
// Otherwise teacher-bank questions from "5-A" can contaminate Grade 5.
pass(auditAPI.sameClass('Grade 5','Class 5')&&auditAPI.sameClass('5','Grade 5'),'Equivalent whole-grade labels must match');
pass(auditAPI.sameClass('5-A','5-A'),'An exact composite class name must remain valid');
pass(!auditAPI.sameClass('5-A','5')&&!auditAPI.sameClass('Grade 5 - Section A','5'),'Section-specific class label leaked into whole-grade bank');
pass(!auditAPI.sameClass('Grade 5-A','5-B'),'Distinct school section names merged');
const isolatedRows=[
 {class_name:'5-A',subject:'Mathematics',unit_title:'Only Section A'},
 {class_name:'5',subject:'Mathematics',unit_title:'Whole Grade Chapter'}
];
const onlyGrade=window.EDUNIZAM_PAPER_BUILDER.schoolChapters('5','Mathematics',isolatedRows);
pass(onlyGrade.includes('Whole Grade Chapter')&&!onlyGrade.includes('Only Section A'),'Paper Builder school chapters crossed into section-specific class');
const protectedTeacherQuestion={class_name:'5-A',subject:'Mathematics',chapter:'Fractions',question_type:'short',question_text:'Section-specific teacher answer',answer_text:'Private teacher key',difficulty:'Balanced',active:true};
pass(!auditAPI.matchesTeacher(protectedTeacherQuestion,'5','Mathematics','Fractions','short','Balanced'),'Section-specific teacher bank question counted for another class');
pass(auditAPI.matchesTeacher(protectedTeacherQuestion,'5-A','Mathematics','Fractions','short','Balanced'),'Exact class-specific teacher question incorrectly rejected');
pass(!auditAPI.usable({...math1,options:['same','same','different','last']},'mcq',false),'Duplicate MCQ options must be rejected');
pass(!auditAPI.usable({...math1,answer:99},'mcq',false),'Out-of-range answer index must be rejected');
// Missing/blank legacy answer keys used to coerce to 0 (option A).
for(const invalidAnswer of [null,undefined,'','   ',false,'0.0','-1',4]){
 pass(!auditAPI.usable({...math1,answer:invalidAnswer},'mcq',false),'Practice MCQ missing/invalid answer was accepted: '+String(invalidAnswer));
 pass(!auditAPI.usable({...math1,question_text:math1.question,correct_option:invalidAnswer},'mcq',true),'Teacher MCQ missing/invalid answer was accepted: '+String(invalidAnswer));
}
pass(auditAPI.usable({...math1,answer:0},'mcq',false),'Valid zero-based answer A was rejected');
pass(auditAPI.usable({...math1,question_text:math1.question,correct_option:'0'},'mcq',true),'Valid string zero-based teacher option was rejected');
const invalidOnly=auditAPI.audit({className:'1',subject:'Mathematics',chapters:[math1.chapter],
 teacherQuestions:[],practiceQuestions:[{...math1,id:'blank-answer-regression',answer:null}]});
pass(invalidOnly.missingChapters.length===1&&invalidOnly.totals.mcq===0,'Incomplete answers falsely counted as ready syllabus questions');
pass(!auditAPI.usable({question:'Explain why',type:'short',answerText:'',explanation:''},'short',false),'Missing subjective answer guide must be rejected');
pass(!auditAPI.usable({question:'Explain why',type:'short',answer_text:''},'short',true),'Teacher written question requires a real marking guide');
const sameQuestionTeacher={class_name:'Grade 1',subject:'Mathematics',chapter:math1.chapter,question_type:'mcq',question_text:math1.question,options:[...math1.options],correct_option:math1.answer,active:true,difficulty:'Balanced'};
const overlap=auditAPI.audit({className:'1',subject:'Mathematics',chapters:[math1.chapter],teacherQuestions:[sameQuestionTeacher],practiceQuestions:[math1]});
pass(overlap.totals.mcq===1&&overlap.chapters[0].types.mcq.teacher===1&&overlap.chapters[0].types.mcq.practice===0,'Overlapping teacher and practice questions must only count once');
const matchingGrade=build('Mathematics',topics.slice(0,2),20,'Balanced','Objective Heavy','Grade 1');
pass(matchingGrade.totalMarks===20,'Grade 1 alias should produce a valid 20-mark exam');
const uniquePaper=build('Mathematics',topics.slice(0,3),50,'Balanced','Balanced','1');
const keys=uniquePaper.sections.flatMap(section=>section.questions.map(q=>q.text.split(' A. ')[0].trim().toLowerCase()));
pass(keys.length===new Set(keys).size,'Paper builder must not reuse the same question text across sections');
for(const wrong of [NaN,14.5,0,-1,201]){
 let failed=false;try{build('Mathematics',topics.slice(0,3),wrong,'Balanced','Balanced','1')}catch(e){failed=/whole number between 10 and 200/.test(String(e.message))}
 pass(failed,'Invalid paper mark total was accepted: '+wrong);
}
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
