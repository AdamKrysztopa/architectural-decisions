import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export async function cloneFixture(relativePath) {
  const source = join(repositoryRoot, "test/fixtures", relativePath);
  const dest = await mkdtemp(join(tmpdir(), "arch-crew-e2e-"));
  await cp(source, dest, { recursive: true });
  return dest;
}

export async function withPatch(path, patch, fn) {
  const original = await readFile(path, "utf8");
  try {
    await writeFile(path, patch(original), "utf8");
    await fn();
  } finally {
    await writeFile(path, original, "utf8");
  }
}

export async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true });
}
