// Producer-only example export. Deliberately not a complete OOP distribution.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateProfile } from './schema-profile.mjs';
const source = readFileSync(new URL('../PROTOCOL.md', import.meta.url), 'utf8');
// This locator was explicitly selected for one reviewed access feature; no heading-to-module inference.
const clauses = source.split(/\r?\n/).filter(line => line.startsWith('| **BOOT-11** |'));
if (clauses.length !== 1) throw new Error('BOOT-11 locator is missing or ambiguous');
const clause = clauses[0];
const contract = {
  id: 'BOOT-11',
  source: { path: 'PROTOCOL.md', locator: 'Official CTA adoption and foundational bootstrap / BOOT-11',
    content_identity: `sha256:${createHash('sha256').update(clause).digest('hex')}` },
  actor: 'active consumer runtime', triggers: ['full_install', 'operations_access_revalidation'],
  scope: 'current project canonical operations and active runtime adapter/selected prepared credential',
  dependencies: ['BOOT-08', 'BOOT-09', 'Repository Bootstrap Contract', 'SEC-04'],
  preconditions: ['current_project_identity', 'canonical_operations_identity', 'selected_project_authorized_credential', 'configured_runtime_adapter'],
  actions: ['verify_runtime_credential_read', 'verify_runtime_credential_write', 'verify_signing_separately_if_required',
    'repair_authorized_local_adapter_if_needed', 'give_precise_public_enrollment_instructions_if_human_action_required',
    'reverify_after_human_action', 'synchronize_without_data_loss'],
  postconditions: ['runtime_credential_read_verified', 'runtime_credential_write_verified', 'local_changes_and_concurrent_writes_preserved'],
  verification: 'Attributable observations or sufficient effective-credential permission inspection through the configured adapter; signing separately where applicable.',
  prohibitions: ['private_visibility_check', 'anonymous_read_as_credential_proof', 'foreign_credential_as_proof', 'force_reset_unrelated_repository', 'secret_values_in_user_instructions'],
  unknown: 'Keep affected read/write readiness unresolved; establish missing facts without claiming success.',
  failure: 'Preserve actual effects; repair authorized local defects or explain a genuine human/provider dependency.',
  recovery: 'Await actual human attachment/permission change when necessary, inspect resulting access and reverify before readiness.',
  semantic_clause: clause,
};
const schema = JSON.parse(readFileSync(new URL('./schemas/contract.schema.json', import.meta.url), 'utf8'));
const errors = validateProfile(contract, schema);
if (errors.length) throw new Error(errors.join('\n'));
const target = new URL('./candidate/', import.meta.url);
mkdirSync(target, { recursive: true });
writeFileSync(new URL('operations-access.json', target), JSON.stringify(contract) + '\n');
writeFileSync(new URL('entry.json', target), JSON.stringify({
  status: 'candidate', installable: false, coverage_complete: false,
  source: 'PROTOCOL.md', source_content_identity: `sha256:${createHash('sha256').update(source).digest('hex')}`,
  publication_commit: null, consumer_repository_release_verification: 'not_performed',
  contracts: ['operations-access.json'],
  unresolved: ['complete_semantic_export', 'complete_core_and_routing', 'complete_bootstrap_state_contract',
    'installed_runtime_integration', 'provider_execution', 'cross_runtime_execution', 'verified_rolling_regression_basis'],
}) + '\n');
process.stdout.write('Candidate access contract exported; production readiness remains false.\n');
