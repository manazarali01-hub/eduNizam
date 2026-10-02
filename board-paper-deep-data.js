(function(){
'use strict';
const P=window.EDUNIZAM_PAST_PAPERS;if(!P||!Array.isArray(P.papers))return;
const add=x=>{if(!P.papers.some(p=>p.id===x.id))P.papers.push(x)};
const punjabBoards=[
  ['bise-lahore','BISE Lahore'],['bise-gujranwala','BISE Gujranwala'],['bise-rawalpindi','BISE Rawalpindi'],
  ['bise-sargodha','BISE Sargodha'],['bise-faisalabad','BISE Faisalabad'],['bise-sahiwal','BISE Sahiwal'],
  ['bise-multan','BISE Multan'],['bise-dgkhan','BISE D.G. Khan'],['bise-bahawalpur','BISE Bahawalpur']
];
punjabBoards.forEach(([boardId,name])=>{
  add({id:boardId+'-pectaa-g9-2026',boardId,classLevel:9,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:name+' Grade 9 — PECTAA Smart Syllabus, Pairing Schemes & Model Papers 2026',url:'https://pectaa.edu.pk/curriculum-compliance/',note:'Official Punjab-wide PECTAA Grade-9 Annual Examination 2026 smart syllabus, pairing schemes and model papers. Applies across Punjab BISE boards; confirm subject/medium in the official file.'});
  add({id:boardId+'-pectaa-g11-2026',boardId,classLevel:11,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:name+' Grade 11 — PECTAA Smart Syllabus, Pairing Schemes & Model Papers 2026',url:'https://pectaa.edu.pk/curriculum-compliance/',note:'Official Punjab-wide PECTAA Grade-11 Annual Examination 2026 smart syllabus, pairing schemes and model papers. Applies across Punjab BISE boards; confirm subject/medium in the official file.'});
});
[
  {id:'lahore-ssc-model-current',boardId:'bise-lahore',classLevel:9,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Lahore Matric Model Papers',url:'https://www.biselahore.com/model-papers/ssc',note:'Official BISE Lahore SSC model-paper hub for 9th/10th class sample papers and current model-paper resources.'},
  {id:'lahore-hssc-model-current',boardId:'bise-lahore',classLevel:11,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Lahore Intermediate Model Papers',url:'https://www.biselahore.com/model-papers/hssc',note:'Official BISE Lahore HSSC model-paper hub for 11th/12th class sample papers and practical model papers.'},

  {id:'multan-ssc-model-current',boardId:'bise-multan',classLevel:9,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Multan Matric Model Papers',url:'https://web.bisemultan.edu.pk/model-papers-matric/',note:'Official BISE Multan SSC model-paper hub, including current Grade-9 smart-syllabus/model-paper material and archived model papers.'},
  {id:'multan-hssc-model-current',boardId:'bise-multan',classLevel:11,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Multan Intermediate Model Papers',url:'https://web.bisemultan.edu.pk/model-papers-inter/',note:'Official BISE Multan HSSC model-paper hub, including current Grade-11 smart-syllabus/model-paper material and archived model papers.'},
  {id:'multan-ssc-past-archive',boardId:'bise-multan',classLevel:10,subject:'All Subjects',year:2025,session:'Annual',type:'past',medium:'English / Urdu',source:'official',title:'BISE Multan SSC Past Question Papers',url:'https://web.bisemultan.edu.pk/past-question-papers/',note:'Official BISE Multan past-question-paper archive. Open the SSC/Matric section and select the required paper/year.'},
  {id:'multan-hssc-past-archive',boardId:'bise-multan',classLevel:12,subject:'All Subjects',year:2025,session:'Annual',type:'past',medium:'English / Urdu',source:'official',title:'BISE Multan HSSC Past Question Papers',url:'https://web.bisemultan.edu.pk/past-question-papers/',note:'Official BISE Multan past-question-paper archive. Open the HSSC/Intermediate section and select the required paper/year.'},

  {id:'faisalabad-ssc-model-current',boardId:'bise-faisalabad',classLevel:9,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Faisalabad Matric Model Papers & Downloads',url:'https://www.bisefsd.edu.pk/Downloads.aspx',note:'Official BISE Faisalabad downloads include Matric model papers and current Grade-9 model/pairing-scheme material.'},
  {id:'faisalabad-hssc-model-current',boardId:'bise-faisalabad',classLevel:11,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Faisalabad Intermediate Model Papers & Downloads',url:'https://www.bisefsd.edu.pk/Downloads.aspx',note:'Official BISE Faisalabad downloads include Intermediate model papers and current Grade-11 smart-syllabus/model-paper material.'},

  {id:'sargodha-ssc-model-current',boardId:'bise-sargodha',classLevel:9,subject:'All Subjects',year:2026,session:'Annual',type:'model',medium:'English / Urdu',source:'official',title:'BISE Sargodha Matric Model Papers',url:'https://site.bisesargodha.edu.pk/MatricModelPapers',note:'Official BISE Sargodha SSC model-paper page with Grade-9/10 resources, including Annual Examination 2026 model-paper material.'}
].forEach(add);
P.updatedAt='2026-10-02';
})();