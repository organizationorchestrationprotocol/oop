'use strict';
// Reviewed installation projection. Native facts and authorization remain host-owned.
const {createHash}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const phases={entry:['session_entry'],interaction:['user_interaction'],'pre-effect':['before_effect'],
  'post-effect':['after_effect'],completion:['before_completion'],recovery:['session_entry','resume_before_effect'],
  delegate:['delegate_start','delegate_finish'],probe:['diagnostic_after_bootstrap']};
const roles={entry:'context_delivery',interaction:'context_delivery','pre-effect':'preventive_gate',
  'post-effect':'observation',completion:'completion_blocking',recovery:'preventive_gate',delegate:'preventive_gate',probe:'diagnostic'};
const purposes={entry:'Deliver current workspace-bound context before substantive work.',
  interaction:'Deliver current per-turn governance without granting effect permission.',
  'pre-effect':'Prevent a dependent effect until admission and independent authority are established.',
  'post-effect':'Observe actual consequences and validate postconditions; cannot undo an effect.',
  completion:'Block unsupported completion claims where the host supports a completion veto.',
  recovery:'Reconcile interrupted or resumed context before dependent continuation.',
  delegate:'Propagate governance at delegation start and validate delegated completion.',
  probe:'Perform explicitly authorized necessary diagnosis after bootstrap; never grant admission.'};
const classes={context_delivery:['persistent_context_injection','native_context_callback','native_execution_policy'],
  preventive_gate:['native_execution_policy','external_pre_effect_wrapper','verified_backend_conditional_write'],
  observation:['native_post_effect_observer','external_postcondition_validator'],
  completion_blocking:['native_completion_gate','external_completion_gate'],diagnostic:['privileged_diagnostic']};
const refs=['OOP-enforcement-autonomy','OOP-transitions-routing','OOP-runtime-adoption','OOP-capability-lifecycle','OOP-free-first','OOP-full-install','OOP-bootstrap-system','OOP-delegate-governance'];
function descriptors(){return Object.keys(phases).map(feature=>({feature,purpose:purposes[feature],
  phases:phases[feature],required_semantics:{role:roles[feature],blocking_required:['preventive_gate','completion_blocking'].includes(roles[feature])},
  capability_classes:classes[roles[feature]],required_coverage:{phases:phases[feature],paths:'all_authenticated_applicable_paths',
    applicability:feature==='probe'?'explicit_post_bootstrap_diagnostic':feature==='delegate'?'delegation_supported':
      feature==='recovery'?'session_entry_and_supported_resume':feature==='pre-effect'||feature==='post-effect'?'effects_possible':'always',
    minimum_tier:0,complementary_paths:'each_path_is_a_separate_requirement'},
  input_mapping:{schema_ref:'interfaces.json#enforcement/schemas/request',format:1,command:feature,
    fields:['request_id','scope','context','evidence','effect_class','transition','bootstrap_step','journal'],
    facts:'independently_authenticated_current_host_observations',correlation:'unique_request_id',unknown:'block_dependent_scope'},
  output_mapping:{schema_ref:'interfaces.json#enforcement/schemas/response',type:'oop_admission',
    correlation:['request_id','command','source_binding'],exit_statuses:{allow:0,deny:2,unknown:3,error:4},
    allow:feature==='pre-effect'?'conditional_on_independent_adapter_authority':'not_granted',
    failure:roles[feature]==='observation'?'record_failure_and_block_dependent_continuation':'block_dependent_scope',
    veto:'only_actual_native_veto_power',timeout:'fail_closed_without_claiming_underlying_cancellation'},
  shareability:{required_equal:['registration','invocation','scope','authority','permissions'],
    required_per_feature:['phase','path','semantic_role','blocking_power'],selection:'all_distinct_eligible_reuse_equivalents'},
  fallback:{unknown:'block_dependent_scope',unsupported:'block_dependent_scope',unauthorized:'preserve_owner_restrictions',
    independent_work:'retain_authorized_safe_work',diagnostics:'never_automatic_during_bootstrap'},
  verification:{basis:'direct_administrative_acknowledgment',active_hook_tests:0,
    required:['invocation','scope','provenance','installation_completed','native_consent_resolved','restart_resolved','real_error_absent'],
    invalidation:['source','runtime_build','permissions','configuration','scope','authority','revision','capabilities'],
    assurance:'administrative_presumption_not_empirical_interception'},source_refs:refs}));}
const identity=x=>'sha256:'+createHash('sha256').update(JSON.stringify(x)).digest('hex');
function manifestBody(sourceBinding,sourceContracts){
  return {format:1,type:'oop_enforcement_install_profile',controller_interface:'oop-admission-1',source_binding:sourceBinding,
    adoption:'independently_adopted_full_git_commit_not_source_snapshot',features:descriptors(),source_contracts:sourceContracts,
    runtime_adapter:{ownership:'runtime',policy:'invoke_adopted_controller_without_reimplementing_norms',
      language:'javascript',cardinality:'one_active_per_installation_workspace_host',
      implementation_language_rule:'official_framework_owns_orchestration_adapter_only_translates_events_and_responses',
      delegated_runtime_adapter_logic:false,controller_invocation:'official_controller_execution_facility_via_stdin_stdout',
      filename_pattern:'oop-runtime-adapter.js',extension_rule:'fixed_javascript_extension',
      location_template:'<project-private-root>/tools/<runtime-class>/<installation-uid>/adapters/oop-runtime-adapter.js',
      location_rules:['modules/workspace.json#R02','modules/capabilities.json#R25'],language_rules:['modules/capabilities.json#R21'],
      clause_pointer_resolution:'Resolve fragment through module clause_index to a complete source-qualified contract and exact heading; missing or ambiguous targets block dependent work.',
      templates:{'oop-runtime-adapter':{path:'templates/oop-runtime-adapter.js',host_family:'documented JavaScript execution host'}},
      registration:{record:'<owned-scope>/oop-runtime-adapter-registration.json',rule:'modules/capabilities.json#R21',arguments_ref:'interfaces.json#enforcement/arguments/registration',schema_ref:'interfaces.json#enforcement/registration/schema'},
      native_instruction_pointer:'templates/native-instruction-pointer.md',
      validation_command:'validate-configuration',installation_rules:['modules/capabilities.json#R26','modules/capabilities.json#R29'],
      javascript_execution_definition:'Declared JavaScript execution facility supported by the actual host and runtime invocation contract.',
      checkpoint_fields:['host_execution_environment','javascript_interpreter','javascript_version','javascript_support_basis','extension','extension_source','runtime_adapter_entrypoint','runtime_adapter_location_mapping','validation_result'],
      configuration:'official_version_host_documentation_and_minimum_scope',
      compatible_update:'preserve_native_entrypoint_permissions_and_events',incompatible_update:'targeted_authorized_reconciliation'},
    installation:{plan:'bounded_inventory_and_frozen_materialized_package',acknowledgment:'direct_administrative_result',
      coverage_reassessment:false,active_hook_tests:0,technical_step:'BOOT-12',publication_step:'BOOT-13'}};
}
function buildManifest(sourceBinding,sourceContracts){
  const body=manifestBody(sourceBinding,sourceContracts);
  return {...body,content_identity:identity(body)};
}
function validateManifest(m,expectedSourceBinding){
  if(!m || m.format!==1 || m.type!=='oop_enforcement_install_profile' || m.controller_interface!=='oop-admission-1' ||
    !equal(m.source_binding,expectedSourceBinding) || !/^sha256:[a-f0-9]{64}$/.test(expectedSourceBinding?.source_identity??'') ||
    expectedSourceBinding?.kind!=='source_content' || !Array.isArray(m.source_contracts) || m.source_contracts.length!==refs.length ||
    m.source_contracts.some((c,i)=>c?.id!==refs[i] || typeof c.artifact!=='string' || !c.artifact.startsWith('modules/') || !c.source))return false;
  // Exact format-1 semantics, including unknown fields, fail closed. This is a local
  // interface check, not publisher/TOFU integrity certification by the consumer.
  // Producer content identity is opaque adoption/cache metadata here. Consumers
  // validate the interface, not an OOP publisher checksum or TOFU claim.
  const {content_identity,...body}=m;
  return /^sha256:[a-f0-9]{64}$/.test(content_identity??'') && equal(body,manifestBody(expectedSourceBinding,m.source_contracts));
}
module.exports={phases,roles,refs,descriptors,buildManifest,validateManifest,identity};
