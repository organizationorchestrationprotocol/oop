# OOP - Organization Orchestration Protocol

Let your project adopt OOP by copying this instruction into your AI tool:

```ruby
execute https://github.com/organizationorchestrationprotocol/oop/raw/main/dist/entry.json
```

## What OOP is

**The AI is replaceable. Your organization is not.** OOP supports long-lived work with AI without making your company, project or professional activity depend on one chat, one model, one vendor or one AI's memory.

**OOP keeps your project from living only inside one AI's memory. It preserves the information needed to continue work in a <ins>standardized, machine-readable format with a verifiable structure</ins>, reduces unnecessary rework, and helps another compatible AI resume without depending on the previous AI's chat memory.**

Some package properties can be checked automatically, but those checks do not prove that an AI has interpreted every rule correctly or safely carried out actions in a real environment.

It becomes useful when AI work stops being only a conversation and starts becoming ongoing organizational work.

OOP is a vendor-neutral operating protocol telling capable AI tools how to work on a long-lived project in a durable, verifiable and resumable way. It applies to companies, non-profits, independent professionals and autonomous projects.

**Build a business that keeps its knowledge as your tools change.** OOP explores **Organization as Code**: your goals, responsibilities, decisions and work become versioned information that people and compatible tools can inspect and continue. `operations` provides one canonical source of digital organizational knowledge, including references to authoritative systems you already use. That shared source uses **CI/CD mechanisms and available automations to coordinate and synchronize the whole organization**, following the domains affected by each task. From that foundation, **AI is an external tool** you can replace; your organization retains its knowledge and authority when a model or AI service is replaced or unavailable.

**For the Solopreneur:** bring product research, development, marketing, personnel needs and investor communication into one coherent picture, even when you wear several hats yourself. When a task needs several functions, OOP connects their dependencies so they can communicate, collaborate and create useful synergy. Coordination stays proportionate: a product description need not create departments or trigger an investor update.

**For established and new organizations:** the same rules preserve real managers, staff, boards, budget approvals, locations and authoritative business systems. A proposed structure stays a proposal until authorized, applied and verified. One person may cover several functions where policy permits; AI assistance never inherits that person's office or approval power.

**Change once, coordinate the consequences.** OOP uses **CI/CD** beyond software delivery to connect shared digital knowledge with the organization's actual work. CI checks a proposed change and identifies dependencies and inconsistencies. CD coordinates authorized updates, task-relevant communication and collaboration, then checks whether affected functions and systems agree with the canonical plan. Available automations can support these steps; approvals, human responsibilities and real-world constraints still govern execution. CI/CD here does not require a hosted pipeline or make every activity an automated deployment.

These short examples illustrate the proposed coordination model, not installed integrations. R&D, marketing, personnel and investor communication are one simplified example among many:

- **A research result changes the roadmap:** check launch, staffing and investor-message dependencies; coordinate approved product, marketing, personnel and investor updates; verify that they reflect the same roadmap.
- **You change a price:** check margin, tax and contract constraints; synchronize the authorized catalog, checkout and sales material; verify displayed prices and a permitted test transaction.
- **A supplier slips a delivery:** check stock, production and customer commitments; coordinate the revised plan and authorized notifications; verify schedules and track customer follow-up.
- **Someone joins the team:** check role, budget and access eligibility; coordinate approved onboarding, accounts and payroll instructions; verify scoped access and readiness with the responsible owners.

Only the functions required by the task participate. Synchronization may involve staged updates and human actions; unfinished differences remain visible and tracked. The commercial hypothesis is less manual chasing, fewer inconsistent promises and more useful synergy from the same shared knowledge.

**The 60-second explanation:** You tell the AI what you want. OOP provides rules and reference artifacts that help it determine which project it is in, which rules matter, what it may change, what must be verified and what must be preserved so another AI can continue later.

**Where time and money may be saved:** OOP aims to reduce organizational friction and avoidable AI-work cost. It may reduce time spent re-explaining a project, duplicated work across sessions or tools, mistakes from lost or stale context, avoidable rollback and rework, and human time spent reconstructing decisions, responsibilities and current state. Keeping work portable can reduce dependence on one AI vendor. Free-First / Zero-Cost Convergence can also avoid unnecessary SaaS and cloud spending; OOP does not directly generate profit or guarantee savings.

**The commercial opportunity to explore:** a Solopreneur could spend more time developing an offer, reaching customers and delivering value if less effort goes into reconstructing context and reconciling disconnected work. A growing organization could reuse the same knowledge across R&D, marketing, human resources and investor relations, potentially shortening handoffs and reducing conflicting messages. These are business hypotheses to test in practice; their value depends on adoption effort, actual integrations and measured results. OOP is a software engineering research and development project with a proposed path to commercial value.

OOP prefers capabilities you already have, local tools and free/open infrastructure before introducing paid services. It asks only for unavoidable meaningful decisions, remembers valid approvals for their exact scope and resumes authorized work after checking your answer. You do not need to choose cryptographic algorithms or automation internals; required identity and safety checks still apply. Setup reuses eligible project credentials and creates only the secrets needed for authorized repositories and purposes; signing credentials are added only when required. For an eligible unattended SSH setup without a signing requirement, one protected authentication key without a passphrase can suffice. Voluntary installation authorizes necessary safe enforcement setup within actual permissions; separate host trust gates still apply. A complete diagnostic plan does not prove complete coverage or enabled hooks. See the [conditional GitHub setup example](examples.md) for the single public-key enrollment request. Real-world time and cost savings require observation.

**For example:** After three months with AI Tool A, you hit usage limits, change your subscription, prefer another tool or find Tool A unavailable. Without durable project state, you may have to rebuild the context, decisions, architecture, open work and constraints by hand. With OOP, AI Tool B reconstructs what it needs from durable project sources, verifies its own access and compatibility, and continues without depending on Tool A's chat memory. This can avoid hours of manual reconstruction and duplicated work; any benefit depends on the actual project and runtime.

**How tools stay aligned:** each compatible AI tool verifies its own private integration and adopted OOP revision. Updates use one migration contract for shared private data, the active tool and canonical operations. A tool checks work another actor already completed before reusing it, so a shared update does not silently upgrade every AI. Current compatibility instructions can cover supported prior states even after OOP history is amended or rewritten. These rules require actual runtime capabilities and evidence; package tests do not establish support by every vendor.

### When OOP is useful

OOP helps when one or more of these describe your work:

- Work continues beyond one conversation, over days, weeks or months.
- Several AI tools contribute, or you want to change tool or vendor without rebuilding the project context manually.
- Decisions and approvals need to survive chat history and remain reconstructible for another human or AI.
- AI can make real changes to repositories, infrastructure or external systems, and verified progress needs to be distinguishable from plans and attempts.
- Session or context limits may interrupt active work, leaving a later session to continue.

### When you probably don't need OOP

One-off factual questions, translation, disposable brainstorming or a single draft or email with no durable state normally need little of this machinery. The same applies to tasks with no meaningful continuation or external consequence. OOP becomes relevant when the work itself needs to survive the conversation.

### Without OOP / With OOP

This compares chat-only work with work applying OOP; other workflows can also provide durable state and controls.

| Without OOP | With OOP |
| --- | --- |
| The chat may be the working memory | The project has durable state outside the chat |
| Decisions may live only in conversation history | Decisions and accountable state remain reconstructible |
| "Done" may blur plans, attempts and results | Desired, attempted, applied and verified remain distinguishable |
| Changing AI can require rebuilding context | Another capable, authorized and compatible AI can resume from durable state |
| Each AI may reconstruct the project differently | AI tools use the same protocol and canonical project state |
| Context exhaustion can break continuity | Continuation is prepared before the session becomes unusable |

### The core concepts

```text
OOP        = how AI is expected to operate
operations = what the organization knows, has decided and is doing
.priv      = private technical/runtime state for this project
AI runtime = a replaceable worker, with its own capabilities and authority
```

The detailed [Where truth lives](#where-truth-lives) table below distinguishes these sources and their authority.

### See OOP in action

**Company:** "Launch a commercial offering." OOP helps a capable AI account for relevant work, dependencies, approvals, authorized execution and verification instead of treating the request as one isolated task.

**Independent professional:** "Deliver this client engagement." Decisions, deliverables, blockers and verified progress remain reconstructible across sessions.

**Solopreneur:** "Turn this prototype into a marketable offer." Link the research evidence and product work to the positioning, launch material and any relevant personnel or investor communication. Shared knowledge helps keep the offer coherent while AI tools remain replaceable. A shorter path to market is a potential benefit to evaluate.

**Independent project:** "Turn this idea into a usable product." Process and infrastructure stay proportionate while the project preserves durable work state.

**[Explore practical examples →](examples.md)** for concrete prompts and fuller workflows, including hybrid organizations.

### The problem OOP solves

**AI sessions are temporary. Organizations are not.** Decisions, state, evidence, repository identity, authorization context, verification, next actions and handoff/recovery context need to survive outside the chat. Another human or AI should be able to understand what happened and continue without the original conversation.

### Language, worker identity and setup progress

You may write in any language. The AI reasons internally in English and writes requested files and documents in English unless you explicitly request another language for that content. Replies follow your effective response-language preference from available authorized profile, application or runtime settings, including saved overrides and their established precedence. Code, quotations and errors may retain their original language.

The entry file opens with the language policy. After identifying your project, each authorized AI tool first checks its shared private language preference in `.priv/common`, then inspects relevant accessible settings if needed. It saves the resolved preference there with its source and scope, so a new compatible tool can find and reuse it when applicable. One tool's setting does not override another tool's applicable configuration. The AI distinguishes settings it has not checked from settings that are inaccessible, absent or conflicting; if it still cannot resolve the preference, it explains the limitation and asks which language to use. It never guesses from your message, location or unrelated device locale.

New AI-created commits use the machine collaborator's authoritative owner_name and owner_email for author and committer. Genuine verified human authorship is preserved. A push separately requires the authorized provider principal, eligible shared project credentials, correct destination/ref and applicable signing. Display metadata and public fingerprints do not prove permission. Existing valid credentials and historical commits remain intact.

Creating automatic controls is an intermediate setup step. The AI continues available authorized work and reports readiness only after required checks pass. If it truly needs your input or a tool restart, it explains the exact action and preserves a continuation point; automatic resumption depends on the tool's actual capabilities. These are protocol requirements, not proof that every AI product implements them.


### One machine, independent runtimes

Each project installation file identifies a collaborator's machine through the complete public fingerprint of its common authentication credential. The filename and machine_id match. The readable fingerprint, owner name/email and human or agentic collaborator kind stay at machine level. Each nested runtime keeps its persistent UID, class and evidenced first-installation date. A second runtime joins the same machine file through a conditional update; it keeps its own checkpoint and approvals. A public credential identifies a key: copying it to another machine requires resolving the resulting ambiguous identity before writes.

```text
operations/
├── installations/
│   └── <machine_id>.json             one collaborator's machine
│       ├── machine_id               complete public credential identity
│       ├── authentication_identity  readable public fingerprint/reference
│       ├── owner_name, owner_email, collaborator_kind
│       └── runtimes[]               JSON contents, not directories
│           ├── installation_uid, runtime_id
│           └── first_installed_at, first_installation_evidence
└── tickets/
    └── <ticket>.json
        └── installation_uid         runtime that performed the mutation
.priv/                               local, protected and excluded from Git
├── common/
│   └── authentication/              shared credential files; never published
└── runtimes/
    └── <runtime_uid>/
        ├── checkpoint.json          this runtime's sole adoption checkpoint
        ├── oop-enforce-bridge.<ext>  ps1 for PowerShell; sh for a POSIX shell
        └── bridge-maintenance.json  confined local repair state
```

The layout is illustrative; verified existing private mappings remain valid. JSON branches show fields. Only public identity metadata reaches operations. Unknown historical installation dates remain explicitly unknown. Tickets retain their existing fields and history; future mutations identify the executing runtime UID, with instruction origin retained separately when different.

While bridge maintenance is active, the independent runtime control permits only its exact bridge and minimum local recovery bookkeeping. Commits, pushes, operations writes and unrelated edits remain blocked until actual administrative reconciliation and a conditional exit. Maintenance does not waive later-chat restrictions or native approvals. The bridge name is mandatory; its extension follows the selected documented host-native shell.

### Bridge installation safeguards

A compatible tool keeps its bridge in its own private installation scope, with the exact name `oop-enforce-bridge.<ext>` for its selected native shell. Before registering automatic controls it validates the exact configuration plan. A corrected plan must be validated again, which helps catch a wrong path, filename or shell before setup takes effect.

The consumer distribution includes conditional shell transport templates with explicit dependencies. They require adaptation to the tool's documented events and trusted observations; a template alone does not prove installed protection. A context receipt belongs to the session that loaded the rules. Existing installations reconcile through recoverable migration, preserving valid approvals and historical references. These safeguards aim to avoid setup rework; savings have not been measured.

### What changes after adopting OOP

A capable AI can recover durable project state, understand work already in progress, identify relevant scope and dependencies, and determine what it is allowed to do. It preserves material decisions and accountable work, distinguishes attempted actions from verified outcomes, and leaves a continuation point for a later session or another compatible AI without rebuilding the project from scratch.

### Context-independent governance

**The AI must not behave correctly only because it happens to remember the right rules from earlier in the chat.**

Under OOP, semantic judgment may depend on AI reasoning, but neither governance execution nor the availability and freshness of the normative context required for that judgment may depend on the AI remembering it.

Governance correctness must not depend on accidental conversation-context retention.

Conversation context is an execution cache, not a source of normative authority. Reopening an old chat, replacing a model or compacting context does not automatically preserve the right rules. The AI verifies current OOP and reloads only the missing or stale rules and facts it needs before continuing.

### What using OOP looks like

Where supported, a verified runtime can assemble small, up-to-date instructions for the current action from OOP and authoritative project state, while independently checking what effects the AI is actually permitted to perform. This reduces reliance on remembered chat context without pretending AI reasoning becomes deterministic. The runtime can reject unauthorized effects and verify outcomes through its real controls; unsupported paths and remaining semantic uncertainty must be disclosed. Unchanged verified rules and evidence are reused rather than rebuilt for every step.

**Less repeated work, without fewer safeguards.** When its AI tool supports the necessary controls, OOP can reuse rules and checks that are still valid instead of repeating them for every small action. The AI must still respect the authorization and safety checks for what it actually does. For example, preparing ten product descriptions can reuse the same approved constraints; publishing them requires the appropriate separate authorization. This can reduce wasted AI usage and rework, but actual savings depend on the tool and task.

You describe the outcome you want. A sufficiently capable, authorized AI checks the project and current rules, recovers relevant decisions and open work, performs and verifies the work, and preserves what another compatible AI needs to continue.

A reopened chat follows the same checks. The project's saved state carries continuity; remembering an earlier conversation does not establish that its rules are current.

### Governance follows the real effect

OOP does not apply the same process to every task. Asking a question should stay simple. Changing production infrastructure calls for stronger controls.

**Maximum rigor with minimum ceremony.** Governance follows effective scope, risk and material consequences. A domain change may also require DNS, TLS, OAuth, email and monitoring work. G0–G4 define minimum controls; a level never grants authority. Small authorized reversible remote branch writes may stay G1: network transport alone does not make them controlled publication. Release publication, deployments and critical operations need their applicable stronger gates. Load required governance before effects; splitting a risky operation into subtasks cannot remove its safeguards.

### Evidence

```text
desired ≠ approved ≠ attempted ≠ observed ≠ applied ≠ verified
```

For example, an AI running a deployment command does not prove that production is healthy. OOP keeps the attempted action, observed result and verified outcome distinct.

A successful command does not automatically prove the desired outcome. Evidence Compression reuses one durable authoritative object for the facts it actually proves. A PR can establish approval, CI and merge; production deployment still needs its own verification. Keep a minimal identified projection when portability, volatility, history or recovery requires it. Fresh material and verified claims need attributable observation time, checked identity, expected/actual result and a usable verification basis; lightweight work keeps lightweight references.

### Where truth lives

| Location | Contents and authority |
| --- | --- |
| `PROTOCOL.md` | Sole normative OOP authority, read in full by maintainers; AI tools using OOP read the derived distribution instead |
| README and examples | Non-normative explanations and illustrations |
| Derived artifacts | Distribution generated from canonical authority |
| Release evidence | Verified observations and provenance, never new semantics |
| Consumer `operations` | Canonical organizational knowledge, policies, decisions, accountable work state and history |
| Project consumer `.priv` | Private technical coordination for one project/workspace; authorized runtimes share only within that verified scope |
| Runtime-specific `.priv` | Tool-specific execution data and independent adoption checkpoints |

`operations` is the organization's documentary and operational brain: one logical canonical source of organizational knowledge and coordination across all relevant functions. It contains tool-independent knowledge and state, or canonical references to authoritative external sources of record; it does not require copying every business record into one repository. It supports analysis, decisions and authorized execution with verified outcomes. Runtime caches and chat history do not become competing knowledge authorities. Tool integrations, secrets and runtime configuration stay private. Free, open, local and portable solutions are preferred when adequate.

### Installation identity and ticket continuity

Each independent installation has its own persistent UID, even when two installations use the same AI product. The organizational directory contains only its UID, runtime class and accountable owner's name/email, plus schema identifiers. Technical installation status, approvals and adopted OOP revision stay in its private local checkpoint. A registered identity cannot prove that local controls still exist.

Ticket changes identify the installation whose received instructions caused them. Each modified ticket retains exact references to its previous states; a stale writer must reconcile current state before publishing. This helps another authorized tool explain who caused a change and recover the right history. Initial migration and history retention have a cost; no measured savings or installed interoperability is claimed.

Controls communicate with the official controller through one installation-owned native-shell bridge. Configuration uses official documentation for the actual runtime version and host, the narrowest sufficient scope and only necessary registrations. Existing valid approvals and unrelated settings are preserved.

### Project isolation and every-interaction governance

```text
Project A: operations + .priv + project-local OOP/runtime state
Project B: operations + .priv + project-local OOP/runtime state
Project-local private/runtime state never crosses the boundary.
```

Each consumer project/workspace has its own logical private root, canonical operations state and OOP checkout. Runtimes can share project-private resources only within the same verified workspace. A project-agnostic global sentinel discovers current-workspace governance without carrying project state; supported runtimes apply the lightweight current-OOP gate on every interaction, reusing valid same-day context. Old chats receive no exemption.

Durable Git-backed ticket openings and state transitions are signed, signature-verified, pushed immediately and read back from the canonical remote before they are reported as canonical success. Users are notified when a ticket opens, at each state transition and when publication is blocked.

As a human, you do not need to learn the full protocol before using it. Start with the CTA above and describe the outcome you want. OOP is designed primarily for the AI runtime to read and apply. Use the [practical examples](examples.md) to understand the workflow in concrete terms.

## For AI tools using OOP

### First-time Setup Notice

At the start of each full bootstrap, the AI explains the setup actions, what `.priv` and `operations` contain, how they are organized, what you can do after setup and which missing information or provider-side actions it may need from you. During every bootstrap action it briefly explains what it is doing and why, with a small practical example when useful. It asks only for information actually missing at that step, never private credential values.

The first time OOP is used with a new AI tool or environment, the AI may need to configure local automatic controls. Administrative installation and observed behavior are separate: [initial installation](#default-first-installation) completes from normal successful receipts, required native consent/restart and no real unresolved error. No later functionality certificate is required; project permissions and actual failures remain binding. This initial setup can require more work than normal project use. When those generic capabilities remain valid, later OOP projects in the same compatible environment should reuse them instead of rebuilding them. You normally do not need to understand or configure hooks, callbacks or validators; the AI should ask only when a genuinely human-only action is required. Incomplete setup alone is not a blocker: actionable work continues automatically.

For example, Project A can establish the generic configuration once. Project B reuses it while its dependencies remain valid, then establishes its own isolated binding, adoption and necessary project-specific evidence. Opening another project does not by itself repeat unchanged installation or hook tests. B never inherits A's operations, private state or authority. A second workspace alone does not repeat the first-time notice.

OOP is a research and development protocol/specification, provided **AS IS** under its license. Third-party AI runtimes and models are outside OOP's control: they can misinterpret instructions, stop prematurely, misclassify states or implement an integration incorrectly. Deterministic controls where available, evidence and verification reduce risk; they cannot eliminate all errors or guarantee third-party behavior, absolute protection, profit or savings.

**What happens after adoption:** A sufficiently capable AI identifies the current project/workspace, verifies current OOP, reconstructs relevant durable state and determines which rules apply. It prepares all distinct eligible controls, completes their administrative installation, records documented scope and limitations, performs and verifies authorized work, and leaves the project resumable by another compatible authorized AI. This is explanatory orientation, not a second bootstrap specification.

Use exact context-integrity evidence and the Semantic Routing Index; reroute at interaction, pre-effect, state changes, recovery and completion. Establish suitability before claiming full governance. Establish your own verified adoption and applicable context before governed work.

### Context and applicable controls

OOP prepares and freezes every distinct eligible native definition and the complete initial wrapper before the first enforcement approval. Each required native consent remains yours. Direct successful installation or valid reuse, required consent/restart and no unresolved real administrative error complete enforcement installation; a separate inspection API or functionality certification is not required. BOOT-13 separately verifies the version-2 machine and nested-runtime identity registration on canonical operations; technical status, adopted revision and administrative receipts remain local. The runtime presumes functioning within documented scope without claiming observed interception or model infallibility. Real project permissions, credentials, signing and effect-result checks remain mandatory. Wrapper logic stays frozen in the installation chat, including after restart or compaction; a concrete authorized safe improvement can proceed only in a different chat created after completion. Missing trustworthy chat metadata defers improvement alone. Existing unchanged approvals and receipts are reused; savings remain unmeasured.

OOP is a self-materializing governance protocol: it defines what must be true, while the active environment discovers capabilities, prepares and installs every distinct eligible control, retains direct administrative results and reconciles only affected real dependencies when OOP or the environment changes. Native deterministic, external deterministic, persistent semantic and transient semantic enforcement describe actual guarantees; residual gaps remain explicit. Actual access and authority still determine executable actions.

The compact **Semantic Routing Index** is derived metadata bound to the adopted OOP repository commit. Requests, planned and actual actions, state, risk, authority and recovery contribute a conservative union of facets; module selection and dependency closure then follow deterministically. A local edit that becomes a push loads repository rules before the push. If it becomes a deployment, execution and verification rules join before deployment. Completion repeats routing against what actually happened.

Full OOP Runtime Suitability describes supported scope and actual administrative installation. It is not a separate interception, semantic/path coverage or functionality certificate. After successful installation/reuse, required native consent/restart and no unresolved real administrative error, the runtime presumes functioning within documented scope. Unsupported capabilities and actual failures remain explicit; semantic fallback does not become deterministic protection.

### Entry, refresh and continuation

The first authorized successful bootstrap can establish a persistent non-secret workspace binding in the discovered shared private area. A supported runtime installs/verifies a minimal activation pointer to that binding and the current verified bootstrap. OOP is bound to the workspace, not to the lifespan of a chat; binding does not establish any runtime's adoption.

New chats, reopened old chats, recovery and runtime re-entry resolve the binding, reuse or obtain due freshness, establish their own verified adoption/context, reconcile relevant private and canonical facts, and show a compact localized alignment attestation before substantive work. Old conversation memory cannot prove current alignment. Future rules flow through verified adoption and realignment, rather than copied static instructions. The attestation distinguishes remote freshness, adoption/content identity, shared private state, owned runtime state, activation health, canonical operations, migration disposition and request route—even when no update exists.

Persistent project instructions, workspace memory and startup interception are possible integration capabilities. OOP requires no particular instruction file or event API. Unsupported entry paths require explicit limitations and usable recovery instructions; this specification does not claim every product automatically activates every historical chat.

```text
user request → AI bootstrap → discover organization/runtime/protocol/work
→ load relevant rules → work → persist state/evidence when needed
→ verify material outcomes → continue or hand off
```

Full first environment bootstrap covers private workspace protection, authentication, project and operations access, current OOP instructions, capabilities, materialization and a scoped PASS/FAIL attestation. Later refresh compares identities and repairs only changed components. Current canonical OOP prevails over conversation history; copied configurations are disposable derived state.

After cloning OOP, the consumer runtime reads its compact distribution instructions (`dist/entry.json` and only the modules the current step needs, never the full `PROTOCOL.md`) and starts bootstrap without verifying the OOP repository or testing its release. No signatures, checksums, file-to-commit comparisons, inventory audits, publisher checks or release tests are part of consumer bootstrap, adoption, refresh or recovery, even through optional policies. Maintainers perform repository/release verification separately. Consumer bootstrap checks its own applicable adoption, migration and installed controls; its success establishes readiness only for that scope.

Minimum Safe Bootstrap identifies enough trustworthy context to begin. Progressive Bootstrap expands that context when work needs additional rules, capabilities or authority. An analysis can finish with a useful response; a small reversible correction can use an inspected diff and existing Git evidence. Meaningful features account for dependencies; production or critical effects require stronger controls.

Continuity is proactive rather than reactive. When a runtime can reliably measure remaining usable active-session capacity, OOP preserves room to persist state and prepare continuation before the session becomes unusable. A reliable comparable remaining usable budget of **15% or less** triggers the Hard Continuity Reserve: stop new non-essential work, warn the user and prepare verified continuation. Without a reliable comparable metric, use explicit exhaustion signals without inventing percentages. The source packages work for an unknown future AI without raw secrets; the destination independently bootstraps, filters resources, resolves credentials and verifies the next permitted action before resuming.

### Organization and private topology

On first adoption, the AI discovers organizational facts before asking only material unresolved questions. An empty operations repository undergoes Foundational Organization Intake, with domain coverage recorded as verified, partial, unknown or deferred and supported by canonical references rather than an invented percentage. Identity, mission, roles, processes, assets and operational status are modeled when relevant.

Each project keeps separate operations, private state and identity even on the same computer/account. Same-project runtimes can share purpose-named credentials and topology references; adapters and adoption remain runtime-owned. Legacy vendor-named shared resources are classified and preserved without blind renaming. Product/source repositories, operations and OOP are distinct references; if `.priv` holds no source reference, the AI asks you once for its address (or "none"), without guessing it, and saves your answer in `.priv` so no AI tool asks again.

### Repository bootstrap

The official full install requires operations readiness. For other work, when durable repository persistence or integration becomes necessary, resolve provider/instance and namespace, then discover the intended canonical repository. Distinguish `found`, `confirmed_absent`, `inaccessible` and `unknown`: failed discovery is not absence. Reuse existing operations; request private creation settings only when creation is required, absence is confirmed and authority exists. Private visibility is not checked or used as a bootstrap readiness criterion. Verify identity, control, canonical local/remote binding and both read and write capability through the active runtime's previously selected/prepared project credentials. If manual creation or credential attachment is needed, make one consolidated request with the exact provider/account/repository target, safe public enrollment material from `.priv/common` and minimal read/write permissions; recheck access after the user's action. Anonymous reading or another actor's access cannot prove this credential's readiness. A missing checkout never justifies another remote repository. The contract supports APIs, connectors, CLIs and equivalents without a mandatory host or transport.

### Repository access and credentials

Use an identity explicitly authorized for this project, destination and operation. New AI-created commits use the machine collaborator's authoritative owner_name and owner_email for author and committer. Genuine verified human authorship is preserved. A push separately requires the authorized provider principal, eligible shared project credentials, correct destination/ref and applicable signing. Display metadata and public fingerprints do not prove permission. Existing valid credentials and historical commits remain intact. Inspect effective metadata before creation and the actual commit object before publication. A mismatch blocks publication; no global Git changes or historical rewrite are implied.

Discover and reuse the authorized canonical private credential source before acquisition. A new runtime, vendor-named key or unconfigured adapter does not justify credential duplication or rotation. The authorized authentication/signing files used for `operations` live in the project's `.priv/common` folder, so every AI tool of the project uses the same ones. A key kept only somewhere else, such as a system keychain, is not used for `operations`: the AI creates a new project-authorized key in `.priv/common` instead and never copies, exports or moves the old one. Configure the active adapter and verify its own required access. Authentication, read, write, commit signing and tag signing remain separate facts and purposes. Optional credential-reference and repository-access profiles contain non-secret metadata and secure references, never raw secrets.

### Continuity across AI tools

`prepared ≠ delivered ≠ accepted ≠ resumed`. A ready package proves preparation; observed destination acknowledgment and verified first action prove later facts.

```text
AI A starts → state and evidence persist → AI B resumes → AI C can verify
```

A formal handoff preserves effective scope, decisions, governance, authorization, blockers and the next permitted action. Preparation, delivery, destination validation, acceptance and verified resumption remain distinct; a generated package proves no destination action. Recovery inspects actual effects before retrying and keeps previous verified checkpoints separate from partial or uncertain work.

### Repository-dependent handoff

Use the same optional repository-access profile or equivalent authoritative references to preserve canonical identity/endpoint, required capabilities/permissions and credential purposes. Shared-root destinations reuse secrets by reference; separate roots/machines use path remapping and a separate authorized secure transfer only when necessary. Normal handoff/recovery excludes raw keys, tokens, passwords, cookies and decryption secrets.

The destination verifies its own binding, required access and signing. Reconcile remote/credential mismatches before writes. Historical/lightweight strings remain readable; new material `destination_validated`, `accepted` or `resumed` continuation needs verified structured access or an authoritative structured pointer with resolved facts and attributable destination resolution checks. Schema validity cannot prove those facts.

### Independent runtime adoption

`available ≠ downloaded ≠ compatible ≠ target ≠ applied ≠ verified`. A downloaded release is not active; a selected target grants no execution authority.

Within each workspace, each persistent consumer integration owns exactly one authoritative current adoption checkpoint across all its chats, sessions, restarts and model changes. Each session independently checks its context and request authority. A new chat reuses valid adoption rather than repeating installation. Genuinely separate integrations retain independent boundaries. Each runtime distinguishes available, downloaded, compatible, target, applied and verified versions. A shared checkout, shared credentials or another runtime's adoption does not establish that runtime's own adoption. Only successful applicable verification advances the checkpoint; failed attempts preserve prior verified knowledge and record actual partial effects separately.

### Organizational migration

Canonical organizational migration is separate from runtime adoption. Records belong in operations or its authoritative source of record; no global organizational version counter is required. Evaluate scoped read and write compatibility independently before version-sensitive access. A runtime may safely analyze while writes wait. Joining runtimes verify already-applied organizational effects and complete remaining local actions without blind replay. Partial failure blocks unsafe scope/dependencies while independent safe work continues. Preserve or grandfather historical facts under explicit policy; recovery and concurrent non-idempotent effects require their applicable authority and verification.

### Shared private coordination

Discover existing private layouts and shared references. Shared records are append-oriented, normally immutable, with explicit supersession and conflict-safe metadata/CAS updates. Preserve concurrent conflicts and active referenced chains; atomic rename alone does not prevent lost updates. Check scope, provenance and freshness. Hints cannot replace operations, explicit user instructions, approval or verified facts. Personal preferences remain in authorized global instructions outside repositories.

### Daily freshness

At the first user prompt of each day, use the user's timezone and shared same-day success/failure evidence to check configured OOP freshness with bounded synchronization. Preserve local work and failures; stop on quota/access/conflict instead of retrying. No scheduler or background polling is required. Re-enter bootstrap and selectively realign owned instructions, caches and loaded rules against the runtime's verified identity; synchronization alone is not adoption.

Each AI tool records the full Git commit hash available for its configured OOP revision. Remote/local version comparison tracks updates and synchronization without auditing repository content or certifying the release. Each tool separately records its verified consumer adoption; that checkpoint proves neither repository integrity nor release quality. Offline remote freshness remains unknown. No distribution manifest is needed.

### Default first installation

The instruction at the top starts setup for your current project: the AI prepares private local state, identifies the project, reuses authorized access, connects or legitimately creates `operations`, and configures the controls its environment supports. Most of the work needs no help from you. The AI may need these two project-related answers during first installation; any separately required native enforcement consents are presented together in the prepared initial package:

1. **Your project's address**, once, if `.priv` does not already know it. For example: "What is the address of this project's source repository? Answer 'none' if there is no separate one." Your answer is saved, so no AI tool asks again.
2. **One combined request about `operations`**, only if the AI cannot do it alone. For example: "Create the private repository `operations` in your account and add these public keys with write permission: authentication key `ssh-ed25519 AAAA… machine-owner` (fingerprint `SHA256:…`), plus the signing key when your provider needs it." The AI shows only public keys, never private keys or passwords, and gives the steps for your actual provider.

After you act, the AI checks the real result itself, because your confirmation alone is not proof, and then resumes. A necessary restart of the AI tool is explained separately if it is ever needed.

**Configure once, reuse what remains valid.** Before the first enforcement consent, the AI prepares every distinct eligible native definition and the complete initial wrapper. It installs or reuses them within actual authority, retains their direct administrative acknowledgments and resolves required native consent/restart. No second inspection API or functional trial is required. Unchanged approvals stay valid; real errors remain pending.

**A one-pass example:** an environment exposes session, interaction, pre/post-effect, completion and recovery controls. The AI prepares every eligible definition together, respects each required native consent and completes enforcement from normal successful receipts. If canonical publication is still pending, it preserves that completed enforcement status and resumes publication alone. This illustrates the contract, not actual vendor behavior.



### Shared enforcement controller

Installation and prevention describe different facts. Completed setup remains valid without artificial hook tests. A claim that an effect is independently prevented also needs a sufficient protected boundary: the AI must not be able to evade the control through another reachable tool, nested call or credential. Unsupported routes and real failures remain visible. For example, guarding one website publisher does not protect a second unmediated publisher. These are requirements and evidence limits, not proof of a live integration.

OOP generates a cross-platform [enforcer for AI runtimes](dist/oop-enforce.js). It reuses reviewed routing, bootstrap guards and evidence checks, while preserving complete applicable rules and unresolved semantic judgments. A runtime-owned thin adapter reuses or obtains the script, maps the reviewed activation vocabulary to actual available capabilities, and connects compatible functions through a shared dispatcher. It must turn deny, unknown and error into prevention of dependent effects; the reference planner and dispatcher do not themselves install provider hooks or prove native coverage.

Start with the [controller and adapter guide](tools/enforcement.md). Version/adoption still use the full OOP Git commit, with one active controller and at most one temporary candidate.

## For AI tools maintaining this repository

Consumer machine-owner attribution applies to runtimes under adopted OOP governance. OOP repository maintainers use an independently authorized identity appropriate to their actual maintainer role, with repository signing, access and publication checks.

[PROTOCOL.md](PROTOCOL.md) is the **Canonical Normative Prompt** and single source of organizational norms. Read it completely before normative changes, including tables, examples, exceptions and unnumbered material.

Before resolving problems, proposing additions, changing the source or generating the distribution, follow the appendix's mandatory alignment assessment against the current Abstract, Vision and Goal. Preserve the research purpose and keep this README's commercial explanations consistent with it; potential savings, faster delivery and business opportunities remain hypotheses until evaluated. The overview provides purpose, while the applicable rules establish operational requirements and authority.

Normative edits start in the source. Derive Core and on-demand modules from complete semantic analysis, with no fixed parser, heading-to-module table or required programming runtime. Reassess module/schema sets, dependencies, routing, bidirectional traceability, migration, validation and permanent regression coverage.

Canonical REL-01–REL-11 require an AI-first distribution: typed JSON contracts, a non-empty entry, compact semantic routing and dependency closure, explicit lifecycle transitions, selective context/reuse, applicable local controls and measured maintainer acceptance. Human-oriented release readability must not increase consumer cost or latency; required user explanations and organizational history remain. Performance improvements are measurements, not assumptions about serialization. Consumer bootstrap never validates the OOP repository or executes release tests.

The structured distribution starts at `dist/entry.json`. It provides a small routing index, explicitly referenced JSON modules, complete source-qualified semantic clauses, guards for the listed bootstrap steps (removed step IDs such as BOOT-02 and BOOT-09 are never reused) and lifecycle/interface contracts. Producer evidence under [build tools](tools/README.md) records exact source reconstruction/coverage, the applicable structured schema profile, artifact references, dependency closure/routing, particular guard/transition invariants exercised by existing tests and measured selected-context bytes. These deterministic producer checks do not establish complete formal semantic correctness, independently authenticated authority/evidence, installed runtime enforcement, remote-provider outcomes, cross-runtime interoperability, end-to-end cost savings, publication authenticity or consumer adoption; each consumer establishes its own scoped readiness. Node, CEL and MCP are not consumer-wide prerequisites. Isolated single-contract fixtures remain explicitly non-installable reference examples.

Reuse valid freshness evidence during bounded upstream synchronization; preserve local work. Apply English file/document authoring unless explicitly requested otherwise, and reply in the receiving runtime's effective language preference unless explicitly instructed otherwise, checking applicable shared private evidence and authorized settings under established precedence, preserving exceptional code and quotations. This README provides orientation; the canonical source defines the protocol.

### Maintainer commands

The [repository maintainer appendix in PROTOCOL.md](PROTOCOL.md#rules-for-the-maintainer) contains the complete technical audit instructions and commands available to the repository maintainer:

- [Technical audit](PROTOCOL.md#rules-for-the-maintainer): read-only repository audit and consolidated corrective recommendations, to be executed after reading this file if you have been instructed to act as maintainer of this repository.
- [DIAGNOSE](PROTOCOL.md#diagnose): analyze requests or problems and propose changes.
- [FORMALIZE](PROTOCOL.md#formalize): return a complete English implementation prompt with the decision dossier and one canonical commit message, without a download or required final message display.
- [PREPARE](PROTOCOL.md#prepare): invoke FORMALIZE first, append only the executor's final message-display instruction, and save the resulting downloadable Markdown. PREPARE itself makes no implementation or Git changes and never previews the message.
- [VERIFY](PROTOCOL.md#verify): check implementation and current regressions, accounting for independently requested surrounding commits and explaining actual normative source changes with two before/after examples when present.
- [APPLY](PROTOCOL.md#apply): invoke FORMALIZE first and execute its prompt unchanged without saving it, then commit and push the selected authorized changes. With direct filesystem access, use the current HEAD branch; with API-only access, create a new dedicated branch. After successful publication and exact remote readback, run VERIFY on that actual branch/commit. No external publication lock or prior VERIFY is required. Failed publication preserves actual work and is reported without automatically invoking the post-publication VERIFY. Signing, scoped checks and separate authority for force pushes or administration remain required. No terminal message display is required.
- [REPORT](PROTOCOL.md#report): consolidate supported findings using the mandatory complete reporting contract.

Invoke `DIAGNOSE`, `FORMALIZE`, `PREPARE`, `VERIFY`, `APPLY` or `REPORT` with the relevant input from your chat. The first five commands run only when invoked. FORMALIZE returns instructions, with REPORT data inside the English prompt and localized process reporting before its return; this is not completed implementation. Completed PREPARE, VERIFY, APPLY, DIAGNOSE and ordinary maintainer audits apply localized REPORT. Direct REPORT consolidates existing findings without starting an audit. The maintainer appendix remains separate from organizational runtime requirements and consumer lifecycle.

Build scripts, tests, schemas and producer evidence live in [tools](tools/README.md). Maintainer commands follow the [repository maintenance guidance](#for-ai-tools-maintaining-this-repository) and the canonical requirements in [PROTOCOL.md](PROTOCOL.md).

### Publishing an OOP revision

Producer artifacts use reviewed source-content identities without embedding their own future commit SHA. Maintainer acceptance checks the actual current committed source and exhaustive inputs independently of parents, an initial root or old Git objects. Comparative regression evidence is separate and needs an independently trusted comparable content checkpoint; unavailable evidence is NOT VERIFIED. A precommit candidate is not committed release readiness. Publication requires its own authority and remote readback; producer checks never replace consumer adoption or organizational migration.

OOP revisions are identified by their full Git commit IDs. Review and validate changes before publishing them to the configured repository. Assess compatibility and any migrations required for runtime adoption.

### Formats and license

Uppercase normative keywords follow canonical BCP 14 conventions. Licensed under [Apache-2.0](LICENSE), copyright 2026 Marco Vasapollo; see [NOTICE](NOTICE). The license covers the specification, documentation, schemas, machine-readable artifacts and examples.


### Reusing runtime integrations

Reuse equivalent eligible registrations, direct installation receipts and unchanged native approvals. Reconcile only changed real dependencies; project adoption and authority remain independent.
