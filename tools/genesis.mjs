// Producer-only current commit and content checks; no publication or consumer authority.
import { createHash } from 'node:crypto';
export const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;

export function currentCommit(git, ref = 'HEAD') {
  const result = git(['rev-parse', '--verify', ref+'^{commit}']);
  const commit = result.stdout?.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Cannot establish current commit');
  return { commit, mode: 'current_content' };
}

export function committedInputs(identities, readObject) {
  try { return Object.entries(identities).every(([path, identity]) => digest(readObject(path)) === identity); }
  catch { return false; }
}

// ID replacement/splitting needs an explicit reviewed traceability path. The
// unchanged-source revision path cannot silently relabel historical contracts.
export function stableContractIDs(previous, current) {
  const valid = ids => Array.isArray(ids) && ids.every(id => typeof id === 'string' && id) && new Set(ids).size === ids.length;
  return valid(previous) && valid(current) && JSON.stringify([...previous].sort()) === JSON.stringify([...current].sort());
}

export function reviewedAllocation({ source, review, spans, modules }) {
  if (review.source_identity !== digest(source) || JSON.stringify(review.modules) !== JSON.stringify(modules) ||
      JSON.stringify(review.spans.map(({ content_identity, ...span }) => span)) !== JSON.stringify(spans)) {
    throw new Error('Unreviewed source or allocation');
  }
  const lines = source.split('\n');
  let next = 1;
  const ids = new Set();
  for (const span of spans) {
    if (ids.has(span.id) || span.start !== next || span.end < span.start || !modules.some(m => m.id === span.module)) {
      throw new Error('Invalid reviewed allocation coverage');
    }
    ids.add(span.id); next = span.end + 1;
    if (digest(lines.slice(span.start - 1, span.end).join('\n')) !== review.spans.find(s => s.id === span.id)?.content_identity) {
      throw new Error('Changed reviewed clause');
    }
  }
  if (next !== lines.length + 1) throw new Error('Incomplete reviewed allocation');
  return true;
}
