# Credential minimality and scoped enforcement mapping — local candidate VERIFY/REPORT

## Outcome and authority

PROP-01 through PROP-04 from the supplied decision dossier are implemented locally. This is ordinary execution of a prepared prompt, not invocation of APPLY. No project commit, push, PR, release, ruleset mutation, provider enrollment, credential generation or consumer bootstrap occurred. Isolated producer tests created disposable Git/signing fixtures only. The maintainer appendix was not edited. No additional proposals or scope changes are introduced by this report.

The initially clean local branch was `main`, HEAD `20b3c36e6636746c9fb3a621bb9b9fb7a33f4b29`. `origin` points to `git@github.com:organizationorchestrationprotocol/oop.git`. Initial sandbox SSH/HTTPS read attempts failed; a subsequently authorized read-only `git ls-remote origin refs/heads/main` succeeded and returned the same full SHA. No synchronization or ref mutation was needed. Local HEAD and the index remain unchanged. Provider publication authority and maintainer signing were not exercised because no commit/publication was authorized by this execution request.

The source identity changed from `sha256:fa75a25f19e75401e13b297143873f4d15f154dfcd583b81f31e4ee2ad48cd58` to `sha256:39105b2534e54d000de7c6e60efe03141746a5dd27736065dc18b71e7c39095d`. All 56 contract IDs and all 37 module allocations are retained; 51 complete runtime clauses are unchanged and five are explicitly revised. Exactly one runtime role heading and one later maintainer role heading remain. Source allocation line counts did not move. Generated artifacts were produced by the existing generator, not edited directly.

## Verification evidence

Use Node `v24.19.0`, available at the bundled runtime path. The ordinary PATH Node `v23.11.0` produced controller test failures and is outside the documented producer major version; those failures are not represented as passing checks. The first full sandbox run also encountered temporary Git/configuration, rename, signing-cleanup, Bash and symlink restrictions; mandatory skipped tests prevented candidate validation. Retrying the unchanged tests with authorized execution outside the sandbox resolved those restrictions. Two maintainer tests pinned to the old source digest were updated to the independently computed new digest, preserving their exact-source assertion and their existing identity-policy checks.

Final commands and observations:

| Check | Actual result |
| --- | --- |
| `node tools/generate-release.mjs` | PASS: 37 modules, 56 lossless contracts, 11 surviving BOOT steps, zero orphans removed |
| `node --test --test-reporter=tap tools/install-plan.test.mjs tools/remote-entry.test.mjs tools/enforcement.test.mjs` | PASS: 78 tests, zero failed/skipped |
| `node tools/accept-release.mjs --candidate` | PASS: `candidate_validated:true`; all 235 expected observations passed, none missing/unexpected/skipped; all 170 maintainer tests passed; all seven current-source context-byte measurements passed |
| Allocation, source binding, frozen subject and frozen checkout at acceptance | PASS |
| `git diff --check` | PASS |
| Read-only remote main SHA | PASS: exact local baseline SHA observed |
| Commit/push, committed acceptance, `--check-current`, exact-revision CI | NOT PERFORMED: no authorized project commit/publication |
| Trusted portable historical efficiency comparator | NOT VERIFIED; no baseline bundle/trust/selection evidence supplied |
| Installed host interception, native trust activation, live provider read/write/signing, cross-runtime behavior | NOT VERIFIED / NOT PERFORMED |
| End-to-end time, tokens, credits, monetary savings | `not_measured` |

Candidate acceptance intentionally reports `release_ready:false` and `committed_inputs:false`. A valid uncommitted content candidate is not a committed release or consumer installation. Actual local observation/TAP files are `tools/evidence/genesis-candidate.json`, `tools/evidence/genesis-candidate-tests.tap`, `tools/evidence/current-maintainer-tests.tap` and `tools/evidence/current-focused-tests.tap`; these existing technical output paths are ignored local evidence. `credential-enforcement-candidate.json` preserves the final content-candidate observation separately, without claiming committed acceptance.

The interrupted-setup byte limit initially exceeded the current complete-source baseline. Only newly added repeated migration-review metadata was shortened to resolve it; no runtime clause, control, required test or measurement threshold was removed or weakened. New schema-compatible migration profile `oop-mincred-mapping-v1` retains every existing profile and state policy. No state/secret transformation or automatic adoption is implied.

## Canonical normative source changes

All changes below are attributable to the supplied approved prompt, not independent improvements. Baseline and current document line numbers are identical. Changes refine/add obligations inside existing paragraphs; no normative section or existing mandatory signing/trust/publication gate was removed. Examples are illustrative consequences, distinct from the executed producer fixtures.

| Topic | Actual source edits and practical consequence | Exactly two BEFORE → AFTER illustrations |
| --- | --- | --- |
| Minimum necessary credentials and scoped enrollment | Modified lines 1098, 1106, 1126 and BOOT-08/10/11 at 3086–3088. Establish project/worker/provider-principal/credential/repository/purpose/permission relation; extra repositories require express authority. Derive needed purposes, prohibit unnecessary additional signing secrets, preserve genuinely required signatures, require unattended usability and make the eligible protected passphrase-less SSH example conditional on higher policy. Reuse valid secrets; do not rotate or copy them merely for naming. Enrollment remains public-only and consolidated. | (1) A no-signature SSH setup could prepare authentication plus a signing key and an unknown passphrase → prepare only the needed protected authentication key without a passphrase in the eligible case; stronger policy still controls. (2) A worker/key label could be mistaken for provider identity or cross-repository rights → verify principal and each authorized repository separately; another repository may need another scoped credential. |
| Scoped enforcement setup intent | Modified BOOT-01 line 3080 and SYS-04/05 lines 3117/3119. Voluntary official installation authorizes necessary safe minimal local prepare/install/enable/repair/verify within actual workspace/host authority, without redundant generic consent. Independent host trust/admin gates, revocation and refusal remain binding. Disabled controls trigger authorized diagnosis/repair/alternatives and independent continuation, not an invented ready state. | (1) Disabled control treated as an immediate terminal stop → perform authorized repair/alternatives and independent preparation before reporting the exact remaining dependency. (2) Generic enforcement confirmation repeated after install intent → reuse scoped intent, while still requiring any separate actual host trust gate. |
| Mapping, coverage and lifecycle facts | Modified Strongest Available Enforcement line 129, materialization line 847 and BOOT-12 line 3089. Distinguish need/capability/integration/plan/coverage/evidence; enumerate relevant function/phase/path/effect/resource/authority combinations; record reason/evidence/consequence/recheck and exact blocker recovery. Unexamined is not unsupported. Complete reasoned mapping may lack coverage; preparation, installation, enablement, verified technical state and BOOT-13 publication require separate evidence. Keep legacy coverage admission semantics and selective recovery. | (1) One uncovered completion need exposed only `plan_complete:false` → reasoned `mapping_complete:true`, `coverage_complete:false`, with installation/effects still blocked. (2) Two effects on the same phase/path could collapse into one dimension → distinct effect/resource/authority requirements require explicit matching coverage. |

Complete derived clause spans (logical source → actual document → module):

| Contract | Logical lines | Document lines | Derived module |
| --- | --- | --- | --- |
| `OOP-enforcement-autonomy` | 86–173 | 125–212 | `dist/modules/core.json` |
| `OOP-capability-lifecycle` | 695–816 | 734–855 | `dist/modules/capabilities.json` |
| `OOP-scoped-credentials` | 1043–1095 | 1082–1134 | `dist/modules/security.json` |
| `OOP-full-install` | 3035–3069 | 3074–3108 | `dist/modules/bootstrap.json` |
| `OOP-bootstrap-system` | 3070–3098 | 3109–3137 | `dist/modules/bootstrap.json` |

The reviewed generator also refreshed impacted details, entry/routing/interfaces, installation manifest, migration source/profile bindings, controller source references and release traceability. `dist/procedures/bootstrap.json` is byte-unchanged: its required guards already enforced the retained coverage/install/publication contract. The repository module is unchanged because all newly refined identity/credential paragraphs belong to the existing security allocation; no JSON-only repository rule was invented.

## Four-section overview disposition

| Section | Disposition |
| --- | --- |
| Abstract | Updated at line 9: minimum credential purposes, scoped setup authority and mapping versus coverage; existing research/evidence limits retained. |
| Vision | Unchanged: human authority, portable Organization as Code, single canonical knowledge, proportional cross-domain coordination and Solopreneur utility remain accurate. |
| Goal | Unchanged: evaluation objectives and actual applied-state/resource measurements already avoid unsupported savings claims. |
| Introduction | Updated at line 27: explain reasoned mapping without readiness, minimal credentials and independent host trust gates. |

README preserves the top CTA and existing structure, with an explanatory setup paragraph. `examples.md` adds the conditional `dabotto/operations` private-repository/deploy-key example, full public authentication key plus fingerprint, `ai-coworker` title and `Allow write access`; it requests no algorithm choice, private key or unneeded signing enrollment. These are documentation examples, not observed provider actions or new universal technology prerequisites.

## Controller and adapter interface assessment

Controller impact: **SOURCE_BINDING_ONLY** within the compared generated controller's executable/wire semantics. Extracting the old and new generated JavaScript established byte-equal executable prefix/suffix, equal command definitions and equal bootstrap guards. Changed configuration keys are `source_binding`, `routing`, `migration_context`, `contracts`: source/content references and an equivalent-state current-source migration profile; no new controller predicate, request, response, command or exit was introduced. Existing `oop-admission-1` envelope/decisions and allow/deny/unknown/error exits `0/2/3/4` remain unchanged. Runtime-native installation remains NOT VERIFIED.

Aggregate producer planner/adapter impact: **INTERFACE_CHANGED**, a documented extension for existing permissive format-1 readers, requiring explicit adaptation for external strict object-shape readers. No external consumer compatibility is presumed. The original `planBindings` partial-input API and unqualified path semantics remain; optional qualified requirements now deliberately constrain coverage. Consumers previously attaching unrelated metadata under these newly defined dimension names must reconcile that use before adoption.

Before diagnostic subset:

```json
{"plan_complete":false,"uncovered":[{"feature":"completion","phase":"before_completion","path":"owned-path","minimum_tier":0}]}
```

After diagnostic subset (illustrative, not a real host observation):

```json
{"plan_complete":false,"diagnostics_format":1,"mapping_complete":true,"coverage_complete":false,"installation_verified":false,"bootstrap_complete":false,"uncovered":[{"feature":"completion","phase":"before_completion","path":"owned-path","minimum_tier":0}]}
```

`currentInstallationPlan` is unchanged and still requires independently retained identity, `plan_complete:true`, scope/source/adopted commit/manifest/dependencies/freshness. Legacy retained format-1 plans are tested. `mapping_complete` never substitutes for admission. `installation_verified` derives only from all selected registrations' current authenticated formal readback, including enablement/restart/failure facts; it grants no effect permission and never claims publication.

Dispositions retain the legacy `unknown` label and add `assessment_state:to_be_assessed`, reason, scoped attributable evidence, consequence and next action. Host-authenticated `requirement_assessments` can support an exact uncovered requirement's unsupported/unauthorized/blocked conclusion; blocked entries need dependency, responsible actor, alternatives and resume evidence. No evidence/authenticator is obtained from model-supplied shape alone. Missing/foreign/stale/malformed capability inventory cannot manufacture complete mapping. Negative observations participate in expiry.

Optional path fields `effect_class`, `resource_class`, `authority_scope` now distinguish requirements on a shared phase/path. Binding capabilities must explicitly cover them through `effect_classes`, `resource_classes`, `authority_scopes`; those arrays are retained in invocation identity. Omission cannot widen explicitly qualified scope. `coversDimensions` is an added reference adapter helper, not an endpoint or universal runtime mechanism. Native dispatch/negative response handling is unchanged.

## Requirement and negative-case traceability

All listed source/code changes are applied and read back. All test references below were actually run and passed in the final candidate; they are producer/synthetic assurance, never evidence of installed interception. The dossier mentions AC-01–AC-14 without defining fourteen separately numbered predicates; this report does not invent that numbering. It covers the concrete stated acceptance cases through the actual stable tests.

| Supplied mapping points | Implemented/retained evidence |
| --- | --- |
| 1–3: vocabulary, source authority, current scope | Line 129; existing manifest/source identities and scoped host provenance; REL-ENF-047/048/052/055. |
| 4–6: need expansion, applicability, actual capability states | Optional effect/resource/authority dimensions, explicit phase/path closure and conditional delegation/recovery; REL-ENF-048/049/057/059. Unknown/missing evidence remains unassessed. |
| 7–10: inventory versus selection, semantic compatibility, strongest/complementary controls, sharing | Existing strongest/role/blocking planner plus new dimension matching; REL-ENF-026–028/032–038/050/051/059. A shared registration has separately checked roles. |
| 11–13: alternate paths, every disposition, mapping versus coverage | Line 129, reasoned diagnostic fields; REL-ENF-048/050/056/057/059. Zero registrations can complete diagnostic mapping only with explicit justified host assessments; legacy installation guard remains false. |
| 14–15: states and authorized preparation before verification | Line 847, BOOT-12/13; REL-ENF-052/054/058, REL-SETUP existing installation/publication cases. No preceding state establishes its successor. |
| 16–18: normalized events, semantic/observed evidence, mandatory failure propagation | Existing trusted adapter envelope, strict correlation and role semantics preserved; REL-ENF-002/006–011/017/029/030/035/040/043–046 and REL-ENTRY-019. Malformed/new/inconsistent response, timeout, denial, unknown/error remain non-authorizing. |
| 19–21: approvals, sufficient formal readback, no universal mechanism/probe | BOOT-01, SYS-04/05, existing SYS-07/UX/CTRL; REL-ENF-041–046/054/058 and REL-ENTRY-014–016/019. Formal enablement has no additional active-hook trial prerequisite; no host trust bypass. |
| 22–24: independent continuation, exact blocker, proportional recovery | Lines 129/847/3117/3119 and existing UX-04/07; REL-ENF-053/056/057/059, retained installation checkpoint/publication tests. Preserve partial selected bindings and native entrypoints; recheck dependent facts rather than assume readiness. |
| 25–27: verified acceptance/publication, maintainer regressions, technology neutrality | BOOT-12 coverage guard and unchanged BOOT-13; REL-ENF-054/058, REL-ENTRY-015–019; full 235 producer and 170 maintainer tests. Conditional GitHub example only; no new universal hook/service/protocol. |

Focused new regressions:

- REL-ENF-056: unauthorized, unavailable and disabled mandatory completion capability each produces its distinct disposition, preserves independent registrations, and cannot pass installation/effect guards.
- REL-ENF-057: empty inventory is unassessed; all exact authenticated negative assessments can complete mapping without coverage; missing blocked resume condition, malformed/duplicate assessment collections and model origin cannot certify mapping.
- REL-ENF-058: planned adequate coverage is not installed readback; verified registration/enablement/restart/failure evidence can establish scoped installation but never publication/effect authority; missing required evidence fails; old retained format-1 plans still pass the unchanged current-plan guard when genuinely complete.
- REL-ENF-059: negative evidence expiry and malformed/foreign inventory prevent complete mapping; newly applicable delegation requires remapping; same path with distinct effect/resource/authority classes stays uncovered until explicitly matched, and wrong authority fails coverage.
- REL-ENTRY-019: generated rules preserve signing and higher-policy gates, minimum necessary secrets, conditional passphrase-less SSH, logical versus provider identity, scoped install authorization and separate trust, unassessed discovery and adequate BOOT-12 coverage; documentation contains only the required conditional public-key enrollment directions.

## Proposed Changes

**Impact notice: PROP-01, PROP-02, PROP-03, PROP-04 require canonical runtime changes and derived regeneration (REQUIRED); both operations were performed. No maintainer appendix edit was necessary.**

1. **PROP-01 — Minimum necessary credentials [F-01; P1; implemented locally]**
   - **Scope and artifacts:** runtime, maintainer, documentation; canonical security/shared bootstrap clauses, BOOT-08/11, derived security/bootstrap, README and producer tests.
   - **Problem:** existing preparation language permitted unnecessary signing secrets and unusable unattended passphrases; user-reported adoption is an observation supplied in the dossier, not a reproduced live runtime test.
   - **Before example:** illustrative unsigned operations SSH setup creates authentication plus a separate signing key.
   - **Proposed change and after example:** derive minimum purposes and reuse eligible files; eligible unsigned unattended SSH prepares only one protected authentication key without a passphrase, preserving stronger policy and actually mandatory signing.
   - **Source and distribution impact:** Canonical normative source: REQUIRED — credential obligations changed; Derived distribution regeneration: REQUIRED — affected clauses regenerated; Enforcement engine impact: SOURCE_BINDING_ONLY — controller source/wire comparison passed, no installed verification.
   - **Pros and cons:** intended lower secret/setup burden; passphrase-less theft exposure requires file/isolation controls; measured savings unavailable and additional truly necessary scoped credentials remain possible.
2. **PROP-02 — Scoped minimal provider enrollment [F-01; P1; implemented locally]**
   - **Scope and artifacts:** runtime, maintainer, documentation, human user; identity/repository-purpose relation, BOOT-10/11, generated security/bootstrap, conditional examples and producer tests.
   - **Problem:** enrollment titles do not prove provider identity or rights across repositories; redundant signing enrollment increases human work.
   - **Before example:** illustrative deploy key title is treated as a provider account and multi-repository permission.
   - **Proposed change and after example:** independently verify principal and repository scope; eligible `dabotto/operations` case has one public-only creation/access/deploy-key request, with signing enrollment only when needed.
   - **Source and distribution impact:** Canonical normative source: REQUIRED — identity and enrollment obligations changed; Derived distribution regeneration: REQUIRED — affected clauses regenerated; Enforcement engine impact: SOURCE_BINDING_ONLY — source references updated, no provider enrollment or native installation executed.
   - **Pros and cons:** intended fewer prompts and clearer least privilege; each additional expressly authorized repository may require an independent credential/verification.
3. **PROP-03 — Scoped setup authority [F-02; P1; implemented locally]**
   - **Scope and artifacts:** runtime, maintainer, documentation, human user; BOOT-01, SYS-04/05, bootstrap distribution and trust/continuation regressions.
   - **Problem:** unnecessary generic approvals or premature stopping when disabled controls can be safely repaired.
   - **Before example:** illustrative hook-disabled report ends setup despite an available authorized repair.
   - **Proposed change and after example:** use install intent for necessary safe owned setup/repair; retain independent native trust/admin gates and independent continuation.
   - **Source and distribution impact:** Canonical normative source: REQUIRED — setup authority clarified; Derived distribution regeneration: REQUIRED — affected clauses regenerated; Enforcement engine impact: SOURCE_BINDING_ONLY — executable gates unchanged, known disablement/trust limitations still block dependent readiness.
   - **Pros and cons:** intended fewer interruptions; actual host policy may still prevent full installation, and neither wording nor producer tests activate native hooks.
4. **PROP-04 — Mapping, coverage and installation facts [F-03; P1; implemented locally]**
   - **Scope and artifacts:** runtime, maintainer, documentation; strongest-enforcement/materialization/BOOT-12 clauses, install planner, reference adapter, reviewed ledger, generated contracts and targeted regressions.
   - **Problem:** legacy completeness exposes planned coverage without a separate reasoned diagnostic completeness fact.
   - **Before example:** illustrative disabled completion integration yields only `plan_complete:false`.
   - **Proposed change and after example:** versioned additive diagnostic fields and explicit scoped dispositions can yield mapping true, coverage false, installation false; no readiness guard is weakened. Qualified path dimensions cannot silently collapse.
   - **Source and distribution impact:** Canonical normative source: REQUIRED — mapping and coverage distinctions formalized; Derived distribution regeneration: REQUIRED — affected clauses regenerated; Enforcement engine impact: INTERFACE_CHANGED — aggregate planner/adapter extension, controller source bindings only; Interface compatibility: compatible_extension for current permissive readers, adaptation required for strict external readers; Before interface: `plan_complete:false` and uncovered requirements; After interface: same guard plus `diagnostics_format:1`, distinct mapping/coverage/installation facts and reasoned dispositions, optional qualified scope matching. Executed tests cover both retained legacy and new diagnostic behavior; no real adapter installation is claimed.
   - **Pros and cons:** more actionable blockers and retained partial work; larger diagnostic payload, host provenance obligations and strict-reader adaptation; real savings remain unmeasured.

## Final Change-Impact Verdict

- **Canonical normative source change: REQUIRED — PROP-01, PROP-02, PROP-03, PROP-04** revise five complete runtime clauses; no maintainer appendix edit.
- **Derived distribution regeneration: REQUIRED — PROP-01, PROP-02, PROP-03, PROP-04** affect generated runtime contracts; generation and content-candidate acceptance passed, without consumer adoption/installation.
- **Enforcement engine impact: INTERFACE_CHANGED — reference planner/adapter diagnostics and optional scoped matching extend the contract.** Controller executable semantics have source-binding-only changes after exact code/command/guard comparison; Interface compatibility: compatible_extension for current permissive readers, adaptation required for strict external readers; Before interface: legacy `plan_complete` coverage result; After interface: preserved guard plus versioned diagnostic fields and qualified scope matching.
- **Freeze decision:** freeze the verified local candidate within the approved four-proposal scope. No additional fix remains from this implementation review. Committed release, remote publication/CI, native integration and historical comparative efficiency remain outside the performed/verified effects. All new work is uncommitted/unpushed; the specified commit message is proposed only.
