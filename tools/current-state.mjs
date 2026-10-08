// Producer-only current-state guard. Marker fragments keep the declaration itself
// subject to exactly the same scan as every deliverable, including the changelog.
import {spawnSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
export const dependencyPins = [
  {path:'.github/workflows/producer-tests.yml',id:'11d5960a326750d5838078e36cf38b85af677262'},
  {path:'.github/workflows/producer-tests.yml',id:'949feb2413d6458794dcd2491c4babbbce0c15c1'},
];
export const narrativeMarkers = [
  ['form','erly'],['now-','superseded'],['this ','candidate'],['previously ','returned'],['Genesis ','acceptance'],
  ['removed ','identities ('],['ENTRY-INSTRUCTION','-02'],['BOOT','-02'],['BOOT','-09'],['ENTRY','-02'],
  ['frozen ','preimage'],['historical delivery/','display corrections'],['removed redundant ','locator'],
].map(parts=>parts.join(''));
export function currentStateFindings(path, content) {
  const ids=[...content.matchAll(/(?<![\w:])[a-f0-9]{40}(?![a-f0-9])|(?<![\w:])[a-f0-9]{64}(?![a-f0-9])/gi)]
    .map(m=>m[0]);
  // Short object names are only identifiable as commits in an explicit Git context.
  ids.push(...[...content.matchAll(/\b(?:commit|revision|sha|HEAD)\s*(?:[:=]\s*|\s+)[`"']?([a-f0-9]{7,64})\b/gi)].map(m=>m[1]));
  const findings=[...new Set(ids)].filter(id=>!dependencyPins.some(pin=>[pin.path, 'tools/current-state.mjs', 'tools/maintainer-workflow.test.mjs'].includes(path) && pin.id===id))
    .map(id=>({path,kind:'commit_identifier',value:id}));
  for(const marker of narrativeMarkers)if(content.toLowerCase().includes(marker.toLowerCase()))findings.push({path,kind:'narrative_marker',value:marker});
  return findings;
}
export function currentStateFiles(root, git = args => spawnSync('git',args,{cwd:root,encoding:'utf8'})) {
  // Include tracked files outside acceptance subjects, and new candidate files.
  // A missing indexed path is permitted only when Git confirms its deletion.
  const run=args=>{const r=git(args);if(r.status!==0)throw Error('Cannot enumerate current files');return r.stdout.split('\0').filter(Boolean);};
  const removed=new Set(run(['ls-files','--deleted','-z']));
  return [...new Set(run(['ls-files','--cached','--others','--exclude-standard','-z']))].filter(path=>{
    if(existsSync(join(root,path)))return true;
    if(removed.has(path))return false;
    throw Error('Missing current file: '+path);
  });
}
export const scanCurrentState = root => currentStateFiles(root).flatMap(path=>currentStateFindings(path,readFileSync(join(root,path),'utf8')));
