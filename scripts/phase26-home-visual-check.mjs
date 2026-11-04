import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'artifacts','visual-qa');
fs.mkdirSync(out,{recursive:true});
const port=4174;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const rel=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
      res.writeHead(404);res.end('Not found');return;
    }
    res.writeHead(200,{'content-type':types[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});

let browser;
const failures=[];
const check=(condition,message,detail='')=>{if(!condition)failures.push({message,detail});};
try{
  const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
  const {chromium}=await import(moduleUrl);
  const options={headless:true};
  if(process.env.EDUNIZAM_BROWSER)options.executablePath=process.env.EDUNIZAM_BROWSER;
  browser=await chromium.launch(options);

  for(const width of [390,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(12000);
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1')route.continue();else route.abort();
    });
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!document.querySelector('.page-home .hero-visual .hero-image-wrap img')&&
      !!document.querySelector('.page-home .hero-visual .quick-access-card')&&
      !!document.querySelector('.page-home .hero-visual .hero-role-badge'),null,{timeout:10000});
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .filter(link=>link.href.startsWith(location.origin)).every(link=>!!link.sheet),null,{timeout:12000});
    await page.waitForTimeout(180);

    const metrics=await page.evaluate(()=>{
      const q=s=>document.querySelector('.page-home .public-hero.premium-public-hero '+s);
      const visual=q('.hero-visual'),image=q('.hero-image-wrap'),img=image?.querySelector('img');
      const quick=q('.quick-access-card'),roles=q('.hero-role-badge');
      const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const root=document.documentElement;
      return {
        phase26Link:[...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>x.href.includes('edunizam-phase26-home-responsive-consistency.css')),
        imageLoaded:!!img&&img.complete&&img.naturalWidth>0,
        visual:box(visual),image:box(image),quick:box(quick),roles:box(roles),
        visualDisplay:getComputedStyle(visual).display,
        visualColumns:getComputedStyle(visual).gridTemplateColumns.trim().split(/\s+/).length,
        imageAspect:image.getBoundingClientRect().width/image.getBoundingClientRect().height,
        quickPosition:getComputedStyle(quick).position,
        rolesPosition:getComputedStyle(roles).position,
        rolesDisplay:getComputedStyle(roles).display,
        rolesColumns:getComputedStyle(roles).gridTemplateColumns.trim().split(/\s+/).length,
        overflow:Math.max(root.scrollWidth,document.body.scrollWidth)-root.clientWidth
      };
    });
    check(metrics.phase26Link,'Phase 26 stylesheet is not linked at '+width+'px',JSON.stringify(metrics));
    check(metrics.imageLoaded,'Homepage hero image did not load at '+width+'px',JSON.stringify(metrics));
    check(metrics.overflow<=2,'Horizontal page overflow at '+width+'px',JSON.stringify(metrics));
    if(width<=720){
      check(metrics.visualColumns===1,'Mobile hero visual is not a single column',JSON.stringify(metrics));
      check(Math.abs(metrics.imageAspect-4/3)<0.04,'Mobile hero image is not 4:3',JSON.stringify(metrics));
      check(metrics.quickPosition==='relative','Mobile Quick Access is not in normal document flow',JSON.stringify(metrics));
      check(Math.abs(metrics.quick.width-metrics.visual.width)<=2,'Mobile Quick Access is not full width',JSON.stringify(metrics));
      check(metrics.rolesDisplay==='grid'&&metrics.rolesColumns===2,'Mobile role badges are not a 2-column grid',JSON.stringify(metrics));
    }else if(width<=1000){
      check(metrics.visualColumns===2,'Tablet hero visual is not a two-column grid',JSON.stringify(metrics));
      check(metrics.quickPosition==='relative','Tablet Quick Access is not in normal document flow',JSON.stringify(metrics));
      check(metrics.rolesPosition==='static','Tablet role badges are not in normal flow',JSON.stringify(metrics));
    }
    const filename=path.join(out,'phase26-home-'+width+'.png');
    await page.screenshot({path:filename,fullPage:true,timeout:10000});
    console.log('Phase 26 homepage visual metrics '+width+'px: '+JSON.stringify(metrics));
    console.log('Phase 26 screenshot: '+filename);
    await page.close();
  }
}finally{
  if(browser)await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}
if(failures.length){
  console.error('Phase 26 focused homepage visual QA FAILED');
  for(const failure of failures)console.error('FAIL - '+failure.message+' '+failure.detail);
  process.exit(1);
}
console.log('Phase 26 focused homepage visual QA PASSED at mobile, tablet and desktop widths.');
