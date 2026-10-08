// Producer-only source inventory and explicit semantic-review ledger.
// Structural coverage is not semantic equivalence or installed conformance.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {protocolSource} from './acceptance-inputs.mjs';
import {closure} from './reference-engine.mjs';
import {modules,spans} from './release-plan.mjs';
import {writeEvidence} from './prune-artifacts.mjs';
const identity=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const pending=question=>({status:'not_verified',question});
const paths=[
  ['event_adaptation','delegated','tools/templates/oop-runtime-adapter.js','Actual documented host operations require a completed runtime-owned decoder; no native coverage is supplied.'],
  ['framework_observation','implemented','tools/runtime-observations.cjs','Scoped local binding/checkpoint/maintenance observations only; external authority is not acquired here.'],
  ['framework_rendering','implemented','tools/runtime-rendering.cjs','Declared rendering and diagnostic mechanism; actual native delivery/prevention is not verified.'],
  ['controller_evaluation','implemented','tools/enforcement-engine.mjs','Deterministic binding/predicate checks only; authenticated external facts and semantic residuals remain delegated.'],
  ['session_coordination','implemented','tools/runtime-coordination.cjs','Private runtime cache and local coordination; no organizational or permission authority.'],
  ['runtime_obligations','delegated','PROTOCOL.md','The active authorized runtime interprets applicable complete clauses; comprehension is not verified by this ledger.'],
  ['authoritative_systems','not_verified','tools/enforcement.md','Actual systems, supported conditional effects, independent observers and effective permissions depend on adopted scope.'],
].map(([path,status,reference,limitation])=>({path,status,reference,limitation,evidence_status:'not_verified'}));

// Every nonblank source line belongs to one exact block, including explanatory
// material. Paragraphs, individual list/table rows and fenced examples retain
// their text and exceptions. No keyword algorithm decides normative meaning.
export function sourceBlocks(source){
  const lines=source.split('\n'),blocks=[];let start=null,kind=null,fenced=false;
  const flush=end=>{if(start!==null)blocks.push({start:start+1,end:end+1,kind,text:lines.slice(start,end+1).join('\n')});start=null;kind=null;};
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^\s*```/.test(line)){if(!fenced){flush(i-1);start=i;kind='example';fenced=true;}else{fenced=false;flush(i);}continue;}
    if(fenced)continue;
    if(!line.trim()){flush(i-1);continue;}
    const next=/^#{1,6}\s/.test(line)?'heading':/^\|/.test(line)?'table_row':/^\s*(?:[-*]|\d+\.)\s/.test(line)?'list_item':/^---+$/.test(line)?'separator':'paragraph';
    if(next!=='paragraph'||kind!=='paragraph'){flush(i-1);start=i;kind=next;if(['heading','table_row','separator'].includes(next))flush(i);}
    else if(start===null){start=i;kind=next;}
  }
  flush(lines.length-1);return blocks;
}

export function buildRequirementMatrix(document){
  const source=protocolSource(document),lines=source.split('\n');let heading='Document';
  const offset=document.replaceAll('\r\n','\n').split('\n').indexOf('# Rules for the runtime');
  const routes=new Map(modules.map(m=>[m.id,{status:'candidate_module_allocation',facets:m.facets,dependency_closure:closure(modules,[m.id])}]));
  const rows=sourceBlocks(source).map(block=>{
    if(block.kind==='heading')heading=block.text;
    const span=spans.find(s=>s.start<=block.start&&s.end>=block.end);
    if(!span)throw Error('Source block crosses an unreviewed allocation boundary');
    const locator=`lines:${block.start<=2?block.start:block.start+offset}-${block.end<=2?block.end:block.end+offset}`;
    return {id:'REQ-'+identity(locator+'\n'+block.text).slice(7,27),source:{path:'PROTOCOL.md',locator,logical_start:block.start,logical_end:block.end,identity:identity(block.text)},
      contract:span.id,module:span.module,section:heading,kind:block.kind,source_text:block.text,
      // This lexical index is navigation only. Lowercase duties, contextual
      // exceptions and exclusions remain visible even without a keyword.
      keyword_index:[...new Set(block.text.match(/\b(?:MUST(?: NOT)?|SHOULD(?: NOT)?|MAY|REQUIRED|SHALL(?: NOT)?|OPTIONAL)\b/g)??[])],
      requirement_status:'not_verified',applicability:pending('Determine obligation, explicit exclusion, contextual example or not-applicable disposition and preserve its exact condition and normative force.'),
      trigger_and_condition:pending('Identify the precise semantic trigger and relevant scope for this source block.'),
      actor_and_ownership:pending('Resolve the source-qualified responsible actor and owner; a module is not an actor.'),
      state_and_preconditions:pending('Identify authoritative facts, guards and permitted transitions or effects.'),
      evidence_and_provenance:pending('Bind the obligation to independent observations, actual checks and evidence tier.'),
      routing:routes.get(span.module),
      failure_unknown_recovery:pending('Determine negative, unavailable and stale cases, dependent blocking and safe recovery.'),
      semantic_guidance:pending('Review a concise semantic summary against this complete source block and related governing context.'),
      implementation_paths:paths.map(p=>({path:p.path,applicability:'not_verified'}))};
  });
  return {format:1,scope:'maintainer_source_inventory',source_identity:identity(source),implementation_paths:paths,
    coverage:{structural:'complete',semantic:'not_verified',nonblank_lines:lines.filter(l=>l.trim()).length,rows:rows.length},
    assurance:'Exact source coverage and candidate path references only; no reviewed semantic equivalence, verified implementation, host integration or consumer adoption claim.',rows};
}
export function validateRequirementMatrix(document,matrix){
  const expected=buildRequirementMatrix(document);
  // Pending fields are deliberately explicit. An independent reviewed ledger
  // needs its own attributable review contract; flags cannot self-certify rows.
  if(JSON.stringify(expected)!==JSON.stringify(matrix))throw Error('Missing, duplicate, stale or unsupported semantic matrix row');
  return {structural:'passed',semantic:'not_verified',rows:matrix.rows.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=fileURLToPath(new URL('../',import.meta.url)),document=readFileSync(new URL('../PROTOCOL.md',import.meta.url),'utf8');
  if(process.argv.length!==3||!['--write','--check'].includes(process.argv[2]))throw Error('Use --write or --check');
  const matrix=buildRequirementMatrix(document);
  if(process.argv[2]==='--write')writeEvidence(root,[{path:'tools/evidence/requirement-matrix.json',content:JSON.stringify(matrix)+'\n'}]);
  const observed=process.argv[2]==='--check'?JSON.parse(readFileSync(new URL('./evidence/requirement-matrix.json',import.meta.url),'utf8')):matrix;
  console.log(JSON.stringify(validateRequirementMatrix(document,observed)));
}
