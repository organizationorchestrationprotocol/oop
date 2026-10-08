'use strict';
// Reference projection of C/U/R/E. The host authenticates observations outside
// model-controlled controller input. This module performs no native operation.
const {isDeepStrictEqual:equal}=require('node:util');
const {identity}=require('./enforcement-install.cjs');
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const text=x=>typeof x==='string' && x.trim().length>0;
const time=x=>typeof x==='string' && Number.isFinite(Date.parse(x));
const scopeValid=s=>object(s) && ['project','runtime','authority','revision'].every(k=>text(s[k]));
function observation(o,scope,dependencies,now) {
  return object(o) && o.origin==='authoritative_observation' && text(o.reference) &&
    equal(o.scope,scope) && equal(o.dependencies,dependencies) && time(o.observed_at) &&
    Date.parse(o.observed_at)<=now && time(o.expires_at) && now<Date.parse(o.expires_at);
}
// Historical events retain authenticated scope/dependency binding; TTL only limits
// current assertions. Options and supplied observations remain host-owned.
function historical(o,scope,dependencies,now){
  return object(o) && o.origin==='authoritative_observation' && text(o.reference) &&
    equal(o.scope,scope) && equal(o.dependencies,dependencies) && time(o.observed_at) &&
    Date.parse(o.observed_at)<=now && time(o.expires_at) && Date.parse(o.expires_at)>Date.parse(o.observed_at);
}
function nativeSuccess(r,p,options){
  // Real Node promise contract: fulfilled writeFile returns undefined; rejection
  // reports failure. The trusted host captures this action result, never the model.
  // Only file-backed definition writes qualify, not enablement or dispatch proof.
  const matches=Array.isArray(options.nativeResults)?options.nativeResults.filter(n=>
    historical(n,p.scope,p.dependencies,options.now) && n.receipt_reference===r.reference && n.registration===r.registration &&
    n.fingerprint===r.fingerprint && equal(n.invocation,r.invocation)):[];
  return matches.length===1 && matches[0].api==='node:fs/promises.writeFile' &&
    matches[0].outcome==='fulfilled' && matches[0].value===undefined && matches[0].error===undefined;
}
function validPackage(p,options={}) {
  if(!object(p))return false;
  const {package_identity,...body}=p;
  return p.format===2 && p.type==='oop_frozen_installation' && package_identity===identity(body) &&
    package_identity===options.expectedPackageIdentity && scopeValid(options.scope) &&
    equal(p.scope,options.scope) && equal(p.dependencies,options.dependencies) &&
    Array.isArray(p.mechanisms) && new Set(p.mechanisms.map(m=>m.registration)).size===p.mechanisms.length &&
    Array.isArray(p.inventory) && p.inventory.length>0 &&
    p.inventory.every(c=>object(c) && text(c.id) && text(c.reference) && text(c.reason) &&
      ['eligible','unsupported','unauthorized','incompatible','not_applicable'].includes(c.disposition)) &&
    new Set(p.inventory.map(c=>c.id)).size===p.inventory.length &&
    p.mechanisms.every(m=>object(m) && text(m.registration) && text(m.definition) && text(m.fingerprint) &&
      Array.isArray(m.candidate_ids) && m.candidate_ids.length>0 &&
      m.candidate_ids.every(id=>p.inventory.some(c=>c.id===id && c.disposition==='eligible'))) &&
    p.inventory.filter(c=>c.disposition==='eligible').every(c=>p.mechanisms.filter(m=>m.candidate_ids.includes(c.id)).length===1) &&
    object(p.wrapper) && text(p.wrapper.content) && text(p.wrapper.interface) && text(p.inventory_reference);
}
function compatibleLegacyReceipt(r,m,p,options) {
  if(options.migration!==true || !object(r) || r.origin!=='authoritative_observation' || !text(r.reference) ||
    !equal(r.scope,p.scope) || !time(r.observed_at) || Date.parse(r.observed_at)>options.now ||
    !object(r.dependencies) || !text(r.dependencies.source) || !object(r.invocation))return false;
  const native=x=>{const {provenance,...rest}=x;return rest;};
  const {source:oldSource,...oldDependencies}=r.dependencies;
  const {source:newSource,...newDependencies}=p.dependencies;
  if(!equal(oldDependencies,newDependencies) || !equal(native(r.invocation),native(m.invocation)))return false;
  return Array.isArray(options.reconciliations) && options.reconciliations.some(o=>
    observation(o,p.scope,p.dependencies,options.now) && o.registration===m.registration &&
    o.receipt_reference===r.reference && o.original_source===oldSource && o.target_source===newSource &&
    ['administrative_equivalence','native_configuration_unchanged','required_consents_preserved',
      'required_restart_resolved','real_error_absent'].every(k=>o[k]===true));
}
function freezeInstallation(plan,preparation,options={}) {
  const fail=reason=>({status:'WAITING_ON_REAL_DEPENDENCY',reason,effect_permission:'not_granted'});
  const {currentInstallationPlan}=require('./install-plan.cjs');
  if(!currentInstallationPlan(plan,options))return fail('invalid_current_plan');
  if(!plan.registrations.length)return fail('no_eligible_mechanisms');
  if(!object(preparation) || !observation(preparation,options.scope,options.dependencies,options.now) ||
    (preparation.first_approval_requested!==false && !(options.migration===true && preparation.legacy_reconciliation===true)) || !object(preparation.wrapper) ||
    !text(preparation.wrapper.content) || !text(preparation.wrapper.interface) ||
    preparation.wrapper.compatible!==true || !Array.isArray(preparation.definitions))return fail('initial_materialization_incomplete');
  if(preparation.definitions.length!==plan.registrations.length ||
    new Set(preparation.definitions.map(d=>d.registration)).size!==preparation.definitions.length)return fail('incomplete_initial_definitions');
  const mechanisms=[];
  for(const g of plan.registrations) {
    const definition=preparation.definitions.find(d=>d.registration===g.registration);
    if(!definition || !text(definition.content) || !equal(definition.invocation,g.invocation) ||
      !['consent_required','restart_required'].every(k=>typeof definition[k]==='boolean'))return fail('definition_or_prerequisite_missing');
    mechanisms.push({registration:g.registration,fingerprint:g.fingerprint,invocation:g.invocation,
      candidate_ids:plan.mechanism_inventory.filter(c=>c.disposition==='eligible' && c.registration===g.registration).map(c=>c.id),
      definition:definition.content,consent_required:definition.consent_required,restart_required:definition.restart_required});
  }
  const body={format:2,type:'oop_frozen_installation',scope:options.scope,dependencies:options.dependencies,
    plan_identity:plan.plan_identity,inventory_reference:plan.inventory_reference,inventory:plan.mechanism_inventory,
    mechanisms,wrapper:preparation.wrapper,installation_chat_id:text(preparation.installation_chat_id)?preparation.installation_chat_id:null,
    configuration_contract:structuredClone(plan.configuration_contract),
    frozen_at:preparation.observed_at,preparation_reference:preparation.reference};
  const p={...body,package_identity:identity(body)};
  if(!validPackage(p,{...options,expectedPackageIdentity:p.package_identity}))return fail('incomplete_mechanism_inventory');
  return {...p,status:'INVENTORIED_AND_FROZEN'};
}
// No functionality/readback/dispatch fact is consumed, including in migration.
function installationState(frozen,receipts,independent,options={}) {
  const {status,...p}=frozen??{};
  const fail=reason=>({format:2,status:'WAITING_ON_REAL_DEPENDENCY',installed_enforcement:false,
    installation_complete:false,pending:[reason],effect_permission:'not_granted'});
  if(!validPackage(p,options) || !Number.isFinite(options.now))return fail('invalid_frozen_package');
  if(!Array.isArray(receipts) || new Set(receipts.map(r=>r?.registration)).size!==receipts.length ||
    receipts.some(r=>!p.mechanisms.some(m=>m.registration===r?.registration)))return fail('ambiguous_or_foreign_receipts');
  const pending=[];
  for(const m of p.mechanisms) {
    const r=receipts.find(r=>r.registration===m.registration);
    const legacy=compatibleLegacyReceipt(r,m,p,options);
    const minimal=object(r) && nativeSuccess(r,p,options);
    const negatives=object(r) && ['disabled','revoked'].every(k=>r[k]===false || (minimal && !Object.hasOwn(r,k))) &&
      (r.error===null || (minimal && !Object.hasOwn(r,'error')));
    if((!historical(r,p.scope,p.dependencies,options.now) && !legacy) || r.fingerprint!==m.fingerprint ||
      (!equal(r.invocation,m.invocation) && !legacy) || !['installed','reused'].includes(r.action) || r.completed!==true ||
      !time(r.completed_at) || Date.parse(r.completed_at)>options.now || !negatives || (m.consent_required ? r.consent!=='granted' : !['not_required','granted'].includes(r.consent)) ||
      (m.restart_required ? r.restart!=='completed' : !['not_required','completed'].includes(r.restart)))pending.push(m.registration);
  }
  const installed=pending.length===0 && p.mechanisms.length>0;
  const prerequisites=observation(independent,p.scope,p.dependencies,options.now) && independent.complete===true &&
    independent.canonical_publication_required===true && independent.publication?.verified===true &&
    independent.publication.record_type==='machine_installation' && independent.publication.identity_only===true &&
    ['repository','ref','commit','content_reference','credential_reference'].every(k=>text(independent.publication[k]));
  const complete=installed && prerequisites;
  const previous=options.previous;
  // Previous checkpoints are host-authenticated, never trusted merely for a label.
  const retained=historical(previous,p.scope,p.dependencies,options.now) && (previous.installation_complete===true || time(previous.installation_completed_at) || time(previous.recognized_at)) &&
    previous.package_identity===p.package_identity;
  const completedAt=retained && (previous.installation_completed_at===null ||
    (time(previous.installation_completed_at) && Date.parse(previous.installation_completed_at)<=options.now))?previous.installation_completed_at:
    complete && options.migration!==true?new Date(options.now).toISOString():null;
  return {format:2,status:complete?'INSTALLATION_COMPLETE':installed?'INSTALLATION_ENFORCEMENT_COMPLETE':'WAITING_ON_REAL_DEPENDENCY',
    package_identity:p.package_identity,installed_enforcement:installed,installation_complete:complete,
    installation_status:installed?'INSTALLED':'PENDING',bootstrap_complete:complete,
    installation_chat_id:p.installation_chat_id,installation_completed_at:completedAt,
    recognized_at:retained && time(previous.recognized_at)?previous.recognized_at:
      complete && options.migration===true?new Date(options.now).toISOString():null,
    pending:installed && !complete?['canonical_publication_or_independent_prerequisite']:pending,
    functioning_basis:installed?'administrative_presumption':'not_established',dispatch_observations:'unmeasured',
    effect_permission:'not_granted'};
}
function wrapperEvolution(checkpoint,chat,change,options={}) {
  const defer=reason=>({action:'defer',reason,installation_complete:checkpoint?.installation_complete===true});
  if(!historical(checkpoint,options.scope,options.dependencies,options.now) ||
    checkpoint.installation_complete!==true || !text(checkpoint.installation_chat_id) || !time(checkpoint.installation_completed_at))return defer('installation_metadata_unavailable');
  if(!observation(chat,options.scope,options.dependencies,options.now) || !text(chat.id) || !time(chat.created_at) ||
    Date.parse(chat.created_at)>options.now || chat.id===checkpoint.installation_chat_id ||
    Date.parse(chat.created_at)<=Date.parse(checkpoint.installation_completed_at) || chat.evasive_fork===true)return defer('not_qualifying_later_chat');
  if(!observation(change,options.scope,options.dependencies,options.now) || !text(change.reason) ||
    !text(change.interface) || !text(change.reference) || !Array.isArray(change.components) || !change.components.length ||
    !['discovered','authorized','safe','compatible','preserves_authority','preserves_failure_propagation'].every(k=>change[k]===true) ||
    !Array.isArray(change.new_consent_definitions))return defer('change_not_authorized_safe_or_compatible');
  return {action:change.new_consent_definitions.length?'request_new_native_consent':'apply',
    consent_definitions:change.new_consent_definitions,reason:change.reason,interface:change.interface,
    components:change.components,installation_complete:true,functionality_certification:false};
}
module.exports={freezeInstallation,installationState,wrapperEvolution,validPackage};
