(function(){
  const PP=window.EDUNIZAM_PAST_PAPERS;
  if(!PP)return;

  const add=(r)=>{if(!PP.papers.some(x=>x.id===r.id))PP.papers.push(r)};
  const official=(id,boardId,classLevel,year,session,title,url,note,type='past',subject='All Subjects',medium='English / Urdu')=>
    add({id,boardId,classLevel,subject,year,session,type,medium,source:'official',title,url,note,verifiedAt:'2026-09-18'});

  // FBISE — verified official archives by class/year/session.
  const fbisePages={
    9:'https://www.fbise.edu.pk/AllOldPapersSSC1.php',
    10:'https://www.fbise.edu.pk/AllOldPapersSSC2.php',
    11:'https://www.fbise.edu.pk/AllOldPapersHSSC1.php',
    12:'https://www.fbise.edu.pk/AllOldPapersHSSC2.php'
  };
  [
    [9,2026,'Annual'],[9,2025,'Annual'],[9,2025,'Supplementary'],[9,2024,'Annual'],[9,2023,'Annual'],
    [10,2026,'Annual'],[10,2025,'Annual'],[10,2025,'Supplementary'],[10,2024,'Annual'],[10,2023,'Annual'],
    [11,2026,'Annual'],[11,2025,'Annual'],[11,2025,'Supplementary'],[11,2024,'Annual'],[11,2023,'Annual'],
    [12,2026,'Annual'],[12,2025,'Supplementary'],[12,2024,'Annual'],[12,2023,'Annual']
  ].forEach(([cls,year,session])=>official(
    'fbise-'+cls+'-'+year+'-'+session.toLowerCase(),
    'fbise',cls,year,session,
    'FBISE Class '+cls+' '+year+' '+session+' Question Papers',
    fbisePages[cls],
    'Official FBISE old-question-paper archive for this class and examination cycle.'
  ));

  // FBISE — direct official PDFs; these enable View / Download / Print in EduNizam.
  [
    {
      id:'fbise-ssc1-2025-2nd-combined-pdf',boardId:'fbise',classLevel:9,subject:'All Subjects',year:2025,
      session:'Supplementary',type:'past',medium:'English / Urdu',source:'official',
      title:'FBISE SSC-I 2nd Annual 2025 Combined Question Papers',
      url:'https://www.fbise.edu.pk/Old%20Question%20Paper/2025/SSC-I_2A25.pdf',
      fileUrl:'https://www.fbise.edu.pk/Old%20Question%20Paper/2025/SSC-I_2A25.pdf',
      note:'Official combined PDF containing compulsory, science and other SSC-I papers.',verifiedAt:'2026-09-18'
    },
    {
      id:'fbise-ssc2-2024-combined-pdf',boardId:'fbise',classLevel:10,subject:'All Subjects',year:2024,
      session:'Annual',type:'past',medium:'English / Urdu',source:'official',
      title:'FBISE SSC-II 1st Annual 2024 Compulsory + Science + General',
      url:'https://www.fbise.edu.pk/Old%20Question%20Paper/2024/SSC_II_1ST_2024/SSC-II%20Compulsory%2BScience%2BGeneral.pdf',
      fileUrl:'https://www.fbise.edu.pk/Old%20Question%20Paper/2024/SSC_II_1ST_2024/SSC-II%20Compulsory%2BScience%2BGeneral.pdf',
      note:'Official FBISE combined SSC-II question-paper PDF.',verifiedAt:'2026-09-18'
    },
    {
      id:'fbise-ssc1-english-rubric-2024',boardId:'fbise',classLevel:9,subject:'English',year:2024,
      session:'Annual',type:'rubric',medium:'English',source:'official',
      title:'FBISE SSC-I English Rubrics 2024',
      url:'https://fbise.edu.pk/Old%20Question%20Paper/2024/SSC_I_1ST_2024/rubrics/ENGLISH-I.pdf',
      fileUrl:'https://fbise.edu.pk/Old%20Question%20Paper/2024/SSC_I_1ST_2024/rubrics/ENGLISH-I.pdf',
      note:'Official marking rubric for SSC-I English.',verifiedAt:'2026-09-18'
    },
    {
      id:'fbise-ssc1-english-model-2025',boardId:'fbise',classLevel:9,subject:'English',year:2025,
      session:'Annual',type:'model',medium:'English',source:'official',
      title:'FBISE SSC-I English Assessment Framework + Model Paper',
      url:'https://www.fbise.edu.pk/ModelPaper/2025/Assessment%20Frameworks/SSC-I/Final%20Assessment%20Framework%20%2B%20Model%20Question%20Paper%20English%20SSC-I.pdf',
      fileUrl:'https://www.fbise.edu.pk/ModelPaper/2025/Assessment%20Frameworks/SSC-I/Final%20Assessment%20Framework%20%2B%20Model%20Question%20Paper%20English%20SSC-I.pdf',
      note:'Official assessment framework and model question paper.',verifiedAt:'2026-09-18'
    },
    {
      id:'fbise-hssc1-english-model-2025',boardId:'fbise',classLevel:11,subject:'English',year:2025,
      session:'Annual',type:'model',medium:'English',source:'official',
      title:'FBISE HSSC-I English Assessment Framework + Model Paper',
      url:'https://fbise.edu.pk/ModelPaper/2025/Assessment%20Frameworks/HSSC-I/Final%20Assessment%20Framework%20%2B%20Model%20Question%20Paper%20English%20HSSC-I.pdf',
      fileUrl:'https://fbise.edu.pk/ModelPaper/2025/Assessment%20Frameworks/HSSC-I/Final%20Assessment%20Framework%20%2B%20Model%20Question%20Paper%20English%20HSSC-I.pdf',
      note:'Official assessment framework and model question paper.',verifiedAt:'2026-09-18'
    },
    {
      id:'fbise-ssc2-pakstudies-model-2024',boardId:'fbise',classLevel:10,subject:'Pakistan Studies',year:2024,
      session:'Annual',type:'model',medium:'English / Urdu',source:'official',
      title:'FBISE SSC-II Pakistan Studies Model Paper',
      url:'https://www.fbise.edu.pk/ModelPaper/2024New/pst/Final%20SSC-II%20Pakistan%20Studies%20Model%20Paper.pdf',
      fileUrl:'https://www.fbise.edu.pk/ModelPaper/2024New/pst/Final%20SSC-II%20Pakistan%20Studies%20Model%20Paper.pdf',
      note:'Official FBISE SSC-II model paper.',verifiedAt:'2026-09-18'
    }
  ].forEach(add);

  // BISE Multan — official class archives.
  const multanPages={
    9:'https://web.bisemultan.edu.pk/past-papers-9th/',
    10:'https://web.bisemultan.edu.pk/past-papers-10th/',
    11:'https://web.bisemultan.edu.pk/past-papers-part-i/',
    12:'https://web.bisemultan.edu.pk/past-papers-part-ii/'
  };
  const multanAnnual={
    9:[2026,2025,2024,2023,2022,2021,2019,2018,2017,2016],
    10:[2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016],
    11:[2026,2025,2024,2023,2022,2021,2019,2018,2017,2016,2015],
    12:[2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015]
  };
  const multanSupplementary={
    9:[2025,2024,2023,2022,2019,2018,2017],
    10:[2025,2024,2023,2022,2020,2019,2018,2017,2016],
    11:[2025,2024,2023,2022,2019,2018,2017],
    12:[2025,2024,2023,2022,2021,2020,2019,2018,2017,2016]
  };
  Object.entries(multanAnnual).forEach(([cls,years])=>years.forEach(year=>official(
    'multan-'+cls+'-'+year+'-annual',
    'bise-multan',Number(cls),year,'Annual',
    'BISE Multan Class '+cls+' '+year+' Annual Question Papers',
    multanPages[cls],
    'Official BISE Multan archive; many years include question papers with answer keys.'
  )));
  Object.entries(multanSupplementary).forEach(([cls,years])=>years.forEach(year=>official(
    'multan-'+cls+'-'+year+'-supplementary',
    'bise-multan',Number(cls),year,'Supplementary',
    'BISE Multan Class '+cls+' '+year+' 2nd Annual / Supplementary Papers',
    multanPages[cls],
    'Official BISE Multan supplementary/second-annual archive; answer keys are included for many cycles.'
  )));

  // BISE Multan — detailed verified pages for recent cycles.
  [
    [9,2026,'Annual','BISE Multan 9th 1st Annual 2026 Papers with Keys','https://web.bisemultan.edu.pk/question-papers-with-key-ssc-part-i-9th-1st-annual-2026-examination/'],
    [10,2026,'Annual','BISE Multan 10th 1st Annual 2026 Papers with Keys','https://web.bisemultan.edu.pk/question-papers-with-key-ssc-part-ii-10th-1st-annual-2026-examination/'],
    [11,2025,'Annual','BISE Multan 11th 1st Annual 2025 Papers + Answer Keys','https://web.bisemultan.edu.pk/question-papers-and-answer-keys-inter-1st-annual-2025-part-i-examination/'],
    [11,2025,'Supplementary','BISE Multan 11th 2nd Annual 2025 Papers + Answer Keys','https://web.bisemultan.edu.pk/question-papers-with-answer-keys-hssc-part-i-11th-2nd-annual-examination-2025/'],
    [12,2025,'Annual','BISE Multan 12th 1st Annual 2025 Papers with Keys','https://web.bisemultan.edu.pk/question-papers-with-key-hssc-1st-annual-2025-12th-examination/'],
    [12,2025,'Supplementary','BISE Multan 12th 2nd Annual 2025 Papers + Answer Keys','https://web.bisemultan.edu.pk/question-papers-with-answer-keys-hssc-part-ii-12th-2nd-annual-examination-2025/']
  ].forEach(([cls,year,session,title,url])=>official(
    'multan-detailed-'+cls+'-'+year+'-'+session.toLowerCase(),
    'bise-multan',cls,year,session,title,url,
    'Official subject-level BISE Multan page listing downloadable question papers.'
  ));

  // BISE Multan model-paper resources.
  official('multan-11-model-papers','bise-multan',11,2026,'Annual','BISE Multan Inter Part-I Model Papers','https://web.bisemultan.edu.pk/inter-part-1-model-papers/','Official model papers including Biology, Chemistry, Islamic Education and Physics.','model');
  official('multan-10-model-papers','bise-multan',10,2026,'Annual','BISE Multan 10th Model Papers','https://web.bisemultan.edu.pk/model-papers-10th/','Official BISE Multan model-paper page.','model');

  // BISE Lahore — official direct model-paper PDFs.
  [
    {
      id:'lahore-9-islamiyat-model',boardId:'bise-lahore',classLevel:9,subject:'Islamiat / Ethics',year:2026,
      session:'Annual',type:'model',medium:'Urdu / English',source:'official',
      title:'BISE Lahore 9th Islamiyat Model Paper',
      url:'https://www.biselahore.com/index.php/downloads/notices/downloads/Model%20Papers/Matric/ModelPaper_Islamiyat_9thClass.pdf',
      fileUrl:'https://www.biselahore.com/index.php/downloads/notices/downloads/Model%20Papers/Matric/ModelPaper_Islamiyat_9thClass.pdf',
      note:'Official BISE Lahore model paper.',verifiedAt:'2026-09-18'
    },
    {
      id:'lahore-11-model-papers',boardId:'bise-lahore',classLevel:11,subject:'All Subjects',year:2026,
      session:'Annual',type:'model',medium:'English / Urdu',source:'official',
      title:'BISE Lahore Inter Part-I Model Papers',
      url:'https://www.biselahore.com/downloads/Model%20Papers/Inter/ModelPapers_11th.pdf',
      fileUrl:'https://www.biselahore.com/downloads/Model%20Papers/Inter/ModelPapers_11th.pdf',
      note:'Official BISE Lahore Inter Part-I model-paper PDF.',verifiedAt:'2026-09-18'
    }
  ].forEach(add);

  // BISE Sargodha — official model-paper portal indexed by the board.
  official('sargodha-9-model-2026','bise-sargodha',9,2026,'Annual','BISE Sargodha Grade-9 Model Papers / Smart Syllabus','https://site.bisesargodha.edu.pk/MatricModelPapers','Official BISE Sargodha model-paper page for Grade 9.','model');
  official('sargodha-10-model-2024','bise-sargodha',10,2024,'Annual','BISE Sargodha 10th Class Model Papers 2024','https://site.bisesargodha.edu.pk/MatricModelPapers','Official BISE Sargodha model-paper archive.','model');
  official('sargodha-9-model-2024','bise-sargodha',9,2024,'Annual','BISE Sargodha 9th Class Model Papers 2024','https://site.bisesargodha.edu.pk/MatricModelPapers','Official BISE Sargodha model-paper archive.','model');

  // Khyber Pakhtunkhwa and Sindh official model/sample-paper resources.
  [
    ['abbottabad-9-model','bise-abbottabad',9,2026,'BISE Abbottabad Class 9 SLO Model Papers','https://biseatd.edu.pk/sample_papers_9th.php'],
    ['abbottabad-10-model','bise-abbottabad',10,2026,'BISE Abbottabad Class 10 SLO Model Papers','https://www.biseatd.edu.pk/sample_papers_10th.php'],
    ['abbottabad-11-model','bise-abbottabad',11,2026,'BISE Abbottabad Class 11 SLO Model Papers','https://www.biseatd.edu.pk/sample_papers_11th.php'],
    ['abbottabad-12-model','bise-abbottabad',12,2026,'BISE Abbottabad Class 12 SLO Model Papers','https://biseatd.edu.pk/sample_papers_12th.php'],
    ['bannu-9-model','bise-bannu',9,2026,'BISE Bannu SSC 9th Sample / Model Papers','https://www.biseb.edu.pk/sample-papers.php'],
    ['bannu-10-model','bise-bannu',10,2026,'BISE Bannu SSC 10th Sample / Model Papers','https://www.biseb.edu.pk/sample-papers.php'],
    ['bannu-11-model','bise-bannu',11,2026,'BISE Bannu HSSC 11th Sample Papers','https://www.biseb.edu.pk/sample-papers.php'],
    ['bannu-12-model','bise-bannu',12,2026,'BISE Bannu HSSC 12th Sample Papers','https://www.biseb.edu.pk/sample-papers.php'],
    ['peshawar-12-model','bise-peshawar',12,2026,'BISE Peshawar HSSC 12th SLO Model Papers','https://www.bisep.edu.pk/'],
    ['peshawar-hssc-model','bise-peshawar',11,2026,'BISE Peshawar HSSC SLO Model Papers','https://www.bisep.edu.pk/'],
    ['biek-11-12-model-2024','biek-karachi',11,2024,'BIEK Karachi XI & XII Model Papers 2024 Onward','https://biek.edu.pk/ModelPaper/2024/Model-Paper-for-Examinations-2024.pdf']
  ].forEach(([id,boardId,cls,year,title,url])=>{
    const rec={id,boardId,classLevel:cls,subject:'All Subjects',year,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title,url,note:'Official board model/sample-paper resource.',verifiedAt:'2026-09-18'};
    if(/\.pdf(?:$|[?#])/i.test(url))rec.fileUrl=url;
    add(rec);
  });

  // AJK BISE — official model-paper portal and 2026 SSC-II assessment resources.
  [
    ['ajk-10-math-model-2026','Mathematics','AJK BISE SSC-II Mathematics Assessment Framework / Model Paper'],
    ['ajk-10-urdu-model-2026','Urdu','AJK BISE SSC-II Urdu Assessment Framework / Model Paper'],
    ['ajk-10-english-model-2026','English','AJK BISE SSC-II English Assessment Framework / Model Paper']
  ].forEach(([id,subject,title])=>add({
    id,boardId:'bise-ajk',classLevel:10,subject,year:2026,session:'Annual',type:'model',
    medium:'English / Urdu',source:'official',title,
    url:'https://ajkbise.net/modelpapers.php',
    note:'Official AJK BISE model-paper resource announced on the board website in July 2026.',
    verifiedAt:'2026-09-18'
  }));

  // BSEK Karachi — verified subject-rich model-paper archive.
  [
    [9,2023,'BSEK Karachi 9th Science & General Group Model Papers 2023'],
    [10,2023,'BSEK Karachi 10th Science & General Group Model Papers 2023'],
    [9,2022,'BSEK Karachi 9th Science & General Group Model Papers 2022'],
    [10,2022,'BSEK Karachi 10th Science & General Group Model Papers 2022'],
    [9,2018,'BSEK Karachi 9th Model Papers 2018'],
    [10,2018,'BSEK Karachi 10th Model Papers 2018']
  ].forEach(([cls,year,title])=>add({
    id:'bsek-'+cls+'-'+year+'-verified-model-archive',boardId:'bsek-karachi',classLevel:cls,
    subject:'All Subjects',year,session:'Annual',type:'model',medium:'English / Urdu',source:'verified',
    title,url:'https://bsekkarachi.resultonline.pk/modelpaper/ssc-matric-part-1-2-9th-10th-class/',
    note:'Verified third-party archive. Confirm subject/group against BSEK before exam use.',
    verifiedAt:'2026-09-18'
  }));

  // BBISE Quetta — verified model-paper archive where the official board does not expose a stable public index.
  [
    [11,2018,'BBISE Quetta 11th / HSSC-I Model Papers 2018'],
    [12,2017,'BBISE Quetta 12th / HSSC-II Model Papers 2017']
  ].forEach(([cls,year,title])=>add({
    id:'quetta-'+cls+'-'+year+'-verified-model-archive',boardId:'bbise-quetta',classLevel:cls,
    subject:'All Subjects',year,session:'Annual',type:'model',medium:'English / Urdu',source:'verified',
    title,url:'https://bisequetta.resultonline.pk/modelpaper/hssc-inter-part-1-2-11th-12th-class/',
    note:'Verified third-party archive; official reference remains BBISE Quetta.',
    verifiedAt:'2026-09-18'
  }));

  // BISE Mardan — official old-paper and SLO model-paper resources.
  [
    ['mardan-9-old-index',9,'Old Papers','BISE Mardan SSC 9th Old Papers','portal'],
    ['mardan-10-old-index',10,'Old Papers','BISE Mardan SSC 10th Old Papers','portal'],
    ['mardan-11-old-index',11,'Old Papers','BISE Mardan HSSC Part-I Old Papers','portal'],
    ['mardan-12-old-index',12,'Old Papers','BISE Mardan HSSC Part-II Old Papers','portal'],
    ['mardan-9-slo-models',9,'All Subjects','BISE Mardan Class 9 SLO Model Papers & Marking Schemes','model'],
    ['mardan-10-slo-models',10,'All Subjects','BISE Mardan Class 10 SLO Model Papers & Marking Schemes','model'],
    ['mardan-11-onscreen-models',11,'English / Physics / Chemistry','BISE Mardan Class 11 On-Screen Marking Model Papers','model'],
    ['mardan-12-onscreen-models',12,'English / Physics / Chemistry','BISE Mardan Class 12 On-Screen Marking Model Papers','model']
  ].forEach(([id,cls,subject,title,type])=>add({
    id,boardId:'bise-mardan',classLevel:cls,subject,year:2026,session:'Annual',type,
    medium:'English / Urdu',source:'official',title,
    url:'https://web.bisemdn.edu.pk/student?cat=mp',
    note:'Official BISE Mardan Student Corner resource. Old papers and SLO/model papers are listed by class and subject.',
    verifiedAt:'2026-09-18'
  }));

  // BISE Swat — official syllabus, model papers, rubrics and e-marking papers.
  [9,10,11,12].forEach(cls=>add({
    id:'swat-'+cls+'-slo-models-2026',boardId:'bise-swat',classLevel:cls,subject:'All Subjects',
    year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',
    title:'BISE Swat Class '+cls+' SLO Model Papers, Marking Schemes & TOS',
    url:'https://www.bisess.edu.pk/site/home/syllabus-model-papers',
    note:'Official BISE Swat syllabus/model-paper library with subject-wise model papers and marking schemes.',
    verifiedAt:'2026-09-18'
  }));
  [9,10,11,12].forEach(cls=>add({
    id:'swat-'+cls+'-emarking-models-2026',boardId:'bise-swat',classLevel:cls,subject:'English / Physics / Chemistry',
    year:2026,session:'Annual',type:'model',medium:'English',source:'official',
    title:'BISE Swat Class '+cls+' E-Marking Model Papers',
    url:'https://www.bisess.edu.pk/site/home/emarking-model-papers/',
    note:'Official BISE Swat e-marking model papers for English, Chemistry and Physics.',
    verifiedAt:'2026-09-18'
  }));

  // BISE Faisalabad — current and archived official model-paper resources.
  [
    ['fsd-9-model-2026',9,2026,'BISE Faisalabad Grade-IX Revised Smart Syllabus, Pairing Schemes & Model Papers'],
    ['fsd-11-smart-2026',11,2026,'BISE Faisalabad Grade-11 Smart Syllabus 2026'],
    ['fsd-9-model-2024',9,2024,'BISE Faisalabad 9th Model Papers with Index'],
    ['fsd-10-model-2024',10,2024,'BISE Faisalabad 10th Model Papers with Index'],
    ['fsd-11-model-2024',11,2024,'BISE Faisalabad Intermediate First Year Model Papers'],
    ['fsd-12-model-2024',12,2024,'BISE Faisalabad Intermediate Second Year Model Papers']
  ].forEach(([id,cls,year,title])=>add({
    id,boardId:'bise-faisalabad',classLevel:cls,subject:'All Subjects',year,session:'Annual',type:'model',
    medium:'English / Urdu',source:'official',title,
    url:'https://bisefsd.edu.pk/NewsEvents.aspx',
    note:'Official BISE Faisalabad notification/downloads page carrying the referenced model-paper resource.',
    verifiedAt:'2026-09-18'
  }));

  // BISE D.G. Khan — direct official HSSC-II model paper PDFs.
  [
    ['dgk-12-biology-model-2019','Biology','Bio%2012th.pdf','BISE D.G. Khan 12th Biology Model Paper'],
    ['dgk-12-chemistry-model-2019','Chemistry','Chemistry%2012th.pdf','BISE D.G. Khan 12th Chemistry Model Paper'],
    ['dgk-12-cs-model-2019','Computer Science','Computer%20Science%2012th.pdf','BISE D.G. Khan 12th Computer Science Model Paper'],
    ['dgk-12-physics-model-2019','Physics','Physics%2012th.pdf','BISE D.G. Khan 12th Physics Model Paper'],
    ['dgk-12-statistics-model-2019','Statistics','STATISTICS%20PART12.pdf','BISE D.G. Khan 12th Statistics Model Paper'],
    ['dgk-12-urdu-model-2019','Urdu','Paper%20Urdu%2012.pdf','BISE D.G. Khan 12th Urdu Model Paper'],
    ['dgk-12-accounting-model-2019','Accounting','Principles%20of%20Accounting%2012th.pdf','BISE D.G. Khan 12th Principles of Accounting Model Paper']
  ].forEach(([id,subject,file,title])=>{
    const url='https://bisedgkhan.edu.pk/modelpapers/modelpapers/'+file;
    add({id,boardId:'bise-dgkhan',classLevel:12,subject,year:2019,session:'Annual',type:'model',
      medium:'English / Urdu',source:'official',title,url,fileUrl:url,
      note:'Direct PDF from the official BISE D.G. Khan model-paper directory.',verifiedAt:'2026-09-18'});
  });
  {
    const url='https://bisedgkhan.edu.pk/modelpapers/modelpapers/MODEL%20PAPER%20INTER_2016.pdf';
    add({id:'dgk-inter-model-2016',boardId:'bise-dgkhan',classLevel:12,subject:'All Subjects',year:2016,
      session:'Annual',type:'model',medium:'English / Urdu',source:'official',
      title:'BISE D.G. Khan Intermediate Model Paper 2016',url,fileUrl:url,
      note:'Direct official model-paper PDF from BISE D.G. Khan.',verifiedAt:'2026-09-18'});
  }

  PP.updatedAt='2026-09-18';
})();