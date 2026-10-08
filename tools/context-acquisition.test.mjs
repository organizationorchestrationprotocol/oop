import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const require=createRequire(import.meta.url),{makeController}=require('./context-controller.cjs'),{contextRuntime}=require('./context-runtime.cjs');
const {contextAcquisition}=require('./context-acquisition.cjs'),codec=contextAcquisition(),distributed=require('../dist/oop-enforce.js');
const observe=(n,name,fn)=>test(`REL-ACQ-${String(n).padStart(3,'0')}: AT-${String(n).padStart(2,'0')} ${name}`,fn);
function fixture(t,mode='complete',continuity=false){
  const project=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'oop-acq-'))),root=path.join(project,'.priv','tools','runtime','install');
  t.after(()=>fs.rmSync(project,{recursive:true,force:true}));
  for(const p of [root,path.join(project,'operations'),path.join(project,'.priv','common','oop')])fs.mkdirSync(p,{recursive:true});
  const registration={format:1,interface:'oop-context-1',installation_uid:'install',owned_scope:root,project_root:project,lifecycle:'active',filesystem_local:true,instruction_sources:{organization:null,workspace:null}};
  const template=fs.readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
  const response={stdout:'{"context":{{context}}}',stderr:'',exit_code:0,context_delivery:mode==='complete'?{mode,basis:'Fixture complete context channel.'}:{mode:'preview',basis:'Fixture bounded preview with a separately retained full pointer.',preamble:'Acquire the complete current target through its reference; independent host authority applies.',visible_prefix_bytes:128}};
  const commands={session_open:{Open:response},prompt:{Prompt:response},operation_entry:{Before:response},operation_completion:{After:response},turn_stop:{End:{stdout:'{}',stderr:'',exit_code:0,context_delivery:{mode:'none',basis:'Fixture context-free turn end.'}}}};
  const manifest={schema_version:1,host:'fixture',runtime_version:'1',documentation:[{source:'fixture://events',section:'bounded composed dispatch'}],invocation_basis:'structured vector',continuation_basis:'zero continuation',nonblocking_exit_codes:[0],placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'}},supported_commands:commands};
  if(continuity)manifest.context_continuity_basis='Producer fixture observes the active context generation.';
  let source=template;
  for(const [name,body]of Object.entries({manifest:JSON.stringify(manifest),decodeEvent:'const {native,...event}=raw;return {native_event:native,event};'}))source=source.replace(new RegExp('(?<=// OOP-EDIT-BEGIN '+name+')[\\s\\S]*?(?=// OOP-EDIT-END '+name+')'),'\n'+body+'\n');
  fs.writeFileSync(path.join(root,'oop-context-registration.json'),JSON.stringify(registration));fs.writeFileSync(path.join(root,'oop-runtime-adapter.js'),source);
  const controller=makeController({...distributed.config,adapter_template:template},()=>assert.fail('unexpected synchronization')),runtime=contextRuntime(controller,template);
  const call=async(command,input)=>{const out=await runtime.execute([root,command],JSON.stringify(input));return {...out,value:out.stdout?JSON.parse(out.stdout):null};};
  const dispatches=[];
  async function native(event='prompt',chat='chat',origin,context_generation=continuity&&event!=='turn_stop'?'epoch-1':undefined){const name={prompt:'Prompt',session_open:'Open',operation_entry:'Before',operation_completion:'After',turn_stop:'End'}[event];
    const r=await call('enforcement',{native:name,event,chat,origin,context_generation});dispatches.push(event);
    if(event==='turn_stop')return r;
    assert.equal(r.exitCode,0);const text=r.value.context,file=JSON.parse(text.match(/context in: ("[^\n]+")/)[1]);
    const record=JSON.parse(fs.readFileSync(file,'utf8'));return {file,record,text,resolved:controller.resolveResponse(record,path.dirname(file))};
  }
  async function read(target,{chat='chat',transaction='episode',offset=0,depth=0,...extra}={}){
    return (await call('acquire',{event:'acquire',chat,response_id:target.record.response_id,transaction,offset,depth,...extra})).value;
  }
  async function all(target,options={},surroundWithEvents=true){let offset=0,parts=[],last;
    for(let n=0;n<codec.bounds.segments;n++){
      if(surroundWithEvents)await native('operation_entry',options.chat??'chat');
      last=await read(target,{...options,offset});
      if(surroundWithEvents)await native('operation_completion',options.chat??'chat');
      assert.ok(['partial','complete'].includes(last.status),JSON.stringify(last));parts.push(last.content);offset=last.next_offset;
      if(last.status==='complete'){const bytes=parts.join('');assert.equal(codec.identity(bytes),last.content_identity);return {record:JSON.parse(bytes),last,segments:n+1};}
    }assert.fail('acquisition did not terminate');
  }
  return {project,root,controller,runtime,call,native,read,all,dispatches,session:chat=>JSON.parse(fs.readFileSync(path.join(root,'context',chat+'.json'),'utf8'))};
}
observe(30,'verified continuity permits light between deep refreshes on turns 1, 4 and 7',async t=>{
  const f=fixture(t,'complete',true),opening=await f.native('session_open');
  assert.match(opening.text,/^OOP — MANDATORY CONTEXT/);
  await f.all(opening,{},false);
  for(let turn=1;turn<=7;turn++){
    const prompt=await f.native();
    assert.equal(prompt.record.context.current.turn,turn);
    if(turn===4||turn===7){
      assert.match(prompt.text,/^OOP — MANDATORY CONTEXT/);
      assert.match((await f.native('operation_entry')).text,/Verify current kernel and index/);
      const current=await f.native('operation_completion');
      await f.all(current,{},false);
    }else assert.match(prompt.text,/^OOP — CONTEXT REMINDER/);
    const operation=await f.native('operation_entry');
    assert.match(operation.text,/^OOP — CONTEXT REMINDER/);
    assert.equal(f.session('chat').sequence,turn);
    assert.ok(operation.resolved.context.instructions.common.oop.length);
    if(turn===1)assert.ok(prompt.text.includes(opening.record.response_id));
  }
});
observe(31,'unknown continuity is targeted while an observed generation change invalidates reuse',async t=>{
  const f=fixture(t,'complete',true);
  await f.native('session_open');
  const first=await f.native();
  assert.match(first.text,/^OOP — MANDATORY CONTEXT/);
  await f.all(first,{},false);
  assert.match((await f.native()).text,/^OOP — CONTEXT REMINDER/);
  const lost=await f.native('operation_entry','chat',undefined,'epoch-2');
  assert.match(lost.text,/Verify current kernel and index/);
  await f.all(lost,{transaction:'after-loss'},false);
  assert.match((await f.native('operation_completion','chat',undefined,'epoch-2')).text,/^OOP — CONTEXT REMINDER/);
  const moved=await f.call('enforcement',{native:'Before',event:'operation_entry',chat:'chat',cwd:f.root,context_generation:'epoch-2'});
  assert.match(moved.value.context,/Verify current kernel and index/);
  const unknown=await f.call('enforcement',{native:'Before',event:'operation_entry',chat:'chat'});
  assert.match(unknown.value.context,/Verify current kernel and index/);
  assert.match((await f.native('operation_completion','chat',undefined,'epoch-2')).text,/Verify current kernel and index/);
});
observe(32,'a reconciled diagnostic stays actionable until a response that contains it is acquired',async t=>{
  const f=fixture(t,'complete',true),first=await f.native();
  await f.all(first,{},false);
  const registration=JSON.parse(fs.readFileSync(path.join(f.root,'oop-context-registration.json')));
  const lock=path.join(f.root,'context','history.lock'),event={event:'operation_entry',chat:'chat'};
  fs.writeFileSync(lock,'fixture owner',{flag:'wx'});
  let pending;
  try{pending=f.controller.deliver(f.root,'chat',f.controller.compose(registration,event),event.event,['controller_failure']);}
  finally{fs.unlinkSync(lock);}
  const reconciliation=await f.native('operation_completion');
  const observed=await f.native('operation_entry');
  const hasDiagnostic=target=>target.resolved.context.session_errors?.some(error=>error.response_id===pending.response_id&&error.code==='controller_failure');
  assert.match(reconciliation.text,/^OOP — CONTEXT REMINDER/);
  assert.ok(!hasDiagnostic(reconciliation));
  assert.match(observed.text,/Verify current kernel and index/);
  assert.ok(hasDiagnostic(observed));
  await f.all(observed,{transaction:'after-diagnostic'},false);
  assert.match((await f.native('operation_completion')).text,/^OOP — CONTEXT REMINDER/);
});
observe(1,'entry and completion events permit finite acquisition and the next authorized effect',async t=>{
  const f=fixture(t),target=await f.native(),result=await f.all(target);
  assert.equal(result.last.status,'complete');assert.ok(result.segments<=codec.bounds.segments);
  fs.writeFileSync(path.join(f.project,'authorized-result.txt'),'verified fixture action');assert.equal(fs.readFileSync(path.join(f.project,'authorized-result.txt'),'utf8'),'verified fixture action');
  assert.deepEqual(result.record.context.procedure,target.resolved.context.procedure);
});
observe(2,'ten different envelopes retain one material dependency and one revision',async t=>{
  const f=fixture(t),first=await f.native(),ids=new Set([first.record.response_id]);
  for(let n=0;n<10;n++){const r=await f.native('operation_entry');ids.add(r.record.response_id);assert.equal(r.record.recovery.dependency_identity,first.record.recovery.dependency_identity);assert.deepEqual(r.record.context.current,first.record.context.current);}
  assert.equal(ids.size,11);await f.all(first);
});
observe(3,'material changes invalidate explicitly without resetting the episode budget',async t=>{
  const f=fixture(t);let target=await f.native();assert.equal((await f.read(target)).status,'partial');assert.equal((await f.read(target,{offset:8192})).status,'partial');
  for(let n=0;n<4;n++){
    const prompt=JSON.parse((await f.call('snapshot',{event:'snapshot',chat:'chat'})).stdout).context;
    const example=target.resolved.context.procedure.submission.example;
    const r=await f.call('record',{...example,request_id:'change-'+n,subject:'subject-'+n,expected_version:prompt.version});assert.equal(r.exitCode,0);
    const latest=await f.native('operation_completion'),out=await f.read(target,{offset:n?0:8192});
    assert.equal(out.status,n===3?'recovery_budget_exhausted':'context_changed');target=latest;
    if(n===0)assert.equal((await f.read(target,{offset:8192})).status,'correlation_conflict');
  }
  assert.equal((await f.read(target)).unchanged,true);
});
observe(4,'completion delivery cannot renew a satisfied unchanged dependency',async t=>{
  const f=fixture(t),target=await f.native();await f.all(target);const completed=f.session('chat').acquisition;
  const after=await f.native('operation_completion');assert.equal(after.record.recovery.dependency_identity,target.record.recovery.dependency_identity);
  assert.deepEqual(f.session('chat').acquisition,completed);assert.equal(completed.complete,true);
  const example=target.resolved.context.procedure.submission.example;assert.equal((await f.call('record',example)).exitCode,0);
  const changed=await f.native('operation_completion');assert.equal((await f.read(target,{offset:completed.last_offset})).status,'context_changed');
  assert.equal(f.session('chat').acquisition.complete,false);await f.all(changed);
});
observe(5,'segmentation reconstructs Unicode, types and complete self-contained procedures exactly',async t=>{
  const f=fixture(t),target=await f.native(),first=await f.read(target),replay=await f.read(target);
  assert.deepEqual(replay,first);assert.equal(f.session('chat').acquisition.segments,1);
  const result=await f.all(target);assert.ok(result.segments>1);
  const edge={text:'é漢字🙂\n\t"\\',nil:null,empty:'',no:false,zero:0,list:[{},[],null,1.5],absent:{}};
  assert.deepEqual(JSON.parse(codec.encode(edge)),edge);assert.equal(Object.hasOwn(JSON.parse(codec.encode(edge)).absent,'value'),false);
  assert.deepEqual(result.record.context.procedure,target.resolved.context.procedure);
  const changed=await f.read(target,{transaction:'unrelated',offset:8192});assert.equal(changed.status,'correlation_conflict');
  let repeated;for(let n=0;n<=codec.bounds.attempts;n++)repeated=await f.read(target,{offset:result.last.offset});assert.equal(repeated.status,'recovery_budget_exhausted');
});
observe(6,'a recovery label cannot smuggle an unrelated write into acquisition',async t=>{
  const f=fixture(t),target=await f.native(),file=path.join(f.project,'unrelated.txt');
  const r=await f.read(target,{execute:{write:file,value:'forbidden'}});assert.equal(r.status,'input_invalid');assert.equal(fs.existsSync(file),false);
});
observe(7,'out-of-order targets and concurrent chats cannot satisfy each other',async t=>{
  const f=fixture(t),a=await f.native('prompt','a'),b=await f.native('prompt','b');
  assert.equal((await f.read(a,{chat:'b'})).status,'context_target_expired');
  const one=await f.all(a,{chat:'a'}),two=await f.all(b,{chat:'b',transaction:'other'});assert.equal(one.record.session,'a');assert.equal(two.record.session,'b');
});
observe(8,'missing or malformed responses produce one terminal unchanged failure',async t=>{
  for(const broken of ['missing','malformed']){const f=fixture(t),target=await f.native(),file=target.file,bytes=fs.readFileSync(file);
    if(broken==='missing')fs.unlinkSync(file);else fs.writeFileSync(file,'{broken');
    assert.equal((await f.read(target)).status,'context_unavailable');const again=await f.read(target);assert.equal(again.unchanged,true);assert.equal(again.status,'context_unavailable');
    fs.writeFileSync(file,bytes);await f.all(target,{},false);
  }
});
observe(9,'invalid root invocation remains separate from successful corrected acquisition',async t=>{
  const f=fixture(t),target=await f.native(),bad=await f.runtime.execute(['relative','acquire'],'{}');assert.equal(bad.exitCode,1);assert.equal(JSON.parse(bad.stdout).context.diagnostic.code,'invalid_path');await f.all(target);
});
observe(10,'host-denied delivery has no automatic alternate execution path',async t=>{
  const f=fixture(t),target=await f.native(),read=f.controller.acquire;let calls=0;
  f.controller.acquire=()=>{calls++;return {status:'host_denied',diagnostic:{code:'host_denied',resumption_condition:'Host authorization required.'}};};
  assert.equal((await f.read(target)).status,'host_denied');assert.equal(calls,1);assert.equal(f.session('chat').acquisition,undefined);
  f.controller.acquire=read;await f.all(target);
});
observe(11,'a user stop prevents pending acquisition from resuming the turn',async t=>{
  const f=fixture(t),target=await f.native();await f.read(target);const ended=await f.native('turn_stop','chat','user');assert.deepEqual(ended.value,{});
  assert.equal((await f.read(target,{offset:8192})).status,'turn_interrupted');assert.equal(f.session('chat').turn_state.state,'interrupted');
});
observe(12,'model completion and unknown termination retain distinct origin evidence',async t=>{
  for(const origin of ['model','unknown']){const f=fixture(t);await f.native();await f.native('turn_stop','chat',origin);const state=f.session('chat');assert.equal(state.sequence,1);assert.equal(state.turn_state.origin,origin);assert.equal(state.turn_state.state,origin==='model'?'closed':'interrupted');}
});
observe(13,'retained handler definitions alone cannot claim effective coverage',async t=>{
  const f=fixture(t),target=await f.native();await f.all(target,{},false);assert.deepEqual(f.dispatches,['prompt']);assert.ok(fs.readFileSync(path.join(f.root,'oop-runtime-adapter.js'),'utf8').includes('operation_entry'));
  assert.equal(f.dispatches.includes('operation_entry'),false);
});
observe(14,'all declared fixture event paths execute under both delivery modes',async t=>{
  for(const mode of ['complete','preview']){const f=fixture(t,mode),target=await f.native();await f.all(target);assert.ok(f.dispatches.includes('operation_entry')&&f.dispatches.includes('operation_completion'));}
});
observe(15,'lightweight recovery creates no ticket and managed work keeps its gates',async t=>{
  const f=fixture(t),target=await f.native();await f.all(target);assert.deepEqual(fs.readdirSync(path.join(f.project,'operations')),[]);
  const example=target.resolved.context.procedure.submission.example;const denied=await f.call('record',{...example,level:'G2',state:'planning',facets:['managed_change']});assert.equal(denied.value.context.status,'knowledge_declaration_missing');
});
observe(16,'task verification failure does not become an acquisition failure',async t=>{
  const f=fixture(t),target=await f.native(),result=await f.all(target);assert.equal(result.last.status,'complete');assert.throws(()=>assert.equal('actual product output','expected product output'));assert.equal(f.session('chat').acquisition.complete,true);
});
observe(17,'one complete response carries mandatory recovery and current routing',async t=>{
 const f=fixture(t),target=await f.native(),result=await f.all(target);const rules=result.record.context.instructions.common.oop.join(' ');
 assert.ok(rules.includes('finite correlated recovery episode'));assert.ok(target.record.definitions.oop.identity);assert.ok(result.record.context.routing.routes.intake.reachable.length);
 assert.equal(fs.existsSync(path.join(f.project,'.priv','common','runtime-instructions.rendered.md')),false);
});
observe(35,'unknown continuity acquires only the selected component across equivalent redelivery',async t=>{
 const started=performance.now();
 const f=fixture(t),opening=await f.native('session_open'),prompt=await f.native();
 assert.match(opening.text,/Review the complete current kernel and index/);
 const kernel=await f.read(prompt,{component:'kernel'});
 assert.equal(kernel.status,'complete');
 assert.deepEqual(JSON.parse(kernel.content),JSON.parse(fs.readFileSync('dist/kernel.json','utf8')));
 assert.match(JSON.parse(kernel.content).text,/honor user interruption/);
 assert.equal(opening.record.definitions.index.identity,prompt.record.definitions.index.identity);
 assert.equal(prompt.record.context.routing.index,null);
 const first=await f.read(prompt,{component:'index',segment_bytes:512});
 assert.equal(first.status,'partial');assert.equal(first.component,'index');
 const event=await f.native('operation_entry');
 assert.match(event.text,/^OOP — CONTEXT REMINDER/);
 assert.match(event.text,/Verify current kernel and index/);
 assert.equal(event.record.definitions.index.identity,prompt.record.definitions.index.identity);
 assert.equal(f.session('chat').sequence,1);
 let segment=first,content=first.content;
 for(let n=1;segment.status==='partial'&&n<codec.bounds.segments;n++){
   segment=await f.read(prompt,{component:'index',offset:segment.next_offset,segment_bytes:512});
   content+=segment.content??'';
 }
 assert.equal(segment.status,'complete');
 assert.equal(codec.identity(content),prompt.record.definitions.index.identity);
 assert.deepEqual(JSON.parse(content),prompt.resolved.context.routing.index);
 assert.equal(f.session('chat').context_refresh?.acquired,true);
 assert.match((await f.native('operation_completion')).text,/continuity unknown/);
 assert.equal(f.session('chat').component_acquisitions.index.complete,true);
 const fullBytes=Buffer.byteLength(codec.encode(prompt.resolved)),acquiredBytes=Buffer.byteLength(content);
 assert.ok(acquiredBytes<fullBytes);
 const firstTaskOperation=performance.now();
 const output=path.join(f.project,'fixture-result.txt');
 fs.writeFileSync(output,'observable fixture result');
 assert.equal(fs.readFileSync(output,'utf8'),'observable fixture result');
 t.diagnostic(JSON.stringify({scope:'isolated producer transport and task fixture',
   operation_instruction_bytes:Buffer.byteLength(event.text),response_bytes:fs.statSync(event.file).size,
   acquired_index_bytes:acquiredBytes,reconstructible_response_bytes:fullBytes,acquisition_segments:f.session('chat').component_acquisitions.index.segments,
   first_task_operation_ms:Math.round(firstTaskOperation-started),verified_fixture_milestone_ms:Math.round(performance.now()-started)}));
});
observe(36,'native replay covers a refresh selectively and measures observed and unknown continuity',async t=>{
 for(const observed of [true,false]){
  const f=fixture(t,'complete',observed),started=performance.now();
  let calls=0,acquired=0;
  const acquire=async(target,component)=>{
   const result=await f.all(target,{component},false);
   calls+=result.segments;acquired+=result.last.total_bytes;
   assert.equal(result.last.content_identity,target.record.definitions[component].identity);
  };
  const opening=await f.native('session_open');
  await acquire(opening,'kernel');
  const incomplete=await f.native('operation_entry');
  assert.match(incomplete.text,/Verify current kernel and index/);
  await acquire(opening,'index');
  const operation=await f.native('operation_completion');
  assert.match(operation.text,/Semantic Routing Index \(recovery\.components\.index\)/);
  assert.match(operation.text,/recovery\.acquisition/);
  assert.match(operation.text,observed?/continuity unchanged/:/continuity unknown/);
  const prompt=await f.native();
  if(observed){
   assert.match(prompt.text,/^OOP — CONTEXT REMINDER/);
   assert.match(prompt.text,/Route this input/);
   assert.equal(f.session('chat').context_refresh.acquired,true);
  }else{
   assert.match(prompt.text,/^OOP — MANDATORY CONTEXT/);
   await acquire(prompt,'kernel');await acquire(prompt,'index');
  }
  const next=await f.native('operation_entry');
  const reminders=[incomplete,operation,next];
  assert.equal(f.session('chat').sequence,1);
  for(const event of reminders){
   const portable=event.text.replace(JSON.stringify(event.file),'"<owned-response>"');
   assert.ok(Buffer.byteLength(portable)<=465,portable);
  }
  const firstRelevant=Math.round(performance.now()-started),result=path.join(f.project,'fixture-task');
  fs.writeFileSync(result,'verified');assert.equal(fs.readFileSync(result,'utf8'),'verified');
  t.diagnostic(JSON.stringify({scenario:observed?'observed_continuity':'unknown_continuity',
   reminder_count:reminders.length,reminder_bytes:reminders.reduce((total,event)=>total+Buffer.byteLength(event.text),0),
   acquisition_calls:calls,acquired_bytes:acquired,first_relevant_operation_ms:firstRelevant,
   retained_model_context:'not_measured',quota:'not_measured'}));
 }
});
observe(18,'altered response bytes are rejected while peer content remains untouched',async t=>{
 const f=fixture(t),target=await f.native(),peer=path.join(f.project,'peer.txt');fs.writeFileSync(peer,'Independent peer instructions');
 fs.appendFileSync(target.file,'changed');assert.equal((await f.read(target)).status,'context_unavailable');assert.equal(fs.readFileSync(peer,'utf8'),'Independent peer instructions');
});
observe(19,'expired targets and unsupported paths terminate with a resumption condition',async t=>{
  const f=fixture(t),target=await f.native(),expired={...target,record:{...target.record,response_id:'r-expired-12345678'}};
  const failure=await f.read(expired);assert.equal(failure.status,'context_target_expired');assert.ok(failure.diagnostic.resumption_condition);
  const malformed=await f.read(target,{depth:codec.bounds.event_depth+1,transaction:'new-transaction'});assert.ok(!['partial','complete'].includes(malformed.status));
  const other=fixture(t),pinned=await other.native();await other.read(pinned);
  const old=new Date(Date.now()-26*3600000);fs.utimesSync(pinned.file,old,old);
  for(let n=0;n<17;n++)await other.native('operation_completion');
  assert.equal(other.session('chat').responses.some(r=>r.response_id===pinned.record.response_id),false);
  assert.equal(fs.existsSync(pinned.file),true);await other.all(pinned);
});

observe(20,'acquisition under history contention retains target, phase and live lock',async t=>{
  const f=fixture(t),target=await f.native(),lock=path.join(f.root,'context','history.lock');
  fs.writeFileSync(lock,'live fixture owner',{flag:'wx'});
  try {
    const busy=await f.read(target);
    assert.equal(busy.type,'oop_context_acquisition');
    assert.equal(busy.status,'busy');
    assert.equal(busy.busy_phase,'history');
    assert.equal(busy.transaction,'episode');
    assert.equal(busy.response_id,target.record.response_id);
    assert.equal(fs.readFileSync(lock,'utf8'),'live fixture owner');
  } finally { fs.unlinkSync(lock); }
  await f.all(target,{},false);
});
observe(21,'a written target with a contended index is reconciled on exact owned acquisition',async t=>{
  const f=fixture(t);await f.native();
  const registration=JSON.parse(fs.readFileSync(path.join(f.root,'oop-context-registration.json')));
  const event={event:'operation_entry',chat:'chat'},result=f.controller.compose(registration,event);
  const lock=path.join(f.root,'context','history.lock');
  fs.writeFileSync(lock,'live fixture owner',{flag:'wx'});
  let delivery;
  try { delivery=f.controller.deliver(f.root,'chat',result,event.event); }
  finally { fs.unlinkSync(lock); }
  assert.equal(delivery.retention.status,'index_busy');
  assert.equal(f.session('chat').responses.some(r=>r.response_id===delivery.response_id),false);
  const target={record:JSON.parse(fs.readFileSync(delivery.locator))};
  assert.equal((await f.all(target,{},false)).last.status,'complete');
  const errors=f.session('chat').errors;
  assert.equal(errors.at(-1).phase,'history');
  assert.equal(errors.at(-1).response_id,delivery.response_id);
  assert.equal(fs.existsSync(delivery.locator.replace(/\.json$/,'.pending-index')),false);
  assert.equal(f.session('chat').responses.filter(r=>r.response_id===delivery.response_id).length,1);
});
observe(22,'a context-free contended end blocks old work and a new prompt preserves uncertainty',async t=>{
  const f=fixture(t),target=await f.native(),lock=path.join(f.root,'context','history.lock');
  fs.writeFileSync(lock,'live fixture owner',{flag:'wx'});
  try {
    const ended=await f.native('turn_stop','chat','user');
    assert.deepEqual(ended.value,{});
    assert.equal(fs.readFileSync(lock,'utf8'),'live fixture owner');
  } finally { fs.unlinkSync(lock); }
  assert.equal((await f.read(target)).status,'turn_interrupted');
  assert.equal((await f.call('record',target.resolved.context.procedure.submission.example)).value.context.status,'turn_interrupted');
  const next=await f.native();
  assert.deepEqual(next.resolved.context.prior_turn,{turn:1,state:'interrupted',origin:'unknown',response_delivery:'unknown',continuation_permitted:false});
  assert.equal((await f.call('record',next.resolved.context.procedure.submission.example)).value.context.status,'record_accepted');
});
observe(23,'independent delivery evidence survives unknown closure, and a stale end leaves a new turn active',async t=>{
  const f=fixture(t);await f.native();
  const ended=await f.call('enforcement',{native:'End',event:'turn_stop',chat:'chat',turn:1,origin:'unknown',response_delivery:'observed'});
  assert.deepEqual(ended.value,{});
  const next=await f.native();
  assert.equal(next.resolved.context.prior_turn.origin,'unknown');
  assert.equal(next.resolved.context.prior_turn.response_delivery,'observed');
  assert.equal(next.resolved.context.prior_turn.continuation_permitted,false);
  await f.call('enforcement',{native:'End',event:'turn_stop',chat:'chat',turn:1,origin:'user'});
  assert.equal(f.session('chat').turn_state.state,'active');
});
observe(24,'an omitted segment cannot establish complete semantic delivery',async t=>{
  const f=fixture(t),target=await f.native();
  const first=await f.read(target);
  assert.equal(first.status,'partial');
  const missing=await f.read(target,{offset:first.next_offset+1});
  assert.equal(missing.status,'correlation_conflict');
  assert.equal(f.session('chat').acquisition.complete,false);
  const complete=await f.all(target,{},false);
  assert.equal(complete.last.total_bytes,Buffer.byteLength(codec.encode(complete.record)));
});
observe(25,'distributed operation callbacks preserve current state when only indexing is contended',async t=>{
  const f=fixture(t);await f.native();
  const lock=path.join(f.root,'context','history.lock');
  const run=promisify(execFile);
  function dispatch(native,event){
    const child=run(process.execPath,['dist/oop-enforce.js',f.root,'enforcement'],{windowsHide:true});
    child.child.stdin.end(JSON.stringify({native,event,chat:'chat'}));
    return child;
  }
  fs.writeFileSync(lock,'live fixture owner',{flag:'wx'});
  try {
    const results=await Promise.all([dispatch('Before','operation_entry'),dispatch('After','operation_completion')]);
    const records=results.map(({stdout})=>{
      const text=JSON.parse(stdout).context;
      assert.match(text,/Verify current kernel and index/);
      assert.doesNotMatch(text,/History indexing is busy|CONTEXT DEFERRED/);
      return JSON.parse(fs.readFileSync(JSON.parse(text.match(/context in: ("[^\n]+")/)[1])));
    });
    assert.deepEqual(records.map(r=>r.event),['operation_entry','operation_completion']);
    assert.equal(new Set(records.map(r=>r.response_id)).size,2);
    for(const record of records){
      assert.equal(record.status,'available');
      assert.equal(record.context.current.turn,1);
      assert.ok(fs.existsSync(path.join(f.root,'context','chat',record.response_id+'.pending-index')));
    }
    assert.equal(fs.readFileSync(lock,'utf8'),'live fixture owner');
  } finally { fs.unlinkSync(lock); }
  assert.equal((await f.call('snapshot',{event:'snapshot',chat:'chat'})).value.context.turn,1);
});

observe(33,'index-only contention preserves mandatory light and a pending stop still prevents it',async t=>{
  const f=fixture(t,'complete',true),first=await f.native();
  await f.all(first,{},false);
  const lock=path.join(f.root,'context','history.lock');
  fs.writeFileSync(lock,'live fixture owner',{flag:'wx'});
  try{
    for(let n=0;n<3;n++){
      const callback=await f.native('operation_entry');
      assert.match(callback.text,/^OOP — CONTEXT REMINDER/);
      assert.doesNotMatch(callback.text,/History indexing is busy/);
      assert.ok(fs.existsSync(callback.file.replace(/\.json$/,'.pending-index')));
    }
    await f.native('turn_stop','chat','user');
    const stopped=await f.native('operation_completion');
    assert.match(stopped.text,/^OOP — TURN ENDED/);
    assert.equal((await f.read(first)).status,'turn_interrupted');
    assert.equal(fs.readFileSync(lock,'utf8'),'live fixture owner');
  } finally{fs.unlinkSync(lock);}
});

observe(34,'response, adapter and optional pointer carry one exact source-bound delivery policy',async t=>{
  const f=fixture(t),response=await f.native();
  const policy=response.record.context.delivery_policy;
  const template=fs.readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
  const declaration=JSON.parse(template.match(/^\/\/ OOP DELIVERY POLICY (.+)$/m)[1]);
  const pointer=JSON.parse(fs.readFileSync('dist/interfaces.json','utf8')).enforcement.delivery_policy;
  assert.deepEqual(policy,declaration);
  assert.deepEqual(policy,pointer);
  assert.equal(f.controller.verifyDeliveryPolicy(pointer).status,'present_and_integral');
  assert.equal(f.controller.verifyDeliveryPolicy({...pointer,text:pointer.text.slice(0,-16)}).status,'incomplete_or_altered');
  assert.equal(f.controller.verifyDeliveryPolicy({...pointer,source_binding:{source_identity:'other'}}).status,'source_or_version_unavailable');
  assert.equal(f.controller.verifyDeliveryPolicy(undefined).status,'missing');
  assert.equal((await f.all(response,{},false)).last.status,'complete');
  const installed=path.join(f.root,'oop-runtime-adapter.js');
  fs.writeFileSync(installed,fs.readFileSync(installed,'utf8').replace(/^\/\/ OOP DELIVERY POLICY .+\r?\n/m,''));
  assert.equal((await f.call('enforcement',{native:'Prompt',event:'prompt',chat:'chat'})).stdout,'');
});

observe(26,'one contention deadline applies to equivalent targets without removing the owner',async t=>{
  const f=fixture(t),one=await f.native(),two=await f.native('operation_entry');
  const folder=path.join(f.root,'context'),lock=path.join(folder,'history.lock');
  fs.writeFileSync(lock,'fixture owner',{flag:'wx'});
  try {
    const result=await f.read(one);
    assert.equal(result.status,'busy');assert.equal(result.reason,'history_acquisition_busy');
    const past=new Date(Date.now()-codec.bounds.contention_ms-1000);
    fs.utimesSync(path.join(folder,'chat','contention-1.json'),past,past);
    assert.equal((await f.read(two,{transaction:'replacement'})).status,'recovery_budget_exhausted');
    assert.equal(fs.readFileSync(lock,'utf8'),'fixture owner');
  } finally { fs.unlinkSync(lock); }
  await f.all(one,{},false);
});
observe(27,'a direct accepted revision invalidates an already indexed context',async t=>{
  const f=fixture(t),old=await f.native();
  assert.equal((await f.call('record',old.resolved.context.procedure.submission.example)).exitCode,0);
  const result=await f.read(old);
  assert.equal(result.status,'context_changed');assert.equal(result.current_version,2);
  const current=await f.native('operation_completion');
  const acquired=await f.all(current,{},false);
  assert.equal(acquired.record.context.current.version,2);
});
observe(28,'bounded retention preserves a second active session under a large owned inventory',async t=>{
  const f=fixture(t),left=await f.native('prompt','left'),right=await f.native('prompt','right');
  const folder=path.dirname(left.file),base=Buffer.alloc(49378);
  for(let n=0;n<756;n++)fs.writeFileSync(path.join(folder,'owned-'+n+'.json'),base);
  const registration=JSON.parse(fs.readFileSync(path.join(f.root,'oop-context-registration.json')));
  const event={event:'operation_completion',chat:'right'};
  const result=f.controller.deliver(f.root,'right',f.controller.compose(registration,event),event.event);
  assert.ok(Number.isFinite(result.retention.lock_ms));
  assert.ok(result.retention.removed<=64);
  assert.ok(fs.existsSync(right.file)&&fs.existsSync(left.file));
  await f.all(right,{chat:'right'},false);
});

observe(29,'orphan recovery requires an exact owner proof, a conditional quarantine and correlated readback',async t=>{
  const f=fixture(t),scope={installation:'install',resource:'history'};
  const target={authority:'verified',ownership:'verified',identity:'lock-1',owner_instance:'process-instance-1'};
  let owner=target.owner_instance,ownerState='active',quarantines=0,lockIdentity=target.identity;
  const backend={
    read:async actual=>{assert.deepEqual(actual,scope);return target;},
    proveOwner:async()=>({status:ownerState,owner_instance:owner,evidence:'independent-process-provider'}),
    quarantineIfUnchanged:async(actual,identity)=>{
      assert.deepEqual(actual,scope);quarantines++;
      return lockIdentity===identity?{status:'quarantined',identity,evidence:'conditional-write-receipt'}:{status:'changed'};
    },
    verify:async()=>({state:'verified',index:'verified',operation:'verified',lock_identity:target.identity,operation_identity:'new-readback'})
  };
  assert.equal((await f.controller.recoverHistoryLock(scope)).status,'blocked');
  assert.equal((await f.controller.recoverHistoryLock(scope,backend)).status,'blocked');
  ownerState='terminated';owner='another-instance';
  assert.equal((await f.controller.recoverHistoryLock(scope,backend)).status,'blocked');
  assert.equal(quarantines,0);
  owner=target.owner_instance;lockIdentity='successor';
  assert.equal((await f.controller.recoverHistoryLock(scope,backend)).reason,'lock_identity_changed');
  lockIdentity=target.identity;
  assert.equal((await f.controller.recoverHistoryLock(scope,backend)).status,'recovered');
});
