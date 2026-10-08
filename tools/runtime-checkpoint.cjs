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
  // Legacy mappings remain interpretable history. Current identity-contract
  // mappings must independently bind the installation UID and qualified scope.
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
    revision:0,current_authority:true,...Object.fromEntries(versionFacts.map(k=>[k,null])),
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
    if(Object.keys(change).some(k=>!['facts','attempt','failure','verification','reconciliation'].includes(k)))return unknown('unsupported_transition');
    if(change.reconciliation){
      const r=change.reconciliation;
      if(stored!==null||Object.keys(change).length!==1||r.state!=='RECONCILED_PENDING_PUBLICATION'||
        !validCheckpoint(r.checkpoint,owner)||!Array.isArray(r.supersessions)||
        !same(r.supersessions.map(s=>s.record).sort(),r.checkpoint.history.map(h=>h.legacy_record).sort())||
        !r.supersessions.every(s=>s.current_authority===false&&s.successor===owner.checkpoint_ref&&text(s.evidence)))return unknown('invalid_reconciliation_publication');
      next=clone(r.checkpoint);next.supersessions=clone(r.supersessions);
    }
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
      next.applied_commit=v.commit;next.verified_commit=v.commit;next.verification_ref=v.reference;
      next.completed_migrations=[...new Set([...next.completed_migrations,...v.completed_migrations])];
    }
    next.revision=current.revision+1;
    // These facts authorize neither session context nor any project effect.
    await tx.commit(owner.checkpoint_ref,next);
    return {state:'COMMITTED',checkpoint:clone(next),dependent_effect_permitted:false};
  });
}
function reconcileLegacy({owner,records,selection}={}) {
  if(owner?.state!=='RESOLVED'||!Array.isArray(records))return unknown('legacy_inventory_unresolved');
  if(!records.length)return {state:'UNINITIALIZED',checkpoint:newCheckpoint(owner),supersessions:[]};
  const eligible=records.every(r=>object(r)&&text(r.id)&&r.workspace===owner.workspace&&r.runtime===owner.runtime&&
    r.ownership_verified===true&&text(r.provenance)&&Array.isArray(r.attempts)&&Array.isArray(r.failures)&&
    Array.isArray(r.completed_migrations)&&r.completed_migrations.every(text)&&
    (r.verified_commit===null||(commit(r.verified_commit)&&text(r.verification_ref)))&&
    (r.target_commit===null||commit(r.target_commit)));
  if(!eligible||new Set(records.map(r=>r.id)).size!==records.length)return unknown('foreign_ambiguous_or_incomplete_inventory');
  if(records.some(r=>r.verified_commit!==null&&r.verification_valid!==true))return unknown('baseline_verification_unresolved');
  const verified=records.filter(r=>r.verified_commit!==null),identities=new Set(verified.map(r=>r.verified_commit));
  if(!object(selection)||!Array.isArray(selection.inventory)||selection.current_actual_state_verified!==true||!text(selection.reference)||
    !same([...selection.inventory].sort(),records.map(r=>r.id).sort()))return unknown('current_baseline_evidence_required');
  const selected=records.find(r=>r.id===selection.record);
  if(!selected||(verified.length&&selected.verified_commit===null)||
    (identities.size>1&&(!text(selection.authority_ref)||selection.conflicts_reconciled!==true)))return unknown('verified_baseline_conflict');
  const checkpoint=newCheckpoint(owner);
  checkpoint.verified_commit=selected.verified_commit;checkpoint.applied_commit=selected.verified_commit;
  checkpoint.verification_ref=selected.verification_ref??null;checkpoint.target_commit=selected.target_commit;
  checkpoint.completed_migrations=[...selected.completed_migrations];
  checkpoint.attempts=records.flatMap(r=>r.attempts.map(a=>({...clone(a),legacy_record:r.id})));
  checkpoint.failures=records.flatMap(r=>r.failures.map(f=>({...clone(f),legacy_record:r.id})));
  checkpoint.history=records.map(r=>({legacy_record:r.id,provenance:r.provenance,verified_commit:r.verified_commit,
    verification_ref:r.verification_ref??null,target_commit:r.target_commit,completed_migrations:clone(r.completed_migrations)}));
  return {state:'RECONCILED_PENDING_PUBLICATION',checkpoint,
    supersessions:records.map(r=>({record:r.id,current_authority:false,successor:owner.checkpoint_ref,
      evidence:selection.reference})),dependent_effect_permitted:false};
}
module.exports={resolveRuntime,transitionCheckpoint,reconcileLegacy,validCheckpoint,newCheckpoint,versionFacts};
