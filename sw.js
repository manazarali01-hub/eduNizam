const CACHE='edunizam-v22-school-work';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./past-papers-data.js','./past-papers-inventory.js','./past-papers-premium.js','./math-editor.js','./practice-data.js','./practice-center.js','./curriculum-registry.js','./study-data.js','./study-inventory.js','./study-library.js','./education-hubs.js','./vu-workspace.js','./admissions-portal.js','./admissions-selection.js','./student-performance.js','./school-work.js','./core-cloud.js','./auth-bridge.js','./ai-client.js','./cloud-setup.js','./communication-cloud.js','./communication-center.js','./role-access-center.js','./academic-access.js','./role-scope.js','./role-dashboard.js','./workflow-alerts.js','./backend-health.js','./admissions-cloud.js','./cloud-config.js','./admissions-data.js','./university-data.js','./vu-course-catalog.js','./school-assessment-data.js'];
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
  e.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(e.request);
    const network=fetch(e.request).then(res=>{
      if(res&&res.ok)cache.put(e.request,res.clone());
      return res;
    }).catch(()=>cached);
    return cached||network;
  }));
});