# Official derived enforcement controller

## Protected effects: adapter recipe and declared boundary

Keep seven facts distinct: discovered configuration; enablement in the actual execution
context; native trust/registration; handler invocation; decision interpretation and
propagation; observed effect outcome; and independently protected coverage. Reuse valid
scoped observations with their dependency/invalidation basis. Direct administrative
C/U/R/E receipts still complete installation without a second inspection API or
functional certification. An unmeasured path is unmeasured, not an installation failure
or observed prevention. An actual ignored denial or disabled guard stops dependent work.

For every independent prevention claim, identify the trusted authorities controlling
policy, authoritative evidence, verifier and dependencies, effect capabilities and
credentials. The governed actor may propose actions, but cannot supply authenticated
facts by labelling its own JSON `authoritative_observation`. Keep privileged options,
expected bindings, clocks and observations outside that actor's control. Inventory the
actual relevant direct/nested tools, delegates, services, interactive interfaces and
credential alternatives. Mediate or restrict each included route. An editable wrapper
with an unrestricted alternate capability is useful integration, not independent
prevention. State exclusions, context, assumptions and invalidation triggers; an
administrator controlling the boundary is outside the promised threat model.

Select existing supported native capability restrictions or effective pre-effect gates
for those routes; retain authoritative backend conditional writes for canonical work.
No broker, container, OS permission technology or hosted service is universal. If the
available boundary is insufficient for a mandatory protected effect, retain the scoped
blocker and independent safe work rather than silently claiming protection.

The minimal host-owned integration sequence is:

1. Resolve current workspace/binding, executing runtime's own adoption, applicable
   context, authorized request or valid continuation, effective scope and governance.
2. Obtain actual intended operation, target, resources, authority, relevant prior
   state/revision, required work-item facts and postconditions from their authoritative
   sources. A required work item is proportionate: G0 needs none and sufficient G1
   evidence remains sufficient. The actor's low-risk label is not an exemption.
3. Bind current observations to the actual proposed effect and continuity. Existing
   `context.dependencies` can carry host-derived intent and continuation identities;
   this is one optional representation, not a new schema or a mandatory per-prompt
   fingerprint. The host selects the matching operation/callback independently.
   `request_id` correlates messages; changing it neither grants authority nor makes
   reusable evidence invalid by itself. Reject foreign, expired, replayed one-use or
   materially substituted authority/effect evidence. Valid continuity may reuse facts.
4. Invoke the source-bound controller and correlate command, request, source and exit.
   Only an exact conditional pre-effect allow plus independent current authority can
   reach the affected capability. Missing dispatch, malformed output, error, timeout,
   unknown or deny cannot become permission. Timeout does not establish cancellation.
5. At execution, keep conditions current and use an expected-state/revision conditional
   write or equivalent where supported. Read back authoritative durable state and
   verify the actual outcome before success or a canonical lifecycle notification.
   A stale writer rereads and reconciles without silently overwriting a newer state.
6. Retain observed partial effects, failed checks and next permitted recovery action.
   Separate project execution and tracking systems do not provide distributed atomicity:
   if publication succeeds and tracking fails, reconcile tracking before retrying the
   publication. Use compensation only with actual authority and verified results.

### Necessary operations write capability

Whenever the runtime determines that authorized work needs canonical operations writes,
it must have verified project/destination/operation-eligible write capability before
effects depending on that persistence. Reuse still-valid access and authority without
redundant approval. If absent, complete safe authorized preparation and request only
the genuine minimum owner/provider grant when necessary; verify the resulting access
through the active adapter. Need does not self-grant privileges, remove a denial or
authorize ambient/foreign credentials. Keep dependent scope blocked and continue safe
independent work. G0 explanation does not require write access merely because operations
exists. Full install retains its separate mandatory read/write prerequisites.

### Bounded acceptance examples

The producer suite `effect-boundary.test.mjs` exercises the following observations.
It uses synthetic trusted host facts, real reference gates and two in-memory conditional
stores; it is not a native installation or independent protection against its test runner.

| Case | Required observable outcome |
| --- | --- |
| Lightweight work | Admitted effect proceeds without an artificial ticket. |
| Missing managed prerequisites/write access | Destination stays unchanged; bounded recovery remains possible. |
| Foreign/stale/substituted evidence | No affected write; valid continuity can be supplied without reinstalling. |
| Two writers | Conditional stale operation leaves the winning value intact. |
| Standalone denial/uncovered direct route | Guarded callback is prevented; the exposed alternative demonstrates insufficient coverage. |
| Handler error/malformed output/timeout | Dispatcher grants no dependent effect; destination stays unchanged. |
| Alternate mediated path/forged source | Both mediated routes reject unauthorized targets; no forged permission write. |
| Legitimate managed effect | Actual resulting value/revision is read back; valid access needs no repeated consent. |
| Partial effect | Published state remains; tracking recovery performs no duplicate publication. |
| Recovery/ownership | Completed work is observed; foreign evidence cannot advance the owner's work. |
| Administrative closure | Unmet essential original goal remains unachieved with explicit accountable continuation. |
| Another conditional store | Equivalent durable and stale-writer behavior without provider-specific identifiers. |

Separately authorized real-host diagnosis must observe the actual execution context,
native invocation/propagation and destination outcomes for its declared routes. A
standalone handler denial is not a native callback receipt. Preserve its scope and
limits rather than converting local tests to universal support. Do not perform these
trials during consumer installation, re-entry or ordinary bootstrap. Existing authorized
bootstrap/discovery and bounded recovery need no fabricated completed checkpoint;
retain their own authority, allowed effects, evidence and exit condition.

`PROTOCOL.md` is the sole normative runtime authority. `dist/oop-enforce.js` is generated software, source-bound through the reviewed producer and containing OOP Git revision. It introduces no second protocol version. The current implementation is a dependency-free, stateless Node.js 24 CLI that launches in both CommonJS and module-typed directories. Node 24.19.0 was actually available for producer tests; consumer adapters must discover their real supported interpreter. No npm install, package.json, daemon, network or mandatory paid infrastructure is required.

For a separately authorized necessary post-bootstrap diagnosis only, run `node dist/oop-enforce.js probe` with `{"format":1,"request_id":"local-probe"}` on stdin. It returns `unknown`, exit 3, because interpreter availability alone cannot verify installed interception. JSON schemas, command timing, required observations and complete-clause mappings are in `dist/interfaces.json#enforcement`. Inputs are UTF-8 JSON, at most 1 MiB, with a five-second stdin deadline. stdout contains one JSON object and a newline; errors never reflect payloads or parser exceptions. stderr has no payload diagnostics. CLI flags beyond the single command are rejected. Hosts must impose their own total execution timeout and output bound.

| Command | Timing and result | Mutations and limits |
| --- | --- | --- |
| entry | Before substantive work; full selected clause manifest and unresolved semantic questions, always unknown | Read-only; does not install or grant authority |
| interaction | Before reasoning; same deterministic reference closure, always unknown | Read-only; adapter delivers complete clauses and authoritative facts |
| pre-effect | At the effective effect boundary; allow only with all independently obtained required predicates | Read-only; adapter prevents actual effects and preserves backend revision checks |
| post-effect | After an attempted effect; validate observed outcomes and postconditions | Read-only; cannot undo partial effects |
| completion | Before a success claim; require tests, deliverables, documentation, dependencies, actual effects and complete semantic residuals | Read-only; no arbitrary text semantic certification |
| recovery | Before dependent resumption; check owned journal phase, active configuration/checkpoint reconciliation, exclusive update and ongoing users | Read-only admission; adapter implements persistence, locking and recovery |
| delegate | Before accepting delegated completion; require independently verified destination adoption, controls, scope and completion | Read-only; does not launch agents or transfer parent adoption |
| probe | Optional post-bootstrap interpreter/interface diagnosis, always non-authorizing; never installation certification | Read-only; cannot certify its own host registration |

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
| probe | File existence could be mistaken for installation | `probe` returns unknown/installed_path_not_verified, exit 3; separately verify formal installation and effective enablement; probe never grants permission |

The stdin envelope, response fields and four exit statuses are all additions. Before: no official schema or exit mapping. After: the adapter correlates format/type/request/command, recognizes only the four decisions and blocks malformed/new outputs. No extra top-level needs_evidence response type is introduced. Exit 0 for a pre-effect response is necessary but insufficient without the exact typed conditional allow.

The privileged adapter must supply a current clock reading, exact project/runtime/full OOP commit, revision, authority, resource, risk, lifecycle and context-retention identities, and non-secret dependency references. Each required observation carries `value`, `origin:authoritative_observation`, a reference, matching identity binding (including command, selected module list and effect class), matching dependencies, observation time and expiry. Missing, inferred, stale, mismatched and future observations cannot satisfy a predicate. The JSON validator cannot authenticate origins or prove that the adapter's clock, authority or observations are true. Treat the entire stdin channel as privileged: never pass model-supplied evidence through it as authenticated input. Raw secrets and complete private records belong outside this channel, argv, diagnostics and public fixtures.

Routing directly reuses the reviewed reference functions and all 64 facets. Every one of the 56 complete source clauses has an explicit deterministic/residual mapping. The engine checks closure, evidence bindings, mandatory predicate presence, BOOT guard facts, predecessor verification and allowed transition preconditions. It does not decide the complete English clause semantically. Each selected clause requires an independently evaluated `semantic:<contract-id>` observation before admission. The adapter must derive all applicable guards from authoritative scope: `mandatory_guards_complete` cannot be a model promise. Scope changes rerun closure; full Core and complete governing clauses remain available through manifest module paths. Manifest creation does not prove effective context delivery or reduce norms. No JSON artifacts were deleted: inspectability, source reconstruction and existing readers remain supported.

`tools/enforcement-adapter.cjs` is an executable local example. Its callback is gated by the actual child-process result, and tests inspect a disposable file to prove allowed and prevented effects through that local path. Its interpreter/cwd/timeout/exit/output mapping is exercised. This is not a registered Codex hook and covers no alternative tool/provider paths. A provider adapter must inventory documented eligible events, install or reuse all distinct eligible controls, retain direct administrative acknowledgments, respect required native consent/restart and propagate actual failures in ordinary authorized work. Independent native behavior certification is not required. Live installed provider, cross-runtime adoption and Full OOP suitability remain NOT VERIFIED. No unsupported vendor hook names are invented.

The context extension deduplicates identical migration policy objects and repeated engine dispositions into explicit shared references. Every fingerprint, stable profile ID, per-profile review attribution and policy value remains present; `expandMigrationContext` reconstructs the original descriptors exactly as JSON objects. Complete normative clauses are not compacted. Existing stored migration JSON and old readers remain unchanged. The official engine embeds this source-bound projection and returns it only when migration context is selected; the producer reference assembler includes the same projection. Source-review identities and round-trip tests guard this new representation. Measurements count selected projection bytes separately from full stored JSON and actual JS load bytes. It is a local assembly measurement, not verified model delivery.

## Adoption and recovery

The existing migration index/runtime/compatibility descriptors explicitly distinguish no prior engine, active engine and interrupted candidate. The diagnostic follow-up has impact `INTERFACE_CHANGED`, conservative aggregate compatibility `adapter_required`, action `adapter_update_required`. Its published predecessor is `oop-admission-1` at `9e8ff87a096d484ff56c03358019da130a78d97d`. Missing/excess argv previously returned `error/unsupported_command`, exit 4; now it returns `error/invalid_arguments`, exit 4. Explicit unknown commands keep `unsupported_command`. No command, top-level decision or exit was added. Existing exit-4 fail-closed consumers can copy and probe; consumers matching diagnostic reasons need adapter review/update; unknown consumer behavior blocks adoption. Initial no-engine integration remains a separate supported input requiring an adapter. Existing common/operations state schemas and all prior support profiles remain readable; runtime administrative reconciliation is independent. Future internal-only changes can use copy-only after actual administrative dependencies are reconciled; unknown code/interface impact requires blocked recovery.

Adapters own durable effects; this stateless engine is deliberately not a filesystem installer. Use one active controller and at most one ordinary temporary candidate in the runtime-owned protected private area or valid equivalent. Hold an exclusive scoped update lock/CAS, journal intent and expected prior revision, stage, classify compatibility, update the adapter, then activate from successful direct administrative results and required native consent/restart before advancing only the owner's checkpoint. Wrapper logic changes obey the later-chat restriction. Supported journal phases are `staged`, `probed`, `activated_pending_checkpoint`, `checkpointed` and `cleanup_pending`. A crash between rename and checkpoint requires observing active configuration and reconciling the journal; rename and checkpoint are not atomic together. Preserve the verified active during failed staging, record partial effects and retain only code needed by ongoing invocations or recovery. Cleanup is forbidden until that need ends. No snapshots registry or historical executable accumulation is required. Recovery admission checks supplied proof; real locks, crashes, permission enforcement, rollback and cleanup in an installed adapter remain NOT VERIFIED by these stateless tests.

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

OOP prepares and freezes every distinct eligible native definition and the complete initial wrapper before the first enforcement approval. Each required native consent remains yours. Direct successful installation or valid reuse, required consent/restart and no unresolved real administrative error complete enforcement installation; a separate inspection API or functionality certification is not required. BOOT-13 separately verifies the version-2 machine and nested-runtime identity registration on canonical operations; technical status, adopted revision and administrative receipts remain local. The runtime presumes functioning within documented scope without claiming observed interception or model infallibility. Real project permissions, credentials, signing and effect-result checks remain mandatory. Wrapper logic stays frozen in the installation chat, including after restart or compaction; a concrete authorized safe improvement can proceed only in a different chat created after completion. Missing trustworthy chat metadata defers improvement alone. Existing unchanged approvals and receipts are reused; savings remain unmeasured.



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

The host authenticates these declarations. The optional `feature_semantics` map must name every advertised feature exactly once with one known role per feature. The base `semantics` value must be among those roles. Missing, unknown, array-valued or contradictory maps are rejected; incompatible individual requirements remain uncovered. Feature names alone never imply roles. Registration IDs with divergent fingerprints, roles, phases, paths, blocking behavior, scope or provenance fail closed as conflicting invocations. A compatible registration can span explicit phases. Declared mappings retain all distinct eligible registrations, including overlapping mechanisms; equivalent native invocations may share one registration.

Plans add `diagnostic_plans`; ordinary registration records add selected `feature_semantics` and the full trusted `invocation` description. Strict local consumers must review these fields and `DIAGNOSTIC_PLANNED` before adoption; unknown consumers remain blocked. Existing four-argument callers still plan ordinary controls. Historical labels lacking actual administrative receipts cannot support reuse: reconcile only genuinely missing administrative facts, without independent readback or hook trials. Changed roles or provenance invalidate affected reuse even if the registration label is unchanged.



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





## Formal enablement compatibility




## Installation binding manifest and stable bridge

The generated `dist/enforcement-install.json` format 1 covers all eight controller features and eleven installation dimensions. `entry.json` and `interfaces.json` expose it. Its complete source-contract references preserve normative text in the modules. Schema format, `oop-admission-1`, producer content identity, independently adopted full Git commit and runtime plan identity are separate; consumers do not certify publisher hashes.

The additive reference API `planInstallation(manifest, capabilities, facts, installed, options)` derives requirements from an authenticated complete scope inventory. Host facts include current scope/dependencies/provenance/freshness, booleans `effects_possible`, `resumable`, `delegation_used` and every applicable phase/path. Capabilities additionally identify an eligible `capability_class`, exact scope, authoritative current provenance and a host-owned `bridge` (entrypoint, interpreter, ownership_reference, controller_interface). Options supply independent `expectedSourceBinding`, `adoptedCommit`, scope and time. These supplied observations must be authenticated outside model input. The original `planBindings` API remains partial-input planning and never certifies complete installation.



A host-owned stable bridge normalizes native events into format-1 requests, retaining unique `request_id` and independently observed context/evidence; it validates format-1 `oop_admission` correlation, source binding and exits allow/deny/unknown/error = 0/2/3/4. For a write, only a valid pre-effect admission plus independent authority can permit the effect. Unknown, malformed output or timeout blocks dependent preventive scope. An observer can report failure but cannot claim it vetoed an effect. Timeout does not establish cancellation. Existing `dispatchBinding` retains ordered failure accumulation and skips recovery only on actual host classification.



## Administrative installation interface 2

Manifest format 2 replaces the old readback contract. `planInstallation` inventories all distinct eligible registrations; `currentInstallationPlan` checks owned inventory identity and dispositions, not functionality. `freezeInstallation(plan, preparation, options)` requires actual wrapper content and all native definitions before first approval. `installationState(frozen, receipts, independent, options)` derives C/U/R/E and preserves independent BOOT-13 publication. A receipt identifies the registration/fingerprint/invocation, owned scope/dependencies, direct result, native consent, restart and real errors. The trusted host authenticates these facts outside model-controlled input.

`wrapperEvolution(checkpoint, chat, change, options)` returns `defer`, `apply` or `request_new_native_consent`. It is a reference eligibility decision, not a native executor. Actual runtime application and persistence are runtime-owned. Missing trusted chat identity/creation time defers optimization. Legacy reconciliation accepts actual old receipts with `migration:true`, preserves unknown historical completion time and records `recognized_at`; a historical status alone never promotes installation.

Controller common evidence `installed_enforcement` replaces `formal_enablement_verified`. Before: successful installation lacking independent readback remained pending. After: direct C/U/R/E facts suffice, while independent authority and actual effect evidence remain required. Strict adapters must migrate manifest 1 → 2 and BOOT format 4 → 5; command names, wire envelope and 0/2/3/4 exits are unchanged. Run `node --test tools/installation-lifecycle.test.mjs` on Node.js 24. These are producer fixtures, not live hook certification.

Legacy source changes can reuse original receipts through `options.reconciliations`: a current host-attributed administrative record binds the original receipt reference, registration, old/target source identities and unchanged native configuration/permissions, preserved consents, resolved actual restart and absence of real errors. It uses existing administrative facts; no second inspection API or functional trial is required. Foreign scope, changed native permissions, denied/revoked consent or a real error remain non-authorizing.

## Persistent runtime and session admission

Before: admission evidence bound project/runtime/source/authority/resource and retained context, without explicit session or authoritative checkpoint mapping. After: adapters resolve the persistent owner and sole current checkpoint, supply current `checkpoint_ref`, `checkpoint_revision`, `mapping_revision`, and independently bind `session`, `request_scope`, `action_scope`. Proofs include `runtime_identity_verified`, `checkpoint_current_verified`, `session_scope_verified`. A second session reuses adoption but cannot reuse the first session's context/authority proof. A changed checkpoint or mapping invalidates affected proof on every effectful contact. Old strict adapters require reconciliation before admission; missing fields produce unknown, never a second checkpoint.

Entry/interaction return non-authorizing semantic context including the ownership obligation. Pre-effect, post-effect, completion, recovery and delegation retain their contact names and require the new scoped evidence. Probe remains diagnostic and non-authorizing. Request and response format/envelope, decision literals and exit codes remain unchanged. No engine filesystem writes or automatic host observations are added. `request_id` correlates one call and must not stand in for logical action authority. See runtime-checkpoint.cjs for the supplied-observation reference and tools/runtime-checkpoint.test.mjs for bounded producer evidence; none authenticates an installed host.

Migration-context interface: before, format 1 stored expanded payload/policies; after, producer format 2 uses tagged text interning with exact expansion. Both formats remain readable by the provided decoder. Strict external format-1 readers need an adapter update. Stored migration JSON and canonical semantic clauses are unchanged by this encoding.

## Installation identity and mutation contract

The current source replaces technical canonical installation publication with R03 identity registration. Historical format descriptions above are retained as history. dist/installation-contract.json carries the exact closed identity schema and mutation/configuration contract. The official controller embeds tools/installation-contract.cjs as source-bound predicates; its factory has no host effects. tools/templates/oop-enforce-bridge.ps1 is a conditional PowerShell template, not an installed runtime hook or a universal host dependency. Other hosts require an eligible native implementation and applicable official support evidence.

Before: pre-effect had generic session/checkpoint predicates only. After: ticket_mutation and identity_registry_mutation require organizational_mutation with proposal and independently authenticated observation. Context/evidence also bind installation_uid and instruction_origin_uid for these mutations. The observation supplies actual current revision, prior ticket, registry, retained snapshots and selected lineage. The entire channel is privileged; these predicates cannot authenticate a model's claimed origin. Eight commands, the admission response and exits 0/2/3/4 remain unchanged. Strict adapters require updates; unknown compatibility blocks dependent adoption.

authorTicket/previous/reconstruct author candidates; validateMutation never mutates or restages them. publishMutation revalidates inside the backend's conditional boundary and requires canonical content readback. Its callback interface does not itself provide a real backend, authorization or durable storage. Failed publication retains exact pending work and actual returned commit facts. The backend must retain immutable revisions and enforce expected-revision publication atomically. Historical reconstruction and supplied truth are not independently certified by a passed fixture.

planInstallation now requires configuration_plan and configuration_observation. They identify installation/workspace/host, current configuration revision, native shell support, official source/section/review date/version, exact supported/required elements and host overrides, necessary scopes and authoritative registration sources. All eligible controller routes use the same native entry. Configuration preparation rejects wider scope where narrow scope suffices, duplicated sources and stale/unrelated-content replacement. Observations attest administrative preparation, never dispatch. Preserve C/U/R/E and later-chat wrapper restrictions. The Node reference adapter remains a producer harness; its direct CLI calls are not a compliant installed native bridge.

Producer tests in installation-contract.test.mjs cover R01-R23 with synthetic observations and conditional in-memory stores. No actual consumer configuration, native trust, provider behavior or cross-runtime adoption is established. Current source requires an organization-level identity/history migration; old profiles remain readable and incompatible old writers must be gated before writes.

Current identity/history edition: bootstrap format 6 supersedes 5, and installation manifest format 3 supersedes 2. Old declarations remain readable history, not current writer eligibility. Installation receipt contract 2 and controller admission format 1 remain; strict adapters reconcile changed identity-registration guards, native configuration evidence and typed organizational mutations before dependent use.

## Machine registry and local maintenance (current)

R03 format 2 supersedes the six-field format-1 registry for current writes. Legacy records remain readable history. machineId encodes the complete canonical public scheme/fingerprint without secret hashing; the host observes the actual common-private credential and uniqueness. The filename is machine_id.json. lookup resolves nested runtime UIDs, globally unique across machines. enrollments preserve peers and require observed original BOOT-12 evidence; unknown migrated dates use null/unknown_legacy. Rotation requires authorized continuity and public aliases. migrateMachine prepares evidence-backed grouping without ticket or checkpoint changes.

Every protected controller call requires machine_id and installation_uid in context plus maintenance_observation obtained by the privileged adapter from the runtime-owned local declaration. The adapter observes normal mode even when the caller omits bridge_maintenance. Missing/expired/foreign state returns unknown; active maintenance without a typed confined action denies. The observation binds request/action, workspace, machine/runtime, checkpoint/mapping/revision, authority, freshness and dependencies. Entry/edit/recover/read/exit use existing pre-effect/recovery contacts. Only exact resolved canonical bridge, local bridge-maintenance.json and one optional canonical candidate may be affected; aliases, links, network, Git and unlisted effects deny. Exit requires actual artifact/configuration reconciliation, consent/restart, real error absence and checkpoint-reference coherence. The adapter persists the declaration with CAS and retains crash recovery. INSTALL-13/14 still apply. A broken bridge may use only the independently confined R24 repair entry.

The controller is a pure predicate and cannot authenticate JSON, intercept host effects or write local state by itself. A host adapter must independently observe the declaration and constrain actual effects. The conditional PowerShell template transports a trusted native envelope; forwarding model-supplied maintenance observations is not a compliant integration. The producer Node adapter is only a test harness. No installed runtime confinement is claimed. Eight commands, admission format and exit meanings remain; strict adapters require updates. Future ticket events and deletion trailers use the executor UID, preserving historical events and instruction-origin causal provenance. New AI-created commit metadata uses the verified machine owner pair with independent provider authorization and actual object inspection.
