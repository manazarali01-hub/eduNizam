(function(){
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const c=()=>window.EDUNIZAM_CLOUD;
  function ready(){return !!(c()?.state?.client&&c()?.state?.user&&cfg().institutionId)}
  const toCloudRole=r=>r==='head'?'head_of_institute':r;
  async function list(){
    if(!ready())return[];
    const {data,error}=await c().state.client.from('communication_meetings').select('*').eq('institution_id',cfg().institutionId).order('scheduled_for',{ascending:true});
    if(error)throw error;return data||[];
  }
  async function create(m){
    if(!ready())return null;
    const student=(window.state?.students||JSON.parse(localStorage.getItem('edunizam_students')||'[]')).find(s=>String(s.id)===String(m.personId));
    const participantUserId=m.participantRole==='student'?(student?.authUserId||null):null;
    const studentUserId=student?.authUserId||null;
    const payload={
      institution_id:cfg().institutionId,
      created_by:c().state.user.id,
      created_by_role:toCloudRole(m.createdByRole),
      participant_user_id:participantUserId,
      participant_role:m.participantRole,
      student_user_id:studentUserId,
      title:m.title,
      scheduled_for:new Date(m.date+'T'+m.time+':00').toISOString(),
      meet_url:m.url||null,
      status:String(m.status||'Scheduled').toLowerCase()
    };
    const {data,error}=await c().state.client.from('communication_meetings').insert(payload).select().single();
    if(error)throw error;return data;
  }
  async function updateStatus(id,status){
    if(!ready()||!/^[0-9a-f-]{36}$/i.test(String(id)))return null;
    const {data,error}=await c().state.client.from('communication_meetings').update({status:String(status).toLowerCase(),updated_at:new Date().toISOString()}).eq('id',id).select().single();
    if(error)throw error;return data;
  }
  async function remove(id){
    if(!ready()||!/^[0-9a-f-]{36}$/i.test(String(id)))return null;
    const {error}=await c().state.client.from('communication_meetings').delete().eq('id',id);
    if(error)throw error;return true;
  }
  function map(row){
    const dt=new Date(row.scheduled_for);
    return {
      id:row.id,kind:row.created_by_role==='head_of_institute'?'head-parent':'teacher-student',
      personId:row.student_user_id||row.participant_user_id||'',personName:row.participant_role==='parent'?'Parent / Guardian':'Student',
      participantRole:row.participant_role,viewerRole:row.participant_role,title:row.title,
      date:Number.isNaN(dt.getTime())?'':dt.toISOString().slice(0,10),time:Number.isNaN(dt.getTime())?'':dt.toTimeString().slice(0,5),
      url:row.meet_url||'',status:(row.status||'scheduled').replace(/^./,x=>x.toUpperCase()),createdByRole:row.created_by_role==='head_of_institute'?'head':'teacher',source:'cloud'
    };
  }
  window.EDUNIZAM_COMMUNICATION_CLOUD={ready,list,create,updateStatus,remove,map};
})();