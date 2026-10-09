/* Student/Parent/Teacher profile scope must fail closed on account/school switch. */
import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8'),ok=(v,m)=>{if(!v)throw Error(m)};
const data=new Map(),students=[
 {id:1,authUserId:'child-a',name:'Student A',className:'5',sectionName:'A'},
 {id:2,authUserId:'child-b',name:'Student B',className:'6',sectionName:'B'},
 {id:3,name:'Unlinked Child',className:'5',sectionName:'A'}];
data.set('edunizam_students',JSON.stringify(students));
let currentRole='parent',inst='school-a',uid='parent-a';
const store={getItem:key=>key==='edunizam_session'?JSON.stringify({role:currentRole,identity:'family@example.test'}):data.get(key)||null,setItem:(k,v)=>data.set(k,String(v))};
const cloud={state:{user:{id:uid},client:{}},ready(){return true},async getMyRole(){return currentRole==='head'?'head_of_institute':currentRole},async getLinkedStudents(){return[{student_user_id:'child-a'}]}};
const cfg={institutionId:inst},win={EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:cfg,addEventListener(){}};
const doc={body:{dataset:{},classList:{toggle(){}}},getElementById:()=>null};
const context={window:win,localStorage:store,document:doc,console,setTimeout:()=>0,clearTimeout:()=>{}};
runInNewContext(read('role-scope.js'),context,{timeout:2000});
const scope=win.EDUNIZAM_ROLE_SCOPE;
const scopeName=()=>[currentRole,uid,cfg.institutionId].join('|');
data.set('edunizam_role_scope',JSON.stringify({__scope:scopeName(),parentStudentUserIds:['child-a']}));
ok(scope.getVisibleStudents(students).map(x=>x.id).join(',')==='1','Parent should only see their linked child');
runInNewContext(read('student-performance.js'),context,{timeout:2000});
const profile=win.EDUNIZAM_STUDENT_PROFILE_SCOPE;
ok(!!profile,'Profile dropdown API missing');
ok((await profile.visibleStudents()).map(x=>x.id).join(',')==='1','Parent profile dropdown leaked another student');
cfg.institutionId='school-b';
ok(scope.getVisibleStudents(students).length===0,'Old parent linking cache valid in another school');
ok((await profile.visibleStudents()).length===0,'Parent profile visible in another school');
cfg.institutionId='school-a';uid='parent-b';cloud.state.user.id=uid;
ok(scope.getVisibleStudents(students).length===0,'Cached parent link valid after identity switch');
uid='teacher-a';cloud.state.user.id=uid;currentRole='teacher';
data.set('edunizam_class_sections_v1',JSON.stringify([{className:'5',sectionName:'A',classTeacherUserId:'teacher-a'}]));
ok(scope.getVisibleStudents(students).length===0,'Teacher should not gain cloud access from old unscoped local class cache');
data.set('edunizam_role_scope',JSON.stringify({__scope:scopeName(),teacherClassSections:['5|a'],teacherStudentUserIds:['child-b']}));
ok(scope.getVisibleStudents(students).map(x=>x.id).join(',')==='1,2,3','Teacher cloud-verified section and assignments should include authorized student rows');
ok((await profile.visibleStudents()).map(x=>x.id).join(',')==='1,2,3','Teacher profile dropdown omitted cloud-verified class children');
currentRole='student';uid='child-a';cloud.state.user.id=uid;
ok(scope.getVisibleStudents(students).map(x=>x.id).join(',')==='1','Student scope should show only own auth-linked record');
ok((await profile.visibleStudents()).map(x=>x.id).join(',')==='1','Student profile dropdown leaked other students');
currentRole='head';uid='head-a';cloud.state.user.id=uid;
ok((await profile.visibleStudents()).length===3,'Authorized head must access complete school profile list');
const profileSource=read('student-performance.js');
for(const mark of ['Only authorized school staff may save','scopedStudents().find','renderToken','EDUNIZAM_STUDENT_PROFILE_SCOPE','school!==String(window.EDUNIZAM_CLOUD_CONFIG?.institutionId'])ok(profileSource.includes(mark),'Missing profile role/tenant guard '+mark);
console.log('EduNizam profile visibility PASS: parent, student, teacher and head; fail-closed cloud scope; school/account switch; assigned class and student options.');
