'use strict';
// Maintainer/reference helpers. Supplied observations never authenticate themselves.
const {isDeepStrictEqual:equal}=require('node:util');
function resolveClause(module,fragment) {
  const target=module?.clause_index?.[fragment];
  const contract=module?.contracts?.find(c=>c.id===target?.contract_id);
  if(!contract||typeof target.heading!=='string'||contract.semantic_clause.split('\n').filter(l=>l===target.heading).length!==1)
    throw Error('unresolved_clause_pointer');
  return {contract,heading:target.heading};
}
function contextReceipt(receipt,expected) {
  return !!receipt&&receipt.session===expected.session&&receipt.workspace===expected.workspace&&
    receipt.installation_uid===expected.installation_uid&&equal(receipt.source_binding,expected.source_binding)&&
    receipt.mapping_revision===expected.mapping_revision&&Array.isArray(receipt.modules)&&
    new Set(receipt.modules.map(m=>m.file)).size===receipt.modules.length&&
    expected.modules.every(m=>receipt.modules.some(r=>equal(r,m)));
}
// The backend owns trusted observation, native registration, coordination and effect confinement.
// No CLI is added for migration; this model tests the existing runtime descriptor's transaction.
async function migrateBridge(proposal,backend) {
  let activated=false;
  try {
    const current=await backend.read();
    if(current.revision!==proposal.expected_revision||current.active!==proposal.previous||
      current.ownership_verified!==true||current.replacement_authorized!==true)throw Error('stale_or_unowned_migration');
    const checked=require('./installation-contract.cjs').validateConfiguration(proposal.plan,current.candidate_facts);
    if(!checked.valid||!equal(proposal.validation?.source_binding,current.source_binding)||
      !equal(proposal.validation?.validation_binding,checked.validation_binding)||
      proposal.validation?.dispatch_verified!==false||proposal.validation?.valid!==true||proposal.validation.error!==false||
      proposal.validation.validation_binding?.plan_identity!==require('./installation-contract.cjs').configurationIdentity(proposal.plan))throw Error('invalid_migration_candidate');
    await backend.stage(proposal); // Preserve the prior active entry until conditional activation.
    const result=await backend.activate(proposal.expected_revision,proposal);
    activated=true;
    const observed=await backend.read();
    if(observed.revision!==result.revision||observed.active!==proposal.plan.bridge.entrypoint||
      observed.routes.some(r=>r.entrypoint!==observed.active)||observed.references_intact!==true)throw Error('migration_readback_unresolved');
    await backend.retire(proposal.previous,{inactive:true,preserve_historical_references:true});
    return {verified:true,phase:'checkpointed',revision:result.revision};
  }catch{return {verified:false,phase:activated?'activated_pending_checkpoint':'staged',preserve_prior:true};}
}
module.exports={resolveClause,contextReceipt,migrateBridge};
