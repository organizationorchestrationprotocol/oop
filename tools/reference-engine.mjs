// Maintainer-only reference mechanisms. Never install or invoke as bootstrap tests.
// These functions operate on supplied facts; they perform no effects or authority discovery.
import installation from './installation-contract.cjs';
const STATES = new Set(['verified', 'reused_verified']);

// Source: OOP-canonical-language. Supplied provenance is not authenticated here.
// A current bounded capability inspection is required even when no value is exposed.
export function presentationLanguage({capabilities,scope,now} = {}) {
  if(capabilities?.format===3)return effectiveResponseLanguage({capabilities,scope,now});
  return {language:null,basis:'adapter_update_required',uncertain:true,status:'pending',
    language_source_discovery:false,presentation_language_resolved:false,request_explicit_language:false,
    shared_persistence:'not_performed'};
}

// Evidence-only contract 3. No host inspection, preference write or authority is performed here.
export function effectiveResponseLanguage({capabilities,scope,now}={}) {
  const pending=(basis,inspected=false)=>({language:null,basis,uncertain:true,status:'pending',
    language_source_discovery:inspected,presentation_language_resolved:false,request_explicit_language:inspected,
    shared_persistence:'not_performed'});
  const tag=value=>{try{return typeof value==='string'?Intl.getCanonicalLocales(value)[0]:null;}catch{return null;}};
  const text=value=>typeof value==='string'&&!!value.trim();
  const kinds=['shared_project_response_language','user_account_presentation_locale','application_response_language',
    'runtime_response_language','persistent_user_language_preference'];
  const all=[...kinds,'current_user_language_instruction'];
  if(capabilities?.format!==3||!Array.isArray(capabilities.observations)||!scope||
    !['project','user','host','runtime','session'].every(k=>text(scope[k]))||!Number.isFinite(now))return pending('invalid_capability_contract');
  const observations=capabilities.observations;
  const valid=x=>x&&all.includes(x.kind)&&x.attempted===true&&x.authorized===true&&x.applicable===true&&x.current===true&&
    ['source','authority','evidence'].every(k=>text(x[k]))&&Number.isFinite(Date.parse(x.checked_at))&&Date.parse(x.checked_at)<=now&&
    Number.isFinite(Date.parse(x.expires_at))&&now<Date.parse(x.expires_at)&&x.scope&&
    (x.kind==='shared_project_response_language'&&x.audience==='project_user'
      ? x.scope.project===scope.project&&x.scope.user===scope.user&&x.portable_authority_verified===true
      : Object.keys(scope).every(k=>x.scope[k]===scope[k]))&&
    ['observed','absent','inaccessible','conflicting','uninspected'].includes(x.status)&&
    (x.status==='observed'?!!tag(x.language)&&x.trusted===true&&
      (x.kind!=='shared_project_response_language'||x.effective_preference_verified===true&&
        x.dependencies_current===true&&x.precedence_evidence===capabilities.precedence?.evidence)
      :x.language===undefined&&text(x.reason));
  const shared=observations.filter(x=>x?.kind===kinds[0]);
  if(!shared.length||shared.some(x=>x.status==='uninspected'||x.attempted!==true))return pending('shared_preference_uninspected');
  // Invalid shared values never become authority. After attempted inspection, settings discovery may recover.
  const invalidShared=shared.some(x=>!valid(x));
  const instructions=observations.filter(x=>x?.kind==='current_user_language_instruction');
  const choices=instructions.filter(x=>valid(x)&&x.status==='observed'&&x.origin==='user'&&x.voluntary===true);
  const resolved=(x,basis)=>({language:tag(x.language),basis,uncertain:false,status:'resolved',
    language_source_discovery:true,presentation_language_resolved:true,request_explicit_language:false,
    selected_evidence:x.evidence,shared_persistence:'not_performed',shared_reuse:basis===kinds[0]});
  // No arbitrary latest-file selection among competing explicit choices.
  const conflictingExplicit=new Set(choices.map(x=>tag(x.language))).size>1;
  if(choices.length&&!conflictingExplicit)return resolved(choices[0],'current_user_language_instruction');
  const order=capabilities.precedence;
  if(order?.established!==true||!text(order.source)||!text(order.evidence)||!Array.isArray(order.order)||
    order.order.length!==kinds.length||new Set(order.order).size!==kinds.length||!kinds.every(k=>order.order.includes(k)))
    return pending('unestablished_precedence');
  // A reusable effective common record must attest current precedence/dependencies, not just exist.
  const reusable=shared.filter(x=>valid(x)&&x.status==='observed'&&x.effective_preference_verified===true&&
    x.dependencies_current===true&&x.precedence_evidence===order.evidence);
  const contradictsReuse=reusable.length&&observations.some(x=>valid(x)&&x.kind!==kinds[0]&&x.status==='observed'&&
    order.order.indexOf(x.kind)<order.order.indexOf(kinds[0])&&tag(x.language)!==tag(reusable[0].language));
  if(!conflictingExplicit&&!invalidShared&&reusable.length&&shared.every(x=>valid(x)&&x.status==='observed')&&
    !contradictsReuse&&new Set(reusable.map(x=>tag(x.language))).size===1&&reusable.length===shared.length)return resolved(reusable[0],kinds[0]);
  let issue=conflictingExplicit?'conflicting_explicit_instruction':undefined,selected;
  for(const kind of order.order){
    const values=observations.filter(x=>x?.kind===kind);
    if(kind===kinds[0]&&invalidShared)continue;
    if(!values.length||values.some(x=>x.status==='uninspected'||x.attempted!==true))return pending('uninspected:'+kind);
    if(values.some(x=>!valid(x)))return pending('invalid_evidence:'+kind);
    if(values.some(x=>['inaccessible','conflicting'].includes(x.status))){issue??=kind+':'+values.find(x=>['inaccessible','conflicting'].includes(x.status)).status;continue;}
    const settings=values.filter(x=>x.status==='observed');
    if(new Set(settings.map(x=>tag(x.language))).size>1){issue??='conflicting:'+kind;continue;}
    if(!selected&&!issue&&settings.length)selected=settings[0];
  }
  // Coverage is complete before an unresolved outcome can request the user's language.
  if(selected)return resolved(selected,selected.kind);
  return pending(issue??'no_effective_preference',true);
}

export function sharedLanguagePreferencePlan({resolution,scope,author,source,authority,evidence,recordId,now,expiresAt,
  portable=false,portableAuthorityVerified=false,currentRecord,persistenceAuthorized=false,privateRootProtected=false}={}) {
  const text=x=>typeof x==='string'&&!!x.trim();
  if(resolution?.status!=='resolved'||!text(resolution.language)||!scope||!['project','user','runtime'].every(k=>text(scope[k]))||
    ![author,source,authority,evidence,recordId].every(text)||!Number.isFinite(now)||!Number.isFinite(Date.parse(expiresAt))||
    Date.parse(expiresAt)<=now||persistenceAuthorized!==true||privateRootProtected!==true||
    (portable&&portableAuthorityVerified!==true))return {status:'pending',write:false,shared_persistence:'not_performed'};
  // A one-response choice cannot become a durable preference merely because it resolved this reply.
  if(resolution.basis==='current_user_language_instruction'&&portableAuthorityVerified!==true)
    return {status:'scoped_instruction_only',write:false,shared_persistence:'not_performed'};
  const audience=portable?'project_user':'runtime';
  const binding=portable?{project:scope.project,user:scope.user}:scope;
  const sameScope=currentRecord&&currentRecord.scope?.project===scope.project&&currentRecord.scope?.user===scope.user&&
    (currentRecord.audience==='project_user'||currentRecord.scope?.runtime===scope.runtime);
  if(sameScope&&text(currentRecord.id)&&currentRecord.current===true&&Date.parse(currentRecord.expires_at)>now&&
    currentRecord.evidence===evidence&&currentRecord.language===resolution.language&&
    JSON.stringify(currentRecord.scope)===JSON.stringify(binding)&&currentRecord.audience===audience)
    return {status:'reuse',write:false,shared_persistence:'reused',record:currentRecord};
  if(recordId===currentRecord?.id)return {status:'id_collision',write:false,shared_persistence:'not_performed'};
  return {status:'planned',write:true,shared_persistence:'not_performed',publication:'immutable_distinct_id',
    supersedes:sameScope?currentRecord?.id??null:null,concurrency:'inspect_active_chain_and_conflict_safe_publication',
    record:{id:recordId,format:1,kind:'shared_project_response_language',language:resolution.language,scope:binding,audience,
      author,source,authority,evidence,origin_runtime:scope.runtime,created_at:new Date(now).toISOString(),
      checked_at:new Date(now).toISOString(),expires_at:expiresAt,precedence_basis:resolution.basis,
      invalidation:['project','user','applicable_runtime','settings','overrides','authority','precedence'],
      portable_authority_verified:portable&&portableAuthorityVerified,current:true}};
}

// Source: OOP-scoped-credentials. A reference plan, never a credential provisioner.
export function coworkerIdentityPlan({existing,selectedIdentity,newWorkerRequired,authorizedIdentity,owner_name,owner_email} = {}) {
  if(!owner_name?.trim()||!owner_email?.trim()||selectedIdentity && selectedIdentity!==owner_name)
    return {status:'blocked',create:false,rotate:false,authority_granted:false};
  if(existing?.eligible===true)
    return {identity:owner_name,email:owner_email,credential_identity:existing.identity,reference:existing.reference,create:false,rotate:false,authority_granted:false};
  if(newWorkerRequired!==true) return {create:false,rotate:false,authority_granted:false};
  if(selectedIdentity && authorizedIdentity!==true)
    return {status:'blocked',create:false,rotate:false,authority_granted:false};
  return {identity:owner_name,email:owner_email,create:true,rotate:false,authority_granted:false};
}

// Source: SEC-01/02/04 and Default AI coworker identity and attribution.
// These necessary supplied observations do not authenticate the actor or provider.
export function workerRepositoryAdmission(facts) {
  if(facts?.phase_scope==='full_bootstrap') {
    const credential=commonPrivateCredential(facts.credential);
    if(credential!=='true')return credential;
    if(facts.credential.project!==facts.project)return 'false';
  }
  for(const key of ['project','repository','purpose','runtime']) {
    if(typeof facts?.['expected_'+key]!=='string' || !facts['expected_'+key] ||
       typeof facts[key]!=='string' || !facts[key]) return 'unknown';
    if(facts[key]!==facts['expected_'+key]) return 'false';
  }
  const admission=evaluateGuard({all:['authority_verified','effective_actor_verified','attribution_verified',
    'authorized_email_verified_or_inapplicable','adapter_access_verified','signing_verified_or_inapplicable',
    'signature_acceptance_verified_or_inapplicable'].map(fact=>({fact}))},facts);
  if(admission!=='true') return admission;
  if(facts.phase==='before_publish' || facts.operation==='git_publish') {
    const proof=evaluateGuard({all:['provider_worker_mapping_verified','authentication_verified',
      'write_permission_verified','shared_reference_verified'].map(fact=>({fact}))},facts);
    if(proof!=='true') return proof;
    for(const key of ['provider_principal','ref']) {
      if(typeof facts[key]!=='string' || !facts[key] || typeof facts['expected_'+key]!=='string' || !facts['expected_'+key])return 'unknown';
      if(facts[key]!==facts['expected_'+key])return 'false';
    }
    if(typeof facts.credential_project!=='string' || !facts.credential_project ||
      typeof facts.shared_reference!=='string' || !facts.shared_reference)return 'unknown';
    if(facts.credential_project!==facts.project) {
      const delegation=evaluateGuard({fact:'external_project_purpose_delegation_verified'},facts);
      if(delegation!=='true')return delegation;
    }
  }
  return 'true';
}

// Source: OOP-scoped-credentials / OOP-effect-verification.
// Necessary supplied-observation checks only: not an installed Git/API interceptor.
export function commitAttributionGate(facts = {}) {
  if(!['pre_commit','before_publish'].includes(facts.phase)) return 'unknown';
  if(facts.local_mode_verified!==true)return 'unknown';
  if(facts.bridge_maintenance_mode!=='normal')return 'false';
  const admission=workerRepositoryAdmission(facts);
  if(admission!=='true') return admission;
  for(const key of ['operation','adapter']) {
    if(typeof facts[key]!=='string' || !facts[key] || typeof facts['expected_'+key]!=='string') return 'unknown';
    if(facts[key]!==facts['expected_'+key]) return 'false';
  }
  const observed=facts.phase==='pre_commit'?facts.effective:facts.actual;
  const checks=['current','inspected','authorized_emails_verified'];
  if(facts.phase==='pre_commit') checks.push('inherited_overrides_inspected','adapter_path_inspected');
  else checks.push('object_readback_verified','required_signature_verified_or_inapplicable');
  const guard=evaluateGuard({all:checks.map(fact=>({fact}))},observed??{});
  if(guard!=='true') return guard;
  for(const key of ['project','repository','runtime','operation','adapter']) {
    if(typeof observed[key]!=='string' || !observed[key]) return 'unknown';
    if(observed[key]!==facts[key]) return 'false';
  }
  if(facts.phase==='before_publish') {
    if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(facts.expected_commit??'') || !observed.commit_id) return 'unknown';
    if(observed.commit_id!==facts.expected_commit) return 'false';
  }
  const worker=facts.owner_name;
  if(typeof worker!=='string'||!worker.trim()||typeof facts.owner_email!=='string'||!facts.owner_email.trim()||facts.machine_owner_verified!==true)return 'unknown';
  if(facts.worker_name!==undefined && facts.worker_name!==worker) return 'false';
  if(!['ai','human'].includes(facts.content_author)) return 'unknown';
  const author=facts.content_author==='human'?facts.human_author:worker;
  if(facts.content_author==='human' && (facts.human_authorship_verified!==true || typeof author!=='string' || !author.trim()))
    return facts.human_authorship_verified===false?'false':'unknown';
  for(const role of ['author','committer']) {
    if(typeof observed[role]?.name!=='string' || typeof observed[role]?.email!=='string' || !observed[role].email.trim()) return 'unknown';
    if(observed[role].name!==(role==='author'?author:worker)) return 'false';
    if((role==='committer' || facts.content_author==='ai') && observed[role].email!==facts.owner_email)return 'false';
    const emails=facts[role+'_emails'];
    if(!Array.isArray(emails) || !emails.length || emails.some(email=>typeof email!=='string' || !email.trim())) return 'unknown';
    if(!emails.includes(observed[role].email)) return 'false';
  }
  return 'true';
}

export function closure(catalog, selected) {
  if (!Array.isArray(selected) || !selected.length) throw new Error('Missing selection');
  const byId = new Map();
  for (const item of catalog) {
    if (typeof item.id !== 'string' || !item.id || !Array.isArray(item.dependencies)
      || item.dependencies.some(x => typeof x !== 'string' || !x)) throw new Error('Malformed module');
    if (byId.has(item.id)) throw new Error(`Duplicate identity: ${item.id}`);
    byId.set(item.id, item);
  }
  const active = new Set(), done = new Set();
  function visit(id) {
    if (active.has(id)) throw new Error(`Dependency cycle: ${id}`);
    const item = byId.get(id);
    if (!item) throw new Error(`Unknown dependency: ${id}`);
    if (done.has(id)) return;
    active.add(id);
    for (const dependency of [...item.dependencies].sort()) visit(dependency);
    active.delete(id);
    done.add(id);
  }
  for (const id of [...new Set(selected)].sort()) visit(id);
  return [...done];
}

export function route(catalog, routes, facts) {
  if (!['known', 'unknown'].includes(facts.classification)) throw new Error('Unknown classification');
  for (const key of ['request', 'action', 'state', 'risk', 'authority', 'recovery']) {
    if (facts[key] !== undefined && (!Array.isArray(facts[key]) || facts[key].some(x => typeof x !== 'string' || !x))) {
      throw new Error(`Invalid facets: ${key}`);
    }
  }
  const facets = new Set([
    ...(facts.request ?? []), ...(facts.action ?? []),
    ...(facts.state ?? []), ...(facts.risk ?? []),
    ...(facts.authority ?? []), ...(facts.recovery ?? []),
  ]);
  const selected = new Set();
  for (const facet of [...facets].sort()) {
    if (!Object.hasOwn(routes.facets, facet)) throw new Error(`Unresolved facet: ${facet}`);
    for (const id of routes.facets[facet]) selected.add(id);
  }
  if (facts.classification === 'unknown') {
    for (const id of routes.conservative) selected.add(id);
  }
  const modules = closure(catalog, [...selected]);
  return { modules, classification_resolved: facts.classification === 'known',
    requires_independent_admission: true, authority_granted: false };
}

export function assemble(catalog, ids) {
  const ordered = closure(catalog, ids), byId = new Map(catalog.map(x => [x.id, x]));
  const contracts = new Map();
  for (const id of ordered) {
    for (const contract of byId.get(id).contracts) {
      const prior = contracts.get(contract.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(contract)) {
        throw new Error(`Conflicting contract: ${contract.id}`);
      }
      contracts.set(contract.id, contract);
    }
  }
  return [...contracts.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

export function evaluateGuard(guard, facts) {
  // Explicit three-valued result; never use JS truthiness for evidence or authority.
  if (!guard || typeof guard !== 'object' || Array.isArray(guard) || Object.keys(guard).length !== 1) {
    throw new Error('Invalid guard');
  }
  if (Object.hasOwn(guard, 'fact')) {
    if (typeof guard.fact !== 'string' || !guard.fact) throw new Error('Invalid fact');
    const value = Object.hasOwn(facts, guard.fact) ? facts[guard.fact] : undefined;
    if (value === true) return 'true';
    if (value === false) return 'false';
    return 'unknown';
  }
  if (Object.hasOwn(guard, 'all')) {
    if (!Array.isArray(guard.all) || !guard.all.length) throw new Error('Empty guard');
    const values = guard.all.map(x => evaluateGuard(x, facts));
    if (values.includes('false')) return 'false';
    return values.includes('unknown') ? 'unknown' : 'true';
  }
  throw new Error('Unsupported guard');
}

// Invalid procedure/edge shapes throw programmer errors; valid unknown evidence stays pending.
export function transition(procedure, state, target, facts) {
  if (!Array.isArray(procedure?.states) || !procedure.states.length ||
      Array.from(procedure.states).some(x => typeof x !== 'string' || !x.trim()) ||
      !Array.isArray(procedure.transitions)) throw new Error('Invalid procedure');
  if (new Set(procedure.states).size !== procedure.states.length) throw new Error('Duplicate state');
  const edges = new Map();
  for (const item of procedure.transitions) {
    if (!item || !procedure.states.includes(item.from) || !procedure.states.includes(item.to)) throw new Error('Undefined transition state');
    const key = JSON.stringify([item.from, item.to]);
    if (edges.has(key)) throw new Error('Ambiguous transition');
    const hasGuard = Object.hasOwn(item, 'guard'), hasRequires = Object.hasOwn(item, 'requires');
    if (hasGuard === hasRequires) throw new Error('Expected exactly one transition condition');
    if (hasRequires && (!Array.isArray(item.requires) || !item.requires.length ||
        Array.from(item.requires).some(x => typeof x !== 'string' || !x.trim()) ||
        new Set(item.requires).size !== item.requires.length)) throw new Error('Invalid transition requirements');
    const guard = hasGuard ? item.guard : { all: item.requires.map(fact => ({ fact })) };
    // Validate every edge before selecting a path; unrelated malformed edges cannot hide.
    evaluateGuard(guard, {});
    edges.set(key, guard);
  }
  if (!procedure.states.includes(state) || !procedure.states.includes(target)) throw new Error('Unknown state');
  const guard = edges.get(JSON.stringify([state, target]));
  if (!guard) return { state, status: 'denied', reason: 'transition_not_defined' };
  const result = evaluateGuard(guard, facts);
  return result === 'true' ? { state: target, status: 'eligible_transition', authority_granted: false }
    : { state, status: result === 'unknown' ? 'pending' : 'denied', reason: result };
}

export function invalidated(items, changedDependencies) {
  const changed = new Set(changedDependencies), affected = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const item of items) {
      if (!affected.has(item.id) && item.validity_dependencies.some(id => changed.has(id) || affected.has(id))) {
        affected.add(item.id); progress = true;
      }
    }
  }
  return [...affected].sort();
}

export function reusable(item, current) {
  if (!STATES.has(item.status)) return false;
  if (item.workspace !== current.workspace || item.runtime !== current.runtime) return false;
  return item.validity_dependencies.every(id =>
    Object.hasOwn(item.observed, id) && Object.hasOwn(current.observed, id)
    && item.observed[id] === current.observed[id]);
}

export function operationsAccess(observation) {
  if(observation?.phase_scope==='full_bootstrap') {
    const credential=commonPrivateCredential(observation.credential_provenance);
    if(credential!=='true')return credential;
    const selected=observation.credential_provenance;
    if(selected.project!==observation.workspace || selected.reference!==observation.credential ||
      selected.adapter!==observation.adapter)return 'false';
  }
  const required = ['expected_workspace', 'expected_repository', 'expected_credential', 'expected_adapter'];
  if (required.some(key => typeof observation[key] !== 'string' || !observation[key])) return 'unknown';
  for (const dimension of ['workspace', 'repository', 'credential', 'adapter']) {
    if (!observation[dimension]) return 'unknown';
    if (observation[dimension] !== observation[`expected_${dimension}`]) return 'false';
  }
  return evaluateGuard({ all: [{ fact: 'read_verified' }, { fact: 'write_verified' }] }, observation);
}

export function releaseVerdict(evidence) {
  const results = { ...evidence.required_results };
  if (evidence.coverage_complete !== true) results.coverage = 'pending';
  if (evidence.status !== 'prepared') results.subject = 'candidate';
  if (!Object.keys(evidence.required_results).length) results.required_checks = 'missing';
  if (evidence.efficiency_regression === true && evidence.regression_disposition !== 'authorized_justified') {
    results.efficiency = 'failed';
  }
  return { ready: Object.values(results).every(x => x === 'passed'), results };
}

// Necessary supplied-fact predicates for the full installation contract, not host attestation.
export function commonPrivateCredential(facts={}) {
  const required=['project','common_area','reference','principal','adapter','purpose'];
  for(const key of required) {
    if(typeof facts[key]!=='string' || !facts[key] || typeof facts['expected_'+key]!=='string' || !facts['expected_'+key])return 'unknown';
    if(facts[key]!==facts['expected_'+key])return 'false';
  }
  if(facts.origin!=='current_project_common_private_reference')return facts.origin===undefined?'unknown':'false';
  // ai-coworker operations credentials are files in the common private area; external stores are ineligible.
  if(facts.secret_location!=='common_private_files')return facts.secret_location===undefined?'unknown':'false';
  return evaluateGuard({all:['mapping_verified','authority_verified','reference_owned','effective_origin_verified',
    'authentication_verified','read_verified','write_verified','signing_verified_or_inapplicable'].map(fact=>({fact}))},facts);
}

// BOOT-06: only a same-project .priv reference or a persisted user answer resolves the source.
export function projectSourceResolution({origin,persisted,project,expected_project}={}) {
  if(origin===undefined)return 'unknown';
  if(typeof project!=='string' || !project || project!==expected_project)return project===undefined?'unknown':'false';
  if(origin==='priv_reference')return 'true';
  if(origin==='user_provided')return persisted===true?'true':persisted===undefined?'unknown':'false';
  return 'false';
}

export function privateExclusionPlan({vcs,tracked,excluded,authority,filesystemProtected}={}) {
  const blocked=reason=>({status:'blocked',reason,writes:[],sensitive_persistence:false});
  if(filesystemProtected!==true)return blocked('filesystem_protection_unverified');
  if(vcs==='none')return {status:'ready',writes:[],sensitive_persistence:true,reassess:'before_exposure_after_boundary_change'};
  if(vcs!=='verified' || typeof tracked!=='boolean' || typeof excluded!=='boolean')return blocked('boundary_or_membership_unknown');
  if(tracked)return blocked('tracked_private_data_requires_authorized_remediation');
  if(excluded)return {status:'ready',writes:[],sensitive_persistence:true};
  if(authority!==true)return blocked('exclusion_authority_missing');
  return {status:'pending_readback',writes:['minimal_effective_exclusion_in_verified_scope'],sensitive_persistence:false};
}

export const bootstrapStepIds=['BOOT-01','BOOT-03','BOOT-04','BOOT-05','BOOT-06','BOOT-07','BOOT-08','BOOT-10','BOOT-11','BOOT-12','BOOT-13'];
export function bootstrapCompletion({procedure,facts={},phases=[],credential,operations,context,now,checkpoint,historicalStatus}={}) {
  let installationStatus='PENDING';
  const pending=reason=>({bootstrap_status:'PENDING',installation_status:installationStatus,publication_status:'PENDING',
    bootstrap_complete:false,accepting_new_user_requests:false,effect_permission:'not_granted',reason,historical_status:historicalStatus});
  // Completeness is the exact stable ID set; removed BOOT-02/BOOT-09 are never required or reused.
  try { procedure=expandBootstrap(procedure); } catch { return pending('adapter_update_required'); }
  if(!procedure || procedure.format!==7 || !Array.isArray(procedure.steps) ||
    JSON.stringify(procedure.steps.map(s=>s?.id))!==JSON.stringify(bootstrapStepIds))return pending('adapter_update_required');
  const byId=id=>procedure.steps.find(s=>s.id===id);
  const phaseVerified=step=>step && phases.some(p=>p.id===step.id && p.status==='verified') && evaluateGuard(step.guard,facts)==='true';
  for(const id of bootstrapStepIds.filter(id=>id!=='BOOT-13'))if(!phaseVerified(byId(id)))return pending('phase:'+id);
  if(commonPrivateCredential(credential)!=='true')return pending('selected_effective_credential');
  if(!context || !['project','runtime','source','revision'].every(k=>typeof context[k]==='string' && context[k]))return pending('context');
  if(credential.project!==context.project)return pending('credential_project');
  const current=record=>record && record.origin==='authoritative_observation' && typeof record.reference==='string' && record.reference &&
    Number.isFinite(now) && Number.isFinite(Date.parse(record.observed_at)) && Date.parse(record.observed_at)<=now &&
    Number.isFinite(Date.parse(record.expires_at)) && now<Date.parse(record.expires_at) && record.context &&
    Object.keys(context).every(k=>context[k]===record.context[k]);
  if(!current(checkpoint) || checkpoint.persisted!==true || checkpoint.restart_resolved!==true ||
    !Number.isFinite(Date.parse(checkpoint.installation_verified_at)) || Date.parse(checkpoint.installation_verified_at)>Date.parse(checkpoint.observed_at))return pending('installation_checkpoint');
  installationStatus='INSTALLED';
  // Installation has been independently established before any canonical publication check.
  if(!current(operations))return pending('identity_registration_observation');
  const record=operations.identity_record;
  if(!installation.identity(record)||!record.runtimes.some(r=>r.installation_uid===context.installation_uid&&r.runtime_id===context.runtime)||
    operations.identity_record_readback_verified!==true||operations.record_nonsecret_verified!==true||
    !Number.isFinite(Date.parse(operations.recorded_at))||Date.parse(operations.recorded_at)<Date.parse(checkpoint.installation_verified_at))return pending('identity_registration_content');
  if(!['already_satisfied','new_commit_verified'].includes(operations.disposition) ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(operations.commit??'') || operations.object_readback!==true ||
    operations.attribution_verified!==true || operations.signing_verified_or_inapplicable!==true ||
    operations.credential_reference!==credential.reference || operations.principal!==credential.principal ||
    typeof operations.repository!=='string' || !operations.repository || operations.repository!==operations.expected_repository ||
    typeof operations.ref!=='string' || !operations.ref || operations.ref!==operations.expected_ref ||
    !Number.isFinite(Date.parse(operations.commit_observed_at)) || Date.parse(operations.commit_observed_at)<Date.parse(operations.recorded_at) ||
    Date.parse(operations.commit_observed_at)>Date.parse(operations.observed_at))return pending('identity_registration_commit');
  // No publication_required:false bypass: this final canonical record must be observed remotely.
  if(operations.publication_observed!==true || operations.remote_commit!==operations.commit || operations.remote_ref!==operations.ref ||
    !Number.isFinite(Date.parse(operations.publication_observed_at)) || Date.parse(operations.publication_observed_at)<Date.parse(operations.commit_observed_at) ||
    Date.parse(operations.publication_observed_at)>Date.parse(operations.observed_at))return pending('identity_registration_publication');
  if(checkpoint.publication_commit!==operations.commit || checkpoint.publication_verified!==true ||
    Date.parse(checkpoint.observed_at)<Date.parse(operations.publication_observed_at))return pending('final_publication_checkpoint');
  if(!phaseVerified(byId('BOOT-13')))return pending('phase:BOOT-13');
  return {bootstrap_status:'INSTALLED',installation_status:'INSTALLED',publication_status:'VERIFIED',bootstrap_complete:true,
    accepting_new_user_requests:true,enforcement_assurance:'ADMINISTRATIVELY_INSTALLED',effect_permission:'not_granted',
    commit_disposition:operations.disposition};
}

// Consumer procedure format 7 factors repeated metadata without losing instructions.
export function expandBootstrap(procedure) {
  if(procedure?.format!==7)return procedure;
  if(!procedure.step_defaults||!Array.isArray(procedure.steps))throw Error('Invalid bootstrap defaults');
  return {...procedure,steps:procedure.steps.map(step=>{if(step.defaults_ref!=='#step_defaults')throw Error('Unresolved bootstrap defaults');return {...procedure.step_defaults,...step};})};
}
