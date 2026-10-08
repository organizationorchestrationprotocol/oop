'use strict';
// Implementation policy for local filesystem paths, not protocol authority.
function runtimePaths(platform = process.platform) {
  const path=process.getBuiltinModule('node:path'),fs=process.getBuiltinModule('node:fs');
  const api=platform==='win32'?path.win32:path.posix;
  const equal=(a,b)=>platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  function failure(code,field,rule,received='string') {
    const error=Error(code);
    const expected=rule==='mapping_shape'?(field==='registration.path_mappings'?'array of at most 16 {from,to} absolute-prefix mappings':'object with exactly from and to'):rule==='overlapping_prefixes'?'distinct nonoverlapping source prefixes':'unambiguous absolute path in the owned workspace; no aliases or dot segments';
    error.pathDiagnostic={code,items:[{field,rule,expected,received}],
      remedy:'Correct the identified event field or repair the owned registration under existing authority. Use a complete native absolute path or an explicitly registered path mapping; never infer acceptance.'};
    return error;
  }
  function spelling(raw,field) {
    if(typeof raw!=='string'||!raw.length||raw.length>1024||/[\0-\x1f\x7f]/.test(raw))
      throw failure('invalid_path',field,'malformed',typeof raw==='string'?'string(length '+raw.length+')':typeof raw);
    if(platform==='win32'&&/^[/\\]{2}[?.][/\\]/.test(raw)&&
      !/^\\\\\?\\(?:[A-Za-z]:[\\/]|UNC\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))/i.test(raw))
      throw failure('invalid_path',field,'device_namespace');
    if(raw.split(/[\\/]/).some(part=>part==='.'||part==='..'))throw failure('invalid_path',field,'dot_segment');
    return raw;
  }
  function native(raw,field='path') {
    let value=spelling(raw,field);
    if(platform==='win32') {
      value=value.replace(/^\\\\\?\\UNC\\/i,'\\\\').replace(/^\\\\\?\\(?=[A-Za-z]:[\\/])/,'');
      if(!/^[A-Za-z]:[\\/]/.test(value)&&!/^[/\\]{2}[^/\\?.:]+[/\\][^/\\]+(?:[/\\]|$)/.test(value))
        throw failure('invalid_path',field,/^[A-Za-z]:/.test(value)?'drive_relative':/^[/\\]/.test(value)?'root_relative':'not_absolute');
    } else {
      if(/^[A-Za-z]:|^\\/.test(value))throw failure('invalid_path',field,'foreign_platform');
      if(!api.isAbsolute(value))throw failure('invalid_path',field,'not_absolute');
    }
    return api.resolve(value);
  }
  function mappings(value) {
    if(value===undefined)return [];
    if(!Array.isArray(value)||value.length>16)throw failure('registration_invalid','registration.path_mappings','mapping_shape',typeof value);
    const result=value.map((entry,index)=>{
      const field='registration.path_mappings['+index+']';
      if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='from,to')throw failure('registration_invalid',field,'mapping_shape',entry===null?'null':Array.isArray(entry)?'array':typeof entry);
      let from=spelling(entry.from,field+'.from').replace(/\\/g,'/');
      if(!/^(?:[A-Za-z]:\/|\/)/.test(from))throw failure('registration_invalid',field+'.from','absolute_prefix');
      from=from.replace(/\/+$/,'')+'/';
      return {from,to:native(entry.to,field+'.to')};
    });
    for(let i=0;i<result.length;i++)for(let j=0;j<i;j++)
      if(result[i].from.startsWith(result[j].from)||result[j].from.startsWith(result[i].from))throw failure('registration_invalid','registration.path_mappings','overlapping_prefixes');
    return result;
  }
  function resolve(raw,field='path',entries=[]) {
    spelling(raw,field);
    // A valid native path keeps its native meaning; mappings cannot redirect it.
    try{return native(raw,field);}catch(error){
      const foreign=platform==='win32'?/^\/(?!\/)/.test(raw):/^[A-Za-z]:[\\/]|^\\\\[^\\]/.test(raw);
      if(!entries.length||!foreign)throw error;
    }
    const wire=raw.replace(/\\/g,'/');
    const entry=entries.find(item=>wire===item.from.slice(0,-1)||wire.startsWith(item.from));
    if(!entry)throw failure('invalid_path',field,'mapping_required');
    return native(api.join(entry.to,wire.slice(entry.from.length)),field);
  }
  const aliasFree=target=>equal(native(fs.realpathSync.native(target)),native(target));
  function inspect(target,field,kind) {
    try {
      const stat=fs.lstatSync(target);
      if(stat.isSymbolicLink()||!aliasFree(target)||(kind==='directory'?!stat.isDirectory():!stat.isFile()||stat.nlink!==1))
        throw failure('unsafe_path',field,'alias_or_type');
      return stat;
    }catch(error){
      if(error.pathDiagnostic)throw error;
      throw failure('invalid_path',field,['ENOENT','ENOTDIR'].includes(error.code)?'not_found':'filesystem_unavailable');
    }
  }
  function diagnostic(error) {
    if(error?.pathDiagnostic)return error.pathDiagnostic;
    return undefined;
  }
  return {native,mappings,resolve,aliasFree,inspect,failure,diagnostic};
}
module.exports={runtimePaths};
