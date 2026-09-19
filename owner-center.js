(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const localRole=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')?.role||'student'}catch{return'student'}};
  const ready=()=>!!(cfg().enabled&&cloud()?.state?.client&&cloud()?.state?.user);
  let owner=false,plans=[],institutions=[];

  async function isOwner(){
    if(!ready())return false;
    try{
      const {data,error}=await cloud().state.client.rpc('is_platform_admin');
      if(error)throw error;
      return data===true;
    }catch(_){return false}
  }

  function inject(){
    if(document.getElementById('ownerConsoleNav'))return;
    const nav=document.getElementById('nav');if(!nav)return;
    const b=document.createElement('button');
    b.id='ownerConsoleNav';b.className='nav-item';b.innerHTML='👑  Owner Console';
    b.onclick=show;
    const settings=nav.querySelector('[data-view="settings"]');
    settings?nav.insertBefore(b,settings):nav.appendChild(b);

    const main=document.querySelector('main');if(!main)return;
    const sec=document.createElement('section');sec.id='ownerconsole';sec.className='view';
    sec.innerHTML='<div class="section-head"><div><div class="academic-kicker">EduNizam SaaS Management</div><h2>Owner Console</h2><p class="muted">Institutes, plans, trials aur subscriptions manage karein.</p></div><span class="academic-pill">Platform Owner</span></div><div id="ownerConsoleApp"></div>';
    main.appendChild(sec);
  }

  function show(){
    if(!owner)return;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    $('ownerconsole')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(v=>v.classList.remove('active'));
    $('ownerConsoleNav')?.classList.add('active');
    const title=$('page-title');if(title)title.textContent='Owner Console';
    render();
  }

  async function load(){
    if(!ready()||!owner)return;
    const c=cloud().state.client;
    const [p,i]=await Promise.all([
      c.from('subscription_plans').select('*').order('monthly_price_pkr'),
      c.rpc('platform_owner_institutions')
    ]);
    if(p.error)throw p.error;if(i.error)throw i.error;
    plans=p.data||[];institutions=i.data||[];
  }

  function money(v){return 'Rs '+Number(v||0).toLocaleString('en-PK')}
  function metricCards(){
    const active=institutions.filter(x=>x.subscription_status==='active').length;
    const trial=institutions.filter(x=>x.subscription_status==='trialing').length;
    const suspended=institutions.filter(x=>x.subscription_status==='suspended').length;
    const mrr=institutions.filter(x=>x.subscription_status==='active').reduce((a,x)=>a+Number(x.monthly_price_pkr||0),0);
    return '<div class="cards">'+
      '<article class="card stat"><span>Institutes</span><strong>'+institutions.length+'</strong></article>'+
      '<article class="card stat"><span>Active / Trial</span><strong>'+active+' / '+trial+'</strong></article>'+
      '<article class="card stat"><span>Suspended</span><strong>'+suspended+'</strong></article>'+
      '<article class="card stat"><span>Configured MRR</span><strong>'+money(mrr)+'</strong></article>'+
      '</div><p class="coverage-note">Configured MRR plan pricing par based hai; ye received payment/cash figure nahi hai.</p>';
  }

  function planEditor(edit=null){
    const features=Array.isArray(edit?.features)?edit.features.join(', '):'';
    return '<article class="card"><div class="section-head"><div><h3>'+(edit?'Edit Plan':'Create Subscription Plan')+'</h3><p class="muted">Pricing aur usage limits owner control karega.</p></div></div>'+
      '<input id="ownerPlanId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<div class="form-grid">'+
      '<input id="ownerPlanCode" placeholder="Plan code e.g. starter" value="'+esc(edit?.code||'')+'">'+
      '<input id="ownerPlanName" placeholder="Plan name" value="'+esc(edit?.name||'')+'">'+
      '<input id="ownerPlanPrice" type="number" min="0" placeholder="Monthly price PKR" value="'+Number(edit?.monthly_price_pkr||0)+'">'+
      '<input id="ownerPlanTrial" type="number" min="0" placeholder="Trial days" value="'+Number(edit?.trial_days||0)+'">'+
      '<input id="ownerPlanStudents" type="number" min="1" placeholder="Max students (blank = no configured cap)" value="'+esc(edit?.max_students??'')+'">'+
      '<input id="ownerPlanStaff" type="number" min="1" placeholder="Max staff (blank = no configured cap)" value="'+esc(edit?.max_staff??'')+'">'+
      '<input id="ownerPlanAI" type="number" min="0" placeholder="AI requests/day" value="'+esc(edit?.ai_daily_limit??'')+'">'+
      '<input id="ownerPlanFeatures" placeholder="Features comma separated" value="'+esc(features)+'">'+
      '<select id="ownerPlanActive"><option value="true" '+(edit?.active===false?'':'selected')+'>Active</option><option value="false" '+(edit?.active===false?'selected':'')+'>Inactive</option></select>'+
      '<button id="saveOwnerPlan">'+(edit?'Update Plan':'Create Plan')+'</button>'+
      (edit?'<button id="cancelOwnerPlan" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }

  function planCards(){
    return '<div class="paper-grid">'+plans.map(p=>
      '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(p.code)+'</span><span id="profileRiskBadge" data-risk="'+(p.active?'good':'high')+'">'+(p.active?'Active':'Inactive')+'</span></div>'+
      '<h3>'+esc(p.name)+'</h3><p><strong>'+money(p.monthly_price_pkr)+'</strong> / month</p>'+
      '<p class="muted">Trial: '+Number(p.trial_days||0)+' days · Students: '+esc(p.max_students??'—')+' · Staff: '+esc(p.max_staff??'—')+' · AI/day: '+esc(p.ai_daily_limit??'—')+'</p>'+
      '<p>'+esc(Array.isArray(p.features)?p.features.join(', '):'')+'</p>'+
      '<div class="paper-actions"><button data-edit-plan="'+esc(p.id)+'">Edit</button></div></article>'
    ).join('')+'</div>';
  }

  function instituteRows(){
    const planOptions=plans.filter(p=>p.active).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+money(p.monthly_price_pkr)+'</option>').join('');
    return institutions.length?institutions.map(x=>
      '<article class="card" style="margin-bottom:12px">'+
      '<div class="section-head"><div><h3>'+esc(x.institution_name)+'</h3><p class="muted">'+esc(x.institution_type||'Institute')+' · '+x.student_count+' students · '+x.staff_count+' staff</p></div><span class="badge">'+esc(x.subscription_status||'active')+'</span></div>'+
      '<div class="form-grid">'+
      '<select data-owner-plan="'+esc(x.institution_id)+'">'+plans.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===x.plan_id?'selected':'')+'>'+esc(p.name)+' · '+money(p.monthly_price_pkr)+'</option>').join('')+'</select>'+
      '<select data-owner-status="'+esc(x.institution_id)+'">'+['trialing','active','past_due','suspended','cancelled'].map(s=>'<option value="'+s+'" '+(s===x.subscription_status?'selected':'')+'>'+s+'</option>').join('')+'</select>'+
      '<input data-owner-trial="'+esc(x.institution_id)+'" type="date" value="'+(x.trial_ends_at?String(x.trial_ends_at).slice(0,10):'')+'" title="Trial end">'+
      '<input data-owner-period="'+esc(x.institution_id)+'" type="date" value="'+(x.current_period_end?String(x.current_period_end).slice(0,10):'')+'" title="Current period end">'+
      '<button data-save-subscription="'+esc(x.institution_id)+'">Save Subscription</button>'+
      '</div></article>'
    ).join(''):'<div class="empty-state">Abhi koi institute registered nahi hai.</div>';
  }

  async function savePlan(){
    const id=$('ownerPlanId')?.value||'',code=$('ownerPlanCode')?.value.trim().toLowerCase(),name=$('ownerPlanName')?.value.trim();
    if(!code||!name)return alert('Plan code aur name required hain.');
    const payload={
      code,name,
      monthly_price_pkr:Number($('ownerPlanPrice')?.value||0),
      trial_days:Number($('ownerPlanTrial')?.value||0),
      max_students:$('ownerPlanStudents')?.value?Number($('ownerPlanStudents').value):null,
      max_staff:$('ownerPlanStaff')?.value?Number($('ownerPlanStaff').value):null,
      ai_daily_limit:$('ownerPlanAI')?.value!==''?Number($('ownerPlanAI').value):null,
      features:String($('ownerPlanFeatures')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
      active:$('ownerPlanActive')?.value==='true',
      updated_at:new Date().toISOString()
    };
    const q=id?cloud().state.client.from('subscription_plans').update(payload).eq('id',id):cloud().state.client.from('subscription_plans').insert(payload);
    const {error}=await q;if(error)return alert(error.message||error);
    await load();render();
  }

  async function saveSubscription(institutionId){
    const planId=document.querySelector('[data-owner-plan="'+CSS.escape(institutionId)+'"]')?.value;
    const status=document.querySelector('[data-owner-status="'+CSS.escape(institutionId)+'"]')?.value;
    const trial=document.querySelector('[data-owner-trial="'+CSS.escape(institutionId)+'"]')?.value||null;
    const period=document.querySelector('[data-owner-period="'+CSS.escape(institutionId)+'"]')?.value||null;
    if(!planId||!status)return;
    const {error}=await cloud().state.client.from('institution_subscriptions').upsert({
      institution_id:institutionId,plan_id:planId,status,
      trial_ends_at:trial?new Date(trial+'T23:59:59').toISOString():null,
      current_period_end:period?new Date(period+'T23:59:59').toISOString():null,
      updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    },{onConflict:'institution_id'});
    if(error)return alert(error.message||error);
    await load();render();
  }

  async function editPlan(id){
    const p=plans.find(x=>x.id===id);if(!p)return;
    const box=$('ownerPlanEditor');if(box)box.innerHTML=planEditor(p);
    bindPlanEditor();
  }

  function bindPlanEditor(){
    $('saveOwnerPlan')?.addEventListener('click',savePlan);
    $('cancelOwnerPlan')?.addEventListener('click',render);
  }
  function bind(){
    bindPlanEditor();
    document.querySelectorAll('[data-edit-plan]').forEach(b=>b.onclick=()=>editPlan(b.dataset.editPlan));
    document.querySelectorAll('[data-save-subscription]').forEach(b=>b.onclick=()=>saveSubscription(b.dataset.saveSubscription));
  }

  async function render(){
    const root=$('ownerConsoleApp');if(!root||!owner)return;
    root.innerHTML='<div class="coverage-note">Owner data loading...</div>';
    try{
      await load();
      root.innerHTML=metricCards()+
        '<div id="ownerPlanEditor" style="margin-top:16px">'+planEditor()+'</div>'+
        '<div class="section-head" style="margin-top:18px"><div><h3>Plans</h3><p class="muted">Plan pricing aur limits.</p></div></div>'+
        planCards()+
        '<div class="section-head" style="margin-top:18px"><div><h3>Institutes & Subscriptions</h3><p class="muted">Trial, active, past-due ya suspended status control karein.</p></div></div>'+
        instituteRows();
      bind();
    }catch(e){root.innerHTML='<div class="empty-state">Owner Console error: '+esc(e.message||e)+'</div>'}
  }

  async function mountHeadPlanCard(){
    if(localRole()!=='head'||!ready()||!cfg().institutionId||$('currentSubscriptionCard'))return;
    const settings=$('settings');if(!settings)return;
    try{
      const {data,error}=await cloud().state.client.from('institution_subscriptions')
        .select('status,trial_ends_at,current_period_end,subscription_plans(name,code,monthly_price_pkr)')
        .eq('institution_id',cfg().institutionId).maybeSingle();
      if(error||!data)return;
      const card=document.createElement('article');card.className='card';card.id='currentSubscriptionCard';
      const p=data.subscription_plans||{};
      card.innerHTML='<div class="section-head"><div><h2>Current EduNizam Plan</h2><p class="muted">Institute subscription status.</p></div><span class="academic-pill">'+esc(data.status||'active')+'</span></div>'+
        '<p><strong>'+esc(p.name||'Free')+'</strong> · '+money(p.monthly_price_pkr||0)+'/month</p>'+
        '<p class="muted">'+(data.trial_ends_at?'Trial ends: '+esc(String(data.trial_ends_at).slice(0,10))+' · ':'')+(data.current_period_end?'Period ends: '+esc(String(data.current_period_end).slice(0,10)):'')+'</p>';
      settings.prepend(card);
    }catch(_){}
  }

  async function probe(){
    if(!ready()){setTimeout(probe,1200);return}
    owner=await isOwner();
    if(owner){inject()}
    mountHeadPlanCard();
  }

  window.addEventListener('edunizam:auth',()=>setTimeout(probe,150));
  setTimeout(probe,1000);
  window.EDUNIZAM_OWNER_CENTER={probe,show,render,isOwner};
})();