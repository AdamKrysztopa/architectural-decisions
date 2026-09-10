import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobError, compileGlob, matchesScope } from "../runtime/drift/globs.mjs";
import { matchesConfigCandidateGlob } from "../runtime/checkers/text.mjs";

// Two glob matchers live in this codebase, and they are NOT the same
// vocabulary wearing two names:
//
//   - runtime/drift/globs.mjs's compileGlob/matchesScope reads a decision
//     rule's `scope` -- the syntax shared/recording-decisions.md documents
//     to users, validated at parse time (runtime/baseline/decisions.mjs)
//     and reused verbatim by runtime/migration/glob.mjs.
//   - runtime/checkers/text.mjs's matchesConfigCandidateGlob resolves a
//     checker adapter's own configCandidates table (semgrep.mjs's
//     ".semgrep/**.yml", ast-grep.mjs's "rules/**.yml", ...) -- private to
//     that module, never user-facing.
//
// Both modules carry a comment describing exactly where the two diverge.
// This table pins that description against runnable behaviour: every row
// below is a (pattern, path) pair whose outcome in each matcher is asserted
// explicitly, agreement and divergence alike, so a future change that
// narrows, widens, or silently reconciles either matcher's grammar fails
// this suite instead of drifting unnoticed.
//
// `scope` is "match" | "no-match" | "error" (compileGlob throws GlobError);
// `candidate` is "match" | "no-match" (matchesConfigCandidateGlob never
// throws -- see its own module comment on why: an unsupported construct is
// silently reinterpreted, never rejected, which is itself one of the
// divergences this table exists to pin).
const TABLE = [
  // Agreement: both matchers treat a whole-segment "**" and a same-segment
  // "*" identically for an ordinary nested path.
  { name: "trailing ** matches at any depth (both)", pattern: "services/**", path: "services/a/b.py", scope: "match", candidate: "match" },
  { name: "a mismatched prefix matches neither", pattern: "services/**", path: "libs/a.py", scope: "no-match", candidate: "no-match" },

  // Divergence 0: the prefix itself, with no trailing "/", at zero depth.
  // compileGlob builds "services/**" as the literal segment "services"
  // followed by a mandatory "/" before its "(?:.*)?" tail, so the bare
  // string "services" (no child at all) does not match. text.mjs's
  // recursive matcher lets its "**" branch consume zero path segments,
  // so the identical pattern matches the bare prefix too.
  { name: "'**' matches the bare prefix in candidate but not in scope", pattern: "services/**", path: "services", scope: "no-match", candidate: "match" },
  { name: "* stays within one segment (both)", pattern: "app/*.py", path: "app/x.py", scope: "match", candidate: "match" },
  { name: "* does not cross a segment boundary (both)", pattern: "app/*.py", path: "app/nested/x.py", scope: "no-match", candidate: "no-match" },

  // Divergence 1: "**.ext" as a single, mixed segment. text.mjs's own
  // config-candidate tables use this as shorthand for "**/*.ext" (see
  // semgrep.mjs's ".semgrep/**.yml" siblings and the checkers.test.mjs test
  // "resolves the **.ext shorthand glob some config-candidate tables use").
  // scope rejects the identical string outright: `scope` requires "**" to
  // be a whole segment, spelled "**/*.ext" instead.
  { name: "'**.yml' shorthand: candidate expands it, scope rejects it", pattern: "nested/**.yml", path: "nested/deep/tree/rule.yml", scope: "error", candidate: "match" },

  // Divergence 2: '?'. scope's grammar gives it a real meaning ("exactly one
  // character"); text.mjs's reader deliberately does not (see
  // checkers.test.mjs's "a literal '?' in a candidate glob is escaped, not
  // read as a regex quantifier" -- an unescaped '?' after a "*" expansion
  // once made a JS RegExp read it as a quantifier, matching nothing that
  // actually contains a '?'). The same pattern against the same path
  // therefore means two different things depending on which matcher reads
  // it.
  { name: "'?' is a one-char wildcard in scope, a literal character in candidate", pattern: "config?.yml", path: "configA.yml", scope: "match", candidate: "no-match" },
  { name: "'?' still matches a real literal '?' character in candidate", pattern: "config?.yml", path: "config?.yml", scope: "match", candidate: "match" },

  // Divergence 3: character classes. scope rejects `[...]` loudly, naming
  // the rule and the pattern (the same discipline as brace expansion and
  // negation). text.mjs never rejects anything -- it has no "unsupported
  // construct" concept at all -- so the bracket characters are escaped and
  // read as literal text instead, silently matching nothing like a real
  // character class ever would.
  { name: "a character class is rejected by scope, read as literal text by candidate", pattern: "src/[a-z]*.ts", path: "src/models.ts", scope: "error", candidate: "no-match" },
  { name: "candidate's literal reading of a 'class' still matches the literal string", pattern: "src/[a-z]*.ts", path: "src/[a-z]models.ts", scope: "error", candidate: "match" },
];

for (const row of TABLE) {
  test(`glob parity: ${row.name}`, () => {
    if (row.scope === "error") {
      assert.throws(() => compileGlob(row.pattern, "pin-test"), GlobError, `scope was expected to reject '${row.pattern}'`);
    } else {
      assert.equal(
        matchesScope(row.path, [row.pattern], "pin-test"),
        row.scope === "match",
        `scope matcher disagreed with the table for pattern '${row.pattern}' against '${row.path}'`,
      );
    }

    assert.equal(
      matchesConfigCandidateGlob(row.path, row.pattern),
      row.candidate === "match",
      `config-candidate matcher disagreed with the table for pattern '${row.pattern}' against '${row.path}'`,
    );
  });
}

test("every table row asserts something about the actual divergence, not two matchers rubber-stamping agreement", () => {
  // If this ever drops to zero, the table stopped pinning anything -- the
  // two matchers could have been silently unified (fine) or silently
  // decoupled further (not fine) and nothing here would notice either way.
  const divergent = TABLE.filter((row) => row.scope !== row.candidate);
  assert.ok(divergent.length >= 4, "expected at least the four documented divergences to be pinned");
});
