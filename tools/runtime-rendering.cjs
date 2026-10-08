'use strict';
const {runtimeFeedback}=require('./runtime-feedback.cjs');
// Serialized producer implementation; translation and host enforcement remain host-owned.
function runtimeRendering() {
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),crypto=process.getBuiltinModule('node:crypto');
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const decisions=['allow','deny','unknown','error'];
  const secret=/-----BEGIN [A-Z ]*PRIVATE KEY|\b(?:gh[pousr]_|sk-|xox[baprs]-)[A-Za-z0-9_-]{10,}|\bAKIA[0-9A-Z]{16}\b/i;
  const codes=['renderer_exception','renderer_timeout','renderer_output_invalid','renderer_input_invalid','fallback_invalid','delivery_failed','adapter_decode_failed','native_event_invalid','native_event_unsupported','integration_contract_failure'];
  const hash=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
  const failure=code=>Object.assign(Error(code),{renderCode:code});
  function options(value={}) {
    if(!object(value)||Object.keys(value).some(k=>!['timeoutMs','marginMs','maxOutputBytes','retentionMs','maxRecords','hostDeadlineMs'].includes(k)))throw failure('renderer_input_invalid');
    const p={timeoutMs:1000,marginMs:100,maxOutputBytes:1048576,retentionMs:604800000,maxRecords:1000,...value};
    for(const [key,min,max] of [['timeoutMs',1,30000],['marginMs',1,30000],['maxOutputBytes',1024,1048576],['retentionMs',0,31536000000],['maxRecords',1,10000]])
      if(!Number.isSafeInteger(p[key])||p[key]<min||p[key]>max)throw failure('renderer_input_invalid');
    if(p.hostDeadlineMs!==undefined&&(!Number.isSafeInteger(p.hostDeadlineMs)||p.hostDeadlineMs<=p.timeoutMs+p.marginMs))throw failure('renderer_input_invalid');
    return p;
  }
  // Central controller-owned framing; internal line breaks are preserved.
  const channel=value=>{const trimmed=value.trim();return trimmed.length?trimmed+'\n':'';};
  function output(x,p=options(),fallback=false) {
    if(!object(x)||Object.keys(x).some(k=>!['stdout','stderr','exitCode'].includes(k))||
      typeof x.stdout!=='string'||typeof x.stderr!=='string'||!x.stdout.isWellFormed()||!x.stderr.isWellFormed()||
      !Number.isInteger(x.exitCode)||x.exitCode<0||x.exitCode>255||Buffer.byteLength(x.stdout+x.stderr,'utf8')>p.maxOutputBytes||
      (fallback&&secret.test(x.stdout+x.stderr)))throw failure('renderer_output_invalid');
    const stdout=channel(x.stdout),stderr=channel(x.stderr);
    if(Buffer.byteLength(stdout+stderr,'utf8')>p.maxOutputBytes)throw failure('renderer_output_invalid');
    return {stdout,stderr,exitCode:x.exitCode};
  }
  function input(x) {
    if(!object(x)||x.format!==1||Object.keys(x).some(k=>!['format','raw','context','event','decision','response','error','additionalContext'].includes(k))||!decisions.includes(x.decision)||!Object.hasOwn(x,'raw')||!Object.hasOwn(x,'context')||!Object.hasOwn(x,'event')||
      (Object.hasOwn(x,'response')&&Object.hasOwn(x,'error'))||(Object.hasOwn(x,'error')&&typeof x.error!=='string'))throw failure('renderer_input_invalid');
    const seen=new Set();
    function json(v){if(v===null||typeof v==='string'||typeof v==='boolean')return;
      if(typeof v==='number'&&Number.isFinite(v))return;
      if(typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype))throw Error();
      seen.add(v);for(const key of Reflect.ownKeys(v)){if(typeof key!=='string')throw Error();const d=Object.getOwnPropertyDescriptor(v,key);if(!Object.hasOwn(d,'value'))throw Error();json(d.value);}seen.delete(v);}
    try{json(x);}catch{throw failure('renderer_input_invalid');}
    return x;
  }
  function summary(x){return {decision:decisions.includes(x?.decision)?x.decision:'unavailable',
    response_available:object(x)&&Object.hasOwn(x,'response'),error_available:object(x)&&Object.hasOwn(x,'error'),
    additional_context_available:object(x)&&Object.hasOwn(x,'additionalContext')};}
  const message=(result,code)=>'Treat the following as additional context: the original OOP controller result was '+JSON.stringify(result)+
    '; an error occurred while the runtime adapter was rendering it. Host delivery and enforcement are not established. '+
    runtimeFeedback().recovery(code);
  function scope(record) {
    if(!object(record)||typeof record.owned_scope!=='string'||typeof record.installation_uid!=='string'||typeof record.project_root!=='string')throw Error('diagnostic_scope_unavailable');
    const owned=path.resolve(record.owned_scope);
    if(fs.realpathSync.native(owned)!==owned||fs.lstatSync(owned).isSymbolicLink())throw Error('diagnostic_scope_invalid');
    const root=path.join(owned,'rendering-diagnostics');
    if(fs.existsSync(root)&&(fs.realpathSync.native(root)!==root||!fs.lstatSync(root).isDirectory()))throw Error('diagnostic_scope_invalid');
    return {root,identity:hash(record.project_root+'\0'+record.installation_uid)};
  }
  function readFile(file) {
    if(fs.lstatSync(file).isSymbolicLink()||fs.realpathSync.native(file)!==path.resolve(file))throw Error('diagnostic_record_alias');
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
    try{const st=fs.fstatSync(fd);if(!st.isFile()||st.nlink!==1||st.size>65536)throw Error('diagnostic_record_invalid');
      return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(fd)));}finally{fs.closeSync(fd);}
  }
  function create(file,value) {
    const fd=fs.openSync(file,'wx',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  }
  const idOK=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
  function list(record) {
    const s=scope(record),records=[],errors=[];
    if(!fs.existsSync(s.root))return {records,errors};
    for(const name of fs.readdirSync(s.root).filter(n=>n.endsWith('.json')&&!n.endsWith('.read.json'))){
      try{
        const id=name.slice(0,-5);if(!idOK(id))throw Error();
        const r=readFile(path.join(s.root,name));
        if(r.format!==1||r.id!==id||r.scope!==s.identity||r.read!==false||Object.hasOwn(r,'read_at')||
          !Number.isFinite(Date.parse(r.created_at))||!codes.includes(r.error_code)||!object(r.result)||
          ![...decisions,'unavailable'].includes(r.result.decision)||
          ['response_available','error_available','additional_context_available'].some(k=>typeof r.result[k]!=='boolean'))throw Error();
        const safe={format:1,id,created_at:r.created_at,scope:s.identity,result:summaryResult(r.result),error_code:r.error_code,
          language:'en',message:message(summaryResult(r.result),r.error_code),event:typeof r.event==='string'&&/^[a-z-]{1,40}$/.test(r.event)?r.event:'unavailable',read:false};
        const ack=path.join(s.root,id+'.read.json');
        if(fs.existsSync(ack)){const a=readFile(ack);if(a.id!==id||a.scope!==s.identity||!Number.isFinite(Date.parse(a.read_at)))throw Error();safe.read=true;safe.read_at=a.read_at;}
        records.push(safe);
      }catch{errors.push('diagnostic_record_unavailable');}
    }
    return {records,errors};
  }
  function summaryResult(r){return {decision:r.decision,response_available:r.response_available,error_available:r.error_available,additional_context_available:r.additional_context_available};}
  function acknowledge(record,id,presentation) {
    const s=scope(record);
    if(idOK(id)){const prior=path.join(s.root,id+'.read.json');if(fs.existsSync(prior)){const a=readFile(prior);if(a.id!==id||a.scope!==s.identity||!Number.isFinite(Date.parse(a.read_at)))throw Error('diagnostic_ack_invalid');return {acknowledged:true,id};}}
    const r=list(record).records.find(x=>x.id===id);
    if(!r)throw Error('diagnostic_not_found');
    const p=presentation;
    if(!object(p)||p.id!==id||p.original_presented!==true||p.presented!==true||typeof p.effective_language!=='string'||
      !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(p.effective_language)||
      (!/^en(?:-|$)/i.test(p.effective_language)&&p.translation_presented!==true&&p.translation_unavailable_reported!==true)||
      !Number.isFinite(Date.parse(p.presented_at))||Date.parse(p.presented_at)<Date.parse(r.created_at)||Date.parse(p.presented_at)>Date.now()+1000)throw Error('diagnostic_presentation_incomplete');
    const file=path.join(s.root,id+'.read.json');
    const ack={format:1,id,scope:s.identity,read_at:p.presented_at};
    try{create(file,ack);}catch(e){if(e.code!=='EEXIST')throw e;const a=readFile(file);if(a.id!==id||a.scope!==s.identity||!Number.isFinite(Date.parse(a.read_at)))throw Error('diagnostic_ack_invalid');}
    return {acknowledged:true,id};
  }
  function cleanup(record,p=options(),now=Date.now()) {
    const s=scope(record),state=list(record);let removed=0;
    for(const r of state.records){if(!r.read||now-Date.parse(r.read_at)<p.retentionMs)continue;
      // Immutable failure plus an exclusive read receipt: no unread record can enter cleanup.
      try{fs.unlinkSync(path.join(s.root,r.id+'.json'));removed++;}catch(e){if(['EPERM','EACCES','EBUSY'].includes(e.code))state.errors.push('diagnostic_cleanup_pending');else if(e.code!=='ENOENT')throw e;}
      // Acknowledgement tombstones prevent collision/re-ack races; collect after a second retention interval.
    }
    for(const name of fs.readdirSync(s.root).filter(n=>n.endsWith('.read.json'))){
      const id=name.slice(0,-10);if(!idOK(id)||fs.existsSync(path.join(s.root,id+'.json')))continue;
      try{const a=readFile(path.join(s.root,name));if(a.id===id&&a.scope===s.identity&&now-Date.parse(a.read_at)>Math.max(p.retentionMs*2,1000))fs.unlinkSync(path.join(s.root,name));}catch(e){if(e.code!=='ENOENT')state.errors.push('diagnostic_ack_unavailable');}
    }
    return {removed,errors:state.errors};
  }
  function persist(record,result,code,event,p) {
    const s=scope(record);fs.mkdirSync(s.root,{recursive:true,mode:0o700});
    cleanup(record,p);const state=list(record);
    if(state.records.length+state.errors.length>=p.maxRecords)throw Error('diagnostic_store_full');
    // Each exclusive file is a separate record; interrupted partial writes stay recoverable.
    for(let i=0;i<3;i++){
      const id=crypto.randomUUID(),r={format:1,id,created_at:new Date().toISOString(),scope:s.identity,result,error_code:code,
        language:'en',message:message(result,code),runtime_version_identity:record.runtime_adapter?.runtime_version?hash(record.runtime_adapter.runtime_version):null,host_deadline_ms:p.hostDeadlineMs??null,event:/^[a-z-]{1,40}$/.test(event??'')?event:'unavailable',read:false};
      try{if(fs.existsSync(path.join(s.root,id+'.read.json')))continue;create(path.join(s.root,id+'.json'),r);return r;}catch(e){if(e.code!=='EEXIST')throw e;}
    }
    throw Error('diagnostic_identifier_collision');
  }
  function recover({record,request,error,event,policy,fallback}) {
    const p=policy??options(),code=codes.includes(error?.renderCode)?error.renderCode:'renderer_exception',result=summary(request);
    let notice=message(result,code),diagnostic=null,persisted=false;
    try{diagnostic=persist(record,result,code,event,p);persisted=true;}catch{notice+=' Diagnostic persistence failed; no successful write is claimed.';}
    let selected=null,limitation='';
    if(fallback!==undefined){
      try{selected=output(fallback,p,true);}catch{limitation=' Declared fallback is invalid.';}
    }else limitation=' No applicable validated host-specific fallback is available.';
    // Reserve diagnostic space; never truncate or rewrite the host-facing fallback stdout.
    const stderr=channel((selected?.stderr??'')+notice+limitation);
    if(selected&&Buffer.byteLength(selected.stdout+stderr)>p.maxOutputBytes){selected=null;notice+=' Combined fallback output exceeds the limit.';}
    return {stdout:selected?.stdout??'',stderr:selected?stderr:channel(notice+limitation),exit:selected?.exitCode??4,
      error:code,diagnostic_id:diagnostic?.id??null,persisted,fallback_used:!!selected};
  }
  function run({record,request,invoke,event,policy,fallback}) {
    let p;
    try{p=options(policy);input(request);const out=output(invoke(p),p);return {stdout:out.stdout,stderr:out.stderr,exit:out.exitCode,response:request.response};}
    catch(error){return recover({record,request,error,event,policy:p??options(),fallback});}
  }
  async function present(record,handlers) {
    const state=list(record),outcomes=[];
    for(const r of state.records.filter(x=>!x.read)){
      try{
        const language=handlers.effectiveLanguage;
        if(typeof language!=='string')throw Error();
        const needs=!/^en(?:-|$)/i.test(language);let translation,unavailable=false;
        if(needs){try{translation=await handlers.translate?.(r.message,language);if(typeof translation!=='string'||!translation.trim())throw Error();}catch{unavailable=true;}}
        // A fulfilled explicit receipt is required; an invocation or partial display is insufficient.
        const receipt=await handlers.present({id:r.id,original:r.message,...(translation?{translation}:{}),translationUnavailable:unavailable});
        if(receipt?.presented!==true)throw Error();
        outcomes.push(acknowledge(record,r.id,{id:r.id,presented:true,original_presented:true,effective_language:language,
          translation_presented:!!translation,translation_unavailable_reported:unavailable,presented_at:new Date().toISOString()}));
      }catch{outcomes.push({id:r.id,acknowledged:false});}
    }
    return {outcomes,errors:state.errors};
  }
  return {channel,options,input,output,summary,list,acknowledge,cleanup,persist,recover,run,present,failure};
}
module.exports={runtimeRendering};
