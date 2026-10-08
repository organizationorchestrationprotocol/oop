import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,readdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url),{runtimeRendering}=require('./runtime-rendering.cjs'),{runtimeFramework}=require('./runtime-framework.cjs');
const {digest,complete}=require('./fixtures/oop-runtime-adapter.cjs');
const r=runtimeRendering(),template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
const observe=(n,title,fn)=>test('REL-RENDER-'+String(n).padStart(3,'0')+': '+title,fn);
function fixture(t,{decision='deny',policy={},format='template',decode,fallback}={}){
 const owned=mkdtempSync(join(tmpdir(),'oop-rendering-'));t.after(()=>rmSync(owned,{recursive:true,force:true}));
 const record={format:1,owned_scope:owned,project_root:owned,installation_uid:'fixture-runtime',runtime_adapter:{host:'fixture-host',runtime_version:'fixture-version',required_events:['pre-effect']}};
 const events=['pre-effect','entry','recovery','diagnostics-read','diagnostics-ack','diagnostics-cleanup'];
 const descriptor=require('./fixtures/oop-runtime-adapter.cjs').descriptor({supported_commands:events,format,policy});
 if(fallback!==undefined)descriptor.supported_commands['pre-effect']['pre-effect']._=fallback;
 if(format==='template'){
  descriptor.placeholders.decision={source:'decision',type:'string',required:true,encoding:'json'};
  descriptor.placeholders.diagnostics={source:'additionalContext',type:'json',required:false,absent:'{}',encoding:'json'};
  for(const cases of Object.values(descriptor.supported_commands).flatMap(command=>Object.values(command)))for(const [key,c] of Object.entries(cases)){if(key==='_')continue;c.stdout='{"response":{{response}},"decision":{{decision}},"additionalContext":{{diagnostics}}}';c.exitCode=0;}
 }
 const source=complete(template,{descriptor,decode:decode??'return {native_event:context.command,request:raw,session:raw.session,extra:"complete-decoded-event"};'});
 const file=join(owned,'oop-runtime-adapter.js');writeFileSync(file,source);Object.assign(record.runtime_adapter,{path:file,identity:digest(source),template_identity:digest(template)});
 const result={type:'oop_admission',decision,payload:{runtime_message:'actual-controller-result'}};
 const engine={config:{source_binding:{source_identity:'fixture'},commands:Object.fromEntries(['entry','pre-effect','recovery'].map(x=>[x,{}]))},evaluate:()=>result};
 const f=runtimeFramework(engine,{registration:()=>({ok:true,record})},template);
 return {record,f,engine,result,source,dispatch:(raw={session:'s'},command='pre-effect')=>f.dispatch(command,raw,{},'fixture-host')};
}
const input=extra=>({format:1,raw:{},context:{},event:{},decision:'deny',...extra});
const fallback={stdout:'{"blocked":true}',stderr:'fallback notice',exitCode:2};
const fail=(x,policy={},extra={})=>r.run({record:x.record,request:input({response:{private:'not persisted'}}),event:'pre-effect',policy,invoke:()=>{throw Error('private payload');},...extra});
observe(1,'declarative renderer retains actual decisions without reflecting native payloads',t=>{
 for(const decision of ['allow','deny','unknown','error']){const x=fixture(t,{decision}),out=x.dispatch({session:'real-session',private:'excluded'}),got=JSON.parse(out.stdout);assert.equal(out.exit,0);assert.equal(got.decision,decision==='allow'?'unknown':decision);assert.equal(got.response.decision,got.decision);assert.ok(!Object.hasOwn(got,'raw'));}
});
observe(2,'static declaration replaces executable render callbacks',t=>{const x=fixture(t);assert.equal(x.f.validateManifest(x.source).valid,true);assert.ok(!x.source.includes('renderResponse('));assert.equal(JSON.parse(x.dispatch().stdout).decision,'deny');});
observe(3,'response and error absence is preserved and incompatible or non-JSON combinations are rejected',()=>{
 for(const extra of [{},{additionalContext:{a:1}},{response:null},{response:'text'},{error:'failure'}])assert.equal(r.input(input(extra)).decision,'deny');
 for(const extra of [{format:999},{undocumented:true},{response:'x',error:'y'},{response:undefined},{response:NaN},{response:1n},{error:null}])assert.throws(()=>r.input(input(extra)));
});
observe(4,'output validation covers stream types, UTF-8, exit range, aggregate size and sensitive fallbacks',()=>{
 const p=r.options({maxOutputBytes:1024});assert.equal(r.output({stdout:'é',stderr:'',exitCode:255},p).exitCode,255);
 for(const out of [{stdout:1,stderr:'',exitCode:0},{stdout:'',stderr:null,exitCode:0},{stdout:'',stderr:'',exitCode:256},{stdout:'',stderr:'',exitCode:-1},{stdout:'',stderr:'',exitCode:1.2},{stdout:'\ud800',stderr:'',exitCode:0},{stdout:'é'.repeat(513),stderr:'',exitCode:0}])assert.throws(()=>r.output(out,p));
 assert.throws(()=>r.output({stdout:'sk-'+ 'x'.repeat(30),stderr:'',exitCode:0},p,true));
});
observe(5,'framework output failures select independent bounded fallback',t=>{
 const x=fixture(t);for(const invoke of [()=>{throw Error('sensitive failure');},()=>({unexpected:true}),()=>({stdout:'',stderr:'',exitCode:300})]){const out=r.run({record:x.record,request:input(),event:'pre-effect',fallback,invoke});assert.equal(out.stdout,fallback.stdout+'\n');assert.equal(out.exit,2);assert.doesNotMatch(out.stderr,/sensitive failure/);assert.equal(out.persisted,true);}
 const broken=fixture(t,{fallback,decode:'throw Error("sensitive decoder failure");'}),recovered=broken.dispatch();assert.equal(recovered.stdout,'');assert.equal(recovered.exit,4);assert.equal(recovered.persisted,true);assert.doesNotMatch(recovered.stderr,/sensitive decoder failure/);
});
observe(6,'deadline failure cannot replace selected fallback with a late result',t=>{const x=fixture(t);const out=r.run({record:x.record,request:input(),event:'pre-effect',fallback,invoke:()=>{throw r.failure('renderer_timeout');}});assert.equal(out.stdout,fallback.stdout+'\n');assert.equal(out.error,'renderer_timeout');assert.equal(out.exit,2);});
observe(7,'deadline configuration records unknown host timing and rejects infeasible margins',t=>{
 assert.equal(r.options().hostDeadlineMs,undefined);assert.throws(()=>r.options({timeoutMS:1}));assert.throws(()=>r.options({timeoutMs:100,marginMs:20,hostDeadlineMs:120}));
 const x=fixture(t);const out=fail(x);assert.equal(out.persisted,true);const stored=JSON.parse(readFileSync(join(x.record.owned_scope,'rendering-diagnostics',out.diagnostic_id+'.json')));assert.equal(stored.host_deadline_ms,null);assert.equal(stored.read,false);assert.ok(!Object.hasOwn(stored,'read_at'));
});
observe(8,'command fallback selection, missing/invalid fallback and combined output limits remain explicit',t=>{
 const x=fixture(t);assert.equal(fail(x,{},{fallback}).stdout,fallback.stdout+'\n');
 assert.match(fail(x).stderr,/No applicable/);assert.match(fail(x,{},{fallback:{...fallback,exitCode:400}}).stderr,/invalid/);
 const out=fail(x,{maxOutputBytes:1024},{fallback:{stdout:'x'.repeat(900),stderr:'',exitCode:2}});assert.equal(out.exit,4);assert.match(out.stderr,/exceeds/);assert.ok(Buffer.byteLength(out.stderr)<=1024);
});

observe(23,'command-local fallbacks cannot be selected or overridden by native input',t=>{
 const x=fixture(t,{fallback,decode:'throw Error("decoder failure");'});
 const out=x.dispatch({session:'s',fallback:{stdout:'allow',stderr:'',exitCode:0}});
 assert.equal(out.stdout,'');assert.equal(out.exit,4);assert.equal(out.persisted,true);
 const absent=x.dispatch({session:'s'},'entry');assert.notEqual(absent.stdout,fallback.stdout+'\n');assert.equal(absent.exit,4);
 assert.throws(()=>r.options({fallbacks:{'pre-effect':fallback}}));
});
observe(9,'persistence sanitizes result, host input and exception text and preserves diagnostic identity',t=>{
 const x=fixture(t),out=fail(x),file=join(x.record.owned_scope,'rendering-diagnostics',out.diagnostic_id+'.json'),raw=readFileSync(file,'utf8');
 assert.doesNotMatch(raw,/private|payload/);const a=r.list(x.record).records[0];assert.equal(a.result.decision,'deny');assert.equal(a.id,out.diagnostic_id);assert.equal(a.read,false);assert.match(a.message,/additional context/);
});
observe(10,'storage failure cannot suppress stderr or an available fallback',()=>{
 const out=r.run({record:{},request:input(),event:'pre-effect',fallback,invoke:()=>{throw Error();}});
 assert.equal(out.stdout,fallback.stdout+'\n');assert.equal(out.exit,2);assert.equal(out.persisted,false);assert.match(out.stderr,/persistence failed/);
});
observe(11,'presentation translates and acknowledges only after actual presentation',async t=>{
 const x=fixture(t);fail(x);let seen;
 const out=await r.present(x.record,{effectiveLanguage:'it',translate:async()=> 'Traduzione',present:async v=>{seen=v;assert.equal(r.list(x.record).records[0].read,false);return {presented:true};}});
 assert.equal(out.outcomes[0].acknowledged,true);assert.equal(seen.translation,'Traduzione');assert.equal(r.list(x.record).records[0].read,true);assert.ok(r.list(x.record).records[0].read_at);
});
observe(12,'unavailable translation is explicitly presented without an invented translation',async t=>{
 const x=fixture(t);fail(x);let seen;await r.present(x.record,{effectiveLanguage:'it',translate:async()=>{throw Error();},present:async v=>{seen=v;return {presented:true};}});
 assert.equal(seen.translationUnavailable,true);assert.ok(!Object.hasOwn(seen,'translation'));assert.equal(r.list(x.record).records[0].read,true);
});
observe(13,'interrupted or unconfirmed presentation remains unread and English needs no duplicate',async t=>{
 const x=fixture(t);fail(x);await r.present(x.record,{effectiveLanguage:'en',present:async()=>{throw Error();}});assert.equal(r.list(x.record).records[0].read,false);
 await r.present(x.record,{effectiveLanguage:'en',present:async()=>({})});assert.equal(r.list(x.record).records[0].read,false);
 let translations=0;await r.present(x.record,{effectiveLanguage:'en-US',translate:()=>translations++,present:async()=>({presented:true})});assert.equal(translations,0);assert.equal(r.list(x.record).records[0].read,true);
});
observe(14,'cleanup measures retention from acknowledgement and never deletes unread records',async t=>{
 const x=fixture(t);fail(x);fail(x);const ids=r.list(x.record).records.map(v=>v.id);assert.equal(r.cleanup(x.record,r.options({retentionMs:0})).removed,0);
 r.acknowledge(x.record,ids[0],{id:ids[0],presented:true,original_presented:true,effective_language:'en',presented_at:new Date().toISOString()});
 assert.equal(r.cleanup(x.record,r.options({retentionMs:1000})).removed,0);assert.equal(r.cleanup(x.record,r.options({retentionMs:0})).removed,1);assert.deepEqual(r.list(x.record).records.map(v=>v.id),[ids[1]]);
});
observe(15,'concurrent writers retain all distinct records and read receipts are idempotent',async t=>{
 const x=fixture(t),modulePath=require.resolve('./runtime-rendering.cjs');
 const worker=`const {runtimeRendering}=require(process.argv[1]);const r=runtimeRendering(),record=JSON.parse(process.argv[2]);for(let i=0;i<8;i++)r.persist(record,{decision:'deny',response_available:false,error_available:false,additional_context_available:false},'renderer_exception','entry',r.options());`;
 await Promise.all(Array.from({length:3},()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',worker,modulePath,JSON.stringify(x.record)],{windowsHide:true,stdio:'pipe'});let error='';child.stderr.on('data',c=>error+=c);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(error)));})));
 const records=r.list(x.record).records;assert.equal(records.length,24);assert.equal(new Set(records.map(v=>v.id)).size,24);
 const id=records[0].id,p={id,presented:true,original_presented:true,effective_language:'en',presented_at:new Date().toISOString()};assert.equal(r.acknowledge(x.record,id,p).acknowledged,true);assert.equal(r.acknowledge(x.record,id,p).acknowledged,true);const readWorker=`const {runtimeRendering}=require(process.argv[1]);const r=runtimeRendering(),record=JSON.parse(process.argv[2]),p=JSON.parse(process.argv[3]);for(let i=0;i<8;i++){r.list(record);try{r.acknowledge(record,p.id,p);}catch(e){if(e.message!=='diagnostic_not_found')throw e;}r.cleanup(record,r.options({retentionMs:0}));}`;
 await Promise.all(Array.from({length:3},()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['-e',readWorker,modulePath,JSON.stringify(x.record),JSON.stringify(p)],{windowsHide:true,stdio:'pipe'});let error='';child.stderr.on('data',c=>error+=c);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(error)));})));
 const unread=r.list(x.record).records;assert.equal(unread.length,23);assert.ok(unread.every(v=>!v.read));assert.deepEqual(new Set(unread.map(v=>v.id)),new Set(records.filter(v=>v.id!==id).map(v=>v.id)));
});
observe(16,'storage limits and interrupted records remain explicit without discarding unread data',t=>{
 const x=fixture(t);assert.equal(fail(x,{maxRecords:1}).persisted,true);const out=fail(x,{maxRecords:1});assert.equal(out.persisted,false);assert.equal(r.list(x.record).records.length,1);
 writeFileSync(join(x.record.owned_scope,'rendering-diagnostics','12345678-1234-4234-8234-123456789abc.json'),'{');assert.equal(r.list(x.record).errors.length,1);assert.equal(r.cleanup(x.record,r.options({retentionMs:0})).removed,0);
});
observe(17,'automatic entry exposes unread diagnostics and administrative read never acknowledges',t=>{
 const x=fixture(t);fail(x);let out=x.dispatch({session:'s'},'entry');assert.equal(JSON.parse(out.stdout).additionalContext.renderingDiagnostics.length,1);
 out=x.dispatch({session:'s'},'diagnostics-read');assert.equal(JSON.parse(out.stdout).result.records[0].read,false);assert.equal(r.list(x.record).records[0].read,false);
});
observe(18,'registered acknowledgement requires presentation and rejects scope or language mismatches',t=>{
 const x=fixture(t);const out=fail(x),id=out.diagnostic_id;
 assert.equal(x.dispatch({session:'s',id,presentation:{presented:true}},'diagnostics-ack').exit,4);
 assert.throws(()=>r.acknowledge({...x.record,installation_uid:'foreign'},id,{}));
 const p={id,presented:true,original_presented:true,effective_language:'it',presented_at:new Date().toISOString()};assert.throws(()=>r.acknowledge(x.record,id,p));assert.equal(r.list(x.record).records[0].read,false);
 assert.equal(x.dispatch({session:'s',id,presentation:{...p,translation_unavailable_reported:true}},'diagnostics-ack').exit,0);
});
observe(19,'standard profiles and fixed scaffold stay compatible and invalid fallback declarations fail plan validation',t=>{
 for(const format of ['oop','message']){const x=fixture(t,{format});assert.equal(x.dispatch().exit,2);assert.equal(x.f.validateAdapter(x.source).valid,true);}
 const x=fixture(t,{fallback:{stdout:'x',stderr:'',exitCode:999}});assert.equal(x.f.validateManifest(x.source).valid,false);
 const canonical=readFileSync('tools/templates/oop-runtime-adapter.js','utf8');assert.equal(runtimeFramework({config:{commands:{}}},null,canonical).validateAdapter(complete(canonical)).valid,true);
 x.record.runtime_adapter.template_identity='sha256:'+'0'.repeat(64);assert.equal(x.dispatch().error,'adapter_registration_invalid');
});
observe(20,'delivery failure records a safe diagnostic without retrying host output or claiming success',t=>{
 const x=fixture(t),out=x.dispatch();assert.equal(r.list(x.record).records.length,0);out.onDeliveryFailure();const record=r.list(x.record).records[0];assert.equal(record.error_code,'delivery_failed');assert.equal(record.result.decision,'deny');assert.equal(record.read,false);
});

observe(21,'actual CLI stream-write failure yields error status and attempts separate diagnostics',async()=>{
 const driver="import {runEnforcementCLI} from './tools/enforcement-engine.mjs';process.argv=['node','fixture','pre-effect','--registration','fixture','--registration-identity','fixture','--host','fixture'];process.stdout.write=(value,callback)=>{callback(Error('write failed'));return false;};runEnforcementCLI({framework:{dispatch:()=>({stdout:'host output',stderr:'',exit:0,onDeliveryFailure:()=>process.stderr.write('diagnostic-attempt\\n')})}});";
 const out=spawnSync(process.execPath,['--input-type=module','-e',driver],{input:'{}',encoding:'utf8',windowsHide:true});assert.equal(out.status,4,out.stderr);assert.match(out.stderr,/diagnostic-attempt/);assert.match(out.stderr,/response delivery failed/);
 const realDriver=driver.replace("process.stdout.write=(value,callback)=>{callback(Error('write failed'));return false;};",'').replace("stdout:'host output'","stdout:'x'.repeat(65536)");
 const actual=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',realDriver],{windowsHide:true});let stderr='';child.stderr.on('data',c=>stderr+=c);child.on('error',reject);child.on('close',code=>resolve({code,stderr}));child.stdout.destroy();child.stdin.end('{}');});
 assert.equal(actual.code,4,actual.stderr);assert.match(actual.stderr,/diagnostic-attempt/);assert.match(actual.stderr,/response delivery failed/);assert.doesNotMatch(actual.stderr,/Unhandled/);
 const bothClosed=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',realDriver],{windowsHide:true});child.on('error',reject);child.on('close',resolve);child.stdout.destroy();child.stderr.destroy();child.stdin.end('{}');});assert.equal(bothClosed,4);
});
observe(22,'generated controller renders declarations through scoped registration and CLI',t=>{
 const x=fixture(t),base=x.record.owned_scope,owned=join(base,'.priv','rt','uid');mkdirSync(owned,{recursive:true});mkdirSync(join(base,'.priv','common'),{recursive:true});
 const adapter={...x.record.runtime_adapter,path:join(owned,'oop-runtime-adapter.js')};writeFileSync(adapter.path,x.source);
 const record={format:1,record_type:'oop_runtime_adapter_registration',revision:'1',installation_uid:'uid',runtime_class:'fixture-runtime',machine_id:'fixture-machine',controller_locator:resolve('dist/oop-enforce.js'),controller_source_identity:require('../dist/oop-enforce.js').config.source_binding.source_identity,interpreter_locator:process.execPath,project_root:base,private_root:join(base,'.priv'),owned_scope:owned,common_scope:join(base,'.priv','common'),filesystem_local:true,filesystem_case_sensitive:process.platform==='linux',mode:'advisory',recap_threshold:18,governed_stores:[],instruction_sources:{organization:null,workspace:null},runtime_invocation:[process.execPath,resolve('dist/oop-enforce.js'),'<command>'],observed_at:new Date().toISOString(),runtime_adapter:adapter};
 const registration=join(owned,'oop-runtime-adapter-registration.json'),bytes=JSON.stringify(record);writeFileSync(registration,bytes);
 const raw={session:'actual-synthetic-session'},out=spawnSync(process.execPath,['dist/oop-enforce.js','pre-effect','--registration',registration,'--registration-identity',digest(bytes),'--host','fixture-host'],{input:JSON.stringify(raw),encoding:'utf8',windowsHide:true});
 assert.equal(out.status,0,out.stderr);const got=JSON.parse(out.stdout);assert.ok(!Object.hasOwn(got,'raw'));assert.equal(got.response.decision,got.decision);assert.equal(got.response.effect_permission,'not_granted');
});

observe(24,'controller normalizes both channels after substitution and bounds final UTF-8 bytes',()=>{
 for(const [value,expected] of [['',''],[' \t\r\n',''],['  alpha\r\n beta \n\n','alpha\r\n beta\n'],['😀','😀\n'],['\u00a0word\u00a0','word\n']]){
  const out=r.output({stdout:value,stderr:value,exitCode:2});assert.equal(out.stdout,expected);assert.equal(out.stderr,expected);assert.equal(out.exitCode,2);
 }
 const p=r.options({maxOutputBytes:1024});assert.throws(()=>r.output({stdout:'x'.repeat(1024),stderr:'',exitCode:0},p));
 assert.equal(Buffer.byteLength(r.output({stdout:'x'.repeat(1023),stderr:'',exitCode:0},p).stdout),1024);
 assert.throws(()=>r.output({stdout:'x'.repeat(512),stderr:'y'.repeat(512),exitCode:0},p));
});
observe(25,'actual CLI normalizes success fallback and failure strings without blank channel newlines',()=>{
 const base="import {runEnforcementCLI} from './tools/enforcement-engine.mjs';process.argv=['node','fixture','pre-effect','--registration','fixture','--registration-identity','fixture','--host','fixture'];";
 for(const [stdout,stderr,exit] of [['  first\nsecond \n\n',' \t',0],['','  failed \n',2],[' fallback \n',' diagnostic \n\n',4]]){
  const driver=base+'runEnforcementCLI({framework:{dispatch:()=>('+JSON.stringify({stdout,stderr,exit})+')}});';
  const out=spawnSync(process.execPath,['--input-type=module','-e',driver],{input:'{}',encoding:'utf8',windowsHide:true});assert.equal(out.status,exit);assert.equal(out.stdout,r.channel(stdout));assert.equal(out.stderr,r.channel(stderr));
 }
});

observe(26,'decoder failure persists sanitized unread diagnostics without inventing a native fallback',t=>{
 const x=fixture(t,{fallback,decode:'throw Error("secret decoder payload");'}),out=x.dispatch();
 assert.equal(out.exit,4);assert.equal(out.stdout,'');assert.equal(out.fallback_used,false);assert.equal(out.persisted,true);assert.equal(out.error,'adapter_execution_failed');
 const records=r.list(x.record).records;assert.equal(records.length,1);assert.equal(records[0].read,false);assert.equal(records[0].error_code,'adapter_decode_failed');
 assert.doesNotMatch(JSON.stringify(records)+out.stderr,/secret decoder payload/);
});
observe(27,'missing unknown and grouped selectors fail before evaluation and persist diagnostic classes',t=>{
 for(const selector of [undefined,'Foreign','pre-effect|entry']){
  const x=fixture(t,{fallback,decode:'return {native_event:'+JSON.stringify(selector??null)+',request:raw,session:raw.session};'});
  x.engine.evaluate=()=>{throw Error('must not evaluate');};const out=x.dispatch();assert.equal(out.exit,4);assert.equal(out.stdout,'');assert.equal(out.persisted,true);assert.equal(out.fallback_used,false);
  assert.ok(['native_event_invalid','native_event_unsupported'].includes(r.list(x.record).records[0].error_code));
 }
});
observe(28,'selected native fallback survives later integration failure and absent fallback is explicit',t=>{
 const x=fixture(t,{fallback,decode:'return {native_event:"pre-effect",session:"s"};'}),out=x.dispatch();
 assert.equal(out.stdout,fallback.stdout+'\n');assert.equal(out.exit,2);assert.equal(out.persisted,true);assert.equal(out.fallback_used,true);
 const y=fixture(t,{decode:'return {native_event:"pre-effect",session:"s"};'}),absent=y.dispatch();assert.equal(absent.exit,4);assert.equal(absent.persisted,true);assert.match(absent.stderr,/No applicable/);
});
observe(29,'decoder diagnostic storage failure is explicit and cannot claim persistence',t=>{
 const x=fixture(t,{decode:'throw Error("private");'});writeFileSync(join(x.record.owned_scope,'rendering-diagnostics'),'occupied');
 const out=x.dispatch();assert.equal(out.exit,4);assert.equal(out.persisted,false);assert.equal(out.diagnostic_id,null);assert.match(out.stderr,/persistence failed/);assert.doesNotMatch(out.stderr,/private/);
});
observe(30,'pre-selector diagnostics reappear at the next entry without acknowledging delivery',t=>{
 const x=fixture(t,{decode:'if(raw.fail)throw Error("private");return {native_event:context.command,request:raw,session:raw.session};'});
 const failed=x.dispatch({session:'s',fail:true});assert.equal(failed.persisted,true);
 const out=x.dispatch({session:'s'},'entry'),got=JSON.parse(out.stdout);assert.equal(got.additionalContext.renderingDiagnostics.length,1);assert.equal(got.additionalContext.renderingDiagnostics[0].read,false);assert.equal(r.list(x.record).records[0].read,false);
});

observe(31,'verified registration metadata failures also enter scoped diagnostic recovery',t=>{
 const x=fixture(t);x.record.runtime_adapter.template_identity='sha256:'+'0'.repeat(64);
 const out=x.dispatch();assert.equal(out.exit,4);assert.equal(out.error,'adapter_registration_invalid');assert.equal(out.persisted,true);assert.equal(out.fallback_used,false);
 const records=r.list(x.record).records;assert.equal(records.length,1);assert.equal(records[0].error_code,'integration_contract_failure');assert.equal(records[0].read,false);
});
