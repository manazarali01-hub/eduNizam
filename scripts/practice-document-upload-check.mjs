/* Reproduces Grade 5 PDF/photo Q/A → reviewed source-only Practice;
 * exercises previous/next, answer marking and no cross-school question leakage. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TextEncoder} from 'node:util';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ok=(condition,message)=>{if(!condition)throw Error(message)};
const elements=new Map();
const node=id=>{
 if(!elements.has(id))elements.set(id,{id,value:'',checked:false,disabled:false,innerHTML:'',textContent:'',
  files:[],classList:{add(){},remove(){},toggle(){}},addEventListener(){},scrollIntoView(){},querySelectorAll(){return[]},isConnected:true});
 return elements.get(id);
};
const selections={};
const document={
 getElementById:node,
 querySelector(selector){
  if(selector.startsWith('#'))return node(selector.slice(1));
  const q=selector.match(/^input\[name="pq_(\d+)"\]:checked$/);
  if(q)return Number.isInteger(selections[Number(q[1])])?{value:String(selections[Number(q[1])])}:null;
  return null;
 },
 querySelectorAll(){return[]}
};
const local=new Map([['edunizam_students','[]'],['edunizam_practice_history','[]']]);
const localStorage={getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,String(value))};
const catalog={boards:['Punjab'],subjects:{5:['General Science']},chapters:{'5|General Science':['Matter']},
 questions:[{id:'existing',classLevel:5,subject:'General Science',chapter:'Matter',type:'mcq',difficulty:'Easy',
  question:'Built-in practice question must NOT leak into upload-only test.',options:['A','B','C','D'],answer:0}]};
const window={EDUNIZAM_PRACTICE_DATA:catalog,EDUNIZAM_CLOUD_CONFIG:{institutionId:'school-A'},
 EDUNIZAM_CLOUD:{state:{user:{id:'teacher-A'}}}};
const ctx={window,document,localStorage,console,TextEncoder,setTimeout,clearTimeout,
 setInterval:()=>1,Math,alert:msg=>{throw Error('Unexpected alert: '+msg)}};
for(const file of ['practice-session-core.js','teacher-question-import.js','paper-source-import.js',
 'practice-source-import.js','practice-center.js']){
 runInNewContext(read(file),ctx,{filename:file,timeout:6000});
}
node('practiceClass').value='5';
node('practiceSubject').value='General Science';
node('practiceChapter').value='Matter';
node('practiceType').value='mcq';
node('practiceCount').value='10';
node('practiceMinutes').value='5';
node('practiceSourceChapter').value='Matter';
const src=window.EDUNIZAM_PAPER_SOURCE;
const text='Q1: What state is ice?\nA) Gas\nB) Solid\nC) Liquid\nD) Plasma\nAnswer: B\n\nQ2: Explain matter.\nAnswer: Matter has mass and occupies space.';
node('practiceSourceText').value=text;
window.EDUNIZAM_PRACTICE_SOURCE.detectQuestions();
const json=node('practiceSourceQuestions').value;
ok(json.includes('What state is ice?')&&json.includes('Explain matter.'),
 'Practice OCR extraction failed to offer human-reviewable questions');
node('practiceSourceReviewed').checked=true;
const result=window.EDUNIZAM_PRACTICE_SOURCE.validateAndStart();
ok(result?.valid===2,'Reviewed Grade 5 science OCR questions were not staged: '+node('practiceSourceStatus').textContent);
const api=window.EDUNIZAM_PRACTICE_NAV;
ok(api.status().total===2&&api.status().cursor===0,'Uploaded source did not start a two-question test');
ok(node('practiceSourceOnly').checked,'Uploaded-question-only filter is not enabled');
ok(!node('practiceQuestions').innerHTML.includes('Built-in practice question'),
 'Uploaded test silently mixed built-in practice bank');
ok(node('practiceTestTitle').textContent.includes('Uploaded-document practice'),
 'Uploaded test is wrongly described as built-in board curriculum');
selections[0]=1;
api.next();
ok(api.status().cursor===1&&api.status().answers[0]===1,'Uploaded first MCQ answer not preserved by Next');
ok(node('practiceNextBtn').textContent==='Finish & Submit','Final uploaded question has no finish control');
api.submit();
const last=JSON.parse(local.get('edunizam_practice_history')).at(-1);
ok(last.autoTotal===1&&last.autoCorrect===1,'Reviewed uploaded MCQ key not marked correctly');
ok(catalog.questions.length===1,'Imported material polluted shared EduNizam question bank');
ok(api.reviewedSourceQuestions().length===2,'Uploaded reviewed session was not kept in tab');
window.EDUNIZAM_CLOUD_CONFIG.institutionId='school-B';
window.EDUNIZAM_CLOUD.state.user.id='teacher-B';
ok(api.reviewedSourceQuestions().length===0,'School-A uploaded questions leaked into School B');
window.EDUNIZAM_CLOUD_CONFIG.institutionId='school-A';
window.EDUNIZAM_CLOUD.state.user.id='teacher-A';
ok(api.reviewedSourceQuestions().length===0,'Previous-school questions reappeared after school switch');
api.clearReviewedSource();
ok(!node('practiceSourceOnly').checked&&api.reviewedSourceQuestions().length===0,
 'Clear Uploaded Questions left staged questions or filter enabled');
const loader=read('feature-loader.js'),html=read('app.html');
ok(loader.includes("practice:['teacher-question-import.js','paper-source-import.js','practice-source-import.js','practice-center.js']"),
 'Practice source reader/strict question importer load order broken');
for(const id of ['practiceSourceFiles','practiceSourceRead','practiceSourceText','practiceSourceAi',
 'practiceSourceAiConsent','practiceSourceQuestions','practiceSourceReviewed','practiceSourceOnly','practiceSourceStage','practiceSourceClear']){
 ok(html.includes('id="'+id+'"'),'Practice PDF/photo flow missing '+id);
}
ok(read('practice-source-import.js').includes("context:' '")&&
 read('practice-source-import.js').includes('practiceSourceAiConsent'),
 'Practice AI text sharing lacks separate opt-in and minimized context');
console.log('Practice source PDF/photo PASS: Class 5 Science OCR Q/A review, source-only session, Next/finish, answer scoring, zero bank pollution, school switch isolation.');
