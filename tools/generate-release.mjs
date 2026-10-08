// Maintainer-only generation. Consumers never run this or verify these identities.
import { readFileSync } from 'node:fs';
import { enforcementConfig, generateEnforcement, impact as enforcementImpact, wireSchemas, activationVocabulary } from './enforcement-contract.mjs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { modules, spans } from './release-plan.mjs';
import { closure } from './reference-engine.mjs';
import { validateProfile } from './schema-profile.mjs';
import { applyArtifacts } from './prune-artifacts.mjs';
import { migrationBundle, validateMigrationBundle, paths as migrationPaths } from './migration-contract.mjs';
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
    // The existing $clause binding resolves the exact scope, including its exceptions.
    // Module summaries remain in details; repeating them here adds no scoped authority.
    scope:'$clause', dependencies:module.dependencies, preconditions:['$clause'], actions:['$clause'],
    postconditions:['$clause'], verification:'$clause', prohibitions:['$clause'], unknown:'$clause+core',
    failure:'$clause+core', recovery:'$clause+core', semantic_clause:text };
  const errors = validateProfile(contract,schema);
  if (errors.length) throw new Error(`${span.id}: ${errors.join(', ')}`);
  return {span,contract};
});
if (next-1 !== lines.length) throw new Error('Incomplete source coverage');
closure(modules,modules.map(x=>x.id));
const args = process.argv.slice(2);
if (args.length) throw new Error('Content-bound generation takes no arguments; committed acceptance is separate');
// Reviewed source-content binding is deterministic before and after the containing commit.
// Acceptance checks every current committed input and actual HEAD independently of ancestry.
const sourceBinding = {kind:'source_content',source_identity:hash(source)};
const plan = [];
function save(path,data) {
  const content = JSON.stringify(data)+'\n';
  plan.push({path,content});
  return {path:path.replace(/^dist\//,''),content_identity:hash(content)};
}
const migrations=migrationBundle(hash(source),review.migration_support,'OOP-migration-distribution');
validateMigrationBundle(migrations,JSON.parse(readFileSync(new URL('./schemas/migration.schema.json',import.meta.url))),hash(source));
for(const [path,data] of Object.entries(migrations)) save('dist/'+path,data);
const indexModules = modules.map(module => {
  const selected = contracts.filter(x=>x.span.module===module.id).map(x=>x.contract);
  const payload = save(`dist/modules/${module.id}.json`,{format:1,id:module.id,contracts:selected});
  const detail = save(`dist/details/${module.id}.json`,{
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
  return {id:module.id,dependencies:module.dependencies,context:payload.path,detail:detail.path,detail_identity:detail.content_identity};
});
const facets = {};
for (const module of modules) for (const facet of module.facets) (facets[facet]??=[]).push(module.id);
facets.full_install=['bootstrap']; facets.information=['entry']; facets.interaction=['entry'];
// Writing local files is not automatically canonical organizational work.
facets.local_write=['entry']; facets.durable_write=['tickets','execution'];
facets.completion=['entry']; facets.update=['adoption']; facets.context_loss=['recovery','entry'];
facets.canonical_write=['operations','execution','history']; facets.continuity_reserve=['handoff'];
const routingData={
  format:2,algorithm:'union(request,action,state,risk,authority,recovery) -> deterministic dependency closure',
  producer_binding:{source_identity:hash(source),evidence_ref:'../tools/evidence/release-acceptance.json',consumer_verification:'not_performed'},
  classification:'Semantic effective scope, not keywords, endpoints or automatic level/module table.',
  default:['entry'],modules:indexModules,facets,conservative:modules.filter(x=>x.id!=='producer').map(x=>x.id),
  unknown:'Load sufficient conservative context to resolve material uncertainty before dependent effects; unknown selectors fail, no authority granted.',
  escalation:'Reclassify actual proposed actions, newly discovered scope and relevant state before effects; revisit final scope at completion.',
  level_policy:'G0/G1 need no artificial managed record; G2-G4 preserve source-defined managed facts. Remote transport alone is not G3.',
  producer_facet:'oop_maintenance is for separately authorized maintenance only; never consumer activation.',
};
save('dist/routing.json',routingData);
const evidenceFields=['scope','source_identity','observed_at','expected','actual','supported_facts','provenance','dependencies'];
// Bounded pre-clone projection: reviewed canonical table, never a parallel policy text.
const preflightContract=contracts.find(x=>x.contract.id==='OOP-full-install').contract;
const preflightRows=preflightContract.semantic_clause.split('\n').filter(row=>/^\| ENTRY-\d+ \|/.test(row));
if(preflightRows.length!==7) throw new Error('Incomplete canonical remote entry preflight');
const bootstrapPreflight={format:1,source_contract:preflightContract.id,source:preflightContract.source,
  steps:preflightRows.map((row,index)=>{
    const cells=row.split('|').slice(1,-1).map(cell=>cell.trim());
    const [id,refs,instruction,observations]=cells;
    if(cells.length!==4 || id!==`ENTRY-${String(index+1).padStart(2,'0')}` || !refs || !instruction || !observations)
      throw new Error('Invalid reviewed preflight row');
    return {id,source_refs:refs.split('; '),instruction,depends_on:index?[`ENTRY-${String(index).padStart(2,'0')}`]:[],
      guard:{all:observations.split(', ').map(fact=>({fact}))}};
  })};
const stepFacts = [
  ['scoped_install_intent'],['oop_obtained','current_project_identity','private_root_protected_before_checkout_write','same_project_destination_resolved','safe_acquisition_coordination'],['bootstrap_context_available'],['version_metadata_recorded','release_checks_not_performed'],
  ['private_root_protected'],['project_source_resolved'],['source_access_classified'],['eligible_credential_prepared_or_not_required_for_source'],
  ['source_required_access_verified'],['operations_identity_resolved'],['operations_runtime_read_verified','operations_runtime_write_verified','commit_attribution_disposition_verified'],
  ['mandatory_installed_controls_verified','installed_allowed_paths_verified','installed_denied_paths_verified','control_evidence_current'],
  ['scoped_readiness_evidence_persisted','mandatory_installed_controls_verified','all_applicable_phases_verified','readiness_evidence_current'],
];
const actions=['interpret_install','obtain_or_reuse','load_and_start','record_version_only','protect_private_root','resolve_project_source',
  'discover_source_access','prepare_or_reuse_credentials','verify_source_access','discover_or_create_operations','verify_operations_access',
  'materialize_and_readback_controls','persist_and_report'];
const bootstrapRows = source.split('\n').filter(x=>/^\| \*\*BOOT-\d+\*\*/.test(x));
if (bootstrapRows.length!==13) throw new Error('Incomplete canonical BOOT sequence');
const bootstrapData={
  format:1,id:'full-install',preflight_ref:'../entry.json#bootstrap_preflight',source_contracts:['OOP-full-install','OOP-bootstrap-system','OOP-bootstrap-communication','OOP-bootstrap-attestation'],
  states:['installed_unverified','pending','attempted','observed','applied_pending_verification','verified','recovering','waiting_human','waiting_external','unsupported'],
  phase_distinctions:'Eligibility is not authority or execution. Applied/verified and runtime/organization ownership remain distinct.',
  continuation:'Verify authenticated applicable answer/result and invalidated prerequisites on a real host continuation event. Waiting is nonterminal; continue safe independent work. If new user activation is needed, give precise portable reentry instructions; never promise unsupported automatic wakeup. Inspect actual effects before repeating non-idempotent work.',
  restart:'Only for a verified actual restart dependency: persist current project/runtime/OOP checkpoint, expected state, partial effects, remaining steps and verification; explain supported restart/reentry steps. Reconcile effects and revalidate invalidated controls after observable reentry; never invent commands.',
  steps:actions.map((action,index)=>({id:`BOOT-${String(index+1).padStart(2,'0')}`,actor:'active_runtime',
    effect_owner:index===9?'organization':'runtime',action,depends_on:index?[`BOOT-${String(index).padStart(2,'0')}`]:[],
    source_contract:'OOP-full-install',source_row:index+1,guard:{all:stepFacts[index].map(fact=>({fact}))},
    guard_scope:'Full source row, authority, dependencies and installed gates also apply.',
    observation:{required_fields:evidenceFields,never_sufficient:['user_confirmation','model_assertion','command_exit_zero']},
    branches:{existing:'Discover and reuse only if current scoped evidence supports it.',absent:'Prepare/provision only if actually required, confirmed absent and authorized.',
      unavailable:'Repair/reuse authorized alternatives; retain precise dependent gap.',unknown:'Discover sufficient scoped facts or keep the dependent effect pending.'},
    wait:'Prove a concrete human-only/external dependency and exact observable resume condition; persist scoped checkpoint and partial effects. Waiting is nonterminal; continue independent authorized work.',
    failure:'Preserve verified checkpoint/actual partial effects; repair authorized local defects.',
    resume:'Inspect actual effects before retry; invalidate dependent facts only.',
    continuation_ref:'#continuation',restart_ref:'#restart',
    communication:'Explain purpose in user language before/as it starts; report actual result and human action.',
  })),
  transitions:[
    {from:'observed',to:'installed_unverified',requires:['owned_configuration_readback','installation_dependencies_current','verified:BOOT-11']},
    {from:'installed_unverified',to:'applied_pending_verification',requires:['post_bootstrap_assurance_current','actual_effects_reconciled']},
    {from:'pending',to:'attempted',requires:['current_authority','preconditions_satisfied','context_available']},
    {from:'attempted',to:'observed',requires:['actual_observation']},
    {from:'observed',to:'applied_pending_verification',requires:['actual_effect_observed']},
    {from:'applied_pending_verification',to:'verified',requires:['step_guard_true','all_applicable_source_criteria_passed']},
    {from:'observed',to:'recovering',requires:['failed_or_uncertain_result']},
    {from:'recovering',to:'pending',requires:['actual_state_reconciled','new_relevant_information','remaining_action_authorized']},
    {from:'pending',to:'waiting_human',requires:['proved_human_only_dependency','scoped_checkpoint_persisted']},
    {from:'waiting_human',to:'pending',requires:['actual_prerequisite_verified','resume_event_observed','checkpoint_reconciled','invalidated_prerequisites_revalidated']},
    {from:'pending',to:'waiting_external',requires:['proved_external_dependency','scoped_checkpoint_persisted']},
    {from:'waiting_external',to:'pending',requires:['actual_prerequisite_verified','resume_event_observed','checkpoint_reconciled','invalidated_prerequisites_revalidated']},
    {from:'pending',to:'unsupported',requires:['mandatory_capability_unavailable','authorized_recovery_exhausted']},
  ],
  installation:{status:'INSTALLED_UNVERIFIED',effect_permission:'not_granted',
    action:'install_or_reuse_and_readback',active_hook_tests:0,producer_tests:0,max_attempts:2,
    requires:['owned_configuration_readback','installation_dependencies_current','verified:BOOT-11'],
    next:'Reuse current scoped assurance, otherwise establish only necessary safe evidence after bootstrap before dependent reliance.',
    full_readiness_guard_ref:'#steps/12/guard',
    statuses:['INSTALLED_UNVERIFIED','ACTIVE_VERIFIED','BLOCKED_OR_LIMITED']},
  completion:'BOOT-13 reports full PASS only with all applicable consumer-local criteria observed, then awaits first work request; no release tests.',
};
save('dist/procedures/bootstrap.json',bootstrapData);
const engineConfig=enforcementConfig({sourceBinding,routing:routingData,contracts,bootstrap:bootstrapData,migrations});
plan.push({path:'dist/oop-enforce.js',content:generateEnforcement(engineConfig,review.enforcement)});
save('dist/procedures/lifecycle.json',{
  format:1,routes:{
    first_install:{facets:['full_install'],procedure:'bootstrap.json'},
    interaction:{facets:['interaction'],assurance:'Reuse current evidence; no per-session artificial tests. Unknown prevention blocks dependent effects only.',sequence:['language_source_discovery','presentation_language_resolved','identity_binding','valid_context','due_checks_only','classify','union_closure','applicable_gates','response_or_effect','completion']},
    adoption:{facets:['due_update'],source_contract:'OOP-runtime-adoption',migration_index:'../migrations/index.json',migration_module:'migration-distribution',sequence:['availability','compatibility','target','authorization','migration_contract_ordered_or_current_supported_state','independent_common_runtime_operations','owned_remaining_actions','verification','atomic_owned_checkpoint','knowledge_realignment']},
    migration:{facets:['organizational_migration'],source_contract:'OOP-organizational-migration',sequence:['inspect_canonical_revision_and_actual_state','interpret_explicit_state_change_and_scope','reader_writer_compatibility','exclusive_authority_when_required','remaining_actions_only','verify_result','canonical_record']},
    recovery:{facets:['context_loss'],source_contracts:['OOP-asynchronous-recovery','OOP-available-context'],sequence:['resolve_owned_checkpoint','actual_effects','due_freshness','reroute','rehydrate_missing','verify_prerequisites','authorized_remaining_action']},
    destination:{facets:['destination_entry'],source_contract:'OOP-destination-intake',sequence:['own_identity_adoption','current_canonical_facts','classify_resources','own_access_verification','own_closure','validated','accepted','first_verified_action','resumed']},
  },unknown:'Keep independent facts explicit; no source/target adoption transfer or inferred approval.',
});
save('dist/interfaces.json',{
  enforcement:{artifact:'oop-enforce.js',...enforcementImpact,schemas:wireSchemas,commands:engineConfig.commands,activation_vocabulary:activationVocabulary,input_limit_bytes:1048576,input_timeout_ms:5000,node_baseline:24,encoding:'UTF-8',state_writes:'none',mapping:engineConfig.contracts},
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
save('dist/entry.json',{
  format:1,protocol:'organization-orchestration-protocol',status:'prepared_distribution',
  source_binding:sourceBinding,
  contract_profile:'urn:oop:derived:contract:1',
  authority:'../PROTOCOL.md is canonical. This is derived operational context; source controls conflicts.',
  version:'Record available repository/ref/full containing Git commit from version metadata. Producer source_snapshot is not runtime adoption or a version manifest.',
  source_snapshot:{repository:'https://github.com/organizationorchestrationprotocol/oop.git',ref:'main',content_identity:hash(source),path:'PROTOCOL.md'},
  activation:'Official installation intent starts full_install immediately after required initial explanation; other requests use the applicable lifecycle route.',
  bootstrap_preflight:bootstrapPreflight,
  enforcement:{artifact:'oop-enforce.js',interface_ref:'interfaces.json#enforcement',adoption:'migrations/runtime.json#enforcement',permission:'Adapter observations and actual native prevention remain independently required.'},
  minimum_context:['modules/core.json','modules/workspace.json','modules/context.json','modules/entry.json'],
  migration_index:'migrations/index.json',migration_context:'modules/migration-distribution.json',selector:'routing.json',procedures:{bootstrap:'procedures/bootstrap.json',lifecycle:'procedures/lifecycle.json'},interfaces:'interfaces.json',
  contract_binding:{'$clause':'Evaluate the complete semantic_clause for that dimension, with its exact quantified scope, conditions, exceptions and normative force.',
    '$clause+core':'Evaluate the clause and Core for that dimension. No inferred generic permission or invented fact.',
    actor:'source-qualified actor means the actual actor specified by the complete clause; references do not change ownership.',
    examples:'Source examples remain conditional illustrations, never independent authority.',
    hashes:'Content identities are producer provenance/reference metadata. Consumers do not recompute, compare to Git or certify OOP artifacts.'},
  context:'Union classified semantic facets then dependencies; load only missing/stale selected context. Resolve material unknowns before effects, never infer permission.',
  consumer_exclusion:'Never run maintainer commands, schemas as release tests, OOP repository audits, hashes/signatures/inventories/publisher/TOFU checks during consumer lifecycle. Consumer-local access and necessary post-bootstrap path assurance remain distinct; no active hook tests at bootstrap.',
  runtime:'Select supported existing mechanisms under canonical authority; this package does not install controls, prove provider access or claim Full OOP runtime governance.',
});
save('tools/evidence/release-traceability.json',{
  source_identity:hash(source),source_binding:sourceBinding,source_normalization:'CRLF to LF; explanatory overview and role section headings excluded, document title retained; allocation lines refer to extracted source, contract locators to document lines',review_ref:'tools/release-review.json',
  preservation:'reviewed_current_source; '+review.change_scope.preserved_contracts.length+' unchanged clauses preserved verbatim; '+review.change_scope.changed_contracts.length+' explicit semantic deltas',coverage_complete:true,
  clauses:contracts.map(({span,contract})=>({...span,content_identity:contract.source.content_identity,artifact:`dist/modules/${span.module}.json`,contract:contract.id})),
  modules:indexModules,
  classification:'reviewed_semantic_change; additive official enforcement and bounded adoption',enforcement:review.enforcement,
  current_continuity_delta:review.change_scope.continuity_delta,
  migration_support:{catalog_ref:'tools/release-review.json#migration_support',
    current_declared_profiles:review.migration_support.profiles.map(p=>p.profile_id),
    independently_authenticated_longitudinal_support:'not_verified'},
  semantic_delta:review.change_scope.changed_contracts.map(id=>({id:'DELTA-'+id,contract:id,classification:'semantic_change',summary:review.change_scope.summaries[id],baseline_identity:review.change_scope.baseline_source_identity,source:contracts.find(c=>c.contract.id===id).contract.source,artifact:'dist/modules/'+contracts.find(c=>c.contract.id===id).span.module+'.json',proposals:review.change_scope.proposals,verification:'Current source reconstruction, migration and producer/reference suites; no live interoperability'})),
  migration_artifacts:migrationPaths,
  migration:{descriptor_ref:'dist/migrations/index.json',
    classification:'No common/operations data transformation; refresh and verify affected owned language/commit controls before independent adoption. Preserve credentials and historical commits.',
    existing_state_policy:'Supported profiles and scoped actual evidence govern; no global organization-change inference.',
    recovery:'Retain prior verified adoption and actual partial effects; inspect before retry.'},
});
const expected = modules.flatMap(module => [`dist/modules/${module.id}.json`, `dist/details/${module.id}.json`]).concat([
  'dist/routing.json', 'dist/procedures/bootstrap.json', 'dist/procedures/lifecycle.json',
  'dist/oop-enforce.js', 'dist/interfaces.json', 'dist/entry.json', 'tools/evidence/release-traceability.json', ...migrationPaths.map(p=>'dist/'+p),
]);
const removed = applyArtifacts(root, plan, expected);
process.stdout.write(`Removed ${removed.length} orphan module/detail artifacts${removed.length ? ': '+removed.join(', ') : ''}.\n`);
process.stdout.write(`Generated ${modules.length} modules, ${contracts.length} lossless contracts and BOOT-01–13; ${sourceBinding.kind}; producer acceptance still required.\n`);
