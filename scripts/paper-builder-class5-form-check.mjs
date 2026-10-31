/* Reproduce Class 5 Science user flow without a registered school.
 * This checks a concept-practice preview, NEVER publishes invented school data. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
const ok=(condition,message)=>{if(!condition)throw Error(message)};
const els=new Map();
const node=(id,props={})=>{const e={value:'',innerHTML:'',disabled:false,checked:false,onclick:null,
 addEventListener(){},querySelectorAll(){return[]},scrollIntoView(){},classList:{add(){},remove(){},toggle(){}} ,...props};els.set(id,e);return e};
node('#pbClass',{value:'5'});node('#pbSubject',{value:'General Science'});
node('#pbClasses');node('#pbSubjects');node('#pbChapters');
node('#pbChapterPicker');node('#pbSelectedChapters');node('#pbCurriculumSources');
node('#pbBookBoard',{value:'punjab-pectaa'});
node('#pbMarks',{value:'50'});node('#pbDifficulty',{value:'Balanced'});
node('#pbDistribution',{value:'Balanced'});node('#pbTeacherOnly',{checked:false});
node('#pbConceptDraft',{checked:true});node('#pbGenerationStatus');
node('#pbTitle',{value:'Grade 5 General Science Practice Paper'});
node('#pbBankInsight');node('#paperPreview');node('#pbPrint');node('#pbKey');
const document={readyState:'loading',addEventListener(){},querySelector:id=>els.get(id)||null,querySelectorAll:()=>[]};
const window={EDUNIZAM_CLOUD_CONFIG:{institutionId:''},EDUNIZAM_CLOUD:null};
const context={window,document,console,localStorage:{getItem:()=>null},setTimeout,clearTimeout,AbortController,alert:m=>{throw Error('Unexpected blocking alert: '+m)}};
for(const f of ['past-papers-data.js','practice-data.js','study-data.js','pectaa-core-textbooks.js','pectaa-secondary-textbooks.js',
 'learning-premium-data.js','learning-complete-data.js','learning-required-data.js','practice-foundation-data.js',
 'practice-curriculum-expansion.js','practice-depth-data.js','punjab-quran-subjects-pack.js','practice-complete-data.js',
 'practice-session-core.js','paper-syllabus-audit.js','teacher-paper-builder.js']){
 runInNewContext(read(f),context,{filename:f,timeout:8000});
}
const api=window.EDUNIZAM_PAPER_BUILDER;
ok(api?.previewPaper&&api?.refreshPaperCatalog&&api?.renderSelectedChapters,'Wizard dropdown/preview integration missing');
api.refreshPaperCatalog();
ok(els.get('#pbClass').innerHTML.includes('value="5"')&&els.get('#pbClass').innerHTML.includes('Class 5'),'Class 5 must be selectable without a school row');
ok(els.get('#pbSubject').innerHTML.includes('General Science'),'Grade 5 science subject absent from select dropdown');
ok(!els.get('#pbSubject').disabled,'Grade 5 subject select is disabled');
const grade5=api.chapterChoices('5','General Science',[]);
ok(grade5.length>=4,'No Class 5 Science reference chapter choices');
ok(els.get('#pbChapterPicker').innerHTML.includes(grade5[0]),'Chapter select lacks Grade 5 Science topics');
const ready=api.recommendPaperChapters('5','General Science',50,'Balanced','Balanced');
ok(ready.ready&&ready.topics.length>0,'50-mark Class 5 Science paper lacks enough matching questions: '+ready.reason);
els.get('#pbChapters').value=ready.topics.join(', ');
api.renderSelectedChapters();
ok(els.get('#pbChapters').value===ready.topics.join(', '),'Chosen chapters failed to persist');
const result=api.previewPaper();
ok(result.ready&&result.mode==='concept-only-draft'&&result.total===50,
 'Concept preview was blocked by absent current-school active class: '+result.reason);
const preview=els.get('#paperPreview').innerHTML;
ok(preview.includes('CONCEPT PRACTICE DRAFT')&&!preview.includes('id="pbSaveAsNew"'),
 'Non-registered paper was labeled official or offered invalid school saving');
ok(preview.includes('Set Up Classes')&&preview.includes('50 Marks')||preview.includes('50'),'Marks or registration guidance missing');
ok(els.get('#pbGenerationStatus').textContent.includes('Preview generated'),'Generation did not report usable success');
els.get('#pbConceptDraft').checked=false;
const official=api.previewPaper();
ok(!official.ready&&official.reason.includes('School paper unavailable'),'Official school examination bypassed cloud registration checks');
console.log('Grade 5 Science paper form PASS: actual class/subject/chapter selectors, 50 marks, Balanced pattern, printable practice preview without school class, guarded official exams.');
