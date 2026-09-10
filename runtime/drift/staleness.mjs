// Is the committed constitution current with the decision files?
//
// Read-only, and deliberately so: this is reached from the Stop hook, and a
// hook that rewrote a tracked file in the user's repository without being asked
// would be a surprise the loop's own discipline forbids. It reports; the user
// runs /arch-constitution.
//
// Every failure answers "not stale". A missing decisions directory, an
// unparseable decision, an unreadable file — none of them is evidence that the
// constitution drifted, and a Stop-hook notice is the wrong place to learn about
// any of them. `arch constitution --check` is the lane that reports them loudly.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function constitutionIsStale(root) {
  try {
    const { discoverDirectory } = await import("../baseline/build-constitution.mjs");
    const { loadDecisions } = await import("../baseline/decisions.mjs");
    const { renderConstitution } = await import("../baseline/constitution.mjs");

    const directory = await discoverDirectory(root);
    const { decisions, errors } = await loadDecisions(directory);
    if (errors.length > 0) return false;

    const current = await readFile(join(dirname(directory), "constitution.md"), "utf8");
    return current !== renderConstitution(decisions);
  } catch {
    return false;
  }
}
