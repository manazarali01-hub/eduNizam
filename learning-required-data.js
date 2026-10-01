(function(){
'use strict';
const addUnique=(arr,items,key='id')=>{
  if(!Array.isArray(arr))return;
  const seen=new Set(arr.map(x=>String(x?.[key]??'')));
  (items||[]).forEach(x=>{const k=String(x?.[key]??'');if(k&&!seen.has(k)){arr.push(x);seen.add(k)}});
};

/* Complete the public Learning Hub data without inventing unavailable papers.
   Official directories are used when a direct paper/file is not publicly indexed. */

// ---------- VIRTUAL UNIVERSITY COURSE INDEX ----------
const VC=window.EDUNIZAM_VU_COURSE_CATALOG;
if(VC){
  const groups={
    'Computer Science/Information Technology':[
      ['CS101','Introduction to Computing'],['CS201','Introduction to Programming'],['CS202','Fundamentals of Front End Development'],
      ['CS205','Information Security'],['CS206','Introduction to Network Design & Analysis'],['CS301','Data Structures'],
      ['CS302','Digital Logic Design'],['CS304','Object Oriented Programming'],['CS311','Introduction to Web Services Development'],
      ['CS312','Database Modeling and Design'],['CS315','Network Security'],['CS401','Computer Architecture and Assembly Language Programming'],
      ['CS402','Theory of Automata'],['CS403','Database Management Systems'],['CS405','Database Programming using Oracle 11g'],
      ['CS407','Routing and Switching'],['CS408','Human Computer Interaction'],['CS410','Visual Programming'],['CS411','Visual Programming'],
      ['CS432','Network Modeling and Simulation'],['CS435','Cloud Computing'],['CS501','Advance Computer Architecture'],
      ['CS502','Fundamentals of Algorithms'],['CS504','Software Engineering - I'],['CS506','Web Design and Development'],
      ['CS507','Information Systems'],['CS508','Modern Programming Languages'],['CS601','Data Communication'],
      ['CS602','Computer Graphics'],['CS603','Software Architecture and Design'],['CS604','Operating Systems'],
      ['CS605','Software EngineeringII'],['CS606','Compiler Construction'],['CS607','Artificial Intelligence'],
      ['CS609','System Programming'],['CS610','Computer Networks'],['CS611','Software Quality Engineering'],
      ['CS614','Data Warehousing'],['CS615','Software Project Management'],['CS701','Theory of Computation'],
      ['CS702','Advanced Algorithms Analysis and Design'],['CS703','Advanced Operating Systems'],['CS704','Advanced Computer Architecture-II'],
      ['CS706','Software Quality Assurance'],['CS707','Network Security'],['CS708','Software Requirement Engineering'],
      ['CS709','Formal Methods for Software Engineering'],['CS710','Mobile and Pervasive Computing'],['CS711','Software Design'],
      ['CS712','Distributed DBMS'],['CS713','Object Oriented DBMS'],['CS716','Advanced Computer Networks'],
      ['CS718','Wireless Networks'],['CS721','Network Performance Evaluation'],['CS723','Probability and Stochastic Processes'],
      ['CS724','Software Process Improvement'],['CS725','Data Mining'],['CS726','Information Retrieval Techniques'],['IT430','E-Commerce']
    ],
    'Mathematics':[
      ['MTH001','Elementary Mathematics'],['MTH100','General Mathematics'],['MTH101','Calculus And Analytical Geometry'],
      ['MTH102','Basic Algebra and Trigonometry'],['MTH201','Multivariable Calculus'],['MTH202','Discrete Mathematics'],
      ['MTH301','Calculus II'],['MTH302','Business Mathematics & Statistics'],['MTH303','Mathematical Methods'],
      ['MTH401','Differential Equations'],['MTH501','Linear Algebra'],['MTH601','Operations Research'],
      ['MTH603','Numerical Analysis'],['MTH621','Real Analysis I'],['MTH622','Vectors and Classical Mechanics'],
      ['MTH631','Real Analysis II'],['MTH632','Complex Analysis and Differential Geometry'],['MTH633','Group Theory'],
      ['MTH634','Topology'],['MTH641','Functional Analysis'],['MTH701','Advanced Differential Equations'],
      ['MTH706','Advanced Linear Algebra'],['MTH7123','Advanced Fluid Dynamics'],['MTH718','Topics in Numerical Methods'],
      ['MTH721','Commutative Algebra'],['STA100','General Mathematics and Biostatistics']
    ],
    'Humanities Distribution / Education':[
      ['EDU101','Foundations of Education'],['EDU201','Learning Theories'],['EDU301','General Methods of Teaching'],
      ['EDU303','Child Development'],['EDU304','Introduction to Guidance and Counseling'],['EDU305','Classroom Management'],
      ['EDU401','Contemporary Issues and Trends in Education'],['EDU402','Curriculum Development'],['EDU403','Art, Crafts and Calligraphy'],
      ['EDU404','Classroom Testing and Assessment'],['EDU405','Classroom Assessment'],['EDU406','Critical Thinking and reflective Practice'],
      ['EDU410','Teaching of Literacy Skills'],['EDU411','Teaching of Urdu'],['EDU430','ICT in Education'],
      ['EDU431','Test Development & Evaluation'],['EDU501','School, Community and Teacher'],['EDU505','Education Development in Pakistan'],
      ['EDU510','Teaching of Mathematics'],['EDU512','Teaching of Islamic Studies'],['EDU515','Teaching of Geography'],
      ['EDU516','Teaching of English'],['EDU601','Philosophy of Education'],['EDU602','Educational Leadership and Management'],
      ['EDU603','Educational Governance Policy and Practice'],['EDU604','Comparative Education'],
      ['EDU654','Addressing problems of learning through technology and pedagogy'],['EDU705','Writing for Research'],
      ['EDU712','Quantitative Research Methods in Education'],['ETH202','Ethics (for Non-Muslims)'],
      ['GSC101','General Science'],['GSC201','Teaching of General Science'],['ISL201','Islamic Studies'],
      ['PAK301','Pakistan Studies'],['PAK302','Pakistan Studies'],['URD101','Urdu']
    ],
    'English':[
      ['ENG001','Elementary English'],['ENG101','English Comprehension'],['ENG201','Business and Technical English Writing'],
      ['ENG301','Business Communication'],['ENG501','History of English Language'],['ENG502','Introduction to Linguistics'],
      ['ENG503','Introduction to English Language Teaching'],['ENG504','Second Language Acquisition'],['ENG505','Language Learning Theories'],
      ['ENG506','World Englishes'],['ENG507','Phonetics and Phonology'],['ENG508','Semantics and Pragmatics'],
      ['ENG509','Morphology and Syntax'],['ENG510','Sociolinguistics'],['ENG511','Psycholinguistics'],
      ['ENG512','Bilingualism'],['ENG513','Language Teaching Methods'],['ENG515','Teaching of Reading and Writing Skills'],
      ['ENG516','Teaching Business Communication'],['ENG518','Research Methodology in ELT'],['ENG519','Curriculum Design']
    ],
    'Economics':[
      ['ECO401','Economics'],['ECO402','Microeconomics'],['ECO403','Macroeconomics'],['ECO404','Managerial Economics'],
      ['ECO501','Development Economics'],['ECO601','Business Econometrics'],['ECO603','International Economics'],
      ['ECO605','Financial Economics'],['ECO606','Mathematical Economics I'],['ECO615','Poverty and Income Distribution']
    ],
    'Probability & Statistics':[
      ['STA301','Statistics and Probability'],['STA621','Time Series Analysis'],['STA630','Research Methods'],
      ['STA631','Inferential Statistics'],['STA632','Sampling Techniques'],['STA642','Probability Distributions'],
      ['STA643','Experimental Designs'],['STA644','Non-Parametric Statistics'],['STA730','Advance Research Methods']
    ],
    'Psychology':[
      ['PSY101','Introduction to Psychology'],['PSY401','Clinical Psychology'],['PSY403','Social Psychology'],
      ['PSY404','Abnormal Psychology'],['PSY405','Personality Psychology'],['PSY406','Educational Psychology'],
      ['PSY407','Sport Psychology'],['PSY408','Health Psychology'],['PSY409','Positive Psychology'],
      ['PSY502','History & Systems of Psychology'],['PSY504','Cognitive Psychology'],['PSY510','Organizational Psychology'],
      ['PSY511','Environmental Psychology'],['PSY512','Gender Issues in Psychology'],['PSY513','Forensic Psychology'],
      ['PSY514','Consumer Psychology'],['PSY610','Neurological Bases of Behavior'],['PSY631','Psychological Testing & Measurements'],
      ['PSY632','Theory & Practice of Counseling']
    ],
    'Sociology':[
      ['SOC101','Introduction to Sociology'],['SOC301','Introduction to Social Work'],['SOC302','Sociological Theories'],
      ['SOC401','Cultural Anthropology'],['SOC402','Sociological Perspectives'],['SOC403','Gender Studies'],
      ['SOC601','Social Policy and Governance'],['SOC603','Sociology of Development']
    ],
    'Accounting, Banking & Finance':[
      ['ACC311','Fundamentals of Auditing'],['ACC501','Business Finance'],['BNK601','Banking Laws & Practices'],
      ['BNK603','Consumer Banking'],['BNK610','Islamic Banking Practices'],['BNK611','Economic Ideology in Islam'],
      ['BNK612','Financial Jurisprudence in Islam'],['BNK613','Islamic Ethics in Business'],['FIN611','Advanced Financial Accounting'],
      ['FIN621','Financial Statement Analysis'],['FIN622','Corporate Finance'],['FIN623','Taxation Management'],
      ['FIN625','Credit & Risk Management'],['FIN630','Investment Analysis & Portfolio Management'],['FIN701','Financial Management in Education'],
      ['MGT101','Financial Accounting'],['MGT201','Financial Management'],['MGT401','Financial Accounting II'],
      ['MGT402','Cost & Management Accounting'],['MGT404','Managerial Accounting'],['MGT411','Money & Banking'],
      ['MGT604','Management of Financial Institutions'],['MGT705','Advanced Cost and Management Accounting']
    ],
    'Marketing':[
      ['MGT301','Principles of Marketing'],['MKT501','Marketing Management'],['MKT529','Export Marketing'],
      ['MKT530','Consumer Behaviour'],['MKT603','Strategic Marketing Management'],['MKT610','Customer Relationship Management'],
      ['MKT611','Marketing Research'],['MKT621','Advertising & Promotion'],['MKT624','Brand Management'],
      ['MKT625','Services Marketing'],['MKT626','Retail Management'],['MKT627','Sales Management'],['MKT630','International Marketing']
    ],
    'Management':[
      ['HRM613','Performance Management'],['HRM617','Training and Development'],['HRM624','Conflict Management'],
      ['HRM626','Recruitment and selection'],['HRM627','Human Resource Development'],['HRM713','Performance Management'],
      ['MGMT611','Human Relations'],['MGMT614','Supply Chain Management'],['MGMT615','Transportation & Logistics Management'],
      ['MGMT617','Production Planning and Inventory Control'],['MGMT622','Management Skills'],['MGMT623','Leadership & Team Management'],
      ['MGMT625','Change Management'],['MGMT627','Project Management'],['MGMT628','Organizational Development'],
      ['MGMT629','Crisis Management'],['MGMT630','Knowledge Management'],['MGMT631','Enterprise Resource Planning'],
      ['MGMT715','Advanced Transportation & Logistics Management'],['MGMT727','Project Management'],
      ['MGMT731','Theory & Practice of Enterprise Resource Planning'],['MGT111','Introduction to Public Administration'],
      ['MGT211','Introduction To Business'],['MGT501','Human Resource Management'],['MGT502','Organizational Behaviour'],
      ['MGT503','Principles of Management'],['MGT504','Organization Theory & Design'],['MGT510','Total Quality Management'],
      ['MGT513','Public Administration in Pakistan'],['MGT520','International Business'],['MGT522','Introduction to Public Policy'],
      ['MGT601','SME Management'],['MGT602','Entrepreneurship'],['MGT603','Strategic Management'],
      ['MGT610','Business Ethics'],['MGT613','Production / Operations Management'],['MGT621','Administrative Law and Accountability'],
      ['MGT703','Strategic Management'],['PAD603','Governance, Democracy and Society']
    ],
    'Mass Communication':[
      ['MCD401','Camera basics, principles and practices'],['MCD402','Lighting for TV Production'],['MCD403','Music Production'],
      ['MCD404','Audio-Visual Editing'],['MCD501','TV Direction'],['MCD502','Script Writing'],
      ['MCD503','TV News and Current Affairs'],['MCD504','Acting and Performance'],['MCM101','Introduction to Mass Communication'],
      ['MCM301','Communication skills'],['MCM304','Mass Media in Pakistan'],['MCM310','Journalistic Writing'],
      ['MCM311','Reporting and Sub-Editing'],['MCM401','Fundamentals of Public Relations'],['MCM404','Globalization of Media'],
      ['MCM411','Introduction to Broadcasting'],['MCM501','Advertising for Print and Electronic Media'],['MCM511','Theories of Communication'],
      ['MCM514','Feature & Column Writing'],['MCM515','Radio News Reporting & Production'],['MCM516','TV News Reporting & Production'],
      ['MCM604','International Communication'],['MCM610','Mass Communication Law & Ethics'],['PSC201','International Relations']
    ],
    'Physics':[['PHY101','Physics'],['PHY301','Circuit Theory']],
    'Biological Sciences':[
      ['BIF401','Bioinformatics I'],['BIF402','Ethical and Legal Issues in Bioinformatics'],['BIF501','Bioinformatics II'],
      ['BIF601','Bioinformatics Computing I'],['BIF602','Bioinformatics Computing II'],['BIF731','Advanced Bioinformatics'],
      ['BIF732','Advanced Computing Approaches'],['BIF733','Bioinformatics I (Essentials of Genome Informatics)'],
      ['BIO201','Cell Biology'],['BIO202','Biochemistry-I'],['BIO203','Methods in Molecular Biology'],
      ['BIO204','Principles of Biochemical Engineering'],['BIO301','Essentials of Genetics'],['BIO302','Molecular Biology'],
      ['BIO303','Biochemistry II'],['BIO401','Biostatistics'],['BIO502','Genomics'],['BIO731','Advanced Molecular Biology'],
      ['BIO732','Gene Manipulation and Genetic Engineering'],['BIO733','Applied Biostatistics'],['BIO734','Advances in Cell Biology']
    ]
  };
  Object.entries(groups).forEach(([category,rows])=>rows.forEach(([code,title])=>{
    if(!VC.courses.some(x=>String(x.code).toUpperCase()===code)){
      VC.courses.push({
        code,title,category,level:'Undergraduate',
        officialDetails:'https://ocw.vu.edu.pk/Courses.aspx?q='+encodeURIComponent(code),
        freshness:'Indexed from the official Virtual University OpenCourseWare course directory. Check VULMS for current-semester announcements, quizzes and assignments.'
      });
    }
  }));
  VC.verifiedAt='2026-10-01';
}

// ---------- VU RESOURCE TYPES ----------
const U=window.EDUNIZAM_UNIVERSITY_DATA;
if(U){
  addUnique(U.resources,[
    {id:'vu-ocw-course-overview',universityId:'vu',category:'Course Overview',source:'official',courseAgnostic:true,title:'VU OCW Course Overview Directory',url:'https://ocw.vu.edu.pk/Courses.aspx',note:'Open a course in official VU OpenCourseWare to access its overview, syllabus/course contents and learning information.'},
    {id:'vu-ocw-videos',universityId:'vu',category:'Lecture Videos',source:'official',courseAgnostic:true,title:'VU OCW Lecture Videos',url:'https://ocw.vu.edu.pk/Courses.aspx',note:'Official VU OpenCourseWare courses provide lecture-video links where published.'},
    {id:'vu-ocw-reference-books',universityId:'vu',category:'Reference Books',source:'official',courseAgnostic:true,title:'VU OCW Reference Books',url:'https://ocw.vu.edu.pk/Courses.aspx',note:'Open the required VU course and choose Reference Books where the course publishes them.'},
    {id:'vu-ocw-grading',universityId:'vu',category:'Grading Scheme',source:'official',courseAgnostic:true,title:'VU OCW Grading Scheme',url:'https://ocw.vu.edu.pk/Courses.aspx',note:'Official course pages may publish grading-scheme information; current semester rules should be confirmed in VULMS.'},
    {id:'vu-ocw-assignments',universityId:'vu',category:'Assignments',source:'official',courseAgnostic:true,title:'VU OCW Course Assignments',url:'https://ocw.vu.edu.pk/Courses.aspx',note:'Official OCW course pages may expose archived course assignments. Current graded assignments remain in VULMS.'}
  ]);
  addUnique(U.resources,[
    {id:'hec-recognised-universities',universityId:'hec-directory',category:'Recognized Universities',source:'official',title:'HEC Recognized Universities Directory',url:'https://www.hec.gov.pk/english/universities/pages/recognised.aspx',note:'Official HEC directory for recognized Pakistani universities and degree-awarding institutions.'},
    {id:'hec-pqr',universityId:'hec-directory',category:'Recognized Programs / Qualifications',source:'official',title:'HEC Pakistan Qualification Register (PQR)',url:'https://www.hec.gov.pk/english/services/universities/pqr/Pages/default.aspx',note:'Official HEC register for quality-assured recognized higher qualifications and providers.'}
  ]);
  U.updatedAt='2026-10-01';
}

// ---------- STUDY LIBRARY OFFICIAL HUBS ----------
const SD=window.EDUNIZAM_STUDY_DATA;
if(SD){
  addUnique(SD.materials,[
    {id:'pectaa-official-model-papers',board:'Punjab / PECTAA',classLevels:[8],subject:'English / Urdu / Mathematics / Science',type:'Model Papers',title:'PECTAA Grade 8 Official Model Papers',source:'official',url:'https://pectaa.edu.pk/model-papers/',note:'Official PECTAA model-paper hub for Grade 8 English, Urdu, Mathematics and Science.'},
    {id:'pectaa-official-ebooks',board:'Punjab / PECTAA',classLevels:[5,8,9,10,11,12],subject:'All Subjects',type:'E-Books / Curriculum',title:'PECTAA Official Curriculum & E-Books',source:'official',url:'https://pectaa.edu.pk/curriculum-compliance/',note:'Official Punjab curriculum and e-book hub, including school subjects and current curriculum/compliance resources.'}
  ]);
}

// ---------- PRACTICE: GRADE 5 & 8 + BETTER SECONDARY COVERAGE ----------
const PD=window.EDUNIZAM_PRACTICE_DATA;
if(PD){
  PD.subjects=PD.subjects||{};
  PD.subjects['5']=['Mathematics','English','Urdu','General Science','Islamiat / Ethics'];
  PD.subjects['8']=['Mathematics','English','Urdu','General Science','Islamiat / Ethics'];
  PD.chapters=PD.chapters||{};
  Object.assign(PD.chapters,{
    '5|Mathematics':['Whole Numbers','Fractions and Decimals','Geometry','Measurement'],
    '5|English':['Grammar','Vocabulary','Reading Skills'],
    '5|Urdu':['قواعد','الفاظ و معانی','فہم'],
    '5|General Science':['Living Things','Matter','Energy','Earth and Environment'],
    '5|Islamiat / Ethics':['Basic Teachings','Good Character'],
    '8|Mathematics':['Rational Numbers','Algebra','Geometry','Data Handling'],
    '8|English':['Grammar','Vocabulary','Reading Skills'],
    '8|Urdu':['قواعد','الفاظ و معانی','فہم'],
    '8|General Science':['Cells and Life','Matter and Chemistry','Force and Energy','Earth and Space'],
    '8|Islamiat / Ethics':['Basic Teachings','Good Character']
  });
  const q=[
    {id:'g5-math-01',classLevel:5,subject:'Mathematics',chapter:'Whole Numbers',type:'mcq',difficulty:'Easy',question:'What is the place value of 7 in 47,215?',options:['7','70','700','7,000'],answer:3,explanation:'The digit 7 is in the thousands place.'},
    {id:'g5-math-02',classLevel:5,subject:'Mathematics',chapter:'Fractions and Decimals',type:'mcq',difficulty:'Easy',question:'Which fraction is equal to one half?',options:['2/3','3/6','4/5','5/6'],answer:1,explanation:'3/6 simplifies to 1/2.'},
    {id:'g5-math-03',classLevel:5,subject:'Mathematics',chapter:'Geometry',type:'mcq',difficulty:'Easy',question:'How many right angles does a rectangle have?',options:['1','2','3','4'],answer:3,explanation:'A rectangle has four right angles.'},
    {id:'g5-math-04',classLevel:5,subject:'Mathematics',chapter:'Measurement',type:'short',difficulty:'Medium',question:'Convert 3 metres into centimetres.',answerText:'3 m = 300 cm.'},
    {id:'g5-eng-01',classLevel:5,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Easy',question:'Choose the correct plural of “child”.',options:['childs','children','childes','childrens'],answer:1,explanation:'The irregular plural of child is children.'},
    {id:'g5-eng-02',classLevel:5,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Easy',question:'Which word is a verb in the sentence “Birds fly high”?',options:['Birds','fly','high','the'],answer:1,explanation:'“Fly” shows the action.'},
    {id:'g5-eng-03',classLevel:5,subject:'English',chapter:'Vocabulary',type:'mcq',difficulty:'Easy',question:'Choose the opposite of “ancient”.',options:['old','modern','historic','past'],answer:1,explanation:'Modern is an antonym of ancient.'},
    {id:'g5-urdu-01',classLevel:5,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'لفظ “لڑکے” کس کی جمع ہے؟',options:['لڑکا','لڑکی','بچہ','بچی'],answer:0,explanation:'“لڑکے” لفظ “لڑکا” کی جمع ہے۔'},
    {id:'g5-urdu-02',classLevel:5,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'کام کے ہونے یا کرنے کو ظاہر کرنے والا لفظ کیا کہلاتا ہے؟',options:['اسم','فعل','صفت','حرف'],answer:1,explanation:'کام کے ہونے یا کرنے کو ظاہر کرنے والا لفظ فعل کہلاتا ہے۔'},
    {id:'g5-urdu-03',classLevel:5,subject:'Urdu',chapter:'الفاظ و معانی',type:'short',difficulty:'Easy',question:'لفظ “خوش” کا ایک متضاد لکھیں۔',answerText:'اداس۔'},
    {id:'g5-sci-01',classLevel:5,subject:'General Science',chapter:'Living Things',type:'mcq',difficulty:'Easy',question:'Which part of a plant mainly absorbs water from the soil?',options:['Flower','Root','Fruit','Seed'],answer:1,explanation:'Roots absorb water and minerals from the soil.'},
    {id:'g5-sci-02',classLevel:5,subject:'General Science',chapter:'Matter',type:'mcq',difficulty:'Easy',question:'Water changing into water vapour is called:',options:['Freezing','Melting','Evaporation','Condensation'],answer:2,explanation:'Evaporation changes liquid water into vapour.'},
    {id:'g5-sci-03',classLevel:5,subject:'General Science',chapter:'Energy',type:'mcq',difficulty:'Easy',question:'Which source gives Earth most of its light and heat?',options:['Moon','Sun','Stars other than the Sun','Soil'],answer:1,explanation:'The Sun is Earth’s main source of light and heat.'},
    {id:'g5-isl-01',classLevel:5,subject:'Islamiat / Ethics',chapter:'Good Character',type:'mcq',difficulty:'Easy',question:'Which behaviour shows honesty?',options:['Telling the truth','Breaking a promise','Taking another person’s property','Hiding a mistake by lying'],answer:0,explanation:'Honesty includes telling the truth and acting fairly.'},
    {id:'g5-isl-02',classLevel:5,subject:'Islamiat / Ethics',chapter:'Good Character',type:'mcq',difficulty:'Easy',question:'Helping a person in need is an example of:',options:['Kindness','Wastefulness','Pride','Carelessness'],answer:0,explanation:'Helping others is an act of kindness.'},

    {id:'g8-math-01',classLevel:8,subject:'Mathematics',chapter:'Rational Numbers',type:'mcq',difficulty:'Easy',question:'Which of the following is a rational number?',options:['√2','π','3/5','√3'],answer:2,explanation:'3/5 is a ratio of two integers.'},
    {id:'g8-math-02',classLevel:8,subject:'Mathematics',chapter:'Algebra',type:'mcq',difficulty:'Medium',question:'Solve: 2x + 6 = 16.',options:['4','5','6','7'],answer:1,explanation:'2x = 10, so x = 5.'},
    {id:'g8-math-03',classLevel:8,subject:'Mathematics',chapter:'Geometry',type:'mcq',difficulty:'Easy',question:'The sum of interior angles of a triangle is:',options:['90°','180°','270°','360°'],answer:1,explanation:'The interior angles of every triangle sum to 180°.'},
    {id:'g8-math-04',classLevel:8,subject:'Mathematics',chapter:'Data Handling',type:'short',difficulty:'Medium',question:'Find the mean of 4, 6, 8 and 10.',answerText:'Mean = (4 + 6 + 8 + 10) / 4 = 7.'},
    {id:'g8-eng-01',classLevel:8,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Easy',question:'Choose the correct sentence.',options:['She go to school daily.','She goes to school daily.','She going to school daily.','She gone to school daily.'],answer:1,explanation:'A singular third-person subject takes “goes” in the simple present.'},
    {id:'g8-eng-02',classLevel:8,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Medium',question:'Choose the passive form of “The teacher checked the work.”',options:['The work was checked by the teacher.','The work checked the teacher.','The teacher was checked by the work.','The work is checking by the teacher.'],answer:0,explanation:'Past simple passive uses was/were + past participle.'},
    {id:'g8-eng-03',classLevel:8,subject:'English',chapter:'Vocabulary',type:'mcq',difficulty:'Easy',question:'Choose the synonym of “rapid”.',options:['slow','quick','weak','silent'],answer:1,explanation:'Rapid means quick or fast.'},
    {id:'g8-urdu-01',classLevel:8,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Easy',question:'اسم کی خوبی یا حالت بیان کرنے والا لفظ کیا کہلاتا ہے؟',options:['صفت','فعل','حرف','مصدر'],answer:0,explanation:'اسم کی خوبی یا حالت بیان کرنے والا لفظ صفت کہلاتا ہے۔'},
    {id:'g8-urdu-02',classLevel:8,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Medium',question:'“وہ کتاب پڑھ رہا ہے” میں فعل کون سا ہے؟',options:['وہ','کتاب','پڑھ رہا ہے','ہے'],answer:2,explanation:'“پڑھ رہا ہے” عمل کو ظاہر کرتا ہے۔'},
    {id:'g8-urdu-03',classLevel:8,subject:'Urdu',chapter:'الفاظ و معانی',type:'short',difficulty:'Easy',question:'لفظ “آغاز” کا متضاد لکھیں۔',answerText:'اختتام۔'},
    {id:'g8-sci-01',classLevel:8,subject:'General Science',chapter:'Cells and Life',type:'mcq',difficulty:'Easy',question:'The basic unit of life is the:',options:['Organ','Cell','Tissue','System'],answer:1,explanation:'The cell is the basic structural and functional unit of life.'},
    {id:'g8-sci-02',classLevel:8,subject:'General Science',chapter:'Matter and Chemistry',type:'mcq',difficulty:'Medium',question:'Which change usually forms a new substance?',options:['Melting ice','Cutting paper','Rusting iron','Boiling water'],answer:2,explanation:'Rusting is a chemical change that forms new substances.'},
    {id:'g8-sci-03',classLevel:8,subject:'General Science',chapter:'Force and Energy',type:'mcq',difficulty:'Easy',question:'The SI unit of force is:',options:['Joule','Newton','Watt','Metre'],answer:1,explanation:'Force is measured in newtons.'},
    {id:'g8-sci-04',classLevel:8,subject:'General Science',chapter:'Earth and Space',type:'mcq',difficulty:'Easy',question:'Earth completes one revolution around the Sun in about:',options:['24 hours','7 days','30 days','365 days'],answer:3,explanation:'One revolution of Earth around the Sun takes about one year.'},
    {id:'g8-isl-01',classLevel:8,subject:'Islamiat / Ethics',chapter:'Good Character',type:'mcq',difficulty:'Easy',question:'Keeping a promise is most closely related to:',options:['Trustworthiness','Jealousy','Wastefulness','Neglect'],answer:0,explanation:'Keeping promises is part of trustworthiness and good character.'},
    {id:'g8-isl-02',classLevel:8,subject:'Islamiat / Ethics',chapter:'Good Character',type:'mcq',difficulty:'Easy',question:'Treating people fairly is an example of:',options:['Justice','Pride','Dishonesty','Carelessness'],answer:0,explanation:'Justice means fair treatment.'},

    {id:'s9-eng-02',classLevel:9,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Medium',question:'Choose the correct present perfect sentence.',options:['She has finished her work.','She have finished her work.','She finished has her work.','She is finish her work.'],answer:0,explanation:'Present perfect uses has/have + past participle.'},
    {id:'s9-urdu-02',classLevel:9,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Medium',question:'“خوبصورت پھول” میں صفت کون سا لفظ ہے؟',options:['خوبصورت','پھول','میں','کوئی نہیں'],answer:0,explanation:'“خوبصورت” اسم “پھول” کی کیفیت بیان کرتا ہے۔'},
    {id:'s10-eng-02',classLevel:10,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Medium',question:'Choose the correct indirect speech: Ali said, “I am tired.”',options:['Ali said that he was tired.','Ali said that I am tired.','Ali says he tired.','Ali said he is tired yesterday.'],answer:0,explanation:'Backshift changes “am” to “was” in reported speech in this context.'},
    {id:'s10-urdu-02',classLevel:10,subject:'Urdu',chapter:'قواعد',type:'mcq',difficulty:'Medium',question:'جو لفظ اسم کی جگہ استعمال ہو اسے کیا کہتے ہیں؟',options:['ضمیر','فعل','صفت','حرف'],answer:0,explanation:'اسم کی جگہ استعمال ہونے والا لفظ ضمیر کہلاتا ہے۔'},
    {id:'s11-eng-02',classLevel:11,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Medium',question:'Choose the correctly punctuated sentence.',options:['However, we continued the journey.','However we, continued the journey.','However we continued, the journey.','However; we, continued the journey.'],answer:0,explanation:'A comma normally follows the introductory conjunctive adverb “However”.'},
    {id:'s11-stats-02',classLevel:11,subject:'Statistics',chapter:'Descriptive Statistics',type:'mcq',difficulty:'Medium',question:'The median of 2, 5, 7, 9, 12 is:',options:['5','7','9','12'],answer:1,explanation:'The middle ordered value is 7.'},
    {id:'s12-eng-02',classLevel:12,subject:'English',chapter:'Grammar',type:'mcq',difficulty:'Medium',question:'Choose the sentence with correct parallel structure.',options:['She likes reading, writing, and swimming.','She likes reading, to write, and swimming.','She likes to read, writing, and to swim.','She likes read, writing, and swimming.'],answer:0,explanation:'All three items use the same -ing form.'},
    {id:'s12-stats-02',classLevel:12,subject:'Statistics',chapter:'Probability',type:'mcq',difficulty:'Medium',question:'If P(A)=0.3, then P(A complement) is:',options:['0.3','0.5','0.7','1.3'],answer:2,explanation:'P(Aᶜ)=1−P(A)=0.7.'}
  ];
  addUnique(PD.questions,q);
}

window.EDUNIZAM_LEARNING_REQUIRED_DATA={
  updatedAt:'2026-10-01',
  note:'Public learning data expansion for boards, PECTAA, universities, VU course discovery and built-in practice.'
};
})();