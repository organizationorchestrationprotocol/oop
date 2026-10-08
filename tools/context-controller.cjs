'use strict';
const fs = process.getBuiltinModule('node:fs');
const path = process.getBuiltinModule('node:path');
const { createHash, randomUUID } = process.getBuiltinModule('node:crypto');
const { spawnSync } = process.getBuiltinModule('node:child_process');
const { composeRuntimeInstructions, runtimeOperationalRules, renderMandatoryProcedures, verifyMandatoryView } = require('./runtime-instructions.cjs');
const {contextRuntime}=require('./context-runtime.cjs');
const {contextAcquisition}=require('./context-acquisition.cjs');
const {runtimeGuidance}=require('./runtime-guidance.cjs');
const guidance=runtimeGuidance();
const acquisition=contextAcquisition();
const {knowledgeRecords}=require('./knowledge-records.cjs');
const knowledgeChecks = knowledgeRecords();

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
  operation_entry:['event','chat','cwd'], operation_completion:['event','chat','cwd'],
  // UX-09: a native turn end; origin user or unknown interrupts the turn, model closes it.
  turn_stop:['event','chat','cwd','origin'],
  record:['event','chat','cwd','request_id','subject','turn','expected_version','state','level','related_ticket','facets','relation','work_item','domains','knowledge']
};
const stopOrigins = ['user','model','unknown'];
const turnStates = ['active','interrupted','closed'];
const optionalRecordFields = ['cwd','work_item','domains','knowledge'];
const knowledgeFields = ['work_item','domains','knowledge'];
// KP-14: governed records declare knowledge; other records carry no knowledge declaration.
const governedRecord = event => ['G2','G3','G4'].includes(event.level) && ['planning','execution','verification'].includes(event.state) && !event.facets.includes('technical_adoption');
// Field-level diagnostics never echo free text: strings outside a closed set report only type and length.
function describe(value, closed = []) {
  if (value === undefined) return 'absent';
  if (value === null) return 'null';
  if (typeof value === 'boolean' || Number.isSafeInteger(value)) return value;
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return closed.includes(value) ? value : 'string(length '+value.length+')';
  if (Array.isArray(value)) return 'array(length '+value.length+')';
  return typeof value;
}
const identifierRule = '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$';
const technicalExclusive = ['managed_change','ticket_mutation','knowledge_profiles','canonical_write','organizational_migration'];
function validateEvent(event, routing) {
  const item = (field,rule,expected,received)=>({field,rule,expected,received});
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.event!=='string' || !Object.hasOwn(eventFields,event.event))
    return {code:'unsupported_event',items:[item('event','enum',Object.keys(eventFields),describe(event?.event,Object.keys(eventFields)))]};
  const items = Object.keys(event).filter(key=>!eventFields[event.event].includes(key)).map(key=>item(key.length<=64&&/^[A-Za-z0-9_]+$/.test(key)?key:'(unknown field)','unknown_field','absent','present'));
  if (!id(event.chat)) items.push(item('chat','identifier',identifierRule,describe(event.chat)));
  if (event.cwd !== undefined && (typeof event.cwd !== 'string' || event.cwd.length>1024)) items.push(item('cwd','path','string of at most 1024 characters',describe(event.cwd)));
  if (event.event === 'turn_stop' && !stopOrigins.includes(event.origin)) items.push(item('origin','enum',stopOrigins,describe(event.origin,stopOrigins)));
  if (items.length) return {code:'invalid_event',items};
  if (event.event !== 'record') return;
  for (const key of eventFields.record.filter(key=>!optionalRecordFields.includes(key)))
    if (!Object.hasOwn(event,key)) items.push(item(key,'required','present','absent'));
  for (const key of ['request_id','subject']) if (Object.hasOwn(event,key) && !id(event[key])) items.push(item(key,'identifier',identifierRule,describe(event[key])));
  for (const key of ['turn','expected_version'])
    if (Object.hasOwn(event,key) && (!Number.isSafeInteger(event[key]) || event[key]<1)) items.push(item(key,'positive_integer','JSON integer >= 1',describe(event[key])));
  const enums = {state:Object.keys(states),level:['G0','G1','G2','G3','G4'],relation:relations};
  for (const [key,values] of Object.entries(enums))
    if (Object.hasOwn(event,key) && !values.includes(event[key])) items.push(item(key,'enum',values,describe(event[key],values)));
  if (Object.hasOwn(event,'related_ticket') && typeof event.related_ticket!=='boolean') items.push(item('related_ticket','type','boolean',typeof event.related_ticket === 'string' ? 'string' : describe(event.related_ticket)));
  const facetsValid = Array.isArray(event.facets) && event.facets.length<=8 && new Set(event.facets).size===event.facets.length && event.facets.every(facet=>typeof facet==='string');
  if (Object.hasOwn(event,'facets') && !facetsValid) items.push(item('facets','array','unique strings from allowed_facets, at most 8',describe(event.facets)));
  if (items.length) return {code:'invalid_record',items};
  if (event.facets.includes('technical_adoption') && (event.related_ticket || event.facets.some(facet=>technicalExclusive.includes(facet))))
    return {code:'invalid_record',items:[item('facets','technical_adoption_exclusive','technical_adoption without related_ticket and without '+technicalExclusive.join(', '),'conflicting combination')]};
  const unknown = event.facets.map((facet,index)=>({facet,index})).filter(({facet})=>!Object.hasOwn(routing,facet) || routing[facet].some(module=>['bootstrap','producer'].includes(module)));
  if (unknown.length) return {code:'unresolved_facets',items:unknown.map(({facet,index})=>item('facets['+index+']','known_facet','one of allowed_facets',describe(facet)))};
  const declared = knowledgeFields.filter(key=>Object.hasOwn(event,key));
  if (!governedRecord(event)) return declared.length ? {code:'invalid_record',items:declared.map(key=>item(key,'governed_only','omit unless level G2-G4 in planning, execution or verification without technical_adoption',describe(event[key])))} : undefined;
  if (!declared.length) return {code:'knowledge_declaration_missing',items:knowledgeFields.map(key=>item(key,'required_when_governed','present','absent'))};
  const governed = [];
  for (const key of knowledgeFields) if (!Object.hasOwn(event,key)) governed.push(item(key,'required_when_governed','present','absent'));
  if (Object.hasOwn(event,'work_item') && !id(event.work_item)) governed.push(item('work_item','identifier',identifierRule,describe(event.work_item)));
  if (Object.hasOwn(event,'domains') && (!Array.isArray(event.domains) || !event.domains.length || event.domains.length>16 ||
      new Set(event.domains).size!==event.domains.length || !event.domains.every(id))) governed.push(item('domains','array','1 to 16 unique identifiers',describe(event.domains)));
  if (Object.hasOwn(event,'knowledge') && !knowledgeChecks.declarationShape(event.knowledge)) governed.push(item('knowledge','declaration_shape','contract_locator knowledge declaration',describe(event.knowledge)));
  if (governed.length) return {code:'invalid_record',items:governed};
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
  writeAtomic(target,serialize(value));
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
// Session response store: <owned-scope>/context/<session_key>.json keeps bounded state, a response index and errors;
// every native response is written once to <owned-scope>/context/<session_key>/<response_id>.json and never rewritten.
const retention = {idle_expiry_days:30,minimum_retention_hours:24,session_soft_limit:128,total_bytes:32*1024*1024,
  response_index:16,errors:16,unbound_responses:16,line_bytes:4096,file_bytes:262144+65536,orphan_temporary_minutes:60};
const reservedKeys = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9]|unbound|history\.lock)(?:\.|$)|^h-[a-f0-9]{64}$/i;
function sessionKey(chat) {
  return /^[a-z0-9][a-z0-9_.-]{0,127}$/.test(chat) && !chat.endsWith('.') && !reservedKeys.test(chat) ? chat : 'h-'+hash(chat);
}
function serialize(value) {
  const text = acquisition.encode(value);
  if (text.split('\n').some(line=>Buffer.byteLength(line)>retention.line_bytes) || Buffer.byteLength(text)>retention.file_bytes) throw Error('output_invalid');
  return text;
}
function removeEntry(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw Error('unsafe_path');
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target)) removeEntry(path.join(target,name));
    fs.rmdirSync(target);
  } else fs.unlinkSync(target);
}
// PROP-08: pruning within declared retention; never the current session, an active session or a response inside the minimum window.
function prune(location, currentKey, now = Date.now()) {
  const minimum = retention.minimum_retention_hours*3600000, expiry = retention.idle_expiry_days*86400000;
  const entries = fs.readdirSync(location,{withFileTypes:true});
  let removed = 0;
  const drop = target=>{ try { removeEntry(target); removed++; } catch (error) { if (error.code !== 'ENOENT') throw error; } };
  for (const entry of entries) if (entry.isFile() && entry.name.endsWith('.tmp') &&
      now-fs.lstatSync(path.join(location,entry.name)).mtimeMs > retention.orphan_temporary_minutes*60000) drop(path.join(location,entry.name));
  const size = target=>{
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory()) return stat.size;
    return fs.readdirSync(target).reduce((sum,name)=>sum+size(path.join(target,name)),0);
  };
  const sessions = new Map();
  for (const entry of fs.readdirSync(location,{withFileTypes:true})) {
    if (entry.isSymbolicLink() || entry.name === 'history.lock' || entry.name.endsWith('.tmp')) continue;
    const key = entry.isDirectory() ? entry.name : entry.name.replace(/\.json$/,'');
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,129}$/.test(key) || key === 'unbound') continue;
    const target = path.join(location,entry.name), stat = fs.lstatSync(target);
    const session = sessions.get(key) ?? {key,targets:[],active:0,bytes:0};
    session.targets.push(target);
    session.active = Math.max(session.active,stat.mtimeMs);
    session.bytes += size(target);
    sessions.set(key,session);
  }
  const removable = session => session.key !== currentKey && now-session.active > minimum;
  for (const session of sessions.values()) {
    const oversize = session.targets.some(target=>fs.lstatSync(target).isFile() && fs.lstatSync(target).size > retention.file_bytes);
    if (removable(session) && (now-session.active > expiry || oversize)) { session.targets.forEach(drop); sessions.delete(session.key); }
  }
  const responses = (folder, keep) => {
    if (!fs.existsSync(folder)) return;
    for(const name of [...keep])try{
      if(!/^r-[a-z0-9]+-[a-f0-9-]{8}\.json$/.test(name))continue;
      const target=path.join(folder,name),stat=fs.lstatSync(target);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>retention.file_bytes||!samePath(fs.realpathSync(target),target))continue;
      const record=JSON.parse(fs.readFileSync(target,'utf8'));
      if(/^d-[a-f0-9]{64}\.json$/.test(record.definitions?.procedure?.locator))keep.add(record.definitions.procedure.locator);
    }catch{/* Missing content remains an explicit unresolved dependency. */}
    for (const name of fs.readdirSync(folder)) {
      const target = path.join(folder,name);
      if (!keep.has(name) && now-fs.lstatSync(target).mtimeMs > minimum) drop(target);
    }
  };
  const current = read(path.join(location,currentKey+'.json'));
  const retained=new Set((current?.responses ?? []).map(item=>item.response_id+'.json'));
  if(current?.acquisition?.target&&!current.acquisition.complete&&!current.acquisition.failed)retained.add(current.acquisition.target.response_id+'.json');
  responses(path.join(location,currentKey),retained);
  const unbound = path.join(location,'unbound');
  if (fs.existsSync(unbound)) {
    const names = fs.readdirSync(unbound).filter(name=>name.startsWith('r-')).sort((a,b)=>fs.lstatSync(path.join(unbound,b)).mtimeMs-fs.lstatSync(path.join(unbound,a)).mtimeMs);
    responses(unbound,new Set(names.slice(0,retention.unbound_responses)));
  }
  const ordered = [...sessions.values()].sort((a,b)=>a.active-b.active);
  let total = ordered.reduce((sum,session)=>sum+session.bytes,0), count = ordered.length;
  for (const session of ordered) {
    if (count <= retention.session_soft_limit && total <= retention.total_bytes) break;
    if (!removable(session)) continue;
    session.targets.forEach(drop); count--; total -= session.bytes;
  }
  return {status:count <= retention.session_soft_limit && total <= retention.total_bytes ? 'within_limits' : 'over_soft_limit',removed,
    limits:{idle_expiry_days:retention.idle_expiry_days,minimum_retention_hours:retention.minimum_retention_hours,sessions:retention.session_soft_limit,total_bytes:retention.total_bytes}};
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
// KP-11/KP-14: verify a governed declaration against the derived index and actual profile bytes in local canonical operations.
function verifyKnowledge(scope, event) {
  const declared = event.knowledge.profiles.map(item=>({id:item.id,revision:item.revision,content_identity:item.content_identity,disposition:item.disposition})).slice(0,16);
  let index;
  try {
    index = read(path.join(scope.operations,knowledgeChecks.INDEX)) ?? knowledgeChecks.emptyIndex();
    if (!knowledgeChecks.validateIndex(index)) return {status:'rejected',code:'knowledge_index_incompatible',items:['knowledge_index'],remedy:knowledgeChecks.remedy('knowledge_index_incompatible'),profiles:declared,pending:[]};
  } catch(error) {
    if(error instanceof SyntaxError)return {status:'rejected',code:'knowledge_index_incompatible',items:['knowledge_index_json'],remedy:knowledgeChecks.remedy('knowledge_index_incompatible'),profiles:declared,pending:[]};
    return {status:'unverified_store_unavailable',profiles:declared,pending:['Store access unavailable; knowledge readiness remains unverified.']};
  }
  function readProfile(locator) {
    if (!knowledgeChecks.validLocator(locator)) throw Error('unsafe_locator');
    const target = path.resolve(scope.operations,locator);
    if (!inside(scope.operations,target)) throw Error('unsafe_locator');
    directory(path.dirname(target));
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.size > 1048576 || !samePath(fs.realpathSync(target),target)) throw Error('unsafe_profile');
    return fs.readFileSync(target,'utf8');
  }
  let record;
  try{const extracted=knowledgeChecks.extractRecord(readProfile(event.knowledge.record_ref));if(extracted.error)throw Error('invalid_record');record=extracted.record;}
  catch{return {status:'rejected',code:'knowledge_record_mismatch',items:['record_ref'],remedy:knowledgeChecks.remedy('knowledge_record_mismatch'),profiles:declared,pending:[]};}
  const result = knowledgeChecks.verifyDeclaration({index,knowledge:event.knowledge,ctx:{level:event.level,facets:event.facets,domains:event.domains},state:event.state,readProfile,record,expectedInput:knowledgeChecks.inputReference(event.chat,event.turn),installation:scope.installation_uid,workItem:event.work_item});
  if(result.status==='verified'){result.record_ref=event.knowledge.record_ref;result.record_identity=event.knowledge.record_identity;result.plan={id:record.plan.id,version:record.plan.version,identity:knowledgeChecks.workflow.planIdentity(record.plan),validation_ref:record.plan.validation?.source_ref??null};}
  const located = new Map(index.profiles.map(item=>[item.id,item.locator]));
  result.profiles = declared.map(item=>({...item,...(located.has(item.id)?{locator:located.get(item.id)}:{})}));
  return result;
}
const knowledgeSummary = value => value && typeof value === 'object' && ['verified','unverified_store_unavailable'].includes(value.status) &&
  Array.isArray(value.profiles) && value.profiles.length<=16 && Array.isArray(value.pending) && value.pending.length<=16 &&
  (value.record_ref===undefined||knowledgeChecks.validLocator(value.record_ref)) && (value.record_identity===undefined||/^sha256:[a-f0-9]{64}$/.test(value.record_identity));
function knowledgeObligation(subject,workspace){
  const summary={subject:subject.subject,state:subject.state,work_item:subject.work_item??null,status:'undeclared',profiles:[],pending:[]};
  if(!workspace||!subject.knowledge?.record_ref)return summary;
  const readOwned=locator=>{
    if(!knowledgeChecks.validLocator(locator))throw Error('unsafe_locator');
    const file=path.resolve(workspace.operations,locator);
    if(!inside(workspace.operations,file))throw Error('unsafe_locator');
    directory(path.dirname(file));const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.size>1048576||!samePath(fs.realpathSync(file),file))throw Error('unsafe_record');
    return fs.readFileSync(file,'utf8');
  };
  try{
    const document=readOwned(subject.knowledge.record_ref);
    if(/^\s*\{/.test(document)&&['closed','cancelled'].includes(JSON.parse(document).state))return null;
    const extracted=knowledgeChecks.extractRecord(document);if(extracted.error)throw Error('record_unavailable');
    const record=extracted.record,index=JSON.parse(readOwned(knowledgeChecks.INDEX));
    if(!knowledgeChecks.validateIndex(index))throw Error('index_unavailable');
    const errors=knowledgeChecks.validateRecord(record,index,'planning',readOwned);
    return {...summary,status:errors.length?'record_invalid':'current_record',record_ref:subject.knowledge.record_ref,
      record_identity:knowledgeChecks.identity(knowledgeChecks.canonical(record)),
      profiles:(record.profiles??[]).slice(0,16).map(p=>({id:p.id,revision:p.revision,content_identity:p.content_identity,publication:index.profiles.find(e=>e.id===p.id&&e.revision===p.revision)?.publication??'unverified',provenance:index.profiles.find(e=>e.id===p.id)?.provenance?.kind??'unknown'})),
      scoped_entries:record.plan?.scoped_entries??[],draft_profiles:record.plan?.draft_profiles??[],schema_ref:record.schema_ref,
      plan:record.plan?{id:record.plan.id,version:record.plan.version,state:record.plan.state,identity:knowledgeChecks.workflow.planIdentity(record.plan)}:null,
      continuation:record.plan?.state==='validated'?{execution:'Current validated plan and completed incorporation permit direct execution submission in a later turn; current input, version and authority remain required.',verification:'Canonical in-progress or executed work and applied method steps permit direct verification submission; no fictitious replay.'}:null,
      candidate_concepts:(record.plan?.candidate_concepts??[]).filter(c=>!record.incorporations?.some(i=>i.concept_id===c.id&&i.plan_identity===knowledgeChecks.workflow.planIdentity(record.plan))).map(c=>c.id),publications:record.publications??[],
      pending:errors.slice(0,16).map(e=>({code:e.code,item:e.item})),open_gaps:(record.gaps??[]).filter(g=>g.status==='open').map(g=>g.id).slice(0,16)};
  }catch{return {...summary,status:'unverified_store_unavailable',record_ref:subject.knowledge.record_ref,pending:['Resolve current canonical work-item knowledge before dependent work.']};}
}
function conversation(scope, event, routing) {
  if (!id(event.chat)) return {state:'intake',history:[],status:'chat_unavailable'};
  const targetLocation = path.join(scope.owned,'context');
  if(event.event==='snapshot'&&!fs.existsSync(targetLocation))return {state:'intake',history:[],status:'chat_unavailable'};
  const location = directory(targetLocation,event.event!=='snapshot');
  const key = sessionKey(event.chat);
  const file = path.join(location,key+'.json');
  return locked(path.join(location,'history.lock'),()=>{
    // Current-state reconciliation: an observed hashed session file becomes the session-key file once.
    const legacy = path.join(location,hash(event.chat)+'.json');
    if (!fs.existsSync(file) && legacy !== file && fs.existsSync(legacy) && fs.lstatSync(legacy).isFile()) fs.renameSync(legacy,file);
    const stored = read(file);
    if (!stored && event.event === 'turn_stop') return {state:'intake',history:[],status:'available'};
    if (!stored && ['record','snapshot'].includes(event.event)) return {state:'intake',history:[],status:'chat_unavailable'};
    if (!stored && event.event === 'prompt') prune(location,key);
    const prior = stored ?? {sequence:0,version:0,state:'intake',history:[],subjects:[],receipts:[]};
    if (stored && !Object.hasOwn(prior,'subjects') && !Object.hasOwn(prior,'receipts')) {
      // Retained claims without correlation remain claims, never invented receipts.
      prior.subjects=[];prior.receipts=[];prior.uncorrelated_retained_claims=true;
    }
    if (!Number.isSafeInteger(prior.sequence) || !Number.isSafeInteger(prior.version) ||
        prior.sequence < 0 || prior.version < prior.sequence || !Object.hasOwn(states,prior.state) ||
        !Array.isArray(prior.history) || prior.history.length > 16) throw Error('invalid_chat_state');
    if (prior.turn_state !== undefined && (!Number.isSafeInteger(prior.turn_state?.turn) || prior.turn_state.turn < 1 || prior.turn_state.turn > prior.sequence ||
        !turnStates.includes(prior.turn_state.state) || (prior.turn_state.origin !== undefined && !stopOrigins.includes(prior.turn_state.origin)))) throw Error('invalid_chat_state');
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
          !relations.includes(subject.relation) || (subject.work_item!==undefined && !id(subject.work_item)) ||
          (subject.knowledge!==undefined && !knowledgeSummary(subject.knowledge))) throw Error('invalid_subject_state');
      facets(subject.facets);
    }
    for (const entry of prior.receipts) if (!id(entry.request_id) || !/^[a-f0-9]{64}$/.test(entry.fingerprint) ||
        entry.receipt?.disposition!=='accepted' || !id(entry.receipt.subject) || entry.receipt.turn>prior.sequence ||
        !Number.isSafeInteger(entry.receipt.version) || entry.receipt.version>prior.version) throw Error('invalid_receipt_state');
    if (['session_open','snapshot','operation_entry','operation_completion'].includes(event.event)) return prior;
    if (event.event === 'prompt') {
      if(prior.sequence===Number.MAX_SAFE_INTEGER||prior.version===Number.MAX_SAFE_INTEGER)return {...prior,status:'revision_capacity_reached'};
      const current = {turn:prior.sequence+1,state:'intake'};
      const updated = {...prior,sequence:current.turn,version:prior.version+1,state:current.state,history:[...prior.history.slice(-15),current],
        turn_state:{turn:current.turn,state:'active'}};
      save(file,updated);
      // UX-09: the stopped turn is reported once, in the response file of the next user turn.
      return prior.turn_state?.state === 'interrupted' ? {...updated,prior_turn:prior.turn_state} : updated;
    }
    if (event.event === 'turn_stop') {
      if (!prior.sequence) return {...prior,status:'available'};
      // A user stop is never downgraded by a later model end of the same turn.
      const kept = prior.turn_state?.turn === prior.sequence && prior.turn_state.state === 'interrupted';
      const updated = kept ? prior : {...prior,turn_state:{turn:prior.sequence,state:event.origin === 'model' ? 'closed' : 'interrupted',origin:event.origin}};
      if (!kept) save(file,updated);
      return {...updated,status:'available'};
    }
    const payload = Object.fromEntries(eventFields.record.map(key=>[key,event[key]]));
    const fingerprint = hash(JSON.stringify(payload));
    const previous = prior.receipts.find(entry=>entry.request_id===event.request_id);
    const subject = prior.subjects.find(item=>item.subject===event.subject && item.turn===prior.sequence);
    let continuation=null;
    if(!subject&&governedRecord(event)&&knowledgeChecks.validLocator(event.knowledge?.record_ref))try{
      const target=path.resolve(scope.operations,event.knowledge.record_ref);if(!inside(scope.operations,target))throw Error();directory(path.dirname(target));
      const stat=fs.lstatSync(target);if(!stat.isFile()||stat.nlink!==1||stat.size>1048576||!samePath(fs.realpathSync(target),target))throw Error();
      const document=fs.readFileSync(target,'utf8'),record=knowledgeChecks.extractRecord(document).record;
      if(record?.work_item===event.work_item&&record.installation_uid===scope.installation_uid&&knowledgeChecks.identity(knowledgeChecks.canonical(record))===event.knowledge.record_identity&&record.plan?.state==='validated'&&
        !knowledgeChecks.workflow.planErrors(record.plan,{workItem:event.work_item,profiles:record.profiles,state:'planning'}).length){
        if(event.state==='execution')continuation='planning';
        if(event.state==='verification'&&['in_progress','executed','verification'].includes(JSON.parse(document).state)&&record.profiles.every(p=>p.steps.every(s=>s.disposition!=='planned')))continuation='execution';
      }
    }catch{/* Uncertain canonical continuation never creates a reachable state. */}
    const from = subject?.state ?? continuation ?? 'intake';
    const allowed = [...Object.keys(states[from].next).filter(state=>state!=='intake'||subject),...(subject?[from]:[])];
    const currentValues = {turn:prior.sequence,version:prior.version,subject_state:subject?.state ?? null,allowed_states:[...new Set(allowed)]};
    const rejected = (status,items,receipt)=>({...prior,status,receipt,diagnostic:{code:status,items,current:currentValues,
      remedy:'Correct exactly the listed fields using the current values above, then resubmit with a fresh request_id. Do not infer acceptance.'}});
    if (previous) {
      if (previous.fingerprint!==fingerprint) return rejected('correlation_conflict',[{field:'request_id',rule:'fresh_for_changed_payload',expected:'a new request_id',received:'reused with a different payload'}],
        {disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn});
      if (event.turn!==prior.sequence) return rejected('stale_or_invalid_transition',[{field:'turn',rule:'current_turn',expected:prior.sequence,received:event.turn}],{...previous.receipt,disposition:'stale'});
      return {...prior,status:'record_accepted',receipt:{...previous.receipt,replayed:true}};
    }
    if (prior.turn_state?.state === 'interrupted' && prior.turn_state.turn === prior.sequence)
      return {...prior,status:'turn_interrupted',receipt:{disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn},
        diagnostic:{code:'turn_interrupted',items:[{field:'turn',rule:'active_turn',expected:'a turn opened by a new user prompt',received:event.turn}],current:currentValues,
          remedy:'The user stopped this turn (UX-09). Do not resubmit or resume its work; wait for new user input and report observed in-progress effects then.'}};
    const transition = [];
    if (!prior.sequence) transition.push({field:'turn',rule:'current_turn',expected:'a turn opened by a prompt event',received:event.turn});
    else if (event.turn !== prior.sequence) transition.push({field:'turn',rule:'current_turn',expected:prior.sequence,received:event.turn});
    if (event.expected_version !== prior.version) transition.push({field:'expected_version',rule:'current_version',expected:prior.version,received:event.expected_version});
    if (!(Object.hasOwn(states[from].next,event.state) || (subject && from===event.state))) transition.push({field:'state',rule:'reachable_state',expected:currentValues.allowed_states,received:event.state});
    if (transition.length) return rejected('stale_or_invalid_transition',transition,{disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn});
    if(prior.version===Number.MAX_SAFE_INTEGER)return {...prior,status:'revision_capacity_reached'};
    if (!subject && prior.subjects.filter(item=>item.turn===prior.sequence).length>=16) return {...prior,status:'subject_capacity_reached'};
    let knowledge;
    if (governedRecord(event)) {
      const verified = verifyKnowledge(scope,event);
      if (verified.status === 'rejected') return {...prior,status:verified.code,receipt:{disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn},
        diagnostic:{code:verified.code,items:verified.items,remedy:verified.remedy}};
      knowledge = {status:verified.status,profiles:verified.profiles,pending:verified.pending,...(verified.record_ref?{record_ref:verified.record_ref,record_identity:verified.record_identity,plan:verified.plan}:{})};
    }
    const declaration = knowledge ? {work_item:event.work_item,knowledge} : {};
    const current = {subject:event.subject,turn:prior.sequence,state:event.state,level:event.level,related_ticket:event.related_ticket,
      facets:facets(event.facets),relation:event.relation,...declaration};
    const receipt = {disposition:'accepted',installation_uid:scope.installation_uid,chat:event.chat,request_id:event.request_id,
      subject:event.subject,turn:prior.sequence,version:prior.version+1,state:event.state,level:event.level,
      related_ticket:event.related_ticket,facets:event.facets,relation:event.relation,...declaration};
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
    let result = {status:'available',state:'intake',history:[],freshness:{status:'not_applicable'},event_kind:event?.event};
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
      if(event?.event!=='turn_stop')result.tool_instructions=guidance.discover(scope,registration,knowledgeChecks.workflow.authorizationErrors);
      result.binding = {interface:interfaceVersion,installation_uid:registration.installation_uid,chat:id(event?.chat)?event.chat:undefined,
        registration:path.join(scope.owned,'oop-context-registration.json'),adapter:path.join(scope.owned,'oop-runtime-adapter.js'),
        controller:path.join(scope.checkout,'dist','oop-enforce.js'),interpreter:process.execPath};
      const invalid = validateEvent(event,config.facets);
      if (invalid) return response({...result,status:invalid.code,diagnostic:{code:invalid.code,items:invalid.items,remedy:invalid.code==='knowledge_declaration_missing'?knowledgeChecks.remedy(invalid.code):
        'Correct exactly the fields listed in items, then resubmit with a fresh request_id. Use snapshot to recover current state. Do not infer acceptance.'}});
      if (registration.filesystem_local !== true) return response({...result,status:'local_coordination_unavailable'});
      if (['session_open','prompt'].includes(event.event)) {
        try { result.freshness = freshness(scope,registration,now,synchronize); }
        catch { result.freshness = {status:'unavailable'}; }
      }
      if (['operation_entry','operation_completion'].includes(event.event)) {
        result.freshness=read(path.join(scope.common,'oop-daily.json'))??{status:registration.source?'unavailable':'unsupported'};
      }
      if (['session_open','prompt','operation_entry','operation_completion'].includes(event.event)) {
        try { result.operations_binding = operationsBinding(scope,registration); }
        catch { result.operations_binding = {status:'unavailable',reason:'check_failed'}; }
      }
      const chat = conversation(scope,event,config.facets);
      result = {...result,state:chat.state ?? 'intake',turn:chat.sequence,version:chat.version,history:chat.history ?? [],
        subjects:chat.subjects ?? [],receipts:chat.receipts?.map(entry=>entry.receipt) ?? [],receipt:chat.receipt,
        uncorrelated_retained_claims:chat.uncorrelated_retained_claims===true,status:chat.status ?? 'available',...(chat.diagnostic?{diagnostic:chat.diagnostic}:{}),
        ...(Array.isArray(chat.errors)&&chat.errors.length?{session_errors:chat.errors.slice(-retention.errors)}:{}),
        // UX-09: report a non-active turn and a stopped previous turn; an active turn adds no bytes.
        ...(chat.turn_state&&chat.turn_state.state!=='active'?{turn_state:chat.turn_state}:{}),...(chat.prior_turn?{prior_turn:chat.prior_turn}:{})};
      if (['session_open','prompt'].includes(event.event)) {
        // ENF-02: outcomes of undecoded native events are retained without delivery and disclosed here.
        // Only outcomes newer than this chat's previous response are disclosed, so each is reported once.
        try { const unbound = path.join(scope.owned,'context','unbound'), since = Date.parse(chat.responses?.at(-1)?.written_at ?? '') || 0;
          const count = fs.readdirSync(unbound).filter(name=>name.startsWith('r-')&&name.endsWith('.json')&&fs.statSync(path.join(unbound,name)).mtimeMs>since).length;
          if (count) result.unbound_diagnostics = {count,location:unbound}; } catch { /* No retained undecoded outcome. */ }
      }
      if (!['snapshot','turn_stop'].includes(event.event)) {
        try { result.instructions = sharedInstructions(scope,registration,config); }
        catch { result.instructions = {status:'unavailable'}; }
      }
      if (result.freshness.status === 'synchronized') {
        result.migration = migrationContext(scope,registration,result.freshness.target);
      }
    } catch { result.status = 'context_unavailable'; result.diagnostic={code:'context_unavailable',remedy:'Reconcile the owned registration, local paths and session store under current repair authority. Preserve safe active state; never claim acceptance or bypass host consent.'}; }
    return response(result);
  }
  // PROP-07: one immutable response file per native invocation, plus a bounded session index and error list.
  function deliver(owned, chat, output, eventName, codes = []) {
    const location = directory(path.join(owned,'context'),true);
    const key = id(chat) ? sessionKey(chat) : null;
    const responseId = 'r-'+Date.now().toString(36)+'-'+randomUUID().slice(0,8);
    const folder = directory(path.join(location,key ?? 'unbound'),true);
    const file = path.join(folder,responseId+'.json');
    const context = output.context ?? {};
      const record = {format:1,type:'oop_controller_response',response_id:responseId,session:key?chat:null,event:eventName ?? null,
      written_at:new Date().toISOString(),status:context.status ?? 'context_unavailable',instructions:output.delivery?.instructions ?? [],
      context:output.delivery?.message ?? {status:context.status,diagnostic:context.diagnostic}};
    const dependency_identity=acquisition.dependency(record.context);
    const stored=acquisition.factor(record,output.delivery?.definition,folder);
    stored.recovery={format:1,dependency_identity,bounds:acquisition.bounds,delivery:'pointer',
      acquisition:{command:'acquire',invocation:context.binding?{executable:context.binding.interpreter,args:[context.binding.controller,owned,'acquire']}:null,
        input:{event:'acquire',chat:chat??null,response_id:responseId,transaction:'<episode-id>',offset:0,depth:0}},
      rule:'Acquire this target and its complete definitions before dependent effects. Equivalent dependency identities do not restart acquisition. Acquisition, validation and bounded diagnostics are permitted under independent host authority. Reuse only currently available verified context. New envelopes alone are not progress.'};
    const storedBytes=serialize(stored),content_identity=acquisition.identity(storedBytes);
    try { fs.writeFileSync(file,storedBytes,{flag:'wx',mode:0o600}); }
    catch (error) { error.locator = file; throw error; }
    const entries = codes.map(code=>({response_id:responseId,code,created_at:record.written_at,
      message:'OOP controller diagnostic: '+code+'. Present it to the user with its translation, then attempt authorized repair. Presentation is not resolution or authority.'}));
    const indexed = locked(path.join(location,'history.lock'),()=>{
      const journal = path.join(owned,'oop-enforce-errors.jsonl');
      if (fs.existsSync(journal) && !fs.existsSync(path.join(owned,'oop-enforce-errors.lock')) && fs.lstatSync(journal).isFile()) {
        const unread = fs.readFileSync(journal,'utf8').split('\n').filter(line=>line.includes('"read":false')).length;
        fs.unlinkSync(journal);
        entries.push({response_id:responseId,code:'legacy_journal_retired',created_at:record.written_at,
          message:'OOP controller diagnostic: an observed error journal was retired; '+unread+' unread entries were discarded. Diagnostics are now delivered in session responses.'});
      }
      let retained;
      if (key) {
        const sessionFile = path.join(location,key+'.json'), legacy = path.join(location,hash(chat)+'.json');
        if (!fs.existsSync(sessionFile) && fs.existsSync(legacy) && fs.lstatSync(legacy).isFile()) fs.renameSync(legacy,sessionFile);
        const state = read(sessionFile) ?? {sequence:0,version:0,state:'intake',history:[],subjects:[],receipts:[]};
        state.responses = [...(Array.isArray(state.responses)?state.responses:[]),{response_id:responseId,event:record.event,status:record.status,
          turn:context.turn ?? null,version:context.version ?? null,dependency_identity,content_identity,written_at:record.written_at,locator:file}].slice(-retention.response_index);
        state.errors = [...(Array.isArray(state.errors)?state.errors:[]),...entries].slice(-retention.errors);
        save(sessionFile,state);
      }
      retained = prune(location,key ?? '');
      return retained;
    });
    return {locator:file,response_id:responseId,dependency_identity,retention:indexed?.status==='busy'?{status:'index_busy'}:indexed};
  }
  function operationsBinding(scope, registration) {
    const recorded = registration.operations_binding;
    if (recorded === undefined) return {status:'not_recorded'};
    if (!recorded || recorded.profile !== 'git' || !Array.isArray(recorded.entries) || !recorded.entries.length || recorded.entries.length > 16 ||
        recorded.entries.some(item=>!item || !/^[a-z_]{1,64}$/.test(item.entry) || typeof item.key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.-]{0,127}$/.test(item.key) ||
          typeof item.value !== 'string' || item.value.length > 1024)) return {status:'unavailable',reason:'invalid_recorded_binding'};
    const env = {...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'};
    for (const name of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|CONFIG(?:_.*)?)$/i.test(name)) delete env[name];
    const items = [];
    for (const item of recorded.entries) {
      const run = spawnSync('git',['-C',scope.operations,'config','--local','--get',item.key],{env,encoding:'utf8',timeout:5000,windowsHide:true});
      if (run.error) return {status:'unavailable',reason:'configuration_tool_unavailable'};
      if (run.status === 1) items.push({entry:item.entry,expected:'recorded value',observed:'absent'});
      else if (run.status !== 0) return {status:'unavailable',reason:'configuration_unreadable'};
      else if (run.stdout.replace(/\r?\n$/,'') !== item.value) items.push({entry:item.entry,expected:'recorded value',observed:'different'});
    }
    return items.length ? {status:'drift',items,action:'Restore the listed repository-scoped entries from the recorded binding under current authority before any effect on operations.'} : {status:'verified'};
  }
  function response(result) {
    const busyPhase = result.busy_phase ??
      (result.status === 'busy' ? 'history' :
        result.freshness?.status === 'busy' ? 'checkout' :
          result.instructions?.status === 'busy' ? 'shared_instructions' : undefined);
    if (busyPhase) result.busy_phase = busyPhase;
    const current = states[result.state];
    const location = result.workspace ? path.join(result.workspace.checkout,'dist') : config.distribution;
    const pendingMigration = result.migration && result.migration.status !== 'owned_checkpoint_reports_target';
    const knowledgeRequired=(result.subjects??[]).some(item=>!item.facets?.includes('technical_adoption')&&['G2','G3','G4'].includes(item.level)&&!['cancellation','replacement'].includes(item.relation));
    const classified = [...new Set((result.subjects ?? []).filter(item=>item.turn===result.turn).flatMap(item=>item.facets))];
    const currentStates=[...new Set([result.state,...(result.subjects??[]).filter(item=>item.turn===result.turn).map(item=>item.state)])];
    const context = {...result,module_base:location,
      module_basis:pendingMigration?'candidate_target_requires_adoption':'resolve_against_owned_verified_adoption',
      modules:modules([...currentStates.flatMap(state=>states[state].modules),...classified.flatMap(facet=>config.facets[facet]),...(knowledgeRequired?['knowledge']:[]),...(pendingMigration?['migration-distribution']:[])]),
      reachable:Object.entries(current.next).map(([state,consequence])=>({state,consequence,modules:modules(states[state].modules)}))};
    const {state,modules:currentModules,workspace,history,turn,version,freshness,migration,status,module_base,module_basis,instructions,binding,receipt,subjects,receipts,diagnostic} = context;
    const invoke = mode=>binding ? {executable:binding.interpreter,args:[binding.controller,path.dirname(binding.registration),mode],stdin:'one UTF-8 JSON object; no executable interpolation'} : null;
    const operational = binding && Number.isSafeInteger(turn) && turn>0 && Number.isSafeInteger(version);
    const allowedFacets = Object.keys(config.facets).filter(facet=>!config.facets[facet].some(module=>['bootstrap','producer'].includes(module))).sort();
    const stateRoutes = Object.fromEntries([...new Set(['intake',...currentStates])].map(state=>[state,{same_state_update:state,
      reachable:Object.entries(states[state].next).map(([state,consequence])=>({state,consequence,modules:modules(states[state].modules)}))}]));
    const subjectStates = (subjects??[]).filter(item=>item.turn===turn).map(item=>({subject:item.subject,state:item.state}));
    // PROP-02: a payload that is accepted as is once its values are replaced by the actual classification.
    const example = operational ? {event:'record',chat:binding.chat,request_id:'r'+turn+'-1',subject:'s'+turn+'-1',turn,expected_version:version,
      state:'inquiry',level:'G0',related_ticket:false,facets:[allowedFacets.includes('information')?'information':allowedFacets[0]],relation:'independent'} : null;
    const dynamic = {availability:operational?'ready':'unavailable',
      submission:{invocation:invoke('record'),example,subject_states:subjectStates,state_routes:stateRoutes},
      snapshot:{invocation:invoke('snapshot'),input:{event:'snapshot',chat:binding?.chat}},
      shared_instructions:{locator:instructions?.locator,status:instructions?.status},
      next:operational?'Load applicable context, classify each pending subject, invoke record using the resolved executable and argument vector, then inspect the correlated acknowledgment before dependent reliance. Follow reachable consequences and independent authority checks.':'Use the bootstrap/adoption or scoped repair procedure for the actual unavailable dependency. Do not invent chat, turn, revision, successful installation or acceptance. Continue independent authorized work.'};
    const fixed = {
      knowledge_contract:{locator:path.join(location,config.knowledge_contract?.path??'knowledge-contract.json'),content_identity:config.knowledge_contract?.content_identity??null,versions:knowledgeChecks.workflow.versions},
      interface:interfaceVersion,
      actor:'The receiving runtime of the bound installation and actual native chat.',
      triggers:['session_open','prompt','operation_entry','operation_completion','record_response','snapshot_recovery','changed_effective_scope','completion_reassessment','supported_context_recovery'],
      prerequisites:'Current project/installation identity, applicable adopted context, actual host capability and independent authority. Binding locators describe the configured route, not proof that it is installed. No substantive classification submission is possible without an actual current prompt turn.',
      force:'MUST; derived procedure under the applicable complete OOP clauses, not independent effect authority.',
      timing:'Classify and submit every new subject, including G0, before its substantive answer or dependent effect. A new prompt is a new turn, not necessarily a new subject. Reuse the subject identifier for continuation, clarification or correction; classify changed effective scope before the newly affected effect. Record each applicable state transition before relying on it and inspect its acknowledgment. Reassess completion and recovery; do not create artificial transitions or tickets.',
      context:{action:'Read complete applicable modules at module_base plus locator, and their dependency closure, before dependent work. current.modules lists the current state closure; submission.state_routes lists reachable states with their modules. Load only missing or stale context; never audit release hashes. When module_basis requires adoption, reconcile the owned checkpoint and migration instructions first.'},
      lifecycle:{entry:path.join(location,'entry.json'),procedure:path.join(location,'procedures','lifecycle.json'),bootstrap:path.join(location,'procedures','bootstrap.json'),
        action:'When bootstrapping or inactive, read the resolved entry and bootstrap procedure and execute its applicable ordered steps under current authority. Verify both complete mandatory texts in the resolved generated workspace view against the applicable distribution rendering; distinguish all five outcomes and repair/read back only authorized owned state. Initial target is not adopted state; never audit the OOP repository or read PROTOCOL.md. On adoption or recovery, read the resolved lifecycle route and referenced complete procedure before dependent reliance; preserve the owned verified checkpoint and actual partial effects.'},
      shared_instructions:{
        tool_guidance:'Resolve the verified tool-type root above this owned installation and read tool_dedicated_instructions.md before dependent integration work. Missing or incomplete guidance requires authorized preparation or a precise limitation. Shared guidance never transfers native consent between installations.',
        authorization:'Reuse a verified scoped mandate for required ordinary publication; obtain only missing native consent through the documented active-turn mechanism. If the turn cannot remain active, state the exact pending action, required authorization and observable resume condition. Persist formal grants through owned sources and regenerated views; approvals are not performance or verification.',
        action:'Apply the delivered shared instructions under canonical precedence. Read the complete resolved rendered view before dependent work. Verify both complete source-bound mandatory texts by deterministic content comparison; headings and layer-set identity cannot suffice. Check actual adopted checkpoint applicability independently, preserve valid layers, reverify authorized repair, and report unavailable source or verification without blocking independent work. Incomplete, conflicting or unavailable layers require scoped source reconciliation; no locator or runtime claim grants authority.'},
      submission:{required:eventFields.record.filter(key=>!optionalRecordFields.includes(key)),
        governed_required:{when:'level G2, G3 or G4 in planning, execution or verification without technical_adoption',fields:knowledgeFields,otherwise:'omit these fields'},
        contract_locator:path.join(location,'interfaces.json')+'#/enforcement',
        schema:{event:{const:'record'},chat:{value:'the bound native chat shown in example.chat'},
          request_id:{type:'string',pattern:identifierRule,rule:'fresh for every new payload; reuse only to replay the identical payload after an uncertain result'},
          subject:{type:'string',pattern:identifierRule,rule:'bounded subject identifier, never raw request text; reuse it for continuation, clarification or correction'},
          turn:{type:'integer',value:'the current turn shown in example.turn'},
          expected_version:{type:'integer',value:'the version shown in example.expected_version for the first record of the turn; after each accepted record, receipt.version of that record'},
          state:{enum:Object.keys(states),rule:'the first record of a subject in this turn selects one state from state_routes.intake.reachable; intake itself is never submitted'},
          level:{enum:['G0','G1','G2','G3','G4']},related_ticket:{type:'boolean',rule:'JSON true or false, never a string; false when no real ticket is related'},
          facets:{type:'array',max_items:8,unique:true,items:'exact strings from allowed_facets; unresolved material applicability is not an empty known classification'},
          relation:{enum:relations},cwd:{optional:true,type:'string',rule:'the actual working folder inside the registered workspace'},
          work_item:{governed_only:true,type:'string',pattern:identifierRule},domains:{governed_only:true,type:'array',min_items:1,max_items:16,items:'unique domain identifiers the effective scope touches; declare conservatively'},
          knowledge:{governed_only:true,format:knowledgeChecks.workflow.versions.declaration,record_ref:'Safe operations-relative work-item locator',record_identity:'Content identity of canonical serialization of its extracted knowledge record',profiles:'Up to 16 entries {id, revision, content_identity, disposition, reason unless applied, steps:[{step_id, disposition}]} for every applicable profile',missing_domains:'Optional entries {domain, gap_ref} for declared domains outside the derived index'},
          unknown_fields:'rejected'},
        rules:['Replace every example value with the actual classification of the subject; the example only shows a payload shape that the controller accepts.',
          'Never submit state intake. A new subject in this turn starts from one state of state_routes.intake.reachable.',
          'After each accepted record, use its receipt.version as expected_version for the next record.',
          'Omit optional and governed-only fields that do not apply; never send null for them.',
          'Send turn and expected_version as JSON integers and related_ticket as a JSON boolean.',
          'On rejection, correct exactly the fields listed in diagnostic.items using diagnostic.current, then resubmit with a fresh request_id.'],
        route_resolution:'For a new or new-turn subject use state_routes.intake.reachable. For a retained current-turn subject resolve its state in subject_states and use state_routes[state].reachable; same_state_update is only for a real classification reassessment without an artificial lifecycle step. Load that selected route module closure before dependent work.',
        allowed_facets:allowedFacets,
        acceptance:'Require type=oop_context, matching source_binding/interface, context.status=record_accepted and context.receipt.disposition=accepted. Match installation_uid, chat, request_id, subject, turn, state, level, related_ticket, facets, relation and the resulting version against the submitted payload; first acceptance has version=expected_version+1. Replayed receipts attest their original accepted revision, never a newer transition. Exit 0, JSON syntax or a chat declaration is insufficient.',
        failure:'Any other disposition is unaccepted. For stale, busy, timeout or lost response, retrieve snapshot and inspect retained correlated receipts and actual current state before retry. A matching accepted receipt resolves uncertainty; absence is not proof of failure after retention expiry. Never overwrite concurrent state or silently replay a new prompt. Changed payload requires a fresh request_id. Missing acceptance blocks claims of recorded completion and dependent work, while independent authorized work may continue with the limitation disclosed.'},
      snapshot:{effect:'Read current turn, revision, subjects with their knowledge summaries, bounded accepted receipts and session errors; no turn increment, daily synchronization or instruction-view rewrite.'},
      user_stop:'UX-09: a user stop ends the turn. turn_state interrupted rejects its records with turn_interrupted; never resume it. prior_turn reports it once at the next prompt: report observed in-progress effects, then follow only the new input. unbound_diagnostics counts undecoded native events delivered without context.',
      session_store:{location:binding?path.join(path.dirname(binding.registration),'context'):null,
        rule:'Each native response is an immutable compact file with a complete reconstructible definition closure. Acquire missing context before dependent effects; acquisition and validation remain permitted. Reuse currently available verified dependencies; delivery-only envelopes do not restart recovery. Use the root-first acquire command for bounded complete segments, or an authorized equivalent read. Missing, stale or altered targets require a bounded diagnostic and current snapshot, never an unchanged retry.',
        errors:'session_errors lists up to 16 recent controller diagnostics. Present each one with its effective-language translation, then attempt authorized repair; no acknowledgment command exists.',
        retention:{idle_expiry_days:retention.idle_expiry_days,minimum_retention_hours:retention.minimum_retention_hours,session_soft_limit:retention.session_soft_limit,total_bytes:retention.total_bytes,response_index:retention.response_index}},
      limits:'At most 16 retained subjects, 16 history entries and 32 receipts per chat. Technical attributed claims only, no raw prompts, secrets or unrelated chat content. Context delivery and acceptance grant no host permission and prove no effect.'
    };
    const identity = 'sha256:'+hash(JSON.stringify(fixed));
    // PROP-04: direct record and snapshot responses carry the procedure by identity plus its dynamic parts.
    const direct = ['record','snapshot'].includes(result.event_kind);
    const procedure = direct ? {interface:interfaceVersion,identity,...dynamic,
      complete:'Resolve this procedure identity through the native response definition closure. Reuse only verified available context; acquire missing or stale definitions.'} :
      {...fixed,identity,...dynamic,submission:{...fixed.submission,...dynamic.submission},snapshot:{...fixed.snapshot,...dynamic.snapshot},
        shared_instructions:{...fixed.shared_instructions,...dynamic.shared_instructions}};
    context.procedure=procedure;
    delete context.event_kind;
    const governed=[...new Map((subjects??[]).filter(item=>['G2','G3','G4'].includes(item.level)&&!item.facets?.includes('technical_adoption')).map(item=>[item.subject,item])).values()].filter(item=>!['cancellation','replacement'].includes(item.relation));
    // KP-14: references and pending obligations only; profile text is read completely from its locator.
    const knowledgeObligations=governed.length?{
      subjects:governed.map(item=>knowledgeObligation(item,workspace)).filter(Boolean),
      locator_base:workspace?.operations??null,index:workspace?path.join(workspace.operations,'oop-knowledge-index.json'):null,
      obligations:['KP-14: Read each applicable profile completely from its locator and declare its indexed revision and content identity before relying on it.',
        'KP-12: Keep exactly one knowledge record in the work item with a disposition for every required step that the next transition requires.',
        'KP-14: Declare work_item, domains and knowledge in every governed planning, execution and verification record and require the accepted receipt.',
        'R14: Run the knowledge validator on every candidate profile, index or work item before publication and never publish a failing candidate.',
        'KP-14: Perform these obligations without offering them as options. Resolve the current input reference, linked correction evaluations, decision dispositions and resource-bound evidence under the complete mandatory procedure in the verified shared view.'],
      validator:binding&&workspace?{executable:binding.interpreter,args:[path.join(path.dirname(binding.controller),'oop-knowledge.js'),'work-item',workspace.operations,'<work-item-file>','--transition','<planning|in_progress|execution|verification|completed|closed>'],
        index_check:[path.join(path.dirname(binding.controller),'oop-knowledge.js'),'index',workspace.operations,'--check']}:null}:undefined;
    if (knowledgeObligations) context.knowledge_obligations = knowledgeObligations;
    const knowledgeInput={reference:binding?.chat&&turn?knowledgeChecks.inputReference(binding.chat,turn):null,basis:binding?.chat&&turn?'native_event':'unavailable',procedure:'Read the complete source-bound mandatory knowledge-profile procedure in the verified shared view before dependent G2-G4 work; classify the current input, reconcile relevant retained work and disclose unresolved knowledge obligations. No raw prompt is retained.'};
    context.knowledge_input=knowledgeInput;
    // PROP-05: every value once; reachable states live only in procedure.submission.state_routes.
    const message = {source_binding:config.source_binding,tool_instructions:result.tool_instructions,workspace,history,current:{state,turn,version,modules:currentModules},module_base,module_basis,freshness,migration,status,instructions,binding,receipt,
      subjects:subjects?.filter(item=>item.turn===turn),receipt_history:{count:receipts?.length??0,retrieval:'Invoke the resolved procedure.snapshot to inspect complete bounded context.receipts before uncertain retry.'},
      uncorrelated_retained_claims:result.uncorrelated_retained_claims,diagnostic,session_errors:result.session_errors,operations_binding:result.operations_binding,
      knowledge_obligations:knowledgeObligations,knowledge_input:knowledgeInput,turn_state:result.turn_state,prior_turn:result.prior_turn,unbound_diagnostics:result.unbound_diagnostics,busy_phase:busyPhase,
      busy_recovery:busyPhase?'Inspect current owned state and correlated receipts before any bounded retry. Preserve live or unverifiable locks. Verify the affected operation and report whether it resumed or remains blocked.':undefined,procedure};
    if (instructions?.text && Buffer.byteLength(JSON.stringify(message)) > 8000) {
      const {text,...locator} = instructions;
      message.instructions = locator;
    }
    const lines = ['Resolve and read the shared rendered view before substantive work. Verify both mandatory procedures at its head.',orientation,operational?reminder:'Complete only the applicable bootstrap or recovery work; ordinary classification submission is unavailable without current correlated state.'];
    // PROP-03: additionalContext never duplicates context; native delivery replaces it with the response-file instruction.
    const additionalContext = status+(receipt?.disposition?' (receipt '+receipt.disposition+(receipt.version?', version '+receipt.version:'')+')':'')+
      '. The complete result is in context'+(diagnostic?.items?'; correct the fields listed in context.diagnostic.items':'')+'.';
    return {format:1,type:'oop_context',source_binding:config.source_binding,additionalContext,context,delivery:{instructions:lines,message,definition:fixed}};
  }
  return {compose,response,deliver,config,resolveResponse:(record,folder)=>acquisition.resolve(record,folder),
    acquire:(root,input)=>acquisition.acquire(root,input,{read,save,locked,sessionKey})};
}
async function runCLI(controller, args = process.argv.slice(2)) {
  const runtime=contextRuntime(controller,controller.config.adapter_template);
  let input='',failure;
  const timer=setTimeout(()=>{failure='input_timeout';process.stdin.destroy();},4000);
  try {process.stdin.setEncoding('utf8');for await(const chunk of process.stdin){input+=chunk;if(Buffer.byteLength(input)>65536){failure='input_limit';break;}}}
  catch {failure??='input_invalid';}
  finally {clearTimeout(timer);}
  const output=await runtime.execute(args,failure?'':input,failure);
  function failed(){process.exitCode=1;}
  process.stdout.on('error',failed);process.stderr.on('error',failed);
  process.stdout.write(output.stdout);process.stderr.write(output.stderr);process.exitCode=output.exitCode;
}
if (typeof module !== 'undefined') module.exports = {makeController,gitSynchronize,reminder,runCLI};
