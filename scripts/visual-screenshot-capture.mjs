import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,'artifacts','visual-qa');
fs.mkdirSync(out,{recursive:true});
const port=4174;
const mime={
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp',
  '.json':'application/json','.webmanifest':'application/manifest+json'
};
const server=http.createServer((req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    let rel=decodeURIComponent(u.pathname).replace(/^\/+/,'');
    if(!rel)rel='index.html';
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
      res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');return;
    }
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(e){res.writeHead(500,{'content-type':'text/plain'});res.end(String(e.message||e))}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});

const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleUrl);
const options={headless:true};
if(process.env.EDUNIZAM_BROWSER)options.executablePath=process.env.EDUNIZAM_BROWSER;
const browser=await chromium.launch(options);
const routes=[
  ['home','/'],['login','/login.html'],['learn','/learn.html'],
  ['admission','/admission.html'],['app','/app.html']
];
const sizes=[
  {label:'mobile',width:390,height:844},
  {label:'desktop',width:1366,height:820}
];

try{
  for(const size of sizes){
    for(const [name,route] of routes){
      const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:size.width,height:size.height}});
      await page.route('**/*',r=>{
        const u=new URL(r.request().url());
        if(u.hostname==='127.0.0.1')r.continue(); else r.abort();
      });
      await page.goto('http://127.0.0.1:'+port+route,{waitUntil:'domcontentloaded',timeout:10000});
      await page.addStyleTag({content:\`
        :root{
          --en-photo-kids:url("/assets/edunizam-login-children.webp")!important;
          --en-photo-students:url("/assets/edunizam-girl-hero.webp")!important;
          --en-photo-study:url("/assets/edunizam-girl-hero.webp")!important;
          --en-photo-flatlay:url("/assets/edunizam-login-children.webp")!important;
          --en-photo-stationery:url("/assets/edunizam-girl-hero.webp")!important;
          --en-photo-classroom:url("/assets/edunizam-login-children.webp")!important;
        }
        *,*:before,*:after{animation:none!important;transition:none!important}
      \`});
      await page.evaluate(()=>{
        const hero=document.querySelector('.page-home .hero-image-wrap img');
        if(hero)hero.setAttribute('src','assets/edunizam-login-children.webp');
        window.scrollTo(0,0);
      });
      await page.waitForTimeout(120);
      await page.screenshot({
        path:path.join(out,name+'-'+size.label+'.png'),
        fullPage:false,
        timeout:5000
      });
      await page.close();
    }
  }
  console.log('Visual screenshots captured:',routes.length*sizes.length);
}finally{
  await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(()=>resolve()));
}
