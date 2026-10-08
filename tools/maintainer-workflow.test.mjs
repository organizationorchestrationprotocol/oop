// Bounded synthetic capture checks, NOT an implementation engine or chat interceptor.
// Assertions check supplied evidence/trace consistency, never authenticate real effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { protocolSource } from './acceptance-inputs.mjs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { validateReport } from './validate-maintainer-report.mjs';

const protocol=readFileSync(new URL('../PROTOCOL.md',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const apply=protocol.split('### APPLY\n')[1]?.split('### REPORT\n')[0];
const prepare=protocol.split('### PREPARE\n')[1]?.split('### VERIFY\n')[0];
const verify=protocol.split('### VERIFY\n')[1]?.split('### APPLY\n')[0];
const formalize=protocol.split('### FORMALIZE\n\n')[1]?.split('### PREPARE\n')[0].trimEnd()+'\n';
const directive=prepare?.match(/^> (AFTER completing.*)$/m)?.[1];
const languagePolicy='Language policy: '+readFileSync(new URL('./fixtures/language-policy.txt',import.meta.url),'utf8').replace(/\r\n/g,'\n').trimEnd()+' Inspect applicable common-private preference first after project identity, and persist resolved preferences under protected scoped shared-write rules.';
const report=`## Modifiche proposte

1. **Nessuna modifica proposta** — fixture limitata; effetti reali non verificati.

## Verdetto finale sull’impatto delle modifiche

- Modifica della fonte normativa canonica: NOT REQUIRED — nessuna proposta ulteriore.
- Rigenerazione della distribuzione derivata: NOT REQUIRED — nessuna proposta ulteriore.
- Enforcement engine impact: UNCHANGED — empty package.
`;
const payloadReport=`## Proposed Changes

1. **PROP-01 — Implement Y with K [F-01; P2; APPROVED]**
   - **Scope and artifacts:** maintainer; edit the maintainer appendix in PROTOCOL.md.
   - **Problem:** The synthetic approved workflow needs local write guidance.
   - **Before example:** Illustrative: implementation has no explicit local commit boundary.
   - **Proposed change and after example:** Implement Y with check K; APPLY checks the selected work, commits/pushes on the current local HEAD branch or a new dedicated API branch, then invokes VERIFY after successful publication.
   - **Source and distribution impact:** Canonical normative source: NOT REQUIRED — procedure only; maintainer appendix edit REQUIRED; Derived distribution regeneration: NOT REQUIRED — no runtime contract change; Enforcement engine impact: UNCHANGED — workflow capture only.
   - **Pros and cons:** Clearer bounded execution; longer maintainer instructions.

## Final Change-Impact Verdict

- Enforcement engine impact: UNCHANGED — workflow capture only.

- Canonical normative source change: NOT REQUIRED — PROP-01; procedure only.
- Derived distribution regeneration: NOT REQUIRED — PROP-01; appendix excluded.
`;
const originals=[
  {id:'analysis',status:'supporting',text:'## Analisi originale\n\n| Caso | Vincolo |\n| --- | --- |\n| Locale | Nessun commit |\n\n### Dettaglio\n\n1. Proposta articolata\n   - Conservare le autorizzazioni.\n   - Esempio: file locali modificati.\n\nAttenzione: nessuna autorità aggiuntiva.'},
  {id:'approved',status:'approved',text:'## Proposta approvata\n\nApplicare Y con controllo K.'},
  {id:'old',status:'superseded',text:'## Proposta precedente\n\nApplicare X.'},
  {id:'denied',status:'excluded',text:'## Suggerimento rifiutato\n\nPubblicare una release.'},
  {id:'suggested',status:'unapproved',text:'## Suggerimento non approvato\n\nAggiungere Z.'},
  {id:'private',status:'irrelevant-confidential',text:'Private synthetic unrelated remark.'},
  {id:'mixed',status:'supporting',text:'## Review\n\nNon eseguire git push. Keep OOP-local-tests and https://example.invalid/OOP unchanged.'},
  {id:'english',status:'supporting',text:'## Existing constraints\n\nKeep PROTOCOL.md canonical.'},
];
// Explicit finite translation oracles; no general language detector or independent reviewer.
const translations=[
  {id:'analysis',language:'it',text:'## Original analysis\n\n| Case | Constraint |\n| --- | --- |\n| Local | No commit |\n\n### Detail\n\n1. Detailed proposal\n   - Preserve authorizations.\n   - Example: modified local files.\n\nWarning: no additional authority.'},
  {id:'approved',language:'it',text:'## Approved proposal\n\nApply Y with check K.'},
  {id:'old',language:'it',text:'## Previous proposal\n\nApply X.'},
  {id:'denied',language:'it',text:'## Rejected suggestion\n\nPublish a release.'},
  {id:'suggested',language:'it',text:'## Unapproved suggestion\n\nAdd Z.'},
  {id:'mixed',language:'mixed:en,it',text:'## Review\n\nDo not execute git push. Keep OOP-local-tests and https://example.invalid/OOP unchanged.'},
  {id:'english',language:'en',text:'## Existing constraints\n\nKeep PROTOCOL.md canonical.'},
];
const commitMessage='Implement Y with check K';
const embedded=message=>'\n## Canonical commit message\n\n```text\n'+message+'\n```\n';
const terminal=c=>'\nMessaggio di commit — '+(c.commitStatus==='created'?(c.pushStatus==='succeeded'?'committato e pubblicato':'committato localmente, non pubblicato'):c.commitStatus==='not_applicable'?'nessun nuovo commit':'proposto e non eseguito')+':\n\n```text\n'+commitMessage+'\n```\n';
const publicationEvents=(path,status='succeeded')=>[
  'discover',...(path==='api'?['branch']:[]),'edit',...(path==='api'?['readback']:[]),
  'checks','commit','commit-bound-checks','push',
  ...(status==='succeeded'?['remote-readback','VERIFY']:['push-blocked']),'REPORT',
];
function fixture(command='APPLY',path='local') {
  const source=structuredClone(originals);
  const translated=structuredClone(translations);
  const dossier=source.filter(x=>x.status!=='irrelevant-confidential').map(x=>{
    const value=translated.find(t=>t.id===x.id);
    return `[${x.id}: ${x.status}; original language: ${value.language}; source: fixture:source/${x.id}; ${value.language==='en'?'unchanged English':'complete English translation'}]\n${value.text}`;
  }).join('\n\n');
  const prompt=`<!-- English decision dossier -->\n${languagePolicy}\n\n${dossier}\n<!-- End decision dossier -->\n\nUse the English decision dossier for requirements, exclusions and acceptance. Implement approved Y and K only. The historical local no-commit illustration applies to ordinary prompt execution; explicit APPLY supersedes it only for selected commit/push authority under the current maintainer procedure. Other authorization and exclusions remain unchanged.\n\n${embedded(commitMessage)}${payloadReport}`;
  const capture={command,path,source,translated,prompt,worklist:['Y','K'],downloadable:command==='PREPARE',operativeLanguage:'en',outcomeLanguage:'it',
    commitPreview:null,usedMessage:command==='PREPARE'?null:commitMessage,messageAccurate:true,signingAvailable:true,intermediateCommits:[],
    reinvocation:false,equivalentExecution:true,complete:true,blocker:null,
    main:'a'.repeat(40),base:'a'.repeat(40),branch:path==='local'?'main':'maintenance/fixture',headBranch:path==='local'?'main':null,verifyTarget:path==='local'?'HEAD':'maintenance/fixture',
    checksStatus:'passed',changes:true,commitStatus:command==='PREPARE'?'not_performed':'created',
    gitCommit:command==='PREPARE'?null:'b'.repeat(40),evidenceCommit:command==='PREPARE'?null:'b'.repeat(40),
    remoteCommit:command==='PREPARE'?null:'b'.repeat(40),pushStatus:command==='PREPARE'?'not_performed':'succeeded',
    pushTarget:path==='local'?'main':'maintenance/fixture',committedWork:command==='PREPARE'?[]:['Y','K'],
    signingBefore:'configured',signingAfter:'configured',forcePush:false,protectionChanged:false,prCreated:false,
    events:command==='PREPARE'?[]:publicationEvents(path),
    normative:{available:true,changes:[],examples:[]},
    output:'## Modifiche alla fonte canonica\n\nNessuna modifica normativa canonica runtime. Appendice maintainer e distribuzione soltanto.\n\n'+report};
  capture.rawPrompt=prompt;
  if(command==='PREPARE')capture.prompt+='\n'+directive;
  return capture;
}
function check(c) {
  assert.ok(c.prompt.startsWith('<!-- English decision dossier -->\n'));
  assert.ok(c.prompt.startsWith('<!-- English decision dossier -->\n'+languagePolicy+'\n'));
  const end=c.prompt.indexOf('<!-- End decision dossier -->');
  assert.ok(end>0);
  const dossier=c.prompt.slice(0,end);
  let previous=-1;
  for(const original of c.source) {
    if(original.status==='irrelevant-confidential'){assert.ok(!c.prompt.includes(original.text));continue;}
    assert.ok(dossier.includes(`[${original.id}: ${original.status};`));
    assert.ok(dossier.includes(`source: fixture:source/${original.id};`));
    const translated=c.translated.find(t=>t.id===original.id),expected=translations.find(t=>t.id===original.id);
    assert.ok(translated && expected,'Missing passage translation');
    if(original.text!==null){
      assert.equal(original.text,originals.find(s=>s.id===original.id).text,'Unreviewed source fixture');
      assert.equal(translated.language,expected.language,'Language inventory not independently matched');
      assert.equal(translated.text,expected.text,'Incomplete or changed translation');
      assert.ok(dossier.includes(`[${original.id}: ${original.status}; original language: ${translated.language}; source: fixture:source/${original.id}; ${translated.language==='en'?'unchanged English':'complete English translation'}]`));
      if(translated.language!=='en')assert.ok(!c.prompt.includes(original.text),'Untranslated original embedded');
      else assert.equal(translated.text,original.text,'English material unnecessarily rewritten');
    } else assert.ok(dossier.includes(`[${original.id}: ${original.status}; original language: undetermined; source: fixture:source/${original.id}; original unavailable; language not verified]`));
    const text=original.text===null?`Original unavailable: ${original.id}`:translated.text;
    const at=dossier.indexOf(text);
    assert.ok(at>previous,'Translated source fidelity and ordering');previous=at;
  }
  assert.deepEqual(c.worklist,['Y','K']);
  assert.equal(validateReport(c.prompt.slice(end)).status,'PASS',JSON.stringify(validateReport(c.prompt.slice(end))));
  assert.equal(c.operativeLanguage,'en'); // Entire fixture prose is also checked against finite reviewed oracles.
  assert.equal(c.outcomeLanguage,'it');
  assert.equal(validateReport(c.output).status,'PASS');
  assert.equal((c.prompt.match(/^## Canonical commit message$/gm)||[]).length,1,'Exactly one message origin');
  assert.ok(c.prompt.includes(embedded(commitMessage)),'Exact approved English message inside artifact');
  if(c.command==='PREPARE'||c.command==='EXECUTE')assert.ok(c.prompt.endsWith('\n'+directive));
  else {assert.ok(!c.prompt.includes(directive),'APPLY executes original payload without terminal directive');assert.ok(c.prompt.endsWith(payloadReport),'No trailing unapproved operation');}
  if(c.rawPromptExpected)assert.equal(c.prompt,c.rawPromptExpected);
  if(c.command==='EXECUTE') {
    assert.equal(c.commitStatus,'not_performed');assert.equal(c.pushStatus,'not_performed');
    assert.equal(c.gitCommit,null);assert.equal(c.usedMessage,null);
    assert.deepEqual(c.events.slice(-3),['VERIFY','REPORT','message-display']);
    assert.ok(!c.events.includes('commit') && !c.events.includes('push'));
    assert.ok(c.output.endsWith(terminal(c)));return;
  }
  if(c.command==='PREPARE'){
    assert.equal(c.downloadable,true);assert.deepEqual(c.events,[]);
    assert.equal(c.commitStatus,'not_performed');assert.equal(c.pushStatus,'not_performed');assert.equal(c.gitCommit,null);
    assert.equal(c.commitPreview,null);assert.equal(c.usedMessage,null);
    assert.ok(!c.output.includes(commitMessage),'Preparer must not reveal message');
    return;
  }
  assert.equal(c.commitPreview,null,'No premature internal PREPARE completion preview');
  assert.equal(c.downloadable,false);
  assert.ok(c.output.endsWith(report),'Truthful localized terminal REPORT without later output');
  if(c.pushStatus==='succeeded')assert.deepEqual(c.events.slice(-3),['remote-readback','VERIFY','REPORT'],'VERIFY follows successful publication/readback');
  else {assert.equal(c.events.at(-1),'REPORT');assert.ok(!c.events.includes('VERIFY'),'No automatic VERIFY without successful publication');}
  if(c.commitStatus==='created')assert.equal(c.usedMessage,commitMessage,'Commit uses exact prompt message');
  else assert.equal(c.usedMessage,null,'No invented committed message');
  if(!c.messageAccurate){assert.equal(c.commitStatus,'not_performed');assert.equal(c.pushStatus,'not_performed');assert.ok(c.blocker);}
  if(!c.complete){
    assert.ok(c.blocker);assert.ok(!c.events.includes('completed'));
    if(c.commitStatus==='created')checkPublication(c);
    else {assert.equal(c.commitStatus,'not_performed');assert.equal(c.pushStatus,'not_performed');assert.equal(c.gitCommit,null);
      assert.equal(c.evidenceCommit,null);assert.equal(c.remoteCommit,null);assert.deepEqual(c.committedWork,[]);}
    return;
  }
  assert.ok(c.reinvocation||c.equivalentExecution);
  checkPublication(c);
  assert.equal(c.verifyTarget,c.path==='local'?'HEAD':c.branch);
  if(c.path==='api'){assert.equal(c.base,c.main);assert.notEqual(c.branch,'main');}
  assert.match(c.output,/^## Modifiche alla fonte canonica$/m);
  checkCanonicalReport(c.normative,c.output);
}
function checkCanonicalReport(n,output) {
  if(!n.available){assert.match(output,/NOT VERIFIED/);assert.equal(n.examples.length,0);return;}
  if(!n.changes.length){assert.match(output,/Nessuna modifica normativa canonica runtime/);assert.equal(n.examples.length,0);return;}
  const topics=[...new Set(n.changes.map(x=>x.topic))];assert.ok(topics.every(Boolean));
  assert.equal(n.examples.length,topics.length*2);
  for(const change of n.changes){assert.ok(change.before&&change.after&&change.ref);assert.ok(['prompt','independent','unknown'].includes(change.attribution));assert.ok(output.includes(change.ref));assert.ok(output.includes(change.topic));}
  for(const topic of topics)assert.equal(n.examples.filter(e=>n.changes.find(x=>x.id===e.change)?.topic===topic).length,2);
  for(const example of n.examples){assert.ok(n.changes.some(x=>x.id===example.change));assert.ok(example.before&&example.after);assert.ok(output.includes(example.before)&&output.includes(example.after));}
  assert.equal((output.match(/Esempio [12] — Prima:/g)||[]).length,topics.length*2);
}
function checkPublication(c) {
  assert.equal(c.checksStatus,'passed','Routine checks before dependent Git effects');
  assert.equal(c.protectionChanged,false);assert.equal(c.prCreated,false);
  if(c.forcePush){
    assert.equal(c.forceAuthorized,true);assert.equal(c.path,'local');
    assert.equal(c.forceTarget,'main');assert.equal(c.forceMode,'force-with-lease');
    assert.match(c.expectedRemote,/^[a-f0-9]{40}$/);
    assert.equal(c.expectedRemote,c.observedRemote,'Reject concurrent remote changes');
    assert.equal(c.expectedRemote,c.main,'Lease binds discovered remote main');
  }
  assert.equal(c.signingAfter,c.signingBefore,'Preserve configured signing');
  if(c.commitStatus==='created'){assert.equal(c.messageAccurate,true);assert.equal(c.signingAvailable,true);}
  for(const candidate of c.intermediateCommits){
    assert.equal(c.path,'api');assert.equal(candidate.disclosed,true);assert.equal(candidate.branch,c.branch);
    assert.match(candidate.sha,/^[a-f0-9]{40}$/);assert.equal(candidate.status,'candidate_unverified');
  }
  assert.equal(c.pushTarget,c.branch,'No alternate branch or direct API base write');
  if(c.path==='local'){assert.equal(c.branch,c.headBranch);assert.ok(c.headBranch && c.headBranch!=='HEAD');}
  else {assert.equal(c.base,c.main);assert.notEqual(c.branch,'main');}
  if(!c.changes){
    assert.equal(c.commitStatus,'not_applicable');assert.equal(c.pushStatus,'not_applicable');
    assert.equal(c.gitCommit,null);assert.deepEqual(c.committedWork,[]);
    assert.deepEqual(c.events,['discover','checks','REPORT']);return;
  }
  assert.equal(c.commitStatus,'created');assert.match(c.gitCommit,/^[a-f0-9]{40}$/);
  assert.equal(c.evidenceCommit,c.gitCommit,'Fresh evidence for the actual commit');
  assert.equal(c.preflight,undefined,'No technical preflight prerequisite');
  assert.deepEqual(c.committedWork,c.worklist,'Only reviewed selected work');
  assert.ok(['succeeded','blocked'].includes(c.pushStatus));
  assert.deepEqual(c.events,publicationEvents(c.path,c.pushStatus));
  if(c.pushStatus==='succeeded')assert.equal(c.remoteCommit,c.gitCommit,'Actual intended remote SHA');
  else {assert.equal(c.complete,false);assert.ok(c.blocker);assert.notEqual(c.remoteCommit,c.gitCommit);}
}
// Finite supplied-provider facts, not an authenticated settings client.
function checkProtectionDelta(before,after) {
  assert.equal(after.requirePR,false);assert.equal(after.check,null);
  assert.equal(after.strict,false);assert.equal(after.allowForcePush,true);
  const retained = ({requirePR,check,strict,allowForcePush,...other})=>other;
  assert.deepEqual(retained(after),retained(before),'Preserve unrelated settings');
}

test('WF-001: commands are unique ordered maintainer-only definitions and directive is present',()=>{
  assert.ok(directive?.includes('latest applicable OOP VERIFY'));
  const appendix=protocol.split('# Rules for the maintainer\n')[1];
  const definitions=[...appendix.matchAll(/^### (DIAGNOSE|FORMALIZE|PREPARE|VERIFY|APPLY|REPORT)$/gm)].map(x=>x[1]);
  assert.deepEqual(definitions,['DIAGNOSE','FORMALIZE','PREPARE','VERIFY','APPLY','REPORT']);
  for(const command of definitions)assert.ok(appendix.split(`### ${command}\n\n`)[1].startsWith("Act as the maintainer of the OOP repository, within this command's scope and existing authorization.\n"));
  assert.ok(!protocol.split('# Rules for the maintainer\n')[0].includes('### APPLY'));
});
test('WF-002: fully translated dossier and zero-change appendix-only/derived-only captures',()=>{
  for(const description of ['Appendice maintainer soltanto.','Distribuzione derivata soltanto.']){
    const c=fixture();c.output=c.output.replace('Appendice maintainer e distribuzione soltanto.',description);check(c);
  }
});
test('WF-003: ordinary PREPARE captures a download without applying changes',()=>check(fixture('PREPARE')));
test('WF-004: API capture verifies published branch with exact main base',()=>check(fixture('APPLY','api')));
test('WF-005: missing original is disclosed instead of reconstructed',()=>{
  const c=fixture();c.prompt=c.prompt.replace(c.translated[0].text,'Original unavailable: analysis')
    .replace('[analysis: supporting; original language: it; source: fixture:source/analysis; complete English translation]',
      '[analysis: supporting; original language: undetermined; source: fixture:source/analysis; original unavailable; language not verified]');
  c.source[0].text=null;check(c);
});
test('WF-006: unavailable execution remains explicitly incomplete',()=>{
  const c=fixture();c.complete=false;c.equivalentExecution=false;c.events=['discover','REPORT'];c.blocker='No authorized write tools';
  c.commitStatus=c.pushStatus='not_performed';c.gitCommit=c.evidenceCommit=c.remoteCommit=null;c.usedMessage=null;c.committedWork=[];c.output=c.output.replace(/\nMessaggio di commit —[\s\S]*$/,'');check(c);
});
test('WF-007: unavailable baseline is NOT VERIFIED without invented examples',()=>{
  const c=fixture();c.normative.available=false;c.output=c.output.replace('Nessuna modifica normativa canonica runtime.','NOT VERIFIED: baseline unavailable.');check(c);
});
test('WF-008: exactly two examples per topic bind changed clauses and independent attribution',()=>{
  const c=fixture();c.normative={available:true,changes:[{id:'a',topic:'Language',before:'old a',after:'new a',ref:'baseline:a -> current:a',attribution:'prompt'},{id:'b',topic:'Language',before:'old b',after:'new b',ref:'baseline:b -> current:b',attribution:'independent'}],examples:[{change:'a',before:'old a',after:'new a'},{change:'b',before:'old b',after:'new b'}]};
  c.output=c.output.replace('Nessuna modifica normativa canonica runtime.', 'Language: baseline:a -> current:a; baseline:b -> current:b.\n\nEsempio 1 — Prima: old a; Dopo: new a.\nEsempio 2 — Prima: old b; Dopo: new b.');check(c);
  c.normative.examples.push(c.normative.examples[0]);assert.throws(()=>check(c));
});
for(const [index,[label,mutate]] of [
  ['summary substitutes complete translation',c=>{c.prompt=c.prompt.replace(c.translated[0].text,'Short English summary');}],
  ['excluded work reactivated',c=>{c.worklist.push('X');}],
  ['private irrelevant content leaked',c=>{c.prompt=c.prompt.replace('<!-- End decision dossier -->',c.source.find(x=>x.id==='private').text+'\n<!-- End decision dossier -->');}],
  ['APPLY downloadable artifact',c=>{c.downloadable=true;}],
  ['no actual execution trace',c=>{c.events=[];}],
  ['local commit before routine checks',c=>{c.events.splice(c.events.indexOf('commit'),1);c.events.splice(c.events.indexOf('checks'),0,'commit');}],
  ['local push before commit-bound checks',c=>{c.events.splice(c.events.indexOf('push'),1);c.events.splice(3,0,'push');}],
  ['VERIFY targets main instead of working tree',c=>{c.verifyTarget='main';}],
  ['operation follows final message directive',c=>{c.prompt+='\nPublish a release.';}],
  ['premature REPORT',c=>{c.events.unshift('REPORT');}],
  ['recursive REPORT',c=>{c.events.push('REPORT');}],
  ['false success without tools',c=>{c.equivalentExecution=false;}],
  ['fabricated examples for zero runtime changes',c=>{c.normative.examples=[{before:'a',after:'b'}];}],
  ['missing canonical section',c=>{c.output=c.output.replace('## Modifiche alla fonte canonica','## Other');}],
  ['missing terminal report',c=>{c.output=c.output.split('## Modifiche proposte')[0];}],
].entries())test(`WF-${String(index+9).padStart(3,'0')}: rejects ${label}`,()=>{const c=fixture();mutate(c);assert.throws(()=>check(c));});
test('WF-024: API wrong base main writes and missing push/readback are rejected',()=>{
  for(const mutate of [c=>{c.base='b'.repeat(40);},c=>{c.branch='main';c.verifyTarget='main';},c=>{c.events=c.events.filter(x=>x!=='push');},c=>{c.events=c.events.filter(x=>x!=='remote-readback');}]){const c=fixture('APPLY','api');mutate(c);assert.throws(()=>check(c));}
});

test('WF-028: complete Italian mixed and unchanged English prose retain technical literals',()=>{
  const c=fixture('PREPARE');check(c);
  for(const literal of ['git push','OOP-local-tests','https://example.invalid/OOP','PROTOCOL.md'])assert.ok(c.prompt.includes(literal));
  const italian=c.source.find(x=>x.id==='analysis');assert.ok(!c.prompt.includes(italian.text));
});
test('WF-029: wrong language incomplete translation missing attribution and altered literals fail',()=>{
  for(const mutate of [
    c=>{c.prompt+=c.source[0].text;},
    c=>{c.prompt=c.prompt.replace(c.translated[0].text,'## Analisi originale');},
    c=>{c.translated[0].text='Short English summary';},
    c=>{c.translated[0].language='en';},
    c=>{c.translated[0].language='undetermined';},
    c=>{c.prompt=c.prompt.replace('source: fixture:source/analysis;','source: unavailable;');},
    c=>{c.prompt=c.prompt.replace('complete English translation','verbatim original');},
    c=>{c.prompt=c.prompt.replace('https://example.invalid/OOP','https://example.invalid/translated');},
    c=>{c.prompt=c.prompt.replace('[denied: excluded;','[denied: approved;');},
    c=>{c.prompt=c.prompt.replace('No commit','Commit permitted');},
  ]){const c=fixture('PREPARE');mutate(c);assert.throws(()=>check(c));}
});
test('WF-030: missing competing stale localized misplaced or preparer-displayed messages fail',()=>{
  for(const mutate of [
    c=>{c.prompt=c.prompt.replace(embedded(commitMessage),'');},
    c=>{c.prompt=c.prompt.replace(embedded(commitMessage),embedded('Apply X'));},
    c=>{c.prompt=c.prompt.replace(embedded(commitMessage),embedded('Applicare Y con controllo K'));},
    c=>{c.output+=terminal(c);},
    c=>{c.prompt=c.prompt.replace(embedded(commitMessage),embedded(commitMessage)+embedded('Competing message'));},
    c=>{c.events.push('commit','push');},
  ]){const c=fixture('PREPARE');mutate(c);assert.throws(()=>check(c));}
  const internal=fixture();internal.commitPreview=commitMessage;assert.throws(()=>check(internal));
});
test('WF-031: local/API publication and rejected push retain exact stages and current HEAD branch',()=>{
  check(fixture());check(fixture('APPLY','api'));
  const current=fixture();current.branch=current.headBranch=current.pushTarget='runtime/current-work';check(current);
  const switched=structuredClone(current);switched.branch=switched.pushTarget='main';assert.throws(()=>check(switched));
  const blocked=fixture();blocked.complete=false;blocked.pushStatus='blocked';blocked.remoteCommit=blocked.main;
  blocked.blocker='Provider settings still reject direct main publication';blocked.events=publicationEvents('local','blocked');blocked.output=blocked.output.replace(/\nMessaggio di commit —[\s\S]*$/,'');check(blocked);
  assert.equal(blocked.gitCommit,'b'.repeat(40));assert.equal(blocked.remoteCommit,'a'.repeat(40));
});
test('WF-032: stale commit evidence false remote success bypasses or unrelated work fail',()=>{
  for(const mutate of [
    c=>{c.evidenceCommit=c.main;},c=>{c.remoteCommit=c.main;},c=>{c.checksStatus='failed';},
    c=>{c.events=c.events.filter(e=>e!=='commit-bound-checks');},
    c=>{c.events=c.events.filter(e=>e!=='remote-readback');},c=>{c.committedWork.push('independent');},
    c=>{c.pushTarget='maintenance/alternate';},c=>{c.forcePush=true;},c=>{c.protectionChanged=true;},
    c=>{c.prCreated=true;},c=>{c.signingAfter='disabled';},c=>{c.pushStatus='blocked';},
  ]){const c=fixture();mutate(c);assert.throws(()=>check(c));}
});
test('WF-033: no-change APPLY creates no empty commit; denied access remains incomplete',()=>{
  const noop=fixture();noop.changes=false;noop.commitStatus=noop.pushStatus='not_applicable';noop.gitCommit=null;
  noop.committedWork=[];noop.usedMessage=null;noop.output=noop.output.replace(/\nMessaggio di commit —[\s\S]*$/,'');noop.events=['discover','checks','REPORT'];check(noop);
  const invalid=structuredClone(noop);invalid.events.splice(3,0,'commit');assert.throws(()=>check(invalid));
  const denied=fixture('APPLY','api');denied.complete=false;denied.blocker='API branch write permission unavailable';
  denied.commitStatus=denied.pushStatus='not_performed';denied.gitCommit=denied.evidenceCommit=denied.remoteCommit=null;
  denied.committedWork=[];denied.usedMessage=null;denied.events=['discover','REPORT'];denied.output=denied.output.replace(/\nMessaggio di commit —[\s\S]*$/,'');check(denied);
});
test('WF-034: direct main needs no preflight; authorized force lease rejects stale or unauthorized writes',()=>{
  check(fixture());
  const c=fixture();Object.assign(c,{forcePush:true,forceAuthorized:true,forceTarget:'main',
    forceMode:'force-with-lease',expectedRemote:c.main,observedRemote:c.main});
  check(c);
  for(const mutate of [
    x=>{x.forceAuthorized=false;},x=>{x.forceTarget='other';},x=>{x.forceMode='force';},
    x=>{x.observedRemote='c'.repeat(40);},x=>{x.expectedRemote=null;},
    x=>{x.expectedRemote=x.observedRemote='c'.repeat(40);},
  ]){const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>check(invalid));}
});
test('WF-035: approved direct-push settings remove gates and enable force while preserving unrelated settings',()=>{
  const before={requirePR:true,check:{context:'local-tests',appId:15368},strict:true,enforceAdmins:true,
    allowForcePush:false,allowDeletion:false,requireSigned:false,linearHistory:false};
  const after={...structuredClone(before),requirePR:false,check:null,strict:false,allowForcePush:true};
  checkProtectionDelta(before,after);
  for(const mutate of [
    p=>{p.requirePR=true;},p=>{p.check=before.check;},p=>{p.strict=true;},p=>{p.allowForcePush=false;},
    p=>{p.enforceAdmins=false;},p=>{p.allowDeletion=true;},p=>{p.requireSigned=true;},p=>{p.linearHistory=true;},
  ]){const invalid=structuredClone(after);mutate(invalid);assert.throws(()=>checkProtectionDelta(before,invalid));}
});
function retainUncommitted(c,blocker) {
  Object.assign(c,{complete:false,blocker,commitStatus:'not_performed',pushStatus:'not_performed',
    gitCommit:null,evidenceCommit:null,remoteCommit:null,usedMessage:null,committedWork:[],
    events:['discover','edit','checks','REPORT']});
  c.output=c.output.replace(/\nMessaggio di commit —[\s\S]*$/,'');return c;
}
test('WF-036: ordinary prompt execution changes local work without commit authority',()=>{
  const c=retainUncommitted(fixture(),'Ordinary prompt execution leaves work uncommitted');c.command='EXECUTE';c.prompt+='\n'+directive;c.events.splice(c.events.indexOf('REPORT'),0,'VERIFY');c.events.push('message-display');c.output+=terminal(c);check(c);
  const invalid=structuredClone(c);invalid.events.splice(4,0,'commit');assert.throws(()=>check(invalid));
});
test('WF-037: inaccurate message blocks commit while retaining work and unchanged proposed message',()=>{
  const c=retainUncommitted(fixture(),'Selected scope does not match canonical message');c.messageAccurate=false;check(c);
  const wrong=fixture();wrong.messageAccurate=false;assert.throws(()=>check(wrong));
  c.usedMessage='Silently generated alternative';assert.throws(()=>check(c));
});
test('WF-038: no signing or failed tests preserve work and never invent publication',()=>{
  for(const blocker of ['Configured signing unavailable','Selected tests failed']) {
    const c=retainUncommitted(fixture(),blocker);c.signingAvailable=false;check(c);
  }
  const invalid=fixture();invalid.signingAvailable=false;assert.throws(()=>check(invalid));
});
test('WF-039: final Git message and post-message output or effects cannot silently differ',()=>{
  for(const mutate of [c=>c.usedMessage='Other message',c=>c.output+='Postscript',
    c=>c.events.push('push'),c=>c.events.splice(c.events.indexOf('REPORT'),1)]) {
    const c=fixture();mutate(c);assert.throws(()=>check(c));
  }
});
test('WF-040: API intermediate selected branch candidates are disclosed without prior VERIFY',()=>{
  const c=fixture('APPLY','api');c.intermediateCommits=[{sha:'c'.repeat(40),status:'candidate_unverified',disclosed:true,branch:c.branch}];check(c);
  for(const patch of [{disclosed:false},{branch:'foreign'},{sha:'unknown'}]){
    const invalid=structuredClone(c);Object.assign(invalid.intermediateCommits[0],patch);assert.throws(()=>check(invalid));
  }
});

test('WF-041: canonical maintainer source requires embedded message exact use and final ordering',()=>{
  const prepare=protocol.split('### PREPARE\n')[1].split('### VERIFY\n')[0];
  assert.match(formalize,/exactly one canonical English commit message/);
  assert.match(prepare,/MUST NOT display this message/);
  assert.match(apply,/git commit -F <validated_temp_message_file> --cleanup=verbatim/);
  assert.match(directive,/complete the full localized REPORT.*sole final user-visible action/);
  assert.match(directive,/DO NOT perform any operation.*after the final message block/);
});

// Bounded raw-workflow profile, not a general YAML parser or provider execution.
const visibilityGuard=`if [ "$OOP_REPOSITORY_PRIVATE" != 'false' ]; then
  echo 'OOP producer CI must not report passing checks for non-public repositories.' >&2
  exit 1
fi`;
const majorCheck='if (Number(process.versions.node.split(".")[0]) !== 24) process.exit(1)';
function workflowProfile(source) {
  const workflow=source.replace(/\r\n/g,'\n');
  assert.match(workflow,/^name: Producer tests\non:\n  pull_request:\n  push:\n    branches: \[main\]\npermissions:\n  contents: read\njobs:\n  local-tests:\n    runs-on: ubuntu-24\.04\n    timeout-minutes: 10\n    steps:\n/);
  assert.equal((workflow.match(/^  [\w-]+:\n/gm)??[]).filter(x=>x==='  local-tests:\n').length,1);
  assert.ok(!/continue-on-error:|^\s+if:|^\s+name:.*local-tests|secrets\.|upload-artifact|npm\s+(install|ci)/m.test(workflow),'No conditional skip, bypass or added effects');
  const steps=workflow.split(/^      - /m).slice(1);
  assert.equal(steps.length,6,'Preserve current report and full producer checks');
  assert.equal(steps[0],`name: Refuse unverified or private visibility\n        env:\n          OOP_REPOSITORY_PRIVATE: $`+`{{ github.event.repository.private }}\n        run: |\n${visibilityGuard.split('\n').map(line=>'          '+line).join('\n')}\n`);
  assert.equal(steps[1],'uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4\n        with:\n          persist-credentials: false\n          fetch-depth: 1\n');
  assert.equal(steps[2],"name: Set up Node.js 24\n        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0\n        with:\n          node-version: '24'\n          package-manager-cache: false\n");
  assert.equal(steps[3],`name: Verify Node.js major\n        run: |\n          node --version\n          node -e '${majorCheck}'\n`);
  assert.equal(steps[4],'name: Validate maintainer REPORT structure\n        run: node --test tools/validate-maintainer-report.test.mjs tools/maintainer-workflow.test.mjs\n');
  assert.equal(steps[5],`name: Validate current producer package and checkout\n        run: |\n          node --version\n          node tools/accept-release.mjs || { status=$?; cat tools/evidence/current-tests.tap; exit "$status"; }\n          node tools/accept-release.mjs --check-current\n          cat tools/evidence/current-tests.tap\n          git diff --exit-code\n`);
  return {guard:steps[0].split('        run: |\n')[1].split('\n').filter(Boolean).map(line=>line.slice(10)).join('\n'),
    major:steps[3].match(/node -e '([^']+)'/)[1]};
}
const workflow=()=>readFileSync(new URL('../.github/workflows/producer-tests.yml',import.meta.url),'utf8');
test('WF-025: post-publication public CI and Node 24 preserve pinned least-privilege execution',()=>workflowProfile(workflow()));
test('WF-026: actual extracted guard rejects private and unknown; Node assertion rejects wrong major',()=>{
  const scripts=workflowProfile(workflow());
  const shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
  for(const [visibility,status] of [['false',0],['true',1],['',1],['unknown',1],['False',1]]) {
    const result=spawnSync(shell,['--noprofile','--norc','-c',scripts.guard],{encoding:'utf8',env:{...process.env,OOP_REPOSITORY_PRIVATE:visibility}});
    assert.equal(result.status,status,result.error?.message??result.stderr);
    if(status)assert.match(result.stderr,/must not report passing checks/);
  }
  for(const version of ['24.19.0','23.11.0','25.0.0']) {
    let status=0;
    runInNewContext(scripts.major,{process:{versions:{node:version},exit:code=>{status=code;}}});
    assert.equal(status,version.startsWith('24.')?0:1);
  }
});
test('WF-027: sandbox string mutations detect visibility bypass, missing pins and wrong ordering',()=>{
  const source=workflow().replace(/\r\n/g,'\n');
  for(const mutate of [
    s=>s.replace('  local-tests:\n','  local-tests:\n    if: github.event.repository.private == false\n'),
    s=>s.replace('  local-tests:','  renamed-tests:'),
    s=>s.replace('        env:','        continue-on-error: true\n        env:'),
    s=>s.replace('      - name: Refuse unverified or private visibility','      - name: Refuse unverified or private visibility\n        if: false'),
    s=>s.replace('            exit 1','            exit 0'),
    s=>s.replace("!= 'false'","= 'false'"),
    s=>s.replace(/      - name: Refuse unverified or private visibility[\s\S]*?(?=      - uses:)/,''),
    s=>{const steps=s.split(/^      - /m);[steps[1],steps[2]]=[steps[2],steps[1]];return steps.join('      - ');},
    s=>s.replace('949feb2413d6458794dcd2491c4babbbce0c15c1','v7.1.0'),
    s=>s.replace("node-version: '24'","node-version: '23'"),
    s=>s.replace(`          node -e '${majorCheck}'\n`,''),
    s=>s.replace('package-manager-cache: false','package-manager-cache: true'),
  ])assert.throws(()=>workflowProfile(mutate(source)));
});

// FML captures are bounded synthetic observations. No installed host control is claimed.
const digest=value=>createHash('sha256').update(value).digest('hex');
// FORMALIZE is pinned by the reviewed content identity of its current text.
const formalizeIdentity='sha256:2d93cd99443c029bd04760d767d0f550fdffbde871e5119ddf250da49efdeae7';
function copyCheck(value=formalize){assert.equal('sha256:'+digest(value),formalizeIdentity,'Reviewed FORMALIZE identity');}
const returned=()=>fixture('APPLY').rawPrompt;
function validReturn(value){
  assert.ok(value.startsWith('<!-- English decision dossier -->'));
  assert.ok(value.startsWith('<!-- English decision dossier -->\n'+languagePolicy+'\n'));
  assert.ok(value.includes(payloadReport));
  assert.equal((value.match(/^## Canonical commit message$/gm)||[]).length,1);
  assert.ok(value.includes(embedded(commitMessage)));
  assert.ok(!value.includes(directive));
}
function augmented(value){validReturn(value);return value+'\n'+directive;}
function saved(value,now=Date.now()){
  const directory=mkdtempSync(join(tmpdir(),'oop-prepare-'));
  const path=join(directory,`OOP_${Math.floor(now/1000)}_fixture.md`);
  writeFileSync(path,augmented(value),'utf8');
  return {directory,path,now};
}
function flow(overrides={}){
  return {raw:returned(),executed:returned(),saved:false,appended:false,
    innerSuccess:true,verify:'passed',complete:true,message:commitMessage,usedMessage:commitMessage,diff:true,
    signing:true,authority:true,path:'local',offlineCandidate:true,intermediateCommits:[],
    branch:overrides.path==='api'?'runtime/dedicated-change':'runtime/current-work',
    events:['FORMALIZE',...(overrides.path==='api'?['branch']:[]),'execute-unchanged','checks','commit','commit-bound-checks','push','remote-readback','VERIFY','REPORT'],
    candidateValidated:true,releaseReady:false,ci:'pending',ciClaim:'pending',commit:'b'.repeat(40),
    evidenceCommit:'b'.repeat(40),remote:'b'.repeat(40),readback:'b'.repeat(40),...overrides};
}
function flowCheck(c){
  validReturn(c.raw);assert.equal(c.raw,c.executed);assert.equal(c.saved,false);assert.equal(c.appended,false);
  assert.equal(c.events[0],'FORMALIZE');assert.equal(c.events.filter(x=>x==='FORMALIZE').length,1);
  const index=event=>c.events.indexOf(event);
  for(const candidate of c.intermediateCommits){
    assert.equal(c.path,'api');assert.equal(candidate.disclosed,true);assert.equal(candidate.branch,c.branch);
    assert.match(candidate.sha,/^[a-f0-9]{40}$/);
  }
  assert.ok(!c.events.includes('outer-VERIFY'),'No prior canonical VERIFY gate');
  assert.ok(!c.events.some(e=>['force-push','ref-write','admin'].includes(e)),'No broader implicit authority');
  if(c.events.includes('branch')){assert.equal(c.path,'api');assert.ok(index('branch')>index('FORMALIZE'));}
  const publishing=c.events.includes('commit');
  if(publishing){
    assert.equal(c.innerSuccess,true);assert.equal(c.diff,true);assert.equal(c.signing,true);assert.equal(c.authority,true);
    assert.equal(c.usedMessage,c.message);assert.equal(c.message,commitMessage);
    assert.ok(index('checks')>index('execute-unchanged'));assert.ok(index('commit')>index('checks'));
    assert.ok(index('commit-bound-checks')>index('commit'));assert.equal(c.evidenceCommit,c.commit);
    if(c.events.includes('push'))assert.ok(index('push')>index('commit-bound-checks'));
    if(c.events.includes('remote-readback')){
      assert.ok(c.events.includes('push'));assert.ok(index('remote-readback')>index('push'));assert.equal(c.readback,c.commit);assert.equal(c.remote,c.commit);
      assert.equal(c.events.filter(e=>e==='VERIFY').length,1);
      assert.ok(index('VERIFY')>index('remote-readback'));
      assert.ok(['passed','failed','blocked','unsupported'].includes(c.verify));
      assert.equal(c.complete,c.verify==='passed');
    }else {assert.ok(!c.events.includes('VERIFY'));assert.equal(c.complete,false);}
  }else{assert.equal(c.commit,null);assert.equal(c.remote,null);assert.equal(c.usedMessage,null);assert.ok(!c.events.includes('VERIFY'));}
  assert.equal(c.releaseReady,false,'Candidate evidence alone does not certify release readiness');
  assert.equal(c.ciClaim,c.ci,'No invented CI');assert.equal(c.events.at(-1),'REPORT');
}
const blockedFlow=overrides=>flow({commit:null,remote:null,usedMessage:null,verify:'not_performed',complete:false,
  events:['FORMALIZE','execute-unchanged','REPORT'],...overrides});

test('FML-001: six unique ordered command definitions',()=>{
  assert.deepEqual([...protocol.matchAll(/^### (DIAGNOSE|FORMALIZE|PREPARE|VERIFY|APPLY|REPORT)$/gm)].map(x=>x[1]),['DIAGNOSE','FORMALIZE','PREPARE','VERIFY','APPLY','REPORT']);
});
test('FML-002: FORMALIZE text matches its reviewed content identity without history lookup',()=>{
  copyCheck();assert.ok(formalize.startsWith('Act as the maintainer'));
});
test('FML-003: FORMALIZE requires removal of earlier-commit references and prior-behavior narration',()=>{
  assert.ok(formalize.includes('The generated prompt MUST require the executor to remove from every tracked file all references to earlier commits and, except CHANGELOG.md, to how OOP behaved before the change, describing only the resulting current state; delta evidence stays in untracked candidate evidence and the REPORT.'));
  assert.match(formalize,/deterministic check that fails on any commit identifier/);
  assert.throws(()=>copyCheck(formalize.replace('except CHANGELOG.md, to how','to how')));
});
test('FML-004: unrelated inherited word mutation fails literal comparison',()=>assert.throws(()=>copyCheck(formalize.replace('vendor- and tool-agnostic','provider-specific'))));
test('FML-005: FORMALIZE never invokes delegating PREPARE or itself',()=>{
  assert.ok(!/^Invoke.*(?:FORMALIZE|PREPARE)/m.test(formalize));assert.ok(!formalize.includes('### PREPARE'));
});
test('FML-006: complete prompt return contains dossier message and REPORT without effects',()=>{
  validReturn(returned());assert.match(formalize,/Do not create or link a downloadable Markdown file/);assert.match(formalize,/MUST NOT implement repository changes, commit or push/);
});
test('FML-007: delivery terminates at prompt and no terminal display obligation',()=>{
  assert.match(formalize,/return the complete prompt and end the operation without a subsequent report or footer/);
  assert.ok(!formalize.includes('No operation, instruction or additional output follows that terminal display'));
  assert.ok(formalize.endsWith('Do not require terminal commit-message display.\n'));
});
test('FML-008: PREPARE first operative step invokes FORMALIZE exactly once',()=>{
  assert.match(prepare,/authorization\.\n\nInvoke the current FORMALIZE command exactly once as the first operative instruction/);
  assert.match(prepare,/same effective user request, analysis, approvals, exclusions and context/);
});
test('FML-009: actual saved bytes equal raw output separator and single directive',()=>{
  const value=returned(),file=saved(value);
  try{assert.deepEqual(readFileSync(file.path),Buffer.from(value+'\n'+directive));assert.ok(readFileSync(file.path,'utf8').endsWith(directive));}
  finally{rmSync(file.directory,{recursive:true,force:true});}
});
test('FML-010: actual PREPARE filename path and Unix seconds',()=>{
  const file=saved(returned());try{assert.ok(existsSync(file.path));assert.ok(file.path.endsWith(`OOP_${Math.floor(file.now/1000)}_fixture.md`));}
  finally{rmSync(file.directory,{recursive:true,force:true});}
});
test('FML-011: PREPARE has no implementation Git effects or message preview',()=>check(fixture('PREPARE')));
test('FML-012: duplicate or misplaced PREPARE terminal directive fails',()=>{
  for(const value of [returned()+'\n'+directive,returned()+'\n'+directive+'\nPublish'])assert.throws(()=>augmented(value));
  const c=fixture('PREPARE');c.prompt+='\nPublish';assert.throws(()=>check(c));
});
test('FML-013: APPLY first operative step invokes FORMALIZE exactly once',()=>assert.match(apply,/authorization\.\n\nInvoke the current FORMALIZE command exactly once as the first operative instruction/));
test('FML-014: APPLY exact raw prompt execution rejects changed payload',()=>{
  flowCheck(flow());assert.throws(()=>flowCheck(flow({executed:returned()+'\nChange scope'})));
});
test('FML-015: APPLY cannot save or append PREPARE directive',()=>{
  for(const change of [{saved:true},{appended:true}])assert.throws(()=>flowCheck(flow(change)));
});
test('FML-016: no external commit/publication restriction is an APPLY prerequisite',()=>{
  flowCheck(flow({innerBoundary:'unavailable'}));flowCheck(flow());
  assert.ok(!apply.includes('establish an enforceable outer capability/authorization boundary'));
  assert.ok(apply.includes('No external capability restriction preventing commits/publication is required'));
});

test('FML-017: execution failure retains work without publication or automatic VERIFY',()=>{
  flowCheck(blockedFlow({innerSuccess:false}));assert.throws(()=>flowCheck(flow({innerSuccess:false})));
});

test('FML-018: VERIFY must follow final commit push and matching remote readback',()=>{
  for(const before of ['execute-unchanged','commit','push','remote-readback']){
    const c=flow();c.events=c.events.filter(e=>e!=='VERIFY');c.events.splice(c.events.indexOf(before),0,'VERIFY');assert.throws(()=>flowCheck(c));
  }
  const old=flow();old.events.splice(2,0,'outer-VERIFY');assert.throws(()=>flowCheck(old));
});

test('FML-019: failed post-publication VERIFY preserves published effects and rejects false completion',()=>{
  for(const verify of ['failed','blocked','unsupported']){
    flowCheck(flow({verify,complete:false}));assert.throws(()=>flowCheck(flow({verify,complete:true})));
  }
});

test('FML-020: successful publication requires exactly one executed post-publication VERIFY',()=>{
  for(const events of [flow().events.filter(e=>e!=='VERIFY'),[...flow().events.slice(0,-1),'VERIFY','REPORT']])
    assert.throws(()=>flowCheck(flow({events})));
  assert.throws(()=>flowCheck(flow({verify:'not_performed'})));
});

test('FML-021: empty approved diff produces no commit or artificial push',()=>{
  flowCheck(blockedFlow({diff:false}));assert.throws(()=>flowCheck(flow({diff:false})));
});
test('FML-022: candidate validation cannot become release_ready',()=>{
  flowCheck(flow());assert.throws(()=>flowCheck(flow({releaseReady:true})));assert.match(apply,/candidate_validated is distinct from release_ready/);
});
test('FML-023: exact canonical message mismatch blocks commit',()=>assert.throws(()=>flowCheck(flow({usedMessage:'Other title'}))));
test('FML-024: missing signing or authority blocks only dependent publication',()=>{
  for(const key of ['signing','authority']){flowCheck(blockedFlow({[key]:false}));assert.throws(()=>flowCheck(flow({[key]:false})));}
});
test('FML-025: current local HEAD branch retains scoped signed evidence and readback',()=>{
  check(fixture());flowCheck(flow());
  assert.match(apply,/Commit and ordinarily push the selected changes on that same current HEAD branch/);
  assert.match(apply,/VERIFY the current HEAD branch and its actual published commit/);
});
test('FML-026: force lease rejects absent authority or remote advancement',()=>{
  const c=fixture();Object.assign(c,{forcePush:true,forceAuthorized:true,forceTarget:'main',forceMode:'force-with-lease',expectedRemote:c.main,observedRemote:c.main});check(c);
  c.observedRemote='c'.repeat(40);assert.throws(()=>check(c));c.observedRemote=c.main;c.forceAuthorized=false;assert.throws(()=>check(c));
});
test('FML-027: API execution needs no offline candidate and keeps intermediate commits scoped',()=>{
  const c=flow({path:'api',offlineCandidate:false});c.intermediateCommits=[{sha:'c'.repeat(40),disclosed:true,branch:c.branch}];flowCheck(c);
  const invalid=structuredClone(c);invalid.intermediateCommits[0].branch='main';assert.throws(()=>flowCheck(invalid));
});

test('FML-028: dedicated API branch is verified after final publication',()=>{
  flowCheck(flow({path:'api'}));check(fixture('APPLY','api'));
  assert.match(apply,/Create a unique new branch dedicated to this change/);
  assert.match(apply,/VERIFY the dedicated new branch at its actual final published SHA/);
});

test('FML-029: rejected push preserves local commit and never claims remote success',()=>{
  const c=fixture();c.complete=false;c.pushStatus='blocked';c.remoteCommit=c.main;c.blocker='Protected main';c.events=publicationEvents('local','blocked');check(c);
  c.remoteCommit=c.gitCommit;assert.throws(()=>check(c));
  const failed=flow({complete:false,verify:'not_performed',remote:'a'.repeat(40),readback:null,
    events:['FORMALIZE','execute-unchanged','checks','commit','commit-bound-checks','push','push-blocked','REPORT']});
  flowCheck(failed);
  failed.events.splice(-1,0,'VERIFY');assert.throws(()=>flowCheck(failed));
});
test('FML-030: stale committed evidence cannot reuse candidate PASS',()=>assert.throws(()=>flowCheck(flow({evidenceCommit:'a'.repeat(40)}))));
test('FML-031: false remote identity and invented successful CI fail',()=>{
  assert.throws(()=>flowCheck(flow({readback:'a'.repeat(40)})));
  assert.throws(()=>flowCheck(flow({events:flow().events.filter(e=>e!=='push')})));
  for(const ci of ['pending','failed','unavailable'])assert.throws(()=>flowCheck(flow({ci,ciClaim:'passed'})));
});
test('FML-032: actual localized REPORT and canonical source section without APPLY display',()=>{
  const c=fixture();check(c);assert.ok(!c.output.includes(commitMessage));assert.match(apply,/APPLY does not append or require a terminal commit-message display/);
});
test('FML-033: extracted runtime source matches reviewed language identity and continuation candidate',()=>{
  assert.equal('sha256:'+digest(protocolSource(protocol)),JSON.parse(readFileSync(new URL('./release-review.json',import.meta.url),'utf8')).source_identity);
});
test('FML-034: legacy supplied negative scope and authority controls preserved',()=>{
  for(const mutate of [c=>c.committedWork.push('independent'),c=>c.signingAfter='disabled',c=>c.checksStatus='failed']){const c=fixture();mutate(c);assert.throws(()=>check(c));}
});
test('FML-035: partial, duplicated or altered FORMALIZE text fails closed',()=>{
  for(const value of [formalize.slice(1),formalize+'\n',formalize.replace('No extra confirmation','Extra confirmation')])assert.throws(()=>copyCheck(value));
});
test('FML-036: dossier status translation and technical identifiers remain authoritative',()=>{
  check(fixture('PREPARE'));
  const c=fixture('PREPARE');c.prompt=c.prompt.replace('[denied: excluded;','[denied: approved;');assert.throws(()=>check(c));
});

test('FML-037: opening language declaration retains dossier-first and exact PREPARE bytes',()=>{
  const c=fixture('PREPARE');check(c);validReturn(c.rawPrompt);
  assert.equal(c.prompt,c.rawPrompt+'\n'+directive);
  for(const prompt of [c.rawPrompt.replace(languagePolicy,''),c.rawPrompt.replace(languagePolicy,'')+'\n'+languagePolicy,
    languagePolicy+'\n'+c.rawPrompt])assert.throws(()=>validReturn(prompt));
  const appendix=protocol.split('# Rules for the maintainer\n')[1];
  for(const text of ['applicable explicit user response-language request',"receiving runtime's effective language preference",
    'If unresolved, explain the limitation and request an explicit response language.','within the beginning of the required English decision dossier',
    "PREPARE's exact append boundary"])assert.ok(appendix.includes(text),text);
  assert.ok(!protocolSource(protocol).includes('**Maintainer language resolution and generated prompts.**'));
});

test('VFY-001: message inequality alone never fails VERIFY while substantive failures remain failures',()=>{
  assert.match(verify,/A commit message differing from the exact title\/body/);
  assert.match(verify,/cause VERIFY to fail/);assert.match(verify,/both to standalone VERIFY/);
  assert.match(verify,/MUST NOT require a corrective commit, amend or history rewrite/);
  // Supplied capture oracle only: no Git effects and no installed VERIFY executor.
  const capture={expectedMessage:'Prompt title',actualMessage:'User supplied title',contentVerified:true,authorityVerified:true,verdict:'PASS',findings:[]};
  const checkCapture=c=>{
    assert.equal(c.verdict,c.contentVerified&&c.authorityVerified?'PASS':'FAIL');
    assert.ok(!c.findings.includes('message_mismatch'));
  };
  for(const actualMessage of ['Prompt title','User supplied title','Prompt title\n\nDifferent body'])checkCapture({...capture,actualMessage});
  checkCapture({...capture,contentVerified:false,verdict:'FAIL',findings:['missing_required_change']});
  assert.throws(()=>checkCapture({...capture,verdict:'FAIL',findings:['message_mismatch']}));
  assert.throws(()=>checkCapture({...capture,authorityVerified:false}));
  // The separate APPLY execution contract is intentionally preserved.
  assert.match(apply,/Use the exact embedded canonical title\/body/);
});

test('VFY-002: final instruction groups all source change types with two examples per topic',()=>{
  const last=verify.trim().split('\n\n').at(-1);
  assert.ok(last.startsWith('As the final instruction of VERIFY,'));
  for(const text of ['addition, modification and removal','grouping the affected document lines by topic',
    'baseline range for removed text','current range for added text','For each changed topic provide exactly two',
    'prior absence for additions','resulting absence for removals','NOT VERIFIED','do not invent examples',
    "before REPORT's two terminal sections",'do not duplicate it'])assert.ok(last.includes(text),text);
  const changes=[{id:'edit',topic:'Language',before:'old rule',after:'new rule',ref:'baseline:10-12 -> current:10-14',attribution:'prompt'},
    {id:'add',topic:'Identity',before:'absent',after:'new identity rule',ref:'baseline:absent -> current:20-22',attribution:'independent'},
    {id:'remove',topic:'Identity',before:'obsolete rule',after:'absent',ref:'baseline:30-32 -> current:absent',attribution:'prompt'}];
  const examples=[{change:'edit',before:'old example A',after:'new example A'},{change:'edit',before:'old example B',after:'new example B'},
    {change:'add',before:'absent',after:'new identity rule'},{change:'remove',before:'obsolete rule',after:'absent'}];
  const output=changes.map(c=>c.topic+': '+c.ref).join('\n')+'\n'+examples.map((e,i)=>`Esempio ${i%2+1} — Prima: ${e.before}; Dopo: ${e.after}`).join('\n');
  const n={available:true,changes,examples};checkCanonicalReport(n,output);
  assert.throws(()=>checkCanonicalReport({...n,examples:examples.slice(0,2)},output));
  assert.throws(()=>checkCanonicalReport(n,output.replace('baseline:30-32','baseline:unknown')));
  assert.throws(()=>checkCanonicalReport({...n,changes:changes.map(c=>({...c,topic:undefined}))},output));
});

test('VFY-003: absent runtime delta and unavailable evidence never fabricate grouped examples',()=>{
  checkCanonicalReport({available:true,changes:[],examples:[]},'Nessuna modifica normativa canonica runtime. Appendice maintainer soltanto.');
  checkCanonicalReport({available:false,changes:[],examples:[]},'NOT VERIFIED: missing baseline.');
  assert.throws(()=>checkCanonicalReport({available:false,changes:[],examples:[{before:'invented',after:'invented'}]},'NOT VERIFIED'));
});

// Scoped source assertions and supplied facts only: no installed maintainer gate,
// authenticated provider checks or Git effects are implemented by these fixtures.
const maintainerIdentityParagraph=protocol.split('# Rules for the maintainer\n')[1]
  .split('**Maintainer language resolution and generated prompts.** ')[1].split('\n\n')[0];
test('MID-001: maintainer role excludes consumer worker attribution and retains independent controls',()=>{
  for(const required of ['apply exclusively to AI runtimes acting under adopted OOP runtime governance',
    'They do not govern a human or AI acting in the role of maintainer',
    'effective Git author/committer and authenticated publisher identity',
    'accurately attributed to, and authorized for OOP maintenance',
    'preserving verified genuine human authorship','authentication, permissions, signing and signature acceptance',
    'safe branch/ref targeting, commit readback and publication evidence independently',
    'unknown required proof blocks the dependent effect',
    "Merely maintaining OOP does not require using the consumer runtime's",
    'shared `.priv` credential mapping or provider principal',
    'This exemption creates no write/publication authority and does not weaken the runtime rule'])
    assert.ok(maintainerIdentityParagraph.includes(required),required);
  assert.doesNotMatch(maintainerIdentityParagraph,/enforce exact AI attribution|verify the `ai-coworker` provider principal/);
});

test('MID-002: distinct authorized human and AI maintainer captures retain fail-closed safety',()=>{
  // A finite oracle for the independently required maintainer facts above;
  // it authenticates nothing and is not the consumer commitAttributionGate.
  const required=['identity_appropriate','attribution_accurate','human_authorship_preserved',
    'authentication_verified','permissions_verified','signing_verified_or_inapplicable',
    'signature_acceptance_verified_or_inapplicable','safe_target_verified',
    'commit_readback_verified','publication_evidence_verified'];
  const checkCapture=c=>{
    assert.ok(['human','ai'].includes(c.actor));
    assert.ok(c.author.name && c.author.email && c.committer.name && c.committer.email && c.publisher);
    for(const fact of required)assert.equal(c[fact],true,fact);
    assert.ok(maintainerIdentityParagraph.includes('They do not govern a human or AI acting in the role of maintainer'));
  };
  for(const actor of ['human','ai']){
    const identity={name:'authorized-maintainer',email:'maintainer@example.invalid'};
    const capture={actor,author:identity,committer:identity,publisher:'authorized-maintainer-account',
      ...Object.fromEntries(required.map(fact=>[fact,true]))};
    checkCapture(capture);
    for(const fact of required)for(const value of [false,undefined])
      assert.throws(()=>checkCapture({...capture,[fact]:value}),undefined,fact);
  }
});

test('MID-003: reviewed runtime identity policy stays exact and maintainer exception is absent from consumer contracts',()=>{
  const source=protocolSource(protocol);
  const identityClause=JSON.parse(readFileSync(new URL('../dist/modules/security.json',import.meta.url),'utf8')).contracts.find(c=>c.id==='OOP-scoped-credentials');
  assert.equal('sha256:'+digest(identityClause.semantic_clause),JSON.parse(readFileSync(new URL('./release-review.json',import.meta.url),'utf8')).spans.find(s=>s.id==='OOP-scoped-credentials').content_identity);
  assert.ok(source.includes("effective author and committer name/email MUST equal the machine record's authoritative owner_name and owner_email"));
  assert.ok(!source.includes('agent@oop.ai'));
  const trace=JSON.parse(readFileSync(new URL('./evidence/release-traceability.json',import.meta.url),'utf8'));
  const clauses=trace.clauses.map(item=>JSON.parse(readFileSync(new URL('../'+item.artifact,import.meta.url),'utf8'))
    .contracts.find(clause=>clause.id===item.contract).semantic_clause);
  assert.equal(clauses.join('\n'),source);
  assert.ok(!source.includes('They do not govern a human or AI acting in the role of maintainer'));
  assert.ok(!source.includes('# Rules for the maintainer'));
});


test('FML-038: generated-prompt contract requires all four overview assessments without new runtime authority',()=>{
  assert.match(formalize,/Every generated implementation prompt MUST explicitly require its executor/);
  assert.match(formalize,/Abstract, Vision, Goal and Introduction/);
  assert.match(formalize,/update each section where necessary/);
  assert.match(formalize,/updated with a reason, or unchanged with a reason/);
  assert.match(formalize,/Overview edits MUST NOT introduce, override or weaken runtime obligations/);
  // The reviewed identity rejects omission and weakened scope.
  for(const mutated of [formalize.replace(/Every generated implementation prompt MUST explicitly require its executor[^\n]*\n/,''),
    formalize.replace('Abstract, Vision, Goal and Introduction','Abstract and Vision'),
    formalize.replace('update each section where necessary','leave all sections unchanged')])assert.throws(()=>copyCheck(mutated));
});
