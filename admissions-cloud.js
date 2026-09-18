(function(){
  const cfg=window.EDUNIZAM_CLOUD_CONFIG||{};
  const state={enabled:false,client:null,user:null};

  function ready(){
    return !!(cfg.enabled&&cfg.provider==='supabase'&&cfg.supabaseUrl&&cfg.supabasePublishableKey&&window.supabase?.createClient);
  }
  async function init(){
    if(!ready()){window.EDUNIZAM_CLOUD=api;return api}
    state.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data}=await state.client.auth.getUser();
    state.user=data?.user||null;state.enabled=true;
    state.client.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;window.dispatchEvent(new CustomEvent('edunizam:auth',{detail:{user:state.user}}))});
    window.EDUNIZAM_CLOUD=api;return api;
  }
  async function signUp(email,password,accountRole='student',fullName=''){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    const safeRole=['student','parent'].includes(accountRole)?accountRole:'student';
    return state.client.auth.signUp({email,password,options:{data:{account_role:safeRole,full_name:fullName}}});
  }
  async function signIn(email,password){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    return state.client.auth.signInWithPassword({email,password});
  }
  async function signOut(){
    if(!state.client)return;return state.client.auth.signOut();
  }
  async function sendMagicLink(email){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    return state.client.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:false,emailRedirectTo:window.location.href.split('#')[0]}
    });
  }
  async function sendPasswordReset(email){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    return state.client.auth.resetPasswordForEmail(email,{redirectTo:window.location.href.split('#')[0]});
  }
  function mapApplication(row){
    return {
      institution_id:cfg.institutionId,
      applicant_user_id:state.user?.id||null,
      application_no:row.applicationId,
      status:row.status||'Submitted',
      applicant_name:row.applicantName,
      father_name:row.fatherName||null,
      cnic:row.cnic||null,
      dob:row.dob||null,
      gender:row.gender||null,
      phone:row.phone||null,
      email:row.email||state.user?.email||null,
      address:row.address||null,
      city:row.city||null,
      district:row.district||null,
      program:row.program||null,
      quota:row.quota||null,
      qualification:row.qualification||null,
      previous_institute:row.previousInstitute||null,
      obtained_marks:row.obtainedMarks||null,
      total_marks:row.totalMarks||null,
      percentage:row.percentage||null,
      payment_method:row.paymentMethod||null,
      fee_status:row.feeStatus||'Unpaid',
      fee_reference:row.feeReference||null,
      fee_date:row.feeDate||null,
      test_marks:row.testMarks||null,
      interview_marks:row.interviewMarks||null,
      academic_weight:row.academicWeight??70,
      test_weight:row.testWeight??20,
      interview_weight:row.interviewWeight??10,
      merit_score:row.meritScore||null,
      admin_note:row.adminNote||null,
      metadata:{localCreatedAt:row.createdAt||null,quota:row.quota||null}
    };
  }
  async function createApplication(row){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    if(!state.user)throw new Error('Sign in first.');
    if(!cfg.institutionId)throw new Error('Cloud institutionId is not configured.');
    const payload=mapApplication(row);
    const {data,error}=await state.client.from('applications').insert(payload).select().single();
    if(error)throw error;return data;
  }
  async function syncLocalApplication(row){
    if(!state.client||!state.user||!cfg.institutionId)return null;
    const payload=mapApplication(row);
    const {data,error}=await state.client.from('applications')
      .upsert(payload,{onConflict:'institution_id,application_no'})
      .select().single();
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
  async function getMyRole(){
    if(!state.client||!state.user)return null;
    if(cfg.institutionId){
      const {data:inst}=await state.client.from('institutions').select('owner_user_id').eq('id',cfg.institutionId).maybeSingle();
      if(inst?.owner_user_id===state.user.id)return 'head_of_institute';
      const {data:member,error:memberError}=await state.client.from('institution_members').select('role').eq('institution_id',cfg.institutionId).eq('user_id',state.user.id).maybeSingle();
      if(memberError)throw memberError;
      if(member?.role)return member.role;
    }
    const {data,error}=await state.client.from('user_profiles').select('account_role').eq('user_id',state.user.id).maybeSingle();
    if(error)throw error;return data?.account_role||'student';
  }
  async function getLinkedStudents(){
    if(!state.client||!state.user)return[];
    const {data,error}=await state.client.from('parent_student_links')
      .select('student_user_id,status,user_profiles!parent_student_links_student_user_id_fkey(user_id,full_name,account_role)')
      .eq('parent_user_id',state.user.id).eq('status','approved');
    if(error)throw error;return data||[];
  }
  async function requestParentStudentLink(studentUserId){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    if(!cfg.institutionId)throw new Error('Institution is not configured.');
    const {data,error}=await state.client.from('parent_student_links').upsert({
      parent_user_id:state.user.id,student_user_id:studentUserId,institution_id:cfg.institutionId,status:'pending'
    },{onConflict:'parent_user_id,student_user_id'}).select().single();
    if(error)throw error;return data;
  }
  async function listParentStudentLinks(){
    if(!state.client||!cfg.institutionId)return[];
    const {data,error}=await state.client.from('parent_student_links').select('*').eq('institution_id',cfg.institutionId).order('created_at',{ascending:false});
    if(error)throw error;return data||[];
  }
  async function updateParentStudentLink(parentUserId,studentUserId,status){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    const {data,error}=await state.client.from('parent_student_links').update({status})
      .eq('parent_user_id',parentUserId).eq('student_user_id',studentUserId).select().single();
    if(error)throw error;return data;
  }
  async function assignInstitutionRole(userId,role){
    if(!state.client||!state.user||!cfg.institutionId)throw new Error('Cloud institution is not configured.');
    if(!['teacher','head_of_institute'].includes(role))throw new Error('Invalid staff role.');
    const {data,error}=await state.client.from('institution_members').upsert({
      institution_id:cfg.institutionId,user_id:userId,role
    },{onConflict:'institution_id,user_id'}).select().single();
    if(error)throw error;return data;
  }
  async function createSignedDocumentUrl(path,expiresIn=300){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    const {data,error}=await state.client.storage.from(cfg.admissionsStorageBucket||'admission-documents').createSignedUrl(path,expiresIn);
    if(error)throw error;return data?.signedUrl||null;
  }
  async function logAudit(action,entityType,entityId,details={}){
    if(!state.client||!state.user||!cfg.institutionId)return null;
    const {data,error}=await state.client.from('audit_logs').insert({
      institution_id:cfg.institutionId,user_id:state.user.id,action,entity_type:entityType,entity_id:String(entityId||''),details
    }).select().single();
    if(error)throw error;return data;
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
  async function listPayments(){
    if(!state.client)return[];
    const {data,error}=await state.client.from('payment_records')
      .select('*,applications(application_no,applicant_name,institution_id)')
      .order('created_at',{ascending:false});
    if(error)throw error;return data||[];
  }
  async function updatePaymentStatus(id,status){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const payload={status};
    if(status==='Paid'||status==='Verified'){payload.verified_by=state.user.id;payload.verified_at=new Date().toISOString()}
    const {data,error}=await state.client.from('payment_records').update(payload).eq('id',id).select().single();
    if(error)throw error;return data;
  }
  async function listAuditLogs(limit=50){
    if(!state.client)return[];
    let q=state.client.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(limit);
    if(cfg.institutionId)q=q.eq('institution_id',cfg.institutionId);
    const {data,error}=await q;if(error)throw error;return data||[];
  }
  async function updateCloudApplicationStatus(id,status,note){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const payload={status,updated_at:new Date().toISOString()};
    if(note!==undefined)payload.admin_note=note;
    const {data,error}=await state.client.from('applications').update(payload).eq('id',id).select().single();
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

  const api={state,config:cfg,ready,init,signUp,signIn,signOut,sendMagicLink,sendPasswordReset,mapApplication,createApplication,syncLocalApplication,listMyApplications,listInstitutionApplications,getMyRole,uploadDocument,createSignedDocumentUrl,logAudit,getLinkedStudents,requestParentStudentLink,listParentStudentLinks,updateParentStudentLink,assignInstitutionRole,listPayments,updatePaymentStatus,listAuditLogs,updateCloudApplicationStatus,createPaymentIntent};
  window.EDUNIZAM_CLOUD=api;
  init().catch(e=>console.warn('EduNizam cloud init:',e.message));
})();