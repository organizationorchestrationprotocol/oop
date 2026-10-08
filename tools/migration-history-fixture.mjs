// Maintainer-only disposable migration/publication fixture. No configured remote,
// consumer installation, project operations or source checkout writes.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {subjects} from './acceptance-inputs.mjs';
const checkout=fileURLToPath(new URL('../',import.meta.url));
const base=mkdtempSync(join(tmpdir(),'oop-migration-acceptance-'));
const execute=(cwd,command,args)=>{
  const run=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(run.status,0,run.stderr+'\n'+run.stdout);return run.stdout.trim();
};
const git=(cwd,args)=>execute(cwd,'git',['-c','core.autocrlf=false','-c','commit.gpgsign=false','-c','user.name=Migration Fixture','-c','user.email=fixture@example.invalid',...args]);
try {
  const source=join(base,'source');mkdirSync(source);
  for(const path of subjects(checkout)){mkdirSync(join(source,path,'..'),{recursive:true});writeFileSync(join(source,path),readFileSync(join(checkout,path)));}
  git(source,['init','--initial-branch=main']);
  // Preserve exact LF artifact bytes and platform-specific source bytes; no user Git config changed.
  git(source,['config','core.autocrlf','false']);git(source,['add','.']);git(source,['commit','-m','Synthetic migration acceptance subject']);
  const rootSha=git(source,['rev-parse','HEAD']);
  const clone=join(base,'shallow');git(base,['clone','--depth=1','file:///'+source.replace(/\\/g,'/'),clone]);
  assert.equal(git(clone,['rev-parse','--is-shallow-repository']),'true');
  execute(clone,process.execPath,['tools/accept-release.mjs']);execute(clone,process.execPath,['tools/accept-release.mjs','--check-current']);
  const report=JSON.parse(readFileSync(join(clone,'tools/evidence/current-acceptance.json'),'utf8'));
  assert.equal(report.release_ready,true);assert.equal(report.comparative_regression_ready,false);assert.equal(report.efficiency_comparison.historical_baseline.status,'not_verified');
  assert.equal(report.observation_summary.passed,report.observation_summary.total);
  git(clone,['commit','--amend','-m','Synthetic amended subject']);const amendedSha=git(clone,['rev-parse','HEAD']);assert.notEqual(amendedSha,rootSha);
  // A changed HEAD invalidates exact-revision evidence even when package bytes match.
  const stale=spawnSync(process.execPath,['tools/accept-release.mjs','--check-current'],{cwd:clone,encoding:'utf8'});assert.notEqual(stale.status,0);
  process.stdout.write(JSON.stringify({scope:'disposable shallow migration/publication fixture',root_commit:rootSha,amended_commit:amendedSha,
    current_release_ready:report.release_ready,producer_observations:report.observation_summary,maintainer_regressions:report.maintainer_regression_summary,
    comparison:'NOT VERIFIED; no independent prior bundle',amended_evidence:'stale evidence correctly refused',publication:'not_performed',installed_runtime:'not_performed'})+'\n');
} finally {
  const target=resolve(base),boundary=relative(resolve(tmpdir()),target);
  if(boundary.startsWith('..')||isAbsolute(boundary)||!boundary.startsWith('oop-migration-acceptance-'))throw Error('Unsafe fixture cleanup');
  rmSync(target,{recursive:true,force:true});
}
