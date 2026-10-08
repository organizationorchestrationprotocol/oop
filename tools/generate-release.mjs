// Maintainer-only generation. Consumers never run this or verify these identities.
import { readFileSync } from 'node:fs';
import { readFileSync as readInstallFile } from 'node:fs';
import { buildManifest,validateManifest } from './enforcement-install.cjs';
import { enforcementConfig, generateEnforcement, interfaceDescription, wireSchemas, configurationSchemas, coordinationSchemas, coordinationCommands, activationVocabulary, activationDefaults } from './enforcement-contract.mjs';
import { moduleSemantics, routingDirective, useLimit, runtimeIndexBudgetBytes, statusLineBudgetBytes } from './module-semantics.mjs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { modules, spans } from './release-plan.mjs';
import { closure } from './reference-engine.mjs';
import { validateProfile } from './schema-profile.mjs';
import { applyArtifacts,writeEvidence } from './prune-artifacts.mjs';
import { migrationBundle, validateMigrationBundle } from './migration-contract.mjs';
import { protocolSource, protocolSourceLocator } from './acceptance-inputs.mjs';
import {contextRuntime} from './context-runtime.cjs';
import { contextInterface, contextManifest } from './context-contract.mjs';
import { composeRuntimeInstructions, runtimeOperationalRules, renderMandatoryProcedures, verifyMandatoryView } from './runtime-instructions.cjs';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const document = readFileSync(new URL('../PROTOCOL.md', import.meta.url), 'utf8');
export const source = protocolSource(document);
const review = JSON.parse(readFileSync(new URL('./release-review.json', import.meta.url), 'utf8'));
if (review.source_identity !== hash(source)) throw new Error('Source changed: complete semantic review and bound span update required');
if (JSON.stringify(review.spans.map(({content_identity,...x}) => x)) !== JSON.stringify(spans)) throw new Error('Unreviewed allocation change');
if (JSON.stringify(review.modules)!==JSON.stringify(modules)) throw new Error('Unreviewed module semantics/dependencies');
if (JSON.stringify(review.module_semantics)!==JSON.stringify(moduleSemantics)) throw new Error('Unreviewed operational routing semantics');
// R26.1: module-specific routing semantics; identical generic text cannot satisfy the index requirement.
for (const field of ['use','conditions','preconditions','postconditions']) {
  const values = modules.map(module => moduleSemantics[module.id]?.[field]);
  if (values.some(value => typeof value !== 'string' || !value.trim()) || new Set(values).size !== modules.length) throw new Error('Missing or non-specific module '+field);
}
if (modules.some(module => moduleSemantics[module.id].use.length > useLimit)) throw new Error('Routing use statement exceeds limit');
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
if (args.length && !(args.length===1 && args[0]==='--reference-fixtures')) throw new Error('Use --reference-fixtures or no arguments');
const referenceOnly=args.length===1;
// Reviewed source-content binding is deterministic before and after the containing commit.
// Acceptance checks every current committed input and actual HEAD independently of ancestry.
const sourceBinding = {kind:'source_content',source_identity:hash(source)};
const pointerSource=readFileSync(new URL('./templates/native-instruction-pointer.md',import.meta.url),'utf8').replace(/\r\n/g,'\n');
for(const key of ['oop','profiles'])if(pointerSource.includes(runtimeOperationalRules(key)))throw Error('Mandatory procedure in activation pointer: '+key);
const plan = [];
function save(path,data) {
  const content = JSON.stringify(data)+'\n';
  plan.push({path,content});
  return {path:path.replace(/^dist\//,''),content_identity:hash(content)};
}
const migrations=migrationBundle(hash(source),review.migration,'OOP-migration-distribution');
validateMigrationBundle(migrations,JSON.parse(readFileSync(new URL('./schemas/migration.schema.json',import.meta.url))),hash(source));
for(const [path,data] of Object.entries(migrations)) save('dist/'+path,data);
const indexModules = modules.map(module => {
  const selected = contracts.filter(x=>x.span.module===module.id).map(x=>x.contract);
  const clause_index={};
  for(const contract of selected)for(const heading of contract.semantic_clause.split('\n')) {
    const id=heading.match(/^### (R\d+) — /)?.[1];if(!id||!['R02','R20','R24','R25','R28'].includes(id))continue;
    if(clause_index[id])throw Error('Ambiguous clause '+id);
    clause_index[id]={contract_id:contract.id,heading};
  }
  const payload = save(`dist/modules/${module.id}.json`,{format:1,id:module.id,contracts:selected,...(Object.keys(clause_index).length?{clause_index}:{})});
  const detail = save(`dist/details/${module.id}.json`,{
    id:module.id,purpose:module.purpose,use:moduleSemantics[module.id].use,triggers:module.facets,
    semantic_conditions:moduleSemantics[module.id].conditions,
    effect_action_classes:module.facets,defaults_ref:'../routing.json#detail_defaults',
    dependencies:module.dependencies,
    mandatory_preconditions:moduleSemantics[module.id].preconditions,
    postconditions_verification:moduleSemantics[module.id].postconditions,
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
  format:1,algorithm:'union(request,action,state,risk,authority,recovery) -> deterministic dependency closure',
  producer_binding:{source_identity:hash(source),evidence_ref:'../tools/evidence/release-traceability.json'},
  classification:'Semantic effective scope, not keywords, endpoints or automatic level/module table.',
  default:['entry'],modules:indexModules,facets,
  detail_defaults:{lifecycle_phases:['entry','interaction','pre_effect','post_effect','completion','recovery'],
    resources:'Only resources applicable under the source-qualified scope; current-project boundary applies.',
    reads:'Applicable source/organizational/private references only.',writes:'Only source-permitted authorized scope; selection grants no write.',
    risk_authority_conditions:'Core proportionality and independent current authority; source-qualified stronger gates remain.',
    escalation_signals:['material_scope_change','unknown_material_fact','new_effect','changed_authority'],
    context_invalidating_conditions:['workspace','runtime','adopted_identity','route','source_content','authority','relevant_state','capability','retention'],
    resolution:'A detail record inherits each omitted field from detail_defaults; semantic_scope is its use statement.'},conservative:modules.filter(x=>x.id!=='producer').map(x=>x.id),
  unknown:'Load sufficient conservative context to resolve material uncertainty before dependent effects; unknown selectors fail, no authority granted.',
  escalation:'Reclassify actual proposed actions, newly discovered scope and relevant state before effects; revisit final scope at completion.',
  level_policy:'G0/G1 need no artificial managed record; G2-G4 preserve source-defined managed facts. Remote transport alone is not G3.',
  producer_facet:'oop_maintenance is for separately authorized maintenance only; never consumer activation.',
};
save('dist/routing.json',routingData);
// R26.1 compact runtime projection: derived metadata, not a module and not authority.
const consumerModules=modules.filter(module=>module.id!=='producer');
const moduleFacets=new Set(consumerModules.flatMap(module=>module.facets));
const otherFacets=Object.keys(facets).filter(facet=>!moduleFacets.has(facet)&&facet!=='oop_maintenance').sort();
const indexText=['OOP ROUTING INDEX (derived from reviewed module semantics; guidance, not authority)',
  ...consumerModules.map(module=>'- '+module.id+' ['+module.facets.join(',')+']: '+moduleSemantics[module.id].use),
  'Other facets: '+otherFacets.join(','),routingDirective].join('\n');
const indexBytes=Buffer.byteLength(indexText,'utf8');
if(indexBytes>runtimeIndexBudgetBytes) throw new Error('Runtime routing index exceeds measured budget');
const runtimeIndex={fingerprint:hash(indexText),text:indexText};
save('dist/index.json',{format:1,type:'oop_runtime_routing_index',authority:'Regenerable derived metadata; complete semantic clauses remain authoritative.',
  producer_binding:{source_identity:hash(source)},fingerprint:runtimeIndex.fingerprint,bytes:indexBytes,
  budgets:{runtime_index_bytes:runtimeIndexBudgetBytes,status_line_bytes:statusLineBudgetBytes,use_characters:useLimit},directive:routingDirective,
  delivery:'Complete text at session entry, after reported compaction/restoration/context loss, on fingerprint change and while context is stale; otherwise one status line.',
  modules:consumerModules.map(module=>module.id),
  text:indexText});
const evidenceFields=['scope','source_identity','observed_at','expected','actual','supported_facts','provenance','dependencies'];
// Bounded pre-clone projection: reviewed canonical table, never a parallel policy text.
const preflightContract=contracts.find(x=>x.contract.id==='OOP-full-install').contract;
const preflightRows=preflightContract.semantic_clause.split('\n').filter(row=>/^\| ENTRY-\d+ \|/.test(row));
// Stable identities: gaps are intentional and are never filled or reused.
// Facts, actions, ownership and dependencies are keyed by ID, never by table position.
const entryIds=['ENTRY-01','ENTRY-02','ENTRY-03','ENTRY-04','ENTRY-05','ENTRY-06'];
const bootIds=['BOOT-01','BOOT-02','BOOT-03','BOOT-04','BOOT-05','BOOT-06','BOOT-07','BOOT-08','BOOT-09','BOOT-10','BOOT-11'];
const explicitDependencies={'ENTRY-02':['ENTRY-01'],'BOOT-02':['BOOT-01'],'BOOT-08':['BOOT-07']};
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
  'BOOT-02':['bootstrap_context_available','full_install_entered'],
  'BOOT-03':['version_metadata_recorded'],
  'BOOT-04':['private_root_protected'],
  'BOOT-05':['project_source_resolved'],
  'BOOT-06':['source_access_classified'],
  'BOOT-07':['current_project_common_private_reference_verified','credential_origin_exclusive','selected_credential_authority_verified','credential_files_in_common_private_area'],
  'BOOT-08':['operations_identity_resolved'],
  'BOOT-09':['operations_local_path_verified','operations_runtime_read_verified','operations_runtime_write_verified','commit_attribution_disposition_verified','selected_effective_credential_verified','configuration_origin_verified','common_private_credential_files_used'],
  'BOOT-10':['complete_initial_inventory','frozen_initial_installation_set','installed_enforcement'],
  'BOOT-11':['scoped_readiness_evidence_persisted','installation_prerequisites_verified','independent_bootstrap_prerequisites_complete','readiness_evidence_current','identity_registration_commit_verified','identity_registration_content_verified','identity_registration_publication_verified','final_publication_checkpoint_persisted','selected_effective_credential_verified','installed_enforcement'],
};
const actions={'BOOT-01':'interpret_install','BOOT-02':'load_and_start','BOOT-03':'record_version_only','BOOT-04':'protect_private_root',
  'BOOT-05':'resolve_project_source_or_ask_once','BOOT-06':'discover_source_access','BOOT-07':'prepare_or_reuse_credentials',
  'BOOT-08':'discover_create_or_request_operations','BOOT-09':'verify_operations_access','BOOT-10':'complete_administrative_installation','BOOT-11':'register_identity_and_persist_local_readiness'};
const effectOwners={'BOOT-08':'organization','BOOT-11':'organization'};
// Step-specific reviewed boundaries; the complete source row remains authoritative.
const stepDetails={
  'BOOT-10':{binding_plan:{manifest_ref:'../enforcement-install.json',precondition:'complete_initial_inventory_and_frozen_package',
    mandatory_context:['../modules/capabilities.json','../modules/workspace.json'],
    context_receipt:{scope:'session_request',checkpoint:'reference_only',fields:['session','workspace','installation_uid','source_binding','mapping_revision','modules'],content_identity:'published_metadata_only_no_consumer_rehash',assurance:'loaded_context_not_comprehension'},
    adapter_development:{rule:'../modules/capabilities.json#R20',
      entry_precondition:'mandatory_OOP_entry_and_minimum_ownership_path_checks',
      sequence:['copy-template','dist-context','controller-read','template-comments-read','official-documentation-read','implementation','installation'],
      preparation:'first_six_stages_in_adapter_preparation.workflow_before_freeze',
      preparation_contract:{plan_field:'adapter_preparation',fields:['source','workflow','obligations'],
        workflow:{inputs:{controller:['reference','identity'],template:['reference','identity'],working_copy:'absolute_inert_owned_candidate_path',context:'nonempty_array_of_reference_identity',documentation:'current_official_sources'},
          candidate_identity:'configurationIdentity(adapter_preparation.source)',
          stages:'six_ordered_objects_with_step_reference_assurance'},
        assurance:['runtime_declaration','native_observation'],
        observation_fields:['adapter_preparation_inputs','adapter_preparation_verified','adapter_preparation_observations','preparation_working_copy'],
        working_copy_observation:{fields:['locator','owned','inert','safe_active_preserved','safe_active_entry'],binding:'exact inputs.working_copy, resolved owned path; distinct from the observed safe_active_entry, or explicit null when no safe active entry exists'},
        native_observations:'when_claimed_match_step_and_reference_in_independent_current_observations',
        component_identities:'sha256_local_component_bindings_not_release_certification'},
      working_copy:'inert_owned_copy_never_registered_or_executed_incomplete',
      active_location:'immediate_child_of_runtime_installation_root',
      canonical_entry:'oop-runtime-adapter.js',
      submission_modes:['enforcement','record','snapshot','errors-read','errors-ack'],
      invocation_direction:'native_event_to_official_controller_with_runtime_root_enforcement_to_declarative_decode_and_native_context',
      evidence:'declared_sequence_distinct_from_native_observations_not_reading_or_comprehension_proof',
      completion:'installation_only_from_actual_administrative_outcomes',
      invalidation:'changed_inputs_invalidate_dependent_preparation_preserve_safe_active_code'},
    pre_materialization_checklist:[
      {id:'ADAPTER-CHECK-LOCATION',rule:'modules/workspace.json#R02',checkpoint_field:'runtime_adapter_entrypoint'},
      {id:'ADAPTER-CHECK-LANGUAGE',rule:'modules/capabilities.json#R20',checkpoint_field:'javascript_interpreter'},
      {id:'ADAPTER-CHECK-NAME',rule:'modules/capabilities.json#R24',checkpoint_field:'runtime_adapter_entrypoint'},
      {id:'ADAPTER-CHECK-SINGLE',rule:'modules/capabilities.json#R20',checkpoint_field:'validation_result'},
      {id:'ADAPTER-CHECK-FAILURE',rule:'modules/capabilities.json#R20',checkpoint_field:'validation_result'}
    ].map(c=>({...c,validated_by:'documented_native_configuration_review'})),
    validation:{method:'documented_native_configuration_review',result_field:'validation_result',before:'any_native_registration',guard:'owned_current_configuration_has_only_nonblocking_context_mechanisms',recheck:'inside_conditional_registration_boundary'},
    sequence:['reuse_bounded_inventory','complete_ordered_adapter_development_preparation','load_required_session_context_and_record_receipt','resolve_pre_materialization_checklist','freeze_complete_materialized_initial_package','validate_exact_configuration_plan','install_or_reuse_every_eligible_mechanism','obtain_direct_administrative_acknowledgments','resolve_required_native_consents_and_restart','persist_scoped_checkpoint'],
    coverage_reassessment:false,active_control_tests:0,on_changed_dependencies:'reconcile_real_dependency_only_without_installation_chat_logic_rewrite'}},
  'BOOT-05':{fact_basis:{project_source_resolved:{any_of:['source_reference_from_priv','source_reference_user_provided_persisted'],
      never:['autonomous_discovery','ambient_remote_inference','local_checkout_inference','proposed_candidate']}},
    human_question:{ask:'once',answers:['source_or_product_repository_address','not_applicable'],resume_condition:'answer_received_and_reference_persisted'},
    branch_overrides:{absent:'Ask the user once; never discover, infer or propose a candidate.',
      unknown:'Do not discover or infer; ask the user once.'}},
  'BOOT-08':{human_request:{consolidated:true,max_requests:1,
      contents:['operations_creation_or_access_grant','authentication_public_key_and_fingerprint_from_common_private_file',
        'signing_public_key_and_fingerprint_from_common_private_file_when_signature_acceptance_requires_registration','discovered_provider_steps'],
      never:['private_key','token','secret','replacement_repository'],confirmation_is_evidence:false,
      resume_condition:'rediscovery_and_BOOT-11_verification_observed'}},
};
const bootstrapRows = source.split('\n').filter(x=>/^\| \*\*BOOT-\d+\*\*/.test(x)).map(x=>x.match(/^\| \*\*(BOOT-\d+)\*\*/)[1]);
if (JSON.stringify(bootstrapRows)!==JSON.stringify(bootIds))
  throw new Error('Incomplete canonical BOOT sequence');
const bootstrapSteps=bootIds.map((id,index)=>{
  const {branch_overrides,...details}=stepDetails[id]??{};
  return {id,actor:'active_runtime',
    effect_owner:effectOwners[id]??'runtime',action:actions[id],depends_on:dependsOn(bootIds,id,index),
    source_contract:'OOP-full-install',source_row:index+1,guard:{all:stepFacts[id].map(fact=>({fact}))},
    guard_scope:'$clause+core',
    ...details,
    observation:{required_fields_ref:'#observation_fields',never_sufficient:id==='BOOT-10'?['model_assertion','plan_only','historical_status_only']:['user_confirmation','model_assertion','command_exit_zero']},
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
  format:1,id:'full-install',preflight_ref:'../entry.json#bootstrap_preflight',source_contracts:['OOP-full-install','OOP-bootstrap-system','OOP-bootstrap-communication','OOP-bootstrap-attestation'],
  observation_fields:evidenceFields,
  installation_contract:1,metadata:['installation_chat_id','installation_completed_at','recognized_at'],
  states:['installation_verified','installed','pending','attempted','observed','applied_pending_verification','verified','recovering','waiting_human','waiting_external','unsupported'],
  phase_distinctions:'Eligibility is not authority or execution. Applied/verified and runtime/organization ownership remain distinct.',
  continuation:'Aim to complete within the official CTA turn. Ask for genuinely missing information and wait in the current turn when supported. Verify authenticated applicable answer/result and invalidated prerequisites on a real host continuation event. Waiting is nonterminal; continue safe independent work. If completion in the current turn is unavailable, give a localized portable reentry prompt with actual nonsecret values: Resume OOP bootstrap for <project> from <checkpoint>. Recheck <pending action or dependency> and continue the remaining authorized steps. Inspect actual effects before repeating non-idempotent work.',
  restart:'Only for a verified actual restart dependency: persist current project/runtime/OOP checkpoint, expected state, partial effects, remaining steps and verification; explain supported restart/reentry steps. Reconcile effects and revalidate invalidated controls after observable reentry; never invent commands.',
  steps:bootstrapSteps,
  transitions:[
    {from:'verified',to:'installation_verified',requires:['verified:BOOT-10','installed_enforcement']},
    {from:'verified',to:'installed',requires:['verified:BOOT-11','independent_bootstrap_prerequisites_complete','scoped_readiness_evidence_persisted','identity_registration_commit_verified','identity_registration_content_verified','identity_registration_publication_verified','final_publication_checkpoint_persisted','selected_effective_credential_verified','installed_enforcement']},
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
    action:'verify_local_installation_then_register_identity',active_control_tests:0,producer_tests:0,max_attempts:2,
    requires:['verified:BOOT-10','installed_enforcement'],
    enforcement_complete_after:'BOOT-10',installation_complete_after:'BOOT-11',bootstrap_complete_after:'BOOT-11',publication:'mandatory_identity_registration_only',
    next:'Report actual readiness. Continue authorized independent work and follow host authority and verification for effects.',
    full_readiness_guard_ref:'#steps/'+bootIds.indexOf('BOOT-11')+'/guard',
    statuses:['PENDING','INSTALLED','BLOCKED','UNSUPPORTED'],
    enforcement_assurance:'ADMINISTRATIVELY_INSTALLED',
    assurance_statuses:['PENDING','ADMINISTRATIVELY_INSTALLED'],
    assurance_basis:'C/U/R/E direct administrative results; empirical behavior unmeasured.',
    manual_setup:'Ask only for genuinely missing information, necessary action or authority under UX-04 and SYS-07. Consolidate related dependencies; wait in the CTA turn when supported, otherwise supply the scoped reentry prompt.'},
  completion:'BOOT-10 verifies installation; BOOT-11 registers its machine and nested runtime identity and checkpoints remote commit/ref. Pending publication preserves installation; resume publication only. No native trials/release tests.',
};
// Lossless projection: one shared default object, with explicit per-step exceptions.
const sharedStepKeys=['guard_scope','observation','branches','wait','failure','resume','continuation_ref','restart_ref','communication'];
bootstrapData.step_defaults=Object.fromEntries(sharedStepKeys.map(k=>[k,bootstrapSteps[0][k]]));
bootstrapData.step_default_resolution='For each step, inherit omitted fields from step_defaults; explicit fields replace the whole default field. defaults_ref must equal #step_defaults. These references preserve all step instructions.';
bootstrapData.steps=bootstrapSteps.map(step=>Object.fromEntries(Object.entries({...step,defaults_ref:'#step_defaults'}).filter(([k,v])=>!sharedStepKeys.includes(k)||JSON.stringify(v)!==JSON.stringify(bootstrapData.step_defaults[k]))));
bootstrapData.mandatory_context={source_contract:'OOP-available-context',scope:'generated_workspace_output_only',
  instruction:'Before dependent bootstrap work, compare both complete mandatory texts in the resolved workspace view with the selected eligible initial target distribution rendering. Obtain the owned controller rendering when its local prerequisites are ready, otherwise use an authorized equivalent local generation path. Initial target verification is not adoption. Preserve valid layers, repair only authorized owned state, read back and reverify; Never audit the OOP repository or release. Never read PROTOCOL.md.',
  outcomes:['present_and_integral','missing','incomplete_or_altered','source_or_version_unavailable','verification_unavailable'],
  fallback:'Use an authorized alternative context path; retain unavailable verification accurately and block only dependent work.'};
save('dist/procedures/bootstrap.json',bootstrapData);
const controllerSource=readFileSync(new URL('./context-controller.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const reviewedContextFiles={context_controller:'context-controller.cjs',context_contract:'context-contract.mjs',
  context_adapter:'templates/oop-context-adapter.js',shared_instructions:'runtime-instructions.cjs',context_runtime:'context-runtime.cjs'};
for (const [field,file] of Object.entries(reviewedContextFiles)) {
  if (review[field]!==hash(readFileSync(new URL('./'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n'))) throw Error('Unreviewed context implementation: '+file);
}
const controllerConfig={source_binding:sourceBinding,modules:modules.map(({id,dependencies})=>({id,dependencies})),facets:routingData.facets,
  adapter_template:readFileSync(new URL('./templates/oop-context-adapter.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').replaceAll('@@SOURCE_IDENTITY@@',sourceBinding.source_identity),
  contract_ids:contracts.filter(({span})=>!['bootstrap','producer'].includes(span.module)).map(({contract})=>contract.id)};
plan.push({path:'dist/oop-enforce.js',content:'// Generated from the reviewed OOP context implementation.\n'+
  controllerSource.replace("const { composeRuntimeInstructions, runtimeOperationalRules, renderMandatoryProcedures, verifyMandatoryView } = require('./runtime-instructions.cjs');",()=>runtimeOperationalRules.toString()+'\n'+'runtimeOperationalRules.texts=Object.freeze('+JSON.stringify(runtimeOperationalRules.texts)+');\n'+renderMandatoryProcedures.toString()+'\n'+verifyMandatoryView.toString()+'\n'+composeRuntimeInstructions.toString()).replace("const {contextRuntime}=require('./context-runtime.cjs');",()=>contextRuntime.toString())+
  '\nconst distribution = typeof __dirname === "string" ? __dirname : path.dirname(path.resolve(process.argv[1]));\n'+
  'const controller = makeController({...'+JSON.stringify(controllerConfig)+', distribution});\n'+
  'if (typeof module !== "undefined") module.exports = controller;\n'+
  'if (typeof require === "undefined" || require.main === module) runCLI(controller);\n'});
save('dist/procedures/lifecycle.json',{
  format:1,routes:{
    first_install:{facets:['full_install'],procedure:'bootstrap.json'},
    interaction:{facets:['interaction'],assurance:'Reuse current administrative completion. The controller supplies nonblocking context and actual limitations; host authority and effect verification are independent.',sequence:['identity_binding','shared_language_preference_inspection','presentation_language_resolved','reuse_controller_daily_result','load_relevant_context','classify_new_subject','submit_correlated_subject_record','inspect_explicit_acceptance','snapshot_before_uncertain_retry','union_closure','G2_plus_knowledge_readiness_before_dependent_work','mandatory_generated_context_verification','independent_authority_and_effect_checks','response_or_effect','observe_outcome']},
    adoption:{facets:['due_update'],source_contract:'OOP-runtime-adoption',migration_index:'../migrations/index.json',migration_module:'migration-distribution',sequence:['availability','compatibility','target','authorization','migration_contract_ordered_or_current_supported_state','independent_common_runtime_operations','owned_remaining_actions','verification','atomic_owned_checkpoint','knowledge_realignment']},
    migration:{facets:['organizational_migration'],source_contract:'OOP-organizational-migration',sequence:['inspect_canonical_revision_and_actual_state','interpret_explicit_state_change_and_scope','reader_writer_compatibility','exclusive_authority_when_required','remaining_actions_only','verify_result','canonical_record']},
    recovery:{facets:['context_loss'],source_contracts:['OOP-asynchronous-recovery','OOP-available-context'],sequence:['resolve_owned_checkpoint','mandatory_generated_context_verification','actual_effects','due_freshness','reroute','rehydrate_missing','verify_prerequisites','authorized_remaining_action']},
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
const deliveryManifest=contextManifest(sourceBinding,installManifest.source_contracts);
save('dist/enforcement-install.json',deliveryManifest);
save('dist/installation-contract.json',{format:1,source_binding:sourceBinding,source_contracts:['OOP-private-boundary','OOP-ticket-lifecycle','OOP-capability-lifecycle','OOP-organizational-migration'],identity_schema:JSON.parse(readFileSync(new URL('./schemas/installation-identity.schema.json',import.meta.url),'utf8')),mutation:{field:'organizational_mutation',required_for:['ticket_mutation','identity_registry_mutation'],input:['proposal','observation'],prior_state:'Privileged current canonical revision, same-ticket snapshots and selected lineage; backend conditional write and readback remain mandatory.',authoring:'previous/reconstruct are separate from nonmutating validateMutation; publishMutation revalidates in a conditional backend boundary.',identity:'Version-1 machine record with public identity, owner/kind and nested runtimes; local checkpoints retain technical state.'},configuration:{runtime_adapter:'one official framework entry with an owned oop-runtime-adapter.js per runtime/workspace/host',maintenance:'Typed runtime_adapter_maintenance and current independently observed local declaration; exact adapter/state/candidate effects only, no version control/network; CAS exit after administrative reconciliation',documentation:'official installed-version/actual-host evidence',minimum:'narrow scope, necessary base and host declarations, one sufficient source; preserve unrelated content',assurance:'administrative only, never synthetic dispatch certification'},limits:['supplied privileged observations are not authenticated by predicates','installation records retain their own subject and scope']});
const interfaces={
  installation_contract:{artifact:'installation-contract.json',format:1,mutation_field:'organizational_mutation',validation:'official controller and independently authenticated backend adapter'},
  installation_binding:{artifact:'enforcement-install.json',format:1,installation_contract:1,
    inventory:'documented_nonblocking_context_delivery',receipt_history:'owned_actual_administrative_observations',bootstrap_guard:'installed_enforcement'},
  enforcement:contextInterface,
  format:1,delivery:'Abstract interoperable contract; native/local interfaces suffice. No mandatory interpreter product, integration protocol, policy engine or hosted service.',
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
};
save('dist/interfaces.json',interfaces);
const opening = preflightContract.semantic_clause.match(/\*\*ENTRY-INSTRUCTION:\*\*\n\n([\s\S]+?)\n\n\| Stage /);
if (!opening || (preflightContract.semantic_clause.match(/\*\*ENTRY-INSTRUCTION:\*\*/g)??[]).length!==1)
  throw new Error('Missing or duplicate canonical opening language instruction');
save('dist/entry.json',{
  instructions:[{id:'ENTRY-INSTRUCTION',instruction:opening[1]}],
  format:1,protocol:'organization-orchestration-protocol',status:'prepared_distribution',
  source_binding:sourceBinding,
  contract_profile:'urn:oop:derived:contract:1',
  authority:'../PROTOCOL.md is canonical for maintainers; consumers never read it and resolve conflicts through the complete derived semantic_clause text.',
  version:'Record repository/ref/full containing commit from version metadata; source_snapshot is not adoption or a version manifest.',
  source_snapshot:{repository:'https://github.com/organizationorchestrationprotocol/oop.git',ref:'main',content_identity:hash(source),path:'PROTOCOL.md'},
  activation:'Official installation intent starts full_install immediately after required initial explanation; other requests use the applicable lifecycle route.',
  bootstrap_preflight:bootstrapPreflight,
  enforcement:{artifact:'oop-enforce.js',installation_manifest:'enforcement-install.json',installation_contract:'installation-contract.json',interface_ref:'interfaces.json#enforcement',adoption:'migrations/index.json#enforcement',permission:'Authoritative formal installation and effective enablement suffice for normative functioning; independent authorization, real failure propagation and effect verification remain required.'},
  minimum_context:['modules/core.json','modules/workspace.json','modules/context.json','modules/entry.json'],
  routing_index:'index.json',
  migration_index:'migrations/index.json',migration_context:'modules/migration-distribution.json',selector:'routing.json',procedures:{bootstrap:'procedures/bootstrap.json',lifecycle:'procedures/lifecycle.json'},interfaces:'interfaces.json',
  contract_binding:{'$clause':'Evaluate the complete semantic_clause for that dimension, with its exact quantified scope, conditions, exceptions and normative force.',
    '$clause+core':'Evaluate the clause and Core for that dimension. No inferred generic permission or invented fact.',
    actor:'source-qualified actor means the actual actor specified by the complete clause; references do not change ownership.',
    examples:'Source examples remain conditional illustrations, never independent authority.',
    hashes:'Content identities are producer provenance/reference metadata. Consumers do not recompute, compare to version control or certify OOP artifacts.'},
  context:'Union classified semantic facets then dependencies; load only missing/stale selected context. Resolve material unknowns before effects, never infer permission.',
  consumer_exclusion:'Never read PROTOCOL.md. Never run maintainer commands, schemas as release tests, OOP repository audits, hashes/signatures/inventories/publisher/TOFU checks during consumer lifecycle. Templates under dist/templates are consumer material, not maintainer commands. Consumer-local access and formal enablement remain required; no dispatch-proof prerequisite or active bootstrap control tests.',
  runtime:'Select supported existing mechanisms under canonical authority; this package does not install controls, prove provider access or claim Full OOP runtime governance.',
});
save('tools/evidence/release-traceability.json',{
  source_identity:hash(source),source_binding:sourceBinding,source_normalization:'CRLF to LF; explanatory overview and role section headings excluded, document title retained; allocation lines refer to extracted source, contract locators to document lines',review_ref:'tools/release-review.json',
  preservation:'reviewed_current_source; '+contracts.length+' complete clauses allocated exactly once and preserved verbatim',coverage_complete:true,
  clauses:contracts.map(({span,contract})=>({...span,content_identity:contract.source.content_identity,artifact:`dist/modules/${span.module}.json`,contract:contract.id})),
  modules:indexModules,
  classification:'reviewed_current_source',enforcement:{interface:contextInterface.interface,implementation_identity:review.context_controller,
    contract_identity:review.context_contract,template_identity:review.context_adapter,shared_instructions_identity:review.shared_instructions},
  migration_artifacts:Object.keys(migrations),
  migration:{descriptor_ref:'dist/migrations/index.json',step:migrations['migrations/index.json'].step,
    existing_state_policy:'The initial distribution declares only its current profile and no predecessor; independently verified state and scoped bootstrap govern.',
    recovery:'Retain prior verified adoption and actual partial effects; inspect before retry.'},
});
const templatePaths=['templates/oop-runtime-adapter.js','templates/native-instruction-pointer.md'];
for(const path of templatePaths)plan.push({path:'dist/'+path,content:readFileSync(new URL('./'+(path===templatePaths[0]?'templates/oop-context-adapter.js':path),import.meta.url),'utf8').replace(/\r\n/g,'\n').replaceAll('@@SOURCE_IDENTITY@@',sourceBinding.source_identity)});
const expected = modules.flatMap(module => [`dist/modules/${module.id}.json`, `dist/details/${module.id}.json`]).concat([
  'dist/routing.json', 'dist/index.json', 'dist/procedures/bootstrap.json', 'dist/procedures/lifecycle.json',
  'dist/installation-contract.json', 'dist/enforcement-install.json', 'dist/oop-enforce.js', 'dist/interfaces.json', 'dist/entry.json', 'tools/evidence/release-traceability.json', ...Object.keys(migrations).map(p=>'dist/'+p),...templatePaths.map(p=>'dist/'+p),
]);
if(referenceOnly){
  const engineConfig=enforcementConfig({sourceBinding,routing:routingData,contracts,bootstrap:bootstrapData,migrations,index:runtimeIndex});
  const referenceInterfaces={...interfaces,enforcement:{...interfaceDescription,schemas:wireSchemas,coordination_schemas:coordinationSchemas,
    administrative_commands:{'validate-configuration':{schemas:configurationSchemas}},
    runtime_coordination_commands:Object.fromEntries(coordinationCommands.map(command=>[command,{schemas:'#coordination_schemas'}])),
    runtime_message:{field:'payload.runtime_message',language:'English operational text',status_line_bytes:statusLineBudgetBytes},
    state_writes:'confined producer fixture state',
    commands:engineConfig.commands,activation_defaults:activationDefaults,activation_vocabulary:activationVocabulary}};
  const fixturePlan=plan.filter(({path})=>/^dist\/(?:modules\/|details\/|(?:routing|index)\.json$)/.test(path));
  fixturePlan.push(
    {path:'dist/oop-enforce.js',content:generateEnforcement(engineConfig,review.enforcement)},
    {path:'dist/enforcement-install.json',content:JSON.stringify(installManifest)+'\n'},
    {path:'dist/interfaces.json',content:JSON.stringify(referenceInterfaces)+'\n'},
    {path:'dist/templates/oop-runtime-adapter.js',content:readFileSync(new URL('./templates/oop-runtime-adapter.js',import.meta.url),'utf8').replace(/\r\n/g,'\n').replaceAll('@@SOURCE_IDENTITY@@',sourceBinding.source_identity)},
  );
  writeEvidence(root,fixturePlan.map(({path,content})=>({path:path.replace(/^dist\//,'tools/evidence/reference/'),content})));
  process.exit(0);
}
const removed = applyArtifacts(root, plan, expected);
process.stdout.write(`Removed ${removed.length} orphan module/detail artifacts${removed.length ? ': '+removed.join(', ') : ''}.\n`);
process.stdout.write(`Generated ${modules.length} modules, ${contracts.length} lossless contracts and ${bootIds.length} BOOT steps (${bootIds.join(', ')}); ${sourceBinding.kind}; producer acceptance still required.\n`);
