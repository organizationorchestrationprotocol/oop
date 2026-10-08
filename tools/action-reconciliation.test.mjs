import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createEnforcementEngine} from './enforcement-engine.mjs';
import {route} from './reference-engine.mjs';
const require=createRequire(import.meta.url),{runtimeFramework}=require('./runtime-framework.cjs'),{runtimeCoordination}=require('./runtime-coordination.cjs'),{runtimeAction}=require('./runtime-action.cjs');
const {installationContract}=require('./installation-contract.cjs'),{register}=require('./fixtures/oop-runtime-adapter.cjs');
const hash=x=>'sha256:'+createHash('sha256').update(x).digest('hex'),observe=(n,title,fn)=>test('REL-ACTION-'+String(n).padStart(3,'0')+': '+title,fn);
// Synthetic host context and administrative attestations test the real producer
// pipeline and filesystem. They certify no installed provider or native trust.
function fixture(t,{load=true,classification=true}={}){
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'oop-reconcile-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const common=join(root,'.priv','common'),uid='fixture-action',owned=join(root,'.priv','tools',uid);mkdirSync(common,{recursive:true});mkdirSync(owned,{recursive:true});
 const target=join(root,'target.txt'),checkpoint=join(owned,'checkpoint.json');writeFileSync(target,'initial');
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8'),adapter=register(owned,template,{decode:"const {action,resource,interaction,outcome,...request}=raw;return {native_event:context.command,session:raw.session,request,resource,action,...(interaction?{interaction}:{}),...(Object.hasOwn(raw,'outcome')?{outcome}:{})};"});
 const config=require('../dist/oop-enforce.js').config,record={format:1,installation_uid:uid,machine_id:'fixture-machine',runtime_class:'fixture',project_root:root,private_root:join(root,'.priv'),common_scope:common,owned_scope:owned,controller_locator:resolve('dist/oop-enforce.js'),controller_source_identity:config.source_binding.source_identity,filesystem_local:true,filesystem_case_sensitive:process.platform!=='win32',mode:'advisory',protected_configuration_paths:[],recap_threshold:100,runtime_adapter:adapter,governed_stores:[],instruction_sources:{organization:null,workspace:null},runtime_invocation:['node','<command>']};
 const spec={path:join(owned,'registration.json'),identity:'sha256:'+'c'.repeat(64)};
 writeFileSync(join(common,'workspace-binding.json'),JSON.stringify({format:1,workspace:root,revision:'1',runtimes:[{installation_uid:uid,runtime:'fixture',owned_scope:owned,checkpoint_ref:checkpoint,identity_basis:'persistent_integration',status:'active'}]}));
 writeFileSync(checkpoint,JSON.stringify({workspace:root,installation_uid:uid,runtime:'fixture',checkpoint_ref:checkpoint,mapping_revision:'1',revision:1,status:'installed',verified_commit:'a'.repeat(40),target_commit:'a'.repeat(40),source_identity:config.source_binding.source_identity}));
 const base=runtimeCoordination(resolve('dist')),coordination={...base,registration:()=>({ok:true,record,...spec})},engine=createEnforcementEngine(config,route,installationContract(),coordination),framework=runtimeFramework(engine,coordination,template),session='fixture-session';
 let calls=0;
 const coordinate=(command,body)=>{const result=framework.dispatch(command,{session,...body},spec,'fixture-host');assert.ok(result.stdout,JSON.stringify(result));return JSON.parse(result.stdout);};
 const raw=(command='pre-effect',id='attempt-'+(++calls))=>({session,request_id:id,scope:{classification:'unknown',request:['interaction']},context:{session},action:{operation:['completion','delegate'].includes(command)?'finish':'file.write',arguments:['completion','delegate'].includes(command)?{turn_id:'turn',last_assistant_message:'fixture answer',stop_hook_active:false}:{path:target,content:'authorized'}}});
 const dispatch=(command='pre-effect',input=raw(command))=>{const r=framework.dispatch(command,input,spec,'fixture-host');assert.ok(r.stdout,JSON.stringify(r));return JSON.parse(r.stdout);};
 const interact=(text='Perform the scoped fixture file change.',turn_id='fixture-turn')=>dispatch('interaction',{...raw('interaction'),interaction:{text,turn_id}});
 dispatch('entry',raw('entry'));interact();coordinate('load',{tier:1});const instructions=coordinate('load',{scope:'instructions'});assert.equal(instructions.accepted,true);
 const classify=(patch={})=>coordinate('declare',{phase:'classification',facets:['local_write'],level:'G1',resources:[target,owned],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'none'},instructions_identity:instructions.result.identity,...patch});
 if(classification)assert.equal(classify().accepted,true);
 const selected=engine.select({classification:'known',request:['interaction','local_write'],action:['local_write']}).modules;
 const loadModules=(ids=selected)=>{for(let i=0;i<ids.length;i+=16)assert.equal(coordinate('load',{tier:3,modules:ids.slice(i,i+16)}).accepted,true);};if(load)loadModules();
 const state=()=>coordination.actionState(session,{reg:{record}});
 const adminPath=join(owned,'administration.json');
 writeFileSync(adminPath,JSON.stringify({format:1,installation_uid:uid,source_identity:config.source_binding.source_identity,registration_identity:spec.identity,consent:'approved',enabled:true,restart:'not_required',authority_reference:state().request_reference}));
 const assessment=(command='pre-effect',patch={})=>{
  const pending=coordinate('load',{scope:'action',command});assert.equal(pending.accepted,true,JSON.stringify(pending));
  const receipt=pending.result.action,modules=engine.select({classification:'known',request:['interaction',...state().facets,...(patch.facets??[])],action:[patch.effect_class??'local_write']}).modules;
  const ids=[...new Set([...config.commands[command].required,...config.contracts.filter(c=>modules.includes(c.module)).map(c=>'semantic:'+c.id),'remaining_action_authorized','safe_continuation'])];
  const judgments=Object.fromEntries(ids.filter(runtimeAction().interpretive).map(id=>[id,{value:true,reason:'Apply the complete current contract to the actual scoped fixture input and observed state.',source_refs:[state().request_reference,...(id.startsWith('semantic:')?[id.slice(9)]:[])]}]));
  const value={action_identity:receipt.action_identity,generation:receipt.generation,command,facets:['local_write'],effect_class:'local_write',purpose:'work',effects:['completion','delegate'].includes(command)?[]:[{path:target,access:'write',expected_identity:hash(readFileSync(target))}],judgments,...patch};
  const body={phase:'assessment',expected_revision:pending.result.state_revision,assessment:value};return {value,body,pending};
 };
 const assess=(command='pre-effect',patch={})=>{const a=assessment(command,patch),result=coordinate('declare',a.body);assert.equal(result.accepted,true,JSON.stringify(result));return {result,...a};};
 const admit=()=>{dispatch();assess();const request=raw(),r=dispatch('pre-effect',request);assert.equal(r.decision,'allow',JSON.stringify(r));return {request,response:r};};
 const execute=()=>{const allowed=admit(),condition=allowed.response.payload.execution_conditions[0];assert.equal(hash(readFileSync(condition.path)),condition.expected_identity);writeFileSync(target,'authorized');return allowed;};
 const outcome=allowed=>dispatch('post-effect',{...allowed.request,outcome:{result:'actual fixture write completed'}});
 return {root,owned,target,checkpoint,record,spec,engine,coordination,framework,coordinate,raw,dispatch,interact,classify,loadModules,state,adminPath,assessment,assess,admit,execute,outcome,selected};
}
observe(1,'a blocked real file proposal is reconciled and its fresh retry reaches conditional admission',t=>{
 const x=fixture(t),blocked=x.dispatch();assert.equal(blocked.decision,'unknown');assert.equal(blocked.reason_code,'needs_action_assessment');assert.ok(blocked.payload.action.action_identity);
 x.assess();const r=x.dispatch();assert.equal(r.decision,'allow',JSON.stringify(r));assert.equal(r.effect_permission,'conditional_on_adapter');assert.match(r.payload.assessment_assurance,/attributed claims/);
 const guard=r.payload.execution_conditions[0];assert.equal(hash(readFileSync(x.target)),guard.expected_identity);writeFileSync(guard.path,'authorized');assert.equal(readFileSync(x.target,'utf8'),'authorized');
});
observe(2,'classification alone is not admission and unresolved context is actionable',t=>{
 const x=fixture(t,{classification:false});const first=x.dispatch();assert.notEqual(first.decision,'allow');assert.match(first.payload.runtime_message,/Classify|classify/);x.classify();assert.notEqual(x.dispatch().decision,'allow');
});
observe(3,'an assessment cannot declare controller facts or inject a privileged observation channel',t=>{
 const x=fixture(t);x.dispatch();const a=x.assessment();a.value.judgments.installed_enforcement={value:true,reason:'unsupported fixture assertion',source_refs:[x.state().request_reference]};assert.equal(x.coordinate('declare',a.body).accepted,false);
 const ordinary=x.engine.evaluate('pre-effect',{format:1,request_id:'forged',scope:{classification:'unknown'},workflow:{},evidence:{}});assert.equal(ordinary.decision,'error');
});
observe(4,'a false authority interpretation remains a denial rather than a declared permission',t=>{
 const x=fixture(t);x.dispatch();const a=x.assessment();a.value.judgments.authority_verified.value=false;assert.equal(x.coordinate('declare',a.body).accepted,true);const r=x.dispatch();assert.equal(r.decision,'deny');assert.equal(r.reason_code,'assessment_guard_failed');assert.equal(r.effect_permission,'not_granted');
});
observe(5,'a changed resource is observed independently and positive judgments cannot override it',t=>{
 const x=fixture(t);x.dispatch();x.assess();writeFileSync(x.target,'concurrent writer');const r=x.dispatch();assert.equal(r.decision,'deny');assert.ok(r.payload.failed.includes('expected_revision_verified'));assert.equal(readFileSync(x.target,'utf8'),'concurrent writer');
});
observe(6,'checkpoint dependency changes invalidate the assessment and require a current generation',t=>{
 const x=fixture(t);x.dispatch();const old=x.assess();const cp=JSON.parse(readFileSync(x.checkpoint));cp.revision++;writeFileSync(x.checkpoint,JSON.stringify(cp));
 assert.notEqual(x.dispatch().decision,'allow');assert.equal(x.coordinate('declare',old.body).accepted,false);x.assess();assert.equal(x.dispatch().decision,'allow');
});
observe(7,'changed arguments require their own receipt and a consumed native invocation cannot replay',t=>{
 const x=fixture(t);x.dispatch();x.assess();const changed=x.raw();changed.action.arguments.content='different';assert.notEqual(x.dispatch('pre-effect',changed).decision,'allow');
 x.dispatch();x.assess();const raw=x.raw();assert.equal(x.dispatch('pre-effect',raw).decision,'allow');assert.notEqual(x.dispatch('pre-effect',raw).decision,'allow');x.assess();assert.equal(x.dispatch('pre-effect',raw).reason_code,'action_claim_rejected');
});
observe(8,'new input and a G0 reclassification cannot reuse an old effect assessment',t=>{
 const x=fixture(t);x.dispatch();x.assess();x.interact('Only inspect; do not modify the file.','changed-turn');assert.notEqual(x.dispatch().decision,'allow');
 assert.equal(x.classify({level:'G0',facets:['information'],basis:{governed_mutation:false,subject_scope:'current_project',work_item_reason:'none'}}).accepted,true);x.assess();assert.notEqual(x.dispatch().decision,'allow');
});
observe(9,'missing module availability is an actual false guard until the real context load repairs it',t=>{
 const x=fixture(t,{load:false});x.dispatch();x.assess();const r=x.dispatch();assert.equal(r.decision,'deny');assert.ok(r.payload.failed.includes('context_delivered_verified'));x.loadModules();assert.equal(x.dispatch().decision,'allow');
});
observe(10,'pending adoption bookkeeping is scoped and never synthesizes installation predicates',t=>{
 const x=fixture(t),cp=JSON.parse(readFileSync(x.checkpoint));cp.status='pending';cp.target_commit='b'.repeat(40);writeFileSync(x.checkpoint,JSON.stringify(cp));rmSync(x.adminPath);
 const request=x.raw();request.action.arguments={path:x.checkpoint,content:'pending reconciliation'};x.dispatch('pre-effect',request);
 x.assess('pre-effect',{purpose:'bookkeeping',effects:[{path:x.checkpoint,access:'write',expected_identity:hash(readFileSync(x.checkpoint))}]});
 const r=x.dispatch('pre-effect',{...request,request_id:'bookkeeping-retry'});assert.equal(r.decision,'allow',JSON.stringify(r));assert.ok(!r.payload.checked.includes('installed_enforcement'));assert.ok(!r.payload.checked.includes('checkpoint_current_verified'));
});
observe(11,'bookkeeping cannot expand to code, native configuration or other files',t=>{
 const x=fixture(t);x.dispatch();x.assess('pre-effect',{purpose:'bookkeeping'});assert.notEqual(x.dispatch().decision,'allow');
 const r=x.raw();r.action.arguments.path=x.record.runtime_adapter.path;x.dispatch('pre-effect',r);x.assess('pre-effect',{effects:[{path:x.record.runtime_adapter.path,access:'write',expected_identity:hash(readFileSync(x.record.runtime_adapter.path))}]});assert.equal(x.dispatch('pre-effect',r).reason_code,'protected_control_effect');
});
observe(12,'an observed administrative receipt must match current source, registration and native disposition',t=>{
 const x=fixture(t);x.dispatch();x.assess();const receipt=JSON.parse(readFileSync(x.adminPath));receipt.enabled=false;writeFileSync(x.adminPath,JSON.stringify(receipt));const r=x.dispatch();assert.equal(r.decision,'deny');assert.ok(r.payload.failed.includes('installed_enforcement'));
});
observe(13,'postconditions are reconciled from the recorded actual outcome without repeating its effect',t=>{
 const x=fixture(t),a=x.execute(),blocked=x.outcome(a);assert.notEqual(blocked.decision,'allow');
 const no=x.assessment('post-effect');no.value.judgments.postconditions_verified.value=false;const denied=x.coordinate('declare',no.body);assert.equal(denied.result.reconciliation.decision,'deny');
 const fixed=x.assess('post-effect');assert.equal(fixed.result.result.reconciliation.decision,'allow',JSON.stringify(fixed.result));assert.equal(readFileSync(x.target,'utf8'),'authorized');
});
observe(14,'completion can request one safe control-plane repair but unchanged retries do not loop',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');const first=x.dispatch('completion');assert.equal(first.payload.completion.continuation_permitted,true);
 assert.match(first.payload.runtime_message,/Next authorized continuation: Load/);const again=x.dispatch('completion');assert.equal(again.payload.completion.continuation_permitted,false);
});
observe(15,'new turn context can reconcile a prior completion and finish with changed presentation only',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');const first=x.dispatch('completion');assert.equal(first.payload.completion.continuation_permitted,true);
 x.interact('Apply the controller corrective context, then finish the same task.','repair-turn');assert.equal(x.classify().accepted,true);x.assess('completion');const retry=x.raw('completion');retry.action.arguments.last_assistant_message='Completed with current evidence.';retry.action.arguments.turn_id='repair-turn';retry.action.arguments.stop_hook_active=true;
 const done=x.dispatch('completion',retry);assert.equal(done.decision,'allow',JSON.stringify(done));assert.equal(done.payload.completion.disposition,'satisfied');
});
observe(16,'resource changes after assessment construction prevent final permission',t=>{
 const x=fixture(t);x.dispatch();x.assess();const evaluate=x.engine.evaluate;x.engine.evaluate=(command,request,options)=>{if(command==='pre-effect'&&options?.workflow)writeFileSync(x.target,'changed during admission');return evaluate(command,request,options);};
 const r=x.dispatch();assert.notEqual(r.decision,'allow');assert.equal(r.reason_code,'action_dependency_changed');
});
observe(17,'unobserved source references do not become evidence for a semantic judgment',t=>{
 const x=fixture(t);x.dispatch();const a=x.assessment();a.value.judgments.authority_verified.source_refs.push('unobserved-source');assert.equal(x.coordinate('declare',a.body).accepted,true);
 const r=x.dispatch();assert.notEqual(r.decision,'allow');assert.ok(r.payload.missing.includes('authority_verified'));
});
observe(18,'bookkeeping cannot waive installation or adoption guards for overall completion',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');x.dispatch('completion');x.assess('completion',{purpose:'bookkeeping'});
 const r=x.dispatch('completion');assert.notEqual(r.decision,'allow');assert.equal(r.reason_code,'administrative_scope_unverified');
});
observe(19,'bounded replay receipts fail closed without evicting previously consumed invocations',t=>{
 const x=fixture(t);x.dispatch();x.assess();const sessions=join(x.owned,'sessions'),file=join(sessions,readdirSync(sessions)[0],'state.json'),state=JSON.parse(readFileSync(file));
 state.admitted_actions=Array.from({length:200},(_,i)=>hash(String(i)));writeFileSync(file,JSON.stringify(state));const r=x.dispatch();assert.notEqual(r.decision,'allow');assert.equal(r.reason_code,'action_claim_rejected');assert.equal(JSON.parse(readFileSync(file)).admitted_actions.length,200);
});
observe(20,'an admitted attempt with no matching observed outcome cannot be reported as completed',t=>{
 const x=fixture(t);x.admit();x.dispatch('completion');x.assess('completion');const r=x.dispatch('completion');assert.equal(r.decision,'deny');assert.ok(r.payload.failed.includes('actual_effects_observed'));
});
observe(21,'failed delivery invalidates cached context instead of turning construction into availability proof',t=>{
 const x=fixture(t);const delivery=x.framework.dispatch('load',{session:'fixture-session',tier:3,modules:['core']},x.spec,'fixture-host');delivery.onDeliveryFailure();
 assert.equal(x.state().context_integrity,'stale');assert.deepEqual(x.state().loaded_modules,{});assert.notEqual(x.dispatch().decision,'allow');
});
observe(22,'registered native configuration remains protected even under a positive project assessment',t=>{
 const x=fixture(t),native=join(x.root,'native-policy.json');writeFileSync(native,'{"enabled":true}');x.record.protected_configuration_paths=[native];
 x.classify({resources:[x.target,x.owned,native]});const raw=x.raw();raw.action.arguments.path=native;x.dispatch('pre-effect',raw);x.assess('pre-effect',{effects:[{path:native,access:'write',expected_identity:hash(readFileSync(native))}]});
 const r=x.dispatch('pre-effect',{...raw,request_id:'native-config-retry'});assert.equal(r.decision,'deny');assert.equal(r.reason_code,'protected_control_effect');assert.equal(readFileSync(native,'utf8'),'{"enabled":true}');
});
observe(23,'changing only classification labels does not manufacture continuation progress',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');assert.equal(x.dispatch('completion').payload.completion.continuation_permitted,true);
 x.classify({facets:['local_write','information']});const next=x.assessment('completion',{continuation:{next_action:'Finish the same authorized fixture work.'}});next.value.judgments.requirements_complete.value=false;assert.equal(x.coordinate('declare',next.body).accepted,true);
 assert.equal(x.dispatch('completion').payload.completion.continuation_permitted,false);
});
observe(24,'fresh execution ids with unchanged outcome and file content are not new continuation progress',t=>{
 const x=fixture(t),first=x.execute();x.outcome(first);x.assess('post-effect');assert.equal(x.dispatch('completion').payload.completion.continuation_permitted,true);
 const again=x.execute();x.outcome(again);x.assess('post-effect');const next=x.assessment('completion',{continuation:{next_action:'Finish the same authorized fixture work.'}});next.value.judgments.requirements_complete.value=false;assert.equal(x.coordinate('declare',next.body).accepted,true);
 assert.equal(x.dispatch('completion').payload.completion.continuation_permitted,false);
});
