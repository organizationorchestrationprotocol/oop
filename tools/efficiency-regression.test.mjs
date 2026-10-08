import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { digest, scenarioDefinitions, measurementMethod, effectiveScope, verifyPackageBaseline, compareEfficiency } from './efficiency-regression.mjs';
import { completeProducerObservations, expectedObservations, subjects, identify, protocolSource } from './acceptance-inputs.mjs';
import { select,migrationContextBytes } from './release-engine.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = () => {
  const measurements = scenarioDefinitions.map(([id, facet, warm, loss]) => ({id,facet,warm,loss,
    selected_governing_bytes:115222,baseline_governing_bytes:337948,method_identity:'method',scope_identity:`scope:${id}`}));
  return { baseline:{status:'verified',record_commit:'historical-fixture',content_identity:'fixture-evidence',measurements:structuredClone(measurements)},
    measurements,subjectIdentity:'current-fixture' };
};
const g0 = f => f.measurements.find(m => m.id === 'ordinary_g0');
const outcome = r => r.results.find(m => m.scenario === 'ordinary_g0');
// In-memory current-package evidence model. No old Git objects or publication claim.
function historical() {
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  const identities=identify(root,subjects(root)),source=protocolSource(read('PROTOCOL.md'));
  const overhead=Buffer.byteLength(read('dist/entry.json'))+Buffer.byteLength(read('dist/routing.json'));
  const measurements=scenarioDefinitions.map(([id,facet,warm,loss])=>{
    const modules=select({classification:'known',request:[facet]}).modules;
    const migrationBytes=['due_update','full_install','interrupted_setup'].includes(facet)?migrationContextBytes:0;
    const procedure_bytes=migrationBytes+(['full_install','interrupted_setup'].includes(facet)
      ?Buffer.byteLength(read('dist/procedures/bootstrap.json'))+Buffer.byteLength(read('dist/procedures/lifecycle.json'))
      :['due_update','context_loss'].includes(facet)?Buffer.byteLength(read('dist/procedures/lifecycle.json')):0);
    return {id,facet,warm,loss,modules,entry_selector_bytes:overhead,procedure_bytes,baseline_governing_bytes:Buffer.byteLength(source),
      migration_context_encoding:'lossless_migration_context:1',selected_governing_bytes:overhead+procedure_bytes+modules.reduce((sum,m)=>sum+Buffer.byteLength(read('dist/modules/'+m+'.json')),0)};
  });
  const checks=Object.fromEntries(['reviewed_source_allocation','source_content_binding','local_package_and_reference_tests','maintainer_regressions','measured_context_bytes','frozen_subject','frozen_checkout'].map(key=>[key,'passed']));
  const report={report_kind:'content_checkpoint',checkpoint_policy:'initial_content_candidate',candidate_validated:true,source_identity:digest(source),
    source_binding:{kind:'source_content',source_identity:digest(source)},identities,subject_content_identity:digest(JSON.stringify(identities)),checks,
    observations:expectedObservations.map(id=>({id,actual:'passed'})),observation_summary:{total:expectedObservations.length,unique:expectedObservations.length,passed:expectedObservations.length,failed:0,skipped:0,missing:[],unexpected:[]},maintainer_regression_summary:{tests:116,passed:true},measurements};
  const path='tools/evidence/release-acceptance.json',raw=JSON.stringify(report);
  const tap=expectedObservations.map((id,i)=>'ok '+(i+1)+' - '+id+': current package fixture').join('\n')+'\n# tests '+expectedObservations.length+'\n# fail 0\n# skipped 0\n';
  const maintainerTap=Array.from({length:116},(_,i)=>'ok '+(i+1)+' - maintainer fixture '+i).join('\n')+'\n# tests 116\n# fail 0\n# skipped 0\n';
  return {recordCommit:'fixture-root',path,report,identity:digest(raw),readContent:p=>p===path?raw:p===path.replace('acceptance.json','tests.tap')?tap:p===path.replace('acceptance.json','maintainer-tests.tap')?maintainerTap:read(p)};
}
test('REL-TOOL-015: comparable byte increase below full source rejects readiness (NEG-01)', () => {
  const f = fixture(); g0(f).selected_governing_bytes = 200000;
  assert.ok(f.measurements.every(m => m.selected_governing_bytes <= m.baseline_governing_bytes));
  const result = compareEfficiency(f);
  assert.equal(result.status,'failed'); assert.equal(result.readiness_allowed,false);
  const release_ready = result.readiness_allowed && f.measurements.every(m => m.selected_governing_bytes <= m.baseline_governing_bytes);
  assert.equal(release_ready,false);
  assert.equal(outcome(result).delta_bytes,84778);
  assert.equal(outcome(result).ratio,200000 / 115222);
});
test('REL-TOOL-016: equal or lower comparable measurements pass all seven scenarios (POS-01)', () => {
  const f = fixture(); g0(f).selected_governing_bytes--;
  const r = compareEfficiency(f);
  assert.equal(r.status,'passed'); assert.equal(r.readiness_allowed,true); assert.equal(r.comparable,7);
  assert.ok(r.results.every(m => m.status === 'passed'));
  f.baseline.measurements.find(m => m.id === 'ordinary_g0').selected_governing_bytes = 0;
  assert.equal(outcome(compareEfficiency(f)).ratio,null);
  assert.equal(compareEfficiency(f).readiness_allowed,false);
});
test('REL-TOOL-017: absent unverified mismatched historical evidence never invents PASS (NEG-02)', () => {
  for (const mutate of [f => {f.baseline.status='not_verified';f.baseline.reason='stale identity';},
    f => f.baseline.measurements.pop(), f => {f.baseline.measurements[2].method_identity='changed';},
    f => {f.baseline.measurements[2].selected_governing_bytes=null;}]) {
    const f = fixture(); mutate(f); const r = compareEfficiency(f);
    assert.equal(r.status,'not_verified'); assert.ok(r.results.some(m => m.status === 'not_comparable' && m.previous_release_comparison === 'NOT VERIFIED'));
    assert.equal(r.readiness_allowed,false,'Unknown comparison blocks a future revision without inventing regression');
  }
  for (const mutate of [f => f.measurements.pop(), f => f.measurements.push(f.measurements[0]),
    f => {g0(f).selected_governing_bytes=-1;}]) {
    const f = fixture(); mutate(f); assert.equal(compareEfficiency(f).readiness_allowed,false);
  }
});
const disposition = f => ({scenario:'ordinary_g0',baseline_identity:f.baseline.content_identity,subject_identity:f.subjectIdentity,
  method_identity:g0(f).method_identity,scope_identity:g0(f).scope_identity,previous_bytes:115222,current_bytes:200000,
  decision:'authorized_justified_increase',reason:'Synthetic reviewed necessary change',author:'producer',reviewer:'independent-reviewer',
  authorized_by:'human-owner',review_evidence:'immutable-review-fixture',authorization_evidence:'immutable-approval-fixture'});
test('REL-TOOL-018: text flags untrusted records and wrong-scope approvals cannot override (NEG-03)', () => {
  const f = fixture(); g0(f).selected_governing_bytes=200000;
  for (const d of ['approved',{authorized:true},disposition(f),{...disposition(f),scenario:'due_update'},
    {...disposition(f),subject_identity:'stale'}, {...disposition(f),reviewer:'producer'}]) {
    f.dispositions=[d]; f.trustedDispositionIdentities=typeof d === 'object' && d.scenario !== 'ordinary_g0' ? [digest(JSON.stringify(d))] : [];
    assert.equal(compareEfficiency(f).readiness_allowed,false);
  }
  for (const field of ['scenario','subject_identity','baseline_identity','method_identity','scope_identity','reviewer','authorization_evidence','previous_bytes']) {
    const d = {...disposition(f),[field]:field==='reviewer'?'producer':field==='previous_bytes'?0:''};
    f.dispositions=[d];f.trustedDispositionIdentities=[digest(JSON.stringify(d))];
    assert.equal(compareEfficiency(f).readiness_allowed,false,field);
  }
});
test('REL-TOOL-019: separately trusted attributable authorized increase has bound disposition (POS-03)', () => {
  const f = fixture(); g0(f).selected_governing_bytes=200000;
  const d = disposition(f); f.dispositions=[d]; f.trustedDispositionIdentities=[digest(JSON.stringify(d))];
  const r = compareEfficiency(f);
  assert.equal(r.readiness_allowed,true); assert.equal(outcome(r).status,'justified_regression');
  assert.equal(outcome(r).disposition_identity,digest(JSON.stringify(d)));
  f.subjectIdentity='changed-current-subject'; assert.equal(compareEfficiency(f).readiness_allowed,false);
});
test('REL-TOOL-020: changed semantic workload is incomparable without fake regression or improvement (POS-02)', () => {
  const f = fixture(); g0(f).scope_identity='expanded'; g0(f).selected_governing_bytes=200000;
  const r = compareEfficiency(f);
  assert.equal(r.status,'not_verified'); assert.equal(r.readiness_allowed,false);
  assert.equal(outcome(r).status,'not_comparable'); assert.equal(outcome(r).delta_bytes,undefined);
  const m = {...g0(f),modules:['one']};
  const one = {contracts:[{id:'clause',semantic_clause:'must preserve'}]};
  const before = effectiveScope(m,() => one);
  assert.notEqual(before,effectiveScope(m,() => ({contracts:[{id:'clause',semantic_clause:'changed'}]})));
  assert.throws(() => effectiveScope({...m,modules:['one','duplicate']},() => one),/Duplicate/);
  const source='first obligation\n\nsecond obligation';
  const whole={contracts:[{id:'whole',semantic_clause:source}]};
  const split={contracts:[{id:'first',semantic_clause:'first obligation'},{id:'second',semantic_clause:'second obligation'}]};
  assert.equal(effectiveScope(m,() => whole,source),effectiveScope(m,() => split,source),'Reviewed splits preserve actual semantic coverage');
  assert.notEqual(effectiveScope(m,() => whole,source),effectiveScope(m,() => ({contracts:split.contracts.slice(0,1)}),source));
  const recovery={...m,facet:'context_loss'};
  assert.notEqual(effectiveScope(recovery,() => whole,source,() => ({guard:'before'})),
    effectiveScope(recovery,() => whole,source,() => ({guard:'after'})));
});
test('REL-TOOL-021: current package checkpoint model validates and tampered identities or incomplete evidence fail (NEG-04)', () => {
  const checkpoint = historical();
  const readContent=checkpoint.readContent;
  const historicalOptions={readContent,trustedIdentity:checkpoint.identity,selectionEvidence:'Independent synthetic latest-comparable selection fixture'};
  const valid = verifyPackageBaseline(checkpoint,historicalOptions);
  assert.equal(valid.status,'verified',valid.reason); assert.equal(valid.measurements.length,7);
  const check = report => {
    const raw=JSON.stringify(report), altered={...checkpoint,report,identity:digest(raw)};
    const r=verifyPackageBaseline(altered,{...historicalOptions,trustedIdentity:digest(raw),readContent:path =>
      path===checkpoint.path ? raw : readContent(path)});
    return r;
  };
  const reject = report => assert.equal(check(report).status,'not_verified');
  for (const mutate of [r => {r.source_identity='tampered';}, r => {r.subject_content_identity='tampered';},
    r => {delete r.identities['tools/genesis.mjs'];r.subject_content_identity=digest(JSON.stringify(r.identities));}, r => {r.observations[1]=r.observations[0];},
    r => r.observations.pop(), r => {r.measurements[2].selected_governing_bytes++;}]) {
    const report=structuredClone(checkpoint.report); mutate(report); reject(report);
  }
  assert.equal(verifyPackageBaseline({...checkpoint,identity:'tampered'},historicalOptions).status,'not_verified');
  assert.equal(verifyPackageBaseline(checkpoint,{...historicalOptions,readContent:() => {throw new Error('Missing content');}}).status,'not_verified');
  assert.equal(verifyPackageBaseline(checkpoint,{...historicalOptions,trustedIdentity:undefined}).status,'not_verified','A mutable self-asserted checkpoint cannot supply its own trust anchor');
  const failed=structuredClone(checkpoint.report);failed.checks.local_package_and_reference_tests='failed';reject(failed);
  const missing=structuredClone(checkpoint.report);missing.observation_summary.skipped=1;reject(missing);
});
test('REL-TOOL-022: actual method identity and exact producer observation inventory remain binding (REG-01)', () => {
  const script = readFileSync(new URL('./accept-release.mjs',import.meta.url),'utf8');
  assert.notEqual(measurementMethod(script),measurementMethod(script.replace('const overhead=','const overhead=1+')));
  assert.throws(() => measurementMethod('no harness'),/Unrecognized/);
  const observations = expectedObservations.map(id => ({id,actual:'passed'}));
  const run = {status:0,stdout:`# tests ${expectedObservations.length}\n# fail 0\n# skipped 0\n`};
  assert.equal(completeProducerObservations(run,observations),true);
  assert.equal(completeProducerObservations(run,observations.slice(1)),false);
  assert.equal(completeProducerObservations(run,[observations[0],...observations.slice(0,-1)]),false);
});
