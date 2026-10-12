import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { organizationalAlignment, alignmentFromAcceptedBaseline } from './organizational-alignment.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const record = JSON.parse(read('tools/organizational-alignment.json'));
const readObject = (sha,path) => execFileSync('git',['--no-optional-locks','show',`${sha}:${path}`],{encoding:'utf8',maxBuffer:2*1024*1024});
function fixture(){return {record:structuredClone(record),source:protocolSource(read('PROTOCOL.md')),review:JSON.parse(read('tools/release-review.json')),trace:JSON.parse(read('tools/evidence/release-traceability.json')),baseIsAncestor:true,readObject};}
test('ALIGN-001: exact additions retain every baseline byte and reviewed allocation',()=>{
  const result=organizationalAlignment(fixture());assert.equal(result.status,'passed',result.reason);
  assert.equal(result.changes.length,2);assert.notEqual(record.baseline_source_identity,record.target_source_identity);
  assert.deepEqual(result.changes.map(x=>x.id),['SD-ORG-STRUCTURE-001','SD-ORG-COORDINATION-001']);
  const forged=fixture();forged.trace.source_binding.kind='committed_source';
  if (fixture().trace.source_binding.kind === 'reviewed_worktree_candidate') assert.equal(organizationalAlignment(forged).status,'failed');
});
for(const [i,[label,mutate]] of [
  ['extra source word', f=>{f.source=f.source.replace('MUST model','MAY model');}],
  ['removed obligation',f=>{f.source=f.source.replace(record.changes[0].text,'');}],
  ['unrelated source line',f=>{f.source+='\nNew authority.';}],
  ['edited record',f=>{f.record.changes[0].text+='New authority.';}],
  ['missing record',f=>{f.record=undefined;}],
  ['different allocation',f=>{f.review.spans[0].end--;}],
  ['different module dependencies',f=>{f.review.modules[0].dependencies=['human'];}],
  ['missing history',f=>{f.baseIsAncestor=false;}],
  ['changed baseline',f=>{f.readObject=()=>readObject(record.base_commit,'PROTOCOL.md').replace('You must contribute','You may contribute');}],
  ['misclassified trace',f=>{f.trace.classification='generated_derived_only';}],
  ['missing trace delta',f=>{f.trace.semantic_deltas=[];}],
  ['fabricated migration authority',f=>{f.trace.migration.organizational_state_change=true;}],
  ['changed trace span',f=>{f.trace.clauses[0].end--;}],
].entries())test(`ALIGN-${String(i+2).padStart(3,'0')}: rejects ${label}`,()=>{const f=fixture();mutate(f);assert.equal(organizationalAlignment(f).status,'failed');});
test('ALIGN-015: latest accepted source remains chained through the unchanged historical bridge',()=>{
  const historicalRecord=JSON.parse(read('tools/reviewed-source-transition.json'));
  const input={...fixture(),historicalRecord,baselineCommit:historicalRecord.baseline.commit,
    checkpoint:{recordCommit:historicalRecord.checkpoint.commit,identity:historicalRecord.checkpoint.content_identity},
    previous:protocolSource(readObject(historicalRecord.baseline.commit,historicalRecord.baseline.path),{historical:true})};
  const result=alignmentFromAcceptedBaseline(input);assert.equal(result.status,'passed',result.reason);
  assert.equal(result.prior_accepted_transition.status,'passed');
  assert.equal(alignmentFromAcceptedBaseline({...input,baselineCommit:record.base_commit}).status,'failed');
  assert.equal(alignmentFromAcceptedBaseline({...input,checkpoint:{...input.checkpoint,identity:'sha256:wrong'}}).status,'failed');
});
