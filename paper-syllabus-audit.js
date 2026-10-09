/* EduNizam exact-chapter paper data-quality audit.
 * This verifies usable question structure, not academic textbook correctness. */
(function(){
'use strict';
const norm=v=>String(v??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const chapterMatches=(expected,actual)=>!!norm(actual)&&norm(expected)===norm(actual);
const classLevel=v=>{const m=String(v??'').match(/\b(1[0-2]|[1-9])\b/);return m?Number(m[1]):0};
const sameClass=(a,b)=>{const x=classLevel(a),y=classLevel(b);return x&&y?x===y:!!norm(a)&&norm(a)===norm(b)};
const normalizeSubject=v=>{
 const x=norm(v),aliases={'science':'general science','islamiyat':'islamiat / ethics','islamic studies':'islamiat / ethics','math':'mathematics','computer':'computer science','pak studies':'pakistan studies'};
 return aliases[x]||x;
};
const questionKey=q=>norm(q?.question_text??q?.question);
const usable=(q,type,teacher)=>{
 if(!q||!questionKey(q))return false;
 if(type==='mcq'){
  const o=q.options,index=Number(teacher?q.correct_option:q.answer);
  return Array.isArray(o)&&o.length===4&&o.every(x=>norm(x).length>0)&&new Set(o.map(norm)).size===4&&Number.isInteger(index)&&index>=0&&index<4;
 }
 return !!norm(teacher?q.answer_text:(q.answerText||q.explanation));
};
const matchesTeacher=(q,className,subject,chapter,type,difficulty)=>{
 if(!q||q.active===false||!sameClass(q.class_name,className)||normalizeSubject(q.subject)!==normalizeSubject(subject)||!chapterMatches(chapter,q.chapter)||q.question_type!==type||!usable(q,type,true))return false;
 return difficulty==='Easy'?q.difficulty==='Easy':difficulty==='Challenging'?q.difficulty==='Challenging':true;
};
const matchesPractice=(q,className,subject,chapter,type,difficulty)=>{
 if(!q||!classLevel(className)||Number(q.classLevel)!==classLevel(className)||normalizeSubject(q.subject)!==normalizeSubject(subject)||!chapterMatches(chapter,q.chapter)||q.type!==type||!usable(q,type,false))return false;
 return difficulty==='Easy'?q.difficulty==='Easy':difficulty==='Challenging'?q.difficulty==='Hard':true;
};
function audit({className,subject,chapters=[],teacherQuestions=[],practiceQuestions=[],difficulty='Balanced',teacherOnly=false}={}){
 const grade=classLevel(className);
 const selected=[...new Map(chapters.map(c=>[norm(c),String(c).trim()]).filter(([key])=>key)).values()];
 const matrix=selected.map(chapter=>{
  const perType={};
  for(const type of ['mcq','short','long']){
   const seen=new Set();
   const unique=arr=>arr.filter(q=>{const key=questionKey(q);if(seen.has(key))return false;seen.add(key);return true}).length;
   const teacher=unique(teacherQuestions.filter(q=>matchesTeacher(q,className,subject,chapter,type,difficulty)));
   const practice=teacherOnly?0:unique(practiceQuestions.filter(q=>matchesPractice(q,className,subject,chapter,type,difficulty)));
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
window.EDUNIZAM_PAPER_SYLLABUS_AUDIT={audit,chapterMatches,normalizeSubject,classLevel,sameClass,questionKey,matchesTeacher,matchesPractice,usable};
})();