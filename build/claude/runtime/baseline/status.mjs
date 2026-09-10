#!/usr/bin/env node

// `arch status` -- where this repository stands, in one cheap read.
//
// Orientation, not analysis. Every number here comes from a file this package
// already owns: the config, the decision record, the source registry, the
// observed-edit queue. Nothing scans the repository, nothing spawns a checker,
// nothing asks a model, and nothing is written. That is the whole contract:
// this is the command a front door may run *before* the user has said what
// they want, so it must cost about as much as `ls`.
//
// It reports; it never gates. The one exception is a configuration that cannot
// be read at all, which is returned as exit 1 because every other number on the
// report would then be an answer about the wrong repository.
//
// Deliberately agent-neutral. The `Next:` lines name `arch` verbs, never a
// slash command: this runtime ships identically to hosts that have no slash
// commands at all, and a suggestion the reader cannot act on is worse than no
// suggestion.

import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readConfig } from "./config.mjs";
import { renderConstitution } from "./constitution.mjs";
import { resolveRecord } from "./record.mjs";
import { findConflicts, loadSources } from "./sources.mjs";
import { countObservations } from "../drift/queue.mjs";

const USAGE = `Usage: arch status [--json]

  Print where this repository stands: documentation mode, where the human
  record lives, how many decisions are active and proposed, how many sources
  are designated, and how many observed edits are queued.

  Reads only. Nothing is scanned, spawned, or written.
`;

function display(root, path) {
  const rel = relative(root, path);
  return !rel || rel.startsWith("..") || isAbsolute(rel) ? path : rel.split("\\").join("/");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// `current`, `stale` or `absent`. Never an error: an unreadable rollup is
// reported as absent here and loudly by `arch constitution --check`, which is
// the lane that exists to be loud about it.
async function rollupState(record) {
  if (!(await exists(record.rollup))) return "absent";
  if (record.errors.length > 0) return "unknown";
  try {
    const committed = await readFile(record.rollup, "utf8");
    return committed === renderConstitution(record.decisions, { mode: record.mode }) ? "current" : "stale";
  } catch {
    return "absent";
  }
}

// The registry is read the same way `sources list` reads it, but a registry
// that will not parse must not take the whole report down with it: the reader
// still wants to know what the decision record says.
async function sourcesState(root) {
  try {
    const { sources } = await loadSources(root);
    return { designated: sources.length, conflicts: findConflicts(sources).length, readable: true };
  } catch {
    return { designated: 0, conflicts: 0, readable: false };
  }
}

export async function collectStatus(root) {
  const config = await readConfig(root);
  const record = await resolveRecord(root);
  const byStatus = (status) => record.decisions.filter((decision) => decision.status === status).length;

  return {
    mode: record.mode,
    configPresent: config.present,
    record:
      record.mode === "living"
        ? { kind: "documents", paths: record.documents.map((path) => display(root, path)) }
        : {
            kind: "decisions-directory",
            paths: [display(root, record.directory)],
            missing: record.missingDirectory,
          },
    rollup: { path: display(root, record.rollup), state: await rollupState(record) },
    decisions: {
      total: record.decisions.length,
      active: byStatus("active"),
      proposed: byStatus("proposed"),
      superseded: byStatus("superseded"),
      errors: record.errors,
    },
    sources: await sourcesState(root),
    queue: { observations: await countObservations(root) },
  };
}

// At most a few lines, each one a fact plus the verb that acts on it. A front
// door renders these in its own vocabulary; a person reading a terminal can act
// on them as they stand.
export function nextActions(status) {
  const next = [];
  if (status.decisions.total === 0) {
    next.push(
      "No decisions are recorded yet. `arch candidates` lists what this repository already has to work from.",
    );
  }
  if (status.decisions.proposed > 0) {
    next.push(
      `${status.decisions.proposed} proposed decision(s) are waiting for a human to review them (arch promote <id>...).`,
    );
  }
  if (status.queue.observations > 0) {
    next.push(`${status.queue.observations} observed edit(s) are queued (arch drift drain).`);
  }
  if (status.rollup.state === "stale") {
    next.push("The committed constitution is behind the record it rolls up (arch constitution).");
  }
  if (status.sources.conflicts > 0) {
    next.push(
      `${status.sources.conflicts} conflict(s) between designated sources are reported, not resolved (arch sources list).`,
    );
  }
  return next;
}

export function renderStatus(status) {
  const lines = [
    `Documentation mode: ${status.mode}${status.configPresent ? "" : " (default; no arch-crew.json)"}`,
  ];

  if (status.record.kind === "documents") {
    lines.push(`Human record: ${status.record.paths.join(", ")}`);
  } else {
    lines.push(`Human record: ${status.record.paths[0]}${status.record.missing ? " (no such directory yet)" : ""}`);
  }

  lines.push(`Machine rollup: ${status.rollup.path} (${status.rollup.state})`);
  lines.push(
    status.decisions.total === 0
      ? "Decisions: none recorded yet"
      : `Decisions: ${status.decisions.active} active, ${status.decisions.proposed} proposed` +
          (status.decisions.superseded > 0 ? `, ${status.decisions.superseded} superseded` : ""),
  );

  if (!status.sources.readable) {
    lines.push("Authoritative sources: registry unreadable");
  } else if (status.sources.designated === 0) {
    lines.push("Authoritative sources: none designated");
  } else {
    lines.push(
      `Authoritative sources: ${status.sources.designated} designated` +
        (status.sources.conflicts > 0 ? `, ${status.sources.conflicts} conflict(s) reported` : ""),
    );
  }

  lines.push(`Observed edits queued: ${status.queue.observations}`);

  if (status.decisions.errors.length > 0) {
    lines.push(`Record errors: ${status.decisions.errors.length} (arch constitution --check reports them in full)`);
  }

  const next = nextActions(status);
  if (next.length > 0) {
    lines.push("", "Next:");
    for (const action of next) lines.push(`  - ${action}`);
  }

  return `${lines.join("\n")}\n`;
}

export async function run(argv, cwd = process.cwd()) {
  let json = false;
  for (const argument of argv) {
    if (argument === "--json") {
      json = true;
    } else if (argument === "--help" || argument === "-h") {
      process.stdout.write(USAGE);
      return 0;
    } else {
      process.stderr.write(`Unknown argument '${argument}'.\n\n${USAGE}`);
      return 1;
    }
  }

  let status;
  try {
    status = await collectStatus(cwd);
  } catch (error) {
    // A config that will not read is the one failure worth an exit code: every
    // number below it would be an answer about a repository this is not.
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  process.stdout.write(json ? `${JSON.stringify(status, null, 2)}\n` : renderStatus(status));
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
