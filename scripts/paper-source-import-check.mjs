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
