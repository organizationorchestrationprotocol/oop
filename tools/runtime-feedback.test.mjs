import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createEnforcementEngine} from './enforcement-engine.mjs';
import {route} from './reference-engine.mjs';
const require=createRequire(import.meta.url),engine=require('../dist/oop-enforce.js'),{runtimeFeedback}=require('./runtime-feedback.cjs'),feedback=runtimeFeedback();
const {installationContract}=require('./installation-contract.cjs'),{normalMode}=require('./fixtures/machine.cjs'),{runtimeFramework}=require('./runtime-framework.cjs'),{runtimeRendering}=require('./runtime-rendering.cjs'),{register}=require('./fixtures/oop-runtime-adapter.cjs');
const observe=(n,title,fn)=>test('REL-FEED-'+String(n).padStart(3,'0')+': '+title,fn);
function actionable(r){
 const p=r.type==='oop_admission'?r.payload:r.type==='oop_runtime_coordination'?r.result:null,m=r.type==='oop_admission'?r.payload.runtime_message:r.runtime_message;
 assert.match(m,/OOP action required:/);assert.match(m,/Retry only when:/);assert.match(m,/Do not repeat an unchanged request/);
 if(p){assert.ok(p.remediation.explanation.length>30);assert.ok(p.remediation.actions.every(a=>a.length>40));assert.ok(p.remediation.retry_when.length>30);}
 return m;
}
function request(){
 const context=Object.fromEntries(['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'].map(k=>[k,'fixture-'+k]));
 Object.assign(context,{oop_commit:'a'.repeat(40),observed_at:'2026-10-17T12:00:00Z',dependencies:{source:'fixture-source'}});
 const r={format:1,request_id:'fixture-request',scope:{classification:'known',request:['local_write']},context,effect_class:'local_write',evidence:{}};
 r.maintenance_observation=normalMode(r);return r;
}
observe(1,'all admission contact points provide actionable malformed-input outcomes',()=>{
 for(const command of [...Object.keys(engine.config.commands),'unsupported'])actionable(engine.evaluate(command,null));
});
observe(2,'unresolved semantics deliver both exact context references and operational next steps',()=>{
 const r=engine.evaluate('interaction',{format:1,request_id:'fixture',scope:{classification:'unknown'}});
 assert.equal(r.reason_code,'needs_semantic_judgment');assert.ok(r.payload.module_paths.length);assert.match(actionable(r),/Load the complete clauses/);
});
observe(3,'missing context and missing evidence name concrete acquisition work',()=>{
 const r=request();delete r.context.request_scope;const missing=engine.evaluate('pre-effect',r);
 assert.deepEqual(missing.payload.missing_context,['request_scope']);assert.match(actionable(missing),/actual native session, current user request, operation/);
 const complete=request(),e=engine.evaluate('pre-effect',complete);assert.equal(e.reason_code,'needs_evidence');assert.match(actionable(e),/actual native installation/);
 delete complete.evidence;assert.ok(engine.evaluate('pre-effect',complete).payload.missing.length);
});
observe(4,'false authority stays denied with corrective instructions instead of implicit permission',()=>{
 const r=request(),scope=engine.evaluate('interaction',{format:1,request_id:'fixture',scope:r.scope}).payload.modules;
 const expected={...Object.fromEntries(['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'].map(k=>[k,r.context[k]])),command:'pre-effect',selection:scope.join(','),effect_class:'local_write'};
 r.evidence.authority_verified={value:false,origin:'authoritative_observation',reference:'fixture:denial',binding:expected,dependencies:r.context.dependencies,observed_at:r.context.observed_at,expires_at:'2026-10-17T12:01:00Z'};
 const denied=engine.evaluate('pre-effect',r);assert.equal(denied.decision,'deny');assert.equal(denied.effect_permission,'not_granted');assert.match(actionable(denied),/Obtain current authoritative permission/);
});
observe(5,'configuration and runtime coordination rejection cannot return empty instructions',()=>{
 actionable(engine.validateConfiguration(null));actionable(engine.coordinate('unsupported',null));
});
observe(6,'registration failure before routing has source-specific recovery instructions',()=>{
 const local=createEnforcementEngine(engine.config,route,installationContract(),{registration:()=>({ok:false,reason:'registration_source_mismatch'})});
 const r=local.evaluate('pre-effect',request(),{registration:{}});assert.equal(r.reason_code,'registration_source_mismatch');assert.match(actionable(r),/current distributed entry and adapter template/);
});
observe(7,'framework failures before adapter selection emit concrete safe recovery without a fabricated event',()=>{
 const f=runtimeFramework(engine,{registration:()=>({ok:false,reason:'registration_source_mismatch'})},engine.config.adapter_template);
 const r=f.dispatch('pre-effect',{},{} ,'fixture-host');assert.equal(r.exit,4);assert.match(r.stderr,/Prepare the owned adapter and registration/);assert.equal(r.stdout,'');
});
observe(8,'renderer recovery persists concrete instructions and excludes arbitrary failure contents',t=>{
 const owned=mkdtempSync(join(tmpdir(),'oop-feedback-'));t.after(()=>rmSync(owned,{recursive:true,force:true}));
 const r=runtimeRendering(),record={owned_scope:owned,installation_uid:'fixture',project_root:owned};
 const result=r.recover({record,request:{decision:'deny'},event:'pre-effect',error:r.failure('renderer_timeout')});
 assert.match(result.stderr,/correct the decoder, response manifest, output bounds or launcher/);assert.match(r.list(record).records[0].message,/Retry only when/);
 const message=actionable(feedback.complete({type:'oop_admission',decision:'error',reason_code:'fixture-secret-do-not-echo',payload:{missing:['fixture-secret-do-not-echo']}}));assert.ok(!message.includes('fixture-secret-do-not-echo'));
});
observe(9,'the generated CLI supplies instructions for malformed JSON and argument failures',()=>{
 for(const [args,input] of [[['completion'],'{'],[['completion','--invalid'],'{}']]){
  const r=spawnSync(process.execPath,['dist/oop-enforce.js',...args],{input,encoding:'utf8'});assert.equal(r.status,4);assert.match(actionable(JSON.parse(r.stdout)),/bounded UTF-8 JSON object/);
 }
});
observe(10,'native response rendering forwards the complete corrective message',t=>{
 const owned=mkdtempSync(join(tmpdir(),'oop-feedback-native-'));t.after(()=>rmSync(owned,{recursive:true,force:true}));
 const adapter=register(owned,engine.config.adapter_template,{supported_commands:['completion'],format:'message'}),record={format:1,owned_scope:owned,runtime_adapter:adapter};
 const local={config:engine.config,evaluate:()=>({type:'oop_admission',decision:'unknown',reason_code:'needs_evidence',payload:{missing:['tests_verified']}})};
 const f=runtimeFramework(local,{registration:()=>({ok:true,record})},engine.config.adapter_template),r=f.dispatch('completion',{session:'fixture'},{},'fixture-host');
 assert.equal(r.exit,3);assert.match(r.stdout,/Run the checks required by the change/);assert.match(r.stdout,/Retry only when:/);
});
observe(11,'finalization is bounded, deterministic and preserves decision and authoritative context',()=>{
 const r={type:'oop_admission',decision:'deny',effect_permission:'not_granted',reason_code:'guard_failed',payload:{runtime_message:'Current scoped context.',failed:Array.from({length:1000},()=> 'authority_verified')}};
 const first=feedback.complete(r),again=feedback.complete(first);assert.deepEqual(again,first);assert.equal(first.decision,'deny');assert.equal(first.effect_permission,'not_granted');assert.ok(first.payload.runtime_message.startsWith('Current scoped context.'));assert.ok(first.payload.runtime_message.length<16384);
 const allowed={type:'oop_admission',decision:'allow',payload:{runtime_message:''}};assert.deepEqual(feedback.complete(allowed),allowed);
});
observe(12,'every current mandatory command predicate has a concrete repair instruction',()=>{
 for(const predicate of new Set(Object.values(engine.config.commands).flatMap(c=>c.required))){const text=feedback.instruction(predicate);assert.ok(text.length>50,predicate);assert.ok(!text.includes(predicate),predicate);assert.ok(!text.startsWith('Keep the effect stopped.'),predicate);}
 for(const reason of ['canonical_publication_pending','effect_outside_declared_scope','administrative_revision_changed','action_dependency_changed','recovery_required','invalid_transition','resource_leased'])actionable(feedback.complete({type:'oop_admission',decision:'unknown',reason_code:reason,payload:{}}));
});
observe(13,'a native response that drops corrective guidance is rejected before activation',()=>{
 const {complete,descriptor}=require('./fixtures/oop-runtime-adapter.cjs'),d=descriptor({supported_commands:['completion']});
 for(const block of Object.values(d.supported_commands.completion))for(const decision of ['deny','unknown','error'])block[decision].stdout='OOP blocked';
 const checked=engine.framework.validateManifest(complete(engine.config.adapter_template,{descriptor:d}));
 assert.equal(checked.valid,false);assert.ok(checked.diagnostics.some(x=>x.code==='corrective_message_not_forwarded'&&/complete controller response/.test(x.correction)));
});
observe(14,'partially unreadable diagnostic records include recovery instructions alongside preserved data',t=>{
 const owned=mkdtempSync(join(tmpdir(),'oop-feedback-diagnostics-'));t.after(()=>rmSync(owned,{recursive:true,force:true}));
 const adapter=register(owned,engine.config.adapter_template,{supported_commands:['diagnostics-read']}),record={format:1,owned_scope:owned,project_root:owned,installation_uid:'fixture',runtime_adapter:adapter};
 const directory=join(owned,'rendering-diagnostics');mkdirSync(directory);writeFileSync(join(directory,randomUUID()+'.json'),'{');
 const f=runtimeFramework(engine,{registration:()=>({ok:true,record})},engine.config.adapter_template),result=f.dispatch('diagnostics-read',{session:'fixture'},{},'fixture-host'),parsed=JSON.parse(result.stdout);
 assert.ok(parsed.result.errors.length);assert.match(parsed.runtime_message,/Read the owned integration diagnostic/);assert.match(parsed.runtime_message,/Retry only when/);
});
