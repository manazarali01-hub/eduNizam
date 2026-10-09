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
const pages=['/','/login.html','/features.html','/learn.html','/admission.html','/app.html','/pakistan-degree-accreditation-recognition.html','/pakistan-entry-tests-scholarships.html'];

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
  // Large homepage stylesheets can finish a few frames after DOMContentLoaded.
  // Measure the fully styled page, not the brief legacy two-column fallback.
  // This wait retains the layout contract: a missing/incorrect stylesheet
  // still fails the subsequent assertions instead of silently passing.
  if(url.endsWith('/')) {
    await page.waitForFunction(()=>{
      const strip=document.querySelector('.page-home .experience-strip');
      const title=strip?.querySelector('article strong');
      const hero=document.querySelector('.page-home .hero-image-wrap');
      const quick=document.querySelector('.page-home .quick-access-card');
      const roles=document.querySelector('.page-home .hero-role-badge');
      if(!strip||!title||!hero||!quick||!roles)return false;
      const ready=Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(el=>el.href.startsWith(location.origin))
        .every(el=>!!el.sheet);
      if(!ready)return false;
      const cols=getComputedStyle(strip).gridTemplateColumns.trim().split(/\s+/).length;
      return window.innerWidth>430||(cols===1&&parseFloat(getComputedStyle(title).fontSize)>=22);
    },null,{timeout:12000,polling:100}).catch(()=>{});
  }
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
      glass:{
        home:(()=>{const el=document.querySelector('.page-home .experience-strip article');if(!el)return null;const cs=getComputedStyle(el);return {bg:cs.backgroundImage,blur:cs.backdropFilter,alpha:cs.opacity};})(),
        login:(()=>{const el=document.querySelector('.auth-page #authCard');if(!el)return null;const cs=getComputedStyle(el);return {bg:cs.backgroundImage,blur:cs.backdropFilter,alpha:cs.opacity};})(),
        role:(()=>{const el=document.querySelector('.auth-page #roleView .roles .role');if(!el)return null;const cs=getComputedStyle(el);return {bg:cs.backgroundImage,blur:cs.backdropFilter,alpha:cs.opacity};})(),
        feature:(()=>{const el=document.querySelector('.premium-public-page .public-list li');if(!el)return null;const cs=getComputedStyle(el);return {bg:cs.backgroundImage,blur:cs.backdropFilter,alpha:cs.opacity};})(),
        app:(()=>{const el=document.querySelector('.page-app .main .view.active .card');if(!el)return null;const cs=getComputedStyle(el);return {bg:cs.backgroundImage,blur:cs.backdropFilter,alpha:cs.opacity};})()
      },
      publicGuideHero:(()=>{
        const hero=document.querySelector('.premium-public-page .public-main>.public-hero');
        if(!hero)return null;
        const heading=hero.querySelector('h1'),paragraph=hero.querySelector('p');
        if(!heading||!paragraph)return {missing:true};
        const hs=getComputedStyle(heading),ps=getComputedStyle(paragraph),bs=getComputedStyle(hero);
        const hb=heading.getBoundingClientRect(),pb=paragraph.getBoundingClientRect(),er=hero.getBoundingClientRect();
        const pAlpha=Number((ps.backgroundColor.match(/rgba\([^)]*,\s*([0-9.]+)\)/)||[])[1]||0);
        return {fontSize:parseFloat(hs.fontSize),lineHeight:parseFloat(hs.lineHeight),copyColor:ps.color,
          copyBackground:ps.backgroundColor,pAlpha,copyOpacity:ps.opacity,
          photo:bs.backgroundImage,headingRight:hb.right,copyRight:pb.right,
          heroRight:er.right,height:er.height};
      })(),
      home:{
        nav:box('.page-home .public-nav'),
        main:box('.page-home .public-main'),
        image:box('.page-home .hero-image-wrap'),
        quick:box('.page-home .quick-access-card'),
        roles:box('.page-home .hero-role-badge'),
        imageQuickOverlap:intersects(box('.page-home .hero-image-wrap'),box('.page-home .quick-access-card')),
        quickRoleOverlap:intersects(box('.page-home .quick-access-card'),box('.page-home .hero-role-badge')),
        linksDisplay:getComputedStyle(document.querySelector('.page-home .public-links')||document.body).display,
        navHeight:box('.page-home .public-nav')?.height||0,
        learningColors:[...document.querySelectorAll('.page-home .learning-band .resource-card :is(small,strong,span)')].slice(0,9).map(el=>({color:getComputedStyle(el).color,text:(el.textContent||'').trim().slice(0,30)})),
        experienceColumns:getComputedStyle(document.querySelector('.page-home .experience-strip')||document.body).gridTemplateColumns,
        learningVisualWidth:box('.page-home .learning-band .learning-visual')?.width||0,
        resourceCardWidths:[...document.querySelectorAll('.page-home .learning-band .resource-card')].map(el=>Math.round(el.getBoundingClientRect().width)),
        featureSizes:[...document.querySelectorAll('.page-home .experience-strip article strong')].map(el=>parseFloat(getComputedStyle(el).fontSize)),

        contrastPanels:[
          '.page-home .value-section>.section-heading',
          '.page-home .public-section[aria-labelledby="explore-public-guides"]>.section-heading'
        ].map(sel=>{
          const el=document.querySelector(sel);
          if(!el)return {sel,missing:true};
          const head=el.querySelector('h2'),copy=el.querySelector('p');
          const cs=getComputedStyle(el);
          return {sel,
            background:cs.backgroundImage,
            blur:cs.backdropFilter,
            head:head?getComputedStyle(head).color:'',
            copy:copy?getComputedStyle(copy).color:'',
            opacity:copy?getComputedStyle(copy).opacity:'',
            width:el.getBoundingClientRect().width};
        }),
        footer:{background:getComputedStyle(document.querySelector('footer.public-footer')||document.body).backgroundImage,linkColors:[...document.querySelectorAll('footer.public-footer nav a')].map(el=>getComputedStyle(el).color)}

      }
    };
  });

  return {result,errors};
}

try{
  // REAL browser rendering gate: protects against a deployed but invisible
  // field CSS pass being overridden by the legacy !important style layers.
  const premiumFormPage=await browser.newPage({
    viewport:{width:390,height:844},javaScriptEnabled:false,serviceWorkers:'block'
  });
  await premiumFormPage.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='127.0.0.1')route.continue();
    else route.abort();
  });
  await premiumFormPage.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:20000});
  // DOMContentLoaded can precede downloading external CSS; wait for the
  // premium stylesheet to influence computed styles before making assertions.
  await premiumFormPage.waitForFunction(()=>{
    const el=document.getElementById('loginSchoolName');
    if(!el)return false;
    const cs=getComputedStyle(el);
    return parseFloat(cs.borderTopWidth)>=2.8&&
      (cs.backgroundImage.match(/linear-gradient/g)||[]).length>=2&&
      parseFloat(cs.borderTopLeftRadius)>=16;
  },null,{timeout:15000,polling:200}).catch(()=>{});

  const colorfulForms=await premiumFormPage.evaluate(()=>{
    const fields=['loginSchoolName','loginEmail','loginPassword','memberSchoolDropdown'];
    const computed=fields.map(id=>{
      const el=document.getElementById(id);
      if(!el)return {id,missing:true};
      const cs=getComputedStyle(el);
      return {id,border:parseFloat(cs.borderTopWidth),
        gradientLayers:(cs.backgroundImage.match(/linear-gradient/g)||[]).length,
        radius:parseFloat(cs.borderTopLeftRadius),background:cs.backgroundImage.slice(0,90),
        text:cs.color,shadow:cs.boxShadow};
    });
    const label=document.querySelector('label[for="loginEmail"]');
    const toggle=document.querySelector('#loginPassword')?.parentElement?.querySelector('.password-toggle');
    const ls=label?getComputedStyle(label):null;
    const ts=toggle?getComputedStyle(toggle):null;
    return {fields:computed,
      label:ls?{left:parseFloat(ls.borderLeftWidth),bg:ls.backgroundImage,color:ls.color}:null,
      toggle:ts?{border:parseFloat(ts.borderTopWidth),bg:ts.backgroundImage}:null,
      cssLinked:!!document.querySelector('link[href*="premium-form-fields.css?v=20261008-visible-forms-v2"]')};
  });
  console.log('Visible premium form rendering:',JSON.stringify(colorfulForms));
  if(!colorfulForms.cssLinked)pushFailure('premium forms','v2 stylesheet not loaded in login document');
  for(const item of colorfulForms.fields){
    if(item.missing)pushFailure('premium forms','Expected live form element missing',item.id);
    else if(item.border<2.8||item.gradientLayers<2||item.radius<16)
      pushFailure('premium forms','Still appears plain: visible 3px gradient border missing',JSON.stringify(item));
  }
  if(!colorfulForms.label||colorfulForms.label.left<3.8||!colorfulForms.label.bg.includes('gradient'))
    pushFailure('premium forms','Colorful field label pill not rendered',JSON.stringify(colorfulForms.label));
  if(!colorfulForms.toggle||colorfulForms.toggle.border<1.8)
    pushFailure('premium forms','Premium Show/Hide password button styling absent');
  await premiumFormPage.close();
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
        if(result.publicGuideHero&&width<=430){
          const h=result.publicGuideHero;
          if(h.missing)pushFailure(scope,'Public guide hero heading or description missing');
          else{
            if(h.fontSize>39)pushFailure(scope,'Public guide heading oversized on phone',JSON.stringify(h));
            if(h.pAlpha<.77)pushFailure(scope,'Public guide description has no opaque-enough glass reading plate',JSON.stringify(h));
            const rgb=(h.copyColor.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
            if(rgb.length!==3||rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>125)pushFailure(scope,'Public guide description contrast too pale',JSON.stringify(h));
            if(h.copyOpacity!=='1')pushFailure(scope,'Public guide description is faded',JSON.stringify(h));
            if(!h.photo.includes('url('))pushFailure(scope,'Public guide photo disappeared behind glass',JSON.stringify(h));
            if(h.headingRight>width+2||h.copyRight>width+2)pushFailure(scope,'Public guide hero text escapes viewport',JSON.stringify(h));
            if(route==='/pakistan-degree-accreditation-recognition.html'&&h.height>740)pushFailure(scope,'Recognition hero still consumes almost entire mobile screen',JSON.stringify(h));
          }
        }
        // Inspect actual computed surfaces, not merely CSS selector presence.
        if(width<=430){
          const selectors=route==='/'?['home']:route==='/login.html'?['login','role']:route==='/features.html'?['feature']:route==='/app.html'?['app']:[];
          for(const surface of selectors){
            const detail=result.glass?.[surface];
            if(!detail){pushFailure(scope,'True photo glass sample missing: '+surface);continue;}
            if(!detail.bg.includes('gradient')||!detail.bg.includes('rgba('))pushFailure(scope,'True photo glass has no translucent gradient: '+surface,JSON.stringify(detail));
            if(!detail.blur.includes('blur('))pushFailure(scope,'True photo glass has no rendered frosted blur: '+surface,JSON.stringify(detail));
            if(detail.alpha!=='1')pushFailure(scope,'Text/panel opacity was reduced instead of using frosted glass: '+surface,JSON.stringify(detail));
          }
        }
        if(route==='/'&&width<=430){
          // Measured homepage visual contract: CI must fail if legacy rules
          // squeeze Quick Access to a left strip or feature labels stay tiny.
          const h=result.home;
          if(!h.quick||!h.image||!h.roles||!h.main)pushFailure(scope,'Homepage hero sections missing');
          else {
            if(h.quick.width<h.main.width*.90)
              pushFailure(scope,'Quick Access is not full-width (old screenshot gap remains)',JSON.stringify({main:h.main.width,quick:h.quick.width}));
            if(h.roles.width<h.main.width*.90)
              pushFailure(scope,'Homepage role badges are too narrow',JSON.stringify({main:h.main.width,roles:h.roles.width}));
            if(h.quick.top<h.image.bottom-2)
              pushFailure(scope,'Quick Access overlays the hero image',JSON.stringify({image:h.image,quick:h.quick}));
            if(h.roles.top<h.quick.bottom-2)
              pushFailure(scope,'Role badges overlap Quick Access',JSON.stringify({quick:h.quick,roles:h.roles}));
          }
          if(h.featureSizes.some(x=>x<22))
            pushFailure(scope,'Homepage feature labels are below the enlarged mobile typography target',JSON.stringify(h.featureSizes));
          if(h.experienceColumns.trim().split(/\s+/).length!==1)
            pushFailure(scope,'Homepage features are still squeezed into two tiny mobile columns',h.experienceColumns);
          if(result.home.imageQuickOverlap)pushFailure(scope,'Homepage hero image and Quick Access overlap');
          if(result.home.quickRoleOverlap)pushFailure(scope,'Homepage Quick Access and role badge overlap');
          if(result.home.nav&&result.home.main&&result.home.main.top<result.home.nav.bottom-2){
            pushFailure(scope,'Homepage navigation covers main content',JSON.stringify({nav:result.home.nav,main:result.home.main}));
          }
          // Visual regression guard: an oversized 3-row header or pale-on-pale
          // Learning Hub labels must never slip through the layout-only gates.
          if(result.home.linksDisplay!=='flex')pushFailure(scope,'Homepage mobile navigation is not a compact flex strip',result.home.linksDisplay);
          if(result.home.navHeight>175)pushFailure(scope,'Homepage mobile navigation consumes too much vertical space',Math.round(result.home.navHeight)+'px');
          for(const panel of result.home.contrastPanels||[]){
            if(panel.missing||!panel.background.includes('rgba(')||!panel.blur.includes('blur(')){
              pushFailure(scope,'Homepage heading has no real frosted glass reading plate',JSON.stringify(panel));
              continue;
            }
            const channels=value=>(value.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
            for(const kind of ['head','copy']){
              const vals=channels(panel[kind]);
              if(vals.length!==3||vals[0]*.2126+vals[1]*.7152+vals[2]*.0722>120){
                pushFailure(scope,'Homepage heading/description is too pale over photography',JSON.stringify({panel:panel.sel,kind,color:panel[kind]}));
              }
            }
            if(panel.opacity!=='1')pushFailure(scope,'Homepage description text is faded',JSON.stringify(panel));
          }

          if(result.home.learningVisualWidth<1||result.home.resourceCardWidths.length!==3||result.home.resourceCardWidths.some(w=>w<result.home.learningVisualWidth*.90))pushFailure(scope,'Homepage featured learning resource card fails to fill its column',JSON.stringify({visual:result.home.learningVisualWidth,cards:result.home.resourceCardWidths}));
          if(result.home.featureSizes.length!==6||result.home.featureSizes.some(x=>x<15))pushFailure(scope,'Homepage feature card labels are too small',JSON.stringify(result.home.featureSizes));
          if(result.home.footer.linkColors.length<5||result.home.footer.linkColors.some(c=>{const v=(c.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);return v.length===3&&(v[0]*.2126+v[1]*.7152+v[2]*.0722)<185}))pushFailure(scope,'Homepage footer links fail light-on-dark visual contrast policy',JSON.stringify(result.home.footer));

          if((result.home.learningColors||[]).length<9)pushFailure(scope,'Homepage featured learning card labels are missing');
          for(const item of result.home.learningColors||[]){
            const channels=(item.color.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
            if(channels.length===3&&channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>145){
              pushFailure(scope,'Homepage Learning Hub text is too pale to read',JSON.stringify(item));
            }
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

  // Simulate an installed PWA on the legacy login launch URL, then test
  // the intentional Login button; this must not cause a redirect loop.
  const launchPage=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    await launchPage.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='127.0.0.1')route.continue();else route.abort();
    });
    await launchPage.addInitScript(()=>{
      const baseMatch=window.matchMedia.bind(window);
      window.matchMedia=query=>String(query).includes('display-mode: standalone')
        ? {matches:true,media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}
        : baseMatch(query);
    });
    await launchPage.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'commit',timeout:12000}).catch(()=>{});
    await launchPage.waitForURL(url=>url.pathname==='/'&&url.searchParams.get('pwa_launch')==='1',{timeout:12000});
    await launchPage.locator('.page-home .hero-copy h1').waitFor({state:'visible',timeout:7000});
    await launchPage.locator('.page-home .hero-actions a[href="login.html"]').first().click({timeout:5000});
    await launchPage.waitForURL(url=>url.pathname==='/login.html',{timeout:8000});
    await launchPage.locator('#roleView').waitFor({state:'visible',timeout:6000});
    console.log('Installed PWA legacy launch -> Home -> deliberate Login: PASS');
  }catch(e){pushFailure('installed PWA launch','Legacy installed app launch/home/login interaction failed',String(e.message||e));}
  finally{await launchPage.close();}

  // Color icon rendered contract: every current route (48 original plus additions) remains intact
  // and get distinct, colorful SVGs, while click handlers still fire normally.
  const iconPage=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  try{
    const source=fs.readFileSync(path.join(root,'app.html'),'utf8');
    const nav=source.match(/<nav id="nav"[\s\S]*?<\/nav>/)?.[0]||'';
    if(!nav)pushFailure('color icon contract','Sidebar navigation markup missing from app.html');
    else {
      const stats=['statStudents','statPresent','statFees','statPending'].map(id=>'<article class="stat"><strong id="'+id+'">0</strong></article>').join('');
      await iconPage.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="app-page page-app"><aside class="sidebar"><div id="sidebarInstitute"></div>'+nav+'</aside><header class="topbar"><div class="topbar-actions"></div></header><div id="dashboard">'+stats+'</div></body></html>',{waitUntil:'domcontentloaded'});
      await iconPage.addStyleTag({path:path.join(root,'premium-ui.css')});
      await iconPage.addStyleTag({path:path.join(root,'edunizam-colorful-icons.css')});
      await iconPage.addScriptTag({path:path.join(root,'premium-ui.js')});
      await iconPage.addScriptTag({path:path.join(root,'edunizam-colorful-icons.js')});
      await iconPage.waitForFunction(()=>document.querySelectorAll('#nav .premium-nav-icon[data-edu-icon-key] svg').length>=45,{timeout:7000});
      const icons=await iconPage.evaluate(()=>{
        const nodes=[...document.querySelectorAll('#nav .nav-item[data-view]')];
        // Normalize per-instance gradient IDs before counting distinct artwork.
        // Without this, identical drawings with different SVG paint IDs look unique.
        const symbols=nodes.map(x=>(x.querySelector('.premium-nav-icon .edu-vector-icon')?.innerHTML||'').replace(/enicon-\d+/g,'enicon-N'));
        const enamelCount=nodes.filter(x=>{
          const svg=x.querySelector('.premium-nav-icon .edu-illustrated-icon');
          if(!svg||svg.querySelectorAll('linearGradient').length<4)return false;
          const coated=[...svg.querySelectorAll('[style*="fill:url("]')];
          return coated.length>0&&coated.some(shape=>getComputedStyle(shape).fill.includes('url('));
        }).length;
        const tones=nodes.map(x=>x.querySelector('.premium-nav-icon')?.dataset.eduTone||'');
        const colors=nodes.map(x=>getComputedStyle(x.querySelector('.premium-nav-icon')).color);
        const gradient=getComputedStyle(nodes[0].querySelector('.premium-nav-icon')).backgroundImage;
        const groupCount=document.querySelectorAll('#nav .edu-group-icon svg').length;
        const dockCount=document.querySelectorAll('#premiumMobileDock .premium-dock-icon svg').length;
        const statCount=document.querySelectorAll('.premium-stat-icon svg').length;
        let clicks=0;
        const button=document.querySelector('#nav .nav-item[data-view="paperbuilder"]');
        button.addEventListener('click',()=>{clicks++},{once:true});
        button.click();
        return {count:nodes.length,svgCount:symbols.filter(Boolean).length,uniqueIcons:new Set(symbols).size,
          uniqueTones:new Set(tones).size,uniqueColors:new Set(colors).size,
          groupCount,dockCount,statCount,clicks,gradient,enamelCount,
          labelsPreserved:nodes.every(x=>!!x.querySelector('.premium-nav-label')?.textContent.trim()&&!!x.dataset.view)};
      });
      if(icons.count<48||icons.svgCount!==icons.count||icons.uniqueIcons<32||icons.enamelCount!==icons.count||icons.uniqueTones<6||
         icons.uniqueColors<6||icons.groupCount<7||icons.dockCount<3||icons.statCount<4||
         icons.clicks!==1||!icons.labelsPreserved||!icons.gradient.includes('gradient'))
        pushFailure('color icon contract','Sidebar semantic icon count, group badges, dock icons or click handlers regressed',JSON.stringify(icons));
      else console.log('Color icon contract PASS: '+JSON.stringify(icons));
    }
  }catch(e){pushFailure('color icon contract','Rendered color icon regression',String(e.message||e));}
  finally{await iconPage.close();}

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

    console.log('Guest step START: Study Library read/save/modal');
    await guestPage.locator('.tabs .tab[data-tab="study"]').tap({timeout:5000});
    await guestPage.waitForSelector('#study.section.active',{state:'visible',timeout:5000});
    await guestPage.waitForSelector('#study [data-study-id]',{state:'visible',timeout:5000});
    const studyId=await guestPage.locator('#study [data-study-id]').first().getAttribute('data-study-id');
    await guestPage.locator('#study [data-study-id]').first().tap({timeout:5000});
    await guestPage.waitForSelector('#premiumResourceModal.open',{state:'visible',timeout:5000});
    const studyModal=await guestPage.evaluate(()=>({
      title:(document.getElementById('premiumPreviewTitle')?.textContent||'').trim(),
      body:(document.getElementById('premiumPreviewBody')?.textContent||'').trim(),
      locked:document.body.classList.contains('guest-modal-open'),
      aria:document.getElementById('premiumResourceModal')?.getAttribute('aria-hidden'),
      printButton:!!document.querySelector('#premiumResourceModal [data-print-study-id]'),
      saveButton:!!document.querySelector('#premiumResourceModal [data-fav-id]')
    }));
    if(!studyId||studyModal.title.length<5||studyModal.body.length<10||!studyModal.locked||studyModal.aria!=='false'||!studyModal.printButton||!studyModal.saveButton){
      pushFailure('guest learning','Built-in Study Library Read Now did not open a usable resource modal',JSON.stringify({studyId,studyModal}));
    }
    await guestPage.locator('#premiumResourceModal [data-fav-id]').tap({timeout:5000});
    const savedStudy=await guestPage.evaluate(id=>{
      const rows=JSON.parse(localStorage.getItem('edunizam_guest_favorites')||'[]');
      return rows.some(x=>x.id==='study:'+id);
    },studyId);
    if(!savedStudy)pushFailure('guest learning','Guest Save action did not persist the built-in Study Library resource',JSON.stringify({studyId}));

    console.log('Guest step START: built-in study print action');
    await guestPage.evaluate(()=>{
      window.__qaGuestPrint={opened:0,writes:'',printed:0,focused:0,closed:0,url:''};
      window.open=(url='')=>{
        window.__qaGuestPrint.opened++;
        window.__qaGuestPrint.url=String(url||'');
        return {
          document:{
            write:html=>{window.__qaGuestPrint.writes+=String(html||'')},
            close:()=>{window.__qaGuestPrint.closed++}
          },
          focus:()=>{window.__qaGuestPrint.focused++},
          print:()=>{window.__qaGuestPrint.printed++}
        };
      };
    });
    await guestPage.locator('#premiumResourceModal [data-print-study-id]').tap({timeout:5000});
    await guestPage.waitForFunction(()=>window.__qaGuestPrint?.printed>0,null,{timeout:3000});
    const printState=await guestPage.evaluate(()=>window.__qaGuestPrint);
    if(printState.opened!==1||printState.printed<1||printState.closed<1||printState.focused<1||printState.writes.length<80||!/<html|<!doctype/i.test(printState.writes)){
      pushFailure('guest learning','Built-in Study Library Print Resource action did not create printable content',JSON.stringify(printState));
    }
    console.log('Guest step PASS: built-in study print action');

    await guestPage.locator('#premiumResourceModal [data-close-premium]').tap({timeout:5000});
    await guestPage.waitForFunction(()=>!document.getElementById('premiumResourceModal')?.classList.contains('open'));
    const closedStudy=await guestPage.evaluate(()=>({
      locked:document.body.classList.contains('guest-modal-open'),
      aria:document.getElementById('premiumResourceModal')?.getAttribute('aria-hidden')
    }));
    if(closedStudy.locked||closedStudy.aria!=='true')pushFailure('guest learning','Closing Study Library modal did not restore mobile page interaction',JSON.stringify(closedStudy));
    console.log('Guest step PASS: Study Library read/save/modal');

    console.log('Guest step START: external preview lifecycle');
    const preview=guestPage.locator('#study [data-preview-id]').first();
    if(await preview.count()){
      await preview.tap({timeout:5000});
      await guestPage.waitForSelector('#premiumResourceModal.open',{state:'visible',timeout:5000});
      const previewState=await guestPage.evaluate(()=>({
        open:document.getElementById('premiumResourceModal')?.classList.contains('open')||false,
        source:document.querySelector('#premiumPreviewActions a.primary-action')?.getAttribute('href')||'',
        actions:(document.getElementById('premiumPreviewActions')?.textContent||'').trim()
      }));
      if(!previewState.open||!/^https?:\/\//i.test(previewState.source)||!previewState.actions.includes('Open Source')){
        pushFailure('guest learning','External learning resource Preview did not expose a genuine source action',JSON.stringify(previewState));
      }
      await guestPage.locator('#premiumResourceModal [data-close-premium]').tap({timeout:5000});
    }else{
      pushFailure('guest learning','Study Library did not expose any previewable external resource');
    }
    console.log('Guest step PASS: external preview lifecycle');

    console.log('Guest step START: PDF preview / download / print actions');
    await guestPage.evaluate(()=>{
      const rows=window.EDUNIZAM_STUDY_DATA?.materials;
      if(Array.isArray(rows)&&!rows.some(x=>x.id==='qa-pdf-regression')){
        rows.push({
          id:'qa-pdf-regression',
          title:'QA PDF Resource',
          note:'Regression-only PDF action probe',
          fileUrl:'https://example.test/qa-resource.pdf',
          source:'official',
          type:'Revision PDF',
          board:'Punjab Boards',
          classLevels:['10'],
          subject:'Mathematics'
        });
      }
    });
    await guestPage.locator('#guestStudyQuery').fill('QA PDF Resource');
    await guestPage.locator('#guestStudySearch').tap({timeout:5000});
    await guestPage.waitForSelector('#guestStudyResults [data-preview-id="study:qa-pdf-regression"]',{state:'visible',timeout:5000});
    await guestPage.locator('#guestStudyResults [data-preview-id="study:qa-pdf-regression"]').tap({timeout:5000});
    await guestPage.waitForSelector('#premiumResourceModal.open',{state:'visible',timeout:5000});
    const pdfActions=await guestPage.evaluate(()=>({
      source:document.querySelector('#premiumPreviewActions a.primary-action')?.getAttribute('href')||'',
      download:document.querySelector('#premiumPreviewActions a[download]')?.getAttribute('href')||'',
      printUrl:document.querySelector('#premiumPreviewActions [data-print-url]')?.getAttribute('data-print-url')||'',
      iframe:document.querySelector('#premiumPreviewBody iframe')?.getAttribute('src')||''
    }));
    if(pdfActions.source!=='https://example.test/qa-resource.pdf'||pdfActions.download!==pdfActions.source||pdfActions.printUrl!==pdfActions.source||pdfActions.iframe!==pdfActions.source){
      pushFailure('guest learning','PDF Preview did not expose working source/download/print targets',JSON.stringify(pdfActions));
    }
    await guestPage.evaluate(()=>{
      window.__qaPdfOpen={calls:[]};
      window.open=(url,target)=>{window.__qaPdfOpen.calls.push({url:String(url||''),target:String(target||'')});return {focus(){}}};
    });
    await guestPage.locator('#premiumPreviewActions [data-print-url]').tap({timeout:5000});
    const pdfOpen=await guestPage.evaluate(()=>window.__qaPdfOpen);
    if(pdfOpen.calls.length!==1||pdfOpen.calls[0].url!=='https://example.test/qa-resource.pdf'||pdfOpen.calls[0].target!=='_blank'){
      pushFailure('guest learning','Open PDF to Print action did not open the selected PDF in a new tab',JSON.stringify(pdfOpen));
    }
    await guestPage.locator('#premiumResourceModal [data-close-premium]').tap({timeout:5000});
    await guestPage.locator('#guestStudyQuery').fill('');
    await guestPage.locator('#guestStudySearch').tap({timeout:5000});
    console.log('Guest step PASS: PDF preview / download / print actions');

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
    console.log('Guest step START: VU material explorer');
    await guestPage.waitForSelector('#vuExplorerSearchBtn',{state:'visible',timeout:5000});
    await guestPage.locator('#vuExplorerQuery').fill('CS101');
    await guestPage.locator('#vuExplorerSearchBtn').tap({timeout:5000});
    await guestPage.waitForFunction(()=>String(document.getElementById('vuExplorerSummary')?.textContent||'').trim().length>10,null,{timeout:5000});
    const vuExplorerState=await guestPage.evaluate(()=>({
      summary:(document.getElementById('vuExplorerSummary')?.textContent||'').trim(),
      quick:(document.getElementById('vuExplorerQuick')?.textContent||'').trim(),
      materials:(document.getElementById('vuExplorerMaterials')?.textContent||'').trim(),
      results:(document.getElementById('vuExplorerResults')?.textContent||'').trim()
    }));
    if(!/CS101|Course matched/i.test(vuExplorerState.summary)||((vuExplorerState.quick+vuExplorerState.materials+vuExplorerState.results).length<30)){
      pushFailure('guest learning','VU material explorer did not render a usable CS101 resource pack',JSON.stringify(vuExplorerState));
    }
    console.log('Guest step PASS: VU material explorer');

    await guestPage.locator('#clearSearch').tap({timeout:5000});
    console.log('Guest step START: Practice Center');
    await guestPage.locator('.tabs .tab[data-tab="practice"]').tap({timeout:5000});
    await guestPage.waitForSelector('#practice.section.active',{state:'visible',timeout:5000});
    await guestPage.waitForSelector('#guestPracticeApply',{state:'visible',timeout:5000});
    await guestPage.locator('#guestPracticeApply').tap({timeout:5000});
    await guestPage.waitForFunction(()=>String(document.getElementById('practiceQuestion')?.textContent||'').trim().length>5,null,{timeout:5000});
    await guestPage.waitForSelector('#nextQuestion',{state:'visible',timeout:5000});
    const q1=await guestPage.locator('#practiceQuestion').textContent();
    await guestPage.locator('#nextQuestion').tap({timeout:5000});
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


  // Authenticated mobile app shell must never remain trapped behind startup/auth UI.
  // Exercise every role with a valid local Supabase workspace while the remote CDN/cloud
  // is unavailable: dashboard must open immediately, navigation must remain tappable,
  // drawer locks must clear, and normal page scrolling must recover after the drawer closes.
  console.log('App shell step START: authenticated role navigation / mobile interaction');
  for(const roleCase of [
    {role:'head',label:'Head of Institute',visible:'settings',hidden:null},
    {role:'teacher',label:'Teacher',visible:'attendance',hidden:'settings'},
    {role:'parent',label:'Parent',visible:'parentcomplaints',hidden:'students'},
    {role:'student',label:'Student',visible:'help',hidden:'attendance'}
  ]){
    const context=await browser.newContext({
      viewport:{width:390,height:844},
      isMobile:true,
      hasTouch:true,
      serviceWorkers:'block'
    });
    const page=await context.newPage();
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(10000);
    const shellErrors=[];
    page.on('pageerror',error=>shellErrors.push(error.message||String(error)));
    try{
      await page.addInitScript(({role})=>{
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('edunizam_session',JSON.stringify({
          role,
          identity:role+'@example.test',
          source:'supabase',
          institutionId:'school-qa-1',
          schoolName:'QA School',
          loginAt:Date.now()
        }));
        localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify({
          enabled:true,
          institutionId:'school-qa-1'
        }));
        localStorage.setItem('edunizam_settings',JSON.stringify({
          schoolName:'QA School',
          schoolType:'School'
        }));
        localStorage.setItem('edunizam_students',JSON.stringify([
          {id:1,name:'QA Student',className:'5',sectionName:'A',studentId:'QA-1',authUserId:'student-user-1'}
        ]));
      },{role:roleCase.role});
      await page.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.hostname==='127.0.0.1')route.continue();
        else route.abort();
      });
      await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded',timeout:10000});
      await page.waitForSelector('#dashboard.view.active',{state:'visible',timeout:7000});
      await page.waitForSelector('#eduMobileMenuBtn',{state:'visible',timeout:7000});
      await page.waitForSelector('#roleSession',{state:'visible',timeout:7000});
      await page.waitForFunction(()=>!document.getElementById('cloudAuthScreen'),null,{timeout:4000});

      const startup=await page.evaluate(({visible,hidden,label})=>{
        const visibleBtn=document.querySelector('.nav-item[data-view="'+visible+'"]');
        const hiddenBtn=hidden?document.querySelector('.nav-item[data-view="'+hidden+'"]'):null;
        const roleText=(document.getElementById('roleSession')?.textContent||'').trim();
        return {
          authState:document.documentElement.dataset.authState||'',
          loader:document.documentElement.classList.contains('edu-feature-loading'),
          authScreen:!!document.getElementById('cloudAuthScreen'),
          dashboard:document.getElementById('dashboard')?.classList.contains('active')||false,
          roleText,
          roleLabelPresent:roleText.includes(label),
          visibleAllowed:!!visibleBtn&&!visibleBtn.classList.contains('role-hidden')&&!visibleBtn.hidden,
          hiddenBlocked:hidden?(!hiddenBtn||hiddenBtn.classList.contains('role-hidden')||hiddenBtn.hidden):true,
          bodyOverflow:getComputedStyle(document.body).overflowY
        };
      },roleCase);
      if(startup.authScreen||!startup.dashboard||startup.loader||!startup.roleLabelPresent||!startup.visibleAllowed||!startup.hiddenBlocked){
        pushFailure('app shell '+roleCase.role,'Authenticated role did not reach a usable dashboard immediately',JSON.stringify(startup));
      }

      await page.locator('#eduMobileMenuBtn').tap({timeout:5000});
      await page.waitForFunction(()=>document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'));
      const opened=await page.evaluate(()=>({
        open:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false,
        locked:document.body.classList.contains('mobile-nav-lock'),
        backdrop:document.getElementById('eduMobileNavBackdrop')?.classList.contains('show')||false,
        expanded:document.getElementById('eduMobileMenuBtn')?.getAttribute('aria-expanded')||''
      }));
      if(!opened.open||!opened.locked||!opened.backdrop||opened.expanded!=='true'){
        pushFailure('app shell '+roleCase.role,'Mobile navigation did not open into a consistent locked state',JSON.stringify(opened));
      }

      const helpButton=page.locator('.sidebar .nav-item[data-view="help"]');
      await page.evaluate(()=>{
        const help=document.querySelector('.sidebar .nav-item[data-view="help"]');
        const group=help?.closest('details.nav-group');
        if(group)group.open=true;
      });
      await helpButton.waitFor({state:'visible',timeout:5000});
      await helpButton.scrollIntoViewIfNeeded();
      await helpButton.tap({timeout:5000});
      await page.waitForSelector('#help.view.active',{state:'visible',timeout:7000});
      await page.waitForFunction(()=>!document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),null,{timeout:5000});

      // setView() intentionally reveals the destination before lazy feature code
      // starts on the next paint. Waiting only for the loading class to be absent
      // races with that paint. Wait for the loader's own readiness contract instead,
      // then also require the global loading marker to be cleared.
      await page.waitForFunction(()=>(
        window.EDUNIZAM_FEATURE_LOADER?.isReady?.('help')===true &&
        !document.documentElement.classList.contains('edu-feature-loading')
      ),null,{timeout:9000});

      const afterNav=await page.evaluate(()=>({
        active:document.querySelector('.view.active')?.id||'',
        locked:document.body.classList.contains('mobile-nav-lock'),
        backdrop:document.getElementById('eduMobileNavBackdrop')?.classList.contains('show')||false,
        expanded:document.getElementById('eduMobileMenuBtn')?.getAttribute('aria-expanded')||'',
        loading:document.documentElement.classList.contains('edu-feature-loading'),
        title:(document.getElementById('page-title')?.textContent||'').trim()
      }));
      if(afterNav.active!=='help'||afterNav.locked||afterNav.backdrop||afterNav.expanded!=='false'||afterNav.loading){
        pushFailure('app shell '+roleCase.role,'Navigation click left the app frozen or drawer-locked',JSON.stringify(afterNav));
      }

      // Re-open then close through the backdrop to prove no invisible overlay remains.
      await page.locator('#eduMobileMenuBtn').tap({timeout:5000});
      await page.waitForFunction(()=>document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'));
      await page.locator('#eduMobileNavBackdrop').tap({position:{x:380,y:820},timeout:5000}).catch(async()=>{
        await page.evaluate(()=>document.getElementById('eduMobileNavBackdrop')?.click());
      });
      await page.waitForFunction(()=>!document.body.classList.contains('mobile-nav-lock'),null,{timeout:5000});

      await page.evaluate(()=>window.EDUNIZAM_APP_NAV?.setView?.('dashboard'));
      await page.waitForSelector('#dashboard.view.active',{state:'visible',timeout:5000});
      await page.evaluate(()=>window.scrollTo(0,Math.min(1200,Math.max(0,document.documentElement.scrollHeight-innerHeight))));
      await page.waitForTimeout(120);
      const scrollState=await page.evaluate(()=>({
        y:window.scrollY,
        max:Math.max(0,document.documentElement.scrollHeight-innerHeight),
        locked:document.body.classList.contains('mobile-nav-lock'),
        bodyOverflow:getComputedStyle(document.body).overflowY,
        pointer:document.elementFromPoint(innerWidth/2,Math.min(innerHeight-80,520))?.tagName||''
      }));
      if(scrollState.max>120&&scrollState.y<80){
        pushFailure('app shell '+roleCase.role,'Mobile app page could not scroll after closing navigation',JSON.stringify(scrollState));
      }
      if(scrollState.locked||scrollState.bodyOverflow==='hidden'){
        pushFailure('app shell '+roleCase.role,'Mobile navigation left page scrolling locked',JSON.stringify(scrollState));
      }

      const critical=shellErrors.filter(x=>!/supabase|Failed to fetch|ERR_FAILED|cdn\.jsdelivr|MathJax/i.test(x));
      if(critical.length)pushFailure('app shell '+roleCase.role,'Authenticated shell produced browser errors',critical.slice(0,6).join(' | '));
    }catch(error){
      // Capture the actual hit-testing and expansion state when a mobile tap
      // loses its target, instead of hiding a race behind a forced click.
      const tapDiagnosis=await page.evaluate(()=>{
        const help=document.querySelector('.sidebar .nav-item[data-view="help"]');
        const group=help?.closest('details.nav-group');
        const rect=help?.getBoundingClientRect();
        const x=rect?Math.max(1,Math.min(innerWidth-2,rect.left+rect.width/2)):0;
        const y=rect?Math.max(1,Math.min(innerHeight-2,rect.top+rect.height/2)):0;
        const hit=document.elementFromPoint(x,y);
        const nav=document.querySelector('.sidebar #nav');
        return {groupOpen:group?.open,groupHidden:group?.hidden,
          groupName:group?.dataset?.groupTitle,helpHidden:help?.hidden,
          helpDisplay:help?getComputedStyle(help).display:'missing',
          helpRect:rect?{top:Math.round(rect.top),bottom:Math.round(rect.bottom),left:Math.round(rect.left)}:null,
          navTop:nav?.scrollTop,navHeight:nav?.clientHeight,
          hitTag:hit?.tagName,hitText:(hit?.textContent||'').slice(0,50),
          hitGroup:hit?.closest?.('details')?.dataset?.groupTitle,
          drawerOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')};
      }).catch(e=>({unavailable:String(e)}));
      console.log('Mobile nav tap diagnosis '+roleCase.role+': '+JSON.stringify(tapDiagnosis));
      pushFailure('app shell '+roleCase.role,'Authenticated mobile app-shell regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }
  console.log('App shell step PASS: authenticated role navigation / mobile interaction');

  // Daily Diary must use the user's local calendar date rather than UTC.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Karachi',serviceWorkers:'block'});
    const page=await context.newPage();
    try{
      await page.route('**/diary-date-harness',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><div id="dailyDiaryApp"></div></body></html>'}));
      await page.goto('http://127.0.0.1:'+port+'/diary-date-harness',{waitUntil:'domcontentloaded',timeout:8000});
      await page.evaluate(()=>{
        localStorage.clear();
        window.EDUNIZAM_CLOUD_CONFIG={enabled:false,institutionId:''};
        window.EDUNIZAM_CLOUD={state:{client:null,user:null}};
      });
      await page.addScriptTag({url:'http://127.0.0.1:'+port+'/daily-class-diary.js'});
      const localDate=await page.evaluate(()=>window.EDUNIZAM_DAILY_DIARY?.dateStr?.(new Date('2026-10-05T20:30:00Z'))||'');
      if(localDate!=='2026-10-06')pushFailure('daily diary','Diary date is derived from UTC instead of the browser local calendar date',JSON.stringify({localDate}));
    }catch(error){
      pushFailure('daily diary','Local-calendar date regression failed',error?.message||String(error));
    }finally{
      await context.close();
    }
  }

  // In Local Mode a teacher may manage only notices created by that teacher.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage();
    try{
      await page.route('**/notice-owner-harness',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><div id="noticeBoardApp"></div></body></html>'}));
      await page.goto('http://127.0.0.1:'+port+'/notice-owner-harness',{waitUntil:'domcontentloaded',timeout:8000});
      await page.evaluate(()=>{
        localStorage.clear();
        localStorage.setItem('edunizam_session',JSON.stringify({role:'teacher',identity:'teacher1@example.test'}));
        localStorage.setItem('edunizam_notice_board_v1',JSON.stringify([
          {id:'own',title:'Own Notice',body:'Teacher one notice',audience:'all',className:'',sectionName:'',priority:'Normal',pinned:false,validUntil:'',createdBy:'',creatorKey:'teacher:teacher1@example.test',createdAt:'2026-10-06T07:00:00Z',updatedAt:'2026-10-06T07:00:00Z'},
          {id:'other',title:'Other Notice',body:'Teacher two notice',audience:'all',className:'',sectionName:'',priority:'Normal',pinned:false,validUntil:'',createdBy:'',creatorKey:'teacher:teacher2@example.test',createdAt:'2026-10-06T06:00:00Z',updatedAt:'2026-10-06T06:00:00Z'}
        ]));
        window.EDUNIZAM_CLOUD_CONFIG={enabled:false,institutionId:''};
        window.EDUNIZAM_CLOUD={state:{client:null,user:null}};
      });
      await page.addScriptTag({url:'http://127.0.0.1:'+port+'/notice-board-center.js'});
      await page.waitForSelector('#nbSave',{state:'visible',timeout:5000});
      const ownership=await page.evaluate(()=>{
        const cards=[...document.querySelectorAll('#noticeBoardApp .paper-card')];
        const state={};
        for(const card of cards){
          const title=card.querySelector('h3')?.textContent?.trim()||'';
          state[title]={
            edit:!!card.querySelector('[data-nb-edit]'),
            remove:!!card.querySelector('[data-nb-delete]')
          };
        }
        return state;
      });
      if(!ownership['Own Notice']?.edit||!ownership['Own Notice']?.remove||ownership['Other Notice']?.edit||ownership['Other Notice']?.remove){
        pushFailure('notice board','Local teacher notice ownership controls are not isolated',JSON.stringify(ownership));
      }
      await page.locator('#nbTitle').fill('New Teacher Notice');
      await page.locator('#nbBody').fill('Owned by teacher one');
      await page.locator('#nbAudience').selectOption('all');
      await page.locator('#nbSave').click({timeout:5000});
      const savedOwner=await page.evaluate(()=>{
        const rows=JSON.parse(localStorage.getItem('edunizam_notice_board_v1')||'[]');
        return rows.find(x=>x.title==='New Teacher Notice')?.creatorKey||'';
      });
      if(savedOwner!=='teacher:teacher1@example.test')pushFailure('notice board','New Local Mode notice did not persist teacher ownership',JSON.stringify({savedOwner}));
    }catch(error){
      pushFailure('notice board','Local teacher notice ownership regression failed',error?.message||String(error));
    }finally{
      await context.close();
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

  console.log('Auth/mobile runtime contract complete. Starting pilot onboarding contract.');
  const onboardingPage=await browser.newPage({
    javaScriptEnabled:true,
    viewport:{width:390,height:844},
    isMobile:true,
    hasTouch:true,
    serviceWorkers:'block'
  });
  onboardingPage.setDefaultTimeout(6000);
  onboardingPage.setDefaultNavigationTimeout(8000);
  const onboardingErrors=[];
  onboardingPage.on('pageerror',error=>onboardingErrors.push(String(error?.message||error)));
  try{
    await onboardingPage.addInitScript(()=>{
      const school={
        institution_id:'33333333-3333-4333-8333-333333333333',
        institution_name:'Pilot QA School',
        institution_type:'School',
        registration_number:'PILOT-QA-1',
        school_registration_code:'QA-PILOT',
        address:'QA Campus'
      };
      const readCalls=()=>{try{return JSON.parse(localStorage.getItem('qa_onboarding_calls')||'[]')}catch{return[]}};
      const record=(name,args={})=>{
        const calls=readCalls();calls.push({name,args});
        localStorage.setItem('qa_onboarding_calls',JSON.stringify(calls));
      };
      let currentUser=null;
      const query=()=>{
        const result={data:[],error:null};
        const q={
          select(){return q},eq(){return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},gt(){return q},lt(){return q},
          like(){return q},ilike(){return q},order(){return q},limit(){return q},insert(){return q},upsert(){return q},update(){return q},delete(){return q},abortSignal(){return q},
          maybeSingle(){return Promise.resolve({data:null,error:null})},
          single(){return Promise.resolve({data:null,error:null})},
          then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
        };
        return q;
      };
      const client={
        auth:{
          signUp:({email,options})=>{
            currentUser={id:'qa-'+String(email||'user').replace(/[^a-z0-9]/gi,'-'),email,user_metadata:options?.data||{},identities:[{id:'qa'}]};
            record('auth.signUp',{email,metadata:options?.data||{}});
            return Promise.resolve({data:{user:currentUser,session:{user:currentUser}},error:null});
          },
          signInWithPassword:({email})=>{
            currentUser={id:'qa-login-user',email,user_metadata:{}};
            record('auth.signInWithPassword',{email});
            return Promise.resolve({data:{user:currentUser,session:{user:currentUser}},error:null});
          },
          signOut:()=>{record('auth.signOut');currentUser=null;return Promise.resolve({error:null})},
          getSession:()=>Promise.resolve({data:{session:currentUser?{user:currentUser}:null},error:null}),
          getUser:()=>Promise.resolve({data:{user:currentUser},error:null}),
          resend:()=>Promise.resolve({error:null}),
          resetPasswordForEmail:()=>Promise.resolve({error:null}),
          verifyOtp:()=>Promise.resolve({data:{user:currentUser,session:currentUser?{user:currentUser}:null},error:null}),
          updateUser:()=>Promise.resolve({data:{user:currentUser},error:null}),
          onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
        },
        rpc:(name,args={})=>{
          record(name,args);
          if(name==='list_school_directory_v1'||name==='search_school_directory_v1')return Promise.resolve({data:[school],error:null});
          if(name==='register_admin_school_v2')return Promise.resolve({data:{institution_id:school.institution_id},error:null});
          if(name==='my_authorized_workspaces')return Promise.resolve({data:[{...school,workspace_role:'head_of_institute'}],error:null});
          if(name==='submit_teacher_school_request_v1')return Promise.resolve({data:{id:'teacher-request',status:'pending'},error:null});
          if(name==='submit_school_access_request_v1')return Promise.resolve({data:{id:'member-request',status:'pending'},error:null});
          return Promise.resolve({data:null,error:null});
        },
        from:()=>query()
      };
      window.supabase={createClient:()=>client};
    });
    await onboardingPage.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='127.0.0.1')return route.continue();
      if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('@supabase'))return route.fulfill({status:200,contentType:'text/javascript',body:'/* onboarding Supabase stub */'});
      return route.abort();
    });

    const reset=async()=>{
      await onboardingPage.goto('http://127.0.0.1:'+port+'/login.html',{waitUntil:'domcontentloaded',timeout:8000});
      await onboardingPage.evaluate(()=>{
        localStorage.removeItem('qa_onboarding_calls');
        localStorage.removeItem('edunizam_pending_signup');
        localStorage.removeItem('edunizam_verify_email');
        localStorage.removeItem('edunizam_session');
        sessionStorage.clear();
      });
      await onboardingPage.reload({waitUntil:'domcontentloaded',timeout:8000});
    };
    const calls=()=>onboardingPage.evaluate(()=>JSON.parse(localStorage.getItem('qa_onboarding_calls')||'[]'));
    const commonSignup=async({role,email,name='QA User',phone='03001234567',className='',childName=''})=>{
      await onboardingPage.locator('[data-role="'+role+'"]').tap({timeout:5000});
      await onboardingPage.locator('#signupTab').tap({timeout:5000});
      if(role!=='admin'){
        await onboardingPage.waitForFunction(()=>document.querySelectorAll('#memberSchoolDropdown option').length>1,null,{timeout:5000});
        await onboardingPage.locator('#memberSchoolDropdown').selectOption('33333333-3333-4333-8333-333333333333');
      }
      if(role==='admin')await onboardingPage.locator('#schoolName').fill('Pilot QA School');
      await onboardingPage.locator('#fullName').fill(name);
      await onboardingPage.locator('#contactNumber').fill(phone);
      await onboardingPage.locator('#signupEmail').fill(email);
      await onboardingPage.locator('#signupPassword').fill('SecurePass123!');
      if(className)await onboardingPage.locator('#approvalClassName').fill(className);
      if(childName)await onboardingPage.locator('#approvalStudentName').fill(childName);
      await onboardingPage.locator('#signupBtn').tap({timeout:5000,noWaitAfter:true});
    };

    await reset();
    await commonSignup({role:'admin',email:'pilot-admin@example.test',name:'Pilot Admin'});
    await onboardingPage.waitForURL(/\/app\.html\?secureLogin=1$/,{timeout:6000});
    const adminCalls=await calls();
    const adminRegister=adminCalls.find(x=>x.name==='register_admin_school_v2');
    const adminWorkspace=adminCalls.find(x=>x.name==='my_authorized_workspaces');
    const adminSession=await onboardingPage.evaluate(()=>JSON.parse(localStorage.getItem('edunizam_session')||'null'));
    if(!adminRegister||!adminWorkspace||adminSession?.role!=='head'||adminSession?.institutionId!=='33333333-3333-4333-8333-333333333333'){
      pushFailure('pilot onboarding admin','Admin signup did not create and enter the owned school workspace',JSON.stringify({adminCalls,adminSession}));
    }

    await reset();
    await commonSignup({role:'teacher',email:'pilot-teacher@example.test',name:'Pilot Teacher'});
    await onboardingPage.waitForFunction(()=>/Teacher request sent/.test(document.getElementById('statusBox')?.textContent||''),null,{timeout:5000});
    const teacherCalls=await calls();
    const teacherRequest=teacherCalls.find(x=>x.name==='submit_teacher_school_request_v1');
    if(!teacherRequest||teacherRequest.args?.p_institution_id!=='33333333-3333-4333-8333-333333333333'||teacherRequest.args?.p_full_name!=='Pilot Teacher'){
      pushFailure('pilot onboarding teacher','Teacher signup did not submit the selected-school approval request',JSON.stringify(teacherCalls));
    }

    await reset();
    await commonSignup({role:'student',email:'pilot-student@example.test',name:'Pilot Student',className:'5'});
    await onboardingPage.waitForFunction(()=>/Waiting for School Admin Approval/.test(document.getElementById('statusBox')?.textContent||''),null,{timeout:5000});
    const studentCalls=await calls();
    const studentRequest=studentCalls.find(x=>x.name==='submit_school_access_request_v1');
    if(!studentRequest||studentRequest.args?.p_role!=='student'||studentRequest.args?.p_class_name!=='5'||studentRequest.args?.p_institution_id!=='33333333-3333-4333-8333-333333333333'){
      pushFailure('pilot onboarding student','Student signup did not submit the required school/profile approval data',JSON.stringify(studentCalls));
    }

    await reset();
    await commonSignup({role:'parent',email:'pilot-parent@example.test',name:'Pilot Parent',className:'5',childName:'Pilot Child'});
    await onboardingPage.waitForFunction(()=>/Waiting for School Admin Approval/.test(document.getElementById('statusBox')?.textContent||''),null,{timeout:5000});
    const parentCalls=await calls();
    const parentRequest=parentCalls.find(x=>x.name==='submit_school_access_request_v1');
    if(!parentRequest||parentRequest.args?.p_role!=='parent'||parentRequest.args?.p_student_name!=='Pilot Child'||parentRequest.args?.p_class_name!=='5'||parentRequest.args?.p_institution_id!=='33333333-3333-4333-8333-333333333333'){
      pushFailure('pilot onboarding parent','Parent signup did not submit the selected child/school approval data',JSON.stringify(parentCalls));
    }

    if(onboardingErrors.length)pushFailure('pilot onboarding','Runtime JavaScript errors occurred during onboarding flows',onboardingErrors.slice(0,8).join(' | '));
    console.log('Pilot onboarding contract PASS: Admin + Teacher + Student + Parent signup paths.');
  }catch(e){
    pushFailure('pilot onboarding','Pilot onboarding browser regression failed',e.message||String(e));
  }finally{
    await onboardingPage.close();
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
  const inspectActiveTemporalControls=async(scope)=>{
    const issues=await boundedEvaluate('inspect mobile date/time controls '+scope,()=>{
      const active=document.querySelector('.view.active');
      if(!active)return [];
      const viewport=document.documentElement.clientWidth;
      const visible=el=>{
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
        const r=el.getBoundingClientRect();
        return r.width>1&&r.height>1;
      };
      return [...active.querySelectorAll('input[type="date"],input[type="time"],input[type="datetime-local"]')]
        .filter(visible)
        .map(el=>{
          const r=el.getBoundingClientRect();
          return {
            id:el.id||'',
            type:el.type,
            left:Math.round(r.left),
            right:Math.round(r.right),
            width:Math.round(r.width),
            height:Math.round(r.height),
            viewport
          };
        })
        .filter(x=>x.left<-2||x.right>x.viewport+2||x.width>x.viewport+2||x.height<42);
    },5000);
    if(issues.length)pushFailure('mobile temporal controls',scope+' has clipped or undersized date/time controls',JSON.stringify(issues));
  };
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
        const d=new Date(),attendanceKey=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        const attendance=JSON.parse(localStorage.getItem('edunizam_attendance')||'{}');
        attendance[attendanceKey]=Object.assign({},attendance[attendanceKey]||{}, {'9001':'Leave'});
        localStorage.setItem('edunizam_attendance',JSON.stringify(attendance));
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

    const prefetchContract=await boundedEvaluate('inspect feature prefetch contract',async()=>{
      const loader=window.EDUNIZAM_FEATURE_LOADER;
      if(!loader?.prefetch)return {available:false,seen:[],ready:false,expected:''};
      const seen=[];
      const expected=loader.versionedUrl?.('math-editor.js')||'';
      const realFetch=window.fetch;
      window.fetch=(input,init)=>{
        seen.push({url:String(input),cache:init?.cache||'',credentials:init?.credentials||''});
        return Promise.resolve(new Response('/* prefetched */',{status:200,headers:{'content-type':'text/javascript'}}));
      };
      try{await loader.prefetch('assistant')}finally{window.fetch=realFetch}
      return {available:true,seen,ready:loader.isReady('assistant'),expected};
    },5000);
    if(!prefetchContract.available||
       !prefetchContract.expected||
       !prefetchContract.seen.some(x=>x.url===prefetchContract.expected&&x.cache==='force-cache')||
       prefetchContract.ready){
      pushFailure('navigation performance','Feature prefetch did not warm versioned code without executing it',JSON.stringify(prefetchContract));
    }

    const messagingScaleContract=await boundedEvaluate('inspect messaging scale contract',async()=>{
      const source=await fetch('/messaging-center.js').then(r=>r.text());
      return {
        scopedUnread:source.includes(".in('conversation_id',batch)")&&source.includes(".neq('sender_user_id',uid())"),
        batched:source.includes("start+=100"),
        dedupe:source.includes("conversationsInFlight")&&source.includes("Date.now()-conversationsLoadedAt<3000"),
        contactsCache:source.includes("Date.now()-contactsLoadedAt<60000")
      };
    },5000);
    if(!messagingScaleContract.scopedUnread||!messagingScaleContract.batched||!messagingScaleContract.dedupe||!messagingScaleContract.contactsCache){
      pushFailure('messaging performance','Inbox scale guards are missing',JSON.stringify(messagingScaleContract));
    }

    const schoolWorkScaleContract=await boundedEvaluate('inspect school work scale contract',async()=>{
      const source=await fetch('/school-work.js').then(r=>r.text());
      return {
        firstPaint:source.includes("paint(root,read(),tab)")&&source.includes("const scope=tab==='submissions'?'submissions':tab"),
        scopedLoads:source.includes("normalized==='announcements'")&&source.includes("normalized==='homework'")&&source.includes("normalized==='timetable'"),
        submissionPair:source.includes("current.submissions=mapSubmissions(s.data)")&&source.includes("cloudLoadedScopes.add('homework')"),
        dedupe:source.includes("cloudScopeInFlight.has(normalized)")
      };
    },5000);
    if(!schoolWorkScaleContract.firstPaint||!schoolWorkScaleContract.scopedLoads||!schoolWorkScaleContract.submissionPair||!schoolWorkScaleContract.dedupe){
      pushFailure('school work performance','School Work lazy data guards are missing',JSON.stringify(schoolWorkScaleContract));
    }

    const feeScaleContract=await boundedEvaluate('inspect fee scale contract',async()=>{
      const source=await fetch('/fee-center.js').then(r=>r.text());
      return {
        instantPaint:source.includes("paint(root,read())"),
        noBroadPaymentPull:!source.includes(".from('fee_payments')\n        .select('*')"),
        indexedHistory:source.includes(".eq('fee_record_id',id)")&&source.includes("loadPaymentHistory"),
        dedupe:source.includes("feeLoadInFlight")&&source.includes("paymentHistoryInFlight"),
        printHydrates:source.includes("item=await withPaymentHistory(item)")
      };
    },5000);
    if(!feeScaleContract.instantPaint||!feeScaleContract.noBroadPaymentPull||!feeScaleContract.indexedHistory||!feeScaleContract.dedupe||!feeScaleContract.printHydrates){
      pushFailure('fee performance','Fee Center scale guards are missing',JSON.stringify(feeScaleContract));
    }

    const staffTimeScaleContract=await boundedEvaluate('inspect staff time scale contract',async()=>{
      const source=await fetch('/staff-time-attendance.js').then(r=>r.text());
      return {
        noPolling:!source.includes("setInterval("),
        monthScoped:source.includes(".gte('attendance_date',bounds.start)")&&source.includes(".lt('attendance_date',bounds.next)"),
        onDemandMonth:source.includes("pullCloud(selected,false)")&&source.includes("root.dataset.staMonth=selected"),
        dedupe:source.includes("staffLoadInFlight.has(requestKey)")&&source.includes("Date.now()-loadedAt<15000"),
        lifecycle:source.includes("'edunizam:view-open'")&&source.includes("document.addEventListener('visibilitychange'")
      };
    },5000);
    if(!staffTimeScaleContract.noPolling||!staffTimeScaleContract.monthScoped||!staffTimeScaleContract.onDemandMonth||!staffTimeScaleContract.dedupe||!staffTimeScaleContract.lifecycle){
      pushFailure('staff time performance','Staff Time scale guards are missing',JSON.stringify(staffTimeScaleContract));
    }

    const intentPrefetch=await boundedEvaluate('inspect navigation intent prefetch',async()=>{
      const loader=window.EDUNIZAM_FEATURE_LOADER;
      const button=document.querySelector('.nav-item[data-view="examcenter"]');
      if(!loader?.prefetch||!button)return [];
      const calls=[];
      const real=loader.prefetch;
      loader.prefetch=view=>{calls.push(view);return Promise.resolve([])};
      try{
        button.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'touch'}));
        await new Promise(resolve=>setTimeout(resolve,0));
      }finally{loader.prefetch=real}
      return calls;
    },5000);
    if(!intentPrefetch.includes('examcenter')){
      pushFailure('navigation performance','Pointer/touch intent did not prefetch the destination feature',JSON.stringify(intentPrefetch));
    }

    const dockLabels=await boundedEvaluate('inspect mobile dock labels',()=>[...document.querySelectorAll('#premiumMobileDock strong')].map(el=>{
      const cs=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      return {
        text:(el.textContent||'').trim(),
        whiteSpace:cs.whiteSpace,
        textOverflow:cs.textOverflow,
        overflow:cs.overflow,
        width:Math.round(r.width),
        scrollWidth:el.scrollWidth,
        height:Math.round(r.height),
        scrollHeight:el.scrollHeight
      };
    }));
    const clippedDockLabels=dockLabels.filter(x=>x.text&&(
      x.textOverflow==='ellipsis'||
      x.whiteSpace==='nowrap'||
      x.scrollWidth>x.width+2||
      x.scrollHeight>x.height+2
    ));
    if(clippedDockLabels.length)pushFailure('mobile dock','Quick navigation labels are clipped or ellipsized',JSON.stringify(clippedDockLabels));

    const adminDeskVisual=await boundedEvaluate('inspect admin desk visual contract',()=>({
      cards:[...document.querySelectorAll('#adminDailyDesk .admin-daily-actions > button')].map(el=>{
        const cs=getComputedStyle(el);
        const colors=(cs.backgroundImage.match(/rgba?\(([^)]+)\)/g)||[]).map(raw=>{
          const nums=raw.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
          if(nums.length<3)return null;
          const [r,g,b]=nums;
          const lum=(0.2126*r+0.7152*g+0.0722*b)/255;
          return {r,g,b,lum:Number(lum.toFixed(3))};
        }).filter(Boolean);
        return {
          text:(el.querySelector('strong')?.textContent||'').trim(),
          backgroundColor:cs.backgroundColor,
          backgroundImage:cs.backgroundImage,
          textColor:getComputedStyle(el.querySelector('strong')||el).color,
          darkestGradient:colors.length?Math.min(...colors.map(x=>x.lum)):1
        };
      }),
      dock:(()=>{
        const d=document.getElementById('premiumMobileDock');
        const b=document.getElementById('eduBackTop');
        if(!d||!b)return {missing:true,intersects:false};
        const dr=d.getBoundingClientRect(),br=b.getBoundingClientRect();
        return {
          missing:false,
          intersects:br.left<dr.right&&br.right>dr.left&&br.top<dr.bottom&&br.bottom>dr.top,
          dock:{top:Math.round(dr.top),bottom:Math.round(dr.bottom)},
          backTop:{top:Math.round(br.top),bottom:Math.round(br.bottom)}
        };
      })()
    }),5000);
    const darkAdminCards=adminDeskVisual.cards.filter(x=>x.darkestGradient<0.68);
    if(darkAdminCards.length)pushFailure('admin desk visual','Admin action cards regressed to dark/saturated slabs',JSON.stringify(darkAdminCards));
    if(adminDeskVisual.dock?.intersects)pushFailure('mobile dock','Back-to-top control overlaps the mobile dock',JSON.stringify(adminDeskVisual.dock));

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

    // Rapid-navigation stress contract: simulate a user tapping different
    // unloaded sections quickly while feature-code requests have mobile-like latency.
    const stressAssets=[
      'transport-center.js',
      'inventory-center.js',
      'library-center.js',
      'gate-pass-center.js',
      'lesson-plan-center.js',
      'calendar-center.js'
    ];
    const stressViews=['transportcenter','inventorycenter','librarycenter','gatecenter','lessoncenter','calendarcenter'];
    const stressAssetHits=Object.fromEntries(stressAssets.map(x=>[x,0]));
    const stressRoutes=[];
    for(const asset of stressAssets){
      const pattern='**/'+asset+'*';
      const handler=async route=>{
        stressAssetHits[asset]=(stressAssetHits[asset]||0)+1;
        await new Promise(resolve=>setTimeout(resolve,350));
        await route.continue();
      };
      stressRoutes.push({pattern,handler});
      await loginFlowPage.route(pattern,handler);
    }
    try{
      const clickPlan=Array.from({length:30},(_,i)=>stressViews[i%stressViews.length]);
      const rapidStart=Date.now();
      await loginFlowPage.evaluate(async views=>{
        for(const view of views){
          document.querySelector('.nav-item[data-view="'+view+'"]')?.click();
          await new Promise(resolve=>setTimeout(resolve,18));
        }
      },clickPlan);
      const finalView='transportcenter';
      const activationStart=Date.now();
      await loginFlowPage.evaluate(view=>document.querySelector('.nav-item[data-view="'+view+'"]')?.click(),finalView);
      await loginFlowPage.waitForFunction(view=>document.querySelector('.view.active')?.id===view,finalView,{timeout:1000});
      const activationMs=Date.now()-activationStart;
      await loginFlowPage.waitForFunction(views=>{
        const loader=window.EDUNIZAM_FEATURE_LOADER;
        return !!loader&&views.every(view=>loader.isReady(view));
      },stressViews,{timeout:10000});
      await loginFlowPage.waitForTimeout(80);
      const stressState=await boundedEvaluate('inspect rapid navigation stress',()=>({
        active:document.querySelector('.view.active')?.id||'',
        guardPresent:!!document.getElementById('cloudAuthScreen'),
        locked:document.body.classList.contains('mobile-nav-lock'),
        menuOpen:document.querySelector('.sidebar')?.classList.contains('mobile-nav-open')||false,
        featureError:!!document.querySelector('.feature-loading-notice.error'),
        loadingNotices:document.querySelectorAll('.feature-loading-notice').length,
        bodyOverflow:getComputedStyle(document.body).overflowY
      }),5000);
      const duplicateAssets=Object.entries(stressAssetHits).filter(([,count])=>count>1);
      console.log('Rapid navigation stress:',JSON.stringify({
        taps:clickPlan.length+1,
        activationMs,
        totalMs:Date.now()-rapidStart,
        assetHits:stressAssetHits,
        state:stressState
      }));
      if(activationMs>500){
        pushFailure('rapid navigation stress','Final destination did not become visible quickly under slow feature loading',JSON.stringify({activationMs,stressState}));
      }
      if(duplicateAssets.length){
        pushFailure('rapid navigation stress','Rapid taps triggered duplicate lazy asset requests',JSON.stringify(duplicateAssets));
      }
      if(stressState.active!==finalView||stressState.guardPresent||stressState.locked||stressState.menuOpen||stressState.featureError||stressState.loadingNotices){
        pushFailure('rapid navigation stress','App did not settle cleanly after rapid section switching',JSON.stringify(stressState));
      }
    }finally{
      for(const {pattern,handler} of stressRoutes)await loginFlowPage.unroute(pattern,handler);
      await boundedEvaluate('return to dashboard after rapid stress',()=>window.EDUNIZAM_APP_NAV?.setView?.('dashboard'));
    }

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
      const colorfulForm=await boundedEvaluate('inspect colorful student form contract',()=>[...document.querySelectorAll('#studentFormWrap > input, #studentFormWrap > select, #studentFormWrap > textarea')].slice(0,18).map(el=>{
        const cs=getComputedStyle(el);
        return {
          id:el.id,
          backgroundImage:cs.backgroundImage,
          backgroundColor:cs.backgroundColor,
          color:cs.color,
          borderColor:cs.borderColor
        };
      }),5000);
      const colorfulBackgrounds=[...new Set(colorfulForm.map(x=>x.backgroundImage).filter(x=>x&&x!=='none'))];
      if(colorfulForm.length<10||colorfulBackgrounds.length<4){
        pushFailure('colorful form visual','Student form does not render enough distinct pastel input treatments',JSON.stringify({count:colorfulForm.length,backgrounds:colorfulBackgrounds,fields:colorfulForm.slice(0,10)}));
      }
      if(colorfulForm.some(x=>/rgba?\(0, 0, 0/.test(x.color))){
        pushFailure('colorful form visual','Student form text color regressed to unsafe black/transparent rendering',JSON.stringify(colorfulForm.slice(0,10)));
      }
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
      await inspectActiveTemporalControls('workflow '+view);
      if(view==='paperbuilder'){
        await loginStep('Class 5 Science paper dropdowns and 50-mark preview',async()=>{
          await loginFlowPage.waitForSelector('#pbClass',{state:'visible',timeout:7000});
          const initialType=await loginFlowPage.locator('#pbClass').evaluate(el=>el.tagName);
          if(initialType!=='SELECT')pushFailure('paper builder wizard','Class is not a dropdown');
          await loginFlowPage.locator('#pbClass').selectOption('5');
          await loginFlowPage.locator('#pbSubject').selectOption('General Science');
          const chapters=await loginFlowPage.locator('#pbChapterPicker option').count();
          if(chapters<2)pushFailure('paper builder wizard','Grade 5 General Science chapter dropdown is empty');
          await loginFlowPage.locator('#pbChapterPicker').selectOption({index:1});
          const first=await loginFlowPage.locator('#pbChapters').inputValue();
          if(!first)pushFailure('paper builder wizard','Chapter selection did not update chosen chapters');
          await loginFlowPage.locator('#pbMarks').fill('50');
          await loginFlowPage.locator('#pbDistribution').selectOption('Balanced');
          await loginFlowPage.locator('#pbAutoChapters').click();
          await loginFlowPage.locator('#pbGenerate').click();
          const preview=await loginFlowPage.locator('#paperPreview').innerText();
          const status=await loginFlowPage.locator('#pbGenerationStatus').innerText();
          if(!preview.includes('CONCEPT PRACTICE DRAFT')||!status.includes('Preview generated'))
            pushFailure('paper builder wizard','Grade 5 Science paper did not preview; '+status);
          const pattern=await loginFlowPage.locator('#pbPatternBreakdown').innerText();
          if(!pattern.includes('50 total marks')||!pattern.includes('MCQs'))
            pushFailure('paper builder wizard','Marks / pattern split not shown to teacher');
        });
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
      await inspectActiveTemporalControls('campus '+view);
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
      await inspectActiveTemporalControls('academic '+view);
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
  // Screenshot regression: public Matric > Annual > Past Papers must render
  // actual indexed papers, not a false 0 produced by text-of-card filtering.
  const guestPaperPage=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  try{
    await guestPaperPage.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='127.0.0.1')route.continue();else route.abort();
    });
    await guestPaperPage.goto('http://127.0.0.1:'+port+'/learn.html#past',{waitUntil:'domcontentloaded',timeout:20000});
    await guestPaperPage.waitForFunction(()=>!!window.EDUNIZAM_GUEST_PAPER_QUERY&&document.getElementById('paperSession')?.options.length>1,null,{timeout:12000});
    await guestPaperPage.locator('#paperLevel').selectOption('matric');
    await guestPaperPage.locator('#paperSession').selectOption('Annual');
    await guestPaperPage.locator('#paperType').selectOption('past');
    await guestPaperPage.locator('#searchPapers').click({timeout:6000});
    await guestPaperPage.waitForFunction(()=>document.getElementById('paperSummary')?.textContent?.includes('indexed paper result'),null,{timeout:9000});
    await guestPaperPage.waitForTimeout(350);
    const found=await guestPaperPage.evaluate(()=>{
      const summary=document.getElementById('paperSummary')?.textContent||'';
      const grid=document.getElementById('pastGrid');
      const catalog=window.EDUNIZAM_PAST_PAPERS||{};
      const expected=window.EDUNIZAM_GUEST_PAPER_QUERY?.select({
        papers:catalog.papers||[],boards:catalog.boards||[],
        filters:{level:'matric',session:'Annual',type:'past'}
      }).length||0;
      return{summary,results:grid?.querySelectorAll('.card').length||0,expected,
        falseZero:/^0\\s+(?:result|indexed paper result)/i.test(summary),
        wrongEmpty:!!grid?.textContent.includes('Exact resource not available yet.')};
    });
    console.log('Matric Annual Past Papers mobile screenshot regression:',JSON.stringify(found));
    if(found.expected<20||found.results!==found.expected||found.falseZero||found.wrongEmpty||!found.summary.includes('Annual'))
      pushFailure('guest past papers','Matric Annual Past Papers still reports false zero on mobile',JSON.stringify(found));
  }catch(error){
    pushFailure('guest past papers','Mobile Annual Paper search interaction failed',error?.message||String(error));
  }finally{
    await guestPaperPage.close();
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
