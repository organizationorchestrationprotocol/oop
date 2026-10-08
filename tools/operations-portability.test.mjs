import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {operationsPortability} from './operations-portability.mjs';

const read=relative=>fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const json=relative=>JSON.parse(read(relative));
const spec=operationsPortability(),profile=spec.backend_profiles[0];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
  const parent=fs.realpathSync.native(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'oop-text-policy-'));
  t.after(()=>{const target=path.resolve(root);assert.equal(path.dirname(target),parent);assert.ok(path.basename(target).startsWith('oop-text-policy-'));fs.rmSync(target,{recursive:true,force:true});});
  const git=(...args)=>{const result=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout;};
  const put=(name,bytes)=>fs.writeFileSync(path.join(root,name),bytes);
  const get=name=>fs.readFileSync(path.join(root,name));
  const checkout=(names,autocrlf)=>{for(const name of names)fs.unlinkSync(path.join(root,name));git('-c','core.autocrlf='+autocrlf,'checkout-index','--all','--force');};
  git('init','--quiet');
  return {root,git,put,get,checkout};
}

test('REL-PKG-037: portable text obligations are delivered with discoverable backend and reconciliation guidance',()=>{
  const source=read('PROTOCOL.md'),module=json('dist/modules/operations.json'),entry=json('dist/entry.json');
  const distributed=json('dist/procedures/operations-portability.json');
  for(const id of spec.requirements)assert.ok(source.includes(id)&&module.contracts.some(c=>c.semantic_clause.includes(id)));
  const {source_binding,...body}=distributed;assert.deepEqual(body,spec);assert.deepEqual(source_binding,entry.source_binding);
  assert.equal(entry.procedures.operations_portability,'procedures/operations-portability.json');
  assert.equal(json('dist/details/operations.json').portability_procedure,'../procedures/operations-portability.json');
  const boot=json('dist/procedures/bootstrap.json');
  const step=boot.steps.find(s=>s.id==='BOOT-09');assert.equal(step.portability.procedure,'operations-portability.json');
  assert.equal(step.portability.synthetic_consumer_trials,false);
  assert.equal(json('dist/procedures/lifecycle.json').routes.adoption.operations_portability,'operations-portability.json');
  assert.equal(distributed.reconciliation.owner,'organization');assert.equal(distributed.reconciliation.independent_runtime_adoption,true);
  assert.equal(profile.backend,'git');assert.equal(profile.default_line,'* text=auto eol=lf');assert.ok(profile.when.startsWith('Only when'));
});

test('REL-PKG-038: selected backend materializes managed LF text independently of conversion defaults',t=>{
  const f=fixture(t),text='One\nTwo\n';f.put(profile.file,profile.default_line+'\n');f.put('text.md',text);
  f.git('-c','core.autocrlf=false','add',profile.file,'text.md');
  for(const mode of ['true','false']){f.checkout(['text.md'],mode);assert.equal(f.get('text.md').toString(),text);}
  const attrs=f.git('check-attr','text','eol','--','text.md');assert.ok(attrs.includes('text: auto')&&attrs.includes('eol: lf'));
});

test('REL-PKG-039: protected original and binary bytes survive policy materialization',t=>{
  const f=fixture(t),original=Buffer.from('Exact\r\nEvidence\r\n'),binary=Buffer.from([0,13,10,255]);
  f.put(profile.file,profile.default_line+'\noriginal.dat -text\n');f.put('original.dat',original);f.put('blob.bin',binary);
  const before=[sha(original),sha(binary)];f.git('-c','core.autocrlf=false','add',profile.file,'original.dat','blob.bin');
  for(const mode of ['true','false']){f.checkout(['original.dat','blob.bin'],mode);assert.deepEqual([sha(f.get('original.dat')),sha(f.get('blob.bin'))],before);}
  assert.ok(f.git('check-attr','text','--','original.dat').includes('text: unset'));
});

test('REL-PKG-040: effective nested and repository-local overrides are detected without global mutation',t=>{
  const f=fixture(t);f.put(profile.file,profile.default_line+'\n');f.put('text.md','Text\n');
  fs.mkdirSync(path.join(f.root,'nested'));f.put('nested/.gitattributes','*.md text eol=crlf\n');f.put('nested/text.md','Text\n');
  f.git('-c','core.autocrlf=false','add',profile.file,'text.md','nested');
  assert.ok(f.git('check-attr','eol','--','text.md').includes('eol: lf'));
  assert.ok(f.git('check-attr','eol','--','nested/text.md').includes('eol: crlf'));
  f.put('.git/info/attributes','text.md text eol=crlf\n');
  assert.ok(f.git('check-attr','eol','--','text.md').includes('eol: crlf'));
  f.checkout(['text.md','nested/text.md'],'false');assert.ok(f.get('text.md').includes(Buffer.from('\r\n')));
  assert.ok(spec.sequence.indexOf('read_versioned_policy_and_relevant_effective_controls')<spec.sequence.indexOf('publish_conditionally_when_authorized'));
});

test('REL-PKG-041: scoped legacy normalization preserves unrelated evidence and is idempotent',t=>{
  const f=fixture(t),legacy='Legacy\r\nText\r\n',evidence='Original\r\nBytes\r\n';
  f.put('legacy.md',legacy);f.put('evidence.dat',evidence);f.git('-c','core.autocrlf=false','add','legacy.md','evidence.dat');
  f.put(profile.file,profile.default_line+'\nevidence.dat -text\n');f.git('add',profile.file);
  assert.ok(f.git('show',':legacy.md').includes('\r\n'));
  f.git('-c','core.autocrlf=false','add','--renormalize','legacy.md');
  assert.equal(f.git('show',':legacy.md'),'Legacy\nText\n');assert.equal(f.git('show',':evidence.dat'),evidence);
  const tree=f.git('write-tree');f.git('-c','core.autocrlf=true','add','--renormalize','legacy.md');assert.equal(f.git('write-tree'),tree);
  assert.equal(f.get('evidence.dat').toString(),evidence);
});

test('REL-PKG-042: authority and unknown-state rules remain source-bound declarations rather than consumer certification',()=>{
  const source=read('PROTOCOL.md');
  assert.ok(source.includes('Missing authority or unknown required facts blocks affected publication'));
  assert.ok(spec.authority.includes('grants none'));assert.equal(spec.sequence[0],'resolve_owned_repository_and_authority');
  assert.ok(spec.reconciliation.never.includes('history rewrite'));
  assert.ok(spec.bootstrap.basis.includes('no artificial writes'));
  assert.ok(spec.reconciliation.failure.includes('continue independent safe work'));
  assert.ok(spec.limits.includes('not total portability'));
  // These checks bind instructions, not an installed publisher or model behavior.
  assert.ok(!Object.hasOwn(json('dist/interfaces.json').enforcement,'operations_portability_gate'));
});
