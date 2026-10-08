'use strict';
// Shared structural contracts. Valid records are attributed declarations, not authenticated consent or effect evidence.
function knowledgeWorkflow(){
  const {createHash}=process.getBuiltinModule('node:crypto');
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),text=v=>typeof v==='string'&&!!v.trim(),id=v=>text(v)&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
  const list=v=>Array.isArray(v),unique=v=>list(v)&&new Set(v).size===v.length;
  const ordered=v=>list(v)?v.map(ordered):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
  const identity=v=>'sha256:'+createHash('sha256').update(JSON.stringify(ordered(v))).digest('hex');
  const date=v=>text(v)&&Number.isFinite(Date.parse(v));
  const only=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
  const versions=Object.freeze({declaration:1,profile:2,index:2,record:2,plan:1,authorization:1});
  const planFields=['format','id','version','work_item','objective','interpretation','perspectives','profiles','scoped_entries','draft_profiles','steps','effects','decisions','candidate_concepts','research','state','validation'];
  const recordFields=['format','work_item','classification','domains','scopes','work_state','input_coverage','events','decisions','profiles','missing_domains','gaps','profile_changes','evaluations','next_action','updated_at','installation_uid','plan','plan_history','incorporations','publications','schema_ref'];
  const planIdentity=p=>identity(Object.fromEntries(Object.entries(p??{}).filter(([k])=>!['state','validation'].includes(k))));
  function provenanceErrors(p,publication){
    const errors=schemaErrors(p,'provenance');
    if(!only(p,['kind','plans','research','legacy_refs'])||!['validated_plan','legacy_import','draft_research'].includes(p?.kind)||!list(p?.plans)||!list(p?.research)||!list(p?.legacy_refs))return ['provenance'];
    if(p.kind==='validated_plan'&&!p.plans.length)errors.push('provenance.plans');
    if(p.kind==='legacy_import'&&!p.legacy_refs.length)errors.push('provenance.legacy_refs');
    if(publication==='published'&&p.kind==='draft_research')errors.push('provenance.unvalidated_draft');
    for(const a of p.plans)if(!only(a,['work_item','plan_id','version','identity','validation_ref','validated_at','concept_ids'])||!id(a.work_item)||!id(a.plan_id)||!Number.isSafeInteger(a.version)||a.version<1||!/^sha256:[a-f0-9]{64}$/.test(a.identity)||!text(a.validation_ref)||!date(a.validated_at)||!unique(a.concept_ids)||!a.concept_ids.every(id))errors.push('provenance.plan');
    for(const r of p.research)if(!only(r,['locator','observed_at','part','class'])||!text(r.locator)||!date(r.observed_at)||!text(r.part)||!['standard','primary','reference_practice','inspiration'].includes(r.class))errors.push('provenance.research');
    if(p.legacy_refs.some(r=>!text(r)))errors.push('provenance.legacy_refs');
    return errors;
  }
  function authorizationErrors(a){
    if(!only(a,['format','id','decision','granted_by','source_ref','observed_at','scope','actions','conditions','expires_at','revocation','plan_ref','native_receipts'])||a?.format!==1||!id(a?.id)||!['granted','refused','revoked','superseded'].includes(a?.decision)||!text(a?.granted_by)||!text(a?.source_ref)||!date(a?.observed_at))return ['authorization'];
    const errors=schemaErrors(a,'authorization');
    if(!only(a.scope,['workspace','tool_type','installations','resources'])||!text(a.scope?.workspace)||!unique(a.scope?.installations)||!list(a.scope?.resources)||!a.scope.resources.length||a.scope.resources.some(r=>!only(r,['target','ref'])||!text(r.target)||!text(r.ref)))errors.push('authorization.scope');
    if(a.scope?.tool_type!==undefined&&!id(a.scope.tool_type)||a.scope?.installations?.some(v=>!id(v))||!unique(a.actions)||!a.actions.length||a.actions.some(v=>!id(v))||!list(a.conditions)||a.conditions.some(v=>!text(v)))errors.push('authorization.actions');
    if(!(a.expires_at===null||date(a.expires_at))||!only(a.revocation,['status','reference'])||!['current','revoked','superseded'].includes(a.revocation?.status)||!text(a.revocation?.reference))errors.push('authorization.validity');
    if(a.plan_ref!==null&&(!only(a.plan_ref,['id','version','identity'])||!id(a.plan_ref?.id)||!Number.isSafeInteger(a.plan_ref?.version)||!/^sha256:[a-f0-9]{64}$/.test(a.plan_ref?.identity)))errors.push('authorization.plan_ref');
    if(!list(a.native_receipts)||a.native_receipts.some(r=>!only(r,['installation_uid','reference','status'])||!id(r.installation_uid)||!text(r.reference)||!['observed','pending','unavailable'].includes(r.status)))errors.push('authorization.native_receipts');
    return errors;
  }
  function applicableAuthorization(a,{workspace,installation,tool_type,action,target,ref,now=new Date().toISOString(),plan_ref=null}){
    if(authorizationErrors(a).length||a.decision!=='granted'||a.revocation.status!=='current'||a.scope.workspace!==workspace||
      a.scope.tool_type&&a.scope.tool_type!==tool_type||a.scope.installations.length&&!a.scope.installations.includes(installation)||!a.actions.includes(action)||!a.scope.resources.some(r=>r.target===target&&r.ref===ref)||a.expires_at&&Date.parse(a.expires_at)<=Date.parse(now)||a.plan_ref&&identity(a.plan_ref)!==identity(plan_ref))return false;
    // Conditions and native consent require independent observations; this predicate only selects candidates.
    return true;
  }
  function planErrors(p,{workItem,state='planning',profiles=[],scopes=[],incorporations=[],readProfile=()=>null}={}){
    const errors=[],bad=(item,code='knowledge_plan_invalid')=>errors.push({code,item});
    if(!only(p,planFields)||p?.format!==1||!id(p?.id)||!Number.isSafeInteger(p?.version)||p.version<1||p.work_item!==workItem||!text(p?.objective)||!['draft','presented','validated','superseded'].includes(p?.state))return [{code:'knowledge_plan_missing',item:'plan'}];
    for(const key of planFields.filter(k=>!['validation','research'].includes(k)))if(!Object.hasOwn(p,key))bad('plan.'+key);
    for(const key of ['interpretation','profiles','scoped_entries','draft_profiles','steps','effects','decisions','candidate_concepts'])if(!list(p[key])||p[key].length>128)bad('plan.'+key);
    if(errors.length)return errors;
    for(const item of schemaErrors(p,'plan'))bad(item);
    if(errors.length)return errors;
    if(p.candidate_concepts.length||p.draft_profiles.length){
      const r=p.research;
      if(!r||r.status==='performed'&&(!r.sources_read.length||r.exemption!==undefined)||r.status==='exempt'&&(!r.exemption||r.exemption.code==='sources_inaccessible'&&!r.unavailable.length))bad('plan.research');
    }
    if(errors.length)return errors;
    const lead=p.perspectives?.lead,consulted=p.perspectives?.consultations;
    const perspective=v=>only(v,['profile','revision','steps','conclusions','findings'])&&id(v.profile)&&Number.isSafeInteger(v.revision)&&v.revision>0&&unique(v.steps)&&v.steps.every(id)&&list(v.conclusions)&&v.conclusions.every(text)&&list(v.findings)&&v.findings.every(f=>only(f,['id','statement','resolution','decision_ref'])&&id(f.id)&&text(f.statement)&&['resolved','owner_decision'].includes(f.resolution)&&text(f.decision_ref));
    if(!only(p.perspectives,['lead','consultations'])||!perspective(lead)||!list(consulted)||consulted.some(v=>!perspective(v))||new Set([lead?.profile,...(consulted??[]).map(v=>v.profile)]).size!==(consulted?.length??0)+1)bad('plan.perspectives');
    const all=[lead,...(consulted??[])].filter(Boolean);
    for(const profile of profiles.filter(v=>v.disposition==='applied')){
      const view=all.find(v=>v.profile===profile.id&&(v.revision===profile.revision||p.profiles.some(r=>r.id===v.profile&&r.revision===v.revision)&&incorporations.some(i=>i.target===profile.id&&i.revision===profile.revision&&i.plan_identity===planIdentity(p))));
      if(!view||!p.profiles.some(r=>r.id===view.profile&&r.revision===view.revision)||profile.steps.some(s=>!view.steps.includes(s.step_id)&&!p.candidate_concepts.some(c=>c.target.id===profile.id&&c.target.step_id===s.step_id&&incorporations.some(i=>i.concept_id===c.id&&i.target===profile.id&&i.revision===profile.revision&&i.plan_identity===planIdentity(p)))))bad('plan.perspective:'+profile.id);
    }
    for(const v of all)for(const f of v.findings??[])if(f.resolution==='owner_decision'&&!p.decisions.some(d=>d.id===f.decision_ref))bad('plan.conflict:'+f.id);
    for(const term of p.interpretation)if(!only(term,['term','kind','criteria','alternatives','selected_ref'])||!text(term.term)||!['criteria','choice'].includes(term.kind)||!list(term.criteria)||term.criteria.some(v=>!text(v))||!list(term.alternatives)||term.kind==='criteria'&&!term.criteria.length||term.kind==='choice'&&term.alternatives.length<2)bad('plan.interpretation');
    for(const effect of p.effects)if(!only(effect,['id','kind','action','target','reversibility','risk','verification','authorization_ref'])||!id(effect.id)||!['local','outward'].includes(effect.kind)||!text(effect.action)||!text(effect.target)||!text(effect.reversibility)||!text(effect.risk)||!text(effect.verification)||!text(effect.authorization_ref))bad('plan.effects');
    if(new Set(p.effects.map(e=>e.id)).size!==p.effects.length||new Set(p.candidate_concepts.map(c=>c.id)).size!==p.candidate_concepts.length)bad('plan.duplicate_ids');
    for(const step of p.steps)if(!only(step,['id','action','effect_refs','verification'])||!id(step.id)||!text(step.action)||!list(step.effect_refs)||step.effect_refs.some(r=>!p.effects.some(e=>e.id===r))||!text(step.verification))bad('plan.steps');
    for(const concept of p.candidate_concepts)if(!only(concept,['id','statement','domains','target'])||!id(concept.id)||!text(concept.statement)||!unique(concept.domains)||!concept.domains.length||!only(concept.target,['kind','id','from_revision','change','step_id'])||!['profile','scoped_entry'].includes(concept.target?.kind)||!id(concept.target.id)||!['add','change','remove'].includes(concept.target.change)||!id(concept.target.step_id)||!(concept.target.from_revision===null||Number.isSafeInteger(concept.target.from_revision)&&concept.target.from_revision>0))bad('plan.candidate_concepts');
    const v=p.validation;
    if(p.state==='validated'&&(!only(v,['plan_identity','source_ref','owner','observed_at','statement_en','original_ref','conditions_satisfied'])||v?.plan_identity!==planIdentity(p)||!text(v?.source_ref)||!text(v?.owner)||!date(v?.observed_at)||!text(v?.statement_en)||!text(v?.original_ref)||v?.conditions_satisfied!==true))bad('plan.validation','knowledge_plan_unvalidated');
    if(p.state!=='validated'&&v!==undefined)bad('plan.validation');
    if(['execution','in_progress','verification','completed','closed'].includes(state)){
      if(p.state!=='validated')bad('plan.validation','knowledge_plan_unvalidated');
      for(const c of p.candidate_concepts){
        const entries=incorporations.filter(i=>i.concept_id===c.id&&i.plan_identity===planIdentity(p));
        if(entries.length!==1){bad('concept:'+c.id,'knowledge_incorporation_pending');continue;}
        const i=entries[0];
        if(!text(i.publication_ref)||!text(i.readback_ref)||!date(i.observed_at)||!Number.isSafeInteger(i.revision)||i.revision<1||i.target!==c.target.id||c.target.from_revision!==null&&i.revision<=c.target.from_revision){bad('concept:'+c.id,'knowledge_incorporation_pending');continue;}
        try{
          const header=readProfile(i.target,i.revision,i.content_identity);
          const source=header?.provenance?.plans?.find(r=>r.work_item===workItem&&r.plan_id===p.id&&r.version===p.version&&r.identity===planIdentity(p)&&r.validation_ref===v?.source_ref&&r.concept_ids.includes(c.id));
          const step=header?.steps?.find(s=>s.step_id===c.target.step_id);
          if(!source||!c.domains.every(d=>header.domains.includes(d))||c.target.kind==='scoped_entry'&&!header.applies_when.some(a=>a.scopes?.some(s=>scopes.includes(s)))||c.target.change==='remove'&&step||c.target.change!=='remove'&&step?.text!==c.statement)bad('concept:'+c.id,'knowledge_incorporation_pending');
        }catch{bad('concept:'+c.id,'knowledge_incorporation_pending');}
      }
      if(incorporations.some(i=>i.plan_identity===planIdentity(p)&&!p.candidate_concepts.some(c=>c.id===i.concept_id)))bad('incorporations.unvalidated_concept');
    }
    return errors;
  }
  function contract(){
    const s={type:'string',minLength:1,maxLength:4096},i={type:'integer',minimum:1},arr=items=>({type:'array',maxItems:128,items}),obj=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
    const ref=name=>({$ref:'#/$defs/'+name}),resource=obj({id:s,revision:s});
    const defs={resource,validation:obj({plan_identity:s,source_ref:s,owner:s,observed_at:s,statement_en:s,original_ref:s,conditions_satisfied:{const:true}}),
      perspective:obj({profile:s,revision:i,steps:arr(s),conclusions:arr(s),findings:arr(obj({id:s,statement:s,resolution:{enum:['resolved','owner_decision']},decision_ref:s}))}),
      effect:obj({id:s,kind:{enum:['local','outward']},action:s,target:s,reversibility:s,risk:s,verification:s,authorization_ref:s}),
      concept:obj({id:s,statement:s,domains:arr(s),target:obj({kind:{enum:['profile','scoped_entry']},id:s,from_revision:{type:['integer','null'],minimum:1},change:{enum:['add','change','remove']},step_id:s})}),
      plan:obj({format:{const:1},id:s,version:i,work_item:s,objective:s,interpretation:arr(obj({term:s,kind:{enum:['criteria','choice']},criteria:arr(s),alternatives:arr(obj({id:s,description:s,criteria:arr(s)})),selected_ref:s},['term','kind','criteria','alternatives'])),perspectives:obj({lead:ref('perspective'),consultations:arr(ref('perspective'))}),profiles:arr(obj({id:s,revision:i,content_identity:s,publication:{enum:['draft','published']}})),scoped_entries:arr(s),draft_profiles:arr(s),steps:arr(obj({id:s,action:s,effect_refs:arr(s),verification:s})),effects:arr(ref('effect')),decisions:arr(obj({id:s,statement:s,options:arr(s),decision_ref:s})),candidate_concepts:arr(ref('concept')),research:ref('reconciliation'),state:{enum:['draft','presented','validated','superseded']},validation:ref('validation')},planFields.filter(k=>!['validation','research'].includes(k))),
      evidence:obj({reference:s,observed_at:s,profile_revision:i,step_identity:s,work_state:s,resources:arr(resource)}),
      declaration:obj({format:{const:versions.declaration},record_ref:s,record_identity:s,profiles:arr(obj({id:s,revision:i,content_identity:s,disposition:{enum:['applied','not_applicable','missing','stale','uncertain','inaccessible']},reason:s,steps:arr(obj({step_id:s,disposition:{enum:['planned','applied','not_applicable','gap']}}))},['id','revision','content_identity','disposition'])),missing_domains:arr(obj({domain:s,gap_ref:s}))},['format','record_ref','record_identity','profiles'])};
    defs.record=obj({format:{const:versions.record},work_item:s,classification:obj({level:{enum:['G2','G3','G4']},facets:arr(s)}),domains:arr(s),scopes:arr(s),work_state:obj({id:s,resources:arr(resource)}),input_coverage:arr(obj({id:s,source_ref:s,observed_at:s,basis:{enum:['native_event','runtime_declared']},status:{enum:['classified','not_retrievable']},event_refs:arr(s),reason:s},['id','source_ref','observed_at','basis','status','event_refs'])),events:arr({type:'object'}),decisions:arr(obj({id:s,statement:s,step_refs:arr(obj({profile:s,step_id:s})),none_reason:s},['id','statement'])),profiles:arr(obj({id:s,revision:i,content_identity:s,read_at:s,disposition:s,reason:s,steps:arr(obj({step_id:s,disposition:s,evidence:ref('evidence'),reason:s,gap_ref:s},['step_id','disposition']))},['id','revision','content_identity','disposition','steps'])),missing_domains:arr(obj({domain:s,gap_ref:s})),gaps:arr(obj({id:s,description:s,affected_work:s,action:{enum:['new_profile','new_revision','owner_deferral','external_dependency']},action_ref:s,resume_condition:s,status:{enum:['open','resolved']}})),profile_changes:arr(obj({id:s,from_revision:{type:['integer','null']},to_revision:i,reason:s,publication_ref:s})),evaluations:arr({type:'object'}),next_action:s,updated_at:s,installation_uid:s,plan:ref('plan'),plan_history:arr(obj({id:s,version:i,identity:s,reference:s})),incorporations:arr(obj({concept_id:s,plan_identity:s,target:s,revision:i,content_identity:s,publication_ref:s,readback_ref:s,observed_at:s})),publications:arr(obj({id:s,target:s,status:{enum:['pending','published','uncertain']},deciding_authority:s,reason:s,partial_effects:arr(s),resume_condition:s})),schema_ref:{const:'oop-knowledge-record-2'}},recordFields);
    defs.selector=obj({levels:arr({enum:['G0','G1','G2','G3','G4']}),facets:arr(s),domains:arr(s),scopes:arr(s)},[]);
    defs.step=obj({step_id:s,kind:{enum:['method','check','decision','record']},criticality:{enum:['mandatory','conditional']},condition:arr(ref('selector')),evidence_kind:{enum:['observation','command_result','simulation','measurement','document','reference']},text:s},['step_id','kind','criticality','evidence_kind','text']);
    defs.provenance=obj({kind:{enum:['validated_plan','draft_research','legacy_import']},plans:arr(obj({work_item:s,plan_id:s,version:i,identity:s,validation_ref:s,validated_at:s,concept_ids:arr(s)})),research:arr(obj({locator:s,observed_at:s,part:s,class:{enum:['standard','primary','reference_practice','inspiration']}})),legacy_refs:arr(s)});
    const predecessor=obj({id:s,revision:i});
    defs.profile=obj({format:{const:versions.profile},id:s,revision:i,domains:arr(s),applies_when:arr(ref('selector')),steps:arr(ref('step')),sources:arr(obj({locator:s,observed:s,observed_at:s})),staleness_triggers:arr(obj({kind:s,reference:s})),provenance:ref('provenance'),supersedes:predecessor,superseded_by:predecessor,publication:{enum:['draft','published','retired']}},['format','id','revision','domains','applies_when','steps','sources','staleness_triggers','provenance']);
    defs.reconciliation=obj({status:{enum:['performed','exempt']},search:s,sources_read:arr(obj({locator:s,observed_at:s,part:s})),unavailable:arr(obj({locator:s,reason:s})),differences:s,conflicts:arr(obj({owner_statement:s,source_statement:s,report_ref:s})),exemption:obj({code:{enum:['capability_unavailable','not_authorized','no_relevant_source_found','sources_inaccessible','pure_preference']},reason:s})},['status','search','sources_read','unavailable','differences','conflicts']);
    defs.event=obj({id:s,input_ref:s,kind:{enum:['decision','correction','confirmation','question','information','finding']},statement:s,source_ref:s,observed_at:s,affected_profiles:arr(s),disposition:{enum:['incorporated','scoped_decision','subject_matter','not_generalizable','deferred_by_owner']},target:obj({id:s,revision:i,step_id:s}),deliverable_ref:s,reason:s,decision_ref:s,reconciliation:ref('reconciliation')},['id','input_ref','kind','statement','source_ref','observed_at','affected_profiles']);
    defs.evaluation=obj({event_ref:s,profile_revision:i,outcome:{enum:['missing_step','wrong_step','not_applied','adequate_applied','outside_scope']},step_id:s,trigger:s,profile:s,deficient:{type:'boolean'},finding:s,gap_ref:s},['event_ref','profile_revision','outcome','trigger','profile','deficient','finding']);
    defs.record.properties.events=arr(ref('event'));defs.record.properties.evaluations=arr(ref('evaluation'));
    defs.authorization=obj({format:{const:1},id:s,decision:{enum:['granted','refused','revoked','superseded']},granted_by:s,source_ref:s,observed_at:s,scope:obj({workspace:s,tool_type:s,installations:arr(s),resources:arr(obj({target:s,ref:s}))},['workspace','installations','resources']),actions:arr(s),conditions:arr(s),expires_at:{type:['string','null']},revocation:obj({status:{enum:['current','revoked','superseded']},reference:s}),plan_ref:{anyOf:[{type:'null'},obj({id:s,version:i,identity:s})]},native_receipts:arr(obj({installation_uid:s,reference:s,status:{enum:['observed','pending','unavailable']}}))});
    defs.index=obj({format:{const:versions.index},type:{const:'oop_knowledge_index'},identity:s,domains:arr(s),profiles:arr(obj({id:s,revision:i,locator:s,content_identity:s,domains:arr(s),applies_when:arr(ref('selector')),provenance:ref('provenance'),publication:{enum:['published','unverified']},steps:arr(obj({step_id:s,criticality:{enum:['mandatory','conditional']},step_identity:s,condition:arr(ref('selector'))},['step_id','criticality','step_identity']))}))});defs.index.properties.profiles.maxItems=512;defs.index.properties.domains.maxItems=16384;
    defs.tool_instructions=obj({format:{const:1},tool_type:s,workspace_ref:s,source_ref:s,applicability:s,instructions:arr(s),authorizations:arr(ref('authorization'))});
    const requiredWhen=(field,value,required)=>({if:{properties:{[field]:{const:value}},required:[field]},then:{required}});
    defs.step.allOf=[requiredWhen('criticality','conditional',['condition'])];
    defs.plan.allOf=[requiredWhen('state','validated',['validation']),...['candidate_concepts','draft_profiles'].map(field=>({if:{properties:{[field]:{type:'array',minItems:1}},required:[field]},then:{required:['research']}}))];
    defs.record.properties.profiles.items.allOf=[requiredWhen('disposition','applied',['read_at']),...['not_applicable','missing','stale','uncertain','inaccessible'].map(v=>requiredWhen('disposition',v,['reason']))];
    defs.record.properties.profiles.items.properties.steps.items.allOf=[requiredWhen('disposition','applied',['evidence']),requiredWhen('disposition','not_applicable',['reason']),requiredWhen('disposition','gap',['gap_ref'])];
    defs.event.allOf=[...['incorporated','scoped_decision'].map(v=>requiredWhen('disposition',v,['target','reconciliation'])),requiredWhen('disposition','subject_matter',['deliverable_ref']),requiredWhen('disposition','not_generalizable',['reason']),requiredWhen('disposition','deferred_by_owner',['decision_ref'])];
    defs.record.properties.input_coverage.items.allOf=[requiredWhen('status','not_retrievable',['reason'])];
    defs.declaration.properties.profiles.maxItems=16;defs.record.properties.profiles.maxItems=128;
    defs.record.properties.events.maxItems=64;defs.record.properties.input_coverage.maxItems=64;defs.record.properties.scopes.maxItems=32;
    defs.profile.properties.sources.maxItems=64;defs.profile.properties.staleness_triggers.maxItems=64;defs.profile.properties.applies_when.maxItems=16;
    defs.declaration.properties.missing_domains.maxItems=16;defs.declaration.properties.profiles.items.properties.steps.maxItems=64;
    for(const field of ['domains','scopes'])defs.record.properties[field].maxItems=32;
    for(const field of ['plan_history','incorporations','publications'])defs.record.properties[field].maxItems=64;
    for(const array of [defs.profile.properties.domains,defs.profile.properties.applies_when,defs.profile.properties.steps,defs.record.properties.domains,defs.record.properties.work_state.properties.resources,defs.evidence.properties.resources,defs.authorization.properties.actions,defs.authorization.properties.scope.properties.resources])array.minItems=1;
    defs.profile.properties.domains.maxItems=32;defs.profile.properties.steps.maxItems=128;
    const observed='2026-01-02T00:00:00Z',examplePlan={format:1,id:'PLAN-EXAMPLE',version:1,work_item:'WI-EXAMPLE',objective:'Prepare the scoped method.',interpretation:[],perspectives:{lead:{profile:'KP-EXAMPLE',revision:1,steps:['CHECK'],conclusions:['Resolve coverage before execution.'],findings:[]},consultations:[]},profiles:[],scoped_entries:[],draft_profiles:[],steps:[],effects:[],decisions:[],candidate_concepts:[],state:'presented'};
    const exampleRecord={format:2,schema_ref:'oop-knowledge-record-2',work_item:'WI-EXAMPLE',classification:{level:'G2',facets:['managed_change']},domains:['example'],scopes:[],work_state:{id:'state-1',resources:[{id:'artifact',revision:'1'}]},input_coverage:[{id:'input-1',source_ref:'example://input',observed_at:observed,basis:'runtime_declared',status:'classified',event_refs:['event-1']}],events:[{id:'event-1',input_ref:'input-1',kind:'information',statement:'Prepare the method.',source_ref:'example://input',observed_at:observed,affected_profiles:[]}],decisions:[],profiles:[],missing_domains:[{domain:'example',gap_ref:'GAP-EXAMPLE'}],gaps:[{id:'GAP-EXAMPLE',description:'Coverage missing.',affected_work:'Dependent execution.',action:'new_profile',action_ref:'example',resume_condition:'Validated method published and read back.',status:'open'}],profile_changes:[],evaluations:[],next_action:'Prepare scoped research and present the plan.',updated_at:observed,installation_uid:'install-example',plan:examplePlan,plan_history:[],incorporations:[],publications:[]};
    return {format:1,type:'oop_knowledge_contract',versions,$defs:defs,examples:{assurance:'Illustrative preparation only, never actual authority, installed state or execution readiness. Replace references with observed facts; compute record identities over canonical indented LF serialization and plan identities over sorted compact JSON excluding state/validation.',record:exampleRecord,validation:{plan_identity:planIdentity(examplePlan),source_ref:'example://validation',owner:'example-owner',observed_at:observed,statement_en:'The identified plan is approved.',original_ref:'example://original',conditions_satisfied:true},profile:{format:2,id:'KP-EXAMPLE',revision:1,domains:['example'],applies_when:[{levels:['G2']}],steps:[{step_id:'CHECK',kind:'check',criticality:'mandatory',evidence_kind:'observation',text:'Verify the observed result.'}],sources:[],staleness_triggers:[],publication:'draft',provenance:{kind:'draft_research',plans:[],research:[],legacy_refs:[]}},authorization:{format:1,id:'AUTH-EXAMPLE',decision:'refused',granted_by:'example-owner',source_ref:'example://decision',observed_at:observed,scope:{workspace:'example://workspace',installations:['install-example'],resources:[{target:'canonical',ref:'main'}]},actions:['publish'],conditions:[],expires_at:null,revocation:{status:'current',reference:'example://current'},plan_ref:null,native_receipts:[]}},identity_basis:{record:'SHA-256 of LF-normalized canonical recursively sorted JSON values, two-space indentation and one final LF',plan:'SHA-256 of recursively sorted compact JSON excluding state and validation, no final LF',profile:'SHA-256 of complete CRLF-to-LF normalized document bytes'},validation_rules:{plan:'All required perspective steps and unresolved decisions are linked. Execution requires attributable validation of exact planIdentity and every approved concept published/read back in its pertinent target. These structural checks do not authenticate the owner or prove effects.',records:'Unknown fields fail. Applied evidence is required and resource/profile/step bound; not_applicable requires reason, gap requires gap_ref. Every input/event/evaluation/reconciliation link is checked by the shared validator. Historical mode requires explicit supported schema and closure/profile snapshots, never a current-work downgrade.',research:'New drafts or concepts require plan.research with bounded read-source records or a coded exemption; legacy_import retains actual previous source references. Only primary/standard/reference practice support mandatory factual method claims; source adequacy remains semantic.'},limits:{profiles:16,record_profiles:128,steps:128,events:64,scopes:32,resources:128}};
  }
  function schemaErrors(value,name){
    const defs=contract().$defs,errors=[];
    function check(v,s,at,report=true){
      if(s.$ref)s=defs[s.$ref.split('/').at(-1)];
      const fail=()=>{if(report)errors.push(at);return false;};
      if(!s)return fail();
      if(s.anyOf){if(!s.anyOf.some(a=>check(v,a,at,false)))return fail();return true;}
      if(Object.hasOwn(s,'const')&&v!==s.const||s.enum&&!s.enum.includes(v))return fail();
      const types=s.type===undefined?[]:Array.isArray(s.type)?s.type:[s.type];
      if(types.length&&!types.some(t=>t==='null'?v===null:t==='object'?object(v):t==='array'?list(v):t==='integer'?Number.isSafeInteger(v):typeof v===t))return fail();
      if(typeof v==='string'&&(s.minLength!==undefined&&v.length<s.minLength||s.maxLength!==undefined&&v.length>s.maxLength)||typeof v==='number'&&s.minimum!==undefined&&v<s.minimum)return fail();
      if(list(v)){if(s.minItems!==undefined&&v.length<s.minItems||s.maxItems!==undefined&&v.length>s.maxItems)return fail();for(let n=0;n<v.length;n++)if(s.items&&!check(v[n],s.items,at+'['+n+']',report)&&!report)return false;}
      if(object(v)){
        if(s.required?.some(k=>!Object.hasOwn(v,k)))return fail();
        if(s.additionalProperties===false&&Object.keys(v).some(k=>!Object.hasOwn(s.properties,k)))return fail();
        for(const [k,p]of Object.entries(s.properties??{}))if(Object.hasOwn(v,k)&&!check(v[k],p,at+'.'+k,report)&&!report)return false;
      }
      for(const a of s.allOf??[])if(a.if&&check(v,a.if,at,false)&&!check(v,a.then,at,report)&&!report)return false;
      return true;
    }
    check(value,defs[name],name);return [...new Set(errors)];
  }
  return {versions,recordFields,planFields,identity,planIdentity,provenanceErrors,authorizationErrors,applicableAuthorization,planErrors,contract,schemaErrors};
}
module.exports={knowledgeWorkflow};
