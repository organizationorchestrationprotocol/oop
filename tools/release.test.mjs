import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { entry,routing,readJSON,select,contextSession } from './release-engine.mjs';
import { closure,evaluateGuard,operationsAccess,invalidated,reusable,presentationLanguage,coworkerIdentityPlan,workerRepositoryAdmission,commitAttributionGate } from './reference-engine.mjs';
import { validateProfile } from './schema-profile.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=protocolSource(read('PROTOCOL.md')), sourceLines=source.split('\n');
const trace=JSON.parse(read('tools/evidence/release-traceability.json'));
const review=JSON.parse(read('tools/release-review.json'));
const schema=JSON.parse(read('tools/schemas/contract.schema.json'));
const bootstrap=readJSON('procedures/bootstrap.json');
const bootStep=id=>bootstrap.steps.find(s=>s.id===id);
const facts=(request=[],extra={})=>({classification:'known',request,...extra});
const includes=(selected,...ids)=>ids.every(id=>selected.modules.includes(id));
const sha=x=>`sha256:${createHash('sha256').update(x).digest('hex')}`;

test('REL-PKG-001: all source spans reconstructed exactly with no omissions or overlap',()=>{
  const title = '# Cross-Tool Organization Orchestration Protocol\n\n';
  const runtime = '# Rules for the runtime';
  const maintainer = '# Rules for the maintainer';
  const document = title + runtime + '\n\nnormative\n\n' + maintainer + '\n\nMaintainer-only instructions.';
  assert.equal(protocolSource(document), title + 'normative');
  assert.equal(protocolSource(document.replace('normative','changed normative')), title + 'changed normative');
  assert.equal(protocolSource(document.replace(/\n/g,'\r\n')), title + 'normative');
  const overview = '**Author:** Example author\n\n## Abstract\n\nExplanatory overview.\n\n';
  assert.equal(protocolSource(document.replace(runtime,overview + runtime)), title + 'normative');
  assert.equal(protocolSource(document.replace(runtime,overview.replace('Explanatory overview.','Revised overview.') + runtime)), title + 'normative');
  for (const heading of [runtime, maintainer]) {
    assert.throws(() => protocolSource(document.replace(heading,'')), /Missing/);
    assert.throws(() => protocolSource(document.replace(heading,heading.toUpperCase())), /Missing/);
    assert.throws(() => protocolSource(document.replace(heading,'#' + heading)), /Missing/);
    assert.throws(() => protocolSource(document + '\n\n' + heading + '\n'), /duplicate/);
    assert.throws(() => protocolSource(document.replace(heading,''),{historical:true}), /Missing/);
  }
  assert.throws(() => protocolSource(title + maintainer + '\n\nmaintenance\n\n' + runtime + '\n\nnormative'), /Malformed/);
  assert.throws(() => protocolSource(document.replace('normative','')), /Empty/);
  assert.throws(() => protocolSource(document.replace('Maintainer-only instructions.','')), /Malformed/);
  const legacy = title + 'normative\n\n<!-- OOP:MAINTAINER-APPENDIX -->\n\n## Repository maintainer instructions\nMaintenance';
  assert.throws(() => protocolSource(legacy), /Missing/);
  assert.throws(() => protocolSource(legacy,{historical:true}), /Missing/);
  assert.throws(() => protocolSource(title + 'normative',{historical:true}), /Missing/);
  assert.throws(() => protocolSource(legacy + legacy,{historical:true}), /Missing/);
  assert.throws(() => protocolSource(legacy.replace('<!-- OOP:MAINTAINER-APPENDIX -->\n\n',''),{historical:true}), /Missing/);

  let next=1;const texts=[];
  for(const item of trace.clauses){assert.equal(item.start,next);next=item.end+1;
    const clause=readJSON(`modules/${item.module}.json`).contracts.find(x=>x.id===item.contract);
    const [,start,end] = /^lines:(\d+)-(\d+)$/.exec(clause.source.locator);
    const locatedLines = read('PROTOCOL.md').replace(/\r\n/g,'\n').split('\n').slice(Number(start)-1,Number(end));
    const runtimeHeading = locatedLines.indexOf('# Rules for the runtime');
    const located = runtimeHeading === -1 ? locatedLines : [...locatedLines.slice(0,2),...locatedLines.slice(runtimeHeading+2)];
    assert.equal(located.join('\n'),clause.semantic_clause);
    assert.equal(clause.semantic_clause,sourceLines.slice(item.start-1,item.end).join('\n'));
    assert.equal(clause.scope,'$clause');
    assert.equal(sha(clause.semantic_clause),item.content_identity);texts.push(clause.semantic_clause);}
  assert.equal(next-1,sourceLines.length);assert.equal(texts.join('\n'),source);
  assert.equal(trace.source_identity,sha(source));assert.equal(review.source_identity,sha(source));
});
test('REL-PKG-002: every module contract satisfies the restricted versioned schema profile',()=>{
  for(const item of routing.modules)for(const clause of readJSON(item.context).contracts)assert.deepEqual(validateProfile(clause,schema),[]);
});
test('REL-PKG-003: entry and all route/detail/procedure references resolve locally',()=>{
  for(const path of entry.minimum_context)assert.ok(readJSON(path).contracts.length);
  readJSON(entry.selector);readJSON(entry.procedures.bootstrap);readJSON(entry.procedures.lifecycle);readJSON(entry.interfaces);
  for(const item of routing.modules){assert.equal(readJSON(item.context).id,item.id);assert.equal(readJSON(item.detail).id,item.id);}
});
test('REL-PKG-004: complete graph is acyclic and selection order is deterministic',()=>{
  assert.equal(closure(routing.modules,routing.modules.map(x=>x.id)).length,routing.modules.length);
  assert.deepEqual(select(facts(['canonical_write','handoff'])),select(facts(['handoff','canonical_write'])));
});
test('REL-PKG-005: ordinary G0 uses initial closure without provisioning or managed-work modules',()=>{
  const result=select(facts(['information']));assert.ok(includes(result,'core','workspace','context','entry'));
  for(const id of ['bootstrap','tickets','repository','security','producer'])assert.ok(!result.modules.includes(id));
  assert.equal(result.authority_granted,false);
});
test('REL-PKG-006: actual effect, risk, authority and recovery facets expand request routing by union',()=>{
  assert.ok(includes(select(facts(['information'],{action:['durable_write'],risk:['external_effect'],authority:['identity_sensitive'],recovery:['context_loss']})),
    'tickets','execution','security','delivery','recovery','entry'));
});
test('REL-PKG-007: unknown material scope uses conservative consumer closure and remains unresolved',()=>{
  const result=select({classification:'unknown',request:[]});assert.equal(result.classification_resolved,false);
  assert.equal(result.authority_granted,false);assert.equal(result.modules.length,routing.modules.length-1);assert.ok(!result.modules.includes('producer'));
});
test('REL-PKG-008: unknown selectors and missing dependencies fail instead of under-routing',()=>{
  assert.throws(()=>select(facts(['not-a-facet'])),/Unresolved facet/);
  const broken=structuredClone(routing);broken.modules.find(x=>x.id==='entry').dependencies.push('missing');
  assert.throws(()=>select(facts(['information']),broken),/Unknown dependency/);
});
test('REL-PKG-009: cache avoids duplicate file reads for unchanged applicable context',()=>{
  const session=contextSession('A','runtime-A','revision-A'),selection=select(facts(['information']));
  const first=session.load(selection),second=session.load(selection);
  assert.equal(second.reads,first.reads);assert.equal(second.loaded_bytes,first.loaded_bytes);assert.deepEqual(first.contracts,second.contracts);
});
test('REL-PKG-010: expansion reads only newly required modules and deduplicates contracts',()=>{
  const session=contextSession('A','R','C');const before=session.load(select(facts(['information'])));
  const after=session.load(select(facts(['durable_write'])));
  assert.equal(after.reads-before.reads,after.modules.length-before.modules.length);
  assert.equal(new Set(after.contracts.map(x=>x.id)).size,after.contracts.length);
});
test('REL-PKG-011: context loss reloads current closure rather than treating history as active context',()=>{
  const session=contextSession('A','R','C'),route=select(facts(['information']));const first=session.load(route);
  session.loseContext();const after=session.load(route);assert.equal(after.reads,first.reads*2);assert.deepEqual(after.contracts,first.contracts);
});
test('REL-PKG-012: module retirement prevents a monotonically growing working set',()=>{
  const session=contextSession('A','R','C');session.load(select(facts(['durable_write'])));
  const light=select(facts(['information']));session.retire(light);const after=session.load(light);
  assert.ok(!after.modules.includes('tickets'));assert.ok(after.contracts.every(x=>!x.id.includes('ticket-lifecycle')));
});
test('REL-PKG-013: full install contains all BOOT rows and mandatory dependent governance',()=>{
  const route=select(facts(['full_install']));assert.ok(includes(route,'bootstrap','activation','capabilities','adoption','operations','security'));
  const contract=readJSON('modules/bootstrap.json').contracts.find(x=>x.id==='OOP-full-install');
  const ids=['BOOT-01','BOOT-03','BOOT-04','BOOT-05','BOOT-06','BOOT-07','BOOT-08','BOOT-10','BOOT-11','BOOT-12','BOOT-13'];
  for(let n=1;n<=13;n++){const id=`BOOT-${String(n).padStart(2,'0')}`;assert.equal(contract.semantic_clause.includes(`**${id}**`),ids.includes(id),id);}
  assert.deepEqual(bootstrap.steps.map(s=>s.id),ids);assert.equal(bootStep('BOOT-10').effect_owner,'organization');
});
test('REL-PKG-014: positive, negative and unknown BOOT observations have distinct guard outcomes',()=>{
  for(const step of bootstrap.steps){const positive=Object.fromEntries(step.guard.all.map(x=>[x.fact,true]));
    assert.equal(evaluateGuard(step.guard,positive),'true');positive[step.guard.all[0].fact]=false;
    assert.equal(evaluateGuard(step.guard,positive),'false');assert.equal(evaluateGuard(step.guard,{}),'unknown');}
});
test('REL-PKG-015: user confirmation and command exit alone cannot satisfy access/control/readiness guards',()=>{
  for(const step of bootstrap.steps)assert.equal(evaluateGuard(step.guard,{user_confirmation:true,command_exit_zero:true}),'unknown');
});
test('REL-PKG-016: operations readiness verifies scoped runtime credential and both permissions, not visibility',()=>{
  const observation={expected_workspace:'A',workspace:'A',expected_repository:'ops-A',repository:'ops-A',expected_credential:'cred-A',credential:'cred-A',expected_adapter:'adapter-A',adapter:'adapter-A',read_verified:true,write_verified:true};
  assert.equal(operationsAccess({...observation,visibility:'public'}),'true');
  assert.equal(operationsAccess({...observation,write_verified:false}),'false');
  assert.equal(operationsAccess({...observation,credential:'personal'}),'false');
  assert.equal(operationsAccess({...observation,write_verified:undefined}),'unknown');
});
test('REL-PKG-017: source preserves provider uncertainty, manual enrollment and independent signing boundaries',()=>{
  const repo=readJSON('modules/repository.json').contracts[0].semantic_clause;
  assert.ok(repo.includes('confirmed_absent'));assert.ok(repo.includes('operations-2'));assert.ok(repo.includes('precise human instructions'));
  const credential=readJSON('modules/security.json').contracts[0].semantic_clause;
  assert.ok(credential.includes('SEC-05'));assert.ok(credential.includes('commit signing and tag signing MUST remain distinct'));
});
test('REL-PKG-018: migration and destination routes contain ownership/compatibility/source-target safeguards',()=>{
  assert.ok(includes(select(facts(['organizational_migration'])),'migration','operations','execution','changes'));
  assert.ok(includes(select(facts(['destination_entry'])),'destination','handoff','adoption','security'));
  const text=readJSON('modules/migration.json').contracts[0].semantic_clause;
  assert.ok(text.includes('organizational_state_change'));assert.ok(text.includes('scope: runtime'));assert.ok(text.includes('scope: organization'));
});
test('REL-PKG-019: bootstrap guard/transition identifiers and dependency order are unambiguous',()=>{
  const ids=new Set();for(const [index,step] of bootstrap.steps.entries()){
    assert.ok(!ids.has(step.id));ids.add(step.id);assert.ok(step.depends_on.every(id=>ids.has(id)&&id!==step.id));
    assert.equal(step.source_row,index+1);assert.equal(step.actor,'active_runtime');}
  const edges=new Set();for(const edge of bootstrap.transitions){assert.ok(bootstrap.states.includes(edge.from)&&bootstrap.states.includes(edge.to));
    const key=JSON.stringify([edge.from,edge.to]);assert.ok(!edges.has(key));edges.add(key);assert.ok(edge.requires.length);}
});
test('REL-PKG-020: partial effects and concrete waiting conditions are required on recovery branches',()=>{
  for(const step of bootstrap.steps){assert.ok(step.resume.includes('actual effects'));assert.ok(step.wait.includes('observable resume'));
    assert.ok(step.failure.includes('partial effects'));assert.deepEqual(Object.keys(step.branches),['existing','absent','unavailable','unknown']);}
});
test('REL-PKG-021: changing an adapter invalidates only dependent proofs',()=>{
  const items=[{id:'credential',validity_dependencies:['secure_reference']},{id:'access',validity_dependencies:['adapter','credential']},{id:'readiness',validity_dependencies:['access']}];
  assert.deepEqual(invalidated(items,['adapter']),['access','readiness']);
});
test('REL-PKG-022: runtime/project adoption evidence is not reusable across ownership boundaries',()=>{
  const proof={status:'verified',workspace:'A',runtime:'R',validity_dependencies:['adapter'],observed:{adapter:'v1'}};
  assert.equal(reusable(proof,{workspace:'B',runtime:'R',observed:{adapter:'v1'}}),false);
  assert.equal(reusable(proof,{workspace:'A',runtime:'S',observed:{adapter:'v1'}}),false);
});
test('REL-PKG-023: producer module is excluded from ordinary/full-install/recovery/consumer-update routes',()=>{
  for(const facet of ['information','full_install','context_loss','due_update'])assert.ok(!select(facts([facet])).modules.includes('producer'));
  assert.ok(select(facts(['oop_maintenance'])).modules.includes('producer'));
});
test('REL-PKG-024: semantic adoption changes have explicit source deltas and scoped migration policy',()=>{
  assert.equal(trace.classification.split(';')[0],'reviewed_semantic_change');
  assert.ok(trace.semantic_delta.length>0);assert.equal(trace.migration.descriptor_ref,'dist/migrations/index.json');
  const index=readJSON('migrations/index.json');assert.equal(index.scopes.runtime.disposition,'required');
  assert.equal(readJSON('migrations/operations.json').organizational_state_change,true);
  assert.ok(trace.migration.recovery);
});
test('REL-PKG-025: no consumer procedure schedules maintainer execution or OOP audit operations',()=>{
  const actions=bootstrap.steps.map(x=>x.action);assert.ok(actions.every(x=>!/(test_release|verify_oop|audit|checksum|signature)/.test(x)));
  assert.ok(entry.consumer_exclusion.includes('Never run maintainer commands'));
  assert.equal(evaluateGuard(bootStep('BOOT-04').guard,{version_metadata_recorded:true,release_checks_not_performed:true}),'true');
  assert.equal(evaluateGuard(bootStep('BOOT-04').guard,{version_metadata_recorded:true,release_checks_not_performed:false}),'false');
});

const languageScope={project:'fixture-project',user:'fixture-user',host:'fixture-host',runtime:'fixture-runtime',session:'fixture-session'};
const languageNow=Date.parse('2026-10-17T12:00:00Z');
const languageKinds=['shared_project_response_language','user_account_presentation_locale','application_response_language','runtime_response_language','persistent_user_language_preference','current_user_language_instruction'];
const languageOrder={established:true,source:'fixture runtime precedence',evidence:'fixture order',order:languageKinds.slice(0,-1)};
const setting=(kind,status='absent',patch={})=>({kind,status,attempted:true,authorized:true,current:true,applicable:true,
  scope:languageScope,source:'fixture facility',authority:'fixture authority',evidence:'fixture observation',
  checked_at:'2026-10-17T11:59:00Z',expires_at:'2026-10-17T12:01:00Z',reason:'Fixture absence',...patch});
const observedSetting=(kind,language,patch={})=>setting(kind,'observed',{language,trusted:true,reason:undefined,...patch});
const language=(values=[],patch={})=>presentationLanguage({capabilities:{format:3,precedence:languageOrder,
  observations:languageKinds.map(k=>values.find(x=>x.kind===k)??setting(k))},scope:languageScope,now:languageNow,...patch});

test('REL-PKG-026: effective response settings and exact policy are bound to current language contract 3',()=>{
  assert.equal(language([observedSetting('application_response_language','it')]).language,'it');
  assert.equal(language([observedSetting('user_account_presentation_locale','fr'),observedSetting('current_user_language_instruction','de',{origin:'user',voluntary:true})]).language,'de');
  for(const origin of ['pasted_command','generated_prompt','quote','tool'])
    assert.equal(language([observedSetting('user_account_presentation_locale','fr'),observedSetting('current_user_language_instruction','de',{origin,voluntary:true})]).language,'fr');
  const core=readJSON('modules/core.json').contracts.find(c=>c.id==='OOP-canonical-language').semantic_clause;
  for(const term of ['established precedence','persisted overrides','Every new AI-authored operational prompt',
    'request an explicit response language','unless the user explicitly requests another language'])assert.ok(core.includes(term),term);
  const first=readJSON('modules/core.json').contracts.find(c=>c.id==='OOP-mandate-authority').semantic_clause;
  assert.ok(first.indexOf('### First mandatory rule — language')<first.indexOf('## 1. Mandate'));
  assert.match(first,/Private reasoning cannot be independently verified/);
  assert.match(entry.bootstrap_preflight.steps[0].instruction,/language capability evidence contract version 3/);
});

test('REL-PKG-027: worker defaults preserve eligible references and never imply repository or provider authority',()=>{
  assert.equal(coworkerIdentityPlan({owner_name:'Explicit Owner',owner_email:'owner@example.invalid',newWorkerRequired:true}).identity,'Explicit Owner');
  assert.equal(coworkerIdentityPlan({owner_name:'Explicit Owner',owner_email:'owner@example.invalid',}).create,false);
  assert.equal(coworkerIdentityPlan({owner_name:'Explicit Owner',owner_email:'owner@example.invalid',newWorkerRequired:true,selectedIdentity:'approved-worker',authorizedIdentity:true}).status,'blocked');
  assert.equal(coworkerIdentityPlan({owner_name:'Explicit Owner',owner_email:'owner@example.invalid',newWorkerRequired:true,selectedIdentity:'human'}).status,'blocked');
  const existing={eligible:true,identity:'existing-worker',reference:'operations-signing_ed25519'};
  const plan=coworkerIdentityPlan({owner_name:'Explicit Owner',owner_email:'owner@example.invalid',existing,newWorkerRequired:true});
  assert.equal(plan.reference,existing.reference);assert.equal(plan.rotate,false);assert.equal(plan.create,false);
  assert.equal(plan.authority_granted,false);
  const facts={project:'A',expected_project:'A',repository:'operations',expected_repository:'operations',
    purpose:'write',expected_purpose:'write',runtime:'R',expected_runtime:'R',authority_verified:true,
    effective_actor_verified:true,attribution_verified:true,authorized_email_verified_or_inapplicable:true,
    adapter_access_verified:true,signing_verified_or_inapplicable:true,signature_acceptance_verified_or_inapplicable:true};
  assert.equal(workerRepositoryAdmission(facts),'true');
  for(const key of Object.keys(facts).filter(k=>k.endsWith('verified')||k.endsWith('inapplicable'))){
    assert.equal(workerRepositoryAdmission({...facts,[key]:false}),'false');
    assert.equal(workerRepositoryAdmission({...facts,[key]:undefined}),'unknown');
  }
  for(const key of ['project','repository','purpose','runtime'])assert.equal(workerRepositoryAdmission({...facts,[key]:'other'}),'false');
  assert.equal(workerRepositoryAdmission({user_name:'Explicit Owner',provider_principal:'Explicit Owner'}),'unknown');
  const security=readJSON('modules/security.json').contracts[0].semantic_clause;
  for(const term of ['owner_name','owner_email','machine collaborator',
    'independently authorized delegation','do not rename, rotate, delete or move secrets'])assert.ok(security.includes(term),term);
});

test('REL-PKG-028: current installed proof and reconciled resume are necessary for bootstrap completion',()=>{
  for(const id of ['BOOT-12','BOOT-13']){
    const step=bootStep(id),positive=Object.fromEntries(step.guard.all.map(({fact})=>[fact,true]));
    assert.equal(evaluateGuard(step.guard,positive),'true');
    for(const {fact} of step.guard.all){
      assert.equal(evaluateGuard(step.guard,{...positive,[fact]:false}),'false');
      assert.equal(evaluateGuard(step.guard,{...positive,[fact]:undefined}),'unknown');
      assert.equal(evaluateGuard(step.guard,{...positive,[fact]:'true'}),'unknown');
    }
    assert.equal(evaluateGuard(step.guard,{hooks_created:true,credential_generated:true,user_confirmation:true,command_exit_zero:true}),'unknown');
  }
  assert.ok(bootStep('BOOT-13').guard.all.some(x=>x.fact==='installation_prerequisites_verified'));
  assert.ok(bootStep('BOOT-12').guard.all.some(x=>x.fact==='installed_enforcement'));
  for(const state of ['waiting_human','waiting_external']){
    const edge=bootstrap.transitions.find(x=>x.from===state&&x.to==='pending');
    const guard={all:edge.requires.map(fact=>({fact}))},positive=Object.fromEntries(edge.requires.map(fact=>[fact,true]));
    assert.equal(evaluateGuard(guard,positive),'true');
    for(const fact of edge.requires)assert.equal(evaluateGuard(guard,{...positive,[fact]:undefined}),'unknown');
    assert.equal(evaluateGuard(guard,{user_confirmation:true,automatic_wakeup_claimed:true}),'unknown');
  }
  for(const step of bootstrap.steps){assert.equal(step.restart_ref,'#restart');assert.equal(step.continuation_ref,'#continuation');}
  assert.match(bootstrap.restart,/verified actual restart dependency/);
  assert.match(bootstrap.restart,/checkpoint/);assert.match(bootstrap.restart,/observable reentry/);
  const system=readJSON('modules/bootstrap.json').contracts.find(c=>c.id==='OOP-bootstrap-system').semantic_clause;
  assert.match(system,/continue all unfinished safe independently executable authorized phases/);assert.match(system,/do not invent commands/i);
});

// These fixtures are synthetic supplied observations; they authenticate no host or provider.
const commitFacts=(phase='pre_commit')=>({phase,project:'A',expected_project:'A',repository:'operations',expected_repository:'operations',
  purpose:'write',expected_purpose:'write',runtime:'R',expected_runtime:'R',operation:'op-1',expected_operation:'op-1',
  adapter:'git-1',expected_adapter:'git-1',authority_verified:true,effective_actor_verified:true,attribution_verified:true,
  authorized_email_verified_or_inapplicable:true,adapter_access_verified:true,signing_verified_or_inapplicable:true,
  signature_acceptance_verified_or_inapplicable:true,provider_worker_mapping_verified:true,authentication_verified:true,
  write_permission_verified:true,shared_reference_verified:true,provider_principal:'provider-worker-id',expected_provider_principal:'provider-worker-id',
  ref:'refs/heads/main',expected_ref:'refs/heads/main',credential_project:'A',shared_reference:'secure:project-A/common/repository-auth',owner_name:'Explicit Owner',owner_email:'owner@example.invalid',machine_owner_verified:true,local_mode_verified:true,bridge_maintenance_mode:'normal',content_author:'ai',author_emails:['owner@example.invalid'],
  committer_emails:['owner@example.invalid'],expected_commit:'a'.repeat(40),
  effective:metadata(),actual:{...metadata(),object_readback_verified:true,required_signature_verified_or_inapplicable:true,commit_id:'a'.repeat(40)}});
function metadata(){return {project:'A',repository:'operations',runtime:'R',operation:'op-1',adapter:'git-1',
  current:true,inspected:true,authorized_emails_verified:true,inherited_overrides_inspected:true,adapter_path_inspected:true,
  author:{name:'Explicit Owner',email:'owner@example.invalid'},committer:{name:'Explicit Owner',email:'owner@example.invalid'}};}
test('REL-PKG-029: project and common preference inspection guard current entry language resolution',()=>{
  const positives=Object.fromEntries(entry.bootstrap_preflight.steps[0].guard.all.map(x=>[x.fact,true]));
  const result=language([observedSetting('user_account_presentation_locale','it')]);
  assert.equal(evaluateGuard(entry.bootstrap_preflight.steps[0].guard,{...positives,...result}),'true');
  for(const fact of ['current_project_identity','current_project_authority','shared_language_preference_inspected'])
    assert.equal(evaluateGuard(entry.bootstrap_preflight.steps[0].guard,{...positives,...result,[fact]:false}),'false');
  const pending=language([setting('shared_project_response_language','uninspected')]);
  assert.equal(evaluateGuard(entry.bootstrap_preflight.steps[0].guard,{...positives,...pending}),'false');
});

test('REL-PKG-030: inaccessible absent conflicting and uninspected settings retain distinct unresolved facts',()=>{
  for(const status of ['absent','inaccessible','conflicting','uninspected']){
    const result=language([setting('user_account_presentation_locale',status)]);
    assert.equal(result.language,null);assert.equal(result.presentation_language_resolved,false);
    assert.equal(result.request_explicit_language,status!=='uninspected');
  }
  assert.equal(presentationLanguage({capabilities:{format:2,observations:[]}}).basis,'adapter_update_required');
});

test('REL-PKG-031: technical text foreign scope and stale observations cannot fabricate response preference',()=>{
  for(const kind of ['triggering_user_language','conversation_language_preference','runtime_locale','operating_system_locale'])
    assert.equal(language([observedSetting(kind,'fr')]).status,'pending');
  for(const patch of [{current:false},{scope:{...languageScope,session:'old-session'}},{evidence:''},{authorized:false}])
    assert.equal(language([observedSetting('user_account_presentation_locale','it',patch)]).status,'pending');
  assert.equal(language([observedSetting('user_account_presentation_locale','fr')]).language,'fr');
});

test('REL-PKG-032: every Git effect routes attribution context and bootstrap cannot waive unknown commit disposition',()=>{
  for(const facet of ['git_commit','git_publish'])assert.ok(includes(select(facts([],{action:[facet]})),'repository','security','execution'));
  const guard=bootStep('BOOT-11').guard,positive=Object.fromEntries(guard.all.map(x=>[x.fact,true]));
  assert.ok(guard.all.some(x=>x.fact==='commit_attribution_disposition_verified'));
  assert.equal(evaluateGuard(guard,{...positive,commit_attribution_disposition_verified:undefined}),'unknown');
  assert.equal(evaluateGuard(guard,{...positive,commit_attribution_disposition_verified:false}),'false');
});
test('REL-PKG-033: AI commit metadata is checked despite reused human authentication and valid signing',()=>{
  for(const phase of ['pre_commit','before_publish']){
    const f=commitFacts(phase),key=phase==='pre_commit'?'effective':'actual';
    if(phase==='pre_commit')f.provider_principal='authorized-human';
    assert.equal(commitAttributionGate(f),'true');
    for(const role of ['author','committer']){
      assert.equal(commitAttributionGate({...f,[key]:{...f[key],[role]:{...f[key][role],name:'human'}}}),'false');
      assert.equal(commitAttributionGate({...f,[key]:{...f[key],[role]:{...f[key][role],email:'foreign@example.invalid'}}}),'false');
    }
    assert.equal(commitAttributionGate({...f,authority_verified:undefined}),'unknown');
    assert.equal(commitAttributionGate({...f,project:'B'}),'false');
  }
});
test('REL-PKG-034: incomplete API or inherited provenance and wrong resulting object block dependent effects',()=>{
  const f=commitFacts();
  for(const field of ['current','inspected','authorized_emails_verified','inherited_overrides_inspected','adapter_path_inspected']){
    assert.equal(commitAttributionGate({...f,effective:{...f.effective,[field]:undefined}}),'unknown');
    assert.equal(commitAttributionGate({...f,effective:{...f.effective,[field]:false}}),'false');
  }
  for(const field of ['project','repository','runtime','operation','adapter'])
    assert.equal(commitAttributionGate({...f,effective:{...f.effective,[field]:'foreign'}}),'false');
  const post=commitFacts('before_publish');
  assert.equal(commitAttributionGate({...post,actual:{...post.actual,commit_id:'b'.repeat(40)}}),'false');
  assert.equal(commitAttributionGate({...post,actual:{...post.actual,object_readback_verified:undefined}}),'unknown');
  assert.equal(commitAttributionGate({...post,actual:{...post.actual,required_signature_verified_or_inapplicable:false}}),'false');
  assert.equal(commitAttributionGate({user_name:'Explicit Owner',signing_valid:true}),'unknown');
});
test('REL-PKG-035: genuine human authors retain provenance while alternative AI names and emails are rejected',()=>{
  const f=commitFacts(),effective={...f.effective,author:{name:'human',email:'human@example.invalid'}};
  assert.equal(commitAttributionGate({...f,content_author:'human',human_author:'human',human_authorship_verified:true,author_emails:['human@example.invalid'],effective}),'true');
  assert.equal(commitAttributionGate({...f,content_author:'human',human_author:'human',effective}),'unknown');
  const alternative={...f.effective,author:{...f.effective.author,name:'approved-ai'},committer:{...f.effective.committer,name:'approved-ai'}};
  assert.equal(commitAttributionGate({...f,worker_name:'approved-ai',alternative_worker_authorized:true,effective:alternative}),'false');
  assert.equal(commitAttributionGate({...f,worker_name:'approved-ai',effective:alternative}),'false');
  for(const role of ['author','committer']) {
    const wrong={...f.effective,[role]:{...f.effective[role],email:'worker@example.invalid'}};
    assert.equal(commitAttributionGate({...f,author_emails:['worker@example.invalid','owner@example.invalid'],committer_emails:['worker@example.invalid','owner@example.invalid'],effective:wrong}),'false');
  }
  const post=commitFacts('before_publish');
  for(const field of ['provider_worker_mapping_verified','authentication_verified','write_permission_verified','shared_reference_verified']) {
    assert.equal(commitAttributionGate({...post,[field]:undefined}),'unknown');
    assert.equal(commitAttributionGate({...post,[field]:false}),'false');
  }
  assert.equal(commitAttributionGate({...post,provider_principal:'unrelated-account'}),'false');
  assert.equal(commitAttributionGate({...post,ref:'refs/heads/other'}),'false');
  assert.equal(commitAttributionGate({...post,credential_project:'B',external_project_purpose_delegation_verified:false}),'false');
  assert.equal(commitAttributionGate({...post,credential_project:'B'}),'unknown');
  assert.equal(commitAttributionGate({...post,credential_project:'B',external_project_purpose_delegation_verified:true}),'true');
  assert.equal(commitAttributionGate({...post,shared_reference:undefined}),'unknown');
  const existing={eligible:true,identity:'human-auth',reference:'existing-key'};
  assert.deepEqual(coworkerIdentityPlan({owner_name:'Explicit Owner',owner_email:'owner@example.invalid',existing}),{identity:'Explicit Owner',email:'owner@example.invalid',credential_identity:'human-auth',reference:'existing-key',create:false,rotate:false,authority_granted:false});
});
test('REL-PKG-036: real disposable Git environment override defeats user.name and actual-object admission refuses publication',t=>{
  const dir=mkdtempSync(join(tmpdir(),'oop-attribution-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  // No network, credentials, signatures or project history are used by this isolated fixture.
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',
    GIT_AUTHOR_NAME:'Explicit Owner',GIT_AUTHOR_EMAIL:'owner@example.invalid',GIT_COMMITTER_NAME:'human',GIT_COMMITTER_EMAIL:'owner@example.invalid'};
  for(const key of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_CONFIG_COUNT','GIT_CONFIG_PARAMETERS','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES'])delete env[key];
  const git=(args,input)=>{const r=spawnSync('git',args,{cwd:dir,env,encoding:'utf8',input});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  git(['init','--quiet']);git(['config','user.name','Explicit Owner']);git(['config','user.email','owner@example.invalid']);
  const tree=git(['mktree'],'');const id=git(['-c','commit.gpgsign=false','commit-tree',tree], 'Synthetic attribution fixture\n');
  const read=()=>git(['show','-s','--format=%an%n%ae%n%cn%n%ce',id]).split(/\r?\n/);
  const [an,ae,cn,ce]=read();assert.equal(an,'Explicit Owner');assert.equal(cn,'human');
  const post=commitFacts('before_publish');post.expected_commit=id;
  post.actual={...post.actual,commit_id:id,author:{name:an,email:ae},committer:{name:cn,email:ce}};
  assert.equal(commitAttributionGate(post),'false');assert.deepEqual(read(),[an,ae,cn,ce]);
});
