/* PDF/photo → reviewed private practice questions.
 * Reuses paper-source-import.js PDF.js and Tesseract extraction; no file upload,
 * no question-bank mutation and no automatic publishing.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let mounted=false,reading=false,asking=false;
const source=()=>window.EDUNIZAM_PAPER_SOURCE;
const status=message=>{const node=$('practiceSourceStatus');if(node)node.textContent=message};
function context(){
 const cls=String($('practiceClass')?.value||'').trim(),
  subject=String($('practiceSubject')?.value||'').trim(),
  chapter=String($('practiceSourceChapter')?.value||$('practiceChapter')?.value||'').trim();
 if(!/^(?:[1-9]|1[0-2])$/.test(cls)||!subject)
  throw Error('Select Class 1–12 and Subject from Practice dropdowns.');
 if(!chapter)throw Error('Select a chapter or enter the source topic/chapter.');
 return{cls,subject,chapter};
}
function reviewRows(data,cls,subject,chapter){
 const s=source();if(!s)throw Error('PDF/photo reader is unavailable.');
 if(!Array.isArray(data)||!data.length||data.length>70)throw Error('Expected 1–70 questions.');
 return s.normalizeDraft(data,cls,subject,chapter);
}
function showDraft(rows){
 const el=$('practiceSourceQuestions');
 if(el)el.value=JSON.stringify(rows,null,2);
 if($('practiceSourceReviewed'))$('practiceSourceReviewed').checked=false;
 status(rows.length+' proposed questions. Correct text and EACH answer before starting practice. Nothing is saved.');
}
async function readFiles(){
 if(reading)return;reading=true;const button=$('practiceSourceRead');
 if(button)button.disabled=true;
 if($('practiceSourceText'))$('practiceSourceText').value='';
 if($('practiceSourceQuestions'))$('practiceSourceQuestions').value='';
 if($('practiceSourceReviewed'))$('practiceSourceReviewed').checked=false;
 try{
  const reader=source();if(!reader?.extract)throw Error('PDF/photo reader unavailable; reload Practice.');
  const result=await reader.extract($('practiceSourceFiles')?.files,{
   language:$('practiceSourceLanguage')?.value||'eng',
   onProgress:status
  });
  if($('practiceSourceText'))$('practiceSourceText').value=result.text;
  status('Extracted '+result.sources.length+' file(s) locally, '+result.text.length+' characters. '+
   (result.warnings.length?result.warnings.join(' | '):'Review the text, then detect Q/A or use optional AI.'));
 }catch(error){status('Could not read source: '+String(error.message||error))}
 finally{reading=false;if(button?.isConnected)button.disabled=false}
}
function detectQuestions(){
 try{
  const {cls,subject,chapter}=context(),s=source(),
   raw=String($('practiceSourceText')?.value||'').trim();
  if(!raw)throw Error('Read a file or paste source text first.');
  const detected=s?.parseExplicitQuestions?.(raw)||[];
  if(!detected.length)throw Error('No complete question AND answer pairs detected. Correct OCR text or choose optional AI. Unanswered questions are not automatically imported.');
  showDraft(reviewRows(detected,cls,subject,chapter));
 }catch(error){status('Question detection: '+String(error.message||error))}
}
async function askAi(){
 if(asking)return;asking=true;const button=$('practiceSourceAi');if(button)button.disabled=true;
 try{
  if(!$('practiceSourceAiConsent')?.checked)throw Error('Explicit AI consent is required.');
  const {cls,subject,chapter}=context(),s=source(),text=String($('practiceSourceText')?.value||'').trim();
  if(text.length<50)throw Error('At least 50 characters of readable source text required.');
  if(!window.EDUNIZAM_AI?.ready?.())throw Error('AI requires an active EduNizam cloud login and configured AI service; local OCR still works.');
  status('Requesting source-grounded practice questions. Only extracted text is sent to the AI service.');
  const data=await window.EDUNIZAM_AI.ask(s.questionPrompt(text,cls,subject,chapter),{mode:'paper-source-draft',context:' '});
  showDraft(reviewRows(s.stripJson(data?.answer||''),cls,subject,chapter));
 }catch(error){status('AI draft unavailable: '+String(error.message||error))}
 finally{asking=false;if(button?.isConnected)button.disabled=false}
}
function validateAndStart(){
 try{
  if(!$('practiceSourceReviewed')?.checked)throw Error('Review the proposed answers and tick the confirmation first.');
  const {cls,subject,chapter}=context(),s=source(),api=window.EDUNIZAM_PRACTICE_NAV;
  if(!api?.addReviewedSource||!api?.start)throw Error('Practice session is not loaded. Reload the page.');
  const rows=reviewRows(s.stripJson($('practiceSourceQuestions')?.value||''),cls,subject,chapter);
  const done=api.addReviewedSource(rows);
  if($('practiceType'))$('practiceType').value='mixed';
  if($('practiceDifficulty'))$('practiceDifficulty').value='';
  if($('practiceChapter'))$('practiceChapter').value=chapter;
  if($('practiceSourceOnly'))$('practiceSourceOnly').checked=true;
  status(done.valid+' teacher-reviewed question(s) imported into this browser session. Starting uploaded-source practice without mixing built-in questions.');
  api.start();
  return done;
 }catch(error){status('Cannot start uploaded practice: '+String(error.message||error));return null}
}
function clear(){
 window.EDUNIZAM_PRACTICE_NAV?.clearReviewedSource?.();
 for(const id of ['practiceSourceText','practiceSourceQuestions','practiceSourceChapter']){
  const el=$(id);if(el)el.value='';
 }
 if($('practiceSourceFiles'))$('practiceSourceFiles').value='';
 if($('practiceSourceReviewed'))$('practiceSourceReviewed').checked=false;
 if($('practiceSourceAiConsent'))$('practiceSourceAiConsent').checked=false;
 status('Uploaded practice questions cleared from this tab; nothing was stored in a school question bank.');
}
function mount(){
 if(mounted||!$('practiceSourceRead')||!$('startPracticeBtn'))return false;
 mounted=true;
 $('practiceSourceRead').addEventListener('click',readFiles);
 $('practiceSourceDetect')?.addEventListener('click',detectQuestions);
 $('practiceSourceAi')?.addEventListener('click',askAi);
 $('practiceSourceStage')?.addEventListener('click',validateAndStart);
 $('practiceSourceClear')?.addEventListener('click',clear);
 return true;
}
window.EDUNIZAM_PRACTICE_SOURCE={mount,reviewRows,validateAndStart,detectQuestions,clear};
})();
