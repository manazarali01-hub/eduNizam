(function(){
  const rawGet=Storage.prototype.getItem;
  const rawSet=Storage.prototype.setItem;
  const rawRemove=Storage.prototype.removeItem;
  const CONFIG_KEY='edunizam_cloud_runtime_config';
  const MIGRATION_KEY='edunizam_storage_scope_migrated_v1';
  const GLOBAL_KEYS=new Set([
    CONFIG_KEY,
    'edunizam_session',
    'edunizam_cloud_user_id',
    'edunizam_pending_signup',
    'edunizam_verify_email',
    MIGRATION_KEY
  ]);

  function activeInstitution(){
    try{
      const cfg=JSON.parse(rawGet.call(localStorage,CONFIG_KEY)||'{}');
      return String(cfg.institutionId||'').trim();
    }catch(_){return ''}
  }

  function shouldScope(key){
    return typeof key==='string' && key.startsWith('edunizam_') && !GLOBAL_KEYS.has(key);
  }

  function scopedKey(key){
    const inst=activeInstitution();
    return inst&&shouldScope(key)?'edunizam_school:'+inst+':'+key:key;
  }

  // One-time migration of legacy unscoped school data into the first active institute.
  try{
    const inst=activeInstitution();
    if(inst && !rawGet.call(localStorage,MIGRATION_KEY)){
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&shouldScope(k)&&!k.startsWith('edunizam_school:'))keys.push(k);
      }
      for(const k of keys){
        const v=rawGet.call(localStorage,k);
        if(v!==null)rawSet.call(localStorage,'edunizam_school:'+inst+':'+k,v);
      }
      rawSet.call(localStorage,MIGRATION_KEY,JSON.stringify({institutionId:inst,migratedAt:Date.now()}));
    }
  }catch(e){console.warn('EduNizam storage migration:',e.message||e)}

  Storage.prototype.getItem=function(key){
    return rawGet.call(this,this===localStorage?scopedKey(key):key);
  };
  Storage.prototype.setItem=function(key,value){
    return rawSet.call(this,this===localStorage?scopedKey(key):key,value);
  };
  Storage.prototype.removeItem=function(key){
    return rawRemove.call(this,this===localStorage?scopedKey(key):key);
  };

  window.EDUNIZAM_STORAGE_SCOPE={
    activeInstitution,
    scopedKey,
    isSchoolScoped:key=>shouldScope(key)
  };
})();