import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=path.resolve(root,'artifacts/live-visual-qa');
fs.mkdirSync(outDir,{recursive:true});
const port=4181;
const mime={
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'
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
  }catch(error){
    res.writeHead(500,{'content-type':'text/plain'});res.end(String(error.message||error));
  }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});

const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleUrl);
const launchOptions={headless:true};
if(process.env.EDUNIZAM_BROWSER)launchOptions.executablePath=process.env.EDUNIZAM_BROWSER;
const browser=await chromium.launch(launchOptions);
const base='http://127.0.0.1:'+port;
const routes=[
  {name:'home',path:'/',scrolls:[0]},
  {name:'login',path:'/login.html',scrolls:[0]},
  {name:'learn',path:'/learn.html',scrolls:[0]},
  {name:'admission',path:'/admission.html',scrolls:[0]},
  {name:'app',path:'/app.html',scrolls:[0]}
];
const viewports=[
  {name:'mobile',width:390,height:844},
  {name:'desktop',width:1366,height:900}
];
const manifest=[];
try{
  for(const vp of viewports){
    for(const route of routes){
      const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:vp.width,height:vp.height},serviceWorkers:'block'});
      page.setDefaultTimeout(5000);
      await page.route('**/*',async r=>{
        const req=r.request();
        const u=new URL(req.url());
        if(u.hostname==='127.0.0.1')return r.continue();
        return r.abort();
      });
      const url=base+route.path;
      const errors=[];
      page.on('pageerror',e=>errors.push(String(e.message||e)));
      try{
        const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:12000});
        await page.waitForTimeout(500);
        await page.addStyleTag({content:`
          :root{
            --en-photo-kids:url("/assets/edunizam-login-children.webp")!important;
            --en-photo-students:url("/assets/edunizam-girl-hero.webp")!important;
            --en-photo-study:url("/assets/edunizam-girl-hero.webp")!important;
            --en-photo-flatlay:url("/assets/edunizam-login-children.webp")!important;
            --en-photo-stationery:url("/assets/edunizam-girl-hero.webp")!important;
            --en-photo-classroom:url("/assets/edunizam-login-children.webp")!important;
          }
          [class*="adsbygoogle"],ins.adsbygoogle{display:none!important}
          html{scroll-behavior:auto!important}
          *,*:before,*:after{animation:none!important;transition:none!important}
        `});
        await page.evaluate(()=>{
          const hero=document.querySelector('.page-home .hero-image-wrap img');
          if(hero)hero.setAttribute('src','assets/edunizam-login-children.webp');
        });
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
          await page.waitForTimeout(80);
          const file=`${route.name}-${vp.name}-y${y}.png`;
          await page.screenshot({path:path.join(outDir,file),fullPage:false,timeout:6000});
          shots.push({requestedY,y,file});
        }
        manifest.push({route:route.name,viewport:vp.name,url,status:response?.status()||0,metrics,errors:errors.slice(0,5),shots});
        console.log('Captured',route.name,vp.name,shots.length,'shots');
      }catch(error){
        manifest.push({route:route.name,viewport:vp.name,url,error:String(error.message||error),errors});
        console.error('Capture failed',route.name,vp.name,String(error.message||error));
      }finally{
        await page.close();
      }
    }
  }
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2));
const failures=manifest.filter(x=>x.error||x.status>=400||x.metrics?.scrollWidth>x.metrics?.viewport+3);
if(failures.length){
  console.error(JSON.stringify(failures,null,2));
  process.exitCode=1;
}else{
  console.log('Visual QA capture complete:',manifest.length,'renders');
}
