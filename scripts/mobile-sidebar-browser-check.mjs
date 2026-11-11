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
  await page.addInitScript(()=>localStorage.setItem('edunizam_session',JSON.stringify({role:'admin'})));
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForSelector('#eduMobileMenuBtn',{timeout:12000});
  await page.waitForSelector('#nav.nav-groups',{state:'attached',timeout:12000});
  // Keep this focused navigation test independent of the dashboard's school-auth gate.
  // The gate is covered by separate auth tests; here we exercise the drawer's own controls.
  await page.addStyleTag({content:'#cloudAuthScreen{display:none!important;pointer-events:none!important}'});
  await page.waitForSelector('#roleSession',{timeout:7000});
  await page.waitForSelector('#accountSecurityButton',{timeout:7000});
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    const header=await page.evaluate(()=>{
      const top=document.querySelector('#appMain>.topbar');
      const title=document.querySelector('#appMain>.topbar>.topbar-title');
      const heading=document.querySelector('#appMain>.topbar #page-title');
      const actions=document.querySelector('#appMain>.topbar>.topbar-actions');
      const session=document.querySelector('#roleSession');
      const account=document.querySelector('#accountSecurityButton');
      const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {top:rect(top),title:rect(title),heading:rect(heading),actions:rect(actions),session:rect(session),account:rect(account),actionsScroll:actions.scrollWidth,actionsClient:actions.clientWidth};
    });
    if(header.heading.width<65||header.heading.height<18)throw new Error('Mobile page title is hidden/clipped at '+width+'px: '+JSON.stringify(header));
    if(header.title.bottom>header.actions.top+1)throw new Error('Mobile title overlaps account controls at '+width+'px: '+JSON.stringify(header));
    if(header.actionsScroll>header.actionsClient+2)throw new Error('Mobile account controls overflow at '+width+'px: '+JSON.stringify(header));
    if(header.account.height>40||header.account.width>106)throw new Error('Mobile account button wraps/expands at '+width+'px: '+JSON.stringify(header));
    if(header.account.right>header.top.right-3)throw new Error('Mobile account button exceeds topbar at '+width+'px: '+JSON.stringify(header));
    console.log('Mobile topbar layout QA passed at '+width+'px:',JSON.stringify(header));
  }
  await page.setViewportSize({width:390,height:844});
  const menu=page.locator('#eduMobileMenuBtn');
  if(!(await menu.isVisible()))throw new Error('Mobile menu button is not visible at 390px');
  await menu.click();
  const sidebar=page.locator('.sidebar');
  await page.waitForFunction(()=>document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),null,{timeout:5000});
  const hamburgerCovered=await page.evaluate(()=>{
    const side=document.querySelector('.sidebar'),menu=document.querySelector('#eduMobileMenuBtn');
    if(!side||!menu)return false;
    const d=side.getBoundingClientRect(),m=menu.getBoundingClientRect();
    const drawerZ=Number.parseInt(getComputedStyle(side).zIndex,10)||0;
    const menuZ=Number.parseInt(getComputedStyle(menu).zIndex,10)||0;
    const overlaps=m.left+m.width/2>=d.left&&m.left+m.width/2<=d.right&&m.top+m.height/2>=d.top&&m.top+m.height/2<=d.bottom;
    return {overlaps,drawerZ,menuZ,drawer:{left:d.left,right:d.right,top:d.top,bottom:d.bottom,position:getComputedStyle(side).position},menu:{left:m.left,right:m.right,top:m.top,bottom:m.bottom,position:getComputedStyle(menu).position},inlineDrawerZ:side.style.zIndex,inlineMenuZ:menu.style.zIndex};
  });
  if(!hamburgerCovered.overlaps||hamburgerCovered.drawerZ<=hamburgerCovered.menuZ)throw new Error('Mobile drawer layering mismatch: '+JSON.stringify(hamburgerCovered));
  const openState=await page.evaluate(()=>{
    const side=document.querySelector('.sidebar'),nav=document.querySelector('.sidebar #nav'),close=document.querySelector('#eduMobileNavClose'),cs=getComputedStyle(close),r=close.getBoundingClientRect();
    const group=nav?.querySelector('.nav-group summary strong');
    const feature=nav?.querySelector('.nav-item[data-view]');
    const label=feature?.querySelector('.premium-nav-label');
    const icon=feature?.querySelector('.premium-nav-icon');
    const labelStyle=label?getComputedStyle(label):null;
    const iconRect=icon?.getBoundingClientRect();
    const groupStyle=group?getComputedStyle(group):null;
    return {expanded:document.querySelector('#eduMobileMenuBtn')?.getAttribute('aria-expanded'),backdrop:document.querySelector('#eduMobileNavBackdrop')?.classList.contains('show'),drawerWidth:side?.getBoundingClientRect().width,navHeight:nav?.clientHeight,navScrollHeight:nav?.scrollHeight,closeVisible:!!r.width&&!!r.height,closeColor:cs.color,closeBackground:cs.backgroundColor,closeWidth:r.width,groupText:group?.textContent?.trim(),groupLabelWidth:group?.getBoundingClientRect().width,groupLabelFontSize:groupStyle?.fontSize,groupLabelColor:groupStyle?.color,groupLabelOverflow:group?group.scrollWidth>group.clientWidth:false,featureText:label?.textContent?.trim(),featureLabelWrap:labelStyle?.whiteSpace,featureLabelOverflow:label?label.scrollWidth>label.clientWidth:false,iconWidth:iconRect?.width,groupGap:groupStyle?.marginBottom,sidebarBackground: getComputedStyle(side).backgroundColor};
  });
  if(openState.expanded!=='true'||!openState.backdrop)throw new Error('Drawer did not expose expanded state and backdrop: '+JSON.stringify(openState));
  // Verify the mobile accordion affordance is visibly rendered and the same
  // heading can be tapped twice to open and close (not merely CSS-styled).
  const firstSummary=sidebar.locator('#nav .nav-group').first().locator('summary');
  const chevron=await firstSummary.locator('small').evaluate(node=>{
    const s=getComputedStyle(node),r=node.getBoundingClientRect();
    return {text:node.textContent.trim(),width:r.width,height:r.height,color:s.color,display:s.display,visibility:s.visibility,opacity:s.opacity};
  });
  if(!chevron.text||chevron.width<7||chevron.height<7||chevron.color==='rgba(0, 0, 0, 0)'||chevron.display==='none'||chevron.visibility!=='visible'||Number(chevron.opacity)===0)
    throw new Error('Mobile accordion chevron is not visibly rendered: '+JSON.stringify(chevron));
  const firstGroup=sidebar.locator('#nav .nav-group').first();
  if(!(await firstGroup.evaluate(node=>node.open))) await firstSummary.click();
  const ensuredOpen=await firstGroup.evaluate(node=>node.open);
  if(!ensuredOpen)throw new Error('Could not open the first accordion group before testing toggle');
  await firstSummary.click();
  const closedGroup=await firstGroup.evaluate(node=>node.open);
  if(closedGroup)throw new Error('Tapping an open accordion heading did not close it');
  await firstSummary.click();
  await page.waitForFunction(()=>document.querySelector('#nav .nav-group')?.open===true,null,{timeout:3000});
  const reopenedGroup=await sidebar.locator('#nav .nav-group').first().evaluate(node=>node.open);
  if(!reopenedGroup)throw new Error('Tapping a closed accordion heading did not reopen it');
  console.log('Mobile accordion chevron/toggle QA passed:',JSON.stringify(chevron));

  if(!openState.closeVisible||openState.closeWidth<44||openState.closeColor==='rgba(0, 0, 0, 0)'||openState.closeBackground==='rgba(0, 0, 0, 0)')throw new Error('Mobile close control is not visibly readable/tappable: '+JSON.stringify(openState));
  if(!openState.groupText||openState.navHeight<100)throw new Error('Sidebar navigation content/scroll viewport missing: '+JSON.stringify(openState));
  if(!openState.groupText||openState.groupLabelWidth<70||(parseFloat(openState.groupLabelFontSize)<12||parseFloat(openState.groupLabelFontSize)>13)||openState.groupLabelColor==='rgba(0, 0, 0, 0)'||openState.groupLabelOverflow)throw new Error('Category heading is too small, clipped or unreadable: '+JSON.stringify(openState));
  if(!openState.featureText||openState.featureLabelWrap!=='normal'||openState.featureLabelOverflow)throw new Error('Feature name is clipped instead of readable/wrapping: '+JSON.stringify(openState));
  if(openState.iconWidth>18)throw new Error('Navigation icon was not reduced to approximately half size: '+JSON.stringify(openState));
  // Exercise every category and every visible feature label, not only the first item.
  const groupCount=await sidebar.locator('#nav .nav-group').count();
  let checkedGroups=0,checkedFeatures=0;
  for(let i=0;i<groupCount;i++){
    const group=sidebar.locator('#nav .nav-group').nth(i);
    const isOpen=await group.evaluate(node=>node.open);
    if(!isOpen) await group.locator('summary').click();
    await group.locator('.nav-item:not(.role-hidden):not(.nav-search-hidden)').first().waitFor({state:'visible',timeout:3000}).catch(()=>{});
    const items=group.locator('.nav-item:not(.role-hidden):not(.nav-search-hidden):visible');
    const itemCount=await items.count();
    if(!itemCount)continue;
    const metrics=await items.evaluateAll(nodes=>nodes.map(node=>{
      const label=node.querySelector('.premium-nav-label');
      const icon=node.querySelector('.premium-nav-icon svg');
      const lr=label?.getBoundingClientRect();
      const ir=icon?.getBoundingClientRect();
      return {text:label?.textContent?.trim(),labelWidth:lr?.width||0,labelScroll:label?.scrollWidth||0,labelClient:label?.clientWidth||0,iconWidth:ir?.width||0};
    }));
    for(const m of metrics){
      if(!m.text||m.labelWidth<45||m.labelScroll>m.labelClient+1)throw new Error('Feature label is missing or clipped in group '+i+': '+JSON.stringify(m));
      if(m.iconWidth>13)throw new Error('Feature icon exceeds compact 12px target in group '+i+': '+JSON.stringify(m));
      checkedFeatures++;
    }
    checkedGroups++;
  }
  if(checkedGroups<5||checkedFeatures<20)throw new Error('Sidebar coverage too small: '+JSON.stringify({checkedGroups,checkedFeatures}));
  console.log('Full mobile sidebar coverage passed:',JSON.stringify({checkedGroups,checkedFeatures}));
  await page.locator('#eduMobileNavClose').click();
  await page.waitForFunction(()=>!document.querySelector('.sidebar')?.classList.contains('mobile-nav-open'),null,{timeout:5000});
  const closed=await page.locator('#eduMobileMenuBtn').getAttribute('aria-expanded');
  if(closed!=='false')throw new Error('Close action did not reset aria-expanded=false');
  console.log('Mobile sidebar interaction QA passed:',JSON.stringify({...openState,closedAriaExpanded:closed}));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
