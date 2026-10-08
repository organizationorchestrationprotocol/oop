// Producer measurements of the current package only: bytes are not model tokens or financial savings.
// Output is untracked candidate evidence (tools/evidence/current-enforcement-measurements.json).
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
if(process.argv.length>2) throw Error('Unsupported benchmark argument');
const require = createRequire(import.meta.url);
const engine = require('../dist/oop-enforce.js');
const percentile = (a,p) => [...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
const stats = a => ({samples:a.length,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99)});
const report = {measured_at:new Date().toISOString(),platform:{os:platform(),arch:arch(),release:release()},
  identities:Object.fromEntries(['tools/enforcement-benchmark.mjs','dist/oop-enforce.js','tools/enforcement-adapter.cjs'].map(p=>[p,'sha256:'+createHash('sha256').update(read(p)).digest('hex')])),
  method:'20 serial cold CLI probe processes; 100 warm evaluations and reference selections per facet; local wall clock; process peak RSS; no provider/model invocation',
  scope:'Local producer; no provider hook, model delivery or authority authentication',node:process.version,
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
    for(let i=0;i<100;i++) {const t=performance.now();engine.evaluate('interaction',{format:1,request_id:'benchmark',scope});warm.push(performance.now()-t);}
    return {facet,modules:context.modules,selected_context_bytes:bytes,module_reads:context.reads,
      applicable_procedure_bytes:procedures,migration_projection_bytes:context.migration_context?migrationContextBytes:0,
      selected_total_bytes:bytes+procedures+(context.migration_context?migrationContextBytes:0),
      reference_routing_ms:stats(timings),engine_warm_ms:stats(warm),
      delivered_tokens:'not_measured',model_latency:'not_measured',money:'not_measured'};
  })};
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
writeFileSync(new URL('tools/evidence/current-enforcement-measurements.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({distribution:report.distribution,cli_cold_ms:report.cli_cold_ms}));
