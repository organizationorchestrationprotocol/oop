import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {knowledgeRecords}=require('../dist/oop-knowledge.js');
const {makeController}=require('./context-controller.cjs');
const {config}=require('../dist/oop-enforce.js');
const {currentRecord,bindRecord}=require('./fixtures/knowledge.cjs');
const k=knowledgeRecords(),date='2026-01-02T00:00:00Z';
const observe=(n,title,fn)=>test('REL-KP-'+String(n).padStart(3,'0')+': '+title,fn);
function fixture(extra={}){
 const header={id:'KP-A',revision:1,domains:['domain-a'],applies_when:[{levels:['G2','G3','G4']}],steps:[{step_id:'CHECK',kind:'check',criticality:'mandatory',evidence_kind:'measurement',text:'Measure the relevant result.'}],sources:[],staleness_triggers:[],format:2,provenance:{kind:'legacy_import',plans:[],research:[],legacy_refs:['fixture://method']},...extra};
 const document='```oop-profile\n'+JSON.stringify(header)+'\n```\n';
 const derived=k.deriveIndex([{locator:'profile.md',document}]);
 const record=currentRecord({classification:{level:'G2',facets:['managed_change']},domains:['domain-a'],profiles:derived.index.profiles.map(e=>({id:e.id,revision:e.revision,content_identity:e.content_identity,disposition:'applied',steps:e.steps.map(s=>({step_id:s.step_id,disposition:'applied',evidence:'fixture://measurement'}))})),missing_domains:[],gaps:[],profile_changes:[],evaluations:[],next_action:'Inspect the result.',updated_at:date,installation_uid:'install-a'},derived.index);
 return {header,document,index:derived.index,record,errors:derived.errors,read:()=>document};
}
const validate=f=>k.validateRecord(f.record,f.index,'closed',f.read);
const codes=f=>validate(f).map(e=>e.code);
function correction(f){
 const event={id:'COR-1',input_ref:'input-1',kind:'correction',statement:'The observed result is incorrect.',source_ref:'fixture://input',observed_at:date,affected_profiles:['KP-A'],disposition:'not_generalizable',reason:'The current supplied dataset was incomplete.'};
 f.record.events.push(event);f.record.input_coverage[0].event_refs.push(event.id);return event;
}
function evaluation(f,extra={}){const e={event_ref:'COR-1',profile:'KP-A',profile_revision:1,outcome:'adequate_applied',deficient:false,trigger:'Correction observed.',finding:'Method applied; the supplied dataset was incomplete.',...extra};f.record.evaluations.push(e);return e;}
observe(22,'exact event/profile linkage rejects omitted duplicate and unrelated evaluations',()=>{
 const f=fixture();assert.deepEqual(validate(f),[]);correction(f);assert.ok(codes(f).includes('knowledge_event_pending'));
 evaluation(f);assert.deepEqual(validate(f),[]);f.record.evaluations.push({...f.record.evaluations[0]});assert.ok(codes(f).includes('knowledge_record_invalid'));
 f.record.evaluations[1].event_ref='unknown';assert.ok(codes(f).includes('knowledge_record_invalid'));
 f.record.evaluations.pop();f.record.evaluations[0].profile_revision=9;assert.ok(codes(f).includes('knowledge_record_invalid'));
});
observe(23,'one input can contain a question and correction and requires a disposition',()=>{
 const f=fixture(),event=correction(f);evaluation(f);f.record.events[0].kind='question';assert.deepEqual(validate(f),[]);
 delete event.disposition;assert.ok(codes(f).includes('knowledge_event_pending'));
 event.disposition='deferred_by_owner';assert.ok(codes(f).includes('knowledge_record_invalid'));
 event.decision_ref='operations:decisions/DEC-1';assert.deepEqual(validate(f),[]);
 f.record.input_coverage[0].event_refs=[];assert.ok(codes(f).includes('knowledge_record_invalid'));
});
observe(24,'profile deficiency requires a revision gap and cannot be dismissed as local',()=>{
 const f=fixture(),event=correction(f);evaluation(f,{outcome:'missing_step',deficient:true,gap_ref:'GAP-1'});
 assert.ok(codes(f).includes('knowledge_record_invalid'));
 f.record.gaps=[{id:'GAP-1',description:'Missing check.',affected_work:'Measurement.',action:'new_revision',action_ref:'KP-A@2',resume_condition:'Revision published and read back.',status:'open'}];
 assert.ok(codes(f).includes('knowledge_event_pending'));event.disposition='deferred_by_owner';event.decision_ref='operations:decisions/DEC-1';
 assert.ok(codes(f).includes('knowledge_event_pending'));assert.ok(k.validateRecord(f.record,f.index,'execution',f.read).some(e=>e.item==='COR-1:revision'));
 f.record.gaps[0].status='resolved';assert.ok(validate(f).some(e=>e.item==='COR-1:revision_publication'));
});
observe(25,'only changed resource dependencies invalidate evidence',()=>{
 const f=fixture();f.record.work_state.resources.push({id:'unrelated',revision:'1'});f.record.work_state.id='state-2';
 f.record.work_state.resources[1].revision='2';assert.deepEqual(validate(f),[]);
 f.record.work_state.resources[0].revision='2';assert.ok(codes(f).includes('knowledge_evidence_stale'));
 f.record.profiles[0].steps[0].evidence.resources[0].revision='2';assert.deepEqual(validate(f),[]);
 delete f.record.profiles[0].steps[0].evidence.resources;assert.ok(codes(f).includes('knowledge_record_invalid'));
});
observe(26,'semantic identity includes conditions scope sources and profile revision',()=>{
 const f=fixture(),step=f.header.steps[0],identity=k.stepIdentity(f.header,step);
 for(const change of [{...step,criticality:'conditional',condition:[{domains:['domain-a']}]},{...step,text:'A different check.'}])assert.notEqual(k.stepIdentity(f.header,change),identity);
 assert.notEqual(k.stepIdentity({...f.header,applies_when:[{scopes:['project-a']}]},step),identity);
 assert.notEqual(k.stepIdentity({...f.header,sources:[{locator:'fixture://source',observed:'1',observed_at:date}]},step),identity);
 f.record.profiles[0].steps[0].evidence.profile_revision=2;assert.ok(codes(f).includes('knowledge_evidence_stale'));
});
observe(27,'draft retired superseded and ambiguous profiles never win by numeric maximum',()=>{
 const active=fixture();for(const status of ['draft','retired'])assert.equal(fixture({revision:9,publication:status}).index.profiles.length,0);
 assert.equal(fixture({superseded_by:{id:'KP-B',revision:1}}).index.profiles.length,0);
 const other=fixture({revision:2});assert.ok(k.deriveIndex([{locator:'a.md',document:active.document},{locator:'b.md',document:other.document}]).errors.some(e=>e.item.includes('duplicate_id')));
});
observe(28,'scoped criteria apply only in scope and preserve justified exclusions',()=>{
 const f=fixture({applies_when:[{levels:['G2'],scopes:['project-a']}]});
 assert.equal(k.applicable(f.index,{level:'G2',facets:[],domains:['domain-a'],scopes:['project-b']}).length,0);
 assert.equal(k.applicable(f.index,{level:'G2',facets:[],domains:['domain-a'],scopes:['project-a']}).length,1);
 f.record.scopes=['project-a'];f.record.profiles[0].steps[0]={step_id:'CHECK',disposition:'not_applicable',reason:'No matching data in this work.'};assert.deepEqual(validate(f),[]);
});
observe(29,'incorporation requires a current target and actual research or a precise exemption',()=>{
 const f=fixture(),event=correction(f);evaluation(f);event.disposition='incorporated';event.target={id:'KP-A',revision:1,step_id:'CHECK'};
 assert.ok(codes(f).includes('knowledge_record_invalid'));
 event.reconciliation={status:'exempt',search:'The input is a pure preference.',sources_read:[],unavailable:[],differences:'No external criterion.',conflicts:[],exemption:{code:'pure_preference',reason:'The owner selected among equal alternatives.'}};assert.deepEqual(validate(f),[]);
 event.target.revision=9;assert.ok(codes(f).includes('knowledge_event_pending'));event.target.revision=1;
 event.reconciliation={status:'performed',search:'Read the relevant primary source.',sources_read:[],unavailable:[],differences:'No differences.',conflicts:[]};assert.ok(codes(f).includes('knowledge_record_invalid'));
 event.reconciliation.sources_read=[{locator:'fixture://source',observed_at:date,part:'Relevant criterion.'}];assert.deepEqual(validate(f),[]);
 event.reconciliation.conflicts=[{owner_statement:'Choice A',source_statement:'Choice B',report_ref:''}];assert.ok(codes(f).includes('knowledge_record_invalid'));
});
observe(30,'non-application requires renewed evidence before verification',()=>{
 const f=fixture(),event=correction(f);event.observed_at='2026-01-03T00:00:00Z';evaluation(f,{outcome:'not_applied',step_id:'CHECK'});
 assert.ok(codes(f).includes('knowledge_event_pending'));f.record.profiles[0].steps[0].evidence.observed_at='2026-01-03T01:00:00Z';assert.deepEqual(validate(f),[]);
});
observe(31,'current record identity installation work item and native input are independently checked',()=>{
 const f=fixture(),knowledge={format:1,record_ref:'ticket.json',record_identity:k.identity(k.canonical(f.record)),profiles:f.record.profiles.map(p=>({id:p.id,revision:p.revision,content_identity:p.content_identity,disposition:p.disposition,steps:p.steps.map(s=>({step_id:s.step_id,disposition:s.disposition}))}))};
 const args={index:f.index,knowledge,ctx:{...f.record.classification,domains:f.record.domains},state:'verification',readProfile:f.read,record:f.record,expectedInput:'input-1',installation:'install-a',workItem:'WI-1'};
 assert.equal(k.verifyDeclaration(args).status,'verified');assert.equal(k.verifyDeclaration({...args,expectedInput:'other'}).code,'knowledge_input_missing');
 assert.equal(k.verifyDeclaration({...args,installation:'peer'}).code,'knowledge_record_mismatch');assert.equal(k.verifyDeclaration({...args,workItem:'other'}).code,'knowledge_record_mismatch');
 f.record.next_action='Changed after declaration.';assert.equal(k.verifyDeclaration(args).code,'knowledge_record_mismatch');
 assert.equal(k.declarationShape({...knowledge,record_ref:'../peer/ticket.json'}),false);
});
observe(32,'retained obligations resolve current records before reclassification and respect closure and stop',t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'oop currency-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const owned=path.join(root,'.priv','tools','runtime','install-a'),checkout=path.join(root,'.priv','common','oop'),operations=path.join(root,'operations');for(const folder of [owned,checkout,operations])fs.mkdirSync(folder,{recursive:true});
 const f=fixture();fs.writeFileSync(path.join(operations,'profile.md'),f.document);fs.writeFileSync(path.join(operations,k.INDEX),k.canonical(f.index));
 const registration={format:1,interface:'oop-context-1',installation_uid:'install-a',project_root:root,owned_scope:owned,lifecycle:'active',filesystem_local:true},w={operations,registration};
 const engine=makeController(config),prompt=engine.compose(registration,{event:'prompt',chat:'chat-a'}).context;
 assert.equal(prompt.knowledge_input.reference,k.inputReference('chat-a',prompt.turn));
 const event=bindRecord(w,{event:'record',chat:'chat-a',request_id:'req-1',subject:'sub-1',turn:prompt.turn,expected_version:prompt.version,state:'planning',level:'G2',related_ticket:true,facets:['managed_change'],relation:'independent',work_item:'WI-1',domains:['domain-a'],knowledge:{profiles:[]}});
 event.knowledge.profiles=[{id:'KP-A',revision:1,content_identity:f.index.profiles[0].content_identity,disposition:'applied',steps:[]}];delete event.knowledge.format;
 const bound=bindRecord(w,event),accepted=engine.compose(registration,bound).context;assert.equal(accepted.status,'record_accepted');
 const file=path.join(operations,'WI-1.json'),stored=JSON.parse(fs.readFileSync(file));correction({record:stored.knowledge});stored.knowledge.events.at(-1).input_ref=stored.knowledge.input_coverage[0].id;fs.writeFileSync(file,JSON.stringify(stored));
 const next=engine.compose(registration,{event:'prompt',chat:'chat-a'}).context;assert.equal(next.knowledge_obligations.subjects.length,1);assert.ok(next.knowledge_obligations.subjects[0].pending.some(e=>e.code==='knowledge_event_pending'));assert.equal(next.knowledge_obligations.subjects[0].profiles[0].provenance,'legacy_import');
 stored.state='closed';fs.writeFileSync(file,JSON.stringify(stored));assert.equal(engine.compose(registration,{event:'snapshot',chat:'chat-a'}).context.knowledge_obligations.subjects.length,0);
 const stopped=engine.compose(registration,{event:'turn_stop',chat:'chat-a',origin:'user'}).context;assert.equal(stopped.turn_state.state,'interrupted');
 assert.ok(!JSON.stringify(next).includes('The observed result is incorrect.'),'raw event wording is not in controller history/context');
});
observe(33,'malformed dependency and event shapes reject without crashing and historical absence stays explicit',()=>{
 const f=fixture();f.record.work_state.resources='invalid';assert.ok(codes(f).includes('knowledge_record_invalid'));
 const g=fixture();g.record.input_coverage.push({id:'historical',source_ref:'fixture://unavailable',observed_at:date,basis:'runtime_declared',status:'not_retrievable',event_refs:[],reason:'The transcript is inaccessible.'});assert.deepEqual(validate(g),[]);
 g.record.events[0].input_ref='historical';assert.ok(codes(g).includes('knowledge_record_invalid'));
 const h=fixture();h.record.decisions=[{id:'DEC-1',statement:'Apply the check.',step_refs:[{profile:'KP-A',step_id:'CHECK'}]}];assert.deepEqual(validate(h),[]);h.record.decisions[0].step_refs[0].step_id='unknown';assert.ok(codes(h).includes('knowledge_record_invalid'));
});
