// Producer-maintained implementation. Canonical rules remain in PROTOCOL.md.
// This factory is serialized into the standalone CommonJS distribution.
import {runtimeFramework} from './runtime-framework.cjs';
import {runtimeFeedback} from './runtime-feedback.cjs';
export function createEnforcementEngine(config, route, installation, coordination) {
  const commands = Object.keys(config.commands);
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string' && x.length > 0 && x.length <= 512;
  const same = (a,b) => object(a) && object(b) && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  const exitCodes = {allow:0,deny:2,unknown:3,error:4};
  const feedback=runtimeFeedback();
  function validateConfiguration(request) {
    try{return feedback.complete(validateConfigurationRaw(request));}
    catch{return feedback.complete({...validateConfigurationRaw(null),reason:'configuration_validation_error'});}
  }
  function evaluate(command,request,options) {
    try{return feedback.complete(evaluateRaw(command,request,options));}
    catch{return feedback.complete({format:1,type:'oop_admission',request_id:null,command:commands.includes(command)?command:null,source_binding:config.source_binding,decision:'error',reason_code:'integration_contract_failure',effect_permission:'not_granted',assurance:'No permission or successful evaluation is established.',payload:{}});}
  }
  function coordinate(command,request,options) {
    try{return feedback.complete(coordinateRaw(command,request,options));}
    catch{return feedback.complete({format:1,type:'oop_runtime_coordination',request_id:null,command:null,source_binding:config.source_binding,accepted:false,reason:'integration_contract_failure',effect_permission:'not_granted',state:null,runtime_message:'',result:{},error:true});}
  }
  function validateConfigurationRaw(request) {
    const response={format:1,type:'oop_configuration_validation',request_id:text(request?.request_id)?request.request_id:null,
      source_binding:config.source_binding,valid:false,reason:'invalid_envelope',dispatch_verified:false,validation_binding:null,error:true,runtime_message:'',diagnostics:[]};
    try {
      if(!object(request)||request.format!==1||!text(request.request_id)||
        Object.keys(request).some(k=>!['format','request_id','plan','facts'].includes(k))||!object(request.plan)||!object(request.facts))return response;
      const result=installation.validateConfiguration(request.plan,request.facts);
      if(result.valid&&config.adapter_template){
        if(!object(request.facts.adapter_contract)||Object.hasOwn(request.facts.adapter_contract,'events')||!Array.isArray(request.facts.adapter_contract.supported_commands)||!request.facts.adapter_contract.supported_commands.length)return {...response,error:false,reason:'independent_adapter_contract_missing'};
        const framework=runtimeFramework({config},null,config.adapter_template);
        if(request.plan.adapter_preparation.workflow.inputs.template.identity!==framework.template_identity)return {...response,error:false,reason:'adapter_preparation_template_stale'};
        const checked=framework.validateAdapter(request.plan.adapter_preparation?.source);
        if(!checked.valid)return {...response,reason:checked.reason,error:false};
        const declaration=runtimeFramework({config},null,config.adapter_template).validateManifest(request.plan.adapter_preparation.source,request.facts.adapter_contract);
        if(!declaration.valid)return {...response,reason:declaration.reason,diagnostics:declaration.diagnostics,error:false};
      }
      return {...response,...result,error:false};
    }catch{return {...response,reason:'configuration_validation_error'};}
  }
  // R26: every admission response carries a bounded English runtime-facing message.
  // Guidance may only add a denial; it never grants permission.
  // R20.10: a registration record passed by the adapter is verified before any of its facts are used.
  function registered(options) {
    const context={sourceIdentity:config.source_binding.source_identity,contractIds:config.contracts.map(c=>c.id),routingFacets:Object.keys(config.routing.facets),predicateIds:[...new Set([...Object.values(config.commands).flatMap(c=>c.required),...config.contracts.map(c=>'semantic:'+c.id),'remaining_action_authorized','safe_continuation'])]};
    if(!options?.registration)return {ok:true,options:context};
    if(!coordination)return {ok:false,reason:'coordination_unavailable'};
    const reg=coordination.registration(options.registration,config.source_binding.source_identity);
    if(reg.ok&&object(reg.record.runtime_adapter)&&options.hostAdapted!==true)return {ok:false,reason:'framework_entry_required'};
    return reg.ok?{ok:true,options:{...context,reg,...(options.hostAdapted===true&&object(options.planning)?{planning:options.planning}:{})}}:reg;
  }
  function evaluateRaw(command, request, options) {
    // UX-09: no registration, publication or coordination condition may veto a user stop.
    if(command==='completion'&&object(request)&&['user','unknown'].includes(request.stop_origin)){
      const stopped=admit(command,request);return {...stopped,payload:{...stopped.payload,runtime_message:''}};
    }
    const registration=registered(options);
    if(!registration.ok){const failed=admit('',request);return {...failed,command:commands.includes(command)?command:null,reason_code:registration.reason,payload:{runtime_message:''}};}
    // Only the verified framework can supply a translated non-governed operation.
    // This channel is not accepted from the request envelope or ordinary CLI.
    const observation=options?.hostAdapted===true&&registration.options?.reg?.record.format===1&&
      registration.options.reg.record.runtime_adapter?.observation_admission===1?options.nativeObservation:undefined;
    const workflow=options?.hostAdapted===true&&registration.options?.reg&&options.workflow?.session===request?.context?.session&&
      options.workflow?.request_id===request?.request_id&&options.workflow?.action_identity===request?.context?.action_scope&&options.workflow?.source_identity===config.source_binding.source_identity?options.workflow:null;
    const response=admit(command, request, observation,workflow);
    response.payload={...response.payload,runtime_message:''};
    if(response.decision==='error')return response;
    let publicationAssessment,publicationRevision;
    if(request?.publication_context!==undefined){
      response.payload.publication=installation.assessPublication(request.publication_context);
      const pending=response.payload.publication;
      const dependent=request.publication_context.depends_on_publication===true;
      const verified=request.evidence?.publication_context_verified;
      const authentic=verified?.value===true&&verified.origin==='authoritative_observation'&&verified.binding?.project===request.context?.project&&
        verified.binding?.runtime===request.context?.runtime&&verified.binding?.session===request.context?.session&&
        verified.binding?.request_scope===request.context?.request_scope&&verified.binding?.action_scope===request.context?.action_scope&&
        verified.binding?.installation_uid===request.context?.installation_uid&&
        verified.binding?.command===command&&verified.reference===request.publication_context.reference&&
        verified.binding?.publication_identity===installation.configurationIdentity(request.publication_context)&&
        JSON.stringify(verified.dependencies)===JSON.stringify(request.context?.dependencies)&&
        Date.parse(verified.observed_at)<=Date.parse(request.context?.observed_at)&&Date.parse(request.context?.observed_at)<Date.parse(verified.expires_at);
      if(!authentic){response.payload.publication={disposition:'blocked',reason:'publication_observation_unverified',effect_permission:'not_granted'};}
      else publicationAssessment=pending;
      if(authentic&&coordination?.publication&&!(command==='pre-effect'&&request.publication_context.is_publication_effect===true)){
        const tracked=coordination.publication(request,command,publicationAssessment,{...registration.options,workflowRevision:workflow?.session_revision});
        if(tracked.stale)return {...response,decision:'unknown',reason_code:'action_dependency_changed',effect_permission:'not_granted'};
        publicationRevision=tracked.revision;
      }
      if((!authentic&&command==='pre-effect')||(!authentic||['publish_now','blocked'].includes(pending.disposition))&&
        (command==='completion'||command==='pre-effect'&&dependent&&request.publication_context.is_publication_effect!==true))
        return {...response,decision:'unknown',reason_code:'canonical_publication_pending',effect_permission:'not_granted'};
    }
    if(coordination?.publication&&['pre-effect','completion','delegate','recovery'].includes(command)){
      const retained=coordination.publication(request,command,undefined,registration.options);
      const publication=request.publication_context;
      const proposal=request.organizational_mutation?.proposal;
      const repairing=publication?.is_publication_effect===true&&publicationAssessment?.disposition==='publish_now'&&
        request.effect_class==='ticket_mutation'&&response.decision==='allow'&&
        installation.matchesPublication(publication,proposal);
      const active=retained.active_ticket;
      const mutationTicket=proposal?.ticket?.id??proposal?.ticket_id;
      if(registration.options.reg&&command==='pre-effect'&&response.decision==='allow'&&
        response.reason_code!=='confined_runtime_adapter_maintenance'&&!observation&&workflow?.non_material_context!==true){
        if(retained.work_item_missing&&!repairing&&workflow?.purpose!=='bookkeeping')
          return {...response,decision:'deny',reason_code:'effect_without_work_item',effect_permission:'not_granted'};
        if(active&&request.effect_class==='ticket_mutation'&&mutationTicket!==active)
          return {...response,decision:'deny',reason_code:'active_work_item_mismatch',effect_permission:'not_granted'};
        if(active&&!repairing&&workflow?.purpose!=='bookkeeping'&&
          (publication?.ticket_id!==active||!['canonical_ticket_observed','canonical_change_observed'].includes(publicationAssessment?.reason)))
          return {...response,decision:'unknown',reason_code:'canonical_ticket_observation_required',effect_permission:'not_granted'};
      }
      if(retained.pending.length&&!repairing&&(['completion','delegate','recovery'].includes(command)||request.publication_context?.depends_on_publication===true||
        request.effect_class==='ticket_mutation'||active&&!observation&&workflow?.purpose!=='bookkeeping'&&response.reason_code!=='confined_runtime_adapter_maintenance'))
        return {...response,decision:'unknown',reason_code:'canonical_publication_pending',effect_permission:'not_granted',payload:{...response.payload,publication:{disposition:'publish_now',pending:retained.pending,effect_permission:'not_granted'}}};
    }
    if(!coordination||response.decision==='error'||!commands.includes(command)||command==='probe')return response;
    try {
      const guidance=coordination.guide(config.index,command,request,response,{...registration.options,...(workflow?{workflowRevision:publicationRevision??workflow.session_revision}:{})});
      response.payload.runtime_message=guidance.message;
      if(guidance.revision_mismatch)return {...response,decision:'unknown',reason_code:'action_dependency_changed',effect_permission:'not_granted'};
      if(Number.isSafeInteger(guidance.workflow_revision))response.payload.controller_revision=guidance.workflow_revision;
      if(guidance.publication)response.payload.publication=guidance.publication;
      if(guidance.deny&&command==='pre-effect')return {...response,decision:'deny',reason_code:guidance.deny,effect_permission:'not_granted',
        payload:{failed:[guidance.deny],mismatches:guidance.codes,runtime_message:guidance.message}};
    } catch { response.payload.runtime_message='OOP notice: local coordination unavailable; no runtime state or lease protection is claimed.'; }
    return response;
  }
  function coordinateRaw(command, request, options) {
    const failure=reason=>({format:1,type:'oop_runtime_coordination',request_id:text(request?.request_id)?request.request_id:null,command:null,source_binding:config.source_binding,accepted:false,
      reason,effect_permission:'not_granted',state:null,runtime_message:'',result:{},error:true});
    if(!coordination)return failure('coordination_unavailable');
    const registration=registered(options);
    if(!registration.ok)return failure(registration.reason);
    return coordination.coordinate(config.index,config.routing,command,request,config.source_binding,registration.options);
  }
  function admit(command, request, nativeObservation,workflow) {
    const result = (decision,reason_code,payload={}) => ({format:1,type:'oop_admission',
      request_id:text(request?.request_id)?request.request_id:null,command:commands.includes(command)?command:null,
      source_binding:config.source_binding,decision,reason_code,effect_permission:'not_granted',
      assurance:'Conditional on independently authenticated adapter observations; no host interception or fact authentication by this engine.',payload});
    try {
      if(!commands.includes(command)) return result('error','unsupported_command');
      if(!object(request) || request.format!==1 || !text(request.request_id)) return result('error','invalid_envelope');
      // Do not reflect arbitrary payloads, paths, evidence contents or parse exceptions.
      const allowed=['format','request_id','scope','context','evidence','effect_class','transition','bootstrap_step','journal','organizational_mutation','runtime_adapter_maintenance','maintenance_observation','coordination','publication_context','stop_origin'];
      if(Object.keys(request).some(key=>!allowed.includes(key))) return result('error','invalid_envelope');
      if(request.stop_origin!==undefined&&(command!=='completion'||!['user','model','unknown'].includes(request.stop_origin))) return result('error','invalid_envelope');
      // UX-09: a user stop, or a turn end of unidentified origin, is never vetoed and never establishes completion.
      if(command==='completion'&&['user','unknown'].includes(request.stop_origin)) return result('allow',request.stop_origin==='user'?'user_stop':'stop_origin_unknown',{
        turn_state:'interrupted',completion_claim:'not_established',veto:'withheld',
        rule:'UX-09: the stop prevails; do not resume the turn or claim completion; report observed in-progress effects at the next user input.'});
      if(command==='probe') return result('unknown','installed_path_not_verified',{
        commands,interface:config.interface,read_only:true,node_major:Number(process.versions.node.split('.')[0]),
        process_peak_rss_kib:process.resourceUsage().maxRSS,
        installed_coverage:'not_verified',exit_codes:exitCodes});
      if(!object(request.scope)) return result('error','invalid_scope');
      if(Object.keys(request.scope).some(k=>!['classification','request','action','state','risk','authority','recovery'].includes(k))) return result('error','invalid_scope');
      const scope={...request.scope,request:[...(request.scope.request??[]),'interaction']};
      const selection=route(config.routing.modules,config.routing,scope);
      const selected = config.contracts.filter(c=>selection.modules.includes(c.module));
      const manifest={modules:selection.modules,contracts:selected.map(c=>({id:c.id,module:c.module,source:c.source})),
        module_paths:selection.modules.map(id=>config.routing.modules.find(m=>m.id===id).context),
        runtime_checkpoint:'Resolve the sole current persistent-runtime checkpoint and independently establish session/request/action evidence; no per-session adoption fallback.',
        governing_content:'Load complete selected semantic_clause values, including Core; this manifest is not a shortened normative context.',
        delivery:'not_verified',classification_resolved:selection.classification_resolved,
        unresolved_semantic_questions:selected.map(c=>({contract:c.id,question:'Verify complete clause applicability and semantic residual against authoritative scoped facts.'})),
        invalidation:['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention']};
      if(selection.modules.includes('migration-distribution')) manifest.migration_context=config.migration_context;
      if(command==='entry' || command==='interaction') return result('unknown','needs_semantic_judgment',manifest);
      const mode=installation?.maintenance(request,request.maintenance_observation);
      if(!mode||mode.decision==='unknown')return result('unknown','maintenance_state_unresolved');
      if(mode.decision==='deny')return result('deny',mode.reason);
      if(mode.decision==='allow'){
        if(!['pre-effect','recovery'].includes(command)||request.organizational_mutation!==undefined||request.transition!==undefined||request.bootstrap_step!==undefined)
          return result('deny','maintenance_command_or_mutation_forbidden');
        const response=result('allow',mode.reason,mode);response.effect_permission='conditional_on_adapter';return response;
      }
      if(!selection.classification_resolved) return result('unknown','needs_semantic_judgment',manifest);
      // Core proportionality: an observed read is not a governed mutation. Keep
      // maintenance, registration, routing and publication checks; do not require
      // or fabricate mutation authority/semantic proofs for this narrow path.
      const observational=object(nativeObservation)&&['pre-effect','post-effect'].includes(command)&&
        nativeObservation.session===request.context?.session&&nativeObservation.request_id===request.request_id&&
        ['read','coordination'].includes(nativeObservation.kind)&&
        ['request','action','state','risk','authority','recovery'].every(k=>(scope[k]??[]).every(f=>['interaction','information'].includes(f)))&&
        ['organizational_mutation','transition','bootstrap_step','journal','runtime_adapter_maintenance','publication_context','effect_class'].every(k=>request[k]===undefined)&&
        (nativeObservation.kind==='read'?request.coordination?.resource?.access==='read'&&
          nativeObservation.resource===request.coordination.resource.path:
          ['load','declare'].includes(request.context?.native_coordination?.command));
      if(observational)return result('allow','non_governed_observation',{
        kind:nativeObservation.kind,modules:selection.modules,
        scope:'Registered native translation only; no governed effect authority granted.'});
      const context=request.context;
      const identities=['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'];
      const mutationRequired=command==='pre-effect'&&['ticket_mutation','identity_registry_mutation'].some(f=>
        request.effect_class===f||['request','action'].some(k=>scope[k]?.includes(f)));
      if(mutationRequired||request.organizational_mutation!==undefined)identities.push('instruction_origin_uid');
      const missingContext=identities.filter(k=>!text(context?.[k]));
      if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(context?.oop_commit))missingContext.push('oop_commit');
      if(!text(context?.observed_at)||!Number.isFinite(Date.parse(context.observed_at)))missingContext.push('observed_at');
      if(!object(context?.dependencies)||!Object.keys(context.dependencies).length||!Object.values(context.dependencies).every(text))missingContext.push('dependencies');
      if(missingContext.length)return result('unknown','needs_evidence',{missing_context:[...new Set(missingContext)]});
      const expected={...Object.fromEntries(identities.map(k=>[k,context[k]])),
        // Bind proof to this exact command, route and proposed effect, not just a workspace.
        command,selection:selection.modules.join(','),effect_class:request.effect_class??'none'};
      const now=Date.parse(context.observed_at);
      const evidence=request.evidence;
      if(!object(evidence)) return result('unknown','needs_evidence',{missing:[...config.commands[command].required,...selected.map(c=>'semantic:'+c.id)]});
      if(mutationRequired||request.organizational_mutation!==undefined){
        const mutation=request.organizational_mutation;
        if(!installation||!object(mutation)||!object(mutation.observation))return result('unknown','mutation_contract_missing');
        const observed=mutation.observation;
        if((request.effect_class==='ticket_mutation'&&!['ticket_create','ticket_update','ticket_delete'].includes(mutation.proposal?.kind))||
          (request.effect_class==='identity_registry_mutation'&&mutation.proposal?.kind!=='registry'))return result('deny','mutation_kind_mismatch');
        if(observed.workspace!==context.project||observed.executing_installation_uid!==context.installation_uid||
          observed.instruction_origin_uid!==context.instruction_origin_uid||observed.current_revision!==context.revision)
          return result('unknown','mutation_identity_or_revision_mismatch');
        const checked=installation.validateMutation(mutation.proposal,observed);
        if(!checked.valid)return result('deny','mutation_contract_failed',{failed:[checked.reason]});
      }
      const facts=[...config.commands[command].required.filter(id=>!(workflow?.purpose==='bookkeeping'&&['installed_enforcement','checkpoint_current_verified'].includes(id))&&!(workflow?.non_material_context&&id==='actual_effects_observed')),...selected.map(c=>'semantic:'+c.id)];
      if(command==='pre-effect') {
        if(!text(request.effect_class) || !Object.hasOwn(config.routing.facets,request.effect_class) ||
          !['action','request'].some(k=>scope[k]?.includes(request.effect_class))) return result('unknown','effect_scope_unresolved');
      }
      if(request.bootstrap_step!==undefined){
        const step=config.bootstrap.steps.find(s=>s.id===request.bootstrap_step);
        if(!step) return result('error','invalid_bootstrap_step');
        facts.push(...step.guard.all.map(g=>g.fact));
        if(step.depends_on.length) facts.push('verified:'+step.depends_on[0]);
      }
      if(request.transition!==undefined){
        const edge=config.bootstrap.transitions.find(t=>t.from===request.transition?.from && t.to===request.transition?.to);
        if(!edge) return result('deny','invalid_transition');
        facts.push(...edge.requires);
      }
      if(command==='recovery') {
        const journal=request.journal;
        if(!object(journal) || journal.owner!==context.runtime || journal.project!==context.project ||
          !['staged','probed','activated_pending_checkpoint','checkpointed','cleanup_pending'].includes(journal.phase) ||
          !text(journal.active) || (journal.candidate!==null && !text(journal.candidate)) ||
          !text(journal.expected_revision)) return result('unknown','recovery_required');
        facts.push('active_configuration_reconciled','owned_checkpoint_reconciled','exclusive_update_verified','ongoing_invocations_safe');
      }
      // Any established false predicate wins over missing evidence. Untrusted or stale
      // records cannot establish either permission or a definitive authority denial.
      const missing=[];const failed=[];const interpretedFailures=[];
      for(const id of [...new Set(facts)]) {
        const item=evidence[id];
        const origin=item?.origin==='authoritative_observation'||workflow&&(workflow.factual.includes(id)?item?.origin==='controller_observation'&&item.reference===workflow.observation_ref:item?.origin==='runtime_semantic_judgment'&&item.reference===workflow.assessment_ref);
        const valid=object(item) && typeof item.value==='boolean' && origin &&
          text(item.reference) && same(item.binding,expected) && same(item.dependencies,context.dependencies) &&
          Number.isFinite(Date.parse(item.observed_at)) && Date.parse(item.observed_at)<=now &&
          Number.isFinite(Date.parse(item.expires_at)) && now<Date.parse(item.expires_at);
        if(!valid) missing.push(id);else if(item.value===false){failed.push(id);if(item.origin==='runtime_semantic_judgment')interpretedFailures.push(id);}
      }
      const checked=command==='completion'?{checked:[...new Set(facts)]}:{};
      if(failed.length) return result('deny',interpretedFailures.length===failed.length?'assessment_guard_failed':'guard_failed',{...checked,failed,...(interpretedFailures.length?{interpreted_failures:interpretedFailures}:{}),...(missing.length?{missing}:{})});
      if(missing.length) return result('unknown','needs_evidence',{...checked,missing});
      const response=result('allow','required_predicates_satisfied',{
        checked:[...new Set(facts)],modules:selection.modules,observation_time:context.observed_at,
        state_write:'none; adapter owns effects, journals, locking and checkpoints',
        semantic_assurance:workflow?'Residual judgments are attributed agent interpretations, not independently authenticated observations or grants. Actual host authority and conditional execution remain necessary.':'Residual judgments are supplied by the authorized upstream evidence source; not computed from prose.'});
      if(command==='pre-effect') response.effect_permission='conditional_on_adapter';
      return response;
    } catch { return result('error','invalid_input'); }
  }
  return {evaluate,coordinate,validateConfiguration,exitCodes,config,installation,feedback:feedback.complete,select:scope=>route(config.routing.modules,config.routing,scope)};
}

// The CLI never performs filesystem/provider writes. stdin is the only payload channel.
export function runEnforcementCLI(engine) {
  const channel=value=>{const trimmed=value.trim();return trimmed.length?trimmed+'\n':'';};
  const emit=value=>{
    const response=engine.feedback(value);
    process.stdout.write(channel(JSON.stringify(response)));
    process.exitCode=response.type==='oop_configuration_validation'||response.type==='oop_runtime_coordination'?(response.error?4:(response.valid??response.accepted)?0:2):(engine.exitCodes[response.decision]??4);
  };
  const validation=process.argv[2]==='validate-configuration';
  const coordinating=['declare','load','worklog-append','worklog-read'].includes(process.argv[2]);
  const error=reason=>validation?{...engine.validateConfiguration(null),reason}:coordinating?{...engine.coordinate('',null),reason}:
    ({...engine.evaluate('',{format:1,request_id:reason}),reason_code:reason});
  if(Number(process.versions.node.split('.')[0])<24) {emit(error('unsupported_interpreter'));return;}
  // Stable native invocation: --registration <locator> --installation-uid <persistent UID>.
  const extra=process.argv.slice(3);
  const host=extra.length===6&&extra[4]==='--host'?extra[5]:null;
  if(process.argv.length<3||!(extra.length===0||((extra.length===4||host)&&extra[0]==='--registration'&&extra[2]==='--installation-uid'))||(extra.length&&validation)) {emit(error('invalid_arguments'));return;}
  const options=extra.length?{registration:{path:extra[1],installation_uid:extra[3]}}:undefined;
  let size=0, chunks=[], finished=false;
  const finish=async(reason)=>{if(finished)return;finished=true;clearTimeout(timer);
    if(reason){emit(error(reason));process.stdin.destroy();return;}
    try {
      const bytes=Buffer.concat(chunks);
      const input=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const request=JSON.parse(input);
      if(host){const result=engine.framework.dispatch(process.argv[2],request,options.registration,host);
        const write=(stream,value)=>new Promise((resolve,reject)=>{const failed=e=>{stream.removeListener('error',failed);reject(e);};stream.once('error',failed);
          try{stream.write(channel(value),error=>{if(error){reject(error);return;}stream.removeListener('error',failed);resolve();});}catch(e){failed(e);}});
        try{await Promise.all([write(process.stdout,result.stdout),write(process.stderr,result.stderr??'')]);process.exitCode=result.exit;}
        catch{process.exitCode=4;result.onDeliveryFailure?.();process.stderr.on('error',()=>{});try{process.stderr.write(channel((result.correlation?'OOP declaration outcome unknown to caller. Read the owned declaration receipt '+result.correlation+' before retrying. ':'')+'OOP response delivery failed; keep the dependent effect stopped. Repair the host output stream and launcher, consult owned diagnostics, and retry only after actual delivery is available. Do not claim host receipt or enforcement.'),()=>{});}catch{}}
        return;}

      emit(validation?engine.validateConfiguration(request):coordinating?engine.coordinate(process.argv[2],request,options):engine.evaluate(process.argv[2],request,options));
    } catch {emit(error('invalid_json'));}
  };
  const timer=setTimeout(()=>finish('input_timeout'),5000);
  process.stdin.on('data',chunk=>{size+=chunk.length;if(size>1024*1024)finish('input_too_large');else chunks.push(chunk);});
  process.stdin.on('end',()=>finish());
  process.stdin.on('error',()=>finish('input_error'));
}
