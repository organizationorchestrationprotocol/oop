# OOP in action: run organizational work from prompts

Describe the outcome you want. OOP gives a capable AI a shared operating discipline for turning that request into understood scope, accountable work, authorized execution, verified results and a next step that survives the chat.

You can use that discipline across an entire organization: product, operations, suppliers, customer work, decisions and projects. The user does not need to name every team or write a perfect ticket first. The AI identifies relevant consequences and coordinates the work under the organization's actual policy.

Demonstration scenarios are examples of OOP behavior.

## Choose a starting point

| Your situation | Start here |
| --- | --- |
| Run a digital company | [Launch a commercial offering](#1-digital-company-launch-a-commercial-offering) |
| Coordinate digital and physical operations | [Open an operational location](#2-hybrid-company-open-an-operational-location) |
| Manage client work as a professional | [Take an engagement through acceptance](#3-independent-professional-deliver-a-client-engagement) |
| Build an independent project | [Turn an idea into a usable product](#4-independent-project-turn-an-idea-into-a-usable-product) |
| Keep the organization moving | [Direct the next operational cycle](#5-direct-the-next-operational-cycle) |
| Continue with another AI | [Transfer work without restarting](#6-continue-with-another-ai) |
| Avoid unnecessary process | [Keep simple work simple](#7-keep-simple-work-simple) |

Prompt blocks are copyable examples. Replace names, constraints and references with your own. They are shown in English for portability; users can ask in their own language while canonical organizational records remain in English. Ticket IDs and layouts are illustrative: reuse existing authoritative work systems rather than create duplicate records.

## 1. Digital company: launch a commercial offering

### User prompt

```text
Launch a Team plan for our product. Use our existing strategy, pricing policy
and customer feedback. Coordinate the product, website, billing and support
work needed for a coherent launch. Prefer existing infrastructure and avoid
new recurring costs. Perform work within existing authority; surface any
decision or external effect that needs my approval. Show launch readiness
and what remains blocked.
```

### From request to organizational work

The AI inspects the relevant canonical context, asks only material unanswered questions and identifies the effective scope. A pricing-page edit alone cannot establish that billing, entitlement behavior and customer support are ready.

| Work item | Scope and completion evidence |
| --- | --- |
| TEAM-100 — Launch Team plan | Root objective; intended customers, approved offering and accountable disposition of all material launch consequences |
| TEAM-101 — Define offering | Price, limits and policy decisions; approval or applicable autonomous authority |
| TEAM-102 — Implement billing and entitlements | Reviewed change and relevant tests; production effects verified separately |
| TEAM-103 — Align website and support material | Consistent approved claims, inspected output and publication evidence where required |
| TEAM-104 — Release and verify | Authorized deployment, observed plan behavior and billing/entitlement verification |

```text
TEAM-100: proposed → clarifying → triaged → planned → in_progress
TEAM-102: in_progress → verification → completed
TEAM-104: planned → waiting_human → in_progress → verification
TEAM-100: remains in_progress while an essential launch criterion is unmet
TEAM-104: completed after the required external state is verified
TEAM-100: verification → completed → closed when its full completion gate passes
```

If existing policy already authorizes an action, no decorative approval round is needed. If approval is required, the AI prepares a concrete reviewable proposal before waiting. A green CI result or merged PR does not establish production deployment. Before advancing the deployment ticket, the AI routes the completion claim through its applicable execution, change, security and evidence rules.

**What the user gains:** one business request drives coordinated delivery across dependent surfaces, with a truthful readiness view and a precise next decision.

## 2. Hybrid company: open an operational location

### User prompt

```text
Prepare the opening of our new service location. Reuse the approved budget
and operating policies. Coordinate premises, equipment, suppliers, staffing,
booking systems and readiness checks. Identify the minimum roles needed.
Do not commit spending or contracts beyond existing authority. Assign
physical inspections to responsible people and keep digital work moving
where it is independent of those inspections.
```

The AI discovers relevant owners, requirements and dependencies instead of assuming it can inspect a building or sign a contract. It can prepare comparisons, plans, configuration changes and instructions using available capabilities. Procurement, legal decisions and physical work follow their actual authority and capability boundaries.

| Ticket | Representative flow | Evidence for progression |
| --- | --- | --- |
| SITE-200 — Operational opening | triaged → planned → in_progress → verification | Readiness across the effective opening scope |
| SITE-201 — Equipment procurement | planned → waiting_human → in_progress | Authorized order; supplier confirmation does not prove delivery |
| SITE-202 — Site inspection | waiting_external → verification | Attributable inspection results against applicable requirements |
| SITE-203 — Booking configuration | in_progress → verification → completed | Observed authorized configuration and relevant functional checks |

A delivery delay leaves equipment readiness unresolved. Independent booking work may continue. The root ticket cannot claim an operational opening merely because digital setup is complete; essential physical and policy requirements still need evidence.

**What the user gains:** digital and physical responsibilities become one understandable plan, with explicit human interventions and no fabricated physical-world success.

## 3. Independent professional: deliver a client engagement

### User prompt

```text
Manage the Acme engagement from the accepted brief through delivery.
Use the agreed scope, deadline and acceptance criteria. Plan the necessary
work, produce the deliverables using available tools, track feedback and
prepare client communication. Ask before sending messages unless I have
already authorized the recipient and scope. Flag scope changes before
doing additional work.
```

```text
CLIENT-300 — Deliver engagement
  proposed → triaged → planned → in_progress
  production complete → verification against the agreed criteria
  delivery authorized and observed → waiting_external for required acceptance
  acceptance evidenced and applicable criteria met → completed → closed
```

If feedback changes the agreed objective, the AI evaluates scope, authority, deadline and dependencies before the next effect. Preparing a message is distinct from sending it; sending is distinct from client acceptance. When acceptance is an essential criterion, the work remains outstanding until that criterion is met or the outcome is explicitly revised under authority.

For a small engagement, an existing client issue or project record may suffice. OOP does not require a separate ticket database, duplicate approval log or new paid service.

**What the user gains:** scope and commitments stay visible, delivery status stays accurate, and the next session can continue without reconstructing the engagement from chat history.

## 4. Independent project: turn an idea into a usable product

### User prompt

```text
Turn this idea into a usable first version: a local tool for organizing
research notes. Propose the smallest useful outcome, clarify important
unknowns and work through implementation and verification. Prefer local,
open and zero-cost options. Keep deployment outside scope unless a real
requirement makes it necessary; explain that change before external effects.
```

| Work item | Concrete result |
| --- | --- |
| NOTES-400 — Usable first version | Defined user outcome and success criteria |
| NOTES-401 — Select minimum design | Reviewed constraints and an adequate simple approach |
| NOTES-402 — Implement local workflow | Inspectable changes and tests relevant to the actual behavior |
| NOTES-403 — Verify usability | Evidence against the defined local outcome; unresolved essential issues remain open |

```text
Local-only scope → appropriate managed work and local verification
New requirement: share across machines → re-evaluate effective scope
→ assess storage, privacy, cost, capabilities and authority
→ expand applicable context before the new effect
```

The AI does not label the project deployed merely because local tests pass. Nor does it introduce hosting simply because the work is a software project. A metadata correction can reuse valid context; changing the ticket to verified-complete requires re-evaluating the facts that transition claims.

**What the user gains:** the idea becomes executable work while infrastructure and process stay proportionate to the actual outcome.

## 5. Direct the next operational cycle

### User prompt

```text
Review our organization against its current goals. Use canonical state and
relevant evidence to identify the next priorities, dependencies, drift and
blockers. Advance independent work that existing policy authorizes and your
available capabilities support. Prepare concrete proposals for decisions
that need me. Report verified progress, unresolved effects and the next
permitted actions. Stop at the agreed session budget; do not create a
scheduler or an unattended recurring workflow from this request.
```

This is how prompt-driven direction can span the company rather than one isolated task. OOP supplies the shared discipline; an actual runtime performs only work it can safely interpret and execute.

| Discovered fact | Organizational response |
| --- | --- |
| A product milestone is ready for an authorized local next step | Advance that step and verify its result |
| Website pricing contradicts the approved offering | Evaluate effective scope; propose or apply the authorized correction |
| A supplier dependency prevents opening | Preserve the blocker, responsible follow-up and resume condition |
| A production change needs approval | Prepare the reviewed change and required verification/recovery plan |
| Required external state cannot be observed | Keep verification pending; identify owner and next check condition |

An operational update can be concise:

```text
Verified: local milestone implementation meets its defined criteria.
Applied, verification pending: booking configuration changed; external
confirmation unavailable.
Blocked: supplier delivery date unresolved.
Decision needed: approve the proposed production release scope.
Next permitted action: finish the independent support documentation.
```

The organization retains decisions, accountable state and evidence in operations or its authoritative sources of record. Private technical integration remains in .priv. Future prompts can direct the next cycle from that state; continuity does not depend on one AI's memory. This is not a claim that OOP alone implements autonomous management or background execution.

**What the user gains:** prompts become a repeatable way to direct coordinated organizational progress while retaining control over consequential decisions.

## 6. Continue with another AI

### User prompt

```text
Prepare a handoff of TEAM-100 to another AI. Preserve effective scope,
verified results, actual partial effects, approvals, blockers, repository
references and the next permitted action. Reuse accessible shared credentials
by secure reference. Do not include secrets in the normal handoff. Report
which handoff phases are actually evidenced.
```

```text
Source: preparing → ready → delivered, when delivery is observed
Destination: validates its own access, protocol context and current facts
→ accepts responsibility → performs and verifies its first continuation action
Only then: resumed
```

If the destination is unavailable, preparation can finish while acceptance and resumption remain pending. A shared checkout transfers neither adoption nor active context. After recovery, the destination reloads applicable verified protocol sources and reconciles actual interrupted effects before continuing; it does not repeat an uncertain external action blindly.

**What the user gains:** replacing the AI or ending a session need not mean restarting the organization or losing accountable work state.

## Equal applicability: combined functions and established governance

These are illustrative scenarios, not executed integrations. A Solopreneur can cover product, R&D and Marketing without creating HR, a board or an investor function. A research result that materially changes a launch needs the relevant product and Marketing consequences tracked; unrelated functions are not engaged.

An established company with directors, a board and two sites uses the same protocol. AI can prepare a revised roadmap and support several functions, but cannot substitute a director's decision for a required board or budget approval. Existing responsible humans, site obligations and authoritative finance/HR systems remain in place. Authorized independent work can proceed while the specific approval-dependent action waits.

A nonprofit planning a physical location keeps proposed structure distinct from actual operations. Updating its opening plan proves a document change; it does not prove the site was inspected, equipped or opened. A new or restructured organization must verify authorized actual effects before representing its intended hierarchy as applied.

## 7. Keep simple work simple

| User prompt | Proportionate response |
| --- | --- |
| “Explain the current pricing policy.” | Read relevant context and answer; no artificial mutation checklist or ticket |
| “Correct this ticket title under the existing scope.” | Lightweight authorized correction; reuse valid context and sufficient existing evidence |
| “Apply these similar metadata corrections.” | Reuse the closure while identity and governing conditions remain valid |
| “Now mark the deployment done.” | Re-evaluate the completion claim and applicable evidence before advancing state |

**Maximum rigor with minimum ceremony.** The benefit is not generating more tickets. It is making the required work, authority, observed results and continuation understandable at the scale that the real effect needs.

## Start with your own organization

After bootstrap, a useful first request is:

```text
Use OOP to help manage this organization. Discover our existing canonical
organizational state and private runtime references before creating anything.
Our immediate goal is: [goal]. Our constraints are: [constraints].
Understand the current state, identify the effective scope and take the next
authorized steps using your actual capabilities. Keep material decisions,
verified progress and blockers reconstructible for the next human or AI.
```

For protocol maintenance, follow the [canonical prompt](PROTOCOL.md).

## Unknown future AI continuation

AI A observes a reliable comparable 15% remaining active-session budget; no destination AI has been chosen.

```text
AI A warns user before preparation
→ stops starting new non-essential work
→ stabilizes only in-flight operations riskier to interrupt
→ records actual effects and updates canonical operations
→ prepares universal portable package and private recovery manifest
→ includes credential requirements and ordered non-secret acquisition plan
→ marks package ready, destination unknown, delivery/acceptance/resumption pending
```

Give the non-secret package to the next AI tool. If it cannot resolve the referenced secure credential source, follow the acquisition instructions and provide a separate authorized secure transfer only if needed. Do not paste secrets into the ordinary package.

```text
Later AI B receives package and inspects identity/integrity/provenance
→ bootstraps its own adoption, private root and capabilities
→ classifies resources against its own current state
→ reuses accessible shared references; ignores source-specific runtime state
→ imports only checked portable resources; reacquires unavailable dependencies
→ securely resolves credentials and verifies own access and current facts
→ computes own applicable verified closure and next permitted action
→ destination_validated → accepted for that scope
→ performs and verifies the first next action → resumed
```

A shared private root avoids secret copies. Separate roots or machines use remapping and secure acquisition as necessary. Missing write permission blocks write-dependent acceptance while an independently validated safe read-only responsibility may proceed.

## Persistent workspace activation examples

### New chat tomorrow

After an authorized first bootstrap establishes the workspace binding, a supported native pointer resolves it in a new chat. The runtime checks due freshness or reuses verified same-day evidence, independently verifies its adoption, reconciles relevant private/operations facts, shows alignment and classifies the request. Two chats on one day may reuse one successful remote check; two runtimes still have two adoption checkpoints. G0 explanation requires no ticket.

### Old chat reopened months later

Historical chat memory is not current authority. Resolve current binding/bootstrap and eligible publication, perform applicable owned migration/realignment, then attest before resuming. If upgrade is blocked, preserve the prior verified checkpoint and block affected effects; independent safe analysis may continue.

### Another AI created operations

Discover the canonical identity and relevant current state, verify it and reuse it. Creator identity does not justify operations-2 or another duplicate. If a required migration was applied by another actor, verify the canonical record AND actual results and report ALREADY_SATISFIED without replay. If no transformation is required, report NOT_REQUIRED.

### Future OOP release

A stable pointer remains unchanged while verified adoption and realignment supply new rules. For example, rule X in a later eligible revision is loaded from its verified context, never copied into the adapter. A changed bootstrap path requires owned pointer migration/verification before alignment.

### Compact alignment examples

Aligned: binding VERIFIED; freshness REUSED_VERIFIED for today's configured remote; adoption VERIFIED with version and immutable identity; shared private and owned state VERIFIED; pointer VERIFIED; canonical operations REUSED_VERIFIED; migration NOT_REQUIRED; request G0/no ticket; current scope VERIFIED.

Offline: binding VERIFIED; remote latest UNKNOWN/OFFLINE; use the named locally verified identity with its publication/adoption basis; no new latest claim; migration NOT_REQUIRED for reviewed scope; independently safe current work only.

Blocked: binding VERIFIED; new target available but migration BLOCKED; prior verified identity preserved; shared private, owned state and operations reported separately; no affected governed effects until the recorded blocker is resolved. Unsupported native activation is explicitly UNSUPPORTED with a manual recovery path, even if current manually loaded context is safe.

## Project isolation and interaction examples

The active project identity determines every private and canonical scope.

### Project A initialized, Project B empty

Runtime finds A/.priv, A/operations and A/OOP. It first establishes that current workspace is B. B remains empty: do not read A tickets or treat A repositories as B bootstrap. Create B-local resources only when required and authorized.

### Two runtimes on one project

Runtime 1 and Runtime 2 both verify the same project identity. They may reference that project's common private resources. Each keeps its own adoption checkpoint and adapter verification.

### Switch from A to B

Invalidate A's active ticket, operations pointer, binding, checkout identity, scope, inventory, derived instructions, private hints, continuation state and credential applicability. Preserve A's persisted files. Resolve B independently.

### Old chat and same-day reuse

A chat from before adoption re-enters current OOP on its next interaction. A second interaction that day reuses valid freshness and loaded context; it does not fetch or reread the full prompt. A newly observed release still follows adoption and realignment.

### Continuity reserve reached later

If a reliable remaining usable session budget falls to 15% during a long conversation, stop new non-essential work, tell the user and prepare verified continuation under the existing reserve contract.

### Ticket opening and transition

For a Git-backed ticket, compare the expected state/revision, sign one transition commit, verify its signature, push immediately and read back the canonical remote ticket state. Then notify the user of the verified result. If push fails, tell the user the transition remains unpublished and preserve recovery facts.

### Concurrent ticket transitions

Two runtimes start from revision R. Runtime A publishes R→R1. Runtime B's expected R fails; B rereads R1 and reconciles instead of overwriting it or claiming last-writer-wins.

### Shared external credential

A/.priv and B/.priv can each reference a secure external credential X after separate authorization and applicability checks. X does not make the roots or project state shared.

## Regression evidence and anti-patterns

Informative illustrations of canonical section 27. The EVID-1 through EVID-10 labels are illustrative coverage references, not proof that ten maintained test definitions, unique observation IDs, a permanent suite, or passing results are present. Determine actual case inventories and test outcomes from verified maintained artifacts when available; no execution is claimed here.

A maintainer has verified checkpoints R1, R2 and R3. A new change starts after R3: rolling regression compares against R3. R1 can additionally support cumulative coverage. Choosing R1 as primary fails even if all R1 cases pass, unless an explicit attributable justified override records both R1 and R3.

An added canonical obligation receives SD-001 with requirement, source locator, classification, affected derived paths, verification references and seven impact dispositions. Removing that delta makes release coverage fail. Correcting only a report is evidence-only; reducing MUST to SHOULD requires semantic review and cannot hide as editorial.

| Wrong assumption | Correct interpretation |
| --- | --- |
| Attempt succeeded, so deployment is applied | attempted ≠ observed ≠ applied ≠ verified |
| Downloaded version is active | downloaded ≠ applied ≠ verified |
| Old chat already knows OOP | Resolve the current workspace gate; reuse valid evidence only |
| A private state can bootstrap B | B independently resolves its own identity, private root and operations |
| Ready handoff means work resumed | prepared ≠ delivered ≠ accepted ≠ resumed |
| Historical cases pass, so current regression passes | Supplemental cumulative coverage cannot replace latest-prior rolling regression |

A first-use destination independently bootstraps and resolves secure access. A returning destination checks its owned checkpoint and current facts before reuse. Neither inherits the source adoption. After a timed-out execution, inspect actual effects before retry; applied but unverified effects remain pending.

## Self-materializing governance examples

| Environment | One invariant: validate governance before a local file mutation | Actual guarantee |
| --- | --- | --- |
| Persistent instructions plus native pre-operation and completion gates | Derive private controls from current OOP, test allowed/denied paths, bind digest/capabilities and block stale state before effects and completion | Deterministic only for tested reachable paths; residual coverage remains explicit |
| Persistent instructions plus local external validators | Use the validators to prevent or invalidate affected actions and retain semantic judgment for scope/authority | External deterministic coverage plus semantic interpretation |
| Semantic instructions only | Apply the current contract, disclose unavailable deterministic interception and recover from canonical references | Semantic fallback; no fully enforced claim |

For example, an unchanged attestation can reuse the same-day freshness result with zero new remote checks. A changed OOP commit requires assessment of the affected requirements and invalidates dependent controls when their governing source changes, even when a version label is unchanged. A tracked private file blocks sensitive publication even if an ignore rule exists. A successful operation response still needs result validation before a scoped completion claim.

Tool A reads canonical remote commit R and local commit R to track synchronization; it does not compare OOP files with committed contents, audit the repository or test the release. Tool B may share that checkout but still have verified adopted commit Q; B evaluates compatibility and its own applicable adoption checks before advancing to R. Maintainers keep their uncommitted release candidates separate from committed release identities. When the remote is unavailable, its current commit remains unknown; a cached R is only the last observation. R and Q are illustrative placeholders, not usable commit IDs: actual checkpoints record available full Git object IDs and repository/ref scope.

**Bounded pricing proposal.** A user asks to change a subscription price. The worker can research and propose changes but has no publication authority. Where supported, the runtime assembles applicable current rules and verified facts and confines executable operations to permitted scope. The AI proposes the price and dependency analysis. A syntactically valid proposal still lacks business approval; the publication path stays blocked until applicable approval, current-state and outcome checks pass.

**Same policy, different wording.** An AI may prepare a subscription-price change but cannot publish it. The runtime may phrase its instructions differently, while verified constraints retain proposal-only authority, the current governing policy and the publication approval requirement. Matching prompt text or digest does not prove current authorization.

**Real interception versus illustrative instruction.** A prompt prohibits modifying a protected resource. An isolated script rejects a sample operation, but an installed alternate path can still change the resource: full prevention has not been demonstrated. After a verified effect gate covers the claimed paths, exercise harmless allowed and denied actions through actual installed invocation. Report only tested coverage and explicit remaining gaps.

**Controlled correction after denial.** A proposal fails because its expected state is outdated. The runtime returns the minimum safe attributable factual reason and constraint references. The AI reads changed facts and proposes an authorized correction; repeating the unchanged denied action is neither progress nor permission to bypass the guard.

Maintenance navigation: [canonical prompt](PROTOCOL.md).

## Context-independent governance and semantic routing

| Scenario | Expected behavior and evidence |
| --- | --- |
| Old chat reopened after a release changed | Resolve this workspace binding and own adoption; old conversation text cannot prove current context. |
| Context compaction removes retention evidence | Invalidate affected cache, verify adopted Core/index and selectively reload the closure before effects. |
| New model or runtime joins | Establish independent runtime identity/adoption and available context; another runtime load log is insufficient. |
| One module is stale; three retained artifacts remain verified | Reload the one affected module and required routing/facts; reuse the three valid artifacts. |
| Read-only explanation | Core plus applicable intake/interaction context suffice; no ticket or full deployment closure. |
| Local correction evolves into repository push | Union actual repository action with request route; load runtime/access rules before the push. |
| G1 edit becomes G3 production deployment | Add execution/change/cost and relevant security closure before deployment and independently verify outcomes. |
| Credential use discovered late | Add the authority/credential facet before use; discover/reuse secure reference and verify this runtime access. |
| Scope expands to another asset | Recompute closure and dependency consequences before changing that asset. |
| Positioning changes | Inspect downstream messaging, brand and commercial assets; do not close while an essential consequence remains unverified. |
| Completion discovers an actual deployment absent from the plan | Final rerouting adds execution postconditions; success stays blocked until those checks pass. |

Conversation context is an execution cache, not a source of normative authority. Static expected facets in a semantic-routing scenario fixture, if one is generated, do not prove autonomous live language classification. A missing fixture provides no executable scenario evidence, and isolated local fixture models do not prove installed runtime interception.

**Revision changed during reasoning.** A candidate action used authoritative policy revision R12; policy has advanced to R13. Before the effect, the guard rejects the stale expected revision and selectively refreshes dependent scope, constraints and evidence. Independent authorized work continues. Where supported, an atomic conditional action binds the effect to the expected revision, closing the race between checking and writing.

**Compaction and prompt reuse.** After context loss, remembered instructions cannot prove current context. The runtime verifies adopted protocol/source identities, reconstructs missing action context and reroutes if scope changed. Repeated homogeneous G1 edits under unchanged verified rules, authority and scope can instead reuse valid context without reading every module or rebuilding an identical prompt for each edit.

**Ten edits, still-checked effects.** An AI revises ten descriptions under unchanged approved constraints. The runtime reuses valid governance context and evidence instead of rereading the full rules or calling another model for every edit; each protected write still passes its applicable gate. Attempted publication, a forbidden resource, changed scope or an outdated revision causes the relevant checks to be reconsidered.

## Isolation, resources and runtime suitability

A workspace switch must discard Project A's effective permissions (SEC-07); independently, unavailable Project B credentials must not be replaced by unapproved personal credentials (SEC-06).

| Scenario | Expected behavior |
| --- | --- |
| Project A and B share a computer and provider account | They retain separate private roots, operations and current project state; proximity is not ownership. |
| Multiple authorized runtimes open the same main folder | Verify one workspace identity; reuse shared references, independently configure and validate each owned adapter/checkpoint. |
| A copied binding points to another project | Reject dependent activation/effects; do not silently inherit authority or rewrite the other project. |
| Explicit authorized canonical cross-project relationship | Consume the modeled reference within scope without importing foreign runtime authority. |
| New shared repository credential | Name by purpose, such as repository-access, with one canonical secure source; authentication and signing remain separate. |
| Existing codex_repository credential is shared and authorized | Detect its legacy coupling, preserve it and configure the joining adapter; no blind rename/rotation. |
| Runtime-owned adapter directory | A runtime identifier is appropriate inside its owned scope. |
| Full applicable interception observed through allowed/denied paths | Suitability may PASS for the verified scope; evidence binds workspace, runtime, source and capability identity. |
| Per-turn or completion blocking absent | No full-governance claim; disclose missing paths and restrict dependent work. |
| Previously verified completion control becomes stale | Invalidate readiness; inspect partial effects, authorizedly repair, revalidate or block. |
| Empty operations at first adoption | Discover source facts, distinguish observation/inference/unknown, ask only material gaps and expose domain coverage. |

## Maintainer routing and context examples

**Structured release generation.** A maintainer reviews the entire canonical source and binds an explicit semantic allocation to its current contents. Generation preserves every clause once in 35 modules; a normal informational interaction selects entry/workspace/context/Core, while a planned durable write expands the action closure. A changed source or unreviewed allocation stops generation rather than guessing module membership from headings. Producer checks stay under maintainer tooling.

**Scope-bound package acceptance.** The real package's source reconstruction, schemas, references, closure, supplied-fact guards and context reuse pass locally. This supports a prepared distribution claim only: no runtime controls were installed, no repository credential was enrolled and no cross-product handoff was observed. The receiving runtime still performs BOOT-12 installed-path probes and its own credential-based operations checks; it never runs the package acceptance suite.

**AI-first acceptance.** A producer exports an access obligation with stable identity, canonical locator, actor, trigger, scoped prerequisites, verification and failure/recovery fields. A schema can establish its structure; complete semantic review still checks that exceptions and normative force survived. An entry that points to a missing dependency or an incomplete candidate is not ready even if one local fixture passes. The consumer reads the ready selected contracts; it does not run producer schema or release tests.

**Efficiency without invented savings.** Compare an ordinary informational route and a write route using the same stabilized fixture catalog, measuring selected governing bytes and selector/assembly duration. Label those as isolated fixture measurements: they do not establish production token savings, model calls, monetary cost or end-to-end bootstrap time. Retain a separate rolling semantic regression basis. An extra local interpreter is adopted only when its real setup and repeated-use cost is justified.

**Incremental loading and guards.** An information request selects Core. A subsequent write adds the operations dependency closure before its effect. Unknown credential write permission remains unknown and prevents dependent readiness; a user reply cannot convert it into an observed fact. Changing the adapter invalidates its proof and dependent adoption, while independent credential evidence can remain valid. A transition evaluator performs no enrollment or repository creation and grants no authority.

**Release tests versus consumer bootstrap.** A maintainer changes routing and verifies release semantic coherence, source-to-derived consistency and regression coverage before publication. A consumer adopting that revision does not rerun the maintainer release suite, even if an adapter or migration descriptor asks for it. It still evaluates applicable compatibility and migration and exercises its own installed routing and allowed/denied control paths where required. The maintainer's release result does not prove the consumer's integration, and the consumer's bootstrap PASS does not certify the release as a whole.

A normative routing change starts in PROTOCOL.md. Review its actor, trigger, scope, exceptions and evidence threshold; regenerate the commit-bound Semantic Routing Index and affected split/profiles; update traceability, rolling regression, semantic scenarios, README and examples. An index contradicting canonical source is stale derived state and is invalidated; canonical source wins. The full source is reviewed for normative maintenance, while consumers use selective rehydration. No installed-runtime or provider result is inferred from synthetic tests.

Maintenance guidance: follow the canonical [protocol revision, regression and documentation requirements in PROTOCOL.md](PROTOCOL.md) (§27), together with the [README maintainer guidance](README.md#for-ai-tools-maintaining-this-repository).

## Project continuity when the AI changes

These examples explain existing OOP rules; they introduce no new requirements.

After three months with AI Tool A, a user hits usage limits, changes subscription, prefers another tool or loses access to Tool A. Without durable state, rebuilding project context, decisions, architecture, open work and constraints can consume hours. AI Tool B instead reconstructs the relevant state from durable project sources, verifies its own access, compatible OOP adoption and applicable controls, and continues from verified facts. Tool A's chat memory is unnecessary; B's capabilities and authorization still matter.

What OOP may save in practice: re-explaining decisions, repeating completed work, correcting context-loss errors, avoidable rollback and rework, and reconstructing responsibilities or current state. Hours of context rebuilding and duplicated work may be avoided; OOP does not directly generate profit or guarantee savings. Existing local/free capabilities may also avoid unnecessary recurring service cost.

A simple continuation: the previous AI saved that steps 1 and 2 were verified, step 3 awaits approval, and step 4 depends on step 3. A compatible authorized AI checks the current facts, preserves the approval boundary and resumes the next permitted step without repeating steps 1 and 2.

## Old chat and stale context

A user reopens a chat from two weeks ago. OOP has changed, or the model context has been compacted. The AI cannot trust its remembered rules. It resolves current eligible OOP and its own verified adoption, determines which modules are needed, reloads only missing or stale context and relevant durable facts, and continues only after that context is verified. Valid unchanged context can be reused; a remembered load alone is insufficient. No new adoption or completed live interception is inferred from reopening the chat.

## Everyday continuity beyond software

### Freelance / independent professional

A consultant changes from AI Tool A to AI Tool B midway through a client engagement. B reconstructs agreed deliverables, decisions, deadlines, blockers, open questions and next permitted actions from durable sources. If a report awaits client approval, B preserves that boundary instead of treating a saved draft as approved.

### Small team

Two humans and multiple AI tools work on one project. They reference the same shared decisions and current work state rather than invent incompatible versions. Each AI verifies its own adoption and access; conflicting proposed deadlines remain unresolved until the authorized decision is recorded. Shared state can reduce avoidable rework without guaranteeing error-free collaboration.

### Commercial/client workflow

A customer engagement continues across sessions and AI tools. The next AI reconstructs scope, pricing assumptions, commitments, outstanding deliverables and approvals without requiring the user to repeat them all. A pricing assumption is still an assumption; only the authorized current offer establishes a commitment. The CRM or signed agreement remains authoritative where applicable.

### Collaborator change

A human or AI collaborator leaves. The replacement reconstructs what was decided, what is complete, what remains open and why decisions were made. It checks evidence for completed deliverables and takes the next permitted action after its own access and context checks. A handoff package alone does not prove that the replacement accepted or resumed the work.

## Autonomous repair and true waiting

Informative: a validator fails, the runtime identifies an authorized local fix, repairs it, reruns the affected checks, continues and verifies. This is actionable remediation, not waiting_human. A failed mandatory check still blocks its dependent success claim. If an approval control can only be operated by the user, request that exact action, retain the observable unblock condition and resume after its resolution is observed.

## Reusable runtime and separate workspaces

Informative: enable and verify generic runtime controls once, then adopt Project A. Opening Project B reuses valid environment evidence and performs B's identity, binding, adoption and integration probes. A's operations, tickets, private context and checkpoints never become B's state. Two workspaces may select different verified protocol content identities through the same version-neutral sentinel. Upgrading B leaves A untouched.

## Context and evidence recovery

Informative: after compaction, reroute the next action, load only missing or stale dependency closure and reuse unaffected evidence. Changing one completion mechanism invalidates that mechanism's dependent proof; it does not invalidate independent repository authentication or source integrity. Stabilize its new digest before full verification.

## Second project in the same AI environment

Project A already enabled generic environment controls. When Project B opens, the runtime validates their identity and dependencies and reuses still-valid capability evidence. It independently establishes B's identity, binding, adoption and private state, then checks isolation and B-specific integration/reachability. There is one generic setup and two independent project adoptions; A's operations, private state and authority never become B's. If a generic mechanism is invalid but safely repairable, repair comes before replacement.

## Different verified OOP identities

Project A has verified OOP content identity A and Project B has verified identity B, potentially at different versions. The same thin version-neutral global sentinel identifies the current workspace and resolves its local binding independently. Updating B changes only B's verified adoption and applicable derived state; A retains identity A. The sentinel contains neither a project version nor copied release rules.

## Authorized project identity and real control invocation

1. **Fresh project, working personal login.** The AI finds a valid personal provider session in the host environment. That success grants no project permission. It resolves the current project's authorized identity reference and isolates inherited settings before sensitive effects. If none exists and required work authorizes preparation, it prepares a minimum-privilege identity; unrelated reading creates nothing.
2. **Project A credential visible from B.** A's secret is accessible on the same machine. B cannot use it merely because the owner matches. Only an explicit independently verified B/destination/operation/purpose delegation can authorize an external reference. A revoked B identity cannot trigger fallback to A or to a personal login. Independent safe reading may continue.
3. **Safe preparation, actual human enrollment.** Preparation finishes autonomously, then the provider requires the human to register the identity. For a selected asymmetric-key mechanism the AI shows the complete public key and fingerprint, target and permissions in the user's language; it never shows the private key. For a selected non-SSH application identity it shows safe enrollment/consent references instead. Authentication registration and signing verification are distinct where applicable. Dependent writes wait; a confirmation prompts independent verification of real authority, not an assumed pass.
4. **Second AI on the same project.** Runtime B resolves the project's existing secure reference created by A, verifies scope and configures its own controlled adapter. It neither copies nor rotates the credential and independently verifies effective actor, required access, attribution and signing. A's passed checks cannot attest B's integration.
5. **Script passes, installed launcher fails.** An isolated validator rejects a forbidden operation, but the installed runtime dispatch selects an incompatible interpreter or misquotes a path. Coverage fails even though the script bytes are unchanged. The AI repairs only the authorized runtime-owned dispatch, freezes the new invocation identity and reruns allowed and denied probes through that installed path. If the runtime cannot intercept the action, it declares the limitation and blocks the mandatory dependent effect.

A conditional Git/SSH adapter can select its authorized key and isolated execution settings; these are implementation choices. An authorized non-Git source of record can instead condition a transition on revision 12, attribute the actor and read back revision 13. A second writer still expecting 12 fails without replacing 13. Both mechanisms preserve the same authority, conditional durability and observation requirements; selected Git transitions retain their signed immediate publication contract.

## Consumer bootstrap without OOP repository verification

After cloning OOP, read its instructions and begin bootstrap. Do not inspect OOP signatures, checksums, inventory completeness, file-to-commit correspondence, publisher identity or release conformance. An adapter or optional policy requiring these checks is inconsistent with BOOT-04 and must not introduce them into the consumer workflow. Record repository/release verification as not_performed; continue applicable consumer integration and control verification without claiming release certification.

| Situation | User interaction and actual next step |
| --- | --- |
| First consumer bootstrap | Read the cloned OOP instructions, record available version metadata and prepare the consumer workspace; no OOP repository audit, publisher question or release test. |
| Old chat reopened or newer revision downloaded | Re-enter consumer bootstrap and evaluate applicable compatibility, migration and installed controls; do not verify the OOP repository or rerun release tests. |
| Historical OOP publisher pin exists | Preserve it as historical evidence without signature checks, automatic pin advancement or claims of renewed verification. |
| Authorized credential enrollment | Prepare eligible secure references first. If the owner must enroll them: "Register this public identity for Project A with the shown permissions. You can decline; repository writes will remain paused." Reuse the existing secret, verify actual registration/access, then resume. |
| Recoverable local validator error | Repair within authority, rerun affected allowed/denied checks and resume; no permission question for already-authorized repair. |
| Real owner-only approval | "The reviewed change will publish this release to the configured repository. Approve this exact publication / Decline." Ask only when existing authority does not already cover it. |
| Two tools share the OOP checkout | Each establishes its own consumer adoption and integration; neither audits the OOP repository or certifies its release. |
| Missing installed interception | "This tool cannot yet stop the protected action before it runs. That action remains paused; I can finish the independent documentation." No full-enforcement claim from local fixtures. |

For example, three consumer entries after cloning require zero OOP publisher-trust answers and zero repository/release verification runs. Required consumer access checks, ticket notifications and entry alignment remain scoped and truthful.

## Full first setup examples

**Opening explanation (localized by the runtime).** "I am starting OOP bootstrap. I will prepare local private state, connect your project and operations, and configure and check this runtime's controls. I will read OOP without auditing its repository or testing its release. `.priv` keeps technical state outside version control: resources shared within this project, secure credential references and separate runtime adapters/checkpoints. `operations` preserves project knowledge, decisions, tickets and history by relevant domain so work can continue across sessions and compatible AI tools; secrets stay out. Once setup is ready, you can describe work in ordinary language, inspect progress and decisions, and resume with another compatible authorized tool. If something necessary is missing, I may ask for the project source address, destination/account details, essential setup facts, repository creation or attachment of the prepared public credential identity with read/write access. I will explain any required action at that step; no private keys or tokens are needed in chat."

**Action-level feedback.** Before preparing `.priv`: "I am preparing this project's private technical area, separate from versioned project records. It will preserve setup checkpoints so an interrupted setup can resume." Before checking operations access: "I am checking that this runtime's prepared credentials can both read and write operations. This lets it recover prior decisions and save new work; public reading alone would not prove that access." On completion, report the actual result rather than imply success from the explanation.

| Situation | Observable flow |
| --- | --- |
| Fresh project with source supplied | Submit CTA once → reuse/download OOP → protect private root → read source without keys if public → prepare private operations → install/probe actual controls → report verified setup and wait. No publisher question or package attestation. |
| Missing source | After safe local preparation ask “Which repository contains your project? Paste its address.” Save the verified same-project reference; do not ask again after restart. |
| Existing shared access | Tool B resolves Tool A's authorized project credential reference, configures only B, verifies B's required access and continues without copying secrets. |
| Human-only enrollment | Prepare the selected mechanism, show only public enrollment material, exact source/operations target and least permissions; user enrolls it, AI verifies real access and resumes automatically. A confirmation alone proves nothing. |
| Remote operations exists | Discover canonical identity, verify both reading and writing through the runtime's prepared credential/adapter, clone once, verify binding and synchronize safely; do not check private visibility or create operations-2. |
| Operations confirmed absent | Verify provider/namespace and creation rights, checkpoint intent and request private creation settings without checking resulting visibility. If only the owner can create, show the exact destination, creation steps and how to attach the previously prepared runtime credential using public material or a safe reference with minimal read/write permissions; rediscover and verify that credential's access after the action. |
| Prepared credential cannot access operations | First repair an authorized local adapter problem if possible. If enrollment is owner-only, name the actual provider/account/repository and prepared public credential identity, give its discovered enrollment/permission steps and minimal read/write permissions, await the user's action and reverify. Do not replace the credential with ambient access or treat public reading as success. |
| Provider-specific enrollment example (conditional) | If the actual provider supports repository deploy keys, show the prepared public key and the exact operations repository, explain how to add that public key with write access in the provider's discovered settings, then verify reading and writing through the configured runtime adapter. If that provider uses another permission mechanism, give its actual steps instead; never expose or request the private key. |
| Dirty or divergent operations | Preserve both histories/changes; reconcile under existing authority before dependent writes. No force/reset. |
| Missing runtime control | Discover authorized native/external alternatives, install or repair a suitable control, then test actual registered allow/deny dispatch. Only observed covered paths support readiness. |
| Unsupported or revoked path | Finish independent safe setup, identify the precise unavailable/revoked protection and affected actions, retain restriction and supported next step; never say fully active. |
| Interrupted creation | Read checkpoint and discover actual remote state before retry; reuse the already-created repository rather than create a second one. |

For example, two authorized tools in Project A use one secure credential reference and two independent adoption records. Project B cannot inherit either authority or readiness. Later entries reuse valid facts and selectively refresh changed controls.
