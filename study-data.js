window.EDUNIZAM_STUDY_DATA={
  materials:[
    {id:"fbise-syllabus-hub",board:"FBISE Islamabad",classLevels:[9,10,11,12],subject:"All Subjects",type:"Syllabus",title:"FBISE Syllabus & Model Question Papers Hub",source:"official",url:"https://www.fbise.edu.pk/syllabus.php",note:"Official FBISE syllabus, scheme of studies and model-paper hub."},
    {id:"fbise-slo-hub",board:"FBISE Islamabad",classLevels:[9,10,11,12],subject:"All Subjects",type:"Assessment Framework",title:"FBISE SLO Assessment Frameworks & Model Papers",source:"official",url:"https://www.fbise.edu.pk/curriculum_model_paper.php",note:"Official SLO-based assessment frameworks, model papers and supporting resources."},
    {id:"fbise-scheme-2024",board:"FBISE Islamabad",classLevels:[9,10,11,12],subject:"All Subjects",type:"Scheme of Studies",title:"Inclusive Scheme of Studies 2024",source:"official",url:"https://www.fbise.edu.pk/Syllabus/Scheme-of-Studies.pdf",fileUrl:"https://www.fbise.edu.pk/Syllabus/Scheme-of-Studies.pdf",note:"Official FBISE implementation scheme for SSC/HSSC."},
    {id:"fbise-ssc1-syllabus",board:"FBISE Islamabad",classLevels:[9],subject:"All Subjects",type:"Syllabus",title:"FBISE SSC-I Syllabus & Model Papers",source:"official",url:"https://www.fbise.edu.pk/syllabusSSC-I.php",note:"Official class 9 syllabus and model-paper resources."},
    {id:"fbise-hssc1-revised",board:"FBISE Islamabad",classLevels:[11],subject:"Biology / Chemistry / Computer Science / Mathematics / Physics",type:"Model Papers",title:"FBISE Revised HSSC-I Model Papers",source:"official",url:"https://www.fbise.edu.pk/syllabusHSSC-I-revisedpaper.php",note:"Official revised model papers for HSSC-I core science subjects."},
    {id:"math-9-formula-sheet",board:"EduNizam",classLevels:[9],subject:"Mathematics",type:"Formula Sheet",title:"Class 9 Mathematics Quick Formula Sheet",source:"built-in",content:"Matrix order = rows × columns\nDeterminant of [[a,b],[c,d]] = ad − bc\nQuadratic discriminant: D = b² − 4ac\nDistance formula: d = √((x₂−x₁)²+(y₂−y₁)²)\nSlope: m=(y₂−y₁)/(x₂−x₁)"},
    {id:"math-10-formula-sheet",board:"EduNizam",classLevels:[10],subject:"Mathematics",type:"Formula Sheet",title:"Class 10 Mathematics Quick Formula Sheet",source:"built-in",content:"Quadratic formula: x=(-b±√(b²−4ac))/(2a)\nsin²θ+cos²θ=1\n1+tan²θ=sec²θ\n1+cot²θ=csc²θ\nVariation: y=kx, y=k/x"},
    {id:"physics-9-formula-sheet",board:"EduNizam",classLevels:[9],subject:"Physics",type:"Formula Sheet",title:"Class 9 Physics Quick Formula Sheet",source:"built-in",content:"Speed = distance/time\nVelocity = displacement/time\nAcceleration = Δv/Δt\nForce: F=ma\nMomentum: p=mv\nWork: W=Fd\nPower: P=W/t"},
    {id:"physics-10-formula-sheet",board:"EduNizam",classLevels:[10],subject:"Physics",type:"Formula Sheet",title:"Class 10 Physics Quick Formula Sheet",source:"built-in",content:"Wave speed: v=fλ\nOhm's law: V=IR\nElectric power: P=VI=I²R=V²/R\nCharge: Q=It\nLens formula: 1/f=1/v+1/u"},
    {id:"math-11-formula-sheet",board:"EduNizam",classLevels:[11],subject:"Mathematics",type:"Formula Sheet",title:"Class 11 Mathematics Quick Formula Sheet",source:"built-in",content:"AP nth term: aₙ=a+(n−1)d\nAP sum: Sₙ=n/2[2a+(n−1)d]\nGP nth term: aₙ=ar^(n−1)\nGP sum: Sₙ=a(1−rⁿ)/(1−r)\nPermutation: nPr=n!/(n−r)!\nCombination: nCr=n!/[r!(n−r)!]"},
    {id:"math-12-formula-sheet",board:"EduNizam",classLevels:[12],subject:"Mathematics",type:"Formula Sheet",title:"Class 12 Mathematics Quick Formula Sheet",source:"built-in",content:"d/dx(xⁿ)=nxⁿ⁻¹\nd/dx(sin x)=cos x\nd/dx(cos x)=−sin x\n∫xⁿdx=xⁿ⁺¹/(n+1)+C\n∫1/x dx=ln|x|+C\nSlope of tangent = dy/dx"}
  ]
};
/* Official textbook directory per grade: source links, not copies or fabricated chapter text.
   Updated 2026-10-09; actual titles/editions must be checked on the authority portal. */
(function(){
  const D=window.EDUNIZAM_STUDY_DATA;
  if(!D||!Array.isArray(D.materials))return;
  for(let grade=1;grade<=12;grade++){
    D.materials.push({
      id:'pectaa-official-ebooks-grade-'+grade,
      board:'Punjab · PECTAA',classLevels:[grade],subject:'All Subjects',type:'Textbook',
      title:'Class '+grade+' — Official PECTAA Textbook / E-Book Directory',
      source:'official',authorityId:'punjab-pectaa',curriculumStatus:'needs-verification',
      url:'https://pectaa.edu.pk/books-and-publications/',
      note:'Open the official Class '+grade+' ebook listing; check subject, medium, edition and current prescribed syllabus on PECTAA. EduNizam does not reproduce copyrighted textbook pages.'
    });
  }
  D.materials.push({
    id:'pef-content-list-2026-27',
    board:'Punjab Education Foundation',classLevels:Array.from({length:10},(_,i)=>i+1),
    subject:'All Subjects',type:'Syllabus',title:'Punjab PEF Content Lists & Model Papers (2026–27)',
    source:'official',authorityId:'punjab-pectaa',curriculumStatus:'needs-verification',
    url:'https://pef.edu.pk/ADU/Downloads',
    note:'Official PEF download hub for 2026–27 primary, middle and secondary content lists and assessment model papers; confirm applicability to your school.'
  });
})();

/* EDUNIZAM_TEXTBOOK_CATALOG_2026: subject- and grade-specific official lookups.
   Each entry is a directory link, not an asserted direct textbook PDF.
   Subjects below are search categories; check the latest official prescribed
   grade-specific book on the publisher's website before assigning chapters. */
(function(){
  const D=window.EDUNIZAM_STUDY_DATA;
  if(!Array.isArray(D?.materials))return;
  const byGrade={
    1:['Mathematics','English','Urdu','General Knowledge','Waqfiyat e Aama','Islamiat / Ethics','Nazra Quran'],
    2:['Mathematics','English','Urdu','General Knowledge','Waqfiyat e Aama','Islamiat / Ethics','Nazra Quran'],
    3:['Mathematics','English','Urdu','General Knowledge','Waqfiyat e Aama','Islamiat / Ethics','Nazra Quran'],
    4:['Mathematics','English','Urdu','General Science','Social Studies','Islamiat / Ethics','Nazra Quran'],
    5:['Mathematics','English','Urdu','General Science','Social Studies','Islamiat / Ethics','Nazra Quran'],
    6:['Mathematics','English','Urdu','General Science','History','Geography','Computer Science','Islamiat / Ethics','Tarjuma-tul-Quran'],
    7:['Mathematics','English','Urdu','General Science','History','Geography','Computer Science','Islamiat / Ethics','Tarjuma-tul-Quran'],
    8:['Mathematics','English','Urdu','General Science','History','Geography','Computer Science','Islamiat / Ethics','Tarjuma-tul-Quran'],
    9:['Mathematics','English','Urdu','Physics','Chemistry','Biology','Computer Science','Islamiat / Ethics','Pakistan Studies','Tarjuma-tul-Quran'],
    10:['Mathematics','English','Urdu','Physics','Chemistry','Biology','Computer Science','Islamiat / Ethics','Pakistan Studies','Tarjuma-tul-Quran'],
    11:['Mathematics','English','Urdu','Physics','Chemistry','Biology','Computer Science','Statistics','Economics','Islamiat / Ethics','Tarjuma-tul-Quran'],
    12:['Mathematics','English','Urdu','Physics','Chemistry','Biology','Computer Science','Statistics','Economics','Pakistan Studies','Tarjuma-tul-Quran']
  };
  const seen=new Set(D.materials.map(x=>x.id));
  let added=0;
  for(const [grade,subjects] of Object.entries(byGrade)){
    for(const subject of subjects){
      const id='pectaa-book-search-'+grade+'-'+subject.toLowerCase().replace(/[^a-z0-9]+/g,'-');
      if(seen.has(id))continue;
      D.materials.push({
        id,board:'Punjab · PECTAA',classLevels:[Number(grade)],subject,type:'Textbook',
        title:'Class '+grade+' '+subject+' — official eBook lookup',
        source:'official',authorityId:'punjab-pectaa',curriculumStatus:'needs-verification',
        url:'https://pectaa.edu.pk/books-and-publications/',
        note:'Subject-specific lookup shortcut to the PECTAA official eBook directory, not a direct PDF. Check the grade, the exact textbook title, medium, edition and approved session on the portal.'
      });
      seen.add(id);added++;
    }
  }
  window.EDUNIZAM_TEXTBOOK_CATALOG_2026={
    updatedAt:'2026-10-09',sourceUrl:'https://pectaa.edu.pk/books-and-publications/',
    sourceType:'official publisher directory, NOT downloadable book copies',
    grades:Object.keys(byGrade).map(Number),entries:added
  };
})();

/* EDUNIZAM_PEF_2026_27_RESOURCES
 * Official PEF 2026–27 content books and class-linked assessment samples.
 * External official PDFs remain hosted by PEF; no textbook or model-question
 * reproduction here. A QAT sample is not an official school exam paper.
 * Direct file URLs below come from the official ADU download/model pages. */
(function(){
  const D=window.EDUNIZAM_STUDY_DATA;
  if(!Array.isArray(D?.materials))return;
  const base='https://www.pef.edu.pk';
  const shared={board:'Punjab Education Foundation',subject:'All Subjects',source:'official',
    authorityId:'punjab-pectaa',curriculumStatus:'needs-verification'};
  const sources=[
    {id:'pef-content-primary-2026-27',classLevels:[1,2,3,4,5],
     type:'Syllabus',title:'PEF 2026–27 — Primary Content Book & SLOs (Class 1–5)',
     url:base+'/pdf/downloads/Content-List/Content%20Book%20Primary%2020-4-2026.pdf',
     note:'Official PEF 2026–27 primary content book. Follow class/subject SLOs; verify the precise school textbook/medium and whether PEF-QAT guidance applies.'},
    {id:'pef-content-middle-2026-27',classLevels:[6,7,8],
     type:'Syllabus',title:'PEF 2026–27 — Middle Content Book & SLOs (Class 6–8)',
     url:base+'/pdf/downloads/Content-List/Content%20Book%20Middle%2020-4-2026.pdf',
     note:'Official PEF 2026–27 middle-school SLO content book. Includes subject, month/week and topic guidance. Confirm the school syllabus and current prescribed textbooks.'}
  ];
  const modelPage=base+'/ADU/Model_Papers202627';
  const verifiedGradePdfs=new Set([1,3,5,7,8]);
  for(let grade=1;grade<=8;grade++){
    const direct=verifiedGradePdfs.has(grade);
    const pdf=base+'/pdf/downloads/Model-Papers/A.Y%202026-27/class%20'+grade+'.pdf';
    sources.push({
      id:'pef-qat-model-2026-27-grade-'+grade,
      classLevels:[grade],type:'Model Papers',
      title:'Class '+grade+' — Official PEF QAT Model Paper (2026–27)',
      url:direct?pdf:modelPage,...(direct?{fileUrl:pdf}:{}),
      note:direct?
        'PEF official 2026–27 class-'+grade+' model PDF. Illustrates the QAT test pattern only; not a guarantee of the exact school paper or taught syllabus.':
        'Official PEF 2026–27 class-wise model-paper page; choose Class '+grade+' to open its resource. Link deliberately points to the official listing rather than an unverified direct PDF.'
    });
  }
  const ids=new Set(D.materials.map(m=>m.id));
  for(const row of sources){
    if(ids.has(row.id))continue;
    D.materials.push({...shared,...row,...(String(row.url||'').toLowerCase().endsWith('.pdf')?{fileUrl:row.url}:{})});
    ids.add(row.id);
  }
  window.EDUNIZAM_PEF_2026_27_RESOURCES={
    source:'https://www.pef.edu.pk/ADU/Downloads',
    modelPage,grades:[1,2,3,4,5,6,7,8],
    contentBooks:2,modelPaperGrades:8,directModelPdfs:[...verifiedGradePdfs],
    caveat:'Official PEF QAT models are assessment examples; current school textbooks and syllabus must still be confirmed.'
  };
})();

// Reactivate PECTAA directory entries if this library loads after school academic forms.
window.EDUNIZAM_PUNJAB_SUBJECT_PACK?.applyToStudy?.();
window.EDUNIZAM_PECTAA_SECONDARY_BOOKS?.apply?.();
