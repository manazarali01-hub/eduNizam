/* Saved-paper writes must be institution+owner scoped and must confirm a
 * returned database row; RLS can silently match zero rows without an error.
 * Entire fixture is in-memory; no real school records are touched. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
const settings={institutionId:'school-A'},user={id:'owner-A'};
const paper={id:'paper-A',institution_id:'school-A',creator_user_id:'owner-A',
 title:'Saved paper',class_name:'5',subject:'Science',chapters:['Matter'],total_marks:10,
 difficulty:'Balanced',visibility:'private',created_at:'2026-10-11T00:00:00Z',
 paper_json:{className:'5',subject:'Science',topics:['Matter'],totalMarks:10,
  difficulty:'Balanced',distribution:'Balanced',sourceStats:{total:0},
  sections:[{title:'MCQ',marks:10,questions:[{no:1,marks:10,text:'Original question'}]}],
  answers:[{no:1,answer:'Answer key'}],curriculumMode:'school-recorded'}};
let records=[paper],updateMode='confirmed',deleteMode='confirmed',waitingUpdate=null;
const logged=[],calls=[],alerts=[];
const client={from(table){
 assert.equal(table,'teacher_papers');
 let operation='list',filters={};
 const query={
  select(){return this},
  eq(k,v){filters[k]=v;return this},
  order(){return this},
  range(){return this},
  update(payload){operation='update';this.payload=payload;return this},
  delete(){operation='delete';return this},
  maybeSingle(){
   calls.push({operation,filters:{...filters},payload:this.payload});
   if(updateMode==='deferred'){waitingUpdate=deferred();return waitingUpdate.promise}
   if(updateMode==='none')return Promise.resolve({data:null,error:null});
   if(updateMode==='error')return Promise.resolve({data:null,error:{message:'Database rejected'}}); 
   return Promise.resolve({data:{id:filters.id},error:null});
  },
  then(resolve,reject){
   calls.push({operation,filters:{...filters}});
   if(operation==='delete'){
    if(deleteMode==='none')return Promise.resolve({data:[],error:null}).then(resolve,reject);
    if(deleteMode==='error')return Promise.resolve({data:null,error:{message:'Database rejected'}}).then(resolve,reject);
    records=records.filter(x=>x.id!==filters.id);
    return Promise.resolve({data:[{id:filters.id}],error:null}).then(resolve,reject);
   }
   return Promise.resolve({data:records,error:null}).then(resolve,reject);
  }
 };return query;
}};
const nodes=new Map();
function node(id){
 if(nodes.has(id))return nodes.get(id);
 let html='';
 const v={disabled:false,isConnected:true,value:'',textContent:'',onclick:null,dataset:{},
  classList:{toggle(){},add(){},remove(){}},scrollIntoView(){},
  addEventListener(){},querySelectorAll(){return[]}};
 Object.defineProperty(v,'innerHTML',{get(){return html},set(txt){
  html=String(txt);
  for(const m of html.matchAll(/id="([^"]+)"/g))node('#'+m[1]);
 }});
 nodes.set(id,v);return v;
}
const list=node('#savedTeacherPapers'),preview=node('#paperPreview');
node('#pbSavedSearch');node('#pbSavedClass');node('#pbSavedCount');
const buttons={};
let mockEdits=[];
const document={readyState:'loading',addEventListener(){},
 querySelector:id=>nodes.get(id)||null,
 querySelectorAll:selector=>{
  if(selector==='[data-q]')return mockEdits;
  if(selector==='[data-pb-open]'){
   buttons.open={dataset:{pbOpen:'paper-A'},onclick:null};
   return[buttons.open];
  }
  if(selector==='[data-pb-delete]'){
   buttons.delete={dataset:{pbDelete:'paper-A'},onclick:null};return[buttons.delete];
  }
  return[];
 }};
const window={EDUNIZAM_CLOUD_CONFIG:settings,
 EDUNIZAM_CLOUD:{state:{user,client}},
 EDUNIZAM_PREMIUM:{toast:(...args)=>logged.push(args)}};
const ctx={window,document,console,
 localStorage:{getItem:()=>null},alert:x=>alerts.push(String(x)),
 confirm:()=>true,AbortController,setTimeout,clearTimeout};
runInNewContext(read('teacher-paper-builder.js'),ctx,{filename:'teacher-paper-builder.js'});
const api=window.EDUNIZAM_PAPER_BUILDER;
assert.equal(typeof api.updatePaper,'function');
assert.equal(typeof api.deletePaper,'function');
assert.equal(typeof api.validatePaperDraft,'function','Paper structure validator not available');
assert.equal(api.validatePaperDraft(paper.paper_json),'','Valid saved paper failed structure audit');
const changed=mutate=>{const v=JSON.parse(JSON.stringify(paper.paper_json));mutate(v);return v};
for(const [mutate,expected] of [
 [v=>{v.sections[0].questions[0].text='   '},/blank/i],
 [v=>{v.sections[0].questions[0].marks=0},/positive/i],
 [v=>{v.sections[0].questions[0].marks=8},/Section marks/i],
 [v=>{v.totalMarks=20},/Total marks/i],
 [v=>{v.answers[0].answer=''},/answer key/i],
 [v=>{v.sections[0].questions.push({...v.sections[0].questions[0]})},/numbering/i]
]){
 assert.match(api.validatePaperDraft(changed(mutate)),expected,
  'Paper save guard accepted an incomplete edited paper');
}
await api.loadPapers();
buttons.open.onclick();
assert.match(preview.innerHTML,/Original question/,'Saved editor not opened');
assert.match(preview.innerHTML,/pbSaveEdits/,'Owner cannot access save changes');
mockEdits=[{dataset:{q:'0:0'},value:'   '}];
const oldCalls=calls.length;
await api.updatePaper();
assert.equal(calls.length,oldCalls,'Blank edited question reached school database');
assert.match(alerts.at(-1),/Cannot save incomplete paper.*blank/i);
mockEdits=[{dataset:{q:'0:0'},value:'Original question'}];
updateMode='none';
await api.updatePaper();
assert.equal(logged.length,0,'No-row UPDATE falsely reported saved');
assert.match(alerts.at(-1),/not confirmed/i);
let req=calls.at(-1);
assert.equal(req.operation,'update');
assert.equal(req.filters.institution_id,'school-A');
assert.equal(req.filters.creator_user_id,'owner-A');
assert.equal(req.filters.id,'paper-A');
updateMode='error';
await api.updatePaper();
assert.equal(logged.length,0,'Denied UPDATE falsely reported saved');
updateMode='confirmed';
await api.updatePaper();
assert.equal(logged.length,1,'Confirmed UPDATE was not acknowledged');
assert.equal(logged[0][0],'Paper changes saved.');
updateMode='deferred';
const pending=api.updatePaper();
settings.institutionId='school-B';user.id='owner-B';
waitingUpdate.resolve({data:{id:'paper-A'},error:null});
await pending;
assert.equal(logged.length,1,'Old-school UPDATE response acknowledged in new account');
await api.updatePaper();
assert.equal(logged.length,1,'Old paper owner editable from new school');
settings.institutionId='school-A';user.id='owner-A';
deleteMode='none';
await api.deletePaper('paper-A');
assert.equal(logged.length,1,'No-row DELETE falsely reported success');
assert.match(alerts.at(-1),/not confirmed/i);
req=calls.at(-1);
assert.equal(req.operation,'delete');
assert.equal(req.filters.institution_id,'school-A');
assert.equal(req.filters.creator_user_id,'owner-A');
deleteMode='error';
await api.deletePaper('paper-A');
assert.equal(logged.length,1,'Denied DELETE falsely reported success');
deleteMode='confirmed';
await api.deletePaper('paper-A');
assert.equal(logged.length,2,'Confirmed DELETE was not acknowledged');
assert.equal(logged[1][0],'Paper deleted.');
assert.equal(preview.innerHTML,'','Deleted paper editor remained visible');
assert.equal(records.length,0);
console.log('Paper write confirmation PASS: own-institute RLS selectors, zero-row and denied responses, cross-account late response, confirmed update/delete, and closing deleted editor.');
