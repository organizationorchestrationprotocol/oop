import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validateAdministrativeContract} from './installation-regression.mjs';
import {validateProfile} from './schema-profile.mjs';
const require=createRequire(import.meta.url);
const {planInstallation,freezeInstallation,installationState,wrapperEvolution,guardedEffect}=require('./enforcement-adapter.cjs');
const {phases,roles}=require('./enforcement-install.cjs');
const load=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const manifest=load('dist/enforcement-install.json');
const engine=require('../dist/oop-enforce.js');
const clone=structuredClone;
function fixture(){
  const scope={project:'a',runtime:'a',authority:'a',revision:'a'};
  const dependencies={source:manifest.source_binding.source_identity,runtime_build:'a',permissions:'a',configuration:'a',capabilities:'a'};
  const proof={origin:'authoritative_observation',reference:'fixture:administrative-action',scope,dependencies,
    observed_at:'2026-10-20T08:00:00Z',expires_at:'2026-10-20T12:00:00Z'};
  const options={scope,dependencies,now:Date.parse('2026-10-20T08:30:00Z'),expectedSourceBinding:manifest.source_binding,
    adoptedCommit:'1'.repeat(40),manifestIdentity:manifest.content_identity};
  const facts={...require('./fixtures/native-configuration.cjs')(scope.project,dependencies.runtime_build,dependencies.configuration),...proof,complete:true,effects_possible:true,resumable:true,delegation_used:false,delegation_supported:true,
    paths:[...new Set(Object.values(phases).flat())].filter(p=>p!=='diagnostic_after_bootstrap').map(phase=>({phase,path:'a'}))};
  const capabilities=manifest.features.filter(f=>f.feature!=='probe').map(f=>({id:f.feature,registration:f.feature,fingerprint:f.feature,
    tier:3,available:true,authorized:true,disabled:false,features:[f.feature],paths:['a'],phases:f.phases,semantics:roles[f.feature],
    blocking:f.required_semantics.blocking_required,scope,provenance:proof,capability_class:f.capability_classes[0],
    runtime_adapter:{entrypoint:'/private/tools/fixture-installation-uid/oop-runtime-adapter.js',interpreter:'javascript',ownership_reference:'fixture:adapter',controller_interface:'oop-admission-1'}}));
  function prepare(){
    const plan=planInstallation(manifest,capabilities,facts,{},options);options.expectedPlanIdentity=plan.plan_identity;
    const preparation={...proof,first_approval_requested:false,installation_chat_id:'install',
      wrapper:{content:facts.configuration_plan.adapter_preparation.source,interface:'oop-admission-1',compatible:true},
      definitions:plan.registrations.map(g=>({registration:g.registration,content:JSON.stringify(g.invocation),invocation:g.invocation,
        consent_required:true,restart_required:false}))};
    return {plan,preparation};
  }
  const {plan,preparation}=prepare();
  const frozen=freezeInstallation(plan,preparation,options);options.expectedPackageIdentity=frozen.package_identity;
  assert.equal(frozen.status,'INVENTORIED_AND_FROZEN');
  const receipts=frozen.mechanisms.map(m=>({...proof,registration:m.registration,fingerprint:m.fingerprint,invocation:m.invocation,
    action:'installed',completed:true,completed_at:proof.observed_at,consent:'granted',restart:'not_required',error:null,disabled:false,revoked:false}));
  const independent={...proof,complete:true,canonical_publication_required:true,
    publication:{verified:true,record_type:'machine_installation',identity_only:true,repository:'canonical-operations',ref:'main',commit:'2'.repeat(40),content_reference:'fixture:record',credential_reference:'fixture:credential'}};
  const state=()=>installationState(frozen,receipts,independent,options);
  const checkpoint={...proof,...state()};
  const chat={...proof,id:'later',created_at:'2026-10-20T09:00:00Z',evasive_fork:false};
  const change={...proof,reason:'Concrete compatible host improvement discovered',interface:'oop-admission-1',components:['runtime_adapter'],
    discovered:true,authorized:true,safe:true,compatible:true,preserves_authority:true,preserves_failure_propagation:true,new_consent_definitions:[]};
  const evolve=()=>wrapperEvolution(checkpoint,chat,change,{...options,now:Date.parse('2026-10-20T10:00:00Z')});
  return {scope,dependencies,proof,options,facts,capabilities,plan,preparation,prepare,frozen,receipts,independent,state,checkpoint,chat,change,evolve};
}
// IDs are producer observations. Every case uses source INSTALL-xx clauses from
// OOP-capability-lifecycle and the derived installation/bootstrap contracts.
test('REL-ADMIN-001: AC-01 R01 R03 R10 R11 direct receipts complete with no readback API',()=>{
  const f=fixture();assert.equal(f.state().installation_complete,true);
  const schema=load('tools/schemas/migration.schema.json').$defs.administrativeInstallationState;
  assert.deepEqual(validateProfile(f.state(),schema),[]);
  assert.ok(validateProfile({...f.state(),installation_chat_id:42},schema).length);
  assert.equal(f.state().dispatch_observations,'unmeasured');assert.equal(f.state().effect_permission,'not_granted');
  for(const patch of [{completed:false},{origin:'model_assertion'},{reference:''},{action:'planned'},{scope:{...f.scope,project:'other'}}]){
    const rs=clone(f.receipts);Object.assign(rs[0],patch);assert.equal(installationState(f.frozen,rs,f.independent,f.options).installed_enforcement,false);
  }
});
test('REL-ADMIN-002: AC-02 R05 R08 every definition and wrapper precede first approval',()=>{
  const f=fixture();assert.equal(f.frozen.mechanisms.length,7);assert.ok(f.frozen.mechanisms.some(m=>m.registration==='delegate'));
  delete f.facts.delegation_supported;delete f.facts.delegation_used;
  assert.ok(f.prepare().plan.registrations.some(g=>g.features.includes('delegate')),
    'Documented supported future delegation does not need a past-use flag or a redundant support flag.');
  f.preparation.first_approval_requested=true;assert.equal(freezeInstallation(f.plan,f.preparation,f.options).reason,'initial_materialization_incomplete');
});
test('REL-ADMIN-003: AC-03 R08 R09 three definitions followed by two known omissions fails freeze',()=>{
  const f=fixture(),session=clone(f.capabilities[0]),operations=clone(f.capabilities[2]);
  Object.assign(session,{id:'session',registration:'session',features:['entry','recovery'],
    phases:['session_entry','resume_before_effect'],feature_semantics:{entry:'context_delivery',recovery:'preventive_gate'},
    blocking:true,capability_class:'native_execution_policy'});
  Object.assign(operations,{features:['pre-effect','delegate'],phases:['before_effect','delegate_start','delegate_finish']});
  f.capabilities.splice(0,f.capabilities.length,session,f.capabilities[1],operations,f.capabilities[3],f.capabilities[4]);
  const {plan,preparation}=f.prepare();assert.equal(preparation.definitions.length,5);
  const initial=preparation.definitions.slice(0,3),predictableLater=preparation.definitions.slice(3);
  assert.equal(initial.length,3);assert.equal(predictableLater.length,2);
  preparation.definitions=initial;
  assert.equal(freezeInstallation(plan,preparation,f.options).reason,'incomplete_initial_definitions');
  preparation.first_approval_requested=true;preparation.definitions.push(...predictableLater);
  assert.equal(freezeInstallation(plan,preparation,f.options).reason,'initial_materialization_incomplete',
    'Predictable omitted definitions cannot be added in a late first-install approval wave.');
});
test('REL-ADMIN-004: AC-04 R07 R08 each required native consent remains independent',()=>{
  const f=fixture();for(const r of f.receipts){r.consent='pending';assert.equal(f.state().installed_enforcement,false);r.consent='granted';}
  assert.equal(f.state().installed_enforcement,true);
});
test('REL-ADMIN-005: AC-05 R07 R10 denied consent or real administrative error prevents success',()=>{
  const f=fixture();for(const patch of [{consent:'denied'},{error:'native API failed'},{revoked:true},{disabled:true},{completed:false}]){
    const receipts=clone(f.receipts);Object.assign(receipts[0],patch);
    assert.equal(installationState(f.frozen,receipts,f.independent,f.options).installed_enforcement,false);
  }
  assert.equal(installationState(f.frozen,[],f.independent,f.options).installed_enforcement,false);
});
test('REL-ADMIN-006: AC-06 R03 R09 R10 real restart completes from ordinary acknowledgment',()=>{
  const f=fixture();f.preparation.definitions[0].restart_required=true;
  const p=freezeInstallation(f.plan,f.preparation,f.options),opts={...f.options,expectedPackageIdentity:p.package_identity};
  assert.equal(installationState(p,f.receipts,f.independent,opts).installed_enforcement,false);
  f.receipts[0].restart='completed';assert.equal(installationState(p,f.receipts,f.independent,opts).installed_enforcement,true);
});
test('REL-ADMIN-007: AC-07 R01 R02 R12 no semantic coverage or suitability certification',()=>{
  const f=fixture();assert.equal(f.state().functioning_basis,'administrative_presumption');
  for(const r of f.receipts){r.formal_enablement_verified=false;r.dispatch_verified=false;r.semantic_coverage_verified=false;}
  assert.equal(f.state().installation_complete,true);
});
test('REL-ADMIN-008: AC-08 R13 R14 same installation chat defers after restart or compaction',()=>{
  const f=fixture();for(const event of ['message','restart','compaction','resume']){
    f.chat.id='install';f.chat.event=event;assert.equal(f.evolve().action,'defer');assert.equal(f.state().installation_complete,true);
  }
});
test('REL-ADMIN-009: AC-09 R14 R15 R16 later-created authorized safe improvement is admissible',()=>{
  const f=fixture();assert.equal(f.evolve().action,'apply');
  delete f.chat.evasive_fork;assert.equal(f.evolve().action,'apply',
    'Trustworthy identity/creation time do not require an additional host API certifying absence of evasive intent.');
  for(const k of ['authorized','safe','compatible','preserves_authority','preserves_failure_propagation']){
    f.change[k]=false;assert.equal(f.evolve().action,'defer');f.change[k]=true;
  }
});
test('REL-ADMIN-010: AC-10 R08 R15 R16 only genuinely changed native definitions need consent',()=>{
  const f=fixture();f.change.new_consent_definitions=['new-definition'];
  assert.deepEqual(f.evolve().consent_definitions,['new-definition']);assert.equal(f.evolve().action,'request_new_native_consent');
  assert.equal(f.evolve().functionality_certification,false);
});
test('REL-ADMIN-011: AC-11 R05 R06 R07 all overlapping eligible mechanisms and real incompatibilities',()=>{
  const f=fixture(),extra=clone(f.capabilities[2]);extra.id='extra';extra.registration='extra';extra.tier=1;f.capabilities.push(extra);
  const p=f.prepare().plan;assert.ok(p.registrations.some(g=>g.registration==='extra'));assert.ok(p.registrations.some(g=>g.registration==='pre-effect'));
  extra.conflicts_with=['pre-effect'];assert.equal(f.prepare().plan.reason,'incompatible_native_modes_require_host_resolution');
});
test('REL-ADMIN-012: AC-12 R06 R09 valid equivalent reuse avoids reinstall or new consent',()=>{
  const f=fixture();for(const r of f.receipts)r.action='reused';assert.equal(f.state().installed_enforcement,true);
  const installed={dependencies:f.dependencies,registrations:f.plan.registrations.map(g=>({...g,administrative_completed:true}))};
  assert.ok(planInstallation(manifest,f.capabilities,f.facts,installed,f.options).actions.every(a=>a.operation==='reuse'));
});
test('REL-ADMIN-013: AC-13 R04 R16 R17 ordinary deny unknown and error never execute dependent callback',()=>{
  const f=fixture();assert.equal(f.state().installed_enforcement,true);
  const scope={classification:'known',request:['local_write']};
  const modules=engine.evaluate('interaction',{format:1,request_id:'ordinary',scope}).payload.modules;
  const context={project:'a',runtime:'a',machine_id:'fixture-machine',installation_uid:'fixture-uid',oop_commit:'1'.repeat(40),revision:'a',authority:'a',resource:'a',risk:'G0',
    lifecycle:'active',session:'fixture-session',request_scope:'fixture-request',action_scope:'fixture-action',checkpoint_ref:'fixture-checkpoint',checkpoint_revision:'1',mapping_revision:'1',context_retention:'a',observed_at:'2026-10-20T08:30:00Z',dependencies:{source:'a'}};
  const request={format:1,request_id:'ordinary',scope,context,effect_class:'local_write',evidence:{}};
  request.maintenance_observation=require('./fixtures/machine.cjs').normalMode(request);
  for(const fact of engine.evaluate('pre-effect',request).payload.missing)request.evidence[fact]={value:true,origin:'authoritative_observation',
    reference:'fixture:ordinary-effect',binding:{...Object.fromEntries(['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'].map(k=>[k,context[k]])),command:'pre-effect',selection:modules.join(','),effect_class:'local_write'},
    dependencies:context.dependencies,observed_at:'2026-10-20T08:00:00Z',expires_at:'2026-10-20T09:00:00Z'};
  assert.equal(engine.evaluate('pre-effect',request).decision,'allow');
  for(const decision of ['deny','unknown','error']){
    const ordinary=clone(request);
    if(decision==='deny')ordinary.evidence.authority_verified.value=false;
    else if(decision==='unknown')delete ordinary.evidence.authority_verified;
    else ordinary.invalid_field=true;
    assert.equal(engine.evaluate('pre-effect',ordinary).decision,decision);
    const result=guardedEffect(ordinary,()=>assert.fail('dependent effect'),{expectedSourceBinding:engine.config.source_binding});
    assert.equal(result.attempted,false);
  }
  f.receipts[0].error='Observed real native disablement';assert.equal(f.state().installed_enforcement,false);
});
test('REL-ADMIN-014: AC-14 R11 R19 receipts from the previous source promote without invented historical time',()=>{
  const f=fixture();
  f.preparation.first_approval_requested=true;f.preparation.prior_source_reconciliation=true;
  assert.equal(freezeInstallation(f.plan,f.preparation,f.options).reason,'initial_materialization_incomplete');
  const frozen=freezeInstallation(f.plan,f.preparation,{...f.options,migration:true});
  assert.equal(frozen.status,'INVENTORIED_AND_FROZEN');
  const old=clone(f.receipts);for(const r of old){r.dependencies.source='previous-source';r.expires_at='2026-10-20T08:01:00Z';
    r.invocation.provenance.dependencies.source='previous-source';}
  const reconciliations=old.map(r=>({...f.proof,reference:'fixture:current-reconciliation',registration:r.registration,
    receipt_reference:r.reference,original_source:'previous-source',target_source:f.dependencies.source,
    administrative_equivalence:true,native_configuration_unchanged:true,required_consents_preserved:true,required_restart_resolved:true,real_error_absent:true}));
  const migrationOptions={...f.options,migration:true,reconciliations,expectedPackageIdentity:frozen.package_identity};
  assert.equal(installationState(frozen,old,f.independent,{...migrationOptions,reconciliations:[]}).installed_enforcement,false);
  const state=installationState(frozen,old,f.independent,migrationOptions);
  assert.equal(state.installation_complete,true);assert.equal(state.installation_completed_at,null);assert.ok(state.recognized_at);
  const bad=clone(old);bad[0].dependencies.permissions='foreign';assert.equal(installationState(frozen,bad,f.independent,migrationOptions).installed_enforcement,false);
  const revoked=clone(old);revoked[0].consent='denied';assert.equal(installationState(frozen,revoked,f.independent,migrationOptions).installed_enforcement,false);
  const untrusted=clone(reconciliations);untrusted[0].origin='model_assertion';assert.equal(installationState(frozen,old,f.independent,{...migrationOptions,reconciliations:untrusted}).installed_enforcement,false);
  assert.equal(installationState(f.frozen,[{status:'ACTIVE_VERIFIED'}],f.independent,f.options).installed_enforcement,false);
  assert.equal(wrapperEvolution({...f.proof,...state},f.chat,f.change,f.options).action,'defer');
  const later={...f.options,now:f.options.now+60000,previous:{...f.proof,...f.state()}};
  assert.equal(installationState(f.frozen,f.receipts,f.independent,later).installation_completed_at,f.state().installation_completed_at);
  f.receipts[0].error='later failure';assert.equal(installationState(f.frozen,f.receipts,f.independent,later).installation_completed_at,later.previous.installation_completed_at);
});
test('REL-ADMIN-015: AC-15 R04 R10 R11 actual record content ref commit and publication stay independent',()=>{
  const f=fixture();f.independent.publication.verified=false;
  assert.equal(f.state().installed_enforcement,true);assert.equal(f.state().installation_complete,false);
  f.independent.publication.verified=true;assert.equal(f.state().installation_complete,true);
  for(const k of ['repository','ref','commit','content_reference','credential_reference']){
    const value=f.independent.publication[k];delete f.independent.publication[k];assert.equal(f.state().installation_complete,false);f.independent.publication[k]=value;
  }
});
test('REL-ADMIN-016: AC-16 R18 R20 transitive old guard schema controller and migration dependencies fail',()=>{
  const input={bootstrap:load('dist/procedures/bootstrap.json'),interfaces:load('dist/interfaces.json'),manifest,
    examples:['README.md','examples.md','tools/enforcement.md','tools/README.md'].map(p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')),
    consumer_clauses:['core','activation','entry','capabilities','bootstrap','repository','producer'].flatMap(n=>load('dist/modules/'+n+'.json').contracts.map(c=>c.semantic_clause)),
    schema:load('tools/schemas/enforcement-install.schema.json'),migrations:Object.fromEntries(['index','compatibility'].map(n=>[n,load('dist/migrations/'+n+'.json')]))};
  assert.ok(validateAdministrativeContract(input).includes('installed_enforcement'));
  for(const fact of ['formal_enablement_verified','activation_verified','scoped_binding_plan_current_complete','dispatch_verified']){
    assert.throws(()=>validateAdministrativeContract({...input,dependencies:{installed_enforcement:['renamed_ready'],renamed_ready:[fact]}}));
    const bad=clone(input);bad.schema.required.push(fact);assert.throws(()=>validateAdministrativeContract(bad));
    const old=clone(input);old.interfaces.enforcement.commands.completion.required.push(fact);assert.throws(()=>validateAdministrativeContract(old));
    const migration=clone(input);migration.migrations.index.enforcement.verification.push(fact);assert.throws(()=>validateAdministrativeContract(migration));
    const publication=clone(input);publication.bootstrap.steps.find(s=>s.id==='BOOT-13').guard.all.push({fact});assert.throws(()=>validateAdministrativeContract(publication));
    const profile=clone(input);profile.migrations.compatibility.current.predicates.push(fact);assert.throws(()=>validateAdministrativeContract(profile));
  }
  assert.throws(()=>validateAdministrativeContract({...input,examples:['At installation, test allowed/denied paths.']}));
  for(const clause of ['During setup, all mandatory enabled/authorized controls effectively read back.',
    'Adoption integrations and installed-control probes remain consumer-local requirements.'])
    assert.throws(()=>validateAdministrativeContract({...input,consumer_clauses:[clause]}));
});
test('REL-ADMIN-017: AC-17 R13 R17 initial incompatible wrapper is a real error and cannot be rewritten',()=>{
  const f=fixture();f.preparation.wrapper.compatible=false;
  assert.equal(freezeInstallation(f.plan,f.preparation,f.options).reason,'initial_materialization_incomplete');
  const changed=clone(f.frozen);changed.wrapper.content='unapproved logic';assert.equal(installationState(changed,f.receipts,f.independent,f.options).installed_enforcement,false);
});
test('REL-ADMIN-018: AC-18 R14 old reopened chat or missing untrusted metadata defers optimization alone',()=>{
  const f=fixture();for(const created_at of ['2026-10-20T07:00:00Z',null,'invalid']){
    f.chat.created_at=created_at;assert.equal(f.evolve().action,'defer');assert.equal(f.state().installation_complete,true);
  }
  f.chat.created_at='2026-10-20T09:00:00Z';f.chat.evasive_fork=true;assert.equal(f.evolve().action,'defer');
});

test('REL-ADMIN-019: F07 unavailable phase completes inventory without claiming coverage',()=>{
  const f=fixture();f.facts.paths=f.facts.paths.filter(p=>p.phase!=='before_completion');
  f.facts.phase_assessments=[{phase:'before_completion',status:'unsupported',reason:'Host has no completion event',
    evidence_reference:'fixture:host-documentation',consequence:'completion_veto_unavailable',next_action:'retain_limited_scope'}];
  const c=f.capabilities.find(c=>c.id==='completion');c.available=false;delete c.runtime_adapter;delete c.paths;
  c.assessment={status:'unsupported',reason:'No completion event',evidence_reference:'fixture:host-documentation',
    consequence:'completion_veto_unavailable',next_action:'retain_limited_scope'};
  const {plan,preparation}=f.prepare();assert.equal(plan.mapping_complete,true);assert.equal(plan.coverage_complete,false);
  assert.equal(plan.plan_complete,false);assert.equal(plan.effect_permission,'not_granted');
  const frozen=freezeInstallation(plan,preparation,f.options);assert.equal(frozen.status,'INVENTORIED_AND_FROZEN');
  const opts={...f.options,expectedPackageIdentity:frozen.package_identity};
  assert.equal(installationState(frozen,f.receipts.filter(r=>r.registration!=='completion'),f.independent,opts).installed_enforcement,true);
  const unavailable=clone(f.facts.phase_assessments);
  for(const patch of [{status:'unknown'},{evidence_reference:''},{next_action:''}]){
    f.facts.phase_assessments=[{...unavailable[0],...patch}];assert.match(f.prepare().plan.reason,/missing_mandatory_phase/);
  }
  f.facts.phase_assessments=unavailable;
  delete f.facts.phase_assessments;assert.match(f.prepare().plan.reason,/missing_mandatory_phase/);
});
test('REL-ADMIN-020: F08 expired historical receipts and checkpoints retain first completion',()=>{
  const f=fixture(),first=f.state();f.options.previous={...f.proof,...first};
  f.options.now=Date.parse('2026-10-21T10:00:00Z');
  assert.equal(f.state().installed_enforcement,true);assert.equal(f.state().installation_complete,false,'current publication prerequisites still expire');
  f.independent.observed_at='2026-10-21T09:00:00Z';f.independent.expires_at='2026-10-21T12:00:00Z';
  assert.equal(f.state().installation_completed_at,first.installation_completed_at);assert.equal(f.state().installation_complete,true);
  for(const patch of [{revoked:true},{disabled:true},{error:'failure'},{consent:'denied'},{restart:'pending'},
    {dependencies:{...f.dependencies,permissions:'changed'}},{invocation:{wrong:true}},{origin:'model_assertion'}]){
    const rs=clone(f.receipts);Object.assign(rs[0],patch);
    assert.equal(installationState(f.frozen,rs,f.independent,f.options).installed_enforcement,false);
  }
});
test('REL-ADMIN-021: F09 only correlated native file-write fulfillment permits optional negatives',()=>{
  const f=fixture(),r=f.receipts[0];delete r.error;delete r.disabled;delete r.revoked;
  assert.equal(f.state().installed_enforcement,false);
  f.options.nativeResults=[{...f.proof,api:'node:fs/promises.writeFile',outcome:'fulfilled',
    receipt_reference:r.reference,registration:r.registration,fingerprint:r.fingerprint,invocation:r.invocation}];
  assert.equal(f.state().installed_enforcement,true);
  for(const patch of [{error:'failed'},{error:false},{disabled:true},{revoked:true},{disabled:'unknown'},
    {completed:false},{consent:'pending'},{restart:'pending'},{scope:{...f.scope,project:'foreign'}}]){
    const rs=clone(f.receipts);Object.assign(rs[0],patch);
    assert.equal(installationState(f.frozen,rs,f.independent,f.options).installed_enforcement,false);
  }
  for(const patch of [{outcome:'rejected'},{api:'unknown'},{origin:'model_assertion'},{receipt_reference:'foreign'},
    {fingerprint:'foreign'},{invocation:{wrong:true}},{dependencies:{...f.dependencies,permissions:'changed'}}]){
    const opts=clone(f.options);Object.assign(opts.nativeResults[0],patch);
    assert.equal(installationState(f.frozen,f.receipts,f.independent,opts).installed_enforcement,false);
  }
});
test('REL-ADMIN-022: F07 negative candidate assessments need authority and cannot hide disabled controls',()=>{
  for(const status of ['unsupported','unauthorized','incompatible']){
    const f=fixture(),c=f.capabilities.find(c=>c.id==='completion');delete c.runtime_adapter;
    c.assessment={status,reason:'Native documented limitation',evidence_reference:'fixture:negative',consequence:'limited',next_action:'reassess'};
    if(status==='unsupported')c.available=false;
    if(status==='unauthorized')c.authorized=false;
    if(status==='incompatible')c.compatible=false;
    const plan=f.prepare().plan;assert.equal(plan.mapping_complete,true);assert.equal(plan.coverage_complete,false);
    c.provenance={...f.proof,origin:'model_assertion'};assert.equal(f.prepare().plan.mapping_complete,false);
    c.provenance=f.proof;c.disabled=true;assert.equal(f.prepare().plan.mapping_complete,false);
    c.disabled=false;c.revoked=true;assert.equal(f.prepare().plan.mapping_complete,false);
  }
});
test('REL-ADMIN-023: F07 absent or contradictory phase evidence stays blocked',()=>{
  const f=fixture();f.facts.paths=f.facts.paths.filter(p=>p.phase!=='before_completion');
  f.facts.phase_assessments=[{phase:'before_completion',status:'unsupported',reason:'documented',evidence_reference:'fixture:negative',consequence:'limited',next_action:'reassess'}];
  assert.match(f.prepare().plan.reason,/missing_mandatory_phase/,'available completion mechanism contradicts negative assessment');
  const g=fixture();g.capabilities.splice(0);g.facts.paths=[];
  assert.equal(g.prepare().plan.plan_complete,false);assert.notEqual(g.prepare().plan.mapping_complete,true);
});
test('REL-ADMIN-024: F08 unknown migrated chronology stays null across ordinary evaluations',()=>{
  const f=fixture(),migrated=installationState(f.frozen,f.receipts,f.independent,{...f.options,migration:true});
  const opts={...f.options,now:f.options.now+60000,previous:{...f.proof,...migrated}};
  const later=installationState(f.frozen,f.receipts,f.independent,opts);
  assert.equal(later.installation_completed_at,null);assert.equal(later.recognized_at,migrated.recognized_at);
  const failed={...f.proof,...installationState(f.frozen,f.receipts,{...f.independent,complete:false},opts)};
  assert.equal(installationState(f.frozen,f.receipts,f.independent,{...opts,previous:failed}).installation_completed_at,null);
  opts.previous.origin='model_assertion';assert.notEqual(installationState(f.frozen,f.receipts,f.independent,opts).installation_completed_at,null);
});
test('REL-ADMIN-026: missing or reordered adapter preparation cannot freeze or install',()=>{
  for(const mutate of [p=>p.workflow.stages.pop(),p=>p.workflow.stages.reverse(),p=>p.source+=' ']){
    const f=fixture();mutate(f.plan.configuration_contract.plan.adapter_preparation);
    assert.equal(freezeInstallation(f.plan,f.preparation,f.options).reason,'invalid_current_plan');
    const changed=clone(f.frozen);mutate(changed.configuration_contract.plan.adapter_preparation);
    assert.notEqual(installationState(changed,f.receipts,f.independent,f.options).installed_enforcement,true);
  }
});

test('REL-ADMIN-025: F09 capture real isolated writeFile fulfillment without readback or dispatch',async()=>{
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'oop-native-ack-'));
  try {
    const f=fixture(),r=f.receipts[0];delete r.error;delete r.disabled;delete r.revoked;
    const value=await writeFile(join(dir,'definition.json'),JSON.stringify(r.invocation));
    f.options.nativeResults=[{...f.proof,api:'node:fs/promises.writeFile',outcome:'fulfilled',value,
      receipt_reference:r.reference,registration:r.registration,fingerprint:r.fingerprint,invocation:r.invocation}];
    assert.equal(f.state().installed_enforcement,true);assert.equal(f.state().dispatch_observations,'unmeasured');
    f.options.nativeResults.push({...f.options.nativeResults[0],outcome:'rejected'});assert.equal(f.state().installed_enforcement,false);
  } finally {await rm(dir,{recursive:true,force:true});}
});
