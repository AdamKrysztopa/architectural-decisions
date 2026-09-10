// The documented subset of glob syntax a rule's `scope` may use. Anything outside
// it is an error naming the rule and the pattern -- the same discipline as
// runtime/baseline/frontmatter.mjs, and for the same reason: a matcher that
// silently mis-globs attributes drift to the wrong rule.
//
// Supported: literal segments, `*` (within a segment), `?` (one character), and
// `**` as a whole segment. A pattern with no wildcard is a module name: it
// matches itself and everything under it.

export class GlobError extends Error {
  constructor(message, pattern) {
    super(message);
    this.name = "GlobError";
    this.pattern = pattern;
  }
}

const UNSUPPORTED = /[{}[\]!\\]/;

function escapeLiteral(segment) {
  let source = "";
  for (const char of segment) {
    if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return source;
}

export function compileGlob(pattern, label) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new GlobError(`${label}: scope pattern must be a non-empty string`, pattern);
  }
  if (UNSUPPORTED.test(pattern)) {
    throw new GlobError(
      `${label}: scope pattern '${pattern}' uses an unsupported construct. The supported subset is literal segments, '*', '?', and a whole-segment '**'.`,
      pattern,
    );
  }

  const raw = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
  const segments = raw.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    throw new GlobError(`${label}: scope pattern '${pattern}' has an empty segment`, pattern);
  }

  let source = "^";
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const last = index === segments.length - 1;
    if (segment.includes("**")) {
      if (segment !== "**") {
        throw new GlobError(
          `${label}: scope pattern '${pattern}' mixes '**' with other characters in one segment; '**' must be a whole segment`,
          pattern,
        );
      }
      source += last ? "(?:.*)?" : "(?:[^/]+/)*";
    } else {
      source += escapeLiteral(segment);
      if (!last) source += "/";
    }
  }
  if (!/[*?]/.test(pattern)) source += "(?:/.*)?";
  source += "$";

  return new RegExp(source);
}

// git (drift's own path source) never emits a leading "./", but a checker
// adapter filtering its own findings against `scope` (gitleaks, semgrep) is
// handing this a file path some *other* tool produced, and at least one
// common invocation shape (a "detect over --source ." style scan run from
// the repository root) reports that path with a leading "./" on this
// platform's /bin/sh. Stripping it here, once, centrally, means every
// caller of matchesScope gets the same relative-path meaning for "services/**"
// regardless of which tool's own path convention supplied `path` --
// never silently treating an in-scope file as out-of-scope over a cosmetic
// "./" a rule's `scope` was never written to account for.
function normalizeRelativePath(path) {
  let normalized = path;
  while (normalized.startsWith("./")) normalized = normalized.slice(2);
  return normalized;
}

export function matchesScope(path, patterns, label) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  const normalized = normalizeRelativePath(path);
  return patterns.some((pattern) => compileGlob(pattern, label).test(normalized));
}
