import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Explicit transitive inputs of acceptance, its suites and the reviewed generator.
// Historical acceptance outputs are read from Git, bound by their recorded commit/hash.
export const inputs = [
  'PROTOCOL.md', 'tools/release-plan.mjs', 'tools/release-review.json', 'tools/generate-release.mjs',
  'tools/release-engine.mjs', 'tools/release.test.mjs', 'tools/accept-release.mjs',
  'tools/reference-engine.mjs', 'tools/reference-engine.test.mjs', 'tools/schema-profile.mjs',
  'tools/schemas/contract.schema.json', 'tools/evidence/release-traceability.json',
  'README.md', 'examples.md', 'CHANGELOG.md', 'tools/README.md',
  '.gitignore',
  'tools/prune-artifacts.mjs', 'tools/prune-artifacts.test.mjs',
  'tools/fixtures/catalog.json', 'tools/fixtures/procedures.json',
  'tools/candidate/operations-access.json', 'tools/candidate/entry.json',
  'tools/acceptance-inputs.mjs', 'tools/producer-safety.test.mjs',
  'tools/source-transition.mjs', 'tools/source-transition.test.mjs', 'tools/reviewed-source-transition.json',
  '.github/workflows/producer-tests.yml',
  'tools/organizational-alignment.json', 'tools/organizational-alignment.mjs',
  'tools/organizational-alignment.test.mjs', 'tools/fixtures/organizational-scenarios.json',
  'tools/organizational-scenarios.test.mjs',
  'tools/maintainer-report-scenarios.md',
  'tools/routing-coordination.test.mjs', 'tools/routing-allocation.mjs', 'tools/routing-allocation.json',
  'tools/efficiency-regression.mjs', 'tools/efficiency-regression.test.mjs',
];
export const testFiles = ['tools/reference-engine.test.mjs', 'tools/release.test.mjs', 'tools/prune-artifacts.test.mjs', 'tools/producer-safety.test.mjs', 'tools/organizational-scenarios.test.mjs', 'tools/routing-coordination.test.mjs', 'tools/efficiency-regression.test.mjs'];
export const expectedObservations = [
  ...Array.from({ length: 30 }, (_, i) => `REL-OBS-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 25 }, (_, i) => `REL-PKG-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 22 }, (_, i) => `REL-TOOL-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `REL-ROUTE-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `REL-ORG-${String(i + 1).padStart(3, '0')}`),
];
export function subjects(root) {
  const files = directory => readdirSync(join(root, directory), { withFileTypes: true }).flatMap(item =>
    item.isDirectory() ? files(`${directory}/${item.name}`) : [`${directory}/${item.name}`]);
  return [...files('distribution').filter(path => path.endsWith('.json')), ...inputs].sort();
}
export const identify = (root, paths) => Object.fromEntries(paths.map(path => [path,
  `sha256:${createHash('sha256').update(readFileSync(join(root, path))).digest('hex')}`]));

// Current document structure is mandatory. Historical parsing is read-only compatibility.
export function protocolSource(text, { historical = false } = {}) {
  const normalized = text.replace(/\r\n/g, '\n');
  const runtime = '# Rules for the runtime';
  const maintainer = '# Rules for the maintainer';
  const lines = normalized.split('\n');
  const runtimeCount = lines.filter(line => line === runtime).length;
  const maintainerCount = lines.filter(line => line === maintainer).length;
  if (runtimeCount || maintainerCount || !historical) {
    if (runtimeCount !== 1 || maintainerCount !== 1) throw new Error('Missing or duplicate required role heading');
    const title = '# Cross-Tool Organization Orchestration Protocol\n\n';
    const runtimeOffset = normalized.indexOf('\n\n' + runtime + '\n\n');
    if (!normalized.startsWith(title) || runtimeOffset < title.length - 2) {
      throw new Error('Malformed runtime section or heading order');
    }
    const offset = normalized.indexOf('\n\n' + maintainer + '\n');
    if (offset < normalized.indexOf(runtime) || !normalized.slice(offset + maintainer.length + 3).trim()) {
      throw new Error('Malformed maintainer section or heading order');
    }
    const source = title + normalized.slice(runtimeOffset + runtime.length + 4, offset);
    if (!source.slice(source.indexOf('\n\n') + 2).trim()) throw new Error('Empty runtime section');
    return source;
  }
  // Accepted older checkpoints retain their original source representation.
  const token = '<!-- OOP:MAINTAINER-APPENDIX -->';
  const offset = normalized.indexOf(token);
  if (offset === -1) {
    if (normalized.includes('## Repository maintainer instructions')) throw new Error('Maintainer appendix boundary is missing');
    return normalized;
  }
  if (offset < 2 || normalized.slice(offset - 2, offset) !== '\n\n' ||
      normalized.indexOf(token, offset + token.length) !== -1 ||
      !normalized.slice(offset + token.length).startsWith('\n\n## Repository maintainer instructions\n')) {
    throw new Error('Malformed or duplicate maintainer appendix boundary');
  }
  return normalized.slice(0, offset - 2);
}

// Source allocation uses logical lines; published locators name actual document lines.
export function protocolSourceLocator(start, end, document) {
  protocolSource(document);
  const offset = document.replace(/\r\n/g, '\n').split('\n').indexOf('# Rules for the runtime');
  return `lines:${start <= 2 ? start : start + offset}-${end <= 2 ? end : end + offset}`;
}

// Validate the fixed producer inventory independently of report/migration suites.
export function completeProducerObservations(run, observations) {
  const ids = observations.map(item => item.id);
  return run.status === 0 && ids.length === expectedObservations.length && new Set(ids).size === ids.length &&
    expectedObservations.every(id => ids.includes(id)) && observations.every(item => item.actual === 'passed') &&
    /^# fail 0$/m.test(run.stdout) && new RegExp(`^# tests ${expectedObservations.length}$`, 'm').test(run.stdout);
}
