'use strict';
// Controller-owned reconciliation. No external semantic observer or effect executor.
function runtimeAction(engine,coordination){
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),crypto=process.getBuiltinModule('node:crypto');
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const canonical=x=>Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const hash=x=>'sha256:'+crypto.createHash('sha256').update(x).digest('hex'),identity=x=>hash(JSON.stringify(canonical(x)));
  const same=(a,b)=>identity(a)===identity(b);
  const progressIdentity=(state,observed,source)=>identity({source,loaded:state.loaded_modules,request_context:state.request_content_identity,outcome:state.last_outcome?.outcome_identity??null,resources:observed.filter(e=>e.identity!=='absent').map(e=>[e.path,e.identity])});
  const factual=['current_source_verified','context_delivered_verified','runtime_identity_verified','checkpoint_current_verified','session_scope_verified','expected_revision_verified','installed_enforcement','control_failure_absent','actual_effects_observed'];
  function interpretive(id){return typeof id==='string'&&(id.startsWith('semantic:')||!factual.includes(id));}
  function key(p,r){const n=path.resolve(p);return r.filesystem_case_sensitive?n:n.toLowerCase();}
  const within=(p,root,r)=>{const rel=path.relative(key(root,r),key(p,r));return !rel||!rel.startsWith('..')&&!path.isAbsolute(rel);};
  function file(p,r){
    if(!path.isAbsolute(p)||!within(p,r.project_root,r))throw Error('effect_outside_workspace');
    let nearest=p;while(!fs.existsSync(nearest))nearest=path.dirname(nearest);
    if(key(fs.realpathSync.native(nearest),r)!==key(nearest,r))throw Error('effect_path_alias');
    if(!fs.existsSync(p))return 'absent';
    const st=fs.lstatSync(p);if(!st.isFile()||st.nlink!==1||st.size>1048576)throw Error('effect_revision_unobservable');
    return hash(fs.readFileSync(p));
  }
  function dependencies(acquired,spec,source){return {...Object.fromEntries(Object.entries(acquired.observations??{}).map(([id,o])=>['local_'+id,o.identity])),registration:spec.identity,source};}
  function refresh({record:r,acquired,session,command,spec}){
    const options={reg:{record:r}},st=coordination.actionState(session,options),prior=st?.pending_actions?.[command];
    if(!prior||st.state!=='working'||st.guidance_pending||st.context_integrity==='stale'||acquired.status!=='known')return;
    const {generation,...receipt}=prior;
    return coordination.recordAction(session,{...receipt,source_identity:engine.config.source_binding.source_identity,dependencies:dependencies(acquired,spec,engine.config.source_binding.source_identity),request_reference:st.request_reference},options);
  }
  function prepare({record:r,acquired,decoded,request,command,spec,recorded=false}){
    const options={reg:{record:r}},session=decoded.session,source=engine.config.source_binding.source_identity;
    const fail=(reason,extra={})=>({ok:false,reason,extra,request,decision:['protected_control_effect','effect_outside_workspace','effect_outside_declared_scope','effect_outside_owned_scope','administrative_scope_unverified','action_governance_incomplete','source_outside_allowed_scope','effect_path_alias'].includes(reason)?'deny':'unknown'});
    if(command==='interaction'&&decoded.interaction!==undefined){
      const input=decoded.interaction;
      if(!object(input)||typeof input.text!=='string'||!input.text||typeof input.turn_id!=='string'||!input.turn_id)return fail('native_request_unavailable');
      const ref=identity({session,turn:input.turn_id,text:input.text});
      if(!coordination.recordRequest(session,{reference:ref,turn_id:input.turn_id,content_identity:hash(input.text)},options))return fail('request_history_full');
      return {ok:true,request,context_only:true};
    }
    if(['entry','interaction','probe'].includes(command))return {ok:true,request,context_only:true};
    if(acquired.status!=='known'||acquired.maintenance.mode!=='normal')return fail('local_observations_unavailable');
    const action=decoded.action,initial=coordination.actionState(session,options);
    if(!initial)return fail('unknown_session');
    const saved=initial.pending_actions?.[command];
    if(recorded&&(command!=='post-effect'||!saved||initial.last_outcome?.action_identity!==saved.action_identity))return fail('actual_outcome_unavailable');
    if(!recorded&&(!object(action)||Object.keys(action).some(k=>!['operation','arguments'].includes(k))||typeof action.operation!=='string'||!/^[-A-Za-z0-9_.:]{1,128}$/.test(action.operation)||!Object.hasOwn(action,'arguments')))return fail('native_action_unavailable');
    const logical=recorded?null:['completion','delegate','recovery'].includes(command)&&object(action.arguments)?{operation:action.operation,arguments:Object.fromEntries(Object.entries(action.arguments).filter(([k])=>!['turn_id','last_assistant_message','stop_hook_active'].includes(k)))}:action;
    const actionId=recorded?saved.action_identity:identity(logical),deps=dependencies(acquired,spec,source);
    if(!recorded&&!coordination.recordNativeInput(session,{command,input_identity:identity(action),request_id:request.request_id},options))return fail('native_action_unavailable');
    request={...request,request_id:recorded?initial.last_outcome.request_id:request.request_id,context:{...request.context,project:r.project_root,runtime:r.runtime_class,installation_uid:r.installation_uid,machine_id:r.machine_id,checkpoint_ref:acquired.mapping.checkpoint_ref,checkpoint_revision:String(acquired.checkpoint.revision),mapping_revision:acquired.binding.revision,dependencies:deps}};
    const receipt={action_identity:actionId,command,operation:recorded?saved.operation:action.operation,source_identity:source,dependencies:deps,request_reference:initial.request_reference??null};
    const pending=coordination.recordAction(session,receipt,options);if(!pending)return fail('action_receipt_unavailable');
    let state=coordination.actionState(session,options);
    if(command==='post-effect'&&Object.hasOwn(decoded,'outcome')){
      coordination.recordOutcome(session,{action_identity:actionId,request_id:request.request_id,outcome_identity:identity(decoded.outcome)},options);
      state=coordination.actionState(session,options);
    }
    const a=state.assessments?.[command];
    const provisional=engine.select({classification:'known',request:['interaction',...(state.facets??[])]}).modules;
    const challenge={...pending,session,state_revision:state.revision,request_reference:state.request_reference,required_context:provisional.map(id=>({id,path:engine.config.routing.modules.find(m=>m.id===id).context})),required_judgments:[...engine.config.commands[command].required.filter(interpretive),...engine.config.contracts.filter(c=>provisional.includes(c.module)).map(c=>'semantic:'+c.id)],load:{scope:'action',command},declare:{phase:'assessment',expected_revision:state.revision},assurance:'Receipt identifies the actual invocation; it is not effect permission.'};
    if(!state.request_reference)return fail('native_request_unavailable',{action:challenge});
    if(state.state!=='working'||state.guidance_pending||state.context_integrity==='stale'||state.guidance?.requires_reclassification||state.guidance?.relation==='cancellation')return fail('action_classification_pending',{action:challenge});
    if(!a||a.action_identity!==actionId||a.generation!==pending.generation||a.source_identity!==source||a.request_reference!==state.request_reference||!same(a.dependencies,deps)||a.declaration_identity!==state.declaration_identity||command==='pre-effect'&&state.last_admission?.assessment_identity===a.identity){
      const repair=['completion','delegate'].includes(command)?{progress:progressIdentity(state,[],source),session_revision:state.revision,next_action:'Load the pending action and submit its revision-checked semantic assessment through the official control-plane commands; do not execute an unadmitted material effect.'}:null;
      return fail('needs_action_assessment',{action:challenge,...(repair?{repair}: {})});
    }
    const bookkeeping=a.purpose==='bookkeeping',effects=a.effects;
    if(bookkeeping&&(!['pre-effect','post-effect'].includes(command)||!effects.length))return fail('administrative_scope_unverified',{action:challenge});
    if(!bookkeeping&&!Array.isArray(r.protected_configuration_paths))return fail('native_configuration_scope_unavailable',{action:challenge});
    if(command==='pre-effect'&&!effects.length)return fail('effect_set_unresolved',{action:challenge});
    const observed=[],references=[],protectedPaths=[r.controller_locator,r.runtime_adapter.path,spec.path,...(r.protected_configuration_paths??[])].map(p=>key(p,r));
    const bookkeepingPaths=[acquired.mapping.checkpoint_ref,path.join(r.owned_scope,'administration.json'),path.join(r.owned_scope,'action-reconciliation.json')];
    try{for(const e of effects){
      const target=path.resolve(r.project_root,e.path),actual=file(target,r);
      if(protectedPaths.includes(key(target,r))||within(target,path.join(r.project_root,'.git'),r)||e.access==='write'&&within(target,path.join(r.owned_scope,'sessions'),r))return fail('protected_control_effect',{action:challenge});
      if(!state.resources?.some(p=>within(target,path.resolve(r.project_root,p),r)))return fail('effect_outside_declared_scope',{action:challenge});
      if(within(target,r.private_root,r)&&!within(target,r.owned_scope,r))return fail('effect_outside_owned_scope',{action:challenge});
      if(bookkeeping&&(!bookkeepingPaths.some(p=>key(p,r)===key(target,r))||e.access!=='write')||!bookkeeping&&e.access==='write'&&bookkeepingPaths.some(p=>key(p,r)===key(target,r)))return fail('administrative_scope_unverified',{action:challenge});
      observed.push({path:target,access:e.access,identity:actual,expected_identity:e.expected_identity});
    }}catch(e){return fail(e.message,{action:challenge});}
    if(command==='pre-effect'&&(state.level==='G0'||['G2','G3','G4'].includes(state.level)&&!state.work_item))return fail('action_governance_incomplete',{action:challenge});
    try{for(const s of a.sources??[]){const target=path.resolve(r.project_root,s.path);
      if(within(target,r.private_root,r)&&!within(target,r.owned_scope,r)&&!r.governed_stores.some(store=>within(target,store.locator,r)))return fail('source_outside_allowed_scope',{action:challenge});
      const current=file(target,r);if(current!==s.expected_identity)return fail('action_source_changed',{action:challenge});references.push({path:target,identity:current});
    }}catch(e){return fail(e.message,{action:challenge});}
    const facets=[...new Set([...state.facets,...a.facets])],scope={classification:'known',request:['interaction',...facets],action:[a.effect_class]};
    const selection=engine.select(scope),selected=engine.config.contracts.filter(c=>selection.modules.includes(c.module));
    const set=coordination.composeInstructions(null,{...options,sourceIdentity:source});
    const moduleFacts=[];const modulesCurrent=selection.modules.every(id=>{
      const loaded=state.loaded_modules?.[id],definition=engine.config.routing.modules.find(m=>m.id===id);
      try{const p=path.join(path.dirname(r.controller_locator),definition.context),current=hash(fs.readFileSync(p));moduleFacts.push({path:p,identity:current});return loaded?.source_identity===source&&loaded.content_identity===current;}catch{return false;}
    });
    const c={...request.context,session,request_scope:state.request_reference,action_scope:actionId,revision:identity(observed),authority:state.request_reference,
      resource:observed.length===1?observed[0].path:'action:'+actionId,risk:state.level,lifecycle:state.state,context_retention:identity(state.loaded_modules??{}),
      oop_commit:bookkeeping?acquired.checkpoint.target_commit:acquired.checkpoint.verified_commit,observed_at:new Date().toISOString(),dependencies:deps};
    const binding={...Object.fromEntries(['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'].map(k=>[k,c[k]])),command,selection:selection.modules.join(','),effect_class:command==='pre-effect'?a.effect_class:'none'};
    const cp=acquired.checkpoint;
    let installed;
    try{
      const p=path.join(r.owned_scope,'administration.json');file(p,r);const bytes=fs.readFileSync(p),admin=JSON.parse(bytes);references.push({path:p,identity:hash(bytes)});
      installed=admin.format===1&&admin.installation_uid===r.installation_uid&&admin.source_identity===source&&admin.registration_identity===spec.identity&&
        ['approved','not_required'].includes(admin.consent)&&admin.enabled===true&&['acknowledged','not_required'].includes(admin.restart)&&state.request_history.includes(admin.authority_reference);
    }catch{installed=undefined;}
    const machine={current_source_verified:r.controller_source_identity===source,runtime_identity_verified:key(acquired.binding.workspace,r)===key(r.project_root,r),
      checkpoint_current_verified:['installed','adopted'].includes(cp.status)&&cp.verified_commit===cp.target_commit&&cp.source_identity===source,
      context_delivered_verified:modulesCurrent&&set.complete&&[state.instructions_declared,state.instructions_delivered].includes(set.identity),
      session_scope_verified:state.request_reference===a.request_reference,
      expected_revision_verified:observed.every(e=>e.expected_identity===e.identity),installed_enforcement:installed,
      control_failure_absent:acquired.status==='known'&&acquired.maintenance.mode==='normal',
      actual_effects_observed:command==='post-effect'?state.last_outcome?.action_identity===actionId&&state.last_outcome?.request_id===request.request_id:
        state.last_outcome?.request_id===state.last_admission?.request_id&&state.last_outcome?.action_identity===state.last_admission?.action_identity&&!!state.last_outcome};
    const assessmentRef='assessment:'+a.identity,observationRef='controller:'+identity({dependencies:deps,observed,references,modules:moduleFacts,source,request:state.request_reference});
    const evidence={};
    const make=(value,origin,reference)=>({value,origin,reference,binding,dependencies:deps,observed_at:c.observed_at,expires_at:new Date(Date.now()+1000).toISOString()});
    const knownRefs=new Set([...state.request_history,...selected.map(c=>c.id),...observed.map(e=>'resource:'+e.path),...references.map(e=>'resource:'+e.path)]);
    for(const id of [...new Set([...engine.config.commands[command].required,...selected.map(x=>'semantic:'+x.id)])]){
      if(factual.includes(id)){if(typeof machine[id]==='boolean')evidence[id]=make(machine[id],'controller_observation',observationRef);}
      else {const claim=a.judgments[id];if(claim&&claim.source_refs.includes(state.request_reference)&&claim.source_refs.every(ref=>knownRefs.has(ref))&&(!id.startsWith('semantic:')||claim.source_refs.includes(id.slice(9))))evidence[id]=make(claim.value,'runtime_semantic_judgment',assessmentRef);}
    }
    const next={...request,format:1,scope,context:c,evidence};
    if(command==='pre-effect')next.effect_class=a.effect_class;else delete next.effect_class;
    if(observed.length===1)next.coordination={...request.coordination,resource:{path:observed[0].path,access:observed[0].access}};
    next.maintenance_observation={origin:'authoritative_observation',current:true,reference:acquired.observations.maintenance.reference,mode:'normal',project:c.project,runtime_uid:c.installation_uid,machine_id:c.machine_id,checkpoint_ref:c.checkpoint_ref,checkpoint_revision:c.checkpoint_revision,mapping_revision:c.mapping_revision,request_id:request.request_id,dependencies:deps,observed_at:c.observed_at,expected_revision:c.revision,authority:c.authority,action_scope:c.action_scope,expires_at:new Date(Date.now()+1000).toISOString()};
    const frame={session,request_id:request.request_id,action_identity:actionId,source_identity:source,assessment_ref:assessmentRef,observation_ref:observationRef,purpose:a.purpose,
      session_revision:state.revision,generation:pending.generation,assessment_identity:a.identity,factual:factual.slice(),non_material_context:state.basis?.governed_mutation===false&&!effects.length&&state.last_admission?.request_reference!==state.request_reference,execution_conditions:observed.filter(e=>e.access==='write').map(e=>({path:e.path,expected_identity:e.identity}))};
    const progress=progressIdentity(state,observed,source);
    const continuation=!state.guidance?.blocker&&a.continuation&&a.judgments.remaining_action_authorized?.value===true&&a.judgments.safe_continuation?.value===true&&
      [a.judgments.remaining_action_authorized,a.judgments.safe_continuation].every(x=>x.source_refs.includes(state.request_reference))&&a.judgments.authority_verified?.value===true&&Object.entries(machine).filter(([id])=>id!=='actual_effects_observed').every(([,v])=>v===true);
    return {ok:true,request:next,frame,options,challenge,state,progress,continuation:continuation?a.continuation:null,observed,references:[...references,...moduleFacts],expires_at:Date.now()+1000};
  }
  function verify(result,{record,acquired,spec}){
    try{
      if(Date.now()>=result.expires_at||coordination.actionState(result.frame.session,result.options)?.revision!==result.frame.session_revision||!coordination.registration(spec,engine.config.source_binding.source_identity).ok)return false;
      for(const o of Object.values(acquired.observations)){
        if(o.identity?.startsWith('sha256:')&&hash(fs.readFileSync(o.reference))!==o.identity)return false;
        if(o.identity==='absent-in-verified-owned-scope'&&fs.existsSync(o.reference))return false;
      }
      return result.observed.every(e=>file(e.path,record)===e.identity)&&result.references.every(e=>hash(fs.readFileSync(e.path))===e.identity);
    }catch{return false;}
  }
  return {prepare,interpretive,identity,verify,refresh};
}
module.exports={runtimeAction};
