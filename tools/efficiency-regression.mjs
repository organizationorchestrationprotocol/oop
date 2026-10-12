// Producer-only byte comparisons. Evidence is supplied explicitly; no consumer authority.
import { createHash } from 'node:crypto';
import { protocolSource } from './acceptance-inputs.mjs';
export const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bytes = value => Number.isSafeInteger(value) && value >= 0;
export const scenarioDefinitions = [
  ['fresh_install','full_install',false,false], ['enabled_workspace','interaction',true,false],
  ['ordinary_g0','information',false,false], ['authorized_durable_write','durable_write',false,false],
  ['due_update','due_update',true,false], ['context_loss','context_loss',true,true],
  ['interrupted_setup','interrupted_setup',true,true],
];

// Legacy reports have no method ID. Bind their actual executed harness, not its label.
export function measurementMethod(script, mechanisms = []) {
  const normalized = script.replace(/\r\n/g, '\n');
  const start = normalized.indexOf('const overhead=');
  const end = normalized.indexOf('const identities=identify(subjects());', start);
  if (start < 0 || end < 0) throw new Error('Unrecognized measurement harness');
  return digest(JSON.stringify([normalized.slice(start, end), ...mechanisms.map(s => s.replace(/\r\n/g, '\n'))]));
}

export function effectiveScope(measurement, readModule, source, readProcedure) {
  // Compare semantic obligations, allowing reviewed moves between modules.
  const clauses = measurement.modules.flatMap(id => readModule(id).contracts.map(c =>
    [c.id, digest(c.semantic_clause)]));
  clauses.sort(([a], [b]) => a.localeCompare(b));
  if (new Set(clauses.map(([id]) => id)).size !== clauses.length) throw new Error('Duplicate scoped clause');
  let coverage = clauses;
  if (source !== undefined) {
    const spans = measurement.modules.flatMap(id => readModule(id).contracts.map(c => {
      const start = source.indexOf(c.semantic_clause);
      if (!c.semantic_clause || start < 0 || source.lastIndexOf(c.semantic_clause) !== start) throw new Error('Unresolved semantic source span');
      return [start, start + c.semantic_clause.length];
    })).sort(([a], [b]) => a - b);
    coverage = [];
    for (const span of spans) {
      const prior = coverage.at(-1);
      if (prior && span[0] < prior[1]) throw new Error('Overlapping semantic source spans');
      if (prior && !source.slice(prior[1], span[0]).trim()) prior[1] = span[1];
      else coverage.push([...span]);
    }
    // Equal source coverage remains comparable after a reviewed contract/module split.
    coverage = { source_identity: digest(source), spans: coverage };
  }
  const procedures = !readProcedure ? null : ['full_install','interrupted_setup'].includes(measurement.facet)
    ? [readProcedure('bootstrap'),readProcedure('lifecycle')]
    : ['due_update','context_loss'].includes(measurement.facet) ? [readProcedure('lifecycle')] : [];
  return digest(JSON.stringify({ scenario: [measurement.id, measurement.facet, measurement.warm, measurement.loss], coverage, procedures }));
}

export function verifyPackageBaseline(checkpoint, { readObject, isAncestor }) {
  if (!checkpoint) return { status: 'not_verified', reason: 'No previous accepted package checkpoint' };
  try {
    const { recordCommit, path, report, identity } = checkpoint;
    const read = p => readObject(recordCommit, p);
    const require = (condition, reason) => { if (!condition) throw new Error(reason); };
    require(digest(read(path)) === identity && same(JSON.parse(read(path)), report), 'Checkpoint content identity mismatch');
    require(report.release_ready === true && report.committed_source_ready === true &&
      report.source_binding?.kind === 'committed_source' && report.source_binding.base_commit === report.source_snapshot_commit,
      'Checkpoint not verified ready');
    require(isAncestor(report.evaluated_checkout?.commit, recordCommit) && isAncestor(recordCommit), 'Checkpoint subject/history mismatch');
    require(digest(JSON.stringify(report.identities)) === report.subject_content_identity, 'Checkpoint subject digest mismatch');
    require(Object.entries(report.identities).every(([p, id]) => digest(read(p)) === id), 'Checkpoint input content mismatch');
    const source = protocolSource(read('PROTOCOL.md'), { historical: true });
    require(digest(source) === report.source_identity && report.source_binding?.source_identity === report.source_identity,
      'Checkpoint source identity mismatch');
    let snapshotSource;
    try { snapshotSource = readObject(report.source_snapshot_commit, 'PROTOCOL.md'); }
    catch { snapshotSource = readObject(report.source_snapshot_commit, 'PROMPT.md'); }
    require(digest(protocolSource(snapshotSource, { historical: true })) === report.source_identity, 'Snapshot source mismatch');
    const observations = report.observations;
    const inventory = read('tools/acceptance-inputs.mjs');
    const expected = [...inventory.matchAll(/length: (\d+)\s*\},[^\n]*?`(REL-[A-Z]+)-/g)].flatMap(m =>
      Array.from({ length: Number(m[1]) }, (_, i) => `${m[2]}-${String(i + 1).padStart(3, '0')}`));
    require(expected.length > 0 && observations.length === expected.length &&
      new Set(observations.map(o => o.id)).size === expected.length &&
      expected.every(id => observations.some(o => o.id === id && o.actual === 'passed')), 'Incomplete or duplicate historical observations');
    const summary = report.observation_summary;
    require(summary.total === expected.length && summary.unique === expected.length && summary.passed === expected.length &&
      summary.failed === 0 && summary.skipped === 0 && summary.missing.length === 0 && summary.unexpected.length === 0,
      'Historical observation summary mismatch');
    const tap = read(path.replace('acceptance.json', 'tests.tap'));
    const tapIds = [...tap.matchAll(/^ok \d+ - (REL-[A-Z]+-\d+): .+$/gm)].map(m => m[1]);
    require(!/ # (SKIP|TODO)\b/m.test(tap) && tapIds.length === expected.length && new Set(tapIds).size === expected.length && expected.every(id => tapIds.includes(id)) &&
      new RegExp(`^# tests ${expected.length}$`, 'm').test(tap) && /^# fail 0$/m.test(tap) && /^# skipped 0$/m.test(tap), 'Historical TAP mismatch');
    require(['source_regression_gate','preceding_source_checkpoint','local_package_and_reference_tests','measured_context_bytes','frozen_subject','frozen_checkout']
      .every(key => report.checks[key] === 'passed') &&
      Object.entries(report.checks).filter(([key]) => key !== 'source_preservation').every(([key, value]) =>
        value === 'passed' || (['rolling_efficiency_regression','historical_efficiency_evidence'].includes(key) &&
          value === 'not_verified' && report.efficiency_comparison?.rolling?.readiness_allowed === true &&
          report.efficiency_comparison.rolling.results?.length === scenarioDefinitions.length &&
          report.efficiency_comparison.rolling.results.every(row => ['passed','not_comparable','justified_regression'].includes(row.status)))),
      'Historical mandatory check failed');
    require(report.measurements.length === scenarioDefinitions.length, 'Incomplete historical scenarios');
    const method = measurementMethod(read('tools/accept-release.mjs'), [read('tools/release-engine.mjs'), read('tools/reference-engine.mjs')]);
    const measurements = scenarioDefinitions.map(([id, facet, warm, loss]) => {
      const matches = report.measurements.filter(m => m.id === id);
      require(matches.length === 1, 'Missing or duplicate historical scenario');
      const m = matches[0];
      require(same([m.facet, m.warm, m.loss], [facet, warm, loss]), 'Historical scenario definition mismatch');
      const overhead = Buffer.byteLength(read('distribution/entry.json')) + Buffer.byteLength(read('distribution/routing.json'));
      const procedures = ['full_install','interrupted_setup'].includes(facet)
        ? Buffer.byteLength(read('distribution/procedures/bootstrap.json')) + Buffer.byteLength(read('distribution/procedures/lifecycle.json'))
        : ['due_update','context_loss'].includes(facet) ? Buffer.byteLength(read('distribution/procedures/lifecycle.json')) : 0;
      const selected = overhead + procedures + m.modules.reduce((sum, module) => sum + Buffer.byteLength(read(`distribution/modules/${module}.json`)), 0);
      require(bytes(m.selected_governing_bytes) && selected === m.selected_governing_bytes &&
        m.entry_selector_bytes === overhead && m.procedure_bytes === procedures && m.baseline_governing_bytes === Buffer.byteLength(source),
        'Historical measurement does not match immutable package');
      return { ...m, method_identity: method, scope_identity: effectiveScope(m, module => JSON.parse(read(`distribution/modules/${module}.json`)), source,
        procedure => JSON.parse(read(`distribution/procedures/${procedure}.json`))) };
    });
    return { status: 'verified', record_commit: recordCommit, content_identity: identity,
      evaluated_commit: report.evaluated_checkout.commit, source_identity: report.source_identity,
      subject_content_identity: report.subject_content_identity, measurements };
  } catch (error) { return { status: 'not_verified', reason: error.message }; }
}

export function compareEfficiency({ baseline, measurements, subjectIdentity, dispositions = [], trustedDispositionIdentities = [] }) {
  const results = scenarioDefinitions.map(([id, facet, warm, loss]) => {
    const current = measurements.filter(m => m.id === id);
    const previous = baseline?.measurements?.filter(m => m.id === id) ?? [];
    const result = { scenario: id, measurement_basis: 'selected governing UTF-8 bytes including entry/selector and applicable procedures',
      baseline_evidence: baseline?.content_identity ?? null, baseline_commit: baseline?.record_commit ?? null };
    const unknown = reason => ({ ...result, status: 'not_comparable', reason, previous_release_comparison: 'NOT VERIFIED' });
    if (current.length !== 1 || !bytes(current[0].selected_governing_bytes) ||
      !same([current[0].facet,current[0].warm,current[0].loss], [facet,warm,loss])) return unknown('Missing, duplicate or invalid current scenario');
    const now = current[0];
    result.current_bytes = now.selected_governing_bytes;
    if (baseline?.status !== 'verified') return unknown(baseline?.reason ?? 'Historical baseline not verified');
    if (previous.length !== 1 || !bytes(previous[0].selected_governing_bytes)) return unknown('Missing, duplicate or invalid historical scenario');
    const old = previous[0];
    result.previous_bytes = old.selected_governing_bytes;
    result.method_identity = now.method_identity;
    result.scope_identity = now.scope_identity;
    if (!now.method_identity || old.method_identity !== now.method_identity) return unknown('Measurement methodology changed or unidentified');
    if (!now.scope_identity || old.scope_identity !== now.scope_identity) return unknown('Effective semantic workload changed or unidentified; source/coverage review remains required');
    result.delta_bytes = now.selected_governing_bytes - old.selected_governing_bytes;
    result.ratio = old.selected_governing_bytes === 0 ? null : now.selected_governing_bytes / old.selected_governing_bytes;
    if (result.delta_bytes <= 0) return { ...result, status: 'passed' };
    // Trust anchors must come from separate maintainer review, never from the disposition itself.
    // Production supplies none: no new approval has been granted by this implementation.
    const disposition = dispositions.find(d => trustedDispositionIdentities.includes(digest(JSON.stringify(d))) &&
      d.scenario === id && d.baseline_identity === baseline.content_identity && d.subject_identity === subjectIdentity &&
      d.method_identity === now.method_identity && d.scope_identity === now.scope_identity &&
      d.previous_bytes === old.selected_governing_bytes && d.current_bytes === now.selected_governing_bytes &&
      d.decision === 'authorized_justified_increase' && typeof d.reason === 'string' && d.reason.trim() &&
      d.author && d.reviewer && d.author !== d.reviewer && d.authorized_by && d.review_evidence && d.authorization_evidence);
    return { ...result, status: disposition ? 'justified_regression' : 'unexplained_regression',
      ...(disposition ? { disposition_identity: digest(JSON.stringify(disposition)), disposition } : {}) };
  });
  const invalidCurrent = measurements.length !== scenarioDefinitions.length || results.some(r => r.current_bytes === undefined);
  return { status: invalidCurrent || results.some(r => r.status === 'unexplained_regression') ? 'failed'
    : results.every(r => ['passed','justified_regression'].includes(r.status)) ? 'passed' : 'not_verified',
    readiness_allowed: !invalidCurrent && !results.some(r => r.status === 'unexplained_regression'),
    comparable: results.filter(r => r.delta_bytes !== undefined).length, results,
    policy: 'Unexplained comparable increases block readiness. Unknown comparability proves neither regression nor improvement; other mandatory coverage/source gates still apply.' };
}
