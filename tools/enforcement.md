# Official derived enforcement controller

`PROTOCOL.md` is the sole normative runtime authority. `dist/oop-enforce.js` is generated software, source-bound through the reviewed producer and containing OOP Git revision. It introduces no second protocol version. The current implementation is a dependency-free, stateless Node.js 24 CLI that launches in both CommonJS and module-typed directories. Node 24.19.0 was actually available for producer tests; consumer adapters must discover their real supported interpreter. No npm install, package.json, daemon, network or mandatory paid infrastructure is required.

Run `node dist/oop-enforce.js probe` with `{"format":1,"request_id":"local-probe"}` on stdin. It returns `unknown`, exit 3, because interpreter availability alone cannot verify installed interception. JSON schemas, command timing, required observations and complete-clause mappings are in `dist/interfaces.json#enforcement`. Inputs are UTF-8 JSON, at most 1 MiB, with a five-second stdin deadline. stdout contains one JSON object and a newline; errors never reflect payloads or parser exceptions. stderr has no payload diagnostics. CLI flags beyond the single command are rejected. Hosts must impose their own total execution timeout and output bound.

| Command | Timing and result | Mutations and limits |
| --- | --- | --- |
| entry | Before substantive work; full selected clause manifest and unresolved semantic questions, always unknown | Read-only; does not install or grant authority |
| interaction | Before reasoning; same deterministic reference closure, always unknown | Read-only; adapter delivers complete clauses and authoritative facts |
| pre-effect | At the effective effect boundary; allow only with all independently obtained required predicates | Read-only; adapter prevents actual effects and preserves backend revision checks |
| post-effect | After an attempted effect; validate observed outcomes and postconditions | Read-only; cannot undo partial effects |
| completion | Before a success claim; require tests, deliverables, documentation, dependencies, actual effects and complete semantic residuals | Read-only; no arbitrary text semantic certification |
| recovery | Before dependent resumption; check owned journal phase, actual dispatch/checkpoint reconciliation, exclusive update and ongoing users | Read-only admission; adapter implements persistence, locking and recovery |
| delegate | Before accepting delegated completion; require independently verified destination adoption, controls, scope and completion | Read-only; does not launch agents or transfer parent adoption |
| probe | Interpreter/interface diagnostic, always unknown until an external installed-path test establishes coverage | Read-only; cannot certify its own host registration |

All admission responses use `format:1`, `type:oop_admission`, `request_id`, `command`, `source_binding`, `decision`, `reason_code`, `effect_permission`, `assurance` and `payload`. Only `allow`, `deny`, `unknown` and `error` are decisions. Exits are respectively 0, 2, 3 and 4. `needs_evidence`, `needs_semantic_judgment`, `installed_path_not_verified` and `recovery_required` are non-authorizing reason codes. Context, diagnostics, post-effect, completion, recovery and delegation do not grant new effects. A pre-effect allow is conditional on the adapter's independent evidence and timely actual enforcement; a model-authored request cannot create permission. Unknown types/statuses, mismatched correlation, malformed output, absent hook, timeout and errors block the dependent effect. Independent safe work and correction remain possible.

Historical first introduction: all eight contact points were new. These examples describe that introduction; the follow-up diagnostic change below is relative to the published oop-admission-1 predecessor:

| Contact point | Before | After example and adapter consequence |
| --- | --- | --- |
| entry | No official entry command | `entry` plus known information scope returns unknown/needs_semantic_judgment with Core and complete module paths; deliver context before work |
| interaction | Closure implemented by each runtime | `interaction` plus due_update returns a non-authorizing manifest and lossless migration context; interpret shared policy references and unresolved questions |
| pre-effect | No shared admission output | Missing authority returns unknown/needs_evidence, exit 3; prevent the actual dependent effect |
| post-effect | No common observed-outcome gate | Missing actual_effects_observed returns unknown/needs_evidence; preserve partial effects and withhold verification |
| completion | No common structured completion gate | Missing tests_verified returns unknown/needs_evidence; prevent success claims and continue authorized repair |
| recovery | No shared journal admission | Foreign journal owner returns unknown/recovery_required; preserve active/checkpoint and reconcile under owned authority |
| delegate | No shared destination-completion check | Missing destination_adoption_verified returns unknown/needs_evidence; withhold delegated completion acceptance |
| probe | File existence could be mistaken for installation | `probe` returns unknown/installed_path_not_verified, exit 3; separately test native dispatch and prevention |

The stdin envelope, response fields and four exit statuses are all additions. Before: no official schema or exit mapping. After: the adapter correlates format/type/request/command, recognizes only the four decisions and blocks malformed/new outputs. No extra top-level needs_evidence response type is introduced. Exit 0 for a pre-effect response is necessary but insufficient without the exact typed conditional allow.

The privileged adapter must supply a current clock reading, exact project/runtime/full OOP commit, revision, authority, resource, risk, lifecycle and context-retention identities, and non-secret dependency references. Each required observation carries `value`, `origin:authoritative_observation`, a reference, matching identity binding (including command, selected module list and effect class), matching dependencies, observation time and expiry. Missing, inferred, stale, mismatched and future observations cannot satisfy a predicate. The JSON validator cannot authenticate origins or prove that the adapter's clock, authority or observations are true. Treat the entire stdin channel as privileged: never pass model-supplied evidence through it as authenticated input. Raw secrets and complete private records belong outside this channel, argv, diagnostics and public fixtures.

Routing directly reuses the reviewed reference functions and all 64 facets. Every one of the 56 complete source clauses has an explicit deterministic/residual mapping. The engine checks closure, evidence bindings, mandatory predicate presence, BOOT guard facts, predecessor verification and allowed transition preconditions. It does not decide the complete English clause semantically. Each selected clause requires an independently evaluated `semantic:<contract-id>` observation before admission. The adapter must derive all applicable guards from authoritative scope: `mandatory_guards_complete` cannot be a model promise. Scope changes rerun closure; full Core and complete governing clauses remain available through manifest module paths. Manifest creation does not prove effective context delivery or reduce norms. No JSON artifacts were deleted: inspectability, source reconstruction and existing readers remain supported.

`tools/enforcement-adapter.cjs` is an executable local example. Its callback is gated by the actual child-process result, and tests inspect a disposable file to prove allowed and prevented effects through that local path. Its interpreter/cwd/timeout/exit/output mapping is exercised. This is not a registered Codex hook and covers no alternative tool/provider paths. A provider adapter must independently inventory actual events, register effective interception, test native allow/deny/error propagation and all claimed paths, invalidate proof after material configuration changes, and implement stop/delegate coverage where supported. Live installed provider, cross-runtime adoption and Full OOP suitability remain NOT VERIFIED. No unsupported vendor hook names are invented.

The context extension deduplicates identical migration policy objects and repeated engine dispositions into explicit shared references. Every fingerprint, stable profile ID, per-profile review attribution and policy value remains present; `expandMigrationContext` reconstructs the original descriptors exactly as JSON objects. Complete normative clauses are not compacted. Existing stored migration JSON and old readers remain unchanged. The official engine embeds this source-bound projection and returns it only when migration context is selected; the producer reference assembler includes the same projection. Source-review identities and round-trip tests guard this new representation. Measurements count selected projection bytes separately from full stored JSON and actual JS load bytes. It is a local assembly measurement, not verified model delivery.

## Adoption and recovery

The existing migration index/runtime/compatibility descriptors explicitly distinguish no prior engine, active engine and interrupted candidate. The diagnostic follow-up has impact `INTERFACE_CHANGED`, conservative aggregate compatibility `adapter_required`, action `adapter_update_required`. Its published predecessor is `oop-admission-1` at `9e8ff87a096d484ff56c03358019da130a78d97d`. Missing/excess argv previously returned `error/unsupported_command`, exit 4; now it returns `error/invalid_arguments`, exit 4. Explicit unknown commands keep `unsupported_command`. No command, top-level decision or exit was added. Existing exit-4 fail-closed consumers can copy and probe; consumers matching diagnostic reasons need adapter review/update; unknown consumer behavior blocks adoption. Initial no-engine integration remains a separate supported input requiring an adapter. Existing common/operations state schemas and all prior support profiles remain unchanged; runtime integration/probes are independently required. Future internal-only changes can use copy-only only after applicable probes and evidence refresh; unknown code/interface impact requires blocked recovery.

Adapters own durable effects; this stateless engine is deliberately not a filesystem installer. Use one active controller and at most one ordinary temporary candidate in the runtime-owned protected private area or valid equivalent. Hold an exclusive scoped update lock/CAS, journal intent and expected prior revision, stage, classify compatibility, update the adapter, test installed allow and deny, then activate and verify actual dispatch before advancing only the owner's checkpoint. Supported journal phases are `staged`, `probed`, `activated_pending_checkpoint`, `checkpointed` and `cleanup_pending`. A crash between rename and checkpoint requires observing actual dispatch and reconciling the journal; rename and checkpoint are not atomic together. Preserve the verified active during failed staging, record partial effects and retain only code needed by ongoing invocations or recovery. Cleanup is forbidden until that need ends. No snapshots registry or historical executable accumulation is required. Recovery admission checks supplied proof; real locks, crashes, permission enforcement, rollback and cleanup in an installed adapter remain NOT VERIFIED by these stateless tests.

## Producer review and measurements

Change the producer template/mapping, review its semantic boundaries and update the explicit implementation/contract identities in `release-review.json`; run generation, focused tests and candidate acceptance. Source-binding-only and appendix-only changes still require an explicit assessment. Generation refuses stale implementation/contract review, uses the safe full output plan, and includes JS in acceptance subjects. Migration schema and semantic validation reject missing or contradictory engine impact. Current-content candidate acceptance never certifies a commit, publication or adoption. Report validation checks only captured English/Italian structure and declared consistency, retaining six fields and two independent impact verdicts.

The engine and test harness decisions are separate: Node is the initial portable JSON CLI, while `node:test` retains the existing producer runner without dependencies. Bun requires another interpreter and measured compatibility; native Rust requires maintained platform binaries; WASM requires a supporting host; Python offers no demonstrated benefit for this repository. None was benchmarked as an equivalent implementation. There is no verified basis to require another language/runtime or runner. Node cold process p50/p95/p99, warm routing, peak RSS and identical eight-case selected-byte measurements are recorded by `node tools/enforcement-benchmark.mjs`. Before/after evidence distinguishes physical package growth from selected governing bytes. Delivered model tokens, provider hook-to-effect latency, model time, monetary savings and real output-quality improvements remain unmeasured. Local evidence rejection establishes only the tested output gate, not semantic truth or organizational effectiveness.

## Reference adapter follow-up

The example API now requires privileged `options.expectedSourceBinding`, obtained independently from verified runtime-local installed/adopted metadata. For example, call `guardedEffect(request, effect, {expectedSourceBinding: trustedLocalBinding})`. Never copy the expected value from model input, the request, or the response under examination. The host authenticates this option outside the reference API; a caller controlling privileged options can defeat that boundary. The source-content binding is subordinate metadata, separate from full Git commit adoption and from actual execution authority; consumers do not audit the OOP repository to obtain it. Missing or mismatched bindings prevent effects. This adapter interface change is separate from the official controller diagnostic change.

Before: `guardedEffect(request, asyncEffect)` returned `{performed:true}` immediately. After: missing trusted options returns a non-admission reason; admitted asynchronous callbacks return `{attempted:true, performed:null, completion:'pending', verified:false, completionResult}`. Await `completionResult` to observe settlement. Synchronous callers still receive a direct result. A normal callback return has `completion:'returned', performed:true, verified:false`: this means only that invocation returned normally. Throw/rejection returns `performed:null, completion:'failed', reason:'unknown_partial_effect'`; reconcile actual state before retry. Exception contents are not returned.

An optional privileged `verifyEffect(value)` performs authoritative backend readback; only exact `true` produces `verified:true, completion:'readback'`. Failed, rejected, thrown or unavailable readback never verifies postconditions. Async readback also remains pending until settlement. Hosts must keep authority, scope, revision and conditional backend writes valid at the effective boundary. Response validation fails closed on extra top-level fields, malformed allow payloads, novel types/decisions, mismatched correlation, exit status or expected source binding, failed interpreter, signal, timeout and oversized stdout. Local fixture tests do not establish native hook coverage.

The follow-up benchmark can be reproduced with `node tools/enforcement-benchmark.mjs --followup`; it writes a separate observation and preserves the frozen before/after records. Its historical comparison uses only common `selected_context_bytes`, not an invented historical selected-total value. See `tools/evidence/enforcement-followup-coverage.json` for the bounded native verification inventory and future observation protocol.

## Install-only reference planning

`planBindings(capabilities, requirements, dependencies, installed)` is a pure host-independent planner. Requirements name feature, path, phase and minimum enforcement tier. Authenticated host capability records name registration/fingerprint, features, paths, phases, semantics, tier, availability, authorization and disabled/blocking state. The host owns the truth of those observations. Selection preserves the strongest tier per required path before reusing compatible registrations. Preventive features reject observation-only mechanisms. `dispatchBinding` requires an independently selected `options.expectedBinding` and uses host-classified `event.recovery_required` to select recovery at session entry. It invokes every applicable selected feature in dependency order, bounding each controller invocation (default six seconds) and accumulates failures; its result never installs hooks or verifies a provider. Existing strict pre-effect response admission remains required. Capability data is not authority merely because this API accepts it.

One pass: discover only applicable capabilities → plan → configure each missing registration/read back once (at most two transient attempts) → persist owned dependencies/readback → report `INSTALLED_UNVERIFIED`. An interrupted write requires actual-state reconciliation; configuration readback does not prove dispatch or denial. Repeating with matching scoped dependencies/readback returns reuse. Runtime/source/permissions/configuration or path changes invalidate only affected evidence. Project identity/adoption remains separate from reusable environment controls.

After bootstrap, current independently attributable dispatch/deny evidence may support scoped `ACTIVE_VERIFIED`. The first allowed invocation alone never proves denial. If a dependent guarantee remains unknown, block the dependent effect or use an independently verified adequate alternative. Full BOOT-13 guards and operations readiness remain mandatory. No provider events or integration are asserted here; unsupported interpreter/native interception stays explicitly limited. Producer mocks and local callback tests cannot certify installed native behavior.

## Semantic capability selection and local API compatibility

This follow-up changes only the local reference API. The official eight-command controller, activation vocabulary, admission envelope, exits and migration descriptors are unchanged. Safe legacy single-role capabilities remain accepted: context delivery for entry/interaction, observation for post-effect, preventive gates for pre-effect/recovery/delegate, and diagnostic semantics for probe. Completion requires blocking; a legacy blocking preventive gate remains sufficient. All preventive features also require `blocking:true`. No other cross-role equivalence is inferred, and a higher-tier incompatible observer cannot displace adequate prevention.

Before: a context-only capability advertising post-effect could cover it; a generic preventive declaration advertising entry/recovery was accepted without establishing context delivery. After: the former stays uncovered; a shared session registration explicitly declares its actual roles:

```js
const sharedSession = {
  id: 'session', registration: 'session', fingerprint: 'host-readback-reference',
  features: ['entry', 'recovery'], paths: ['session'], phases: ['session_entry'],
  semantics: 'preventive_gate',
  feature_semantics: {entry: 'context_delivery', recovery: 'preventive_gate'},
  tier: 1, available: true, authorized: true, disabled: false, blocking: true
};
```

The host authenticates these declarations. The optional `feature_semantics` map must name every advertised feature exactly once with one known role per feature. The base `semantics` value must be among those roles. Missing, unknown, array-valued or contradictory maps are rejected; incompatible individual requirements remain uncovered. Feature names alone never imply roles. Registration IDs with divergent fingerprints, roles, phases, paths, blocking behavior, scope or provenance fail closed as conflicting invocations. A compatible registration can span explicit phases. Coverage lists include only requirements actually assigned to that registration, avoiding redundant weaker coverage.

Plans add `diagnostic_plans`; ordinary registration records add selected `feature_semantics` and the full trusted `invocation` description. Strict local consumers must review these fields and `DIAGNOSTIC_PLANNED` before adoption; unknown consumers remain blocked. Existing four-argument callers still plan ordinary controls. Stored readback lacking matching invocation/role metadata cannot support reuse: reconcile/read back actual configuration once without hook trials. Changed roles or provenance invalidate affected reuse even if the registration label is unchanged.

Legacy `dispatch_verified`, `denial_verified` and `dependencies_current` flags alone now leave assurance at `INSTALLED_UNVERIFIED`. A trusted host can supply `capability.assurance_evidence` with `origin:'authoritative_observation'`, a nonempty `reference`, exact `dependencies`, selected `coverage`, full `invocation` and `scope`, valid `observed_at`/`expires_at` timestamps, and `dispatch_verified:true` plus `denial_verified:true` for preventive features. Privileged planner `options.scope` identifies project, runtime, authority and revision; `options.now` is current host epoch milliseconds. Evidence must match these identities and be current at that clock. The host authenticates origin, time and actual allowed/denied observations outside this API. Accepted fixture records establish no native behavior; every plan retains `full_readiness:false`.

## Deferred diagnostic intent

Before: every probe requirement returned `invalid_requirement`. After: the exact post-bootstrap phase and an independently authorized diagnostic mechanism can produce a separate non-authorizing plan. The optional fifth planner argument contains privileged host intent:

```js
// Illustrative placeholders: the host must independently establish every fact.
const requirement = {
  feature: 'probe', path: 'selected-diagnostic-path',
  phase: 'diagnostic_after_bootstrap', minimum_tier: 1
};
const scope = {project: 'project-id', runtime: 'runtime-id', authority: 'authority-id', revision: 'revision-id'};
const options = {
  lifecycle: 'post_bootstrap', scope,
  diagnostics: [{
    origin: 'authoritative_observation', authorized: true,
    scope, dependencies, requirement, max_invocations: 1,
    need_reference: 'host-observed-problem-reference',
    authorization_reference: 'independent-scoped-authorization-reference'
  }]
};
const plan = planBindings(capabilities, [requirement], dependencies, installed, options);
// plan.diagnostic_plans describes intent; it neither registers nor invokes anything.
```

Never populate privileged options from model-authored requests. Lifecycle, scope, dependencies, observed need and authorization must be authenticated by the host; strings/flags create no authority. Exactly one authorization must match each requirement. False, unknown, ambiguous or mismatched facts leave only that diagnostic uncovered. Diagnostic semantics are required; observation/prevention cannot masquerade as diagnosis. Add workspace, authority and other relevant invalidation identities to dependencies as needed; refresh host context when facts change or expire.

A diagnostic-only plan has `status:'DIAGNOSTIC_PLANNED'`, no ordinary registrations/configuration actions, zero active hook tests and no readiness/effect permission. Mixed plans retain ordinary coverage separately. Replanning performs no invocation. Entry, changed workspaces and readback never automatically run diagnostics. Reuse valid existing evidence before selecting necessary new diagnosis.

Later execution is a separate host-owned action. `dispatchBinding` requires independent `expectedBinding` and `options.planningContext` containing the still-current matching intent; absent/mismatched intent blocks invocation. The stateless planner/dispatcher has no durable budget ledger: the host must atomically reserve/consume the single authorized invocation, prevent replay, bound actual resource use and reconcile interruptions before retry. A saved plan is not a reusable execution token. Dispatcher timeout bounds waiting but cannot terminate arbitrary callbacks; the host must bound/cancel the underlying operation. Planning/installation runs no consumer hook trials, mock callbacks, smoke tests or producer suite. Official probe output remains `unknown/installed_path_not_verified`, exit 3, `effect_permission:'not_granted'`; diagnostic success cannot become permission, denial evidence or readiness.

## Passive measurement of genuine installation effort

The frozen `tools/evidence/enforcement-fast-bootstrap-measurements.json` remains historical synthetic planner evidence. Registration counts and simulated reuse do not measure a real install. Real installation time, tokens, credits and money remain `not_measured` in this work; no causal speed or economic saving is claimed.

Only during a future separately authorized genuine installation, with consent for passive measurement, reuse observations the host already emits. Never launch/repeat an install, hook test, diagnostic, model prompt, polling loop, monitor, provider scan or paid service to collect metrics. Missing quantities are `not_measured`, never zero. Actual host records remain outside the public repository unless separately authorized non-secret reporting is approved.

An optional private record can use this illustrative format; it is not an executed measurement:

```json
{
  "kind": "passive_install_observation_example",
  "status": "synthetic_example_not_measured",
  "installation_authorization_reference": "not_measured",
  "measurement_consent_reference": "not_measured",
  "scope_reference": "not_measured",
  "runtime_build_reference": "not_measured",
  "configuration_reference": "not_measured",
  "host_clock_provenance": "not_measured",
  "started_at": "not_measured",
  "finished_at": "not_measured",
  "elapsed_ms": "not_measured",
  "configuration_actions": "not_measured",
  "retries": "not_measured",
  "eligible_invocations": "not_measured",
  "provider_usage_provenance": "not_measured",
  "usage_scope_and_units": "not_measured",
  "tokens": "not_measured",
  "credits": "not_measured",
  "money_and_currency": "not_measured"
}
```

Bind real observations to the authorized installation and consent, current project/runtime/build/configuration, source and interval. Derive elapsed time only from compatible authoritative timestamps; disclose interruptions and distinguish duration from active work. Count only observed attributable configuration actions, retries and eligible invocations. Existing provider counters require provider, scope, units, reporting interval and attribution limits. Do not infer prices or assign ordinary reasoning to hook installation without valid methodology; explicitly record unavailable counters.

Exclude secrets, raw payloads, private identifying paths and personal/account identifiers from reusable public evidence. Retain private provenance by secure reference. Compare only equivalent runtime/build, feature/path coverage, permissions, host conditions and installation objectives using the same method and validity window. Preserve frozen baselines and disclose missing/incompatible comparators instead of estimating savings. Documentation completes this deferrable proposal without new consumer work.
