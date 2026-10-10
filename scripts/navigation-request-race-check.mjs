import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const begin=source.indexOf('let latestViewRequest=0;');
const marker='window.EDUNIZAM_APP_NAV={setView};';
const finish=source.indexOf(marker,begin);
assert.ok(begin!==-1&&finish!==-1,'Request-scoped navigation function must exist');
assert.match(source,/navRoot\?\.addEventListener\('click'/,'Dynamic navigation buttons must use click delegation');
assert.match(source,/if\(opened&&targetView==='students'\)/,'Jump shortcuts must await successful navigation');

function deferred(){
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b});
  return {promise,resolve,reject};
}
function classes(initial=[]){
  const values=new Set(initial);
  return {
    add(...list){list.forEach(v=>values.add(v))},
    remove(...list){list.forEach(v=>values.delete(v))},
    contains(v){return values.has(v)},
    toggle(v,force){const add=force===undefined?!values.has(v):!!force;add?values.add(v):values.delete(v);return add}
  };
}
function node(id,initial=[]){
  return {id,children:[],classList:classes(initial),dataset:{},textContent:'',
    setAttribute(){},removeAttribute(){},
    prepend(child){child.parent=this;this.children.unshift(child)},
    closest(){return null}
  };
}
function harness(pending){
  const targets={dashboard:node('dashboard',['view','active']),settings:node('settings',['view'])};
  const navItems=Object.fromEntries(Object.keys(targets).map(id=>[id,{
    dataset:{view:id},textContent:id,setAttribute(){},removeAttribute(){},closest(){return null},
    classList:classes()
  }]));
  const title=node('page-title');
  const events=[],toasts=[];
  const document={
    querySelectorAll(selector){
      if(selector==='.view')return Object.values(targets);
      if(selector==='.nav-item')return Object.values(navItems);
      return [];
    },
    querySelector(selector){const found=/^\[data-view="([^"]+)"\]$/.exec(selector);return found?navItems[found[1]]||null:null},
    createElement(){
      const el={className:'',innerHTML:'',parent:null,setAttribute(){},querySelector(){return null},
        remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null}}};
      el.classList={contains(name){return el.className.split(/\s+/).includes(name)}};
      return el;
    }
  };
  const window={
    EDUNIZAM_ROLE_SCOPE:{canView:()=>true},
    EDUNIZAM_FEATURE_LOADER:{
      isReady:view=>view==='dashboard',
      ensure:view=>pending.promise
    },
    EDUNIZAM_PREMIUM:{toast:(...args)=>toasts.push(args)},
    dispatchEvent:e=>events.push(e.detail.view)
  };
  const context={document,window,$:id=>targets[id]||({'page-title':title})[id]||null,
    console,requestAnimationFrame:cb=>cb(),
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail}}
  };
  vm.runInNewContext(source.slice(begin,finish+marker.length),context,{filename:'app-navigation-under-test.js'});
  return {...window.EDUNIZAM_APP_NAV,events,toasts,targets};
}

// Slow success must not render or announce an abandoned section.
{
  const d=deferred(),h=harness(d);
  const old=h.setView('settings');
  await Promise.resolve();
  assert.equal(await h.setView('dashboard'),true);
  d.resolve();
  assert.equal(await old,false);
  assert.deepEqual(h.events,['dashboard']);
  assert.equal(h.targets.dashboard.classList.contains('active'),true);
  assert.equal(h.targets.settings.children.length,0,'Abandoned loading spinner should be removed');
}
// A rejected, already-abandoned load must not show an obsolete Retry or error toast.
{
  const d=deferred(),h=harness(d);
  const old=h.setView('settings');
  await Promise.resolve();
  await h.setView('dashboard');
  d.reject(new Error('offline'));
  assert.equal(await old,false);
  assert.deepEqual(h.events,['dashboard']);
  assert.equal(h.toasts.length,0);
  assert.equal(h.targets.settings.children.length,0);
}
// A current section must still open after its script finishes.
{
  const d=deferred(),h=harness(d);
  const opening=h.setView('settings');
  await Promise.resolve();
  d.resolve();
  assert.equal(await opening,true);
  assert.deepEqual(h.events,['settings']);
  assert.equal(h.targets.settings.classList.contains('active'),true);
  assert.equal(h.targets.settings.children.length,0);
}
console.log('PASS: navigation loading races, stale failures, latest section and click delegation guards');
