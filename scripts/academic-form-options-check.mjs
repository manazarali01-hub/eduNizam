/* Academic dropdown data contracts: registered sections and school-saved units. */
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pass=(v,m)=>{if(!v)throw new Error(m)};
const context={window:{}};
runInNewContext(read('academic-form-options.js'),context,{filename:'academic-form-options.js',timeout:3000});
const A=context.window.EDUNIZAM_ACADEMIC_FORM_OPTIONS;
pass(!!A,'Academic form helper missing');
pass(A.grade('Grade 9')===9&&A.grade('10')===10&&A.grade('19')===0&&A.grade('Nursery')===0,'School class parser must match whole class values, not substrings');
const rows=[
 {className:'5',sectionName:'A',active:true},
 {class_name:'5',section_name:'B',active:true},
 {className:'5',sectionName:'A'},
 {className:'9',sectionName:'A',active:true},
 {className:'9',sectionName:'C',active:false}
];
const found=A.registeredSections(rows);
pass(found.length===3,'Inactive or duplicate class sections should not be offered');
pass(A.sections('5',rows).join('|')==='A|B','Sections A and B of same class were merged');
pass(A.sections('Grade 5',rows).join('|')==='A|B','Equivalent Grade 5 section choices were empty');
pass(A.sectionMatches('Class 5','A',rows),'Class 5 could not select genuine section A');
pass(!A.sectionMatches('Class 6','A',rows),'Class 5 section leaked into Grade 6');
pass(A.sectionMatches('5','A',rows)&&!A.sectionMatches('5','C',rows),'Unregistered section was accepted');
pass(A.classIsKnown('9',rows)&&!A.classIsKnown('12',rows),'Phantom classes must not be marked registered');
const catalog={subjects:{5:['Mathematics','English'],9:['Physics']},chapters:{'5|Mathematics':['Decimals','Fractions'],'9|Physics':['Dynamics']}};
const units=[
 {className:'5',subject:'Mathematics',unitTitle:'Fractions'},
 {class_name:'5',subject:'Mathematics',unit_title:'School Textbook - Number Patterns'},
 {className:'5',subject:'Computer Science',unitTitle:'Verified Local Unit'},
 {className:'9',subject:'Physics',unitTitle:'Kinematics'}
];
pass(A.subjects('5',catalog,units).join('|')==='Mathematics|English|Computer Science','School syllabus subjects missing from grade 5 choices');
pass(A.subjects('9',catalog,units).join('|')==='Physics','Grade 5 subject leaked into grade 9');
const chapterOptions=A.chapters('5','Mathematics',catalog,units);
pass(chapterOptions.saved.includes('Fractions')&&chapterOptions.saved.includes('School Textbook - Number Patterns'),'Saved school textbook chapters not suggested');
pass(chapterOptions.concepts.includes('Decimals')&&!chapterOptions.concepts.includes('Fractions'),'Concept suggestions must not duplicate school-saved chapters');
pass(!A.chapters('9','Physics',catalog,units).saved.includes('Fractions'),'Cross-grade chapter leakage');
pass(A.subjects('Nursery',catalog,[]).length===0,'Unconfigured nursery must not invent subjects');
// School labels can differ from reference-catalog subject names. Do not
// substitute unrelated subjects or merge saved chapters across grades.
const subjectAliases={
 subjects:{5:['Mathematics','General Science','Computer Science','Islamiat / Ethics','Pakistan Studies']},
 chapters:{
  '5|Mathematics':['Decimals','Fractions'],
  '5|General Science':['Energy','Matter'],
  '5|Computer Science':['Input and Output'],
  '5|Islamiat / Ethics':['Cleanliness'],
  '5|Pakistan Studies':['National Symbols'],
  '6|Mathematics':['Grade Six Only']
 }
};
const aliasUnits=[
 {class_name:'Grade 5',subject:'Math',unit_title:'Fractions'},
 {class_name:'Class 5',subject:'Mathematics',unit_title:'Verified School Number Patterns'},
 {class_name:'Grade 5',subject:'Islamiyat',unit_title:'School Recorded Prayer'},
 {class_name:'Grade 5',subject:'Pak Studies',unit_title:'Pakistan History'},
 {class_name:'Grade 6',subject:'Math',unit_title:'Other Grade Only'}
];
pass(A.subjectKey('Math')===A.subjectKey('Mathematics'),'Mathematics aliases are not equivalent');
pass(A.subjectKey('Islamiyat')===A.subjectKey('Islamiat / Ethics'),'Islamiat aliases are not equivalent');
pass(A.subjectKey('Biology')!==A.subjectKey('General Science'),'Unrelated science subjects were merged');
const aliasSubjects=A.subjects('5',subjectAliases,aliasUnits);
pass(aliasSubjects.filter(x=>A.subjectKey(x)==='mathematics').length===1,'Math and Mathematics appeared twice in subject dropdown');
pass(aliasSubjects.includes('Computer Science')&&aliasSubjects.includes('Pakistan Studies'),'Other class subjects disappeared');
const aliasChapters=A.chapters('Class 5','Math',subjectAliases,aliasUnits);
pass(aliasChapters.saved.includes('Fractions')&&aliasChapters.saved.includes('Verified School Number Patterns'),'Saved Math chapters missing under alias label');
pass(aliasChapters.concepts.includes('Decimals')&&!aliasChapters.concepts.includes('Fractions'),'Subject alias failed reference topics/dedup');
pass(A.chapters('5','Islamiat / Ethics',subjectAliases,aliasUnits).saved.includes('School Recorded Prayer'),'Islamiyat school unit missing');
pass(A.chapters('Grade 5','Islamiyat',subjectAliases,aliasUnits).concepts.includes('Cleanliness'),'Islamiat reference concepts missing');
pass(A.chapters('5','Pakistan Studies',subjectAliases,aliasUnits).saved.includes('Pakistan History'),'Pak Studies recorded units missing');
pass(!A.chapters('5','Mathematics',subjectAliases,aliasUnits).saved.includes('Other Grade Only'),'Grade 6 chapter leaked into Grade 5');
// School staff can save a unit as "Grade 5" while class selectors use "5".
// Both must resolve to one grade without exposing another class's units.
const aliasUnits=[
 {class_name:'Grade 5',subject:'Mathematics',unit_title:'Saved Number Patterns'},
 {class_name:'Class 5',subject:'Computer Science',unit_title:'School Computing Chapter'},
 {class_name:'Grade 6',subject:'Mathematics',unit_title:'Grade 6 only'},
 {class_name:'5-A',subject:'Mathematics',unit_title:'Other class identifier'}
];
pass(A.sameClass('5','Grade 5')&&A.sameClass('Class 5','5'),'Whole-grade aliases must match');
pass(!A.sameClass('5','6')&&!A.sameClass('5','5-A')&&!A.sameClass('','5'),'Unrelated or blank class labels cannot match');
pass(A.subjects('5',catalog,aliasUnits).includes('Computer Science'),'Saved unit subjects lost when grade label differs');
pass(A.chapters('Class 5','Mathematics',catalog,aliasUnits).saved.join('|')==='Saved Number Patterns','School chapter missing under Grade/Class alias');
pass(!A.chapters('Grade 5','Mathematics',catalog,aliasUnits).saved.includes('Grade 6 only'),'Cross-grade syllabus leakage');
pass(!A.chapters('Grade 5','Mathematics',catalog,aliasUnits).saved.includes('Other class identifier'),'Section-like class labels must remain separate');
const lesson=read('lesson-plan-center.js');
for(const x of ['function registeredClasses()','function savedUnits()','syllabusOptionData','sectionList(prefix)','Choose an accessible registered class / section'])
 pass(lesson.includes(x),'Lesson Plan registered-school dropdown or save guard missing: '+x);
pass(!lesson.includes("['Play Group','Nursery','Prep',...Array.from({length:12}"),'Lesson Plan has fake default class options');
pass(lesson.includes('window.EDUNIZAM_ACADEMIC_FORM_OPTIONS?.registeredSections(rows)'), 'Lesson Plan scope not using actual school/role records');
pass(lesson.includes('EDUNIZAM_ACADEMIC_FORM_OPTIONS?.sections(cls,registeredClasses())'),'Lesson Plan did not use grade-aware real sections');
pass(lesson.includes('school-saved syllabus unit(s)')&&lesson.includes('unverified concept suggestion(s)'), 'School chapters and conceptual topics must be labeled differently');
const diary=read('daily-class-diary.js');
pass(diary.includes("esc(x.class_name+'|'+(x.section_name||''))"), 'Same-grade Diary class A / B section values not unique');
pass(diary.includes('teacherClasses.some(c=>String(c.class_name)===v.cls&&String(c.section_name||\'\')===v.sec)'), 'Diary teacher cannot be allowed to write an unassigned class/section');
pass(diary.includes('id="diarySyllabusNote"')&&diary.includes('EDUNIZAM_ACADEMIC_FORM_OPTIONS'),'Diary syllabus suggestions unavailable');
pass(diary.includes('if(inst!==String(cfg().institutionId||\'\')||uid!==String(cloud()?.state?.user?.id||\'\'))return;'), 'Stale diary classes must not survive user/school switch');
const schedule=read('timetable-date-sheet.js');
pass(schedule.includes('EDUNIZAM_ACADEMIC_FORM_OPTIONS?.registeredSections(rows)'),'Timetable class picker not based on registered classes');
pass(schedule.includes('EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||[]'),'Timetable family class filter must fail closed');
pass(schedule.includes('&&x.active!==false')||schedule.includes('x.active!==false'),'Inactive class should not be selectable');
pass(schedule.includes('!canManage()||!knownClass(item)'),'Timetable / date sheet missing current-role registered class validation');
pass(schedule.includes('Number.isInteger(item.totalMarks)')&&schedule.includes('Number.isInteger(item.periodNumber)'),'Schedule accepts fractional period or marks');
pass(!schedule.includes("['Play Group','Nursery','Prep',...Array.from({length:12}"),'Unregistered placeholder classes leaked into timetable');
const loader=read('feature-loader.js');
for(const [view,entry]of [
 ['lessoncenter',"['academic-form-options.js','lesson-plan-center.js']"],
 ['schedulecenter',"['academic-form-options.js','timetable-date-sheet.js']"],
 ['dailydiary',"['academic-form-options.js','daily-class-diary.js','academic-workflow-deep.js']"]
])pass(loader.includes(view+':'+entry),'Academic module loader ordering missing: '+view);
console.log('EduNizam academic-form options PASS: class/section enrollment, role scope, saved syllabus vs conceptual topics, same-class diary sections, period/marks validation and module load order.');
