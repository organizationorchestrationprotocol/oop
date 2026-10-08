import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderNativePointer, matchesNativePointer, pointerPath, pointerTemplate} from './native-instruction-pointer.mjs';
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
    {position:'prefix',text:'<!-- OOP activation block: begin -->\n',documentation_ref:'https://host.invalid/docs'}]) assert.throws(()=>renderNativePointer({...options,variation}),/R22/);
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
