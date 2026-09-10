# Router scenario run — 0.4.1, iteration 1

`test/scenarios/router.json`, all 18 scenarios, run before the 0.4.1 pull request was raised.

## How this run differed from the documented procedure

`docs/validating-skills.md` asks for a fresh Claude Code session per scenario, with the plugin
installed, and the prompt pasted verbatim. **That is not what happened here, and the difference
matters when reading the results.**

Each scenario was run in a fresh agent context that was handed:

1. `commands/arch-crew.md` verbatim, presented as the command file the host had just loaded;
2. a per-scenario `arch status` block, hand-written to match that scenario's `forces` — the shape
   `runtime/baseline/status.mjs` really produces, but not produced by it on a real repository;
3. the scenario's `prompt`, exactly as written, `/arch-crew` included;
4. the scenario's `forces` as facts it could assume.

It was told not to run any tool, and to report its route, whether it would ask / review / write, its
first action, and the reply it would have given.

**What this therefore tests:** the routing judgement — given a sentence a user typed and the door's
own instructions, which existing capability gets entered, and what the door does and does not do on
the way in. That is the thing `/arch-crew` exists to get right.

**What it does not test:** the host actually dispatching `/arch-crew`, `${CLAUDE_PLUGIN_ROOT}`
resolving, `arch status` running as a pre-executed command, or the entered capability behaving
correctly once entered. The first three need an installed plugin; the last is what the other five
scenario sets already grade.

Runner tier: Sonnet 4.5, one fresh context per scenario. Grader: the session author (Opus 5), against
each scenario's `expect` and the set's eight `criteria`.

## Results

18 of 18 routed to the capability that owns the outcome. Two findings, one of them a real defect in
the door; both were fixed and the two affected scenarios re-run against the amended door.

| Scenario | Expected | Routed to | Verdict |
|---|---|---|---|
| capability-help | help | HELP | pass |
| bare-invocation | help | HELP | pass |
| open-ended-what-should-i-do | help | HELP | pass |
| drift-on-this-branch | drift | `/arch-drift` | pass |
| deliberate-divergence | drift | `/arch-drift`, framed as legitimate evolution | pass |
| deterministic-verification | check | `/arch-check --run` | **finding 1** |
| inherited-undocumented-repository | migrate-reverse-discovery | `/arch-migrate`, reverse-discovery half named | pass |
| prose-adrs-to-consolidate | migrate-consolidation | `/arch-migrate`, consolidation half named | pass |
| documentation-mode-choice | mode | `/arch-mode` | pass |
| greenfield-architecture | decide-architecture | `arch-crew:decide-architecture` | pass |
| ambiguous-review-this-architecture | clarify | CLARIFY, one question | pass |
| testing-strategy | test-patterns | `arch-crew:test-patterns`, review branch | pass |
| design-pattern-question | design-patterns | `arch-crew:design-patterns` | pass |
| agent-autonomy | agentic-patterns | `arch-crew:agentic-patterns` | pass |
| security-of-a-change | threat-model | `arch-crew:threat-model` | pass |
| which-documents-are-authoritative | sources | `/arch-sources` | pass |
| promote-a-decision | promote | CLARIFY | **finding 2** |
| stale-constitution | constitution | `/arch-constitution` | pass |

### The three refusals, which is what the set is really for

- **Help stayed cheap.** All three orientation scenarios rendered the capability map and nothing
  else: no review, no drain, no decision file read, no write. `open-ended-what-should-i-do` read the
  two `Next:` lines out of the status block it was given rather than going to find them.
- **A deliberate divergence was not a defect hunt.** `deliberate-divergence` entered `/arch-drift`
  and said, unprompted, that the likely honest outcome was legitimate evolution with a proposed
  decision changing the baseline, "not a demand to revert the code".
- **Promotion was not performed.** `promote-a-decision` refused to guess which of four proposed
  decisions "this" meant, and named the confirmation gate.

### Finding 1 — routing acquired a side effect (door defect, fixed)

"Check whether our dependency boundaries are still valid" went straight to `/arch-check --run`.
`--run` spawns the repository's real third-party tools. The door's table said to add it "only when
they want the real tools spawned", which reads as a permission rather than a restraint, and the run
took it as the obvious way to answer "still valid".

Fixed in `commands/arch-crew.md`: resolving every binding is the default, and `--run` "is offered,
never assumed". Pinned by `test/router.test.mjs` ("the door offers --run rather than assuming it").
Re-run recorded below.

### Finding 2 — a missing detail is not ambiguity (door wording, fixed)

"Make this proposed architecture decision active" reported `CLARIFY` rather than `promote`. The
*behaviour* was exactly right — it named `/arch-promote`, refused to guess the id, and kept the gate
— but the door gave it no way to say "enter the capability, which will ask its own question", so
asking looked like a destination in its own right. Left alone, this costs the user a turn at the door
for a question `/arch-promote` was always going to ask.

Fixed in `commands/arch-crew.md`: "A missing detail is not ambiguity… Enter the capability and let it
ask its own question — do not hold the user at the door for something the destination was always
going to want." Pinned by `test/router.test.mjs`. Re-run recorded below.

### Note on the `reviews` field, not a finding

Four scenarios whose `expect.reviews` is `true` reported `REVIEWS: no`, because the runner read the
question as "would *you* read repository files in this turn" while the scenario means "does this
scenario end in a review of the repository". The routes were right in every case. This is an
ambiguity in the run harness's report format, not in the door or the scenario set; a future run
should ask the two questions separately.

## Re-runs against the amended door

See `rerun.md`.
