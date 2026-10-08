# Machine registry and confined bridge maintenance — PROP-05–08

Approved scope: the user's APPLY following DIAGNOSE for machine installation records, machine-owner attribution, confined bridge maintenance and the canonical native bridge filename. Baseline: local and remotely observed main `14056c7315d0d0e0a6a24495308290ecd90e7eeb`. This is a source/producer change, not a consumer installation or an organizational migration executed in a consumer project.

## Canonical runtime change report

### Machine and runtime identities — PROP-05

Baseline PROTOCOL.md R02/R03 at lines 559/567 required a UID-qualified per-runtime record with six fields. Current PROTOCOL.md R02/R03 at lines 559/567 requires a public-credential machine filename/ID, machine owner name/email and human/agentic kind, with independent nested runtime UIDs, classes and immutable first-installation evidence. R07 retains local technical state and makes the narrow historical-date exception explicit. The public fingerprint is retained readably in the JSON; the filename encodes its complete scheme/fingerprint without truncation or secret hashing. Copied credentials do not prove distinct physical machines. Rotation retains aliases and runtime continuity. First and subsequent enrollment use conditional publication and peer-preserving readback.

Example 1 — BEFORE: runtime A and runtime B publish separate six-field installation files. AFTER: the same machine file contains A and B, while each keeps its own UID-qualified checkpoint.

Example 2 — BEFORE: the format-1 registry has no historical installation date. AFTER: a new runtime records actual prior BOOT-12 completion; an unprovable legacy date remains null/unknown_legacy, never today's recognition time.

### Machine-owner commits and executing-runtime ticket attribution — PROP-06

Baseline PROTOCOL.md lines 1349–1359 required the fabricated fixed worker pair and provider mapping; R04–R06 at lines 1960–1987 attributed instruction origin. Current machine-owner attribution at line 1373 requires the authoritative owner pair for new AI-created metadata, preserving genuine human authorship and independent provider/signature checks. Current R04–R06 at line 1984 attributes the actual executing runtime on future modifications/events/deletions; instruction origin stays separate causal provenance. Existing commits, ticket bytes, earlier events and exact previous_versions_list are preserved.

Example 1 — BEFORE: a newly created AI commit requires the fixed worker name/email. AFTER: author/committer use the verified machine owner pair, with effective metadata and actual commit object inspected independently of signing.

Example 2 — BEFORE: runtime B executes an instruction originating at runtime A and writes A's UID. AFTER: a new mutation writes B's UID and retains verifiable A-to-B causal provenance; earlier ticket attribution remains unchanged.

### Confined local bridge maintenance — PROP-07

Baseline PROTOCOL.md R21 at line 1075 required one bridge without a dedicated repair lane. Current R21/R24 at lines 1084/1123 adds independently observed local maintenance and a narrowly confined independent repair-entry exception. Every protected contact resolves actual owned mode even if the caller omits it. Current scope, machine/runtime, checkpoint/mapping revisions, authority, request/action, dependencies and freshness bind the observation. Unknown or crash-interrupted state never silently returns to normal. Exact bridge/declaration/candidate effects are checked; aliases, links, unrelated writes, credentials, controller changes, network, all Git commits/pushes, organizational mutations and delegation bypass are denied. Entry and exit require a declaration transition; exit also requires actual administrative reconciliation, consent/restart resolution and checkpoint coherence. INSTALL-13/14 remain binding.

Example 1 — BEFORE: a broken bridge can circularly block its own ordinary repair prerequisites. AFTER: an already-authorized repair can enter only the confined local lane using the last safe bridge or independent repair boundary.

Example 2 — BEFORE: no dedicated mode constrains subsequent operations publication. AFTER: an active local declaration blocks a commit/push even when the caller omits the maintenance field; a verified conditional exit is required first.

### Canonical native bridge filename — PROP-08

Baseline PROTOCOL.md R21 at line 1075 selected a native bridge without a fixed basename. Current R25 at line 1133 requires oop-enforce-bridge.<ext> in the runtime UID scope, with the documented default extension of the selected eligible host-native shell. Rename/replacement retains the safe active bridge, expected-revision journal, real approval/restart dependencies and inactive historical references.

Example 1 — BEFORE: a PowerShell bridge can use an arbitrary name such as bridge.ps1. AFTER: its active entry is exactly the owned oop-enforce-bridge.ps1.

Example 2 — BEFORE: a matching filename alone can appear plausible on another runtime. AFTER: maintenance/configuration require the exact resolved owned path and documented selected-shell extension, rejecting peer paths and aliases.

## Explanatory and maintainer-only changes

Abstract, Vision, Goal and Introduction are unchanged, with individual reasons in release-review.json. The package preserves Organization as Code, canonical external-reference-aware knowledge, replaceable AI, Solopreneur applicability, cross-domain collaboration and proportionate CI/CD. README adds an illustrative directory/JSON tree and explains machine versus runtime ownership. Examples, changelog and controller guides are updated. The maintainer appendix only replaces obsolete consumer fixed-worker terminology while preserving independently authorized maintainer identity and publication checks; that appendix is excluded from the consumer distribution.

## Derived implementation and migration

Source change: REQUIRED. Distribution regeneration: REQUIRED. Overall enforcement category: INTERFACE_CHANGED, adapter_required. Eight commands, admission response and exit meanings 0/2/3/4 remain; protected input contracts now require machine/runtime identity and a current privileged maintenance observation. Registry writes use machine schema 2 and verified metadata/enrollment facts. The installation planner checks the canonical native filename. The conditional PowerShell template is renamed to tools/templates/oop-enforce-bridge.ps1.

The machine ID and schema predicates, UID lookup, enrollment/rotation preservation, owner commit checks, future executor attribution and maintenance lane are producer-maintained reference mechanisms embedded in the official controller. They do not authenticate caller JSON, intercept host effects, persist native declarations or provide independent confinement by themselves. An installed adapter must observe local state and constrain actual effects independently. The conditional transport template and producer Node harness do not establish installed protection.

All baseline supported profiles remain unchanged. The new machine/maintenance profile and common/runtime/operations descriptors require evidence-backed grouping, old-writer gating, independent checkpoint preservation and existing ticket-byte/history preservation. No consumer credentials, private checkpoints, installation records or tickets were migrated by this maintainer APPLY.

## Validation and limits

The final precommit content checkpoint passed 334 product observations, 170 maintainer regressions, seven context measurements, exact source allocation/binding and frozen subject/checkout checks, with no skips. See release-acceptance.json, release-tests.tap and release-maintainer-tests.tap. Meaningful negative cases cover copied identities, exact filenames, global UID uniqueness, first-installation evidence, peer preservation, rotation, legacy unknown dates, concurrent enrollment, omitted/stale/foreign maintenance, actual forbidden effects, aliases, native extension and administrative exit.

A candidate checkpoint is not committed acceptance. Actual containing-commit acceptance and remote readback are performed after the separately authorized signed commit and ordinary push; current ignored evidence records that actual HEAD. Independent historical comparative efficiency/support evidence was not supplied and remains NOT VERIFIED. No installed consumer/provider/native efficacy, cross-runtime adoption or token/money savings are claimed. Semantic review was performed by the implementing maintainer AI, not an independent second reviewer.
