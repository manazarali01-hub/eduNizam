/* A Head can enter real school classes before teacher/staff profiles exist.
 * An unverified staff directory must still block assigning a teacher.
 * Uses in-memory PostgREST responses only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../class-section-center.js',import.meta.url),'utf8');
const memory=new Map([['edunizam_session',JSON.stringify({role:'head'})]]);
const localStorage={
 getItem:k=>memory.get(k)||null,
 setItem:(k,v)=>memory.set(k,String(v))
};
const nodes={
 csSave:{dataset:{},disabled:false,isConnected:true,textContent:'Save Section',
  setAttribute(){},removeAttribute(){}},
 csClass:{value:'5'},csSection:{value:'A'},csEditId:{value:''},
 csTeacher:{value:''},csRoom:{value:'Room A'},csCapacity:{value:'30'},
 csActive:{value:'true'}
};
const document={getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]};
const written=[];
const client={from(table){
 assert.equal(table,'class_sections');
 return{insert(payload){
  written.push(payload);
  return{select(){return this},single:async()=>({error:null,data:{
   ...payload,id:'real-class-'+written.length,created_at:'2026-10-11T00:00:00Z'
  }})};
 }};
}};
const win={EDUNIZAM_CLOUD_CONFIG:{enabled:true,institutionId:'real-school-A'},
 EDUNIZAM_CLOUD:{state:{client,user:{id:'verified-head-A'}}},addEventListener(){}};
const alerts=[];
runInNewContext(source,{window:win,document,localStorage,
 setTimeout:()=>0,clearTimeout,Date,console,alert:msg=>alerts.push(String(msg))},
 {filename:'class-section-center.js'});
const api=win.EDUNIZAM_CLASS_SECTION_CENTER;
assert.equal(typeof api.save,'function');
await api.save();
assert.equal(written.length,1,'No-teacher class was blocked until staff directory loaded');
assert.equal(written[0].institution_id,'real-school-A');
assert.equal(written[0].class_name,'5');
assert.equal(written[0].section_name,'A');
assert.equal(written[0].class_teacher_user_id,null);
assert.equal(written[0].updated_by,'verified-head-A');
assert.equal(api.read().length,1,'Cloud-confirmed class not reflected in same-school directory');
assert.equal(nodes.csSave.disabled,false,'Save button stayed disabled after request');

nodes.csSection.value='B';
nodes.csTeacher.value='staff-id-that-was-not-loaded';
await api.save();
assert.equal(written.length,1,'Unverified class-teacher selection was allowed');
assert.match(alerts.at(-1),/Teacher directory is not verified/i);

nodes.csTeacher.value='';
memory.set('edunizam_session',JSON.stringify({role:'teacher'}));
await api.save();
assert.equal(written.length,1,'Non-Head role created a class');
assert.match(alerts.at(-1),/Head of Institute/i);

console.log('Academic Groups first-use PASS: unassigned class before staff setup, scoped cloud save, no unverified teacher assignment or unauthorized save.');
