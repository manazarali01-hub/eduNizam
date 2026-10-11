/* A late query must never paint School A's private saved papers into School B.
 * All fixtures are in memory. No production school data is accessed or changed. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../teacher-paper-builder.js',import.meta.url),'utf8');
const requests=[];
const cfg={institutionId:'school-A'};
const cloud={state:{user:{id:'user-A'},client:{
 from(table){
  assert.equal(table,'teacher_papers');
  let school=null;
  return {
   select(){return this},
   eq(key,value){if(key==='institution_id')school=value;return this},
   order(){return this},
   limit(){return new Promise(resolve=>requests.push({school,resolve}))}
  };
 }
}}};
const list={innerHTML:''},counter={textContent:'0 papers'};
const els={'#savedTeacherPapers':list,'#pbSavedCount':counter,
 '#pbSavedSearch':{value:''},'#pbSavedClass':{value:''}};
const document={readyState:'loading',addEventListener(){},
 querySelector:key=>els[key]||null,querySelectorAll:()=>[]};
const window={EDUNIZAM_CLOUD:cloud,EDUNIZAM_CLOUD_CONFIG:cfg};
runInNewContext(source,{window,document,console,localStorage:{getItem:()=>null},
 setTimeout,clearTimeout,AbortController,Promise},{filename:'teacher-paper-builder.js'});
const api=window.EDUNIZAM_PAPER_BUILDER;
assert.equal(typeof api.loadPapers,'function');

const record=(id,title,owner)=>({id,title,creator_user_id:owner,
 class_name:'5',subject:'Science',chapters:['Matter'],total_marks:20,
 difficulty:'Balanced',visibility:'private',created_at:'2026-10-11T00:00:00Z',
 paper_json:{}});
const paperA=record('paper-A','PRIVATE A PAPER','user-A');
const paperB=record('paper-B','VISIBLE B PAPER','user-B');

const old=api.loadPapers();
assert.equal(requests[0].school,'school-A');
cfg.institutionId='school-B';cloud.state.user={id:'user-B'};
const current=api.loadPapers();
assert.equal(requests[1].school,'school-B');
requests[1].resolve({data:[paperB],error:null});
await current;
assert.match(list.innerHTML,/VISIBLE B PAPER/);
assert.doesNotMatch(list.innerHTML,/PRIVATE A PAPER/);
requests[0].resolve({data:[paperA],error:null});
await old;
assert.match(list.innerHTML,/VISIBLE B PAPER/,'Old-school response erased current school papers');
assert.doesNotMatch(list.innerHTML,/PRIVATE A PAPER/,'School A papers leaked into School B view');

// Even within the same account, a later search must win over an earlier query.
const olderSearch=api.loadPapers(),newerSearch=api.loadPapers();
assert.equal(requests[2].school,'school-B');
requests[3].resolve({data:[paperB],error:null});
await newerSearch;
requests[2].resolve({data:[paperA],error:null});
await olderSearch;
assert.doesNotMatch(list.innerHTML,/PRIVATE A PAPER/,'Older query overwrote the fresh list');

// Sign-out while loading must blank old content and reject late private data.
const duringSignOut=api.loadPapers();
cloud.state.user=null;
await api.loadPapers();
assert.match(list.innerHTML,/Sign in to the school workspace/);
requests[4].resolve({data:[paperB],error:null});
await duringSignOut;
assert.doesNotMatch(list.innerHTML,/VISIBLE B PAPER/,'Late response displayed after sign-out');
assert.equal(counter.textContent,'0 papers');
console.log('Paper list isolation PASS: account changes, same-school request races, and sign-out keep old papers hidden.');
