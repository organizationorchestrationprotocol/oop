'use strict';
// Producer-only fixture authoring. No supplied fact is authenticated by this helper.
const fs=require('node:fs'),path=require('node:path');
const k=require('../knowledge-records.cjs').knowledgeRecords();
const observed='2026-01-02T00:00:00Z';
const workflow=k.workflow;
const legacyProvenance=()=>({kind:'legacy_import',plans:[],research:[],legacy_refs:['fixture://retained-method']});
function fixturePlan(profiles,workItem){
 const perspective=p=>({profile:p.id,revision:p.revision,steps:p.steps.map(s=>s.step_id),conclusions:['Apply the declared method within its scope.'],findings:[]});
 const views=profiles.map(perspective);if(!views.length)views.push({profile:'KP-PREPARATION',revision:1,steps:[],conclusions:['No applicable profile declared.'],findings:[]});
 const plan={format:1,id:'PLAN-'+workItem,version:1,work_item:workItem,objective:'Perform the scoped fixture work.',interpretation:[],perspectives:{lead:views[0],consultations:views.slice(1)},profiles:profiles.map(p=>({id:p.id,revision:p.revision,content_identity:p.content_identity,publication:'published'})),scoped_entries:[],draft_profiles:[],steps:[],effects:[],decisions:[],candidate_concepts:[],state:'validated'};
 plan.validation={plan_identity:workflow.planIdentity(plan),source_ref:'fixture://owner-validation',owner:'fixture-owner',observed_at:observed,statement_en:'The identified fixture plan is approved.',original_ref:'fixture://original-validation',conditions_satisfied:true};return plan;
}
function currentRecord(record,index,{input='input-1',workItem='WI-1'}={}){
  record={format:2,schema_ref:'oop-knowledge-record-2',plan_history:[],incorporations:[],publications:[],work_item:workItem,scopes:[],work_state:{id:'state-1',resources:[{id:'artifact',revision:'1'}]},
    input_coverage:[{id:input,source_ref:'fixture://input',observed_at:observed,basis:'runtime_declared',status:'classified',event_refs:['input-information']}],
    events:[{id:'input-information',input_ref:input,kind:'information',statement:'Inspect the current work.',source_ref:'fixture://input',observed_at:observed,affected_profiles:[]}],decisions:[],...record};
  record.profiles=record.profiles.map(p=>({...p,read_at:p.read_at??observed,steps:(p.steps??[]).map(s=>s.disposition!=='applied'?s:{...s,evidence:typeof s.evidence==='object'?s.evidence:{reference:s.evidence??'fixture://observation',observed_at:observed,profile_revision:p.revision,step_identity:index.profiles.find(e=>e.id===p.id)?.steps.find(e=>e.step_id===s.step_id)?.step_identity??'sha256:'+'0'.repeat(64),work_state:record.work_state.id,resources:structuredClone(record.work_state.resources)}})}));
  if(!record.plan)record.plan=fixturePlan(record.profiles,workItem);
  return record;
}
function bindRecord(w,event){
  if(!event.knowledge||event.knowledge.format!==undefined)return event;
  let index;try{index=JSON.parse(fs.readFileSync(path.join(w.operations,k.INDEX),'utf8'));}catch{index=k.emptyIndex();}
  const profiles=event.knowledge.profiles.map(p=>({...p,steps:p.steps??[]}));
  const gaps=(event.knowledge.missing_domains??[]).map(m=>({id:m.gap_ref,description:'Missing domain.',affected_work:'Fixture work.',action:'new_profile',action_ref:m.domain,resume_condition:'Profile available.',status:'open'}));
  for(const p of profiles)for(const s of p.steps)if(s.disposition==='gap'){s.gap_ref='GAP-STEP';if(!gaps.some(g=>g.id===s.gap_ref))gaps.push({id:s.gap_ref,description:'External observation.',affected_work:'Fixture work.',action:'external_dependency',action_ref:'WI-DEPENDENCY',resume_condition:'Observation available.',status:'open'});}
  const record=currentRecord({classification:{level:event.level,facets:event.facets},domains:event.domains,profiles,missing_domains:event.knowledge.missing_domains??[],gaps,profile_changes:[],evaluations:[],next_action:'Inspect the result.',updated_at:observed,installation_uid:w.registration.installation_uid},index,{input:k.inputReference(event.chat,event.turn),workItem:event.work_item});
  const record_ref=event.work_item+'.json';
  fs.writeFileSync(path.join(w.operations,record_ref),JSON.stringify({id:event.work_item,state:'in_progress',knowledge:record}));
  return {...event,knowledge:{format:1,record_ref,record_identity:k.identity(k.canonical(record)),profiles:profiles.map(p=>({...p,steps:p.steps.map(s=>({step_id:s.step_id,disposition:s.disposition}))})),...(event.knowledge.missing_domains?{missing_domains:event.knowledge.missing_domains}:{})}};
}
module.exports={currentRecord,bindRecord,fixturePlan,legacyProvenance};
