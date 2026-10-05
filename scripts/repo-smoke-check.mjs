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
  "index.html","app.html","style.css","app.js","manifest.webmanifest","sw.js",
  "robots.txt","sitemap.xml","edunizam.html","about.html","features.html","privacy.html","404.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html","learn.html","public.css",
  "past-papers-data.js","past-papers-inventory.js","university-data.js","study-data.js","practice-data.js","learning-premium-data.js","learning-complete-data.js","learning-required-data.js","practice-complete-data.js","practice-session-core.js","learning-search-engine.js","guest-learning-nav.js","guest-learning-premium.js",
  "vu-course-catalog.js","cloud-config.js","ai-client.js",
  "staff-time-attendance.js","teacher-training-center.js","bulk-import-center.js",
  "school-community.js","navigation-enhancements.js","ui-polish.js","mobile-nav-core.js","data-runtime.js","auth-bridge.js",
  "supabase-staff-time-training-community-migration.sql"
];
for(const p of required){exists(p)?ok("file:"+p):bad("file:"+p,"missing")}

// 2) HTML integrity, accessibility basics and local references
const htmlPages=["index.html","app.html","login.html","edunizam.html","about.html","features.html","privacy.html","404.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html","learn.html"];
const htmlByPage=Object.fromEntries(htmlPages.map(p=>[p,read(p)]));
const html=htmlByPage["app.html"];

for(const [page,source] of Object.entries(htmlByPage)){
  const ids=[...source.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
  dup.length?bad("html:duplicate-ids:"+page,dup.join(", ")):ok("html:duplicate-ids:"+page);

  const refs=[...source.matchAll(/(?:src|href)=["']([^"'?#]+)(?:[?#][^"']*)?["']/g)]
    .map(m=>m[1])
    .filter(x=>!/^https?:\/\//i.test(x)&&!x.startsWith("#")&&!/^[a-z][a-z0-9+.-]*:/i.test(x));
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
const base="https://edunizam.online/";
const canonicalPages={
  "index.html":base,
  "edunizam.html":base,
  "about.html":base+"about.html",
  "features.html":base+"features.html",
  "privacy.html":base+"privacy.html",
  "school-management-system-pakistan.html":base+"school-management-system-pakistan.html",
  "online-school-admissions.html":base+"online-school-admissions.html",
  "learning-resources-pakistan.html":base+"learning-resources-pakistan.html",
  "learn.html":base+"learn.html"
};
for(const [page,expected] of Object.entries(canonicalPages)){
  const source=htmlByPage[page];
  const canonical=source.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]||"";
  canonical===expected?ok("seo:canonical:"+page):bad("seo:canonical:"+page,canonical||"missing");
  /<meta\s+name=["']robots["']\s+content=["'][^"']*index[^"']*follow/i.test(source)
    ?ok("seo:robots-meta:"+page):bad("seo:robots-meta:"+page,"index,follow missing");
}
for(const page of ["app.html","login.html","404.html"]){
  /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(htmlByPage[page])
    ?ok("seo:noindex:"+page):bad("seo:noindex:"+page,"noindex missing");
}
const appCanonical=html.match(/<link\s+rel=["']canonical["']\s+href=/i);
!appCanonical?ok("seo:canonical:index-private"):bad("seo:canonical:index-private","private app should not publish a canonical search landing");

try{
  const landing=htmlByPage["index.html"];
  const jsonLd=landing.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i)?.[1];
  const parsed=JSON.parse(jsonLd||"");
  const graph=Array.isArray(parsed["@graph"])?parsed["@graph"]:[];
  const appNode=graph.find(x=>x["@type"]==="SoftwareApplication");
  appNode?.url===canonicalPages["index.html"]?ok("seo:structured-data:edunizam"):bad("seo:structured-data:edunizam","SoftwareApplication landing data missing/unexpected");
}catch(e){bad("seo:structured-data:edunizam",e.message)}

for(const page of ["about.html","features.html","privacy.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html"]){
  try{
    const jsonLd=htmlByPage[page].match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i)?.[1];
    const parsed=JSON.parse(jsonLd||"");
    const graph=Array.isArray(parsed["@graph"])?parsed["@graph"]:[parsed];
    const pageNode=graph.find(x=>x&&x.url===canonicalPages[page]&&x["@type"]!=="BreadcrumbList");
    const breadcrumb=graph.find(x=>x?.["@type"]==="BreadcrumbList");
    pageNode&&breadcrumb?ok("seo:structured-data:"+page):bad("seo:structured-data:"+page,"page node/breadcrumb missing or unexpected URL");
  }catch(e){bad("seo:structured-data:"+page,e.message)}
}

const sitemap=read("sitemap.xml");
const sitemapUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const landingHtml=htmlByPage["index.html"];
const homeLinks=[...landingHtml.matchAll(/href=["']([^"']+\.html)["']/g)].map(m=>m[1].replace(/^\.\//,''));
const crawlFiles=["about.html","features.html","privacy.html","school-management-system-pakistan.html","online-school-admissions.html","learning-resources-pakistan.html","learn.html"];
const orphaned=crawlFiles.filter(p=>!homeLinks.includes(p) && !htmlByPage["features.html"].includes('href="'+p+'"'));
orphaned.length?bad("seo:orphan-public-pages",orphaned.join(", ")):ok("seo:orphan-public-pages");

const expectedUrls=Object.values(canonicalPages);
const missingSitemap=expectedUrls.filter(x=>!sitemapUrls.includes(x));
missingSitemap.length?bad("seo:sitemap",missingSitemap.join(", ")):ok("seo:sitemap");
if(sitemapUrls.some(x=>/app\.html|login\.html|admission\.html|404\.html/i.test(x)))bad("seo:sitemap-private","private app URLs must not be listed");
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
  manifest.start_url==="./login.html"?ok("manifest:secure-entry"):bad("manifest:secure-entry","installed app must start at login.html");
  const icons=Array.isArray(manifest.icons)?manifest.icons:[];
  for(const icon of icons){if(!exists(icon.src))bad("manifest:icon",icon.src+" missing")}
  if(icons.length)ok("manifest:icons");else bad("manifest:icons","no icons declared");
}catch(e){bad("manifest:json",e.message)}

// 3b) Visitor / Guest Learning regression guards
const learn=htmlByPage["learn.html"];
if(!learn.includes('href="login.html">Login / Sign Up</a>'))bad("visitor:login-entry","Guest Learning must expose Login / Sign Up");else ok("visitor:login-entry");
if(!learn.includes('guest-learning-nav.js?v=')||!learn.includes('guest-learning-premium.js?v='))bad("visitor:guest-bundle","Guest Learning scripts missing");else ok("visitor:guest-bundle");
const guestNav=read("guest-learning-nav.js");
if(/style\.display\s*=/.test(guestNav))bad("visitor:nav-inline-display","Guest navigation must not leave stale inline display locks");else ok("visitor:nav-inline-display");
const guestPremium=read("guest-learning-premium.js");
for(const marker of ["function closePremium()","if(level==='university')","data-study-id","paperSession","paperLevel"]){
  guestPremium.includes(marker)?ok("visitor:premium:"+marker):bad("visitor:premium:"+marker,"missing");
}
if(!read("index.html").includes('href="login.html">Login / Sign Up</a>'))bad("visitor:landing-login","Public landing must expose Login / Sign Up");else ok("visitor:landing-login");
read('learning-sky.css').includes('.search-wrap{position:relative;top:auto;z-index:2}')?ok("visitor:mobile-search-flow"):bad("visitor:mobile-search-flow","mobile search must not remain sticky over content");
guestPremium.includes('flex-wrap:nowrap!important')?ok("visitor:mobile-chip-scroll"):bad("visitor:mobile-chip-scroll","mobile search chips must scroll horizontally");
guestPremium.includes('search-tools-collapsed')?ok("visitor:search-collapse"):bad("visitor:search-collapse","search suggestions must collapse after submit");
read("school-assessment-data.js").includes("pectaa-g5-math-curriculum")?ok("visitor:g5-math-resource"):bad("visitor:g5-math-resource","official Grade 5 Mathematics resource missing");
guestPremium.includes("refreshGradeOptions")?ok("visitor:grade-filter-data"):bad("visitor:grade-filter-data","grade filters must reflect available resource data");
guestPremium.includes("No exact resource of this type is currently indexed.")?ok("visitor:grade-fallback"):bad("visitor:grade-fallback","grade filters need a genuine-resource fallback");
const practiceData=read("practice-data.js");
practiceData.includes('id:"q21"')&&practiceData.includes('chapter:"Periodic Table"')&&practiceData.includes('difficulty:"Medium"')?ok("visitor:practice-periodic-table"):bad("visitor:practice-periodic-table","Grade 9 Chemistry Periodic Table medium question missing");
guestPremium.includes("refreshPracticeOptions")?ok("visitor:practice-data-filters"):bad("visitor:practice-data-filters","practice filters must come from available questions");
guestPremium.includes("baseActions.hidden=true")?ok("visitor:practice-nav"):bad("visitor:practice-nav","legacy duplicate practice navigation must be hidden");
guestPremium.includes("baseActions.style.display='none'")?ok("visitor:practice-nav-force-hide"):bad("visitor:practice-nav-force-hide","legacy practice navigation must be force-hidden");
read('learning-sky.css').includes('.practice-actions[hidden],.practice-actions[aria-hidden="true"]{display:none!important}')?ok("visitor:practice-hidden-css"):bad("visitor:practice-hidden-css","hidden Practice navigation CSS guard missing");
!guestPremium.includes("No practice question matches these filters. Try another class, subject, chapter or difficulty.")?ok("visitor:practice-no-dead-end"):bad("visitor:practice-no-dead-end","dead-end practice message remains");
for(const marker of ["guestStudySubject","guestStudyType","guestUniversitySummary","refreshTypes=()=>","data-hub-filter","function applyHubShortcut"]){
  guestPremium.includes(marker)?ok("learning:control:"+marker):bad("learning:control:"+marker,"missing");
}
learn.includes("(pp.papers||[]).length+(sd.materials||[]).length")?ok("learning:overview-total"):bad("learning:overview-total","overview must count all public resources");
const completeData=read("learning-complete-data.js");
completeData.includes("EDUNIZAM_PUBLIC_LINKS")?ok("learning:public-links"):bad("learning:public-links","official date-sheet/result links missing");
guestPremium.includes("guestPracticeType")?ok("learning:practice-type"):bad("learning:practice-type","Practice question-type filter missing");
guestPremium.includes("kind==='practice'")?ok("learning:practice-shortcut"):bad("learning:practice-shortcut","MCQ/Quiz shortcut missing");
guestPremium.includes("showGlobalResults('date sheet')")&&guestPremium.includes("showGlobalResults('results')")?ok("learning:public-shortcuts"):bad("learning:public-shortcuts","date sheet/results shortcuts missing");
for(const marker of ["guestPracticeOrder","guestPracticeLimit","practiceSessionStats","finishGuestPractice","Session complete","Practice Again","Pending: ","Practice questions answered"]){
  guestPremium.includes(marker)?ok("learning:practice-session:"+marker):bad("learning:practice-session:"+marker,"missing");
}
for(const marker of ["#practiceExplorer select,#practiceExplorer button","min-height:46px",".practice-box .option","touch-action:manipulation"]){
  guestPremium.includes(marker)?ok("learning:practice-mobile:"+marker):bad("learning:practice-mobile:"+marker,"missing");
}
learn.includes("(window.EDUNIZAM_PUBLIC_LINKS||[]).length")?ok("learning:public-count"):bad("learning:public-count","overview excludes public portal links");

// 4) Browser JS syntax
const jsFiles=fs.readdirSync(root).filter(x=>x.endsWith(".js"));
for(const p of jsFiles){
  try{new vm.Script(read(p),{filename:p});ok("js:"+p)}
  catch(e){bad("js:"+p,e.message)}
}

// 5) Service worker cache references
const sw=read("sw.js");
const autoUpdate=read("system-auto-update.js");
const pwaInstallSource=read("pwa-install.js");
const swCache=sw.match(/const CACHE=['"]([^'"]+)['"]/)?.[1]||"";
const activeCache=autoUpdate.match(/const ACTIVE_CACHE=['"]([^'"]+)['"]/)?.[1]||"";
const build=autoUpdate.match(/const BUILD=['"]([^'"]+)['"]/)?.[1]||"";
const registerBuild=pwaInstallSource.match(/sw\.js\?v=([^'"]+)/)?.[1]||"";
swCache&&swCache===activeCache?ok("sw:cache-version-aligned"):bad("sw:cache-version-aligned",swCache+" != "+activeCache);
build&&build===registerBuild?ok("sw:build-version-aligned"):bad("sw:build-version-aligned",build+" != "+registerBuild);
if(!/addEventListener\(['"]activate['"]/.test(sw))bad("sw:activate","activate handler missing");else ok("sw:activate");
if(!/request\.method|e\.request\.method/.test(sw))bad("sw:get-guard","non-GET guard missing");else ok("sw:get-guard");
if(sw.includes("'./practice-complete-data.js'"))ok("sw:practice-complete-cache");else bad("sw:practice-complete-cache","practice-complete-data.js missing from cache");
if(sw.includes("'./practice-session-core.js'"))ok("sw:practice-core-cache");else bad("sw:practice-core-cache","practice-session-core.js missing from cache");
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

// 6b) Complete public Learning Hub coverage
try{
  const lctx=vm.createContext({window:{}});
  for(const p of ["past-papers-data.js","school-assessment-data.js","study-data.js","university-data.js","vu-course-catalog.js","practice-data.js","learning-premium-data.js","learning-complete-data.js","learning-required-data.js","practice-complete-data.js","practice-session-core.js","learning-search-engine.js"])evalBrowserFile(p,lctx);
  const w=lctx.window;
  const counts={
    boards:w.EDUNIZAM_PAST_PAPERS?.boards?.length||0,
    papers:w.EDUNIZAM_PAST_PAPERS?.papers?.length||0,
    grade:w.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources?.length||0,
    study:w.EDUNIZAM_STUDY_DATA?.materials?.length||0,
    universities:w.EDUNIZAM_UNIVERSITY_DATA?.universities?.length||0,
    universityResources:w.EDUNIZAM_UNIVERSITY_DATA?.resources?.length||0,
    vuCourses:w.EDUNIZAM_VU_COURSE_CATALOG?.courses?.length||0,
    practice:w.EDUNIZAM_PRACTICE_DATA?.questions?.length||0
  };
  const minimums={boards:30,papers:100,grade:20,study:35,universities:25,universityResources:55,vuCourses:250,practice:760};
  for(const [k,min] of Object.entries(minimums)){
    counts[k]>=min?ok("learning:coverage:"+k):bad("learning:coverage:"+k,counts[k]+" < "+min);
  }
  const questions=w.EDUNIZAM_PRACTICE_DATA?.questions||[];
  for(const cl of [9,10,11,12]){
    const subjects=new Set(questions.filter(x=>Number(x.classLevel)===cl).map(x=>x.subject));
    subjects.size>=9?ok("learning:practice-subjects:"+cl):bad("learning:practice-subjects:"+cl,subjects.size+" subjects");
  }
  for(const cl of [5,8]){
    const rows=questions.filter(x=>Number(x.classLevel)===cl);
    const subjects=new Set(rows.map(x=>x.subject));
    rows.length>=40&&subjects.size>=5?ok("learning:practice-primary:"+cl):bad("learning:practice-primary:"+cl,rows.length+" questions / "+subjects.size+" subjects");
  }
  const practiceDataAll=w.EDUNIZAM_PRACTICE_DATA||{};
  let incompletePractice=[];
  for(const [cl,subjects] of Object.entries(practiceDataAll.subjects||{})){
    for(const subject of subjects||[]){
      for(const chapter of practiceDataAll.chapters?.[cl+"|"+subject]||[]){
        const rows=questions.filter(x=>String(x.classLevel)===String(cl)&&x.subject===subject&&x.chapter===chapter);
        const matrixMissing=[];
        for(const type of ["mcq","short","long"])for(const diff of ["Easy","Medium","Hard"]){
          if(!rows.some(x=>x.type===type&&x.difficulty===diff))matrixMissing.push(type+"/"+diff);
        }
        if(rows.length<9||matrixMissing.length) incompletePractice.push(cl+"|"+subject+"|"+chapter+" ["+matrixMissing.join(",")+"]");
      }
    }
  }
  incompletePractice.length?bad("learning:practice-complete-coverage",incompletePractice.slice(0,8).join(", ")):ok("learning:practice-complete-coverage");
  const core=w.EDUNIZAM_PRACTICE_CORE;
  if(!core?.filterQuestions||!core?.selectSession||!core?.sessionStats||!core?.auditMatrix)bad("learning:practice-core","Practice core API missing");
  else{
    const matrix=core.auditMatrix(practiceDataAll);
    matrix.length?bad("learning:practice-core-matrix",matrix.slice(0,5).map(x=>JSON.stringify(x)).join(" | ")):ok("learning:practice-core-matrix");
    const generatedMcq=questions.filter(x=>String(x.id||"").startsWith("pc-")&&x.type==="mcq");
    const answerPositions=new Set(generatedMcq.map(x=>x.answer));
    answerPositions.size>=3?ok("learning:practice-answer-distribution"):bad("learning:practice-answer-distribution","only "+[...answerPositions].join(",")+" used");
    let comboFailures=[];
    for(const [cl,subjects] of Object.entries(practiceDataAll.subjects||{})){
      for(const subject of subjects||[]){
        for(const chapter of practiceDataAll.chapters?.[cl+"|"+subject]||[]){
          for(const type of ["mcq","short","long"])for(const difficulty of ["Easy","Medium","Hard"]){
            const rows=core.filterQuestions(questions,{classLevel:cl,subject,chapter,type,difficulty});
            if(!rows.length)comboFailures.push(cl+"|"+subject+"|"+chapter+"|"+type+"|"+difficulty);
          }
        }
      }
    }
    comboFailures.length?bad("learning:practice-filter-matrix",comboFailures.slice(0,5).join(", ")):ok("learning:practice-filter-matrix");
    const pool=core.filterQuestions(questions,{classLevel:"9",subject:"Mathematics"});
    const seq=core.selectSession(pool,{}, {order:"sequential",limit:"10"});
    const rnd=core.selectSession(pool,{}, {order:"random",limit:"10",random:()=>0.25});
    seq.length===Math.min(10,pool.length)?ok("learning:practice-limit"):bad("learning:practice-limit",seq.length+" rows");
    rnd.length===seq.length?ok("learning:practice-random-size"):bad("learning:practice-random-size",rnd.length+" != "+seq.length);
    const attempts=new Map();
    if(seq[0])attempts.set(seq[0].id,{kind:"mcq",correct:true});
    if(seq[1])attempts.set(seq[1].id,{kind:"written"});
    const stats=core.sessionStats(seq,attempts);
    stats.attempted===attempts.size&&stats.pending===Math.max(0,seq.length-attempts.size)&&stats.correct===1?ok("learning:practice-score-stats"):bad("learning:practice-score-stats",JSON.stringify(stats));
  }
  const search=w.EDUNIZAM_LEARNING_SEARCH;
  if(!search?.search||!search?.normalize)bad("learning:smart-search","search engine missing");
  else{
    const searchable=[];
    (w.EDUNIZAM_PAST_PAPERS?.papers||[]).forEach(x=>{const b=(w.EDUNIZAM_PAST_PAPERS?.boards||[]).find(y=>y.id===x.boardId);searchable.push({id:'paper:'+x.id,title:x.title,description:x.note,type:x.type==='past'?'Past Paper':x.type,board:b?.name||'',classLevel:x.classLevel,subject:x.subject,section:'past'})});
    (w.EDUNIZAM_UNIVERSITY_DATA?.resources||[]).filter(x=>x.universityId==='vu').forEach(x=>searchable.push({id:'vu:'+x.id,title:x.title,description:x.note,type:x.category,source:x.source,courseCodes:x.courseCodes||[],section:'vu'}));
    (w.EDUNIZAM_VU_COURSE_CATALOG?.courses||[]).forEach(x=>searchable.push({id:'course:'+x.code,title:x.code+' — '+x.title,type:'VU Course',source:'official',courseCodes:[x.code],section:'vu'}));
    const a=search.search(searchable,'10th class math Gujranwala board');
    const b=search.search(searchable,'Mth 603 quizzes');
    const ur=search.search(searchable,'دسویں جماعت ریاضی گوجرانوالہ');
    a.some(x=>String(x.title).includes('Gujranwala Class 10'))?ok("learning:search-natural"):bad("learning:search-natural","natural board query failed");
    b.some(x=>String(x.type).toLowerCase().includes('quiz'))?ok("learning:search-vu-type"):bad("learning:search-vu-type","spaced VU course + resource type failed");
    ur.some(x=>String(x.title).includes('Gujranwala Class 10'))?ok("learning:search-urdu"):bad("learning:search-urdu","Urdu board query failed");
  }
  const grade=w.EDUNIZAM_SCHOOL_ASSESSMENTS?.resources||[];
  const g5=new Set(grade.filter(x=>Number(x.grade)===5).flatMap(x=>String(x.subject||"").split("/").map(s=>s.trim())).filter(x=>x&&x!=="All Subjects"));
  const g8=new Set(grade.filter(x=>Number(x.grade)===8).flatMap(x=>String(x.subject||"").split("/").map(s=>s.trim())).filter(x=>x&&x!=="All Subjects"));
  g5.size>=5?ok("learning:g5-subjects"):bad("learning:g5-subjects",g5.size+" subjects");
  g8.size>=6?ok("learning:g8-subjects"):bad("learning:g8-subjects",g8.size+" subjects");
}catch(e){bad("learning:complete-data",e.message)}

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

const admissionsCloud=read("admissions-cloud.js");
const reliabilityGuardian=read("reliability-guardian.js");
const dataRuntime=read("data-runtime.js");
const mobileNavCore=read("mobile-nav-core.js");
const systemAuto=read("system-auto-update.js");
const loginSubmit=loginHtml.slice(loginHtml.indexOf("$('loginForm').onsubmit"),loginHtml.indexOf("$('signupForm').onsubmit"));

if(/auth\.getUser\s*\(/.test(admissionsCloud))bad("auth:no-startup-getuser","app runtime must not make a blocking getUser request during startup");
else ok("auth:no-startup-getuser");

if(!admissionsCloud.includes("sessionRestoreStatus:'pending'")||!admissionsCloud.includes("state.sessionRestoreStatus='error'"))bad("auth:restore-certainty","cloud client must distinguish missing session from transient restore failure");
else ok("auth:restore-certainty");

const repairCloudSnippet=reliabilityGuardian.slice(reliabilityGuardian.indexOf("async function repairCloudState"),reliabilityGuardian.indexOf("function report"));
if(/auth\.getSession\s*\(/.test(repairCloudSnippet))bad("auth:single-session-owner","Reliability Guardian must not independently restore/clear the Supabase session");
else ok("auth:single-session-owner");

if(!loginHtml.includes("global:{fetch:supabaseFetch}")||!loginHtml.includes("setTimeout(()=>controller.abort(),12000)"))bad("auth:bounded-login-network","Login Supabase requests are not bounded by a network deadline");
else ok("auth:bounded-login-network");

if(!admissionsCloud.includes("my_authorized_workspaces"))bad("auth:workspace-rpc","single authorized-workspaces RPC is missing from app auth");
else ok("auth:workspace-rpc");

if(/current_account_role/.test(loginSubmit))bad("auth:login-single-pass","normal login still performs duplicate current_account_role verification");
else ok("auth:login-single-pass");

if(!loginSubmit.includes("resolveInstitution")||!loginHtml.includes("my_authorized_workspaces"))bad("auth:login-workspace-resolution","login must resolve role + institution through authorized workspaces");
else ok("auth:login-workspace-resolution");

for(const state of ["BOOTING","UNAUTHENTICATED","AUTHENTICATING","AUTHENTICATED","AUTHORIZING","WORKSPACE_READY","BACKGROUND_SYNC","OFFLINE_READY","AUTH_ERROR"]){
  authBridge.includes(state)?ok("auth:state:"+state):bad("auth:state:"+state,"state missing");
}

if(/location\.reload\s*\(/.test(authBridge))bad("auth:no-auth-reload","auth runtime must not reload the page to complete login or sync");
else ok("auth:no-auth-reload");

if(!authBridge.includes("workspaceReady(readHandoff()?'login-handoff':'local-session'"))bad("auth:local-first-workspace","valid login handoff/local workspace must open before background verification");
else ok("auth:local-first-workspace");

if(!authBridge.includes("authoritativeAbsent=restoreStatus==='absent'||c.state.authEvent==='SIGNED_OUT'"))bad("auth:transient-restore-safe","temporary session-restore failures can still evict a valid local workspace");
else ok("auth:transient-restore-safe");

if(!authBridge.includes("if(runtimeState.verification)return runtimeState.verification"))bad("auth:verification-dedupe","concurrent workspace verification can create duplicate authorization requests");
else ok("auth:verification-dedupe");

if(!authBridge.includes("runtimeState.syncScheduled=false"))bad("sync:reconnect-reschedule","background sync cannot be scheduled again after reconnect");
else ok("sync:reconnect-reschedule");

if(!dataRuntime.includes("const inflight=new Map()")||!dataRuntime.includes("AbortController")||!dataRuntime.includes("transient(error)"))bad("fetch:runtime","bounded dedupe/timeout/retry runtime incomplete");
else ok("fetch:runtime");

if(!mobileNavCore.includes("menu.addEventListener('click'")||!mobileNavCore.includes("mobile-nav-lock"))bad("ui:mobile-menu-core","independent hamburger controller incomplete");
else ok("ui:mobile-menu-core");

const dataPos=html.indexOf('data-runtime.js');
const admissionsPos=html.indexOf('admissions-cloud.js');
const authPos=html.indexOf('auth-bridge.js');
if(dataPos<0||admissionsPos<0||authPos<0||!(dataPos<admissionsPos&&admissionsPos<authPos))bad("auth:script-order","data runtime -> cloud client -> auth state order is required");
else ok("auth:script-order");

if(/controllerchange[^\n]*controlledReload|EDUNIZAM_UPDATE_READY/.test(systemAuto))bad("sw:no-forced-auth-reload","service-worker updates must not force-reload an active auth flow");
else ok("sw:no-forced-auth-reload");

const roleAccessSource=read("role-access-center.js");
const academicAccessSource=read("academic-access.js");
if(/setTimeout\(refreshPendingBadge/.test(roleAccessSource)||/edunizam:auth[^\n]*refreshPendingBadge/.test(roleAccessSource)){
  bad("startup:no-access-fetch","Access approvals must not fetch during dashboard startup");
}else ok("startup:no-access-fetch");
if(/if\(r===['"]head['"]\)\{?\s*loadInstitutionAccounts\(\)/.test(roleAccessSource)){
  bad("startup:no-access-bulk-load","Access Center data must load only when the Access view is opened");
}else ok("startup:no-access-bulk-load");
if(/setTimeout\(boot,500\)/.test(academicAccessSource)||/function render\([\s\S]*loadNotifications\(\)/.test(academicAccessSource)){
  bad("startup:no-notification-fetch","Notifications/assignment data must not fetch during app boot");
}else ok("startup:no-notification-fetch");
if(!roleAccessSource.includes("edunizam:view-open")||!academicAccessSource.includes("edunizam:view-open")){
  bad("startup:view-lifecycle","On-demand access/academic loading must use the view lifecycle");
}else ok("startup:view-lifecycle");

const storyRule=loginHtml.match(/\.story\{[^}]*\}/)?.[0]||"";
if(/linear-gradient\(/.test(storyRule) && /edunizam-login-children\.webp/.test(storyRule)){
  bad("ui:children-image-overlay","children login image must not have a gradient overlay");
}else ok("ui:children-image-overlay");

console.log("EduNizam smoke checks:",pass.length,"passed,",fail.length,"failed");
for(const x of fail)console.error("FAIL",x.name,"-",x.msg);
if(fail.length)process.exit(1);
