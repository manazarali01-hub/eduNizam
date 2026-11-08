import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
    res.writeHead(404);res.end('Not found');return;
  }
  const ext=path.extname(file);
  res.writeHead(200,{'content-type':ext==='.css'?'text/css':ext==='.js'?'text/javascript':'text/html','cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.EDUNIZAM_BROWSER?{executablePath:process.env.EDUNIZAM_BROWSER}:{})});
let failed=false;
try{
  for(const width of [360,390,412]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
    const page=await context.newPage();
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.hostname==='127.0.0.1')route.continue();else route.abort();
    });
    await page.goto('http://127.0.0.1:4174/app.html',{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter(x=>x.href.startsWith(location.origin)).every(x=>!!x.sheet),null,{timeout:15000});
    const m=await page.evaluate(()=>{
      const hero=document.querySelector('#dashboard > .campus-hero');
      const copy=hero?.firstElementChild;
      const title=document.querySelector('#dashboardWelcomeTitle');
      if(!hero||!copy||!title)return {missing:true};
      const rect=e=>{const r=e.getBoundingClientRect();return {width:Math.round(r.width),height:Math.round(r.height),left:Math.round(r.left),right:Math.round(r.right)}};
      const cs=getComputedStyle(title);
      const range=document.createRange();range.selectNodeContents(title);
      const lines=[...range.getClientRects()].map(r=>Math.round(r.width));
      return {missing:false,viewport:document.documentElement.clientWidth,hero:rect(hero),copy:rect(copy),title:rect(title),
        writingMode:cs.writingMode,wordBreak:cs.wordBreak,overflowWrap:cs.overflowWrap,lineCount:lines.length,lineWidths:lines};
    });
    console.log('MOBILE_DASHBOARD_LAYOUT',width,JSON.stringify(m));
    if(m.missing||m.hero.width<width-30||m.copy.width<180||m.title.width<180||m.writingMode!=='horizontal-tb'||m.lineCount>4||m.lineWidths.some(w=>w<12)){
      failed=true;console.error('Mobile dashboard hero regression at',width+'px');
      await page.screenshot({path:'/tmp/mobile-dashboard-'+width+'.png',fullPage:true}).catch(()=>{});
    }
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failed)process.exit(1);
console.log('Mobile dashboard hero layout passed at 360px, 390px and 412px.');
