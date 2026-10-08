import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrationBundle, validateMigrationBundle, reconcileMigration, publishedMigrationPath, digest } from './migration-contract.mjs';
import { select } from './release-engine.mjs';
import { classifySupportedState, validateSupportCatalog } from './migration-support.mjs';
const schema=JSON.parse(readFileSync(new URL('./schemas/migration.schema.json',import.meta.url),'utf8'));
const current=digest('current'),legacy=digest('legacy');
const template=JSON.parse(readFileSync(new URL('./release-review.json',import.meta.url),'utf8')).migration_support.profiles[0];
function catalog(identities=[legacy,current]) {
  return {format:1,source_contract:'OOP-migration-distribution',review_evidence:'Synthetic independent reviewed fixture',withdrawals:[],accepted_profiles:[],
    profiles:identities.map((fingerprint,i)=>({...structuredClone(template),fingerprint,profile_id:'oop-fixture-'+i,review_evidence:'Synthetic state semantics reviewed independently of Git'}))};
}
const bundle=()=>migrationBundle(current,catalog(),'OOP-migration-distribution');
function fixture() {
  const b=bundle();
  return {bundle:b,profile:legacy,project:'P',root:'P/root',runtime:'A',target:'f'.repeat(40),previous:'a'.repeat(40),contextVerified:true,observedAt:'2026-10-13T10:30:00Z',
    observations:Object.fromEntries(['common','runtime','operations'].map(scope=>[scope,{project:'P',owner:scope==='common'?'P/root':scope==='runtime'?'A':'P',evidence:'scoped-observer-fixture',authenticated:true,observed_at:'2026-10-13T10:30:00Z',state_schema:template.state_signature[scope].state_schema,current:true,compatible:true,verified:true,requirements:[b['migrations/'+scope+'.json']?.migration_id],canonical:true,remoteReadback:true,signed:true,alignmentRelevant:true}])),
    authority:Object.fromEntries(['common','runtime','operations'].map(scope=>[scope,{allowed:true,expectedRevision:'observed-canonical-revision',exclusive:true}]))};
}
const result=f=>reconcileMigration(f);
const state=(f,scope)=>result(f).dispositions[scope].state;
test('REL-MIG-001: generated bundle closes source-bound supported profiles and explicit common ownership reconciliation',()=>{
  assert.equal(validateMigrationBundle(bundle(),schema,current),true);
  assert.equal(bundle()['migrations/index.json'].scopes.common.disposition,'required');
  assert.equal(bundle()['migrations/common.json'].destination,'common');
});
test('REL-MIG-002: missing required descriptor never means no-op',()=>{const b=bundle();delete b['migrations/runtime.json'];assert.throws(()=>validateMigrationBundle(b,schema,current),/missing/);});
test('REL-MIG-003: traversal unknown path and wrong source binding are rejected',()=>{
  for(const change of [b=>b['../escape.json']={},b=>b['migrations/index.json'].scopes.runtime.descriptor='../escape.json',b=>b['migrations/runtime.json'].source_identity=legacy]){const b=bundle();change(b);assert.throws(()=>validateMigrationBundle(b,schema,current));}
});
test('REL-MIG-004: unknown incomplete profile and mismatched action ownership fail closed',()=>{
  for(const change of [b=>b['migrations/compatibility.json'].profiles[0].requirements=['missing'],b=>b['migrations/runtime.json'].actions[0].scope='peer',b=>delete b['migrations/operations.json'].organizational_state_change,b=>b['migrations/index.json'].scopes.common={disposition:'unknown'}]){const b=bundle();change(b);assert.throws(()=>validateMigrationBundle(b,schema,current));}
});
test('REL-MIG-005: rewrite fallback adopts supported actual state without previous commit objects',()=>{const f=fixture();assert.equal(publishedMigrationPath(()=>({status:1,stdout:''}),f.previous,f.target),null);assert.equal(result(f).adopted,true);assert.equal(result(f).verified_commit,f.target);});
test('REL-MIG-006: unchanged semantic amend reuses evidence without transformation or duplicate publication',()=>{const f=fixture();f.bundle['migrations/operations.json'].organizational_state_change=false;assert.equal(result(f).adopted,true);assert.equal(state(f,'operations'),'ALREADY_SATISFIED');assert.equal(f.bundle['migrations/operations.json'].organizational_state_change,false);f.target='e'.repeat(40);assert.equal(result(f).verified_commit,f.target);});
test('REL-MIG-007: unsupported profile preserves prior checkpoint and scoped next action',()=>{const f=fixture();f.profile=digest('unsupported');assert.equal(result(f).verified_commit,f.previous);assert.equal(state(f,'runtime'),'UNKNOWN');assert.ok(result(f).dispositions.runtime.next_action);});
test('REL-MIG-008: another runtime checkpoint and another machine common root are not own facts',()=>{const f=fixture();f.observations.runtime.owner='B';assert.equal(state(f,'runtime'),'UNKNOWN');assert.equal(state(f,'operations'),'ALREADY_SATISFIED');f.observations.common.owner='other-machine/root';assert.equal(state(f,'common'),'UNKNOWN');assert.equal(result(f).adopted,false);});
test('REL-MIG-009: partial applied effect is verified before any replay or checkpoint advance',()=>{const f=fixture();f.observations.operations.applied=true;f.observations.operations.verified=false;assert.equal(state(f,'operations'),'PENDING');assert.equal(result(f).verified_commit,f.previous);f.observations.operations.partial='unknown';assert.equal(state(f,'operations'),'UNKNOWN');
  for(const scope of ['common','runtime','operations']) {
    for(const field of ['verified','applied','ahead','applied_this_attempt']) for(const value of ['false','true',1,0,[],{},null]) {
      const f=fixture();f.observations[scope][field]=value;
      if(field==='verified') f.observations[scope].applied=true;
      const r=result(f);assert.equal(r.dispositions[scope].state,'UNKNOWN',scope+' '+field);
      assert.equal(r.adopted,false);assert.equal(r.verified_commit,f.previous);assert.equal(r.pending_target,f.target);
      if(scope!=='runtime') assert.equal(r.dispositions.runtime.state,'ALREADY_SATISFIED');
    }
    if(scope==='common') continue;
    for(const requirements of ['oop-three-scope-alignment-v1-'+scope,{},null,42,undefined,[null],[''],[' '],[42]]) {
      const f=fixture();f.observations[scope].requirements=requirements;
      assert.equal(state(f,scope),'UNKNOWN');assert.equal(result(f).verified_commit,f.previous);
    }
    const f=fixture();f.observations[scope].requirements.push(undefined);
    assert.equal(state(f,scope),'UNKNOWN');
  }
  const baseline=fixture();assert.equal(result(baseline).classification.state,'SUPPORTED');
  assert.equal(state(baseline,'common'),'ALREADY_SATISFIED');assert.equal(result(baseline).adopted,true);
});
test('REL-MIG-010: failed remote publication cannot satisfy no-op canonical communication',()=>{const f=fixture();f.observations.operations.remoteReadback=false;assert.equal(state(f,'operations'),'PENDING');assert.equal(result(f).adopted,false);f.observations.operations.remoteReadback=true;f.observations.operations.signed=false;assert.equal(state(f,'operations'),'PENDING');
  for(const field of ['alignmentRelevant','canonical','remoteReadback','signed']) for(const value of [undefined,'true','false',1,[],{},null]) {
    const f=fixture();f.observations.operations[field]=value;
    const r=result(f);assert.equal(r.dispositions.operations.state,'UNKNOWN',field);
    assert.equal(r.adopted,false);assert.equal(r.verified_commit,f.previous);assert.equal(r.pending_target,f.target);
    assert.equal(r.dispositions.runtime.state,'ALREADY_SATISFIED');
  }
  const irrelevant=fixture();irrelevant.observations.operations.alignmentRelevant=false;
  delete irrelevant.observations.operations.signed;delete irrelevant.observations.operations.remoteReadback;
  assert.equal(state(irrelevant,'operations'),'ALREADY_SATISFIED');
  const canonical=fixture();canonical.observations.operations.canonical=false;assert.equal(state(canonical,'operations'),'PENDING');
});
test('REL-MIG-011: advanced operations are reused and never downgraded by intermediate runtime',()=>{const f=fixture();f.observations.operations.ahead=true;assert.equal(state(f,'operations'),'ALREADY_SATISFIED');f.observations.operations.requirements=[];assert.equal(state(f,'operations'),'BLOCKED');});
test('REL-MIG-012: lost synthetic CAS grants one effect owner and loser rereconciles actual evidence',()=>{
  let revision=1,effects=0;const claim=expected=>{if(expected!==revision)return false;revision++;effects++;return true;};
  assert.equal(claim(1),true);assert.equal(claim(1),false);assert.equal(effects,1);
  const f=fixture();f.observations.operations.requirements=[];f.authority.operations.exclusive=false;assert.equal(state(f,'operations'),'BLOCKED');
  f.observations.operations.requirements=[f.bundle['migrations/operations.json'].migration_id];assert.equal(state(f,'operations'),'ALREADY_SATISFIED');
});
test('REL-MIG-013: changed authority and current incompatible writes block affected scope',()=>{const f=fixture();f.observations.operations.requirements=[];f.authority.operations.allowed=false;assert.equal(state(f,'operations'),'BLOCKED');assert.equal(state(f,'runtime'),'ALREADY_SATISFIED');f.observations.operations.compatible=false;assert.equal(state(f,'operations'),'BLOCKED');
  for(const scope of ['runtime','operations']) for(const field of ['allowed','exclusive','expectedRevision']) for(const value of [undefined,'false',1,[],{},null,' ']) {
    if(field==='expectedRevision' && value==='false') continue; // Opaque nonempty revision strings remain valid.
    const f=fixture();f.observations[scope].requirements=[];f.authority[scope][field]=value;
    assert.equal(state(f,scope),'BLOCKED',scope+' '+field);assert.equal(result(f).verified_commit,f.previous);
    const independent=scope==='runtime'?'operations':'runtime';assert.equal(state(f,independent),'ALREADY_SATISFIED');
    f.observations[scope].requirements=[f.bundle['migrations/'+scope+'.json'].migration_id];
    assert.equal(state(f,scope),'ALREADY_SATISFIED');
  }
  const eligible=fixture();eligible.observations.operations.requirements=[];assert.equal(state(eligible,'operations'),'PENDING');
});
test('REL-MIG-014: same SHA cannot replace context and verified owned effects remain distinct',()=>{const f=fixture();f.previous=f.target;f.contextVerified=false;assert.equal(result(f).adopted,false);f.observations.runtime.evidence='';assert.equal(state(f,'runtime'),'UNKNOWN');const applied=fixture();applied.previous=null;applied.observations.runtime.applied_this_attempt=true;assert.equal(state(applied,'runtime'),'UPDATE_APPLIED_VERIFIED');assert.equal(result(applied).adopted,true);});
test('REL-MIG-015: offline remote facts and foreign project evidence remain unknown',()=>{const f=fixture();f.observations.operations.current=false;assert.equal(state(f,'operations'),'UNKNOWN');f.observations.runtime.project='Q';assert.equal(state(f,'runtime'),'UNKNOWN');});
test('REL-MIG-016: isolated real first-parent path inspects GHI LMN OPQ excluding DEF and branch commits',t=>{
  const root=mkdtempSync(join(tmpdir(),'oop-migration-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const git=args=>spawnSync('git',['-c','commit.gpgsign=false','-c','user.name=Migration Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8'});
  const initialized=git(['init','--initial-branch=main']);assert.equal(initialized.status,0,initialized.stderr);
  const commit=(name,b=bundle())=>{mkdirSync(join(root,'dist/migrations'),{recursive:true});for(const p of ['migrations/common.json','migrations/runtime.json','migrations/operations.json'])if(!b[p])rmSync(join(root,'dist',p),{force:true});for(const [p,value]of Object.entries(b))writeFileSync(join(root,'dist',p),JSON.stringify(value));writeFileSync(join(root,'step'),name);assert.equal(git(['add','.']).status,0);assert.equal(git(['commit','-m',name]).status,0);return git(['rev-parse','HEAD']).stdout.trim();};
  const noop=bundle();
  Object.assign(noop['migrations/index.json'].enforcement,{changed:false,category:'UNCHANGED',compatibility:'unchanged',action:'copy-only',prior_engine:'existing',rationale:'Synthetic reviewed no-op controller and adapter; verify applicable facts.'});
  delete noop['migrations/common.json'];delete noop['migrations/runtime.json'];delete noop['migrations/operations.json'];
  noop['migrations/index.json'].scopes=Object.fromEntries(['common','runtime','operations'].map(scope=>[scope,{disposition:'not_required',rationale:'No transformation at this publication; verify applicable facts.'}]));
  assert.equal(validateMigrationBundle(noop,schema,current),true);
  const transform=bundle();transform['migrations/operations.json'].organizational_state_change=true;
  transform['migrations/operations.json'].actions=[{scope:'organization',action:'Apply fixture LMN operations representation once under expected-revision authority, then verify.'}];
  commit('ABC');const def=commit('DEF');const ghi=commit('GHI',noop),lmn=commit('LMN',transform),opq=commit('OPQ',noop);
  assert.deepEqual(publishedMigrationPath(git,def,opq),[ghi,lmn,opq]);
  const dispositions=[];
  for(const sha of publishedMigrationPath(git,def,opq)){const r=git(['show',sha+':dist/migrations/index.json']);assert.equal(r.status,0);const index=JSON.parse(r.stdout);assert.equal(index.format,1);dispositions.push(index.scopes.operations.disposition);}
  assert.deepEqual(dispositions,['not_required','required','not_required']);
  assert.equal(JSON.parse(git(['show',lmn+':dist/migrations/operations.json']).stdout).organizational_state_change,true);
  const shared=fixture();shared.observations.operations.applied_this_attempt=true;assert.equal(state(shared,'operations'),'UPDATE_APPLIED_VERIFIED');shared.observations.operations.applied_this_attempt=false;assert.equal(state(shared,'operations'),'ALREADY_SATISFIED');
  assert.equal(git(['checkout','-b','unpublished']).status,0);const branch=commit('branch');assert.equal(git(['checkout','main']).status,0);
  assert.equal(publishedMigrationPath(git,branch,opq),null);assert.equal(publishedMigrationPath(git,'0'.repeat(40),opq),null);
  assert.equal(git(['commit','--amend','-m','amended OPQ']).status,0);const amended=git(['rev-parse','HEAD']).stdout.trim();assert.notEqual(amended,opq);assert.equal(publishedMigrationPath(git,opq,amended),null);
});
test('REL-MIG-017: explicit no-op requires actual facts and migration context is absent from G0',()=>{const f=fixture();f.observations.common.verified=false;assert.equal(state(f,'common'),'PENDING');assert.ok(!select({classification:'known',request:['information']}).modules.includes('migration-distribution'));assert.ok(select({classification:'known',request:['due_update']}).modules.includes('migration-distribution'));});
test('REL-MIG-018: conflict is not overwritten and known applied evidence is reusable without new effect authority',()=>{const f=fixture();f.observations.operations.conflict=true;assert.equal(state(f,'operations'),'BLOCKED');f.observations.operations.conflict=false;f.authority.operations.allowed=false;assert.equal(state(f,'operations'),'ALREADY_SATISFIED');});
test('REL-MIG-019: A B C D cumulative support survives multiple unavailable rewritten histories',()=>{
  const ids=['A','B','C','D'].map(digest);let prior;
  for(let length=2;length<=4;length++) {
    const input=catalog(ids.slice(0,length));input.accepted_profiles=structuredClone(prior?.profiles??[]);
    const b=migrationBundle(ids[length-1],input,'OOP-migration-distribution',prior);
    assert.equal(validateMigrationBundle(b,schema,ids[length-1]),true);
    assert.deepEqual(b['migrations/compatibility.json'].profiles.map(p=>p.fingerprint),ids.slice(0,length));
    assert.equal(publishedMigrationPath(()=>({status:1,stdout:''}),'a'.repeat(40),'d'.repeat(40)),null);
    prior=input;
  }
});
test('REL-MIG-020: disappearing profile requires bounded explicit withdrawal against prior evidence',()=>{
  const prior=catalog(),next=catalog([current]);next.profiles[0].profile_id=prior.profiles[1].profile_id;
  next.accepted_profiles=structuredClone(prior.profiles);
  assert.throws(()=>validateSupportCatalog(next,current,prior),/missing supported/);
  next.withdrawals=[{profile_id:prior.profiles[0].profile_id,fingerprint:legacy,reason:'Reviewed fixture end of support',risk:'Legacy adoption blocked',compatibility_impact:'Affected legacy only',authorized_disposition:'Fixture reviewed approval',evidence:'Fixture independent decision',recovery:'Retain checkpoint and obtain scoped supported-state remediation'}];
  assert.equal(validateSupportCatalog(next,current,prior),true);
  const f=fixture();f.bundle=migrationBundle(current,next,'OOP-migration-distribution',prior);
  assert.equal(result(f).adopted,false);assert.equal(result(f).verified_commit,f.previous);
  delete next.withdrawals[0].recovery;assert.throws(()=>validateSupportCatalog(next,current,prior),/withdrawal recovery/);
});
test('REL-MIG-021: SHA-only legacy identifies equivalent supported actual state without old objects',()=>{
  const f=fixture();delete f.profile;
  assert.equal(classifySupportedState(f).state,'SUPPORTED');
  assert.equal(result(f).verified_commit,f.target);
  assert.equal(state(f,'operations'),'ALREADY_SATISFIED');
});
test('REL-MIG-022: missing forged contradictory or ambiguous legacy state never advances checkpoint',()=>{
  for(const mutate of [f=>delete f.observations,f=>delete f.observations.runtime.state_schema,f=>f.observations.common.authenticated=false,
    f=>f.observations.runtime.owner='peer',f=>f.observations.operations.conflict=true,
    f=>f.observations.common.observed_at='old',f=>f.observations.operations.partial='unknown',
    f=>f.bundle['migrations/compatibility.json'].profiles[1].write_compatibility='Materially different unsafe writes']) {
    const f=fixture();delete f.profile;mutate(f);assert.equal(result(f).adopted,false);assert.equal(result(f).verified_commit,f.previous);
    assert.ok(['UNKNOWN','BLOCKED'].includes(classifySupportedState(f).state));
  }

  for(const scope of ['common','runtime','operations']) for(const field of ['current','compatible','authenticated','conflict']) for(const value of [undefined,'false','true',1,0,[],{},null]) {
    if(field==='conflict' && value===undefined) continue; // Absent optional conflict is not evidence of conflict.
    const f=fixture();f.observations[scope][field]=value;
    const r=result(f);assert.equal(r.classification.state,'UNKNOWN',scope+' '+field);
    assert.equal(r.dispositions[scope].state,'UNKNOWN');assert.equal(r.adopted,false);
    assert.equal(r.verified_commit,f.previous);assert.equal(r.pending_target,f.target);
  }
  for(const scope of ['common','runtime','operations']) {
    const f=fixture();f.observations[scope].compatible=false;assert.equal(result(f).classification.state,'BLOCKED');
    f.observations[scope].compatible=true;f.observations[scope].conflict=true;assert.equal(result(f).classification.state,'BLOCKED');
    for(const partial of ['unknown',null,1,{},[],false,'']) {f.observations[scope].partial=partial;assert.equal(state(f,scope),'UNKNOWN');}
  }
  for(const value of ['true','false',1,{},[],null,undefined]) {const f=fixture();f.contextVerified=value;assert.equal(result(f).adopted,false);assert.equal(result(f).verified_commit,f.previous);}
});
test('REL-MIG-023: cumulative profiles retain shared evidence without replay or advanced downgrade',()=>{
  const f=fixture();f.bundle=migrationBundle(current,catalog([legacy,digest('middle'),current]),'OOP-migration-distribution');
  delete f.profile;f.observations.operations.ahead=true;f.authority.operations.allowed=false;
  assert.equal(result(f).adopted,true);assert.equal(state(f,'operations'),'ALREADY_SATISFIED');
  f.observations.operations.requirements=[];assert.equal(state(f,'operations'),'BLOCKED');assert.equal(result(f).verified_commit,f.previous);
});
test('REL-MIG-024: stable identities guard completeness and source binding cannot be silently changed',()=>{
  for(const mutate of [c=>c.profiles.push(structuredClone(c.profiles[0])),c=>c.profiles[0].profile_id='bad',
    c=>c.profiles[0].predicates=[],c=>delete c.profiles[0].state_signature.operations,
    c=>c.profiles[0].requirements=['unresolved']]) {
    const c=catalog();mutate(c);assert.throws(()=>validateMigrationBundle(migrationBundle(current,c,'OOP-migration-distribution'),schema,current));
  }
  const prior=catalog(),next=catalog();next.profiles[0].write_compatibility='Silently changed policy';
  assert.throws(()=>validateSupportCatalog(next,current,prior),/stable profile semantics|conflicting equivalent state predicates/);
  assert.throws(()=>migrationBundle(digest('unreviewed current'),catalog(),'OOP-migration-distribution'),/current source/);
});
test('REL-MIG-025: repeated generation is deterministic and preservation claims stay qualified',()=>{
  assert.deepEqual(bundle(),bundle());
  assert.match(bundle()['migrations/compatibility.json'].longitudinal_support,/NOT VERIFIED/);
  const input=catalog();input.accepted_profiles=structuredClone(input.profiles);input.profiles.shift();
  assert.throws(()=>migrationBundle(current,input,'OOP-migration-distribution'),/missing supported/);
  const cumulative=catalog([legacy,digest('middle'),current]);cumulative.accepted_profiles=structuredClone(cumulative.profiles);
  cumulative.profiles.splice(1,1);assert.throws(()=>migrationBundle(current,cumulative,'OOP-migration-distribution'),/missing supported/);
});
test('REL-MIG-026: bare profile or SHA cannot replace authenticated scoped observations',()=>{
  const f=fixture();delete f.observations.runtime.authenticated;
  assert.equal(state(f,'runtime'),'UNKNOWN');assert.equal(state(f,'operations'),'ALREADY_SATISFIED');assert.equal(result(f).verified_commit,f.previous);
  f.profile=f.previous;assert.equal(result(f).adopted,false);
  assert.ok(!select({classification:'known',request:['information']}).modules.includes('migration-distribution'));
});
