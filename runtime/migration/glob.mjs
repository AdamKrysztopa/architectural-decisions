// The closed glob vocabulary `scope` fields use (literal segments, `*` within a
// segment, `?` for one character, and a whole-segment `**`) already has one
// matcher: SP3's runtime/drift/globs.mjs. Reuse it here instead of maintaining
// a second, silently-drifting implementation for the same field.

import { compileGlob, matchesScope } from "../drift/globs.mjs";

export { compileGlob, matchesScope };

export function matchGlob(pattern, path) {
  return compileGlob(pattern, "scope").test(path);
}

// A path prefix with no wildcard segment: the part of the pattern that must
// literally exist before any `*`, `?`, or `**` takes over. An entirely
// wildcard prefix (a pattern starting with `*`, `?`, or `**`) has a static
// prefix of "" -- the widest possible scope, which overlaps everything.
function staticPrefix(pattern) {
  const raw = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
  const segments = raw.split("/");
  const prefix = [];
  for (const segment of segments) {
    if (/[*?]/.test(segment)) break;
    prefix.push(segment);
  }
  return prefix.join("/");
}

// Conservative on purpose: true whenever two scopes cannot be proven disjoint.
// This is a candidate signal for a human to read, never an assertion that the
// rules actually conflict — two rules may legitimately scope the same tree.
// An empty static prefix on either side means that scope's reach cannot be
// bounded to any subtree at all (e.g. "**" or "**/models.py"), so it can
// never be proven disjoint from anything and always counts as an overlap.
export function scopesOverlap(scopeA, scopeB) {
  if (scopeA.length === 0 || scopeB.length === 0) return false;
  for (const a of scopeA) {
    for (const b of scopeB) {
      const prefixA = staticPrefix(a);
      const prefixB = staticPrefix(b);
      if (prefixA === "" || prefixB === "") return true;
      if (prefixA === prefixB || prefixA.startsWith(`${prefixB}/`) || prefixB.startsWith(`${prefixA}/`)) {
        return true;
      }
    }
  }
  return false;
}
