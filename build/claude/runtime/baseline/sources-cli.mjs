#!/usr/bin/env node

// `arch sources` -- designate, list, amend and reconcile the authoritative
// sources of this repository.
//
// Every subcommand here is an explicit act. There is deliberately no
// `arch sources discover`, no `--auto`, and no scan: designation is the whole
// point, and a registry that populated itself would designate every stale
// draft in docs/ and make it binding.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SOURCE_KINDS,
  SourceError,
  addSource,
  changeSource,
  findConflicts,
  loadSources,
  markChecked,
  removeSource,
} from "./sources.mjs";

const USAGE = `Usage: arch sources <list|add|remove|change|checked> [options]

  list [--json]
      Print the designated sources, their provenance, and any conflicts.
      Exits 3 when a conflict is reported, 0 otherwise.

  add --id <slug> --kind <kind> --path <path> [--title <text>]
      [--covers <subject>]... [--scope <glob>]... [--by <who>] [--on <date>]
      [--provenance <text>]
      [--precedence <n>] [--notes <text>]

  remove --id <slug>

  change --id <slug> [any of add's options]

  checked --id <slug> --baseline <ref>
      Record that this source was reconciled against <ref>, pinning the digest
      of what was read. This is the traceability half: it is what lets a later
      report say which version of the source a claim rests on.

  Kinds: ${SOURCE_KINDS.join(", ")}
`;

function parseArgs(argv) {
  const command = argv[0];
  const options = { covers: [], scope: [] };

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new SourceError(`${argument} needs a value`);
      index += 1;
      return value;
    };

    switch (argument) {
      case "--json": options.json = true; break;
      case "--id": options.id = take(); break;
      case "--kind": options.kind = take(); break;
      case "--path": options.path = take(); break;
      case "--title": options.title = take(); break;
      case "--covers": options.covers.push(take()); break;
      case "--scope": options.scope.push(take()); break;
      case "--by": options.designated_by = take(); break;
      case "--on": options.designated_on = take(); break;
      case "--provenance": options.provenance = take(); break;
      case "--notes": options.notes = take(); break;
      case "--baseline": options.checked_at = take(); break;
      case "--precedence": {
        const value = Number(take());
        if (!Number.isInteger(value)) throw new SourceError("--precedence needs an integer");
        options.precedence = value;
        break;
      }
      default:
        throw new SourceError(`Unknown argument '${argument}'.\n\n${USAGE}`);
    }
  }

  return { command, options };
}

function describe(source) {
  const lines = [`${source.id}  (${source.kind}, precedence ${source.precedence})`];
  lines.push(`  path:        ${source.path}${source.present ? "" : "   [MISSING]"}`);
  if (source.title) lines.push(`  title:       ${source.title}`);
  if (source.covers.length > 0) lines.push(`  covers:      ${source.covers.join(", ")}`);
  if (source.scope.length > 0) lines.push(`  governs:     ${source.scope.join(", ")}`);
  const provenance = [source.designated_by, source.designated_on, source.provenance].filter(Boolean);
  lines.push(`  designated:  ${provenance.length > 0 ? provenance.join(" · ") : "(no provenance recorded)"}`);
  if (source.checked_at) {
    const state =
      source.changedSinceChecked === null
        ? "digest not pinned"
        : source.changedSinceChecked
          ? "CHANGED since"
          : "unchanged since";
    lines.push(`  baseline:    ${source.checked_at} (${state})`);
  } else {
    lines.push("  baseline:    never checked");
  }
  if (source.notes) lines.push(`  notes:       ${source.notes}`);
  return lines.join("\n");
}

// Exit 3 for "a conflict is reported" -- distinct from 1 ("this command
// failed") so a CI gate can tell a broken invocation from a real disagreement
// between two authoritative documents.
async function list(root, options) {
  const { sources } = await loadSources(root);
  const conflicts = findConflicts(sources);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ sources, conflicts }, null, 2)}\n`);
    return conflicts.length > 0 ? 3 : 0;
  }

  if (sources.length === 0) {
    process.stdout.write(
      "No authoritative sources are designated.\n\n" +
        "Nothing is authoritative by default, and nothing will be designated for you.\n" +
        "Designate one with: arch sources add --id <slug> --kind <kind> --path <path>\n",
    );
    return 0;
  }

  process.stdout.write(`${sources.map(describe).join("\n\n")}\n`);

  if (conflicts.length > 0) {
    process.stdout.write(`\nConflicts (${conflicts.length}) — reported, not resolved:\n\n`);
    for (const conflict of conflicts) {
      process.stdout.write(`  [${conflict.kind}] ${conflict.subject}\n    ${conflict.note}\n`);
    }
    process.stdout.write(
      "\nA conflict between two authoritative sources is a decision for a human.\n" +
        "Precedence orders this report; it does not settle the disagreement.\n",
    );
    return 3;
  }

  return 0;
}

// What `add` and `change` print after the fact: one confirmation line, plus a
// single line if the registry now reports a conflict. NOT the whole registry.
// Reprinting it after every add turned designating four sources into ten entry
// blocks, cumulatively -- one entry, then two, then three, then four -- where
// four confirmation lines were wanted. `sources list` already exists for the
// listing, and /arch-crew:sources calls it first.
//
// The exit code still distinguishes a conflict (3) from a clean write (0), so
// nothing a CI gate could key on is lost by not printing the entries.
async function confirm(root) {
  const conflicts = findConflicts((await loadSources(root)).sources);
  if (conflicts.length === 0) return 0;
  process.stdout.write(
    `${conflicts.length} conflict(s) now reported between designated sources. See: arch sources list\n`,
  );
  return 3;
}

export async function run(argv, cwd = process.cwd()) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  const { command, options } = parsed;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return command ? 0 : 1;
  }

  try {
    switch (command) {
      case "list":
        return await list(cwd, options);

      case "add": {
        for (const field of ["id", "kind", "path"]) {
          if (!options[field]) {
            process.stderr.write(`add needs --${field}.\n\n${USAGE}`);
            return 1;
          }
        }
        await addSource(cwd, options);
        process.stdout.write(`Designated '${options.id}' (${options.kind}) → ${options.path}\n`);
        return confirm(cwd);
      }

      case "remove": {
        if (!options.id) {
          process.stderr.write(`remove needs --id.\n\n${USAGE}`);
          return 1;
        }
        await removeSource(cwd, options.id);
        process.stdout.write(`'${options.id}' is no longer designated authoritative.\n`);
        return 0;
      }

      case "change": {
        if (!options.id) {
          process.stderr.write(`change needs --id.\n\n${USAGE}`);
          return 1;
        }
        const { id, json, covers, scope, ...rest } = options;
        // An empty --covers/--scope list means "leave it alone", not "clear
        // it": the caller who wants it cleared edits arch-crew.json, which is
        // a reviewable diff rather than a flag that erases on absence.
        const changes = { ...rest };
        if (covers.length > 0) changes.covers = covers;
        if (scope.length > 0) changes.scope = scope;
        await changeSource(cwd, id, changes);
        process.stdout.write(`Updated '${id}'.\n`);
        return confirm(cwd);
      }

      case "checked": {
        if (!options.id || !options.checked_at) {
          process.stderr.write(`checked needs --id and --baseline.\n\n${USAGE}`);
          return 1;
        }
        await markChecked(cwd, options.id, options.checked_at);
        process.stdout.write(`'${options.id}' recorded as checked against ${options.checked_at}.\n`);
        return 0;
      }

      default:
        process.stderr.write(`Unknown sources command '${command}'.\n\n${USAGE}`);
        return 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
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
