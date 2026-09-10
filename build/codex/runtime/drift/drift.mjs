#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRecord } from "../baseline/record.mjs";
import { findConflicts, loadSources } from "../baseline/sources.mjs";
import { buildPacket } from "./packet.mjs";
import {
  clearNotifiedCount,
  countDrainingObservations,
  countObservations,
  discardQueue,
  drainQueue,
  queuePath,
  releaseDrained,
  resolveRoot,
} from "./queue.mjs";

const USAGE =
  "Usage: drift.mjs <status|drain|discard> [--root <path>] [--dir <path>] [--base <ref>] [--json]";

function parseArgs(argv) {
  const options = { command: argv[0] ?? "", root: null, dir: null, base: null, json: false };
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--json") options.json = true;
    else if (flag === "--root" || flag === "--dir" || flag === "--base") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${flag} needs a value. ${USAGE}`);
      options[flag.slice(2)] = value;
      index += 1;
    } else throw new Error(`Unknown argument '${flag}'. ${USAGE}`);
  }
  if (!["status", "drain", "discard"].includes(options.command)) throw new Error(USAGE);
  return options;
}

// git is optional. Where it is absent, or the root is not a repository, the drain
// runs on the queue alone and says base: null -- never that nothing drifted.
// GIT_CEILING_DIRECTORIES stops discovery from walking up past `root` into an
// ambient repository that merely happens to contain it (a fixture directory
// nested in this very repo's checkout, or a subproject with no .git of its
// own): without it, root's parent repo would be mistaken for root's own.
// -c core.quotePath=false disables git's default of C-quoting (backslash-octal
// escaping, wrapped in double quotes) any path byte outside printable ASCII.
// Left at its default, a file like "src/café.py" arrives as the literal
// string "src/caf\303\251.py", which then matches no rule's scope and is
// mis-reported as an unscoped change instead of the real path.
function git(root, args) {
  const result = spawnSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(root) },
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

// A trailing "\r" survives on a repository with core.autocrlf-style line
// endings in its git output; nothing else about a line is stripped, so a
// path with meaningful leading or trailing spaces still matches its own name.
function stripCarriageReturn(line) {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function defaultBase(root) {
  const head = git(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const branches = head ? [head.trim()] : [];
  branches.push("origin/main", "main", "origin/master", "master");
  for (const branch of branches) {
    const merged = git(root, ["merge-base", "HEAD", branch]);
    if (merged) return merged.trim();
  }
  return null;
}

function gitPaths(root, base) {
  const paths = new Set();
  if (base) {
    for (const raw of (git(root, ["diff", "--name-only", `${base}...HEAD`]) ?? "").split("\n")) {
      const line = stripCarriageReturn(raw);
      if (line) paths.add(line);
    }
  }
  // --porcelain also lists untracked files, which `git diff` never shows.
  for (const raw of (git(root, ["status", "--porcelain"]) ?? "").split("\n")) {
    if (raw.length === 0) continue;
    const rest = stripCarriageReturn(raw.slice(3));
    if (!rest) continue;
    paths.add(rest.includes(" -> ") ? rest.split(" -> ")[1] : rest);
  }
  return paths;
}

// SP2 owns every deterministic verdict. This copies its rows and never
// re-implements, second-guesses, or substitutes for any of them. --run is
// passed so a bound, resolvable contract is actually evaluated: without it,
// check-rules never gets past "unavailable" (resolve() short-circuits before
// run()), and checker.status could never be "fail" or "pass" -- the two
// statuses the Violation class, and a clean bill of health, depend on.
function checkerRows(root, directory) {
  const script = fileURLToPath(new URL("../checkers/check-rules.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--dir", directory, "--run", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error || typeof result.stdout !== "string") return null;
  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : (parsed.rows ?? parsed.rules ?? null);
  } catch {
    return null;
  }
}

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv);
  // Falling back to bare `cwd` here (rather than the same CLAUDE_PROJECT_DIR-
  // aware resolution observe.mjs, notify.mjs, and inject-rules.mjs all use)
  // would let this CLI resolve a different root than the hooks did in a
  // worktree -- queuing to the parent project root while status/drain looked
  // at the worktree, forever "observed: 0" for edits the Stop hook already
  // announced. --root stays an explicit, unconditional override.
  const root = options.root
    ? (isAbsolute(options.root) ? options.root : resolve(cwd, options.root))
    : resolveRoot(process.env, {}, cwd);

  if (options.command === "status") {
    const draining = await countDrainingObservations(root);
    const observed = await countObservations(root);
    process.stdout.write(
      [
        `root:  ${root}`,
        `queue: ${queuePath(root)}`,
        `observed: ${observed}`,
        draining.slices > 0
          ? `  ${draining.observations} of those are stuck in ${draining.slices} .draining slice(s) left by a drain that did not finish; run drain again to pick them up.`
          : null,
        "Add .arch-crew/ to this repository's .gitignore; arch-crew does not edit it for you.",
        "",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );
    return 0;
  }

  if (options.command === "discard") {
    const removed = await discardQueue(root);
    process.stdout.write(`Discarded ${removed} queue file(s). Nothing that matters was lost.\n`);
    return 0;
  }

  // The drain classifies observed edits against the active rules. Which rules
  // those are is a machine-layer question, so it goes through the mode-aware
  // seam and the drain itself stays mode-blind.
  const { decisions, errors, directory, missingDirectory } = await resolveRecord(root, { dir: options.dir });
  if (missingDirectory) {
    process.stderr.write(`No decisions directory at ${directory}\n`);
    return 1;
  }

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`${error}\n`);
    return 1;
  }

  const drained = await drainQueue(root);
  const base = options.base ?? defaultBase(root);
  const sources = new Map();
  for (const observation of drained.observations) {
    const entry = sources.get(observation.path) ?? { path: observation.path, sources: new Set(), tools: new Set() };
    entry.sources.add("queue");
    if (observation.tool) entry.tools.add(observation.tool);
    sources.set(observation.path, entry);
  }
  for (const path of gitPaths(root, base)) {
    const entry = sources.get(path) ?? { path, sources: new Set(), tools: new Set() };
    entry.sources.add("git");
    sources.set(path, entry);
  }

  // The designated authoritative sources. Loaded here, beside the decisions,
  // because the drain's job is to say what this session's edits bear on -- and
  // a designated API contract or security requirement bears on them exactly as
  // a decision file does. Registry problems are reported, never fatal: a
  // malformed registry must not take down drift reporting.
  let designated = [];
  let sourceConflicts = [];
  try {
    const loaded = await loadSources(root);
    designated = loaded.sources;
    sourceConflicts = findConflicts(designated);
  } catch (error) {
    sourceConflicts = [{ kind: "registry-unreadable", subject: "sources", sources: [], note: error.message }];
  }

  const times = drained.observations.map((observation) => observation.t).sort();
  const packet = buildPacket({
    root,
    base,
    decisions,
    sources: designated,
    sourceConflicts,
    paths: [...sources.values()].map((entry) => ({
      path: entry.path,
      sources: [...entry.sources].sort(),
      tools: [...entry.tools].sort(),
    })),
    queue: {
      observed: drained.observations.length,
      malformed: drained.malformed,
      atCap: drained.atCap,
      truncated: drained.truncated,
      since: times[0] ?? null,
      until: times[times.length - 1] ?? null,
    },
    checkerRows: checkerRows(root, directory),
  });

  process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  await releaseDrained(root, drained.names);
  // The Stop hook's "N edits observed" memory is scoped to the queue it
  // described; a drain that consumed that queue invalidates it.
  await clearNotifiedCount(root);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
