// Maintainer-only generation. Consumers never run this or verify these identities.
import { readFileSync } from 'node:fs';
import { readFileSync as readInstallFile } from 'node:fs';
import { buildManifest,validateManifest } from './enforcement-install.cjs';
import { enforcementConfig, generateEnforcement, impact as enforcementImpact, wireSchemas, configurationSchemas, activationVocabulary } from './enforcement-contract.mjs';
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
  const clause_index={};
  for(const contract of selected)for(const heading of contract.semantic_clause.split('\n')) {
    const id=heading.match(/^### (R\d+) — /)?.[1];if(!id||!['R02','R21','R25','R26'].includes(id))continue;
    if(clause_index[id])throw Error('Ambiguous clause '+id);
    clause_index[id]={contract_id:contract.id,heading};
  }
  const payload = save(`dist/modules/${module.id}.json`,{format:1,id:module.id,contracts:selected,...(Object.keys(clause_index).length?{clause_index}:{})});
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
facets.identity_registry_mutation=['workspace','operations','execution'];
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
// Stable identities: removed IDs (ENTRY-02, BOOT-02, BOOT-09) are never renumbered or reused.
// Facts, actions, ownership and dependencies are keyed by ID, never by table position.
const entryIds=['ENTRY-01','ENTRY-03','ENTRY-04','ENTRY-05','ENTRY-06','ENTRY-07'];
const bootIds=['BOOT-01','BOOT-03','BOOT-04','BOOT-05','BOOT-06','BOOT-07','BOOT-08','BOOT-10','BOOT-11','BOOT-12','BOOT-13'];
const removedIds=['ENTRY-02','BOOT-02','BOOT-09'];
const explicitDependencies={'ENTRY-03':['ENTRY-01'],'BOOT-03':['BOOT-01'],'BOOT-10':['BOOT-08']};
const dependsOn=(ids,id,index)=>explicitDependencies[id]??(index?[ids[index-1]]:[]);
const bootstrapPreflight={format:1,source_contract:preflightContract.id,source:preflightContract.source,
  steps:preflightRows.map((row,index)=>{
    const cells=row.split('|').slice(1,-1).map(cell=>cell.trim());
    const [id,refs,instruction,observations]=cells;
    if(cells.length!==4 || id!==entryIds[index] || !refs || !instruction || !observations)
      throw new Error('Invalid reviewed preflight row');
    return {id,source_refs:refs.split('; '),instruction,depends_on:dependsOn(entryIds,id,index),
      guard:{all:observations.split(', ').map(fact=>({fact}))}};
  })};
if(bootstrapPreflight.steps.length!==entryIds.length) throw new Error('Incomplete canonical remote entry preflight');
const stepFacts = {
  'BOOT-01':['scoped_install_intent'],
  'BOOT-03':['bootstrap_context_available','full_install_entered'],
  'BOOT-04':['version_metadata_recorded','release_checks_not_performed'],
  'BOOT-05':['private_root_protected'],
  'BOOT-06':['project_source_resolved'],
  'BOOT-07':['source_access_classified'],
  'BOOT-08':['current_project_common_private_reference_verified','credential_origin_exclusive','selected_credential_authority_verified','credential_files_in_common_private_area'],
  'BOOT-10':['operations_identity_resolved'],
  'BOOT-11':['operations_runtime_read_verified','operations_runtime_write_verified','commit_attribution_disposition_verified','selected_effective_credential_verified','configuration_origin_verified','common_private_credential_files_used'],
  'BOOT-12':['complete_initial_inventory','frozen_initial_installation_set','installed_enforcement'],
  'BOOT-13':['scoped_readiness_evidence_persisted','installation_prerequisites_verified','independent_bootstrap_prerequisites_complete','readiness_evidence_current','identity_registration_commit_verified','identity_registration_content_verified','identity_registration_publication_verified','final_publication_checkpoint_persisted','selected_effective_credential_verified','installed_enforcement'],
};
const actions={'BOOT-01':'interpret_install','BOOT-03':'load_and_start','BOOT-04':'record_version_only','BOOT-05':'protect_private_root',
  'BOOT-06':'resolve_project_source_or_ask_once','BOOT-07':'discover_source_access','BOOT-08':'prepare_or_reuse_credentials',
  'BOOT-10':'discover_create_or_request_operations','BOOT-11':'verify_operations_access','BOOT-12':'complete_administrative_installation','BOOT-13':'register_identity_and_persist_local_readiness'};
const effectOwners={'BOOT-10':'organization','BOOT-13':'organization'};
// Step-specific reviewed boundaries; the complete source row remains authoritative.
const stepDetails={
  'BOOT-12':{binding_plan:{manifest_ref:'../enforcement-install.json',precondition:'complete_initial_inventory_and_frozen_package',
    mandatory_context:['../modules/capabilities.json','../modules/workspace.json'],
    context_receipt:{scope:'session_request',checkpoint:'reference_only',fields:['session','workspace','installation_uid','source_binding','mapping_revision','modules'],content_identity:'published_metadata_only_no_consumer_rehash',assurance:'loaded_context_not_comprehension'},
    pre_materialization_checklist:[
      {id:'BRIDGE-CHECK-LOCATION',rule:'modules/workspace.json#R02',checkpoint_field:'bridge_entrypoint'},
      {id:'BRIDGE-CHECK-LANGUAGE',rule:'modules/capabilities.json#R21',checkpoint_field:'selected_shell'},
      {id:'BRIDGE-CHECK-NAME',rule:'modules/capabilities.json#R25',checkpoint_field:'bridge_entrypoint'},
      {id:'BRIDGE-CHECK-SINGLE',rule:'modules/capabilities.json#R21',checkpoint_field:'validation_result'},
      {id:'BRIDGE-CHECK-FAILURE',rule:'modules/capabilities.json#R21',checkpoint_field:'validation_result'}
    ].map(c=>({...c,validated_by:'validate-configuration'})),
    validation:{command:'validate-configuration',result_field:'validation_result',before:'any_native_registration',guard:'valid_true_error_false_matching_source_plan_revision_and_current_observations',recheck:'inside_conditional_registration_boundary'},
    sequence:['reuse_bounded_inventory','load_required_session_context_and_record_receipt','resolve_pre_materialization_checklist','freeze_complete_materialized_initial_package','validate_exact_configuration_plan','install_or_reuse_every_eligible_mechanism','obtain_direct_administrative_acknowledgments','resolve_required_native_consents_and_restart','persist_scoped_checkpoint'],
    coverage_reassessment:false,active_hook_tests:0,on_changed_dependencies:'reconcile_real_dependency_only_without_installation_chat_logic_rewrite'}},
  'BOOT-06':{fact_basis:{project_source_resolved:{any_of:['source_reference_from_priv','source_reference_user_provided_persisted'],
      never:['autonomous_discovery','ambient_remote_inference','local_checkout_inference','proposed_candidate']}},
    human_question:{ask:'once',answers:['source_or_product_repository_address','not_applicable'],resume_condition:'answer_received_and_reference_persisted'},
    branch_overrides:{absent:'Ask the user once; never discover, infer or propose a candidate.',
      unknown:'Do not discover or infer; ask the user once.'}},
  'BOOT-10':{human_request:{consolidated:true,max_requests:1,
      contents:['operations_creation_or_access_grant','authentication_public_key_and_fingerprint_from_common_private_file',
        'signing_public_key_and_fingerprint_from_common_private_file_when_signature_acceptance_requires_registration','discovered_provider_steps'],
      never:['private_key','token','secret','replacement_repository'],confirmation_is_evidence:false,
      resume_condition:'rediscovery_and_BOOT-11_verification_observed'}},
};
const bootstrapRows = source.split('\n').filter(x=>/^\| \*\*BOOT-\d+\*\*/.test(x)).map(x=>x.match(/^\| \*\*(BOOT-\d+)\*\*/)[1]);
if (JSON.stringify(bootstrapRows)!==JSON.stringify(bootIds) || removedIds.some(id=>source.includes(`| **${id}** |`) || source.includes(`| ${id} |`)))
  throw new Error('Incomplete canonical BOOT sequence');
const bootstrapSteps=bootIds.map((id,index)=>{
  const {branch_overrides,...details}=stepDetails[id]??{};
  return {id,actor:'active_runtime',
    effect_owner:effectOwners[id]??'runtime',action:actions[id],depends_on:dependsOn(bootIds,id,index),
    source_contract:'OOP-full-install',source_row:index+1,guard:{all:stepFacts[id].map(fact=>({fact}))},
    guard_scope:'$clause+core',
    ...details,
    observation:{required_fields_ref:'#observation_fields',never_sufficient:id==='BOOT-12'?['model_assertion','plan_only','historical_status_only']:['user_confirmation','model_assertion','command_exit_zero']},
    branches:{existing:'Reuse current scoped evidence.',absent:'Provision only if absent, needed, authorized.',
      unavailable:'Authorized alternatives; retain exact gap.',unknown:'Resolve facts; block dependent effects.',
      ...branch_overrides},
    wait:'Keep dependency, observable resume, partial effects, safe work.',
    failure:'Keep checkpoint/partial effects; authorized repair only.',
    resume:'Reconcile actual effects; retry authorized remainder only.',
    continuation_ref:'#continuation',restart_ref:'#restart',
    communication:'User language: purpose, result, required human action.',
  };
});
const bootstrapData={
  format:7,id:'full-install',preflight_ref:'../entry.json#bootstrap_preflight',source_contracts:['OOP-full-install','OOP-bootstrap-system','OOP-bootstrap-communication','OOP-bootstrap-attestation'],
  observation_fields:evidenceFields,
  removed_step_ids:removedIds,
  installation_contract:2,metadata:['installation_chat_id','installation_completed_at','recognized_at'],
  states:['installation_verified','installed','pending','attempted','observed','applied_pending_verification','verified','recovering','waiting_human','waiting_external','unsupported'],
  phase_distinctions:'Eligibility is not authority or execution. Applied/verified and runtime/organization ownership remain distinct.',
  continuation:'Verify authenticated applicable answer/result and invalidated prerequisites on a real host continuation event. Waiting is nonterminal; continue safe independent work. If new user activation is needed, give precise portable reentry instructions; never promise unsupported automatic wakeup. Inspect actual effects before repeating non-idempotent work.',
  restart:'Only for a verified actual restart dependency: persist current project/runtime/OOP checkpoint, expected state, partial effects, remaining steps and verification; explain supported restart/reentry steps. Reconcile effects and revalidate invalidated controls after observable reentry; never invent commands.',
  steps:bootstrapSteps,
  transitions:[
    {from:'verified',to:'installation_verified',requires:['verified:BOOT-12','installed_enforcement']},
    {from:'verified',to:'installed',requires:['verified:BOOT-13','independent_bootstrap_prerequisites_complete','scoped_readiness_evidence_persisted','identity_registration_commit_verified','identity_registration_content_verified','identity_registration_publication_verified','final_publication_checkpoint_persisted','selected_effective_credential_verified','installed_enforcement']},
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
  installation:{status:'PENDING',terminal_status:'INSTALLED',effect_permission:'not_granted',
    action:'verify_local_installation_then_register_identity',active_hook_tests:0,producer_tests:0,max_attempts:2,
    requires:['verified:BOOT-12','installed_enforcement'],
    enforcement_complete_after:'BOOT-12',installation_complete_after:'BOOT-13',bootstrap_complete_after:'BOOT-13',publication:'mandatory_identity_registration_only',
    next:'Accept user requests only after complete installation; independently admit each protected effect.',
    full_readiness_guard_ref:'#steps/'+bootIds.indexOf('BOOT-13')+'/guard',
    statuses:['PENDING','INSTALLED','BLOCKED','UNSUPPORTED'],
    enforcement_assurance:'ADMINISTRATIVELY_INSTALLED',
    assurance_statuses:['PENDING','ADMINISTRATIVELY_INSTALLED'],
    assurance_basis:'C/U/R/E direct administrative results; empirical behavior unmeasured. Reconcile legacy receipts without tests.',
    manual_setup:'BOOT-06 source question, BOOT-10 consolidated request, each necessary native consent in the frozen package, or actual required restart; report other exact authority gaps.'},
  compatibility:{before:{format:6,steps:bootIds.length},after:{format:7,steps:bootIds.length},
    disposition:'adapter_required',historical_statuses:['INSTALLED_UNVERIFIED','installed_unverified','ACTIVE_VERIFIED','INSTALLED'],
    obsolete_phases:{'BOOT-02':'NOT_REQUIRED','BOOT-09':'NOT_REQUIRED'},
    obsolete_phase_policy:'Readable history only; never invalidates or satisfies a surviving step.',
    promotion:'No status-only promotion: verify installation, identity registration content/commit, remote publication and checkpoint.'},
  completion:'BOOT-12 verifies installation; BOOT-13 registers its machine and nested runtime identity and checkpoints remote commit/ref. Pending publication preserves installation; resume publication only. No native trials/release tests.',
};
// Lossless projection: one shared default object, with explicit per-step exceptions.
const sharedStepKeys=['guard_scope','observation','branches','wait','failure','resume','continuation_ref','restart_ref','communication'];
bootstrapData.step_defaults=Object.fromEntries(sharedStepKeys.map(k=>[k,bootstrapSteps[0][k]]));
bootstrapData.step_default_resolution='For each step, inherit omitted fields from step_defaults; explicit fields replace the whole default field. defaults_ref must equal #step_defaults. These references preserve all step instructions.';
bootstrapData.steps=bootstrapSteps.map(step=>Object.fromEntries(Object.entries({...step,defaults_ref:'#step_defaults'}).filter(([k,v])=>!sharedStepKeys.includes(k)||JSON.stringify(v)!==JSON.stringify(bootstrapData.step_defaults[k]))));
save('dist/procedures/bootstrap.json',bootstrapData);
const engineConfig=enforcementConfig({sourceBinding,routing:routingData,contracts,bootstrap:bootstrapData,migrations});
plan.push({path:'dist/oop-enforce.js',content:generateEnforcement(engineConfig,review.enforcement)});
save('dist/procedures/lifecycle.json',{
  format:1,routes:{
    first_install:{facets:['full_install'],procedure:'bootstrap.json'},
    interaction:{facets:['interaction'],assurance:'Reuse current administrative completion; no dispatch-proof prerequisite or per-session artificial tests. Unresolved actual administrative dependency or observed failures block dependent effects only.',sequence:['identity_binding','shared_language_preference_inspection','language_source_discovery','presentation_language_resolved','protected_shared_preference_persistence','valid_context','due_checks_only','classify','union_closure','applicable_gates','response_or_effect','completion']},
    adoption:{facets:['due_update'],source_contract:'OOP-runtime-adoption',migration_index:'../migrations/index.json',migration_module:'migration-distribution',sequence:['availability','compatibility','target','authorization','migration_contract_ordered_or_current_supported_state','independent_common_runtime_operations','owned_remaining_actions','verification','atomic_owned_checkpoint','knowledge_realignment']},
    migration:{facets:['organizational_migration'],source_contract:'OOP-organizational-migration',sequence:['inspect_canonical_revision_and_actual_state','interpret_explicit_state_change_and_scope','reader_writer_compatibility','exclusive_authority_when_required','remaining_actions_only','verify_result','canonical_record']},
    recovery:{facets:['context_loss'],source_contracts:['OOP-asynchronous-recovery','OOP-available-context'],sequence:['resolve_owned_checkpoint','actual_effects','due_freshness','reroute','rehydrate_missing','verify_prerequisites','authorized_remaining_action']},
    destination:{facets:['destination_entry'],source_contract:'OOP-destination-intake',sequence:['own_identity_adoption','current_canonical_facts','classify_resources','own_access_verification','own_closure','validated','accepted','first_verified_action','resumed']},
  },unknown:'Keep independent facts explicit; no source/target adoption transfer or inferred approval.',
});
const installManifest=buildManifest(sourceBinding,['OOP-enforcement-autonomy','OOP-transitions-routing','OOP-runtime-adoption','OOP-capability-lifecycle','OOP-free-first','OOP-full-install','OOP-bootstrap-system','OOP-delegate-governance'].map(id=>{
  const c=contracts.find(c=>c.contract.id===id);return {id,artifact:'modules/'+c.span.module+'.json',source:c.contract.source};
}));
if(review.enforcement.installation_identity!==hash(readInstallFile(new URL('./enforcement-install.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')) ||
  review.enforcement.planner_identity!==hash(readInstallFile(new URL('./install-plan.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')))throw Error('Stale reviewed installation implementation');
const installErrors=validateProfile(installManifest,JSON.parse(readFileSync(new URL('./schemas/enforcement-install.schema.json',import.meta.url),'utf8')));
if(installErrors.length || !validateManifest(installManifest,sourceBinding))throw Error('Invalid complete installation manifest: '+installErrors.join(', '));
save('dist/enforcement-install.json',installManifest);
save('dist/installation-contract.json',{format:1,source_binding:sourceBinding,source_contracts:['OOP-private-boundary','OOP-ticket-lifecycle','OOP-capability-lifecycle','OOP-organizational-migration'],identity_schema:JSON.parse(readFileSync(new URL('./schemas/installation-identity.schema.json',import.meta.url),'utf8')),mutation:{field:'organizational_mutation',required_for:['ticket_mutation','identity_registry_mutation'],input:['proposal','observation'],prior_state:'Privileged current canonical revision, same-ticket snapshots and selected lineage; backend conditional write and readback remain mandatory.',authoring:'previous/reconstruct are separate from nonmutating validateMutation; publishMutation revalidates in a conditional backend boundary.',identity:'Version-2 machine record with public identity, owner/kind and nested runtimes; local checkpoints retain technical state.',legacy:'Legacy format-1 records are readable but current-write-ineligible; group only with authoritative credential/machine evidence, preserve ticket bytes and independent checkpoints; old writers blocked.'},configuration:{bridge:'one active oop-enforce-bridge with the selected native-shell default extension per runtime/workspace/host',maintenance:'Typed bridge_maintenance and current independently observed local declaration; exact bridge/state/candidate effects only, no Git/network; CAS exit after administrative reconciliation',documentation:'official installed-version/actual-host evidence',minimum:'narrow scope, necessary base and host declarations, one sufficient source; preserve unrelated content',assurance:'administrative only, never synthetic dispatch certification'},limits:['supplied privileged observations are not authenticated by predicates','no installed runtime or provider interoperability demonstrated']});
save('dist/interfaces.json',{
  installation_contract:{artifact:'installation-contract.json',format:1,mutation_field:'organizational_mutation',validation:'official controller and independently authenticated backend adapter'},
  installation_binding:{artifact:'enforcement-install.json',schema:'../tools/schemas/enforcement-install.schema.json',format:4,installation_contract:2,administrative_extensions:{version:1,inventory:'authenticated_phase_and_candidate_assessments',coverage:'independent_of_inventory_completeness',receipt_history:'durable_with_matching_scope_and_dependencies',native_acknowledgment:'host_owned_node_file_write_fulfillment_v1',negative_fields:'optional_only_with_correlated_native_success',effect_authority:'independently_current'},interface_impact:'INTERFACE_CHANGED',planner:'planInstallation',freeze:'freezeInstallation',completion:'installationState',wrapper_evolution:'wrapperEvolution',reference_implementation:'../tools/installation-lifecycle.cjs',legacy_planner:'planBindings is partial-input planning only',bootstrap_guard:'installed_enforcement'},
  enforcement:{artifact:'oop-enforce.js',...enforcementImpact,schemas:wireSchemas,administrative_commands:{'validate-configuration':{schemas:configurationSchemas,exit_statuses:{valid:0,invalid:2,error:4},effect_permission:'not_granted'}},commands:engineConfig.commands,activation_vocabulary:activationVocabulary,input_limit_bytes:1048576,input_timeout_ms:5000,node_baseline:24,encoding:'UTF-8',state_writes:'none',mapping:engineConfig.contracts},
  format:1,delivery:'Abstract interoperable contract; native/local interfaces suffice. No mandatory Node, MCP, CEL or hosted service.',
  request:{fields:['id','workspace','runtime','intent','target','purpose','effect_class','permitted_scope','authority_ref','expected_prior_state','dependencies','verification_criteria']},
  result:{fields:['request_id','attempt','observations','actual_effects','verification','evidence_refs','failure','blockers','next_action'],
    distinctions:['not_attempted','attempted','observed','applied_pending_verification','verified','failed','unknown']},
  evidence:{fields:evidenceFields,authority:'A supplied fact requires independent attributable scope-bound evidence; shape or a true boolean is not proof.'},
  capabilities:['repository.discover','repository.read','repository.create','repository.configure','repository.write','repository.permission.inspect','secret.storage','context.retrieve','context.assemble','checkpoint.persist','control.probe'],
  checkpoints:{ownership:['shared_project_references','runtime_owned_adoption_integration','canonical_organization'],
    cardinality:'One authoritative logical current adoption checkpoint per initialized workspace/persistent-runtime key; zero before initialization, no competing current authority.',
    discovery:'Resolve authorized topology mapping before adoption discovery or creation; unknown ownership blocks dependent scope, never creates a session-derived fallback.',
    session_scope:['session','request_scope','action_scope','context_retention'],
    fields:['project_identity','runtime_identity_when_owned','checkpoint_ref','checkpoint_revision','mapping_revision','intent','attempt','observations','completed_remaining','dependencies','verification','next_action'],
    write:'Use applicable expected-revision/concurrency and atomic persistence; atomic rename alone does not prevent lost updates.',
    reuse:'Require exact relevant dependencies and current ownership/freshness; workspace switch invalidates active project state.'},
  prohibitions:['raw_secret_values','ambient_foreign_authority','invented_observations','schema_as_truth','release_validation_during_consumer_lifecycle'],
});
const opening = preflightContract.semantic_clause.match(/\*\*ENTRY-INSTRUCTION-01:\*\*\n\n([\s\S]+?)\n\n\| Stage /);
if (!opening || (preflightContract.semantic_clause.match(/\*\*ENTRY-INSTRUCTION-\d+:\*\*/g)??[]).length!==1)
  throw new Error('Missing or duplicate canonical opening language instruction');
save('dist/entry.json',{
  instructions:[{id:'ENTRY-INSTRUCTION-01',instruction:opening[1]}],
  format:1,protocol:'organization-orchestration-protocol',status:'prepared_distribution',
  source_binding:sourceBinding,
  contract_profile:'urn:oop:derived:contract:1',
  authority:'../PROTOCOL.md is canonical for maintainers; consumers never read it and resolve conflicts through the complete derived semantic_clause text.',
  version:'Record repository/ref/full containing commit from version metadata; source_snapshot is not adoption or a version manifest.',
  source_snapshot:{repository:'https://github.com/organizationorchestrationprotocol/oop.git',ref:'main',content_identity:hash(source),path:'PROTOCOL.md'},
  activation:'Official installation intent starts full_install immediately after required initial explanation; other requests use the applicable lifecycle route.',
  bootstrap_preflight:bootstrapPreflight,
  enforcement:{artifact:'oop-enforce.js',installation_manifest:'enforcement-install.json',installation_contract:'installation-contract.json',interface_ref:'interfaces.json#enforcement',adoption:'migrations/runtime.json#enforcement',permission:'Authoritative formal installation and effective enablement suffice for normative functioning; independent authorization, real failure propagation and effect verification remain required.'},
  minimum_context:['modules/core.json','modules/workspace.json','modules/context.json','modules/entry.json'],
  migration_index:'migrations/index.json',migration_context:'modules/migration-distribution.json',selector:'routing.json',procedures:{bootstrap:'procedures/bootstrap.json',lifecycle:'procedures/lifecycle.json'},interfaces:'interfaces.json',
  contract_binding:{'$clause':'Evaluate the complete semantic_clause for that dimension, with its exact quantified scope, conditions, exceptions and normative force.',
    '$clause+core':'Evaluate the clause and Core for that dimension. No inferred generic permission or invented fact.',
    actor:'source-qualified actor means the actual actor specified by the complete clause; references do not change ownership.',
    examples:'Source examples remain conditional illustrations, never independent authority.',
    hashes:'Content identities are producer provenance/reference metadata. Consumers do not recompute, compare to Git or certify OOP artifacts.'},
  context:'Union classified semantic facets then dependencies; load only missing/stale selected context. Resolve material unknowns before effects, never infer permission.',
  consumer_exclusion:'Never read PROTOCOL.md. Never run maintainer commands, schemas as release tests, OOP repository audits, hashes/signatures/inventories/publisher/TOFU checks during consumer lifecycle. Templates under dist/templates are consumer material, not maintainer commands. Consumer-local access and formal enablement remain required; no dispatch-proof prerequisite or active bootstrap hook tests.',
  runtime:'Select supported existing mechanisms under canonical authority; this package does not install controls, prove provider access or claim Full OOP runtime governance.',
});
save('tools/evidence/release-traceability.json',{
  source_identity:hash(source),source_binding:sourceBinding,source_normalization:'CRLF to LF; explanatory overview and role section headings excluded, document title retained; allocation lines refer to extracted source, contract locators to document lines',review_ref:'tools/release-review.json',
  preservation:'reviewed_current_source; '+review.change_scope.preserved_contracts.length+' unchanged clauses preserved verbatim; '+review.change_scope.changed_contracts.length+' explicit semantic deltas',coverage_complete:true,
  clauses:contracts.map(({span,contract})=>({...span,content_identity:contract.source.content_identity,artifact:`dist/modules/${span.module}.json`,contract:contract.id})),
  modules:indexModules,
  classification:'reviewed_semantic_change; '+review.change_scope.classification,enforcement:review.enforcement,
  current_continuity_delta:review.change_scope.continuity_delta,
  migration_support:{catalog_ref:'tools/release-review.json#migration_support',
    current_declared_profiles:review.migration_support.profiles.map(p=>p.profile_id),
    independently_authenticated_longitudinal_support:'not_verified'},
  semantic_delta:review.change_scope.changed_contracts.map(id=>({id:'DELTA-'+id,contract:id,classification:review.change_scope.classifications?.[id]??'semantic_change',summary:review.change_scope.summaries[id],baseline_identity:review.change_scope.baseline_source_identity,source:contracts.find(c=>c.contract.id===id).contract.source,artifact:'dist/modules/'+contracts.find(c=>c.contract.id===id).span.module+'.json',proposals:review.change_scope.proposals,verification:'Current source reconstruction, migration and producer/reference suites; no live interoperability'})),
  migration_artifacts:migrationPaths,
  migration:{descriptor_ref:'dist/migrations/index.json',
    classification:review.change_scope.compatibility+' '+review.change_scope.continuity_delta,
    existing_state_policy:'Supported profiles and scoped actual evidence govern; no global organization-change inference.',
    recovery:'Retain prior verified adoption and actual partial effects; inspect before retry.'},
});
const templatePaths=['templates/oop-enforce-bridge.ps1','templates/oop-enforce-bridge.sh'];
for(const path of templatePaths)plan.push({path:'dist/'+path,content:readFileSync(new URL('./'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n').replaceAll('@@SOURCE_IDENTITY@@',sourceBinding.source_identity)});
const expected = modules.flatMap(module => [`dist/modules/${module.id}.json`, `dist/details/${module.id}.json`]).concat([
  'dist/routing.json', 'dist/procedures/bootstrap.json', 'dist/procedures/lifecycle.json',
  'dist/installation-contract.json', 'dist/enforcement-install.json', 'dist/oop-enforce.js', 'dist/interfaces.json', 'dist/entry.json', 'tools/evidence/release-traceability.json', ...migrationPaths.map(p=>'dist/'+p),...templatePaths.map(p=>'dist/'+p),
]);
const removed = applyArtifacts(root, plan, expected);
process.stdout.write(`Removed ${removed.length} orphan module/detail artifacts${removed.length ? ': '+removed.join(', ') : ''}.\n`);
process.stdout.write(`Generated ${modules.length} modules, ${contracts.length} lossless contracts and ${bootIds.length} BOOT steps (${bootIds.join(', ')}); ${sourceBinding.kind}; producer acceptance still required.\n`);
