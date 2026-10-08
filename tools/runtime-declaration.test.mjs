import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url),{runtimeDeclaration}=require('./runtime-declaration.cjs'),{runtimeObservations}=require('./runtime-observations.cjs');
const {descriptor,complete}=require('./fixtures/oop-runtime-adapter.cjs'),{runtimeFramework}=require('./runtime-framework.cjs');
const contract=runtimeDeclaration();
// Explicit native-event identity for these synthetic single-event render fixtures.
const d={...contract,render:(p,command,input)=>contract.render(p,command,{event:{native_event:command},...input})},observe=(n,title,fn)=>test('REL-DECL-'+String(n).padStart(3,'0')+': '+title,fn);
const desc=()=>descriptor({supported_commands:['pre-effect']});
function local(t){
 const root=mkdtempSync(join(tmpdir(),'oop-observe-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const priv=join(root,'.priv'),common=join(priv,'common'),owned=join(priv,'tools','uid');mkdirSync(common,{recursive:true});mkdirSync(owned,{recursive:true});
 const checkpoint=join(owned,'checkpoint.json'),bindingFile=join(common,'workspace-binding.json');
 const scope={project_root:root,private_root:priv,owned_scope:owned,common_scope:common,installation_uid:'uid',machine_id:'machine',runtime_class:'worker'};
 const cp={workspace:root,installation_uid:'uid',runtime:'worker',checkpoint_ref:checkpoint,mapping_revision:'map-1',revision:0,status:'pending'};
 const mapping={runtime:'worker',installation_uid:'uid',owned_scope:owned,checkpoint_ref:checkpoint,identity_basis:'persistent_integration',status:'active'};
 const binding={format:1,workspace:root,revision:'map-1',runtimes:[mapping]};
 const save=()=>{writeFileSync(checkpoint,JSON.stringify(cp));writeFileSync(bindingFile,JSON.stringify(binding));};save();
 return {root,scope,cp,binding,mapping,checkpoint,bindingFile,save,acquire:options=>runtimeObservations().acquire(scope,options)};
}
observe(1,'independent events and every required decision report locations together',()=>{
 const p=desc();delete p.supported_commands['pre-effect']['pre-effect'].deny;delete p.supported_commands['pre-effect']['pre-effect'].unknown;
 const result=d.validate(p,{supported_commands:['pre-effect','completion']});assert.equal(result.valid,false);assert.deepEqual(result.diagnostics.map(x=>x.code),['event_missing','decision_case_missing','decision_case_missing']);assert.ok(result.diagnostics.every(x=>x.location&&x.correction));
});
observe(2,'independently mandatory placeholders cannot be omitted by the declaration',()=>{
 const p=desc();delete p.placeholders.response;const r=d.validate(p,{placeholders:{'pre-effect':['response']}});
 assert.equal(r.valid,false);assert.ok(r.diagnostics.some(x=>x.code==='required_placeholder_missing'));
});
observe(3,'missing values invalid encoding mappings and unknown placeholders fail without allow',()=>{
 const p=desc();assert.throws(()=>d.render(p,'pre-effect',{decision:'allow'}),/mandatory_value_missing/);
 p.supported_commands['pre-effect']['pre-effect'].unknown.stdout='{{unlisted}}';assert.equal(d.validate(p).valid,false);
 p.placeholders.response.mapping={xx:'invalid'};assert.equal(d.validate(p).valid,false);
 const q=desc();assert.throws(()=>d.render(q,'pre-effect',{decision:'deny',response:undefined}),/encoding_invalid/);
 const z=desc();z.placeholders.value={source:'response.value',type:'json',required:false,absent:'absent',encoding:'json'};z.supported_commands['pre-effect']['pre-effect'].deny={stdout:'{{value}}',stderr:'',exitCode:2};for(const [response,expected] of [[{},'absent'],[{value:null},'null'],[{value:false},'false'],[{value:''},'""']])assert.equal(d.render(z,'pre-effect',{decision:'deny',response}).stdout,expected);
});
observe(4,'JSON escaping Unicode delimiter literals and placeholder-like values are nonrecursive',()=>{
 const p=desc(),value='"\\\n\t\u0000{{response}} 😀';const out=d.render(p,'pre-effect',{decision:'deny',response:{value}});assert.deepEqual(JSON.parse(out.stdout),{value});
 p.supported_commands['pre-effect']['pre-effect'].deny={stdout:'{{{{value}}}} {{message}}',stderr:'',exitCode:2};p.placeholders.message.mapping={'a':'b','b':'c'};
 assert.equal(d.render(p,'pre-effect',{decision:'deny',response:{payload:{runtime_message:'ab{{message}}'}}}).stdout,'{{value}} bc{{messbge}}');
 const limited=desc();limited.rendering={maxOutputBytes:1024};limited.placeholders.message.mapping={x:'y'.repeat(1024)};limited.supported_commands['pre-effect']['pre-effect'].deny={stdout:'{{message}}',stderr:'',exitCode:2};assert.throws(()=>d.render(limited,'pre-effect',{decision:'deny',response:{payload:{runtime_message:'xx'}}}),/rendered_size_exceeded/);
});
observe(5,'four OOP cases may share a documented native preventive response',()=>{
 const p=desc();for(const decision of ['deny','unknown','error'])p.supported_commands['pre-effect']['pre-effect'][decision]={stdout:'stop',stderr:'',exitCode:2};
 assert.equal(d.validate(p).valid,true);for(const decision of ['deny','unknown','error'])assert.equal(d.render(p,'pre-effect',{decision}).stdout,'stop');
});
observe(6,'pending checkpoint acquisition is scoped and never installation completion',t=>{
 const x=local(t),o=x.acquire({bootstrap:true});assert.equal(o.status,'known');assert.equal(o.checkpoint.status,'pending');assert.equal(o.installation_complete,false);assert.equal(o.maintenance.mode,'normal');
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8'),source=complete(template,{supported_commands:['pre-effect','interaction']}),file=join(x.scope.owned_scope,'oop-runtime-adapter.js');writeFileSync(file,source);const {digest}=require('./fixtures/oop-runtime-adapter.cjs');let seen;
 const record={format:1,...x.scope,runtime_adapter:{path:file,identity:digest(source),template_identity:digest(template),host:'fixture-host',runtime_version:'fixture-version',required_events:['pre-effect']}};
 const engine={config:{source_binding:{source_identity:'fixture'},routing:{},commands:{'pre-effect':{},interaction:{}}},evaluate:(command,request)=>{if(command==='interaction')return {payload:{modules:['core']}};seen=request;return {type:'oop_admission',decision:'unknown',payload:{}};}};
 const f=runtimeFramework(engine,{registration:()=>({ok:true,record})},template);
 const out=f.dispatch('pre-effect',{session:'native-session',context:{project:'forged',runtime:'forged',observed_at:'2000-01-01',dependencies:{external:'host-only'},revision:'r',authority:'a',action_scope:'s'}},{},'fixture-host');assert.equal(out.exit,3);assert.equal(seen.context.project,x.root);assert.equal(seen.context.installation_uid,'uid');assert.ok(seen.context.dependencies.local_checkpoint);assert.equal(seen.evidence.runtime_identity_verified.value,true);assert.deepEqual(seen.maintenance_observation.dependencies,seen.context.dependencies);assert.ok(!Object.hasOwn(seen.evidence,'authority_verified'));

 for(const [file,source] of [[x.bindingFile,'binding'],[x.checkpoint,'checkpoint']]){const bytes=readFileSync(file);rmSync(file);const r=x.acquire();assert.equal(r.status,'unknown');assert.ok(r.diagnostics.some(d=>d.source===source&&d.code==='record_absent'));writeFileSync(file,bytes);}
});
observe(7,'active invocation UID selects among installations and duplicate mappings stay ambiguous',t=>{
 const x=local(t);x.binding.runtimes.unshift({...x.mapping,installation_uid:'peer',checkpoint_ref:'/not-selected'});x.save();assert.equal(x.acquire().status,'known');
 x.binding.runtimes.push({...x.mapping});x.save();assert.ok(x.acquire().diagnostics.some(x=>x.code==='installation_mapping_ambiguous'));
});
observe(8,'facts retain provenance and expired or mismatched records cannot become valid',t=>{
 const x=local(t),o=x.acquire();assert.match(o.observations.checkpoint.identity,/^sha256:/);assert.equal(o.observations.checkpoint.reference,x.checkpoint);assert.ok(o.observations.checkpoint.observed_at);
 x.cp.installation_uid='peer';x.save();assert.equal(x.acquire().status,'unknown');x.cp.installation_uid='uid';x.cp.observed_at='2000-01-01';x.cp.expires_at='2000-01-02';x.save();assert.ok(x.acquire().diagnostics.some(d=>d.code==='record_stale'));
});
observe(9,'candidate validation permits future unavailable evidence with complete unknown cases',()=>{
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8'),f=runtimeFramework({config:{commands:{'pre-effect':{}}}},null,template);
 assert.equal(f.validateManifest(complete(template,{supported_commands:['pre-effect']}),{supported_commands:['pre-effect']}).valid,true);
 assert.equal(f.validateManifest(complete(template,{supported_commands:['pre-effect']}),{supported_commands:['completion']}).valid,false);
});
observe(10,'reading installed status does not prove actual registration or publication',t=>{
 const x=local(t);x.cp.status='installed';x.save();const o=x.acquire();assert.equal(o.status,'known');assert.equal(o.installation_complete,false);
 x.mapping.status='pending';x.save();assert.equal(x.acquire().status,'unknown');assert.equal(x.acquire({bootstrap:true}).status,'known');
});
observe(11,'current scaffold rejects executable manifests and incompatible adapter operations',()=>{
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8'),f=runtimeFramework({config:{commands:{}}},null,template),source=complete(template);
 assert.equal(f.validateManifest(source.replace('"schema_version":1','"schema_version":999')).valid,false);
 assert.equal(f.validateManifest(source.replace('"schema_version":1','"schema_version":(()=>2)()')).valid,false);
 assert.equal(f.validateAdapter(source.replace('manifest:','describe() { return')).valid,false);
 assert.equal(f.validateManifest(source.replace('"schema_version":1','"schema_version":1,"schema_version":1')).diagnostics[0].code,'manifest_duplicate_key');
});
observe(12,'hard links foreign maintenance and changed dependencies block affected acquisition',t=>{
 const x=local(t),peer=join(x.scope.owned_scope,'peer.json');linkSync(x.checkpoint,peer);assert.equal(x.acquire().status,'unknown');rmSync(peer);
 const before=x.acquire().observations.checkpoint.identity;x.cp.revision++;x.save();assert.notEqual(x.acquire().observations.checkpoint.identity,before);
 writeFileSync(join(x.scope.owned_scope,'oop-runtime-adapter-maintenance.json'),JSON.stringify({mode:'normal',revision:1,installation_uid:'peer'}));assert.ok(x.acquire().diagnostics.some(d=>d.code==='maintenance_binding_mismatch'));
});

observe(13,'supported_commands is the canonical declaration and preserves command coverage',()=>{
 const p=descriptor({supported_commands:['pre-effect']});
 assert.deepEqual(Object.keys(p.supported_commands),['pre-effect']);assert.equal(Object.hasOwn(p,'events'),false);
 assert.equal(d.validate(p,{supported_commands:['pre-effect']}).valid,true);
 assert.equal(d.validate(p,{supported_commands:['completion']}).valid,false);
 assert.equal(d.render(p,'pre-effect',{decision:'deny',response:{decision:'deny'}}).exitCode,2);
});
observe(14,'events-only manifests and unsupported versions are rejected',()=>{
 const canonical=desc(),legacy=structuredClone(canonical);legacy.events=legacy.supported_commands;delete legacy.supported_commands;
 assert.equal(d.validate(legacy,{supported_commands:['pre-effect']}).valid,false);
 for(const schema_version of [0,2,999])assert.equal(d.validate({...canonical,schema_version}).valid,false);
});

observe(16,'manifest rejects redundant interface and response metadata',()=>{
 for(const [key,value] of [['interface','oop-runtime-adapter'],['response',{format:'message'}],['description',{}]]){const p=desc();p[key]=value;assert.equal(d.validate(p).valid,false);}
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8'),f=runtimeFramework({config:{commands:{}}},null,template),source=complete(template);
 assert.equal(f.validateAdapter(source.replace('manifest:','description:')).valid,false);
});
observe(17,'cases accept only string channels and bounded integer exitCode',()=>{
 for(const change of [c=>c.grammar='text',c=>c.stdout={},c=>c.stderr=null,c=>c.exitCode='0',c=>c.exitCode=256,c=>c.extra=true]){const p=desc();change(p.supported_commands['pre-effect']['pre-effect'].allow);assert.equal(d.validate(p).valid,false);}
});
observe(18,'string channels do not infer content formats and JSON encoding remains lossless',()=>{
 const p=desc();p.supported_commands['pre-effect']['pre-effect'].allow.stdout='{ordinary text';assert.equal(d.validate(p).valid,true);assert.equal(d.render(p,'pre-effect',{decision:'allow'}).stdout,'{ordinary text');
 for(const decision of ['deny','unknown','error']){const value={text:'"\\\n😀',decision};assert.deepEqual(JSON.parse(d.render(p,'pre-effect',{decision,response:value}).stdout),value);}
});
observe(15,'ambiguous or invalid command lists cannot acquire support',()=>{
 for(const value of [{},[],['pre-effect'],null,'pre-effect']){const p=desc();p.supported_commands=value;assert.equal(d.validate(p).valid,false);}
 for(const value of [['pre-effect'],['completion'],null]){const p=desc();p.events=value;const result=d.validate(p);assert.equal(result.valid,false);assert.ok(result.diagnostics.some(x=>x.code==='manifest_field_unknown'));}
 const engine=require('../dist/oop-enforce.js'),f=require('./fixtures/native-configuration.cjs')('P','v','r');f.configuration_observation.adapter_contract.events=f.configuration_observation.adapter_contract.supported_commands;delete f.configuration_observation.adapter_contract.supported_commands;
 assert.equal(engine.validateConfiguration({format:1,request_id:'events-not-supported',plan:f.configuration_plan,facts:f.configuration_observation}).valid,false);
});

observe(19,'command-local declarations reject obsolete split fields and function selectors',()=>{
 for(const key of ['mappings','cases']){const p=desc();p[key]={};assert.equal(d.validate(p).valid,false);}
 for(const change of [c=>c.function='pre-effect',c=>c.native_event='',c=>c.cases={},c=>c.fallback={},c=>c.extra=true]){const p=desc();change(p.supported_commands['pre-effect']);assert.equal(d.validate(p).valid,false);}
 const p=desc();assert.equal(d.validate(p).valid,true);assert.deepEqual(Object.keys(p.supported_commands['pre-effect']),['pre-effect']);
});

observe(20,'native and decision groups select distinct host response shapes',()=>{
 const p=desc(),c=p.supported_commands['pre-effect']['pre-effect'];
 p.supported_commands['pre-effect']={'First|Second':{'allow|deny|unknown|error':c.allow},Third:{...c,allow:{stdout:'third',stderr:'',exitCode:0}}};
 assert.equal(d.validate(p).valid,true);
 const compiled=d.compile(p);
 for(const native_event of ['First','Second'])for(const decision of ['allow','deny','unknown','error'])assert.equal(contract.render(p,'pre-effect',{event:{native_event},decision,response:{ok:true}},compiled).stdout,'{"ok":true}');
 assert.equal(contract.render(p,'pre-effect',{event:{native_event:'Third'},decision:'allow'},compiled).stdout,'third');
});
observe(21,'overlapping repeated empty and whitespace-padded group tokens are rejected',()=>{
 for(const label of ['A|A','A||B','|A','A|',' A','A |B','A| B']){const p=desc();p.supported_commands['pre-effect']={[label]:p.supported_commands['pre-effect']['pre-effect']};assert.equal(d.validate(p).valid,false,label);}
 const p=desc(),c=p.supported_commands['pre-effect']['pre-effect'];p.supported_commands['pre-effect']={'A|B':c,B:c};assert.ok(d.validate(p).diagnostics.some(x=>x.code==='native_event_overlap'));
 for(const label of ['allow|allow','allow||deny','allow| deny','_|allow','unown','allow|ALLOW']){const q=desc();q.supported_commands['pre-effect']['pre-effect'][label]=c.allow;assert.equal(d.validate(q).valid,false,label);}
 const q=desc();q.supported_commands['pre-effect']['pre-effect']['deny|unknown']=c.deny;assert.ok(d.validate(q).diagnostics.some(x=>x.code==='decision_overlap'));
});
observe(22,'static underscore is optional and never replaces missing outcomes',()=>{
 const p=desc(),c=p.supported_commands['pre-effect']['pre-effect'];c._={stdout:'static {{literal}}',stderr:'',exitCode:2};assert.equal(d.validate(p).valid,true);
 delete c.error;assert.ok(d.validate(p).diagnostics.some(x=>x.code==='decision_case_missing'));c.error=c.deny;
 for(const bad of [null,{stdout:'x',stderr:'',exitCode:256},{stdout:3,stderr:'',exitCode:0},{stdout:'',stderr:'',exitCode:0,extra:true}]){c._=bad;assert.equal(d.validate(p).valid,false);}
});
observe(23,'independent native coverage and native-specific placeholders remain mandatory',()=>{
 const p=desc();assert.equal(d.validate(p,{native_events:{'pre-effect':['pre-effect']}}).valid,true);
 assert.ok(d.validate(p,{native_events:{'pre-effect':['Other']}}).diagnostics.some(x=>x.code==='native_event_missing'));
 assert.ok(d.validate(p,{native_placeholders:{'pre-effect':{'pre-effect':['message']}}}).diagnostics.some(x=>x.code==='required_placeholder_missing'));
});
observe(24,'actual selector must be one declared event and underscore never acts as a decision',()=>{
 const p=desc();for(const native_event of [undefined,'','pre-effect|Other','Other',' pre-effect'])assert.throws(()=>contract.render(p,'pre-effect',{event:{native_event},decision:'allow'}),/native_event/);
 p.supported_commands['pre-effect']['pre-effect']._={stdout:'fallback',stderr:'',exitCode:2};assert.throws(()=>contract.render(p,'pre-effect',{event:{native_event:'pre-effect'},decision:'_'}),/decision_case_missing/);
});
