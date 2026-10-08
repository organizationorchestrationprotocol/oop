'use strict';
// Local reference only; the host authenticates options and observations outside this API.
const {spawnSync} = require('node:child_process');
const {resolve} = require('node:path');
const {isDeepStrictEqual} = require('node:util');
const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const binding=x=>object(x) && Object.keys(x).sort().join(',')==='kind,source_identity' &&
  x.kind==='source_content' && /^sha256:[a-f0-9]{64}$/.test(x.source_identity);
function inspectAdmission(result, request, command, options={}) {
  const denied=reason=>({admitted:false,reason});
  try {
    if(request?.format!==1 || typeof request.request_id!=='string' || !request.request_id || request.request_id.length>512) return denied('invalid_request');
    // Never derive this value from request/model input or the response being checked.
    if(!binding(options.expectedSourceBinding)) return denied('expected_binding_missing_or_invalid');
    if(result.error || result.signal || typeof result.stdout!=='string' ||
      Buffer.byteLength(result.stdout,'utf8')>2*1024*1024) return denied('execution_failed');
    const response=JSON.parse(result.stdout);
    const keys=['format','type','request_id','command','source_binding','decision','reason_code','effect_permission','assurance','payload'];
    if(!object(response) || Object.keys(response).length!==keys.length || keys.some(k=>!Object.hasOwn(response,k)) ||
      response.format!==1 || response.type!=='oop_admission' || response.command!==command ||
      response.request_id!==request.request_id || typeof response.assurance!=='string' || !response.assurance ||
      !object(response.payload) || typeof response.payload.runtime_message!=='string' || !['allow','deny','unknown','error'].includes(response.decision) ||
      typeof response.reason_code!=='string' || !response.reason_code ||
      !['not_granted','conditional_on_adapter'].includes(response.effect_permission)) return denied('invalid_response');
    if(!binding(response.source_binding) || !isDeepStrictEqual(response.source_binding,options.expectedSourceBinding))
      return denied('source_binding_mismatch');
    if(result.status!==({allow:0,deny:2,unknown:3,error:4})[response.decision]) return denied('exit_mismatch');
    if(command!=='pre-effect' || response.decision!=='allow' || response.reason_code!=='required_predicates_satisfied' ||
      response.effect_permission!=='conditional_on_adapter') return denied('not_admitted');
    const payload=response.payload;
    if(Object.keys(payload).sort().join(',')!=='checked,modules,observation_time,runtime_message,semantic_assurance,state_write' ||
      !['checked','modules'].every(k=>Array.isArray(payload[k]) && payload[k].length && payload[k].every(v=>typeof v==='string' && v)) ||
      !['observation_time','semantic_assurance','state_write'].every(k=>typeof payload[k]==='string' && payload[k]) ||
      !Number.isFinite(Date.parse(payload.observation_time))) return denied('invalid_allow_payload');
    return {admitted:true,reason:'required_predicates_satisfied'};
  } catch {return denied('invalid_response');}
}
function interpret(result, request, command, options) {
  return inspectAdmission(result,request,command,options).admitted;
}
function admission(request, options={}) {
  try {
    if(!binding(options.expectedSourceBinding)) return {admitted:false,reason:'expected_binding_missing_or_invalid'};
    if(request?.format!==1 || typeof request.request_id!=='string' || !request.request_id || request.request_id.length>512)
      return {admitted:false,reason:'invalid_request'};
    const result=spawnSync(options.interpreter??process.execPath,
      [resolve(__dirname,'../dist/oop-enforce.js'),'pre-effect'],{
        input:JSON.stringify(request),encoding:'utf8',timeout:options.timeout??6000,
        cwd:resolve(__dirname,'..'),maxBuffer:2*1024*1024,
      });
    return inspectAdmission(result,request,'pre-effect',options);
  } catch {return {admitted:false,reason:'execution_failed'};}
}
function admit(request, options) {return admission(request,options).admitted;}
function guardedEffect(request, effect, options={}) {
  const gate=admission(request,options);
  if(!gate.admitted) return {...gate,attempted:false,performed:false,completion:'not_attempted',verified:false};
  if(typeof effect!=='function') return {admitted:true,reason:'invalid_effect',attempted:false,performed:false,completion:'not_attempted',verified:false};
  // Native authority/revision/CAS checks still belong at the actual backend boundary.
  const failed=()=>({admitted:true,attempted:true,performed:null,completion:'failed',verified:false,reason:'unknown_partial_effect'});
  const finish=value=>{
    const outcome={admitted:true,attempted:true,performed:true,completion:'returned',verified:false};
    if(typeof options.verifyEffect!=='function') return outcome;
    const verified=proof=>({...outcome,completion:'readback',verified:proof===true,
      reason:proof===true?'postconditions_observed':'postconditions_not_verified'});
    try {
      const proof=options.verifyEffect(value);
      return proof && typeof proof.then==='function' ? Promise.resolve(proof).then(verified,()=>verified(false)) : verified(proof);
    } catch {return verified(false);}
  };
  const pending=promise=>({admitted:true,attempted:true,performed:null,completion:'pending',verified:false,completionResult:promise});
  try {
    const value=effect();
    if(value && typeof value.then==='function') return pending(Promise.resolve(value).then(finish,failed));
    const outcome=finish(value);
    return outcome && typeof outcome.then==='function'?pending(outcome):outcome;
  } catch {return failed();}
}
// Host supplies authenticated capability observations and required path/phase scope.
// This pure planner performs no registration, probe, write or authority acquisition.
const featureNames=['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe'];
const featurePhases={entry:['session_entry'],interaction:['user_interaction'],'pre-effect':['before_effect'],'post-effect':['after_effect'],completion:['before_completion'],recovery:['session_entry','resume_before_effect'],delegate:['delegate_start','delegate_finish'],probe:['diagnostic_after_bootstrap']};
const featureRoles={entry:'context_delivery',interaction:'context_delivery','pre-effect':'preventive_gate','post-effect':'observation',completion:'completion_blocking',recovery:'preventive_gate',delegate:'preventive_gate',probe:'diagnostic'};
const dispatchOrder=['entry','interaction','recovery','delegate','pre-effect','post-effect','completion','probe'];
const prevention=new Set(['pre-effect','completion','recovery','delegate']);
const text=x=>typeof x==='string' && x.length>0;
// Optional dimensions narrow declared path coverage; omission never widens it.
const dimensionFields={effect_class:'effect_classes',resource_class:'resource_classes',authority_scope:'authority_scopes'};
const coversDimensions=(capability,requirement)=>Object.entries(dimensionFields).every(([key,field])=>
  requirement[key]===undefined || (Array.isArray(capability[field]) && capability[field].every(text) && capability[field].includes(requirement[key])));
function semanticRoles(c) {
  const roles=c.feature_semantics;
  if(roles!==undefined && (!object(roles) || Object.keys(roles).length!==c.features.length ||
    Object.keys(roles).some(f=>!c.features.includes(f))))return null;
  if(!Object.values(featureRoles).includes(c.semantics))return null;
  const resolved=Object.fromEntries(c.features.map(f=>[f,roles===undefined?c.semantics:roles[f]]));
  if(Object.values(resolved).some(role=>!Object.values(featureRoles).includes(role)) ||
    (roles!==undefined && !Object.values(resolved).includes(c.semantics)))return null;
  return resolved;
}
const roleCovers=(role,feature)=>role===featureRoles[feature] || (feature==='completion' && role==='preventive_gate');
// Privileged host context, never model/request evidence. Identity and dependency equality
// prevent accidental reuse across scope; the host still authenticates observations.
function diagnosticIntent(options,dependencies,requirement) {
  if(options?.lifecycle!=='post_bootstrap' || !object(options.scope) ||
    !['project','runtime','authority','revision'].every(k=>text(options.scope[k])) || !Array.isArray(options.diagnostics))return null;
  const matches=options.diagnostics.filter(d=>object(d) && d.origin==='authoritative_observation' && d.authorized===true &&
    d.max_invocations===1 && text(d.need_reference) && text(d.authorization_reference) &&
    isDeepStrictEqual(d.scope,options.scope) && isDeepStrictEqual(d.dependencies,dependencies) &&
    isDeepStrictEqual(d.requirement,requirement));
  return matches.length===1?matches[0]:null;
}
function planBindings(capabilities,requirements,dependencies,installed={},options={}) {
  const limited=reason=>({status:'BLOCKED_OR_LIMITED',reason,registrations:[],diagnostic_plans:[],actions:[],uncovered:requirements,
    full_readiness:false,active_hook_tests:0});
  if(!Array.isArray(capabilities) || capabilities.length>128 || !Array.isArray(requirements) || !requirements.length || requirements.length>128 ||
    !object(dependencies) || !['source','runtime_build','permissions','configuration'].every(k=>text(dependencies[k])))
    return limited('invalid_plan_input');
  if(requirements.some(r=>!object(r) || !featureNames.includes(r.feature) || !featurePhases[r.feature]?.includes(r.phase) ||
    !['path','phase'].every(k=>text(r[k])) || Object.keys(dimensionFields).some(k=>r[k]!==undefined && !text(r[k])) ||
    !Number.isInteger(r.minimum_tier) || r.minimum_tier<0))
    return limited('invalid_requirement');
  const eligible=capabilities.filter(c=>object(c) && text(c.id) && text(c.registration) && text(c.fingerprint) &&
    Number.isInteger(c.tier) && c.tier>=0 && c.available===true && c.authorized===true && c.disabled===false &&
    ['features','paths','phases'].every(k=>Array.isArray(c[k]) && c[k].length && c[k].every(text)) &&
    c.features.every(f=>featureNames.includes(f)) && new Set(c.features).size===c.features.length && semanticRoles(c));
  // One registration identifies one invocation, including roles, events, scope and provenance.
  const invocation=c=>({fingerprint:c.fingerprint,semantics:c.semantics,roles:semanticRoles(c),phases:c.phases,
    paths:c.paths,...(c.scope===undefined?{}:{scope:c.scope}),...(c.provenance===undefined?{}:{provenance:c.provenance}),
    ...(c.blocking===undefined?{}:{blocking:c.blocking}),...(c.runtime_adapter===undefined?{}:{runtime_adapter:c.runtime_adapter}),
    ...Object.fromEntries(['permissions','consent_scope','native_mode'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]])),
    ...Object.fromEntries(Object.values(dimensionFields).filter(k=>c[k]!==undefined).map(k=>[k,c[k]]))});
  if(new Set(eligible.map(c=>c.id)).size!==eligible.length || eligible.some((c,i)=>eligible.some((d,j)=>i!==j &&
    c.registration===d.registration && !isDeepStrictEqual(invocation(c),invocation(d)))))
    return limited('conflicting_registration');
  const covers=(c,r)=>c.features.includes(r.feature) && c.paths.includes(r.path) && c.phases.includes(r.phase) && c.tier>=r.minimum_tier &&
    coversDimensions(c,r) &&
    roleCovers(semanticRoles(c)[r.feature],r.feature) && (!prevention.has(r.feature) || c.blocking===true) &&
    (r.feature!=='probe' || diagnosticIntent(options,dependencies,r)!==null);
  if(eligible.some(c=>Array.isArray(c.conflicts_with) && eligible.some(other=>c.conflicts_with.includes(other.id))))
    return limited('incompatible_native_modes_require_host_resolution');
  const selected=new Set(),assignments=[],uncovered=[];
  for(const r of requirements) {
    const candidates=eligible.filter(c=>covers(c,r)).sort((a,b)=>b.tier-a.tier ||
      Number(selected.has(b))-Number(selected.has(a)) ||
      requirements.filter(x=>covers(b,x)).length-requirements.filter(x=>covers(a,x)).length || a.registration.localeCompare(b.registration) || a.id.localeCompare(b.id));
    if(!candidates.length)uncovered.push(r);
    else for(const capability of candidates) {
      selected.add(capability);assignments.push({requirement:r,capability});
    }
  }
  const registrations=[],diagnostic_plans=[];
  for(const {requirement:r,capability:c} of assignments) {
    const target=r.feature==='probe'?diagnostic_plans:registrations;
    let group=target.find(g=>g.registration===c.registration);
    if(!group) {
      group={registration:c.registration,fingerprint:c.fingerprint,semantics:c.semantics,invocation:invocation(c),feature_semantics:{},features:[],coverage:[],assurance:'UNVERIFIED_FOR_UNEXERCISED_PATHS'};
      if(r.feature==='probe')Object.assign(group,{assurance:'NOT_APPLICABLE',effect_permission:'not_granted',dependencies:{...dependencies},diagnostic_intents:[]});
      target.push(group);
    }
    if(!group.features.includes(r.feature))group.features.push(r.feature);
    group.feature_semantics[r.feature]=semanticRoles(c)[r.feature];
    if(!group.coverage.some(x=>isDeepStrictEqual(x,r))) {
      group.coverage.push(r);
      if(r.feature==='probe')group.diagnostic_intents.push(diagnosticIntent(options,dependencies,r));
    }
  }
  for(const group of registrations) {
    group.features.sort((a,b)=>featureNames.indexOf(a)-featureNames.indexOf(b));
    const members=[...selected].filter(c=>c.registration===group.registration);
    // Direct administrative acknowledgment suffices; no coverage or second API proof.
    if(members.every(c=>{
      const e=c.administrative_evidence;
      return object(e) && e.origin==='authoritative_observation' && text(e.reference) &&
        object(options.scope) && ['project','runtime','authority','revision'].every(k=>text(options.scope[k])) &&
        isDeepStrictEqual(e.scope,options.scope) && isDeepStrictEqual(e.invocation,group.invocation) &&
        isDeepStrictEqual(e.dependencies,dependencies) &&
        Number.isFinite(options.now) && Number.isFinite(Date.parse(e.observed_at)) && Number.isFinite(Date.parse(e.expires_at)) &&
        Date.parse(e.observed_at)<=options.now && options.now<Date.parse(e.expires_at) &&
        e.installation_completed===true && e.native_consent_resolved===true && e.restart_resolved===true && e.real_error_absent===true;
    }))group.assurance='ADMINISTRATIVELY_INSTALLED';
  }
  const sameDependencies=object(installed) && isDeepStrictEqual(installed.dependencies,dependencies);
  const actions=registrations.map(g=>({registration:g.registration,operation:sameDependencies &&
    installed.registrations?.some(c=>c.registration===g.registration && c.fingerprint===g.fingerprint && c.semantics===g.semantics &&
      isDeepStrictEqual(c.invocation,g.invocation) && isDeepStrictEqual(c.feature_semantics,g.feature_semantics) && isDeepStrictEqual(c.features,g.features) &&
      isDeepStrictEqual(c.coverage,g.coverage) && c.administrative_completed===true)?'reuse':'configure_and_acknowledge',
    max_attempts:2,on_interruption:'Reconcile owned actual configuration before retry; retain verified active controller.',active_hook_tests:0}));
  return {status:uncovered.length?'BLOCKED_OR_LIMITED':!registrations.length?'DIAGNOSTIC_PLANNED':registrations.every(g=>g.assurance==='ADMINISTRATIVELY_INSTALLED')?'ADMINISTRATIVELY_INSTALLED':'PLANNED',
    dependencies:{...dependencies},registrations,diagnostic_plans,actions,uncovered,full_readiness:false,bootstrap_complete:false,effect_permission:'not_granted',active_hook_tests:0,
    next:'Direct administrative installation, required consent and restart suffice for normative functioning; independently authorize every effect and propagate actual failures.'};
}
async function dispatchBinding(group,requests,options={}) {
  const results=[];
  if(!object(group) || !Array.isArray(group.features) || !group.features.length ||
    group.features.some(f=>!featureNames.includes(f)) || new Set(group.features).size!==group.features.length ||
    (group.feature_semantics!==undefined && (!object(group.feature_semantics) || Object.keys(group.feature_semantics).length!==group.features.length ||
      group.features.some(f=>!roleCovers(group.feature_semantics[f],f)))) ||
    (group.features.includes('probe') && (group.features.length!==1 ||
      (group.feature_semantics?.probe??group.semantics)!=='diagnostic' || !Array.isArray(group.coverage) || !group.coverage.length ||
      group.coverage.some(r=>r.feature!=='probe' || r.phase!=='diagnostic_after_bootstrap' ||
        !diagnosticIntent(options.planningContext,group.dependencies,r)) ||
      !isDeepStrictEqual(group.diagnostic_intents,group.coverage.map(r=>diagnosticIntent(options.planningContext,group.dependencies,r))))) ||
    (group.features.includes('recovery') && typeof options.event?.recovery_required!=='boolean') ||
    !binding(options.expectedSourceBinding) || !isDeepStrictEqual(group,options.expectedBinding) || typeof options.invoke!=='function')
    return {decision:'error',dependent_effect_permitted:false,results:[{decision:'error',reason:'invalid_binding'}]};
  const commands=group.features.filter(f=>f!=='recovery' || options.event.recovery_required===true).sort((a,b)=>dispatchOrder.indexOf(a)-dispatchOrder.indexOf(b));
  for(const command of commands) {
    try {
      const request=requests?.[command];
      if(options.signal?.aborted)throw Error('cancelled');
      const timeout=Number.isInteger(options.timeoutMs) && options.timeoutMs>0 && options.timeoutMs<=30000?options.timeoutMs:6000;
      let timer;let raw;
      try {raw=await Promise.race([Promise.resolve().then(()=>options.invoke(command,request)),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),timeout);})]);}
      finally {clearTimeout(timer);}
      if(command==='pre-effect') {
        const gate=inspectAdmission(raw,request,command,options);
        results.push({command,decision:gate.admitted?'allow':gate.reason==='not_admitted'?JSON.parse(raw.stdout).decision:'error',reason:gate.reason});
      } else {
        if(typeof raw.stdout!=='string' || Buffer.byteLength(raw.stdout,'utf8')>2*1024*1024)throw Error('invalid_response');
        const r=JSON.parse(raw.stdout);
        const keys=['format','type','request_id','command','source_binding','decision','reason_code','effect_permission','assurance','payload'];
        if(raw.error || raw.signal || !object(request) || request.format!==1 || typeof request.request_id!=='string' || !request.request_id || request.request_id.length>512 ||
          !object(r) || Object.keys(r).length!==keys.length || keys.some(k=>!Object.hasOwn(r,k)) || r.format!==1 || r.type!=='oop_admission' ||
          r.request_id!==request.request_id || r.command!==command || !binding(r.source_binding) ||
          !isDeepStrictEqual(r.source_binding,options.expectedSourceBinding) ||
          !['allow','deny','unknown','error'].includes(r.decision) || raw.status!==({allow:0,deny:2,unknown:3,error:4})[r.decision] ||
          r.effect_permission!=='not_granted' || typeof r.reason_code!=='string' || !r.reason_code ||
          !object(r.payload) || typeof r.payload.runtime_message!=='string' || typeof r.assurance!=='string' || !r.assurance)throw Error('invalid_response');
        if(r.decision==='allow' && (r.reason_code!=='required_predicates_satisfied' ||
          Object.keys(r.payload).sort().join(',')!=='checked,modules,observation_time,runtime_message,semantic_assurance,state_write' ||
          !['checked','modules'].every(k=>Array.isArray(r.payload[k]) && r.payload[k].length && r.payload[k].every(v=>typeof v==='string' && v)) ||
          !['observation_time','semantic_assurance','state_write'].every(k=>typeof r.payload[k]==='string' && r.payload[k]) ||
          !Number.isFinite(Date.parse(r.payload.observation_time))))throw Error('invalid_allow_payload');
        results.push({command,decision:r.decision,reason:r.reason_code});
      }
    } catch {results.push({command,decision:'error',reason:'handler_failed'});}
  }
  const decision=['error','deny','unknown','allow'].find(d=>results.some(r=>r.decision===d));
  // Dispatch never executes effects; only existing strict pre-effect admission can qualify.
  return {decision,dependent_effect_permitted:decision==='allow' && commands.includes('pre-effect') &&
    (group.feature_semantics?.['pre-effect']??group.semantics)==='preventive_gate' && !commands.includes('probe'),results};
}
module.exports={...require('./runtime-checkpoint.cjs'),admit,interpret,inspectAdmission,guardedEffect,planBindings,dispatchBinding,coversDimensions,...require('./install-plan.cjs'),...require('./installation-lifecycle.cjs')};
