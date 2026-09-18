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

  PP.updatedAt='2026-09-18';
})();