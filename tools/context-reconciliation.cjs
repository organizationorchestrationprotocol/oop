'use strict';
// Producer transaction model only. The actual backend must independently observe
// ownership, authority, native administration, concurrency and in-progress users.
// Supplied flags and passing fixtures do not authenticate those facts.
const {isDeepStrictEqual:equal}=require('node:util');
const {posix}=require('node:path');
const steps=['copy-template','dist-context','controller-read','template-comments-read','official-documentation-read','implementation'];
function validateSpecialization(template,candidate) {
  const regions=['manifest','decodeEvent'];
  const inspect=source=>{
    const found=[];
    const fixed=source.replace(/(\/\/ OOP-EDIT-BEGIN (\w+))([\s\S]*?)(\/\/ OOP-EDIT-END \2)/g,(all,start,name,body,end)=>{
      found.push({name,body});return start+'\n<implementation:'+name+'>\n'+end;
    });
    return {fixed,found};
  };
  if(typeof template!=='string'||typeof candidate!=='string')return {valid:false,reason:'invalid_source'};
  const expected=inspect(template),actual=inspect(candidate);
  if(!equal(expected.found.map(item=>item.name),regions)||!equal(actual.found.map(item=>item.name),regions)||expected.fixed!==actual.fixed)return {valid:false,reason:'fixed_scaffold_changed'};
  if(actual.found.some(item=>!item.body.trim()||item.body.includes('OOP_ADAPTER_NOT_IMPLEMENTED'))||actual.found.some((item,index)=>item.body===expected.found[index].body))return {valid:false,reason:'incomplete_regions'};
  try { new (require('node:vm').Script)(candidate); } catch { return {valid:false,reason:'invalid_syntax'}; }
  return {valid:true,reason:'bounded_specialization',assurance:'structure_and_syntax_only_not_semantic_or_installed_verification'};
}
async function reconcileContextAdapter(proposal, backend) {
  let phase='observing',activated=false;
  try {
    const before=await backend.read();
    const root=before.owned_root?.replaceAll('\\','/');
    if(!root||root.split('/').some(part=>part==='.'||part==='..')||!posix.isAbsolute(root)&&!/^\w:\//.test(root)||
        before.paths_resolved_without_aliases!==true||before.ownership_verified!==true||before.authority_verified!==true||
        before.revision!==proposal.expected_revision||!['launcher_only','descriptor_and_launcher','canonical'].includes(before.layout)||
        proposal.entry?.replaceAll('\\','/')!==root+'/oop-runtime-adapter.js')throw Error('unowned_or_stale');
    if(before.installation_chat===true&&!before.supplied_compatible_template||
        before.installation_chat!==true&&before.logic_change_eligible!==true)throw Error('lifecycle_ineligible');
    if(!Array.isArray(proposal.preparation)||!equal(proposal.preparation.map(stage=>stage.step),steps)||
        proposal.preparation.some(stage=>typeof stage.reference!=='string'||!stage.reference))throw Error('incomplete_preparation');
    const candidate=await backend.validateCandidate(proposal);
    if(candidate.valid!==true||candidate.interface!=='oop-context-1'||candidate.declarative_scaffold!==true||
        !equal(candidate.modes,['enforcement','record','snapshot','errors-read','errors-ack'])||candidate.controller_dispatch!==true)throw Error('invalid_candidate');
    phase='staging';
    const staged=await backend.stage(before.revision,proposal);
    if(!staged.revision)throw Error('stage_uncertain');
    phase='administration';
    const admin=await backend.configure(staged.revision,proposal);
    if(!admin.revision||admin.completed!==true||admin.consent_resolved!==true||admin.restart_resolved!==true||admin.real_error!==false)throw Error('administration_pending');
    phase='activation_pending_reconciliation';activated=true;
    const activation=await backend.activate(admin.revision,proposal);
    phase='activated_pending_checkpoint';
    const actual=await backend.read();
    if(actual.revision!==activation.revision||actual.active_entry!==proposal.entry||
        !Array.isArray(actual.owned_routes)||!actual.owned_routes.length||actual.owned_routes.some(route=>route.entry!==proposal.entry)||
        actual.peer_state_preserved!==true||actual.references_preserved!==true)throw Error('activation_unresolved');
    const checkpoint=await backend.checkpoint(actual.revision,{entry:proposal.entry,interface:'oop-context-1',phase:'active'});
    phase='cleanup_pending';
    if(actual.in_progress_users!==0)return {verified:true,phase,revision:checkpoint.revision,retire_deferred:true};
    await backend.retire(checkpoint.revision,{owned_only:true,preserve_referenced_history:true,inactive:true});
    return {verified:true,phase:'checkpointed',entry:proposal.entry};
  } catch {
    // The backend journal contains actual partial effects. Never roll back blindly.
    return {verified:false,phase,preserve_safe_active:!activated,reconcile_actual_state:true};
  }
}
module.exports={reconcileContextAdapter,steps,validateSpecialization};
