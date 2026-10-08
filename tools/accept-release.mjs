// Producer acceptance only. Never a consumer command or publication authorization.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { contextSession,select,migrationContextBytes } from './release-engine.mjs';
import { subjects as subjectPaths, identify as identifyInputs, testFiles, expectedObservations, protocolSource, completeProducerObservations } from './acceptance-inputs.mjs';
import { modules, spans } from './release-plan.mjs';
import { currentCommit, committedInputs, reviewedAllocation, stableContractIDs } from './genesis.mjs';
import { verifyPackageBaseline, measurementMethod, effectiveScope, compareEfficiency } from './efficiency-regression.mjs';
import { writeEvidence } from './prune-artifacts.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const json=path=>JSON.parse(text(path));
const git=args=>spawnSync('git',['--no-replace-objects','--no-optional-locks',...args],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const args=process.argv.slice(2);
if(args.length>1 || args.some(arg=>!['--candidate','--snapshot','--check-current'].includes(arg))) throw new Error('Use --candidate, --snapshot, --check-current or no arguments');
const snapshot=args.includes('--snapshot'), candidate=args.includes('--candidate') || snapshot;
const subjects=()=>subjectPaths(root), identify=paths=>identifyInputs(root,paths);
function checkout(){
  const graph=currentCommit(git),status=git(['status','--porcelain','--untracked-files=all']);
  const ref=git(['symbolic-ref','--quiet','--short','HEAD']);
  if(status.status!==0)throw new Error('Cannot identify checkout');
  return {...graph,ref:ref.status===0?ref.stdout.trim():'detached',working_tree:status.stdout.trim()?'modified':'clean',changes:status.stdout.trimEnd().split('\n').filter(Boolean)};
}
const evaluatedCheckout=checkout();
const readObject=(commit,path)=>{const r=git(['show',commit+':'+path]);if(r.status!==0)throw new Error('Missing committed object: '+path);return r.stdout;};
if(args.includes('--check-current')){
  const report=json('tools/evidence/current-acceptance.json');
  if(report.evaluated_checkout?.commit!==evaluatedCheckout.commit || report.release_ready!==true ||
     JSON.stringify(report.identities)!==JSON.stringify(identify(subjects())))throw new Error('Current acceptance is stale or failed');
  process.stdout.write('Current acceptance matches HEAD '+evaluatedCheckout.commit+' and all subject files.\n');process.exit(0);
}
const source=protocolSource(text('PROTOCOL.md')),trace=json('tools/evidence/release-traceability.json');
const frozenIdentities=identify(subjects());
const allocationReady=reviewedAllocation({source,review:json('tools/release-review.json'),modules,spans});
const sourceBindingReady=trace.source_identity===hash(source) && trace.source_binding?.kind==='source_content' &&
  trace.source_binding.source_identity===hash(source) && json('dist/entry.json').source_binding?.source_identity===hash(source) &&
  json('dist/entry.json').source_binding?.kind==='source_content' && json('dist/entry.json').status==='prepared_distribution' &&
  json('dist/entry.json').source_snapshot?.content_identity===hash(source) && json('dist/routing.json').producer_binding?.source_identity===hash(source);
// Independent portable content evidence is optional; no ancestor lookup or root exemption.
// Trust/selection anchors are separately supplied by the maintainer, never by bundle assertions.
const bundlePath=process.env.OOP_BASELINE_BUNDLE;
const bundle=bundlePath?JSON.parse(readFileSync(bundlePath,'utf8')):null;
const packageBaseline=bundle?{path:'tools/evidence/release-acceptance.json',report:bundle.report,identity:hash(bundle.contents['tools/evidence/release-acceptance.json']??'')}:null;
const efficiencyBaseline=verifyPackageBaseline(packageBaseline,{
  readContent:path=>bundle?.contents[path],
  trustedIdentity:process.env.OOP_BASELINE_TRUST_IDENTITY,
  selectionEvidence:process.env.OOP_BASELINE_SELECTION_EVIDENCE,
});
const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...testFiles],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const observations=[...run.stdout.matchAll(/^(ok|not ok) \d+ - ((?:REL-OBS|REL-PKG|REL-TOOL|REL-ORG|REL-ROUTE|REL-GEN|REL-MIG|REL-ENTRY|REL-ENF)-\d+): (.+?)(?: # (SKIP|TODO)(.*))?$/gm)].map(m=>({
  id:m[2],checked:m[3],expected:'isolated local assertion passes, including applicable negative controls',actual:m[4]?'skipped':m[1]==='ok'?'passed':'failed',...(m[4]?{skip_reason:m[5].trim()}:{}),
  tier:m[2].startsWith('REL-ENTRY')?'remote_entry_contract_and_supplied_observations':m[2].startsWith('REL-MIG')?'synthetic_migration_state_and_disposable_history':m[2].startsWith('REL-GEN')?'current_content_and_path_safety':m[2].startsWith('REL-ROUTE')?'current_routing_and_allocation':m[2].startsWith('REL-ORG')?'synthetic_organizational_scenario_and_real_package_context':m[2].startsWith('REL-PKG')?'real_package_local_read_and_supplied_fact_model':'isolated_producer_mechanism',
}));
const ids=observations.map(o=>o.id);
const observationSummary={total:ids.length,unique:new Set(ids).size,passed:observations.filter(o=>o.actual==='passed').length,
  failed:observations.filter(o=>o.actual==='failed').length,skipped:observations.filter(o=>o.actual==='skipped').length,
  missing:expectedObservations.filter(id=>!ids.includes(id)),unexpected:ids.filter(id=>!expectedObservations.includes(id))};
const testPassed=completeProducerObservations(run,observations);
const maintainerRun=spawnSync(process.execPath,['--test','--test-reporter=tap','tools/maintainer-workflow.test.mjs','tools/validate-maintainer-report.test.mjs'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const maintainerPassed=maintainerRun.status===0 && /^# tests [1-9]\d*$/m.test(maintainerRun.stdout) && /^# fail 0$/m.test(maintainerRun.stdout) && /^# skipped 0$/m.test(maintainerRun.stdout);
const overhead=Buffer.byteLength(text('dist/entry.json'))+Buffer.byteLength(text('dist/routing.json'));
const scenarios=[
  ['fresh_install','full_install',false,false],['enabled_workspace','interaction',true,false],
  ['ordinary_g0','information',false,false],['authorized_durable_write','durable_write',false,false],
  ['due_update','due_update',true,false],['context_loss','context_loss',true,true],
  ['interrupted_setup','interrupted_setup',true,true],
];
const measurements=scenarios.map(([id,facet,warm,loss])=>{
  const session=contextSession('benchmark-workspace','benchmark-runtime',trace.source_identity);
  if(warm)session.load(select({classification:'known',request:['information']}));
  if(loss)session.loseContext();
  const before=session.metrics();
  return {id,facet,warm,loss,before,session};
});
// Measure only actual local selection/reads/assembly; no simulated remote/model counts.
for(const item of measurements){
  const start=performance.now();const result=item.session.load(select({classification:'known',request:[item.facet]}));
  const elapsed=performance.now()-start;
  const baseline=protocolSource(readFileSync(new URL('../PROTOCOL.md',import.meta.url),'utf8'));
  const migrationBytes=['due_update','full_install','interrupted_setup'].includes(item.facet)?migrationContextBytes:0;
  const procedureBytes=migrationBytes+(item.facet==='full_install'||item.facet==='interrupted_setup'
    ?Buffer.byteLength(text('dist/procedures/bootstrap.json'))+Buffer.byteLength(text('dist/procedures/lifecycle.json'))
    :['due_update','context_loss'].includes(item.facet)?Buffer.byteLength(text('dist/procedures/lifecycle.json')):0);
  Object.assign(item,{modules:result.modules,baseline_governing_bytes:Buffer.byteLength(baseline),
    selected_governing_bytes:overhead+procedureBytes+result.modules.reduce((sum,id)=>sum+Buffer.byteLength(text(`dist/modules/${id}.json`)),0),
    newly_read_module_bytes:result.loaded_bytes-item.before.loaded_bytes,module_file_reads:result.reads-item.before.reads,
    migration_context_encoding:'lossless_migration_context:1; stored JSON unchanged',
    engine_loaded_bytes:Buffer.byteLength(text('dist/oop-enforce.js')),
    entry_selector_bytes:overhead,procedure_bytes:procedureBytes,local_selection_read_assembly_ms:elapsed,
    tokenizer_tokens:'not_measured',actual_model_calls:'not_measured',provider_actions:'not_performed',
    end_to_end_runtime_duration:'not_measured',monetary_cost:'not_measured',user_interventions:'not_measured'});
  delete item.session;delete item.before;
}

const identities=identify(subjects());
const subjectUnchanged=JSON.stringify(identities)===JSON.stringify(frozenIdentities);
const noByteRegression=measurements.every(m=>m.selected_governing_bytes<=m.baseline_governing_bytes);
const methodIdentity=measurementMethod(text('tools/accept-release.mjs'),[text('tools/release-engine.mjs'),text('tools/reference-engine.mjs')]);
const measured=measurements.map(m=>({...m,method_identity:methodIdentity,scope_identity:effectiveScope(m,id=>json('dist/modules/'+id+'.json'),source,id=>json('dist/procedures/'+id+'.json'),trace.migration_artifacts.map(p=>json('dist/'+p)))}));
const rollingEfficiency=compareEfficiency({baseline:efficiencyBaseline,subjectIdentity:hash(JSON.stringify(identities)),measurements:measured});
const priorSourceEqual=efficiencyBaseline.status==='verified' && efficiencyBaseline.source_identity===hash(source);
const stableIDs=efficiencyBaseline.status==='verified' && stableContractIDs(efficiencyBaseline.contract_ids,trace.clauses.map(c=>c.contract));
const committedSubject=committedInputs(identities,path=>readObject(evaluatedCheckout.commit,path));
const localChecks={reviewed_source_allocation:allocationReady?'passed':'failed',source_content_binding:sourceBindingReady?'passed':'failed',
  local_package_and_reference_tests:testPassed?'passed':'failed',maintainer_regressions:maintainerPassed?'passed':'failed',measured_context_bytes:noByteRegression?'passed':'failed',
  frozen_subject:subjectUnchanged?'passed':'failed',frozen_checkout:JSON.stringify(checkout())===JSON.stringify(evaluatedCheckout)?'passed':'failed'};
const localValid=Object.values(localChecks).every(value=>value==='passed');
const checks={...localChecks,source_regression_gate:efficiencyBaseline.status==='verified'?(priorSourceEqual?'passed':'not_verified'):'not_verified',
  historical_efficiency_evidence:efficiencyBaseline.status,stable_contract_ids:efficiencyBaseline.status==='verified'?(stableIDs?'passed':'failed'):'not_verified',
  rolling_efficiency_regression:rollingEfficiency.status};
const revisionValid=priorSourceEqual && stableIDs && efficiencyBaseline.status==='verified' && rollingEfficiency.readiness_allowed;
const candidateValid=localValid;
const releaseAccepted=!candidate && localValid && committedSubject;
const report={observed_at:new Date().toISOString(),node_version:process.version,source_identity:hash(source),source_binding:trace.source_binding,
  ...(snapshot?{}:{evaluated_checkout:evaluatedCheckout}),subject_content_identity:hash(JSON.stringify(identities)),identities,
  report_kind:snapshot?'content_checkpoint':candidate?'precommit_content_candidate':'current_checkout_acceptance',
  checkpoint_policy:snapshot?'current_content_candidate':undefined,
  prior_checkpoint:efficiencyBaseline.status==='verified'?{content_identity:packageBaseline.identity,selection_evidence:efficiencyBaseline.selection_evidence}:null,
  revision_binding:'Tracked evidence binds content, not its own containing SHA. Current ignored acceptance observes actual HEAD and all current committed subject bytes, independently of ancestry. Candidate validation is never committed acceptance.',
  scope:'local producer source/package verification; no installed runtime, provider, cross-runtime, publication or adoption claim',
  release_ready:releaseAccepted,comparative_regression_ready:revisionValid,candidate_validated:candidateValid,committed_source_ready:committedSubject,
  publication:'not_performed',runtime_adoption:'not_performed',checks,observation_summary:observationSummary,observations,measurements,
  maintainer_regression_summary:{tests:Number(maintainerRun.stdout.match(/^# tests (\d+)$/m)?.[1]??0),passed:maintainerPassed},
  semantic_review:{reference:'tools/release-review.json',preservation:'complete reviewed current source, explicit semantic delta and migration support; no independent second semantic reviewer claimed',change_scope:json('tools/release-review.json').change_scope},
  source_comparison:{basis:priorSourceEqual?'exact_source_preservation':'independent_previous_source_not_verified',exact_preservation:priorSourceEqual},
  efficiency_comparison:{historical_baseline:efficiencyBaseline,rolling:rollingEfficiency,full_current_source_control:noByteRegression?'passed':'failed'},
  comparison_basis:'Same current source fully loaded versus selected closure including entry, selector and applicable procedures. Cold/warm/recovery local measurements; bytes are not tokens or money.',
  retained_requirements:trace.clauses.map(c=>({id:c.contract,disposition:json('tools/release-review.json').change_scope.changed_contracts.includes(c.contract)?'reviewed_semantic_change':'preserved_verbatim',source_identity:c.content_identity,artifact:c.artifact})),
  limitations:{installed_runtime:'not_performed',provider_execution:'not_performed',cross_runtime:'not_performed',tokens_and_money:'not_measured',
    semantic_judgment:'reasoned allocation and exact reconstruction, not formal proof or live enforcement',
    skipped_tests:'Skipped mandatory cases block candidate and release readiness',
    future_semantic_delta:'Unequal source requires fresh independently grounded delta review, compatibility/migration disposition and regressions; no automatic exemption',
    historical_baseline:'Current mutable checkpoints do not establish latest prior provenance; comparative claims require independently supplied content identity and selection evidence'},
};
const reportPath=snapshot?'release-acceptance.json':candidate?'genesis-candidate.json':'current-acceptance.json';
const tapPath=snapshot?'release-tests.tap':candidate?'genesis-candidate-tests.tap':'current-tests.tap';
const outputs=[{path:'tools/evidence/'+reportPath,content:JSON.stringify(report,null,2)+'\n'},
  {path:'tools/evidence/'+tapPath,content:run.stdout},{path:'tools/evidence/current-maintainer-tests.tap',content:maintainerRun.stdout},
  ...(snapshot?[{path:'tools/evidence/release-maintainer-tests.tap',content:maintainerRun.stdout}]:[])];
writeEvidence(root,outputs);
const success=candidate?candidateValid:releaseAccepted;
process.stdout.write(JSON.stringify({mode:evaluatedCheckout.mode,release_ready:releaseAccepted,candidate_validated:candidateValid,committed_inputs:committedSubject,observations:observationSummary,checks})+'\n');
if(!success){process.stderr.write(run.stderr+maintainerRun.stderr);process.exitCode=1;}
