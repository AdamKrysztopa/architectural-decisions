#!/usr/bin/env node

// One entry point for every deterministic operation this package ships.
//
// The underlying CLIs each export `run(argv, cwd)` returning an exit code,
// so this dispatcher delegates in-process: no child process, no PATH lookup,
// and every underlying exit code reaches the caller unchanged. That matters —
// `check`'s 0/2/3 vocabulary is what makes it usable as a CI gate, and a
// wrapper that flattened it to 0/1 would silently disarm the gate.
//
// The dispatcher adds no behaviour of its own beyond routing and `--help`. It
// is deliberately not a place to add convenience: a verb that did something the
// underlying CLI cannot do would make the CLI and the command surface disagree.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERBS = {
  mode: {
    summary: "Show or set the human documentation mode: many ADRs, or living architecture documents.",
    usage: "mode [adr|living] [--dir <path>] [--document <path>]...",
    load: async () => (await import("./baseline/mode.mjs")).run,
  },
  sources: {
    summary: "Designate, list and reconcile the artifacts this project treats as authoritative.",
    usage: "sources <list|add|remove|change|checked> [options]",
    load: async () => (await import("./baseline/sources-cli.mjs")).run,
  },
  constitution: {
    summary: "Generate docs/<dir>/constitution.md from the decision files, or --check it is current.",
    usage: "constitution [--dir <path>] [--check]",
    load: async () => (await import("./baseline/build-constitution.mjs")).run,
  },
  promote: {
    summary: "Promote one or more proposed decisions to active. Always an explicit human act.",
    usage: "promote <id>... [--dir <path>]",
    load: async () => (await import("./baseline/build-constitution.mjs")).runPromote,
  },
  check: {
    summary: "Resolve every deterministic rule's verified_by binding; --run evaluates it with the real tool.",
    usage: "check [--dir <path>] [--run] [--require-tools] [--json]",
    load: async () => (await import("./checkers/check-rules.mjs")).run,
  },
  drift: {
    summary: "Report, drain, or discard the observed-edit queue.",
    usage: "drift <status|drain|discard> [--root <path>] [--dir <path>] [--base <ref>] [--json]",
    load: async () => (await import("./drift/drift.mjs")).run,
  },
  migrate: {
    summary: "Build a migration report of proposed decisions from a confirmed manifest.",
    usage: "migrate --manifest <path> [--dir <path>] [--cap <n>]",
    load: async () => (await import("./migration/build-migration-report.mjs")).run,
  },
  candidates: {
    summary: "List the decision-shaped inputs this repository already has. Reads only; adopts nothing.",
    usage: "candidates [--root <path>]",
    load: async () => (await import("./migration/discover-candidates.mjs")).run,
  },
};

export function helpText() {
  const width = Math.max(...Object.keys(VERBS).map((verb) => verb.length));
  const lines = Object.entries(VERBS).map(
    ([verb, spec]) => `  ${verb.padEnd(width)}  ${spec.summary}`,
  );
  return [
    "Usage: arch <verb> [options]",
    "",
    ...lines,
    "",
    "Run 'arch <verb> --help' for that verb's own options.",
    "",
  ].join("\n");
}

export async function run(argv, cwd = process.cwd()) {
  const verb = argv[0];

  if (!verb || verb === "--help" || verb === "-h" || verb === "help") {
    process.stdout.write(helpText());
    return verb ? 0 : 1;
  }

  const spec = VERBS[verb];
  if (!spec) {
    process.stderr.write(`Unknown verb '${verb}'.\n\n${helpText()}`);
    return 1;
  }

  const rest = argv.slice(1);
  if (rest.includes("--help") || rest.includes("-h")) {
    process.stdout.write(`Usage: arch ${spec.usage}\n\n${spec.summary}\n`);
    return 0;
  }

  const delegate = await spec.load();
  return delegate(rest, cwd);
}

export const verbs = Object.keys(VERBS);

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
