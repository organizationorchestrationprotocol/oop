'use strict';
// Synthetic producer fixtures only; no real credential or native-state attestation.
const c=require('../installation-contract.cjs');
function machine(uid='fixture',runtime='same-runtime-class',fingerprint='SHA256:fixture-'+uid){
  const authentication_identity={scheme:'ssh-sha256',fingerprint,credential_reference:'common:authentication:'+fingerprint};
  return {format:1,record_type:'machine_installation',machine_id:c.machineId(authentication_identity),authentication_identity,
    owner_name:'Explicit Owner',owner_email:'owner@example.invalid',collaborator_kind:'human',historical_machine_ids:[],signing_identities:[],
    runtimes:[{installation_uid:uid,runtime_id:runtime,first_installed_at:'2026-10-24T09:00:00Z',first_installation_evidence:'fixture:BOOT-12'}]};
}
function normalMode(request){const c=request.context;return {origin:'authoritative_observation',current:true,reference:'fixture:local-mode',mode:'normal',
  project:c.project,runtime_uid:c.installation_uid,machine_id:c.machine_id,checkpoint_ref:c.checkpoint_ref,checkpoint_revision:c.checkpoint_revision,expected_revision:c.revision,
  mapping_revision:c.mapping_revision,authority:c.authority,request_id:request.request_id,action_scope:c.action_scope,dependencies:structuredClone(c.dependencies),
  observed_at:c.observed_at,expires_at:new Date(Date.parse(c.observed_at)+60000).toISOString()};}
module.exports={machine,normalMode};
