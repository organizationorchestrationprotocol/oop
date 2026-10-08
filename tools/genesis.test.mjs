import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { currentCommit, committedInputs, digest, stableContractIDs } from './genesis.mjs';
import { writeEvidence } from './prune-artifacts.mjs';

function repository(t) {
  const root=mkdtempSync(join(tmpdir(),'oop-content-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  return {root};
}
test('REL-GEN-001: current identity needs only HEAD metadata and never requests ancestry',()=>{
  const calls=[];const git=args=>{calls.push(args);return {status:0,stdout:'a'.repeat(40)+'\n'};};
  assert.deepEqual(currentCommit(git),{commit:'a'.repeat(40),mode:'current_content'});
  assert.deepEqual(calls,[['rev-parse','--verify','HEAD^{commit}']]);
});
test('REL-GEN-002: unborn failed and malformed current identity never certify release',()=>{
  for(const r of [{status:1,stdout:''},{status:0,stdout:'true'},{status:0,stdout:'abbreviated'}])assert.throws(()=>currentCommit(()=>r),/Cannot establish/);
});
test('REL-GEN-003: amended and shallow subject metadata have identical current-content acceptance',()=>{
  for(const sha of ['b'.repeat(40),'c'.repeat(40)]) {
    const git=args=>{assert.equal(args[0],'rev-parse');return {status:0,stdout:sha};};
    assert.equal(currentCommit(git).commit,sha);assert.equal(currentCommit(git).mode,'current_content');
  }
});
test('REL-GEN-004: committed content rejects tampered missing and dirty inputs and retains stable IDs',()=>{
  const content='current committed bytes';const read=path=>{if(path!=='source.txt')throw Error('Missing');return content;};
  assert.equal(committedInputs({'source.txt':digest(content)},read),true);
  assert.equal(committedInputs({'source.txt':digest('dirty')},read),false);
  assert.equal(committedInputs({missing:digest(content)},read),false);
  assert.equal(stableContractIDs(['authority','routing'],['routing','authority']),true);
  assert.equal(stableContractIDs(['authority','routing'],['authority','renamed']),false);
  assert.equal(stableContractIDs(['authority'],['authority','authority']),false);
});
test('REL-GEN-005: evidence preflight rejects traversal and partial unsafe plans before mutation', t => {
  const { root } = repository(t); mkdirSync(join(root,'tools/evidence'),{recursive:true});
  const path = 'tools/evidence/current-acceptance.json';writeFileSync(join(root,path),'sentinel');
  for (const bad of ['../outside.json','tools/evidence/../other.json','tools/evidence/unknown.json']) {
    assert.throws(() => writeEvidence(root,[{path,content:'changed'},{path:bad,content:'bad'}]));
    assert.equal(readFileSync(join(root,path),'utf8'),'sentinel');
  }
});
test('REL-GEN-006: linked evidence directory is refused without modifying its target', t => {
  const { root } = repository(t);mkdirSync(join(root,'external'));mkdirSync(join(root,'tools'));
  writeFileSync(join(root,'external/current-acceptance.json'),'sentinel');
  try { symlinkSync(join(root,'external'),join(root,'tools/evidence'),process.platform==='win32'?'junction':'dir'); }
  catch (error) { if (['EPERM','EACCES','ENOSYS'].includes(error.code)) { t.skip(`Link unavailable: ${error.code}`);return; } throw error; }
  assert.throws(() => writeEvidence(root,[{path:'tools/evidence/current-acceptance.json',content:'changed'}]),/Unsafe/);
  assert.equal(readFileSync(join(root,'external/current-acceptance.json'),'utf8'),'sentinel');
});
