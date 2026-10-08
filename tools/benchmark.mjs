// Local maintainer fixture measurement only; no model/provider/runtime execution.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { route, assemble, invalidated } from './reference-engine.mjs';
const fixtureUrl = new URL('./fixtures/catalog.json', import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
const baselineContext = assemble(fixture.modules, fixture.modules.map(x => x.id));
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const scenarios = [
  ['fresh_install', ['bootstrap']], ['enabled_workspace', ['bootstrap']],
  ['ordinary_g0', ['information']], ['authorized_durable_write', ['durable_write']],
  ['due_update', ['due_update']], ['context_loss', ['context_loss']], ['interrupted_setup', ['bootstrap', 'context_loss']],
];
const measurements = scenarios.map(([id, facets]) => {
  const started = performance.now();
  const selection = route(fixture.modules, fixture, { request: facets, classification: 'known' });
  const context = assemble(fixture.modules, selection.modules);
  const engineMs = performance.now() - started;
  return { id, evidence_tier: 'isolated_fixture', modules: selection.modules,
    baseline_governing_bytes: bytes(baselineContext), selected_governing_bytes: bytes(context),
    engine_duration_ms: engineMs, end_to_end_duration: 'not_measured', tokenizer_tokens: 'not_measured',
    actual_model_calls: 'not_measured', actual_runtime_actions: 'not_measured', monetary_cost: 'not_measured' };
});
const digest = url => createHash('sha256').update(readFileSync(url)).digest('hex');
const report = {
  status: 'candidate_fixture_measurement', observed_at: new Date().toISOString(),
  node_version: process.version,
  identities: Object.fromEntries(['../PROTOCOL.md', './reference-engine.mjs', './benchmark.mjs', './fixtures/catalog.json']
    .map(path => [path, digest(new URL(path, import.meta.url))])),
  comparison_basis: 'Full fixture governing-context superset versus deterministic selected fixture closure. Not a previously verified release baseline; not production semantic coverage.',
  release_ready: false, installed_runtime: 'not_performed', provider_execution: 'not_performed', cross_runtime: 'not_performed',
  schema_validation: 'not_performed', full_semantic_conformance: 'not_verified',
  measurements,
  invalidation_example: invalidated([{ id: 'adapter-proof', validity_dependencies: ['adapter'] },
    { id: 'adoption', validity_dependencies: ['adapter-proof'] }, { id: 'credential-proof', validity_dependencies: ['credential'] }], ['adapter']),
};
mkdirSync(new URL('./evidence/', import.meta.url), { recursive: true });
writeFileSync(new URL('./evidence/fixture-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ release_ready: false, scenarios: measurements.length,
  evidence: 'tools/evidence/fixture-benchmark.json' }) + '\n');
