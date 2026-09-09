import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// Minimal glob: a literal relative path, "*" within one path segment, and
// "**" meaning "any number of directories". No brace expansion, no character
// classes. That is enough for the six tools' documented config candidates
// and nothing more is attempted.
function segmentToRegExp(segment) {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
]);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(root, prefix = "") {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const child = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(root, child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

// "**.yml" is shorthand the per-tool config-candidate tables use for "any
// number of directories, then a file matching *.yml". Expand it to two
// segments so the recursive matcher below only ever handles a bare "**".
function expandPatternParts(pattern) {
  const parts = [];
  for (const segment of pattern.split("/")) {
    if (segment !== "**" && segment.startsWith("**")) {
      parts.push("**", `*${segment.slice(2)}`);
    } else {
      parts.push(segment);
    }
  }
  return parts;
}

function matchParts(fileParts, patternParts) {
  if (patternParts.length === 0) return fileParts.length === 0;
  const [head, ...restPattern] = patternParts;
  if (head === "**") {
    for (let i = 0; i <= fileParts.length; i += 1) {
      if (matchParts(fileParts.slice(i), restPattern)) return true;
    }
    return false;
  }
  if (fileParts.length === 0) return false;
  if (!segmentToRegExp(head).test(fileParts[0])) return false;
  return matchParts(fileParts.slice(1), restPattern);
}

function matchesGlob(filePath, pattern) {
  return matchParts(filePath.split("/"), expandPatternParts(pattern));
}

/**
 * Resolve a tool's configCandidates against a repository root. A candidate is
 * either a literal relative path or a glob containing "*"/"**". Returns the
 * list of matching files that actually exist, deduplicated.
 */
export async function findConfigFiles(root, candidates) {
  const found = [];
  for (const candidate of candidates) {
    if (!candidate.includes("*")) {
      if (await exists(join(root, candidate))) found.push(candidate);
      continue;
    }
    const parts = candidate.split("/");
    const globAt = parts.findIndex((part) => part.includes("*"));
    const staticPrefix = parts.slice(0, globAt).join("/");
    if (staticPrefix && !(await exists(join(root, staticPrefix)))) continue;

    for (const file of await walk(root, staticPrefix)) {
      if (matchesGlob(file, candidate)) found.push(file);
    }
  }
  return [...new Set(found)];
}

export async function readLines(root, relativePath) {
  const text = await readFile(join(root, relativePath), "utf8");
  return text.split("\n");
}
