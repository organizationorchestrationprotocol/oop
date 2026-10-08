import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { makeController,gitSynchronize,reminder } = require('./context-controller.cjs');
const distributed = require('../dist/oop-enforce.js');
const adapter = require('../examples/native-context-adapter.cjs');
const manifest = require('../dist/enforcement-install.json');
const api = require('../dist/interfaces.json').enforcement;
const examplePath = fileURLToPath(new URL('../examples/native-context-adapter.cjs',import.meta.url));
const enginePath = fileURLToPath(new URL('../dist/oop-enforce.js',import.meta.url));
const target = 'a'.repeat(40);
const fixedTime = new Date('2026-02-03T09:00:00Z');
const event = (type,chat='test-chat') => ({event:type,chat});
const record = (current,overrides={})=>({...event('record'),request_id:'request-1',subject:'subject-1',turn:current.turn,
  expected_version:current.version,state:'inquiry',level:'G0',related_ticket:false,facets:['information'],relation:'independent',...overrides});

function installTemplate(w) {
  const entry=path.join(w.owned,'oop-runtime-adapter.js');
  fs.mkdirSync(path.join(w.checkout,'dist'),{recursive:true});
  const controller=path.join(w.checkout,'dist','oop-enforce.js');fs.copyFileSync(enginePath,controller);
  fs.writeFileSync(w.locator,JSON.stringify({...w.registration,source:undefined}));
  let source=fs.readFileSync(new URL('../dist/templates/oop-runtime-adapter.js',import.meta.url),'utf8');
  const response={stdout:'{"context":{{context}}}',stderr:'',exit_code:0};
  const manifest={schema_version:1,host:'fixture',runtime_version:'1',documentation:[{source:'fixture://native-vector',section:'bounded input'}],
    invocation_basis:'structured vector fixture',continuation_basis:'zero exit fixture',nonblocking_exit_codes:[0],
    placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'}},
    supported_commands:{session_open:{session_open:response},prompt:{prompt:response}}};
  for(const [name,body]of Object.entries({manifest:JSON.stringify(manifest),decodeEvent:"return {native_event:raw.event,event:{event:raw.event,chat:raw.chat,...(raw.cwd===undefined?{}:{cwd:raw.cwd})}};"}))
    source=source.replace(new RegExp('(?<=// OOP-EDIT-BEGIN '+name+')[\\s\\S]*?(?=// OOP-EDIT-END '+name+')'),'\n'+body+'\n');
  fs.writeFileSync(entry,source);
  return {entry,controller,call:(mode,input)=>spawnSync(process.execPath,[controller,w.owned,mode==='native'?'enforcement':mode],{input:typeof input==='string'?input:JSON.stringify(input),encoding:'utf8',timeout:10000})};
}

function workspace(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'oop context-')));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const owned = path.join(root,'.priv','tools','runtime','install');
  const checkout = path.join(root,'.priv','common','oop');
  const operations = path.join(root,'operations');
  for (const directory of [owned,checkout,operations]) fs.mkdirSync(directory,{recursive:true});
  const registration = {format:1,interface:'oop-context-1',installation_uid:'install',project_root:root,owned_scope:owned,
    lifecycle:'active',filesystem_local:true,source:{url:'test-source',remote:'origin',ref:'refs/heads/main'}};
  const locator = path.join(owned,'oop-context-registration.json');
  return {root,owned,checkout,operations,registration,locator};
}

test('REL-CTX-001: distributed contact points always return contextual continuation',t=>{
  const w = workspace(t);
  fs.writeFileSync(w.locator,JSON.stringify({...w.registration,source:undefined}));
  function call(command,input,controller=enginePath) {
    const run = spawnSync(process.execPath,[controller,w.owned,command],{input,encoding:'utf8',timeout:6000});
    assert.equal(run.status,command==='prompt'?0:1,run.stderr);
    return JSON.parse(run.stdout);
  }
  const nativeEvents = adapter(process.execPath,enginePath,w.locator)["hooks"];
  assert.deepEqual(Object.keys(nativeEvents),['SessionStart','UserPromptSubmit']);
  const prior = {"hooks":{PreToolUse:[{matcher:'owned',mechanism:'owned'}, {matcher:'peer',mechanism:'unrelated'}]},other:'unchanged'};
  const owned = [{event:'PreToolUse',definition:prior["hooks"].PreToolUse[0]}];
  const migrated = adapter.reconcile(prior,{"hooks":nativeEvents},owned);
  assert.equal(migrated.other,'unchanged');
  assert.deepEqual(migrated["hooks"].PreToolUse,[prior["hooks"].PreToolUse[1]]);
  assert.throws(()=>adapter.reconcile(migrated,{"hooks":nativeEvents},owned),/Owned definition changed/);
  assert.ok(manifest.features.every(feature=>feature.role==='context_delivery' && !feature.blocking_required));
  assert.equal(manifest.controller_interface,api.interface);
  assert.deepEqual(api.contact_points,['enforcement','session_open','prompt','record','snapshot','errors-read','errors-ack']);
  assert.equal(Object.hasOwn(manifest.runtime_adapter,'host_examples'),false);
  const installed=installTemplate(w);
  for (const type of ['session_open','prompt']) {
    for (const payload of ['malformed',JSON.stringify({event:type,chat:'chat',cwd:w.root,prompt:'raw-secret'})]) {
      const run = installed.call('native',payload);
      assert.equal(run.status,0,run.stderr);
      const result = JSON.parse(run.stdout);
      assert.ok(result.context || result.unavailable);
      assert.ok(!run.stdout.includes('raw-secret'));
    }
  }
  assert.equal(call('prompt',JSON.stringify(event('prompt'))).type,'oop_context');
  assert.equal(call('pre-effect','{}').type,'oop_context');
  fs.writeFileSync(path.join(w.root,'package.json'),'{"type":"module"}');
  const copied = path.join(w.root,'controller.js');
  fs.copyFileSync(enginePath,copied);
  assert.equal(call('context',JSON.stringify(event('prompt')),copied).type,'oop_context');
});

test('REL-CTX-002: bootstrap skips daily operations and history',t=>{
  const w = workspace(t);
  const engine = makeController(distributed.config,()=>assert.fail('bootstrap synchronized'));
  const result = engine.compose({...w.registration,lifecycle:'bootstrapping'},event('prompt'),fixedTime);
  assert.equal(result.context.status,'bootstrap_or_inactive');
  assert.equal(result.context.procedure.availability,'unavailable');
  assert.ok(result.context.procedure.lifecycle.bootstrap.endsWith('bootstrap.json'));
  assert.ok(!fs.existsSync(path.join(w.owned,'context')));
  assert.ok(!fs.existsSync(path.join(w.root,'.priv','common','oop-daily.json')));
});

test('REL-CTX-003: first eligible event synchronizes once and hands off owned migration',t=>{
  const w = workspace(t);
  for (const artifact of ['procedures/lifecycle.json','migrations/index.json']) {
    const destination = path.join(w.checkout,'dist',artifact);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(new URL('../dist/'+artifact,import.meta.url),destination);
  }
  let attempts = 0;
  const engine = makeController(distributed.config,(location,source)=>{
    assert.equal(location,w.checkout);
    assert.deepEqual(source,w.registration.source);
    attempts++;
    return target;
  });
  const first = engine.compose(w.registration,event('session_open'),fixedTime).context;
  assert.equal(first.freshness.status,'synchronized');
  assert.equal(first.migration.status,'runtime_reconciliation_required');
  assert.equal(first.migration.target,target);
  assert.equal(first.migration.scopes.runtime.disposition,'not_required');
  assert.equal(first.module_basis,'candidate_target_requires_adoption');
  assert.match(first.migration.index,/migrations[/\\]index\.json$/);
  assert.match(first.migration.instruction,/Execute the applicable adoption and migration procedures/);
  const checkpoint = path.join(w.owned,'checkpoint.json');
  fs.writeFileSync(checkpoint,JSON.stringify({installation_uid:'install',verified_commit:target,applied_commit:target,verification_ref:'local-observation'}));
  const next = engine.compose({...w.registration,adoption_checkpoint:checkpoint},event('prompt'),fixedTime).context;
  assert.equal(next.migration.status,'owned_checkpoint_reports_target');
  assert.equal(attempts,1);
  assert.equal(engine.compose(w.registration,event('prompt'),new Date('2026-02-04T12:00Z')).context.freshness.status,'synchronized');
  assert.equal(attempts,2);
});

test('REL-CTX-004: daily contention and failure preserve successful evidence',t=>{
  const w = workspace(t);
  const lock = path.join(w.root,'.priv','common','oop-checkout.lock');
  fs.writeFileSync(lock,'observed-writer');
  let attempts = 0;
  const engine = makeController(distributed.config,()=>{
    if (++attempts > 1) throw Error('network');
    return target;
  });
  const open = event('session_open');
  assert.equal(engine.compose(w.registration,open,fixedTime).context.freshness.status,'busy');
  assert.equal(fs.readFileSync(lock,'utf8'),'observed-writer');
  fs.unlinkSync(lock);
  engine.compose(w.registration,open,fixedTime);
  const tomorrow = new Date('2026-02-04T12:00Z');
  const result = engine.compose(w.registration,open,tomorrow).context;
  assert.equal(result.freshness.status,'failed');
  assert.equal(result.freshness.last_success.target,target);
  assert.equal(result.migration,undefined);
  engine.compose(w.registration,open,tomorrow);
  assert.equal(attempts,2);
});

test('REL-CTX-005: reachable transitions, stale writers and isolated bounded turns',t=>{
  const w = workspace(t);
  const engine = makeController(distributed.config,()=>target);
  const current = engine.compose(w.registration,event('prompt'),fixedTime).context;
  assert.ok(current.reachable.some(item=>item.state==='planning' && item.modules.some(module=>module.id==='tickets')));
  const plan = record(current,{state:'planning',level:'G2',relation:'continuation',facets:['physical_effect']});
  const updated = engine.compose(w.registration,plan,fixedTime).context;
  assert.equal(updated.state,'planning');
  assert.equal(updated.history.at(-1).level,'G2');
  assert.equal(updated.history.at(-1).relation,'continuation');
  assert.ok(!updated.history.at(-1).facets.includes('full_install'));
  assert.equal(engine.compose(w.registration,{...plan,request_id:'different'},fixedTime).context.status,'stale_or_invalid_transition');
  assert.equal(engine.compose(w.registration,plan,fixedTime).context.receipt.replayed,true);
  assert.equal(engine.compose(w.registration,event('prompt','different-chat'),fixedTime).context.history.length,1);
  for(let index=0;index<20;index++)engine.compose(w.registration,event('prompt'),fixedTime);
  const reopened = engine.compose(w.registration,event('session_open'),fixedTime).context;
  assert.equal(reopened.history.length,16);
  assert.ok([...reopened.modules,...reopened.reachable.flatMap(item=>item.modules)].every(module=>module.id!=='bootstrap'));
  assert.ok(reminder.includes('above G1') && reminder.includes('create, commit and push') && reminder.includes('status-only'));
});

test('REL-CTX-006: mandatory locations and registration scope confine state and synchronization',t=>{
  const w = workspace(t);
  fs.renameSync(w.operations,path.join(w.root,'alternate-operations'));
  const engine = makeController(distributed.config,()=>assert.fail('invalid workspace synchronized'));
  assert.equal(engine.compose(w.registration,event('prompt'),fixedTime).context.status,'context_unavailable');
  fs.renameSync(path.join(w.root,'alternate-operations'),w.operations);
  assert.equal(engine.compose({...w.registration,owned_scope:w.operations},event('prompt'),fixedTime).context.status,'context_unavailable');
  assert.equal(engine.compose(w.registration,{...event('prompt'),cwd:path.dirname(w.root)},fixedTime).context.status,'context_unavailable');
});

test('REL-CTX-007: Git driver replaces unpersisted checkout state and preserves persisted and project data',t=>{
  const w = workspace(t);
  const remote = path.join(w.root,'local-source');
  fs.mkdirSync(remote);
  function git(cwd,...args) {
    const run = spawnSync('git',['-C',cwd,...args],{encoding:'utf8',timeout:10000,windowsHide:true});
    assert.equal(run.status,0,run.stderr);
    return run.stdout.trim();
  }
  function commit(cwd, message) {
    git(cwd,'add','tracked.txt');
    git(cwd,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-m',message);
    return git(cwd,'rev-parse','HEAD');
  }
  for(const directory of [remote,w.checkout])git(directory,'init','--initial-branch=main');
  fs.writeFileSync(path.join(remote,'tracked.txt'),'official');
  const selected = commit(remote,'official fixture');
  fs.writeFileSync(path.join(w.checkout,'tracked.txt'),'persisted');
  const persisted = commit(w.checkout,'persisted fixture');
  git(w.checkout,'switch','--detach',persisted);
  fs.writeFileSync(path.join(w.checkout,'tracked.txt'),'detached');
  const detached = commit(w.checkout,'detached fixture');
  git(w.checkout,'remote','add','origin',remote);
  fs.writeFileSync(path.join(w.checkout,'tracked.txt'),'unpersisted');
  fs.writeFileSync(path.join(w.checkout,'untracked.txt'),'unpersisted');
  fs.writeFileSync(path.join(w.operations,'keep.txt'),'independent');
  const url = git(w.checkout,'remote','get-url','origin');
  assert.equal(gitSynchronize(w.checkout,{remote:'origin',ref:'refs/heads/main',url}),selected);
  assert.equal(git(w.checkout,'rev-parse','refs/heads/main'),persisted);
  assert.equal(git(w.checkout,'rev-parse','refs/oop/preserved/'+detached),detached);
  assert.equal(fs.readFileSync(path.join(w.checkout,'tracked.txt'),'utf8'),'official');
  assert.ok(!fs.existsSync(path.join(w.checkout,'untracked.txt')));
  assert.equal(fs.readFileSync(path.join(w.operations,'keep.txt'),'utf8'),'independent');
});

test('REL-CTX-008: shared instructions keep their ownership, ordering and rendered identity',t=>{
  const w = workspace(t);
  const common = path.dirname(w.checkout);
  const workspaceSource = path.join(common,'runtime-instructions.json');
  const organizationSource = path.join(w.operations,'runtime-instructions.json');
  fs.writeFileSync(path.join(w.operations,'policy.md'),'A canonical policy.');
  const record = {format:1,record_type:'oop_runtime_instruction',status:'active',title:'Guidance',applies_to:'Current project',
    effect:'adds',authority:{granted_by:'owner',evidence_ref:'record-1',granted_at:'2026-01-01'},author_runtime:'fixture',
    created_at:'2026-01-01',supersedes:[]};
  fs.writeFileSync(organizationSource,JSON.stringify([{...record,id:'policy',layer:'organization',canonical_ref:'policy.md',text:'Organizational instruction.'}]));
  fs.writeFileSync(workspaceSource,JSON.stringify([{...record,id:'workspace',layer:'workspace',text:'Workspace instruction.'}]));
  const engine = makeController(distributed.config,()=>target);
  const registration = {...w.registration,source:undefined,instruction_sources:{organization:organizationSource,workspace:workspaceSource}};
  const result = engine.compose(registration,event('prompt'),fixedTime);
  const {instructions} = result.context;
  assert.equal(instructions.status,'available');
  assert.ok(instructions.text.indexOf('Organizational instruction.') < instructions.text.indexOf('Workspace instruction.'));
  assert.match(fs.readFileSync(instructions.locator,'utf8'),/# Runtime instructions/);
  assert.equal(engine.compose(registration,event('session_open','another-chat'),fixedTime).context.instructions.identity,instructions.identity);
  const foreign = engine.compose({...registration,instruction_sources:{organization:workspaceSource,workspace:workspaceSource}},event('prompt'),fixedTime);
  assert.equal(foreign.context.instructions.status,'incomplete');
  assert.equal(foreign.context.instructions.layers.organization,'unknown');
});

test('REL-CTX-009: delivered procedures resolve invocation, timing, inputs and acceptance without inference',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target);
  const result=engine.compose({...w.registration,source:undefined},event('prompt'),fixedTime);
  const delivered=JSON.parse(result.additionalContext.split('\n').at(-1)),p=delivered.procedure;
  assert.deepEqual(delivered.source_binding,distributed.config.source_binding);
  assert.deepEqual(p.submission.invocation.args,[path.join(w.checkout,'dist','oop-enforce.js'),w.owned,'record']);
  assert.equal(p.submission.input.chat,'test-chat');assert.equal(p.submission.input.turn,1);assert.equal(p.submission.input.expected_version,1);
  for(const fragment of ['before its substantive answer','G0','acknowledgment'])assert.ok(p.timing.includes(fragment));
  for(const key of api.input.events.record)assert.ok(p.submission.required.includes(key));
  assert.ok(p.submission.acceptance.includes('request_id'));assert.ok(p.submission.failure.includes('snapshot'));
  assert.equal(p.submission.syntax.identifiers.max_length,128);assert.ok(p.submission.syntax.identifiers.pattern.startsWith('^'));
  assert.ok(p.submission.state_routes.intake.reachable.some(route=>route.state==='inquiry'));
  assert.ok(p.context.action.includes('complete'));assert.ok(p.lifecycle.bootstrap.endsWith('bootstrap.json'));
  assert.deepEqual(api.adapter.modes,['enforcement','record','snapshot','errors-read','errors-ack']);
});

test('REL-CTX-010: event-specific required fields and exact types reject invalid records without mutation',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target),current=engine.compose(w.registration,event('prompt'),fixedTime).context;
  for(const key of api.input.events.record){const value=record(current);delete value[key];const result=engine.compose(w.registration,value,fixedTime);assert.notEqual(result.context.status,'record_accepted',key);}
  for(const patch of [{related_ticket:'false'},{level:['G0']},{state:['inquiry']},{facets:'information'},{turn:1.5},{expected_version:0},{relation:'guessed'},{unexpected:true},{request_id:'bad id'}])assert.notEqual(engine.compose(w.registration,record(current,patch),fixedTime).context.status,'record_accepted');
  assert.equal(engine.compose(w.registration,event('snapshot'),fixedTime).context.version,current.version);
  assert.equal(api.schemas.request.additionalProperties,false);assert.ok(api.schemas.request.allOf[0].then.required.includes('related_ticket'));
});

test('REL-CTX-011: unknown material facets remain explicitly unresolved and cannot silently reduce routing',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target),current=engine.compose(w.registration,event('prompt'),fixedTime).context;
  for(const facets of [['unrecognized'],['information','full_install'],['oop_maintenance']]) {
    const result=engine.compose(w.registration,record(current,{facets}),fixedTime);
    assert.equal(result.context.status,'unresolved_facets');assert.equal(result.context.receipt,undefined);
    assert.ok(result.additionalContext.includes('unknown material'));
  }
  assert.equal(engine.compose(w.registration,event('snapshot'),fixedTime).context.version,current.version);
});

test('REL-CTX-012: accepted receipts correlate exact payloads and replay cannot advance or cross turns',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target),current=engine.compose(w.registration,event('prompt'),fixedTime).context;
  const input=record(current),accepted=engine.compose(w.registration,input,fixedTime).context;
  assert.equal(accepted.status,'record_accepted');assert.equal(accepted.receipt.version,current.version+1);
  for(const key of ['installation_uid','chat','request_id','subject','turn','state','level'])assert.equal(accepted.receipt[key],key==='installation_uid'?w.registration.installation_uid:input[key]);
  assert.deepEqual(accepted.receipt.facets,input.facets);assert.equal(accepted.receipt.related_ticket,input.related_ticket);assert.equal(accepted.receipt.relation,input.relation);
  const replay=engine.compose(w.registration,input,fixedTime).context;assert.equal(replay.receipt.replayed,true);assert.equal(replay.version,accepted.version);
  assert.equal(engine.compose(w.registration,{...input,level:'G1'},fixedTime).context.status,'correlation_conflict');
  const snapshot=engine.compose(w.registration,event('snapshot'),fixedTime).context;assert.equal(snapshot.receipts[0].request_id,input.request_id);
  engine.compose(w.registration,event('prompt'),fixedTime);
  const stale=engine.compose(w.registration,input,fixedTime).context;assert.equal(stale.status,'stale_or_invalid_transition');assert.equal(stale.receipt.disposition,'stale');
});

test('REL-CTX-013: multiple G0 subjects retain distinct states and accepted history across a prompt',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target);let state=engine.compose(w.registration,event('prompt'),fixedTime).context;
  state=engine.compose(w.registration,record(state),fixedTime).context;
  assert.ok(state.procedure.submission.state_routes.intake.reachable.some(route=>route.state==='inquiry'));
  assert.ok(state.procedure.submission.state_routes.inquiry.reachable.some(route=>route.state==='planning'));
  state=engine.compose(w.registration,record(state,{subject:'subject-2',request_id:'request-2'}),fixedTime).context;
  assert.equal(state.subjects.length,2);assert.ok(state.subjects.every(item=>item.level==='G0'&&!item.related_ticket));
  const prompt=engine.compose(w.registration,event('prompt'),fixedTime).context;
  assert.equal(prompt.state,'intake');assert.ok(prompt.history.some(item=>item.subject==='subject-1'));assert.ok(prompt.history.some(item=>item.subject==='subject-2'));
  const continuation=engine.compose(w.registration,record(prompt,{request_id:'request-3',relation:'continuation'}),fixedTime).context;
  assert.equal(continuation.receipt.disposition,'accepted');assert.equal(continuation.subjects.find(item=>item.subject==='subject-1').relation,'continuation');
  assert.deepEqual(fs.readdirSync(w.operations),[]);
});

test('REL-CTX-014: snapshot of absent chat neither manufactures a turn nor creates conversation storage',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>assert.fail('snapshot synchronized'));
  const snapshot=engine.compose(w.registration,event('snapshot'),fixedTime).context;
  assert.equal(snapshot.status,'chat_unavailable');assert.equal(snapshot.turn,undefined);assert.equal(fs.existsSync(path.join(w.owned,'context')),false);
});

test('REL-CTX-015: snapshot preserves stored bytes, revision, daily state and rendered instructions',t=>{
  const w=workspace(t);let calls=0;const engine=makeController(distributed.config,()=>{calls++;return target;});
  const state=engine.compose(w.registration,event('prompt'),fixedTime).context;
  const folder=path.join(w.owned,'context'),files=fs.readdirSync(folder),before=files.map(name=>fs.readFileSync(path.join(folder,name),'utf8'));
  const view=path.join(w.root,'.priv','common','runtime-instructions.rendered.md'),viewTime=fs.statSync(view).mtimeMs;
  const snapshot=engine.compose(w.registration,event('snapshot'),new Date('2026-02-04T12:00Z')).context;
  assert.equal(calls,1);assert.equal(snapshot.turn,state.turn);assert.equal(snapshot.version,state.version);
  assert.deepEqual(files.map(name=>fs.readFileSync(path.join(folder,name),'utf8')),before);assert.equal(fs.statSync(view).mtimeMs,viewTime);
});

test('REL-CTX-016: root-first controller supports enforcement, record and snapshot through one entry with spaces',t=>{
  const w=workspace(t),installed=installTemplate(w);
  const opened=installed.call('native',{...event('prompt'),prompt:'raw-secret'});assert.equal(opened.status,0,opened.stderr);
  const snapshot=installed.call('snapshot',event('snapshot'));assert.equal(snapshot.status,0,snapshot.stderr);
  const current=JSON.parse(snapshot.stdout).context,input=record(current);
  const accepted=installed.call('record',input);assert.equal(accepted.status,0,accepted.stderr);assert.equal(JSON.parse(accepted.stdout).context.receipt.disposition,'accepted');
  const invalid=installed.call('record',{...input,request_id:'other',expected_version:0});assert.equal(invalid.status,1);assert.notEqual(JSON.parse(invalid.stdout).context.receipt?.disposition,'accepted');
  const mismatch=installed.call('record',event('snapshot'));assert.equal(mismatch.status,1);assert.ok(!accepted.stdout.includes('raw-secret'));
});

test('REL-CTX-017: decode and input failures retain safe actionable unread diagnostics',t=>{
 const w=workspace(t),installed=installTemplate(w);
 for(const input of ['not-json',JSON.stringify({event:'unknown',chat:'chat',prompt:'credential-secret'})]){
   const result=installed.call('native',input);assert.equal(result.status,0);assert.ok(!result.stdout.includes('credential-secret'));
   const rows=fs.readFileSync(path.join(w.owned,'oop-enforce-errors.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
   assert.ok(rows.every(r=>r.read===false&&r.uid&&r.message));
 }
});

test('REL-CTX-018: missing root components and traversal cannot satisfy canonical loading',t=>{
 const w=workspace(t),installed=installTemplate(w);fs.unlinkSync(installed.entry);
 const missing=installed.call('snapshot',event('snapshot'));assert.equal(missing.status,1);assert.equal(JSON.parse(missing.stdout).context.diagnostic.code,'adapter_missing');
 fs.copyFileSync(new URL('../dist/templates/oop-runtime-adapter.js',import.meta.url),installed.entry);
 assert.equal(installed.call('snapshot',event('snapshot')).status,1);
 const traversal=w.owned+path.sep+'unused'+path.sep+'..';
 const result=spawnSync(process.execPath,[installed.controller,traversal,'snapshot'],{input:JSON.stringify(event('snapshot')),encoding:'utf8'});assert.equal(result.status,1);
});

test('REL-CTX-019: capacity is bounded and independently accepted receipts cannot be erased by overflow',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target);let current=engine.compose(w.registration,event('prompt'),fixedTime).context;
  for(let i=0;i<16;i++)current=engine.compose(w.registration,record(current,{subject:'subject-'+i,request_id:'req-'+i}),fixedTime).context;
  assert.equal(current.subjects.length,16);
  const overflow=engine.compose(w.registration,record(current,{subject:'subject-overflow',request_id:'overflow'}),fixedTime).context;
  assert.equal(overflow.status,'subject_capacity_reached');assert.equal(overflow.version,current.version);
  for(let i=0;i<40;i++)current=engine.compose(w.registration,record(current,{subject:'subject-0',request_id:'update-'+i,relation:'correction'}),fixedTime).context;
  assert.equal(current.receipts.length,32);assert.equal(current.history.length,16);assert.equal(current.subjects.length,16);
  const directory=path.join(w.owned,'context'),file=path.join(directory,fs.readdirSync(directory).find(name=>name.endsWith('.json'))),stored=JSON.parse(fs.readFileSync(file,'utf8'));
  stored.version=Number.MAX_SAFE_INTEGER;fs.writeFileSync(file,JSON.stringify(stored));
  const exhausted=engine.compose(w.registration,event('prompt'),fixedTime).context;assert.equal(exhausted.status,'revision_capacity_reached');assert.equal(exhausted.version,Number.MAX_SAFE_INTEGER);
});

test('REL-CTX-020: template preparation, fixed scaffold and conditional invocation fixtures agree with manifest',t=>{
  const source=fs.readFileSync(new URL('../dist/templates/oop-runtime-adapter.js',import.meta.url),'utf8');
  for(let i=1;i<=7;i++)assert.ok(source.includes('// S'+i+' '));
  for(const name of ['manifest','decodeEvent']) {
    assert.equal(source.split('// OOP-EDIT-BEGIN '+name).length,2);assert.equal(source.split('// OOP-EDIT-END '+name).length,2);
  }
  assert.ok(source.includes('controller owns loading'));assert.ok(source.includes('OOP_ADAPTER_NOT_IMPLEMENTED'));assert.ok(!source.includes('module.exports = Object.freeze({contact_point'));
  assert.equal(manifest.runtime_adapter.location,'immediate child of owned_scope');assert.equal(manifest.runtime_adapter.preparation.length,7);
  // Two synthetic documented parsing contracts: a vector and a double-quoted
  // expression with quote/backslash escaping. Neither is a universal host command.
  const executable='/fixture space/interpreter',entry='/fixture space/install/oop-runtime-adapter.js',registration='/fixture space/install/oop-context-registration.json';
  const vector=[executable,enginePath,path.dirname(registration),'enforcement'];
  const expression=vector.map(value=>'"'+value.replace(/[\\"]/g,'\\$&')+'"').join(' ');
  const parsed=[...expression.matchAll(/"((?:\\.|[^"\\])*)"/g)].map(match=>match[1].replace(/\\([\\"])/g,'$1'));
  assert.deepEqual(parsed,vector);assert.equal(adapter(executable,enginePath,registration)["hooks"]['SessionStart'][0]["hooks"][0].args[0],enginePath);
  assert.throws(()=>adapter(executable,enginePath,registration,entry.replace('oop-runtime-adapter.js','launcher.cjs')),/Noncanonical/);
  const {validateSpecialization}=require('./context-reconciliation.cjs'),installed=installTemplate(workspace(t)),candidate=fs.readFileSync(installed.entry,'utf8');
  assert.equal(validateSpecialization(source,candidate).valid,true);
  for(const invalid of [source,candidate+'\n// extra',candidate.replace('module.exports = Object.freeze','module.exports = identity'),"module.exports={events:[]};"])
    assert.equal(validateSpecialization(source,invalid).valid,false);
});

test('REL-CTX-021: current-layout reconciliation preserves lifecycle, ownership, peers and resumable phases',async()=>{
  const {reconcileContextAdapter,steps}=require('./context-reconciliation.cjs');
  for(const layout of ['launcher_only','descriptor_and_launcher']) {
    let state={owned_root:'/private/install',revision:'r1',layout,paths_resolved_without_aliases:true,ownership_verified:true,authority_verified:true,
      installation_chat:false,logic_change_eligible:true};const calls=[];
    const proposal={expected_revision:'r1',entry:'/private/install/oop-runtime-adapter.js',preparation:steps.map(step=>({step,reference:'fixture:'+step}))};
    const backend={read:async()=>state,validateCandidate:async()=>({valid:true,interface:'oop-context-1',declarative_scaffold:true,controller_dispatch:true,modes:['enforcement','record','snapshot','errors-read','errors-ack']}),
      stage:async()=>{calls.push('stage');return {revision:'r2'};},configure:async()=>({revision:'r3',completed:true,consent_resolved:true,restart_resolved:true,real_error:false}),
      activate:async()=>{state={...state,revision:'r4',active_entry:proposal.entry,owned_routes:[{entry:proposal.entry}],peer_state_preserved:true,references_preserved:true,in_progress_users:0};return {revision:'r4'};},
      checkpoint:async()=>({revision:'r5'}),retire:async(revision,options)=>{assert.equal(revision,'r5');assert.equal(options.preserve_referenced_history,true);calls.push('retire');}};
    const result=await reconcileContextAdapter(proposal,backend);assert.equal(result.verified,true);assert.deepEqual(calls,['stage','retire']);
    for(const patch of [{ownership_verified:false},{authority_verified:false},{revision:'stale'},{installation_chat:true,supplied_compatible_template:false},{logic_change_eligible:false}]) {
      state={...state,revision:'r1',installation_chat:false,logic_change_eligible:true,...patch};assert.equal((await reconcileContextAdapter(proposal,backend)).verified,false);
    }
    state={...state,revision:'r1',installation_chat:false,logic_change_eligible:true,ownership_verified:true,authority_verified:true};
    for(const preparation of [proposal.preparation.slice(1),[...proposal.preparation].reverse(),proposal.preparation.map(item=>({...item,reference:''}))])assert.equal((await reconcileContextAdapter({...proposal,preparation},backend)).verified,false);
  }
});

test('REL-CTX-022: uncertain activation and in-progress invocation defer cleanup without fabricated completion',async()=>{
  const {reconcileContextAdapter,steps}=require('./context-reconciliation.cjs');let activated=false,retired=false;
  const proposal={expected_revision:'r1',entry:'/private/install/oop-runtime-adapter.js',preparation:steps.map(step=>({step,reference:step}))};
  const state={owned_root:'/private/install',revision:'r1',layout:'launcher_only',paths_resolved_without_aliases:true,ownership_verified:true,authority_verified:true,installation_chat:false,logic_change_eligible:true};
  const backend={read:async()=>activated?{...state,revision:'r4',active_entry:proposal.entry,owned_routes:[{entry:proposal.entry}],peer_state_preserved:true,references_preserved:true,in_progress_users:1}:state,
    validateCandidate:async()=>({valid:true,interface:'oop-context-1',declarative_scaffold:true,controller_dispatch:true,modes:['enforcement','record','snapshot','errors-read','errors-ack']}),stage:async()=>({revision:'r2'}),
    configure:async()=>({revision:'r3',completed:true,consent_resolved:true,restart_resolved:true,real_error:false}),activate:async()=>{activated=true;return {revision:'r4'};},checkpoint:async()=>({revision:'r5'}),retire:async()=>{retired=true;}};
  const deferred=await reconcileContextAdapter(proposal,backend);assert.equal(deferred.phase,'cleanup_pending');assert.equal(deferred.retire_deferred,true);assert.equal(retired,false);
  activated=false;backend.activate=async()=>{throw Error('uncertain');};const uncertain=await reconcileContextAdapter(proposal,backend);
  assert.equal(uncertain.verified,false);assert.equal(uncertain.phase,'activation_pending_reconciliation');assert.equal(uncertain.reconcile_actual_state,true);assert.equal(retired,false);
});

test('REL-CTX-023: retained claims without correlation stay readable without fabricated acknowledgments',t=>{
  const w=workspace(t),engine=makeController(distributed.config,()=>target);
  engine.compose(w.registration,event('prompt'),fixedTime);
  const directory=path.join(w.owned,'context'),file=path.join(directory,fs.readdirSync(directory).find(name=>name.endsWith('.json')));
  const retained={sequence:1,version:2,state:'inquiry',history:[{turn:1,state:'inquiry',level:'G0',related_ticket:false,facets:['information']}]};
  fs.writeFileSync(file,JSON.stringify(retained));const before=fs.readFileSync(file,'utf8');
  const snapshot=engine.compose(w.registration,event('snapshot'),fixedTime).context;
  assert.equal(snapshot.status,'available');assert.equal(snapshot.uncorrelated_retained_claims,true);assert.deepEqual(snapshot.receipts,[]);
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(snapshot.history[0].level,'G0');
  const prompt=engine.compose(w.registration,event('prompt'),fixedTime).context;
  assert.ok(prompt.history.some(entry=>entry.turn===1&&entry.level==='G0'));assert.deepEqual(prompt.receipts,[]);
});
