/* Practice navigation regression: one-at-a-time questions with durable answers. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../practice-center.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const check=(ok,message)=>{if(!ok)throw Error(message)};
check(html.includes('id="practicePrevBtn"')&&html.includes('id="practiceNextBtn"'),'Practice next/previous buttons missing from app');
const values=new Map([['edunizam_students','[]'],['edunizam_practice_history','[]']]);
const classes=()=>({add(){},remove(){},toggle(){},contains(){return false}});
const nodes=new Map();
function node(id){
 if(!nodes.has(id))nodes.set(id,{id,value:'',innerHTML:'',textContent:'',disabled:false,classList:classes(),style:{},setAttribute(){},
   addEventListener(){},scrollIntoView(){},querySelectorAll(){return[]},onclick:null});
 return nodes.get(id);
}
const selections={},writings={};
const document={
 getElementById:node,
 querySelector(s){
  const mcq=s.match(/^input\[name="pq_(\d+)"\]:checked$/);
  if(mcq)return Number.isInteger(selections[Number(mcq[1])])?{value:String(selections[Number(mcq[1])])}:null;
  const text=s.match(/^\[data-text-answer="(\d+)"\]$/);
  if(text)return{value:writings[Number(text[1])]||''};
  return null;
 },
 querySelectorAll(){return[]}
};
const D={
 boards:['Punjab'],
 subjects:{1:['Mathematics']},
 chapters:{'1|Mathematics':['Counting']},
 questions:[
  {id:'q1',classLevel:1,subject:'Mathematics',chapter:'Counting',type:'mcq',difficulty:'Easy',question:'How much is 1+1?',options:['0','1','2','3'],answer:2,explanation:'1+1=2'},
  {id:'q2',classLevel:1,subject:'Mathematics',chapter:'Counting',type:'short',difficulty:'Easy',question:'Define one.',answerText:'One is a unit.'},
  {id:'q3',classLevel:1,subject:'Mathematics',chapter:'Counting',type:'mcq',difficulty:'Easy',question:'How much is 2+2?',options:['4','5','6','7'],answer:0,explanation:'2+2=4'}
 ]
};
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const window={EDUNIZAM_PRACTICE_DATA:D};
runInNewContext(src,{window,document,localStorage,Math:Object.assign(Object.create(Math),{random:()=>0.5}),setInterval:()=>1,clearInterval:()=>{},console,alert:msg=>{throw Error('Unexpected alert: '+msg)}},{filename:'practice-center.js',timeout:2000});
node('practiceClass').value='1';
node('practiceSubject').value='Mathematics';
node('practiceType').value='mixed';
node('practiceCount').value='3';
node('practiceMinutes').value='10';
node('practiceDifficulty').value='';
const api=window.EDUNIZAM_PRACTICE_NAV;check(!!api,'Practice API missing');
api.start();
check(api.status().cursor===0&&api.status().total===3,'Start should show question 1 of 3');
check(node('practicePrevBtn').disabled&&node('practiceProgress').textContent.includes('Question 1 of 3'),'Initial progress/prev state wrong');
const firstContent=node('practiceQuestions').innerHTML;
check(firstContent.includes('How much is 1+1?')&&!firstContent.includes('How much is 2+2?'),'Practice must render one question at a time');
selections[0]=2;api.next();
check(api.status().cursor===1&&api.status().answers[0]===2,'First MCQ answer lost after Next');
writings[1]=' A written response to preserve ';api.next();
check(api.status().cursor===2&&api.status().answers[1].trim()==='A written response to preserve','Written response lost on Next');
check(node('practiceNextBtn').disabled,'Next should be disabled on final question');
selections[2]=0;api.previous();
check(api.status().answers[2]===0&&api.status().cursor===1,'Last MCQ answer lost on Previous');
api.previous();
check(node('practiceQuestions').innerHTML.includes('checked'),'Previous answer must be restored when revisiting');
api.submit();
const hist=JSON.parse(values.get('edunizam_practice_history'));
check(hist.length===1&&hist[0].autoTotal===2&&hist[0].autoCorrect===2,'Results should count answers from all paginated questions');
check(hist[0].details[1].textAnswer==='A written response to preserve','Written response missing from saved practice results');
check(hist[0].details[2].chosen===0,'Previously visited last question was not saved');
node('practiceCount').value='1';
api.start();
check(api.status().total===1&&node('practicePrevBtn').disabled&&node('practiceNextBtn').disabled,'Single-question practice must remain submittable');
console.log('EduNizam practice pagination PASS: 3 mixed questions, Next/Previous, retained MCQ and written answers, result scoring and single-question state.');
