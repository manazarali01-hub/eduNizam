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
 ['STAT404','Regression and Correlation','Probability & Statistics','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=292'],
 ['BT101','Ecology, Biodiversity & Evolution-I','Biotechnology','https://ocw.vu.edu.pk/CourseDetails.aspx?cat=Biotechnology&course=BT101',true],
 ['CHE201','Physical Chemistry','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['BIO101','Basic I-Biology','Biotechnology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=277'],
 ['VU001','Introduction to e-Learning','Humanities Distribution','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=174'],
 ['CS201P','Introduction to Programming (Practical)','Computer Science/Information Technology','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=174'],
 ['MCM499','Capstone Project','Mass Communication','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=8'],
 ['MCM512','Media Lab','Mass Communication','https://www.vu.edu.pk/AcademicPrograms/StudyScheme.aspx?sp=Mass_Communication'],
 ['MCM517','Online Journalism','Mass Communication','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=8'],
 ['MCM520','Contemporary Mass Media','Mass Communication','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=8'],
 ['MCM532','Magazine Journalism','Mass Communication','https://www.vu.edu.pk/AcademicPrograms/StudyScheme.aspx?sp=Mass_Communication'],
 ['MCM612','Media Lab','Mass Communication','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=8'],
 ['MCM611','Seminar on Contemporary Issues in Media','Mass Communication','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=8'],
 ['MCMI619','Internship Report-Mass Communication','Mass Communication','https://www.vu.edu.pk/AcademicPrograms/StudyScheme.aspx?sp=Mass_Communication'],
 ['BIO504T','Biochemistry I (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['BIO505T','Essentials of Genetics (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['BIO506T','Biochemistry II (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=295'],
 ['BIO5101','Introduction to Biotechnology','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['BIO5105','Cell Biology','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Associate_Degree_in_Biotechnology'],
 ['MB502T','Molecular Biology (Theory)','Molecular Biology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['MIC501T','Microbiology (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=295'],
 ['BT611T','Food Biotechnology (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['BT614T','Industrial Biotechnology (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology'],
 ['BT513T','Principles of Biochemical Engineering (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=295'],
 ['BT612T','Fermentation Technology (Theory)','Biotechnology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=295'],
 ['ZOO512T','Animal Diversity: Invertebrates (Theory)','Zoology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=277'],
 ['ZOO513T','Animal Diversity: Chordates (Theory)','Zoology','https://www.vu.edu.pk/AcademicDepartment/ProgramDetails?StudyProgramID=277'],
 ['ECO613','Globalization and Economics','Economics','https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=174'],
 ['PAK522','Ideology and Constitution of Pakistan','Humanities Distribution','https://www.vu.edu.pk/AcademicPrograms/StudyScheme?sp=Biotechnology']
];
const seen=new Set(C.courses.map(x=>String(x.code||'').toUpperCase()));
for(const [code,title,category,officialDetails,ocwVerified=false] of rows){
 if(seen.has(code))continue;
 C.courses.push({
   code,title,category,level:'Undergraduate / Program-specific',
   officialDetails,ocwVerified,
   freshness:'Verified from current Virtual University study-scheme/program pages on 2026-10-01. OCW course-material route was not independently verified, so use the official study scheme and VULMS for current material.'
 });
 seen.add(code);
}
C.courses.sort((a,b)=>String(a.code).localeCompare(String(b.code)));
C.verifiedAt='2026-10-01';
window.EDUNIZAM_VU_CATALOG_EXPANSION={updatedAt:'2026-10-01',added:rows.length,source:'Official Virtual University study schemes and program details'};
})();