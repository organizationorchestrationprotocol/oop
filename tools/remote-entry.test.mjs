// Producer-only source/contract and supplied-observation tests. No consumer executor,
// provider integration, checkout mutation or live runtime behavior is certified here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { entry, readJSON } from './release-engine.mjs';
import { evaluateGuard, closure } from './reference-engine.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hash=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const preflight=entry.bootstrap_preflight,steps=preflight.steps;
const boot=readJSON('procedures/bootstrap.json');
const review=JSON.parse(read('tools/release-review.json'));
const clause=readJSON('modules/bootstrap.json').contracts.find(c=>c.id==='OOP-full-install');
const positive=step=>Object.fromEntries(step.guard.all.map(({fact})=>[fact,true]));

test('REL-ENTRY-001: standalone entry contains exact reviewed pre-clone instructions without local payload reads',t=>{
  const root=mkdtempSync(join(tmpdir(),'oop-entry-only-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  writeFileSync(join(root,'entry.json'),read('dist/entry.json'));
  const standalone=JSON.parse(readFileSync(join(root,'entry.json'),'utf8'));
  assert.deepEqual(readdirSync(root),['entry.json']);
  assert.equal(standalone.source_snapshot.repository,'https://github.com/organizationorchestrationprotocol/oop.git');
  assert.equal(preflight.source_contract,clause.id);assert.deepEqual(preflight.source,clause.source);
  const rows=clause.semantic_clause.split('\n').filter(row=>/^\| ENTRY-\d+ \|/.test(row));
  assert.equal(rows.length,7);
  for(const [i,row]of rows.entries()){
    const [id,refs,instruction,facts]=row.split('|').slice(1,-1).map(x=>x.trim());
    assert.equal(steps[i].id,id);assert.equal(steps[i].instruction,instruction);
    assert.deepEqual(steps[i].source_refs,refs.split('; '));
    assert.deepEqual(steps[i].guard.all,facts.split(', ').map(fact=>({fact})));
  }
});

test('REL-ENTRY-002: every required observation independently denies or remains unknown without evidence',()=>{
  for(const step of steps){
    const facts=positive(step);assert.equal(evaluateGuard(step.guard,facts),'true');
    for(const {fact}of step.guard.all){
      assert.equal(evaluateGuard(step.guard,{...facts,[fact]:false}),'false');
      const missing={...facts};delete missing[fact];assert.equal(evaluateGuard(step.guard,missing),'unknown');
      assert.equal(evaluateGuard(step.guard,{...facts,[fact]:'true'}),'unknown');
    }
    assert.equal(evaluateGuard(step.guard,{user_confirmation:true,command_exit_zero:true}),'unknown');
  }
});

test('REL-ENTRY-003: pre-clone ordering is acyclic and BOOT-02 cannot rely on later BOOT-05',()=>{
  assert.deepEqual(closure(steps.map(s=>({id:s.id,dependencies:s.depends_on})),['ENTRY-07']),steps.map(s=>s.id));
  assert.equal(boot.steps.length,13);assert.equal(boot.preflight_ref,'../entry.json#bootstrap_preflight');
  const acquisition=boot.steps[1],facts=positive(acquisition);
  assert.equal(evaluateGuard(acquisition.guard,{oop_obtained:true}),'unknown');
  assert.equal(evaluateGuard(acquisition.guard,{...facts,private_root_protected_before_checkout_write:false}),'false');
  assert.deepEqual(acquisition.depends_on,['BOOT-01']);
  assert.deepEqual(boot.steps[4].guard.all,[{fact:'private_root_protected'}]);
  assert.match(clause.semantic_clause,/Complete the full Private Workspace protection check/);
});

test('REL-ENTRY-004: missing private protection and foreign or unresolved project facts block supplied startup evidence',()=>{
  assert.equal(evaluateGuard(steps[2].guard,{}),'unknown');
  assert.equal(evaluateGuard(steps[2].guard,{private_root_protected_before_checkout_write:false}),'false');
  assert.equal(evaluateGuard(steps[2].guard,{private_root_protected_before_checkout_write:true}),'true');
  for(const fact of ['current_project_identity','current_project_authority']){
    assert.equal(evaluateGuard(steps[1].guard,{...positive(steps[1]),[fact]:false}),'false');
  }
  assert.equal(evaluateGuard(steps[3].guard,{...positive(steps[3]),same_project_destination_resolved:false}),'false');
  assert.match(steps[2].instruction,/tracked paths as well as explicit VCS exclusion/);
  assert.match(steps[2].instruction,/ignore rule does not untrack existing data/);
});

test('REL-ENTRY-005: reuse and concurrency contract preserves equivalents and rejects uncoordinated acquisition facts',()=>{
  const step=steps[3];
  assert.match(step.instruction,/before cloning/);assert.match(step.instruction,/valid equivalent and non-secret mapping/);
  assert.match(step.instruction,/recheck actual state after coordination and reuse a peer's completed acquisition/);
  assert.match(step.instruction,/Never blindly move, overwrite or duplicate existing state/);
  assert.equal(evaluateGuard(step.guard,{...positive(step),safe_acquisition_coordination:false}),'false');
  assert.equal(evaluateGuard(step.guard,{...positive(step),safe_acquisition_coordination:undefined}),'unknown');
  assert.equal(evaluateGuard(step.guard,positive(step)),'true');
});

test('REL-ENTRY-006: freshness projection retains clean update and dirty divergent pinned offline and independent-adoption boundaries',()=>{
  const step=steps[5];
  for(const text of ['at most one due fetch','shared failure evidence','Fast-forward only a clean eligible tracking branch',
    'dirty, divergent, detached/pinned or offline','without reset, stash, overwrite, branch switching',
    'remote latest remains unknown offline','never advances any runtime\'s adopted checkpoint'])assert.ok(step.instruction.includes(text),text);
  assert.equal(evaluateGuard(step.guard,{...positive(step),bounded_freshness_disposition:false}),'false');
  assert.equal(evaluateGuard(step.guard,{...positive(step),peer_adoption_preserved:false}),'false');
  // A resolved offline/pinned disposition can pass; remote success is not a required fact.
  assert.equal(evaluateGuard(step.guard,positive(step)),'true');
  assert.ok(step.guard.all.every(x=>x.fact!=='remote_fetch_succeeded'));
});

test('REL-ENTRY-007: language capability audit-exclusion and full-install handoff remain explicit and guarded',()=>{
  assert.match(steps[0].instruction,/English, preserving technical literals and raw external evidence/);
  assert.match(steps[0].instruction,/each action's purpose, actual status\/result/);
  assert.match(steps[0].instruction,/user's preferred language/);
  assert.match(steps[4].instruction,/remote fetch\/write is unavailable/);
  assert.match(steps[4].instruction,/Do not audit OOP content/);
  assert.equal(evaluateGuard(steps[4].guard,{...positive(steps[4]),release_checks_not_performed:false}),'false');
  assert.match(steps[6].instruction,/Resolve relative distribution paths only there/);
  assert.match(steps[6].instruction,/all BOOT-01–BOOT-13/);
  assert.match(steps[6].instruction,/verify the answer\/result and resume automatically/);
  assert.match(steps[6].instruction,/actual installed-control\/access checks/);
  assert.equal(evaluateGuard(steps[6].guard,{local_canonical_context_available:true}),'unknown');
});

test('REL-ENTRY-008: additive format retains existing entry fields and all accepted state profiles without mandatory relocation',()=>{
  assert.equal(entry.format,1);assert.equal(preflight.format,1);
  for(const field of ['minimum_context','migration_index','migration_context','selector','procedures','interfaces','contract_binding','consumer_exclusion'])assert.ok(entry[field]);
  const support=review.migration_support;
  for(const accepted of support.accepted_profiles)assert.deepEqual(support.profiles.find(p=>p.profile_id===accepted.profile_id),accepted);
  assert.ok(support.profiles.some(p=>p.fingerprint===entry.source_binding.source_identity));
  assert.equal(readJSON('migrations/index.json').scopes.common.disposition,'not_required');
  assert.equal(readJSON('migrations/operations.json').organizational_state_change,false);
  assert.match(review.change_scope.compatibility,/preserve mapped legacy placements/);
});

test('REL-ENTRY-009: malformed reviewed preflight sequence fails real generation before writing any artifacts',t=>{
  const root=mkdtempSync(join(tmpdir(),'oop-entry-negative-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const dir of ['tools','dist'])cpSync(new URL('../'+dir,import.meta.url),join(root,dir),{recursive:true});
  const document=read('PROTOCOL.md').replace('| ENTRY-07 |','| ENTRY-99 |');
  writeFileSync(join(root,'PROTOCOL.md'),document);
  const source=protocolSource(document),lines=source.split('\n'),bad=structuredClone(review);
  bad.source_identity=hash(source);
  for(const span of bad.spans)span.content_identity=hash(lines.slice(span.start-1,span.end).join('\n'));
  bad.migration_support.profiles.at(-1).fingerprint=bad.source_identity;
  writeFileSync(join(root,'tools/release-review.json'),JSON.stringify(bad));
  const snapshots=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?snapshots(join(dir,item.name)):[[join(dir,item.name),hash(readFileSync(join(dir,item.name)))]]);
  const before=snapshots(join(root,'dist'));
  const result=spawnSync(process.execPath,['tools/generate-release.mjs'],{cwd:root,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid reviewed preflight row/);
  assert.deepEqual(snapshots(join(root,'dist')),before);
});

test('REL-ENTRY-010: README contains exactly the requested GitHub CTA and source references resolve',()=>{
  const cta=read('README.md').match(/```ruby\r?\n([^\r\n]+)\r?\n```/)[1];
  assert.equal(cta,'execute https://github.com/organizationorchestrationprotocol/oop/raw/main/dist/entry.json');
  const url=new URL(cta.slice('execute '.length));assert.equal(url.protocol,'https:');assert.ok(!url.pathname.includes('blob/main'));
  const source=read('PROTOCOL.md');
  for(const step of steps)for(const ref of step.source_refs){
    if(/^(BOOT|SYS|UX)-\d+$/.test(ref))assert.ok(source.includes(ref),ref);
    else assert.ok(source.split(/\r?\n/).some(line=>/^##?#+ /.test(line)&&line.endsWith(ref)),ref);
  }
});
