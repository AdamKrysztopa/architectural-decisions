import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skillsRoot = join(repositoryRoot, "skills");

const frozen = JSON.parse(
  await readFile(join(repositoryRoot, "test/fixtures/skill-freeze/frontmatter-0.3.1.json"), "utf8"),
);

// Hardcoded on purpose, matching the house pattern in build.test.mjs and
// scenarios.test.mjs: the manifest must be updated by a deliberate edit, or
// this suite would grade a body change against itself.
const bodyManifest = JSON.parse(
  await readFile(join(repositoryRoot, "test/fixtures/skill-freeze/body-manifest.json"), "utf8"),
);

function splitFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(match, "SKILL.md does not open with a frontmatter block");
  return { block: match[1], body: match[2] };
}

for (const [name, expected] of Object.entries(frozen)) {
  test(`${name}'s frozen frontmatter is byte-identical to its fixture`, async () => {
    const text = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
    const { block } = splitFrontmatter(text);
    const nameLine = /^name:\s*(.+)$/m.exec(block)[1].trim();
    const description = block.slice(block.indexOf("description:")).replace(/^description:\s*/, "").trim();
    assert.equal(nameLine, expected.name, `${name}'s frontmatter 'name' differs from its fixture`);
    assert.equal(
      description,
      expected.description,
      `${name}'s frontmatter 'description' differs from its fixture — triggering behaviour is part of the shipped release; change it only with a decision (see 0004)`,
    );
  });
}

test("every packaged skill's body hash matches the committed manifest", async () => {
  const names = Object.keys(bodyManifest).sort();
  for (const name of names) {
    const text = await readFile(join(skillsRoot, name, "SKILL.md"), "utf8");
    const { body } = splitFrontmatter(text);
    const hash = createHash("sha256").update(body).digest("hex");
    assert.equal(
      hash,
      bodyManifest[name],
      `${name}/SKILL.md body changed and test/fixtures/skill-freeze/body-manifest.json was not updated — ` +
        `update the manifest deliberately and note the change in the release notes`,
    );
  }
});

test("the body manifest names every currently packaged skill", async () => {
  const { readdir } = await import("node:fs/promises");
  const packaged = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(Object.keys(bodyManifest).sort(), packaged);
});
