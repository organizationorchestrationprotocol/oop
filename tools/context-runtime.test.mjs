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
function fixture(t,options={}){
 const project=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'oop-root-')));t.after(()=>fs.rmSync(project,{recursive:true,force:true}));
 const root=path.join(project,'.priv','tools','runtime','install'),checkout=path.join(project,'.priv','common','oop');
 for(const dir of [root,checkout,path.join(project,'operations')])fs.mkdirSync(dir,{recursive:true});
 const registration={format:1,interface:'oop-context-1',installation_uid:'install',owned_scope:root,project_root:project,lifecycle:'active',filesystem_local:true,instruction_sources:{organization:null,workspace:null}};
 fs.writeFileSync(path.join(root,'oop-context-registration.json'),JSON.stringify(registration));
 const response={stdout:'{"context":{{context}}}',stderr:'',exit_code:0};
 const manifest={schema_version:1,host:'fixture',runtime_version:'1',documentation:[{source:'fixture://contract',section:'documented fixture'}],
  invocation_basis:'structured vector',continuation_basis:'zero continuation',nonblocking_exit_codes:[0],placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'}},
  supported_commands:{session_open:{'Open|Resume':response},prompt:{Prompt:response}},...options.manifest};
 const decoder=options.decoder??"return {native_event:raw.native,event:{event:raw.event,chat:raw.chat}};";
 let source=template;for(const [name,body]of Object.entries({manifest:JSON.stringify(manifest),decodeEvent:decoder}))source=source.replace(new RegExp('(?<=// OOP-EDIT-BEGIN '+name+')[\\s\\S]*?(?=// OOP-EDIT-END '+name+')'),'\n'+body+'\n');
 fs.writeFileSync(path.join(root,'oop-runtime-adapter.js'),source);
 const controller=makeController({...distributed.config,adapter_template:template},()=>assert.fail('unexpected network synchronization'));
 const runtime=contextRuntime(controller,template),call=(command,input)=>runtime.execute([root,command],JSON.stringify(input));
 return {project,root,registration,runtime,controller,manifest,call,rows:()=>JSON.parse('['+fs.readFileSync(path.join(root,'oop-enforce-errors.jsonl'),'utf8').trim().split('\n').join(',')+']')};
}
async function pending(f){const prompt=JSON.parse((await f.call('prompt',{event:'prompt',chat:'chat'})).stdout).context;f.runtime.persist(f.root,Error('input_invalid'));return prompt;}
const ack=(f,current,uids=f.rows().filter(r=>!r.read).map(r=>r.uid))=>({uids,chat:'chat',turn:current.turn,expected_version:current.version,request_id:'ack-1',presentation:{original_shown:true,effective_language:'it',translation:'shown',presented_at:new Date().toISOString()}});
observe(1,'root-first command is mandatory and direct calls bind both root components',async t=>{
 const f=fixture(t);for(const args of [[],[f.root],[f.root,'snapshot','extra'],['context','--registration']])assert.equal((await f.runtime.execute(args,'{}')).exitCode,1);
 assert.equal((await f.call('prompt',{event:'prompt',chat:'chat'})).exitCode,0);
});
observe(2,'missing registration or adapter fails even a direct diagnostic call',async t=>{
 for(const file of ['oop-context-registration.json','oop-runtime-adapter.js']){const f=fixture(t);fs.unlinkSync(path.join(f.root,file));const r=await f.call('errors-read',{chat:'chat'});assert.equal(r.exitCode,1);assert.equal(f.rows().length,1);}
});
observe(3,'errors receive unique unread UIDs without exception text or raw input',async t=>{
 const f=fixture(t,{decoder:"throw Error('credential-secret');"});await f.call('enforcement',{native:'Prompt',event:'prompt',chat:'chat',secret:'raw-secret'});
 await f.runtime.execute([f.root,'snapshot'],'not-json');const rows=f.rows();assert.equal(rows.length,2);assert.notEqual(rows[0].uid,rows[1].uid);assert.ok(rows.every(r=>r.read===false));assert.ok(!JSON.stringify(rows).includes('secret'));
});
observe(4,'literal grouped selectors choose actual events and preserve native output',async t=>{
 const f=fixture(t);for(const native of ['Open','Resume']){const r=await f.call('enforcement',{native,event:'session_open',chat:'chat'});assert.equal(r.exitCode,0);assert.ok(JSON.parse(r.stdout).context.includes('shared rendered view'));}
 const bad=await f.call('enforcement',{native:'Open|Resume',event:'session_open',chat:'chat'});assert.equal(JSON.parse(bad.stdout).context.diagnostic.code,'native_event_invalid');
});
observe(5,'typed required and optional placeholders are single-pass and escaped',t=>{
 const f=fixture(t),m={placeholders:{context:{source:'additionalContext',type:'string',required:true,encoding:'json'},optional:{source:'response.missing',type:'string',required:false,encoding:'text',absent:'default'}}};
 const output=f.runtime.render({stdout:'{{context}} {{optional}} {{{{literal}}}}',stderr:'',exit_code:0},m,{additionalContext:'{{optional}}\n"',response:{}});
 assert.equal(output.stdout,JSON.stringify('{{optional}}\n"')+' default {{literal}}');
 assert.throws(()=>f.runtime.render({stdout:'{{context}}',stderr:'',exit_code:0},m,{response:{}}),/placeholder_invalid/);
 assert.throws(()=>f.runtime.render({stdout:'{{context}}',stderr:'',exit_code:0},m,{additionalContext:4,response:{}}),/placeholder_invalid/);
});
observe(6,'stale or unknown UID batches never partially acknowledge valid entries',async t=>{
 const f=fixture(t),current=await pending(f),input=ack(f,current);const first=f.rows()[0].uid;
 assert.equal((await f.call('errors-ack',{...input,uids:[first,'foreign']})).exitCode,1);assert.equal(f.rows().find(r=>r.uid===first).read,false);
 assert.equal((await f.call('errors-ack',{...input,expected_version:current.version+1})).exitCode,1);assert.equal(f.rows().find(r=>r.uid===first).read,false);
});
observe(7,'actual original and translation presentation is required before acknowledgement',async t=>{
 const f=fixture(t),current=await pending(f),input=ack(f,current);const uid=input.uids[0];
 for(const presentation of [{...input.presentation,original_shown:false},{...input.presentation,translation:'not_required'},{...input.presentation,presented_at:'invalid'}])assert.equal((await f.call('errors-ack',{...input,presentation})).exitCode,1);
 assert.equal(f.rows().find(r=>r.uid===uid).read,false);
});
observe(8,'atomic flags and turn receipt survive lost response and replay without version changes',async t=>{
 const f=fixture(t),current=await pending(f),input=ack(f,current);const accepted=JSON.parse((await f.call('errors-ack',input)).stdout).context;
 assert.equal(accepted.error_receipt.disposition,'accepted');assert.equal(accepted.version,current.version);assert.equal(f.rows()[0].read,true);
 const read=JSON.parse((await f.call('errors-read',{chat:'chat'})).stdout).context;assert.equal(read.errors.receipts[0].request_id,input.request_id);
 await f.call('prompt',{event:'prompt',chat:'chat'});const replay=JSON.parse((await f.call('errors-ack',input)).stdout).context;
 assert.equal(replay.error_receipt.replayed,true);assert.equal(replay.error_receipt.turn,current.turn);assert.equal(replay.turn,current.turn+1);
 assert.equal((await f.call('errors-ack',{...input,uids:['different']})).exitCode,1);
});
observe(9,'interrupted or malformed journal stays byte-identical with explicit storage failure',async t=>{
 const f=fixture(t),file=path.join(f.root,'oop-enforce-errors.jsonl');for(const bytes of ['{"uid":','{}\n']){fs.writeFileSync(file,bytes);const r=await f.call('errors-read',{chat:'chat'});assert.equal(r.exitCode,1);assert.equal(fs.readFileSync(file,'utf8'),bytes);assert.equal(JSON.parse(r.stdout).context.diagnostic.persisted,false);}
});
observe(10,'unknown event has no invented event-specific response and empty contexts cannot pass',async t=>{
 const f=fixture(t);await f.call('enforcement',{native:'Other',event:'prompt',chat:'chat'});assert.equal(f.rows()[0].code,'native_event_invalid');
 assert.throws(()=>f.runtime.validateManifest({...f.manifest,supported_commands:{...f.manifest.supported_commands,prompt:{Prompt:{stdout:'',stderr:'',exit_code:0}}}}),/manifest_invalid/);
});
observe(11,'a peer journal UID cannot acknowledge a different installation journal',async t=>{
 const one=fixture(t),two=fixture(t),a=await pending(one),b=await pending(two);assert.equal((await two.call('errors-ack',ack(two,b,[one.rows()[0].uid]))).exitCode,1);assert.equal(one.rows()[0].read,false);assert.equal(two.rows()[0].read,false);assert.ok(a.turn);
});
observe(12,'independent processes serialize errors without losing records',async t=>{
 const f=fixture(t);const results=await Promise.all(Array.from({length:6},()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['dist/oop-enforce.js',f.root,'unsupported'],{stdio:['pipe','pipe','pipe'],windowsHide:true});child.on('error',reject);child.stdout.resume();child.stderr.resume();child.on('close',resolve);child.stdin.end('{}');
 })));assert.ok(results.every(code=>code===1));const rows=f.rows();assert.equal(rows.length,6);assert.equal(new Set(rows.map(r=>r.uid)).size,6);
});
observe(13,'automatic context directs the runtime to the mandatory procedure in shared Markdown',async t=>{
 const f=fixture(t),r=await f.call('prompt',{event:'prompt',chat:'chat'});const rendered=fs.readFileSync(path.join(f.project,'.priv','common','runtime-instructions.rendered.md'),'utf8');assert.ok(rendered.includes(runtimeOperationalRules()));assert.ok(!JSON.parse(r.stdout).additionalContext.includes(runtimeOperationalRules()));assert.ok(rendered.startsWith('<!-- OOP mandatory procedures: begin;'));
 assert.ok(rendered.includes('core governs authority'));assert.ok(rendered.includes('one bounded consumption cycle'));
});
observe(14,'ack does not create a prompt turn or claim an error was corrected',async t=>{
 const f=fixture(t),current=await pending(f),input=ack(f,current),accepted=JSON.parse((await f.call('errors-ack',input)).stdout).context;assert.equal(accepted.turn,current.turn);assert.equal(accepted.version,current.version);assert.equal(accepted.errors.unread_count,0);assert.equal(accepted.error_receipt.resolved,undefined);assert.equal(accepted.error_receipt.presentation.original_shown,true);
});
observe(15,'capacity failure never evicts unread diagnostics and read batches stay bounded',async t=>{
 const f=fixture(t);for(let i=0;i<40;i++)assert.equal(f.runtime.persist(f.root,Error('input_invalid')).persisted,true);const state=f.runtime.diagnostics(f.root,'chat');assert.equal(state.unread.length,32);assert.equal(state.unread_count,40);
 const file=path.join(f.root,'oop-enforce-errors.jsonl'),before=fs.readFileSync(file);fs.appendFileSync(file,' '.repeat(4*1024*1024));const full=fs.readFileSync(file);assert.equal(f.runtime.persist(f.root,Error('input_invalid')).persisted,false);assert.deepEqual(fs.readFileSync(file),full);assert.ok(before.length);
});
observe(16,'manifest rejects overlapping events, duplicate keys, context omission and blocking exits',async t=>{
 const f=fixture(t),response={stdout:'{{context}}',stderr:'',exit_code:0};
 for(const m of [{...f.manifest,supported_commands:{...f.manifest.supported_commands,prompt:{'A|B':response,B:response}}},{...f.manifest,placeholders:{context:{source:'response.__proto__.value',type:'string',required:true,encoding:'text'}}},{...f.manifest,supported_commands:{...f.manifest.supported_commands,prompt:{Prompt:{...response,exit_code:11}}}}])assert.throws(()=>f.runtime.validateManifest(m));
 const doubled=structuredClone(f.manifest);doubled.supported_commands.prompt.Prompt.stdout='{{context}}{{context}}';assert.throws(()=>f.runtime.validateManifest(doubled));
 const escaped=structuredClone(f.manifest);escaped.supported_commands.prompt.Prompt.stdout='{{{{context}}}}';assert.throws(()=>f.runtime.validateManifest(escaped));
 const file=path.join(f.root,'oop-runtime-adapter.js');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('"schema_version":1','"schema_version":1,"schema_version":1'));
 const bad=await f.call('prompt',{event:'prompt',chat:'chat'});assert.equal(bad.exitCode,1);assert.equal(f.rows().at(-1).code,'manifest_invalid');
});
