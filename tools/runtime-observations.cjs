'use strict';
// Privileged embedding API: its scope is obtained from verified registration or
// the host's independently authorized bootstrap scope, never a decoded event.
function runtimeObservations() {
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path'),crypto=process.getBuiltinModule('node:crypto');
  const hash=x=>'sha256:'+crypto.createHash('sha256').update(x).digest('hex');
  function acquire(scope,{bootstrap=false,now=new Date().toISOString(),executionDirectory=null}={}){
    const diagnostics=[],observations={};
    const fail=(code,source)=>{diagnostics.push({code,source});throw Error(code);};
    const within=(p,root)=>{const r=path.relative(root,p);return r!==''&&!r.startsWith('..')&&!path.isAbsolute(r);};
    function real(p,root){
      if(typeof p!=='string'||!path.isAbsolute(p)||p.replaceAll('\\','/').split('/').some(s=>s==='.'||s==='..'))fail('path_invalid','local');
      const r=fs.realpathSync.native(p);
      if(r!==path.resolve(p)||root&&!within(r,root))fail('path_alias_or_scope','local');
      return r;
    }
    function read(file,root,label){
      try{
        const resolved=real(file,root),fd=fs.openSync(resolved,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
        try{const before=fs.fstatSync(fd);if(!before.isFile()||before.nlink!==1||before.size>262144)fail('record_kind_or_link',label);
          const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd);
          if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||fs.realpathSync.native(file)!==resolved)fail('record_changed',label);
          const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
          if(value.observed_at!==undefined&&!(Date.parse(value.observed_at)<=Date.parse(now)))fail('record_time_invalid',label);
          if(value.expires_at!==undefined&&!(Date.parse(value.observed_at)<=Date.parse(now)&&Date.parse(now)<Date.parse(value.expires_at)))fail('record_stale',label);
          observations[label]={reference:resolved,identity:hash(bytes),observed_at:now,valid_until:'dependency_change',scope:scope.installation_uid};
          return value;
        }finally{fs.closeSync(fd);}
      }catch(e){if(!diagnostics.some(d=>d.source===label))diagnostics.push({code:e.code==='ENOENT'?'record_absent':e.code==='EACCES'||e.code==='EPERM'?'record_unreadable':e instanceof SyntaxError?'record_malformed':'record_unverifiable',source:label});throw e;}
    }
    try{
      if(!Number.isFinite(Date.parse(now))||!scope?.installation_uid||!scope.machine_id||!scope.runtime_class)fail('invocation_identity_unresolved','scope');
      const project=real(scope.project_root),priv=real(scope.private_root),common=real(scope.common_scope,priv),owned=real(scope.owned_scope,priv);
      if(within(owned,common)||owned===common||!owned.split(path.sep).includes(encodeURIComponent(scope.installation_uid)))fail('ownership_topology_unresolved','scope');
      // Default private checkout layout: distribution -> checkout -> common.
      // A nondefault layout uses only the verified registration's common locator.
      if(scope.controller_locator){const controller=real(scope.controller_locator),distribution=path.dirname(controller);if(executionDirectory&&distribution!==real(executionDirectory))fail('controller_execution_mismatch','scope');const inferred=path.dirname(path.dirname(distribution));if(inferred===common)observations.topology={reference:distribution,identity:'verified-private-checkout-layout',observed_at:now,scope:scope.installation_uid,valid_until:'dependency_change'};}
      const binding=read(path.join(common,'workspace-binding.json'),common,'binding');
      if(binding.format!==1||binding.workspace!==scope.project_root||typeof binding.revision!=='string'||!Array.isArray(binding.runtimes))fail('workspace_binding_mismatch','binding');
      const candidates=binding.runtimes.filter(r=>r.installation_uid===scope.installation_uid);
      if(candidates.length!==1)fail(candidates.length?'installation_mapping_ambiguous':'installation_mapping_missing','binding');
      const mapping=candidates[0];
      if(mapping.runtime!==scope.runtime_class||mapping.owned_scope!==owned||mapping.identity_basis!=='persistent_integration'||!['active',...(bootstrap?['pending']:[])].includes(mapping.status))fail('installation_mapping_mismatch','binding');
      const checkpoint=read(mapping.checkpoint_ref,owned,'checkpoint');
      if(checkpoint.workspace!==binding.workspace||checkpoint.installation_uid!==scope.installation_uid||checkpoint.runtime!==scope.runtime_class||checkpoint.checkpoint_ref!==mapping.checkpoint_ref||checkpoint.mapping_revision!==binding.revision||!Number.isSafeInteger(checkpoint.revision)||checkpoint.revision<0||
        !['pending','installed','adopted'].includes(checkpoint.status))fail('checkpoint_binding_mismatch','checkpoint');
      if(mapping.checkpoint_revision!==undefined&&mapping.checkpoint_revision!==checkpoint.revision)fail('checkpoint_revision_mismatch','checkpoint');
      const file=path.join(owned,'oop-runtime-adapter-maintenance.json');let maintenance;
      try{fs.lstatSync(file);maintenance=read(file,owned,'maintenance');}
      catch(e){if(e.code!=='ENOENT')throw e;
        maintenance={mode:'normal',revision:'absent'};observations.maintenance={reference:file,identity:'absent-in-verified-owned-scope',observed_at:now,scope:scope.installation_uid,valid_until:'dependency_change'};}
      if(!['normal','maintenance','recovering'].includes(maintenance.mode)||maintenance.revision===undefined||maintenance.revision!=='absent'&&(maintenance.installation_uid!==scope.installation_uid||maintenance.machine_id!==scope.machine_id||maintenance.workspace!==binding.workspace))fail('maintenance_binding_mismatch','maintenance');
      // Re-read dependencies before returning; each invocation acquires fresh state.
      for(const o of Object.values(observations)){if(o.identity.startsWith('sha256:')&&(real(o.reference)!==o.reference||fs.lstatSync(o.reference).nlink!==1||hash(fs.readFileSync(o.reference))!==o.identity))fail('dependency_changed','local');if(o.identity==='absent-in-verified-owned-scope'&&fs.existsSync(o.reference))fail('dependency_changed','maintenance');}
      const dependencies=Object.fromEntries(Object.entries(observations).map(([key,o])=>[key,o.identity]));for(const o of Object.values(observations)){o.dependencies={...dependencies};o.scope={workspace:scope.project_root,installation_uid:scope.installation_uid};}
      return {status:'known',binding,mapping,checkpoint,maintenance,observations,diagnostics,observed_at:now,installation_complete:false};
    }catch(error){if(!diagnostics.length)diagnostics.push({code:error.code==='ENOENT'?'scope_absent':error.code==='EACCES'||error.code==='EPERM'?'scope_unreadable':'scope_unverifiable',source:'scope'});return {status:'unknown',observations,diagnostics,observed_at:now,installation_complete:false};}
  }
  return {acquire};
}
module.exports={runtimeObservations};
