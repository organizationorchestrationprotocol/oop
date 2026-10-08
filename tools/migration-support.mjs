// Reviewed single-step migration support and reference classification, never an authenticator.
// The initial distribution declares one current profile and an explicit null predecessor.
// A reviewed update may additionally declare its immediately preceding profile.
import { createHash } from 'node:crypto';
const scopes = ['common','runtime','operations'];
const roles = ['previous','current'];
const predicates = ['current_project_root_identity','owned_runtime_identity','canonical_actual_state_interpretable','no_unknown_partial_effects'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const commitLike = /\b[0-9a-f]{40}\b/;
export function validateSupportCatalog(catalog) {
  const fail = reason => { throw Error('Invalid migration support: '+reason); };
  if(catalog?.format!==1 || catalog.source_contract!=='OOP-migration-distribution' || !text(catalog.review_evidence)) fail('reviewed catalog required');
  if(['profiles','withdrawals','accepted_profiles','fingerprint'].some(key=>Object.hasOwn(catalog,key))) fail('single-step record only');
  if(commitLike.test(JSON.stringify(catalog))) fail('commit identity');
  if(!Object.hasOwn(catalog,'previous'))fail('explicit predecessor required');
  if(catalog.previous===null&&catalog.scopes&&scopes.some(scope=>catalog.scopes[scope]?.disposition!=='not_required'))fail('initial scope migration');
  const ids=new Set();
  for(const role of roles) {
    const p=catalog[role];
    if(role==='previous'&&p===null)continue;
    if(!p || !/^oop-[a-z0-9-]+$/.test(p.profile_id) || ids.has(p.profile_id) || Object.hasOwn(p,'fingerprint')) fail(role+' identity');
    ids.add(p.profile_id);
    for(const field of ['state_schema','read_compatibility','write_compatibility','existing_state_policy']) if(!text(p[field])) fail(role+' '+field);
    if(JSON.stringify(p.scopes)!==JSON.stringify(scopes) || JSON.stringify(p.predicates)!==JSON.stringify(predicates)) fail('complete guards');
    if(!p.state_signature || JSON.stringify(Object.keys(p.state_signature).sort())!==JSON.stringify([...scopes].sort()) ||
      !Object.values(p.state_signature).every(s=>s && Object.keys(s).length===1 && text(s.state_schema))) fail('structured state predicates');
  }
  return true;
}

export const supportContentIdentity = catalog => 'sha256:'+createHash('sha256').update(JSON.stringify(catalog)).digest('hex');

export function classifySupportedState({bundle,project,root,runtime,observations,observedAt}) {
  const compatibility=bundle['migrations/compatibility.json'];
  const unknown=reason=>({state:'UNKNOWN',reason,next_action:'Obtain authenticated scope-bound state observations or reviewed recovery; retain previous adoption.'});
  if(!text(project)||!text(root)||!text(runtime)||!Number.isFinite(Date.parse(observedAt))) return unknown('Missing observation context/time');
  for(const scope of scopes) {
    const fact=observations?.[scope],owner=scope==='common'?root:scope==='runtime'?runtime:project;
    if(!fact || fact.project!==project || fact.owner!==owner || fact.authenticated!==true ||
      !text(fact.evidence) || fact.current!==true || fact.observed_at!==observedAt || (fact.partial!==undefined && (!text(fact.partial) || fact.partial==='unknown')) ||
      !text(fact.state_schema)) return unknown('Missing, foreign, unauthenticated or partial '+scope+' state');
    if(typeof fact.compatible!=='boolean' || (fact.conflict!==undefined && typeof fact.conflict!=='boolean')) return unknown('Malformed compatibility or conflict '+scope+' state');
    if(fact.compatible===false || fact.conflict===true) return {state:'BLOCKED',reason:'Incompatible or conflicting '+scope+' state',next_action:'Resolve scoped state compatibility without replay.'};
  }
  const matches=role=>compatibility[role]&&scopes.every(scope=>compatibility[role].state_signature[scope].state_schema===observations[scope].state_schema);
  if(matches('current')) return {state:'CURRENT',profile:compatibility.current.profile_id,
    authority:'Supplied observations must be authenticated by an installed observer; this helper performs no effects.'};
  if(matches('previous')) return {state:'SUPPORTED',profile:compatibility.previous.profile_id,
    authority:'Supplied observations must be authenticated by an installed observer; this helper performs no effects.'};
  return {state:'UNSUPPORTED',reason:'Observed state matches neither the previous nor the current profile',
    next_action:'Retain verified adoption facts, block dependent unsafe work and perform a fresh runtime bootstrap preserving organizational data, private secrets and peer state.'};
}
