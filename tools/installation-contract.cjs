'use strict';
// Producer reference predicates, serialized into the official controller. All
// trusted arguments originate in the privileged adapter, never in model claims.
function installationContract() {
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const text=x=>typeof x==='string'&&x.length>0&&x===x.trim();
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  function canonical(x){return Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;}
  const fields=['format','record_type','installation_uid','runtime_id','owner_name','owner_email'];
  const qualified=(locator,uid)=>text(locator)&&text(uid)&&locator.replaceAll('\\','/').split('/').includes(encodeURIComponent(uid));
  // These are comparisons of privileged observations, never filesystem discovery.
  function bridgePath(plan,facts) {
    const b=plan?.bridge, fail=reason=>({valid:false,reason});
    const clean=p=>text(p)&&!p.includes('\0')&&!p.replaceAll('\\','/').split('/').some(s=>s==='.'||s==='..');
    const normalize=p=>p.replaceAll('\\','/').replace(/\/+$/,'');
    const absolute=p=>p.startsWith('/')||/^[a-zA-Z]:\//.test(p);
    if(!object(b)||!clean(b.entrypoint))return fail('bridge_path_unresolved');
    if(!qualified(b.entrypoint,facts.installation_uid))return fail('bridge_location_not_uid_qualified');
    const locators=[facts.resolved_bridge_entrypoint,facts.owned_scope_locator,facts.common_scope_locator];
    if(locators.some(p=>!clean(p)||!absolute(normalize(p)))||typeof facts.filesystem_case_sensitive!=='boolean'||
      facts.paths_resolved_without_aliases!==true||facts.bridge_ownership_verified!==true)return fail('bridge_path_unresolved');
    const [resolved,owned,common]=locators.map(normalize);
    const key=p=>facts.filesystem_case_sensitive?p:p.toLowerCase();
    const within=(p,root)=>key(p)===key(root)||key(p).startsWith(key(root)+'/');
    if(key(normalize(b.entrypoint))!==key(resolved)||!qualified(resolved,facts.installation_uid)||
      !qualified(owned,facts.installation_uid))return fail('bridge_path_unresolved');
    if(within(resolved,common)||within(owned,common))return fail('bridge_location_in_common_scope');
    if(!within(resolved,owned)||key(resolved)===key(owned))return fail('bridge_location_not_owned');
    return {valid:true,reason:'resolved_owned_bridge_path'};
  }
  function configurationIdentity(plan) {
    return 'sha256:'+require('node:crypto').createHash('sha256').update(JSON.stringify(canonical(plan))).digest('hex');
  }
  function legacyIdentity(record) {
    return object(record)&&equal(Object.keys(record).sort(),[...fields].sort())&&record.format===1&&
      record.record_type==='installation_identity'&&fields.slice(2).every(k=>text(record[k]));
  }
  // A public identity is an observed credential fingerprint, never a digest of
  // secret material. Encode every UTF-8 byte without truncation or case folding.
  function machineId(auth) {
    if(!object(auth)||!text(auth.scheme)||!/^[a-z][a-z0-9-]*$/.test(auth.scheme)||!text(auth.fingerprint)||!text(auth.credential_reference))throw Error('public_identity_unresolved');
    return 'machine-'+Array.from(new TextEncoder().encode(auth.scheme+':'+auth.fingerprint),b=>b.toString(16).padStart(2,'0')).join('');
  }
  const runtimeFields=['installation_uid','runtime_id','first_installed_at','first_installation_evidence'];
  function runtimeIdentity(r) {
    return object(r)&&equal(Object.keys(r).sort(),[...runtimeFields].sort())&&text(r.installation_uid)&&text(r.runtime_id)&&
      (r.first_installed_at===null? r.first_installation_evidence==='unknown_legacy':
        text(r.first_installed_at)&&Number.isFinite(Date.parse(r.first_installed_at))&&text(r.first_installation_evidence)&&r.first_installation_evidence!=='unknown_legacy');
  }
  function identity(record) {
    try{return object(record)&&equal(Object.keys(record).sort(),['format','record_type','machine_id','authentication_identity','owner_name','owner_email','collaborator_kind','runtimes','historical_machine_ids','signing_identities'].sort())&&
      record.format===2&&record.record_type==='machine_installation'&&record.machine_id===machineId(record.authentication_identity)&&
      equal(Object.keys(record.authentication_identity).sort(),['scheme','fingerprint','credential_reference'].sort())&&
      text(record.owner_name)&&text(record.owner_email)&&['human','agentic'].includes(record.collaborator_kind)&&
      Array.isArray(record.historical_machine_ids)&&record.historical_machine_ids.every(text)&&new Set(record.historical_machine_ids).size===record.historical_machine_ids.length&&
      !record.historical_machine_ids.includes(record.machine_id)&&Array.isArray(record.signing_identities)&&record.signing_identities.every(s=>
        object(s)&&equal(Object.keys(s).sort(),['scheme','fingerprint','mapping_reference'].sort())&&Object.values(s).every(text))&&
      Array.isArray(record.runtimes)&&record.runtimes.length>0&&record.runtimes.every(runtimeIdentity)&&
      new Set(record.runtimes.map(r=>r.installation_uid)).size===record.runtimes.length;
    }catch{return false;}
  }
  const lookup=(records,uid)=>records.find(r=>r.runtimes?.some(x=>x.installation_uid===uid));
  function registry(records) {
    if(!Array.isArray(records)||!records.every(identity))return false;
    const uids=records.flatMap(r=>r.runtimes.map(x=>x.installation_uid)),ids=records.flatMap(r=>[r.machine_id,...r.historical_machine_ids]);
    return new Set(uids).size===uids.length&&new Set(ids).size===ids.length;
  }
  function owner(binding,observation) {
    if(!object(binding)||!object(observation)||observation.origin!=='authoritative_observation'||
      observation.current!==true||!text(observation.reference))return false;
    const required=['workspace','installation_uid','runtime_id','mapping_revision','checkpoint_ref','session_root','owned_scope'];
    return required.every(k=>text(binding[k])&&binding[k]===observation[k])&&
      qualified(binding.owned_scope,binding.installation_uid)&&binding.checkpoint_ref.startsWith(binding.owned_scope+'/')&&
      binding.session_root.startsWith(binding.owned_scope+'/')&&observation.continuity_verified===true;
  }
  function normalizeRevision(value,resolve) {
    if(typeof value!=='string'||typeof resolve!=='function')throw Error('revision_unresolved');
    const normalized=value.trim(),actual=resolve(normalized);
    if(!text(normalized)||actual!==normalized)throw Error('revision_incomplete_or_ambiguous');
    return normalized;
  }
  function previous(prior,B) {
    if(!text(B))throw Error('revision_unresolved');
    if(prior===null)return [];
    if(!object(prior)||!Array.isArray(prior.previous_versions_list))throw Error('explicit_history_migration_required');
    return [...prior.previous_versions_list,B];
  }
  function authorTicket(prior,desired,B,origin) {
    if(!object(desired)||!text(origin))throw Error('authoring_unresolved');
    if(prior!==null&&equal(prior,desired))return {changed:false,ticket:structuredClone(prior)};
    return {changed:true,ticket:{...structuredClone(desired),installation_uid:origin,previous_versions_list:previous(prior,B)}};
  }
  function reconstruct(id,history,B) {
    if(!text(id)||!Array.isArray(history)||!history.length||history.at(-1).revision!==B)throw Error('history_incomplete');
    const refs=[];let existed=false;
    for(let i=0;i<history.length;i++){
      const row=history[i];if(!text(row.revision)||!Object.hasOwn(row,'ticket'))throw Error('history_incomplete');
      if(row.ticket!==null&&row.ticket.id!==id)throw Error('ticket_identity_mismatch');
      if(i&&row.ticket!==null&&history[i-1].ticket===null&&existed)throw Error('recreation_requires_continuity');
      if(i&&history[i-1].ticket!==null&&row.ticket!==null&&!equal(history[i-1].ticket,row.ticket))refs.push(history[i-1].revision);
      if(row.ticket!==null)existed=true;
    }
    if(history[0].ticket!==null&&!history[0].creation_observed)throw Error('history_incomplete');
    if(history.at(-1).ticket===null)throw Error('recreation_requires_continuity');
    return [...refs,B];
  }
  function validateMutation(proposal,trusted) {
    const fail=reason=>({valid:false,reason});
    try {
      if(!object(proposal)||!object(trusted)||trusted.origin!=='authoritative_observation'||trusted.current!==true||
        !text(trusted.reference)||!text(trusted.workspace)||!text(trusted.instruction_origin_uid)||
        !text(trusted.origin_reference)||!text(trusted.executing_installation_uid)||
        (trusted.executing_installation_uid!==trusted.instruction_origin_uid&&!text(trusted.causal_reference)))return fail('origin_unresolved');
      const B=trusted.current_revision;
      if(!text(B)||proposal.expected_revision!==B||proposal.resulting_predecessor!==B)return fail('stale_or_wrong_predecessor');
      if(!registry(trusted.registry))return fail('invalid_registry');
      const registered=lookup(trusted.registry,trusted.executing_installation_uid);
      if(proposal.kind==='registry') {
        if(!registry(proposal.records))return fail('invalid_registry');
        // Initial identity enrollment precedes ticket attribution. Do not create
        // a circular requirement that the new UID already be registered.
        if(!registered&&(trusted.enrollment_authorized!==true||trusted.local_identity_verified!==true||
          !lookup(proposal.records,trusted.executing_installation_uid)))return fail('initial_enrollment_unresolved');
        if(!Array.isArray(trusted.retained_uids)||trusted.retained_uids.some(uid=>!lookup(proposal.records,uid)))return fail('referenced_identity_removed');
        if(trusted.machine_identity_verified!==true||trusted.credential_unique_to_machine!==true||!text(trusted.machine_id))return fail('machine_identity_unresolved');
        const target=proposal.records.find(r=>r.machine_id===trusted.machine_id);
        if(!target||proposal.filename!==target.machine_id+'.json'||!target.runtimes.some(r=>r.installation_uid===trusted.executing_installation_uid))return fail('machine_filename_or_membership_mismatch');
        const metadata=r=>Object.fromEntries(['machine_id','authentication_identity','owner_name','owner_email','collaborator_kind','signing_identities'].map(k=>[k,r[k]]));
        if(!equal(metadata(target),trusted.machine_metadata))return fail('machine_metadata_unresolved');
        for(const runtime of target.runtimes.filter(r=>!lookup(trusted.registry,r.installation_uid))){
          if(!equal(runtime,trusted.enrollment_records?.[runtime.installation_uid]))return fail('first_installation_evidence_unresolved');
          if(runtime.first_installed_at===null&&trusted.legacy_enrollment_verified!==true)return fail('legacy_installation_date_unresolved');
        }
        // A current writer can enroll itself, but cannot clobber a peer runtime,
        // its first-installation history, machine owner or credential continuity.
        for(const old of trusted.registry){
          const next=proposal.records.find(r=>r.machine_id===old.machine_id||r.historical_machine_ids.includes(old.machine_id));
          if(!next)return fail('machine_removed');
          if(!equal(old,next)&&next!==target)return fail('peer_machine_changed');
          if(old.historical_machine_ids.some(id=>!next.historical_machine_ids.includes(id)))return fail('machine_alias_removed');
          if(old.machine_id!==next.machine_id&&!(trusted.rotation_authorized===true&&trusted.rotation_continuity_verified===true))return fail('rotation_unresolved');
          for(const peer of old.runtimes){const r=next.runtimes.find(x=>x.installation_uid===peer.installation_uid);if(!r||!equal(peer,r))return fail('runtime_history_changed');}
          if((old.owner_name!==next.owner_name||old.owner_email!==next.owner_email||old.collaborator_kind!==next.collaborator_kind)&&trusted.owner_update_authorized!==true)return fail('owner_change_unresolved');
        }
        return {valid:true,reason:'identity_only_no_readiness'};
      }
      if(!registered)return fail('origin_not_registered');
      const prior=trusted.prior,next=proposal.ticket,id=trusted.ticket_id;
      if(!text(id)||!Array.isArray(trusted.lineage)||new Set(trusted.lineage).size!==trusted.lineage.length||
        trusted.lineage.at(-1)!==B||!object(trusted.snapshots)||!Object.hasOwn(trusted,'prior'))return fail('history_unresolved');
      if(prior!==null&&(!object(prior)||prior.id!==id||!equal(trusted.snapshots[B],prior)))return fail('prior_snapshot_mismatch');
      if(proposal.kind==='ticket_delete') {
        if(prior===null)return fail('deleted_ticket_missing');
        const lines=typeof proposal.message==='string'?proposal.message.split(/\r?\n/).filter(x=>/^Installation-UID\s*:/i.test(x)):[];
        const field=proposal.deletion_event;
        if(proposal.backend==='commit_message'){
          if(lines.length!==1||lines[0]!=='Installation-UID: '+trusted.executing_installation_uid)return fail('deletion_origin_mismatch');
        }else if(!object(field)||field.installation_uid!==trusted.executing_installation_uid||field.ticket_id!==id||
          field.previous_revision!==B||trusted.deletion_mapping_verified!==true)return fail('deletion_origin_mismatch');
        if(trusted.deletion_authorized!==true||trusted.retention_verified!==true)return fail('deletion_authority_or_retention_missing');
        return {valid:true,reason:'attributable_deletion'};
      }
      if(!['ticket_create','ticket_update'].includes(proposal.kind)||!object(next)||next.id!==id||
        next.installation_uid!==trusted.executing_installation_uid)return fail('ticket_origin_mismatch');
      if(prior===null&&(proposal.kind!=='ticket_create'||trusted.never_existed!==true))return fail('recreation_requires_continuity');
      if(prior!==null&&proposal.kind!=='ticket_update')return fail('existing_ticket_not_creation');
      let expected;
      if(prior!==null&&!Array.isArray(prior.previous_versions_list)){
        if(proposal.migration!==true||trusted.history_complete!==true)return fail('explicit_history_migration_required');
        expected=reconstruct(id,trusted.history,B);
        // Backfill must not silently change lifecycle, attribution or business data.
        const omit=t=>Object.fromEntries(Object.entries(t).filter(([k])=>!['installation_uid','previous_versions_list'].includes(k)));
        if(!equal(omit(prior),omit(next)))return fail('migration_changed_existing_facts');
      }else expected=previous(prior,B);
      if(!equal(next.previous_versions_list,expected)||new Set(expected).size!==expected.length)return fail('incorrect_previous_versions');
      let position=-1;
      for(const rev of expected){
        const n=trusted.lineage.indexOf(rev),snapshot=trusted.snapshots[rev];
        if(!text(rev)||n<=position||!object(snapshot)||snapshot.id!==id)return fail('unretrievable_or_unordered_snapshot');
        position=n;
      }
      const oldEvents=prior?.history??[],events=next.history??[];
      if(!Array.isArray(oldEvents)||!Array.isArray(events)||events.length<oldEvents.length||
        !equal(events.slice(0,oldEvents.length),oldEvents)||events.slice(oldEvents.length).some(e=>!object(e)||e.installation_uid!==trusted.executing_installation_uid))return fail('historical_attribution_changed');
      return {valid:true,reason:'exact_previous_state_and_origin'};
    }catch{return fail('history_or_mutation_unresolved');}
  }
  function validateConfiguration(plan,facts) {
    const fail=reason=>({valid:false,reason});
    if(!object(plan)||!object(facts)||facts.origin!=='authoritative_observation'||facts.current!==true||!text(facts.reference)||
      !text(facts.host)||!text(facts.runtime_version)||!text(facts.installation_uid)||!text(facts.workspace)||
      !Array.isArray(facts.official_sources)||!facts.official_sources.length||facts.official_sources.some(s=>
        !object(s)||!text(s.source)||!text(s.section)||!Number.isFinite(Date.parse(s.reviewed_at))||s.host!==facts.host||s.runtime_version!==facts.runtime_version)||
      !text(plan.expected_revision)||!text(facts.configuration_revision)||plan.expected_revision!==facts.configuration_revision)return fail('documentation_or_configuration_revision_unresolved');
    const b=plan.bridge;
    const location=bridgePath(plan,facts);if(!location.valid)return location;
    if(!Array.isArray(facts.native_shells)||!facts.native_shells.includes(b.language)||facts.native_support_verified!==true)return fail('bridge_shell_not_native_for_host');
    if(b.implementation_language!==b.language||b.delegated_bridge_logic!==false)return fail('bridge_language_not_host_native');
    if(!text(facts.native_extensions?.[b.language])||!/^[a-z0-9]+$/.test(facts.native_extensions[b.language])||
      b.entrypoint.replaceAll('\\','/').split('/').at(-1)!=='oop-enforce-bridge.'+facts.native_extensions[b.language])return fail('bridge_filename_noncanonical');
    if(b.host!==facts.host||
      b.installation_uid!==facts.installation_uid||b.workspace!==facts.workspace||b.active!==true||
      b.policy_authority!=='official_controller'||b.profile_independent!==true||b.cwd_independent!==true||
      b.failure_semantics!=='fail_closed'||facts.native_support_verified!==true)return fail('single_native_bridge_required');
    if(!Array.isArray(plan.routes)||!plan.routes.length||plan.routes.some(r=>r.entrypoint!==b.entrypoint||r.host!==facts.host||r.installation_uid!==facts.installation_uid))return fail('bridge_bypass');
    if(!Array.isArray(plan.elements)||!plan.elements.length||!Array.isArray(facts.supported_elements)||!Array.isArray(facts.required_elements)||
      !Array.isArray(facts.host_overrides)||!Array.isArray(facts.required_sources)||!facts.required_sources.length||!Array.isArray(plan.sources)||
      !object(facts.element_types)||typeof facts.narrow_scope_sufficient!=='boolean')return fail('documented_minimum_unresolved');
    const ids=plan.elements.map(e=>e.id);
    if(new Set(ids).size!==ids.length||plan.elements.some(e=>!facts.supported_elements.includes(e.id)||!text(e.necessity)||
      !['string','boolean','number','object'].includes(facts.element_types[e.id])||typeof e.value!==facts.element_types[e.id]||e.value===null||
      !['activation','routing','control','isolation','approval','recovery','observability'].includes(e.purpose)||
      !['installation','workspace','user','global','system'].includes(e.scope)||
      (['user','global','system'].includes(e.scope)&&(!text(e.wider_scope_necessity)||facts.narrow_scope_sufficient===true))))return fail('unsupported_or_unnecessary_configuration');
    if([...facts.required_elements,...facts.host_overrides].some(id=>!ids.includes(id)))return fail('required_base_or_host_override_missing');
    if(!equal([...plan.sources].sort(),[...facts.required_sources].sort())||new Set(plan.sources).size!==plan.sources.length)return fail('duplicate_or_missing_registration_source');
    if(facts.unrelated_content_preserved!==true||facts.stale_write_rejected!==true||facts.supported_administrative_review!==true||
      facts.replacement_recoverable!==true||facts.approval_dependencies_reconciled!==true||facts.active_duplicates_absent!==true)return fail('unsafe_configuration_replacement');
    return {valid:true,reason:'administrative_configuration_only',dispatch_verified:false,
      validation_binding:{plan_identity:configurationIdentity(plan),observation_identity:configurationIdentity(facts),configuration_revision:facts.configuration_revision,
        host:facts.host,installation_uid:facts.installation_uid,workspace:facts.workspace,observation_reference:facts.reference}};
  }
  function migrateIdentity(legacy,identityRecord,checkpointRef,expectedRevision,classifications={}) {
    // Legacy reduction remains a read/recovery helper, never a current writer.
    if(!legacyIdentity(identityRecord)||!object(legacy)||!text(checkpointRef)||!text(expectedRevision))throw Error('migration_unresolved');
    if(legacy.installation_uid&&legacy.installation_uid!==identityRecord.installation_uid)throw Error('installation_identity_conflict');
    const knownTechnical=['workspace_id','installation_status','installed_enforcement','bootstrap_complete','recorded_at',
      'original_installation_completed_at','authority','protocol','ownership','administrative_facts','assurance','historical_facts',
      'final_publication','synthetic_hook_trials','previous_completed_installation','migration'];
    const pending=[],organizational=[];
    for(const key of Object.keys(legacy).filter(k=>!fields.includes(k))){
      const disposition=classifications[key];
      if(disposition?.kind==='organizational'&&text(disposition.canonical_reference)&&text(disposition.evidence))organizational.push({field:key,...structuredClone(disposition)});
      else if(!(knownTechnical.includes(key)||(disposition?.kind==='technical'&&text(disposition.evidence))))pending.push(key);
    }
    return {identity:structuredClone(identityRecord),local_snapshot:{record_type:'historical_technical_snapshot',
      authoritative_checkpoint_ref:checkpointRef,current_adoption_authority:false,source_revision:expectedRevision,
      values:structuredClone(legacy),freshness:'historical_only'},organizational_preservation:organizational,pending_classification:pending,
      ready_for_registry_publication:false,journal:{phase:'prepared',expected_revision:expectedRevision,
      installation_uid:identityRecord.installation_uid,checkpoint_ref:checkpointRef,next:'preserve_verify_then_conditionally_publish_identity'}};
  }
  // The backend must implement the conditional transaction; the validation pass
  // is repeated inside that boundary against newly read authoritative facts.
  async function publishMutation(proposal,backend) {
    if(typeof backend?.conditional!=='function'||typeof backend?.readback!=='function')return {verified:false,pending:structuredClone(proposal),reason:'conditional_backend_unavailable'};
    let committed,validationCompleted=false;
    try {
      committed=await backend.conditional(proposal.expected_revision,async trusted=>{
        if(trusted?.authority_verified!==true||trusted.destination_verified!==true||trusted.signing_verified_or_inapplicable!==true||
          trusted.local_mode_verified!==true||trusted.bridge_maintenance_mode!=='normal'||
          !text(trusted.publication_identity_reference)||!text(proposal.destination)||proposal.destination!==trusted.publication_destination)throw Error('publication_authority_unresolved');
        const result=validateMutation(proposal,trusted);
        if(!result.valid)throw Error(result.reason);
        validationCompleted=true;
        return structuredClone(proposal);
      });
      if(!validationCompleted||!committed||committed.predecessor!==proposal.expected_revision||!text(committed.revision))throw Error('publication_unresolved');
      const actual=await backend.readback(committed.revision);
      if(!equal(actual,proposal))return {verified:false,committed,pending:structuredClone(proposal),reason:'canonical_readback_mismatch'};
      return {verified:true,committed,reason:'canonical_content_observed'};
    }catch{return {verified:false,...(committed?{committed}:{}),pending:structuredClone(proposal),reason:'publication_pending_reconciliation'};}
  }
  function migrateMachine(records,target,observation){
    if(!Array.isArray(records)||!records.every(legacyIdentity)||!identity(target)||observation?.origin!=='authoritative_observation'||
      observation.current!==true||observation.machine_identity_verified!==true||observation.credential_unique_to_machine!==true||
      observation.local_preservation_verified!==true||!text(observation.reference)||!text(observation.expected_revision)||
      !records.every(r=>observation.uid_machine_mapping?.[r.installation_uid]===target.machine_id&&target.runtimes.some(x=>x.installation_uid===r.installation_uid&&x.runtime_id===r.runtime_id)))throw Error('machine_migration_unresolved');
    return {record:structuredClone(target),filename:target.machine_id+'.json',expected_revision:observation.expected_revision,
      checkpoint_action:'preserve_independent_runtime_checkpoints',ticket_action:'preserve_existing_bytes',ready_for_publication:false};
  }
  // This predicate is meaningful only inside an independent native boundary.
  // The adapter reads the local declaration even when the caller omits the lane.
  function maintenance(request,observation){
    const deny=reason=>({decision:'deny',reason});
    const c=request?.context,m=request?.bridge_maintenance,o=observation;
    if(!object(c)||!['project','installation_uid','machine_id','checkpoint_ref','checkpoint_revision','mapping_revision','revision','authority','action_scope'].every(k=>text(c[k]))||
      !object(o)||o.origin!=='authoritative_observation'||o.current!==true||!text(o.reference)||
      !['normal','maintenance','recovering'].includes(o.mode)||o.project!==c.project||o.runtime_uid!==c.installation_uid||
      o.machine_id!==c.machine_id||o.checkpoint_ref!==c.checkpoint_ref||o.checkpoint_revision!==c.checkpoint_revision||o.expected_revision!==c.revision||
      o.mapping_revision!==c.mapping_revision||o.authority!==c.authority||o.request_id!==request.request_id||
      o.action_scope!==c.action_scope||!equal(o.dependencies,c.dependencies)||
      !Number.isFinite(Date.parse(c.observed_at))||!(Date.parse(o.observed_at)<=Date.parse(c.observed_at)&&Date.parse(c.observed_at)<Date.parse(o.expires_at)))return {decision:'unknown',reason:'maintenance_state_unresolved'};
    if(o.mode==='normal'&&!m)return {decision:'normal'};
    if(!object(m)||!['enter','edit','exit','recover','read'].includes(m.action))return deny('bridge_maintenance_confines_effects');
    if(!qualified(o.owned_scope,c.installation_uid)||!text(o.bridge_path)||!text(o.native_extension)||!/^[a-z0-9]+$/.test(o.native_extension)||
      o.bridge_path!==o.owned_scope+'/oop-enforce-bridge.'+o.native_extension||o.declaration_path!==o.owned_scope+'/bridge-maintenance.json'||
      o.declaration_owned!==true||o.exclusive_update_verified!==true||o.independent_boundary_verified!==true||o.native_extension_verified!==true||
      o.paths_resolved_without_aliases!==true||o.peer_state_preserved!==true||o.authorized_repair!==true||o.install_13_14_eligible!==true)return deny('maintenance_confinement_unverified');
    if(m.expected_revision!==o.declaration_revision||m.bridge_path!==o.bridge_path||o.declaration_machine_id!==c.machine_id||o.declaration_runtime_uid!==c.installation_uid)return deny('maintenance_binding_mismatch');
    if(m.action==='enter'&&(o.mode!=='normal'||o.safe_active_or_independent_repair_entry!==true))return deny('maintenance_entry_unresolved');
    if(m.action!=='enter'&&o.mode==='normal')return deny('maintenance_not_active');
    const allowed=[o.bridge_path,o.declaration_path];
    if(o.candidate_path===o.owned_scope+'/oop-enforce-bridge.'+o.native_extension+'.candidate')allowed.push(o.candidate_path);
    if(!Array.isArray(o.actual_effects)||!o.actual_effects.length||o.actual_effects.some(e=>!object(e)||
      !['read','write','atomic_replace'].includes(e.kind)||!allowed.includes(e.path)||e.resolved_path!==e.path||e.links_absent!==true)||
      o.network_effects_absent!==true||o.git_effects_absent!==true||o.unlisted_effects_absent!==true)return deny('maintenance_effect_outside_bridge');
    if(m.action==='read'&&o.actual_effects.some(e=>e.kind!=='read'))return deny('maintenance_read_only');
    if(['enter','exit'].includes(m.action)&&!o.actual_effects.some(e=>e.path===o.declaration_path&&['write','atomic_replace'].includes(e.kind)))return deny('maintenance_declaration_transition_missing');
    if(m.action==='exit'&&(o.artifact_reconciled!==true||o.administrative_configuration_reconciled!==true||
      o.native_consent_and_restart_resolved!==true||o.real_errors_absent!==true||o.checkpoint_reference_reconciled!==true))return deny('maintenance_exit_unresolved');
    return {decision:'allow',reason:'confined_bridge_maintenance',next_mode:m.action==='exit'?'normal':m.action==='read'?o.mode:'maintenance',
      state_write:'adapter_CAS_local_declaration_only',installation_certification:false};
  }
  return {identity,legacyIdentity,machineId,runtimeIdentity,lookup,registry,owner,normalizeRevision,previous,authorTicket,reconstruct,bridgePath,configurationIdentity,validateMutation,validateConfiguration,migrateIdentity,migrateMachine,maintenance,publishMutation};
}
module.exports={installationContract,...installationContract()};
