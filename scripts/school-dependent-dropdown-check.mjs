/* Data completion regression: school classes/subjects + secure linked family assignment filters. */
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const w={};runInNewContext(read('school-form-options.js'),{window:w});
const F=w.EDUNIZAM_SCHOOL_FORM_OPTIONS;
ok(F.grade('Grade 9')===9&&F.grade('19')===0,'Invalid grade parsing');
ok(F.classes([{class_name:'5',active:true},{class_name:'5',active:true},{class_name:'6',active:false},{className:'9'}]).join('|')==='5|9','Inactive/duplicate class shown');
ok(F.subjects(['Grade 5','9'],{'5':['English','Math'],'9':['Physics','English']}).join('|')==='English|Math|Physics','Subject reference options missing or duplicated');
ok(F.append('English, Urdu','urdu')==='English, Urdu'&&F.append('English','Physics')==='English, Physics','Multi-value append failed');
const staff=read('staff-center.js'),loader=read('feature-loader.js');
for(const key of ['formSchoolScope','id="staffAddClass"','id="staffAddSubject"',"select('class_name,section_name,active').eq('institution_id',inst).eq('active',true)"])
 ok(staff.includes(key),'Staff picker missing '+key);
ok(loader.includes("staffcenter:['lessonCatalog']")&&loader.includes("staffcenter:['school-form-options.js','staff-center.js']"),'Staff reference catalog not lazy-loaded');
const elements=new Map();
function el(id){if(!elements.has(id)){
 let html='',val='';
 elements.set(id,{id,textContent:'',disabled:false,querySelectorAll:()=>[],set innerHTML(x){html=String(x);val=''},get innerHTML(){return html},get value(){return val},set value(x){val=String(x)},get options(){return[...html.matchAll(/<option value="([^"]*)"/g)].map(x=>({value:x[1]}))}});
 }return elements.get(id)}
for(const id of ['assignmentTeacher','assignmentStudent','assignmentList','bulkAssignmentTeacher','bulkAssignmentClass','bulkAssignmentSection','assignWholeClassBtn','bulkAssignmentMsg','assignmentClassFilter','assignmentSectionFilter','assignmentStudentHelp','saveAssignmentBtn'])el(id);
const users=[{user_id:'t1',full_name:'Teacher'}],students=[
 {auth_user_id:'s1',name:'Ali',class_name:'5',section_name:'A'},
 {auth_user_id:'s2',name:'Noor',class_name:'5',section_name:'B'},
 {auth_user_id:'s3',name:'Hina',class_name:'6',section_name:'A'},
 {auth_user_id:null,name:'Unlinked',class_name:'6',section_name:'B'}];
const calls=[],win={EDUNIZAM_CLOUD_CONFIG:{institutionId:'school1'},
 EDUNIZAM_CLOUD:{state:{user:{id:'head1'},client:{rpc:async(name,params)=>{calls.push({name,params});return{data:{matched_students:1,assigned_new:1},error:null}}}},
 listInstitutionTeachers:async()=>users,listLinkedCoreStudents:async()=>students,listTeacherStudentLinks:async()=>[],
 assignTeacherStudent:async()=>{},removeTeacherStudentLink:async()=>{}}};
const document={getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[]};
const localStorage={getItem:key=>key==='edunizam_session'?JSON.stringify({role:'head'}):null};
runInNewContext(read('academic-access.js'),{window:win,document,localStorage,setTimeout:()=>0,console,alert:x=>{throw Error(String(x))}},{timeout:3000});
const access=win.EDUNIZAM_ACADEMIC_ACCESS;ok(!!access,'Academic access API missing');
await access.loadAssignments();
ok(el('assignmentStudent').options.length===4&&!el('assignmentStudent').innerHTML.includes('Unlinked'),'Linked students dropdown includes unapproved student');
ok(el('assignmentClassFilter').options.length===3,'Linked class choices incorrect');
el('assignmentClassFilter').value='5';access.populateAssignmentStudents();
ok(el('assignmentStudent').options.length===3&&el('assignmentSectionFilter').options.length===3,'Class dependent options incomplete');
el('assignmentSectionFilter').value='A';access.populateAssignmentStudents(true);
ok(el('assignmentStudent').options.length===2&&!el('assignmentStudent').innerHTML.includes('Noor'),'Section isolation failed');
el('bulkAssignmentTeacher').value='t1';el('bulkAssignmentClass').value='5';access.populateBulkSections();
ok(el('bulkAssignmentSection').options.length===3,'Bulk class sections missing');
el('bulkAssignmentSection').value='A';access.populateBulkSections();
await access.assignWholeClass();
ok(calls.length===1&&calls[0].name==='assign_teacher_class_v1','Secure teacher class RPC not invoked');
ok(calls[0].params.p_institution_id==='school1'&&calls[0].params.p_class_name==='5'&&calls[0].params.p_section_name==='A','Class assignment wrong school or section');
el('bulkAssignmentClass').value='6';el('bulkAssignmentSection').value='B';await access.assignWholeClass();
ok(calls.length===1,'Unlinked class/section must not submit RPC');
win.EDUNIZAM_CLOUD_CONFIG.institutionId='school2';
win.EDUNIZAM_CLOUD.listLinkedCoreStudents=async()=>[];
win.EDUNIZAM_CLOUD.listInstitutionTeachers=async()=>[];
await access.loadAssignments();
ok(el('assignmentStudent').options.length===1&&!el('assignmentStudent').innerHTML.includes('Ali'),'School change retained previous institute student dropdown');
ok(el('assignmentClassFilter').options.length===1&&el('bulkAssignmentClass').options.length===1,'School change retained previous classes');
ok(el('saveAssignmentBtn').disabled&&el('assignWholeClassBtn').disabled,'Empty school assignment buttons must be disabled');
win.EDUNIZAM_CLOUD.listLinkedCoreStudents=async()=>{throw Error('School records unavailable')};
await access.loadAssignments();
ok(el('assignmentStudent').options.length===1&&!el('assignmentStudent').innerHTML.includes('Noor'),'Failed school fetch retained student personal data');

const previous=el('assignmentStudent').innerHTML;localStorage.getItem('edunizam_session');
console.log('EduNizam dependent-dropdown PASS: real active class options, subject suggestions, approved linked students, class/section filters, empty-section guard, institution-scoped RPC.');
