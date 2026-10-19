import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const visualDir=path.resolve(root,'artifacts','visual-qa');
fs.mkdirSync(visualDir,{recursive:true});
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

function routeNameForScreenshot(route){
  return route==='/'?'home':route.replace(/^\//,'').replace(/\.html$/,'');
}

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
  const mobileBrandLayout=await premiumFormPage.evaluate(()=>{
    const brand=document.querySelector('.auth-page .mobile-brand');
    const logo=brand?.querySelector('img');
    const title=brand?.querySelector('strong');
    if(!brand||!logo||!title)return {missing:true};
    const b=brand.getBoundingClientRect(),l=logo.getBoundingClientRect(),t=title.getBoundingClientRect();
    const after=getComputedStyle(brand,'::after');
    const taglineBottom=(parseFloat(after.top)||0)+(parseFloat(after.lineHeight)||18);
    return {
      missing:false,
      brandHeight:b.height,
      logoTop:l.top-b.top,
      logoBottom:l.bottom-b.top,
      titleTop:t.top-b.top,
      titleBottom:t.bottom-b.top,
      taglineBottom,
      overflow:brand.scrollHeight>brand.clientHeight+2
    };
  });
  console.log('Mobile login brand layout:',JSON.stringify(mobileBrandLayout));
  if(mobileBrandLayout.missing)pushFailure('mobile login brand','Brand, logo or title is missing');
  else if(mobileBrandLayout.logoTop<mobileBrandLayout.taglineBottom+8||
          mobileBrandLayout.titleTop<mobileBrandLayout.taglineBottom+8||
          mobileBrandLayout.logoBottom>mobileBrandLayout.brandHeight+1||
          mobileBrandLayout.titleBottom>mobileBrandLayout.brandHeight+1||
          mobileBrandLayout.overflow)
    pushFailure('mobile login brand','Logo/title overlaps the tagline or escapes its framed header',JSON.stringify(mobileBrandLayout));
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
        console.log('Layout QA viewport:',route,width+'px');
        const scope=route+' @ '+width+'px';
        // A browser-side evaluation can occasionally stop responding even when
        // navigation has completed. Bound each route/viewport inspection, then
        // retire that page so one bad document cannot consume the whole CI job.
        let inspectionTimer;
        let inspection;
        try{
          inspection=await Promise.race([
            inspectPage(page,'http://127.0.0.1:'+port+route,width),
            new Promise((_,reject)=>{
              inspectionTimer=setTimeout(()=>reject(new Error('rendered inspection exceeded 18s budget')),18000);
            })
          ]);
        }catch(error){
          pushFailure(scope,'Rendered inspection timed out; remaining viewports for this route were skipped',error?.message||String(error));
          await page.close({runBeforeUnload:false}).catch(()=>{});
          break;
        }finally{
          clearTimeout(inspectionTimer);
        }
        const {result,errors}=inspection;
        // Visual snapshots are best-effort and isolated from the regression page.
        // A screenshot must never hold the functional/layout suite hostage.
        if(width===390||width===1366){
          let screenshotContext=null;
          const capture=async()=>{
            screenshotContext=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
            const screenshotPage=await screenshotContext.newPage();
            screenshotPage.setDefaultTimeout(4000);
            screenshotPage.setDefaultNavigationTimeout(6000);
            await screenshotPage.route('**/*',route=>{
              const requestUrl=new URL(route.request().url());
              if(requestUrl.hostname==='127.0.0.1')route.continue();
              else route.abort();
            });
            await screenshotPage.goto('http://127.0.0.1:'+port+route,{waitUntil:'domcontentloaded',timeout:6000});
            await screenshotPage.addStyleTag({content:`
              :root{
                --en-photo-kids:url("/assets/edunizam-login-children.webp")!important;
                --en-photo-students:url("/assets/edunizam-girl-hero.webp")!important;
                --en-photo-study:url("/assets/edunizam-girl-hero.webp")!important;
                --en-photo-flatlay:url("/assets/edunizam-login-children.webp")!important;
                --en-photo-stationery:url("/assets/edunizam-girl-hero.webp")!important;
                --en-photo-classroom:url("/assets/edunizam-login-children.webp")!important;
              }
              *,*:before,*:after{animation:none!important;transition:none!important}
            `});
            await screenshotPage.evaluate(()=>{
              const hero=document.querySelector('.page-home .hero-image-wrap img');
              if(hero)hero.setAttribute('src','assets/edunizam-login-children.webp');
              window.scrollTo(0,0);
            });
            await screenshotPage.screenshot({
              path:path.join(visualDir,routeNameForScreenshot(route)+'-'+width+'.png'),
              fullPage:false,
              timeout:4000,
              animations:'disabled'
            });
          };
          let timeoutId;
          try{
            await Promise.race([
              capture(),
              new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error('visual screenshot exceeded 9s budget')),9000);})
            ]);
          }catch(error){
            console.warn('Visual QA screenshot skipped (non-blocking):',route,width+'px',error?.message||String(error));
          }finally{
            clearTimeout(timeoutId);
            if(screenshotContext)await screenshotContext.close().catch(()=>{});
          }
        }
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
