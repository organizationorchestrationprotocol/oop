import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { select, contextSession, routing } from './release-engine.mjs';
import { priorReviewedAllocation } from './routing-allocation.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
import { route } from './reference-engine.mjs';
import { modules } from './release-plan.mjs';

const base = '318598e09d702b131dfeb18efcf9a683ea65b831';
const load = facets => contextSession('routing-test', 'local-reference', 'candidate').load(select({classification:'known',request:facets}));
for (const [index, facets] of [
  ['semantic_propagation'], ['change_set'], ['managed_change'],
  ['semantic_propagation','material_effect'], ['material_effect'],
].entries()) test(`REL-ROUTE-${String(index+1).padStart(3,'0')}: coordination in ${facets.join('+')}`, () => {
  const result = load(facets);
  const coordination = result.contracts.find(c => c.id === 'OOP-organizational-coordination');
  assert.fail('Authorized temporary publication-gate probe: expected failure; do not merge');
  assert.ok(coordination.semantic_clause.includes('all and only domains materially affected'));
  assert.ok(coordination.semantic_clause.includes('identifying a consequence does not authorize its execution'));
  assert.ok(result.contracts.some(c => c.id === 'OOP-mandate-authority'));
  assert.equal(result.authority_granted, false);
  assert.equal(new Set(result.contracts.map(c=>c.id)).size, result.contracts.length);
  if (facets.includes('material_effect')) {
    assert.ok(result.contracts.find(c=>c.id==='OOP-effect-verification').semantic_clause.includes('actually applied state'));
  } else {
    assert.ok(!result.modules.includes('execution'));
    assert.ok(!result.modules.includes('delivery'));
  }
});
test('REL-ROUTE-006: G0 and small G1 retain exact module closure and payload bytes', () => {
  for (const facet of ['information','local_write']) {
    const result=load([facet]);
    assert.deepEqual([...result.modules].sort(), ['context','core','entry','workspace']);
    for (const id of result.modules) {
      const path=`distribution/modules/${id}.json`;
      const prior=execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8',maxBuffer:1024*1024});
      assert.equal(readFileSync(path,'utf8').replace(/\r\n/g,'\n'), prior.replace(/\r\n/g,'\n'));
    }
  }
});
test('REL-ROUTE-007: organizational structure and unknown material routing retain boundaries', () => {
  // The routing map, not descriptor-local triggers, controls selection.
  const prior=JSON.parse(execFileSync('git',['show','dbc434254061169bee40df3f8c97f5a36b33b5eb:distribution/routing.json'],{encoding:'utf8'}));
  const expected={};
  for(const module of modules)for(const facet of module.facets)(expected[facet]??=[]).push(module.id);
  Object.assign(expected,{full_install:['bootstrap'],information:['entry'],interaction:['entry'],
    local_write:['entry'],durable_write:['tickets','execution'],completion:['entry'],update:['adoption'],
    context_loss:['recovery','entry'],canonical_write:['operations','execution','history'],continuity_reserve:['handoff']});
  assert.deepEqual(routing.facets,expected);
  assert.equal(JSON.stringify(routing.facets),JSON.stringify(prior.facets));
  assert.equal(routing.modules.length,36);
  for(const [index,module] of routing.modules.entries()){
    const {facets,...descriptor}=prior.modules[index];
    assert.deepEqual(module,descriptor);
    assert.ok(!Object.hasOwn(module,'facets'));
    const detail=JSON.parse(readFileSync('distribution/'+module.detail,'utf8'));
    assert.deepEqual(detail.triggers,modules.find(m=>m.id===module.id).facets);
  }
  for(const facts of [
    ...Object.keys(expected).flatMap(facet=>['request','action','state','risk','authority','recovery']
      .map(key=>({classification:'known',[key]:[facet]}))),
    {classification:'known',request:Object.keys(expected)},
    {classification:'unknown',request:[]},
  ]){
    assert.deepEqual(select(facts),select(facts,prior));
    assert.deepEqual(route(routing.modules,routing,facts),route(prior.modules,prior,facts));
  }
  const missing=structuredClone(routing);delete missing.facets.information;
  assert.throws(()=>select({classification:'known',request:['information']},missing),/Unresolved facet/);
  const model=load(['organizational_model']);
  assert.ok(model.contracts.find(c=>c.id==='OOP-impact-propagation').semantic_clause.includes('Assistance MUST NOT confer human office'));
  const unknown=select({classification:'unknown',request:[]});
  assert.equal(unknown.classification_resolved,false);
  assert.equal(unknown.authority_granted,false);
  assert.ok(unknown.modules.includes('coordination'));
  assert.ok(!unknown.modules.includes('producer'));
  assert.throws(()=>select({classification:'known',request:['unknown-material']}),/Unresolved facet/);
  const broken=structuredClone(routing);
  broken.modules.find(m=>m.id==='execution').dependencies.push('missing-coordination');
  assert.throws(()=>select({classification:'known',action:['material_effect']},broken),/Unknown dependency/);
});
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
function allocation() { return {
  review:JSON.parse(read('tools/release-review.json')), source:protocolSource(read('PROTOCOL.md')),
  record:JSON.parse(read('tools/routing-allocation.json')),
  readObject:(sha,path)=>execFileSync('git',['show',`${sha}:${path}`],{encoding:'utf8',maxBuffer:2*1024*1024}),
}; }
test('REL-ROUTE-008: exact reviewed split chains to the immutable original allocation', () => {
  const input=allocation(),prior=priorReviewedAllocation(input);
  assert.equal(prior.spans.length,54);
  assert.equal(input.review.spans.length,55);
  assert.equal(prior.spans.find(s=>s.id==='OOP-effect-verification').start,2560);
  assert.equal(input.review.spans.find(s=>s.id==='OOP-effect-verification').start,2564);
});
test('REL-ROUTE-009: changed source allocation dependencies or review record fail closed', () => {
  for (const mutate of [
    f=>{f.source+='\nExtra authority';}, f=>{f.review.spans[0].end--;},
    f=>{f.review.modules.find(m=>m.id==='execution').dependencies=['core'];},
    f=>{f.record.target_review_identity='sha256:forged';},
  ]) {const input=allocation();mutate(input);assert.throws(()=>priorReviewedAllocation(input),/Unreviewed/);}
});
test('REL-ROUTE-010: unavailable or changed historical allocation is rejected', () => {
  const input=allocation();
  assert.throws(()=>priorReviewedAllocation({...input,readObject:()=>{throw Error('Unavailable history');}}),/Unavailable/);
  assert.throws(()=>priorReviewedAllocation({...input,readObject:()=>'{}'}),/Changed/);
});
