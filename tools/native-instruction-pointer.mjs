// Producer-only exact rendering. Supplied references do not prove ownership,
// host requirements, current-template verification or migration authority.
import { readFileSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import { createHash } from 'node:crypto';
import { protocolSource } from './acceptance-inputs.mjs';
const sourceIdentity='sha256:'+createHash('sha256').update(protocolSource(readFileSync(new URL('../PROTOCOL.md',import.meta.url),'utf8'))).digest('hex');
export const pointerPath = 'templates/native-instruction-pointer.md';
export const pointerTemplate = readFileSync(new URL('./templates/native-instruction-pointer.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n').replaceAll('@@SOURCE_IDENTITY@@',sourceIdentity);
const tokens = ['<binding-locator>', '<rendered-locator>'];
export function renderNativePointer({ binding, rendered, variation = null }) {
  for (const locator of [binding, rendered]) {
    if (typeof locator !== 'string' || !locator.trim() || /[<>\x00-\x1f\x7f]/.test(locator)) throw Error('Invalid locator');
  }
  const block = pointerTemplate.replace(/<binding-locator>|<rendered-locator>/g, token => token === tokens[0] ? binding : rendered);
  if (variation === null) return block;
  if (!variation || Object.keys(variation).sort().join(',') !== 'documentation_ref,position,text' ||
      !['prefix','suffix'].includes(variation.position) || typeof variation.text !== 'string' || !variation.text.trim() ||
      /OOP activation block:|<binding-locator>|<rendered-locator>/.test(variation.text) ||
      typeof variation.documentation_ref !== 'string' || !/^https:\/\/[^\s]+$/.test(variation.documentation_ref) ||
      (variation.position === 'prefix' && !variation.text.endsWith('\n'))) throw Error('Invalid documented R21 variation');
  return variation.position === 'prefix' ? variation.text + block : block + variation.text;
}
export function matchesNativePointer(actual, options) {
  // No whitespace, newline or Markdown normalization can hide protected edits.
  return typeof actual === 'string' && actual === renderNativePointer(options);
}

// Producer-only scenario review of supplied native discovery/installation facts.
// This does not discover a host, authenticate observations or install anything.
const nonempty = value => typeof value === 'string' && !!value.trim();
const documented = value => typeof value === 'string' && /^https:\/\/\S+$/.test(value);
function absoluteLocation(value) {
  if (!nonempty(value) || /[\x00-\x1f\x7f]/.test(value)) return null;
  const api = /^(?:[A-Za-z]:[\\/]|\\\\)/.test(value) ? win32 : posix;
  return api.isAbsolute(value) ? { api, path: api.normalize(value) } : null;
}
function withinWorkspace(value, workspace) {
  const root = absoluteLocation(workspace.resolved_root), target = absoluteLocation(value);
  if (!root || !target || root.api !== target.api) return null;
  const fold = text => workspace.case_sensitive ? text : text.toLowerCase();
  const relative = root.api.relative(fold(root.path), fold(target.path));
  return !root.api.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + root.api.sep);
}
function sameLocation(a, b, workspace) {
  const left = absoluteLocation(a), right = absoluteLocation(b);
  if (!left || !right || left.api !== right.api) return false;
  return workspace.case_sensitive ? left.path === right.path : left.path.toLowerCase() === right.path.toLowerCase();
}
export function validateNativeActivationPlan({ environment, workspace, requirements, mechanisms, integrations, plan, locators } = {}) {
  const errors = [];
  if (typeof environment !== 'string' || !environment.trim() || !Array.isArray(mechanisms) || !mechanisms.length ||
      !Array.isArray(integrations) || !Array.isArray(plan)) return { valid: false, errors: ['discovery'] };
  if (!workspace || !absoluteLocation(workspace.root) || !absoluteLocation(workspace.resolved_root) ||
      typeof workspace.case_sensitive !== 'boolean' || workspace.resolution_verified !== true ||
      !Array.isArray(requirements) || !requirements.length) return { valid: false, errors: ['scope_discovery'] };
  const functions = new Map(), activeFunctions = new Map(), blockedFunctions = new Set();
  for (const r of requirements) {
    if (!r || !nonempty(r.id) || functions.has(r.id) || r.necessary !== true || !documented(r.documentation_ref) ||
        !nonempty(r.reason) || !Array.isArray(r.local_alternatives) || !r.local_alternatives.length) {
      errors.push('necessary_function'); continue;
    }
    functions.set(r.id, r);
    for (const a of r.local_alternatives) {
      if (!a || !nonempty(a.target) || a.resolution_verified !== true || withinWorkspace(a.resolved_target, workspace) !== true ||
          ![true, false, 'unknown'].includes(a.supported) || ![true, false, 'unknown'].includes(a.sufficient) ||
          (a.supported !== true && a.sufficient === true) || typeof a.primary !== 'boolean' || !nonempty(a.reason)) errors.push('local_alternatives');
    }
  }
  const known = new Set(), selected = new Set();
  const disposition = new Set(['install', 'reuse', 'repair', 'blocked', 'unsupported', 'not_applicable', 'not_required']);
  for (const m of mechanisms) {
    if (!m || typeof m.id !== 'string' || !m.id.trim() || known.has(m.id)) { errors.push('mechanism_identity'); continue; }
    known.add(m.id);
    const requirementIDs = Array.isArray(m.requirements) ? m.requirements : [];
    const entries = plan.filter(p => p?.mechanism === m.id);
    if (entries.length !== 1) { errors.push('mechanism_coverage'); continue; }
    const p = entries[0];
    if (!disposition.has(p.action)) { errors.push('disposition'); continue; }
    if (!Array.isArray(m.requirements) || !m.requirements.length || new Set(m.requirements).size !== m.requirements.length ||
        m.requirements.some(id => !functions.has(id))) errors.push('function_reference');
    if (![true, false, 'unknown'].includes(m.supported) || ![true, false, 'unknown'].includes(m.applicable)) errors.push('capability');
    const expected = m.applicable === false ? 'not_applicable' : m.supported === false ? 'unsupported' :
      m.supported === 'unknown' || m.applicable === 'unknown' ? 'blocked' : null;
    if (expected) {
      if (p.action !== expected || typeof p.reason !== 'string' || !p.reason.trim()) errors.push('capability_disposition');
      for (const id of requirementIDs) blockedFunctions.add(id);
      continue;
    }
    if (!documented(m.documentation_ref) ||
        !['file', 'native'].includes(m.kind) || typeof m.target !== 'string' || !m.target.trim() ||
        typeof m.delivery_key !== 'string' || !m.delivery_key.trim()) errors.push('documented_target');
    if (p.action === 'blocked') {
      if (!nonempty(p.reason)) errors.push('blocker');
      for (const id of requirementIDs) blockedFunctions.add(id);
      continue;
    }
    if (p.action === 'not_required') { if (!nonempty(p.reason)) errors.push('necessity_disposition'); continue; }
    if (!['install', 'reuse', 'repair'].includes(p.action)) { errors.push('required_mechanism'); continue; }
    if (selected.has(m.delivery_key)) errors.push('duplicate_delivery');
    selected.add(m.delivery_key);
    for (const id of requirementIDs) {
      const members = activeFunctions.get(id) ?? [];
      members.push(m.id); activeFunctions.set(id, members);
    }
    const resolvedLocal = m.kind === 'file' ? withinWorkspace(m.resolved_target, workspace) : m.scope === 'workspace';
    const intendedLocal = m.kind === 'file' ? withinWorkspace(m.target, {...workspace,resolved_root:workspace.root}) : resolvedLocal;
    const local = resolvedLocal === null || intendedLocal === null ? null : resolvedLocal && intendedLocal;
    if (!['workspace', 'external'].includes(m.scope) || m.scope_verified !== true ||
        (m.kind === 'file' && (!absoluteLocation(m.target) || m.resolution_verified !== true || local === null)) ||
        (local !== null && m.scope !== (local ? 'workspace' : 'external'))) errors.push('effective_scope');
    for (const id of requirementIDs) {
      const r = functions.get(id); if (!r) continue;
      if (local === false) {
        const proof = m.external_requirement;
        if (!proof || !documented(proof.documentation_ref) || !nonempty(proof.requirement) || !nonempty(proof.reason) ||
            r.local_alternatives.some(a => a?.supported === 'unknown' || a?.sufficient !== false)) errors.push('external_necessity');
      } else if (local === true && m.kind === 'file') {
        const alternatives = r.local_alternatives.filter(a => a?.supported === true && a.sufficient === true);
        const primary = alternatives.filter(a => a.primary === true);
        const rootPrimary = primary.filter(a => {
          const intended = absoluteLocation(a.target), resolved = absoluteLocation(a.resolved_target);
          return intended && resolved && sameLocation(intended.api.dirname(intended.path), workspace.root, workspace) &&
            sameLocation(resolved.api.dirname(resolved.path), workspace.resolved_root, workspace);
        });
        const combined = Array.isArray(r.combination?.mechanisms) && r.combination.mechanisms.includes(m.id);
        const candidates = combined ? r.local_alternatives.filter(a => a?.supported === true) : rootPrimary.length ? rootPrimary : primary.length ? primary : alternatives;
        if (!candidates.some(a => sameLocation(a.resolved_target, m.resolved_target, workspace))) errors.push('primary_project_entry');
      }
    }
    if (p.target !== m.target || p.environment !== environment) errors.push('effective_target');
    const existing = integrations.filter(i => i?.target === m.target);
    const compatible = existing.filter(i => i.environment === environment && i.mechanism === m.id && i.compatible === true);
    if (integrations.some(i => i?.environment === environment && i.effective === true && i.target !== m.target &&
        (i.mechanism === m.id || i.delivery_key === m.delivery_key))) errors.push('duplicate_existing_delivery');
    if (existing.length > 1) errors.push('contested_target');
    if (p.action === 'install' && existing.length) errors.push('existing_target');
    if (p.action === 'reuse' && (compatible.length !== 1 || compatible[0].effective !== true)) errors.push('incompatible_reuse');
    if (p.action === 'repair' && (existing.length !== 1 || existing[0].owned !== true)) errors.push('peer_mutation');
    if (p.action !== 'reuse' && p.authorized !== true) errors.push('authority');
    const state = p.action === 'reuse' ? compatible[0] : p;
    if (!state || state.administrative_complete !== true || state.consent_resolved !== true || state.restart_resolved !== true || state.effective !== true)
      errors.push('administrative_prerequisites');
    if (m.kind === 'file') {
      try { if (!state || !matchesNativePointer(state.content, { ...locators, variation: m.variation ?? null })) errors.push('pointer_content'); }
      catch { errors.push('pointer_locators'); }
    } else if (!state || state.binding !== locators?.binding || state.rendered !== locators?.rendered ||
        typeof locators?.binding !== 'string' || !locators.binding.trim() || typeof locators?.rendered !== 'string' || !locators.rendered.trim()) errors.push('native_references');
  }
  if (plan.some(p => !known.has(p?.mechanism))) errors.push('unknown_mechanism');
  for (const i of integrations.filter(i => i?.environment === environment && i.effective === true)) {
    const ids = i.requirements ?? mechanisms.find(m => m?.id === i.mechanism)?.requirements;
    if (!nonempty(i.target) || !Array.isArray(ids) || !ids.length || ids.some(id => !functions.has(id))) {
      errors.push('existing_function_reference'); continue;
    }
    for (const id of ids) for (const selectedID of activeFunctions.get(id) ?? []) {
      const m = mechanisms.find(m => m.id === selectedID);
      if (m.target === i.target) continue;
      const combined = functions.get(id)?.combination?.mechanisms;
      if (!Array.isArray(combined) || !combined.includes(i.mechanism) || !combined.includes(selectedID) ||
          !(activeFunctions.get(id) ?? []).includes(i.mechanism)) errors.push('duplicate_existing_function');
    }
  }
  for (const [id, r] of functions) {
    const members = activeFunctions.get(id) ?? [];
    if (!members.length && !blockedFunctions.has(id)) errors.push('required_function');
    if (members.length > 1 || (members.length && r.combination)) {
      const combination = r.combination;
      if (!combination || !documented(combination.documentation_ref) || !nonempty(combination.reason) ||
          !Array.isArray(combination.mechanisms) || new Set(combination.mechanisms).size !== combination.mechanisms.length ||
          JSON.stringify([...combination.mechanisms].sort()) !== JSON.stringify([...members].sort())) errors.push('duplicate_function');
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
