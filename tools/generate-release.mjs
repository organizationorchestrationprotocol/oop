// Maintainer-only generation. Consumers never run this or verify these identities.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { modules, spans } from './release-plan.mjs';
import { closure } from './reference-engine.mjs';
import { validateProfile } from './schema-profile.mjs';
import { applyArtifacts } from './prune-artifacts.mjs';
import { protocolSource, protocolSourceLocator } from './acceptance-inputs.mjs';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const document = readFileSync(new URL('../PROTOCOL.md', import.meta.url), 'utf8');
export const source = protocolSource(document);
const review = JSON.parse(readFileSync(new URL('./release-review.json', import.meta.url), 'utf8'));
if (review.source_identity !== hash(source)) throw new Error('Source changed: complete semantic review and bound span update required');
if (JSON.stringify(review.spans.map(({content_identity,...x}) => x)) !== JSON.stringify(spans)) throw new Error('Unreviewed allocation change');
if (JSON.stringify(review.modules)!==JSON.stringify(modules)) throw new Error('Unreviewed module semantics/dependencies');
const lines = source.split('\n'), schema = JSON.parse(readFileSync(new URL('./schemas/contract.schema.json', import.meta.url)));
let next = 1;
const contracts = spans.map(span => {
  if (span.start !== next || span.end < span.start) throw new Error('Gap/overlap in reviewed source');
  next = span.end + 1;
  const text = lines.slice(span.start-1,span.end).join('\n');
  if (hash(text) !== review.spans.find(x=>x.id===span.id)?.content_identity) throw new Error(`Changed reviewed clause: ${span.id}`);
  const module = modules.find(x=>x.id===span.module);
  if (!module) throw new Error('Missing reviewed module');
  const contract = { id:span.id, source:{path:'PROTOCOL.md',locator:protocolSourceLocator(span.start,span.end,document),content_identity:hash(text)},
    actor:span.module==='producer'?'maintainer':'source-qualified actor', triggers:module.facets,
    scope:module.purpose, dependencies:module.dependencies, preconditions:['$clause'], actions:['$clause'],
    postconditions:['$clause'], verification:'$clause', prohibitions:['$clause'], unknown:'$clause+core',
    failure:'$clause+core', recovery:'$clause+core', semantic_clause:text };
  const errors = validateProfile(contract,schema);
  if (errors.length) throw new Error(`${span.id}: ${errors.join(', ')}`);
  return {span,contract};
});
if (next-1 !== lines.length) throw new Error('Incomplete source coverage');
closure(modules,modules.map(x=>x.id));
const commit = spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
let committed = spawnSync('git',['show','HEAD:PROTOCOL.md'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
if (committed.status !== 0) committed = spawnSync('git',['show','HEAD:PROMPT.md'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
if (commit.status || committed.status || protocolSource(committed.stdout,{historical:true})!==source) throw new Error('Canonical source must be committed before ready distribution generation');
const plan = [];
function save(path,data) {
  const content = JSON.stringify(data)+'\n';
  plan.push({path,content});
  return {path:path.replace(/^distribution\//,''),content_identity:hash(content)};
}
const indexModules = modules.map(module => {
  const selected = contracts.filter(x=>x.span.module===module.id).map(x=>x.contract);
  const payload = save(`distribution/modules/${module.id}.json`,{format:1,id:module.id,contracts:selected});
  const detail = save(`distribution/details/${module.id}.json`,{
    id:module.id,purpose:module.purpose,semantic_scope:module.purpose,triggers:module.facets,
    semantic_conditions:'Evaluate exact source clauses and effective scope; facets are conservative selectors, never permission.',
    effect_action_classes:module.facets,lifecycle_phases:['entry','interaction','pre_effect','post_effect','completion','recovery'],
    resources:'Only resources applicable under the source-qualified scope; current-project boundary applies.',
    reads:'Applicable source/organizational/private references only.',writes:'Only source-permitted authorized scope; selection grants no write.',
    risk_authority_conditions:'Core proportionality and independent current authority; source-qualified stronger gates remain.',
    dependencies:module.dependencies,escalation_signals:['material_scope_change','unknown_material_fact','new_effect','changed_authority'],
    mandatory_preconditions:'Source clauses plus current identity, applicable authority/context and dependencies.',
    postconditions_verification:'Source clauses and actual required observations; command/model assertion is insufficient.',
    context_invalidating_conditions:['workspace','runtime','adopted_identity','route','source_content','authority','relevant_state','capability','retention'],
    contracts:selected.map(x=>({id:x.id,source:x.source})),...payload,
  });
  return {id:module.id,dependencies:module.dependencies,facets:module.facets,context:payload.path,detail:detail.path,detail_identity:detail.content_identity};
});
const facets = {};
for (const module of modules) for (const facet of module.facets) (facets[facet]??=[]).push(module.id);
facets.full_install=['bootstrap']; facets.information=['entry']; facets.interaction=['entry'];
// Writing local files is not automatically canonical organizational work.
facets.local_write=['entry']; facets.durable_write=['tickets','execution'];
facets.completion=['entry']; facets.update=['adoption']; facets.context_loss=['recovery','entry'];
facets.canonical_write=['operations','execution','history']; facets.continuity_reserve=['handoff'];
save('distribution/routing.json',{
  format:1,algorithm:'union(request,action,state,risk,authority,recovery) -> deterministic dependency closure',
  producer_binding:{source_identity:hash(source),source_snapshot_commit:commit.stdout.trim(),evidence_ref:'../tools/evidence/release-acceptance.json',consumer_verification:'not_performed'},
  classification:'Semantic effective scope, not keywords, endpoints or automatic level/module table.',
  default:['entry'],modules:indexModules,facets,conservative:modules.filter(x=>x.id!=='producer').map(x=>x.id),
  unknown:'Load sufficient conservative context to resolve material uncertainty before dependent effects; unknown selectors fail, no authority granted.',
  escalation:'Reclassify actual proposed actions, newly discovered scope and relevant state before effects; revisit final scope at completion.',
  level_policy:'G0/G1 need no artificial managed record; G2-G4 preserve source-defined managed facts. Remote transport alone is not G3.',
  producer_facet:'oop_maintenance is for separately authorized maintenance only; never consumer activation.',
});
const evidenceFields=['scope','source_identity','observed_at','expected','actual','supported_facts','provenance','dependencies'];
const stepFacts = [
  ['scoped_install_intent'],['oop_obtained'],['bootstrap_context_available'],['version_metadata_recorded','release_checks_not_performed'],
  ['private_root_protected'],['project_source_resolved'],['source_access_classified'],['eligible_credential_prepared_or_not_required_for_source'],
  ['source_required_access_verified'],['operations_identity_resolved'],['operations_runtime_read_verified','operations_runtime_write_verified'],
  ['mandatory_installed_controls_verified'],['scoped_readiness_evidence_persisted'],
];
const actions=['interpret_install','obtain_or_reuse','load_and_start','record_version_only','protect_private_root','resolve_project_source',
  'discover_source_access','prepare_or_reuse_credentials','verify_source_access','discover_or_create_operations','verify_operations_access',
  'materialize_and_probe_controls','persist_and_report'];
const bootstrapRows = source.split('\n').filter(x=>/^\| \*\*BOOT-\d+\*\*/.test(x));
if (bootstrapRows.length!==13) throw new Error('Incomplete canonical BOOT sequence');
save('distribution/procedures/bootstrap.json',{
  format:1,id:'full-install',source_contracts:['OOP-full-install','OOP-bootstrap-system','OOP-bootstrap-communication','OOP-bootstrap-attestation'],
  states:['pending','attempted','observed','applied_pending_verification','verified','recovering','waiting_human','waiting_external','unsupported'],
  phase_distinctions:'Eligibility is not authority or execution. Applied/verified and runtime/organization ownership remain distinct.',
  steps:actions.map((action,index)=>({id:`BOOT-${String(index+1).padStart(2,'0')}`,actor:'active_runtime',
    effect_owner:index===9?'organization':'runtime',action,depends_on:index?[`BOOT-${String(index).padStart(2,'0')}`]:[],
    source_contract:'OOP-full-install',source_row:index+1,guard:{all:stepFacts[index].map(fact=>({fact}))},
    guard_scope:'Necessary observed facts only; evaluate the full source row, applicable authority, dependencies and installed gates independently.',
    observation:{required_fields:evidenceFields,never_sufficient:['user_confirmation','model_assertion','command_exit_zero']},
    branches:{existing:'Discover and reuse only if current scoped evidence supports it.',absent:'Prepare/provision only if actually required, confirmed absent and authorized.',
      unavailable:'Repair/reuse authorized alternatives; retain precise dependent gap.',unknown:'Discover sufficient scoped facts or keep the dependent effect pending.'},
    wait:'Prove a concrete human-only/external dependency and exact observable resume condition; continue independent authorized work.',
    failure:'Preserve prior verified checkpoint and actual partial effects; correct actionable local defects autonomously.',
    resume:'Inspect actual effects before repeating creation/enrollment/publication; invalidate only dependent facts.',
    communication:'Explain action purpose in the user language before/as it starts; report actual result and any required user action.',
  })),
  transitions:[
    {from:'pending',to:'attempted',requires:['current_authority','preconditions_satisfied','context_available']},
    {from:'attempted',to:'observed',requires:['actual_observation']},
    {from:'observed',to:'applied_pending_verification',requires:['actual_effect_observed']},
    {from:'applied_pending_verification',to:'verified',requires:['step_guard_true','all_applicable_source_criteria_passed']},
    {from:'observed',to:'recovering',requires:['failed_or_uncertain_result']},
    {from:'recovering',to:'pending',requires:['actual_state_reconciled','new_relevant_information','remaining_action_authorized']},
    {from:'pending',to:'waiting_human',requires:['proved_human_only_dependency']},
    {from:'waiting_human',to:'pending',requires:['actual_prerequisite_verified']},
    {from:'pending',to:'waiting_external',requires:['proved_external_dependency']},
    {from:'waiting_external',to:'pending',requires:['actual_prerequisite_verified']},
    {from:'pending',to:'unsupported',requires:['mandatory_capability_unavailable','authorized_recovery_exhausted']},
  ],
  completion:'BOOT-13 reports full PASS only with all applicable consumer-local criteria observed, then awaits first work request; no release tests.',
});
save('distribution/procedures/lifecycle.json',{
  format:1,routes:{
    first_install:{facets:['full_install'],procedure:'bootstrap.json'},
    interaction:{facets:['interaction'],sequence:['identity_binding','valid_context','due_checks_only','classify','union_closure','applicable_gates','response_or_effect','completion']},
    adoption:{facets:['due_update'],source_contract:'OOP-runtime-adoption',sequence:['availability','compatibility','target','authorization','ordered_owned_actions','verification','atomic_owned_checkpoint','knowledge_realignment']},
    migration:{facets:['organizational_migration'],source_contract:'OOP-organizational-migration',sequence:['inspect_canonical_revision_and_actual_state','interpret_explicit_state_change_and_scope','reader_writer_compatibility','exclusive_authority_when_required','remaining_actions_only','verify_result','canonical_record']},
    recovery:{facets:['context_loss'],source_contracts:['OOP-asynchronous-recovery','OOP-available-context'],sequence:['resolve_owned_checkpoint','actual_effects','due_freshness','reroute','rehydrate_missing','verify_prerequisites','authorized_remaining_action']},
    destination:{facets:['destination_entry'],source_contract:'OOP-destination-intake',sequence:['own_identity_adoption','current_canonical_facts','classify_resources','own_access_verification','own_closure','validated','accepted','first_verified_action','resumed']},
  },unknown:'Keep independent facts explicit; no source/target adoption transfer or inferred approval.',
});
save('distribution/interfaces.json',{
  format:1,delivery:'Abstract interoperable contract; native/local interfaces suffice. No mandatory Node, MCP, CEL or hosted service.',
  request:{fields:['id','workspace','runtime','intent','target','purpose','effect_class','permitted_scope','authority_ref','expected_prior_state','dependencies','verification_criteria']},
  result:{fields:['request_id','attempt','observations','actual_effects','verification','evidence_refs','failure','blockers','next_action'],
    distinctions:['not_attempted','attempted','observed','applied_pending_verification','verified','failed','unknown']},
  evidence:{fields:evidenceFields,authority:'A supplied fact requires independent attributable scope-bound evidence; shape or a true boolean is not proof.'},
  capabilities:['repository.discover','repository.read','repository.create','repository.configure','repository.write','repository.permission.inspect','secret.storage','context.retrieve','context.assemble','checkpoint.persist','control.probe'],
  checkpoints:{ownership:['shared_project_references','runtime_owned_adoption_integration','canonical_organization'],
    fields:['project_identity','runtime_identity_when_owned','intent','attempt','observations','completed_remaining','dependencies','verification','next_action'],
    write:'Use applicable expected-revision/concurrency and atomic persistence; atomic rename alone does not prevent lost updates.',
    reuse:'Require exact relevant dependencies and current ownership/freshness; workspace switch invalidates active project state.'},
  prohibitions:['raw_secret_values','ambient_foreign_authority','invented_observations','schema_as_truth','release_validation_during_consumer_lifecycle'],
});
save('distribution/entry.json',{
  format:1,protocol:'organization-orchestration-protocol',status:'prepared_distribution',
  contract_profile:'urn:oop:derived:contract:1',
  authority:'../PROTOCOL.md is canonical. This is derived operational context; source controls conflicts.',
  version:'Record available repository/ref/full containing Git commit from version metadata. Producer source_snapshot is not runtime adoption or a version manifest.',
  source_snapshot:{repository:'https://github.com/organizationorchestrationprotocol/oop.git',ref:'main',commit:commit.stdout.trim(),path:'PROTOCOL.md'},
  activation:'Official installation intent starts full_install immediately after required initial explanation; other requests use the applicable lifecycle route.',
  minimum_context:['modules/core.json','modules/workspace.json','modules/context.json','modules/entry.json'],
  selector:'routing.json',procedures:{bootstrap:'procedures/bootstrap.json',lifecycle:'procedures/lifecycle.json'},interfaces:'interfaces.json',
  contract_binding:{'$clause':'Evaluate the complete semantic_clause for that dimension, with its exact quantified scope, conditions, exceptions and normative force.',
    '$clause+core':'Evaluate the clause and Core for that dimension. No inferred generic permission or invented fact.',
    actor:'source-qualified actor means the actual actor specified by the complete clause; references do not change ownership.',
    examples:'Source examples remain conditional illustrations, never independent authority.',
    hashes:'Content identities are producer provenance/reference metadata. Consumers do not recompute, compare to Git or certify OOP artifacts.'},
  context:'Union classified semantic facets then dependencies; load only missing/stale selected context. Resolve material unknowns before effects, never infer permission.',
  consumer_exclusion:'Never run maintainer commands, schemas as release tests, OOP repository audits, hashes/signatures/inventories/publisher/TOFU checks during consumer lifecycle. Consumer-local installed/access probes remain distinct.',
  runtime:'Select supported existing mechanisms under canonical authority; this package does not install controls, prove provider access or claim Full OOP runtime governance.',
});
save('tools/evidence/release-traceability.json',{
  source_identity:hash(source),source_snapshot_commit:commit.stdout.trim(),source_normalization:'CRLF to LF; explanatory overview and role section headings excluded, document title retained; allocation lines refer to extracted source, contract locators to document lines',review_ref:'tools/release-review.json',
  preservation:'preserved_verbatim',coverage_complete:true,
  clauses:contracts.map(({span,contract})=>({...span,content_identity:contract.source.content_identity,artifact:`distribution/modules/${span.module}.json`,contract:contract.id})),
  modules:indexModules,
  classification:'generated_derived_only; canonical source unchanged from committed source snapshot',
  migration:{organizational_state_change:false,scope:'runtime',rationale:'Initial complete derived distribution of identical canonical semantics; no organizational transformation authorized.',
    actions:[{scope:'runtime',action:'Resolve the structured entry, evaluate applicability, realign owned pointers and context when this package is adopted.',verification:'Own consumer-local context and installed path evidence; never producer suite.'}],
    existing_state_policy:'Preserve valid organizational history and independently owned checkpoints; canonical migration/adoption rules govern any actual semantic difference.',
    recovery:'Retain prior verified adoption and actual partial effects; repair owned derived references before dependent claims.'},
});
const expected = modules.flatMap(module => [`distribution/modules/${module.id}.json`, `distribution/details/${module.id}.json`]).concat([
  'distribution/routing.json', 'distribution/procedures/bootstrap.json', 'distribution/procedures/lifecycle.json',
  'distribution/interfaces.json', 'distribution/entry.json', 'tools/evidence/release-traceability.json',
]);
const removed = applyArtifacts(root, plan, expected);
process.stdout.write(`Removed ${removed.length} orphan module/detail artifacts${removed.length ? ': '+removed.join(', ') : ''}.\n`);
process.stdout.write(`Generated ${modules.length} modules, ${contracts.length} lossless contracts and BOOT-01–13; producer acceptance still required.\n`);
