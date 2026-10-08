// AGN-07 release check. A keyword scan supplements, never replaces, the semantic review of AGN-06.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixturePath = 'tools/fixtures/neutrality-terms.json';
const fixture = JSON.parse(readFileSync(new URL('../' + fixturePath, import.meta.url), 'utf8'));
const glob = pattern => new RegExp('^' + pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
const exceptions = fixture.exceptions.map(e => ({ ...e, matchers: e.files.map(glob) }));
const pattern = term => new RegExp('(?<![A-Za-z0-9_])' + term.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])', 'gi');
export function findings(path, content) {
  let text = content;
  for (const locator of fixture.canonical_locators) text = text.split(locator).join(' ');
  return fixture.terms.flatMap(term => {
    const count = (text.match(pattern(term)) ?? []).length;
    if (!count || exceptions.some(e => e.terms.includes(term) && e.matchers.some(m => m.test(path)))) return [];
    return [{ path, term, count }];
  });
}
const files = () => {
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(listed.status, 0);
  return listed.stdout.split('\0').filter(Boolean).filter(path => path !== fixturePath);
};

test('REL-GEN-007: repository files use neutral terms outside declared exceptions; inserted names fail and the term list stays producer-only', () => {
  const violations = files().flatMap(path => {
    let content;
    try { content = readFileSync(new URL('../' + path, import.meta.url), 'utf8'); } catch { return []; }
    return findings(path, content);
  });
  assert.deepEqual(violations, []);
  assert.deepEqual(findings('README.md', 'Install it with a GitHub action on Windows.').map(f => f.term), ['Windows', 'GitHub']);
  assert.deepEqual(findings('tools/runtime-coordination.cjs', '// runs on Claude').map(f => f.term), ['Claude']);
  assert.deepEqual(findings('README.md', 'https://github.com/organizationorchestrationprotocol/oop'), []);
  assert.ok(fixture.exceptions.every(e => e.files.every(file => !/:\d+$/.test(file))), 'exceptions are declared by file pattern, never by line');
  assert.ok(!files().some(path => path.startsWith('dist/') && path.includes('neutrality')));
  const distribution = spawnSync('git', ['grep', '-l', 'neutrality-terms', '--', 'dist'], { cwd: root, encoding: 'utf8' });
  assert.equal(distribution.stdout, '');
});
