# Installation identity, ticket history and native bridge implementation

## Subject and authority

Owner-authorized APPLY of PROP-01 through PROP-04 and the consolidated R01-R23 requirements. Baseline: `main` at `d15d45391efb918c58ba0ef8d8f5241dd62787ab`. This report binds source content `sha256:f674c89910e8da46cd6cb2221a3e0b1f26512f95628e47dc3a733b35be8ddae5`; it is prepared before its containing commit and does not invent a future commit or prove publication/adoption.

All 23 supplied requirement blocks are retained completely in the canonical runtime source. Explicit reconciliation replaces combined technical installation publication with identity-only registration, and introduces a bridge-only native-shell exception to technology neutrality. No consumer installation, provider administration, force push or unrelated workspace change is included.

## Purpose alignment

- Abstract: updated to distinguish canonical identity registration from private technical readiness.
- Vision: unchanged; organizational continuity and replaceable external AI remain the research objective.
- Goal: unchanged; proportionate portable governance and measured outcomes remain objectives, not observed savings.
- Introduction: updated to describe the same identity/local-state distinction.

The implementation preserves Organization as Code, canonical organizational knowledge, cross-domain CI/CD, human authority, Solopreneur applicability and adequate free/local mechanisms. No new service is required. Exact history lists and host documentation have initial/migration/retention costs; end-to-end savings remain unmeasured.

## Implemented package

1. PROP-01: persistent installation UID, exact six-field identity schema, qualified local mapping, distinct instruction origin/executor, event attribution and durable deletion origin. Initial registry enrollment requires independently verified local identity and authority, without the circular requirement that its UID already exist in the registry. Ticket attribution still requires registration.
2. PROP-02: BOOT-13 registers only organizational identity. Readiness, adopted revision, approvals, receipts and publication checkpoints stay local. Registration failure preserves completed administrative installation. Migration preparation retains every legacy value locally and requires explicit disposition of unclassified/material organizational fields; a prepared snapshot is not another current adoption checkpoint or proof of applied preservation.
3. PROP-03: deterministic authoring is separate from nonmutating validation. Actual predecessor, unchanged list prefix, retained same-ticket snapshots, lineage and event provenance are checked. Conditional backend publication revalidates inside the transaction, requires independent publication authority/identity/signing facts and observes canonical content. Unchanged tickets gain no artificial append. Unknown legacy history and same-identity recreation after deletion remain dependent blockers.
4. PROP-04: one active native-shell bridge per installation/workspace/host, official version/host documentation, exact base/host declarations, necessary minimum scope and registration sources, unrelated-content preservation and stale-write rejection. Configuration evidence is bound into the plan/frozen package. Administrative preparation is not functionality certification; C/U/R/E and later-chat wrapper restrictions remain.

The standalone official controller embeds the new reference predicates. `dist/installation-contract.json` supplies the closed identity schema and typed mutation/configuration contract. Bootstrap format 6 supersedes 5; installation manifest format 3 supersedes 2. Receipt contract 2, eight controller commands, response envelope and exits 0/2/3/4 remain. Bootstrap observation fields are losslessly referenced once through `#observation_fields`, reducing repeated metadata while preserving complete canonical clauses.

## Source changes and practical examples

All changes below are attributable to the approved package. Baseline lines refer to the commit above; current lines refer to this source-content identity. Examples illustrate consequences and are not additional executed tests.

### Identity and private technical state

Added R01-R03/R07-R10 at current lines 546-637, after baseline line 545. Modified canonical publication wording at baseline lines 1198, 3170, 3211, 3214, 3237 and 3274, corresponding to current lines 1331, 3460, 3501, 3504, 3527 and 3564. Identity registration replaces technical publication without removing local prerequisites or real credential/signature/readback checks.

- Before: two deployments could use the same runtime class without a required installation UID. After: independent deployments use distinct persistent UIDs and independently owned qualified checkpoints.
- Before: BOOT-13 published installation status, adopted source revision and receipt references. After: its organizational record has exactly six identity fields; those technical facts remain local.

### Ticket attribution and exact history

Added R04-R06/R11-R20 at current lines 1956-2105, after baseline line 1815. Creation, metadata edits, lifecycle entries and deletion gain causal installation attribution; previous-state lists bind to the actual current predecessor, with truthful migration, retrieval, retention and locator continuity.

- Before: general history requirements did not prescribe the exact list for a ticket previously storing `[A]`. After: a modification after actual predecessor B requires `[A, B]`, even when B changed an unrelated file.
- Before: no mandatory installation-origin deletion field was specified. After: a commit-message deletion requires exactly one complete `Installation-UID` trailer, with separately verified deletion authority and retention.

### Native bridge and documented configuration

Added R21-R23 at current lines 1071-1111, after baseline line 978; modified the narrow exceptions at baseline/current line 333 and baseline 3115/current 3405, plus generic sharing at baseline 630/current 722. The new language constraint applies only to bridge adaptation; other technology-neutral safeguards remain.

- Before: bridge adaptation could use a general application interpreter. After: executable adaptation uses one eligible host-native shell, while the official controller retains its own execution facility.
- Before: documentation-based discovery did not prescribe the complete base/host/minimum-source contract. After: required generic declarations coexist with applicable documented host overrides, with no guessed alias, redundant registration or unnecessary global copy.

### Coordinated migration

Added current lines 1510-1516 after baseline line 1376. Current descriptors explicitly require organizational identity/history transformation, retain all prior supported profiles, gate incompatible writers and distinguish organization-owned effects from local checkpoint reconciliation.

- Before: current operations migration declared no organizational transformation. After: affected active identity/ticket state has explicit transformation, preservation, verification and recovery requirements.
- Before: generic recovery did not specify preservation before registry reduction. After: retain and verify local technical values and canonical material consequences before conditional identity publication; joining runtimes verify shared completed work without replay.

Abstract/Introduction edits are explanatory. There are no maintainer appendix edits. Derived relocation/metadata changes are separately represented in source-to-contract traceability, not misclassified as additional runtime obligations.

## Performed evidence

Final candidate snapshot: `2026-10-24T11:48:35.365Z`, Node `v24.22.1`.

- 322 producer observations, 322 unique IDs, 322 passed, zero failed/skipped/missing/unexpected; includes 26 `REL-INSTALL` contract observations.
- 170 maintainer regression tests passed.
- All seven current-context measurements passed their current full-source comparison. Source reconstruction, reviewed allocation, source bindings, frozen subject and frozen checkout passed.
- Current source allocation: 11 explicitly changed clauses and 45 unchanged complete clauses preserved verbatim. No semantic content was removed to meet the context bound.
- Five additional local PowerShell-template executions on PowerShell `7.6.5`: allow/deny/unknown/error preserved exits 0/2/3/4, and a mismatched expected source was rejected with exit 4. Inputs were synthetic producer observations; no native runtime registration or real project effect was attempted.

An earlier sandbox run failed Git/atomic-replacement fixtures and skipped unavailable link tests; these results were retained as failed, never promoted to PASS. The final capable local run exercised the required fixtures without skips. A template review also found automatic JSON timestamp conversion rejecting a valid allow response; the template now preserves timestamp strings explicitly. Microsoft documents `ConvertFrom-Json -DateKind String` and its PowerShell 7.5 introduction at [the official command documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/convertfrom-json?view=powershell-7.5#-datekind). This conditional template requires PowerShell 7.5 or newer; it introduces no universal PowerShell requirement.

## Enforcement interface and verification limits

Enforcement engine impact: **INTERFACE_CHANGED**, **adapter_required**. Before: generic session/checkpoint evidence and technical installation-record publication. After: `pre-effect` for `ticket_mutation`/`identity_registry_mutation` requires `organizational_mutation` with proposal and privileged current observations, plus installation/instruction-origin identity binding. BOOT-13 guards use `identity_registration_*`; planner input includes documented native configuration. Response shape, eight commands and exit meanings are unchanged. Applied and producer-tested; installed/provider/cross-runtime verification is **NOT VERIFIED**.

Predicates do not authenticate caller-supplied facts, create permissions, implement a real durable backend or prove independent prevention. The conditional in-memory store tests are not a deployed repository adapter. The PowerShell file is a conditional producer template, not a registered Codex hook. Native consent/restart, actual runtime-specific event translation and trusted registration remain the consumer's applicable administrative work.

No independently trusted rolling historical acceptance bundle was supplied. Historical source-regression and efficiency comparison are **NOT VERIFIED**, rather than PASS or a reason to invent history. Current candidate validation is distinct from committed release readiness, remote publication, CI and consumer adoption; those require their own actual observations after commit/publication.
