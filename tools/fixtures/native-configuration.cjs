'use strict';
// Explicitly synthetic documentation/host observations for producer fixtures.
// These do not attest any actual runtime's supported configuration.
module.exports=function nativeConfiguration(workspace,runtimeVersion,revision){
  const uid='fixture-installation-uid',entrypoint='/private/tools/'+uid+'/oop-runtime-adapter.js';
  const result={configuration_plan:{expected_revision:revision,runtime_adapter:{entrypoint,host:'fixture-host',installation_uid:uid,workspace,
    language:'javascript',implementation_language:'javascript',active:true,delegated_runtime_adapter_logic:false,
    policy_authority:'official_controller',profile_independent:true,cwd_independent:true,failure_semantics:'fail_closed'},
    routes:[{entrypoint,host:'fixture-host',installation_uid:uid}],sources:['workspace-registration'],
    elements:[{id:'baseCommand',value:entrypoint,scope:'workspace',purpose:'routing',necessity:'Mandatory generic invocation'},
      {id:'hostCommand',value:entrypoint,scope:'workspace',purpose:'routing',necessity:'Applicable documented host selection'}]},
    configuration_observation:{origin:'authoritative_observation',current:true,reference:'fixture:documentation',workspace,
      host:'fixture-host',runtime_version:runtimeVersion,installation_uid:uid,configuration_revision:revision,
      resolved_runtime_adapter_entrypoint:entrypoint,owned_scope_locator:'/private/tools/'+uid,common_scope_locator:'/private/common',
      filesystem_case_sensitive:true,paths_resolved_without_aliases:true,runtime_adapter_ownership_verified:true,
      official_sources:[{source:'fixture:official-runtime-specification',section:'registration',reviewed_at:'2026-10-24',host:'fixture-host',runtime_version:runtimeVersion}],
      javascript_support_verified:true,supported_elements:['baseCommand','hostCommand'],
      required_elements:['baseCommand'],host_overrides:['hostCommand'],required_sources:['workspace-registration'],
      element_types:{baseCommand:'string',hostCommand:'string'},
      narrow_scope_sufficient:true,unrelated_content_preserved:true,stale_write_rejected:true,supported_administrative_review:true,
      replacement_recoverable:true,approval_dependencies_reconciled:true,active_duplicates_absent:true}};
  const template=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../dist/templates/oop-runtime-adapter.js'),'utf8');
  result.configuration_plan.framework_entrypoint='/private/common/oop-enforce.js';
  result.configuration_plan.routes.forEach(r=>r.entrypoint=result.configuration_plan.framework_entrypoint);
  const invocation={representation:'argv',executable:'/fixture/js',arguments:[result.configuration_plan.framework_entrypoint]};
  result.configuration_plan.invocation=invocation;
  result.configuration_plan.adapter_preparation={source:require('./oop-runtime-adapter.cjs').complete(template),obligations:[{id:'supported_commands',disposition:'implemented',reason:'complete synthetic mapping'}]};
  Object.assign(result.configuration_observation,{resolved_controller_entrypoint:result.configuration_plan.framework_entrypoint,adapter_preparation_verified:true,adapter_contract:{supported_commands:['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe','declare','load','worklog-append','worklog-read'],placeholders:{}},launch_observation:{invocation,host:'fixture-host',runtime_version:runtimeVersion,native_conventions_verified:true,parser_reference:'fixture:documented-argv'}});
  const contract=require('../installation-contract.cjs');
  const inputs={controller:{reference:result.configuration_plan.framework_entrypoint,identity:'sha256:'+'c'.repeat(64)},
    template:{reference:'/private/common/dist/templates/oop-runtime-adapter.js',identity:'sha256:'+require('node:crypto').createHash('sha256').update(template).digest('hex')},
    working_copy:entrypoint,context:[{reference:'fixture:capabilities-closure',identity:'sha256:'+'d'.repeat(64)}],
    documentation:result.configuration_observation.official_sources};
  result.configuration_plan.adapter_preparation.workflow={inputs,candidate_identity:contract.configurationIdentity(result.configuration_plan.adapter_preparation.source),
    stages:contract.adapterDevelopmentSteps.slice(0,6).map(step=>({step,reference:'fixture:'+step,assurance:'runtime_declaration'}))};
  result.configuration_observation.adapter_preparation_inputs=structuredClone(inputs);
  result.configuration_validation={format:1,type:'oop_configuration_validation',request_id:'fixture-validation',
    source_binding:require('../../dist/enforcement-install.json').source_binding,
    ...require('../installation-contract.cjs').validateConfiguration(result.configuration_plan,result.configuration_observation),error:false};
  return result;
};
