// Reviewed current declarations and reference classification, never an authenticator.
import { createHash } from 'node:crypto';
const scopes = ['common','runtime','operations'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const fingerprint = value => /^sha256:[a-f0-9]{64}$/.test(value);
const semantic = profile => JSON.stringify({state_schema:profile.state_schema,state_signature:profile.state_signature,
  requirements:profile.requirements,read_compatibility:profile.read_compatibility,
  write_compatibility:profile.write_compatibility,existing_state_policy:profile.existing_state_policy,scopes:profile.scopes});
export function validateSupportCatalog(catalog, source, priorCatalog) {
  const fail = reason => { throw Error('Invalid migration support: '+reason); };
  if(catalog?.format!==1 || catalog.source_contract!=='OOP-migration-distribution' ||
    !Array.isArray(catalog.profiles) || !catalog.profiles.length || !Array.isArray(catalog.withdrawals) ||
    !text(catalog.review_evidence) || !Array.isArray(catalog.accepted_profiles)) fail('reviewed catalog required');
  const ids=new Set(), fingerprints=new Set();
  for(const p of catalog.profiles) {
    if(!/^oop-[a-z0-9-]+$/.test(p.profile_id) || ids.has(p.profile_id) || !fingerprint(p.fingerprint) || fingerprints.has(p.fingerprint)) fail('unique stable identity');
    ids.add(p.profile_id);fingerprints.add(p.fingerprint);
    for(const field of ['state_schema','read_compatibility','write_compatibility','existing_state_policy','review_evidence']) if(!text(p[field])) fail('profile '+field);
    for(const field of ['requirements','predicates']) if(!Array.isArray(p[field]) || !p[field].length || !p[field].every(text) || new Set(p[field]).size!==p[field].length) fail('profile '+field);
    if(JSON.stringify(p.scopes)!==JSON.stringify(scopes) ||
      JSON.stringify(p.predicates)!==JSON.stringify(['current_project_root_identity','owned_runtime_identity','canonical_actual_state_interpretable','no_unknown_partial_effects'])) fail('complete guards');
    if(!p.state_signature || JSON.stringify(Object.keys(p.state_signature).sort())!==JSON.stringify([...scopes].sort()) ||
      !Object.values(p.state_signature).every(s=>s && Object.keys(s).length===1 && text(s.state_schema))) fail('structured state predicates');
  }
  if(!fingerprints.has(source)) fail('current source binding');
  for(let i=0;i<catalog.profiles.length;i++) for(const other of catalog.profiles.slice(i+1)) {
    const p=catalog.profiles[i];
    if(JSON.stringify(p.state_signature)===JSON.stringify(other.state_signature) && semantic(p)!==semantic(other)) fail('conflicting equivalent state predicates');
  }
  const removed=new Set();
  for(const w of catalog.withdrawals) {
    if(!text(w.profile_id) || removed.has(w.profile_id) || ids.has(w.profile_id) || !fingerprint(w.fingerprint)) fail('withdrawal identity');
    removed.add(w.profile_id);
    for(const field of ['reason','risk','compatibility_impact','authorized_disposition','evidence','recovery']) if(!text(w[field])) fail('bounded withdrawal '+field);
  }
  const prior=priorCatalog?.profiles ?? catalog.accepted_profiles;
  const accepted=new Set();
  for(const p of prior) {
    if(!text(p.profile_id) || !fingerprint(p.fingerprint) || accepted.has(p.profile_id)) fail('prior declaration identity');
    accepted.add(p.profile_id);
    const retained=catalog.profiles.find(x=>x.profile_id===p.profile_id);
    const withdrawal=catalog.withdrawals.find(x=>x.profile_id===p.profile_id && x.fingerprint===p.fingerprint);
    if(!retained && !withdrawal) fail('missing supported profile without explicit withdrawal');
    if(retained && (retained.fingerprint!==p.fingerprint || (p.state_signature && semantic(retained)!==semantic(p)))) fail('changed stable profile semantics');
  }
  // Equivalent profiles can share signatures; materially conflicting ones fail closed.
  return true;
}

export const supportContentIdentity = catalog => 'sha256:'+createHash('sha256').update(JSON.stringify(catalog)).digest('hex');

export function classifySupportedState({bundle,profile,project,root,runtime,observations,observedAt}) {
  const profiles=bundle['migrations/compatibility.json'].profiles;
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
  const matches=profiles.filter(p=>(!profile || profile===p.fingerprint || profile===p.profile_id) &&
    scopes.every(scope=>p.state_signature[scope].state_schema===observations[scope].state_schema));
  if(!matches.length) return unknown('No supported actual-state profile');
  if(new Set(matches.map(semantic)).size!==1) return unknown('Multiple materially conflicting profiles');
  return {state:'SUPPORTED',profile:matches[0].fingerprint,equivalent_profiles:matches.map(p=>p.profile_id),
    authority:'Supplied observations must be authenticated by an installed observer; this helper performs no effects.'};
}
