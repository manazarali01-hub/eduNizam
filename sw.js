const CACHE='edunizam-v53-cloud-wizard'
const ASSETS=['./','./assets/edunizam-logo.webp','./index.html','./style.css','./app.js','./manifest.webmanifest','./public.css','./about.html','./features.html','./sitemap.xml','./robots.txt','./icon-192.svg','./icon-512.svg','./past-papers-data.js','./past-papers-inventory.js','./past-papers-premium.js','./math-editor.js','./practice-data.js','./practice-center.js','./curriculum-registry.js','./study-data.js','./study-inventory.js','./study-library.js','./education-hubs.js','./vu-workspace.js','./admissions-portal.js','./admissions-selection.js','./student-performance.js','./student-behavior.js','./parent-complaint-center.js','./gate-pass-center.js','./attendance-analytics.js','./school-work.js','./notice-board-center.js','./lesson-plan-center.js','./calendar-center.js','./timetable-date-sheet.js','./leave-center.js','./exam-center.js','./staff-center.js','./staff-time-attendance.js','./staff-payroll.js','./teacher-training-center.js','./student-documents.js','./class-section-center.js','./bulk-import-center.js','./school-community.js','./navigation-enhancements.js','./ui-polish.js','./fee-center.js','./finance-center.js','./inventory-center.js','./library-center.js','./transport-center.js','./owner-center.js','./core-cloud.js','./auth-bridge.js','./ai-client.js','./cloud-setup.js','./communication-cloud.js','./communication-center.js','./messaging-center.js','./helpdesk-center.js','./role-access-center.js','./academic-access.js','./role-scope.js','./role-dashboard.js','./workflow-alerts.js','./backend-health.js','./admissions-cloud.js','./cloud-config.js','./admissions-data.js','./university-data.js','./vu-course-catalog.js','./school-assessment-data.js'];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('edunizam-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin)return;
  const networkFirst=e.request.mode==='navigate'||['script','style','document'].includes(e.request.destination);
  e.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(e.request);
    if(networkFirst){
      try{
        const res=await fetch(e.request,{cache:'no-store'});
        if(res&&res.ok)cache.put(e.request,res.clone());
        return res;
      }catch(_){return cached||Response.error()}
    }
    const network=fetch(e.request).then(res=>{
      if(res&&res.ok)cache.put(e.request,res.clone());
      return res;
    }).catch(()=>cached);
    return cached||network;
  }));
});
