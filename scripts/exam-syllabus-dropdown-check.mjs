/* Exam Center subjects are current-school syllabus records, not old local
 * cache, while official-looking reference subjects remain labeled suggestions. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ok=(value,message)=>{if(!value)throw Error(message)};
const storage=new Map([
 ['edunizam_session',JSON.stringify({role:'head'})],
 ['edunizam_syllabus_units_v1',JSON.stringify([{className:'5',subject:'Previous School Secret'}])],
 ['edunizam_class_sections_v1',JSON.stringify([{className:'5',sectionName:'Old School'}])]
]);
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const elements=new Map();
function node(id){
 if(!elements.has(id))elements.set(id,{
  id,value:'',innerHTML:'',textContent:'',disabled:false,isConnected:true,
  dataset:{},addEventListener(){},classList:{add(){},remove(){}}
 });
 return elements.get(id);
}
for(const id of ['exClass','exSubjectOptions','exSubjectNote','exSectionOptions','exClassOptions','exRefreshAcademic'])node(id);
node('exClass').value='Class 5';
const document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[]};
const cfg={enabled:true,institutionId:'school-A'};
const schoolData={
 'school-A':{
  class_sections:[{class_name:'5',section_name:'A',active:true},{class_name:'5',section_name:'B',active:true}],
  syllabus_progress_units:[
   {class_name:'Grade 5',subject:'Science',unit_title:'School-recorded matter'},
   {class_name:'5',subject:'Computer Science',unit_title:'Local ICT'},
   {class_name:'6',subject:'Punjabi',unit_title:'Other grade'}
  ]
 },
 'school-B':{
  class_sections:[{class_name:'Grade 5',section_name:'C',active:true}],
  syllabus_progress_units:[{class_name:'5',subject:'Geography',unit_title:'Local geography'}]
 }
};
const calls=[];
let denySyllabus=false;
const client={from(table){
 const filters={};
 const q={
  select(){return this},eq(k,v){filters[k]=v;return this},limit(){return this},
  then(resolve,reject){
   calls.push({table,filters:{...filters}});
   if(table==='syllabus_progress_units'&&denySyllabus)return Promise.resolve({data:null,error:{message:'Permission denied'}}).then(resolve,reject);
   const data=(schoolData[filters.institution_id]?.[table]||[]).filter(x=>!Object.hasOwn(filters,'active')||x.active===filters.active);
   return Promise.resolve({data,error:null}).then(resolve,reject);
  }
 };
 return q;
}};
const cloud={state:{client,user:{id:'head-1'}}};
const window={
 EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:cfg,
 EDUNIZAM_ACADEMIC_OPTION_CATALOG:{subjects:{5:['Mathematics','English'],6:['Urdu']}},
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 addEventListener(){}
};
const context={window,document,localStorage,Date,console,setTimeout:()=>0,clearTimeout(){}};
runInNewContext(read('academic-form-options.js'),context,{filename:'academic-form-options.js'});
runInNewContext(read('exam-center.js'),context,{filename:'exam-center.js'});
const api=window.EDUNIZAM_EXAM_CENTER;
ok(api&&typeof api.loadExamSubjects==='function','Exam Center school subject loader not available');
api.syncExamSubjects();
ok(!node('exSubjectOptions').innerHTML.includes('Previous School Secret'),'Old local syllabus leaked before cloud data loaded');
await Promise.all([api.loadClassDirectory(),api.loadExamSubjects()]);
api.syncExamSubjects();
const first=node('exSubjectOptions').innerHTML;
ok(first.includes('Mathematics')&&first.includes('English'),'Reference subjects disappeared');
ok(first.includes('Science')&&first.includes('Computer Science'),'Current school saved subjects missing');
ok(!first.includes('Previous School Secret')&&!first.includes('Punjabi'),'Unrelated school or grade subjects leaked');
ok(node('exSubjectNote').textContent.includes('2 school-recorded subject'),'Saved subjects not clearly identified as school records');
ok(node('exSectionOptions').innerHTML.includes('value="A"')&&node('exSectionOptions').innerHTML.includes('value="B"'),'Registered school sections missing');
ok(calls.some(x=>x.table==='syllabus_progress_units'&&x.filters.institution_id==='school-A'),'Syllabus query lacks institution scope');
cfg.institutionId='school-B';cloud.state.user.id='head-2';
api.syncExamSubjects();
const before=node('exSubjectOptions').innerHTML;
ok(!before.includes('Computer Science')&&!before.includes('Science'),'Previous school subjects leaked on institution switch');
await Promise.all([api.loadClassDirectory(),api.loadExamSubjects()]);
api.syncExamSubjects();
const next=node('exSubjectOptions').innerHTML;
ok(next.includes('Geography')&&!next.includes('Science')&&!next.includes('Computer Science'),'School-B subjects incorrectly merged with school-A');
ok(node('exSectionOptions').innerHTML.includes('value="C"')&&!node('exSectionOptions').innerHTML.includes('value="A"'),'Wrong school sections still visible');
ok(node('exClass').value==='Class 5','Subject refresh must preserve current class input');
schoolData['school-B'].syllabus_progress_units.push({class_name:'Grade 5',subject:'Urdu',unit_title:'New assigned subject'});
schoolData['school-B'].class_sections.push({class_name:'Grade 5',section_name:'D',active:true});
await api.refreshAcademicOptions();
api.syncExamSubjects();
ok(node('exSubjectOptions').innerHTML.includes('Urdu'),'Refresh missed newly saved school subject');
ok(node('exSectionOptions').innerHTML.includes('value="D"'),'Refresh missed newly registered section');
ok(node('exClass').value==='Class 5','Refresh erased the in-progress exam class');
denySyllabus=true;
cfg.institutionId='school-A';cloud.state.user.id='head-3';
await api.loadExamSubjects();
api.syncExamSubjects();
ok(!node('exSubjectOptions').innerHTML.includes('Geography')&&!node('exSubjectOptions').innerHTML.includes('Science'),'Failed lookup reused cached school subject records');
ok(node('exSubjectNote').textContent.includes('network/access'),'Permission error not explained in subject picker');
console.log('EduNizam Exam Syllabus PASS: actual school subjects, grade aliases, refresh without form reset, school/account isolation, permission errors.');
