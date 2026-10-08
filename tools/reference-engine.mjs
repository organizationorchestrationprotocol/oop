// Maintainer-only reference mechanisms. Never install or invoke as bootstrap tests.
// These functions operate on supplied facts; they perform no effects or authority discovery.
const STATES = new Set(['verified', 'reused_verified']);

// Source: OOP-canonical-language. Supplied provenance is not authenticated here.
// A current bounded capability inspection is required even when no value is exposed.
export function presentationLanguage({explicit,history,host,trigger,historyDiscovery,discovery,context,fallback='en'} = {}) {
  const valid = x => typeof x?.language === 'string' && !!x.language.trim();
  const resolved=(language,basis,uncertain)=>({language,basis,uncertain,status:'resolved',
    language_source_discovery:true,presentation_language_resolved:true});
  const pending=basis=>({language:null,basis,uncertain:true,status:'pending',
    language_source_discovery:false,presentation_language_resolved:false});
  const choices=(Array.isArray(explicit)?explicit:[explicit]).filter(x=>valid(x) && x.origin==='user' &&
    x.voluntary===true && x.applicable===true && x.current!==false && (!x.context || x.context===context));
  if(choices.length) {
    // Higher instruction priority and narrower applicable scope are supplied verified ranks.
    const rank=x=>[x.priority??0,x.scope_rank??0,x.sequence??0];
    if(choices.some(x=>!rank(x).every(Number.isFinite))) return pending('unresolved_explicit');
    choices.sort((a,b)=>{const ar=rank(a),br=rank(b);return br[0]-ar[0]||br[1]-ar[1]||br[2]-ar[2];});
    const tied=choices.filter(x=>rank(x).every((v,i)=>v===rank(choices[0])[i]));
    if(new Set(tied.map(x=>x.language)).size>1)
      return {...resolved(fallback,'explicit_conflict_fallback',true),limitation:'Conflicting equally ranked applicable user instructions'};
    return resolved(choices[0].language,'explicit_user',false);
  }
  const inspected=d=>d?.attempted===true && d.authorized===true && d.current===true &&
    typeof context==='string' && !!context && d.context===context &&
    typeof d.source==='string' && !!d.source.trim() && typeof d.evidence==='string' && !!d.evidence.trim() &&
    typeof d.checked_at==='string' && Number.isFinite(Date.parse(d.checked_at)) &&
    ['observed','not_exposed','unsupported','unknown'].includes(d.status) &&
    (d.status==='observed' || (typeof d.reason==='string' && !!d.reason.trim()));
  if(!inspected(historyDiscovery)) return pending('unresolved_history');
  if(historyDiscovery.status==='observed') {
    if(valid(history) && history.origin==='previous_conversations' && history.trusted===true &&
      history.applicable===true && history.current===true && history.continuing_scope===true &&
      typeof history.provenance==='string' && !!history.provenance.trim() && historyDiscovery.language===history.language)
      return resolved(history.language,'previous_conversations',false);
    return pending('unresolved_history');
  }
  const checked=discovery?.attempted===true && discovery.authorized===true && discovery.current===true &&
    typeof context==='string' && !!context && discovery.context===context &&
    typeof discovery.source==='string' && !!discovery.source.trim() &&
    typeof discovery.evidence==='string' && !!discovery.evidence.trim() &&
    typeof discovery.checked_at==='string' && Number.isFinite(Date.parse(discovery.checked_at)) &&
    ['observed','not_exposed','unsupported','unknown'].includes(discovery.status);
  if(!checked || (discovery.status!=='observed' && (typeof discovery.reason!=='string' || !discovery.reason.trim())))
    return {language:null,basis:'unresolved',uncertain:true,status:'pending',
      language_source_discovery:false,presentation_language_resolved:false};
  const hosts=(Array.isArray(host)?host:[host]).filter(x=>valid(x) && x.trusted===true &&
    x.applicable===true && x.current!==false);
  const account=hosts.filter(x=>x.kind==='account');
  const eligible=account.length?account:hosts;
  const hostLanguages=new Set(eligible.map(x=>x.language));
  if(discovery.status==='observed' && hostLanguages.size===1 && hostLanguages.has(discovery.language))
    return {...resolved(discovery.language,'host',historyDiscovery.status==='unknown'),
      ...(historyDiscovery.status==='unknown'?{limitation:historyDiscovery.reason}:{})};
  // A false/missing host observation cannot be silently downgraded into fallback.
  if(discovery.status==='observed')
    return {language:null,basis:'unresolved_host',uncertain:true,status:'pending',
      language_source_discovery:false,presentation_language_resolved:false};
  if(valid(trigger) && trigger.attributable===true && trigger.natural_language===true && trigger.origin==='user')
    return {...resolved(trigger.language,'trigger',discovery.status==='unknown' || historyDiscovery.status==='unknown'),
      limitation:[historyDiscovery.reason,discovery.reason].filter(Boolean).join('; ')};
  return {...resolved(fallback,'fallback',true),limitation:discovery.reason};
}

// Source: OOP-scoped-credentials. A reference plan, never a credential provisioner.
export function coworkerIdentityPlan({existing,selectedIdentity,newWorkerRequired,authorizedIdentity} = {}) {
  if(selectedIdentity && selectedIdentity!=='ai-coworker')
    return {status:'blocked',create:false,rotate:false,authority_granted:false};
  if(existing?.eligible===true)
    return {identity:'ai-coworker',credential_identity:existing.identity,reference:existing.reference,create:false,rotate:false,authority_granted:false};
  if(newWorkerRequired!==true) return {create:false,rotate:false,authority_granted:false};
  if(selectedIdentity && authorizedIdentity!==true)
    return {status:'blocked',create:false,rotate:false,authority_granted:false};
  return {identity:selectedIdentity || 'ai-coworker',create:true,rotate:false,authority_granted:false};
}

// Source: SEC-01/02/04 and Default AI coworker identity and attribution.
// These necessary supplied observations do not authenticate the actor or provider.
export function workerRepositoryAdmission(facts) {
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
  const worker='ai-coworker';
  if(facts.worker_name!==undefined && facts.worker_name!==worker) return 'false';
  if(!['ai','human'].includes(facts.content_author)) return 'unknown';
  const author=facts.content_author==='human'?facts.human_author:worker;
  if(facts.content_author==='human' && (facts.human_authorship_verified!==true || typeof author!=='string' || !author.trim()))
    return facts.human_authorship_verified===false?'false':'unknown';
  for(const role of ['author','committer']) {
    if(typeof observed[role]?.name!=='string' || typeof observed[role]?.email!=='string' || !observed[role].email.trim()) return 'unknown';
    if(observed[role].name!==(role==='author'?author:worker)) return 'false';
    if((role==='committer' || facts.content_author==='ai') && observed[role].email!=='agent@oop.ai')return 'false';
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

export function transition(procedure, state, target, facts) {
  if (new Set(procedure.states).size !== procedure.states.length) throw new Error('Duplicate state');
  const edges = new Set();
  for (const item of procedure.transitions) {
    if (!procedure.states.includes(item.from) || !procedure.states.includes(item.to)) throw new Error('Undefined transition state');
    const key = JSON.stringify([item.from, item.to]);
    if (edges.has(key)) throw new Error('Ambiguous transition');
    edges.add(key);
  }
  if (!procedure.states.includes(state) || !procedure.states.includes(target)) throw new Error('Unknown state');
  const edge = procedure.transitions.find(x => x.from === state && x.to === target);
  if (!edge) return { state, status: 'denied', reason: 'transition_not_defined' };
  const result = evaluateGuard(edge.guard, facts);
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
