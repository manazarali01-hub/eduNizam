(function(){
'use strict';

function filterQuestions(all,filters={}){
  const cl=String(filters.classLevel||''),subject=String(filters.subject||''),chapter=String(filters.chapter||''),type=String(filters.type||''),difficulty=String(filters.difficulty||'');
  return (Array.isArray(all)?all:[]).filter(x=>
    (!cl||String(x.classLevel)===cl)&&
    (!subject||x.subject===subject)&&
    (!chapter||x.chapter===chapter)&&
    (!type||x.type===type)&&
    (!difficulty||x.difficulty===difficulty)
  );
}
function shuffled(rows,random=Math.random){
  const out=[...(Array.isArray(rows)?rows:[])];
  for(let i=out.length-1;i>0;i--){
    const raw=Number(random());
    const safe=Number.isFinite(raw)?Math.min(.999999999,Math.max(0,raw)):0;
    const j=Math.floor(safe*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
function selectSession(all,filters={},options={}){
  let rows=filterQuestions(all,filters);
  if(options.order==='random')rows=shuffled(rows,options.random||Math.random);
  const limit=options.limit==null?'10':String(options.limit);
  if(limit!=='all')rows=rows.slice(0,Math.max(1,Number(limit)||10));
  return rows;
}
function attemptValues(attempts){
  if(attempts instanceof Map)return [...attempts.values()];
  if(Array.isArray(attempts))return attempts;
  if(attempts&&typeof attempts==='object')return Object.values(attempts);
  return [];
}
function sessionStats(rows,attempts){
  const values=attemptValues(attempts);
  const mcq=values.filter(x=>x?.kind==='mcq'),written=values.filter(x=>x?.kind==='written');
  return {
    attempted:values.length,
    correct:mcq.filter(x=>x.correct===true).length,
    mcqAttempted:mcq.length,
    reviewed:written.length,
    pending:Math.max(0,(Array.isArray(rows)?rows.length:0)-values.length)
  };
}
function auditMatrix(data){
  const questions=data?.questions||[],missing=[];
  for(const [cl,subjects] of Object.entries(data?.subjects||{})){
    for(const subject of subjects||[]){
      for(const chapter of data?.chapters?.[cl+'|'+subject]||[]){
        const rows=filterQuestions(questions,{classLevel:cl,subject,chapter});
        for(const type of ['mcq','short','long']){
          for(const difficulty of ['Easy','Medium','Hard']){
            if(!rows.some(x=>x.type===type&&x.difficulty===difficulty)){
              missing.push({classLevel:Number(cl),subject,chapter,type,difficulty});
            }
          }
        }
      }
    }
  }
  return missing;
}
window.EDUNIZAM_PRACTICE_CORE={filterQuestions,shuffled,selectSession,sessionStats,auditMatrix};
})();