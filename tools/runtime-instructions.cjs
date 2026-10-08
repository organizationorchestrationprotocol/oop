'use strict';
const {extractMandatorySource}=require('./mandatory-source.cjs');
function runtimeOperationalRules(kind='oop') {
  const texts=runtimeOperationalRules.texts;
  if(kind==='all')return texts.oop+'\n'+texts.profiles;
  if(!Object.hasOwn(texts,kind))throw Error('Mandatory source unavailable');
  return texts[kind];
}
runtimeOperationalRules.texts=Object.freeze(extractMandatorySource(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','PROTOCOL.md'),'utf8')));
function renderMandatoryProcedures(sourceIdentity) {
  if(typeof sourceIdentity!=='string'||!/^sha256:[a-f0-9]{64}$/.test(sourceIdentity))throw Error('Mandatory source identity unavailable');
  return '<!-- OOP mandatory procedures: begin; source: '+sourceIdentity+' -->\n'+
    '## Mandatory OOP procedure\n\n'+runtimeOperationalRules()+'\n\n'+
    '## Mandatory knowledge-profile procedure\n\n'+runtimeOperationalRules('profiles')+'\n'+
    '<!-- OOP mandatory procedures: end -->';
}
function verifyMandatoryView(actual,expected) {
  if(typeof expected!=='string'||!expected)return {status:'source_or_version_unavailable'};
  if(actual===null||actual===undefined)return {status:'missing'};
  if(typeof actual!=='string')return {status:'verification_unavailable'};
  const begin='<!-- OOP mandatory procedures: begin; source: ',end='<!-- OOP mandatory procedures: end -->';
  if(!actual.includes(begin)&&!actual.includes(end))return {status:'missing'};
  const at=actual.indexOf(begin),last=actual.indexOf(end,at);
  if(at!==0||last<at||actual.split(begin).length!==2||actual.split(end).length!==2)return {status:'incomplete_or_altered'};
  return {status:actual.slice(at,last+end.length)===expected?'present_and_integral':'incomplete_or_altered'};
}
// Shared deterministic rendering for current context and isolated producer fixtures.
function composeRuntimeInstructions({layers,canonical,contractIds,sourceIdentity,sha}) {
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const text=(x,max)=>typeof x==='string'&&x.length>0&&x.length<=max&&x===x.trim();
  const bytes=s=>Buffer.byteLength(s,'utf8');
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
  const contracts=new Set(contractIds),conflicts=[],accepted={organization:[],workspace:[]};
  for(const layer of ['organization','workspace']){
    const valid=[];
    for(const r of layers[layer].records){if(validInstruction(r,layer))valid.push(r);else conflicts.push(object(r)&&typeof r.id==='string'&&r.id.length<=64?r.id:'invalid-record');}
    const count=Object.create(null);for(const r of valid)count[r.id]=(count[r.id]??0)+1;
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
  const lines=['OOP distribution: '+(sourceIdentity??'unknown'),...incomplete.map(l=>'OOP instructions: incomplete, '+l+' '+states[l])];
  for(const layer of ['organization','workspace'])for(const r of [...accepted[layer]].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
    lines.push('['+r.id+'] '+clean(r.title),clean(r.text),'Applies to: '+clean(r.applies_to));
    if(layer==='organization')lines.push('Canonical: '+clean(r.canonical_ref));
  }
  const rendered=lines.join('\n')+'\n',identity=sha(rendered);
  // The governing set retains its own identity; Markdown is a disposable view.
  const escape=s=>clean(s).replace(/[\\`*_[\]<>#|]/g,'\\$&');
  const md=[renderMandatoryProcedures(sourceIdentity),'','# Runtime instructions','','<!-- instructions_identity: '+identity+'; format: markdown -->','',
    '**OOP distribution:** '+escape(sourceIdentity??'unknown'),'','## Technical adoption','',runtimeOperationalRules('upgrade'),''];
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
module.exports={composeRuntimeInstructions,runtimeOperationalRules,renderMandatoryProcedures,verifyMandatoryView};
