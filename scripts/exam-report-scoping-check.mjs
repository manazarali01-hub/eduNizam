/* Exam Center report cards: role/school-safe students and real UUID keys. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../exam-center.js',import.meta.url),'utf8');
const ok=(v,msg)=>{if(!v)throw Error(msg)};
const ID='72414b4d-ec9e-4cc8-ad35-803c27aa8427';
const OUTSIDE='ce0a23f4-5308-456a-9c71-df9d034a95df';
const students=[
 {id:ID,name:'Accessible Pupil',className:'5',father:'Parent One'},
 {id:OUTSIDE,name:'Other School Pupil',className:'6'}
];
const records=[
 {studentId:ID,type:'Midterm',subject:'Mathematics',marks:40,total:50},
 {studentId:ID,type:'Midterm',subject:'English',marks:45,total:50},
 {studentId:OUTSIDE,type:'Other School Private Exam',subject:'Physics',marks:50,total:50}
];
const storage=new Map([
 ['edunizam_session',JSON.stringify({role:'parent',identity:'parent-one'})],
 ['edunizam_students',JSON.stringify(students)],
 ['edunizam_results',JSON.stringify(records)]
]);
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))};
const nodes=new Map();
const getElementById=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:''});return nodes.get(id)};
const document={getElementById,querySelectorAll:()=>[]};
const window={addEventListener(){}};
const ctx={window,document,localStorage,console,setTimeout:()=>0,clearTimeout(){},Date};
runInNewContext(src,ctx,{filename:'exam-center.js',timeout:2000});
const api=window.EDUNIZAM_EXAM_CENTER;
ok(api&&typeof api.reportControls==='function'&&typeof api.buildReport==='function','Exam Center report helper missing');
ok(api.reportControls().includes('koi accessible student record nahi mila'),'Missing scope should fail closed');
window.EDUNIZAM_ROLE_SCOPE={getVisibleStudents:()=>[students[0]]};
const html=api.reportControls();
ok(html.includes('Accessible Pupil')&&!html.includes('Other School Pupil'),'Student dropdown ignored authorized role scope');
ok(html.includes('value="'+ID+'"'),'Report card selector does not support UUID student ID');
ok(html.includes('Midterm')&&!html.includes('Other School Private Exam'),'Report card exam-type options leaked another student results');
getElementById('rcStudent').value=ID;
getElementById('rcType').value='Midterm';
api.buildReport();
const report=getElementById('reportCardOutput').innerHTML;
ok(report.includes('Accessible Pupil')&&report.includes('Mathematics')&&report.includes('English'),'Authorized UUID student report card could not build');
ok(report.includes('85')&&!report.includes('Other School Private Exam'),'Report totals or subject list mixed unrelated student');
getElementById('rcStudent').value=OUTSIDE;
api.buildReport();
const blocked=getElementById('reportCardOutput').innerHTML;
ok(blocked.includes('accessible student')&&!blocked.includes('Other School Pupil'),'Tampered out-of-scope student selection was rendered');
getElementById('rcStudent').value='not-a-student';
api.buildReport();
ok(getElementById('reportCardOutput').innerHTML.includes('accessible student'),'Unknown student ID must be blocked');
storage.set('edunizam_students',JSON.stringify([{id:7,name:'Numeric Legacy',className:'4'},...students]));
storage.set('edunizam_results',JSON.stringify([{studentId:7,type:'Quiz',subject:'Urdu',marks:8,total:10},...records]));
window.EDUNIZAM_ROLE_SCOPE={getVisibleStudents:all=>all.filter(s=>String(s.id)==='7')};
getElementById('rcStudent').value='7';
getElementById('rcType').value='Quiz';
api.buildReport();
ok(getElementById('reportCardOutput').innerHTML.includes('Numeric Legacy'),'Numeric legacy student report card regressed');
ok(!getElementById('reportCardOutput').innerHTML.includes('Accessible Pupil'),'Numeric ID reused data outside role scope');
console.log('EduNizam Exam Center report PASS: fail-closed student list, UUID and numeric IDs, report-type isolation, tampered selection blocked.');
