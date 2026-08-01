import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { before, test } from "node:test";
import {
  assertContainedPath,
  assertRelativePath,
  assertRootFileBoundaries,
  assertRootFileContract,
  validateRuntimeTrees,
} from "../builders/build.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalSkills = join(repositoryRoot, "skills");
const builder = join(repositoryRoot, "builders/build.mjs");

// Hardcoded on purpose. Shipping a skill has to cost a deliberate edit here,
// otherwise the inventory tests below would grade the build against itself.
const expectedSkillNames = [
  "agentic-patterns",
  "decide-architecture",
  "design-patterns",
  "test-patterns",
];

// Terms a user-visible surface may use to advertise each skill. Release
// metadata legitimately avoids the literal directory name — the marketplace
// card says "testing strategy", not "test-patterns" — so a skill counts as
// advertised when any one of its terms shows up as a whole token.
const advertisedTerms = {
  "agentic-patterns": ["agentic-patterns", "agentic-system", "agentic", "llm-agent"],
  "decide-architecture": ["decide-architecture", "software architecture", "architecture"],
  "design-patterns": ["design-patterns", "design pattern"],
  "test-patterns": ["test-patterns", "testing strategy", "testing"],
};

// A description short enough to be blank, a stub, or a placeholder cannot
// trigger its skill; docs/README.md names this field as the trigger surface.
const descriptionFloor = 40;

// Every skill ships at least these two; a skill may add topic references when a
// single catalog would be too large to retrieve selectively (test-patterns does).
const requiredReferences = ["decision-tree.md", "catalog.md"];

const documentationFiles = ["README.md", "llms.txt"];

// Prose that counts the skills goes stale silently. Any "<count> … skills"
// claim in these files must match what is actually packaged.
const skillCountedDocumentation = [
  "README.md",
  "llms.txt",
  "AGENTS.md",
  "docs/README.md",
  "docs/building-packages.md",
  "docs/examples/README.md",
];

const numberWords = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-token match: a hyphen counts as part of the token, so "patterns" never
// satisfies "design-patterns" and "test" never satisfies "test-patterns". A
// trailing plural is tolerated so "architecture" still matches "architectures".
function mentions(text, term) {
  return new RegExp(`(?<![\\w-])${escapeForRegExp(term)}s?(?![\\w-])`, "i").test(text);
}

function assertAdvertises(label, text, name) {
  const terms = advertisedTerms[name];
  assert.ok(terms?.length > 0, `no advertised terms are declared for ${name}`);
  assert.ok(
    terms.some((term) => mentions(text, term)),
    `${label} advertises ${name} by none of ${JSON.stringify(terms)}`,
  );
}

// Reads the leading YAML block well enough to see which keys are declared and
// how much description text each carries, including folded/literal scalars.
function parseFrontmatter(text, label) {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(block, `${label} does not open with a frontmatter block`);

  const keys = [];
  const values = {};
  let current = null;
  for (const line of block[1].split("\n")) {
    const field = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (field) {
      current = field[1];
      keys.push(current);
      values[current] = field[2].trim();
    } else if (current) {
      values[current] = `${values[current]} ${line.trim()}`;
    }
  }

  for (const key of keys) {
    values[key] = values[key]
      .replace(/^[>|][-+]?\s*/, "")
      .replace(/^["']|["']$/g, "")
      .trim();
  }
  return { keys, values };
}

async function canonicalSkillNames() {
  return (await readdir(canonicalSkills, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function listFiles(root, prefix = "") {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, child)));
    else if (entry.isFile()) files.push(child.split(sep).join("/"));
  }
  return files;
}

async function treeDigest(paths) {
  const hash = createHash("sha256");
  for (const path of paths) {
    const files = await listFiles(path);
    for (const file of files) {
      hash.update(`${path}:${file}\0`);
      hash.update(await readFile(join(path, file)));
    }
  }
  return hash.digest("hex");
}

async function runBuild(target = "all") {
  return execFileAsync(process.execPath, [builder, "--target", target], {
    cwd: repositoryRoot,
  });
}

before(async () => {
  await runBuild();
});

test("repeated builds are idempotent", async () => {
  const paths = [
    join(repositoryRoot, "build"),
    join(repositoryRoot, ".claude-plugin"),
    join(repositoryRoot, ".agents"),
  ];
  const first = await treeDigest(paths);
  await runBuild();
  const second = await treeDigest(paths);
  assert.equal(second, first);
});

test("target inventories contain only their manifest and canonical skills", async () => {
  const skillFiles = (await listFiles(canonicalSkills)).map((file) => `skills/${file}`);
  const claudeFiles = await listFiles(join(repositoryRoot, "build/claude"));
  const codexFiles = await listFiles(join(repositoryRoot, "build/codex"));

  assert.deepEqual(
    [...claudeFiles].sort(),
    [".claude-plugin/plugin.json", ...skillFiles].sort(),
  );
  assert.deepEqual(
    [...codexFiles].sort(),
    [".codex-plugin/plugin.json", ...skillFiles].sort(),
  );
});

test("generated skill payloads are byte-identical to the canonical skills", async () => {
  const files = await listFiles(canonicalSkills);
  for (const target of ["claude", "codex"]) {
    for (const file of files) {
      const [canonical, generated] = await Promise.all([
        readFile(join(canonicalSkills, file)),
        readFile(join(repositoryRoot, "build", target, "skills", file)),
      ]);
      assert.ok(canonical.equals(generated), `${target}/${file} changed during packaging`);
    }
  }
});

test("skill names and progressive-disclosure references remain valid", async () => {
  const skillNames = await canonicalSkillNames();
  assert.deepEqual(skillNames, expectedSkillNames);

  for (const name of skillNames) {
    const text = await readFile(join(canonicalSkills, name, "SKILL.md"), "utf8");
    assert.match(text, new RegExp(`^---\\nname: ${name}\\n`, "m"));

    const frontmatter = parseFrontmatter(text, `${name}/SKILL.md`);
    assert.deepEqual(
      [...frontmatter.keys].sort(),
      ["description", "name"],
      `${name}/SKILL.md frontmatter must declare only name and description`,
    );
    assert.equal(frontmatter.values.name, name);
    const description = frontmatter.values.description ?? "";
    assert.ok(
      description.length >= descriptionFloor,
      `${name}/SKILL.md description is ${description.length} chars — too short to trigger the skill`,
    );

    const references = await listFiles(join(canonicalSkills, name, "references"));
    for (const reference of requiredReferences) {
      assert.ok(references.includes(reference), `${name} does not ship references/${reference}`);
    }

    // Both directions: a reference nothing loads is dead weight, and a
    // reference SKILL.md sends the model to must exist in the package.
    for (const reference of references) {
      const contents = await readFile(
        join(canonicalSkills, name, "references", reference),
        "utf8",
      );
      assert.ok(contents.length > 0, `${name}/references/${reference} is empty`);
      assert.match(
        text,
        new RegExp(`references/${escapeForRegExp(reference)}`),
        `${name}/SKILL.md never tells the model when to load references/${reference}`,
      );
    }

    for (const [, cited] of text.matchAll(/`?references\/([\w.-]+\.md)`?/g)) {
      assert.ok(
        references.includes(cited),
        `${name}/SKILL.md points at references/${cited}, which does not exist`,
      );
    }
  }
});

test("every canonical skill reaches every target with all of its references", async () => {
  const skillNames = await canonicalSkillNames();
  for (const target of ["claude", "codex"]) {
    for (const name of skillNames) {
      const packaged = await listFiles(join(repositoryRoot, "build", target, "skills", name));
      assert.ok(packaged.includes("SKILL.md"), `${target} package is missing ${name}/SKILL.md`);
      const canonical = await listFiles(join(canonicalSkills, name));
      assert.deepEqual(
        packaged.sort(),
        canonical.sort(),
        `${target} package does not carry every file of ${name}`,
      );
    }
  }
});

test("manifests point at paths that exist", async () => {
  const codexManifest = await readJson(
    join(repositoryRoot, "build/codex/.codex-plugin/plugin.json"),
  );
  const claudeMarketplace = await readJson(
    join(repositoryRoot, ".claude-plugin/marketplace.json"),
  );
  const codexMarketplace = await readJson(join(repositoryRoot, ".agents/plugins/marketplace.json"));

  const declared = [
    ["codex manifest skills", join("build/codex", codexManifest.skills)],
    ["claude marketplace source", claudeMarketplace.plugins[0].source],
    ["codex marketplace source", codexMarketplace.plugins[0].source.path],
  ];
  for (const [label, path] of declared) {
    const files = await listFiles(join(repositoryRoot, path));
    assert.ok(files.length > 0, `${label} points at an empty or missing path: ${path}`);
  }
});

test("documentation claims the same number of skills as are packaged", async () => {
  const skillNames = await canonicalSkillNames();
  const expected = String(skillNames.length);
  const expectedWord = numberWords[skillNames.length];
  const counted = new RegExp(
    `\\b(${numberWords.join("|")}|\\d+)\\s+(?:[\\w-]+\\s+){0,3}skills\\b`,
    "gi",
  );

  for (const file of skillCountedDocumentation) {
    const text = await readFile(join(repositoryRoot, file), "utf8");
    for (const [phrase, count] of text.matchAll(counted)) {
      const normalized = count.toLowerCase();
      assert.ok(
        normalized === expected || normalized === expectedWord,
        `${file} says "${phrase.trim()}" but ${skillNames.length} skills are packaged`,
      );
    }
  }
});

test("manifests and installer catalogs agree on identity, version, and target", async () => {
  const metadata = await readJson(join(repositoryRoot, "package.json"));
  const rootClaude = await readJson(join(repositoryRoot, ".claude-plugin/plugin.json"));
  const builtClaude = await readJson(join(repositoryRoot, "build/claude/.claude-plugin/plugin.json"));
  const claudeMarketplace = await readJson(
    join(repositoryRoot, ".claude-plugin/marketplace.json"),
  );
  const codexManifest = await readJson(join(repositoryRoot, "build/codex/.codex-plugin/plugin.json"));
  const codexMarketplace = await readJson(join(repositoryRoot, ".agents/plugins/marketplace.json"));

  assert.deepEqual(rootClaude, builtClaude);
  assert.equal(rootClaude.name, metadata.name);
  assert.equal(rootClaude.version, metadata.version);
  assert.equal(claudeMarketplace.plugins.length, 1);
  assert.equal(claudeMarketplace.plugins[0].source, "./build/claude");
  assert.equal(claudeMarketplace.plugins[0].version, metadata.version);
  assert.equal(codexManifest.name, metadata.name);
  assert.equal(codexManifest.version, metadata.version);
  assert.equal(codexManifest.skills, "./skills/");
  assert.equal(codexManifest.interface.displayName, "Arch Crew");
  assert.equal(codexManifest.interface.developerName, metadata.author.name);
  assert.ok(codexManifest.interface.capabilities.includes("Interactive"));
  assert.ok(codexManifest.interface.defaultPrompt.length > 0);
  assert.equal(codexMarketplace.plugins.length, 1);
  assert.equal(codexMarketplace.plugins[0].name, metadata.name);
  assert.equal(codexMarketplace.plugins[0].source.path, "./build/codex");
});

test("generated metadata advertises every canonical skill", async () => {
  const skillNames = await canonicalSkillNames();
  assert.deepEqual(
    Object.keys(advertisedTerms).sort(),
    skillNames,
    "the advertised-term map must be updated whenever a skill is added or removed",
  );

  const claudeManifest = await readJson(join(repositoryRoot, "build/claude/.claude-plugin/plugin.json"));
  const claudeMarketplace = await readJson(join(repositoryRoot, ".claude-plugin/marketplace.json"));
  const codexManifest = await readJson(join(repositoryRoot, "build/codex/.codex-plugin/plugin.json"));

  const keywords = claudeMarketplace.plugins[0].keywords;
  assert.ok(
    Array.isArray(keywords) && keywords.length > 0,
    "claude marketplace plugin publishes no keywords",
  );

  const surfaces = [
    ["claude manifest description", claudeManifest.description],
    ["claude marketplace card description", claudeMarketplace.metadata.description],
    ["claude marketplace plugin description", claudeMarketplace.plugins[0].description],
    ["claude marketplace plugin keywords", keywords.join(" ")],
    ["codex manifest description", codexManifest.description],
    ["codex interface longDescription", codexManifest.interface.longDescription],
  ];
  for (const [label, text] of surfaces) {
    assert.ok(typeof text === "string" && text.length > 0, `${label} is empty`);
    for (const name of skillNames) {
      assertAdvertises(label, text, name);
    }
  }

  const prompts = codexManifest.interface.defaultPrompt;
  assert.ok(Array.isArray(prompts), "codex interface defaultPrompt must be an array");
  assert.ok(
    prompts.every((prompt) => typeof prompt === "string" && prompt.trim().length > 0),
    "codex interface defaultPrompt contains an empty prompt",
  );
  assert.ok(
    prompts.length >= skillNames.length,
    `codex interface defaultPrompt offers ${prompts.length} prompts for ${skillNames.length} skills`,
  );
});

test("shipped documentation names every canonical skill", async () => {
  const skillNames = await canonicalSkillNames();
  for (const file of documentationFiles) {
    const text = await readFile(join(repositoryRoot, file), "utf8");
    for (const name of skillNames) {
      assert.ok(mentions(text, name), `${file} never names ${name}`);
    }
  }
});

test("unsupported targets fail without creating an artifact", async () => {
  await assert.rejects(runBuild("future-agent"), /Unknown target 'future-agent'/);
});

test("path guards reject broad, absolute, and traversal destinations", () => {
  const buildRoot = join(repositoryRoot, "build");
  assert.doesNotThrow(() =>
    assertContainedPath(buildRoot, join(buildRoot, "claude"), "claude output"),
  );
  assert.throws(() => assertRelativePath(".", "test path"), /must stay inside/);
  assert.throws(() => assertRelativePath("../outside", "test path"), /must stay inside/);
  assert.throws(() => assertRelativePath(resolve("/tmp"), "test path"), /must stay inside/);
  assert.throws(() => assertContainedPath(buildRoot, buildRoot, "build output"), /must stay inside/);
  assert.throws(
    () => assertContainedPath(buildRoot, repositoryRoot, "build output"),
    /must stay inside/,
  );
});

test("adapter contracts require runtime trees and exact root-file allowlists", () => {
  const runtimeTrees = [{ source: "skills", destination: "skills" }];
  assert.doesNotThrow(() => validateRuntimeTrees("test", runtimeTrees));
  assert.throws(() => validateRuntimeTrees("test", []), /at least one runtime tree/);
  assert.throws(
    () => validateRuntimeTrees("test", [{ source: "../outside", destination: "skills" }]),
    /must stay inside/,
  );

  const rootFiles = [{ path: ".agents/plugins/marketplace.json" }];
  const generatedRootFiles = [".agents/plugins/marketplace.json"];
  assert.doesNotThrow(() =>
    assertRootFileContract("test", rootFiles, generatedRootFiles),
  );
  assert.throws(
    () => assertRootFileContract("test", [], generatedRootFiles),
    /differ from generatedRootFiles/,
  );
  assert.throws(
    () => assertRootFileContract("test", [...rootFiles, ...rootFiles], generatedRootFiles),
    /duplicate root file/,
  );
  assert.throws(
    () => assertRootFileContract("test", rootFiles, [...generatedRootFiles, ...generatedRootFiles]),
    /generatedRootFiles contains a duplicate/,
  );

  const generatedRootDirectories = [".agents/plugins"];
  assert.doesNotThrow(() =>
    assertRootFileBoundaries("test", generatedRootFiles, generatedRootDirectories),
  );
  assert.throws(
    () => assertRootFileBoundaries("test", ["package.json"], generatedRootDirectories),
    /outside its root directories/,
  );
});
