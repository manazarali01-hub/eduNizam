/* Readiness center contract checks: read-only count queries, no invented school data. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ok=(x,m)=>{if(!x)throw new Error(m)};
const catalog={window:{}};
runInNewContext(read('academic-option-catalog.js'),catalog,{filename:'academic-option-catalog.js'});
const calls=[],metadataRanges=[];
const queryFactory=table=>{
 let selectedFields='',headOnly=false,from=0,to=999;
 const q={
  select:(fields,opts)=>{selectedFields=fields;headOnly=!!opts?.head;calls.push(['select',table,fields,opts]);return q},
  eq:(field,value)=>{calls.push(['eq',table,field,value]);return q},
  range:(start,end)=>{from=start;to=end;metadataRanges.push([start,end]);return q},
  then:(resolve,reject)=>{
   if(table==='syllabus_progress_units'&&!headOnly){
    const data=Array.from({length:Math.max(0,Math.min(to-from+1,1205-from))},(_,i)=>({
     unit_title:'Chapter '+(from+i+1),textbook_title:'School Mathematics',curriculum_board:'Punjab',
     edition_year:2026,source_url:'https://pectaa.edu.pk/'
    }));
    return Promise.resolve({data,error:null}).then(resolve,reject);
   }
   return Promise.resolve({count:3,error:null}).then(resolve,reject);
  }
 };
 return q;
};
const window={
 EDUNIZAM_ACADEMIC_OPTION_CATALOG:catalog.window.EDUNIZAM_ACADEMIC_OPTION_CATALOG,
 EDUNIZAM_CLOUD:{state:{user:{id:'test-head'},client:{from:queryFactory}}},
 EDUNIZAM_CLOUD_CONFIG:{institutionId:'test-school'}
};
const document={readyState:'loading',addEventListener:()=>{}};
const localStorage={getItem:()=>JSON.stringify({role:'head'})};
const source=read('school-data-readiness.js');
runInNewContext(source,{window,document,localStorage,Promise,setTimeout,clearTimeout,AbortController,console},{timeout:1800});
const app=window.EDUNIZAM_DATA_READINESS;
ok(app&&app.definitions.length===28,'Readiness should cover 28 school data areas');
ok(app.definitions.filter(x=>!x.activity).length===9,'Nine initial school setup areas must stay distinct');
ok(app.definitions.filter(x=>x.activity).length===19,'Operational activity must be checked without calling zero a setup failure');
const grades=[1,2,3,4,5,6,7,8,9,10,11,12];
for(const grade of grades){
 const subjects=app.referenceSubjects(grade);
 ok(subjects.length>=4,'Missing Grade '+grade+' reference subjects');
 for(const subject of subjects)ok(app.referenceTopics(grade,subject).length>0,'Missing topic data: '+grade+' / '+subject);
}
for(const def of app.definitions){
 const result=await app.countOne(def,'test-school');
 ok(result.status==='ok'&&result.count===3,'Read-only count failed for '+def.table);
}
ok(calls.filter(x=>x[0]==='select').length===28,'Incorrect school table count calls');
for(const call of calls.filter(x=>x[0]==='select')){
 ok(call[2]==='id'&&call[3].head===true&&call[3].count==='exact','Query fetched private rows instead of a head-only aggregate count');
}
for(const call of calls.filter(x=>x[0]==='eq'))ok(call[2]==='institution_id'&&call[3]==='test-school','Query lacked school isolation');
ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(source),'Readiness code should never create, change or delete school data');
for(const table of ['attendance_records','result_records','homework_items','homework_submissions','daily_class_diaries','school_announcements','teacher_training_records','transport_routes']){
 ok(app.definitions.some(x=>x.table===table&&x.activity),'Missing operational activity table: '+table);
}
ok(source.includes('x.activity?')&&source.includes('No activity recorded'),'Empty activity must not be labelled a failed setup');
ok(source.includes('for(let i=0;i<spec.length;i+=7)'),'Audit must progressively load with bounded concurrent count requests');
ok(source.includes('scope()!==requestScope'),'Account and school changes must invalidate an in-flight audit');
const missing={classes:{status:'ok',count:0},staff:{status:'ok',count:0},students:{status:'ok',count:0},questions:{status:'ok',count:0},units:{status:'ok',count:0},lessons:{status:'ok',count:0},timetable:{status:'ok',count:0},datesheets:{status:'ok',count:0},library:{status:'unknown'}};
const setup=app.nextSteps(missing);
ok(setup.length===9,'Missing readiness actions absent');
ok(setup.slice(0,4).map(x=>x.key).join(',')==='classes,staff,students,units','School setup action prerequisites out of order');
ok(setup.at(-1).key==='library'&&setup.at(-1).status==='unknown','Connection errors must not be treated as missing books');
const existingStudentsWithoutGroups=app.nextSteps({
 classes:{status:'ok',count:0},students:{status:'ok',count:2},
 staff:{status:'ok',count:0},units:{status:'ok',count:0},
 questions:{status:'ok',count:0},lessons:{status:'ok',count:0},
 timetable:{status:'ok',count:0},datesheets:{status:'ok',count:0},
 library:{status:'ok',count:0}
});
ok(/2 student records already exist/.test(existingStudentsWithoutGroups[0].text),
 'Readiness should warn when student records predate class/section setup');
ok(/reconcile existing student assignments/.test(existingStudentsWithoutGroups[0].text),
 'Readiness should direct the Head to reconcile existing student assignments');
ok(/avoid re-importing these students/.test(existingStudentsWithoutGroups[0].text),
 'Readiness should warn against duplicate student imports');
ok(app.nextSteps(Object.fromEntries(app.definitions.map(x=>[x.key,{status:'ok',count:3}]))).length===0,'A nonzero record count must not create fake missing actions');

// The Head's exam blocker must be based on actual accessible school records,
// never published example questions or indexed generic curriculum topics.
const examStages=[
 [{classes:{status:'ok',count:0},units:{status:'ok',count:0},questions:{status:'ok',count:0}},'classes','classcenter'],
 [{classes:{status:'ok',count:2},units:{status:'ok',count:0},questions:{status:'ok',count:0}},'units','lessoncenter'],
 [{classes:{status:'ok',count:2},units:{status:'ok',count:8},questions:{status:'ok',count:0}},'questions','paperbuilder']
];
for(const [counts,key,view] of examStages){
 const p=app.paperPrerequisites(counts,{status:'ok',reviewed:8,total:8,incomplete:0});
 ok(p.state==='missing'&&p.key===key&&p.view===view,'Wrong next school-exam setup prerequisite: '+key);
}
const unknownExam=app.paperPrerequisites({classes:{status:'unknown'},units:{status:'ok',count:0}});
ok(unknownExam.state==='unknown','Unavailable database count was misrepresented as missing data');
const completeCountedExam={classes:{status:'ok',count:1},units:{status:'ok',count:3},questions:{status:'ok',count:5}};
const incompleteExam=app.paperPrerequisites(completeCountedExam,{status:'ok',reviewed:3,total:3,incomplete:0});
ok(incompleteExam.state==='review'&&/no completeness percentage/.test(incompleteExam.text),'A few rows falsely certified a usable exam paper');
const missingMeta=app.paperPrerequisites(completeCountedExam,{status:'ok',reviewed:3,total:3,incomplete:2});
ok(missingMeta.state==='missing'&&missingMeta.key==='unitMetadata'&&missingMeta.view==='lessoncenter'&&/2 of 3/.test(missingMeta.text),'Incomplete textbook metadata must block exam-readiness before Paper Builder');
const uncheckedMeta=app.paperPrerequisites(completeCountedExam,null);
ok(uncheckedMeta.state==='unknown'&&uncheckedMeta.view==='lessoncenter','Pending textbook metadata cannot imply school exam readiness');
const sampledMeta=app.paperPrerequisites(completeCountedExam,{status:'sample',reviewed:1000,total:1200,incomplete:0});
ok(sampledMeta.state==='unknown'&&/1000 of 1200/.test(sampledMeta.text),'First 1000 clean records cannot certify a larger syllabus');
const unknownMeta=app.paperPrerequisites(completeCountedExam,{status:'unknown'});
ok(unknownMeta.state==='unknown','Unable to read textbook metadata must not be silently accepted');
const missingQuestion=app.paperPrerequisites({classes:{status:'ok',count:1},units:{status:'ok',count:3},questions:{status:'ok',count:0}},{status:'ok',reviewed:3,total:3,incomplete:0});
ok(missingQuestion.key==='questions','Question import must be the next step once complete book metadata exists');
ok(source.includes('paperPrerequisites(counts,unitQuality)'),'Exam readiness card must use checked school syllabus metadata');
ok(app.paperPrerequisites(null).state==='unchecked','Unrun audit should not imply a missing school');
ok(source.includes('id="readinessPaperPrerequisites"')&&source.includes('data-readiness-action')&&source.includes('id="readinessPaperSetup"'),
 'The missing exam-data summary and actionable school setup control are absent');
ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(source),
 'Readiness source is no longer strictly read-only');
// School-entered book metadata must be checked independently of row counts.
const meta=app.evaluateUnitMetadata([
 {unit_title:'Fractions',textbook_title:'School Mathematics',curriculum_board:'Punjab',edition_year:2026,source_url:'https://pectaa.edu.pk/'},
 {unit_title:' ',textbook_title:' ',curriculum_board:'Punjab',edition_year:null,source_url:''},
 {unit_title:'Addition',textbook_title:'Mathematics',curriculum_board:' ',edition_year:'202A',source_url:'javascript:alert(1)'}
],3);
ok(meta.status==='ok'&&meta.reviewed===3&&meta.incomplete===2,'Metadata quality must reveal incomplete school syllabus units');
ok(meta.missingChapter===1&&meta.missingTextbook===1&&meta.missingBoard===1&&meta.invalidEdition===1&&meta.invalidSource===1,'Metadata quality issue types incorrectly counted');
ok(app.evaluateUnitMetadata([{unit_title:'1',textbook_title:'Math',curriculum_board:'Punjab'}],3).status==='sample','Partial metadata input must not be falsely reported as complete coverage');
ok(app.evaluateUnitMetadata([{unit_title:'1',textbook_title:'Math',curriculum_board:'Punjab',edition_year:2026,source_url:'https://pectaa.edu.pk/'}],1).incomplete===0,'Complete school-entered metadata rejected');
const pagedMeta=await app.readUnitQuality('test-school',1205);
ok(pagedMeta.status==='ok'&&pagedMeta.reviewed===1205&&pagedMeta.total===1205,'Syllabus metadata audit must verify every page beyond 1000 records');
ok(metadataRanges.length===2&&metadataRanges[0][0]===0&&metadataRanges[1][0]===1000,'Syllabus metadata audit did not request consecutive pages');
ok(source.includes("select('unit_title,textbook_title,curriculum_board,edition_year,source_url')")&&source.includes('.eq(\'institution_id\',id).range('),'Metadata query may fetch student/private fields or another school');
ok(source.includes('id="readinessUnitQuality"')&&source.includes('scope()!==requestScope'),'Metadata status UI/scope isolation missing');
ok(app.scope()==='test-school|test-head','Readiness school/user cache scope not correctly separated');
ok(source.includes('data-readiness-action')&&source.includes('EDUNIZAM_APP_NAV?.setView?.(view)'),'No working setup navigation for real missing school data');
ok(source.includes('forgetOtherSchool()')&&source.includes('auditScope=requestScope')&&source.includes('scope()!==requestScope'),'Previous school readiness results not cleared on institution switch');

const nav=read('app.html'),loader=read('feature-loader.js'),scope=read('role-scope.js'),main=read('app.js');
ok(nav.includes('id="dataReadinessApp"')&&nav.includes('data-view="datareadiness"'),'Missing readiness navigation/view');
ok(loader.includes("datareadiness:['lessonCatalog']")&&loader.includes("datareadiness:['school-data-readiness.js']"),'Readiness lightweight loader incorrectly mapped');
ok(scope.includes("'auditcenter','datareadiness','settings'")&&main.includes("'assistant','datareadiness','settings'"),'Readiness not restricted to Head role');
console.log('EduNizam data-readiness gate PASS: 12 grades, 28 on-demand read-only scoped count targets (9 setup, 19 activity), no fake completion score.');
