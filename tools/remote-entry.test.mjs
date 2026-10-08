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
import { evaluateGuard, closure, bootstrapCompletion, commonPrivateCredential, projectSourceResolution } from './reference-engine.mjs';
import { protocolSource } from './acceptance-inputs.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hash=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const preflight=entry.bootstrap_preflight,steps=preflight.steps;
const boot=readJSON('procedures/bootstrap.json');
const review=JSON.parse(read('tools/release-review.json'));
const clause=readJSON('modules/bootstrap.json').contracts.find(c=>c.id==='OOP-full-install');
const positive=step=>Object.fromEntries(step.guard.all.map(({fact})=>[fact,true]));
// Steps are identified by stable ID, never by table position.
const stage=id=>steps.find(s=>s.id===id),bootStep=id=>boot.steps.find(s=>s.id===id);
const entryIds=['ENTRY-01','ENTRY-03','ENTRY-04','ENTRY-05','ENTRY-06','ENTRY-07'];
const bootIds=['BOOT-01','BOOT-03','BOOT-04','BOOT-05','BOOT-06','BOOT-07','BOOT-08','BOOT-10','BOOT-11','BOOT-12','BOOT-13'];
const bootRow=id=>clause.semantic_clause.split('\n').find(row=>row.startsWith(`| **${id}** |`));

test('REL-ENTRY-001: standalone entry contains exact reviewed pre-clone instructions without local payload reads',t=>{
  const root=mkdtempSync(join(tmpdir(),'oop-entry-only-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  writeFileSync(join(root,'entry.json'),read('dist/entry.json'));
  const standalone=JSON.parse(readFileSync(join(root,'entry.json'),'utf8'));
  assert.deepEqual(readdirSync(root),['entry.json']);
  assert.equal(standalone.source_snapshot.repository,'https://github.com/organizationorchestrationprotocol/oop.git');
  assert.equal(preflight.source_contract,clause.id);assert.deepEqual(preflight.source,clause.source);
  const rows=clause.semantic_clause.split('\n').filter(row=>/^\| ENTRY-\d+ \|/.test(row));
  assert.equal(rows.length,entryIds.length);
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

test('REL-ENTRY-003: pre-clone ordering is acyclic and acquisition protection precedes BOOT-05 without a cyclic dependency',()=>{
  assert.deepEqual(closure(steps.map(s=>({id:s.id,dependencies:s.depends_on})),['ENTRY-07']),entryIds);
  assert.deepEqual(stage('ENTRY-03').depends_on,['ENTRY-01']);
  assert.equal(boot.steps.length,bootIds.length);assert.equal(boot.preflight_ref,'../entry.json#bootstrap_preflight');
  // ENTRY-03 owns protection before any checkout write; BOOT-03 starts only after ENTRY-07 entered full install.
  const protection=stage('ENTRY-03'),facts=positive(protection);
  assert.equal(evaluateGuard(protection.guard,{current_project_identity:true}),'unknown');
  assert.equal(evaluateGuard(protection.guard,{...facts,private_root_protected_before_checkout_write:false}),'false');
  assert.deepEqual(bootStep('BOOT-03').depends_on,['BOOT-01']);
  assert.ok(bootStep('BOOT-03').guard.all.some(x=>x.fact==='full_install_entered'));
  assert.deepEqual(bootStep('BOOT-05').guard.all,[{fact:'private_root_protected'}]);
  assert.match(clause.semantic_clause,/Complete the full Private Workspace protection check/);
  assert.match(bootRow('BOOT-05'),/Reuse ENTRY-03's unchanged observed protection facts/);
});

test('REL-ENTRY-004: missing private protection and foreign or unresolved project facts block supplied startup evidence',()=>{
  const protection=stage('ENTRY-03');
  assert.equal(evaluateGuard(protection.guard,{}),'unknown');
  assert.equal(evaluateGuard(protection.guard,{...positive(protection),private_root_protected_before_checkout_write:false}),'false');
  assert.equal(evaluateGuard(protection.guard,positive(protection)),'true');
  for(const fact of ['current_project_identity','current_project_authority']){
    assert.equal(evaluateGuard(protection.guard,{...positive(protection),[fact]:false}),'false');
  }
  assert.equal(evaluateGuard(stage('ENTRY-04').guard,{...positive(stage('ENTRY-04')),same_project_destination_resolved:false}),'false');
  assert.match(protection.instruction,/workspace in which the official installation request was received/);
  assert.match(protection.instruction,/verify that it belongs to that workspace/);
  assert.match(protection.instruction,/tracked paths as well as explicit VCS exclusion/);
  assert.match(protection.instruction,/ignore rule does not untrack existing data/);
});

test('REL-ENTRY-005: reuse and concurrency contract preserves equivalents and rejects uncoordinated acquisition facts',()=>{
  const step=stage('ENTRY-04');
  assert.match(step.instruction,/Discover actual local coordination capability just in time/);
  assert.match(step.instruction,/before cloning/);assert.match(step.instruction,/valid equivalent and non-secret mapping/);
  assert.match(step.instruction,/recheck actual state after coordination and reuse a peer's completed acquisition/);
  assert.match(step.instruction,/Never blindly move, overwrite or duplicate existing state/);
  assert.equal(evaluateGuard(step.guard,{...positive(step),safe_acquisition_coordination:false}),'false');
  assert.equal(evaluateGuard(step.guard,{...positive(step),safe_acquisition_coordination:undefined}),'unknown');
  assert.equal(evaluateGuard(step.guard,positive(step)),'true');
});

test('REL-ENTRY-006: freshness projection retains clean update and dirty divergent pinned offline and independent-adoption boundaries',()=>{
  const step=stage('ENTRY-06');
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
  const language=stage('ENTRY-01'),fetch=stage('ENTRY-05'),local=stage('ENTRY-07');
  assert.match(entry.instructions[0].instruction,/author requested files and documents in English unless/);
  assert.match(language.instruction,/each action's purpose, actual status\/result/);
  assert.match(language.instruction,/user's preferred language/);
  assert.match(fetch.instruction,/Discover actual fetch capability just in time; a URL grants none/);
  assert.match(fetch.instruction,/remote fetch\/write is unavailable/);
  assert.match(fetch.instruction,/Do not audit OOP content/);
  assert.equal(evaluateGuard(fetch.guard,{...positive(fetch),release_checks_not_performed:false}),'false');
  assert.match(local.instruction,/Resolve relative distribution paths only there/);
  assert.match(local.instruction,/all listed BOOT steps \(BOOT-01, BOOT-03–BOOT-08 and BOOT-10–BOOT-13\)/);
  assert.match(local.instruction,/verify the answer\/result and resume automatically/);
  assert.match(local.instruction,/actual installed-control\/access checks/);
  assert.equal(evaluateGuard(local.guard,{local_canonical_context_available:true}),'unknown');
});

test('REL-ENTRY-008: entry fields resolve and initial migration support has one current profile and no predecessor',()=>{
  assert.equal(entry.format,1);assert.equal(preflight.format,1);
  for(const field of ['minimum_context','migration_index','migration_context','selector','procedures','interfaces','contract_binding','consumer_exclusion'])assert.ok(entry[field]);
  const compatibility=readJSON('migrations/compatibility.json');
  assert.deepEqual(compatibility.previous,review.migration.previous);assert.deepEqual(compatibility.current,review.migration.current);
  assert.ok(!('profiles' in compatibility)&&!('change_scope' in review)&&!('migration_support' in review));
  assert.equal(readJSON('migrations/index.json').scopes.common.disposition,'not_required');
  assert.equal(readJSON('migrations/index.json').scopes.operations.disposition,'not_required');
});

test('REL-ENTRY-009: malformed preflight or missing or duplicated language instruction fails generation before writes',t=>{
  const root=mkdtempSync(join(tmpdir(),'oop-entry-negative-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const dir of ['tools','dist'])cpSync(new URL('../'+dir,import.meta.url),join(root,dir),{recursive:true});
  const snapshots=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?snapshots(join(dir,item.name)):[[join(dir,item.name),hash(readFileSync(join(dir,item.name)))]]);
  const before=snapshots(join(root,'dist'));
  for(const [mutate,error] of [
    [s=>s.replace('| ENTRY-07 |','| ENTRY-99 |'),/Invalid reviewed preflight row/],
    [s=>s.replace('**ENTRY-INSTRUCTION-01:**','**REMOVED-INSTRUCTION-01:**'),/Missing or duplicate canonical opening language instruction/],
    [s=>s.replace('**ENTRY-INSTRUCTION-01:**','**ENTRY-INSTRUCTION-01:** **ENTRY-INSTRUCTION-01:**'),/Missing or duplicate canonical opening language instruction/]
  ]){
    const document=mutate(read('PROTOCOL.md'));
    writeFileSync(join(root,'PROTOCOL.md'),document);
    const source=protocolSource(document),lines=source.split('\n'),bad=structuredClone(review);
    bad.source_identity=hash(source);
    for(const span of bad.spans)span.content_identity=hash(lines.slice(span.start-1,span.end).join('\n'));
    writeFileSync(join(root,'tools/release-review.json'),JSON.stringify(bad));
    const result=spawnSync(process.execPath,['tools/generate-release.mjs'],{cwd:root,encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,error);
    assert.deepEqual(snapshots(join(root,'dist')),before);
  }
});

test('REL-ENTRY-010: README contains exactly the requested CTA and source references resolve',()=>{
  const cta=read('README.md').match(/```ruby\r?\n([^\r\n]+)\r?\n```/)[1];
  assert.equal(cta,'execute https://github.com/organizationorchestrationprotocol/oop/raw/main/dist/entry.json');
  const url=new URL(cta.slice('execute '.length));assert.equal(url.protocol,'https:');assert.ok(!url.pathname.includes('blob/main'));
  assert.equal(Object.keys(entry)[0],'instructions');
  assert.deepEqual(entry.instructions.map(x=>x.id),['ENTRY-INSTRUCTION-01']);
  assert.equal(entry.instructions[0].instruction,read('tools/fixtures/language-policy.txt').replace(/\r\n/g,'\n').trimEnd());
  const source=read('PROTOCOL.md');
  assert.ok(source.replace(/\r\n/g,'\n').includes('### First mandatory rule — language\n\n'+entry.instructions[0].instruction));
  const files=['PROTOCOL.md','tools/generate-release.mjs','tools/bootstrap-language.test.mjs','tools/remote-entry.test.mjs','dist/entry.json','dist/modules/bootstrap.json'];
  const removed='ENTRY-INSTRUCTION-'+'02';
  for(const path of files)assert.ok(!read(path).includes(removed),path);
  for(const step of steps)for(const ref of step.source_refs){
    if(/^(BOOT|SYS|UX)-\d+$/.test(ref))assert.ok(source.includes(ref),ref);
    else assert.ok(source.split(/\r?\n/).some(line=>/^##?#+ /.test(line)&&line.endsWith(ref)),ref);
  }
});

test('REL-ENTRY-011: generated entry and procedure contain exactly the stable IDs and gaps stay unfilled',()=>{
  assert.deepEqual(steps.map(s=>s.id),entryIds);
  assert.deepEqual(boot.steps.map(s=>s.id),bootIds);
  assert.ok(!('removed_step_ids' in boot)&&!('compatibility' in boot));
  assert.deepEqual(clause.semantic_clause.split('\n').filter(row=>/^\| \*\*BOOT-\d+\*\* \|/.test(row)).map(row=>row.match(/BOOT-\d+/)[0]),bootIds);
  for(const s of [...steps,...boot.steps])assert.ok(s.depends_on.every(id=>[...entryIds,...bootIds].includes(id)),s.id);
  assert.match(clause.semantic_clause,/Step identities are stable; identity gaps are intentional and are never filled or reused/);
  const rel=readJSON('modules/producer.json').contracts.map(c=>c.semantic_clause).join('\n');
  assert.match(rel,/identity gaps are intentional and are never filled or reused/);
});

test('REL-ENTRY-012: dependencies are explicit by ID, ownership is keyed by ID and removed steps cannot complete bootstrap',()=>{
  assert.deepEqual(bootStep('BOOT-03').depends_on,['BOOT-01']);assert.deepEqual(bootStep('BOOT-10').depends_on,['BOOT-08']);
  for(const [index,id] of bootIds.entries())if(!['BOOT-03','BOOT-10'].includes(id))
    assert.deepEqual(bootStep(id).depends_on,index?[bootIds[index-1]]:[],id);
  assert.deepEqual(closure(boot.steps.map(s=>({id:s.id,dependencies:s.depends_on})),['BOOT-13']).sort(),[...bootIds].sort());
  assert.deepEqual(boot.steps.filter(s=>s.effect_owner==='organization').map(s=>s.id),['BOOT-10','BOOT-13']);
  assert.equal(boot.installation.full_readiness_guard_ref,'#steps/'+bootIds.indexOf('BOOT-13')+'/guard');
  const phases=bootIds.map(id=>({id,status:'verified'})),facts=Object.fromEntries(boot.steps.flatMap(s=>s.guard.all.map(x=>[x.fact,true])));
  for(const procedure of [{...boot,format:999},{...boot,steps:[...boot.steps.slice(0,1),{...boot.steps[0],id:'BOOT-99'},...boot.steps.slice(1)]},
    {...boot,steps:boot.steps.filter(s=>s.id!=='BOOT-12')},{...boot,steps:[...boot.steps].reverse()}])
    assert.equal(bootstrapCompletion({procedure,phases,facts}).reason,'adapter_update_required');
  assert.equal(bootstrapCompletion({procedure:boot,phases:phases.filter(p=>p.id!=='BOOT-10'),facts}).reason,'phase:BOOT-10');
  // A phase record for an identity outside the stable set neither blocks nor satisfies a step.
  assert.equal(bootstrapCompletion({procedure:boot,phases:[...phases.filter(p=>p.id!=='BOOT-10'),{id:'BOOT-99',status:'verified'}],facts}).reason,'phase:BOOT-10');
  assert.equal(bootstrapCompletion({procedure:boot,phases:[...phases,{id:'BOOT-98',status:'failed'}],facts}).reason,'selected_effective_credential');
});

// Detects instructions directing a runtime to read the canonical source; identity metadata is excluded.
const readsProtocol=text=>text.split(/(?<=[.;])\s+/).filter(s=>s.includes('PROTOCOL.md') &&
  /\b(read|reads|reread|re-enter|load|loads|open)\b/i.test(s) && !/\b(never|must not|not|without)\b/i.test(s));
const strings=(value,key='')=>typeof value==='string'?(['path','locator','content_identity'].includes(key)?[]:[value]):
  Array.isArray(value)?value.flatMap(v=>strings(v,key)):value&&typeof value==='object'?Object.entries(value).flatMap(([k,v])=>strings(v,k)):[];
test('REL-ENTRY-013: no consumer-facing distribution instruction directs reading PROTOCOL.md',()=>{
  assert.deepEqual(readsProtocol('Once the checkout is available, read its local PROTOCOL.md, then its local dist/entry.json.'),
    ['Once the checkout is available, read its local PROTOCOL.md, then its local dist/entry.json.']);
  assert.deepEqual(readsProtocol('Never read PROTOCOL.md during consumer bootstrap.'),[]);
  const consumer=readdirSync(new URL('../dist/modules/',import.meta.url)).filter(f=>f!=='producer.json').map(f=>'modules/'+f)
    .concat(['entry.json','procedures/bootstrap.json','procedures/lifecycle.json','routing.json']);
  for(const path of consumer)assert.deepEqual(strings(readJSON(path)).flatMap(readsProtocol),[],path);
  assert.match(stage('ENTRY-07').instruction,/never read PROTOCOL.md during consumer bootstrap, adoption, refresh or recovery/);
  assert.match(entry.consumer_exclusion,/Never read PROTOCOL.md/);assert.match(entry.authority,/consumers never read it/);
  assert.match(bootRow('BOOT-03'),/load applicable distribution modules, never the full `PROTOCOL.md`/);
  const adoption=readJSON('modules/adoption.json').contracts.map(c=>c.semantic_clause).join('\n');
  assert.ok(!adoption.includes('section 28, Bootstrap, in `PROTOCOL.md`'));
  assert.match(adoption,/re-enter the distributed bootstrap procedure/);
});

test('REL-ENTRY-014: BOOT-06 asks once without discovery or inference and accepts only .priv or persisted answers',()=>{
  const row=bootRow('BOOT-06'),step=bootStep('BOOT-06');
  assert.match(row,/Resolve the project source from `.priv`, otherwise ask the user once/);
  assert.match(row,/immediately ask the user once for the project source\/product repository address or an explicit `not_applicable`/);
  assert.match(row,/perform no discovery, no inference from ambient remotes or local checkouts and propose no candidates/);
  assert.match(row,/Persist the answer as a non-secret reference in the common private topology so no runtime, chat or re-entry asks again/);
  assert.ok(!/Exhaust bounded authorized discovery|never an additional manual setup question/.test(row));
  assert.deepEqual(step.fact_basis.project_source_resolved.any_of,['source_reference_from_priv','source_reference_user_provided_persisted']);
  assert.equal(step.human_question.ask,'once');assert.equal(step.human_question.resume_condition,'answer_received_and_reference_persisted');
  for(const branch of ['absent','unknown']){assert.match(step.branches[branch],/ask the user once/i);assert.ok(!/Discover sufficient/.test(step.branches[branch]));}
  const base={project:'A',expected_project:'A'};
  assert.equal(projectSourceResolution({...base,origin:'priv_reference'}),'true');
  assert.equal(projectSourceResolution({...base,origin:'user_provided',persisted:true}),'true');
  assert.equal(projectSourceResolution({...base,origin:'user_provided',persisted:false}),'false');
  assert.equal(projectSourceResolution({...base,origin:'user_provided'}),'unknown');
  for(const origin of ['ambient_remote','local_checkout','autonomous_discovery','proposed_candidate','peer_project'])
    assert.equal(projectSourceResolution({...base,origin}),'false',origin);
  assert.equal(projectSourceResolution({origin:'priv_reference',project:'B',expected_project:'A'}),'false');
  assert.equal(projectSourceResolution({}),'unknown');
  const system=readJSON('modules/bootstrap.json').contracts.find(c=>c.id==='OOP-bootstrap-system').semantic_clause;
  assert.match(system,/BOOT-06's one-time missing-source question/);assert.match(system,/ask once for a missing source reference under BOOT-06/);
  assert.match(readJSON('modules/core.json').contracts.map(c=>c.semantic_clause).join('\n'),/BOOT-06's one-time missing-source question asks for information only the human has/);
});

test('REL-ENTRY-015: BOOT-10 makes one consolidated public-only request with conditional signing key and verifies afterwards',()=>{
  const row=bootRow('BOOT-10'),step=bootStep('BOOT-10');
  assert.match(row,/issue exactly one consolidated user request/);
  assert.match(row,/authentication public enrollment material read from its credential file in the common private area, for an asymmetric-key mechanism the full public key and fingerprint/);
  assert.match(row,/when signature acceptance requires provider-side registration, the same public material and fingerprint for the project-authorized machine identity signing credential file in the common private area/);
  assert.match(row,/Never request or display private keys, tokens or other secrets/);
  assert.match(row,/rediscover and then verify identity, read, write and signature acceptance through the selected credential in BOOT-11; user confirmation is not evidence/);
  assert.match(row,/failed discovery never proves absence and never justifies `operations-2`/);
  assert.equal(step.human_request.consolidated,true);assert.equal(step.human_request.max_requests,1);
  assert.equal(step.human_request.confirmation_is_evidence,false);
  for(const forbidden of ['private_key','token','secret','replacement_repository'])assert.ok(step.human_request.never.includes(forbidden));
  assert.ok(step.human_request.contents.some(x=>/^authentication_public_key_and_fingerprint_from_common_private_file$/.test(x)));
  assert.ok(step.human_request.contents.some(x=>/^signing_public_key_and_fingerprint_from_common_private_file_when_signature_acceptance_requires_registration$/.test(x)));
  assert.ok(!/without requesting manual enrollment/.test(bootRow('BOOT-08')));
  assert.match(bootRow('BOOT-08'),/requested only through BOOT-10's consolidated request/);
  const repository=readJSON('modules/repository.json').contracts.map(c=>c.semantic_clause).join('\n');
  assert.match(repository,/human setup requests are limited to exactly BOOT-06's one-time missing-source question, BOOT-10's single consolidated/);
});

test('REL-ENTRY-016: BOOT-11 and BOOT-08 rely only on project-authorized machine credential files physically in .priv/common',()=>{
  assert.match(bootRow('BOOT-11'),/using only the project-authorized machine identity credential files physically present in the current project's common private area, shared by all runtimes of the project/);
  assert.match(bootRow('BOOT-11'),/A genuinely credential-free public read cannot satisfy authenticated operations readiness/);
  assert.match(bootRow('BOOT-08'),/a credential held only in an external secure facility or elsewhere is ineligible for this purpose and is never scanned, exported, relocated or copied/);
  assert.match(bootRow('BOOT-13'),/with the selected common-private credential files/);
  assert.ok(bootStep('BOOT-08').guard.all.some(x=>x.fact==='credential_files_in_common_private_area'));
  assert.ok(bootStep('BOOT-11').guard.all.some(x=>x.fact==='common_private_credential_files_used'));
  const security=readJSON('modules/security.json').contracts.map(c=>c.semantic_clause).join('\n');
  assert.match(security,/MUST reside as credential files physically in the current project's common private area/);
  assert.match(security,/Ineligibility by location under SEC-01/);
  const credential=Object.assign({origin:'current_project_common_private_reference',secret_location:'common_private_files'},
    ...['project','common_area','reference','principal','adapter','purpose'].map(k=>({[k]:'x-'+k,['expected_'+k]:'x-'+k})),
    ...['mapping_verified','authority_verified','reference_owned','effective_origin_verified','authentication_verified','read_verified',
      'write_verified','signing_verified_or_inapplicable'].map(k=>({[k]:true})));
  assert.equal(commonPrivateCredential(credential),'true');
  for(const secret_location of ['external_secure_facility','os_keychain','tool_private'])assert.equal(commonPrivateCredential({...credential,secret_location}),'false');
  assert.equal(commonPrivateCredential({...credential,secret_location:undefined}),'unknown');
});

test('REL-ENTRY-017: initial compatibility declares no predecessor or runtime migration procedure',()=>{
  const index=readJSON('migrations/index.json'),compatibility=readJSON('migrations/compatibility.json');
  assert.equal(index.scopes.runtime.disposition,'not_required');assert.equal(index.scopes.common.disposition,'not_required');
  assert.equal(index.step.from,null);assert.equal(compatibility.previous,null);
  assert.equal(index.step.to,compatibility.current.profile_id);assert.equal(compatibility.current.profile_id,'oop-initial-1');
  assert.equal(boot.format,1);assert.equal(index.enforcement.category,'UNCHANGED');assert.equal(index.enforcement.compatibility,'unchanged');
});

test('REL-ENTRY-018: malformed, missing or unlisted BOOT rows fail real generation before writing',t=>{
  for(const [from,to] of [['| **BOOT-12** |','| BOOT-12 |'],['| **BOOT-10** |','| **BOOT-99** |'],['| **BOOT-03** |','| **BOOT-98** |']]){
    const root=mkdtempSync(join(tmpdir(),'oop-boot-negative-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
    for(const dir of ['tools','dist'])cpSync(new URL('../'+dir,import.meta.url),join(root,dir),{recursive:true});
    const document=read('PROTOCOL.md').replace(from,to);assert.notEqual(document,read('PROTOCOL.md'));
    writeFileSync(join(root,'PROTOCOL.md'),document);
    const source=protocolSource(document),lines=source.split('\n'),bad=structuredClone(review);
    bad.source_identity=hash(source);
    for(const span of bad.spans)span.content_identity=hash(lines.slice(span.start-1,span.end).join('\n'));
    writeFileSync(join(root,'tools/release-review.json'),JSON.stringify(bad));
    const snapshots=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?snapshots(join(dir,item.name)):[[join(dir,item.name),hash(readFileSync(join(dir,item.name)))]]);
    const before=snapshots(join(root,'dist'));
    const result=spawnSync(process.execPath,['tools/generate-release.mjs'],{cwd:root,encoding:'utf8'});
    assert.notEqual(result.status,0,from);assert.match(result.stderr,/Incomplete canonical BOOT sequence/,from);
    assert.deepEqual(snapshots(join(root,'dist')),before,from);
  }
});

test('REL-ENTRY-019: minimal credential purposes and scoped setup authority retain signing and host trust boundaries',()=>{
  const security=readJSON('modules/security.json').contracts.map(c=>c.semantic_clause).join('\n');
  const bootstrap=readJSON('modules/bootstrap.json').contracts.map(c=>c.semantic_clause).join('\n');
  const core=readJSON('modules/core.json').contracts.map(c=>c.semantic_clause).join('\n');
  assert.match(security,/additional repositories expressly authorized by the user/);
  assert.match(security,/signing support alone MUST NOT cause a separate signing credential/);
  assert.match(security,/Preserve mandatory signed ticket transitions/);
  assert.match(security,/create only one authentication keypair without a passphrase/);
  assert.match(security,/If a higher-priority policy forbids passphrase-less storage, use a permitted equivalent/);
  assert.match(security,/an enrollment title or commit attribution proves no provider account/);
  assert.match(bootRow('BOOT-08'),/minimum necessary purpose\/repository credential set/);
  assert.match(bootRow('BOOT-10'),/Signing material\/enrollment is included only when independently required/);
  assert.match(bootRow('BOOT-11'),/separately required signing only when applicable/);
  assert.match(bootRow('BOOT-12'),/A plan alone is insufficient/);
  assert.match(bootstrap,/without repeated generic OOP approval/);
  assert.match(bootstrap,/A separate host trust, registration or administrator gate is not satisfied by install intent/);
  assert.match(bootstrap,/never self-trust, auto-TOFU, elevate, override policy or undo refusal\/revocation/);
  assert.match(core,/Unexamined ability is to_be_assessed, never unsupported/);
  assert.match(read('examples.md'),/deploy-key settings, add a deploy key/);
  assert.match(read('examples.md'),/enable write access/);
  assert.match(read('examples.md'),/full public authentication key and its fingerprint/);
});
