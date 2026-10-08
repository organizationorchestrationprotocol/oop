import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {buildRequirementMatrix,validateRequirementMatrix} from './requirement-matrix.mjs';
const require=createRequire(import.meta.url),engine=require('../dist/oop-enforce.js');
const observe=(n,name,fn)=>test('REL-GUIDE-'+String(n).padStart(3,'0')+': '+name,fn);
let seq=0;
function workspace(t,session='s1'){
  const root=realpathSync.native(mkdtempSync(join(tmpdir(),'oop-guide-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const dir of ['src','.priv/common','.priv/tools/rt/uid-a'])mkdirSync(join(root,dir),{recursive:true});
  writeFileSync(join(root,'src/a.txt'),'original\n');
  const facts={project_root:root,private_root:join(root,'.priv'),owned_scope_locator:join(root,'.priv/tools/rt/uid-a'),common_scope_locator:join(root,'.priv/common'),
    session,installation_uid:'uid-a',runtime_class:'rt',filesystem_local:true,filesystem_case_sensitive:process.platform!=='win32',paths_resolved_without_aliases:true,scope_ownership_verified:true,observed_at:new Date().toISOString(),mode:'enforcing'};
  const admit=(command,extra={})=>engine.evaluate(command,{format:1,request_id:'a'+(++seq),scope:{classification:'unknown'},coordination:facts,...extra});
  const coordinate=(command,body)=>engine.coordinate(command,{format:1,request_id:'c'+(++seq),coordination:facts,...body});
  const state=()=>coordinate('load',{scope:'session'}).result;
  const guidance=(g,phase='guidance',extra={})=>coordinate('declare',{phase,guidance:g,expected_revision:state().state_revision,...extra});
  admit('entry');admit('interaction');return {root,facts,admit,coordinate,state,guidance};
}
const projection=(extra={})=>({relation:'continuation',phase:'analysis',objective_ref:'work:offer',...extra});
const classification={phase:'classification',facets:['managed_change'],level:'G2',work_item:{kind:'ticket',id:'T-1'}};
const lightweight={phase:'classification',facets:['information'],level:'G0'};
const effect=w=>w.admit('pre-effect',{coordination:{...w.facts,resource:{path:'src/a.txt',access:'write'}}});

function virtualLock(){
  const source=readFileSync('tools/runtime-coordination.cjs','utf8'),code=source.slice(source.indexOf('function withLock('),source.indexOf('function safeList('));
  const files=new Map();let id=0;
  const fs={mkdirSync(){},statSync(){return {mtimeMs:0};},readFileSync(p){if(!files.has(p))throw Error('absent');return files.get(p);},
    renameSync(a,b){files.set(b,files.get(a));files.delete(a);},unlinkSync(p){files.delete(p);}};
  const create=(p,value)=>{if(files.has(p))throw Object.assign(Error('exists'),{code:'EEXIST'});files.set(p,value);};
  const lock=new Function('fs','nodePath','createExclusive','sleep','uuid','safeList','Date','return ('+code+');')(fs,require('node:path'),create,()=>{},()=>String(++id),()=>[],{now:()=>11001});
  return {lock,files};
}
observe(1,'a paused live writer cannot lose its lock after the age threshold',()=>{
  const {lock,files}=virtualLock();let overlapped=false;
  lock('/virtual/state',()=>assert.throws(()=>lock('/virtual/state',()=>{overlapped=true;}),{code:'lock_busy'}));
  assert.equal(overlapped,false);assert.equal(files.size,0);
});
observe(2,'unknown owners remain busy; release never removes a different owner; explicit recovery retains control',()=>{
  const {lock,files}=virtualLock();files.set('/virtual/state.lock','unknown-owner');
  assert.throws(()=>lock('/virtual/state',()=>assert.fail()),{code:'lock_busy'});assert.equal(files.get('/virtual/state.lock'),'unknown-owner');
  // The fixture's administrator now establishes that the unknown writer is gone.
  files.delete('/virtual/state.lock');lock('/virtual/state',()=>files.set('/virtual/state.lock','different-owner'));
  assert.equal(files.get('/virtual/state.lock'),'different-owner');
});
observe(3,'G0 keeps guidance optional and needs no ticket; declarations are never permission',t=>{
  const w=workspace(t);assert.equal(w.state().guidance,null);
  assert.equal(w.coordinate('declare',lightweight).accepted,true);
  const r=w.guidance(projection());assert.equal(r.accepted,true);assert.equal(r.effect_permission,'not_granted');assert.equal(r.result.declaration,'runtime_claim_not_evidence');
  const state=JSON.parse(readFileSync(join(w.root,'.priv/tools/rt/uid-a/sessions/s1/state.json'),'utf8'));assert.equal(state.work_item,null);
});
observe(4,'managed continuation must reassess new input without cancelling its canonical work',t=>{
  const w=workspace(t);w.coordinate('declare',classification);w.guidance(projection());
  const notice=w.admit('interaction').payload.runtime_message;assert.match(notice,/interpret current input/);assert.equal(w.state().guidance_pending,true);
  assert.equal(effect(w).reason_code,'effect_with_stale_guidance');
  w.guidance(projection());assert.equal(w.state().guidance_pending,false);assert.notEqual(effect(w).decision,'allow');
});
observe(5,'correction and changed authority require classification, preserving unrelated reference facts',t=>{
  const w=workspace(t);w.coordinate('declare',classification);
  w.guidance(projection({authority_ref:'grant:A',facts:[{ref:'fact:A',kind:'observation',provenance:'system:A',invalidates_on:'revision',dependencies:[]},
    {ref:'fact:B',kind:'interpretation',provenance:'model',invalidates_on:'fact:A',dependencies:['fact:A']},
    {ref:'fact:C',kind:'assumption',provenance:'model',invalidates_on:'review',dependencies:[]}]}));
  w.guidance(projection({relation:'correction',authority_ref:'grant:B',invalidated:['fact:A']}));
  const g=w.state().guidance;assert.equal(g.requires_reclassification,true);assert.deepEqual(g.facts.map(f=>f.status),['stale','stale','unverified']);assert.ok(g.facts.every(f=>f.assurance==='runtime_claim'));
  assert.equal(effect(w).reason_code,'effect_with_stale_guidance');w.coordinate('declare',classification);assert.equal(w.state().guidance.requires_reclassification,false);
});
observe(6,'stale revisions reject without overwriting either projection or revision',t=>{
  const w=workspace(t),revision=w.state().state_revision;w.guidance(projection());const before=w.state();
  const stale=w.coordinate('declare',{phase:'guidance',guidance:projection({relation:'replacement'}),expected_revision:revision});
  assert.equal(stale.reason,'stale_session_revision');assert.deepEqual(w.state(),before);
});
observe(7,'cancellation retains actual effects and does not transition the ticket',t=>{
  const w=workspace(t);w.coordinate('declare',classification);writeFileSync(join(w.root,'src/a.txt'),'applied partial effect\n');
  w.guidance(projection({relation:'cancellation'}));assert.equal(effect(w).reason_code,'effect_with_stale_guidance');
  const st=JSON.parse(readFileSync(join(w.root,'.priv/tools/rt/uid-a/sessions/s1/state.json'),'utf8'));assert.equal(st.work_item.id,'T-1');assert.equal(st.work_item_state,null);
  assert.equal(readFileSync(join(w.root,'src/a.txt'),'utf8'),'applied partial effect\n');
});
observe(8,'context loss requires independent rehydration and session/workspace cache isolation',t=>{
  const a=workspace(t),b=workspace(t);a.guidance(projection());assert.equal(b.state().guidance,null);
  const foreign=a.coordinate('load',{scope:'session',coordination:{...a.facts,session:'s2'}});assert.equal(foreign.reason,'unknown_session');
  a.admit('interaction',{coordination:{...a.facts,context_event:'compact'}});assert.equal(a.guidance(projection()).reason,'context_stale_reload_required');
  a.coordinate('load',{tier:1});assert.equal(a.guidance(projection()).accepted,true);assert.notEqual(effect(a).decision,'allow');
});
observe(9,'blocker data requires concrete recovery and never proves a real human dependency',t=>{
  const w=workspace(t);assert.equal(w.guidance(projection({blocker:{responsible:'owner'}})).reason,'invalid_guidance');
  const blocker={prevented_action:'publish offer',dependency:'authority unavailable',responsible:'offer owner',unblock_condition:'current scoped grant observed',resume_action:'recheck before publication',independent_work:'review copy'};
  const r=w.guidance(projection({blocker}));assert.equal(r.accepted,true);assert.equal(r.result.guidance.origin,'runtime_declaration');assert.match(r.runtime_message,/declared blocker/);
  assert.notEqual(effect(w).decision,'allow');
});
observe(10,'malformed guidance, executable fields, secrets and missing revision do not alter the cache',t=>{
  const w=workspace(t),before=w.state();
  for(const g of [projection({verify:'return true'}),projection({facts:[{kind:'observation',ref:'x'}]}),projection({objective_ref:'bad\ninput'}),projection({next_check:'-----BEGIN PRIVATE KEY-----'})])assert.equal(w.guidance(g).reason,'invalid_guidance');
  assert.equal(w.coordinate('declare',{phase:'guidance',guidance:projection()}).reason,'expected_revision_required');assert.deepEqual(w.state(),before);
});
observe(11,'source matrix covers every nonblank line and retains all semantic unknowns',()=>{
  const doc=readFileSync('PROTOCOL.md','utf8'),matrix=buildRequirementMatrix(doc);assert.equal(validateRequirementMatrix(doc,matrix).structural,'passed');
  const seen=new Set();for(const row of matrix.rows){for(let i=row.source.logical_start;i<=row.source.logical_end;i++){assert.ok(!seen.has(i));seen.add(i);}assert.equal(row.requirement_status,'not_verified');assert.equal(row.implementation_paths.length,7);}
  assert.equal(matrix.coverage.semantic,'not_verified');assert.ok(matrix.rows.some(r=>r.source_text.includes('G0/G1')));assert.ok(matrix.rows.some(r=>r.kind==='table_row'));
});
observe(12,'missing duplicate stale and self-certified matrix rows fail without granting conformance',()=>{
  const doc=readFileSync('PROTOCOL.md','utf8'),matrix=buildRequirementMatrix(doc);
  for(const mutate of [m=>m.rows.pop(),m=>m.rows.push(m.rows[0]),m=>m.source_identity='stale',m=>m.rows[0].requirement_status='passed']){const changed=structuredClone(matrix);mutate(changed);assert.throws(()=>validateRequirementMatrix(doc,changed));}
});
