#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const buildersDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(buildersDirectory, "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertRelativePath(path, label) {
  if (isAbsolute(path) || path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} must stay inside the repository: ${path}`);
  }
}

async function listFiles(root, prefix = "") {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, child)));
    } else if (entry.isFile()) {
      files.push(child.split(sep).join("/"));
    } else {
      throw new Error(`Unsupported canonical skill entry: ${child}`);
    }
  }

  return files;
}

async function assertCopiedExactly(sourceRoot, destinationRoot) {
  const sourceFiles = await listFiles(sourceRoot);
  const destinationFiles = await listFiles(destinationRoot);

  if (JSON.stringify(sourceFiles) !== JSON.stringify(destinationFiles)) {
    throw new Error("Generated skill inventory differs from canonical skills");
  }

  for (const file of sourceFiles) {
    const [source, generated] = await Promise.all([
      readFile(join(sourceRoot, file)),
      readFile(join(destinationRoot, file)),
    ]);
    if (!source.equals(generated)) {
      throw new Error(`Generated skill is not byte-identical: ${file}`);
    }
  }
}

async function loadContext() {
  const packagePath = join(repositoryRoot, "package.json");
  const metadata = await readJson(packagePath);
  const packaging = metadata.agentPackaging;

  if (!packaging?.canonicalSkills || !packaging?.buildDirectory || !packaging?.targets) {
    throw new Error("package.json is missing agentPackaging configuration");
  }

  assertRelativePath(packaging.canonicalSkills, "canonicalSkills");
  assertRelativePath(packaging.buildDirectory, "buildDirectory");

  return { metadata, packaging };
}

async function buildTarget(target, context) {
  const targetConfig = context.packaging.targets[target];
  if (!targetConfig) {
    throw new Error(`Unknown target '${target}'`);
  }

  assertRelativePath(targetConfig.adapter, `${target} adapter`);
  const adapterPath = join(buildersDirectory, targetConfig.adapter);
  const { default: adapter } = await import(pathToFileURL(adapterPath));
  const outputRoot = join(repositoryRoot, context.packaging.buildDirectory, target);
  const buildRoot = resolve(repositoryRoot, context.packaging.buildDirectory);

  if (relative(buildRoot, outputRoot).startsWith("..")) {
    throw new Error(`Refusing to clean output outside build root: ${outputRoot}`);
  }

  assertRelativePath(adapter.manifestPath, `${target} manifestPath`);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const canonicalSkills = join(repositoryRoot, context.packaging.canonicalSkills);
  const generatedSkills = join(outputRoot, "skills");
  await cp(canonicalSkills, generatedSkills, { recursive: true });

  const adapterContext = {
    metadata: context.metadata,
    target,
    targetConfig,
  };
  await writeJson(join(outputRoot, adapter.manifestPath), adapter.manifest(adapterContext));

  for (const rootFile of adapter.rootFiles ?? []) {
    assertRelativePath(rootFile.path, `${target} root file`);
    await writeJson(join(repositoryRoot, rootFile.path), rootFile.render(adapterContext));
  }

  await assertCopiedExactly(canonicalSkills, generatedSkills);
  return outputRoot;
}

function parseTarget(args) {
  if (args.length !== 2 || args[0] !== "--target" || !args[1]) {
    throw new Error("Usage: npm run build -- --target <claude|codex|all>");
  }
  return args[1];
}

export async function build(requestedTarget) {
  const context = await loadContext();
  const targets =
    requestedTarget === "all" ? Object.keys(context.packaging.targets) : [requestedTarget];

  for (const target of targets) {
    const outputRoot = await buildTarget(target, context);
    process.stdout.write(`Built ${target}: ${relative(repositoryRoot, outputRoot)}\n`);
  }
}

async function main() {
  await build(parseTarget(process.argv.slice(2)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
