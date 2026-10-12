// One source-preserving allocation revision; not an extensible approval mechanism.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const recordIdentity = 'sha256:49e965d3c96efd6e60372231602925c7a38c3680421bab1ca4ee32e8a5cf7982';
export function priorReviewedAllocation({review, source, readObject, record = JSON.parse(readFileSync(new URL('./routing-allocation.json', import.meta.url),'utf8'))}) {
  if (hash(JSON.stringify(record)) !== recordIdentity) throw new Error('Unreviewed routing allocation record');
  if (hash(source) !== record.source_identity || hash(JSON.stringify(review)) !== record.target_review_identity) throw new Error('Unreviewed routing allocation or source');
  const prior = JSON.parse(readObject(record.baseline_commit, 'tools/release-review.json'));
  if (hash(JSON.stringify(prior)) !== record.baseline_review_identity) throw new Error('Changed routing allocation baseline');
  return prior;
}
