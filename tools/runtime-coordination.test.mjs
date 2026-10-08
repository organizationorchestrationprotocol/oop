import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {moduleSemantics,routingDirective,useLimit,runtimeIndexBudgetBytes,statusLineBudgetBytes} from './module-semantics.mjs';
import {modules} from './release-plan.mjs';
const require=createRequire(import.meta.url);
const engine=require('../dist/oop-enforce.js'),index=require('../dist/index.json'),routing=require('../dist/routing.json');
const observe=(n,title,fn)=>test('REL-RTC-'+String(n).padStart(3,'0')+': '+title,fn);
const bytes=s=>Buffer.byteLength(s,'utf8');
function workspace(t,uid='uid-a'){
  const root=mkdtempSync(join(tmpdir(),'oop-rtc-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const p of ['src','.priv/common','.priv/tools/rt/'+uid])mkdirSync(join(root,p),{recursive:true});
  writeFileSync(join(root,'src/card.jsx'),'export default 1;\n');
  return root;
}
const facts=(root,extra={},uid='uid-a')=>({project_root:root,private_root:join(root,'.priv'),owned_scope_locator:join(root,'.priv/tools/rt',uid),
  common_scope_locator:join(root,'.priv/common'),session:'s1',installation_uid:uid,runtime_class:'rt',filesystem_local:true,filesystem_case_sensitive:process.platform==='linux',
  paths_resolved_without_aliases:true,scope_ownership_verified:true,observed_at:new Date().toISOString(),...extra});
let seq=0;
// These assertions isolate the bounded coordination projection; every blocked
// response is also checked for the independent concrete remediation envelope.
const projection=r=>{
 if(r.decision!=='allow'){assert.ok(r.payload.remediation.actions.length);assert.match(r.payload.runtime_message,/Retry only when:/);}
 const message=r.payload.runtime_message;
 return {...r,payload:{...r.payload,coordination_message:message.split('\nOOP action required: ')[0].replace(/^OOP action required: [\s\S]*$/,'')}};
};
const admit=(command,coordination,extra={})=>projection(engine.evaluate(command,{format:1,request_id:'r'+(++seq),scope:{classification:'unknown'},...(coordination?{coordination}:{}),...extra}));
const declare=(coordination,body)=>engine.coordinate('declare',{format:1,request_id:'d'+(++seq),coordination,...body});
const write=(root,extra={})=>admit('pre-effect',facts(root,{resource:{path:'src/card.jsx',access:'write'},...extra}));
const cli=(command,input)=>spawnSync(process.execPath,['dist/oop-enforce.js',command],{input:typeof input==='string'?input:JSON.stringify(input),encoding:'utf8'});

observe(1,'runtime index covers every consumer module with specific bounded semantics and the fixed directive',()=>{
  const consumer=modules.filter(m=>m.id!=='producer');
  assert.deepEqual(index.modules,consumer.map(m=>m.id));
  for(const field of ['use','conditions','preconditions','postconditions'])assert.equal(new Set(modules.map(m=>moduleSemantics[m.id][field])).size,modules.length,field);
  assert.ok(consumer.every(m=>moduleSemantics[m.id].use.length<=useLimit&&index.text.includes('- '+m.id+' [')));
  assert.ok(index.text.endsWith(routingDirective));assert.equal(bytes(index.text),index.bytes);assert.ok(index.bytes<=runtimeIndexBudgetBytes);
  assert.equal(index.fingerprint,'sha256:'+require('node:crypto').createHash('sha256').update(index.text).digest('hex'));
  assert.ok(!index.text.includes('producer ['));
  const tickets=require('../dist/details/tickets.json'),cost=require('../dist/details/cost.json');
  assert.notEqual(tickets.semantic_conditions,cost.semantic_conditions);assert.equal(tickets.use,moduleSemantics.tickets.use);
  assert.ok(!routing.modules.some(m=>m.id==='index'));assert.equal(require('../dist/entry.json').routing_index,'index.json');
});
observe(2,'entry delivers the full index, interaction only a bounded status line, compaction and fingerprint change re-deliver',t=>{
  const root=workspace(t);
  const entry=admit('entry',facts(root));assert.ok(entry.payload.coordination_message.startsWith(index.text));
  const turn=admit('interaction',facts(root)).payload.coordination_message;
  assert.match(turn,/^OOP state=classifying | index=[a-f0-9]{12} unchanged | instr=[a-f0-9]{12} | work=none\| index=[a-f0-9]{12} unchanged \| work=none \| level=none \| unread=0 \| next=classify the request and declare it through the adapter$/);
  assert.ok(bytes(turn)<=statusLineBudgetBytes);
  const compacted=admit('interaction',facts(root,{context_event:'compact'})).payload.coordination_message;
  assert.ok(compacted.startsWith(index.text));assert.match(compacted,/state=context_stale/);
  const state=join(root,'.priv/tools/rt/uid-a/sessions/s1/state.json'),record=JSON.parse(readFileSync(state,'utf8'));
  record.index_identity_delivered='sha256:'+'0'.repeat(64);writeFileSync(state,JSON.stringify(record));
  engine.coordinate('load',{format:1,request_id:'ack',coordination:facts(root),tier:1});
  record.index_identity_delivered='sha256:'+'0'.repeat(64);writeFileSync(state,JSON.stringify({...JSON.parse(readFileSync(state,'utf8')),index_identity_delivered:'sha256:'+'0'.repeat(64)}));
  const changed=admit('interaction',facts(root)).payload.coordination_message;assert.ok(changed.startsWith(index.text));assert.match(changed,/ changed \|/);
  const stateless=admit('interaction',null).payload.coordination_message;assert.match(stateless,/^OOP state=uninitialized/);
});
observe(3,'load returns tiers 1-3 through the process boundary, rejects producer context and acknowledges stale context',t=>{
  const root=workspace(t);
  for(const tier of [2,3]){const r=cli('load',{format:1,request_id:'l'+tier,tier,modules:['tickets']});assert.equal(r.status,0);const out=JSON.parse(r.stdout);
    assert.equal(out.type,'oop_runtime_coordination');assert.equal(out.effect_permission,'not_granted');assert.equal(out.result.modules[0].id,'tickets');
    assert.ok(tier===2?out.result.modules[0].record.use:out.result.modules[0].record.contracts[0].semantic_clause);}
  assert.equal(cli('load',{format:1,request_id:'p',tier:3,modules:['producer']}).status,2);
  assert.equal(cli('load',{format:1,request_id:'x',tier:9}).status,2);assert.equal(cli('load','{').status,4);
  admit('entry',facts(root,{context_event:'compact'}));
  assert.equal(declare(facts(root),{phase:'classification',facets:['managed_change'],level:'G2'}).reason,'context_stale_reload_required');
  const ack=engine.coordinate('load',{format:1,request_id:'t1',coordination:facts(root),tier:1});
  assert.equal(ack.accepted,true);assert.equal(ack.result.text,index.text);assert.notEqual(ack.state,'context_stale');
});
observe(4,'state is per session inside the owned scope; runtimes and sessions stay independent; nothing leaves the private area',t=>{
  const root=workspace(t);mkdirSync(join(root,'.priv/tools/rt/uid-b'),{recursive:true});
  admit('interaction',facts(root));admit('interaction',facts(root,{session:'s2'}));admit('interaction',facts(root,{},'uid-b'),{});
  admit('interaction',{...facts(root,{},'uid-b')});
  assert.ok(existsSync(join(root,'.priv/tools/rt/uid-a/sessions/s1/state.json')));assert.ok(existsSync(join(root,'.priv/tools/rt/uid-a/sessions/s2/state.json')));
  assert.ok(existsSync(join(root,'.priv/tools/rt/uid-b/sessions/s1/state.json')));
  declare(facts(root),{phase:'classification',facets:['managed_change'],level:'G2'});
  assert.equal(JSON.parse(readFileSync(join(root,'.priv/tools/rt/uid-a/sessions/s2/state.json'),'utf8')).governance_level,null);
  assert.deepEqual(readdirSync(root).sort(),['.priv','src']);assert.deepEqual(readdirSync(join(root,'src')),['card.jsx']);
  for(const bad of [{owned_scope_locator:join(root,'.priv/common/uid-a')},{owned_scope_locator:join(root,'elsewhere/uid-a')},{paths_resolved_without_aliases:false},{session:undefined}]){
    const r=declare(facts(root,bad),{phase:'clarification'});assert.equal(r.accepted,false);}
  assert.ok(!existsSync(join(root,'elsewhere')));
});
observe(5,'declarations move only runtime-context states and every change is reconstructible',t=>{
  const root=workspace(t);
  admit('interaction',facts(root));
  assert.equal(declare(facts(root),{phase:'clarification'}).state,'classifying');
  assert.match(admit('interaction',facts(root)).payload.coordination_message,/next=clarify scope with the user/);
  assert.equal(declare(facts(root),{phase:'classification',facets:['managed_change','durable_work'],level:'G2',resources:['src']}).state,'working');
  assert.match(declare(facts(root),{phase:'attach',work_item:{kind:'ticket',id:'TKT-0005'}}).runtime_message,/work=TKT-0005 \| level=G2 .*next=continue TKT-0005$/);
  assert.equal(declare(facts(root),{phase:'transition',work_item_state:'verification'}).state,'working');
  assert.equal(declare(facts(root),{phase:'transition',work_item_state:'closed'}).state,'idle');
  const st=JSON.parse(readFileSync(join(root,'.priv/tools/rt/uid-a/sessions/s1/state.json'),'utf8'));
  assert.ok(st.history.length>=3&&st.history.every(h=>h.from&&h.to&&h.event&&h.at));
  assert.ok(!['verification','waiting_human','waiting_external','clarifying'].some(s=>require('./runtime-coordination.cjs').runtimeCoordination('.').STATES.includes(s)));
  assert.equal(declare(facts(root),{phase:'classification',facets:['no_such_facet'],level:'G2'}).reason,'unknown_or_missing_facet');
  assert.equal(declare(facts(root),{phase:'attach'}).reason,'work_item_required');
});
observe(6,'a declaration is a claim and never changes an admission decision to allow',t=>{
  const root=workspace(t);admit('interaction',facts(root));
  const before=write(root);declare(facts(root),{phase:'classification',facets:['managed_change'],level:'G2',work_item:{kind:'ticket',id:'TKT-1'}});
  const after=write(root);assert.notEqual(after.decision,'allow');assert.equal(after.decision,before.decision);assert.equal(after.effect_permission,'not_granted');
  const r=declare(facts(root),{phase:'transition',work_item_state:'completed'});assert.equal(r.effect_permission,'not_granted');assert.equal(r.result.declaration,'runtime_claim_not_evidence');
});
observe(7,'without a maintenance observation an unclassified project write is still reported before the effect',t=>{
  const root=workspace(t);admit('interaction',facts(root));
  const r=write(root);assert.equal(r.reason_code,'maintenance_state_unresolved');assert.notEqual(r.decision,'allow');
  assert.match(r.payload.coordination_message,/^OOP mismatch before writing src\/card\.jsx: effect_without_classification\./);
});
observe(8,'each mismatch is produced by its input, G0/G1 need no ticket and correct writes stay silent',t=>{
  const root=workspace(t);const codes=()=>write(root).payload.coordination_message;
  admit('interaction',facts(root));declare(facts(root),{phase:'classification',facets:['information'],level:'G0'});assert.match(codes(),/effect_exceeds_declared_level/);
  admit('completion',facts(root));
  declare(facts(root),{phase:'classification',facets:['local_write'],level:'G1'});assert.equal(codes(),'');
  admit('completion',facts(root));
  declare(facts(root),{phase:'classification',facets:['managed_change'],level:'G2',resources:['src']});assert.match(codes(),/effect_without_work_item/);
  admit('completion',facts(root));
  declare(facts(root),{phase:'attach',work_item:{kind:'reference',id:'https://example.invalid/issues/7'}});assert.equal(codes(),'');
  admit('completion',facts(root));
  declare(facts(root),{phase:'attach',work_item:{kind:'reference',id:'https://example.invalid/issues/7'},resources:['docs']});assert.match(codes(),/effect_outside_declared_scope/);
  admit('completion',facts(root));
  admit('entry',facts(root,{context_event:'restore'}));assert.match(codes(),/effect_with_stale_context/);
  const priv=admit('pre-effect',facts(root,{resource:{path:'.priv/common/note.json',access:'write'}}));assert.match(priv.payload.coordination_message,/effect_with_stale_context/);
  for(const command of ['post-effect','completion','recovery'])assert.equal(admit(command,facts(root)).payload.coordination_message,'');
});
observe(9,'enforcing mode denies leased resources and stale context, advisory mode only reports, policy can extend denials',t=>{
  const root=workspace(t);admit('interaction',facts(root));
  declare(facts(root),{phase:'classification',facets:['local_write'],level:'G1'});write(root);
  const other=facts(root,{session:'s9',resource:{path:'src/card.jsx',access:'write'}});
  assert.notEqual(admit('pre-effect',other).decision,'deny');
  const denied=admit('pre-effect',{...other,mode:'enforcing'});assert.equal(denied.decision,'deny');assert.equal(denied.reason_code,'resource_leased');assert.equal(denied.effect_permission,'not_granted');
  admit('entry',facts(root,{context_event:'compact'}));
  assert.equal(write(root,{mode:'enforcing'}).reason_code,'effect_with_stale_context');
  const fresh=workspace(t);admit('interaction',facts(fresh));
  assert.equal(write(fresh,{mode:'enforcing'}).decision==='deny',false);
  assert.equal(write(fresh,{mode:'enforcing',policy_deny:['effect_without_classification']}).reason_code,'effect_without_classification');
});
observe(10,'concurrent lease creation and expired takeover admit exactly one holder across processes',async t=>{
  const root=workspace(t);
  const race=async(prepare)=>{
    const dir=join(root,'.priv/common/leases');rmSync(dir,{recursive:true,force:true});prepare?.(dir);
    const script=`const c=require(${JSON.stringify(resolve('tools/runtime-coordination.cjs'))}).runtimeCoordination('.');
      const f=c.resolveFacts(JSON.parse(process.argv[1]),new Date().toISOString());process.stdout.write(c.acquireLease(f,process.argv[2]).status);`;
    const outs=await Promise.all(Array.from({length:8},(_,i)=>new Promise((ok,ko)=>{const p=spawn(process.execPath,['-e',script,JSON.stringify(facts(root,{session:'p'+i})),join(root,'src/card.jsx').replaceAll('\\','/')]);
      let s='';p.stdout.on('data',x=>s+=x);p.on('error',ko);p.on('close',()=>ok(s));})));
    return outs;
  };
  const fresh=await race();assert.equal(fresh.filter(s=>s==='acquired').length,1,String(fresh));assert.equal(fresh.filter(s=>s==='leased').length,7,String(fresh));
  const c=require('./runtime-coordination.cjs').runtimeCoordination('.');
  const takeover=await race(dir=>{mkdirSync(dir,{recursive:true});const f=c.resolveFacts(facts(root,{session:'old'}),'2020-01-01T00:00:00Z');c.acquireLease(f,join(root,'src/card.jsx').replaceAll('\\','/'));});
  // Exactly one holder wins: a takeover, or an exclusive create in the instant after the expired lease moved aside.
  assert.equal(takeover.filter(s=>s==='taken_over'||s==='acquired').length,1,String(takeover));assert.equal(takeover.filter(s=>s==='leased').length,7,String(takeover));
  assert.deepEqual(readdirSync(join(root,'.priv/common/leases')).filter(n=>!n.endsWith('.json')),[]);
});
observe(11,'the normative lease sequence is reproduced: create, conflict, extend, release, reacquire',t=>{
  const root=workspace(t);const A=facts(root),B=facts(root,{session:'b'});
  admit('interaction',A);declare(A,{phase:'classification',facets:['managed_change'],level:'G2',work_item:{kind:'ticket',id:'TKT-0005'}});
  const leaseDir=join(root,'.priv/common/leases');
  assert.equal(write(root).payload.coordination_message,'');const first=JSON.parse(readFileSync(join(leaseDir,readdirSync(leaseDir)[0]),'utf8'));
  assert.equal(first.work_item,'TKT-0005');
  assert.match(admit('pre-effect',{...B,resource:{path:'src/card.jsx',access:'write'}}).payload.coordination_message,/resource_leased \(leased by uid-a \(work TKT-0005\) until /);
  admit('post-effect',facts(root,{resource:{path:'src/card.jsx',access:'write'},observed_at:new Date(Date.now()+60000).toISOString()}));
  const extended=JSON.parse(readFileSync(join(leaseDir,readdirSync(leaseDir)[0]),'utf8'));assert.ok(Date.parse(extended.expires)>Date.parse(first.expires));
  admit('completion',A);assert.deepEqual(readdirSync(leaseDir),[]);
  admit('interaction',B);declare(B,{phase:'classification',facets:['local_write'],level:'G1'});
  assert.doesNotMatch(admit('pre-effect',{...B,resource:{path:'src/card.jsx',access:'write'}}).payload.coordination_message,/resource_leased/);
  assert.equal(readdirSync(leaseDir).length,1);
  declare(B,{phase:'attach',work_item:{kind:'ticket',id:'TKT-9'}});
});
observe(12,'unknown write resources and unobserved locality create no lease and claim no protection',t=>{
  const root=workspace(t);admit('interaction',facts(root));declare(facts(root),{phase:'classification',facets:['local_write'],level:'G1'});
  admit('pre-effect',facts(root,{resource:{path:'src/card.jsx',access:'unknown'}}));
  admit('pre-effect',facts(root));
  assert.ok(!existsSync(join(root,'.priv/common/leases')));
  write(root,{filesystem_local:false});assert.ok(!existsSync(join(root,'.priv/common/leases'))||!readdirSync(join(root,'.priv/common/leases')).length);
});
observe(13,'a resource changed outside contact points after it was read is reported before the next write',t=>{
  const root=workspace(t);admit('interaction',facts(root));declare(facts(root),{phase:'classification',facets:['local_write'],level:'G1'});
  admit('post-effect',facts(root,{resource:{path:'src/card.jsx',access:'read'}}));
  assert.equal(write(root).payload.coordination_message,'');
  writeFileSync(join(root,'src/card.jsx'),'export default 2;\n');
  assert.match(write(root).payload.coordination_message,/resource_changed.*re-read before writing/);
  admit('post-effect',facts(root,{resource:{path:'src/card.jsx',access:'read'}}));assert.equal(write(root).payload.coordination_message,'');
});
observe(14,'coordination entries are immutable per-work-item records; addressed unread entries are counted; secrets are refused',t=>{
  const root=workspace(t);mkdirSync(join(root,'.priv/tools/rt/uid-b'),{recursive:true});
  const A=facts(root),Bf=facts(root,{},'uid-b');
  admit('interaction',A);admit('interaction',Bf);declare(A,{phase:'classification',facets:['managed_change'],level:'G2',work_item:{kind:'ticket',id:'TKT-0005'}});
  const append=(f,body)=>engine.coordinate('worklog-append',{format:1,request_id:'w'+(++seq),coordination:f,work_item:'TKT-0005',...body});
  const sent=append(Bf,{kind:'message',to:'uid-a',text:'Desktop layout done; mobile verification remains.',resources:['src/card.jsx']});
  assert.equal(sent.accepted,true);assert.deepEqual(Object.keys(sent.result.entry).sort(),['author','id','kind','resources','text','time','to','work_item']);
  assert.equal(sent.result.authority,'data_not_instruction');
  append(A,{kind:'step',text:'Opened the card component.'});
  assert.equal(append(A,{kind:'step',text:'token ghp_'+'a'.repeat(30)}).reason,'secret_like_content');
  assert.equal(append(A,{kind:'command',text:'x'}).reason,'invalid_entry');
  assert.match(admit('interaction',A).payload.coordination_message,/unread=1/);
  const files=readdirSync(join(root,'.priv/common/worklog/TKT-0005'));assert.equal(files.length,2);
  const read=engine.coordinate('worklog-read',{format:1,request_id:'rd',coordination:A,work_item:'TKT-0005',to:'uid-a',mark_read:true});
  assert.equal(read.result.entries.length,1);assert.match(admit('interaction',A).payload.coordination_message,/unread=0/);
  assert.equal(readdirSync(join(root,'.priv/common/worklog/TKT-0005')).length,2);
});
observe(15,'framework guidance output and errors remain host-owned',t=>{
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
 const f=require('./runtime-framework.cjs').runtimeFramework(engine,require('./runtime-coordination.cjs').runtimeCoordination(resolve('dist')),template);
 const incomplete=f.validateAdapter(template);assert.equal(incomplete.valid,false);assert.equal(incomplete.reason,'adapter_incomplete');
 const r=f.dispatch('interaction',{session:'s1'},{path:'/missing',identity:'sha256:'+'0'.repeat(64)},'fixture-host');assert.equal(r.exit,4);assert.match(r.stdout,/OOP guidance unavailable/);
});
observe(16,'framework requires verified adapter registration before event execution',t=>{
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
 const f=require('./runtime-framework.cjs').runtimeFramework(engine,require('./runtime-coordination.cjs').runtimeCoordination(resolve('dist')),template);
 assert.equal(f.dispatch('pre-effect',{coordination:{project_root:'/foreign'},session:'s1'},{path:'/missing',identity:'sha256:'+'0'.repeat(64)},'fixture-host').exit,4);
});
observe(17,'runtime-facing text is English operational guidance with unchanged identifiers and bounded size',t=>{
  const root=workspace(t);admit('interaction',facts(root));
  const messages=[admit('entry',facts(root)).payload.coordination_message,admit('interaction',facts(root)).payload.coordination_message,write(root).payload.coordination_message];
  for(const m of messages){assert.match(m,/^[\x20-\x7e\n]+$/);assert.ok(bytes(m)<=runtimeIndexBudgetBytes+statusLineBudgetBytes+1);}
  assert.match(messages[2],/src\/card\.jsx: effect_without_classification/);
  const interfaces=require('../dist/interfaces.json').enforcement;
  assert.equal(interfaces.interface,'oop-admission-1');assert.equal(interfaces.runtime_message.language,'English operational text');
  assert.deepEqual(Object.keys(interfaces.runtime_coordination_commands),['declare','load','worklog-append','worklog-read']);
  assert.match(interfaces.state_writes,/^confined/);
});
observe(18,'the incident scenario: G2 path, G1 path and the skipped-declaration counter-example',t=>{
  const g2=workspace(t),f=facts(g2);
  assert.ok(admit('entry',f).payload.coordination_message.startsWith(index.text));
  assert.match(admit('interaction',f).payload.coordination_message,/state=classifying .*next=classify the request/);
  assert.match(declare(f,{phase:'classification',facets:['managed_change','durable_work'],level:'G2',resources:['src/card.jsx']}).runtime_message,/next=open or attach the governing work item/);
  assert.equal(declare(f,{phase:'attach',work_item:{kind:'ticket',id:'TKT-0005'}}).state,'working');
  assert.equal(write(g2).payload.coordination_message,'');assert.equal(admit('completion',f).payload.coordination_message,'');
  assert.match(admit('interaction',f).payload.coordination_message,/state=working .*work=TKT-0005 .*next=continue TKT-0005/);
  for(const s of ['verification','completed'])declare(f,{phase:'transition',work_item_state:s});
  assert.equal(declare(f,{phase:'transition',work_item_state:'closed'}).state,'idle');
  const g1=workspace(t),h=facts(g1);admit('entry',h);admit('interaction',h);
  declare(h,{phase:'classification',facets:['local_write'],level:'G1',resources:['src/card.jsx']});assert.equal(write(g1).payload.coordination_message,'');
  const skipped=workspace(t),k=facts(skipped);admit('entry',k);admit('interaction',k);
  assert.match(write(skipped).payload.coordination_message,/effect_without_classification/);
});
observe(19,'coordination commands use typed envelopes and exits 0/2/4 and never grant permission',t=>{
  const root=workspace(t);
  const unknown=cli('declare',{format:1,request_id:'c0',coordination:facts(root),phase:'clarification'});assert.equal(unknown.status,2);assert.equal(JSON.parse(unknown.stdout).reason,'unknown_session');
  assert.ok(!existsSync(join(root,'.priv/tools/rt/uid-a/sessions/s1/state.json')));admit('interaction',facts(root));
  const ok=cli('declare',{format:1,request_id:'c1',coordination:facts(root),phase:'clarification'});assert.equal(ok.status,0);
  const out=JSON.parse(ok.stdout);assert.deepEqual(Object.keys(out).sort(),['accepted','command','effect_permission','error','format','reason','request_id','result','runtime_message','source_binding','state','type']);
  assert.equal(out.effect_permission,'not_granted');
  assert.equal(cli('declare',{format:1,request_id:'c2',phase:'clarification'}).status,2);
  assert.equal(cli('declare',{format:1,request_id:'c3',phase:'clarification',unexpected:true}).status,4);
  assert.equal(cli('worklog-read','not json').status,4);
  const admission=cli('interaction',{format:1,request_id:'i',scope:{classification:'unknown'}});assert.equal(admission.status,3);assert.equal(typeof JSON.parse(admission.stdout).payload.runtime_message,'string');
});
observe(20,'the R28 recap notice appears at the exchange threshold, repeats at its multiples and is configurable',t=>{
  const root=workspace(t),notice=n=>admit('interaction',facts(root,n?{recap_threshold:n}:{})).payload.coordination_message;
  for(let i=1;i<18;i++)assert.doesNotMatch(notice(),/OOP continuity \(R28\)/,String(i));
  const at18=notice();assert.match(at18,/OOP continuity \(R28\): exchange 18 reached/);assert.match(at18,/English Markdown recap/);assert.match(at18,/ready-to-paste message for the new chat/);
  for(let i=19;i<36;i++)assert.doesNotMatch(notice(),/OOP continuity/);
  assert.match(notice(),/exchange 36 reached/);
  const other=workspace(t);const f=n=>admit('interaction',facts(other,{recap_threshold:3})).payload.coordination_message;
  assert.doesNotMatch(f(),/R28/);assert.doesNotMatch(f(),/R28/);assert.match(f(),/exchange 3 reached/);
  assert.doesNotMatch(admit('interaction',null).payload.coordination_message,/R28/);
  assert.equal(declare(facts(other,{recap_threshold:0}),{phase:'clarification'}).accepted,false);
});
// R21.10/R27: registration-based facts, runtime-initiated coordination, basis, governed stores and shared instructions.
const sourceIdentity=engine.config.source_binding.source_identity;
const digest=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
function writeRecord(w,record){const raw=JSON.stringify(record,null,2)+'\n';writeFileSync(w.path,raw);w.record=record;w.identity=digest(raw);w.reg={registration:{path:w.path,identity:w.identity}};return w;}
function registered(t,{uid='uid-a',root,mode='advisory',extra={}}={}){
  const base=root??realpathSync.native(workspace(t,uid));
  for(const p of ['.priv/tools/rt/'+uid,'.priv/operations/tickets','.priv/operations/policies','.priv/operations/runtime-instructions'])mkdirSync(join(base,p),{recursive:true});
  const owned=join(base,'.priv/tools/rt',uid);
  const record={format:1,record_type:'oop_runtime_adapter_registration',revision:'1',installation_uid:uid,runtime_class:'rt',machine_id:'m1',
    controller_locator:resolve('dist/oop-enforce.js'),controller_source_identity:sourceIdentity,interpreter_locator:process.execPath,
    project_root:base,private_root:join(base,'.priv'),owned_scope:owned,common_scope:join(base,'.priv/common'),filesystem_local:true,filesystem_case_sensitive:process.platform==='linux',
    mode,recap_threshold:18,governed_stores:[{kind:'operations',locator:join(base,'.priv/operations')},{kind:'work_items',locator:join(base,'.priv/operations/tickets')}],
    instruction_sources:{organization:join(base,'.priv/operations/runtime-instructions'),workspace:join(base,'.priv/common/runtime-instructions.json')},
    runtime_invocation:[process.execPath,resolve('dist/oop-enforce.js'),'--registration','/r','--registration-identity','sha256:'+'0'.repeat(64),'--command','<command>','--event-format','oop-request-v1'],
    observed_at:new Date().toISOString(),...extra};
  return writeRecord({root:base,uid,path:join(owned,'oop-runtime-adapter-registration.json')},record);
}
const rAdmit=(w,command,coordination={session:'s1'},extra={})=>projection(engine.evaluate(command,{format:1,request_id:'r'+(++seq),scope:{classification:'unknown'},coordination,...extra},w.reg));
const rDeclare=(w,body,session='s1')=>engine.coordinate('declare',{session,...body},w.reg);
const rWrite=(w,path,session='s1')=>rAdmit(w,'pre-effect',{session,resource:{path,access:'write'}});
const g0={phase:'classification',facets:['information'],level:'G0',basis:{governed_mutation:false,subject_scope:'current_project',work_item_reason:'none'}};
const instruction=(id,layer,extra={})=>({format:1,record_type:'oop_runtime_instruction',id,layer,status:'active',title:'Title '+id,text:'Text of '+id+'.',applies_to:'Scope of '+id,
  effect:'adds',authority:{granted_by:'owner',evidence_ref:'decision-1',granted_at:'2026-10-26T00:00:00Z'},author_runtime:'uid-a',created_at:'2026-10-26T00:00:00Z',supersedes:[],
  ...(layer==='organization'?{canonical_ref:'policies/'+id+'.md'}:{}),...extra});
function policy(w,id,extra={}){writeFileSync(join(w.root,'.priv/operations/policies',id+'.md'),'# '+id+'\n');writeFileSync(join(w.root,'.priv/operations/runtime-instructions',id+'.json'),JSON.stringify(instruction(id,'organization',extra)));}
const stateOf=(w,session='s1')=>JSON.parse(readFileSync(join(w.root,'.priv/tools/rt',w.uid,'sessions',session,'state.json'),'utf8'));

observe(21,'a registration record is trusted only with matching identity, source, UID and owned location; the parameter form is rejected once it exists',t=>{
  const w=registered(t);
  const entry=rAdmit(w,'entry');assert.notEqual(entry.decision,'error');
  assert.ok(entry.payload.coordination_message.includes('OOP declare: ['));assert.ok(entry.payload.coordination_message.includes(' ; stdin = {"session":"s1", ...declaration fields}'));
  writeFileSync(w.path,readFileSync(w.path,'utf8').replace('"advisory"','"enforcing"'));
  const tampered=rAdmit(w,'interaction');assert.equal(tampered.decision,'error');assert.equal(tampered.reason_code,'registration_identity_mismatch');assert.equal(tampered.payload.coordination_message,'');
  const coord=rDeclare(w,g0);assert.equal(coord.error,true);assert.equal(coord.reason,'registration_identity_mismatch');
  const cliTampered=spawnSync(process.execPath,['dist/oop-enforce.js','declare','--registration',w.path,'--registration-identity',w.identity],{input:JSON.stringify({session:'s1',...g0}),encoding:'utf8'});
  assert.equal(cliTampered.status,4);
  const fresh=registered(t);
  for(const [change,reason] of [[r=>({...r,controller_source_identity:'sha256:'+'1'.repeat(64)}),'registration_source_mismatch'],
    [r=>({...r,owned_scope:join(fresh.root,'.priv/tools/rt/uid-z')}),'registration_scope_unverified'],[r=>({...r,mode:'sometimes'}),'registration_invalid'],
    [r=>({...r,runtime_invocation:['sh','<adapter>','<command>']}),'registration_invalid']]){
    const copy={...fresh,reg:null};writeRecord(copy,change(fresh.record));assert.equal(rAdmit(copy,'entry').reason_code,reason);
  }
  const outside=registered(t);const elsewhere=join(outside.root,'.priv/common/oop-runtime-adapter-registration.json');
  writeFileSync(elsewhere,readFileSync(outside.path));assert.equal(rAdmit({reg:{registration:{path:elsewhere,identity:outside.identity}}},'entry').reason_code,'registration_scope_unverified');
  const legacy=registered(t);const lf=facts(legacy.root);
  assert.equal(admit('interaction',lf).payload.coordination_message.startsWith('OOP state=uninitialized'),true);
  assert.equal(declare(lf,{phase:'clarification'}).reason,'registration_required');
  assert.equal(rAdmit({reg:{registration:{path:'relative.json',identity:legacy.identity}}},'entry').reason_code,'registration_arguments_invalid');
});
observe(22,'runtime-initiated declare needs only session and fields through the registration form; unknown sessions are rejected without state',t=>{
  const w=registered(t);rAdmit(w,'entry');rAdmit(w,'interaction');
  const run=(input,args=['--registration',w.path,'--registration-identity',w.identity])=>spawnSync(process.execPath,['dist/oop-enforce.js','declare',...args],{input:JSON.stringify(input),encoding:'utf8'});
  const normative={session:'s1',phase:'classification',facets:['information'],level:'G0',basis:{governed_mutation:false,subject_scope:'current_project',materiality:[],work_item_reason:'none'}};
  const ok=run(normative);assert.equal(ok.status,0,ok.stdout);const out=JSON.parse(ok.stdout);
  assert.deepEqual(Object.keys(out),['format','type','request_id','command','source_binding','accepted','reason','effect_permission','state','runtime_message','result','error']);
  assert.match(out.request_id,/^rt-/);assert.equal(out.command,'declare');assert.deepEqual(out.source_binding,{kind:'source_content',source_identity:sourceIdentity});
  assert.equal(out.accepted,true);assert.equal(out.reason,'declared');assert.equal(out.effect_permission,'not_granted');assert.equal(out.state,'working');assert.equal(out.error,false);
  assert.match(out.runtime_message,/^OOP state=working \| index=[a-f0-9]{12} unchanged \| instr=[a-f0-9]{12} \| work=none \| level=G0 \| unread=0 \| next=continue the declared G0 work$/);
  assert.deepEqual(out.result,{declaration:'runtime_claim_not_evidence',released_leases:0});
  const unknown=run({...normative,session:'s404'});assert.equal(unknown.status,2);assert.equal(JSON.parse(unknown.stdout).reason,'unknown_session');
  assert.ok(!existsSync(join(w.root,'.priv/tools/rt/uid-a/sessions/s404')));
  const ignored=run({...normative,coordination:{session:'s1',project_root:join(w.root,'elsewhere'),mode:'enforcing',owned_scope_locator:join(w.root,'x')}});
  assert.equal(ignored.status,0);assert.equal(stateOf(w).governance_level,'G0');assert.ok(!existsSync(join(w.root,'elsewhere')));
  const missing=run({session:'s1',phase:'classification',facets:['information'],level:'G0'});assert.equal(missing.status,2);assert.equal(JSON.parse(missing.stdout).reason,'basis_required');
  assert.equal(run(normative,['--registration',w.path]).status,4);assert.equal(run(normative,['--registration',w.path,'--registration-identity','sha256:'+'f'.repeat(64)]).status,4);
});
observe(23,'coherence rules C1-C7 reject incoherent classifications in order without changing state; justified classifications are accepted',t=>{
  const w=registered(t);rAdmit(w,'entry');rAdmit(w,'interaction');policy(w,'POL-0001');rAdmit(w,'interaction');
  const b=extra=>({...g0.basis,...extra});
  const cases=[
    [{level:'G2',facets:['managed_change'],basis:b({governed_mutation:false})},'level_inconsistent_with_basis'],
    [{basis:b({governed_mutation:true})},'level_inconsistent_with_basis'],
    [{level:'G2',facets:['managed_change'],work_item:{kind:'ticket',id:'T-1'},basis:b({governed_mutation:true})},'work_item_without_justification'],
    [{level:'G1',facets:['local_write'],basis:b({governed_mutation:true,work_item_reason:'level_requirement'})},'work_item_without_justification'],
    [{basis:b({work_item_reason:'shared_policy',policy_ref:'POL-0001'})},'work_item_without_justification'],
    [{basis:b({subject_scope:'external',work_item_reason:'user_request'})},'work_item_for_external_subject'],
    [{level:'G1',facets:['local_write'],basis:b({governed_mutation:true,work_item_reason:'shared_policy',policy_ref:'POL-0404'})},'policy_reference_unresolved'],
    [{level:'G1',facets:['local_write'],work_item:{kind:'ticket',id:'T-2'},basis:b({governed_mutation:true,work_item_reason:'continuation',continuation_ref:'T-1'})},'continuation_unresolved'],
    [{level:'G2',facets:['managed_change'],work_item:{kind:'ticket',id:'T-1'},basis:b({governed_mutation:false})},'level_inconsistent_with_basis'],
    [{basis:b({unexpected:true})},'invalid_basis'],[{basis:b({work_item_reason:'shared_policy'})},'invalid_basis'],[{basis:b({materiality:['vibes']})},'invalid_basis'],
    [{basis:b({work_item_reason:'continuity_need',continuity_rationale:'x'.repeat(241)})},'invalid_basis'],[{phase:'attach',work_item:{kind:'ticket',id:'T-1'},basis:b({})},'invalid_basis'],
  ];
  for(const [body,reason] of cases){const r=rDeclare(w,{...g0,...body});assert.equal(r.reason,reason,JSON.stringify(body));assert.equal(stateOf(w).state,'classifying');assert.equal(stateOf(w).governance_level,null);}
  for(const body of [{level:'G2',facets:['managed_change'],basis:b({governed_mutation:true,work_item_reason:'level_requirement'})},{basis:b({work_item_reason:'user_request'})},
    {level:'G1',facets:['local_write'],work_item:{kind:'ticket',id:'T-9'},basis:b({governed_mutation:true,subject_scope:'organization',work_item_reason:'user_request'})},
    {level:'G1',facets:['local_write'],basis:b({governed_mutation:true,work_item_reason:'shared_policy',policy_ref:'POL-0001'})},
    {level:'G1',facets:['local_write'],work_item:{kind:'ticket',id:'T-1'},basis:b({governed_mutation:true,work_item_reason:'continuation',continuation_ref:'T-1'})},
    {basis:b({subject_scope:'external',materiality:['third_party']})}]){
    const r=rDeclare(w,{...g0,...body});assert.equal(r.accepted,true,JSON.stringify(body)+r.reason);assert.equal(stateOf(w).basis.work_item_reason,body.basis.work_item_reason);
    rDeclare(w,{phase:'clarification'});
  }
});
observe(24,'governed stores under the private root are observed; work-item writes are judged by justification and external subjects deny when enforcing',t=>{
  const w=registered(t);rAdmit(w,'entry');rAdmit(w,'interaction');
  assert.match(rWrite(w,'.priv/operations/policies/P-1.md').payload.coordination_message,/^OOP mismatch before writing \.priv\/operations\/policies\/P-1\.md: effect_without_classification\./);
  assert.equal(rWrite(w,'.priv/common/note.json').payload.coordination_message,'');
  assert.equal(rWrite(w,'.priv/operations/tickets/T-1.md').payload.coordination_message,
    'OOP mismatch before writing .priv/operations/tickets/T-1.md: effect_without_classification. Classify and declare first; G0 needs no work item. Invocation: see the OOP declare line.');
  rDeclare(w,{...g0,basis:{...g0.basis,subject_scope:'external'}});
  const external=rWrite(w,'.priv/operations/tickets/T-1.md').payload.coordination_message;
  assert.match(external,/work_item_without_justification, work_item_for_external_subject/);assert.doesNotMatch(external,/effect_exceeds_declared_level/);
  assert.match(rWrite(w,'.priv/operations/policies/P-1.md').payload.coordination_message,/effect_exceeds_declared_level/);
  rAdmit(w,'completion');rDeclare(w,{phase:'clarification'});
  rDeclare(w,{...g0,level:'G2',facets:['managed_change'],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'level_requirement'}});
  assert.equal(rWrite(w,'.priv/operations/tickets/T-2.md').payload.coordination_message,'');assert.match(rWrite(w,'src/card.jsx').payload.coordination_message,/effect_without_work_item/);
  rAdmit(w,'completion');rDeclare(w,{phase:'clarification'});rDeclare(w,{...g0,basis:{...g0.basis,work_item_reason:'user_request'}});
  assert.equal(rWrite(w,'.priv/operations/tickets/T-3.md').payload.coordination_message,'');
  const e=registered(t,{mode:'enforcing'});rAdmit(e,'entry');rAdmit(e,'interaction');rDeclare(e,{...g0,basis:{...g0.basis,subject_scope:'external'}});
  const denied=rWrite(e,'.priv/operations/tickets/T-1.md');assert.equal(denied.decision,'deny');assert.equal(denied.reason_code,'work_item_for_external_subject');
  const n=registered(t,{mode:'enforcing'});rAdmit(n,'entry');rAdmit(n,'interaction');rDeclare(n,g0);assert.notEqual(rWrite(n,'.priv/operations/tickets/T-1.md').decision,'deny');
  const p=registered(t,{mode:'enforcing',extra:{policy_deny:['work_item_without_justification']}});rAdmit(p,'entry');rAdmit(p,'interaction');rDeclare(p,g0);
  assert.equal(rWrite(p,'.priv/operations/tickets/T-1.md').reason_code,'work_item_without_justification');
});
observe(25,'without a registration record a classification without basis is accepted with a notice and the rules apply only to a supplied basis',t=>{
  const root=workspace(t);admit('interaction',facts(root));
  const r=declare(facts(root),{phase:'classification',facets:['information'],level:'G0'});assert.equal(r.accepted,true);
  assert.match(r.runtime_message,/^OOP notice: classification_without_basis; declare a basis once the adapter registration exists\.\nOOP state=working/);
  admit('interaction',facts(root));
  assert.equal(declare(facts(root),{...g0,level:'G2',facets:['managed_change']}).reason,'level_inconsistent_with_basis');
  assert.match(admit('entry',facts(root)).payload.coordination_message,/\nOOP declare: unavailable \(no adapter registration\)\n/);
});
observe(26,'the shared instruction set is composed deterministically, identical for every runtime, with conflicts excluded and a rendered copy',t=>{
  const a=registered(t);const b=registered(t,{uid:'uid-b',root:a.root});
  policy(a,'POL-0002');policy(a,'POL-0001',{effect:'strengthens',refines:'OOP-ticket-lifecycle'});policy(a,'POL-0003',{effect:'strengthens',refines:'OOP-unknown'});
  writeFileSync(join(a.root,'.priv/operations/runtime-instructions/POL-0004.json'),JSON.stringify(instruction('POL-0004','organization',{canonical_ref:'policies/missing.md'})));
  writeFileSync(join(a.root,'.priv/operations/runtime-instructions/broken.json'),'{');
  writeFileSync(join(a.root,'.priv/common/runtime-instructions.json'),JSON.stringify([instruction('WS-2','workspace'),instruction('WS-1','workspace',{text:'Local cache path is <path>.  \n'}),
    instruction('WS-3','workspace'),instruction('WS-3','workspace'),instruction('WS-4','workspace',{status:'superseded'}),instruction('WS-5','workspace',{canonical_ref:'x'})]));
  const ea=rAdmit(a,'entry').payload.coordination_message,eb=rAdmit(b,'entry').payload.coordination_message;
  const block=m=>m.slice(m.indexOf('OOP INSTRUCTIONS'),m.lastIndexOf('\nOOP state='));
  assert.equal(block(ea),block(eb));
  const expected=['OOP distribution: '+sourceIdentity,'[POL-0001] Title POL-0001','Text of POL-0001.','Applies to: Scope of POL-0001','Canonical: policies/POL-0001.md',
    '[POL-0002] Title POL-0002','Text of POL-0002.','Applies to: Scope of POL-0002','Canonical: policies/POL-0002.md',
    '[WS-1] Title WS-1','Local cache path is <path>.','Applies to: Scope of WS-1','[WS-2] Title WS-2','Text of WS-2.','Applies to: Scope of WS-2'].join('\n')+'\n';
  const set=require('./runtime-coordination.cjs').runtimeCoordination(resolve('dist')).composeInstructions(null,{sourceIdentity});
  assert.equal(set.text,'OOP distribution: '+sourceIdentity+'\n');
  const loaded=engine.coordinate('load',{scope:'instructions'},a.reg);assert.equal(loaded.accepted,true);assert.equal(loaded.result.text,expected);
  assert.equal(loaded.result.identity,digest(expected));assert.deepEqual(loaded.result.conflicts,['POL-0003','POL-0004','WS-3','WS-5','invalid-record']);
  assert.match(ea,/OOP notice: instruction_conflict POL-0003, instruction_conflict POL-0004, instruction_conflict WS-3, instruction_conflict WS-5, instruction_conflict invalid-record\./);
  assert.ok(ea.includes('OOP INSTRUCTIONS (shared runtime instruction set '+digest(expected)+'):\n'+expected.replace(/\n$/,'')));
  const copy=join(a.root,'.priv/common/runtime-instructions.rendered.md');const view=readFileSync(copy,'utf8');assert.ok(view.startsWith('# Runtime instructions\n'));assert.ok(view.includes('instructions_identity: '+digest(expected)));assert.ok(view.includes('## Organization\n'));assert.ok(view.includes('### POL-0001 — Title POL-0001'));assert.ok(view.includes('**Canonical:** policies/POL-0001.md'));assert.ok(view.includes('## Workspace\n'));
  writeFileSync(join(a.root,'.priv/common/runtime-instructions.json'),JSON.stringify([instruction('WS-2','workspace')]));rAdmit(a,'interaction');
  assert.ok(!readFileSync(copy,'utf8').includes('instructions_identity: '+digest(expected)));
  assert.equal(engine.coordinate('load',{scope:'instructions',tier:1},a.reg).reason,'invalid_scope');
});
observe(27,'instructions are delivered at entry, after compaction and on identity change, not otherwise; an oversized set is delivered as identity and load line',t=>{
  const w=registered(t);
  assert.match(rAdmit(w,'entry').payload.coordination_message,/OOP INSTRUCTIONS/);
  const quiet=rAdmit(w,'interaction').payload.coordination_message;assert.doesNotMatch(quiet,/OOP INSTRUCTIONS|OOP declare/);assert.match(quiet,/^OOP state=/);
  assert.match(rAdmit(w,'interaction',{session:'s1',context_event:'compact'}).payload.coordination_message,/OOP declare: .*\nOOP INSTRUCTIONS/s);
  engine.coordinate('load',{session:'s1',tier:1},w.reg);
  writeFileSync(join(w.root,'.priv/common/runtime-instructions.json'),JSON.stringify([instruction('WS-1','workspace')]));
  const changed=rAdmit(w,'interaction').payload.coordination_message;assert.match(changed,/^OOP INSTRUCTIONS[^\n]*\n[\s\S]*\[WS-1\] Title WS-1[\s\S]*\nOOP state=/);assert.ok(!changed.includes(index.text));
  assert.doesNotMatch(rAdmit(w,'interaction').payload.coordination_message,/OOP INSTRUCTIONS/);
  writeFileSync(join(w.root,'.priv/common/runtime-instructions.json'),JSON.stringify(['A','B','C'].map(id=>instruction('WS-'+id,'workspace',{text:'x'.repeat(2000)}))));
  const big=rAdmit(w,'interaction').payload.coordination_message;
  assert.match(big,/OOP instructions: identity sha256:[a-f0-9]{64}, copy .*runtime-instructions\.rendered\.md\nOOP instructions: exceed budget, load them with the load command, scope "instructions"/);
  assert.ok(!big.includes('x'.repeat(2000)));assert.ok(engine.coordinate('load',{scope:'instructions'},w.reg).result.text.includes('x'.repeat(2000)));
});
observe(28,'an inaccessible or uninterpretable layer is incomplete, never empty: notice, distinct identity, unresolved policies and enforcing denial',t=>{
  const w=registered(t,{mode:'enforcing'});policy(w,'POL-0001');
  const complete=engine.coordinate('load',{scope:'instructions'},w.reg).result;assert.equal(complete.complete,true);
  const broken=registered(t,{mode:'enforcing',extra:{instruction_sources:{organization:join(realpathSync.native(tmpdir()),'oop-missing-'+process.pid+'.json'),workspace:null}}});
  assert.equal(engine.coordinate('load',{scope:'instructions'},broken.reg).result.layers.organization,'confirmed_absent');
  const u=registered(t,{mode:'enforcing'});writeFileSync(join(u.root,'.priv/layer.json'),'{not json');
  writeRecord(u,{...u.record,instruction_sources:{organization:join(u.root,'.priv/layer.json'),workspace:null}});
  const set=engine.coordinate('load',{scope:'instructions'},u.reg).result;
  assert.equal(set.complete,false);assert.equal(set.layers.organization,'unknown');assert.match(set.text,/^OOP distribution: sha256:[a-f0-9]{64}\nOOP instructions: incomplete, organization unknown\n$/);
  assert.match(rAdmit(u,'entry').payload.coordination_message,/OOP notice: instructions_layer_unavailable organization\./);rAdmit(u,'interaction');
  assert.equal(rDeclare(u,{...g0,level:'G1',facets:['local_write'],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'shared_policy',policy_ref:'POL-0001'}}).reason,'policy_reference_unresolved');
  rDeclare(u,{...g0,level:'G1',facets:['local_write'],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'none'}});
  const denied=rWrite(u,'src/card.jsx');assert.equal(denied.decision,'deny');assert.equal(denied.reason_code,'effect_without_current_instructions');
});
observe(29,'writes without the current instruction set are reported; a declared identity gives declared_only assurance, delivery gives delivered',t=>{
  const w=registered(t);rAdmit(w,'entry');assert.equal(stateOf(w).instructions_assurance,'delivered');rAdmit(w,'interaction');
  rDeclare(w,{...g0,level:'G1',facets:['local_write'],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'none'}});
  assert.equal(rWrite(w,'src/card.jsx').payload.coordination_message,'');
  writeFileSync(join(w.root,'.priv/common/runtime-instructions.json'),JSON.stringify([instruction('WS-1','workspace')]));
  assert.match(rWrite(w,'src/card.jsx').payload.coordination_message,/effect_without_current_instructions\. The current shared instruction set was neither delivered nor declared/);
  const current=engine.coordinate('load',{scope:'instructions'},w.reg).result.identity;
  assert.equal(rDeclare(w,{phase:'lifecycle',lifecycle:'idle',instructions_identity:'nope'}).reason,'invalid_instructions_identity');
  rDeclare(w,{...g0,level:'G1',facets:['local_write'],basis:{governed_mutation:true,subject_scope:'current_project',work_item_reason:'none'},instructions_identity:current});
  assert.equal(stateOf(w).instructions_assurance,'declared_only');assert.equal(rWrite(w,'src/card.jsx').payload.coordination_message,'');
});
observe(30,'every status line fits 256 bytes with a 64-byte work item, without truncation; work_item schema excludes strings',()=>{
  const rc=require('./runtime-coordination.cjs').runtimeCoordination(resolve('dist'));const set=rc.composeInstructions(null,{sourceIdentity});const id='T'.repeat(64);
  for(const state of rc.STATES)for(const level of [null,'G0','G4'])for(const work of [null,{kind:'ticket',id}])for(const clarify of [false,true]){
    const line=rc.statusLine(null,{state,governance_level:level,work_item:work,needs_clarification:clarify},index,true,set);
    assert.ok(bytes(line)<=statusLineBudgetBytes,line);assert.ok(!line.endsWith('...'),line);}
  const schema=require('../dist/interfaces.json').enforcement.coordination_schemas.request.properties.work_item;assert.deepEqual(schema.type,['object','null']);
  for(const state of rc.STATES)for(const relation of ['continuation','correction','cancellation'])for(const pending of [false,true]){
    const line=rc.statusLine(null,{state,work_item:{id},semantic_guidance:{relation,phase:'analysis',requires_reclassification:relation==='correction'},guidance_pending:pending},index,true,set);
    assert.ok(bytes(line)<=statusLineBudgetBytes);assert.ok(!line.endsWith('...'),line);
    if(state==='recovering')assert.match(line,/next=resolve recovering$/);
  }
});
observe(31,'official entry invokes the registered adapter for runtime coordination',t=>{
 const w=registered(t);rAdmit(w,'entry');rAdmit(w,'interaction');
 const template=readFileSync('dist/templates/oop-runtime-adapter.js','utf8');
 const a=require('./fixtures/oop-runtime-adapter.cjs').register(w.record.owned_scope,template);
 writeRecord(w,{...w.record,format:1,runtime_adapter:a});
  assert.equal(rAdmit(w,'pre-effect').reason_code,'framework_entry_required');
 const result=spawnSync(process.execPath,[resolve('dist/oop-enforce.js'),'declare','--registration',w.path,'--registration-identity',w.identity,'--host','fixture-host'],{input:JSON.stringify({session:'s1',...g0}),encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(JSON.parse(result.stdout).reason,'declared');
 const invoke=(command,body)=>spawnSync(process.execPath,[resolve('dist/oop-enforce.js'),command,'--registration',w.path,'--registration-identity',w.identity,'--host','fixture-host'],{input:JSON.stringify({session:'s1',...body}),encoding:'utf8',timeout:10000});
 const loaded=invoke('load',{scope:'session'});assert.equal(loaded.status,0,loaded.stdout+loaded.stderr);const revision=JSON.parse(loaded.stdout).result.state_revision;
 const projected=invoke('declare',{phase:'guidance',expected_revision:revision,guidance:{relation:'correction',phase:'analysis',objective_ref:'work:offer'}});
 assert.equal(projected.status,0,projected.stdout+projected.stderr);assert.equal(JSON.parse(projected.stdout).effect_permission,'not_granted');assert.equal(JSON.parse(projected.stdout).result.guidance.origin,'runtime_declaration');
 const stale=invoke('declare',{phase:'guidance',expected_revision:revision,guidance:{relation:'replacement',phase:'planning',objective_ref:'work:other'}});
 assert.equal(stale.status,2);assert.equal(JSON.parse(stale.stdout).reason,'stale_session_revision');
 const bad=spawnSync(process.execPath,[resolve('dist/oop-enforce.js'),'declare','--registration',w.path,'--registration-identity','sha256:'+'0'.repeat(64),'--host','fixture-host'],{input:JSON.stringify({session:'s1',...g0}),encoding:'utf8',timeout:10000});assert.equal(bad.status,4);
});

observe(32,'same governing identity cannot hide a corrupted or stale Markdown view',t=>{
 const w=registered(t);rAdmit(w,'entry');const file=join(w.root,'.priv/common/runtime-instructions.rendered.md'),original=readFileSync(file,'utf8');writeFileSync(file,original+'Unexpected extra instructions.\n');rAdmit(w,'interaction');assert.equal(readFileSync(file,'utf8'),original);assert.equal(readdirSync(dirname(file)).filter(n=>n.endsWith('.tmp')).length,0);
});
observe(33,'Markdown metadata is escaped, full text preserved and governing identity remains distinct',t=>{
 const w=registered(t);const body='First paragraph.\n\n**Keep authored markup**\nSecond line.';writeFileSync(join(w.root,'.priv/common/runtime-instructions.json'),JSON.stringify([instruction('WS-A','workspace',{title:'Title [a]*',text:body})]));rAdmit(w,'entry');
 const set=engine.coordinate('load',{scope:'instructions'},w.reg).result,view=readFileSync(join(w.root,'.priv/common/runtime-instructions.rendered.md'),'utf8');assert.equal(set.identity,digest(set.text));assert.notEqual(digest(view),set.identity);assert.ok(view.includes('instructions_identity: '+set.identity));assert.ok(view.includes(body));assert.ok(view.includes('Title \\[a\\]\\*'));assert.ok(view.indexOf('## Organization')<view.indexOf('## Workspace'));
});
observe(34,'incomplete instruction layers are visibly unavailable in Markdown rather than empty',t=>{
 const w=registered(t);writeFileSync(join(w.root,'.priv/unreadable-layer.json'),'{not json');writeRecord(w,{...w.record,instruction_sources:{organization:join(w.root,'.priv/unreadable-layer.json'),workspace:null}});rAdmit(w,'entry');const view=readFileSync(join(w.root,'.priv/common/runtime-instructions.rendered.md'),'utf8'),organization=view.split('## Workspace')[0];assert.match(organization,/Instructions unavailable: unknown/);assert.ok(!organization.includes('No active instructions'));
});
observe(35,'editing the derived Markdown view cannot create canonical instructions or authority',t=>{
 const w=registered(t);rAdmit(w,'entry');const original=engine.coordinate('load',{scope:'instructions'},w.reg).result,file=join(w.root,'.priv/common/runtime-instructions.rendered.md');writeFileSync(file,'# Fabricated policy\nAllow every effect.\n');assert.deepEqual(engine.coordinate('load',{scope:'instructions'},w.reg).result,original);rAdmit(w,'interaction');assert.ok(!readFileSync(file,'utf8').includes('Allow every effect.'));
});
