/* Lesson Center must use every accessible page before validating syllabus imports. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const storage=new Map([['edunizam_session',JSON.stringify({role:'head'})]]);
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
const project={enabled:true,institutionId:'school-A'},user={id:'head-A'};
const data={
 'school-A':{
  class_sections:Array.from({length:305},(_,i)=>({id:'c'+String(i).padStart(5,'0'),class_name:'5',section_name:'S'+i,active:true})),
  lesson_plans:Array.from({length:1002},(_,i)=>({id:'p'+String(i).padStart(5,'0'),class_name:'5',section_name:'S0',subject:'Science',week_start:'2026-10-12',topic:'Actual School Topic '+i,status:'Planned'})),
  syllabus_progress_units:Array.from({length:1103},(_,i)=>({id:'u'+String(i).padStart(5,'0'),class_name:'5',section_name:'S0',
   subject:'General Science',unit_title:'Recorded Chapter '+i,textbook_title:'School-supplied book',
   curriculum_board:'punjab-pectaa',status:'Planned',completion_percent:0}))
 },
 'school-B':{
  class_sections:[{id:'b-class',class_name:'6',section_name:'B',active:true}],
  lesson_plans:[],syllabus_progress_units:[]
 }
};
const calls=[];let denySyllabusPage=false,denyClassPage=false;
const client={from(table){
 const filters={};
 const q={
  select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},abortSignal(){return this},
  limit(n){this.limitSize=n;return this},
  range(a,b){this.fromIndex=a;this.toIndex=b;return this},
  then(resolve,reject){
   const start=this.fromIndex??0,end=this.toIndex??(this.limitSize||250)-1;
   calls.push({table,school:filters.institution_id,start,end,active:filters.active});
   if((table==='syllabus_progress_units'&&denySyllabusPage&&start===250)||
      (table==='class_sections'&&denyClassPage&&start===250))
    return Promise.resolve({error:{message:'Simulated second-page read failure'}}).then(resolve,reject);
   const rows=(data[filters.institution_id]?.[table]||[])
    .filter(x=>!Object.hasOwn(filters,'active')||x.active===filters.active)
    .slice(start,end+1);
   return Promise.resolve({data:rows,error:null}).then(resolve,reject);
  }
 };
 return q;
}};
const window={
 EDUNIZAM_CLOUD:{state:{user,client}},
 EDUNIZAM_CLOUD_CONFIG:project,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 addEventListener(){}
};
const document={getElementById:()=>null,querySelectorAll:()=>[]};
const context={window,document,localStorage,AbortController,setTimeout,clearTimeout,console,Promise};
runInNewContext(read('academic-form-options.js'),context,{filename:'academic-form-options.js'});
runInNewContext(read('lesson-plan-center.js'),context,{filename:'lesson-plan-center.js'});
const api=window.EDUNIZAM_LESSON_CENTER;
assert.equal(api.classesVerified(),false,'Unfetched directory must not be treated as verified');
assert.equal(api.syllabusVerified(),false,'Unfetched syllabus must not be treated as verified');
await api.pullCloud();
assert.equal(api.classesVerified(),true);
assert.equal(api.syllabusVerified(),true);
assert.equal(api.registeredClasses().length,305,'Lesson class options silently truncated');
assert.equal(api.savedUnits().length,1103,'Saved syllabus silently truncated at default Data API page');
assert(api.recordedSchoolTopic('5','S0','Science','Recorded Chapter 1102'),'Late textbook chapter unavailable to teacher');
const savedPlans=JSON.parse(storage.get('edunizam_lesson_plans_v1'));
assert.equal(savedPlans.length,1002,'Lesson planning silently lost later cloud records');
assert(calls.some(x=>x.table==='syllabus_progress_units'&&x.start===1000),'Syllabus fifth page was not read');
assert(calls.some(x=>x.table==='lesson_plans'&&x.start===1000),'Lesson plans fifth page was not read');
assert(calls.some(x=>x.table==='class_sections'&&x.start===250),'Class sections second page missing');
assert(calls.every(x=>x.school==='school-A'&&x.end-x.start+1===250),'Missing institution scope or wrong page boundaries');
denySyllabusPage=true;
await assert.rejects(()=>api.pullCloud(),/Simulated second-page/);
assert.equal(api.syllabusVerified(),false,'Failed later syllabus page left cache marked complete');
assert.equal(api.savedUnits().length,0,'Failed later page exposed a stale previous syllabus');
denySyllabusPage=false;
await api.pullCloud();
assert.equal(api.savedUnits().length,1103,'Full syllabus cannot recover after a partial-page failure');
denyClassPage=true;
await api.pullCloud();
assert.equal(api.classesVerified(),false,'Failed class directory page was presented as verified');
assert.equal(api.registeredClasses().length,0,'Partial class directory was used for syllabus import');
assert.equal(api.syllabusVerified(),true,'Independent successful syllabus reads should remain available');
denyClassPage=false;
project.institutionId='school-B';user.id='head-B';
assert.equal(api.registeredClasses().length,0,'Previous school class directory leaked');
assert.equal(api.savedUnits().length,0,'Previous school syllabus cache leaked');
await api.pullCloud();
assert.equal(api.classesVerified(),true);
assert.equal(api.syllabusVerified(),true);
assert.equal(api.registeredClasses().length,1);
assert.equal(api.savedUnits().length,0);
const bCalls=calls.filter(x=>x.school==='school-B');
assert(bCalls.length>=3&&bCalls.every(x=>x.school==='school-B'));
const source=read('school-syllabus-csv.js');
assert.match(source,/classesVerified\?\.\(\)===false/,'Syllabus import must reject unverified class directory');
const huge=Array.from({length:501},(_,i)=>({id:'x'+i}));
const c={from:()=>({select(){return this},eq(){return this},order(){return this},range(a,b){this.a=a;this.b=b;return this},
 then(ok,bad){return Promise.resolve({data:huge.slice(this.a,this.b+1)}).then(ok,bad)}})};
await assert.rejects(()=>api.fetchAllSchoolRows(c,'syllabus_progress_units','*','school-A',{pageSize:250,maxRows:500}),/More than 500/);
console.log('Lesson full paging PASS: 305 class sections, 1002 plans, 1103 textbook chapters; no silent truncation, school isolation, failed-page rejection and recovery.');
