'use strict';
const {runtimePaths}=require('./runtime-paths.cjs');
// Serialized producer implementation. Acquisition reads owned data; it never executes caller commands.
function contextAcquisition() {
  const pathPolicy=runtimePaths();
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path');
  const {createHash}=process.getBuiltinModule('node:crypto');
  const identity=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
  const bounds=Object.freeze({attempts:8,event_depth:2,invalidations:3,segments:64,segment_bytes:8192,contention_ms:2000});
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function encode(value) {
    const compact=JSON.stringify(value);let text='',quoted=false,escaped=false,column=0;
    for(const ch of compact){
      text+=ch;column+=Buffer.byteLength(ch);
      if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}
      else if(ch==='"')quoted=true;
      else if(column>=512&&',:{}[]'.includes(ch)){text+='\n';column=0;}
    }
    text+='\n';
    if(Buffer.byteLength(text)>327680||text.split('\n').some(line=>Buffer.byteLength(line)>4096))throw Error('output_invalid');
    return text;
  }
  function immutable(file,value) {
    const bytes=encode(value);
    try{fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});}
    catch(error){if(error.code!=='EEXIST'||safeRead(file)!==bytes)throw error;}
  }
  function safeRead(file) {
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.nlink!==1||stat.isSymbolicLink()||!pathPolicy.aliasFree(file)||stat.size>327680)throw Error('context_unavailable');
    return fs.readFileSync(file,'utf8');
  }
  function factor(record) { return record; }
  function resolve(record) { if(record.definitions)throw Error('context_unavailable');return record; }
  function dependency(message) {
    const copy=JSON.parse(JSON.stringify(message));
    // Only delivery metadata is excluded. Governing status, scope, content and revisions remain dependencies.
    if(copy.freshness){delete copy.freshness.attempt_at;if(copy.freshness.last_success)delete copy.freshness.last_success.at;}
    if(copy.session_errors)copy.session_errors=[...new Map(copy.session_errors.filter(e=>e.code!=='index_reconciled')
      .map(({response_id,created_at,event,...e})=>[JSON.stringify(e),e])).values()];
    if(copy.session_errors?.length===0)delete copy.session_errors;
    if(copy.instructions?.mandatory)delete copy.instructions.mandatory.prior;
    return identity(JSON.stringify(copy));
  }
  function condition(folder,responseId){
    const observed=[];
    try{
      const bytes=safeRead(path.join(folder,responseId+'.json'));observed.push(identity(bytes));
      const name=JSON.parse(bytes).definitions?.procedure?.locator;
      if(name){if(!/^d-[a-f0-9]{64}\.json$/.test(name))return identity('invalid_definition_locator');observed.push(identity(safeRead(path.join(folder,name))));}
    }catch(error){observed.push(error.code??'context_unavailable');}
    return identity(JSON.stringify(observed));
  }
  function reconcileIndex(folder,input,state) {
    const file=path.join(folder,input.response_id+'.pending-index');
    if (!fs.existsSync(file)) return;
    const pending=JSON.parse(safeRead(file)), entry=pending.entry;
    const bytes=safeRead(path.join(folder,input.response_id+'.json')), record=JSON.parse(bytes);
    if (entry?.response_id!==input.response_id||record.response_id!==input.response_id||record.session!==input.chat||
        identity(bytes)!==entry.content_identity||dependency(record.context)!==entry.dependency_identity||
        (record.context.current?.turn??null)!==entry.turn||(record.context.current?.version??null)!==entry.version) throw Error('context_unavailable');
    if (state.responses?.some(item=>item.response_id===entry.response_id&&item.content_identity===entry.content_identity)) return {file,entry};
    if (entry.turn!==state.sequence||entry.version!==state.version) return {file,status:'context_changed'};
    const responses=[...(state.responses??[]).filter(item=>item.response_id!==entry.response_id),entry];
    state.responses=responses.sort((a,b)=>a.written_at.localeCompare(b.written_at)).slice(-16);
    const errors=[...(state.errors??[]),...(Array.isArray(pending.errors)?pending.errors:[])];
    errors.push({response_id:entry.response_id,code:'index_reconciled',phase:'history',created_at:entry.written_at,
      message:'A saved response awaiting indexing was reconciled.'});
    state.errors=[...new Map(errors.map(e=>[e.response_id+':'+e.code,e])).values()].slice(-16);
    return {file,entry};
  }
  function finishIndex(result) {
    if (!result) return;
    try {
      if (result.status) fs.renameSync(result.file,result.file+'.'+result.status);
      else fs.unlinkSync(result.file);
    } catch (error) {
      if (error.code!=='ENOENT') throw error;
    }
  }
  async function recoverHistoryLock(scope, backend) {
    const blocked=reason=>({status:'blocked',reason});
    if (!backend||typeof backend.read!=='function'||typeof backend.proveOwner!=='function'||
        typeof backend.quarantineIfUnchanged!=='function'||typeof backend.verify!=='function') {
      return blocked('recovery_backend_unavailable');
    }
    const target=await backend.read(scope);
    if (target?.authority!=='verified'||target.ownership!=='verified'||!target.identity||!target.owner_instance) {
      return blocked('lock_ownership_unverified');
    }
    const proof=await backend.proveOwner(target.owner_instance);
    if (proof?.status!=='terminated'||proof.owner_instance!==target.owner_instance||!proof.evidence) {
      return blocked('lock_owner_active_or_unknown');
    }
    const receipt=await backend.quarantineIfUnchanged(scope,target.identity,proof);
    if (receipt?.status==='changed') return blocked('lock_identity_changed');
    if (receipt?.status!=='quarantined'||receipt.identity!==target.identity||!receipt.evidence) {
      return {status:'uncertain',reason:'quarantine_unverified'};
    }
    const verified=await backend.verify(scope,receipt);
    if (verified?.state!=='verified'||verified.index!=='verified'||verified.operation!=='verified'||
        verified.lock_identity!==target.identity||!verified.operation_identity) {
      return {status:'uncertain',reason:'recovery_readback_unverified',receipt};
    }
    return {status:'recovered',receipt,verification:verified};
  }
  function contention(location,key,helpers) {
    if (helpers.pendingStop?.(location,key)) return {status:'turn_interrupted'};
    let turn='unknown';
    try {
      const state=JSON.parse(safeRead(path.join(location,key+'.json')));
      if (state.turn_state?.continuation_permitted===false||
          ['closed','interrupted'].includes(state.turn_state?.state)) return {status:'turn_interrupted'};
      if (Number.isSafeInteger(state.sequence)&&state.sequence>=0) turn=String(state.sequence);
    } catch { /* Unknown session state never authorizes continuation. */ }
    const folder=path.join(location,key);
    try {
      fs.mkdirSync(folder,{recursive:true});
      if (!pathPolicy.aliasFree(folder)||!fs.lstatSync(folder).isDirectory()) return {status:'context_unavailable'};
      const anchor=path.join(folder,'contention-'+turn+'.json');
      try { fs.writeFileSync(anchor,'{}',{flag:'wx',mode:0o600}); }
      catch (error) { if (error.code!=='EEXIST') throw error; }
      const stat=fs.lstatSync(anchor);
      if (!stat.isFile()||stat.nlink!==1||!pathPolicy.aliasFree(anchor)||stat.size!==2) return {status:'context_unavailable'};
      const elapsed=Date.now()-Math.floor(stat.mtimeMs);
      const remaining=elapsed>=-250?bounds.contention_ms-Math.max(0,elapsed):0;
      return remaining>0?{status:'busy',remaining}:{status:'recovery_budget_exhausted'};
    } catch { return {status:'context_unavailable'}; }
  }
  function acquire(root,input,helpers) {
    const fail=(code,extra={})=>({format:1,type:'oop_context_acquisition',status:code,...extra,
      diagnostic:{code,next_action:'Inspect the owned target and current snapshot under existing authority. Do not retry unchanged failure or resume a user-stopped turn.',
        resumption_condition:'A changed relevant dependency or an authorized repaired target permits a bounded new acquisition; independent authorized work may continue.'}});
    if(!object(input)||Object.keys(input).some(k=>!['event','chat','response_id','transaction','offset','depth'].includes(k))||input.event!=='acquire'||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(input.chat)||!/^r-[a-z0-9]+-[a-f0-9-]{8}$/.test(input.response_id)||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(input.transaction)||!Number.isSafeInteger(input.offset)||input.offset<0||
      !Number.isSafeInteger(input.depth)||input.depth<0)return fail('input_invalid');
    const location=path.join(root,'context'),key=helpers.sessionKey(input.chat),sessionFile=path.join(location,key+'.json');
    const available=()=>{
      const state=helpers.read(sessionFile);if(!state)return fail('chat_unavailable');
      if(['interrupted','closed'].includes(state.turn_state?.state)||state.turn_state?.continuation_permitted===false||
          helpers.pendingStop?.(location,key))return fail('turn_interrupted');
      let episode=state.acquisition;
      if(!episode||episode.turn!==state.sequence||episode.complete&&episode.transaction!==input.transaction){
        episode={turn:state.sequence,transaction:input.transaction,attempts:0,segments:0,invalidations:0,offset:0,complete:false};
      }
      if(episode.transaction!==input.transaction)return fail('correlation_conflict');
      state.acquisition=episode;
      let indexed;
      const finish=value=>{helpers.save(sessionFile,state);finishIndex(indexed);return value;};
      if(episode.failed){
        if(episode.failed!=='context_unavailable'||!episode.target||condition(path.join(location,key),episode.target.response_id)===episode.failure_condition)
          return fail(episode.failed,{unchanged:true,transaction:episode.transaction});
        if(episode.attempts>=bounds.attempts)return finish(fail(episode.failed='recovery_budget_exhausted'));
        delete episode.failed;
      }
      if(input.depth>bounds.event_depth)return finish({...fail(episode.failed='recovery_budget_exhausted'),transaction:episode.transaction});
      const folder=path.join(location,key);
      let target=state.responses?.find(r=>r.response_id===input.response_id)
        ??(episode.target?.response_id===input.response_id?episode.target:undefined);
      if (input.offset===0) {
        try {
          indexed=reconcileIndex(folder,input,state);
          if (indexed?.status) return finish(fail(indexed.status,{transaction:episode.transaction}));
          target??=indexed?.entry;
        }
        catch { return finish(fail('context_unavailable',{transaction:episode.transaction})); }
      }
      if(!target)return {...fail('context_target_expired'),transaction:episode.transaction};
      const latest=state.responses?.findLast(entry=>!entry.historical);
      if((episode.dependency_identity??target.dependency_identity)&&latest?.dependency_identity&&(episode.dependency_identity??target.dependency_identity)!==latest.dependency_identity){
        episode.invalidations++;episode.attempts++;episode.offset=0;episode.complete=false;delete episode.last_offset;
        episode.target=latest;episode.dependency_identity=latest.dependency_identity;
        if(episode.invalidations>bounds.invalidations||episode.attempts>bounds.attempts)return finish(fail(episode.failed='recovery_budget_exhausted'));
        return finish({...fail('context_changed'),target:latest.response_id,transaction:episode.transaction,invalidations:episode.invalidations});
      }
      if((target.turn??0)!==state.sequence||(target.version??0)!==state.version){
        return finish(fail('context_changed',{transaction:episode.transaction,current_version:state.version}));
      }
      if(!episode.target){episode.target=target;episode.dependency_identity=target.dependency_identity;}
      if(episode.target.response_id!==input.response_id)return fail('correlation_conflict');
      const replay=input.offset===episode.last_offset;
      if(input.offset!==episode.offset&&!replay||episode.complete&&!replay)return fail('correlation_conflict');
      if(replay&&++episode.attempts>bounds.attempts)return finish(fail(episode.failed='recovery_budget_exhausted'));
      try {
        const stored=safeRead(path.join(folder,input.response_id+'.json'));
        if(identity(stored)!==episode.target.content_identity)throw Error('context_unavailable');
        const record=JSON.parse(stored);
        if(record.session!==input.chat||record.response_id!==input.response_id||(record.context.current?.turn??0)!==state.sequence)throw Error('context_unavailable');
        const reconstructed=encode(resolve(record,folder)),bytes=Buffer.from(reconstructed);
        let end=Math.min(input.offset+bounds.segment_bytes,bytes.length);
        while(end<bytes.length&&(bytes[end]&192)===128)end--;
        if(!replay&&++episode.segments>bounds.segments)return finish(fail(episode.failed='recovery_budget_exhausted'));
        episode.last_offset=input.offset;episode.offset=end;episode.complete=end===bytes.length;
        return finish({format:1,type:'oop_context_acquisition',status:episode.complete?'complete':'partial',transaction:episode.transaction,
          response_id:input.response_id,dependency_identity:episode.dependency_identity,content_identity:identity(bytes),offset:input.offset,next_offset:end,total_bytes:bytes.length,
          content:bytes.subarray(input.offset,end).toString('utf8'),bounds,assurance:'Owned bytes reconstructed; not proof of model retention, comprehension, effect permission or task completion.'});
      }catch{
        episode.attempts++;episode.failed=episode.attempts>=bounds.attempts?'recovery_budget_exhausted':'context_unavailable';
        episode.failure_condition=condition(path.join(location,key),input.response_id);
        return finish(fail(episode.failed,{transaction:episode.transaction}));
      }
    };
    const lock=path.join(location,'history.lock');
    let result=helpers.locked(lock,available), delay=8;
    while (result.status==='busy') {
      const episode=contention(location,key,helpers);
      const related={busy_phase:'history',reason:'history_acquisition_busy',transaction:input.transaction,response_id:input.response_id};
      if (episode.status!=='busy') return fail(episode.status,related);
      if (delay>32) return fail('busy',{...related,remaining_ms:episode.remaining,
        diagnostic:{code:'busy',message:'OOP controller diagnostic: history is busy during acquisition.',
          next_action:'Group equivalent occurrences. Inspect current owned state and correlated receipts before a bounded retry.',
          resumption_condition:'The lock is available and the current owned dependency and receipt evidence have been reconciled.'}});
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.min(episode.remaining,delay+Math.floor(Math.random()*delay/2)));
      delay*=2;
      if (helpers.pendingStop?.(location,key)) return fail('turn_interrupted',related);
      result=helpers.locked(lock,available);
    }
    return result;
  }
  return {encode,factor,resolve,dependency,acquire,bounds,identity,reconcileIndex,finishIndex,recoverHistoryLock};
}
module.exports={contextAcquisition};
