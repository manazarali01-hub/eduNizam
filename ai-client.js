(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;

  function ready(){
    const c=cloud(),x=cfg();
    return !!(x.enabled&&x.supabaseUrl&&x.supabasePublishableKey&&c?.state?.client&&c?.state?.user);
  }

  async function token(){
    const c=cloud();if(!c?.state?.client)throw new Error('Supabase client is not ready.');
    const {data,error}=await c.state.client.auth.getSession();
    if(error)throw error;
    const access=data?.session?.access_token;
    if(!access)throw new Error('Please sign in before using EduNizam AI.');
    return access;
  }

  function endpoint(){
    return String(cfg().supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/ai-assistant';
  }

  async function request(body){
    if(!ready())throw new Error('Cloud backend aur signed-in account required.');
    const access=await token();
    const res=await fetch(endpoint(),{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':cfg().supabasePublishableKey,
        'Authorization':'Bearer '+access
      },
      body:JSON.stringify(body)
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data?.error||('AI request failed (HTTP '+res.status+').'));
    return data;
  }

  function appContext(){
    let settings={};try{settings=JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch(_){}
    let session={};try{session=JSON.parse(localStorage.getItem('edunizam_session')||'{}')}catch(_){}
    return [
      settings.schoolName&&('Institute: '+settings.schoolName),
      settings.schoolType&&('Type: '+settings.schoolType),
      settings.session&&('Academic session: '+settings.session),
      session.role&&('App role: '+session.role)
    ].filter(Boolean).join('\n');
  }

  async function ask(prompt,options={}){
    return request({
      prompt:String(prompt||''),
      context:String(options.context||appContext()),
      institutionId:cfg().institutionId||'',
      mode:options.mode||'general'
    });
  }

  async function health(){
    return request({health:true});
  }

  window.EDUNIZAM_AI={ready,ask,health};
})();