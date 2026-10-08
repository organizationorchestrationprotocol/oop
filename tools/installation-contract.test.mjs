import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {validateProfile} from './schema-profile.mjs';
const require=createRequire(import.meta.url),c=require('./installation-contract.cjs');
const configuration=require('./fixtures/native-configuration.cjs');
const clone=structuredClone;
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const {machine:identity,normalMode}=require('./fixtures/machine.cjs');
function fixture(){
  const prior={id:'T1',state:'in_progress',installation_uid:'first',previous_versions_list:[A],history:[{state:'proposed',installation_uid:'first'}]};
  const trusted={origin:'authoritative_observation',current:true,reference:'backend:current',workspace:'P',
    executing_installation_uid:'second',instruction_origin_uid:'second',origin_reference:'received:instruction',
    machine_metadata:metadata(identity('second')),machine_id:identity('second').machine_id,machine_identity_verified:true,credential_unique_to_machine:true,current_revision:B,registry:[identity('first'),identity('second')],ticket_id:'T1',prior,
    lineage:[A,B],snapshots:{[A]:{id:'T1',state:'proposed'},[B]:prior},retained_uids:['first'],
    deletion_authorized:true,retention_verified:true};
  Object.assign(trusted,{local_mode_verified:true,runtime_adapter_maintenance_mode:'normal',authority_verified:true,destination_verified:true,signing_verified_or_inapplicable:true,publication_identity_reference:'fixture:authorized-actor',publication_destination:'operations:P'});
  const proposal={kind:'ticket_update',destination:'operations:P',expected_revision:B,resulting_predecessor:B,ticket:{...clone(prior),installation_uid:'second',previous_versions_list:[A,B]}};
  return {trusted,proposal};
}
const metadata=m=>Object.fromEntries(['machine_id','authentication_identity','owner_name','owner_email','collaborator_kind','signing_identities'].map(k=>[k,m[k]]));
const check=f=>c.validateMutation(f.proposal,f.trusted);
const observe=(n,title,body)=>test(`REL-INSTALL-${String(n).padStart(3,'0')}: ${title}`,body);
observe(1,'machine identity accepts exactly its versioned fields and rejects technical aliases',()=>{
  const schema=JSON.parse(readFileSync(new URL('./schemas/installation-identity.schema.json',import.meta.url)));
  assert.deepEqual(validateProfile(identity('one'),schema),[]);
  for(const field of ['adoption','installation_status','readiness','runtime_local','bootstrap_complete'])assert.equal(c.identity({...identity('one'),[field]:{value:true}}),false);
  for(const field of Object.keys(identity('one'))){const r=identity('one');delete r[field];assert.equal(c.identity(r),false);}
});
observe(2,'independent UID records retain common runtime class without sharing identity',()=>{
  assert.equal(c.registry([identity('one'),identity('two')]),true);
  assert.equal(c.registry([identity('one'),identity('one')]),false);
  assert.equal(c.identity({...identity('one'),owner_name:''}),false);
});
observe(3,'qualified local scope requires authoritative continuity and one mapped checkpoint',()=>{
  const binding={workspace:'P',installation_uid:'one',runtime_id:'same-runtime-class',mapping_revision:'m1',owned_scope:'owned/one',checkpoint_ref:'owned/one/current',session_root:'owned/one/sessions'};
  const o={...binding,origin:'authoritative_observation',current:true,reference:'host:continuity',continuity_verified:true};
  assert.equal(c.owner(binding,o),true);
  for(const patch of [{installation_uid:'other'},{workspace:'Q'},{continuity_verified:false},{origin:'model_assertion'}])assert.equal(c.owner(binding,{...o,...patch}),false);
  assert.equal(c.owner({...binding,checkpoint_ref:'owned/other/current'},o),false);
  assert.equal(c.owner({...binding,owned_scope:'owned/someone'},{...o,owned_scope:'owned/someone'}),false);
});
observe(4,'registry-only changes validate schema and retain referenced identities',()=>{
  const f=fixture();f.proposal={kind:'registry',expected_revision:B,resulting_predecessor:B,filename:identity('second').machine_id+'.json',records:clone(f.trusted.registry)};
  assert.equal(check(f).valid,true);f.proposal.records[0].protocol={commit:A};assert.equal(check(f).valid,false);
  f.proposal.records=[identity('second')];assert.equal(check(f).reason,'referenced_identity_removed');
  f.trusted.registry=[];f.trusted.retained_uids=[];
  assert.equal(check(f).reason,'initial_enrollment_unresolved');
  f.trusted.enrollment_authorized=true;f.trusted.local_identity_verified=true;f.trusted.enrollment_records=Object.fromEntries(f.proposal.records.flatMap(m=>m.runtimes.map(r=>[r.installation_uid,r])));
  assert.equal(check(f).valid,true);
});
observe(5,'genuine ticket creation requires origin and empty previous list',()=>{
  const f=fixture();f.trusted.prior=null;f.trusted.never_existed=true;
  f.proposal.kind='ticket_create';f.proposal.ticket={id:'T1',installation_uid:'second',previous_versions_list:[]};
  assert.equal(check(f).valid,true);
  for(const patch of [{installation_uid:'first'},{previous_versions_list:[A]},{installation_uid:undefined}])assert.equal(c.validateMutation({...f.proposal,ticket:{...f.proposal.ticket,...patch}},f.trusted).valid,false);
});
observe(6,'instruction origin differs from signer or executor only with causal evidence',()=>{
  const f=fixture();assert.equal(check(f).valid,true);f.trusted.executing_installation_uid='first';
  assert.equal(check(f).valid,false);f.trusted.causal_reference='authenticated:delegated-instruction';assert.equal(check(f).valid,false);f.proposal.ticket.installation_uid='first';assert.equal(check(f).valid,true);
  f.trusted.executing_installation_uid='unregistered';assert.equal(check(f).valid,false);
});
observe(7,'new lifecycle events carry origin and prior event attribution stays intact',()=>{
  const f=fixture();f.proposal.ticket.history.push({state:'planned',installation_uid:'second'});assert.equal(check(f).valid,true);
  f.proposal.ticket.history[0].installation_uid='second';assert.equal(check(f).reason,'historical_attribution_changed');
  f.proposal.ticket.history=clone(f.trusted.prior.history);f.proposal.ticket.history.push({state:'planned'});assert.equal(check(f).valid,false);
});
observe(8,'commit deletion accepts exactly one complete instruction-origin trailer',()=>{
  const f=fixture();Object.assign(f.proposal,{kind:'ticket_delete',backend:'commit_message',message:'Delete T1\n\nInstallation-UID: second'});
  assert.equal(check(f).valid,true);
  for(const message of ['Delete T1','Installation-UID: first','Installation-UID: second\nInstallation-UID: second','Installation-UID: sec','installation-uid: second'])assert.equal(c.validateMutation({...f.proposal,message},f.trusted).valid,false);
});
observe(9,'nonmessage deletion needs explicit durable mapping authority and retention',()=>{
  const f=fixture();Object.assign(f.proposal,{kind:'ticket_delete',deletion_event:{installation_uid:'second',ticket_id:'T1',previous_revision:B}});
  assert.equal(check(f).valid,false);f.trusted.deletion_mapping_verified=true;assert.equal(check(f).valid,true);
  f.trusted.deletion_authorized=false;assert.equal(check(f).valid,false);
});
observe(10,'metadata-only edits append actual predecessor even when it did not touch ticket',()=>{
  const f=fixture();f.trusted.lineage=[A,'unrelated',B];f.proposal.ticket.title='Changed title';assert.equal(check(f).valid,true);
  f.proposal.ticket.previous_versions_list=[A,'unrelated'];assert.equal(check(f).valid,false);
});
observe(11,'complete backend revision formats normalize without fixed hash assumptions',()=>{
  for(const rev of [A,'d'.repeat(64),'immutable:revision:123'])assert.equal(c.normalizeRevision(' '+rev+'\r\n',x=>x===rev?x:null),rev);
  assert.throws(()=>c.normalizeRevision('aaaa',()=>A));assert.throws(()=>c.normalizeRevision(A,()=>null));
});
observe(12,'stale publication and future or incidental predecessor are rejected',()=>{
  const f=fixture();for(const patch of [{expected_revision:A},{resulting_predecessor:C},{expected_revision:C}])assert.equal(c.validateMutation({...f.proposal,...patch},f.trusted).valid,false);
});
observe(13,'history references must contain the same stable ticket and ordered real states',()=>{
  for(const mutate of [f=>delete f.trusted.snapshots[A],f=>f.trusted.snapshots[A].id='T2',f=>f.trusted.lineage=[B,A],f=>f.proposal.ticket.previous_versions_list=[C,B]]){
    const f=fixture();mutate(f);assert.equal(check(f).valid,false);
  }
});
observe(14,'authoring is repeatable while validation never repairs rejected proposals',()=>{
  const f=fixture();assert.deepEqual(c.previous(f.trusted.prior,B),[A,B]);assert.deepEqual(c.previous(f.trusted.prior,B),[A,B]);
  assert.equal(c.authorTicket(f.trusted.prior,f.trusted.prior,B,'second').changed,false);
  assert.deepEqual(c.authorTicket(f.trusted.prior,{...f.trusted.prior,title:'new'},B,'second').ticket.previous_versions_list,[A,B]);
  for(const refs of [[],[B,A],[A,A,B],[A],[A,B,B]]){
    f.proposal.ticket.previous_versions_list=refs;const before=clone(f.proposal);assert.equal(check(f).valid,false);assert.deepEqual(f.proposal,before);
  }
});
observe(15,'a ticket without its previous-version list and unknown attribution cannot pass',()=>{
  const f=fixture();delete f.trusted.prior.previous_versions_list;f.proposal.ticket.previous_versions_list=[];
  assert.equal(check(f).reason,'previous_versions_list_missing');
  f.trusted.prior.history=[{state:'proposed',attribution:'unknown'}];f.proposal.ticket.history=[{state:'proposed',installation_uid:'second'}];
  assert.equal(check(f).valid,false);
});
observe(16,'locator movement preserves stable identity while deleted identity recreation blocks',()=>{
  const f=fixture();f.proposal.ticket.locator='tickets/new/T1';assert.equal(check(f).valid,true);
  f.trusted.prior=null;f.proposal.kind='ticket_create';f.proposal.ticket.previous_versions_list=[];f.trusted.never_existed=false;
  assert.equal(check(f).reason,'recreation_requires_continuity');
});
observe(17,'conditional concurrent publications preserve winner and reject stale writer',async()=>{
  const f=fixture();let revision=B,writes=0,canonical;
  const backend={async conditional(expected,validate){if(expected!==revision)throw Error('stale');const p=await validate({...f.trusted,current_revision:revision});if(expected!==revision)throw Error('stale');revision=C;writes++;canonical=p;return {revision:C,predecessor:B};},async readback(){return canonical;}};
  const results=await Promise.all([c.executePublication({ticket_id:f.proposal.ticket.id,reference:'fixture:change',kind:'transition',destination:f.proposal.destination,expected_revision:f.proposal.expected_revision,observation_verified:true,authority_verified:true},f.proposal,backend),c.publishMutation(f.proposal,backend)]);
  assert.equal(writes,1);assert.equal(results.filter(r=>r.verified).length,1);assert.deepEqual(canonical,f.proposal);
});
observe(18,'failed publication or missing content readback preserves exact pending proposal',async()=>{
  const f=fixture();const before=clone(f.proposal);
  const failed=await c.publishMutation(f.proposal,{conditional:async()=>{throw Error('failed');},readback:async()=>null});
  assert.equal(failed.verified,false);assert.deepEqual(failed.pending,before);
  const missing=await c.publishMutation(f.proposal,{conditional:async(_expected,validate)=>{await validate(f.trusted);return {revision:C,predecessor:B};},readback:async()=>null});
  assert.equal(missing.reason,'canonical_readback_mismatch');assert.deepEqual(missing.pending,before);
});
observe(19,'every invocation variant enters one active native adapter',()=>{
  const f=configuration('P','v1','cfg');assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,true);
  f.configuration_plan.routes.push({...f.configuration_plan.routes[0],entrypoint:'direct-controller'});
  assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).reason,'runtime_adapter_bypass');
});
observe(20,'shell launcher delegation and interactive preference cannot prove native eligibility',()=>{
  for(const patch of [{delegated_runtime_adapter_logic:true},{implementation_language:'application-interpreter'},{language:'preferred-interactive-shell'},{failure_semantics:'allow_on_error'},{cwd_independent:false}]){
    const f=configuration('P','v1','cfg');Object.assign(f.configuration_plan.runtime_adapter,patch);assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);
  }
});
observe(21,'mandatory base and applicable host override use exact documented identifiers',()=>{
  for(const mutate of [p=>p.elements.pop(),p=>p.elements.shift(),p=>p.elements[1].id='HostCommand',p=>p.elements[0].value=42,p=>p.elements.push({id:'guess',scope:'workspace',purpose:'routing',necessity:'guessed'})]){
    const f=configuration('P','v1','cfg');mutate(f.configuration_plan);assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);
  }
  const f=configuration('P','v1','cfg');f.configuration_observation.host_overrides=[];f.configuration_plan.elements.pop();assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,true);
});
observe(22,'minimality rejects duplicate sources unnecessary global changes and stale overwrites',()=>{
  for(const mutate of [f=>f.configuration_plan.sources.push('extra-discovery'),f=>f.configuration_plan.elements[0].scope='global',f=>f.configuration_plan.expected_revision='stale',f=>f.configuration_observation.unrelated_content_preserved=false,f=>f.configuration_observation.active_duplicates_absent=false,f=>f.configuration_observation.approval_dependencies_reconciled=false]){
    const f=configuration('P','v1','cfg');mutate(f);assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);
  }
});
observe(23,'version host and official guidance invalidation blocks dependent claims only',()=>{
  for(const mutate of [f=>f.configuration_observation.runtime_version='v2',f=>f.configuration_observation.host='other',f=>f.configuration_observation.official_sources=[],f=>f.configuration_observation.javascript_support_verified=false]){
    const f=configuration('P','v1','cfg');mutate(f);assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);
  }
  const f=configuration('P','v1','cfg'),r=c.validateConfiguration(f.configuration_plan,f.configuration_observation);assert.equal(r.dispatch_verified,false);
});
observe(24,'official controller applies typed mutation contract without new commands or exits',()=>{
  const engine=require('../dist/oop-enforce.js'),f=fixture();
  const scope={classification:'known',request:['ticket_mutation']};
  const context={project:'P',runtime:'worker',session:'s',request_scope:'r',action_scope:'a',checkpoint_ref:'owned/second/current',checkpoint_revision:'1',mapping_revision:'1',oop_commit:A,revision:B,authority:'authorized',resource:'T1',risk:'G1',lifecycle:'active',context_retention:'current',machine_id:identity('second').machine_id,installation_uid:'second',instruction_origin_uid:'second',observed_at:'2026-10-24T10:00:00Z',dependencies:{adapter:'fixture'}};
  const req={format:1,request_id:'mutation',scope,context,effect_class:'ticket_mutation',organizational_mutation:{proposal:f.proposal,observation:f.trusted},evidence:{}};
  req.maintenance_observation=normalMode(req);
  const modules=engine.evaluate('interaction',req).payload.modules;
  for(const id of engine.evaluate('pre-effect',req).payload.missing??[])req.evidence[id]={value:true,origin:'authoritative_observation',reference:'fixture:proof',binding:{...Object.fromEntries(Object.entries(context).filter(([k])=>!['observed_at','dependencies'].includes(k))),command:'pre-effect',selection:modules.join(','),effect_class:'ticket_mutation'},dependencies:context.dependencies,observed_at:'2026-10-24T09:59:00Z',expires_at:'2026-10-24T10:01:00Z'};
  assert.equal(engine.evaluate('pre-effect',req).decision,'allow');
  const bad=clone(req);bad.organizational_mutation.proposal.ticket.previous_versions_list=[];assert.equal(engine.evaluate('pre-effect',bad).decision,'deny');
  delete req.organizational_mutation;assert.notEqual(engine.evaluate('pre-effect',req).decision,'allow');
  assert.deepEqual(engine.exitCodes,{allow:0,deny:2,unknown:3,error:4});assert.equal(Object.keys(engine.config.commands).length,8);
});
observe(25,'machine ID preserves the full public fingerprint and registry detects copied identities',()=>{
  const a=identity('a'),b=identity('b');assert.equal(c.registry([a,b]),true);
  b.authentication_identity=clone(a.authentication_identity);b.machine_id=a.machine_id;
  assert.equal(c.registry([a,b]),false);assert.notEqual(c.machineId({...a.authentication_identity,fingerprint:a.authentication_identity.fingerprint+'x'}),a.machine_id);
  assert.throws(()=>c.machineId({...a.authentication_identity,scheme:'ssh:sha256'}),'scheme delimiter cannot create ambiguous public IDs');
});
observe(26,'nested runtimes keep globally unique UIDs and immutable installation history',()=>{
  const f=fixture(),target=f.trusted.registry[1];target.runtimes.push({...identity('third').runtimes[0]});
  f.proposal={kind:'registry',expected_revision:B,resulting_predecessor:B,filename:target.machine_id+'.json',records:clone(f.trusted.registry)};
  assert.equal(check(f).valid,true);f.proposal.records[1].runtimes[1].first_installed_at='2026-10-25T09:00:00Z';assert.equal(check(f).reason,'runtime_history_changed');
  const duplicate=identity('third');assert.equal(c.registry([...f.trusted.registry,duplicate]),false);
});
observe(27,'machine publication requires exact filename and observed unique credential membership',()=>{
  const f=fixture();f.proposal={kind:'registry',expected_revision:B,resulting_predecessor:B,filename:f.trusted.machine_id+'.json',records:clone(f.trusted.registry)};
  assert.equal(check(f).valid,true);
  for(const patch of [{filename:'runtime.json'},{filename:'../'+f.proposal.filename}])assert.equal(c.validateMutation({...f.proposal,...patch},f.trusted).valid,false);
  for(const patch of [{credential_unique_to_machine:false},{machine_identity_verified:false}])assert.equal(c.validateMutation(f.proposal,{...f.trusted,...patch}).valid,false);
});
observe(28,'rotation requires continuity and preserves aliases runtime UIDs and peer records',()=>{
  const f=fixture(),old=f.trusted.registry[1],next=identity('second','same-runtime-class','SHA256:rotated');next.historical_machine_ids=[old.machine_id];
  f.trusted.machine_id=next.machine_id;f.trusted.machine_metadata=metadata(next);f.proposal={kind:'registry',expected_revision:B,resulting_predecessor:B,filename:next.machine_id+'.json',records:[clone(f.trusted.registry[0]),next]};
  assert.equal(check(f).valid,false);Object.assign(f.trusted,{rotation_authorized:true,rotation_continuity_verified:true});assert.equal(check(f).valid,true);
  f.proposal.records[0].owner_name='clobbered';f.trusted.owner_update_authorized=false;assert.equal(check(f).valid,false);
});
observe(29,'unknown first-installation dates stay explicit and invalid dates fail',()=>{
  const t=identity('one');Object.assign(t.runtimes[0],{first_installed_at:null,first_installation_evidence:'unknown_legacy'});assert.equal(c.identity(t),true);
  t.runtimes[0].first_installed_at='invalid';assert.equal(c.identity(t),false);
});
function maintenanceFixture(){
  const context={project:'P',runtime:'runtime-class',installation_uid:'second',machine_id:'machine-fixture',checkpoint_ref:'owned/second/checkpoint.json',checkpoint_revision:'1',mapping_revision:'m1',revision:B,authority:'repair-authority',action_scope:'adapter-repair',observed_at:'2026-10-24T10:00:00Z',dependencies:{native:'cfg1'}};
  const req={format:1,request_id:'adapter-repair',scope:{classification:'known',request:['local_write']},context,runtime_adapter_maintenance:{action:'edit',runtime_adapter_path:'owned/second/oop-runtime-adapter.js',expected_revision:'state-1'}};
  const o={...normalMode(req),mode:'maintenance',owned_scope:'owned/second',runtime_adapter_path:req.runtime_adapter_maintenance.runtime_adapter_path,native_extension:'ps1',declaration_path:'owned/second/oop-runtime-adapter-maintenance.json',declaration_revision:'state-1',declaration_machine_id:context.machine_id,declaration_runtime_uid:context.installation_uid,
    declaration_owned:true,native_extension_verified:true,exclusive_update_verified:true,independent_boundary_verified:true,paths_resolved_without_aliases:true,peer_state_preserved:true,authorized_repair:true,install_13_14_eligible:true,
    actual_effects:[{kind:'write',path:req.runtime_adapter_maintenance.runtime_adapter_path,resolved_path:req.runtime_adapter_maintenance.runtime_adapter_path,links_absent:true}],network_effects_absent:true,git_effects_absent:true,unlisted_effects_absent:true};
  req.maintenance_observation=o;return {req,o};
}
observe(30,'confined repair is admitted without circular healthy-adapter installation predicates',()=>{
  const {req,o}=maintenanceFixture();assert.equal(c.maintenance(req,o).decision,'allow');
  const engine=require('../dist/oop-enforce.js');assert.equal(engine.evaluate('pre-effect',req).decision,'allow');
  assert.equal(engine.evaluate('completion',req).decision,'deny');
});
observe(31,'omitting or forging mode cannot bypass active maintenance',()=>{
  const {req,o}=maintenanceFixture();delete req.runtime_adapter_maintenance;assert.equal(c.maintenance(req,o).decision,'deny');
  assert.equal(c.maintenance(req,undefined).decision,'unknown');assert.equal(c.maintenance(req,{...o,origin:'model_assertion'}).decision,'unknown');
  assert.equal(c.maintenance(req,{...o,expires_at:req.context.observed_at}).decision,'unknown');
});
observe(32,'maintenance denies commits pushes tickets controller credentials and peer paths',()=>{
  for(const path of ['operations/installations/machine.json','operations/tickets/T1.json','owned/peer/oop-runtime-adapter.js','dist/oop-enforce.js','.priv/common/authentication/key']){
    const {req,o}=maintenanceFixture();o.actual_effects[0]={kind:'write',path,resolved_path:path,links_absent:true};assert.equal(c.maintenance(req,o).decision,'deny',path);
  }
  for(const flag of ['git_effects_absent','network_effects_absent','unlisted_effects_absent']){const {req,o}=maintenanceFixture();o[flag]=false;assert.equal(c.maintenance(req,o).decision,'deny');}
});
observe(33,'maintenance rejects stale foreign linked and unconstrained repair observations',()=>{
  for(const patch of [{declaration_runtime_uid:'peer'},{declaration_revision:'stale'},{paths_resolved_without_aliases:false},{independent_boundary_verified:false},{install_13_14_eligible:false},{exclusive_update_verified:false}]){
    const {req,o}=maintenanceFixture();assert.equal(c.maintenance(req,{...o,...patch}).decision,'deny');
  }
  const {req,o}=maintenanceFixture();o.actual_effects[0].links_absent=false;assert.equal(c.maintenance(req,o).decision,'deny');
});
observe(34,'crash recovery retains confinement and exit requires real administrative reconciliation',()=>{
  const {req,o}=maintenanceFixture();o.mode='recovering';o.actual_effects.push({kind:'write',path:o.declaration_path,resolved_path:o.declaration_path,links_absent:true});req.runtime_adapter_maintenance.action='exit';assert.equal(c.maintenance(req,o).decision,'deny');
  Object.assign(o,{artifact_reconciled:true,administrative_configuration_reconciled:true,native_consent_and_restart_resolved:true,real_errors_absent:true,checkpoint_reference_reconciled:true});
  assert.equal(c.maintenance(req,o).next_mode,'normal');assert.equal(c.maintenance(req,o).installation_certification,false);
  req.runtime_adapter_maintenance.action='enter';o.mode='normal';assert.equal(c.maintenance(req,o).decision,'deny');o.safe_active_or_independent_repair_entry=true;assert.equal(c.maintenance(req,o).decision,'allow');
});
observe(35,'canonical basename and selected documented shell extension are mandatory',()=>{
  const f=configuration('P','v1','cfg');assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,true);
  for(const path of ['owned/fixture-installation-uid/unexpected.txt','owned/fixture-installation-uid/oop-runtime-adapter.js']){
    f.configuration_plan.runtime_adapter.entrypoint=path;assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);
  }
});
observe(36,'concurrent runtime enrollment retries preserve the winning peer array',async()=>{
  const base=identity('first'),uid='second',extra=identity(uid).runtimes[0];let canonical=[base],revision=B;
  const proposal=()=>({kind:'registry',destination:'operations:P',expected_revision:revision,resulting_predecessor:revision,filename:base.machine_id+'.json',records:[{...clone(canonical[0]),runtimes:[...clone(canonical[0].runtimes),extra]}]});
  const trusted={...fixture().trusted,executing_installation_uid:uid,instruction_origin_uid:uid,registry:canonical,machine_metadata:metadata(base),machine_id:base.machine_id,enrollment_authorized:true,local_identity_verified:true,enrollment_records:{second:extra}};
  const p=proposal(),backend={conditional:async(expected,validate)=>{if(revision!==expected)throw Error('stale');const next=await validate({...trusted,current_revision:revision,registry:canonical});if(revision!==expected)throw Error('stale');canonical=next.records;revision=C;return {predecessor:B,revision:C};},readback:async()=>p};
  const results=await Promise.all([c.publishMutation(p,backend),c.publishMutation(p,backend)]);assert.equal(results.filter(x=>x.verified).length,1);assert.deepEqual(canonical[0].runtimes.map(x=>x.installation_uid),['first','second']);
});
