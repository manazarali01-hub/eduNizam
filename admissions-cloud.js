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
    return state.client.auth.signUp({email,password,options:{emailRedirectTo:'https://manazarali01-hub.github.io/eduNizam/login.html?verified=1',data:{account_role:safeRole,full_name:fullName}}});
  }
  async function resendSignupConfirmation(email){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    return state.client.auth.resend({
      type:'signup',
      email,
      options:{emailRedirectTo:'https://manazarali01-hub.github.io/eduNizam/login.html?verified=1'}
    });
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
    return state.client.auth.resetPasswordForEmail(email,{redirectTo:'https://manazarali01-hub.github.io/eduNizam/login.html?reset=1'});
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
    const {data:owned,error:ownedError}=await state.client.from('institutions').select('id').eq('owner_user_id',state.user.id).limit(1);
    if(ownedError)throw ownedError;
    if(owned?.length)return 'head_of_institute';
    const {data,error}=await state.client.from('user_profiles').select('account_role').eq('user_id',state.user.id).maybeSingle();
    if(error)throw error;return data?.account_role||'student';
  }
  async function listMyInstitutions(){
    if(!state.client||!state.user)return[];
    const [{data:owned,error:ownedError},{data:memberships,error:memberError},{data:profile,error:profileError}]=await Promise.all([
      state.client.from('institutions').select('*').eq('owner_user_id',state.user.id).order('created_at',{ascending:true}),
      state.client.from('institution_members').select('role,institutions(*)').eq('user_id',state.user.id),
      state.client.from('user_profiles').select('institution_id').eq('user_id',state.user.id).maybeSingle()
    ]);
    if(ownedError)throw ownedError;
    if(memberError)throw memberError;
    if(profileError)throw profileError;
    let profileInstitution=null;
    if(profile?.institution_id){
      const {data,error}=await state.client.from('institutions').select('*').eq('id',profile.institution_id).maybeSingle();
      if(error)throw error;profileInstitution=data||null;
    }
    const merged=[...(owned||[]),...((memberships||[]).map(x=>x.institutions).filter(Boolean)),...(profileInstitution?[profileInstitution]:[])];
    return [...new Map(merged.map(x=>[x.id,x])).values()];
  }
  async function createInstitution(){
    throw new Error('Create the school account from the Admin Sign Up screen.');
  }
  async function getLinkedStudents(){
    if(!state.client||!state.user)return[];
    const {data,error}=await state.client.from('parent_student_links')
      .select('student_user_id,status,user_profiles!parent_student_links_student_user_id_fkey(user_id,full_name,account_role)')
      .eq('parent_user_id',state.user.id).eq('status','approved');
    if(error)throw error;return data||[];
  }
  async function requestParentStudentLink(){
    throw new Error('Use the Student Code link flow so the child is verified inside the same school.');
  }
  async function listParentStudentLinks(){
    if(!state.client||!cfg.institutionId)return[];
    const {data:links,error}=await state.client.from('parent_student_links').select('*').eq('institution_id',cfg.institutionId).order('created_at',{ascending:false});
    if(error)throw error;
    if(!links?.length)return[];
    const parentIds=[...new Set(links.map(x=>x.parent_user_id).filter(Boolean))];
    const studentIds=[...new Set(links.map(x=>x.student_user_id).filter(Boolean))];
    const [parentsRes,studentsRes]=await Promise.all([
      parentIds.length?state.client.from('user_profiles').select('user_id,full_name').eq('institution_id',cfg.institutionId).in('user_id',parentIds):Promise.resolve({data:[],error:null}),
      studentIds.length?state.client.from('core_students').select('auth_user_id,name,class_name,student_code').eq('institution_id',cfg.institutionId).in('auth_user_id',studentIds):Promise.resolve({data:[],error:null})
    ]);
    if(parentsRes.error)throw parentsRes.error;
    if(studentsRes.error)throw studentsRes.error;
    const pm=new Map((parentsRes.data||[]).map(x=>[x.user_id,x.full_name||'Parent']));
    const sm=new Map((studentsRes.data||[]).map(x=>[x.auth_user_id,x]));
    return links.map(x=>({
      ...x,
      parent_name:pm.get(x.parent_user_id)||'Parent / Guardian',
      student_name:sm.get(x.student_user_id)?.name||'Student',
      student_class:sm.get(x.student_user_id)?.class_name||'',
      student_code:sm.get(x.student_user_id)?.student_code||''
    }));
  }
  async function updateParentStudentLink(parentUserId,studentUserId,status){
    if(!state.client||!cfg.institutionId)throw new Error('Cloud institution is not configured.');
    const {data,error}=await state.client.from('parent_student_links').update({status})
      .eq('institution_id',cfg.institutionId)
      .eq('parent_user_id',parentUserId).eq('student_user_id',studentUserId).select().single();
    if(error)throw error;return data;
  }
  async function assignInstitutionRole(){
    throw new Error('Direct staff-role assignment is disabled. Teacher access must be approved by the School Admin.');
  }
  async function claimInstitutionInvite(code){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const {data,error}=await state.client.rpc('claim_institution_invite',{p_code:String(code||'').trim()});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(row?.institution_id){
      cfg.institutionId=row.institution_id;
      try{
        const saved=JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}');
        saved.institutionId=row.institution_id;saved.enabled=true;
        localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify(saved));
      }catch(_){}
    }
    return row||null;
  }
  async function requestTeacherAccess(inviteCode,staffCode){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const {data,error}=await state.client.rpc('request_teacher_access',{
      p_invite_code:String(inviteCode||'').trim(),
      p_staff_code:String(staffCode||'').trim()
    });
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(row?.institution_id){
      cfg.institutionId=row.institution_id;
      try{
        const saved=JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}');
        saved.institutionId=row.institution_id;saved.enabled=true;
        localStorage.setItem('edunizam_cloud_runtime_config',JSON.stringify(saved));
      }catch(_){}
    }
    return row||null;
  }
  async function listTeacherAccessRequests(){
    if(!state.client||!state.user||!cfg.institutionId)return[];
    const {data,error}=await state.client.rpc('list_teacher_access_requests',{p_institution_id:cfg.institutionId});
    if(error)throw error;return data||[];
  }
  async function decideTeacherAccess(requestId,approve,note=''){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const {data,error}=await state.client.rpc('decide_teacher_access',{
      p_request_id:requestId,p_approve:!!approve,p_note:String(note||'')
    });
    if(error)throw error;return Array.isArray(data)?data[0]:data;
  }
  async function createInstitutionInvite(targetRole,maxUses=1,validDays=7){
    if(!state.client||!state.user||!cfg.institutionId)throw new Error('Cloud institution is not configured.');
    if(!['teacher','student','parent'].includes(targetRole))throw new Error('Invalid invite role.');
    const code='EN-'+Math.random().toString(36).slice(2,8).toUpperCase();
    const expires=new Date(Date.now()+Math.max(1,Number(validDays||7))*86400000).toISOString();
    const {data,error}=await state.client.from('institution_invites').insert({
      institution_id:cfg.institutionId,code,target_role:targetRole,created_by:state.user.id,
      expires_at:expires,max_uses:Math.max(1,Number(maxUses||1))
    }).select().single();
    if(error)throw error;return data;
  }
  async function listInstitutionInvites(){
    if(!state.client||!cfg.institutionId)return[];
    const {data,error}=await state.client.from('institution_invites').select('*').eq('institution_id',cfg.institutionId).order('created_at',{ascending:false}).limit(50);
    if(error)throw error;return data||[];
  }
  async function requestParentLinkByStudentCode(studentCode){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const {data,error}=await state.client.rpc('request_parent_link_by_student_code',{p_student_code:String(studentCode||'').trim()});
    if(error)throw error;return data;
  }
  async function claimStudentRecord(studentCode){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const {data,error}=await state.client.rpc('claim_student_account_v1',{p_student_code:String(studentCode||'').trim()});
    if(error)throw error;return Array.isArray(data)?data[0]:data;
  }
  async function listInstitutionTeachers(){
    if(!state.client||!cfg.institutionId)return[];
    const {data,error}=await state.client.from('institution_members')
      .select('user_id,role,user_profiles!institution_members_user_id_fkey(full_name)')
      .eq('institution_id',cfg.institutionId).eq('role','teacher');
    if(error)throw error;
    return (data||[]).map(x=>({user_id:x.user_id,role:x.role,full_name:x.user_profiles?.full_name||''}));
  }
  async function listLinkedCoreStudents(){
    if(!state.client||!cfg.institutionId)return[];
    const {data,error}=await state.client.from('core_students')
      .select('id,auth_user_id,name,class_name,student_code')
      .eq('institution_id',cfg.institutionId).not('auth_user_id','is',null).order('name');
    if(error)throw error;return data||[];
  }
  async function listTeacherStudentLinks(){
    if(!state.client||!cfg.institutionId)return[];
    const {data,error}=await state.client.from('teacher_student_links')
      .select('teacher_user_id,student_user_id').eq('institution_id',cfg.institutionId);
    if(error)throw error;
    const [teachers,students]=await Promise.all([listInstitutionTeachers(),listLinkedCoreStudents()]);
    const tm=new Map(teachers.map(x=>[x.user_id,x.full_name||x.user_id]));
    const sm=new Map(students.map(x=>[x.auth_user_id,x.name||x.auth_user_id]));
    return (data||[]).map(x=>({...x,teacher_name:tm.get(x.teacher_user_id),student_name:sm.get(x.student_user_id)}));
  }
  async function assignTeacherStudent(teacherUserId,studentUserId){
    if(!state.client||!state.user||!cfg.institutionId)throw new Error('Cloud institution is not configured.');
    const {data,error}=await state.client.from('teacher_student_links').upsert({
      institution_id:cfg.institutionId,teacher_user_id:teacherUserId,student_user_id:studentUserId,assigned_by:state.user.id
    },{onConflict:'teacher_user_id,student_user_id'}).select().single();
    if(error)throw error;return data;
  }
  async function removeTeacherStudentLink(teacherUserId,studentUserId){
    if(!state.client)throw new Error('Cloud backend is not configured.');
    const {error}=await state.client.from('teacher_student_links').delete()
      .eq('teacher_user_id',teacherUserId).eq('student_user_id',studentUserId);
    if(error)throw error;return true;
  }
  async function listMyTeacherAssignments(){
    if(!state.client||!state.user||!cfg.institutionId)return[];
    const {data,error}=await state.client.from('teacher_student_links')
      .select('student_user_id').eq('institution_id',cfg.institutionId).eq('teacher_user_id',state.user.id);
    if(error)throw error;return (data||[]).map(x=>x.student_user_id);
  }
  async function listApprovedParentsForStudent(studentUserId){
    if(!state.client||!cfg.institutionId||!studentUserId)return[];
    const {data,error}=await state.client.from('parent_student_links')
      .select('parent_user_id').eq('institution_id',cfg.institutionId)
      .eq('student_user_id',studentUserId).eq('status','approved');
    if(error)throw error;return (data||[]).map(x=>x.parent_user_id);
  }
  async function listMyNotifications(){
    if(!state.client||!state.user)return[];
    const {data,error}=await state.client.from('user_notifications').select('*')
      .eq('recipient_user_id',state.user.id).order('created_at',{ascending:false}).limit(100);
    if(error)throw error;return data||[];
  }
  async function markNotificationRead(id){
    if(!state.client||!state.user)throw new Error('Sign in first.');
    const {data,error}=await state.client.from('user_notifications').update({read_at:new Date().toISOString()})
      .eq('id',id).eq('recipient_user_id',state.user.id).select().single();
    if(error)throw error;return data;
  }
  async function sendNotification(recipientUserId,title,body,category='general'){
    if(!state.client||!state.user||!cfg.institutionId)throw new Error('Cloud institution is not configured.');
    const {data,error}=await state.client.from('user_notifications').insert({
      institution_id:cfg.institutionId,recipient_user_id:recipientUserId,created_by:state.user.id,
      title:String(title||'Notification'),body:String(body||''),category:String(category||'general')
    }).select().single();
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

  const api={state,config:cfg,ready,init,signUp,resendSignupConfirmation,signIn,signOut,sendMagicLink,sendPasswordReset,mapApplication,createApplication,syncLocalApplication,listMyApplications,listInstitutionApplications,getMyRole,listMyInstitutions,createInstitution,claimInstitutionInvite,requestTeacherAccess,listTeacherAccessRequests,decideTeacherAccess,createInstitutionInvite,listInstitutionInvites,requestParentLinkByStudentCode,claimStudentRecord,listInstitutionTeachers,listLinkedCoreStudents,listTeacherStudentLinks,assignTeacherStudent,removeTeacherStudentLink,listMyTeacherAssignments,listApprovedParentsForStudent,listMyNotifications,markNotificationRead,sendNotification,uploadDocument,createSignedDocumentUrl,logAudit,getLinkedStudents,requestParentStudentLink,listParentStudentLinks,updateParentStudentLink,assignInstitutionRole,listPayments,updatePaymentStatus,listAuditLogs,updateCloudApplicationStatus,createPaymentIntent};
  window.EDUNIZAM_CLOUD=api;
  init().catch(e=>console.warn('EduNizam cloud init:',e.message));
})();
