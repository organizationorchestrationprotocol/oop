// Producer reference implementation of the abstract selection/context contract.
// It performs local payload reads only, never effects, adoption or authority verification.
import { readFileSync } from 'node:fs';
import {createRequire} from 'node:module';
import { route, assemble, closure } from './reference-engine.mjs';
const distribution = new URL('../dist/',import.meta.url);
export const readJSON = path => JSON.parse(readFileSync(new URL(path,distribution),'utf8'));
export const entry = readJSON('entry.json');
export const routing = readJSON(entry.selector);
const engine=createRequire(import.meta.url)('../dist/oop-enforce.js');
export const migrationContext=engine.config.migration_context;
export const migrationContextBytes=Buffer.byteLength(JSON.stringify(migrationContext));
export function select(facts,index=routing) {
  const normalized={...facts,request:[...(facts.request??[]),'interaction']};
  return route(index.modules,index,normalized);
}
export function contextSession(workspace,runtime,identity) {
  if (![workspace,runtime,identity].every(x=>typeof x==='string'&&x)) throw new Error('Explicit session scope required');
  const loaded = new Map();
  let bytes=0,reads=0;
  return {
    scope:{workspace,runtime,identity},
    metrics(){return {reads,loaded_bytes:bytes};},
    load(selection) {
      const ordered=closure(routing.modules,selection.modules);
      for (const id of ordered) {
        if (loaded.has(id)) continue;
        const path=routing.modules.find(x=>x.id===id).context;
        const text=readFileSync(new URL(path,distribution),'utf8');
        loaded.set(id,JSON.parse(text)); bytes+=Buffer.byteLength(text); reads++;
      }
      const governing=assemble([...loaded.values()].map(item=>({...item,
        dependencies:routing.modules.find(x=>x.id===item.id).dependencies})),ordered);
      return {contracts:governing,classification_resolved:selection.classification_resolved,
        ...(ordered.includes('migration-distribution')?{migration_context:migrationContext}:{}),
        authority_granted:false,reads,loaded_bytes:bytes,modules:ordered};
    },
    loseContext(){loaded.clear();},
    retire(selection){const keep=new Set(closure(routing.modules,selection.modules));for(const id of loaded.keys())if(!keep.has(id))loaded.delete(id);},
  };
}
