import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=4173;
const mime={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.webp':'image/webp',
  '.txt':'text/plain; charset=utf-8',
  '.xml':'application/xml; charset=utf-8'
};
const server=http.createServer((req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if(!rel)rel='index.html';
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
      res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');return;
    }
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(e){
    res.writeHead(500,{'content-type':'text/plain'});res.end(String(e.message||e));
  }
});
await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,'127.0.0.1',resolve);
});

const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleUrl);
const launchOptions={headless:true};
if(process.env.EDUNIZAM_BROWSER)launchOptions.executablePath=process.env.EDUNIZAM_BROWSER;
const browser=await chromium.launch(launchOptions);
const failures=[];
const widths=[360,375,390,412,430,768,1366];
const pages=['/','/login.html','/learn.html','/admission.html','/app.html'];

function pushFailure(scope,message,detail=''){
  failures.push({scope,message,detail});
}

async function inspectPage(page,url,width){
  if(!page.__eduLocalRouteInstalled){
    await page.route('**/*',route=>{
      const requestUrl=new URL(route.request().url());
      if(requestUrl.hostname==='127.0.0.1')route.continue();
      else route.abort();
    });
    page.__eduLocalRouteInstalled=true;
  }
  const errors=[];
  page.removeAllListeners('pageerror');
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForTimeout(140);

  const result=await page.evaluate(()=>{
    const root=document.documentElement;
    const body=document.body;
    const viewport=root.clientWidth;
    const overflow=Math.max(root.scrollWidth,body?.scrollWidth||0)-viewport;
    const visible=el=>{
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
      const r=el.getBoundingClientRect();
      return r.width>1&&r.height>1;
    };
    const intentionallyOffCanvas=el=>{
      const drawer=el.closest?.('.sidebar');
      if(!drawer||drawer.classList.contains('mobile-nav-open'))return false;
      const r=drawer.getBoundingClientRect();
      return r.right<=2||r.left>=viewport-2;
    };
    const scrollAncestor=el=>{
      let p=el.parentElement;
      while(p&&p!==document.body){
        const cs=getComputedStyle(p);
        if(/auto|scroll/.test(cs.overflowX)&&p.scrollWidth>p.clientWidth+2)return true;
        p=p.parentElement;
      }
      return false;
    };
    const clipped=[];
    const wideElements=[];
    document.querySelectorAll('body *').forEach(el=>{
      if(!visible(el)||intentionallyOffCanvas(el)||scrollAncestor(el))return;
      const r=el.getBoundingClientRect();
      if(r.left<-2||r.right>viewport+2){
        const cs=getComputedStyle(el);
        wideElements.push({
          tag:el.tagName,
          id:el.id||'',
          cls:String(el.className||'').slice(0,120),
          text:String(el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,80),
          left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
          position:cs.position,overflowX:cs.overflowX
        });
      }
    });
    document.querySelectorAll('a,button,input,select,textarea,[role="button"]').forEach(el=>{
      if(!visible(el)||intentionallyOffCanvas(el)||scrollAncestor(el))return;
      const r=el.getBoundingClientRect();
      if(r.left<-2||r.right>viewport+2)clipped.push({
        tag:el.tagName,
        id:el.id||'',
        cls:String(el.className||'').slice(0,120),
        text:String(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,80),
        left:Math.round(r.left),right:Math.round(r.right),viewport
      });
    });
    const box=sel=>{
      const el=document.querySelector(sel);
      if(!el||!visible(el))return null;
      const r=el.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
    };
    const intersects=(a,b)=>!!(a&&b&&a.left<b.right-2&&a.right>b.left+2&&a.top<b.bottom-2&&a.bottom>b.top+2);
    return {
      overflow,
      clipped:clipped.slice(0,12),
      wideElements:wideElements.sort((a,b)=>(b.right-viewport)-(a.right-viewport)).slice(0,12),
      home:{
        nav:box('.page-home .public-nav'),
        main:box('.page-home .public-main'),
        image:box('.page-home .hero-image-wrap'),
        quick:box('.page-home .quick-access-card'),
        roles:box('.page-home .hero-role-badge'),
        imageQuickOverlap:intersects(box('.page-home .hero-image-wrap'),box('.page-home .quick-access-card')),
        quickRoleOverlap:intersects(box('.page-home .quick-access-card'),box('.page-home .hero-role-badge'))
      }
    };
  });

  return {result,errors};
}

try{
  for(const route of pages){
    console.log('Layout QA route:',route);
    const page=await browser.newPage({
      javaScriptEnabled:false,
      viewport:{width:widths[0],height:Math.max(760,Math.round(widths[0]*1.7))}
    });
    try{
      for(const width of widths){
        await page.setViewportSize({width,height:Math.max(760,Math.round(width*1.7))});
        const {result,errors}=await inspectPage(page,'http://127.0.0.1:'+port+route,width);
        const scope=route+' @ '+width+'px';
        if(result.overflow>2)pushFailure(scope,'Unexpected horizontal page overflow',String(result.overflow)+'px '+JSON.stringify(result.wideElements));
        if(result.clipped.length)pushFailure(scope,'Interactive controls escape the viewport',JSON.stringify(result.clipped));
        if(route==='/'&&width<=430){
          if(result.home.imageQuickOverlap)pushFailure(scope,'Homepage hero image and Quick Access overlap');
          if(result.home.quickRoleOverlap)pushFailure(scope,'Homepage Quick Access and role badge overlap');
          if(result.home.nav&&result.home.main&&result.home.main.top<result.home.nav.bottom-2){
            pushFailure(scope,'Homepage navigation covers main content',JSON.stringify({nav:result.home.nav,main:result.home.main}));
          }
        }
        if(route==='/app.html'&&width<=768){
          const sidebarExists=await page.evaluate(()=>{
            const sidebar=document.querySelector('.sidebar');
            if(!sidebar)return false;
            sidebar.classList.add('mobile-nav-open');
            return true;
          });
          if(sidebarExists)await page.waitForTimeout(120);
          const drawer=await page.evaluate(()=>{
            const sidebar=document.querySelector('.sidebar');
            if(!sidebar)return {missing:true};
            const viewport=document.documentElement.clientWidth;
            const box=sidebar.getBoundingClientRect();
            const escaped=[...sidebar.querySelectorAll('.nav-item')].filter(el=>{
              const cs=getComputedStyle(el);
              if(cs.display==='none'||cs.visibility==='hidden')return false;
              const r=el.getBoundingClientRect();
              return r.left<-2||r.right>viewport+2;
            }).slice(0,8).map(el=>{
              const r=el.getBoundingClientRect();
              return {text:String(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,60),left:Math.round(r.left),right:Math.round(r.right),viewport};
            });
            const result={missing:false,left:box.left,right:box.right,viewport,escaped};
            sidebar.classList.remove('mobile-nav-open');
            return result;
          });
          if(drawer.missing)pushFailure(scope,'Mobile sidebar is missing');
          else{
            if(drawer.left<-2||drawer.right>drawer.viewport+2)pushFailure(scope,'Open mobile sidebar escapes viewport',JSON.stringify(drawer));
            if(drawer.escaped.length)pushFailure(scope,'Open mobile sidebar controls escape viewport',JSON.stringify(drawer.escaped));
          }
        }
        const critical=errors.filter(x=>!/adsbygoogle|Failed to fetch|supabase/i.test(x));
        if(critical.length)pushFailure(scope,'Browser page errors',critical.slice(0,5).join(' | '));
      }
    }finally{
      await page.close();
    }
  }

  console.log('Layout QA static viewport sweep complete. Starting auth/mobile runtime contract.');
  // Production auth/mobile regression: login handoff must open the workspace
  // immediately, and network verification must never own the hamburger or scroll.
  const authPage=await browser.newPage({
    javaScriptEnabled:true,
    viewport:{width:360,height:760},
    isMobile:true,
    hasTouch:true
  });
  try{
    const harnessHtml='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/mobile-performance.css"></head><body class="app-page page-app"><div class="app-shell"><aside class="sidebar"><nav id="nav"><button class="nav-item active" data-view="dashboard">Dashboard</button><button class="nav-item" data-view="students">Students</button></nav></aside><main class="main" id="appMain"><header class="topbar"><div class="topbar-title"><h1>Dashboard</h1></div><div class="topbar-actions"></div></header><section id="dashboard" class="view active"><div style="height:1900px">Tall dashboard</div></section></main></div></body></html>';
    await authPage.route('**/auth-harness',route=>route.fulfill({status:200,contentType:'text/html',body:harnessHtml}));
    await authPage.route('**/login.html?from=secure-guard',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Login target</title>'}));
    await authPage.route('**/learn.html?from=secure-guard',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Guest target</title>'}));

    // No local school session: Login and Guest must be native, immediately tappable exits.
    const loadSignedOut=async()=>{
      await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
      await authPage.evaluate(()=>{
        localStorage.clear();sessionStorage.clear();
        window.EDUNIZAM_CLOUD={
          state:{client:{},user:null,initialized:true},
          whenReady:()=>Promise.resolve(window.EDUNIZAM_CLOUD),
          listAuthorizedWorkspaces:()=>Promise.resolve([])
        };
      });
      await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/data-runtime.js'});
      await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
      await authPage.waitForSelector('#cloudAuthLogin',{state:'visible',timeout:3000});
    };

    await loadSignedOut();
    const loginLink=await authPage.locator('#cloudAuthLogin').evaluate(el=>({tag:el.tagName,href:el.getAttribute('href')}));
    if(loginLink.tag!=='A'||loginLink.href!=='login.html?from=secure-guard')pushFailure('auth signed-out','Go to Login is not a native anchor',JSON.stringify(loginLink));
    await authPage.locator('#cloudAuthLogin').tap();
    await authPage.waitForURL(/\/login\.html\?from=secure-guard$/,{timeout:3000}).catch(e=>pushFailure('auth signed-out','Go to Login tap did not navigate',e.message));

    await loadSignedOut();
    await authPage.locator('#cloudAuthGuest').tap();
    await authPage.waitForURL(/\/learn\.html\?from=secure-guard$/,{timeout:3000}).catch(e=>pushFailure('auth signed-out','Continue as Guest tap did not navigate',e.message));

    // Successful login handoff with deliberately slow authorization.
    await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
    await authPage.evaluate(()=>{
      const now=Date.now();
      const user={id:'user-1',email:'admin@example.test'};
      const access={id:'school-1',name:'Test School',institution_type:'School',workspace_role:'head_of_institute'};
      localStorage.setItem('edunizam_session',JSON.stringify({
        role:'head',identity:user.email,loginAt:now,source:'supabase',institutionId:'school-1',schoolName:'Test School'
      }));
      localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify({enabled:true,institutionId:'school-1'}));
      sessionStorage.setItem('edunizam_secure_login_handoff',JSON.stringify({
        version:2,nonce:'test-nonce',userId:user.id,institutionId:'school-1',role:'head',at:now,expiresAt:now+120000
      }));
      window.__verifyCalls=0;
      window.EDUNIZAM_CLOUD_CONFIG={enabled:true,institutionId:'school-1'};
      window.EDUNIZAM_CLOUD={
        state:{client:{auth:{}},user,initialized:true},
        whenReady:()=>Promise.resolve(window.EDUNIZAM_CLOUD),
        verifyWorkspaceAccess:()=>{window.__verifyCalls++;return new Promise(resolve=>setTimeout(()=>resolve(access),1200))},
        listAuthorizedWorkspaces:()=>Promise.resolve([access])
      };
    });
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/data-runtime.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/mobile-nav-core.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});

    await authPage.waitForSelector('#eduMobileMenuBtn',{state:'visible',timeout:3000});
    const immediate=await authPage.evaluate(()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      authState:document.documentElement.dataset.authState||'',
      verifyCalls:window.__verifyCalls
    }));
    if(immediate.guardPresent)pushFailure('auth handoff','Fresh verified-login handoff left a blocking overlay mounted',JSON.stringify(immediate));
    if(!['WORKSPACE_READY','BACKGROUND_SYNC'].includes(immediate.authState))pushFailure('auth handoff','Workspace did not enter a usable state immediately',JSON.stringify(immediate));
    if(immediate.verifyCalls!==0)pushFailure('auth handoff','Fresh verified-login handoff repeated authorization during startup',JSON.stringify(immediate));

    await authPage.locator('#eduMobileMenuBtn').tap();
    await authPage.waitForTimeout(80);
    const opened=await authPage.evaluate(()=>({
      sidebar:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),
      locked:document.body.classList.contains('mobile-nav-lock'),
      expanded:document.getElementById('eduMobileMenuBtn')?.getAttribute('aria-expanded')
    }));
    if(!opened.sidebar||!opened.locked||opened.expanded!=='true')pushFailure('mobile menu interaction','Hamburger did not open the drawer during background authorization',JSON.stringify(opened));

    await authPage.locator('#eduMobileNavClose').tap();
    await authPage.waitForTimeout(80);
    const closed=await authPage.evaluate(()=>({
      sidebar:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),
      locked:document.body.classList.contains('mobile-nav-lock'),
      backdropDisplay:getComputedStyle(document.getElementById('eduMobileNavBackdrop')).display,
      backdropPointer:getComputedStyle(document.getElementById('eduMobileNavBackdrop')).pointerEvents
    }));
    if(closed.sidebar||closed.locked||closed.backdropPointer!=='none')pushFailure('mobile menu interaction','Closing drawer left a blocking mobile state',JSON.stringify(closed));

    await authPage.evaluate(()=>window.scrollTo(0,900));
    await authPage.waitForTimeout(80);
    const scrollY=await authPage.evaluate(()=>window.scrollY);
    if(scrollY<100)pushFailure('mobile scroll interaction','Dashboard could not scroll after closing the drawer',String(scrollY));

    // Redundant auth events while verification is in flight must not re-open a guard.
    await authPage.evaluate(()=>window.dispatchEvent(new CustomEvent('edunizam:auth',{detail:{event:'SIGNED_IN',user:window.EDUNIZAM_CLOUD.state.user}})));
    await authPage.waitForTimeout(150);
    const redundant=await authPage.evaluate(()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      verifyCalls:window.__verifyCalls
    }));
    if(redundant.guardPresent)pushFailure('auth handoff','Redundant SIGNED_IN event re-opened the auth overlay',JSON.stringify(redundant));
    if(redundant.verifyCalls!==0)pushFailure('auth handoff','Redundant SIGNED_IN event bypassed verification coalescing',JSON.stringify(redundant));

    await authPage.evaluate(()=>window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(false));
    const settled=await authPage.evaluate(()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      authState:document.documentElement.dataset.authState||'',
      verifyCalls:window.__verifyCalls,
      session:JSON.parse(localStorage.getItem('edunizam_session')||'null')
    }));
    if(settled.guardPresent)pushFailure('auth handoff','Background authorization re-opened a blocking overlay',JSON.stringify(settled));
    if(!['WORKSPACE_READY','BACKGROUND_SYNC'].includes(settled.authState))pushFailure('auth handoff','Background authorization did not settle to a usable workspace state',JSON.stringify(settled));
    if(settled.verifyCalls!==1)pushFailure('auth handoff','Explicit background verification did not execute exactly once',JSON.stringify(settled));

    // Temporary session restoration failures must preserve a valid local shell.
    await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
    await authPage.evaluate(()=>{
      const now=Date.now();
      localStorage.setItem('edunizam_session',JSON.stringify({
        role:'head',identity:'admin@example.test',loginAt:now,source:'supabase',institutionId:'school-1',schoolName:'Test School'
      }));
      localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify({enabled:true,institutionId:'school-1'}));
      window.EDUNIZAM_CLOUD={
        state:{client:{auth:{}},user:null,initialized:true,authEvent:'INITIAL_SESSION',sessionRestoreStatus:'error',sessionRestoreError:{message:'temporary refresh failure'}},
        whenReady:()=>Promise.resolve(window.EDUNIZAM_CLOUD),
        verifyWorkspaceAccess:()=>Promise.reject(new Error('should not verify without a restored user'))
      };
    });
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/data-runtime.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/mobile-nav-core.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
    await authPage.waitForSelector('#eduMobileMenuBtn',{state:'visible',timeout:3000});
    await authPage.waitForTimeout(180);
    const transientRestore=await authPage.evaluate(()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      authState:document.documentElement.dataset.authState||'',
      session:JSON.parse(localStorage.getItem('edunizam_session')||'null')
    }));
    if(transientRestore.guardPresent||!transientRestore.session)pushFailure('auth transient restore','Temporary session restore failure evicted a valid local workspace',JSON.stringify(transientRestore));
    if(!['WORKSPACE_READY','OFFLINE_READY','BACKGROUND_SYNC'].includes(transientRestore.authState))pushFailure('auth transient restore','Temporary session restore failure left the app in a blocking auth state',JSON.stringify(transientRestore));

    // A known missing browser session is authoritative and must clear stale private state.
    await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
    await authPage.evaluate(()=>{
      const now=Date.now();
      localStorage.setItem('edunizam_session',JSON.stringify({
        role:'head',identity:'admin@example.test',loginAt:now,source:'supabase',institutionId:'school-1',schoolName:'Test School'
      }));
      window.EDUNIZAM_CLOUD={
        state:{client:{auth:{}},user:null,initialized:true,authEvent:'INITIAL_SESSION',sessionRestoreStatus:'absent',sessionRestoreError:null},
        whenReady:()=>Promise.resolve(window.EDUNIZAM_CLOUD)
      };
    });
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/data-runtime.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
    await authPage.waitForSelector('#cloudAuthLogin',{state:'visible',timeout:3000});
    const authoritativeAbsent=await authPage.evaluate(()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      session:JSON.parse(localStorage.getItem('edunizam_session')||'null')
    }));
    if(!authoritativeAbsent.guardPresent||authoritativeAbsent.session)pushFailure('auth authoritative sign-out','Known missing cloud session did not clear stale private workspace state',JSON.stringify(authoritativeAbsent));
  }catch(e){
    pushFailure('auth/mobile runtime','Auth and mobile interaction regression failed',e.message||String(e));
  }finally{
    await authPage.close();
  }

  console.log('Auth/mobile runtime contract complete. Starting full login contract.');
  // Full login contract: real Login page -> app redirect -> usable mobile dashboard.
  const loginFlowPage=await browser.newPage({
    javaScriptEnabled:true,
    viewport:{width:390,height:844},
    isMobile:true,
    hasTouch:true,
    serviceWorkers:'block'
  });
  loginFlowPage.setDefaultTimeout(5000);
  loginFlowPage.setDefaultNavigationTimeout(8000);
  loginFlowPage.on('console',msg=>{
    const text=msg.text();
    if(msg.type()==='error'||/EduNizam|error|failed|timeout|warning/i.test(text))console.log('[login-flow browser '+msg.type()+'] '+text);
  });
  loginFlowPage.on('pageerror',error=>console.log('[login-flow pageerror] '+(error?.message||error)));
  loginFlowPage.on('requestfailed',request=>console.log('[login-flow requestfailed] '+request.url()+' :: '+(request.failure()?.errorText||'unknown')));
  const loginStep=async(label,fn)=>{
    console.log('Full login step START: '+label);
    const started=Date.now();
    try{
      const value=await fn();
      console.log('Full login step PASS: '+label+' ('+(Date.now()-started)+'ms)');
      return value;
    }catch(error){
      console.log('Full login step FAIL: '+label+' ('+(Date.now()-started)+'ms) :: '+(error?.message||error));
      throw error;
    }
  };
  const boundedEvaluate=(label,fn,timeout=5000)=>loginStep(label,()=>Promise.race([
    loginFlowPage.evaluate(fn),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' main-thread timeout after '+timeout+'ms')),timeout))
  ]));
  try{
    await loginFlowPage.addInitScript(()=>{
      const user={id:'user-1',email:'admin@example.test',user_metadata:{}};
      const workspace={
        institution_id:'11111111-1111-4111-8111-111111111111',
        institution_name:'Test School',
        institution_type:'School',
        registration_number:'REG-1',
        school_registration_code:'LOGIN-1',
        workspace_role:'head_of_institute'
      };
      const query=()=> {
        const result={data:[],error:null};
        const q={
          select(){return q},eq(){return q},neq(){return q},in(){return q},order(){return q},limit(){return q},
          insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
          maybeSingle(){return Promise.resolve({data:null,error:null})},
          single(){return Promise.resolve({data:null,error:null})},
          then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
        };
        return q;
      };
      const client={
        auth:{
          signInWithPassword:()=>Promise.resolve({data:{user,session:{user}},error:null}),
          signOut:()=>Promise.resolve({error:null}),
          getSession:()=>Promise.resolve({data:{session:{user}},error:null}),
          getUser:()=>Promise.resolve({data:{user},error:null}),
          signUp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
          resend:()=>Promise.resolve({error:null}),
          resetPasswordForEmail:()=>Promise.resolve({error:null}),
          verifyOtp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
          updateUser:()=>Promise.resolve({data:{user},error:null}),
          onAuthStateChange:(cb)=>{
            setTimeout(()=>cb('INITIAL_SESSION',{user}),0);
            return {data:{subscription:{unsubscribe(){}}}};
          }
        },
        rpc:(name)=>{
          if(name==='my_authorized_workspaces'){
            const count=Number(sessionStorage.getItem('qa_workspace_rpc_calls')||0)+1;
            sessionStorage.setItem('qa_workspace_rpc_calls',String(count));
            return Promise.resolve({data:[workspace],error:null});
          }
          if(name==='is_platform_admin')return Promise.resolve({data:false,error:null});
          return Promise.resolve({data:null,error:null});
        },
        from:()=>query(),
        storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),remove:()=>Promise.resolve({error:null})})}
      };
      window.supabase={createClient:()=>client};
    });
    await loginFlowPage.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
      status:200,contentType:'text/javascript',body:'/* Supabase stubbed by login regression test */'
    }));
    // Diagnostic isolation: keep the critical auth/navigation shell real and
    // temporarily blank non-critical startup modules. This identifies whether
    // the freeze belongs to the shell or to an eager feature/decorator module.
    const diagnosticBlockedStartup=[
      'premium-ui.js','system-auto-update.js'
    ];
    for(const src of diagnosticBlockedStartup){
      await loginFlowPage.route('**/'+src+'*',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* diagnostic startup module blanked: '+src+' */'
      }));
    }

    await loginStep('open login page',()=>loginFlowPage.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:8000}));
    await loginStep('select Admin role',()=>loginFlowPage.locator('[data-role="admin"]').tap({timeout:5000}));
    await loginStep('fill login fields',async()=>{
      await loginFlowPage.locator('#loginSchoolName').fill('Test School',{timeout:5000});
      await loginFlowPage.locator('#loginEmail').fill('admin@example.test',{timeout:5000});
      await loginFlowPage.locator('#loginPassword').fill('correct-password',{timeout:5000});
    });
    await loginStep('submit Login',async()=>{
      await loginFlowPage.locator('#loginBtn').tap({timeout:5000,noWaitAfter:true});
    });

    await loginStep('redirect to app workspace',()=>loginFlowPage.waitForURL(/\/app\.html\?secureLogin=1$/,{timeout:5000}))
      .catch(e=>pushFailure('login contract','Successful Login did not redirect to app workspace',e.message));
    await loginStep('mobile hamburger visible',()=>loginFlowPage.waitForSelector('#eduMobileMenuBtn',{state:'visible',timeout:5000}))
      .catch(e=>pushFailure('login contract','App mobile hamburger did not become visible after login',e.message));

    const openedApp=await boundedEvaluate('inspect opened app state',()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      dashboardActive:document.getElementById('dashboard')?.classList.contains('active')||false,
      handoff:JSON.parse(sessionStorage.getItem('edunizam_secure_login_handoff')||'null'),
      workspaceRpcCalls:Number(sessionStorage.getItem('qa_workspace_rpc_calls')||0),
      local:JSON.parse(localStorage.getItem('edunizam_session')||'null')
    }));
    if(openedApp.guardPresent)pushFailure('login contract','Secure overlay blocked a successful Login handoff',JSON.stringify(openedApp));
    if(!openedApp.dashboardActive)pushFailure('login contract','Dashboard is not active after successful Login',JSON.stringify(openedApp));
    if(openedApp.local?.institutionId!=='11111111-1111-4111-8111-111111111111'||openedApp.local?.role!=='head'){
      pushFailure('login contract','Login did not persist the authorized school workspace',JSON.stringify(openedApp.local));
    }
    if(openedApp.workspaceRpcCalls!==1)pushFailure('login contract','Login -> app startup repeated my_authorized_workspaces instead of trusting the fresh handoff',JSON.stringify(openedApp));

    await loginFlowPage.locator('#eduMobileMenuBtn').tap();
    await loginFlowPage.waitForTimeout(80);
    const menuOpen=await boundedEvaluate('inspect opened mobile menu',()=>document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false);
    if(!menuOpen)pushFailure('login contract','Hamburger is not clickable after successful Login');

    await loginFlowPage.locator('#eduMobileNavClose').tap();
    await loginFlowPage.waitForTimeout(80);
    await boundedEvaluate('prepare scroll probe',()=>{
      const spacer=document.createElement('div');
      spacer.id='qaScrollSpacer';spacer.style.height='1800px';document.querySelector('.main')?.appendChild(spacer);
      window.scrollTo(0,700);
    });
    await loginFlowPage.waitForTimeout(80);
    const afterLoginInteraction=await boundedEvaluate('inspect scroll and overlay state',()=>({
      scrollY:window.scrollY,
      locked:document.body.classList.contains('mobile-nav-lock'),
      backdropPointer:getComputedStyle(document.getElementById('eduMobileNavBackdrop')).pointerEvents
    }));
    if(afterLoginInteraction.scrollY<100)pushFailure('login contract','Page scrolling remains frozen after successful Login',JSON.stringify(afterLoginInteraction));
    if(afterLoginInteraction.locked||afterLoginInteraction.backdropPointer!=='none')pushFailure('login contract','Closed mobile navigation still blocks the page after Login',JSON.stringify(afterLoginInteraction));
  }catch(e){
    pushFailure('login contract','Full Login -> dashboard interaction regression failed',e.message||String(e));
  }finally{
    await loginFlowPage.close();
  }
}finally{
  await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(r=>server.close(()=>r()));
}

if(failures.length){
  console.error('EduNizam rendered layout QA FAILED');
  for(const f of failures)console.error('FAIL',f.scope,'-',f.message,f.detail||'');
  process.exit(1);
}
console.log('EduNizam rendered layout QA passed for '+pages.length+' pages across '+widths.length+' viewport widths.');
