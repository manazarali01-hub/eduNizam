(function(){
'use strict';
const addUnique=(list,items,key='id')=>{
  if(!Array.isArray(list))return;
  const seen=new Set(list.map(x=>x?.[key]).filter(Boolean));
  items.forEach(x=>{const k=x?.[key];if(k&&!seen.has(k)){seen.add(k);list.push(x)}});
};

/* Complete the public Past Papers catalogue with one honest portal entry
   for every board/class. Portal entries are not claimed as exact year papers. */
const PP=window.EDUNIZAM_PAST_PAPERS;
if(PP){
  const portals=[];
  (PP.boards||[]).forEach(b=>{
    (b.classes||[]).forEach(cl=>{
      portals.push({
        id:'portal-'+b.id+'-'+cl,
        boardId:b.id,
        classLevel:cl,
        subject:'All Subjects',
        year:null,
        session:'All Sessions',
        type:'portal',
        medium:'English / Urdu',
        source:b.archiveUrl?'verified':'official',
        title:b.name+' Class '+cl+' Paper / Examination Resource Portal',
        url:b.archiveUrl||b.officialUrl,
        note:b.archiveUrl
          ?'Board-specific verified archive/portal. Choose the required subject and year at the source; availability varies by board.'
          :'Official board portal. Use its examination/download sections for papers, model papers, schemes and notices available from the board.'
      });
    });
  });
  addUnique(PP.papers,portals);
  PP.updatedAt='2026-10-01';
}

/* Grade 5 & 8: current official PECTAA curriculum/e-book hubs plus model-paper subjects.
   Grade 5 model papers are not invented because the current official Model Papers page lists Grade 8. */
const SA=window.EDUNIZAM_SCHOOL_ASSESSMENTS;
if(SA){
  const curriculum='https://pectaa.edu.pk/curriculum-compliance/';
  const models='https://pectaa.edu.pk/model-papers/';
  addUnique(SA.resources,[
    {id:'pectaa-g5-english',grade:5,subject:'English',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 5 English Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub covering Grade 5 English.'},
    {id:'pectaa-g5-urdu',grade:5,subject:'Urdu',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 5 Urdu Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub covering Grade 5 Urdu.'},
    {id:'pectaa-g5-science',grade:5,subject:'General Science',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 5 General Science Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub covering Grade 5 General Science.'},
    {id:'pectaa-g5-social',grade:5,subject:'Social Studies',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 5 Social Studies Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub covering Grade 5 Social Studies.'},
    {id:'pectaa-g5-islamiat',grade:5,subject:'Islamiat',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 5 Islamiat Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub covering Grade 5 Islamiat.'},
    {id:'pectaa-g8-english-model',grade:8,subject:'English',year:2026,type:'Model Paper',source:'official',title:'PECTAA Grade 8 English Model Paper 2026',url:models,note:'Official PECTAA Grade 8 Model Papers page; open English from the official list.'},
    {id:'pectaa-g8-urdu-model',grade:8,subject:'Urdu',year:2026,type:'Model Paper',source:'official',title:'PECTAA Grade 8 Urdu Model Paper 2026',url:models,note:'Official PECTAA Grade 8 Model Papers page; open Urdu from the official list.'},
    {id:'pectaa-g8-science-model',grade:8,subject:'General Science',year:2026,type:'Model Paper',source:'official',title:'PECTAA Grade 8 Science Model Paper 2026',url:models,note:'Official PECTAA Grade 8 Model Papers page; open Science from the official list.'},
    {id:'pectaa-g8-english-curriculum',grade:8,subject:'English',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 English Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub for Grade 8 English.'},
    {id:'pectaa-g8-urdu-curriculum',grade:8,subject:'Urdu',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 Urdu Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub for Grade 8 Urdu.'},
    {id:'pectaa-g8-math-curriculum',grade:8,subject:'Mathematics',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 Mathematics Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub for Grade 8 Mathematics.'},
    {id:'pectaa-g8-science-curriculum',grade:8,subject:'General Science',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 General Science Curriculum & E-Book Resources',url:curriculum,note:'Official PECTAA curriculum/e-book hub for Grade 8 General Science.'},
    {id:'pectaa-g8-computer',grade:8,subject:'Computer Science',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 Computer Science E-Book Resources',url:curriculum,note:'Official PECTAA e-book hub includes Grade 8 Computer Science.'},
    {id:'pectaa-g8-islamiat',grade:8,subject:'Islamiat',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 Islamiat E-Book Resources',url:curriculum,note:'Official PECTAA e-book hub includes Grade 8 Islamiat.'},
    {id:'pectaa-g8-history-geography',grade:8,subject:'History / Geography',year:2026,type:'Curriculum / E-Book Hub',source:'official',title:'PECTAA Grade 8 History & Geography E-Book Resources',url:curriculum,note:'Official PECTAA e-book hub includes Grade 8 History and Geography.'}
  ]);
  SA.updatedAt='2026-10-01';
}

/* Study Library: official hubs plus concise built-in revision sheets.
   Built-ins are labelled EduNizam resources and do not masquerade as official textbooks. */
const SD=window.EDUNIZAM_STUDY_DATA;
if(SD){
  addUnique(SD.materials,[
    {id:'pectaa-curriculum-ebooks',board:'Punjab / PECTAA',classLevels:[5,8,9,10,11,12],subject:'All Subjects',type:'Curriculum / E-Books',title:'PECTAA Curriculum, Smart Syllabus & E-Books Hub',source:'official',url:'https://pectaa.edu.pk/curriculum-compliance/',note:'Official Punjab curriculum, smart syllabus, schemes and e-book hub.'},
    {id:'pectaa-grade9-pairing',board:'Punjab / PECTAA',classLevels:[9],subject:'All Subjects',type:'Pairing Schemes / Model Papers',title:'PECTAA Grade 9 Smart Syllabus, Pairing Schemes & Model Papers',source:'official',url:'https://pectaa.edu.pk/curriculum-compliance/',note:'Official PECTAA hub for the current Grade 9 smart syllabus, pairing schemes and model-paper resources.'},
    {id:'pectaa-grade11-pairing',board:'Punjab / PECTAA',classLevels:[11],subject:'All Subjects',type:'Pairing Schemes / Model Papers',title:'PECTAA Grade 11 Smart Syllabus, Pairing Schemes & Model Papers',source:'official',url:'https://pectaa.edu.pk/curriculum-compliance/',note:'Official PECTAA hub for Grade 11 Annual Examination 2026 smart syllabus, pairing schemes and model papers.'},
    {id:'chem-9-quick',board:'EduNizam',classLevels:[9],subject:'Chemistry',type:'Quick Revision',title:'Class 9 Chemistry Quick Revision',source:'built-in',content:'Atomic number = number of protons.\nMass number = protons + neutrons.\nPeriod number relates to occupied electron shells.\nGroup trends help compare valence electrons and chemical properties.\nA mole contains 6.022 × 10²³ particles.'},
    {id:'chem-10-quick',board:'EduNizam',classLevels:[10],subject:'Chemistry',type:'Quick Revision',title:'Class 10 Chemistry Quick Revision',source:'built-in',content:'pH < 7 acidic, pH = 7 neutral, pH > 7 basic.\nAt equilibrium, forward and reverse reaction rates are equal.\nHydrocarbons contain carbon and hydrogen.\nFunctional groups determine many organic properties.'},
    {id:'bio-9-quick',board:'EduNizam',classLevels:[9],subject:'Biology',type:'Quick Revision',title:'Class 9 Biology Quick Revision',source:'built-in',content:'Cell is the basic unit of life.\nMitochondria release usable energy by respiration.\nRibosomes synthesize proteins.\nDNA carries hereditary information.\nClassification organizes organisms by shared characteristics.'},
    {id:'bio-10-quick',board:'EduNizam',classLevels:[10],subject:'Biology',type:'Quick Revision',title:'Class 10 Biology Quick Revision',source:'built-in',content:'Alveoli provide a large surface for gas exchange.\nKidneys help maintain water and salt balance.\nNeurons transmit nerve impulses.\nHormones are chemical messengers.\nReproduction transfers genetic information to offspring.'},
    {id:'cs-9-quick',board:'EduNizam',classLevels:[9],subject:'Computer Science',type:'Quick Revision',title:'Class 9 Computer Science Quick Revision',source:'built-in',content:'Binary uses digits 0 and 1.\nCPU executes instructions.\nRAM is volatile working memory.\nAn algorithm is a finite sequence of steps.\nA flowchart represents algorithmic logic visually.'},
    {id:'cs-10-quick',board:'EduNizam',classLevels:[10],subject:'Computer Science',type:'Quick Revision',title:'Class 10 Computer Science Quick Revision',source:'built-in',content:'A database stores structured data.\nA primary key uniquely identifies a record.\nHTML structures web content.\nCSS controls presentation.\nValidation helps prevent invalid input.'},
    {id:'physics-11-quick',board:'EduNizam',classLevels:[11],subject:'Physics',type:'Formula Sheet',title:'Class 11 Physics Quick Formula Sheet',source:'built-in',content:'Momentum p = mv.\nForce F = Δp/Δt.\nWork W = Fd cosθ.\nKinetic energy = ½mv².\nPower P = W/t.\nCentripetal acceleration a = v²/r.'},
    {id:'physics-12-quick',board:'EduNizam',classLevels:[12],subject:'Physics',type:'Formula Sheet',title:'Class 12 Physics Quick Formula Sheet',source:'built-in',content:'Coulomb force F = kq₁q₂/r².\nElectric field E = F/q.\nPotential V = W/q.\nInduced emf ε = −N dΦ/dt.\nTransformer ideal ratio Vp/Vs = Np/Ns.'},
    {id:'chem-11-quick',board:'EduNizam',classLevels:[11],subject:'Chemistry',type:'Quick Revision',title:'Class 11 Chemistry Quick Revision',source:'built-in',content:'1 mole = 6.022 × 10²³ entities.\nMolar mass is expressed in g mol⁻¹.\nIdeal gas relation: PV = nRT.\nBond polarity depends on electronegativity difference.\nOxidation involves loss of electrons.'},
    {id:'chem-12-quick',board:'EduNizam',classLevels:[12],subject:'Chemistry',type:'Quick Revision',title:'Class 12 Chemistry Quick Revision',source:'built-in',content:'Organic compounds are classified by functional groups.\nAlcohols contain −OH.\nCarboxylic acids contain −COOH.\nPolymers consist of repeating monomer units.\nElectrochemical cells convert chemical and electrical energy.'},
    {id:'bio-11-quick',board:'EduNizam',classLevels:[11],subject:'Biology',type:'Quick Revision',title:'Class 11 Biology Quick Revision',source:'built-in',content:'Enzymes lower activation energy.\nATP is a major cellular energy carrier.\nCell membranes are selectively permeable.\nDNA stores genetic information.\nPhotosynthesis converts light energy into chemical energy.'},
    {id:'bio-12-quick',board:'EduNizam',classLevels:[12],subject:'Biology',type:'Quick Revision',title:'Class 12 Biology Quick Revision',source:'built-in',content:'Genes are units of heredity.\nMeiosis produces haploid cells.\nNatural selection changes allele frequencies across generations.\nHomeostasis maintains stable internal conditions.\nEcosystems involve energy flow and nutrient cycling.'},
    {id:'stats-11-quick',board:'EduNizam',classLevels:[11],subject:'Statistics',type:'Formula Sheet',title:'Class 11 Statistics Quick Formula Sheet',source:'built-in',content:'Mean = Σx/n.\nWeighted mean = Σwx/Σw.\nRange = maximum − minimum.\nProbability P(A) = favorable outcomes / total outcomes for equally likely cases.\nP(Aᶜ)=1−P(A).'},
    {id:'stats-12-quick',board:'EduNizam',classLevels:[12],subject:'Statistics',type:'Formula Sheet',title:'Class 12 Statistics Quick Formula Sheet',source:'built-in',content:'Variance measures average squared deviation from the mean.\nStandard deviation = √variance.\nCorrelation ranges from −1 to +1.\nRegression models relationships between variables.\nExpected value E(X)=ΣxP(x).'},
    {id:'english-grammar-9-10',board:'EduNizam',classLevels:[9,10],subject:'English',type:'Grammar Revision',title:'Class 9–10 English Grammar Quick Review',source:'built-in',content:'A sentence needs a complete thought.\nActive voice: subject performs the action.\nPassive voice: object receives the action.\nUse subject–verb agreement.\nCheck tense consistency, punctuation and pronoun reference.'},
    {id:'english-writing-11-12',board:'EduNizam',classLevels:[11,12],subject:'English',type:'Writing Revision',title:'Class 11–12 English Writing Quick Review',source:'built-in',content:'Plan a clear thesis or main idea.\nUse topic sentences for paragraphs.\nSupport claims with relevant evidence/examples.\nLink ideas with transitions.\nEdit for grammar, clarity and concise expression.'},
    {id:'pakstudies-quick',board:'EduNizam',classLevels:[9,10,12],subject:'Pakistan Studies',type:'Quick Revision',title:'Pakistan Studies Quick Revision',source:'built-in',content:'Pakistan became independent in 1947.\nThe Lahore Resolution was passed in 1940.\nThe Constitution of 1973 is the current constitutional framework.\nStudy geography, resources, population and civic institutions together with historical development.'},
    {id:'islamiat-quick',board:'EduNizam',classLevels:[9,10,11],subject:'Islamiat / Ethics',type:'Quick Revision',title:'Islamiat / Ethics Quick Revision',source:'built-in',content:'Review core beliefs, worship, Seerah, moral conduct and social responsibilities.\nFor Quranic/Arabic text, always use the wording prescribed in the current textbook and syllabus.\nEthics alternatives should be studied from the officially prescribed material.'},
    {id:'exam-focus-9',board:'EduNizam',classLevels:[9],subject:'All Subjects',type:'Guess / Practice Sheet',title:'Class 9 Exam Focus Practice Sheet',source:'built-in',content:'Not an official guess paper or prediction. Use this as a revision checklist:\\n1. Revise current syllabus/SLOs from the official board source.\\n2. Attempt official model papers first.\\n3. Practice definitions, short questions and numericals from each completed chapter.\\n4. Review weak topics using textbook examples.\\n5. Finish with one timed full-paper practice.'},
    {id:'exam-focus-10',board:'EduNizam',classLevels:[10],subject:'All Subjects',type:'Guess / Practice Sheet',title:'Class 10 Exam Focus Practice Sheet',source:'built-in',content:'Not an official guess paper or prediction. Prepare from the current syllabus and official model/past papers. Build a timed practice paper using key definitions, textbook exercises, important numericals, diagrams where required, and long-answer practice from major units.'},
    {id:'exam-focus-11',board:'EduNizam',classLevels:[11],subject:'All Subjects',type:'Guess / Practice Sheet',title:'Class 11 Exam Focus Practice Sheet',source:'built-in',content:'Not an official prediction. Use the current board syllabus/pairing scheme where officially published. Practice conceptual MCQs, short questions, derivations or numericals for science subjects, and structured long answers for humanities subjects.'},
    {id:'exam-focus-12',board:'EduNizam',classLevels:[12],subject:'All Subjects',type:'Guess / Practice Sheet',title:'Class 12 Exam Focus Practice Sheet',source:'built-in',content:'Not an official prediction. Combine current syllabus, official model papers and previous papers. Prioritize repeated concepts rather than memorizing recalled questions, and complete at least one full timed paper before the exam.'}
  ]);
}

/* University directory: broaden the visitor catalogue with HEC-recognized/major Pakistani institutions.
   Each item links only to the institution's own site or the HEC recognition directory. */
const U=window.EDUNIZAM_UNIVERSITY_DATA;
if(U){
  const extra=[
    {id:'hec-directory',name:'HEC Recognized Universities & Campuses Directory',type:'Official Recognition Directory',officialUrl:'https://www.hec.gov.pk/english/universities/Pages/DAIs/HEC-recognized-Campuses.aspx'},
    {id:'qau',name:'Quaid-i-Azam University',type:'Public',officialUrl:'https://qau.edu.pk/'},
    {id:'iiui',name:'International Islamic University Islamabad',type:'Public',officialUrl:'https://www.iiu.edu.pk/'},
    {id:'air',name:'Air University',type:'Public',officialUrl:'https://www.au.edu.pk/'},
    {id:'bahria',name:'Bahria University',type:'Public',officialUrl:'https://www.bahria.edu.pk/'},
    {id:'numl',name:'National University of Modern Languages',type:'Public',officialUrl:'https://www.numl.edu.pk/'},
    {id:'gcu-lahore',name:'Government College University Lahore',type:'Public',officialUrl:'https://www.gcu.edu.pk/'},
    {id:'ue',name:'University of Education Lahore',type:'Public',officialUrl:'https://ue.edu.pk/'},
    {id:'iub',name:'The Islamia University of Bahawalpur',type:'Public',officialUrl:'https://www.iub.edu.pk/'},
    {id:'uet-taxila',name:'University of Engineering and Technology Taxila',type:'Public',officialUrl:'https://www.uettaxila.edu.pk/'},
    {id:'uok',name:'University of Karachi',type:'Public',officialUrl:'https://uok.edu.pk/'},
    {id:'iba-karachi',name:'Institute of Business Administration Karachi',type:'Public',officialUrl:'https://www.iba.edu.pk/'},
    {id:'ned',name:'NED University of Engineering & Technology',type:'Public',officialUrl:'https://www.neduet.edu.pk/'},
    {id:'uop',name:'University of Peshawar',type:'Public',officialUrl:'https://www.uop.edu.pk/'},
    {id:'uet-peshawar',name:'University of Engineering & Technology Peshawar',type:'Public',officialUrl:'https://www.uetpeshawar.edu.pk/'},
    {id:'uob',name:'University of Balochistan',type:'Public',officialUrl:'https://www.uob.edu.pk/'},
    {id:'uajk',name:'University of Azad Jammu & Kashmir',type:'Public',officialUrl:'https://uajk.edu.pk/'},
    {id:'kiu',name:'Karakoram International University',type:'Public',officialUrl:'https://www.kiu.edu.pk/'},
    {id:'ntu',name:'National Textile University',type:'Public',officialUrl:'https://www.ntu.edu.pk/'},
    {id:'ist',name:'Institute of Space Technology',type:'Public',officialUrl:'https://ist.edu.pk/'}
  ];
  addUnique(U.universities,extra);
  extra.forEach(x=>{
    if(!U.resources.some(r=>r.id===x.id+'-official')){
      U.resources.push({
        id:x.id+'-official',
        universityId:x.id,
        category:'Academic Resources',
        source:'official',
        title:x.name+' Official Academic Portal',
        url:x.officialUrl,
        note:x.id==='hec-directory'
          ?'Official HEC directory for recognized universities/degree-awarding institutions and campuses.'
          :'Official institution website. Use its academics, examinations, admissions and student-resource sections for current material.'
      });
    }
  });
  addUnique(U.resources,[
    {id:'vu-datesheet',universityId:'vu',category:'Date Sheet',source:'official',title:'VU Official Date Sheet / Exam Slot Portal',url:'https://datesheet.vu.edu.pk/',note:'Official Virtual University date-sheet interface used when an examination date-sheet window is open.'},
    {id:'vu-course-catalog-search',universityId:'vu',category:'Course Catalogue',source:'official',courseAgnostic:true,title:'VU Official Searchable Course Catalogue',url:'https://www.vu.edu.pk/academicprograms/coursescatalogue',note:'Search current VU courses by course code or title on the official catalogue.'},
    {id:'vu-ocw-all-courses',universityId:'vu',category:'Handouts',source:'official',courseAgnostic:true,title:'VU OpenCourseWare — All Courses',url:'https://ocw.vu.edu.pk/Courses.aspx',note:'Official VU OpenCourseWare catalogue with publicly available course material across departments.'},
    {id:'vu-results-news',universityId:'vu',category:'Results / Notices',source:'official',courseAgnostic:true,title:'VU Official Examination & Student Notices',url:'https://www.vu.edu.pk/',note:'Official VU website for current examination, result and student-service notices.'}
  ]);
  U.updatedAt='2026-10-01';
}

/* Expand locally indexed VU course codes using titles verified from official VU catalogue/study-scheme sources.
   Unknown codes still fall back to the official searchable catalogue. */
const VC=window.EDUNIZAM_VU_COURSE_CATALOG;
if(VC){
  const courseUrl='https://www.vu.edu.pk/academicprograms/coursescatalogue';
  const courses=[
    ['ACC311','Fundamentals of Auditing','Accounting, Banking & Finance'],
    ['ACC501','Business Finance','Accounting, Banking & Finance'],
    ['BIO201','Cell Biology','Biological Sciences'],
    ['BIO202','Biochemistry-I','Biological Sciences'],
    ['BIO301','Essentials of Genetics','Biological Sciences'],
    ['CS101','Introduction to Computing','Computer Science/Information Technology'],
    ['CS201','Introduction to Programming','Computer Science/Information Technology'],
    ['CS301','Data Structures','Computer Science/Information Technology'],
    ['CS304','Object Oriented Programming','Computer Science/Information Technology'],
    ['CS403','Database Management Systems','Computer Science/Information Technology'],
    ['CS504','Software Engineering - I','Computer Science/Information Technology'],
    ['CS604','Operating Systems','Computer Science/Information Technology'],
    ['CS610','Computer Networks','Computer Science/Information Technology'],
    ['ECO402','Microeconomics','Economics'],
    ['ECO403','Macroeconomics','Economics'],
    ['ENG101','English Comprehension','English'],
    ['ENG201','Business and Technical English Writing','English'],
    ['IT430','E-Commerce','Computer Science/Information Technology'],
    ['MCM301','Communication Skills','Mass Communication / English'],
    ['MGT101','Financial Accounting','Management'],
    ['MGT501','Human Resource Management','Management'],
    ['MGT502','Organizational Behaviour','Management'],
    ['MGT503','Principles of Management','Management'],
    ['MGT602','Entrepreneurship','Management'],
    ['MGT603','Strategic Management','Management'],
    ['MTH101','Calculus And Analytical Geometry','Mathematics'],
    ['MTH301','Calculus II','Mathematics'],
    ['MTH302','Business Mathematics & Statistics','Mathematics / Statistics'],
    ['MTH501','Linear Algebra','Mathematics'],
    ['MTH647','Methods in Mathematical Physics','Mathematics'],
    ['STA301','Statistics and Probability','Probability & Statistics']
  ];
  courses.forEach(([code,title,category])=>{
    if(!VC.courses.some(x=>x.code===code)){
      VC.courses.push({
        code,title,category,level:'Undergraduate',creditHours:3,
        officialDetails:courseUrl,
        freshness:'Use the official VU searchable catalogue, OpenCourseWare and VULMS to verify current semester material.'
      });
    }
  });
  VC.verifiedAt='2026-10-01';
}

/* Practice Center: ensure every displayed secondary-level subject has usable built-in content.
   Filters are rebuilt from this actual question bank, so unsupported combinations never appear. */
const PD=window.EDUNIZAM_PRACTICE_DATA;
if(PD){
  const q=[
    {id:'q22',classLevel:9,subject:'Computer Science',chapter:'Computer Basics',type:'mcq',difficulty:'Easy',question:'Which two digits are used in the binary number system?',options:['0 and 1','1 and 2','0 and 9','2 and 8'],answer:0,explanation:'Binary represents data using 0 and 1.'},
    {id:'q23',classLevel:9,subject:'Computer Science',chapter:'Algorithms',type:'mcq',difficulty:'Medium',question:'A finite step-by-step procedure for solving a problem is called:',options:['Algorithm','Database','Browser','Protocol'],answer:0,explanation:'An algorithm is a finite sequence of steps used to solve a problem.'},
    {id:'q24',classLevel:9,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'کسی شخص، جگہ یا چیز کے نام کو کیا کہتے ہیں؟',options:['اسم','فعل','حرف','جملہ'],answer:0,explanation:'کسی شخص، جگہ یا چیز کے نام کو اسم کہتے ہیں۔'},
    {id:'q25',classLevel:9,subject:'Islamiat / Ethics',chapter:'Basic Beliefs and Worship',type:'mcq',difficulty:'Easy',question:'How many obligatory daily prayers are prescribed for Muslims?',options:['Three','Four','Five','Six'],answer:2,explanation:'Five daily prayers are obligatory.'},
    {id:'q26',classLevel:9,subject:'Pakistan Studies',chapter:'Pakistan Movement',type:'mcq',difficulty:'Easy',question:'Pakistan became independent in:',options:['1940','1947','1956','1973'],answer:1,explanation:'Pakistan became independent in 1947.'},
    {id:'q27',classLevel:9,subject:'Physics',chapter:'Dynamics',type:'mcq',difficulty:'Medium',question:'According to Newton’s second law, force equals:',options:['mv','ma','m/a','a/m'],answer:1,explanation:'For constant mass, F = ma.'},
    {id:'q28',classLevel:9,subject:'Biology',chapter:'Cell Biology',type:'mcq',difficulty:'Medium',question:'Which organelle is most directly associated with ATP production in eukaryotic cells?',options:['Ribosome','Mitochondrion','Golgi apparatus','Nucleus'],answer:1,explanation:'Mitochondria are major sites of aerobic respiration and ATP production.'},

    {id:'q29',classLevel:10,subject:'Computer Science',chapter:'Databases',type:'mcq',difficulty:'Easy',question:'A field that uniquely identifies a database record is called a:',options:['Primary key','Paragraph','Header','Formula'],answer:0,explanation:'A primary key uniquely identifies each record.'},
    {id:'q30',classLevel:10,subject:'Computer Science',chapter:'Web Basics',type:'mcq',difficulty:'Medium',question:'Which language is primarily used to structure the content of a web page?',options:['HTML','SQL','Python','C++'],answer:0,explanation:'HTML provides the structural markup for web pages.'},
    {id:'q31',classLevel:10,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'کام کے ہونے یا کرنے کو ظاہر کرنے والا لفظ کیا کہلاتا ہے؟',options:['اسم','فعل','صفت','حرف'],answer:1,explanation:'کام کے ہونے یا کرنے کو ظاہر کرنے والا لفظ فعل کہلاتا ہے۔'},
    {id:'q32',classLevel:10,subject:'Islamiat / Ethics',chapter:'Moral Conduct',type:'mcq',difficulty:'Easy',question:'Which value is most directly associated with keeping promises and trusts?',options:['Honesty and trustworthiness','Wastefulness','Pride','Neglect'],answer:0,explanation:'Honesty and trustworthiness require keeping promises and trusts.'},
    {id:'q33',classLevel:10,subject:'Pakistan Studies',chapter:'Constitutional Development',type:'mcq',difficulty:'Medium',question:'Pakistan’s current constitutional framework was adopted in:',options:['1949','1956','1962','1973'],answer:3,explanation:'The Constitution of 1973 is the current constitutional framework.'},
    {id:'q34',classLevel:10,subject:'Chemistry',chapter:'Chemical Equilibrium',type:'mcq',difficulty:'Medium',question:'At dynamic equilibrium, the forward and reverse reaction rates are:',options:['Both zero','Equal','Always increasing','Always decreasing'],answer:1,explanation:'At dynamic equilibrium the forward and reverse reaction rates are equal.'},
    {id:'q35',classLevel:10,subject:'Biology',chapter:'Homeostasis',type:'mcq',difficulty:'Easy',question:'Which organs play the major role in regulating water and salts in the blood?',options:['Kidneys','Lungs','Skin only','Stomach'],answer:0,explanation:'Kidneys are central to osmoregulation and excretion.'},

    {id:'q36',classLevel:11,subject:'Chemistry',chapter:'Basic Concepts',type:'mcq',difficulty:'Easy',question:'One mole contains approximately:',options:['6.022 × 10²³ particles','3.00 × 10⁸ particles','9.8 particles','1.60 × 10⁻¹⁹ particles'],answer:0,explanation:'Avogadro’s constant is approximately 6.022 × 10²³ mol⁻¹.'},
    {id:'q37',classLevel:11,subject:'Biology',chapter:'Cell Structure',type:'mcq',difficulty:'Easy',question:'Protein synthesis occurs on:',options:['Ribosomes','Lysosomes','Centrioles','Vacuoles'],answer:0,explanation:'Ribosomes are the sites of protein synthesis.'},
    {id:'q38',classLevel:11,subject:'Computer Science',chapter:'Problem Solving',type:'mcq',difficulty:'Easy',question:'A flowchart is mainly used to:',options:['Represent an algorithm visually','Store permanent data','Compile a program','Encrypt a network'],answer:0,explanation:'Flowcharts visually represent the steps and decisions in an algorithm.'},
    {id:'q39',classLevel:11,subject:'Statistics',chapter:'Descriptive Statistics',type:'mcq',difficulty:'Easy',question:'The arithmetic mean of 2, 4 and 6 is:',options:['3','4','5','6'],answer:1,explanation:'(2 + 4 + 6) / 3 = 4.'},
    {id:'q40',classLevel:11,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Medium',question:'Choose the sentence with correct subject–verb agreement:',options:['The students is ready.','The students are ready.','The students am ready.','The students be ready.'],answer:1,explanation:'Plural subject “students” takes the plural verb “are”.'},
    {id:'q41',classLevel:11,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'اسم کی خوبی یا حالت بیان کرنے والا لفظ کیا کہلاتا ہے؟',options:['صفت','فعل','حرف','مصدر'],answer:0,explanation:'اسم کی خوبی یا حالت بیان کرنے والا لفظ صفت کہلاتا ہے۔'},
    {id:'q42',classLevel:11,subject:'Islamiat / Ethics',chapter:'Social Responsibility',type:'mcq',difficulty:'Medium',question:'Which principle best supports fairness in dealing with other people?',options:['Justice','Favoritism','Dishonesty','Wastefulness'],answer:0,explanation:'Justice requires fair and equitable treatment.'},
    {id:'q43',classLevel:11,subject:'Physics',chapter:'Vectors and Equilibrium',type:'mcq',difficulty:'Medium',question:'For an object in translational equilibrium, the vector sum of all forces is:',options:['Zero','Maximum','Equal to mass','Equal to velocity'],answer:0,explanation:'Net force is zero in translational equilibrium.'},
    {id:'q44',classLevel:11,subject:'Mathematics',chapter:'Permutation Combination Probability',type:'mcq',difficulty:'Medium',question:'The number of ways to choose 2 objects from 4 distinct objects is:',options:['4','6','8','12'],answer:1,explanation:'4C2 = 6.'},

    {id:'q45',classLevel:12,subject:'Chemistry',chapter:'Organic Chemistry',type:'mcq',difficulty:'Easy',question:'The functional group in an alcohol is:',options:['−OH','−COOH','−CHO','−NH₂'],answer:0,explanation:'Alcohols contain the hydroxyl (−OH) functional group.'},
    {id:'q46',classLevel:12,subject:'Biology',chapter:'Genetics',type:'mcq',difficulty:'Easy',question:'The molecule that stores hereditary information in most organisms is:',options:['DNA','ATP','Glucose','Water'],answer:0,explanation:'DNA stores hereditary information in most organisms.'},
    {id:'q47',classLevel:12,subject:'Computer Science',chapter:'Databases',type:'mcq',difficulty:'Medium',question:'Which database concept reduces unnecessary duplication of data?',options:['Normalization','Animation','Pagination','Compilation'],answer:0,explanation:'Normalization organizes data to reduce redundancy and improve integrity.'},
    {id:'q48',classLevel:12,subject:'Statistics',chapter:'Probability',type:'mcq',difficulty:'Easy',question:'For any event A, P(A) + P(Aᶜ) equals:',options:['0','1','2','Depends on A'],answer:1,explanation:'An event and its complement cover the entire sample space, so their probabilities sum to 1.'},
    {id:'q49',classLevel:12,subject:'English',chapter:'Writing Skills',type:'mcq',difficulty:'Medium',question:'A topic sentence mainly states:',options:['The main idea of a paragraph','The page number','A bibliography entry','Only a quotation'],answer:0,explanation:'A topic sentence expresses the controlling idea of a paragraph.'},
    {id:'q50',classLevel:12,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'دو یا دو سے زیادہ الفاظ کا ایسا مجموعہ جو مکمل بات بیان کرے کیا کہلاتا ہے؟',options:['جملہ','حرف','صفت','واحد'],answer:0,explanation:'مکمل بات بیان کرنے والے الفاظ کے مجموعے کو جملہ کہتے ہیں۔'},
    {id:'q51',classLevel:12,subject:'Pakistan Studies',chapter:'Geography and Resources',type:'mcq',difficulty:'Medium',question:'Which river system is most important for Pakistan’s large-scale irrigated agriculture?',options:['Indus river system','Amazon river system','Danube river system','Nile river system'],answer:0,explanation:'Pakistan’s major irrigation network is based on the Indus river system.'},
    {id:'q52',classLevel:12,subject:'Physics',chapter:'Current Electricity',type:'mcq',difficulty:'Medium',question:'Electrical power can be calculated using:',options:['P = VI','P = V/I only','P = IR only','P = Q/t²'],answer:0,explanation:'Electrical power is P = VI; equivalent forms follow from Ohm’s law.'},
    {id:'q53',classLevel:12,subject:'Mathematics',chapter:'Integration',type:'mcq',difficulty:'Medium',question:'For n ≠ −1, ∫xⁿ dx equals:',options:['xⁿ⁺¹/(n+1)+C','nxⁿ⁻¹+C','ln|x|+C for all n','1/x+C'],answer:0,explanation:'The power rule for integration is ∫xⁿdx = xⁿ⁺¹/(n+1)+C for n ≠ −1.'}
  ];
  addUnique(PD.questions,q);
  const subjects={};
  const chapters={};
  PD.questions.forEach(x=>{
    const c=String(x.classLevel),s=x.subject,k=c+'|'+s;
    (subjects[c]||(subjects[c]=[]));
    if(!subjects[c].includes(s))subjects[c].push(s);
    (chapters[k]||(chapters[k]=[]));
    if(x.chapter&&!chapters[k].includes(x.chapter))chapters[k].push(x.chapter);
  });
  Object.keys(subjects).forEach(k=>subjects[k].sort());
  Object.keys(chapters).forEach(k=>chapters[k].sort());
  PD.subjects=subjects;
  PD.chapters=chapters;
}
})();
