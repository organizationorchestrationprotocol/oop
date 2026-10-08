import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync,existsSync,linkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createEnforcementEngine} from './enforcement-engine.mjs';
import {route} from './reference-engine.mjs';
const require=createRequire(import.meta.url),{runtimeFramework}=require('./runtime-framework.cjs'),{runtimeCoordination}=require('./runtime-coordination.cjs'),{runtimeAction}=require('./runtime-action.cjs');
const {installationContract}=require('./installation-contract.cjs'),{register,descriptor}=require('./fixtures/oop-runtime-adapter.cjs');
const hash=x=>'sha256:'+createHash('sha256').update(x).digest('hex'),observe=(n,title,fn)=>test('REL-ACTION-'+String(n).padStart(3,'0')+': '+title,fn);
// Synthetic host context and administrative attestations test the real producer
// pipeline and filesystem. Provider and native trust records retain their own scope.
function fixture(t,{load=true,classification=true,consentSession=null,normalization,caseSensitive=process.platform!=='win32'}={}){
 const root=realpathSync.native(mkdtempSync(join(tmpdir(),'oop-reconcile-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const common=join(root,'.priv','common'),uid='fixture-action',owned=join(root,'.priv','tools',uid);mkdirSync(common,{recursive:true});mkdirSync(owned,{recursive:true});
 const target=join(root,'target.txt'),checkpoint=join(owned,'checkpoint.json');writeFileSync(target,'initial');
 const template=readFileSync('tools/evidence/reference/templates/oop-runtime-adapter.js','utf8'),adapter=register(owned,template,{descriptor:{...descriptor(),action_normalization:{finish:{defaults:{},paths:[],presentation:true,documentation:0},...(normalization??{})}},decode:"const {action,resource,interaction,outcome,...request}=raw;return {native_event:context.command,session:raw.session,request,resource,action,...(interaction?{interaction}:{}),...(Object.hasOwn(raw,'outcome')?{outcome}:{})};"});
 const config=require('./evidence/reference/oop-enforce.js').config,record={format:1,installation_uid:uid,machine_id:'fixture-machine',runtime_class:'fixture',project_root:root,private_root:join(root,'.priv'),common_scope:common,owned_scope:owned,controller_locator:resolve('tools/evidence/reference/oop-enforce.js'),controller_source_identity:config.source_binding.source_identity,filesystem_local:true,filesystem_case_sensitive:caseSensitive,protected_configuration_paths:[],recap_threshold:100,runtime_adapter:adapter,governed_stores:[],instruction_sources:{organization:null,workspace:null},runtime_invocation:['node','<command>']};
 const spec={path:join(owned,'registration.json'),identity:'sha256:'+'c'.repeat(64)};
 writeFileSync(join(common,'workspace-binding.json'),JSON.stringify({format:1,workspace:root,revision:'1',runtimes:[{installation_uid:uid,runtime:'fixture',owned_scope:owned,checkpoint_ref:checkpoint,identity_basis:'persistent_integration',status:'active'}]}));
 writeFileSync(checkpoint,JSON.stringify({workspace:root,installation_uid:uid,runtime:'fixture',checkpoint_ref:checkpoint,mapping_revision:'1',revision:1,status:'installed',verified_commit:'a'.repeat(40),target_commit:'a'.repeat(40),source_identity:config.source_binding.source_identity}));
 const base=runtimeCoordination(resolve('tools/evidence/reference')),coordination={...base,registration:()=>({ok:true,record,...spec})},engine=createEnforcementEngine(config,route,installationContract(),coordination),framework=runtimeFramework(engine,coordination,template),session='fixture-session';
 let calls=0;
 const coordinate=(command,body)=>{const result=framework.dispatch(command,{session,...body},spec,'fixture-host');assert.ok(result.stdout,JSON.stringify(result));return JSON.parse(result.stdout);};
 const raw=(command='pre-effect',id='attempt-'+(++calls))=>({session,request_id:id,scope:{classification:'unknown',request:['interaction']},context:{session},action:{operation:['completion','delegate'].includes(command)?'finish':'file.write',arguments:['completion','delegate'].includes(command)?{}:{path:target,content:'authorized'},...(['completion','delegate'].includes(command)?{presentation:{event_id:'turn',message:'fixture answer',active:false}}:{})}});
 const dispatch=(command='pre-effect',input=raw(command))=>{const r=framework.dispatch(command,input,spec,'fixture-host');assert.ok(r.stdout,JSON.stringify(r));return JSON.parse(r.stdout);};
 const interact=(text='Perform the scoped fixture file change.',turn_id='fixture-turn')=>dispatch('interaction',{...raw('interaction'),interaction:{text,turn_id}});
 dispatch('entry',raw('entry'));interact();coordinate('load',{tier:1});const instructions=coordinate('load',{scope:'instructions'});assert.equal(instructions.accepted,true);
 const classify=(patch={})=>coordinate('declare',{phase:'classification',facets:['local_write'],level:'G1',resources:[target,owned],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'none'},instructions_identity:instructions.result.identity,...patch});
 if(classification)assert.equal(classify().accepted,true);
 const selected=engine.select({classification:'known',request:['interaction','local_write'],action:['local_write']}).modules;
 const loadModules=(ids=selected)=>{
  for(let i=0;i<ids.length;i+=16){
   const modules=ids.slice(i,i+16);
   let cursor;
   do {
    const response=coordinate('load',{tier:3,modules,...(cursor===undefined?{}:{cursor})});
    assert.equal(response.accepted,true,JSON.stringify(response));
    cursor=response.result.paging?.next_cursor;
   } while(cursor!==undefined);
  }
 };if(load)loadModules();
 const state=()=>coordination.actionState(session,{reg:{record}});
 const adminPath=join(owned,'administration.json');
 // The receipt names the observed authorizing input and its session: by default this one,
 // or a separate installation session whose approval later sessions reuse.
 const consent=consentSession??session;
 if(consentSession)for(const command of ['entry','interaction'])framework.dispatch(command,{...raw(command),session:consent,context:{session:consent},...(command==='interaction'?{interaction:{text:'Approve the fixture enforcement installation.',turn_id:'installation-turn'}}:{})},spec,'fixture-host');
 writeFileSync(adminPath,JSON.stringify({format:1,installation_uid:uid,source_identity:config.source_binding.source_identity,native_configuration_identity:runtimeAction().nativeIdentity(record),consent:'approved',enabled:true,restart:'not_required',authority_session:consent,authority_reference:coordination.actionState(consent,{reg:{record}}).request_reference}));
 const assessment=(command='pre-effect',patch={})=>{
  const pending=coordinate('load',{scope:'action',command});assert.equal(pending.accepted,true,JSON.stringify(pending));
  const receipt=pending.result.action,modules=engine.select({classification:'known',request:['interaction',...state().facets,...(patch.facets??[])],action:[patch.effect_class??'local_write']}).modules;
  const ids=[...new Set([...config.commands[command].required,...config.contracts.filter(c=>modules.includes(c.module)).map(c=>'semantic:'+c.id),'remaining_action_authorized','safe_continuation'])];
  const judgments=Object.fromEntries(ids.filter(runtimeAction().interpretive).map(id=>[id,{value:true,reason:'Apply the complete current contract to the actual scoped fixture input and observed state.',source_refs:[state().request_reference,...(id.startsWith('semantic:')?[id.slice(9)]:[])]}]));
  const value={action_identity:receipt.action_identity,generation:receipt.generation,command,facets:['local_write'],effect_class:'local_write',purpose:'work',effects:Object.hasOwn(patch,'effects')?patch.effects:['completion','delegate'].includes(command)?[]:[{path:target,access:'write',expected_identity:hash(readFileSync(target))}],judgments,...patch};
  if(value.effects===undefined)delete value.effects;
  if(existsSync(join(owned,'procedures.json'))){const candidates=coordinate('load',{scope:'procedures',command,effect_class:value.effect_class}).result.procedures??[];if(candidates.length)value.procedure_reviews=candidates.map(p=>({id:p.id,identity:p.identity,disposition:'applied',reason:'Apply this parameterized method after evaluating its conditions and exceptions for the current fixture request.',source_refs:[state().request_reference,p.identity]}));}
  const body={phase:'assessment',expected_revision:state().revision,assessment:value};return {value,body,pending};
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
 const x=fixture(t,{classification:false});const first=x.dispatch();assert.notEqual(first.decision,'allow');assert.match(first.payload.runtime_message,/declare phase=classification/);x.classify();assert.notEqual(x.dispatch().decision,'allow');
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
observe(71,'bounded module pages reconstruct the complete contract records before registering delivery',t=>{
 const x=fixture(t,{load:false}),request={tier:3,modules:['core','entry','context']};
 const original=Object.fromEntries(request.modules.map(id=>[id,JSON.parse(readFileSync('dist/modules/'+id+'.json','utf8'))]));
 const reconstructed={};
 assert.equal(x.coordinate('load',{...request,cursor:1}).reason,'invalid_cursor');
 assert.equal(x.coordinate('load',{...request,cursor:'1'}).reason,'invalid_cursor');
 let cursor=0;
 do {
  const page=x.coordinate('load',{...request,cursor});
  assert.equal(page.accepted,true);
  assert.ok(Buffer.byteLength(JSON.stringify(page))<=20000);
  for(const part of page.result.module_parts){
   if(part.record)reconstructed[part.id]={...part.record,contracts:[]};
   if(part.contract)reconstructed[part.id].contracts[part.index]={...part.contract};
   if(part.semantic_clause_part!==undefined){
    const contract=reconstructed[part.id].contracts[part.index];
    contract.semantic_clause=(contract.semantic_clause??'')+part.semantic_clause_part;
   }
   if(part.complete)assert.deepEqual(reconstructed[part.id],original[part.id]);
  }
  if(cursor===0)assert.equal(x.state().loaded_modules.core,undefined);
  cursor=page.result.paging.next_cursor;
 }while(cursor!==undefined);
 assert.deepEqual(Object.keys(x.state().loaded_modules).sort(),request.modules.sort());
});
observe(72,'coordination exposes its current request schema and diagnostic field paths',t=>{
 const x=fixture(t,{load:false,classification:false});
 const challenge=x.dispatch().payload.action;
 assert.equal(challenge.classification_required.phase,'classification');
 assert.equal(challenge.classification_required.expected_revision,x.state().revision);
 assert.equal(challenge.declare_template.assessment.action_identity,challenge.action_identity);
 assert.equal(challenge.declare_template.expected_revision,x.state().revision);
 const discovery=x.coordinate('load',{scope:'interface'});
 const index=JSON.parse(readFileSync('dist/index.json','utf8'));
 const context=JSON.parse(readFileSync('dist/modules/context.json','utf8'));
 assert.match(index.directive,/Use additional context to orient the current turn/);
 assert.ok(index.bytes<=index.budgets.runtime_index_bytes);
 assert.ok(context.contracts.some(contract=>contract.semantic_clause.includes('Use contextual guidance') || contract.semantic_clause.includes('Instruct the runtime to use contextual guidance')));
 const {schema,direct_reads}=discovery.result;
 assert.equal(discovery.effect_permission,'not_granted');
 assert.deepEqual(direct_reads.operations,{
  search:{available:false,reason:'direct_read_execution_unavailable'},
  digest:{available:false,reason:'direct_read_execution_unavailable'}
 });
 assert.deepEqual(schema.properties.cursor,{type:'integer',minimum:0,maximum:31});
 assert.ok(schema.properties.scope.enum.includes('interface'));
 const rejection=x.coordinate('declare',{phase:'assessment',action_identity:'misplaced'});
 assert.equal(rejection.reason,'invalid_envelope');
 assert.ok(rejection.result.problems.some(problem=>problem.path==='action_identity'));
 const malformed=x.coordinate('declare',{phase:'assessment',expected_revision:x.state().revision,assessment:{generation:'1'}});
 assert.ok(malformed.result.problems.some(problem=>problem.path==='assessment.generation'));
});
observe(73,'the pre-effect receipt remains selectable after an interleaved blocked action',t=>{
 const x=fixture(t);
 const first=x.dispatch(),assessment=x.assessment();
 const other=x.raw();
 other.action.arguments.content='different';
 assert.notEqual(x.dispatch('pre-effect',other).decision,'allow');
 const receipt=x.coordinate('load',{scope:'action'}).result;
 assert.ok(receipt.recent_actions.some(action=>action.action_identity===first.payload.action.action_identity));
 assert.equal(x.coordinate('declare',{...assessment.body,expected_revision:receipt.state_revision}).accepted,true);
 assert.equal(x.dispatch().decision,'allow');
 assert.notEqual(x.dispatch().decision,'allow');
});
observe(74,'a directory and an asserted view remain unobservable under the file revision profile',t=>{
 const x=fixture(t),directory=join(x.root,'searchable');
 mkdirSync(directory);
 writeFileSync(join(directory,'entry.txt'),'match');
 assert.equal(x.classify({facets:['information'],level:'G0',resources:[],basis:{governed_mutation:false,subject_scope:'current_project',work_item_reason:'none'}}).accepted,true);
 const input=x.raw();
 const claimedIdentity=hash('unverified directory view');
 input.action={operation:'search',arguments:{path:directory,query:'match',view_identity:claimedIdentity}};
 input.resource={path:directory,access:'read',view_identity:claimedIdentity};
 const challenge=x.dispatch('pre-effect',input).payload.action;
 assert.deepEqual(challenge.resource_observations,[{path:directory,access:'read',identity:'not_eligible',reason:'effect_revision_unobservable'}]);
 assert.deepEqual(challenge.declare_template.assessment.effects,[]);
 x.assess('pre-effect',{facets:['information'],effect_class:'information',effects:[{path:directory,access:'read',expected_identity:claimedIdentity}]});
 const response=x.dispatch('pre-effect',{...input,request_id:x.raw().request_id});
 assert.equal(response.reason_code,'effect_revision_unobservable');
 assert.equal(response.effect_permission,'not_granted');
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
 assert.equal(first.payload.completion_diagnostic.reason_code,'assessment_missing');
 assert.equal(first.payload.completion_diagnostic.repetition.status,'first');
 assert.equal(again.payload.completion_diagnostic.repetition.status,'unchanged');
 assert.equal(again.payload.completion_diagnostic.repetition.prior,first.payload.completion_diagnostic.repetition.reference);
 assert.notEqual(again.decision,'allow');assert.doesNotMatch(again.payload.runtime_message,/Next authorized continuation/);
});
observe(75,'registered completion assessment is diagnosed across stable and changed receipts',t=>{
 const x=fixture(t),effect=x.execute();x.outcome(effect);x.assess('post-effect');
 const first=x.dispatch('completion').payload.completion_diagnostic;
 const draft=x.assessment('completion');delete draft.value.judgments.tests_verified;
 const recorded=x.coordinate('declare',draft.body).result.assessment;
 assert.equal(recorded.status,'recorded');assert.equal(recorded.validation,'not_evaluated');assert.deepEqual(recorded.receipt,first.correlation.receipt);
 const stable=x.dispatch('completion').payload.completion_diagnostic;
 assert.equal(stable.reason_code,'assessment_incomplete');assert.equal(stable.findings.assessment.reference,recorded.reference);
 assert.equal(stable.findings.prerequisites.tests_verified.status,'indeterminate');
 assert.equal(stable.findings.prerequisites.actual_effects_observed.status,'satisfied');
 assert.equal(stable.repetition.status,'changed');assert.deepEqual(stable.correlation.receipt,recorded.receipt);
 assert.equal(x.dispatch('completion').payload.completion_diagnostic.repetition.status,'unchanged');
 const checkpoint=JSON.parse(readFileSync(x.checkpoint));checkpoint.revision++;
 writeFileSync(x.checkpoint,JSON.stringify(checkpoint));
 const stale=x.dispatch('completion').payload.completion_diagnostic;
 assert.equal(stale.reason_code,'assessment_stale');
 assert.ok(stale.findings.assessment.changed_bindings.includes('dependencies'));
 const different=x.raw('completion');different.action.arguments.target='changed material target';
 const changed=x.dispatch('completion',different).payload.completion_diagnostic;
 assert.equal(changed.reason_code,'assessment_for_different_action');
 assert.equal(changed.findings.assessment.reference,recorded.reference);
 assert.ok(changed.findings.assessment.changed_bindings.includes('action_identity'));
 assert.notDeepEqual(changed.correlation.receipt,recorded.receipt);
 const corrected=x.assess('completion').result.result.assessment;
 const allowed=x.dispatch('completion',different).payload.completion_diagnostic;
 assert.equal(allowed.decision,'allow');assert.equal(allowed.findings.assessment.status,'used');
 assert.equal(allowed.findings.assessment.reference,corrected.reference);
});
observe(76,'completion diagnoses classification and the current paged module closure',t=>{
 const x=fixture(t,{classification:false,load:false});
 const first=x.dispatch('completion').payload.completion_diagnostic;
 assert.equal(first.reason_code,'classification_missing');assert.equal(first.findings.dependent_checks.status,'not_evaluated');
 assert.equal(x.classify().accepted,true);x.dispatch('completion');x.assess('completion');
 const blocked=x.dispatch('completion').payload.completion_diagnostic;
 assert.equal(blocked.reason_code,'module_closure_incomplete');
 const input=blocked.next_operation.inputs;
 const page=x.coordinate('load',input);
 assert.equal(page.accepted,true);assert.ok(Number.isInteger(page.result.paging.next_cursor));
 const next=x.dispatch('completion').payload.completion_diagnostic;
 assert.equal(next.next_operation.inputs.cursor,page.result.paging.next_cursor);
 assert.equal(x.coordinate('load',next.next_operation.inputs).accepted,true);
});
observe(70,'an informational declaration does not schedule an automatic assessment repair',t=>{
 const x=fixture(t,{classification:false});
 x.interact('Explain the fixture without changing it.','information-turn');
 assert.equal(x.classify({facets:['information'],level:'G0',resources:[],basis:{governed_mutation:false,subject_scope:'current_project',work_item_reason:'none'}}).accepted,true);
 const result=x.dispatch('completion');
 assert.equal(result.payload.completion.continuation_permitted,false);
 assert.equal(result.effect_permission,'not_granted');
});
observe(15,'new turn context can reconcile a prior completion and finish with changed presentation only',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');const first=x.dispatch('completion');assert.equal(first.payload.completion.continuation_permitted,true);
 x.interact('Apply the controller corrective context, then finish the same task.','repair-turn');assert.equal(x.classify().accepted,true);x.assess('completion');const retry=x.raw('completion');retry.action.presentation.message='Completed with current evidence.';retry.action.presentation.event_id='repair-turn';retry.action.presentation.active=true;
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
observe(25,'an installation-scoped administrative receipt stays current in a later session and fails closed on an unobserved authority',t=>{
 const x=fixture(t,{consentSession:'fixture-installation'});assert.equal(x.admit().response.decision,'allow');
 const receipt=JSON.parse(readFileSync(x.adminPath));
 for(const patch of [{authority_session:'fixture-unobserved'},{authority_reference:x.state().request_reference},{authority_session:undefined}]){
  writeFileSync(x.adminPath,JSON.stringify({...receipt,...patch}));x.dispatch();x.assess();const r=x.dispatch();
  assert.equal(r.decision,'deny');assert.ok(r.payload.failed.includes('installed_enforcement'),JSON.stringify(r.payload.failed));
 }
});

function preparedAssessment(x,command='pre-effect',patch={}){
 const candidates=existsSync(join(x.owned,'procedures.json'))?(x.coordinate('load',{scope:'procedures',command,effect_class:'local_write'}).result.procedures??[]):[];
 const input=x.raw(command),p=x.coordinate('declare',{phase:'preparation',expected_revision:x.state().revision,preparation:{command,operation:input.action.operation,arguments:input.action.arguments}});
 assert.equal(p.accepted,true,JSON.stringify(p));const loaded=x.coordinate('load',{scope:'preparation',command}),plan=loaded.result.preparation;
 const config=x.engine.config,ids=[...new Set([...config.commands[command].required,...config.contracts.filter(c=>x.selected.includes(c.module)).map(c=>'semantic:'+c.id)])];
 const judgments=Object.fromEntries(ids.filter(runtimeAction().interpretive).map(id=>[id,{value:true,reason:'Evaluate the complete clause for this proposed fixture action using current request and resource observations.',source_refs:[x.state().request_reference,...(id.startsWith('semantic:')?[id.slice(9)]:[])]}]));
 const value={plan_identity:plan.plan_identity,action_identity:plan.action_identity,generation:plan.generation,command,facets:['local_write'],effect_class:'local_write',purpose:'work',effects:command==='pre-effect'?[{path:x.target,access:'write',expected_identity:hash(readFileSync(x.target))}]:[],judgments,...patch};
 if(candidates.length)value.procedure_reviews=candidates.map(p=>({id:p.id,identity:p.identity,disposition:'applied',reason:'Evaluate current applicability and use the parameterized method with fresh request and resource facts.',source_refs:[x.state().request_reference,p.identity]}));
 const body={phase:'preparation-assessment',expected_revision:loaded.result.state_revision,assessment:value};const assessed=x.coordinate('declare',body);assert.equal(assessed.accepted,true,JSON.stringify(assessed));return {input,plan,body};
}
function resolvedProcedure(x){
 x.dispatch();x.assess();const allowed=x.dispatch();assert.equal(allowed.decision,'allow',JSON.stringify(allowed));const guidance=allowed.payload.procedure_guidance;assert.ok(guidance.evidence_ref);
 const loaded=x.coordinate('load',{scope:'procedures'});assert.equal(loaded.accepted,true);
 const procedure={id:'proc-local-write',expected_version:0,command:'pre-effect',reason:'needs_action_assessment',effect_class:'local_write',subject_scope:'current_project',facets:['local_write'],parameters:guidance.parameters,steps:guidance.steps,conditions:['Current authorized local change with explicit resources.'],exceptions:[],rationale:'Generalize the preparation method; acquire target, revision and authority separately for every invocation.',evidence_refs:[guidance.evidence_ref]};
 const body={phase:'procedure',expected_revision:loaded.result.revision,procedure};return {body,guidance};
}
observe(26,'proposed preparation admits the first actual invocation and is consumed once',t=>{
 const x=fixture(t),p=preparedAssessment(x);assert.equal(x.state().pending_actions['pre-effect'],undefined);
 const first=x.dispatch('pre-effect',p.input);assert.equal(first.decision,'allow',JSON.stringify(first));assert.notEqual(x.dispatch('pre-effect',p.input).decision,'allow');
 const stored=readFileSync(join(x.owned,'sessions','fixture-session','state.json'),'utf8');assert.ok(!stored.includes('"content":"authorized"'));assert.match(stored,/proposed_action/);
});
observe(27,'changed arguments or dependencies cannot borrow proposed preparation',t=>{
 const x=fixture(t),p=preparedAssessment(x),changed=x.raw();changed.action.arguments.content='different';assert.notEqual(x.dispatch('pre-effect',changed).decision,'allow');
 const q=preparedAssessment(x);const cp=JSON.parse(readFileSync(x.checkpoint));cp.revision++;writeFileSync(x.checkpoint,JSON.stringify(cp));assert.notEqual(x.dispatch('pre-effect',q.input).decision,'allow');
});
observe(28,'planned judgments cannot override current resource revisions or false authority',t=>{
 const x=fixture(t),p=preparedAssessment(x);writeFileSync(x.target,'concurrent change');const denied=x.dispatch('pre-effect',p.input);assert.equal(denied.decision,'deny');assert.ok(denied.payload.failed.includes('expected_revision_verified'));
 const y=fixture(t),q=preparedAssessment(y);q.body.assessment.judgments.authority_verified.value=false;q.body.expected_revision=y.state().revision;assert.equal(y.coordinate('declare',q.body).accepted,true);assert.equal(y.dispatch('pre-effect',q.input).decision,'deny');
});
observe(29,'completion preparations normalize presentation only and remain one-use',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');const p=preparedAssessment(x,'completion');p.input.action.presentation.message='Updated presentation';
 const first=x.dispatch('completion',p.input);assert.equal(first.decision,'allow',JSON.stringify(first));assert.notEqual(x.dispatch('completion',p.input).decision,'allow');
});
observe(30,'correlated resolution supports a generalized candidate without concrete arguments',t=>{
 const x=fixture(t),r=resolvedProcedure(x),saved=x.coordinate('declare',r.body);assert.equal(saved.accepted,true,JSON.stringify(saved));
 const loaded=x.coordinate('load',{scope:'procedures',command:'pre-effect'});assert.equal(loaded.result.procedures.length,1);const p=loaded.result.procedures[0];assert.equal(p.status,'candidate');assert.equal(p.origin,'runtime_generalization');assert.deepEqual(p.parameters,r.guidance.parameters);
 const bytes=readFileSync(join(x.owned,'procedures.json'),'utf8');assert.ok(!bytes.includes(x.target));assert.ok(!bytes.includes('"content":"authorized"'));assert.match(bytes,/admission_resolution/);assert.ok(!bytes.includes('effect_verified'));
});
observe(31,'fabricated evidence and executable procedure steps are rejected',t=>{
 const x=fixture(t),r=resolvedProcedure(x);r.body.procedure.evidence_refs=['sha256:'+'f'.repeat(64)];assert.equal(x.coordinate('declare',r.body).reason,'procedure_evidence_unavailable');
 r.body.procedure.evidence_refs=[r.guidance.evidence_ref];r.body.procedure.steps.push('execute_shell');assert.equal(x.coordinate('declare',r.body).reason,'invalid_procedure');
});
observe(32,'refinement preserves conditions and stale concurrent revisions cannot overwrite it',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);const loaded=x.coordinate('load',{scope:'procedures'}),next={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,expected_version:1,exceptions:['A changed target requires a new observation.']}};
 assert.equal(x.coordinate('declare',next).accepted,true);assert.equal(x.coordinate('declare',next).reason,'stale_procedure_revision');const latest=x.coordinate('load',{scope:'procedures'});assert.equal(latest.result.procedures[0].version,2);assert.equal(latest.result.procedures[0].history.length,1);
 const widened={...next,expected_revision:latest.result.revision,procedure:{...next.procedure,expected_version:2,conditions:['Any action.']}};assert.equal(x.coordinate('declare',widened).reason,'procedure_scope_widening');
});
observe(33,'installation candidates survive a new session without reusing assessments',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);const raw=x.raw('entry');raw.session='next-session';raw.context.session='next-session';const out=x.framework.dispatch('entry',raw,x.spec,'fixture-host');assert.ok(out.stdout);
 const load=x.framework.dispatch('load',{session:'next-session',scope:'procedures'},x.spec,'fixture-host');assert.equal(JSON.parse(load.stdout).accepted,true);assert.equal(x.coordination.actionState('next-session',{reg:{record:x.record}}).assessments['pre-effect'],undefined);
 const instructions=JSON.parse(x.framework.dispatch('load',{session:'next-session',scope:'instructions'},x.spec,'fixture-host').stdout);
 const classified=JSON.parse(x.framework.dispatch('declare',{session:'next-session',phase:'classification',facets:['local_write'],level:'G1',resources:[x.target,x.owned],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'none'},instructions_identity:instructions.result.identity},x.spec,'fixture-host').stdout);assert.equal(classified.accepted,true);assert.ok(classified.result.procedure_guidance);
 const recovered=JSON.parse(x.framework.dispatch('load',{session:'next-session',scope:'procedures'},x.spec,'fixture-host').stdout);assert.equal(recovered.result.procedures[0].id,'proc-local-write');
 const peer=fixture(t);assert.equal(peer.coordinate('load',{scope:'procedures'}).result.procedures.length,0);
});
observe(34,'cache corruption is explicit and cannot negate independent admission',t=>{
 const x=fixture(t);x.dispatch();x.assess();writeFileSync(join(x.owned,'procedures.json'),'{');const allowed=x.dispatch();assert.equal(allowed.decision,'allow',JSON.stringify(allowed));assert.match(allowed.payload.runtime_message,/procedure cache unavailable/);
});
observe(35,'ordinary effects cannot overwrite the installation procedure cache',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);const path=join(x.owned,'procedures.json'),raw=x.raw();raw.action.arguments={path,content:'replace'};x.dispatch('pre-effect',raw);x.assess('pre-effect',{effects:[{path,access:'write',expected_identity:hash(readFileSync(path))}]});assert.equal(x.dispatch('pre-effect',raw).reason_code,'protected_control_effect');
});
observe(36,'positive native variants cannot discard required procedural context',()=>{
 const engine=require('./evidence/reference/oop-enforce.js'),{descriptor,complete}=require('./fixtures/oop-runtime-adapter.cjs'),d=descriptor({supported_commands:['pre-effect'],format:'message'});
 d.supported_commands['pre-effect']['pre-effect'].allow.stdout='';const result=engine.framework.validateManifest(complete(engine.config.adapter_template,{descriptor:d}));assert.equal(result.valid,false);assert.ok(result.diagnostics.some(d=>d.code==='corrective_message_not_forwarded'));
});

observe(37,'applicable candidates require current loaded and attributed procedure reviews',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);x.dispatch();const a=x.assessment();delete a.value.procedure_reviews;
 assert.equal(x.coordinate('declare',a.body).reason,'procedure_review_required');
 const good=x.assessment();assert.equal(x.coordinate('declare',good.body).accepted,true);
 const loaded=x.coordinate('load',{scope:'procedures'}),refined={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,expected_version:1,exceptions:['Current exceptions must be reevaluated.']}};assert.equal(x.coordinate('declare',refined).accepted,true);
 assert.equal(x.dispatch().reason_code,'procedure_review_required');x.assess();assert.equal(x.dispatch().decision,'allow');
});
observe(38,'unchanged definitions deduplicate while explicit restriction supersedes and invalidates',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);let loaded=x.coordinate('load',{scope:'procedures'});
 const unchanged={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,expected_version:1}};assert.equal(x.coordinate('declare',unchanged).result.version,1);
 const duplicate={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,id:'proc-duplicate'}};assert.equal(x.coordinate('declare',duplicate).reason,'procedure_equivalent_exists');
 const split={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,id:'proc-restricted',exceptions:['External effects are outside the procedure scope.'],supersedes:['proc-local-write']}};assert.equal(x.coordinate('declare',split).accepted,true);
 loaded=x.coordinate('load',{scope:'procedures'});assert.equal(loaded.result.procedures[0].id,'proc-restricted');
 const invalidated={...split,expected_revision:loaded.result.revision,procedure:{...split.procedure,expected_version:1,status:'invalidated'}};assert.equal(x.coordinate('declare',invalidated).accepted,true);assert.equal(x.coordinate('load',{scope:'procedures'}).result.procedures.length,0);
});
observe(39,'bounded observation retention reports exhaustion without fabricating permission',t=>{
 const x=fixture(t);x.dispatch();x.assess();const path=join(x.owned,'procedures.json'),observations=Object.fromEntries(Array.from({length:128},(_,i)=>['entry-'+i,{kind:'fixture'}]));writeFileSync(path,JSON.stringify({format:1,installation_uid:x.record.installation_uid,revision:1,procedures:{},observations}));
 const allowed=x.dispatch();assert.equal(allowed.decision,'allow',JSON.stringify(allowed));assert.match(allowed.payload.runtime_message,/procedure cache unavailable/);assert.equal(Object.keys(JSON.parse(readFileSync(path)).observations).length,128);
});
observe(40,'definition history exhaustion is explicit and preserves the retained version',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);
 for(let version=1;version<=8;version++){const loaded=x.coordinate('load',{scope:'procedures'});const body={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,expected_version:version,rationale:'Attributed refinement number '+version+' for the same bounded method.'}};assert.equal(x.coordinate('declare',body).accepted,true);}
 const loaded=x.coordinate('load',{scope:'procedures'});assert.equal(loaded.result.procedures[0].version,9);const next={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,expected_version:9,rationale:'Another attributed refinement.'}};assert.equal(x.coordinate('declare',next).reason,'procedure_history_full');
});
observe(41,'changed local bindings invalidate candidate reuse and new requests invalidate plans',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);const cp=JSON.parse(readFileSync(x.checkpoint));cp.revision++;writeFileSync(x.checkpoint,JSON.stringify(cp));assert.equal(x.coordinate('load',{scope:'procedures'}).result.procedures.length,0);
 const y=fixture(t),p=preparedAssessment(y);y.interact('A changed request has different governing context.','different-turn');y.classify();assert.notEqual(y.dispatch('pre-effect',p.input).decision,'allow');
});
observe(42,'aliased procedure storage is refused without changing the linked target',t=>{
 const x=fixture(t),other=join(x.root,'other-store.json');writeFileSync(other,JSON.stringify({format:1,installation_uid:x.record.installation_uid,revision:0,procedures:{},observations:{}}));const before=readFileSync(other,'utf8');linkSync(other,join(x.owned,'procedures.json'));
 x.dispatch();x.assess();const allowed=x.dispatch();assert.equal(allowed.decision,'allow');assert.match(allowed.payload.runtime_message,/procedure cache unavailable/);assert.equal(readFileSync(other,'utf8'),before);
});
observe(43,'admission evidence and matching post-effect reconciliation remain distinct',t=>{
 const x=fixture(t),a=x.execute();const before=JSON.parse(readFileSync(join(x.owned,'procedures.json')));assert.ok(Object.values(before.observations).every(o=>!o.outcomes));
 x.outcome(a);const observed=x.assess('post-effect').result.result.reconciliation;assert.equal(observed.decision,'allow',JSON.stringify(observed));
 const after=JSON.parse(readFileSync(join(x.owned,'procedures.json')));assert.ok(Object.values(after.observations).some(o=>o.outcomes?.length===1));
 const y=fixture(t),b=y.execute();y.outcome(b);const guide=y.coordination.guide;let changed=false;y.coordination.guide=(...args)=>{const result=guide(...args);if(args[1]==='post-effect'&&args[4].workflowRevision!==undefined&&!changed){changed=true;y.classify({resources:[y.target]});}return result;};const stale=y.assess('post-effect').result.result.reconciliation;assert.equal(stale.decision,'unknown');assert.equal(stale.reason_code,'action_dependency_changed');
});

observe(44,'paginated candidate retrieval cannot omit matching procedure reviews',t=>{
 const x=fixture(t),r=resolvedProcedure(x);
 for(let i=0;i<5;i++){const loaded=x.coordinate('load',{scope:'procedures'}),body={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,id:'proc-page-'+i,conditions:['Current authorized local change in case group '+i+'.']}};assert.equal(x.coordinate('declare',body).accepted,true);}
 const first=x.coordinate('load',{scope:'procedures'});assert.equal(first.result.total,5);assert.equal(first.result.procedures.length,4);assert.equal(first.result.next_cursor,4);
 x.dispatch();const a=x.assessment();assert.equal(x.coordinate('declare',a.body).reason,'procedure_review_required');
 const next=x.coordinate('load',{scope:'procedures',cursor:4});assert.equal(next.result.procedures.length,1);a.value.procedure_reviews.push(...next.result.procedures.map(p=>({id:p.id,identity:p.identity,disposition:'not_applicable',reason:'The declared case-group condition does not apply to the current request.',source_refs:[x.state().request_reference,p.identity]})));a.body.expected_revision=x.state().revision;assert.equal(x.coordinate('declare',a.body).accepted,true);assert.equal(x.dispatch().decision,'allow');
});
observe(45,'recurrences deduplicate and applied failures support attributed refinement',t=>{
 const x=fixture(t),r=resolvedProcedure(x);assert.equal(x.coordinate('declare',r.body).accepted,true);const raw=x.raw();raw.action.arguments.content='another authorized proposal';x.dispatch('pre-effect',raw);x.dispatch('pre-effect',raw);
 let loaded=x.coordinate('load',{scope:'procedures'}),p=loaded.result.procedures[0];assert.equal(p.recurrences.length,1);assert.equal(p.counterexamples.length,0);
 const a=x.assessment();a.value.judgments.authority_verified.value=false;assert.equal(x.coordinate('declare',a.body).accepted,true);assert.equal(x.dispatch('pre-effect',raw).decision,'deny');
 loaded=x.coordinate('load',{scope:'procedures'});p=loaded.result.procedures[0];assert.equal(p.counterexamples.length,1);const evidence=x.coordinate('load',{scope:'procedures',evidence_ref:p.counterexamples[0]});assert.equal(evidence.result.observation.kind,'applied_procedure_non_allow');assert.equal(evidence.result.observation.reason,'assessment_guard_failed');
 const refined={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,expected_version:1,exceptions:['A current owner denial requires resolution before retry.'],evidence_refs:[...r.body.procedure.evidence_refs,p.counterexamples[0]]}};assert.equal(x.coordinate('declare',refined).accepted,true);
});
observe(46,'secrets and installation record exhaustion reject only dependent retention',t=>{
 const x=fixture(t),r=resolvedProcedure(x);r.body.procedure.rationale='-----BEGIN PRIVATE KEY-----';assert.equal(x.coordinate('declare',r.body).reason,'invalid_procedure');r.body.procedure.rationale='A scoped parameterized preparation method.';
 assert.equal(x.coordinate('declare',r.body).accepted,true);const path=join(x.owned,'procedures.json'),store=JSON.parse(readFileSync(path)),p=store.procedures['proc-local-write'];
 for(let i=1;i<32;i++)store.procedures['proc-fill-'+i]={...p,id:'proc-fill-'+i,conditions:['Bounded retained case '+i+'.']};writeFileSync(path,JSON.stringify(store));const loaded=x.coordinate('load',{scope:'procedures'});
 const extra={...r.body,expected_revision:loaded.result.revision,procedure:{...r.body.procedure,id:'proc-extra',conditions:['A distinct scoped case.']}};assert.equal(x.coordinate('declare',extra).reason,'procedure_store_full');assert.equal(Object.keys(JSON.parse(readFileSync(path)).procedures).length,32);
});

function bookkeepingProposal(x){
 const input=x.raw();input.resource={path:x.adminPath,access:'write'};input.action={operation:'Edit',arguments:{file_path:x.adminPath,old_string:'not_required',new_string:'acknowledged'}};
 const blocked=x.dispatch('pre-effect',input),observation=blocked.payload.action.resource_observations[0];
 assert.match(observation.identity,/^sha256:/);assert.equal(observation.path,x.adminPath);
 assert.ok(blocked.payload.runtime_message.includes(observation.identity));
 x.assess('pre-effect',{purpose:'bookkeeping',effects:[{path:observation.path,access:'write',expected_identity:observation.identity}]});return input;
}
observe(47,'private bookkeeping obtains its identity from the native receipt and reconciles omitted effects',t=>{
 const x=fixture(t),input=bookkeepingProposal(x),allowed=x.dispatch('pre-effect',input);assert.equal(allowed.decision,'allow',JSON.stringify(allowed));
 const admin=JSON.parse(readFileSync(x.adminPath));admin.restart='acknowledged';writeFileSync(x.adminPath,JSON.stringify(admin));
 const outcome=x.outcome({request:input});assert.equal(outcome.reason_code,'needs_action_assessment');
 const post=x.assess('post-effect',{purpose:'bookkeeping',effects:undefined});assert.equal(post.result.result.reconciliation.decision,'allow',JSON.stringify(post.result));
 assert.equal(x.state().last_admission.execution_conditions[0].path,x.adminPath);
});
observe(48,'a resource changed after receipt observation cannot reuse its expected identity',t=>{
 const x=fixture(t),input=bookkeepingProposal(x);writeFileSync(x.adminPath,readFileSync(x.adminPath,'utf8')+'\n');
 const denied=x.dispatch('pre-effect',input);assert.notEqual(denied.decision,'allow');assert.ok(denied.payload.failed.includes('expected_revision_verified'));
});
observe(49,'resource observations withhold credential hashes and exclude peers links and oversized files',t=>{
 const x=fixture(t),secret='low-entropy-fixture-secret',common=join(x.root,'.priv','common');
 const credentialRoots=['authentication','credentials','ssh','secrets'];
 for(const name of credentialRoots){mkdirSync(join(common,name));const p=join(common,name,'key');writeFileSync(p,secret);const r=x.dispatch('pre-effect',{...x.raw(),resource:{path:p,access:'read'}});assert.equal(r.payload.action.resource_observations[0].identity,'withheld_secret_store');assert.ok(!JSON.stringify(r).includes(hash(secret)));}
 const peer=join(x.root,'.priv','tools','peer');mkdirSync(peer);writeFileSync(join(peer,'file'),'peer');
 const linked=join(x.owned,'linked');linkSync(x.target,linked);const oversized=join(x.owned,'large');writeFileSync(oversized,'x'.repeat(1048577));
 for(const p of [join(peer,'file'),x.record.controller_locator,linked,oversized]){const r=x.dispatch('pre-effect',{...x.raw(),resource:{path:p,access:'read'}});assert.equal(r.payload.action.resource_observations[0].identity,'not_eligible');}
 const stored=readFileSync(join(x.owned,'sessions','fixture-session','state.json'),'utf8');assert.ok(!stored.includes(secret));assert.ok(!stored.includes(hash(secret)));
});
observe(50,'post-effect bookkeeping cannot widen admitted targets or turn observations into semantic success',t=>{
 const x=fixture(t),input=bookkeepingProposal(x);assert.equal(x.dispatch('pre-effect',input).decision,'allow');x.outcome({request:input});
 const wider=x.assess('post-effect',{purpose:'bookkeeping',effects:[{path:x.checkpoint,access:'write',expected_identity:hash(readFileSync(x.checkpoint))}]});assert.equal(wider.result.result.reconciliation.reason_code,'administrative_scope_unverified');
 const a=x.assessment('post-effect',{purpose:'bookkeeping',effects:[]});a.value.judgments.postconditions_verified.value=false;
 const rejected=x.coordinate('declare',a.body);assert.notEqual(rejected.result.reconciliation.decision,'allow');assert.ok(rejected.result.reconciliation.payload.failed.includes('postconditions_verified'));
});
observe(51,'documented scalar normalization binds a defaulted native invocation once',t=>{
 const x=fixture(t,{normalization:{'file.write':{defaults:{replace_all:false},paths:[],documentation:0}}}),p=preparedAssessment(x);
 p.input.action.arguments.replace_all=false;const first=x.dispatch('pre-effect',p.input);assert.equal(first.decision,'allow',JSON.stringify(first));assert.equal(first.payload.action.preparation_binding.status,'bound');
 const again=x.dispatch('pre-effect',p.input);assert.notEqual(again.decision,'allow');assert.ok(again.payload.action.preparation_binding.reasons.includes('already_consumed'));
});
observe(52,'binding mismatches expose safe field presence without retaining values or value hashes',t=>{
 const x=fixture(t),p=preparedAssessment(x),secret='fixture-sensitive-value-729';p.input.action.arguments.extra=secret;
 const r=x.dispatch('pre-effect',p.input),binding=r.payload.action.preparation_binding;assert.equal(binding.status,'mismatch');assert.deepEqual(binding.argument_diff.only_native,['extra']);
 for(const text of [JSON.stringify(r),readFileSync(join(x.owned,'sessions','fixture-session','state.json'),'utf8')]){assert.ok(!text.includes(secret));assert.ok(!text.includes(runtimeAction().identity(secret)));}
 const y=fixture(t),q=preparedAssessment(y);q.input.action.arguments.content='different';const changed=y.dispatch('pre-effect',q.input);assert.notEqual(changed.decision,'allow');assert.ok(changed.payload.action.preparation_binding.reasons.includes('action_changed'));
});
observe(53,'path normalization follows registered filesystem case semantics and leaves other arguments exact',t=>{
 for(const sensitive of [true,false]){const x=fixture(t,{caseSensitive:sensitive,normalization:{'file.write':{defaults:{},paths:['path'],documentation:0}}});
  const p=preparedAssessment(x);p.input.action.arguments.path=x.target.toUpperCase();const r=x.dispatch('pre-effect',p.input);assert.equal(r.decision==='allow',!sensitive,JSON.stringify(r));}
 const x=fixture(t,{normalization:{'file.write':{defaults:{},paths:['path'],documentation:0}}}),p=preparedAssessment(x);p.input.action.arguments.content='AUTHORIZED';assert.notEqual(x.dispatch('pre-effect',p.input).decision,'allow');
});
observe(54,'rejected source references identify judgment and ref index without echoing values',t=>{
 const x=fixture(t);x.dispatch();const a=x.assessment();a.value.judgments.authority_verified.source_refs.push('request:'+x.state().request_reference);assert.equal(x.coordinate('declare',a.body).accepted,true);
 const r=x.dispatch(),d=r.payload.action.judgment_diagnostics.find(d=>d.judgment==='authority_verified');assert.deepEqual(d.rejected_ref_indices,[1]);assert.ok(d.reasons.includes('unknown_source_refs'));assert.notEqual(r.decision,'allow');
 const b=x.assessment();const targetRef='resource:'+(process.platform==='win32'?x.target.replaceAll('\\','/').toUpperCase():x.target);
 b.value.judgments.authority_verified.source_refs.push(targetRef);assert.equal(x.coordinate('declare',b.body).accepted,true);assert.equal(x.dispatch().decision,'allow');
});
observe(55,'delivered native and reconciled bookkeeping receipts report the final session revision',t=>{
 const x=fixture(t),input=bookkeepingProposal(x);const native=x.dispatch('pre-effect',input);assert.equal(native.payload.action.state_revision,x.state().revision);assert.equal(native.payload.action.declare.expected_revision,x.state().revision);
 x.outcome({request:input});const post=x.assess('post-effect',{purpose:'bookkeeping',effects:[]});assert.equal(post.result.result.state_revision,x.state().revision);
});
observe(56,'concrete post-effect expectations still reject a mismatching observed revision',t=>{
 const x=fixture(t),input=bookkeepingProposal(x);assert.equal(x.dispatch('pre-effect',input).decision,'allow');x.outcome({request:input});
 const a=x.assess('post-effect',{purpose:'bookkeeping',effects:[{path:x.adminPath,access:'write',expected_identity:'sha256:'+'0'.repeat(64)}]});assert.notEqual(a.result.result.reconciliation.decision,'allow');assert.equal(a.result.result.reconciliation.reason_code,'effect_revision_changed');
});
observe(57,'a known native target cannot be hidden behind an unrelated declared effect',t=>{
 const x=fixture(t),input=x.raw();input.resource={path:x.adminPath,access:'write'};input.action={operation:'Edit',arguments:{file_path:x.adminPath,old_string:'not_required',new_string:'acknowledged'}};
 x.dispatch('pre-effect',input);x.assess();const r=x.dispatch('pre-effect',input);assert.equal(r.reason_code,'native_resource_mismatch');assert.notEqual(r.decision,'allow');
 input.resource={path:x.record.controller_locator,access:'write'};input.action.arguments.file_path=x.record.controller_locator;x.dispatch('pre-effect',input);x.assess();assert.equal(x.dispatch('pre-effect',input).reason_code,'native_resource_mismatch');
});

observe(58,'declared diagnostic hashing reads protected adapter code at G0 without mutation authority',t=>{
 const x=fixture(t),p=x.record.runtime_adapter.path;
 x.classify({level:'G0',facets:['information'],resources:[p],basis:{governed_mutation:false,subject_scope:'current_project',work_item_reason:'none'}});
 const input=x.raw();input.action={operation:'host.command',arguments:{command:'Get-FileHash',path:p}};input.resource={path:p,access:'read'};
 const first=x.dispatch('pre-effect',input);assert.match(first.payload.action.resource_observations[0].identity,/^sha256:/);
 x.assess('pre-effect',{effects:[{path:p,access:'read',expected_identity:hash(readFileSync(p))}],effect_class:'information',facets:['information']});
 assert.equal(x.dispatch('pre-effect',input).decision,'allow');
 const mutation=x.raw();mutation.action={operation:'file.write',arguments:{path:p,content:'changed'}};mutation.resource={path:p,access:'write'};
 x.dispatch('pre-effect',mutation);x.assess('pre-effect',{effects:[{path:p,access:'write',expected_identity:hash(readFileSync(p))}]});
 assert.equal(x.dispatch('pre-effect',mutation).reason_code,'protected_control_effect');
});
observe(59,'exact checkpoint bookkeeping observations need no expanded project declaration or human hash',t=>{
 const x=fixture(t);x.classify({resources:[x.target]});
 const input=x.raw();input.action={operation:'file.write',arguments:{path:x.checkpoint,content:'candidate'}};input.resource={path:x.checkpoint,access:'write'};
 const first=x.dispatch('pre-effect',input),observations=first.payload.action.bookkeeping_observations;
 assert.equal(observations.length,3);const cp=observations.find(o=>o.path===x.checkpoint);assert.equal(cp.identity,hash(readFileSync(x.checkpoint)));assert.equal(cp.origin,'controller_observation');
 x.assess('pre-effect',{purpose:'bookkeeping',effects:[{path:x.checkpoint,access:'write',expected_identity:cp.identity}]});
 assert.equal(x.dispatch('pre-effect',input).decision,'allow');
 const c=JSON.parse(readFileSync(x.checkpoint));c.revision++;writeFileSync(x.checkpoint,JSON.stringify(c));assert.notEqual(x.dispatch('pre-effect',input).decision,'allow');
});
observe(60,'declared non-secret shared-private reads do not permit shared writes or peer reads',t=>{
 const x=fixture(t),p=join(x.root,'.priv','common','diagnostics.ps1');writeFileSync(p,'Write-Output scoped');
 x.classify({resources:[p]});const input=x.raw();input.action={operation:'file.hash',arguments:{path:p}};input.resource={path:p,access:'read'};
 x.dispatch('pre-effect',input);x.assess('pre-effect',{effects:[{path:p,access:'read',expected_identity:hash(readFileSync(p))}]});assert.equal(x.dispatch('pre-effect',input).decision,'allow');
 const actions=runtimeAction(),state={resources:[p]};
 assert.equal(actions.accessProblem(p,'write',x.record,x.spec,state),'effect_outside_owned_scope');
 const peer=join(x.root,'.priv','tools','peer','private.txt');assert.equal(actions.accessProblem(peer,'read',x.record,x.spec,{resources:[peer]}),'effect_outside_owned_scope');
});
observe(61,'Git diagnostic targets are readable when declared and remain protected against writes',t=>{
 const x=fixture(t),dir=join(x.root,'.git');mkdirSync(dir);const p=join(dir,'HEAD');writeFileSync(p,'ref: refs/heads/main');
 x.classify({resources:[p]});const input=x.raw();input.action={operation:'shell.run',arguments:{command:'git diff',cwd:x.root}};input.resource={path:p,access:'read'};
 x.dispatch('pre-effect',input);x.assess('pre-effect',{effects:[{path:p,access:'read',expected_identity:hash(readFileSync(p))}]});assert.equal(x.dispatch('pre-effect',input).decision,'allow');
 assert.equal(runtimeAction().accessProblem(p,'write',x.record,x.spec,{resources:[p]}),'protected_control_effect');
});
observe(62,'secret eligibility precedes content hashing in both observations and assessed reads',t=>{
 const x=fixture(t),dir=join(x.root,'.priv','common','secrets');mkdirSync(dir);const p=join(dir,'key');writeFileSync(p,'fixture-sensitive');
 x.classify({resources:[p]});const input=x.raw();input.action={operation:'file.hash',arguments:{path:p}};input.resource={path:p,access:'read'};
 x.dispatch('pre-effect',input);x.assess('pre-effect',{effects:[{path:p,access:'read',expected_identity:hash('fixture-sensitive')}]});
 const api=require('node:fs'),original=api.readFileSync;let reads=0;
 api.readFileSync=function(file,...rest){if(file===p){reads++;throw Error('Sensitive file must not be read.');}return original.call(this,file,...rest);};
 try{const result=x.dispatch('pre-effect',input);assert.equal(result.reason_code,'secret_resource_restricted');assert.equal(reads,0);assert.ok(!JSON.stringify(result).includes(hash('fixture-sensitive')));}finally{api.readFileSync=original;}
});
observe(63,'compatible component revisions retain native consent while changed native scope invalidates it',t=>{
 const x=fixture(t),before=runtimeAction().nativeIdentity(x.record),invocation=[...x.record.runtime_invocation];const code=readFileSync(x.record.runtime_adapter.path,'utf8').replace('const {action,resource','// Scoped compatible translation.\nconst {action,resource');writeFileSync(x.record.runtime_adapter.path,code);x.record.runtime_adapter.identity=hash(code);assert.deepEqual(x.record.runtime_invocation,invocation);x.record.revision='2';x.record.observed_at=new Date().toISOString();
 assert.equal(runtimeAction().nativeIdentity(x.record),before);
 x.dispatch();x.assess();assert.equal(x.dispatch().decision,'allow');
 x.record.protected_configuration_paths.push(join(x.root,'native-definition.json'));assert.notEqual(runtimeAction().nativeIdentity(x.record),before);
 x.dispatch();x.assess();const rejected=x.dispatch();assert.notEqual(rejected.decision,'allow');assert.ok(rejected.payload.failed.includes('installed_enforcement'));
});

observe(64,'owned diagnostic reads need no mutation-scope expansion and cannot authorize writes',t=>{
 const x=fixture(t),p=join(x.owned,'diagnostics.ps1');writeFileSync(p,'Write-Output scoped');x.classify({resources:[x.target]});
 const input=x.raw();input.action={operation:'host.command',arguments:{command:'Get-FileHash',path:p}};input.resource={path:p,access:'read'};
 const first=x.dispatch('pre-effect',input),observation=first.payload.action.resource_observations[0];assert.match(observation.identity,/^sha256:/);
 x.assess('pre-effect',{effects:[{path:p,access:'read',expected_identity:observation.identity}]});assert.equal(x.dispatch('pre-effect',input).decision,'allow');
 const write=x.raw();write.action={operation:'file.write',arguments:{path:p,content:'changed'}};write.resource={path:p,access:'write'};
 x.dispatch('pre-effect',write);x.assess('pre-effect',{effects:[{path:p,access:'write',expected_identity:observation.identity}]});assert.equal(x.dispatch('pre-effect',write).reason_code,'effect_outside_declared_scope');
});

observe(65,'all unfamiliar material argument names affect logical identity',()=>{
 const a=runtimeAction(),base={operation:'finish',arguments:{message:'A',event_id:'one'}};
 const before=a.identity(a.logicalAction('completion',base));for(const [k,v] of Object.entries({message:'B',event_id:'two',control_active:true})){const changed=structuredClone(base);changed.arguments[k]=v;assert.notEqual(a.identity(a.logicalAction('completion',changed)),before);}
});
observe(66,'declared presentation changes retain logical action and independently correlate the full original input',t=>{
 const x=fixture(t),stored=()=>JSON.parse(readFileSync(join(x.owned,'sessions','fixture-session','state.json'),'utf8')),input=x.raw('completion'),first=x.dispatch('completion',input),original=stored().native_inputs.completion.input_identity;
 assert.equal(original,runtimeAction().identity(input));const changed=structuredClone(input);changed.action.presentation.message='Changed display only';
 const second=x.dispatch('completion',changed);assert.equal(first.payload.action.action_identity,second.payload.action.action_identity);
 assert.equal(stored().native_inputs.completion.input_identity,runtimeAction().identity(changed));assert.notEqual(stored().native_inputs.completion.input_identity,original);
 assert.notEqual(second.decision,'allow');
});
observe(67,'presentation requires a documented operation profile, correct phase and object shape',t=>{
 const x=fixture(t,{normalization:{finish:{defaults:{},paths:[],documentation:0}}});assert.equal(x.dispatch('completion').reason_code,'native_action_unavailable');
 const y=fixture(t),wrong=y.raw();wrong.action.presentation={message:'not a completion'};assert.equal(y.dispatch('pre-effect',wrong).reason_code,'native_action_unavailable');
 const malformed=y.raw('completion');malformed.action.presentation=[];assert.equal(y.dispatch('completion',malformed).reason_code,'native_action_unavailable');
});
observe(68,'a presentation declaration never permits changing a material completion argument',t=>{
 const x=fixture(t),a=x.execute();x.outcome(a);x.assess('post-effect');const p=preparedAssessment(x,'completion');p.input.action.arguments.target='another-target';
 const r=x.dispatch('completion',p.input);assert.notEqual(r.decision,'allow');assert.equal(r.payload.action.preparation_binding.status,'mismatch');assert.ok(r.payload.action.preparation_binding.reasons.includes('action_changed'));
});
observe(69,'scalar and array material arguments remain exact in canonical projection',()=>{
 const a=runtimeAction();for(const args of [null,'value',[1,2]]){const x={operation:'finish',arguments:args,presentation:{message:'display'}};assert.deepEqual(a.logicalAction('completion',x),{operation:x.operation,arguments:args});}
});
