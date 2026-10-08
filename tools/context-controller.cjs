'use strict';
const fs = process.getBuiltinModule('node:fs');
const path = process.getBuiltinModule('node:path');
const { createHash, randomUUID } = process.getBuiltinModule('node:crypto');
const { spawnSync } = process.getBuiltinModule('node:child_process');
const { composeRuntimeInstructions, runtimeOperationalRules, renderMandatoryProcedures, verifyMandatoryView } = require('./runtime-instructions.cjs');
const {contextRuntime}=require('./context-runtime.cjs');

const reminder = 'Classify every new subject. For organizational work above G1 unrelated to an existing ticket, immediately create, commit and push a new ticket within authority. Route local-only adoption through technical_adoption without an organizational ticket or profile. Publish the updated state of a ticket under discussion whenever it changes significantly beyond a status-only change. Perform these effects only with actual capability and authority, verify their outcomes and report failures or unavailability accurately.';
const orientation = 'Use this context to orient your work under OOP. Load the referenced applicable modules and reassess the current request. Retained classifications describe earlier turns and confer no authority. Follow independent host authorization and verify actual effects.';
const states = {
  intake: { modules: ['core','intake','context'], next: { inquiry:'Answer a classified inquiry.', planning:'Identify the work item and plan authorized effects.', recovery:'Reconcile interrupted or uncertain work.' } },
  inquiry: { modules: ['core','intake'], next: { intake:'Classify a new subject.', planning:'Reassess scope and plan managed work.' } },
  planning: { modules: ['intake','impact','tickets','changes'], next: { intake:'Reclassify a changed subject.', execution:'Carry out the authorized plan and observe effects.', recovery:'Reconcile a dependency before resuming.' } },
  execution: { modules: ['tickets','coordination','execution'], next: { intake:'Classify a new subject while retaining current evidence.', verification:'Read back the actual outcome and reconcile required publication.', recovery:'Inspect partial or uncertain effects before retry.' } },
  verification: { modules: ['tickets','execution','delivery'], next: { intake:'Classify the next subject.', recovery:'Reconcile incomplete verification or publication.' } },
  recovery: { modules: ['recovery','continuity','execution'], next: { intake:'Classify from the reconstructed scope.', planning:'Plan remaining authorized actions.', verification:'Verify a recovered outcome.' } },
};
const relations = ['independent','continuation','clarification','correction','scope_change','cancellation','replacement'];
const interfaceVersion = 'oop-context-1';
const eventFields = {
  session_open:['event','chat','cwd'], prompt:['event','chat','cwd'], snapshot:['event','chat','cwd'],
  record:['event','chat','cwd','request_id','subject','turn','expected_version','state','level','related_ticket','facets','relation']
};
function validateEvent(event, routing) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.event!=='string' || !Object.hasOwn(eventFields,event.event)) return 'unsupported_event';
  if (Object.keys(event).some(key=>!eventFields[event.event].includes(key)) || !id(event.chat) ||
      (event.cwd !== undefined && (typeof event.cwd !== 'string' || event.cwd.length>1024))) return 'invalid_event';
  if (event.event !== 'record') return;
  if (eventFields.record.filter(key=>key!=='cwd').some(key=>!Object.hasOwn(event,key)) ||
      !id(event.request_id) || !id(event.subject) || !Number.isSafeInteger(event.turn) || event.turn<1 ||
      !Number.isSafeInteger(event.expected_version) || event.expected_version<1 || typeof event.state!=='string' || !Object.hasOwn(states,event.state) ||
      typeof event.level!=='string' || !/^G[0-4]$/.test(event.level) || typeof event.related_ticket!=='boolean' || !relations.includes(event.relation) ||
      !Array.isArray(event.facets) || event.facets.length>8 || new Set(event.facets).size!==event.facets.length ||
      event.facets.some(facet=>typeof facet!=='string')) return 'invalid_record';
  if (event.facets.includes('technical_adoption') && (event.related_ticket || event.facets.some(facet=>['managed_change','ticket_mutation','knowledge_profiles','canonical_write','organizational_migration'].includes(facet)))) return 'invalid_record';
  if (event.facets.some(facet=>!Object.hasOwn(routing,facet) || routing[facet].some(module=>['bootstrap','producer'].includes(module)))) return 'unresolved_facets';
}
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);
const revision = value => typeof value === 'string' && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const samePath = (a,b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (root,target) => {
  const relative = path.relative(root,target);
  return relative !== '..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);
};
function directory(target, create = false) {
  if (typeof target !== 'string' || target.length > 1024 || !path.isAbsolute(target) ||
      target.split(/[\\/]/).some(part=>part === '.' || part === '..')) throw Error('invalid_path');
  target = path.resolve(target);
  if (target !== path.dirname(target)) directory(path.dirname(target),create);
  if (create && !fs.existsSync(target)) {
    try { fs.mkdirSync(target); } catch (error) { if(error.code !== 'EEXIST') throw error; }
  }
  if (!fs.lstatSync(target).isDirectory() || !samePath(fs.realpathSync(target),target)) throw Error('unsafe_path');
  return target;
}
function read(target) {
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 65536) throw Error('unsafe_state');
    return JSON.parse(fs.readFileSync(target,'utf8'));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function save(target, value) {
  writeAtomic(target,JSON.stringify(value)+'\n');
}
function writeAtomic(target, bytes) {
  const temporary = target+'.'+randomUUID()+'.tmp';
  fs.writeFileSync(temporary,bytes,{flag:'wx'});
  try { fs.renameSync(temporary,target); } finally { fs.rmSync(temporary,{force:true}); }
}
function locked(target, work) {
  let fd;
  try { fd = fs.openSync(target,'wx'); }
  catch (error) { if (error.code === 'EEXIST') return {status:'busy'}; throw error; }
  const token = JSON.stringify({pid:process.pid,owner:randomUUID(),started_at:new Date().toISOString()});
  try {
    fs.writeFileSync(fd,token);
    return work();
  } finally {
    fs.closeSync(fd);
    if (fs.readFileSync(target,'utf8') === token) fs.unlinkSync(target);
  }
}
function workspace(registration) {
  const root = directory(registration.project_root);
  const priv = directory(path.join(root,'.priv'));
  const common = directory(path.join(priv,'common'));
  const owned = directory(registration.owned_scope);
  const tools = path.join(priv,'tools');
  if (!id(registration.installation_uid) || !inside(tools,owned) || samePath(tools,owned) ||
      !samePath(path.basename(owned),registration.installation_uid)) throw Error('invalid_owner');
  const checkout = directory(path.join(common,'oop'));
  const operations = directory(path.join(root,'operations'));
  return {root,common,owned,checkout,operations,installation_uid:registration.installation_uid};
}
function gitSynchronize(checkout, source, observed = ()=>{}) {
  if (!id(source.remote) || !/^refs\/(?:heads|tags)\/[a-zA-Z0-9_.\/-]{1,200}$/.test(source.ref)) throw Error('invalid_source');
  const metadata = directory(path.join(checkout,'.git'));
  const disabledEvents = fs.mkdtempSync(path.join(metadata,'oop-empty-events-'));
  try {
    const env = {...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GIT_OPTIONAL_LOCKS:'0'};
    for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG(?:_.*)?)$/i.test(key)) delete env[key];
    function git(...args) {
      const run = spawnSync('git',['--no-replace-objects','-c','core.hooksPath='+disabledEvents,'-c','protocol.ext.allow=never',
        '-C',checkout,...args],{env,encoding:'utf8',timeout:12000,windowsHide:true,maxBuffer:1024*1024});
      if (run.status !== 0) throw Error('git_operation_failed');
      return run.stdout.trimEnd();
    }
    if (!samePath(fs.realpathSync(git('rev-parse','--show-toplevel')),checkout) ||
        !samePath(fs.realpathSync(git('rev-parse','--absolute-git-dir')),path.join(checkout,'.git'))) throw Error('wrong_checkout');
    git('check-ref-format',source.ref);
    if (git('remote','get-url',source.remote) !== source.url) throw Error('source_changed');
    git('fetch','--no-tags','--no-recurse-submodules','--refmap=','--',source.remote,source.ref);
    const target = git('rev-parse','--verify','FETCH_HEAD^{commit}');
    if (!revision(target) || /^160000 /m.test(git('ls-tree','-r',target)) ||
        /^160000 /m.test(git('ls-files','--stage'))) throw Error('unsupported_checkout');
    observed(target);
    // Avoid overwriting an embedded repository while replacing or cleaning paths.
    const pending = [checkout];
    while (pending.length) {
      const folder = pending.pop();
      for (const item of fs.readdirSync(folder,{withFileTypes:true})) {
        if (item.name.toLowerCase() === '.git') {
          if (folder !== checkout) throw Error('nested_repository');
        } else if (item.isDirectory() && !item.isSymbolicLink()) pending.push(path.join(folder,item.name));
      }
    }
    if (git('rev-parse','--symbolic-full-name','HEAD') === 'HEAD') {
      const prior = git('rev-parse','--verify','HEAD');
      if (!revision(prior)) throw Error('unresolved_local_revision');
      if (prior !== target && !git('for-each-ref','--contains',prior,'--count=1')) {
        git('update-ref','refs/oop/preserved/'+prior,prior,'0'.repeat(prior.length));
      }
    }
    git('switch','--detach','--discard-changes',target);
    git('clean','-fdx');
    if (git('rev-parse','HEAD') !== target || git('status','--porcelain','--untracked-files=all','--ignored')) throw Error('checkout_incomplete');
    return target;
  } finally { fs.rmdirSync(disabledEvents); }
}
function freshness(scope, registration, now, synchronize) {
  const source = registration.source;
  if (!source || typeof source.url !== 'string' || source.url.length > 2048 || !id(source.remote) || typeof source.ref !== 'string') return {status:'unsupported'};
  const zone = registration.timezone ?? 'UTC';
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const key = hash(JSON.stringify([scope.checkout,source.url,source.remote,source.ref,zone]));
  const file = path.join(scope.common,'oop-daily.json');
  return locked(path.join(scope.common,'oop-checkout.lock'),()=>{
    const previous = read(file);
    if (previous?.day === day && previous.key !== key) return {status:'source_conflict'};
    if (previous?.key === key && previous.day === day && previous.status !== 'attempting') return previous;
    const attempt = {key,day,timezone:zone,attempt_at:now.toISOString(),last_success:previous?.key === key ? previous.last_success : null};
    save(file,{...attempt,status:'attempting'});
    let result;
    try {
      const target = synchronize(scope.checkout,source,observed=>{
        attempt.observed_target = observed;
        save(file,{...attempt,status:'attempting'});
      });
      if (!revision(target)) throw Error('revision_unobserved');
      result = {...attempt,status:'synchronized',target,last_success:{target,at:new Date().toISOString()}};
    } catch { result = {...attempt,status:'failed'}; }
    save(file,result);
    return result;
  });
}
function conversation(scope, event, routing) {
  if (!id(event.chat)) return {state:'intake',history:[],status:'chat_unavailable'};
  const targetLocation = path.join(scope.owned,'context');
  if(event.event==='snapshot'&&!fs.existsSync(targetLocation))return {state:'intake',history:[],status:'chat_unavailable'};
  const location = directory(targetLocation,event.event!=='snapshot');
  const key = hash(event.chat);
  const file = path.join(location,key+'.json');
  return locked(path.join(location,'history.lock'),()=>{
    const stored = read(file);
    if (!stored && ['record','snapshot'].includes(event.event)) return {state:'intake',history:[],status:'chat_unavailable'};
    if (!stored && event.event === 'prompt') {
      const names = fs.readdirSync(location).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
      let retained = names.length;
      for (const name of names) {
        const candidate = path.join(location,name);
        const stat = fs.lstatSync(candidate);
        if (stat.isFile() && stat.nlink === 1 && Date.now()-stat.mtimeMs > 30*86400000) {
          fs.unlinkSync(candidate);
          retained--;
        }
      }
      if (retained >= 128) return {state:'intake',history:[],status:'history_capacity_reached'};
    }
    const prior = stored ?? {sequence:0,version:0,state:'intake',history:[],subjects:[],receipts:[]};
    if (stored && !Object.hasOwn(prior,'subjects') && !Object.hasOwn(prior,'receipts')) {
      // Retained claims without correlation remain claims, never invented receipts.
      prior.subjects=[];prior.receipts=[];prior.uncorrelated_retained_claims=true;
    }
    if (!Number.isSafeInteger(prior.sequence) || !Number.isSafeInteger(prior.version) ||
        prior.sequence < 0 || prior.version < prior.sequence || !Object.hasOwn(states,prior.state) ||
        !Array.isArray(prior.history) || prior.history.length > 16) throw Error('invalid_chat_state');
    const facets = value => {
      if (!Array.isArray(value) || value.length>8 || value.some(item=>!Object.hasOwn(routing,item) ||
          routing[item].some(module=>['bootstrap','producer'].includes(module)))) throw Error('unresolved_retained_facets');
      return value;
    };
    prior.history = prior.history.map(entry=>{
      if (!Number.isSafeInteger(entry?.turn) || entry.turn < 1 || entry.turn > prior.sequence ||
          !Object.hasOwn(states,entry.state)) throw Error('invalid_history');
      return {turn:entry.turn,state:entry.state,...(id(entry.subject)?{subject:entry.subject}:{}),...(/^G[0-4]$/.test(entry.level) ?
        {level:entry.level,related_ticket:entry.related_ticket===true,facets:facets(entry.facets),
          ...(relations.includes(entry.relation)?{relation:entry.relation}:{})}: {})};
    });
    if (!Array.isArray(prior.subjects) || prior.subjects.length>16 || !Array.isArray(prior.receipts) || prior.receipts.length>32) throw Error('incompatible_chat_state');
    for (const subject of prior.subjects) {
      if (!id(subject.subject) || !Object.hasOwn(states,subject.state) || !Number.isSafeInteger(subject.turn) ||
          subject.turn<1 || subject.turn>prior.sequence || !/^G[0-4]$/.test(subject.level) || typeof subject.related_ticket!=='boolean' ||
          !relations.includes(subject.relation)) throw Error('invalid_subject_state');
      facets(subject.facets);
    }
    for (const entry of prior.receipts) if (!id(entry.request_id) || !/^[a-f0-9]{64}$/.test(entry.fingerprint) ||
        entry.receipt?.disposition!=='accepted' || !id(entry.receipt.subject) || entry.receipt.turn>prior.sequence ||
        !Number.isSafeInteger(entry.receipt.version) || entry.receipt.version>prior.version) throw Error('invalid_receipt_state');
    if (event.event === 'session_open' || event.event === 'snapshot') return prior;
    if (event.event === 'prompt') {
      if(prior.sequence===Number.MAX_SAFE_INTEGER||prior.version===Number.MAX_SAFE_INTEGER)return {...prior,status:'revision_capacity_reached'};
      const current = {turn:prior.sequence+1,state:'intake'};
      const updated = {...prior,sequence:current.turn,version:prior.version+1,state:current.state,history:[...prior.history.slice(-15),current]};
      save(file,updated);
      return updated;
    }
    const payload = Object.fromEntries(eventFields.record.map(key=>[key,event[key]]));
    const fingerprint = hash(JSON.stringify(payload));
    const previous = prior.receipts.find(entry=>entry.request_id===event.request_id);
    if (previous) {
      if (previous.fingerprint!==fingerprint) return {...prior,status:'correlation_conflict',receipt:{disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn}};
      if (event.turn!==prior.sequence) return {...prior,status:'stale_or_invalid_transition',receipt:{...previous.receipt,disposition:'stale'}};
      return {...prior,status:'record_accepted',receipt:{...previous.receipt,replayed:true}};
    }
    const subject = prior.subjects.find(item=>item.subject===event.subject && item.turn===prior.sequence);
    const from = subject?.state ?? 'intake';
    if (!prior.sequence || event.turn !== prior.sequence || event.expected_version !== prior.version ||
        !(Object.hasOwn(states[from].next,event.state) || (subject && from===event.state))) return {...prior,status:'stale_or_invalid_transition',receipt:{disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn}};
    if(prior.version===Number.MAX_SAFE_INTEGER)return {...prior,status:'revision_capacity_reached'};
    if (!subject && prior.subjects.filter(item=>item.turn===prior.sequence).length>=16) return {...prior,status:'subject_capacity_reached'};
    const current = {subject:event.subject,turn:prior.sequence,state:event.state,level:event.level,related_ticket:event.related_ticket,
      facets:facets(event.facets),relation:event.relation};
    const receipt = {disposition:'accepted',installation_uid:scope.installation_uid,chat:event.chat,request_id:event.request_id,
      subject:event.subject,turn:prior.sequence,version:prior.version+1,state:event.state,level:event.level,
      related_ticket:event.related_ticket,facets:event.facets,relation:event.relation};
    const updated = {...prior,version:receipt.version,state:current.state,history:[...prior.history.slice(-15),current],
      subjects:[...prior.subjects.filter(item=>item.subject!==event.subject).slice(-15),current],
      receipts:[...prior.receipts.slice(-31),{request_id:event.request_id,fingerprint,receipt}]};
    save(file,updated);
    return {...updated,status:'record_accepted',receipt};
  });
}
function sharedInstructions(scope, registration, config) {
  const state = (name,records=[])=>({state:name,records});
  function layer(name,root) {
    const locator = registration.instruction_sources?.[name];
    if (locator === null) return state('confirmed_absent');
    if (typeof locator !== 'string' || !path.isAbsolute(locator) || !inside(root,locator) ||
        samePath(path.resolve(locator),root) || /(?:^|[\\/])(?:\.git|credentials|authentication|secrets|\.ssh|\.env)(?:[\\/]|$)/i.test(locator)) return state('unknown');
    try {
      directory(path.dirname(locator));
      const file = fs.lstatSync(locator);
      if (file.isDirectory()) {
        directory(locator);
        const names = fs.readdirSync(locator).filter(entry=>entry.endsWith('.json')).sort();
        if (names.length > 32) return state('unknown');
        return state('found',names.map(entry=>read(path.join(locator,entry))));
      }
      const records = read(locator);
      return Array.isArray(records) && records.length <= 32 ? state('found',records) : state('unknown');
    } catch (error) { return state(error.code === 'ENOENT' ? 'confirmed_absent' : 'inaccessible'); }
  }
  const view = path.join(scope.common,'runtime-instructions.rendered.md');
  const expectedMandatory=renderMandatoryProcedures(config.source_binding.source_identity);
  return locked(path.join(scope.common,'runtime-instructions.lock'),()=>{
    const layers = {organization:layer('organization',scope.operations),workspace:layer('workspace',scope.common)};
    function canonical(reference) {
      const target = path.resolve(scope.operations,reference);
      if (path.isAbsolute(reference) || !inside(scope.operations,target) || samePath(scope.operations,target)) return false;
      try { directory(path.dirname(target)); return fs.lstatSync(target).isFile() && samePath(fs.realpathSync(target),target); }
      catch { return false; }
    }
    const set = composeRuntimeInstructions({layers,canonical,contractIds:config.contract_ids,sourceIdentity:config.source_binding.source_identity,
      sha:bytes=>'sha256:'+hash(bytes)});
    let priorMandatory={status:'missing'};
    try {
      const prior = fs.lstatSync(view);
      if (!prior.isFile() || prior.nlink !== 1 || prior.size > 256*1024) throw Error('unsafe_view');
      const actual=fs.readFileSync(view,'utf8');
      priorMandatory=verifyMandatoryView(actual,expectedMandatory);
      if (actual !== set.markdown) writeAtomic(view,set.markdown);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      writeAtomic(view,set.markdown);
    }
    const observed=fs.readFileSync(view,'utf8');
    const verified=verifyMandatoryView(observed,expectedMandatory);
    if(verified.status!=='present_and_integral'||observed!==set.markdown)throw Error('mandatory_context_unavailable');
    return {status:set.complete?'available':'incomplete',locator:view,identity:set.identity,
      mandatory:{source_identity:config.source_binding.source_identity,prior:priorMandatory.status,status:verified.status,basis:'Actual generated workspace block compared with the configured controller source; adopted-checkpoint applicability remains independent.'},
      layers:set.layers,conflicts:set.conflicts.slice(0,16),...(Buffer.byteLength(set.text)<=4096?{text:set.text}:{})};
  });
}
function migrationContext(scope, registration, target) {
  const distribution = path.join(scope.checkout,'dist');
  const procedure = path.join(distribution,'procedures','lifecycle.json');
  const index = path.join(distribution,'migrations','index.json');
  const context = {target,procedure,index,status:'runtime_reconciliation_required'};
  try {
    directory(path.dirname(procedure));
    directory(path.dirname(index));
    const lifecycle = read(procedure);
    const migration = read(index);
    if (!lifecycle?.routes?.adoption || migration?.format !== 1) throw Error('migration_contract_unavailable');
    context.scopes = {};
    for (const name of ['common','runtime','operations']) {
      const disposition = migration.scopes?.[name]?.disposition;
      if (!['not_required','required','unknown'].includes(disposition)) throw Error('migration_scope_unavailable');
      context.scopes[name] = {disposition};
      if (disposition === 'required') {
        const descriptor = 'migrations/'+name+'.json';
        if (migration.scopes[name].descriptor !== descriptor || !read(path.join(distribution,descriptor))) throw Error('migration_descriptor_unavailable');
        context.scopes[name].descriptor = path.join(distribution,descriptor);
      }
    }
  } catch {
    return {...context,status:'migration_procedures_unavailable',
      instruction:'Recover the applicable migration contract. Preserve the owned verified adoption checkpoint and continue independent authorized work.'};
  }
  try {
    const checkpoint = registration.adoption_checkpoint;
    if (typeof checkpoint === 'string' && path.isAbsolute(checkpoint) && inside(scope.owned,checkpoint)) {
      directory(path.dirname(checkpoint));
      const recorded = read(checkpoint);
      if (recorded?.installation_uid === registration.installation_uid && recorded?.verified_commit === target &&
          recorded?.applied_commit === target && typeof recorded?.verification_ref === 'string' && recorded.verification_ref) {
        return {...context,status:'owned_checkpoint_reports_target',
          instruction:'Reuse the owned adoption evidence only while its governing dependencies remain current.'};
      }
    }
  } catch { /* The runtime still needs to reconcile its checkpoint. */ }
  return {...context,instruction:'Execute the applicable adoption and migration procedures before relying on the synchronized target rules. Inspect the owned adoption checkpoint first. Reuse matching verified facts, reconcile unfinished actions and verify before advancing adoption. Keep peer checkpoints unchanged.'};
}
function makeController(config, synchronize = gitSynchronize) {
  function modules(ids) {
    const selected = new Set();
    function add(name) {
      if (name === 'bootstrap' || selected.has(name)) return;
      const module = config.modules.find(item=>item.id===name);
      if (!module) return;
      module.dependencies.forEach(add);
      selected.add(name);
    }
    ids.forEach(add);
    return [...selected].map(id=>({id,locator:'modules/'+id+'.json'}));
  }
  function compose(registration, event, now = new Date()) {
    let result = {status:'available',state:'intake',history:[],freshness:{status:'not_applicable'}};
    try {
      if (registration.lifecycle !== 'active') {
        if(registration.lifecycle==='bootstrapping'&&event?.event!=='snapshot'){
          try{const scope=workspace(registration);result.workspace={root:scope.root,cwd:scope.root,checkout:scope.checkout,operations:scope.operations};result.instructions=sharedInstructions(scope,registration,config);}
          catch{result.instructions={status:'unavailable',mandatory:{source_identity:config.source_binding?.source_identity??'unknown',prior:'verification_unavailable',status:'verification_unavailable',basis:'Generated workspace verification unavailable; resolve the selected initial target and authorized local prerequisites without claiming adoption.'}};}
        }
        return response({...result,status:'bootstrap_or_inactive'});
      }
      const scope = workspace(registration);
      const cwd = directory(event?.cwd ?? scope.root);
      if (!inside(scope.root,cwd)) throw Error('wrong_workspace');
      result.workspace = {root:scope.root,cwd,checkout:scope.checkout,operations:scope.operations};
      result.binding = {interface:interfaceVersion,installation_uid:registration.installation_uid,chat:id(event?.chat)?event.chat:undefined,
        registration:path.join(scope.owned,'oop-context-registration.json'),adapter:path.join(scope.owned,'oop-runtime-adapter.js'),
        controller:path.join(scope.checkout,'dist','oop-enforce.js'),interpreter:process.execPath};
      const invalid = validateEvent(event,config.facets);
      if (invalid) return response({...result,status:invalid,diagnostic:{code:invalid,remedy:'Read the event contract; resolve every missing, invalid or unknown material field before submitting. Use the resolved snapshot entry to recover current state. Do not infer acceptance.'}});
      if (registration.filesystem_local !== true) return response({...result,status:'local_coordination_unavailable'});
      if (!['record','snapshot'].includes(event.event)) {
        try { result.freshness = freshness(scope,registration,now,synchronize); }
        catch { result.freshness = {status:'unavailable'}; }
      }
      const chat = conversation(scope,event,config.facets);
      result = {...result,state:chat.state ?? 'intake',turn:chat.sequence,version:chat.version,history:chat.history ?? [],
        subjects:chat.subjects ?? [],receipts:chat.receipts?.map(entry=>entry.receipt) ?? [],receipt:chat.receipt,
        uncorrelated_retained_claims:chat.uncorrelated_retained_claims===true,status:chat.status ?? 'available'};
      if (event.event !== 'snapshot') {
        try { result.instructions = sharedInstructions(scope,registration,config); }
        catch { result.instructions = {status:'unavailable'}; }
      }
      if (result.freshness.status === 'synchronized') {
        result.migration = migrationContext(scope,registration,result.freshness.target);
      }
    } catch { result.status = 'context_unavailable'; result.diagnostic={code:'context_unavailable',remedy:'Reconcile the owned registration, local paths and coordination journal under current repair authority. Preserve safe active state; never claim acceptance or bypass host consent.'}; }
    return response(result);
  }
  function response(result) {
    const current = states[result.state];
    const location = result.workspace ? path.join(result.workspace.checkout,'dist') : config.distribution;
    const pendingMigration = result.migration && result.migration.status !== 'owned_checkpoint_reports_target';
    const knowledgeRequired=(result.subjects??[]).some(item=>item.turn===result.turn&&!item.facets?.includes('technical_adoption')&&['G2','G3','G4'].includes(item.level));
    const classified = [...new Set((result.subjects ?? []).filter(item=>item.turn===result.turn).flatMap(item=>item.facets))];
    const currentStates=[...new Set([result.state,...(result.subjects??[]).filter(item=>item.turn===result.turn).map(item=>item.state)])];
    const context = {...result,module_base:location,
      module_basis:pendingMigration?'candidate_target_requires_adoption':'resolve_against_owned_verified_adoption',
      modules:modules([...currentStates.flatMap(state=>states[state].modules),...classified.flatMap(facet=>config.facets[facet]),...(knowledgeRequired?['knowledge']:[]),...(pendingMigration?['migration-distribution']:[])]),
      reachable:Object.entries(current.next).map(([state,consequence])=>({state,consequence,modules:modules(states[state].modules)}))};
    const {state,modules:currentModules,reachable,workspace,history,turn,version,freshness,migration,status,module_base,module_basis,instructions,binding,receipt,subjects,receipts,diagnostic} = context;
    const invoke = mode=>binding ? {executable:binding.interpreter,args:[binding.controller,path.dirname(binding.registration),mode],stdin:'one UTF-8 JSON object; no executable interpolation'} : null;
    const operational = binding && Number.isSafeInteger(turn) && turn>0 && Number.isSafeInteger(version);
    const procedure = {
      interface:interfaceVersion,availability:operational?'ready':'unavailable',binding,
      actor:'The receiving runtime of the bound installation and actual native chat.',
      triggers:['session_open','prompt','record_response','snapshot_recovery','changed_effective_scope','completion_reassessment','supported_context_recovery'],
      prerequisites:'Current project/installation identity, applicable adopted context, actual host capability and independent authority. Binding locators describe the configured route, not proof that it is installed. No substantive classification submission is possible without an actual current prompt turn.',
      force:'MUST; derived procedure under the applicable complete OOP clauses, not independent effect authority.',
      timing:'Classify and submit every new subject, including G0, before its substantive answer or dependent effect. A new prompt is a new turn, not necessarily a new subject. Reuse the subject identifier for continuation, clarification or correction; classify changed effective scope before the newly affected effect. Record each applicable state transition before relying on it and inspect its acknowledgment. Reassess completion and recovery; do not create artificial transitions or tickets.',
      context:{action:'Read complete applicable modules at module_base plus locator, and their dependency closure, before dependent work. Load only missing or stale context; never audit release hashes. When module_basis requires adoption, reconcile the owned checkpoint and migration instructions first.',modules:currentModules,reachable},
      lifecycle:{entry:path.join(location,'entry.json'),procedure:path.join(location,'procedures','lifecycle.json'),bootstrap:path.join(location,'procedures','bootstrap.json'),
        action:'When bootstrapping or inactive, read the resolved entry and bootstrap procedure and execute its applicable ordered steps under current authority. Verify both complete mandatory texts in the resolved generated workspace view against the applicable distribution rendering; distinguish all five outcomes and repair/read back only authorized owned state. Initial target is not adopted state; never audit the OOP repository or read PROTOCOL.md. On adoption or recovery, read the resolved lifecycle route and referenced complete procedure before dependent reliance; preserve the owned verified checkpoint and actual partial effects.'},
      shared_instructions:{locator:instructions?.locator,status:instructions?.status,
        action:'Apply the delivered shared instructions under canonical precedence. Read the complete resolved rendered view before dependent work. Verify both complete source-bound mandatory texts by deterministic content comparison; headings and layer-set identity cannot suffice. Check actual adopted checkpoint applicability independently, preserve valid layers, reverify authorized repair, and report unavailable source or verification without blocking independent work. Incomplete, conflicting or unavailable layers require scoped source reconciliation; no locator or runtime claim grants authority.'},
      submission:{invocation:invoke('record'),required:eventFields.record.filter(key=>key!=='cwd'),
        contract_locator:path.join(location,'interfaces.json')+'#/enforcement',
        syntax:{identifiers:{fields:['request_id','subject','chat'],type:'string',max_length:128,pattern:'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$'},
          turn_and_expected_version:'Use the current positive safe integers shown in input; do not quote or invent them.',
          related_ticket:'JSON boolean, not a string; false when no real ticket is related.',facets:{type:'array',max_items:8,unique:true,items:'Exact strings from allowed_facets; unresolved material applicability is not an empty known classification.'},
          unknown_fields:'Reject. Optional cwd is the actual observed working folder within the registered workspace.'},
        input:{event:'record',chat:binding?.chat,turn,expected_version:version,request_id:'CHOOSE a fresh bounded correlation ID; retain it with the exact payload for uncertain retries',
          subject:'CHOOSE or REUSE a bounded subject ID, never raw request text',state:'SELECT a reachable state for this subject; a new-turn subject starts at intake',
          level:'CLASSIFY G0..G4',related_ticket:'SUPPLY an actual boolean; G0 creates no artificial ticket',facets:'SELECT every applicable known facet; resolve unknown material facets without silently dropping them',relation:'SELECT independent|continuation|clarification|correction|scope_change|cancellation|replacement'},
        subject_states:(subjects??[]).filter(item=>item.turn===turn).map(item=>({subject:item.subject,state:item.state})),
        state_routes:Object.fromEntries([...new Set(['intake',...currentStates])].map(state=>[state,{same_state_update:state,
          reachable:Object.entries(states[state].next).map(([state,consequence])=>({state,consequence,modules:modules(states[state].modules)}))}])),
        route_resolution:'For a new or new-turn subject use state_routes.intake.reachable. For a retained current-turn subject resolve its state in subject_states and use state_routes[state].reachable; same_state_update is only for a real classification reassessment without an artificial lifecycle step. Load that selected route module closure before dependent work.',
        allowed_facets:Object.keys(config.facets).filter(facet=>!config.facets[facet].some(module=>['bootstrap','producer'].includes(module))).sort(),
        acceptance:'Require type=oop_context, matching source_binding/interface, context.status=record_accepted and context.receipt.disposition=accepted. Match installation_uid, chat, request_id, subject, turn, state, level, related_ticket, facets, relation and the resulting version against the submitted payload; first acceptance has version=expected_version+1. Replayed receipts attest their original accepted revision, never a newer transition. Exit 0, JSON syntax or a chat declaration is insufficient.',
        failure:'Any other disposition is unaccepted. For stale, busy, timeout or lost response, retrieve snapshot and inspect retained correlated receipts and actual current state before retry. A matching accepted receipt resolves uncertainty; absence is not proof of failure after retention expiry. Never overwrite concurrent state or silently replay a new prompt. Changed payload requires a fresh request_id. Missing acceptance blocks claims of recorded completion and dependent work, while independent authorized work may continue with the limitation disclosed.'},
      snapshot:{invocation:invoke('snapshot'),input:{event:'snapshot',chat:binding?.chat},effect:'Read current turn, revision, subjects and bounded accepted receipts; no turn increment, daily synchronization or instruction-view rewrite.'},
      limits:'At most 16 retained subjects, 16 history entries and 32 receipts per chat. Technical attributed claims only, no raw prompts, secrets or unrelated chat content. Context delivery and acceptance grant no host permission and prove no effect.',
      next:operational?'Load applicable context, classify each pending subject, invoke record using the resolved executable and argument vector above, then inspect the correlated acknowledgment before dependent reliance. Follow reachable consequences and independent authority checks.':'Use the bootstrap/adoption or scoped repair procedure for the actual unavailable dependency. Do not invent chat, turn, revision, successful installation or acceptance. Continue independent authorized work.'
    };
    context.procedure=procedure;
    const message = {source_binding:config.source_binding,workspace,history,current:{state,turn,version,modules:currentModules},reachable,module_base,module_basis,freshness,migration,status,instructions,binding,receipt,
      subjects:subjects?.filter(item=>item.turn===turn),receipt_history:{count:receipts?.length??0,retrieval:'Invoke the resolved procedure.snapshot to inspect complete bounded context.receipts before uncertain retry.'},
      uncorrelated_retained_claims:result.uncorrelated_retained_claims,diagnostic,procedure};
    if (instructions?.text && Buffer.byteLength(JSON.stringify(message)) > 8000) {
      const {text,...locator} = instructions;
      message.instructions = locator;
    }
    const additionalContext = ['Resolve and read the shared rendered view before substantive work. Verify both mandatory procedures at its head.',orientation,operational?reminder:'Complete only the applicable bootstrap or recovery work; ordinary classification submission is unavailable without current correlated state.',JSON.stringify(message)].join('\n');
    return {format:1,type:'oop_context',source_binding:config.source_binding,additionalContext,context};
  }
  return {compose,response,config};
}
async function runCLI(controller, args = process.argv.slice(2)) {
  const runtime=contextRuntime(controller,controller.config.adapter_template);
  let input='',failure;
  const timer=setTimeout(()=>{failure='input_timeout';process.stdin.destroy();},4000);
  try {process.stdin.setEncoding('utf8');for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>65536){failure='input_limit';break;}}}
  catch {failure??='input_invalid';}
  finally {clearTimeout(timer);}
  const output=await runtime.execute(args,failure?'':input);
  if(failure){let root;try{root=runtime.absolute(args[0],'directory');}catch{}runtime.persist(root,Error(failure));}
  function failed(){let root;try{root=runtime.absolute(args[0],'directory');}catch{}runtime.persist(root,Error('delivery_failed'));process.exitCode=1;}
  process.stdout.on('error',failed);process.stderr.on('error',failed);
  process.stdout.write(output.stdout);process.stderr.write(output.stderr);process.exitCode=output.exitCode;
}
if (typeof module !== 'undefined') module.exports = {makeController,gitSynchronize,reminder,runCLI};
