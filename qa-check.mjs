import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const fail=[];
const ok=[];

const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const index=read('app.html');
const app=read('app.js');
const feature=read('feature-loader.js');
const visual=read('edunizam-visual-system.css');
const htmlFiles=fs.readdirSync(root).filter(f=>f.endsWith('.html'));

// SEO / indexing / AdSense invariants from the production contract.
const sitemap=read('sitemap.xml');
const robotsTxt=read('robots.txt');
const adsTxt=read('ads.txt').trim();
const sitemapUrls=[...sitemap.matchAll(/<loc>(https:\/\/edunizam\.online\/[^<]*)<\/loc>/g)].map(m=>m[1]);
for(const url of sitemapUrls){
  const pathName=new URL(url).pathname;
  const localFile=pathName==='/'?'index.html':pathName.replace(/^\//,'');
  if(!exists(localFile)) fail.push('Sitemap URL has no matching repository file: '+url);
  if(['login.html','app.html','admission.html','404.html'].includes(localFile)) fail.push('Private/noindex page leaked into sitemap: '+localFile);
  const html=exists(localFile)?read(localFile):'';
  if(html&&!/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*index,follow/i.test(html)) fail.push('Sitemap page is not explicitly indexable: '+localFile);
  if(html&&!html.includes('rel="canonical"')) fail.push('Sitemap page has no canonical URL: '+localFile);
}
for(const privatePage of ['login.html','app.html','admission.html','404.html']){
  const html=read(privatePage);
  if(!/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) fail.push('Private page lost noindex: '+privatePage);
}
if(!robotsTxt.includes('User-agent: *')||!robotsTxt.includes('Allow: /')||!robotsTxt.includes('Sitemap: https://edunizam.online/sitemap.xml')) fail.push('robots.txt production crawl contract changed.');
if(adsTxt!=='google.com, pub-4531216214099892, DIRECT, f08c47fec0942fa0') fail.push('ads.txt publisher declaration changed.');
for(const page of ['index.html','features.html','online-school-admissions.html','school-management-system-pakistan.html','learning-resources-pakistan.html','about.html','privacy.html','learn.html']){
  const html=read(page);
  if(!html.includes('ca-pub-4531216214099892')) fail.push('AdSense publisher script missing from '+page);
}

const premiumVisualHref=/edunizam-visual-system\.css\?v=[A-Za-z0-9._-]+/;
for(const file of htmlFiles){
  if(!premiumVisualHref.test(read(file))) fail.push('Premium visual system missing from '+file);
}
for(const marker of [
  '--en-body-size:17px',
  '--en-content:1420px',
  '--en-sidebar:288px',
  '.app-page .nav-item',
  '.auth-page .role',
  '.learning-sky .hero h1',
  '@media(max-width:720px)'
]){
  if(!visual.includes(marker)) fail.push('Premium visual marker missing: '+marker);
}
if(/transform\s*:\s*scale\(/i.test(visual)) fail.push('Premium visual system must not fake zoom with transform: scale().');
for(const file of htmlFiles){
  if(!/<body[^>]*class=["'][^"']*\bpage-[^"']*["']/i.test(read(file))) fail.push('Individual page identity missing from '+file);
}
for(const marker of [
  'Individual page polish / background imagery',
  'url("assets/edunizam-login-children.webp")',
  'url("assets/edunizam-girl-hero.webp")',
  '.page-app #dashboard .campus-hero',
  '.page-learning .hero-card',
  '.page-admission .shell>section.card:first-of-type'
]){
  if(!visual.includes(marker)) fail.push('Individual page/background polish marker missing: '+marker);
}
const appViewIds=[...index.matchAll(/<section\s+id=["']([^"']+)["']\s+class=["'][^"']*\bview\b[^"']*["']/g)].map(m=>m[1]);
for(const id of appViewIds){
  if(!visual.includes('#'+id)) fail.push('Protected app view lacks individual visual treatment: '+id);
}
for(const marker of [
  'FINAL VISUAL POLISH 2026-10-05',
  '.page-login .mobile-brand',
  '.page-home .hero-image-wrap img',
  '.page-app .view.active>.section-head:first-child',
  '.page-learning .paper-actions .btn',
  'MOBILE CONTAINER / OVERLAY STABILITY 2026-10-05',
  '.page-app .topbar-title h1',
  '.page-app .row>*'
]){
  if(!visual.includes(marker)) fail.push('Final visual polish marker missing: '+marker);
}
const authBridgeMobileFix=read('auth-bridge.js');
const cloudSetupMobileFix=read('cloud-setup.js');
const loginHtml=read('login.html');
if(!authBridgeMobileFix.includes('Retry secure check')) fail.push('Secure-session Retry action is not explicit.');
if(!authBridgeMobileFix.includes('<a id="cloudAuthLogin"')||!authBridgeMobileFix.includes('href="login.html?from=secure-guard"')) fail.push('Secure-session Login action is not a native link.');
if(!authBridgeMobileFix.includes('<a id="cloudAuthGuest"')||!authBridgeMobileFix.includes('href="learn.html?from=secure-guard"')) fail.push('Secure-session Guest action is not a native link.');
if(authBridgeMobileFix.includes('navigateAuthTarget(')) fail.push('Secure-session navigation still depends on a JavaScript-only redirect helper.');
if(!authBridgeMobileFix.includes('pointer-events:auto!important')) fail.push('Secure-session mobile tap target hardening is missing.');
if(loginHtml.includes("register_simple_account_v1")) fail.push('Legacy direct-role registration RPC is still reachable from login.');
if(authBridgeMobileFix.includes('clearLocalAuthState();\n        window.dispatchEvent(new CustomEvent(role===\'head_of_institute\'')) fail.push('Admin Retry still clears the selected local session before retrying.');
if(!cloudSetupMobileFix.includes('if(owner.error)throw owner.error')) fail.push('Institution lookup errors are still swallowed before Admin Retry.');
if(loginHtml.includes('manazarali01-hub.github.io/eduNizam/login.html')) fail.push('Login auth redirects still leave the production custom domain.');
if(read('admissions-cloud.js').includes('manazarali01-hub.github.io/eduNizam/login.html')) fail.push('Admission auth redirects still leave the production custom domain.');
const admissionHtml=read('admission.html');
if(admissionHtml.includes("body+'<script src=\"system-auto-update.js")) fail.push('Admission printable markup still embeds a literal script closing tag inside inline JavaScript.');
if(!admissionHtml.includes('system-auto-update.js?v=20261005-auth-tap629')) fail.push('Admission page runtime updater is not loaded as a page-level script.');
const aiEdge=read('supabase/functions/ai-assistant/index.ts');
if(!aiEdge.includes('https://edunizam.online')) fail.push('AI Edge Function does not allow the production custom domain.');
if(!aiEdge.includes('supabaseUser.auth.getUser()')) fail.push('AI Edge Function does not verify the authenticated user.');
const cloudConfig=read('cloud-config.js');
if(!cloudConfig.includes('paymentApiBaseUrl:""')) fail.push('Live payment API must stay disabled until a verified provider adapter is configured.');
const paymentEdge=read('supabase/functions/admissions-payments/index.ts');
if(!paymentEdge.includes('verify provider signature BEFORE parsing/updating')) fail.push('Payment Edge Function lost the provider-signature safety guard.');
if(loginHtml.includes("mode==='recovery'?'Retry'")) fail.push('Login recovery cooldown still presents a dead Retry label.');
if(loginHtml.includes("sw.js?v=20261001-visitor202")) fail.push('Login still registers the obsolete service-worker build.');
if(!app.includes("classList?.contains('feature-loading-notice')")) fail.push('Feature Retry does not clear stale loader/error notices before retrying.');
if(!app.includes("retryBtn.textContent='Retrying…'")) fail.push('Feature Retry button does not expose an active retry state.');

const systemAutoUpdateSafety=read('system-auto-update.js');
const reliabilitySafety=read('reliability-guardian.js');
if(systemAutoUpdateSafety.includes("querySelectorAll('button[disabled]')")) fail.push('System auto-update still globally re-enables disabled controls.');
if(!reliabilitySafety.includes('[data-recovery-safe="true"][disabled]')) fail.push('Reliability control recovery is not explicitly scoped.');
if(/querySelectorAll\(['"]button\[disabled\]['"]\)/.test(reliabilitySafety)) fail.push('Reliability Guardian still scans every disabled button.');

for(const page of ['index.html','login.html','app.html','learn.html','admission.html','about.html','features.html','learning-resources-pakistan.html','online-school-admissions.html','privacy.html','school-management-system-pakistan.html']){
  const html=read(page);
  for(const ref of [...html.matchAll(/(?:pwa-install|system-auto-update)\.js\?v=([A-Za-z0-9._-]+)/g)].map(m=>m[1])){
    if(ref!=='20261005-auth-tap629') fail.push('Stale runtime cache-busting token on '+page+': '+ref);
  }
}
const appExternalScriptTags=[...index.matchAll(/<script[^>]+src=["'][^"']+["'][^>]*>/g)].map(m=>m[0]);
for(const tag of appExternalScriptTags){
  if(!/\bdefer\b/i.test(tag)) fail.push('App startup script is parser-blocking instead of deferred: '+tag);
}
for(const marker of [
  "pastpapers:['learningCore','pastpapersDeep']",
  "practice:['learningCore','practiceDeep']",
  "universities:['learningCore','universityDeep']",
  "vu:['learningCore','vuDeep']",
  "competitive:['competitiveDeep']",
  "ecosystem:['ecosystemDeep']",
  "pathways:['pathwayDeep']"
]){
  if(!feature.includes(marker)) fail.push('Section-specific lazy-loading marker missing: '+marker);
}
if(/const sharedBundles=\{\s*learning:\[/m.test(feature)) fail.push('Learning Hub reverted to one catch-all sequential bundle.');

const scriptRefs=[...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
  .map(m=>m[1].split('?')[0])
  .filter(x=>!/^https?:/i.test(x));
const cssRefs=[...index.matchAll(/<link[^>]+href=["']([^"']+\.css(?:\?[^"']*)?)["']/g)]
  .map(m=>m[1].split('?')[0]);
const dynamicRefs=[...feature.matchAll(/['"]([^'"]+\.js)['"]/g)]
  .map(m=>m[1])
  .filter(x=>!/^https?:/i.test(x));

const appBootstrap=read('app.html');
for(const heavy of ['past-papers-data.js','practice-data.js','university-data.js','vu-material-library.js','practice-depth-data.js']){
  if(appBootstrap.includes('<script src="'+heavy)) fail.push('Heavy learning catalog still blocks authenticated bootstrap: '+heavy);
}
for(const marker of ["const sharedBundles={","schoolassessments:['education-hubs.js']","admissions:['admissions-data.js','admissions-selection.js','admissions-portal.js']","for(const src of list)await loadScript(src)"]){
  if(!feature.includes(marker)) fail.push('Lazy feature-loader marker missing: '+marker);
}

for(const file of [...new Set([...scriptRefs,...cssRefs,...dynamicRefs])]){
  if(!exists(file)) fail.push('Missing referenced file: '+file);
}

const jsFiles=fs.readdirSync(root).filter(f=>f.endsWith('.js'));
for(const file of jsFiles){
  try{ new Function(read(file)); ok.push('Syntax '+file); }
  catch(e){ fail.push('JavaScript syntax error in '+file+': '+e.message); }
}

// Inline executable scripts need the same syntax protection; JSON-LD and external src tags are excluded.
for(const file of htmlFiles){
  const html=read(file);
  const blocks=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  blocks.forEach((m,index)=>{
    const attrs=m[1]||'';
    if(/\bsrc\s*=/.test(attrs))return;
    const type=(attrs.match(/\btype=["']([^"']+)["']/i)||[])[1]||'';
    if(type&&type!=='text/javascript'&&type!=='application/javascript'&&type!=='module')return;
    if(type==='module'&&/\b(?:import|export)\b/.test(m[2]))return;
    try{ new Function(m[2]); ok.push('Inline syntax '+file+' #'+(index+1)); }
    catch(e){ fail.push('Inline JavaScript syntax error in '+file+' #'+(index+1)+': '+e.message); }
  });
}

const ids=[...index.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const seen=new Set();
for(const id of ids){
  if(seen.has(id)) fail.push('Duplicate HTML id: '+id);
  seen.add(id);
}

const hardHandlers=[...app.matchAll(/\$\(['"]([^'"]+)['"]\)\.(?:onclick|onchange|oninput|innerHTML|textContent|value|classList|style)/g)].map(m=>m[1]);
for(const id of new Set(hardHandlers)){
  if(!seen.has(id)) fail.push('app.js references missing HTML id: '+id);
}

const navTargets=[...index.matchAll(/\bdata-view=["']([^"']+)["']/g)].map(m=>m[1]);
for(const view of new Set(navTargets)){
  if(!seen.has(view)) fail.push('Navigation points to missing section: '+view);
}
const jumpTargets=[...index.matchAll(/\bdata-jump=["']([^"']+)["']/g)].map(m=>m[1]);
for(const view of new Set(jumpTargets)){
  if(!seen.has(view)) fail.push('Shortcut points to missing section: '+view);
}
const roleViewTargets=[...app.matchAll(/(?:student|parent|teacher|head):\[([^\n]+)\]/g)]
  .flatMap(m=>[...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x=>x[1]));
const runtimeRoleViews={
  communication:{file:'communication-center.js',pattern:/sec\.id=['"]communication['"]/},
  access:{file:'role-access-center.js',pattern:/sec\.id=['"]access['"]/},
  notifications:{file:'academic-access.js',pattern:/sec\.id=['"]notifications['"]/}
};
for(const view of new Set(roleViewTargets)){
  if(seen.has(view)) continue;
  const runtime=runtimeRoleViews[view];
  if(!runtime||!exists(runtime.file)||!runtime.pattern.test(read(runtime.file))){
    fail.push('Role access points to missing section: '+view);
  }else{
    ok.push('Runtime section '+view+' injected by '+runtime.file);
  }
}

const cloudPos=scriptRefs.indexOf('cloud-config.js');
const scopePos=scriptRefs.indexOf('storage-scope.js');
const guardianPos=scriptRefs.indexOf('reliability-guardian.js');
const featurePos=scriptRefs.indexOf('feature-loader.js');
const appPos=scriptRefs.indexOf('app.js');
if(cloudPos<0||scopePos<0||guardianPos<0||featurePos<0||appPos<0) fail.push('Critical startup scripts missing.');
else if(!(cloudPos<scopePos&&scopePos<guardianPos&&guardianPos<featurePos&&featurePos<appPos)) fail.push('Critical script order must be cloud-config -> storage-scope -> reliability guardian -> feature loader -> app.js');

for(const required of [
  'login.html','cloud-config.js','storage-scope.js','cloud-setup.js','core-cloud.js',
  'auth-bridge.js','account-security.js','role-access-center.js','role-scope.js',
  'backend-health.js','reliability-guardian.js','mobile-performance.css','sw.js'
]){
  if(!exists(required)) fail.push('Missing core file: '+required);
}

if(!app.includes('window.editStudent=')) fail.push('Student Edit handler missing.');
if(!app.includes("window.EDUNIZAM_CORE_CLOUD?.ready?.()")) fail.push('Student cloud sync guard missing.');
if(!app.includes('deleteStudentByLocalId')) fail.push('Student delete is not synchronized with cloud.');
if(!read('core-cloud.js').includes('deleteStudentByLocalId')) fail.push('Cloud student delete handler missing.');
if(!read('core-cloud.js').includes("rpc('delete_core_student_v1'")) fail.push('Student delete does not use the atomic access-cleanup RPC.');
if(!fs.existsSync(path.join(root,'supabase-atomic-student-delete.sql'))) fail.push('Atomic student-delete backend SQL is missing from the repository.');
if(!read('cloud-setup.js').includes('create_owned_institution_v2')) fail.push('Multi-school creation UI missing.');
if(!read('storage-scope.js').includes('edunizam_school:')) fail.push('Per-school browser storage isolation missing.');
if(!read('sw.js').includes("'./storage-scope.js'")) fail.push('PWA cache does not include storage isolation script.');
if(!read('sw.js').includes("'./reliability-guardian.js'")) fail.push('PWA cache does not include Reliability Guardian.');
if(!read('sw.js').includes("'./mobile-performance.css'")) fail.push('PWA cache does not include mobile performance styles.');
if(!index.includes('mobile-performance.css')) fail.push('Mobile performance stylesheet is not loaded.');
if(!exists('premium-ui.css')) fail.push('Premium visual system stylesheet missing.');
if(!exists('premium-ui.js')) fail.push('Premium interaction shell missing.');
if(!exists('premium-auth.css')) fail.push('Premium auth/admission stylesheet missing.');
if(!index.includes('premium-ui.css')) fail.push('Premium visual system is not loaded.');
if(!index.includes('premium-ui.js')) fail.push('Premium interaction shell is not loaded.');
if(!read('login.html').includes('premium-auth.css')) fail.push('Premium auth styling is not loaded on login.');
if(!read('admission.html').includes('premium-auth.css')) fail.push('Premium admission styling is not loaded.');
if(!read('premium-ui.js').includes('premium-mobile-dock')) fail.push('Premium mobile quick navigation missing.');
if(!read('premium-ui.js').includes('Cloud Connected')) fail.push('Premium cloud/network context is missing.');
if(!read('premium-ui.css').includes('.premium-context-chip')) fail.push('Premium topbar context styling missing.');
if(!read('premium-ui.css').includes('.premium-mobile-dock')) fail.push('Premium mobile dock styling missing.');
if(!read('sw.js').includes("'./premium-ui.css'")||!read('sw.js').includes("'./premium-ui.js'")||!read('sw.js').includes("'./premium-auth.css'")) fail.push('PWA cache does not include premium UI assets.');
if(!exists('assets/edunizam-premium-mark.svg')) fail.push('Premium EduNizam brand mark missing.');
else{
  const premiumMark=read('assets/edunizam-premium-mark.svg');
  if(!premiumMark.includes('#D7AA4A')&&!premiumMark.includes('#D9AE55')) fail.push('Premium brand mark has no restrained gold accent.');
}
if(!index.includes('assets/edunizam-premium-mark.svg')) fail.push('Main app does not use premium brand mark.');
if(!read('login.html').includes('assets/edunizam-premium-mark.svg')) fail.push('Login does not use premium brand mark.');
if(!read('admission.html').includes('assets/edunizam-premium-mark.svg')) fail.push('Admission portal does not use premium brand mark.');

if(!exists('edunizam-brand-refresh.css')) fail.push('Canonical EduNizam design-token stylesheet missing.');
else{
  const design=read('edunizam-brand-refresh.css');
  for(const marker of [
    '--en-navy-900:#102a43',
    '--en-blue-600:#1769aa',
    '--en-blue-500:#2f80ed',
    '--en-sky-500:#5bb8f6',
    '--en-gold-500:#d6a94d',
    '--en-font-sans:',
    '--en-radius-lg:',
    '--en-shadow-md:',
    '--en-normal:'
  ]){
    if(!design.includes(marker)) fail.push('Canonical design token missing: '+marker);
  }
  const designRootCount=(design.match(/:root\s*\{/g)||[]).length;
  if(designRootCount<1||designRootCount>2) fail.push('Canonical design-token stylesheet has unexpected root token blocks: '+designRootCount);
}

for(const page of ['index.html','login.html','app.html','learn.html','admission.html']){
  if(!read(page).includes('edunizam-brand-refresh.css')) fail.push('Canonical design tokens are not loaded on '+page+'.');
}
if(!read('home-gold.css').includes('EduNizam homepage · premium product showcase')) fail.push('Canonical premium homepage layer missing.');
if(!read('home-gold.css').includes('.gold-home .public-hero.premium-public-hero')) fail.push('Premium homepage hero styling missing.');
if(!read('index.html').includes('assets/edunizam-login-children.webp')) fail.push('Homepage student visual missing.');

const premiumUi=read('premium-ui.css');
if(!premiumUi.includes('Canonical Premium Workspace')) fail.push('Canonical premium workspace layer missing.');
if(!premiumUi.includes('body.app-page')) fail.push('Premium workspace styling is not scoped to app page.');
if(!premiumUi.includes('.premium-nav-icon')) fail.push('Premium sidebar icon styling missing.');
if(!premiumUi.includes('.premium-mobile-dock')) fail.push('Premium mobile dock styling missing.');
if(!premiumUi.includes('Mobile drawer reliability')) fail.push('Premium mobile drawer reliability layer missing.');
if(!premiumUi.includes('.workspace-switch-modal')) fail.push('Premium workspace switcher styling missing.');
if(!premiumUi.includes('.pb-print-sheet')) fail.push('Smart Paper Builder print styling missing.');
const premiumImportantCount=(premiumUi.match(/!important/g)||[]).length;
if(premiumImportantCount>20) fail.push('Premium workspace override debt is too high: '+premiumImportantCount+' !important rules.');

const premiumAuth=read('premium-auth.css');
if(!premiumAuth.includes('EduNizam authentication + admission visual layer')) fail.push('Canonical premium auth layer missing.');
if(!premiumAuth.includes('.auth-page .story')) fail.push('Premium login split-story treatment missing.');
if(!premiumAuth.includes('edunizam-login-children.webp')) fail.push('Login education background image missing.');
if(!premiumAuth.includes('.auth-page .brand-i:after')) fail.push('Golden EduNizam i-dot treatment missing.');
if(!premiumAuth.includes('body.admission-premium')) fail.push('Admission portal is not covered by the premium auth design system.');

const learningUi=read('learning-sky.css');
if(!learningUi.includes('premium student-first layer')) fail.push('Canonical Learning Hub premium layer missing.');
if(!learningUi.includes('body.learning-sky')) fail.push('Learning Hub styling is not scoped.');
if(!learningUi.includes('.learning-sky .searchbox:focus-within')) fail.push('Learning Hub search-first focus treatment missing.');

if(!read('premium-ui.js').includes('premiumizeNavIcons')) fail.push('Premium sidebar line-icon normalization missing.');
if(!read('premium-ui.js').includes('iconSvg')) fail.push('Premium navigation SVG icon system missing.');
if(!read('login.html').includes('<svg viewBox="0 0 24 24"')) fail.push('Login role cards still lack premium line icons.');

if(!read('sw.js').includes("'./assets/edunizam-premium-mark.svg'")) fail.push('PWA cache does not include premium brand mark.');
if(!read('sw.js').includes("'./edunizam-brand-refresh.css'")) fail.push('PWA cache does not include canonical design tokens.');
const manifest=JSON.parse(read('manifest.webmanifest'));
if(manifest.theme_color!=='#1769AA') fail.push('PWA theme color is not canonical EduNizam blue.');
if(manifest.background_color!=='#F4F9FD') fail.push('PWA background color is not canonical cool off-white.');


const reliability=read('reliability-guardian.js');
if(!reliability.includes('Main Thread Stall')) fail.push('Hang watchdog is missing.');
if(!reliability.includes('function criticalCheck()')) fail.push('Automatic critical UI recovery is missing.');
if(!reliability.includes('async function withRetry')) fail.push('Automatic retry engine is missing.');
if(!feature.includes('Feature script timed out')) fail.push('Feature loader timeout protection is missing.');
if(!feature.includes('repairUI')) fail.push('Feature loader does not call Auto-Recovery after failure.');
const login=read('login.html');
const roleScope=read('role-scope.js');
if(!login.includes("role==='admin'?'head':role")) fail.push('Admin login role is not normalized to Head permissions.');
if(!app.includes("return r==='admin'?'head':r")) fail.push('Legacy Admin sessions are not normalized in app permissions.');
if(!app.includes("canManage=currentRole()==='head'")) fail.push('Student management permission does not use normalized app role.');
for(const id of ['studentBForm','guardianCnic','studentDob','admissionNo','studentAddress','guardianOccupation','studentCaste']){
  if(!index.includes('id="'+id+'"')) fail.push('Optional student field missing: '+id);
}
if(!app.includes("bFormNo:$('studentBForm')")) fail.push('Optional student profile fields are not saved locally.');
if(!read('core-cloud.js').includes('b_form_no:s.bFormNo||null')) fail.push('Optional student profile fields are not synced to cloud.');
const coreCloud=read('core-cloud.js');
if(!/function studentMap\(\)[\s\S]*?from\('core_students'\)[\s\S]*?eq\('institution_id',cfg\.institutionId\)/.test(coreCloud)) fail.push('Student cloud map is not scoped to the active institution.');
if(!/rpc\('delete_core_student_v1'[\s\S]*?p_institution_id:cfg\.institutionId/.test(coreCloud)) fail.push('Atomic student delete is not scoped to the active institution.');
if(!roleScope.includes("r==='admin'?'head':r")) fail.push('Role scope does not normalize legacy Admin sessions.');
if(!roleScope.includes('teacherClassSections')) fail.push('Teacher role scope does not include class-teacher sections.');
if(!roleScope.includes(".from('class_sections')")) fail.push('Teacher role scope does not refresh class-teacher assignments from cloud.');
const classTeacherCoreScope='supabase/migrations/20261005061500_class_teacher_core_student_scope.sql';
if(!exists(classTeacherCoreScope)) fail.push('Class-teacher core student scope migration missing.');
else{
  const classTeacherCore=read(classTeacherCoreScope);
  if(!classTeacherCore.includes('can_access_core_student_v2')||!classTeacherCore.includes('can_manage_core_student_v1')) fail.push('Class-teacher core access helpers are not both hardened.');
  if(!classTeacherCore.includes("m.role='teacher'")) fail.push('Class-teacher core access does not require active Teacher membership.');
  if(!classTeacherCore.includes('class_teacher_user_id=p_user_id')) fail.push('Class-teacher core access is not bound to the assigned class teacher.');
}
if(!/teacher:\[[^\n]*'paperbuilder'[^\n]*'dailydiary'/.test(app)) fail.push('Teacher early role gate is missing Paper Builder or Daily Diary.');
if(!/student:\[[^\n]*'dailydiary'/.test(app)||!/parent:\[[^\n]*'dailydiary'/.test(app)) fail.push('Student/Parent early role gate is missing Daily Diary.');
if(!login.includes("institutionId:inst?.id||''")) fail.push('Login does not persist selected institution ID.');
if(!login.includes("edunizam_school:'+inst.id+':edunizam_settings")) fail.push('Login does not seed selected school workspace identity.');
const authBridge=read('auth-bridge.js');
if(!authBridge.includes("existing?.institutionId||runtime.institutionId")) fail.push('Cloud role sync can overwrite selected institute session.');
const cloudSetup=read('cloud-setup.js');
if(!cloudSetup.includes("const selectedId=session?.institutionId||current.institutionId||''")) fail.push('Startup does not prioritize login-selected institute.');
if(!cloudSetup.includes("session.institutionId=inst.id")) fail.push('Manual institute switching does not update session lock.');
if(!login.includes("addSchoolToExistingAdmin")) fail.push('Existing Admin email cannot add a second school during signup.');
if(!login.includes("create_owned_institution_v2")) fail.push('Multi-school signup RPC is missing.');
if(!app.includes("b.onclick=async()=>")) fail.push('Quick actions do not await view navigation.');
if(!app.includes("if(targetView==='students')openStudentForm()")) fail.push('Student quick action does not reliably open the form.');
if(!login.includes('id="roleGuidance"')) fail.push('Role-specific same-school login guidance missing.');
if(!login.includes("if(role!=='admin'&&!inst)")) fail.push('Non-Admin roles can open without a linked school.');
if(!login.includes('chooseOwnedInstitution')) fail.push('Duplicate-name Admin schools do not have an explicit login picker.');
if(!login.includes('registration_number,school_registration_code')) fail.push('Duplicate-school picker lacks disambiguating school data.');
if(!login.includes("Waiting for School Admin approval.")) fail.push('Pending-approval login guidance missing.');
if(!login.includes('id="memberSchoolField"')) fail.push('School search field missing.');
if(!login.includes("search_school_directory_v1")) fail.push('School search RPC missing from login.');
if(!login.includes('id="memberSchoolDropdown"')) fail.push('School dropdown missing for Teacher/Parent/Student access.');
if(!login.includes("list_school_directory_v1")) fail.push('School dropdown directory RPC missing from login.');
if(!login.includes("selectedSchoolId")) fail.push('Member login does not verify a selected school.');
if(!login.includes("requestedInstitutionId")) fail.push('Login cannot lock member access to selected school ID.');
if(!login.includes("selectedInstitutionId=localPending?.institutionId||meta.selected_school_id||''")) fail.push('Signup completion is not locked to the selected school request.');
const authBridgeE2E=read('auth-bridge.js');
if(!authBridgeE2E.includes('refreshScopedRoleCache')) fail.push('Role-scoped cache refresh missing after member login.');
if(!authBridgeE2E.includes('pullAllCloudToLocal')) fail.push('Member login does not reload RLS-filtered cloud data.');
if(!authBridgeE2E.includes("location.reload()")) fail.push('Shared-device stale in-memory data reload guard missing.');
const admissionsSecurityMigration='supabase/migrations/20260926052611_harden_admissions_applicant_admin_boundaries.sql';
if(!exists(admissionsSecurityMigration)) fail.push('Admissions applicant/Admin boundary migration missing.');
else{
  const admSec=read(admissionsSecurityMigration);
  if(!admSec.includes('applicant insert safe application')) fail.push('Applicant safe-insert policy missing.');
  if(!admSec.includes("status='Draft'")) fail.push('Applicant draft update boundary missing.');
  if(!admSec.includes('heads update applications')) fail.push('Admin application decision policy missing.');
  if(!admSec.includes('application owner or head read admission documents')) fail.push('Admission document privacy policy missing.');
  if(!admSec.includes('applicant safe payment record')) fail.push('Applicant payment-verification boundary missing.');
  if(admSec.includes('is_institution_staff(a.institution_id)')) fail.push('Admissions migration still grants Teacher/staff admission PII access.');
}
const auditSecurityMigration='supabase/migrations/20260926052724_restrict_audit_logs_to_school_admin.sql';
if(!exists(auditSecurityMigration)) fail.push('Admin-only audit log migration missing.');
else{
  const auditSec=read(auditSecurityMigration);
  if(!auditSec.includes('heads read audit logs')) fail.push('Audit log read is not Admin-only.');
}
const admissionsCloudE2E=read('admissions-cloud.js');
if(!admissionsCloudE2E.includes('async function requireHeadRole()')) fail.push('Admissions management APIs have no explicit Admin guard.');
for(const fn of ['listInstitutionApplications','listPayments','updatePaymentStatus','listAuditLogs','updateCloudApplicationStatus']){
  const pos=admissionsCloudE2E.indexOf('async function '+fn);
  const snippet=pos>=0?admissionsCloudE2E.slice(pos,pos+520):'';
  if(!snippet.includes('requireHeadRole')) fail.push('Admissions Admin API guard missing: '+fn);
}
if(index.includes('data-admission-roles="teacher,head_of_institute"')) fail.push('Legacy Teacher admission-management tabs still exposed.');
const messagingSecurityMigration='supabase/migrations/20260926053022_revoke_messaging_when_school_relationship_ends.sql';
if(!exists(messagingSecurityMigration)) fail.push('Relationship-aware messaging migration missing.');
else{
  const msgSec=read(messagingSecurityMigration);
  if(!msgSec.includes('private.is_school_conversation_participant_v2')) fail.push('Current messaging relationship helper missing.');
  if(!msgSec.includes("l.status='approved'")) fail.push('Parent messaging access is not tied to approved link.');
  if(!msgSec.includes('teacher_student_links')) fail.push('Teacher messaging access is not tied to current assignment.');
  if(!msgSec.includes('current participants read school conversations')) fail.push('Conversation RLS does not use current relationship access.');
  if(!msgSec.includes('Conversation access denied')) fail.push('Message send does not re-check current relationship.');
}


const assignedRlsMigration='supabase/migrations/20260926051550_harden_assigned_student_role_access.sql';
if(!exists(assignedRlsMigration)) fail.push('Assigned-student RLS hardening migration missing.');
else{
  const assignedSql=read(assignedRlsMigration);
  if(!assignedSql.includes('heads teachers manage assigned attendance')) fail.push('Teacher attendance is not assignment-scoped in migration.');
  if(!assignedSql.includes('heads teachers manage assigned results')) fail.push('Teacher results are not assignment-scoped in migration.');
  if(!assignedSql.includes('heads manage fees')) fail.push('Fee writes are not Admin-only in migration.');
  if(!assignedSql.includes('security invoker')) fail.push('Public core-student access helper is not SECURITY INVOKER.');
}
const adminProfileMigration='supabase/migrations/20260926051736_restrict_admin_settings_and_profile_management.sql';
if(!exists(adminProfileMigration)) fail.push('Admin settings/profile hardening migration missing.');
else{
  const adminSql=read(adminProfileMigration);
  if(!adminSql.includes('heads manage institution settings')) fail.push('Institution settings are not Admin-only in migration.');
  if(!adminSql.includes('users update own profile')) fail.push('Safe own-profile update policy missing.');
  if(!adminSql.includes('grant update(full_name,phone,updated_at)')) fail.push('Own-profile updates are not column-limited.');
}

if(!login.includes('id="admissionApplicantRole"')) fail.push('Student for Admission role entry missing.');
if(!login.includes("location.href='admission.html'")) fail.push('Student for Admission role does not open admission portal.');
if(!exists('admission.html')) fail.push('Standalone admission applicant portal missing.');
else{
  const admission=read('admission.html');
  if(!admission.includes('id="schoolDropdown"')) fail.push('Admission applicant school dropdown missing.');
  if(!admission.includes('id="schoolSearch"')) fail.push('Admission applicant school search missing.');
  if(!admission.includes("list_school_directory_v1")) fail.push('Admission portal does not load school dropdown.');
  if(!admission.includes("search_school_directory_v1")) fail.push('Admission portal school search RPC missing.');
  if(!admission.includes(".from('applications').insert")) fail.push('Admission applicant submission is not wired to applications table.');
  if(admission.includes('create_owned_institution')||admission.includes('register_admin_school')) fail.push('Admission applicant portal can create schools.');
}
if(!cloudSetup.includes("const isHead=")) fail.push('Cloud Setup has no Admin-only school creation guard.');
if(!cloudSetup.includes("if(!isHead())return;")) fail.push('Add School action is not blocked for non-Admin roles.');
const schoolDirectoryMigration='supabase/migrations/20260926054500_admin_only_school_creation_and_directory.sql';
if(!exists(schoolDirectoryMigration)) fail.push('Admin-only school creation/directory migration missing.');
else{
  const schoolSql=read(schoolDirectoryMigration);
  if(!schoolSql.includes('list_school_directory_v1')) fail.push('School directory dropdown RPC migration missing.');
  if(!schoolSql.includes('Only an Admin account can add a school')) fail.push('Admin registration hardening missing.');
  if(!schoolSql.includes('revoke all on table public.institutions from anon')) fail.push('Direct anonymous school-table access is not revoked.');

  if(!schoolSql.includes('security invoker')) fail.push('Public school directory/create wrappers are not SECURITY INVOKER.');
  if(!schoolSql.includes('private.register_admin_school_v2')) fail.push('Admin school registration is not isolated in private schema.');
  if(!schoolSql.includes('private.create_owned_institution_v2')) fail.push('Additional school creation is not isolated in private schema.');
}

if(!login.includes("submit_school_access_request_v1")) fail.push('Parent/Student profile approval request RPC missing from login.');
if(!login.includes("submit_teacher_school_request_v1")) fail.push('Teacher approval request RPC missing from login.');
if(login.includes('id="teacherInviteField"')||login.includes('id="studentLoginCodeField"')) fail.push('Code fields remain in normal signup/login.');
if(!login.includes('No School Code or Student Code required')) fail.push('Student no-code signup guidance missing.');
if(!login.includes('No School Code required')) fail.push('Parent no-code signup guidance missing.');
if(!read('admissions-cloud.js').includes('listSchoolAccessRequests')) fail.push('Admin school access request API missing.');
if(!read('admissions-cloud.js').includes('decideSchoolAccessRequest')) fail.push('Admin school access decision API missing.');
if(!read('role-access-center.js').includes('Teacher, Parent & Student Requests')) fail.push('Admin role approval center missing.');
if(!read('role-access-center.js').includes('data-school-access-approve')) fail.push('One-click Parent/Student approval button missing.');
if(!read('role-access-center.js').includes('decideTeacherSchoolRequest')) fail.push('Teacher approval is not linked to Admin.');
if(!read('core-cloud.js').includes("student_code:s.studentId||fallbackStudentCode(s)")) fail.push('Internal student cloud identity can be lost.');
if(read('role-access-center.js').includes('id="teacherRequestCard"')||read('role-access-center.js').includes('id="inviteAdminCard"')) fail.push('Legacy code controls remain in Access & Roles.');
if(!read('role-access-center.js').includes('id="toggleReviewedRequests"')) fail.push('Reviewed requests cannot be inspected after approval.');
if(!fs.existsSync(path.join(root,'supabase-teacher-access-ambiguity-fix.sql'))) fail.push('Teacher access ambiguity fix SQL is missing from the repository.');
if(!read('supabase-teacher-access-ambiguity-fix.sql').includes('teacher_access_requests_institution_id_requester_user_id_key')) fail.push('Teacher access upsert does not use the named unique constraint.');
if(!fs.existsSync(path.join(root,'supabase/migrations/20260922223000_secure_student_parent_school_linking.sql'))) fail.push('Secure Student/Parent DB migration file missing.');
if(!fs.existsSync(path.join(root,'supabase/migrations/20260923170000_simple_parent_student_approval.sql'))) fail.push('Simple Parent/Student approval migration file missing.');
if(!fs.existsSync(path.join(root,'supabase/migrations/20260926030000_simple_teacher_school_approval.sql'))) fail.push('Simple Teacher approval migration file missing.');
if(!login.includes("client.auth.resend({")) fail.push('Verification email resend flow missing.');
if(!login.includes("emailRedirectTo:PROD_LOGIN_URL")) fail.push('Signup verification redirect missing.');
if(!read('cloud-setup.js').includes("create_owned_institution_v2")) fail.push('Multi-school creation UI missing.');
if(!index.includes('data-view="settings"')) fail.push('Settings navigation item missing.');
if(!index.includes('data-view="troubleshoot"')) fail.push('Troubleshoot navigation item missing.');
if(!index.includes('id="troubleshoot"')) fail.push('Troubleshoot section missing.');
if(!index.includes('data-view="help"')) fail.push('Help & Support navigation item missing.');
if(!index.includes('id="help"')) fail.push('Help & Support section missing.');
if(!index.includes('id="reliabilityDiagnosticsCard"')) fail.push('Reliability diagnostics card missing.');
if(!app.includes("window.addEventListener('error'")) fail.push('Runtime JavaScript error capture missing.');
if(!app.includes("window.addEventListener('unhandledrejection'")) fail.push('Unhandled promise diagnostics missing.');
if(!app.includes("writeDiagnostics([])")) fail.push('Diagnostics clear action missing.');
if(!app.includes("recordDiagnostic('Student Cloud Sync'")) fail.push('Student cloud-sync failures are not surfaced in diagnostics.');
if(!app.includes('Student is saved on this device, but cloud/profile photo sync failed.')) fail.push('Student cloud-sync failure does not inform the user.');
const roleHardening=read('supabase-role-linking-hardening.sql');
if(!login.includes('Registration No. <span class="help">(Optional)</span>')) fail.push('Admin registration number is not optional in signup UI.');
if(!login.includes("register_admin_school_v2")) fail.push('Admin signup does not use the optional-registration backend.');
if(!cloudSetup.includes('Registration No. (optional)')) fail.push('Settings multi-school form does not expose optional registration number.');
if(!cloudSetup.includes("create_owned_institution_v2")) fail.push('Settings school creation does not use the optional-registration backend.');
if(!roleHardening.includes('insert into public.institution_members')) fail.push('Parent/Student signup membership hardening is missing.');
if(!roleHardening.includes('school admin approves child links')) fail.push('Parent-child approval is not restricted to School Admin.');
const admissionsCloud=read('admissions-cloud.js');
if(!/removeTeacherStudentLink[\s\S]*?eq\('institution_id',cfg\.institutionId\)/.test(admissionsCloud)) fail.push('Teacher-student unlink is not scoped to the active school.');
if(!admissionsCloud.includes('Selected teacher is not linked to this school.')) fail.push('Teacher assignment lacks same-school validation.');
if(!admissionsCloud.includes('Selected student is not linked to this school.')) fail.push('Student assignment lacks same-school validation.');
for(const roleName of ['student','parent','teacher','head']){
  const helpPattern=new RegExp(roleName+":\\[[^\\n]*'help'");
  const troubleshootPattern=new RegExp(roleName+":\\[[^\\n]*'troubleshoot'");
  if(!helpPattern.test(app)) fail.push('Help section is not available to role: '+roleName);
  if(!troubleshootPattern.test(app)) fail.push('Troubleshoot section is not available to role: '+roleName);
}

/* Recent role/link/mobile regression guards */
if(/\?[^"'\s>]*\?/.test(index)) fail.push('Malformed double-query cache version found in index.html.');
if(!roleScope.includes('function canView(view)')) fail.push('Role scope view guard is missing.');
if(!app.includes('window.EDUNIZAM_ROLE_SCOPE?.canView')) fail.push('setView does not enforce role view guard.');
const academicAccess=read('academic-access.js');
if(!academicAccess.includes('assign_teacher_class_v1')) fail.push('Bulk teacher class assignment RPC is not wired to the UI.');
for(const id of ['bulkAssignmentTeacher','bulkAssignmentClass','bulkAssignmentSection','assignWholeClassBtn']){
  if(!academicAccess.includes(id)) fail.push('Bulk teacher assignment control missing: '+id);
}
if(!admissionsCloud.includes('resolveSchoolAccessLink')) fail.push('Manual Parent/Student link resolver API missing.');
if(!admissionsCloud.includes('listAccessLinkIssues')) fail.push('Unresolved Parent/Student link detector missing.');
if(!admissionsCloud.includes("class_name,section_name,admission_no,student_code")) fail.push('Linked student query does not load class section data for bulk assignment.');
const roleAccessCenter=read('role-access-center.js');
if(!roleAccessCenter.includes('resolveAccessLinksCard')) fail.push('Admin Resolve Link panel missing.');
if(!roleAccessCenter.includes('resolveSchoolAccessLink')) fail.push('Resolve Link panel is not wired to backend.');
if(!roleAccessCenter.includes('dashboardAccessApprovalCard')) fail.push('Admin dashboard pending-approval card missing.');
const style=read('style.css');
if(!style.includes('Mobile stability and touch ergonomics')) fail.push('Shared mobile stability stylesheet layer missing.');
if(!login.includes('min-height:100dvh')) fail.push('Mobile login keyboard-stability viewport rule missing.');
if(!login.includes('min-height:44px')) fail.push('Mobile login touch target sizing missing.');
const navigationEnhancements=read('navigation-enhancements.js');
const roleDashboard=read('role-dashboard.js');
if(!navigationEnhancements.includes("['Daily Work'")) fail.push('Daily Work navigation group missing.');
if(!navigationEnhancements.includes('MutationObserver')) fail.push('Dynamic navigation items are not auto-grouped.');
if(!roleDashboard.includes('adminDailyDesk')) fail.push('Admin Daily Desk missing.');
if(!roleDashboard.includes('data-admin-jump')) fail.push('Admin Daily Desk shortcuts missing.');
if(!read('role-access-center.js').includes('admin-action-count')) fail.push('Admin Daily Desk approval count badge missing.');
const leaveCenter=read('leave-center.js');
if(!leaveCenter.includes("canSubmit(){return ['student','parent','teacher'].includes(role())}")) fail.push('Teacher/Student/Parent leave submission roles missing.');
if(!leaveCenter.includes("function isAdmin(){return role()==='head'}")) fail.push('Leave final decision is not restricted to Admin in UI.');
if(!leaveCenter.includes("rpc('decide_leave_request_v1'")) fail.push('Leave Admin decision RPC is not wired.');
if(!leaveCenter.includes('Admin final decision reason / cause')) fail.push('Required leave decision cause field missing.');
if(!leaveCenter.includes('Rejection cause')) fail.push('Leave rejection cause is not shown to the requester.');
if(!leaveCenter.includes("leaveFor:'staff'")) fail.push('Teacher own-leave submission missing.');
const leaveMigration=read('supabase-leave-requests-migration.sql');
if(!leaveMigration.includes('teachers submit own leave')) fail.push('Teacher leave insert policy missing.');
if(!leaveMigration.includes('heads decide institute leave')) fail.push('Admin-only leave decision policy missing.');
if(leaveMigration.includes('create policy "teachers decide assigned leave"')) fail.push('Legacy Teacher leave-decision policy still present.');
if(!leaveMigration.includes('leave_requests_decision_complete_check')) fail.push('Leave decision cause integrity constraint missing.');
const diaryModerationMigration='supabase/migrations/20261005062500_admin_daily_diary_moderation.sql';
if(!exists(diaryModerationMigration)) fail.push('Admin Daily Diary moderation policy migration missing.');
else{
  const diaryModeration=read(diaryModerationMigration);
  if(!diaryModeration.includes('heads delete institute diaries')||!diaryModeration.includes('owner_user_id=(select auth.uid())')) fail.push('Admin Daily Diary delete permission is not owner-scoped.');
}
if(!leaveMigration.includes('decide_leave_request_v1')) fail.push('Leave decision RPC migration missing.');
const classTeacherLeaveMigration='supabase/migrations/20261005060000_allow_class_teacher_leave_review.sql';
if(!exists(classTeacherLeaveMigration)) fail.push('Class-teacher leave review migration missing.');
else{
  const classTeacherLeave=read(classTeacherLeaveMigration);
  if(!classTeacherLeave.includes('class_teacher_user_id=(select auth.uid())')) fail.push('Class-teacher leave review is not bound to authenticated Teacher.');
  if(!classTeacherLeave.includes('teacher_student_links')||!classTeacherLeave.includes('class_sections')) fail.push('Teacher leave review must support explicit student links and assigned class sections.');
  if(!classTeacherLeave.includes('notify_new_leave_request_v1')) fail.push('Class-teacher leave routing notification update missing.');
}
const parentComplaintCenter=read('parent-complaint-center.js');
if(!parentComplaintCenter.includes('Private Complaint to School Admin')||!parentComplaintCenter.includes('paFiles')) fail.push('Private Parent → Admin text/photo/video complaint UI missing.');
if(!parentComplaintCenter.includes('parent_admin_complaint_attachments')||!parentComplaintCenter.includes("ADMIN_BUCKET='parent-admin-complaints'")) fail.push('Private Parent → Admin media storage wiring missing.');
if(!parentComplaintCenter.includes('pcFiles')||!parentComplaintCenter.includes('student_parent_complaint_attachments')) fail.push('Teacher/Admin → Parent student complaint media workflow missing.');
const parentAdminComplaintMigration='supabase/migrations/20261005064000_private_parent_admin_complaints_media.sql';
if(!exists(parentAdminComplaintMigration)) fail.push('Private Parent → Admin complaint backend migration missing.');
else{
  const parentAdminComplaint=read(parentAdminComplaintMigration);
  if(!parentAdminComplaint.includes('parent creator and admin read private complaints')) fail.push('Private Parent complaint read policy missing.');
  if(!parentAdminComplaint.includes("'parent-admin-complaints'")) fail.push('Private Parent complaint media bucket missing.');
}
const parentAdminComplaintHardening='supabase/migrations/20261005064800_harden_private_parent_admin_complaints.sql';
if(!exists(parentAdminComplaintHardening)) fail.push('Private Parent complaint integrity hardening missing.');
else{
  const parentAdminHardening=read(parentAdminComplaintHardening);
  if(!parentAdminHardening.includes("status='Open'")||!parentAdminHardening.includes('revoke update on public.parent_admin_complaints')) fail.push('Private Parent complaint immutable submission guard missing.');
}
const workflowAlerts=read('workflow-alerts.js');
if(!coreCloud.includes('async function saveAttendanceDay')) fail.push('Immediate student attendance cloud save missing.');
if(!app.includes('EDUNIZAM_CORE_CLOUD.saveAttendanceDay')) fail.push('Attendance save does not sync current day to cloud.');
// Attendance alerts moved from browser notifications to server triggers.
const attendanceAlertsMigration=read('supabase-attendance-server-alerts-migration.sql');
if(!attendanceAlertsMigration.includes('create trigger attendance_notification_trigger') ||
   !attendanceAlertsMigration.includes('for each row execute function private.notify_student_attendance_change_v1()') ||
   !attendanceAlertsMigration.includes("new.institution_id,owner_id,new.marked_by,'attendance-admin'") ||
   !attendanceAlertsMigration.includes("case when is_absence then 'Student Absence") ||
   !workflowAlerts.includes('renderAdminAttendanceAlerts(true)'))
  fail.push('Admin server-side student absence notification or dashboard refresh missing.');
if(!workflowAlerts.includes('adminAttendanceAlerts')) fail.push('Admin attendance alert dashboard card missing.');
if(!workflowAlerts.includes('No contact number')) fail.push('Attendance alert contact-number fallback missing.');
if(!workflowAlerts.includes('staffAttendanceSaved')) fail.push('Staff attendance changes do not refresh Admin alerts.');
const staffTime=read('staff-time-attendance.js');
if(!staffTime.includes('data-mark-staff-absent')) fail.push('Admin one-click staff absent action missing.');
if(!staffTime.includes('EDUNIZAM_WORKFLOW_ALERTS?.staffAttendanceSaved')) fail.push('Staff attendance does not trigger workflow alerts.');
if(!staffTime.includes("st.phone?' · '")) fail.push('Staff attendance cards do not show contact number.');
const attendanceAnalytics=read('attendance-analytics.js');
if(!attendanceAnalytics.includes('Who Marked Attendance')) fail.push('Admin student attendance marker log missing.');
if(!attendanceAnalytics.includes('marked_by')) fail.push('Student attendance analytics does not load marker identity.');
if(!attendanceAnalytics.includes('markerProfiles')) fail.push('Attendance marker names are not resolved for Admin.');
if(!attendanceAnalytics.includes('studentPhone')||!attendanceAnalytics.includes('<th>Contact</th>')) fail.push('Admin absence audit does not include student contact numbers.');
const classTeacherAttendanceMigration='supabase/migrations/20261005055000_allow_class_teacher_student_attendance.sql';
if(!exists(classTeacherAttendanceMigration)) fail.push('Class-teacher attendance policy migration missing.');
else{
  const classTeacherAttendance=read(classTeacherAttendanceMigration);
  if(!classTeacherAttendance.includes('class_teacher_user_id=(select auth.uid())')) fail.push('Class-teacher attendance policy is not bound to authenticated Teacher.');
  if(!classTeacherAttendance.includes('teacher_student_links')||!classTeacherAttendance.includes('class_sections')) fail.push('Teacher attendance policy must allow explicit student links or assigned class sections.');
}
if(!staffTime.includes("role()==='teacher'&&mine()")) fail.push('Staff self-attendance action is not explicitly Teacher-only.');
if(!staffTime.includes('data-admin-staff-status')) fail.push('Admin Teacher attendance Present/Absent/Leave controls missing.');
if(!staffTime.includes('Teacher self')) fail.push('Admin staff attendance log does not identify Teacher self marking.');
const attendanceOwnershipMigration='supabase/migrations/20260926054916_enforce_attendance_actor_and_teacher_ownership.sql';
if(!exists(attendanceOwnershipMigration)) fail.push('Attendance actor ownership migration missing.');
else{
  const attOwn=read(attendanceOwnershipMigration);
  if(!attOwn.includes('marked_by=(select auth.uid())')) fail.push('Attendance writes do not bind marker to authenticated actor.');
  if(!attOwn.includes('teachers insert assigned attendance')) fail.push('Teacher assigned-student attendance insert policy missing.');
  if(!attOwn.includes('heads manage staff attendance')) fail.push('Admin staff attendance management policy missing.');
}
const attendanceMembershipMigration='supabase/migrations/20260926055157_require_active_teacher_membership_for_attendance.sql';
if(!exists(attendanceMembershipMigration)) fail.push('Active Teacher attendance membership migration missing.');
else{
  const attMember=read(attendanceMembershipMigration);
  if(!attMember.includes("m.role='teacher'")) fail.push('Attendance policies do not require active Teacher membership.');
  if(!attMember.includes('teachers read own attendance')) fail.push('Teacher staff attendance read-own policy missing.');
  if(!attMember.includes('s.user_id=(select auth.uid())')) fail.push('Teacher staff attendance is not bound to own staff profile.');
}

const staffMigration=read('supabase-staff-time-training-community-migration.sql');
if(!staffMigration.includes('check_in_at timestamptz')) fail.push('Staff attendance check-in timestamp column migration missing.');
if(!staffMigration.includes('teachers insert own staff attendance')) fail.push('Teacher self clock-in insert policy missing.');
if(!staffMigration.includes('teachers update own staff attendance')) fail.push('Teacher self clock update policy missing.');
if(!read('supabase-academic-access-migration.sql').includes('i.owner_user_id=user_notifications.recipient_user_id')) fail.push('Notification recipient is not restricted to institution users.');
if(!style.includes('admin-attendance-alerts')) fail.push('Admin attendance alert responsive styles missing.');
const auditCenter=read('audit-activity-center.js');
if(!auditCenter.includes('Audit & Activity Center')) fail.push('Admin Audit & Activity Center module missing.');
if(!auditCenter.includes("role()!=='head'")) fail.push('Audit & Activity Center is not Admin-only.');
if(!auditCenter.includes("from('audit_logs')")) fail.push('Audit Center is not connected to server audit logs.');
if(!app.includes("view==='auditcenter'")) fail.push('App navigation does not render Audit Center.');
if(!roleScope.includes("'auditcenter'")) fail.push('Admin role does not include Audit Center view.');
if(!navigationEnhancements.includes("'auditcenter'")) fail.push('Audit Center is not grouped in navigation.');
if(!index.includes('audit-activity-center.js')) fail.push('Audit Center script is not loaded.');
if(!read('sw.js').includes("'./audit-activity-center.js'")) fail.push('PWA cache does not include Audit Center.');
const auditMigration='supabase/migrations/20260926053511_add_server_side_admin_audit_activity.sql';
if(!exists(auditMigration)) fail.push('Server-side Admin audit migration missing.');
else{
  const auditSql=read(auditMigration);
  if(!auditSql.includes('private.capture_admin_audit_v1')) fail.push('Server-side audit trigger function missing.');
  for(const table of ['attendance_records','fee_records','result_records','leave_requests','school_access_requests','core_students','staff_attendance_records','applications','payment_records']){
    if(!auditSql.includes('audit_'+table)) fail.push('Audit trigger missing for '+table+'.');
  }
  for(const sensitive of ['b_form_no','guardian_cnic','check_in_latitude','check_in_longitude']){
    if(auditSql.includes("'"+sensitive+"'")) fail.push('Sensitive field copied into audit payload: '+sensitive);
  }
}



if(!style.includes('admin-daily-actions')) fail.push('Admin Daily Desk responsive styles missing.');
const pwaManifest=read('manifest.webmanifest');
const pwaInstall=read('pwa-install.js');
const pwaSw=read('sw.js');
if(!pwaManifest.includes('"icon-192.png"')||!pwaManifest.includes('"192x192"')) fail.push('PWA 192px PNG icon missing from manifest.');
if(!pwaManifest.includes('"icon-512.png"')||!pwaManifest.includes('"512x512"')) fail.push('PWA 512px PNG icon missing from manifest.');
if(!pwaManifest.includes('"prefer_related_applications": false')) fail.push('PWA manifest must keep prefer_related_applications false.');
if(!pwaManifest.includes('"start_url": "./login.html"')) fail.push('Installed PWA must open at secure Login / Sign Up.');
if(!pwaInstall.includes('beforeinstallprompt')) fail.push('Shared PWA native install prompt handler missing.');
if(!pwaInstall.includes('manualHelp')) fail.push('PWA manual install fallback missing.');
if(!pwaInstall.includes("serviceWorker.register('./sw.js?v=")) fail.push('Shared PWA service worker registration missing.');
const autoUpdate=read('system-auto-update.js');
const swCache=pwaSw.match(/const CACHE=['"]([^'"]+)['"]/)?.[1]||'';
const activeCache=autoUpdate.match(/const ACTIVE_CACHE=['"]([^'"]+)['"]/)?.[1]||'';
const build=autoUpdate.match(/const BUILD=['"]([^'"]+)['"]/)?.[1]||'';
const registerBuild=pwaInstall.match(/sw\.js\?v=([^'"]+)/)?.[1]||'';
if(!swCache||swCache!==activeCache) fail.push('PWA active cache version does not match service worker cache.');
if(!build||build!==registerBuild) fail.push('PWA install registration version does not match system build.');
for(const page of ['index.html','app.html','login.html','edunizam.html','admission.html','features.html','school-management-system-pakistan.html','online-school-admissions.html','learning-resources-pakistan.html','learn.html','about.html','privacy.html']){
  if(!read(page).includes('manifest.webmanifest')) fail.push('PWA manifest link missing: '+page);
  if(!read(page).includes('pwa-install.js?v=')) fail.push('Shared PWA install controller missing: '+page);
}
if(!read('login.html').includes('data-pwa-install')) fail.push('Login install button missing.');
if(!read('edunizam.html').includes('data-pwa-install')) fail.push('Public landing install button missing.');
const guestLearn=read('learn.html');
if(!guestLearn.includes('href="login.html">Login / Sign Up</a>')) fail.push('Guest Learning has no visible Login / Sign Up entry.');
if(!guestLearn.includes('guest-learning-premium.js?v=')) fail.push('Guest Learning premium controller missing.');
if(!exists('learning-complete-data.js')) fail.push('Complete Learning Hub data layer missing.');
if(!exists('learning-required-data.js')) fail.push('Required Learning Hub expansion data missing.');
if(!exists('practice-complete-data.js')) fail.push('Complete Practice Center question bank missing.');
if(!exists('practice-session-core.js')) fail.push('Practice Center session core missing.');
if(!exists('learning-search-engine.js')) fail.push('Learning Hub smart search engine missing.');
if(!guestLearn.includes('learning-complete-data.js?v=')) fail.push('Complete Learning Hub data layer is not loaded.');
if(!guestLearn.includes('learning-required-data.js?v=')) fail.push('Required Learning Hub expansion data is not loaded.');
if(!guestLearn.includes('practice-complete-data.js?v=')) fail.push('Complete Practice Center question bank is not loaded.');
if(!guestLearn.includes('practice-session-core.js?v=')) fail.push('Practice Center session core is not loaded.');
if(!guestLearn.includes('learning-search-engine.js?v=')) fail.push('Learning Hub smart search engine is not loaded.');
if(!pwaSw.includes("'./learning-complete-data.js'")) fail.push('Complete Learning Hub data layer is not cached by PWA.');
if(!pwaSw.includes("'./learning-required-data.js'")) fail.push('Required Learning Hub expansion data is not cached by PWA.');
if(!pwaSw.includes("'./practice-complete-data.js'")) fail.push('Complete Practice Center question bank is not cached by PWA.');
if(!pwaSw.includes("'./practice-session-core.js'")) fail.push('Practice Center session core is not cached by PWA.');
if(!pwaSw.includes("'./learning-search-engine.js'")) fail.push('Learning Hub smart search engine is not cached by PWA.');
const learningComplete=read('learning-complete-data.js');
for(const marker of ['portal-','pectaa-g5-english','pectaa-g8-english-model','pectaa-curriculum-ebooks','hec-directory','vu-datesheet','ACC311','q53']){
  if(!learningComplete.includes(marker)) fail.push('Learning Hub complete-data marker missing: '+marker);
}
if(/style\.display\s*=/.test(read('guest-learning-nav.js'))) fail.push('Guest navigation can leave stale inline display state.');
if(!read('learning-sky.css').includes('.search-wrap{position:relative;top:auto;z-index:2}')) fail.push('Mobile Guest search must not stay sticky over learning results.');
if(!read('guest-learning-premium.js').includes('flex-wrap:nowrap!important')) fail.push('Mobile Guest search chips must remain in a horizontal scroller.');
if(!read('guest-learning-premium.js').includes('search-tools-collapsed')) fail.push('Guest search suggestions do not collapse after a search is submitted.');
if(!read('school-assessment-data.js').includes('pectaa-g5-math-curriculum')) fail.push('Official Grade 5 Mathematics visitor resource missing.');
if(!read('guest-learning-premium.js').includes('refreshGradeOptions')) fail.push('Grade 5/8 visitor filters are not data-driven.');
if(!read('guest-learning-premium.js').includes('No exact resource of this type is currently indexed.')) fail.push('Grade 5/8 visitor fallback guidance missing.');
const practiceData=read('practice-data.js');
const guestPractice=read('guest-learning-premium.js');
if(!practiceData.includes('id:"q21"')||!practiceData.includes('chapter:"Periodic Table"')||!practiceData.includes('difficulty:"Medium"')) fail.push('Grade 9 Chemistry Periodic Table medium practice coverage missing.');
if(!guestPractice.includes('refreshPracticeOptions')) fail.push('Practice Center filters are not question-backed.');
if(!guestPractice.includes("baseActions.hidden=true")) fail.push('Duplicate legacy Practice navigation remains visible.');
if(!guestPractice.includes("baseActions.style.display='none'")) fail.push('Legacy Practice navigation is not force-hidden against author CSS.');
if(!read('learning-sky.css').includes('.practice-actions[hidden],.practice-actions[aria-hidden="true"]{display:none!important}')) fail.push('Practice hidden-state CSS guard missing.');
if(guestPractice.includes('No practice question matches these filters. Try another class, subject, chapter or difficulty.')) fail.push('Practice Center still contains the dead-end filter message.');
const guestPremium=read('guest-learning-premium.js');
for(const marker of ["function closePremium()","if(level==='university')","data-study-id","paperSession","paperLevel"]){if(!guestPremium.includes(marker)) fail.push('Guest Learning regression marker missing: '+marker)}
for(const marker of ['guestStudySubject','guestStudyType','guestUniversitySummary','refreshTypes=()=>','data-hub-filter','function applyHubShortcut']){
  if(!guestPremium.includes(marker)) fail.push('Complete Learning section control missing: '+marker);
}
if(!guestLearn.includes('(pp.papers||[]).length+(sd.materials||[]).length')) fail.push('Learning Hub overview does not count complete public resources.');
if(!read('learning-complete-data.js').includes("id:'exam-focus-12'")) fail.push('Study Library exam-focus data missing.');
if(!read('learning-complete-data.js').includes('EDUNIZAM_PUBLIC_LINKS')) fail.push('Official public date-sheet/result links data missing.');
if(!guestPremium.includes('guestPracticeType')) fail.push('Practice Center question-type filter missing.');
if(!guestPremium.includes("kind==='practice'")) fail.push('MCQ/Quiz directory shortcut is not connected to Practice Center.');
if(!guestPremium.includes("showGlobalResults('date sheet')")||!guestPremium.includes("showGlobalResults('results')")) fail.push('Date Sheet / Result directory shortcuts are not global public searches.');
if(!guestLearn.includes('(window.EDUNIZAM_PUBLIC_LINKS||[]).length')) fail.push('Overview public-resource total excludes date-sheet/result portal links.');
if(!guestLearn.includes('id="runGlobalSearch"')) fail.push('Guest Learning global Search button missing.');
const smartSearch=read('learning-search-engine.js');
for(const marker of ['EDUNIZAM_LEARNING_SEARCH','courseCode','دسویں','gujranwala','requestedVuFamily']){
  if(!smartSearch.includes(marker)) fail.push('Smart Learning search marker missing: '+marker);
}
const requiredLearning=read('learning-required-data.js');
for(const marker of ['MTH603','CS202','EDU510','g5-math-01','g8-sci-04']){
  if(!requiredLearning.includes(marker)) fail.push('Required Learning data marker missing: '+marker);
}
if(!guestPremium.includes("data-start-practice")) fail.push('Global search Practice result cannot launch Practice Center.');
if(!guestPremium.includes("kind==='vu-quizzes'")) fail.push('VU Quizzes shortcut missing.');
for(const marker of ['guestPracticeOrder','guestPracticeLimit','practiceSessionStats','finishGuestPractice','Session complete','Practice Again','Pending: ','Practice questions answered']){
  if(!guestPremium.includes(marker)) fail.push('Complete Practice session control missing: '+marker);
}
for(const marker of ['#practiceExplorer select,#practiceExplorer button','min-height:46px','.practice-box .option','touch-action:manipulation']){
  if(!guestPremium.includes(marker)) fail.push('Mobile Practice UI guard missing: '+marker);
}
const practiceCore=read('practice-session-core.js');
for(const marker of ['filterQuestions','selectSession','sessionStats','auditMatrix']){
  if(!practiceCore.includes(marker)) fail.push('Practice session core marker missing: '+marker);
}
const completePractice=read('practice-complete-data.js');
for(const marker of ['minimumPerChapter:9',"requiredTypes:['mcq','short','long']","requiredDifficulties:['Easy','Medium','Hard']",'requiredTypeDifficultyMatrix:true','EDUNIZAM_PRACTICE_BLUEPRINTS']){
  if(!completePractice.includes(marker)) fail.push('Complete Practice data marker missing: '+marker);
}
if(!pwaSw.includes("'./pwa-install.js'")) fail.push('PWA install controller not cached.');
if(!pwaSw.includes("'./icon-192.png'")||!pwaSw.includes("'./icon-512.png'")) fail.push('PWA PNG icons not cached.');

const seoPublic=read('index.html');
const seoSitemap=read('sitemap.xml');
const seoRobots=read('robots.txt');
if(!seoPublic.includes('index,follow,max-image-preview:large')) fail.push('Public EduNizam landing is not indexable.');
if(!seoPublic.includes('href="https://edunizam.online/"')) fail.push('Public EduNizam canonical URL missing.');
if(!seoPublic.includes('"@type":"SoftwareApplication"')) fail.push('Public EduNizam SoftwareApplication schema missing.');
if(!seoPublic.includes('edunizam-login-children.webp')) fail.push('Public landing preferred image signal missing.');
if(!index.includes('noindex,follow,noarchive')) fail.push('Private app.html must remain noindex.');
if(!read('login.html').includes('noindex,follow,noarchive')) fail.push('Login page must remain noindex.');
if(!read('admission.html').includes('noindex,follow,noarchive')) fail.push('Admission application page must remain noindex.');
if(!seoRobots.includes('Allow: /')) fail.push('robots.txt must allow crawling so noindex directives can be read.');
if(seoRobots.includes('Disallow: /eduNizam/login.html')) fail.push('Login must not be robots-blocked while using noindex.');
if(!seoRobots.includes('Sitemap: https://edunizam.online/sitemap.xml')) fail.push('robots.txt sitemap declaration missing.');
if(!seoSitemap.includes('<loc>https://edunizam.online/</loc>')) fail.push('Public EduNizam root landing missing from sitemap.');
if(seoSitemap.includes('https://edunizam.online/edunizam.html')) fail.push('Legacy EduNizam landing should not be submitted separately from canonical root.');
for(const privateUrl of ['app.html','login.html','admission.html','404.html']){
  if(seoSitemap.includes(privateUrl)) fail.push('Private/noindex URL leaked into sitemap: '+privateUrl);
}
for(const page of ['features.html','school-management-system-pakistan.html','online-school-admissions.html','learning-resources-pakistan.html','about.html','privacy.html']){
  const src=read(page);
  if(!src.includes('"@type":"BreadcrumbList"')) fail.push('Breadcrumb schema missing: '+page);
  if(!src.includes('https://edunizam.online/')) fail.push('Public hierarchy does not point to EduNizam root landing: '+page);
  if(!src.includes('primaryImageOfPage')) fail.push('Preferred image schema missing: '+page);
}



if(fail.length){
  console.error('\nEduNizam QA FAILED\n');
  for(const x of fail) console.error('✗ '+x);
  process.exit(1);
}
console.log('EduNizam QA PASSED');
console.log('Checked '+jsFiles.length+' JavaScript files, '+ids.length+' HTML ids, and '+new Set([...scriptRefs,...cssRefs,...dynamicRefs]).size+' referenced assets.');
