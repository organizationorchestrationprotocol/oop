import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {closure,expandBootstrap} from './reference-engine.mjs';
import {validateProfile} from './schema-profile.mjs';
const require=createRequire(import.meta.url),c=require('./installation-contract.cjs'),native=require('./fixtures/native-configuration.cjs');
const {resolveClause,contextReceipt,migrateBridge}=require('./bridge-installation.cjs');
const {planInstallation}=require('./install-plan.cjs');
const engine=require('../dist/oop-enforce.js'),manifest=require('../dist/enforcement-install.json');
const clone=structuredClone,fixture=()=>native('P','v1','cfg');
const check=f=>c.validateConfiguration(f.configuration_plan,f.configuration_observation);
const point=(f,p,owned)=>{f.configuration_plan.bridge.entrypoint=p;f.configuration_plan.routes.forEach(r=>r.entrypoint=p);f.configuration_observation.resolved_bridge_entrypoint=p;if(owned)f.configuration_observation.owned_scope_locator=owned;};
const run=(input,command='validate-configuration')=>spawnSync(process.execPath,['dist/oop-enforce.js',command],{input:typeof input==='string'||Buffer.isBuffer(input)?input:JSON.stringify(input),encoding:'utf8',maxBuffer:4*1024*1024});
const observe=(n,title,fn)=>test('REL-BRIDGE-'+String(n).padStart(3,'0')+': '+title,fn);
observe(1,'resolved scope rejects common, traversal, prefixed UID and foreign ownership',()=>{
 assert.equal(check(fixture()).valid,true);
 for(const [path,owned,reason] of [
 ['/private/common/fixture-installation-uid/oop-enforce-bridge.sh','/private/common/fixture-installation-uid','bridge_location_in_common_scope'],
 ['/private/tools/fixture-installation-uid/../other/oop-enforce-bridge.sh',null,'bridge_path_unresolved'],
 ['/private/tools/agent-fixture-installation-uid/oop-enforce-bridge.sh',null,'bridge_location_not_uid_qualified'],
 ['/other/fixture-installation-uid/oop-enforce-bridge.sh',null,'bridge_location_not_owned']]){
 const f=fixture();point(f,path,owned);assert.equal(check(f).reason,reason,path);
 }
 for(const k of ['paths_resolved_without_aliases','bridge_ownership_verified']){const f=fixture();f.configuration_observation[k]=false;assert.equal(check(f).reason,'bridge_path_unresolved');}
});
observe(2,'separator styles, directory boundaries and observed case semantics preserve exact UID',()=>{
 const f=fixture();point(f,'C:\\private\\tools\\fixture-installation-uid\\oop-enforce-bridge.sh','C:/private/tools/fixture-installation-uid');f.configuration_observation.common_scope_locator='C:/private/common';assert.equal(check(f).valid,true);
 point(f,'C:/private/COMMON/fixture-installation-uid/oop-enforce-bridge.sh','C:/private/COMMON/fixture-installation-uid');f.configuration_observation.filesystem_case_sensitive=true;assert.equal(check(f).valid,true);f.configuration_observation.filesystem_case_sensitive=false;assert.equal(check(f).reason,'bridge_location_in_common_scope');
 point(f,'C:/private/common-sibling/fixture-installation-uid/oop-enforce-bridge.sh','C:/private/common-sibling/fixture-installation-uid');assert.equal(check(f).valid,true);
 point(f,'C:/private/tools/FIXTURE-INSTALLATION-UID/oop-enforce-bridge.sh');assert.equal(check(f).reason,'bridge_location_not_uid_qualified');
});
observe(3,'native shell, implementation and filename faults have stable distinct precedence',()=>{
 for(const [patch,reason] of [[{language:'application'},'bridge_shell_not_native_for_host'],[{delegated_bridge_logic:true},'bridge_language_not_host_native'],[{implementation_language:'application'},'bridge_language_not_host_native']]){const f=fixture();Object.assign(f.configuration_plan.bridge,patch);assert.equal(check(f).reason,reason);}
 const f=fixture();point(f,'/private/tools/fixture-installation-uid/oop-runtime-hook.cjs');assert.equal(check(f).reason,'bridge_filename_noncanonical');
 const missing=fixture();delete missing.configuration_observation.configuration_revision;delete missing.configuration_plan.expected_revision;assert.equal(check(missing).reason,'documentation_or_configuration_revision_unresolved');
});
observe(4,'administrative CLI has complete correlated envelopes and distinct malformed/invalid exits',()=>{
 const f=fixture(),request={format:1,request_id:'cfg-1',plan:f.configuration_plan,facts:f.configuration_observation};
 let r=run(request);assert.equal(r.status,0,r.stderr);let response=JSON.parse(r.stdout);assert.equal(response.valid,true);assert.equal(response.error,false);assert.equal(response.dispatch_verified,false);assert.deepEqual(response.validation_binding,check(f).validation_binding);
 request.plan.expected_revision='stale';r=run(request);assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).reason,'documentation_or_configuration_revision_unresolved');
 for(const input of ['{',JSON.stringify({...request,extra:true}),JSON.stringify({...request,request_id:'x'.repeat(513)}),Buffer.from([0xff]),' '.repeat(1048577)]){r=run(input);assert.equal(r.status,4,r.stderr);response=JSON.parse(r.stdout);assert.equal(response.type,'oop_configuration_validation');assert.equal(response.error,true);assert.equal(response.valid,false);assert.equal(response.validation_binding,null);}
 assert.equal(Object.keys(engine.config.commands).length,8);assert.equal(run({format:1,request_id:'probe'},'probe').status,3);
});
observe(5,'registration planner blocks missing, stale and foreign-source validation receipts',()=>{
 const f=fixture(),options={expectedSourceBinding:manifest.source_binding};
 assert.notEqual(planInstallation(manifest,[],f,{},options).reason,'configuration_validation_missing_or_stale');
 for(const mutate of [x=>delete x.configuration_validation,x=>x.configuration_validation.valid=false,x=>x.configuration_validation.source_binding={kind:'source_content',source_identity:'foreign'},x=>x.configuration_plan.elements[0].value='changed',x=>x.configuration_observation.unrelated_metadata='changed']){const x=clone(f);mutate(x);assert.equal(planInstallation(manifest,[],x,{},options).reason,'configuration_validation_missing_or_stale');}
});
observe(6,'manifest schema, clause references and installation closure resolve without context expansion',()=>{
 const schema=require('./schemas/enforcement-install.schema.json');assert.deepEqual(validateProfile(manifest,schema),[]);assert.equal(manifest.format,4);
 for(const pointer of [...manifest.bridge.location_rules,...manifest.bridge.language_rules,...manifest.bridge.installation_rules]){const [file,fragment]=pointer.split('#');assert.ok(resolveClause(require('../dist/'+file),fragment).contract.semantic_clause);}
 const procedure=require('../dist/procedures/bootstrap.json'),expanded=expandBootstrap(procedure);for(const step of expanded.steps){assert.ok(step.wait.includes('observable resume'));assert.ok(step.failure.includes('partial effects'));}
 const invalid=clone(procedure);invalid.steps[0].defaults_ref='#missing';assert.throws(()=>expandBootstrap(invalid));
 assert.throws(()=>resolveClause(require('../dist/modules/workspace.json'),'missing'));
 const r=require('../dist/routing.json'),loaded=closure(r.modules,r.facets.full_install);assert.ok(loaded.includes('capabilities'));assert.ok(loaded.includes('workspace'));assert.equal(require('../dist/entry.json').minimum_context.includes('modules/capabilities.json'),false);
 const boot=require('../dist/procedures/bootstrap.json').steps.find(s=>s.id==='BOOT-12').binding_plan;assert.equal(boot.pre_materialization_checklist.length,5);assert.ok(boot.sequence.indexOf('validate_exact_configuration_plan')<boot.sequence.indexOf('install_or_reuse_every_eligible_mechanism'));
});
observe(7,'session context receipts cannot cross session, mapping, content or source boundaries',()=>{
 const expected={session:'s1',workspace:'P',installation_uid:'uid',mapping_revision:'r1',source_binding:manifest.source_binding,modules:[{file:'modules/workspace.json',content_identity:'published-identity'}]};assert.equal(contextReceipt(expected,expected),true);
 for(const patch of [{session:'s2'},{mapping_revision:'r2'},{source_binding:{}},{modules:[]},{modules:[...expected.modules,...expected.modules]}])assert.equal(contextReceipt({...expected,...patch},expected),false);
});
function migrationBackend(f){let state={candidate_facts:f.configuration_observation,source_binding:manifest.source_binding,revision:'cfg',active:'/old/bridge',ownership_verified:true,replacement_authorized:true,routes:[],references_intact:true};return {read:async()=>clone(state),stage:async()=>{assert.equal(state.active,'/old/bridge');},activate:async(expected,p)=>{if(state.revision!==expected)throw Error('stale');state={...state,revision:'next',active:p.plan.bridge.entrypoint,routes:p.plan.routes};return {revision:'next'};},retire:async(path,options)=>{assert.equal(path,'/old/bridge');assert.equal(options.preserve_historical_references,true);state.inactive=path;}};}
observe(8,'recoverable migration preserves safe active entry and historical references across failure and stale retry',async()=>{
 const f=fixture(),proposal={expected_revision:'cfg',previous:'/old/bridge',plan:f.configuration_plan,validation:f.configuration_validation};const backend=migrationBackend(f);
 const forged=clone(proposal);forged.validation.validation_binding.host='foreign';assert.equal((await migrateBridge(forged,backend)).verified,false);assert.equal((await migrateBridge(proposal,backend)).verified,true);assert.equal((await backend.read()).inactive,'/old/bridge');assert.equal((await migrateBridge(proposal,backend)).verified,false);
 const failed=migrationBackend(f);failed.activate=async()=>{throw Error('native consent unresolved');};assert.equal((await migrateBridge(proposal,failed)).phase,'staged');assert.equal((await failed.read()).active,'/old/bridge');
});
function transport(t){const dir=mkdtempSync(join(tmpdir(),'oop-bridge-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const controller=join(dir,'controller.cjs');if(process.platform==='win32'){writeFileSync(join(dir,'node-shim.sh'),'#!/bin/sh\nscript=$(cygpath -w "$1"); shift\nexec '+JSON.stringify(shellPath(process.execPath))+' "$script" "$@"\n');}writeFileSync(controller,`process.stdin.resume();let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const r=JSON.parse(s);if(r.mode==='timeout')return setTimeout(()=>{},10000);if(r.mode==='validation-types'){process.stdout.write(JSON.stringify({format:'1',type:'oop_configuration_validation',request_id:r.request_id,source_binding:{kind:'source_content',source_identity:'test-source'},valid:true,reason:'fake',dispatch_verified:'False',validation_binding:{},error:false}));return;}if(r.mode==='malformed'){process.stdout.write('{');return;}const d=r.mode==='deny'?'deny':r.mode==='unknown'?'unknown':r.mode==='error'?'error':'allow';const v={format:1,type:'oop_admission',request_id:r.request_id,command:process.argv[2],source_binding:{kind:'source_content',source_identity:'test-source'},decision:d,reason_code:'fixture',effect_permission:'not_granted',assurance:'synthetic transport fixture',payload:d==='allow'?{checked:['ok'],modules:['core'],observation_time:'2026-10-24T12:00:00Z',semantic_assurance:'modalità',state_write:'none'}:{additionalContext:'modalità'}};if(r.mode==='foreign')v.request_id='foreign';process.stdout.write(JSON.stringify(v));process.exitCode={allow:0,deny:2,unknown:3,error:4}[d];});`);return {dir,controller};}
function shellPath(path){return process.platform==='win32'?'/cygdrive/'+path[0].toLowerCase()+path.slice(2).replaceAll('\\','/'):path;}
function invoke(kind,controller,input,extra={}){const env={...process.env,OOP_EVENT_FORMAT:'oop-request-v1',OOP_TIMEOUT_SECONDS:JSON.parse(Buffer.isBuffer(input)?input.toString('utf8').replace(/^\ufeff/,''):input).mode==='timeout'?'0.2':'2',...extra.env};if(process.env.OOP_JQ_DIR){env.PATH=process.env.OOP_JQ_DIR+';'+dirname(process.env.OOP_SH)+';'+(env.PATH||env.Path);delete env.Path;}
 let executable,args;if(kind==='ps1'){executable=process.env.OOP_PWSH||'pwsh';args=['-NoProfile','-File',resolve('dist/templates/oop-enforce-bridge.ps1'),'-Controller',controller,'-Interpreter',process.execPath,'-Command',extra.command||'entry','-ExpectedSourceIdentity',extra.source||'test-source','-EventFormat','oop-request-v1','-TimeoutMs',JSON.parse(Buffer.isBuffer(input)?input.toString('utf8').replace(/^\ufeff/,''):input).mode==='timeout'?'400':'2000'];}else{executable=process.env.OOP_SH||'sh';args=[...(process.env.OOP_SH_TRACE?['-x']:[]),shellPath(resolve('dist/templates/oop-enforce-bridge.sh')),shellPath(controller),process.platform==='win32'?shellPath(extra.interpreter||join(controller,'..','node-shim.sh')):shellPath(process.execPath),extra.command||'entry',extra.source||'test-source'];}
 return spawnSync(executable,args,{input,encoding:'utf8',env,timeout:12000});}
observe(9,'conditional native shell templates preserve BOM input and UTF-8 output bytes',t=>{
 const {controller}=transport(t);for(const kind of ['ps1','sh']){const r=invoke(kind,controller,Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify({format:1,request_id:'utf8'}))]));assert.equal(r.status,0,kind+': '+r.error+' '+r.stderr);assert.ok(Buffer.from(r.stdout).includes(Buffer.from('modalità')));assert.ok(!r.stdout.startsWith('\ufeff'));}
});
observe(10,'both shell templates propagate deny, unknown and error without permission',t=>{
 const {controller}=transport(t);for(const kind of ['ps1','sh'])for(const [mode,code] of [['deny',2],['unknown',3],['error',4]]){const r=invoke(kind,controller,JSON.stringify({request_id:'negative',mode}));assert.equal(r.status,code,kind+' '+mode+' '+r.stderr);assert.equal(JSON.parse(r.stdout).effect_permission,'not_granted');}
});
observe(11,'both shell templates fail closed on malformed, foreign and timed-out controller output',t=>{
 const {controller}=transport(t);for(const kind of ['ps1','sh'])for(const mode of ['malformed','foreign','timeout','validation-types']){const r=invoke(kind,controller,JSON.stringify({request_id:'fault',mode}),{command:mode==='validation-types'?'validate-configuration':'entry'});assert.equal(r.status,4,kind+' '+mode+' '+r.stderr);assert.equal(r.stdout,'');}
});
observe(12,'templates are source-bound consumer material and unsupported adaptation stays blocked',t=>{
 const {controller}=transport(t);for(const kind of ['ps1','sh']){const text=readFileSync('dist/templates/oop-enforce-bridge.'+kind,'utf8');assert.ok(text.includes(manifest.source_binding.source_identity));assert.ok(text.includes('ADAPTATION'));}
 const r=invoke('sh',controller,JSON.stringify({request_id:'adaptation'}),{env:{OOP_EVENT_FORMAT:'unsupported'}});assert.equal(r.status,4);
 const f=fixture(),request=JSON.stringify({format:1,request_id:'configuration-transport',plan:f.configuration_plan,facts:f.configuration_observation});
 for(const kind of ['ps1','sh']){const response=invoke(kind,resolve('dist/oop-enforce.js'),request,{command:'validate-configuration',source:manifest.source_binding.source_identity,interpreter:join(controller,'..','node-shim.sh')});assert.equal(response.status,0,kind+' '+response.stderr);assert.equal(JSON.parse(response.stdout).valid,true);}
 const d=require('../dist/migrations/runtime.json').bridge_installation;assert.ok(d.actions.includes('conditionally_replace_all_routes_expected_revision'));assert.ok(d.history.includes('R24'));
});
