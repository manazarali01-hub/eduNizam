/* Deep Results/Report Cards honor current school and role visibility. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const assert=(yes,msg)=>{if(!yes)throw Error(msg)};
const inside={id:'aa096bc4-7325-467b-ac0d-5e75d9c9546f',name:'Allowed Student',className:'5'};
const outside={id:'z-other-school',name:'Other School Student',className:'5'};
const values=new Map([
 ['edunizam_students',JSON.stringify([inside,outside])],
 ['edunizam_results',JSON.stringify([
  {studentId:inside.id,subject:'Math',type:'Midterm',marks:45,total:50},
  {studentId:outside.id,subject:'Chemistry',type:'Private Result',marks:30,total:50}
 ])],
 ['edunizam_session',JSON.stringify({role:'parent'})]
]);
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const window={addEventListener(){}};
const document={getElementById:()=>null};
const ctx={window,document,localStorage,console,setTimeout:()=>0,clearTimeout(){},Date};
runInNewContext(read('result-center-deep.js'),ctx,{filename:'result-center-deep.js'});
const api=window.EDUNIZAM_RESULT_CENTER;
assert(api&&typeof api.scopedResults==='function','Results role-scoped API missing');
assert(api.visibleStudents().length===0&&api.scopedResults().length===0,'Results fell back to all school students without scope');
assert(api.reportHtml(outside.id).includes('Student record not found'),'Unauthorized student identity exposed without scope');
window.EDUNIZAM_ROLE_SCOPE={getVisibleStudents:()=>[inside]};
assert(api.visibleStudents().length===1&&api.scopedResults().length===1,'Result rows not filtered by current accessible student');
const report=api.reportHtml(inside.id,'Midterm');
assert(report.includes('Allowed Student')&&report.includes('Math')&&report.includes('45'),'Scoped UUID report missing actual student results');
assert(!report.includes('Other School Student')&&!report.includes('Chemistry'),'Other school results leaked into UUID student report');
const blocked=api.reportHtml(outside.id,'Private Result');
assert(blocked.includes('Student record not found')&&!blocked.includes(outside.name),'Out-of-scope report revealed other school pupil');
window.EDUNIZAM_ROLE_SCOPE={getVisibleStudents:()=>[]};
assert(api.scopedResults().length===0&&!api.reportHtml(inside.id).includes('Allowed Student'),'Authorized records persisted after scope was revoked');
console.log('EduNizam Deep Results PASS: fail-closed role scope, UUID report cards, cross-school result isolation and revoked scope.');
