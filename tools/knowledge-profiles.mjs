// Producer reference predicates over supplied observations, never semantic certification.
const text=x=>typeof x==='string'&&!!x.trim();
export function assessKnowledgeReadiness({level,needs,coverage,runtime,scope,capability,authority,technicalAdoption=false}={}) {
  if(!['G0','G1','G2','G3','G4'].includes(level))return {status:'unknown',dependent_work:false,gaps:['classification']};
  if(technicalAdoption===true||['G0','G1'].includes(level))return {status:'not_required',dependent_work:null,profile_creation_required:false};
  if(!Array.isArray(needs)||!needs.length||new Set(needs).size!==needs.length||!needs.every(text)||!text(runtime)||!text(scope))
    return {status:'unknown',dependent_work:false,gaps:['material_coverage']};
  if(!Array.isArray(coverage))return {status:'unknown',dependent_work:false,gaps:['coverage_observations']};
  const gaps=[];
  for(const need of needs){
    const matches=(coverage??[]).filter(x=>x.field===need);
    if(matches.length!==1){gaps.push(need+':unresolved');continue;}
    const c=matches[0];
    if(c.status!=='adequate'||c.runtime!==runtime||c.scope!==scope||c.current!==true||
      !['profile_ref','version','coverage_evidence','source_evidence','verification_evidence'].every(k=>text(c[k]))||
      c.loaded!==true||c.canonical!==true||c.readback!==true||c.access!==true)gaps.push(need+':'+(c.status??'unknown'));
    if(c.changed===true&&(!Array.isArray(c.publication_steps)||c.publication_steps.join(',')!=='validate,persist,publish,readback'))gaps.push(need+':publication');
  }
  if(capability?.runtime!==runtime||capability.current!==true||!text(capability.evidence))gaps.push('actual_capability');
  if(authority?.runtime!==runtime||authority.current!==true||!text(authority.evidence))gaps.push('independent_authority');
  return {status:gaps.length?'gaps':'ready',dependent_work:gaps.length===0,gaps,independent_preparation:'subject_to_own_authority',
    assurance:'Consistency of supplied facts only; actual semantic coverage, publication and work outcomes need independent evidence.'};
}
