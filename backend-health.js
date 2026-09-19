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
      for(const [k,v] of Object.entries(data?.tables||{}))checks.push(['Table: '+k,!!v]);
      for(const [k,v] of Object.entries(data?.functions||{}))checks.push(['Function: '+k,!!v]);
      for(const [k,v] of Object.entries(data?.storage||{}))checks.push(['Storage: '+k,!!v]);
      const failed=checks.filter(x=>!x[1]).length;
      grid.innerHTML=checks.map(x=>item(x[0],x[1])).join('');
      summary.textContent=failed?failed+' backend check(s) failed. One-step migration dobara verify karein.':'All backend checks passed. EduNizam cloud schema is ready.';
    }catch(e){
      summary.textContent='Health check failed: '+(e.message||e)+'. Ensure supabase-production-one-step.sql has been applied.';
      grid.innerHTML='';
    }
  }
  setTimeout(mount,0);setTimeout(mount,500);
  window.EDUNIZAM_BACKEND_HEALTH={mount,run};
})();