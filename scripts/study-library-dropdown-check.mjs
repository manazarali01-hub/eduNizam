/* Study Library source/options regression with real DOM-like select state.
 * Official multi-subject sources must be filterable without invented books. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../study-library.js',import.meta.url),'utf8');
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const values=new Map();
const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))};
const nodes=new Map();
function el(id){
 if(!nodes.has(id)){
  let html='',value='';
  const listeners=new Map();
  nodes.set(id,{
   id,onclick:null,disabled:false,style:{},textContent:'',classList:{add(){},remove(){},toggle(){}},
   addEventListener:(name,fn)=>listeners.set(name,fn),
   dispatchEvent:event=>listeners.get(event.type)?.(event),
   set innerHTML(x){html=String(x);value=''},
   get innerHTML(){return html},
   set value(x){value=String(x)},
   get value(){return value}
  });
 }
 return nodes.get(id);
}
const document={getElementById:el,querySelectorAll:()=>[]};
const materials=[
 {id:'core-math',board:'Punjab · PECTAA',classLevels:[9],subject:'Mathematics',type:'Textbook',title:'Official Class Nine Maths',source:'official',url:'https://example.org/math'},
 {id:'general-hub',board:'Punjab PECTAA',classLevels:[9],subject:'All Subjects',type:'Directory',title:'Punjab Curriculum Directory',source:'official',url:'https://example.org/general'},
 {id:'federal-bundle',board:'Punjab PECTAA',classLevels:[9],subject:'Biology / Chemistry / Computer Science / Mathematics / Physics',type:'Scheme',title:'Class Nine Multi Subject Scheme',source:'official',url:'https://example.org/bundle'},
 {id:'math-physics',board:'Punjab PECTAA',classLevels:[9],subject:'Mathematical Physics',type:'Textbook',title:'Separate Mathematical Physics',source:'official',url:'https://example.org/math-physics'},
 {id:'sindh-chem',board:'Sindh STBB',classLevels:[9],subject:'Chemistry',type:'Textbook',title:'Sindh Chemistry Book',source:'official',url:'https://example.org/sindh'}
];
const window={EDUNIZAM_STUDY_DATA:{materials},EDUNIZAM_PAST_PAPERS:{boards:[]},EDUNIZAM_CURRICULUM_REGISTRY:{authorities:[]}};
const ctx={window,document,localStorage,console,setTimeout:()=>0,clearTimeout:()=>{}};
runInNewContext(src,ctx,{filename:'study-library.js',timeout:3000});
const api=window.EDUNIZAM_STUDY_FILTERS;
check(!!api,'Study Library subject options helper is missing');
check(api.materialMatchesBoard(materials[0],'Punjab PECTAA'),'Punctuation variant hides matching official books');
check(api.materialMatchesBoard(materials[0],'Punjab · PECTAA'),'Existing board label matching regressed');
check(!api.materialMatchesBoard(materials[4],'Punjab PECTAA'),'Cross-authority source leakage');
check(!api.materialMatchesBoard({board:'مظفرگڑھ بورڈ'},'گوجرانوالہ بورڈ'),'Non-Latin board names collided');
const list=api.subjectOptions('9','Punjab PECTAA');
for(const label of ['Mathematics','Biology','Chemistry','Physics','Computer Science'])check(list.includes(label),'Missing indexed subject: '+label);
check(!list.includes('All Subjects'),'Generic directory became a duplicate subject option');
check(!list.includes('Sindh Chemistry Book'),'Other authority source became a subject');
check(list.filter(x=>x==='Mathematics').length===1,'A subject was duplicated by multiple official sources');
check(api.materialSubjectMatches('Maths','Mathematics'),'Maths alias did not resolve to Mathematics');
check(api.materialSubjectMatches('Chemistry',materials[2].subject),'Bundled official chemistry resource not selectable');
check(!api.materialSubjectMatches('Chemistry','Biochemistry'),'Substring matching exposed unrelated course');
check(!api.materialSubjectMatches('Math','Mathematical Physics'),'Math alias matched unrelated mathematical-physics title');
check(api.materialSubjectMatches('Chemistry','All Subjects'),'General curriculum directory must still appear');
el('studyClass').value='9';
el('studyBoard').value='Punjab PECTAA';
el('studyClass').dispatchEvent({type:'change'});
const options=el('studySubject').innerHTML;
check((options.match(/>All Subjects<\/option>/g)||[]).length===1,'Duplicate All Subjects option in UI');
check(options.includes('>Chemistry</option>')&&options.includes('>Mathematics</option>'),'Study subject select does not show usable subject options');
el('studySubject').value='Chemistry';
window.renderStudyLibrary();
const chemistry=el('studyLibrary').innerHTML;
check(chemistry.includes('Class Nine Multi Subject Scheme')&&chemistry.includes('Punjab Curriculum Directory'),'Chemistry filter hides genuine combined/general resources');
check(!chemistry.includes('Official Class Nine Maths')&&!chemistry.includes('Sindh Chemistry Book'),'Chemistry filter shows unrelated or other-board resources');
el('studySubject').value='Mathematics';
window.renderStudyLibrary();
const math=el('studyLibrary').innerHTML;
check(math.includes('Official Class Nine Maths')&&math.includes('Class Nine Multi Subject Scheme'),'Mathematics filter hides exact/bundled resource');
check(!math.includes('Separate Mathematical Physics'),'Mathematics filter incorrectly matched another subject');
console.log('EduNizam Study Library dropdown PASS: no duplicate All Subjects, official multi-subject schemes, grade and board aliases, subject isolation.');
