(function(){
'use strict';
const U=window.EDUNIZAM_UNIVERSITY_DATA;if(!U)return;
const aliases={'uetl':'uet-lahore','gcu':'gcu-lahore'};
const canonical=id=>aliases[id]||id;
(U.resources||[]).forEach(r=>{if(r&&r.universityId)r.universityId=canonical(r.universityId)});
const preferred=new Map();
(U.universities||[]).forEach(u=>{
 if(!u||!u.id)return;
 const id=canonical(u.id),existing=preferred.get(id);
 const normalized={...u,id};
 if(!existing)preferred.set(id,normalized);
 else preferred.set(id,{
   ...normalized,
   ...existing,
   id,
   name:existing.name||normalized.name,
   type:existing.type||normalized.type,
   officialUrl:existing.officialUrl||normalized.officialUrl
 });
});
U.universities=[...preferred.values()];
U.updatedAt='2026-10-02';
window.EDUNIZAM_UNIVERSITY_NORMALIZATION={
 updatedAt:'2026-10-02',
 aliases,
 note:'Canonicalizes duplicate UET Lahore and GCU Lahore identifiers so filters and resource cards resolve to one institution.'
};
})();