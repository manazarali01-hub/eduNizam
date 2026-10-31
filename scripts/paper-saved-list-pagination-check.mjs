/* Paper history must page beyond the newest 100 and never display private
   paper cards from a previous institution. In-memory mocked database only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../teacher-paper-builder.js',import.meta.url),'utf8');
const mk=(i,owner='ownerA')=>({id:'paper-'+String(i).padStart(4,'0'),
 title:i===5?'ARCHIVED OLDER PAPER':'Paper '+i,creator_user_id:owner,
 class_name:'5',subject:'General Science',chapters:['Matter'],
 total_marks:20,difficulty:'Balanced',visibility:'private',
 created_at:new Date(Date.UTC(2026,0,1+i)).toISOString(),paper_json:{}});
const records={A:Array.from({length:305},(_,i)=>mk(i)),B:[mk(999,'ownerB')]};
const requests=[];let failSecondPage=false,holdSchoolB=null;
const cfg={institutionId:'A'},user={id:'ownerA'};
const client={from(table){
 assert.equal(table,'teacher_papers');
 let school='',from=0,to=249;
 return{
  select(){return this},
  eq(key,value){if(key==='institution_id')school=value;return this},
  order(){return this},
  range(a,b){from=a;to=b;return this},
  then(resolve,reject){
   requests.push({school,from,to});
   if(failSecondPage&&from===250)return Promise.resolve({error:{message:'denied'}}).then(resolve,reject);
   if(school==='B'&&holdSchoolB)return holdSchoolB.promise.then(resolve,reject);
   return Promise.resolve({data:(records[school]||[]).slice(from,to+1),error:null}).then(resolve,reject);
  }
 }
}};
const list={innerHTML:''},counter={textContent:'0 papers'},preview={innerHTML:'Sensitive paper preview'};
const els={'#savedTeacherPapers':list,'#pbSavedCount':counter,'#paperPreview':preview,
 '#pbSavedSearch':{value:''},'#pbSavedClass':{value:''}};
const document={readyState:'loading',addEventListener(){},
 querySelector:k=>els[k]||null,querySelectorAll:()=>[]};
const window={EDUNIZAM_CLOUD_CONFIG:cfg,EDUNIZAM_CLOUD:{state:{user,client}}};
runInNewContext(source,{window,document,console,localStorage:{getItem:()=>null},
 setTimeout,clearTimeout,AbortController,Promise},{filename:'teacher-paper-builder.js'});
const app=window.EDUNIZAM_PAPER_BUILDER;
await app.loadPapers();
assert.equal(counter.textContent,'305 papers','Saved list still truncates older papers');
assert(requests.some(x=>x.school==='A'&&x.from===250),'Second page was never fetched');
assert.match(list.innerHTML,/Showing newest 100 of 305/,'Huge saved-paper list was not constrained for mobile');
assert.doesNotMatch(list.innerHTML,/ARCHIVED OLDER PAPER/,'Old paper should be findable through search rather than rendering all cards');
els['#pbSavedSearch'].value='ARCHIVED OLDER PAPER';
await app.loadPapers();
assert.match(list.innerHTML,/ARCHIVED OLDER PAPER/,'Search did not find a paper beyond the first hundred');
assert.equal(counter.textContent,'1 paper');
els['#pbSavedSearch'].value='';
// Incomplete second page is NOT a 250-paper success.
failSecondPage=true;
await app.loadPapers();
assert.match(list.innerHTML,/could not be verified completely/);
assert.equal(counter.textContent,'0 papers');
failSecondPage=false;
await app.loadPapers();
assert.match(list.innerHTML,/Paper 304/);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
const late=deferred();holdSchoolB=late;
cfg.institutionId='B';user.id='ownerB';
const pending=app.loadPapers();
assert.doesNotMatch(list.innerHTML,/Paper 304|ARCHIVED OLDER PAPER/,
 'Previous school saved-papers cards remained visible during an in-flight switch');
assert.equal(preview.innerHTML,'','Previous school paper editor remained visible on account switch');
assert.equal(counter.textContent,'0 papers');
late.resolve({data:records.B,error:null});
await pending;
assert.match(list.innerHTML,/Paper 999/,'Current-school papers not loaded');
assert.doesNotMatch(list.innerHTML,/Paper 304/,'Former school history leaked');
assert(requests.filter(x=>x.school==='B').length===1,'School switch issued unscoped or redundant reads');
console.log('Saved paper full history PASS: >300 pages, older search, 100-card mobile cap, failed second-page closed and immediate school-switch purge.');
