'use strict';
// Bounded producer reference. Host observations and transactional storage must
// be independently authenticated/implemented by the actual integration.
const {isDeepStrictEqual:same}=require('node:util');
const text=x=>typeof x==='string' && x.trim().length>0;
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const clone=x=>structuredClone(x);
const unknown=reason=>({state:'UNKNOWN',reason,dependent_effect_permitted:false});
const revision=x=>Number.isSafeInteger(x) && x>=0;
const commit=x=>typeof x==='string' && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(x);
const versionFacts=['available_commit','downloaded_commit','compatible_commit','target_commit','applied_commit','verified_commit'];
function resolveRuntime({workspace,runtime,binding,observation}={}) {
  if(!text(workspace)||!text(runtime)||!object(binding)||binding.workspace!==workspace ||
    !text(binding.revision)||!Array.isArray(binding.runtimes))return unknown('workspace_binding_unresolved');
  const candidates=binding.runtimes.filter(m=>m.runtime===runtime);
  if(candidates.length!==1)return unknown('runtime_mapping_missing_or_ambiguous');
  const m=candidates[0],o=observation;
  // Identity-contract mappings must independently bind the installation UID and qualified scope.
  if(binding.identity_contract===1&&(!text(m.installation_uid)||!text(m.owned_scope)||
    !m.owned_scope.replaceAll('\\','/').split('/').includes(encodeURIComponent(m.installation_uid))||!m.checkpoint_ref?.startsWith(m.owned_scope+'/')||
    !m.session_root?.startsWith(m.owned_scope+'/')||o?.installation_uid!==m.installation_uid||
    o?.continuity_verified!==true))return unknown('installation_identity_unresolved');
  if(binding.runtimes.some(other=>other.runtime!==runtime&&other.status==='active'&&other.checkpoint_ref===m.checkpoint_ref))return unknown('checkpoint_shared_by_distinct_owners');
  if(m.identity_basis!=='persistent_integration'||!text(m.checkpoint_ref)||
    !object(m.boundary)||!['ownership','configuration','authority'].every(k=>text(m.boundary[k]))||
    !text(m.identity_decision)||m.status!=='active')return unknown('persistent_owner_unresolved');
  // A pathname, string pattern or supplied true label cannot establish ownership.
  if(!object(o)||o.origin!=='authoritative_observation'||o.current!==true||!text(o.reference)||
    o.workspace!==workspace||o.runtime!==runtime||o.mapping_revision!==binding.revision||
    o.checkpoint_ref!==m.checkpoint_ref||o.identity_basis!=='persistent_integration'||
    o.identity_decision!==m.identity_decision||!same(o.boundary,m.boundary))return unknown('runtime_identity_evidence_missing');
  return {state:'RESOLVED',workspace,runtime,checkpoint_ref:m.checkpoint_ref,mapping_revision:binding.revision,
    ...(binding.identity_contract===1?{installation_uid:m.installation_uid,owned_scope:m.owned_scope,session_root:m.session_root}:{}),
    boundary:clone(m.boundary),identity_decision:m.identity_decision,dependent_effect_permitted:false};
}
function validCheckpoint(c,owner) {
  return object(c)&&c.workspace===owner.workspace&&c.runtime===owner.runtime&&c.checkpoint_ref===owner.checkpoint_ref&&
    (!owner.installation_uid||c.installation_uid===owner.installation_uid)&&
    c.mapping_revision===owner.mapping_revision&&revision(c.revision)&&Array.isArray(c.attempts)&&
    Array.isArray(c.failures)&&Array.isArray(c.history)&&Array.isArray(c.completed_migrations)&&
    c.current_authority===true&&versionFacts.every(k=>c[k]===null||commit(c[k]))&&
    c.applied_commit===c.verified_commit&&(c.verified_commit===null||text(c.verification_ref));
}
function newCheckpoint(owner) {
  return {...Object.fromEntries(['workspace','runtime','checkpoint_ref','mapping_revision'].map(k=>[k,owner[k]])),
    ...(owner.installation_uid?{installation_uid:owner.installation_uid}:{}),
    revision:0,status:'pending',current_authority:true,...Object.fromEntries(versionFacts.map(k=>[k,null])),
    verification_ref:null,attempts:[],failures:[],history:[],completed_migrations:[]};
}
// The store transaction must serialize mapping resolution AND publication and
// provide recoverable atomic commit. A read followed by rename is insufficient.
async function transitionCheckpoint({resolve,store,expectedRevision,session,change}={}) {
  if(typeof resolve!=='function'||typeof store?.transaction!=='function'||!text(session)||!object(change))return unknown('safe_coordination_unavailable');
  return store.transaction(async tx=>{
    const owner=await resolve();
    if(owner?.state!=='RESOLVED')return unknown('owner_unresolved');
    if(tx.mappingRevision!==owner.mapping_revision)return unknown('stale_mapping');
    const stored=await tx.read(owner.checkpoint_ref);
    if(stored!==null&&!validCheckpoint(stored,owner))return unknown('invalid_current_checkpoint');
    if((stored===null?null:stored.revision)!==expectedRevision)return unknown('stale_checkpoint_revision');
    const current=stored??newCheckpoint(owner);let next=clone(current);
    if(Object.keys(change).some(k=>!['facts','attempt','failure','verification'].includes(k)))return unknown('unsupported_transition');
    if(change.facts)for(const [key,value] of Object.entries(change.facts)){
      if(!versionFacts.slice(0,4).includes(key)||(value!==null&&!commit(value)))return unknown('invalid_version_fact');
      next[key]=value;
    }
    if(change.attempt){if(!text(change.attempt.id))return unknown('invalid_attempt');next.attempts.push({...clone(change.attempt),session});}
    if(change.failure){if(!text(change.failure.id))return unknown('invalid_failure');next.failures.push({...clone(change.failure),session});}
    if(change.verification){
      const v=change.verification;
      if(v.criteria_passed!==true||v.runtime_scope_verified!==true||!commit(v.commit)||v.commit!==next.target_commit||
        !text(v.reference)||!Array.isArray(v.completed_migrations)||!v.completed_migrations.every(text))return unknown('verification_incomplete');
      next.history.push({revision:current.revision,verified_commit:current.verified_commit,verification_ref:current.verification_ref});
      next.status='adopted';next.applied_commit=v.commit;next.verified_commit=v.commit;next.verification_ref=v.reference;
      next.completed_migrations=[...new Set([...next.completed_migrations,...v.completed_migrations])];
    }
    next.revision=current.revision+1;
    // These facts authorize neither session context nor any project effect.
    await tx.commit(owner.checkpoint_ref,next);
    return {state:'COMMITTED',checkpoint:clone(next),dependent_effect_permitted:false};
  });
}
module.exports={resolveRuntime,transitionCheckpoint,validCheckpoint,newCheckpoint,versionFacts};
