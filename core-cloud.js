(function(){
  let pullInFlight=null;
  let lastPullAt=0;
  const cfg=window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const read=(k,f)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(f));
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function fallbackStudentCode(s){
    const raw=String(Number(s?.id)||Date.now()).replace(/\D/g,'').slice(-8).padStart(8,'0');
    return 'STU-'+raw;
  }
  function studentPayload(s,c){
    return {
      institution_id:cfg.institutionId,
      local_id:Number(s.id),
      auth_user_id:s.authUserId||null,
      name:s.name,
      guardian_name:s.father||null,
      class_name:s.className||null,
      section_name:s.sectionName||null,
      phone:s.phone||null,
      b_form_no:s.bFormNo||null,
      guardian_cnic:s.guardianCnic||null,
      date_of_birth:s.dateOfBirth||null,
      admission_no:s.admissionNo||null,
      address:s.address||null,
      guardian_occupation:s.guardianOccupation||null,
      caste:s.caste||null,
      roll_no:s.rollNo||null,
      student_code:s.studentId||fallbackStudentCode(s),
      admission_application_id:s.admissionApplicationId||null,
      admission_date:s.admissionDate||null,
      fee_snapshot:s.feeSnapshot||null,
      photo_path:s.photoPath||null,
      profile_details:{
        ...(s.profileDetails||{}),
        gender:s.gender||s.profileDetails?.gender||null,
        mother_name:s.motherName||s.profileDetails?.mother_name||null,
        email:s.email||s.profileDetails?.email||null,
        city:s.city||s.profileDetails?.city||null,
        district:s.district||s.profileDetails?.district||null,
        province:s.province||s.profileDetails?.province||null,
        blood_group:s.bloodGroup||s.profileDetails?.blood_group||null,
        emergency_contact:s.emergencyContact||s.profileDetails?.emergency_contact||null,
        previous_school:s.previousSchool||s.profileDetails?.previous_school||null,
        student_status:s.studentStatus||s.profileDetails?.student_status||'active',
        health_notes:s.healthNotes||s.profileDetails?.health_notes||null,
        special_needs_notes:s.specialNeedsNotes||s.profileDetails?.special_needs_notes||null,
        remarks:s.remarks||s.profileDetails?.remarks||null
      },
      source:s.source||'manual',
      created_by:c.state.user?.id||null,
      updated_at:new Date().toISOString()
    };
  }

  function ready(){
    return !!(cloud()?.ready?.() && cloud()?.state?.client && cfg.institutionId);
  }
  async function requireStaff(){
    const c=cloud(); if(!ready()) throw new Error('Cloud backend is not configured.');
    const role=await c.getMyRole();
    if(!['teacher','head_of_institute'].includes(role)) throw new Error('Teacher or Head of Institute access required.');
    return c;
  }
  async function studentMap(){
    const c=cloud(),client=c.state.client;
    const {data,error}=await client
      .from('core_students')
      .select('id,local_id,auth_user_id,name,class_name')
      .eq('institution_id',cfg.institutionId);
    if(error) throw error;
    return new Map((data||[]).map(x=>[Number(x.local_id),x]));
  }

  async function syncSettings(){
    const c=await requireStaff(),client=c.state.client,s=read('edunizam_settings',{});
    const payload={
      institution_id:cfg.institutionId,
      school_name:s.schoolName||'My School',
      school_type:s.schoolType||'School',
      tagline:s.tagline||'',
      academic_session:s.session||'',
      phone:s.phone||'',
      address:s.address||'',
      updated_by:c.state.user?.id||null,
      updated_at:new Date().toISOString()
    };
    const {error}=await client.from('institution_settings').upsert(payload,{onConflict:'institution_id'});
    if(error) throw error;
  }

  async function upsertStudent(student){
    const c=await requireHead(),client=c.state.client;
    if(!student?.id||!String(student?.name||'').trim())throw new Error('Student name and local record id are required.');
    const payload=studentPayload(student,c);
    const {data,error}=await client
      .from('core_students')
      .upsert(payload,{onConflict:'institution_id,local_id'})
      .select()
      .single();
    if(error)throw error;
    return data;
  }

  async function syncStudents(){
    const c=await requireHead(),client=c.state.client;
    const rows=read('edunizam_students',[]).map(s=>studentPayload(s,c));
    if(!rows.length) return [];
    const {data,error}=await client.from('core_students').upsert(rows,{onConflict:'institution_id,local_id'}).select();
    if(error) throw error; return data||[];
  }

  async function saveAttendanceDay(date,day){
    const c=await requireStaff(),client=c.state.client;
    const map=await studentMap();
    const rows=[];
    for(const [localId,status] of Object.entries(day||{})){
      const student=map.get(Number(localId));if(!student)continue;
      rows.push({
        institution_id:cfg.institutionId,
        student_id:student.id,
        attendance_date:date,
        status,
        marked_by:c.state.user?.id||null,
        updated_at:new Date().toISOString()
      });
    }
    if(!rows.length)return {ok:true,saved:0};
    const {error}=await client.from('attendance_records').upsert(rows,{onConflict:'student_id,attendance_date'});
    if(error)throw error;
    return {ok:true,saved:rows.length};
  }

  async function syncAttendance(map){
    const c=cloud(),client=c.state.client,days=read('edunizam_attendance',{});
    const rows=[];
    for(const [date,day] of Object.entries(days)){
      for(const [localId,status] of Object.entries(day||{})){
        const student=map.get(Number(localId)); if(!student) continue;
        rows.push({
          institution_id:cfg.institutionId,student_id:student.id,attendance_date:date,status,
          marked_by:c.state.user?.id||null,updated_at:new Date().toISOString()
        });
      }
    }
    if(!rows.length) return;
    const {error}=await client.from('attendance_records').upsert(rows,{onConflict:'student_id,attendance_date'});
    if(error) throw error;
  }

  async function syncFees(map){
    const c=cloud(),client=c.state.client;
    const rows=read('edunizam_fees',[]).map(f=>{
      const student=map.get(Number(f.studentId)); if(!student) return null;
      return {
        institution_id:cfg.institutionId,local_id:Number(f.id),student_id:student.id,
        amount:Number(f.amount||0),status:f.status||'Pending',fee_date:f.date||null,
        metadata:{},created_by:c.state.user?.id||null,updated_at:new Date().toISOString()
      };
    }).filter(Boolean);
    if(!rows.length)return;
    const {error}=await client.from('fee_records').upsert(rows,{onConflict:'institution_id,local_id'});
    if(error)throw error;
  }

  async function saveResultRecord(record){
    const c=await requireStaff(),client=c.state.client;
    if(!record?.studentId||!String(record?.subject||'').trim())throw new Error('Student and subject are required.');
    const map=await studentMap();
    const student=map.get(Number(record.studentId));
    if(!student)throw new Error('Student cloud record is not linked.');
    const payload={
      institution_id:cfg.institutionId,
      local_id:Number(record.id),
      student_id:student.id,
      subject:String(record.subject).trim(),
      marks:Number(record.marks||0),
      total:Number(record.total||0),
      assessment_date:record.date||null,
      assessment_type:record.type||null,
      metadata:record.metadata||{},
      created_by:c.state.user?.id||null,
      updated_at:new Date().toISOString()
    };
    if(!Number.isFinite(payload.marks)||!Number.isFinite(payload.total)||payload.total<=0||payload.marks<0||payload.marks>payload.total){
      throw new Error('Valid marks and total are required.');
    }
    const {data,error}=await client.from('result_records')
      .upsert(payload,{onConflict:'institution_id,local_id'})
      .select()
      .single();
    if(error)throw error;
    return data;
  }

  async function syncResults(map){
    const c=cloud(),client=c.state.client;
    const rows=read('edunizam_results',[]).map(r=>{
      const student=map.get(Number(r.studentId)); if(!student) return null;
      return {
        institution_id:cfg.institutionId,local_id:Number(r.id),student_id:student.id,
        subject:r.subject,marks:Number(r.marks||0),total:Number(r.total||0),
        assessment_date:r.date||null,assessment_type:r.type||null,
        metadata:{},created_by:c.state.user?.id||null,updated_at:new Date().toISOString()
      };
    }).filter(Boolean);
    if(!rows.length)return;
    const {error}=await client.from('result_records').upsert(rows,{onConflict:'institution_id,local_id'});
    if(error)throw error;
  }

  async function syncPractice(map){
    const client=cloud().state.client;
    const rows=read('edunizam_practice_history',[]).map(x=>{
      const student=map.get(Number(x.studentId)); if(!student) return null;
      return {
        institution_id:cfg.institutionId,local_attempt_id:Number(x.id),student_id:student.id,
        attempted_at:x.at||new Date().toISOString(),config:x.config||{},question_ids:x.questionIds||[],
        auto_total:Number(x.autoTotal||0),auto_correct:Number(x.autoCorrect||0),percentage:Number(x.pct||0),
        weak_topics:x.weak||[],details:x.details||[]
      };
    }).filter(Boolean);
    if(!rows.length)return;
    const {error}=await client.from('practice_attempts').upsert(rows,{onConflict:'institution_id,local_attempt_id'});
    if(error)throw error;
  }

  async function syncRemarks(map){
    const c=cloud(),client=c.state.client,remarks=read('edunizam_student_remarks',{});
    const rows=Object.entries(remarks).map(([localId,remark])=>{
      const student=map.get(Number(localId)); if(!student||!String(remark||'').trim()) return null;
      return {
        institution_id:cfg.institutionId,student_id:student.id,remark:String(remark),
        teacher_user_id:c.state.user?.id||null,updated_at:new Date().toISOString()
      };
    }).filter(Boolean);
    if(!rows.length)return;
    const {error}=await client.from('student_remarks').upsert(rows,{onConflict:'student_id'});
    if(error)throw error;
  }

  async function pushAllLocalToCloud(){
    await requireStaff();
    await syncSettings();
    await syncStudents();
    const map=await studentMap();
    await syncAttendance(map);
    await syncFees(map);
    await syncResults(map);
    await syncPractice(map);
    await syncRemarks(map);
    return {ok:true,students:map.size};
  }

  function createLocalBackup(){
    const snapshot={
      createdAt:new Date().toISOString(),
      students:read('edunizam_students',[]),
      attendance:read('edunizam_attendance',{}),
      fees:read('edunizam_fees',[]),
      results:read('edunizam_results',[]),
      practiceHistory:read('edunizam_practice_history',[]),
      remarks:read('edunizam_student_remarks',{}),
      settings:read('edunizam_settings',{})
    };
    write('edunizam_last_cloud_restore_backup',snapshot);
    return snapshot;
  }
  async function pullAllCloudToLocal(force=false){
    if(pullInFlight)return pullInFlight;
    if(!force&&lastPullAt&&Date.now()-lastPullAt<60000)return {ok:true,cached:true};
    pullInFlight=(async()=>{
    const c=cloud(); if(!ready()) throw new Error('Cloud backend is not configured.');
    createLocalBackup();
    const client=c.state.client;
    const fetchOne=async(key,builder)=>{
      const execute=async({signal}={})=>{
        let q=builder();
        if(signal&&typeof q?.abortSignal==='function')q=q.abortSignal(signal);
        const result=await q;
        if(result?.error)throw result.error;
        return result;
      };
      const rt=window.EDUNIZAM_DATA_RUNTIME;
      return rt
        ?rt.run('core-pull:'+cfg.institutionId+':'+key,execute,{timeout:10000,retries:1,label:'School data '+key})
        :execute({});
    };

    // Background hydration is intentionally capped at two concurrent requests.
    // It never owns the login/dashboard loading state.
    const [settingsRes,studentsRes]=await Promise.all([
      fetchOne('settings',()=>client.from('institution_settings').select('*').eq('institution_id',cfg.institutionId).maybeSingle()),
      fetchOne('students',()=>client.from('core_students').select('*').eq('institution_id',cfg.institutionId).order('created_at'))
    ]);
    const [attRes,feesRes]=await Promise.all([
      fetchOne('attendance',()=>client.from('attendance_records').select('*').eq('institution_id',cfg.institutionId)),
      fetchOne('fees',()=>client.from('fee_records').select('*').eq('institution_id',cfg.institutionId))
    ]);
    const [resultsRes,practiceRes]=await Promise.all([
      fetchOne('results',()=>client.from('result_records').select('*').eq('institution_id',cfg.institutionId)),
      fetchOne('practice',()=>client.from('practice_attempts').select('*').eq('institution_id',cfg.institutionId))
    ]);
    const remarksRes=await fetchOne('remarks',()=>client.from('student_remarks').select('*').eq('institution_id',cfg.institutionId));

    const cloudStudents=studentsRes.data||[];
    const localStudents=cloudStudents.map(s=>({
      id:Number(s.local_id)||Date.now()+Math.floor(Math.random()*1000),
      name:s.name,father:s.guardian_name||'',className:s.class_name||'',sectionName:s.section_name||'',phone:s.phone||'',
      bFormNo:s.b_form_no||'',guardianCnic:s.guardian_cnic||'',dateOfBirth:s.date_of_birth||'',admissionNo:s.admission_no||'',
      address:s.address||'',guardianOccupation:s.guardian_occupation||'',caste:s.caste||'',
      rollNo:s.roll_no||'',studentId:s.student_code||'',admissionApplicationId:s.admission_application_id||'',
      admissionDate:s.admission_date||'',feeSnapshot:s.fee_snapshot||null,authUserId:s.auth_user_id||null,
      photoPath:s.photo_path||'',profileDetails:s.profile_details||{},
      gender:s.profile_details?.gender||'',motherName:s.profile_details?.mother_name||'',email:s.profile_details?.email||'',
      city:s.profile_details?.city||'',district:s.profile_details?.district||'',province:s.profile_details?.province||'',
      bloodGroup:s.profile_details?.blood_group||'',emergencyContact:s.profile_details?.emergency_contact||'',
      previousSchool:s.profile_details?.previous_school||'',studentStatus:s.profile_details?.student_status||'active',
      healthNotes:s.profile_details?.health_notes||'',specialNeedsNotes:s.profile_details?.special_needs_notes||'',
      remarks:s.profile_details?.remarks||'',source:s.source||'cloud'
    }));
    write('edunizam_students',localStudents);
    const localIdByCloud=new Map(cloudStudents.map(s=>[s.id,Number(s.local_id)]));

    const att={};
    for(const a of attRes.data||[]){
      const lid=localIdByCloud.get(a.student_id); if(!lid)continue;
      (att[a.attendance_date]??={})[lid]=a.status;
    }
    write('edunizam_attendance',att);

    write('edunizam_fees',(feesRes.data||[]).map(f=>({
      id:Number(f.local_id)||Date.now(),studentId:localIdByCloud.get(f.student_id),
      amount:Number(f.amount||0),status:f.status,date:f.fee_date||''
    })).filter(x=>x.studentId));

    write('edunizam_results',(resultsRes.data||[]).map(r=>({
      id:Number(r.local_id)||Date.now(),studentId:localIdByCloud.get(r.student_id),
      subject:r.subject,marks:Number(r.marks||0),total:Number(r.total||0),date:r.assessment_date||'',type:r.assessment_type||''
    })).filter(x=>x.studentId));

    write('edunizam_practice_history',(practiceRes.data||[]).map(x=>({
      id:Number(x.local_attempt_id)||Date.now(),studentId:localIdByCloud.get(x.student_id),
      at:x.attempted_at,config:x.config||{},questionIds:x.question_ids||[],autoTotal:x.auto_total||0,
      autoCorrect:x.auto_correct||0,pct:Number(x.percentage||0),weak:x.weak_topics||[],details:x.details||[]
    })).filter(x=>x.studentId));

    const rm={}; for(const r of remarksRes.data||[]){const lid=localIdByCloud.get(r.student_id);if(lid)rm[lid]=r.remark}
    write('edunizam_student_remarks',rm);

    if(settingsRes.data){
      write('edunizam_settings',{
        schoolName:settingsRes.data.school_name||'My School',
        schoolType:settingsRes.data.school_type||'School',
        tagline:settingsRes.data.tagline||'',
        session:settingsRes.data.academic_session||'',
        phone:settingsRes.data.phone||'',
        address:settingsRes.data.address||''
      });
    }
    lastPullAt=Date.now();
    return {ok:true,students:localStudents.length};
    })();
    try{return await pullInFlight}finally{pullInFlight=null}
  }

  async function requireHead(){
    const c=cloud(); if(!ready()) throw new Error('Cloud backend is not configured.');
    const role=await c.getMyRole();
    if(role!=='head_of_institute') throw new Error('Head of Institute access required.');
    return c;
  }
  async function listAttendanceAudit(date){
    const c=await requireHead(),client=c.state.client;
    const runtime=window.EDUNIZAM_DATA_RUNTIME;
    const runQuery=(key,builder,cacheMs=15000)=>{
      const execute=async({signal}={})=>{
        let q=builder();
        if(signal&&typeof q?.abortSignal==='function')q=q.abortSignal(signal);
        const result=await q;
        if(result?.error)throw result.error;
        return result;
      };
      return runtime
        ?runtime.run('attendance-audit:'+cfg.institutionId+':'+date+':'+key,execute,{timeout:7000,retries:1,cacheMs,label:'Attendance audit '+key})
        :execute({});
    };

    // These queries are visible-view data, not authentication. Keep them out of
    // startup and avoid launching the two PostgREST requests simultaneously.
    const attendanceRes=await runQuery('records',()=>client.from('attendance_records')
      .select('attendance_date,status,updated_at,marked_by,core_students(name,class_name,section_name)')
      .eq('institution_id',cfg.institutionId)
      .eq('attendance_date',date)
      .order('updated_at',{ascending:false}));
    let staffRes={data:[]};
    try{
      staffRes=await runQuery('staff',()=>client.from('staff_profiles')
        .select('user_id,full_name,designation')
        .eq('institution_id',cfg.institutionId),60000);
    }catch(e){
      console.warn('Attendance audit staff enrichment:',e?.message||e);
    }
    const staffByUser=new Map((staffRes.data||[]).filter(x=>x.user_id).map(x=>[String(x.user_id),x]));
    const headUserId=String(c.state.user?.id||'');
    return (attendanceRes.data||[]).map(row=>{
      const marker=staffByUser.get(String(row.marked_by||''));
      return {
        date:row.attendance_date,
        status:row.status,
        updatedAt:row.updated_at,
        markedBy:row.marked_by||'',
        markerName:String(row.marked_by||'')===headUserId?'School Admin':(marker?.full_name||'Authorized Staff'),
        markerRole:String(row.marked_by||'')===headUserId?'Admin':(marker?.designation||'Teacher'),
        studentName:row.core_students?.name||'Student',
        className:row.core_students?.class_name||'',
        sectionName:row.core_students?.section_name||''
      };
    });
  }

  async function uploadStudentPhoto(localId,file){
    if(!file)throw new Error('Select a profile image first.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Profile picture must be JPG, PNG or WEBP.');
    if(file.size>2*1024*1024)throw new Error('Profile picture must be 2 MB or smaller.');
    const c=await requireHead(),client=c.state.client;
    const {data:student,error:findError}=await client.from('core_students')
      .select('id,photo_path').eq('institution_id',cfg.institutionId).eq('local_id',Number(localId)).maybeSingle();
    if(findError)throw findError;if(!student)throw new Error('Sync the student to cloud before uploading a photo.');
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').slice(0,6)||'jpg';
    const path=cfg.institutionId+'/student/'+student.id+'/'+Date.now()+'.'+ext;
    const {error:upError}=await client.storage.from('school-profile-photos').upload(path,file,{upsert:false,contentType:file.type});
    if(upError)throw upError;
    const {data,error}=await client.from('core_students').update({photo_path:path,updated_at:new Date().toISOString()}).eq('id',student.id).select().single();
    if(error)throw error;
    if(student.photo_path&&student.photo_path!==path)client.storage.from('school-profile-photos').remove([student.photo_path]).catch(()=>{});
    return data;
  }
  async function createProfilePhotoUrl(path,expiresIn=3600){
    if(!path||!ready())return null;
    const {data,error}=await cloud().state.client.storage.from('school-profile-photos').createSignedUrl(path,expiresIn);
    if(error)throw error;return data?.signedUrl||null;
  }

  async function deleteStudentByLocalId(localId){
    const c=await requireHead(),client=c.state.client;
    const {data,error}=await client.rpc('delete_core_student_v1',{
      p_institution_id:cfg.institutionId,
      p_local_id:Number(localId)
    });
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    return {
      ok:true,
      deleted:!!row?.deleted,
      studentId:row?.student_id||null,
      studentUserId:row?.student_user_id||null,
      studentName:row?.student_name||''
    };
  }

  window.EDUNIZAM_CORE_CLOUD={ready,upsertStudent,uploadStudentPhoto,createProfilePhotoUrl,saveAttendanceDay,saveResultRecord,listAttendanceAudit,pushAllLocalToCloud,pullAllCloudToLocal,createLocalBackup,deleteStudentByLocalId};
})();