import { readdirSync, lstatSync, unlinkSync, realpathSync, readFileSync, writeFileSync, mkdirSync, renameSync, accessSync, constants } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const directories = ['dist/modules', 'dist/details'];
const optionalDirectories = ['dist/migrations','dist/templates'];
function stat(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function workspaceRoot(root) {
  const absolute = resolve(root);
  if (lstatSync(absolute).isSymbolicLink() || !lstatSync(absolute).isDirectory() || realpathSync(absolute) !== absolute) {
    throw new Error('Unsafe checkout root');
  }
  return absolute;
}
function destination(workspace, path, file = true) {
  if (typeof path !== 'string' || isAbsolute(path) || path.includes('\\') || path.includes(':') ||
      path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Invalid artifact path: ${path}`);
  const target = resolve(workspace, path), boundary = relative(workspace, target);
  if (boundary.startsWith('..') || isAbsolute(boundary)) throw new Error(`Outside checkout: ${path}`);
  const parts = path.split('/');
  let current = workspace;
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    const info = stat(current);
    if (!info) continue;
    if (info.isSymbolicLink() || realpathSync(current) !== current ||
        (i === parts.length - 1 && file ? !info.isFile() : !info.isDirectory())) {
      throw new Error(`Unsafe artifact component: ${path}`);
    }
  }
  return target;
}
function inventory(expected) {
  if (!Array.isArray(expected) || new Set(expected).size !== expected.length) throw new Error('Duplicate artifact inventory');
  for (const directory of directories) {
    if (!expected.some(path => path.startsWith(`${directory}/`))) throw new Error(`Empty generated inventory: ${directory}`);
  }
  for (const path of expected) {
    if (typeof path !== 'string' || !(/^dist\/(modules|details)\/[^/]+\.json$/.test(path) ||
        ['dist/installation-contract.json', 'dist/enforcement-install.json', 'dist/oop-enforce.js', 'dist/entry.json', 'dist/routing.json', 'dist/index.json', 'dist/interfaces.json', 'dist/procedures/bootstrap.json',
          'dist/procedures/lifecycle.json', 'tools/evidence/release-traceability.json',
          'dist/templates/oop-runtime-adapter.js','dist/templates/native-instruction-pointer.md',
          'dist/migrations/index.json','dist/migrations/common.json','dist/migrations/runtime.json',
          'dist/migrations/operations.json','dist/migrations/compatibility.json'].includes(path))) {
      throw new Error(`Unauthorized artifact: ${path}`);
    }
  }
}
function cleanupPlan(workspace, expected, allowMissing) {
  const removals = [];
  for (const directory of [...directories, ...optionalDirectories]) {
    const target = destination(workspace, directory, false);
    if (!stat(target)) {
      if (allowMissing || optionalDirectories.includes(directory)) continue;
      throw new Error(`Missing generated directory: ${directory}`);
    }
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      const generated=directory==='dist/templates'?(/^(?:oop-runtime-adapter(?:-[A-Za-z0-9_-]+)?\.js|native-instruction-pointer\.(?:txt|md))$/.test(entry.name)):entry.name.endsWith('.json');
      if (!generated || expected.includes(path)) continue;
      destination(workspace, path);
      removals.push(path);
    }
  }
  return removals;
}

function writable(target) {
  if (stat(target)) accessSync(target, constants.W_OK);
  let parent = dirname(target);
  while (!stat(parent)) parent = dirname(parent);
  accessSync(parent, constants.W_OK);
}

// Read-only validation of the entire write/delete plan, including missing destinations.
export function preflightArtifacts(root, plan, expected) {
  const workspace = workspaceRoot(root);
  inventory(expected);
  const paths = plan.map(item => item.path);
  if (new Set(paths.map(path => path.toLowerCase())).size !== paths.length ||
      JSON.stringify([...paths].sort()) !== JSON.stringify([...expected].sort())) throw new Error('Incomplete or colliding generation plan');
  for (const item of plan) {
    if (typeof item.content !== 'string') throw new Error(`Missing staged content: ${item.path}`);
    writable(destination(workspace, item.path));
  }
  const removals = cleanupPlan(workspace, expected, true);
  for (const path of removals) writable(destination(workspace, path));
  return { workspace, plan, removals };
}

export function applyArtifacts(root, plan, expected) {
  return applyChecked(preflightArtifacts(root, plan, expected));
}

// Acceptance evidence uses the same path safety and atomic per-file replacement,
// without running distribution cleanup or expanding the generator's inventory.
export function writeEvidence(root, plan) {
  const workspace = workspaceRoot(root);
  const allowed = ['requirement-matrix.json', 'current-acceptance.json', 'current-tests.tap', 'current-maintainer-tests.tap',
    'candidate-acceptance.json', 'candidate-tests.tap', 'content-checkpoint.json', 'checkpoint-tests.tap', 'checkpoint-maintainer-tests.tap'];
  if (!plan.length || new Set(plan.map(item => item.path)).size !== plan.length) throw new Error('Invalid evidence plan');
  for (const item of plan) {
    if (!allowed.some(name => item.path === `tools/evidence/${name}`) || typeof item.content !== 'string') throw new Error('Unauthorized evidence output');
    writable(destination(workspace, item.path));
  }
  return applyChecked({ workspace, plan, removals: [] });
}

function applyChecked(checked) {
  let mutations = 0;
  try {
    for (const item of checked.plan) {
      const target = destination(checked.workspace, item.path);
      if (stat(target) && readFileSync(target, 'utf8') === item.content) continue;
      mkdirSync(dirname(target), { recursive: true });
      const temporary = join(dirname(target), `.oop-${randomUUID()}.tmp`);
      try {
        writeFileSync(temporary, item.content, { flag: 'wx' });
        destination(checked.workspace, item.path);
        renameSync(temporary, target);
        mutations++;
      } finally { if (stat(temporary)) unlinkSync(temporary); }
    }
    for (const path of checked.removals) {
      unlinkSync(destination(checked.workspace, path)); mutations++;
    }
  } catch (error) {
    throw new Error(`Generation apply failed after ${mutations} file mutations; partial files/directories may require reconciliation. No readiness asserted.`, { cause: error });
  }
  return checked.removals;
}

// Cleanup-only compatibility API: every expected output must already be a regular file.
export function pruneArtifacts(root, expected) {
  const workspace = workspaceRoot(root);
  inventory(expected);
  for (const path of expected) {
    const target = destination(workspace, path);
    if (!stat(target)) throw new Error(`Missing expected artifact: ${path}`);
  }
  const removals = cleanupPlan(workspace, expected, false);
  for (const path of removals) writable(destination(workspace, path));
  for (const path of removals) unlinkSync(destination(workspace, path));
  return removals;
}
