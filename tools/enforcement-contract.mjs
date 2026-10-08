import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createEnforcementEngine, runEnforcementCLI } from './enforcement-engine.mjs';
import { route, closure } from './reference-engine.mjs';
import {projectMigrationContext,expandMigrationContext} from './migration-context.mjs';
import installation from './installation-contract.cjs';
import coordinationModule from './runtime-coordination.cjs';
import {runtimeFramework} from './runtime-framework.cjs';
import {runtimeRendering} from './runtime-rendering.cjs';
import {runtimeDeclaration} from './runtime-declaration.cjs';
import {runtimeObservations} from './runtime-observations.cjs';
import {runtimeFeedback} from './runtime-feedback.cjs';
import {runtimeAction} from './runtime-action.cjs';
const {installationContract}=installation;
const {runtimeCoordination}=coordinationModule;
const hash=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
export const commandNames=['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe'];
export const configurationSchemas={
  request:{type:'object',additionalProperties:false,required:['format','request_id','plan','facts'],properties:{format:{const:1},request_id:{type:'string',minLength:1,maxLength:512},plan:{type:'object'},facts:{type:'object'}}},
  response:{type:'object',additionalProperties:false,required:['format','type','request_id','source_binding','valid','reason','dispatch_verified','validation_binding','error','runtime_message','diagnostics'],properties:{format:{const:1},type:{const:'oop_configuration_validation'},request_id:{type:['string','null']},source_binding:{type:'object'},valid:{type:'boolean'},reason:{type:'string'},dispatch_verified:{const:false},validation_binding:{type:['object','null']},error:{type:'boolean'},runtime_message:{type:'string'},diagnostics:{type:'array',items:{type:'object'}}}}
};
export const coordinationCommands=['declare','load','worklog-append','worklog-read'];
// R27 adapter-supplied privileged facts; declarations and entries remain runtime claims/data.
const coordinationFacts={type:'object',required:['project_root','private_root','owned_scope_locator','common_scope_locator','session','installation_uid','runtime_class','filesystem_local','filesystem_case_sensitive','paths_resolved_without_aliases','scope_ownership_verified','observed_at'],
  properties:{mode:{enum:['advisory','enforcing']},context_event:{enum:['start','resume','compact','restore','context_loss']},policy_deny:{type:'array',items:{type:'string'}},lease_seconds:{type:'integer',minimum:1,maximum:3600},recap_threshold:{type:'integer',minimum:1,maximum:1000},
    resource:{type:'object',required:['path','access'],properties:{path:{type:'string'},access:{enum:['read','write','unknown']}}}}};
export const coordinationSchemas={
  request:{type:'object',required:['format','request_id'],properties:{format:{const:1},request_id:{type:'string',minLength:1,maxLength:512},coordination:coordinationFacts,
    phase:{enum:['classification','attach','transition','clarification','lifecycle','guidance','assessment']},assessment:{type:'object',required:['action_identity','generation','command','facets','effect_class','effects','judgments','purpose'],properties:{action_identity:{type:'string'},generation:{type:'integer',minimum:1},command:{enum:['pre-effect','post-effect','completion','delegate','recovery']},facets:{type:'array',items:{type:'string'}},effect_class:{type:'string'},purpose:{enum:['work','bookkeeping']},effects:{type:'array',maxItems:64,items:{type:'object',required:['path','access','expected_identity'],properties:{path:{type:'string'},access:{enum:['read','write']},expected_identity:{type:'string'}}}},sources:{type:'array',maxItems:64,items:{type:'object',required:['path','expected_identity'],properties:{path:{type:'string'},expected_identity:{type:'string'}}}},judgments:{type:'object'},continuation:{type:'object',properties:{next_action:{type:'string'}}}}},facets:{type:'array',items:{type:'string'}},level:{enum:['G0','G1','G2','G3','G4']},
    expected_revision:{type:'integer',minimum:0},guidance:{type:'object',additionalProperties:false,required:['relation','phase','objective_ref'],properties:{
      relation:{enum:['continuation','clarification','correction','scope_change','cancellation','replacement']},phase:{enum:['inquiry','analysis','planning','action','verification']},
      ...Object.fromEntries(['objective_ref','scope_ref','authority_ref','next_check'].map(k=>[k,{type:'string',minLength:1,maxLength:512}])),
      invalidated:{type:'array',maxItems:16,items:{type:'string'}},facts:{type:'array',maxItems:16,items:{type:'object',additionalProperties:false,required:['ref','kind','provenance','invalidates_on','dependencies'],properties:{
        ref:{type:'string'},kind:{enum:['observation','interpretation','assumption']},provenance:{type:'string'},invalidates_on:{type:'string'},dependencies:{type:'array',maxItems:16,items:{type:'string'}}}}},
      blocker:{type:'object',additionalProperties:false,required:['prevented_action','dependency','responsible','unblock_condition','resume_action','independent_work'],properties:Object.fromEntries(['prevented_action','dependency','responsible','unblock_condition','resume_action','independent_work'].map(k=>[k,{type:'string',minLength:1,maxLength:512}]))}}},
    work_item:{type:['object','null'],required:['kind','id'],properties:{kind:{enum:['ticket','reference']},id:{type:'string'}}},resources:{type:'array',items:{type:'string'}},work_item_state:{type:'string'},lifecycle:{enum:['bootstrapping','syncing','degraded','recovering','idle']},
    basis:{type:'object',required:['governed_mutation','subject_scope','work_item_reason'],properties:{governed_mutation:{type:'boolean'},subject_scope:{enum:['current_project','organization','external']},
      materiality:{type:'array',items:{enum:['reversibility','externality','blast_radius','financial','security','organizational','privilege','uncertainty','authorization','persistence','third_party','operational_criticality']}},
      work_item_reason:{enum:['none','level_requirement','shared_policy','user_request','continuation','continuity_need']},policy_ref:{type:'string'},continuation_ref:{type:'string'},continuity_rationale:{type:'string',maxLength:240}}},
    instructions_identity:{type:'string'},scope:{enum:['instructions','session','action']},command:{enum:['pre-effect','post-effect','completion','delegate','recovery']},session:{type:'string'},
    tier:{enum:[1,2,3]},modules:{type:'array',items:{type:'string'}},kind:{enum:['step','observation','message','handoff_note','resolution']},text:{type:'string',maxLength:4000},
    to:{type:'string'},evidence:{type:'array',items:{type:'string'}},supersedes:{type:'string'},mark_read:{type:'boolean'}}},
  response:{type:'object',additionalProperties:false,required:['format','type','request_id','command','source_binding','accepted','reason','effect_permission','state','runtime_message','result','error'],
    properties:{format:{const:1},type:{const:'oop_runtime_coordination'},request_id:{type:['string','null']},command:{type:['string','null']},source_binding:{type:'object'},
      accepted:{type:'boolean'},reason:{type:'string'},effect_permission:{const:'not_granted'},state:{type:['string','null']},runtime_message:{type:'string'},result:{type:'object'},error:{type:'boolean'}}}
};
export const wireSchemas={
  request:{$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,
    required:['format','request_id'],properties:{format:{const:1},request_id:{type:'string',minLength:1,maxLength:512},
      publication_context:{type:'object'},scope:{type:'object',required:['classification'],properties:{classification:{enum:['known','unknown']},
        ...Object.fromEntries(['request','action','state','risk','authority','recovery'].map(k=>[k,{type:'array',items:{type:'string',minLength:1}}]))},additionalProperties:false},
      context:{type:'object',required:['project','runtime','machine_id','installation_uid','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','observed_at','dependencies']},
      evidence:{type:'object',additionalProperties:{type:'object',required:['value','origin','reference','binding','dependencies','observed_at','expires_at'],
        properties:{value:{type:'boolean'},origin:{const:'authoritative_observation'},reference:{type:'string'},binding:{type:'object'},dependencies:{type:'object'},observed_at:{type:'string'},expires_at:{type:'string'}}}},
      organizational_mutation:{type:'object',required:['proposal','observation']},
      runtime_adapter_maintenance:{type:'object',required:['action','expected_revision','runtime_adapter_path']},maintenance_observation:{type:'object'},
      effect_class:{type:'string'},transition:{type:'object',required:['from','to']},bootstrap_step:{type:'string'},journal:{type:'object'},coordination:coordinationFacts}},
  response:{$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',additionalProperties:false,
    required:['format','type','request_id','command','source_binding','decision','reason_code','effect_permission','assurance','payload'],
    properties:{format:{const:1},type:{const:'oop_admission'},request_id:{type:['string','null']},command:{type:['string','null']},
      source_binding:{type:'object'},decision:{enum:['allow','deny','unknown','error']},reason_code:{type:'string'},
      effect_permission:{enum:['not_granted','conditional_on_adapter']},assurance:{type:'string'},payload:{type:'object',required:['runtime_message'],properties:{runtime_message:{type:'string'}}}}},
};
// Current interface description only; transitions live in the migration distribution.
// R21.10 adapter registration record and R27 shared instruction record shapes.
export const registrationSchema={type:'object',additionalProperties:false,
  required:['format','record_type','revision','installation_uid','runtime_class','machine_id','controller_locator','controller_source_identity','interpreter_locator',
    'project_root','private_root','owned_scope','common_scope','filesystem_local','filesystem_case_sensitive','mode','recap_threshold','governed_stores','instruction_sources','runtime_invocation','observed_at'],
  properties:{protected_configuration_paths:{type:'array',maxItems:64,items:{type:'string'}},runtime_adapter:{type:'object',required:['path','identity','template_identity','host','runtime_version','required_events'],properties:{path:{type:'string'},identity:{type:'string'},template_identity:{type:'string'},host:{type:'string'},runtime_version:{type:'string'},observation_admission:{const:1},required_events:{type:'array',items:{type:'string'}}}},format:{const:1},record_type:{const:'oop_runtime_adapter_registration'},revision:{type:'string'},installation_uid:{type:'string'},runtime_class:{type:'string'},machine_id:{type:'string'},
    ...Object.fromEntries(['controller_locator','interpreter_locator','project_root','private_root','owned_scope','common_scope'].map(k=>[k,{type:'string'}])),
    controller_source_identity:{type:'string'},filesystem_local:{type:'boolean'},filesystem_case_sensitive:{type:'boolean'},mode:{enum:['advisory','enforcing']},
    recap_threshold:{type:'integer',minimum:1,maximum:1000},lease_seconds:{type:'integer',minimum:1,maximum:3600},policy_deny:{type:'array',items:{type:'string'}},
    governed_stores:{type:'array',items:{type:'object',required:['kind','locator'],properties:{kind:{enum:['operations','work_items']},locator:{type:'string'}}}},
    instruction_sources:{type:'object',required:['organization','workspace'],properties:{organization:{type:['string','null']},workspace:{type:['string','null']}}},
    runtime_invocation:{type:'array',items:{type:'string'}},observed_at:{type:'string'}}};
export const instructionSchema={type:'object',additionalProperties:false,
  required:['format','record_type','id','layer','status','title','text','applies_to','effect','authority','author_runtime','created_at','supersedes'],
  properties:{format:{const:1},record_type:{const:'oop_runtime_instruction'},id:{type:'string'},layer:{enum:['organization','workspace']},status:{enum:['active','superseded','revoked']},
    title:{type:'string'},text:{type:'string'},applies_to:{type:'string'},canonical_ref:{type:'string'},effect:{enum:['adds','strengthens']},refines:{type:'string'},
    authority:{type:'object',required:['granted_by','evidence_ref','granted_at'],properties:{granted_by:{type:'string'},evidence_ref:{type:'string'},granted_at:{type:'string'}}},
    author_runtime:{type:'string'},created_at:{type:'string'},supersedes:{type:'array',items:{type:'string'}}}};
export const interfaceDescription={interface:'oop-admission-1',contact_points:commandNames,inputs:['bounded JSON stdin envelope'],
  framework:{manifest_version:1,manifest_contract:{required:['schema_version','host','runtime_version','documentation','supported_commands','placeholders'],command_structure:'native-event or literal | group -> decision or literal | group -> output',optional_native_block_field:'_',native_selector:'decodeEvent.native_event: one exact event token',group_overlap:'rejected',decisions:['allow','deny','unknown','error'],case_fields:['stdout','stderr','exitCode'],placeholder_fields:['source','type','required','encoding'],optional_placeholder_field:'absent',encodings:['text','json','json-string'],types:['string','number','boolean','json'],delimiters:{placeholder:'{{name}}',literal_open:'{{{{',literal_close:'}}}}'},validation:'independent supported_commands/placeholders; strict JSON; no callable operations'},manifest_operation:'static JSON',observation_acquisition:'framework-owned verified local scope',rendering_input:{format:1,required:['raw','context','event','decision'],optional:['response','error','additionalContext'],mutually_exclusive:['response','error']},rendering_output:{channel_normalization:'trim; append one LF iff nonempty; preserve internal whitespace',required:['stdout','stderr','exitCode'],encoding:'UTF-8',exit_range:[0,255],max_combined_bytes:1048576},diagnostics:{commands:['diagnostics-read','diagnostics-ack','diagnostics-cleanup'],route:'registered official framework --host',acknowledgement:'trusted actual original and effective-language presentation; never input shape as proof'},entry:'official_controller',template:'templates/oop-runtime-adapter.js',editable_regions:['manifest','decodeEvent'],host_arguments:['<command>','--registration','<locator>','--registration-identity','<identity>','--host','<host>'],publication:'typed obligations; authorized executor owns effects'},arguments:{default:['<command>'],registration:['<command>','--registration','<registration-locator>','--registration-identity','<registration-identity>']},
  registration:{record:'<owned-scope>/oop-runtime-adapter-registration.json',identity:'sha256 of the exact record bytes',schema:registrationSchema},
  action_assessment:{decoder:'actual action operation/arguments; interaction text/turn_id on actual interaction; observed outcome on actual post-effect',reconciliation:'load scope=action then declare phase=assessment with current state revision and receipt generation; post-effect rechecks the recorded outcome without reexecution',judgments:'agent interpretations with reasons and observed source references; never independently authenticated facts',facts:'controller observes current identity, context, revisions, administration receipts and matching outcomes; missing or false mandatory facts remain non-authorizing',execution:'conditional on unchanged resources and actual host authorization; no independent protection against a principal controlling the boundary',bookkeeping:'only exact owned checkpoint, administration.json and action-reconciliation.json; adoption/installation predicates are not applicable to this bounded repair, never fabricated as true'},
  remediation:{non_allow:'Every non-authorizing outcome carries concrete explanation, actions, retry prerequisites and stopping conditions; codes remain metadata only',admission:'payload.runtime_message and payload.remediation',coordination:'runtime_message and result.remediation',configuration:'runtime_message and diagnostics.correction',transport_failure:'safe actionable stderr when no native response can be selected; delivery is not assumed'},
  completion:{payload:'payload.completion',dispositions:['satisfied','continue','blocked'],continuation:'continuation_permitted only for a current independently authorized safe next action and unconsumed progress; unresolved or repeated states pause'},
  instructions:{record_schema:instructionSchema,rendered_copy:'<common-scope>/runtime-instructions.rendered.md',budget_bytes:4096,declare_line_bytes:512},
  administrative_commands:['validate-configuration'],runtime_coordination_commands:coordinationCommands,
  outputs:['oop_admission: allow|deny|unknown|error with payload.runtime_message','oop_configuration_validation: valid|invalid|error','oop_runtime_coordination: accepted|rejected|error'],exit_statuses:{allow:0,deny:2,unknown:3,error:4},
  interpreter:{language:'JavaScript',runtime:'Node.js-compatible interpreter',minimum_major:24,role:'Conditional technical dependency of the official controller (R21); not a universal OOP requirement.'},
  implementation:'producer_local',installed_provider:'not_verified'};
// Vendor-neutral reviewed policy descriptors; actual native mappings remain host-owned.
const activationEntries = Object.fromEntries(commandNames.map(feature => {
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
const sharedActivation=Object.keys(activationEntries.entry).filter(k=>Object.values(activationEntries).every(v=>JSON.stringify(v[k])===JSON.stringify(activationEntries.entry[k])));
export const activationDefaults=Object.fromEntries(sharedActivation.map(k=>[k,activationEntries.entry[k]]));
export const activationVocabulary=Object.fromEntries(Object.entries(activationEntries).map(([name,v])=>[name,Object.fromEntries(Object.entries(v).filter(([k])=>!sharedActivation.includes(k)))]));
export const resolveActivation=(name,vocabulary=activationVocabulary,defaults=activationDefaults)=>({...defaults,...vocabulary[name]});
export {buildManifest,validateManifest} from './enforcement-install.cjs';
const common=['current_source_verified','context_delivered_verified','authority_verified','installed_enforcement','control_failure_absent','runtime_identity_verified','checkpoint_current_verified','session_scope_verified'];
export function enforcementConfig({sourceBinding,routing,contracts,bootstrap,migrations,index}) {
  const required={entry:[],interaction:[],probe:[],
    'pre-effect':[...common,'effect_scope_authorized','expected_revision_verified','mandatory_guards_complete'],
    'post-effect':[...common,'actual_effects_observed','postconditions_verified','secret_safety_verified'],
    completion:[...common,'requirements_complete','actual_effects_observed','tests_verified','deliverables_verified','documentation_verified','secret_safety_verified','dependencies_coherent'],
    recovery:[...common,'actual_effects_observed','remaining_action_authorized'],
    delegate:[...common,'delegate_scope_authorized','destination_adoption_verified','delegate_controls_verified','delegate_completion_verified']};
  return {interface:'oop-admission-1',source_binding:sourceBinding,index,routing,migration_context:projectMigrationContext(migrations),
    contracts:contracts.map(({span,contract})=>({id:contract.id,module:span.module,source:contract.source})),
    adapter_template:readFileSync(new URL('./templates/oop-runtime-adapter.js',import.meta.url),'utf8').replaceAll('@@SOURCE_IDENTITY@@',sourceBinding.source_identity).replace(/\r\n/g,'\n'),bootstrap,commands:Object.fromEntries(commandNames.map(name=>[name,{required:required[name],read_only:true,activation_ref:'interfaces.json#enforcement/activation_vocabulary/'+name,
      timing:({entry:'before substantive work',interaction:'before reasoning', 'pre-effect':'at effective boundary before effect',
        'post-effect':'after actual effect',completion:'before completion claim',recovery:'before dependent resumed effect',
        delegate:'before accepting delegated completion',probe:'necessary diagnosis after bootstrap only'})[name],
      authority:'Independent adapter observations; input shape does not authenticate facts.',
      fallback:'Missing administrative installation or independent mandatory facts blocks dependent scope; absent dispatch observations alone do not.'}]))};
}
export function generateEnforcement(config,review) {
  if(review?.action_identity!==hash(readFileSync(new URL('./runtime-action.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')))throw Error('Missing/stale reviewed action reconciliation');
  if(review?.feedback_identity!==hash(readFileSync(new URL('./runtime-feedback.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')))throw Error('Missing/stale reviewed operational feedback');
  const source=readFileSync(new URL('./enforcement-engine.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const contract=readFileSync(new URL('./enforcement-contract.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const context=readFileSync(new URL('./migration-context.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const installationSource=readFileSync(new URL('./installation-contract.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const coordinationSource=readFileSync(new URL('./runtime-coordination.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  if(review?.rendering_template_identity!==hash(readFileSync(new URL('./templates/oop-runtime-adapter.js',import.meta.url),'utf8').replace(/\r\n/g,'\n')) || review?.rendering_identity!==hash(readFileSync(new URL('./runtime-rendering.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')) || review?.declaration_identity!==hash(readFileSync(new URL('./runtime-declaration.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')) || review?.observations_identity!==hash(readFileSync(new URL('./runtime-observations.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')) || review?.framework_identity!==hash(readFileSync(new URL('./runtime-framework.cjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')) || review?.implementation_identity!==hash(source) ||
    review?.contract_identity!==hash(contract) || review?.installation_contract_identity!==hash(installationSource) || review?.context_identity!==hash(context) || review?.coordination_identity!==hash(coordinationSource) || review?.interface!==config.interface || !review?.semantic_review)
    throw Error('Missing/stale reviewed enforcement implementation or interface impact');
  const output='// Generated by tools/generate-release.mjs; PROTOCOL.md is authoritative.\n'+
    "'use strict';\n"+closure.toString()+'\n'+route.toString()+'\n'+expandMigrationContext.toString()+'\n'+createEnforcementEngine.toString()+'\n'+runEnforcementCLI.toString()+'\n'+
    runtimeFeedback.toString()+'\n'+installationContract.toString()+'\n'+runtimeCoordination.toString()+'\n'+runtimeAction.toString()+'\n'+runtimeRendering.toString()+'\n'+runtimeDeclaration.toString()+'\n'+runtimeObservations.toString()+'\n'+runtimeFramework.toString()+'\n'+
    'const engine = createEnforcementEngine('+JSON.stringify(config)+', route, installationContract(), runtimeCoordination(typeof __dirname!==\'undefined\'?__dirname:null));\n'+
    "engine.framework = runtimeFramework(engine, runtimeCoordination(typeof __dirname!=='undefined'?__dirname:null), engine.config.adapter_template,typeof __dirname!=='undefined'?__dirname:null);\nengine.expandMigrationContext = expandMigrationContext;\nif (typeof module !== 'undefined') module.exports = engine;\nif (typeof require === 'undefined' || require.main === module) runEnforcementCLI(engine);\n";
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
