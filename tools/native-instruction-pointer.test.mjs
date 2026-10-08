import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderNativePointer, matchesNativePointer, pointerPath, pointerTemplate, validateNativeActivationPlan} from './native-instruction-pointer.mjs';
import {supportedBaselinePointer} from './efficiency-regression.mjs';
import {pruneArtifacts} from './prune-artifacts.mjs';
const options={binding:'.priv/common/oop-binding.json',rendered:'.priv/common/runtime-instructions.rendered.md'};
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('REL-PTR-001: distributed Markdown and exact locator rendering retain every protected byte',()=>{
  assert.equal(read('dist/'+pointerPath),pointerTemplate);
  const expected=pointerTemplate.replaceAll('<binding-locator>',options.binding).replaceAll('<rendered-locator>',options.rendered);
  assert.equal(renderNativePointer(options),expected);
  assert.equal(matchesNativePointer(expected,options),true);
  assert.ok(expected.startsWith('<!-- OOP activation block: begin -->\n# OOP workspace activation\n'));
  assert.ok(expected.endsWith('<!-- OOP activation block: end -->\n'));
  for(const sentence of ['Any AI reading this file as instructions or modifying it MUST preserve','including this preservation instruction','The block MUST remain at the beginning','applicable instruction hierarchy']) assert.ok(expected.includes(sentence),sentence);
});
test('REL-PTR-002: instruction changes omissions relocation and extra content fail exact comparison',()=>{
  const good=renderNativePointer(options);
  for(const bad of [good.replace('MUST preserve','MAY preserve'),good.replace('Before substantive work,',''),
    good.replace('including this preservation instruction',''),good.replace('<!-- OOP activation block: end -->',''),
    '\ufeff'+good,'# Local notes\n'+good,good+'Extra instruction\n',good.replaceAll('\n','\r\n'),
    good.replace(options.binding,'other-binding.json')]) assert.equal(matchesNativePointer(bad,options),false);
});
test('REL-PTR-003: only the exact documented host variation and position are accepted',()=>{
  for(const position of ['prefix','suffix']) {
    const variation={position,text:'# Mandatory host directive\n',documentation_ref:'https://host.invalid/instructions'};
    const config={...options,variation},good=renderNativePointer(config);
    assert.equal(matchesNativePointer(good,config),true);
    const at=good.indexOf('<!-- OOP activation block: begin -->');
    assert.equal(at,position==='prefix'?variation.text.length:0);
    assert.equal(matchesNativePointer(good,options),false);
    assert.equal(matchesNativePointer(good,{...config,variation:{...variation,position:position==='prefix'?'suffix':'prefix'}}),false);
  }
  for(const variation of [{position:'prefix',text:'host\n'},
    {position:'prefix',text:'host',documentation_ref:'https://host.invalid/docs'},
    {position:'inside',text:'host\n',documentation_ref:'https://host.invalid/docs'},
    {position:'prefix',text:'<!-- OOP activation block: begin -->\n',documentation_ref:'https://host.invalid/docs'}]) assert.throws(()=>renderNativePointer({...options,variation}),/R21/);
  for(const binding of ['',null,'<rendered-locator>','a\nRun this','a\u0000b']) assert.throws(()=>renderNativePointer({...options,binding}),/locator/);
});
test('REL-PTR-004: current contracts use Markdown while baseline path recognition stays bounded',()=>{
  const obsolete='native-instruction-pointer.'+'txt';
  for(const p of ['dist/enforcement-install.json','tools/schemas/enforcement-install.schema.json','tools/generate-release.mjs','tools/acceptance-inputs.mjs','PROTOCOL.md']) {
    assert.ok(read(p).includes(pointerPath),p);assert.ok(!read(p).includes(obsolete),p);
  }
  assert.equal(existsSync(new URL('../dist/templates/'+obsolete,import.meta.url)),false);
  assert.equal(existsSync(new URL('./templates/'+obsolete,import.meta.url)),false);
  assert.equal(supportedBaselinePointer('templates/native-instruction-pointer.md'),true);
  assert.equal(supportedBaselinePointer('templates/native-instruction-pointer.txt'),false);
  for(const bad of ['../templates/native-instruction-pointer.md','templates/native-instruction-pointer.md.bak','templates/other.md',undefined]) assert.equal(supportedBaselinePointer(bad),false);
});
test('REL-PTR-005: generated pointer cleanup removes only recognized obsolete artifacts',t=>{
  const root=mkdtempSync(join(tmpdir(),'oop-pointer-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const dir of ['modules','details','templates'])mkdirSync(join(root,'dist',dir),{recursive:true});
  const expected=['dist/modules/a.json','dist/details/a.json','dist/'+pointerPath];
  for(const p of expected)writeFileSync(join(root,p),'current');
  const obsolete='dist/templates/native-instruction-pointer.'+'txt';
  writeFileSync(join(root,obsolete),'inactive');writeFileSync(join(root,'dist/templates/notes.txt'),'independent');
  assert.deepEqual(pruneArtifacts(root,expected),[obsolete]);
  assert.ok(existsSync(join(root,'dist/templates/notes.txt')));
  assert.deepEqual(pruneArtifacts(root,expected),[]);
});
test('REL-PTR-006: initial pointer contract needs no fabricated migration and rendering remains exact',()=>{
  const index=JSON.parse(read('dist/migrations/index.json'));
  assert.equal(index.scopes.runtime.disposition,'not_required');assert.equal(index.step.from,null);
  assert.equal(existsSync(new URL('../dist/migrations/runtime.json',import.meta.url)),false);
  const recovered=renderNativePointer(options); // Candidate preparation only; no host writes.
  assert.equal(matchesNativePointer(recovered,options),true);
  assert.equal(matchesNativePointer(recovered.replace('MUST preserve','MAY preserve'),options),false);
});

function activationScenario() {
  const environment='environment-b@1',content=renderNativePointer(options);
  const target='/workspace/INSTRUCTIONS.md';
  const workspace={root:'/workspace',resolved_root:'/workspace',case_sensitive:true,resolution_verified:true};
  const requirements=[{id:'workspace-entry',necessary:true,documentation_ref:'https://host.invalid/project',reason:'Discover this project binding at entry.',
    local_alternatives:[{target,resolved_target:target,resolution_verified:true,supported:true,sufficient:true,primary:true,reason:'Documented primary project entry.'}]}];
  const mechanisms=[{id:'project-instructions',kind:'file',target,resolved_target:target,resolution_verified:true,scope:'workspace',scope_verified:true,
    requirements:['workspace-entry'],delivery_key:'project-entry',supported:true,applicable:true,documentation_ref:'https://host.invalid/project'}];
  const state={environment,effective:true,administrative_complete:true,consent_resolved:true,restart_resolved:true,content};
  return {environment,workspace,requirements,locators:options,mechanisms,integrations:[],plan:[{...state,mechanism:mechanisms[0].id,target:mechanisms[0].target,action:'install',authorized:true}]};
}
const accepts=s=>validateNativeActivationPlan(s).valid;
test('REL-PTR-007: a peer pointer for a different environment cannot replace the receiving native target',()=>{
  const s=activationScenario();
  s.integrations.push({...s.plan[0],environment:'environment-a@1',mechanism:'peer-instructions',target:'instruction-a.md',owned:false,compatible:false});
  assert.equal(accepts(s),true);
  s.plan[0].action='reuse';s.plan[0].target='instruction-a.md';assert.equal(accepts(s),false);
});
test('REL-PTR-008: compatible effective shared integration is reused without a write or creator assumption',()=>{
  const s=activationScenario();s.integrations.push({...s.plan[0],owned:false,compatible:true});
  s.plan[0].action='reuse';delete s.plan[0].authorized;assert.equal(accepts(s),true);
  s.integrations[0].environment='environment-b@2';assert.equal(accepts(s),false);
});
test('REL-PTR-009: complementary native mechanisms require complete discovery coverage',()=>{
  const s=activationScenario();
  s.requirements.push({...s.requirements[0],id:'startup-discovery',reason:'Distinct necessary native startup prerequisite.'});
  s.mechanisms.push({...s.mechanisms[0],id:'startup',kind:'native',target:'startup-setting',requirements:['startup-discovery'],delivery_key:'startup-discovery'});
  assert.equal(accepts(s),false);
  s.plan.push({...s.plan[0],mechanism:'startup',target:'startup-setting',binding:options.binding,rendered:options.rendered});
  assert.equal(accepts(s),true);
  s.plan[1].binding='foreign-project';assert.equal(accepts(s),false);
});
test('REL-PTR-010: correct pointer bytes cannot waive effective loading consent or restart',()=>{
  for(const key of ['effective','administrative_complete','consent_resolved','restart_resolved']){
    const s=activationScenario();s.plan[0][key]=false;assert.equal(accepts(s),false,key);
    s.plan[0].action='blocked';s.plan[0].reason='native prerequisite pending';assert.equal(accepts(s),true,key);
  }
});
test('REL-PTR-011: unsupported unknown and irrelevant mechanisms retain precise dispositions',()=>{
  for(const [field,value,action] of [['supported',false,'unsupported'],['supported','unknown','blocked'],['applicable',false,'not_applicable'],['applicable','unknown','blocked']]){
    const s=activationScenario();s.mechanisms[0][field]=value;assert.equal(accepts(s),false);
    s.plan[0].action=action;s.plan[0].reason='documented discovery disposition';assert.equal(accepts(s),true);
    delete s.plan[0].reason;assert.equal(accepts(s),false);
  }
});
test('REL-PTR-012: complete integration excludes duplicate delivery and speculative plan entries',()=>{
  const s=activationScenario();s.mechanisms.push({...s.mechanisms[0],id:'duplicate',target:'/workspace/OTHER.md',resolved_target:'/workspace/OTHER.md'});
  s.plan.push({...s.plan[0],mechanism:'duplicate',target:'/workspace/OTHER.md'});assert.equal(accepts(s),false);
  s.mechanisms[1].delivery_key='complementary-entry';assert.equal(accepts(s),false);
  s.requirements[0].local_alternatives.push({...s.requirements[0].local_alternatives[0],target:'/workspace/OTHER.md',resolved_target:'/workspace/OTHER.md',primary:false});
  s.requirements[0].combination={mechanisms:['project-instructions','duplicate'],documentation_ref:'https://host.invalid/combination',reason:'Both declarations are mandatory for this function.'};
  assert.equal(accepts(s),true);
  s.integrations.push({...s.plan[0],target:'parallel-instruction.md',owned:false});assert.equal(accepts(s),false);
  s.integrations=[];
  s.plan.push({...s.plan[0],mechanism:'speculative'});assert.equal(accepts(s),false);
});

function setTarget(s, target, resolved = target, scope = 'external') {
  Object.assign(s.mechanisms[0], {target,resolved_target:resolved,scope});
  s.plan[0].target=target;
}
function requireExternal(s) {
  s.requirements[0].local_alternatives[0].sufficient=false;
  s.requirements[0].local_alternatives[0].reason='Official contract requires the external declaration.';
  s.mechanisms[0].external_requirement={documentation_ref:'https://host.invalid/required-external',requirement:'An external declaration is mandatory.',reason:'The workspace-only loader cannot supply this prerequisite.'};
}

test('REL-PTR-016: a sufficient primary project entry excludes a personal substitute',()=>{
  const s=activationScenario();assert.equal(accepts(s),true);
  const target='/workspace/INSTRUCTIONS.personal.md';
  s.requirements[0].local_alternatives.push({...s.requirements[0].local_alternatives[0],target,resolved_target:target,primary:false});
  setTarget(s,target,target,'workspace');
  assert.ok(validateNativeActivationPlan(s).errors.includes('primary_project_entry'));
});

test('REL-PTR-017: a supported user-folder pointer cannot replace sufficient workspace activation',()=>{
  const s=activationScenario();setTarget(s,'/users/person/.runtime/INSTRUCTIONS.md');
  assert.ok(validateNativeActivationPlan(s).errors.includes('external_necessity'));
  requireExternal(s);s.requirements[0].local_alternatives[0].sufficient=true;
  assert.equal(accepts(s),false);
});

test('REL-PTR-018: distinct role names cannot justify global plus personal duplicate pointers',()=>{
  const s=activationScenario();
  s.mechanisms.push({...s.mechanisms[0],id:'personal',target:'/workspace/INSTRUCTIONS.personal.md',resolved_target:'/workspace/INSTRUCTIONS.personal.md',delivery_key:'claimed-personal-role'});
  s.plan.push({...s.plan[0],mechanism:'personal',target:s.mechanisms[1].target});
  setTarget(s,'/users/person/.runtime/INSTRUCTIONS.md');
  const result=validateNativeActivationPlan(s);
  for(const error of ['external_necessity','primary_project_entry','duplicate_function'])assert.ok(result.errors.includes(error),error);
});

test('REL-PTR-019: a documented mandatory external prerequisite requires local insufficiency evidence',()=>{
  const s=activationScenario();setTarget(s,'/runtime-required/activation.md');requireExternal(s);
  assert.equal(accepts(s),true);
  for(const mutate of [x=>delete x.mechanisms[0].external_requirement,x=>x.mechanisms[0].external_requirement.documentation_ref='',
    x=>x.mechanisms[0].external_requirement.requirement='',x=>x.mechanisms[0].external_requirement.reason='',
    x=>x.requirements[0].local_alternatives=[]]){
    const x=structuredClone(s);mutate(x);assert.equal(accepts(x),false);
  }
});

test('REL-PTR-020: unknown local capability never authorizes an external fallback',()=>{
  const s=activationScenario();setTarget(s,'/runtime-required/activation.md');requireExternal(s);
  for(const field of ['supported','sufficient']){
    const x=structuredClone(s);x.requirements[0].local_alternatives[0][field]='unknown';assert.equal(accepts(x),false);
  }
  s.plan[0].action='blocked';s.plan[0].reason='Local capability documentation is unresolved.';assert.equal(accepts(s),true);
});

test('REL-PTR-021: resolved boundaries reject prefix collisions traversal and unverified placement',()=>{
  for(const target of ['/workspace-peer/INSTRUCTIONS.md','/workspace/../outside/INSTRUCTIONS.md']){
    const s=activationScenario();setTarget(s,target,target,'workspace');assert.ok(validateNativeActivationPlan(s).errors.includes('effective_scope'));
  }
  for(const mutate of [s=>delete s.workspace,s=>s.workspace.resolution_verified=false,s=>s.mechanisms[0].resolution_verified=false,
    s=>s.mechanisms[0].scope_verified=false,s=>s.mechanisms[0].resolved_target='relative.md',
    s=>s.requirements[0].local_alternatives[0].resolution_verified=false]){
    const s=activationScenario();mutate(s);assert.equal(accepts(s),false);
  }
});

test('REL-PTR-022: actual directory redirection cannot disguise an external target as local',t=>{
  const base=mkdtempSync(join(tmpdir(),'oop-pointer-scope-'));
  t.after(()=>rmSync(base,{recursive:true,force:true}));
  const root=join(base,'workspace'),outside=join(base,'outside');mkdirSync(root);mkdirSync(outside);
  const alias=join(root,'redirect');symlinkSync(outside,alias,process.platform==='win32'?'junction':'dir');
  const s=activationScenario();
  s.workspace={root,resolved_root:realpathSync(root),case_sensitive:process.platform!=='win32',resolution_verified:true};
  const primary=join(realpathSync(root),'INSTRUCTIONS.md');
  Object.assign(s.requirements[0].local_alternatives[0],{target:primary,resolved_target:primary});
  setTarget(s,join(alias,'INSTRUCTIONS.md'),join(realpathSync(alias),'INSTRUCTIONS.md'),'workspace');
  assert.ok(validateNativeActivationPlan(s).errors.includes('effective_scope'));
});

test('REL-PTR-023: drive and network paths use explicit case and boundary semantics',()=>{
  for(const root of ['C:\\Workspace','\\\\server\\share\\workspace']){
    const s=activationScenario();s.workspace={root,resolved_root:root,case_sensitive:false,resolution_verified:true};
    const target=root+'\\INSTRUCTIONS.md';setTarget(s,target,target.toLowerCase(),'workspace');
    Object.assign(s.requirements[0].local_alternatives[0],{target,resolved_target:target});
    assert.equal(accepts(s),true);
    s.mechanisms[0].resolved_target=root+'-other\\INSTRUCTIONS.md';assert.equal(accepts(s),false);
  }
});

test('REL-PTR-024: supported optional alternatives stay inventoried without installation',()=>{
  const s=activationScenario();s.mechanisms.push({...s.mechanisms[0],id:'personal-alternative',target:'/workspace/INSTRUCTIONS.personal.md'});
  s.plan.push({mechanism:'personal-alternative',action:'not_required',reason:'Primary project entry is sufficient.'});
  assert.equal(accepts(s),true);
  delete s.plan[1].reason;assert.equal(accepts(s),false);
  s.plan[1].reason='Primary project entry is sufficient.';s.plan[0].action='not_required';s.plan[0].reason='Omitted';assert.equal(accepts(s),false);
});

test('REL-PTR-025: canonical activation and global discovery share the documented external necessity gate',()=>{
  const source=read('PROTOCOL.md');
  for(const clause of ['Discovery of a supported mechanism MUST NOT establish its necessity',
    'A sufficient workspace-local arrangement MUST be used exclusively',
    'An external file is permitted only when applicable official runtime documentation requires that prerequisite',
    'including links, junctions and equivalent redirection','Retire misplaced or duplicate owned activation only after'])assert.ok(source.includes(clause),clause);
  assert.ok(!source.includes('Prefer local, non-canonical, non-published placement where supported'));
});

test('REL-PTR-026: an external loader alias cannot gain workspace authority from an inward link',()=>{
  const s=activationScenario();setTarget(s,'/users/person/.runtime/INSTRUCTIONS.md','/workspace/INSTRUCTIONS.md','workspace');
  assert.ok(validateNativeActivationPlan(s).errors.includes('effective_scope'));
  s.mechanisms[0].scope='external';assert.ok(validateNativeActivationPlan(s).errors.includes('external_necessity'));
});

test('REL-PTR-027: malformed function and combination declarations are rejected without throwing',()=>{
  for(const mutate of [s=>s.mechanisms[0].requirements={},s=>s.requirements[0].combination={mechanisms:{}},
    s=>s.requirements[0].local_alternatives=[null],s=>s.requirements[0].necessary=false]){
    const s=activationScenario();mutate(s);assert.equal(accepts(s),false);
  }
});

test('REL-PTR-028: a documented mandatory combination cannot be only partially selected',()=>{
  const s=activationScenario();
  s.requirements[0].combination={mechanisms:['project-instructions','required-companion'],documentation_ref:'https://host.invalid/combination',reason:'Both declarations are mandatory.'};
  assert.equal(accepts(s),false);
});

test('REL-PTR-029: existing effective duplicate functions cannot hide behind other delivery keys',()=>{
  const s=activationScenario();
  s.integrations.push({...s.plan[0],mechanism:'other-role',target:'/workspace/OTHER.md',delivery_key:'other-delivery',requirements:['workspace-entry']});
  assert.ok(validateNativeActivationPlan(s).errors.includes('duplicate_existing_function'));
  delete s.integrations[0].requirements;
  assert.ok(validateNativeActivationPlan(s).errors.includes('existing_function_reference'));
});

test('REL-PTR-030: a sufficient primary project-root entry takes precedence over an optional nested alternative',()=>{
  const s=activationScenario(),target='/workspace/.runtime/INSTRUCTIONS.md';
  s.requirements[0].local_alternatives.push({...s.requirements[0].local_alternatives[0],target,resolved_target:target});
  setTarget(s,target,target,'workspace');
  assert.ok(validateNativeActivationPlan(s).errors.includes('primary_project_entry'));
  s.requirements[0].local_alternatives[0].sufficient=false;
  s.requirements[0].local_alternatives[0].reason='The documented root entry is insufficient for this actual environment.';
  assert.equal(accepts(s),true);
});
test('REL-PTR-013: peer content and unresolved ownership are preserved under repair and installation plans',()=>{
  const s=activationScenario();s.integrations.push({...s.plan[0],owned:false,compatible:false});
  assert.equal(accepts(s),false);s.plan[0].action='repair';assert.equal(accepts(s),false);
  s.integrations[0].owned=true;assert.equal(accepts(s),true);
  s.plan[0].authorized=false;assert.equal(accepts(s),false);
});
test('REL-PTR-014: changed project references invalidate otherwise compatible native reuse',()=>{
  const s=activationScenario();s.integrations.push({...s.plan[0],owned:false,compatible:true});s.plan[0].action='reuse';
  assert.equal(accepts(s),true);s.locators={...options,binding:'different-project-binding'};assert.equal(accepts(s),false);
  s.locators=options;s.integrations[0].content+='# unrelated instructions\n';assert.equal(accepts(s),false);
});
test('REL-PTR-015: incomplete documentation discovery identities and contested targets fail closed',()=>{
  for(const mutate of [s=>s.environment='',s=>s.mechanisms=[],s=>s.mechanisms[0].documentation_ref='',
    s=>s.mechanisms.push({...s.mechanisms[0]}),s=>s.plan.push({...s.plan[0]}),
    s=>s.integrations.push({...s.plan[0]},{...s.plan[0]}),s=>s.plan[0].environment='other-environment']){
    const s=activationScenario();mutate(s);assert.equal(accepts(s),false);
  }
});
