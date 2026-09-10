import { findConfigFiles, readLines } from "./text.mjs";
import { spawnTool } from "./spawn.mjs";

// pytest-archon has no config file: a "contract" is a Python test function
// that calls the archon assertion API. We do not parse Python and we do not
// verify the function body calls archon at all — we only confirm that a test
// function with this exact name exists in a file pytest would collect. That
// is a shape check, not a semantic one: the one adapter that can never
// report more than "a plausibly-named test exists," never "this test
// actually enforces the boundary."
const TEST_FILE_CANDIDATES = ["**/test_*.py", "**/*_test.py"];
const DEF_LINE = /^\s*def\s+([A-Za-z_]\w*)\s*\(/;

export function findTestFunctions(text) {
  const names = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = DEF_LINE.exec(lines[index]);
    if (match) names.push({ name: match[1], line: index + 1 });
  }
  return names;
}

async function resolve(root, contract) {
  const files = await findConfigFiles(root, TEST_FILE_CANDIDATES);
  if (files.length === 0) {
    return { resolved: false, reason: "unbound", evidence: "no test_*.py or *_test.py files found" };
  }
  for (const file of files) {
    const text = (await readLines(root, file)).join("\n");
    const match = findTestFunctions(text).find((entry) => entry.name === contract);
    if (match) {
      return {
        resolved: true,
        location: { file, line: match.line },
        evidence: `pytest-archon test function '${contract}' in ${file}:${match.line} (name match only; the body is not inspected)`,
      };
    }
  }
  return { resolved: false, reason: "unbound", evidence: `no test function named '${contract}' in any collected test file` };
}

// A single test function selects cleanly on pytest's own command line, so
// this is the one adapter that evaluates exactly the named contract and
// nothing else in the file.
//
// pytest reserves exit 1 for "tests ran, at least one failed" — a proven
// contract violation. Every other nonzero exit (2 interrupted, 3 internal
// error, 4 usage error, 5 no tests collected — e.g. pytest_archon is not
// installed in the active interpreter and the module fails to import) means
// the contract was never actually evaluated, so it must never be reported as
// "fail": a broken/missing tool is not mistaken for the contract failing.
async function run(root, contract, resolution) {
  const nodeId = `${resolution.location.file}::${contract}`;
  const result = await spawnTool("pytest", [nodeId, "-q"], { cwd: root });
  if (!result.available) {
    return { status: "unavailable", evidence: "pytest is not on PATH" };
  }
  if (result.exitCode === 0) {
    return { status: "pass", evidence: `pytest ${nodeId} passed` };
  }
  if (result.exitCode === 1) {
    return { status: "fail", evidence: `pytest ${nodeId} failed:\n${result.stdout.slice(-2000)}` };
  }
  return {
    status: "error",
    evidence: `pytest ${nodeId} exited ${result.exitCode} without running the test to completion (not a proven contract failure):\n${(result.stdout + result.stderr).slice(-2000)}`,
  };
}

export default { tool: "pytest-archon", configCandidates: TEST_FILE_CANDIDATES, resolve, run };
