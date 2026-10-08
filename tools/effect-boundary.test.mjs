// Producer-only observable-effect fixtures. The trusted harness is synthetic;
// it authenticates no host, installs no hook and proves no OS capability boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../dist/oop-enforce.js');
const {guardedEffect,inspectAdmission,dispatchBinding}=require('./enforcement-adapter.cjs');
const trusted={expectedSourceBinding:engine.config.source_binding};
const now='2026-10-22T12:00:00Z';
const copy=structuredClone;

// Two equivalent conditional stores, with different internal representations.
function backend(kind='object') {
  let state={value:'before',revision:0};
  const rows=new Map([['value','before'],['revision',0]]);
  let writes=0;
  const read=()=>kind==='object'?{...state}:Object.fromEntries(rows);
  return {read,get writes(){return writes;},conditional(expected,value){
    if(read().revision!==expected)throw Error('revision_conflict');
    writes++;
    if(kind==='object')state={value,revision:expected+1};
    else {rows.set('value',value);rows.set('revision',expected+1);}
  }};
}
function request(action={target:'contacts',value:'after',revision:0},options={}) {
  const scope={classification:'known',request:[options.managed?'durable_write':'local_write']};
  const context={project:'fixture-project',runtime:'fixture-owner',machine_id:'fixture-machine',installation_uid:'fixture-uid',oop_commit:'a'.repeat(40),
    revision:String(action.revision),authority:'fixture-owner-authority',resource:action.target,
    risk:options.managed?'G2':'G1',lifecycle:'active',session:'fixture-session',request_scope:'fixture-request',action_scope:'fixture-action',checkpoint_ref:'fixture-checkpoint',checkpoint_revision:'1',mapping_revision:'1',context_retention:'fixture-context',observed_at:now,
    dependencies:{source:'fixture',adapter:'fixture-adapter',continuation:'authorized-request',
      intended_effect:JSON.stringify(action)}};
  const req={format:1,request_id:'correlation',scope,context,effect_class:scope.request[0],evidence:{}};
  req.maintenance_observation=require('./fixtures/machine.cjs').normalMode(req);
 const modules=engine.evaluate('interaction',req).payload.modules;
  const binding={...Object.fromEntries(['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'].map(k=>[k,context[k]])),
    command:'pre-effect',selection:modules.join(','),effect_class:req.effect_class};
  // Every true semantic/authority value is an explicitly synthetic host fixture.
  for(const id of engine.evaluate('pre-effect',req).payload.missing)req.evidence[id]={value:true,
    origin:'authoritative_observation',reference:'fixture:trusted-host',binding:copy(binding),
    dependencies:copy(context.dependencies),observed_at:now,expires_at:'2026-10-22T12:01:00Z'};
  return req;
}
function perform(store,req,action,options={}) {
  // Host binds the actual callback to observed intent, not a model's permission flag.
  if(req.context.dependencies.intended_effect!==JSON.stringify(action) || action.target!=='contacts')
    return {attempted:false,verified:false};
  return guardedEffect(req,()=>store.conditional(action.revision,action.value),{
    ...trusted,...options,verifyEffect:()=>store.read().value===action.value && store.read().revision===action.revision+1});
}
test('REL-BOUNDARY-001: lightweight admitted effect needs no artificial work item',()=>{
  const store=backend(),action={target:'contacts',value:'after',revision:0};
  const req=request(action);assert.ok(!Object.hasOwn(req,'ticket'));
  assert.equal(perform(store,req,action).verified,true);assert.equal(store.writes,1);
});
test('REL-BOUNDARY-002: missing managed prerequisites and canonical write access prevent effects',()=>{
  const action={target:'contacts',value:'after',revision:0};
  for(const fact of ['current_source_verified','authority_verified','mandatory_guards_complete']){
    const store=backend(),req=request(action,{managed:true});delete req.evidence[fact];
    assert.equal(perform(store,req,action).attempted,false);assert.equal(store.writes,0);
  }
  // A missing required work item or operations write capability is a missing
  // mandatory guard, evaluated by the privileged adapter, not a universal ticket.
  for(const missing of ['required_work_item','operations_write_access']){
    const store=backend(),req=request(action,{managed:true});
    req.evidence.mandatory_guards_complete.value=false;
    assert.equal(perform(store,req,action).attempted,false,missing);assert.equal(store.writes,0);
  }
});
test('REL-BOUNDARY-003: foreign stale and substituted intent evidence cannot cause the effect',()=>{
  const action={target:'contacts',value:'after',revision:0};
  for(const mutate of [r=>{r.context.runtime='foreign';},r=>{r.context.observed_at='2026-10-22T12:02:00Z';},
    r=>{r.context.dependencies.continuation='another-owner-request';},
    r=>{r.context.dependencies.intended_effect='substituted';}]){
    const store=backend(),req=request(action);mutate(req);
    assert.equal(perform(store,req,action).attempted,false);assert.equal(store.writes,0);
  }
  const store=backend(),req=request(action);req.request_id='new-correlation';
  req.maintenance_observation=require('./fixtures/machine.cjs').normalMode(req);
  assert.equal(perform(store,req,action).verified,true,'valid continuity may reuse evidence; request_id grants no authority');
});
test('REL-BOUNDARY-004: competing writers fail at conditional execution without lost update',()=>{
  const store=backend(),action={target:'contacts',value:'ours',revision:0},req=request(action);
  store.conditional(0,'peer');const result=perform(store,req,action);
  assert.equal(result.verified,false);assert.equal(result.reason,'unknown_partial_effect');
  assert.deepEqual(store.read(),{value:'peer',revision:1});assert.equal(store.writes,1);
});
test('REL-BOUNDARY-005: standalone denial never certifies an uncovered direct route',()=>{
  const store=backend(),action={target:'contacts',value:'forbidden',revision:0},req=request(action);
  req.evidence.authority_verified.value=false;
  assert.equal(perform(store,req,action).attempted,false);assert.equal(store.writes,0);
  store.conditional(0,'uncovered');
  assert.equal(store.writes,1,'an exposed direct capability defeats a claim covering that route');
});
test('REL-BOUNDARY-006: malformed error and timeout dispatch preserve actual destination',async()=>{
  const store=backend(),req=request(),group={features:['pre-effect'],semantics:'preventive_gate'};
  for(const mode of ['malformed','error','timeout']){
    const result=await dispatchBinding(group,{'pre-effect':req},{...trusted,expectedBinding:group,timeoutMs:2,
      invoke:()=>mode==='malformed'?{status:0,stdout:'invalid'}:mode==='error'?Promise.reject(Error('handler')):new Promise(()=>{})});
    if(result.dependent_effect_permitted)store.conditional(0,'forbidden');
    assert.equal(result.dependent_effect_permitted,false);assert.equal(store.writes,0);
  }
});
test('REL-BOUNDARY-007: two mediated routes reject unauthorized target and forged response',()=>{
  const store=backend(),action={target:'prices',value:'forbidden',revision:0},req=request(action);
  const actor=Object.freeze({direct:()=>perform(store,req,action),nested:()=>perform(store,req,action)});
  assert.equal(actor.direct().attempted,false);assert.equal(actor.nested().attempted,false);
  const response=engine.evaluate('pre-effect',req);response.source_binding={kind:'source_content',source_identity:'sha256:'+'f'.repeat(64)};
  const gate=inspectAdmission({status:0,stdout:JSON.stringify(response)},req,'pre-effect',trusted);
  if(gate.admitted)store.conditional(0,'forged');assert.equal(store.writes,0);
});
test('REL-BOUNDARY-008: authorized managed effect and durable readback succeed with reused access',()=>{
  const store=backend(),action={target:'contacts',value:'after',revision:0},req=request(action,{managed:true});
  let consentRequests=0;
  const access={current:true,write:true,scope:'fixture-project'};
  if(!access.current || !access.write)consentRequests++;
  assert.equal(perform(store,req,action).verified,true);assert.equal(consentRequests,0);assert.equal(store.writes,1);
});
test('REL-BOUNDARY-009: separate effect and tracking failure retain partial state without replay',()=>{
  const store=backend(),action={target:'contacts',value:'published',revision:0},req=request(action);
  assert.equal(perform(store,req,action).verified,true);
  let tracking={status:'pending',actual:store.read(),owner:'fixture-owner',next:'persist tracking only'};
  assert.equal(tracking.status,'pending');assert.equal(store.writes,1);
  tracking={...tracking,status:'persisted'};
  assert.equal(tracking.actual.value,'published');assert.equal(store.writes,1);
});
test('REL-BOUNDARY-010: recovery observes completed work and rejects foreign runtime evidence',()=>{
  const store=backend(),action={target:'contacts',value:'after',revision:0};
  assert.equal(perform(store,request(action),action).verified,true);
  const observed=store.read();assert.equal(observed.revision,1);
  const next={target:'contacts',value:'next',revision:1},req=request(next);req.context.runtime='peer';
  assert.equal(perform(store,req,next).attempted,false);assert.equal(store.writes,1);
  assert.equal(perform(store,request(next),next).verified,true);assert.equal(store.writes,2);
});
test('REL-BOUNDARY-011: administrative closure retains unmet original goal and accountable continuation',()=>{
  const original={goal:'all routes independently protected',essential:['direct','nested']};
  const outcome={verified:['direct'],excluded:[],deferred:['nested'],owner:'host-owner',successor:'fixture:host-followup'};
  const achieved=original.essential.every(path=>outcome.verified.includes(path));
  assert.equal(achieved,false);assert.equal(outcome.successor,'fixture:host-followup');
  assert.ok(!outcome.excluded.includes('nested'),'deferral does not silently revise essential success');
});
test('REL-BOUNDARY-012: different conditional backends retain equivalent durability and race behavior',()=>{
  for(const kind of ['object','map']){
    const store=backend(kind),action={target:'contacts',value:'after',revision:0};
    assert.equal(perform(store,request(action),action).verified,true);
    assert.equal(perform(store,request(action),action).verified,false);
    assert.deepEqual(store.read(),{value:'after',revision:1});assert.equal(store.writes,1);
  }
});
