// Synthetic admission/transition inputs plus actual context assembly, not runtime execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { select,contextSession } from './release-engine.mjs';
import { evaluateGuard,transition,reusable } from './reference-engine.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/organizational-scenarios.json',import.meta.url),'utf8'));
const admitted=facets=>select({classification:'known',request:facets});
for(const [index,s] of fixture.scenarios.entries())test(`REL-ORG-${String(index+1).padStart(3,'0')}: ${s.id} ${s.title}`,()=>{
  assert.equal(fixture.scenarios.length,9);
  assert.equal(new Set(fixture.scenarios.map(x=>x.id)).size,9);
  assert.equal(s.id,`ORG-${String(index+1).padStart(2,'0')}`);
  const selected=admitted(s.facets), session=contextSession('synthetic-organization','synthetic-runtime','reviewed-candidate');
  const loaded=session.load(selected), byId=new Map(loaded.contracts.map(c=>[c.id,c]));
  for(const id of s.contracts)assert.ok(byId.has(id),`Missing governing context ${id}`);
  assert.equal(loaded.authority_granted,false);
  assert.ok(!loaded.modules.includes('producer'));
  const guard={all:s.required_facts.map(fact=>({fact}))};
  const positive=Object.fromEntries(s.required_facts.map(key=>[key,true]));
  const procedure={states:['pending','verified'],transitions:[{from:'pending',to:'verified',guard}]};
  assert.equal(transition(procedure,'pending','verified',positive).status,'eligible_transition');
  const denied={...positive,[s.negative]:false};
  assert.equal(transition(procedure,'pending','verified',denied).status,'denied');
  assert.equal(transition(procedure,'pending','verified',{model_claimed_complete:true,command_exit_zero:true}).status,'pending');
  for(const key of s.required_facts){const missing={...positive};delete missing[key];assert.equal(evaluateGuard(guard,missing),'unknown');}
  if(index===0 || index===1 || index===2){
    const structural=byId.get('OOP-impact-propagation').semantic_clause;
    assert.ok(structural.includes('OOP applies equally to a Solopreneur'));
    assert.ok(structural.includes('Assistance MUST NOT confer human office, decision authority or accountability'));
    assert.ok(structural.includes('governing bodies or sites'));
  }
  if(index===4 || index===5 || index===8){
    assert.ok(byId.get('OOP-effect-verification').semantic_clause.includes('all and only domains materially affected'));
    assert.ok(byId.get('OOP-effect-verification').semantic_clause.includes('identifying a consequence does not authorize its execution'));
  }
  if(index===6){
    const proof={status:'verified',workspace:'synthetic-organization',runtime:'source-runtime',validity_dependencies:['authority'],observed:{authority:'source'}};
    assert.equal(reusable(proof,{workspace:'synthetic-organization',runtime:'destination-runtime',observed:{authority:'source'}}),false);
    assert.ok(byId.get('OOP-destination-intake').semantic_clause.includes('Source/Target State Firewall'));
  }
  if(index===7){
    for(const facet of ['information','local_write'])for(const id of ['tickets','changes','ci','delivery','bootstrap','human','producer'])assert.ok(!admitted([facet]).modules.includes(id));
    const a=session.load(selected),b=session.load(selected);assert.equal(a.reads,b.reads);
  }
});
