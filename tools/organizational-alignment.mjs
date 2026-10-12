// One reviewed additive change, not a general source-transition authorization.
import { createHash } from 'node:crypto';
import { protocolSource } from './acceptance-inputs.mjs';
import { reviewedSourceTransition } from './source-transition.mjs';
import { priorReviewedAllocation } from './routing-allocation.mjs';

const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const recordIdentity = 'sha256:51c98a795ec8785cda7fd678ff5856e3cb98da5096afded15d8177bfce397d05';
export function organizationalAlignment({ record, source, review, readObject, baseIsAncestor, trace }) {
  try {
    const require = (condition, reason) => { if (!condition) throw new Error(reason); };
    require(hash(JSON.stringify(record)) === recordIdentity, 'Unreviewed organizational alignment record');
    require(baseIsAncestor === true, 'Alignment baseline absent from checkout history');
    const baseline = protocolSource(readObject(record.base_commit, 'PROTOCOL.md'));
    require(hash(baseline) === record.baseline_source_identity, 'Changed alignment baseline');
    let expected = baseline;
    for (const change of record.changes) {
      require(expected.split(change.anchor).length === 2, 'Ambiguous insertion anchor');
      expected = expected.replace(change.anchor, change.anchor + change.text);
    }
    require(source === expected && hash(source) === record.target_source_identity, 'Unreviewed runtime delta');
    const authorizedReview = hash(JSON.stringify(review)) === record.review_identity ? review : priorReviewedAllocation({review, source, readObject});
    require(hash(JSON.stringify(authorizedReview)) === record.review_identity && review.source_identity === hash(source), 'Unreviewed semantic allocation');
    const lines = source.split('\n');
    let next = 1;
    for (const span of review.spans) {
      require(span.start === next && span.end >= span.start, 'Gap or overlap in allocation');
      require(hash(lines.slice(span.start - 1, span.end).join('\n')) === span.content_identity, 'Changed clause identity');
      next = span.end + 1;
    }
    require(next - 1 === lines.length, 'Incomplete allocation');
    if (trace) {
      require(trace.source_binding?.source_identity === hash(source) && ['committed_source','reviewed_worktree_candidate'].includes(trace.source_binding.kind), 'Incorrect source provenance binding');
      const boundSource = protocolSource(readObject(trace.source_binding.base_commit, 'PROTOCOL.md'));
      require(trace.source_binding.kind === 'committed_source' ? boundSource === source : boundSource === baseline, 'Source binding does not describe its actual Git base');
      require(trace.source_identity === hash(source) && trace.classification === 'reviewed_organizational_alignment', 'Changed alignment traceability');
      require(JSON.stringify(trace.semantic_deltas) === JSON.stringify(review.semantic_deltas), 'Missing semantic delta trace');
      require(JSON.stringify(trace.migration) === JSON.stringify(record.migration), 'Changed migration disposition');
      require(trace.clauses.length === review.spans.length, 'Missing trace clauses');
      for (const [index, span] of review.spans.entries()) {
        const clause = trace.clauses[index];
        require(['id','start','end','module','content_identity'].every(key => clause[key] === span[key]) && clause.contract === span.id, 'Changed trace allocation');
      }
    }
    return { status:'passed', basis:'reviewed_organizational_alignment', record:record.id,
      record_identity:recordIdentity, baseline:record.base_commit, changes:review.semantic_deltas,
      retained:'All baseline runtime content retained verbatim; two exact additive paragraphs only.', limitations:record.limitations };
  } catch (error) {
    return {status:'failed',basis:'reviewed_organizational_alignment',reason:error.message};
  }
}

// Keep the latest accepted checkpoint and the historical path bridge in the chain.
export function alignmentFromAcceptedBaseline(input) {
  const { record, baselineCommit, checkpoint, previous, historicalRecord, readObject } = input;
  try {
    const baseSource = protocolSource(readObject(record.base_commit, 'PROTOCOL.md'));
    const bridge = reviewedSourceTransition({ record:historicalRecord, baselineCommit, checkpoint, previous,
      source:baseSource,
      review:JSON.parse(readObject(record.base_commit, 'tools/release-review.json')),
      trace:JSON.parse(readObject(record.base_commit, 'tools/evidence/release-traceability.json')),
      readObject, targetIsAncestor:input.baseIsAncestor });
    if (bridge.status !== 'passed') return {status:'failed',basis:'reviewed_organizational_alignment',reason:`Prior accepted source: ${bridge.reason}`};
    const aligned = organizationalAlignment(input);
    return {...aligned, prior_accepted_transition:bridge};
  } catch (error) { return {status:'failed',basis:'reviewed_organizational_alignment',reason:error.message}; }
}
