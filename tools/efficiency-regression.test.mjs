import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { digest, scenarioDefinitions, measurementMethod, effectiveScope, verifyPackageBaseline, compareEfficiency } from './efficiency-regression.mjs';
import { completeProducerObservations, expectedObservations } from './acceptance-inputs.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = () => {
  const measurements = scenarioDefinitions.map(([id, facet, warm, loss]) => ({id,facet,warm,loss,
    selected_governing_bytes:115222,baseline_governing_bytes:337948,method_identity:'method',scope_identity:`scope:${id}`}));
  return { baseline:{status:'verified',record_commit:'historical-fixture',content_identity:'fixture-evidence',measurements:structuredClone(measurements)},
    measurements,subjectIdentity:'current-fixture' };
};
const g0 = f => f.measurements.find(m => m.id === 'ordinary_g0');
const outcome = r => r.results.find(m => m.scenario === 'ordinary_g0');
const cache = new Map();
const readObject = (commit, path) => {
  const key = `${commit}:${path}`;
  if (!cache.has(key)) {
    const run = spawnSync('git', ['show',key], {cwd:root,encoding:'utf8',maxBuffer:4e6});
    if (run.status !== 0) throw new Error(`Missing object ${key}`);
    cache.set(key,run.stdout);
  }
  return cache.get(key);
};
function historical() {
  const recordCommit = spawnSync('git',['log','-1','--format=%H','--','tools/evidence/release-acceptance.json'],{cwd:root,encoding:'utf8'}).stdout.trim();
  const path = 'tools/evidence/release-acceptance.json', raw = readObject(recordCommit,path);
  return {recordCommit,path,report:JSON.parse(raw),identity:digest(raw)};
}
const historicalOptions = {readObject,isAncestor:(commit,target='HEAD') => typeof commit === 'string' &&
  /^[a-f0-9]{40}$/.test(commit) && spawnSync('git',['merge-base','--is-ancestor',commit,target],{cwd:root}).status === 0};

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
    assert.equal(r.readiness_allowed,true,'Unknown history alone does not prove regression (REL-01)');
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
  assert.equal(r.status,'not_verified'); assert.equal(r.readiness_allowed,true);
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
test('REL-TOOL-021: actual immutable checkpoint validates and tampered identities or incomplete evidence fail (NEG-04)', () => {
  const checkpoint = historical();
  const valid = verifyPackageBaseline(checkpoint,historicalOptions);
  assert.equal(valid.status,'verified',valid.reason); assert.equal(valid.measurements.length,7);
  const check = report => {
    const raw=JSON.stringify(report), altered={...checkpoint,report,identity:digest(raw)};
    const r=verifyPackageBaseline(altered,{...historicalOptions,readObject:(commit,path) =>
      commit===checkpoint.recordCommit && path===checkpoint.path ? raw : readObject(commit,path)});
    return r;
  };
  const reject = report => assert.equal(check(report).status,'not_verified');
  for (const mutate of [r => {r.source_identity='tampered';}, r => {r.subject_content_identity='tampered';},
    r => {r.evaluated_checkout.commit='0'.repeat(40);}, r => {r.observations[1]=r.observations[0];},
    r => r.observations.pop(), r => {r.measurements[2].selected_governing_bytes++;}]) {
    const report=structuredClone(checkpoint.report); mutate(report); reject(report);
  }
  assert.equal(verifyPackageBaseline({...checkpoint,identity:'tampered'},historicalOptions).status,'not_verified');
  assert.equal(verifyPackageBaseline(checkpoint,{...historicalOptions,readObject:() => {throw new Error('Missing history');}}).status,'not_verified');
  const limited = structuredClone(checkpoint.report);
  limited.checks.rolling_efficiency_regression='not_verified';
  limited.efficiency_comparison={rolling:{readiness_allowed:true,results:scenarioDefinitions.map(([scenario]) =>
    ({scenario,status:'not_comparable',reason:'Historical workload changed'}))}};
  assert.equal(check(limited).status,'verified','A legitimate comparison limitation does not erase verified current measurements');
  limited.efficiency_comparison.rolling.results[0].status='unexplained_regression'; reject(limited);
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
