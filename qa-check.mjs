import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const fail=[];
const ok=[];

const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const index=read('index.html');
const app=read('app.js');
const feature=read('feature-loader.js');

const scriptRefs=[...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
  .map(m=>m[1].split('?')[0])
  .filter(x=>!/^https?:/i.test(x));
const cssRefs=[...index.matchAll(/<link[^>]+href=["']([^"']+\.css(?:\?[^"']*)?)["']/g)]
  .map(m=>m[1].split('?')[0]);
const dynamicRefs=[...feature.matchAll(/['"]([^'"]+\.js)['"]/g)]
  .map(m=>m[1])
  .filter(x=>!/^https?:/i.test(x));

for(const file of [...new Set([...scriptRefs,...cssRefs,...dynamicRefs])]){
  if(!exists(file)) fail.push('Missing referenced file: '+file);
}

const jsFiles=fs.readdirSync(root).filter(f=>f.endsWith('.js'));
for(const file of jsFiles){
  try{ new Function(read(file)); ok.push('Syntax '+file); }
  catch(e){ fail.push('JavaScript syntax error in '+file+': '+e.message); }
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
if(!login.includes("Teacher request is pending School Admin approval.")) fail.push('Teacher pending-approval login guidance missing.');
if(!read('cloud-setup.js').includes('Parent/Student Login Code')) fail.push('Admin Settings do not expose the same-school Parent/Student login code clearly.');
if(!login.includes('id="studentCodeField"')) fail.push('Student signup code field missing.');
if(!login.includes('id="loginStudentCode"')) fail.push('Student first-login code field missing.');
if(!login.includes("claim_student_account_v1")) fail.push('Secure Student Code claim RPC missing from login.');
if(!login.includes("ensureStudentRecord")) fail.push('Student login is not tied to a verified school record.');
if(!app.includes("function makeStudentCode()")) fail.push('Student Code generator missing.');
if(!app.includes("Student Code:")) fail.push('Admin student list does not display Student Codes.');
if(!read('core-cloud.js').includes("student_code:s.studentId||fallbackStudentCode(s)")) fail.push('Legacy student cloud sync can lose Student Code.');
if(!read('admissions-cloud.js').includes("rpc('claim_student_account_v1'")) fail.push('Cloud student claim still uses legacy RPC.');
if(!read('role-access-center.js').includes("teacherRequest.style.display=r==='teacher'")) fail.push('Teacher verification card is exposed to the wrong role.');
if(!fs.existsSync(path.join(root,'supabase/migrations/20260922223000_secure_student_parent_school_linking.sql'))) fail.push('Secure Student/Parent DB migration file missing.');
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
if(!app.includes('Student is saved on this device, but cloud sync failed.')) fail.push('Student cloud-sync failure does not inform the user.');
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

if(fail.length){
  console.error('\nEduNizam QA FAILED\n');
  for(const x of fail) console.error('✗ '+x);
  process.exit(1);
}
console.log('EduNizam QA PASSED');
console.log('Checked '+jsFiles.length+' JavaScript files, '+ids.length+' HTML ids, and '+new Set([...scriptRefs,...cssRefs,...dynamicRefs]).size+' referenced assets.');
