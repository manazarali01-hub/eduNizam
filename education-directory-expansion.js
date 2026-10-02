(function(){
  const U=window.EDUNIZAM_UNIVERSITY_DATA||(window.EDUNIZAM_UNIVERSITY_DATA={updatedAt:'2026-10-02',universities:[],resources:[]});
  const addUni=x=>{if(!U.universities.some(u=>u.id===x.id))U.universities.push(x)};
  const addRes=x=>{if(!U.resources.some(r=>r.id===x.id))U.resources.push(x)};
  [
    {id:'hec',name:'Higher Education Commission Pakistan',type:'Higher Education Authority',officialUrl:'https://www.hec.gov.pk/'},
    {id:'comsats',name:'COMSATS University Islamabad',type:'Public',officialUrl:'https://www.comsats.edu.pk/'},
    {id:'nust',name:'National University of Sciences & Technology (NUST)',type:'Public',officialUrl:'https://nust.edu.pk/'},
    {id:'qau',name:'Quaid-i-Azam University',type:'Public',officialUrl:'https://qau.edu.pk/'},
    {id:'uetl',name:'University of Engineering & Technology Lahore',type:'Public',officialUrl:'https://uet.edu.pk/'},
    {id:'fast',name:'FAST National University of Computer & Emerging Sciences',type:'Private / Chartered',officialUrl:'https://www.nu.edu.pk/'},
    {id:'iiui',name:'International Islamic University Islamabad',type:'Public',officialUrl:'https://www.iiu.edu.pk/'},
    {id:'iub',name:'The Islamia University of Bahawalpur',type:'Public',officialUrl:'https://www.iub.edu.pk/'},
    {id:'ue',name:'University of Education Lahore',type:'Public',officialUrl:'https://ue.edu.pk/'},
    {id:'gcu',name:'Government College University Lahore',type:'Public',officialUrl:'https://gcu.edu.pk/'},
    {id:'lcwu',name:'Lahore College for Women University',type:'Public',officialUrl:'https://www.lcwu.edu.pk/'},
    {id:'air',name:'Air University Islamabad',type:'Public',officialUrl:'https://www.au.edu.pk/'},
    {id:'numl',name:'National University of Modern Languages (NUML)',type:'Public',officialUrl:'https://www.numl.edu.pk/'}
  ].forEach(addUni);

  [
    {id:'hec-recognized',universityId:'hec',category:'HEC Directory',source:'official',title:'HEC Recognized Universities & Campuses',url:'https://www.hec.gov.pk/english/universities/Pages/DAIs/HEC-recognized-Campuses.aspx',note:'Official HEC directory for recognized public and private university campuses in Pakistan.'},
    {id:'hec-pqr',universityId:'hec',category:'HEC Directory',source:'official',title:'Pakistan Qualification Register (PQR)',url:'https://www.hec.gov.pk/Urdu/services/universities/pqr/Pages/default.aspx',note:'Official HEC register for recognized and quality-assured higher qualifications and providers.'},
    {id:'hec-attestation',universityId:'hec',category:'Degree / Verification',source:'official',title:'HEC Degree Attestation',url:'https://www.hec.gov.pk/english/services/students/DAS/Pages/Degree-Attestation.aspx',note:'Official HEC degree/diploma/certificate attestation guidance and online-service route.'},

    {id:'vu-academic-calendar-deep',universityId:'vu',category:'Academic Calendar',source:'official',title:'VU Academic Calendar',url:'https://vu.edu.pk/StudentServices/AcademicCalendar',note:'Official semester calendar for course selection, classes, midterms, final terms and result dates.'},
    {id:'vu-date-sheet-deep',universityId:'vu',category:'Date Sheet / Exams',source:'official',title:'VU Date Sheet Portal',url:'https://datesheet.vu.edu.pk/',note:'Official VU portal used to create an examination date sheet when the relevant semester window is open.'},
    {id:'vu-results-vulms-deep',universityId:'vu',category:'Results',source:'official',title:'VU Results via VULMS',url:'https://vulms.vu.edu.pk/',note:'Official logged-in route for semester results; VU result announcements direct students to LMS for their individual result.'},

    {id:'aiou-aaghi',universityId:'aiou',category:'LMS / Student Portal',source:'official',title:'AIOU AAGHI LMS',url:'https://aaghi.aiou.edu.pk/',note:'Official AIOU learning management system for online workshops, assignment submission and course access.'},
    {id:'aiou-cms',universityId:'aiou',category:'LMS / Student Portal',source:'official',title:'AIOU Enrollment / CMS Portal',url:'https://enrollment.aiou.edu.pk/',note:'Official student CMS for enrollment and academic/student services.'},
    {id:'aiou-results-deep',universityId:'aiou',category:'Results',source:'official',title:'AIOU Current & Previous Results',url:'https://result.aiou.edu.pk/',note:'Official AIOU current and previous result portal, including semester-wise history.'},
    {id:'aiou-exams',universityId:'aiou',category:'Date Sheet / Exams',source:'official',title:'AIOU Examination Services',url:'https://www.aiou.edu.pk/examination',note:'Official examination information and services; students should confirm current dates and instructions here.'},
    {id:'aiou-assignment-schedule',universityId:'aiou',category:'Assignments',source:'official',title:'AIOU Assignment Schedule',url:'https://aiou.edu.pk/assignment-schedule',note:'Official programme-wise assignment schedules.'},
    {id:'aiou-workshop-information',universityId:'aiou',category:'Workshops',source:'official',title:'AIOU Workshop Information',url:'https://www.aiou.edu.pk/workshop-information',note:'Official semester-wise online and face-to-face workshop schedules and programme summaries.'},
    {id:'aiou-academic-calendar',universityId:'aiou',category:'Academic Calendar',source:'official',title:'AIOU Academic Calendar',url:'https://aiou.edu.pk/academiccalender',note:'Official ODL and face-to-face semester calendar covering admissions, study period, examinations and result windows.'},
    {id:'aiou-date-sheet',universityId:'aiou',category:'Date Sheet / Exams',source:'official',title:'AIOU Date Sheets',url:'https://www.aiou.edu.pk/date-sheet-0',note:'Official semester/programme date-sheet page for current and recent AIOU examinations.'},
    {id:'aiou-student-faq',universityId:'aiou',category:'Student Services',source:'official',title:'AIOU Student Services FAQ',url:'https://www.aiou.edu.pk/frequently-asked-questions-faqs',note:'Official guidance for AAGHI, assignment schedules, workshops, CMS, tutor details and other student workflows.'},
    {id:'aiou-guidance',universityId:'aiou',category:'Books / Guidance',source:'official',title:'AIOU Books, Tutor, Workshop & Guidance Hub',url:'https://www.aiou.edu.pk/guidance-help',note:'Official gateway for books, tutor information, assignments, workshops, academic calendar and help.'},
    {id:'aiou-prospectus',universityId:'aiou',category:'Prospectus / Syllabus',source:'official',title:'AIOU Prospectus',url:'https://aiou.edu.pk/prospectus',note:'Official programme prospectuses and current admission information.'},
    {id:'aiou-admission',universityId:'aiou',category:'Admissions',source:'official',title:'AIOU Online Admission System',url:'https://www.aiou.edu.pk/oas-fresh-admission',note:'Official fresh-admission guidance, prospectus and online application route.'},

    {id:'pu-results-deep',universityId:'pu',category:'Results',source:'official',title:'Punjab University Results',url:'https://pu.edu.pk/home/results',note:'Official University of the Punjab result listings.'},
    {id:'pu-lms',universityId:'pu',category:'LMS / Student Portal',source:'official',title:'Punjab University LMS',url:'https://lms.pu.edu.pk/',note:'Official PU learning management system and course search.'},
    {id:'pu-cms',universityId:'pu',category:'LMS / Student Portal',source:'official',title:'Punjab University CMS',url:'https://cms.pu.edu.pk/',note:'Official PU campus/student management portal.'},
    {id:'pu-admission',universityId:'pu',category:'Admissions',source:'official',title:'Punjab University Admissions Portal',url:'https://admissions.pu.edu.pk/',note:'Official online admission portal and merit/admission updates.'},

    {id:'bzu-results-deep',universityId:'bzu',category:'Results',source:'official',title:'BZU Results Portal',url:'https://result.bzu.edu.pk/',note:'Official BZU result portal for annual programmes and examinations.'},
    {id:'bzu-online-exam',universityId:'bzu',category:'Date Sheet / Exams',source:'official',title:'BZU Online Examination System',url:'https://admission.bzu.edu.pk/main/',note:'Official BZU online examination system for supported programmes and college workflows.'},

    {id:'uog-results-deep',universityId:'uog',category:'Results',source:'official',title:'University of Gujrat Result Search',url:'https://www.uog.edu.pk/results',note:'Official UOG examination result search by examination and roll number.'},
    {id:'uog-admission-schedule',universityId:'uog',category:'Admissions',source:'official',title:'University of Gujrat Admission Schedule',url:'https://www.uog.edu.pk/en/admission/admission-schedule',note:'Official admission calendar and merit-list timeline.'},

    {id:'uaf-sis',universityId:'uaf',category:'LMS / Student Portal',source:'official',title:'UAF Student Information System',url:'https://sis.uaf.edu.pk/',note:'Official UAF SIS; existing students can use LMS credentials and new students can use admission credentials.'},
    {id:'uaf-lms',universityId:'uaf',category:'LMS / Student Portal',source:'official',title:'UAF Learning Management System',url:'https://lms.uaf.edu.pk/',note:'Official UAF LMS route for academic learning services.'},
    {id:'uaf-admissions',universityId:'uaf',category:'Admissions',source:'official',title:'UAF Online Admissions',url:'https://admissions.uaf.edu.pk/',note:'Official University of Agriculture Faisalabad admission portal.'},
    {id:'uaf-merit',universityId:'uaf',category:'Merit Lists',source:'official',title:'UAF Undergraduate Merit Lists',url:'https://web.uaf.edu.pk/Downloads/MeritListsView',note:'Official undergraduate merit-list portal.'},

    {id:'gcuf-results-deep',universityId:'gcuf',category:'Results',source:'official',title:'GCUF Annual Examination Results',url:'https://gcuf.edu.pk/annual-system/examination-annual-results/',note:'Official GCUF annual-system result notices and gazettes.'},
    {id:'gcuf-student',universityId:'gcuf',category:'LMS / Student Portal',source:'official',title:'GCUF Student LMS / Portal',url:'https://student.gcuf.edu.pk/login.php',note:'Official GCUF student portal for academic records, course registration, fees and examination details.'},
    {id:'gcuf-admissions',universityId:'gcuf',category:'Admissions',source:'official',title:'GCUF Admissions Portal',url:'https://admissions.gcuf.edu.pk/login.php',note:'Official GCUF online admissions portal.'},
    {id:'gcuf-merit',universityId:'gcuf',category:'Merit Lists',source:'official',title:'GCUF Merit Lists',url:'https://admissions.gcuf.edu.pk/merit.php',note:'Official admission merit-list portal.'},

    {id:'su-portal-suite',universityId:'su',category:'LMS / Student Portal',source:'official',title:'University of Sargodha Portal Suite',url:'https://affiliations.su.edu.pk/',note:'Official UOS gateway exposing LMS, admissions, affiliations and QEC portal routes.'},

    {id:'comsats-home',universityId:'comsats',category:'University Portal',source:'official',title:'COMSATS University Official Portal',url:'https://www.comsats.edu.pk/',note:'Official university portal for campus, admissions, academic and examination services.'},
    {id:'nust-home',universityId:'nust',category:'University Portal',source:'official',title:'NUST Official Portal',url:'https://nust.edu.pk/',note:'Official NUST portal for programmes, admissions, academics and student services.'},
    {id:'qau-home',universityId:'qau',category:'University Portal',source:'official',title:'Quaid-i-Azam University Official Portal',url:'https://qau.edu.pk/',note:'Official QAU portal for admissions, academics, examinations and notices.'},
    {id:'uetl-home',universityId:'uetl',category:'University Portal',source:'official',title:'UET Lahore Official Portal',url:'https://uet.edu.pk/',note:'Official UET Lahore portal for admissions, academics and examinations.'},
    {id:'fast-home',universityId:'fast',category:'University Portal',source:'official',title:'FAST-NUCES Official Portal',url:'https://www.nu.edu.pk/',note:'Official FAST-NUCES university portal for campuses, programmes, admissions and academics.'},
    {id:'iiui-home',universityId:'iiui',category:'University Portal',source:'official',title:'IIUI Official Portal',url:'https://www.iiu.edu.pk/',note:'Official International Islamic University Islamabad portal.'},
    {id:'iub-home',universityId:'iub',category:'University Portal',source:'official',title:'Islamia University Bahawalpur Official Portal',url:'https://www.iub.edu.pk/',note:'Official IUB portal for admissions, student services and examinations.'},
    {id:'ue-home',universityId:'ue',category:'University Portal',source:'official',title:'University of Education Official Portal',url:'https://ue.edu.pk/',note:'Official University of Education Lahore portal.'},
    {id:'gcu-home',universityId:'gcu',category:'University Portal',source:'official',title:'GCU Lahore Official Portal',url:'https://gcu.edu.pk/',note:'Official Government College University Lahore portal.'},
    {id:'lcwu-home',universityId:'lcwu',category:'University Portal',source:'official',title:'LCWU Official Portal',url:'https://www.lcwu.edu.pk/',note:'Official Lahore College for Women University portal.'},
    {id:'air-home',universityId:'air',category:'University Portal',source:'official',title:'Air University Official Portal',url:'https://www.au.edu.pk/',note:'Official Air University portal for admissions and academics.'},
    {id:'numl-home',universityId:'numl',category:'University Portal',source:'official',title:'NUML Official Portal',url:'https://www.numl.edu.pk/',note:'Official NUML portal for campuses, admissions and academics.'}
  ].forEach(addRes);

  U.updatedAt='2026-10-02';
})();