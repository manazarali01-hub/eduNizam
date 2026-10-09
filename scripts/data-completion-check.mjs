/* Regression gate for reference-content coverage only.
   It does not certify each question's academic accuracy or imply that
   local institution-specific records exist in Supabase. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const failures=[];
const requireOK=(ok,message)=>{if(!ok)failures.push(message)};
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const names=[
 'past-papers-data.js','practice-data.js','study-data.js',
 'learning-premium-data.js','learning-complete-data.js','learning-required-data.js',
 'practice-foundation-data.js','practice-curriculum-expansion.js',
 'practice-depth-data.js','practice-complete-data.js','practice-session-core.js'
];
const win={};
const context={window:win,console};
for(const name of names){
 try{runInNewContext(read(name),context,{filename:name,timeout:6000})}
 catch(error){failures.push(name+' could not load: '+error.message)}
}
const D=win.EDUNIZAM_PRACTICE_DATA||{};
const bank=Array.isArray(D.questions)?D.questions:[];
const subjects=D.subjects||{},chapters=D.chapters||{};
const mcq=bank.filter(q=>q.type==='mcq');
const grades=Array.from({length:12},(_,i)=>i+1);
const pairs=Object.entries(subjects).flatMap(([grade,rows])=>(rows||[]).map(subject=>({grade,subject,chapters:chapters[grade+'|'+subject]||[]})));
const topicTotal=Object.values(chapters).reduce((n,items)=>n+(items?.length||0),0);
requireOK(bank.length>=4200,'Practice bank below the expected 4,200 verified-structure entries');
requireOK(topicTotal>=450,'Fewer than 450 topic groups');
for(const grade of grades)requireOK(Array.isArray(subjects[String(grade)])&&subjects[String(grade)].length>=4,'No usable subjects for grade '+grade);
for(const pair of pairs)requireOK(pair.chapters.length>0,'No chapters for '+pair.grade+' / '+pair.subject);
requireOK(new Set(bank.map(x=>x.id)).size===bank.length,'Duplicate question IDs in practice catalog');
const permitted=new Set(['mcq','short','long']);
const difficulty=new Set(['Easy','Medium','Hard']);
for(const q of bank){
 requireOK(!!String(q.id||'').trim()&&!!String(q.question||'').trim(),'Empty question or ID');
 requireOK(!!String(q.chapter||'').trim()&&!!String(q.subject||'').trim(),'Question missing topic or subject: '+q.id);
 requireOK(grades.includes(Number(q.classLevel)),'Question outside Grades 1–12: '+q.id);
 requireOK(permitted.has(q.type)&&difficulty.has(q.difficulty),'Invalid type/difficulty: '+q.id);
 if(q.type==='mcq'){
  const opts=q.options||[];
  requireOK(Array.isArray(opts)&&opts.length===4&&opts.every(x=>String(x||'').trim()),'Malformed MCQ options: '+q.id);
  requireOK(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4,'Malformed MCQ answer: '+q.id);
  requireOK(!!String(q.explanation||'').trim(),'MCQ missing explanation: '+q.id);
  if(Array.isArray(opts))requireOK(new Set(opts.map(x=>String(x))).size===4,'Identical MCQ options: '+q.id);
 }else requireOK(!!String(q.answerText||'').trim(),'Written item without model answer: '+q.id);
}
const missing=win.EDUNIZAM_PRACTICE_CORE?.auditMatrix?.(D)||[{error:'Missing practice-core matrix auditor'}];
requireOK(!missing.length,'Missing MCQ/short/long × Easy/Medium/Hard combinations: '+JSON.stringify(missing.slice(0,5)));
const foundation=win.EDUNIZAM_FOUNDATION_PRACTICE||{};
requireOK(foundation.topicGroups>=100&&foundation.curatedMcqsAdded===foundation.topicGroups,'Not all foundation topics have an authored question');
const books=win.EDUNIZAM_STUDY_DATA?.materials||[];
const bookLinks=books.filter(x=>String(x.id||'').startsWith('pectaa-book-search-'));
requireOK(bookLinks.length>=100,'Missing subject-wise official eBook directory links');
for(const grade of grades)requireOK(bookLinks.some(x=>x.classLevels?.includes(grade)),'No source-specific book links for Grade '+grade);
for(const item of bookLinks){
 requireOK(item.source==='official'&&item.curriculumStatus==='needs-verification','Book directory source/current-status label incorrect: '+item.id);
 requireOK(item.url==='https://pectaa.edu.pk/books-and-publications/','Book directory URL differs from approved PECTAA source: '+item.id);
}
const app=read('app.html'),learn=read('learn.html'),features=read('feature-loader.js'),guest=read('guest-learning-premium.js'),lesson=read('lesson-plan-center.js');
for(const grade of grades){
 requireOK(app.includes('<option value="'+grade+'">'+(grade<=8?'Grade':'Class')+' '+grade+'</option>'),'App practice selector omits Grade '+grade);
 requireOK(app.includes('<option value="'+grade+'">Class '+grade+'</option>'),'Study selector omits Grade '+grade);
}
requireOK(features.includes("'practice-foundation-data.js'"),'Authenticated feature-loader is not loading foundation catalog');
requireOK(learn.includes('practice-foundation-data.js'),'Guest Learning Hub is not loading foundation catalog');
for(const id of ['lpPlanSubjects','lpPlanTopics','lpUnitSubjects','lpUnitTopics'])requireOK(lesson.includes('id="'+id+'"'),'Lesson/Syllabus form is missing '+id);
requireOK(guest.includes("const prev=$('prevQuestion'),next=$('nextQuestion')"),'Guest Practice static Next/Previous control binding missing');
if(failures.length){
 console.error('EduNizam reference-data gate FAILED ('+failures.length+')');
 for(const failure of failures.slice(0,40))console.error('✗ '+failure);
 process.exit(1);
}
console.log('EduNizam reference-data gate PASS:',bank.length,'questions;',grades.length,'grades;',topicTotal,'topic groups;',mcq.length,'MCQs;',bookLinks.length,'official eBook lookup rows;',pairs.length,'class–subject pairs; 0 matrix gaps.');
