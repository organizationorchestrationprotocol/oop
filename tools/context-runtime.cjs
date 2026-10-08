'use strict';
// Serialized into the official controller; local integration, never policy authority.
function contextRuntime(controller, template) {
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path');
  const {randomUUID,createHash}=process.getBuiltinModule('node:crypto');
  const {spawnSync}=process.getBuiltinModule('node:child_process');
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const digest=x=>createHash('sha256').update(x).digest('hex');
  const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  const identifier=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(x);
  const MAX=262144, STORE=4*1024*1024;
  const codes=new Set(['unsupported_invocation','invalid_path','unsafe_path','registration_invalid','registration_missing','adapter_missing','adapter_invalid','adapter_execution_failed','manifest_invalid','native_event_invalid','placeholder_invalid','input_invalid','input_limit','input_timeout','context_unavailable','unsupported_event','invalid_event','invalid_record','unresolved_facets','bootstrap_or_inactive','local_coordination_unavailable','chat_unavailable','history_capacity_reached','subject_capacity_reached','revision_capacity_reached','stale_or_invalid_transition','correlation_conflict','busy','ack_invalid','ack_stale','ack_uid_unknown','journal_invalid','journal_full','output_invalid','delivery_failed','controller_failure']);
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
  function atomic(file,text) {
    if(fs.existsSync(file))absolute(file,'file');
    const temporary=file+'.'+randomUUID()+'.tmp';
    fs.writeFileSync(temporary,text,{flag:'wx',mode:0o600});
    try{fs.renameSync(temporary,file);}finally{fs.rmSync(temporary,{force:true});}
  }
  function lock(root,work) {
    const file=path.join(root,'oop-enforce-errors.lock');let fd;
    const deadline=Date.now()+1000;while(fd===undefined){try{fd=fs.openSync(file,'wx',0o600);}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()>=deadline)throw Error('busy');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}
    const owner=randomUUID();
    try{fs.writeFileSync(fd,owner);return work();}finally{fs.closeSync(fd);if(fs.readFileSync(file,'utf8')===owner)fs.unlinkSync(file);}
  }
  function readJournal(root) {
    const file=path.join(root,'oop-enforce-errors.jsonl');
    if(!fs.existsSync(file))return [];
    absolute(file,'file');if(fs.statSync(file).size>STORE)throw Error('journal_full');
    const text=fs.readFileSync(file,'utf8');
    if(text&&!text.endsWith('\n'))throw Error('journal_invalid');
    const seen=new Set();return text.split('\n').filter(Boolean).map(line=>{
      let r;try{r=JSON.parse(line);}catch{throw Error('journal_invalid');}
      if(!object(r)||!identifier(r.uid)||seen.has(r.uid)||typeof r.read!=='boolean'||!codes.has(r.code)||
        !Number.isFinite(Date.parse(r.created_at))||typeof r.message!=='string'||r.message!==message(r.code)||
        Object.keys(r).some(k=>!['uid','read','code','created_at','message','receipt'].includes(k))||r.read!==Boolean(r.receipt))throw Error('journal_invalid');
      if(r.receipt&&(!object(r.receipt)||r.receipt.disposition!=='accepted'||!identifier(r.receipt.chat)||
        !identifier(r.receipt.request_id)||!Number.isSafeInteger(r.receipt.turn)||!Array.isArray(r.receipt.uids)))throw Error('journal_invalid');
      seen.add(r.uid);return r;
    });
  }
  function writeJournal(root,rows){const text=rows.map(r=>JSON.stringify(r)+'\n').join('');if(Buffer.byteLength(text)>STORE)throw Error('journal_full');atomic(path.join(root,'oop-enforce-errors.jsonl'),text);}
  function message(code){return 'OOP controller diagnostic: '+code+'. Read the applicable contract and inspect the owned integration and current state; present this diagnostic, then attempt authorized repair. Reading is not resolution or authority.';}
  function persist(root,error){
    const code=codes.has(error?.message)?error.message:'controller_failure';
    if(!root)return {persisted:false,code,storage:'valid_runtime_root_unavailable'};
    try{return lock(root,()=>{const rows=readJournal(root),record={uid:randomUUID(),read:false,code,created_at:new Date().toISOString(),message:message(code)};rows.push(record);writeJournal(root,rows);return {persisted:true,uid:record.uid,code};});}
    catch{return {persisted:false,code,storage:'diagnostic_store_unavailable'};}
  }
  function diagnostics(root,chat){
    const rows=readJournal(root),receipts=[...new Map(rows.filter(r=>r.receipt?.chat===chat).map(r=>[r.receipt.request_id,r.receipt])).values()];
    return {locator:path.join(root,'oop-enforce-errors.jsonl'),unread:rows.filter(r=>!r.read).slice(0,32),unread_count:rows.filter(r=>!r.read).length,receipts:receipts.slice(-16),revision:digest(JSON.stringify(rows))};
  }
  function acknowledge(root,registration,input){
    if(!object(input)||Object.keys(input).some(k=>!['uids','chat','turn','expected_version','request_id','presentation'].includes(k))||
      !identifier(input.chat)||!identifier(input.request_id)||!Number.isSafeInteger(input.turn)||input.turn<1||!Number.isSafeInteger(input.expected_version)||input.expected_version<1||
      !Array.isArray(input.uids)||!input.uids.length||input.uids.length>128||new Set(input.uids).size!==input.uids.length||!input.uids.every(identifier)||
      !object(input.presentation)||Object.keys(input.presentation).some(k=>!['original_shown','effective_language','translation','presented_at'].includes(k))||
      input.presentation.original_shown!==true||typeof input.presentation.effective_language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.presentation.effective_language)||
      !['shown','unavailable','not_required'].includes(input.presentation.translation)||
      (input.presentation.translation==='not_required'&&!/^en(?:-|$)/.test(input.presentation.effective_language))||
      !Number.isFinite(Date.parse(input.presentation.presented_at))||Date.parse(input.presentation.presented_at)>Date.now()+1000)throw Error('ack_invalid');
    const historyRoot=absolute(path.join(root,'context'),'directory'),historyLock=path.join(historyRoot,'history.lock');let fd;
    try{fd=fs.openSync(historyLock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('busy');throw e;}
    const owner=randomUUID();
    try{
      fs.writeFileSync(fd,owner);
      return lock(root,()=>{
        const rows=readJournal(root),old=rows.find(r=>r.receipt?.request_id===input.request_id&&r.receipt.chat===input.chat)?.receipt;
        const fingerprint=digest(JSON.stringify({chat:input.chat,turn:input.turn,expected_version:input.expected_version,uids:input.uids,presentation:input.presentation}));
        if(old){if(old.fingerprint!==fingerprint)throw Error('ack_invalid');return {...old,replayed:true};}
        const stateFile=absolute(path.join(historyRoot,digest(input.chat)+'.json'),'file');
        const current=JSON.parse(fs.readFileSync(stateFile,'utf8'));
        if(current.sequence!==input.turn||current.version!==input.expected_version)throw Error('ack_stale');
        const selected=input.uids.map(uid=>rows.find(r=>r.uid===uid));
        if(selected.some(r=>!r||r.read))throw Error('ack_uid_unknown');
        if(selected.some(r=>Date.parse(input.presentation.presented_at)<Date.parse(r.created_at)))throw Error('ack_invalid');
        const receipt={disposition:'accepted',installation_uid:registration.installation_uid,chat:input.chat,turn:input.turn,version:current.version,
          request_id:input.request_id,uids:input.uids,fingerprint,presentation:input.presentation,read_at:new Date().toISOString()};
        for(const r of selected){r.read=true;r.receipt=receipt;}
        // Receipt and read flags form one atomic journal transaction. The current
        // turn's diagnostic state is reconstructed from it, never dual-written.
        writeJournal(root,rows);return receipt;
      });
    }finally{fs.closeSync(fd);if(fs.readFileSync(historyLock,'utf8')===owner)fs.unlinkSync(historyLock);}
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
  function validateManifest(m){
    if(!object(m)||m.schema_version!==1||typeof m.host!=='string'||!m.host.trim()||typeof m.runtime_version!=='string'||!m.runtime_version.trim()||
      !Array.isArray(m.documentation)||!m.documentation.length||m.documentation.some(d=>!object(d)||!['source','section'].every(k=>typeof d[k]==='string'&&d[k].trim()))||
      typeof m.invocation_basis!=='string'||!m.invocation_basis.trim()||typeof m.continuation_basis!=='string'||!m.continuation_basis.trim()||
      !Array.isArray(m.nonblocking_exit_codes)||!m.nonblocking_exit_codes.length||m.nonblocking_exit_codes.some(c=>!Number.isInteger(c)||c<0||c>255)||
      !object(m.supported_commands)||!object(m.placeholders))throw Error('manifest_invalid');
    for(const [command,events]of Object.entries(m.supported_commands)){
      if(!['session_open','prompt'].includes(command)||!object(events)||!Object.keys(events).length)throw Error('manifest_invalid');
      const seen=new Set();for(const [key,response]of Object.entries(events)){
        for(const event of alternatives(key)){if(seen.has(event))throw Error('manifest_invalid');seen.add(event);}
        if(!object(response)||Object.keys(response).sort().join(',')!=='exit_code,stderr,stdout'||
          typeof response.stdout!=='string'||typeof response.stderr!=='string'||!m.nonblocking_exit_codes.includes(response.exit_code))throw Error('manifest_invalid');
        // Every variant forwards complete context. Templates cannot discard it.
        let contextUses=0;
        for(const text of [response.stdout,response.stderr])text.replace(/\{\{\{\{|\}\}\}\}|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g,(token,name)=>{
          const p=name?m.placeholders[name]:null;
          if(p?.required===true&&(['additionalContext','response.additionalContext'].includes(p.source)||p.source==='response'&&p.type==='json'&&p.encoding==='json'))contextUses++;
          return token;
        });
        if(contextUses!==1)throw Error('manifest_invalid');
        render(response,m,{additionalContext:'validation',response:{}},true);
      }
    }
    if(!m.supported_commands.session_open||!m.supported_commands.prompt)throw Error('manifest_invalid');
  }
  function render(spec,manifest,values,validation=false){
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
  function attach(result,root,chat){
    const state=diagnostics(root,chat);result.context.errors=state;
    result.additionalContext+='\n'+JSON.stringify({controller_errors:state});
    if(Buffer.byteLength(JSON.stringify(result))>MAX)throw Error('output_invalid');return result;
  }
  async function execute(args,input){
    let root,registration,selected,manifest,command;const rawArgs=args;
    try{
      if(typeof args[0]==='string')root=absolute(args[0],'directory');
      if(!root)throw Error('unsupported_invocation');
      registration=loadRegistration(root);
      // Load both mandatory root components even for direct diagnostics commands.
      const loaded=loadAdapter(root,null,registration,false);manifest=loaded.manifest;
      if(args.length!==2||!['enforcement','session_open','prompt','record','snapshot','errors-read','errors-ack'].includes(args[1]))throw Error('unsupported_invocation');
      command=args[1];
      if(typeof input!=='string'||Buffer.byteLength(input)>65536)throw Error('input_limit');
      let raw;try{raw=JSON.parse(input);}catch{throw Error('input_invalid');}
      let event=raw;
      if(command==='enforcement'){
        const decoded=loadAdapter(root,raw,registration,true).decoded;
        if(!object(decoded)||Object.keys(decoded).some(k=>!['native_event','event'].includes(k))||typeof decoded.native_event!=='string'||decoded.native_event.includes('|')||
          !object(decoded.event)||!['session_open','prompt'].includes(decoded.event.event))throw Error('native_event_invalid');
        const entries=Object.entries(manifest.supported_commands[decoded.event.event]);
        selected=entries.find(([key])=>alternatives(key).includes(decoded.native_event))?.[1];
        if(!selected)throw Error('native_event_invalid');event=decoded.event;
      }else if(command==='errors-ack'){
        const receipt=acknowledge(root,registration,raw),result=controller.compose(registration,{event:'snapshot',chat:raw.chat});
        result.context.error_receipt=receipt;return {stdout:JSON.stringify(attach(result,root,raw.chat))+'\n',stderr:'',exitCode:0};
      }else if(command==='errors-read'){
        if(!object(raw)||Object.keys(raw).some(k=>k!=='chat')||!identifier(raw.chat))throw Error('input_invalid');
        const result=controller.compose(registration,{event:'snapshot',chat:raw.chat});
        return {stdout:JSON.stringify(attach(result,root,raw.chat))+'\n',stderr:'',exitCode:0};
      }else if(!object(raw)||raw.event!==command)throw Error('input_invalid');
      const result=controller.compose(registration,event);
      if(!['available','record_accepted','bootstrap_or_inactive'].includes(result.context.status)){
        result.context.error=persist(root,Error(result.context.status));
      }
      for(const [failed,code] of [
        [['failed','unavailable','source_conflict'].includes(result.context.freshness?.status),'controller_failure'],
        [['incomplete','conflict','unavailable'].includes(result.context.instructions?.status),'context_unavailable'],
        [result.context.migration?.status==='migration_procedures_unavailable','context_unavailable']
      ])if(failed)persist(root,Error(code));
      attach(result,root,event.chat);
      if(selected)return render(selected,manifest,{response:result,additionalContext:result.additionalContext});
      return {stdout:JSON.stringify(result)+'\n',stderr:'',exitCode:command==='record'?(result.context.status==='record_accepted'?0:1):result.context.status==='available'?0:1};
    }catch(error){
      const diagnostic=persist(root,error),result=controller.response({status:'context_unavailable',state:'intake',history:[],freshness:{status:'unavailable'},diagnostic});
      if(root)try{attach(result,root);}catch{result.context.error_storage='unavailable';}
      if(selected)try{return render(selected,manifest,{response:result,additionalContext:result.additionalContext});}catch{/* No guessed native response or event. */}
      return {stdout:JSON.stringify(result)+'\n',stderr:JSON.stringify({code:diagnostic.code,persisted:diagnostic.persisted,storage:diagnostic.storage??null})+'\n',exitCode:rawArgs[1]==='enforcement'?0:1};
    }
  }
  return {execute,persist,diagnostics,acknowledge,validateManifest,render,absolute};
}
module.exports={contextRuntime};
