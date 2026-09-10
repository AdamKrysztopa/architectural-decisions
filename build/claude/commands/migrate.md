---
description: Propose decisions from an undocumented repository, from a confirmed manifest
argument-hint: "[--manifest <path>]"
allowed-tools: Bash(node:*), Read, Glob, Grep
---

This repository's decision-shaped inputs, listed and nothing more:

!`node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" candidates`

**Never scan and adopt.** Listing is not adopting, and a migration run may not
convert a directory wholesale. Follow `references/migrating-decisions.md` from
any arch-crew skill — read it before proposing anything.

The shape of the work:

1. Get the user to **confirm a subset** of the candidates above. Their
   confirmation is the manifest; you do not author it on their behalf.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/runtime/arch.mjs" migrate --manifest <path>`
   with that manifest.
3. Everything it emits is **proposed**, with traceability back to the input it
   came from. Cite sources honestly; where the evidence is thin, say
   "insufficient evidence" rather than inventing a rationale.
4. A structural conflict is reported as a conflict, not silently resolved.
5. Promotion is a separate, explicit act — `/arch-crew:promote`. Do not chain into it.

If the proposal cap is hit, the answer is to rank what matters most and promote
or discard some, not to raise the cap.
