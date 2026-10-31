/* Curated link index from PECTAA's official Grades 1–8 e-books directory.
 * Links open PECTAA-listed Google Drive files; NO textbook content is copied.
 * Exact book edition and suitability must be checked by the teacher.
 * https://pectaa.edu.pk/books-and-publications/ */
(function(){
'use strict';
const directory='https://pectaa.edu.pk/books-and-publications/';
const rows=[[1,"Mathematics","1c4x62XDG-TbhF2-Aj_VIxhnm-8t8e2Ua"],[1,"English","1qdIPBXxaVHia6BVInY8uXWmzKkzGZ09Y"],[1,"Urdu","17o-AGE3z00m-z8Kih389pmAeWolTxA2N"],[2,"Mathematics","11SMlZk9Z3mdAG49ewxxK0ge1DnvyKViZ"],[2,"English","1mDTFzH_fwjl-ZA7peQpVAxE00C3GQ2MX"],[2,"Urdu","1cWaeH4aUC0xJi2kbYkmrENXmU-NnBx6L"],[3,"Mathematics","1C69gAPjeD2yKfyvDG97kZIiTGJwCbTr2"],[3,"English","11xsJrNr0ONZO8wJUSIq8p0SiK7tLyWZP"],[3,"Urdu","1LNXCmSfpIBA2OgHSx1wn_FeOzvr-MKbn"],[4,"Mathematics","1fpvfnz1sb6arKs8fcumu-Hgl4LjM34eh"],[4,"English","1YxAHOKvHXjdzQVy_RvoZeuugrHL3t0_e"],[4,"Urdu","1lmfd019QlRWK-ZBJr0Ze7eLPU1PxIbfs"],[4,"General Science","1dAS1tPwg-kAAaN6dF1M-InwLJwl8OTWK"],[5,"Mathematics","1JGSOgl61IFiwosrBQQVwLOo8FEt2tDA1"],[5,"English","1jsODAQskQsmY_SUp_4xJS7_4VB2lEfat"],[5,"Urdu","10OQQYD3q-k6-Oq9m-5PwC5mg7Y2rbX_4"],[5,"General Science","1dwl4glSoZ2c1AYVKXH1IIkTSC4B3s97E"],[6,"Mathematics","1mrKk0eG9rXxnQn2NJ2Sh_nH1U5wj2W1i"],[6,"English","1J2WmRQ8acfiz3ZMCoWGisyE9qwnfclKY"],[6,"Urdu","1fjKTF0VJ9rGwEwrb1iYMZkuYxu4RmsdA"],[6,"General Science","1DBdylHYJf82704FwDsr3MpQNEy1h5U-k"],[6,"Computer Science","1iZWa6KY50JzkMd5I8xiiEy-64v0c7QiZ"],[7,"Mathematics","1aIKToDIBjBgS_8A2Thmbm46srz4r338i"],[7,"English","1EyfyU6OAE61w2RqAQQSRx_hbvVaIm9ew"],[7,"Urdu","1uqgeKN-J11LdgkNeCiJunDcXMTRirt8a"],[7,"General Science","14r9bFkXbR_lBGma5m2Bh20Mm7vhWmMpW"],[7,"Computer Science","1LgxaMdjj-BiC-MEkQfSXBVXD7x4c9dy9"],[8,"Mathematics","1nu_CRaFBMu2C5mgJd7Y-ekzOVITP-9rq"],[8,"English","1VjslGe1d421x--q0gxAn2l4tYx3zAKF3"],[8,"Urdu","1b_tMiA-YJ3ujhvrQQVJ43MGR3MlQykZh"],[8,"General Science","14fpAa9TGsayEuMYuwY9gaRU9c_PKky_s"],[8,"Computer Science","1HcurSgdPnqAIuyVzzoKCDk_rGV-t5LsM"]];
function apply(){
 const materials=window.EDUNIZAM_STUDY_DATA?.materials;
 if(!Array.isArray(materials))return 0;
 const ids=new Set(materials.map(x=>x.id));
 let inserted=0;
 for(const [grade,subject,driveId] of rows){
  const id='pectaa-direct-core-g'+grade+'-'+subject.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  if(ids.has(id))continue;
  materials.push({
   id,board:'Punjab PECTAA',classLevels:[grade],subject,
   type:'Official Textbook Link',source:'official',
   title:'Class '+grade+' '+subject+' — official PECTAA-listed textbook',
   url:'https://drive.google.com/file/d/'+driveId+'/view?usp=sharing',
   directoryUrl:directory,curriculumStatus:'needs-verification',
   note:'Direct book-viewing link listed on PECTAA official e-books page. Check current edition and chapter content before lesson or paper design. This is not a copied or independently certified textbook.'
  });
  ids.add(id);inserted++;
 }
 return inserted;
}
window.EDUNIZAM_PECTAA_CORE_BOOKS={rows,sourceUrl:directory,apply,updatedAt:'2026-10-09',officialListingOnly:true};
apply();
})();