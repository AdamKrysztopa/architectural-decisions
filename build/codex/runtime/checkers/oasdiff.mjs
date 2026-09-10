import { findConfigFiles, readLines } from "./text.mjs";
import { spawnTool } from "./spawn.mjs";

const CONFIG_CANDIDATES = [".oasdiff.yaml", ".oasdiff.yml"];

// oasdiff has no per-repo "contract catalog" file to read — its checks are
// built into the binary and named by a fixed id. We deliberately do NOT
// parse CI config (GitHub Actions YAML, a Makefile, ...) to see whether
// oasdiff is actually invoked: CI formats are too varied for a documented
// subset, and scanning arbitrary YAML for a command line is exactly the
// "match a literal string" shortcut this design rejects for every other
// tool. Resolution here means "this is a real oasdiff breaking-change check
// id," checked against a short vendored list kept current by hand — never
// invented per repo, and never proof that this repository runs the check.
export const VENDORED_CHECK_IDS = [
  "api-path-removed-without-deprecation",
  "api-removed-without-deprecation",
  "request-body-became-required",
  "request-parameter-became-required",
  "request-property-became-required",
  "response-mediatype-removed",
  "response-property-became-optional",
  "response-required-property-removed",
  "response-success-status-removed",
];

async function resolve(root, contract) {
  if (!VENDORED_CHECK_IDS.includes(contract)) {
    return {
      resolved: false,
      reason: "unbound",
      evidence: `'${contract}' is not a recognised oasdiff check id (checked against a vendored list, not any file in this repo)`,
    };
  }

  const configs = await findConfigFiles(root, CONFIG_CANDIDATES);
  if (configs.length === 0) {
    return {
      resolved: true,
      evidence: `'${contract}' is a known oasdiff check id; no .oasdiff.yaml found, so --run has no spec pair to diff and will report unavailable`,
    };
  }
  return {
    resolved: true,
    location: { file: configs[0] },
    evidence: `'${contract}' is a known oasdiff check id, and ${configs[0]} names the spec pair to diff`,
  };
}

// Only used by --run: read a documented two-key subset of .oasdiff.yaml
// (base:/revision: paths). Everything else in the file is opaque, exactly
// like the fields the other adapters do not read.
export async function readSpecPaths(root, configPath) {
  const lines = await readLines(root, configPath);
  const paths = {};
  for (const line of lines) {
    const field = /^(base|revision):\s*(.+)$/.exec(line.trim());
    if (field) paths[field[1]] = field[2].trim().replace(/^["']|["']$/g, "");
  }
  return paths;
}

async function run(root, contract, resolution) {
  if (!resolution.location) {
    return { status: "unavailable", evidence: "no .oasdiff.yaml; no base/revision spec pair to diff" };
  }
  const paths = await readSpecPaths(root, resolution.location.file);
  if (!paths.base || !paths.revision) {
    return { status: "unavailable", evidence: `${resolution.location.file} does not declare both base: and revision:` };
  }
  const result = await spawnTool("oasdiff", ["breaking", paths.base, paths.revision, "-f", "json"], { cwd: root });
  if (!result.available) {
    return { status: "unavailable", evidence: "oasdiff is not on PATH" };
  }
  let changes;
  try {
    changes = JSON.parse(result.stdout);
  } catch {
    return { status: "error", evidence: "oasdiff did not produce parseable JSON output" };
  }
  const hit = (Array.isArray(changes) ? changes : []).find((change) => change.id === contract);
  if (hit) {
    return { status: "fail", evidence: `oasdiff reported '${contract}': ${hit.text ?? ""}` };
  }
  return { status: "pass", evidence: `oasdiff reported no '${contract}' breaking change between ${paths.base} and ${paths.revision}` };
}

export default { tool: "oasdiff", configCandidates: CONFIG_CANDIDATES, resolve, run };
