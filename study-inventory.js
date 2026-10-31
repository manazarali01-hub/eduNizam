(function(){
  const D=window.EDUNIZAM_STUDY_DATA;if(!D)return;
  const add=x=>{if(!D.materials.some(m=>m.id===x.id))D.materials.push(x)};

  // Official Punjab pairing schemes / smart syllabus bundles.
  add({
    id:"pectaa-grade9-pairing-2026",board:"Punjab Boards / PECTAA",authorityId:"punjab-pectaa",curriculumSession:"2026-27",classLevels:[9],
    subject:"All Subjects",type:"Pairing Scheme",title:"Punjab Grade-9 Pairing Schemes + Smart Syllabus + Model Papers 2026",
    source:"official",curriculumStatus:"current",
    url:"https://pectaa.edu.pk/uploads/Revised%20ALP%20Notification%2007.11.2025.pdf",
    fileUrl:"https://pectaa.edu.pk/uploads/Revised%20ALP%20Notification%2007.11.2025.pdf",
    note:"Official PECTAA notification for implementation across Punjab boards for Annual Examination 2026."
  });
  add({
    id:"pectaa-grade11-pairing-2026",board:"Punjab Boards / PECTAA",authorityId:"punjab-pectaa",curriculumSession:"2026-27",classLevels:[11],
    subject:"All Subjects",type:"Pairing Scheme",title:"Punjab Grade-11 Pairing Schemes + Smart Syllabus + Model Papers 2026",
    source:"official",curriculumStatus:"current",url:"https://pectaa.edu.pk/curriculum-compliance/",
    note:"Official PECTAA curriculum portal lists Grade-11 smart syllabus, pairing schemes and model papers for Annual Examination 2026."
  });
  add({
    id:"pectaa-tech9-pairing-2026",board:"Punjab Boards / PECTAA",authorityId:"punjab-pectaa",curriculumSession:"2026-27",classLevels:[9],
    subject:"Agriculture / Health Sciences / Fashion Designing / ICT",type:"Pairing Scheme",
    title:"Grade-9 Technical Subjects Pairing Scheme & Practical Model Papers 2026",
    source:"official",curriculumStatus:"current",
    url:"https://pectaa.edu.pk/wp-content/uploads/2026/01/Pairing-Scheme-List-of-Practicals-and-Model-Papers-of-Agriculture-Sciences-Health-Sciences-Fashion-Designing-ICT-Grade-9-2.pdf",
    fileUrl:"https://pectaa.edu.pk/wp-content/uploads/2026/01/Pairing-Scheme-List-of-Practicals-and-Model-Papers-of-Agriculture-Sciences-Health-Sciences-Fashion-Designing-ICT-Grade-9-2.pdf",
    note:"Official PECTAA pairing scheme, practical list and model-paper package."
  });
  add({
    id:"fsd-grade9-pairing-2026",board:"BISE Faisalabad",authorityId:"punjab-pectaa",curriculumSession:"2026-27",classLevels:[9],
    subject:"All Subjects",type:"Pairing Scheme",title:"BISE Faisalabad Grade-9 Revised Pairing Schemes & Model Papers 2026",
    source:"official",curriculumStatus:"current",url:"https://web.bisefsd.edu.pk/NewsEvents.aspx",
    note:"Official BISE Faisalabad notification page. Use the Grade-IX revised smart syllabus/pairing-schemes download."
  });

  // Official textbook portals and direct authorized PDFs.
  [9,10,11,12].forEach(cls=>add({
    id:"pectaa-books-"+cls,board:"Punjab / PECTAA",authorityId:"punjab-pectaa",curriculumSession:"2026-27",classLevels:[cls],
    subject:"All Subjects",type:"Textbook",title:"Punjab Class "+cls+" Official E-Books",
    source:"official",curriculumStatus:"current",url:"https://pectaa.edu.pk/curriculum-compliance/",
    note:"Official PECTAA e-book catalog. Includes compulsory/elective books and current editions where published."
  }));
  add({
    id:"nbf-computer-9",board:"Federal / NBF",authorityId:"federal-fbise",curriculumSession:"Current FBISE/NBF",classLevels:[9],subject:"Computer Science",type:"Textbook",
    title:"NBF Computer Science Grade 9 Textbook",source:"official",curriculumStatus:"current",
    url:"https://www.nbf.org.pk/sites/default/files/Computer%20Grade%209-1.pdf",
    fileUrl:"https://www.nbf.org.pk/sites/default/files/Computer%20Grade%209-1.pdf",
    note:"Official National Book Foundation / Federal Textbook Board PDF."
  });
  add({
    id:"nbf-general-science-9",board:"Federal / NBF",authorityId:"federal-fbise",curriculumSession:"Current FBISE/NBF",classLevels:[9],subject:"General Science",type:"Textbook",
    title:"NBF General Science Grade 9 Textbook",source:"official",curriculumStatus:"current",
    url:"https://www.nbf.org.pk/sites/default/files/General%20Science%209.pdf",
    fileUrl:"https://www.nbf.org.pk/sites/default/files/General%20Science%209.pdf",
    note:"Official National Book Foundation / Federal Textbook Board PDF."
  });
  add({
    id:"nbf-textbook-chapters",board:"Federal / NBF",authorityId:"federal-fbise",curriculumSession:"Current FBISE/NBF",classLevels:[9,10,11,12],
    subject:"All Subjects",type:"Textbook",title:"NBF Official Textbook Chapters & Class 12 Books",
    source:"official",curriculumStatus:"current",url:"https://www.nbf.org.pk/chapters-of-text-books",
    note:"Official NBF page containing textbook chapters and class-level book resources."
  });

  // Provincial official textbook / curriculum portals verified in September 2026.
  add({
    id:"stbb-official-ebooks",board:"Sindh Textbook Board (STBB)",authorityId:"sindh-stbb",curriculumSession:"2026-27 / current portal",classLevels:[9,10,11,12],
    subject:"All Subjects",type:"Textbook",title:"Sindh Textbook Board Official E-Books — Classes IX to XII",
    source:"official",curriculumStatus:"current",url:"https://ebooks.stbb.edu.pk/",
    note:"Official STBB digital library with class-wise Sindhi, Urdu and English-medium textbooks."
  });
  add({
    id:"kptbb-official-textbooks",board:"Khyber Pakhtunkhwa / KPTBB",authorityId:"kp-dcte-kptbb",curriculumSession:"Current approved provincial curriculum",classLevels:[9,10,11,12],
    subject:"All Subjects",type:"Official Portal",title:"Khyber Pakhtunkhwa Textbook Board Official Textbook Portal",
    source:"official",curriculumStatus:"current",url:"https://tbb.kp.gov.pk/",
    note:"Official KPTBB source for provincial textbook information and approved school resources."
  });
  add({
    id:"btbb-official-ebooks",board:"Balochistan Textbook Board (BTBB)",authorityId:"balochistan-btbb",curriculumSession:"2026 onward",classLevels:[9,10,11,12],
    subject:"All Subjects",type:"Textbook",title:"Balochistan Textbook Board Official Catalogue & E-Books",
    source:"official",curriculumStatus:"current",url:"https://btbb.com.pk/books.php?view=publisher",
    note:"Official BTBB catalogue with grade/subject filters and e-book links where available."
  });

  // EduNizam concise revision notes (original summaries; not copied textbooks).
  const notes=[
    ["note-9-math-real",9,"Mathematics","Real Numbers","Real numbers include rational and irrational numbers. Rational numbers can be written p/q where q ≠ 0. Irrational numbers cannot be expressed as a ratio of integers. Key skills: number-line representation, surds, laws of exponents, interval notation, and simplifying radicals."],
    ["note-9-math-log",9,"Mathematics","Logarithms","A logarithm answers: to what power must a base be raised? If a^x=b then log_a(b)=x. Laws: log(ab)=log a+log b; log(a/b)=log a−log b; log(a^n)=n log a. Common log has base 10."],
    ["note-9-physics-kin",9,"Physics","Kinematics","Distance is total path; displacement is change in position. Speed=distance/time; velocity=displacement/time; acceleration=(final velocity−initial velocity)/time. For uniform acceleration use standard equations of motion and always write SI units."],
    ["note-9-chem-atom",9,"Chemistry","Atomic Structure","Atoms contain protons, neutrons and electrons. Atomic number equals protons; mass number equals protons+neutrons. Isotopes have the same atomic number but different mass numbers. Electron arrangement explains chemical behavior."],
    ["note-9-bio-cell",9,"Biology","Cells and Tissues","The cell is the basic structural and functional unit of life. Prokaryotic cells lack a membrane-bound nucleus; eukaryotic cells possess one. Tissues are groups of similar cells performing a common function."],
    ["note-10-math-quadratic",10,"Mathematics","Quadratic Equations","A quadratic equation has form ax²+bx+c=0, a≠0. Solve by factorization, completing the square or quadratic formula. Discriminant D=b²−4ac: D>0 gives two real roots, D=0 equal roots, D<0 non-real roots."],
    ["note-10-math-trig",10,"Mathematics","Trigonometry","For a right triangle: sinθ=opposite/hypotenuse, cosθ=adjacent/hypotenuse, tanθ=opposite/adjacent. Core identities: sin²θ+cos²θ=1, 1+tan²θ=sec²θ, 1+cot²θ=csc²θ."],
    ["note-10-physics-current",10,"Physics","Current Electricity","Current I=Q/t. Potential difference is energy transferred per unit charge. Ohm's law: V=IR at constant physical conditions. Electrical power P=VI and electrical energy E=Pt."],
    ["note-10-chem-acid",10,"Chemistry","Acids, Bases and Salts","Acids produce H+ ions in water; bases produce OH− ions or accept H+. pH below 7 is acidic, 7 neutral, above 7 basic. Neutralization: acid+base→salt+water."],
    ["note-10-bio-homeo",10,"Biology","Homeostasis","Homeostasis maintains stable internal conditions. Kidneys regulate water and salts and remove nitrogenous wastes. Skin assists temperature control through sweating and blood-flow changes."],
    ["note-11-math-series",11,"Mathematics","Sequences and Series","Arithmetic progression: a_n=a+(n−1)d and S_n=n/2[2a+(n−1)d]. Geometric progression: a_n=ar^(n−1). Identify the pattern before selecting a formula."],
    ["note-11-physics-vectors",11,"Physics","Vectors and Equilibrium","Scalars have magnitude only; vectors have magnitude and direction. Resolve vectors into components. For equilibrium, resultant force and resultant torque must both be zero."],
    ["note-11-chem-bond",11,"Chemistry","Chemical Bonding","Ionic bonding involves electron transfer; covalent bonding involves sharing. Bond polarity depends on electronegativity difference. Molecular shape is influenced by electron-pair repulsion."],
    ["note-12-math-diff",12,"Mathematics","Differentiation","Derivative measures instantaneous rate of change and slope of tangent. Power rule: d(x^n)/dx=nx^(n−1). Use product, quotient and chain rules for composite expressions."],
    ["note-12-math-int",12,"Mathematics","Integration","Integration is the reverse process of differentiation and can represent area. ∫x^n dx=x^(n+1)/(n+1)+C for n≠−1. Definite integrals evaluate accumulated change over an interval."],
    ["note-12-physics-em",12,"Physics","Electromagnetic Induction","Faraday's law states induced emf depends on rate of change of magnetic flux: ε=−N dΦ/dt. Lenz's law gives the negative sign: induced effects oppose the change causing them."]
  ];
  notes.forEach(([id,cls,subject,chapter,content])=>add({
    id,board:"EduNizam",authorityId:"pending",curriculumSession:"Unverified draft",classLevels:[cls],subject,type:"Notes",
    title:"Class "+cls+" "+subject+" — "+chapter+" Quick Notes",
    source:"built-in",curriculumStatus:"needs-verification",chapter,content,
    note:"EduNizam concise revision notes. Use with the prescribed textbook and current syllabus."
  }));
})();