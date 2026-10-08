import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {closure,expandBootstrap} from './reference-engine.mjs';
import {validateProfile} from './schema-profile.mjs';
const require=createRequire(import.meta.url),c=require('./installation-contract.cjs'),native=require('./fixtures/native-configuration.cjs');
const {resolveClause,contextReceipt,migrateRuntimeAdapter}=require('./oop-runtime-adapter-installation.cjs');
const {planInstallation}=require('./install-plan.cjs');
const engine=require('../dist/oop-enforce.js'),manifest=require('../dist/enforcement-install.json');
const clone=structuredClone,fixture=()=>native('P','v1','cfg');
const check=f=>c.validateConfiguration(f.configuration_plan,f.configuration_observation);
const point=(f,p,owned)=>{f.configuration_plan.runtime_adapter.entrypoint=p;f.configuration_observation.resolved_runtime_adapter_entrypoint=p;if(owned)f.configuration_observation.owned_scope_locator=owned;f.configuration_plan.adapter_preparation.workflow.inputs.working_copy=p;f.configuration_observation.adapter_preparation_inputs.working_copy=p;};
const run=(input,command='validate-configuration')=>spawnSync(process.execPath,['dist/oop-enforce.js',command],{input:typeof input==='string'||Buffer.isBuffer(input)?input:JSON.stringify(input),encoding:'utf8',maxBuffer:4*1024*1024});
const observe=(n,title,fn)=>test('REL-ADAPTER-'+String(n).padStart(3,'0')+': '+title,fn);
observe(1,'resolved scope rejects common, traversal, prefixed UID and foreign ownership',()=>{
 assert.equal(check(fixture()).valid,true);
 for(const [path,owned,reason] of [
 ['/private/common/fixture-installation-uid/oop-runtime-adapter.js','/private/common/fixture-installation-uid','runtime_adapter_location_in_common_scope'],
 ['/private/tools/fixture-installation-uid/../other/oop-runtime-adapter.js',null,'runtime_adapter_path_unresolved'],
 ['/private/tools/agent-fixture-installation-uid/oop-runtime-adapter.js',null,'runtime_adapter_location_not_uid_qualified'],
 ['/other/fixture-installation-uid/oop-runtime-adapter.js',null,'runtime_adapter_location_not_owned']]){
 const f=fixture();point(f,path,owned);assert.equal(check(f).reason,reason,path);
 }
 for(const k of ['paths_resolved_without_aliases','runtime_adapter_ownership_verified']){const f=fixture();f.configuration_observation[k]=false;assert.equal(check(f).reason,'runtime_adapter_path_unresolved');}
});
observe(2,'separator styles, directory boundaries and observed case semantics preserve exact UID',()=>{
 const f=fixture();point(f,'C:\\private\\tools\\fixture-installation-uid\\oop-runtime-adapter.js','C:/private/tools/fixture-installation-uid');f.configuration_observation.common_scope_locator='C:/private/common';assert.equal(check(f).valid,true);
 point(f,'C:/private/COMMON/fixture-installation-uid/oop-runtime-adapter.js','C:/private/COMMON/fixture-installation-uid');f.configuration_observation.filesystem_case_sensitive=true;assert.equal(check(f).valid,true);f.configuration_observation.filesystem_case_sensitive=false;assert.equal(check(f).reason,'runtime_adapter_location_in_common_scope');
 point(f,'C:/private/common-sibling/fixture-installation-uid/oop-runtime-adapter.js','C:/private/common-sibling/fixture-installation-uid');assert.equal(check(f).valid,true);
 point(f,'C:/private/tools/FIXTURE-INSTALLATION-UID/oop-runtime-adapter.js');assert.equal(check(f).reason,'runtime_adapter_location_not_uid_qualified');
});
observe(3,'native shell, implementation and filename faults have stable distinct precedence',()=>{
 for(const [patch,reason] of [[{language:'application'},'adapter_javascript_unavailable'],[{delegated_runtime_adapter_logic:true},'adapter_implementation_invalid'],[{implementation_language:'application'},'adapter_implementation_invalid']]){const f=fixture();Object.assign(f.configuration_plan.runtime_adapter,patch);assert.equal(check(f).reason,reason);}
 const f=fixture();point(f,'/private/tools/fixture-installation-uid/oop-runtime-hook.cjs');assert.equal(check(f).reason,'runtime_adapter_filename_noncanonical');
 const missing=fixture();delete missing.configuration_observation.configuration_revision;delete missing.configuration_plan.expected_revision;assert.equal(check(missing).reason,'documentation_or_configuration_revision_unresolved');
});
observe(4,'administrative CLI has complete correlated envelopes and distinct malformed/invalid exits',()=>{
 const f=fixture(),request={format:1,request_id:'cfg-1',plan:f.configuration_plan,facts:f.configuration_observation};
 let r=run(request);assert.equal(r.status,0,r.stderr);let response=JSON.parse(r.stdout);assert.equal(response.valid,true);assert.equal(response.error,false);assert.equal(response.dispatch_verified,false);assert.deepEqual(response.validation_binding,check(f).validation_binding);
 request.plan.expected_revision='stale';r=run(request);assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).reason,'documentation_or_configuration_revision_unresolved');
 for(const input of ['{',JSON.stringify({...request,extra:true}),JSON.stringify({...request,request_id:'x'.repeat(513)}),Buffer.from([0xff]),' '.repeat(1048577)]){r=run(input);assert.equal(r.status,4,r.stderr);response=JSON.parse(r.stdout);assert.equal(response.type,'oop_configuration_validation');assert.equal(response.error,true);assert.equal(response.valid,false);assert.equal(response.validation_binding,null);}
 assert.equal(Object.keys(engine.config.commands).length,8);assert.equal(run({format:1,request_id:'probe'},'probe').status,3);
});
observe(5,'registration planner blocks missing, stale and foreign-source validation receipts',()=>{
 const f=fixture(),options={expectedSourceBinding:manifest.source_binding};
 assert.notEqual(planInstallation(manifest,[],f,{},options).reason,'configuration_validation_missing_or_stale');
 for(const mutate of [x=>delete x.configuration_validation,x=>x.configuration_validation.valid=false,x=>x.configuration_validation.source_binding={kind:'source_content',source_identity:'foreign'},x=>x.configuration_plan.elements[0].value='changed',x=>x.configuration_observation.unrelated_metadata='changed']){const x=clone(f);mutate(x);assert.equal(planInstallation(manifest,[],x,{},options).reason,'configuration_validation_missing_or_stale');}
});
observe(6,'manifest schema, clause references and installation closure resolve without context expansion',()=>{
 const schema=require('./schemas/enforcement-install.schema.json');assert.deepEqual(validateProfile(manifest,schema),[]);assert.equal(manifest.format,1);
 for(const pointer of [...manifest.runtime_adapter.location_rules,...manifest.runtime_adapter.language_rules,...manifest.runtime_adapter.installation_rules]){const [file,fragment]=pointer.split('#');assert.ok(resolveClause(require('../dist/'+file),fragment).contract.semantic_clause);}
 const procedure=require('../dist/procedures/bootstrap.json'),expanded=expandBootstrap(procedure);for(const step of expanded.steps){assert.ok(step.wait.includes('observable resume'));assert.ok(step.failure.includes('partial effects'));}
 const invalid=clone(procedure);invalid.steps[0].defaults_ref='#missing';assert.throws(()=>expandBootstrap(invalid));
 assert.throws(()=>resolveClause(require('../dist/modules/workspace.json'),'missing'));
 const r=require('../dist/routing.json'),loaded=closure(r.modules,r.facets.full_install);assert.ok(loaded.includes('capabilities'));assert.ok(loaded.includes('workspace'));assert.equal(require('../dist/entry.json').minimum_context.includes('modules/capabilities.json'),false);
 const boot=require('../dist/procedures/bootstrap.json').steps.find(s=>s.id==='BOOT-12').binding_plan;assert.equal(boot.pre_materialization_checklist.length,5);assert.ok(boot.sequence.indexOf('validate_exact_configuration_plan')<boot.sequence.indexOf('install_or_reuse_every_eligible_mechanism'));
 assert.deepEqual(boot.adapter_development.sequence,c.adapterDevelopmentSteps);assert.equal(boot.adapter_development.preparation_contract.workflow.stages,'six_ordered_objects_with_step_reference_assurance');
});
observe(7,'session context receipts cannot cross session, mapping, content or source boundaries',()=>{
 const expected={session:'s1',workspace:'P',installation_uid:'uid',mapping_revision:'r1',source_binding:manifest.source_binding,modules:[{file:'modules/workspace.json',content_identity:'published-identity'}]};assert.equal(contextReceipt(expected,expected),true);
 for(const patch of [{session:'s2'},{mapping_revision:'r2'},{source_binding:{}},{modules:[]},{modules:[...expected.modules,...expected.modules]}])assert.equal(contextReceipt({...expected,...patch},expected),false);
});
function migrationBackend(f,mode='normal'){let state={candidate_facts:f.configuration_observation,source_binding:manifest.source_binding,revision:'cfg',active:'/old/adapter',ownership_verified:true,replacement_authorized:true,maintenance:{mode,revision:'state-1',identity:'source-state',observed:true},routes:[],references_intact:true};return {read:async()=>clone(state),stage:async()=>{assert.equal(state.active,'/old/adapter');return {source_revision:state.revision,source_maintenance_identity:state.maintenance.identity,target_maintenance:{mode:state.maintenance.mode,source_revision:state.maintenance.revision,identity:'target-state',observed:true,owned:true}};},activate:async(expected,p)=>{if(state.revision!==expected)throw Error('stale');state={...state,revision:'next',active:p.plan.runtime_adapter.entrypoint,routes:p.plan.routes,maintenance:{...state.maintenance,identity:'target-state'}};return {revision:'next'};},retire:async(path,options)=>{assert.equal(path,'/old/adapter');assert.equal(options.preserve_historical_references,true);state.inactive=path;}};}
observe(8,'recoverable migration preserves safe active entry and historical references across failure and stale retry',async()=>{
 const f=fixture(),proposal={expected_revision:'cfg',previous:'/old/adapter',plan:f.configuration_plan,validation:f.configuration_validation};const backend=migrationBackend(f);
 const forged=clone(proposal);forged.validation.validation_binding.host='foreign';assert.equal((await migrateRuntimeAdapter(forged,backend)).verified,false);assert.equal((await migrateRuntimeAdapter(proposal,backend)).verified,true);assert.equal((await backend.read()).inactive,'/old/adapter');assert.equal((await migrateRuntimeAdapter(proposal,backend)).verified,false);
 const failed=migrationBackend(f);failed.activate=async()=>{throw Error('native consent unresolved');};assert.equal((await migrateRuntimeAdapter(proposal,failed)).phase,'activation_pending_reconciliation');assert.equal((await failed.read()).active,'/old/adapter');
});
const {runtimeFramework}=require('./runtime-framework.cjs');
const {complete,register}=require('./fixtures/oop-runtime-adapter.cjs');
const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
function framework(t,{source,profile='oop'}={}){
 const root=mkdtempSync(join(tmpdir(),'oop-framework-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const a=register(root,template,{format:profile});if(source){writeFileSync(a.path,source);a.identity=require('./fixtures/oop-runtime-adapter.cjs').digest(Buffer.from(source));}
 const record={format:1,owned_scope:root,runtime_adapter:a};
 const engine={config:{commands:Object.fromEntries(['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe'].map(c=>[c,{}])),source_binding:{source_identity:'fixture'}},evaluate:(command,r)=>({format:1,type:'oop_admission',command,request_id:r.request_id,decision:r.mode??'unknown',effect_permission:'not_granted',payload:{runtime_message:'modalità',seen:r.coordination}})};
 return runtimeFramework(engine,{registration:()=>({ok:true,record})},template);
}
observe(9,'official framework preserves UTF-8 output without BOM',t=>{
 const r=framework(t).dispatch('entry',{session:'s1'}, {},'fixture-host');assert.equal(r.exit,3);assert.ok(r.stdout.includes('modalità'));assert.ok(!r.stdout.startsWith('\ufeff'));
});
observe(10,'framework propagates denial, unknown and error without permission',t=>{
 const f=framework(t);for(const [mode,code] of [['deny',2],['unknown',3],['error',4]]){const r=f.dispatch('pre-effect',{session:'s1',mode},{},'fixture-host');assert.equal(r.exit,code);assert.equal(JSON.parse(r.stdout).effect_permission,'not_granted');}
});
observe(11,'adapter errors, missing session and deadlines cannot grant effects',t=>{
 for(const decode of ['throw new Error("fixture");','while(true){}','return {request:raw};']){
  const f=framework(t,{source:complete(template,{decode})});assert.equal(f.dispatch('pre-effect',{session:'s1'},{},'fixture-host').exit,4);
 }
});
observe(12,'template is source-bound, incomplete regions and fixed-scaffold edits are rejected',t=>{
 const f=framework(t);assert.ok(template.includes(manifest.source_binding.source_identity));assert.equal(f.validateAdapter(template).reason,'adapter_incomplete');
 assert.equal(f.validateAdapter(complete(template)+'\n// extra').reason,'adapter_scaffold_changed');
 assert.equal(f.dispatch('entry',{session:'s1'},{},'foreign-host').exit,4);
});
observe(13,'a planned adapter registration must match the observed active record locator and identity on every route',()=>{
 const id='sha256:'+'a'.repeat(64),loc='/private/tools/fixture-installation-uid/oop-runtime-adapter-registration.json';
 const f=fixture();f.configuration_plan.registration={locator:loc,identity:id};f.configuration_plan.routes.forEach(r=>{r.registration=loc;r.registration_identity=id;});
 f.configuration_observation.registration={locator:loc,identity:id};assert.equal(check(f).valid,true);
 for(const mutate of [x=>x.configuration_observation.registration.identity='sha256:'+'b'.repeat(64),x=>x.configuration_plan.routes[0].registration='/other/oop-runtime-adapter-registration.json',
   x=>delete x.configuration_observation.registration,x=>x.configuration_plan.registration.identity='not-an-identity']){const g=clone(f);mutate(g);assert.equal(check(g).reason,'runtime_adapter_registration_mismatch');}
 assert.equal(check(fixture()).valid,true);
});

observe(14,'unknown source maintenance cannot activate or infer normal mode from a missing target',async()=>{
 const f=fixture(),proposal={expected_revision:'cfg',previous:'/old/adapter',plan:f.configuration_plan,validation:f.configuration_validation};
 for(const patch of [null,{mode:'unknown',observed:true,identity:'s',revision:'r'},{mode:'normal',observed:false,identity:'s',revision:'r'}]){const backend=migrationBackend(f),read=backend.read;let stages=0;backend.read=async()=>({...await read(),maintenance:patch});backend.stage=async()=>stages++;const out=await migrateRuntimeAdapter(proposal,backend);assert.equal(out.verified,false);assert.equal(stages,0);assert.equal(out.phase,'not_staged');assert.equal((await read()).active,proposal.previous);}
});
observe(15,'active and recovering source maintenance survive the full conditional migration',async()=>{
 const f=fixture(),proposal={expected_revision:'cfg',previous:'/old/adapter',plan:f.configuration_plan,validation:f.configuration_validation};for(const mode of ['maintenance','recovering']){const backend=migrationBackend(f,mode);assert.equal((await migrateRuntimeAdapter(proposal,backend)).verified,true);assert.equal((await backend.read()).maintenance.mode,mode);}
});
observe(16,'unowned, mismatched or normalizing target receipts preserve the safe source entry',async()=>{
 const f=fixture(),proposal={expected_revision:'cfg',previous:'/old/adapter',plan:f.configuration_plan,validation:f.configuration_validation};
 for(const change of [r=>r.source_revision='foreign',r=>r.source_maintenance_identity='foreign',r=>r.target_maintenance.mode='normal',r=>r.target_maintenance.owned=false]){const backend=migrationBackend(f,'maintenance'),stage=backend.stage;backend.stage=async p=>{const receipt=await stage(p);change(receipt);return receipt;};assert.equal((await migrateRuntimeAdapter(proposal,backend)).verified,false);assert.equal((await backend.read()).active,proposal.previous);}
});
observe(17,'interruption after activation retains partial effects and forbids premature retirement',async()=>{
 const f=fixture(),proposal={expected_revision:'cfg',previous:'/old/adapter',plan:f.configuration_plan,validation:f.configuration_validation},backend=migrationBackend(f,'maintenance'),read=backend.read;let reads=0,retired=false;
 backend.read=async()=>{const state=await read();if(++reads>1)state.maintenance.identity='unreconciled';return state;};backend.retire=async()=>retired=true;
 const out=await migrateRuntimeAdapter(proposal,backend);assert.equal(out.verified,false);assert.equal(out.phase,'activated_pending_checkpoint');assert.equal(retired,false);assert.equal((await read()).active,proposal.plan.runtime_adapter.entrypoint);assert.equal((await read()).maintenance.mode,'maintenance');
 const interrupted=migrationBackend(f,'recovering'),activate=interrupted.activate;interrupted.activate=async(...args)=>{await activate(...args);throw Error('interrupted after activation');};const partial=await migrateRuntimeAdapter(proposal,interrupted);assert.equal(partial.phase,'activation_pending_reconciliation');assert.equal(partial.preserve_prior,false);assert.equal(partial.reconcile_actual_state,true);assert.equal((await interrupted.read()).active,proposal.plan.runtime_adapter.entrypoint);
});
