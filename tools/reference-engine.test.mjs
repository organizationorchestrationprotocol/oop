import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closure, route, assemble, evaluateGuard, transition, invalidated, reusable,
  operationsAccess, releaseVerdict } from './reference-engine.mjs';
import { validateProfile } from './schema-profile.mjs';
const load = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const catalog = load('catalog.json'), procedure = load('procedures.json').operations_attachment;
const classify = (facets, classification = 'known') => route(catalog.modules, catalog, { request: facets, classification });
const pass = { workspace_matches: true, repository_matches: true, credential_matches: true,
  adapter_matches: true, read_verified: true, write_verified: true, other_applicable_requirements_satisfied: true };
const access = { expected_workspace: 'P', workspace: 'P', expected_repository: 'R', repository: 'R',
  expected_credential: 'K', credential: 'K', expected_adapter: 'A', adapter: 'A', read_verified: true, write_verified: true };
const evidence = { status: 'prepared', coverage_complete: true,
  required_results: { structure: 'passed', semantic: 'passed', installed: 'passed' } };

test('REL-OBS-001: deterministic closure retains dependency order', () => {
  assert.deepEqual(closure(catalog.modules, ['bootstrap', 'bootstrap']), ['core', 'operations', 'bootstrap']);
  assert.deepEqual(closure(catalog.modules, ['recovery', 'bootstrap']), closure(catalog.modules, ['bootstrap', 'recovery']));
});
test('REL-OBS-002: unresolved identities and missing dependencies fail', () => {
  assert.throws(() => closure(catalog.modules, ['absent']));
  assert.throws(() => closure([{ id: 'a', dependencies: ['b'] }], ['a']));
  assert.throws(() => closure(catalog.modules, []));
});
test('REL-OBS-003: cycles and duplicate module identities fail', () => {
  assert.throws(() => closure([{ id: 'a', dependencies: ['b'] }, { id: 'b', dependencies: ['a'] }], ['a']));
  assert.throws(() => closure([...catalog.modules, catalog.modules[0]], ['core']));
});
test('REL-OBS-004: action, state, risk, authority and recovery routes join request', () => {
  for (const key of ['action', 'state', 'risk', 'authority', 'recovery']) {
    const result = route(catalog.modules, catalog, { classification: 'known', request: ['information'], [key]: ['durable_write'] });
    assert.deepEqual(result.modules, ['core', 'operations']);
    assert.equal(result.authority_granted, false);
    assert.equal(result.requires_independent_admission, true);
  }
});
test('REL-OBS-005: known informational route stays small', () => {
  assert.deepEqual(classify(['information']).modules, ['core']);
});
test('REL-OBS-006: unknown material classification expands and stays unresolved', () => {
  const result = classify(['information'], 'unknown');
  assert.equal(result.modules.length, catalog.modules.length);
  assert.equal(result.classification_resolved, false);
  assert.equal(result.authority_granted, false);
});
test('REL-OBS-007: unknown selectors and malformed facets fail', () => {
  assert.throws(() => classify(['new_effect']));
  assert.throws(() => classify(['information'], 'assumed'));
  assert.throws(() => route(catalog.modules, catalog, { classification: 'known', request: 'information' }));
});
test('REL-OBS-008: context assembly is deterministic and deduplicates identities', () => {
  const one = assemble(catalog.modules, ['bootstrap', 'recovery']);
  assert.deepEqual(one, assemble(catalog.modules, ['recovery', 'bootstrap', 'core']));
  assert.equal(new Set(one.map(x => x.id)).size, one.length);
  assert.ok(one.every(x => x.source_ref && x.semantic_clause));
});
test('REL-OBS-009: conflicting governing content is rejected', () => {
  const modules = structuredClone(catalog.modules);
  modules[1].contracts.push({ id: 'AUTHORITY', semantic_clause: 'Wider authority' });
  assert.throws(() => assemble(modules, ['bootstrap']));
});
test('REL-OBS-010: guard truth, falsehood and uncertainty remain distinct', () => {
  const guard = { all: [{ fact: 'read' }, { fact: 'write' }] };
  assert.equal(evaluateGuard(guard, { read: true, write: true }), 'true');
  assert.equal(evaluateGuard(guard, { read: true, write: false }), 'false');
  assert.equal(evaluateGuard(guard, { read: true }), 'unknown');
  assert.equal(evaluateGuard({ fact: 'read' }, { read: 'true' }), 'unknown');
});
test('REL-OBS-011: malformed or empty guards are rejected', () => {
  for (const guard of [null, [], {}, { all: [] }, { fact: '' }, { fact: 'read', all: [] }, { allow: true }]) {
    assert.throws(() => evaluateGuard(guard, {}));
  }
});
test('REL-OBS-012: user confirmation cannot skip actual access observation', () => {
  assert.equal(transition(procedure, 'awaiting_attachment', 'access_observed', { user_confirmed: true }).status, 'pending');
  assert.equal(transition(procedure, 'awaiting_attachment', 'operations_ready', pass).status, 'denied');
});
test('REL-OBS-013: readiness transition needs all applicable facts', () => {
  assert.equal(transition(procedure, 'access_observed', 'operations_ready', pass).status, 'eligible_transition');
  for (const key of Object.keys(pass)) {
    assert.equal(transition(procedure, 'access_observed', 'operations_ready', { ...pass, [key]: false }).status, 'denied');
    const partial = { ...pass }; delete partial[key];
    assert.equal(transition(procedure, 'access_observed', 'operations_ready', partial).status, 'pending');
  }
});
test('REL-OBS-014: recovery requires a fresh observation, not old success', () => {
  assert.equal(transition(procedure, 'recovering', 'access_observed', { access_observation_obtained: true }).status, 'pending');
  assert.equal(transition(procedure, 'recovering', 'access_observed', { fresh_access_observation_obtained: true }).status, 'eligible_transition');
});
test('REL-OBS-015: undefined and ambiguous transitions fail', () => {
  assert.throws(() => transition(procedure, 'nonexistent', 'operations_ready', pass));
  const duplicate = { ...procedure, transitions: [...procedure.transitions, procedure.transitions[0]] };
  assert.throws(() => transition(duplicate, 'credential_prepared', 'awaiting_attachment', {}));
});
test('REL-OBS-016: invalidation follows only transitive dependent evidence', () => {
  const items = [{ id: 'a', validity_dependencies: ['adapter'] }, { id: 'b', validity_dependencies: ['a'] },
    { id: 'c', validity_dependencies: ['credential'] }];
  assert.deepEqual(invalidated(items, ['adapter']), ['a', 'b']);
  assert.deepEqual(invalidated(items, ['unrelated']), []);
});
test('REL-OBS-017: reuse cannot cross project, runtime or changed dependencies', () => {
  const item = { status: 'verified', workspace: 'P', runtime: 'X', validity_dependencies: ['adapter'], observed: { adapter: 'A' } };
  assert.equal(reusable(item, { workspace: 'P', runtime: 'X', observed: { adapter: 'A' } }), true);
  for (const state of [{ workspace: 'Q', runtime: 'X', observed: { adapter: 'A' } },
    { workspace: 'P', runtime: 'Y', observed: { adapter: 'A' } },
    { workspace: 'P', runtime: 'X', observed: { adapter: 'B' } },
    { workspace: 'P', runtime: 'X', observed: {} }]) assert.equal(reusable(item, state), false);
});
test('REL-OBS-018: stale and unobserved checkpoints cannot establish reuse', () => {
  const item = { status: 'stale', workspace: 'P', runtime: 'X', validity_dependencies: [], observed: {} };
  assert.equal(reusable(item, item), false);
});
test('REL-OBS-019: access is tied to the expected runtime credential and adapter', () => {
  assert.equal(operationsAccess(access), 'true');
  for (const dimension of ['workspace', 'repository', 'credential', 'adapter']) {
    assert.equal(operationsAccess({ ...access, [dimension]: 'FOREIGN' }), 'false');
    assert.equal(operationsAccess({ ...access, [dimension]: undefined }), 'unknown');
  }
});
test('REL-OBS-020: read-only or anonymous success cannot prove read/write readiness', () => {
  assert.equal(operationsAccess({ ...access, write_verified: false }), 'false');
  assert.equal(operationsAccess({ ...access, credential: 'anonymous' }), 'false');
  assert.equal(operationsAccess({ ...access, write_verified: undefined }), 'unknown');
});
test('REL-OBS-021: private visibility is not an access readiness predicate', () => {
  assert.equal(operationsAccess({ ...access, visibility: 'public' }), 'true');
  assert.equal(operationsAccess({ ...access, visibility: undefined }), 'true');
});
test('REL-OBS-022: successful final check cannot conceal an earlier failure', () => {
  assert.equal(releaseVerdict({ ...evidence, required_results: { first: 'failed', last: 'passed' } }).ready, false);
  assert.equal(releaseVerdict(evidence).ready, true);
});
test('REL-OBS-023: candidates, missing coverage and unperformed checks block readiness', () => {
  assert.equal(releaseVerdict({ ...evidence, status: 'candidate' }).ready, false);
  assert.equal(releaseVerdict({ ...evidence, coverage_complete: false }).ready, false);
  assert.equal(releaseVerdict({ ...evidence, required_results: { structure: 'passed', installed: 'not_performed' } }).ready, false);
  assert.equal(releaseVerdict({ ...evidence, required_results: {} }).ready, false);
});
test('REL-OBS-024: measured efficiency regression requires a justified authorized disposition', () => {
  assert.equal(releaseVerdict({ ...evidence, efficiency_regression: true }).ready, false);
  assert.equal(releaseVerdict({ ...evidence, efficiency_regression: true, regression_disposition: 'authorized_justified' }).ready, true);
});
test('REL-OBS-025: candidate catalog never advertises complete production coverage', () => {
  assert.equal(catalog.coverage_complete, false);
  assert.equal(catalog.status, 'candidate_fixture');
});
test('REL-OBS-026: producer profile validates the access contract and rejects omissions', () => {
  const contract = JSON.parse(readFileSync(new URL('./candidate/operations-access.json', import.meta.url), 'utf8'));
  const schema = JSON.parse(readFileSync(new URL('./schemas/contract.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateProfile(contract, schema), []);
  for (const key of schema.required) {
    const missing = structuredClone(contract); delete missing[key];
    assert.ok(validateProfile(missing, schema).length);
  }
  assert.ok(validateProfile({ ...contract, authority_granted: true }, schema).length);
  assert.ok(validateProfile({ ...contract, actions: [] }, schema).length);
  assert.ok(validateProfile({ ...contract, dependencies: ['X', 'X'] }, schema).length);
});
test('REL-OBS-027: profile refuses unsupported schema features instead of silently passing', () => {
  assert.throws(() => validateProfile({}, { type: 'object', anyOf: [] }));
  assert.throws(() => validateProfile({}, { type: 'boolean' }));
});
test('REL-OBS-028: candidate entry cannot be selected as an installable release', () => {
  const entry = JSON.parse(readFileSync(new URL('./candidate/entry.json', import.meta.url), 'utf8'));
  assert.equal(entry.installable, false);
  assert.equal(entry.coverage_complete, false);
  assert.equal(entry.publication_commit, null);
  assert.ok(entry.unresolved.includes('complete_semantic_export'));
});
test('REL-OBS-029: inherited values cannot establish observed guard facts', () => {
  assert.equal(evaluateGuard({ fact: 'read_verified' }, Object.create({ read_verified: true })), 'unknown');
});
test('REL-OBS-030: malformed module metadata and duplicate states are rejected', () => {
  assert.throws(() => closure([{ id: 'a', dependencies: 'core' }], ['a']));
  assert.throws(() => closure([{ id: '', dependencies: [] }], ['']));
  assert.throws(() => transition({ ...procedure, states: [...procedure.states, procedure.states[0]] },
    'credential_prepared', 'awaiting_attachment', {}));
});
