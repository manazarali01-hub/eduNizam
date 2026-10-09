/* Readiness center contract checks: read-only count queries, no invented school data. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ok=(x,m)=>{if(!x)throw new Error(m)};
const catalog={window:{}};
runInNewContext(read('academic-option-catalog.js'),catalog,{filename:'academic-option-catalog.js'});
const calls=[];
const queryFactory=table=>{
 const q={
  select:(fields,opts)=>{calls.push(['select',table,fields,opts]);return q},
  eq:(field,value)=>{calls.push(['eq',table,field,value]);return q},
  then:(resolve,reject)=>Promise.resolve({count:3,error:null}).then(resolve,reject)
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
ok(app&&app.definitions.length===9,'Readiness should cover nine data-dependent school areas');
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
ok(calls.filter(x=>x[0]==='select').length===9,'Incorrect school table count calls');
for(const call of calls.filter(x=>x[0]==='select')){
 ok(call[2]==='id'&&call[3].head===true&&call[3].count==='exact','Query fetched private rows instead of a head-only aggregate count');
}
for(const call of calls.filter(x=>x[0]==='eq'))ok(call[2]==='institution_id'&&call[3]==='test-school','Query lacked school isolation');
ok(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(source),'Readiness code should never create, change or delete school data');
const missing={classes:{status:'ok',count:0},staff:{status:'ok',count:0},students:{status:'ok',count:0},questions:{status:'ok',count:0},units:{status:'ok',count:0},lessons:{status:'ok',count:0},timetable:{status:'ok',count:0},datesheets:{status:'ok',count:0},library:{status:'unknown'}};
const setup=app.nextSteps(missing);
ok(setup.length===9,'Missing readiness actions absent');
ok(setup.slice(0,4).map(x=>x.key).join(',')==='classes,staff,students,units','School setup action prerequisites out of order');
ok(setup.at(-1).key==='library'&&setup.at(-1).status==='unknown','Connection errors must not be treated as missing books');
ok(app.nextSteps(Object.fromEntries(app.definitions.map(x=>[x.key,{status:'ok',count:3}]))).length===0,'A nonzero record count must not create fake missing actions');
ok(app.scope()==='test-school|test-head','Readiness school/user cache scope not correctly separated');
ok(source.includes('forgetOtherSchool()')&&source.includes('auditScope=scope()'),'Previous school readiness results not cleared on institution switch');

const nav=read('app.html'),loader=read('feature-loader.js'),scope=read('role-scope.js'),main=read('app.js');
ok(nav.includes('id="dataReadinessApp"')&&nav.includes('data-view="datareadiness"'),'Missing readiness navigation/view');
ok(loader.includes("datareadiness:['lessonCatalog']")&&loader.includes("datareadiness:['school-data-readiness.js']"),'Readiness lightweight loader incorrectly mapped');
ok(scope.includes("'auditcenter','datareadiness','settings'")&&main.includes("'assistant','datareadiness','settings'"),'Readiness not restricted to Head role');
console.log('EduNizam data-readiness gate PASS: 12 grades, 9 on-demand RLS-scoped count targets, read-only counts, head-only navigation.');
