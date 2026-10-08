// AGN-07 producer check. Structural exceptions supplement semantic review.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixturePath='tools/fixtures/neutrality-terms.json';
const fixture=JSON.parse(readFileSync(new URL('../'+fixturePath,import.meta.url),'utf8'));
const escape=s=>s.replace(/[{}.*+?^$()|[\]\\]/g,'\\$&');
const glob=s=>new RegExp('^'+s.split('*').map(escape).join('[^/]*')+'$');
const applies=(e,path)=>e.files.some(p=>glob(p).test(path));
const mask=(text,start,end)=>text.slice(0,start)+' '.repeat(end-start)+text.slice(end);

// Only quoted tokens outside comments qualify as executable identifiers.
// This bounded lexer supplies no semantic authority.
function literals(text){
  const ranges=[];
  for(let i=0;i<text.length;i++){
    if(text.startsWith('//',i)){const end=text.indexOf('\n',i);i=end<0?text.length:end;continue;}
    if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);i=end<0?text.length:end+1;continue;}
    const quote=text[i];if(!["'",'"',String.fromCharCode(96)].includes(quote))continue;
    const start=i;for(i++;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]===quote)break;}
    if(i<text.length)ranges.push({start,end:i+1,value:text.slice(start+1,i)});
  }
  return ranges;
}
export function findings(path,content){
  let text=content;const problems=[];
  for(const locator of fixture.canonical_locators)text=text.split(locator).join(' '.repeat(locator.length));
  const begin='<!-- OOP-EXAMPLE-BEGIN -->',end='<!-- OOP-EXAMPLE-END -->';
  const blocks=new RegExp(escape(begin)+'\\r?\\n([\\s\\S]*?)\\r?\\n'+escape(end),'g');
  const conditional=body=>!body.includes(begin)&&!body.includes(end)&&
    /^(?:For example,|\*\*Conditional example:\*\*)/.test(body)&&/\b(?:if|when|suppose|can)\b/i.test(body);
  if(['README.md','examples.md','PROTOCOL.md'].includes(path)){
    for(const m of text.matchAll(blocks)){
      if(conditional(m[1].trim()))text=mask(text,m.index,m.index+m[0].length);
    }
    if(text.includes(begin)||text.includes(end))problems.push({path,kind:'invalid_example_boundary'});
  }
  // Generated semantic clauses preserve the canonical example delimiters.
  if(/^dist\/modules\/[^/]+\.json$/.test(path)){
    text=text.replace(/("semantic_clause"\s*:\s*)("(?:[^"\\]|\\.)*")/g,(_match,key,value)=>{
      const clause=JSON.parse(value);
      for(const m of clause.matchAll(blocks)){
        if(!conditional(m[1].trim()))continue;
        const encoded=JSON.stringify(m[0]).slice(1,-1);
        value=value.replace(encoded,' '.repeat(encoded.length));
      }
      return key+value;
    });
    if(text.includes(begin)||text.includes(end))problems.push({path,kind:'invalid_example_boundary'});
  }
  const allowed=fixture.literal_exceptions.filter(e=>applies(e,path));
  for(const token of literals(text))if(allowed.some(e=>e.values.includes(token.value)))text=mask(text,token.start,token.end);
  for(const e of fixture.fragment_exceptions.filter(e=>applies(e,path)))for(const value of e.values)text=text.split(value).join(' '.repeat(value.length));
  for(const term of fixture.terms){
    const boundary=fixture.mechanism_terms.includes(term)?'A-Za-z0-9':'A-Za-z0-9_';
    const count=(text.match(new RegExp('(?<!['+boundary+'])'+escape(term)+'(?!['+boundary+'])','gi'))??[]).length;
    if(count)problems.push({path,term,count});
  }
  if (path==='PROTOCOL.md' || /^dist\/.*\.json$/.test(path)) {
    for (const term of ['Git','SSH','JavaScript','Ed25519','OAuth']) {
      const count = (text.match(new RegExp('\\b'+term+'\\b','gi'))??[]).length;
      if (count) problems.push({path,term,count});
    }
  }
  return problems;
}
const files=()=>{
  const r=spawnSync('git',['ls-files','-co','--exclude-standard','-z'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0);
  return [...new Set(r.stdout.split('\0').filter(Boolean))].filter(p=>p!==fixturePath);
};
test('REL-GEN-007: repository neutrality uses exact justified exceptions and no file-wide term exemption',()=>{
  assert.deepEqual(files().flatMap(p=>findings(p,readFileSync(new URL('../'+p,import.meta.url),'utf8'))),[]);
  assert.equal(fixture.exceptions,undefined);
  for(const e of [...fixture.literal_exceptions,...fixture.fragment_exceptions]){
    assert.ok(e.reason&&e.files.length&&e.values.length);assert.ok(e.values.every(v=>v.length>3&&!fixture.terms.includes(v)));
    assert.ok(e.files.every(p=>!/:\d+$/.test(p)));
  }
  assert.deepEqual(findings('README.md',fixture.canonical_locators[0]),[]);
  assert.ok(!files().some(p=>p.startsWith('dist/')&&p.includes('neutrality')));
  const r=spawnSync('git',['grep','-l','neutrality-terms','--','dist'],{cwd:root,encoding:'utf8'});assert.equal(r.stdout,'');
});
test('REL-GEN-008: necessary code identifiers never exempt product requirements or comments',()=>{
  const {shell,runtime,external_literal}=fixture.probes;
  assert.ok(findings('tools/runtime-action.cjs','// This runtime requires '+shell+'.').some(f=>f.term===shell));
  assert.ok(findings('tools/runtime-action.cjs','// runs on '+runtime).some(f=>f.term===runtime));
  assert.deepEqual(findings('tools/accept-release.mjs',"import x from '"+external_literal+"';"),[]);
  assert.ok(findings('tools/accept-release.mjs',"// require '"+external_literal+"'").length>0);
  assert.ok(findings('PROTOCOL.md','Every runtime must install a startup '+fixture.mechanism_terms[0]+'.').length>0);
  assert.ok(findings('tools/runtime-action.cjs',"const x='"+shell+" is required';").length>0);
});
test('REL-GEN-009: concrete examples are bounded conditional blocks in bounded source and documentation examples',()=>{
  const term=fixture.probes.shell,body='For example, if a runtime exposes this optional facility, it can use '+term+'.';
  const block='<!-- OOP-EXAMPLE-BEGIN -->\n'+body+'\n<!-- OOP-EXAMPLE-END -->';
  for(const p of ['README.md','examples.md','PROTOCOL.md']){
    assert.deepEqual(findings(p,block),[]);assert.ok(findings(p,body).length>0);
    assert.ok(findings(p,block+'\nOOP requires '+term+'.').length>0);
    assert.ok(findings(p,'<!-- OOP-EXAMPLE-BEGIN -->\n'+body).some(f=>f.kind==='invalid_example_boundary'));
  }
  assert.deepEqual(findings('dist/modules/core.json',JSON.stringify({semantic_clause:block})),[]);
  assert.ok(findings('dist/modules/core.json',JSON.stringify({title:block})).length>0);
  assert.ok(findings('tools/runtime-action.cjs',block).length>0);
});
