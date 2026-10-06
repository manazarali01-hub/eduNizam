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
          if(sidebarExists)await page.waitForTimeout(650);
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

  // Guest/public learning runtime: no login, school selection, or private workspace may be required.
  const guestPage=await browser.newPage({
    javaScriptEnabled:true,
    viewport:{width:390,height:844},
    isMobile:true,
    hasTouch:true,
    serviceWorkers:'block'
  });
  guestPage.setDefaultTimeout(6000);
  guestPage.setDefaultNavigationTimeout(10000);
  try{
    await guestPage.route('**/*',route=>{
      const requestUrl=new URL(route.request().url());
      if(requestUrl.hostname==='127.0.0.1')route.continue();
      else route.abort();
    });
    await guestPage.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
    const guestEntry=guestPage.locator('a.guest-role[href="learn.html"]');
    await guestEntry.waitFor({state:'visible',timeout:5000});
    await guestEntry.tap({timeout:5000});
    await guestPage.waitForURL(/\/learn\.html(?:#.*)?$/,{timeout:8000});

    await guestPage.waitForFunction(()=>document.querySelectorAll('#homeCards .card').length>0&&document.getElementById('resourceCount')?.textContent!=='—',null,{timeout:8000});
    const guestStart=await guestPage.evaluate(()=>({
      url:location.pathname+location.hash,
      searchVisible:!!document.getElementById('globalSearch')?.offsetParent,
      homeCards:document.querySelectorAll('#homeCards .card').length,
      resourceCount:document.getElementById('resourceCount')?.textContent||'',
      privateGuard:!!document.getElementById('cloudAuthScreen')
    }));
    if(!guestStart.searchVisible||guestStart.homeCards<5||guestStart.privateGuard)pushFailure('guest learning','Continue as Guest did not land on a usable public Learning Hub',JSON.stringify(guestStart));

    await guestPage.locator('.tabs .tab[data-tab="past"]').tap({timeout:5000});
    await guestPage.waitForSelector('#past.section.active',{state:'visible',timeout:5000});
    await guestPage.locator('#paperSearch').fill('Gujranwala Mathematics');
    await guestPage.locator('#searchPapers').tap({timeout:5000});
    await guestPage.waitForFunction(()=>String(document.getElementById('paperSummary')?.textContent||'').trim().length>0,null,{timeout:5000});
    const pastState=await guestPage.evaluate(()=>({
      active:document.querySelector('.section.active')?.id||'',
      summary:(document.getElementById('paperSummary')?.textContent||'').trim(),
      gridText:(document.getElementById('pastGrid')?.textContent||'').trim().length
    }));
    if(pastState.active!=='past'||!pastState.summary||pastState.gridText<20)pushFailure('guest learning','Past Papers search did not render a usable result state',JSON.stringify(pastState));

    console.log('Guest step START: global public search');
    await guestPage.locator('#globalSearch').fill('CS201 final term');
    await guestPage.locator('#runGlobalSearch').tap({timeout:5000});
    await guestPage.waitForSelector('#globalResults',{state:'visible',timeout:5000});
    const globalState=await guestPage.evaluate(()=>({
      active:document.querySelector('.section.active')?.id||'',
      hash:location.hash,
      text:(document.getElementById('globalResults')?.textContent||'').trim()
    }));
    if(globalState.active!=='home'||globalState.text.length<30||!/CS201|Virtual University|VU/i.test(globalState.text)){
      pushFailure('guest learning','Global public search did not render relevant unified results',JSON.stringify({active:globalState.active,hash:globalState.hash,text:globalState.text.slice(0,260)}));
    }
    console.log('Guest step PASS: global public search');

    await guestPage.locator('#clearSearch').tap({timeout:5000});
    const cleared=await guestPage.locator('#globalSearch').inputValue();
    if(cleared!=='')pushFailure('guest learning','Clear Search did not reset the global learning search',JSON.stringify({cleared}));

    console.log('Guest step START: VU specific search');
    await guestPage.locator('.tabs .tab[data-tab="vu"]').tap({timeout:5000});
    await guestPage.waitForSelector('#vu.section.active',{state:'visible',timeout:5000});
    await guestPage.locator('#vuGuestSearch').fill('CS201 final term');
    await guestPage.locator('#vuGuestSearchBtn').tap({timeout:5000});
    await guestPage.waitForFunction(()=>String(document.getElementById('vuSummary')?.textContent||'').trim().length>0,null,{timeout:5000});
    const vuState=await guestPage.evaluate(()=>({
      active:document.querySelector('.section.active')?.id||'',
      summary:(document.getElementById('vuSummary')?.textContent||'').trim(),
      gridText:(document.getElementById('vuGrid')?.textContent||'').trim()
    }));
    if(vuState.active!=='vu'||!vuState.summary||vuState.gridText.length<20)pushFailure('guest learning','VU-specific search did not render a usable result state',JSON.stringify({active:vuState.active,summary:vuState.summary,text:vuState.gridText.slice(0,260)}));
    console.log('Guest step PASS: VU specific search');

    await guestPage.locator('#clearSearch').tap({timeout:5000});
    console.log('Guest step START: Practice Center');
    await guestPage.locator('.tabs .tab[data-tab="practice"]').tap({timeout:5000});
    await guestPage.waitForSelector('#practice.section.active',{state:'visible',timeout:5000});
    await guestPage.waitForSelector('#guestPracticeApply',{state:'visible',timeout:5000});
    await guestPage.locator('#guestPracticeApply').tap({timeout:5000});
    await guestPage.waitForFunction(()=>String(document.getElementById('practiceQuestion')?.textContent||'').trim().length>5,null,{timeout:5000});
    await guestPage.waitForSelector('#guestPracticeNext',{state:'visible',timeout:5000});
    const q1=await guestPage.locator('#practiceQuestion').textContent();
    await guestPage.locator('#guestPracticeNext').tap({timeout:5000});
    await guestPage.waitForTimeout(80);
    const practiceState=await guestPage.evaluate(()=>({
      active:document.querySelector('.section.active')?.id||'',
      question:(document.getElementById('practiceQuestion')?.textContent||'').trim(),
      summary:(document.getElementById('guestPracticeSummary')?.textContent||document.getElementById('practiceGuestSummary')?.textContent||'').trim()
    }));
    if(practiceState.active!=='practice'||practiceState.question.length<5||practiceState.summary.length<5)pushFailure('guest learning','Practice Center did not remain usable after Next Question',JSON.stringify({q1,practiceState}));
    console.log('Guest step PASS: Practice Center');

    console.log('Guest step START: mobile scroll');
    await guestPage.evaluate(()=>window.scrollTo(0,Math.min(document.documentElement.scrollHeight-500,1400)));
    await guestPage.waitForTimeout(80);
    const guestScroll=await guestPage.evaluate(()=>({y:window.scrollY,height:document.documentElement.scrollHeight,bodyOverflow:getComputedStyle(document.body).overflow}));
    if(guestScroll.y<100)pushFailure('guest learning','Public Learning Hub could not scroll on mobile',JSON.stringify(guestScroll));
    console.log('Guest step PASS: mobile scroll');
  }catch(e){
    pushFailure('guest learning','Guest Login -> Learning Hub interaction regression failed',e.message||String(e));
  }finally{
    await guestPage.close();
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
      try{
        await authPage.waitForSelector('#cloudAuthLogin',{state:'visible',timeout:6000});
      }catch(error){
        const authDiag=await authPage.evaluate(()=>({
          ready:document.readyState,
          authState:document.documentElement.dataset.authState||'',
          guardPresent:!!document.getElementById('cloudAuthScreen'),
          guardText:(document.getElementById('cloudAuthScreen')?.textContent||'').trim().slice(0,240),
          bodyText:(document.body?.textContent||'').trim().slice(0,240)
        })).catch(()=>({diagnostic:'page evaluate failed'}));
        throw new Error('Signed-out auth guard did not expose Login within 6s: '+JSON.stringify(authDiag)+' :: '+(error?.message||error));
      }
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

    // A hung Supabase getSession must never own application readiness. Exercise
    // the actual admissions-cloud initializer, not a pre-baked cloud state.
    await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
    await authPage.evaluate(()=>{
      const now=Date.now();
      localStorage.setItem('edunizam_session',JSON.stringify({
        role:'head',identity:'admin@example.test',loginAt:now,source:'supabase',institutionId:'school-1',schoolName:'Test School'
      }));
      localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify({enabled:true,institutionId:'school-1'}));
      window.EDUNIZAM_CLOUD_CONFIG={
        enabled:true,provider:'supabase',supabaseUrl:'https://qa-supabase.invalid',
        supabasePublishableKey:'qa-publishable-key',institutionId:'school-1'
      };
      const never=new Promise(()=>{});
      window.supabase={createClient:()=>({
        auth:{
          onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
          getSession:()=>never,
          signOut:()=>Promise.resolve({error:null})
        }
      })};
    });
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/data-runtime.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/admissions-cloud.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/mobile-nav-core.js'});
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
    await authPage.waitForSelector('#eduMobileMenuBtn',{state:'visible',timeout:1800});
    await authPage.waitForFunction(()=>window.EDUNIZAM_CLOUD?.state?.initialized&&window.EDUNIZAM_CLOUD?.state?.sessionRestoreStatus==='timeout',null,{timeout:5000});
    const hungRestore=await authPage.evaluate(()=>({
      guardPresent:!!document.getElementById('cloudAuthScreen'),
      authState:document.documentElement.dataset.authState||'',
      restoreStatus:window.EDUNIZAM_CLOUD?.state?.sessionRestoreStatus||'',
      initialized:window.EDUNIZAM_CLOUD?.state?.initialized===true,
      session:JSON.parse(localStorage.getItem('edunizam_session')||'null')
    }));
    if(hungRestore.guardPresent||!hungRestore.session||!hungRestore.initialized||hungRestore.restoreStatus!=='timeout'){
      pushFailure('auth hung restore','Hung Supabase getSession blocked or evicted the valid local workspace',JSON.stringify(hungRestore));
    }
    if(!['WORKSPACE_READY','OFFLINE_READY','BACKGROUND_SYNC'].includes(hungRestore.authState)){
      pushFailure('auth hung restore','Hung Supabase getSession left the app in a blocking auth state',JSON.stringify(hungRestore));
    }

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
  const loginRuntimeErrors=[];
  loginFlowPage.on('pageerror',error=>{
    const message=String(error?.message||error);
    loginRuntimeErrors.push(message);
    console.log('[login-flow pageerror] '+message);
  });
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
      try{
        if(!localStorage.getItem('edunizam_students')){
          localStorage.setItem('edunizam_students',JSON.stringify([{
            id:9001,studentId:'STU-QA-9001',name:'QA Student',father:'QA Guardian',
            className:'5',sectionName:'A',phone:'03000000000',bFormNo:'00000-0000000-0',
            dateOfBirth:'2015-01-01',gender:'Male',admissionNo:'QA-9001',studentStatus:'active'
          }]));
        }
      }catch(_){}
      const query=()=> {
        const result={data:[],error:null};
        const q={
          select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
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
    const diagnosticBlockedStartup=[];
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
    if(loginRuntimeErrors.length)pushFailure('login contract','Runtime JavaScript errors occurred during Login → dashboard interaction',loginRuntimeErrors.slice(0,8).join(' | '));

    // Primary Admin flow contract: core sections must remain clickable after login.
    for(const view of ['students','attendance','fees','results','settings']){
      await loginStep('open '+view+' section',async()=>{
        await loginFlowPage.locator('#eduMobileMenuBtn').tap({timeout:5000});
        await loginFlowPage.evaluate(view=>{
          const button=document.querySelector('.nav-item[data-view="'+view+'"]');
          const group=button?.closest('details');
          if(group)group.open=true;
        },view);
        const button=loginFlowPage.locator('.nav-item[data-view="'+view+'"]');
        await button.tap({timeout:5000});
        await loginFlowPage.waitForSelector('#'+view+'.view.active',{state:'visible',timeout:5000});
      });
      const sectionState=await boundedEvaluate('inspect '+view+' responsiveness',()=>({
        active:document.querySelector('.view.active')?.id||'',
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        locked:document.body.classList.contains('mobile-nav-lock'),
        backdropPointer:getComputedStyle(document.getElementById('eduMobileNavBackdrop')).pointerEvents,
        menuOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false
      }),5000);
      if(sectionState.active!==view||sectionState.guardPresent||sectionState.locked||sectionState.backdropPointer!=='none'||sectionState.menuOpen){
        pushFailure('admin primary navigation',view+' did not settle to a usable state',JSON.stringify(sectionState));
      }
    }

    await boundedEvaluate('prepare local primary action contract',()=>{
      if(window.EDUNIZAM_CORE_CLOUD)window.EDUNIZAM_CORE_CLOUD.ready=()=>false;
      if(window.EDUNIZAM_WORKFLOW_ALERTS){
        window.EDUNIZAM_WORKFLOW_ALERTS.attendanceSaved=async()=>{};
        window.EDUNIZAM_WORKFLOW_ALERTS.feeSaved=async()=>{};
        window.EDUNIZAM_WORKFLOW_ALERTS.resultSaved=async()=>{};
      }
      return true;
    });

    await boundedEvaluate('open students action view',()=>window.EDUNIZAM_APP_NAV.setView('students'));
    await loginStep('add student action',async()=>{
      await loginFlowPage.locator('#addStudentBtn').tap({timeout:5000});
      await loginFlowPage.locator('#studentName').fill('QA New Student');
      await loginFlowPage.locator('#fatherName').fill('QA Parent');
      await loginFlowPage.locator('#studentClass').fill('6');
      await loginFlowPage.locator('#studentPhone').fill('03110000000');
      await loginFlowPage.locator('#studentBForm').fill('11111-1111111-1');
      await loginFlowPage.locator('#studentGender').selectOption({label:'Female'});
      await loginFlowPage.locator('#studentDob').fill('2014-02-02');
      await loginFlowPage.locator('#admissionNo').fill('QA-NEW-1');
      await loginFlowPage.locator('#saveStudentBtn').tap({timeout:5000});
    });
    const studentAction=await boundedEvaluate('verify student save action',()=>{
      const rows=JSON.parse(localStorage.getItem('edunizam_students')||'[]');
      return {saved:rows.some(x=>x.name==='QA New Student'),formHidden:document.getElementById('studentFormWrap')?.classList.contains('hidden')||false};
    });
    if(!studentAction.saved||!studentAction.formHidden)pushFailure('admin primary actions','Student save did not persist and settle',JSON.stringify(studentAction));

    await boundedEvaluate('seed approved leave attendance',()=>{
      const d=new Date(),key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const days=JSON.parse(localStorage.getItem('edunizam_attendance')||'{}');
      days[key]=Object.assign({},days[key]||{}, {'9001':'Leave'});
      localStorage.setItem('edunizam_attendance',JSON.stringify(days));
      window.renderAll?.();
      return key;
    });
    await boundedEvaluate('open attendance action view',()=>window.EDUNIZAM_APP_NAV.setView('attendance'));
    const approvedLeaveState=await boundedEvaluate('inspect approved leave attendance control',()=>({
      leaveChecked:!!document.querySelector('#attendanceList input[name="att_9001"][value="Leave"]:checked'),
      leaveOption:!!document.querySelector('#attendanceList input[name="att_9001"][value="Leave"]'),
      lateOption:!!document.querySelector('#attendanceList input[name="att_9001"][value="Late"]')
    }));
    if(!approvedLeaveState.leaveChecked||!approvedLeaveState.leaveOption||!approvedLeaveState.lateOption){
      pushFailure('admin primary actions','Approved Leave was not rendered as a selected attendance state',JSON.stringify(approvedLeaveState));
    }
    await loginStep('save attendance action',async()=>{
      const rows=loginFlowPage.locator('#attendanceList .attendance-row');
      const count=await rows.count();
      if(!count)throw new Error('No visible attendance rows were rendered');
      for(let i=0;i<count;i++){
        const row=rows.nth(i);
        const leaveChecked=await row.locator('input[value="Leave"]:checked').count();
        if(!leaveChecked)await row.locator('input[value="Present"]').check({timeout:5000});
      }
      await loginFlowPage.locator('#saveAttendanceBtn').tap({timeout:5000});
      await loginFlowPage.waitForFunction(()=>!document.getElementById('saveAttendanceBtn')?.disabled,null,{timeout:5000});
    });
    const attendanceAction=await boundedEvaluate('verify attendance save action',()=>{
      const rows=JSON.parse(localStorage.getItem('edunizam_students')||'[]');
      const added=rows.find(x=>x.name==='QA New Student');
      const days=JSON.parse(localStorage.getItem('edunizam_attendance')||'{}');
      const values=Object.values(days);
      return {
        approvedLeavePreserved:values.some(day=>day&&String(day['9001']||day[9001])==='Leave'),
        newStudentPresent:!!added&&values.some(day=>day&&String(day[String(added.id)]||day[added.id])==='Present')
      };
    });
    if(!attendanceAction.approvedLeavePreserved||!attendanceAction.newStudentPresent){
      pushFailure('admin primary actions','Attendance save did not preserve approved Leave while saving other students',JSON.stringify(attendanceAction));
    }

    await boundedEvaluate('open fees action view',()=>window.EDUNIZAM_APP_NAV.setView('fees'));
    await loginStep('save fee action',async()=>{
      await loginFlowPage.locator('#feeStudent').selectOption('9001');
      await loginFlowPage.locator('#feeAmount').fill('1500');
      await loginFlowPage.locator('#feeStatus').selectOption({label:'Paid'});
      await loginFlowPage.locator('#saveFeeBtn').tap({timeout:5000});
    });
    const feeAction=await boundedEvaluate('verify fee save action',()=>{
      const rows=JSON.parse(localStorage.getItem('edunizam_fees')||'[]');
      return rows.some(x=>Number(x.studentId)===9001&&Number(x.amount)===1500&&x.status==='Paid');
    });
    if(!feeAction)pushFailure('admin primary actions','Fee save did not persist the valid record');

    await boundedEvaluate('open results action view',()=>window.EDUNIZAM_APP_NAV.setView('results'));
    await loginStep('save result action',async()=>{
      await loginFlowPage.locator('#resultStudent').selectOption('9001');
      await loginFlowPage.locator('#resultSubject').fill('Mathematics');
      await loginFlowPage.locator('#resultMarks').fill('80');
      await loginFlowPage.locator('#resultTotal').fill('100');
      await loginFlowPage.locator('#saveResultBtn').tap({timeout:5000});
      await loginFlowPage.waitForFunction(()=>!document.getElementById('saveResultBtn')?.disabled,null,{timeout:5000});
    });
    const resultAction=await boundedEvaluate('verify result save action',()=>{
      const rows=JSON.parse(localStorage.getItem('edunizam_results')||'[]');
      return rows.some(x=>Number(x.studentId)===9001&&x.subject==='Mathematics'&&Number(x.marks)===80&&Number(x.total)===100);
    });
    if(!resultAction)pushFailure('admin primary actions','Result save did not persist the valid record');

    await boundedEvaluate('open settings action view',()=>window.EDUNIZAM_APP_NAV.setView('settings'));
    await loginStep('save settings action',async()=>{
      await loginFlowPage.locator('#schoolTaglineInput').fill('QA Stable Workspace');
      await loginFlowPage.locator('#saveSettingsBtn').tap({timeout:5000});
    });
    const settingsAction=await boundedEvaluate('verify settings save action',()=>{
      const settings=JSON.parse(localStorage.getItem('edunizam_settings')||'{}');
      return settings.tagline==='QA Stable Workspace';
    });
    if(!settingsAction)pushFailure('admin primary actions','Settings save did not persist the updated tagline');

    // High-value school workflow sections: mobile click + lazy-loader + unlocked UI contract.
    for(const view of ['noticeboard','schedulecenter','dailydiary','paperbuilder','leavecenter','parentcomplaints']){
      await loginStep('open workflow '+view,async()=>{
        await loginFlowPage.locator('#eduMobileMenuBtn').tap({timeout:5000});
        await loginFlowPage.evaluate(view=>{
          const button=document.querySelector('.nav-item[data-view="'+view+'"]');
          const group=button?.closest('details');
          if(group)group.open=true;
        },view);
        await loginFlowPage.locator('.nav-item[data-view="'+view+'"]').tap({timeout:5000});
        await loginFlowPage.waitForSelector('#'+view+'.view.active',{state:'visible',timeout:5000});
        await loginFlowPage.waitForFunction(view=>{
          const loader=window.EDUNIZAM_FEATURE_LOADER;
          const error=document.querySelector('#'+view+' .feature-loading-notice.error');
          return !!error||!loader||loader.isReady(view);
        },view,{timeout:8000});
        await loginFlowPage.waitForTimeout(80);
      });
      const workflowState=await boundedEvaluate('inspect workflow '+view,()=>({
        active:document.querySelector('.view.active')?.id||'',
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        locked:document.body.classList.contains('mobile-nav-lock'),
        menuOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false,
        featureLoading:document.documentElement.classList.contains('edu-feature-loading'),
        featureError:!!document.querySelector('.view.active .feature-loading-notice.error'),
        activeText:(document.querySelector('.view.active')?.textContent||'').trim().length
      }),5000);
      if(workflowState.active!==view||workflowState.guardPresent||workflowState.locked||workflowState.menuOpen||workflowState.featureLoading||workflowState.featureError||workflowState.activeText<10){
        pushFailure('admin workflow navigation',view+' did not settle to a usable rendered state',JSON.stringify(workflowState));
      }
    }

    // People + operations sections: mobile navigation, lazy-loader completion, and unlocked rendered state.
    for(const view of ['staffcenter','staffpayroll','training','financecenter','inventorycenter','librarycenter','transportcenter']){
      await loginStep('open operations '+view,async()=>{
        await loginFlowPage.locator('#eduMobileMenuBtn').tap({timeout:5000});
        await loginFlowPage.evaluate(view=>{
          const button=document.querySelector('.nav-item[data-view="'+view+'"]');
          const group=button?.closest('details');
          if(group)group.open=true;
        },view);
        await loginFlowPage.locator('.nav-item[data-view="'+view+'"]').tap({timeout:5000});
        await loginFlowPage.waitForSelector('#'+view+'.view.active',{state:'visible',timeout:5000});
        await loginFlowPage.waitForFunction(view=>{
          const loader=window.EDUNIZAM_FEATURE_LOADER;
          const error=document.querySelector('#'+view+' .feature-loading-notice.error');
          return !!error||!loader||loader.isReady(view);
        },view,{timeout:8000});
        await loginFlowPage.waitForTimeout(80);
      });
      const operationsState=await boundedEvaluate('inspect operations '+view,()=>({
        active:document.querySelector('.view.active')?.id||'',
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        locked:document.body.classList.contains('mobile-nav-lock'),
        menuOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false,
        featureLoading:document.documentElement.classList.contains('edu-feature-loading'),
        featureError:!!document.querySelector('.view.active .feature-loading-notice.error'),
        activeText:(document.querySelector('.view.active')?.textContent||'').trim().length
      }),5000);
      if(operationsState.active!==view||operationsState.guardPresent||operationsState.locked||operationsState.menuOpen||operationsState.featureLoading||operationsState.featureError||operationsState.activeText<10){
        pushFailure('admin operations navigation',view+' did not settle to a usable rendered state',JSON.stringify(operationsState));
      }
    }

    // Campus + communication sections: mobile navigation, lazy-loader completion, rendered content and unlocked UI.
    for(const view of ['stafftime','ourstudents','behaviorcenter','gatecenter','studentdocs','functionscenter','inboxcenter','helpdeskcenter']){
      await loginStep('open campus '+view,async()=>{
        await loginFlowPage.locator('#eduMobileMenuBtn').tap({timeout:5000});
        await loginFlowPage.evaluate(view=>{
          const button=document.querySelector('.nav-item[data-view="'+view+'"]');
          const group=button?.closest('details');
          if(group)group.open=true;
        },view);
        await loginFlowPage.locator('.nav-item[data-view="'+view+'"]').tap({timeout:5000});
        await loginFlowPage.waitForSelector('#'+view+'.view.active',{state:'visible',timeout:5000});
        await loginFlowPage.waitForFunction(view=>{
          const loader=window.EDUNIZAM_FEATURE_LOADER;
          const error=document.querySelector('#'+view+' .feature-loading-notice.error');
          return !!error||!loader||loader.isReady(view);
        },view,{timeout:8000});
        await loginFlowPage.waitForTimeout(80);
      });
      const campusState=await boundedEvaluate('inspect campus '+view,()=>({
        active:document.querySelector('.view.active')?.id||'',
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        locked:document.body.classList.contains('mobile-nav-lock'),
        menuOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false,
        featureLoading:document.documentElement.classList.contains('edu-feature-loading'),
        featureError:!!document.querySelector('.view.active .feature-loading-notice.error'),
        activeText:(document.querySelector('.view.active')?.textContent||'').trim().length
      }),5000);
      if(campusState.active!==view||campusState.guardPresent||campusState.locked||campusState.menuOpen||campusState.featureLoading||campusState.featureError||campusState.activeText<10){
        pushFailure('admin campus navigation',view+' did not settle to a usable rendered state',JSON.stringify(campusState));
      }
    }

    // Academic management sections: mobile navigation, lazy-loader completion, rendered content and unlocked UI.
    for(const view of ['studentprofile','classcenter','bulkimport','attendanceanalytics','schoolwork','lessoncenter','examcenter','calendarcenter']){
      await loginStep('open academic '+view,async()=>{
        await loginFlowPage.locator('#eduMobileMenuBtn').tap({timeout:5000});
        await loginFlowPage.evaluate(view=>{
          const button=document.querySelector('.nav-item[data-view="'+view+'"]');
          const group=button?.closest('details');
          if(group)group.open=true;
        },view);
        await loginFlowPage.locator('.nav-item[data-view="'+view+'"]').tap({timeout:5000});
        await loginFlowPage.waitForSelector('#'+view+'.view.active',{state:'visible',timeout:5000});
        await loginFlowPage.waitForFunction(view=>{
          const loader=window.EDUNIZAM_FEATURE_LOADER;
          const error=document.querySelector('#'+view+' .feature-loading-notice.error');
          return !!error||!loader||loader.isReady(view);
        },view,{timeout:8000});
        await loginFlowPage.waitForTimeout(80);
      });
      const academicState=await boundedEvaluate('inspect academic '+view,()=>({
        active:document.querySelector('.view.active')?.id||'',
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        locked:document.body.classList.contains('mobile-nav-lock'),
        menuOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false,
        featureLoading:document.documentElement.classList.contains('edu-feature-loading'),
        featureError:!!document.querySelector('.view.active .feature-loading-notice.error'),
        activeText:(document.querySelector('.view.active')?.textContent||'').trim().length
      }),5000);
      if(academicState.active!==view||academicState.guardPresent||academicState.locked||academicState.menuOpen||academicState.featureLoading||academicState.featureError||academicState.activeText<10){
        pushFailure('admin academic navigation',view+' did not settle to a usable rendered state',JSON.stringify(academicState));
      }
    }
  }catch(e){
    pushFailure('login contract','Full Login -> dashboard interaction regression failed',e.message||String(e));
  }finally{
    await loginFlowPage.close();
  }

  // Role-based authentication contract: approved Teacher, Student and Parent
  // must enter the selected school workspace without a blocking re-check.
  const roleCases=[
    {role:'teacher',workspaceRole:'teacher',localRole:'teacher',label:'Teacher',allowed:'students',denied:'settings'},
    {role:'student',workspaceRole:'student',localRole:'student',label:'Student',allowed:'schoolwork',denied:'students'},
    {role:'parent',workspaceRole:'parent',localRole:'parent',label:'Parent / Guardian',allowed:'parentcomplaints',denied:'paperbuilder'}
  ];
  for(const roleCase of roleCases){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const rolePage=await context.newPage();
    rolePage.setDefaultTimeout(6000);
    rolePage.setDefaultNavigationTimeout(10000);
    try{
      await rolePage.addInitScript(({role,workspaceRole})=>{
        const institutionId='22222222-2222-4222-8222-222222222222';
        const email=role+'@example.test';
        const user={id:'qa-'+role,email,user_metadata:{}};
        const directory={
          institution_id:institutionId,
          institution_name:'QA Role School',
          institution_type:'School',
          registration_number:'ROLE-QA',
          school_registration_code:'ROLE-QA-LOGIN',
          address:'QA Campus'
        };
        const workspace={...directory,workspace_role:workspaceRole};
        const signedOut=()=>sessionStorage.getItem('qa_role_signed_out')==='1';
        const query=()=>{
          const result={data:[],error:null};
          const q={
            select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
            insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
            maybeSingle(){return Promise.resolve({data:null,error:null})},
            single(){return Promise.resolve({data:null,error:null})},
            then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
          };
          return q;
        };
        const client={
          auth:{
            signInWithPassword:()=>{
              sessionStorage.removeItem('qa_role_signed_out');
              return Promise.resolve({data:{user,session:{user}},error:null});
            },
            signOut:()=>{
              sessionStorage.setItem('qa_role_signed_out','1');
              return Promise.resolve({error:null});
            },
            getSession:()=>Promise.resolve({data:{session:signedOut()?null:{user}},error:null}),
            getUser:()=>Promise.resolve({data:{user:signedOut()?null:user},error:null}),
            signUp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            resend:()=>Promise.resolve({error:null}),
            resetPasswordForEmail:()=>Promise.resolve({error:null}),
            verifyOtp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            updateUser:()=>Promise.resolve({data:{user},error:null}),
            onAuthStateChange:(cb)=>{
              setTimeout(()=>cb('INITIAL_SESSION',signedOut()?null:{user}),0);
              return {data:{subscription:{unsubscribe(){}}}};
            }
          },
          rpc:(name)=>{
            if(name==='list_school_directory_v1'||name==='search_school_directory_v1')return Promise.resolve({data:[directory],error:null});
            if(name==='my_authorized_workspaces'){
              const count=Number(sessionStorage.getItem('qa_role_workspace_calls')||0)+1;
              sessionStorage.setItem('qa_role_workspace_calls',String(count));
              return Promise.resolve({data:[workspace],error:null});
            }
            if(name==='is_platform_admin')return Promise.resolve({data:false,error:null});
            return Promise.resolve({data:null,error:null});
          },
          from:()=>query(),
          storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),remove:()=>Promise.resolve({error:null})})}
        };
        window.supabase={createClient:()=>client};
      },{role:roleCase.role,workspaceRole:roleCase.workspaceRole});

      await rolePage.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else if(u.hostname==='cdn.jsdelivr.net')route.fallback();
        else route.abort();
      });
      await rolePage.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* Supabase stubbed by role auth regression */'
      }));

      console.log('Role auth START: '+roleCase.role);
      await rolePage.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
      await rolePage.evaluate(()=>{localStorage.removeItem('edunizam_session');sessionStorage.removeItem('qa_role_signed_out');sessionStorage.removeItem('qa_role_workspace_calls')});
      await rolePage.locator('[data-role="'+roleCase.role+'"]').tap({timeout:5000});
      await rolePage.waitForFunction(()=>[...document.querySelectorAll('#memberSchoolDropdown option')].some(o=>o.value==='22222222-2222-4222-8222-222222222222'),null,{timeout:6000});
      await rolePage.locator('#memberSchoolDropdown').selectOption('22222222-2222-4222-8222-222222222222');
      await rolePage.locator('#loginEmail').fill(roleCase.role+'@example.test');
      await rolePage.locator('#loginPassword').fill('correct-password');
      await rolePage.locator('#loginBtn').tap({timeout:5000,noWaitAfter:true});
      await rolePage.waitForURL(/\/app\.html\?secureLogin=1$/,{timeout:6000});
      await rolePage.waitForSelector('#roleSession',{state:'visible',timeout:6000});
      await rolePage.waitForSelector('#eduMobileMenuBtn',{state:'visible',timeout:6000});

      const opened=await rolePage.evaluate(({localRole,label,allowed,denied})=>{
        const local=JSON.parse(localStorage.getItem('edunizam_session')||'null');
        return {
          local,
          guardPresent:!!document.getElementById('cloudAuthScreen'),
          label:(document.querySelector('#roleSession strong')?.textContent||'').trim(),
          workspaceCalls:Number(sessionStorage.getItem('qa_role_workspace_calls')||0),
          allowedHidden:document.querySelector('.nav-item[data-view="'+allowed+'"]')?.classList.contains('role-hidden')??null,
          deniedHidden:document.querySelector('.nav-item[data-view="'+denied+'"]')?.classList.contains('role-hidden')??null,
          handoff:JSON.parse(sessionStorage.getItem('edunizam_secure_login_handoff')||'null')
        };
      },roleCase);
      if(opened.guardPresent||opened.local?.role!==roleCase.localRole||opened.local?.institutionId!=='22222222-2222-4222-8222-222222222222'||!opened.label.includes(roleCase.label)){
        pushFailure('role auth',roleCase.role+' login did not settle in the approved workspace',JSON.stringify(opened));
      }
      if(opened.workspaceCalls!==1)pushFailure('role auth',roleCase.role+' login repeated workspace authorization instead of trusting the fresh handoff',JSON.stringify(opened));
      if(opened.allowedHidden!==false||opened.deniedHidden!==true)pushFailure('role auth',roleCase.role+' role navigation permissions were not applied correctly',JSON.stringify(opened));

      await rolePage.locator('#eduMobileMenuBtn').tap({timeout:5000});
      await rolePage.waitForTimeout(60);
      const menuOpen=await rolePage.evaluate(()=>document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false);
      if(!menuOpen)pushFailure('role auth',roleCase.role+' hamburger was not interactive after login');
      await rolePage.locator('#eduMobileNavClose').tap({timeout:5000});

      await rolePage.locator('#roleSession button').tap({timeout:5000,noWaitAfter:true});
      await rolePage.waitForFunction(()=>!localStorage.getItem('edunizam_session')&&!sessionStorage.getItem('edunizam_secure_login_handoff'),null,{timeout:6000});
      await rolePage.waitForFunction(()=>!!document.getElementById('cloudAuthScreen')||/\/login\.html/.test(location.pathname),null,{timeout:6000});
      const signedOut=await rolePage.evaluate(()=>({
        local:localStorage.getItem('edunizam_session'),
        handoff:sessionStorage.getItem('edunizam_secure_login_handoff'),
        runtime:(()=>{try{return JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}')}catch(_){return{}}})(),
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        path:location.pathname
      }));
      if(signedOut.local||signedOut.handoff||signedOut.runtime?.institutionId){
        pushFailure('role auth',roleCase.role+' logout left private workspace state behind',JSON.stringify(signedOut));
      }
      console.log('Role auth PASS: '+roleCase.role);
    }catch(error){
      pushFailure('role auth',roleCase.role+' approved-school login/logout regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }

  // Public onboarding contract: non-admin sign-up must submit the correct
  // approval request, clear temporary signup state, and return to Login.
  const approvalCases=[
    {role:'teacher',rpc:'submit_teacher_school_request_v1'},
    {role:'student',rpc:'submit_school_access_request_v1'},
    {role:'parent',rpc:'submit_school_access_request_v1'}
  ];
  for(const approvalCase of approvalCases){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    page.setDefaultTimeout(6000);
    page.setDefaultNavigationTimeout(10000);
    try{
      await page.addInitScript(({role})=>{
        const institutionId='33333333-3333-4333-8333-333333333333';
        const email=role+'-signup@example.test';
        const user={id:'qa-signup-'+role,email,user_metadata:{}};
        const directory={
          institution_id:institutionId,
          institution_name:'QA Signup School',
          institution_type:'School',
          registration_number:'SIGNUP-QA',
          school_registration_code:'SIGNUP-QA-LOGIN',
          address:'QA Signup Campus'
        };
        const query=()=>{
          const result={data:[],error:null};
          const q={
            select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
            insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
            maybeSingle(){return Promise.resolve({data:null,error:null})},
            single(){return Promise.resolve({data:null,error:null})},
            then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
          };
          return q;
        };
        const client={
          auth:{
            signUp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            signOut:()=>{sessionStorage.setItem('qa_signup_signed_out','1');return Promise.resolve({error:null})},
            getSession:()=>Promise.resolve({data:{session:null},error:null}),
            getUser:()=>Promise.resolve({data:{user:null},error:null}),
            signInWithPassword:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            resend:()=>Promise.resolve({error:null}),
            resetPasswordForEmail:()=>Promise.resolve({error:null}),
            verifyOtp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            updateUser:()=>Promise.resolve({data:{user},error:null}),
            onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
          },
          rpc:(name,args={})=>{
            if(name==='list_school_directory_v1'||name==='search_school_directory_v1')return Promise.resolve({data:[directory],error:null});
            if(name==='submit_teacher_school_request_v1'||name==='submit_school_access_request_v1'){
              sessionStorage.setItem('qa_signup_rpc',JSON.stringify({name,args}));
              return Promise.resolve({data:{ok:true},error:null});
            }
            if(name==='is_platform_admin')return Promise.resolve({data:false,error:null});
            return Promise.resolve({data:null,error:null});
          },
          from:()=>query(),
          storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),remove:()=>Promise.resolve({error:null})})}
        };
        window.supabase={createClient:()=>client};
      },{role:approvalCase.role});

      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else if(u.hostname==='cdn.jsdelivr.net')route.fallback();
        else route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* Supabase stubbed by onboarding regression */'
      }));

      console.log('Approval signup START: '+approvalCase.role);
      await page.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
      await page.locator('[data-role="'+approvalCase.role+'"]').tap({timeout:5000});
      await page.waitForFunction(()=>[...document.querySelectorAll('#memberSchoolDropdown option')].some(o=>o.value==='33333333-3333-4333-8333-333333333333'),null,{timeout:6000});
      await page.locator('#memberSchoolDropdown').selectOption('33333333-3333-4333-8333-333333333333');
      await page.locator('#signupTab').tap({timeout:5000});
      await page.locator('#fullName').fill('QA '+approvalCase.role);
      await page.locator('#contactNumber').fill('03000000000');
      await page.locator('#signupEmail').fill(approvalCase.role+'-signup@example.test');
      await page.locator('#signupPassword').fill('correct-password');
      if(approvalCase.role==='student'){
        await page.locator('#approvalClassName').fill('Grade 5');
        await page.locator('#approvalGuardianName').fill('QA Guardian');
      }
      if(approvalCase.role==='parent'){
        await page.locator('#approvalStudentName').fill('QA Child');
        await page.locator('#approvalClassName').fill('Grade 5');
        await page.locator('#approvalRelationship').fill('Parent');
      }
      await page.locator('#signupBtn').tap({timeout:5000});
      await page.waitForFunction(()=>/Waiting for School Admin Approval/i.test(document.getElementById('statusBox')?.textContent||''),null,{timeout:6000});
      const approvalState=await page.evaluate(()=>({
        rpc:(()=>{try{return JSON.parse(sessionStorage.getItem('qa_signup_rpc')||'null')}catch(_){return null}})(),
        signedOut:sessionStorage.getItem('qa_signup_signed_out')==='1',
        pending:localStorage.getItem('edunizam_pending_signup'),
        loginVisible:!document.getElementById('loginForm')?.classList.contains('hidden'),
        email:document.getElementById('loginEmail')?.value||'',
        status:(document.getElementById('statusBox')?.textContent||'').trim()
      }));
      if(approvalState.rpc?.name!==approvalCase.rpc||approvalState.rpc?.args?.p_institution_id!=='33333333-3333-4333-8333-333333333333'){
        pushFailure('signup approval',approvalCase.role+' sign-up did not submit the expected school approval request',JSON.stringify(approvalState));
      }
      if(approvalCase.role!=='teacher'&&approvalState.rpc?.args?.p_role!==approvalCase.role){
        pushFailure('signup approval',approvalCase.role+' approval request carried the wrong role',JSON.stringify(approvalState.rpc));
      }
      if(!approvalState.signedOut||approvalState.pending!==null||!approvalState.loginVisible||approvalState.email!==approvalCase.role+'-signup@example.test'){
        pushFailure('signup approval',approvalCase.role+' sign-up did not settle safely back to Login after request submission',JSON.stringify(approvalState));
      }
      console.log('Approval signup PASS: '+approvalCase.role);
    }catch(error){
      pushFailure('signup approval',approvalCase.role+' approval-request regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }

  // Password recovery contract: registered email -> recovery request -> OTP ->
  // new password, without needing a school name/code.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    page.setDefaultTimeout(6000);
    page.setDefaultNavigationTimeout(10000);
    try{
      await page.addInitScript(()=>{
        const user={id:'qa-recovery-user',email:'recovery@example.test',user_metadata:{}};
        const query=()=>{
          const result={data:[],error:null};
          const q={
            select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
            insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
            maybeSingle(){return Promise.resolve({data:null,error:null})},
            single(){return Promise.resolve({data:null,error:null})},
            then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
          };
          return q;
        };
        const client={
          auth:{
            resetPasswordForEmail:(email,options)=>{sessionStorage.setItem('qa_recovery_request',JSON.stringify({email,options}));return Promise.resolve({error:null})},
            verifyOtp:(args)=>{sessionStorage.setItem('qa_recovery_otp',JSON.stringify(args));return Promise.resolve({data:{user,session:{user}},error:null})},
            updateUser:(args)=>{sessionStorage.setItem('qa_recovery_update',JSON.stringify(args));return Promise.resolve({data:{user},error:null})},
            getSession:()=>Promise.resolve({data:{session:null},error:null}),
            getUser:()=>Promise.resolve({data:{user:null},error:null}),
            signInWithPassword:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            signOut:()=>Promise.resolve({error:null}),
            signUp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            resend:()=>Promise.resolve({error:null}),
            onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
          },
          rpc:()=>Promise.resolve({data:null,error:null}),
          from:()=>query(),
          storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),remove:()=>Promise.resolve({error:null})})}
        };
        window.supabase={createClient:()=>client};
      });
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else if(u.hostname==='cdn.jsdelivr.net')route.fallback();
        else route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* Supabase stubbed by recovery regression */'
      }));

      console.log('Password recovery START');
      await page.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
      await page.locator('[data-role="admin"]').tap({timeout:5000});
      await page.locator('#loginEmail').fill('recovery@example.test');
      await page.locator('#forgotBtn').tap({timeout:5000});
      await page.waitForSelector('#otpView:not(.hidden)',{state:'visible',timeout:6000});
      const requested=await page.evaluate(()=>(()=>{
        try{return JSON.parse(sessionStorage.getItem('qa_recovery_request')||'null')}catch(_){return null}
      })());
      if(requested?.email!=='recovery@example.test'||!String(requested?.options?.redirectTo||'').includes('login.html?reset=1')){
        pushFailure('password recovery','Recovery request did not use the registered email/reset redirect',JSON.stringify(requested));
      }

      await page.locator('#otpCode').fill('123456');
      await page.locator('#verifyOtpBtn').tap({timeout:5000});
      await page.waitForSelector('#resetView:not(.hidden)',{state:'visible',timeout:6000});
      const otp=await page.evaluate(()=>(()=>{
        try{return JSON.parse(sessionStorage.getItem('qa_recovery_otp')||'null')}catch(_){return null}
      })());
      if(otp?.email!=='recovery@example.test'||otp?.token!=='123456'||otp?.type!=='recovery'){
        pushFailure('password recovery','Recovery OTP was not verified with the expected email/token/type',JSON.stringify(otp));
      }

      await page.locator('#newPassword').fill('new-secure-password');
      await page.locator('#confirmNewPassword').fill('new-secure-password');
      await page.locator('#resetForm button[type="submit"]').tap({timeout:5000});
      await page.waitForFunction(()=>/Password changed successfully/i.test(document.getElementById('resetStatus')?.textContent||''),null,{timeout:6000});
      const recoveryState=await page.evaluate(()=>({
        update:(()=>{try{return JSON.parse(sessionStorage.getItem('qa_recovery_update')||'null')}catch(_){return null}})(),
        recoveryEmail:localStorage.getItem('edunizam_recovery_email'),
        status:(document.getElementById('resetStatus')?.textContent||'').trim()
      }));
      if(recoveryState.update?.password!=='new-secure-password'||recoveryState.recoveryEmail!==null){
        pushFailure('password recovery','Password reset did not persist through updateUser and clear recovery state',JSON.stringify(recoveryState));
      }
      console.log('Password recovery PASS');
    }catch(error){
      pushFailure('password recovery','Forgot Password -> OTP -> New Password regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }

  // First Admin school creation: verified signup must register the institution,
  // persist the Head workspace and enter app.html through the secure handoff.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    page.setDefaultTimeout(6000);
    page.setDefaultNavigationTimeout(10000);
    try{
      await page.addInitScript(()=>{
        const institutionId='44444444-4444-4444-8444-444444444444';
        const user={id:'qa-admin-signup',email:'admin-signup@example.test',user_metadata:{}};
        const workspace={
          institution_id:institutionId,
          institution_name:'QA Admin School',
          institution_type:'School',
          registration_number:'REG-QA-ADMIN',
          school_registration_code:'AUTO-QA-ADMIN',
          workspace_role:'head_of_institute'
        };
        const signedIn=()=>sessionStorage.getItem('qa_admin_signup_signed_in')==='1';
        const query=()=>{
          const result={data:[],error:null};
          const q={
            select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
            insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
            maybeSingle(){return Promise.resolve({data:null,error:null})},
            single(){return Promise.resolve({data:null,error:null})},
            then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
          };
          return q;
        };
        const client={
          auth:{
            signUp:()=>{sessionStorage.setItem('qa_admin_signup_signed_in','1');return Promise.resolve({data:{user,session:{user}},error:null})},
            signInWithPassword:()=>{sessionStorage.setItem('qa_admin_signup_signed_in','1');return Promise.resolve({data:{user,session:{user}},error:null})},
            signOut:()=>{sessionStorage.removeItem('qa_admin_signup_signed_in');return Promise.resolve({error:null})},
            getSession:()=>Promise.resolve({data:{session:signedIn()?{user}:null},error:null}),
            getUser:()=>Promise.resolve({data:{user:signedIn()?user:null},error:null}),
            resend:()=>Promise.resolve({error:null}),
            resetPasswordForEmail:()=>Promise.resolve({error:null}),
            verifyOtp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            updateUser:()=>Promise.resolve({data:{user},error:null}),
            onAuthStateChange:(cb)=>{setTimeout(()=>cb('INITIAL_SESSION',signedIn()?{user}:null),0);return {data:{subscription:{unsubscribe(){}}}}}
          },
          rpc:(name,args={})=>{
            if(name==='register_admin_school_v2'){
              sessionStorage.setItem('qa_admin_register_rpc',JSON.stringify(args));
              return Promise.resolve({data:{institution_id:institutionId},error:null});
            }
            if(name==='my_authorized_workspaces'){
              const n=Number(sessionStorage.getItem('qa_admin_workspace_calls')||0)+1;
              sessionStorage.setItem('qa_admin_workspace_calls',String(n));
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
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else if(u.hostname==='cdn.jsdelivr.net')route.fallback();
        else route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* Supabase stubbed by admin onboarding regression */'
      }));

      console.log('Admin onboarding START');
      await page.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
      await page.locator('[data-role="admin"]').tap({timeout:5000});
      await page.locator('#signupTab').tap({timeout:5000});
      await page.locator('#schoolName').fill('QA Admin School');
      await page.locator('#fullName').fill('QA Admin');
      await page.locator('#contactNumber').fill('03000000000');
      await page.locator('#signupEmail').fill('admin-signup@example.test');
      await page.locator('#signupPassword').fill('correct-password');
      await page.locator('#schoolCode').fill('REG-QA-ADMIN');
      await page.locator('#signupBtn').tap({timeout:5000,noWaitAfter:true});
      await page.waitForURL(/\/app\.html\?secureLogin=1$/,{timeout:6000});
      await page.waitForSelector('#roleSession',{state:'visible',timeout:6000});
      const adminState=await page.evaluate(()=>({
        rpc:(()=>{try{return JSON.parse(sessionStorage.getItem('qa_admin_register_rpc')||'null')}catch(_){return null}})(),
        local:(()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch(_){return null}})(),
        settings:(()=>{try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){return{}}})(),
        flash:(()=>{try{return JSON.parse(localStorage.getItem('edunizam_flash_message')||'null')}catch(_){return null}})(),
        workspaceCalls:Number(sessionStorage.getItem('qa_admin_workspace_calls')||0),
        label:(document.querySelector('#roleSession strong')?.textContent||'').trim(),
        guardPresent:!!document.getElementById('cloudAuthScreen')
      }));
      if(adminState.rpc?.p_school_name!=='QA Admin School'||adminState.rpc?.p_registration_number!=='REG-QA-ADMIN'){
        pushFailure('admin onboarding','Admin signup did not register the expected school payload',JSON.stringify(adminState));
      }
      if(adminState.guardPresent||adminState.local?.role!=='head'||adminState.local?.institutionId!=='44444444-4444-4444-8444-444444444444'||adminState.settings?.schoolName!=='QA Admin School'||!adminState.label.includes('Head')){
        pushFailure('admin onboarding','First Admin school creation did not settle into the Head workspace',JSON.stringify(adminState));
      }
      if(adminState.workspaceCalls!==1)pushFailure('admin onboarding','Admin signup repeated workspace authorization instead of trusting the fresh handoff',JSON.stringify(adminState));
      console.log('Admin onboarding PASS');
    }catch(error){
      pushFailure('admin onboarding','First Admin school creation regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }

  // Signup email verification continuation: an unverified Teacher signup must
  // preserve its pending request, accept OTP, then submit approval exactly once.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    page.setDefaultTimeout(6000);
    page.setDefaultNavigationTimeout(10000);
    try{
      await page.addInitScript(()=>{
        const institutionId='55555555-5555-4555-8555-555555555555';
        const user={id:'qa-email-verify',email:'verify-teacher@example.test',user_metadata:{},identities:[{id:'identity-1'}]};
        const directory={institution_id:institutionId,institution_name:'QA Verify School',institution_type:'School',registration_number:'VERIFY-QA',school_registration_code:'VERIFY-QA-LOGIN'};
        const query=()=>{
          const result={data:[],error:null};
          const q={
            select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
            insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
            maybeSingle(){return Promise.resolve({data:null,error:null})},
            single(){return Promise.resolve({data:null,error:null})},
            then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
          };
          return q;
        };
        const client={
          auth:{
            signUp:()=>Promise.resolve({data:{user,session:null},error:null}),
            verifyOtp:(args)=>{sessionStorage.setItem('qa_verify_signup_otp',JSON.stringify(args));return Promise.resolve({data:{user,session:{user}},error:null})},
            signOut:()=>{sessionStorage.setItem('qa_verify_signup_signed_out','1');return Promise.resolve({error:null})},
            getSession:()=>Promise.resolve({data:{session:null},error:null}),
            getUser:()=>Promise.resolve({data:{user:null},error:null}),
            signInWithPassword:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            resend:()=>Promise.resolve({error:null}),
            resetPasswordForEmail:()=>Promise.resolve({error:null}),
            updateUser:()=>Promise.resolve({data:{user},error:null}),
            onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
          },
          rpc:(name,args={})=>{
            if(name==='list_school_directory_v1'||name==='search_school_directory_v1')return Promise.resolve({data:[directory],error:null});
            if(name==='submit_teacher_school_request_v1'){
              sessionStorage.setItem('qa_verify_signup_rpc',JSON.stringify(args));
              return Promise.resolve({data:{ok:true},error:null});
            }
            return Promise.resolve({data:null,error:null});
          },
          from:()=>query(),
          storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),remove:()=>Promise.resolve({error:null})})}
        };
        window.supabase={createClient:()=>client};
      });
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else if(u.hostname==='cdn.jsdelivr.net')route.fallback();
        else route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* Supabase stubbed by signup verification regression */'
      }));

      console.log('Signup verification START');
      await page.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
      await page.locator('[data-role="teacher"]').tap({timeout:5000});
      await page.waitForFunction(()=>[...document.querySelectorAll('#memberSchoolDropdown option')].some(o=>o.value==='55555555-5555-4555-8555-555555555555'),null,{timeout:6000});
      await page.locator('#memberSchoolDropdown').selectOption('55555555-5555-4555-8555-555555555555');
      await page.locator('#signupTab').tap({timeout:5000});
      await page.locator('#fullName').fill('QA Verify Teacher');
      await page.locator('#contactNumber').fill('03000000000');
      await page.locator('#signupEmail').fill('verify-teacher@example.test');
      await page.locator('#signupPassword').fill('correct-password');
      await page.locator('#signupBtn').tap({timeout:5000});
      await page.waitForSelector('#otpView:not(.hidden)',{state:'visible',timeout:6000});
      const pendingBeforeOtp=await page.evaluate(()=>({
        pending:!!localStorage.getItem('edunizam_pending_signup'),
        verifyEmail:localStorage.getItem('edunizam_verify_email')
      }));
      if(!pendingBeforeOtp.pending||pendingBeforeOtp.verifyEmail!=='verify-teacher@example.test'){
        pushFailure('signup verification','Unverified signup did not preserve its pending continuation state',JSON.stringify(pendingBeforeOtp));
      }
      await page.locator('#otpCode').fill('654321');
      await page.locator('#verifyOtpBtn').tap({timeout:5000});
      await page.waitForFunction(()=>/Teacher request sent/i.test(document.getElementById('statusBox')?.textContent||''),null,{timeout:6000});
      const verifiedState=await page.evaluate(()=>({
        otp:(()=>{try{return JSON.parse(sessionStorage.getItem('qa_verify_signup_otp')||'null')}catch(_){return null}})(),
        rpc:(()=>{try{return JSON.parse(sessionStorage.getItem('qa_verify_signup_rpc')||'null')}catch(_){return null}})(),
        signedOut:sessionStorage.getItem('qa_verify_signup_signed_out')==='1',
        pending:localStorage.getItem('edunizam_pending_signup'),
        verifyEmail:localStorage.getItem('edunizam_verify_email'),
        loginVisible:!document.getElementById('loginForm')?.classList.contains('hidden')
      }));
      if(verifiedState.otp?.email!=='verify-teacher@example.test'||verifiedState.otp?.token!=='654321'||verifiedState.otp?.type!=='email'){
        pushFailure('signup verification','Signup OTP verification used the wrong email/token/type',JSON.stringify(verifiedState));
      }
      if(verifiedState.rpc?.p_institution_id!=='55555555-5555-4555-8555-555555555555'||!verifiedState.signedOut||verifiedState.pending!==null||verifiedState.verifyEmail!==null||!verifiedState.loginVisible){
        pushFailure('signup verification','Verified Teacher signup did not complete its approval request and cleanup',JSON.stringify(verifiedState));
      }
      console.log('Signup verification PASS');
    }catch(error){
      pushFailure('signup verification','Email verification continuation regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }

  // Pending/rejected access must fail closed with a useful message, never hang
  // or open a private workspace.
  for(const accessCase of [
    {role:'teacher',status:'pending',note:'',expect:'Waiting for School Admin approval'},
    {role:'student',status:'rejected',note:'Profile mismatch',expect:'rejected by School Admin: Profile mismatch'}
  ]){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    page.setDefaultTimeout(6000);
    page.setDefaultNavigationTimeout(10000);
    try{
      await page.addInitScript(({role,status,note})=>{
        const institutionId='66666666-6666-4666-8666-666666666666';
        const user={id:'qa-'+role+'-'+status,email:role+'-'+status+'@example.test',user_metadata:{}};
        const directory={institution_id:institutionId,institution_name:'QA Approval State School',institution_type:'School',registration_number:'STATE-QA',school_registration_code:'STATE-QA-LOGIN'};
        const makeQuery=(table)=>{
          const result={data:[],error:null};
          const q={
            select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},like(){return q},ilike(){return q},order(){return q},limit(){return q},
            insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
            maybeSingle(){return Promise.resolve(table==='school_access_requests'?{data:{status,review_note:note,requested_role:role,institution_id:institutionId},error:null}:{data:null,error:null})},
            single(){return Promise.resolve({data:null,error:null})},
            then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
          };
          return q;
        };
        const client={
          auth:{
            signInWithPassword:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            signOut:()=>{sessionStorage.setItem('qa_access_state_signed_out','1');return Promise.resolve({error:null})},
            getSession:()=>Promise.resolve({data:{session:null},error:null}),
            getUser:()=>Promise.resolve({data:{user:null},error:null}),
            signUp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            resend:()=>Promise.resolve({error:null}),
            resetPasswordForEmail:()=>Promise.resolve({error:null}),
            verifyOtp:()=>Promise.resolve({data:{user,session:{user}},error:null}),
            updateUser:()=>Promise.resolve({data:{user},error:null}),
            onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
          },
          rpc:(name)=>{
            if(name==='list_school_directory_v1'||name==='search_school_directory_v1')return Promise.resolve({data:[directory],error:null});
            if(name==='my_authorized_workspaces')return Promise.resolve({data:[],error:null});
            return Promise.resolve({data:null,error:null});
          },
          from:(table)=>makeQuery(table),
          storage:{from:()=>({createSignedUrl:()=>Promise.resolve({data:{signedUrl:''},error:null}),remove:()=>Promise.resolve({error:null})})}
        };
        window.supabase={createClient:()=>client};
      },accessCase);
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else if(u.hostname==='cdn.jsdelivr.net')route.fallback();
        else route.abort();
      });
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({
        status:200,contentType:'text/javascript',body:'/* Supabase stubbed by approval-state regression */'
      }));

      console.log('Approval state START: '+accessCase.role+' '+accessCase.status);
      await page.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:10000});
      await page.locator('[data-role="'+accessCase.role+'"]').tap({timeout:5000});
      await page.waitForFunction(()=>[...document.querySelectorAll('#memberSchoolDropdown option')].some(o=>o.value==='66666666-6666-4666-8666-666666666666'),null,{timeout:6000});
      await page.locator('#memberSchoolDropdown').selectOption('66666666-6666-4666-8666-666666666666');
      await page.locator('#loginEmail').fill(accessCase.role+'-'+accessCase.status+'@example.test');
      await page.locator('#loginPassword').fill('correct-password');
      await page.locator('#loginBtn').tap({timeout:5000});
      await page.waitForFunction(expect=>(document.getElementById('statusBox')?.textContent||'').includes(expect),accessCase.expect,{timeout:6000});
      const accessState=await page.evaluate(()=>({
        status:(document.getElementById('statusBox')?.textContent||'').trim(),
        signedOut:sessionStorage.getItem('qa_access_state_signed_out')==='1',
        local:localStorage.getItem('edunizam_session'),
        path:location.pathname,
        buttonDisabled:document.getElementById('loginBtn')?.disabled||false
      }));
      if(!accessState.signedOut||accessState.local!==null||!/\/login\.html$/.test(accessState.path)||accessState.buttonDisabled){
        pushFailure('approval state',accessCase.role+' '+accessCase.status+' login did not fail closed cleanly',JSON.stringify(accessState));
      }
      console.log('Approval state PASS: '+accessCase.role+' '+accessCase.status);
    }catch(error){
      pushFailure('approval state',accessCase.role+' '+accessCase.status+' login-state regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
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
