import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {currentStateFindings, currentStateFiles, scanCurrentState, narrativeMarkers, dependencyPins} from './current-state.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
test('REL-HIST-001: every tracked and new candidate file rejects commit identifiers except scoped dependency pins',t=>{
  assert.deepEqual(scanCurrentState(root).filter(f=>f.kind==='commit_identifier'),[]);
  for(const pin of dependencyPins) {
    assert.ok(read(pin.path).includes(pin.id));
    assert.deepEqual(currentStateFindings(pin.path,pin.id),[]);
    assert.equal(currentStateFindings('CHANGELOG.md',pin.id).length,1);
  }
  for(const content of ['a'.repeat(40),'f'.repeat(64),'commit '+ 'b'.repeat(7),'revision: '+ 'c'.repeat(12)])assert.equal(currentStateFindings('unlisted.txt',content)[0]?.kind,'commit_identifier');
  assert.deepEqual(currentStateFindings('evidence.json','sha256:'+ 'e'.repeat(64)),[],'Content identities remain necessary technical facts');
  const scratch=mkdtempSync(join(tmpdir(),'oop-state-'));t.after(()=>rmSync(scratch,{recursive:true,force:true}));
  mkdirSync(join(scratch,'extra'));writeFileSync(join(scratch,'extra/outside-inventory.txt'),'data');
  writeFileSync(join(scratch,'new-candidate.txt'),'data');
  const calls=[];const git=args=>{calls.push(args);return {status:0,stdout:args.includes('--deleted')?'deleted.txt\0':'extra/outside-inventory.txt\0new-candidate.txt\0deleted.txt\0'};};
  assert.deepEqual(currentStateFiles(scratch,git).sort(),['extra/outside-inventory.txt','new-candidate.txt']);
  assert.ok(calls.some(args=>args.includes('--cached') && args.includes('--others')));
  assert.throws(()=>currentStateFiles(scratch,()=>({status:1})),/enumerate/);
  assert.throws(()=>currentStateFiles(scratch,args=>({status:0,stdout:args.includes('--deleted')?'':'missing.txt\0'})),/Missing/);
  assert.ok(currentStateFiles(root).includes('LICENSE'));
});
test('REL-HIST-002: declared narrative markers fail in every file including changelog and guard source',()=>{
  assert.deepEqual(scanCurrentState(root).filter(f=>f.kind==='narrative_marker'),[]);
  for(const path of ['CHANGELOG.md','README.md','extra/file.txt','tools/current-state.mjs','tools/current-state.test.mjs']) {
    for(const marker of narrativeMarkers)assert.ok(currentStateFindings(path,marker.toUpperCase()).some(f=>f.kind==='narrative_marker'),path);
  }
});
test('REL-HIST-003: the distribution carries no change-history fields and a single-step migration',()=>{
  const interfaces=JSON.parse(read('dist/interfaces.json')).enforcement;
  for(const key of ['before','after','prior_engine','consumer_dispositions','mapping'])assert.ok(!(key in interfaces),key);
  const bootstrap=JSON.parse(read('dist/procedures/bootstrap.json'));
  for(const key of ['compatibility','removed_step_ids'])assert.ok(!(key in bootstrap),key);
  const compatibility=JSON.parse(read('dist/migrations/compatibility.json'));
  assert.deepEqual(Object.keys(compatibility).filter(k=>['previous','current','profiles','withdrawals'].includes(k)).sort(),['current','previous']);
  assert.equal((read('CHANGELOG.md').match(/^## /gm)??[]).length,1);
});

test('REL-HIST-004: initial current distribution contracts all start at version one',()=>{
 assert.match(read('LICENSE'),/Apache License\s+Version 2\.0/);
 assert.match(read('NOTICE'),/Apache License, Version 2\.0/);
 const files=dir=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
 const inspect=(value,at)=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){
  if(['format','schema_version','manifest_version','installation_contract'].includes(key)&&typeof item==='number')assert.equal(item,1,at+'.'+key);
  inspect(item,at+'.'+key);
 }};
 for(const file of files('dist').filter(p=>p.endsWith('.json')))inspect(JSON.parse(read(file)),file);
 const compatibility=JSON.parse(read('dist/migrations/compatibility.json')),index=JSON.parse(read('dist/migrations/index.json'));
 assert.equal(compatibility.previous,null);assert.equal(index.step.from,null);assert.equal(compatibility.current.profile_id,'oop-initial-1');
 assert.ok(Object.values(index.scopes).every(s=>s.disposition==='not_required'));assert.equal(JSON.parse(read('dist/interfaces.json')).enforcement.interface,'oop-admission-1');
 assert.equal(exists('tools/evidence/release-acceptance.json'),false);
 function exists(file){return currentStateFiles(root).includes(file);}
});
