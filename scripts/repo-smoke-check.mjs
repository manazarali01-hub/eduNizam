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

// 3c) Parent-student link lifecycle regression guards
const admissionsPortal=read("admissions-portal.js");
html.includes('id="parentStudentCode"')?ok("access:parent-link-student-code"):bad("access:parent-link-student-code","Admissions parent link must use Student Code.");
!html.includes('id="parentStudentUserId"')?ok("access:no-legacy-parent-uuid-input"):bad("access:no-legacy-parent-uuid-input","Legacy Student UUID parent-link input remains.");
admissionsPortal.includes("requestParentLinkByStudentCode(studentCode)")?ok("access:parent-link-current-rpc"):bad("access:parent-link-current-rpc","Parent link request must call the scoped Student Code RPC.");
!admissionsPortal.includes("requestParentStudentLink(id)")?ok("access:no-disabled-parent-link-call"):bad("access:no-disabled-parent-link-call","Disabled legacy parent-link call remains in Admissions portal.");
admissionsPortal.includes("x.parent_name||'Parent / Guardian'")&&admissionsPortal.includes("x.student_name||'Student'")?ok("access:parent-link-readable-admin-list"):bad("access:parent-link-readable-admin-list","Admin parent-link list must show readable parent/student names.");
const parentLinkMigration="supabase/migrations/20261006133812_parent_link_notifications.sql";
exists(parentLinkMigration)&&read(parentLinkMigration).includes("notify_parent_student_link_v1")?ok("access:parent-link-notifications"):bad("access:parent-link-notifications","Parent link notification migration missing.");

// 3d) Cloud communication regression guards
const communicationCenter=read("communication-center.js");
const communicationCloud=read("communication-cloud.js");
communicationCenter.includes("Meeting save failed: ")?ok("communication:cloud-save-authoritative"):bad("communication:cloud-save-authoritative","Cloud meeting failures must not persist local success.");
communicationCenter.includes("m.source==='cloud'&&String(m.institutionId||'')===inst")?ok("communication:participant-cloud-visibility"):bad("communication:participant-cloud-visibility","Participant meeting view must use the RLS-approved cloud snapshot.");
communicationCenter.includes("await api.updateStatus(id,status)")&&communicationCenter.includes("await api.remove(id)")?ok("communication:cloud-first-mutations"):bad("communication:cloud-first-mutations","Meeting update/delete must be cloud-first in Cloud Mode.");
communicationCloud.includes("No approved Parent account is linked to this student yet.")?ok("communication:parent-link-required"):bad("communication:parent-link-required","Head→Parent meeting must require an approved Parent link.");
communicationCloud.includes("institutionId:row.institution_id")?ok("communication:workspace-snapshot"):bad("communication:workspace-snapshot","Cloud meeting cache rows must carry institution identity.");
const communicationMigration="supabase/migrations/20261006135301_communication_meeting_notifications.sql";
exists(communicationMigration)&&read(communicationMigration).includes("notify_communication_meeting_v1")?ok("communication:meeting-notifications"):bad("communication:meeting-notifications","Meeting notification migration missing.");
const communicationScopeMigration="supabase/migrations/20261006135825_harden_head_parent_meeting_scope.sql";
exists(communicationScopeMigration)&&read(communicationScopeMigration).includes('heads create linked parent meetings')?ok("communication:head-parent-scope"):bad("communication:head-parent-scope","Head→Parent meeting INSERT policy must require an approved Parent-Student relationship.");
const communicationParticipantMigration="supabase/migrations/20261006140035_harden_communication_participant_scope.sql";
exists(communicationParticipantMigration)&&read(communicationParticipantMigration).includes("l.status='approved'")&&read(communicationParticipantMigration).includes('participant_user_id=(select auth.uid())')?ok("communication:parent-read-scope"):bad("communication:parent-read-scope","Parent meeting reads must re-check the current approved Parent-Student relationship.");

// 3e) Helpdesk + complaint privacy/reliability regression guards
const helpdeskCenter=read("helpdesk-center.js");
const parentComplaintCenter=read("parent-complaint-center.js");
helpdeskCenter.includes("const SIGNED_URL_TTL=600")&&helpdeskCenter.includes("createSignedUrl(a.storage_path,SIGNED_URL_TTL)")?ok("helpdesk:short-signed-media"):bad("helpdesk:short-signed-media","Helpdesk private media must use short-lived signed URLs.");
parentComplaintCenter.includes("const SIGNED_URL_TTL=600")&&parentComplaintCenter.match(/createSignedUrl\(a\.storage_path,SIGNED_URL_TTL\)/g)?.length>=2?ok("complaints:short-signed-media"):bad("complaints:short-signed-media","Private complaint media must use short-lived signed URLs.");
helpdeskCenter.includes("if(btn?.disabled)return;setBusy(btn,true,'Submitting...')")?ok("helpdesk:duplicate-submit-guard"):bad("helpdesk:duplicate-submit-guard","Helpdesk submit must lock while Cloud save is in flight.");
parentComplaintCenter.includes("if(btn?.disabled)return;setBusy(btn,true,'Sending...')")?ok("complaints:duplicate-submit-guard"):bad("complaints:duplicate-submit-guard","Private complaint sends must lock while Cloud save is in flight.");
parentComplaintCenter.includes("Private complaint save ho gayi, lekin kuch media upload nahi ho saka")?ok("complaints:partial-media-truthful"):bad("complaints:partial-media-truthful","Parent→Admin partial media failure must not misreport the saved complaint as failed.");
parentComplaintCenter.includes("Complaint save ho gayi, lekin kuch media upload nahi ho saka")?ok("complaints:student-parent-partial-media"):bad("complaints:student-parent-partial-media","School→Parent partial media failure must preserve the saved complaint and report media failure separately.");
const privateGrantMigration="supabase/migrations/20261006142313_revoke_anon_helpdesk_complaint_tables.sql";
exists(privateGrantMigration)&&read(privateGrantMigration).includes("from anon")?ok("complaints:no-anon-table-grants"):bad("complaints:no-anon-table-grants","Private helpdesk/complaint tables must revoke legacy anon table grants.");

// 3f) Fee/payment privacy and cloud-authoritative regression guards
const feeCenter=read("fee-center.js");
feeCenter.includes(".from('fee_records').insert(payload)")?ok("fees:create-insert-only"):bad("fees:create-insert-only","New fee challans must insert, not silently upsert/overwrite an existing month.");
!feeCenter.includes("Cloud sync unavailable; challan local mode mein save hoga")&&feeCenter.includes("Nothing was saved locally")?ok("fees:no-cloud-local-fallback"):bad("fees:no-cloud-local-fallback","Cloud Mode challan failures must not create local-only financial records.");
feeCenter.includes("recordPayment(id,btn)")&&feeCenter.includes("setBusy(btn,true,'Recording...')")?ok("fees:payment-double-submit-guard"):bad("fees:payment-double-submit-guard","Fee payment action must lock while Cloud RPC is in flight.");
feeCenter.includes("if(isHead())await pullClassFees()")&&feeCenter.includes("rows=cloudReady()?rows:visibleLocal(rows)")?ok("fees:rls-authoritative-view"):bad("fees:rls-authoritative-view","Cloud fee views must rely on RLS and class fee settings must remain Admin-only.");
const feeMigration="supabase/migrations/20261006144031_harden_fee_payment_workflows.sql";
exists(feeMigration)&&read(feeMigration).includes("fee_records_institution_student_month_key")?ok("fees:month-unique-constraint"):bad("fees:month-unique-constraint","Fee month conflict target must be backed by a real unique constraint.");
exists(feeMigration)&&read(feeMigration).includes("can_read_student_fee_v1")&&!read(feeMigration).includes("can_access_core_student(fee_records.student_id)")?ok("fees:no-teacher-financial-read"):bad("fees:no-teacher-financial-read","Fee read policy must exclude generic Teacher student access.");
exists(feeMigration)&&read(feeMigration).includes("notify_fee_payment_v1")?ok("fees:payment-notifications"):bad("fees:payment-notifications","Fee payment notification trigger missing.");
exists(feeMigration)&&read(feeMigration).includes("from anon")?ok("fees:no-anon-table-grants"):bad("fees:no-anon-table-grants","Fee/payment tables must revoke legacy anon privileges.");

// 3g) Results / exams / official report card regression guards
const appJs=read("app.js");
const coreCloud=read("core-cloud.js");
const examCenter=read("exam-center.js");
const resultCenter=read("result-center-deep.js");
appJs.includes("Cloud result save failed. Nothing was saved locally")&&appJs.indexOf("saveResultRecord(resultRecord)")<appJs.indexOf("state.results.push(resultRecord)")?ok("results:cloud-authoritative-save"):bad("results:cloud-authoritative-save","Cloud Mode result save must succeed before local result persistence.");
appJs.includes("same subject, assessment type aur date ka result already exists")?ok("results:local-duplicate-guard"):bad("results:local-duplicate-guard","Result entry must block duplicate subject/type/date rows.");
coreCloud.includes(".from('result_records')\n      .insert(payload)")?ok("results:insert-only"):bad("results:insert-only","New cloud results must insert rather than silently overwrite.");
examCenter.includes("teacherCanManageClassSection")&&examCenter.includes("Teacher sirf apni assigned class/section")?ok("exams:teacher-assignment-guard"):bad("exams:teacher-assignment-guard","Teacher exam scheduling must be limited to assigned class/section.");
examCenter.includes("Same class, section, exam, subject aur date ka schedule already exists")?ok("exams:duplicate-schedule-guard"):bad("exams:duplicate-schedule-guard","Exam schedule must block duplicate semantic entries.");
resultCenter.includes("acknowledgePublishedReport(id,btn)")&&resultCenter.includes("aria-busy")?ok("reports:ack-inflight-lock"):bad("reports:ack-inflight-lock","Report acknowledgement must lock while RPC is in flight.");
const resultMigration="supabase/migrations/20261006161532_harden_results_report_cards.sql";
exists(resultMigration)&&read(resultMigration).includes("result_records_semantic_unique_idx")?ok("results:semantic-unique-index"):bad("results:semantic-unique-index","Result semantic duplicate index missing.");
exists(resultMigration)&&read(resultMigration).includes("exam_schedule_semantic_unique_idx")&&read(resultMigration).includes("can_manage_exam_schedule_v1")?ok("exams:db-assignment-integrity"):bad("exams:db-assignment-integrity","Exam duplicate and assignment DB guards missing.");
exists(resultMigration)&&read(resultMigration).includes("publish_report_card_v2_impl")&&read(resultMigration).includes("revoke insert,update,delete on table public.report_card_publications from authenticated")?ok("reports:rpc-only-publication"):bad("reports:rpc-only-publication","Official report cards must be canonical RPC-only writes.");
exists(resultMigration)&&read(resultMigration).includes("acknowledge_report_card_v2_impl")&&read(resultMigration).includes("report_card_acknowledgements from authenticated")?ok("reports:rpc-only-ack"):bad("reports:rpc-only-ack","Report acknowledgements must use server-owned RPC timestamps.");
exists(resultMigration)&&read(resultMigration).includes("from anon")?ok("results:no-anon-table-grants"):bad("results:no-anon-table-grants","Result/exam/remark tables must revoke legacy anon privileges.");

// 3h) Guest Learning Hub action reliability guards
const guestPremium=read("guest-learning-premium.js");
guestPremium.includes("function ensurePremiumModal()")&&guestPremium.includes("function showPremiumModal(m)")?ok("guest:single-modal-lifecycle"):bad("guest:single-modal-lifecycle","Guest resource modal lifecycle helper missing.");
!guestPremium.includes("if(!m){openPreview('study:'+id)")?ok("guest:no-study-preview-recursion"):bad("guest:no-study-preview-recursion","Built-in Study Library Read Now can recurse through openPreview/openStudy.");
guestPremium.includes("data-print-study-id")&&guestPremium.includes("function printBuiltInStudy(id)")?ok("guest:study-print-resource-only"):bad("guest:study-print-resource-only","Built-in study printing must print the resource, not the entire Learning Hub.");
guestPremium.includes("Download / Open PDF")&&guestPremium.includes("data-print-url")?ok("guest:pdf-open-download-print-actions"):bad("guest:pdf-open-download-print-actions","PDF resources must expose explicit download/open and print routes.");
guestPremium.includes("frame.src='about:blank'")&&guestPremium.includes("m.setAttribute('aria-hidden','true')")?ok("guest:modal-clean-close"):bad("guest:modal-clean-close","Guest modal close must stop embedded previews and restore hidden state.");

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

if(!authBridge.includes("const handoff=readHandoff()")||!authBridge.includes("workspaceReady(handoff?'login-handoff':'local-session'"))bad("auth:local-first-workspace","valid login handoff/local workspace must open before background verification");
else ok("auth:local-first-workspace");

if(!authBridge.includes("authoritativeAbsent=restoreStatus==='absent'||c.state.authEvent==='SIGNED_OUT'"))bad("auth:transient-restore-safe","temporary session-restore failures can still evict a valid local workspace");
else ok("auth:transient-restore-safe");

if(!authBridge.includes("if(runtimeState.verification||runtimeState.verificationTimer)return true")||!authBridge.includes("function scheduleWorkspaceVerification"))bad("auth:verification-dedupe","workspace verification scheduling/dedupe is incomplete");
else ok("auth:verification-dedupe");

if(authBridge.includes("window.EDUNIZAM_CORE_CLOUD.pullAllCloudToLocal(false)"))bad("startup:no-bulk-core-pull","auth startup must not hydrate all school tables");
else ok("startup:no-bulk-core-pull");

if(!read("app.js").includes("edunizam:view-open"))bad("startup:view-open-event","main navigation does not emit the on-demand view lifecycle");
else ok("startup:view-open-event");

const uiPolishSource=read("ui-polish.js");
const navEnhSource=read("navigation-enhancements.js");
if(/menu\.onclick|backdrop\.onclick|classList\.toggle\(['\"]mobile-nav-open/.test(uiPolishSource))bad("ui:single-mobile-nav-owner","ui-polish still owns mobile drawer state");
else ok("ui:single-mobile-nav-owner");
if(navEnhSource.includes("mobile-nav-lock")||navEnhSource.includes("eduMobileNavBackdrop"))bad("ui:nav-enhancement-owner","navigation enhancements still mutate mobile drawer state directly");
else ok("ui:nav-enhancement-owner");

if(!authBridge.includes("runtimeState.syncScheduled=false"))bad("sync:reconnect-reschedule","background sync cannot be scheduled again after reconnect");
else ok("sync:reconnect-reschedule");

const startupAppSource=read("app.js");
const coreCloudRuntimeSource=read("core-cloud.js");
if(!startupAppSource.includes("if($('attendance')?.classList.contains('active'))renderAttendanceAudit()"))bad("startup:no-hidden-attendance-audit","Attendance audit can still fetch while its view is closed");
else ok("startup:no-hidden-attendance-audit");
if(!coreCloudRuntimeSource.includes("attendance-audit:'+cfg.institutionId+':'+date+':'+key")||!coreCloudRuntimeSource.includes("abortSignal(signal)")||!coreCloudRuntimeSource.includes("timeout:7000,retries:1"))bad("fetch:attendance-audit-runtime","Attendance audit queries are not bounded/abortable/deduped");
else ok("fetch:attendance-audit-runtime");

if(!dataRuntime.includes("const inflight=new Map()")||!dataRuntime.includes("AbortController")||!dataRuntime.includes("transient(error)"))bad("fetch:runtime","bounded dedupe/timeout/retry runtime incomplete");
else ok("fetch:runtime");

if(!mobileNavCore.includes("menu.addEventListener('click'")||!mobileNavCore.includes("mobile-nav-lock")||!mobileNavCore.includes("backdrop.style.pointerEvents=shouldOpen?'auto':'none'"))bad("ui:mobile-menu-core","independent hamburger controller incomplete");
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
