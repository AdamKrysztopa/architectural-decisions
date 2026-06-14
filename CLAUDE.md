# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Three sibling **single-file, zero-dependency HTML reference documents** — interactive
pattern catalogs, each ending in a clickable decision wizard:

- `html/architecture-patterns.html` — software architecture patterns + a "build your stack" wizard.
- `html/python-design-patterns.html` — GoF + Python-idiomatic patterns + a "which pattern?" wizard.
- `html/agentic-patterns.html` — LLM-agent control-flow patterns + a "design your agentic system" wizard.

Note: `html/` and `inputs/` are gitignored (local content artifacts); only the plugin
scaffolding is tracked in git.

The reading order / lineage is architecture → Python → agentic; each later file deliberately
reuses the earlier files' visual system and CSS tokens.

There is no build system, no package manager, no test runner, no framework. Each `.html` file
is self-contained: all CSS lives in one inline `<style>`, all behavior in one inline `<script>`.
The hard constraint across every file: **no external libraries, no build step, stays a single
portable HTML document.**

## Working on the files

"Run" = open the file in a browser (`open html/architecture-patterns.html`). There is nothing to compile.

To sanity-check wizard JS after editing, extract the inline script and run Node's syntax check
(this is the validation flow the repo is set up for):

```sh
awk '/^<script>/{f=1;next} /^<\/script>/{f=0} f' html/architecture-patterns.html > /tmp/wiz.js
node --check /tmp/wiz.js
```

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
