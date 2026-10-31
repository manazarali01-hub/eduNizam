(function(){
'use strict';
const U=window.EDUNIZAM_UNIVERSITY_DATA;
if(U){
 const add=[
  {id:"comsats",name:"COMSATS University Islamabad",type:"Public",officialUrl:"https://www.comsats.edu.pk/"},
  {id:"fast",name:"FAST National University of Computer and Emerging Sciences",type:"Private",officialUrl:"https://www.nu.edu.pk/"},
  {id:"nust",name:"National University of Sciences and Technology",type:"Public",officialUrl:"https://nust.edu.pk/"},
  {id:"uet-lahore",name:"University of Engineering and Technology Lahore",type:"Public",officialUrl:"https://www.uet.edu.pk/"}
 ];
 add.forEach(x=>{if(!U.universities.some(y=>y.id===x.id))U.universities.push(x)});
 add.forEach(x=>{if(!U.resources.some(r=>r.id===x.id+"-official"))U.resources.push({id:x.id+"-official",universityId:x.id,category:"Academic Resources",source:"official",title:x.name+" Official Academic Portal",url:x.officialUrl,note:"Official university website. Use its admissions, academics, examinations and student-resource sections for current information."})});
}
const C=window.EDUNIZAM_VU_COURSE_CATALOG;
if(C){
 const add=[
  ["CS101","Introduction to Computing","Computer Science/Information Technology"],
  ["MTH101","Calculus And Analytical Geometry","Mathematics"],
  ["MTH301","Calculus II","Mathematics"],
  ["ECO401","Economics","Economics"]
 ];
 add.forEach(([code,title,category])=>{if(!C.courses.some(x=>x.code===code))C.courses.push({code,title,category,level:"Undergraduate",creditHours:3,officialDetails:"https://ocw.vu.edu.pk/",freshness:"Use VU OpenCourseWare and VULMS to verify the current course outline, handouts and semester material."})});
}
})();