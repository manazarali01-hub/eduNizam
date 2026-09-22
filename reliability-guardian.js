(function(){
  'use strict';

  const EVENT_KEY='edunizam_reliability_events';
  const SAFE_KEY='edunizam_safe_performance_mode';
  const RELOAD_KEY='edunizam_last_auto_reload';
  const state={
    startedAt:Date.now(),
    safeMode:false,
    autoSafeMode:false,
    online:navigator.onLine,
    lastHeartbeat:Date.now(),
    longTasks:[],
    recentErrors:[],
    repairs:0,
    featureLoads:new Map()
  };

  const now=()=>Date.now();
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(_){return fallback}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function report(type,message,source='',severity='warning'){
    const item={type:String(type||'Issue'),message:String(message||'Unknown issue').slice(0,500),source:String(source||'').slice(0,250),severity,at:new Date().toISOString()};
    const items=readJson(EVENT_KEY,[]);
    items.push(item);
    writeJson(EVENT_KEY,items.slice(-50));
    if(severity==='error')console.error('[EduNizam Reliability]',item);
    else console.warn('[EduNizam Reliability]',item);
    render();
    return item;
  }

  function setConnectionStatus(){
    state.online=navigator.onLine;
    document.documentElement.classList.toggle('edu-offline',!state.online);
    const badge=document.getElementById('reliabilityNetworkBadge');
    if(badge){badge.textContent=state.online?'Online':'Offline';badge.classList.toggle('warning',!state.online)}
  }

  function applyPerformanceProfile(){
    const mobile=matchMedia('(max-width: 700px)').matches;
    const lowMemory=Number(navigator.deviceMemory||8)<=4;
    const lowCpu=Number(navigator.hardwareConcurrency||8)<=4;
    document.documentElement.classList.toggle('edu-mobile-performance',mobile);
    document.documentElement.classList.toggle('edu-low-resource',lowMemory||lowCpu);
    const saved=localStorage.getItem(SAFE_KEY)==='1';
    if(saved||((mobile||lowMemory)&&lowCpu)) enterSafeMode(saved?'Saved safe mode':'Low-resource device detected',false);
  }

  function enterSafeMode(reason='Performance protection',persist=true){
    if(state.safeMode)return;
    state.safeMode=true;
    state.autoSafeMode=!persist;
    document.documentElement.classList.add('edu-safe-performance-mode');
    if(persist)try{localStorage.setItem(SAFE_KEY,'1')}catch(_){}
    report('Performance Protection',reason,'Reliability Guardian','warning');
    render();
  }

  function exitSafeMode(){
    state.safeMode=false;
    state.autoSafeMode=false;
    document.documentElement.classList.remove('edu-safe-performance-mode');
    try{localStorage.removeItem(SAFE_KEY)}catch(_){}
    render();
  }

  function repairUI(reason='Automatic UI repair'){
    try{
      document.documentElement.classList.remove('edu-feature-loading');
      document.body?.classList.remove('mobile-nav-lock');
      const sidebar=document.querySelector('.sidebar');
      const backdrop=document.getElementById('eduMobileNavBackdrop');
      if(sidebar)sidebar.classList.remove('mobile-nav-open');
      if(backdrop){
        backdrop.classList.remove('show');
        backdrop.style.display='none';
        backdrop.style.pointerEvents='none';
        backdrop.style.visibility='hidden';
        backdrop.setAttribute('aria-hidden','true');
      }

      const views=[...document.querySelectorAll('.view')];
      const active=views.filter(v=>v.classList.contains('active'));
      if(active.length!==1){
        views.forEach(v=>v.classList.remove('active'));
        const fallback=document.getElementById('dashboard')||views[0];
        fallback?.classList.add('active');
      }
      const activeId=document.querySelector('.view.active')?.id;
      if(activeId){
        document.querySelectorAll('.nav-item[data-view]').forEach(b=>{
          const on=b.dataset.view===activeId;
          b.classList.toggle('active',on);
          if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
        });
      }
      state.repairs++;
      report('Auto Repair',reason,activeId||'UI','warning');
      render();
      return true;
    }catch(e){
      report('Repair Failed',e.message||e,'repairUI','error');
      return false;
    }
  }

  function reloadOnce(reason){
    let last=0;try{last=Number(sessionStorage.getItem(RELOAD_KEY)||0)}catch(_){}
    if(now()-last<10*60*1000){
      report('Reload Prevented','Automatic reload loop prevented.',reason,'warning');
      repairUI('Reload loop protection fallback');
      return false;
    }
    try{sessionStorage.setItem(RELOAD_KEY,String(now()))}catch(_){}
    report('Automatic Reload',reason,'Critical recovery','error');
    location.reload();
    return true;
  }

  function criticalCheck(){
    if(document.hidden)return;
    const missing=['appMain','nav','dashboard'].filter(id=>!document.getElementById(id));
    if(missing.length){
      reloadOnce('Critical UI missing: '+missing.join(', '));
      return;
    }
    if(!document.querySelector('.view.active'))repairUI('No active screen detected');
    const loading=state.featureLoads;
    for(const [view,started] of loading){
      if(now()-started>18000){
        loading.delete(view);
        document.documentElement.classList.remove('edu-feature-loading');
        report('Feature Timeout','Recovered a feature that stayed in loading state too long.',view,'error');
        enterSafeMode('Repeated/slow feature loading detected',false);
      }
    }
  }

  function startHeartbeat(){
    let expected=now()+2000;
    setInterval(()=>{
      if(document.hidden){expected=now()+2000;return}
      const current=now(),lag=current-expected;
      expected=current+2000;
      state.lastHeartbeat=current;
      if(lag>2500){
        report('Main Thread Stall','App became unresponsive for about '+Math.round(lag/100)/10+' seconds.','Watchdog','error');
        enterSafeMode('Hang prevention activated after a UI stall',false);
        repairUI('Recovered after UI stall');
      }
    },2000);
  }

  function observeLongTasks(){
    if(!('PerformanceObserver' in window))return;
    try{
      const observer=new PerformanceObserver(list=>{
        const t=now();
        for(const entry of list.getEntries()){
          if(entry.duration<350)continue;
          state.longTasks.push({at:t,duration:entry.duration});
        }
        state.longTasks=state.longTasks.filter(x=>t-x.at<30000);
        if(state.longTasks.filter(x=>x.duration>600).length>=3){
          enterSafeMode('Heavy processing detected; visual effects reduced automatically',false);
        }
      });
      observer.observe({entryTypes:['longtask']});
    }catch(_){}
  }

  function trackError(message,source){
    const t=now();
    state.recentErrors.push({t,message:String(message||'Error')});
    state.recentErrors=state.recentErrors.filter(x=>t-x.t<20000);
    report('Runtime Error',message,source,'error');
    const same=state.recentErrors.filter(x=>x.message===String(message||'Error')).length;
    if(same>=2)repairUI('Repeated runtime error isolated');
    if(state.recentErrors.length>=5)enterSafeMode('Multiple runtime errors detected',false);
  }

  async function withRetry(fn,options={}){
    const retries=Math.max(0,Number(options.retries??2));
    const delay=Math.max(100,Number(options.delay??500));
    const timeoutMs=Math.max(1000,Number(options.timeout??12000));
    const label=String(options.label||'Operation');
    let lastError;
    for(let attempt=0;attempt<=retries;attempt++){
      try{
        return await Promise.race([
          Promise.resolve().then(fn),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error(label+' timed out')),timeoutMs))
        ]);
      }catch(e){
        lastError=e;
        if(attempt<retries){
          report('Automatic Retry',label+' failed. Retrying ('+(attempt+1)+'/'+retries+').',e.message||e,'warning');
          await sleep(delay*Math.pow(2,attempt));
        }
      }
    }
    report('Operation Failed',label+' could not recover automatically.',lastError?.message||lastError,'error');
    throw lastError;
  }

  function beginFeature(view){state.featureLoads.set(String(view),now())}
  function endFeature(view){state.featureLoads.delete(String(view));render()}

  async function refreshServiceWorker(){
    if(!('serviceWorker' in navigator))return {ok:false,label:'Service worker unsupported'};
    try{
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg){await reg.update();return {ok:true,label:'Offline cache updated'}}
      return {ok:true,label:'Service worker will register on next load'};
    }catch(e){
      report('Service Worker',e.message||e,'PWA','warning');
      return {ok:false,label:'Offline cache update failed'};
    }
  }

  async function cloudSessionCheck(){
    const client=window.EDUNIZAM_CLOUD?.state?.client;
    if(!client)return {ok:true,label:'Cloud client not active'};
    try{
      const {error}=await withRetry(()=>client.auth.getSession(),{retries:1,delay:350,timeout:7000,label:'Cloud session check'});
      if(error)throw error;
      return {ok:true,label:'Cloud session responsive'};
    }catch(e){
      return {ok:false,label:'Cloud session needs attention'};
    }
  }

  async function selfCheck(){
    const checks=[];
    const has=id=>!!document.getElementById(id);
    checks.push({name:'Main interface',ok:has('appMain')&&has('dashboard')});
    checks.push({name:'Navigation',ok:has('nav')&&!!document.querySelector('.nav-item[data-view]')});
    checks.push({name:'Active screen',ok:!!document.querySelector('.view.active')});
    let storageOk=false;
    try{
      const k='__edunizam_health_'+now();localStorage.setItem(k,'1');storageOk=localStorage.getItem(k)==='1';localStorage.removeItem(k);
    }catch(_){}
    checks.push({name:'Local storage',ok:storageOk});
    checks.push({name:'Internet',ok:navigator.onLine});
    checks.push({name:'Mobile layout',ok:!!document.querySelector('meta[name="viewport"]')});
    checks.push(await cloudSessionCheck());
    const failed=checks.filter(x=>!x.ok).length;
    if(failed)repairUI('Self-check found '+failed+' issue(s)');
    render(checks);
    return checks;
  }

  async function autoRepair(){
    repairUI('Automatic maintenance');
    await refreshServiceWorker();
    if(navigator.onLine){
      try{await window.EDUNIZAM_ROLE_SCOPE?.refresh?.()}catch(e){report('Role Refresh',e.message||e,'Auto maintenance','warning')}
    }
    return selfCheck();
  }

  function render(checks){
    const badge=document.getElementById('reliabilityStatusBadge');
    const summary=document.getElementById('reliabilitySummary');
    const list=document.getElementById('reliabilityCheckList');
    const events=document.getElementById('reliabilityEventList');
    const perf=document.getElementById('reliabilityPerformance');
    if(badge){
      badge.textContent=state.safeMode?'Protected Mode':(navigator.onLine?'Healthy':'Offline Ready');
      badge.classList.toggle('warning',state.safeMode||!navigator.onLine);
    }
    if(summary)summary.textContent=state.safeMode
      ?'Performance protection is active. Heavy visual effects are reduced to keep the app responsive.'
      :'Auto-Recovery is active and watching the app for errors, stalls and failed feature loads.';
    if(perf)perf.innerHTML='<strong>Protection:</strong> '+(state.safeMode?'On':'Normal')+
      ' · <strong>Auto repairs:</strong> '+state.repairs+
      ' · <strong>Device:</strong> '+(document.documentElement.classList.contains('edu-mobile-performance')?'Mobile':'Desktop')+
      ' · <strong>Network:</strong> '+(navigator.onLine?'Online':'Offline');
    if(list&&checks){
      list.innerHTML=checks.map(x=>'<div class="check-option"><strong>'+(x.ok?'✓':'✕')+'</strong><span>'+esc(x.name||x.label)+'</span></div>').join('');
    }
    if(events){
      const items=readJson(EVENT_KEY,[]).slice(-8).reverse();
      events.innerHTML=items.length?items.map(x=>'<div class="row"><strong>'+esc(x.type)+'</strong><span>'+esc(x.message)+'</span><span>'+esc(new Date(x.at).toLocaleTimeString())+'</span></div>').join(''):'<div class="muted">No reliability problems detected.</div>';
    }
  }

  function wireControls(){
    document.getElementById('runReliabilityCheck')?.addEventListener('click',()=>selfCheck());
    document.getElementById('repairReliabilityNow')?.addEventListener('click',()=>autoRepair());
    document.getElementById('toggleSafePerformance')?.addEventListener('click',()=>{
      if(state.safeMode)exitSafeMode();else enterSafeMode('Enabled manually',true);
      render();
    });
    document.getElementById('clearReliabilityEvents')?.addEventListener('click',()=>{
      writeJson(EVENT_KEY,[]);render();
    });
  }

  window.addEventListener('error',event=>{
    if(event.target&&event.target!==window){
      const tag=String(event.target.tagName||'').toUpperCase();
      const src=event.target.src||event.target.href||event.target.tagName||'Resource';
      if(tag==='SCRIPT'||tag==='LINK')trackError('Critical resource failed to load',src);
      else report('Resource Warning','A non-critical resource failed to load.',src,'warning');
      return;
    }
    trackError(event.message||'JavaScript error',event.filename||'Runtime');
  },true);
  window.addEventListener('unhandledrejection',event=>trackError(event.reason?.message||event.reason||'Unhandled promise rejection','Promise'));
  window.addEventListener('online',()=>{setConnectionStatus();autoRepair().catch(()=>{})});
  window.addEventListener('offline',()=>{setConnectionStatus();render()});
  window.addEventListener('resize',applyPerformanceProfile,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)criticalCheck()});

  function boot(){
    applyPerformanceProfile();
    setConnectionStatus();
    wireControls();
    observeLongTasks();
    startHeartbeat();
    criticalCheck();
    render();
    setInterval(criticalCheck,30000);
    setTimeout(()=>selfCheck().catch(()=>{}),1200);
    setTimeout(()=>refreshServiceWorker().catch(()=>{}),3500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.EDUNIZAM_RELIABILITY={
    state,report,withRetry,beginFeature,endFeature,repairUI,autoRepair,selfCheck,render,
    enterSafeMode,exitSafeMode,refreshServiceWorker
  };
})();