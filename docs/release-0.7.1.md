# Release 0.7.1 — Reflection needs a signal the model does not produce

A content fix to `agentic-patterns`, from a literature review of Reflexion (Shinn et al., NeurIPS
2023) and the self-correction work that followed it. No runtime, command or frontmatter change.

## What the guidance said, and why it was wrong

Reflection was recommended when "there's a clear correctness signal to check against", with the
loop ending "when the critique is clean". Both let the model's own critique serve as the signal and
as the exit. The evidence says a prompted model is a poor judge of its own correctness:

- intrinsic self-correction lowers accuracy (GPT-4 GSM8K 95.5 → 89.0; Huang et al., ICLR 2024);
- self-correction works with reliable external feedback and, for prompted models, almost nowhere
  else (Kamoi et al., TACL 2024);
- with a deterministic check, plain retry matched or beat reflection loops at lower cost: on
  HumanEval, Retry 92.0% at $2.51 against Reflexion 87.8% at $3.90 (Kapoor et al., TMLR).

## Changes

- **Reflection** (`catalog.md`, `decision-tree.md` Q3): the signal must come from outside the
  generator (tests, a tool, an environment flag, a schema check), and the loop exits when that
  signal passes. With no outside signal, prefer a single pass or sampling with a vote. A new *Not
  when* asks for plain retry or best-of-N against the same check to be measured first. Reflexion is
  named as the cross-attempt variant, in one sentence; it is not a new pattern, anchor or branch.
- **Evaluator-Optimizer** (`catalog.md`, `decision-tree.md` Q2): an evaluator prompt on the same
  model is not independent of the generator, and a deterministic check should be tried as plain
  retry or best-of-N before it is wrapped in a loop.
- Sources `[KAM]`, `[KAP]` and `[SHN]` added to the catalog.

The public page (`html/agentic-patterns.html`, entry 1.3 and the wizard notes) carries the same
wording and is updated separately.
