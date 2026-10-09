/* Security and import contract for PDF/photo paper source workflow.
 * Uses mock files; does not transmit student or source data to a server. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const assert=(x,msg)=>{if(!x)throw Error(msg)};
const window={},document={querySelector:()=>null,createElement:()=>({})};
const ctx={window,document,console,setTimeout,clearTimeout,TextEncoder};
runInNewContext(read('paper-source-import.js'),ctx,{filename:'paper-source-import.js'});
runInNewContext(read('teacher-question-import.js'),ctx,{filename:'teacher-question-import.js'});
const src=window.EDUNIZAM_PAPER_SOURCE,imp=window.EDUNIZAM_QUESTION_IMPORT;
assert(src&&src.extract&&src.mount&&src.parseExplicitQuestions&&src.stripJson,'PDF/photo reader does not expose complete workflow API');
const files=[{name:'notes.pdf',type:'application/pdf',size:40000},{name:'photo.jpeg',type:'image/jpeg',size:24000}];
assert(src.validateFiles(files).length===2,'PDF and image batch not accepted');
for(const bad of [
 [{name:'payload.html',type:'text/html',size:200}],
 [{name:'too-big.pdf',type:'application/pdf',size:16*1024*1024}],
 Array(7).fill({name:'a.png',type:'image/png',size:100}),
 [{name:'empty.png',type:'image/png',size:0}]
]){let denied=false;try{src.validateFiles(bad)}catch{denied=true}assert(denied,'Unsupported file type, count or size was accepted')}
// Simulate a real text-based PDF run: PDF.js items must preserve
// original line breaks for Q/A identification; no remote PDF service.
const samplePdf={name:'g5-science.pdf',type:'application/pdf',size:1200,arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer};
window.pdfjsLib={
 GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({
  numPages:1,
  getPage:async()=>({getTextContent:async()=>({items:[
   {str:'Q1: What is the state of ice?',transform:[1,0,0,1,20,700]},
   {str:'A) Gas',transform:[1,0,0,1,20,676]},
   {str:'B) Liquid',transform:[1,0,0,1,20,652]},
   {str:'C) Solid',transform:[1,0,0,1,20,628]},
   {str:'D) Plasma',transform:[1,0,0,1,20,604]},
   {str:'Answer: C',transform:[1,0,0,1,20,580]},
   {str:'Q2: Define matter.',transform:[1,0,0,1,20,556]},
   {str:'Answer: Matter has mass and occupies space.',transform:[1,0,0,1,20,532]}
  ]})}),
  destroy:async()=>{}
 })})
};
const textPdf=await src.extract([samplePdf]);
assert(textPdf.text.includes('\\nA) Gas')&&textPdf.text.includes('\\nAnswer: C'),
 'PDF text-extraction flattened Q/A lines rather than preserving their positions');
assert(src.parseExplicitQuestions(textPdf.text).length===2,
 'Text PDF content cannot be converted into 2 human-reviewable answered questions');
let ocrWorkers=0,ocrStops=0;
window.Tesseract={createWorker:async language=>{
 ocrWorkers++;
 assert(language==='eng','Default image OCR should use English language pack');
 return{recognize:async()=>({data:{text:'Q1: Define energy.\\nAnswer: Energy is the capacity for doing work.'}}),terminate:async()=>{ocrStops++}};
}};
const imageBatch=await src.extract([
 {name:'page1.png',size:1100,type:'image/png'},
 {name:'page2.jpg',size:1300,type:'image/jpeg'}
]);
assert(imageBatch.sources.length===2&&ocrWorkers===1&&ocrStops===1&&imageBatch.text.includes('Define energy'),
 'Photos were not OCR processed locally with a single properly terminated worker');
const source='Q1: What is the state of ice?\nA) Gas\nB) Liquid\nC) Solid\nD) Plasma\nAnswer: C\n\nQ2: What is matter?\nAnswer: Matter has mass and occupies space.';
const found=src.parseExplicitQuestions(source);
assert(found.length===2&&found[0].type==='mcq'&&found[0].correct_option==='3'&&found[1].type==='short','Unambiguous PDF/OCR question-answer parsing failed');
const rows=src.normalizeDraft(found,'5','General Science','Matter');
const validated=imp.prepare(JSON.stringify(rows),'ocr-questions.json');
assert(validated.valid.length===2&&validated.errors.length===0,'OCR question bank drafts fail strict teacher question validation: '+validated.errors.join(' / '));
assert(rows.every(r=>r.class==='5'&&r.chapter==='Matter'&&r.visibility==='private'),'Source drafts need chosen grade/chapter and private-by-default');
const noKey=src.parseExplicitQuestions('Q1: What is energy?\nA) A\nB) B\nC) C\nD) D');
assert(noKey.length===0,'Unanswered image question accepted as having an answer');
assert(src.stripJson('\\u0060\\u0060\\u0060json\n[{"type":"short","question":"Define matter","answer":"Mass and volume"}]\n\\u0060\\u0060\\u0060').length===1,'AI JSON draft cannot be sanitized for review');
const prompt=src.questionPrompt('Matter is anything with mass and volume.','5','General Science','Matter');
assert(prompt.includes('DIRECTLY supported')&&prompt.includes('Teacher must review')&&!prompt.includes('API key'),'AI source-grounded drafting review safeguards missing');
const builder=read('teacher-paper-builder.js'),loader=read('feature-loader.js');
assert(builder.includes('activeSourceRows()')&&builder.includes('attachSourceQuestions(rows)')&&builder.includes('prepareSourceSync()'),'In-memory source question staging or separately gated sync missing');
assert(builder.includes('schoolPaperReadiness(x.class_name,x.subject,[x.chapter])'),'Unmapped textbook questions could synchronize to school');
assert(builder.includes('window.EDUNIZAM_PAPER_SOURCE?.mount?.()'),'Upload UI not mounted when Paper Builder opens');
assert(loader.includes("'paper-source-import.js','teacher-paper-builder.js'"),'Photo/PDF helper not loaded before paper form');
assert(read('paper-source-import.js').includes('pbSourceAiConsent')&&read('paper-source-import.js').includes('pbSourceReviewed'),'No separate opt-in for AI and teacher answer review');
console.log('Paper PDF/photo import PASS: file limits, explicit answer-key OCR parsing, private review drafts, opt-in AI, school save gate, lazy-loaded UI.');
