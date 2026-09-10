// The full checker-status vocabulary — the single source every consumer
// checks a status against. check-rules.mjs's own rows only ever carry
// "unbound", "unreadable-config", "unavailable", "pass", or "fail" (an
// adapter's resolve()/run() result, copied through verbatim) or "error"
// (checkRule() itself, on a missing adapter or a thrown error). "not-run" is
// packet-only: runtime/drift/packet.mjs's checkerFor() synthesizes it when
// check-rules never ran at all, or ran but reported no row for a given rule.
// It is listed here anyway, rather than left an undocumented seventh value,
// so check-rules.mjs's gates and shared/observing-drift.md's judgement list
// can both be generated from this one array — see test/status-vocabulary.test.mjs,
// which asserts no adapter, check-rules.mjs, or the drift packet ever emits
// a status literal absent from this list.
export const CHECK_STATUSES = Object.freeze([
  "pass",
  "fail",
  "unbound",
  "unreadable-config",
  "unavailable",
  "error",
  "not-run",
]);

const adapters = new Map();

export function registerAdapter(adapter) {
  for (const field of ["tool", "configCandidates", "resolve"]) {
    if (adapter[field] === undefined) {
      throw new Error(`checker adapter is missing '${field}'`);
    }
  }
  if (adapters.has(adapter.tool)) {
    throw new Error(`checker adapter for '${adapter.tool}' is already registered`);
  }
  adapters.set(adapter.tool, adapter);
  return adapter;
}

export function getAdapter(tool) {
  return adapters.get(tool) ?? null;
}

export function registeredTools() {
  return [...adapters.keys()].sort();
}

// Every tool KNOWN_TOOLS names must have a working adapter, and every
// registered adapter must be a tool the schema actually allows binding to.
// Neither list may run ahead of the other (design spec Q2.2: "a tool enters
// KNOWN_TOOLS only when it has a working adapter").
export function assertRegistryAgreesWithKnownTools(knownTools) {
  const known = [...knownTools].sort();
  const registered = registeredTools();
  const missing = known.filter((tool) => !registered.includes(tool));
  const extra = registered.filter((tool) => !known.includes(tool));
  if (missing.length > 0) {
    throw new Error(`KNOWN_TOOLS names a tool with no checker adapter: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    throw new Error(`a checker adapter is registered for a tool KNOWN_TOOLS does not know: ${extra.join(", ")}`);
  }
}
