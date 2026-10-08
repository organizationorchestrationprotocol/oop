'use strict';
// Source identity @@SOURCE_IDENTITY@@.
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
// S6 Implement/review BOTH regions and every initially knowable applicable event.
//    Record exact inputs and actual responsibilities, limitations and blockers.
// S7 Freeze the complete root package, then configure all eligible native events
//    to call <controller> <runtime_root> enforcement. Obtain actual administrative
//    results, native consent and any required restart. Preserve unrelated controls.
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
    // supported_commands[oopCommand][nativeEventOrGroup]={stdout,stderr,exit_code}.
    // Cover session_open and prompt and all actual supported native variants.
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
    // Every response MUST forward the COMPLETE additionalContext exactly once,
    // using a required placeholder through the documented context channel. Apply
    // actual host-standard escaping, never hand-built interpolation of user text.
    // Context and a continuation status grant no effect permission or proof of
    // actual delivery. Record unavailable capabilities and retain host authority.
    {"OOP_ADAPTER_NOT_IMPLEMENTED":true}
    // OOP-EDIT-END manifest
  ,
  decodeEvent(raw, context) {
    // OOP-EDIT-BEGIN decodeEvent
    // Pure bounded native JSON + verified {command,registration} ->
    // {native_event:string,event:{event:'session_open'|'prompt',chat:string,cwd?}}.
    // native_event identifies ONE actual native event, never a grouped | key.
    // Preserve actual chat identity and observed cwd. Return only normalized
    // event fields, never raw prompt/transcript/secrets. Cover every documented
    // native variant; reject ambiguous/unknown input rather than guessing events.
    // Registration owns project/source/installation/paths; native payloads cannot
    // replace them. An identity transform requires a documented conforming input.
    // Throw on unsupported input; the controller retains safe scoped diagnostics.
    // No selected event means no guessed event-specific response or fallback.
    // Direct record/snapshot/errors-read/errors-ack commands use normalized JSON
    // and do not call decodeEvent; both root components still load and validate.
    throw Error('OOP_ADAPTER_NOT_IMPLEMENTED');
    // OOP-EDIT-END decodeEvent
  }
});
