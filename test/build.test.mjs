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
  const skillNames = (await readdir(canonicalSkills, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(skillNames, [
    "agentic-patterns",
    "decide-architecture",
    "design-patterns",
    "test-patterns",
  ]);

  for (const name of skillNames) {
    const text = await readFile(join(canonicalSkills, name, "SKILL.md"), "utf8");
    assert.match(text, new RegExp(`^---\\nname: ${name}\\n`, "m"));
    for (const reference of ["decision-tree.md", "catalog.md"]) {
      assert.match(text, new RegExp(`references/${reference.replace(".", "\\.")}`));
      const contents = await readFile(join(canonicalSkills, name, "references", reference), "utf8");
      assert.ok(contents.length > 0, `${name}/${reference} is empty`);
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
  const skillNames = (await readdir(canonicalSkills, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const claudeManifest = await readJson(join(repositoryRoot, "build/claude/.claude-plugin/plugin.json"));
  const claudeMarketplace = await readJson(join(repositoryRoot, ".claude-plugin/marketplace.json"));
  const codexManifest = await readJson(join(repositoryRoot, "build/codex/.codex-plugin/plugin.json"));

  const surfaces = [
    ["claude manifest", claudeManifest.description],
    ["claude marketplace", claudeMarketplace.plugins[0].description],
    ["codex manifest", codexManifest.description],
  ];
  for (const [label, description] of surfaces) {
    for (const name of skillNames) {
      assert.ok(description.includes(name), `${label} description omits ${name}`);
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
