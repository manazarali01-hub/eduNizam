(()=>{
'use strict';
const BUILD='20261005-authstate700', KEY='edunizam_system_build';
const ACTIVE_CACHE='edunizam-v231-auth-state-runtime';
const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
function safeSet(k,v){try{localStorage.setItem(k,v)}catch(_){}}
function safeGet(k){try{return localStorage.getItem(k)}catch(_){return null}}
function repairCommonUI(){
  document.documentElement.classList.remove('edu-feature-loading');
  document.body?.classList.remove('mobile-nav-lock');
  const sidebar=document.querySelector('.sidebar');
  if(sidebar)sidebar.classList.remove('mobile-nav-open');
  const backdrop=document.getElementById('eduMobileNavBackdrop');
  if(backdrop){
    backdrop.classList.remove('show');
    backdrop.style.display='none';
    backdrop.style.pointerEvents='none';
    backdrop.style.visibility='hidden';
    backdrop.setAttribute('aria-hidden','true');
  }
  const menu=document.getElementById('eduMobileMenuBtn');
  if(menu)menu.setAttribute('aria-expanded','false');
  // Never mutate operation-owned disabled/busy state here. A global recovery pass
  // cannot know whether a write is still in flight and could enable a duplicate submit.
  emit('edunizam:auto-corrected',{scope:'common-ui'});
}
async function clearOldCaches(){
  if(!('caches' in window))return;
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('edunizam-')&&k!==ACTIVE_CACHE).map(k=>caches.delete(k)));
}
async function activateUpdate(reg){
  if(reg?.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
  await clearOldCaches();
}
async function checkUpdate(){
  if(!('serviceWorker' in navigator))return;
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    if(!reg)return;
    await reg.update();
    if(reg.waiting)await activateUpdate(reg);
  }catch(e){emit('edunizam:update-check-failed',{message:e.message||String(e)})}
}
function boot(){
  const previous=safeGet(KEY);safeSet(KEY,BUILD);
  repairCommonUI();
  window.addEventListener('online',()=>{checkUpdate();repairCommonUI()});
  window.addEventListener('pageshow',()=>{repairCommonUI();checkUpdate()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate()});
  window.addEventListener('error',()=>setTimeout(repairCommonUI,0));
  window.addEventListener('unhandledrejection',()=>setTimeout(repairCommonUI,0));
  if(previous&&previous!==BUILD)clearOldCaches().catch(()=>{});
  checkUpdate();
  setInterval(checkUpdate,30*60*1000);
}
window.EDUNIZAM_SYSTEM_AUTO={version:BUILD,checkUpdate,repair:repairCommonUI};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();