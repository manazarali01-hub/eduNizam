/* Paper Source Import — client-side PDF text / photograph OCR.
 * Nothing is uploaded or saved automatically. AI requests are opt-in.
 * OCR, model answers and chapter mapping are teacher-reviewed, never certified. */
(function(){
'use strict';
const MAX_FILES=6,MAX_PDF_BYTES=15*1024*1024,MAX_IMAGE_BYTES=8*1024*1024;
const MAX_PAGES=20,MAX_OCR_PAGES=5,MAX_TEXT=36000;
const PDF_URL='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDF_WORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const OCR_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const $=s=>document.querySelector(s);
const cache=new Map();
const trim=s=>String(s||'').replace(/\r\n?/g,'\n').trim();
const bytes=n=>Math.round(n/1024)+' KB';
function validateFiles(files){
 const selected=Array.from(files||[]);
 if(!selected.length)throw Error('Please choose PDF or image file(s) first.');
 if(selected.length>MAX_FILES)throw Error('Choose at most '+MAX_FILES+' files per batch.');
 return selected.map(file=>{
  const type=String(file.type||'').toLowerCase(),name=String(file.name||'');
  const pdf=type==='application/pdf'||(!type&&/\.pdf$/i.test(name));
  const image=['image/jpeg','image/png','image/webp'].includes(type)||
   (!type&&/\.(jpe?g|png|webp)$/i.test(name));
  if(!pdf&&!image)throw Error(name+': only PDF, JPG, PNG or WEBP are supported.');
  if(!file.size||file.size>(pdf?MAX_PDF_BYTES:MAX_IMAGE_BYTES))
   throw Error(name+': '+(pdf?'PDF maximum 15 MB':'Image maximum 8 MB')+'.');
  return{file,kind:pdf?'pdf':'image'};
 });
}
async function loadScript(url,globalName){
 if(window[globalName])return window[globalName];
 if(cache.has(url))return cache.get(url);
 const task=new Promise((resolve,reject)=>{
  const el=document.createElement('script');el.src=url;el.async=true;
  const timer=setTimeout(()=>{el.remove();reject(Error(globalName+' library load timeout. Check your internet.'))},18000);
  el.onload=()=>{clearTimeout(timer);window[globalName]?resolve(window[globalName]):reject(Error(globalName+' library unavailable.'))};
  el.onerror=()=>{clearTimeout(timer);el.remove();reject(Error('Cannot load '+globalName+'. Internet connection required.'))};
  document.head.appendChild(el);
 }).catch(error=>{cache.delete(url);throw error});
 cache.set(url,task);return task;
}
async function pdfLib(){
 const lib=await loadScript(PDF_URL,'pdfjsLib');
 lib.GlobalWorkerOptions.workerSrc=PDF_WORKER;
 return lib;
}
async function makeOcr(language){
 const t=await loadScript(OCR_URL,'Tesseract');
 return t.createWorker(language==='eng+urd'?'eng+urd':'eng');
}
async function scanPdf(file,ocrText,onProgress,language){
 const lib=await pdfLib(),data=new Uint8Array(await file.arrayBuffer());
 let pdf;
 try{pdf=await lib.getDocument({data,isEvalSupported:false}).promise}
 catch(e){throw Error(file.name+': PDF could not be opened (encrypted, damaged or unsupported). '+String(e.message||e))}
 try{
  const pages=Math.min(pdf.numPages,MAX_PAGES),chunks=[];let scanned=0;
  for(let i=1;i<=pages;i++){
   const page=await pdf.getPage(i),text=await page.getTextContent();
   let content=(text.items||[]).map(x=>x.str||'').join(' ').trim();
   if(content.length<60&&scanned<MAX_OCR_PAGES){
    scanned++;onProgress?.('Scanning PDF page '+i+' / '+pages+' ('+language+' OCR)');
    const viewport=page.getViewport({scale:1.35});
    const canvas=document.createElement('canvas');
    const factor=Math.min(1,1800/Math.max(viewport.width,viewport.height));
    canvas.width=Math.round(viewport.width*factor);canvas.height=Math.round(viewport.height*factor);
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw Error('Canvas OCR unavailable on this device.');
    await page.render({canvasContext:ctx,viewport:page.getViewport({scale:1.35*factor})}).promise;
    content=(await ocrText(canvas,language)).trim();
    canvas.width=0;canvas.height=0;
   }
   if(content)chunks.push('[Page '+i+']\n'+content);
   onProgress?.('Read '+i+' / '+pages+' PDF pages');
  }
  return{text:chunks.join('\n\n'),warning:pdf.numPages>MAX_PAGES?'Read first '+MAX_PAGES+' of '+pdf.numPages+' pages.':''};
 }finally{await pdf.destroy()}
}
async function extract(files,{language='eng',onProgress}={}){
 const items=validateFiles(files);let worker=null;
 const ocr=async(image,lang)=>{
  if(!worker)worker=await makeOcr(lang);
  const result=await worker.recognize(image);
  return String(result?.data?.text||'');
 };
 const sources=[],messages=[];
 try{
  for(let i=0;i<items.length;i++){
   const {file,kind}=items[i];onProgress?.('Reading '+(i+1)+' / '+items.length+': '+file.name);
   const result=kind==='pdf'?await scanPdf(file,ocr,onProgress,language):
    {text:await ocr(file,language),warning:''};
   sources.push({name:file.name,size:file.size,kind,characters:result.text.trim().length});
   if(result.warning)messages.push(file.name+': '+result.warning);
   if(result.text.trim())messages.push('');
   if(!result.text.trim())messages.push(file.name+': no readable text; try a sharper image or clearer scan.');
   sources[sources.length-1].text=result.text;
  }
 }finally{if(worker)await worker.terminate().catch(()=>{})}
 let text=sources.filter(s=>s.text.trim()).map(s=>'[SOURCE: '+s.name+']\n'+s.text).join('\n\n');
 if(text.length>MAX_TEXT){text=text.slice(0,MAX_TEXT);messages.push('Extracted text limited to '+MAX_TEXT+' characters per batch.')}
 return{text,sources:sources.map(({text:_,...s})=>s),warnings:messages.filter(Boolean)};
}
function parseExplicitQuestions(text){
 // Never invent a question or an answer: only pairs explicitly found in the text.
 const raw=trim(text).replace(/\[SOURCE:[^\n]*\]\n/g,'').replace(/\[Page \d+\]\n/g,'');
 const rows=[],parts=raw.split(/(?:^|\n)\s*(?:Q(?:uestion)?\s*\d*[.:)]|\d+[.)]\s+(?=[A-Z]))\s*/im);
 for(const part of parts.slice(1,151)){
  const answerMatch=part.match(/(?:^|\n)\s*(?:Answer|Ans|Correct(?:\s+option)?)\s*[:\-]\s*(.+)/im);
  if(!answerMatch)continue;
  const pos=answerMatch.index,body=part.slice(0,pos).trim(),answer=answerMatch[1].trim();
  const optPattern=/(?:^|\n)\s*([A-D])[).:]\s*(.+)/gim;
  const opts=[...body.matchAll(optPattern)];
  const question=(opts.length?body.slice(0,opts[0].index):body).replace(/\s+/g,' ').trim();
  if(!question||!answer)continue;
  if(opts.length===4&&opts.map(x=>x[1].toUpperCase()).join('')==='ABCD'){
   const correct=/^[A-D](?:[.)]|\b)/i.exec(answer),index=correct?correct[0][0].toUpperCase().charCodeAt(0)-64:0;
   if(!index)continue;
   rows.push({type:'mcq',question,options:opts.map(x=>x[2].trim()),correct_option:String(index),answer});
  }else if(!opts.length){
   rows.push({type:question.length>145?'long':'short',question,answer});
  }
 }
 return rows;
}
function stripJson(text){
 const cleaned=trim(text).replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'');
 const begin=cleaned.indexOf('['),end=cleaned.lastIndexOf(']');
 if(begin<0||end<begin)throw Error('No JSON question array found; review OCR text or retry.');
 return JSON.parse(cleaned.slice(begin,end+1));
}
function normalizeDraft(rows,className,subject,chapter){
 return (Array.isArray(rows)?rows:[]).slice(0,70).map(item=>({
  class:className,subject,chapter:String(item.chapter||chapter).trim()||chapter,
  type:String(item.type||item.question_type||'').toLowerCase(),
  difficulty:['Easy','Balanced','Challenging'].includes(item.difficulty)?item.difficulty:'Balanced',
  question:String(item.question||item.question_text||'').trim(),
  options:Array.isArray(item.options)?item.options:[],
  correct_option:item.correct_option??'',
  answer:String(item.answer||item.answer_text||'').trim(),
  visibility:'private'
 }));
}
function questionPrompt(text,className,subject,chapter){
 return 'Use ONLY the supplied OCR or PDF source text to transcribe explicit questions and their ANSWERS. Do not write new invented questions or infer answer keys when missing. Do not call the text official curriculum. Output ONLY a JSON ARRAY (no markdown), maximum 35 objects. Each object: {"type":"mcq"|"short"|"long","question":"...","options":["...","...","...","..."] for MCQs only,"correct_option":"1" through "4" for MCQs,"answer":"...","difficulty":"Balanced","chapter":"..."}. Exclude unreadable/unanswered questions, provide exactly four distinct choices and an explicit answer for MCQs. No institution/student personal data. Class '+className+', subject '+subject+', chapter hint '+chapter+'. Extract from this source:\n'+text.slice(0,9000);
}
window.EDUNIZAM_PAPER_SOURCE={validateFiles,extract,parseExplicitQuestions,stripJson,normalizeDraft,questionPrompt,MAX_FILES,MAX_PAGES,MAX_TEXT,bytes,esc};
})();
