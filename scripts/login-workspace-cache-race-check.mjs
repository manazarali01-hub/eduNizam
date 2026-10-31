import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../login.html',import.meta.url),'utf8');
const start=html.indexOf("  const workspaceCache={userId:'',rows:null,at:0,inflight:null,generation:0};");
const end=html.indexOf("  async function resolveInstitution(",start);
assert.ok(start>=0&&end>start,'Login workspace cache implementation must exist');
const source=html.slice(start,end);
const requests=[];
const client={rpc(){
  let resolve;
  const promise=new Promise(r=>{resolve=r});
  requests.push({resolve});
  return promise;
}};
const context={client,Date,globalThis:{}};
vm.runInNewContext(source+'\nglobalThis.authorizedWorkspaces=authorizedWorkspaces;',context);
const list=context.globalThis.authorizedWorkspaces;
const flush=()=>new Promise(r=>setImmediate(r));
const rows=(id,name,role)=>({data:[{institution_id:id,institution_name:name,workspace_role:role}],error:null});

// Account A starts a slow lookup, then B switches in and resolves first.
const aOld=list({id:'account-A'});
await flush();
const bCurrent=list({id:'account-B'});
await flush();
assert.equal(requests.length,2,'Account switch must start a fresh request');
requests[1].resolve(rows('school-B','School B','teacher'));
assert.equal((await bCurrent)[0].id,'school-B');
requests[0].resolve(rows('school-A','School A','head_of_institute'));
assert.equal((await aOld).length,0,'Stale account response must not be returned');
assert.equal((await list({id:'account-B'}))[0].id,'school-B','Stale response must not overwrite current cache');

// Switching back to A must not let its older generation be mistaken for current.
const aNew=list({id:'account-A'});
await flush();
assert.equal(requests.length,3,'Switching back must issue a fresh request');
requests[2].resolve(rows('school-A2','School A verified','head_of_institute'));
assert.equal((await aNew)[0].id,'school-A2');

console.log('Login workspace cache account-switch race checks passed (A→B stale response, cache isolation, B→A generation reset).');
