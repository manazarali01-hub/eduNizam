/* EduNizam 2026 senior-grade primary-source discovery catalog.
   Publisher-hosted links only. These are source indexes, NOT scraped textbooks,
   official chapter transcriptions, or certification of any practice item.
   Before exam creation, school staff must choose the actual prescribed edition. */
(function(){
  'use strict';
  const study=window.EDUNIZAM_STUDY_DATA;
  if(!Array.isArray(study?.materials))return;
  const seen=new Set(study.materials.map(x=>x.id));
  const nccUrl='https://ncc.gov.pk/Detail/YmFhODM2NTQtMmI1Mi00MGE5LWE3YTUtNTM4Y2U3ZGY4OGJi';
  const pefUrl='https://pef.edu.pk/ADU/Downloads';
  const pefModel='https://www.pef.edu.pk/ADU/Model_Papers202627';
  const pectaaUrl='https://pectaa.edu.pk/curriculum-compliance/';
  const fbiseUrl='https://www.fbise.edu.pk/curriculum_model_paper.php';
  const add=x=>{
    if(seen.has(x.id))return;
    study.materials.push({...x,source:'official',curriculumStatus:'needs-verification',
      curriculumLookupVerified:'2026-10-09'});
    seen.add(x.id);
  };
  const subjects=[
    ['Mathematics','Mathematics'],['English','English'],['Urdu','Urdu'],
    ['Physics','Physics'],['Chemistry','Chemistry'],['Biology','Biology'],
    ['Computer Science','Computer Science'],['General Science','General Science'],
    ['Islamiat / Ethics','Islamiat']
  ];
  for(const [subject,officialName] of subjects){
    const slug=subject.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    add({id:'ncc-2026-rationalized-'+slug,
      board:'National Curriculum Council (NCC)',authorityId:'national-ncc',
      classLevels:[9,10,11,12],subject,type:'Syllabus',
      title:'NCC 2026 Rationalized Curriculum — '+officialName+' (Grades 9–12)',
      url:nccUrl,curriculumSession:'NCP Rationalized 2026',
      note:'NCC official rationalized 2026 curriculum document directory for '+officialName+
        '. Open the subject document there. The page does not certify EduNizam concept topics, the prescribed textbook edition, or your examination board implementation.'
    });
  }
  add({id:'pef-secondary-content-book-2026-27',
    board:'Punjab Education Foundation',authorityId:'punjab-pectaa',
    classLevels:[9,10],subject:'All Subjects',type:'Syllabus',
    title:'PEF 2026–27 Secondary Content Book / QAT SLOs (Class 9–10)',
    url:pefUrl,curriculumSession:'2026–27',
    note:'The official PEF ADU Downloads listing contains Content Book Secondary 2026–27. Open the file on the official download page. This is QAT preparation guidance for PEF partner schools, not an automatically adopted school syllabus.'
  });
  for(const grade of [9,10]){
    add({id:'pef-qat-model-2026-27-grade-'+grade,
      board:'Punjab Education Foundation',authorityId:'punjab-pectaa',
      classLevels:[grade],subject:'All Subjects',type:'Model Papers',
      title:'Class '+grade+' — PEF Official QAT Model Paper (2026–27)',
      url:pefModel,curriculumSession:'2026–27',
      note:'Official 2026–27 PEF model-paper listing contains Class '+grade+'. Select the class on the source page; model papers demonstrate QAT format, not exact school exam papers.'
    });
  }
  for(const grade of [9,10,11,12]){
    add({id:'pectaa-current-books-'+grade+'-2026',
      board:'Punjab · PECTAA',authorityId:'punjab-pectaa',
      classLevels:[grade],subject:'All Subjects',type:'Textbook',
      title:'Class '+grade+' — PECTAA Current Textbook Edition Lookup (2026–27)',
      url:pectaaUrl,curriculumSession:'2026–27 source directory',
      note:'Publisher listing includes class-specific subject/medium titles and revised editions where shown. Check the precise book, subject and edition; do not assume every listed title is prescribed for the student.'
    });
    add({id:'fbise-slo-model-'+grade+'-2026',
      board:'FBISE Islamabad',authorityId:'federal-fbise',
      classLevels:[grade],subject:'All Subjects',type:'Assessment Framework',
      title:'FBISE Class '+grade+' — Official SLO Assessment Frameworks & Model Papers',
      url:fbiseUrl,curriculumSession:'FBISE official current directory',
      note:'Open the class and subject-specific FBISE framework/model-paper document. Federal assessment requirements may differ from Punjab and other boards.'
    });
  }
  window.EDUNIZAM_SENIOR_GRADE_SOURCES={
    verifiedAt:'2026-10-09',grades:[9,10,11,12],
    nccSubjects:subjects.map(x=>x[0]),
    nccUrl,pefUrl,pefModel,pectaaUrl,fbiseUrl,
    sourceStatus:'Authoritative directories verified; subject-to-textbook chapter alignments NOT verified'
  };
})();
