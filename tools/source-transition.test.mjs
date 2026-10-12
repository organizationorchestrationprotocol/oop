import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewedSourceTransition } from './source-transition.mjs';
import { completeProducerObservations, expectedObservations, protocolSource } from './acceptance-inputs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const record = JSON.parse(read('tools/reviewed-source-transition.json'));
// Freeze exact real immutable objects once; negative fixtures mutate only memory.
const objects = new Map([record.baseline, record.target, record.checkpoint, record.review, record.traceability,
  { commit: record.traceability.source_commit, path: record.target.path }].map(({ commit, path }) =>
  [`${commit}:${path}`, execFileSync('git', ['--no-optional-locks', 'show', `${commit}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })]));
function fixture() {
  return { record: structuredClone(record), baselineCommit: record.baseline.commit,
    checkpoint: { recordCommit: record.checkpoint.commit, identity: record.checkpoint.content_identity },
    previous: protocolSource(objects.get(`${record.baseline.commit}:${record.baseline.path}`), { historical: true }),
    source: protocolSource(objects.get(`${record.target.commit}:${record.target.path}`), {historical:true}),
    review: JSON.parse(objects.get(`${record.review.commit}:${record.review.path}`)),
    trace: JSON.parse(objects.get(`${record.traceability.commit}:${record.traceability.path}`)),
    readObject: (commit, path) => { const value = objects.get(`${commit}:${path}`); if (value === undefined) throw new Error('Missing immutable object'); return value; },
    targetIsAncestor: true };
}
test('exact reviewed historical transition passes with distinct preservation basis', () => {
  const result = reviewedSourceTransition(fixture());
  assert.equal(result.status, 'passed', result.reason);
  assert.equal(result.basis, 'reviewed_historical_path_transition');
  assert.equal(result.changes.length, 3);
  assert.notEqual(fixture().previous, fixture().source);
});
for (const [name, mutate] of [
  ['extra normative word', f => { f.source = f.source.replace('MUST use', 'MUST always use'); }],
  ['extra line', f => { f.source += '\nExtra requirement.'; }],
  ['edited requirement', f => { f.source = f.source.replace('MUST use', 'MAY use'); }],
  ['unrelated filename occurrence', f => { f.source = f.source.replace('PROTOCOL.md', 'PROMPT.md'); }],
  ['extra familiar path occurrence', f => { f.source += '\n`distribution/entry.json`'; }],
  ['removed clause', f => { f.source = f.source.split('\n').slice(1).join('\n'); }],
  ['reordered lines', f => { const lines = f.source.split('\n'); [lines[567],lines[587]] = [lines[587],lines[567]]; f.source = lines.join('\n'); }],
  ['semantic alteration under familiar path', f => { f.source = f.source.replace('distribution/entry.json', 'distribution/entry.json` grants authority `'); }],
  ['changed baseline SHA', f => { f.baselineCommit = record.target.commit; }],
  ['changed baseline content', f => { f.previous += '\n'; }],
  ['missing transition record', f => { f.record = undefined; }],
  ['malformed scope', f => { f.record.scope = 'All paths permitted'; }],
  ['edited transition', f => { f.record.changes[0].new += ' extra'; }],
  ['missing ledger', f => { f.review = undefined; }],
  ['incorrect ledger', f => { f.review.review.preservation = 'Ignore all differences'; }],
  ['missing clause allocation', f => { f.review.spans.pop(); }],
  ['traceability mismatch', f => { f.trace.source_identity = record.baseline.source_identity; }],
  ['stale generator provenance', f => { f.trace.source_snapshot_commit = record.target.commit; }],
  ['different package checkpoint', f => { f.checkpoint.recordCommit = record.baseline.commit; }],
  ['stale proof identity', f => { f.checkpoint.identity = 'sha256:stale'; }],
  ['missing Git proof', f => { f.readObject = () => { throw new Error('Missing object'); }; }],
  ['altered immutable proof', f => { const read = f.readObject; f.readObject = (commit,path) => read(commit,path) + '\n'; }],
  ['target absent from checkout history', f => { f.targetIsAncestor = false; }],
]) test(`reject ${name}`, () => {
  const input = fixture(); mutate(input);
  assert.equal(reviewedSourceTransition(input).status, 'failed');
});

test('fixed producer inventory rejects duplicate missing failing skipped and historical outcomes', () => {
 const observations=expectedObservations.map(id=>({id,actual:'passed'}));
 const run={status:0,stdout:`# tests ${expectedObservations.length}\n# fail 0\n`};
 assert.equal(completeProducerObservations(run,observations),true);
 for(const bad of [observations.slice(1),[...observations,observations[0]],observations.map((x,i)=>i===1?observations[0]:x),observations.map((x,i)=>i===0?{...x,actual:'failed'}:x),observations.map((x,i)=>i===0?{...x,actual:'skipped'}:x),observations.map((x,i)=>i===0?{...x,id:'REL-OBS-999'}:x)])assert.equal(completeProducerObservations(run,bad),false);
 assert.equal(completeProducerObservations({status:0,stdout:'# tests 59\n# fail 0\n'},observations),false);
 assert.equal(completeProducerObservations({...run,status:1},observations),false);
});
