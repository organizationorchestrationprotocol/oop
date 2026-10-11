// Producer acceptance of this derived package only. Never a consumer command.
import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { contextSession,select,readJSON } from './release-engine.mjs';
import { subjects as subjectPaths, identify as identifyInputs, testFiles, expectedObservations, protocolSource, completeProducerObservations } from './acceptance-inputs.mjs';
import { reviewedSourceTransition } from './source-transition.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>`sha256:${createHash('sha256').update(x).digest('hex')}`;
const text=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const json=path=>JSON.parse(text(path));
const git = args => spawnSync('git',['--no-optional-locks',...args],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
const outputMode=process.argv.slice(2);
if(outputMode.some(arg=>!['--snapshot','--check-current'].includes(arg)) || outputMode.length>1) throw new Error('Use --snapshot, --check-current, or no arguments');
const snapshot=outputMode.includes('--snapshot');
const reportPath=snapshot?'release-acceptance.json':'current-acceptance.json';
const tapPath=snapshot?'release-tests.tap':'current-tests.tap';
function checkout() {
  const commit=git(['rev-parse','HEAD']);
  const ref=git(['symbolic-ref','--quiet','--short','HEAD']);
  const status=git(['status','--porcelain','--untracked-files=all']);
  if(commit.status!==0 || status.status!==0) throw new Error('Cannot identify evaluated Git checkout');
  return {commit:commit.stdout.trim(),ref:ref.status===0?ref.stdout.trim():'detached',
    working_tree:status.stdout.trim()?'modified':'clean',changes:status.stdout.trimEnd().split('\n').filter(Boolean)};
}
if(outputMode.includes('--check-current')) {
  const report=json('tools/evidence/current-acceptance.json');
  const current=checkout();
  if(report.evaluated_checkout?.commit!==current.commit || report.release_ready!==true ||
      JSON.stringify(report.identities)!==JSON.stringify(identify(subjects()))) {
    throw new Error('Current acceptance is stale or failed: rerun node tools/accept-release.mjs');
  }
  process.stdout.write(`Current acceptance matches HEAD ${current.commit} and all evaluated subject files.\n`);
  process.exit(0);
}
const evaluatedCheckout=checkout();
const source=protocolSource(text('PROTOCOL.md'));
const trace=json('tools/evidence/release-traceability.json');
function subjects(){return subjectPaths(root);}
function identify(paths){return identifyInputs(root,paths);}
const frozenIdentities=identify(subjects());
// Find the latest committed accepted package, never silently choose an older one.
const acceptancePaths=['tools/evidence/release-acceptance.json','build/evidence/release-acceptance.json','build_tools/evidence/release-acceptance.json','maintainer/evidence/release-acceptance.json'];
const history=git(['log','--format=%H','--',...acceptancePaths]);
if(history.status!==0)throw new Error('Cannot establish latest-prior regression basis');
let packageBaseline;
for(const recordCommit of history.stdout.trim().split('\n').filter(Boolean)){
  for(const path of acceptancePaths){
    const result=git(['show',`${recordCommit}:${path}`]);
    if(result.status!==0)continue;
    const report=JSON.parse(result.stdout);
    if(report.release_ready===true){packageBaseline={recordCommit,report,identity:hash(result.stdout)};break;}
  }
  if(packageBaseline)break;
}
const initialBaseline='8de5d1fb6efb865710c7750b65cff2a744a4c239';
const baselineCommit=packageBaseline?.report.source_snapshot_commit??initialBaseline;
const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...testFiles],
  {cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
const observations=[...run.stdout.matchAll(/^(ok|not ok) \d+ - ((?:REL-OBS|REL-PKG|REL-TOOL)-\d+): (.+?)(?: # (SKIP|TODO)(.*))?$/gm)].map(match=>({
  id:match[2],checked:match[3],expected:'isolated local assertion passes, including applicable designed negative controls',
  actual:match[4]?'skipped':match[1]==='ok'?'passed':'failed',...(match[4]?{skip_reason:match[5].trim()}:{}),
  tier:match[2].startsWith('REL-PKG')?'real_package_local_read_and_supplied_fact_model':match[2].startsWith('REL-TOOL')?'producer_freshness_and_artifact_safety':'isolated_reference_fixture',
}));
const observationIds=observations.map(x=>x.id);
const observationSummary={total:observations.length,unique:new Set(observationIds).size,
  passed:observations.filter(x=>x.actual==='passed').length,failed:observations.filter(x=>x.actual==='failed').length,
  skipped:observations.filter(x=>x.actual==='skipped').length,
  missing:expectedObservations.filter(id=>!observationIds.includes(id)),unexpected:observationIds.filter(id=>!expectedObservations.includes(id))};
const testPassed=completeProducerObservations(run, observations);
let previous=git(['show',`${baselineCommit}:PROTOCOL.md`]);
if(previous.status!==0) previous=git(['show',`${baselineCommit}:PROMPT.md`]);
const priorSourceEqual=previous.status===0&&protocolSource(previous.stdout,{historical:true})===source;
const transitionRecord=json('tools/reviewed-source-transition.json');
const sourceMigration=priorSourceEqual ? {status:'not_applicable',basis:'exact_source_preservation'} : reviewedSourceTransition({
  record:transitionRecord,baselineCommit,checkpoint:packageBaseline,
  previous:previous.status===0?protocolSource(previous.stdout,{historical:true}):'',source,
  review:json('tools/release-review.json'),trace,
  readObject:(commit,path)=>{const result=git(['show',`${commit}:${path}`]);if(result.status!==0)throw new Error('Missing immutable transition evidence');return result.stdout;},
  targetIsAncestor:git(['merge-base','--is-ancestor',transitionRecord.target.commit,evaluatedCheckout.commit]).status===0,
});
// Distinct regression suite/TAP, never REL-* observations or consumer conformance.
const migrationRun=spawnSync(process.execPath,['--test','--test-reporter=tap','tools/source-transition.test.mjs'],
  {cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
const migrationTestsPassed=migrationRun.status===0 && /^# tests 25$/m.test(migrationRun.stdout) && /^# fail 0$/m.test(migrationRun.stdout) && /^# skipped 0$/m.test(migrationRun.stdout);
const sourceGate=priorSourceEqual || sourceMigration.status==='passed';
// This fixed checkpoint predates the directory rename.
const priorProof=git(['show',`${initialBaseline}:maintainer/evidence/local-validation.json`]);
if(priorProof.status!==0)throw new Error('No attributable preceding source validation checkpoint; establish a reviewed regression basis first');
const baselineProof=JSON.parse(priorProof.stdout);
const baselineIdentified=baselineProof.observations.length===30 && baselineProof.source_preservation_check.actual==='passed';
// Exact preservation and the reviewed historical bridge have distinct bases.
// Every other source delta still requires explicit review/regression work.
// Baseline coverage is explicitly source/fixture only, never a previously complete distribution/live release.
const overhead=Buffer.byteLength(text('distribution/entry.json'))+Buffer.byteLength(text('distribution/routing.json'));
const scenarios=[
  ['fresh_install','full_install',false,false],['enabled_workspace','interaction',true,false],
  ['ordinary_g0','information',false,false],['authorized_durable_write','durable_write',false,false],
  ['due_update','due_update',true,false],['context_loss','context_loss',true,true],
  ['interrupted_setup','interrupted_setup',true,true],
];
const measurements=scenarios.map(([id,facet,warm,loss])=>{
  const session=contextSession('benchmark-workspace','benchmark-runtime',trace.source_snapshot_commit);
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
  const procedureBytes=item.facet==='full_install'||item.facet==='interrupted_setup'
    ?Buffer.byteLength(text('distribution/procedures/bootstrap.json'))+Buffer.byteLength(text('distribution/procedures/lifecycle.json'))
    :['due_update','context_loss'].includes(item.facet)?Buffer.byteLength(text('distribution/procedures/lifecycle.json')):0;
  Object.assign(item,{modules:result.modules,baseline_governing_bytes:Buffer.byteLength(baseline),
    selected_governing_bytes:overhead+procedureBytes+result.modules.reduce((sum,id)=>sum+Buffer.byteLength(text(`distribution/modules/${id}.json`)),0),
    newly_read_module_bytes:result.loaded_bytes-item.before.loaded_bytes,module_file_reads:result.reads-item.before.reads,
    entry_selector_bytes:overhead,procedure_bytes:procedureBytes,local_selection_read_assembly_ms:elapsed,
    tokenizer_tokens:'not_measured',actual_model_calls:'not_measured',provider_actions:'not_performed',
    end_to_end_runtime_duration:'not_measured',monetary_cost:'not_measured',user_interventions:'not_measured'});
  delete item.session;delete item.before;
}
const identities=identify(subjects());
const subjectUnchanged=JSON.stringify(identities)===JSON.stringify(frozenIdentities);
const noByteRegression=measurements.every(x=>x.selected_governing_bytes<=x.baseline_governing_bytes);
const checks={source_preservation:priorSourceEqual?'passed':'not_identical',
  source_regression_gate:sourceGate?'passed':'failed',source_migration_regressions:migrationTestsPassed?'passed':'failed',preceding_source_checkpoint:baselineIdentified?'passed':'failed',
  local_package_and_reference_tests:testPassed?'passed':'failed',measured_context_bytes:noByteRegression?'passed':'failed',
  frozen_subject:subjectUnchanged?'passed':'failed',frozen_checkout:JSON.stringify(checkout())===JSON.stringify(evaluatedCheckout)?'passed':'failed'};
const accepted=sourceGate && Object.entries(checks).filter(([key])=>key!=='source_preservation').every(([,status])=>status==='passed');
const report={
  observed_at:new Date().toISOString(),node_version:process.version,
  source_identity:hash(source),source_snapshot_commit:trace.source_snapshot_commit,
  evaluated_checkout:evaluatedCheckout,
  subject_content_identity:hash(JSON.stringify(identities)),
  report_kind:snapshot?'committed_acceptance_snapshot':'current_checkout_acceptance',
  revision_binding:'evaluated_checkout identifies HEAD at execution; identities bind the actual files including any working-tree changes. source_snapshot_commit identifies generator provenance only. A committed report cannot embed its own containing commit; rerun acceptance after commit and use --check-current for current HEAD.',
  scope:'producer-prepared technology-neutral derived distribution; no installed-runtime/provider/cross-runtime readiness claim',
  release_ready:accepted,publication:'not_performed_for_generated_package',runtime_adoption:'not_performed',checks,identities,
  source_comparison:{basis:priorSourceEqual?'exact_source_preservation':sourceMigration.status==='passed'?'reviewed_historical_path_transition':'unreviewed_source_delta',exact_preservation:priorSourceEqual,reviewed_transition:sourceMigration},
  migration_regression_summary:{passed:migrationTestsPassed,tests:Number(migrationRun.stdout.match(/^# tests (\d+)$/m)?.[1]??0),failed:Number(migrationRun.stdout.match(/^# fail (\d+)$/m)?.[1]??0),skipped:Number(migrationRun.stdout.match(/^# skipped (\d+)$/m)?.[1]??0)},
  semantic_review:{result:priorSourceEqual?'reasoned_complete_allocation_with_verbatim_source_preservation':sourceMigration.status==='passed'?'reasoned_complete_allocation_with_reviewed_historical_path_transition':'source_delta_not_verified',reference:'tools/release-review.json',
    evidence_strength:'source reasoning plus exact reconstruction; independent reviewer and live prevention not claimed'},
  rolling_baseline:{commit:baselineCommit,source_identity:hash(protocolSource(previous.stdout,{historical:true})),
    package_checkpoint:packageBaseline?{commit:packageBaseline.recordCommit,content_identity:packageBaseline.identity}:null,
    provenance:packageBaseline?'Latest committed accepted producer-package report':'Committed local-validation.json and local-tests.tap: 30 prior reference observations and retained-source check; current push remote identity separately observed.',
    verified_scope:packageBaseline?packageBaseline.report.scope:'preceding committed canonical source retention and reference mechanisms only; not a complete previous distribution or installed integration',
    selection_basis:'Latest committed accepted package when available; otherwise initial preceding source checkpoint. Exact preservation or the single pinned reviewed historical transition is required.',
    normative_deltas:sourceMigration.status==='passed'?sourceMigration.changes:[],classification:priorSourceEqual?'generated_derived_only':sourceMigration.status==='passed'?'reviewed_historical_path_transition':'unreviewed_source_delta',full_previous_distribution:packageBaseline?'identified_checkpoint':'none_available_first_complete_export',
    limits:'No historical full release/integration verification is invented. These results establish current export preservation and local mechanisms only.'},
  observation_summary:observationSummary,observations,measurements,
  comparison_basis:'Same canonical source fully loaded versus selected real package closure including entry/selector and applicable procedure bytes. Cold/warm/recovery local harness; not a product end-to-end benchmark.',
  retained_requirements:trace.clauses.map(x=>({id:x.contract,disposition:'preserved_verbatim',source_identity:x.content_identity,artifact:x.artifact})),
  impact:{README:'affected: official structured entry after local package acceptance',examples:'affected: actual package and limits',
    maintainer_guidance:'affected: reusable reviewed generation and producer acceptance',schemas:'existing contract profile applied to all source contracts',
    tests:'25 package checks, 30 retained reference observations, four retained cleanup regressions and ten new producer safety/freshness checks',generated_artifacts:'complete current-source export with explicit semantic bindings',
    release_evidence:'current exact subjects, scope-bound verdict and seven measured local scenarios'},
  limitations:{installed_runtime:'not_performed: no native adapter is shipped or claimed installed',provider_execution:'not_performed: no credentials or provider effects used',
    cross_runtime:'not_performed: technology neutrality reviewed, real product interoperability not claimed',
    general_json_schema:'not_claimed: only declared restricted profile validated',token_or_money_savings:'not_claimed',
    formal_semantic_judgment:'not_claimed: source-qualified semantic conditions remain complete clauses',
    generator_application:'Preflight covers preexisting unsafe paths only; no concurrent adversarial path-change protection or multi-file atomicity. Apply I/O failure can leave partial effects; reconcile before rerunning.',
    skipped_tests:'Explicitly recorded as skipped, never PASS; any missing, failed or skipped expected observation blocks release_ready.'},
};
if(!snapshot)writeFileSync(new URL('./evidence/current-migration-tests.tap',import.meta.url),migrationRun.stdout);
writeFileSync(new URL(`./evidence/${tapPath}`,import.meta.url),run.stdout);
writeFileSync(new URL(`./evidence/${reportPath}`,import.meta.url),JSON.stringify(report,null,2)+'\n');
if(!accepted){process.stderr.write(JSON.stringify(checks)+'\n'+run.stderr+migrationRun.stderr);process.exitCode=1;}
else process.stdout.write(`Producer package accepted: ${observations.length} local observations, seven real-package scenarios; consumer integration and publication not claimed.\n`);
