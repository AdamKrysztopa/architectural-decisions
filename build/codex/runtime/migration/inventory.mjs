import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { matchGlob } from "./glob.mjs";

const SKIPPED = new Set(["node_modules", ".git"]);

async function walk(root, prefix = "") {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIPPED.has(entry.name)) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(root, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

// The one piece of reverse discovery's mechanical evidence: how many files
// under `scopeGlob` contain `pattern`, and — just as important — which ones
// don't. This returns a count, never a rule; the caller decides whether the
// regularity (and its exceptions) is worth a narrative decision.
export async function countPatternOccurrences(root, scopeGlob, pattern) {
  const files = (await walk(root)).filter((file) => matchGlob(scopeGlob, file));
  // A caller-supplied /g or /y RegExp carries state (lastIndex) across calls to
  // .test(); reused as-is across this loop it would silently skip roughly half
  // the matching files. Strip those flags so every file is tested fresh.
  const regex = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")) : null;
  const matches = [];
  const exceptions = [];
  for (const file of files) {
    const text = await readFile(join(root, file), "utf8");
    const hit = typeof pattern === "string" ? text.includes(pattern) : regex.test(text);
    (hit ? matches : exceptions).push(file);
  }
  return { total: files.length, matches, exceptions };
}
