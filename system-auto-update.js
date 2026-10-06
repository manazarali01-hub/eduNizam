(()=>{
'use strict';
const BUILD='20261006-guestlearning1640', KEY='edunizam_system_build';
const ACTIVE_CACHE='edunizam-v238-guest-learning';
const emit=(name,detail={})=>window.dispatchEvent(new CustomEvent(name,{detail}));
function safeSet(k,v){try{localStorage.setItem(k,v)}catch(_){}}
function safeGet(k){try{return localStorage.getItem(k)}catch(_){return null}}
function repairCommonUI(){
  document.documentElement.classList.remove('edu-feature-loading');
  const sidebar=document.querySelector('.sidebar');
  const open=!!sidebar?.classList.contains('mobile-nav-open');
  const backdrop=document.getElementById('eduMobileNavBackdrop');
  const menu=document.getElementById('eduMobileMenuBtn');
  if(!open){
    document.body?.classList.remove('mobile-nav-lock');
    if(backdrop){
      backdrop.classList.remove('show');
      backdrop.style.display='none';
      backdrop.style.pointerEvents='none';
      backdrop.style.visibility='hidden';
      backdrop.setAttribute('aria-hidden','true');
    }
    if(menu)menu.setAttribute('aria-expanded','false');
  }else{
    document.body?.classList.add('mobile-nav-lock');
    if(backdrop){
      backdrop.classList.add('show');
      backdrop.style.display='block';
      backdrop.style.pointerEvents='auto';
      backdrop.style.visibility='visible';
      backdrop.setAttribute('aria-hidden','false');
    }
    if(menu)menu.setAttribute('aria-expanded','true');
  }
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
  window.addEventListener('error',()=>emit('edunizam:runtime-warning',{type:'error'}));
  window.addEventListener('unhandledrejection',()=>emit('edunizam:runtime-warning',{type:'promise'}));
  if(previous&&previous!==BUILD)clearOldCaches().catch(()=>{});
  checkUpdate();
  setInterval(checkUpdate,30*60*1000);
}
window.EDUNIZAM_SYSTEM_AUTO={version:BUILD,checkUpdate,repair:repairCommonUI};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();