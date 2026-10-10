import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const el={'#pbSection':{value:''}};
const document={readyState:'loading',querySelector:x=>el[x]||null,querySelectorAll:()=>[],addEventListener(){}};
const project={institutionId:'A'};let hold=false,finish=null;
const db={
 A:{class_sections:[{class_name:'5',section_name:'A',active:true},{class_name:'5',section_name:'B',active:true}],
 syllabus_progress_units:[{class_name:'5',section_name:'A',subject:'Science',unit_title:'Solar',textbook_title:'A',curriculum_board:'Punjab'},{class_name:'5',section_name:'B',subject:'Science',unit_title:'Water',textbook_title:'B',curriculum_board:'Punjab'},{class_name:'5',section_name:null,subject:'Science',unit_title:'Shared',textbook_title:'S',curriculum_board:'Punjab'}]},
 B:{class_sections:[{class_name:'5',section_name:'C',active:true}],
 syllabus_progress_units:[{class_name:'5',section_name:'C',subject:'Science',unit_title:'Heat',textbook_title:'C',curriculum_board:'Punjab'}]}
};
const cloud={state:{user:{id:'userA'},client:{from(table){let id='';return {select(){return this},eq(key,value){id=value;return this},limit(){return this},then(resolve,reject){if(hold&&table==='syllabus_progress_units'&&id==='A')return new Promise(r=>{finish=()=>r({data:db.A[table]})}).then(resolve,reject);return Promise.resolve({data:db[id]?.[table]||[]}).then(resolve,reject)}}}}}};
const window={EDUNIZAM_CLOUD_CONFIG:project,EDUNIZAM_CLOUD:cloud};
const context={window,document,localStorage:{getItem:()=>null},console,setTimeout,clearTimeout,AbortController};
vm.runInNewContext(read('paper-syllabus-audit.js'),context);
vm.runInNewContext(read('teacher-paper-builder.js'),context);
const api=window.EDUNIZAM_PAPER_BUILDER;
await api.loadSchoolCatalog();
const chapters=()=>api.schoolChapters('5','Science');
assert.deepEqual([...chapters()],['Shared']);
assert(!api.schoolPaperReadiness('5','Science',['Solar']).allowed);
el['#pbSection'].value='A';
assert(chapters().includes('Solar')&&!chapters().includes('Water'));
assert(api.schoolPaperReadiness('5','Science',['Solar']).allowed);
el['#pbSection'].value='B';
assert(chapters().includes('Water')&&!chapters().includes('Solar'));
assert(!api.schoolPaperReadiness('5','Science',['Solar']).allowed);
el['#pbSection'].value='invalid';
assert(!api.schoolPaperReadiness('5','Science',['Shared']).allowed);
el['#pbSection'].value='';
hold=true;
const old=api.loadSchoolCatalog();
await new Promise(resolve=>setImmediate(resolve));
project.institutionId='B';cloud.state.user.id='userB';
await api.loadSchoolCatalog();
el['#pbSection'].value='C';
assert(chapters().includes('Heat')&&!chapters().includes('Solar'));
if(finish)finish();
await old;
assert(chapters().includes('Heat'),'Old school late response changed new school syllabus');
assert(read('teacher-paper-builder.js').includes('class_name,section_name,subject,unit_title'));
console.log('Paper Builder real section-filtering and session races PASS');
