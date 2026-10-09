/* EduNizam guest Past Papers — pure metadata-driven search.
 * "Annual" is a session filter; never infer it by looking at rendered text.
 * Board archive routes are FALLBACK SOURCES, not claimed exact papers. */
(function(){
'use strict';
const norm=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
const contains=(v,q)=>norm(v).includes(norm(q));
function compatibleBoard(b,f={}){
 if(!b)return false;
 if(f.boardId&&b.id!==f.boardId)return false;
 if(f.level==='matric'&&!(b.classes||[]).some(x=>[9,10].includes(Number(x))))return false;
 if(f.level==='intermediate'&&!(b.classes||[]).some(x=>[11,12].includes(Number(x))))return false;
 if(f.cl&&!(b.classes||[]).some(x=>String(x)===String(f.cl)))return false;
 return true;
}
function select({papers=[],boards=[],filters={},globalQuery=''}={}){
 const f=filters||{},map=new Map((boards||[]).map(b=>[b.id,b]));
 const hasLocal=!![f.boardId,f.cl,f.subject,f.year,f.type,f.level,f.session,f.text].some(Boolean);
 // A targeted Past Papers form must not silently inherit unrelated global search text.
 const text=norm(f.text||(!hasLocal?globalQuery:''));
 return (papers||[]).filter(p=>{
  const b=map.get(p.boardId);
  if(!compatibleBoard(b,f))return false;
  if(f.level==='matric'&&![9,10].includes(Number(p.classLevel)))return false;
  if(f.level==='intermediate'&&![11,12].includes(Number(p.classLevel)))return false;
  if(f.cl&&String(p.classLevel)!==String(f.cl))return false;
  if(f.subject&&norm(p.subject)!=='all subjects'&&!contains(p.subject,f.subject))return false;
  if(f.year&&String(p.year)!==String(f.year))return false;
  if(f.type&&p.type!==f.type)return false;
  if(f.session&&norm(p.session)!==norm(f.session))return false;
  if(text&&!contains([p.title,p.subject,p.year,p.session,p.type,p.medium,p.note,b.name,b.region].join(' '),text))return false;
  return true;
 });
}
function sourceFallback({boards=[],filters={},limit=8}={}){
 const f=filters||{};
 return (boards||[]).filter(b=>compatibleBoard(b,f)&&!!(b.archiveUrl||b.officialUrl))
  .slice(0,Math.max(0,Number(limit)||0));
}
window.EDUNIZAM_GUEST_PAPER_QUERY={select,sourceFallback,compatibleBoard,norm};
})();