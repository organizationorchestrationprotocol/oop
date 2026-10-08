// Producer fixtures only. No consumer installation, credential discovery or native hook is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {presentationLanguage,sharedLanguagePreferencePlan,commonPrivateCredential,privateExclusionPlan,bootstrapCompletion,transition,workerRepositoryAdmission,operationsAccess} from './reference-engine.mjs';
import {createRequire} from 'node:module';
const {machine}=createRequire(import.meta.url)('./fixtures/machine.cjs');
const procedure=JSON.parse(readFileSync(new URL('../dist/procedures/bootstrap.json',import.meta.url)));
const now=Date.parse('2026-10-17T12:00:00Z');
const scope={project:'fixture-project',user:'fixture-user',host:'fixture-host',runtime:'fixture-runtime',session:'fixture-session'};
const kinds=['current_user_language_instruction','shared_project_response_language','user_account_presentation_locale',
  'application_response_language','runtime_response_language','persistent_user_language_preference'];
const precedence={established:true,source:'synthetic runtime precedence',evidence:'fixture-setting-order',
  order:['persistent_user_language_preference','application_response_language','runtime_response_language',
    'user_account_presentation_locale','shared_project_response_language']};
const observation=(kind,patch={})=>({kind,status:'absent',attempted:true,authorized:true,current:true,applicable:true,scope,
  source:'synthetic authorized facility',authority:'fixture authority',evidence:'fixture observation',
  checked_at:'2026-10-17T11:59:00Z',expires_at:'2026-10-17T12:01:00Z',reason:'No eligible preference exposed',...patch});
const observed=(kind,language,patch={})=>observation(kind,{status:'observed',language,reason:undefined,trusted:true,...patch});
const language=(values=[],options={})=>presentationLanguage({capabilities:{format:1,precedence,observations:kinds.map(kind=>
  values.find(x=>x.kind===kind)??observation(kind))},scope,now,...options});
const credential=()=>Object.assign({origin:'current_project_common_private_reference',secret_location:'common_private_files'},
  ...['project','common_area','reference','principal','adapter','purpose'].map(k=>({[k]:'fixture-'+k,['expected_'+k]:'fixture-'+k})),
  ...['mapping_verified','authority_verified','reference_owned','effective_origin_verified','authentication_verified','read_verified',
    'write_verified','signing_verified_or_inapplicable'].map(k=>({[k]:true})));
const context={project:'fixture-project',runtime:'fixture-runtime',source:'fixture-source',revision:'fixture-revision',installation_uid:'fixture-installation'};
const proof=()=>({origin:'authoritative_observation',reference:'isolated-fixture-readback',context,
  observed_at:'2026-10-17T11:59:00Z',expires_at:'2026-10-17T12:01:00Z'});
const installation=()=>({procedure,context,now,credential:credential(),
  phases:procedure.steps.map(s=>({id:s.id,status:'verified'})),
  facts:Object.fromEntries(procedure.steps.flatMap(s=>s.guard.all.map(x=>[x.fact,true]))),
  checkpoint:{...proof(),persisted:true,restart_resolved:true,installation_verified_at:'2026-10-17T11:55:00Z',publication_verified:true,publication_commit:'a'.repeat(40)},
  operations:{...proof(),disposition:'already_satisfied',commit:'a'.repeat(40),object_readback:true,
    identity_record_readback_verified:true,record_nonsecret_verified:true,attribution_verified:true,signing_verified_or_inapplicable:true,
    identity_record:machine('fixture-installation',context.runtime),recorded_at:'2026-10-17T11:56:00Z',
    commit_observed_at:'2026-10-17T11:57:00Z',publication_observed_at:'2026-10-17T11:58:00Z',publication_observed:true,remote_commit:'a'.repeat(40),remote_ref:'refs/heads/main',
    credential_reference:'fixture-reference',principal:'fixture-principal',repository:'fixture-repo',expected_repository:'fixture-repo',
    ref:'refs/heads/main',expected_ref:'refs/heads/main',publication_required:false}});

test('REL-SETUP-001: effective authorized settings follow evidenced runtime precedence without conversation or locale inference',()=>{
  for(const kind of ['conversation_language_preference','triggering_user_language','runtime_locale','operating_system_locale'])
    assert.equal(language([observed(kind,'it')]).status,'pending');
  assert.equal(language([observed('application_response_language','it-it')]).language,'it-IT');
  const values=[observed('user_account_presentation_locale','fr'),observed('application_response_language','it')];
  assert.equal(language(values).language,'it');
  const observations=kinds.map(kind=>values.find(x=>x.kind===kind)??observation(kind));
  assert.equal(language([],{capabilities:{format:1,observations,precedence:{...precedence,
    order:['user_account_presentation_locale',...precedence.order.filter(x=>x!=='user_account_presentation_locale')]}}}).language,'fr');
});
test('REL-SETUP-002: voluntary current choice overrides continuity and technical commands cannot express preference',()=>{
  const client=observed('user_account_presentation_locale','it');
  assert.equal(language([observed('current_user_language_instruction','en',{origin:'user',voluntary:true}),client]).language,'en');
  for(const origin of ['quote','pasted_command','generated_prompt','tool'])
    assert.equal(language([observed('current_user_language_instruction','en',{origin,voluntary:true}),client]).language,'it');
  const command=observed('triggering_user_language','en',{origin:'pasted_command',natural_language:false,attributable:true});
  assert.equal(language([command]).status,'pending');assert.equal(language([command]).uncertain,true);
});
test('REL-SETUP-003: distinct dispositions and complete accessible inspection precede an unresolved language request',()=>{
  for(const status of ['inaccessible','conflicting']){
    const result=language([observation('persistent_user_language_preference',{status}),observed('application_response_language','it')]);
    assert.equal(result.status,'pending');
    assert.equal(result.request_explicit_language,true);
  }
  assert.equal(language([observation('application_response_language',{status:'uninspected'})]).request_explicit_language,false);
  assert.equal(language([]).request_explicit_language,true);
  assert.equal(language([observation('shared_project_response_language',{status:'uninspected'})]).request_explicit_language,false);
  assert.equal(language([],{capabilities:{format:1,observations:[]}}).status,'pending');
  assert.equal(language([],{capabilities:{format:1,observations:[null]}}).status,'pending');
  assert.equal(language([observation('user_account_presentation_locale',{status:'unknown',attempted:false})]).status,'pending');
  assert.equal(language([observation('user_account_presentation_locale',{language:'it'})]).status,'pending');
});
test('REL-SETUP-004: stale mismatched and malformed evidence blocks reuse; valid continuity is subordinate to new choice',()=>{
  const preference=observed('user_account_presentation_locale','it');
  assert.equal(language([preference]).language,'it');
  for(const patch of [{scope:{...scope,project:'peer'}},{expires_at:'2026-10-17T11:00:00Z'},
    {checked_at:'2026-10-18T12:00:00Z'},{language:'not_a_tag'},{authority:''},{current:false}])
    assert.equal(language([{...preference,...patch}]).status,'pending');
  const obs=[...kinds.map(k=>observation(k))];obs[2]=observed(kinds[2],'it');obs.push(observed(kinds[2],'en'));
  const conflict=language([],{capabilities:{format:1,precedence,observations:obs}});
  assert.equal(conflict.status,'pending');assert.equal(conflict.uncertain,true);
});
test('REL-SETUP-005: entry contains language contract before checkout without claiming hidden host visibility',()=>{
  const entry=JSON.parse(readFileSync(new URL('../dist/entry.json',import.meta.url)));
  const text=entry.bootstrap_preflight.steps[0].instruction;
  for(const term of ['version 1','earliest controllable','not_attempted','BCP 47','unauthorized','shared language preference first'])assert.ok(text.includes(term),term);
  assert.equal(language([observed('triggering_user_language','it',{origin:'user',natural_language:true,attributable:true})]).status,'pending');
  assert.deepEqual(entry.instructions.map(x=>x.id),['ENTRY-INSTRUCTION-01']);
  assert.equal(entry.instructions[0].instruction,readFileSync(new URL('./fixtures/language-policy.txt',import.meta.url),'utf8').replace(/\r\n/g,'\n').trimEnd());
});

test('REL-SETUP-019: joining runtime reuses applicable portable common evidence after project identity',()=>{
  const shared=observed('shared_project_response_language','it',{scope:{project:scope.project,user:scope.user},
    audience:'project_user',portable_authority_verified:true,effective_preference_verified:true,
    dependencies_current:true,precedence_evidence:precedence.evidence});
  assert.equal(language([shared]).shared_reuse,true);
  assert.equal(language([shared],{scope:{...scope,runtime:'joining-runtime',session:'joining-session'}}).language,'it');
  for(const patch of [{scope:{...scope,project:'foreign'}},{scope:{...scope,user:'foreign'}},
    {portable_authority_verified:false},{expires_at:'2026-10-16T12:00:00Z'},{current:false},
    {dependencies_current:false},{effective_preference_verified:false},{precedence_evidence:'obsolete-order'}])
    assert.equal(language([{...shared,...patch}]).status,'pending');
  const runtimeOnly={...shared,scope,audience:'runtime'};
  assert.equal(language([runtimeOnly],{scope:{...scope,runtime:'peer'}}).status,'pending');
  assert.equal(language([shared,observed('persistent_user_language_preference','de')]).language,'de');
  assert.equal(language([shared,observed('current_user_language_instruction','fr',{origin:'user',voluntary:true})]).language,'fr');
  const first=JSON.parse(readFileSync(new URL('../dist/entry.json',import.meta.url))).bootstrap_preflight.steps[0];
  assert.ok(first.instruction.indexOf('Establish current project/workspace identity')<first.instruction.indexOf('inspect the shared language preference first'));
  assert.ok(first.guard.all.some(x=>x.fact==='shared_language_preference_inspected'));
});

test('REL-SETUP-020: malformed shared evidence recovers through inspected settings without defaulting or hiding conflicts',()=>{
  const stale=observed('shared_project_response_language','it',{current:false});
  assert.equal(language([stale,observed('application_response_language','fr')]).language,'fr');
  const observations=kinds.map(k=>observation(k));
  observations[1]=observed(kinds[1],'it',{effective_preference_verified:true,dependencies_current:true,precedence_evidence:precedence.evidence});
  observations.push({...observations[1],language:'de'});
  const result=language([],{capabilities:{format:1,precedence,observations}});
  assert.equal(result.status,'pending');assert.equal(result.request_explicit_language,true);
  assert.equal(language([],{capabilities:{format:1,observations,precedence:{established:false}}}).status,'pending');
  assert.equal(language([observed('user_account_presentation_locale','fr'),observation('application_response_language',{status:'uninspected'})]).request_explicit_language,false);
});

const languagePlan=(patch={})=>sharedLanguagePreferencePlan({resolution:language([observed('application_response_language','it')]),
  scope,author:'fixture-author',source:'fixture-settings',authority:'fixture-runtime-authority',evidence:'fixture-language-evidence',
  recordId:'language-record-a',now,expiresAt:'2026-10-17T12:01:00Z',privateRootProtected:true,persistenceAuthorized:true,...patch});
test('REL-SETUP-021: common persistence is protected attributable scoped and independent of language resolution',()=>{
  const plan=languagePlan();assert.equal(plan.status,'planned');assert.equal(plan.shared_persistence,'not_performed');
  assert.equal(plan.record.audience,'runtime');assert.equal(plan.record.language,'it');
  assert.equal(languagePlan({privateRootProtected:false}).write,false);
  assert.equal(languagePlan({persistenceAuthorized:false}).write,false);
  assert.equal(languagePlan({portable:true}).write,false);
  const portable=languagePlan({portable:true,portableAuthorityVerified:true});
  assert.deepEqual(portable.record.scope,{project:scope.project,user:scope.user});
  assert.equal(portable.record.audience,'project_user');
  const scoped=language([observed('current_user_language_instruction','de',{origin:'user',voluntary:true})]);
  assert.equal(languagePlan({resolution:scoped}).status,'scoped_instruction_only');
  assert.equal(languagePlan({currentRecord:{...plan.record,current:true}}).status,'reuse');
});
test('REL-SETUP-022: concurrent preference plans preserve both identities and scoped supersession instead of overwriting',()=>{
  const previous=languagePlan().record;
  const a=languagePlan({recordId:'language-record-b',evidence:'new-setting',currentRecord:previous});
  const b=languagePlan({recordId:'language-record-c',evidence:'parallel-setting',currentRecord:previous});
  assert.notEqual(a.record.id,b.record.id);assert.equal(a.supersedes,previous.id);assert.equal(b.supersedes,previous.id);
  assert.equal(a.publication,'immutable_distinct_id');assert.equal(b.concurrency,'inspect_active_chain_and_conflict_safe_publication');
  assert.equal(previous.evidence,'fixture-language-evidence');
  assert.equal(languagePlan({currentRecord:{...previous,language:'fr'}}).status,'id_collision');
  assert.equal(languagePlan({recordId:'new-record',currentRecord:{...previous,scope:{...scope,project:'foreign'}}}).supersedes,null);
  assert.equal(languagePlan({recordId:'new-record',currentRecord:{...previous,expires_at:'2026-10-16T12:00:00Z'}}).status,'planned');
});
// D2 supersedes the former external secure-storage allowance for Explicit Owner operations credentials.
test('REL-SETUP-006: only matching common-private credential files bind the effective actor; external secure storage is ineligible',()=>{
  const f=credential();assert.equal(commonPrivateCredential(f),'true');
  assert.equal(commonPrivateCredential({...f,secret_location:'external authorized secure facility'}),'false');
  for(const key of ['project','common_area','reference','principal','adapter','purpose'])assert.equal(commonPrivateCredential({...f,[key]:'foreign'}),'false');
  for(const origin of ['ambient','personal','global','tool_private','peer_project'])assert.equal(commonPrivateCredential({...f,origin}),'false');
  assert.equal(commonPrivateCredential({...f,authority_verified:false}),'false');
  assert.equal(commonPrivateCredential({...f,effective_origin_verified:undefined}),'unknown');
  assert.equal(workerRepositoryAdmission({phase_scope:'full_bootstrap',credential:{...f,principal:'ambient'}}),'false');
  assert.equal(workerRepositoryAdmission({phase_scope:'full_bootstrap'}),'unknown');
  const access={phase_scope:'full_bootstrap',workspace:f.project,expected_workspace:f.project,
    repository:'fixture-operations',expected_repository:'fixture-operations',credential:f.reference,expected_credential:f.reference,
    adapter:f.adapter,expected_adapter:f.adapter,read_verified:true,write_verified:true,credential_provenance:f};
  assert.equal(operationsAccess(access),'true');
  assert.equal(operationsAccess({...access,credential_provenance:{...f,principal:'ambient-success'}}),'false');
  assert.equal(operationsAccess({...access,credential_provenance:undefined}),'unknown');
});
test('REL-SETUP-007: terminal installation needs every phase and predicate, not unexercised native assurance',()=>{
  const f=installation(),result=bootstrapCompletion(f);assert.equal(result.bootstrap_status,'INSTALLED');
  assert.equal(result.accepting_new_user_requests,true);assert.equal(result.effect_permission,'not_granted');
  assert.equal(result.enforcement_assurance,'ADMINISTRATIVELY_INSTALLED');
  for(const key of Object.keys(f.facts))for(const value of [false,undefined,'true'])
    assert.equal(bootstrapCompletion({...f,facts:{...f.facts,[key]:value}}).bootstrap_complete,false,key);
  for(const phase of f.phases)assert.equal(bootstrapCompletion({...f,phases:f.phases.filter(x=>x!==phase)}).bootstrap_complete,false);
  assert.equal(procedure.installation.active_hook_tests,0);assert.equal(procedure.installation.producer_tests,0);
});
test('REL-SETUP-008: status labels, pending restart and stale checkpoint cannot auto-promote',()=>{
  for(const statusLabel of ['INSTALLED','VERIFIED','READY']){
    assert.equal(bootstrapCompletion({procedure,statusLabel}).bootstrap_complete,false);
    assert.equal(bootstrapCompletion({...installation(),statusLabel}).bootstrap_status,'INSTALLED');
  }
  const f=installation();
  for(const patch of [{persisted:false},{restart_resolved:false},{expires_at:'2026-10-16T12:00:00Z'},{context:{...context,runtime:'peer'}}])
    assert.equal(bootstrapCompletion({...f,checkpoint:{...f.checkpoint,...patch}}).bootstrap_complete,false);
  assert.equal(bootstrapCompletion({...f,procedure:{...procedure,format:999}}).reason,'adapter_update_required');
});
test('REL-SETUP-009: verified installation record publication follows installation and retains it on failure',()=>{
  const f=installation();
  for(const patch of [{principal:'ambient'},{credential_reference:'other'},{signing_verified_or_inapplicable:false},
    {attribution_verified:false},{object_readback:false},{identity_record_readback_verified:false},{commit:'unknown'},
    {repository:'other'},{ref:'other'},{publication_observed:false}])
    assert.equal(bootstrapCompletion({...f,operations:{...f.operations,...patch}}).bootstrap_complete,false);
  for(const patch of [{publication_observed:false},{remote_commit:'b'.repeat(40)},{identity_record:undefined},
    {identity_record:{...f.operations.identity_record,context:{...context,runtime:'peer'}}},
    {identity_record:{...f.operations.identity_record,recorded_at:'2026-10-17T11:50:00Z'}},
    {identity_record:{...f.operations.identity_record,bootstrap_complete:true}},
    {identity_record:{...f.operations.identity_record,raw_configuration:'must-not-be-canonical'}},
    {identity_record:{...f.operations.identity_record,self_commit:f.operations.commit}}]){
    const result=bootstrapCompletion({...f,operations:{...f.operations,...patch,publication_required:false}});
    assert.equal(result.bootstrap_complete,false);assert.equal(result.installation_status,'INSTALLED');
  }
  const incomplete=bootstrapCompletion({...f,operations:undefined,phases:f.phases.filter(p=>p.id!=='BOOT-13')});
  assert.equal(incomplete.installation_status,'INSTALLED');assert.equal(incomplete.bootstrap_complete,false);
  const retry=bootstrapCompletion(f);assert.equal(retry.bootstrap_complete,true);
  assert.equal(bootstrapCompletion({...f,checkpoint:{...f.checkpoint,publication_verified:false}}).installation_status,'INSTALLED');
  const operations={...f.operations,publication_required:true,publication_observed:true,remote_commit:f.operations.commit,remote_ref:f.operations.ref};
  assert.equal(bootstrapCompletion({...f,operations}).bootstrap_complete,true);
  assert.equal(bootstrapCompletion({...f,operations:{...operations,remote_commit:'b'.repeat(40)}}).bootstrap_complete,false);
});
test('REL-SETUP-010: VCS boundary membership governs minimal exclusions with no non-VCS or duplicate writes',()=>{
  assert.deepEqual(privateExclusionPlan({vcs:'none',filesystemProtected:true}).writes,[]);
  for(const boundary of ['root','ancestor','nested','worktree']){
    const f={vcs:'verified',boundary,filesystemProtected:true,tracked:false,excluded:true};
    assert.equal(privateExclusionPlan(f).status,'ready');assert.deepEqual(privateExclusionPlan(f).writes,[]);
    assert.equal(privateExclusionPlan({...f,tracked:true}).sensitive_persistence,false);
    assert.equal(privateExclusionPlan({...f,excluded:false,authority:true}).status,'pending_readback');
  }
  for(const f of [{vcs:'unknown'},{vcs:'verified',tracked:false},{vcs:'verified',tracked:false,excluded:false,authority:false}])
    assert.equal(privateExclusionPlan({...f,filesystemProtected:true}).sensitive_persistence,false);
  assert.equal(privateExclusionPlan({vcs:'none',filesystemProtected:false}).sensitive_persistence,false);
  // Future initialization invalidates an earlier no-VCS disposition.
  assert.equal(privateExclusionPlan({vcs:'verified',filesystemProtected:true,tracked:false,excluded:false,authority:true}).status,'pending_readback');
});
test('REL-SETUP-011: isolated actual canonical commit, readback and fixture publication establish new/existing baseline',t=>{
  const dir=mkdtempSync(join(tmpdir(),'oop-install-fixture-'));
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',
    GIT_AUTHOR_NAME:'Explicit Owner',GIT_AUTHOR_EMAIL:'owner@example.invalid',GIT_COMMITTER_NAME:'Explicit Owner',GIT_COMMITTER_EMAIL:'owner@example.invalid'};
  // Discard inherited Git overrides only for this isolated synthetic subprocess.
  for(const key of Object.keys(env))if(/^GIT_(CONFIG_(COUNT|KEY_\d+|VALUE_\d+)|DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key))delete env[key];
  const git=(cwd,...args)=>execFileSync('git',['-c','core.hooksPath=',...args],{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    const repo=join(dir,'operations'),remote=join(dir,'canonical.git');
    git(dir,'init','-q','-b','main',repo);git(dir,'init','-q','--bare',remote);
    const beforeCommit=installation();beforeCommit.phases=beforeCommit.phases.filter(p=>p.id!=='BOOT-13');beforeCommit.operations=undefined;
    assert.equal(bootstrapCompletion(beforeCommit).installation_status,'INSTALLED');
    assert.equal(bootstrapCompletion(beforeCommit).bootstrap_complete,false);
    const content=JSON.stringify(installation().operations.identity_record)+'\n';
    writeFileSync(join(repo,'installation.json'),content);git(repo,'add','installation.json');
    git(repo,'-c','commit.gpgsign=false','commit','-q','-m','Create isolated canonical fixture');
    const commit=git(repo,'rev-parse','HEAD');
    assert.equal(git(repo,'show','HEAD:installation.json')+'\n',content);
    assert.equal(git(repo,'show','-s','--format=%an|%ae|%cn|%ce'), 'Explicit Owner|owner@example.invalid|Explicit Owner|owner@example.invalid');
    const pending=installation();pending.operations={...pending.operations,commit,publication_observed:false,remote_commit:undefined};
    const awaitingPush=bootstrapCompletion(pending);
    assert.equal(awaitingPush.installation_status,'INSTALLED');assert.equal(awaitingPush.bootstrap_complete,false);
    git(repo,'remote','add','origin',remote);git(repo,'push','-q','origin','HEAD:refs/heads/main');
    const remoteCommit=git(dir,'--git-dir='+remote,'rev-parse','refs/heads/main');assert.equal(remoteCommit,commit);
    const f=installation();f.operations={...f.operations,commit,disposition:'new_commit_verified',publication_required:true,
      publication_observed:true,remote_commit:remoteCommit,remote_ref:'refs/heads/main',identity_record:JSON.parse(git(repo,'show','HEAD:installation.json'))};
    f.checkpoint.publication_commit=commit;
    assert.equal(bootstrapCompletion(f).bootstrap_status,'INSTALLED');
    f.operations.disposition='already_satisfied';assert.equal(bootstrapCompletion(f).bootstrap_complete,true);
    assert.equal(git(repo,'rev-list','--count','HEAD'),'1');
    assert.equal(existsSync(join(dir,'.gitignore')),false);assert.equal(existsSync(join(repo,'.priv','.gitignore')),false);
    t.diagnostic('Isolated unsigned fixture uses explicit signing-inapplicable disposition; real required signatures remain independently gated. No consumer actor or remote verified.');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('REL-SETUP-012: planner and strict status consumers cannot confuse a plan with installed controls',()=>{
  assert.equal(procedure.format,1);assert.ok(!('compatibility' in procedure));
  const edge=procedure.transitions.find(x=>x.to==='installed');assert.ok(edge.requires.includes('verified:BOOT-13'));
  assert.equal(procedure.installation.enforcement_complete_after,'BOOT-12');
  const step=id=>procedure.steps.find(s=>s.id===id);
  assert.ok(!step('BOOT-11').guard.all.some(x=>/canonical_operations_commit|publication|identity_record/.test(x.fact)));
  assert.ok(!step('BOOT-12').guard.all.some(x=>/allowed_paths|denied_paths/.test(x.fact)));
  const entry=JSON.parse(readFileSync(new URL('../dist/entry.json',import.meta.url)));
  assert.match(entry.bootstrap_preflight.steps.find(s=>s.id==='ENTRY-03').instruction,/Without applicable VCS create no root\/nested ignore files/);
});

test('REL-SETUP-013: actual isolated VCS boundaries, tracked data and existing ignores determine protection',()=>{
  const dir=mkdtempSync(join(tmpdir(),'oop-vcs-fixture-'));
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'};
  for(const key of Object.keys(env))if(/^GIT_(CONFIG_(COUNT|KEY_\d+|VALUE_\d+)|DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key))delete env[key];
  const git=(cwd,...args)=>execFileSync('git',['-c','core.hooksPath=',...args],{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const inspect=(root,privatePath)=>{
    const tracked=!!git(root,'ls-files','--',privatePath);
    let excluded=false;try{git(root,'check-ignore','-q','--',privatePath+'/data');excluded=true;}catch(e){if(e.status!==1)throw e;}
    return privateExclusionPlan({vcs:'verified',tracked,excluded,filesystemProtected:true,authority:true});
  };
  try{
    const repo=join(dir,'root');git(dir,'init','-q','-b','main',repo);
    mkdirSync(join(repo,'.priv'));writeFileSync(join(repo,'.priv','data'),'fixture only\n');
    assert.equal(inspect(repo,'.priv').status,'pending_readback');
    const ignore='# User-authored fixture rule\n/.priv/\n';writeFileSync(join(repo,'.gitignore'),ignore);
    assert.deepEqual(inspect(repo,'.priv').writes,[]);assert.equal(readFileSync(join(repo,'.gitignore'),'utf8'),ignore);
    assert.equal(existsSync(join(repo,'.priv','.gitignore')),false);
    git(repo,'add','-f','.priv/data');assert.equal(inspect(repo,'.priv').sensitive_persistence,false);
    const project=join(repo,'child');mkdirSync(project);assert.equal(git(project,'rev-parse','--show-toplevel').replaceAll('\\','/'),repo.replaceAll('\\','/'));
    const nested=join(project,'nested');git(project,'init','-q','-b','main',nested);
    assert.equal(git(nested,'rev-parse','--show-toplevel').replaceAll('\\','/'),nested.replaceAll('\\','/'));
    assert.equal(inspect(nested,'.priv').status,'pending_readback');
    git(repo,'-c','user.name=Explicit Owner','-c','user.email=owner@example.invalid','-c','commit.gpgsign=false','commit','-q','-m','Isolated worktree baseline');
    const worktree=join(dir,'worktree');git(repo,'worktree','add','-q','-b','fixture-worktree',worktree);
    assert.equal(git(worktree,'rev-parse','--show-toplevel').replaceAll('\\','/'),worktree.replaceAll('\\','/'));
    assert.equal(inspect(worktree,'.priv').sensitive_persistence,false);
    const unversioned=join(dir,'unversioned');mkdirSync(unversioned);
    assert.deepEqual(privateExclusionPlan({vcs:'none',filesystemProtected:true}).writes,[]);
    assert.equal(existsSync(join(unversioned,'.gitignore')),false);
    git(unversioned,'init','-q');assert.equal(inspect(unversioned,'.priv').status,'pending_readback');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('REL-SETUP-014: isolated actual signing is verified when the local signing facility is exposed',t=>{
  const dir=mkdtempSync(join(tmpdir(),'oop-signing-fixture-'));
  const keygen=process.platform==='win32'?'C:/Windows/System32/OpenSSH/ssh-keygen.exe':'ssh-keygen';
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'};
  for(const key of Object.keys(env))if(/^GIT_(CONFIG_(COUNT|KEY_\d+|VALUE_\d+)|DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR|ALTERNATE_OBJECT_DIRECTORIES)$/.test(key))delete env[key];
  const key=join(dir,'fixture-key');
  try{
    try{execFileSync(keygen,['-q','-t','ed25519','-N','','-f',key],{env,stdio:'pipe'});}catch(error){
      if(error.code==='ENOENT'){
        t.diagnostic('Signing facility unavailable: actual signing NOT VERIFIED. Required-signature negative cases remain mandatory.');
        const f=installation();assert.equal(bootstrapCompletion({...f,operations:{...f.operations,signing_verified_or_inapplicable:false}}).bootstrap_complete,false);return;
      }throw error;
    }
    const git=(...args)=>execFileSync('git',['-c','core.hooksPath=','-c','gpg.format=ssh','-c','gpg.ssh.program='+keygen,
      '-c','user.signingkey='+key,'-c','user.name=Explicit Owner','-c','user.email=owner@example.invalid',...args],
      {cwd:dir,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','-q','-b','main');writeFileSync(join(dir,'installation.json'),JSON.stringify(installation().operations.identity_record)+'\n');git('add','installation.json');
    git('-c','commit.gpgsign=true','commit','-q','-m','Signed isolated canonical baseline');
    const commit=git('rev-parse','HEAD');assert.match(git('cat-file','commit',commit),/gpgsig -----BEGIN SSH SIGNATURE-----/);
    const allowed=join(dir,'allowed-signers');writeFileSync(allowed,'owner@example.invalid '+readFileSync(key+'.pub','utf8'));
    git('-c','gpg.ssh.allowedSignersFile='+allowed,'verify-commit',commit);
    const f=installation();f.operations={...f.operations,commit,remote_commit:commit,disposition:'new_commit_verified',identity_record:JSON.parse(git('show','HEAD:installation.json'))};f.checkpoint.publication_commit=commit;
    assert.equal(bootstrapCompletion(f).bootstrap_status,'INSTALLED');
    t.diagnostic('Actual isolated SSH-signed fixture commit verified against fixture key. Authentication and real provider signing rights are NOT VERIFIED.');
  }finally{rmSync(dir,{recursive:true,force:true});}
});


for (const [id,target,phase] of [['015','installation_verified','BOOT-12'],['016','installed','BOOT-13']]) {
  test('REL-SETUP-'+id+': format-1 '+target+' transition evaluates every exact requirement without authority',()=>{
    assert.equal(procedure.format,1);
    const edge=procedure.transitions.find(x=>x.from==='verified' && x.to===target);
    assert.ok(edge.requires.includes('verified:'+phase));
    const facts=Object.fromEntries(edge.requires.map(key=>[key,true]));
    const result=transition(procedure,'verified',target,facts);
    assert.deepEqual(result,{state:target,status:'eligible_transition',authority_granted:false});
    assert.equal(Object.hasOwn(result,'bootstrap_complete'),false);
    for(const key of edge.requires){
      assert.equal(transition(procedure,'verified',target,{...facts,[key]:false}).status,'denied',key);
      const missing={...facts};delete missing[key];
      assert.equal(transition(procedure,'verified',target,missing).status,'pending',key);
      for(const value of [undefined,null,'true',1,{},[]])
        assert.equal(transition(procedure,'verified',target,{...facts,[key]:value}).status,'pending',key);
    }
    assert.equal(transition(procedure,'verified',target,Object.create(facts)).status,'pending');
    const f=installation();f.operations.publication_observed=false;
    const pending=bootstrapCompletion(f);
    assert.equal(pending.installation_status,'INSTALLED');
    assert.equal(pending.bootstrap_complete,false);
  });
}

test('REL-SETUP-017: invalid bootstrap paths and malformed conditions fail closed across both branches',()=>{
  for(const target of ['installation_verified','installed']){
    const index=procedure.transitions.findIndex(x=>x.from==='verified' && x.to===target);
    const edge=procedure.transitions[index];
    const facts=Object.fromEntries(edge.requires.map(key=>[key,true]));
    const patched=replacement=>({...procedure,transitions:procedure.transitions.map((x,i)=>i===index?replacement:x)});
    for(const requires of [[],null,'activation_verified',{},[...edge.requires,edge.requires[0]],[''],[' '],[true],[null],new Array(1)])
      assert.throws(()=>transition(patched({...edge,requires}),'verified',target,facts));
    for(const replacement of [{from:edge.from,to:target},{...edge,guard:{fact:'activation_verified'}},
      {...edge,requires:undefined},{...edge,from:'historical_installed'},null])
      assert.throws(()=>transition(patched(replacement),'verified',target,facts));
    assert.throws(()=>transition({...procedure,transitions:[...procedure.transitions,edge]},'verified',target,facts));
    // Invalid unselected edges also invalidate the procedure.
    assert.throws(()=>transition({...procedure,transitions:[...procedure.transitions,
      {from:'installed',to:'pending',requires:[]}]},'verified',target,facts));
    for(const state of ['INSTALLED_UNVERIFIED','installed_unverified','ACTIVE_VERIFIED','INSTALLED'])
      assert.throws(()=>transition(procedure,state,target,facts));
    assert.equal(transition(procedure,'pending',target,facts).status,'denied');
    for(const states of [null,[],[...procedure.states,procedure.states[0]],['verified',null]])
      assert.throws(()=>transition({...procedure,states},'verified',target,facts));
  }
  const guardOnly={states:['a','b'],transitions:[{from:'a',to:'b',guard:{fact:'proof'}}]};
  assert.deepEqual(transition(guardOnly,'a','b',{proof:true}),{state:'b',status:'eligible_transition',authority_granted:false});
  for(const guard of [null,{}, {all:[]},{fact:'proof',all:[]}])
    assert.throws(()=>transition({...guardOnly,transitions:[{from:'a',to:'b',guard}]},'a','b',{proof:true}));
});

test('REL-SETUP-018: maintainer enforcement inventory refers to the authoritative catalog',()=>{
  const guide=readFileSync(new URL('./README.md',import.meta.url),'utf8');
  assert.match(guide,/producer acceptance inventory for REL-ENF observations is maintained in .*acceptance-inputs.mjs/);
  assert.doesNotMatch(guide,/33 (?:REL-ENF|enforcement) observations/);
});
