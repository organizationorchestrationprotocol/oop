import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateReport } from './validate-maintainer-report.mjs';

const en = ['Scope and artifacts','Problem','Before example','Proposed change and after example','Source and distribution impact','Pros and cons'];
const it = ['Ambito e artefatti','Problema','Esempio prima','Modifica proposta ed esempio dopo','Impatto su fonte e distribuzione','Pro e contro'];
function fixture({ italian = false, source = 'NOT REQUIRED', distribution = 'NOT REQUIRED', second = false, unresolved = false } = {}) {
  const labels = italian ? it : en;
  const src = italian ? 'Fonte normativa canonica' : 'Canonical normative source';
  const dst = italian ? 'Rigenerazione della distribuzione derivata' : 'Derived distribution regeneration';
  const prop = (number, a, b) => `${number}. **PROP-0${number} — Capture complete reports [F-0${number}; P1; ${number === 2 ? 'SAFE TO DEFER' : 'IMPLEMENTED'}]**
   - **${labels[0]}:** maintainer, documentation, human user; edit the maintainer appendix in PROTOCOL.md and local reports.
   - **${labels[1]}:** Earlier report omitted fields; inspect captured sample F-0${number}.
   - **${labels[2]}:** Illustrative: VERIFY stopped at a verdict without proposals.
   - **${labels[3]}:** Add REPORT; the same VERIFY now includes numbered proposals and final impact.
   - **${labels[4]}:** ${src}: ${a} — scoped runtime assessment; maintainer appendix edit REQUIRED; ${dst}: ${b} — scoped derivation assessment.
   - **${labels[5]}:** Less omission expected; local parser maintenance remains; no measured savings.
`;
  const all = second ? 'PROP-01, PROP-02' : 'PROP-01';
  const needsNotice = source !== 'NOT REQUIRED' || distribution !== 'NOT REQUIRED' || unresolved;
  const notice = needsNotice ? `**Impact ${all}: ${source}; ${distribution}; ${unresolved ? 'UNDETERMINED;' : ''} see independent classifications.**\n\n` : '';
  return `#### ${italian ? 'Modifiche proposte' : 'Proposed Changes'}

${notice}${prop(1, source, distribution)}${second ? '\n' + prop(2, unresolved ? 'UNDETERMINED' : source, distribution) : ''}
#### ${italian ? 'Verdetto finale sull’impatto delle modifiche' : 'Final Change-Impact Verdict'}

- ${italian ? 'Modifica della fonte normativa canonica' : 'Canonical normative source change'}: ${unresolved && source === 'NOT REQUIRED' ? 'UNDETERMINED' : source} — ${all}; ${unresolved ? 'PROP-02 UNDETERMINED;' : ''} scoped runtime assessment.
- ${dst}: ${distribution} — ${all}; scoped derivation assessment.
- Physical PROTOCOL.md: REQUIRED, maintainer appendix only.
`;
}
const valid = fixture();
for (const command of ['ordinary audit','DIAGNOSE','PREPARE','VERIFY','APPLY','REPORT']) {
  test(`${command}: complete captured report passes`, () => assert.equal(validateReport(`Operation: ${command}\n\n${valid}`).status,'PASS'));
  test(`${command}: missing terminal content fails`, () => assert.equal(validateReport(valid.split('#### Final')[0]).status,'FAIL'));
}
for (const italian of [false,true]) test(`localized template ${italian ? 'Italian' : 'English'}`, () => assert.equal(validateReport(fixture({ italian })).status,'PASS'));
for (const label of en) {
  test(`missing ${label}`, () => assert.equal(validateReport(valid.replace(new RegExp(`^.*\\*\\*${label}:.*$`, 'm'), '')).status,'FAIL'));
  test(`empty ${label}`, () => assert.equal(validateReport(valid.replace(new RegExp(`(\\*\\*${label}:\\*\\*).*`), '$1')).status,'FAIL'));
}
const negative = [
 ['duplicate ID', fixture({ second:true }).replaceAll('PROP-02','PROP-01')],
 ['omitted ID', fixture({ second:true }).replaceAll('PROP-02','PROP-03')],
 ['list number gap', fixture({ second:true }).replace('2. **PROP','3. **PROP')],
 ['missing metadata', valid.replace('[F-01; P1; IMPLEMENTED]','[P1]')],
 ['unknown reference', valid + 'See PROP-99.\n'],
 ['aggregate omits proposal', fixture({second:true}).replaceAll('PROP-01, PROP-02','PROP-01')],
 ['bad individual status', valid.replace('Canonical normative source: NOT REQUIRED','Canonical normative source: UNKNOWN')],
 ['missing reason', valid.replace('NOT REQUIRED — scoped runtime assessment','NOT REQUIRED')],
 ['wrong section order', valid.slice(valid.indexOf('#### Final')) + valid.slice(0,valid.indexOf('#### Final'))],
 ['later heading', valid + '\n#### Extra\n'],
 ['unresolved to not required', fixture({source:'UNDETERMINED'}).replace('source change: UNDETERMINED','source change: NOT REQUIRED')],
 ['deferred required ignored', fixture({second:true, distribution:'REQUIRED'}).replace('regeneration: REQUIRED — PROP','regeneration: NOT REQUIRED — PROP')],
 ['hidden unresolved', fixture({source:'REQUIRED',second:true,unresolved:true}).replace('PROP-02 UNDETERMINED;','')],
 ['missing notice', fixture({distribution:'REQUIRED'}).replace(/\*\*Impact[^\n]+\n\n/,'')],
 ['missing verdict opening notice', '#### Verdict\nSafe scoped result.\n\n' + fixture({source:'REQUIRED'})],
 ['missing appendix distinction', valid.replaceAll('maintainer appendix edit REQUIRED','physical edit REQUIRED')],
 ['fake fenced final heading', valid.split('#### Final')[0] + '\n```md\n#### Final Change-Impact Verdict\n```\n'],
 ['unclosed fence', valid + '\n```md\n'],
 ['fenced field cannot fill missing slot', valid.replace('   - **Problem:** Earlier report omitted fields; inspect captured sample F-01.','```md\n   - **Problem:** fake\n```')],
 ['empty document',''],
];
for (const [name, markdown] of negative) test(name, () => assert.equal(validateReport(markdown).status,'FAIL'));
test('fenced heading does not split a valid report', () => assert.equal(validateReport(valid.replace('#### Final','```md\n#### Fake\n~~~\n```\n\n#### Final')).status,'PASS'));
test('independent aggregate statuses and precedence', () => {
 for (const source of ['NOT REQUIRED','UNDETERMINED','REQUIRED']) for (const distribution of ['NOT REQUIRED','UNDETERMINED','REQUIRED']) assert.equal(validateReport(fixture({ source,distribution,second:true })).status,'PASS');
 assert.equal(validateReport(fixture({source:'REQUIRED',second:true,unresolved:true})).status,'PASS');
});
const noChanges = '#### Proposed Changes\n\n1. **No changes proposed** — captured report only; live runtimes not checked.\n\n#### Final Change-Impact Verdict\n\n- Canonical normative source change: NOT REQUIRED — empty package, no readiness claim.\n- Derived distribution regeneration: NOT REQUIRED — empty package.\n';
test('no changes scoped case', () => assert.equal(validateReport(noChanges).status,'PASS'));
test('Italian no changes', () => assert.equal(validateReport(noChanges.replace('Proposed Changes','Modifiche proposte').replace('No changes proposed','Nessuna modifica proposta').replace('Final Change-Impact Verdict','Verdetto finale sull’impatto delle modifiche').replace('Canonical normative source change','Modifica della fonte normativa canonica').replace('Derived distribution regeneration','Rigenerazione della distribuzione derivata')).status,'PASS'));
for (const [name, markdown] of [
 ['absent no-change entry',noChanges.replace(/^1\..*\n/m,'')],
 ['unscoped no-change entry',noChanges.replace(' — captured report only; live runtimes not checked.','')],
 ['no-change missing verdict',noChanges.split('#### Final')[0]],
 ['no-change nonempty impact',noChanges.replace('source change: NOT REQUIRED','source change: REQUIRED')],
]) test(name, () => assert.equal(validateReport(markdown).status,'FAIL'));
test('unsupported language and presentation are not PASS', () => {
 for (const markdown of ['#### Changements proposés\n1. proposition','Plain unknown input','```md\n' + valid + '\n```']) assert.equal(validateReport(markdown).status,'UNSUPPORTED');
});
test('CLI validates read-only file, invalid/unsupported nonzero and missing input', () => {
 const directory = mkdtempSync(join(tmpdir(),'oop-report-'));
 try {
  const path = join(directory,'report.md');
  for (const [markdown, expected] of [[valid,0],[negative[0][1],1],['Unsupported text',2]]) {
   writeFileSync(path,markdown);
   const output = spawnSync(process.execPath,['tools/validate-maintainer-report.mjs',path],{encoding:'utf8'});
   assert.equal(output.status,expected,output.stdout + output.stderr);
   assert.equal(readFileSync(path,'utf8'),markdown);
  }
  assert.equal(spawnSync(process.execPath,['tools/validate-maintainer-report.mjs',join(directory,'absent')]).status,1);
  assert.equal(spawnSync(process.execPath,['tools/validate-maintainer-report.mjs']).status,1);
 } finally { rmSync(directory,{recursive:true,force:true}); }
});

function regionFixture({ italian = false, region, runtime = false, appendix = false, disclosure = appendix } = {}) {
 const labels = italian ? it : en;
 let report = fixture({ italian, source: runtime ? 'REQUIRED' : 'NOT REQUIRED', distribution: runtime ? 'REQUIRED' : 'NOT REQUIRED' });
 const scope = runtime ? 'runtime; PROTOCOL.md G2 rules' : appendix ? 'maintainer; PROTOCOL.md' : 'maintainer; validator.mjs; PROTOCOL.md is evidence only';
 const after = runtime ? 'Change G2 rules: the same authorized action now receives the revised runtime guard.' : 'Correct the validator: the same complete evidence report passes.';
 report = report.replace(/(\*\*(?:Scope and artifacts|Ambito e artefatti):\*\*)[^\n]*/, '$1 ' + scope)
  .replace(/(\*\*(?:Proposed change and after example|Modifica proposta ed esempio dopo):\*\*)[^\n]*/, '$1 ' + after + (appendix ? (italian ? ' Modifica appendice maintainer in PROTOCOL.md.' : ' Edit the maintainer appendix in PROTOCOL.md.') : ''))
  .replace('maintainer appendix edit REQUIRED;', (region ? (italian ? 'Regione modificata: ' : 'Edited region: ') + region + '; ' : '') + (disclosure ? (italian ? 'Modifica fisica appendice maintainer PROTOCOL.md: REQUIRED;' : 'Physical maintainer appendix PROTOCOL.md edit: REQUIRED;') : ''));
 return report;
}
for (const italian of [false, true]) {
 for (const [name, options] of [
  ['runtime G2 in PROTOCOL.md without appendix', {runtime:true}],
  ['explicit runtime role', {runtime:true,region:'runtime-only'}],
  ['appendix-only physical disclosure', {appendix:true,region:'maintainer-appendix-only'}],
  ['evidence-only PROTOCOL.md mention', {region:'reference-only'}],
  ['mixed runtime and appendix', {runtime:true,appendix:true,region:'runtime+maintainer-appendix'}],
 ]) test(name + (italian ? ' Italian' : ' English'), () => assert.equal(validateReport(regionFixture({italian,...options})).status,'PASS'));
 for (const [name, options] of [
  ['undisclosed explicit appendix edit', {appendix:true,disclosure:false}],
  ['undisclosed appendix role', {region:'maintainer-appendix-only'}],
  ['misclassified appendix edit', {appendix:true,region:'reference-only'}],
  ['misclassified mixed edit', {runtime:true,appendix:true,region:'runtime-only'}],
  ['unknown region', {region:'elsewhere'}],
  ['runtime with missing source impact', {region:'runtime-only'}],
  ['appendix-only with runtime impact', {runtime:true,appendix:true,region:'maintainer-appendix-only'}],
 ]) test(name + (italian ? ' Italian' : ' English'), () => assert.equal(validateReport(regionFixture({italian,...options})).status,'FAIL'));
}
test('duplicate region fails', () => assert.equal(validateReport(regionFixture({region:'reference-only; Edited region: runtime-only'})).status,'FAIL'));
