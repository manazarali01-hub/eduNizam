/* Direct-open Lesson Planner uses current school's live class/section records.
 * Must not depend on visiting Academic Groups or stale localStorage first. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=(v,msg)=>{if(!v)throw Error(msg)};
const values=new Map([
 ['edunizam_session',JSON.stringify({role:'head'})],
 ['edunizam_class_sections_v1',JSON.stringify([{className:'9',sectionName:'Stale local section',active:true}])],
 ['edunizam_students','[]']
]);
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const cfg={enabled:true,institutionId:'schoolA'};
const directory={
 schoolA:[
  {class_name:'5',section_name:'A',active:true},
  {class_name:'Grade 5',section_name:'B',active:true},
  {class_name:'7',section_name:'Inactive',active:false}
 ],
 schoolB:[{class_name:'6',section_name:'C',active:true}]
};
const calls=[];
let failLessonTables=false;
function query(table){
 const filters={};
 const q={
  select(){return this},
  eq(k,v){filters[k]=v;return this},
  order(){return this},
  limit(){return this},
  abortSignal(){return this},
  then(resolve,reject){
   calls.push({table,filters:{...filters}});
   const rows=(table==='class_sections'?directory[filters.institution_id]||[]:[])
     .filter(x=>!Object.hasOwn(filters,'active')||x.active===filters.active);
   return Promise.resolve(failLessonTables&&table==='lesson_plans'
     ?{data:null,error:{message:'Lesson table unavailable'}}
     :{data:rows,error:null}).then(resolve,reject);
  }
 };
 return q;
}
const cloud={state:{user:{id:'head1'},client:{from:query}}};
const window={
 EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_CLOUD:cloud,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 addEventListener(){}
};
const document={getElementById:()=>null,querySelectorAll:()=>[]};
const ctx={window,document,localStorage,console,setTimeout:()=>0,clearTimeout(){}};
runInNewContext(read('academic-form-options.js'),ctx,{filename:'academic-form-options.js'});
runInNewContext(read('lesson-plan-center.js'),ctx,{filename:'lesson-plan-center.js'});
const api=window.EDUNIZAM_LESSON_CENTER;
check(api&&api.cloudReady(),'Lesson Planner cloud option API missing');
check(api.classOptions().length===0,'Cloud mode wrongly trusted stale local academic class');
await api.pullCloud();
const a=api.registeredClasses();
check(a.length===2,'Lesson Planner did not fetch school A live active sections');
check(a.some(x=>x.className==='5'&&x.sectionName==='A'),'Missing school A class 5 section A');
check(a.some(x=>x.className==='Grade 5'&&x.sectionName==='B'),'Missing school A Grade 5 section B');
check(!a.some(x=>x.className==='9'||x.sectionName==='Inactive'),'Inactive or stale class appeared in Lesson Planner');
check(calls.some(x=>x.table==='class_sections'&&x.filters.institution_id==='schoolA'&&x.filters.active===true),'Class data query was not scoped to active sections and institution');
check(api.classOptions().length===2,'Live school class names not offered for direct-open Lesson Planner');
cfg.institutionId='schoolB';
check(api.classOptions().length===0,'Previous school class options survived institution switch');
await api.pullCloud();
const b=api.registeredClasses();
check(b.length===1&&b[0].className==='6'&&b[0].sectionName==='C','School switch failed to populate current school directory');
cloud.state.user.id='head2';
check(api.classOptions().length===0,'Previous user class options survived account switch');
await api.pullCloud();
check(api.classOptions().length===1&&api.classOptions()[0]==='6','Current user did not load fresh school class options');
// Access to the lesson table can fail while the school class directory still
// succeeds. Users must still get genuine class options and never other schools.
directory.schoolC=[{class_name:'8',section_name:'D',active:true}];
cfg.institutionId='schoolC';
failLessonTables=true;
let failed=false;
try{await api.pullCloud()}catch(_){failed=true}
check(failed,'Test fixture did not simulate failed lesson table access');
check(api.classOptions().join('|')==='8','Failed lesson table hid available school C class dropdown');
check(!api.registeredClasses().some(x=>x.className==='6'||x.className==='9'),'Failed fetch fell back to stale unrelated school classes');
const lessonCode=read('lesson-plan-center.js');
check(lessonCode.includes('cloudLessonScope!==currentSchoolScope()')&&lessonCode.includes('scoped?[]:read(PLAN_KEY)')&&lessonCode.includes('scoped?[]:read(UNIT_KEY)'),'Lesson/syllabus cards can leak stale cached records on a school switch');
console.log('EduNizam Lesson Planner cloud class dropdown PASS: direct-open active directory, school/user isolation, inaccessible lesson tables, no stale local fallback.');
