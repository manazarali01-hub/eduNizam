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
const widths=[320,360,390,412,430,768,1024,1366];
const pages=['/','/login.html','/learn.html','/admission.html','/app.html'];

function pushFailure(scope,message,detail=''){
  failures.push({scope,message,detail});
}

async function inspectPage(page,url,width){
  await page.route('**/*',route=>{
    const requestUrl=new URL(route.request().url());
    if(requestUrl.hostname==='127.0.0.1')route.continue();
    else route.abort();
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForTimeout(350);

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
    for(const width of widths){
      const page=await browser.newPage({
        javaScriptEnabled:false,
        viewport:{width,height:Math.max(760,Math.round(width*1.7))}
      });
      try{
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
          if(sidebarExists)await page.waitForTimeout(320);
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
      }finally{
        await page.close();
      }
    }
  }

  // Interaction regression: the secure-session guard must remain tappable on a phone
  // even while the cloud session request is still unresolved.
  const authPage=await browser.newPage({
    javaScriptEnabled:true,
    viewport:{width:360,height:760},
    isMobile:true,
    hasTouch:true
  });
  try{
    await authPage.route('**/auth-harness',route=>route.fulfill({
      status:200,contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'
    }));
    await authPage.route('**/login.html?from=secure-guard',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Login target</title>'}));
    await authPage.route('**/learn.html?from=secure-guard',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Guest target</title>'}));

    const loadGuard=async()=>{
      await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
      await authPage.evaluate(()=>{
        window.EDUNIZAM_CLOUD_CONFIG={enabled:true};
        window.EDUNIZAM_CLOUD={
          ready:()=>true,
          state:{client:{auth:{getSession:()=>new Promise(()=>{})}}}
        };
      });
      await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
      await authPage.waitForSelector('#cloudAuthLogin',{state:'visible',timeout:3000});
    };

    await loadGuard();
    const loginLink=await authPage.locator('#cloudAuthLogin').evaluate(el=>({tag:el.tagName,href:el.getAttribute('href')}));
    if(loginLink.tag!=='A'||loginLink.href!=='login.html?from=secure-guard')pushFailure('auth guard touch','Go to Login is not a native anchor',JSON.stringify(loginLink));
    await authPage.locator('#cloudAuthLogin').tap();
    await authPage.waitForURL(/\/login\.html\?from=secure-guard$/,{timeout:3000}).catch(e=>pushFailure('auth guard touch','Go to Login tap did not navigate',e.message));

    await loadGuard();
    const guestLink=await authPage.locator('#cloudAuthGuest').evaluate(el=>({tag:el.tagName,href:el.getAttribute('href')}));
    if(guestLink.tag!=='A'||guestLink.href!=='learn.html?from=secure-guard')pushFailure('auth guard touch','Continue as Guest is not a native anchor',JSON.stringify(guestLink));
    await authPage.locator('#cloudAuthGuest').tap();
    await authPage.waitForURL(/\/learn\.html\?from=secure-guard$/,{timeout:3000}).catch(e=>pushFailure('auth guard touch','Continue as Guest tap did not navigate',e.message));

    const loadRetryGuard=async()=>{
      await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
      await authPage.evaluate(()=>{
        window.EDUNIZAM_CLOUD_CONFIG={enabled:true};
        window.EDUNIZAM_CLOUD={
          ready:()=>true,
          state:{client:{auth:{getSession:()=>Promise.reject(new Error('Simulated secure-session network failure'))}}}
        };
      });
      await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
      await authPage.waitForSelector('#cloudAuthRetry',{state:'visible',timeout:3000});
    };

    await loadRetryGuard();
    await authPage.locator('#cloudAuthRetry').tap();
    await authPage.waitForURL(url=>url.pathname.endsWith('/auth-harness')&&url.searchParams.has('_secureRetry'),{timeout:3000})
      .catch(e=>pushFailure('auth guard touch','Retry secure check tap did not trigger a recovery navigation',e.message));

    // Successful post-login handoff: once the workspace is verified, a redundant
    // auth event must not re-open the blocking guard or re-enter getSession().
    await authPage.goto('http://127.0.0.1:'+port+'/auth-harness',{waitUntil:'domcontentloaded'});
    await authPage.evaluate(()=>{
      localStorage.setItem('edunizam_session',JSON.stringify({
        role:'head',identity:'admin@example.test',institutionId:'school-1',schoolName:'Test School'
      }));
      localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify({enabled:true,institutionId:'school-1'}));
      window.__getSessionCalls=0;
      const user={id:'user-1',email:'admin@example.test'};
      window.EDUNIZAM_CLOUD_CONFIG={enabled:true};
      window.EDUNIZAM_CLOUD_SETUP={ensureInstitution:()=>Promise.resolve(true)};
      window.EDUNIZAM_CLOUD={
        ready:()=>true,
        state:{user,client:{auth:{getSession:()=>{window.__getSessionCalls++;return Promise.resolve({data:{session:{user}},error:null})}}}},
        getMyRole:()=>Promise.resolve('head_of_institute')
      };
    });
    await authPage.addScriptTag({url:'http://127.0.0.1:'+port+'/auth-bridge.js'});
    await authPage.waitForFunction(()=>!document.getElementById('cloudAuthScreen'),{timeout:3000})
      .catch(e=>pushFailure('auth guard handoff','Successful Admin workspace did not clear secure guard',e.message));
    const beforeRedundant=await authPage.evaluate(()=>window.__getSessionCalls);
    await authPage.evaluate(()=>window.dispatchEvent(new CustomEvent('edunizam:auth',{detail:{user:window.EDUNIZAM_CLOUD.state.user}})));
    await authPage.waitForTimeout(150);
    const handoffState=await authPage.evaluate(()=>({
      getSessionCalls:window.__getSessionCalls,
      guardPresent:!!document.getElementById('cloudAuthScreen')
    }));
    if(handoffState.guardPresent)pushFailure('auth guard handoff','Redundant auth event re-opened the secure guard',JSON.stringify(handoffState));
    if(handoffState.getSessionCalls!==beforeRedundant)pushFailure('auth guard handoff','Verified workspace redundantly called getSession again',JSON.stringify({beforeRedundant,...handoffState}));
  }catch(e){
    pushFailure('auth guard touch','Secure access interaction regression failed',e.message||String(e));
  }finally{
    await authPage.close();
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
