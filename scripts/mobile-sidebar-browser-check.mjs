import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=4174;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
let browser;
try{
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
  const launch={headless:true};if(process.env.EDUNIZAM_BROWSER)launch.executablePath=process.env.EDUNIZAM_BROWSER;
  browser=await chromium.launch(launch);
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForSelector('#eduMobileMenuBtn',{timeout:12000});
  await page.waitForSelector('#nav.nav-groups',{timeout:12000});
  // Keep this focused navigation test independent of the dashboard's school-auth gate.
  // The gate is covered by separate auth tests; here we exercise the drawer's own controls.
  await page.addStyleTag({content:'#cloudAuthScreen{display:none!important;pointer-events:none!important}'});
  const menu=page.locator('#eduMobileMenuBtn');
  if(!(await menu.isVisible()))throw new Error('Mobile menu button is not visible at 390px');
  await menu.click();
  const sidebar=page.locator('.sidebar');
  await page.waitForFunction(()=>document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),null,{timeout:5000});
  const openState=await page.evaluate(()=>{
    const side=document.querySelector('.sidebar'),nav=document.querySelector('.sidebar #nav'),close=document.querySelector('#eduMobileNavClose'),cs=getComputedStyle(close),r=close.getBoundingClientRect();
    const group=nav?.querySelector('.nav-group summary strong');
    return {expanded:document.querySelector('#eduMobileMenuBtn')?.getAttribute('aria-expanded'),backdrop:document.querySelector('#eduMobileNavBackdrop')?.classList.contains('show'),drawerWidth:side?.getBoundingClientRect().width,navHeight:nav?.clientHeight,navScrollHeight:nav?.scrollHeight,closeVisible:!!r.width&&!!r.height,closeColor:cs.color,closeBackground:cs.backgroundColor,closeWidth:r.width,groupText:group?.textContent?.trim(),featureText:label?.textContent?.trim(),featureLabelWrap:labelStyle?.whiteSpace,featureLabelOverflow:label?label.scrollWidth>label.clientWidth:false,iconWidth:iconRect?.width,groupGap:groupStyle?.marginBottom,sidebarBackground: getComputedStyle(side).backgroundColor};
  });
  if(openState.expanded!=='true'||!openState.backdrop)throw new Error('Drawer did not expose expanded state and backdrop: '+JSON.stringify(openState));
  if(!openState.closeVisible||openState.closeWidth<44||openState.closeColor==='rgb(255, 255, 255)')throw new Error('Mobile close control is not visibly readable/tappable: '+JSON.stringify(openState));
  if(!openState.groupText||openState.navHeight<100)throw new Error('Sidebar navigation content/scroll viewport missing: '+JSON.stringify(openState));\n  if(!openState.featureText||openState.featureLabelWrap!=='normal'||openState.featureLabelOverflow)throw new Error('Feature name is clipped instead of readable/wrapping: '+JSON.stringify(openState));\n  if(openState.iconWidth>18)throw new Error('Navigation icon was not reduced to approximately half size: '+JSON.stringify(openState));
  await page.locator('#eduMobileNavClose').click();
  await page.waitForFunction(()=>!document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),null,{timeout:5000});
  const closed=await page.locator('#eduMobileMenuBtn').getAttribute('aria-expanded');
  if(closed!=='false')throw new Error('Close action did not reset aria-expanded=false');
  console.log('Mobile sidebar interaction QA passed:',JSON.stringify({...openState,closedAriaExpanded:closed}));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
