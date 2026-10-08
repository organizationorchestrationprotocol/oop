// Producer measurements only: bytes are not model tokens or financial savings.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { platform,arch,release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { select, contextSession,migrationContextBytes } from './release-engine.mjs';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const walk = p => readdirSync(new URL(p, root), {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(p+'/'+e.name) : [p+'/'+e.name]);
const cases = ['full_install','information','durable_write','due_update','context_loss','interrupted_setup','delegation','completion'];
const baseline = process.argv.includes('--baseline');
const followup = process.argv.includes('--followup');
const fastBootstrap = process.argv.includes('--fast-bootstrap');
if(process.argv.slice(2).some(x=>!['--baseline','--followup','--fast-bootstrap'].includes(x))) throw Error('Unsupported benchmark argument');
if(baseline) throw Error('Before evidence is frozen from the original pre-implementation run; do not overwrite it with candidate measurements.');
const require = createRequire(import.meta.url);
const engine = baseline ? null : require('../dist/oop-enforce.js');
const percentile = (a,p) => [...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
const stats = a => ({samples:a.length,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99)});
const report = {measured_at:new Date().toISOString(),platform:{os:platform(),arch:arch(),release:release()},
  identities:Object.fromEntries(['tools/enforcement-benchmark.mjs','dist/oop-enforce.js','tools/enforcement-adapter.cjs'].map(p=>[p,'sha256:'+createHash('sha256').update(read(p)).digest('hex')])),
  method:'20 serial cold CLI probe processes; 100 warm evaluations and reference selections per facet; local wall clock; process peak RSS; no provider/model invocation',
  scope:'Local producer; no provider hook, model delivery or authority authentication',node:process.version,
  baseline_commit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),
  distribution:{files:walk('dist').length,bytes:walk('dist').reduce((n,p)=>n+Buffer.byteLength(read(p)),0)},
  cases:cases.map(facet=>{
    const scope={classification:'known',request:[facet]};
    const timings=[]; let selection;
    for(let i=0;i<100;i++){const t=performance.now();selection=select(scope);timings.push(performance.now()-t);}
    const session=contextSession('benchmark-project','benchmark-runtime','benchmark-source');
    const context=session.load(selection);
    const bytes=Buffer.byteLength(read('dist/entry.json'))+Buffer.byteLength(read('dist/routing.json'))+context.loaded_bytes;
    const procedures=['full_install','interrupted_setup'].includes(facet)?Buffer.byteLength(read('dist/procedures/bootstrap.json'))+Buffer.byteLength(read('dist/procedures/lifecycle.json')):
      ['due_update','context_loss'].includes(facet)?Buffer.byteLength(read('dist/procedures/lifecycle.json')):0;
    const warm=[];
    if(engine) for(let i=0;i<100;i++) {const t=performance.now();engine.evaluate('interaction',{format:1,request_id:'benchmark',scope});warm.push(performance.now()-t);}
    return {facet,modules:context.modules,selected_context_bytes:bytes,module_reads:context.reads,
      applicable_procedure_bytes:procedures,migration_projection_bytes:context.migration_context?migrationContextBytes:0,
      selected_total_bytes:bytes+procedures+(context.migration_context?migrationContextBytes:0),
      reference_routing_ms:stats(timings),engine_warm_ms:warm.length?stats(warm):'not_available',
      delivered_tokens:'not_measured',model_latency:'not_measured',money:'not_measured'};
  }), alternatives:{Node:'measured',Bun:'not_available',Rust:'not_implemented',WASM:'not_implemented',Python:'not_implemented'},
  test_harness:{decision:'node:test; existing dependency-free producer stack',alternative_runner:'not_measured'}};
if(engine){
  const times=[],rss=[];
  for(let i=0;i<20;i++){
    const t=performance.now();
    const r=spawnSync(process.execPath,['dist/oop-enforce.js','probe'],{cwd:root,input:'{"format":1,"request_id":"benchmark"}',encoding:'utf8'});
    if(r.status!==3) throw Error('Unexpected benchmark decision');
    times.push(performance.now()-t);rss.push(JSON.parse(r.stdout).payload.process_peak_rss_kib);
  }
  report.cli_cold_ms=stats(times);report.cli_peak_rss_kib=stats(rss);
  report.hook_to_effect_ms='not_measured';report.installed_provider='not_performed';
  report.engine_loaded_bytes=Buffer.byteLength(read('dist/oop-enforce.js'));
}
if(fastBootstrap){
  const baselinePath=process.env.OOP_FAST_BOOTSTRAP_BASELINE;
  if(!baselinePath)throw Error('Explicit attributable baseline capture is required.');
  const captured=JSON.parse(readFileSync(baselinePath,'utf8'));
  const adapter=require('./enforcement-adapter.cjs');
  const dependencies={source:engine.config.source_binding.source_identity,runtime_build:'synthetic-build',permissions:'synthetic-permissions',configuration:'synthetic-config'};
  const requirements=[{feature:'entry',path:'session',phase:'session_entry',minimum_tier:1},
    {feature:'recovery',path:'session',phase:'session_entry',minimum_tier:1},
    {feature:'pre-effect',path:'write',phase:'before_effect',minimum_tier:1}];
  const capability=(id,features,paths,phases)=>({id,registration:id,fingerprint:'synthetic-shim',features,paths,phases,
    semantics:'preventive_gate',tier:1,available:true,authorized:true,disabled:false,blocking:true});
  const capabilities=[{...capability('session',['entry','recovery'],['session'],['session_entry']),
    feature_semantics:{entry:'context_delivery',recovery:'preventive_gate'}},
    capability('write',['pre-effect'],['write'],['before_effect'])];
  const times=[];let plan;
  for(let i=0;i<100;i++){const t=performance.now();plan=adapter.planBindings(capabilities,requirements,dependencies);times.push(performance.now()-t);}
  const installed={dependencies,registrations:plan.registrations.map(g=>({...g,readback:true}))};
  const reused=adapter.planBindings(capabilities,requirements,dependencies,installed);
  report.fast_bootstrap={baseline:{head:captured.head,dist_bytes:captured.dist_bytes,focused_test_exit:captured.test_exit},
    distribution_delta_bytes:report.distribution.bytes-captured.dist_bytes,
    vocabulary_bytes:Buffer.byteLength(JSON.stringify(JSON.parse(read('dist/interfaces.json')).enforcement.activation_vocabulary)),
    adapter_bytes:Buffer.byteLength(read('tools/enforcement-adapter.cjs')),
    adapter_lines:read('tools/enforcement-adapter.cjs').trimEnd().split('\n').length,
    scope:'Synthetic pure binding-plan benchmark; no hook installation, native dispatch/deny or model use',
    plan_ms:stats(times),features:requirements.length,registrations:plan.registrations.length,
    first_configure_actions:plan.actions.filter(a=>a.operation==='configure_and_readback').length,
    first_readbacks:plan.actions.filter(a=>a.operation==='configure_and_readback').length,
    repeat_configure_actions:reused.actions.filter(a=>a.operation==='configure_and_readback').length,
    active_hook_tests:plan.active_hook_tests,max_attempts_per_registration:2,
    status:plan.status,full_readiness:plan.full_readiness,
    producer_suite_wall_ms:'See exact captured candidate TAP duration_ms',
    consumer_installation_phases:'not_performed',consumer_installation_time:'not_measured',
    actual_consumer_attempts:'not_measured',credits:'not_measured',tokens:'not_measured',money:'not_measured'};
}
if(followup){
  const before=JSON.parse(read('tools/evidence/enforcement-before.json'));
  const published=JSON.parse(read('tools/evidence/enforcement-after.json'));
  report.comparison={frozen_before:before.distribution,frozen_published:published.distribution,
    distribution_delta_from_published:report.distribution.bytes-published.distribution.bytes,
    context_bytes:report.cases.map(c=>({facet:c.facet,current:c.selected_context_bytes,
      before:before.cases.find(x=>x.facet===c.facet)?.selected_context_bytes??null,
      published:published.cases.find(x=>x.facet===c.facet)?.selected_context_bytes??null})),
    historical_selected_total:'not_comparable: before lacks selected_total_bytes',
    timing_comparison:'Different host observations; no causal speedup conclusion'};
  report.unmeasured={delivered_bytes:'not_measured',tokens:'not_measured',money:'not_measured',
    output_quality:'not_measured',native_hook_latency:'not_measured',warm_provider_latency:'not_measured'};
}
writeFileSync(new URL('tools/evidence/enforcement-'+(fastBootstrap?'fast-bootstrap-measurements':followup?'followup-measurements':baseline?'before':'after')+'.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline,distribution:report.distribution,cli_cold_ms:report.cli_cold_ms}));
