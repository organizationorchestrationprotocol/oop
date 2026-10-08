// Lossless context encoding only. Stored distribution and legacy readers stay intact.
// Identities, per-profile evidence and every policy field survive exact expansion.
export function projectMigrationContext(bundle) {
  const payload=structuredClone(bundle),policies=[];
  const compatibility=payload['migrations/compatibility.json'];
  compatibility.profiles=compatibility.profiles.map(profile=>{
    const {profile_id,fingerprint,review_evidence,...policy}=profile;
    let index=policies.findIndex(p=>JSON.stringify(p)===JSON.stringify(policy));
    if(index<0){index=policies.length;policies.push(policy);}
    return {profile_id,fingerprint,review_evidence,policy_ref:index};
  });
  const enforcement=payload['migrations/index.json'].enforcement;
  const shared=[];
  for(const [path,descriptor] of Object.entries(payload)){
    if(path!=='migrations/index.json' && JSON.stringify(descriptor.enforcement)===JSON.stringify(enforcement)){
      delete descriptor.enforcement;shared.push(path);
    }
  }
  return {format:1,type:'lossless_migration_context',policies,shared_enforcement:shared,payload};
}
export function expandMigrationContext(context) {
  if(context?.format!==1 || context.type!=='lossless_migration_context')throw Error('Unsupported migration context');
  const bundle=structuredClone(context.payload);
  bundle['migrations/compatibility.json'].profiles=bundle['migrations/compatibility.json'].profiles.map(profile=>{
    const {policy_ref,...identity}=profile,policy=context.policies[policy_ref];
    if(!policy)throw Error('Missing migration policy');
    return {...policy,...identity};
  });
  for(const path of context.shared_enforcement)bundle[path].enforcement=structuredClone(bundle['migrations/index.json'].enforcement);
  return bundle;
}
