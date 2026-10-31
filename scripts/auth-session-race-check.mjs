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
  const listeners=new Map();
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
    addEventListener(type,handler){listeners.set(type,[...(listeners.get(type)||[]),handler])},
    dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event)}
  };
}
function environment(script,{local={},cloud=null,online=true}={}){
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
    window,document:doc,localStorage,sessionStorage,navigator:{onLine:online},
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

// Regression 6: a matching auth event must preserve the short-lived login handoff
// that the login flow has already verified, without weakening account-change guards.
{
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:async()=>row
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  const now=Date.now();
  e.sessionStorage.setItem('edunizam_secure_login_handoff',JSON.stringify({
    version:2,nonce:'verified-handoff',userId:'user-1',institutionId:'school-A',role:'head',at:now,expiresAt:now+120000
  }));
  e.window.EDUNIZAM_AUTH_BRIDGE.boot();
  const timer=e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verificationTimer;
  if(timer)clearTimeout(timer);
  e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verificationTimer=0;
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'WORKSPACE_READY');
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null);

  e.window.dispatchEvent({type:'edunizam:auth',detail:{
    event:'SIGNED_IN',user:{id:'user-1',email:'user@example.test'}
  }});
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null,
    'Matching SIGNED_IN event must not revoke a verified login handoff');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'WORKSPACE_READY');

  e.window.dispatchEvent({type:'edunizam:auth',detail:{
    event:'USER_UPDATED',user:{id:'user-1',email:'user@example.test'}
  }});
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'USER_UPDATED must still trigger fresh workspace authorization');
  const pending=e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verificationTimer;
  if(pending)clearTimeout(pending);
  e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verificationTimer=0;
}

// Regression 6: an auth lifecycle event must cover an already-open private
// workspace synchronously, before the scheduled authorization check can run.
{
  const nextAccess=deferred();
  let accessCalls=0;
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:async()=>{
      accessCalls++;
      return accessCalls===1?row:nextAccess.promise;
    }
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  assert.equal(await e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true),true);
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'WORKSPACE_READY');
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null);

  e.window.dispatchEvent({type:'edunizam:auth',detail:{
    event:'SIGNED_IN',user:{id:'user-1',email:'user@example.test'}
  }});
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Auth event left the previously open private workspace uncovered');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'AUTHORIZING');

  await flush();
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Private workspace guard disappeared while authorization was pending');
  nextAccess.resolve(row);
  // Let the zero-delay verification timer and its async authorization chain
  // settle deterministically on slower CI runners.
  for(let i=0;i<20&&e.doc.getElementById('cloudAuthScreen');i++){
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  await flush();
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null,
    'Successful fresh authorization should release the guard');
}
 
// Regression 6: a stale verification finishing after sign-out must not clear
// the newer account's in-flight verification promise and permit duplicate RPCs.
{
  const accesses=[];
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>{
      const d=deferred();
      accesses.push(d);
      return d.promise;
    }
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  const oldVerification=e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true);
  await flush();
  assert.equal(accesses.length,1);
  cloud.state.user=null;
  cloud.state.authEvent='SIGNED_OUT';
  e.window.dispatchEvent({type:'edunizam:auth',detail:{event:'SIGNED_OUT'}});
  const nextSession={...JSON.parse(localSession()),identity:'new@example.test',loginAt:67890};
  e.localStorage.setItem('edunizam_session',JSON.stringify(nextSession));
  cloud.state.user={id:'user-2',email:'new@example.test'};
  cloud.state.authEvent='SIGNED_IN';
  const newVerification=e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true);
  await flush();
  assert.equal(accesses.length,2);
  const owned=e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verification;
  accesses[0].resolve(row);
  assert.equal(await oldVerification,false);
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verification,owned,
    'A stale verification cleared the newer account verification lock');
  accesses[1].resolve({...row,id:'school-A'});
  assert.equal(await newVerification,true);
}

// Regression 7: logout closes the local private workspace before the remote
// Supabase sign-out promise settles, so a slow network cannot leave the UI open.
{
  const remoteSignOut=deferred();
  let signOutStarted=false;
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},authEvent:'SIGNED_IN',sessionRestoreStatus:'active'},
    signOut:()=>{signOutStarted=true;return remoteSignOut.promise}
  };
  const e=environment('auth-bridge.js',{cloud,local:{
    edunizam_session:localSession(),
    edunizam_cloud_runtime_config:'{"institutionId":"school-A"}'
  }});
  e.doc.dispatchEvent({
    type:'click',
    target:{closest:selector=>selector==='#roleSession button'?{}:null},
    preventDefault(){}
  });
  assert.equal(e.localStorage.getItem('edunizam_session'),null,
    'Local authenticated session remained while remote sign-out was pending');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'UNAUTHENTICATED',
    'Workspace UI was not locked immediately on logout');
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Logout did not render the private-workspace guard');
  e.doc.dispatchEvent({type:'visibilitychange'});
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Returning to a visible tab removed the guard after logout');
  await flush();
  assert.equal(signOutStarted,true,'Remote Supabase sign-out was not started');
  remoteSignOut.resolve();
  await flush();
}

// Regression 8: a successful session restore that finishes after the
// startup timeout must re-verify an existing local workspace.
{
  let verified=0;
  const cloud={
    state:{client:{},user:null,sessionRestoreStatus:'timeout',authEvent:'INITIAL_SESSION'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:async()=>{verified++;return row}
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  assert.equal(await e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true),false,
    'An uncertain online session restore unlocked the cached workspace');
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'The private-workspace guard was not retained while session restore was uncertain');
  assert.equal(verified,0,'Unresolved initial restore unexpectedly queried workspace access');
  cloud.state.user={id:'user-1',email:'user@example.test'};
  cloud.state.sessionRestoreStatus='active';
  e.window.dispatchEvent({type:'edunizam:cloud-ready',detail:{event:'LATE_SESSION_RESTORE',user:cloud.state.user}});
  await flush();
  await flush();
  assert.equal(verified,1,'Late session restore did not trigger workspace authorization');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.detail.userId,'user-1');
}

// Regression 9: a late restored user with no local workspace must not remain
// stranded at the login guard when exactly one authorized school is available.
{
  let restoreCalls=0;
  const cloud={
    state:{client:{},user:null,sessionRestoreStatus:'timeout',authEvent:'INITIAL_SESSION'},
    whenReady:async()=>cloud,
    listAuthorizedWorkspaces:async()=>{restoreCalls++;return [row]}
  };
  const e=environment('auth-bridge.js',{cloud});
  await e.window.EDUNIZAM_AUTH_BRIDGE.boot();
  await flush();
  assert.equal(e.localStorage.getItem('edunizam_session'),null);
  cloud.state.user={id:'user-1',email:'user@example.test'};
  cloud.state.sessionRestoreStatus='active';
  e.window.dispatchEvent({type:'edunizam:cloud-ready',detail:{event:'LATE_SESSION_RESTORE',user:cloud.state.user}});
  await flush();
  await flush();
  assert.equal(restoreCalls,1,'Late restored user did not fetch authorized workspaces');
  assert.equal(JSON.parse(e.localStorage.getItem('edunizam_session')).institutionId,'school-A');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'WORKSPACE_READY');
}

// Regression 10: a late session restore failure must not leave an online
// browser displaying a private workspace from an unverified local cache.
{
  const cloud={
    state:{client:{},user:null,sessionRestoreStatus:'timeout',authEvent:'INITIAL_SESSION'},
    whenReady:async()=>cloud
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  assert.equal(await e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true),false,
    'An uncertain online restore incorrectly authorized the cached workspace');
  assert.notEqual(e.localStorage.getItem('edunizam_session'),null,
    'Local metadata should remain available for a legitimate late restore');
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Private workspace guard was missing before the late restore error');
  cloud.state.sessionRestoreStatus='error';
  e.window.dispatchEvent({type:'edunizam:cloud-ready',detail:{event:'LATE_SESSION_RESTORE_ERROR',user:null}});
  await flush();
  await flush();
  assert.equal(e.localStorage.getItem('edunizam_session'),null,'Failed online session restore retained a private local workspace');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'AUTH_ERROR');
}

// Regression 11: startup with cached identity must keep private UI covered
// until live workspace authorization succeeds.
{
  const access=deferred();
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>access.promise
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  await e.window.EDUNIZAM_AUTH_BRIDGE.boot();
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Startup exposed the cached private workspace before authorization');
  const verification=e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true);
  await flush();
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Pending school authorization removed the private-workspace guard');
  access.resolve(row);
  assert.equal(await verification,true);
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null,
    'Successful workspace authorization did not unlock the workspace');
}

// Regression 12: a classified network timeout must not expose cached private
// workspace UI while the browser still reports that it is online.
{
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:async()=>{throw new Error('simulated authorization timeout')}
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  e.window.EDUNIZAM_DATA_RUNTIME={classify:()=> 'NETWORK_TIMEOUT',run:async(_key,fn)=>fn()};
  assert.equal(await e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true),false,
    'Online authorization timeout incorrectly enabled offline-cache workspace access');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'AUTH_ERROR',
    'Online authorization timeout did not fail closed');
  assert.equal(e.localStorage.getItem('edunizam_session'),null,
    'Online authorization timeout retained local private-workspace authorization');
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Online authorization timeout removed the private-workspace guard');
}


// Regression 13: an explicitly offline browser may still use the supported
// cached workspace path when workspace authorization fails with a network
// timeout; this must remain distinct from an online timeout (Regression 12).
{
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:async()=>{throw new Error('simulated authorization timeout')}
  };
  const e=environment('auth-bridge.js',{
    cloud,
    local:{edunizam_session:localSession()},
    online:false
  });
  e.window.EDUNIZAM_DATA_RUNTIME={classify:()=> 'NETWORK_TIMEOUT',run:async(_key,fn)=>fn()};
  assert.equal(await e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true),true,
    'Explicitly offline browser lost the supported cached workspace path');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'OFFLINE_READY',
    'Explicitly offline workspace was not marked offline-ready');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.detail.source,'offline-cache',
    'Explicitly offline timeout did not use the offline-cache path');
  assert.notEqual(e.localStorage.getItem('edunizam_session'),null,
    'Explicitly offline path unexpectedly cleared local session metadata');
}

// Regression 14: auth lifecycle events must not remove the private-workspace
// guard before the current account's access to the selected school is verified.
{
  const access=deferred();
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>access.promise
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  await e.window.EDUNIZAM_AUTH_BRIDGE.boot();
  await flush();
  await flush();
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Startup guard missing while school authorization was pending');
  e.window.dispatchEvent({type:'edunizam:auth',detail:{
    event:'SIGNED_IN',user:{id:'user-1',email:'user@example.test'}
  }});
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'SIGNED_IN event exposed private workspace before access verification');
  access.resolve(row);
  // Authorization includes several async boundaries (cloud readiness, RPC,
  // and state reconciliation); wait boundedly rather than assuming two ticks.
  for(let i=0;i<20&&e.doc.getElementById('cloudAuthScreen');i++){
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  await flush();
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null,
    'Verified school authorization did not remove the guard');
}
 
assert.match(read('app.html'),/admissions-cloud\.js\?v=20261011-session-epoch-v46/);
assert.match(read('app.html'),/auth-bridge\.js\?v=20261020-auth-event-guard-v2/);
assert.match(read('app.html'),/reliability-guardian\.js\?v=20261010-auth-race-v1/);
assert.match(read('sw.js'),/edunizam-v282-auth-event-guard-v2/);
assert.match(read('system-auto-update.js'),/edunizam-v282-auth-event-guard-v2/);
assert.match(read('system-auto-update.js'),/20261020-auth-event-guard-v2/);
assert.ok(read('pwa-install.js').includes('sw.js?v=20261020-auth-event-guard-v2'));
// Regression 15: USER_UPDATED must trigger a real fresh authorization check,
// not merely cover the UI and leave the verified login handoff stuck.
{
  const access=deferred();
  let accessCalls=0;
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>{accessCalls++;return access.promise}
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  const now=Date.now();
  e.sessionStorage.setItem('edunizam_secure_login_handoff',JSON.stringify({
    version:2,nonce:'verified-handoff-user-updated',userId:'user-1',
    institutionId:'school-A',role:'head',at:now,expiresAt:now+120000
  }));
  await e.window.EDUNIZAM_AUTH_BRIDGE.boot();
  const startupTimer=e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verificationTimer;
  if(startupTimer)clearTimeout(startupTimer);
  e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.verificationTimer=0;
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'WORKSPACE_READY');

  e.window.dispatchEvent({type:'edunizam:auth',detail:{
    event:'USER_UPDATED',user:{id:'user-1',email:'user@example.test'}
  }});
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'USER_UPDATED did not synchronously cover the private workspace');

  for(let i=0;i<20&&accessCalls===0;i++) await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(accessCalls,1,
    'USER_UPDATED covered the workspace but never started fresh school authorization');
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Private workspace became visible while USER_UPDATED authorization was pending');

  access.resolve(row);
  for(let i=0;i<30&&e.doc.getElementById('cloudAuthScreen');i++)
    await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null,
    'Successful USER_UPDATED re-authorization did not release the workspace guard');
  assert.equal(e.window.EDUNIZAM_AUTH_BRIDGE.runtimeState.state,'WORKSPACE_READY');
}


// Regression 16: an account-change auth event arriving during an older school
// authorization request must queue a fresh check if the older response goes stale.
// Otherwise the guard remains visible forever because the event's check was dropped.
{
  const oldAccess=deferred();
  let accessCalls=0;
  const cloud={
    state:{client:{},user:{id:'user-1',email:'user@example.test'},sessionRestoreStatus:'active',authEvent:'SIGNED_IN'},
    whenReady:async()=>cloud,
    verifyWorkspaceAccess:()=>{
      accessCalls++;
      return accessCalls===1?oldAccess.promise:Promise.resolve({...row,workspace_role:'head_of_institute'});
    }
  };
  const e=environment('auth-bridge.js',{cloud,local:{edunizam_session:localSession()}});
  const first=e.window.EDUNIZAM_AUTH_BRIDGE.verifyCurrentWorkspace(true);
  for(let i=0;i<20&&accessCalls===0;i++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(accessCalls,1,'Initial authorization request did not start');
  cloud.state.user={id:'user-2',email:'second@example.test'};
  cloud.state.authEvent='SIGNED_IN';
  e.window.dispatchEvent({type:'edunizam:auth',detail:{
    event:'SIGNED_IN',user:{id:'user-2',email:'second@example.test'}
  }});
  assert.ok(e.doc.getElementById('cloudAuthScreen'),
    'Account-change event did not synchronously cover the private workspace');
  oldAccess.resolve(row);
  assert.equal(await first,false,'Stale account authorization should be ignored');
  for(let i=0;i<30&&accessCalls<2;i++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(accessCalls,2,'A fresh authorization check was not queued after the stale response');
  for(let i=0;i<30&&e.doc.getElementById('cloudAuthScreen');i++)
    await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(e.doc.getElementById('cloudAuthScreen'),null,
    'Fresh authorization succeeded but the private-workspace guard remained stuck');
  assert.equal(JSON.parse(e.localStorage.getItem('edunizam_session')).identity,'second@example.test');
}


// Regression 17: a late authorized-workspaces response from a previous
// account must not overwrite the current account's school cache or in-flight lock.
function makeAuthorizedWorkspaceRace(){
  let authHandler=null,currentUserId='';
  const requests=[];
  const client={
    auth:{
      onAuthStateChange(handler){authHandler=handler;return{data:{subscription:{unsubscribe(){}}}}},
      getSession:async()=>({data:{session:null},error:null})
    },
    rpc(name){
      assert.equal(name,'my_authorized_workspaces');
      const pending=deferred();
      requests.push({userId:currentUserId,pending});
      return pending.promise;
    }
  };
  const win={
    EDUNIZAM_CLOUD_CONFIG:{enabled:true,provider:'supabase',supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'test-public-key'},
    supabase:{createClient:()=>client},
    dispatchEvent(){}
  };
  const context={window:win,console,Date,
    CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail}},
    setTimeout,clearTimeout
  };
  vm.runInNewContext(read('admissions-cloud.js'),context,{filename:'admissions-cloud.js'});
  return{
    api:win.EDUNIZAM_CLOUD,requests,
    auth(id){
      currentUserId=id;
      authHandler('SIGNED_IN',{user:{id,email:id+'@example.test'}});
    }
  };
}
{
  const e=makeAuthorizedWorkspaceRace();
  await e.api.whenReady();
  e.auth('account-A');
  const oldRequest=e.api.listAuthorizedWorkspaces();
  await flush();
  e.auth('account-B');
  const newRequest=e.api.listAuthorizedWorkspaces();
  await flush();
  assert.deepEqual(e.requests.map(x=>x.userId),['account-A','account-B']);
  e.requests[1].pending.resolve({data:[{
    institution_id:'school-B',institution_name:'School B',workspace_role:'teacher'
  }],error:null});
  const newRows=await newRequest;
  assert.equal(newRows[0]?.id,'school-B');
  e.requests[0].pending.resolve({data:[{
    institution_id:'school-A',institution_name:'School A',workspace_role:'head_of_institute'
  }],error:null});
  const staleRows=await oldRequest;
  assert.equal(staleRows.length,0,'Stale account workspace response was returned after account switch');
  const cachedRows=await e.api.listAuthorizedWorkspaces();
  assert.equal(cachedRows[0]?.id,'school-B','Old account workspace response overwrote the new account cache');
  assert.equal(e.requests.length,2,'Current account cache was discarded by a stale request');
}
{
  const e=makeAuthorizedWorkspaceRace();
  await e.api.whenReady();
  e.auth('role-A');
  const oldRole=e.api.getMyRole();
  await flush();
  e.auth('role-B');
  const newRole=e.api.getMyRole();
  await flush();
  assert.deepEqual(e.requests.map(x=>x.userId),['role-A','role-B']);
  e.requests[1].pending.resolve({data:[{
    institution_id:'school-B',institution_name:'School B',workspace_role:'teacher'
  }],error:null});
  assert.equal(await newRole,'teacher');
  e.requests[0].pending.resolve({data:[{
    institution_id:'school-A',institution_name:'School A',workspace_role:'head_of_institute'
  }],error:null});
  assert.equal(await oldRole,null,'Stale role response was accepted for the previous account');
  assert.equal(await e.api.getMyRole(),'teacher','Old account role response overwrote the current role cache');
}

console.log('Auth isolation, sign-out races, school-switch races, workspace-cache account races and PWA cache checks passed.');
