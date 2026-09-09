import { findConfigFiles } from "./text.mjs";
import { spawnTool } from "./spawn.mjs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const JSON_CANDIDATES = [".dependency-cruiser.json", ".dependency-cruiser.jsonc"];
const JS_CANDIDATES = [".dependency-cruiser.js", ".dependency-cruiser.cjs", ".dependency-cruiser.mjs"];

class UnreadableConfig extends Error {}

// Strips // and /* */ comments outside string literals so JSON.parse can run
// on JSONC. This is the one construct dependency-cruiser's JSON config format
// adds over JSON; nothing else about the file is reinterpreted.
export function stripJsonComments(text) {
  let out = "";
  let inString = false;
  let stringQuote = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inString) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        index += 1;
        continue;
      }
      if (char === stringQuote) inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      stringQuote = char;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    out += char;
  }
  return out;
}

export function extractRuleNames(text) {
  let parsed;
  try {
    parsed = JSON.parse(stripJsonComments(text));
  } catch (error) {
    throw new UnreadableConfig(`not valid JSON/JSONC: ${error.message}`);
  }
  const rules = [...(parsed.forbidden ?? []), ...(parsed.allowed ?? [])];
  return rules.map((rule) => rule?.name).filter((name) => typeof name === "string");
}

async function resolve(root, contract) {
  const jsFiles = await findConfigFiles(root, JS_CANDIDATES);
  const jsonFiles = await findConfigFiles(root, JSON_CANDIDATES);

  if (jsonFiles.length === 0 && jsFiles.length > 0) {
    return {
      resolved: false,
      reason: "unreadable-config",
      evidence: `${jsFiles[0]} is a JS config; dependency-cruiser JS configs are not statically readable`,
    };
  }
  if (jsonFiles.length === 0) {
    return { resolved: false, reason: "unbound", evidence: "no dependency-cruiser config found" };
  }

  const unreadable = [];
  for (const file of jsonFiles) {
    const text = await readFile(join(root, file), "utf8");
    let names;
    try {
      names = extractRuleNames(text);
    } catch (error) {
      if (error instanceof UnreadableConfig) {
        unreadable.push(`${file}: ${error.message}`);
        continue;
      }
      throw error;
    }
    if (names.includes(contract)) {
      return { resolved: true, location: { file }, evidence: `dependency-cruiser rule '${contract}' in ${file}` };
    }
  }
  if (unreadable.length > 0) {
    return {
      resolved: false,
      reason: "unreadable-config",
      evidence: `no forbidden/allowed rule named '${contract}' in any readable config; unreadable: ${unreadable.join("; ")}`,
    };
  }
  return { resolved: false, reason: "unbound", evidence: `no forbidden/allowed rule named '${contract}' in ${jsonFiles.join(", ")}` };
}

// depcruise evaluates the whole dependency graph against every rule in one
// pass; --output-type json is the one output shape with a stable
// per-violation rule.name field, so that is what is asked for and parsed —
// never the human-readable text report.
async function run(root, contract, resolution) {
  const result = await spawnTool(
    "depcruise",
    ["--config", resolution.location.file, "--output-type", "json", "."],
    { cwd: root },
  );
  if (!result.available) {
    return { status: "unavailable", evidence: "depcruise is not on PATH" };
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return { status: "error", evidence: "depcruise did not produce parseable JSON output" };
  }
  const hit = (report.summary?.violations ?? []).find((violation) => violation.rule?.name === contract);
  if (hit) {
    return { status: "fail", evidence: `depcruise reported a violation of '${contract}': ${hit.from} -> ${hit.to}` };
  }
  return { status: "pass", evidence: `depcruise reported no violation of '${contract}'` };
}

export default { tool: "dependency-cruiser", configCandidates: [...JSON_CANDIDATES, ...JS_CANDIDATES], resolve, run };
