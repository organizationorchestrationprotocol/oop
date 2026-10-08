'use strict';
// Source identity sha256:2f4d8508708b4a8a335edf999fc5f680f9e65322b866ec684b1e304abaf16d2d.
// Knowledge format 1 is controller-owned. Forward the complete response instruction
// unchanged; resolve source-bound mandatory procedures through the verified shared
// view. Do not copy knowledge rules or interpret ticket/evidence records here.
// Runtime-owned adapter: pure native translation and static manifest, no launcher.
// ACTIVE LOCATION: <runtime_root>/oop-runtime-adapter.js, an immediate root child.
// <runtime_root>/oop-context-registration.json is the other mandatory component.
// The documented native mechanism invokes the adopted controller directly with
// <runtime_root> enforcement; the controller owns loading, context and rendering.
// This producer implementation uses its declared module facility; OOP mandates
// capabilities, never a particular vendor, host product, shell or operating system.
// S1 Copy this template INERT into the UID-owned installation root; preserve the
//    last safe active package. Initial boot permits an inert root copy only when
//    no active adapter exists; for an active installation prepare a complete owned
//    staged replacement before touching root files. Never activate incomplete code.
// S2 Read COMPLETE applicable distributed modules and dependency closure.
// S3 Read the ENTIRE actual adopted oop-enforce.js, including every comment.
// S4 Read EVERY comment in this copied template, including both editable regions.
// S5 Read OFFICIAL current-version native enforcement and host OS documentation.
//    Establish context-capable native events, scopes, precedence, required base
//    options and applicable OS-specific mandatory/optional overrides. Distinguish
//    command expressions from executable/argument vectors; follow the exact OS
//    syntax and each launcher layer's quoting, path, space and escaping rules.
//    Review each context channel's limits, units, overflow behavior, visible
//    portion and authorized retrieval for the effective version and host.
// S6 Implement/review BOTH regions and every initially knowable applicable event.
//    Record exact inputs and actual responsibilities, limitations and blockers.
// S7 Freeze the complete root package, then configure each eligible native event
//    by role to call <controller> <runtime_root> enforcement: session opening and
//    user prompt as session_open/prompt, operation entry/completion as
//    operation_entry/operation_completion, and a documented turn end as turn_stop. Never
//    map stop, interrupt, notification or asynchronous completion events to prompt.
//    Obtain actual administrative results, native consent and any required restart.
//    Preserve unrelated controls.
// Keep INSTALL-13/14 logic freeze, ownership, conditional updates and recovery.
// No synthetic consumer trials, fabricated event coverage or comprehension proof.
// Edit ONLY delimited regions; retain fixed scaffold and exactly these exports.
// No imports, state access, subprocesses, credentials, controller calls or effects
// in the adapter. The controller loads it in a bounded separate process; this
// isolates accidental failures, not hostile code. Native payloads are untrusted.
module.exports = Object.freeze({
  manifest:
    // OOP-EDIT-BEGIN manifest
    // Supply one strict JSON object, no expressions, executable getters or comments
    // within the JSON. schema_version:1, host and runtime_version are nonempty.
    // documentation:[{source,section}] cites actual official runtime/OS contracts.
    // invocation_basis and continuation_basis explain documented launcher/output.
    // nonblocking_exit_codes lists documented native continuation statuses 0..255.
    // supported_commands[oopCommand][nativeEventOrGroup] declares stdout, stderr,
    // exit_code and context_delivery. Every delivery has mode and basis; cite
    // its applicable official source/section and material behavior in basis.
    // complete: supported payloads arrive in full. preview: also declare a
    // nonempty preamble and a conservative visible_prefix_bytes bound for the
    // decoded context, accounting for native units and any framing. The bound
    // includes the line break. Put the required string context placeholder at
    // the beginning of the native context field. The controller prepends the
    // preamble and line break before encoding. Require reading the entire
    // current host-referenced context before substantive responses or dependent
    // effects, with existing permissions. Require reporting incomplete recovery
    // and continuing only independent authorized work.
    // separate: explain the documented visible instruction channel in basis
    // and supply the same recovery instruction through that channel.
    // unavailable: record the precise limitation when neither path is supported.
    // Review placement and effective visibility; validation checks declarations,
    // not the host contract, receipt, permission or actual retrieval.
    // Cover session_open and prompt and all actual supported native variants.
    // Optional operation_entry/operation_completion preserve operation semantics;
    // never translate them to session opening or user input. Acquisition remains
    // reachable and equivalent dependencies do not renew a prerequisite.
    // Optional turn_stop entries declare context_delivery mode none, no
    // placeholder and a documented nonblocking exit_code: a turn end receives
    // no context, continuation signal or veto (UX-09). Mode none is turn_stop only.
    // Split | as LITERAL alternatives, never regex. Events must be nonempty,
    // unique within their command and without surrounding whitespace.
    // stdout/stderr are literal text templates, retained byte-for-byte; include
    // required newlines explicitly. exit_code must be documented nonblocking.
    // placeholders[name]={source,type,required,encoding,absent?}; names are bounded
    // identifiers. Sources: additionalContext, response or safe dotted children.
    // Prototype paths are forbidden. Types: string, number, boolean, json.
    // Encodings: text for strings, json for a whole JSON value, json-string for
    // escaped string CONTENTS. Do not quote a whole-json placeholder. Optional
    // fields MUST provide explicit absent text; absent differs from null/false.
    // {{name}} substitutes ONCE. {{{{ and }}}} escape literal delimiters.
    // Substituted values are never reparsed as templates. Required absent or
    // mistyped values fail explicitly. Do not map/truncate/filter corrective text.
    // Every session_open/prompt response MUST forward COMPLETE additionalContext once,
    // using a required placeholder through the documented context channel. For
    // native events it is only the controller-generated instruction to read the
    // immutable response and identified definitions; never replace or summarize it.
    // Preserve bounded acquisition and independent host controls. Apply
    // actual host-standard escaping, never hand-built interpolation of user text.
    // Context and a continuation status grant no effect permission or proof of
    // actual delivery. Record unavailable capabilities and retain host authority.
    {"OOP_ADAPTER_NOT_IMPLEMENTED":true}
    // OOP-EDIT-END manifest
  ,
  decodeEvent(raw, context) {
    // OOP-EDIT-BEGIN decodeEvent
    // Pure bounded native JSON + verified {command,registration} ->
    // {native_event:string,event:{event:'session_open'|'prompt'|'operation_entry'|'operation_completion',chat:string,cwd?}}
    // or {native_event,event:{event:'turn_stop',chat,origin,cwd?}} for a turn end.
    // origin is user for a user stop or interrupt, model only where official
    // documentation proves a model-originated end, otherwise unknown.
    // native_event identifies ONE actual native event, never a grouped | key.
    // Preserve actual chat identity and observed cwd. Return only normalized
    // event fields, never raw prompt/transcript/secrets. Cover every documented
    // native variant; reject ambiguous/unknown input rather than guessing events.
    // Registration owns project/source/installation/paths; native payloads cannot
    // replace them. An identity transform requires a documented conforming input.
    // Throw on unsupported input; the controller records safe scoped diagnostics
    // in the session store, emits no context (empty output, exit 0) and discloses
    // them at the next delivered response. No selected event means no guessed
    // event-specific response or fallback.
    // Direct record/snapshot/acquire commands use normalized JSON and do not call
    // decodeEvent; both root components still load and validate.
    throw Error('OOP_ADAPTER_NOT_IMPLEMENTED');
    // OOP-EDIT-END decodeEvent
  }
});
