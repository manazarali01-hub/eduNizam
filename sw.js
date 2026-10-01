const CACHE='edunizam-v190-visitor202'
const CORE=[
  './',
  './index.html',
  './app.html',
  './login.html',
  './admission.html',
  './style.css',
  './cloud-config.js',
  './storage-scope.js',
  './reliability-guardian.js',
  './mobile-performance.css',
  './premium-auth.css',
  './premium-ui.js',
  './pwa-install.js',
  './system-auto-update.js',
  './audit-activity-center.js',
  './premium-ui.css',
  './app.js',
  './feature-loader.js',
  './navigation-enhancements.js',
  './ui-polish.js',
  './manifest.webmanifest',
  './assets/edunizam-premium-mark.svg',
  './assets/edunizam-login-children.webp',
  './assets/edunizam-girl-hero.webp',
  './icon-192.svg',
  './icon-512.svg',
  './icon-192.png',
  './icon-512.png',
  './public.css',
  './learn.html',
  './past-papers-data.js',
  './study-data.js',
  './school-assessment-data.js',
  './university-data.js',
  './vu-course-catalog.js',
  './practice-data.js',
  './learning-premium-data.js',
  './learning-complete-data.js',
  './learning-required-data.js',
  './practice-complete-data.js',
  './practice-session-core.js',
  './learning-search-engine.js',
  './guest-learning-nav.js',
  './guest-learning-premium.js',
  './about.html',
  './features.html',
  './learning-resources-pakistan.html',
  './online-school-admissions.html',
  './school-management-system-pakistan.html',
  './edunizam.html',
  './privacy.html',
  './404.html',];

self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url=>{
      try{
        const response=await fetch(url,{cache:'no-store'});
        if(response?.ok)await cache.put(url,response.clone());
      }catch(_){}
    }));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('edunizam-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim().then(()=>self.clients.matchAll({type:'window'}).then(clients=>clients.forEach(client=>client.postMessage({type:'EDUNIZAM_UPDATE_READY'}))))
  ]));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  const isNavigation=event.request.mode==='navigate';
  const isCode=['script','style'].includes(event.request.destination);

  if(isNavigation){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        if(response?.ok)cache.put(event.request,response.clone());
        return response;
      }catch(_){
        return (await cache.match(event.request,{ignoreSearch:true})) || (await cache.match('./index.html'));
      }
    })());
    return;
  }

  if(isCode){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(event.request,{ignoreSearch:true});
      const refresh=fetch(event.request,{cache:'no-store'}).then(response=>{
        if(response?.ok)cache.put(event.request,response.clone());
        return response;
      }).catch(()=>null);
      if(cached){
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) || Response.error();
    })());
    return;
  }

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request);
    if(cached){
      event.waitUntil(fetch(event.request).then(response=>{
        if(response?.ok)cache.put(event.request,response.clone());
      }).catch(()=>{}));
      return cached;
    }
    try{
      const response=await fetch(event.request);
      if(response?.ok)cache.put(event.request,response.clone());
      return response;
    }catch(_){
      return Response.error();
    }
  })());
});
