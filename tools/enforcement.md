# Official enforcement framework and runtime adapter

## Concrete corrective outcomes

Every non-authorizing admission, rejected coordination command and invalid administrative configuration supplies nonempty operational guidance. Admission uses payload.runtime_message and payload.remediation; coordination uses runtime_message and result.remediation; configuration uses runtime_message and diagnostics.correction. Explanations identify the unmet condition, concrete corrective actions, actual state or evidence acquisition, prerequisites for retry and a stopping condition. Missing evidence is not false evidence; a false condition requires correction of the actual state. Instructions never create authority or mark an outcome successful.

Reason codes and predicate identifiers remain machine-readable diagnostic metadata. They never replace the operational message. Each negative native response variant must forward the complete response or appropriate runtime_message without content-removing character mappings; administrative validation and dispatch reject declarations that drop it. Decoder, rendering, registration and transport failures supply safe recovery instructions on the available channel. A missing or preempted host channel remains an explicit delivery limitation, not verified context delivery.

Scoped index/status and mismatch guidance remain separate from remediation. Existing index, instruction and status budgets are preserved; corrective guidance is bounded by the fixed instruction vocabulary, bounded prerequisite list and native output limit. Repeated unchanged requests do not make progress. Repair only within existing authority and use conditional writes; when authority or capability is genuinely unavailable, preserve the blocker and continue independent authorized work.

## Runtime guidance, declaration and coordination (oop-admission-1, R21.10, R27)

Every admission response carries `payload.runtime_message` (empty only for allow without a notice, English, never permission). Forward a non-empty message as host-generated context; templates forward it through a declared message placeholder. Supply the registered `project_root`, `private_root`, owned/common scopes, installation UID, runtime class and observed locality to the template; it adds them to `request.coordination` with the host session id and optional `resource` ({path, access: read|write|unknown}) and `context_event` (start|resume|compact|restore|context_loss), and strips any caller-supplied locators. Route `declare` (phases classification, attach, transition, clarification, lifecycle), `load` (tiers 1–3), `worklog-append` and `worklog-read` through the same adapter; responses are `oop_runtime_coordination` with exit 0 accepted, 2 rejected, 4 error. Pre-effect mismatches are reported even while maintenance state is unresolved; in enforcing mode `resource_leased` and `effect_with_stale_context` deny. Without verified locators no state, lease or log is written and no protection is claimed.

Preferred invocation: every host mechanism calls the official adopted controller with its command, `--host <registered-host>`, the registration record locator and its identity (`--registration`/`--registration-identity`), the command and the event format. The framework verifies the registration and owned adapter before execution. Format 1 records carry `runtime_adapter` with path, identity, template identity, host/version and required events. A direct normalized CLI call cannot bypass a registered format-1 adapter. The controller verifies identity, source, UID segment, owned location and alias-free real paths before using any record field; failures are `error` or `coordination_error`, never allow, and the parameter form is refused once a record exists. A runtime-initiated command supplies only `session` and its fields; an unknown session is `unknown_session` and creates no state. A classification carries `basis`, checked by rules C1–C7; without a record a missing basis is accepted with `classification_without_basis`. Registered governed stores are observed under the private root: operations writes receive every project check, work-item writes receive `work_item_without_justification` and `work_item_for_external_subject`. Entry and every index delivery add the `OOP declare:` line and the shared instruction set; the status line adds `instr=`; `load` with `scope: "instructions"` returns the full set; with a record the controller writes `runtime-instructions.rendered.md` in the common scope.

The manifest requires `supported_commands` for its supported OOP
commands. The `events` field is rejected, including when supplied alongside
`supported_commands`. Each `supported_commands` value is keyed by native-event labels or literal `|` groups, then by decision labels or groups, with optional static `_`. Adapters must
use the current manifest version and template before registration.

## Ordered adapter development

### Optional semantic session cache

Use `load` with `scope: "session"` to read the existing session's `state_revision`, guidance and pending status; unknown sessions are not created. Supply `declare` with `phase: "guidance"`, `expected_revision` and a bounded `guidance` object, or include that object with a classification. Required guidance fields are `relation` (continuation, clarification, correction, scope_change, cancellation or replacement), `phase` (inquiry, analysis, planning, action or verification) and `objective_ref`. Optional fields are `scope_ref`, `authority_ref`, `next_check`, `invalidated`, `facts` and `blocker`. No private reasoning, secrets, executable verification or authority assertions belong here.

Each fact contains `ref`, `kind` (observation, interpretation or assumption), `provenance`, `invalidates_on` and `dependencies`. All are runtime claims with unverified truth; invalidation follows their transitive dependencies. A blocker contains `prevented_action`, `dependency`, `responsible`, `unblock_condition`, `resume_action` and `independent_work`. Shape validation does not prove a real human dependency. Independent work and observed effects remain available under their own authority.

A new interaction makes retained guidance pending even with an active work item. Changed scope, authority or objective requires classification; cancellation prevents dependent writes while preserving the referenced ticket and actual effects. In enforcing mode `effect_with_stale_guidance` denies affected writes. Guidance commands always return `effect_permission: not_granted`; stale revisions return `stale_session_revision` without modifying state. The next-check text and fact references are data, never injected executable policy.

The extension uses the same commands, response envelope and exits. Existing callers may omit it; doing so provides no semantic-cache coverage. A reader using the extension must support the typed fields, revision result and rejection reason; update its owned adapter only through actual adoption/migration authority and INSTALL-13/14. Source identity and controller/template checks remain independent. Reconcile an existing cache as execution data and preserve actual partial effects, foreign owned state and the sole adoption checkpoint. Package tests do not verify an installed adapter or authorize in-chat wrapper evolution.

Session read-modify-write exclusion uses an exclusively created owner token and bounded contention. Elapsed time never proves owner death. A crash can leave a busy lock: authorized recovery must establish that its writer cannot resume before removing the exact orphan. If liveness cannot be established, retain `coordination_busy` and independent work; do not invent a safe takeover or installed recovery observation.

After mandatory OOP entry and minimum ownership/path checks, the runtime must:

1. Copy the supplied template into its UID-qualified owned scope as an inert working copy.
2. Load and analyze the applicable distributed adapter-development closure.
3. Read the entire actual adopted controller.
4. Read every comment in the copied template.
5. Consult official enforcement documentation for the actual runtime version and host.
6. Implement and review the complete adapter.
7. Install applicable mechanisms after complete preparation, freeze and exact-plan validation.

The first six stages are recorded in order in `adapter_preparation.workflow.stages`,
each with `step`, non-secret `reference` and `assurance` (`runtime_declaration` or
`native_observation`). Native observations must match independently supplied preparation
observations. `workflow.inputs` binds controller/template references and identities,
the owned working-copy locator, context references/identities and applicable official
sources to current preparation observations. `candidate_identity` binds the complete
candidate using the configuration identity function. Template identity is also checked
against the actual controller template. These are local component bindings, not OOP
release certification. Changed inputs require dependent preparation to be reconciled.
No record proves reading chronology or comprehension; native reading telemetry is not
an installation prerequisite. Installation is recorded only through actual administrative
outcomes. Incomplete working copies must never replace safe active code or be registered.

## Registered non-governed observations

A native format-1 registration can explicitly enable `runtime_adapter.observation_admission: 1`.
Without that setting, the framework retains the ordinary evidence path. The framework
provides verified launch references to the decoder as `context.registration.controller`,
`interpreter`, `registration_path`, `registration_identity` and `invocation`.

For a known information/interaction-only operation, the framework can supply an internal
observation correlated to the request and session. A read requires an existing alias-free
target inside the project, resolved against the actual native working directory. A decoder
can also recognize the exact registered `load` or `declare` invocation. The decoder must
translate actual native input conservatively; arbitrary shell text remains unresolved.
Registration and adapter identity verification establish which decoder is used, not an
independent proof of its semantic correctness or a sandbox against hostile adapter code.

After maintenance and classification checks, the engine admits these bounded observations
with `reason_code: non_governed_observation` and `effect_permission: not_granted`.
The path excludes effect classes, organizational mutations, transitions, bootstrap,
journals, adapter maintenance and publication payloads. Caller JSON cannot supply the
internal observation channel. Unknown operations and governed effects retain their
evidence requirements. Coordination commands can update their existing technical runtime
state; admission does not grant authority for project mutations or publications.

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

`PROTOCOL.md` is the sole normative runtime authority. `dist/oop-enforce.js` is generated software, source-bound through the reviewed producer and containing OOP Git revision. It introduces no second protocol version. The current implementation is a dependency-free CLI with confined private coordination and diagnostic state for the declared interpreter that launches in both CommonJS and module-typed directories. Producer tests ran on an available interpreter of the declared major version; consumer adapters must discover their real supported interpreter. No package installation, package manifest, daemon, network or mandatory paid infrastructure is required.

For a separately authorized necessary post-bootstrap diagnosis only, run `node dist/oop-enforce.js probe` with `{"format":1,"request_id":"local-probe"}` on stdin. It returns `unknown`, exit 3, because interpreter availability alone cannot verify installed interception. JSON schemas, command timing, required observations and complete-clause mappings are in `dist/interfaces.json#enforcement`. Inputs are UTF-8 JSON, at most 1 MiB, with a five-second stdin deadline. Normalized stdout contains one JSON object and a newline; registered host output uses the selected validated renderer; errors never reflect payloads or parser exceptions. Rendering failures use reduced safe diagnostics on stderr. Registered host calls use --registration, --registration-identity and --host; other flags are rejected. Hosts must impose their own total execution timeout and output bound.

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

The privileged adapter must supply a current clock reading, exact project/runtime/full OOP commit, revision, authority, resource, risk, lifecycle and context-retention identities, and non-secret dependency references. Each required observation carries `value`, `origin:authoritative_observation`, a reference, matching identity binding (including command, selected module list and effect class), matching dependencies, observation time and expiry. Missing, inferred, stale, mismatched and future observations cannot satisfy a predicate. The JSON validator cannot authenticate origins or prove that the adapter's clock, authority or observations are true. Treat the entire stdin channel as privileged: never pass model-supplied evidence through it as authenticated input. Raw secrets and complete private records belong outside this channel, argv, diagnostics and public fixtures.

Routing uses the reviewed reference functions. Applicable rules retain explicit deterministic and residual responsibilities. The engine checks closure, evidence bindings, mandatory predicate presence, BOOT guard facts, predecessor verification and allowed transition preconditions. It does not decide the complete English clause semantically. Each selected clause requires an independently evaluated `semantic:<contract-id>` observation before admission. The adapter must derive all applicable guards from authoritative scope: `mandatory_guards_complete` cannot be a model promise. Scope changes rerun closure; full Core and complete governing clauses remain available through manifest module paths. Manifest creation does not prove effective context delivery or reduce norms. Artifacts remain inspectable for source reconstruction and supported readers.

`tools/enforcement-adapter.cjs` is an executable local example. Its callback is gated by the actual child-process result, and tests inspect a disposable file to prove allowed and prevented effects through that local path. Its interpreter/cwd/timeout/exit/output mapping is exercised. This is not a registered host hook and covers no alternative tool/provider paths. A provider adapter must inventory documented eligible events, install or reuse all distinct eligible controls, retain direct administrative acknowledgments, respect required native consent/restart and propagate actual failures in ordinary authorized work. Independent native behavior certification is not required. Live installed provider, cross-runtime adoption and Full OOP suitability remain NOT VERIFIED. No unsupported vendor hook names are invented.

The adapter correlates format, type, request and command, recognizes only the four decisions and blocks malformed or unknown outputs. Exit 0 for a pre-effect response is necessary but insufficient without the exact typed allow and independent current authority.

The migration context is a lossless tagged text-interning projection of the applicable compatibility and migration declarations; `expandMigrationContext` reconstructs the descriptors exactly. Complete normative clauses are never compacted.

## Adoption, replacement and recovery

### Native action assessment

The pure decoder returns the real action operation/arguments. Actual interaction input additionally supplies interaction with text and turn_id; actual post-effect input supplies outcome. The framework stores identities and safe metadata rather than raw prompts, arguments or results. Input is context, never an automatic authorization grant.

An unresolved governed invocation returns payload.action with action_identity, generation and current session revision. The agent loads scope action, loads the complete routed modules at tier 3, classifies the actual work and submits declare phase assessment with expected_revision. assessment contains command, action_identity, generation, facets, effect_class, purpose (work or bookkeeping), effects and judgments. An effect has path, access (read/write) and expected_identity (sha256 or absent). Each interpretive judgment has value, reason and source_refs including the current observed request reference and, for a semantic clause, its exact contract id. References must identify observed input, loaded clauses or actually observed resources. Optional sources bind additional permitted project/canonical record paths to expected content identities; changed sources invalidate the assessment. Factual predicates cannot be declared as semantic judgments. A post-effect assessment returned through declare includes a nested reconciliation admission for the already recorded matching actual outcome; the tool is not run again. A continuation optionally names next_action and requires explicit remaining_action_authorized and safe_continuation judgments.

The controller rebuilds the conservative route and distinguishes attributed semantic judgments from observations of actual local state. All mandatory guards remain checked by the same evaluator. The registration supplies protected_configuration_paths from actual native installation discovery (an explicit empty list is valid when none apply); ordinary workflow cannot silently assume an absent inventory is empty. The field is not supplied by the action proposal. It observes source/runtime/session identity, source-bound module availability, current instruction identity, content revisions and matched native outcomes. Ordinary effects also require an adopted checkpoint and the owned administration.json receipt with format 1, installation_uid, source_identity, registration_identity, consent (approved/not_required), enabled true, restart (acknowledged/not_required) and authority_reference to an observed input. Receipt fields are scoped administrative attestations, not independent authentication or proof of all reachable host paths. The actual host must supply genuine authority/provenance and retain its own permission checks.

Bookkeeping is limited to the mapped owned checkpoint, owned administration.json and owned action-reconciliation.json; installed_enforcement and checkpoint_current_verified are not prerequisites of this narrow repair and are not synthesized as true. Other code, native definitions, organizational records, external effects and peer state cannot enter this lane. Conditional execution and postconditions remain the executor responsibility. Unsupported external/canonical effects retain their existing authoritative backend contracts; a semantic assessment does not bypass them.

A retry must have the same logical action and current facts; new native attempt ids are allowed. For completion/recovery, presentation-only assistant text, turn ids and stop-hook flags do not change the logical task operation; the full native input identity is kept separately. load scope=action can explicitly rebind an existing receipt after a current accepted classification. Changed arguments or dependencies require reconciliation. Admission consumes the assessment once and rejects replays. Completion uses controller-computed progress fingerprints over actual content and observations rather than caller-chosen labels, classification changes or fresh attempt ids. Failed rendering/delivery invalidates cached module availability until rehydrated. Repeating an assessment cannot force an infinite Stop loop. A missing completion assessment can request one known-safe control-plane repair, using the same consumed progress set; another unchanged attempt pauses. Bookkeeping is never an overall-completion waiver. Explicit limits remain: source-correlated interpretations are not independent factual proof, mutable controller/state owners are outside an independent prevention claim, and declaration validation never certifies a real installation.

## Producer review and measurements

Change the producer template or mapping, review its semantic boundaries and update the reviewed implementation identities in `release-review.json`; then run generation, focused tests and candidate acceptance. Generation refuses stale reviews and includes the controller in acceptance subjects. `node tools/enforcement-benchmark.mjs` records cold CLI, warm evaluation, routing time, peak RSS and selected bytes of the current package into untracked `tools/evidence/current-enforcement-measurements.json`. Bytes are not tokens or money; no live provider latency is measured. The controller runs on the interpreter declared in `interfaces.json#enforcement.interpreter` (major 24 or later); the interpreter's built-in test runner is the dependency-free producer runner.

## Installation planning and administrative completion

`planBindings(capabilities, requirements, dependencies, installed)` is a pure host-independent planner: it preserves the strongest tier per required path before reusing compatible registrations, and preventive features reject observation-only mechanisms. `dispatchBinding` requires an independently selected `options.expectedBinding` and keeps every failure even after a later success.

`planInstallation(manifest, capabilities, facts, installed, options)` derives requirements from an authenticated complete scope inventory, configuration plan and configuration observation; all eligible routes use the same native adapter entry. `freezeInstallation` requires the complete wrapper and every native definition before the first approval. `installationState` derives C/U/R/E from direct receipts and preserves the independent BOOT-13 publication. Receipts from the previous source remain reusable only through `options.reconciliations` that bind unchanged native configuration, preserved consents, resolved restart and absence of real errors. `wrapperEvolution` returns `defer`, `apply` or `request_new_native_consent`; missing trusted chat metadata defers optimization. These are reference decisions over supplied observations, not native executors.

## Persistent runtime, session admission and identity

Adapters resolve the persistent owner and sole current checkpoint and supply `checkpoint_ref`, `checkpoint_revision`, `mapping_revision`, `session`, `request_scope` and `action_scope`. A second session reuses adoption but never another session's context or authority proof; a changed checkpoint or mapping invalidates affected proofs on every effectful contact. See `runtime-checkpoint.cjs`.

`dist/installation-contract.json` carries the closed R03 machine-record schema and the mutation/configuration contract; the controller embeds `installation-contract.cjs` as source-bound predicates without host effects. `ticket_mutation` and `identity_registry_mutation` require `organizational_mutation` with a proposal and an independently authenticated observation of revision, prior ticket, registry, snapshots and lineage. `authorTicket`/`previous` author candidates, `validateMutation` never mutates them and `publishMutation` revalidates inside the backend's conditional boundary with content readback. A ticket without `previous_versions_list` is rejected.

`machineId` encodes the complete public scheme and fingerprint without secret hashing; the filename is `<machine_id>.json`, nested runtime UIDs are globally unique, enrollment preserves peers and rotation keeps public aliases. Every protected call requires `machine_id`, `installation_uid` and a `maintenance_observation` from the runtime-owned declaration (absence observed as normal mode by the trusted adapter); active maintenance admits only the confined R24 lane. The controller cannot authenticate JSON or intercept host effects; the host adapter must observe the declaration and constrain actual effects. Producer fixtures establish no installed runtime confinement.

## Declarative responses and framework observations (R29)

The sole template is templates/oop-runtime-adapter.js, with manifest schema_version 1. Its only editable
regions are manifest (strict JSON data) and decodeEvent (pure translation).
The framework parses manifest without executing it and rejects duplicate keys,
invalid versions and changes to the fixed scaffold. It runs only decodeEvent in a
bounded process. Process separation is not a hostile-code sandbox.

The declaration contains host, runtime_version, documentation, supported_commands,
placeholders and optional rendering limits. supported_commands is keyed by OOP
command, then native-event label/group, then decision label/group. Each output
declares literal stdout, stderr and integer exitCode
0..255. Native and decision labels use literal | alternatives with no overlaps,
empty/repeated tokens or outer whitespace. Every native block covers the four
decisions exactly once; optional _ is a static technical fallback, never a case
substitute. decodeEvent.native_event selects one exact native token before
evaluation. Missing/unknown selectors fail; decoder failures after verified
registration use persistent diagnostic recovery even without a selected fallback.
No event is invented; storage failure remains explicit on stderr. Templates omit trailing newlines: the controller trims each completed channel,
then appends one LF only for nonempty text; internal whitespace is retained.
Final normalized UTF-8 bytes remain subject to output limits. Separate mappings, top-level cases, rendering.fallbacks and function fields
are rejected. Every applicable native block
requires allow, deny, unknown and error; documented native values may coincide.
A native continuation response grants no new effect authority. Documentation and
actual native preventive capability remain independent of structural validation.

Placeholders use {{name}}. Four opening/closing braces escape the respective literal
delimiters. Each placeholder declares source, type, required and encoding; optional
values additionally declare explicit absent text. Sources are decision, response,
additionalContext or their safe dotted children (decision has no children).
Types are string, number, boolean or json. Encodings are text, json for a whole JSON
value and json-string for escaped string contents. Null, false and empty values
remain distinct from absence. Text-only character maps replace one Unicode character
at a time in one pass. Substituted text is never interpreted as another placeholder
or mapping rule. Documented machine-readable host output is checked independently
of its string transport; the generic renderer infers no content format. Unknown placeholders,
missing required values, invalid mappings/types/encoding and exceeded limits
enter independent fallback/diagnostic recovery, without an implicit allow.

validate-configuration accepts the current exact plan and independently observed
facts. facts.adapter_contract specifies required supported_commands and per-command placeholders,
independently of the adapter being validated. The validator checks all four cases
and mandatory output declarations, reports all independently detectable declaration
errors as diagnostics [{code,location,correction}], and binds the plan and facts.
Documentation disagreement blocks affected registration. The schema cannot discover
arbitrary host semantics or authenticate supplied facts. Runtime errors and unavailable
observations are distinct from invalid initial declarations. Administrative validation
exits remain 0/2/4; admission decisions retain exits 0/2/3/4. The wire contract is
oop-admission-1, and the installation manifest format is 1.

### Local records and bootstrap

engine.framework.acquireObservations(scope, options) is a privileged embedding API.
The caller independently establishes scope from verified registration or authorized
pre-registration bootstrap ownership, never raw events/model statements. scope contains
project_root, private_root, common_scope, owned_scope, installation_uid, machine_id,
runtime_class and, when applicable, controller_locator. The registered process path
uses the actual executing directory and verified locators, never caller cwd. The
private checkout topology may resolve distribution → checkout → common; nondefault
and shared placements require the independently resolved common locator. Path names
or supplied booleans alone cannot authenticate scope ownership.

The current common/workspace-binding.json record is {format:1, workspace, revision,
runtimes:[{runtime,installation_uid,owned_scope,checkpoint_ref,identity_basis,status}]}.
workspace equals the registered project root; identity_basis is persistent_integration.
Selection uses the exact verified installation_uid, not session/class/first match.
Operational mappings are active; options.bootstrap true also accepts pending mappings.
A mapped checkpoint binds workspace, runtime, installation_uid, checkpoint_ref,
mapping_revision, nonnegative integer revision and status pending/installed/adopted.
Mapping may pin checkpoint_revision. Reading status never certifies installation.
Pending is valid for initial reading/validation without requiring adopted state.

The owned oop-runtime-adapter-maintenance.json binds workspace, machine_id,
installation_uid, revision and mode normal/maintenance/recovering. Authoritatively
observed absence of the source declaration is normal mode under R24; a missing
migration target never establishes normal. Declared observed_at/expires_at pairs
must be current. Unexpired durable records are re-read per invocation and dependency
content identities are checked before return. Files must be within the exact owned
scope (binding in common), alias-free regular files with one hard link. Malformed,
missing, unreadable, stale, foreign, changed or ambiguous data returns status unknown
with attributable diagnostics. Successful acquisition includes per-record reference,
identity, observed_at, scope and valid_until dependency_change, plus explicit
installation_complete false. Whole private records do not enter public diagnostics.

Framework request context uses registration/binding/checkpoint identities and passes
only established local identity/checkpoint facts, with provenance and current request
bindings. Maintenance state comes from the actual owned declaration. Independent
host observers still supply authority, semantic predicates, tests and actual external
effects; neither local presence nor model labels establish them. Missing local state
cannot upgrade allow; a separately established deny remains deny. Unrelated safe work
is preserved. Scoped local acquisition is available before registration; conditional
registration still requires exact current plan validation and mandatory native gates.

### Bounded recovery and migration

rendering declares timeoutMs (default 1000), marginMs (100), optional hostDeadlineMs,
maxOutputBytes (1048576), retentionMs (seven days), maxRecords (1000) and static
an optional static _ fallback within each native block. Host timing without a documented
budget remains unknown. Fallbacks are validated independently, composed with bounded
safe stderr, and never re-enter failed rendering. No response construction or stream
write proves host receipt or prevention. Recovery requires a running capable process.

Protected rendering-diagnostics retain immutable unique minimized unread records and
actual presentation receipts. No raw input, private records, response payloads,
additional context or arbitrary exceptions are persisted. Storage failure does not
suppress usable fallback/stderr. At entry, interaction and recovery unread diagnostics
are delivered for original/effective-language presentation, or an explicit translation
limitation. diagnostics-read/ack/cleanup use the same official host entry; acknowledgement
requires actual presentation evidence. Retention starts at acknowledgement, unread and
interrupted records remain recoverable, and concurrent records/receipts preserve peers.
The existing R24 diagnostic confinement and independent repair authority remain binding.

Migration explicitly reconciles the observed component contract, stages one complete
candidate under the expected-revision journal, preserves safe active code/sole checkpoint,
peers, valid consents and required restart, and checks actual source/target maintenance
before activation. Incompatible declarations are rejected, not silently treated as current.
Retire superseded routes only when no invocation needs them. No permanent compatibility
adapter or vendor/version catalog is required. INSTALL-01–17 remain binding; producer
regressions are not consumer bootstrap functional certification. Installed delivery,
provider prevention and cross-runtime adoption remain NOT VERIFIED.

## Shared Markdown instruction view

The current derived view is `runtime-instructions.rendered.md` in the common scope.
It is composed directly from the accepted structured organization/workspace records,
with Markdown headings, full instruction text, applicability and canonical references.
Metadata is escaped; incomplete layers are visibly unavailable, never empty.
The instructions_identity comment identifies the governing set delivered by load and
context channels, not the different Markdown file bytes. Exact comparison with the
deterministic current rendering detects corruption or stale formatting even when
that comment is unchanged. Exclusive temporary creation and atomic rename preserve
a complete view; unchanged bytes are reused. The view is never canonical policy.

The initial distribution declares no common, runtime or operations migration step.
For a separately reviewed update, migration uses observed source locators and contract facts as data. It preserves the
source maintenance mode, revision, ownership and safe active code through a scoped
conditional stage/activate/readback transaction. A missing target declaration is
never evidence of normal mode. Unknown source maintenance or unreconciled target
state blocks activation; interruption after activation retains recovery. Native
consents, sole checkpoints, peers and INSTALL-13/14 boundaries remain effective.
When a reviewed descriptor requires common-scope work, it regenerates Markdown from
authoritative records, reconciles readers and retires an inactive view only when no ongoing reader needs it.
No permanent alternative filename, interface selector or compatibility adapter is
installed. The controller decisions and exit statuses retain their documented semantics.
