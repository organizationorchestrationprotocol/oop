// Lossless context encoding only. Stored distribution and legacy readers stay intact.
// Identities, per-profile evidence and every policy field survive exact expansion.
export function projectMigrationContext(bundle,{format=2}={}) {
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
  const legacy={format:1,type:'lossless_migration_context',policies,shared_enforcement:shared,payload};
  if(format===1)return legacy;
  if(format!==2)throw Error('Unsupported migration context');
  // Intern repeated keys AND values without removing any policy/evidence. All
  // containers are tagged; literal numbers cannot be confused with text refs.
  const counts=new Map();
  const count=x=>{if(typeof x==='string')counts.set(x,(counts.get(x)??0)+1);
    else if(Array.isArray(x))x.forEach(count);
    else if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){count(k);count(v);}};
  count(legacy);
  const strings=[...counts].filter(([s,n])=>n>1&&s.length>3).map(([s])=>s),indices=new Map(strings.map((s,i)=>[s,i]));
  const encode=x=>{
    if(typeof x==='string')return indices.has(x)?indices.get(x):x;
    if(typeof x==='number')return ['n',x];
    if(Array.isArray(x))return ['a',...x.map(encode)];
    if(x&&typeof x==='object')return ['o',...Object.entries(x).flatMap(([k,v])=>[encode(k),encode(v)])];
    return x;
  };
  return {format:2,type:'lossless_migration_context',strings,data:encode(legacy)};
}
export function expandMigrationContext(context) {
  if(context?.format===2&&context.type==='lossless_migration_context'){
    if(!Array.isArray(context.strings)||!context.strings.every(s=>typeof s==='string'))throw Error('Invalid migration text table');
    const decode=x=>{
      if(typeof x==='number'){if(!Number.isInteger(x)||x<0||x>=context.strings.length)throw Error('Invalid migration text ref');return context.strings[x];}
      if(!Array.isArray(x)){if(x!==null&&!['string','boolean'].includes(typeof x))throw Error('Invalid migration value');return x;}
      const [tag,...values]=x;
      if(tag==='n'&&values.length===1&&typeof values[0]==='number')return values[0];
      if(tag==='a')return values.map(decode);
      if(tag==='o'&&values.length%2===0){const entries=[];const keys=new Set();for(let i=0;i<values.length;i+=2){const key=decode(values[i]);if(typeof key!=='string'||keys.has(key))throw Error('Invalid migration key');keys.add(key);entries.push([key,decode(values[i+1])]);}return Object.fromEntries(entries);}
      throw Error('Invalid migration container');
    };
    context=decode(context.data);
  }
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
