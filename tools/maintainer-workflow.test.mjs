// Bounded synthetic capture checks, NOT an implementation engine or chat interceptor.
// Assertions check supplied evidence/trace consistency, never authenticate real effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateReport } from './validate-maintainer-report.mjs';

const protocol=readFileSync(new URL('../PROTOCOL.md',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const apply=protocol.split('### APPLY\n')[1]?.split('### REPORT\n')[0];
const directive=apply?.match(/^> (AFTER completing.*)$/m)?.[1];
const report=`## Modifiche proposte

1. **Nessuna modifica proposta** — fixture limitata; effetti reali non verificati.

## Verdetto finale sull’impatto delle modifiche

- Modifica della fonte normativa canonica: NOT REQUIRED — nessuna proposta ulteriore.
- Rigenerazione della distribuzione derivata: NOT REQUIRED — nessuna proposta ulteriore.
`;
const payloadReport=`## Proposed Changes

1. **PROP-01 — Implement Y with K [F-01; P2; APPROVED]**
   - **Scope and artifacts:** maintainer; edit the maintainer appendix in PROTOCOL.md.
   - **Problem:** The synthetic approved workflow needs local write guidance.
   - **Before example:** Illustrative: implementation has no explicit local commit boundary.
   - **Proposed change and after example:** Implement Y with check K; local changes now remain uncommitted.
   - **Source and distribution impact:** Canonical normative source: NOT REQUIRED — procedure only; maintainer appendix edit REQUIRED; Derived distribution regeneration: NOT REQUIRED — no runtime contract change.
   - **Pros and cons:** Clearer bounded execution; longer maintainer instructions.

## Final Change-Impact Verdict

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
];
function fixture(command='APPLY',path='local') {
  const source=structuredClone(originals);
  const dossier=source.filter(x=>x.status!=='irrelevant-confidential').map(x=>`[${x.id}: ${x.status}]\n${x.text}`).join('\n\n');
  const prompt=`<!-- Original decision dossier -->\n${dossier}\n<!-- End original decision dossier -->\n\nUse the original decision dossier for requirements, exclusions and acceptance. Implement approved Y and K only.\n\n${payloadReport}${command==='APPLY'?'\n'+directive:''}`;
  return {command,path,source,prompt,worklist:['Y','K'],downloadable:command==='PREPARE',operativeLanguage:'en',outcomeLanguage:'it',
    reinvocation:false,equivalentExecution:true,complete:true,blocker:null,
    main:'a'.repeat(40),base:'a'.repeat(40),branch:'codex/fixture',verifyTarget:path==='local'?'working-tree':'codex/fixture',
    events:command==='PREPARE'?[]:path==='local'?['discover','edit','checks','VERIFY','REPORT']:['discover','branch','edit','readback','checks','commit','push','remote-readback','VERIFY','REPORT'],
    normative:{available:true,changes:[],examples:[]},
    output:'## Modifiche alla fonte canonica\n\nNessuna modifica normativa canonica runtime. Appendice maintainer e distribuzione soltanto.\n\n'+report};
}
function check(c) {
  assert.ok(c.prompt.startsWith('<!-- Original decision dossier -->\n'));
  const end=c.prompt.indexOf('<!-- End original decision dossier -->');
  assert.ok(end>0);
  const dossier=c.prompt.slice(0,end);
  let previous=-1;
  for(const original of c.source) {
    if(original.status==='irrelevant-confidential'){assert.ok(!c.prompt.includes(original.text));continue;}
    assert.ok(dossier.includes(`[${original.id}: ${original.status}]`));
    const text=original.text??`Original unavailable: ${original.id}`;
    const at=dossier.indexOf(text);
    assert.ok(at>previous,'Source fidelity and ordering');previous=at;
  }
  assert.deepEqual(c.worklist,['Y','K']);
  assert.equal(validateReport(c.prompt.slice(end)).status,'PASS');
  assert.equal(c.operativeLanguage,'en'); // Declared language only; no language inference.
  assert.equal(c.outcomeLanguage,'it');
  assert.equal(validateReport(c.output).status,'PASS');
  if(c.command==='PREPARE'){assert.equal(c.downloadable,true);assert.deepEqual(c.events,[]);return;}
  assert.equal(c.downloadable,false);
  assert.ok(c.prompt.endsWith(directive),'VERIFY must be the literal final directive');
  if(!c.complete){assert.ok(c.blocker);assert.ok(!c.events.includes('completed'));return;}
  assert.ok(c.reinvocation||c.equivalentExecution);
  assert.deepEqual(c.events,c.path==='local'?['discover','edit','checks','VERIFY','REPORT']:['discover','branch','edit','readback','checks','commit','push','remote-readback','VERIFY','REPORT']);
  assert.equal(c.verifyTarget,c.path==='local'?'working-tree':c.branch);
  if(c.path==='api'){assert.equal(c.base,c.main);assert.notEqual(c.branch,'main');}
  assert.match(c.output,/^## Modifiche alla fonte canonica$/m);
  const n=c.normative;
  if(!n.available){assert.match(c.output,/NOT VERIFIED/);assert.equal(n.examples.length,0);return;}
  if(!n.changes.length){assert.match(c.output,/Nessuna modifica normativa canonica runtime/);assert.equal(n.examples.length,0);return;}
  assert.equal(n.examples.length,2);
  for(const change of n.changes){assert.ok(change.before&&change.after&&change.ref);assert.ok(['prompt','independent','unknown'].includes(change.attribution));assert.ok(c.output.includes(change.ref));}
  for(const example of n.examples){assert.ok(n.changes.some(x=>x.id===example.change));assert.ok(example.before&&example.after);assert.ok(c.output.includes(example.before)&&c.output.includes(example.after));}
  assert.equal((c.output.match(/Esempio [12] — Prima:/g)||[]).length,2);
}

test('WF-001: commands are unique ordered maintainer-only definitions and directive is present',()=>{
  assert.ok(directive?.includes('latest applicable OOP VERIFY'));
  const appendix=protocol.split('# Rules for the maintainer\n')[1];
  const definitions=[...appendix.matchAll(/^### (DIAGNOSE|PREPARE|VERIFY|APPLY|REPORT)$/gm)].map(x=>x[1]);
  assert.deepEqual(definitions,['DIAGNOSE','PREPARE','VERIFY','APPLY','REPORT']);
  assert.ok(!protocol.split('# Rules for the maintainer\n')[0].includes('### APPLY'));
});
test('WF-002: Italian dossier and zero-change appendix-only/derived-only captures',()=>{
  for(const description of ['Appendice maintainer soltanto.','Distribuzione derivata soltanto.']){
    const c=fixture();c.output=c.output.replace('Appendice maintainer e distribuzione soltanto.',description);check(c);
  }
});
test('WF-003: ordinary PREPARE captures a download without applying changes',()=>check(fixture('PREPARE')));
test('WF-004: API capture verifies published branch with exact main base',()=>check(fixture('APPLY','api')));
test('WF-005: missing original is disclosed instead of reconstructed',()=>{
  const c=fixture();c.prompt=c.prompt.replace(c.source[0].text,'Original unavailable: analysis');c.source[0].text=null;check(c);
});
test('WF-006: unavailable execution remains explicitly incomplete',()=>{
  const c=fixture();c.complete=false;c.equivalentExecution=false;c.events=['discover'];c.blocker='No authorized write tools';check(c);
});
test('WF-007: unavailable baseline is NOT VERIFIED without invented examples',()=>{
  const c=fixture();c.normative.available=false;c.output=c.output.replace('Nessuna modifica normativa canonica runtime.','NOT VERIFIED: baseline unavailable.');check(c);
});
test('WF-008: exactly two examples bind changed clauses and independent attribution',()=>{
  const c=fixture();c.normative={available:true,changes:[{id:'a',before:'old a',after:'new a',ref:'baseline:a -> current:a',attribution:'prompt'},{id:'b',before:'old b',after:'new b',ref:'baseline:b -> current:b',attribution:'independent'}],examples:[{change:'a',before:'old a',after:'new a'},{change:'b',before:'old b',after:'new b'}]};
  c.output=c.output.replace('Nessuna modifica normativa canonica runtime.', 'baseline:a -> current:a; baseline:b -> current:b.\n\nEsempio 1 — Prima: old a; Dopo: new a.\nEsempio 2 — Prima: old b; Dopo: new b.');check(c);
  c.normative.examples.push(c.normative.examples[0]);assert.throws(()=>check(c));
});
for(const [index,[label,mutate]] of [
  ['summary substitutes original',c=>{c.prompt=c.prompt.replace(c.source[0].text,'Short English summary');}],
  ['excluded work reactivated',c=>{c.worklist.push('X');}],
  ['private irrelevant content leaked',c=>{c.prompt=c.prompt.replace('<!-- End original decision dossier -->',c.source.find(x=>x.id==='private').text+'\n<!-- End original decision dossier -->');}],
  ['APPLY downloadable artifact',c=>{c.downloadable=true;}],
  ['no actual execution trace',c=>{c.events=[];}],
  ['local commit',c=>{c.events.splice(3,0,'commit');}],
  ['local push',c=>{c.events.splice(3,0,'push');}],
  ['VERIFY targets main instead of working tree',c=>{c.verifyTarget='main';}],
  ['operation follows VERIFY directive',c=>{c.prompt+='\nPublish a release.';}],
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
