(function(){
  const cloud=()=>window.EDUNIZAM_CLOUD;
  function mount(){
    const settings=document.getElementById('settings');if(!settings||document.getElementById('backendHealthCard'))return;
    const card=document.createElement('article');card.className='card';card.id='backendHealthCard';
    card.innerHTML='<div class="section-head"><div><h2>Backend Health Check</h2><p class="muted">Supabase production schema aur services verify karein.</p></div><button id="runBackendHealth" class="secondary">Run Check</button></div><div id="backendHealthSummary" class="coverage-note">Cloud connect hone ke baad check run karein.</div><div id="backendHealthGrid" class="check-grid" style="margin-top:12px"></div>';
    settings.appendChild(card);
    card.querySelector('#runBackendHealth').onclick=run;
  }
  function item(name,ok){
    return '<div class="check-option"><strong>'+(ok?'✓':'✕')+'</strong><span>'+name+'</span></div>';
  }
  async function run(){
    const summary=document.getElementById('backendHealthSummary'),grid=document.getElementById('backendHealthGrid');
    const c=cloud();
    if(!c?.state?.client||!c?.state?.user){summary.textContent='Cloud backend connected aur signed-in account required.';grid.innerHTML='';return}
    try{
      summary.textContent='Checking backend...';
      const {data,error}=await c.state.client.rpc('edunizam_health_check');
      if(error)throw error;
      const checks=[];
      checks.push(['Authenticated',!!data?.authenticated]);
      try{
        const roleCheck=await c.state.client.rpc('current_account_role');
        checks.push(['Role approval service',!roleCheck.error]);
        if((window.EDUNIZAM_ROLE_SCOPE?.role?.()||'')==='head'){
          const reqCheck=await c.state.client.from('school_access_requests').select('id',{count:'exact',head:true});
          checks.push(['Access request system',!reqCheck.error]);
        }
      }catch(_){
        checks.push(['Role approval service',false]);
      }
      for(const [k,v] of Object.entries(data?.tables||{}))checks.push(['Table: '+k,!!v]);
      for(const [k,v] of Object.entries(data?.functions||{}))checks.push(['Function: '+k,!!v]);
      for(const [k,v] of Object.entries(data?.storage||{}))checks.push(['Storage: '+k,!!v]);

      let aiInfo=null;
      if(window.EDUNIZAM_AI?.ready?.()){
        try{
          aiInfo=await window.EDUNIZAM_AI.health();
          checks.push(['AI Edge Function reachable',!!aiInfo?.ok]);
          checks.push(['OpenAI API key configured',!!aiInfo?.configured]);
        }catch(e){
          checks.push(['AI Edge Function reachable',false]);
          aiInfo={error:e.message||String(e)};
        }
      }else{
        checks.push(['AI client signed-in/ready',false]);
      }

      const failed=checks.filter(x=>!x[1]).length;
      grid.innerHTML=checks.map(x=>item(x[0],x[1])).join('')+
        (aiInfo?.ok?'<div class="coverage-note" style="margin-top:10px"><strong>AI:</strong> Model '+String(aiInfo.model||'default')+' · Daily limit '+Number(aiInfo.dailyLimit||0)+'</div>':
        (aiInfo?.error?'<div class="coverage-note" style="margin-top:10px"><strong>AI:</strong> '+String(aiInfo.error)+'</div>':''));
      summary.textContent=failed?failed+' backend/AI check(s) need attention.':'All backend and AI checks passed. EduNizam cloud services are ready.';
    }catch(e){
      summary.textContent='Health check failed: '+(e.message||e)+'. Verify the production migration, Cloud Setup and Edge Function deployment.';
      grid.innerHTML='';
    }
  }
  setTimeout(mount,0);setTimeout(mount,500);
  window.EDUNIZAM_BACKEND_HEALTH={mount,run};
})();