window.EDUNIZAM_EXAM_CHECKPOINTS=(function(){
'use strict';
const escText=v=>String(v??'').trim();
const slug=v=>escText(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72);
function mode(examId,subject){
  const s=subject.toLowerCase();
  if(['fpsc-gr','ppsc'].includes(examId))return 'case';
  if(['vu-semester','aiou-semester'].includes(examId))return 'workflow';
  if(examId==='css'||/essay|current affairs|pakistan affairs|islamic|religion|precis/.test(s))return 'analytical';
  if(/english|verbal|urdu|logical|reasoning|design aptitude/.test(s))return 'skills';
  return 'concept';
}
function promptFor(examId,subject,topic){
  const m=mode(examId,subject);
  if(m==='case')return 'Open the current official advertisement/syllabus and make a verification note for “'+topic+'”. Record the exact current information, its source, and why it changes your preparation or application.';
  if(m==='workflow')return 'For “'+topic+'”, write the exact current-semester workflow you would follow, which official portal you would verify it on, and what confirmation/evidence you should retain.';
  if(m==='analytical')return 'Build a structured practice response for “'+topic+'”: define the issue or skill, organize the main points, add appropriate evidence/examples, include one counterpoint or limitation where relevant, and finish with a focused conclusion.';
  if(m==='skills')return 'Create one worked practice example for “'+topic+'”, solve or explain it step by step, then state one common mistake a candidate should avoid.';
  return 'Without looking at notes, explain “'+topic+'” in four parts: core definition/principle, key process/formula or relationship, one worked/application example, and one common misconception or error.';
}
function frameworkFor(examId,subject,topic){
  const m=mode(examId,subject);
  if(m==='case')return 'Self-check framework: use the CURRENT official commission advertisement/syllabus only. Your note should identify the exact case/post or exam, quote or accurately paraphrase the current requirement for '+topic+', record the official source/date, and explain the practical consequence. EduNizam intentionally does not hard-code changing case details.';
  if(m==='workflow')return 'Self-check framework: name the official portal/service, describe the correct sequence for '+topic+', note any current-semester deadline/instruction that must be verified there, and keep a confirmation such as submission status, receipt, screenshot or portal record where appropriate.';
  if(m==='analytical')return 'Self-check framework: a strong response should have a clear thesis/central point, logically grouped arguments, relevant evidence/examples, balanced treatment of limitations or counterarguments, accurate terminology, and a concise conclusion. Verify factual/current claims from reliable sources.';
  if(m==='skills')return 'Self-check framework: your example should actually test '+topic+', show the reasoning rather than only the final answer, use correct language/logic, and identify a realistic trap or error.';
  return 'Self-check framework: your response should accurately define '+topic+', connect the main concepts or formulae/processes, show at least one application/example, and identify a likely misconception. Compare it with the controlling official syllabus/current HSSC material before marking it complete.';
}
function make(examId,subject,topic){
  if(!examId||!subject||!topic)return null;
  return {
    id:'checkpoint-'+slug(examId)+'-'+slug(subject)+'-'+slug(topic),
    examId,subject,topic,type:'written',difficulty:'Study Checkpoint',kind:'checkpoint',
    question:promptFor(examId,subject,topic),
    answerText:frameworkFor(examId,subject,topic)
  };
}
function get(examId,subject,topic){return make(examId,subject,topic)}
return {version:'2026-10-02',get};
})();