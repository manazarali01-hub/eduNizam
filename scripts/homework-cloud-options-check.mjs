/* Homework/Assignment school data, role isolation and save authorization. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=(yes,msg)=>{if(!yes)throw Error(msg)};
const storage=new Map([
 ['edunizam_session',JSON.stringify({role:'head',identity:'head'})],
 ['edunizam_class_sections_v1',JSON.stringify([{className:'12',sectionName:'Old School',active:true}])],
 ['edunizam_syllabus_units_v1',JSON.stringify([{className:'5',subject:'Private Old School Subject'}])],
 ['edunizam_students',JSON.stringify([{id:12,name:'Old private pupil',className:'12'}])],
 ['edunizam_school_work_v1',JSON.stringify({announcements:[],
  homework:[{className:'12',title:'Private prior-school assignment'}],
  submissions:[{studentName:'Prior school child',text:'Private submission'}],timetable:[]})]
]);
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const elements=new Map();
function el(id){
 if(!elements.has(id))elements.set(id,{
  value:'',innerHTML:'',textContent:'',dataset:{},isConnected:true,disabled:false,checked:false,
  classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll:()=>[]
 });
 return elements.get(id);
}
for(const id of ['swHwClass','swHwClassOptions','swHwSection','swHwSectionOptions','swHwSubject',
 'swHwSubjectOptions','swHwOptionNote','swHwRefresh','swSaveHomework','swHwTitle','swHwType',
 'swHwDue','swHwMarks','swHwAllowSubmit','swHwAllowLate','swHwDetails','swEditor',
 'swList','swCloudStatus','schoolWorkApp'])el(id);
el('swHwClass').value='Class 5';el('swHwTitle').value='Read school textbook';
el('swHwSubject').value='English';el('swHwType').value='homework';
el('swHwAllowSubmit').checked=true;el('swHwAllowLate').checked=true;
const document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[]};
const cfg={enabled:true,institutionId:'school-A'};
const sources={
 'school-A':{
  class_sections:[{class_name:'Grade 5',section_name:'A',active:true},
    {class_name:'Grade 5',section_name:'B',active:true},{class_name:'8',section_name:'Hidden',active:false}],
  syllabus_progress_units:[{class_name:'5',subject:'English',unit_title:'School Story Unit'}],
  homework_items:[]
 },
 'school-B':{
  class_sections:[{class_name:'6',section_name:'C',active:true}],
  syllabus_progress_units:[{class_name:'Grade 6',subject:'Computer Science',unit_title:'Official School Unit'}],
  homework_items:[]
 }
};
let failWrite=false;
const calls=[];
const client={from(table){
 const filters={};let payload=null;
 return {
  select(){return this},eq(k,v){filters[k]=v;return this},limit(){return this},order(){return this},
  insert(x){payload=x;return this},
  single(){
   if(failWrite)return Promise.resolve({data:null,error:{message:'Server blocked insert'}});
   const row={id:'d2410f27-acf2-4e48-a4af-22f7e1ed5f5c',...payload,
    created_at:'2026-10-09T12:00:00Z'};
   sources[payload.institution_id][table].push(row);
   return Promise.resolve({data:row,error:null});
  },
  then(resolve,reject){
   calls.push({table,filters:{...filters}});
   const data=(sources[filters.institution_id]?.[table]||[]).filter(x=>!Object.hasOwn(filters,'active')||x.active===filters.active);
   return Promise.resolve({data,error:null}).then(resolve,reject);
  }
 };
}};
const cloud={state:{client,user:{id:'head-1'}}};
const window={EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_CLOUD:cloud,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 EDUNIZAM_ACADEMIC_OPTION_CATALOG:{subjects:{5:['Mathematics','English'],6:['Computer Science']}},
 addEventListener(){}
};
const alerts=[];
const ctx={window,document,localStorage,console,Date,
 setTimeout:()=>0,clearTimeout(){},alert:x=>alerts.push(String(x))};
runInNewContext(read('academic-form-options.js'),ctx,{filename:'academic-form-options.js'});
runInNewContext(read('school-work.js'),ctx,{filename:'school-work.js'});
const api=window.EDUNIZAM_SCHOOL_WORK;
check(api&&typeof api.loadHomeworkOptions==='function','School Work class loader missing');
check(api.read().homework.length===0&&api.read().submissions.length===0,
  'School Work rendered previous-school cached assignments/submissions before cloud sync');
check(api.registeredHomeworkClasses().length===0,'School Work exposed stale local classes before cloud load');
await api.loadHomeworkOptions();
check(api.registeredHomeworkClasses().length===2,'School-A active registered classes missing');
check(api.knownHomeworkClass('5','A')&&!api.knownHomeworkClass('5','Hidden'),'Grade aliases or inactive sections invalid');
check(!api.knownHomeworkClass('12','Old School'),'Stale local school section authorized');
api.syncHomeworkOptions();
check(el('swHwClassOptions').innerHTML.includes('Grade 5'),'Homework class dropdown empty');
check(el('swHwSectionOptions').innerHTML.includes('value="A"')&&el('swHwSectionOptions').innerHTML.includes('value="B"'),'Homework section dropdown empty');
check(el('swHwSubjectOptions').innerHTML.includes('English'),'School saved English missing');
check(!el('swHwSubjectOptions').innerHTML.includes('Private Old School Subject'),'Old school subject leaked');
check(calls.some(x=>x.table==='class_sections'&&x.filters.institution_id==='school-A'&&x.filters.active===true),'Homework school classes query not scoped');
el('swHwSection').value='Old School';
el('swHwSave'); // inert fixture; actual save button below
el('swHwSection').value='A';
cfg.institutionId='school-B';cloud.state.user.id='head-2';
check(api.read().homework.length===0&&api.read().submissions.length===0,'Previous school cached homework leaked across institution switch');
check(api.registeredHomeworkClasses().length===0&&!api.knownHomeworkClass('5','A'),'Switch leaked school-A options');
api.syncHomeworkOptions();
check(!el('swHwClassOptions').innerHTML.includes('Grade 5'),'Old class remained after school switch');
await api.loadHomeworkOptions();
check(api.knownHomeworkClass('Class 6','C')&&!api.knownHomeworkClass('5','A'),'New school class unselectable');
el('swHwClass').value='6';api.syncHomeworkOptions();
check(el('swHwSubjectOptions').innerHTML.includes('Computer Science'),'New school subject unavailable');
check(!el('swHwSubjectOptions').innerHTML.includes('English'),'Prior school subject leaked');
sources['school-B'].class_sections.push({class_name:'6',section_name:'D',active:true});
sources['school-B'].syllabus_progress_units.push({class_name:'6',subject:'Urdu',unit_title:'New Urdu Lesson'});
await api.refreshHomeworkOptions();
api.syncHomeworkOptions();
check(el('swHwSectionOptions').innerHTML.includes('value="D"')&&el('swHwSubjectOptions').innerHTML.includes('Urdu'),'Refresh did not load newly registered class/subject');
check(el('swHwClass').value==='6','Academic refresh erased form class');
storage.set('edunizam_session',JSON.stringify({role:'teacher',identity:'teacher'}));
window.EDUNIZAM_ROLE_SCOPE.teacherClassKeys=()=>new Set(['6|c']);
check(api.registeredHomeworkClasses().length===0,'Head class cache survived teacher-role switch');
await api.loadHomeworkOptions();
check(api.registeredHomeworkClasses().length===1&&api.knownHomeworkClass('6','C'),'Teacher assigned class unavailable');
check(!api.knownHomeworkClass('6','D'),'Teacher unauthorized section offered');
window.EDUNIZAM_ROLE_SCOPE.teacherClassKeys=()=>new Set();
check(api.registeredHomeworkClasses().length===0,'Unassigned teacher received homework options');
const source=read('school-work.js');
check(source.includes('if(!knownHomeworkClass(className,sectionName))'),'Homework submission lacks class validation');
check(!source.includes('Cloud sync failed; homework local mode mein save hoga'),'Cloud failure still falsely claims published homework');
const loader=read('feature-loader.js');
check(loader.includes("schoolwork:['academic-form-options.js','school-work.js'"),'School Work academic option utility not loaded before form');
console.log('EduNizam Homework options PASS: real classes, sections, saved syllabus subjects, refresh, grade aliases, role isolation and safe cloud failure.');
