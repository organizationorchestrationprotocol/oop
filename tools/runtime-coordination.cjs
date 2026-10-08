'use strict';
const {runtimeAction}=require('./runtime-action.cjs');
// Producer reference implementation of PROTOCOL.md R27 and the machine-local lease and
// coordination-log rules, serialized into the official controller. Locators and facts come
// from the verified adapter registration record (R21.10) or, before it exists, from the trusted
// adapter as privileged observations; declarations are runtime claims only. Writes are confined
// to the owned session state, common leases, common coordination log and, with a verified
// registration, the rendered shared instruction copy.
function runtimeCoordination(baseDir) {
  // Built-in lookup works in copied CommonJS and ES module package contexts alike.
  const fs=process.getBuiltinModule('node:fs'), nodePath=process.getBuiltinModule('node:path'), crypto=process.getBuiltinModule('node:crypto');
  baseDir=baseDir??nodePath.dirname(nodePath.resolve(process.argv[1]??'.'));
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const text=(x,max=512)=>typeof x==='string'&&x.length>0&&x.length<=max&&x===x.trim();
  const sha=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
  const actionTypes=runtimeAction();
  const LEVELS=['G0','G1','G2','G3','G4'], MANAGED=['G2','G3','G4'];
  const STATES=['uninitialized','bootstrapping','idle','classifying','working','context_stale','syncing','maintenance','recovering','degraded'];
  const LIFECYCLE=['bootstrapping','syncing','degraded','recovering','idle'];
  const TERMINAL=['closed','cancelled','superseded'];
  const KINDS=['step','observation','message','handoff_note','resolution'];
  const CONTEXT_EVENTS=['start','resume','compact','restore','context_loss'];
  const STALE_EVENTS=['compact','restore','context_loss'];
  const COORDINATION_COMMANDS=['declare','load','worklog-append','worklog-read'];
  const SECRET=/-----BEGIN [A-Z ]*PRIVATE KEY|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bsk-[A-Za-z0-9_-]{20,}/;
  const sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
  const uuid=()=>crypto.randomUUID();
  const MESSAGE_BYTES=512, STATUS_BYTES=256, HISTORY=200, INSTRUCTION_BYTES=4096, DECLARE_BYTES=512;
  const REGISTRATION='oop-runtime-adapter-registration.json', RENDERED='runtime-instructions.rendered.md';
  const SCOPES=['current_project','organization','external'];
  const REASONS=['none','level_requirement','shared_policy','user_request','continuation','continuity_need'];
  const MATERIALITY=['reversibility','externality','blast_radius','financial','security','organizational','privilege','uncertainty','authorization','persistence','third_party','operational_criticality'];
  const RELATIONS=['continuation','clarification','correction','scope_change','cancellation','replacement'];
  const PHASES=['inquiry','analysis','planning','action','verification'];
  const IDENTITY=/^sha256:[a-f0-9]{64}$/;
  const bytes=s=>Buffer.byteLength(s,'utf8');
  function clip(s,max){if(bytes(s)<=max)return s;let out=s;while(bytes(out+'...')>max)out=out.slice(0,-1);return out+'...';}
  const absolute=p=>typeof p==='string'&&p.length>0&&p.length<=1024&&nodePath.isAbsolute(p)&&!p.includes('\0')&&!p.replaceAll('\\','/').split('/').some(s=>s==='.'||s==='..');
  const normalize=p=>nodePath.resolve(p).replaceAll('\\','/').replace(/\/+$/,'');

  // Adapter registration record (R21.10): trusted only after identity, scope and real-path observation.
  const REGISTRATION_KEYS=['format','record_type','revision','installation_uid','runtime_class','machine_id','controller_locator','controller_source_identity',
    'interpreter_locator','project_root','private_root','owned_scope','common_scope','filesystem_local','filesystem_case_sensitive','mode','recap_threshold','lease_seconds',
    'runtime_adapter','protected_configuration_paths','policy_deny','governed_stores','instruction_sources','runtime_invocation','observed_at'];
  function validRegistration(r){
    return object(r)&&Object.keys(r).every(k=>REGISTRATION_KEYS.includes(k))&&r.format===1&&r.record_type==='oop_runtime_adapter_registration'&&text(r.revision,128)&&
      text(r.installation_uid,256)&&text(r.runtime_class,256)&&text(r.machine_id,256)&&IDENTITY.test(r.controller_source_identity??'')&&
      ['controller_locator','interpreter_locator','project_root','private_root','owned_scope','common_scope'].every(k=>absolute(r[k]))&&
      typeof r.filesystem_local==='boolean'&&typeof r.filesystem_case_sensitive==='boolean'&&['advisory','enforcing'].includes(r.mode)&&
      Number.isInteger(r.recap_threshold)&&r.recap_threshold>=1&&r.recap_threshold<=1000&&
      (r.lease_seconds===undefined||(Number.isInteger(r.lease_seconds)&&r.lease_seconds>=1&&r.lease_seconds<=3600))&&
      (r.policy_deny===undefined||(Array.isArray(r.policy_deny)&&r.policy_deny.every(x=>text(x,64))))&&
      (r.protected_configuration_paths===undefined||(Array.isArray(r.protected_configuration_paths)&&r.protected_configuration_paths.length<=64&&r.protected_configuration_paths.every(absolute)))&&
      Array.isArray(r.governed_stores)&&r.governed_stores.length<=64&&r.governed_stores.every(s=>object(s)&&Object.keys(s).length===2&&['operations','work_items'].includes(s.kind)&&absolute(s.locator))&&
      object(r.instruction_sources)&&Object.keys(r.instruction_sources).length===2&&['organization','workspace'].every(k=>r.instruction_sources[k]===null||absolute(r.instruction_sources[k]))&&
      Array.isArray(r.runtime_invocation)&&r.runtime_invocation.length>0&&r.runtime_invocation.length<=64&&r.runtime_invocation.every(a=>typeof a==='string'&&a.length<=4096)&&
      r.runtime_invocation.includes('<command>')&&r.runtime_invocation.every(a=>a==='<command>'||!/<[A-Za-z][A-Za-z0-9_-]*>/.test(a))&&Number.isFinite(Date.parse(r.observed_at));
  }
  // An existing path must resolve to itself; a missing path is judged by its nearest existing ancestor.
  function aliasFree(p,key){
    let current=p;
    for(let depth=0;depth<256;depth++){
      try{return key(normalize(fs.realpathSync.native(current)))===key(current);}
      catch(e){if(e.code!=='ENOENT')return false;const up=normalize(nodePath.dirname(current));if(up===current)return false;current=up;}
    }
    return false;
  }
  function registration(spec,sourceIdentity){
    const fail=reason=>({ok:false,reason});
    try{
      if(!object(spec)||!absolute(spec.path)||!IDENTITY.test(spec.identity??''))return fail('registration_arguments_invalid');
      let raw;try{raw=fs.readFileSync(spec.path);}catch{return fail('registration_unreadable');}
      if(sha(raw)!==spec.identity)return fail('registration_identity_mismatch');
      let r;try{r=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{return fail('registration_invalid');}
      if(!validRegistration(r))return fail('registration_invalid');
      if(r.controller_source_identity!==sourceIdentity)return fail('registration_source_mismatch');
      const key=p=>r.filesystem_case_sensitive?p:p.toLowerCase(), within=(p,root)=>key(p)===key(root)||key(p).startsWith(key(root)+'/');
      const owned=normalize(r.owned_scope),priv=normalize(r.private_root),common=normalize(r.common_scope);
      if(!owned.split('/').includes(encodeURIComponent(r.installation_uid))||within(owned,common)||!within(owned,priv)||!within(common,priv))return fail('registration_scope_unverified');
      for(const p of [r.project_root,r.private_root,r.owned_scope,r.common_scope,...r.governed_stores.map(s=>s.locator)])if(!aliasFree(normalize(p),key))return fail('registration_path_alias');
      let real;try{real=normalize(fs.realpathSync.native(spec.path));}catch{return fail('registration_unreadable');}
      if(!within(real,owned)||key(real)===key(owned))return fail('registration_scope_unverified');
      return {ok:true,record:r,path:spec.path,identity:spec.identity};
    }catch{return fail('registration_unverified');}
  }

  // Privileged adapter facts. Missing or unverified facts disable state and coordination.
  function resolveFacts(c,observedAt){
    if(!object(c))return {ok:false,reason:'coordination_facts_missing'};
    if(c.paths_resolved_without_aliases!==true||c.scope_ownership_verified!==true)return {ok:false,reason:'coordination_facts_unverified'};
    const f=buildFacts(c,observedAt);
    if(!f.ok)return f;
    // R21.10: once a registration record exists, the parameter form is no longer accepted.
    if(fs.existsSync(nodePath.join(f.owned,REGISTRATION)))return {ok:false,reason:'registration_required'};
    return f;
  }
  function registrationFacts(reg,c,observedAt){
    if(!object(c)||!text(c.session,1024))return {ok:false,reason:'coordination_facts_missing'};
    const r=reg.record;
    const f=buildFacts({project_root:r.project_root,private_root:r.private_root,owned_scope_locator:r.owned_scope,common_scope_locator:r.common_scope,
      session:c.session,installation_uid:r.installation_uid,runtime_class:r.runtime_class,filesystem_local:r.filesystem_local,filesystem_case_sensitive:r.filesystem_case_sensitive,
      mode:r.mode,policy_deny:r.policy_deny,lease_seconds:r.lease_seconds,recap_threshold:r.recap_threshold,context_event:c.context_event},observedAt);
    if(!f.ok)return f;
    f.registered=true;f.stores=r.governed_stores.map(s=>({kind:s.kind,root:f.norm(s.locator)}));
    f.sources={organization:r.instruction_sources.organization,workspace:r.instruction_sources.workspace};f.invocation=r.runtime_invocation;
    return f;
  }
  function buildFacts(c,observedAt){
    const keys=['project_root','private_root','owned_scope_locator','common_scope_locator','session','installation_uid','runtime_class'];
    if(!keys.every(k=>text(c[k],1024))||
      typeof c.filesystem_local!=='boolean'||typeof c.filesystem_case_sensitive!=='boolean'||
      !['advisory','enforcing'].includes(c.mode??'advisory')||(c.context_event!==undefined&&!CONTEXT_EVENTS.includes(c.context_event))||
      (c.policy_deny!==undefined&&(!Array.isArray(c.policy_deny)||!c.policy_deny.every(x=>text(x,64))))||
      (c.lease_seconds!==undefined&&!(Number.isInteger(c.lease_seconds)&&c.lease_seconds>=1&&c.lease_seconds<=3600))||
      (c.recap_threshold!==undefined&&!(Number.isInteger(c.recap_threshold)&&c.recap_threshold>=1&&c.recap_threshold<=1000))||
      !Number.isFinite(Date.parse(observedAt)))return {ok:false,reason:'coordination_facts_unverified'};
    const abs=p=>nodePath.isAbsolute(p)&&!p.includes('\0')&&!p.replaceAll('\\','/').split('/').some(s=>s==='.'||s==='..');
    if(!['project_root','private_root','owned_scope_locator','common_scope_locator'].every(k=>abs(c[k])))return {ok:false,reason:'coordination_facts_unverified'};
    const norm=p=>nodePath.resolve(p).replaceAll('\\','/').replace(/\/+$/,'');
    const key=p=>c.filesystem_case_sensitive?p:p.toLowerCase();
    const within=(p,root)=>key(p)===key(root)||key(p).startsWith(key(root)+'/');
    const f={project:norm(c.project_root),private:norm(c.private_root),owned:norm(c.owned_scope_locator),common:norm(c.common_scope_locator),
      session:c.session,uid:c.installation_uid,runtime:c.runtime_class,local:c.filesystem_local,mode:c.mode??'advisory',
      deny:['resource_leased','effect_with_stale_context','work_item_for_external_subject','effect_without_current_instructions',...(c.policy_deny??[])],
      leaseMs:(c.lease_seconds??300)*1000,recap:c.recap_threshold??18,
      event:c.context_event,now:new Date(Date.parse(observedAt)).toISOString(),key,within,norm,registered:false,stores:[],sources:{organization:null,workspace:null},invocation:null};
    if(!f.owned.split('/').includes(encodeURIComponent(f.uid))||within(f.owned,f.common)||!within(f.owned,f.private)||!within(f.common,f.private))
      return {ok:false,reason:'coordination_scope_unverified'};
    f.ok=true;return f;
  }
  const segment=id=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)&&!/^\.+$/.test(id)?id:'h-'+sha(id).slice(7,31);
  const statePath=f=>nodePath.join(f.owned,'sessions',segment(f.session),'state.json');
  const leaseDir=f=>nodePath.join(f.common,'leases');
  const logDir=(f,item)=>nodePath.join(f.common,'worklog',segment(item));

  function readJson(p){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  function createExclusive(p,content){fs.mkdirSync(nodePath.dirname(p),{recursive:true});const fd=fs.openSync(p,'wx');try{fs.writeSync(fd,content);}finally{fs.closeSync(fd);}}
  // Serialized local read-modify-write. Age never proves owner termination.
  // An orphan remains busy until authorized recovery establishes that no owner
  // can resume; automatic time-based takeover cannot provide that guarantee.
  function withLock(p,fn){
    const lock=p+'.lock';fs.mkdirSync(nodePath.dirname(p),{recursive:true});
    const token=JSON.stringify({pid:process.pid,owner:uuid()});
    for(let attempt=0;attempt<200;attempt++){
      try{createExclusive(lock,token);}catch(e){
        if(e.code!=='EEXIST')throw e;
        sleep(10);continue;
      }
      try{return fn();}finally{try{if(fs.readFileSync(lock,'utf8')===token)fs.unlinkSync(lock);}catch{}}
    }
    throw Object.assign(Error('lock_busy'),{code:'lock_busy'});
  }
  function safeList(d){try{return fs.readdirSync(d);}catch{return [];}}
  function freshState(f){return {format:1,record_type:'oop_runtime_session_state',installation_uid:f.uid,session:f.session,state:'idle',previous_state:null,
    transition_event:'created',transition_time:f.now,work_item:null,work_item_state:null,governance_level:null,declared_facets:[],declared_resources:[],
    needs_clarification:false,index_identity_delivered:null,exchange_count:0,context_integrity:'unknown',basis:null,
    instructions_identity_delivered:null,instructions_identity_declared:null,instructions_assurance:'none',instructions_completeness:'unknown',reads:{},seen:{},history:[]};}

  // Shared runtime instructions: deterministic composition of the referenced layers; never authority by itself.
  const RECORD_KEYS=['format','record_type','id','layer','status','title','text','applies_to','canonical_ref','effect','refines','authority','author_runtime','created_at','supersedes'];
  const bounded=(x,max)=>typeof x==='string'&&x.trim().length>0&&bytes(x)<=max;
  function validInstruction(r,layer){
    return object(r)&&Object.keys(r).every(k=>RECORD_KEYS.includes(k))&&r.format===1&&r.record_type==='oop_runtime_instruction'&&
      typeof r.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(r.id)&&r.layer===layer&&['active','superseded','revoked'].includes(r.status)&&
      bounded(r.title,120)&&bounded(r.text,2000)&&bounded(r.applies_to,400)&&['adds','strengthens'].includes(r.effect)&&
      (r.effect==='strengthens')===(r.refines!==undefined)&&(r.refines===undefined||text(r.refines,256))&&
      object(r.authority)&&Object.keys(r.authority).length===3&&['granted_by','evidence_ref','granted_at'].every(k=>text(r.authority[k],512))&&
      text(r.author_runtime,256)&&Number.isFinite(Date.parse(r.created_at))&&Array.isArray(r.supersedes)&&r.supersedes.every(x=>text(x,64))&&
      (layer==='organization'?text(r.canonical_ref,1024):r.canonical_ref===undefined);
  }
  // Four discovery states; an unreadable or uninterpretable layer is incomplete, never empty.
  function readLayer(locator){
    if(locator===null||locator===undefined)return {state:'not_referenced',records:[]};
    let st;try{st=fs.statSync(locator);}catch(e){return {state:e.code==='ENOENT'||e.code==='ENOTDIR'?'confirmed_absent':'inaccessible',records:[]};}
    try{
      if(st.isDirectory())return {state:'found',records:fs.readdirSync(locator).filter(n=>n.endsWith('.json')).sort().map(n=>{
        try{return JSON.parse(fs.readFileSync(nodePath.join(locator,n),'utf8'));}catch{return {invalid_file:n};}})};
      if(!st.isFile())return {state:'unknown',records:[]};
      const data=JSON.parse(fs.readFileSync(locator,'utf8'));
      return Array.isArray(data)?{state:'found',records:data}:{state:'unknown',records:[]};
    }catch(e){return {state:e instanceof SyntaxError?'unknown':'inaccessible',records:[]};}
  }
  // Layer locations come from verified facts or, without a session, from the verified registration record itself.
  function layout(f,ctx){
    if(f?.ok)return {sources:f.sources,stores:f.stores,norm:f.norm,within:f.within};
    const r=ctx?.reg?.record;if(!r)return null;
    const key=p=>r.filesystem_case_sensitive?p:p.toLowerCase();
    return {sources:r.instruction_sources,stores:r.governed_stores.map(s=>({kind:s.kind,root:normalize(s.locator)})),norm:normalize,
      within:(p,root)=>key(p)===key(root)||key(p).startsWith(key(root)+'/')};
  }
  function composeInstructions(f,ctx){
    const place=layout(f,ctx),sources=place?.sources??{organization:null,workspace:null};
    const layers={organization:readLayer(sources.organization),workspace:readLayer(sources.workspace)};
    const operations=place?.stores.find(s=>s.kind==='operations')?.root;
    const contracts=new Set(ctx?.contractIds??[]),conflicts=[],accepted={organization:[],workspace:[]};
    const canonical=ref=>{if(!operations)return false;const target=place.norm(nodePath.resolve(operations,ref));return place.within(target,operations)&&target!==operations&&fs.existsSync(target);};
    for(const layer of ['organization','workspace']){
      const valid=[];
      for(const r of layers[layer].records){if(validInstruction(r,layer))valid.push(r);else conflicts.push(object(r)&&typeof r.id==='string'&&r.id.length<=64?r.id:'invalid-record');}
      const count={};for(const r of valid)count[r.id]=(count[r.id]??0)+1;
      for(const r of valid){
        if(count[r.id]>1){conflicts.push(r.id);continue;}
        if(r.status!=='active')continue;
        if(layer==='organization'&&!canonical(r.canonical_ref)){conflicts.push(r.id);continue;}
        accepted[layer].push(r);
      }
    }
    accepted.organization=accepted.organization.filter(r=>r.effect!=='strengthens'||contracts.has(r.refines)||(conflicts.push(r.id),false));
    const policies=new Set(accepted.organization.map(r=>r.id));
    accepted.workspace=accepted.workspace.filter(r=>r.effect!=='strengthens'||contracts.has(r.refines)||policies.has(r.refines)||(conflicts.push(r.id),false));
    const states={organization:layers.organization.state,workspace:layers.workspace.state};
    const incomplete=['organization','workspace'].filter(l=>['inaccessible','unknown'].includes(states[l]));
    const clean=s=>s.replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/,'')).join('\n').replace(/\n+$/,'');
    const lines=['OOP distribution: '+(ctx?.sourceIdentity??'unknown'),...incomplete.map(l=>'OOP instructions: incomplete, '+l+' '+states[l])];
    for(const layer of ['organization','workspace'])for(const r of [...accepted[layer]].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
      lines.push('['+r.id+'] '+clean(r.title),clean(r.text),'Applies to: '+clean(r.applies_to));
      if(layer==='organization')lines.push('Canonical: '+clean(r.canonical_ref));
    }
    const rendered=lines.join('\n')+'\n',identity=sha(rendered);
    // The governing set retains its own identity; Markdown is a disposable view.
    const escape=s=>clean(s).replace(/[\\`*_[\]<>#|]/g,'\\$&');
    const md=['# Runtime instructions','','<!-- instructions_identity: '+identity+'; format: markdown -->','',
      '**OOP distribution:** '+escape(ctx?.sourceIdentity??'unknown'),''];
    for(const layer of ['organization','workspace']){
      md.push('## '+(layer==='organization'?'Organization':'Workspace'),'');
      if(incomplete.includes(layer))md.push('> Instructions unavailable: '+states[layer]+'.','');
      const records=[...accepted[layer]].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      if(!records.length&&!incomplete.includes(layer))md.push('_No active instructions._','');
      for(const r of records){
        md.push('### '+escape(r.id)+' — '+escape(r.title),'',clean(r.text),'',
          '**Applies to:** '+escape(r.applies_to),'');
        if(layer==='organization')md.push('**Canonical:** '+escape(r.canonical_ref),'');
      }
    }
    const markdown=md.join('\n').replace(/\n+$/,'')+'\n';
    return {text:rendered,identity,markdown,complete:!incomplete.length,organization_complete:!incomplete.includes('organization'),
      layers:states,conflicts:[...new Set(conflicts)].sort(),policies};
  }
  // Derived read-only copy for hosts that cannot inject text; rewritten only on identity change.
  function writeRendered(f,set){
    if(!f?.ok||!f.registered)return;
    const p=nodePath.join(f.common,RENDERED),content=set.markdown;
    // Compare real bytes: a matching identity comment cannot hide corruption or stale formatting.
    try{if(fs.readFileSync(p,'utf8')===content)return;}catch{}
    const tmp=p+'.'+uuid()+'.tmp';createExclusive(tmp,content);fs.renameSync(tmp,p);
  }
  function instructionBlock(f,set){
    const notices=[...set.conflicts.map(id=>'instruction_conflict '+id),...['organization','workspace'].filter(l=>['inaccessible','unknown'].includes(set.layers[l])).map(l=>'instructions_layer_unavailable '+l)];
    const head=notices.length?'OOP notice: '+notices.join(', ')+'.\n':'';
    if(bytes(set.text)>INSTRUCTION_BYTES)return head+'OOP instructions: identity '+set.identity+', copy '+(f?.ok&&f.registered?nodePath.join(f.common,RENDERED):'unavailable')+
      '\nOOP instructions: exceed budget, load them with the load command, scope "instructions"';
    return head+'OOP INSTRUCTIONS (shared runtime instruction set '+set.identity+'):\n'+set.text.replace(/\n$/,'');
  }
  function declareLine(f){
    if(!f?.ok||!f.registered)return 'OOP declare: unavailable (no adapter registration)';
    const line='OOP declare: '+JSON.stringify(f.invocation.map(a=>a==='<command>'?'declare':a))+' ; stdin = {"session":'+JSON.stringify(f.session)+', ...declaration fields}';
    return bytes(line)<=DECLARE_BYTES?line:'OOP declare: unavailable (invocation exceeds budget)';
  }
  function assurance(st,set){
    return st.instructions_identity_delivered===set.identity?'delivered':st.instructions_identity_declared===set.identity?'declared_only':'none';
  }
  const BASIS_KEYS=['governed_mutation','subject_scope','materiality','work_item_reason','policy_ref','continuation_ref','continuity_rationale'];
  function validBasis(b){
    if(!object(b)||Object.keys(b).some(k=>!BASIS_KEYS.includes(k))||typeof b.governed_mutation!=='boolean'||!SCOPES.includes(b.subject_scope)||!REASONS.includes(b.work_item_reason))return null;
    if(b.materiality!==undefined&&(!Array.isArray(b.materiality)||!b.materiality.every(x=>MATERIALITY.includes(x))||new Set(b.materiality).size!==b.materiality.length))return null;
    if((b.work_item_reason==='shared_policy')!==(b.policy_ref!==undefined)||(b.policy_ref!==undefined&&!text(b.policy_ref,64)))return null;
    if((b.work_item_reason==='continuation')!==(b.continuation_ref!==undefined)||(b.continuation_ref!==undefined&&!text(b.continuation_ref,256)))return null;
    if((b.work_item_reason==='continuity_need')!==(b.continuity_rationale!==undefined)||(b.continuity_rationale!==undefined&&!bounded(b.continuity_rationale,240)))return null;
    return {...b,materiality:b.materiality??[]};
  }
  // Coherence rules C1-C7 (R27.3): the first failing rule is the rejection reason.
  function coherence(b,level,item,set){
    if(!b.governed_mutation&&level!=='G0')return 'level_inconsistent_with_basis';
    if(b.governed_mutation&&level==='G0')return 'level_inconsistent_with_basis';
    if(item&&b.work_item_reason==='none')return 'work_item_without_justification';
    if(b.work_item_reason==='level_requirement'&&!MANAGED.includes(level))return 'work_item_without_justification';
    if(!b.governed_mutation&&b.work_item_reason==='shared_policy')return 'work_item_without_justification';
    if(b.subject_scope==='external'&&(item||b.work_item_reason!=='none'))return 'work_item_for_external_subject';
    if(b.work_item_reason==='shared_policy'&&!(set.organization_complete&&set.policies.has(b.policy_ref)))return 'policy_reference_unresolved';
    if(b.work_item_reason==='continuation'&&(!item||item.id!==b.continuation_ref))return 'continuation_unresolved';
    return null;
  }
  function move(st,to,event,now){
    if(!STATES.includes(to))throw Error('invalid state');
    if(st.state!==to){st.history.push({from:st.state,event,to,at:now});if(st.history.length>HISTORY)st.history.splice(0,st.history.length-HISTORY);
      st.previous_state=st.state;st.state=to;st.transition_event=event;st.transition_time=now;}
  }
  function update(f,fn){
    const p=statePath(f);
    return withLock(p,()=>{const current=readJson(p),st=current??freshState(f),before=JSON.stringify(st);const out=fn(st);
      if(!current||JSON.stringify(st)!==before){st.revision=(Number.isSafeInteger(st.revision)?st.revision:0)+1;
        const tmp=p+'.'+uuid()+'.tmp';createExclusive(tmp,JSON.stringify(st)+'\n');fs.renameSync(tmp,p);}
      return out===undefined?st:out;});
  }
  function clearDeclaration(st){st.governance_level=null;st.declared_facets=[];st.declared_resources=[];st.needs_clarification=false;st.basis=null;}

  // Optional semantic cache. Every supplied fact remains an attributed claim;
  // independently acquired admission evidence is held outside this projection.
  function validGuidance(g){
    const safe=(v,max=512)=>text(v,max)&&!/[\x00-\x1f\x7f]/.test(v)&&!SECRET.test(v);
    if(!object(g)||Object.keys(g).some(k=>!['relation','phase','objective_ref','scope_ref','authority_ref','next_check','facts','blocker','invalidated'].includes(k))||
      !RELATIONS.includes(g.relation)||!PHASES.includes(g.phase)||!safe(g.objective_ref)||bytes(JSON.stringify(g))>4096)return false;
    for(const k of ['scope_ref','authority_ref','next_check'])if(g[k]!==undefined&&!safe(g[k]))return false;
    if(g.invalidated!==undefined&&(!Array.isArray(g.invalidated)||g.invalidated.length>16||!g.invalidated.every(x=>safe(x))))return false;
    if(g.facts!==undefined&&(!Array.isArray(g.facts)||g.facts.length>16||!g.facts.every(x=>object(x)&&
      Object.keys(x).every(k=>['ref','kind','provenance','invalidates_on','dependencies'].includes(k))&&['observation','interpretation','assumption'].includes(x.kind)&&
      ['ref','provenance','invalidates_on'].every(k=>safe(x[k]))&&Array.isArray(x.dependencies)&&x.dependencies.length<=16&&x.dependencies.every(d=>safe(d)))))return false;
    if(g.blocker!==undefined&&(!object(g.blocker)||Object.keys(g.blocker).length!==6||
      !['prevented_action','dependency','responsible','unblock_condition','resume_action','independent_work'].every(k=>safe(g.blocker[k]))))return false;
    return true;
  }
  function projectGuidance(st,g,f){
    const prior=st.semantic_guidance,changed=['correction','scope_change','replacement','cancellation'].includes(g.relation)||
      !!prior&&['objective_ref','scope_ref','authority_ref'].some(k=>g[k]!==prior[k]);
    const invalidated=new Set(g.invalidated??[]),facts=(g.facts??prior?.facts??[]).map(x=>({...x,assurance:'runtime_claim',status:x.status??'unverified'}));
    // Invalidate the transitive dependent projection, retaining unrelated facts.
    let progress=true;while(progress){progress=false;for(const fact of facts)if(!invalidated.has(fact.ref)&&fact.dependencies.some(d=>invalidated.has(d))){invalidated.add(fact.ref);progress=true;}}
    for(const fact of facts)if(invalidated.has(fact.ref))fact.status='stale';
    st.semantic_guidance={...g,facts,invalidated:[...invalidated],origin:'runtime_declaration',installation_uid:f.uid,session:f.session,
      declared_at:f.now,interaction:st.exchange_count,requires_reclassification:changed};
    st.guidance_pending=false;
    st.history.push({from:st.state,event:'declare_guidance',to:st.state,at:f.now});if(st.history.length>HISTORY)st.history.splice(0,st.history.length-HISTORY);
  }

  // Leases: exclusive create; extension/takeover/release via tombstone rename plus identity check.
  function leaseFile(f,resource){return nodePath.join(leaseDir(f),sha(f.key(resource)).slice(7)+'.json');}
  function replaceLease(file,observedRaw,successor){
    const tomb=file+'.'+uuid()+'.tomb';
    try{fs.renameSync(file,tomb);}catch(e){if(e.code==='ENOENT')return 'moved';throw e;}
    const raw=fs.readFileSync(tomb,'utf8');
    if(sha(raw)!==sha(observedRaw)){try{fs.linkSync(tomb,file);}catch{}fs.unlinkSync(tomb);return 'changed';}
    if(successor){try{createExclusive(file,successor);}catch(e){fs.unlinkSync(tomb);if(e.code==='EEXIST')return 'raced';throw e;}}
    fs.unlinkSync(tomb);return 'ok';
  }
  function leaseRecord(f,resource,item,now){const t=Date.parse(now);return JSON.stringify({format:1,record_type:'oop_machine_local_lease',resource,
    holder:{installation_uid:f.uid,session:f.session},work_item:item??null,acquired:new Date(t).toISOString(),expires:new Date(t+f.leaseMs).toISOString()})+'\n';}
  function acquireLease(f,resource,item){
    if(!f.local)return {status:'unprotected'};
    const file=leaseFile(f,resource);
    for(let attempt=0;attempt<3;attempt++){
      try{createExclusive(file,leaseRecord(f,resource,item,f.now));return {status:'acquired'};}catch(e){if(e.code!=='EEXIST')throw e;}
      let raw;try{raw=fs.readFileSync(file,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
      let lease;try{lease=JSON.parse(raw);}catch{return {status:'leased',holder:'unknown',work_item:null,expires:'unknown'};}
      const own=lease.holder?.installation_uid===f.uid&&lease.holder?.session===f.session;
      const expired=!(Date.parse(lease.expires)>Date.parse(f.now));
      if(!own&&!expired)return {status:'leased',holder:lease.holder?.installation_uid??'unknown',work_item:lease.work_item??null,expires:lease.expires};
      const outcome=replaceLease(file,raw,leaseRecord(f,resource,own?(item??lease.work_item):item,f.now));
      if(outcome==='ok')return {status:own?'extended':'taken_over',previous:own?null:lease};
    }
    return {status:'leased',holder:'unknown',work_item:null,expires:'unknown'};
  }
  function releaseLeases(f,predicate){
    let released=0;const dir=leaseDir(f);
    for(const name of safeList(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
      const file=nodePath.join(dir,name);let raw;try{raw=fs.readFileSync(file,'utf8');}catch{continue;}
      let lease;try{lease=JSON.parse(raw);}catch{continue;}
      if(predicate(lease)&&replaceLease(file,raw,null)==='ok')released++;
    }
    return released;
  }

  // Coordination log: one immutable exclusively created record per entry, organized by work item.
  function appendEntry(f,entry){
    const id=uuid(),record={id,work_item:entry.work_item,author:{installation_uid:f.uid,runtime:f.runtime},time:f.now,kind:entry.kind,text:entry.text,
      ...(entry.to?{to:entry.to}:{}),...(entry.resources?{resources:entry.resources}:{}),...(entry.evidence?{evidence:entry.evidence}:{}),...(entry.supersedes?{supersedes:entry.supersedes}:{})};
    createExclusive(nodePath.join(logDir(f,entry.work_item),f.now.replace(/[:.]/g,'-')+'-'+id+'.json'),JSON.stringify(record)+'\n');
    return record;
  }
  function readEntries(f,item){
    const dir=logDir(f,item),out=[];
    for(const name of safeList(dir).filter(n=>n.endsWith('.json'))){const r=readJson(nodePath.join(dir,name));if(object(r)&&r.work_item===item)out.push(r);}
    return out.sort((a,b)=>a.time<b.time?-1:a.time>b.time?1:a.id<b.id?-1:1);
  }
  function unread(f,st){if(!st.work_item)return 0;const seen=new Set(st.seen[st.work_item.id]??[]);return readEntries(f,st.work_item.id).filter(e=>e.to===f.uid&&!seen.has(e.id)).length;}

  function identityOf(f,abs){try{const st=fs.statSync(abs);if(!st.isFile())return 'not_a_file';if(st.size>16*1024*1024)return 'unhashed';return sha(fs.readFileSync(abs));}catch(e){return e.code==='ENOENT'?'absent':'unreadable';}}
  function nextAction(st){
    if(st.state==='context_stale')return 'reload context: load tier 1, then rehydrate the closure';
    if(st.semantic_guidance&&!['idle','classifying','working'].includes(st.state))return st.state==='degraded'?'apply the last verified routing directive or ask the user':'resolve '+st.state;
    if(st.semantic_guidance&&st.guidance_pending)return 'interpret current input and declare guidance';
    if(st.semantic_guidance?.relation==='cancellation')return 'reconcile actual effects; stop cancelled scope';
    if(st.semantic_guidance?.requires_reclassification)return 'reclassify changed scope before dependent effects';
    if(st.semantic_guidance?.blocker)return 'check declared blocker; continue independent work';
    if(st.semantic_guidance)return 'review declared '+st.semantic_guidance.phase+' guidance';
    if(st.state==='classifying')return st.needs_clarification?'clarify scope with the user':'classify the request and declare it through the adapter';
    if(st.state==='working'){
      if(!st.work_item&&MANAGED.includes(st.governance_level))return 'open or attach the governing work item, then declare attach';
      return st.work_item?'continue '+st.work_item.id:'continue the declared '+(st.governance_level??'')+' work';
    }
    if(st.state==='idle')return 'classify the next request';
    if(st.state==='degraded')return 'apply the last verified routing directive or ask the user';
    return 'resolve '+st.state;
  }
  function recapNotice(n){
    return 'OOP continuity (R28): exchange '+n+' reached. Before further substantive work: record each material decision in its canonical record; write one English Markdown recap (purpose, scope, key points, decisions with authority and canonical record, open questions, blockers, pending effects, next action; formal, unambiguous, brief, precise, exhaustive; no secrets) in an authorized private location excluded from version control; offer it for download or show it inline; tell the user in their language that a new chat is recommended to avoid context degradation, ask them to download the recap and give a ready-to-paste message for the new chat with the recap attached.';
  }
  function statusLine(f,st,index,changed,set){
    const n=f?.ok&&st?unread(f,st):0;
    return clip('OOP state='+(st?.state??'uninitialized')+' | index='+index.fingerprint.slice(7,19)+' '+(changed?'changed':'unchanged')+
      ' | instr='+(set?set.identity.slice(7,19):'none')+
      ' | work='+(st?.work_item?.id??'none')+' | level='+(st?.governance_level??'none')+' | unread='+n+' | next='+(st?nextAction(st):'classify each request and declare it through the adapter'),STATUS_BYTES);
  }
  function factsFor(request,options){
    if(options?.reg)return registrationFacts(options.reg,request?.coordination,new Date().toISOString());
    return resolveFacts(request?.coordination,request?.coordination?.observed_at??request?.context?.observed_at);
  }
  // Index delivery also carries the declare line and the shared instruction set (R27.2).
  const fullDelivery=(index,f,set)=>index.text+'\n'+declareLine(f)+'\n'+instructionBlock(f,set);

  // Admission guidance: messages are English, bounded and never grant permission.
  function guide(index,command,request,response,options={}){
    if(!index)return {message:''};
    const f=factsFor(request,options);
    const set=composeInstructions(f,options);
    if(command==='entry'){
      if(!f.ok)return {message:fullDelivery(index,null,set)+'\n'+statusLine(null,null,index,false,set)};
      writeRendered(f,set);
      const st=update(f,st=>{if(f.event&&STALE_EVENTS.includes(f.event))move(st,'context_stale',f.event,f.now);
        st.index_identity_delivered=index.fingerprint;st.context_integrity=st.state==='context_stale'?'stale':'unknown';
        st.instructions_identity_delivered=set.identity;st.instructions_completeness=set.complete?'complete':'incomplete';st.instructions_assurance=assurance(st,set);});
      return {message:fullDelivery(index,f,set)+'\n'+statusLine(f,st,index,false,set)};
    }
    if(command==='interaction'){
      if(!f.ok)return {message:statusLine(null,null,index,false,set)};
      writeRendered(f,set);
      let full=false,changed=false,recap=false,instructions=false;
      const st=update(f,st=>{
        if(f.event&&STALE_EVENTS.includes(f.event))move(st,'context_stale',f.event,f.now);
        changed=st.index_identity_delivered!==index.fingerprint;
        full=changed||st.state==='context_stale';
        instructions=full||st.instructions_identity_delivered!==set.identity;
        if(st.semantic_guidance)st.guidance_pending=true;
        if(st.state==='idle'||(st.state==='working'&&!st.work_item&&!MANAGED.includes(st.governance_level))){clearDeclaration(st);move(st,'classifying','interaction',f.now);}
        if(full)st.index_identity_delivered=index.fingerprint;
        if(instructions)st.instructions_identity_delivered=set.identity;
        st.instructions_completeness=set.complete?'complete':'incomplete';st.instructions_assurance=assurance(st,set);
        // R28: count exchanges; the recap notice repeats at each multiple of the threshold.
        st.exchange_count=(Number.isInteger(st.exchange_count)?st.exchange_count:0)+1;
        recap=st.exchange_count%f.recap===0;
      });
      const line=statusLine(f,st,index,changed,set);
      const notice=recap?'\n'+recapNotice(st.exchange_count):'';
      return {message:(full?fullDelivery(index,f,set)+'\n'+line:instructions?instructionBlock(f,set)+'\n'+line:line)+notice};
    }
    if(!f.ok)return {message:''};
    const resource=request.coordination.resource;
    if(command==='completion'){const n=releaseLeases(f,l=>l.holder?.installation_uid===f.uid&&l.holder?.session===f.session);return {message:'',released:n};}
    if(!object(resource)||!text(resource.path,4096)||!['read','write','unknown'].includes(resource.access))return {message:''};
    const abs=f.norm(nodePath.resolve(f.project,resource.path)),inProject=f.within(abs,f.project),privateRes=f.within(abs,f.private);
    // R27.5: registered governed stores are observed even under the private root.
    const store=f.stores.find(s=>s.kind==='work_items'&&f.within(abs,s.root))??f.stores.find(s=>s.kind==='operations'&&f.within(abs,s.root));
    const kind=store?store.kind:inProject&&!privateRes?'project':null;
    const projectResource=kind!==null,label=inProject?nodePath.relative(f.project,abs).replaceAll('\\','/'):abs;
    if(command==='post-effect'){
      if(!projectResource||resource.access==='unknown')return {message:''};
      update(f,st=>{st.reads[f.key(abs)]=identityOf(f,abs);});
      if(resource.access==='write'){const st=readJson(statePath(f));acquireLease(f,abs,st?.work_item?.id);}
      if(kind==='work_items'&&resource.access==='write'&&response.payload?.publication===undefined){
        update(f,st=>{st.publication_pending=st.publication_pending??{};st.publication_pending['resource:'+abs]={ticket_id:st.work_item?.id??null,resource:abs,local_content_identity:identityOf(f,abs),reason:'publication_assessment_required'};});
        return {message:'OOP notice: assess canonical ticket publication before dependent continuation.',publication:{disposition:'blocked',reason:'publication_assessment_required',effect_permission:'not_granted'}};
      }
      return {message:''};
    }
    if(command!=='pre-effect'||resource.access!=='write')return {message:''};
    const st=readJson(statePath(f))??freshState(f),codes=[],notes=[];
    if(st.state==='context_stale')codes.push('effect_with_stale_context');
    if(st.semantic_guidance&&(st.guidance_pending||st.semantic_guidance.requires_reclassification||st.semantic_guidance.relation==='cancellation'))codes.push('effect_with_stale_guidance');
    if(projectResource){
      if(st.state==='classifying'||st.state==='idle')codes.push('effect_without_classification');
      else if(st.state==='working'&&kind==='work_items'){
        // Work-item writes are judged by their declared justification, not by the level checks.
        if(st.basis?.work_item_reason==='none')codes.push('work_item_without_justification');
        if(st.basis?.subject_scope==='external')codes.push('work_item_for_external_subject');
      }else if(st.state==='working'){
        if(st.governance_level==='G0')codes.push('effect_exceeds_declared_level');
        if(MANAGED.includes(st.governance_level)&&!st.work_item)codes.push('effect_without_work_item');
        if(st.declared_resources.length&&!st.declared_resources.some(r=>f.within(abs,f.norm(nodePath.resolve(f.project,r)))))codes.push('effect_outside_declared_scope');
      }
      if((st.instructions_identity_delivered!==set.identity&&st.instructions_identity_declared!==set.identity)||
        (f.registered&&f.mode==='enforcing'&&!set.organization_complete))codes.push('effect_without_current_instructions');
      const recorded=st.reads[f.key(abs)];
      if(recorded&&!['unhashed','unreadable'].includes(recorded)&&identityOf(f,abs)!==recorded)codes.push('resource_changed');
      const lease=acquireLease(f,abs,st.work_item?.id);
      if(lease.status==='leased'){codes.push('resource_leased');notes.push('leased by '+lease.holder+' (work '+(lease.work_item??'none')+') until '+lease.expires);}
      if(lease.status==='taken_over'&&lease.previous){const note='Lease on '+label+' taken over from expired holder '+(lease.previous.holder?.installation_uid??'unknown')+'.';
        if(st.work_item)appendEntry(f,{work_item:st.work_item.id,kind:'step',text:note});else update(f,s=>{s.history.push({from:s.state,event:'lease_takeover',to:s.state,at:f.now,note});});}
      if(lease.status==='unprotected')notes.push('no lease protection: private area not observed machine-local');
    }
    if(!codes.length)return {message:''};
    const advice={effect_with_stale_context:'Context is stale: run load tier 1 and rehydrate the closure before writing.',
      effect_with_stale_guidance:'Interpret the current input, reconcile cancelled or changed scope, then classify and declare with the current session revision; declarations grant no permission.',
      effect_without_classification:kind==='work_items'?'Classify and declare first; G0 needs no work item. Invocation: see the OOP declare line.':
        'Classify the request and declare it through the adapter before this effect (modules: intake, context). Invocation: see the OOP declare line.',
      effect_exceeds_declared_level:'G0 permits no governed mutation: reclassify and declare the actual level.',
      effect_without_work_item:'Level '+st.governance_level+' requires a governing work item: open or attach a ticket or equivalent reference, then declare attach (module: tickets).',
      effect_outside_declared_scope:'Resource is outside the declared resources: re-evaluate scope and declare it.',
      work_item_without_justification:"This work item has no declared reason: G0/G1 need none unless a cited shared policy, the user's explicit request, a continuation or a stated continuity need requires it.",
      work_item_for_external_subject:"The request's subject is not this organization's work: do not create a work item for it.",
      effect_without_current_instructions:'The current shared instruction set was neither delivered nor declared: read it (load scope "instructions" or the rendered copy) and declare its identity.',
      resource_changed:'Content changed since this session read it: re-read before writing.',
      resource_leased:'Wait for the lease or coordinate with its holder.'};
    const deny=f.mode==='enforcing'?(codes.includes('effect_with_stale_guidance')?'effect_with_stale_guidance':f.deny.find(c=>codes.includes(c))):undefined;
    const message=clip('OOP mismatch before writing '+label+': '+codes.join(', ')+(notes.length?' ('+notes.join('; ')+')':'')+'. '+advice[deny??codes[0]],MESSAGE_BYTES);
    return {message,codes,deny};
  }

  // Runtime-initiated input: only session and command fields; format, request_id and facts are added here.
  function normalizeRuntimeRequest(request){
    if(!object(request))return request;
    const {session,coordination,...rest}=request;
    const id=session??(object(coordination)?coordination.session:undefined);
    return {format:1,...rest,request_id:text(rest.request_id)?rest.request_id:'rt-'+uuid(),coordination:{session:id}};
  }

  // Runtime coordination commands (never admission, never permission).
  function coordinate(index,routing,command,request,sourceBinding,options={}){
    if(options.reg)request=normalizeRuntimeRequest(request);
    const base={format:1,type:'oop_runtime_coordination',request_id:text(request?.request_id)?request.request_id:null,command:COORDINATION_COMMANDS.includes(command)?command:null,
      source_binding:sourceBinding,accepted:false,reason:'invalid_envelope',effect_permission:'not_granted',state:null,runtime_message:'',result:{},error:true};
    const done=(accepted,reason,extra={})=>({...base,...extra,accepted,reason,error:false});
    try{
      if(!COORDINATION_COMMANDS.includes(command))return {...base,reason:'unsupported_command'};
      const allowed={declare:['phase','facets','level','work_item','resources','work_item_state','lifecycle','basis','instructions_identity','guidance','expected_revision','assessment'],load:['tier','modules','scope','command'],
        'worklog-append':['work_item','kind','text','to','resources','evidence','supersedes'],'worklog-read':['work_item','to','mark_read']}[command];
      if(!object(request)||request.format!==1||!text(request.request_id)||Object.keys(request).some(k=>!['format','request_id','coordination',...allowed].includes(k)))return base;
      const f=factsFor(request,options);
      if(command==='load'){
        if(request.scope==='action'){
          if(!f.ok)return done(false,f.reason);const st=readJson(statePath(f));
          if(!st)return done(false,'unknown_session');
          const pending=st.pending_actions?.[request.command??'pre-effect'];
          if(!pending)return done(false,'action_receipt_unavailable');
          return done(true,'action_loaded',{state:st.state,result:{scope:'action',state_revision:st.revision??0,action:pending,request_reference:st.current_request??null,assurance:'runtime_claims_are_not_factual_observations'}});
        }
        if(request.scope!==undefined){
          if(request.scope==='session'){
            if(request.tier!==undefined||request.modules!==undefined)return done(false,'invalid_scope');
            if(!f.ok)return done(false,f.reason);const st=readJson(statePath(f));if(!st)return done(false,'unknown_session');
            return done(true,'session_loaded',{state:st.state,result:{scope:'session',state_revision:st.revision??0,
              guidance:st.semantic_guidance??null,guidance_pending:st.guidance_pending??false,assurance:'runtime_cache_not_authority'}});
          }
          if(request.scope!=='instructions'||request.tier!==undefined||request.modules!==undefined)return done(false,'invalid_scope');
          const set=composeInstructions(f,options);
          if(f.ok){writeRendered(f,set);if(fs.existsSync(statePath(f)))update(f,st=>{st.instructions_identity_delivered=set.identity;st.instructions_completeness=set.complete?'complete':'incomplete';});}
          return done(true,'instructions_loaded',{result:{scope:'instructions',identity:set.identity,text:set.text,complete:set.complete,layers:set.layers,conflicts:set.conflicts}});
        }
        if(![1,2,3].includes(request.tier))return done(false,'invalid_tier');
        if(request.tier===1){
          let st=null;
          if(f.ok)st=update(f,st=>{if(st.state==='context_stale'){const back=st.previous_state&&st.previous_state!=='context_stale'?st.previous_state:'idle';move(st,back,'load_tier_1',f.now);}
            st.index_identity_delivered=index.fingerprint;st.context_integrity='reused_verified';});
          return done(true,'index_loaded',{state:st?.state??null,runtime_message:statusLine(f.ok?f:null,st,index,false,composeInstructions(f,options)),result:{tier:1,fingerprint:index.fingerprint,text:index.text}});
        }
        if(!Array.isArray(request.modules)||!request.modules.length||request.modules.length>16||!request.modules.every(m=>text(m,64)))return done(false,'invalid_modules');
        const known=new Map(routing.modules.map(m=>[m.id,m]));
        if(request.modules.some(m=>!known.has(m)||m==='producer'))return done(false,'unknown_module');
        const records=request.modules.map(id=>{const m=known.get(id),file=request.tier===2?m.detail:m.context;return {id,path:file,record:JSON.parse(fs.readFileSync(nodePath.join(baseDir,file),'utf8'))};});
        if(request.tier===3&&f.ok)update(f,st=>{st.loaded_modules??={};for(const m of records)st.loaded_modules[m.id]={source_identity:options.sourceIdentity,content_identity:sha(fs.readFileSync(nodePath.join(baseDir,m.path)))};});
        return done(true,'modules_loaded',{result:{tier:request.tier,modules:records}});
      }
      if(!f.ok)return done(false,f.reason);
      // R27.3: only host-initiated invocations create session state.
      if(!fs.existsSync(statePath(f)))return done(false,'unknown_session');
      if(command==='declare'){
        const phase=request.phase;
        if(phase==='assessment')return assessAction(f,request,options,done);
        if(request.assessment!==undefined)return done(false,'invalid_assessment');
        if(!['classification','attach','transition','clarification','lifecycle','guidance'].includes(phase))return done(false,'invalid_phase');
        if(request.guidance!==undefined&&(!['classification','guidance'].includes(phase)||!validGuidance(request.guidance)))return done(false,'invalid_guidance');
        if(phase==='guidance'&&request.guidance===undefined)return done(false,'guidance_required');
        if((request.guidance!==undefined||request.expected_revision!==undefined)&&(!Number.isSafeInteger(request.expected_revision)||request.expected_revision<0))return done(false,'expected_revision_required');
        const item=request.work_item;
        if(item!==undefined&&item!==null&&(!object(item)||!['ticket','reference'].includes(item.kind)||!text(item.id,256)||Object.keys(item).some(k=>!['kind','id'].includes(k))))return done(false,'invalid_work_item');
        if(request.resources!==undefined&&(!Array.isArray(request.resources)||request.resources.length>256||!request.resources.every(r=>text(r,4096))))return done(false,'invalid_resources');
        if(request.instructions_identity!==undefined&&!IDENTITY.test(request.instructions_identity))return done(false,'invalid_instructions_identity');
        let basis=null,notice='';
        if(phase==='classification'){
          if(request.basis===undefined){if(f.registered)return done(false,'basis_required');notice='OOP notice: classification_without_basis; declare a basis once the adapter registration exists.\n';}
          else if(!(basis=validBasis(request.basis)))return done(false,'invalid_basis');
        }else if(request.basis!==undefined)return done(false,'invalid_basis');
        const set=composeInstructions(f,options);
        let rejected=null,released=0;
        const st=update(f,st=>{
          if(request.expected_revision!==undefined&&request.expected_revision!==(st.revision??0)){rejected='stale_session_revision';return;}
          if(st.state==='context_stale'&&phase!=='lifecycle'){rejected='context_stale_reload_required';return;}
          if(phase==='classification'){
            if(!Array.isArray(request.facets)||!request.facets.length||!request.facets.every(x=>text(x,64)&&Object.hasOwn(routing.facets,x)))return rejected='unknown_or_missing_facet';
            if(!LEVELS.includes(request.level))return rejected='invalid_level';
            if(basis&&(rejected=coherence(basis,request.level,item,set)))return;
            st.declared_facets=[...new Set(request.facets)];st.governance_level=request.level;st.declared_resources=request.resources??[];st.needs_clarification=false;
            st.basis=basis;if(item)st.work_item=item;move(st,'working','declare_classification',f.now);
          }else if(phase==='attach'){
            if(!item)return rejected='work_item_required';
            if(!st.governance_level)return rejected='classification_required';
            st.work_item=item;if(request.resources)st.declared_resources=request.resources;move(st,'working','declare_attach',f.now);
          }else if(phase==='transition'){
            if(!text(request.work_item_state,64)||!st.work_item)return rejected='work_item_state_required';
            st.work_item_state=request.work_item_state;
            if(request.work_item_state==='completed'){const id=st.work_item.id;released=releaseLeases(f,l=>l.work_item===id);}
            if(TERMINAL.includes(request.work_item_state)){const id=st.work_item.id;released=releaseLeases(f,l=>l.work_item===id);st.work_item=null;st.work_item_state=null;clearDeclaration(st);move(st,'idle','work_item_'+request.work_item_state,f.now);}
          }else if(phase==='clarification'){clearDeclaration(st);st.needs_clarification=true;move(st,'classifying','declare_clarification',f.now);}
          else if(phase==='lifecycle'){if(!LIFECYCLE.includes(request.lifecycle))return rejected='invalid_lifecycle';move(st,request.lifecycle,'declare_lifecycle',f.now);}
          if(request.guidance!==undefined)projectGuidance(st,request.guidance,f);
          if(phase==='classification'){st.guidance_pending=false;if(st.semantic_guidance)st.semantic_guidance.requires_reclassification=false;}
          if(request.instructions_identity!==undefined)st.instructions_identity_declared=request.instructions_identity;
          st.instructions_assurance=assurance(st,set);
        });
        if(rejected)return done(false,rejected);
        return done(true,'declared',{state:st.state,runtime_message:notice+statusLine(f,st,index,false,set),result:{declaration:'runtime_claim_not_evidence',released_leases:released,...(request.expected_revision!==undefined||st.semantic_guidance?{state_revision:st.revision??0}:{}),...(st.semantic_guidance?{guidance:st.semantic_guidance}:{})}});
      }
      if(command==='worklog-append'){
        if(!text(request.work_item,256)||!KINDS.includes(request.kind)||!text(request.text,4000))return done(false,'invalid_entry');
        if(SECRET.test(request.text))return done(false,'secret_like_content');
        if(request.to!==undefined&&!text(request.to,256))return done(false,'invalid_recipient');
        for(const k of ['resources','evidence'])if(request[k]!==undefined&&(!Array.isArray(request[k])||!request[k].every(x=>text(x,4096))))return done(false,'invalid_'+k);
        if(request.supersedes!==undefined&&!text(request.supersedes,64))return done(false,'invalid_supersedes');
        const record=appendEntry(f,request);
        return done(true,'appended',{result:{entry:record,authority:'data_not_instruction'}});
      }
      if(!text(request.work_item,256)||(request.to!==undefined&&!text(request.to,256))||(request.mark_read!==undefined&&typeof request.mark_read!=='boolean'))return done(false,'invalid_query');
      const entries=readEntries(f,request.work_item).filter(e=>request.to===undefined||e.to===request.to);
      if(request.mark_read)update(f,st=>{st.seen[request.work_item]=[...new Set([...(st.seen[request.work_item]??[]),...entries.filter(e=>e.to===f.uid).map(e=>e.id)])];});
      return done(true,'read',{result:{entries,authority:'data_not_instruction'}});
    }catch(e){return {...base,reason:e?.code==='lock_busy'?'coordination_busy':'coordination_error'};}
  }
  // Publication obligations are non-authoritative coordination metadata, not tickets.
  // Only the engine's independently bound observation may add/reconcile one.
  function publication(request,command,assessment,options={}){
    const f=factsFor(request,options);if(!f.ok)return {pending:[],tracking:'unavailable'};
    const current=readJson(statePath(f));if(!current)return {pending:[],tracking:'unknown_session'};
    if(!assessment){const item=current.work_item?.id??request.organizational_mutation?.proposal?.ticket?.id??request.publication_context?.ticket_id;return {pending:Object.values(current.publication_pending??{}).filter(p=>p.ticket_id===item),tracking:'owned_session'};}
    const p=request.publication_context;
    const st=update(f,state=>{
      state.publication_pending=state.publication_pending??{};
      if(assessment&&p){
        if(typeof p.resource==='string'&&typeof p.local_content_identity==='string'){
          const absolute=f.norm(nodePath.resolve(f.project,p.resource)),key='resource:'+absolute,marker=state.publication_pending[key];
          if(marker?.local_content_identity===p.local_content_identity&&identityOf(f,absolute)===p.local_content_identity)delete state.publication_pending[key];
        }
        if(assessment.reason==='canonical_change_observed'){
          const previous=state.publication_pending[p.ticket_id];
          if(previous&&previous.change_identity===p.change_identity&&previous.destination===p.destination)delete state.publication_pending[p.ticket_id];
        }else if(['publish_now','blocked'].includes(assessment.disposition)){
          state.publication_pending[p.ticket_id]={ticket_id:p.ticket_id,destination:p.destination,change_identity:p.change_identity??null,expected_revision:p.expected_revision,reason:assessment.reason};
        }
      }
    });
    const item=st.work_item?.id??p?.ticket_id;
    return {pending:Object.values(st.publication_pending??{}).filter(p=>p.ticket_id===item),tracking:'owned_session'};
  }
  function declarationIdentity(st){return sha(JSON.stringify([st.governance_level,st.declared_facets,st.declared_resources,st.basis,st.work_item,st.instructions_identity_declared]));}
  function recordRequest(session,receipt,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok||!IDENTITY.test(receipt.reference??'')||!IDENTITY.test(receipt.content_identity??'')||!text(receipt.turn_id,256)||SECRET.test(receipt.turn_id)||/[\x00-\x1f\x7f]/.test(receipt.turn_id))return false;let accepted=false;
    update(f,st=>{st.native_requests??={};if(!st.native_requests[receipt.reference]&&Object.keys(st.native_requests).length>=200)return;
      st.native_requests[receipt.reference]={turn_id:receipt.turn_id,content_identity:receipt.content_identity};st.current_request=receipt.reference;st.request_content_identity=receipt.content_identity;accepted=true;});return accepted;
  }
  function recordNativeInput(session,receipt,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok||!text(receipt.request_id,512)||SECRET.test(receipt.request_id))return false;
    update(f,st=>{st.native_inputs??={};st.native_inputs[receipt.command]={input_identity:receipt.input_identity,request_id:receipt.request_id};});return true;
  }
  function invalidateDelivery(session,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok||!fs.existsSync(statePath(f)))return false;
    update(f,st=>{st.loaded_modules={};st.instructions_identity_delivered=null;st.context_integrity='stale';move(st,'context_stale','delivery_failed',f.now);});return true;
  }
  function recordAction(session,receipt,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok)return null;let current;
    update(f,st=>{st.pending_actions??={};const prior=st.pending_actions[receipt.command];
      if(prior&&JSON.stringify({...prior,generation:undefined})===JSON.stringify({...receipt,generation:undefined})){current=prior;return;}
      current={...receipt,generation:(prior?.generation??0)+1};st.pending_actions[receipt.command]=current;});return current;
  }
  function recordOutcome(session,receipt,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok)return false;let accepted=false;
    update(f,st=>{if(st.last_admission?.action_identity!==receipt.action_identity||st.last_admission?.request_id!==receipt.request_id)return;
      st.last_outcome=receipt;accepted=true;});return accepted;
  }
  function assessAction(f,request,options,done){
    const a=request.assessment,safe=x=>text(x,2048)&&!SECRET.test(x)&&!/[\x00-\x1f\x7f]/.test(x);
    if(!Number.isSafeInteger(request.expected_revision)||request.expected_revision<0)return done(false,'expected_revision_required');
    if(!object(a)||bytes(JSON.stringify(a))>32768||Object.keys(a).some(k=>!['action_identity','generation','command','facets','effect_class','effects','sources','judgments','purpose','continuation'].includes(k))||
      !IDENTITY.test(a.action_identity??'')||!Number.isSafeInteger(a.generation)||!['pre-effect','post-effect','completion','delegate','recovery'].includes(a.command)||
      !['work','bookkeeping'].includes(a.purpose)||!Array.isArray(a.facets)||!a.facets.length||!a.facets.every(x=>options.routingFacets?.includes(x))||!options.routingFacets?.includes(a.effect_class)||
      !Array.isArray(a.effects)||a.effects.length>64||!a.effects.every(e=>object(e)&&Object.keys(e).length===3&&safe(e.path)&&['read','write'].includes(e.access)&&(e.expected_identity==='absent'||IDENTITY.test(e.expected_identity??'')))||
      (a.sources!==undefined&&(!Array.isArray(a.sources)||a.sources.length>64||!a.sources.every(x=>object(x)&&Object.keys(x).length===2&&safe(x.path)&&(x.expected_identity==='absent'||IDENTITY.test(x.expected_identity??'')))))||
      !object(a.judgments)||Object.keys(a.judgments).length>128||!Object.entries(a.judgments).every(([id,j])=>options.predicateIds?.includes(id)&&actionTypes.interpretive(id)&&object(j)&&Object.keys(j).length===3&&typeof j.value==='boolean'&&safe(j.reason)&&Array.isArray(j.source_refs)&&j.source_refs.length>0&&j.source_refs.length<=16&&j.source_refs.every(safe))||
      (a.continuation!==undefined&&(!object(a.continuation)||Object.keys(a.continuation).length!==1||!safe(a.continuation.next_action))))return done(false,'invalid_assessment');
    let rejected;
    const st=update(f,st=>{if((st.revision??0)!==request.expected_revision)return rejected='stale_session_revision';
      const pending=st.pending_actions?.[a.command];if(!pending||pending.action_identity!==a.action_identity||pending.generation!==a.generation)return rejected='action_receipt_changed';
      if(!st.current_request||pending.request_reference!==st.current_request)return rejected='native_request_unavailable';
      if(st.state!=='working'||st.context_integrity==='stale'||st.guidance_pending)return rejected='action_classification_pending';
      st.action_assessments??={};const value={...a,assessment_revision:(st.revision??0)+1,source_identity:options.sourceIdentity,request_reference:st.current_request,dependencies:pending.dependencies,declaration_identity:declarationIdentity(st)};
      st.action_assessments[a.command]={...value,identity:sha(JSON.stringify(value))};});
    return rejected?done(false,rejected):done(true,'assessment_declared',{state:st.state,result:{state_revision:st.revision,assurance:'semantic_judgment_not_independent_evidence',action_identity:a.action_identity}});
  }
  // Classification and interpretive assessment are scoped claims, never factual grants.
  function actionState(session,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok)return null;
    const st=readJson(statePath(f));if(!st)return null;
    return {revision:st.revision??0,state:st.state,level:st.governance_level,
      facets:st.declared_facets,resources:st.declared_resources,basis:st.basis,
      work_item:st.work_item,guidance:st.semantic_guidance??null,
      guidance_pending:st.guidance_pending??false,context_integrity:st.context_integrity,request_reference:st.current_request??null,request_content_identity:st.request_content_identity??null,request_history:Object.keys(st.native_requests??{}),
      loaded_modules:st.loaded_modules??{},instructions_declared:st.instructions_identity_declared,instructions_delivered:st.instructions_identity_delivered,
      declaration_identity:declarationIdentity(st),assessments:st.action_assessments??{},pending_actions:st.pending_actions??{},last_outcome:st.last_outcome??null,last_admission:st.last_admission??null};
  }
  function consumeAction(session,revision,identity,options,metadata){
    const f=factsFor({coordination:{session}},options);if(!f.ok)return false;
    let accepted=false;
    update(f,st=>{if((st.revision??0)!==revision||(st.admitted_actions??[]).includes(identity)||(st.admitted_actions??[]).length>=200)return;
      st.admitted_actions=[...(st.admitted_actions??[]),identity];if(metadata)st.last_admission=metadata;accepted=true;});
    return accepted;
  }
  function completionState(session,revision,progress,options){
    const f=factsFor({coordination:{session}},options);if(!f.ok)return false;
    let permitted=false;
    update(f,st=>{if((st.revision??0)!==revision)return;st.completion_progress??=[];
      if(Array.isArray(st.completion_progress)&&progress&&!st.completion_progress.includes(progress)&&st.completion_progress.length<200){st.completion_progress.push(progress);permitted=true;}});
    return permitted;
  }
  return {guide,coordinate,registration,resolveFacts,composeInstructions,acquireLease,releaseLeases,replaceLease,leaseFile,statusLine,STATES,COORDINATION_COMMANDS,publication,actionState,consumeAction,completionState,recordRequest,recordAction,recordOutcome,recordNativeInput,invalidateDelivery};
}
module.exports={runtimeCoordination};
