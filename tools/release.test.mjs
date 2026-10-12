import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { entry,routing,readJSON,select,contextSession } from './release-engine.mjs';
import { closure,evaluateGuard,operationsAccess,invalidated,reusable } from './reference-engine.mjs';
import { validateProfile } from './schema-profile.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=protocolSource(read('PROTOCOL.md')), sourceLines=source.split('\n');
const trace=JSON.parse(read('tools/evidence/release-traceability.json'));
const review=JSON.parse(read('tools/release-review.json'));
const schema=JSON.parse(read('tools/schemas/contract.schema.json'));
const bootstrap=readJSON('procedures/bootstrap.json');
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
  assert.equal(protocolSource(legacy,{historical:true}), title + 'normative');
  assert.equal(protocolSource(title + 'normative',{historical:true}), title + 'normative');
  assert.throws(() => protocolSource(legacy + legacy,{historical:true}), /duplicate/);
  assert.throws(() => protocolSource(legacy.replace('<!-- OOP:MAINTAINER-APPENDIX -->\n\n',''),{historical:true}), /missing/);

  let next=1;const texts=[];
  for(const item of trace.clauses){assert.equal(item.start,next);next=item.end+1;
    const clause=readJSON(`modules/${item.module}.json`).contracts.find(x=>x.id===item.contract);
    const [,start,end] = /^lines:(\d+)-(\d+)$/.exec(clause.source.locator);
    const locatedLines = read('PROTOCOL.md').replace(/\r\n/g,'\n').split('\n').slice(Number(start)-1,Number(end));
    const runtimeHeading = locatedLines.indexOf('# Rules for the runtime');
    const located = runtimeHeading === -1 ? locatedLines : [...locatedLines.slice(0,2),...locatedLines.slice(runtimeHeading+2)];
    assert.equal(located.join('\n'),clause.semantic_clause);
    assert.equal(clause.semantic_clause,sourceLines.slice(item.start-1,item.end).join('\n'));
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
  for(let n=1;n<=13;n++)assert.ok(contract.semantic_clause.includes(`**BOOT-${String(n).padStart(2,'0')}**`));
  assert.equal(bootstrap.steps.length,13);assert.equal(bootstrap.steps[9].effect_owner,'organization');
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
test('REL-PKG-024: compatibility descriptor is explicit and generated-only changes do not claim organization transformation',()=>{
  assert.ok(['generated_derived_only','reviewed_organizational_alignment'].includes(trace.classification.split(';')[0]));assert.equal(trace.migration.organizational_state_change,false);
  assert.ok(trace.migration.actions.every(x=>x.scope==='runtime'));assert.ok(trace.migration.recovery);
});
test('REL-PKG-025: no consumer procedure schedules maintainer execution or OOP audit operations',()=>{
  const actions=bootstrap.steps.map(x=>x.action);assert.ok(actions.every(x=>!/(test_release|verify_oop|audit|checksum|signature)/.test(x)));
  assert.ok(entry.consumer_exclusion.includes('Never run maintainer commands'));
  assert.equal(evaluateGuard(bootstrap.steps[3].guard,{version_metadata_recorded:true,release_checks_not_performed:true}),'true');
  assert.equal(evaluateGuard(bootstrap.steps[3].guard,{version_metadata_recorded:true,release_checks_not_performed:false}),'false');
});
