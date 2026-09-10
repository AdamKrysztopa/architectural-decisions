# Release 0.5.0 — the commands are named the way they are typed

## Why this is a major-ish bump and not a patch

0.4.1's front door did not work. Two defects, both found within minutes of installing the built
plugin and typing the command the README taught, and neither catchable by any test in this repository
because both live in the boundary between the package and its host.

**This release renames every slash command.** That is a breaking change to a public interface, which
is why it is 0.5.0 rather than 0.4.2. The `arch` CLI, every skill, the runtime, the hooks, the config
format and every approval gate are untouched.

## Defect 1 — a bare `/arch-crew` does not resolve

Claude Code reaches plugin commands **only** through their namespace. `commands/arch-crew.md` was
therefore `/arch-crew:arch-crew`, and typing `/arch-crew` returned:

```
Unknown command: /arch-crew
Args from unknown skill: help me indentify all the checks, drifts, and potential hooks…
```

0.4.1 shipped a README that taught a string the host rejects. The reasoning behind that name — the
filename is unique across the command set, so the bare form should resolve — was an inference, was
labelled as one at the time, and was wrong.

### The fix: every command is named for how it reads after the colon

| 0.4.1 | 0.5.0 |
|---|---|
| `/arch-crew:arch-crew` | **`/arch-crew:help`** |
| `/arch-crew:arch-check` | `/arch-crew:check` |
| `/arch-crew:arch-constitution` | `/arch-crew:constitution` |
| `/arch-crew:arch-drift` | `/arch-crew:drift` |
| `/arch-crew:arch-migrate` | `/arch-crew:migrate` |
| `/arch-crew:arch-mode` | `/arch-crew:mode` |
| `/arch-crew:arch-promote` | `/arch-crew:promote` |
| `/arch-crew:arch-sources` | `/arch-crew:sources` |

The `arch-` prefix was carried over from a time when these names stood alone. Namespaced, it
stuttered in every one of them. The set now mirrors the dispatcher one-to-one — `arch check` and
`/arch-crew:check` are the same verb on two surfaces — and the door reads as a sentence:

```
/arch-crew:help                                             # the capability map
/arch-crew:help review this branch for architectural drift  # enters the drift workflow
/arch-crew:help avoid the architectural drift of this project
```

`help` is the name people guess, and it reads correctly in both shapes: bare, it is a request for
orientation; with a sentence after it, it is a request for help with that sentence.

**No aliases.** Seven alias files would double the picker listing, which is the problem this rename
exists to fix. Anyone with the old names in a script or a habit has to update them; that is the whole
cost of the change and it is stated here rather than softened.

## Defect 2 — the door forwarded prose into a command that expects flags

Observed on the first real routing run. Asked to identify which rules had no mechanical check, the
door routed correctly to `check` — and then invoked it with a rewritten *sentence* as arguments.
Every `/arch-crew:*` command pre-executes a shell line carrying its own `$ARGUMENTS`, so the sentence
became argv:

```
Unknown argument 'Resolve'. Usage: check-rules.mjs [--dir <path>] [--run] [--require-tools] …
```

The run recovered on a second attempt. That was luck. The failure is available on every route the
door takes, because prose arguments are the door's entire input, and it is latent in 0.4.0 too — a
person typing `/arch-crew:check please check everything` hits the same wall.

### The fix

`commands/help.md` gains a section that says a sibling command is entered with **no arguments at all**,
or with genuine CLI flags the door decided on. The user's wording is the door's to *interpret* into a
destination, never to forward; it belongs in the reading of the output, after the command has run.

Two tests pin it: one that the rule is stated, and one that the premise still holds — that sibling
commands really do interpolate `$ARGUMENTS` into a pre-executed line — so the rule is retired rather
than left as folklore if that ever stops being true.

`test/scenarios/router.json` gains `no-prose-into-a-sibling-command`, built from the exact sentence
that failed, and a ninth criterion (`no-prose-as-arguments`).

## Also: the door says what arch-crew does not do

"Seed the hook to monitor code quality" sounds like arch-crew's job. It is not, in two ways: the
drift hooks register themselves when the plugin is installed, so there is nothing to seed; and
arch-crew never writes into a tool's config — no `.importlinter`, no `semgrep.yml`, no CI file. A
door with no answer for that invents one.

`commands/help.md` now has a **When nothing here owns it** section: one honest line, then the real
neighbour. For the hook request that neighbour is `/arch-crew:check`, which resolves each rule's
`verified_by` against the config the repository already has and names the rules no tool can decide —
exactly the candidates for a gate the user then writes. The other near miss it names is "fix the
architecture for me": the skills recommend and review, they do not perform the refactor.

A tenth criterion and a twentieth scenario grade it. The set now carries five refusals.

## What this says about the 0.4.1 validation

422 deterministic tests and 18 graded routing scenarios all passed, and both defects survived them.
Neither was reachable: the scenario harness handed each run the command file as text rather than
letting a host dispatch it, so nothing exercised the name; and every scenario graded *which*
capability was entered, never *how* it was invoked. The 0.4.1 PR named the first gap explicitly —
"installing the built plugin and typing `/arch-crew` once is the check this PR has not done" — and
that check found both defects in one minute.

The lesson recorded here rather than in a commit message: a scenario set that models the host cannot
grade the host. The cheap end-to-end check comes first, not last.

## Validation

- `npm test`: 426 tests, 0 failures. Three new router tests; the renamed command set asserted in
  `test/router.test.mjs`.
- `npm run sync:check` clean; `arch constitution --check` clean; both targets rebuilt.
- Not re-run: the 18 routing scenarios from
  [`test-runs/0.4.1-router/`](../test-runs/0.4.1-router/). Their prompts changed only in the command
  name, and the door's routing table is otherwise unchanged, so the recorded outcomes stand. The two
  new scenarios have **not** been run against a model yet.

## Sub-project → version → release-doc mapping

| Sub-project | Version | Release doc |
|---|---|---|
| SP6 — release hardening | `0.4.0` | `docs/release-0.4.0.md` |
| Post-0.4.0 defect fixes + the front door | `0.4.1` | `docs/release-0.4.1.md` |
| Command naming + no prose as arguments | `0.5.0` | `docs/release-0.5.0.md` (this document) |
