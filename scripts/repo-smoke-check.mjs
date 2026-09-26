import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root=process.cwd();
const fail=[];
const pass=[];

function read(p){return fs.readFileSync(path.join(root,p),"utf8")}
function exists(p){return fs.existsSync(path.join(root,p))}
function ok(name){pass.push(name)}
function bad(name,msg){fail.push({name,msg})}

// 1) Required files
const required=[
  "index.html","style.css","app.js","manifest.webmanifest","sw.js",
  "robots.txt","sitemap.xml","edunizam.html","about.html","features.html","privacy.html","404.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html","public.css",
  "past-papers-data.js","past-papers-inventory.js","university-data.js",
  "vu-course-catalog.js","cloud-config.js","ai-client.js",
  "staff-time-attendance.js","teacher-training-center.js","bulk-import-center.js",
  "school-community.js","navigation-enhancements.js","ui-polish.js",
  "supabase-staff-time-training-community-migration.sql"
];
for(const p of required){exists(p)?ok("file:"+p):bad("file:"+p,"missing")}

// 2) HTML integrity, accessibility basics and local references
const htmlPages=["index.html","login.html","edunizam.html","about.html","features.html","privacy.html","404.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html"];
const htmlByPage=Object.fromEntries(htmlPages.map(p=>[p,read(p)]));
const html=htmlByPage["index.html"];

for(const [page,source] of Object.entries(htmlByPage)){
  const ids=[...source.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  dup.length?bad("html:duplicate-ids:"+page,dup.join(", ")):ok("html:duplicate-ids:"+page);

  const refs=[...source.matchAll(/(?:src|href)=["']([^"'?#]+)(?:[?#][^"']*)?["']/g)]
    .map(m=>m[1])
    .filter(x=>!/^https?:\/\//i.test(x)&&!x.startsWith("#")&&!x.startsWith("data:")&&!x.startsWith("mailto:"));
  const missing=[...new Set(refs.map(x=>x.replace(/^\.\//,"")).filter(x=>x&&!exists(x)))];
  missing.length?bad("html:local-assets:"+page,missing.join(", ")):ok("html:local-assets:"+page);

  /<title>[^<]{3,}<\/title>/i.test(source)?ok("html:title:"+page):bad("html:title:"+page,"missing");
  /<meta\s+name=["']description["']\s+content=["'][^"']{20,}["']/i.test(source)?ok("html:description:"+page):bad("html:description:"+page,"missing/short");
  /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(source)?ok("html:h1:"+page):bad("html:h1:"+page,"missing");

  const images=[...source.matchAll(/<img\b([^>]*)>/gi)].map(m=>m[1]);
  const noAlt=images.filter(attrs=>!/\balt=["'][^"']*["']/i.test(attrs));
  noAlt.length?bad("html:image-alt:"+page,noAlt.length+" image(s) missing alt"):ok("html:image-alt:"+page);

  if(source.includes("\\n"))bad("html:literal-newline:"+page,"literal \\n found in markup");
  else ok("html:literal-newline:"+page);
}

// 2b) Crawl and indexing essentials
const base="https://manazarali01-hub.github.io/eduNizam/";
const canonicalPages={
  "edunizam.html":base+"edunizam.html",
  "about.html":base+"about.html",
  "features.html":base+"features.html",
  "privacy.html":base+"privacy.html",
  "school-management-system-pakistan.html":base+"school-management-system-pakistan.html",
  "online-school-admissions.html":base+"online-school-admissions.html",
  "learning-resources-pakistan.html":base+"learning-resources-pakistan.html"
};
for(const [page,expected] of Object.entries(canonicalPages)){
  const source=htmlByPage[page];
  const canonical=source.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]||"";
  canonical===expected?ok("seo:canonical:"+page):bad("seo:canonical:"+page,canonical||"missing");
  /<meta\s+name=["']robots["']\s+content=["'][^"']*index[^"']*follow/i.test(source)
    ?ok("seo:robots-meta:"+page):bad("seo:robots-meta:"+page,"index,follow missing");
}
for(const page of ["index.html","login.html","404.html"]){
  /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(htmlByPage[page])
    ?ok("seo:noindex:"+page):bad("seo:noindex:"+page,"noindex missing");
}
const appCanonical=html.match(/<link\s+rel=["']canonical["']\s+href=/i);
!appCanonical?ok("seo:canonical:index-private"):bad("seo:canonical:index-private","private app should not publish a canonical search landing");

try{
  const landing=htmlByPage["edunizam.html"];
  const jsonLd=landing.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i)?.[1];
  const parsed=JSON.parse(jsonLd||"");
  const graph=Array.isArray(parsed["@graph"])?parsed["@graph"]:[];
  const appNode=graph.find(x=>x["@type"]==="SoftwareApplication");
  appNode?.url===canonicalPages["edunizam.html"]?ok("seo:structured-data:edunizam"):bad("seo:structured-data:edunizam","SoftwareApplication landing data missing/unexpected");
}catch(e){bad("seo:structured-data:edunizam",e.message)}

for(const page of ["about.html","features.html","privacy.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html"]){
  try{
    const jsonLd=htmlByPage[page].match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i)?.[1];
    const parsed=JSON.parse(jsonLd||"");
    parsed.url===canonicalPages[page]?ok("seo:structured-data:"+page):bad("seo:structured-data:"+page,"missing/unexpected URL");
  }catch(e){bad("seo:structured-data:"+page,e.message)}
}

const sitemap=read("sitemap.xml");
const sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const landingHtml=htmlByPage["edunizam.html"];
const homeLinks=[...landingHtml.matchAll(/href=["']([^"']+\.html)["']/g)].map(m=>m[1].replace(/^\.\//,''));
const crawlFiles=["about.html","features.html","privacy.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html"];
const orphaned=crawlFiles.filter(p=>!homeLinks.includes(p) && !htmlByPage["features.html"].includes('href="'+p+'"'));
orphaned.length?bad("seo:orphan-public-pages",orphaned.join(", ")):ok("seo:orphan-public-pages");

const expectedUrls=Object.values(canonicalPages);
const missingSitemap=expectedUrls.filter(x=>!sitemapUrls.includes(x));
missingSitemap.length?bad("seo:sitemap",missingSitemap.join(", ")):ok("seo:sitemap");
if(sitemapUrls.some(x=>x===base||/login\.html|admission\.html|404\.html/i.test(x)))bad("seo:sitemap-private","private/root app URLs must not be listed");
else ok("seo:sitemap-private");
const robots=read("robots.txt");
robots.includes("Sitemap: "+base+"sitemap.xml")?ok("seo:robots-sitemap"):bad("seo:robots-sitemap","sitemap directive missing");
robots.includes("Allow: /")?ok("seo:robots-allow"):bad("seo:robots-allow","crawl allow missing");
!robots.includes("Disallow: /eduNizam/login.html")?ok("seo:robots-noindex-readable"):bad("seo:robots-noindex-readable","login should remain crawlable so Google can read noindex");

// 3) Manifest validity and icons
try{
  const manifest=JSON.parse(read("manifest.webmanifest"));
  if(!manifest.name||!manifest.short_name||!manifest.start_url)bad("manifest:required-fields","name/short_name/start_url required");
  else ok("manifest:required-fields");
  const icons=Array.isArray(manifest.icons)?manifest.icons:[];
  for(const icon of icons){if(!exists(icon.src))bad("manifest:icon",icon.src+" missing")}
  if(icons.length)ok("manifest:icons");else bad("manifest:icons","no icons declared");
}catch(e){bad("manifest:json",e.message)}

// 4) Browser JS syntax
const jsFiles=fs.readdirSync(root).filter(x=>x.endsWith(".js"));
for(const p of jsFiles){
  try{new vm.Script(read(p),{filename:p});ok("js:"+p)}
  catch(e){bad("js:"+p,e.message)}
}

// 5) Service worker cache references
const sw=read("sw.js");
if(!/addEventListener\(['"]activate['"]/.test(sw))bad("sw:activate","activate handler missing");else ok("sw:activate");
if(!/request\.method|e\.request\.method/.test(sw))bad("sw:get-guard","non-GET guard missing");else ok("sw:get-guard");
const swAssets=[...sw.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m=>m[1]);
const missingSw=[...new Set(swAssets.filter(p=>!exists(p)))];
missingSw.length?bad("sw:assets",missingSw.join(", ")):ok("sw:assets");

// 6) Data integrity for core catalogs
function evalBrowserFile(p,ctx){
  vm.runInContext(read(p),ctx,{filename:p});
}
const ctx=vm.createContext({window:{}});
try{
  evalBrowserFile("past-papers-data.js",ctx);
  evalBrowserFile("past-papers-inventory.js",ctx);
  const pp=ctx.window.EDUNIZAM_PAST_PAPERS||{};
  const boards=pp.boards||[],papers=pp.papers||[];
  const boardIds=new Set(boards.map(x=>x.id));
  const ids2=papers.map(x=>x.id);
  const dupP=[...new Set(ids2.filter((x,i)=>ids2.indexOf(x)!==i))];
  if(dupP.length)bad("data:paper-ids",dupP.join(", "));else ok("data:paper-ids");
  const orphan=papers.filter(x=>!boardIds.has(x.boardId)).map(x=>x.id);
  if(orphan.length)bad("data:paper-board-refs",orphan.join(", "));else ok("data:paper-board-refs");
}catch(e){bad("data:past-papers",e.message)}

try{
  evalBrowserFile("university-data.js",ctx);
  const u=ctx.window.EDUNIZAM_UNIVERSITY_DATA||{};
  const universityIds=new Set((u.universities||[]).map(x=>x.id));
  const orphan=(u.resources||[]).filter(x=>!universityIds.has(x.universityId)).map(x=>x.id);
  if(orphan.length)bad("data:university-refs",orphan.join(", "));else ok("data:university-refs");
}catch(e){bad("data:universities",e.message)}

try{
  evalBrowserFile("vu-course-catalog.js",ctx);
  const courses=ctx.window.EDUNIZAM_VU_COURSE_CATALOG?.courses||[];
  const codes=courses.map(x=>x.code);
  const dupC=[...new Set(codes.filter((x,i)=>codes.indexOf(x)!==i))];
  if(dupC.length)bad("data:vu-course-codes",dupC.join(", "));else ok("data:vu-course-codes");
}catch(e){bad("data:vu-catalog",e.message)}

// 7) Secret hygiene in browser files
const browserText=["index.html",...jsFiles].map(read).join("\n");
if(/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+["']/i.test(browserText))bad("security:service-role","service role secret-like value in browser code");
else ok("security:service-role");
if(/OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/i.test(browserText))bad("security:openai-key","OpenAI secret-like value in browser code");
else ok("security:openai-key");

/* Auth regression guards */
const authBridge=read("auth-bridge.js");
const loginHtml=read("login.html");
if(/location\.replace\(['"]login\.html/i.test(authBridge)||/location\.href\s*=\s*['"]login\.html/i.test(authBridge)){
  bad("auth:no-loop-redirect","auth-bridge must never auto-redirect to login");
}else ok("auth:no-loop-redirect");

if(/localStorage\.removeItem\(['"]edunizam_session['"]\)/.test(loginHtml)){
  bad("auth:login-preserves-session","login page must not delete valid app session");
}else ok("auth:login-preserves-session");

const storyRule=loginHtml.match(/\.story\{[^}]*\}/)?.[0]||"";
if(/linear-gradient\(/.test(storyRule) && /edunizam-login-children\.webp/.test(storyRule)){
  bad("ui:children-image-overlay","children login image must not have a gradient overlay");
}else ok("ui:children-image-overlay");

console.log("EduNizam smoke checks:",pass.length,"passed,",fail.length,"failed");
for(const x of fail)console.error("FAIL",x.name,"-",x.msg);
if(fail.length)process.exit(1);
