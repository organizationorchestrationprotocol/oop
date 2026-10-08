import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validateProfile} from './schema-profile.mjs';
const require=createRequire(import.meta.url);
const {planInstallation,currentInstallationPlan}=require('./enforcement-adapter.cjs');
const {buildManifest,validateManifest,refs,phases,roles}=require('./enforcement-install.cjs');
const manifest=JSON.parse(readFileSync(new URL('../dist/enforcement-install.json',import.meta.url)));
const clone=x=>structuredClone(x);
function fixture(){
  const scope={project:'project-a',runtime:'runtime-a',authority:'owner-a',revision:'revision-a'};
  const dependencies={source:manifest.source_binding.source_identity,runtime_build:'build-a',permissions:'permissions-a',configuration:'configuration-a',capabilities:'capabilities-a'};
  const proof={origin:'authoritative_observation',reference:'host:inventory-a',scope,dependencies,
    observed_at:'2026-10-20T08:00:00Z',expires_at:'2026-10-20T09:00:00Z'};
  const facts={...require('./fixtures/native-configuration.cjs')(scope.project,dependencies.runtime_build,dependencies.configuration),...proof,complete:true,effects_possible:true,resumable:true,delegation_used:true,
    paths:[...new Set(Object.values(phases).flat())].filter(p=>p!=='diagnostic_after_bootstrap').map(phase=>({phase,path:'owned-path'}))};
  const options={scope,now:Date.parse('2026-10-20T08:30:00Z'),expectedSourceBinding:manifest.source_binding,adoptedCommit:'1'.repeat(40)};
  const capabilities=manifest.features.filter(f=>f.feature!=='probe').map(f=>({id:f.feature,registration:'bridge:'+f.feature,fingerprint:'stable:'+f.feature,
    tier:3,available:true,authorized:true,disabled:false,features:[f.feature],paths:['owned-path'],phases:f.phases,
    semantics:roles[f.feature],blocking:f.required_semantics.blocking_required,scope,provenance:proof,capability_class:f.capability_classes[0],
    bridge:{entrypoint:'/private/tools/fixture-installation-uid/oop-enforce-bridge.sh',interpreter:'fixture-native-shell',ownership_reference:'host:owned-bridge',controller_interface:'oop-admission-1'}}));
  return {scope,dependencies,proof,facts,options,capabilities};
}
test('REL-ENF-047: complete versioned manifest rejects missing, changed and future semantics',()=>{
  assert.equal(validateManifest(manifest,manifest.source_binding),true);
  const schema=JSON.parse(readFileSync(new URL('./schemas/enforcement-install.schema.json',import.meta.url)));
  assert.deepEqual(validateProfile(manifest,schema),[]);
  const invalid=clone(manifest);invalid.features[0].verification.active_hook_tests=true;
  assert.ok(validateProfile(invalid,schema).length);
  assert.equal(manifest.features.length,8);
  assert.equal(validateManifest({...manifest,content_identity:'sha256:'+'b'.repeat(64)},manifest.source_binding),true,
    'Producer identity is opaque consumer metadata, never a publisher checksum audit');
  for(const mutate of [m=>m.format=1,m=>m.features.pop(),m=>m.features[2].required_semantics.blocking_required=false,
    m=>m.features[5].phases.pop(),m=>m.features[7].required_coverage.applicability='always',m=>m.extra=true]){
    const m=clone(manifest);mutate(m);assert.equal(validateManifest(m,manifest.source_binding),false);
  }
  assert.deepEqual(refs,manifest.source_contracts.map(c=>c.id));
  assert.ok(manifest.source_contracts.every(c=>c.source.locator&&c.source.content_identity));
});
test('REL-ENF-048: scope derives every feature phase and applicable path without caller omissions',()=>{
  const f=fixture();f.facts.paths.push({phase:'before_effect',path:'alternate-path'});
  const p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(p.plan_complete,false);assert.ok(p.uncovered.some(r=>r.path==='alternate-path'));
  assert.ok(p.requirements.some(r=>r.feature==='delegate'&&r.phase==='delegate_finish'));
  assert.ok(p.requirements.some(r=>r.feature==='recovery'&&r.phase==='resume_before_effect'));
  for(const mutate of [x=>delete x.facts.effects_possible,x=>x.facts.complete=false,
    x=>x.facts.paths=x.facts.paths.filter(p=>p.phase!=='before_effect'),x=>x.facts.expires_at='2026-10-19T00:00:00Z',
    x=>x.facts.scope={...x.scope,project:'other'},x=>x.options.adoptedCommit='source_snapshot',x=>x.facts.effects_possible=false]){
    const x=fixture();mutate(x);assert.equal(planInstallation(manifest,x.capabilities,x.facts,{},x.options).plan_complete,false);
  }
});
test('REL-ENF-049: observational, unauthorized, disabled and foreign capabilities cannot prevent effects',()=>{
  for(const mutate of [c=>c.semantics='observation',c=>c.blocking=false,c=>c.authorized=false,c=>c.disabled=true,
    c=>c.available=false,c=>c.capability_class='native_post_effect_observer',c=>c.scope={...c.scope,project:'other'},
    c=>c.provenance={...c.provenance,origin:'model_assertion'},c=>c.provenance={...c.provenance,expires_at:'2026-10-19T00:00:00Z'},c=>delete c.bridge]){
    const f=fixture();mutate(f.capabilities.find(c=>c.id==='pre-effect'));
    const p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
    assert.equal(p.plan_complete,false);assert.ok(p.uncovered.some(r=>r.feature==='pre-effect'));
  }
});
test('REL-ENF-050: strongest prevention and complementary paths precede reuse and registration count',()=>{
  const f=fixture(),strong=clone(f.capabilities.find(c=>c.id==='pre-effect'));
  strong.id='stronger';strong.registration='stronger';strong.tier=4;f.capabilities.push(strong);
  f.facts.paths.push({phase:'before_effect',path:'backend'});
  const complement={...clone(strong),id:'backend',registration:'backend',paths:['backend'],tier:2};f.capabilities.push(complement);
  const p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(p.plan_complete,true);
  assert.ok(p.registrations.some(g=>g.registration==='stronger'));assert.ok(p.registrations.some(g=>g.registration==='backend'));
  const conflict={...clone(strong),id:'conflict',fingerprint:'different'};
  assert.equal(planInstallation(manifest,[...f.capabilities,conflict],f.facts,{},f.options).plan_complete,false);
});
test('REL-ENF-051: one authenticated multi-role registration shares entry and recovery',()=>{
  const f=fixture();
  const session={...clone(f.capabilities[0]),id:'session',registration:'session',features:['entry','recovery'],
    phases:['session_entry','resume_before_effect'],feature_semantics:{entry:'context_delivery',recovery:'preventive_gate'},blocking:true};
  // A host proves both eligible roles using one native execution-policy registration.
  session.capability_class='native_execution_policy';
  const m=clone(manifest);
  // Context delivery can use an authenticated preventive registration too.
  const p=planInstallation(m,[session,...f.capabilities.filter(c=>!['entry','recovery'].includes(c.id))],f.facts,{},f.options);
  assert.equal(p.plan_complete,true);assert.deepEqual(p.registrations.find(g=>g.registration==='session').features,['entry','recovery']);
  session.feature_semantics={entry:'context_delivery',recovery:'context_delivery'};
  assert.equal(planInstallation(m,[session,...f.capabilities.filter(c=>!['entry','recovery'].includes(c.id))],f.facts,{},f.options).plan_complete,false);
});
test('REL-ENF-052: current plan is non-authorizing and stale scope or dependencies block BOOT-12',()=>{
  const f=fixture(),p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(p.plan_complete,true);assert.equal(p.full_readiness,false);assert.equal(p.bootstrap_complete,false);
  assert.equal(p.effect_permission,'not_granted');assert.equal(p.status,'PLANNED');
  const check={...f.options,dependencies:f.dependencies,manifestIdentity:manifest.content_identity,expectedPlanIdentity:p.plan_identity};
  assert.equal(currentInstallationPlan(p,check),true);
  for(const change of [{now:Date.parse('2026-10-21T00:00:00Z')},{scope:{...f.scope,project:'other'}},
    ...['runtime','authority','revision'].map(k=>({scope:{...f.scope,[k]:'other'}})),
    ...Object.keys(f.dependencies).map(k=>({dependencies:{...f.dependencies,[k]:'changed'}})),
    {expectedSourceBinding:{...manifest.source_binding,source_identity:'other'}},
    {now:Date.parse('2026-10-20T07:59:00Z')},{manifestIdentity:'other'},{adoptedCommit:'2'.repeat(40)},{expectedPlanIdentity:'forged'}])
    assert.equal(currentInstallationPlan(p,{...check,...change}),false);
  const bad=clone(p);bad.requirements.pop();assert.equal(currentInstallationPlan(bad,check),false);
  assert.equal(p.active_hook_tests,0);assert.ok(p.dispositions.some(d=>d.feature==='probe'&&d.status==='not_applicable'));
  const shorter=fixture();shorter.capabilities[0].provenance={...shorter.proof,expires_at:'2026-10-20T08:40:00Z'};
  const expiring=planInstallation(manifest,shorter.capabilities,shorter.facts,{},shorter.options);
  assert.equal(currentInstallationPlan(expiring,{...check,expectedPlanIdentity:expiring.plan_identity,now:Date.parse('2026-10-20T08:45:00Z')}),false);
  const malformed=fixture();malformed.capabilities=[null,{features:'not-an-array'}];
  assert.equal(planInstallation(manifest,malformed.capabilities,malformed.facts,{},malformed.options).plan_complete,false);
});
test('REL-ENF-053: compatible adopted-source replacement reuses native entrypoints with targeted readback',()=>{
  const f=fixture(),p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  const installed={dependencies:{...f.dependencies,source:'prior-source'},registrations:p.registrations.map(g=>({...g,administrative_completed:true}))};
  const next=planInstallation(manifest,f.capabilities,f.facts,installed,f.options);
  assert.equal(next.plan_complete,true);assert.ok(next.actions.length>0);
  assert.ok(next.actions.every(a=>a.operation==='reuse'));
  // T05-09: targeted repair does not invalidate unrelated native registrations.
  const repaired=fixture();repaired.capabilities[0].fingerprint='repaired-entry';
  const repairPlan=planInstallation(manifest,repaired.capabilities,repaired.facts,
    {dependencies:f.dependencies,registrations:installed.registrations},repaired.options);
  assert.equal(repairPlan.actions.find(a=>a.registration===repaired.capabilities[0].registration).operation,'configure_and_acknowledge');
  assert.ok(repairPlan.actions.filter(a=>a.registration!==repaired.capabilities[0].registration).every(a=>a.operation==='reuse'));
  installed.dependencies.permissions='changed';
  assert.ok(planInstallation(manifest,f.capabilities,f.facts,installed,f.options).actions.every(a=>a.operation==='configure_and_acknowledge'));
});
test('REL-ENF-054: BOOT-12 consumes plan before readback and BOOT-13 retains publication',()=>{
  const b=JSON.parse(readFileSync(new URL('../dist/procedures/bootstrap.json',import.meta.url)));
  const step=b.steps.find(s=>s.id==='BOOT-12');
  assert.ok(step.guard.all.some(g=>g.fact==='complete_initial_inventory'));
  assert.equal(step.binding_plan.coverage_reassessment,false);assert.equal(step.binding_plan.active_hook_tests,0);
  assert.ok(step.guard.all.some(g=>g.fact==='frozen_initial_installation_set'));
  assert.ok(b.steps.find(s=>s.id==='BOOT-13').guard.all.some(g=>g.fact==='identity_registration_publication_verified'));
  assert.equal(b.installation.enforcement_complete_after,'BOOT-12');assert.equal(b.installation.installation_complete_after,'BOOT-13');assert.equal(b.installation.bootstrap_complete_after,'BOOT-13');
});
test('REL-ENF-055: full Git object IDs preserve exact scoped plan identity and reject other formats',()=>{
  const plans=[];
  for(const adoptedCommit of ['a'.repeat(40),'b'.repeat(64)]){
    const f=fixture(),options={...f.options,adoptedCommit};
    const p=planInstallation(manifest,f.capabilities,f.facts,{},options);
    assert.equal(p.plan_complete,true);
    assert.equal(p.adopted_commit,adoptedCommit);
    assert.deepEqual(p.source_binding,manifest.source_binding);
    assert.equal(p.manifest_ref.content_identity,manifest.content_identity);
    assert.equal(p.effect_permission,'not_granted');
    assert.equal(p.full_readiness,false);assert.equal(p.bootstrap_complete,false);
    const check={...options,dependencies:f.dependencies,manifestIdentity:manifest.content_identity,expectedPlanIdentity:p.plan_identity};
    assert.equal(currentInstallationPlan(p,check),true);
    for(const other of ['c'.repeat(40),'d'.repeat(64)])
      assert.equal(currentInstallationPlan(p,{...check,adoptedCommit:other}),false);
    const changed=clone(p);changed.adopted_commit='e'.repeat(adoptedCommit.length);
    assert.equal(currentInstallationPlan(changed,check),false);
    plans.push(p);
  }
  assert.notEqual(plans[0].plan_identity,plans[1].plan_identity);
  for(const adoptedCommit of [undefined,null,0,{},[],['a'.repeat(40)],{toString:()=> 'a'.repeat(64)},
    '', 'a'.repeat(7), ...[39,41,63,65].map(n=>'a'.repeat(n)),
    'g'.repeat(40),'g'.repeat(64),'A'.repeat(40),'B'.repeat(64),
    'a'.repeat(40)+'\n',' '+ 'b'.repeat(64),'sha256:'+'a'.repeat(64),'source_snapshot','v1.0.0']){
    const f=fixture();
    const p=planInstallation(manifest,f.capabilities,f.facts,{},{...f.options,adoptedCommit});
    assert.equal(p.plan_complete,false);
    assert.equal(p.reason,'incomplete_or_stale_host_inventory');
    assert.equal(p.effect_permission,'not_granted');
  }
});
test('REL-ENF-056: reasoned negative mappings preserve independent bindings without admitting installation',()=>{
  for(const [flag,status] of [['authorized','unauthorized'],['available','unsupported'],['disabled','blocked']]){
    const f=fixture();f.capabilities.find(c=>c.id==='completion')[flag]=flag==='disabled';
    const p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
    assert.equal(p.mapping_complete,true);assert.equal(p.coverage_complete,false);assert.equal(p.plan_complete,false);
    assert.equal(p.installation_verified,false);assert.equal(p.bootstrap_complete,false);assert.equal(p.effect_permission,'not_granted');
    assert.ok(p.registrations.some(g=>g.features.includes('pre-effect')));
    const disposition=p.dispositions.find(d=>d.requirement?.feature==='completion');
    assert.equal(disposition.status,status);assert.equal(disposition.assessment_state,'assessed');
    for(const k of ['reason','evidence','consequence','next_action'])assert.ok(disposition[k]);
    assert.equal(currentInstallationPlan(p,{...f.options,dependencies:f.dependencies,manifestIdentity:manifest.content_identity,
      expectedPlanIdentity:p.plan_identity}),flag!=='disabled',
      'Known unavailable authority/support is a disposition, while a known disabled required control needs reconciliation.');
  }
});
test('REL-ENF-057: empty inventory is unassessed until host supplies explicit per-need dispositions',()=>{
  const f=fixture();let p=planInstallation(manifest,[],f.facts,{},f.options);
  assert.equal(p.mapping_complete,false);assert.equal(p.coverage_complete,false);
  assert.ok(p.dispositions.filter(d=>d.requirement).every(d=>d.status==='unknown'&&d.assessment_state==='to_be_assessed'));
  f.facts.requirement_assessments=p.requirements.map(requirement=>({requirement,status:'unsupported',
    reason:'host_has_no_compatible_registration',evidence_reference:'host:capability-inventory',
    consequence:'dependent_scope_blocked',next_action:'recheck_on_host_change'}));
  p=planInstallation(manifest,[],f.facts,{},f.options);
  assert.equal(p.mapping_complete,true);assert.equal(p.coverage_complete,false);assert.equal(p.plan_complete,false);
  assert.equal(p.registrations.length,0);assert.equal(p.installation_verified,false);
  const blocked=f.facts.requirement_assessments[0];Object.assign(blocked,{status:'blocked',dependency:'host-trust',
    responsible_actor:'host-admin',resume_condition:'host_trust_readback',alternatives_checked:'host:alternatives'});
  assert.equal(planInstallation(manifest,[],f.facts,{},f.options).mapping_complete,true);
  delete blocked.resume_condition;
  assert.equal(planInstallation(manifest,[],f.facts,{},f.options).mapping_complete,false);
  for(const bad of [true,{},[null],[blocked,blocked]]){
    assert.equal(planInstallation(manifest,[],{...f.facts,requirement_assessments:bad},{},f.options).mapping_complete,false);
  }
  f.facts.origin='model_assertion';
  assert.equal(planInstallation(manifest,[],f.facts,{},f.options).mapping_complete,false);
});
test('REL-ENF-058: planned coverage and authenticated installation readback are distinct from publication',()=>{
  const f=fixture(),p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(p.mapping_complete,true);assert.equal(p.coverage_complete,true);assert.equal(p.installation_verified,false);
  for(const c of f.capabilities){
    const group=p.registrations.find(g=>g.registration===c.registration);
    c.administrative_evidence={...f.proof,invocation:group.invocation,coverage:group.coverage,
      installation_completed:true,native_consent_resolved:true,restart_resolved:true,real_error_absent:true};
  }
  const installed=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(installed.installation_verified,true);assert.equal(installed.bootstrap_complete,false);
  assert.equal(installed.effect_permission,'not_granted');assert.equal(installed.active_hook_tests,0);
  for(const flag of ['installation_completed','native_consent_resolved','restart_resolved','real_error_absent']){
    const changed=clone(f);changed.capabilities[0].administrative_evidence[flag]=false;
    assert.equal(planInstallation(manifest,changed.capabilities,changed.facts,{},changed.options).installation_verified,false);
  }
  // T05-05/06: this API has no independent host-authenticated legacy provenance.
  // The old fixture manufactured legacy status by stripping new fields and hashing.
  // Ambiguous retained records must be replanned from current authoritative inventory.
  const legacy=clone(p);for(const k of ['mapping_complete','coverage_complete','installation_verified','diagnostics_format','plan_identity'])delete legacy[k];
  const {identity}=require('./enforcement-install.cjs');legacy.plan_identity=identity(legacy);
  assert.equal(currentInstallationPlan(legacy,{...f.options,dependencies:f.dependencies,manifestIdentity:manifest.content_identity,
    expectedPlanIdentity:legacy.plan_identity}),false);
  const revalidated=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(currentInstallationPlan(revalidated,{...f.options,dependencies:f.dependencies,manifestIdentity:manifest.content_identity,
    expectedPlanIdentity:revalidated.plan_identity}),true);
  // T05-02/04/08: even a recomputed matching identity cannot repair contradictions.
  const reject=mutate=>{
    const bad=clone(p);delete bad.plan_identity;mutate(bad);bad.plan_identity=identity(bad);
    assert.equal(currentInstallationPlan(bad,{...f.options,dependencies:f.dependencies,
      manifestIdentity:manifest.content_identity,expectedPlanIdentity:bad.plan_identity}),false,mutate.toString());
  };
  for(const key of ['diagnostics_format','mapping_complete','coverage_complete','installation_verified']){
    reject(bad=>delete bad[key]);
    reject(bad=>bad[key]='true');
  }
  for(const mutate of [bad=>bad.diagnostics_format=2,bad=>bad.mapping_complete=false,bad=>bad.coverage_complete=false,
    bad=>bad.installation_verified=true,bad=>bad.plan_complete=false,bad=>bad.uncovered=[bad.requirements[0]],
    bad=>bad.registrations=[],bad=>bad.registrations[0].coverage=[],bad=>bad.requirements=[],
    bad=>bad.dispositions[0].assessment_state='to_be_assessed',
    bad=>bad.dispositions.find(d=>d.requirement).status='unknown',
    bad=>bad.dispositions.find(d=>d.requirement).registration='foreign',
    bad=>bad.dispositions.push(clone(bad.dispositions.find(d=>d.requirement))),
    bad=>bad.effect_permission='granted',bad=>bad.full_readiness=true,bad=>bad.bootstrap_complete=true])reject(mutate);
});
test('REL-ENF-059: diagnostic observations expire and invalid inventory never manufactures complete mapping',()=>{
  const f=fixture();f.capabilities[0].available=false;
  f.capabilities[0].provenance={...f.proof,expires_at:'2026-10-20T08:35:00Z'};
  const p=planInstallation(manifest,f.capabilities,f.facts,{},f.options);
  assert.equal(p.mapping_complete,true);assert.equal(p.expires_at,'2026-10-20T08:35:00.000Z');
  const stale={...f.options,now:Date.parse('2026-10-20T08:36:00Z')};
  assert.equal(planInstallation(manifest,f.capabilities,f.facts,{},stale).mapping_complete,false);
  const malformed=fixture();malformed.capabilities.push(null);
  const incomplete=planInstallation(manifest,malformed.capabilities,malformed.facts,{},malformed.options);
  assert.equal(incomplete.mapping_complete,false);assert.equal(incomplete.coverage_complete,true);
  assert.equal(incomplete.plan_complete,true);
  assert.equal(currentInstallationPlan(incomplete,{...malformed.options,dependencies:malformed.dependencies,
    manifestIdentity:manifest.content_identity,expectedPlanIdentity:incomplete.plan_identity}),false,
    'T05-01: full coverage cannot admit an incompletely assessed inventory');
  const scoped=fixture();scoped.facts.delegation_used=false;scoped.facts.resumable=false;
  scoped.capabilities=scoped.capabilities.filter(c=>!c.features.includes('delegate'));
  scoped.facts.paths=scoped.facts.paths.filter(p=>!['delegate_start','delegate_finish','resume_before_effect'].includes(p.phase));
  const initial=planInstallation(manifest,scoped.capabilities,scoped.facts,{},scoped.options);
  assert.equal(initial.plan_complete,true);assert.ok(initial.dispositions.some(d=>d.feature==='delegate'&&d.status==='not_applicable'));
  // A new delegation/alternate path invalidates only its dependent plan; it never reuses prior scope silently.
  scoped.facts.delegation_supported=true;
  assert.equal(planInstallation(manifest,scoped.capabilities,scoped.facts,{},scoped.options).mapping_complete,false);
  const classes=fixture();classes.facts.paths.push({phase:'before_effect',path:'owned-path',effect_class:'publish',
    resource_class:'canonical-record',authority_scope:'approved-repository'});
  let limited=planInstallation(manifest,classes.capabilities,classes.facts,{},classes.options);
  assert.equal(limited.coverage_complete,false);assert.ok(limited.uncovered.some(r=>r.effect_class==='publish'));
  const cap=classes.capabilities.find(c=>c.id==='pre-effect');
  Object.assign(cap,{effect_classes:['publish'],resource_classes:['canonical-record'],authority_scopes:['approved-repository']});
  const adequate=planInstallation(manifest,classes.capabilities,classes.facts,{},classes.options);
  assert.equal(adequate.coverage_complete,true);
  assert.equal(adequate.requirements.filter(r=>r.feature==='pre-effect').length,2);
  cap.authority_scopes=['different-authorization'];
  assert.equal(planInstallation(manifest,classes.capabilities,classes.facts,{},classes.options).coverage_complete,false);
});
