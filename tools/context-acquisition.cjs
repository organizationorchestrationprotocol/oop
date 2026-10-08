'use strict';
// Serialized producer implementation. Acquisition reads owned data; it never executes caller commands.
function contextAcquisition() {
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path');
  const {createHash}=process.getBuiltinModule('node:crypto');
  const identity=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
  const bounds=Object.freeze({attempts:8,event_depth:2,invalidations:3,segments:64,segment_bytes:8192});
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
    if(!stat.isFile()||stat.nlink!==1||stat.isSymbolicLink()||fs.realpathSync(file)!==file||stat.size>327680)throw Error('context_unavailable');
    return fs.readFileSync(file,'utf8');
  }
  function factor(record,definition,folder) {
    if(!definition)return record;
    const bytes=encode(definition),content_identity=identity(bytes),name='d-'+content_identity.slice(7)+'.json';
    immutable(path.join(folder,name),definition);
    const original=record.context.procedure,delta={};
    for(const [key,value]of Object.entries(original)){
      if(JSON.stringify(value)===JSON.stringify(definition[key]))continue;
      if(object(value)&&object(definition[key]))delta[key]=Object.fromEntries(Object.entries(value).filter(([field,v])=>JSON.stringify(v)!==JSON.stringify(definition[key][field])));
      else delta[key]=value;
    }
    return {...record,context:{...record.context,procedure:delta},definitions:{format:1,procedure:{locator:name,content_identity},
      resolution:'Verify content_identity over complete definition bytes. Reconstruct procedure by shallow object merge of definition and delta; merge each object-valued top-level field once, with delta fields replacing definition fields. Preserve arrays and strings exactly. Missing or altered definitions leave context incomplete.'}};
  }
  function resolve(record,folder) {
    if(!record.definitions)return record;
    const ref=record.definitions.procedure;
    if(record.definitions.format!==1||!ref||!/^d-[a-f0-9]{64}\.json$/.test(ref.locator)||!/^sha256:[a-f0-9]{64}$/.test(ref.content_identity))throw Error('context_unavailable');
    const bytes=safeRead(path.join(folder,ref.locator));if(identity(bytes)!==ref.content_identity)throw Error('context_unavailable');
    const base=JSON.parse(bytes),delta=record.context.procedure,procedure={...base};
    if(!object(base)||!object(delta))throw Error('context_unavailable');
    for(const [key,value]of Object.entries(delta)){
      if(['__proto__','prototype','constructor'].includes(key))throw Error('context_unavailable');
      procedure[key]=object(value)&&object(base[key])?{...base[key],...value}:value;
    }
    const {definitions,...output}=record;return {...output,context:{...record.context,procedure}};
  }
  function dependency(message) {
    const copy=JSON.parse(JSON.stringify(message));
    // Only delivery metadata is excluded. Governing status, scope, content and revisions remain dependencies.
    if(copy.freshness){delete copy.freshness.attempt_at;if(copy.freshness.last_success)delete copy.freshness.last_success.at;}
    if(copy.session_errors)copy.session_errors=[...new Map(copy.session_errors.map(({response_id,created_at,...e})=>[JSON.stringify(e),e])).values()];
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
  function acquire(root,input,helpers) {
    const fail=(code,extra={})=>({format:1,type:'oop_context_acquisition',status:code,...extra,
      diagnostic:{code,next_action:'Inspect the owned target and current snapshot under existing authority. Do not retry unchanged failure or resume a user-stopped turn.',
        resumption_condition:'A changed relevant dependency or an authorized repaired target permits a bounded new acquisition; independent authorized work may continue.'}});
    if(!object(input)||Object.keys(input).some(k=>!['event','chat','response_id','transaction','offset','depth'].includes(k))||input.event!=='acquire'||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(input.chat)||!/^r-[a-z0-9]+-[a-f0-9-]{8}$/.test(input.response_id)||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(input.transaction)||!Number.isSafeInteger(input.offset)||input.offset<0||
      !Number.isSafeInteger(input.depth)||input.depth<0)return fail('input_invalid');
    const location=path.join(root,'context'),key=helpers.sessionKey(input.chat),sessionFile=path.join(location,key+'.json');
    return helpers.locked(path.join(location,'history.lock'),()=>{
      const state=helpers.read(sessionFile);if(!state)return fail('chat_unavailable');
      if(state.turn_state?.state==='interrupted')return fail('turn_interrupted');
      let episode=state.acquisition;
      if(!episode||episode.turn!==state.sequence||episode.complete&&episode.transaction!==input.transaction){
        episode={turn:state.sequence,transaction:input.transaction,attempts:0,segments:0,invalidations:0,offset:0,complete:false};
      }
      if(episode.transaction!==input.transaction)return fail('correlation_conflict');
      state.acquisition=episode;
      const finish=value=>{helpers.save(sessionFile,state);return value;};
      if(episode.failed){
        if(episode.failed!=='context_unavailable'||!episode.target||condition(path.join(location,key),episode.target.response_id)===episode.failure_condition)
          return fail(episode.failed,{unchanged:true,transaction:episode.transaction});
        if(episode.attempts>=bounds.attempts)return finish(fail(episode.failed='recovery_budget_exhausted'));
        delete episode.failed;
      }
      if(input.depth>bounds.event_depth)return finish({...fail(episode.failed='recovery_budget_exhausted'),transaction:episode.transaction});
      const target=state.responses?.find(r=>r.response_id===input.response_id)||episode.target?.response_id===input.response_id&&episode.target;
      if(!target)return {...fail('context_target_expired'),transaction:episode.transaction};
      const latest=state.responses?.at(-1);
      if((episode.dependency_identity??target.dependency_identity)&&latest?.dependency_identity&&(episode.dependency_identity??target.dependency_identity)!==latest.dependency_identity){
        episode.invalidations++;episode.attempts++;episode.offset=0;episode.complete=false;delete episode.last_offset;
        episode.target=latest;episode.dependency_identity=latest.dependency_identity;
        if(episode.invalidations>bounds.invalidations||episode.attempts>bounds.attempts)return finish(fail(episode.failed='recovery_budget_exhausted'));
        return finish({...fail('context_changed'),target:latest.response_id,transaction:episode.transaction,invalidations:episode.invalidations});
      }
      if((target.turn??0)!==state.sequence)return finish(fail(episode.failed='context_changed'));
      if(!episode.target){episode.target=target;episode.dependency_identity=target.dependency_identity;}
      if(episode.target.response_id!==input.response_id)return fail('correlation_conflict');
      const replay=input.offset===episode.last_offset;
      if(input.offset!==episode.offset&&!replay||episode.complete&&!replay)return fail('correlation_conflict');
      if(replay&&++episode.attempts>bounds.attempts)return finish(fail(episode.failed='recovery_budget_exhausted'));
      try {
        const folder=path.join(location,key),stored=safeRead(path.join(folder,input.response_id+'.json'));
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
    });
  }
  return {encode,factor,resolve,dependency,acquire,bounds,identity};
}
module.exports={contextAcquisition};
