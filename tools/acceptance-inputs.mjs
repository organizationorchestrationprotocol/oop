import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Explicit transitive inputs of acceptance, its suites and the reviewed generator.
// Historical comparisons consume explicitly trusted portable content; ancestry is never required.
export const inputs = [
  'tools/runtime-feedback.cjs','tools/runtime-feedback.test.mjs',
  'tools/runtime-action.cjs', 'tools/action-reconciliation.test.mjs',
  'tools/requirement-matrix.mjs', 'tools/session-guidance.test.mjs',
  'tools/current-state.mjs', 'tools/native-instruction-pointer.mjs', 'tools/native-instruction-pointer.test.mjs',
  'tools/runtime-rendering.cjs','tools/runtime-rendering.test.mjs',
  'tools/runtime-framework.test.mjs','tools/fixtures/oop-runtime-adapter.cjs','tools/runtime-declaration.cjs','tools/runtime-observations.cjs','tools/runtime-declaration.test.mjs','tools/runtime-framework.cjs','tools/oop-runtime-adapter-installation.cjs','tools/oop-runtime-adapter-installation.test.mjs','tools/templates/oop-runtime-adapter.js','tools/templates/native-instruction-pointer.md',
  'tools/neutrality.test.mjs','tools/fixtures/neutrality-terms.json',
  'tools/installation-contract.cjs', 'tools/installation-contract.test.mjs', 'tools/fixtures/native-configuration.cjs', 'tools/fixtures/machine.cjs', 'tools/schemas/installation-identity.schema.json',
  'tools/runtime-coordination.cjs', 'tools/runtime-coordination.test.mjs', 'tools/module-semantics.mjs', 'tools/current-state.test.mjs',
  'tools/runtime-checkpoint.cjs', 'tools/runtime-checkpoint.test.mjs', 'tools/fixtures/runtime-checkpoint-store.cjs',
  'tools/effect-boundary.test.mjs',
  'tools/installation-lifecycle.cjs', 'tools/installation-lifecycle.test.mjs', 'tools/installation-regression.mjs',
  'tools/schemas/enforcement-install.schema.json', 'tools/enforcement-install.cjs', 'tools/install-plan.cjs', 'tools/install-plan.test.mjs', 'tools/migration-context.mjs', 'tools/enforcement-engine.mjs', 'tools/enforcement-contract.mjs', 'tools/enforcement.test.mjs', 'tools/enforcement-benchmark.mjs', 'tools/enforcement-adapter.cjs', 'tools/enforcement.md',
  'PROTOCOL.md', 'tools/release-plan.mjs', 'tools/release-review.json', 'tools/generate-release.mjs',
  'tools/release-engine.mjs', 'tools/release.test.mjs', 'tools/accept-release.mjs',
  'tools/bootstrap-language.test.mjs', 'tools/fixtures/language-policy.txt', 'tools/reference-engine.mjs', 'tools/reference-engine.test.mjs', 'tools/schema-profile.mjs',
  'tools/schemas/contract.schema.json', 'tools/evidence/release-traceability.json',
  'README.md', 'examples.md', 'CHANGELOG.md', 'tools/README.md',
  '.gitignore', '.gitattributes',
  'tools/prune-artifacts.mjs', 'tools/prune-artifacts.test.mjs',
  'tools/fixtures/catalog.json', 'tools/fixtures/procedures.json',
  'tools/fixtures/operations-access.json', 'tools/fixtures/incomplete-entry.json',
  'tools/acceptance-inputs.mjs', 'tools/producer-safety.test.mjs',
  '.github/workflows/producer-tests.yml',
  'tools/migration-support.mjs', 'tools/migration-contract.mjs', 'tools/migration-contract.test.mjs', 'tools/schemas/migration.schema.json',
  'tools/genesis.mjs', 'tools/genesis.test.mjs', 'tools/fixtures/organizational-scenarios.json',
  'tools/organizational-scenarios.test.mjs',
  'tools/maintainer-report-scenarios.md',
  'tools/maintainer-workflow.test.mjs', 'tools/validate-maintainer-report.mjs', 'tools/validate-maintainer-report.test.mjs',
  'tools/routing-coordination.test.mjs', 'tools/remote-entry.test.mjs',
  'tools/efficiency-regression.mjs', 'tools/efficiency-regression.test.mjs',
];
export const testFiles = ['tools/runtime-feedback.test.mjs','tools/action-reconciliation.test.mjs','tools/session-guidance.test.mjs','tools/runtime-declaration.test.mjs','tools/native-instruction-pointer.test.mjs','tools/runtime-rendering.test.mjs','tools/runtime-framework.test.mjs','tools/current-state.test.mjs','tools/neutrality.test.mjs','tools/runtime-coordination.test.mjs','tools/oop-runtime-adapter-installation.test.mjs','tools/installation-contract.test.mjs','tools/runtime-checkpoint.test.mjs','tools/effect-boundary.test.mjs','tools/installation-lifecycle.test.mjs','tools/install-plan.test.mjs','tools/bootstrap-language.test.mjs','tools/enforcement.test.mjs','tools/reference-engine.test.mjs', 'tools/release.test.mjs', 'tools/prune-artifacts.test.mjs', 'tools/producer-safety.test.mjs', 'tools/organizational-scenarios.test.mjs', 'tools/routing-coordination.test.mjs', 'tools/efficiency-regression.test.mjs', 'tools/genesis.test.mjs','tools/migration-contract.test.mjs','tools/remote-entry.test.mjs'];
export const expectedObservations = [
  ...Array.from({ length: 14 }, (_, i) => `REL-FEED-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 24 }, (_, i) => `REL-ACTION-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 12 }, (_, i) => `REL-GUIDE-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 24 }, (_, i) => `REL-DECL-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 6 }, (_, i) => `REL-PTR-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 31 }, (_, i) =>`REL-RENDER-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 28 }, (_, i) => `REL-FWK-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 4 }, (_, i) => `REL-HIST-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 35 }, (_, i) => `REL-RTC-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 17 }, (_, i) => `REL-ADAPTER-${String(i + 1).padStart(3,'0')}`),
  ...Array.from({ length: 36 }, (_, i) => `REL-INSTALL-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 15 }, (_, i) => `REL-RUNTIME-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 12 }, (_, i) => `REL-BOUNDARY-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 26 }, (_, i) =>`REL-ADMIN-${String(i+1).padStart(3,'0')}`),
  ...Array.from({ length: 22 }, (_, i) => `REL-SETUP-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 59 }, (_, i) => `REL-ENF-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 19 }, (_, i) => `REL-ENTRY-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 18 }, (_, i) => `REL-MIG-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 30 }, (_, i) => `REL-OBS-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 36 }, (_, i) => `REL-PKG-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 22 }, (_, i) => `REL-TOOL-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `REL-ROUTE-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `REL-GEN-${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `REL-ORG-${String(i + 1).padStart(3, '0')}`),
];
export function subjects(root) {
  const files = directory => readdirSync(join(root, directory), { withFileTypes: true }).flatMap(item =>
    item.isDirectory() ? files(`${directory}/${item.name}`) : [`${directory}/${item.name}`]);
  return [...files('dist').filter(path => (path.endsWith('.json') || path === 'dist/oop-enforce.js' || path.startsWith('dist/templates/'))), ...inputs].sort();
}
export const identify = (root, paths) => Object.fromEntries(paths.map(path => [path,
  `sha256:${createHash('sha256').update(readFileSync(join(root, path))).digest('hex')}`]));

// The current role-separated document structure is mandatory at every checkpoint.
export function protocolSource(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const runtime = '# Rules for the runtime';
  const maintainer = '# Rules for the maintainer';
  const lines = normalized.split('\n');
  const runtimeCount = lines.filter(line => line === runtime).length;
  const maintainerCount = lines.filter(line => line === maintainer).length;
  {
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
