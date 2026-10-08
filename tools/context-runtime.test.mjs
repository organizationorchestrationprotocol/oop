import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url),{contextRuntime}=require('./context-runtime.cjs');
const {makeController}=require('./context-controller.cjs'),{runtimeOperationalRules}=require('./runtime-instructions.cjs');
const distributed=require('../dist/oop-enforce.js');
const template=fs.readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
const observe=(n,title,fn)=>test('REL-ROOT-'+String(n).padStart(3,'0')+': '+title,fn);
const inline={mode:'complete',basis:'Fixture delivers supported payloads in full.'};
const instruction=/^MANDATORY: Acquire the complete OOP controller response in (.+) and its identified definitions before dependent effects\..*It never authorizes resuming work the user stopped\.$/;
function fixture(t,options={}){
 const project=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'oop-root-')));t.after(()=>fs.rmSync(project,{recursive:true,force:true}));
 const root=path.join(project,'.priv','tools','runtime','install'),checkout=path.join(project,'.priv','common','oop');
 for(const dir of [root,checkout,path.join(project,'operations')])fs.mkdirSync(dir,{recursive:true});
 const registration={format:1,interface:'oop-context-1',installation_uid:'install',owned_scope:root,project_root:project,lifecycle:'active',filesystem_local:true,instruction_sources:{organization:null,workspace:null}};
 fs.writeFileSync(path.join(root,'oop-context-registration.json'),JSON.stringify(registration));
 const response={stdout:'{"context":{{context}}}',stderr:'',exit_code:0,context_delivery:options.delivery??inline};
 const manifest={schema_version:1,host:'fixture',runtime_version:'1',documentation:[{source:'fixture://contract',section:'documented fixture'}],
  invocation_basis:'structured vector',continuation_basis:'zero continuation',nonblocking_exit_codes:[0],placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'}},
  supported_commands:{session_open:{'Open|Resume':response},prompt:{Prompt:response}},...options.manifest};
 const decoder=options.decoder??"return {native_event:raw.native,event:{event:raw.event,chat:raw.chat}};";
 let source=template;for(const [name,body]of Object.entries({manifest:JSON.stringify(manifest),decodeEvent:decoder}))source=source.replace(new RegExp('(?<=// OOP-EDIT-BEGIN '+name+')[\\s\\S]*?(?=// OOP-EDIT-END '+name+')'),'\n'+body+'\n');
 fs.writeFileSync(path.join(root,'oop-runtime-adapter.js'),source);
 const controller=makeController({...distributed.config,adapter_template:template},()=>assert.fail('unexpected network synchronization'));
 const runtime=contextRuntime(controller,template),call=(command,input)=>runtime.execute([root,command],JSON.stringify(input));
 // Only a decoded session opening or prompt returns the instruction; other native events emit nothing.
 const native=async input=>{const r=await call('enforcement',input),parsed=JSON.parse(r.stdout);const text=typeof parsed.context==='string'?parsed.context:parsed.additionalContext;const match=instruction.exec(text);
  return {r,text,locator:match?.[1],response:match&&fs.existsSync(match[1])?controller.resolveResponse(JSON.parse(fs.readFileSync(match[1],'utf8')),path.dirname(match[1])):null};};
 const session=chat=>JSON.parse(fs.readFileSync(path.join(root,'context',chat+'.json'),'utf8'));
 return {project,root,registration,runtime,controller,manifest,call,native,session};
}
observe(1,'root-first command is mandatory and direct calls bind both root components',async t=>{
 const f=fixture(t);for(const args of [[],[f.root],[f.root,'snapshot','extra'],['context','--registration'],[f.root,'errors-read'],[f.root,'errors-ack']])assert.equal((await f.runtime.execute(args,'{}')).exitCode,1);
 assert.equal((await f.call('prompt',{event:'prompt',chat:'chat'})).exitCode,0);
});
observe(2,'missing registration or adapter fails even a direct snapshot without an error journal',async t=>{
 for(const file of ['oop-context-registration.json','oop-runtime-adapter.js']){const f=fixture(t);fs.unlinkSync(path.join(f.root,file));const r=await f.call('snapshot',{event:'snapshot',chat:'chat'});
  assert.equal(r.exitCode,1);assert.ok(['registration_missing','adapter_missing'].includes(JSON.parse(r.stdout).context.diagnostic.code));assert.equal(fs.existsSync(path.join(f.root,'oop-enforce-errors.jsonl')),false);}
});
observe(3,'native failures are stored in the response file without exception text or raw input',async t=>{
 const f=fixture(t,{decoder:"throw Error('credential-secret');"});const r=await f.call('enforcement',{native:'Prompt',event:'prompt',chat:'chat',secret:'raw-secret'});
 assert.deepEqual(r,{stdout:'',stderr:'',exitCode:0});const unbound=path.join(f.root,'context','unbound'),[name]=fs.readdirSync(unbound).filter(n=>n.startsWith('r-')),locator=path.join(unbound,name);
 const response=f.controller.resolveResponse(JSON.parse(fs.readFileSync(locator,'utf8')),path.dirname(locator));
 assert.equal(response.status,'context_unavailable');assert.equal(response.context.diagnostic.code,'adapter_execution_failed');{const stored=fs.readFileSync(locator,'utf8');assert.ok(!stored.includes('credential-secret')&&!stored.includes('raw-secret'));}
 const direct=await f.runtime.execute([f.root,'snapshot'],'not-json');assert.equal(direct.exitCode,1);assert.equal(JSON.parse(direct.stdout).context.diagnostic.code,'input_invalid');
 assert.equal(fs.existsSync(path.join(f.root,'oop-enforce-errors.jsonl')),false);
});
observe(4,'literal grouped selectors choose actual events and deliver only the reading instruction',async t=>{
 const f=fixture(t);for(const native of ['Open','Resume']){const n=await f.native({native,event:'session_open',chat:'chat'});assert.equal(n.r.exitCode,0);assert.match(n.text,instruction);
  assert.ok(n.response.instructions[0].includes('shared rendered view'));assert.equal(n.response.event,'session_open');}
 const bad=await f.call('enforcement',{native:'Open|Resume',event:'session_open',chat:'chat'});assert.deepEqual(bad,{stdout:'',stderr:'',exitCode:0});
 const unbound=path.join(f.root,'context','unbound'),stored=fs.readdirSync(unbound).filter(n=>n.startsWith('r-')).map(name=>f.controller.resolveResponse(JSON.parse(fs.readFileSync(path.join(unbound,name),'utf8')),unbound));
 assert.deepEqual(stored.map(r=>r.context.diagnostic.code),['native_event_invalid']);
});
observe(5,'typed required and optional placeholders are single-pass and escaped',t=>{
 const f=fixture(t),m={placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'},optional:{source:'response.missing',type:'string',required:false,encoding:'text',absent:'default'}}};
 const spec={stdout:'{{context}}',stderr:'',exit_code:0,context_delivery:inline};
 const output=f.runtime.render({...spec,stdout:'{{context}} {{optional}} {{{{literal}}}}'},m,{additionalContext:'{{optional}}\n"',response:{}});
 assert.equal(output.stdout,JSON.stringify('{{optional}}\n"')+' default {{literal}}');
 assert.throws(()=>f.runtime.render(spec,m,{response:{}}),/placeholder_invalid/);
 assert.throws(()=>f.runtime.render(spec,m,{additionalContext:4,response:{}}),/placeholder_invalid/);
});
observe(6,'rejected records name every failing field without echoing free text',async t=>{
 const f=fixture(t),prompt=JSON.parse((await f.call('prompt',{event:'prompt',chat:'chat'})).stdout).context;
 const example=prompt.procedure.submission.example;
 const r=await f.call('record',{...example,request_id:'bad id',related_ticket:'false',level:'g1'});assert.equal(r.exitCode,1);
 const items=JSON.parse(r.stdout).context.diagnostic.items;
 assert.deepEqual(items.map(i=>i.field).sort(),['level','related_ticket','request_id']);
 assert.deepEqual(items.find(i=>i.field==='related_ticket'),{field:'related_ticket',rule:'type',expected:'boolean',received:'string'});
 assert.equal(items.find(i=>i.field==='request_id').received,'string(length 6)');assert.equal(items.find(i=>i.field==='level').received,'string(length 2)');
 assert.ok(!r.stdout.includes('bad id'));
 const accepted=await f.call('record',example);assert.equal(accepted.exitCode,0);assert.equal(JSON.parse(accepted.stdout).context.status,'record_accepted');
});
observe(7,'stale or unreachable transitions return current turn, version and allowed states',async t=>{
 const f=fixture(t),prompt=JSON.parse((await f.call('prompt',{event:'prompt',chat:'chat'})).stdout).context,example=prompt.procedure.submission.example;
 const intake=JSON.parse((await f.call('record',{...example,state:'intake'})).stdout).context.diagnostic;
 assert.deepEqual(intake.items,[{field:'state',rule:'reachable_state',expected:['inquiry','planning','recovery'],received:'intake'}]);
 assert.deepEqual(intake.current,{turn:prompt.turn,version:prompt.version,subject_state:null,allowed_states:['inquiry','planning','recovery']});
 const first=JSON.parse((await f.call('record',{...example,request_id:'r-2',state:'planning'})).stdout).context.receipt;
 const stale=JSON.parse((await f.call('record',{...example,request_id:'r-3',state:'execution'})).stdout).context.diagnostic;
 assert.deepEqual(stale.items,[{field:'expected_version',rule:'current_version',expected:first.version,received:example.expected_version}]);
 assert.equal(stale.current.subject_state,'planning');assert.ok(stale.current.allowed_states.includes('execution'));
 assert.equal(JSON.parse((await f.call('record',{...example,request_id:'r-4',state:'execution',expected_version:first.version})).stdout).context.status,'record_accepted');
});
observe(8,'response files are immutable, line-bounded and indexed in the session file',async t=>{
 const f=fixture(t),one=await f.native({native:'Prompt',event:'prompt',chat:'chat'}),bytes=fs.readFileSync(one.locator);
 const two=await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 assert.notEqual(one.locator,two.locator);assert.deepEqual(fs.readFileSync(one.locator),bytes);
 assert.equal(two.response.context.current.turn,one.response.context.current.turn+1);
 for(const file of [one.locator,two.locator])assert.ok(fs.readFileSync(file,'utf8').split('\n').every(line=>Buffer.byteLength(line)<=4096));
 const index=f.session('chat').responses;assert.deepEqual(index.map(i=>i.locator),[one.locator,two.locator]);assert.equal(index[1].turn,two.response.context.current.turn);
 assert.equal(path.dirname(one.locator),path.join(f.root,'context','chat'));
});
observe(9,'an observed error journal is retired once its lock is absent and disclosed once',async t=>{
 const f=fixture(t),journal=path.join(f.root,'oop-enforce-errors.jsonl'),lock=path.join(f.root,'oop-enforce-errors.lock');
 fs.writeFileSync(journal,'{"uid":"a","read":false}\n{"uid":"b","read":false}\n{"uid":"c","read":true}\n');fs.writeFileSync(lock,'unverified owner');
 await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.equal(fs.existsSync(journal),true);assert.equal(fs.readFileSync(lock,'utf8'),'unverified owner');
 fs.unlinkSync(lock);await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.equal(fs.existsSync(journal),false);
 const errors=JSON.parse((await f.call('snapshot',{event:'snapshot',chat:'chat'})).stdout).context.session_errors;
 assert.equal(errors.filter(e=>e.code==='legacy_journal_retired').length,1);assert.match(errors.at(-1).message,/2 unread entries were discarded/);
});
observe(10,'unknown event has no invented event-specific response and empty contexts cannot pass',async t=>{
 const f=fixture(t),n=await f.call('enforcement',{native:'Other',event:'prompt',chat:'chat'});assert.deepEqual(n,{stdout:'',stderr:'',exitCode:0});
 assert.equal(f.session('chat').errors.at(-1).code,'native_event_invalid');
 assert.throws(()=>f.runtime.validateManifest({...f.manifest,supported_commands:{...f.manifest.supported_commands,prompt:{Prompt:{stdout:'',stderr:'',exit_code:0}}}}),/manifest_invalid/);
});
observe(11,'peer installations keep separate session stores',async t=>{
 const one=fixture(t),two=fixture(t),a=await one.native({native:'Prompt',event:'prompt',chat:'chat'}),b=await two.native({native:'Prompt',event:'prompt',chat:'chat'});
 assert.ok(a.locator.startsWith(one.root));assert.ok(b.locator.startsWith(two.root));assert.equal(one.session('chat').responses.length,1);assert.equal(two.session('chat').responses.length,1);
});
observe(12,'independent processes each receive a distinct existing response file',async t=>{
 const f=fixture(t);const outputs=await Promise.all(Array.from({length:6},()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['dist/oop-enforce.js',f.root,'enforcement'],{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='';child.on('error',reject);child.stdout.on('data',d=>out+=d);child.stderr.resume();
  child.on('close',code=>resolve({code,out}));child.stdin.end(JSON.stringify({native:'Prompt',event:'prompt',chat:'chat'}));
 })));assert.ok(outputs.every(o=>o.code===0));
 const locators=outputs.map(o=>instruction.exec(JSON.parse(o.out).context)[1]);assert.equal(new Set(locators).size,6);assert.ok(locators.every(file=>fs.existsSync(file)));
});
observe(13,'automatic context directs the runtime to the mandatory procedure in shared Markdown',async t=>{
 const f=fixture(t),r=await f.call('prompt',{event:'prompt',chat:'chat'});const rendered=fs.readFileSync(path.join(f.project,'.priv','common','runtime-instructions.rendered.md'),'utf8');assert.ok(rendered.includes(runtimeOperationalRules()));assert.ok(!JSON.parse(r.stdout).additionalContext.includes(runtimeOperationalRules()));assert.ok(rendered.startsWith('<!-- OOP mandatory procedures: begin;'));
 assert.ok(rendered.includes('core governs authority'));assert.ok(rendered.includes('no acknowledgment command exists'));assert.ok(!rendered.includes('errors-ack'));
});
observe(14,'snapshot exposes session errors without creating a turn or claiming correction',async t=>{
 const f=fixture(t),prompt=JSON.parse((await f.call('prompt',{event:'prompt',chat:'chat'})).stdout).context;await f.call('enforcement',{native:'Other',event:'prompt',chat:'chat'});
 const snapshot=JSON.parse((await f.call('snapshot',{event:'snapshot',chat:'chat'})).stdout).context;assert.equal(snapshot.turn,prompt.turn);assert.equal(snapshot.version,prompt.version);
 assert.equal(snapshot.session_errors.at(-1).code,'native_event_invalid');assert.match(snapshot.session_errors.at(-1).message,/Presentation is not resolution/);
});
observe(17,'contended history preserves the lock and still delivers a readable response',async t=>{
 const f=fixture(t);await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 const lock=path.join(f.root,'context','history.lock');fs.writeFileSync(lock,'unverified owner',{flag:'wx'});
 const blocked=await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.equal(blocked.response.context.busy_phase,'history');
 assert.match(blocked.response.context.busy_recovery,/correlated receipts before any bounded retry/);assert.equal(fs.readFileSync(lock,'utf8'),'unverified owner');
 fs.unlinkSync(lock);const recovered=await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.equal(recovered.response.context.busy_phase,undefined);
 assert.ok(f.session('chat').responses.some(entry=>entry.locator===recovered.locator));
});
observe(18,'unavailable response storage still delivers the instruction naming the limitation',async t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.root,'context'),'not a directory');const n=await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 assert.equal(n.r.exitCode,0);assert.match(n.text,instruction);assert.match(n.locator,/response storage unavailable/);assert.equal(n.response,null);
});
observe(15,'pruning removes idle, oversize and unindexed old files but never the current or an active session',async t=>{
 const f=fixture(t),context=path.join(f.root,'context');fs.mkdirSync(context,{recursive:true});
 const old=Date.now()/1000-40*86400,recent=Date.now()/1000-3600;
 const write=(name,body,time)=>{const file=path.join(context,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);fs.utimesSync(file,time,time);return file;};
 const idle=write('idle.json','{}',old),active=write('active.json','{}',recent),oversize=write('big.json','x'.repeat(400*1024),Date.now()/1000-2*86400);
 const orphan=write('chat.json.123.tmp','x',old);
 await f.native({native:'Prompt',event:'prompt',chat:'chat'});const keep=await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 const stray=write(path.join('chat','r-stray.json'),'{}',old);await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 for(const file of [idle,oversize,orphan,stray])assert.equal(fs.existsSync(file),false,file);
 for(const file of [active,keep.locator])assert.equal(fs.existsSync(file),true,file);
 const retention=f.session('chat');assert.ok(retention.responses.length<=16);
});
observe(16,'manifest rejects overlapping events, duplicate keys, context omission and blocking exits',async t=>{
 const f=fixture(t),response={stdout:'{{context}}',stderr:'',exit_code:0,context_delivery:inline};
 for(const m of [{...f.manifest,supported_commands:{...f.manifest.supported_commands,prompt:{'A|B':response,B:response}}},{...f.manifest,placeholders:{context:{source:'response.__proto__.value',type:'string',required:true,encoding:'text'}}},{...f.manifest,supported_commands:{...f.manifest.supported_commands,prompt:{Prompt:{...response,exit_code:11}}}}])assert.throws(()=>f.runtime.validateManifest(m));
 const doubled=structuredClone(f.manifest);doubled.supported_commands.prompt.Prompt.stdout='{{context}}{{context}}';assert.throws(()=>f.runtime.validateManifest(doubled));
 const escaped=structuredClone(f.manifest);escaped.supported_commands.prompt.Prompt.stdout='{{{{context}}}}';assert.throws(()=>f.runtime.validateManifest(escaped));
 const file=path.join(f.root,'oop-runtime-adapter.js');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('"schema_version":1','"schema_version":1,"schema_version":1'));
 const bad=await f.call('prompt',{event:'prompt',chat:'chat'});assert.equal(bad.exitCode,1);assert.equal(JSON.parse(bad.stdout).context.diagnostic.code,'manifest_invalid');
});
observe(19,'preview variants emit a bounded preamble before the full unchanged context',async t=>{
 const preamble='If a preview has a reference, read the entire current context. If unavailable, report it and continue only independent work.';
 const visible_prefix_bytes=Buffer.byteLength(preamble+'\n');
 const delivery={mode:'preview',basis:'Fixture preview begins at the context boundary.',preamble,visible_prefix_bytes};
 const f=fixture(t,{delivery}),spec=f.manifest.supported_commands.prompt.Prompt;
 for(const payload of ['short "text"', 'é'.repeat(300)+' {{context}} END']){
  const result=f.runtime.render(spec,f.manifest,{additionalContext:payload,response:{additionalContext:payload}});
  assert.equal(result.exitCode,0);
  assert.equal(result.stderr,'');
  const decoded=JSON.parse(result.stdout).context;
  assert.equal(decoded,preamble+'\n'+payload);
  assert.equal(Buffer.from(decoded).subarray(0,visible_prefix_bytes).toString(),preamble+'\n');
 }
 for(const [native,event] of [['Open','session_open'],['Resume','session_open'],['Prompt','prompt']]){
  const result=await f.call('enforcement',{native,event,chat:'chat'});
  assert.equal(result.exitCode,0);
  const decoded=JSON.parse(result.stdout).context;
  assert.ok(decoded.startsWith(preamble+'\n'));assert.match(decoded.slice(preamble.length+1),instruction);
 }
 for(const context_delivery of [undefined,{...delivery,visible_prefix_bytes:visible_prefix_bytes-1},{...delivery,preamble:' '}]) {
  const manifest=structuredClone(f.manifest);
  manifest.supported_commands.prompt.Prompt.context_delivery=context_delivery;
  assert.throws(()=>f.runtime.validateManifest(manifest),/manifest_invalid/);
 }
 const unavailable={...spec,context_delivery:{mode:'unavailable',basis:'Fixture lacks authorized retrieval.'}};
 const manifest=structuredClone(f.manifest);
 manifest.supported_commands.prompt.Prompt=unavailable;
 assert.doesNotThrow(()=>f.runtime.validateManifest(manifest));
 assert.equal(JSON.parse(f.runtime.render(unavailable,manifest,{additionalContext:'complete handoff',response:{}}).stdout).context,'complete handoff');
});
// PROP-09: declared byte budgets for actual executions of the distributed controller.
const budgets=JSON.parse(fs.readFileSync('tools/fixtures/controller-budgets.json','utf8'));
function measure(t){
 const f=fixture(t),run=(command,input)=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['dist/oop-enforce.js',f.root,command],{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='';
  child.on('error',reject);child.stdout.on('data',d=>out+=d);child.stderr.resume();child.on('close',code=>resolve({code,out}));child.stdin.end(JSON.stringify(input));});
 return {f,run};
}
observe(20,'controller executions stay within the declared byte budgets',async t=>{
 const {f,run}=measure(t),bytes=value=>Buffer.byteLength(value);
 const native=await run('enforcement',{native:'Prompt',event:'prompt',chat:'chat'});assert.equal(native.code,0);
 const locator=instruction.exec(JSON.parse(native.out).context)[1],response=fs.readFileSync(locator,'utf8'),example=JSON.parse(response).context.procedure.submission.example;
 const accepted=await run('record',{...example,state:'planning'}),rejected=await run('record',{...example,request_id:'r-2',state:'intake'}),snapshot=await run('snapshot',{event:'snapshot',chat:'chat'});
 const definition=JSON.parse(response).definitions.procedure.locator;
 const measured={native_instruction:bytes(native.out),native_response_file:bytes(response),procedure_definition:fs.statSync(path.join(path.dirname(locator),definition)).size,record_accepted:bytes(accepted.out),record_rejected:bytes(rejected.out),snapshot:bytes(snapshot.out)};
 t.diagnostic('measured bytes '+JSON.stringify(measured));assert.equal(accepted.code,0);assert.equal(rejected.code,1);assert.equal(snapshot.code,0);
 for(const [scenario,value] of Object.entries(measured))assert.ok(value<=budgets.scenarios[scenario].max_bytes,`${scenario}: ${value} bytes exceeds the declared budget ${budgets.scenarios[scenario].max_bytes}`);
 assert.deepEqual(Object.keys(budgets.scenarios).sort(),Object.keys(measured).sort());
});
observe(21,'direct responses never duplicate context and carry the procedure by identity',async t=>{
 const {run}=measure(t);const native=await run('enforcement',{native:'Prompt',event:'prompt',chat:'chat'});
 const file=instruction.exec(JSON.parse(native.out).context)[1],full=distributed.resolveResponse(JSON.parse(fs.readFileSync(file,'utf8')),path.dirname(file)).context.procedure;
 const accepted=JSON.parse((await run('record',full.submission.example)).out);
 assert.equal(accepted.context.procedure.identity,full.identity);assert.equal(accepted.context.procedure.timing,undefined);
 assert.ok(!accepted.additionalContext.includes('{'));assert.ok(Buffer.byteLength(accepted.additionalContext)<300);
 assert.equal(JSON.stringify(full).split('"reachable"').length-1,Object.keys(full.submission.state_routes).length);
});
// UX-09: turn state machine, context-free turn ends and silent undecoded events.
const stopDecoder="return {native_event:raw.native,event:{event:raw.event,chat:raw.chat,...(raw.origin===undefined?{}:{origin:raw.origin})}};";
function stopOptions(){
 const response={stdout:'{"context":{{context}}}',stderr:'',exit_code:0,context_delivery:inline};
 return {decoder:stopDecoder,manifest:{supported_commands:{session_open:{'Open|Resume':response},prompt:{Prompt:response},
  turn_stop:{'Stop|Interrupt':{stdout:'{}',stderr:'',exit_code:0,context_delivery:{mode:'none',basis:'Fixture turn end accepts no context.'}}}}}};
}
observe(22,'a turn end is recorded and emits only its context-free template',async t=>{
 const f=fixture(t,stopOptions());await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 const r=await f.call('enforcement',{native:'Interrupt',event:'turn_stop',chat:'chat',origin:'user'});
 assert.deepEqual(r,{stdout:'{}',stderr:'',exitCode:0});
 assert.deepEqual(f.session('chat').turn_state,{turn:1,state:'interrupted',origin:'user'});assert.equal(f.session('chat').responses.at(-1).event,'turn_stop');
 await f.call('enforcement',{native:'Stop',event:'turn_stop',chat:'chat',origin:'model'});assert.equal(f.session('chat').turn_state.state,'interrupted');
 for(const [origin,state] of [['model','closed'],['unknown','interrupted']]){
  const g=fixture(t,stopOptions());await g.native({native:'Prompt',event:'prompt',chat:'chat'});
  assert.equal((await g.call('enforcement',{native:'Stop',event:'turn_stop',chat:'chat',origin})).stdout,'{}');assert.equal(g.session('chat').turn_state.state,state);
 }
 const bad=await f.call('enforcement',{native:'Stop',event:'turn_stop',chat:'chat',origin:'other'});
 assert.equal(bad.stdout,'{}');assert.equal(f.session('chat').errors.at(-1).code,'invalid_event');
 const early=fixture(t,stopOptions());assert.equal((await early.call('enforcement',{native:'Stop',event:'turn_stop',chat:'fresh',origin:'user'})).stdout,'{}');
});
observe(23,'records for an interrupted turn are refused and the next prompt reports the stop once',async t=>{
 const f=fixture(t,stopOptions()),first=await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 await f.call('enforcement',{native:'Interrupt',event:'turn_stop',chat:'chat',origin:'user'});
 const refused=await f.call('record',first.response.context.procedure.submission.example),out=JSON.parse(refused.stdout).context;
 assert.equal(refused.exitCode,1);assert.equal(out.status,'turn_interrupted');assert.equal(out.receipt.disposition,'rejected');
 assert.equal(out.diagnostic.items[0].rule,'active_turn');assert.match(out.diagnostic.remedy,/Do not resubmit or resume/);
 assert.equal(JSON.parse((await f.call('snapshot',{event:'snapshot',chat:'chat'})).stdout).context.turn_state.state,'interrupted');
 const next=await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 assert.deepEqual(next.response.context.prior_turn,{turn:1,state:'interrupted',origin:'user'});assert.equal(next.response.context.turn_state,undefined);
 assert.match(next.response.context.procedure.user_stop,/UX-09/);
 const again=await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.equal(again.response.context.prior_turn,undefined);
 assert.equal((await f.call('record',again.response.context.procedure.submission.example)).exitCode,0);
});
observe(24,'manifest confines mode none to context-free nonblocking turn_stop templates',async t=>{
 const f=fixture(t,stopOptions()),m=f.manifest,key='Stop|Interrupt';assert.doesNotThrow(()=>f.runtime.validateManifest(m));
 const variants=[x=>{x.supported_commands.turn_stop[key].stdout='{{context}}';},x=>{x.supported_commands.turn_stop[key].context_delivery=inline;},
  x=>{x.supported_commands.prompt.Prompt.context_delivery={mode:'none',basis:'No context.'};},x=>{x.supported_commands.turn_stop[key].exit_code=2;}];
 for(const change of variants){const x=structuredClone(m);change(x);assert.throws(()=>f.runtime.validateManifest(x),/manifest_invalid/);}
 const escaped=structuredClone(m);escaped.supported_commands.turn_stop[key].stdout='{{{{literal}}}}';assert.doesNotThrow(()=>f.runtime.validateManifest(escaped));
 const plain=fixture(t,{decoder:stopDecoder});await plain.native({native:'Prompt',event:'prompt',chat:'chat'});
 assert.deepEqual(await plain.call('enforcement',{native:'Stop',event:'turn_stop',chat:'chat',origin:'user'}),{stdout:'',stderr:'',exitCode:0});
 assert.equal(plain.session('chat').turn_state.state,'active');
});
observe(25,'undecoded native events emit nothing and are disclosed once at the next delivery',async t=>{
 const f=fixture(t,{decoder:"if(raw.native==='Notice')throw Error('unsupported');return {native_event:raw.native,event:{event:raw.event,chat:raw.chat}};"});
 const first=await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.match(first.text,/It never authorizes resuming work the user stopped\.$/);
 assert.equal(first.response.context.unbound_diagnostics,undefined);
 assert.deepEqual(await f.call('enforcement',{native:'Notice',event:'prompt',chat:'chat'}),{stdout:'',stderr:'',exitCode:0});
 const next=await f.native({native:'Prompt',event:'prompt',chat:'chat'});
 assert.equal(next.response.context.unbound_diagnostics.count,1);assert.ok(next.response.context.unbound_diagnostics.location.endsWith(path.join('context','unbound')));
 const later=await f.native({native:'Prompt',event:'prompt',chat:'chat'});assert.equal(later.response.context.unbound_diagnostics,undefined);
 const missing=await f.runtime.execute([path.join(f.project,'missing'),'enforcement'],'{}');assert.equal(missing.stdout,'');assert.equal(missing.exitCode,0);
});
