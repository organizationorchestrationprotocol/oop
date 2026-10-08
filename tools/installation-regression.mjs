// Maintainer-only semantic dependency projection. No native hooks are invoked.
export function validateAdministrativeContract({bootstrap,interfaces,manifest,migrations,schema,examples=[],consumer_clauses=[],dependencies={}}) {
  const forbidden=new Set(['activation_verified','formal_enablement_verified','scoped_binding_plan_current_complete',
    'mandatory_configuration_readback_verified','dispatch_verified','semantic_coverage_verified','full_runtime_suitability_verified']);
  const roots=[...bootstrap.steps.filter(s=>['BOOT-12','BOOT-13'].includes(s.id)).flatMap(s=>s.guard.all.map(g=>g.fact)),
    ...bootstrap.installation.requires,...bootstrap.transitions.filter(t=>['installed','installation_verified'].includes(t.to)).flatMap(t=>t.requires)];
  const allowed=new Set(['complete_initial_inventory','frozen_initial_installation_set','installed_enforcement','verified:BOOT-12',
    'C','U','R','not_E','verified:BOOT-13','scoped_readiness_evidence_persisted','installation_prerequisites_verified',
    'independent_bootstrap_prerequisites_complete','readiness_evidence_current','identity_registration_commit_verified',
    'identity_registration_content_verified','identity_registration_publication_verified','final_publication_checkpoint_persisted','selected_effective_credential_verified']);
  const graph={installed_enforcement:['C','U','R','not_E'],...dependencies};
  const seen=new Set();
  function visit(f,active=new Set()) {
    if(forbidden.has(f) || active.has(f))throw Error('Forbidden or cyclic installation dependency: '+f);
    if(seen.has(f))return;
    if(!allowed.has(f) && !Object.hasOwn(graph,f))throw Error('Unreviewed installation prerequisite: '+f);
    seen.add(f);for(const next of graph[f]??[])visit(next,new Set([...active,f]));
  }
  roots.forEach(f=>visit(f));
  const verifyRequired=(value)=>{
    if(Array.isArray(value))value.forEach(verifyRequired);
    else if(value && typeof value==='object')for(const [key,item] of Object.entries(value)){
      if(['required','requires','preconditions','postconditions','verification','requirements','predicates'].includes(key) &&
        Array.isArray(item) && item.some(x=>forbidden.has(x)&&!(x==='dispatch_verified'&&value.properties?.type?.const==='oop_configuration_validation'&&value.properties?.dispatch_verified?.const===false)))throw Error('Forbidden schema/profile dependency');
      verifyRequired(item);
    }
  };
  for(const value of [schema,migrations,interfaces,manifest])verifyRequired(value);
  // Bounded regressions for previously affirmative consumer advice, not a
  // general natural-language classifier. Canonical prohibition examples remain valid.
  for(const text of [...examples,...consumer_clauses])if(['test allowed/denied paths','test native allow/deny/error propagation',
    'then activate and verify formal installation and effective enablement by authoritative readback',
    'BOOT-12 installed-path probes','exercises its own installed routing and allowed/denied control paths',
    'checks their actual allowed and denied paths before full readiness','install/probe actual controls',
    'during bootstrap use install/readback only','all mandatory enabled/authorized controls effectively read back',
    'installed-control probes remain consumer-local requirements','revalidate selected common-private effective credential, activation/readback'].some(advice=>text.includes(advice)))
    throw Error('Obsolete consumer installation advice');
  if(bootstrap.format!==1 || manifest.format!==1 || interfaces.installation_binding.installation_contract!==1 ||
    manifest.installation.acknowledgment!=='direct_administrative_result' || manifest.installation.coverage_reassessment!==false ||
    manifest.installation.active_hook_tests!==0 || manifest.features.some(f=>f.verification.basis!=='direct_administrative_acknowledgment' ||
      f.shareability.selection!=='all_distinct_eligible_reuse_equivalents'))throw Error('Obsolete installation contract');
  for(const command of Object.values(interfaces.enforcement.commands))if(command.required.some(f=>forbidden.has(f)))throw Error('Obsolete controller guard');
  for(const descriptor of Object.values(migrations))if(descriptor.enforcement?.verification?.some(f=>
    forbidden.has(f) || ['formal_installation','effective_enablement','semantic_coverage'].includes(f)))throw Error('Obsolete migration verification');
  if(!bootstrap.steps.find(s=>s.id==='BOOT-13').guard.all.some(g=>g.fact==='identity_registration_publication_verified'))throw Error('Missing real publication');
  return [...seen].sort();
}
