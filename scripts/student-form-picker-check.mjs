/* Real student data dropdown contracts: do not fabricate students or save out-of-scope entries. */
import{readFileSync}from'node:fs';import{runInNewContext}from'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const ok=(value,message)=>{if(!value)throw Error(message)};
const window={};runInNewContext(read('school-student-picker.js'),{window},{filename:'school-student-picker.js'});
const picker=window.EDUNIZAM_STUDENT_PICKER;
ok(!!picker,'Student picker not loaded');
const rows=[
 {id:'a',name:'Zain',className:'5',sectionName:'B',studentId:'ST-A'},
 {id:'b',name:'Ali',className:'5',sectionName:'A'},
 {id:'c',name:'Noor',className:'6',sectionName:'A'},
 {id:'c',name:'Noor Duplicate',className:'7'},
 {id:'d',name:'<script>alert(1)</script>',className:'6',sectionName:'A'},
 {id:'e',name:'Aisha',className:'',sectionName:''},
 {id:'x',name:'   '},{id:null,name:'Invalid'}
];
const list=picker.eligible(rows),html=picker.options(rows);
ok(list.length===5,'Student IDs were fabricated or incorrectly deduplicated');
ok(html.includes('<optgroup label="5 · A">')&&html.includes('<optgroup label="5 · B">')&&html.includes('<optgroup label="6 · A">'),'Actual class/section groups missing');
ok(html.includes('<optgroup label="Unassigned class · No section">'),'Unassigned class label should be explicit');
ok(html.indexOf('5 · A')<html.indexOf('5 · B')&&html.indexOf('5 · B')<html.indexOf('6 · A'),'Dropdown is not numerically sorted');
ok(html.includes('&lt;script&gt;')&&!html.includes('<script>'),'Student names were injected into HTML');
ok(picker.has(rows,'a')&&!picker.has(rows,'missing')&&!picker.has([], 'a')&&!picker.has(rows,''),'Selection validation permitted an unlisted student');
ok(picker.options([])==='<option value="">Select student</option>','Empty dropdown should show only an unselected placeholder');
for(const [file,selectId,guard] of [
 ['leave-center.js','leaveStudent','eligibleSubmitStudents(),sid'],
 ['student-behavior.js','bhStudent','visibleStudents(),studentId'],
 ['parent-complaint-center.js','pcStudent','visibleStudents(),studentId'],
 ['student-documents.js','sdStudent','visibleStudents(),sid'],
 ['class-section-center.js','csStudent','students(),sid']
]){
 const s=read(file);
 ok(s.includes("EDUNIZAM_STUDENT_PICKER.options("),'Grouped dropdown helper missing in '+file);
 ok(s.includes('id="'+selectId+'"'),'Expected student dropdown missing in '+file);
 ok(s.includes('EDUNIZAM_STUDENT_PICKER?.has('+guard+')'),'Missing current-role student save guard in '+file);
 ok(!s.includes('EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()'),'Unsafe all-student fallthrough in '+file);
}
const docs=read('student-documents.js');
ok(docs.includes('if(!isHead())return alert('),'Document issuing requires head role');
ok(docs.includes('Cloud document issue failed. No local certificate issued'),'Cloud error must not create a fake issued document');
ok(!docs.includes('Cloud sync unavailable; document local mode mein issue hoga'),'Old fake cloud fail/local success message still exists');
const academic=read('class-section-center.js');
ok(academic.includes('&&x.active!==false'),'Cannot allocate to inactive section');
const loader=read('feature-loader.js');
for(const v of ['leavecenter','studentdocs','behaviorcenter','parentcomplaints','classcenter']){
 ok(loader.includes(v+":['school-student-picker.js'"),'Missing picker script dependency for '+v);
}
console.log('EduNizam student-form picker PASS: actual class/section grouping, sorted duplicate-free options, XSS escaping, scoped save guards, inactive section and cloud certificate safeguards.');
