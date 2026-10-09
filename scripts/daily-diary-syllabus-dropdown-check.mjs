/* Daily Diary school-saved syllabus suggestions must use current institution.
 * Reference concept topics remain suggestions, not certified textbook units. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const values=new Map([
 ['edunizam_session',JSON.stringify({role:'teacher'})],
 ['edunizam_students','[]'],
 ['edunizam_syllabus_units_v1',JSON.stringify([{className:'5',subject:'Private Previous School Subject',unitTitle:'Old Secret Unit'}])]
]);
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const fields=new Map();
const el=id=>{if(!fields.has(id))fields.set(id,{value:'',innerHTML:'',textContent:''});return fields.get(id)};
for(const id of ['diaryClass','diarySubject','diarySubjects','diaryTopics','diarySyllabusNote'])el(id);
el('diaryClass').value='5|A';
el('diarySubject').value='Math';
const document={
 readyState:'loading',
 querySelector:selector=>fields.get(selector.replace(/^#/,'))||null,
 querySelectorAll:()=>[],
 addEventListener(){}
};
const db={
 'school-A':[{class_name:'Grade 5',subject:'Mathematics',unit_title:'Genuine School Fractions'}],
 'school-B':[{class_name:'Class 5',subject:'Islamiyat',unit_title:'School Prayer'}]
};
const calls=[];
let unavailable=false;
const client={
 from(table){
  const filters={};
  return {
   select(){return this},eq(k,v){filters[k]=v;return this},limit(){return this},abortSignal(){return this},
   then(resolve,reject){
    calls.push({table,filters:{...filters}});
    return Promise.resolve(unavailable?{error:{message:'No access'},data:null}:{error:null,data:db[filters.institution_id]||[]}).then(resolve,reject);
   }
  }
 }
};
const cfg={institutionId:'school-A'};
const cloud={state:{client,user:{id:'teacher1'}}};
const window={
 EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:cfg,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[]},
 EDUNIZAM_ACADEMIC_OPTION_CATALOG:{subjects:{5:['Mathematics','English','Islamiat / Ethics']},chapters:{'5|Mathematics':['Fractions','Decimals'],'5|Islamiat / Ethics':['Cleanliness']}}
};
const ctx={window,document,localStorage,console,setTimeout,clearTimeout,Date,AbortController};
runInNewContext(read('academic-form-options.js'),ctx,{filename:'academic-form-options.js',timeout:3000});
runInNewContext(read('daily-class-diary.js'),ctx,{filename:'daily-class-diary.js',timeout:3000});
const api=window.EDUNIZAM_DAILY_DIARY;
check(api&&typeof api.loadDiarySyllabus==='function','Daily Diary syllabus data API is missing');
api.syncDiaryCatalog();
check(!el('diaryTopics').innerHTML.includes('Old Secret Unit'),'Diary used prior school syllabus before scoped load');
await api.loadDiarySyllabus();
check(api.getSyllabus().status==='loaded'&&api.getSyllabus().scope==='school-A|teacher1','Current school syllabus was not loaded');
api.syncDiaryCatalog();
check(el('diarySubjects').innerHTML.includes('Mathematics'),'Reference grade 5 subject missing');
check(el('diaryTopics').innerHTML.includes('Genuine School Fractions')&&el('diaryTopics').innerHTML.includes('Decimals'),'Saved and conceptual topic choices missing');
check(!el('diarySubjects').innerHTML.includes('Private Previous School Subject')&&!el('diaryTopics').innerHTML.includes('Old Secret Unit'),'Other-school local syllabus leaked');
check(el('diarySyllabusNote').textContent.includes('school-saved syllabus unit(s)'),'Saved vs conceptual syllabus label missing');
check(calls.some(x=>x.table==='syllabus_progress_units'&&x.filters.institution_id==='school-A'),'Diary syllabus lookup was not institution-scoped');
cfg.institutionId='school-B';
el('diarySubject').value='Islamiyat';
api.syncDiaryCatalog();
check(!el('diaryTopics').innerHTML.includes('Genuine School Fractions'),'School A chapter remains in dropdown after school switch');
await api.loadDiarySyllabus();
api.syncDiaryCatalog();
check(el('diaryTopics').innerHTML.includes('School Prayer')&&el('diaryTopics').innerHTML.includes('Cleanliness'),'School B syllabus subject alias or concept topics missing');
check(!el('diaryTopics').innerHTML.includes('Genuine School Fractions'),'Previous school syllabus leaked after new school loaded');
cloud.state.user.id='teacher2';
api.syncDiaryCatalog();
check(!el('diaryTopics').innerHTML.includes('School Prayer'),'Previous user's saved syllabus persisted across account switch');
await api.loadDiarySyllabus();
check(api.getSyllabus().scope==='school-B|teacher2','Teacher switch did not refresh scoped syllabus');
db['school-B'].push({class_name:'5',subject:'Islamiyat',unit_title:'Recently Saved Unit'});
await api.loadDiarySyllabus(true);
api.syncDiaryCatalog();
check(el('diaryTopics').innerHTML.includes('Recently Saved Unit'),'Refresh did not show a newly saved school chapter');
unavailable=true;
await api.loadDiarySyllabus(true);
api.syncDiaryCatalog();
check(api.getSyllabus().status==='error'&&!el('diaryTopics').innerHTML.includes('Recently Saved Unit'),'Failed fetch reused old school-saved syllabus');
check(el('diarySyllabusNote').textContent.includes('lookup unavailable'),'Fetch failure not explained to teacher');
values.set('edunizam_session',JSON.stringify({role:'head'}));
await api.loadDiarySyllabus();
check(api.getSyllabus().units.length===0,'Teacher syllabus entries remained after role change');
console.log('EduNizam Daily Diary syllabus PASS: cloud institution filters, alias subjects, saved vs concept labels, refresh, role/account isolation and fetch failure.');
