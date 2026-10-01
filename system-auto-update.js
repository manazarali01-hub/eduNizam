(()=>{
'use strict';
const BUILD='20261001-visitor202', KEY='edunizam_system_build', RELOAD='edunizam_update_reload';
const ACTIVE_CACHE='edunizam-v190-visitor202';
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
  document.querySelectorAll('[aria-busy="true"]').forEach(x=>x.removeAttribute('aria-busy'));
  document.querySelectorAll('button[disabled]').forEach(btn=>{
    const t=(btn.textContent||'').toLowerCase();
    if(/loading|saving|sending|checking|processing|signing/.test(t))btn.disabled=false;
  });
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
function controlledReload(){
  const last=Number(sessionStorage.getItem(RELOAD)||0);
  if(Date.now()-last<60000)return;
  sessionStorage.setItem(RELOAD,String(Date.now()));
  location.reload();
}
function boot(){
  const previous=safeGet(KEY);safeSet(KEY,BUILD);
  repairCommonUI();
  window.addEventListener('online',()=>{checkUpdate();repairCommonUI()});
  window.addEventListener('pageshow',()=>{repairCommonUI();checkUpdate()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate()});
  window.addEventListener('error',()=>setTimeout(repairCommonUI,0));
  window.addEventListener('unhandledrejection',()=>setTimeout(repairCommonUI,0));
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',controlledReload);
    navigator.serviceWorker.addEventListener('message',e=>{
      if(e.data?.type==='EDUNIZAM_UPDATE_READY')controlledReload();
    });
  }
  if(previous&&previous!==BUILD){clearOldCaches().then(controlledReload)}
  checkUpdate();
  setInterval(checkUpdate,30*60*1000);
}
window.EDUNIZAM_SYSTEM_AUTO={version:BUILD,checkUpdate,repair:repairCommonUI};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();