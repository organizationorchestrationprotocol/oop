// Producer-maintained implementation. Canonical rules remain in PROTOCOL.md.
// This factory is serialized into the standalone CommonJS distribution.
export function createEnforcementEngine(config, route, installation) {
  const commands = Object.keys(config.commands);
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const text = x => typeof x === 'string' && x.length > 0 && x.length <= 512;
  const same = (a,b) => object(a) && object(b) && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  const exitCodes = {allow:0,deny:2,unknown:3,error:4};
  function validateConfiguration(request) {
    const response={format:1,type:'oop_configuration_validation',request_id:text(request?.request_id)?request.request_id:null,
      source_binding:config.source_binding,valid:false,reason:'invalid_envelope',dispatch_verified:false,validation_binding:null,error:true};
    try {
      if(!object(request)||request.format!==1||!text(request.request_id)||
        Object.keys(request).some(k=>!['format','request_id','plan','facts'].includes(k))||!object(request.plan)||!object(request.facts))return response;
      const result=installation.validateConfiguration(request.plan,request.facts);
      return {...response,...result,error:false};
    }catch{return {...response,reason:'configuration_validation_error'};}
  }
  function evaluate(command, request) {
    const result = (decision,reason_code,payload={}) => ({format:1,type:'oop_admission',
      request_id:text(request?.request_id)?request.request_id:null,command:commands.includes(command)?command:null,
      source_binding:config.source_binding,decision,reason_code,effect_permission:'not_granted',
      assurance:'Conditional on independently authenticated adapter observations; no host interception or fact authentication by this engine.',payload});
    try {
      if(!commands.includes(command)) return result('error','unsupported_command');
      if(!object(request) || request.format!==1 || !text(request.request_id)) return result('error','invalid_envelope');
      // Do not reflect arbitrary payloads, paths, evidence contents or parse exceptions.
      const allowed=['format','request_id','scope','context','evidence','effect_class','transition','bootstrap_step','journal','organizational_mutation','bridge_maintenance','maintenance_observation'];
      if(Object.keys(request).some(key=>!allowed.includes(key))) return result('error','invalid_envelope');
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
      const context=request.context;
      const identities=['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'];
      const mutationRequired=command==='pre-effect'&&['ticket_mutation','identity_registry_mutation'].some(f=>
        request.effect_class===f||['request','action'].some(k=>scope[k]?.includes(f)));
      if(mutationRequired||request.organizational_mutation!==undefined)identities.push('instruction_origin_uid');
      if(!object(context) || identities.some(k=>!text(context[k])) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(context.oop_commit) ||
        !text(context.observed_at) || !Number.isFinite(Date.parse(context.observed_at)) || !object(context.dependencies) ||
        !Object.keys(context.dependencies).length || !Object.values(context.dependencies).every(text)) return result('unknown','needs_evidence');
      const expected={...Object.fromEntries(identities.map(k=>[k,context[k]])),
        // Bind proof to this exact command, route and proposed effect, not just a workspace.
        command,selection:selection.modules.join(','),effect_class:request.effect_class??'none'};
      const now=Date.parse(context.observed_at);
      const evidence=request.evidence;
      if(!object(evidence)) return result('unknown','needs_evidence');
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
      const facts=[...config.commands[command].required,...selected.map(c=>'semantic:'+c.id)];
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
      const missing=[];const failed=[];
      for(const id of [...new Set(facts)]) {
        const item=evidence[id];
        const valid=object(item) && typeof item.value==='boolean' && item.origin==='authoritative_observation' &&
          text(item.reference) && same(item.binding,expected) && same(item.dependencies,context.dependencies) &&
          Number.isFinite(Date.parse(item.observed_at)) && Date.parse(item.observed_at)<=now &&
          Number.isFinite(Date.parse(item.expires_at)) && now<Date.parse(item.expires_at);
        if(!valid) missing.push(id);else if(item.value===false) failed.push(id);
      }
      if(failed.length) return result('deny','guard_failed',{failed});
      if(missing.length) return result('unknown','needs_evidence',{missing});
      const response=result('allow','required_predicates_satisfied',{
        checked:[...new Set(facts)],modules:selection.modules,observation_time:context.observed_at,
        state_write:'none; adapter owns effects, journals, locking and checkpoints',
        semantic_assurance:'Residual judgments are supplied by the authorized observer; not computed from prose.'});
      if(command==='pre-effect') response.effect_permission='conditional_on_adapter';
      return response;
    } catch { return result('error','invalid_input'); }
  }
  return {evaluate,validateConfiguration,exitCodes,config,installation};
}

// The CLI never performs filesystem/provider writes. stdin is the only payload channel.
export function runEnforcementCLI(engine) {
  const emit=response=>{
    process.stdout.write(JSON.stringify(response)+'\n');
    process.exitCode=response.type==='oop_configuration_validation'?(response.error?4:response.valid?0:2):(engine.exitCodes[response.decision]??4);
  };
  const validation=process.argv[2]==='validate-configuration';
  const error=reason=>validation?{...engine.validateConfiguration(null),reason}:
    ({...engine.evaluate('',{format:1,request_id:reason}),reason_code:reason});
  if(Number(process.versions.node.split('.')[0])<24) {emit(error('unsupported_interpreter'));return;}
  if(process.argv.length!==3) {emit(error('invalid_arguments'));return;}
  let size=0, chunks=[], finished=false;
  const finish=(reason)=>{if(finished)return;finished=true;clearTimeout(timer);
    if(reason){emit(error(reason));process.stdin.destroy();return;}
    try {
      const bytes=Buffer.concat(chunks);
      const input=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const request=JSON.parse(input);
      emit(validation?engine.validateConfiguration(request):engine.evaluate(process.argv[2],request));
    } catch {emit(error('invalid_json'));}
  };
  const timer=setTimeout(()=>finish('input_timeout'),5000);
  process.stdin.on('data',chunk=>{size+=chunk.length;if(size>1024*1024)finish('input_too_large');else chunks.push(chunk);});
  process.stdin.on('end',()=>finish());
  process.stdin.on('error',()=>finish('input_error'));
}
