/* Verified PECTAA secondary e-book DIRECTORY LINKS, 9 Oct 2026.
 * Do not reproduce copyrighted textbooks; opens publisher-linked Google Drive files.
 * Confirm prescribed edition, medium, grade and religious/technical applicability.
 * Official directory: https://pectaa.edu.pk/curriculum-compliance/
 */
(function(){
'use strict';
const sourceUrl='https://pectaa.edu.pk/curriculum-compliance/';
const rows=[[9,"Tarjuma-tul-Quran","Urdu","2023-24","157EhLaNBr6h1XNrF6k2mflsdui9RfYaU"],[9,"Islamiat","Urdu","2024-25","1kiaCqhXsXuuZ7HAAuXYfjl4_WaBf-ARS"],[9,"Urdu","Urdu","2025-26","1JPgnI_hL6D0EMPG36IdjcqB2OFBHLp52"],[9,"English","English","2025-26","1mWBO-wzXqv0Oq9oazcjM-Y16EqmPqBtj"],[9,"Mathematics","English","2025-26","1qJF9YsdVpOKk-HzRUwftZZzINLmVkJv3"],[9,"Mathematics","Urdu","2025-26","16fvRipI6vSaoEBPTq8jMrYReKkmYb8g5"],[9,"Chemistry","English","2025-26","1OY1Unpm8VkLCGQfbLFrE8wLn3fzXmZpc"],[9,"Chemistry","Urdu","2025-26","1sbP5nnysHqXB-T3qVb55chS93LdqqBoN"],[9,"Computer Science","English","2025-26","1K9AWmNIjYFUNWE_F8JkELmlEkZO9Ms85"],[9,"Biology","English","2025-26","1rH5qC3FM12nPcH1zIVbm25tMKWxMv-3P"],[9,"Biology","Urdu","2025-26","1LxUO75kyWQQWZZPTpg9oGYetAgYAjql3"],[9,"Physics","Urdu","2025-26","17UbTKUKdiVeK-_AZRFXgqnzBfwjtq92p"],[9,"Physics","English","2025-26","1Afzgg1sukw1-qBOj61VnMGs6-b1x82ae"],[9,"Akhlaqiat (Ethics)","Urdu","2023-24","1vS1TQhpOttZRfPhkcUPMz-YxVAn8kD55"],[9,"Computer & Entrepreneurship (Technical)","English","2026-27","1C8pGmjCU0swY_N4fhpeVcx_-0oRrEss3"],[10,"Tarjuma-tul-Quran","Urdu","2023-24","1DMkY84-p4zsQbjKzyGcsTxIXsMGDxOeM"],[10,"Akhlaqiat (Ethics)","Urdu","2023-24","1WySlT2PhoDU-Ulym-UBArfsC3SM7BUb-"],[10,"English","English","2026-27","1DIhnZpXMa_5-GiS4KLq9B0ITTAOnPlr4"],[10,"Mathematics","English","2026-27","1MKYcHg2WdNDIjqeD2JFKpcs_79oZ_3fq"],[10,"Pakistan Studies","English","2026-27","1-4tyA97RPFni6fju0-vTA_w1thjBjtVs"],[10,"Urdu","Urdu","2026-27","1rvX2aIfWwwH_N7V4jsGwMmkpwteDlUmB"],[10,"Biology","Urdu","2026-27","10Vy5cqKK9eAlv9k-zW6jqjmTJZngUAk-"],[10,"Biology","English","2026-27","1-8TsnRfFOQ3JxAT9QXsBGH4Xf5fquZEo"],[10,"Chemistry","Urdu","2026-27","1O30gCpTFypPnG8BR8fsFmYrxEWXOzS17"],[10,"Computer Science","English","2026-27","1bfJ7yeruNQ-dKlYeMtCNua2t4k3QbxBU"],[10,"Physics","English","2026-27","1uJ52QDD3klP-CwbfXWHlV_d4Y4aTJws5"],[10,"Physics","Urdu","2026-27","1BqP9RHrXtqCpZZ1soQcyvJ90ACUSAWar"]];
const slug=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function resources(){
 return rows.map(([grade,subject,medium,edition,driveId])=>({
  id:'pectaa-direct-secondary-'+grade+'-'+slug(subject)+'-'+slug(medium),
  board:'Punjab PECTAA',authorityId:'punjab-pectaa',
  classLevels:[grade],subject,type:'Official Textbook Link',source:'official',
  medium,listedEdition:edition,sessionOfPrescribedBook:'school-must-confirm',
  title:'Class '+grade+' '+subject+' ('+medium+' medium) — PECTAA-listed '+edition+' textbook',
  url:'https://drive.google.com/file/d/'+driveId+'/view?usp=sharing',
  directoryUrl:sourceUrl,curriculumStatus:'needs-verification',
  note:'Exact title and viewing link were listed by PECTAA. Teacher must confirm the prescribed school/board edition and actual chapters. No textbook content has been copied into EduNizam; the general concept question bank is not a verified textbook exercise bank.'
 }));
}
function apply(){
 const materials=window.EDUNIZAM_STUDY_DATA?.materials;
 if(!Array.isArray(materials))return 0;
 const seen=new Set(materials.map(x=>String(x.id)));
 let count=0;
 for(const item of resources()){
  if(seen.has(item.id))continue;
  materials.push(item);seen.add(item.id);count++;
 }
 return count;
}
window.EDUNIZAM_PECTAA_SECONDARY_BOOKS={
 sourceUrl,updatedAt:'2026-10-09',rows,resources,apply,
 notes:'27 book entries: direct PECTAA directory links. Not a guarantee of current prescribed edition, free reproduction rights or verified chapter-wise teacher questions.'
};
apply();
})();