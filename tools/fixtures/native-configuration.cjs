'use strict';
// Explicitly synthetic documentation/host observations for producer fixtures.
// These do not attest any actual runtime's supported configuration.
module.exports=function nativeConfiguration(workspace,runtimeVersion,revision){
  const uid='fixture-installation-uid',entrypoint='/private/tools/'+uid+'/oop-enforce-bridge.sh';
  const result={configuration_plan:{expected_revision:revision,bridge:{entrypoint,host:'fixture-host',installation_uid:uid,workspace,
    language:'fixture-native-shell',implementation_language:'fixture-native-shell',active:true,delegated_bridge_logic:false,
    policy_authority:'official_controller',profile_independent:true,cwd_independent:true,failure_semantics:'fail_closed'},
    routes:[{entrypoint,host:'fixture-host',installation_uid:uid}],sources:['workspace-registration'],
    elements:[{id:'baseCommand',value:entrypoint,scope:'workspace',purpose:'routing',necessity:'Mandatory generic invocation'},
      {id:'hostCommand',value:entrypoint,scope:'workspace',purpose:'routing',necessity:'Applicable documented host selection'}]},
    configuration_observation:{origin:'authoritative_observation',current:true,reference:'fixture:documentation',workspace,
      host:'fixture-host',runtime_version:runtimeVersion,installation_uid:uid,configuration_revision:revision,
      resolved_bridge_entrypoint:entrypoint,owned_scope_locator:'/private/tools/'+uid,common_scope_locator:'/private/common',
      filesystem_case_sensitive:true,paths_resolved_without_aliases:true,bridge_ownership_verified:true,
      official_sources:[{source:'fixture:official-runtime-specification',section:'registration',reviewed_at:'2026-10-24',host:'fixture-host',runtime_version:runtimeVersion}],
      native_shells:['fixture-native-shell'],native_extensions:{'fixture-native-shell':'sh'},native_support_verified:true,supported_elements:['baseCommand','hostCommand'],
      required_elements:['baseCommand'],host_overrides:['hostCommand'],required_sources:['workspace-registration'],
      element_types:{baseCommand:'string',hostCommand:'string'},
      narrow_scope_sufficient:true,unrelated_content_preserved:true,stale_write_rejected:true,supported_administrative_review:true,
      replacement_recoverable:true,approval_dependencies_reconciled:true,active_duplicates_absent:true}};
  result.configuration_validation={format:1,type:'oop_configuration_validation',request_id:'fixture-validation',
    source_binding:require('../../dist/enforcement-install.json').source_binding,
    ...require('../installation-contract.cjs').validateConfiguration(result.configuration_plan,result.configuration_observation),error:false};
  return result;
};
