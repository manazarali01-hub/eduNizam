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
  {name:'home',path:'/',scrolls:[0,760,1500,2300]},
  {name:'login',path:'/login.html',scrolls:[0]},
  {name:'learn',path:'/learn.html',scrolls:[0,760,1500]},
  {name:'admission',path:'/admission.html',scrolls:[0,760]},
  {name:'app',path:'/app.html',scrolls:[0,760]}
];
const viewports=[
  {name:'mobile',width:390,height:844},
  {name:'desktop',width:1366,height:900}
];
const manifest=[];

for(const vp of viewports){
  for(const route of routes){
    const page=await browser.newPage({
      javaScriptEnabled:false,
      viewport:{width:vp.width,height:vp.height},
      serviceWorkers:'block'
    });
    page.setDefaultTimeout(5000);
    await page.route('**/*',async r=>{
      const req=r.request();
      const u=new URL(req.url());
      if(req.resourceType()==='script'||req.resourceType()==='media'||req.resourceType()==='font'||/doubleclick|googlesyndication|google-analytics|googletagmanager|pagead2/.test(u.hostname))return r.abort();
      return r.continue();
    });
    const url=base+route.path;
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e)));
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
      await page.waitForTimeout(600);
      await page.addStyleTag({content:`
        [class*="adsbygoogle"],ins.adsbygoogle{display:none!important}
        html{scroll-behavior:auto!important}
        *,*:before,*:after{animation:none!important;transition:none!important}
      `});
      const metrics=await page.evaluate(()=>({
        title:document.title,
        viewport:document.documentElement.clientWidth,
        scrollWidth:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0),
        scrollHeight:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0),
        bodyClass:document.body?.className||''
      }));
      const shots=[];
      for(const requestedY of route.scrolls){
        const y=await page.evaluate(y=>{window.scrollTo(0,Math.min(y,Math.max(0,document.documentElement.scrollHeight-innerHeight)));return Math.round(scrollY)},requestedY);
        await page.waitForTimeout(100);
        const file=`${route.name}-${vp.name}-y${y}.png`;
        await page.screenshot({path:path.join(outDir,file),fullPage:false,timeout:8000});
        shots.push({requestedY,y,file});
      }
      manifest.push({
        route:route.name,viewport:vp.name,url,status:response?.status()||0,
        metrics,errors:errors.slice(0,5),shots
      });
      console.log('Captured',route.name,vp.name,shots.length,'shots',metrics);
    }catch(error){
      manifest.push({route:route.name,viewport:vp.name,url,error:String(error.message||error),errors});
      console.error('Capture failed',route.name,vp.name,String(error.message||error));
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
