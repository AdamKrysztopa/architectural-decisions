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

export function assertRelativePath(path, label) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path === "." ||
    isAbsolute(path) ||
    path.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`${label} must stay inside the repository: ${path}`);
  }
}

export function assertContainedPath(root, candidate, label) {
  const relativePath = relative(root, candidate);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside ${root}: ${candidate}`);
  }
}

export function validateRuntimeTrees(target, runtimeTrees) {
  if (!Array.isArray(runtimeTrees) || runtimeTrees.length === 0) {
    throw new Error(`${target} adapter must declare at least one runtime tree`);
  }

  for (const runtimeTree of runtimeTrees) {
    assertRelativePath(runtimeTree?.source, `${target} runtime source`);
    assertRelativePath(runtimeTree?.destination, `${target} runtime destination`);
  }
}

export function assertRootFileContract(target, rootFiles, generatedRootFiles) {
  if (!Array.isArray(rootFiles)) {
    throw new Error(`${target} adapter rootFiles must be an array`);
  }
  if (!Array.isArray(generatedRootFiles)) {
    throw new Error(`${target} generatedRootFiles must be an array`);
  }

  for (const path of generatedRootFiles) {
    assertRelativePath(path, `${target} generated root file`);
  }
  if (new Set(generatedRootFiles).size !== generatedRootFiles.length) {
    throw new Error(`${target} generatedRootFiles contains a duplicate path`);
  }

  const declaredPaths = rootFiles.map((rootFile) => {
    assertRelativePath(rootFile?.path, `${target} root file`);
    return rootFile.path;
  });
  if (new Set(declaredPaths).size !== declaredPaths.length) {
    throw new Error(`${target} adapter declares a duplicate root file`);
  }

  const declared = [...declaredPaths].sort();
  const managed = [...generatedRootFiles].sort();
  if (JSON.stringify(declared) !== JSON.stringify(managed)) {
    throw new Error(`${target} adapter root files differ from generatedRootFiles`);
  }
}

export function assertRootFileBoundaries(
  target,
  generatedRootFiles,
  generatedRootDirectories,
) {
  if (!Array.isArray(generatedRootDirectories) || generatedRootDirectories.length === 0) {
    throw new Error(`${target} generatedRootDirectories must be a non-empty array`);
  }

  const directoryRoots = generatedRootDirectories.map((directory) => {
    assertRelativePath(directory, `${target} generated root directory`);
    return resolve(repositoryRoot, directory);
  });

  for (const path of generatedRootFiles) {
    const candidate = resolve(repositoryRoot, path);
    const insideBoundary = directoryRoots.some((directoryRoot) => {
      const relativePath = relative(directoryRoot, candidate);
      return relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath);
    });
    if (!insideBoundary) {
      throw new Error(`${target} generated root file is outside its root directories: ${path}`);
    }
  }
}

export function assertTargetFileContract(target, targetFiles, generatedTargetFiles) {
  if (!Array.isArray(targetFiles)) {
    throw new Error(`${target} adapter targetFiles must be an array`);
  }
  if (!Array.isArray(generatedTargetFiles)) {
    throw new Error(`${target} generatedTargetFiles must be an array`);
  }

  for (const path of generatedTargetFiles) {
    assertRelativePath(path, `${target} generated target file`);
  }
  if (new Set(generatedTargetFiles).size !== generatedTargetFiles.length) {
    throw new Error(`${target} generatedTargetFiles contains a duplicate path`);
  }

  const declaredPaths = targetFiles.map((targetFile) => {
    assertRelativePath(targetFile?.path, `${target} target file`);
    return targetFile.path;
  });
  if (new Set(declaredPaths).size !== declaredPaths.length) {
    throw new Error(`${target} adapter declares a duplicate target file`);
  }

  const declared = [...declaredPaths].sort();
  const managed = [...generatedTargetFiles].sort();
  if (JSON.stringify(declared) !== JSON.stringify(managed)) {
    throw new Error(`${target} adapter target files differ from generatedTargetFiles`);
  }
}

// A generated target file may never land inside a tree that assertCopiedExactly
// owns. Without this, an adapter could inject a file into the copied skills/ or
// runtime/ tree and the byte-identity assertion would start comparing a tree it
// does not own.
export function assertTargetFileBoundaries(target, generatedTargetFiles, runtimeTrees) {
  for (const path of generatedTargetFiles) {
    assertRelativePath(path, `${target} generated target file`);
    for (const runtimeTree of runtimeTrees) {
      const relativePath = relative(runtimeTree.destination, path);
      if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
        throw new Error(
          `${target} generated target file '${path}' is inside a runtime tree ('${runtimeTree.destination}')`,
        );
      }
    }
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

async function assertGeneratedRootInventory(
  target,
  generatedRootFiles,
  generatedRootDirectories,
) {
  const actualFiles = [];
  for (const directory of generatedRootDirectories) {
    const files = await listFiles(join(repositoryRoot, directory));
    actualFiles.push(...files.map((file) => join(directory, file).split(sep).join("/")));
  }

  const expected = [...generatedRootFiles].sort();
  const actual = actualFiles.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${target} generated root inventory differs from generatedRootFiles`);
  }
}

async function assertGeneratedTargetInventory(
  target,
  outputRoot,
  manifestPath,
  generatedTargetFiles,
  runtimeTrees,
) {
  const expected = [manifestPath, ...generatedTargetFiles];
  for (const runtimeTree of runtimeTrees) {
    const files = await listFiles(join(outputRoot, runtimeTree.destination));
    expected.push(...files.map((file) => `${runtimeTree.destination}/${file}`));
  }
  const actual = await listFiles(outputRoot);
  if (JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) {
    throw new Error(`${target} output inventory differs from its declared contents`);
  }
}

async function loadContext() {
  const packagePath = join(repositoryRoot, "package.json");
  const metadata = await readJson(packagePath);
  const packaging = metadata.agentPackaging;

  if (
    !packaging?.canonicalSkills ||
    !packaging?.canonicalRuntime ||
    !packaging?.buildDirectory ||
    !packaging?.generatedRootDirectories ||
    !packaging?.generatedRootFiles ||
    !packaging?.generatedTargetFiles ||
    !packaging?.targets
  ) {
    throw new Error("package.json is missing agentPackaging configuration");
  }

  assertRelativePath(packaging.canonicalSkills, "canonicalSkills");
  assertRelativePath(packaging.canonicalRuntime, "canonicalRuntime");
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
  assertRelativePath(adapter.outputDirectory, `${target} outputDirectory`);
  const outputRoot = join(
    repositoryRoot,
    context.packaging.buildDirectory,
    adapter.outputDirectory,
  );
  const buildRoot = resolve(repositoryRoot, context.packaging.buildDirectory);
  assertContainedPath(buildRoot, outputRoot, `${target} output`);

  const adapterContext = {
    metadata: context.metadata,
    packaging: context.packaging,
    target,
    targetConfig,
  };
  const runtimeTrees = adapter.runtimeTrees?.(adapterContext);
  validateRuntimeTrees(target, runtimeTrees);
  const rootFiles = adapter.rootFiles ?? [];
  const generatedRootFiles = context.packaging.generatedRootFiles[target];
  const generatedRootDirectories = context.packaging.generatedRootDirectories[target];
  assertRootFileContract(
    target,
    rootFiles,
    generatedRootFiles,
  );
  assertRootFileBoundaries(target, generatedRootFiles, generatedRootDirectories);

  const targetFiles = adapter.targetFiles ?? [];
  const generatedTargetFiles = context.packaging.generatedTargetFiles[target] ?? [];
  assertTargetFileContract(target, targetFiles, generatedTargetFiles);
  assertTargetFileBoundaries(target, generatedTargetFiles, runtimeTrees);

  assertRelativePath(adapter.manifestPath, `${target} manifestPath`);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  for (const runtimeTree of runtimeTrees) {
    const sourceRoot = join(repositoryRoot, runtimeTree.source);
    const destinationRoot = join(outputRoot, runtimeTree.destination);
    await cp(sourceRoot, destinationRoot, { recursive: true });
    await assertCopiedExactly(sourceRoot, destinationRoot);
  }

  await writeJson(join(outputRoot, adapter.manifestPath), adapter.manifest(adapterContext));

  for (const targetFile of targetFiles) {
    await writeJson(join(outputRoot, targetFile.path), targetFile.render(adapterContext));
  }
  await assertGeneratedTargetInventory(
    target,
    outputRoot,
    adapter.manifestPath,
    generatedTargetFiles,
    runtimeTrees,
  );

  for (const rootFile of rootFiles) {
    await writeJson(join(repositoryRoot, rootFile.path), rootFile.render(adapterContext));
  }
  await assertGeneratedRootInventory(
    target,
    generatedRootFiles,
    generatedRootDirectories,
  );

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
