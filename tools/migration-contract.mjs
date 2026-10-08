// Producer/reference mechanisms only. Supplied observations are synthetic until
// an installed runtime independently obtains scope-bound authoritative facts.
import { impact as engineImpact, validateEnforcementImpact } from './enforcement-contract.mjs';
import { createHash } from 'node:crypto';
import { validateProfile } from './schema-profile.mjs';
import { validateSupportCatalog, classifySupportedState, supportContentIdentity } from './migration-support.mjs';
export const digest = value => 'sha256:'+createHash('sha256').update(value).digest('hex');
export const scopes = ['common','runtime','operations'];
export const paths = ['migrations/index.json','migrations/common.json','migrations/runtime.json','migrations/operations.json','migrations/compatibility.json'];
const nonempty = value => typeof value === 'string' && !!value.trim();
const fixed = {common:'migrations/common.json',runtime:'migrations/runtime.json',operations:'migrations/operations.json'};

export function migrationBundle(sourceIdentity, supportCatalog, sourceContract, priorCatalog) {
  validateSupportCatalog(supportCatalog,sourceIdentity,priorCatalog);
  const binding={source_identity:sourceIdentity,source_contract:sourceContract};
  const enforcement={...engineImpact,input_states:['no_prior_engine','owned_active_engine','interrupted_candidate'],
    preconditions:['owned_state','compatible_adapter','exclusive_update','current_authority'],
    already_satisfied:'Actual administrative installation or equivalent reuse receipts, required native consent and restart, no unresolved real error, matching owned scope and checkpoint. Unknown original completion time remains unknown; missing dispatch evidence never blocks. SHA/status alone is insufficient.',
    actions:['stage_one_candidate','reconcile_administrative_receipts_without_hook_tests','complete_C_U_R_E_without_functionality_certification','activate_with_phase_journal','verify_owned_checkpoint','cleanup_when_no_ongoing_users'],
    installation_status:'Contract 2: migrate old pending states only from actual C/U/R/E receipts and contemporaneous consents, never labels alone. Reuse unchanged approvals without synthetic tests. BOOT-12 completes enforcement installation; BOOT-13 independently verifies only canonical machine registration; all technical status/receipts stay local. Preserve unknown historical completion time and record recognition time separately; uncertain metadata defers wrapper evolution only.',
    verification:['actual_installation_or_reuse_receipts','required_native_consent','required_restart','real_errors_absent','checkpoint_coherence'],
    recovery:'Inspect actual active configuration and journal phase under an exclusive owned lock; preserve verified active on staging failure; reconcile activated_pending_checkpoint before advancement. Never remove ongoing/recovery code or advance peer adoption.',
    retention:'one active plus at most one ordinary transient candidate; no historical snapshots',
    target_commit:'Resolve containing OOP Git commit after publication; never a future self-SHA.'};
  const requirement='oop-machine-registry-bridge-maintenance-v2';
  const descriptor=(destination,action,owner)=>({format:1,...binding,migration_id:requirement+'-'+destination,
    requirement_ids:[requirement,'oop-installation-identity-history-native-v1','oop-three-scope-alignment-v1'],destination,organizational_state_change:false,scope:owner,
    affected_domains:[destination==='runtime'?'owned_integration_context':'canonical_alignment_evidence'],
    dependencies:[],applicability:'Current supported profile, actual applicable requirements and current authority.',
    source_semantics:'Supported existing OOP private/organizational state; preserve valid prior facts.',
    target_semantics:'Verified independent scope under current three-scope adoption contract.',
    authority:'Existing private ownership or canonical operations signing/access/expected-ref policy; no new authority.',
    preconditions:['resolve_project_and_owner','supported_actual_state','compatible_access','actual_effects_reconciled'],
    postconditions:['applicable_requirements_verified','prior_facts_preserved'],
    already_satisfied:'Current scope-bound actual facts and stable requirement evidence; SHA/flag alone insufficient.',
    verification:'Observe actual state and attributable sufficient evidence; remote publication requires signed canonical readback.',
    recovery:'Retain old adoption and actual partial effects; inspect before retry and block only dependent unsafe work.',
    actions:[{scope:owner,action}],
    alignment_publication:destination==='operations'?'required_if_relevant_evidence_absent':'not_required',
    no_downgrade:true});
  return {
    'migrations/index.json':{format:1,...binding,enforcement,specification_id:'oop-migration-distribution-v1',requirement_ids:['oop-bridge-installation-v1',requirement,'oop-installation-identity-history-native-v1','oop-three-scope-alignment-v1'],
      target_identity:'Resolve obtained canonical repository/ref/full commit metadata; no future self-SHA.',
      scopes:{common:{disposition:'required',descriptor:fixed.common},
        runtime:{disposition:'required',descriptor:fixed.runtime},operations:{disposition:'required',descriptor:fixed.operations}},
      compatibility:'migrations/compatibility.json',unknown:'Missing required descriptor/facts is UNKNOWN, never no-op.'},
    'migrations/common.json':{...descriptor('common','Resolve current workspace ownership and the authorized persistent-runtime mapping. Inventory eligible legacy records; publish one authoritative checkpoint mapping and explicit supersession under conflict-safe recoverable coordination. Reuse an already satisfied mapping; never alter another runtime or secrets.','runtime'),
      requirement_ids:[requirement,'oop-installation-identity-history-native-v1','oop-persistent-runtime-checkpoint-v1'],
      affected_domains:['owned_runtime_topology_and_supersession'],
      already_satisfied:'Current authoritative mapping uniquely resolves this persistent runtime and checkpoint, with ownership decision, expected revision and sufficient attributable evidence. Session IDs or a pathname alone never suffice.',
      recovery:'Reread mapping, supersession and actual checkpoint under scoped conflict-safe coordination before retry; retain historical records and partial effects, never publish competing current authority.'},
    'migrations/runtime.json':{...descriptor('runtime','Reconcile owned adapters/context, canonical oop-enforce-bridge filename and independently observed local maintenance state. Preserve INSTALL-13/14, last safe bridge, actual consent/restart and runtime checkpoints; peers do not advance adoption.','runtime'),
      requirement_ids:[requirement,'oop-installation-identity-history-native-v1','oop-persistent-runtime-checkpoint-v1'],
      actions:[{scope:'runtime',action:'Establish installation UID continuity independently of runtime class; preserve sole checkpoint and local technical receipts before registry reduction. Update UID-qualified active references, retain inactive historical locators and reconcile actual approval/restart dependencies. Select one host-native bridge through official installed-version/host documentation and minimal supported configuration; INSTALL-13/14 remain binding. Unknown owner, history, configuration or lineage blocks dependent migration only.'},{scope:'runtime',action:'Resolve persistent runtime ownership before checkpoint discovery/creation. Reconcile eligible per-session legacy records using current actual-state evidence, preserve conflicts, failures and provenance, and publish explicit non-authoritative supersession. Reuse one current checkpoint across all lifecycle paths; no session-derived fallback. Verify session/request/action and mapping/checkpoint revisions in updated evidence readers without replaying valid installation, approvals or organizational effects.'},
        {scope:'runtime',action:'Reconcile owned adapters/context and separately verify adoption; peers do not advance it.'},
        {scope:'runtime',action:'Map opening ENTRY-INSTRUCTION-02 to ENTRY-INSTRUCTION-01; prose/position unchanged. Reconcile literal readers before use; preserve historical references and unrelated ENTRY/BOOT IDs. Refresh only dependent owned context; reuse valid installation, consent and shared work.'},
        {scope:'runtime',action:'Reconcile independent prevention claims under Effect-capability confinement: trusted authorities, routes, exclusions and assumptions. Preserve C/U/R/E without consumer functionality certification. Missing mandatory protection blocks dependent effects/claims only; preserve safe work and owned history.'},
        {scope:'runtime',action:'Reconcile explicit execution entry and language evidence contract 3: establish project identity, inspect discoverable common-private preference before settings, resolve applicable effective preference under established precedence and persist or reuse it with protected conflict-safe shared writes. Preserve scoped requests and prior records; inaccessible/absent/stale/conflicting evidence is not a default language or automatic peer adoption.'},
        {scope:'runtime',action:'Update strict format 5 evidence/status readers per enforcement impact; revalidate legacy statuses from actual administrative receipts and consent/restart outcomes, preserving historical observations without inventing dispatch.'},
        {scope:'runtime',action:'Persisted BOOT-02/BOOT-09 phases are NOT_REQUIRED history; other verified phases stay valid.'},
        {scope:'runtime',action:'Re-provision an authorized operations credential held outside .priv/common there via BOOT-08 and BOOT-10; block only dependent operations writes until BOOT-11; never touch the old secret.'}],
      bridge_installation:{requirement:'oop-bridge-installation-v1',manifest_format:4,bootstrap_format:7,
        detect:['format_3_manifest_or_format_6_procedure_reader','non_uid_path','common_scope','foreign_scope','wrong_name','non_native_shell','delegated_bridge_logic','missing_validation'],
        actions:['resolve_owned_target_and_mapping','stage_candidate_keep_last_safe_active','validate_exact_plan_and_current_path_facts','conditionally_replace_all_routes_expected_revision','reconcile_native_consent_restart_and_maintenance_paths','read_back_routes_checkpoint_and_references','retire_old_only_when_no_ongoing_users'],
        context:'Session-bound receipt never inherited from a peer session; checkpoint references it only.',
        recovery:'staged retains prior active; activated_pending_checkpoint reconciles actual state before retry; stale writers never replay activation.',
        history:'Keep referenced evidence at original paths or update references through separately authorized conditional mutation outside R24; no dangling references.',
        assurance:'Administrative validation and receipts only; no synthetic consumer trials or advisory permission bypass.'},
      obsolete_phases:{'BOOT-02':'NOT_REQUIRED','BOOT-09':'NOT_REQUIRED'},
      credential_location:{disposition:'reprovision_in_common_private_area_and_enroll',old_secret:'untouched; never copied, exported or relocated'},
      enforcement},
    'migrations/operations.json':{...descriptor('operations','Group legacy installation records into the R03 machine registry only with authoritative public-credential/machine evidence and local preservation. Preserve every existing ticket byte and prior history. Gate incompatible writers; verify expected revisions, machine filenames, nested unique UIDs, owner metadata and canonical readback.','organization'),organizational_state_change:true,affected_domains:['machine_runtime_identity_registry','writer_compatibility'],preconditions:['resolve_project_and_owner','supported_actual_state','compatible_access','actual_effects_reconciled','local_technical_preservation_verified','authoritative_machine_membership_and_public_identity'],postconditions:['machine_registry_verified','existing_ticket_bytes_and_history_preserved','incompatible_old_writers_blocked','prior_facts_preserved']},
    'migrations/compatibility.json':{format:1,...binding,enforcement,contract_id:'oop-supported-state-reconciliation-v1',
      profiles:structuredClone(supportCatalog.profiles),withdrawals:structuredClone(supportCatalog.withdrawals),
      support_content_identity:supportContentIdentity(supportCatalog),
      support_evidence:supportCatalog.review_evidence,
      longitudinal_support:'Current reviewed declarations and supplied accepted checkpoint checked; independent longitudinal preservation is NOT VERIFIED without independently trusted prior catalog.',
      unsupported:'Any other fingerprint or unknown actual-state predicate requires reviewed scoped recovery; no missing ancestor required.',
      continuity:'Retain necessary current requirements for every claimed supported profile; never infer support from SHA ordering.'},
  };
}

export function validateMigrationBundle(bundle, schema, expectedSource) {
  const fail=reason=>{throw Error('Invalid migration bundle: '+reason);};
  for(const path of Object.keys(bundle)) if(![...paths,fixed.common].includes(path)) fail('unapproved path');
  const index=bundle['migrations/index.json'], compatibility=bundle['migrations/compatibility.json'];
  if(!index || !compatibility) fail('missing index/compatibility');
  for(const value of Object.values(bundle)) {
    const errors=validateProfile(value,schema);
    if(errors.length || value.source_identity!==expectedSource || !nonempty(value.source_contract)) fail('schema/source binding');
  }
  if(index.specification_id!=='oop-migration-distribution-v1' || index.compatibility!=='migrations/compatibility.json' || !nonempty(index.target_identity) || !Array.isArray(index.requirement_ids) || !index.requirement_ids.length || !index.requirement_ids.every(nonempty)) fail('index contract');
  if(!index.scopes || JSON.stringify(Object.keys(index.scopes).sort())!==JSON.stringify([...scopes].sort())) fail('scope closure');
  const ids=new Set();
  for(const scope of scopes) {
    const state=index.scopes[scope];
    if(!['not_required','required','unknown'].includes(state.disposition)) fail('disposition');
    const descriptor=bundle[fixed[scope]];
    if(state.disposition==='not_required' && (!nonempty(state.rationale) || state.descriptor || descriptor)) fail('ambiguous no-op');
    if(state.disposition==='required') {
      if(state.descriptor!==fixed[scope] || !descriptor || descriptor.destination!==scope) fail('missing/exact descriptor');
      for(const field of ['migration_id','scope','applicability','source_semantics','target_semantics','authority','already_satisfied','verification','recovery']) if(!nonempty(descriptor[field])) fail(field);
      if(ids.has(descriptor.migration_id)) fail('duplicate migration identity');ids.add(descriptor.migration_id);
      if(typeof descriptor.organizational_state_change!=='boolean' || !['runtime','organization'].includes(descriptor.scope) ||
        (scope==='operations'?descriptor.scope!=='organization':descriptor.scope!=='runtime')) fail('ownership/state change');
      for(const field of ['requirement_ids','affected_domains','preconditions','postconditions','actions']) if(!Array.isArray(descriptor[field]) || !descriptor[field].length) fail(field);
      if(!Array.isArray(descriptor.dependencies) || descriptor.no_downgrade!==true) fail('dependencies/preservation');
      if(!descriptor.actions.every(a=>['runtime','organization'].includes(a.scope) && nonempty(a.action))) fail('action ownership');
    } else if(state.disposition==='unknown' && (!nonempty(state.reason) || !nonempty(state.next_action))) fail('unknown recovery');
  }
  for(const path of ['migrations/index.json','migrations/runtime.json','migrations/compatibility.json']) {
    if(path==='migrations/runtime.json' && !bundle[path] && index.scopes.runtime.disposition==='not_required' && index.enforcement?.changed===false) continue;
    validateEnforcementImpact(bundle[path]?.enforcement);
    if(JSON.stringify(bundle[path].enforcement)!==JSON.stringify(index.enforcement)) fail('inconsistent enforcement disposition');
  }
  if(!Array.isArray(compatibility.profiles) || !compatibility.profiles.length || !nonempty(compatibility.unsupported) || !nonempty(compatibility.continuity)) fail('support boundary');
  const fingerprints=new Set();
  for(const profile of compatibility.profiles) {
    if(!/^sha256:[a-f0-9]{64}$/.test(profile.fingerprint) || fingerprints.has(profile.fingerprint)) fail('profile identity');fingerprints.add(profile.fingerprint);
    for(const field of ['state_schema','read_compatibility','write_compatibility','existing_state_policy']) if(!nonempty(profile[field])) fail('profile policy');
    if(!Array.isArray(profile.predicates) || !profile.predicates.length || !Array.isArray(profile.requirements) || !profile.requirements.length ||
      JSON.stringify(profile.scopes)!==JSON.stringify(scopes)) fail('profile coverage');
    const requirements=new Set(Object.values(bundle).flatMap(d=>d.requirement_ids??[]));
    if(!profile.requirements.every(id=>requirements.has(id))) fail('unsupported requirement');
  }
  validateSupportCatalog({format:1,source_contract:compatibility.source_contract,profiles:compatibility.profiles,
    withdrawals:compatibility.withdrawals,accepted_profiles:[],review_evidence:compatibility.support_evidence},expectedSource);
  return true;
}

// History is inspected here only, never by release acceptance. The caller
// resolves owner-selected canonical publication metadata and isolated read access.
export function publishedMigrationPath(git, previous, target) {
  if(![previous,target].every(id=>/^[a-f0-9]{40}$/.test(id))) return null;
  if(previous===target) return [];
  const result=git(['rev-list','--first-parent',target]);
  if(result.status!==0) return null;
  const commits=result.stdout.trim().split(/\r?\n/), position=commits.indexOf(previous);
  if(position<0 || commits[0]!==target || !commits.every(id=>/^[a-f0-9]{40}$/.test(id))) return null;
  return commits.slice(0,position).reverse();
}

// Planning/verification reference, no filesystem/provider effects. Evidence must
// be supplied by an actual installed observation mechanism for real adoption.
export function reconcileMigration({bundle,profile,project,root,runtime,target,previous,observations,authority,contextVerified,observedAt}) {
  const classification=classifySupportedState({bundle,profile,project,root,runtime,observations,observedAt});
  const selected=bundle['migrations/compatibility.json'].profiles.find(p=>p.fingerprint===(classification.profile??profile) || p.profile_id===profile);
  const index=bundle['migrations/index.json'];
  const dispositions={};
  for(const scope of scopes) {
    const policy=index.scopes[scope], fact=observations?.[scope], descriptor=bundle[fixed[scope]];
    const owner=scope==='common'?root:scope==='runtime'?runtime:project;
    const next=state=>({state,next_action:state==='UNKNOWN'?'Obtain scoped actual facts or reviewed recovery.':state==='PENDING'?'Verify/reconcile remaining owned action or canonical publication.':state==='BLOCKED'?'Resolve compatibility or authority without replay.':'Reuse current scoped evidence.'});
    if(!selected || !fact || fact.project!==project || fact.owner!==owner || !nonempty(fact.evidence) || fact.current!==true || (fact.partial!==undefined && (!nonempty(fact.partial) || fact.partial==='unknown')) ||
      fact.authenticated!==true || !Number.isFinite(Date.parse(observedAt)) || fact.observed_at!==observedAt ||
      selected.state_signature[scope].state_schema!==fact.state_schema) {dispositions[scope]=next('UNKNOWN');continue;}
    if(typeof fact.compatible!=='boolean' || (fact.conflict!==undefined && typeof fact.conflict!=='boolean')) {dispositions[scope]=next('UNKNOWN');continue;}
    if(fact.compatible===false || fact.conflict===true) {dispositions[scope]=next('BLOCKED');continue;}
    if(policy.disposition==='unknown') {dispositions[scope]=next('UNKNOWN');continue;}
    if(typeof fact.verified!=='boolean' || ['applied','ahead','applied_this_attempt'].some(field=>fact[field]!==undefined && typeof fact[field]!=='boolean')) {dispositions[scope]=next('UNKNOWN');continue;}
    if(policy.disposition==='not_required') {dispositions[scope]=next(fact.verified===true?'NOT_REQUIRED':'PENDING');continue;}
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
  const adopt=complete && classification.state==='SUPPORTED' && contextVerified===true && /^[a-f0-9]{40}$/.test(target);
  return {classification,dispositions,verified_commit:adopt?target:previous,pending_target:adopt?null:target,adopted:adopt,
    authority:'Reference decisions do not authenticate supplied facts, persist checkpoints or execute effects.'};
}
