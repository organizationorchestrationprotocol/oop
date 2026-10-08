# Maintainer reference mechanisms

Producer tools for the OOP repository. Consumers never run them. The official generated controller and its boundaries are documented in [enforcement.md](enforcement.md); maintainer commands (DIAGNOSE, FORMALIZE, PREPARE, VERIFY, APPLY, REPORT) live in [the repository maintainer appendix](../PROTOCOL.md#rules-for-the-maintainer), with [command guidance](../README.md#maintainer-commands) in the README. Every command runs on the JavaScript interpreter declared for the official controller, with its built-in test runner (conditional example: Node.js 24).

## Generation

`node tools/generate-release.mjs` exports the reviewed current source into `dist/`. It binds the source-content identity, never a containing commit. `release-plan.mjs` and `release-review.json` bind exact spans, module purposes, dependencies and facets; `module-semantics.mjs` (mirrored in `release-review.json#module_semantics`) holds each module's `use`, conditions, preconditions and postconditions. Generation fails before writing on unreviewed source or allocation, gaps or overlaps, missing or identical module semantics, a runtime index over its 8 KiB budget, unsafe paths, links, traversal or unexpected JSON orphans. Output is deterministic; orphan generated JSON and explicitly recognized generated templates are pruned.

The generated package provides the runtime entry, applicable instructions, routing, procedures, interfaces, controller and consumer templates. The explanatory overview and maintainer appendix stay outside ordinary consumer context.

## Compatibility and verification evidence

Compatibility metadata distinguishes initial setup from reviewed updates. Tests use synthetic source and target states; they do not establish an earlier published release. Execution logs and content checkpoints are generated evidence, while source allocation traceability belongs to the source tree.

## Acceptance

- `node tools/accept-release.mjs --candidate`: precommit conformance on current content (`candidate_validated`; `release_ready` stays false). Output goes to untracked `tools/evidence/candidate-acceptance.json` and `candidate-tests.tap`.
- `node tools/accept-release.mjs --snapshot`: exports untracked current-content evidence (`content-checkpoint.json`, `checkpoint-tests.tap`, `checkpoint-maintainer-tests.tap`) after the same checks; it never invents a containing SHA.
- `node tools/accept-release.mjs` then `--check-current`: committed acceptance of actual HEAD and every committed subject byte; the latter rejects a changed HEAD, changed subject bytes or failed readiness.

The producer acceptance inventory for REL-ENF observations is maintained in `tools/acceptance-inputs.mjs`, together with every other observation family and the exact input list. Missing, failed, duplicate, unexpected or skipped mandatory cases block conformance. Seven context measurements cover fresh install, enabled workspace, ordinary G0, authorized durable write, due update, context loss and interrupted setup; bytes are not tokens or money.

`comparative_regression_ready` is separate and requires an independently supplied content bundle (`OOP_BASELINE_BUNDLE`, `OOP_BASELINE_TRUST_IDENTITY`, `OOP_BASELINE_SELECTION_EVIDENCE`); without it comparative claims are NOT VERIFIED, never PASS.

## Test suites

| Suite | Scope |
| --- | --- |
| `release.test.mjs`, `reference-engine.test.mjs`, `routing-coordination.test.mjs`, `producer-safety.test.mjs`, `prune-artifacts.test.mjs`, `genesis.test.mjs` | Package reconstruction, routing, generation safety, checkout identity |
| `enforcement.test.mjs`, `runtime-coordination.test.mjs`, `runtime-rendering.test.mjs` | Controller admission, declarative rendering, local observations and diagnostic recovery, R27 guidance, declarations, leases, coordination log, R28 recap notices |
| `oop-runtime-adapter-installation.test.mjs`, `installation-contract.test.mjs`, `installation-lifecycle.test.mjs`, `install-plan.test.mjs`, `runtime-checkpoint.test.mjs`, `effect-boundary.test.mjs` | Adapter validation, identity and mutation contracts, administrative installation, checkpoints, effect boundaries |
| `bootstrap-language.test.mjs`, `remote-entry.test.mjs`, `organizational-scenarios.test.mjs` | Bootstrap, language evidence, remote entry, organizational scenarios |
| `migration-contract.test.mjs`, `efficiency-regression.test.mjs` | Initial compatibility plus synthetic update scenarios, efficiency evidence model |
| `maintainer-workflow.test.mjs`, `validate-maintainer-report.test.mjs` | Maintainer command text and REPORT structure |

Adapter cases use the declared JavaScript execution facility. The template must be fully implemented inside its editable regions before activation. Synthetic producer tests establish no installed runtime, provider or cross-runtime behavior.

## Maintainer report validation

`node tools/requirement-matrix.mjs --write` writes the ignored producer inventory `tools/evidence/requirement-matrix.json`; `--check` rejects missing, duplicate, changed or self-certified rows. Each paragraph, list item, table row and contextual block retains its exact source, locator, candidate route and seven implementation-path dispositions. Semantic applicability, ownership, negative conditions and recovery remain explicitly `not_verified` until attributable review. Complete structural coverage is not a completed semantic comparison or consumer conformance. Acceptance includes this inventory without delivering it to consumers.

The `session-guidance.test.mjs` suite checks local lock contention/release, optional G0 guidance, managed interaction invalidation, stale revisions, cancellation/partial effects, context recovery, isolation, blocker shape and source-inventory negatives. Its fixtures establish no installed host behavior.

`node tools/validate-maintainer-report.mjs <local-report.md>` checks the captured structure of English or Italian reports: consecutive numbered PROP entries with six labeled fields, independent impact lines and the optional `Edited region:` role. It returns PASS, FAIL or UNSUPPORTED. PASS covers structure and declared consistency only; no chat interceptor is installed. Reviewable scenarios are in [maintainer-report-scenarios.md](maintainer-report-scenarios.md).

## CI and publication

The read-only producer workflow pins its actions, uses a depth-one checkout without persisted credentials, the declared interpreter major version and the public-visibility guard, runs the maintainer report suites, actual checkout acceptance, `--check-current` and a clean tracked diff check. CI is a post-publication diagnostic, never publication authority or evidence of consumer adoption. Commit, push, force-push and settings changes follow the maintainer appendix authorization rules.

## Native activation pointer

The source and distributed `templates/native-instruction-pointer.md` contain one complete Markdown activation block, including both HTML delimiter lines and the mandatory preservation instruction. Render only the two locator tokens; compare the entire result byte for byte, with no normalization, additions or trailing content except the exact documented host variation. The block starts at byte zero, or immediately after the exact host-mandated prefix/directive whose official documentation reference is recorded under R22. The comparison helper supports an exact documented prefix or suffix directive; a prefix must end in a newline so the Markdown block remains on its own line.

`native-instruction-pointer.mjs` is a producer-only rendering/comparison helper; it cannot authenticate locators, documentation or authority. Existing integrations are assessed from actual owned state. Under current update/migration authority, retain recoverable evidence and unrelated work, stage the current verified rendering, conditionally replace the owned nonconforming file and read back its complete bytes before claiming alignment. Already conforming files need no write. Unknown ownership or authority blocks dependent repair; never rewrite another runtime's files or historical evidence. No installed state is supplied by this repository, so no consumer migration or adoption is claimed. Portable comparison accepts the current Markdown pointer contract while validating supplied evidence bytes; it never rewrites its input evidence.

The current-state guard enumerates every tracked file and non-ignored candidate file independently of acceptance inputs. It rejects full hexadecimal commit identifiers and abbreviated identifiers in explicit Git contexts, except the two dependency pins in their declared workflow and producer guard/test declarations, and rejects declared narrative markers everywhere, including the changelog and the guard itself. Explicit content digests and required compatibility contracts remain technical facts; semantic review also checks prose that a marker list cannot recognize.
