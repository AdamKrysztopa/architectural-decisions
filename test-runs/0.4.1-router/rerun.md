# Re-runs against the amended door — 0.4.1, iteration 2

Two scenarios, re-run with the same harness and a fresh context each, after the two findings in
`README.md` were fixed in `commands/arch-crew.md`. Nothing else in the door changed between
iterations, and no other scenario was re-run.

## deterministic-verification

Prompt: `/arch-crew check whether our dependency boundaries are still valid`

**Iteration 1** routed to `/arch-check --run`, spawning the repository's real third-party tools
without being asked.

**Iteration 2** routed to `/arch-check`, resolved the binding, and offered the rest:

> I'll resolve that rule's binding against the real import-linter config now — that confirms the
> check is correctly wired, without yet running it. Let me know if you also want me to actually
> execute import-linter (`--run`) for a live pass/fail result.

Verdict: pass. `expect.routesTo` is `check`, `expect.writes` is `false`, and the side effect routing
had acquired is gone. It also correctly separated the one deterministic rule from the five narrative
ones rather than claiming the narrative rules had been checked.

## promote-a-decision

Prompt: `/arch-crew make this proposed architecture decision active`

**Iteration 1** reported `CLARIFY` — right behaviour, wrong shape: it held the user at the door for
an id that `/arch-promote` asks for itself.

**Iteration 2** routed to `/arch-promote` and let the capability ask:

> Making a decision active is handled by /arch-promote, which always asks for confirmation. There are
> 4 proposed decisions waiting — which one do you mean?

Verdict: pass. `expect.routesTo` is `promote`, `expect.asks` is `true`, `expect.writes` is `false`.
The gate is named, nothing is promoted, and the question is the destination's own rather than a
second turn at the door.

## Standing result for 0.4.1

18 of 18 scenarios route to the capability that owns the outcome, with the two findings closed and
both closures pinned by tests in `test/router.test.mjs`. The fidelity limits in `README.md` still
apply: this run grades routing judgement, not the host's dispatch of `/arch-crew`.
