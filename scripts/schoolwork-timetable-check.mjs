/* School Work Timetable uses real school options and validates full periods.
 * A cloud failure must never create a false locally published period. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=(v,msg)=>{if(!v)throw Error(msg)};
const state=new Map([['edunizam_session',JSON.stringify({role:'head',identity:'head1'})],
 ['edunizam_school_work_v1',JSON.stringify({announcements:[],homework:[],submissions:[],timetable:[]})]]);
const localStorage={getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,String(v))};
const nodes=new Map();
function el(id){
 if(!nodes.has(id))nodes.set(id,{
  id,value:'',innerHTML:'',textContent:'',disabled:false,isConnected:true,dataset:{},checked:false,
  classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll:()=>[]
 });
 return nodes.get(id);
}
const ids=['swEditor','swList','swCloudStatus','schoolWorkApp','swSaveTimetable',
 'swTtClass','swTtClassOptions','swTtSection','swTtSectionOptions','swTtDay','swTtPeriod',
 'swTtTime','swTtEnd','swTtSubject','swTtSubjectOptions','swTtTeacher','swTtRoom','swTtRefresh','swTtOptionNote'];
for(const id of ids)el(id);
el('schoolWorkApp').dataset.tab='timetable';
const document={getElementById:id=>nodes.get(id)||null,querySelectorAll:()=>[]};
const cfg={enabled:true,institutionId:'school-A'};
const data={
 'school-A':{
  class_sections:[{class_name:'Grade 5',section_name:'A',active:true},{class_name:'5',section_name:'B',active:true}],
  syllabus_progress_units:[{class_name:'5',subject:'English',unit_title:'Reading School Book'}],
  timetable_entries:[],school_announcements:[],homework_items:[],homework_submissions:[]
 },
 'school-B':{
  class_sections:[{class_name:'8',section_name:'C',active:true}],
  syllabus_progress_units:[{class_name:'8',subject:'Chemistry',unit_title:'Chemical Bonds'}],
  timetable_entries:[],school_announcements:[],homework_items:[],homework_submissions:[]
 }
};
let failWrite=false,created=0;
const queries=[],writes=[];
const client={from(table){
 let payload=null,filters={};
 const query={
  select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},
  limit(){return this},insert(v){payload=v;return this},
  single(){
   writes.push({table,payload});
   if(failWrite)return Promise.resolve({data:null,error:{message:'Server rejected timetable insert'}});
   const item={...payload,id:'period-'+(++created),created_at:'2026-10-09T12:00:00Z'};
   data[payload.institution_id][table].push(item);
   return Promise.resolve({data:item,error:null});
  },
  then(resolve,reject){
   queries.push({table,filters:{...filters}});
   const rows=(data[filters.institution_id]?.[table]||[]).filter(x=>!Object.hasOwn(filters,'active')||x.active===filters.active);
   return Promise.resolve({data:rows,error:null}).then(resolve,reject);
  }
 };
 return query;
}};
const cloud={state:{client,user:{id:'head1'}}};
const window={
 EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:cfg,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 EDUNIZAM_ACADEMIC_OPTION_CATALOG:{subjects:{5:['English','Mathematics'],8:['Chemistry']}},
 addEventListener(){}
};
const alerts=[];
const ctx={window,document,localStorage,console,Date,setTimeout:()=>0,clearTimeout(){},alert:v=>alerts.push(String(v))};
runInNewContext(read('academic-form-options.js'),ctx,{filename:'academic-form-options.js'});
runInNewContext(read('school-work.js'),ctx,{filename:'school-work.js'});
const api=window.EDUNIZAM_SCHOOL_WORK;
check(api&&api.syncTimetableOptions&&api.timetableConflict&&api.periodMinutes,'Timetable data helpers not available');
check(Number.isNaN(api.periodMinutes('99:00'))&&api.periodMinutes('09:30')===570,'Time parser accepted invalid or rejected valid times');
await api.loadHomeworkOptions();
api.syncTimetableOptions();
check(el('swTtClassOptions').innerHTML.includes('Grade 5'),'Registered class picker empty');
check(!el('swTtClassOptions').innerHTML.includes('12'),'Unregistered class appeared');
el('swTtClass').value='Class 5';api.syncTimetableOptions();
check(el('swTtSectionOptions').innerHTML.includes('value="A"'),'Registered section missing');
check(el('swTtSubjectOptions').innerHTML.includes('English'),'School syllabus subject missing');
check(api.knownHomeworkClass('5','A')&&!api.knownHomeworkClass('5','Not registered'),'Class/section validation bypassed');
const source=read('school-work.js');
for(const id of ['swTtSection','swTtPeriod','swTtTime','swTtEnd','swTtSubject','swTtRoom'])
 check(source.includes('id="'+id+'"'),'Timetable required form field missing: '+id);
await api.pullCloud('timetable');
const setup={swTtClass:'5',swTtSection:'A',swTtDay:'Monday',swTtPeriod:'2',
 swTtTime:'09:40',swTtEnd:'10:20',swTtSubject:'English',swTtTeacher:'Ms Teacher',swTtRoom:'Room 1'};
function fill(vals=setup){for(const [k,v] of Object.entries(vals))el(k).value=String(v)}
fill();await api.render();
let save=el('swSaveTimetable').onclick;
check(typeof save==='function','Timetable Add Period button does not work');
fill();await save();
let rows=api.read().timetable;
check(rows.length===1,'Successful timetable period not stored');
check(rows[0].id==='period-1'&&rows[0].periodNumber===2&&rows[0].endTime==='10:20'&&rows[0].sectionName==='A','Server-confirmed period lost section/end time/number');
check(writes[0].payload.institution_id==='school-A'&&writes[0].payload.period_number===2&&writes[0].payload.section_name==='A'&&writes[0].payload.end_time==='10:20','Missing real timetable columns in cloud insert');
const count=rows.length;
fill();await save();
check(api.read().timetable.length===count&&alerts.some(x=>x.includes('clashes')),'Duplicate period was not blocked');
alerts.length=0;
fill({...setup,swTtPeriod:'3',swTtTime:'10:30',swTtEnd:'09:00'});await save();
check(api.read().timetable.length===count&&alerts.some(x=>x.includes('start/end')),'Invalid start/end accepted');
alerts.length=0;
fill({...setup,swTtSection:'C',swTtPeriod:'3',swTtTime:'10:30',swTtEnd:'11:00'});await save();
check(api.read().timetable.length===count&&alerts.some(x=>x.includes('registered')),'Unregistered section was saved');
alerts.length=0;failWrite=true;
fill({...setup,swTtPeriod:'3',swTtTime:'10:30',swTtEnd:'11:00'});await save();
check(api.read().timetable.length===count&&alerts.some(x=>x.includes('not saved')),'Failed cloud save falsely published period');
failWrite=false;alerts.length=0;
cfg.institutionId='school-B';cloud.state.user.id='head2';
check(api.registeredHomeworkClasses().length===0&&api.read().timetable.length===0,'Old school timetable/classes leaked on change');
await api.loadHomeworkOptions();
api.syncTimetableOptions();
check(!el('swTtSubjectOptions').innerHTML.includes('English'),'School A subject showed after switch');
el('swTtClass').value='8';api.syncTimetableOptions();
check(el('swTtSectionOptions').innerHTML.includes('value="C"')&&el('swTtSubjectOptions').innerHTML.includes('Chemistry'),'School B options unavailable');
await api.pullCloud('timetable');
check(api.read().timetable.length===0,'School B timetable unexpectedly has school A periods');
state.set('edunizam_session',JSON.stringify({role:'teacher',identity:'teacher1'}));
window.EDUNIZAM_ROLE_SCOPE.teacherClassKeys=()=>new Set(['8|c']);
await api.loadHomeworkOptions();
check(api.knownHomeworkClass('8','C'),'Teacher assigned section absent');
window.EDUNIZAM_ROLE_SCOPE.teacherClassKeys=()=>new Set();
check(!api.knownHomeworkClass('8','C'),'Teacher with no assignment could publish timetable');
console.log('EduNizam School Work Timetable PASS: real class section subject dropdowns, full cloud period fields, time/clash validation, failed save isolation, teacher scope.');
