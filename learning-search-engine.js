(function(){
'use strict';

const normalize=value=>String(value??'')
  .normalize('NFKC')
  .toLocaleLowerCase('en-PK')
  .replace(/[^\p{L}\p{N}]+/gu,' ')
  .trim();

const ALIASES={
  '5th':['5'],'fifth':['5'],'پانچویں':['5'],
  '8th':['8'],'eighth':['8'],'آٹھویں':['8'],
  '9th':['9'],'ninth':['9'],'نویں':['9'],
  '10th':['10'],'tenth':['10'],'دسویں':['10'],
  '11th':['11'],'eleventh':['11'],'گیارہویں':['11'],
  '12th':['12'],'twelfth':['12'],'بارہویں':['12'],
  'class':['class'],'grade':['grade','class'],'جماعت':['class','grade'],'کلاس':['class','grade'],
  'math':['mathematics'],'maths':['mathematics'],'ریاضی':['mathematics'],
  'physics':['physics'],'فزکس':['physics'],
  'chemistry':['chemistry'],'کیمسٹری':['chemistry'],'کیمیاء':['chemistry'],
  'biology':['biology'],'حیاتیات':['biology'],
  'science':['science','general science'],'سائنس':['science','general science'],
  'computer':['computer','computer science'],'کمپیوٹر':['computer','computer science'],
  'english':['english'],'انگریزی':['english'],
  'urdu':['urdu'],'اردو':['urdu'],
  'islamiat':['islamiat','ethics'],'اسلامیات':['islamiat','ethics'],
  'pakistan':['pakistan'],'پاکستان':['pakistan'],
  'statistics':['statistics'],'شماریات':['statistics'],
  'economics':['economics'],'معاشیات':['economics'],
  'fsc':['11','12','intermediate','hssc'],
  'hssc':['11','12','intermediate','hssc'],
  'intermediate':['11','12','intermediate','hssc'],
  'matric':['9','10','ssc','matric'],
  'ssc':['9','10','ssc','matric'],
  'vu':['vu','virtual university'],
  'quiz':['quizzes','quiz'],'quizzes':['quizzes','quiz'],'کوئز':['quizzes','quiz'],
  'mcq':['mcq','quizzes','practice'],'mcqs':['mcq','quizzes','practice'],
  'handout':['handouts'],'handouts':['handouts'],'ہینڈآؤٹ':['handouts'],'ہینڈآؤٹس':['handouts'],
  'note':['notes'],'notes':['notes'],'نوٹس':['notes'],
  'assignment':['assignments'],'assignments':['assignments'],'اسائنمنٹ':['assignments'],
  'past':['past','archive','historical'],'پرانے':['past','archive','historical'],
  'paper':['paper','papers','examination'],'papers':['paper','papers','examination'],'پرچہ':['paper','papers'],'پرچے':['paper','papers'],
  'model':['model'],'ماڈل':['model'],
  'result':['result','results'],'results':['result','results'],'نتیجہ':['result','results'],
  'date':['date'],'sheet':['sheet'],'ڈیٹ':['date'],'شیٹ':['sheet'],
  'lahore':['lahore'],'لاہور':['lahore'],
  'gujranwala':['gujranwala'],'گوجرانوالہ':['gujranwala'],
  'faisalabad':['faisalabad'],'فیصل آباد':['faisalabad'],
  'multan':['multan'],'ملتان':['multan'],
  'rawalpindi':['rawalpindi'],'راولپنڈی':['rawalpindi'],
  'sargodha':['sargodha'],'سرگودھا':['sargodha'],
  'bahawalpur':['bahawalpur'],'بہاولپور':['bahawalpur'],
  'sahiwal':['sahiwal'],'ساہیوال':['sahiwal'],
  'peshawar':['peshawar'],'پشاور':['peshawar'],
  'karachi':['karachi'],'کراچی':['karachi'],
  'quetta':['quetta'],'کوئٹہ':['quetta']
};

const SUBJECT_TERMS=new Set([
  'mathematics','physics','chemistry','biology','science','general science','computer','computer science',
  'english','urdu','islamiat','ethics','pakistan','pakistan studies','statistics','economics',
  'accounting','education','civics','psychology','sociology'
]);

function variants(token){
  const t=normalize(token);
  return [...new Set([t,...(ALIASES[t]||[]).map(normalize)].filter(Boolean))];
}

function courseCode(value){
  const raw=String(value??'').normalize('NFKC').toUpperCase();
  const m=raw.match(/(?:^|[^A-Z0-9])([A-Z]{2,5})[\s._-]*(\d{3,4}[A-Z]?)(?=$|[^A-Z0-9])/);
  return m?normalize(m[1]+m[2]):'';
}

function requestedVuFamily(value){
  const q=normalize(value);
  if(/highlighted|highlight|ہائی لائٹ/.test(q))return 'highlighted';
  if(/handout|ہینڈآؤٹ/.test(q))return 'handouts';
  if(/quiz|mcq|کوئز/.test(q))return 'quizzes';
  if(/assignment|gdb|اسائنمنٹ/.test(q))return 'assignments';
  if(/midterm|mid term|مڈ/.test(q))return 'midterm';
  if(/final term|finalterm|فائنل/.test(q))return 'final';
  if(/past paper|past papers|پرانے پرچے|پرانا پرچہ/.test(q))return 'past';
  if(/lecture video|videos|video|ویڈیو/.test(q))return 'videos';
  if(/reference book|reference books|books/.test(q))return 'references';
  if(/grading|grade scheme/.test(q))return 'grading';
  if(/course overview|overview|syllabus/.test(q))return 'overview';
  if(/date sheet|ڈیٹ شیٹ/.test(q))return 'datesheet';
  if(/result|results|نتیجہ/.test(q))return 'results';
  if(/note|notes|نوٹس/.test(q))return 'notes';
  return '';
}

function vuTypeMatches(type,family){
  const t=normalize(type);
  if(!family)return true;
  if(family==='highlighted')return t.includes('highlighted handout');
  if(family==='handouts')return t.includes('handout')&&!t.includes('highlighted');
  if(family==='quizzes')return t.includes('quiz');
  if(family==='assignments')return t.includes('assignment');
  if(family==='midterm')return t.includes('midterm');
  if(family==='final')return t.includes('final');
  if(family==='past')return t.includes('past paper');
  if(family==='videos')return t.includes('lecture video')||t==='videos';
  if(family==='references')return t.includes('reference book');
  if(family==='grading')return t.includes('grading');
  if(family==='overview')return t.includes('course overview')||t.includes('course catalogue');
  if(family==='datesheet')return t.includes('date sheet');
  if(family==='results')return t.includes('result');
  if(family==='notes')return t.includes('note');
  return true;
}

function tokenMatches(token,resource,haystack){
  const vs=variants(token);
  const subject=normalize(resource?.subject||'');
  if(resource?.section==='past'&&subject==='all subjects'&&vs.some(v=>SUBJECT_TERMS.has(v)))return true;
  if(resource?.section==='past'&&['portal','past paper'].includes(normalize(resource?.type||''))){
    if(vs.some(v=>['past','paper','papers','examination','archive','historical'].includes(v)))return true;
  }
  return vs.some(v=>haystack.includes(v));
}

function search(resources,query){
  const list=Array.isArray(resources)?resources:[];
  const normalized=normalize(query);
  if(!normalized)return [];

  const code=courseCode(query);
  const family=requestedVuFamily(query);

  if(code){
    const scored=[];
    for(const r of list){
      if(r?.section!=='vu')continue;
      const codes=(r.courseCodes||[]).map(x=>normalize(String(x).replace(/[\s._-]+/g,'')));
      const isCourse=normalize(r.type)==='vu course'&&codes.includes(code);
      if(isCourse){
        scored.push({r,score:120});
        continue;
      }
      const specific=codes.includes(code);
      const generic=!codes.length;
      if(!specific&&!generic)continue;
      if(family&&!vuTypeMatches(r.type,family))continue;
      let score=specific?95:65;
      if(family)score+=15;
      if(normalize(r.source)==='official')score+=4;
      scored.push({r,score});
    }
    if(scored.length){
      return scored.sort((a,b)=>b.score-a.score||String(a.r.title).localeCompare(String(b.r.title))).map(x=>x.r);
    }
  }

  const tokens=normalized.split(' ').filter(Boolean);
  const scored=[];
  for(const r of list){
    const h=normalize(JSON.stringify(r));
    const matched=tokens.filter(t=>tokenMatches(t,r,h));
    if(matched.length!==tokens.length)continue;
    let score=matched.length*10;
    const title=normalize(r.title||''),board=normalize(r.board||''),subject=normalize(r.subject||'');
    for(const t of tokens){
      if(variants(t).some(v=>title.includes(v)))score+=5;
      if(variants(t).some(v=>board.includes(v)))score+=3;
      if(variants(t).some(v=>subject.includes(v)))score+=3;
    }
    if(normalize(r.source)==='official')score+=1;
    scored.push({r,score});
  }
  return scored.sort((a,b)=>b.score-a.score||String(a.r.title).localeCompare(String(b.r.title))).map(x=>x.r);
}

window.EDUNIZAM_LEARNING_SEARCH={normalize,courseCode,search,requestedVuFamily,vuTypeMatches};
})();