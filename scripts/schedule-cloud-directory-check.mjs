/* Timetable/Date Sheet forms must use registered classes and syllabus from
 * the CURRENT cloud school. Local caches never authorize another school. */
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const check=(v,msg)=>{if(!v)throw Error(msg)};
const storage=new Map([
 ['edunizam_session',JSON.stringify({role:'head'})],
 ['edunizam_students',JSON.stringify([{id:44,name:'Stale student',className:'12',sectionName:'Stale'}])],
 ['edunizam_class_sections_v1',JSON.stringify([{className:'9',sectionName:'Local only',active:true}])],
 ['edunizam_syllabus_units_v1',JSON.stringify([{className:'5',subject:'Fake old school subject',unitTitle:'Unrelated'}])],
 ['edunizam_school_work_v1',JSON.stringify({timetable:[{className:'9',sectionName:'Old',subject:'Old School Secret',day:'Monday',periodNumber:1,time:'09:00',endTime:'09:30'}]})],
 ['edunizam_exam_schedule_v1',JSON.stringify([{className:'9',sectionName:'Old',subject:'Previous School Exam',examName:'Midterm',examDate:'2026-11-01'}])]
]);
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const nodes=new Map();
function el(id){
 if(!nodes.has(id))nodes.set(id,{id,value:'',innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){}},querySelectorAll:()=>[],addEventListener(){},setAttribute(){},removeAttribute(){},isConnected:true});
 return nodes.get(id);
}
const document={
 getElementById:id=>nodes.get(id)||null,createElement:tag=>({id:'',textContent:'',tag}),
 head:{appendChild(e){if(e.id)nodes.set(e.id,e)}},querySelectorAll:()=>[]
};
nodes.set('scheduleCenterApp',el('scheduleCenterApp'));
nodes.set('ttClass',el('ttClass'));nodes.set('ttSubjectOptions',el('ttSubjectOptions'));nodes.set('ttSubjectNote',el('ttSubjectNote'));nodes.set('ttSubject',el('ttSubject'));nodes.set('ttTeacherOptions',el('ttTeacherOptions'));nodes.set('ttTeacherNote',el('ttTeacherNote'));
const cfg={enabled:true,institutionId:'school-A'};
const samples={
 'school-A':{
  class_sections:[
   {class_name:'5',section_name:'A',active:true},
   {class_name:'Grade 5',section_name:'B',active:true},
   {class_name:'6',section_name:'Inactive',active:false}
  ],
  syllabus_progress_units:[
   {class_name:'Grade 5',subject:'English',unit_title:'Recorded Grammar'}
  ],
  staff_profiles:[
   {full_name:'School A Teacher',classes:['5|A'],subjects:['English'],employment_status:'active'},
   {full_name:'Section B Teacher',classes:['5|B'],subjects:['English'],employment_status:'active'},
   {full_name:'Retired Teacher',classes:['5|A'],subjects:['English'],employment_status:'inactive'}
  ],
  timetable_entries:[
   {id:'tt-a',class_name:'5',section_name:'A',subject:'English',weekday:'Monday',period_number:1,start_time:'09:00',end_time:'09:40',creator_user_id:'head1'}
  ],
  exam_schedule_entries:[
   {id:'ds-a',class_name:'5',section_name:'A',subject:'English',exam_name:'Monthly Test',exam_date:'2026-11-12',start_time:'09:00',end_time:'10:00',creator_user_id:'head1'}
  ]
 },
 'school-B':{
  class_sections:[{class_name:'8',section_name:'C',active:true}],
  syllabus_progress_units:[{class_name:'8',subject:'Chemistry',unit_title:'Recorded Chemistry'}],
  staff_profiles:[
   {full_name:'School B Chemistry',classes:['8|C'],subjects:['Chemistry'],employment_status:'active'},
   {full_name:'School B English',classes:['8|D'],subjects:['English'],employment_status:'active'}
  ],
  timetable_entries:[{id:'tt-b',class_name:'8',section_name:'C',subject:'Chemistry',weekday:'Tuesday',period_number:2,start_time:'10:00',end_time:'10:40',creator_user_id:'head2'}],
  exam_schedule_entries:[{id:'ds-b',class_name:'8',section_name:'C',subject:'Chemistry',exam_name:'Final',exam_date:'2026-11-13',start_time:'09:00',end_time:'10:00',creator_user_id:'head2'}]
 }
};
const calls=[];
const client={from(table){
 const filters={};let insertPayload=null;
 return {
  select(){return this},eq(k,v){filters[k]=v;return this},limit(){return this},order(){return this},
  insert(payload){insertPayload=payload;return this},
  single(){
    if(!insertPayload)return Promise.resolve({data:null,error:{message:'Missing insert'}});
    const row={...insertPayload,id:'e21b8a7e-a2ee-465d-9fbe-bb16c38ee45b'};
    samples[insertPayload.institution_id][table].push(row);
    return Promise.resolve({data:row,error:null});
  },
  then(resolve,reject){
   calls.push({table,filters:{...filters}});
   const rows=(samples[filters.institution_id]?.[table]||[]).filter(x=>!Object.hasOwn(filters,'active')||x.active===filters.active);
   return Promise.resolve({data:rows,error:null}).then(resolve,reject);
  }
 };
}};
const cloud={state:{client,user:{id:'head1'}}};
const window={
 EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_CLOUD:cloud,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 EDUNIZAM_ACADEMIC_OPTION_CATALOG:{subjects:{5:['Mathematics','English'],8:['Mathematics']}},
 addEventListener(){},open(){return null}
};
const alerts=[];
const ctx={window,document,localStorage,console,setTimeout:()=>0,clearTimeout(){},Date,AbortController,alert:msg=>alerts.push(String(msg)),confirm:()=>true};
runInNewContext(read('academic-form-options.js'),ctx,{filename:'academic-form-options.js'});
runInNewContext(read('timetable-date-sheet.js'),ctx,{filename:'timetable-date-sheet.js'});
const api=window.EDUNIZAM_TIMETABLE_DATESHEET;
check(!!api?.loadSchoolCatalog,'Timetable/Date Sheet cloud directory helper missing');
check(api.classSections().length===0,'Cloud mode trusted unscoped cached local class list');
check(!api.knownClass({className:'9',sectionName:'Local only'}),'Old school class authorized scheduling');
await api.render();
let classes=api.classSections();
check(classes.length===2,'Current school classes not loaded or inactive class leaked');
check(classes.some(x=>x.className==='5'&&x.sectionName==='A'),'School-A class 5/A missing');
check(classes.some(x=>x.className==='Grade 5'&&x.sectionName==='B'),'School-A Grade 5/B missing');
check(api.knownClass({className:'Class 5',sectionName:'A'}),'Equivalent whole-grade registered class rejected');
check(!api.knownClass({className:'5',sectionName:'Inactive'}),'Inactive class accepted for scheduling');
check(!api.knownClass({className:'9',sectionName:'Old'}),'Old school timetable wrongly treated as valid class');
check(api.optionList().includes('Class 5'),'Timetable dropdown has no real registered class options');
check(calls.some(q=>q.table==='class_sections'&&q.filters.institution_id==='school-A'&&q.filters.active===true),'Class directory was not scoped to active rows for current institution');
check(el('scheduleCenterApp').innerHTML.includes('English')&&!el('scheduleCenterApp').innerHTML.includes('Old School Secret')&&!el('scheduleCenterApp').innerHTML.includes('Previous School Exam'),'Current cloud schedule loaded stale old-school records');
el('ttClass').value='5|A';el('ttSubject').value='English';api.syncSubjectCatalog('tt');
check(el('ttSubjectOptions').innerHTML.includes('English')&&!el('ttSubjectOptions').innerHTML.includes('Fake old school subject'),'Subject suggestions use old school syllabus records');
check(api.scheduleReady()&&api.currentTimetable().length===1&&api.currentDateSheets().length===1,'Current-school schedule actions unavailable');
check(api.scheduleTeachers('5','A','English').join('|')==='School A Teacher','Schedule Center omitted active school-assigned teacher');
check(api.scheduleTeachers('5','B','English').join('|')==='Section B Teacher','Teacher class section scope not enforced');
check(el('ttTeacherOptions').innerHTML.includes('School A Teacher')&&!el('ttTeacherOptions').innerHTML.includes('Retired Teacher'),'Current school Teacher datalist missing or inactive staff leaked');
check(calls.some(x=>x.table==='staff_profiles'&&x.filters.institution_id==='school-A'),'Teacher directory query missed institution scope');
const before=api.getScheduleScope();
cfg.institutionId='school-B';
cloud.state.user.id='head2';
check(api.classSections().length===0&&!api.knownClass({className:'5',sectionName:'A'}),'School-A class options leaked on switch');
check(!api.scheduleReady()&&!api.currentTimetable().length&&!api.currentDateSheets().length,'Previous school schedule actions survived a switch');
check(api.scheduleTeachers('5','A','English').length===0,'School A staff names survived a school switch');
await api.render();
classes=api.classSections();
check(classes.length===1&&classes[0].className==='8','New institution registered class not loaded');
check(api.getScheduleScope()!==before,'Schedule scope was not refreshed for school/account switch');
const html=el('scheduleCenterApp').innerHTML;
check(html.includes('Chemistry')&&!html.includes('Old School Secret')&&!html.includes('Previous School Exam')&&!html.includes('English'),'New school timetable/date sheet mixed with prior school');
el('ttClass').value='8|C';el('ttSubject').value='Chemistry';api.syncSubjectCatalog('tt');
check(api.scheduleTeachers('8','C','Chemistry').join('|')==='School B Chemistry','School B assigned teacher not loaded');
check(!api.scheduleTeachers('8','C','Chemistry').includes('School A Teacher'),'School A staff leaked into school B');
check(el('ttSubjectOptions').innerHTML.includes('Chemistry')&&!el('ttSubjectOptions').innerHTML.includes('English'),'New school syllabus options leaked old school');
// Schools can add real sections/subjects while the app is open; refresh
// must load them without a full PWA reinstall or stale hidden dropdowns.
samples['school-B'].class_sections.push({class_name:'8',section_name:'D',active:true});
samples['school-B'].syllabus_progress_units.push({class_name:'8',subject:'English',unit_title:'New verified school unit'});
el('scheduleRefreshSchool');
await api.refreshSchoolOptions();
check(api.classSections().length===2&&api.knownClass({className:'Class 8',sectionName:'D'}),'Refresh options did not load newly registered class section');
el('ttClass').value='8|D';api.syncSubjectCatalog('tt');
check(el('ttSubjectOptions').innerHTML.includes('English'),'Refresh failed to offer newly recorded school subject');
check(api.scheduleTeachers('8','D','English').join('|')==='School B English','Teacher selection not updated on registered section refresh');
check(el('scheduleCenterApp').innerHTML.includes('Refresh Classes & Syllabus'),'Staff are missing a school-data refresh action');
el('scheduleCenterApp').dataset.tab='datesheet';
await api.render();
check(el('scheduleCenterApp').innerHTML.includes('Final')&&!el('scheduleCenterApp').innerHTML.includes('Previous School Exam'),'Date Sheet tab showed previous-school exam after refresh');
// A successful Supabase insert must not throw "Assignment to constant
// variable" when its returned row replaces the draft item.
for(const [id,value] of Object.entries({
 ttEditId:'',ttClass:'8|D',ttDay:'Thursday',ttPeriod:'4',
 ttStart:'12:00',ttEnd:'12:40',ttSubject:'English',ttTeacher:'',ttRoom:''
}))el(id).value=value;
el('ttSave');
el('ttTeacher').value='School B Chemistry';
await api.saveTimetable();
check(alerts.some(x=>x.includes('not assigned')),'Schedule Center accepted another class teacher');
alerts.length=0;
el('ttTeacher').value='';
await api.saveTimetable();
check(!alerts.length,'Successful cloud timetable save incorrectly reported an error: '+alerts.join(' / '));
check(api.currentTimetable().some(x=>x.subject==='English'&&x.day==='Thursday'&&x.id==='e21b8a7e-a2ee-465d-9fbe-bb16c38ee45b'),'Cloud-confirmed timetable period was not saved back to the current school');
storage.set('edunizam_session',JSON.stringify({role:'teacher'}));
window.EDUNIZAM_ROLE_SCOPE.teacherClassKeys=()=>new Set(['8|c']);
check(api.classSections().length===0,'Cloud directory cache should be role-scoped after head to teacher change');
await api.loadSchoolCatalog();
check(api.classSections().length===1,'Assigned teacher class missing from current school');
window.EDUNIZAM_ROLE_SCOPE.teacherClassKeys=()=>new Set(['7|a']);
check(api.classSections().length===0,'Teacher dropdown exposed unassigned class from same institute');
console.log('Timetable/Date Sheet PASS: current-school active staff allocations, class/section teachers, syllabus, save guards, stale schedule blocking.');
