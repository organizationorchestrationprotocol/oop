'use strict';
const {isDeepStrictEqual:equal}=require('node:util');
const {validateManifest,identity}=require('./enforcement-install.cjs');
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const text=x=>typeof x==='string' && x.length>0;
// Host authenticates this complete inventory outside the model/request boundary.
function planInstallation(manifest,capabilities,facts,installed={},options={}) {
  const fail=reason=>({status:'BLOCKED_OR_LIMITED',plan_complete:false,mapping_complete:false,coverage_complete:false,
    installation_verified:false,diagnostics_format:1,reason,registrations:[],actions:[],
    full_readiness:false,bootstrap_complete:false,effect_permission:'not_granted',active_hook_tests:0});
  if(!validateManifest(manifest,options.expectedSourceBinding))return fail('invalid_installation_manifest');
  const {validateConfiguration}=require('./installation-contract.cjs');
  const configuration=validateConfiguration(facts?.configuration_plan,facts?.configuration_observation);
  if(!configuration.valid)return fail(configuration.reason);
  const validation=facts.configuration_validation;
  if(validation?.type!=='oop_configuration_validation'||validation.format!==1||validation.valid!==true||validation.error!==false||
    validation.dispatch_verified!==false||!equal(validation.source_binding,options.expectedSourceBinding)||
    !equal(validation.validation_binding,configuration.validation_binding))return fail('configuration_validation_missing_or_stale');
  if(facts.configuration_observation.workspace!==options.scope?.project||
    facts.configuration_observation.runtime_version!==facts.dependencies?.runtime_build||
    facts.configuration_observation.configuration_revision!==facts.dependencies?.configuration)return fail('configuration_binding_mismatch');
  const d=facts?.dependencies,s=options.scope;
  // Supported future delegation comes from documented capability metadata,
  // never from whether a delegate happened to run during installation.
  const delegationSupported=facts?.delegation_supported===true || (Array.isArray(capabilities) &&
    capabilities.some(c=>object(c) && c.available===true && Array.isArray(c.features) && c.features.includes('delegate'))) ||
    (Array.isArray(facts?.paths) && facts.paths.some(p=>object(p) && ['delegate_start','delegate_finish'].includes(p.phase)));
  const current=x=>object(x) && x.origin==='authoritative_observation' && text(x.reference) &&
    equal(x.scope,s) && equal(x.dependencies,d) && Number.isFinite(options.now) &&
    Date.parse(x.observed_at)<=options.now && options.now<Date.parse(x.expires_at);
  if(!object(s) || !['project','runtime','authority','revision'].every(k=>text(s[k])) ||
    !object(d) || !['source','runtime_build','permissions','configuration','capabilities'].every(k=>text(d[k])) ||
    d.source!==manifest.source_binding.source_identity || (typeof options.adoptedCommit!=='string' || ![40,64].includes(options.adoptedCommit.length) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(options.adoptedCommit)) ||
    !current(facts) || facts.complete!==true || !['effects_possible','resumable'].every(k=>typeof facts[k]==='boolean') ||
    (facts.delegation_supported!==undefined && typeof facts.delegation_supported!=='boolean') ||
    (facts.phase_assessments!==undefined && (!Array.isArray(facts.phase_assessments) || facts.phase_assessments.length>128 || facts.phase_assessments.some(a=>!object(a)))) ||
    !Array.isArray(facts.paths) || !facts.paths.length || facts.paths.length>128 ||
    facts.paths.some(p=>!object(p) || !text(p.path) || !text(p.phase) ||
      ['effect_class','resource_class','authority_scope'].some(k=>p[k]!==undefined && !text(p[k]))) ||
    new Set(facts.paths.map(p=>JSON.stringify([p.phase,p.path,p.effect_class,p.resource_class,p.authority_scope]))).size!==facts.paths.length ||
    !Array.isArray(capabilities) || capabilities.length>128 ||
    (facts.requirement_assessments!==undefined && (!Array.isArray(facts.requirement_assessments) ||
      facts.requirement_assessments.length>128 || facts.requirement_assessments.some(a=>!object(a)) ||
      new Set(facts.requirement_assessments.map(a=>JSON.stringify(a.requirement))).size!==facts.requirement_assessments.length)) ||
    (!facts.effects_possible && facts.paths.some(p=>['before_effect','after_effect'].includes(p.phase))) ||
    (!delegationSupported && facts.paths.some(p=>['delegate_start','delegate_finish'].includes(p.phase))) ||
    (!facts.resumable && facts.paths.some(p=>p.phase==='resume_before_effect')))return fail('incomplete_or_stale_host_inventory');
  const requirements=[],dispositions=[];
  for(const f of manifest.features) {
    const applicable=f.feature==='probe'?false:f.feature==='delegate'?delegationSupported:
      ['pre-effect','post-effect'].includes(f.feature)?facts.effects_possible:true;
    if(!applicable){dispositions.push({feature:f.feature,status:'not_applicable',assessment_state:'assessed',
      reason:f.feature==='probe'?'separately_authorized_post_bootstrap_only':'observed_scope_inapplicable',
      evidence:{origin:facts.origin,reference:facts.reference},consequence:'excluded_from_current_required_coverage',
      next_action:'reassess_on_scope_change',basis:f.feature==='probe'?'separately_authorized_post_bootstrap_only':facts.reference});continue;}
    for(const phase of f.phases.filter(p=>p!=='resume_before_effect'||facts.resumable)){
      const paths=facts.paths.filter(p=>p.phase===phase);
      if(!paths.length){
        const a=facts.phase_assessments?.find(a=>a.phase===phase);
        if(!object(a) || !['unsupported','not_applicable'].includes(a.status) ||
          !['reason','evidence_reference','consequence','next_action'].every(k=>text(a[k])) ||
          facts.phase_assessments.filter(x=>x.phase===phase).length!==1 ||
          capabilities.some(c=>object(c) && current(c.provenance) && equal(c.scope,s) && c.available===true && Array.isArray(c.phases) && c.phases.includes(phase)))
          return fail('missing_mandatory_phase:'+phase);
        dispositions.push({feature:f.feature,phase,status:a.status,assessment_state:'assessed',reason:a.reason,
          evidence:{origin:facts.origin,reference:a.evidence_reference},consequence:a.consequence,next_action:a.next_action});
        continue;
      }
      for(const p of paths)requirements.push({feature:f.feature,phase,path:p.path,minimum_tier:f.required_coverage.minimum_tier,
        ...Object.fromEntries(['effect_class','resource_class','authority_scope'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))});
    }
  }
  if(requirements.length>128)return fail('scope_too_large');
  // Do not accept capabilities from another project or stale/unauthenticated source.
  const excluded=capabilities.filter(c=>object(c) && text(c.id) && current(c.provenance) && equal(c.scope,s) &&
    c.disabled!==true && c.revoked!==true && object(c.assessment) &&
    ['reason','evidence_reference','consequence','next_action'].every(k=>text(c.assessment[k])) &&
    ((c.assessment.status==='unsupported' && c.available===false) ||
     (c.assessment.status==='unauthorized' && c.available===true && c.authorized===false) ||
     (c.assessment.status==='incompatible' && c.compatible===false)));
  const eligible=capabilities.filter(c=>!excluded.includes(c) && object(c) && current(c.provenance) && equal(c.scope,s) &&
    ['features','paths','phases'].every(k=>Array.isArray(c[k]) && c[k].length>0 && c[k].length<=128 && c[k].every(text)) &&
    object(c.runtime_adapter) && ['entrypoint','interpreter','ownership_reference'].every(k=>text(c.runtime_adapter[k])) &&
    c.runtime_adapter.controller_interface===manifest.controller_interface &&
    c.features?.every(f=>manifest.features.find(x=>x.feature===f)?.capability_classes.includes(c.capability_class)));
  if(eligible.some(c=>c.runtime_adapter.entrypoint!==facts.configuration_plan.runtime_adapter.entrypoint||
    c.runtime_adapter.interpreter!==facts.configuration_plan.runtime_adapter.language))return fail('runtime_adapter_bypass');
  const {planBindings,coversDimensions}=require('./enforcement-adapter.cjs');
  const planned=planBindings(eligible.map(c=>({...c,authorized:c.authorized===true || c.authorized==='pending_native_consent'})),requirements,d,installed,options);
  if(!Array.isArray(planned.uncovered))return fail('invalid_binding_plan');
  for(const requirement of requirements){
    const group=planned.registrations.find(g=>g.coverage.some(r=>equal(r,requirement)));
    const candidates=eligible.filter(c=>c.features.includes(requirement.feature) && c.paths.includes(requirement.path) && c.phases.includes(requirement.phase) && coversDimensions(c,requirement));
    // A missing/invalid observation is not evidence of absent host support. Keep the
    // legacy unknown wire label; assessment_state makes unfinished discovery explicit.
    const negative=excluded.filter(c=>Array.isArray(c.features) && c.features.includes(requirement.feature) && Array.isArray(c.phases) && c.phases.includes(requirement.phase) &&
      (!Array.isArray(c.paths) || c.paths.includes(requirement.path)));
    const assessment=facts.requirement_assessments?.find(a=>equal(a.requirement,requirement)) ??
      (negative.length && negative.every(c=>c.assessment.status===negative[0].assessment.status)?negative[0].assessment:undefined);
    const supportedAssessment=object(assessment) && ['unsupported','unauthorized','incompatible','blocked'].includes(assessment.status) &&
      ['reason','evidence_reference','consequence','next_action'].every(k=>text(assessment[k])) &&
      (assessment.status!=='blocked' || ['dependency','responsible_actor','resume_condition','alternatives_checked'].every(k=>text(assessment[k])));
    const all=predicate=>candidates.length>0 && candidates.every(predicate);
    let status=group?'selected':all(c=>c.available===false)?'unsupported':
      all(c=>c.authorized===false)?'unauthorized':all(c=>c.disabled===true)?'blocked':'unknown';
    if(!group && supportedAssessment)status=assessment.status;
    const reasons={selected:'all_distinct_eligible_bindings_selected',unsupported:'observed_capability_unavailable',
      unauthorized:'observed_authority_missing',blocked:'observed_enablement_dependency',unknown:'compatible_coverage_not_established'};
    dispositions.push({requirement,status,assessment_state:status==='unknown'?'to_be_assessed':'assessed',
      reason:!group && supportedAssessment?assessment.reason:reasons[status],
      evidence:{origin:facts.origin,reference:!group && supportedAssessment?assessment.evidence_reference:facts.reference,
        capability_references:candidates.map(c=>c.provenance.reference)},
      consequence:group?'planned_coverage_only':supportedAssessment?assessment.consequence:'dependent_scope_blocked',
      next_action:group?'materialize_frozen_package_and_obtain_administrative_result':supportedAssessment?assessment.next_action:
        status==='unknown'?'assess_compatible_authorized_alternatives':status==='blocked'?'reconcile_enablement_and_authorized_repair':'recheck_on_capability_or_authority_change',
      ...(!group && supportedAssessment && status==='blocked'?{dependency:assessment.dependency,
        responsible_actor:assessment.responsible_actor,resume_condition:assessment.resume_condition,
        alternatives_checked:assessment.alternatives_checked}:{}),
      ...(!group && !supportedAssessment && status==='blocked'?{dependency:'effective_enablement',
        responsible_actor:s.authority,resume_condition:'actual_required_native_consent',
        alternatives_checked:candidates.map(c=>c.id)}:{}),
      ...(group?{registration:group.registration}:{basis:facts.reference})});
  }
  const complete=planned.uncovered.length===0 && planned.registrations.length>0 && !dispositions.some(d=>d.phase && !d.requirement);
  // Diagnostic completeness never replaces the legacy coverage/admission guard.
  // Malformed/foreign inventory entries remain unexamined, even if others cover it.
  const mappingComplete=eligible.length+excluded.length===capabilities.length && !planned.reason &&
    dispositions.every(d=>d.status!=='unknown');
  // Source-only replacement invalidates enablement evidence, not native ownership.
  // Read back the adopted controller through the same authorized native entrypoint.
  const native=x=>{const {provenance,...rest}=x??{};return rest;};
  if(object(installed?.dependencies) && ['runtime_build','permissions','configuration','capabilities'].every(k=>installed.dependencies[k]===d[k])){
    for(const action of planned.actions){const g=planned.registrations.find(g=>g.registration===action.registration);
      if(installed.registrations?.some(old=>old.registration===g.registration && old.fingerprint===g.fingerprint &&
        equal(native(old.invocation),native(g.invocation)) && equal(old.features,g.features) &&
        equal(old.feature_semantics,g.feature_semantics) && equal(old.coverage,g.coverage) && old.administrative_completed===true))
        action.operation='reuse';
    }
  }
  const expiry=Math.min(Date.parse(facts.expires_at),...eligible.map(c=>Date.parse(c.provenance.expires_at)));
  const mechanismInventory=capabilities.map((c,index)=>{
    if(!object(c))return {id:'invalid:'+index,disposition:'unknown',reference:facts.reference,reason:'malformed_candidate'};
    if(excluded.includes(c))return {id:c.id,registration:c.registration,disposition:c.assessment.status,
      reference:c.assessment.evidence_reference,reason:c.assessment.reason};
    const group=planned.registrations.find(g=>g.registration===c.registration);
    const disposition=!eligible.includes(c)?'unknown':c.revoked===true || c.disabled===true?'unknown':
      c.available===false?'unsupported':c.authorized===false?'unauthorized':
      group?'eligible':c.features.every(f=>f==='probe')?'not_applicable':'unknown';
    return {id:c.id,registration:c.registration,disposition,reference:c.provenance?.reference??facts.reference,
      reason:disposition==='eligible'?'distinct_eligible_mechanism':disposition==='not_applicable'?'diagnostic_not_installation':
        disposition==='unauthorized'?'host_authority_unavailable_or_revoked':disposition==='unsupported'?'documented_unavailable':'unresolved_candidate'};
  });
  const result={...planned,format:1,installation_contract:1,mechanism_inventory:mechanismInventory,type:'oop_scoped_binding_plan',plan_complete:complete,
    diagnostics_format:1,mapping_complete:mappingComplete,coverage_complete:complete,
    installation_verified:complete && planned.registrations.every(g=>g.assurance==='ADMINISTRATIVELY_INSTALLED'),
    manifest_ref:{path:'enforcement-install.json',format:manifest.format,content_identity:manifest.content_identity},
    source_binding:manifest.source_binding,adopted_commit:options.adoptedCommit,scope:s,
    inventory_reference:facts.reference,observed_at:facts.observed_at,expires_at:new Date(expiry).toISOString(),
    configuration_contract:{plan:structuredClone(facts.configuration_plan),observation:structuredClone(facts.configuration_observation)},
    requirements,dispositions,bootstrap_precondition:complete?'COMPLETE_CURRENT_SCOPED_PLAN':'BLOCK_DEPENDENT_SCOPE'};
  return {...result,plan_identity:identity(result)};
}
// BOOT-12 checks a retained plan and its dependencies, never rescans host coverage.
function currentInstallationPlan(plan,options={}){
  if(!object(plan))return false;
  if(plan.installation_contract===1){
    const {plan_identity,...body}=plan;
    return plan_identity===options.expectedPlanIdentity && plan_identity===identity(body) &&
      plan.format===1 && plan.type==='oop_scoped_binding_plan' && !plan.reason &&
      plan.diagnostics_format===1 && plan.mapping_complete===true &&
      require('./installation-contract.cjs').validateConfiguration(plan.configuration_contract?.plan,plan.configuration_contract?.observation).valid &&
      typeof plan.coverage_complete==='boolean' && plan.plan_complete===plan.coverage_complete &&
      Array.isArray(plan.requirements) && plan.requirements.length>0 &&
      Array.isArray(plan.uncovered) && plan.coverage_complete===(plan.uncovered.length===0 && plan.registrations.length>0 && !plan.dispositions.some(d=>d.phase && !d.requirement)) &&
      typeof plan.installation_verified==='boolean' &&
      plan.installation_verified===(plan.coverage_complete && plan.registrations.every(g=>g.assurance==='ADMINISTRATIVELY_INSTALLED')) &&
      Array.isArray(plan.dispositions) && plan.dispositions.every(d=>object(d) && d.assessment_state==='assessed' &&
        ['selected','unsupported','unauthorized','incompatible','blocked','not_applicable'].includes(d.status)) &&
      new Set(plan.dispositions.filter(d=>d.requirement).map(d=>JSON.stringify(d.requirement))).size===plan.dispositions.filter(d=>d.requirement).length &&
      plan.dispositions.every(d=>!d.requirement || (plan.requirements.some(r=>equal(r,d.requirement)) &&
        (d.status!=='selected' || plan.registrations.some(g=>g.registration===d.registration && g.coverage.some(r=>equal(r,d.requirement)))))) &&
      plan.registrations.every(g=>Array.isArray(g.coverage) && g.coverage.length>0 &&
        g.coverage.every(r=>plan.requirements.some(required=>equal(r,required)))) &&
      equal(plan.scope,options.scope) && equal(plan.dependencies,options.dependencies) &&
      equal(plan.source_binding,options.expectedSourceBinding) && plan.adopted_commit===options.adoptedCommit &&
      plan.manifest_ref?.content_identity===options.manifestIdentity && Number.isFinite(options.now) &&
      Date.parse(plan.observed_at)<=options.now && options.now<Date.parse(plan.expires_at) &&
      Array.isArray(plan.mechanism_inventory) && plan.mechanism_inventory.length>0 &&
      new Set(plan.mechanism_inventory.map(c=>c.id)).size===plan.mechanism_inventory.length &&
      plan.mechanism_inventory.every(c=>text(c.id) && text(c.reason) && text(c.reference) &&
        ['eligible','unsupported','unauthorized','incompatible','not_applicable'].includes(c.disposition)) &&
      Array.isArray(plan.registrations) && plan.registrations.every(g=>
        plan.mechanism_inventory.some(c=>c.registration===g.registration && c.disposition==='eligible')) &&
      plan.mechanism_inventory.filter(c=>c.disposition==='eligible').every(c=>plan.registrations.some(g=>g.registration===c.registration)) &&
      plan.effect_permission==='not_granted' && plan.full_readiness===false && plan.bootstrap_complete===false;
  }
  // Invalid plans require current scope-bound inventory and actual receipts.
  return false;
}
module.exports={planInstallation,currentInstallationPlan};
