(function(){
  const cfg=window.EDUNIZAM_CLOUD_CONFIG||{};
  const state={enabled:false,client:null,user:null};

  function ready(){
    return !!(cfg.enabled&&cfg.provider==='supabase'&&cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase?.createClient);
  }
  async function init(){
    if(!ready()){window.EDUNIZAM_CLOUD=api;return api}
    state.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
    const {data}=await state.client.auth.getUser();
    state.user=data?.user||null;state.enabled=true;
    state.client.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;window.dispatchEvent(new CustomEvent('edunizam:auth',{detail:{user:state.user}}))});
    window.EDUNIZAM_CLOUD=api;return api;
  }
  async function signUp(email,password){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    return state.client.auth.signUp({email,password});
  }
  async function signIn(email,password){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    return state.client.auth.signInWithPassword({email,password});
  }
  async function signOut(){
    if(!state.client)return;return state.client.auth.signOut();
  }
  async function createApplication(row){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    const user=state.user;if(!user)throw new Error('Sign in first.');
    const payload={...row,applicant_user_id:user.id,institution_id:cfg.institutionId};
    const {data,error}=await state.client.from('applications').insert(payload).select().single();
    if(error)throw error;return data;
  }
  async function listMyApplications(){
    if(!state.client||!state.user)return[];
    const {data,error}=await state.client.from('applications').select('*').eq('applicant_user_id',state.user.id).order('created_at',{ascending:false});
    if(error)throw error;return data||[];
  }
  async function listInstitutionApplications(){
    if(!state.client)return[];
    let q=state.client.from('applications').select('*').order('created_at',{ascending:false});
    if(cfg.institutionId)q=q.eq('institution_id',cfg.institutionId);
    const {data,error}=await q;if(error)throw error;return data||[];
  }
  async function uploadDocument(applicationId,kind,file){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    const path=(cfg.institutionId||'institution')+'/'+applicationId+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const {error:upErr}=await state.client.storage.from(cfg.admissionsStorageBucket||'admission-documents').upload(path,file,{upsert:false});
    if(upErr)throw upErr;
    const {data,error}=await state.client.from('application_documents').insert({
      application_id:applicationId,uploaded_by:state.user?.id||null,kind,storage_path:path,original_name:file.name,mime_type:file.type,size_bytes:file.size
    }).select().single();
    if(error)throw error;return data;
  }
  async function createPaymentIntent({applicationId,method,amount,currency='PKR'}){
    if(!cfg.paymentApiBaseUrl)throw new Error('Live payment gateway is not connected.');
    const token=(await state.client?.auth.getSession())?.data?.session?.access_token||'';
    const r=await fetch(cfg.paymentApiBaseUrl.replace(/\/$/,'')+'/payments/create',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({applicationId,method,amount,currency})
    });
    if(!r.ok)throw new Error('Payment request failed.');return r.json();
  }

  const api={state,config:cfg,ready,init,signUp,signIn,signOut,createApplication,listMyApplications,listInstitutionApplications,uploadDocument,createPaymentIntent};
  window.EDUNIZAM_CLOUD=api;
  init().catch(e=>console.warn('EduNizam cloud init:',e.message));
})();