'use strict';
const fs = process.getBuiltinModule('node:fs');
const path = process.getBuiltinModule('node:path');
const { createHash, randomUUID } = process.getBuiltinModule('node:crypto');
const { spawnSync } = process.getBuiltinModule('node:child_process');
const {runtimePaths}=require('./runtime-paths.cjs');
const pathPolicy=runtimePaths();
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
  session_open:['event','chat','cwd','context_generation'], prompt:['event','chat','cwd','context_generation'], snapshot:['event','chat','cwd'],
  operation_entry:['event','chat','cwd','context_generation'], operation_completion:['event','chat','cwd','context_generation'],
  // UX-09: a native turn end; origin user or unknown interrupts the turn, model closes it.
  turn_stop:['event','chat','cwd','origin','turn','response_delivery'],
  record:['event','chat','cwd','request_id','subject','turn','expected_version','state','level','related_ticket','facets','relation','work_item','domains','knowledge','receipt_basis']
};
const stopOrigins = ['user','model','unknown'];
const turnStates = ['active','interrupted','closed'];
const optionalRecordFields = ['cwd','work_item','domains','knowledge','receipt_basis'];
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
  if (event.context_generation!==undefined&&!id(event.context_generation))
    items.push(item('context_generation','identifier',identifierRule,describe(event.context_generation)));
  if (event.cwd !== undefined && (typeof event.cwd !== 'string' || event.cwd.length>1024)) items.push(item('cwd','path','string of at most 1024 characters',describe(event.cwd)));
  if (event.event === 'turn_stop' && !stopOrigins.includes(event.origin)) items.push(item('origin','enum',stopOrigins,describe(event.origin,stopOrigins)));
  if (event.event === 'turn_stop' && event.turn !== undefined && (!Number.isSafeInteger(event.turn)||event.turn<1))
    items.push(item('turn','positive_integer','JSON integer >= 1',describe(event.turn)));
  if (event.event === 'turn_stop' && event.response_delivery !== undefined && event.response_delivery!=='observed')
    items.push(item('response_delivery','enum',['observed'],describe(event.response_delivery)));
  if (items.length) return {code:'invalid_event',items};
  if (event.event !== 'record') return;
  if (event.receipt_basis!==undefined&&(typeof event.receipt_basis!=='string'||!/^sha256:[a-f0-9]{64}$/.test(event.receipt_basis)))
    items.push(item('receipt_basis','content_identity','sha256 with 64 lowercase hexadecimal characters',describe(event.receipt_basis)));
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
function directory(target, create = false, field = 'path', mappings = []) {
  target = pathPolicy.resolve(target,field,mappings);
  if (target !== path.dirname(target)) directory(path.dirname(target),create,field);
  if (create && !fs.existsSync(target)) {
    try { fs.mkdirSync(target); } catch (error) { if(error.code !== 'EEXIST') throw error; }
  }
  pathPolicy.inspect(target,field,'directory');
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
function locked(target, work, delays = []) {
  let fd;
  for(let attempt=0;;attempt++)try { fd=fs.openSync(target,'wx'); break; }
  catch(error) {
    if(error.code!=='EEXIST')throw error;
    if(attempt===delays.length)return {status:'busy'};
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delays[attempt]);
  }
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
function serialize(value, limit = retention.file_bytes) {
  const text = acquisition.encode(value);
  if (text.split('\n').some(line=>Buffer.byteLength(line)>retention.line_bytes) || Buffer.byteLength(text)>limit) throw Error('output_invalid');
  return text;
}
// Session state: one byte limit governs reading and writing. Every save compacts to the threshold, so a written
// state is always readable; an oversized state found on read is repaired under the session lock or quarantined.
const sessionLimits = {state_bytes:65536,compaction_bytes:49152,repair_ceiling_bytes:retention.file_bytes};
function sessionFailure(code, detail) { const error = Error(code); error.session = {code,...detail}; return error; }
const continuationRemedies = {
  record_unreadable:'Declare the safe operations-relative locator of the current readable work item in knowledge.record_ref.',
  record_work_item_mismatch:'Declare the work item whose knowledge record is referenced.',
  record_installation_mismatch:'Another installation last wrote the work item. Record its update under this installation_uid (R04), publish it, declare the new record identity and resubmit.',
  record_identity_mismatch:'Recompute knowledge.record_identity from the current canonical record and resubmit.',
  plan_not_validated:'Submit planning first: direct entry requires a current validated plan.',
  plan_invalid:'Submit planning first and correct the plan errors reported there.',
  work_state_not_executed:'Direct verification requires a canonical work item in state in_progress, executed or verification; submit execution first.',
  steps_planned:'Direct verification requires no planned step dispositions; submit execution first.'};
// Known session-store failures keep their own code, the file, observed and expected values and the next action.
function sessionDiagnostic(error) {
  if (error?.session) return {...error.session,remedy:error.session.action ?? 'The current turn subjects alone exceed the session state limit. Submit fewer subjects in this turn and continue in the next owner turn. Never edit controller-owned session files.'};
  if (error?.message === 'unsafe_state') return {code:'unsafe_state',expected:'a regular session state file with one link',
    remedy:'Restore the owned session store location to regular files under current repair authority. Never edit controller-owned session contents.'};
  return undefined;
}
function compactReceipt(entry) {
  const knowledge = entry?.receipt?.knowledge;
  if (!knowledge || !Object.hasOwn(knowledge,'profiles') && !Object.hasOwn(knowledge,'pending') && !Object.hasOwn(knowledge,'plan')) return entry;
  // The canonical work item and the immutable response file retain the complete declaration.
  return {...entry,receipt:{...entry.receipt,knowledge:{status:knowledge.status,...(knowledge.record_ref?{record_ref:knowledge.record_ref,
    record_identity:knowledge.record_identity,plan_identity:knowledge.plan?.identity ?? null}:{})}}};
}
function compactState(state) {
  const value = {...state,receipts:(Array.isArray(state.receipts)?state.receipts:[]).map(compactReceipt)};
  const size = () => Buffer.byteLength(acquisition.encode(value));
  const subjects = () => Array.isArray(value.subjects) ? value.subjects : [];
  const newest = entry => subjects().some(item=>item.subject===entry.receipt?.subject) &&
    value.receipts.findLast(other=>other.receipt?.subject===entry.receipt?.subject) === entry;
  // Oldest first: receipts, response index, errors, history, then subjects of earlier turns.
  while (size() > sessionLimits.compaction_bytes) {
    const receipt = value.receipts.findIndex(entry=>!newest(entry));
    if (receipt >= 0) { value.receipts = value.receipts.filter((_,n)=>n!==receipt); continue; }
    if (Array.isArray(value.responses) && value.responses.length > 1) { value.responses = value.responses.slice(1); continue; }
    if (Array.isArray(value.errors) && value.errors.length) { value.errors = value.errors.slice(1); continue; }
    if (Array.isArray(value.history) && value.history.length > 1) { value.history = value.history.slice(1); continue; }
    const subject = subjects().findIndex(item=>item.turn !== value.sequence);
    if (subject >= 0) { value.subjects = subjects().filter((_,n)=>n!==subject); continue; }
    throw sessionFailure('session_state_oversized',{observed_bytes:size(),limit_bytes:sessionLimits.state_bytes});
  }
  return value;
}
function saveSession(target, value) {
  const compacted = compactState(value);
  writeAtomic(target,serialize(compacted,sessionLimits.state_bytes));
  return compacted;
}
function readSession(target, repair = true) {
  let stat;
  try { stat = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  if (!stat.isFile() || stat.nlink !== 1) throw Error('unsafe_state');
  if (stat.size <= sessionLimits.state_bytes) return JSON.parse(fs.readFileSync(target,'utf8'));
  if (!repair) throw Error('session_read_requires_lock');
  // Callers hold the session lock. Repair keeps counters and current subjects; failure quarantines, never deletes.
  let state;
  if (stat.size <= sessionLimits.repair_ceiling_bytes) try { state = JSON.parse(fs.readFileSync(target,'utf8')); } catch { state = undefined; }
  const at = new Date().toISOString(), object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const notice = (code, detail, message) => ({response_id:null,code,created_at:at,...detail,limit_bytes:sessionLimits.state_bytes,
    message:'OOP controller diagnostic: '+code+'. '+message+' Never edit controller-owned session files.'});
  if (object(state)) try {
    const entry = notice('session_state_compacted',{locator:target,before_bytes:stat.size,after_bytes:0},
      'The controller compacted an oversized session state file and verified it by reading it back; no repair action is required.');
    const repaired = compactState({...state,errors:[...(Array.isArray(state.errors)?state.errors:[]),entry].slice(-retention.errors)});
    saveSession(target,repaired);
    repaired.errors.at(-1).after_bytes = fs.lstatSync(target).size;
    saveSession(target,repaired);
    const verified = JSON.parse(fs.readFileSync(target,'utf8'));
    if (fs.lstatSync(target).size > sessionLimits.state_bytes || verified.sequence !== state.sequence || verified.version !== state.version) throw Error('unsafe_state');
    return verified;
  } catch { /* An unrepairable state is quarantined below. */ }
  const quarantined = target+'.'+at.replace(/[^0-9]/g,'')+'.quarantine';
  fs.renameSync(target,quarantined);
  // Recoverable counters are preserved; an unparsable state restarts the turn sequence.
  const counters = object(state) && Number.isSafeInteger(state.sequence) && Number.isSafeInteger(state.version) && state.sequence >= 0 && state.version >= state.sequence;
  const fresh = {sequence:counters?state.sequence:0,version:counters?state.version:0,state:'intake',history:[],subjects:[],receipts:[],
    errors:[notice('session_state_quarantined',{locator:quarantined,before_bytes:stat.size},
      'The controller moved an unrepairable session state file aside and started a new state'+(counters?' with the same turn and version counters':'; the next owner prompt opens turn 1')+'. Retained subjects and receipts of this chat are no longer available; resolve current work-item state from canonical records.')]};
  saveSession(target,fresh);
  return fresh;
}
// Inventory is read-only. Applying its bounded plan requires fresh owned state.
function prune(location, currentKey, now = Date.now()) {
  const minimum = retention.minimum_retention_hours*3600000, expiry = retention.idle_expiry_days*86400000;
  const entries = fs.readdirSync(location,{withFileTypes:true});
  const candidates = new Map();
  const drop = (target, scope)=>{
    if (candidates.has(target)) return;
    try {
      const stat=fs.lstatSync(target);
      if (stat.isDirectory()&&!stat.isSymbolicLink()) {
        for (const name of fs.readdirSync(target)) drop(path.join(target,name),scope);
      }
      candidates.set(target,{target,scope,stat});
    } catch (error) { if (error.code!=='ENOENT') throw error; }
  };
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
    const session = sessions.get(key) ?? {key,targets:[],observed:new Map(),active:0,bytes:0};
    session.targets.push(target);
    session.observed.set(target,stat);
    session.active = Math.max(session.active,stat.mtimeMs);
    session.bytes += size(target);
    sessions.set(key,session);
  }
  const removable = session => session.key !== currentKey && now-session.active > minimum;
  for (const session of sessions.values()) {
    const oversize = session.targets.some(target=>!target.endsWith('.quarantine') && fs.lstatSync(target).isFile() && fs.lstatSync(target).size > retention.file_bytes);
    if (removable(session) && (now-session.active > expiry || oversize)) { session.targets.forEach(target=>drop(target,session)); sessions.delete(session.key); }
  }
  const responses = (folder, keep) => {
    if (!fs.existsSync(folder)) return;
    for(const name of [...keep])try{
      if(!/^r-[a-z0-9]+-[a-f0-9-]{8}\.json$/.test(name))continue;
      const target=path.join(folder,name),stat=fs.lstatSync(target);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>retention.file_bytes||!pathPolicy.aliasFree(target))continue;
      const record=JSON.parse(fs.readFileSync(target,'utf8'));
      for(const {locator} of Object.values(record.definitions??{}))if(/^d-[a-f0-9]{64}\.json$/.test(locator))keep.add(locator);
    }catch{/* Missing content remains an explicit unresolved dependency. */}
    for (const name of fs.readdirSync(folder)) {
      const target = path.join(folder,name);
      if (name!=='pending-end.json'&&!name.endsWith('.pending-index')&&!keep.has(name)&&
          !(name.endsWith('.json')&&fs.existsSync(target.replace(/\.json$/,'.pending-index')))&&
          now-fs.lstatSync(target).mtimeMs>minimum) drop(target);
    }
  };
  let current;
  try {
    const stateFile=path.join(location,currentKey+'.json'),stat=fs.lstatSync(stateFile);
    if (stat.isFile()&&stat.nlink===1&&stat.size<=sessionLimits.state_bytes) current=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  } catch (error) { if (error.code!=='ENOENT'&&!(error instanceof SyntaxError)) throw error; }
  const retained=new Set((current?.responses ?? []).map(item=>item.response_id+'.json'));
  for(const episode of [current?.acquisition,...Object.values(current?.component_acquisitions??{})])
    if(episode?.target&&!episode.complete&&!episode.failed)retained.add(episode.target.response_id+'.json');
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
    session.targets.forEach(target=>drop(target,session)); count--; total -= session.bytes;
  }
  return {candidates:[...candidates.values()].slice(0,64),remaining:candidates.size>64,
    overLimit:count>retention.session_soft_limit||total>retention.total_bytes};
}
function applyRetention(plan,location,key,state,now=Date.now()) {
  const protectedFiles=new Set((state?.responses??[]).flatMap(item=>[item.response_id+'.json',...(item.definitions??[])]));
  for(const episode of [state?.acquisition,...Object.values(state?.component_acquisitions??{})])
    if(episode?.target&&!episode.complete&&!episode.failed){
      protectedFiles.add(episode.target.response_id+'.json');
      for(const locator of episode.target.definitions??[])protectedFiles.add(locator);
    }
  const scopeChecks=new Map();
  let removed=0, deferred=0;
  for (const {target,scope,stat} of plan.candidates) {
    try {
      if (scope&&!scopeChecks.has(scope.key)) {
        scopeChecks.set(scope.key,scope.targets.every(file=>{
          const fresh=fs.lstatSync(file),observed=scope.observed.get(file);
          return fresh.dev===observed.dev&&fresh.ino===observed.ino&&fresh.mtimeMs===observed.mtimeMs&&
            fresh.size===observed.size&&now-fresh.mtimeMs>retention.minimum_retention_hours*3600000;
        }));
      }
      if (!pathPolicy.aliasFree(path.dirname(target))) { deferred++; continue; }
      const fresh=fs.lstatSync(target);
      if ((scope&&!scopeChecks.get(scope.key))||(!scope&&path.dirname(target)===path.join(location,key)&&protectedFiles.has(path.basename(target)))||
          (!scope&&target.endsWith('.json')&&fs.existsSync(target.replace(/\.json$/,'.pending-index')))||
          fresh.dev!==stat.dev||fresh.ino!==stat.ino||fresh.isDirectory()!==stat.isDirectory()||
          (!fresh.isDirectory()&&(fresh.mtimeMs!==stat.mtimeMs||fresh.size!==stat.size))) { deferred++; continue; }
      if (fresh.isDirectory()&&!fresh.isSymbolicLink()) fs.rmdirSync(target);
      else fs.unlinkSync(target);
      removed++;
    } catch (error) {
      if (error.code==='ENOENT') continue;
      if (error.code==='ENOTEMPTY'||error.code==='EEXIST') { deferred++; continue; }
      throw error;
    }
  }
  return {status:plan.overLimit||plan.remaining||deferred?'over_soft_limit':'within_limits',removed,deferred,
    limits:{idle_expiry_days:retention.idle_expiry_days,minimum_retention_hours:retention.minimum_retention_hours,sessions:retention.session_soft_limit,total_bytes:retention.total_bytes}};
}
function workspace(registration) {
  const mappings=pathPolicy.mappings(registration.path_mappings);
  const root = directory(registration.project_root,false,'registration.project_root',mappings);
  const priv = directory(path.join(root,'.priv'));
  const common = directory(path.join(priv,'common'));
  const owned = directory(registration.owned_scope,false,'registration.owned_scope',mappings);
  const tools = path.join(priv,'tools');
  if (!id(registration.installation_uid) || !inside(tools,owned) || samePath(tools,owned) ||
      !samePath(path.basename(owned),registration.installation_uid)) throw Error('invalid_owner');
  const checkout = directory(path.join(common,'oop'));
  const operations = directory(path.join(root,'operations'));
  return {root,common,owned,checkout,operations,mappings,installation_uid:registration.installation_uid};
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
    if (git('rev-parse','--show-cdup') !== '' ||
        git('rev-parse','--path-format=relative','--git-dir') !== '.git') throw Error('wrong_checkout');
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
    if (!stat.isFile() || stat.size > 1048576 || !pathPolicy.aliasFree(target)) throw Error('unsafe_profile');
    return fs.readFileSync(target,'utf8');
  }
  let record;
  try{const extracted=knowledgeChecks.extractRecord(readProfile(event.knowledge.record_ref));if(extracted.error)throw Error('invalid_record');record=extracted.record;}
  catch{return {status:'rejected',code:'knowledge_record_mismatch',items:['record_ref'],details:[{field:'record_ref',rule:'safe operations-relative locator of a readable work item containing exactly one knowledge record',expected:'readable work item',received:event.knowledge.record_ref}],remedy:knowledgeChecks.remedy('knowledge_record_mismatch'),profiles:declared,pending:[]};}
  // KP-19: a supported historical record is never rewritten through a current transition.
  if(record?.format===1)return {status:'rejected',code:'knowledge_record_historical',items:['record.format'],details:[{field:'record.format',rule:'KP-19 historical records are reconciled through a linked current record',expected:knowledgeChecks.workflow.versions.record,received:1}],remedy:knowledgeChecks.remedy('knowledge_record_historical'),profiles:declared,pending:[]};
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
    if(!stat.isFile()||stat.size>1048576||!pathPolicy.aliasFree(file))throw Error('unsafe_record');
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
      continuation:record.plan?.state==='validated'?{execution:'A first record of a later turn may enter execution directly only when the referenced record has this work item, this installation_uid, the declared record identity and a valid validated plan; current input, version and authority remain required. A failed condition is named in diagnostic.current.continuation.',verification:'Direct verification additionally requires canonical work in in_progress, executed or verification and no planned step disposition; no fictitious replay.'}:null,
      candidate_concepts:(record.plan?.candidate_concepts??[]).filter(c=>!record.incorporations?.some(i=>i.concept_id===c.id&&i.plan_identity===knowledgeChecks.workflow.planIdentity(record.plan))).map(c=>c.id),publications:record.publications??[],
      pending:errors.slice(0,16).map(e=>({code:e.code,item:e.item})),open_gaps:(record.gaps??[]).filter(g=>g.status==='open').map(g=>g.id).slice(0,16)};
  }catch{return {...summary,status:'unverified_store_unavailable',record_ref:subject.knowledge.record_ref,pending:['Resolve current canonical work-item knowledge before dependent work.']};}
}
function pendingEndPath(location,key) { return path.join(location,key,'pending-end.json'); }
function pendingStop(location,key) { return fs.existsSync(pendingEndPath(location,key)); }
function endedTurn(turn,origin,responseDelivery) {
  return {turn,state:origin==='model'?'closed':'interrupted',origin,
    response_delivery:responseDelivery??'unknown',continuation_permitted:false};
}
function pendingClosure(location,key,turn) {
  if (!pendingStop(location,key)||!turn) return;
  try {
    const file=pendingEndPath(location,key),stat=fs.lstatSync(file);
    if (stat.isFile()&&stat.nlink===1&&stat.size<=256&&pathPolicy.aliasFree(file)) {
      const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
      if (evidence.turn===turn&&stopOrigins.includes(evidence.origin))
        return endedTurn(turn,evidence.origin,evidence.response_delivery==='observed'?'observed':undefined);
    }
  } catch { /* A partial or unreadable marker still blocks continuation. */ }
  return endedTurn(turn,'unknown');
}
function conversation(scope, event, routing) {
  if (!id(event.chat)) return {state:'intake',history:[],status:'chat_unavailable'};
  const targetLocation = path.join(scope.owned,'context');
  if(event.event==='snapshot'&&!fs.existsSync(targetLocation))return {state:'intake',history:[],status:'chat_unavailable'};
  const location = directory(targetLocation,event.event!=='snapshot');
  const key = sessionKey(event.chat);
  const file = path.join(location,key+'.json');
  const pending = pendingEndPath(location,key);
  const observeOnly=['snapshot','operation_entry','operation_completion'].includes(event.event);
  const observe = (readOnly=false)=>{
    // Current-state reconciliation: an observed hashed session file becomes the session-key file once.
    const legacy = path.join(location,hash(event.chat)+'.json');
    if (!readOnly && !fs.existsSync(file) && legacy !== file && fs.existsSync(legacy) && fs.lstatSync(legacy).isFile()) fs.renameSync(legacy,file);
    const stored = readSession(file,!readOnly);
    if(readOnly&&!stored)throw Error('session_read_requires_lock');
    if (!stored && event.event === 'turn_stop') return {state:'intake',history:[],status:'available'};
    if (!stored && ['record','snapshot'].includes(event.event)) return {state:'intake',history:[],status:'chat_unavailable'};
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
    if (['session_open','snapshot','operation_entry','operation_completion'].includes(event.event))
      return pendingStop(location,key)&&prior.sequence ? {...prior,turn_state:pendingClosure(location,key,prior.sequence)} : prior;
    if (event.event === 'prompt') {
      if(prior.sequence===Number.MAX_SAFE_INTEGER||prior.version===Number.MAX_SAFE_INTEGER)return {...prior,status:'revision_capacity_reached'};
      const current = {turn:prior.sequence+1,state:'intake'};
      const updated = {...prior,sequence:current.turn,version:prior.version+1,state:current.state,history:[...prior.history.slice(-15),current],
        turn_state:{turn:current.turn,state:'active'}};
      const previous = prior.turn_state?.state==='interrupted' ? prior.turn_state :
        pendingClosure(location,key,prior.sequence) ?? (prior.turn_state?.state==='closed'?prior.turn_state:undefined);
      saveSession(file,updated);
      if (pendingStop(location,key)) fs.unlinkSync(pending);
      return previous ? {...updated,prior_turn:previous} : updated;
    }
    if (event.event === 'turn_stop') {
      if (!prior.sequence) return {...prior,status:'available'};
      if (event.turn!==undefined&&event.turn!==prior.sequence)
        return {...prior,status:'stale_or_invalid_transition',diagnostic:{code:'stale_or_invalid_transition',remedy:'Preserve the current turn. Reconcile the separately attributed closure.'}};
      const previous = prior.turn_state?.state==='interrupted'?prior.turn_state:pendingClosure(location,key,prior.sequence)??prior.turn_state;
      const origin = previous?.origin==='user' || event.origin==='user' ? 'user' :
        previous?.origin==='unknown' ? 'unknown' : event.origin;
      const delivery = event.response_delivery??previous?.response_delivery;
      const updated = {...prior,turn_state:endedTurn(prior.sequence,origin,delivery)};
      saveSession(file,updated);
      if (pendingStop(location,key)) fs.unlinkSync(pending);
      return {...updated,status:'available'};
    }
    const payload = Object.fromEntries(eventFields.record.filter(key=>key!=='receipt_basis').map(key=>[key,event[key]]));
    const fingerprint = hash(JSON.stringify(payload));
    const previous = prior.receipts.find(entry=>entry.request_id===event.request_id);
    const subject = prior.subjects.find(item=>item.subject===event.subject && item.turn===prior.sequence);
    // A first record of a turn may enter execution or verification directly only when every stated condition holds;
    // otherwise the rejection names the first failed condition.
    let continuation=null,continuationCheck;
    if(!subject&&governedRecord(event)&&['execution','verification'].includes(event.state)){
      const failed=condition=>{continuationCheck={status:'unavailable',condition,remedy:continuationRemedies[condition]};};
      try{
        if(!knowledgeChecks.validLocator(event.knowledge?.record_ref))failed('record_unreadable');
        else{
          const target=path.resolve(scope.operations,event.knowledge.record_ref);if(!inside(scope.operations,target))throw Error();directory(path.dirname(target));
          const stat=fs.lstatSync(target);if(!stat.isFile()||stat.nlink!==1||stat.size>1048576||!pathPolicy.aliasFree(target))throw Error();
          const document=fs.readFileSync(target,'utf8'),record=knowledgeChecks.extractRecord(document).record;
          let workState;try{workState=JSON.parse(document).state;}catch{workState=undefined;}
          if(record?.work_item!==event.work_item)failed('record_work_item_mismatch');
          else if(record.installation_uid!==scope.installation_uid)failed('record_installation_mismatch');
          else if(knowledgeChecks.identity(knowledgeChecks.canonical(record))!==event.knowledge.record_identity)failed('record_identity_mismatch');
          else if(record.plan?.state!=='validated')failed('plan_not_validated');
          else if(knowledgeChecks.workflow.planErrors(record.plan,{workItem:event.work_item,profiles:record.profiles,state:'planning'}).length)failed('plan_invalid');
          else if(event.state==='execution')continuation='planning';
          else if(!['in_progress','executed','verification'].includes(workState))failed('work_state_not_executed');
          else if(record.profiles.some(p=>p.steps.some(s=>s.disposition==='planned')))failed('steps_planned');
          else continuation='execution';
        }
      }catch{failed('record_unreadable');}
    }
    const from = subject?.state ?? continuation ?? 'intake';
    const allowed = [...Object.keys(states[from].next).filter(state=>state!=='intake'||subject),...(subject?[from]:[])];
    const currentValues = {turn:prior.sequence,version:prior.version,subject_state:subject?.state ?? null,allowed_states:[...new Set(allowed)],...(continuationCheck?{continuation:continuationCheck}:{})};
    const rejected = (status,items,receipt)=>({...prior,status,receipt,diagnostic:{code:status,items,current:currentValues,
      remedy:'Correct exactly the listed fields using the current values above, then resubmit with a fresh request_id. Do not infer acceptance.'}});
    if (previous) {
      if (previous.fingerprint!==fingerprint) return rejected('correlation_conflict',[{field:'request_id',rule:'fresh_for_changed_payload',expected:'a new request_id',received:'reused with a different payload'}],
        {disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn});
      if (event.turn!==prior.sequence) return rejected('stale_or_invalid_transition',[{field:'turn',rule:'current_turn',expected:prior.sequence,received:event.turn}],{...previous.receipt,disposition:'stale'});
      return {...prior,status:'record_accepted',receipt:{...previous.receipt,replayed:true}};
    }
    if (['interrupted','closed'].includes(prior.turn_state?.state)||prior.turn_state?.continuation_permitted===false||pendingStop(location,key))
      return {...prior,status:'turn_interrupted',receipt:{disposition:'rejected',request_id:event.request_id,subject:event.subject,turn:event.turn},
        diagnostic:{code:'turn_interrupted',items:[{field:'turn',rule:'active_turn',expected:'a turn opened by a new user prompt',received:event.turn}],current:currentValues,
          remedy:'This turn ended or its closure is uncertain (UX-09). Do not resume its work. Await valid new user input and preserve evidence of observed effects.'}};
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
        diagnostic:{code:verified.code,items:verified.items,...(verified.details?{details:verified.details}:{}),remedy:verified.remedy}};
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
    saveSession(file,updated);
    return {...updated,status:'record_accepted',receipt};
  };
  // Healthy read-only observations need no exclusive lock. Migration and repair still serialize.
  if(observeOnly)try{return observe(true);}catch{/* Fall back to the serialized path. */}
  const result=locked(path.join(location,'history.lock'),observe,event.event==='turn_stop'?[]:[4,9,17]);
  if (event.event==='turn_stop'&&result.status==='busy') {
    // A context-free callback cannot wait or retry through model output. Leave a
    // conservative per-session barrier for the next serialized reconciliation.
    try {
      directory(path.join(location,key),true);
      fs.writeFileSync(pending,JSON.stringify({turn:event.turn,origin:event.origin,response_delivery:event.response_delivery}),{flag:'wx',mode:0o600});
    }
    catch (error) { if(error.code!=='EEXIST') throw error; }
  }
  return result.status==='busy'?{...result,history_reason:'history_state_busy'}:result;
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
  const layers = {organization:layer('organization',scope.operations),workspace:layer('workspace',scope.common)};
  const canonical=reference=>{
    const target=path.resolve(scope.operations,reference);
    if(path.isAbsolute(reference)||!inside(scope.operations,target)||samePath(scope.operations,target))return false;
    try{directory(path.dirname(target));return fs.lstatSync(target).isFile()&&pathPolicy.aliasFree(target);}catch{return false;}
  };
  const set=composeRuntimeInstructions({layers,canonical,contractIds:config.contract_ids,sourceIdentity:config.source_binding.source_identity,sha:bytes=>'sha256:'+hash(bytes)});
  return {status:set.complete?(set.conflicts.length?'conflict':'available'):'incomplete',identity:set.identity,layers:set.layers,
    conflicts:set.conflicts,organization_identity:'sha256:'+hash(JSON.stringify({state:set.layers.organization,records:set.records.organization})),workspace_identity:'sha256:'+hash(JSON.stringify({state:set.layers.workspace,records:set.records.workspace})),organization:set.records.organization,workspace:set.records.workspace};
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
      registration={...registration,project_root:scope.root,owned_scope:scope.owned};
      if(registration.adoption_checkpoint!==undefined)registration.adoption_checkpoint=pathPolicy.resolve(registration.adoption_checkpoint,'registration.adoption_checkpoint',scope.mappings);
      if(registration.instruction_sources){
        const sources={...registration.instruction_sources};
        for(const name of ['organization','workspace'])if(Object.hasOwn(sources,name)&&sources[name]!==null)sources[name]=pathPolicy.resolve(sources[name],'registration.instruction_sources.'+name,scope.mappings);
        registration={...registration,instruction_sources:sources};
      }
      const cwd = directory(event?.cwd ?? scope.root,false,'cwd',scope.mappings);
      if (!inside(scope.root,cwd)) throw pathPolicy.failure('wrong_workspace','cwd','workspace_containment');
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
      if (chat.status==='busy') result.diagnostic={code:'busy',reason:chat.history_reason,message:'OOP controller diagnostic: session state is busy.',
        remedy:'Group equivalent occurrences, then reconcile owned state and correlated receipts. Preserve live or unverifiable locks.'};
      if (['session_open','prompt'].includes(event.event)) {
        // ENF-02: outcomes of undecoded native events are retained without delivery and disclosed here.
        // Only outcomes newer than this chat's previous response are disclosed, so each is reported once.
        try { const unbound = path.join(scope.owned,'context','unbound'), since = Date.parse(chat.responses?.at(-1)?.written_at ?? '') || 0;
          const count = fs.readdirSync(unbound).filter(name=>name.startsWith('r-')&&name.endsWith('.json')&&fs.statSync(path.join(unbound,name)).mtimeMs>since).length;
          if (count) result.unbound_diagnostics = {count,location:unbound}; } catch { /* No retained undecoded outcome. */ }
      }
      if (event.event!=='turn_stop') {
        try { result.instructions = sharedInstructions(scope,registration,config); }
        catch { result.instructions = {status:'unavailable'}; }
      }
      if (result.freshness.status === 'synchronized') {
        result.migration = migrationContext(scope,registration,result.freshness.target);
      }
    } catch (error) { result.status = 'context_unavailable'; result.diagnostic=pathPolicy.diagnostic(error) ?? sessionDiagnostic(error) ?? {code:'context_unavailable',remedy:'Reconcile the owned registration, local paths and session store under current repair authority. Preserve safe active state; never claim acceptance or bypass host consent.'}; }
    return response(result);
  }
  // PROP-07: one immutable response file per native invocation, plus a bounded session index and error list.
  function deliver(owned, chat, output, eventName, codes = [], generation) {
    const location = directory(path.join(owned,'context'),true);
    const key = id(chat) ? sessionKey(chat) : null;
    const responseId = 'r-'+Date.now().toString(36)+'-'+randomUUID().slice(0,8);
    const folder = directory(path.join(location,key ?? 'unbound'),true);
    const file = path.join(folder,responseId+'.json');
    const context = output.context ?? {};
      const record = {format:1,type:'oop_controller_response',response_id:responseId,session:key?chat:null,event:eventName ?? null,
      written_at:new Date().toISOString(),status:context.status ?? 'context_unavailable',context:output.delivery?.message ?? {status:context.status,diagnostic:context.diagnostic}};
    if(generation)record.context={...record.context,context_generation:generation};
    const dependency_identity=acquisition.dependency(record.context);
    const {source_binding,workspace,binding,instructions,tool_instructions,freshness,migration,operations_binding,module_basis,routing,procedure} = record.context;
    const refreshIdentity=acquisition.dependency({source_binding,workspace,binding,instructions,tool_instructions,freshness,migration,operations_binding,
      module_basis,routing_index:routing?.index,procedure_identity:procedure?.identity});
    const stored=acquisition.factor(record,folder);
    const reviewComponents=Object.fromEntries(['kernel','index'].map(key=>[key,stored.definitions[key]?.identity]));
    stored.recovery={format:1,dependency_identity,bounds:acquisition.bounds,delivery:'pointer',
      refresh_identity:refreshIdentity,...(generation&&{context_generation:generation}),components:stored.definitions,
      acquisition:{command:'acquire',invocation:context.binding?{executable:context.binding.interpreter,args:[context.binding.controller,owned,'acquire']}:null,
        input:{event:'acquire',chat:chat??null,response_id:responseId,transaction:'<episode-id>',offset:0,depth:0}},
      rule:'Acquire the applicable missing or uncertain components before dependent work. Add component (a key in recovery.components) to the acquisition input for one complete component, or omit it for full reconstruction. Reuse complete available matching content. An index reference or a historical receipt alone is insufficient. Keep an active transaction and target across equivalent redelivery. Independent authority and stop controls apply.'};
    const storedBytes=serialize(stored),content_identity=acquisition.identity(storedBytes);
    const entries = codes.map(code=>({response_id:responseId,code,created_at:record.written_at,
      event:record.event,...(code==='busy'&&context.busy_phase?{phase:context.busy_phase}:{}),
      ...(code==='busy'&&context.diagnostic?.reason?{reason:context.diagnostic.reason}:{}),
      message:'OOP controller diagnostic: '+code+'. Group equivalent occurrences and present newly actionable conditions before authorized repair. Presentation is not resolution or authority.'}));
    const indexEntry={response_id:responseId,event:record.event,status:record.status,
      refresh_identity:refreshIdentity,...(generation&&{context_generation:generation}),
      definitions:Object.values(stored.definitions).map(value=>value.locator),
      components:Object.fromEntries(Object.entries(stored.definitions).map(([key,value])=>[key,value.identity])),
      turn:context.turn ?? null,version:context.version ?? null,dependency_identity,content_identity,written_at:record.written_at};
    const marker=key?path.join(folder,responseId+'.pending-index'):undefined;
    try {
      if (marker) fs.writeFileSync(marker,serialize({entry:indexEntry,errors:entries}),{flag:'wx',mode:0o600});
      if (marker) writeAtomic(file,storedBytes);
      else fs.writeFileSync(file,storedBytes,{flag:'wx',mode:0o600});
    } catch (error) { error.locator=file; throw error; }
    const maintenance=['session_open','prompt'].includes(eventName)||!eventName;
    let plan;
    if(maintenance)try { plan=prune(location,key??''); }
    catch(error){if(error.code!=='ENOENT')throw error;plan={candidates:[],remaining:true,overLimit:false};}
    const pending=key?fs.readdirSync(folder).filter(name=>/^r-[a-z0-9]+-[a-f0-9-]{8}\.pending-index$/.test(name)&&name!==path.basename(marker)).sort():[];
    let delivery={mode:'deep',reason:'current_context_required'};
    function decide(state, indexed) {
      const current=!!state&&(indexEntry.turn??0)===state.sequence&&(indexEntry.version??0)===state.version;
      const stopped=state&&(pendingStop(location,key)||state.turn_state?.continuation_permitted===false||
        ['closed','interrupted'].includes(state.turn_state?.state));
      if(context.diagnostic?.reason==='history_state_busy'||record.status==='available'&&!current)
        return {mode:'state_unavailable',reason:context.diagnostic?.reason??'history_state_unverified',
          episode:hash(JSON.stringify([key,state?.sequence,state?.version,'history'])).slice(0,16)};
      if(stopped&&eventName!=='session_open')return {mode:'state_unavailable',reason:'turn_interrupted'};
      const deep=reason=>({mode:'deep',reason});
      if(record.status!=='available'||instructions?.status!=='available'){
        return deep('current_context_required');
      }
      const previous=state.context_refresh;
      const routingReview=eventName==='session_open'||eventName==='prompt';
      const changed=Boolean(previous)&&(previous.identity!==refreshIdentity||
        Boolean(generation&&previous.generation&&previous.generation!==generation));
      const verified=Boolean(generation&&previous?.generation===generation&&!changed);
      const continuity=changed?'changed':verified?'unchanged':'unknown';
      const requiredAvailable=Object.values(reviewComponents).every(Boolean);
      const coveredOpening=verified&&requiredAvailable&&state.sequence===1&&previous?.turn===0&&
        previous.event==='session_open'&&previous.acquired===true;
      const scheduled=eventName==='session_open'||eventName==='prompt'&&(state.sequence-1)%3===0&&!coveredOpening;
      if(scheduled||generation&&!verified){
        if(indexed)state.context_refresh={identity:refreshIdentity,generation,turn:state.sequence,event:eventName,
          response_id:responseId,written_at:record.written_at,required_components:reviewComponents};
        if(scheduled)return {...deep('scheduled_refresh'),review:routingReview,continuity};
      }
      const hasUnacquiredError=(Array.isArray(state.errors)?state.errors:[]).some(error=>error.code!=='index_reconciled' &&
        error.reason!=='history_state_busy'&&!state.acquired_context_errors?.includes((error.response_id??error.created_at)+':'+error.code));
      const reason=continuity==='changed'?'context_changed':!verified?'continuity_unverified':
        !requiredAvailable?'review_components_unavailable':previous?.acquired!==true?'review_acquisition_incomplete':
        hasUnacquiredError||entries.length||context.unbound_diagnostics?'actionable_diagnostic':
        context.knowledge_obligations?'pending_knowledge_obligations':'verified_current_context';
      return {mode:reason==='verified_current_context'?'light':'targeted',reason,continuity,
        review:routingReview,reminder:{turn:state.sequence,version:state.version,state:record.context.current?.state,
        refresh_response:verified&&routingReview?previous?.response_id:undefined,
        knowledge_reference:record.context.knowledge_input?.reference,prior_turn:record.context.prior_turn}};
    }
    const indexed = locked(path.join(location,'history.lock'),()=>{
      const started=process.hrtime.bigint();
      const journal = path.join(owned,'oop-enforce-errors.jsonl');
      if (fs.existsSync(journal) && !fs.existsSync(path.join(owned,'oop-enforce-errors.lock')) && fs.lstatSync(journal).isFile()) {
        const unread = fs.readFileSync(journal,'utf8').split('\n').filter(line=>line.includes('"read":false')).length;
        fs.unlinkSync(journal);
        entries.push({response_id:responseId,code:'legacy_journal_retired',created_at:record.written_at,
          message:'OOP controller diagnostic: an observed error journal was retired; '+unread+' unread entries were discarded. Diagnostics are now delivered in session responses.'});
      }
      let reconciled=0;
      if (key) {
        const sessionFile = path.join(location,key+'.json'), legacy = path.join(location,hash(chat)+'.json');
        if (!fs.existsSync(sessionFile) && fs.existsSync(legacy) && fs.lstatSync(legacy).isFile()) fs.renameSync(legacy,sessionFile);
        const state = readSession(sessionFile) ?? {sequence:0,version:0,state:'intake',history:[],subjects:[],receipts:[]};
        const outcomes=[];
        for (const name of pending.slice(0,8)) {
          const response_id=name.slice(0,-'.pending-index'.length),target=path.join(folder,response_id+'.json');
          if (!fs.existsSync(target)) {
            const file=path.join(folder,name);
            try {
              if (Date.now()-fs.lstatSync(file).mtimeMs>retention.minimum_retention_hours*3600000) outcomes.push({file,status:'content_unavailable'});
            } catch (error) { if (error.code!=='ENOENT') throw error; }
            continue;
          }
          try {
            const outcome=acquisition.reconcileIndex(folder,{chat,response_id},state);
            if (outcome) outcomes.push(outcome);
          } catch { outcomes.push({file:path.join(folder,name),status:'content_unavailable'}); }
        }
        const currentRevision=(indexEntry.turn??0)===state.sequence&&(indexEntry.version??0)===state.version;
        if(eventName!=='turn_stop')delivery=decide(state,true);
        const entry={...indexEntry,locator:file,...(!currentRevision&&{historical:true})};
        state.responses=[...(state.responses??[]).filter(prior=>prior.response_id!==responseId),entry]
          .sort((left,right)=>left.written_at.localeCompare(right.written_at)).slice(-retention.response_index);
        state.errors = [...(Array.isArray(state.errors)?state.errors:[]),...entries].slice(-retention.errors);
        saveSession(sessionFile,state);
        for (const outcome of outcomes) acquisition.finishIndex(outcome);
        reconciled=outcomes.length;
        acquisition.finishIndex({file:marker,status:currentRevision?undefined:'context_changed'});
      }
      return {reconciled,pending_observed:pending.length,lock_ms:Number(process.hrtime.bigint()-started)/1e6};
    },key&&record.status==='available'&&eventName!=='turn_stop'?[4,9,17]:[]);
    if(indexed.status==='busy'){
      let observed;
      if(key&&eventName!=='turn_stop')try{observed=readSession(path.join(location,key+'.json'),false);}catch{/* No usable snapshot. */}
      if(key&&eventName!=='turn_stop')delivery=decide(observed,false);
      return {locator:file,response_id:responseId,dependency_identity,delivery,retention:{status:'index_busy',reason:'history_index_busy',pending:!!key}};
    }
    const cleanup=plan?locked(path.join(location,'history.lock'),()=>applyRetention(plan,location,key??'',
      key?readSession(path.join(location,key+'.json')):undefined)):undefined;
    const maintenanceResult=cleanup&&cleanup.status!=='busy'?cleanup:{status:'maintenance_deferred',removed:0,deferred:plan?.candidates.length??0};
    return {locator:file,response_id:responseId,dependency_identity,delivery,retention:{...maintenanceResult,...indexed}};
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
      submission:{invocation:invoke('record'),example,subject_states:subjectStates,},
      snapshot:{invocation:invoke('snapshot'),input:{event:'snapshot',chat:binding?.chat}},
      shared_instructions:{status:instructions?.status},
      next:operational?'Load applicable context, classify each pending subject, invoke record using the resolved executable and argument vector, then inspect the correlated acknowledgment before dependent reliance. Follow reachable consequences and independent authority checks.':'Use the bootstrap/adoption or scoped repair procedure for the actual unavailable dependency. Do not invent chat, turn, revision, successful installation or acceptance. Continue independent authorized work.'};
    const fixed = {
      knowledge_contract:{locator:path.join(location,config.knowledge_contract?.path??'knowledge-contract.json'),content_identity:config.knowledge_contract?.content_identity??null,versions:knowledgeChecks.workflow.versions},
      interface:interfaceVersion,
      actor:'The receiving runtime of the bound installation and actual native chat.',
      triggers:['session_open','prompt','operation_entry','operation_completion','record_response','snapshot_recovery','changed_effective_scope','completion_reassessment','supported_context_recovery'],
      prerequisites:'Current project/installation identity, applicable adopted context, actual host capability and independent authority. Binding locators describe the configured route, not proof that it is installed. No substantive classification submission is possible without an actual current prompt turn.',
      force:'MUST; derived procedure under the applicable complete OOP clauses, not independent effect authority.',
      timing:'Classify and submit every new subject, including G0, before its substantive answer or dependent effect. A new prompt is a new turn, not necessarily a new subject. Reuse the subject identifier for continuation, clarification or correction; classify changed effective scope before the newly affected effect. Record each applicable state transition before relying on it and inspect its acknowledgment. Reassess completion and recovery; do not create artificial transitions or tickets.',
      context:{action:'Read complete applicable modules at module_base plus locator, and their dependency closure, before dependent work. current.modules lists the current state closure; routing.routes lists reachable states with their modules. Load only missing or stale context; never audit release hashes. When module_basis requires adoption, reconcile the owned checkpoint and migration instructions first.'},
      lifecycle:{entry:path.join(location,'entry.json'),procedure:path.join(location,'procedures','lifecycle.json'),bootstrap:path.join(location,'procedures','bootstrap.json'),
        action:'When bootstrapping or inactive, read the resolved entry and bootstrap procedure and execute its applicable ordered steps under current authority. Acquire both complete source-bound mandatory procedures in this response; distinguish missing, altered or unavailable context and repair only authorized owned state. Initial target is not adopted state; never audit the OOP repository or read PROTOCOL.md. On adoption or recovery, read the resolved lifecycle route and referenced complete procedure before dependent reliance; preserve the owned verified checkpoint and actual partial effects.'},
      shared_instructions:{
        tool_guidance:'Apply complete tool guidance embedded in this response from the verified tool-type JSON source before dependent integration work. Missing or invalid guidance blocks dependent integration readiness only. Shared guidance never transfers native consent.',
        authorization:'Reuse a verified scoped mandate for required ordinary publication; obtain only missing native consent through the documented active-turn mechanism. If the turn cannot remain active, state the exact pending action, required authorization and observable resume condition. Persist formal grants through owned sources and regenerated views; approvals are not performance or verification.',
        action:'Apply complete response instructions under canonical precedence and actual adopted-checkpoint applicability. Missing, conflicting or unavailable layers require scoped source reconciliation before dependent work. Preserve independent authorized work; no locator, digest or runtime claim grants authority.'},
      submission:{required:eventFields.record.filter(key=>!optionalRecordFields.includes(key)),
        governed_required:{when:'level G2, G3 or G4 in planning, execution or verification without technical_adoption',fields:knowledgeFields,otherwise:'omit these fields'},
        contract_locator:path.join(location,'interfaces.json')+'#/enforcement',
        schema:{event:{const:'record'},chat:{value:'the bound native chat shown in example.chat'},
          request_id:{type:'string',pattern:identifierRule,rule:'fresh for every new payload; reuse only to replay the identical payload after an uncertain result'},
          subject:{type:'string',pattern:identifierRule,rule:'bounded subject identifier, never raw request text; reuse it for continuation, clarification or correction'},
          turn:{type:'integer',value:'the current turn shown in example.turn'},
          expected_version:{type:'integer',value:'the version shown in example.expected_version for the first record of the turn; after each accepted record, receipt.version of that record'},
          state:{enum:Object.keys(states),rule:'the first record of a subject in this turn selects one state from context.routing.routes.intake.reachable; intake itself is never submitted'},
          level:{enum:['G0','G1','G2','G3','G4']},related_ticket:{type:'boolean',rule:'JSON true or false, never a string; false when no real ticket is related'},
          facets:{type:'array',max_items:8,unique:true,items:'exact strings from allowed_facets; unresolved material applicability is not an empty known classification'},
          relation:{enum:relations},cwd:{optional:true,type:'string',rule:'the actual working folder inside the registered workspace'},
          receipt_basis:{optional:true,type:'string',rule:'Use context.receipt_basis only while the governing instructions remain available. An exact eligible match requests a compact correlated receipt; otherwise use the complete returned context.'},
          work_item:{governed_only:true,type:'string',pattern:identifierRule},domains:{governed_only:true,type:'array',min_items:1,max_items:16,items:'unique domain identifiers the effective scope touches; declare conservatively'},
          knowledge:{governed_only:true,format:knowledgeChecks.workflow.versions.declaration,record_ref:'Safe operations-relative work-item locator',record_identity:'Content identity of canonical serialization of its extracted knowledge record',profiles:'Up to 16 entries {id, revision, content_identity, disposition, reason unless applied, steps:[{step_id, disposition}]} for every applicable profile',missing_domains:'Optional entries {domain, gap_ref} for declared domains outside the derived index'},
          unknown_fields:'rejected'},
        rules:['Replace every example value with the actual classification of the subject; the example only shows a payload shape that the controller accepts.',
          'Never submit state intake. A new subject in this turn starts from one state of state_routes.intake.reachable.',
          'After each accepted record, use its receipt.version as expected_version for the next record.',
          'Omit optional and governed-only fields that do not apply; never send null for them.',
          'Send turn and expected_version as JSON integers and related_ticket as a JSON boolean.',
          'On rejection, correct exactly the fields listed in diagnostic.items using diagnostic.current, then resubmit with a fresh request_id.'],
        route_resolution:'For a new or new-turn subject use state_routes.intake.reachable. For a retained current-turn subject resolve its state in subject_states and use context.routing.routes[state].reachable; same_state_update is only for a real classification reassessment without an artificial lifecycle step. Load that selected route module closure before dependent work.',
        allowed_facets:allowedFacets,
        acceptance:'Require type=oop_context, matching source_binding/interface, context.status=record_accepted and context.receipt.disposition=accepted. Match installation_uid, chat, request_id, subject, turn, state, level, related_ticket, facets, relation and the resulting version against the submitted payload; first acceptance has version=expected_version+1. Replayed receipts attest their original accepted revision, never a newer transition. Exit 0, JSON syntax or a chat declaration is insufficient.',
        failure:'Any other disposition is unaccepted. For stale, busy, timeout or lost response, retrieve snapshot and inspect retained correlated receipts and actual current state before retry. A matching accepted receipt resolves uncertainty; absence is not proof of failure after retention expiry. Never overwrite concurrent state or silently replay a new prompt. Changed payload requires a fresh request_id. Missing acceptance blocks claims of recorded completion and dependent work, while independent authorized work may continue with the limitation disclosed.'},
      tickets:{validator:path.join(location,'oop-ticket.js'),rule:'Immediately open and publish every newly required ticket before dependent work. Use TKT-NNNN-subject with authoritative increasing allocation. Give semantically distinct interventions separate tickets; progress and verification belong to their pertinent ticket. Validate every ticket candidate structurally before publication; creation supplies --allocation and updates --prior. The validator never authenticates allocation, semantic pertinence, authority or canonical publication. Repository-backed opening requires attributable commit, required signing, immediate push and remote readback; other authoritative stores retain equivalent conditional durability.'},
      snapshot:{effect:'Read current turn, revision, subjects with their knowledge summaries, bounded accepted receipts and session errors; no turn increment, daily synchronization or instruction-view rewrite.'},
      user_stop:'UX-09: ended or uncertain turns cannot continue. Treat origin, observed response delivery and continuation as separate facts. prior_turn carries closure evidence on the next prompt; follow only the new input. unbound_diagnostics counts undecoded events.',
      session_store:{location:binding?path.join(path.dirname(binding.registration),'context'):null,
        rule:'Acquire missing applicable components before dependent effects. Reuse complete matching instructions only while available now. Use the owned root-first acquire command for bounded segments, or an authorized equivalent complete delivery. Delivery-only envelopes do not restart recovery. Missing, stale or altered targets require bounded recovery and a current snapshot where needed.',
        errors:'session_errors retains up to 16 controller occurrences. Group proven equivalent occurrences without losing IDs. Present first and materially changed actionable diagnostics, original and translation, before repair. Retain scoped presentation and recovery evidence separately. No acknowledgment command exists. Never edit session files.',
        retention:{idle_expiry_days:retention.idle_expiry_days,minimum_retention_hours:retention.minimum_retention_hours,session_soft_limit:retention.session_soft_limit,total_bytes:retention.total_bytes,response_index:retention.response_index}},
      limits:'At most 16 retained subjects, 16 history entries and 32 receipts per chat; session state stays within 65536 bytes, compacted oldest first, and retained receipts keep knowledge identities only. Technical attributed claims only, no raw prompts, secrets or unrelated chat content. Context delivery and acceptance grant no host permission and prove no effect.'
    };
    delete fixed.actor;delete fixed.triggers;delete fixed.force;delete fixed.session_store.retention;delete fixed.session_store.location;
    const identity = 'sha256:'+hash(JSON.stringify(fixed));
    // PROP-04: direct record and snapshot responses carry the procedure by identity plus its dynamic parts.
    const procedure = {...fixed,identity,...dynamic,submission:{...fixed.submission,...dynamic.submission},snapshot:{...fixed.snapshot,...dynamic.snapshot},
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
        'KP-14: Perform these obligations without offering them as options. Resolve the current input reference, linked correction evaluations, decision dispositions and resource-bound evidence under the complete mandatory procedure in this response.'],
      validator:binding&&workspace?{executable:binding.interpreter,args:[path.join(path.dirname(binding.controller),'oop-knowledge.js'),'work-item',workspace.operations,'<work-item-file>','--transition','<planning|in_progress|execution|verification|completed|closed>'],
        index_check:[path.join(path.dirname(binding.controller),'oop-knowledge.js'),'index',workspace.operations,'--check']}:null}:undefined;
    if (knowledgeObligations) context.knowledge_obligations = knowledgeObligations;
    const knowledgeInput={reference:binding?.chat&&turn?knowledgeChecks.inputReference(binding.chat,turn):null,basis:binding?.chat&&turn?'native_event':'unavailable',procedure:'Read the complete source-bound mandatory knowledge-profile procedure in this response before dependent G2-G4 work; classify the current input, reconcile relevant retained work and disclose unresolved knowledge obligations. No raw prompt is retained.'};
    context.knowledge_input=knowledgeInput;
    // PROP-05: every value once; reachable states live only in procedure.submission.state_routes.
    const common={oop:runtimeOperationalRules().split(/(?<=\.) /),profiles:runtimeOperationalRules('profiles').split(/(?<=\.) /),adoption:runtimeOperationalRules('upgrade')};
    const instructionSet={...(instructions??{status:'unavailable'}),common,common_identity:'sha256:'+hash(JSON.stringify(common))};
    const routing={index:config.routing_index,base:modules(['core','intake','context']),routes:stateRoutes,
      rule:'Inspect the current complete index at user entry and select the actual next action from request, state, applicable additional instructions, effects, authority, risk and uncertainty. Record selected component identities, reasons, availability and unresolved conditions compactly in current action context. Load the complete selected dependency closure where missing or uncertain. Reachable states are navigation. Reassess changes before dependent effects.'};
    context.instructions=instructionSet;context.routing=routing;context.tool_instructions=result.tool_instructions;
    context.delivery_policy=config.delivery_policy;
    const receiptBasis=acquisition.dependency({source_binding:config.source_binding,workspace,instructions:instructionSet,
      tool_instructions:result.tool_instructions,module_basis,procedure_identity:procedure.identity});
    context.receipt_basis=receiptBasis;
    const message = {source_binding:config.source_binding,delivery_policy:config.delivery_policy,kernel:config.kernel,tool_instructions:result.tool_instructions,workspace,history,current:{state,turn,version,modules:currentModules},module_base,module_basis,freshness,migration,status,instructions:instructionSet,
      routing:{...routing,index:routing.index&&{...routing.index,module_identities:config.module_identities}},binding,receipt,receipt_basis:receiptBasis,
      subjects:subjects?.filter(item=>item.turn===turn),receipt_history:{count:receipts?.length??0,retrieval:'Invoke the resolved procedure.snapshot to inspect complete bounded context.receipts before uncertain retry.'},
      uncorrelated_retained_claims:result.uncorrelated_retained_claims,diagnostic,session_errors:result.session_errors,operations_binding:result.operations_binding,
      knowledge_obligations:knowledgeObligations,knowledge_input:knowledgeInput,turn_state:result.turn_state,prior_turn:result.prior_turn,unbound_diagnostics:result.unbound_diagnostics,busy_phase:busyPhase,
      busy_recovery:busyPhase?'Inspect current owned state and correlated receipts before any bounded retry. Preserve live or unverifiable locks. Verify the affected operation and report whether it resumed or remains blocked.':undefined,procedure};
    // PROP-03: additionalContext never duplicates context; native delivery replaces it with the response-file instruction.
    const additionalContext = status+(receipt?.disposition?' (receipt '+receipt.disposition+(receipt.version?', version '+receipt.version:'')+')':'')+
      '. The complete result is in context'+(diagnostic?.items?'; correct the fields listed in context.diagnostic.items':'')+'.';
    return {format:1,type:'oop_context',source_binding:config.source_binding,additionalContext,context,delivery:{message}};
  }
  const verifyDeliveryPolicy=actual=>actual&&actual.source_binding?.source_identity!==config.delivery_policy?.source_binding?.source_identity?
    {status:'source_or_version_unavailable'}:verifyMandatoryView(actual,config.delivery_policy);
  return {compose,response,deliver,config,verifyDeliveryPolicy,resolveResponse:(record,folder)=>acquisition.resolve(record,folder),
    recoverHistoryLock:acquisition.recoverHistoryLock,
    acquire:(root,input)=>acquisition.acquire(root,input,{read:readSession,save:saveSession,locked,sessionKey,pendingStop,
      verifyDeliveryPolicy:config.delivery_policy?verifyDeliveryPolicy:undefined})};
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
