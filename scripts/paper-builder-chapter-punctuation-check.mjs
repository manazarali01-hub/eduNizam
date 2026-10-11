/* Regression for exact textbook chapter titles containing commas, quotes,
 * Unicode and punctuation. Data is synthetic and in-memory, never published. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const title='Energy, Light & "Sound" — روشنی';
const course='General Science';
const classes=[{id:'c-1',class_name:'5',section_name:'A',active:true}];
const units=[{id:'u-1',class_name:'5',section_name:'A',subject:course,
 unit_title:title,textbook_title:'Actual School Textbook (fixture)',
 curriculum_board:'punjab-pectaa',status:'Planned'}];
const questions=['mcq','short','long'].flatMap(type=>Array.from({length:9},(_,i)=>({
 id:type+'-'+i,creator_user_id:'teacher-A',class_name:'5',subject:course,
 chapter:title,question_type:type,question_text:type.toUpperCase()+' reviewed '+i,
 options:type==='mcq'?['First','Second','Third','Fourth']:[],
 correct_option:type==='mcq'?0:null,answer_text:'Verified fixture key '+i,
 difficulty:'Balanced',visibility:'private',active:true
})));
const data={class_sections:classes,syllabus_progress_units:units,teacher_question_bank:questions,teacher_papers:[]};
const cfg={enabled:true,institutionId:'school-A'},user={id:'teacher-A'};
const saves=[];
const client={from(table){
 assert(table in data,'Unexpected query table '+table);
 let start=0,end=249,school=null;
 const q={
  select(){return this},eq(k,v){if(k==='institution_id')school=v;return this},
  order(){return this},range(a,b){start=a;end=b;return this},
  insert(payload){
   assert.equal(table,'teacher_papers');
   saves.push(payload);
   data.teacher_papers.push({id:'saved-paper-1',...payload,created_at:'2026-10-11T00:00:00Z'});
   return{select(){return this},async single(){return{data:data.teacher_papers[0],error:null}}};
  },
  then(resolve,reject){
   assert.equal(school,'school-A','Read not institution-scoped');
   return Promise.resolve({data:data[table].slice(start,end+1),error:null}).then(resolve,reject);
  }
 };
 return q;
}};
const map=new Map();
function node(id,initial={}){
 if(map.has(id))return map.get(id);
 let html='';
 const el={value:'',textContent:'',dataset:{},disabled:false,checked:false,isConnected:true,
  classList:{add(){},remove(){},toggle(){}},onclick:null,
  addEventListener(){},querySelectorAll(){return[]},scrollIntoView(){},
  insertAdjacentHTML(_where,value){for(const m of String(value).matchAll(/id="([^"]+)"/g))node('#'+m[1])}};
 Object.defineProperty(el,'innerHTML',{get(){return html},set(v){
  html=String(v);for(const m of html.matchAll(/id="([^"]+)"/g))node('#'+m[1]);
 }});
 Object.assign(el,initial);map.set(id,el);return el;
}
node('#pbClass',{value:'5'});node('#pbSubject',{value:course});
node('#pbSection',{value:'A'});node('#pbChapters');
node('#pbChapterPicker');node('#pbSelectedChapters');
node('#pbMarks',{value:'20'});node('#pbDifficulty',{value:'Balanced'});
node('#pbDistribution',{value:'Balanced'});node('#pbTeacherOnly',{checked:true});
node('#pbConceptDraft',{checked:false});node('#pbBookBoard',{value:'punjab-pectaa'});
node('#pbTitle',{value:'Term Test'});node('#pbAdmin',{checked:false});
node('#pbGenerationStatus');node('#paperPreview');node('#pbSchoolCatalogStatus');
node('#savedTeacherPapers');node('#pbSavedCount');node('#pbSavedSearch');node('#pbSavedClass');
node('#pbClasses');node('#pbSubjects');node('#pbTeacherChapters');
const doc={readyState:'loading',querySelector:s=>map.get(s)||null,
 querySelectorAll:()=>[],addEventListener(){}};
const win={EDUNIZAM_CLOUD:{state:{client,user}},EDUNIZAM_CLOUD_CONFIG:cfg};
const errors=[];
const context={window:win,document:doc,console,Promise,setTimeout,clearTimeout,
 AbortController,localStorage:{getItem:key=>key==='edunizam_session'?JSON.stringify({role:'teacher'}):null},
 alert:msg=>errors.push(String(msg)),confirm:()=>true};
runInNewContext(read('paper-syllabus-audit.js'),context);
runInNewContext(read('teacher-paper-builder.js'),context);
const api=win.EDUNIZAM_PAPER_BUILDER;
await api.loadSchoolCatalog();await api.loadCustomQuestions();await api.loadPapers();
assert(api.schoolChapters('5',course).includes(title),'Textbook chapter missing from dropdown source');
api.writeSelectedChapters(['Matter','Energy']);
assert.equal(map.get('#pbChapters').value,'Matter, Energy','Legacy simple chapter format changed');
assert.deepEqual([...api.readSelectedChapters()],['Matter','Energy']);
api.writeSelectedChapters([title]);
assert.equal(map.get('#pbChapters').value,JSON.stringify([title]),'Punctuated chapter must use lossless array storage');
assert.deepEqual([...api.readSelectedChapters()],[title]);
api.renderSelectedChapters();
assert.deepEqual([...api.readSelectedChapters()],[title],'Chapter chooser split a comma in an official chapter');
assert.match(map.get('#pbSelectedChapters').innerHTML,/Energy, Light/);
assert(!map.get('#pbSelectedChapters').innerHTML.includes('Light & "Sound"'),
 'Selected chapter label inserted unescaped HTML');
assert(api.schoolPaperReadiness('5',course,[title]).allowed,'Exact saved chapter rejected');
const sheet=api.schoolQuestionWorksheet();
assert(sheet.includes('"' + title.replaceAll('"','""') + '"'),'Worksheet lost CSV quoted punctuation');
const result=api.previewPaper();
assert.equal(result.ready,true,'Punctuated chapter preview failed: '+result.reason);
assert.deepEqual([...api.readSelectedChapters()],[title],
 'Paper preview modified the selected exact textbook chapter');
assert.match(map.get('#paperPreview').innerHTML,/Question source:/);
assert.equal(errors.length,0);
await api.savePaper();
assert.equal(saves.length,1,'Selected punctuation chapter was not saved');
assert.deepEqual([...saves[0].chapters],[title],'Saved paper contains broken chapter fragments');
assert.deepEqual([...saves[0].paper_json.topics],[title],'Paper JSON lost exact textbook title');
const source=read('paper-source-import.js');
assert(source.includes('EDUNIZAM_PAPER_BUILDER?.readSelectedChapters?.()'),
 'PDF/photo chapter hint still blindly splits selected comma-containing chapter');
console.log('Chapter punctuation PASS: legacy selection, JSON-encoded comma titles, Urdu/quotes/HTML safety, reviewed preview, CSV worksheet and exact saved paper.');
