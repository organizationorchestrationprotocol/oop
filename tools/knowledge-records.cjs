'use strict';
const {knowledgeWorkflow}=require('./knowledge-workflow.cjs');
// Deterministic knowledge checks shared by the distributed validator and the context controller (KP-10 to KP-14).
// Structural and identity checks only; they never establish semantic adequacy or comprehension.
function knowledgeRecords() {
  const {createHash}=process.getBuiltinModule('node:crypto');
  const workflow=knowledgeWorkflow();
  const LEVELS=['G0','G1','G2','G3','G4'],GOVERNED=['G2','G3','G4'];
  const KINDS=['method','check','decision','record'],CRITICALITY=['mandatory','conditional'];
  const EVIDENCE=['observation','command_result','simulation','measurement','document','reference'];
  const PROFILE_DISPOSITIONS=['applied','not_applicable','missing','stale','uncertain','inaccessible'];
  const STEP_DISPOSITIONS=['planned','applied','not_applicable','gap'];
  const GAP_ACTIONS=['new_profile','new_revision','owner_deferral','external_dependency'],GAP_STATUS=['open','resolved'];
  const TRANSITIONS=['planning','in_progress','execution','verification','completed','closed'];
  const INDEX='oop-knowledge-index.json';
  const KEYWORDS=/\b(?:MUST|REQUIRED|SHALL|SHOULD|RECOMMENDED|MAY|OPTIONAL)\b/;
  const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(v);
  const text=(v,max=4096)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const count=v=>Number.isSafeInteger(v)&&v>=1;
  const identityValue=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
  const ids=(v,max,allowed)=>Array.isArray(v)&&v.length>=1&&v.length<=max&&new Set(v).size===v.length&&v.every(x=>id(x)&&(!allowed||allowed.includes(x)));
  const only=(v,keys)=>Object.keys(v).every(k=>keys.includes(k));
  const normalize=bytes=>(typeof bytes==='string'?bytes:Buffer.from(bytes).toString('utf8')).replace(/\r\n/g,'\n');
  const identity=bytes=>'sha256:'+createHash('sha256').update(normalize(bytes),'utf8').digest('hex');
  const ordered=value=>Array.isArray(value)?value.map(ordered):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  const canonical=value=>JSON.stringify(ordered(value),null,2)+'\n';
  function blocks(document){
    const lines=normalize(document).split('\n'),found=[],prose=[];let open=null;
    for(const line of lines){
      if(!open){const m=/^(`{3,}|~{3,})[ \t]*([^\s`~]*)[ \t]*$/.exec(line);if(m){open={fence:m[1],info:m[2],body:[]};}else prose.push(line);continue;}
      const close=line.trim();
      if(close.length>=open.fence.length&&[...close].every(c=>c===open.fence[0])){found.push({info:open.info,body:open.body.join('\n')});open=null;}
      else open.body.push(line);
    }
    return {blocks:found,unterminated:!!open,prose:prose.join('\n').replace(/`[^`\n]*`/g,'')};
  }
  function clauses(value,errors,where){
    if(!Array.isArray(value)||!value.length||value.length>16){errors.push(where);return;}
    value.forEach((clause,i)=>{
      if(!object(clause)||!only(clause,['levels','facets','domains','scopes'])||
        (clause.levels!==undefined&&!ids(clause.levels,5,LEVELS))||(clause.facets!==undefined&&!ids(clause.facets,32))||
        (clause.domains!==undefined&&!ids(clause.domains,32))||(clause.scopes!==undefined&&!ids(clause.scopes,32)))errors.push(where+'['+i+']');
    });
  }
  function validateHeader(header,{historical=false}={}){
    const errors=[];
    if(!object(header))return ['header'];
    if(!only(header,['id','revision','domains','applies_when','steps','sources','staleness_triggers','format','provenance',...(historical?['review']:[]),'supersedes','superseded_by','publication']))errors.push('header.unknown_field');
    if(header.publication!==undefined&&!['draft','published','retired'].includes(header.publication))errors.push('header.publication');
    if(!id(header.id))errors.push('header.id');
    if(!count(header.revision))errors.push('header.revision');
    if(!ids(header.domains,32))errors.push('header.domains');
    clauses(header.applies_when,errors,'header.applies_when');
    if(!Array.isArray(header.steps)||!header.steps.length||header.steps.length>128)errors.push('header.steps');
    else{
      const seen=new Set();
      header.steps.forEach((step,i)=>{
        const where='header.steps['+i+']';
        if(!object(step)||!only(step,['step_id','kind','criticality','condition','evidence_kind','text'])){errors.push(where);return;}
        if(!id(step.step_id)||seen.has(step.step_id))errors.push(where+'.step_id');
        seen.add(step.step_id);
        if(!KINDS.includes(step.kind))errors.push(where+'.kind');
        if(!CRITICALITY.includes(step.criticality))errors.push(where+'.criticality');
        if(step.criticality==='conditional')clauses(step.condition,errors,where+'.condition');
        else if(step.condition!==undefined)errors.push(where+'.condition');
        if(!EVIDENCE.includes(step.evidence_kind))errors.push(where+'.evidence_kind');
        if(!text(step.text))errors.push(where+'.text');
      });
    }
    if(!Array.isArray(header.sources)||header.sources.length>64||header.sources.some(s=>!object(s)||!only(s,['locator','observed','observed_at'])||
      !text(s.locator,1024)||!text(s.observed,256)||!text(s.observed_at,64)))errors.push('header.sources');
    if(!Array.isArray(header.staleness_triggers)||header.staleness_triggers.length>64||
      header.staleness_triggers.some(t=>!object(t)||!only(t,['kind','reference'])||!id(t.kind)||!text(t.reference,1024)))errors.push('header.staleness_triggers');
    if(!historical){if(header.format!==workflow.versions.profile)errors.push('header.format');errors.push(...workflow.schemaErrors(header,'profile'),...workflow.provenanceErrors(header.provenance,header.publication));}
    const review=header.review;
    if(historical&&(!object(review)||!only(review,['status','reviewer','date','reason'])||!id(review.status)||!text(review.reviewer,256)||!text(review.date,64)||!text(review.reason,1024)))errors.push('header.review');
    for(const key of ['supersedes','superseded_by'])if(header[key]!==undefined&&(!object(header[key])||!only(header[key],['id','revision'])||!id(header[key].id)||!count(header[key].revision)))errors.push('header.'+key);
    if(header.supersedes?.id===header.id&&header.supersedes.revision>=header.revision)errors.push('header.supersedes');
    return errors;
  }
  function parseProfile(document,options={}){
    const parsed=blocks(document);
    if(parsed.unterminated)return {errors:['profile.unterminated_block']};
    const first=parsed.blocks[0];
    if(!first||first.info!=='oop-profile')return {errors:['profile.header_missing']};
    if(parsed.blocks.filter(b=>b.info==='oop-profile').length!==1)return {errors:['profile.header_duplicate']};
    let header;try{header=JSON.parse(first.body);}catch{return {errors:['profile.header_json']};}
    const errors=validateHeader(header,options);
    if(KEYWORDS.test(parsed.prose))errors.push('profile.prose_requirement_keyword');
    return {header,errors,content_identity:identity(document)};
  }
  function entry(locator,header,document){
    return {id:header.id,revision:header.revision,locator,content_identity:identity(document),domains:[...header.domains].sort(),
      applies_when:header.applies_when,...(header.provenance?{provenance:header.provenance,publication:header.publication??'unverified'}:{review:header.review}),steps:header.steps.map(s=>({step_id:s.step_id,criticality:s.criticality,step_identity:stepIdentity(header,s),...(s.condition?{condition:s.condition}:{})}))};
  }
  const stepIdentity=(header,step)=>identity(canonical({step,domains:header.domains,applies_when:header.applies_when,sources:header.sources}));
  const inputReference=(chat,turn)=>'input-'+identity(chat+'\0'+turn).slice(7);
  function deriveIndex(profiles,options={}){
    const errors=[],entries=[],superseded=new Set();
    for(const {locator,document} of profiles){
      const parsed=parseProfile(document,options);
      if(parsed.errors.length){errors.push(...parsed.errors.map(item=>({code:'knowledge_profile_invalid',item:locator+':'+item})));continue;}
      if(['draft','retired'].includes(parsed.header.publication)||parsed.header.superseded_by)continue;
      if(parsed.header.supersedes)superseded.add(parsed.header.supersedes.id+'@'+parsed.header.supersedes.revision);
      entries.push(entry(locator,parsed.header,document));
    }
    // A published successor retires the indexed predecessor by reference, without changing immutable old bytes.
    if(!options.historical)for(let n=entries.length-1;n>=0;n--)if(superseded.has(entries[n].id+'@'+entries[n].revision))entries.splice(n,1);
    entries.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    entries.forEach((e,i)=>{if(i&&entries[i-1].id===e.id)errors.push({code:'knowledge_profile_invalid',item:e.locator+':duplicate_id'});});
    const domains=[...new Set(entries.flatMap(e=>e.domains))].sort();
    return {errors,index:{format:options.historical?1:workflow.versions.index,type:'oop_knowledge_index',identity:'sha256 of LF-normalized complete profile bytes',domains,profiles:entries}};
  }
  function validLocator(v){return text(v,512)&&!/^[\\/]|^[a-zA-Z]:|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(v);}
  function validateIndex(index){
    if(workflow.schemaErrors(index,'index').length)return false;
    if(!object(index)||index.format!==workflow.versions.index||index.type!=='oop_knowledge_index'||!Array.isArray(index.domains)||!Array.isArray(index.profiles)||index.profiles.length>512)return false;
    return index.profiles.every(e=>object(e)&&id(e.id)&&count(e.revision)&&validLocator(e.locator)&&identityValue(e.content_identity)&&ids(e.domains,32)&&
      Array.isArray(e.applies_when)&&object(e.provenance)&&!workflow.provenanceErrors(e.provenance).length&&Array.isArray(e.steps)&&e.steps.every(s=>object(s)&&id(s.step_id)&&identityValue(s.step_identity)&&CRITICALITY.includes(s.criticality)))&&
      index.domains.every(id);
  }
  const emptyIndex=()=>({format:workflow.versions.index,type:'oop_knowledge_index',identity:'sha256 of LF-normalized complete profile bytes',domains:[],profiles:[]});
  const intersects=(a,b)=>a.some(x=>b.includes(x));
  function matches(clause,ctx){
    return (!clause.levels||clause.levels.includes(ctx.level))&&(!clause.facets||intersects(clause.facets,ctx.facets))&&(!clause.domains||intersects(clause.domains,ctx.domains))&&(!clause.scopes||intersects(clause.scopes,ctx.scopes??[]));
  }
  function applicable(index,ctx){
    return index.profiles.filter(e=>intersects(e.domains,ctx.domains)&&e.applies_when.some(c=>matches(c,ctx)));
  }
  function requiredSteps(e,ctx){
    return e.steps.filter(s=>s.criticality==='mandatory'||(s.condition??[]).some(c=>matches(c,ctx))).map(s=>s.step_id);
  }
  function declarationShape(knowledge){
    if(workflow.schemaErrors(knowledge,'declaration').length)return false;
    if(!object(knowledge)||!only(knowledge,['format','record_ref','record_identity','profiles','missing_domains'])||knowledge.format!==workflow.versions.declaration||!validLocator(knowledge.record_ref)||!identityValue(knowledge.record_identity)||!Array.isArray(knowledge.profiles)||knowledge.profiles.length>16)return false;
    if(knowledge.missing_domains!==undefined&&(!Array.isArray(knowledge.missing_domains)||knowledge.missing_domains.length>16||
      knowledge.missing_domains.some(m=>!object(m)||!only(m,['domain','gap_ref'])||!id(m.domain)||!id(m.gap_ref))))return false;
    const seen=new Set();
    return knowledge.profiles.every(p=>{
      if(!object(p)||!only(p,['id','revision','content_identity','disposition','reason','steps'])||!id(p.id)||seen.has(p.id)||
        !count(p.revision)||!identityValue(p.content_identity)||!PROFILE_DISPOSITIONS.includes(p.disposition)||
        (p.disposition!=='applied'&&!text(p.reason,512))||(p.reason!==undefined&&!text(p.reason,512)))return false;
      seen.add(p.id);
      if(p.steps===undefined)return true;
      const steps=new Set();
      return Array.isArray(p.steps)&&p.steps.length<=64&&p.steps.every(s=>{
        const ok=object(s)&&only(s,['step_id','disposition'])&&id(s.step_id)&&!steps.has(s.step_id)&&STEP_DISPOSITIONS.includes(s.disposition);
        steps.add(s?.step_id);return ok;
      });
    });
  }
  // Shared checks for a declared profile list against the derived index and actual profile bytes.
  function compare({index,ctx,profiles,missingDomains,readProfile,gate,historical=false}){
    const failures={knowledge_domain_unknown:[],knowledge_profile_missing_declaration:[],knowledge_identity_mismatch:[],knowledge_step_incomplete:[]};
    const vocabulary=new Set(index.domains),covered=new Set((missingDomains??[]).map(m=>m.domain));
    for(const domain of ctx.domains)if(!vocabulary.has(domain)&&!covered.has(domain))failures.knowledge_domain_unknown.push(domain);
    const declared=new Map(profiles.map(p=>[p.id,p])),byId=new Map(index.profiles.map(e=>[e.id,e]));
    const pending=[];
    for(const e of applicable(index,ctx))if(!declared.has(e.id))failures.knowledge_profile_missing_declaration.push(e.id+'@'+e.revision);
    for(const p of profiles){
      const e=byId.get(p.id);
      if(!e||e.revision!==p.revision||e.content_identity!==p.content_identity){failures.knowledge_identity_mismatch.push(p.id+'@'+p.revision);continue;}
      if(p.disposition!=='applied')continue;
      let actual;try{actual=identity(readProfile(e.locator));}catch{actual='unreadable';}
      if(actual!==e.content_identity){failures.knowledge_identity_mismatch.push(p.id+'@'+p.revision+':'+(actual==='unreadable'?'unreadable':'index_stale'));continue;}
      const parsed=parseProfile(readProfile(e.locator),{historical});
      if(parsed.errors.length||['draft','retired'].includes(parsed.header?.publication)||parsed.header?.superseded_by||canonical(entry(e.locator,parsed.header,readProfile(e.locator)))!==canonical(e)){failures.knowledge_identity_mismatch.push(p.id+'@'+p.revision+':index_stale');continue;}
      const steps=new Map((p.steps??[]).map(s=>[s.step_id,s.disposition])),known=new Set(e.steps.map(s=>s.step_id));
      for(const s of p.steps??[])if(!known.has(s.step_id))failures.knowledge_step_incomplete.push(p.id+'#'+s.step_id+':unknown');
      for(const step of requiredSteps(e,ctx)){
        const d=steps.get(step);
        if(d===undefined||d==='planned')pending.push(p.id+'#'+step+':'+(d??'absent'));
        if((gate>=1&&d===undefined)||(gate>=2&&d==='planned'))failures.knowledge_step_incomplete.push(p.id+'#'+step+':'+(d??'absent'));
      }
    }
    return {failures,pending};
  }
  const order=['knowledge_domain_unknown','knowledge_profile_missing_declaration','knowledge_identity_mismatch','knowledge_step_incomplete','knowledge_gap_unresolved','knowledge_record_invalid','knowledge_record_missing','knowledge_index_stale'];
  const remedies={
    knowledge_plan_missing:'Create the proportionate versioned plan before the next governed transition.',
    knowledge_plan_invalid:'Correct the identified plan fields against the transmitted knowledge contract.',
    knowledge_plan_unvalidated:'Obtain attributable validation of this exact plan version before dependent execution; retain independent host controls.',
    knowledge_incorporation_pending:'Publish and read back only the validated candidate concepts in their pertinent immutable revisions before dependent execution.',
    knowledge_index_incompatible:'Reconcile relevant profile formats and regenerate the derived index under current authority before dependent work.',
    knowledge_index_stale:'Regenerate the derived index with index --write under current authority, verify index --check, then reconcile the current record.',
    knowledge_record_mismatch:'Resolve the actual canonical work item and declare its current knowledge record identity and matching fields.',
    knowledge_input_missing:'Classify the current controller-provided input reference in input_coverage before dependent work.',
    knowledge_event_pending:'Resolve the listed event dispositions and their exact affected-profile evaluations.',
    knowledge_evidence_stale:'Reassess the listed step against current profile semantics and relevant resource revisions, then record renewed evidence.',
    knowledge_declaration_missing:'Declare work_item, domains and knowledge for this governed state; a facet alone is not knowledge evidence.',
    knowledge_domain_unknown:'Record each listed domain in missing_domains with a gap whose action is new_profile, or declare indexed domains only.',
    knowledge_profile_missing_declaration:'Declare every listed applicable profile, or record it as not_applicable with a reason.',
    knowledge_identity_mismatch:'Read the complete current profile, declare its indexed revision and content identity, and regenerate the derived index when profiles changed.',
    knowledge_step_incomplete:'Record a disposition for every listed required step that the target state requires; remove unknown step identifiers.',
    knowledge_gap_unresolved:'Resolve each listed open gap, or record an owner deferral decision or a tracked external dependency with a resume condition.',
    knowledge_record_invalid:'Correct each listed field to the KP-12 knowledge record shape.',
    knowledge_record_missing:'Add exactly one KP-12 knowledge record; free-text mentions do not substitute.',
    knowledge_index_stale:'Regenerate the derived knowledge index from the current profile headers and publish it with the profiles.'};
  function verifyDeclaration({index,knowledge,ctx,state,readProfile,record,expectedInput,installation,workItem}){
    ctx={...ctx,scopes:record?.scopes??[]};
    const gate={planning:0,execution:1,verification:2}[state];
    const {failures,pending}=compare({index,ctx,profiles:knowledge.profiles,missingDomains:knowledge.missing_domains,readProfile,gate});
    const code=order.find(key=>failures[key]?.length);
    const summary={profiles:knowledge.profiles.map(p=>({id:p.id,revision:p.revision,disposition:p.disposition})).slice(0,16),pending:pending.slice(0,16)};
    if(!code){
      if(!object(record)||!Array.isArray(record.profiles)||record.profiles.some(p=>!object(p)||!Array.isArray(p.steps)||p.steps.some(s=>!object(s)))||identity(canonical(record))!==knowledge.record_identity||record.installation_uid!==installation||canonical(record.classification)!==canonical({level:ctx.level,facets:ctx.facets})||canonical(record.domains)!==canonical(ctx.domains)||canonical(record.profiles.map(p=>({id:p.id,revision:p.revision,content_identity:p.content_identity,disposition:p.disposition,...(p.reason?{reason:p.reason}:{}),steps:p.steps.map(s=>({step_id:s.step_id,disposition:s.disposition}))})))!==canonical(knowledge.profiles)||canonical(record.missing_domains)!==canonical(knowledge.missing_domains??[]))return {status:'rejected',code:'knowledge_record_mismatch',items:['knowledge'],remedy:remedies.knowledge_record_mismatch,...summary};
      if(record.work_item!==workItem)return {status:'rejected',code:'knowledge_record_mismatch',items:['work_item'],remedy:remedies.knowledge_record_mismatch,...summary};
      if(!record.input_coverage?.some(input=>input.id===expectedInput&&input.status==='classified'))return {status:'rejected',code:'knowledge_input_missing',items:[expectedInput],remedy:remedies.knowledge_input_missing,...summary};
      const errors=validateRecord(record,index,state,readProfile);
      if(errors.length)return {status:'rejected',code:errors[0].code,items:errors.slice(0,32).map(e=>e.code+':'+e.item),remedy:remedies[errors[0].code],...summary};
      return {status:'verified',...summary,record_ref:knowledge.record_ref,record_identity:knowledge.record_identity};
    }
    const items=Object.entries(failures).flatMap(([key,values])=>values.map(item=>key+':'+item)).slice(0,32);
    return {status:'rejected',code,items,remedy:remedies[code],...summary};
  }
  function validateEvents(record,index,transition,errors,bad){
    const list=(value,name,max=64)=>{if(!Array.isArray(value)||value.length>max){bad(name);return [];}return value;};
    const inputs=list(record.input_coverage,'input_coverage'),events=list(record.events,'events'),evaluations=Array.isArray(record.evaluations)?record.evaluations:[];
    const unique=(rows,name)=>{const seen=new Set();for(const row of rows){if(!object(row)||!id(row.id)||seen.has(row.id))bad(name+'.id');seen.add(row?.id);}};
    unique(inputs,'input_coverage');unique(events,'events');
    for(const input of inputs){
      if(!object(input)||!only(input,['id','source_ref','observed_at','basis','status','event_refs','reason'])||!text(input.source_ref,1024)||!Number.isFinite(Date.parse(input.observed_at))||!['native_event','runtime_declared'].includes(input.basis)||!['classified','not_retrievable'].includes(input.status)||!Array.isArray(input.event_refs)||input.event_refs.length>64||new Set(input.event_refs).size!==input.event_refs.length||input.event_refs.some(ref=>!id(ref))){bad('input_coverage');continue;}
      if(input.status==='not_retrievable'&&(!text(input.reason,1024)||input.event_refs.length))bad('input_coverage.not_retrievable');
      if(input.status==='classified'&&(!input.event_refs.length||input.event_refs.some(ref=>!events.some(e=>e?.id===ref&&e.input_ref===input.id))))bad('input_coverage.event_refs');
    }
    const pending=item=>errors.push({code:'knowledge_event_pending',item});
    for(const event of events){
      if(!object(event)||!only(event,['id','input_ref','kind','statement','source_ref','observed_at','affected_profiles','disposition','target','reason','decision_ref','deliverable_ref','reconciliation'])||!id(event.input_ref)||!['decision','correction','confirmation','question','information','finding'].includes(event.kind)||!text(event.statement,2048)||!text(event.source_ref,1024)||!Number.isFinite(Date.parse(event.observed_at))||!Array.isArray(event.affected_profiles)||event.affected_profiles.length>16||new Set(event.affected_profiles).size!==event.affected_profiles.length||event.affected_profiles.some(p=>!id(p)||!record.profiles?.some(declared=>declared?.id===p))){bad('events');continue;}
      if(!inputs.some(input=>input?.id===event.input_ref&&input.status==='classified'&&input.event_refs?.includes(event.id)))bad('events.input_ref');
      if(['decision','correction','finding'].includes(event.kind)){
        if(!['incorporated','scoped_decision','subject_matter','not_generalizable','deferred_by_owner'].includes(event.disposition))pending(event.id+':disposition');
        if(['incorporated','scoped_decision'].includes(event.disposition)){
          const target=event.target,profile=index.profiles.find(p=>p.id===target?.id);
          const applicableTarget=profile&&profile.domains.some(d=>record.domains?.includes(d))&&profile.applies_when.some(c=>matches(c,{...record.classification,domains:record.domains??[],scopes:record.scopes??[]}));
          if(!object(target)||!only(target,['id','revision','step_id'])||profile?.revision!==target.revision||!profile.steps.some(s=>s.step_id===target.step_id)||!applicableTarget||!record.profiles?.some(p=>p?.id===target.id&&p.disposition==='applied'))pending(event.id+':target');
          validateReconciliation(event.reconciliation,event.id,errors,bad);
        }
        if(event.disposition==='subject_matter'&&(event.kind!=='decision'||!text(event.deliverable_ref,1024)))bad('events.deliverable_ref');
        if(event.disposition==='not_generalizable'&&!text(event.reason,1024))bad('events.reason');
        if(event.disposition==='deferred_by_owner'&&!text(event.decision_ref,1024))bad('events.decision_ref');
      }else if(event.disposition!==undefined)bad('events.disposition');
      if(event.kind==='correction'){
        if(!event.affected_profiles.length&&!text(event.reason,1024))bad('events.affected_profiles');
        for(const profile of event.affected_profiles){
          const matching=evaluations.filter(e=>e?.event_ref===event.id&&e.profile===profile);
          if(matching.length!==1){pending(event.id+':evaluation:'+profile);continue;}
          const evaluation=matching[0];
          if(evaluation.deficient&&event.disposition==='not_generalizable')pending(event.id+':deficient');
          if(evaluation.deficient){
            const gap=record.gaps?.find(g=>g?.id===evaluation.gap_ref),declared=record.profiles?.find(p=>p?.id===profile);
            if(gap?.status==='resolved'&&(!declared||declared.revision<=evaluation.profile_revision||!record.profile_changes?.some(change=>change?.id===profile&&change.from_revision===evaluation.profile_revision&&change.to_revision===declared.revision&&text(change.publication_ref))))pending(event.id+':revision_publication');
            if(gap?.status==='open'&&['execution','in_progress','verification','completed','closed'].includes(transition)&&declared?.disposition==='applied')pending(event.id+':revision');
          }
          if(evaluation.outcome==='not_applied'){
            const step=record.profiles?.find(p=>p?.id===profile)?.steps?.find(s=>s?.step_id===evaluation.step_id);
            if(!id(evaluation.step_id)||!step||!['planned','applied'].includes(step.disposition))bad('evaluations.step_id');
            else if(['verification','completed','closed'].includes(transition)&&(step.disposition!=='applied'||Date.parse(step.evidence?.observed_at)<Date.parse(event.observed_at)))pending(event.id+':reapplication');
          }
        }
      }
    }
    const pairs=new Set();
    for(const e of evaluations){if(!object(e))continue;const key=e.event_ref+'\0'+e.profile;if(pairs.has(key)||!events.some(event=>event?.id===e.event_ref&&event.affected_profiles?.includes(e.profile)))bad('evaluations.event_ref');pairs.add(key);}
    const decisions=list(record.decisions,'decisions');unique(decisions,'decisions');
    for(const decision of decisions){
      if(!object(decision)||!only(decision,['id','statement','step_refs','none_reason'])||!text(decision.statement,2048)||!Array.isArray(decision.step_refs)||decision.step_refs.length>64||(!decision.step_refs.length&&!text(decision.none_reason,1024))||decision.step_refs.some(ref=>!object(ref)||!only(ref,['profile','step_id'])||!record.profiles?.some(p=>p?.id===ref.profile&&p.steps?.some(s=>s?.step_id===ref.step_id))))bad('decisions');
    }
  }
  function validateReconciliation(r,eventId,errors,bad){
    const strings=(rows,keys)=>Array.isArray(rows)&&rows.length<=32&&rows.every(row=>object(row)&&only(row,keys)&&keys.every(key=>text(row[key],2048)));
    if(!object(r)||!only(r,['status','search','sources_read','unavailable','differences','conflicts','exemption'])||!['performed','exempt'].includes(r.status)||!text(r.search,2048)||!strings(r.sources_read,['locator','observed_at','part'])||r.sources_read.some(source=>!Number.isFinite(Date.parse(source.observed_at)))||!strings(r.unavailable,['locator','reason'])||!text(r.differences,2048)||!strings(r.conflicts,['owner_statement','source_statement','report_ref'])){bad('events.'+eventId+'.reconciliation');return;}
    if(r.status==='performed'&&(!r.sources_read.length||r.exemption!==undefined))bad('events.'+eventId+'.sources_read');
    if(r.status==='exempt'&&(!object(r.exemption)||!only(r.exemption,['code','reason'])||!['capability_unavailable','not_authorized','no_relevant_source_found','sources_inaccessible','pure_preference'].includes(r.exemption.code)||!text(r.exemption.reason,1024)||(r.exemption.code==='sources_inaccessible'&&!r.unavailable.length)))bad('events.'+eventId+'.exemption');
  }
  function validateRecord(record,index,transition,readProfile,{historical=false}={}){
    const errors=[],bad=item=>errors.push({code:'knowledge_record_invalid',item});
    if(!object(record))return [{code:'knowledge_record_missing',item:'knowledge'}];
    const fields=historical?workflow.recordFields.filter(k=>!['plan','plan_history','incorporations','publications','schema_ref'].includes(k)):workflow.recordFields;
    for(const key of Object.keys(record))if(!fields.includes(key))bad(key);
    for(const key of fields)if(!Object.hasOwn(record,key))bad(key);
    if(record.format!==(historical?1:workflow.versions.record))bad('format');
    if(!historical){
      for(const item of workflow.schemaErrors(record,'record'))bad(item);
      if(record.schema_ref!=='oop-knowledge-record-2')bad('schema_ref');
      for(const field of ['plan_history','incorporations','publications'])if(!Array.isArray(record[field])||record[field].length>64)bad(field);
      if(!errors.length)errors.push(...workflow.planErrors(record.plan,{workItem:record.work_item,state:transition,profiles:record.profiles??[],scopes:record.scopes??[],incorporations:record.incorporations,readProfile:(id,revision,content)=>{const e=index.profiles.find(v=>v.id===id&&v.revision===revision&&v.content_identity===content);if(!e)throw Error('unknown_profile');const p=parseProfile(readProfile(e.locator));if(p.errors.length||p.content_identity!==content||['draft','retired'].includes(p.header.publication)||p.header.superseded_by)throw Error('unpublished_profile');return p.header;}}));
    }
    if(!id(record.work_item))bad('work_item');
    if(!Array.isArray(record.scopes)||record.scopes.length>32||new Set(record.scopes).size!==record.scopes.length||record.scopes.some(s=>!id(s)))bad('scopes');
    const resources=record.work_state?.resources;
    if(!object(record.work_state)||!only(record.work_state,['id','resources'])||!id(record.work_state.id)||!Array.isArray(resources)||!resources.length||resources.length>128||resources.some(r=>!object(r)||!only(r,['id','revision'])||!id(r.id)||!text(r.revision,256))||new Set(resources.map(r=>r.id)).size!==resources.length)bad('work_state');
    const c=record.classification;
    if(!object(c)||!only(c,['level','facets'])||!LEVELS.includes(c.level)||!Array.isArray(c.facets)||c.facets.some(f=>!id(f)))bad('classification');
    if(!ids(record.domains,32))bad('domains');
    if(!text(record.next_action,2048))bad('next_action');
    if(!text(record.updated_at,64)||!Number.isFinite(Date.parse(record.updated_at)))bad('updated_at');
    if(!id(record.installation_uid))bad('installation_uid');
    const gaps=Array.isArray(record.gaps)?record.gaps:(bad('gaps'),[]);
    const gapIds=new Set();
    gaps.forEach((g,i)=>{
      if(!object(g)||!only(g,['id','description','affected_work','action','action_ref','resume_condition','status'])||!id(g.id)||gapIds.has(g.id)||
        !text(g.description)||!text(g.affected_work)||!GAP_ACTIONS.includes(g.action)||!text(g.action_ref,512)||!text(g.resume_condition)||!GAP_STATUS.includes(g.status))bad('gaps['+i+']');
      gapIds.add(g?.id);
    });
    const gapById=new Map(gaps.filter(object).map(g=>[g.id,g]));
    const missing=Array.isArray(record.missing_domains)?record.missing_domains:(bad('missing_domains'),[]);
    missing.forEach((m,i)=>{if(!object(m)||!only(m,['domain','gap_ref'])||!id(m.domain)||gapById.get(m.gap_ref)?.action!=='new_profile')bad('missing_domains['+i+']');});
    const profiles=Array.isArray(record.profiles)?record.profiles:(bad('profiles'),[]);
    const seen=new Set();
    profiles.forEach((p,i)=>{
      const where='profiles['+i+']';
      if(!object(p)||!only(p,['id','revision','content_identity','read_at','disposition','reason','steps'])||!id(p.id)||seen.has(p.id)||!count(p.revision)||
        !identityValue(p.content_identity)||!PROFILE_DISPOSITIONS.includes(p.disposition)){bad(where);return;}
      seen.add(p.id);
      if(p.disposition==='applied'&&(!text(p.read_at,64)||!Number.isFinite(Date.parse(p.read_at))))bad(where+'.read_at');
      if(p.disposition!=='applied'&&!text(p.reason,1024))bad(where+'.reason');
      if(['missing','stale'].includes(p.disposition)&&!gaps.some(g=>object(g)&&['new_profile','new_revision','owner_deferral'].includes(g.action)&&(g.action_ref===p.id||String(g.action_ref).startsWith(p.id+'@'))))bad(where+'.gap');
      if(!Array.isArray(p.steps)||p.steps.length>128){bad(where+'.steps');return;}
      const stepIds=new Set();
      p.steps.forEach((s,j)=>{
        const at=where+'.steps['+j+']';
        if(!object(s)||!only(s,['step_id','disposition','evidence','reason','gap_ref'])||!id(s.step_id)||stepIds.has(s.step_id)||!STEP_DISPOSITIONS.includes(s.disposition)){bad(at);return;}
        stepIds.add(s.step_id);
        if(s.disposition==='applied'){
          const e=s.evidence,definition=index.profiles.find(entry=>entry.id===p.id)?.steps.find(step=>step.step_id===s.step_id);
          if(!object(e)||!only(e,['reference','observed_at','profile_revision','step_identity','work_state','resources'])||!text(e.reference,2048)||!Number.isFinite(Date.parse(e.observed_at))||!count(e.profile_revision)||!identityValue(e.step_identity)||!id(e.work_state)||!Array.isArray(e.resources)||!e.resources.length||e.resources.length>128||e.resources.some(r=>!object(r)||!only(r,['id','revision'])||!id(r.id)||!text(r.revision,256))||new Set(e.resources.map(r=>r.id)).size!==e.resources.length)bad(at+'.evidence');
          else if(e.profile_revision!==p.revision||e.step_identity!==definition?.step_identity||e.resources.some(r=>!Array.isArray(resources)||!resources.some(current=>current.id===r.id&&current.revision===r.revision)))errors.push({code:'knowledge_evidence_stale',item:p.id+'#'+s.step_id});
        }
        if(s.disposition==='not_applicable'&&!text(s.reason,1024))bad(at+'.reason');
        if(s.disposition==='gap'&&!gapById.has(s.gap_ref))bad(at+'.gap_ref');
      });
    });
    for(const [i,change] of (Array.isArray(record.profile_changes)?record.profile_changes:(bad('profile_changes'),[])).entries())
      if(!object(change)||!only(change,['id','from_revision','to_revision','reason','publication_ref'])||!id(change.id)||
        !(change.from_revision===null||count(change.from_revision))||!count(change.to_revision)||(change.from_revision!==null&&change.to_revision<=change.from_revision)||!text(change.reason,1024)||!text(change.publication_ref,512))bad('profile_changes['+i+']');
    for(const [i,e] of (Array.isArray(record.evaluations)?record.evaluations:(bad('evaluations'),[])).entries())
      if(!object(e)||!only(e,['event_ref','profile_revision','outcome','step_id','trigger','profile','deficient','finding','gap_ref'])||!id(e.event_ref)||!count(e.profile_revision)||!['missing_step','wrong_step','not_applied','adequate_applied','outside_scope'].includes(e.outcome)||!text(e.trigger,1024)||!id(e.profile)||typeof e.deficient!=='boolean'||e.deficient!==['missing_step','wrong_step'].includes(e.outcome)||
        !text(e.finding,2048)||e.profile_revision>(profiles.find(p=>p?.id===e.profile)?.revision??0)||(e.deficient&&(gapById.get(e.gap_ref)?.action!=='new_revision'||!(gapById.get(e.gap_ref).action_ref===e.profile||gapById.get(e.gap_ref).action_ref.startsWith(e.profile+'@')))))bad('evaluations['+i+']');
    if(!errors.length)validateEvents(record,index,transition,errors,bad);
    if(errors.length||!GOVERNED.includes(c.level))return errors;
    const gate={planning:0,in_progress:1,execution:1,verification:2,completed:2,closed:2}[transition];
    const steps=profiles.map(p=>({...p,steps:p.steps.map(s=>({step_id:s.step_id,disposition:s.disposition}))}));
    const {failures}=compare({index,ctx:{level:c.level,facets:c.facets,domains:record.domains,scopes:record.scopes},profiles:steps,missingDomains:missing,readProfile,gate,historical});
    for(const key of order)for(const item of failures[key]??[])errors.push({code:key,item});
    if(gate===2&&['completed','closed'].includes(transition))for(const g of gaps)
      if(g.status==='open'&&g.action!=='owner_deferral'&&g.action!=='external_dependency')errors.push({code:'knowledge_gap_unresolved',item:g.id});
    return errors;
  }
  function extractRecord(document){
    const value=normalize(document);
    if(/^\s*\{/.test(value)){let parsed;try{parsed=JSON.parse(value);}catch{return {error:'knowledge_record_invalid'};}
      return object(parsed)&&Object.hasOwn(parsed,'knowledge')?{record:parsed.knowledge}:{error:'knowledge_record_missing'};}
    const parsed=blocks(value),found=parsed.blocks.filter(b=>b.info==='oop-knowledge');
    if(parsed.unterminated||found.length>1)return {error:'knowledge_record_invalid'};
    if(!found.length)return {error:'knowledge_record_missing'};
    try{return {record:JSON.parse(found[0].body)};}catch{return {error:'knowledge_record_invalid'};}
  }
  function remedy(code){return remedies[code];}
  function validateHistorical(record,snapshot,transition){
    const unknown=item=>[{code:'historical_schema_unavailable',item}];
    if(!['closed','completed'].includes(transition)||!object(snapshot)||!['oop-knowledge-record-1','oop-knowledge-record-2'].includes(snapshot.schema_ref)||
      snapshot.scope_ref!==record?.work_item||!text(snapshot.closure_ref)||!Number.isFinite(Date.parse(snapshot.closed_at))||snapshot.record_identity!==identity(canonical(record))||!Array.isArray(snapshot.profiles))return unknown('closure_schema_or_identity');
    const historical=snapshot.schema_ref==='oop-knowledge-record-1';
    if(record.format!==(historical?1:2))return unknown('schema_format_mismatch');
    const derived=deriveIndex(snapshot.profiles,{historical});if(derived.errors.length)return derived.errors;
    const byLocator=new Map(snapshot.profiles.map(p=>[p.locator,p.document]));
    return validateRecord(record,derived.index,transition,locator=>{if(!byLocator.has(locator))throw Error('profile_snapshot_unavailable');return byLocator.get(locator);},{historical});
  }
  return {workflow,INDEX,TRANSITIONS,GOVERNED,identity,canonical,parseProfile,validateHeader,deriveIndex,validateIndex,emptyIndex,applicable,requiredSteps,
    declarationShape,verifyDeclaration,validateRecord,validateHistorical,extractRecord,remedy,validLocator,stepIdentity,inputReference};
}
// Offline command-line validator; it never uses the network and never mutates inputs (only `index --write` writes the derived index).
function runKnowledgeCLI(args){
  const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path');
  const k=knowledgeRecords();
  const out=(result)=>({stdout:JSON.stringify({validator:'oop-knowledge',format:1,...result})+'\n',exitCode:result.valid?0:1});
  const usage='schema | profile <file> [--previous <immutable-file>] | index <operations-root> --check|--write | work-item <operations-root> <file> --transition <'+k.TRANSITIONS.join('|')+'> [--history <closure-snapshot>]';
  const readText=file=>{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.size>1048576)throw Error('unsafe_file');return fs.readFileSync(file,'utf8');};
  function scan(root){
    const found=[],pending=[''];
    while(pending.length){
      const relative=pending.pop(),folder=path.join(root,relative);
      for(const item of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){
        const next=relative?relative+'/'+item.name:item.name;
        if(item.isSymbolicLink()||item.name==='.git')continue;
        if(item.isDirectory()){pending.push(next);continue;}
        if(!item.isFile()||next===k.INDEX)continue;
        const stat=fs.statSync(path.join(root,next));
        if(stat.size>1048576)continue;
        const document=fs.readFileSync(path.join(root,next),'utf8');
        if(/^(?:`{3,}|~{3,})[ \t]*oop-profile[ \t]*$/m.test(document))found.push({locator:next,document});
      }
    }
    return found.sort((a,b)=>a.locator<b.locator?-1:1);
  }
  function derived(root){
    const result=k.deriveIndex(scan(root)),file=path.join(root,k.INDEX);
    let stored=null;try{stored=readText(file);}catch(error){if(error.code!=='ENOENT')throw error;}
    return {...result,file,stored};
  }
  try{
    const [command,...rest]=args;
    if(command==='schema'&&!rest.length)return out({command,valid:true,contract:k.workflow.contract(),errors:[]});
    if(command==='profile'&&(rest.length===1||rest.length===3&&rest[1]==='--previous')){
      const parsed=k.parseProfile(readText(rest[0]));
      if(rest.length===3){
        const previousDocument=readText(rest[2]);let previous=k.parseProfile(previousDocument);
        if(previous.errors.length&&[undefined,1].includes(previous.header?.format))previous=k.parseProfile(previousDocument,{historical:true});
        if(previous.errors.length||previous.header?.id!==parsed.header?.id)parsed.errors.push('profile.previous');
        else if(previous.header.revision===parsed.header.revision&&previous.content_identity!==parsed.content_identity)parsed.errors.push('profile.immutable_revision');
        else if(previous.header.revision!==parsed.header.revision&&(parsed.header.revision<=previous.header.revision||parsed.header.supersedes?.id!==previous.header.id||parsed.header.supersedes?.revision!==previous.header.revision))parsed.errors.push('profile.successor');
      }
      return out({command,valid:!parsed.errors.length,id:parsed.header?.id,revision:parsed.header?.revision,content_identity:parsed.content_identity,
        errors:parsed.errors.map(item=>({code:'knowledge_profile_invalid',item}))});
    }
    if(command==='index'&&rest.length===2&&['--check','--write'].includes(rest[1])){
      const root=path.resolve(rest[0]),state=derived(root),expected=k.canonical(state.index);
      if(state.errors.length)return out({command,valid:false,profiles:state.index.profiles.length,errors:state.errors});
      if(rest[1]==='--write'){
        if(state.stored!==expected){const temporary=state.file+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,expected,{flag:'wx'});fs.renameSync(temporary,state.file);}
        return out({command,valid:true,written:state.stored!==expected,profiles:state.index.profiles.length,errors:[]});
      }
      const current=state.stored===expected||(state.stored===null&&!state.index.profiles.length);
      return out({command,valid:current,profiles:state.index.profiles.length,errors:current?[]:[{code:'knowledge_index_stale',item:k.INDEX}]});
    }
    if(command==='work-item'&&rest.length===6&&rest[2]==='--transition'&&rest[4]==='--history'){
      const document=readText(rest[1]),extracted=k.extractRecord(document);let closed=false;
      try{closed=['closed','completed'].includes(JSON.parse(document).state);}catch{/* Non-JSON archives require an independently resolved closure wrapper. */}
      const errors=extracted.error?[{code:extracted.error,item:'knowledge'}]:!closed?[{code:'historical_schema_unavailable',item:'canonical_closure'}]:k.validateHistorical(extracted.record,JSON.parse(readText(rest[5])),rest[3]);
      return out({command,transition:rest[3],valid:!errors.length,errors,assurance:'Supplied immutable closure/profile snapshots checked structurally; actual canonical closure, provenance, authority and effects require independent evidence.'});
    }
    if(command==='work-item'&&rest.length===4&&rest[2]==='--transition'&&k.TRANSITIONS.includes(rest[3])){
      const root=path.resolve(rest[0]),state=derived(root),expected=k.canonical(state.index),errors=[...state.errors];
      if(state.stored!==expected&&!(state.stored===null&&!state.index.profiles.length))errors.push({code:'knowledge_index_stale',item:k.INDEX});
      const extracted=k.extractRecord(readText(rest[1]));
      if(extracted.error)errors.push({code:extracted.error,item:'knowledge'});
      else errors.push(...k.validateRecord(extracted.record,state.index,rest[3],locator=>{
        if(!k.validLocator(locator))throw Error('unsafe_locator');return readText(path.join(root,locator));}));
      return out({command,transition:rest[3],valid:!errors.length,errors,remedies:Object.fromEntries([...new Set(errors.map(e=>e.code))].map(code=>[code,k.remedy(code)??null]))});
    }
    return out({command:command??null,valid:false,errors:[{code:'usage',item:usage}]});
  }catch(error){return out({valid:false,errors:[{code:'input_unavailable',item:String(error?.code??error?.message??'unknown')}]});}
}
if (typeof module !== 'undefined') module.exports={knowledgeRecords,runKnowledgeCLI};
