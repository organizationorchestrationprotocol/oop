// A single immutable, reviewed historical bridge. Not a source migration framework.
import { createHash } from 'node:crypto';
import { protocolSource } from './acceptance-inputs.mjs';

const sha = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const identity = value => sha(JSON.stringify(value));
const reviewedIdentity = 'sha256:8aff44bfadf64207603a80e2d9a816ae74732e7bb20ed27f0e64a927e079e4db';

export function reviewedSourceTransition({ record, baselineCommit, checkpoint, previous, source, review, trace, readObject, targetIsAncestor }) {
  try {
    const require = (condition, reason) => { if (!condition) throw new Error(reason); };
    require(identity(record) === reviewedIdentity, 'Missing, changed or unreviewed transition record');
    require(baselineCommit === record.baseline.commit, 'Different rolling baseline');
    require(checkpoint?.recordCommit === record.checkpoint.commit && checkpoint.identity === record.checkpoint.content_identity, 'Different accepted package checkpoint');
    require(targetIsAncestor === true, 'Reviewed transition is not in evaluated checkout history');
    const proof = readObject(record.checkpoint.commit, record.checkpoint.path);
    require(sha(proof) === record.checkpoint.content_identity, 'Stale checkpoint proof');
    const accepted = JSON.parse(proof);
    require(accepted.release_ready === true && accepted.source_snapshot_commit === baselineCommit && accepted.source_identity === record.baseline.source_identity, 'Historical report does not bind this baseline');
    const oldSource = protocolSource(readObject(record.baseline.commit, record.baseline.path), { historical: true });
    const target = protocolSource(readObject(record.target.commit, record.target.path), { historical: true });
    require(previous === oldSource && sha(oldSource) === record.baseline.source_identity, 'Baseline source mismatch');
    require(source === target && sha(target) === record.target.source_identity, 'Unreviewed current source delta');
    const oldLines = oldSource.split('\n'), newLines = target.split('\n');
    require(oldLines.length === newLines.length, 'Removed or added source lines');
    const deltas = oldLines.flatMap((old, index) => old === newLines[index] ? [] : [{ extracted_line: index + 1, old, new: newLines[index] }]);
    require(JSON.stringify(deltas) === JSON.stringify(record.changes.map(({ extracted_line, old, new: next }) => ({ extracted_line, old, new: next }))), 'Transition is not the exact reviewed lines');
    const pinnedReview = JSON.parse(readObject(record.review.commit, record.review.path));
    const pinnedTrace = JSON.parse(readObject(record.traceability.commit, record.traceability.path));
    require(identity(pinnedReview) === record.review.content_identity && identity(review) === record.review.content_identity, 'Missing or changed review ledger');
    require(identity(pinnedTrace) === record.traceability.content_identity && identity(trace) === record.traceability.content_identity, 'Stale or mismatched traceability');
    const snapshot = protocolSource(readObject(record.traceability.source_commit, record.target.path), { historical: true });
    require(snapshot === target && trace.source_snapshot_commit === record.traceability.source_commit && trace.source_identity === sha(source) && review.source_identity === sha(source), 'Generator source provenance mismatch');
    let next = 1;
    require(review.spans.length === trace.clauses.length, 'Missing clause allocation');
    for (const [index, span] of review.spans.entries()) {
      const clause = trace.clauses[index];
      require(span.start === next && span.end >= span.start && clause.id === span.id && clause.contract === span.id && clause.start === span.start && clause.end === span.end && clause.module === span.module, 'Reordered or malformed clause allocation');
      const contentIdentity = sha(newLines.slice(span.start - 1, span.end).join('\n'));
      require(span.content_identity === contentIdentity && clause.content_identity === contentIdentity, 'Clause source identity mismatch');
      next = span.end + 1;
    }
    require(next - 1 === newLines.length, 'Incomplete source allocation');
    for (const change of record.changes) require(review.spans.some(span => span.id === change.clause && span.start <= change.extracted_line && span.end >= change.extracted_line), 'Missing affected clause');
    return { status: 'passed', basis: 'reviewed_historical_path_transition', record: record.id, record_identity: reviewedIdentity, baseline: record.baseline, target: record.target, checkpoint: record.checkpoint, changes: record.changes, limitations: record.review.limitations };
  } catch (error) {
    return { status: 'failed', basis: 'reviewed_historical_path_transition', reason: error.message };
  }
}
