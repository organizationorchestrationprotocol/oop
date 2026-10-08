import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { select, contextSession, routing } from './release-engine.mjs';
import { reviewedAllocation, digest } from './genesis.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
import { route } from './reference-engine.mjs';
import { modules, spans } from './release-plan.mjs';

const load = facets => contextSession('routing-test', 'local-reference', 'candidate').load(select({classification:'known',request:facets}));
// Independent, test-only wire-contract reader. No production adapter or authority discovery.
// The current reviewed allocation specifies the facet vocabulary and targets.
function contractReader(index, reviewed, facts) {
  assert.equal(index.format,2, 'Unsupported routing format');
  assert.ok(index.facets && typeof index.facets === 'object', 'Missing central map');
  assert.deepEqual(index.facets,reviewed.facets,'Incomplete or conflicting central map');
  assert.ok(['known','unknown'].includes(facts.classification),'Unsupported classification');
  const descriptors=new Map();
  for(const module of index.modules) {
    assert.ok(typeof module.id==='string' && !descriptors.has(module.id),'Invalid module identity');
    const reviewedModule=reviewed.modules.find(m=>m.id===module.id);
    assert.ok(reviewedModule,'Unsupported module');
    assert.ok(Array.isArray(module.dependencies),'Missing dependencies');
    assert.ok(typeof module.context==='string' && typeof module.detail==='string','Missing payload reference');
    for(const field of ['context','detail','detail_identity'])
      assert.equal(module[field],reviewedModule[field],'Broken payload reference');
    assert.ok(!Object.hasOwn(module,'facets'),'Compact descriptor has legacy facets');
    descriptors.set(module.id,module);
  }
  assert.equal(descriptors.size,reviewed.modules.length,'Incomplete catalog');
  for(const ids of Object.values(index.facets)) {
    assert.ok(Array.isArray(ids) && ids.length,'Empty facet targets');
    for(const id of ids)assert.ok(descriptors.has(id),'Broken facet reference');
  }
  for(const list of [index.default,index.conservative]) {
    assert.ok(Array.isArray(list) && list.length,'Missing fallback');
    for(const id of list)assert.ok(descriptors.has(id),'Broken fallback reference');
  }
  assert.deepEqual(index.default,reviewed.default,'Conflicting default');
  assert.deepEqual(index.conservative,reviewed.conservative,'Incomplete conservative closure');
  // Validate the entire graph, including modules not selected by the current request.
  function resolve(ids) {
    const done=new Set(),active=new Set();
    function visit(id) {
      assert.ok(descriptors.has(id),'Broken dependency reference');
      assert.ok(!active.has(id),'Dependency cycle');
      if(done.has(id))return;
      active.add(id);
      for(const dependency of [...descriptors.get(id).dependencies].sort())visit(dependency);
      active.delete(id);done.add(id);
    }
    for(const id of [...new Set(ids)].sort())visit(id);
    return [...done];
  }
  resolve([...descriptors.keys()]);
  const requested=new Set(['interaction']);
  for(const dimension of ['request','action','state','risk','authority','recovery']) {
    const values=facts[dimension]??[];
    assert.ok(Array.isArray(values) && values.every(v=>typeof v==='string' && v),'Malformed input');
    for(const facet of values)requested.add(facet);
  }
  const targets=[];
  for(const facet of requested) {
    assert.ok(Object.hasOwn(index.facets,facet),'Unsupported facet');
    targets.push(...index.facets[facet]);
  }
  if(facts.classification==='unknown')targets.push(...index.conservative);
  return {modules:resolve(targets),classification_resolved:facts.classification==='known',
    requires_independent_admission:true,authority_granted:false};
}
for (const [index, facets] of [
  ['semantic_propagation'], ['change_set'], ['managed_change'],
  ['semantic_propagation','material_effect'], ['material_effect'],
].entries()) test(`REL-ROUTE-${String(index+1).padStart(3,'0')}: coordination in ${facets.join('+')}`, () => {
  const result = load(facets);
  const coordination = result.contracts.find(c => c.id === 'OOP-organizational-coordination');
  assert.ok(coordination, 'Material planning needs coordination without an effect facet');
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
      const path=`dist/modules/${id}.json`;
      const payload=JSON.parse(readFileSync(path,'utf8'));
      const review=JSON.parse(readFileSync('tools/release-review.json','utf8'));
      for(const contract of payload.contracts) assert.equal(digest(contract.semantic_clause),review.spans.find(span=>span.id===contract.id)?.content_identity);
      assert.deepEqual(payload.contracts.map(c=>c.id),review.spans.filter(span=>span.module===id).map(span=>span.id));
    }
  }
});
test('REL-ROUTE-007: organizational structure and unknown material routing retain boundaries', () => {
  // The routing map, not descriptor-local triggers, controls selection.
  assert.equal(routing.format,2);
  const expected={};
  for(const module of modules)for(const facet of module.facets)(expected[facet]??=[]).push(module.id);
  Object.assign(expected,{full_install:['bootstrap'],information:['entry'],interaction:['entry'],
    local_write:['entry'],durable_write:['tickets','execution'],completion:['entry'],update:['adoption'],
    context_loss:['recovery','entry'],canonical_write:['operations','execution','history'],continuity_reserve:['handoff']});
  assert.deepEqual(routing.facets,expected);
  assert.equal(routing.modules.length,modules.length);
  for(const [index,module] of routing.modules.entries()){
    assert.deepEqual(module.dependencies,modules.find(m=>m.id===module.id).dependencies);
    assert.ok(!Object.hasOwn(module,'facets'));
    const detail=JSON.parse(readFileSync('dist/'+module.detail,'utf8'));
    assert.deepEqual(detail.triggers,modules.find(m=>m.id===module.id).facets);
  }
  for(const facts of [
    ...Object.keys(expected).flatMap(facet=>['request','action','state','risk','authority','recovery']
      .map(key=>({classification:'known',[key]:[facet]}))),
    {classification:'known',request:Object.keys(expected)},
    {classification:'known',request:['information'],action:['local_write']},
    {classification:'known',request:['managed_change'],risk:['material_effect'],authority:['human_dependency'],recovery:['context_loss']},
    {classification:'unknown',request:[]},
  ]){
    // Expected closure comes from a separate reader, not another call to select/route.
    const compact=contractReader(routing,routing,facts);
    assert.deepEqual(select(facts),compact);
    assert.deepEqual(route(routing.modules,routing,{...facts,request:[...(facts.request??[]),'interaction']}),compact);
  }
  for(const mutate of [
    index=>{index.format=999;}, index=>{delete index.facets;},
    index=>{delete index.facets.information;}, index=>{index.facets.information=['core'];},
    index=>{index.facets.information=['missing'];}, index=>{index.facets.unsupported=['entry'];},
    index=>{index.modules[0].dependencies.push('missing');},
    index=>{index.modules[0].dependencies.push(index.modules[0].id);},
    index=>{index.modules[0].facets=['information'];},
    index=>{delete index.modules[0].detail;},
    index=>{index.modules[0].context='modules/missing.json';},
    index=>{index.modules[0].detail_identity='sha256:forged';},
    index=>{index.conservative=['entry'];},
  ]) {
    const invalid=structuredClone(routing);mutate(invalid);
    assert.throws(()=>contractReader(invalid,routing,{classification:'known',request:['information']}));
  }
  assert.throws(()=>contractReader({...routing,format:1},routing,{classification:'known',request:['information']}));
  assert.throws(()=>contractReader(routing,routing,{classification:'known',request:['unsupported']}));
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
  review:JSON.parse(read('tools/release-review.json')),source:protocolSource(read('PROTOCOL.md')),spans:structuredClone(spans),modules:structuredClone(modules),
}; }
test('REL-ROUTE-008: complete current reviewed allocation covers each source clause exactly once',()=>{
  const input=allocation();assert.equal(reviewedAllocation(input),true);
  assert.equal(input.review.spans.length,56);
  const coordination=input.review.spans.find(s=>s.id==='OOP-organizational-coordination');
  const execution=input.review.spans.find(s=>s.id==='OOP-effect-verification');
  assert.equal(coordination.end+1,execution.start);
  assert.match(input.source.split('\n').slice(coordination.start-1,coordination.end).join('\n'),/Organizational CI\/CD/);
});
test('REL-ROUTE-009: changed source allocation dependencies or review record fail closed',()=>{
  for(const mutate of [f=>{f.source+='\nExtra authority';},f=>{f.review.spans[0].end--;},f=>{f.review.modules.find(m=>m.id==='execution').dependencies=['core'];},f=>{f.review.source_identity='sha256:forged';}]){
    const input=allocation();mutate(input);assert.throws(()=>reviewedAllocation(input),/Unreviewed/);
  }
});
test('REL-ROUTE-010: missing incomplete and overlapping current allocation fails closed',()=>{
  for(const mutate of [f=>{f.review={};},f=>{f.spans.pop();f.review.spans.pop();},f=>{f.spans[1].start--;f.review.spans[1].start--;},f=>{f.review.spans[0].content_identity='sha256:forged';}]){
    const input=allocation();mutate(input);assert.throws(()=>reviewedAllocation(input));
  }
});
