/* VU dropdown contract: real reference catalog ≠ personal enrollment.
 * Planner, recall and personal links must work even without saved courses. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const values=new Map(),nodes=new Map();
function el(id){
 if(!nodes.has(id)){
  let html='',val='';
  nodes.set(id,{
   id,onclick:null,style:{},disabled:false,textContent:'',
   classList:{add(){},remove(){},toggle(){}},
   addEventListener(){},
   set innerHTML(x){html=String(x);val=''},
   get innerHTML(){return html},
   set value(x){val=String(x)},
   get value(){return val}
  });
 }
 return nodes.get(id);
}
const document={getElementById:el,querySelectorAll:()=>[]};
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const window={};
const ctx={window,document,localStorage,console,alert:msg=>{throw Error('Unexpected alert: '+msg)}};
runInNewContext(read('vu-course-catalog.js'),ctx,{filename:'vu-course-catalog.js'});
runInNewContext(read('vu-workspace.js'),ctx,{filename:'vu-workspace.js'});
for(const id of ['vuPlannerCourse','vuRecallCourse','vuPersonalCourse']){
 const html=el(id).innerHTML;
 check(html.includes('VU course reference catalog (not enrolled)'),'No explicit reference label in '+id);
 check(html.includes('value="MTH501"')&&html.includes('value="CS201"'),'Empty VU catalog options in '+id);
 check(!html.includes('My saved courses'),'Catalog suggestions incorrectly marked as enrollment');
}
check(!values.has('edunizam_vu_courses'),'Reference suggestions must not add user enrollment');
el('vuPlannerCourse').value='MTH501';
el('vuPlannerTerm').value='Midterm';
el('vuPlannerFrom').value='1';
el('vuPlannerTo').value='10';
el('vuPlannerDone').value='2';
el('vuSavePlannerBtn').onclick();
const plans=JSON.parse(values.get('edunizam_vu_exam_plans')||'[]');
check(plans.length===1&&plans[0].course==='MTH501'&&plans[0].total===10,'Catalog-only VU course cannot save a study plan');
check(el('vuPlannerCourse').value==='MTH501','Refreshing VU plans must retain selected course');
el('vuRecallCourse').value='MTH501';
el('vuRecallTerm').value='Final';
el('vuRecallSemester').value='Fall 2026';
el('vuRecallType').value='mcq';
el('vuRecallQuestion').value='Which matrix is singular?';
el('vuSaveRecallBtn').onclick();
check(JSON.parse(values.get('edunizam_vu_recalls')||'[]').length===1,'Catalog-only recall was blocked');
el('vuPersonalCourse').value='MTH501';
el('vuPersonalCategory').value='Notes';
el('vuPersonalTitle').value='Course outline';
el('vuPersonalUrl').value='https://ocw.vu.edu.pk/';
el('vuSavePersonalBtn').onclick();
check(JSON.parse(values.get('edunizam_vu_personal_resources')||'[]').length===1,'Catalog-only personal resource was blocked');
check(!values.has('edunizam_vu_courses'),'Catalog-only activity created false course enrollment');
el('vuMyCourseCode').value='CS201';
el('vuMyCourseTitle').value='Introduction to Programming';
el('vuMyCourseSemester').value='Current';
el('vuMyCourseStatus').value='In Progress';
el('vuSaveCourseBtn').onclick();
check(JSON.parse(values.get('edunizam_vu_courses')||'[]').length===1,'Explicitly saved enrollment did not persist');
for(const id of ['vuPlannerCourse','vuRecallCourse','vuPersonalCourse']){
 const html=el(id).innerHTML;
 check(html.includes('My saved courses')&&html.includes('VU course reference catalog (not enrolled)'),'VU saved/catalog grouping missing in '+id);
 check((html.match(/<option value="CS201"/g)||[]).length===1,'Duplicate enrolled+catalog options in '+id);
}
check(el('vuPlannerCourse').value==='MTH501','Adding a saved course erased another course choice');
console.log('EduNizam VU dropdown PASS: course reference suggestions, explicit saved enrollment isolation, planner/recall/personal workflows, preserved selections.');
