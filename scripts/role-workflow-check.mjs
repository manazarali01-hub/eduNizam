import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=4174;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    if(u.pathname==='/role-harness'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="mount"></main></body></html>');
      return;
    }
    let rel=decodeURIComponent(u.pathname).replace(/^\\/+/, '');
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
      res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');return;
    }
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(error){
    res.writeHead(500,{'content-type':'text/plain'});res.end(String(error?.message||error));
  }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});

const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleUrl);
const launchOptions={headless:true};
if(process.env.EDUNIZAM_BROWSER)launchOptions.executablePath=process.env.EDUNIZAM_BROWSER;
const browser=await chromium.launch(launchOptions);
const failures=[];

function fail(scope,message,detail=''){failures.push({scope,message,detail})}
async function newPage(){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  page.setDefaultTimeout(6000);
  page.setDefaultNavigationTimeout(9000);
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1')route.continue(); else route.abort();
  });
  await page.addInitScript(()=>{
    window.alert=(message)=>{sessionStorage.setItem('qa_last_alert',String(message||''))};
    window.confirm=()=>true;
    window.prompt=()=> 'QA resolution';
  });
  return {context,page};
}

async function teacherLeave(){
  const {context,page}=await newPage();
  try{
    await page.goto('http://127.0.0.1:'+port+'/role-harness',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('mount').innerHTML='<div id="leaveCenterApp"></div>';
      localStorage.clear();sessionStorage.clear();
      localStorage.setItem('edunizam_session',JSON.stringify({role:'teacher',identity:'teacher@example.test'}));
      window.EDUNIZAM_CLOUD_CONFIG={enabled:false,institutionId:''};
      window.EDUNIZAM_CLOUD={state:{client:null,user:null}};
    });
    await page.addScriptTag({url:'http://127.0.0.1:'+port+'/leave-center.js'});
    await page.waitForSelector('#submitLeave',{state:'visible'});
    await page.locator('#leaveReason').fill('Medical appointment');
    await page.locator('#leaveGuardianNote').fill('QA teacher leave');
    await page.locator('#submitLeave').tap();
    await page.waitForFunction(()=>{
      try{return (JSON.parse(localStorage.getItem('edunizam_leave_requests_v3')||'[]')).length>0}catch(_){return false}
    });
    const state=await page.evaluate(()=>{
      const rows=JSON.parse(localStorage.getItem('edunizam_leave_requests_v3')||'[]');
      return {row:rows[0]||null,disabled:document.getElementById('submitLeave')?.disabled||false,alert:sessionStorage.getItem('qa_last_alert')||''};
    });
    if(!state.row||state.row.leaveFor!=='staff'||state.row.submittedRole!=='teacher'||state.row.status!=='Pending'||state.disabled){
      fail('teacher leave','Teacher leave did not persist as a usable Pending request',JSON.stringify(state));
    }
  }catch(error){fail('teacher leave','Teacher leave interaction failed',error?.message||String(error))}
  finally{await context.close()}
}

async function teacherDiary(){
  const {context,page}=await newPage();
  try{
    await page.goto('http://127.0.0.1:'+port+'/role-harness',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('mount').innerHTML='<div id="dailyDiaryApp"></div>';
      localStorage.clear();sessionStorage.clear();
      localStorage.setItem('edunizam_session',JSON.stringify({role:'teacher',identity:'teacher@example.test',institutionId:'school-1',source:'supabase'}));
      window.EDUNIZAM_CLOUD_CONFIG={enabled:true,institutionId:'school-1'};
      const user={id:'teacher-1',email:'teacher@example.test'};
      const makeQuery=(table)=>{
        const q={
          select(){return q},eq(){return q},gte(){return q},lte(){return q},in(){return q},order(){return q},limit(){return q},
          maybeSingle(){return Promise.resolve({data:null,error:null})},
          update(payload){sessionStorage.setItem('qa_diary_update',JSON.stringify(payload));return q},
          delete(){return q},
          upsert(payload,options){sessionStorage.setItem('qa_diary_upsert',JSON.stringify({payload,options}));return Promise.resolve({data:null,error:null})},
          then(resolve,reject){
            let data=[];
            if(table==='class_sections')data=[{class_name:'5',section_name:'A'}];
            return Promise.resolve({data,error:null}).then(resolve,reject);
          }
        };
        return q;
      };
      window.EDUNIZAM_CLOUD={state:{client:{from:table=>makeQuery(table)},user,initialized:true},user};
    });
    await page.addScriptTag({url:'http://127.0.0.1:'+port+'/daily-class-diary.js'});
    await page.waitForFunction(()=>document.querySelectorAll('#diaryClass option').length>1);
    await page.locator('#diaryClass').selectOption('5');
    await page.locator('#diarySubject').fill('Mathematics');
    await page.locator('#diaryTopic').fill('Fractions');
    await page.locator('#diaryHomework').fill('Exercise 4');
    await page.locator('#saveDiary').tap();
    await page.waitForFunction(()=>!!sessionStorage.getItem('qa_diary_upsert'));
    const state=await page.evaluate(()=>({
      saved:JSON.parse(sessionStorage.getItem('qa_diary_upsert')||'null'),
      buttonText:document.getElementById('saveDiary')?.textContent||'',
      alert:sessionStorage.getItem('qa_last_alert')||''
    }));
    const p=state.saved?.payload;
    if(!p||p.institution_id!=='school-1'||p.teacher_user_id!=='teacher-1'||p.class_name!=='5'||p.section_name!=='A'||p.subject!=='Mathematics'||p.topic!=='Fractions'){
      fail('teacher diary','Teacher diary did not save the assigned class payload',JSON.stringify(state));
    }
  }catch(error){fail('teacher diary','Teacher diary interaction failed',error?.message||String(error))}
  finally{await context.close()}
}

async function studentSubmission(){
  const {context,page}=await newPage();
  try{
    await page.goto('http://127.0.0.1:'+port+'/role-harness',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('mount').innerHTML='<div id="schoolWorkApp"></div>';
      localStorage.clear();sessionStorage.clear();
      localStorage.setItem('edunizam_session',JSON.stringify({role:'student',identity:'student@example.test'}));
      localStorage.setItem('edunizam_students',JSON.stringify([{id:1,name:'QA Student',className:'5',sectionName:'A'}]));
      localStorage.setItem('edunizam_school_work_v1',JSON.stringify({
        announcements:[],
        homework:[{id:'hw-1',className:'5',sectionName:'A',subject:'Science',title:'Plants Project',details:'Write notes',dueDate:'2099-12-31',assignmentType:'homework',maxMarks:20,allowSubmission:true,allowLateSubmission:true,createdBy:'teacher@example.test',createdRole:'teacher',createdAt:new Date().toISOString()}],
        submissions:[],
        timetable:[]
      }));
      window.EDUNIZAM_CLOUD_CONFIG={enabled:false,institutionId:''};
      window.EDUNIZAM_CLOUD={state:{client:null,user:null}};
    });
    await page.addScriptTag({url:'http://127.0.0.1:'+port+'/school-work.js'});
    await page.waitForSelector('[data-sw-tab="homework"]',{state:'visible'});
    await page.locator('[data-sw-tab="homework"]').tap();
    await page.waitForSelector('[data-sw-submit="hw-1"]',{state:'visible'});
    await page.locator('[data-sw-submit-text="hw-1"]').fill('My project answer');
    await page.locator('[data-sw-submit="hw-1"]').tap();
    await page.waitForFunction(()=>{
      try{return (JSON.parse(localStorage.getItem('edunizam_school_work_v1')||'{}').submissions||[]).length>0}catch(_){return false}
    });
    const state=await page.evaluate(()=>{
      const d=JSON.parse(localStorage.getItem('edunizam_school_work_v1')||'{}');
      return {row:d.submissions?.[0]||null,alert:sessionStorage.getItem('qa_last_alert')||''};
    });
    if(!state.row||String(state.row.homeworkId)!=='hw-1'||String(state.row.studentId)!=='1'||state.row.status!=='submitted'||state.row.text!=='My project answer'){
      fail('student homework','Student assignment submission did not persist correctly',JSON.stringify(state));
    }
  }catch(error){fail('student homework','Student assignment interaction failed',error?.message||String(error))}
  finally{await context.close()}
}

async function parentPrivateComplaint(){
  const {context,page}=await newPage();
  try{
    await page.goto('http://127.0.0.1:'+port+'/role-harness',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('mount').innerHTML='<div id="parentComplaintApp"></div>';
      localStorage.clear();sessionStorage.clear();
      localStorage.setItem('edunizam_session',JSON.stringify({role:'parent',identity:'parent@example.test',institutionId:'school-1',source:'supabase'}));
      localStorage.setItem('edunizam_students',JSON.stringify([{id:1,name:'QA Child',className:'5',sectionName:'A'}]));
      window.EDUNIZAM_CLOUD_CONFIG={enabled:true,institutionId:'school-1',complaintStorageBucket:'parent-complaints'};
      const user={id:'parent-1',email:'parent@example.test'};
      const makeQuery=()=> {
        const q={
          select(){return q},eq(){return q},in(){return q},order(){return q},insert(){return q},
          single(){return Promise.resolve({data:{id:'row-1'},error:null})},
          maybeSingle(){return Promise.resolve({data:null,error:null})},
          then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
        };
        return q;
      };
      const client={
        rpc:(name,args={})=>{
          if(name==='list_parent_teacher_directory_v1')return Promise.resolve({data:[],error:null});
          if(name==='create_parent_admin_complaint_v1'){
            sessionStorage.setItem('qa_parent_admin_rpc',JSON.stringify(args));
            return Promise.resolve({data:{id:'pa-1'},error:null});
          }
          return Promise.resolve({data:null,error:null});
        },
        from:()=>makeQuery(),
        storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),upload:()=>Promise.resolve({error:null}),remove:()=>Promise.resolve({error:null})})}
      };
      window.EDUNIZAM_CLOUD={state:{client,user,initialized:true}};
    });
    await page.addScriptTag({url:'http://127.0.0.1:'+port+'/parent-complaint-center.js'});
    await page.waitForSelector('#paSend',{state:'visible'});
    await page.locator('#paSubject').fill('Transport concern');
    await page.locator('#paMessage').fill('Please review the pickup timing.');
    await page.locator('#paSend').tap();
    await page.waitForFunction(()=>!!sessionStorage.getItem('qa_parent_admin_rpc'));
    await page.waitForSelector('#paSend',{state:'visible'});
    const state=await page.evaluate(()=>({
      rpc:JSON.parse(sessionStorage.getItem('qa_parent_admin_rpc')||'null'),
      disabled:document.getElementById('paSend')?.disabled||false,
      alert:sessionStorage.getItem('qa_last_alert')||''
    }));
    if(state.rpc?.p_institution_id!=='school-1'||state.rpc?.p_subject!=='Transport concern'||state.rpc?.p_message!=='Please review the pickup timing.'||state.disabled){
      fail('parent complaint','Parent private complaint did not submit and recover the control',JSON.stringify(state));
    }
  }catch(error){fail('parent complaint','Parent private complaint interaction failed',error?.message||String(error))}
  finally{await context.close()}
}

try{
  await teacherLeave();
  await teacherDiary();
  await studentSubmission();
  await parentPrivateComplaint();
}finally{
  await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}

if(failures.length){
  console.error('EduNizam role workflow QA FAILED');
  for(const f of failures)console.error('FAIL',f.scope,'-',f.message,f.detail||'');
  process.exit(1);
}
console.log('EduNizam role workflow QA passed: Teacher leave, Teacher diary, Student assignment, Parent private complaint.');
