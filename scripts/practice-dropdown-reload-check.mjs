/* Browser-like selects: rebuilding options resets value as in native HTML.
   Reopening Practice must preserve legitimate choices; changing class/subject
   must reset stale dependent choices. Authored bank-only topics must appear. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const nodes=new Map();
function node(id){
  if(nodes.has(id))return nodes.get(id);
  const listeners={};
  const x={id,tagName:'SELECT',value:'',textContent:'',disabled:false,checked:false,files:[],
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(name,cb){(listeners[name]??=[]).push(cb)},
    dispatch(name){for(const cb of listeners[name]||[])cb({target:x})},
    querySelectorAll(){return[]},scrollIntoView(){},isConnected:true};
  let html='';
  Object.defineProperty(x,'innerHTML',{get(){return html},set(value){
    html=String(value);
    // Actual HTML select value after replacing all options is the first option.
    if(['practiceStudent','practiceBoard','practiceSubject','practiceChapter'].includes(id)){
      const first=html.match(/<option(?:\s+[^>]*?)?\svalue="([^"]*)"/);
      x.value=first?first[1]:'';
    }
  }});
  nodes.set(id,x);return x;
}
const document={getElementById:node,querySelectorAll:()=>[],querySelector:()=>null};
const local=new Map([['edunizam_students','[]'],['edunizam_practice_history','[]']]);
const window={
 EDUNIZAM_PRACTICE_DATA:{
  boards:['Punjab','Federal'],
  subjects:{'5':['General Science','Mathematics'],'6':['General Science']},
  chapters:{'5|General Science':['Matter'],'5|Mathematics':['Numbers'],'6|General Science':['Energy']},
  questions:[
    {id:'real-1',classLevel:5,subject:'General Science',chapter:'Matter',type:'mcq',difficulty:'Easy',question:'Matter?',options:['A','B'],answer:0},
    {id:'real-2',classLevel:5,subject:'General Science',chapter:'Authored topic not yet in catalog',type:'mcq',difficulty:'Easy',question:'Another?',options:['A','B'],answer:0},
    {id:'real-3',classLevel:5,subject:'Local Ecology',chapter:'Local ecosystems',type:'short',difficulty:'Medium',question:'Explain local ecosystem',answerText:'Explanation'},
    {id:'real-4',classLevel:6,subject:'General Science',chapter:'Energy',type:'mcq',difficulty:'Easy',question:'Energy?',options:['A','B'],answer:0}
  ]
 },
 EDUNIZAM_ROLE_SCOPE:{getVisibleStudents:rows=>rows.filter(x=>x.id!=='denied')}
};
const ctx={window,document,console,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v))},
setInterval:()=>1,clearInterval:()=>{},setTimeout,clearTimeout,alert:m=>{throw Error('Unexpected alert '+m)}};
runInNewContext(read('practice-center.js'),ctx,{filename:'practice-center.js',timeout:5000});
node('practiceClass').value='5';node('practiceClass').dispatch('change');
assert.match(node('practiceSubject').innerHTML,/Local Ecology/,'Genuine authored subjects absent from catalog must appear');
node('practiceSubject').value='General Science';node('practiceSubject').dispatch('change');
assert.match(node('practiceChapter').innerHTML,/Authored topic not yet in catalog/,'Authored question chapter must be selectable');
node('practiceChapter').value='Matter';
node('practiceBoard').value='Punjab';
window.renderPracticeCenter();
assert.equal(node('practiceSubject').value,'General Science','Reopening Practice lost selected subject');
assert.equal(node('practiceChapter').value,'Matter','Reopening Practice lost selected chapter');
assert.equal(node('practiceBoard').value,'Punjab','Reopening Practice lost selected board');
assert.match(node('practiceCoverageStatus').textContent,/exact matching concept question/,'Coverage status missing');
node('practiceSubject').value='Mathematics';node('practiceSubject').dispatch('change');
assert.equal(node('practiceChapter').value,'','Subject change kept stale unrelated chapter');
node('practiceClass').value='6';node('practiceClass').dispatch('change');
assert.equal(node('practiceSubject').value,'','Changing class must clear a previous subject');
assert.equal(node('practiceChapter').value,'','Changing class must clear previous chapter');
node('practiceSubject').value='General Science';node('practiceSubject').dispatch('change');
assert.match(node('practiceChapter').innerHTML,/Energy/,'New class chapter catalog not populated');
assert.doesNotMatch(node('practiceChapter').innerHTML,/Matter/,'Old class chapter leaked into new class');
assert.match(read('app.html'),/id="practiceCoverageStatus"/);
const release=read('feature-loader.js').match(/const VERSION=['"]([^'"]+)['"]/);
assert.ok(release,'Feature loader release token must exist');
assert.ok(read('app.html').includes('feature-loader.js?v='+release[1]),'HTML must load current feature-loader version');
console.log('Practice native-select regression PASS: refresh retention, real-question subjects/chapters, live coverage and dependent reset.');
