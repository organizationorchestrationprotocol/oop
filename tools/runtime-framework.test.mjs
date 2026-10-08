import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,readdirSync,mkdirSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEnforcementEngine} from './enforcement-engine.mjs';
import {route} from './reference-engine.mjs';
const require=createRequire(import.meta.url),{runtimeFramework}=require('./runtime-framework.cjs');
const {complete,register}=require('./fixtures/oop-runtime-adapter.cjs'),c=require('./installation-contract.cjs');
const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
const observe=(n,label,fn)=>test('REL-FWK-'+String(n).padStart(3,'0')+': '+label,fn);
function fixture(t,options={}){
 const owned=mkdtempSync(join(tmpdir(),'oop-framework-test-'));t.after(()=>rmSync(owned,{recursive:true,force:true}));
 const adapter=register(owned,template,options),record={format:1,owned_scope:owned,runtime_adapter:adapter};let seen;
 const engine={config:{source_binding:{source_identity:'fixture'},commands:Object.fromEntries(['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe'].map(n=>[n,{}]))},
  evaluate:(command,request)=>{seen=request;return {type:'oop_admission',decision:'deny',effect_permission:'not_granted',payload:{runtime_message:'fixture context',...(options.publication?{publication:options.publication}:{})}};}};
 return {f:runtimeFramework(engine,{registration:()=>({ok:true,record})},template),adapter,record,get seen(){return seen;}};
}
const context=()=>({ticket_id:'T1',reference:'fixture:current-change',kind:'transition',destination:'operations:fixture',expected_revision:'revision-1',change_identity:'change-1',observation_verified:true,authority_verified:true});
observe(1,'fixed scaffold changes cannot execute',t=>{const {f}=fixture(t);assert.equal(f.validateAdapter(complete(template)+'\nprocess.exit(0);').reason,'adapter_scaffold_changed');});
observe(2,'empty, untouched and disguised placeholder regions are rejected',t=>{const {f}=fixture(t);for(const decode of ['', 'return {};','throw new Error("OOP_ADAPTER_NOT_IMPLEMENTED");'])assert.equal(f.validateAdapter(complete(template,{decode})).valid,false);});
observe(3,'unsupported host and omitted required events fail before decoding',t=>{const {f,record}=fixture(t,{supported_commands:['entry']});record.runtime_adapter.required_events.push('pre-effect');assert.equal(f.dispatch('entry',{session:'s'},{},'fixture-host').exit,4);});
observe(4,'registered code changes are rejected before execution',t=>{const {f,adapter}=fixture(t);writeFileSync(adapter.path,complete(template)+'\n');assert.equal(f.dispatch('entry',{session:'s'},{},'fixture-host').error,'adapter_identity_mismatch');});
observe(5,'caller coordination locators and forged authority are stripped',t=>{const x=fixture(t);const r=x.f.dispatch('pre-effect',{session:'s',coordination:{project_root:'/foreign',scope_ownership_verified:true}},{},'fixture-host');assert.equal(r.exit,2);assert.deepEqual(x.seen.coordination,{session:'s'});});
observe(6,'invalid declared output is rejected before controller evaluation',t=>{const x=fixture(t);let source=complete(template).replace('"exitCode":0','"exitCode":999');writeFileSync(x.adapter.path,source);x.adapter.identity=require('./fixtures/oop-runtime-adapter.cjs').digest(Buffer.from(source));assert.equal(x.f.dispatch('entry',{session:'s'},{},'fixture-host').error,'adapter_response_profile_invalid');});
observe(7,'creation and semantic transitions always require immediate publication',()=>{for(const kind of ['creation','transition'])assert.equal(c.assessPublication({...context(),kind,checkpoint:'later'}).disposition,'publish_now');});
observe(8,'material progress and continuity cannot silently wait for task closure',t=>{for(const key of ['material_result','canonical_dependency','continuity_boundary'])assert.equal(c.assessPublication({...context(),kind:'progress',[key]:true}).disposition,'publish_now');const {f}=fixture(t,{format:'message',publication:{disposition:'publish_now'}});const r=f.dispatch('pre-effect',{session:'s'},{},'fixture-host');assert.match(r.stdout,/OOP publication: publish_now/);assert.equal(r.exit,2);});
observe(9,'draft batching requires an explicit checkpoint and reason',()=>{assert.equal(c.assessPublication({...context(),kind:'draft'}).disposition,'blocked');assert.equal(c.assessPublication({...context(),kind:'draft',checkpoint:'next-reviewed-step',deferral_reason:'intermediate draft'}).disposition,'defer_to_defined_checkpoint');});
observe(10,'unavailable authority and invalid remote receipts never imply persistence',()=>{assert.equal(c.assessPublication({...context(),authority_verified:false}).disposition,'blocked');assert.equal(c.assessPublication({...context(),receipt:{remote_content_verified:true}}).disposition,'blocked');});
observe(11,'a receipt must match the exact ticket, change and destination',()=>{const p=context(),receipt={ticket_id:p.ticket_id,change_identity:p.change_identity,destination:p.destination,revision:'revision-2',remote_content_verified:true};assert.equal(c.assessPublication({...p,receipt}).reason,'canonical_change_observed');assert.equal(c.assessPublication({...p,receipt:{...receipt,change_identity:'foreign'}}).disposition,'blocked');});
observe(12,'publication cannot call a mismatched or absent executor',async()=>{let calls=0;const r=await c.executePublication(context(),{destination:'foreign'}, {conditional:()=>calls++});assert.equal(r.verified,false);assert.equal(calls,0);});
observe(13,'configuration validates actual host invocation independently from field presence',()=>{const f=require('./fixtures/native-configuration.cjs')('P','v','r');assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,true);f.configuration_plan.invocation.arguments=['wrong'];assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).reason,'host_invocation_unresolved');});
observe(14,'initial preparation rejects unfinished obligations and missing reading evidence',()=>{for(const change of [p=>delete p.workflow,p=>p.workflow.stages=[],p=>p.obligations[0].disposition='blocked']){const f=require('./fixtures/native-configuration.cjs')('P','v','r');change(f.configuration_plan.adapter_preparation);assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);}});
observe(15,'the official controller rejects publication evidence not bound to its exact content',()=>{
 const engine=require('../dist/oop-enforce.js'),p=context(),r=engine.evaluate('pre-effect',{format:1,request_id:'binding',scope:{classification:'unknown'},publication_context:p,context:{project:'P',runtime:'R',session:'S'}});
 assert.equal(r.reason_code,'canonical_publication_pending');assert.equal(r.payload.publication.reason,'publication_observation_unverified');
});
observe(16,'incomplete source is rejected by the administrative CLI even with a positive preparation label',()=>{
 const engine=require('../dist/oop-enforce.js'),f=require('./fixtures/native-configuration.cjs')('P','v','r');f.configuration_plan.adapter_preparation.source=template;
 f.configuration_plan.adapter_preparation.workflow.candidate_identity=c.configurationIdentity(template);
 const r=engine.validateConfiguration({format:1,request_id:'incomplete',plan:f.configuration_plan,facts:f.configuration_observation});assert.equal(r.valid,false);assert.equal(r.reason,'adapter_incomplete');
});

observe(17,'one current canonical template and one stable interface cover all rendering modes',()=>{
 const manifest=require('../dist/enforcement-install.json'),api=require('../dist/interfaces.json').enforcement,engine=require('../dist/oop-enforce.js');
 assert.deepEqual(Object.keys(manifest.runtime_adapter.templates),['oop-runtime-adapter']);assert.equal(manifest.runtime_adapter.templates['oop-runtime-adapter'].path,'templates/oop-runtime-adapter.js');assert.equal(Object.hasOwn(api.framework,'interface'),false);assert.equal(api.framework.manifest_version,1);assert.deepEqual(api.framework.editable_regions,['manifest','decodeEvent']);assert.deepEqual(Object.keys(engine.config).filter(k=>k.startsWith('adapter_template')),['adapter_template']);
 for(const dir of ['tools/templates','dist/templates'])assert.deepEqual(readdirSync(dir).filter(n=>n.startsWith('oop-runtime-adapter')),['oop-runtime-adapter.js']);
 assert.equal(readFileSync('tools/templates/oop-runtime-adapter.js','utf8').replaceAll('@@SOURCE_IDENTITY@@',engine.config.source_binding.source_identity).replace(/\r\n/g,'\n'),template);
});
observe(18,'unsupported interface names are rejected before adapter execution',t=>{
 const x=fixture(t);x.record.runtime_adapter.interface='unsupported-contract';assert.equal(x.f.dispatch('pre-effect',{session:'s'},{},'fixture-host').error,'adapter_registration_invalid');
 assert.equal(x.f.validateAdapter(complete(template).replace('module.exports = Object.freeze({',"module.exports = Object.freeze({ interface: 'oop-runtime-adapter',")).valid,false);
});

// Disposable typed observations exercise producer mechanisms, not native host parsing.
function observationalFixture(t){
 const project=realpathSync.native(mkdtempSync(join(tmpdir(),'oop-observation-')));
 t.after(()=>rmSync(project,{recursive:true,force:true}));
 const priv=join(project,'.priv'),common=join(priv,'common'),owned=join(priv,'tools','fixture-runtime');
 mkdirSync(common,{recursive:true});mkdirSync(owned,{recursive:true});
 const checkpoint=join(owned,'checkpoint.json'),binding=join(common,'workspace-binding.json');
 const adapter=register(owned,template,{decode:'const {resource,...request}=raw;return {native_event:context.command,request,session:raw.session,resource};'}),record={format:1,project_root:project,private_root:priv,common_scope:common,owned_scope:owned,
  installation_uid:'fixture-runtime',machine_id:'fixture-machine',runtime_class:'fixture-class',runtime_adapter:{...adapter,observation_admission:1}};
 writeFileSync(binding,JSON.stringify({format:1,workspace:project,revision:'1',runtimes:[{installation_uid:record.installation_uid,runtime:record.runtime_class,owned_scope:owned,checkpoint_ref:checkpoint,identity_basis:'persistent_integration',status:'active'}]}));
 writeFileSync(checkpoint,JSON.stringify({workspace:project,installation_uid:record.installation_uid,runtime:record.runtime_class,checkpoint_ref:checkpoint,mapping_revision:'1',revision:1,status:'adopted',verified_commit:'a'.repeat(40)}));
 const target=join(project,'read.txt');writeFileSync(target,'Fixture content.');
 const coordination={registration:()=>({ok:true,record}),guide:()=>({message:'',deny:false})};
 const config=require('../dist/oop-enforce.js').config;
 const engine=createEnforcementEngine(config,route,c.installationContract(),coordination),f=runtimeFramework(engine,coordination,template);
 const raw=()=>({session:'fixture-session',format:1,request_id:'fixture-request',scope:{classification:'known',action:['information']},
  context:{session:'fixture-session',revision:'1',authority:'fixture-unverified',action_scope:'fixture-read',native_event:{cwd:project}},resource:{path:'read.txt',access:'read'}});
 const dispatch=(input=raw(),command='pre-effect')=>{const out=f.dispatch(command,input,{path:'fixture-registration',identity:'fixture-identity'},'fixture-host');assert.ok(out.stdout,JSON.stringify(out));return JSON.parse(out.stdout);};
 return {project,owned,checkpoint,target,record,raw,dispatch,engine};
}
observe(19,'fixture completion preserves editable regions across LF and CRLF',()=>{
 const lf=template.replace(/\r\n/g,'\n'),crlf=lf.replace(/\n/g,'\r\n');
 assert.equal(complete(lf),complete(crlf));assert.equal(runtimeFramework({config:{commands:{}}},null,template).validateAdapter(complete(crlf)).valid,true);
});
observe(20,'registered local reads pass before and after observation without effect authority',t=>{
 const x=observationalFixture(t);
 for(const command of ['pre-effect','post-effect']){const r=x.dispatch(x.raw(),command);assert.equal(r.decision,'allow');assert.equal(r.reason_code,'non_governed_observation');assert.equal(r.effect_permission,'not_granted');}
 assert.equal(readFileSync(x.target,'utf8'),'Fixture content.');
 mkdirSync(join(x.project,'nested'));writeFileSync(join(x.project,'nested','only-here.txt'),'Nested fixture.');
 const r=x.raw();r.resource.path='only-here.txt';r.context.native_event.cwd=join(x.project,'nested');assert.equal(x.dispatch(r).decision,'allow');
});
observe(21,'opt-in, current local state, maintenance and path boundaries remain mandatory',t=>{
 const x=observationalFixture(t);delete x.record.runtime_adapter.observation_admission;assert.notEqual(x.dispatch().decision,'allow');x.record.runtime_adapter.observation_admission=1;
 for(const alter of [r=>r.scope.classification='unknown',r=>r.resource.path='../foreign.txt',r=>r.resource.path='missing.txt',r=>delete r.context.native_event.cwd,r=>r.context.session='foreign-session',r=>r.resource.access='write']){const r=x.raw();alter(r);assert.notEqual(x.dispatch(r).decision,'allow');}
 const maintenance=join(x.owned,'oop-runtime-adapter-maintenance.json');
 writeFileSync(maintenance,JSON.stringify({mode:'maintenance',revision:1,workspace:x.project,installation_uid:x.record.installation_uid,machine_id:x.record.machine_id}));assert.notEqual(x.dispatch().decision,'allow');rmSync(maintenance);
 const cp=JSON.parse(readFileSync(x.checkpoint));cp.mapping_revision='foreign';writeFileSync(x.checkpoint,JSON.stringify(cp));assert.notEqual(x.dispatch().decision,'allow');
});
observe(22,'governed payloads and scope expansion cannot use read admission',t=>{
 const x=observationalFixture(t);
 for(const key of ['effect_class','organizational_mutation','transition','bootstrap_step','journal','runtime_adapter_maintenance','publication_context']){const r=x.raw();r[key]=key==='effect_class'?'local_write':{};assert.notEqual(x.dispatch(r).decision,'allow',key);}
 for(const key of ['request','action','state','risk','authority','recovery']){const r=x.raw();r.scope[key]=['local_write'];assert.notEqual(x.dispatch(r).decision,'allow',key);}
});
observe(23,'typed load and declare observations admit only technical coordination',t=>{
 const x=observationalFixture(t);
 for(const command of ['load','declare','worklog-append','other']){const r=x.raw();delete r.resource;r.context.native_coordination={command};const got=x.dispatch(r);assert.equal(got.decision==='allow',['load','declare'].includes(command));assert.equal(got.effect_permission,'not_granted');}
});
observe(24,'ordinary callers cannot forge framework observations through JSON or options',t=>{
 const x=observationalFixture(t),r=x.raw();r.coordination={resource:{path:x.target,access:'read'}};delete r.resource;delete r.session;
 const nativeObservation={kind:'read',resource:x.target,session:'fixture-session',request_id:r.request_id};
 assert.notEqual(x.engine.evaluate('pre-effect',r,{nativeObservation}).decision,'allow');
 assert.notEqual(x.engine.evaluate('pre-effect',{...r,nativeObservation}).decision,'allow');
});

observe(25,'events manifests cannot reach registered command dispatch',t=>{
 const fixtureModule=require('./fixtures/oop-runtime-adapter.cjs'),p=fixtureModule.descriptor();p.events=p.supported_commands;delete p.supported_commands;
 const x=fixture(t,{descriptor:p});
 assert.equal(x.f.dispatch('pre-effect',{session:'s'},{},'fixture-host').error,'adapter_response_profile_invalid');
 x.adapter.template_identity='sha256:'+'0'.repeat(64);assert.equal(x.f.dispatch('pre-effect',{session:'s'},{},'fixture-host').error,'adapter_registration_invalid');
});

observe(26,'one OOP command dispatches different responses and fallbacks for different native events',t=>{
 const p=require('./fixtures/oop-runtime-adapter.cjs').descriptor({supported_commands:['pre-effect']});
 const all=stdout=>({'allow|deny|unknown|error':{stdout,stderr:'{{message}}',exitCode:2},_:{stdout:'fallback-'+stdout,stderr:'',exitCode:2}});
 p.supported_commands['pre-effect']={'First|Second':all('first'),Third:all('third')};
 const x=fixture(t,{supported_commands:['pre-effect'],descriptor:p,decode:'return {native_event:raw.kind,request:raw,session:raw.session};'});
 for(const [kind,text] of [['First','first'],['Second','first'],['Third','third']]){
  const out=x.f.dispatch('pre-effect',{session:'s',kind},{},'fixture-host');assert.equal(out.stdout,text+'\n');assert.equal(out.exit,2);
 }
 const absent=x.f.dispatch('pre-effect',{session:'s',kind:'Fourth'},{},'fixture-host');assert.equal(absent.exit,4);assert.equal(absent.fallback_used,false);assert.equal(absent.error,'native_event_unsupported');
});

observe(27,'adapter preparation requires the six ordered stages and exact current inputs',()=>{
 const fixture=()=>require('./fixtures/native-configuration.cjs')('P','v','r');
 const mutations=[
  f=>f.configuration_plan.adapter_preparation.workflow.stages.pop(),
  f=>f.configuration_plan.adapter_preparation.workflow.stages.reverse(),
  f=>f.configuration_plan.adapter_preparation.workflow.stages.push({step:'installation',reference:'fixture:invented',assurance:'runtime_declaration'}),
  f=>f.configuration_plan.adapter_preparation.workflow.inputs.controller.reference='/other/controller.js',
  f=>f.configuration_plan.adapter_preparation.workflow.inputs.working_copy='/other/oop-runtime-adapter.js',
  f=>f.configuration_plan.adapter_preparation.workflow.inputs.context[0].identity='sha256:'+'e'.repeat(64),
  f=>f.configuration_plan.adapter_preparation.source+=' ',
  f=>f.configuration_plan.adapter_preparation.workflow.inputs.documentation=[],
  f=>f.configuration_plan.adapter_preparation.workflow.stages[2].assurance='native_observation'
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,false);}
 const f=fixture();assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,true);
 const s=f.configuration_plan.adapter_preparation.workflow.stages[2];s.assurance='native_observation';
 f.configuration_observation.adapter_preparation_observations=[{step:s.step,reference:s.reference}];
 assert.equal(c.validateConfiguration(f.configuration_plan,f.configuration_observation).valid,true);
 assert.match(c.validateAdapterPreparation(f.configuration_plan,f.configuration_observation).assurance,/not_reading_or_comprehension/);
});
observe(28,'official controller rejects stale template preparation even with matching claimed observations',()=>{
 const f=require('./fixtures/native-configuration.cjs')('P','v','r'),engine=require('../dist/oop-enforce.js');
 f.configuration_plan.adapter_preparation.workflow.inputs.template.identity='sha256:'+'f'.repeat(64);
 f.configuration_observation.adapter_preparation_inputs=structuredClone(f.configuration_plan.adapter_preparation.workflow.inputs);
 const r=engine.validateConfiguration({format:1,request_id:'stale-template',plan:f.configuration_plan,facts:f.configuration_observation});
 assert.equal(r.valid,false);assert.equal(r.reason,'adapter_preparation_template_stale');assert.equal(r.dispatch_verified,false);
});
