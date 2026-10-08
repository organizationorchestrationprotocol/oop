import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrationBundle, validateMigrationBundle, reconcileMigration, digest } from './migration-contract.mjs';
import { select } from './release-engine.mjs';
import { classifySupportedState, validateSupportCatalog } from './migration-support.mjs';
const schema=JSON.parse(readFileSync(new URL('./schemas/migration.schema.json',import.meta.url),'utf8'));
const review=JSON.parse(readFileSync(new URL('./release-review.json',import.meta.url),'utf8'));
const current=digest('current');
const scopes=['common','runtime','operations'];
// Synthetic single-step support: every scope required so each reconciliation branch is reachable.
function support() {
  const s=structuredClone(review.migration);
  s.previous=structuredClone(s.current);s.previous.profile_id='oop-fixture-source';s.current.profile_id='oop-fixture-target';
  s.current.state_signature={common:{state_schema:'fixture-common-2'},runtime:{state_schema:'fixture-runtime-2'},operations:{state_schema:'fixture-operations-2'}};
  s.previous.state_signature={common:{state_schema:'fixture-common-1'},runtime:{state_schema:'fixture-runtime-1'},operations:{state_schema:'fixture-operations-1'}};
  s.scopes=Object.fromEntries(scopes.map(scope=>[scope,{disposition:'required',migration_id:'oop-fixture-'+scope,organizational_state_change:scope==='operations',
    affected_domains:['fixture_'+scope],already_satisfied:'Synthetic current facts and stable requirement evidence.',actions:['Apply the fixture '+scope+' step once, then verify.']}]));
  return s;
}
const bundle=(s=support())=>migrationBundle(current,s,'OOP-migration-distribution');
function fixture(role='previous') {
  const b=bundle(),signature=b['migrations/compatibility.json'][role].state_signature;
  return {bundle:b,project:'P',root:'P/root',runtime:'A',target:'f'.repeat(40),previous:'a'.repeat(40),contextVerified:true,observedAt:'2026-10-13T10:30:00Z',
    observations:Object.fromEntries(scopes.map(scope=>[scope,{project:'P',owner:scope==='common'?'P/root':scope==='runtime'?'A':'P',evidence:'scoped-observer-fixture',authenticated:true,observed_at:'2026-10-13T10:30:00Z',state_schema:signature[scope].state_schema,current:true,compatible:true,verified:true,requirements:[b['migrations/'+scope+'.json'].migration_id],canonical:true,remoteReadback:true,signed:true,alignmentRelevant:true}])),
    authority:Object.fromEntries(scopes.map(scope=>[scope,{allowed:true,expectedRevision:'observed-canonical-revision',exclusive:true}]))};
}
const result=f=>reconcileMigration(f);
const state=(f,scope)=>result(f).dispositions[scope].state;
test('REL-MIG-001: the bundle describes exactly one step from the previous to the current profile',()=>{
  const b=bundle();assert.equal(validateMigrationBundle(b,schema,current),true);
  const index=b['migrations/index.json'],compatibility=b['migrations/compatibility.json'];
  assert.deepEqual(index.step,{from:compatibility.previous.profile_id,to:compatibility.current.profile_id});
  assert.ok(!('profiles' in compatibility)&&!('withdrawals' in compatibility));
  assert.ok(scopes.every(scope=>b['migrations/'+scope+'.json'].step.to===compatibility.current.profile_id));
});
test('REL-MIG-002: the initial distribution declares no predecessor or migration actions',()=>{
  const b=migrationBundle(current,review.migration,'OOP-migration-distribution');assert.equal(validateMigrationBundle(b,schema,current),true);
  assert.equal(b['migrations/compatibility.json'].previous,null);assert.equal(b['migrations/index.json'].step.from,null);
  assert.equal(b['migrations/index.json'].scopes.runtime.disposition,'not_required');assert.ok(!b['migrations/runtime.json']);
  assert.equal(b['migrations/index.json'].scopes.common.disposition,'not_required');assert.ok(!b['migrations/common.json']);
  assert.equal(b['migrations/index.json'].scopes.operations.disposition,'not_required');assert.ok(!b['migrations/operations.json']);
});
test('REL-MIG-003: missing required descriptor never means no-op',()=>{const b=bundle();delete b['migrations/runtime.json'];assert.throws(()=>validateMigrationBundle(b,schema,current),/missing/);});
test('REL-MIG-004: traversal, unknown path, wrong source binding and broken step binding are rejected',()=>{
  for(const change of [b=>b['../escape.json']={},b=>b['migrations/index.json'].scopes.runtime.descriptor='../escape.json',b=>b['migrations/runtime.json'].source_identity=digest('other'),
    b=>b['migrations/runtime.json'].step={from:'oop-other',to:'oop-other'},b=>b['migrations/index.json'].step.from='oop-other']){const b=bundle();change(b);assert.throws(()=>validateMigrationBundle(b,schema,current));}
});
test('REL-MIG-005: commit identities, cumulative catalogs and withdrawals are refused',()=>{
  const sha='c'.repeat(40);
  for(const mutate of [s=>s.review_evidence='Reviewed at '+sha,s=>s.profiles=[],s=>s.withdrawals=[],s=>s.previous.fingerprint=current]) {const s=support();mutate(s);assert.throws(()=>validateSupportCatalog(s));}
  const b=bundle();b['migrations/runtime.json'].actions[0].action='Reconcile from '+sha;assert.throws(()=>validateMigrationBundle(b,schema,current),/commit identity/);
});
test('REL-MIG-006: incomplete profiles and mismatched action ownership fail closed',()=>{
  for(const change of [b=>b['migrations/runtime.json'].actions[0].scope='peer',b=>delete b['migrations/operations.json'].organizational_state_change,
    b=>b['migrations/index.json'].scopes.common={disposition:'unknown'},b=>delete b['migrations/compatibility.json'].current.state_signature.operations]){const b=bundle();change(b);assert.throws(()=>validateMigrationBundle(b,schema,current));}
  for(const mutate of [s=>s.current.predicates=[],s=>s.previous.profile_id=s.current.profile_id,s=>s.current.profile_id='bad']){const s=support();mutate(s);assert.throws(()=>validateSupportCatalog(s));}
});
test('REL-MIG-007: a previous-version state follows the step and adopts only when every scope is verified',()=>{
  const f=fixture();assert.equal(result(f).classification.state,'SUPPORTED');assert.equal(result(f).adopted,true);
  const applied=fixture();applied.observations.runtime.applied_this_attempt=true;assert.equal(state(applied,'runtime'),'UPDATE_APPLIED_VERIFIED');
  const pending=fixture();pending.observations.runtime.requirements=[];assert.equal(state(pending,'runtime'),'PENDING');assert.equal(result(pending).adopted,false);
});
test('REL-MIG-008: a current-version state is already satisfied without replay',()=>{
  const f=fixture('current');assert.equal(result(f).classification.state,'CURRENT');
  for(const scope of scopes)assert.equal(state(f,scope),'ALREADY_SATISFIED');assert.equal(result(f).adopted,true);
});
test('REL-MIG-009: any other state is unsupported and requires a fresh runtime bootstrap preserving organizational data',()=>{
  const f=fixture();f.observations.runtime.state_schema='fixture-runtime-0';
  const r=result(f);assert.equal(r.classification.state,'UNSUPPORTED');assert.equal(r.adopted,false);assert.equal(r.verified_commit,f.previous);
  assert.match(r.dispositions.runtime.next_action,/fresh runtime bootstrap preserving organizational data/);
});
test('REL-MIG-010: another runtime checkpoint, another machine root and foreign project evidence are not own facts',()=>{
  for(const [scope,field,value] of [['runtime','owner','B'],['common','owner','other/root'],['operations','project','Q']]){const f=fixture();f.observations[scope][field]=value;assert.equal(state(f,scope),'UNKNOWN');assert.equal(result(f).adopted,false);}
});
test('REL-MIG-011: partial applied effects are verified before any replay or checkpoint advance',()=>{
  const f=fixture();f.observations.operations.applied=true;f.observations.operations.verified=false;assert.equal(state(f,'operations'),'PENDING');assert.equal(result(f).verified_commit,f.previous);
  const unknown=fixture();unknown.observations.operations.partial='unknown';assert.equal(state(unknown,'operations'),'UNKNOWN');
});
test('REL-MIG-012: failed remote publication cannot satisfy canonical communication',()=>{
  const f=fixture();f.observations.operations.remoteReadback=false;assert.equal(state(f,'operations'),'PENDING');
  f.observations.operations.remoteReadback=true;f.observations.operations.signed=false;assert.equal(state(f,'operations'),'PENDING');
  for(const field of ['alignmentRelevant','canonical','remoteReadback','signed'])for(const value of [undefined,'true',1,null]){const g=fixture();g.observations.operations[field]=value;assert.equal(state(g,'operations'),'UNKNOWN',field);}
  const irrelevant=fixture();irrelevant.observations.operations.alignmentRelevant=false;delete irrelevant.observations.operations.signed;assert.equal(state(irrelevant,'operations'),'ALREADY_SATISFIED');
});
test('REL-MIG-013: advanced, conflicting or incompatible state is never overwritten and authority gates block',()=>{
  const ahead=fixture();ahead.observations.operations.requirements=[];ahead.observations.operations.ahead=true;assert.equal(state(ahead,'operations'),'BLOCKED');
  const conflict=fixture();conflict.observations.operations.conflict=true;assert.equal(result(conflict).classification.state,'BLOCKED');
  for(const field of ['allowed','exclusive','expectedRevision'])for(const value of [undefined,'false',1,null,' ']){
    if(field==='expectedRevision'&&value==='false')continue;
    const f=fixture();f.observations.runtime.requirements=[];f.authority.runtime[field]=value;assert.equal(state(f,'runtime'),'BLOCKED',field);assert.equal(state(f,'operations'),'ALREADY_SATISFIED');
  }
});
test('REL-MIG-014: offline, unauthenticated or bare-profile observations remain unknown',()=>{
  const offline=fixture();offline.observations.operations.current=false;assert.equal(state(offline,'operations'),'UNKNOWN');
  const bare=fixture();delete bare.observations.runtime.authenticated;assert.equal(state(bare,'runtime'),'UNKNOWN');assert.equal(result(bare).verified_commit,bare.previous);
  const foreignProfile=fixture();foreignProfile.profile='oop-not-declared';assert.equal(result(foreignProfile).adopted,false);
  assert.equal(classifySupportedState({bundle:bundle(),project:'P',root:'P/root',runtime:'A',observations:{},observedAt:'2026-10-13T10:30:00Z'}).state,'UNKNOWN');
});
test('REL-MIG-015: same target cannot replace context verification and migration context is absent from G0',()=>{
  const f=fixture();f.previous=f.target;f.contextVerified=false;assert.equal(result(f).adopted,false);
  assert.ok(!select({classification:'known',request:['information']}).modules.includes('migration-distribution'));
  assert.ok(select({classification:'known',request:['due_update']}).modules.includes('migration-distribution'));
});
test('REL-MIG-016: repeated generation is deterministic and the support identity binds the reviewed step',()=>{
  assert.deepEqual(bundle(),bundle());
  const other=support();other.current.write_compatibility='Changed policy';
  assert.notEqual(bundle(other)['migrations/compatibility.json'].support_content_identity,bundle()['migrations/compatibility.json'].support_content_identity);
});

test('REL-MIG-017: null predecessor cannot hide a required migration or omitted predecessor',()=>{
 const initial=structuredClone(review.migration);assert.equal(validateSupportCatalog(initial),true);
 const missing=structuredClone(initial);delete missing.previous;assert.throws(()=>validateSupportCatalog(missing));
 const contradictory=structuredClone(initial);contradictory.scopes.runtime={disposition:'required'};assert.throws(()=>validateSupportCatalog(contradictory));
 const b=migrationBundle(current,initial,'OOP-migration-distribution');b['migrations/index.json'].scopes.runtime={disposition:'required',descriptor:'migrations/runtime.json'};
 assert.throws(()=>validateMigrationBundle(b,schema,current));
});
test('REL-MIG-018: initial profile observations require real state predicates and do not accept a fabricated predecessor',()=>{
 const b=migrationBundle(current,review.migration,'OOP-migration-distribution'),f=fixture('current');
 f.bundle=b;for(const scope of scopes)f.observations[scope].state_schema=review.migration.current.state_signature[scope].state_schema;
 assert.equal(result(f).classification.state,'CURRENT');assert.equal(result(f).adopted,true);
 f.observations.runtime.state_schema='not-declared';assert.equal(result(f).classification.state,'UNSUPPORTED');assert.equal(result(f).adopted,false);
 f.observations.runtime.authenticated=false;assert.equal(result(f).classification.state,'UNKNOWN');
});
