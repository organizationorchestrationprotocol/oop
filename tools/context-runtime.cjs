'use strict';
// Serialized into the official controller; local integration, never policy authority.
function contextRuntime(controller, template) {
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path');
  const {createHash}=process.getBuiltinModule('node:crypto');
  const {spawnSync}=process.getBuiltinModule('node:child_process');
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const digest=x=>createHash('sha256').update(x).digest('hex');
  const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  const identifier=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(x);
  const MAX=262144;
  const codes=new Set(['unsupported_invocation','invalid_path','unsafe_path','registration_invalid','registration_missing','adapter_missing','adapter_invalid','adapter_execution_failed','manifest_invalid','native_event_invalid','placeholder_invalid','input_invalid','input_limit','input_timeout','context_unavailable','unsupported_event','invalid_event','invalid_record','unresolved_facets','bootstrap_or_inactive','local_coordination_unavailable','chat_unavailable','subject_capacity_reached','revision_capacity_reached','stale_or_invalid_transition','correlation_conflict','turn_interrupted','busy','output_invalid','delivery_failed','controller_failure','knowledge_declaration_missing','knowledge_profile_missing_declaration','knowledge_identity_mismatch','knowledge_step_incomplete','knowledge_domain_unknown','knowledge_plan_missing','knowledge_plan_invalid','knowledge_plan_unvalidated','knowledge_incorporation_pending','knowledge_index_incompatible']);
  const code=error=>codes.has(error?.message)?error.message:'controller_failure';
  function absolute(target,kind) {
    if(typeof target!=='string'||!path.isAbsolute(target)||target.length>1024||target.split(/[\\/]/).some(x=>x==='.'||x==='..'))throw Error('invalid_path');
    const resolved=path.resolve(target);
    for(let current=resolved;;current=path.dirname(current)){
      const st=fs.lstatSync(current);
      if(st.isSymbolicLink()||!same(fs.realpathSync(current),current)||current===resolved&&
        (kind==='directory'?!st.isDirectory():!st.isFile()||st.nlink!==1))throw Error('unsafe_path');
      if(current===path.dirname(current))break;
    }
    return resolved;
  }
  // Native responses are persisted as immutable session response files; the delivered context is only the reading instruction.
  function pointer(location,dependencyIdentity){
    return 'MANDATORY: Acquire the complete OOP controller response in '+location+
      ' and its identified definitions before dependent effects. Authorized acquisition and diagnostics remain permitted. Dependency '+(dependencyIdentity??'unknown')+
      ': equivalent deliveries do not restart recovery; reuse only verified available context. Use root-first acquire for bounded segments. Stop unchanged failure within declared bounds and report the limitation. It never authorizes resuming work the user stopped.';
  }
  function store(root,chat,result,eventName,errorCodes){
    try{return controller.deliver(root,chat,result,eventName,errorCodes);}
    catch(error){return {locator:error.locator??'(response storage unavailable: '+code(error)+')'};}
  }
  function errorCodes(result){
    const found=[];
    if(!['available','record_accepted','bootstrap_or_inactive'].includes(result.context.status))found.push(codes.has(result.context.status)?result.context.status:'controller_failure');
    else if(result.context.busy_phase)found.push('busy');
    if(['failed','unavailable','source_conflict'].includes(result.context.freshness?.status))found.push('controller_failure');
    if(['incomplete','conflict','unavailable'].includes(result.context.instructions?.status))found.push('context_unavailable');
    if(result.context.migration?.status==='migration_procedures_unavailable')found.push('context_unavailable');
    return found;
  }
  function directOutput(result){
    const {delivery,...output}=result;
    if(Buffer.byteLength(JSON.stringify(output))>MAX)throw Error('output_invalid');
    return output;
  }
  function loadRegistration(root){
    const file=path.join(root,'oop-context-registration.json');if(!fs.existsSync(file))throw Error('registration_missing');absolute(file,'file');
    if(fs.statSync(file).size>65536)throw Error('registration_invalid');
    const load=process.getBuiltinModule('node:module').createRequire(file);delete load.cache[load.resolve(file)];const r=load(file);
    if(r?.format!==1||r.interface!=='oop-context-1'||!identifier(r.installation_uid)||!same(absolute(r.owned_scope,'directory'),root)||
      !same(path.basename(root),r.installation_uid)||!['active','bootstrapping'].includes(r.lifecycle))throw Error('registration_invalid');
    const project=absolute(r.project_root,'directory'),relative=path.relative(path.join(project,'.priv','tools'),root);
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('registration_invalid');
    return r;
  }
  const worker="const {createRequire}=require('node:module');const fs=require('node:fs');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{try{const x=JSON.parse(s),load=createRequire(x.file);const box={exports:{}};const Module=require('node:module');Module._extensions['.js']=(mod,file)=>{const bytes=fs.readFileSync(file,'utf8');if(require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==x.identity)throw Error();mod._compile(bytes,file);};const a=load(x.file);if(!a||Object.keys(a).length!==2||typeof a.decodeEvent!=='function'||!a.manifest)throw Error();const decoded=x.enforcement?await a.decodeEvent(x.raw,x.context):null;process.stdout.write(JSON.stringify({manifest:a.manifest,decoded}));}catch{process.exitCode=4;}});";
  function loadAdapter(root,raw,registration,enforcement){
    const file=path.join(root,'oop-runtime-adapter.js');if(!fs.existsSync(file))throw Error('adapter_missing');absolute(file,'file');
    if(fs.statSync(file).size>MAX)throw Error('adapter_invalid');
    const source=fs.readFileSync(file,'utf8'),normalize=s=>s.replace(/\r\n/g,'\n');
    const mask=s=>normalize(s).replace(/(\/\/ OOP-EDIT-BEGIN (\w+))([\s\S]*?)(\/\/ OOP-EDIT-END \2)/g,(_,a,b,c,d)=>a+'\n<'+b+'>\n'+d);
    if(mask(source)!==mask(template)||source.includes('OOP_ADAPTER_NOT_IMPLEMENTED'))throw Error('adapter_invalid');
    let declared;
    try{
      const literal=source.split('// OOP-EDIT-BEGIN manifest')[1].split('// OOP-EDIT-END manifest')[0].split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
      declared=JSON.parse(literal);const stack=[];
      for(let i=0;i<literal.length;i++){
        const ch=literal[i];if(ch==='"'){let end=i+1;for(;end<literal.length;end++){if(literal[end]==='\\'){end++;continue;}if(literal[end]==='"')break;}
          const top=stack.at(-1);if(top?.keys&&top.key){const key=JSON.parse(literal.slice(i,end+1));if(top.keys.has(key))throw Error();top.keys.add(key);top.key=false;}i=end;
        }else if(ch==='{')stack.push({keys:new Set(),key:true});else if(ch==='[')stack.push({});else if(ch==='}'||ch===']')stack.pop();else if(ch===','&&stack.at(-1)?.keys)stack.at(-1).key=true;
      }
    }
    catch{throw Error('manifest_invalid');}
    validateManifest(declared);
    const child=spawnSync(process.execPath,['-e',worker],{input:JSON.stringify({file,raw,enforcement,identity:digest(source),context:{registration,command:'enforcement'}}),encoding:'utf8',timeout:2000,maxBuffer:MAX,windowsHide:true,env:{}});
    if(child.status!==0||child.error)throw Error('adapter_execution_failed');
    let result;try{result=JSON.parse(child.stdout);}catch{throw Error('adapter_execution_failed');}
    if(JSON.stringify(declared)!==JSON.stringify(result.manifest))throw Error('manifest_invalid');
    return result;
  }
  function alternatives(key){const parts=key.split('|');if(parts.some(s=>!s||s!==s.trim())||new Set(parts).size!==parts.length)throw Error('manifest_invalid');return parts;}
  function validateDelivery(delivery){
    if(!object(delivery)||typeof delivery.basis!=='string'||!delivery.basis.trim())throw Error('manifest_invalid');
    const keys=Object.keys(delivery).sort().join(',');
    if(delivery.mode==='preview'){
      if(keys!=='basis,mode,preamble,visible_prefix_bytes'||typeof delivery.preamble!=='string'||!delivery.preamble.trim()||
        !delivery.preamble.isWellFormed()||!Number.isSafeInteger(delivery.visible_prefix_bytes)||delivery.visible_prefix_bytes>MAX||
        Buffer.byteLength(delivery.preamble+'\n')>delivery.visible_prefix_bytes)throw Error('manifest_invalid');
    }else if(keys!=='basis,mode'||!['complete','separate','unavailable','none'].includes(delivery.mode))throw Error('manifest_invalid');
  }
  // UX-09/ENF-02: a turn end carries no context, so its template has no placeholder and mode none.
  function contextFree(response){
    const used=[response.stdout,response.stderr].some(text=>text.replace(/\{\{\{\{|\}\}\}\}/g,'').includes('{{'));
    if(response.context_delivery.mode!=='none'||used)throw Error('manifest_invalid');
  }
  function validateManifest(m){
    if(!object(m)||m.schema_version!==1||typeof m.host!=='string'||!m.host.trim()||typeof m.runtime_version!=='string'||!m.runtime_version.trim()||
      !Array.isArray(m.documentation)||!m.documentation.length||m.documentation.some(d=>!object(d)||!['source','section'].every(k=>typeof d[k]==='string'&&d[k].trim()))||
      typeof m.invocation_basis!=='string'||!m.invocation_basis.trim()||typeof m.continuation_basis!=='string'||!m.continuation_basis.trim()||
      !Array.isArray(m.nonblocking_exit_codes)||!m.nonblocking_exit_codes.length||m.nonblocking_exit_codes.some(c=>!Number.isInteger(c)||c<0||c>255)||
      !object(m.supported_commands)||!object(m.placeholders))throw Error('manifest_invalid');
    for(const [command,events]of Object.entries(m.supported_commands)){
      if(!['session_open','prompt','operation_entry','operation_completion','turn_stop'].includes(command)||!object(events)||!Object.keys(events).length)throw Error('manifest_invalid');
      const seen=new Set();for(const [key,response]of Object.entries(events)){
        for(const event of alternatives(key)){if(seen.has(event))throw Error('manifest_invalid');seen.add(event);}
        if(!object(response)||Object.keys(response).sort().join(',')!=='context_delivery,exit_code,stderr,stdout'||
          typeof response.stdout!=='string'||typeof response.stderr!=='string'||!m.nonblocking_exit_codes.includes(response.exit_code))throw Error('manifest_invalid');
        validateDelivery(response.context_delivery);
        if(command==='turn_stop'){contextFree(response);render(response,m,{},true);continue;}
        if(response.context_delivery.mode==='none')throw Error('manifest_invalid');
        // Every variant forwards complete context. Templates cannot discard it.
        const contextUses=[];
        for(const text of [response.stdout,response.stderr])text.replace(/\{\{\{\{|\}\}\}\}|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g,(token,name)=>{
          const p=name?m.placeholders[name]:null;
          if(p&&(['additionalContext','response.additionalContext'].includes(p.source)||p.source==='response'&&p.type==='json'&&p.encoding==='json'))contextUses.push(p);
          return token;
        });
        if(contextUses.length!==1||!contextUses[0].required||
          response.context_delivery.mode==='preview'&&contextUses[0].source==='response')throw Error('manifest_invalid');
        render(response,m,{additionalContext:'validation',response:{}},true);
      }
    }
    if(!m.supported_commands.session_open||!m.supported_commands.prompt)throw Error('manifest_invalid');
  }
  function render(spec,manifest,values,validation=false){
    if(spec.context_delivery.mode==='preview'){
      if(typeof values.additionalContext!=='string')throw Error('placeholder_invalid');
      const additionalContext=spec.context_delivery.preamble+'\n'+values.additionalContext;
      values={additionalContext,response:{...values.response,additionalContext}};
    }
    const placeholders=manifest.placeholders;
    for(const [name,p] of Object.entries(placeholders))if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)||!object(p)||
      !/^(?:additionalContext|response)(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(p.source)||p.source.split('.').some(k=>['constructor','prototype','__proto__'].includes(k))||
      !['string','number','boolean','json'].includes(p.type)||typeof p.required!=='boolean'||!['text','json','json-string'].includes(p.encoding)||
      !p.required&&typeof p.absent!=='string'||p.encoding==='text'&&p.type!=='string'||p.encoding==='json-string'&&p.type!=='string')throw Error('placeholder_invalid');
    const channel=text=>text.replace(/\{\{\{\{|\}\}\}\}|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}|\{\{|\}\}/g,(token,name)=>{
      if(token==='{{{{')return '{{';if(token==='}}}}')return '}}';if(!name||!Object.hasOwn(placeholders,name))throw Error('placeholder_invalid');
      const p=placeholders[name];let v=values;for(const part of p.source.split('.'))v=object(v)&&Object.hasOwn(v,part)?v[part]:undefined;
      if(v===undefined&&validation)v=p.type==='string'?'validation':p.type==='number'?0:p.type==='boolean'?false:{};
      if(v===undefined){if(p.required)throw Error('placeholder_invalid');return p.absent;}
      if(p.type!=='json'&&typeof v!==p.type)throw Error('placeholder_invalid');
      return p.encoding==='json'?JSON.stringify(v):p.encoding==='json-string'?JSON.stringify(v).slice(1,-1):v;
    });
    const stdout=channel(spec.stdout),stderr=channel(spec.stderr);
    if(!stdout.isWellFormed()||!stderr.isWellFormed()||Buffer.byteLength(stdout+stderr)>MAX)throw Error('output_invalid');
    return {stdout,stderr,exitCode:spec.exit_code};
  }
  function nativeValues(text,status,locator){return {additionalContext:text,response:{additionalContext:text,status,locator}};}
  async function execute(args,input,failure){
    let root,registration,selected,manifest,command,chat,eventName;const rawArgs=args;
    try{
      if(typeof args[0]==='string')root=absolute(args[0],'directory');
      if(!root)throw Error('unsupported_invocation');
      registration=loadRegistration(root);
      // Load both mandatory root components even for direct commands.
      const loaded=loadAdapter(root,null,registration,false);manifest=loaded.manifest;
      if(args.length!==2||!['enforcement','session_open','prompt','record','snapshot','acquire'].includes(args[1]))throw Error('unsupported_invocation');
      command=args[1];
      if(failure)throw Error(failure);
      if(typeof input!=='string'||Buffer.byteLength(input)>65536)throw Error('input_limit');
      let raw;try{raw=JSON.parse(input);}catch{throw Error('input_invalid');}
      let event=raw;
      if(command==='enforcement'){
        const decoded=loadAdapter(root,raw,registration,true).decoded;
        if(!object(decoded)||Object.keys(decoded).some(k=>!['native_event','event'].includes(k))||typeof decoded.native_event!=='string'||decoded.native_event.includes('|')||
          !object(decoded.event)||!['session_open','prompt','operation_entry','operation_completion','turn_stop'].includes(decoded.event.event))throw Error('native_event_invalid');
        if(identifier(decoded.event.chat))chat=decoded.event.chat;eventName=decoded.event.event;
        const entries=Object.entries(manifest.supported_commands[decoded.event.event]??{});
        selected=entries.find(([key])=>alternatives(key).includes(decoded.native_event))?.[1];
        if(!selected)throw Error('native_event_invalid');event=decoded.event;
      }else if(!object(raw)||raw.event!==command)throw Error('input_invalid');
      if(command==='acquire'){
        const result=controller.acquire(root,event);
        return {stdout:JSON.stringify(result)+'\n',stderr:'',exitCode:['partial','complete'].includes(result.status)?0:1};
      }
      const result=controller.compose(registration,event);
      if(selected&&eventName==='turn_stop'){
        // UX-09: the stop is recorded; the declared context-free template is emitted unchanged.
        store(root,chat,result,eventName,errorCodes(result));
        return render(selected,manifest,{});
      }
      if(selected){
        const {locator,dependency_identity}=store(root,chat,result,eventName,errorCodes(result)),text=pointer(locator,dependency_identity);
        return render(selected,manifest,nativeValues(text,result.context.status,locator));
      }
      return {stdout:JSON.stringify(directOutput(result))+'\n',stderr:'',exitCode:command==='record'?(result.context.status==='record_accepted'?0:1):result.context.status==='available'?0:1};
    }catch(error){
      const failed=code(error),result=controller.response({status:'context_unavailable',state:'intake',history:[],freshness:{status:'unavailable'},
        diagnostic:{code:failed,remedy:'Inspect the owned registration, root adapter and session store under current repair authority; present this diagnostic and continue independent authorized work.'},
        busy_phase:failed==='busy'?error.cause:undefined});
      // ENF-02/UX-09: only a decoded session opening or prompt receives context. A turn end or an
      // undecoded native event receives none; its stored outcome is disclosed at the next delivery.
      const silent={stdout:'',stderr:'',exitCode:0};
      if(root&&(command==='enforcement'||rawArgs[1]==='enforcement')){
        const {locator,dependency_identity}=store(root,chat,result,eventName,[failed]);
        if(selected&&eventName==='turn_stop')try{return render(selected,manifest,{});}catch{return silent;}
        if(selected)try{return render(selected,manifest,nativeValues(pointer(locator,dependency_identity),result.context.status,locator));}catch{/* No guessed native response or event. */}
        return silent;
      }
      if(rawArgs[1]==='enforcement')return {...silent,stderr:JSON.stringify({code:failed})+'\n'};
      return {stdout:JSON.stringify(directOutput(result))+'\n',stderr:JSON.stringify({code:failed})+'\n',exitCode:1};
    }
  }
  return {execute,validateManifest,render,absolute,pointer};
}
module.exports={contextRuntime};
