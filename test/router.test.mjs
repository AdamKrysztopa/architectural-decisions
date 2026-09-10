// The front door: `/arch-crew <intent>`.
//
// Two things are under test here, and they are different kinds of thing. The
// first is a Markdown file that a model reads, so what can be asserted about it
// is that it *says* the load-bearing things -- every capability is reachable,
// the classification model survives the trip, and the authority limits are
// stated. The second is `arch status`, the one deterministic command the door
// runs before it knows what the user wants, and that one is testable properly:
// it must be cheap, correct, and incapable of changing anything.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { collectStatus, nextActions, renderStatus, run as status } from "../runtime/baseline/status.mjs";
import { readConfig } from "../runtime/baseline/config.mjs";
import { verbs } from "../runtime/arch.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const routerPath = join(repositoryRoot, "commands/arch-crew.md");

async function router() {
  return readFile(routerPath, "utf8");
}

async function scratch() {
  return mkdtemp(join(tmpdir(), "arch-router-"));
}

const DECISION = (id, decisionStatus) =>
  [
    "---",
    `id: ${id}`,
    `status: ${decisionStatus}`,
    "skill: decide-architecture",
    "date: 2026-09-10",
    "commit: 0000000",
    "rules:",
    `  - id: rule-${id}`,
    "    statement: A placeholder rule that exists only to be counted.",
    "    scope: [\"src/**\"]",
    "    severity: warning",
    "    verification: narrative",
    "---",
    `# Decision ${id}`,
    "",
    "## Context",
    "## Decision",
    "## Consequences (cost)",
    "",
  ].join("\n");

async function projectWith(decisions) {
  const root = await scratch();
  const directory = join(root, "docs/architecture/decisions");
  await mkdir(directory, { recursive: true });
  for (const [id, decisionStatus] of decisions) {
    await writeFile(join(directory, `${String(id).padStart(4, "0")}-example.md`), DECISION(String(id).padStart(4, "0"), decisionStatus), "utf8");
  }
  return root;
}

// Captures stdout so the door's one pre-executed command can be asserted on
// without a child process.
async function capture(work) {
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    const code = await work();
    return { code, out: written.join("") };
  } finally {
    process.stdout.write = original;
  }
}

// --- the command exists and obeys the same contract as every other one -----

test("the front door is a shipped command with the frontmatter every command declares", async () => {
  const text = await router();
  assert.match(text, /^---\n/);
  assert.match(text, /\ndescription: .+\n/);
  assert.match(text, /\nargument-hint: .+\n/);
  assert.match(text, /\$ARGUMENTS/, "the door never reads the user's intent");
});

test("the door pre-executes exactly one command, and it is the read-only one", async () => {
  const text = await router();
  const preExecuted = [...text.matchAll(/!`([^`]+)`/g)].map(([, command]) => command.trim());
  assert.equal(preExecuted.length, 1, `expected one pre-executed command, got ${preExecuted.length}`);
  assert.match(preExecuted[0], /runtime\/arch\.mjs" status$/);

  // The `!` prefix runs before the model has read a single word of the intent.
  // Anything that writes, promotes, designates or drains must therefore never
  // appear in that position -- typing the front door is not consent.
  for (const forbidden of ["promote", "drift drain", "drift discard", "sources add", "sources remove", "mode adr", "mode living", "migrate"]) {
    assert.ok(
      !preExecuted[0].includes(forbidden),
      `the door pre-executes '${forbidden}', which is an act, not an orientation`,
    );
  }
  assert.doesNotMatch(text, /!`[^`]*arch\.mjs" (promote|migrate)/);
});

test("every capability the door routes to is reachable, and every verb it names exists", async () => {
  const text = await router();

  // The five skills, by the name a host namespaces them under.
  for (const skill of ["decide-architecture", "design-patterns", "agentic-patterns", "test-patterns", "threat-model"]) {
    assert.match(text, new RegExp(`arch-crew:${skill}`), `the door cannot route to ${skill}`);
  }

  // Every sibling command, so no capability is stranded behind a name only the
  // author remembers.
  const commands = (await readdir(join(repositoryRoot, "commands")))
    .filter((name) => name.endsWith(".md") && name !== "arch-crew.md")
    .map((name) => `/${name.replace(/\.md$/, "")}`);
  for (const command of commands) {
    assert.ok(text.includes(command), `the door never mentions ${command}`);
  }

  // And it may not invent a dispatcher verb.
  for (const [, verb] of text.matchAll(/runtime\/arch\.mjs"\s+(\w[\w-]*)/g)) {
    assert.ok(verbs.includes(verb), `the door names unknown verb '${verb}'`);
  }
});

test("the door covers every workflow the specification names, in the user's language", async () => {
  const text = (await router()).toLowerCase();
  const workflows = {
    "new-project architecture": /establish this project's architecture|something new/,
    "existing-repository review": /review the architecture of this repository/,
    "baseline from prose ADRs": /consolidation/,
    "baseline from a repository that documents nothing": /reverse.discovery/,
    "drift review": /drift/,
    "deterministic verification": /arch-check/,
    "documentation mode": /arch-mode/,
    "ADR to living migration": /living/,
    "authoritative sources": /arch-sources/,
    testing: /test-patterns/,
    "design patterns": /design-patterns/,
    "agentic architecture": /agentic-patterns/,
    security: /threat-model/,
    promotion: /arch-promote/,
  };
  for (const [workflow, pattern] of Object.entries(workflows)) {
    assert.match(text, pattern, `the door has no route for ${workflow}`);
  }
});

test("help is help: the door forbids doing work to answer 'what can you do?'", async () => {
  const text = await router();
  assert.match(text, /## If there is no meaningful intent/);
  assert.match(text, /do \*\*not\*\* review the repository/i);
  assert.match(text, /not consent to a repository-wide review/i);
});

test("the door asks one question when the reading changes the work, and does not ask otherwise", async () => {
  const text = await router();
  assert.match(text, /Ask exactly one/);
  assert.match(text, /Do not ask two questions/);
  assert.match(text, /Do not ask when the intent is clear/);
  // A detail the destination was always going to ask for is not ambiguity, and
  // must not become a second turn at the door. The 0.4.1 scenario run caught
  // this: "make this decision active" was held at the door for an id that
  // /arch-promote asks for itself.
  assert.match(text, /A missing detail is not ambiguity/);
});

test("the door offers --run rather than assuming it", async () => {
  // `--run` spawns the repository's real third-party tools. Routing may not
  // acquire that side effect on the user's behalf -- the 0.4.1 scenario run
  // found a run that went straight to `/arch-check --run` on a sentence that
  // asked only whether the boundaries were still valid.
  const text = await router();
  assert.match(text, /offered, never assumed/);
});

test("routing preserves the drift classification model rather than collapsing it", async () => {
  const text = await router();
  for (const klass of [
    "violation",
    "suspected drift",
    "insufficient evidence",
    "legitimate evolution",
    "stale or contradictory documentation",
  ]) {
    assert.ok(text.toLowerCase().includes(klass), `the door loses the '${klass}' class`);
  }
  // The evidence gate, and the outcome the door must not turn into a defect.
  assert.match(text, /Only a deterministic checker that actually\n?ran and failed yields a violation/);
  assert.match(text, /deliberately diverged/);
  assert.match(text, /proposed decision that changes\n?the baseline/);
});

test("the door states that routing carries no authority, act by act", async () => {
  const text = await router();
  assert.match(text, /Routing is not authority/);
  for (const act of [
    /promotes a decision/,
    /supersedes or retires an active one/,
    /edits the human record/,
    /changes the documentation mode/,
    /designates or removes an authoritative source/,
    /regenerates a tracked file/,
  ]) {
    assert.match(text, act, `the door never rules out ${act}`);
  }
  assert.match(text, /approval gate .* stays exactly where it is/);
});

test("the door enters the workflow instead of naming a command at the user", async () => {
  const text = await router();
  assert.match(text, /\*\*Enter, do not announce\.\*\*/);
  assert.match(text, /should not have to type a second arch-crew\ncommand/);
});

// --- arch status: the one deterministic thing the door runs ----------------

test("status reports an empty repository as an empty repository, and exits 0", async () => {
  const root = await scratch();
  const { code, out } = await capture(() => status([], root));
  assert.equal(code, 0);
  assert.match(out, /Documentation mode: adr \(default; no arch-crew\.json\)/);
  assert.match(out, /Decisions: none recorded yet/);
  assert.match(out, /Authoritative sources: none designated/);
  assert.match(out, /Observed edits queued: 0/);
  assert.match(out, /Next:/);
  assert.match(out, /No decisions are recorded yet/);
});

test("status counts active and proposed decisions separately and says the rollup is absent", async () => {
  const root = await projectWith([[1, "active"], [2, "active"], [3, "proposed"]]);
  const collected = await collectStatus(root);
  assert.equal(collected.decisions.active, 2);
  assert.equal(collected.decisions.proposed, 1);
  assert.equal(collected.rollup.state, "absent");
  assert.match(renderStatus(collected), /Decisions: 2 active, 1 proposed/);
  assert.ok(
    nextActions(collected).some((line) => /1 proposed decision\(s\) are waiting/.test(line)),
    "a proposed backlog is not surfaced",
  );
});

test("status writes nothing and leaves the configuration exactly as it found it", async () => {
  const root = await projectWith([[1, "proposed"]]);
  const config = { version: 1, documentation: { mode: "adr" }, sources: [] };
  await writeFile(join(root, "arch-crew.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const before = await readdir(root);
  const configBefore = await readFile(join(root, "arch-crew.json"), "utf8");

  await capture(() => status([], root));
  await capture(() => status(["--json"], root));

  assert.deepEqual((await readdir(root)).sort(), before.sort(), "status created or removed something");
  assert.equal(await readFile(join(root, "arch-crew.json"), "utf8"), configBefore);
  // Nothing was promoted, and no rollup appeared.
  assert.equal((await collectStatus(root)).decisions.proposed, 1);
  assert.equal((await collectStatus(root)).rollup.state, "absent");
  assert.equal((await readConfig(root)).mode, "adr");
});

test("status never spawns a checker or a scan: it reports only what is already on disk", async () => {
  // The guard is structural -- the module imports no process-spawning helper --
  // because a status command that shelled out to a real tool would be exactly
  // the expensive thing the front door may not do to render help.
  const source = await readFile(join(repositoryRoot, "runtime/baseline/status.mjs"), "utf8");
  const imported = [...source.matchAll(/^import .*from "([^"]+)";$/gm)].map(([, specifier]) => specifier);
  assert.deepEqual(
    imported.filter((specifier) => specifier.startsWith("node:")).sort(),
    ["node:fs/promises", "node:path", "node:url"],
    "status reaches for a builtin beyond reading files and paths",
  );
  assert.ok(
    imported.every((specifier) => !/checkers\//.test(specifier)),
    "status imports a checker, which is the expensive thing help may not do",
  );
});

test("status refuses an unknown argument rather than reporting about the wrong thing", async () => {
  const root = await scratch();
  const { code } = await capture(() => status(["--fix"], root));
  assert.equal(code, 1);
});

test("status exits 1 when the configuration itself cannot be read", async () => {
  const root = await scratch();
  await writeFile(join(root, "arch-crew.json"), "{ not json\n", "utf8");
  const { code } = await capture(() => status([], root));
  assert.equal(code, 1);
});

test("--json carries the same facts the text rendering does", async () => {
  const root = await projectWith([[1, "active"], [2, "proposed"]]);
  const { code, out } = await capture(() => status(["--json"], root));
  assert.equal(code, 0);
  const parsed = JSON.parse(out);
  assert.equal(parsed.mode, "adr");
  assert.equal(parsed.decisions.active, 1);
  assert.equal(parsed.decisions.proposed, 1);
  assert.equal(parsed.sources.designated, 0);
  assert.equal(parsed.queue.observations, 0);
  assert.equal(parsed.record.kind, "decisions-directory");
});

// --- the lower-level surfaces the door sits on are untouched ---------------

test("every 0.4.0 command still ships, and the door is additive", async () => {
  const files = (await readdir(join(repositoryRoot, "commands"))).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(files, [
    "arch-check.md",
    "arch-constitution.md",
    "arch-crew.md",
    "arch-drift.md",
    "arch-migrate.md",
    "arch-mode.md",
    "arch-promote.md",
    "arch-sources.md",
  ]);
});
