(function(){
'use strict';
const C=window.EDUNIZAM_VU_COURSE_CATALOG;if(!C||!Array.isArray(C.courses))return;
const add=x=>{if(!C.courses.some(c=>String(c.code).toUpperCase()===x.code))C.courses.push(x)};
const official='https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=288';
add({
  code:'MTH600A',title:'Final Project for Mathematics-I',category:'Mathematics',level:'Undergraduate',creditHours:3,
  prerequisite:'',ocwVerified:false,officialDetails:official,projectCourse:true,
  freshness:'Official VU Mathematics study scheme lists MTH600A as a 3-credit Final Project / Field Experience course. Current topic, supervisor, submissions, presentation and viva instructions must be confirmed in VULMS.'
});
add({
  code:'MTH600B',title:'Final Project for Mathematics-II',category:'Mathematics',level:'Undergraduate',creditHours:3,
  prerequisite:'MTH600A',ocwVerified:false,officialDetails:official,projectCourse:true,
  freshness:'Official VU Mathematics study scheme lists MTH600B as a 3-credit capstone project with MTH600A as prerequisite. Current deliverables, presentation and viva instructions must be confirmed in VULMS.'
});
C.updatedAt='2026-10-02';
})();