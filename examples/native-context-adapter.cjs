'use strict';
// Producer illustration of owned configuration merging, not a native schema.
// The host's official actual-version contract determines the real field names,
// invocation expression/vector, overrides, response channel and consent/restart.
// Active definitions always resolve to the official controller with root-first stable arguments.
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

module.exports = function contextBindings(interpreter,controller,registration,adapter=path.join(path.dirname(registration),'oop-runtime-adapter.js')) {
  for (const locator of [interpreter,controller,registration,adapter]) {
    if (typeof locator !== 'string' || !path.isAbsolute(locator) ||
        locator.includes('\0') || locator.includes('${')) throw Error('Unsupported launcher path');
  }
  if(adapter!==path.join(path.dirname(registration),'oop-runtime-adapter.js'))throw Error('Noncanonical active adapter');
  function mapping(command) {
    return [{"hooks":[{type:'command',command:interpreter,args:[controller,path.dirname(registration),'enforcement'],
      onFailure:'continue',timeout:90}]}];
  }
  return {"hooks":{SessionStart:mapping('native-session-open'),UserPromptSubmit:mapping('native-prompt')}};
};

// Prepare a candidate from the current settings and actual owned definitions.
// Apply it only if the observed settings revision still matches.
module.exports.reconcile = function reconcile(current, proposed, owned) {
  if (!current || typeof current !== 'object' || Array.isArray(current) || !Array.isArray(owned)) throw Error('Invalid configuration');
  const result = structuredClone(current);
  const definitions = result["hooks"] ?? {};
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) throw Error('Invalid event definitions');
  for (const {event,definition} of owned) {
    const existing = Object.hasOwn(definitions,event) ? definitions[event] : [];
    if (!Array.isArray(existing)) throw Error('Invalid event definitions');
    const matches = existing.filter(item=>isDeepStrictEqual(item,definition));
    if (matches.length !== 1) throw Error('Owned definition changed or is ambiguous');
    const remaining = existing.filter(item=>!isDeepStrictEqual(item,definition));
    if (remaining.length) definitions[event] = remaining;
    else delete definitions[event];
  }
  for (const [event,entries] of Object.entries(proposed["hooks"])) {
    const existing = Object.hasOwn(definitions,event) ? definitions[event] : [];
    if (!['SessionStart','UserPromptSubmit'].includes(event) || !Array.isArray(existing) || !Array.isArray(entries) ||
        entries.some(entry=>!Array.isArray(entry["hooks"]) || !entry["hooks"].length ||
          entry["hooks"].some(binding=>binding.type!=='command' || binding.onFailure!=='continue' ||
            !Array.isArray(binding.args) || binding.args[2] !== 'enforcement' || path.basename(binding.args[0])!=='oop-enforce.js'))) throw Error('Ineligible context definition');
    definitions[event] = [...existing,...entries.filter(entry=>!existing.some(item=>isDeepStrictEqual(item,entry)))];
  }
  result["hooks"] = definitions;
  return result;
};
