// Generated from the reviewed OOP knowledge validator.
'use strict';
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
if (typeof module !== "undefined") module.exports = {knowledgeRecords,runKnowledgeCLI};
if (typeof require === "undefined" || require.main === module) { const result = runKnowledgeCLI(process.argv.slice(2)); process.stdout.write(result.stdout); process.exitCode = result.exitCode; }
