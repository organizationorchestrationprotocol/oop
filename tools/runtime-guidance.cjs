'use strict';
const {runtimePaths}=require('./runtime-paths.cjs');
// Owned local guidance discovery. Neither readable instructions nor valid grants establish native permission.
function runtimeGuidance(){
  const pathPolicy=runtimePaths();
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),{createHash}=process.getBuiltinModule('node:crypto');
  const identity=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
  function discover(scope,registration,authorizationErrors=()=>['authorization_contract_unavailable']){
    const root=path.dirname(scope.owned),relative=path.relative(path.join(scope.root,'.priv','tools'),root),tool=path.basename(root);
    const unavailable=(status,reason)=>({status,tool_type:tool,locator:path.join(root,'tool_dedicated_instructions.json'),reason,
      next_action:'Resolve owned guidance under the shared tool_guidance procedure; integration readiness remains unverified.'});
    if(!relative||relative.includes(path.sep)||relative==='..'||path.isAbsolute(relative)||registration.tool_type!==undefined&&registration.tool_type!==tool)return unavailable('unknown','tool_type_binding_unresolved');
    const locator=path.join(root,'tool_dedicated_instructions.json');
    try{
      const stat=fs.lstatSync(locator);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>65536||!pathPolicy.aliasFree(locator))return unavailable('invalid','unsafe_guide');
      const bytes=fs.readFileSync(locator,'utf8');
      const stack=[];
      for(let i=0;i<bytes.length;i++){
        const ch=bytes[i];
        if(ch==='"'){
          let end=i+1;for(;end<bytes.length;end++){if(bytes[end]==='\\'){end++;continue;}if(bytes[end]==='"')break;}
          const top=stack.at(-1);if(top?.keys&&top.key){const key=JSON.parse(bytes.slice(i,end+1));if(top.keys.has(key))return unavailable('invalid','duplicate_json_field');top.keys.add(key);top.key=false;}i=end;
        }else if(ch==='{')stack.push({keys:new Set(),key:true});else if(ch==='[')stack.push({});else if(ch==='}'||ch===']')stack.pop();else if(ch===','&&stack.at(-1)?.keys)stack.at(-1).key=true;
      }
      const h=JSON.parse(bytes),keys=['format','tool_type','workspace_ref','source_ref','applicability','instructions','authorizations'];
      if(!h||typeof h!=='object'||Array.isArray(h)||Object.keys(h).some(k=>!keys.includes(k))||h.format!==1||h.tool_type!==tool||typeof h.workspace_ref!=='string'||!h.workspace_ref.trim()||h.workspace_ref.length>1024||typeof h.source_ref!=='string'||!h.source_ref.trim()||h.source_ref.length>1024||typeof h.applicability!=='string'||!h.applicability.trim()||h.applicability.length>2000||!Array.isArray(h.instructions)||!h.instructions.length||h.instructions.length>128||h.instructions.some(x=>typeof x!=='string'||!x.trim()||x.length>2000)||!Array.isArray(h.authorizations)||h.authorizations.length>32||bytes.includes('OOP_TOOL_NOT_CONFIGURED'))return unavailable('invalid','guide_header_invalid');
      if(h.authorizations.some(a=>authorizationErrors(a).length))return unavailable('invalid','authorization_shape');
      return {status:'available',tool_type:tool,locator,content_identity:identity(bytes),workspace_ref:h.workspace_ref,source_ref:h.source_ref,
        applicability:h.applicability,instructions:h.instructions,authorizations:h.authorizations.map(({native_receipts,...grant})=>({...grant,native_receipts:[]})),
        assurance:'Owned bytes available; receiving runtime must verify workspace binding, applicability, provenance, grant scope and actual native consent before dependent reliance. Native receipt evidence is withheld from this projection; resolve current consent in the receiving installation.'};
    }catch(error){return unavailable(error.code==='ENOENT'?'missing':error instanceof SyntaxError?'invalid':'unavailable',error.code==='ENOENT'?'guide_absent':'guide_unreadable_or_invalid');}
  }
  return {discover};
}
module.exports={runtimeGuidance};
