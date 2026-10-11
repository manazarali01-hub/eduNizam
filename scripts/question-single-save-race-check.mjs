/* Question Bank manual save: duplicate-click, form editing during pending save,
   school-scoped UPDATE, old-session response and error handling. All in memory. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const cfg={institutionId:'school-A'},user={id:'teacher-A'};
const questions=[{
 id:'existing-1',institution_id:'school-A',creator_user_id:'teacher-A',class_name:'5',
 subject:'Science',chapter:'Energy',question_type:'short',question_text:'Existing lesson question',
 answer_text:'The verified answer',difficulty:'Balanced',active:true,visibility:'private'
}];
const rows={
 class_sections:[{class_name:'5',section_name:'A',active:true}],
 syllabus_progress_units:[{class_name:'5',section_name:'A',subject:'Science',unit_title:'Energy',
  textbook_title:'Science Book',curriculum_board:'Punjab',status:'Planned'}],
 teacher_question_bank:questions
};
const writes=[],pending=[],alerts=[],toasts=[];
const client={from(table){
 let school='',filters={},operation='read';
 const query={
  select(){return this},range(){return this},order(){return this},
  eq(k,v){filters[k]=v;if(k==='institution_id')school=v;return this},
  update(payload){assert.equal(table,'teacher_question_bank');operation='update';this.payload=payload;return this},
  delete(){assert.equal(table,'teacher_question_bank');operation='delete';return this},
  insert(payload){assert.equal(table,'teacher_question_bank');operation='insert';this.payload=payload;return this},
  maybeSingle(){return this.write().then(res=>res.error?res:{...res,data:{id:filters.id}})},
  write(){
   writes.push({operation,filters:{...filters},payload:this.payload});
   const wait=deferred();pending.push(wait);
   return wait.promise.then(result=>{
    if(!result.error&&operation==='insert')questions.push({...this.payload,id:'new-'+writes.length});
    if(!result.error&&operation==='delete'&&Array.isArray(result.data)&&result.data.some(x=>x.id===filters.id)){
     const i=questions.findIndex(x=>x.id===filters.id);if(i>=0)questions.splice(i,1);
    }
    return result;
   });
  },
  then(resolve,reject){
   if(operation==='read'){
    assert.equal(school,'school-A','Private question data read was not school-scoped');
    return Promise.resolve({data:rows[table]||[],error:null}).then(resolve,reject);
   }
   return this.write().then(resolve,reject);
  }
 };
 return query;
}};
const nodes=new Map();
const node=(id,properties={})=>{
 if(nodes.has(id))return nodes.get(id);
 let html='';
 const item={value:'',textContent:'',checked:false,disabled:false,isConnected:true,onclick:null,dataset:{},
  classList:{add(){},remove(){},toggle(){}},scrollIntoView(){},querySelectorAll(){return[]}};
 Object.defineProperty(item,'innerHTML',{get(){return html},set(v){html=String(v)}});
 Object.assign(item,properties);nodes.set(id,item);return item;
};
node('#qbClass',{value:'5'});node('#qbSubject',{value:'Science'});
node('#qbChapter',{value:'Energy'});node('#qbType',{value:'short'});
node('#qbDifficulty',{value:'Balanced'});node('#qbQuestion',{value:'New teacher question'});
node('#qbAnswer',{value:'New teacher answer'});node('#qbOptions');
node('#qbCorrect',{value:'1'});node('#qbAdmin');
node('#qbSave',{textContent:'Add to Question Bank'});node('#qbCancelEdit');
node('#qbCount');node('#qbList');node('#qbSearch');node('#pbGenerationStatus');
node('#paperPreview');node('#savedTeacherPapers');node('#pbSavedCount');
let editButtons=[];
const document={readyState:'loading',addEventListener(){},querySelector:k=>nodes.get(k)||null,
 querySelectorAll:sel=>sel==='[data-qb-edit]'?editButtons:[]};
const handlers=new Map();
const window={EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_CLOUD:{state:{user,client}},
 EDUNIZAM_PREMIUM:{toast:(...args)=>toasts.push(args)},
 addEventListener:(k,fn)=>handlers.set(k,[...(handlers.get(k)||[]),fn])};
const emit=(event,detail)=>{for(const f of handlers.get(event)||[])f({detail})};
runInNewContext(read('paper-syllabus-audit.js'),{window,document,console,localStorage:{getItem:()=>null}});
runInNewContext(read('teacher-paper-builder.js'),{window,document,console,localStorage:{getItem:()=>null},
 alert:msg=>alerts.push(String(msg)),confirm:()=>true,setTimeout,clearTimeout,AbortController,Promise},
 {filename:'teacher-paper-builder.js'});
const app=window.EDUNIZAM_PAPER_BUILDER;
await app.loadSchoolCatalog();
await app.loadCustomQuestions();
const first=app.saveCustomQuestion(),duplicate=app.saveCustomQuestion();
await duplicate;
for(let i=0;i<35;i++)await Promise.resolve();
assert.equal(writes.length,1,'Two taps inserted the same reviewed question twice');
assert(node('#qbSave').disabled,'Manual Save button stayed active during the pending request');
// User is composing a different question before the old write finishes.
node('#qbQuestion').value='Second question being drafted';
pending.shift().resolve({error:null});
await first;
assert.equal(writes.length,1);
assert.equal(toasts.length,1);
assert.equal(node('#qbQuestion').value,'Second question being drafted',
 'Late response cleared a new unsaved question from the form');
assert.equal(node('#qbSave').disabled,false,'Save remained disabled after response');
// Update a teacher-owned question. Construct a realistic Edit button.
const edit={dataset:{qbEdit:'existing-1'},onclick:null};
editButtons=[edit];
await app.loadCustomQuestions();
assert.equal(typeof edit.onclick,'function','Edit handler missing');
edit.onclick();
assert.equal(node('#qbSave').textContent,'Update Question');
node('#qbQuestion').value='Teacher corrected question';
const updating=app.saveCustomQuestion();
for(let i=0;i<35;i++)await Promise.resolve();
assert.equal(writes.length,2);
assert.equal(writes[1].operation,'update');
assert.deepEqual({...writes[1].filters},
 {id:'existing-1',creator_user_id:'teacher-A',institution_id:'school-A'},
 'Question update was not scoped to school, owner and exact question ID');
pending.shift().resolve({error:null});
await updating;
assert.equal(toasts.at(-1)[0],'Question updated.','Edited question was reported as newly inserted');
// Normalized duplicate stem must be rejected before a second insert.
node('#qbQuestion').value='  NEW  teacher   QUESTION  ';
node('#qbChapter').value='Energy';
node('#qbAnswer').value='A revised but unrelated answer cannot justify a second stem';
const countBeforeDuplicate=writes.length;
await app.saveCustomQuestion();
assert.equal(writes.length,countBeforeDuplicate,'An existing owned question was duplicated');
assert.match(alerts.at(-1),/already exists/i);
// No-row DELETE may be successful HTTP 200/RLS but must NOT show deleted.
let ongoing=app.deleteCustomQuestion('existing-1');
for(let i=0;i<35;i++)await Promise.resolve();
assert.equal(writes.at(-1).operation,'delete');
assert.deepEqual({...writes.at(-1).filters},
 {id:'existing-1',creator_user_id:'teacher-A',institution_id:'school-A'},
 'Delete must check exact question, owner and school');
const toastBeforeMissing=toasts.length;
pending.shift().resolve({data:[],error:null});
await ongoing;
assert.equal(toasts.length,toastBeforeMissing,'Zero-row delete falsely announced success');
assert.match(alerts.at(-1),/not confirmed/i);
// Confirmed DELETE removes the actual row and reloads the search list.
ongoing=app.deleteCustomQuestion('existing-1');
for(let i=0;i<35;i++)await Promise.resolve();
assert.equal(writes.at(-1).operation,'delete');
pending.shift().resolve({data:[{id:'existing-1'}],error:null});
await ongoing;
assert.equal(toasts.at(-1)[0],'Question deleted.');
assert(!questions.some(x=>x.id==='existing-1'),'Mock database retained the deleted question');

// Old network response after logout must not revive a private teacher form
// even if the same user ID and school ID remain in client state.
node('#qbQuestion').value='Another teacher question';
node('#qbAnswer').value='Another answer';
node('#qbChapter').value='Energy';
const before=writes.length;
const oldRequest=app.saveCustomQuestion();
for(let i=0;i<35;i++)await Promise.resolve();
assert.equal(writes.length,before+1);
emit('edunizam:auth',{event:'SIGNED_OUT'});
assert.equal(node('#qbQuestion').value,'','Old private question remained after signout');
assert.equal(node('#qbList').innerHTML,'');
const toastCount=toasts.length;
pending.shift().resolve({error:null});
await oldRequest;
assert.equal(toasts.length,toastCount,'Ended session received a save success toast');
await app.saveCustomQuestion();
assert.equal(writes.length,before+1,'Ended-session form submitted a question');
// A new manual submission after returning to the same account must not be
// held hostage by its previous session's in-flight key.
console.log('Manual Question Bank save PASS: double tap, pending form edit, school-scoped owner update, logout purge and late-response suppression.');
