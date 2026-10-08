'use strict';
const {runtimeRendering}=require('./runtime-rendering.cjs');
const {runtimeDeclaration}=require('./runtime-declaration.cjs');
const {runtimeObservations}=require('./runtime-observations.cjs');
const {runtimeFeedback}=require('./runtime-feedback.cjs');
const {runtimeAction}=require('./runtime-action.cjs');
// Serialized into the official standalone controller. No Git/network executor here.
function runtimeFramework(engine, coordination, template, executionDirectory=null) {
  const rendering=runtimeRendering(),declaration=runtimeDeclaration(),local=runtimeObservations(),feedback=runtimeFeedback(),actions=runtimeAction(engine,coordination);
  const diagnosticCommands=['diagnostics-read','diagnostics-ack','diagnostics-cleanup'];
  const fs=process.getBuiltinModule('node:fs'), crypto=process.getBuiltinModule('node:crypto'), path=process.getBuiltinModule('node:path');
  const {spawnSync}=process.getBuiltinModule('node:child_process');
  const hash=x=>'sha256:'+crypto.createHash('sha256').update(x).digest('hex');
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const normalize=x=>x.replace(/\r\n/g,'\n');
  const canonical=x=>Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const identity=x=>hash(Buffer.from(JSON.stringify(canonical(x))));
  const equal=(a,b)=>identity(a)===identity(b);
  const commands=[...Object.keys(engine.config.commands),'declare','load','worklog-append','worklog-read',...diagnosticCommands];
  function scaffold(source) {
    const ids=[];
    const masked=normalize(source).replace(/(\/\/ OOP-EDIT-BEGIN (\w+)\n)([\s\S]*?)([ \t]*\/\/ OOP-EDIT-END \2)/g,
      (_,start,id,body,end)=>{ids.push(id);return start+'<editable>\n'+end;});
    return {masked,ids};
  }
  function validateAdapter(source) {
    if(typeof source!=='string'||Buffer.byteLength(source)>262144)return {valid:false,reason:'adapter_size_or_type'};
    const a=scaffold(source),expected=scaffold(template);
    if(a.masked!==expected.masked||JSON.stringify(a.ids)!==JSON.stringify(expected.ids))return {valid:false,reason:'adapter_scaffold_changed'};
    for(const id of a.ids){
      const body=normalize(source).split('// OOP-EDIT-BEGIN '+id+'\n')[1].split('// OOP-EDIT-END '+id)[0];
      const code=body.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').trim();
      if(!code||code.includes('OOP_ADAPTER_NOT_IMPLEMENTED')||/^(?:return\s+(?:null|undefined|true|false|\{\s*\}));?$/.test(code))return {valid:false,reason:'adapter_incomplete'};
    }
    try{new (process.getBuiltinModule('node:vm').Script)(source);}catch{return {valid:false,reason:'adapter_syntax'};}
    return {valid:true,reason:'scaffold_and_syntax_only',identity:hash(Buffer.from(source))};
  }
  // Separate process protects the parent's decision/output lifecycle from accidental
  // adapter globals/exits. It is not authentication or a hostile-code sandbox.
  function manifest(source) {
    const body=normalize(source).split('// OOP-EDIT-BEGIN manifest\n')[1]?.split('// OOP-EDIT-END manifest')[0];
    if(body===undefined)throw Error('manifest_missing');
    const literal=body.split('\n').filter(l=>!l.trim().startsWith('//')).join('\n').trim(),stack=[];
    for(let i=0;i<literal.length;i++){
      const ch=literal[i];if(ch==='"'){let end=i+1;for(;end<literal.length;end++){if(literal[end]==='\\'){end++;continue;}if(literal[end]==='"')break;}
        const top=stack.at(-1);if(top?.keys&&top.key){const k=JSON.parse(literal.slice(i,end+1));if(top.keys.has(k))throw Error('manifest_duplicate_key');top.keys.add(k);top.key=false;}i=end;
      }else if(ch==='{')stack.push({keys:new Set(),key:true});else if(ch==='[')stack.push({});else if(ch==='}'||ch===']')stack.pop();else if(ch===','&&stack.at(-1)?.keys)stack.at(-1).key=true;
    }
    return JSON.parse(literal);
  }
  const worker="const vm=require('node:vm');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{try{const x=JSON.parse(s),box={module:{exports:{}}};vm.runInNewContext(x.source,box,{timeout:500});const a=box.module.exports;if(!a||typeof a.decodeEvent!=='function'||Object.keys(a).some(k=>!['manifest','decodeEvent'].includes(k)))throw Error();const result=await a.decodeEvent(x.raw,x.context);process.stdout.write(JSON.stringify(result));}catch{process.exitCode=4;}});";
  function call(source,raw,context,timeout=2000) {
    const r=spawnSync(process.execPath,['-e',worker],{input:JSON.stringify({source,raw,context}),encoding:'utf8',timeout,maxBuffer:8*1048576,windowsHide:true,env:{}});
    if(r.status!==0||r.error||r.signal)throw Error('adapter_execution_failed');
    try{return JSON.parse(r.stdout);}catch{throw Error('adapter_result_malformed');}
  }
  function declarationDelivery(p, binding, policy) {
    const delivery=p.declare_delivery;
    if(delivery===undefined&&binding===undefined)return null;
    if(!object(delivery)||!object(binding)||delivery.contract!==binding.contract||delivery.reference!==binding.reference||
      delivery.contract!=='oop.declare.v1'||typeof delivery.reference!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}(?![\s\S])/.test(delivery.reference)||
      Object.keys(delivery).some(k=>!['contract','reference','instruction_limit_bytes','result_limit_bytes','prefix','suffix','encoding'].includes(k))||
      !Object.hasOwn(p.supported_commands?.declare??{},delivery.reference)||!Object.hasOwn(p.supported_commands??{},'diagnostics-read')||
      !['text','json-string'].includes(delivery.encoding)||!['prefix','suffix'].every(k=>typeof delivery[k]==='string'&&delivery[k].isWellFormed())||
      !Number.isSafeInteger(delivery.instruction_limit_bytes)||delivery.instruction_limit_bytes<1||delivery.instruction_limit_bytes>policy.maxOutputBytes||
      !Number.isSafeInteger(delivery.result_limit_bytes)||delivery.result_limit_bytes<512||delivery.result_limit_bytes>policy.maxOutputBytes)
      throw Error('declare_binding_incompatible');
    const line='OOP declare: invoke '+delivery.reference+' using oop.declare.v1. Supply the declaration fields as input; the integration binds the active session.';
    const encoded=delivery.encoding==='json-string'?JSON.stringify(line):line;
    if(Buffer.byteLength(delivery.prefix+encoded+delivery.suffix,'utf8')>delivery.instruction_limit_bytes)
      throw Error('declare_instruction_budget_exceeded');
    return delivery;
  }
  function profile(p,record,host) {
    const checked=declaration.validate(p,{supported_commands:record.runtime_adapter.required_events});
    if(!checked.valid||feedbackCases(p).length)throw Error('adapter_response_profile_invalid');
    if(p.host!==host||p.host!==record.runtime_adapter.host||p.runtime_version!==record.runtime_adapter.runtime_version||Object.keys(p.supported_commands).some(c=>!commands.includes(c)))throw Error('adapter_profile_invalid');
    p.rendering=rendering.options(p.rendering);p.compiled=declaration.compile(p);
    p.declare_delivery=declarationDelivery(p,record.declare_binding,p.rendering);
    for(const natives of p.compiled.values())for(const selected of natives.values())if(Object.hasOwn(selected,'fallback'))rendering.output(selected.fallback,p.rendering,true);
    return p;
  }
  function dispatch(command,raw,spec,host) {
    const started=Date.now();let recoveryRecord,recoveryPolicy,recoveryFallback,portableCorrelation;
    try{
      const reg=coordination.registration(spec,engine.config.source_binding.source_identity);
      if(!reg.ok)throw Error(reg.reason);
      spec={...spec,identity:reg.identity,installation_uid:reg.record.installation_uid};
      const r=reg.record,a=r.runtime_adapter;
      recoveryRecord=r;
      if(r.format!==1||!object(a)||Object.keys(a).some(k=>!['path','identity','template_identity','host','runtime_version','required_events','observation_admission'].includes(k))||a.template_identity!==hash(template)||!Array.isArray(a.required_events)||!a.required_events.length||
        a.required_events.some(c=>!commands.includes(c)))throw Error('adapter_registration_invalid');
      const actual=fs.realpathSync.native(a.path),owned=fs.realpathSync.native(r.owned_scope);
      const rel=path.relative(owned,actual);
      if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||path.basename(actual)!=='oop-runtime-adapter.js'||fs.lstatSync(a.path).isSymbolicLink()||actual!==path.resolve(a.path))throw Error('adapter_location_invalid');
      const bytes=fs.readFileSync(actual);
      if(hash(bytes)!==a.identity)throw Error('adapter_identity_mismatch');
      const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      if(scaffold(source).masked!==scaffold(template).masked)throw Error('adapter_template_mismatch');
      const checked=validateAdapter(source);
      if(!checked.valid)throw Error(checked.reason);
      const p=profile(manifest(source),r,host);recoveryPolicy=p.rendering;
      if(!Object.hasOwn(p.supported_commands,command))throw Error('adapter_event_unsupported');
      const acquired=local.acquire(r,{executionDirectory});
      const context={command,host,local:acquired.status==='known'?{observed_at:acquired.observed_at,checkpoint_ref:acquired.mapping.checkpoint_ref,checkpoint_revision:String(acquired.checkpoint.revision),mapping_revision:acquired.binding.revision,dependencies:Object.fromEntries(Object.entries(acquired.observations).map(([key,o])=>['local_'+key,o.identity]))}:{status:'unknown'},registration:Object.fromEntries(Object.entries({project:r.project_root,installation_uid:r.installation_uid,machine_id:r.machine_id,runtime:r.runtime_class,owned_scope:r.owned_scope,common_scope:r.common_scope}).filter(([,v])=>v!==undefined))};
      // Expose verified launch references for exact control-plane translation.
      Object.assign(context.registration,Object.fromEntries(Object.entries({controller:r.controller_locator,interpreter:r.interpreter_locator,registration_path:spec.path,registration_identity:spec.identity,invocation:r.runtime_invocation}).filter(([,v])=>v!==undefined)));
      const decoded=call(source,raw,context);
      const selected=declaration.select(p.compiled,command,decoded?.native_event);recoveryFallback=selected.fallback;
      if(!object(decoded)||!object(decoded.request)||typeof decoded.session!=='string'||!decoded.session)throw Error('adapter_request_invalid');
      const portable=command==='declare'?p.declare_delivery:null;
      if(portable&&decoded.native_event!==portable.reference)throw Error('declare_binding_incompatible');
      if(portable&&Buffer.byteLength(JSON.stringify({session:decoded.session,declaration:decoded.request}),'utf8')>65536)throw Error('declare_payload_too_large');
      if(portable&&(typeof decoded.request.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/.test(decoded.request.request_id)))throw Error('declare_request_id_required');
      let request={...decoded.request};
      const runtime=['declare','load','worklog-append','worklog-read'].includes(command);
      request.format=1;
      if(typeof request.request_id!=='string'||!request.request_id)request.request_id=crypto.randomUUID();
      request.coordination={session:decoded.session};
      if(!runtime){
        if(decoded.resource!==undefined){if(!object(decoded.resource)||typeof decoded.resource.path!=='string'||!['read','write','unknown'].includes(decoded.resource.access))throw Error('adapter_resource_invalid');request.coordination.resource=decoded.resource;}
        if(decoded.context_event!==undefined){if(!['start','resume','compact','restore','context_loss'].includes(decoded.context_event))throw Error('adapter_context_event_invalid');request.coordination.context_event=decoded.context_event;}
      }
      delete request.session;
      if(diagnosticCommands.includes(command)){
        let result;
        if(command==='diagnostics-read')result=decoded.request.declaration_correlation===undefined?rendering.list(r):rendering.readDeclaration(r,decoded.request.declaration_correlation,decoded.session);
        else if(command==='diagnostics-ack')result=rendering.acknowledge(r,decoded.request.id,decoded.request.presentation);
        else result=rendering.cleanup(r,p.rendering);
        const runtime_message=Array.isArray(result.errors)&&result.errors.length?feedback.recovery('diagnostic_store_unavailable'):'';
        return {stdout:JSON.stringify({format:1,type:'oop_rendering_diagnostics',result,runtime_message})+'\n',stderr:'',exit:0};
      }
      if(!runtime&&acquired.status==='known'){
        const c=request.context??{},cp=acquired.checkpoint;
        request.context={...c,observed_at:acquired.observed_at,dependencies:{...c.dependencies,...context.local.dependencies},project:r.project_root,runtime:r.runtime_class,installation_uid:r.installation_uid,machine_id:r.machine_id,checkpoint_ref:acquired.mapping.checkpoint_ref,checkpoint_revision:String(cp.revision),mapping_revision:acquired.binding.revision};
        const externalMaintenance=request.maintenance_observation;
        if(cp.verified_commit||cp.target_commit)request.context.oop_commit=cp.verified_commit??cp.target_commit;else delete request.context.oop_commit;
        delete request.maintenance_observation;
        if(acquired.maintenance.mode!=='normal'&&object(externalMaintenance))request.maintenance_observation={...externalMaintenance,mode:acquired.maintenance.mode,declaration_revision:String(acquired.maintenance.revision),project:r.project_root,runtime_uid:r.installation_uid,machine_id:r.machine_id,checkpoint_ref:acquired.mapping.checkpoint_ref,checkpoint_revision:String(cp.revision),mapping_revision:acquired.binding.revision};
        if(acquired.maintenance.mode==='normal')request.maintenance_observation={origin:'authoritative_observation',current:true,dependencies:request.context.dependencies,reference:acquired.observations.maintenance.reference,mode:'normal',project:r.project_root,runtime_uid:r.installation_uid,machine_id:r.machine_id,checkpoint_ref:acquired.mapping.checkpoint_ref,checkpoint_revision:String(cp.revision),expected_revision:c.revision,mapping_revision:acquired.binding.revision,authority:c.authority,request_id:request.request_id,action_scope:c.action_scope,observed_at:acquired.observed_at,expires_at:new Date(Date.parse(acquired.observed_at)+1000).toISOString()};
              const selection=engine.config.routing&&engine.evaluate('interaction',{...request,coordination:undefined}).payload?.modules;
        if(Array.isArray(selection)&&object(request.context.dependencies)){
          const identities=['project','runtime','session','request_scope','action_scope','checkpoint_ref','checkpoint_revision','mapping_revision','oop_commit','revision','authority','resource','risk','lifecycle','context_retention','machine_id','installation_uid'];
          const binding={...Object.fromEntries(identities.map(k=>[k,request.context[k]])),command,selection:selection.join(','),effect_class:request.effect_class??'none'};
          request.evidence={...request.evidence};
          for(const [fact,record] of [['runtime_identity_verified','binding'],['checkpoint_current_verified','checkpoint']])request.evidence[fact]={value:true,origin:'authoritative_observation',reference:acquired.observations[record].reference,binding,dependencies:request.context.dependencies,observed_at:acquired.observed_at,expires_at:new Date(Date.parse(acquired.observed_at)+1000).toISOString()};
        }
      }else if(!runtime){delete request.maintenance_observation;}
      // The registered adapter translates actual native operations. No caller-
      // supplied request field can turn on this framework-only admission channel.
      // Unknown operations, unavailable local observations and mutations retain
      // the original evidence gate. This is not an independent hostile-code sandbox.
      let nativeObservation;
      if(!runtime&&r.runtime_adapter.observation_admission===1&&acquired.status==='known'&&request.scope?.classification==='known'){
        if(decoded.resource?.access==='read'){
          // Never classify aliases or out-of-workspace targets as local reads.
          // Unknown metadata falls back to the existing non-authorizing gate.
          try{const directory=request.context?.native_event?.cwd,target=path.resolve(directory,decoded.resource.path),relative=path.relative(r.project_root,target);
            if(fs.realpathSync.native(directory)===path.resolve(directory)&&relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&fs.realpathSync.native(target)===target&&!actions.accessProblem(target,'read',r,spec,coordination.actionState?.(decoded.session,{reg:{record:r}}))){
              request.coordination.resource.path=target;
              nativeObservation={kind:'read',resource:target,session:decoded.session,request_id:request.request_id};
            }
          }catch{}
        }
        else if(['load','declare'].includes(request.context?.native_coordination?.command))nativeObservation={kind:'coordination',session:decoded.session,request_id:request.request_id};
      }
      let workflow;
      if(runtime&&command==='load'&&request.scope==='action'&&coordination.recordAction)actions.refresh({record:r,acquired,session:decoded.session,command:request.command??'pre-effect',spec});
      if(!runtime&&!nativeObservation&&coordination.recordAction){
        workflow=actions.prepare({record:r,acquired,decoded,request,command,spec,normalization:p.action_normalization,nativeInputIdentity:identity(raw)});
        if(workflow.ok)request=workflow.request;
      }
      const planning=acquired.status==='known'&&acquired.maintenance.mode==='normal'?{dependencies:actions.dependencies(acquired,spec,engine.config.source_binding.source_identity),normalization:p.action_normalization}:undefined;
      if(portable){
        const correlation=hash(request.request_id);
        try{rendering.claimDeclaration(r,correlation,decoded.session,p.rendering);portableCorrelation=correlation;}
        catch{return {stdout:'',stderr:'OOP declare reconciliation required. Read the owned declaration receipt '+correlation+' before proceeding. If unavailable, reconcile the session before any new submission.\n',exit:4,error:'declare_reconciliation_required'};}
      }
      let response=runtime?engine.coordinate(command,request,{registration:spec,hostAdapted:true,planning}):engine.evaluate(command,request,{registration:spec,hostAdapted:true,nativeObservation,workflow:workflow?.frame});
      if(workflow&&!workflow.ok){
        const {repair,...safeExtra}=workflow.extra??{};response.payload={...response.payload,...safeExtra};
        if(!['deny','error'].includes(response.decision))response={...response,decision:workflow.decision,reason_code:workflow.reason,effect_permission:'not_granted'};
      }
      if(workflow?.frame){
        if(command==='post-effect'&&Number.isSafeInteger(response.payload?.controller_revision))workflow.verification_revision=response.payload.controller_revision;
        response.payload={...response.payload,action:workflow.challenge,assessment_assurance:'Agent semantic judgments are attributed claims, distinct from controller-observed facts and host authorization. No independent protection against a principal controlling these files is claimed.',execution_conditions:workflow.frame.execution_conditions};
        if(response.decision==='allow'&&!actions.verify(workflow,{record:r,acquired,spec}))response={...response,decision:'unknown',reason_code:'action_dependency_changed',effect_permission:'not_granted'};
        if(response.decision==='allow'&&command==='pre-effect'&&!coordination.consumeAction(decoded.session,workflow.frame.session_revision,identity({session:decoded.session,command,request_id:request.request_id,action_identity:workflow.frame.action_identity}),workflow.options,{action_identity:workflow.frame.action_identity,request_id:request.request_id,request_reference:workflow.state.request_reference,assessment_identity:workflow.frame.assessment_identity,purpose:workflow.frame.purpose,source_identity:workflow.frame.source_identity,execution_conditions:workflow.frame.execution_conditions,...(workflow.frame.preparation_identity?{preparation_identity:workflow.frame.preparation_identity}:{})}))
          response={...response,decision:'unknown',reason_code:'action_claim_rejected',effect_permission:'not_granted'};
        if(response.decision==='allow'&&command!=='pre-effect'&&workflow.frame.preparation_identity&&!coordination.consumePreparation(decoded.session,workflow.frame.session_revision,workflow.frame.preparation_identity,workflow.options))response={...response,decision:'unknown',reason_code:'action_claim_rejected',effect_permission:'not_granted'};
      }
      if(runtime&&command==='declare'&&request.phase==='assessment'&&request.assessment?.command==='post-effect'&&response.accepted&&coordination.recordAction){
        const observed=actions.prepare({record:r,acquired,decoded:{session:decoded.session},request:{format:1,request_id:request.request_id,coordination:{session:decoded.session}},command:'post-effect',spec,recorded:true});
        let outcome=observed.ok?engine.evaluate('post-effect',observed.request,{registration:spec,hostAdapted:true,workflow:observed.frame}):{format:1,type:'oop_admission',request_id:request.request_id,command:'post-effect',source_binding:engine.config.source_binding,decision:'unknown',effect_permission:'not_granted',reason_code:observed.reason,assurance:'Reevaluates a recorded actual outcome; no new invocation or effect permission.',payload:observed.extra??{}};
        if(observed.ok&&Number.isSafeInteger(outcome.payload?.controller_revision))observed.verification_revision=outcome.payload.controller_revision;
        if(observed.ok&&outcome.decision==='allow'&&!actions.verify(observed,{record:r,acquired,spec}))outcome={...outcome,decision:'unknown',reason_code:'action_dependency_changed',effect_permission:'not_granted'};
        outcome=feedback.complete(outcome);
        if(outcome.decision==='allow'&&coordination.procedureFeedback){
          try{const guidance=coordination.procedureFeedback(decoded.session,'post-effect',outcome,{reg:{record:r,...spec},sourceIdentity:engine.config.source_binding.source_identity,planning});
            if(guidance){outcome.payload.procedure_guidance=guidance;outcome.payload.runtime_message+='\nOOP procedure context: '+JSON.stringify(guidance);}
          }catch{outcome.payload.runtime_message+='\nOOP procedure cache unavailable; no outcome retention is claimed.';}
        }
        response.result={...response.result,reconciliation:outcome};
        if(outcome.payload.runtime_message)response.runtime_message=(response.runtime_message??'')+'\n'+outcome.payload.runtime_message;
      }
      if(!runtime&&['completion','delegate'].includes(command)){
        const repair=workflow?.extra?.repair;
        const continuing=response.decision!=='allow'&&response.reason_code!=='canonical_publication_pending'&&
          (workflow?.frame&&workflow.continuation&&actions.verify(workflow,{record:r,acquired,spec})&&coordination.completionState(decoded.session,workflow.frame.session_revision,workflow.progress,workflow.options)===true||repair&&response.decision==='unknown'&&response.reason_code==='needs_action_assessment'&&coordination.completionState(decoded.session,repair.session_revision,repair.progress,{reg:{record:r}})===true);
        const next=repair?.next_action??workflow?.continuation?.next_action;
        response.payload={...response.payload,completion:{disposition:response.decision==='allow'?'satisfied':continuing?'continue':'blocked',continuation_permitted:!!continuing,...(continuing?{next_action:next}:{})}};
      }
      if(!runtime&&acquired.status!=='known'&&response.decision==='allow')response={...response,decision:'unknown',reason_code:'local_observations_unavailable',effect_permission:'not_granted'};
      response=feedback.complete(response);
      if(response.payload?.completion?.continuation_permitted)response.payload.runtime_message+='\nNext authorized continuation: '+response.payload.completion.next_action;
      if(!runtime&&coordination.procedureFeedback){
        try{
          const options={reg:{record:r,...spec},sourceIdentity:engine.config.source_binding.source_identity,planning};
          const guidance=['entry','interaction','recovery'].includes(command)?coordination.procedureContext?.(decoded.session,options):coordination.procedureFeedback(decoded.session,command,response,options);
          if(guidance){response.payload.procedure_guidance=guidance;response.payload.runtime_message+='\nOOP procedure context: '+JSON.stringify(guidance);}
        }catch{response.payload.runtime_message+='\nOOP procedure cache unavailable: retain current action checks; load scope=procedures to reconcile owned storage. No procedure persistence or delivery is claimed.';}
      }
      if(runtime&&command==='declare'&&request.phase==='classification'&&response.accepted&&coordination.procedureContext){
        try{const guidance=coordination.procedureContext(decoded.session,{reg:{record:r,...spec},sourceIdentity:engine.config.source_binding.source_identity,planning});
          if(guidance){response.result.procedure_guidance=guidance;response.runtime_message+='\nOOP procedure context: '+JSON.stringify(guidance);}
        }catch{response.runtime_message+='\nOOP procedure cache unavailable; current independent action checks remain required.';}
      }
      if(response.payload?.action&&coordination.actionState){
        const state=coordination.actionState(decoded.session,{reg:{record:r}}),action=response.payload.action;
        if(state){
          action.state_revision=state.revision;
          for(const declaration of [action.declare,action.declare_template,action.classification_required]){
            if(declaration)declaration.expected_revision=state.revision;
          }
        }
      }
      if(!runtime&&command==='completion'){
        const options={reg:{record:r}};
        const state=coordination.actionState?.(decoded.session,options);
        let diagnostic=feedback.completionDiagnostic(response,workflow?.frame);
        if(response.decision!=='allow'){
          const assessment=state?.assessments?.completion;
          const {assessment_revision,identity:assessmentIdentity,...assessmentContent}=assessment??{};
          const work=state?.work_item?.id,request=state?.request_reference;
          const {revision,receipt}=diagnostic.correlation;
          const {assessment:assessmentFinding,...otherFindings}=diagnostic.findings;
          const observed={decision:diagnostic.decision,reason:diagnostic.reason_code,
            action:receipt?.action_identity??null,findings:identity(otherFindings),
            assessment:identity({status:assessmentFinding.status,bindings:assessmentFinding.changed_bindings,content:assessmentContent}),
            context:identity({source:engine.config.source_binding,dependencies:state?.pending_actions?.completion?.dependencies,
              declaration:state?.declaration_identity,resources:workflow?.observed?.map(({path,access,identity})=>[path,access,identity]),outcome:state?.last_outcome?.outcome_identity})};
          let repetition={status:'indeterminate'};
          if(request&&coordination.completionDiagnostic){
            try{repetition=coordination.completionDiagnostic(decoded.session,{request,work,revision:state.revision,identity:identity({request,work})},
              identity({request,work,observed}),observed,options);}catch{}
          }
          const current=coordination.actionState?.(decoded.session,options);
          if(receipt&&current?.request_reference===request&&current?.pending_actions?.completion?.action_identity===receipt.action_identity&&
            current?.pending_actions?.completion?.generation===receipt?.generation&&Number.isSafeInteger(current?.revision)&&current.revision!==revision){
            const action=response.payload.action;
            action.state_revision=current.revision;
            for(const declaration of [action.declare,action.declare_template,action.classification_required])if(declaration)declaration.expected_revision=current.revision;
            diagnostic=feedback.completionDiagnostic(response,workflow?.frame);
          }
          diagnostic.repetition=repetition;
          const next=diagnostic.next_operation;
          const header='OOP completion '+diagnostic.decision+' ['+diagnostic.reason_code+']: '+diagnostic.description;
          const correlation=receipt?' Action '+receipt.action_identity+' generation '+receipt.generation+' at session revision '+diagnostic.correlation.revision+'.':'';
          if(repetition.status==='unchanged'){
            response.payload.runtime_message=header+' Previous diagnosis: '+repetition.reference+'. Repeated delivery cannot be suppressed without a documented host capability. Wait for a material change or use the documented escalation path.';
          }else{
            response.payload.runtime_message=header+correlation+(next?' Next: '+next.operation+'. '+(next.then??next.instructions??'Use the documented operation inputs.')+' Retry only when: '+next.retry_when:'')+
              (diagnostic.reason_code===response.reason_code?'\n'+response.payload.runtime_message:
                response.payload.completion?.continuation_permitted?'\nNext authorized continuation: '+response.payload.completion.next_action:'');
          }
        }
        response.payload.completion_diagnostic=diagnostic;
      }
      const decision=response.type==='oop_admission'?response.decision:response.error?'error':(response.valid??response.accepted)?'allow':'deny';
      const requestForRenderer={format:1,raw,context,event:decoded,decision,response};
      if(portable){
        const outcome={contract:portable.contract,correlation:hash(response.request_id),decision,reason:response.reason,
          effect_permission:'not_granted'};
        const stdout=JSON.stringify({...outcome,result:response.result,runtime_message:response.runtime_message})+'\n';
        const onDeliveryFailure=()=>{try{coordination.invalidateDelivery?.(decoded.session,{reg:{record:r}});}catch{}};
        try{rendering.persistDeclaration(r,outcome);}
        catch{onDeliveryFailure();return {stdout:'',stderr:'OOP declare outcome unavailable. Restore the owned result store and reconcile session state before retrying.\n',exit:4,error:'declare_receipt_unavailable',onDeliveryFailure};}
        if(Buffer.byteLength(stdout,'utf8')>portable.result_limit_bytes){
          onDeliveryFailure();
          return {stdout:'',stderr:'OOP declare result exceeded budget. Read the owned declaration receipt '+outcome.correlation+' before retrying.\n',exit:4,error:'declare_result_budget_exceeded',onDeliveryFailure};
        }
        return {stdout,stderr:'',exit:response.error?4:response.accepted?0:2,correlation:outcome.correlation,onDeliveryFailure};
      }
      if(Object.hasOwn(decoded,'fallbackClass'))throw Error('adapter_fallback_class_invalid');
      if(acquired.diagnostics.length)requestForRenderer.additionalContext={localObservationDiagnostics:acquired.diagnostics};
      if(['entry','interaction','recovery'].includes(command)){
        try{const diagnostics=rendering.list(r);const unread=diagnostics.records.filter(d=>!d.read);
          if(unread.length||diagnostics.errors.length)requestForRenderer.additionalContext={...requestForRenderer.additionalContext,renderingDiagnostics:unread,diagnosticErrors:diagnostics.errors,
            presentation:'Present each original and its effective-language translation or translation-unavailable notice. Acknowledge only after actual presentation; delivery is not acknowledgement.'};
        }catch{requestForRenderer.additionalContext={diagnosticErrors:['diagnostic_store_unavailable']};}
      }
      const rendered=rendering.run({record:r,request:requestForRenderer,event:command,policy:p.rendering,fallback:recoveryFallback,invoke:policy=>{
        const remaining=policy.hostDeadlineMs===undefined?policy.timeoutMs:Math.min(policy.timeoutMs,policy.hostDeadlineMs-(Date.now()-started)-policy.marginMs);
        if(remaining<1)throw rendering.failure('renderer_timeout');
        const pub=response.payload?.publication;
        if(pub&&pub.disposition!=='no_change')response.payload.runtime_message=(response.payload.runtime_message??'')+'\nOOP publication: '+pub.disposition+'. Canonical success requires remote revision/content readback; preserve repair and independent safe work.';
        if(requestForRenderer.additionalContext&&object(response.payload)){response.payload.rendering_diagnostics=requestForRenderer.additionalContext;response.payload.runtime_message=(response.payload.runtime_message??'')+'\n'+JSON.stringify(requestForRenderer.additionalContext);}
        const renderStart=Date.now(),out=declaration.render(p,command,requestForRenderer,p.compiled);
        if(Date.now()-renderStart>remaining)throw rendering.failure('renderer_timeout');
        if(Date.now()-started>(policy.hostDeadlineMs??Infinity)-policy.marginMs)throw rendering.failure('renderer_timeout');
        return out;
      }});
      if(rendered.error)coordination.invalidateDelivery?.(decoded.session,{reg:{record:r}});
      rendered.onDeliveryFailure=()=>{try{coordination.invalidateDelivery?.(decoded.session,{reg:{record:r}});rendering.persist(r,rendering.summary(requestForRenderer),'delivery_failed',command,p.rendering);}catch{}};
      return rendered;
    }catch(error){
      const safe=['native_event_invalid','native_event_unsupported','adapter_registration_invalid','adapter_template_mismatch','adapter_location_invalid','adapter_identity_mismatch','adapter_profile_invalid','adapter_events_incomplete','adapter_response_profile_invalid','adapter_event_unsupported','adapter_execution_failed','adapter_result_malformed','adapter_request_invalid','adapter_resource_invalid','adapter_context_event_invalid','adapter_fallback_class_invalid','adapter_scaffold_changed','adapter_incomplete','registration_unreadable','registration_revision_changed','registration_installation_mismatch','registration_source_mismatch','registration_scope_unverified','diagnostic_presentation_incomplete','diagnostic_not_found','declare_binding_incompatible','declare_payload_too_large','declare_instruction_budget_exceeded','declare_request_id_required'].includes(error.message)?error.message:'integration_contract_failure';
      if(command==='declare'&&recoveryRecord?.declare_binding){
        const stage=portableCorrelation?'result':safe==='declare_binding_incompatible'||safe==='declare_instruction_budget_exceeded'?'binding':'input';
        const recovery=portableCorrelation?'Read the owned declaration receipt and reconcile the outcome before retrying.':'Repair the indicated binding, input or decoder before submitting a declaration.';
        return {stdout:'',stderr:JSON.stringify({contract:'oop.declare.v1',stage,code:safe,correlation:portableCorrelation??null,recovery})+'\n',exit:4,error:safe};
      }
      // Recovery persistence is independent of selecting a native-event fallback.
      // The registration is verified before assigning recoveryRecord; persist also
      // enforces owned scope. Never substitute an event or copy arbitrary exceptions.
      if(recoveryRecord){
        const code=safe==='adapter_execution_failed'?'adapter_decode_failed':['native_event_invalid','native_event_unsupported'].includes(safe)?safe:'integration_contract_failure';
        const recovered=rendering.recover({record:recoveryRecord,request:{format:1,raw:null,context:{command,host},event:null,decision:'error',error:code},event:command,policy:recoveryPolicy,error:rendering.failure(code),fallback:recoveryFallback});
        return {...recovered,error:safe};
      }
      const repair=feedback.complete({type:'oop_admission',decision:'error',reason_code:safe,payload:{}}).payload.runtime_message;
      return {stdout:['entry','interaction'].includes(command)?'OOP guidance unavailable: apply the last verified routing directive or ask the user.':'',stderr:repair+'\n',exit:4,error:safe};
    }
  }
  function feedbackCases(p){
    const errors=[];
    for(const [command,natives] of Object.entries(p.supported_commands??{}))for(const [event,cases] of Object.entries(natives))for(const [decisions,output] of Object.entries(cases)){
      if(decisions==='_'||!decisions.split('|').some(d=>['allow','deny','unknown','error'].includes(d)))continue;
      const runtime=['declare','load','worklog-append','worklog-read','diagnostics-read','diagnostics-ack','diagnostics-cleanup'].includes(command);
      const sources=runtime?['response','response.runtime_message']:['response','response.payload','response.payload.runtime_message'];
      const tokens=(String(output.stdout??'')+'\n'+String(output.stderr??'')).replaceAll('{{{{','').replaceAll('}}}}','');
      const forwarded=Array.from(tokens.matchAll(/\{\{([^{}]+)\}\}/g),m=>p.placeholders?.[m[1]]).filter(field=>field&&field.mapping===undefined).map(field=>field.source);
      const forwards=forwarded.some(source=>sources.includes(source));
      if(!forwards)errors.push({code:'corrective_message_not_forwarded',location:'supported_commands.'+command+'.'+event+'.'+decisions,correction:'Forward the complete controller response or runtime-facing message for positive notices as well as corrective outcomes; delivery is not acknowledgement.'});
      if(command==='load'&&decisions.split('|').includes('allow')&&!forwarded.some(source=>source==='response'||source==='response.result')){
        errors.push({code:'load_result_not_forwarded',location:'supported_commands.'+command+'.'+event+'.'+decisions,correction:'Forward the complete load result, including any module parts and pagination metadata, through the native context channel.'});
      }
    }
    return errors;
  }
  function validateManifest(source,requirements={}){
    const checked=validateAdapter(source);if(!checked.valid)return {...checked,diagnostics:[{code:checked.reason,location:'adapter',correction:'Complete the current fixed template.'}]};
    try{const p=manifest(source),result=declaration.validate(p,requirements);
      if(result.valid)result.diagnostics.push(...feedbackCases(p));
      try{const policy=rendering.options(p.rendering);try{declarationDelivery(p,requirements.declare_binding,policy);}catch(error){result.diagnostics.push({code:error.message,location:'declare_delivery',correction:'Bind the declared callable and validate complete encoded instruction and result limits.'});}for(const [command,natives] of Object.entries(p.supported_commands??{}))if(object(natives))for(const [label,block] of Object.entries(natives))if(object(block)&&Object.hasOwn(block,'_'))try{rendering.output(block._,policy,true);}catch{result.diagnostics.push({code:'fallback_invalid',location:'supported_commands.'+command+'.'+label+'._',correction:'Declare valid bounded static output.'});}}catch{result.diagnostics.push({code:'rendering_options_invalid',location:'rendering',correction:'Use supported limits.'});}
      return {valid:result.diagnostics.length===0,reason:result.diagnostics.length?'adapter_rendering_declaration_invalid':'declared_contract_only',diagnostics:result.diagnostics};
    }catch(error){return {valid:false,reason:'adapter_rendering_declaration_invalid',diagnostics:[{code:error.message==='manifest_duplicate_key'?'manifest_duplicate_key':'manifest_not_literal_json',location:'manifest',correction:'Supply a strict JSON object.'}]};}
  }
  return {validateManifest,validateAdapter,dispatch,acquireObservations:local.acquire,template_identity:hash(template),rendering};
}
module.exports={runtimeFramework};
