# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This repo is the **`arch-crew` cross-agent skill package** — four architectural-decision skills —
plus the local HTML knowledge source three of them were distilled from. Claude Code and Codex have
generated packages; no Cursor or GitHub Copilot package is supported yet.

### Shared skills and generated packages

`skills/` contains the canonical portable workflows and references. `docs/` and the examples are
canonical shared documentation. Target adapters in `builders/` select those files and generate
allowlisted install trees in `build/<target>/`; generated artifacts are committed so Git-backed
marketplaces can install a target package directly.

`.claude-plugin/{plugin.json,marketplace.json}` remains the root Claude compatibility façade.
Its user-facing marketplace and install commands, plugin identity, skill namespace, and canonical
skill bytes must remain compatible with the existing Claude release.

`shared/` holds canonical content copied into several skills; `builders/sync-shared.mjs` performs
that copy and its output is committed, so `skills/*/references/recording-decisions.md` must never be
edited directly. `runtime/` holds the zero-dependency Node code shipped to every target.

Four shared skills, each invoked as `arch-crew:<name>` in a host that namespaces skills:

- `decide-architecture` — software architecture (structure/topology/data/overlays).
- `design-patterns` — GoF + Python-idiomatic design patterns.
- `agentic-patterns` — LLM-agent control-flow design.
- `test-patterns` — testing strategy: QA as a process discipline, executable unit/integration/E2E
  levels, and data/ML/LLM evaluation overlays kept as three distinct dimensions.

Each skill branches on project status: **greenfield → selection interview** (compose a
recommendation) or **refactoring → code review** against the catalog. Each skill is a lean
`SKILL.md` workflow plus `references/` files read on demand (progressive disclosure). Two are
required of every skill: `decision-tree.md` (the interview/decision logic) and `catalog.md`
(patterns with when/cost + code-review cues). Convention mirrors the sibling `ds-crew` plugin.

A skill may add **topic references** when a single catalog would force the model to load material
most runs never need. `test-patterns` does: `references/evaluation.md` (the data / ML / LLM-agent
evaluation overlay, dimension 3) and `references/oracles.md` (the cross-cutting generated-test
oracle guardrail). Its `SKILL.md` carries a decision → reference table, and `test/build.test.mjs`
enforces both directions: every shipped reference must be cited by `SKILL.md`, and every cited
reference must exist. Do not add a topic reference for cosmetic reasons — size that actually harms
selective retrieval is the bar.

Validation has two layers, documented in [`docs/validating-skills.md`](docs/validating-skills.md):
the package contract (`test/build.test.mjs`) and the force-driven scenario sets
(`test/scenarios/*.json`), which grade a skill's gate outcomes without numeric scoring.

### The HTML knowledge source (local only, not shipped)

Three sibling **single-file, zero-dependency HTML reference documents** — interactive pattern
catalogs, each ending in a clickable decision wizard. These are the **source of truth** three of the
skills' references were burned in from; they are NOT part of the installable plugin (`test-patterns`
has **no** HTML source — its references are authored directly, so there is no wizard to keep in
sync and no coverage invariant for it):

- `html/architecture-patterns.html` — architecture patterns + a "build your stack" wizard → `decide-architecture`.
- `html/python-design-patterns.html` — GoF + Python-idiomatic patterns + a "which pattern?" wizard → `design-patterns`.
- `html/agentic-patterns.html` — LLM-agent patterns + a "design your agentic system" wizard → `agentic-patterns`.

When the catalogs change, re-distill the affected skill's `references/` from the HTML. `html/` and
`inputs/` are gitignored — knowledge source only.

The reading order / lineage is architecture → Python → agentic; each later file deliberately
reuses the earlier files' visual system and CSS tokens.

The HTML references have no framework or browser build step. Each `.html` file
is self-contained: all CSS lives in one inline `<style>`, all behavior in one inline `<script>`.
The hard constraint across every file: **no external libraries, no build step, stays a single
portable HTML document.**

## Git conventions

**This repository keeps a LINEAR history.** No merge commits, ever. Land work with
`git merge --ff-only`, `git merge --squash`, or `git rebase`. A branch's commits are squashed into
one commit per deliverable before landing on `main`.

Enforcement is mechanical, not advisory: `.githooks/pre-merge-commit` refuses any merge commit, and
`core.hooksPath` must point at it. After cloning, run once:

```sh
git config core.hooksPath .githooks
git config merge.ff only
git config pull.rebase true
```

`merge.ff only` and `pull.rebase` catch the common cases; the hook catches an explicit `--no-ff`,
which overrides config. Do not bypass it with `--no-verify`.

Do not push or tag without being asked. Tags are cut only after a human review.

## Working on the files

"Run" = open the file in a browser (`open html/architecture-patterns.html`). There is nothing to compile.

To sanity-check wizard JS after editing, extract the inline script and run Node's syntax check
(this is the validation flow the repo is set up for):

```sh
awk '/^<script>/{f=1;next} /^<\/script>/{f=0} f' html/architecture-patterns.html > /tmp/wiz.js
node --check /tmp/wiz.js
```

## Package build workflow

Build a target after changing shared runtime content or an adapter:

```sh
npm run build -- --target claude
npm run build -- --target codex
npm run build -- --target all
```

Use the validation commands documented in [`docs/building-packages.md`](docs/building-packages.md).
Do not edit `build/` by hand. The project intentionally generates structured JSON directly and
copies Markdown byte-for-byte; it does not use Jinja or another prose templating engine.

## Shared visual system (keep consistent across all three files)

- Design tokens live as CSS custom properties in `:root`: `--bg`, `--ink`, `--muted`,
  `--faint`, `--rule`, `--accent` (`#383C82`), `--accent-soft`. Fonts: `--display`
  (Space Grotesk), `--body` (Source Serif 4), `--mono` (IBM Plex Mono).
- Layout: `.wrap` (max-width 840px, centered). `header.masthead` → `.eyebrow` → `h1` → `.dek` → `.meta`.
- Content is organized into `<section>`s with a `.part-label` (Part I, II, …) + `h2`.
- A pattern entry is: `h3` with a `.idx` number + `.oneline` italic summary + prose `<p>` +
  optional `figure.diagram` (inline SVG) + optional `pre.code` snippet + a `.spec` table of
  `.k`/`.v` rows (Use-when / Cost / Pythonic, etc.).
- Compact (Tier 2) entries use `.card` / `.cards` with `.intent` + `.note` + a short snippet.
- `.callout` is the thesis box (e.g. DDD note, "simplest agentic system wins").
- Diagram SVG fills use the shared color classes `c-blue`, `c-teal`, `c-purple`, `c-gray`.

When adding a pattern, match the existing voice and reuse these classes — do not introduce new
CSS frameworks or restyle existing entries.

## Wizard architecture (the interactive part)

Each file's wizard is a vanilla-JS IIFE gated on its root element, so it no-ops if the markup
isn't present:

```js
(function(){
  var root = document.getElementById('<prefix>-decider');
  if(!root) return;
  var R = function(n,a,why,...){ return {result:{...}}; };  // build a result/leaf node
  function O(label,sub,target){ return {label,sub,next:target.next,result:target.result}; } // build an option
  // question objects: { q:'...', opts:[ O(...), ... ] }
})();
```

Requirements that hold for every wizard: Back + Start-over, keyboard accessible (focus
management + ARIA), an `aria-live` region announcing the current step/result, a `<noscript>`
fallback, and every recommendation links to its in-page section anchor.

Two distinct wizard *models* — do not conflate them:

- **architecture & agentic = composed output.** The wizard walks several axes/layers and
  returns a *stack/design* (one pick per relevant axis), with branches that skip irrelevant
  axes and contextual notes that surface automatically.
- **python = decision tree.** Returns exactly ONE primary recommendation (+ optional
  alternative), because GoF patterns don't compose one-per-axis.

Anchor id conventions: Python entries use `id="dp-..."`, agentic entries `id="ap-..."`,
and the architecture wizard / decision UI uses the `#decider` / `.dt-` namespace. **Coverage
invariant:** every catalog entry (all tiers) must be reachable from its wizard as a
recommendation or note.

## Source of truth for scope

`docs/superpowers/specs/*.md` are dated design specs — one per HTML file — defining each
catalog's intended patterns, tiers, wizard flow, and explicit out-of-scope list. Read the
matching spec before adding or removing patterns; it states what belongs and what was
deliberately excluded. `inputs/` holds source material (e.g. the agentic-patterns Q&A PDF that
seeds `agentic-patterns.html`).
