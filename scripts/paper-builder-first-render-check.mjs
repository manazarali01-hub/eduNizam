/* The Paper Builder must become interactive without waiting for optional
 * teacher preferences or the Question Bank. All cloud reads are in-memory. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../teacher-paper-builder.js',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const staffA=deferred(),staffB=deferred(),questionsA=deferred(),questionsB=deferred();
const cfg={institutionId:'school-A'},user={id:'teacher-A'};
const classes={ 'school-A':[{id:'class-A',class_name:'5',section_name:'A',active:true}],
 'school-B':[{id:'class-B',class_name:'6',section_name:'B',active:true}]};
const cloudCalls=[];
const client={from(table){
 let school='',person='';
 const q={
  select(){return this},eq(k,v){if(k==='institution_id')school=v;if(k==='user_id')person=v;return this},
  order(){return this},range(){return this},
  maybeSingle(){cloudCalls.push({table,school,person});return school==='school-A'?staffA.promise:staffB.promise},
  then(resolve,reject){
   cloudCalls.push({table,school});
   if(table==='teacher_question_bank')return (school==='school-A'?questionsA.promise:questionsB.promise).then(resolve,reject);
   if(table==='class_sections')return Promise.resolve({data:classes[school]||[],error:null}).then(resolve,reject);
   return Promise.resolve({data:[],error:null}).then(resolve,reject);
  }
 };
 return q;
}};
const nodes=new Map();
function registerIds(html){
 for(const m of String(html).matchAll(/\bid="([^"]+)"/g))node('#'+m[1]);
}
function node(key){
 if(nodes.has(key))return nodes.get(key);
 let html='';
 const n={value:'',disabled:false,isConnected:true,checked:false,onclick:null,textContent:'',
  dataset:{},classList:{add(){},remove(){},toggle(){}},
  addEventListener(){},querySelectorAll(){return[]},scrollIntoView(){},
  insertAdjacentHTML(_where,content){registerIds(content)}};
 Object.defineProperty(n,'innerHTML',{get(){return html},set(value){html=String(value);registerIds(html)}});
 n.parentElement={insertAdjacentHTML(_where,content){registerIds(content)}};
 nodes.set(key,n);return n;
}
const root=node('#paperBuilderApp');
const document={readyState:'loading',querySelector:key=>nodes.get(key)||null,
 querySelectorAll:()=>[],addEventListener(){}};
const window={EDUNIZAM_CLOUD:{state:{user,client}},EDUNIZAM_CLOUD_CONFIG:cfg};
const warnings=[];
runInNewContext(source,{window,document,localStorage:{getItem:()=>JSON.stringify({role:'teacher'})},
 console:{warn:(...args)=>warnings.push(args.join(' ')),log(){}},
 setTimeout,clearTimeout,AbortController,Promise},
 {filename:'teacher-paper-builder.js'});
const api=window.EDUNIZAM_PAPER_BUILDER;
const first=await Promise.race([api.render().then(()=>true),new Promise(r=>setTimeout(()=>r(false),200))]);
assert(first,'Paper Builder rendered only after waiting for a slow optional staff profile');
assert.match(root.innerHTML,/Smart Paper Builder/);
assert.match(root.innerHTML,/id="pbGenerate"/);
assert.equal(node('#pbGenerate').disabled,false,'Generate button was blocked by profile lookup');
for(let i=0;i<15;i++)await Promise.resolve();
assert.equal(api.getSchoolCatalog().classState,'loaded','Class catalog blocked behind slow Question Bank request');
assert.equal(api.getSchoolCatalog().classes.length,1);
assert(cloudCalls.some(x=>x.table==='teacher_question_bank'),'Question bank was not launched independently');
assert(cloudCalls.some(x=>x.table==='staff_profiles'&&x.school==='school-A'));

// A previous school's optional teacher preferences must never reach the new form.
cfg.institutionId='school-B';user.id='teacher-B';
await api.render();
assert.match(root.innerHTML,/Smart Paper Builder/);
staffA.resolve({data:{classes:['PRIVATE OLD CLASS'],subjects:['SECRET SUBJECT']},error:null});
for(let i=0;i<8;i++)await Promise.resolve();
assert.doesNotMatch(node('#pbClasses').innerHTML,/PRIVATE OLD CLASS/);
assert.doesNotMatch(node('#pbSubjects').innerHTML,/SECRET SUBJECT/);
staffB.resolve({data:{classes:['Prep B'],subjects:['Environmental Studies']},error:null});
for(let i=0;i<15;i++)await Promise.resolve();
assert.match(node('#pbClasses').innerHTML,/Prep B/,
 'Late/current teacher preferences failed to refresh the mounted grade choices');
questionsA.resolve({data:[],error:null});
questionsB.resolve({data:[],error:null});
for(let i=0;i<15;i++)await Promise.resolve();
assert.equal(api.getSchoolCatalog().classes[0]?.section_name,'B','Previous school class data leaked');
console.log('Paper Builder first paint PASS: controls show without optional cloud reads, school data loads independently, and old-school preferences are ignored.');
