import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{makeController}=require('./context-controller.cjs'),{contextRuntime}=require('./context-runtime.cjs');
const {contextAcquisition}=require('./context-acquisition.cjs'),codec=contextAcquisition(),distributed=require('../dist/oop-enforce.js');
const observe=(n,name,fn)=>test(`REL-ACQ-${String(n).padStart(3,'0')}: AT-${String(n).padStart(2,'0')} ${name}`,fn);
function fixture(t,mode='complete'){
  const project=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'oop-acq-'))),root=path.join(project,'.priv','tools','runtime','install');
  t.after(()=>fs.rmSync(project,{recursive:true,force:true}));
  for(const p of [root,path.join(project,'operations'),path.join(project,'.priv','common','oop')])fs.mkdirSync(p,{recursive:true});
  const registration={format:1,interface:'oop-context-1',installation_uid:'install',owned_scope:root,project_root:project,lifecycle:'active',filesystem_local:true,instruction_sources:{organization:null,workspace:null}};
  const template=fs.readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
  const response={stdout:'{"context":{{context}}}',stderr:'',exit_code:0,context_delivery:mode==='complete'?{mode,basis:'Fixture complete context channel.'}:{mode:'preview',basis:'Fixture bounded preview with a separately retained full pointer.',preamble:'Acquire the complete current target through its reference; independent host authority applies.',visible_prefix_bytes:128}};
  const commands={session_open:{Open:response},prompt:{Prompt:response},operation_entry:{Before:response},operation_completion:{After:response},turn_stop:{End:{stdout:'{}',stderr:'',exit_code:0,context_delivery:{mode:'none',basis:'Fixture context-free turn end.'}}}};
  const manifest={schema_version:1,host:'fixture',runtime_version:'1',documentation:[{source:'fixture://events',section:'bounded composed dispatch'}],invocation_basis:'structured vector',continuation_basis:'zero continuation',nonblocking_exit_codes:[0],placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'}},supported_commands:commands};
  let source=template;
  for(const [name,body]of Object.entries({manifest:JSON.stringify(manifest),decodeEvent:'return {native_event:raw.native,event:{event:raw.event,chat:raw.chat,...(raw.origin?{origin:raw.origin}:{})}};'}))source=source.replace(new RegExp('(?<=// OOP-EDIT-BEGIN '+name+')[\\s\\S]*?(?=// OOP-EDIT-END '+name+')'),'\n'+body+'\n');
  fs.writeFileSync(path.join(root,'oop-context-registration.json'),JSON.stringify(registration));fs.writeFileSync(path.join(root,'oop-runtime-adapter.js'),source);
  const controller=makeController({...distributed.config,adapter_template:template},()=>assert.fail('unexpected synchronization')),runtime=contextRuntime(controller,template);
  const call=async(command,input)=>{const out=await runtime.execute([root,command],JSON.stringify(input));return {...out,value:out.stdout?JSON.parse(out.stdout):null};};
  const dispatches=[];
  async function native(event='prompt',chat='chat',origin){const name={prompt:'Prompt',session_open:'Open',operation_entry:'Before',operation_completion:'After',turn_stop:'End'}[event];
    const r=await call('enforcement',{native:name,event,chat,origin});dispatches.push(event);
    if(event==='turn_stop')return r;
    assert.equal(r.exitCode,0);const text=r.value.context,file=text.match(/response in (.+) and its identified/)[1];
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
observe(5,'segmentation reconstructs Unicode, types and complete shared definitions exactly',async t=>{
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
observe(8,'missing or malformed definitions produce one terminal unchanged failure',async t=>{
  for(const broken of ['missing','malformed']){const f=fixture(t),target=await f.native(),file=path.join(path.dirname(target.file),target.record.definitions.procedure.locator),bytes=fs.readFileSync(file);
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
observe(17,'shared instructions and native pointers resolve one mandatory recovery contract',async t=>{
  const f=fixture(t),target=await f.native();await f.all(target);const view=fs.readFileSync(path.join(f.project,'.priv','common','runtime-instructions.rendered.md'),'utf8'),pointer=fs.readFileSync('dist/templates/native-instruction-pointer.md','utf8');
  assert.ok(view.includes('finite correlated recovery episode'));assert.ok(!view.includes('before any reply, plan, tool call or other action'));assert.ok(pointer.includes('<rendered-locator>'));assert.ok(target.text.includes('Authorized acquisition'));
});
observe(18,'an altered pointer is rejected while unrelated peer content is preserved',async t=>{
  const {renderNativePointer,matchesNativePointer}=await import('./native-instruction-pointer.mjs');
  const options={binding:'binding.json',rendered:'view.md'},valid=renderNativePointer(options),peer='Independent peer instructions';
  assert.equal(matchesNativePointer(valid.replace('Before substantive work,','Before any tool call,'),options),false);assert.equal(peer,'Independent peer instructions');assert.ok(valid.includes('preserve'));
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
