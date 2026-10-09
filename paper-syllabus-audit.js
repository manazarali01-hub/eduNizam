/* Exact-chapter question-bank coverage (NOT academic verification).
 * No substring / partial chapter matches: "Fractions" cannot silently
 * include questions from "Fractions and Decimals". */
(function(){
'use strict';
const norm=v=>String(v??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const chapterMatches=(expected,actual)=>!!norm(actual)&&norm(expected)===norm(actual);
const normalizeSubject=v=>{
 const x=norm(v),aliases={'science':'general science','islamiyat':'islamiat / ethics','islamic studies':'islamiat / ethics','math':'mathematics','computer':'computer science','pak studies':'pakistan studies'};
 return aliases[x]||x;
};
const classLevel=v=>{const m=String(v??'').match(/\b(1[0-2]|[1-9])\b/);return m?Number(m[1]):0};
const fromTeacher=(q,grade,subject,chapter,type,difficulty)=>{
 if(!q||q.active===false||classLevel(q.class_name)!==grade||normalizeSubject(q.subject)!==normalizeSubject(subject)||!chapterMatches(chapter,q.chapter)||q.question_type!==type)return false;
 return difficulty==='Easy'?q.difficulty==='Easy':difficulty==='Challenging'?q.difficulty==='Challenging':true;
};
const fromPractice=(q,grade,subject,chapter,type,difficulty)=>{
 if(!q||Number(q.classLevel)!==grade||normalizeSubject(q.subject)!==normalizeSubject(subject)||!chapterMatches(chapter,q.chapter)||q.type!==type)return false;
 return difficulty==='Easy'?q.difficulty==='Easy':difficulty==='Challenging'?q.difficulty==='Hard':true;
};
function audit({className,subject,chapters=[],teacherQuestions=[],practiceQuestions=[],difficulty='Balanced',teacherOnly=false}={}){
 const grade=classLevel(className);
 const selected=[...new Map(chapters.map(c=>[norm(c),String(c).trim()]).filter(([key])=>key)).values()];
 const matrix=selected.map(chapter=>{
  const perType={};
  for(const type of ['mcq','short','long']){
   const teacher=teacherQuestions.filter(q=>fromTeacher(q,grade,subject,chapter,type,difficulty)).length;
   const practice=teacherOnly?0:practiceQuestions.filter(q=>fromPractice(q,grade,subject,chapter,type,difficulty)).length;
   perType[type]={teacher,practice,total:teacher+practice};
  }
  return{chapter,types:perType,total:Object.values(perType).reduce((n,v)=>n+v.total,0)};
 });
 const totals=Object.fromEntries(['mcq','short','long'].map(t=>[t,matrix.reduce((n,r)=>n+r.types[t].total,0)]));
 return{grade,subject,chapters:matrix,totals,teacherOnly,
  missingChapters:matrix.filter(x=>x.total===0).map(x=>x.chapter),
  noQuestionTypes:Object.entries(totals).filter(([,n])=>n===0).map(([type])=>type),
  warnings:!selected.length?['Select at least one syllabus chapter.']:[]};
}
window.EDUNIZAM_PAPER_SYLLABUS_AUDIT={audit,chapterMatches,normalizeSubject,classLevel};
})();