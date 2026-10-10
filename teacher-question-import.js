/* Teacher-supplied verified question bank importer: CSV / JSON only.
   Uploaded files cannot set institution/user IDs; the active session does that. */
(function(){
'use strict';
const MAX_BYTES=1048576,MAX_ROWS=500;
const template='class,subject,chapter,type,difficulty,question,option1,option2,option3,option4,correct_option,answer,visibility\n"9","Mathematics","Real and Complex Numbers","mcq","Balanced","Which is irrational?","0.5","3/4","√2","-4","3","√2 is irrational.","private"\n"9","Mathematics","Real and Complex Numbers","short","Balanced","Define rational number.",,,,,,"A number equal to p/q where q is nonzero.","private"\n';
function csv(t){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<t.length;i++){
  const c=t[i],n=t[i+1];
  if(c==='"'){if(quoted&&n==='"'){cell+='"';i++}else quoted=!quoted;continue}
  if(c===','&&!quoted){row.push(cell);cell='';continue}
  if((c==='\r'||c==='\n')&&!quoted){
   if(c==='\r'&&n==='\n')i++;
   row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);
   row=[];cell='';continue
  }
  cell+=c;
 }
 if(quoted)throw Error('CSV has an unclosed quotation mark.');
 row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);
 if(!rows.length)throw Error('CSV has no header.');
 const header=rows.shift().map(v=>String(v).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s-]+/g,'_'));
 return rows.map(a=>Object.fromEntries(header.map((k,i)=>[k,a[i]??''])));
}
const norm=x=>String(x??'').trim(),low=x=>norm(x).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
const gradeKey=x=>{const s=low(x),m=s.match(/^(?:(?:class|grade)\s*)?(1[0-2]|[1-9])$/);return m?m[1]:s};
const subjectKey=x=>{
 const v=low(x);
 return ({science:'general science','general science':'general science',
  math:'mathematics',maths:'mathematics',mathematics:'mathematics',
  islamiyat:'islamiat / ethics',islamiat:'islamiat / ethics','islamic studies':'islamiat / ethics',
  computer:'computer science','computer science':'computer science'})[v]||v;
};
// Whole-grade and known subject aliases are duplicate keys, never evidence
// that two separately named or section-specific syllabus chapters are equal.
const signature=x=>[gradeKey(x.class_name??x.class??x.className),subjectKey(x.subject),
 low(x.chapter),low(x.question_type??x.type),low(x.question_text??x.question)].join('|');
function prepare(text,filename,existing=[]){
 if(!text||!String(text).trim())throw Error('Select a non-empty CSV or JSON file.');
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('File larger than 1MB.');
 let raw;
 if(/\.json$/i.test(filename||'')){const o=JSON.parse(text);raw=Array.isArray(o)?o:o?.questions;if(!Array.isArray(raw))throw Error('JSON must be an array or {questions: [...]}');}
 else if(/\.csv$/i.test(filename||''))raw=csv(text);
 else throw Error('Only CSV and JSON files are supported.');
 if(!raw.length||raw.length>MAX_ROWS)throw Error('Import needs 1–'+MAX_ROWS+' question rows.');
 const existingIds=new Set(existing.map(signature)),inFile=new Set(),valid=[],errors=[];let duplicates=0;
 for(let i=0;i<raw.length;i++){
  const q=raw[i],row=i+1;
  if(!q||typeof q!=='object'||Array.isArray(q)){errors.push('Row '+row+': object required');continue}
  const class_name=norm(q.class??q.class_name??q.className),
   subject=norm(q.subject),chapter=norm(q.chapter),question_type=low(q.type??q.question_type),
   question_text=norm(q.question??q.question_text),
   difficulty=norm(q.difficulty)||'Balanced',
   answer_text=norm(q.answer??q.answer_text)||null,
   visibility=low(q.visibility||'private');
  const options=Array.isArray(q.options)?q.options.map(norm):[q.option1,q.option2,q.option3,q.option4].map(norm);
  const cr=norm(q.correct_option??q.correctOption);
  const correct_option=/^[A-Da-d]$/.test(cr)?cr.toUpperCase().charCodeAt(0)-65:/^[1-4]$/.test(cr)?Number(cr)-1:-1;
  if(!class_name||!subject||!chapter||!question_text||question_text.length>3000){errors.push('Row '+row+': missing class/subject/chapter/question or question too long');continue}
  if(!['mcq','short','long'].includes(question_type)||!['Easy','Balanced','Challenging'].includes(difficulty)){errors.push('Row '+row+': invalid type/difficulty');continue}
  if(!['private','admin'].includes(visibility)){errors.push('Row '+row+': invalid visibility');continue}
  if(question_type==='mcq'&&(options.length!==4||options.some(x=>!x)||new Set(options.map(low)).size!==4||correct_option<0)){
   errors.push('Row '+row+': MCQ requires 4 unique options and correct_option 1–4 or A–D');continue
  }
  if(question_type!=='mcq'&&!answer_text){errors.push('Row '+row+': written question missing model answer');continue}
  const item={class_name:class_name.slice(0,90),subject:subject.slice(0,90),chapter:chapter.slice(0,150),
   question_type,difficulty,question_text,options:question_type==='mcq'?options:[],
   correct_option:question_type==='mcq'?correct_option:null,answer_text,visibility,active:true};
  const key=signature(item);
  if(existingIds.has(key)||inFile.has(key)){duplicates++;continue}
  inFile.add(key);valid.push(item);
 }
 return {valid,errors,duplicates,total:raw.length};
}
window.EDUNIZAM_QUESTION_IMPORT={csv,prepare,template,MAX_BYTES,MAX_ROWS};
})();
