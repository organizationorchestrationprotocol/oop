import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {enforcementConfig,generateEnforcement,impact,validateEnforcementImpact} from './enforcement-contract.mjs';
import {route} from './reference-engine.mjs';
import {select,readJSON} from './release-engine.mjs';
import {subjects} from './acceptance-inputs.mjs';
import {validateMigrationBundle} from './migration-contract.mjs';
import {projectMigrationContext,expandMigrationContext} from './migration-context.mjs';
import {preflightArtifacts} from './prune-artifacts.mjs';
const require=createRequire(import.meta.url), engine=require('../dist/oop-enforce.js');
const adapter=require('./enforcement-adapter.cjs');
// Trusted fixture setup, separate from simulated untrusted requests.
const adapterOptions={expectedSourceBinding:structuredClone(engine.config.source_binding)};
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const json=p=>JSON.parse(read(p));
const run=(command,input,extra={})=>spawnSync(process.execPath,['dist/oop-enforce.js',command],{encoding:'utf8',input:typeof input==='string'?input:JSON.stringify(input),...extra});
const clone=x=>structuredClone(x);
const sha=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
function fixture(command='pre-effect',facet='local_write') {
  const scope={classification:'known',request:[facet]};
  const modules=engine.evaluate('interaction',{format:1,request_id:'fixture',scope}).payload.modules;
  const context={project:'fixture-project',runtime:'fixture-runtime',oop_commit:'a'.repeat(40),revision:'revision-1',
    authority:'authority-1',resource:'resource-1',risk:'G0',lifecycle:'active',context_retention:'context-1',
    observed_at:'2026-10-17T12:00:00Z',dependencies:{source:'source-1',adapter:'adapter-1'}};
  const request={format:1,request_id:'fixture',scope,context,effect_class:facet,evidence:{}};
  if(command==='recovery')request.journal={owner:context.runtime,project:context.project,phase:'staged',active:'active-reference',candidate:'candidate-reference',expected_revision:'revision-1'};
  const required=engine.evaluate(command,request).payload.missing??[];
  for(const id of required)request.evidence[id]={value:true,origin:'authoritative_observation',reference:'fixture-observation',
    binding:{...Object.fromEntries(['project','runtime','oop_commit','revision','authority','resource','risk','lifecycle','context_retention'].map(k=>[k,context[k]])),command,selection:modules.join(','),effect_class:facet},
    dependencies:clone(context.dependencies),observed_at:'2026-10-17T11:59:59Z',expires_at:'2026-10-17T12:01:00Z'};
  return request;
}
test('REL-ENF-001: all eight contact points have explicit non-authorizing or admission behavior',()=>{
  assert.deepEqual(Object.keys(engine.config.commands),['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe']);
  for(const cmd of ['entry','interaction'])assert.equal(engine.evaluate(cmd,fixture(cmd)).decision,'unknown');
  assert.equal(engine.evaluate('probe',{format:1,request_id:'probe'}).reason_code,'installed_path_not_verified');
  for(const cmd of ['pre-effect','post-effect','completion','recovery','delegate'])assert.equal(engine.evaluate(cmd,fixture(cmd)).decision,'allow',cmd);
});
test('REL-ENF-002: every admission control rejects false, absent, stale and inferred evidence',()=>{
  for(const cmd of ['pre-effect','post-effect','completion','recovery','delegate']){
    const req=fixture(cmd);assert.ok(Object.keys(req.evidence).length);
    for(const id of Object.keys(req.evidence)){
      let changed=clone(req);changed.evidence[id].value=false;assert.equal(engine.evaluate(cmd,changed).decision,'deny',cmd+id);
      changed=clone(req);delete changed.evidence[id];assert.equal(engine.evaluate(cmd,changed).decision,'unknown');
      changed=clone(req);changed.evidence[id].expires_at=req.context.observed_at;assert.equal(engine.evaluate(cmd,changed).decision,'unknown');
      changed=clone(req);changed.evidence[id].origin='model_assertion';assert.equal(engine.evaluate(cmd,changed).decision,'unknown');
    }
  }
});
test('REL-ENF-003: material scope, resource, authority, revision and runtime changes invalidate evidence',()=>{
  for(const key of ['project','runtime','oop_commit','revision','authority','resource','risk','lifecycle','context_retention']){
    const req=fixture();req.context[key]=key==='oop_commit'?'b'.repeat(40):'different';
    assert.equal(engine.evaluate('pre-effect',req).decision,'unknown',key);
  }
  const req=fixture();req.context.dependencies.adapter='changed';assert.equal(engine.evaluate('pre-effect',req).decision,'unknown');
  req.scope.request.push('durable_write');assert.equal(engine.evaluate('pre-effect',req).decision,'unknown');
});
test('REL-ENF-004: routing exactly preserves reference closure for every facet and conservative unknown',()=>{
  for(const facet of Object.keys(readJSON('routing.json').facets))for(const classification of ['known','unknown']){
    const scope={classification,request:[facet]};
    assert.deepEqual(engine.evaluate('interaction',{format:1,request_id:'route',scope}).payload.modules,select(scope).modules);
  }
  assert.equal(engine.evaluate('interaction',{format:1,request_id:'route',scope:{classification:'known',request:['invented']}}).decision,'error');
});
test('REL-ENF-005: generated mapping covers every complete normative clause without semantic compilation',()=>{
  const trace=json('tools/evidence/release-traceability.json');
  assert.equal(engine.config.contracts.length,trace.clauses.length);
  for(const clause of trace.clauses){
    const mapped=engine.config.contracts.find(c=>c.id===clause.id);assert.equal(mapped.module,clause.module);
    assert.ok(mapped.semantic_residual);assert.ok(mapped.fixture);assert.ok(mapped.evidence);
    assert.deepEqual(mapped.source,readJSON('modules/'+clause.module+'.json').contracts.find(c=>c.id===clause.id).source);
  }
  const context=engine.evaluate('entry',fixture('entry'));assert.equal(context.effect_permission,'not_granted');
  assert.ok(context.payload.modules.includes('core'));assert.equal(context.payload.delivery,'not_verified');
});
test('REL-ENF-006: CLI JSON protocol, negative exits, invalid argv and unknown commands fail closed',()=>{
  for(const cmd of ['pre-effect','post-effect','completion','recovery','delegate']){
    const req=fixture(cmd);let r=run(cmd,req);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).decision,'allow');
    delete req.evidence[Object.keys(req.evidence)[0]];r=run(cmd,req);assert.equal(r.status,3);assert.equal(JSON.parse(r.stdout).decision,'unknown');
  }
  const unknown=run('nonsense',{format:1,request_id:'bad'});assert.equal(unknown.status,4);
  assert.equal(JSON.parse(unknown.stdout).reason_code,'unsupported_command');
  for(const args of [[],['pre-effect','extra']]){
    const result=spawnSync(process.execPath,['dist/oop-enforce.js',...args],{encoding:'utf8'});
    assert.equal(result.status,4);assert.equal(JSON.parse(result.stdout).reason_code,'invalid_arguments');
    assert.equal(JSON.parse(result.stdout).request_id,'invalid_arguments');
    assert.equal(JSON.parse(result.stdout).effect_permission,'not_granted');assert.equal(result.stderr,'');
  }
  const req=fixture();req.evidence.authority_verified.value=false;assert.equal(run('pre-effect',req).status,2);
});
test('REL-ENF-007: bounded input, invalid UTF-8, malformed JSON and parse errors do not leak payload',()=>{
  for(const input of ['{private_secret_value','x'.repeat(1048577),Buffer.from([255])]){
    const r=run('pre-effect',input,{input});assert.equal(r.status,4);assert.doesNotMatch(r.stdout+r.stderr,/private_secret_value/);
  }
  const req=fixture();req.secret='private_secret_value';const r=run('pre-effect',req);
  assert.equal(r.status,4);assert.doesNotMatch(r.stdout+r.stderr,/private_secret_value/);
});
test('REL-ENF-008: thin adapter maps malformed, new, inconsistent, timed-out and failed outputs to prevention',()=>{
  const req=fixture(),good=run('pre-effect',req);assert.equal(adapter.interpret(good,req,'pre-effect',adapterOptions),true);
  for(const patch of [{status:2},{status:null,signal:'SIGTERM'},{stdout:'not-json'},{error:Error('timeout')}])
    assert.equal(adapter.interpret({...good,...patch},req,'pre-effect',adapterOptions),false);
  for(const patch of [{decision:'needs_evidence'},{type:'future'},{format:2},{request_id:'other'},{command:'entry'},{effect_permission:'not_granted'}]){
    const response={...JSON.parse(good.stdout),...patch};
    assert.equal(adapter.interpret({...good,stdout:JSON.stringify(response)},req,'pre-effect',adapterOptions),false);
  }
});
test('REL-ENF-009: actual local adapter allows authorized callback and prevents denied/unknown effects',()=>{
  const dir=mkdtempSync(join(tmpdir(),'oop-engine-'));
  try {
    const file=join(dir,'effect.txt'),req=fixture();
    assert.equal(adapter.guardedEffect(req,()=>writeFileSync(file,'allowed'),adapterOptions).performed,true);assert.equal(readFileSync(file,'utf8'),'allowed');
    for(const value of [false,undefined]){
      const denied=clone(req);denied.evidence.authority_verified.value=value;
      assert.equal(adapter.guardedEffect(denied,()=>writeFileSync(file,'forbidden'),adapterOptions).performed,false);
      assert.equal(readFileSync(file,'utf8'),'allowed');
    }
    assert.equal(adapter.guardedEffect(req,()=>writeFileSync(file,'wrong interpreter'),{...adapterOptions,interpreter:join(dir,'absent')}).performed,false);
    assert.equal(adapter.guardedEffect(req,()=>writeFileSync(file,'timeout'),{...adapterOptions,timeout:1}).performed,false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('REL-ENF-010: BOOT guards and prior verified phase are necessary for progress',()=>{
  const req=fixture('completion');req.bootstrap_step='BOOT-12';
  const unknown=engine.evaluate('completion',req);assert.equal(unknown.decision,'unknown');
  assert.ok(unknown.payload.missing.includes('mandatory_installed_controls_verified'));
  assert.ok(unknown.payload.missing.includes('verified:BOOT-11'));
  req.transition={from:'pending',to:'verified'};assert.equal(engine.evaluate('completion',req).decision,'deny');
  req.transition={from:'applied_pending_verification',to:'verified'};
  assert.ok(engine.evaluate('completion',req).payload.missing.includes('all_applicable_source_criteria_passed'));
});
test('REL-ENF-011: recovery is scoped to owned journal, actual dispatch and ongoing invocations',()=>{
  for(const phase of ['staged','probed','activated_pending_checkpoint','checkpointed','cleanup_pending']){
    const req=fixture('recovery');req.journal.phase=phase;assert.equal(engine.evaluate('recovery',req).decision,'allow');
    delete req.evidence.ongoing_invocations_safe;assert.equal(engine.evaluate('recovery',req).decision,'unknown');
  }
  for(const field of ['owner','project','phase']){
    const req=fixture('recovery');req.journal[field]='foreign';assert.equal(engine.evaluate('recovery',req).decision,'unknown');
  }
});
test('REL-ENF-012: migration impact is explicit, consistent and supports no-engine input without losing profiles',()=>{
  const paths=['index','runtime','operations','compatibility'];
  const bundle=Object.fromEntries(paths.map(p=>['migrations/'+p+'.json',readJSON('migrations/'+p+'.json')]));
  const schema=json('tools/schemas/migration.schema.json');const identity=engine.config.source_binding.source_identity;
  assert.equal(validateMigrationBundle(bundle,schema,identity),true);
  const projected=projectMigrationContext(bundle);
  assert.deepEqual(expandMigrationContext(projected),bundle);
  assert.deepEqual(engine.expandMigrationContext(engine.config.migration_context),bundle);
  assert.ok(Buffer.byteLength(JSON.stringify(projected))<Buffer.byteLength(JSON.stringify(bundle)));
  assert.deepEqual(engine.evaluate('interaction',{format:1,request_id:'migration-context',scope:{classification:'known',request:['due_update']}}).payload.migration_context,projected);
  assert.ok(bundle['migrations/runtime.json'].enforcement.input_states.includes('no_prior_engine'));
  const bad=clone(bundle);delete bad['migrations/runtime.json'].enforcement;assert.throws(()=>validateMigrationBundle(bad,schema,identity));
  const mismatch=clone(bundle);mismatch['migrations/runtime.json'].enforcement.action='blocked_recovery';assert.throws(()=>validateMigrationBundle(mismatch,schema,identity));
  const review=json('tools/release-review.json');
  for(const prior of review.migration_support.accepted_profiles)assert.ok(review.migration_support.profiles.some(p=>p.profile_id===prior.profile_id && p.fingerprint===prior.fingerprint));
});
test('REL-ENF-013: stale controller/contract reviews and contradictory impact block generation',()=>{
  const review=json('tools/release-review.json').enforcement;
  assert.throws(()=>generateEnforcement(engine.config,{...review,implementation_identity:'stale'}));
  assert.throws(()=>generateEnforcement(engine.config,{...review,contract_identity:'stale'}));
  assert.equal(validateEnforcementImpact(impact),true);
  for(const patch of [{changed:false},{category:'UNKNOWN'},{compatibility:'unknown'},{compatibility:'adapter_required',action:'copy-only'}])assert.throws(()=>validateEnforcementImpact({...impact,...patch}));
  const dir=mkdtempSync(join(tmpdir(),'oop-engine-path-'));
  try {
    const expected=['dist/modules/core.json','dist/details/core.json','dist/oop-enforce.js'];
    const plan=expected.map(path=>({path,content:path.endsWith('.js')?'"use strict";\n':'{}\n'}));
    assert.equal(preflightArtifacts(dir,plan,expected).plan.length,3);
    for(const path of ['dist/../oop-enforce.js','dist/unreviewed.js','dist/oop-enforce.js/child'])
      assert.throws(()=>preflightArtifacts(dir,[...plan.slice(0,2),{path,content:'x'}],[...expected.slice(0,2),path]));
    assert.equal(existsSync(join(dir,'dist')),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('REL-ENF-014: standalone artifact is reproducible, source-bound and included in acceptance inventory',()=>{
  const review=json('tools/release-review.json').enforcement;
  assert.equal(generateEnforcement(engine.config,review),read('dist/oop-enforce.js'));
  const dir=mkdtempSync(join(tmpdir(),'oop-module-'));
  try {
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(join(dir,'oop-enforce.js'),read('dist/oop-enforce.js'));
    const copied=spawnSync(process.execPath,[join(dir,'oop-enforce.js'),'probe'],{encoding:'utf8',input:'{"format":1,"request_id":"copy"}'});
    assert.equal(copied.status,3,copied.stderr);assert.equal(JSON.parse(copied.stdout).decision,'unknown');
  } finally {rmSync(dir,{recursive:true,force:true});}
  assert.equal(engine.config.source_binding.source_identity,json('dist/entry.json').source_binding.source_identity);
  assert.ok(subjects(fileURLToPath(root)).includes('dist/oop-enforce.js'));
  const r=spawnSync(process.execPath,['tools/generate-release.mjs'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  assert.equal(generateEnforcement(engine.config,review),read('dist/oop-enforce.js'));
});
test('REL-ENF-015: alternate cwd and parallel invocations cannot write peer checkpoints or retain snapshots',async()=>{
  const {spawn}=await import('node:child_process');
  const req=fixture(),source=read('dist/oop-enforce.js');
  const outputs=await Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,[new URL('../dist/oop-enforce.js',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),'pre-effect'],{cwd:tmpdir()});
    let out='';p.stdout.on('data',s=>out+=s);p.on('error',reject);p.on('close',status=>resolve({status,out}));p.stdin.end(JSON.stringify(req));
  })));
  assert.ok(outputs.every(r=>r.status===0 && JSON.parse(r.out).decision==='allow'));
  assert.equal(read('dist/oop-enforce.js'),source);
  assert.doesNotMatch(source,/require\(['"]node:fs|writeFileSync|mkdirSync|snapshots\//);
});
test('REL-ENF-016: missing interception, completion evidence, uncertain classification and scope prevent false readiness',()=>{
  for(const cmd of ['pre-effect','post-effect','completion','delegate']){
    const req=fixture(cmd);req.evidence.installed_path_verified.value=false;assert.equal(engine.evaluate(cmd,req).decision,'deny');
    req.scope.classification='unknown';assert.equal(engine.evaluate(cmd,req).decision,'unknown');
  }
  const req=fixture();req.effect_class='durable_write';assert.equal(engine.evaluate('pre-effect',req).reason_code,'effect_scope_unresolved');
  assert.equal(engine.evaluate('completion',{format:1,request_id:'empty',scope:{classification:'known',request:['completion']}}).decision,'unknown');
});

test('REL-ENF-017: independent expected binding and strict response envelope gate admission',()=>{
  const req=fixture(),good=run('pre-effect',req);
  assert.equal(adapter.interpret(good,req,'pre-effect'),false);
  for(const expectedSourceBinding of [{}, {...engine.config.source_binding,source_identity:'sha256:'+'f'.repeat(64)}])
    assert.equal(adapter.interpret(good,req,'pre-effect',{expectedSourceBinding}),false);
  const injected={...req,expectedSourceBinding:engine.config.source_binding};
  assert.equal(adapter.guardedEffect(injected,()=>assert.fail('untrusted request authorized')).attempted,false);
  for(const patch of [{source_binding:{...engine.config.source_binding,source_identity:'sha256:'+'e'.repeat(64)}},
    {extra:true},{payload:[]},{payload:{}},{assurance:null},{reason_code:'future'},{decision:'future'}]){
    const changed={...good,stdout:JSON.stringify({...JSON.parse(good.stdout),...patch})};
    assert.equal(adapter.interpret(changed,req,'pre-effect',adapterOptions),false);
  }
  assert.equal(adapter.inspectAdmission(good,req,'pre-effect').reason,'expected_binding_missing_or_invalid');
  assert.equal(adapter.admit({format:1,request_id:''},adapterOptions),false);
  assert.equal(adapter.interpret({...good,stdout:' '.repeat(2*1024*1024)+good.stdout},req,'pre-effect',adapterOptions),false);
  // A caller controlling privileged options is outside this API's trust boundary;
  // the host must authenticate those options, never promote a model assertion.
});
test('REL-ENF-018: callback invocation, pending result, failure and observed readback remain distinct',async()=>{
  const req=fixture();
  const sync=adapter.guardedEffect(req,()=>42,adapterOptions);
  assert.equal(sync.completion,'returned');assert.equal(sync.performed,true);assert.equal(sync.verified,false);
  const thrown=adapter.guardedEffect(req,()=>{throw Error('private failure');},adapterOptions);
  assert.equal(thrown.performed,null);assert.equal(thrown.reason,'unknown_partial_effect');
  let resolveEffect;const deferred=new Promise(resolve=>{resolveEffect=resolve;});
  const pending=adapter.guardedEffect(req,()=>deferred,adapterOptions);
  assert.equal(pending.completion,'pending');assert.equal(pending.performed,null);assert.equal(pending.verified,false);
  resolveEffect(42);assert.equal((await pending.completionResult).completion,'returned');
  const rejected=adapter.guardedEffect(req,()=>Promise.reject(Error('private failure')),adapterOptions);
  assert.equal((await rejected.completionResult).performed,null);
  let backend='before';
  const verified=adapter.guardedEffect(req,()=>{backend='after';},{...adapterOptions,verifyEffect:()=>backend==='after'});
  assert.equal(verified.verified,true);assert.equal(verified.completion,'readback');
  for(const verifyEffect of [()=>false,()=>{throw Error('readback');},async()=>false]){
    const outcome=adapter.guardedEffect(req,()=>42,{...adapterOptions,verifyEffect});
    assert.equal((outcome.completionResult?await outcome.completionResult:outcome).verified,false);
  }
  const asyncVerified=adapter.guardedEffect(req,async()=>42,{...adapterOptions,verifyEffect:async value=>value===42});
  assert.equal((await asyncVerified.completionResult).verified,true);
});
test('REL-ENF-019: diagnostic migration retains deployed and absent controllers with bounded dispositions',()=>{
  assert.equal(impact.prior_engine,'oop-admission-1');
  assert.deepEqual(impact.consumer_dispositions.map(x=>[x.consumer,x.action]),[
    ['no_prior_engine','adapter_update_required'],['exit4_fail_closed','copy-only'],
    ['reason_code_matching','copy-only'],['unknown','blocked_recovery']]);
  assert.equal(validateEnforcementImpact({...impact,changed:false,category:'UNCHANGED',compatibility:'unchanged',action:'copy-only'}),true);
  assert.equal(validateEnforcementImpact({...impact,changed:'unknown',category:'UNKNOWN',compatibility:'unknown',action:'blocked_recovery'}),true);
  // Published reference admitted only exact allow; all exit-4 reasons prevent effects.
  const req=fixture();
  for(const reason_code of ['unsupported_command','invalid_arguments']){
    const response={...engine.evaluate('pre-effect',req),decision:'error',reason_code,effect_permission:'not_granted'};
    assert.equal(adapter.interpret({status:4,stdout:JSON.stringify(response)},req,'pre-effect',adapterOptions),false);
  }
});
test('REL-ENF-020: exact argv reasons survive copied CommonJS and module package contexts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'oop-argv-'));
  try {
    writeFileSync(join(dir,'oop-enforce.js'),read('dist/oop-enforce.js'));
    for(const type of ['commonjs','module']){
      writeFileSync(join(dir,'package.json'),JSON.stringify({type}));
      for(const [args,reason] of [[[],'invalid_arguments'],[['pre-effect','extra'],'invalid_arguments'],[['unknown'],'unsupported_command']]){
        const result=spawnSync(process.execPath,[join(dir,'oop-enforce.js'),...args],{cwd:dir,encoding:'utf8',input:'{"format":1,"request_id":"copy"}'});
        assert.equal(result.status,4,result.stderr);assert.equal(JSON.parse(result.stdout).reason_code,reason);
      }
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});

// Supplied host observations below are producer fixtures, never native-runtime proof.
const deps={source:'source-1',runtime_build:'build-1',permissions:'permissions-1',configuration:'config-1'};
const need=(feature,path,phase)=>({feature,path,phase,minimum_tier:1});
const cap=(id,features,paths,phases,extra={})=>({id,registration:id,fingerprint:'shim-1',features,paths,phases,
  semantics:'preventive_gate',tier:1,available:true,authorized:true,disabled:false,blocking:true,...extra});
const writeNeed=need('pre-effect','files','before_effect');
const writeCap=cap('writes',['pre-effect'],['files'],['before_effect']);

test('REL-ENF-021: optional reviewed activation entries preserve all eight wire contracts',()=>{
  const current=json('dist/interfaces.json').enforcement;
  assert.deepEqual(Object.keys(current.activation_vocabulary),Object.keys(engine.config.commands));
  for(const [name,v] of Object.entries(current.activation_vocabulary)) {
    assert.equal(v.feature,name);assert.equal(engine.config.commands[name].activation_ref,'interfaces.json#enforcement/activation_vocabulary/'+name);
    for(const key of ['phases','source_refs','capability_classes','invalidation','observe'])assert.ok(v[key].length);
    assert.match(v.fallback,/Unknown\/unsupported/);
  }
  assert.equal(current.activation_vocabulary['post-effect'].semantics,'observation');
  assert.equal(current.activation_vocabulary.probe.semantics,'diagnostic');
  assert.deepEqual(current.exit_statuses,{allow:0,deny:2,unknown:3,error:4});
  assert.equal(current.compatibility,'compatible_extension');
  assert.equal(current.consumer_dispositions.find(x=>x.consumer==='unknown').action,'blocked_recovery');
});

test('REL-ENF-022: one compatible registration serves entry plus recovery in source order',()=>{
  const requirements=[need('entry','session','session_entry'),need('recovery','session','session_entry')];
  const plan=adapter.planBindings([cap('session',['entry','recovery'],['session'],['session_entry'],{feature_semantics:{entry:'context_delivery',recovery:'preventive_gate'}})],requirements,deps);
  assert.equal(plan.registrations.length,1);assert.deepEqual(plan.registrations[0].features,['entry','recovery']);
  assert.equal(plan.actions.length,1);assert.equal(plan.status,'INSTALLED_UNVERIFIED');
  const ordinary=adapter.planBindings([cap('session',['entry','recovery'],['session'],['session_entry'],{feature_semantics:{entry:'context_delivery',recovery:'preventive_gate'}})],[requirements[0]],deps);
  assert.deepEqual(ordinary.registrations[0].features,['entry']);
});

test('REL-ENF-023: strongest per-path coverage precedes deduplication and distinct paths stay covered',()=>{
  const a=cap('broad',['pre-effect'],['files','api'],['before_effect']);
  const b=cap('strong',['pre-effect'],['files'],['before_effect'],{tier:3});
  const plan=adapter.planBindings([a,b],[writeNeed,need('pre-effect','api','before_effect')],deps);
  assert.deepEqual(plan.registrations.map(x=>x.registration),['strong','broad']);
  assert.equal(plan.uncovered.length,0);
  const duplicate=adapter.planBindings([writeCap,{...writeCap,id:'alias',registration:'alias'}],[writeNeed],deps);
  assert.equal(duplicate.registrations.length,1);
});

test('REL-ENF-024: observer-only, unsupported, disabled, unauthorized and unknown phases never cover prevention',()=>{
  for(const patch of [{semantics:'observation'},{blocking:false},{available:false},{authorized:false},{disabled:true},{semantics:'unknown'},
    {phases:['after_effect']},{features:['unknown']},{tier:0},{fingerprint:''}]) {
    const plan=adapter.planBindings([{...writeCap,...patch}],[writeNeed],deps);
    assert.equal(plan.status,'BLOCKED_OR_LIMITED');assert.ok(plan.uncovered.length);
    assert.equal(plan.full_readiness,false);
  }
  assert.equal(adapter.planBindings([writeCap],[{...writeNeed,phase:'imaginary'}],deps).reason,'invalid_requirement');
  const plan=adapter.planBindings([writeCap],[writeNeed,need('pre-effect','api','before_effect')],deps);
  assert.equal(plan.registrations.length,1);assert.equal(plan.uncovered[0].path,'api');
});

test('REL-ENF-025: conflicting or corrupt registration metadata is fail-closed',()=>{
  for(const patch of [{fingerprint:'other'},{semantics:'observation'},{phases:['after_effect']}]) {
    const plan=adapter.planBindings([writeCap,{...writeCap,id:'other',...patch}],[writeNeed],deps);
    assert.equal(plan.reason,'conflicting_registration');assert.equal(plan.registrations.length,0);
  }
  for(const dependencies of [{},{...deps,permissions:null}])assert.equal(adapter.planBindings([writeCap],[writeNeed],dependencies).status,'BLOCKED_OR_LIMITED');
});

test('REL-ENF-026: install/readback fixture has zero hook tests and repeat/restart uses scoped actual readback',()=>{
  let hookInvocations=0;
  const first=adapter.planBindings([writeCap],[writeNeed],deps);
  const installed={dependencies:deps,registrations:first.registrations.map(g=>({...g,readback:true}))};
  assert.equal(first.actions[0].operation,'configure_and_readback');assert.equal(first.actions[0].max_attempts,2);
  assert.equal(first.active_hook_tests,0);assert.equal(hookInvocations,0);
  assert.equal(first.status,'INSTALLED_UNVERIFIED');assert.equal(first.full_readiness,false);
  assert.equal(adapter.planBindings([writeCap],[writeNeed],deps,installed).actions[0].operation,'reuse');
  installed.registrations[0].readback=false;
  assert.equal(adapter.planBindings([writeCap],[writeNeed],deps,installed).actions[0].operation,'configure_and_readback');
  assert.match(first.actions[0].on_interruption,/Reconcile/);
  installed.registrations[0].readback=true;
  assert.equal(adapter.planBindings([writeCap],[writeNeed],{...deps,runtime_build:'new'},installed).actions[0].operation,'configure_and_readback');
});

test('REL-ENF-027: installation outcome never advances full BOOT guards or safe G0 routing',()=>{
  const bootstrap=readJSON('procedures/bootstrap.json');
  assert.equal(bootstrap.installation.status,'INSTALLED_UNVERIFIED');
  assert.equal(bootstrap.installation.active_hook_tests,0);assert.equal(bootstrap.installation.producer_tests,0);
  assert.equal(bootstrap.installation.effect_permission,'not_granted');
  assert.ok(bootstrap.transitions.some(x=>x.to==='installed_unverified'));
  assert.ok(!bootstrap.transitions.some(x=>x.from==='installed_unverified' && x.to==='verified'));
  for(const fact of ['mandatory_installed_controls_verified','all_applicable_phases_verified'])
    assert.ok(bootstrap.steps[12].guard.all.some(x=>x.fact===fact));
  const req=fixture('completion');req.bootstrap_step='BOOT-13';
  assert.equal(engine.evaluate('completion',req).decision,'unknown');
  assert.ok(!select({classification:'known',request:['information']}).modules.includes('capabilities'));
  assert.ok(!bootstrap.steps[11].action.includes('probe'));
});

test('REL-ENF-028: deferred assurance requires current negative-path proof; first allow is insufficient',()=>{
  for(const patch of [{dispatch_verified:true},{dispatch_verified:true,denial_verified:true,dependencies_current:false}])
    assert.equal(adapter.planBindings([{...writeCap,...patch}],[writeNeed],deps).status,'INSTALLED_UNVERIFIED');
  const verified={...writeCap,dispatch_verified:true,denial_verified:true,dependencies_current:true};
  const options={now:Date.parse('2026-10-17T12:00:00Z'),scope:{project:'fixture-project',runtime:'fixture-runtime',authority:'fixture-authority',revision:'fixture-revision'}};
  verified.assurance_evidence={origin:'authoritative_observation',reference:'fixture:installed-path',dependencies:deps,
    scope:options.scope,invocation:adapter.planBindings([writeCap],[writeNeed],deps).registrations[0].invocation,
    coverage:[writeNeed],observed_at:'2026-10-17T11:00:00Z',expires_at:'2026-10-17T13:00:00Z',dispatch_verified:true,denial_verified:true};
  const plan=adapter.planBindings([verified],[writeNeed],deps,{},options);
  assert.equal(plan.status,'ACTIVE_VERIFIED');assert.equal(plan.full_readiness,false);
  assert.equal(adapter.planBindings([{...verified,assurance_evidence:{...verified.assurance_evidence,denial_verified:false}}],[writeNeed],deps,{},options).status,'INSTALLED_UNVERIFIED');
  // Current actual effect authority is still independently checked by the controller.
  const req=fixture();req.evidence.authority_verified.value=false;
  assert.equal(adapter.guardedEffect(req,()=>assert.fail('denied callback'),adapterOptions).attempted,false);
});

test('REL-ENF-029: shared dispatch retains every failure despite a later success and handles cancellation',async()=>{
  const req=fixture('pre-effect');const completion=fixture('completion');
  const group={features:['completion','pre-effect'],semantics:'preventive_gate'};
  const requests={'pre-effect':req,completion};
  for(const kind of ['deny','unknown','malformed','timeout','cancel']) {
    const calls=[];
    const outcome=await adapter.dispatchBinding(group,requests,{...adapterOptions,expectedBinding:group,invoke:async(command,input)=>{
      calls.push(command);
      if(command==='pre-effect') {
        if(kind==='timeout')throw Error('timeout');
        if(kind==='cancel')return {signal:'SIGTERM',stdout:''};
        if(kind==='malformed')return {status:0,stdout:'invalid'};
        const changed=clone(input);
        if(kind==='deny')changed.evidence.authority_verified.value=false;else delete changed.evidence.authority_verified;
        return run(command,changed);
      }
      return run(command,input);
    }});
    assert.deepEqual(calls,['pre-effect','completion']);assert.equal(outcome.dependent_effect_permitted,false);
    assert.notEqual(outcome.decision,'allow');assert.equal(outcome.results[1].decision,'allow');
    if(kind==='deny')assert.equal(outcome.results[0].decision,'deny');
  }
});

test('REL-ENF-030: actual controller responses in shared dispatch preserve strict trusted binding and unknown residuals',async()=>{
  const group={features:['entry','recovery'],semantics:'preventive_gate'};
  const requests={entry:fixture('entry'),recovery:fixture('recovery')};
  const outcome=await adapter.dispatchBinding(group,requests,{...adapterOptions,expectedBinding:group,event:{recovery_required:true},invoke:(command,input)=>run(command,input)});
  assert.equal(outcome.results.length,2);assert.equal(outcome.results[0].reason,'needs_semantic_judgment');
  assert.equal(outcome.dependent_effect_permitted,false);
  const ordinary=await adapter.dispatchBinding(group,requests,{...adapterOptions,expectedBinding:group,event:{recovery_required:false},invoke:(c,r)=>run(c,r)});
  assert.deepEqual(ordinary.results.map(r=>r.command),['entry']);
  const invalid=await adapter.dispatchBinding(group,requests,{invoke:()=>assert.fail('must not dispatch')});
  assert.equal(invalid.decision,'error');
  const write=fixture();
  const writeBinding={features:['pre-effect'],semantics:'preventive_gate'};
  const valid=await adapter.dispatchBinding(writeBinding,{'pre-effect':write},{...adapterOptions,expectedBinding:writeBinding,invoke:(c,r)=>run(c,r)});
  const skipped=await adapter.dispatchBinding(writeBinding,{'pre-effect':write},{...adapterOptions,expectedBinding:{...writeBinding,features:['pre-effect','completion']},invoke:()=>assert.fail('skipped mandatory feature')});
  assert.equal(skipped.dependent_effect_permitted,false);
  assert.equal(valid.dependent_effect_permitted,true);
});

test('REL-ENF-031: unchanged known wire readers ignore optional metadata while unknown parsers remain blocked',()=>{
  const req=fixture(),result=run('pre-effect',req);
  assert.equal(adapter.interpret(result,req,'pre-effect',adapterOptions),true);
  const current=json('dist/interfaces.json').enforcement;
  const without=clone(current);delete without.activation_vocabulary;
  for(const name of Object.keys(without.commands))delete without.commands[name].activation_ref;
  // Legacy readers select only the established wire fields and required predicates.
  assert.deepEqual(without.schemas,current.schemas);
  for(const name of Object.keys(current.commands))assert.deepEqual(without.commands[name].required,current.commands[name].required);
  assert.equal(current.consumer_dispositions.find(c=>c.consumer==='unknown').compatibility,'unknown');
});

test('REL-ENF-032: bootstrap migration is install-only while verified activation retains native requirements',()=>{
  const descriptor=readJSON('migrations/runtime.json').enforcement;
  assert.ok(descriptor.actions.includes('install_and_readback_without_hook_tests'));
  assert.ok(!descriptor.actions.includes('probe_allowed_and_denied'));
  for(const fact of ['installed_allow','installed_deny','actual_dispatch','checkpoint_coherence'])assert.ok(descriptor.verification.includes(fact));
  assert.match(descriptor.installation_status,/no verified checkpoint advancement/);
  assert.equal(descriptor.retention,'one active plus at most one ordinary transient candidate; no historical snapshots');
});


test('REL-ENF-033: shared invocation timeout is bounded and recovery precedes dependent admission',async()=>{
  const group={features:['pre-effect','recovery'],semantics:'preventive_gate'};
  const requests={'pre-effect':fixture(),recovery:fixture('recovery')};
  const calls=[];
  const result=await adapter.dispatchBinding(group,requests,{...adapterOptions,expectedBinding:group,
    event:{recovery_required:true},timeoutMs:5,invoke:command=>{
      calls.push(command);return command==='recovery'?new Promise(()=>{}):run(command,requests[command]);
    }});
  assert.deepEqual(calls,['recovery','pre-effect']);assert.equal(result.decision,'error');
  assert.equal(result.dependent_effect_permitted,false);
  const cancelled=await adapter.dispatchBinding(group,requests,{...adapterOptions,expectedBinding:group,
    event:{recovery_required:true},signal:AbortSignal.abort(),invoke:()=>assert.fail('cancelled invocation')});
  assert.equal(cancelled.decision,'error');assert.equal(cancelled.dependent_effect_permitted,false);
  const vocabulary=json('dist/interfaces.json').enforcement.activation_vocabulary;
  assert.ok(vocabulary.recovery.priority<vocabulary['pre-effect'].priority);
  const completion=fixture('completion'),bindingGroup={features:['completion','pre-effect'],semantics:'preventive_gate'};
  const malformed=await adapter.dispatchBinding(bindingGroup,{'pre-effect':fixture(),completion},{...adapterOptions,
    expectedBinding:bindingGroup,invoke:(command,input)=>{
      const raw=run(command,input);if(command==='completion'){
        const response=JSON.parse(raw.stdout);response.payload={};raw.stdout=JSON.stringify(response);
      }return raw;
    }});
  assert.equal(malformed.decision,'error');assert.equal(malformed.dependent_effect_permitted,false);
});


// All capability/evidence records in these tests are synthetic privileged host fixtures.
const scopedRoles={entry:'context_delivery',interaction:'context_delivery','pre-effect':'preventive_gate','post-effect':'observation',completion:'completion_blocking',recovery:'preventive_gate',delegate:'preventive_gate',probe:'diagnostic'};
const phases={entry:'session_entry',interaction:'user_interaction','pre-effect':'before_effect','post-effect':'after_effect',completion:'before_completion',recovery:'resume_before_effect',delegate:'delegate_finish',probe:'diagnostic_after_bootstrap'};
const probeNeed=need('probe','diagnostic-path',phases.probe);
const probeCap=cap('diagnostic',['probe'],['diagnostic-path'],[phases.probe],{semantics:'diagnostic'});
const diagnosticScope={project:'fixture-project',runtime:'fixture-runtime',authority:'fixture-authority',revision:'fixture-revision'};
const diagnosticContext=()=>({lifecycle:'post_bootstrap',scope:{...diagnosticScope},diagnostics:[{
  origin:'authoritative_observation',authorized:true,max_invocations:1,need_reference:'fixture:actual-failure',
  authorization_reference:'fixture:scoped-consent',scope:{...diagnosticScope},dependencies:{...deps},requirement:{...probeNeed}}]});

test('REL-ENF-034: every feature requires its reviewed semantic role and blocking guarantee',()=>{
  for(const [feature,semantics] of Object.entries(scopedRoles).filter(([f])=>f!=='probe')) {
    const requirement=need(feature,'path',phases[feature]);
    const capability=cap(feature,[feature],['path'],[phases[feature]],{semantics});
    assert.equal(adapter.planBindings([capability],[requirement],deps).uncovered.length,0,feature);
    for(const wrong of [...new Set(Object.values(scopedRoles))].filter(role=>role!==semantics && !(feature==='completion' && role==='preventive_gate')))
      assert.equal(adapter.planBindings([{...capability,semantics:wrong}],[requirement],deps).uncovered.length,1,feature+':'+wrong);
    if(['pre-effect','completion','recovery','delegate'].includes(feature))
      assert.equal(adapter.planBindings([{...capability,blocking:false}],[requirement],deps).uncovered.length,1);
  }
  const legacy=cap('legacy',['completion'],['path'],[phases.completion]);
  assert.equal(adapter.planBindings([legacy],[need('completion','path',phases.completion)],deps).uncovered.length,0);
});

test('REL-ENF-035: explicit composite roles share one registration across phases without losing failures',async()=>{
  const requirements=[need('post-effect','path','after_effect'),need('pre-effect','path','before_effect')];
  const capability=cap('shared',['pre-effect','post-effect'],['path'],['before_effect','after_effect'],{
    semantics:'observation',feature_semantics:{'pre-effect':'preventive_gate','post-effect':'observation'}});
  const plan=adapter.planBindings([capability],requirements,deps);
  assert.equal(plan.registrations.length,1);assert.equal(plan.actions.length,1);
  assert.equal(plan.registrations[0].coverage.length,2);
  const group=plan.registrations[0],req=fixture();req.evidence.authority_verified.value=false;
  const result=await adapter.dispatchBinding(group,{'pre-effect':req,'post-effect':fixture('post-effect')},{...adapterOptions,
    expectedBinding:clone(group),invoke:(c,r)=>run(c,r)});
  assert.equal(result.results[0].decision,'deny');assert.equal(result.results[1].decision,'allow');
  assert.equal(result.decision,'deny');assert.equal(result.dependent_effect_permitted,false);
});

test('REL-ENF-036: malformed composite metadata and conflicting invocation provenance fail closed',()=>{
  for(const feature_semantics of [null,[],{}, {'pre-effect':['preventive_gate','observation']},
    {'pre-effect':'unknown'},{'pre-effect':'preventive_gate',entry:'context_delivery'}])
    assert.equal(adapter.planBindings([{...writeCap,feature_semantics}],[writeNeed],deps).status,'BLOCKED_OR_LIMITED');
  const contradict={...writeCap,semantics:'observation',feature_semantics:{'pre-effect':'preventive_gate'}};
  assert.equal(adapter.planBindings([contradict],[writeNeed],deps).uncovered.length,1);
  for(const patch of [{scope:'foreign'},{provenance:'different-host'},{blocking:false},{paths:['other']}])
    assert.equal(adapter.planBindings([writeCap,{...writeCap,id:'alias',...patch}],[writeNeed],deps).reason,'conflicting_registration');
  const observer={...writeCap,id:'observer',registration:'observer',tier:9,semantics:'observation'};
  assert.equal(adapter.planBindings([observer,writeCap],[writeNeed],deps).registrations[0].registration,'writes');
  const broad={...writeCap,paths:['files','api']},strong={...writeCap,id:'strong',registration:'strong',tier:3};
  const plan=adapter.planBindings([broad,strong],[writeNeed,need('pre-effect','api','before_effect')],deps);
  assert.deepEqual(plan.registrations.find(g=>g.registration==='writes').coverage.map(r=>r.path),['api']);
});

test('REL-ENF-037: installed assurance needs attributable current coverage beyond legacy flags',()=>{
  const options={now:Date.parse('2026-10-17T12:00:00Z'),scope:{project:'fixture-project',runtime:'fixture-runtime',authority:'fixture-authority',revision:'fixture-revision'}};
  const evidence={origin:'authoritative_observation',reference:'fixture:path-proof',dependencies:deps,scope:options.scope,
    invocation:adapter.planBindings([writeCap],[writeNeed],deps).registrations[0].invocation,coverage:[writeNeed],
    observed_at:'2026-10-17T11:00:00Z',expires_at:'2026-10-17T13:00:00Z',dispatch_verified:true,denial_verified:true};
  const capability={...writeCap,dispatch_verified:true,denial_verified:true,dependencies_current:true};
  assert.equal(adapter.planBindings([capability],[writeNeed],deps,{},options).status,'INSTALLED_UNVERIFIED');
  for(const patch of [{reference:''},{origin:'model'},{scope:{...options.scope,project:'other'}},{invocation:{}},{dependencies:{...deps,permissions:'other'}},{coverage:[]},
    {observed_at:'2026-10-17T12:01:00Z'},{expires_at:'2026-10-17T12:00:00Z'},{denial_verified:false},{dispatch_verified:false}])
    assert.equal(adapter.planBindings([{...capability,assurance_evidence:{...evidence,...patch}}],[writeNeed],deps,{},options).status,'INSTALLED_UNVERIFIED');
  assert.equal(adapter.planBindings([{...capability,assurance_evidence:evidence}],[writeNeed],deps).status,'INSTALLED_UNVERIFIED');
});

test('REL-ENF-038: diagnostic planning requires scoped host intent after bootstrap and diagnostic semantics',()=>{
  const good=diagnosticContext();
  const plan=options=>adapter.planBindings([probeCap],[probeNeed],deps,{},options);
  assert.equal(plan(good).status,'DIAGNOSTIC_PLANNED');
  for(const options of [{},{...good,lifecycle:'bootstrap'},{...good,scope:{...good.scope,project:'other'}},
    {...good,diagnostics:[...good.diagnostics,...good.diagnostics]}])assert.equal(plan(options).uncovered.length,1);
  for(const patch of [{authorized:false},{authorized:'unknown'},{max_invocations:2},{origin:'model'},
    {need_reference:''},{authorization_reference:''},{scope:{...diagnosticScope,revision:'old'}},
    {dependencies:{...deps,runtime_build:'other'}},{requirement:{...probeNeed,path:'other'}}])
    assert.equal(plan({...good,diagnostics:[{...good.diagnostics[0],...patch}]}).uncovered.length,1);
  for(const semantics of ['observation','preventive_gate','context_delivery','completion_blocking'])
    assert.equal(adapter.planBindings([{...probeCap,semantics}],[probeNeed],deps,{},good).uncovered.length,1);
  assert.equal(adapter.planBindings([probeCap],[{...probeNeed,phase:'session_entry'}],deps,{},good).reason,'invalid_requirement');
});

test('REL-ENF-039: diagnostic plans create no registration actions, readiness or implicit invocation',()=>{
  const options=diagnosticContext();let invocations=0;
  options.invoke=()=>{invocations++;};
  const first=adapter.planBindings([probeCap],[probeNeed],deps,{},options);
  assert.equal(first.registrations.length,0);assert.equal(first.actions.length,0);assert.equal(first.active_hook_tests,0);
  assert.equal(first.full_readiness,false);assert.equal(first.diagnostic_plans[0].effect_permission,'not_granted');
  const repeated=adapter.planBindings([probeCap],[probeNeed],deps,{dependencies:deps,registrations:[]},options);
  assert.deepEqual(repeated,first);assert.equal(invocations,0);
  const mixed=adapter.planBindings([probeCap,writeCap],[probeNeed,writeNeed],deps,{},options);
  assert.equal(mixed.registrations.length,1);assert.deepEqual(mixed.registrations[0].features,['pre-effect']);
  assert.equal(mixed.actions.length,1);assert.equal(mixed.diagnostic_plans.length,1);
  const unauthorized=adapter.planBindings([probeCap,writeCap],[probeNeed,writeNeed],deps);
  assert.deepEqual(unauthorized.uncovered,[probeNeed]);assert.equal(unauthorized.registrations.length,1);
});

test('REL-ENF-040: diagnostic dispatch rechecks trusted intent and preserves unknown non-authorizing wire output',async()=>{
  const context=diagnosticContext();
  const group=adapter.planBindings([probeCap],[probeNeed],deps,{},context).diagnostic_plans[0];
  const request={format:1,request_id:'fixture-probe'};let invoked=0;
  const options={...adapterOptions,expectedBinding:clone(group),planningContext:context,invoke:(c,r)=>{invoked++;return run(c,r);}};
  const result=await adapter.dispatchBinding(group,{probe:request},options);
  assert.equal(invoked,1);assert.equal(result.decision,'unknown');assert.equal(result.results[0].reason,'installed_path_not_verified');
  assert.equal(result.dependent_effect_permitted,false);
  const raw=run('probe',request);assert.equal(raw.status,3);assert.equal(JSON.parse(raw.stdout).effect_permission,'not_granted');
  for(const planningContext of [undefined,{...context,lifecycle:'bootstrap'},{...context,scope:{...context.scope,runtime:'other'}}]) {
    const blocked=await adapter.dispatchBinding(group,{probe:request},{...options,planningContext,invoke:()=>assert.fail('unauthorized diagnostic')});
    assert.equal(blocked.decision,'error');assert.equal(blocked.dependent_effect_permitted,false);
  }
  const wrongRole={...group,semantics:'observation',feature_semantics:{probe:'observation'}};
  assert.equal((await adapter.dispatchBinding(wrongRole,{probe:request},{...options,expectedBinding:wrongRole})).decision,'error');
  const masquerade={features:['probe'],semantics:'diagnostic'};
  assert.equal((await adapter.dispatchBinding(masquerade,{probe:request},{...options,expectedBinding:masquerade})).decision,'error');
});

test('REL-ENF-041: role changes invalidate readback while explicit matching role metadata reuses safely',()=>{
  const first=adapter.planBindings([writeCap],[writeNeed],deps);
  const installed={dependencies:deps,registrations:first.registrations.map(g=>({...g,readback:true}))};
  assert.equal(adapter.planBindings([writeCap],[writeNeed],deps,JSON.parse(JSON.stringify(installed))).actions[0].operation,'reuse');
  delete installed.registrations[0].feature_semantics;
  assert.equal(adapter.planBindings([writeCap],[writeNeed],deps,installed).actions[0].operation,'configure_and_readback');
  assert.equal(first.full_readiness,false);assert.equal(first.status,'INSTALLED_UNVERIFIED');
});
