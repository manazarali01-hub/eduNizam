import fs from 'node:fs';
import path from 'node:path';

const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleUrl);
const launchOptions={headless:true};
if(process.env.EDUNIZAM_BROWSER)launchOptions.executablePath=process.env.EDUNIZAM_BROWSER;

const outDir=path.resolve('artifacts/live-visual-qa');
fs.mkdirSync(outDir,{recursive:true});
const browser=await chromium.launch(launchOptions);
const base='https://edunizam.online';
const routes=[
  {name:'home',path:'/'},
  {name:'login',path:'/login.html'},
  {name:'learn',path:'/learn.html'},
  {name:'admission',path:'/admission.html'},
  {name:'app',path:'/app.html',js:false}
];
const viewports=[
  {name:'mobile',width:390,height:844},
  {name:'desktop',width:1366,height:900}
];
const selectors={
  home:['.premium-public-hero','.role-showcase','.value-section','.learning-band'],
  login:['.story','.card'],
  learn:['.hero-grid','.search-wrap','.tabs'],
  admission:['.shell>section.card:first-of-type','.card'],
  app:['.topbar','#dashboard']
};
const manifest=[];

for(const vp of viewports){
  for(const route of routes){
    const page=await browser.newPage({
      javaScriptEnabled:route.js!==false,
      viewport:{width:vp.width,height:vp.height},
      serviceWorkers:'block'
    });
    await page.route('**/*',async r=>{
      const u=new URL(r.request().url());
      if(/doubleclick|googlesyndication|google-analytics|googletagmanager|pagead2/.test(u.hostname))return r.abort();
      return r.continue();
    });
    const url=base+route.path;
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      await page.waitForTimeout(1800);
      await page.addStyleTag({content:`
        [class*="adsbygoogle"],ins.adsbygoogle{display:none!important}
        html{scroll-behavior:auto!important}
        *,*:before,*:after{animation-duration:.001ms!important;animation-delay:0s!important;transition-duration:.001ms!important}
      `});
      const metrics=await page.evaluate(()=>({
        title:document.title,
        viewport:document.documentElement.clientWidth,
        scrollWidth:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0),
        scrollHeight:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0),
        bodyClass:document.body?.className||''
      }));
      const full=`${route.name}-${vp.name}-full.png`;
      await page.screenshot({path:path.join(outDir,full),fullPage:true});
      const captured=[];
      for(let i=0;i<(selectors[route.name]||[]).length;i++){
        const sel=selectors[route.name][i];
        const loc=page.locator(sel).first();
        if(await loc.count()){
          try{
            if(await loc.isVisible()){
              const file=`${route.name}-${vp.name}-section-${i+1}.png`;
              await loc.screenshot({path:path.join(outDir,file)});
              captured.push({selector:sel,file});
            }
          }catch{}
        }
      }
      manifest.push({
        route:route.name,viewport:vp.name,url,status:response?.status()||0,
        metrics,errors:errors.slice(0,5),full,captured
      });
    }catch(error){
      manifest.push({route:route.name,viewport:vp.name,url,error:String(error.message||error),errors});
    }finally{
      await page.close();
    }
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2));
const failures=manifest.filter(x=>x.error||x.status>=400||x.metrics?.scrollWidth>x.metrics?.viewport+3);
if(failures.length){
  console.error(JSON.stringify(failures,null,2));
  process.exitCode=1;
}else{
  console.log('Live visual QA capture complete:',manifest.length,'renders');
}
