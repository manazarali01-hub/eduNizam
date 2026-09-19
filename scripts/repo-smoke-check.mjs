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
  "robots.txt","sitemap.xml","about.html","features.html","public.css",
  "past-papers-data.js","past-papers-inventory.js","university-data.js",
  "vu-course-catalog.js","cloud-config.js","ai-client.js",
  "staff-time-attendance.js","teacher-training-center.js","bulk-import-center.js",
  "school-community.js","navigation-enhancements.js",
  "supabase-staff-time-training-community-migration.sql"
];
for(const p of required){exists(p)?ok("file:"+p):bad("file:"+p,"missing")}

// 2) HTML duplicate IDs + local src/href existence
const html=read("index.html");
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
dup.length?bad("html:duplicate-ids",dup.join(", ")):ok("html:duplicate-ids");

const refs=[...html.matchAll(/(?:src|href)=["']([^"'?#]+)(?:[?#][^"']*)?["']/g)]
  .map(m=>m[1])
  .filter(x=>!/^https?:\/\//i.test(x)&&!x.startsWith("#")&&!x.startsWith("data:")&&!x.startsWith("mailto:"));
const missingRefs=[...new Set(refs.map(x=>x.replace(/^\.\//,"")).filter(x=>x&&!exists(x)))];
missingRefs.length?bad("html:local-assets",missingRefs.join(", ")):ok("html:local-assets");

// 2b) Crawl and indexing essentials
const expectedCanonical="https://manazarali01-hub.github.io/hub/";
const canonical=html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]||"";
canonical===expectedCanonical?ok("seo:canonical"):bad("seo:canonical",canonical||"missing");
if(/<meta\s+name=["']robots["']\s+content=["'][^"']*index[^"']*follow/i.test(html))ok("seo:robots-meta");
else bad("seo:robots-meta","index,follow missing");
try{
  const jsonLd=html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i)?.[1];
  const parsed=JSON.parse(jsonLd||"");
  parsed["@type"]==="WebApplication"&&parsed.url===expectedCanonical?ok("seo:structured-data"):bad("seo:structured-data","unexpected WebApplication data");
}catch(e){bad("seo:structured-data",e.message)}
const sitemap=read("sitemap.xml");
const sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const expectedUrls=[expectedCanonical,expectedCanonical+"about.html",expectedCanonical+"features.html"];
const missingSitemap=expectedUrls.filter(x=>!sitemapUrls.includes(x));
missingSitemap.length?bad("seo:sitemap",missingSitemap.join(", ")):ok("seo:sitemap");
const robots=read("robots.txt");
robots.includes("Sitemap: "+expectedCanonical+"sitemap.xml")?ok("seo:robots-sitemap"):bad("seo:robots-sitemap","sitemap directive missing");

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

console.log("EduNizam smoke checks:",pass.length,"passed,",fail.length,"failed");
for(const x of fail)console.error("FAIL",x.name,"-",x.msg);
if(fail.length)process.exit(1);
