(function(){
  const defaults={
    enabled:false,
    provider:"supabase",
    supabaseUrl:"",
    supabasePublishableKey:"",
    institutionId:"",
    admissionsStorageBucket:"admission-documents",
    complaintStorageBucket:"parent-complaints",
    paymentApiBaseUrl:""
  };
  let runtime={};
  try{runtime=JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}')}catch(_){}
  window.EDUNIZAM_CLOUD_CONFIG=Object.assign({},defaults,window.EDUNIZAM_CLOUD_CONFIG||{},runtime);
})();