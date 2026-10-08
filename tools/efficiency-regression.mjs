// Producer-only byte comparisons. Evidence is supplied explicitly; no consumer authority.
import { createHash } from 'node:crypto';
import { protocolSource } from './acceptance-inputs.mjs';
import { stableContractIDs } from './genesis.mjs';
import {projectMigrationContext} from './migration-context.mjs';
export const supportedBaselinePointer = path => /^templates\/native-instruction-pointer\.md$/.test(path);
export const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bytes = value => Number.isSafeInteger(value) && value >= 0;
export const scenarioDefinitions = [
  ['fresh_install','full_install',false,false], ['enabled_workspace','interaction',true,false],
  ['ordinary_g0','information',false,false], ['authorized_durable_write','durable_write',false,false],
  ['due_update','due_update',true,false], ['context_loss','context_loss',true,true],
  ['interrupted_setup','interrupted_setup',true,true],
];

// Bind the actual executed harness and mechanisms, never merely a method label.
export function measurementMethod(script, mechanisms = []) {
  const normalized = script.replace(/\r\n/g, '\n');
  const start = normalized.indexOf('const overhead=');
  const end = normalized.indexOf('const identities=identify(subjects());', start);
  if (start < 0 || end < 0) throw new Error('Unrecognized measurement harness');
  return digest(JSON.stringify([normalized.slice(start, end), ...mechanisms.map(s => s.replace(/\r\n/g, '\n'))]));
}

export function effectiveScope(measurement, readModule, source, readProcedure, migrationContracts = []) {
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
  return digest(JSON.stringify({ scenario: [measurement.id, measurement.facet, measurement.warm, measurement.loss], coverage, procedures, migrations:['due_update','full_install','interrupted_setup'].includes(measurement.facet)?migrationContracts:[] }));
}

export function verifyPackageBaseline(checkpoint, options = {}) {
  const { readContent, trustedIdentity, selectionEvidence } = options;
  if (!checkpoint) return { status: 'not_verified', reason: 'No previous accepted package checkpoint' };
  try {
    const { path, report, identity } = checkpoint;
    const read = p => { const content=readContent(p); if(typeof content!=='string') throw Error('Missing baseline content: '+p); return content; };
    const require = (condition, reason) => { if (!condition) throw new Error(reason); };
    require(digest(read(path)) === identity && same(JSON.parse(read(path)), report), 'Checkpoint content identity mismatch');
    require(report.report_kind === 'content_checkpoint' && report.candidate_validated === true &&
      report.source_binding?.kind === 'source_content', 'Checkpoint not verified ready');
    require(trustedIdentity === identity && typeof selectionEvidence === 'string' && selectionEvidence.trim(), 'Independent baseline identity/selection evidence required');
    require(digest(JSON.stringify(report.identities)) === report.subject_content_identity, 'Checkpoint subject digest mismatch');
    const inventoryPaths = Object.keys(report.identities);
    const inventory = read('tools/acceptance-inputs.mjs');
    const requiredInputs = [...inventory.slice(inventory.indexOf('export const inputs'), inventory.indexOf('export const testFiles')).matchAll(/'([^']+)'/g)].map(m => m[1]);
    require(requiredInputs.length > 0 && requiredInputs.every(p => inventoryPaths.includes(p)), 'Incomplete checkpoint input inventory');
    const trace = JSON.parse(read('tools/evidence/release-traceability.json'));
    const distributionPaths = trace.modules.flatMap(m => ['dist/' + m.context, 'dist/' + m.detail])
      .concat(['dist/entry.json','dist/routing.json','dist/interfaces.json','dist/procedures/bootstrap.json','dist/procedures/lifecycle.json', ...(trace.migration_artifacts ?? []).map(p => 'dist/'+p)]);
    const engineRef=JSON.parse(read('dist/entry.json')).enforcement?.artifact;
    if(engineRef!==undefined){require(engineRef==='oop-enforce.js','Unsupported historical engine path');distributionPaths.push('dist/'+engineRef);}
    const installRef=JSON.parse(read('dist/entry.json')).enforcement?.installation_manifest;
    if(installRef!==undefined){require(installRef==='enforcement-install.json','Unsupported historical installation path');distributionPaths.push('dist/'+installRef);}
    const templateManifest=JSON.parse(read('dist/enforcement-install.json'));
    if(templateManifest.runtime_adapter?.templates)for(const entry of Object.values(templateManifest.runtime_adapter.templates)){
      const p=typeof entry==='string'?entry:entry?.path;
      require(/^templates\/oop-runtime-adapter\.js$/.test(p),'Unsupported historical template path');distributionPaths.push('dist/'+p);
    }
    const pointer=templateManifest.runtime_adapter?.native_instruction_pointer;
    if(pointer!==undefined){require(supportedBaselinePointer(pointer),'Unsupported historical pointer path');distributionPaths.push('dist/'+pointer);}
    const indexRef=JSON.parse(read('dist/entry.json')).routing_index;
    if(indexRef!==undefined){require(indexRef==='index.json','Unsupported historical routing index path');distributionPaths.push('dist/'+indexRef);}
    const identityRef=JSON.parse(read('dist/entry.json')).enforcement?.installation_contract;
    if(identityRef!==undefined){require(identityRef==='installation-contract.json','Unsupported historical identity contract path');distributionPaths.push('dist/'+identityRef);}
    require(same([...new Set([...requiredInputs, ...distributionPaths])].sort(), inventoryPaths.sort()), 'Checkpoint input inventory mismatch');
    require(Object.entries(report.identities).every(([p, id]) => digest(read(p)) === id), 'Checkpoint input content mismatch');
    const source = protocolSource(read('PROTOCOL.md'));
    require(digest(source) === report.source_identity && report.source_binding.source_identity === report.source_identity &&
      trace.source_identity === report.source_identity, 'Checkpoint source identity mismatch');
    const observations = report.observations;
    const expected = [...inventory.matchAll(/length: (\d+)\s*\},[^\n]*?`(REL-[A-Z]+)-/g)].flatMap(m =>
      Array.from({ length: Number(m[1]) }, (_, i) => `${m[2]}-${String(i + 1).padStart(3, '0')}`));
    require(expected.length > 0 && observations.length === expected.length &&
      new Set(observations.map(o => o.id)).size === expected.length &&
      expected.every(id => observations.some(o => o.id === id && o.actual === 'passed')), 'Incomplete or duplicate historical observations');
    const summary = report.observation_summary;
    require(summary.total === expected.length && summary.unique === expected.length && summary.passed === expected.length &&
      summary.failed === 0 && summary.skipped === 0 && summary.missing.length === 0 && summary.unexpected.length === 0,
      'Historical observation summary mismatch');
    const tap = read(path.replace('content-checkpoint.json', 'checkpoint-tests.tap'));
    const tapIds = [...tap.matchAll(/^ok \d+ - (REL-[A-Z]+-\d+): .+$/gm)].map(m => m[1]);
    require(!/ # (SKIP|TODO)\b/m.test(tap) && tapIds.length === expected.length && new Set(tapIds).size === expected.length && expected.every(id => tapIds.includes(id)) &&
      new RegExp(`^# tests ${expected.length}$`, 'm').test(tap) && /^# fail 0$/m.test(tap) && /^# skipped 0$/m.test(tap), 'Historical TAP mismatch');
    require(['reviewed_source_allocation','source_content_binding','local_package_and_reference_tests','maintainer_regressions','measured_context_bytes','frozen_subject','frozen_checkout']
      .every(key => report.checks[key] === 'passed'), 'Historical mandatory check failed');
    const maintainerTap=read(path.replace('content-checkpoint.json','checkpoint-maintainer-tests.tap'));
    require(report.maintainer_regression_summary?.passed===true &&
      Number(maintainerTap.match(/^# tests (\d+)$/m)?.[1])===report.maintainer_regression_summary.tests &&
      (maintainerTap.match(/^ok \d+ - /gm)??[]).length===report.maintainer_regression_summary.tests &&
      report.maintainer_regression_summary.tests>0 && /^# fail 0$/m.test(maintainerTap) && /^# skipped 0$/m.test(maintainerTap) &&
      !/^not ok | # (SKIP|TODO)\b/m.test(maintainerTap), 'Incomplete maintainer checkpoint evidence');
    require(['current_content_candidate','initial_content_candidate','verified_revision_candidate'].includes(report.checkpoint_policy), 'Invalid content checkpoint policy');
    require(report.measurements.length === scenarioDefinitions.length, 'Incomplete historical scenarios');
    const method = measurementMethod(read('tools/accept-release.mjs'), [read('tools/release-engine.mjs'), read('tools/reference-engine.mjs')]);
    const measurements = scenarioDefinitions.map(([id, facet, warm, loss]) => {
      const matches = report.measurements.filter(m => m.id === id);
      require(matches.length === 1, 'Missing or duplicate historical scenario');
      const m = matches[0];
      require(same([m.facet, m.warm, m.loss], [facet, warm, loss]), 'Historical scenario definition mismatch');
      const overhead = Buffer.byteLength(read('dist/entry.json')) + Buffer.byteLength(read('dist/routing.json'));
      const migrationBundle=Object.fromEntries((trace.migration_artifacts??[]).map(p=>[p,JSON.parse(read('dist/'+p))]));
      const migrationBytes=['due_update','full_install','interrupted_setup'].includes(facet)?
        (/^lossless_migration_context:1(?:;|$)/.test(m.migration_context_encoding??'') ? Buffer.byteLength(JSON.stringify(projectMigrationContext(migrationBundle))) :
          (trace.migration_artifacts??[]).reduce((sum,p)=>sum+Buffer.byteLength(read('dist/'+p)),0)):0;
      const procedures = migrationBytes+(['full_install','interrupted_setup'].includes(facet)
        ? Buffer.byteLength(read('dist/procedures/bootstrap.json')) + Buffer.byteLength(read('dist/procedures/lifecycle.json'))
        : ['due_update','context_loss'].includes(facet) ? Buffer.byteLength(read('dist/procedures/lifecycle.json')) : 0);
      const selected = overhead + procedures + m.modules.reduce((sum, module) => sum + Buffer.byteLength(read(`dist/modules/${module}.json`)), 0);
      require(bytes(m.selected_governing_bytes) && selected === m.selected_governing_bytes &&
        m.entry_selector_bytes === overhead && m.procedure_bytes === procedures && m.baseline_governing_bytes === Buffer.byteLength(source),
        'Historical measurement does not match immutable package');
      return { ...m, method_identity: method, scope_identity: effectiveScope(m, module => JSON.parse(read(`dist/modules/${module}.json`)), source,
        procedure => JSON.parse(read(`dist/procedures/${procedure}.json`)),(trace.migration_artifacts??[]).map(p=>JSON.parse(read('dist/'+p)))) };
    });
    return { status: 'verified', content_identity: identity, selection_evidence: selectionEvidence, source_identity: report.source_identity,
      subject_content_identity: report.subject_content_identity, contract_ids:trace.clauses.map(c=>c.contract), measurements };
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
    readiness_allowed: !invalidCurrent && results.every(r => ['passed','justified_regression'].includes(r.status)),
    comparable: results.filter(r => r.delta_bytes !== undefined).length, results,
    policy: 'Unexplained comparable increases block readiness. Unknown comparability proves neither regression nor improvement and limits comparative readiness until separately reviewed; current conformance remains independent.' };
}
