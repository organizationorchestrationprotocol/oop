'use strict';
// Owned local guidance discovery. Neither readable instructions nor valid grants establish native permission.
function runtimeGuidance(){
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),{createHash}=process.getBuiltinModule('node:crypto');
  const identity=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
  function discover(scope,registration,authorizationErrors=()=>['authorization_contract_unavailable']){
    const root=path.dirname(scope.owned),relative=path.relative(path.join(scope.root,'.priv','tools'),root),tool=path.basename(root);
    const unavailable=(status,reason)=>({status,tool_type:tool,locator:path.join(root,'tool_dedicated_instructions.md'),reason,
      next_action:'Resolve owned guidance under the shared tool_guidance procedure; integration readiness remains unverified.'});
    if(!relative||relative.includes(path.sep)||relative==='..'||path.isAbsolute(relative)||registration.tool_type!==undefined&&registration.tool_type!==tool)return unavailable('unknown','tool_type_binding_unresolved');
    const locator=path.join(root,'tool_dedicated_instructions.md');
    try{
      const stat=fs.lstatSync(locator);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>65536||fs.realpathSync(locator)!==locator)return unavailable('invalid','unsafe_guide');
      const bytes=fs.readFileSync(locator,'utf8'),match=/^```oop-tool-instructions\r?\n([\s\S]*?)\r?\n```/m.exec(bytes);
      if(!match)return unavailable('invalid','guide_header_missing');
      const h=JSON.parse(match[1]),keys=['format','tool_type','workspace_ref','source_ref','applicability','instructions','authorizations'];
      if(Object.keys(h).some(k=>!keys.includes(k))||h.format!==1||h.tool_type!==tool||typeof h.workspace_ref!=='string'||!h.workspace_ref||typeof h.source_ref!=='string'||!h.source_ref||typeof h.applicability!=='string'||!h.applicability||!Array.isArray(h.instructions)||!h.instructions.length||h.instructions.some(x=>typeof x!=='string'||!x.trim())||!Array.isArray(h.authorizations)||bytes.includes('OOP_TOOL_NOT_CONFIGURED'))return unavailable('invalid','guide_header_invalid');
      if(h.authorizations.some(a=>authorizationErrors(a).length))return unavailable('invalid','authorization_shape');
      return {status:'available',tool_type:tool,locator,content_identity:identity(bytes),workspace_ref:h.workspace_ref,source_ref:h.source_ref,
        applicability:h.applicability,authorization_refs:h.authorizations.map(a=>({id:a.id,decision:a.decision,scope:a.scope})),
        assurance:'Owned bytes available; receiving runtime must verify workspace binding, applicability, provenance, grant scope and actual native consent before dependent reliance.'};
    }catch(error){return unavailable(error.code==='ENOENT'?'missing':'unavailable',error.code==='ENOENT'?'guide_absent':'guide_unreadable_or_invalid');}
  }
  return {discover};
}
module.exports={runtimeGuidance};
