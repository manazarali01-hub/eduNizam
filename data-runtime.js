(function(){
  'use strict';

  const inflight=new Map();
  const memory=new Map();

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const statusOf=e=>Number(e?.status||e?.statusCode||e?.context?.status||0);
  const codeOf=e=>String(e?.code||e?.name||'');
  const messageOf=e=>String(e?.message||e||'Unknown error');

  function classify(error){
    const status=statusOf(error),code=codeOf(error),message=messageOf(error);
    if(!navigator.onLine)return 'NETWORK_OFFLINE';
    if(code==='AbortError'||/timed out|timeout/i.test(message))return 'NETWORK_TIMEOUT';
    if(status===401)return 'AUTH_NO_SESSION';
    if(status===403)return 'AUTH_NOT_APPROVED';
    if(status===400)return 'DATA_FETCH_FAILED';
    if([502,503,504].includes(status))return 'SERVER_TEMPORARY_FAILURE';
    if(/failed to fetch|network|load failed/i.test(message))return 'NETWORK_TIMEOUT';
    return 'DATA_FETCH_FAILED';
  }

  function transient(error){
    const type=classify(error);
    return type==='NETWORK_TIMEOUT'||type==='NETWORK_OFFLINE'||type==='SERVER_TEMPORARY_FAILURE';
  }

  function normalized(error,label='Request'){
    return {
      type:classify(error),
      label,
      message:messageOf(error),
      status:statusOf(error)||null,
      code:codeOf(error)||null,
      cause:error
    };
  }

  async function attempt(factory,{timeout=10000,label='Request'}={}){
    const controller=new AbortController();
    let timer;
    try{
      return await Promise.race([
        Promise.resolve().then(()=>factory({signal:controller.signal})),
        new Promise((_,reject)=>{
          timer=setTimeout(()=>{
            controller.abort();
            const e=new Error(label+' timed out.');
            e.name='TimeoutError';
            reject(e);
          },Math.max(500,timeout));
        })
      ]);
    }finally{
      clearTimeout(timer);
    }
  }

  async function run(key,factory,options={}){
    const id=String(key||options.label||'request');
    const cacheMs=Math.max(0,Number(options.cacheMs||0));
    const cached=memory.get(id);
    if(cacheMs&&cached&&Date.now()-cached.at<cacheMs)return cached.value;
    if(inflight.has(id))return inflight.get(id);

    const job=(async()=>{
      const retries=Math.max(0,Number(options.retries??0));
      const baseDelay=Math.max(100,Number(options.delay??350));
      let last;
      for(let i=0;i<=retries;i++){
        try{
          const value=await attempt(factory,{timeout:options.timeout,label:options.label||id});
          if(cacheMs)memory.set(id,{at:Date.now(),value});
          return value;
        }catch(error){
          last=error;
          if(i>=retries||!transient(error))break;
          await sleep(baseDelay*Math.pow(2,i));
        }
      }
      const info=normalized(last,options.label||id);
      window.dispatchEvent(new CustomEvent('edunizam:data-error',{detail:info}));
      if(Object.prototype.hasOwnProperty.call(options,'fallback'))return options.fallback;
      throw last;
    })();

    inflight.set(id,job);
    try{return await job}
    finally{inflight.delete(id)}
  }

  function invalidate(prefix=''){
    const p=String(prefix);
    for(const key of [...memory.keys()])if(!p||key.startsWith(p))memory.delete(key);
  }

  function idle(fn,timeout=2200){
    if('requestIdleCallback' in window)return requestIdleCallback(()=>Promise.resolve().then(fn).catch(()=>{}),{timeout});
    return setTimeout(()=>Promise.resolve().then(fn).catch(()=>{}),Math.min(timeout,900));
  }

  window.EDUNIZAM_DATA_RUNTIME={run,invalidate,idle,classify,transient,normalized};
})();