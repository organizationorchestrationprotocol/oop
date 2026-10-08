'use strict';
// Controller-owned reconciliation. No external semantic observer or effect executor.
function runtimeAction(engine,coordination){
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),crypto=process.getBuiltinModule('node:crypto');
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const canonical=x=>Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const hash=x=>'sha256:'+crypto.createHash('sha256').update(x).digest('hex'),identity=x=>hash(JSON.stringify(canonical(x)));
  const same=(a,b)=>identity(a)===identity(b);
  // Native administrative consent binds the installed definition and scope, not
  // adapter bytes or observation timestamps. Component revisions remain separate.
  function nativeIdentity(r){
    const a=r.runtime_adapter??{};
    return identity({...Object.fromEntries(['installation_uid','machine_id','runtime_class','project_root','private_root','owned_scope','common_scope','controller_locator','interpreter_locator','runtime_invocation','filesystem_local','filesystem_case_sensitive','protected_configuration_paths','governed_stores','instruction_sources','policy_deny'].map(k=>[k,r[k]??null])),...(r.declare_binding===undefined?{}:{declare_binding:r.declare_binding}),runtime_adapter:Object.fromEntries(['path','host','runtime_version','required_events','observation_admission'].map(k=>[k,a[k]??null]))});
  }
  const progressIdentity=(state,observed,source,command,action)=>identity({
    source,command,action,work_item:state.work_item?.id??null,
    request_context:state.request_content_identity,admitted_action:state.last_admission?.action_identity??null,
    outcome:state.last_outcome?.outcome_identity??null,
    resources:observed.map(e=>JSON.stringify([e.path,e.access,e.identity])).sort()
  });
  const factual=['current_source_verified','context_delivered_verified','runtime_identity_verified','checkpoint_current_verified','session_scope_verified','expected_revision_verified','installed_enforcement','control_failure_absent','actual_effects_observed'];
  function interpretive(id){return typeof id==='string'&&(id.startsWith('semantic:')||!factual.includes(id));}
  function key(p,r){const n=path.resolve(p);return r.filesystem_case_sensitive?n:n.toLowerCase();}
  const within=(p,root,r)=>{const rel=path.relative(key(root,r),key(p,r));return !rel||!rel.startsWith('..')&&!path.isAbsolute(rel);};
  function accessProblem(target,access,r,spec,state,{bookkeepingPaths=[]}={}){
    if(!path.isAbsolute(target)||!within(target,r.project_root,r))return 'effect_outside_workspace';
    const secretRoots=['authentication','credentials','ssh','secrets'].map(n=>path.join(r.common_scope,n));
    if(secretRoots.some(p=>within(target,p,r))||/(^|[\\/])(?:\.ssh|\.env(?:\.[^\\/]*)?)(?:[\\/]|$)/i.test(target))return 'secret_resource_restricted';
    const declared=state?.resources?.some(p=>within(target,path.resolve(r.project_root,p),r));
    const administrative=bookkeepingPaths.some(p=>key(p,r)===key(target,r));
    const control=[r.controller_locator,r.runtime_adapter.path,spec.path,...(r.protected_configuration_paths??[])].filter(p=>typeof p==='string').some(p=>key(p,r)===key(target,r));
    const internal=within(target,path.join(r.owned_scope,'sessions'),r)||key(target,r)===key(path.join(r.owned_scope,'procedures.json'),r);
    if(internal||access==='write'&&(control&&!administrative||within(target,path.join(r.project_root,'.git'),r)))return 'protected_control_effect';
    if(within(target,r.private_root,r)&&!within(target,r.owned_scope,r)){
      const shared=access==='read'&&declared&&(within(target,r.common_scope,r)||(r.governed_stores??[]).some(s=>within(target,s.locator,r)));
      if(!shared)return 'effect_outside_owned_scope';
    }
    if(access==='write'&&state&&!declared&&!administrative)return 'effect_outside_declared_scope';
    return null;
  }
  function file(p,r){
    if(!path.isAbsolute(p)||!within(p,r.project_root,r))throw Error('effect_outside_workspace');
    let nearest=p;while(!fs.existsSync(nearest))nearest=path.dirname(nearest);
    if(key(fs.realpathSync.native(nearest),r)!==key(nearest,r))throw Error('effect_path_alias');
    if(!fs.existsSync(p))return 'absent';
    const st=fs.lstatSync(p);if(!st.isFile()||st.nlink!==1||st.size>1048576)throw Error('effect_revision_unobservable');
    return hash(fs.readFileSync(p));
  }
  function dependencies(acquired,spec,source){return {...Object.fromEntries(Object.entries(acquired.observations??{}).map(([id,o])=>['local_'+id,o.identity])),registration:spec.identity,source};}
  function logicalAction(command,action,normalization={},record){
    if(!object(action.arguments))return {operation:action.operation,arguments:action.arguments};
    const profile=normalization[action.operation];let args={...action.arguments};
    if(profile){
      for(const [name,value] of Object.entries(profile.defaults??{}))if(!Object.hasOwn(args,name))args[name]=value;
      for(const name of profile.paths??[])if(typeof args[name]==='string'&&record)args[name]=key(path.resolve(record.project_root,args[name]),record);
    }
    return {operation:action.operation,arguments:args};
  }
  // Field names only: no argument values or per-value digests enter diagnostics.
  function actionShape(action){return object(action.arguments)?Object.keys(action.arguments).filter(k=>/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k)).sort().slice(0,64):[];}
  function resourceObservations(resource,r,spec,state,bookkeepingPaths=[]){
    if(!object(resource)||!['read','write'].includes(resource.access)||typeof resource.path!=='string')return [];
    const target=path.resolve(r.project_root,resource.path),base={path:target,access:resource.access};
    if(!within(target,r.project_root,r))return [{...base,identity:'not_eligible'}];
    const problem=accessProblem(target,resource.access,r,spec,state,{bookkeepingPaths});
    if(problem)return [{...base,identity:problem==='secret_resource_restricted'?'withheld_secret_store':'not_eligible',reason:problem}];
    try{return [{...base,identity:file(target,r),origin:'controller_observation',scope:{workspace:r.project_root,installation_uid:r.installation_uid},observed_at:new Date().toISOString(),valid_until:'dependency_change',assurance:'controller_observation_for_revision_comparison_only; not permission'}];}
    catch(error){
      const reason=['effect_revision_unobservable','effect_path_alias','effect_outside_workspace'].includes(error.message)
        ? error.message : 'effect_revision_unobservable';
      return [{...base,identity:'not_eligible',reason}];
    }
  }
  function refresh({record:r,acquired,session,command,spec}){
    const options={reg:{record:r}},st=coordination.actionState(session,options),prior=st?.pending_actions?.[command];
    if(!prior||st.state!=='working'||st.guidance_pending||st.context_integrity==='stale'||acquired.status!=='known')return;
    const {generation,...receipt}=prior;
    return coordination.recordAction(session,{...receipt,source_identity:engine.config.source_binding.source_identity,dependencies:dependencies(acquired,spec,engine.config.source_binding.source_identity),request_reference:st.request_reference},options);
  }
  function prepare({record:r,acquired,decoded,request,command,spec,recorded=false,normalization={},nativeInputIdentity}){
    const options={reg:{record:r}},session=decoded.session,source=engine.config.source_binding.source_identity;
    const fail=(reason,extra={})=>({ok:false,reason,extra,request,decision:['secret_resource_restricted','protected_control_effect','effect_outside_workspace','effect_outside_declared_scope','effect_outside_owned_scope','administrative_scope_unverified','action_governance_incomplete','source_outside_allowed_scope','effect_path_alias','effect_revision_changed','native_resource_mismatch'].includes(reason)?'deny':'unknown'});
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
    if(!recorded&&(!object(action)||Object.keys(action).some(k=>!['operation','arguments','presentation'].includes(k))||typeof action.operation!=='string'||!/^[-A-Za-z0-9_.:]{1,128}$/.test(action.operation)||!Object.hasOwn(action,'arguments')||
      Object.hasOwn(action,'presentation')&&(!object(action.presentation)||!['completion','delegate','recovery'].includes(command)||normalization[action.operation]?.presentation!==true)))return fail('native_action_unavailable');
    const logical=recorded?null:logicalAction(command,action,normalization,r);
    const actionId=recorded?saved.action_identity:identity(logical),deps=dependencies(acquired,spec,source);
    if(!recorded&&(!/^sha256:[a-f0-9]{64}$/.test(nativeInputIdentity??'')||!coordination.recordNativeInput(session,{command,input_identity:nativeInputIdentity,request_id:request.request_id},options)))return fail('native_action_unavailable');
    request={...request,request_id:recorded?initial.last_outcome.request_id:request.request_id,context:{...request.context,project:r.project_root,runtime:r.runtime_class,installation_uid:r.installation_uid,machine_id:r.machine_id,checkpoint_ref:acquired.mapping.checkpoint_ref,checkpoint_revision:String(acquired.checkpoint.revision),mapping_revision:acquired.binding.revision,dependencies:deps}};
    const receipt={action_identity:actionId,command,operation:recorded?saved.operation:action.operation,argument_keys:recorded?saved.argument_keys:actionShape(logical),source_identity:source,dependencies:deps,request_reference:initial.request_reference??null};
    const pending=coordination.recordAction(session,receipt,options);if(!pending)return fail('action_receipt_unavailable');
    const preparationBinding=!recorded?coordination.bindPreparation?.(session,pending,options):null;
    let state=coordination.actionState(session,options);
    if(command==='post-effect'&&Object.hasOwn(decoded,'outcome')){
      coordination.recordOutcome(session,{action_identity:actionId,request_id:request.request_id,outcome_identity:identity(decoded.outcome)},options);
      state=coordination.actionState(session,options);
    }
    const a=state.assessments?.[command];
    const assessment=a=>({reference:a.identity,receipt:{action_identity:a.action_identity,generation:a.generation},revision:a.assessment_revision});
    const classificationPending=state.state!=='working'||state.guidance_pending||state.context_integrity==='stale'||state.guidance?.requires_reclassification||state.guidance?.relation==='cancellation';
    const provisional=engine.select({classification:'known',request:['interaction',...(state.facets??[])]}).modules;
    const challenge={...pending,session,state_revision:state.revision,request_reference:state.request_reference,required_context:provisional.map(id=>({id,path:engine.config.routing.modules.find(m=>m.id===id).context})),required_judgments:[...engine.config.commands[command].required.filter(interpretive),...engine.config.contracts.filter(c=>provisional.includes(c.module)).map(c=>'semantic:'+c.id)],load:{scope:'action',command},declare:{phase:'assessment',expected_revision:state.revision},assurance:'Receipt identifies the actual invocation; it is not effect permission.'};
    const bookkeepingPaths=[acquired.mapping.checkpoint_ref,path.join(r.owned_scope,'administration.json'),path.join(r.owned_scope,'action-reconciliation.json')];
    challenge.resource_observations=resourceObservations(decoded.resource,r,spec,state,bookkeepingPaths);
    challenge.declare_template={...challenge.declare,assessment:{command,action_identity:actionId,generation:pending.generation,
      purpose:'<work or bookkeeping>',facets:[],effect_class:'<routed effect class>',
      effects:challenge.resource_observations.filter(e=>e.identity==='absent'||/^sha256:[a-f0-9]{64}$/.test(e.identity)).map(({path,access,identity})=>({path,access,expected_identity:identity})),
      judgments:Object.fromEntries(challenge.required_judgments.map(id=>[id,{value:'<boolean>',reason:'<attributed reason>',source_refs:[state.request_reference,...(id.startsWith('semantic:')?[id.slice(9)]:[])].filter(Boolean)}]))}};
    if(classificationPending){
      challenge.classification_present=!!state.basis;
      if(command==='completion')challenge.classification_blocker=state.guidance?.relation==='cancellation'?'cancelled':
        state.context_integrity==='stale'?'context_stale':state.guidance_pending?'guidance_pending':'classification';
      challenge.classification_required={phase:'classification',expected_revision:state.revision,facets:[],level:'<governance level>',resources:[],
        basis:{governed_mutation:'<boolean>',subject_scope:'<subject scope>',work_item_reason:'<work item reason>'},
        interface_ref:'interfaces.json#/enforcement/coordination_schemas/request'};
    }
    if(command==='completion'&&!classificationPending&&state.request_reference)challenge.classification_present=true;
    challenge.bookkeeping_observations=bookkeepingPaths.flatMap(p=>resourceObservations({path:p,access:'read'},r,spec,state,bookkeepingPaths));
    challenge.native_configuration_identity=nativeIdentity(r);
    if(preparationBinding)challenge.preparation_binding=preparationBinding;
    if(!state.request_reference)return fail('native_request_unavailable',{action:challenge});
    if(classificationPending)return fail('action_classification_pending',{action:challenge});
    if(!a||a.action_identity!==actionId||a.generation!==pending.generation||a.source_identity!==source||a.request_reference!==state.request_reference||!same(a.dependencies,deps)||a.declaration_identity!==state.declaration_identity||a.preparation_identity&&state.consumed_preparations?.includes(a.preparation_identity)||command==='pre-effect'&&state.last_admission?.assessment_identity===a.identity){
      const operationalObligation=state.basis?.governed_mutation===true||state.work_item||state.last_admission?.request_reference===state.request_reference;
      const repair=['completion','delegate'].includes(command)&&operationalObligation&&!state.guidance?.blocker?{progress:progressIdentity(state,[],source,command,actionId),session_revision:state.revision,next_action:'Load the pending action and submit its revision-checked semantic assessment through the official control-plane commands; do not execute an unadmitted material effect.'}:null;
      if(command==='completion'){
        const sameRequest=a&&a.request_reference===state.request_reference;
        const bindings=sameRequest?[
          ['action_identity',a.action_identity!==actionId],['generation',a.generation!==pending.generation],
          ['source',a.source_identity!==source],['dependencies',!same(a.dependencies,deps)],
          ['declaration',a.declaration_identity!==state.declaration_identity],
          ['preparation',a.preparation_identity&&state.consumed_preparations?.includes(a.preparation_identity)]
        ].filter(([,changed])=>changed).map(([name])=>name):[];
        challenge.assessment_status=!sameRequest?'absent':'inapplicable';
        if(sameRequest)challenge.prior_assessment={...assessment(a),changed_bindings:bindings};
      }
      return fail('needs_action_assessment',{action:challenge,...(repair?{repair}: {})});
    }
    if(command==='completion'){
      challenge.assessment_status='applicable';
      challenge.assessment=assessment(a);
    }
    if(coordination.procedureAssessmentCurrent&&!coordination.procedureAssessmentCurrent(session,a,options))return fail('procedure_review_required',{action:challenge});
    const bookkeeping=a.purpose==='bookkeeping';let effects=a.effects;
    const admitted=state.last_admission,derive=bookkeeping&&command==='post-effect'&&!effects.length;
    if(bookkeeping&&command==='post-effect'){
      if(admitted?.purpose!=='bookkeeping'||admitted.source_identity!==source||admitted.request_reference!==state.request_reference||admitted.action_identity!==actionId||admitted.request_id!==state.last_outcome?.request_id||!admitted.execution_conditions?.length)return fail('administrative_scope_unverified',{action:challenge});
      const targets=admitted.execution_conditions;
      if(derive)effects=targets.map(e=>({path:e.path,access:'write'}));
      else if(effects.length!==targets.length||new Set(effects.map(e=>key(path.resolve(r.project_root,e.path),r))).size!==targets.length||effects.some(e=>!targets.some(t=>key(t.path,r)===key(path.resolve(r.project_root,e.path),r))))return fail('administrative_scope_unverified',{action:challenge});
    }
    if(bookkeeping&&(!['pre-effect','post-effect'].includes(command)||!effects.length))return fail('administrative_scope_unverified',{action:challenge});
    if(!bookkeeping&&!Array.isArray(r.protected_configuration_paths))return fail('native_configuration_scope_unavailable',{action:challenge});
    if(command==='pre-effect'&&!effects.length)return fail('effect_set_unresolved',{action:challenge});
    const observed=[],references=[];
    try{for(const e of effects){
      const target=path.resolve(r.project_root,e.path),problem=accessProblem(target,e.access,r,spec,state,{bookkeepingPaths:bookkeeping||e.access==='read'?bookkeepingPaths:[]});
      if(problem)return fail(problem,{action:challenge});
      if(bookkeeping&&(!bookkeepingPaths.some(p=>key(p,r)===key(target,r))||e.access!=='write')||!bookkeeping&&e.access==='write'&&bookkeepingPaths.some(p=>key(p,r)===key(target,r)))return fail('administrative_scope_unverified',{action:challenge});
      const actual=file(target,r);
      observed.push({path:target,access:e.access,identity:actual,expected_identity:derive?actual:e.expected_identity});
    }}catch(e){return fail(e.message,{action:challenge});}
    if(['read','write'].includes(decoded.resource?.access)&&!observed.some(e=>key(e.path,r)===key(path.resolve(r.project_root,decoded.resource.path),r)&&e.access===decoded.resource.access))return fail('native_resource_mismatch',{action:challenge});
    if(command==='post-effect'&&observed.some(e=>e.identity!==e.expected_identity))return fail('effect_revision_changed',{action:challenge});
    if(command==='pre-effect'&&effects.some(e=>e.access==='write')&&(state.level==='G0'||['G2','G3','G4'].includes(state.level)&&!state.work_item))return fail('action_governance_incomplete',{action:challenge});
    try{for(const s of a.sources??[]){const target=path.resolve(r.project_root,s.path);
      const problem=accessProblem(target,'read',r,spec,state,{bookkeepingPaths});if(problem)return fail(problem,{action:challenge});
      const current=file(target,r);if(current!==s.expected_identity)return fail('action_source_changed',{action:challenge});references.push({path:target,identity:current});
    }}catch(e){return fail(e.message,{action:challenge});}
    const facets=[...new Set([...state.facets,...a.facets])],scope={classification:'known',request:['interaction',...facets],action:[a.effect_class]};
    const selection=engine.select(scope),selected=engine.config.contracts.filter(c=>selection.modules.includes(c.module));
    const set=coordination.composeInstructions(null,{...options,sourceIdentity:source});
    const moduleFacts=[];const outstandingModules=selection.modules.filter(id=>{
      const loaded=state.loaded_modules?.[id],definition=engine.config.routing.modules.find(m=>m.id===id);
      try{const p=path.join(path.dirname(r.controller_locator),definition.context),current=hash(fs.readFileSync(p));moduleFacts.push({path:p,identity:current});return loaded?.source_identity!==source||loaded.content_identity!==current;}catch{return true;}
    });
    const modulesCurrent=outstandingModules.length===0;
    if(command==='completion'&&!modulesCurrent){
      const paging=state.module_paging;
      const identities=Object.fromEntries(selection.modules.flatMap(id=>{
        const definition=engine.config.routing.modules.find(m=>m.id===id);
        const fact=moduleFacts.find(f=>f.path===path.join(path.dirname(r.controller_locator),definition.context));
        return fact?[[id,{source_identity:source,content_identity:fact.identity}]]:[];
      }));
      const pageModules=paging?.tier===3&&Array.isArray(paging.modules)?paging.modules:null;
      const cursorCurrent=pageModules?.some(id=>outstandingModules.includes(id))&&pageModules.every(id=>Object.hasOwn(identities,id))&&
        paging.binding===hash(JSON.stringify({tier:3,modules:pageModules,identities:Object.fromEntries(pageModules.map(id=>[id,identities[id]]))}));
      challenge.module_closure={tier:3,modules:cursorCurrent?pageModules:outstandingModules.slice(0,16),outstanding_modules:outstandingModules,
        ...(cursorCurrent?{next_cursor:paging.next}:{})};
    }
    const c={...request.context,session,request_scope:state.request_reference,action_scope:actionId,revision:identity(observed),authority:state.request_reference,
      resource:observed.length===1?observed[0].path:'action:'+actionId,risk:state.level,lifecycle:state.state,context_retention:identity(state.loaded_modules??{}),
      oop_commit:bookkeeping?acquired.checkpoint.target_commit:acquired.checkpoint.verified_commit,observed_at:new Date().toISOString(),dependencies:deps};
    const binding={...Object.fromEntries(['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'].map(k=>[k,c[k]])),command,selection:selection.modules.join(','),effect_class:command==='pre-effect'?a.effect_class:'none'};
    const cp=acquired.checkpoint;
    let installed;
    try{
      const p=path.join(r.owned_scope,'administration.json');file(p,r);const bytes=fs.readFileSync(p),admin=JSON.parse(bytes);references.push({path:p,identity:hash(bytes)});
      installed=admin.format===1&&admin.installation_uid===r.installation_uid&&admin.source_identity===source&&admin.native_configuration_identity===nativeIdentity(r)&&
        ['approved','not_required'].includes(admin.consent)&&admin.enabled===true&&['acknowledged','not_required'].includes(admin.restart)&&
        // Installation-scoped consent: the authorizing input is observed in the named session of this installation.
        coordination.observedRequest(admin.authority_session,admin.authority_reference,{reg:{record:r}});
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
    const normalizeRef=ref=>ref.startsWith('resource:')&&path.isAbsolute(ref.slice(9))?'resource:'+key(ref.slice(9),r):ref;
    const knownRefs=new Set([...state.request_history,...selected.map(c=>c.id),...observed.map(e=>'resource:'+e.path),...references.map(e=>'resource:'+e.path)].map(normalizeRef));
    const rejected=[];
    for(const id of [...new Set([...engine.config.commands[command].required,...selected.map(x=>'semantic:'+x.id)])]){
      if(factual.includes(id)){if(typeof machine[id]==='boolean')evidence[id]=make(machine[id],'controller_observation',observationRef);}
      else {const claim=a.judgments[id];if(claim){
        const invalid=claim.source_refs.flatMap((ref,index)=>knownRefs.has(normalizeRef(ref))?[]:[index]);
        const reasons=[...(!claim.source_refs.includes(state.request_reference)?['current_request_missing']:[]),...(invalid.length?['unknown_source_refs']:[]),...(id.startsWith('semantic:')&&!claim.source_refs.includes(id.slice(9))?['contract_ref_missing']:[])];
        if(!reasons.length)evidence[id]=make(claim.value,'runtime_semantic_judgment',assessmentRef);
        else if(rejected.length<128)rejected.push({judgment:id,reasons,rejected_ref_indices:invalid});
      }}
    }
    if(rejected.length)challenge.judgment_diagnostics=rejected;
    const next={...request,format:1,scope,context:c,evidence};
    if(request.publication_context&&request.evidence?.publication_context_verified)
      evidence.publication_context_verified=request.evidence.publication_context_verified;
    if(command==='pre-effect')next.effect_class=a.effect_class;else delete next.effect_class;
    if(observed.length===1)next.coordination={...request.coordination,resource:{path:observed[0].path,access:observed[0].access}};
    next.maintenance_observation={origin:'authoritative_observation',current:true,reference:acquired.observations.maintenance.reference,mode:'normal',project:c.project,runtime_uid:c.installation_uid,machine_id:c.machine_id,checkpoint_ref:c.checkpoint_ref,checkpoint_revision:c.checkpoint_revision,mapping_revision:c.mapping_revision,request_id:request.request_id,dependencies:deps,observed_at:c.observed_at,expected_revision:c.revision,authority:c.authority,action_scope:c.action_scope,expires_at:new Date(Date.now()+1000).toISOString()};
    const frame={session,request_id:request.request_id,action_identity:actionId,source_identity:source,assessment_ref:assessmentRef,observation_ref:observationRef,purpose:a.purpose,
      session_revision:state.revision,generation:pending.generation,assessment_identity:a.identity,...(a.preparation_identity?{preparation_identity:a.preparation_identity}:{}),factual:factual.slice(),non_material_context:state.basis?.governed_mutation===false&&!effects.length&&state.last_admission?.request_reference!==state.request_reference,execution_conditions:observed.filter(e=>e.access==='write').map(e=>({path:e.path,expected_identity:e.identity}))};
    const progress=progressIdentity(state,observed,source,command,actionId);
    const continuation=!state.guidance?.blocker&&a.continuation&&a.judgments.remaining_action_authorized?.value===true&&a.judgments.safe_continuation?.value===true&&
      [a.judgments.remaining_action_authorized,a.judgments.safe_continuation].every(x=>x.source_refs.includes(state.request_reference))&&a.judgments.authority_verified?.value===true&&Object.entries(machine).filter(([id])=>id!=='actual_effects_observed').every(([,v])=>v===true);
    return {ok:true,request:next,frame,options,challenge,state,progress,continuation:continuation?a.continuation:null,observed,references:[...references,...moduleFacts],expires_at:Date.now()+1000};
  }
  function verify(result,{record,acquired,spec}){
    try{
      if(Date.now()>=result.expires_at||coordination.actionState(result.frame.session,result.options)?.revision!==(result.verification_revision??result.frame.session_revision)||!coordination.registration(spec,engine.config.source_binding.source_identity).ok)return false;
      for(const o of Object.values(acquired.observations)){
        if(o.identity?.startsWith('sha256:')&&hash(fs.readFileSync(o.reference))!==o.identity)return false;
        if(o.identity==='absent-in-verified-owned-scope'&&fs.existsSync(o.reference))return false;
      }
      return result.observed.every(e=>file(e.path,record)===e.identity)&&result.references.every(e=>hash(fs.readFileSync(e.path))===e.identity);
    }catch{return false;}
  }
  return {prepare,interpretive,identity,nativeIdentity,accessProblem,verify,refresh,logicalAction,actionShape,dependencies};
}
module.exports={runtimeAction};
