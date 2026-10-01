(function(){
'use strict';
const C=window.EDUNIZAM_VU_COURSE_CATALOG;
if(!C||!Array.isArray(C.courses))return;
const rows=[
 ['CS001','VU-Computer Proficiency License','Computer Science/Information Technology','https://www.vu.edu.pk/academicprograms/coursescatalogue'],
 ['CS204','Cyber Law','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=107'],
 ['CS306','Introduction to Python','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Information_Technology'],
 ['CS310','Open Source Web Application Development (PHP, PERL, CGI, Mysql)','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=107'],
 ['CS314','Introduction to Cellular Networks','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Computer_Science'],
 ['CS301P','Data Structures (Practical)','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=MCS'],
 ['CS304P','Object Oriented Programming (Practical)','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=MCS'],
 ['CS403P','Database Management Systems (Practical)','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=105'],
 ['CS409','Introduction to Database Administration','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/studyscheme?sp=Information_Technology'],
 ['CS431','Wireless Communication','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails.aspx?StudyProgramID=105'],
 ['CS441','Big Data Concepts','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=107'],
 ['CS505','Virtual Systems and Services','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=7'],
 ['CS511','Web Engineering','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/studyscheme?sp=Information_Technology'],
 ['CS513','Advanced Data Analytics and Business Intelligence','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Computer_Science'],
 ['CS514','Internet of Things (IoT)','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Computer_Science'],
 ['CS515','Advanced Database Management System','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=292'],
 ['CS519','Final Project','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=105'],
 ['CS608','Software Verification and Validation','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Computer_Science'],
 ['CS619','Final Project - CS619','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Computer_Science'],
 ['CS620','Modelling and Simulation','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=292'],
 ['CS621','Parallel and Distributed Computing','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Data_Science'],
 ['CS626','Data Mining Techniques','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Data_Science'],
 ['CS627','Cyber Security','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=7'],
 ['CS628','Machine Learning','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Data_Science'],
 ['CS630','Data Visualization and Digital Storytelling','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Data_Science'],
 ['CS631','Deep Learning','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Data_Science'],
 ['CS642','Next Generation Networks','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=7'],
 ['CS699','Professional Certification','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Computer_Science'],
 ['CSI619','Field Experience / Internship','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/studyscheme?sp=Information_Technology'],
 ['IT601','System and Network Administration','Computer Science/Information Technology','https://www.vu.edu.pk/AcademicPrograms/studyscheme?sp=Information_Technology'],
 ['IT602','Information Technology Infrastructure','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=7'],
 ['STA302','Data Analytics and Business Intelligence','Probability & Statistics','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=292'],
 ['STAT404','Regression and Correlation','Probability & Statistics','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=292']
];
const seen=new Set(C.courses.map(x=>String(x.code||'').toUpperCase()));
for(const [code,title,category,officialDetails] of rows){
 if(seen.has(code))continue;
 C.courses.push({
   code,title,category,level:'Undergraduate / Program-specific',
   officialDetails,ocwVerified:false,
   freshness:'Verified from current Virtual University study-scheme/program pages on 2026-10-01. OCW course-material route was not independently verified, so use the official study scheme and VULMS for current material.'
 });
 seen.add(code);
}
C.courses.sort((a,b)=>String(a.code).localeCompare(String(b.code)));
C.verifiedAt='2026-10-01';
window.EDUNIZAM_VU_CATALOG_EXPANSION={updatedAt:'2026-10-01',added:rows.length,source:'Official Virtual University study schemes and program details'};
})();