(function(){
  const defaults={
    enabled:true,
    provider:"supabase",
    supabaseUrl:"https://qmdiexentozvhhfjvlmr.supabase.co",
    supabasePublishableKey:"sb_publishable_H_NemjhF1RgugePi9C0g6w_7UIntmdj",
    institutionId:"",
    admissionsStorageBucket:"admission-documents",
    complaintStorageBucket:"parent-complaints",
    paymentApiBaseUrl:""
  };
  let runtime={};
  try{runtime=JSON.parse(localStorage.getItem('edunizam_cloud_runtime_config')||'{}')}catch(_){}
  window.EDUNIZAM_CLOUD_CONFIG=Object.assign({},defaults,window.EDUNIZAM_CLOUD_CONFIG||{},runtime);
})();