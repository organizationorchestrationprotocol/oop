// Producer/reference mechanisms only. Supplied observations are synthetic until
// an installed runtime independently obtains scope-bound authoritative facts.
// An initial distribution has no predecessor; updates describe one reviewed step.
import { validateEnforcementImpact } from './enforcement-contract.mjs';
import { createHash } from 'node:crypto';
import { validateProfile } from './schema-profile.mjs';
import { validateSupportCatalog, classifySupportedState, supportContentIdentity } from './migration-support.mjs';
export const digest = value => 'sha256:'+createHash('sha256').update(value).digest('hex');
export const scopes = ['common','runtime','operations'];
export const paths = ['migrations/index.json','migrations/common.json','migrations/runtime.json','migrations/operations.json','migrations/compatibility.json'];
const nonempty = value => typeof value === 'string' && !!value.trim();
const fixed = {common:'migrations/common.json',runtime:'migrations/runtime.json',operations:'migrations/operations.json'};
const owners = {common:'runtime',runtime:'runtime',operations:'organization'};

export function migrationBundle(sourceIdentity, support, sourceContract) {
  validateSupportCatalog(support);
  validateEnforcementImpact(support.enforcement_transition);
  const binding={source_identity:sourceIdentity,source_contract:sourceContract};
  const enforcement={...support.enforcement_transition,input_states:['no_prior_engine','owned_active_engine','interrupted_candidate'],
    preconditions:['owned_state','compatible_adapter','exclusive_update','current_authority'],
    already_satisfied:'Owned adapter readers accept the current interface and actual administrative receipts remain valid; SHA/status alone is insufficient.',
    actions:['stage_one_candidate','reconcile_strict_readers','activate_with_phase_journal','verify_owned_checkpoint','cleanup_when_no_ongoing_users'],
    verification:['actual_installation_or_reuse_receipts','required_native_consent','required_restart','real_errors_absent','checkpoint_coherence'],
    recovery:'Inspect actual active configuration and journal phase under an exclusive owned lock; preserve verified active on staging failure; reconcile activated_pending_checkpoint before advancement. Never remove ongoing/recovery code or advance peer adoption.',
    retention:'one active plus at most one ordinary transient candidate; no historical snapshots',
    target_commit:'Resolve containing OOP Git commit after publication; never a future self-SHA.'};
  const step={from:support.previous?.profile_id??null,to:support.current.profile_id};
  const bundle={};
  const indexScopes={};
  for(const scope of scopes) {
    const spec=support.scopes?.[scope];
    if(!spec || !['not_required','required','unknown'].includes(spec.disposition)) throw Error('Invalid migration support: scope '+scope);
    if(spec.disposition==='not_required'){indexScopes[scope]={disposition:'not_required',rationale:spec.rationale};continue;}
    if(spec.disposition==='unknown'){indexScopes[scope]={disposition:'unknown',reason:spec.reason,next_action:spec.next_action};continue;}
    indexScopes[scope]={disposition:'required',descriptor:fixed[scope]};
    bundle[fixed[scope]]={format:1,...binding,migration_id:spec.migration_id,requirement_ids:[spec.migration_id],step,destination:scope,
      organizational_state_change:spec.organizational_state_change,scope:owners[scope],affected_domains:spec.affected_domains,dependencies:[],
      applicability:'Observed '+scope+' state matches the previous-version profile and current authority applies.',
      source_semantics:'Previous-version '+scope+' state: '+support.previous.state_signature[scope].state_schema+'.',
      target_semantics:'Current-version '+scope+' state: '+support.current.state_signature[scope].state_schema+'.',
      authority:'Existing private ownership or canonical operations signing/access/expected-ref policy; no new authority.',
      preconditions:['resolve_project_and_owner','previous_version_state_observed','compatible_access','actual_effects_reconciled'],
      postconditions:['current_version_state_verified','prior_facts_preserved'],
      already_satisfied:spec.already_satisfied,
      verification:'Observe actual state and attributable sufficient evidence; remote publication requires signed canonical readback.',
      recovery:'Retain previous adoption and actual partial effects; inspect before retry and block only dependent unsafe work.',
      actions:spec.actions.map(action=>({scope:owners[scope],action})),
      alignment_publication:scope==='operations'?'required_if_relevant_evidence_absent':'not_required',
      no_downgrade:true,...(scope==='runtime'?{enforcement}:{})};
  }
  bundle['migrations/index.json']={format:1,...binding,enforcement,specification_id:'oop-migration-distribution-v1',step,
    requirement_ids:scopes.filter(s=>indexScopes[s].disposition==='required').map(s=>support.scopes[s].migration_id),
    target_identity:'Resolve obtained canonical repository/ref/full commit metadata; no future self-SHA.',
    scopes:indexScopes,compatibility:'migrations/compatibility.json',unknown:'Missing required descriptor/facts is UNKNOWN, never no-op.'};
  bundle['migrations/compatibility.json']={format:1,...binding,enforcement,contract_id:'oop-supported-state-reconciliation-v1',
    previous:structuredClone(support.previous),current:structuredClone(support.current),
    support_content_identity:supportContentIdentity(support),support_evidence:support.review_evidence,
    unsupported:'Any other observed state is unsupported: retain verified adoption facts, block dependent unsafe work and perform a fresh runtime bootstrap preserving organizational data, private secrets and peer state.'};
  return bundle;
}

export function validateMigrationBundle(bundle, schema, expectedSource) {
  const fail=reason=>{throw Error('Invalid migration bundle: '+reason);};
  for(const path of Object.keys(bundle)) if(!paths.includes(path)) fail('unapproved path');
  const index=bundle['migrations/index.json'], compatibility=bundle['migrations/compatibility.json'];
  if(!index || !compatibility) fail('missing index/compatibility');
  if(/\b[0-9a-f]{40}\b/.test(JSON.stringify(bundle))) fail('commit identity');
  for(const value of Object.values(bundle)) {
    const errors=validateProfile(value,schema);
    if(errors.length || value.source_identity!==expectedSource || !nonempty(value.source_contract)) fail('schema/source binding');
  }
  if(index.specification_id!=='oop-migration-distribution-v1' || index.compatibility!=='migrations/compatibility.json' || !nonempty(index.target_identity) || !Array.isArray(index.requirement_ids)) fail('index contract');
  if(index.step?.from!==(compatibility.previous?.profile_id??null) || index.step?.to!==compatibility.current?.profile_id) fail('single step');
  if(!index.scopes || JSON.stringify(Object.keys(index.scopes).sort())!==JSON.stringify([...scopes].sort())) fail('scope closure');
  const ids=new Set();
  for(const scope of scopes) {
    const state=index.scopes[scope];
    if(compatibility.previous===null&&state.disposition!=='not_required')fail('initial scope migration');
    if(!['not_required','required','unknown'].includes(state.disposition)) fail('disposition');
    const descriptor=bundle[fixed[scope]];
    if(state.disposition==='not_required' && (!nonempty(state.rationale) || state.descriptor || descriptor)) fail('ambiguous no-op');
    if(state.disposition==='required') {
      if(state.descriptor!==fixed[scope] || !descriptor || descriptor.destination!==scope) fail('missing/exact descriptor');
      for(const field of ['migration_id','scope','applicability','source_semantics','target_semantics','authority','already_satisfied','verification','recovery']) if(!nonempty(descriptor[field])) fail(field);
      if(ids.has(descriptor.migration_id)) fail('duplicate migration identity');ids.add(descriptor.migration_id);
      if(!index.requirement_ids.includes(descriptor.migration_id) || JSON.stringify(descriptor.step)!==JSON.stringify(index.step)) fail('requirement/step binding');
      if(typeof descriptor.organizational_state_change!=='boolean' || descriptor.scope!==owners[scope]) fail('ownership/state change');
      for(const field of ['requirement_ids','affected_domains','preconditions','postconditions','actions']) if(!Array.isArray(descriptor[field]) || !descriptor[field].length) fail(field);
      if(!Array.isArray(descriptor.dependencies) || descriptor.no_downgrade!==true) fail('dependencies/preservation');
      if(!descriptor.actions.every(a=>['runtime','organization'].includes(a.scope) && nonempty(a.action))) fail('action ownership');
    } else if(state.disposition==='unknown' && (!nonempty(state.reason) || !nonempty(state.next_action))) fail('unknown recovery');
  }
  if(ids.size!==index.requirement_ids.length) fail('requirement closure');
  for(const path of ['migrations/index.json','migrations/runtime.json','migrations/compatibility.json']) {
    if(path==='migrations/runtime.json' && !bundle[path] && index.scopes.runtime.disposition!=='required') continue;
    validateEnforcementImpact(bundle[path]?.enforcement);
    if(JSON.stringify(bundle[path].enforcement)!==JSON.stringify(index.enforcement)) fail('inconsistent enforcement disposition');
  }
  if(!nonempty(compatibility.unsupported)) fail('support boundary');
  validateSupportCatalog({format:1,source_contract:compatibility.source_contract,previous:compatibility.previous,current:compatibility.current,review_evidence:compatibility.support_evidence});
  return true;
}

// Planning/verification reference, no filesystem/provider effects. Evidence must
// be supplied by an actual installed observation mechanism for real adoption.
export function reconcileMigration({bundle,profile,project,root,runtime,target,previous,observations,authority,contextVerified,observedAt}) {
  const classification=classifySupportedState({bundle,project,root,runtime,observations,observedAt});
  const compatibility=bundle['migrations/compatibility.json'];
  const role=classification.state==='CURRENT'?'current':classification.state==='SUPPORTED'?'previous':null;
  const selected=role&&(!profile||profile===compatibility[role].profile_id)?compatibility[role]:null;
  const index=bundle['migrations/index.json'];
  const dispositions={};
  for(const scope of scopes) {
    const policy=index.scopes[scope], fact=observations?.[scope], descriptor=bundle[fixed[scope]];
    const owner=scope==='common'?root:scope==='runtime'?runtime:project;
    const next=state=>({state,next_action:state==='UNKNOWN'?(classification.state==='UNSUPPORTED'?classification.next_action:'Obtain scoped actual facts or reviewed recovery.'):state==='PENDING'?'Verify/reconcile remaining owned action or canonical publication.':state==='BLOCKED'?'Resolve compatibility or authority without replay.':'Reuse current scoped evidence.'});
    if(!selected || !fact || fact.project!==project || fact.owner!==owner || !nonempty(fact.evidence) || fact.current!==true || (fact.partial!==undefined && (!nonempty(fact.partial) || fact.partial==='unknown')) ||
      fact.authenticated!==true || !Number.isFinite(Date.parse(observedAt)) || fact.observed_at!==observedAt ||
      selected.state_signature[scope].state_schema!==fact.state_schema) {dispositions[scope]=next('UNKNOWN');continue;}
    if(typeof fact.compatible!=='boolean' || (fact.conflict!==undefined && typeof fact.conflict!=='boolean')) {dispositions[scope]=next('UNKNOWN');continue;}
    if(fact.compatible===false || fact.conflict===true) {dispositions[scope]=next('BLOCKED');continue;}
    if(policy.disposition==='unknown') {dispositions[scope]=next('UNKNOWN');continue;}
    if(typeof fact.verified!=='boolean' || ['applied','ahead','applied_this_attempt'].some(field=>fact[field]!==undefined && typeof fact[field]!=='boolean')) {dispositions[scope]=next('UNKNOWN');continue;}
    if(policy.disposition==='not_required' || role==='current') {dispositions[scope]=next(fact.verified===true?(policy.disposition==='not_required'?'NOT_REQUIRED':'ALREADY_SATISFIED'):'PENDING');continue;}
    if(fact.applied===true && fact.verified!==true) {dispositions[scope]=next('PENDING');continue;}
    if(!Array.isArray(fact.requirements) || !Array.from(fact.requirements).every(nonempty)) {dispositions[scope]=next('UNKNOWN');continue;}
    if(fact.verified===true && fact.requirements.includes(descriptor.migration_id)) {
      if(scope==='operations' && (typeof fact.alignmentRelevant!=='boolean' ||
        (fact.alignmentRelevant===true && ['canonical','remoteReadback','signed'].some(field=>typeof fact[field]!=='boolean')))) {dispositions[scope]=next('UNKNOWN');continue;}
      const publication=scope!=='operations' || fact.alignmentRelevant===false || (fact.canonical===true && fact.remoteReadback===true && fact.signed===true);
      dispositions[scope]=next(publication?(fact.applied_this_attempt===true?'UPDATE_APPLIED_VERIFIED':'ALREADY_SATISFIED'):'PENDING');continue;
    }
    // Advanced state must be interpreted for compatibility, never overwritten.
    if(fact.ahead===true || authority?.[scope]?.allowed!==true || !nonempty(authority?.[scope]?.expectedRevision) || authority?.[scope]?.exclusive!==true) {dispositions[scope]=next('BLOCKED');continue;}
    dispositions[scope]=next('PENDING');
  }
  const complete=scopes.every(scope=>['UPDATE_APPLIED_VERIFIED','ALREADY_SATISFIED','NOT_REQUIRED'].includes(dispositions[scope].state));
  const adopt=complete && ['SUPPORTED','CURRENT'].includes(classification.state) && contextVerified===true && /^[a-f0-9]{40}$/.test(target);
  return {classification,dispositions,verified_commit:adopt?target:previous,pending_target:adopt?null:target,adopted:adopt,
    authority:'Reference decisions do not authenticate supplied facts, persist checkpoints or execute effects.'};
}
