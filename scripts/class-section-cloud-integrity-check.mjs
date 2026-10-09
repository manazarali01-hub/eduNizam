/* Class/section cloud-write contract and cross-school cache isolation.
 * Does not create or modify live school records. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../class-section-center.js',import.meta.url),'utf8');
const ok=(condition,message)=>{if(!condition)throw Error(message)};
const storage=new Map([['edunizam_class_sections_v1',JSON.stringify([{id:'old-school',className:'Secret',sectionName:'A'}])]]);
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
const database={
 A:{class_sections:[{id:'classA',institution_id:'A',class_name:'5',section_name:'A',active:true}],core_students:[{id:'studentA',student_code:'S-01',institution_id:'A',class_name:'5',section_name:'A'}]},
 B:{class_sections:[{id:'classB',institution_id:'B',class_name:'7',section_name:'B',active:true}],core_students:[]}
};
const actions=[];
let rowId=0;
const client={from(table){
 const state={table,action:'read',filters:{},payload:null};
 const query={
  select(){return this},
  eq(k,v){state.filters[k]=v;return this},
  order(){return this},
  update(payload){state.action='update';state.payload=payload;return this},
  insert(payload){state.action='insert';state.payload=payload;return this},
  delete(){state.action='delete';return this},
  abortSignal(){return this},
  single(){return Promise.resolve(execute()).then(v=>v.data?{data:v.data,error:null}:{data:null,error:{message:'No row returned'}})},
  maybeSingle(){return Promise.resolve(execute())},
  then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)}
 };
 const matches=r=>Object.entries(state.filters).every(([k,v])=>r[k]===v);
 function execute(){
  const institution=state.filters.institution_id??state.payload?.institution_id;
  const group=database[institution]?.[table]||[];
  const picked=group.filter(matches);
  actions.push([state.action,table,institution,{...state.filters}]);
  if(state.action==='read')return{data:picked.map(x=>({...x})),error:null};
  if(state.action==='insert'){
   const x={id:'new-'+(++rowId),...state.payload};
   if(group.some(y=>y.class_name===x.class_name&&y.section_name===x.section_name))return{data:null,error:{message:'Duplicate'}};
   group.push(x);return{data:{...x},error:null};
  }
  if(state.action==='update'){
   for(const row of picked)Object.assign(row,state.payload);
   const one=picked[0]||null;
   return{data:table==='core_students'?(one?{id:one.id}:null):one?{...one}:null,error:null};
  }
  if(state.action==='delete'){
   for(const row of picked){const i=group.indexOf(row);if(i>=0)group.splice(i,1)}
   return{data:picked.map(x=>({id:x.id})),error:null};
  }
 }
 return query;
}};
const cloud={state:{client,user:{id:'admin-A'}}};
const config={enabled:false,institutionId:'A'};
const window={
 EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:config,
 addEventListener(){},EDUNIZAM_STUDENT_PICKER:{options:()=>'',has:()=>true}
};
const document={getElementById:()=>null,querySelectorAll:()=>[]};
const errors=[];
const context={window,document,localStorage,Date,console,
 alert:x=>errors.push(String(x)),confirm:()=>true,setTimeout(){},clearTimeout(){}};
runInNewContext(source,context,{filename:'class-section-center.js',timeout:1800});
const app=window.EDUNIZAM_CLASS_SECTION_CENTER;
ok(!!app?.saveCloud&&!!app?.cacheScope,'Class Center verification API missing');
ok(app.read().length===0,'Legacy/unscoped local cache exposed as real school data');
await app.saveCloud({className:'9',sectionName:'A'}).then(()=>{throw Error('Offline save incorrectly succeeded')},()=>{});
ok(database.A.class_sections.length===1,'Offline data was inserted into school A');
config.enabled=true;
await app.pullCloud();
ok(app.read().length===1&&app.read()[0].className==='5','Did not load actual current-school cloud classes');
await app.saveCloud({id:'classA',cloudExisting:true,className:'6',sectionName:'C',active:true});
ok(database.A.class_sections.length===1&&database.A.class_sections[0].class_name==='6','Editing renamed class inserted duplicate rather than updating by id');
ok(actions.some(x=>x[0]==='update'&&x[1]==='class_sections'&&x[3].id==='classA'&&x[3].institution_id==='A'),'Edit request not constrained by row id + institution');
await app.saveCloud({className:'8',sectionName:'A',active:true});
ok(database.A.class_sections.length===2,'New class insert failed');
ok(!actions.some(x=>x[0]==='upsert'),'Blind name-based upsert should never overwrite another class');
await app.pullCloud();
ok(app.read().length===2,'Cloud class read did not refresh current-school cache');
await app.removeCloud('not-found').then(()=>{throw Error('Deleting missing class incorrectly succeeded')},()=>{});
ok(database.A.class_sections.length===2,'Missing delete mutated school records');
await app.removeCloud('new-1');
ok(database.A.class_sections.length===1,'Delete failed for actual class ID');
config.institutionId='B';cloud.state.user.id='admin-B';
ok(app.read().length===0,'School A class cache visible to School B before cloud fetch');
await app.pullCloud();
ok(app.read().length===1&&app.read()[0].id==='classB','School B cloud classes not fetched');
cloud.state.user.id='different-user-B';
ok(app.read().length===0,'School B cached directory exposed to another user');
config.institutionId='A';cloud.state.user.id='admin-A';
ok(app.read().length===0,'School B cache visible after switching back to School A');
localStorage.setItem('edunizam_students',JSON.stringify([{id:1,studentId:'S-01',name:'Student fixture'}]));
await app.assignCloud(1,'6','C');
ok(database.A.core_students[0].class_name==='6','Cloud student class assignment failed');
await app.assignCloud(2,'6','C');
await app.assignCloud(1,'6','C');
localStorage.setItem('edunizam_students',JSON.stringify([{id:3,studentId:'INVALID',name:'Unmatched fixture'}]));
await app.assignCloud(3,'6','C').then(()=>{throw Error('Unmatched student reported as saved')},()=>{});
ok(actions.some(x=>x[0]==='update'&&x[1]==='core_students'&&x[3].institution_id==='A'),'Student assignment omitted institution filter');
ok(source.includes('cacheScope()!==requestScope'),'In-flight cloud result lacks identity switch guard');
ok(!source.includes('.upsert(payload,{onConflict:'),'Class edit still uses unsafe name-based upsert');
console.log('Class/Section cloud integrity PASS: real save required, edit by id, no phantom delete/assign, account/school cache isolation.');
