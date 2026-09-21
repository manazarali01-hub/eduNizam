const CACHE='edunizam-v77-installable-pwa'
const CORE=[
  './',
  './index.html',
  './login.html',
  './style.css',
  './app.js',
  './feature-loader.js',
  './navigation-enhancements.js',
  './ui-polish.js',
  './manifest.webmanifest',
  './assets/edunizam-logo-approved.webp',
  './assets/edunizam-login-children.webp',
  './icon-192.svg',
  './icon-512.svg',
  './public.css',
  './about.html',
  './features.html',
  './privacy.html',
  './404.html',];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('edunizam-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  const isNavigation=event.request.mode==='navigate';
  const isCode=['script','style','document'].includes(event.request.destination);

  if(isNavigation||isCode){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        if(response?.ok)cache.put(event.request,response.clone());
        return response;
      }catch(_){
        return (await cache.match(event.request)) ||
          (isNavigation ? (await cache.match('./index.html')) : Response.error());
      }
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
