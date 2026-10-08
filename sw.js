const CACHE='edunizam-v262-premium-illustrated-v9'
const CORE=[
  './',
  './index.html',
  './app.html',
  './login.html',
  './admission.html',
  './style.css',
  './edunizam-brand-refresh.css',
  './edunizam-visual-system.css',
  './reference-reconstruction.css',
  './workspace-atmosphere.css',
  './cloud-config.js',
  './storage-scope.js',
  './reliability-guardian.js',
  './mobile-performance.css',
  './mobile-nav-core.js',
  './data-runtime.js',
  './cloud-setup.js',
  './admissions-cloud.js',
  './admissions-portal.js',
  './core-cloud.js',
  './auth-bridge.js',
  './premium-auth.css',
  './premium-ui.js',
  './pwa-install.js',
  './system-auto-update.js',
  './audit-activity-center.js',
  './premium-ui.css',
  './edunizam-colorful-icons.css',
  './edunizam-colorful-icons.js',
  './app.js',
  './feature-loader.js',
  './navigation-enhancements.js',
  './ui-polish.js',
  './manifest.webmanifest',
  './assets/edunizam-premium-mark.svg',
  './assets/edunizam-login-children.webp',
  './assets/edunizam-girl-hero.webp',
  './assets/themes/science-lab.svg',
  './assets/themes/mathematics.svg',
  './assets/themes/digital-learning.svg',
  './assets/themes/world-learning.svg',
  './assets/themes/stationery.svg',
  './assets/themes/library-shelves.svg',
  './assets/themes/classroom-board.svg',
  './assets/themes/creative-learning.svg',
  './assets/themes/exam-study.svg',
  './assets/themes/reading-books.svg',
  './icon-192.svg',
  './icon-512.svg',
  './icon-192.png',
  './icon-512.png',
  './public.css',
  './public-premium.css',
  './learning-sky.css',
  './home-gold.css',
  './home-mobile-200-clarity-oct08.css',
  './home-premium.js',
  './learn.html',
  './past-papers-data.js',
  './past-papers-premium.js',
  './board-paper-deep-data.js',
  './board-paper-regional-deep-data.js',
  './study-data.js',
  './school-assessment-data.js',
  './university-data.js',
  './education-directory-expansion.js',
  './university-directory-normalizer.js',
  './competitive-exams-data.js',
  './competitive-exams.js',
  './education-hubs.js',
  './vu-workspace.js',
  './education-ecosystem-data.js',
  './education-ecosystem.js',
  './exam-pathways-data.js',
  './exam-pathways.js',
  './exam-topic-practice-data.js',
  './exam-topic-checkpoints.js',
  './exam-topic-practice.js',
  './exam-topic-blueprints-data.js',
  './exam-topic-planner.js',
  './vu-course-catalog.js',
  './vu-catalog-expansion.js',
  './vu-project-courses-deep.js',
  './vu-course-pathways.js',
  './vu-material-library.js',
  './practice-data.js',
  './practice-curriculum-expansion.js',
  './practice-depth-data.js',
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
  './aiou-student-resources-pakistan.html',
  './virtual-university-resources-pakistan.html',
  './university-results-lms-past-papers-pakistan.html',
  './css-ppsc-fpsc-pakistan.html',
  './pakistan-education-services.html',
  './pakistan-entry-tests-scholarships.html',
  './pakistan-degree-accreditation-recognition.html',
  './technical-vocational-digital-skills-pakistan.html',
  './pakistan-textbooks-curriculum-research.html',
  './pakistan-exam-study-pathways.html',
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
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('edunizam-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    // Homepage only: refresh an already open old public document after a
    // service-worker version change; never reload auth or dashboard workspaces.
    // A fresh query also bypasses stale navigation-cache entries.
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(windows.map(async client=>{
      try{
        const url=new URL(client.url);
        if(url.origin!==self.location.origin || !['/','/index.html'].includes(url.pathname))return;
        if(url.searchParams.get('edu_visual')==='200v2')return;
        url.searchParams.set('edu_visual','200v2');
        await client.navigate(url.href);
      }catch(_){}
    }));
  })());
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
      const versioned=url.searchParams.has('v');
      // Versioned code URLs are immutable for that release. Serve them from
      // Cache Storage immediately; a new release changes ?v= and misses safely.
      if(versioned){
        const cached=await cache.match(event.request);
        if(cached)return cached;
        try{
          const response=await fetch(event.request,{cache:'no-store'});
          if(response?.ok)await cache.put(event.request,response.clone());
          return response;
        }catch(_){
          return Response.error();
        }
      }
      // Unversioned code stays network-first so emergency fixes remain fresh.
      try{
        const response=await fetch(event.request,{cache:'no-store'});
        if(response?.ok)await cache.put(event.request,response.clone());
        return response;
      }catch(_){
        return (await cache.match(event.request)) ||
          (await cache.match(event.request,{ignoreSearch:true})) ||
          Response.error();
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
