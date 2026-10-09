/* Bulk import must never show cloud success or corrupt local data on failed save. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const requireOK=(ok,why)=>{if(!ok)throw new Error(why)};
const source=read('bulk-import-center.js');
function harness({kind='students',cloudMode=true,fail=false,oldSchool=null}={}){
 const values=new Map(),alerts=[],insertCalls=[];
 values.set('edunizam_session',JSON.stringify({role:'head'}));
 if(oldSchool){
  values.set('edunizam_bulk_import_school_v2',oldSchool);
  values.set('edunizam_students',JSON.stringify([{name:'Previous school child',studentId:'old',className:'8'}]));
 }
 const localStorage={
  getItem:k=>values.get(k)||null,
  setItem:(k,v)=>values.set(k,String(v)),
  removeItem:k=>values.delete(k)
 };
 const window={
  EDUNIZAM_CLOUD_CONFIG:{enabled:cloudMode,institutionId:'correct-school'},
  EDUNIZAM_CLOUD:{state:{user:{id:'current-admin'},client:{
   from:table=>({insert:async rows=>{insertCalls.push({table,rows});return fail?{error:{message:'cloud reject'}}:{error:null}}})
  }}}
 };
 const document={readyState:'loading',getElementById:()=>null,addEventListener:()=>{}};
 const location={reloads:0,reload(){this.reloads++}};
 const crypto={randomUUID:()=> 'local-staff-uuid'};
 runInNewContext(source,{window,document,localStorage,location,crypto,
  alert:v=>alerts.push(String(v)),confirm:()=>true,setTimeout:()=>0,console},{filename:'bulk-import-center.js'});
 const api=window.EDUNIZAM_BULK_IMPORT;
 const inputs={
  students:[{name:'Student A',father:'Parent B',className:'5',sectionName:'A',phone:'03000000000',rollNo:'23',studentId:'ST-0023'}],
  staff:[{staffCode:'T-123',fullName:'Teacher Q',designation:'Teacher',subjects:'Mathematics|English',classes:'5|6'}],
  classes:[{className:'5',sectionName:'A',classTeacherName:'Teacher Q',roomLabel:'Room 1',capacity:'30',active:'true'}]
 };
 api.prepare(kind,inputs[kind]);
 return{api,values,alerts,insertCalls,location};
}
for(const kind of ['students','staff','classes']){
 const h=harness({kind});await h.api.importRows();
 requireOK(h.insertCalls.length===1,'Cloud importer must issue exactly one batch for '+kind);
 const table={students:'core_students',staff:'staff_profiles',classes:'class_sections'}[kind];
 requireOK(h.insertCalls[0].table===table,'Incorrect cloud table: '+kind);
 requireOK(h.insertCalls[0].rows.length===1,'Too many cloud rows sent: '+kind);
 const saved=h.insertCalls[0].rows[0];
 requireOK(saved.institution_id==='correct-school','Wrong tenant for '+kind);
 requireOK(h.location.reloads===1,'Successful import did not refresh '+kind);
 const key={students:'edunizam_students',staff:'edunizam_staff_profiles_v1',classes:'edunizam_class_sections_v1'}[kind];
 requireOK(JSON.parse(h.values.get(key)).length===1,'Missing local mirror after cloud acknowledgement: '+kind);
 requireOK(!h.values.has('edunizam_bulk_import_backup_v1'),'Cloud records must not have a local rollback snapshot');
 if(kind==='students')requireOK(saved.student_code==='ST-0023'&&saved.name==='Student A'&&saved.created_by==='current-admin','Student record mapping incorrect');
 if(kind==='staff')requireOK(saved.staff_code==='T-123'&&saved.subjects.includes('Mathematics'),'Teacher record mapping incorrect');
 if(kind==='classes')requireOK(saved.class_name==='5'&&saved.class_teacher_user_id===null,'Class teacher must not be linked by an unverified name');
}
const failed=harness({kind:'students',fail:true});await failed.api.importRows();
requireOK(failed.insertCalls.length===1,'Failure test did not attempt cloud');
requireOK(!failed.values.has('edunizam_students')&&failed.location.reloads===0,'Failed cloud import created misleading local students');
requireOK(failed.alerts.some(v=>v.includes('FAILED')),'Failure did not inform Head');
const local=harness({kind:'students',cloudMode:false});await local.api.importRows();
requireOK(local.insertCalls.length===0,'Local-only import sent cloud writes');
requireOK(JSON.parse(local.values.get('edunizam_students')||'[]').length===1,'Local-only import failed');
requireOK(JSON.parse(local.values.get('edunizam_bulk_import_backup_v1')||'null')?.mode==='local','Local rollback snapshot missing');
local.api.rollback();
requireOK(JSON.parse(local.values.get('edunizam_students')||'[]').length===0,'Local rollback did not restore previous values');
const isolated=harness({kind:'students',oldSchool:'another-institute'});await isolated.api.importRows();
requireOK(JSON.parse(isolated.values.get('edunizam_students')).length===1,'Local cache mixed students from multiple institutes');
requireOK(!source.includes('pushAllLocalToCloud'),'Old full-local student push still active');
console.log('EduNizam cloud-first bulk import PASS: 3 entity types, tenant isolation, cloud failure, local-only rollback and no cross-school cache merging.');
