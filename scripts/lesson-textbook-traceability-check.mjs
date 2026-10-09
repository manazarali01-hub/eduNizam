/* Real syllabus unit creation has book provenance, no invented school
 * records, safe publication guard and current institution isolation. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const verify=(ok,msg)=>{if(!ok)throw Error(msg)};
const storage=new Map([['edunizam_session',JSON.stringify({role:'head'})],
 ['edunizam_syllabus_units_v1',JSON.stringify([{className:'9',subject:'Secret old school',unitTitle:'Private'}])],
 ['edunizam_lesson_plans_v1','[]']]);
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const nodes=new Map();
const el=id=>{
 if(!nodes.has(id))nodes.set(id,{id,value:'',checked:false,disabled:false,isConnected:true,textContent:'',
  dataset:{},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(){}});
 return nodes.get(id);
};
for(const id of ['lpSaveUnit','lpUnitEditId','lpUnitClass','lpUnitSection','lpUnitSubject','lpUnitTitle',
 'lpTextbookTitle','lpCurriculumBoard','lpEditionYear','lpSourceUrl','lpCompletion',
 'lpUnitStatus','lpTargetEnd','lpFamilyVisible','lpSavePlan','lpPlanEditId','lpPlanClass',
 'lpPlanSection','lpPlanSubject','lpTopic','lpWeekStart','lpObjectives','lpActivities','lpHomework','lpPlanStatus'])el(id);
const document={getElementById:id=>nodes.get(id)||null,querySelectorAll:()=>[]};
const config={enabled:true,institutionId:'school-A'};
const data={
 'school-A':{class_sections:[{class_name:'Grade 5',section_name:'A',active:true}],
  lesson_plans:[],syllabus_progress_units:[]},
 'school-B':{class_sections:[{class_name:'6',section_name:'B',active:true}],
  lesson_plans:[],syllabus_progress_units:[]}
};
let uid=0;
const client={from(table){
 const filters={};let action='',payload;
 const query={
  select(){return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(){return this},
  abortSignal(){return this},insert(x){action='insert';payload=x;return this},
  update(x){action='update';payload=x;return this},
  single(){
   if(action==='insert'){
    const rec={id:'record-'+(++uid),created_at:'2026-10-09T12:00:00Z',...payload};
    data[payload.institution_id][table].push(rec);return Promise.resolve({data:rec,error:null});
   }
   return Promise.resolve({data:null,error:{message:'Unexpected database mutation'}});
  },
  then(resolve,reject){
   const rows=(data[filters.institution_id]?.[table]||[]).filter(x=>
    !Object.hasOwn(filters,'active')||x.active===filters.active);
   return Promise.resolve({data:rows,error:null}).then(resolve,reject);
  }
 };
 return query;
}};
const cloud={state:{client,user:{id:'head-A'}}};
const window={EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:config,
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:()=>[],teacherClassKeys:()=>new Set()},
 addEventListener(){}};
const errors=[];
const ctx={window,document,localStorage,console,Date,AbortController,
 setTimeout:()=>0,clearTimeout(){},alert:x=>errors.push(String(x))};
runInNewContext(read('academic-form-options.js'),ctx,{filename:'academic-form-options.js'});
runInNewContext(read('lesson-plan-center.js'),ctx,{filename:'lesson-plan-center.js'});
const api=window.EDUNIZAM_LESSON_CENTER;
verify(api?.unitBookValidation&&api?.recordedSchoolTopic&&api?.saveUnit&&api?.savePlan,'Lesson Center syllabus validation API missing');
verify(!api.unitBookValidation({textbookTitle:'',curriculumBoard:'',editionYear:'',sourceUrl:'',completion:0,status:'Planned'})===false,'');
verify(api.unitBookValidation({textbookTitle:'Book',curriculumBoard:'board',editionYear:'202A',sourceUrl:'',completion:0,status:'Planned'}).includes('Edition year'),'Invalid textbook edition year accepted');
verify(api.unitBookValidation({textbookTitle:'Book',curriculumBoard:'board',editionYear:'',sourceUrl:'javascript:alert(1)',completion:0,status:'Planned'}).includes('https'),'Unsafe source URL accepted');
verify(api.unitBookValidation({textbookTitle:'Book',curriculumBoard:'board',editionYear:'',sourceUrl:'',completion:42,status:'Completed'}).includes('100%'),'Incomplete chapter claimed completed');
verify(api.unitBookValidation({textbookTitle:'Book',curriculumBoard:'board',editionYear:'',sourceUrl:'',completion:101,status:'Planned'}).includes('whole number'),'Out-of-range progress accepted');
verify(api.classOptions().length===0&&!api.savedUnits().length,'Previous-school class/syllabus cache leaked before cloud load');
await api.pullCloud();
verify(api.classOptions().includes('Grade 5'),'Cloud class directory did not load');
function set(entries){for(const [name,value]of Object.entries(entries))el(name).value=String(value)}
set({lpUnitClass:'Grade 5',lpUnitSection:'A',lpUnitSubject:'Mathematics',lpUnitTitle:'Exact Textbook Chapter 1',
 lpCompletion:'0',lpUnitStatus:'Planned',lpTextbookTitle:'',lpCurriculumBoard:'',lpEditionYear:'',lpSourceUrl:''});
await api.saveUnit();
verify(data['school-A'].syllabus_progress_units.length===0&&errors.some(e=>e.includes('textbook')),
 'Unit without prescribed textbook was published');
errors.length=0;
set({lpTextbookTitle:'School Mathematics Book',lpCurriculumBoard:'punjab-pectaa',lpEditionYear:'2026',
 lpSourceUrl:'https://pectaa.edu.pk/books-and-publications/'});
await api.saveUnit();
verify(data['school-A'].syllabus_progress_units.length===1,'Verified input did not save actual syllabus unit');
const item=data['school-A'].syllabus_progress_units[0];
verify(item.textbook_title==='School Mathematics Book'&&item.curriculum_board==='punjab-pectaa'&&
 item.edition_year==='2026'&&item.source_url.startsWith('https:'),
 'Database write dropped textbook metadata');
verify(api.recordedSchoolTopic('5','A','Math','Exact Textbook Chapter 1'),'Saved chapter missing in same class and subject');
verify(!api.recordedSchoolTopic('5','B','Mathematics','Exact Textbook Chapter 1'),'Section A chapter leaked to section B');
verify(!api.recordedSchoolTopic('6','A','Mathematics','Exact Textbook Chapter 1'),'Chapter leaked to different grade');
await api.saveUnit();
verify(data['school-A'].syllabus_progress_units.length===1&&errors.some(e=>e.includes('already')),
 'Duplicate chapter created instead of editing original');
errors.length=0;
set({lpPlanClass:'Grade 5',lpPlanSection:'A',lpPlanSubject:'Mathematics',
 lpTopic:'Reference Concept Only',lpPlanStatus:'Published',lpWeekStart:'2026-10-12'});
await api.savePlan();
verify(data['school-A'].lesson_plans.length===0&&errors.some(e=>e.includes('school-recorded')),
 'Unverified concept published as a real school lesson');
errors.length=0;el('lpTopic').value='Exact Textbook Chapter 1';
await api.savePlan();
verify(data['school-A'].lesson_plans.length===1&&errors.length===0,
 'Published real lesson did not save after matching actual school chapter');
config.institutionId='school-B';cloud.state.user.id='head-B';
verify(api.classOptions().length===0&&!api.savedUnits().length&&
 !api.recordedSchoolTopic('5','A','Math','Exact Textbook Chapter 1'),
 'Current-school options leaked previous-school chapter after identity switch');
await api.pullCloud();
verify(api.classOptions().length===1&&api.classOptions()[0]==='6','New-school class absent after switch');
verify(!api.savedUnits().length,'Previous-school textbook metadata survived identity switch');
const migration=read('supabase/migrations/20261009141035_add_syllabus_textbook_traceability_20261009.sql');
for(const name of ['textbook_title','curriculum_board','edition_year','source_url'])
 verify(migration.includes('add column if not exists '+name),'Missing live additive textbook column '+name);
console.log('EduNizam Lesson/Syllabus textbook PASS: school provenance fields, valid book input, dedup, real chapter publication, and school/account cache isolation.');
