/* Regression: Matric 9–10 / Annual / Past Papers must not show a false zero. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const assert=(condition,reason)=>{if(!condition)throw new Error(reason)};
const w={};
for(const f of ['past-papers-data.js','learning-premium-data.js','learning-complete-data.js','learning-required-data.js','past-papers-inventory.js','board-paper-deep-data.js','board-paper-regional-deep-data.js','guest-paper-query.js']){
 runInNewContext(read(f),{window:w,console},{filename:f,timeout:8000});
}
const q=w.EDUNIZAM_GUEST_PAPER_QUERY,pp=w.EDUNIZAM_PAST_PAPERS;
assert(q?.select&&q?.sourceFallback,'Guest metadata paper query missing');
assert(pp?.papers?.length>30&&pp?.boards?.length>20,'Actual board paper index unavailable');
const search=(filters={},globalQuery='')=>q.select({papers:pp.papers,boards:pp.boards,filters,globalQuery});
const annual=search({level:'matric',session:'Annual',type:'past'});
assert(annual.length>0,'Screenshot regression: Matric / Annual / Past Papers returned 0');
assert(annual.every(x=>[9,10].includes(Number(x.classLevel))&&x.session==='Annual'&&x.type==='past'),'Matric annual search mixes years, grades or types');
const selective=search({level:'matric',session:'Annual',type:'past',year:'2025'});
assert(selective.length>0&&selective.every(x=>String(x.year)==='2025'),'2025 annual filter missing or inaccurate');
const board=search({level:'matric',session:'Annual',type:'past',boardId:'fbise'});
assert(board.length>0&&board.every(x=>x.boardId==='fbise'),'FBISE Annual Past Paper results missing');
const noLeak=search({level:'matric',session:'Annual',type:'past'},'CS101 handouts');
assert(noLeak.length===annual.length,'Unrelated global search incorrectly restricts targeted paper filters');
const manual=search({level:'matric',type:'past',text:'Annual'});
assert(manual.length>0&&manual.every(x=>[9,10].includes(Number(x.classLevel))),'Annual keyword searches must work as normal text too');
const supplement=search({level:'matric',session:'Supplementary',type:'past'});
assert(supplement.length>0&&supplement.every(x=>x.session==='Supplementary'),'Supplementary search mixed Annual papers');
const fake=search({boardId:'fbise',level:'matric',session:'Annual',type:'past',year:'2099'});
assert(fake.length===0,'Made-up future-year paper was presented as real');
const fallback=q.sourceFallback({boards:pp.boards,filters:{boardId:'fbise',level:'matric',session:'Annual',year:'2099'},limit:8});
assert(fallback.length===1&&fallback[0].id==='fbise','Fallback is not scoped to selected real board');
const scoped=q.sourceFallback({boards:pp.boards,filters:{level:'matric'},limit:8});
assert(scoped.length>0&&scoped.every(x=>x.classes.some(c=>[9,10].includes(Number(c)))),'Fallback offers irrelevant non-Matric boards');
const base=read('learn.html'),premium=read('guest-learning-premium.js');
assert(base.includes('guest-paper-query.js?v=20261009-facet-search-v1'),'Guest page not loading facet helper');
assert(base.includes('api.select({papers,boards,filters:f'),'Live guest search not based on paper metadata');
assert(base.includes('indexed paper result'),'Paper summary not distinguishing indexed paper matches');
assert(base.includes('NOT the requested Annual or subject-specific PDF'),'Fallback must not claim exact paper');
assert(!premium.includes("!norm(card.textContent).includes(norm(session))"),'Old broken DOM Annual search still present');
console.log('EduNizam Guest Past Papers PASS: '+pp.papers.length+' indexed resources, '+pp.boards.length+' boards, Matric/Annual/Past matches='+annual.length+', 2025='+selective.length+', FBISE='+board.length+', targeted-search isolation, official source fallback and no false exact paper.');
