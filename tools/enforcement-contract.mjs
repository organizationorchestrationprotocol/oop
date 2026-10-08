import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createEnforcementEngine, runEnforcementCLI } from './enforcement-engine.mjs';
import { route, closure } from './reference-engine.mjs';
import {projectMigrationContext,expandMigrationContext} from './migration-context.mjs';
import installation from './installation-contract.cjs';
const {installationContract}=installation;
const hash=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
export const commandNames=['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe'];
export const configurationSchemas={
  request:{type:'object',additionalProperties:false,required:['format','request_id','plan','facts'],properties:{format:{const:1},request_id:{type:'string',minLength:1,maxLength:512},plan:{type:'object'},facts:{type:'object'}}},
  response:{type:'object',additionalProperties:false,required:['format','type','request_id','source_binding','valid','reason','dispatch_verified','validation_binding','error'],properties:{format:{const:1},type:{const:'oop_configuration_validation'},request_id:{type:['string','null']},source_binding:{type:'object'},valid:{type:'boolean'},reason:{type:'string'},dispatch_verified:{const:false},validation_binding:{type:['object','null']},error:{type:'boolean'}}}
};
export const wireSchemas={
  request:{$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,
    required:['format','request_id'],properties:{format:{const:1},request_id:{type:'string',minLength:1,maxLength:512},
      scope:{type:'object',required:['classification'],properties:{classification:{enum:['known','unknown']},
        ...Object.fromEntries(['request','action','state','risk','authority','recovery'].map(k=>[k,{type:'array',items:{type:'string',minLength:1}}]))},additionalProperties:false},
      context:{type:'object',required:['project','runtime','machine_id','installation_uid','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','observed_at','dependencies']},
      evidence:{type:'object',additionalProperties:{type:'object',required:['value','origin','reference','binding','dependencies','observed_at','expires_at'],
        properties:{value:{type:'boolean'},origin:{const:'authoritative_observation'},reference:{type:'string'},binding:{type:'object'},dependencies:{type:'object'},observed_at:{type:'string'},expires_at:{type:'string'}}}},
      organizational_mutation:{type:'object',required:['proposal','observation']},
      bridge_maintenance:{type:'object',required:['action','expected_revision','bridge_path']},maintenance_observation:{type:'object'},
      effect_class:{type:'string'},transition:{type:'object',required:['from','to']},bootstrap_step:{type:'string'},journal:{type:'object'}}},
  response:{$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,
    required:['format','type','request_id','command','source_binding','decision','reason_code','effect_permission','assurance','payload'],
    properties:{format:{const:1},type:{const:'oop_admission'},request_id:{type:['string','null']},command:{type:['string','null']},
      source_binding:{type:'object'},decision:{enum:['allow','deny','unknown','error']},reason_code:{type:'string'},
      effect_permission:{enum:['not_granted','conditional_on_adapter']},assurance:{type:'string'},payload:{type:'object'}}},
};
export const impact={changed:true,category:'INTERFACE_CHANGED',compatibility:'adapter_required',
  prior_engine:'oop-admission-1',action:'adapter_update_required',interface:'oop-admission-1',
  contact_points:commandNames,inputs:['bounded JSON stdin envelope'],
  administrative_commands:['validate-configuration'],outputs:['oop_admission: allow|deny|unknown|error','oop_configuration_validation: valid|invalid|error'],exit_statuses:{allow:0,deny:2,unknown:3,error:4},
  before:'Eight admission commands; installation manifest 3; configuration validation was in-process only and path checks matched a textual UID segment.',
  after:'Eight admission commands and their decision/exit meanings remain unchanged. Administrative validate-configuration adds format-1 request/response with exit 0 valid, 2 invalid, 4 malformed/error; no effect permission. Manifest 4 and lossless shared-default bootstrap format 7 require reconciled installation readers, resolved owned path observations and a plan/revision/source-bound validation receipt before registration. Strict installation readers need an adapter update.',
  rationale:'R26 exposes configuration checks without changing admission semantics. Trusted adapters supply authenticated current path facts and revalidate exact plans inside conditional registration; templates provide transport, not authority or installed dispatch certification.',
  consumer_dispositions:[
    {consumer:'no_prior_engine',compatibility:'adapter_required',action:'adapter_update_required'},
    {consumer:'exit4_fail_closed',compatibility:'unchanged',action:'copy-only'},
    {consumer:'session_checkpoint_evidence',compatibility:'adapter_required',action:'adapter_update_required'},
    {consumer:'bootstrap_step_removed_ids',compatibility:'adapter_required',action:'adapter_update_required'},
    {consumer:'unknown',compatibility:'unknown',action:'blocked_recovery'}
  ],implementation:'producer_local',installed_provider:'not_verified'};
// Vendor-neutral reviewed policy descriptors; actual native mappings remain host-owned.
export const activationVocabulary = Object.fromEntries(commandNames.map(feature => {
  const phases = {entry:['session_entry'],interaction:['user_interaction'],'pre-effect':['before_effect'],
    'post-effect':['after_effect'],completion:['before_completion'],recovery:['session_entry','resume_before_effect'],
    delegate:['delegate_start','delegate_finish'],probe:['diagnostic_after_bootstrap']};
  const semantics = {entry:'context_delivery',interaction:'context_delivery','pre-effect':'preventive_gate',
    'post-effect':'observation',completion:'completion_blocking',recovery:'preventive_gate',delegate:'preventive_gate',probe:'diagnostic'};
  return [feature,{feature,phases:phases[feature],semantics:semantics[feature],
    when:feature==='probe'?'Necessary scoped diagnosis after bootstrap; never grants permission.':
      feature==='recovery'?'Interrupted/resumed context before dependent continuation.':
      feature==='delegate'?'Delegation actually used; separate start and acceptance obligations.':`Applicable ${feature} lifecycle boundary.`,
    not_applicable:'Unrelated independent scope; diagnostic trials are never part of bootstrap.',
    scope:'Current owned runtime/workspace and actual dependent effect paths only.',
    source_refs:['OOP-enforcement-autonomy','OOP-runtime-adoption','OOP-capability-lifecycle','OOP-full-install'],
    priority:['entry','interaction','recovery','delegate','pre-effect','post-effect','completion','probe'].indexOf(feature),mandatory:'All applicable source obligations; selection never grants authority.',
    capability_classes:feature==='pre-effect'?['native_execution_policy','external_pre_effect_wrapper','verified_backend_conditional_write']:[semantics[feature]],
    shared_group:['entry','recovery'].includes(feature)?'session_context':phases[feature][0],
    prerequisites:['current_identity','authorized_scope','current_source_context'],
    observe:['direct_administrative_result','native_consent','declared_scope','configuration_provenance','restart_resolved','independent_authority'],
    reuse:'Current administrative completion suffices for policy-defined functioning; do not invent dispatch or denial observations.',
    invalidation:['source','runtime_build','configuration','permissions','workspace_scope','authority','revision','coverage'],
    feedback:'Propagate every mandatory deny/unknown/error; dependent scope blocked, safe independent work retained.',
    fallback:'Unknown/unsupported prevention blocks dependent effects; semantic instructions are not preventive proof.',
    limits:'No provider hook support or installed coverage claimed. Host supplies direct administrative acknowledgments; actual native behavior is not empirically demonstrated by that finding.',
    cost:'Reuse compatible registrations and valid evidence; strongest coverage before nonredundant equal-guarantee cost.'}];
}));
export {buildManifest,validateManifest} from './enforcement-install.cjs';
const common=['current_source_verified','context_delivered_verified','authority_verified','installed_enforcement','control_failure_absent','runtime_identity_verified','checkpoint_current_verified','session_scope_verified'];
export function enforcementConfig({sourceBinding,routing,contracts,bootstrap,migrations}) {
  const required={entry:[],interaction:[],probe:[],
    'pre-effect':[...common,'effect_scope_authorized','expected_revision_verified','mandatory_guards_complete'],
    'post-effect':[...common,'actual_effects_observed','postconditions_verified','secret_safety_verified'],
    completion:[...common,'requirements_complete','actual_effects_observed','tests_verified','deliverables_verified','documentation_verified','secret_safety_verified','dependencies_coherent'],
    recovery:[...common,'actual_effects_observed','remaining_action_authorized'],
    delegate:[...common,'delegate_scope_authorized','destination_adoption_verified','delegate_controls_verified','delegate_completion_verified']};
  return {interface:'oop-admission-1',source_binding:sourceBinding,routing,migration_context:projectMigrationContext(migrations),
    contracts:contracts.map(({span,contract})=>({id:contract.id,module:span.module,source:contract.source,
      deterministic:['closure','evidence_identity_freshness','required_predicates'],
      semantic_residual:'Complete semantic_clause; independently observed actual authority/effects, host coverage and applicability.',
      executable_control:'semantic:'+contract.id,fixture:'tools/enforcement.test.mjs',evidence:'tools/evidence/release-tests.tap'})),
    bootstrap,commands:Object.fromEntries(commandNames.map(name=>[name,{required:required[name],read_only:true,activation_ref:'interfaces.json#enforcement/activation_vocabulary/'+name,
      timing:({entry:'before substantive work',interaction:'before reasoning', 'pre-effect':'at effective boundary before effect',
        'post-effect':'after actual effect',completion:'before completion claim',recovery:'before dependent resumed effect',
        delegate:'before accepting delegated completion',probe:'necessary diagnosis after bootstrap only'})[name],
      authority:'Independent adapter observations; input shape does not authenticate facts.',
      fallback:'Missing administrative installation or independent mandatory facts blocks dependent scope; absent dispatch observations alone do not.'}]))};
}
export function generateEnforcement(config,review) {
  const source=readFileSync(new URL('./enforcement-engine.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const contract=readFileSync(new URL('./enforcement-contract.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const context=readFileSync(new URL('./migration-context.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const installationSource=readFileSync(new URL('./installation-contract.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  if(review?.category!==impact.category || review?.implementation_identity!==hash(source) ||
    review?.contract_identity!==hash(contract) || review?.installation_contract_identity!==hash(installationSource) || review?.context_identity!==hash(context) || review?.interface!==config.interface || !review?.semantic_review)
    throw Error('Missing/stale reviewed enforcement implementation or interface impact');
  const output='// Generated by tools/generate-release.mjs; PROTOCOL.md is authoritative.\n'+
    "'use strict';\n"+closure.toString()+'\n'+route.toString()+'\n'+expandMigrationContext.toString()+'\n'+createEnforcementEngine.toString()+'\n'+runEnforcementCLI.toString()+'\n'+
    installationContract.toString()+'\n'+
    'const engine = createEnforcementEngine('+JSON.stringify(config)+', route, installationContract());\n'+
    "engine.expandMigrationContext = expandMigrationContext;\nif (typeof module !== 'undefined') module.exports = engine;\nif (typeof require === 'undefined' || require.main === module) runEnforcementCLI(engine);\n";
  return output.replace(/\r\n/g,'\n');
}
export function validateEnforcementImpact(value) {
  if(!value || ![true,false,'unknown'].includes(value.changed) ||
    !['UNCHANGED','SOURCE_BINDING_ONLY','INTERNAL_ONLY','INTERFACE_CHANGED','UNKNOWN'].includes(value.category) ||
    !['unchanged','compatible_extension','adapter_required','unknown'].includes(value.compatibility) ||
    !['copy-only','adapter_update_required','blocked_recovery'].includes(value.action) ||
    !['before','after','rationale'].every(k=>typeof value[k]==='string' && value[k].trim()) ||
    (value.changed===false && !['UNCHANGED','SOURCE_BINDING_ONLY'].includes(value.category)) ||
    (value.compatibility==='adapter_required' && value.action!=='adapter_update_required') ||
    ((value.category==='UNKNOWN' || value.compatibility==='unknown' || value.changed==='unknown') && value.action!=='blocked_recovery'))
    throw Error('Missing/contradictory enforcement impact');
  return true;
}
