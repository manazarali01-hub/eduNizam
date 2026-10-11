import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path,'utf8');
function storage(seed={}){
  const items=new Map(Object.entries(seed));
  return {
    getItem:k=>items.has(k)?items.get(k):null,
    setItem:(k,v)=>items.set(k,String(v)),
    removeItem:k=>items.delete(k),
    clear:()=>items.clear()
  };
}
function deferred(){
  let resolve, reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}
const localSession=()=>JSON.stringify({
  source:'supabase',role:'head',identity:'user@example.test',
  institutionId:'school-A',loginAt:12345,schoolName:'School A'
});
function fakeDocument(){
  const byId=new Map();
  const classList={toggle(){},remove(){},add(){},contains(){return false}};
  const makeNode=()=>({
    style:{},classList,hidden:false,disabled:false,textContent:'',dataset:{},
    setAttribute(){},remove(){byId.delete(this.id)},
    querySelector(selector){
      this.children??=new Map();
      if(!this.children.has(selector))this.children.set(selector,makeNode());
      return this.children.get(selector);
    }
  });
  return {
    readyState:'loading',hidden:false,
    documentElement:{classList,dataset:{}},
    body:{classList,appendChild:node=>byId.set(node.id,node)},
    head:{appendChild:node=>byId.set(node.id,node)},
    createElement:()=>makeNode(),
    getElementById:id=>byId.get(id)||null,
    querySelector:()=>null,
    addEventListener(){}
  };
}
function environment(script,{local={},cloud=null}={}){
  const localStorage=storage(local),sessionStorage=storage();
  const handlers=new Map();
  const window={
    EDUNIZAM_CLOUD:cloud,
    addEventListener:(type,handler)=>{
      handlers.set(type,[...(handlers.get(type)||[]),handler]);
    },
    dispatchEvent:event=>{
      for(const fn of handlers.get(event.type)||[])fn(event);
    }
  };
  const doc=fakeDocument();
  const context={
    window,document:doc,localStorage,sessionStorage,navigator:{onLine:true},
    CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail}},
    setTimeout,clearTimeout,Date,console,
    matchMedia:()=>({matches:false}),setInterval:()=>0
  };
  vm.runInNewContext(read(script),context,{filename:script});
  return {window,doc,localStorage,sessionStorage};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const row={id:'school-A',name:'School A',workspace_role:'head_of_institute'};

// Regression 1: automatic recovery does not restore an identity or institution
// after a deliberate sign-out, including from a pre-upgrade backup snapshot.
{
  const e=environment('reliability-guardian.js',{local:{
    edunizam_session:localSession(),
    edunizam_cloud_runtime_config:JSON.stringify({institutionId:'school-A'}),
    edunizam_settings:'{"theme":"light"}'
  }});
  const g=e.window.EDUNIZAM_RELIABILITY;
  assert.equal(g.snapshotCriticalState('Regression fixture'),true);
  const snapshot=JSON.parse(e.sessionStorage.getItem('edunizam_reliability_backup_v1'));
  assert.ok(!('edunizam_session' in snapshot.items));
  assert.ok(!('edunizam_cloud_runtime_config' in snapshot.items));
  // Old snapshots remain dangerous unless restoreCriticalState filters them.
  e.sessionStorage.setItem('edunizam_reliability_backup_v1',JSON.stringify({items:{
    edunizam_session:localSession(),
    edunizam_cloud_runtime_config:'{"institutionId":"school-A"}',
    edunizam_settings:'{"theme":"light"}'
  }}));
  for(const key of ['edunizam_session','edunizam_cloud_runtime_config','edunizam_settings'])e.localStorage.removeItem(key);
  assert.equal(g.restoreCriticalState(),true);
  assert.equal(e.localStorage.getItem('edunizam_session'),null);
  assert.equal(e.localStorage.getItem('edunizam_cloud_runtime_config'),null);
  assert.equal(e.localStorage.getItem('edunizam_settings'),'{"theme":"light"}');
}

// Regression 2: account signed out while the initial authorized-schools RPC
// is pending must not silently recreate the signed-out local workspace.
{
  const workspaces=deferred();
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    listAuthorizedWorkspaces:()=>workspaces.promise
  };
  const e=environment('auth-bridge.js',{cloud});
  await e.window.EDUNIZAM_AUTH_BRIDGE.boot();
  await flush();
  cloud.state.user=null;
  cloud.state.authEvent='SIGNED_OUT';
  e.window.dispatchEvent({type:'edunizam:auth',detail:{event:'SIGNED_OUT'}});
  workspaces.resolve([row]);
  await flush();
  assert.equal(e.localStorage.getItem('edunizam_session'),null);
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'UNAUTHENTICATED');
}

// Regression 3: a late access-validation response after sign-out cannot
// unlock the workspace or recreate an authenticated local session.
{
  const access=deferred();
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>access.promise
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  const result=e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true);
  await flush();
  cloud.state.user=null;
  cloud.state.authEvent='SIGNED_OUT';
  e.window.dispatchEvent({type:'edunizam:auth',detail:{event:'SIGNED_OUT'}});
  access.resolve(row);
  assert.equal(await result,false);
  assert.equal(e.localStorage.getItem('edunizam_session'),null);
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'UNAUTHENTICATED');
}

// Regression 4: an old account's authorization must not overwrite a new
// school's handoff, even if both operations finish successfully.
{
  const access=deferred();
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>access.promise
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  const result=e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true);
  await flush();
  const newer={...JSON.parse(localSession()),identity:'second@example.test',institutionId:'school-B',loginAt:54321};
  e.localStorage.setItem('edunizam_session',JSON.stringify(newer));
  cloud.state.user={id:'user-2',email:newer.identity};
  cloud.state.authEvent='SIGNED_IN';
  access.resolve(row);
  assert.equal(await result,false);
  assert.equal(JSON.parse(e.localStorage.getItem('edunizam_session')).institutionId,'school-B');
}

// Regression 5: an outstanding Supabase getSession() cannot resurrect a
// logged-out account or overwrite another account that signed in meanwhile.
// This tests the shared admissions-cloud client, not just the UI auth bridge.
function makeCloudRestoreRace({timeoutFirst=false}={}){
  const pending=deferred();
  let authHandler=null;
  const client={auth:{
    onAuthStateChange(handler){authHandler=handler;return{data:{subscription:{unsubscribe(){}}}}},
    getSession(){return pending.promise}
  }};
  const win={
    EDUNIZAM_CLOUD_CONFIG:{enabled:true,provider:'supabase',supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test-public-key'},
    supabase:{createClient:()=>client},
    dispatchEvent(){}
  };
  const context={window:win,console,
    CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail}},
    setTimeout:timeoutFirst?fn=>{setImmediate(fn);return 1}:setTimeout,
    clearTimeout:timeoutFirst?()=>{}:clearTimeout
  };
  vm.runInNewContext(read('admissions-cloud.js'),context,{filename:'admissions-cloud.js'});
  return{window:win,pending,auth:(event,session)=>{assert.ok(authHandler);authHandler(event,session)}};
}
{
  const e=makeCloudRestoreRace();
  await flush();
  e.auth('SIGNED_OUT',null);
  e.pending.resolve({data:{session:{user:{id:'old-account',email:'old@example.test'}}}});
  await e.window.EDUNIZAM_CLOUD.whenReady();
  assert.equal(e.window.EDUNIZAM_CLOUD.state.user,null,'A stale restore resurrected a signed-out account');
  assert.equal(e.window.EDUNIZAM_CLOUD.state.sessionRestoreStatus,'absent');
}
{
  const e=makeCloudRestoreRace();
  await flush();
  e.auth('SIGNED_IN',{user:{id:'new-account',email:'new@example.test'}});
  e.pending.resolve({data:{session:{user:{id:'old-account',email:'old@example.test'}}}});
  await e.window.EDUNIZAM_CLOUD.whenReady();
  assert.equal(e.window.EDUNIZAM_CLOUD.state.user?.id,'new-account','Stale initial restore replaced the new login');
}
{
  const e=makeCloudRestoreRace({timeoutFirst:true});
  await e.window.EDUNIZAM_CLOUD.whenReady();
  e.auth('SIGNED_OUT',null);
  e.pending.resolve({data:{session:{user:{id:'old-account'}}}});
  await flush();
  assert.equal(e.window.EDUNIZAM_CLOUD.state.user,null,'Late restore after timeout resurrected signed-out account');
  assert.equal(e.window.EDUNIZAM_CLOUD.state.sessionRestoreStatus,'absent');
}

assert.match(read('app.html'),/admissions-cloud\.js\?v=20261011-session-epoch-v46/);
assert.match(read('app.html'),/auth-bridge\.js\?v=20261010-auth-race-v1/);
assert.match(read('app.html'),/reliability-guardian\.js\?v=20261010-auth-race-v1/);
assert.match(read('sw.js'),/edunizam-v278-session-epoch-v46/);
assert.match(read('system-auto-update.js'),/edunizam-v278-session-epoch-v46/);
console.log('Auth isolation, sign-out races, school-switch races and PWA cache checks passed.');
