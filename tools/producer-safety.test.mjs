import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, existsSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { subjects } from './acceptance-inputs.mjs';
const checkout = fileURLToPath(new URL('../', import.meta.url));
function sandbox(t) {
  const base = mkdtempSync(join(tmpdir(), 'oop-safety-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'checkout');
  mkdirSync(root);
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: checkout, encoding: 'utf8' });
  assert.equal(tracked.status, 0);
  for (const path of new Set([...tracked.stdout.split('\0').filter(Boolean), ...subjects(checkout), 'tools/producer-safety.test.mjs', 'tools/acceptance-inputs.mjs', '.github/workflows/producer-tests.yml'])) {
    if (!existsSync(join(checkout, path))) continue;
    mkdirSync(join(root, path, '..'), { recursive: true });
    cpSync(join(checkout, path), join(root, path));
  }
  cpSync(join(checkout, '.git'), join(root, '.git'), { recursive: true });
  return { root, base };
}
const run = (root, script, args = []) => spawnSync(process.execPath, [`tools/${script}`, ...args], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
function bytes(root, directory = '') {
  return Object.fromEntries(readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (path === '.git') return [];
    if (entry.isSymbolicLink()) return [[path, `link:${readlinkSync(join(root, path))}`]];
    return entry.isDirectory() ? [[`${path}/`, 'directory'], ...Object.entries(bytes(root, path))] : [[path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]];
  }));
}
function link(t, target, path, type) {
  try { symlinkSync(target, path, type); return true; }
  catch (error) {
    if (!['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) throw error;
    t.skip(`Symlink creation unavailable: ${error.code}`); return false;
  }
}
function refused(root, base) {
  const before = bytes(root), external = bytes(base, 'external');
  const mode = JSON.parse(readFileSync(join(root,'dist/entry.json'),'utf8')).status === 'prepared_worktree_candidate' ? ['--prepare'] : [];
  const result = run(root, 'generate-release.mjs', mode);
  assert.notEqual(result.status, 0, result.stdout);
  assert.deepEqual(bytes(root), before, result.stderr);
  assert.deepEqual(bytes(base, 'external'), external);
}
test('REL-TOOL-005: check-current binds material inputs and ignores unrelated files without writes', async t => {
  const { root } = sandbox(t);
  const { subjects, identify } = await import(new URL('./acceptance-inputs.mjs', import.meta.url));
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  // Equivalent freshness fixture: the exact subject/commit binding consumed by the real command.
  // Full acceptance is exercised separately; no historical report is requalified here.
  const report = { release_ready: true, evaluated_checkout: { commit }, identities: identify(root, subjects(root)) };
  const path = join(root, 'tools/evidence/current-acceptance.json');
  writeFileSync(path, JSON.stringify(report));
  writeFileSync(join(root, 'tools/evidence/current-tests.tap'), 'unchanged evidence sentinel\n');
  const gitBefore = bytes(root, '.git');
  assert.equal(run(root, 'accept-release.mjs', ['--check-current']).status, 0);
  for (const bad of [{...report, release_ready:false}, {...report, evaluated_checkout:{commit:'0'.repeat(40)}}, {release_ready:true,source_snapshot_commit:commit,identities:report.identities}]) {
    writeFileSync(path, JSON.stringify(bad));
    const before = bytes(root);
    assert.notEqual(run(root, 'accept-release.mjs', ['--check-current']).status, 0);
    assert.deepEqual(bytes(root), before);
  }
  writeFileSync(path, JSON.stringify(report));
  for (const input of ['tools/genesis.mjs', 'tools/genesis.test.mjs', 'tools/organizational-scenarios.test.mjs', 'tools/fixtures/organizational-scenarios.json', 'tools/fixtures/catalog.json', 'tools/fixtures/procedures.json', 'tools/schema-profile.mjs', 'tools/fixtures/operations-access.json']) {
    const original = readFileSync(join(root, input));
    writeFileSync(join(root, input), Buffer.concat([original, Buffer.from('\n')]));
    const before = bytes(root);
    assert.notEqual(run(root, 'accept-release.mjs', ['--check-current']).status, 0, input);
    assert.deepEqual(bytes(root), before);
    writeFileSync(join(root, input), original);
    assert.equal(run(root, 'accept-release.mjs', ['--check-current']).status, 0, input);
  }
  writeFileSync(join(root, 'unrelated.txt'), 'not a subject');
  const before = bytes(root);
  assert.equal(run(root, 'accept-release.mjs', ['--check-current']).status, 0);
  assert.deepEqual(bytes(root), before);
  assert.deepEqual(bytes(root, '.git'), gitBefore);
});
test('REL-TOOL-006: generated file symlink cannot overwrite an external sentinel', t => {
  const { root, base } = sandbox(t);
  mkdirSync(join(base, 'external')); writeFileSync(join(base, 'external/sentinel'), 'sentinel');
  unlinkSync(join(root, 'dist/modules/core.json'));
  if (!link(t, join(base, 'external/sentinel'), join(root, 'dist/modules/core.json'), 'file')) return;
  refused(root, base);
});
test('REL-TOOL-007: module and detail directory links fail before any mutation', t => {
  for (const directory of ['modules', 'details']) {
    const { root, base } = sandbox(t);
    mkdirSync(join(base, 'external')); writeFileSync(join(base, 'external/sentinel'), 'sentinel');
    rmSync(join(root, 'dist', directory), { recursive: true });
    if (!link(t, join(base, 'external'), join(root, 'dist', directory), process.platform === 'win32' ? 'junction' : 'dir')) return;
    refused(root, base);
  }
});
test('REL-TOOL-008: evidence directory link prevents all earlier distribution writes', t => {
  const { root, base } = sandbox(t);
  mkdirSync(join(base, 'external')); writeFileSync(join(base, 'external/sentinel'), 'sentinel');
  rmSync(join(root, 'tools/evidence'), { recursive: true });
  if (!link(t, join(base, 'external'), join(root, 'tools/evidence'), process.platform === 'win32' ? 'junction' : 'dir')) return;
  refused(root, base);
});
test('REL-TOOL-009: unsafe orphan JSON blocks writes and all cleanup', t => {
  const { root, base } = sandbox(t);
  mkdirSync(join(base, 'external')); writeFileSync(join(base, 'external/sentinel'), 'sentinel');
  writeFileSync(join(root, 'dist/modules/old.json'), 'safe orphan');
  mkdirSync(join(root, 'dist/details/unsafe.json'));
  refused(root, base);
});
test('REL-TOOL-010: incomplete inventory collision and traversal fail before writes', async t => {
  const { applyArtifacts } = await import('./prune-artifacts.mjs');
  const { root } = sandbox(t), before = bytes(root);
  const expected = ['dist/modules/core.json', 'dist/details/core.json'];
  const plan = expected.map(path => ({ path, content: '{}\n' }));
  for (const invalid of [plan.slice(0, 1), [...plan, plan[0]], [...plan, { path: 'dist/modules/../entry.json', content: '{}' }], [...plan, { path: '../escape.json', content: '{}' }]]) {
    assert.throws(() => applyArtifacts(root, invalid, expected));
    assert.deepEqual(bytes(root), before);
  }
});
test('REL-TOOL-011: late preflight failure after staging leaves all bytes unchanged', async t => {
  const { applyArtifacts } = await import('./prune-artifacts.mjs');
  const { root } = sandbox(t);
  const plan = [{ path: 'dist/modules/core.json', content: 'changed' }, { path: 'dist/details/core.json', content: 'changed' }, { path: 'tools/evidence/release-traceability.json', content: 'changed' }];
  unlinkSync(join(root, plan[2].path)); mkdirSync(join(root, plan[2].path));
  const before = bytes(root);
  assert.throws(() => applyArtifacts(root, plan, plan.map(x => x.path)));
  assert.deepEqual(bytes(root), before);
});
test('REL-TOOL-012: isolated generation preserves current reviewed modules and clauses bytes and safe idempotent cleanup', t => {
  const { root } = sandbox(t);
  const baseline = Object.fromEntries(Object.keys(bytes(root, 'dist')).filter(path => !path.endsWith('/')).map(path => [path, readFileSync(join(root, path), 'utf8')]));
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  writeFileSync(join(root, 'dist/modules/old.json'), '{}');
  writeFileSync(join(root, 'dist/details/old.json'), '{}');
  writeFileSync(join(root, 'dist/modules/notes.txt'), 'keep');
  writeFileSync(join(root,'dist/templates/oop-runtime-adapter-extra.js'),'Not an active implementation.');
  writeFileSync(join(root,'dist/templates/notes.md'),'keep');
  const mode = JSON.parse(readFileSync(join(root,'dist/entry.json'),'utf8')).status === 'prepared_worktree_candidate' ? ['--prepare'] : [];
  if (mode.length) assert.notEqual(run(root,'generate-release.mjs').status,0,'Default still refuses uncommitted source');
  const first = run(root, 'generate-release.mjs', mode); assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /37 modules, 56 lossless contracts/);
  for (const [path, content] of Object.entries(baseline)) {
    if(path==='dist/oop-enforce.js'||path.startsWith('dist/templates/')) {assert.equal(readFileSync(join(root,path),'utf8'),content,path);continue;}
    const original = JSON.parse(content);
    assert.equal(readFileSync(join(root, path), 'utf8'), JSON.stringify(original) + '\n', path);
  }
  assert.equal(existsSync(join(root, 'dist/modules/old.json')), false);
  assert.equal(existsSync(join(root, 'dist/details/old.json')), false);
  assert.equal(existsSync(join(root,'dist/templates/oop-runtime-adapter-extra.js')),false);
  assert.equal(readFileSync(join(root,'dist/templates/notes.md'),'utf8'),'keep');
  assert.equal(readFileSync(join(root, 'dist/modules/notes.txt'), 'utf8'), 'keep');
  const after = bytes(root);
  assert.equal(run(root, 'generate-release.mjs', mode).status, 0);
  assert.deepEqual(bytes(root), after);
  rmSync(join(root, 'dist/details'), { recursive: true });
  rmSync(join(root, 'dist/procedures'), { recursive: true });
  unlinkSync(join(root, 'tools/evidence/release-traceability.json'));
  const rebuilt = run(root, 'generate-release.mjs', mode);
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.deepEqual(bytes(root), after);
});
test('REL-TOOL-013: orphan JSON symlink blocks cleanup without following its target', t => {
  const { root, base } = sandbox(t);
  mkdirSync(join(base, 'external')); writeFileSync(join(base, 'external/sentinel'), 'sentinel');
  writeFileSync(join(root, 'dist/modules/old.json'), 'safe orphan');
  if (!link(t, join(base, 'external/sentinel'), join(root, 'dist/details/unsafe.json'), 'file')) return;
  refused(root, base);
});
test('REL-TOOL-014: evidence output file symlink blocks the complete generation plan', t => {
  const { root, base } = sandbox(t);
  mkdirSync(join(base, 'external')); writeFileSync(join(base, 'external/sentinel'), 'sentinel');
  unlinkSync(join(root, 'tools/evidence/release-traceability.json'));
  if (!link(t, join(base, 'external/sentinel'), join(root, 'tools/evidence/release-traceability.json'), 'file')) return;
  refused(root, base);
});
